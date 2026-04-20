from __future__ import annotations

import shutil
from pathlib import Path
from typing import Callable

from PIL import Image


LogWriter = Callable[[str], None]


def remove_background_image(
    *,
    source_path: Path,
    output_path: Path,
    rmbg_model_path: str | None = None,
    log: LogWriter | None = None,
) -> Path:
    if not source_path.is_file():
        raise FileNotFoundError(f"待去背景图片不存在：{source_path}")

    from ..pipeline.autofigure2 import BriaRMBG2Remover, _ensure_rmbg2_access_ready

    _ensure_rmbg2_access_ready(rmbg_model_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    remover = BriaRMBG2Remover(
        model_path=rmbg_model_path,
        output_dir=output_path.parent,
    )

    if log:
        log("[image-edit] background_removal=started")

    try:
        with Image.open(source_path) as image:
            generated_path = Path(
                remover.remove_background(image, output_path.stem)
            )
        if generated_path.resolve() != output_path.resolve():
            shutil.move(str(generated_path), output_path)
        if log:
            log(f"[image-edit] background_removal=done path={output_path.name}")
        return output_path
    finally:
        del remover
