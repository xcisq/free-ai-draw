from __future__ import annotations

import mimetypes
import os
import shutil
from io import BytesIO
from pathlib import Path
from typing import Callable, Literal

import requests
from PIL import Image


LogWriter = Callable[[str], None]
BackgroundRemovalProvider = Literal["local", "remote", "auto"]
DEFAULT_REMOTE_APPLICATION = "fal-ai/birefnet"
DEFAULT_REMOTE_FORMAT = "png"
REMOTE_API_TIMEOUT = 300
REMOTE_MIN_IMAGE_SIDE = 32


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


def _resolve_remote_api_key(api_key: str | None) -> str:
    value = (
        api_key
        or os.environ.get("BACKGROUND_REMOVAL_API_KEY")
        or os.environ.get("FAL_KEY")
    )
    if not isinstance(value, str) or not value.strip():
        raise RuntimeError(
            "远程去背景缺少 API Key，请配置 BACKGROUND_REMOVAL_API_KEY 或 FAL_KEY。"
        )
    return value.strip()


def _resolve_remote_application() -> str:
    value = os.environ.get("BACKGROUND_REMOVAL_FAL_MODEL") or DEFAULT_REMOTE_APPLICATION
    return value.strip() or DEFAULT_REMOTE_APPLICATION


def _resolve_remote_format(image_format: str | None) -> str:
    value = (
        image_format
        or os.environ.get("BACKGROUND_REMOVAL_REMOTE_FORMAT")
        or DEFAULT_REMOTE_FORMAT
    ).strip().lower()
    if value not in {"png", "webp", "gif"}:
        raise RuntimeError("远程去背景仅支持输出格式 png、webp 或 gif。")
    return value


def _parse_bool_env(name: str) -> bool | None:
    value = os.environ.get(name)
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"环境变量 {name} 仅支持 true/false。")


def _build_remote_arguments(image_url: str, image_format: str) -> dict[str, object]:
    arguments: dict[str, object] = {
        "image_url": image_url,
        "output_format": image_format,
    }

    model_variant = os.environ.get("BACKGROUND_REMOVAL_FAL_MODEL_VARIANT")
    if isinstance(model_variant, str) and model_variant.strip():
        arguments["model"] = model_variant.strip()

    operating_resolution = os.environ.get("BACKGROUND_REMOVAL_FAL_OPERATING_RESOLUTION")
    if isinstance(operating_resolution, str) and operating_resolution.strip():
        arguments["operating_resolution"] = operating_resolution.strip()

    output_mask = _parse_bool_env("BACKGROUND_REMOVAL_FAL_OUTPUT_MASK")
    if output_mask is not None:
        arguments["output_mask"] = output_mask

    refine_foreground = _parse_bool_env("BACKGROUND_REMOVAL_FAL_REFINE_FOREGROUND")
    if refine_foreground is not None:
        arguments["refine_foreground"] = refine_foreground

    sync_mode = _parse_bool_env("BACKGROUND_REMOVAL_FAL_SYNC_MODE")
    if sync_mode is not None:
        arguments["sync_mode"] = sync_mode

    return arguments


def _extract_remote_output_url(result: object) -> str:
    if not isinstance(result, dict):
        raise RuntimeError("fal.ai 去背景返回格式异常：结果不是对象。")

    image = result.get("image")
    if isinstance(image, dict):
        url = image.get("url")
        if isinstance(url, str) and url.strip():
            return url.strip()

    images = result.get("images")
    if isinstance(images, list) and images:
        first = images[0]
        if isinstance(first, dict):
            url = first.get("url")
            if isinstance(url, str) and url.strip():
                return url.strip()

    raise RuntimeError("fal.ai 去背景返回中缺少可下载的图片 URL。")


def _download_remote_output(url: str, output_path: Path) -> Path:
    response = requests.get(url, timeout=REMOTE_API_TIMEOUT)
    try:
        response.raise_for_status()
    except Exception as exc:
        detail = response.text.strip()
        raise RuntimeError(
            f"下载 fal.ai 去背景结果失败: status={response.status_code} detail={detail or 'unknown error'}"
        ) from exc
    output_path.write_bytes(response.content)
    return output_path


def _prepare_remote_upload_payload(
    source_path: Path,
    *,
    log: LogWriter | None = None,
) -> tuple[bytes, str, str]:
    content_type = mimetypes.guess_type(source_path.name)[0] or 'application/octet-stream'
    payload = source_path.read_bytes()

    try:
        with Image.open(source_path) as image:
            width, height = image.size
            if width >= REMOTE_MIN_IMAGE_SIDE and height >= REMOTE_MIN_IMAGE_SIDE:
                return payload, content_type, source_path.name

            scale = max(REMOTE_MIN_IMAGE_SIDE / width, REMOTE_MIN_IMAGE_SIDE / height)
            resized_size = (
                max(REMOTE_MIN_IMAGE_SIDE, round(width * scale)),
                max(REMOTE_MIN_IMAGE_SIDE, round(height * scale)),
            )
            resample = getattr(Image.Resampling, "LANCZOS", Image.LANCZOS)
            resized = image.convert("RGBA").resize(resized_size, resample)
            buffer = BytesIO()
            resized.save(buffer, format="PNG")
            _write_log(
                log,
                "[background-removal] remote_input_resized "
                f"{width}x{height}->{resized_size[0]}x{resized_size[1]}",
            )
            return buffer.getvalue(), "image/png", f"{source_path.stem}_remote.png"
    except Exception as exc:
        _write_log(
            log,
            f"[background-removal] remote_input_probe_failed={type(exc).__name__}",
        )

    return payload, content_type, source_path.name


def _remove_background_remote(
    *,
    source_path: Path,
    output_path: Path,
    api_key: str | None = None,
    image_format: str | None = None,
    log: LogWriter | None = None,
) -> Path:
    try:
        from fal_client import SyncClient
    except ImportError as exc:
        raise RuntimeError(
            "fal-client 未安装，无法使用 fal.ai 去背景；请执行 `pip install -r autodraw/requirements.txt`"
        ) from exc

    resolved_api_key = _resolve_remote_api_key(api_key)
    resolved_format = _resolve_remote_format(image_format)
    application = _resolve_remote_application()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    payload, content_type, upload_name = _prepare_remote_upload_payload(
        source_path,
        log=log,
    )
    client = SyncClient(key=resolved_api_key, default_timeout=float(REMOTE_API_TIMEOUT))
    remote_url = client.upload(payload, content_type, upload_name)
    arguments = _build_remote_arguments(remote_url, resolved_format)

    _write_log(log, f"[background-removal] provider=remote application={application}")
    result = client.subscribe(
        application,
        arguments=arguments,
        with_logs=False,
        start_timeout=float(REMOTE_API_TIMEOUT),
        client_timeout=float(REMOTE_API_TIMEOUT),
    )
    if isinstance(result, dict) and "error" in result:
        raise RuntimeError(f"fal.ai 去背景失败: {result.get('error')}")

    output_url = _extract_remote_output_url(result)
    _download_remote_output(output_url, output_path)
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

    if remote_api_url:
        _write_log(log, "[background-removal] remote_api_url 已忽略，remote provider 现固定使用 fal.ai application")

    if log:
        log(f"[background-removal] started provider={resolved_provider}")

    if resolved_provider == "remote":
        return _remove_background_remote(
            source_path=source_path,
            output_path=output_path,
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
