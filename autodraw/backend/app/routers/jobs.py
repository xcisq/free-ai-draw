from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..schemas import CreateJobRequest, CreateJobResponse, JobResponse
from ..services.job_runner import create_job, get_job, get_job_response

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("", response_model=CreateJobResponse)
def submit_job(request: CreateJobRequest) -> CreateJobResponse:
    record = create_job(request)
    return CreateJobResponse(job_id=record.job_id, status=record.status)


@router.get("/{job_id}", response_model=JobResponse)
def fetch_job(job_id: str) -> JobResponse:
    response = get_job_response(job_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return response


@router.get("/{job_id}/bundle")
def download_bundle(job_id: str) -> FileResponse:
    record = get_job(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if record.status != "succeeded":
        raise HTTPException(status_code=409, detail="Job is not finished successfully")
    if record.bundle_path is None or not record.bundle_path.is_file():
        raise HTTPException(status_code=404, detail="Bundle not found")
    return FileResponse(record.bundle_path, filename=f"{job_id}.zip")


@router.get("/{job_id}/artifacts/{artifact_path:path}")
def download_artifact(job_id: str, artifact_path: str) -> FileResponse:
    record = get_job(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate = (record.job_dir / artifact_path).resolve()
    if not str(candidate).startswith(str(record.job_dir.resolve())):
        raise HTTPException(status_code=400, detail="Invalid artifact path")
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return FileResponse(candidate, filename=Path(artifact_path).name)
