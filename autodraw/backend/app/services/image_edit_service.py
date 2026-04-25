from __future__ import annotations

import base64
import io
import os
import re
from pathlib import Path
from typing import Any, Callable

import requests
from PIL import Image

from ..schemas import CreateJobRequest
from .background_removal_service import remove_background_image

LogWriter = Callable[[str], None]
ALPHA_NOISE_THRESHOLD = 8

OPENAI_COMPATIBLE_BASE_URLS = {
    "openrouter": "https://openrouter.ai/api/v1",
    "bianxie": "https://api.bianxie.ai/v1",
    "qingyun": os.environ.get("QINGYUN_BASE_URL", "https://api.qingyuntop.top/v1"),
    "local": os.environ.get("LOCAL_BASE_URL", "http://127.0.0.1:8045/v1"),
}

PROVIDER_DEFAULT_MODELS = {
    "openrouter": os.environ.get("OPENROUTER_IMAGE_EDIT_MODEL")
    or os.environ.get("OPENROUTER_IMAGE_MODEL")
    or "google/gemini-3-pro-image-preview",
    "bianxie": os.environ.get("BIANXIE_IMAGE_EDIT_MODEL")
    or os.environ.get("BIANXIE_IMAGE_MODEL")
    or "gemini-3-pro-image-preview",
    "qingyun": os.environ.get("QINGYUN_IMAGE_EDIT_MODEL")
    or os.environ.get("QINGYUN_IMAGE_MODEL")
    or "gemini-3.1-flash-image-preview",
    "local": os.environ.get("LOCAL_IMAGE_EDIT_MODEL")
    or os.environ.get("LOCAL_IMAGE_MODEL")
    or "gemini-3-pro-image",
}


def _resolve_api_key(provider: str, api_key: str | None) -> str:
    if api_key and api_key.strip():
        return api_key.strip()
    if provider == "qingyun":
        value = os.environ.get("QINGYUN_API_KEY")
    elif provider == "openrouter":
        value = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("API_KEY")
    elif provider == "bianxie":
        value = os.environ.get("BIANXIE_API_KEY") or os.environ.get("API_KEY")
    elif provider == "local":
        value = os.environ.get("LOCAL_API_KEY") or os.environ.get("API_KEY") or "local"
    else:
        value = None
    if not value:
        raise ValueError("图片编辑缺少 API Key，请在前端填写或在后端环境变量中配置。")
    return value


def _resolve_base_url(provider: str, base_url: str | None) -> str:
    if base_url and base_url.strip():
        return base_url.strip().rstrip("/")
    resolved = OPENAI_COMPATIBLE_BASE_URLS.get(provider)
    if not resolved:
        raise ValueError(
            f"当前 provider={provider} 暂不支持图片编辑，请使用 qingyun、bianxie、openrouter 或 local。"
        )
    return resolved.rstrip("/")


def _resolve_model(provider: str, image_model: str | None) -> str:
    if image_model and image_model.strip():
        return image_model.strip()
    override = os.environ.get("IMAGE_EDIT_MODEL", "").strip() or os.environ.get(
        "IMAGE_MODEL", ""
    ).strip()
    if override:
        return override
    return PROVIDER_DEFAULT_MODELS.get(provider, "gemini-3.1-flash-image-preview")


def _write_log(log: LogWriter | None, message: str) -> None:
    if log:
        log(message)


def _prepare_source_image(source_image_path: Path, output_dir: Path) -> Path:
    prepared_path = output_dir / "source.png"
    with Image.open(source_image_path) as image:
        normalized = image.convert("RGBA")
        normalized.save(prepared_path, format="PNG")
    return prepared_path


def _image_to_png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _clean_transparent_pixels(
    image: Image.Image, *, alpha_threshold: int = ALPHA_NOISE_THRESHOLD
) -> tuple[Image.Image, dict[str, int]]:
    rgba = image.convert("RGBA")
    pixels = bytearray(rgba.tobytes())
    cleared_pixels = 0
    thresholded_pixels = 0

    for index in range(0, len(pixels), 4):
        alpha = pixels[index + 3]
        if alpha == 0:
            pixels[index] = 0
            pixels[index + 1] = 0
            pixels[index + 2] = 0
            cleared_pixels += 1
            continue
        if alpha <= alpha_threshold:
            pixels[index] = 0
            pixels[index + 1] = 0
            pixels[index + 2] = 0
            pixels[index + 3] = 0
            cleared_pixels += 1
            thresholded_pixels += 1

    cleaned = Image.frombytes("RGBA", rgba.size, bytes(pixels))
    return cleaned, {
        "cleared_pixels": cleared_pixels,
        "thresholded_pixels": thresholded_pixels,
    }


