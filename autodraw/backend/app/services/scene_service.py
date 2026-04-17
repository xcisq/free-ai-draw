from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

from .scene_schema import validate_scene_payload


SVG_NS = {"svg": "http://www.w3.org/2000/svg"}
SCENE_FILE_NAME = "scene.json"
SCENE_VERSION = "1.0.0"
DEFAULT_THEME_PRESET = "academic"
DEFAULT_TEXT_FONT_FAMILY = '"Segoe UI", "Helvetica Neue", Arial, sans-serif'


def build_scene_file(
    *,
    job_id: str,
    job_dir: Path,
    pipeline_result: dict[str, Any] | None,
) -> Path | None:
    if not pipeline_result:
        return None

    template_svg_path = pipeline_result.get("template_svg_path")
    if not template_svg_path:
        return None

    template_path = Path(template_svg_path)
    if not template_path.is_file():
        return None

    scene = build_scene_payload(job_id=job_id, job_dir=job_dir, pipeline_result=pipeline_result)
    validate_scene_payload(scene, job_dir=job_dir)
    scene_path = job_dir / SCENE_FILE_NAME
    scene_path.write_text(json.dumps(scene, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return scene_path


def build_scene_payload(
    *,
    job_id: str,
    job_dir: Path,
    pipeline_result: dict[str, Any],
) -> dict[str, Any]:
    template_path = Path(pipeline_result["template_svg_path"])
    svg_text = template_path.read_text(encoding="utf-8")
    root = ET.fromstring(svg_text)
    class_styles = _parse_class_styles(svg_text)
    canvas = _build_canvas(root)
    asset_entries = _build_asset_entries(job_dir=job_dir, pipeline_result=pipeline_result)
    icon_info_by_label = {
        str(icon_info.get("label_clean", "")).strip(): icon_info
        for icon_info in pipeline_result.get("icon_infos", [])
        if str(icon_info.get("label_clean", "")).strip()
    }

    elements: list[dict[str, Any]] = []
    z_index = 0

    for element in list(root):
        z_index = _append_scene_elements(
            root=root,
            node=element,
            class_styles=class_styles,
            elements=elements,
            z_index=z_index,
        )

    for asset in asset_entries:
        metadata = asset.get("metadata") or {}
        label_clean = metadata.get("label_clean")
        if not label_clean:
            continue
        icon_info = icon_info_by_label.get(str(label_clean))
        if not icon_info:
            continue
        elements.append(_build_image_element_from_icon_info(icon_info, asset, z_index))
        z_index += 1

    _bind_connector_endpoints(elements)

    return {
        "type": "drawnix-scene",
        "version": SCENE_VERSION,
        "source": {
            "jobId": job_id,
            "generator": "autodraw-backend",
            "pipelineVersion": "scene-minimal-v1",
        },
        "canvas": canvas,
        "theme": {
            "preset": DEFAULT_THEME_PRESET,
            "tokens": {},
        },
        "assets": asset_entries,
        "elements": elements,
        "metadata": {
            "templateSvgPath": _safe_relpath(job_dir, template_path),
            "finalSvgPath": _safe_relpath(job_dir, Path(pipeline_result["final_svg_path"])) if pipeline_result.get("final_svg_path") else None,
        },
    }


def _append_scene_elements(
    *,
    root: ET.Element,
    node: ET.Element,
    class_styles: dict[str, dict[str, str]],
    elements: list[dict[str, Any]],
    z_index: int,
) -> int:
    tag = _local_name(node.tag)

    if tag == "defs":
        return z_index

    if tag == "g":
        for child in list(node):
            z_index = _append_scene_elements(
                root=root,
                node=child,
                class_styles=class_styles,
                elements=elements,
                z_index=z_index,
            )
        return z_index

    if tag == "rect":
        if _is_placeholder_rect(node):
            return z_index
        elements.append(_build_shape_element(node, class_styles, z_index))
        return z_index + 1

    if tag == "text":
        text_content = "".join(node.itertext()).strip()
        if not text_content:
            return z_index
        text_features = _extract_text_features(node=node, text_content=text_content, class_styles=class_styles)
        if text_features["isPlaceholderLabel"]:
            return z_index
        elements.append(_build_text_element(node, class_styles, z_index, text_features))
        return z_index + 1

    if tag == "path":
        connector = _build_connector_element(node, class_styles, z_index)
        if connector is not None:
            elements.append(connector)
            return z_index + 1
        return z_index

    return z_index


def _build_canvas(root: ET.Element) -> dict[str, Any]:
    view_box = root.attrib.get("viewBox")
    if view_box:
        parts = [float(item) for item in re.split(r"[\s,]+", view_box.strip()) if item]
        if len(parts) == 4:
            return {
                "width": parts[2],
                "height": parts[3],
                "background": "#ffffff",
            }
    return {
        "width": _parse_number(root.attrib.get("width"), 800),
        "height": _parse_number(root.attrib.get("height"), 600),
        "background": "#ffffff",
    }


def _build_asset_entries(*, job_dir: Path, pipeline_result: dict[str, Any]) -> list[dict[str, Any]]:
    assets: list[dict[str, Any]] = []
    for icon_info in pipeline_result.get("icon_infos", []):
        label_clean = str(icon_info.get("label_clean", "")).strip()
        if not label_clean:
            continue
        nobg_path = icon_info.get("nobg_path")
        if not nobg_path:
            continue
        asset_path = Path(str(nobg_path))
        if not asset_path.is_file():
            continue
        assets.append(
            {
                "id": _asset_id(label_clean),
                "kind": "image",
                "path": _safe_relpath(job_dir, asset_path),
                "mimeType": _guess_image_mime_type(asset_path),
                "width": _parse_number(icon_info.get("width"), 1),
                "height": _parse_number(icon_info.get("height"), 1),
                "metadata": {
                    "label_clean": label_clean,
                    "label": icon_info.get("label"),
                },
            }
        )
    return assets


def _build_shape_element(node: ET.Element, class_styles: dict[str, dict[str, str]], z_index: int) -> dict[str, Any]:
    style = _resolve_style(node, class_styles)
    x = _parse_number(node.attrib.get("x"))
    y = _parse_number(node.attrib.get("y"))
    width = _parse_number(node.attrib.get("width"))
    height = _parse_number(node.attrib.get("height"))
    rx = _parse_number(node.attrib.get("rx"))
    ry = _parse_number(node.attrib.get("ry"))
    semantic_role = _infer_shape_semantic_role(x=x, y=y, width=width, height=height, style=style)
    return {
        "id": _node_id(node, "shape", z_index),
        "kind": "shape",
        "shapeType": "round-rectangle" if rx > 0 or ry > 0 else "rectangle",
        "bounds": {
            "x": x,
            "y": y,
            "width": max(width, 1),
            "height": max(height, 1),
        },
        "cornerRadius": max(rx, ry),
        "style": {
            "fill": style.get("fill", "transparent"),
            "stroke": style.get("stroke", "transparent"),
            "strokeWidth": _parse_number(style.get("stroke-width"), 0),
            "opacity": _parse_number(style.get("opacity"), 1),
        },
        "zIndex": z_index,
        "metadata": {
            "semanticRole": semantic_role,
        },
    }


def _build_text_element(
    node: ET.Element,
    class_styles: dict[str, dict[str, str]],
    z_index: int,
    text_features: dict[str, Any],
) -> dict[str, Any]:
    style = _resolve_style(node, class_styles)
    text_content = text_features["rawText"]
    font_size = _parse_number(style.get("font-size"), 16)
    x = _parse_number(node.attrib.get("x"))
    y = _parse_number(node.attrib.get("y"))
    width = max(len(text_content) * font_size * 0.6, font_size)
    height = max(font_size * 1.4, 24)
    anchor = style.get("text-anchor", "start")
    left = x
    if anchor == "middle":
        left = x - width / 2
    elif anchor == "end":
        left = x - width
    top = y - font_size

    stroke = style.get("stroke")
    editing_mode = _resolve_text_editing_mode(text_features)
    text_style: dict[str, Any] = {
        "fontFamily": _resolve_font_family(style.get("font-family")),
        "fontSize": font_size,
        "fontWeight": style.get("font-weight", "400"),
        "fontStyle": style.get("font-style", "normal"),
        "fill": style.get("fill", "#000000"),
        "strokeWidth": _parse_number(style.get("stroke-width"), 0),
        "lineHeight": 1.2,
        "letterSpacing": _parse_number(style.get("letter-spacing"), 0),
        "opacity": _parse_number(style.get("opacity"), 1),
    }
    if stroke is not None:
        text_style["stroke"] = stroke

    element: dict[str, Any] = {
        "id": _node_id(node, "text", z_index),
        "kind": "text",
        "text": text_content,
        "layout": {
            "x": left,
            "y": top,
            "width": width,
            "height": height,
            "anchor": anchor if anchor in ("start", "middle", "end") else "start",
            "baseline": style.get("dominant-baseline", "alphabetic"),
            "rotation": _extract_rotation(node.attrib.get("transform")),
            "wrapMode": "none",
        },
        "style": text_style,
        "editing": {
            "mode": editing_mode,
            "preserveVisualPriority": "high" if editing_mode == "svg-fragment-text" else "medium",
        },
        "sourceText": text_content,
        "zIndex": z_index,
        "metadata": {
            "classList": text_features["classList"],
            "textRole": text_features["textRole"],
            "hasEmoji": text_features["hasEmoji"],
            "hasDecorativeSymbol": text_features["hasDecorativeSymbol"],
            "hasTspan": text_features["hasTspan"],
            "hasTransform": text_features["hasTransform"],
            "isPlaceholderLabel": text_features["isPlaceholderLabel"],
            "fontFamilies": text_features["fontFamilies"],
            "textLength": _parse_number(node.attrib.get("textLength"), 0),
            "lengthAdjust": node.attrib.get("lengthAdjust"),
        },
    }
    runs = _extract_text_runs(node, class_styles)
    if runs:
        element["runs"] = runs
    return element


def _build_connector_element(node: ET.Element, class_styles: dict[str, dict[str, str]], z_index: int) -> dict[str, Any] | None:
    style = _resolve_style(node, class_styles)
    points = _parse_path_points(node.attrib.get("d", ""))
    if len(points) < 2:
        return None
    stroke_width = _parse_number(style.get("stroke-width"), 2)
    if stroke_width < 2:
        return None
    if _looks_like_arrowhead_path(points):
        return None

    total_length = 0.0
    for index in range(1, len(points)):
        prev = points[index - 1]
        curr = points[index]
        total_length += ((curr[0] - prev[0]) ** 2 + (curr[1] - prev[1]) ** 2) ** 0.5
    if total_length < 45:
        return None

    class_name = node.attrib.get("class", "")
    semantic_role = "primary-flow" if "arrow" in class_name else "secondary-flow"

    return {
        "id": _node_id(node, "connector", z_index),
        "kind": "connector",
        "from": {
            "elementId": "",
            "port": "start",
        },
        "to": {
            "elementId": "",
            "port": "end",
        },
        "routing": {
            "shape": "polyline" if len(points) > 2 else "straight",
            "points": points,
        },
        "style": {
            "stroke": style.get("stroke", "#231F20"),
            "strokeWidth": stroke_width,
            "startMarker": "none",
            "endMarker": "arrow" if "arrow" in class_name else "none",
            "opacity": _parse_number(style.get("opacity"), 1),
        },
        "semanticRole": semantic_role,
        "zIndex": z_index,
    }


def _bind_connector_endpoints(elements: list[dict[str, Any]]) -> None:
    preferred_candidates = [
        element
        for element in elements
        if element.get("kind") in ("shape", "frame", "image") and _is_bindable_candidate(element)
    ]
    fallback_candidates = [
        element for element in elements if element.get("kind") == "text"
    ]
    candidates = preferred_candidates or fallback_candidates
    if not candidates:
        return

    for element in elements:
        if element.get("kind") != "connector":
            continue
        points = element.get("routing", {}).get("points", [])
        if len(points) < 2:
            continue
        start_point = points[0]
        end_point = points[-1]
        projected_end_point = _project_connector_endpoint(points)
        start_ranked = _rank_candidate_elements(candidates, start_point, role="source")
        end_ranked = _rank_candidate_elements(
            candidates,
            projected_end_point if _connector_has_arrow_end(element) else end_point,
            role="target",
        )
        start_target = start_ranked[0] if start_ranked else None
        end_target = _pick_distinct_candidate(end_ranked, excluded_id=start_target["id"] if start_target else None)
        if end_target is None and end_ranked:
            end_target = end_ranked[0]
        if start_target is not None:
            element["from"] = {
                "elementId": start_target["id"],
                "port": _infer_port_name(start_point, _element_bounds(start_target)),
            }
        if end_target is not None:
            element["to"] = {
                "elementId": end_target["id"],
                "port": _infer_port_name(end_point, _element_bounds(end_target)),
            }


def _build_image_element_from_icon_info(icon_info: dict[str, Any], asset: dict[str, Any], z_index: int) -> dict[str, Any]:
    x = _parse_number(icon_info.get("x1"))
    y = _parse_number(icon_info.get("y1"))
    width = _parse_number(icon_info.get("width"), asset["width"])
    height = _parse_number(icon_info.get("height"), asset["height"])
    label_clean = asset["metadata"]["label_clean"]
    return {
        "id": f"image-{label_clean.lower()}",
        "kind": "image",
        "assetRef": asset["id"],
        "layout": {
            "x": x,
            "y": y,
            "width": max(width, 1),
            "height": max(height, 1),
        },
        "editing": {
            "mode": "native-image",
            "replaceable": True,
        },
        "preserveAspectRatio": "xMidYMid meet",
        "zIndex": z_index,
        "metadata": {
            "semanticRole": "icon",
        },
    }


def _find_first_child(node: ET.Element, local_name: str) -> ET.Element | None:
    for child in list(node):
        if _local_name(child.tag) == local_name:
            return child
    return None


def _rank_candidate_elements(elements: list[dict[str, Any]], point: list[float], *, role: str) -> list[dict[str, Any]]:
    scored: list[tuple[float, dict[str, Any]]] = []
    for element in elements:
        bounds = _element_bounds(element)
        if bounds is None:
            continue
        distance = _distance_to_bounds(point, bounds)
        penalty = _candidate_penalty(element, role=role)
        scored.append((distance + penalty, element))
    scored.sort(key=lambda item: item[0])
    return [item[1] for item in scored]


def _pick_distinct_candidate(elements: list[dict[str, Any]], *, excluded_id: str | None) -> dict[str, Any] | None:
    for element in elements:
        if excluded_id is None or element.get("id") != excluded_id:
            return element
    return None


def _element_bounds(element: dict[str, Any]) -> dict[str, float] | None:
    if element.get("kind") in ("shape", "frame"):
        bounds = element.get("bounds")
    else:
        bounds = element.get("layout")
    if not isinstance(bounds, dict):
        return None
    try:
        return {
            "x": float(bounds["x"]),
            "y": float(bounds["y"]),
            "width": float(bounds["width"]),
            "height": float(bounds["height"]),
        }
    except (KeyError, TypeError, ValueError):
        return None


def _distance_to_bounds(point: list[float], bounds: dict[str, float]) -> float:
    px, py = float(point[0]), float(point[1])
    min_x = bounds["x"]
    min_y = bounds["y"]
    max_x = min_x + bounds["width"]
    max_y = min_y + bounds["height"]
    dx = max(min_x - px, 0.0, px - max_x)
    dy = max(min_y - py, 0.0, py - max_y)
    return (dx ** 2 + dy ** 2) ** 0.5


def _candidate_penalty(element: dict[str, Any], *, role: str) -> float:
    kind = element.get("kind")
    metadata = element.get("metadata", {}) or {}
    semantic_role = metadata.get("semanticRole")
    if semantic_role == "background":
        return 10_000.0
    if kind == "image":
        return 36.0 if role == "source" else 8.0
    if semantic_role == "container":
        return 6.0
    if semantic_role == "frame":
        return 4.0 if role == "target" else 22.0
    if kind in ("shape", "frame"):
        return 12.0
    if kind == "text":
        return 80.0
    return 40.0


def _is_bindable_candidate(element: dict[str, Any]) -> bool:
    metadata = element.get("metadata", {}) or {}
    semantic_role = metadata.get("semanticRole")
    return semantic_role != "background"


def _project_connector_endpoint(points: list[list[float]], distance: float = 96.0) -> list[float]:
    if len(points) < 2:
        return points[-1] if points else [0.0, 0.0]
    end_x, end_y = float(points[-1][0]), float(points[-1][1])
    prev_x, prev_y = float(points[-2][0]), float(points[-2][1])
    dx = end_x - prev_x
    dy = end_y - prev_y
    length = (dx ** 2 + dy ** 2) ** 0.5
    if length <= 1e-6:
        return [end_x, end_y]
    return [end_x + dx / length * distance, end_y + dy / length * distance]


def _connector_has_arrow_end(element: dict[str, Any]) -> bool:
    style = element.get("style", {}) or {}
    return style.get("endMarker") == "arrow"


def _looks_like_arrowhead_path(points: list[list[float]]) -> bool:
    if len(points) < 4 or len(points) % 2 != 0:
        return False
    tip = points[0]
    for index in range(0, len(points), 2):
        if points[index] != tip:
            return False
    return True


def _infer_port_name(point: list[float], bounds: dict[str, float] | None) -> str:
    if bounds is None:
        return "center"
    px, py = float(point[0]), float(point[1])
    left = abs(px - bounds["x"])
    right = abs(px - (bounds["x"] + bounds["width"]))
    top = abs(py - bounds["y"])
    bottom = abs(py - (bounds["y"] + bounds["height"]))
    nearest = min(
        (
            ("left", left),
            ("right", right),
            ("top", top),
            ("bottom", bottom),
        ),
        key=lambda item: item[1],
    )
    return nearest[0]


def _infer_shape_semantic_role(
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    style: dict[str, str],
) -> str:
    fill = str(style.get("fill", "")).strip().lower()
    stroke = str(style.get("stroke", "")).strip().lower()
    dash_array = str(style.get("stroke-dasharray", "")).strip()
    if x == 0 and y == 0 and width >= 1500 and height >= 500 and fill in ("#fff", "#ffffff", "white"):
        return "background"
    if dash_array:
        return "frame"
    if width >= 140 or height >= 120 or fill.startswith("url(#"):
        return "container"
    if stroke in ("none", "transparent") and fill in ("#fff", "#ffffff", "white"):
        return "card"
    return "shape"


def _parse_class_styles(svg_text: str) -> dict[str, dict[str, str]]:
    styles: dict[str, dict[str, str]] = {}
    for match in re.finditer(r"\.([\w-]+)\s*\{([^}]+)\}", svg_text):
        class_name = match.group(1).strip()
        declarations = _parse_inline_style(match.group(2).strip())
        if class_name:
            styles[class_name] = {
                **styles.get(class_name, {}),
                **declarations,
            }
    return styles


def _parse_inline_style(value: str | None) -> dict[str, str]:
    if not value:
        return {}
    result: dict[str, str] = {}
    for item in value.split(";"):
        if ":" not in item:
            continue
        key, raw_value = item.split(":", 1)
        key = key.strip()
        raw_value = raw_value.strip()
        if key and raw_value:
            result[key] = raw_value
    return result


def _resolve_style(node: ET.Element, class_styles: dict[str, dict[str, str]]) -> dict[str, str]:
    style: dict[str, str] = {}
    for class_name in node.attrib.get("class", "").split():
        style.update(class_styles.get(class_name, {}))
    style.update(_parse_inline_style(node.attrib.get("style")))
    for attr in (
        "fill",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "font-size",
        "font-family",
        "font-weight",
        "font-style",
        "text-anchor",
        "dominant-baseline",
        "opacity",
        "letter-spacing",
    ):
        if attr in node.attrib:
            style[attr] = node.attrib[attr]
    return style


def _extract_text_runs(
    node: ET.Element,
    class_styles: dict[str, dict[str, str]],
) -> list[dict[str, Any]] | None:
    tspan_children = [child for child in list(node) if _local_name(child.tag) == "tspan"]
    if not tspan_children:
        return None

    runs: list[dict[str, Any]] = []
    for child in tspan_children:
        text = "".join(child.itertext())
        if not text:
            continue
        child_style = _resolve_style(child, class_styles)
        run: dict[str, Any] = {
            "text": text,
        }
        run_style: dict[str, Any] = {}
        if child_style.get("font-family"):
            run_style["fontFamily"] = _resolve_font_family(child_style.get("font-family"))
        if child_style.get("font-size"):
            run_style["fontSize"] = _parse_number(child_style.get("font-size"), 16)
        if child_style.get("font-weight"):
            run_style["fontWeight"] = child_style.get("font-weight")
        if child_style.get("font-style"):
            run_style["fontStyle"] = child_style.get("font-style")
        if child_style.get("fill"):
            run_style["fill"] = child_style.get("fill")
        if child_style.get("stroke"):
            run_style["stroke"] = child_style.get("stroke")
        if child_style.get("stroke-width"):
            run_style["strokeWidth"] = _parse_number(child_style.get("stroke-width"), 0)
        if child_style.get("line-height"):
            run_style["lineHeight"] = _parse_number(child_style.get("line-height"), 1.2)
        if child_style.get("letter-spacing"):
            run_style["letterSpacing"] = _parse_number(child_style.get("letter-spacing"), 0)
        if child_style.get("opacity"):
            run_style["opacity"] = _parse_number(child_style.get("opacity"), 1)
        if run_style:
            run["style"] = run_style

        run_layout: dict[str, Any] = {}
        for key in ("x", "y", "dx", "dy"):
            if child.attrib.get(key) is not None:
                run_layout[key] = _parse_number(child.attrib.get(key), 0)
        if run_layout:
            run["layout"] = run_layout
        runs.append(run)

    return runs or None


def _extract_text_features(
    *,
    node: ET.Element,
    text_content: str,
    class_styles: dict[str, dict[str, str]],
) -> dict[str, Any]:
    style = _resolve_style(node, class_styles)
    class_list = [item for item in node.attrib.get("class", "").split() if item]
    has_tspan = any(_local_name(child.tag) == "tspan" for child in list(node))
    transform = node.attrib.get("transform", "")
    stroke = str(style.get("stroke", "")).strip().lower()
    has_stroke = bool(stroke and stroke not in ("none", "transparent"))
    has_transform = bool(transform.strip())
    has_rotation = _extract_rotation(transform) != 0
    is_placeholder_label = _is_placeholder_label(text_content)
    has_emoji = _contains_emoji(text_content)
    has_decorative_symbol = _is_decorative_symbol_text(text_content)
    text_role = _infer_text_role(class_list, text_content, has_emoji, has_decorative_symbol, is_placeholder_label)
    return {
        "rawText": text_content,
        "normalizedText": re.sub(r"\s+", " ", text_content).strip(),
        "classList": class_list,
        "fontFamilies": _split_font_family_candidates(style.get("font-family")),
        "hasTspan": has_tspan,
        "hasTransform": has_transform,
        "hasRotation": has_rotation,
        "hasStroke": has_stroke,
        "hasEmoji": has_emoji,
        "hasDecorativeSymbol": has_decorative_symbol,
        "isPlaceholderLabel": is_placeholder_label,
        "textRole": text_role,
    }


def _resolve_text_editing_mode(text_features: dict[str, Any]) -> str:
    if text_features.get("isPlaceholderLabel"):
        return "svg-fragment-text"
    if text_features.get("hasStroke"):
        return "svg-fragment-text"
    if text_features.get("hasEmoji"):
        return "svg-fragment-text"
    if text_features.get("hasDecorativeSymbol"):
        return "svg-fragment-text"
    if text_features.get("hasTspan"):
        return "svg-fragment-text"
    if text_features.get("hasRotation"):
        return "svg-fragment-text"
    return "native-text"


def _resolve_font_family(value: str | None) -> str:
    normalized = (value or "").strip()
    if not normalized:
        return DEFAULT_TEXT_FONT_FAMILY
    families = _split_font_family_candidates(normalized)
    if not families:
        return DEFAULT_TEXT_FONT_FAMILY
    if not any(item.lower() in {"serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"} for item in families):
        families.append("sans-serif")
    return ", ".join(families)


def _split_font_family_candidates(value: str | None) -> list[str]:
    if not value:
        return []
    parts = []
    for item in value.split(","):
        normalized = item.strip()
        if normalized:
            parts.append(normalized)
    deduped: list[str] = []
    seen: set[str] = set()
    for item in parts:
        lowered = item.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        deduped.append(item)
    return deduped


def _contains_emoji(value: str) -> bool:
    for char in value:
        code = ord(char)
        if 0x1F300 <= code <= 0x1FAFF or 0x2600 <= code <= 0x27BF:
            return True
    return False


def _is_decorative_symbol_text(value: str) -> bool:
    stripped = re.sub(r"\s+", "", value)
    if not stripped:
        return False
    if all(unicodedata.category(char).startswith("S") or char in {"»", "«", "•", "→", "←", "↑", "↓"} for char in stripped):
        return True
    return stripped in {"»", "«", "⚠", "✔", "✖", "➜"}


def _infer_text_role(
    class_list: list[str],
    text_content: str,
    has_emoji: bool,
    has_decorative_symbol: bool,
    is_placeholder_label: bool,
) -> str:
    if is_placeholder_label:
        return "placeholder-label"
    if has_emoji:
        return "emoji"
    if has_decorative_symbol:
        return "decorative-symbol"
    if "title" in class_list:
        return "title"
    if "body" in class_list:
        return "body"
    if text_content.startswith("(") and text_content.endswith(")"):
        return "annotation"
    return "plain"


def _parse_path_points(value: str) -> list[list[float]]:
    tokens = re.findall(r"[MLml]|-?\d*\.?\d+", value or "")
    points: list[list[float]] = []
    current_x = 0.0
    current_y = 0.0
    command = ""
    index = 0

    def push(next_x: float, next_y: float) -> None:
        nonlocal current_x, current_y
        current_x = next_x
        current_y = next_y
        point = [next_x, next_y]
        if not points or points[-1] != point:
            points.append(point)

    while index < len(tokens):
        token = tokens[index]
        if re.fullmatch(r"[MLml]", token):
            command = token
            index += 1
            continue
        if command in ("M", "L") and index + 1 < len(tokens):
            push(float(tokens[index]), float(tokens[index + 1]))
            index += 2
            continue
        if command in ("m", "l") and index + 1 < len(tokens):
            push(current_x + float(tokens[index]), current_y + float(tokens[index + 1]))
            index += 2
            continue
        index += 1
    return points


def _extract_rotation(value: str | None) -> float:
    if not value:
        return 0.0
    match = re.search(r"rotate\(\s*([-\d.]+)", value)
    if not match:
        return 0.0
    try:
        return float(match.group(1))
    except ValueError:
        return 0.0


def _node_id(node: ET.Element, prefix: str, index: int) -> str:
    raw = node.attrib.get("id")
    if raw:
        return raw.replace(" ", "-")
    return f"{prefix}-{index + 1}"


def _asset_id(label_clean: str) -> str:
    return f"asset-icon-{label_clean.lower()}"


def _safe_relpath(job_dir: Path, path: Path) -> str:
    try:
        return path.resolve().relative_to(job_dir.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def _local_name(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def _parse_number(value: Any, fallback: float = 0.0) -> float:
    if value is None or value == "":
        return fallback
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _guess_image_mime_type(path: Path) -> str:
    lowered = path.name.lower()
    if lowered.endswith(".png"):
        return "image/png"
    if lowered.endswith(".jpg") or lowered.endswith(".jpeg"):
        return "image/jpeg"
    if lowered.endswith(".webp"):
        return "image/webp"
    if lowered.endswith(".svg"):
        return "image/svg+xml"
    return "application/octet-stream"


def _is_placeholder_rect(node: ET.Element) -> bool:
    fill = (node.attrib.get("fill") or "").strip().lower()
    stroke = (node.attrib.get("stroke") or "").strip().lower()
    return fill in ("#808080", "gray", "grey") and stroke in ("black", "#000", "#000000")


def _is_placeholder_label(text: str) -> bool:
    return bool(re.fullmatch(r"<AF>\d{2}", text))
