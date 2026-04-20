from __future__ import annotations

import json
import shutil
import sys
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from ..config import settings
from ..schemas import (
    ArtifactInfo,
    CreateJobRequest,
    JobListItem,
    JobResponse,
    JobStatus,
    ResumeJobRequest,
)
from .artifact_service import scan_artifacts
from .bundle_service import build_manifest, create_bundle, write_manifest
from .image_edit_service import run_image_edit
from .pipeline_service import run_pipeline
from ..pipeline.autofigure2 import PipelineStageError


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
    current_stage: int = 1
    last_success_stage: int = 0
    failed_stage: int | None = None
    source_job_id: str | None = None
    resume_from_stage: int | None = None
    resume_count: int = 0


_LOCK = threading.RLock()
_JOBS: dict[str, JobRecord] = {}
_EXECUTOR = ThreadPoolExecutor(max_workers=settings.max_concurrent_jobs)


def _to_json_safe(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {key: _to_json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_to_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_to_json_safe(item) for item in value]
    return value


def _resolve_job_root_dir(job_type: str) -> Path:
    if job_type == "image-edit":
        return settings.edits_dir
    return settings.jobs_dir


def _iter_job_root_dirs() -> tuple[Path, ...]:
    return (settings.jobs_dir, settings.edits_dir)


def create_job(request: CreateJobRequest, *, autostart: bool = True) -> JobRecord:
    now = datetime.utcnow()
    job_id = f"{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    job_dir = _resolve_job_root_dir(request.job_type) / job_id
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
        current_stage=request.start_stage,
        last_success_stage=max(0, request.start_stage - 1),
        source_job_id=request.source_job_id,
        resume_from_stage=request.resume_from_stage,
    )
    with _LOCK:
        _JOBS[job_id] = record
        _persist_job_record(record)

    if autostart:
        _EXECUTOR.submit(_run_job, job_id)
    return record


def create_resume_job(job_id: str, request: ResumeJobRequest) -> JobRecord:
    source_record = get_job(job_id)
    if source_record is None:
        raise FileNotFoundError(f"Job not found: {job_id}")

    if source_record.request_payload.get("job_type") != "autodraw":
        raise ValueError("Only autodraw jobs can be resumed")

    if source_record.status != "failed":
        raise ValueError("Only failed jobs can be resumed")

    inferred_stage = _infer_resume_stage_from_artifacts(source_record.job_dir)
    failed_stage = max(source_record.failed_stage or 1, inferred_stage)
    resume_from_stage = failed_stage if request.resume_from_stage == "auto" else int(request.resume_from_stage)
    if resume_from_stage < 1 or resume_from_stage > 5:
        raise ValueError("resume_from_stage must be between 1 and 5")

    payload = dict(source_record.request_payload)
    payload["start_stage"] = resume_from_stage
    payload["source_job_id"] = source_record.job_id
    payload["resume_from_stage"] = resume_from_stage
    if request.image_model is not None:
        payload["image_model"] = request.image_model
    if request.svg_model is not None:
        payload["svg_model"] = request.svg_model
    resume_request = CreateJobRequest.model_validate(payload)
    record = create_job(resume_request, autostart=False)
    record.resume_count = source_record.resume_count + 1
    record.source_job_id = source_record.job_id
    record.resume_from_stage = resume_from_stage
    record.current_stage = resume_from_stage
    record.last_success_stage = max(0, resume_from_stage - 1)
    _copy_resume_artifacts(source_record.job_dir, record.job_dir, resume_from_stage)
    _persist_job_record(record)
    _EXECUTOR.submit(_run_job, record.job_id)
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
        current_stage=record.current_stage,
        last_success_stage=record.last_success_stage,
        failed_stage=record.failed_stage,
        source_job_id=record.source_job_id,
        resume_from_stage=record.resume_from_stage,
        resume_count=record.resume_count,
    )


