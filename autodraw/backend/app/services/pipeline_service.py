from __future__ import annotations

import json
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any, Callable

from PIL import Image

from ..config import settings
from ..pipeline import autofigure2
from ..schemas import CreateJobRequest


class TeeStream:
    def __init__(self, *streams: Any) -> None:
        self._streams = streams

    def write(self, data: str) -> int:
        for stream in self._streams:
            stream.write(data)
            stream.flush()
        return len(data)

    def flush(self) -> None:
        for stream in self._streams:
            stream.flush()

    def isatty(self) -> bool:
        return False


def run_pipeline(
    request: CreateJobRequest,
    output_dir: Path,
    log_path: Path,
    cancellation_check: Callable[[int, str], None] | None = None,
) -> dict[str, Any]:
    resolved_reference_path = _resolve_reference_path(request.reference_image_path)
    resolved_source_figure_path = _resolve_source_figure_path(
        request.source_figure_path
    )
    resolved_sam_api_url = _resolve_sam_api_url(request.sam_api_url)
    output_dir.mkdir(parents=True, exist_ok=True)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    with log_path.open("a", encoding="utf-8") as log_handle:
        tee_stdout = TeeStream(sys.__stdout__, log_handle)
        tee_stderr = TeeStream(sys.__stderr__, log_handle)
        with redirect_stdout(tee_stdout), redirect_stderr(tee_stderr):
            print(f"[meta] output_dir={output_dir}")
            print(f"[meta] provider={request.provider}")
            print(f"[meta] start_stage={request.start_stage}")
            if resolved_reference_path:
                print(f"[meta] reference_image_path={resolved_reference_path}")
            if resolved_source_figure_path:
                print(f"[meta] source_figure_path={resolved_source_figure_path}")
                print(f"[meta] source_processing_mode={request.source_processing_mode}")
            if resolved_sam_api_url:
                print(f"[meta] sam_api_url={resolved_sam_api_url}")
            if resolved_source_figure_path:
                prepared_figure_path = output_dir / "figure.png"
                _prepare_source_figure(
                    source_figure_path=resolved_source_figure_path,
                    output_path=prepared_figure_path,
                )
                print(f"[meta] prepared_source_figure={prepared_figure_path}")
                if request.source_processing_mode == "direct_svg":
                    prepared_samed_path = output_dir / "samed.png"
                    prepared_boxlib_path = output_dir / "boxlib.json"
                    _prepare_direct_svg_context(
                        figure_path=prepared_figure_path,
                        samed_path=prepared_samed_path,
                        boxlib_path=prepared_boxlib_path,
                        sam_prompt=request.sam_prompt,
                    )
                    print(f"[meta] prepared_direct_svg_samed={prepared_samed_path}")
                    print(f"[meta] prepared_direct_svg_boxlib={prepared_boxlib_path}")

            previous_use_reference_image = autofigure2.USE_REFERENCE_IMAGE
            previous_reference_image_path = autofigure2.REFERENCE_IMAGE_PATH
            previous_sam3_fal_api_url = autofigure2.SAM3_FAL_API_URL
            try:
                autofigure2.USE_REFERENCE_IMAGE = bool(resolved_reference_path)
                autofigure2.REFERENCE_IMAGE_PATH = resolved_reference_path
                if resolved_sam_api_url:
                    autofigure2.SAM3_FAL_API_URL = resolved_sam_api_url
                result = autofigure2.method_to_svg(
                    method_text=request.method_text,
                    output_dir=str(output_dir),
                    api_key=request.api_key,
                    base_url=request.base_url,
                    provider=request.provider,
                    image_gen_model=request.image_model,
                    svg_gen_model=request.svg_model,
                    sam_prompts=request.sam_prompt,
                    min_score=request.min_score,
                    sam_backend=request.sam_backend,
                    sam_api_key=request.sam_api_key,
                    sam_max_masks=request.sam_max_masks,
                    rmbg_model_path=request.rmbg_model_path,
                    stop_after=request.stop_after,
                    placeholder_mode=request.placeholder_mode,
                    optimize_iterations=request.optimize_iterations,
                    merge_threshold=request.merge_threshold,
                    image_size=request.image_size,
                    start_stage=request.start_stage,
                    cancellation_check=cancellation_check,
                )
                return result
            finally:
                autofigure2.USE_REFERENCE_IMAGE = previous_use_reference_image
                autofigure2.REFERENCE_IMAGE_PATH = previous_reference_image_path
                autofigure2.SAM3_FAL_API_URL = previous_sam3_fal_api_url


def _resolve_reference_path(reference_image_path: str | None) -> str | None:
    if not reference_image_path:
        return None

    path = Path(reference_image_path).expanduser()
    if not path.is_absolute():
        path = (settings.repo_root / path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Reference image not found: {path}")
    return str(path)


def _resolve_source_figure_path(source_figure_path: str | None) -> str | None:
    if not source_figure_path:
        return None

    path = Path(source_figure_path).expanduser()
    if not path.is_absolute():
        path = (settings.repo_root / path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Source figure not found: {path}")
    return str(path)


def _prepare_source_figure(*, source_figure_path: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source_figure_path) as image:
        image.save(output_path, format="PNG")


def _prepare_direct_svg_context(
    *,
    figure_path: Path,
    samed_path: Path,
    boxlib_path: Path,
    sam_prompt: str,
) -> None:
    samed_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(figure_path) as image:
        image.save(samed_path, format="PNG")
        width, height = image.size

    boxlib_payload = {
        "image_size": {"width": width, "height": height},
        "prompts_used": [
            item.strip() for item in sam_prompt.split(",") if item.strip()
        ],
        "boxes": [],
        autofigure2.BOXLIB_NO_ICON_MODE_KEY: True,
    }
    boxlib_path.write_text(
        json.dumps(boxlib_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _resolve_sam_api_url(sam_api_url: str | None) -> str | None:
    if not sam_api_url:
        return None
    return sam_api_url.strip().rstrip("/")
