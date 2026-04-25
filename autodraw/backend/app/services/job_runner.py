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
    ReplayJobRequest,
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
    preview_artifact_path: str | None = None
    artifact_count: int = 0
    current_stage: int = 1
    last_success_stage: int = 0
    failed_stage: int | None = None
    source_job_id: str | None = None
    resume_from_stage: int | None = None
    resume_count: int = 0


_LOCK = threading.RLock()
_JOBS: dict[str, JobRecord] = {}
_CANCEL_EVENTS: dict[str, threading.Event] = {}
_EXECUTOR = ThreadPoolExecutor(max_workers=settings.max_concurrent_jobs)

_PREVIEWABLE_ARTIFACT_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".svg")


class JobCancelledError(RuntimeError):
    def __init__(self, message: str = "Job cancelled by user", *, stage: int | None = None) -> None:
        super().__init__(message)
        self.stage = stage


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


def _get_cancel_event(job_id: str) -> threading.Event:
    with _LOCK:
        event = _CANCEL_EVENTS.get(job_id)
        if event is None:
            event = threading.Event()
            _CANCEL_EVENTS[job_id] = event
        return event


def _clear_cancel_event(job_id: str) -> None:
    with _LOCK:
        _CANCEL_EVENTS.pop(job_id, None)


def _append_job_log(record: JobRecord, message: str) -> None:
    with record.log_path.open("a", encoding="utf-8") as log_handle:
        log_handle.write(f"{message}\n")
        log_handle.flush()


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
    _get_cancel_event(job_id)

    if autostart:
        _EXECUTOR.submit(_run_job, job_id)
    return record


def create_resume_job(job_id: str, request: ResumeJobRequest) -> JobRecord:
    source_record = get_job(job_id)
    if source_record is None:
        raise FileNotFoundError(f"Job not found: {job_id}")

    if source_record.request_payload.get("job_type") != "autodraw":
        raise ValueError("Only autodraw jobs can be resumed")

    if source_record.status not in {"failed", "cancelled"}:
        raise ValueError("Only failed or cancelled jobs can be resumed")

    resume_from_stage = (
        _resolve_auto_resume_stage(source_record)
        if request.resume_from_stage == "auto"
        else int(request.resume_from_stage)
    )
    return _spawn_replay_job(
        source_record,
        start_stage=resume_from_stage,
        image_model=request.image_model,
        svg_model=request.svg_model,
        remove_background=request.remove_background,
    )


def create_replay_job(job_id: str, request: ReplayJobRequest) -> JobRecord:
    source_record = get_job(job_id)
    if source_record is None:
        raise FileNotFoundError(f"Job not found: {job_id}")

    if source_record.request_payload.get("job_type") != "autodraw":
        raise ValueError("Only autodraw jobs can be replayed")

    if source_record.status not in {"succeeded", "failed", "cancelled"}:
        raise ValueError("Only finished autodraw jobs can be replayed")

    return _spawn_replay_job(
        source_record,
        start_stage=int(request.start_stage),
        image_model=request.image_model,
        svg_model=request.svg_model,
        remove_background=request.remove_background,
    )


def get_job(job_id: str) -> JobRecord | None:
    with _LOCK:
        record = _JOBS.get(job_id)
    if record is not None:
        return record
    record = _load_job_from_disk(job_id)
    if record is not None:
        with _LOCK:
            _JOBS[job_id] = record
    return record


def get_job_response(job_id: str) -> JobResponse | None:
    record = get_job(job_id)
    if record is None:
        return None

    artifacts = _get_live_artifacts(record)
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
        artifacts=artifacts,
        bundle_url=bundle_url,
        manifest_url=manifest_url,
        request=record.request_payload,
        current_stage=record.current_stage,
        last_success_stage=record.last_success_stage,
        failed_stage=record.failed_stage,
        source_job_id=record.source_job_id,
        resume_from_stage=record.resume_from_stage,
        resume_count=record.resume_count,
        min_start_stage=_get_min_start_stage(record.request_payload),
    )


