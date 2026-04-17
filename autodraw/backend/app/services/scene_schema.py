from __future__ import annotations

import base64
import binascii
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import unquote_to_bytes
from xml.etree import ElementTree as ET

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError, ValidationError

from ..config import settings


SCENE_SCHEMA_PATH = settings.repo_root.parent / "docs" / "autodraw" / "scene-schema-draft.json"


class SceneSchemaValidationError(ValueError):
    pass


@lru_cache(maxsize=1)
def load_scene_schema() -> dict[str, Any]:
    if not SCENE_SCHEMA_PATH.is_file():
        raise SceneSchemaValidationError(f"Scene schema file not found: {SCENE_SCHEMA_PATH}")
    try:
        return json.loads(SCENE_SCHEMA_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SceneSchemaValidationError(f"Invalid scene schema JSON: {exc}") from exc


@lru_cache(maxsize=1)
def get_scene_validator() -> Draft202012Validator:
    schema = load_scene_schema()
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        raise SceneSchemaValidationError(f"Invalid scene schema definition: {exc.message}") from exc
    return Draft202012Validator(schema)


def validate_scene_payload(payload: dict[str, Any], *, job_dir: Path | None = None) -> None:
    validator = get_scene_validator()
    errors = sorted(validator.iter_errors(payload), key=lambda error: list(error.absolute_path))
    if errors:
        raise SceneSchemaValidationError(_format_validation_errors(errors))
    _validate_business_constraints(payload, job_dir=job_dir)


def _validate_business_constraints(payload: dict[str, Any], *, job_dir: Path | None) -> None:
    elements = payload.get("elements", [])
    assets = payload.get("assets", [])
    metadata = payload.get("metadata", {}) or {}
    canvas = payload.get("canvas", {}) or {}

    if not elements:
        raise SceneSchemaValidationError("Scene business validation failed: elements must not be empty")

    element_ids: list[str] = []
    for element in elements:
        element_id = element.get("id")
        if isinstance(element_id, str):
            element_ids.append(element_id)
    duplicate_element_ids = sorted({item for item in element_ids if element_ids.count(item) > 1})
    if duplicate_element_ids:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: duplicate element ids: {', '.join(duplicate_element_ids)}"
        )

    asset_ids: list[str] = []
    for asset in assets:
        asset_id = asset.get("id")
        if isinstance(asset_id, str):
            asset_ids.append(asset_id)
    duplicate_asset_ids = sorted({item for item in asset_ids if asset_ids.count(item) > 1})
    if duplicate_asset_ids:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: duplicate asset ids: {', '.join(duplicate_asset_ids)}"
        )

    element_id_set = set(element_ids)
    asset_id_set = set(asset_ids)
    element_map = {
        element["id"]: element
        for element in elements
        if isinstance(element.get("id"), str)
    }

    _validate_canvas_style(canvas)
    _validate_z_index_order(elements)

    for element in elements:
        _validate_element_references(element, element_id_set)
        _validate_element_geometry(element, canvas)
        _validate_element_style(element)
        _validate_text_consistency(element)

    for element in elements:
        if element.get("kind") == "image":
            asset_ref = element.get("assetRef")
            if asset_ref not in asset_id_set:
                raise SceneSchemaValidationError(
                    f"Scene business validation failed: image element `{element.get('id')}` references missing asset `{asset_ref}`"
                )
        if element.get("kind") == "connector":
            _validate_connector_geometry(element, element_map)
        if element.get("kind") == "fragment":
            _validate_fragment_bounds(element, canvas)
            _validate_fragment_content(element)

    for asset in assets:
        _validate_asset(asset, job_dir=job_dir)

    for metadata_key in ("templateSvgPath", "finalSvgPath"):
        metadata_path = metadata.get(metadata_key)
        if metadata_path:
            _validate_relative_job_file(
                raw_path=str(metadata_path),
                job_dir=job_dir,
                label=f"metadata.{metadata_key}",
            )


def _validate_element_references(element: dict[str, Any], element_id_set: set[str]) -> None:
    element_id = element.get("id")
    kind = element.get("kind")

    for key in ("groupId", "textRef", "labelRef"):
        ref_id = element.get(key)
        if ref_id is not None and ref_id not in element_id_set:
            raise SceneSchemaValidationError(
                f"Scene business validation failed: element `{element_id}` references missing `{key}` `{ref_id}`"
            )

    if kind == "group":
        for child_id in element.get("children", []):
            if child_id not in element_id_set:
                raise SceneSchemaValidationError(
                    f"Scene business validation failed: group `{element_id}` references missing child `{child_id}`"
                )

    if kind == "connector":
        for endpoint_name in ("from", "to"):
            endpoint = element.get(endpoint_name, {})
            target_id = endpoint.get("elementId")
            if target_id not in element_id_set:
                raise SceneSchemaValidationError(
                    f"Scene business validation failed: connector `{element_id}` references missing `{endpoint_name}.elementId` `{target_id}`"
                )


