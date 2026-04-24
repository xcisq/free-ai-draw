from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

from autodraw.backend.app.pipeline.autofigure2 import (
    _prepare_svg_multimodal_image,
    generate_svg_template,
)


class SvgPayloadTest(unittest.TestCase):
    def test_prepare_svg_multimodal_image_shrinks_long_edge(self) -> None:
        image = Image.new("RGBA", (2400, 1200), color=(255, 255, 255, 255))

        prepared = _prepare_svg_multimodal_image(image, max_edge=1024)

        self.assertEqual(prepared.mode, "RGB")
        self.assertEqual(max(prepared.size), 1024)

    def test_label_mode_uses_box_summary_without_samed_image_payload(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            figure_path = root / "figure.png"
            samed_path = root / "samed.png"
            boxlib_path = root / "boxlib.json"
            output_path = root / "template.svg"

            Image.new("RGB", (1600, 800), color="white").save(figure_path)
            Image.new("RGB", (1600, 800), color="gray").save(samed_path)
            boxlib_path.write_text(
                (
                    '{\n'
                    '  "boxes": [\n'
                    '    {"id": 0, "label": "<AF>01", "x1": 100, "y1": 50, "x2": 180, "y2": 130}\n'
                    "  ]\n"
                    "}\n"
                ),
                encoding="utf-8",
            )

            captured: dict[str, object] = {}

            def fake_call_llm_multimodal(**kwargs):
                captured["contents"] = kwargs["contents"]
                return "<svg viewBox='0 0 1600 800' width='1600' height='800'></svg>"

            with mock.patch.dict(
                os.environ,
                {"SVG_MULTIMODAL_IMAGE_MAX_EDGE": "1024"},
                clear=False,
            ), mock.patch(
                "autodraw.backend.app.pipeline.autofigure2.call_llm_multimodal",
                side_effect=fake_call_llm_multimodal,
            ), mock.patch(
                "autodraw.backend.app.pipeline.autofigure2.check_and_fix_svg",
                side_effect=lambda **kwargs: kwargs["svg_code"],
            ):
                generate_svg_template(
                    figure_path=str(figure_path),
                    samed_path=str(samed_path),
                    boxlib_path=str(boxlib_path),
                    output_path=str(output_path),
                    api_key="test-key",
                    model="gemini-3.1-pro-preview",
                    base_url="https://api.qingyuntop.top/v1",
                    provider="qingyun",
                    placeholder_mode="label",
                    no_icon_mode=False,
                )

            contents = captured["contents"]
            self.assertIsInstance(contents, list)
            self.assertEqual(len(contents), 2)
            prompt_text = contents[0]
            prompt_image = contents[1]
            self.assertIsInstance(prompt_text, str)
            self.assertIn("ICON BOX SUMMARY", prompt_text)
            self.assertIn("<AF>01: x=100, y=50, width=80, height=80", prompt_text)
            self.assertIsInstance(prompt_image, Image.Image)
            self.assertEqual(max(prompt_image.size), 1024)


if __name__ == "__main__":
    unittest.main()
