from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..config import settings
from ..schemas import UploadReferenceImageResponse

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


async def _save_uploaded_image(
    *,
    file: UploadFile,
    upload_prefix: str,
    error_label: str,
) -> UploadReferenceImageResponse:
    original_name = file.filename or "reference-image"
    extension = Path(original_name).suffix.lower()
    if extension not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported {error_label} format")

    upload_id = f"{upload_prefix}_{uuid.uuid4().hex[:12]}"
    target_path = settings.uploads_dir / f"{upload_id}{extension}"
    size_bytes = 0

    try:
        with target_path.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size_bytes += len(chunk)
                output.write(chunk)
    finally:
        await file.close()

    return UploadReferenceImageResponse(
        upload_id=upload_id,
        file_name=original_name,
        stored_path=str(target_path),
        content_type=file.content_type,
        size_bytes=size_bytes,
    )


@router.post("/reference-image", response_model=UploadReferenceImageResponse)
async def upload_reference_image(
    file: UploadFile = File(...)
) -> UploadReferenceImageResponse:
    return await _save_uploaded_image(
        file=file,
        upload_prefix="ref",
        error_label="reference image",
    )


@router.post("/image-edit-source", response_model=UploadReferenceImageResponse)
async def upload_image_edit_source(
    file: UploadFile = File(...)
) -> UploadReferenceImageResponse:
    return await _save_uploaded_image(
        file=file,
        upload_prefix="edit",
        error_label="image edit source",
    )