def _validate_asset(asset: dict[str, Any], *, job_dir: Path | None) -> None:
    asset_id = asset.get("id")
    raw_path = asset.get("path")
    if not isinstance(raw_path, str) or not raw_path.strip():
        raise SceneSchemaValidationError(
            f"Scene business validation failed: asset `{asset_id}` has invalid path"
        )

    _validate_relative_job_file(raw_path=raw_path, job_dir=job_dir, label=f"asset `{asset_id}` path")
    _validate_asset_mime_type(asset)


def _validate_relative_job_file(*, raw_path: str, job_dir: Path | None, label: str) -> None:
    path_obj = Path(raw_path)
    if path_obj.is_absolute():
        raise SceneSchemaValidationError(
            f"Scene business validation failed: {label} must be relative to job dir, got absolute path `{raw_path}`"
        )

    normalized_parts = [part for part in path_obj.parts if part not in ("", ".")]
    if any(part == ".." for part in normalized_parts):
        raise SceneSchemaValidationError(
            f"Scene business validation failed: {label} must not escape job dir: `{raw_path}`"
        )

    if job_dir is None:
        return

    resolved_job_dir = job_dir.resolve()
    resolved_path = (resolved_job_dir / path_obj).resolve()
    try:
        resolved_path.relative_to(resolved_job_dir)
    except ValueError as exc:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: {label} resolves outside job dir: `{raw_path}`"
        ) from exc

    if not resolved_path.is_file():
        raise SceneSchemaValidationError(
            f"Scene business validation failed: {label} does not exist: `{raw_path}`"
        )


def _validate_asset_mime_type(asset: dict[str, Any]) -> None:
    raw_path = str(asset.get("path", ""))
    mime_type = asset.get("mimeType")
    suffix = Path(raw_path).suffix.lower()

    expected_mime_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".ttf": "font/ttf",
        ".otf": "font/otf",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
    }.get(suffix)

    if expected_mime_type and mime_type != expected_mime_type:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: asset `{asset.get('id')}` mimeType `{mime_type}` does not match file extension `{suffix}`"
        )


def _validate_canvas_style(canvas: dict[str, Any]) -> None:
    background = canvas.get("background")
    if not _is_valid_color_value(background):
        raise SceneSchemaValidationError(
            f"Scene business validation failed: invalid canvas background `{background}`"
        )


def _validate_element_style(element: dict[str, Any]) -> None:
    kind = element.get("kind")
    style = element.get("style")
    if not isinstance(style, dict):
        return

    color_keys = ("fill", "stroke")
    for key in color_keys:
        if key in style and not _is_valid_color_value(style.get(key)):
            raise SceneSchemaValidationError(
                f"Scene business validation failed: element `{element.get('id')}` has invalid `{key}` value `{style.get(key)}`"
            )

    font_weight = style.get("fontWeight")
    if font_weight is not None and not _is_valid_font_weight(font_weight):
        raise SceneSchemaValidationError(
            f"Scene business validation failed: element `{element.get('id')}` has invalid fontWeight `{font_weight}`"
        )

    if kind == "connector":
        for key in ("stroke",):
            if key in style and not _is_valid_color_value(style.get(key)):
                raise SceneSchemaValidationError(
                    f"Scene business validation failed: connector `{element.get('id')}` has invalid `{key}` value `{style.get(key)}`"
                )


def _validate_element_geometry(element: dict[str, Any], canvas: dict[str, Any]) -> None:
    bounds = _get_element_bounds(element)
    if bounds is None:
        return

    canvas_width = float(canvas.get("width", 0))
    canvas_height = float(canvas.get("height", 0))
    overflow_tolerance = max(64.0, max(canvas_width, canvas_height) * 0.2)

    x = bounds["x"]
    y = bounds["y"]
    width = bounds["width"]
    height = bounds["height"]

    if width > max(canvas_width * 4, 1024) or height > max(canvas_height * 4, 1024):
        raise SceneSchemaValidationError(
            f"Scene business validation failed: element `{element.get('id')}` has unreasonable bounds size `{width}x{height}`"
        )

    if x > canvas_width + overflow_tolerance or y > canvas_height + overflow_tolerance:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: element `{element.get('id')}` is positioned outside canvas range"
        )

    if x + width < -overflow_tolerance or y + height < -overflow_tolerance:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: element `{element.get('id')}` is positioned outside canvas range"
        )