def _normalize_generated_image_bytes(
    image_bytes: bytes, *, log: LogWriter | None = None
) -> tuple[bytes, dict[str, Any]]:
    with Image.open(io.BytesIO(image_bytes)) as image:
        rgba = image.convert("RGBA")
        alpha_extrema = rgba.getchannel("A").getextrema()
        has_transparency = alpha_extrema[0] < 255
        cleaned_image, cleanup_stats = _clean_transparent_pixels(rgba)
        if log:
            log(
                "[image-edit] alpha="
                f"min:{alpha_extrema[0]} max:{alpha_extrema[1]} "
                f"has_transparency={str(has_transparency).lower()} "
                f"thresholded_pixels={cleanup_stats['thresholded_pixels']}"
            )
        return _image_to_png_bytes(cleaned_image), {
            "has_transparency": has_transparency,
            **cleanup_stats,
        }


def _write_processed_output(
    *,
    image_bytes: bytes,
    edited_output_path: Path,
    request: CreateJobRequest,
    log: LogWriter | None = None,
) -> dict[str, Any]:
    normalized_bytes, cleanup_stats = _normalize_generated_image_bytes(
        image_bytes, log=log
    )
    edited_output_path.write_bytes(normalized_bytes)

    if request.remove_background:
        if log:
            log("[image-edit] remove_background=true")
        remove_background_image(
            source_path=edited_output_path,
            output_path=edited_output_path,
            provider=request.background_removal_provider,
            rmbg_model_path=request.rmbg_model_path,
            log=log,
        )
    else:
        if log:
            log("[image-edit] remove_background=false")

    if log:
        log(f"[image-edit] wrote={edited_output_path.name}")

    return cleanup_stats


def _get_openrouter_headers(api_key: str, provider_name: str = "OpenRouter") -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    if provider_name.lower() == "openrouter":
        headers["HTTP-Referer"] = "https://localhost"
        headers["X-Title"] = "MethodToSVG"
    return headers


def _get_openrouter_api_url(base_url: str) -> str:
    if not base_url.endswith("/chat/completions"):
        if base_url.endswith("/"):
            return base_url + "chat/completions"
        return base_url + "/chat/completions"
    return base_url


def _get_qingyun_gemini_native_api_url(base_url: str, model: str) -> str:
    normalized_base = base_url.rstrip("/")
    if normalized_base.endswith("/chat/completions"):
        normalized_base = normalized_base[: -len("/chat/completions")]
    if normalized_base.endswith("/v1"):
        normalized_base = normalized_base[:-3] + "/v1beta"
    elif not normalized_base.endswith("/v1beta"):
        normalized_base = normalized_base + "/v1beta"
    return f"{normalized_base}/models/{model}:generateContent"