def cancel_job(job_id: str) -> JobRecord:
    record = get_job(job_id)
    if record is None:
        raise FileNotFoundError(f"Job not found: {job_id}")

    if record.status in {"succeeded", "failed", "cancelled"}:
        raise ValueError("Only queued or running jobs can be cancelled")

    cancel_event = _get_cancel_event(job_id)
    cancel_event.set()

    if record.status == "queued":
        _append_job_log(record, "[cancel] requested by user before execution")
        _mark_job_cancelled(
            record,
            stage=record.current_stage,
            message="Job cancelled by user",
        )
        return record

    if record.status != "cancelling":
        record.status = "cancelling"
        record.error_message = "Job cancellation requested"
        _append_job_log(record, "[cancel] requested by user")
        _persist_job_record(record)
    return record


def list_job_items(*, limit: int = 20, offset: int = 0) -> list[JobListItem]:
    safe_offset = max(0, offset)
    safe_limit = max(1, min(limit, 50))

    job_ids: list[str] = []
    for root_dir in _iter_job_root_dirs():
        try:
            for entry in root_dir.iterdir():
                if entry.is_dir() and (entry / settings.job_state_name).is_file():
                    job_ids.append(entry.name)
        except FileNotFoundError:
            continue

    job_ids.sort(reverse=True)
    sliced_job_ids = job_ids[safe_offset : safe_offset + safe_limit]

    records: list[JobRecord] = []
    for job_id in sliced_job_ids:
        record = get_job(job_id)
        if record is None:
            continue
        records.append(record)

    records.sort(key=lambda item: item.created_at, reverse=True)

    items: list[JobListItem] = []
    for record in records:
        bundle_url = (
            f"/api/jobs/{record.job_id}/bundle"
            if record.bundle_path and record.bundle_path.is_file()
            else None
        )
        preview_url = (
            f"/api/jobs/{record.job_id}/artifacts/{record.preview_artifact_path}"
            if record.preview_artifact_path
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
                bundle_url=bundle_url,
                preview_url=preview_url,
                artifact_count=record.artifact_count or len(record.artifacts),
                current_stage=record.current_stage,
                failed_stage=record.failed_stage,
                min_start_stage=_get_min_start_stage(record.request_payload),
            )
        )
    return items


def _get_live_artifacts(record: JobRecord) -> list[ArtifactInfo]:
    if record.status not in {"queued", "running", "cancelling"}:
        return record.artifacts
    return scan_artifacts(job_id=record.job_id, job_dir=record.job_dir)


def _get_artifact_stage_index(artifact: ArtifactInfo) -> int:
    if artifact.kind == "figure":
        return 0
    if artifact.kind in {"samed", "boxlib"}:
        return 1
    if artifact.kind == "icon":
        return 2
    if artifact.kind in {"template_svg", "optimized_template_svg", "final_svg"}:
        return 3
    return 4


def _get_artifact_priority(artifact: ArtifactInfo) -> int:
    if artifact.kind == "figure":
        return 0
    if artifact.kind == "final_svg":
        return 1
    if artifact.kind == "optimized_template_svg":
        return 2
    if artifact.kind == "template_svg":
        return 3
    if artifact.kind == "icon":
        return 4
    if artifact.kind == "scene_json":
        return 5
    if artifact.kind == "boxlib":
        return 6
    if artifact.kind == "manifest":
        return 7
    if artifact.kind == "log":
        return 8
    return 9


def _refresh_record_artifact_summary(record: JobRecord) -> None:
    record.artifact_count = len(record.artifacts)
    previewable_artifacts = [
        artifact
        for artifact in record.artifacts
        if artifact.name.lower().endswith(_PREVIEWABLE_ARTIFACT_EXTENSIONS)
    ]
    if not previewable_artifacts:
        record.preview_artifact_path = None
        return

    if record.status in {"failed", "cancelled"}:
        figure_artifact = next(
            (artifact for artifact in previewable_artifacts if artifact.kind == "figure"),
            None,
        )
        if figure_artifact is not None:
            record.preview_artifact_path = figure_artifact.path
            return

    previewable_artifacts.sort(
        key=lambda artifact: (
            -_get_artifact_stage_index(artifact),
            _get_artifact_priority(artifact),
            artifact.name.lower(),
        )
    )
    record.preview_artifact_path = previewable_artifacts[0].path