def _validate_connector_geometry(connector: dict[str, Any], element_map: dict[str, dict[str, Any]]) -> None:
    connector_id = connector.get("id")
    from_binding = connector.get("from", {})
    to_binding = connector.get("to", {})
    from_id = from_binding.get("elementId")
    to_id = to_binding.get("elementId")

    if from_id == connector_id or to_id == connector_id:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: connector `{connector_id}` must not bind to itself"
        )
    if from_id == to_id:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: connector `{connector_id}` must not bind source and target to the same element `{from_id}`"
        )

    points = connector.get("routing", {}).get("points", [])
    if len(points) < 2:
        return

    start_point = points[0]
    end_point = points[-1]
    start_bounds = _get_element_bounds(element_map.get(from_id, {}))
    end_bounds = _get_element_bounds(element_map.get(to_id, {}))
    if start_bounds and not _point_near_bounds(start_point, start_bounds):
        raise SceneSchemaValidationError(
            f"Scene business validation failed: connector `{connector_id}` start point is too far from source element `{from_id}`"
        )
    if end_bounds and not _point_near_bounds(end_point, end_bounds):
        raise SceneSchemaValidationError(
            f"Scene business validation failed: connector `{connector_id}` end point is too far from target element `{to_id}`"
        )


def _validate_fragment_bounds(fragment: dict[str, Any], canvas: dict[str, Any]) -> None:
    bounds = _get_element_bounds(fragment)
    if bounds is None:
        return
    fragment_area = bounds["width"] * bounds["height"]
    canvas_area = float(canvas.get("width", 0)) * float(canvas.get("height", 0))
    if canvas_area > 0 and fragment_area > canvas_area * 0.6:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: fragment `{fragment.get('id')}` is too large and looks like a full-canvas fallback"
        )


def _validate_fragment_content(fragment: dict[str, Any]) -> None:
    content = fragment.get("content")
    if not isinstance(content, dict):
        return
    fragment_id = fragment.get("id")
    fmt = content.get("format")
    data = content.get("data")
    if not isinstance(data, str) or not data.strip():
        raise SceneSchemaValidationError(
            f"Scene business validation failed: fragment `{fragment_id}` has empty content data"
        )

    if fmt == "svg-inline":
        _validate_svg_markup(data, label=f"fragment `{fragment_id}` svg-inline content")
        return

    if fmt == "svg-data-url":
        mime_type, payload, is_base64 = _parse_data_url(data, label=f"fragment `{fragment_id}` svg-data-url")
        if mime_type != "image/svg+xml":
            raise SceneSchemaValidationError(
                f"Scene business validation failed: fragment `{fragment_id}` svg-data-url must use image/svg+xml, got `{mime_type}`"
            )
        svg_bytes = _decode_data_url_payload(payload, is_base64, label=f"fragment `{fragment_id}` svg-data-url")
        _validate_svg_markup(svg_bytes.decode("utf-8", errors="strict"), label=f"fragment `{fragment_id}` svg-data-url")
        return

    if fmt == "png-data-url":
        mime_type, payload, is_base64 = _parse_data_url(data, label=f"fragment `{fragment_id}` png-data-url")
        if mime_type != "image/png" or not is_base64:
            raise SceneSchemaValidationError(
                f"Scene business validation failed: fragment `{fragment_id}` png-data-url must be base64 encoded image/png"
            )
        png_bytes = _decode_data_url_payload(payload, is_base64, label=f"fragment `{fragment_id}` png-data-url")
        if not png_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            raise SceneSchemaValidationError(
                f"Scene business validation failed: fragment `{fragment_id}` png-data-url is not a valid PNG payload"
            )
        return


def _validate_z_index_order(elements: list[dict[str, Any]]) -> None:
    z_index_values = [element.get("zIndex") for element in elements if "zIndex" in element]
    if not z_index_values:
        return
    if len(z_index_values) != len(elements):
        raise SceneSchemaValidationError(
            "Scene business validation failed: zIndex must be provided consistently for all elements"
        )
    if len(set(z_index_values)) != len(z_index_values):
        raise SceneSchemaValidationError(
            "Scene business validation failed: zIndex values must be unique"
        )
    ordered_values = sorted(z_index_values)
    if z_index_values != ordered_values:
        raise SceneSchemaValidationError(
            "Scene business validation failed: element order must match ascending zIndex order"
        )


def _validate_text_consistency(element: dict[str, Any]) -> None:
    if element.get("kind") != "text":
        return
    element_id = element.get("id")
    text = element.get("text")
    if not isinstance(text, str) or not text.strip():
        raise SceneSchemaValidationError(
            f"Scene business validation failed: text element `{element_id}` must have non-empty text"
        )

    source_text = element.get("sourceText")
    if source_text is not None and _normalize_text(source_text) != _normalize_text(text):
        raise SceneSchemaValidationError(
            f"Scene business validation failed: text element `{element_id}` has inconsistent sourceText and text"
        )

    runs = element.get("runs")
    if runs is None:
        return
    if not isinstance(runs, list) or not runs:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: text element `{element_id}` runs must be a non-empty array when provided"
        )
    joined_runs = "".join(str(run.get("text", "")) for run in runs if isinstance(run, dict))
    if _normalize_text(joined_runs) != _normalize_text(text):
        raise SceneSchemaValidationError(
            f"Scene business validation failed: text element `{element_id}` runs do not match text content"
        )


