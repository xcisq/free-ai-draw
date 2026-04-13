from __future__ import annotations

import json
import sys
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from ..config import settings
from ..schemas import ArtifactInfo, CreateJobRequest, JobResponse, JobStatus
from .artifact_service import scan_artifacts
from .bundle_service import build_manifest, create_bundle, write_manifest
from .pipeline_service import run_pipeline


@dataclass
class JobRecord:
    job_id: str
    request_payload: dict[str, Any]
    job_dir: Path
    log_path: Path
    status: JobStatus
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error_message: str | None = None
    artifacts: list[ArtifactInfo] = field(default_factory=list)
    pipeline_result: dict[str, Any] | None = None
    bundle_path: Path | None = None


_LOCK = threading.RLock()
_JOBS: dict[str, JobRecord] = {}
_EXECUTOR = ThreadPoolExecutor(max_workers=settings.max_concurrent_jobs)


def create_job(request: CreateJobRequest) -> JobRecord:
    now = datetime.utcnow()
    job_id = f"{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    job_dir = settings.jobs_dir / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    log_path = job_dir / settings.run_log_name
    log_path.write_text("", encoding="utf-8")

    record = JobRecord(
        job_id=job_id,
        request_payload=request.model_dump(mode="json"),
        job_dir=job_dir,
        log_path=log_path,
        status="queued",
        created_at=now,
    )
    with _LOCK:
        _JOBS[job_id] = record
        _persist_job_record(record)

    _EXECUTOR.submit(_run_job, job_id)
    return record


def get_job(job_id: str) -> JobRecord | None:
    with _LOCK:
        record = _JOBS.get(job_id)
    if record is not None:
        return record
    return _load_job_from_disk(job_id)


def get_job_response(job_id: str) -> JobResponse | None:
    record = get_job(job_id)
    if record is None:
        return None

    manifest_path = record.job_dir / settings.manifest_name
    bundle_url = f"/api/jobs/{job_id}/bundle" if record.bundle_path and record.bundle_path.is_file() else None
    manifest_url = (
        f"/api/jobs/{job_id}/artifacts/{settings.manifest_name}"
        if manifest_path.is_file()
        else None
    )
    return JobResponse(
        job_id=record.job_id,
        status=record.status,
        created_at=record.created_at,
        started_at=record.started_at,
        finished_at=record.finished_at,
        error_message=record.error_message,
        artifacts=record.artifacts,
        bundle_url=bundle_url,
        manifest_url=manifest_url,
        request=record.request_payload,
    )


def _run_job(job_id: str) -> None:
    record = get_job(job_id)
    if record is None:
        return

    record.status = "running"
    record.started_at = datetime.utcnow()
    _persist_job_record(record)

    try:
        request = CreateJobRequest.model_validate(record.request_payload)
        result = run_pipeline(request=request, output_dir=record.job_dir, log_path=record.log_path)
        record.pipeline_result = result
        record.artifacts = scan_artifacts(job_id=record.job_id, job_dir=record.job_dir)
        manifest = build_manifest(
            job_id=record.job_id,
            status="succeeded",
            request_payload=record.request_payload,
            created_at=record.created_at,
            started_at=record.started_at,
            finished_at=datetime.utcnow(),
            artifacts=record.artifacts,
            pipeline_result=record.pipeline_result,
            error_message=None,
        )
        write_manifest(record.job_dir, manifest)
        record.artifacts = scan_artifacts(job_id=record.job_id, job_dir=record.job_dir)
        record.bundle_path = create_bundle(record.job_dir)
        record.status = "succeeded"
        record.finished_at = datetime.utcnow()
        _persist_job_record(record)
    except Exception as exc:
        with record.log_path.open("a", encoding="utf-8") as log_handle:
            log_handle.write(f"\n[error] {exc}\n")
            log_handle.flush()
        print(f"[job:{record.job_id}] error: {exc}", file=sys.stderr, flush=True)
        record.error_message = str(exc)
        record.status = "failed"
        record.finished_at = datetime.utcnow()
        record.artifacts = scan_artifacts(job_id=record.job_id, job_dir=record.job_dir)
        manifest = build_manifest(
            job_id=record.job_id,
            status="failed",
            request_payload=record.request_payload,
            created_at=record.created_at,
            started_at=record.started_at,
            finished_at=record.finished_at,
            artifacts=record.artifacts,
            pipeline_result=record.pipeline_result,
            error_message=record.error_message,
        )
        write_manifest(record.job_dir, manifest)
        record.artifacts = scan_artifacts(job_id=record.job_id, job_dir=record.job_dir)
        _persist_job_record(record)


def _persist_job_record(record: JobRecord) -> None:
    state_path = record.job_dir / settings.job_state_name
    payload = {
        "job_id": record.job_id,
        "request_payload": record.request_payload,
        "job_dir": str(record.job_dir),
        "log_path": str(record.log_path),
        "status": record.status,
        "created_at": record.created_at.isoformat(),
        "started_at": record.started_at.isoformat() if record.started_at else None,
        "finished_at": record.finished_at.isoformat() if record.finished_at else None,
        "error_message": record.error_message,
        "artifacts": [artifact.model_dump() for artifact in record.artifacts],
        "pipeline_result": record.pipeline_result,
        "bundle_path": str(record.bundle_path) if record.bundle_path else None,
    }
    state_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _load_job_from_disk(job_id: str) -> JobRecord | None:
    state_path = settings.jobs_dir / job_id / settings.job_state_name
    if not state_path.is_file():
        return None

    payload = json.loads(state_path.read_text(encoding="utf-8"))
    artifacts = [ArtifactInfo.model_validate(item) for item in payload.get("artifacts", [])]
    return JobRecord(
        job_id=payload["job_id"],
        request_payload=payload["request_payload"],
        job_dir=Path(payload["job_dir"]),
        log_path=Path(payload["log_path"]),
        status=payload["status"],
        created_at=datetime.fromisoformat(payload["created_at"]),
        started_at=datetime.fromisoformat(payload["started_at"]) if payload.get("started_at") else None,
        finished_at=datetime.fromisoformat(payload["finished_at"]) if payload.get("finished_at") else None,
        error_message=payload.get("error_message"),
        artifacts=artifacts,
        pipeline_result=payload.get("pipeline_result"),
        bundle_path=Path(payload["bundle_path"]) if payload.get("bundle_path") else None,
    )