def _advance_job_stage(record: JobRecord, stage: int) -> None:
    normalized_stage = max(1, min(5, stage))
    record.current_stage = normalized_stage
    record.last_success_stage = max(record.last_success_stage, normalized_stage - 1)
    _persist_job_record(record)


def _raise_if_job_cancelled(record: JobRecord, *, stage: int, label: str) -> None:
    if _get_cancel_event(record.job_id).is_set():
        raise JobCancelledError(
            f"Job cancelled by user before {label}",
            stage=stage,
        )


def _build_pipeline_cancellation_check(record: JobRecord):
    def check(stage: int, label: str) -> None:
        _advance_job_stage(record, stage)
        _raise_if_job_cancelled(record, stage=stage, label=label)

    return check


def _mark_job_cancelled(
    record: JobRecord,
    *,
    stage: int | None = None,
    message: str = "Job cancelled by user",
) -> None:
    if stage is not None:
        normalized_stage = max(1, min(5, stage))
        record.current_stage = normalized_stage
        record.failed_stage = normalized_stage
        record.last_success_stage = max(record.last_success_stage, normalized_stage - 1)
    else:
        record.current_stage = max(1, record.current_stage)
        record.failed_stage = record.failed_stage or record.current_stage
        record.last_success_stage = max(record.last_success_stage, record.current_stage - 1)

    record.status = "cancelled"
    record.error_message = message
    record.finished_at = datetime.utcnow()
    record.artifacts = scan_artifacts(job_id=record.job_id, job_dir=record.job_dir)
    manifest = build_manifest(
        job_id=record.job_id,
        status="cancelled",
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
    _refresh_record_artifact_summary(record)
    record.bundle_path = None
    _persist_job_record(record)
    _clear_cancel_event(record.job_id)


def _run_job(job_id: str) -> None:
    record = get_job(job_id)
    if record is None:
        return

    if record.status == "cancelled":
        _clear_cancel_event(job_id)
        return

    record.status = "running"
    record.started_at = datetime.utcnow()
    _persist_job_record(record)

    try:
        request = CreateJobRequest.model_validate(record.request_payload)
        if request.job_type == "image-edit":
            _advance_job_stage(record, 1)
            _raise_if_job_cancelled(record, stage=1, label="image edit")
            result = run_image_edit(
                request=request,
                output_dir=record.job_dir,
                log_path=record.log_path,
            )
            record.current_stage = 1
            record.last_success_stage = 1
        else:
            pipeline_cancellation_check = _build_pipeline_cancellation_check(record)
            result = run_pipeline(
                request=request,
                output_dir=record.job_dir,
                log_path=record.log_path,
                cancellation_check=pipeline_cancellation_check,
            )
            record.current_stage = 5
            record.last_success_stage = 5
        _raise_if_job_cancelled(
            record,
            stage=record.current_stage,
            label=f"stage {record.current_stage} finalization",
        )
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
        _refresh_record_artifact_summary(record)
        record.bundle_path = create_bundle(record.job_dir)
        record.status = "succeeded"
        record.finished_at = datetime.utcnow()
        _persist_job_record(record)
        _clear_cancel_event(record.job_id)
    except JobCancelledError as exc:
        _append_job_log(record, f"[cancel] {exc}")
        _mark_job_cancelled(
            record,
            stage=exc.stage or record.current_stage,
            message="Job cancelled by user",
        )
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
        _refresh_record_artifact_summary(record)
        record.bundle_path = create_bundle(record.job_dir)
        _persist_job_record(record)
        _clear_cancel_event(record.job_id)


def _persist_job_record(record: JobRecord) -> None:
    _refresh_record_artifact_summary(record)
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
        "preview_artifact_path": record.preview_artifact_path,
        "artifact_count": record.artifact_count,
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
    record = JobRecord(
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
        preview_artifact_path=payload.get("preview_artifact_path"),
        artifact_count=payload.get("artifact_count", len(artifacts)),
        current_stage=payload.get("current_stage", 1),
        last_success_stage=payload.get("last_success_stage", 0),
        failed_stage=payload.get("failed_stage"),
        source_job_id=payload.get("source_job_id"),
        resume_from_stage=payload.get("resume_from_stage"),
        resume_count=payload.get("resume_count", 0),
    )
    if record.preview_artifact_path is None:
        _refresh_record_artifact_summary(record)
    return record


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


def _is_direct_svg_source_payload(request_payload: dict[str, Any]) -> bool:
    return request_payload.get("source_processing_mode") == "direct_svg"


def _get_min_start_stage(request_payload: dict[str, Any]) -> int:
    source_figure_path = request_payload.get("source_figure_path")
    if isinstance(source_figure_path, str) and source_figure_path.strip():
        if _is_direct_svg_source_payload(request_payload):
            return 4
        return 2
    return 1


def _uses_no_icon_mode(source_dir: Path) -> bool:
    boxlib_path = source_dir / "boxlib.json"
    if not boxlib_path.is_file():
        return False
    try:
        payload = json.loads(boxlib_path.read_text(encoding="utf-8"))
    except Exception:
        return False
    if payload.get("no_icon_mode") is True:
        return True
    boxes = payload.get("boxes")
    return isinstance(boxes, list) and len(boxes) == 0


def _validate_replay_source(source_record: JobRecord, start_stage: int) -> None:
    if start_stage < 1 or start_stage > 5:
        raise ValueError("start_stage must be between 1 and 5")

    min_start_stage = _get_min_start_stage(source_record.request_payload)
    if start_stage < min_start_stage:
        raise ValueError(
            f"start_stage must be at least {min_start_stage} for this job"
        )

    source_dir = source_record.job_dir

    if start_stage > 1 and not (source_dir / "figure.png").is_file():
        raise ValueError("Cannot replay from stage 2+: missing figure.png")

    if start_stage > 2:
        missing_files = [
            name
            for name in ("samed.png", "boxlib.json")
            if not (source_dir / name).is_file()
        ]
        if missing_files:
            raise ValueError(
                f"Cannot replay from stage 3+: missing {', '.join(missing_files)}"
            )

    if start_stage > 3 and not _uses_no_icon_mode(source_dir):
        icons_dir = source_dir / "icons"
        if not icons_dir.is_dir() or not any(path.is_file() for path in icons_dir.iterdir()):
            raise ValueError("Cannot replay from stage 4+: missing icons directory")

    if start_stage > 4 and not (
        (source_dir / "template.svg").is_file()
        or (source_dir / "optimized_template.svg").is_file()
    ):
        raise ValueError(
            "Cannot replay from stage 5: missing template.svg or optimized_template.svg"
        )


def _spawn_replay_job(
    source_record: JobRecord,
    *,
    start_stage: int,
    image_model: str | None = None,
    svg_model: str | None = None,
    remove_background: bool | None = None,
) -> JobRecord:
    _validate_replay_source(source_record, start_stage)

    payload = dict(source_record.request_payload)
    payload["start_stage"] = start_stage
    payload["source_job_id"] = source_record.job_id
    payload["resume_from_stage"] = start_stage
    if image_model is not None:
        payload["image_model"] = image_model
    if svg_model is not None:
        payload["svg_model"] = svg_model
    if remove_background is not None:
        payload["remove_background"] = remove_background

    replay_request = CreateJobRequest.model_validate(payload)
    record = create_job(replay_request, autostart=False)
    record.resume_count = source_record.resume_count + 1
    record.source_job_id = source_record.job_id
    record.resume_from_stage = start_stage
    record.current_stage = start_stage
    record.last_success_stage = max(0, start_stage - 1)
    _copy_resume_artifacts(source_record.job_dir, record.job_dir, start_stage)
    _persist_job_record(record)
    _EXECUTOR.submit(_run_job, record.job_id)
    return record


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


def _resolve_auto_resume_stage(record: JobRecord) -> int:
    if record.failed_stage is not None:
        return record.failed_stage
    return _infer_resume_stage_from_artifacts(record.job_dir)
