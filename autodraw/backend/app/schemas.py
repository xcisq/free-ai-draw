from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


Provider = Literal["openrouter", "bianxie", "qingyun", "gemini", "local"]
SamBackend = Literal["local", "fal", "roboflow", "api"]
PlaceholderMode = Literal["none", "box", "label"]
ImageSize = Literal["1K", "2K", "4K"]
JobStatus = Literal["queued", "running", "succeeded", "failed"]
ResumeStage = Literal["auto", 1, 2, 3, 4, 5]


class CreateJobRequest(BaseModel):
    method_text: str = Field(..., min_length=1)
    provider: Provider = "bianxie"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    image_model: Optional[str] = None
    image_size: ImageSize = "4K"
    svg_model: Optional[str] = None
    sam_prompt: str = "icon,person,robot,animal,arrow"
    min_score: float = 0.0
    sam_backend: SamBackend = "api"
    sam_api_url: Optional[str] = None
    sam_api_key: Optional[str] = None
    sam_max_masks: int = Field(32, ge=1)
    rmbg_model_path: Optional[str] = None
    stop_after: int = Field(5, ge=1, le=5)
    placeholder_mode: PlaceholderMode = "label"
    optimize_iterations: int = Field(0, ge=0)
    merge_threshold: float = 0.001
    reference_image_path: Optional[str] = None
    start_stage: int = Field(1, ge=1, le=5)
    source_job_id: Optional[str] = None
    resume_from_stage: Optional[int] = Field(None, ge=1, le=5)


class ArtifactInfo(BaseModel):
    name: str
    path: str
    kind: str
    size_bytes: int
    download_url: str


class CreateJobResponse(BaseModel):
    job_id: str
    status: JobStatus


class ResumeJobRequest(BaseModel):
    resume_from_stage: ResumeStage = "auto"
    image_model: Optional[str] = None
    svg_model: Optional[str] = None


class UploadReferenceImageResponse(BaseModel):
    upload_id: str
    file_name: str
    stored_path: str
    content_type: Optional[str] = None
    size_bytes: int


class JobLogChunkResponse(BaseModel):
    job_id: str
    offset: int
    next_offset: int
    completed: bool
    lines: list[str] = Field(default_factory=list)


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None
    artifacts: list[ArtifactInfo] = Field(default_factory=list)
    bundle_url: Optional[str] = None
    manifest_url: Optional[str] = None
    request: dict[str, Any]
    current_stage: int = 1
    last_success_stage: int = 0
    failed_stage: Optional[int] = None
    source_job_id: Optional[str] = None
    resume_from_stage: Optional[int] = None
    resume_count: int = 0


class JobListItem(BaseModel):
    job_id: str
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None
    artifacts: list[ArtifactInfo] = Field(default_factory=list)
    bundle_url: Optional[str] = None
    current_stage: int = 1
    failed_stage: Optional[int] = None