def _extract_data_url_payload(data_url: str) -> str | None:
    match = re.match(
        r"^data:image/[^;]+;base64,(.+)$",
        data_url,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return None
    return re.sub(r"\s+", "", match.group(1))


def _decode_base64_image(image_b64: str) -> Image.Image | None:
    if not image_b64:
        return None
    try:
        b64 = re.sub(r"\s+", "", image_b64)
        padding = len(b64) % 4
        if padding:
            b64 += "=" * (4 - padding)
        image_data = base64.b64decode(b64)
        image = Image.open(io.BytesIO(image_data))
        image.load()
        return image
    except Exception:
        return None


def _load_remote_image(image_url: str) -> Image.Image | None:
    try:
        response = requests.get(image_url, timeout=120)
        response.raise_for_status()
        image = Image.open(io.BytesIO(response.content))
        image.load()
        return image
    except Exception:
        return None


def _extract_image_url(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        if isinstance(value.get("url"), str):
            return value["url"]
        if "image_url" in value:
            return _extract_image_url(value.get("image_url"))
    return None


def _try_parse_image_candidate(candidate: Any) -> Image.Image | None:
    if isinstance(candidate, dict):
        for key in ("b64_json", "base64", "data"):
            raw = candidate.get(key)
            if isinstance(raw, str):
                parsed = _decode_base64_image(raw)
                if parsed is not None:
                    return parsed
        if "image_url" in candidate:
            parsed = _try_parse_image_candidate(candidate.get("image_url"))
            if parsed is not None:
                return parsed
        if "url" in candidate:
            parsed = _try_parse_image_candidate(candidate.get("url"))
            if parsed is not None:
                return parsed
        return None

    if not isinstance(candidate, str):
        return None

    candidate = candidate.strip()
    if not candidate:
        return None

    if candidate.startswith("data:image/"):
        payload = _extract_data_url_payload(candidate)
        if payload:
            return _decode_base64_image(payload)
        return None

    if candidate.startswith("http://") or candidate.startswith("https://"):
        return _load_remote_image(candidate)

    return _decode_base64_image(candidate)


def _extract_markdown_image_urls(text: str) -> list[str]:
    urls: list[str] = []
    for match in re.finditer(r"!\[[^\]]*\]\(([^)]+)\)", text):
        urls.append(match.group(1).strip())
    for match in re.finditer(
        r"data:image/[^;]+;base64,[A-Za-z0-9+/=\s]+",
        text,
        flags=re.IGNORECASE,
    ):
        urls.append(match.group(0).strip())
    return urls


def _extract_openrouter_image_bytes(result: dict[str, Any], *, provider_name: str, model: str) -> bytes:
    choices = result.get("choices", [])
    if not choices:
        raise RuntimeError(f"{provider_name} 返回中没有 choices，无法解析生图结果。")

    message = choices[0].get("message", {})
    candidates: list[Any] = []

    images = message.get("images")
    if isinstance(images, list):
        candidates.extend(images)
    elif images is not None:
        candidates.append(images)

    content = message.get("content")
    if isinstance(content, list):
        candidates.extend(content)
    elif isinstance(content, str):
        candidates.extend(_extract_markdown_image_urls(content))

    top_images = result.get("images")
    if isinstance(top_images, list):
        candidates.extend(top_images)

    for item in candidates:
        parsed = _try_parse_image_candidate(item)
        if parsed is not None:
            return _image_to_png_bytes(parsed)

        image_url = _extract_image_url(item)
        if image_url:
            parsed = _try_parse_image_candidate(image_url)
            if parsed is not None:
                return _image_to_png_bytes(parsed)

    raise RuntimeError(f"{provider_name} 响应成功但未包含可解析图片。model={model}")


def _extract_gemini_native_image_bytes(result: dict[str, Any], *, model: str) -> bytes:
    candidates = result.get("candidates", [])
    for candidate in candidates:
        content = candidate.get("content", {}) if isinstance(candidate, dict) else {}
        parts = content.get("parts", []) if isinstance(content, dict) else []
        for part in parts:
            if not isinstance(part, dict):
                continue
            inline_data = part.get("inline_data") or part.get("inlineData") or {}
            if not isinstance(inline_data, dict):
                continue
            data = inline_data.get("data")
            if isinstance(data, str):
                parsed = _decode_base64_image(data)
                if parsed is not None:
                    return _image_to_png_bytes(parsed)
    raise RuntimeError(f"Qingyun Gemini Native 响应成功但未包含可解析图片。model={model}")


def _run_qingyun_openai_compatible_image_edit(
    *,
    api_key: str,
    model: str,
    base_url: str,
    prompt: str,
    prepared_source_path: Path,
) -> bytes:
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": (
                                "data:image/png;base64,"
                                f"{base64.b64encode(prepared_source_path.read_bytes()).decode('utf-8')}"
                            )
                        },
                    },
                ],
            }
        ],
        "modalities": ["image"],
        "stream": False,
    }
    response = requests.post(
        _get_openrouter_api_url(base_url),
        headers=_get_openrouter_headers(api_key, provider_name="Qingyun"),
        json=payload,
        timeout=300,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Qingyun OpenAI 兼容生图接口错误: {response.status_code} - {response.text[:500]}"
        )
    result = response.json()
    if "error" in result:
        error_msg = result.get("error", {})
        if isinstance(error_msg, dict):
            error_msg = error_msg.get("message", str(error_msg))
        raise RuntimeError(f"Qingyun OpenAI 兼容生图接口错误: {error_msg}")
    return _extract_openrouter_image_bytes(result, provider_name="Qingyun", model=model)


