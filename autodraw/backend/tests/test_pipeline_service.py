from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

from autodraw.backend.app.schemas import CreateJobRequest
from autodraw.backend.app.services.pipeline_service import run_pipeline


class RunPipelineSourceFigureTest(unittest.TestCase):
    def test_source_figure_is_prepared_as_png_before_stage_two(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            source_path = tmp_path / "source.jpg"
            output_dir = tmp_path / "job-output"
            log_path = output_dir / "run.log"

            Image.new("RGB", (18, 12), "#88aaff").save(source_path, format="JPEG")

            request = CreateJobRequest(
                job_type="autodraw",
                source_figure_path=str(source_path),
                provider="local",
                api_key="test-key",
                base_url="http://127.0.0.1:9999/v1",
                start_stage=2,
                sam_prompt="icon,diagram",
            )

            def fake_method_to_svg(**kwargs: object) -> dict[str, object]:
                figure_path = Path(str(kwargs["output_dir"])) / "figure.png"
                self.assertTrue(figure_path.is_file())
                self.assertEqual(kwargs["start_stage"], 2)
                self.assertEqual(kwargs["sam_prompts"], "icon,diagram")
                with Image.open(figure_path) as prepared:
                    self.assertEqual(prepared.format, "PNG")
                    self.assertEqual(prepared.size, (18, 12))
                return {"figure_path": str(figure_path)}

            with mock.patch(
                "autodraw.backend.app.services.pipeline_service.autofigure2.method_to_svg",
                side_effect=fake_method_to_svg,
            ) as method_to_svg_mock:
                result = run_pipeline(
                    request=request,
                    output_dir=output_dir,
                    log_path=log_path,
                )

            method_to_svg_mock.assert_called_once()
            self.assertEqual(result["figure_path"], str(output_dir / "figure.png"))
            log_text = log_path.read_text(encoding="utf-8")
            self.assertIn("[meta] source_figure_path=", log_text)
            self.assertIn("[meta] prepared_source_figure=", log_text)

    def test_direct_svg_source_figure_prepares_no_icon_context(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            source_path = tmp_path / "source.jpg"
            output_dir = tmp_path / "job-output"
            log_path = output_dir / "run.log"

            Image.new("RGB", (20, 14), "#f0c18a").save(source_path, format="JPEG")

            request = CreateJobRequest(
                job_type="autodraw",
                source_figure_path=str(source_path),
                source_processing_mode="direct_svg",
                provider="local",
                api_key="test-key",
                base_url="http://127.0.0.1:9999/v1",
                start_stage=4,
                sam_prompt="icon,diagram",
            )

            def fake_method_to_svg(**kwargs: object) -> dict[str, object]:
                figure_path = Path(str(kwargs["output_dir"])) / "figure.png"
                samed_path = Path(str(kwargs["output_dir"])) / "samed.png"
                boxlib_path = Path(str(kwargs["output_dir"])) / "boxlib.json"
                self.assertTrue(figure_path.is_file())
                self.assertTrue(samed_path.is_file())
                self.assertTrue(boxlib_path.is_file())
                self.assertEqual(kwargs["start_stage"], 4)

                with Image.open(samed_path) as prepared_samed:
                    self.assertEqual(prepared_samed.format, "PNG")
                    self.assertEqual(prepared_samed.size, (20, 14))

                boxlib = json.loads(boxlib_path.read_text(encoding="utf-8"))
                self.assertEqual(boxlib["boxes"], [])
                self.assertTrue(boxlib["no_icon_mode"])
                return {"figure_path": str(figure_path), "samed_path": str(samed_path)}

            with mock.patch(
                "autodraw.backend.app.services.pipeline_service.autofigure2.method_to_svg",
                side_effect=fake_method_to_svg,
            ) as method_to_svg_mock:
                result = run_pipeline(
                    request=request,
                    output_dir=output_dir,
                    log_path=log_path,
                )

            method_to_svg_mock.assert_called_once()
            self.assertEqual(result["figure_path"], str(output_dir / "figure.png"))
            self.assertEqual(result["samed_path"], str(output_dir / "samed.png"))
            log_text = log_path.read_text(encoding="utf-8")
            self.assertIn("[meta] source_processing_mode=direct_svg", log_text)
            self.assertIn("[meta] prepared_direct_svg_boxlib=", log_text)


if __name__ == "__main__":
    unittest.main()