def list_job_items(*, limit: int = 20, offset: int = 0) -> list[JobListItem]:
    safe_offset = max(0, offset)
    safe_limit = max(1, min(limit, 50))

    job_ids: list[str] = []
    for root_dir in _iter_job_root_dirs():
        try:
            for entry in root_dir.iterdir():
                if entry.is_dir():
                    job_ids.append(entry.name)
        except FileNotFoundError:
            continue

    records: list[JobRecord] = []
    for job_id in job_ids:
        record = get_job(job_id)
        if record is None:
            continue
        records.append(record)

    records.sort(key=lambda item: item.created_at, reverse=True)
    sliced = records[safe_offset : safe_offset + safe_limit]

    items: list[JobListItem] = []
    for record in sliced:
        bundle_url = (
            f"/api/jobs/{record.job_id}/bundle"
            if record.bundle_path and record.bundle_path.is_file()
            else None
        )
        items.append(
            JobListItem(
                job_id=record.job_id,
                job_type=(record.request_payload.get("job_type") or "autodraw"),
                status=record.status,
                created_at=record.created_at,
                started_at=record.started_at,
                finished_at=record.finished_at,
                error_message=record.error_message,
                artifacts=record.artifacts,
                bundle_url=bundle_url,
                current_stage=record.current_stage,
                failed_stage=record.failed_stage,
            )
        )
    return items


def _run_job(job_id: str) -> None:
    record = get_job(job_id)
    if record is None:
        return

    record.status = "running"
    record.started_at = datetime.utcnow()
    _persist_job_record(record)

    try:
        request = CreateJobRequest.model_validate(record.request_payload)
        if request.job_type == "image-edit":
            result = run_image_edit(
                request=request,
                output_dir=record.job_dir,
                log_path=record.log_path,
            )
            record.current_stage = 1
            record.last_success_stage = 1
        else:
            result = run_pipeline(
                request=request, output_dir=record.job_dir, log_path=record.log_path
            )
            record.current_stage = 5
            record.last_success_stage = 5
        record.pipeline_result = _to_json_safe(result)
        record.failed_stage = None
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
        if isinstance(exc, PipelineStageError):
            record.failed_stage = exc.stage
            record.current_stage = exc.stage
            record.last_success_stage = max(0, exc.stage - 1)
        else:
            inferred_stage = _infer_resume_stage_from_artifacts(record.job_dir)
            record.failed_stage = inferred_stage
            record.current_stage = inferred_stage
            record.last_success_stage = max(0, inferred_stage - 1)
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
        record.bundle_path = create_bundle(record.job_dir)
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
        "current_stage": record.current_stage,
        "last_success_stage": record.last_success_stage,
        "failed_stage": record.failed_stage,
        "source_job_id": record.source_job_id,
        "resume_from_stage": record.resume_from_stage,
        "resume_count": record.resume_count,
    }
    state_path.write_text(
        json.dumps(_to_json_safe(payload), ensure_ascii=False, indent=2, default=str) + "\n",
        encoding="utf-8",
    )


def _load_job_from_disk(job_id: str) -> JobRecord | None:
    state_path: Path | None = None
    for root_dir in _iter_job_root_dirs():
        candidate = root_dir / job_id / settings.job_state_name
        if candidate.is_file():
            state_path = candidate
            break
    if state_path is None:
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
        current_stage=payload.get("current_stage", 1),
        last_success_stage=payload.get("last_success_stage", 0),
        failed_stage=payload.get("failed_stage"),
        source_job_id=payload.get("source_job_id"),
        resume_from_stage=payload.get("resume_from_stage"),
        resume_count=payload.get("resume_count", 0),
    )


def _copy_resume_artifacts(source_dir: Path, target_dir: Path, start_stage: int) -> None:
    def copy_file(name: str) -> None:
        source = source_dir / name
        target = target_dir / name
        if source.is_file():
            shutil.copy2(source, target)

    if start_stage > 1:
        copy_file("figure.png")
    if start_stage > 2:
        copy_file("samed.png")
        copy_file("boxlib.json")
    if start_stage > 3:
        source_icons = source_dir / "icons"
        target_icons = target_dir / "icons"
        if source_icons.is_dir():
            shutil.copytree(source_icons, target_icons, dirs_exist_ok=True)
    if start_stage > 4:
        copy_file("template.svg")
        copy_file("optimized_template.svg")


def _infer_resume_stage_from_artifacts(job_dir: Path) -> int:
    if (job_dir / "final.svg").is_file():
        return 5
    if (job_dir / "optimized_template.svg").is_file() or (job_dir / "template.svg").is_file():
        return 5
    if (job_dir / "icons").is_dir() and any((job_dir / "icons").iterdir()):
        return 4
    if (job_dir / "boxlib.json").is_file() and (job_dir / "samed.png").is_file():
        return 3
    if (job_dir / "figure.png").is_file():
        return 2
    return 1