def _run_qingyun_gemini_native_image_edit(
    *,
    api_key: str,
    model: str,
    base_url: str,
    prompt: str,
    prepared_source_path: Path,
) -> bytes:
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": base64.b64encode(prepared_source_path.read_bytes()).decode(
                                "utf-8"
                            ),
                        }
                    },
                    {"text": prompt},
                ],
            }
        ],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
            "imageConfig": {"imageSize": "4K"},
        },
    }
    response = requests.post(
        _get_qingyun_gemini_native_api_url(base_url, model),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        params={"key": api_key},
        json=payload,
        timeout=300,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Qingyun Gemini Native 接口错误: {response.status_code} - {response.text[:500]}"
        )
    result = response.json()
    if "error" in result:
        error_msg = result.get("error", {})
        if isinstance(error_msg, dict):
            error_msg = error_msg.get("message", str(error_msg))
        raise RuntimeError(f"Qingyun Gemini Native 接口错误: {error_msg}")
    return _extract_gemini_native_image_bytes(result, model=model)


def _extract_generated_image_bytes(result: object) -> bytes:
    data = getattr(result, "data", None) or []
    if not data:
        raise RuntimeError("模型返回里没有图片数据。")

    first_item = data[0]
    image_base64 = getattr(first_item, "b64_json", None)
    if image_base64:
        return base64.b64decode(image_base64)

    image_url = getattr(first_item, "url", None)
    if image_url:
        response = requests.get(image_url, timeout=120)
        response.raise_for_status()
        return response.content

    raise RuntimeError("模型返回里没有可解析的图片结果。")


def run_image_edit(
    *,
    request: CreateJobRequest,
    output_dir: Path,
    log_path: Path,
) -> dict[str, str]:
    provider = request.provider
    prompt = (request.prompt or "").strip()
    source_image_path = Path(request.source_image_path or "").expanduser()
    if not prompt:
        raise ValueError("图片编辑缺少 prompt。")
    if not source_image_path.is_file():
        raise FileNotFoundError(f"找不到待编辑图片：{source_image_path}")

    api_key = _resolve_api_key(provider, request.api_key)
    base_url = _resolve_base_url(provider, request.base_url)
    model = _resolve_model(provider, request.image_model)

    def append_log(message: str) -> None:
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(f"{message}\n")

    _write_log(append_log, f"[image-edit] provider={provider}")
    _write_log(append_log, f"[image-edit] model={model}")
    _write_log(append_log, f"[image-edit] source={source_image_path}")
    _write_log(
        append_log,
        f"[image-edit] remove_background={str(request.remove_background).lower()}",
    )

    prepared_source_path = _prepare_source_image(source_image_path, output_dir)
    edited_output_path = output_dir / "edited.png"

    try:
        if provider == "qingyun":
            try:
                image_bytes = _run_qingyun_openai_compatible_image_edit(
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    prompt=prompt,
                    prepared_source_path=prepared_source_path,
                )
                _write_log(append_log, "[image-edit] route=qingyun-chat-completions")
            except Exception as exc:
                _write_log(append_log, f"[image-edit] qingyun_chat_error={exc}")
                image_bytes = _run_qingyun_gemini_native_image_edit(
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    prompt=prompt,
                    prepared_source_path=prepared_source_path,
                )
                _write_log(append_log, "[image-edit] route=qingyun-gemini-native")

            cleanup_stats = _write_processed_output(
                image_bytes=image_bytes,
                edited_output_path=edited_output_path,
                request=request,
                log=append_log,
            )
            return {
                "edited_image_path": str(edited_output_path),
                "prepared_source_path": str(prepared_source_path),
                "provider": provider,
                "model": model,
                "has_transparency": str(cleanup_stats["has_transparency"]).lower(),
            }

        from openai import OpenAI

        client = OpenAI(api_key=api_key, base_url=base_url)
        with prepared_source_path.open("rb") as image_handle:
            result = client.images.edit(
                model=model,
                image=image_handle,
                prompt=prompt,
            )
        image_bytes = _extract_generated_image_bytes(result)
        cleanup_stats = _write_processed_output(
            image_bytes=image_bytes,
            edited_output_path=edited_output_path,
            request=request,
            log=append_log,
        )
        return {
            "edited_image_path": str(edited_output_path),
            "prepared_source_path": str(prepared_source_path),
            "provider": provider,
            "model": model,
            "has_transparency": str(cleanup_stats["has_transparency"]).lower(),
        }
    except Exception as exc:
        _write_log(append_log, f"[image-edit] error={exc}")
        raise
