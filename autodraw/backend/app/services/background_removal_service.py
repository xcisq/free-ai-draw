from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Callable, Literal

import requests
from PIL import Image


LogWriter = Callable[[str], None]
BackgroundRemovalProvider = Literal["local", "remote", "auto"]
DEFAULT_REMOTE_API_URL = "https://api.rembg.com/rmbg"
DEFAULT_REMOTE_FORMAT = "png"
REMOTE_API_TIMEOUT = 300


def _write_log(log: LogWriter | None, message: str) -> None:
    if log:
        log(message)


def resolve_background_removal_provider(
    provider: BackgroundRemovalProvider | str | None,
) -> BackgroundRemovalProvider:
    candidates = [provider, os.environ.get("BACKGROUND_REMOVAL_PROVIDER")]
    for candidate in candidates:
        if not isinstance(candidate, str):
            continue
        normalized = candidate.strip().lower()
        if normalized in {"local", "remote", "auto"}:
            return normalized  # type: ignore[return-value]
    return "local"


def _resolve_remote_api_url(api_url: str | None) -> str:
    value = api_url or os.environ.get("BACKGROUND_REMOVAL_API_URL") or DEFAULT_REMOTE_API_URL
    return value.strip().rstrip("/")


def _resolve_remote_api_key(api_key: str | None) -> str:
    value = api_key or os.environ.get("BACKGROUND_REMOVAL_API_KEY") or os.environ.get("RMBG_API_KEY")
    if not isinstance(value, str) or not value.strip():
        raise RuntimeError(
            "远程去背景缺少 API Key，请配置 BACKGROUND_REMOVAL_API_KEY 或请求中显式传入。"
        )
    return value.strip()


def _resolve_remote_format(image_format: str | None) -> str:
    value = (image_format or os.environ.get("BACKGROUND_REMOVAL_REMOTE_FORMAT") or DEFAULT_REMOTE_FORMAT).strip().lower()
    if value not in {"png", "webp"}:
        raise RuntimeError("远程去背景仅支持输出格式 png 或 webp。")
    return value


def _resolve_remote_form_fields() -> dict[str, str]:
    fields: dict[str, str] = {}
    mappings = {
        "BACKGROUND_REMOVAL_REMOTE_WIDTH": "w",
        "BACKGROUND_REMOVAL_REMOTE_HEIGHT": "h",
        "BACKGROUND_REMOVAL_REMOTE_EXACT_RESIZE": "exact_resize",
        "BACKGROUND_REMOVAL_REMOTE_MASK": "mask",
        "BACKGROUND_REMOVAL_REMOTE_BG_COLOR": "bg_color",
        "BACKGROUND_REMOVAL_REMOTE_ANGLE": "angle",
        "BACKGROUND_REMOVAL_REMOTE_EXPAND": "expand",
    }
    for env_key, form_key in mappings.items():
        value = os.environ.get(env_key)
        if isinstance(value, str) and value.strip():
            fields[form_key] = value.strip()
    return fields


def _remove_background_remote(
    *,
    source_path: Path,
    output_path: Path,
    api_url: str | None = None,
    api_key: str | None = None,
    image_format: str | None = None,
    log: LogWriter | None = None,
) -> Path:
    resolved_url = _resolve_remote_api_url(api_url)
    resolved_api_key = _resolve_remote_api_key(api_key)
    resolved_format = _resolve_remote_format(image_format)
    form_data = {"format": resolved_format, **_resolve_remote_form_fields()}

    _write_log(log, f"[background-removal] provider=remote url={resolved_url}")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with source_path.open("rb") as source_file:
        response = requests.post(
            resolved_url,
            headers={"x-api-key": resolved_api_key},
            files={"image": (source_path.name, source_file, "application/octet-stream")},
            data=form_data,
            timeout=REMOTE_API_TIMEOUT,
        )
    try:
        response.raise_for_status()
    except Exception as exc:
        detail = response.text.strip()
        raise RuntimeError(
            f"远程去背景请求失败: status={response.status_code} detail={detail or 'unknown error'}"
        ) from exc

    output_path.write_bytes(response.content)
    _write_log(log, f"[background-removal] remote_done path={output_path.name}")
    return output_path


def _remove_background_local(
    *,
    source_path: Path,
    output_path: Path,
    rmbg_model_path: str | None = None,
    log: LogWriter | None = None,
) -> Path:
    from ..pipeline.autofigure2 import BriaRMBG2Remover, _ensure_rmbg2_access_ready

    _ensure_rmbg2_access_ready(rmbg_model_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    remover = BriaRMBG2Remover(
        model_path=rmbg_model_path,
        output_dir=output_path.parent,
    )

    _write_log(log, "[background-removal] provider=local")
    try:
        with Image.open(source_path) as image:
            generated_path = Path(remover.remove_background(image, output_path.stem))
        if generated_path.resolve() != output_path.resolve():
            shutil.move(str(generated_path), output_path)
        _write_log(log, f"[background-removal] local_done path={output_path.name}")
        return output_path
    finally:
        del remover


def remove_background_image(
    *,
    source_path: Path,
    output_path: Path,
    provider: BackgroundRemovalProvider | str | None = None,
    rmbg_model_path: str | None = None,
    remote_api_url: str | None = None,
    remote_api_key: str | None = None,
    remote_format: str | None = None,
    log: LogWriter | None = None,
) -> Path:
    if not source_path.is_file():
        raise FileNotFoundError(f"待去背景图片不存在：{source_path}")

    resolved_provider = resolve_background_removal_provider(provider)
    if resolved_provider == "auto":
        resolved_provider = "local"

    if log:
        log(f"[background-removal] started provider={resolved_provider}")

    if resolved_provider == "remote":
        return _remove_background_remote(
            source_path=source_path,
            output_path=output_path,
            api_url=remote_api_url,
            api_key=remote_api_key,
            image_format=remote_format,
            log=log,
        )

    return _remove_background_local(
        source_path=source_path,
        output_path=output_path,
        rmbg_model_path=rmbg_model_path,
        log=log,
    )