def _get_element_bounds(element: dict[str, Any]) -> dict[str, float] | None:
    if not isinstance(element, dict):
        return None
    raw_bounds = element.get("bounds")
    if not isinstance(raw_bounds, dict):
        raw_bounds = element.get("layout")
    if not isinstance(raw_bounds, dict):
        return None
    try:
        return {
            "x": float(raw_bounds["x"]),
            "y": float(raw_bounds["y"]),
            "width": float(raw_bounds["width"]),
            "height": float(raw_bounds["height"]),
        }
    except (KeyError, TypeError, ValueError):
        return None


def _point_near_bounds(point: Any, bounds: dict[str, float]) -> bool:
    try:
        px = float(point[0])
        py = float(point[1])
    except (TypeError, ValueError, IndexError):
        return False

    tolerance = max(48.0, min(bounds["width"], bounds["height"]) * 0.6)
    min_x = bounds["x"] - tolerance
    min_y = bounds["y"] - tolerance
    max_x = bounds["x"] + bounds["width"] + tolerance
    max_y = bounds["y"] + bounds["height"] + tolerance
    return min_x <= px <= max_x and min_y <= py <= max_y


def _is_valid_font_weight(value: Any) -> bool:
    if isinstance(value, int):
        return 100 <= value <= 900 and value % 100 == 0
    if isinstance(value, str):
        stripped = value.strip()
        if stripped in {"normal", "bold", "bolder", "lighter"}:
            return True
        if re.fullmatch(r"[1-9]00", stripped):
            return True
    return False


def _is_valid_color_value(value: Any) -> bool:
    if value is None:
        return False
    if not isinstance(value, str):
        return False
    stripped = value.strip()
    if not stripped:
        return False
    named_values = {
        "none",
        "transparent",
        "currentcolor",
        "black",
        "white",
        "gray",
        "grey",
        "red",
        "green",
        "blue",
        "yellow",
        "orange",
        "purple",
        "brown",
    }
    lowered = stripped.lower()
    if lowered in named_values:
        return True
    if re.fullmatch(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})", stripped):
        return True
    if re.fullmatch(r"rgba?\([^)]*\)", lowered):
        return True
    if re.fullmatch(r"hsla?\([^)]*\)", lowered):
        return True
    if re.fullmatch(r"url\(#[-A-Za-z0-9_:.]+\)", stripped):
        return True
    return False


def _normalize_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _parse_data_url(data_url: str, *, label: str) -> tuple[str, str, bool]:
    if not data_url.startswith("data:") or "," not in data_url:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: {label} is not a valid data URL"
        )
    header, payload = data_url.split(",", 1)
    meta = header[5:]
    parts = [part for part in meta.split(";") if part]
    mime_type = parts[0] if parts and "/" in parts[0] else "text/plain;charset=US-ASCII"
    is_base64 = any(part.lower() == "base64" for part in parts[1:] if "/" in parts[0]) or (
        parts and parts[-1].lower() == "base64" and "/" not in parts[0]
    )
    if not payload:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: {label} data URL payload is empty"
        )
    return mime_type, payload, is_base64


def _decode_data_url_payload(payload: str, is_base64: bool, *, label: str) -> bytes:
    try:
        if is_base64:
            return base64.b64decode(payload, validate=True)
        return unquote_to_bytes(payload)
    except (binascii.Error, ValueError) as exc:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: {label} payload cannot be decoded"
        ) from exc


def _validate_svg_markup(markup: str, *, label: str) -> None:
    try:
        root = ET.fromstring(markup)
    except ET.ParseError as exc:
        raise SceneSchemaValidationError(
            f"Scene business validation failed: {label} is not parseable SVG"
        ) from exc
    tag = root.tag.split("}", 1)[-1] if "}" in root.tag else root.tag
    if tag != "svg":
        raise SceneSchemaValidationError(
            f"Scene business validation failed: {label} root element must be <svg>"
        )


def _format_validation_errors(errors: list[ValidationError]) -> str:
    lines = ["Scene schema validation failed:"]
    for error in errors[:10]:
        path = ".".join(str(part) for part in error.absolute_path) or "<root>"
        lines.append(f"- {path}: {error.message}")
    if len(errors) > 10:
        lines.append(f"- ... and {len(errors) - 10} more errors")
    return "\n".join(lines)
