from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

from ..config import settings
from ..schemas import ArtifactInfo


def build_manifest(
    *,
    job_id: str,
    status: str,
    request_payload: dict[str, Any],
    created_at: datetime,
    started_at: datetime | None,
    finished_at: datetime | None,
    artifacts: list[ArtifactInfo],
    pipeline_result: dict[str, Any] | None,
    error_message: str | None,
) -> dict[str, Any]:
    return {
        "job_id": job_id,
        "status": status,
        "request": request_payload,
        "artifacts": [artifact.model_dump() for artifact in artifacts],
        "result": pipeline_result or {},
        "timing": {
            "created_at": created_at.isoformat(),
            "started_at": started_at.isoformat() if started_at else None,
            "finished_at": finished_at.isoformat() if finished_at else None,
        },
        "error_message": error_message,
    }


def write_manifest(job_dir: Path, manifest: dict[str, Any]) -> Path:
    manifest_path = job_dir / settings.manifest_name
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest_path


def create_bundle(job_dir: Path) -> Path:
    bundle_path = job_dir / settings.bundle_name
    with ZipFile(bundle_path, mode="w", compression=ZIP_DEFLATED) as archive:
        for path in sorted(p for p in job_dir.rglob("*") if p.is_file()):
            rel_path = path.relative_to(job_dir).as_posix()
            if rel_path == settings.bundle_name:
                continue
            archive.write(path, rel_path)
    return bundle_path
