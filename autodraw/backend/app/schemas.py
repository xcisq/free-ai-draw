from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


Provider = Literal["openrouter", "bianxie", "qingyun", "gemini"]
SamBackend = Literal["local", "fal", "roboflow", "api"]
PlaceholderMode = Literal["none", "box", "label"]
ImageSize = Literal["1K", "2K", "4K"]
JobStatus = Literal["queued", "running", "succeeded", "failed"]


class CreateJobRequest(BaseModel):
    method_text: str = Field(..., min_length=1)
    provider: Provider = "bianxie"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    image_model: Optional[str] = None
    image_size: ImageSize = "4K"
    svg_model: Optional[str] = None
    sam_prompt: str = "icon,person,robot,animal"
    min_score: float = 0.0
    sam_backend: SamBackend = "local"
    sam_api_url: Optional[str] = None
    sam_api_key: Optional[str] = None
    sam_max_masks: int = Field(32, ge=1)
    rmbg_model_path: Optional[str] = None
    stop_after: int = Field(5, ge=1, le=5)
    placeholder_mode: PlaceholderMode = "label"
    optimize_iterations: int = Field(0, ge=0)
    merge_threshold: float = 0.001
    reference_image_path: Optional[str] = None


class ArtifactInfo(BaseModel):
    name: str
    path: str
    kind: str
    size_bytes: int
    download_url: str


class CreateJobResponse(BaseModel):
    job_id: str
    status: JobStatus


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
