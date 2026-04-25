from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

from autodraw.backend.app.console_encoding import configure_standard_streams
from autodraw.backend.app.pipeline import autofigure2
from autodraw.backend.app.schemas import CreateJobRequest
from autodraw.backend.app.services.pipeline_service import run_pipeline


class AlwaysFailingTextStream:
    encoding = "ascii"

    def write(self, data: str) -> int:
        raise UnicodeEncodeError("ascii", data or "x", 0, 1, "forced failure")

    def flush(self) -> None:
        raise UnicodeEncodeError("ascii", "x", 0, 1, "forced failure")


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

    def test_autodraw_defaults_to_background_removal_for_legacy_clients(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            output_dir = tmp_path / "job-output"
            log_path = output_dir / "run.log"

            request = CreateJobRequest(
                job_type="autodraw",
                method_text="legacy autodraw request",
                provider="local",
                api_key="test-key",
                base_url="http://127.0.0.1:9999/v1",
            )

            def fake_method_to_svg(**kwargs: object) -> dict[str, object]:
                self.assertTrue(kwargs["remove_background"])
                return {"figure_path": str(Path(str(kwargs["output_dir"])) / "figure.png")}

            with mock.patch(
                "autodraw.backend.app.services.pipeline_service.autofigure2.method_to_svg",
                side_effect=fake_method_to_svg,
            ):
                run_pipeline(
                    request=request,
                    output_dir=output_dir,
                    log_path=log_path,
                )

    def test_autodraw_can_explicitly_skip_background_removal(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            output_dir = tmp_path / "job-output"
            log_path = output_dir / "run.log"

            request = CreateJobRequest(
                job_type="autodraw",
                method_text="skip background removal",
                provider="local",
                api_key="test-key",
                base_url="http://127.0.0.1:9999/v1",
                remove_background=False,
            )

            def fake_method_to_svg(**kwargs: object) -> dict[str, object]:
                self.assertFalse(kwargs["remove_background"])
                return {"figure_path": str(Path(str(kwargs["output_dir"])) / "figure.png")}

            with mock.patch(
                "autodraw.backend.app.services.pipeline_service.autofigure2.method_to_svg",
                side_effect=fake_method_to_svg,
            ):
                run_pipeline(
                    request=request,
                    output_dir=output_dir,
                    log_path=log_path,
                )

    def test_autodraw_passes_background_removal_provider(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            output_dir = tmp_path / "job-output"
            log_path = output_dir / "run.log"

            request = CreateJobRequest(
                job_type="autodraw",
                method_text="remote background removal",
                provider="local",
                api_key="test-key",
                base_url="http://127.0.0.1:9999/v1",
                background_removal_provider="remote",
            )

            def fake_method_to_svg(**kwargs: object) -> dict[str, object]:
                self.assertEqual(kwargs["background_removal_provider"], "remote")
                return {
                    "figure_path": str(Path(str(kwargs["output_dir"])) / "figure.png")
                }

            with mock.patch(
                "autodraw.backend.app.services.pipeline_service.autofigure2.method_to_svg",
                side_effect=fake_method_to_svg,
            ):
                run_pipeline(
                    request=request,
                    output_dir=output_dir,
                    log_path=log_path,
                )

    def test_autodraw_remote_background_removal_skips_local_rmbg(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            output_dir = tmp_path / "job-output"
            output_dir.mkdir(parents=True, exist_ok=True)
            Image.new("RGB", (24, 16), "#ddeeff").save(
                output_dir / "figure.png", format="PNG"
            )
            Image.new("RGB", (24, 16), "#ffffff").save(
                output_dir / "samed.png", format="PNG"
            )
            (output_dir / "boxlib.json").write_text(
                json.dumps(
                    {
                        "boxes": [
                            {
                                "id": 0,
                                "label": "<AF>01",
                                "x1": 2,
                                "y1": 3,
                                "x2": 14,
                                "y2": 11,
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            calls: list[dict[str, object]] = []

            def fake_remove_background_image(**kwargs: object) -> Path:
                calls.append(kwargs)
                output_path = Path(str(kwargs["output_path"]))
                Image.new("RGBA", (12, 8), (0, 0, 0, 0)).save(
                    output_path, format="PNG"
                )
                return output_path

            with mock.patch(
                "autodraw.backend.app.pipeline.autofigure2._ensure_rmbg2_access_ready",
                side_effect=AssertionError("local RMBG should not be checked"),
            ), mock.patch(
                "autodraw.backend.app.services.background_removal_service.remove_background_image",
                side_effect=fake_remove_background_image,
            ):
                result = autofigure2.method_to_svg(
                    method_text="remote background removal",
                    output_dir=str(output_dir),
                    api_key="test-key",
                    provider="local",
                    base_url="http://127.0.0.1:9999/v1",
                    start_stage=3,
                    stop_after=3,
                    remove_background=True,
                    background_removal_provider="remote",
                )

            self.assertEqual(len(calls), 1)
            self.assertEqual(calls[0]["provider"], "remote")
            self.assertTrue(
                (output_dir / "icons" / "icon_AF01_nobg.png").is_file()
            )
            self.assertEqual(
                result["icon_infos"][0]["nobg_path"],
                str(output_dir / "icons" / "icon_AF01_nobg.png"),
            )


class TeeStreamEncodingTest(unittest.TestCase):
    def test_configures_ascii_standard_streams_to_utf8(self) -> None:
        stdout_buffer = io.BytesIO()
        stderr_buffer = io.BytesIO()
        ascii_stdout = io.TextIOWrapper(stdout_buffer, encoding="ascii")
        ascii_stderr = io.TextIOWrapper(stderr_buffer, encoding="ascii")

        with mock.patch.object(sys, "stdout", ascii_stdout), mock.patch.object(
            sys, "stderr", ascii_stderr
        ), mock.patch.object(sys, "__stdout__", ascii_stdout), mock.patch.object(
            sys, "__stderr__", ascii_stderr
        ):
            configure_standard_streams()
            sys.stdout.write("对象\n")
            sys.stderr.write("错误\n")
            sys.stdout.flush()
            sys.stderr.flush()

        self.assertEqual(stdout_buffer.getvalue().decode("utf-8"), "对象\n")
        self.assertEqual(stderr_buffer.getvalue().decode("utf-8"), "错误\n")

    def test_autofigure2_import_configures_ascii_stdout(self) -> None:
        env = os.environ.copy()
        env.update({
            "LC_ALL": "C",
            "LANG": "C",
            "PYTHONUTF8": "0",
            "PYTHONIOENCODING": "ascii",
        })
        code = (
            "import sys; "
            "before=sys.stdout.encoding; "
            "import autodraw.backend.app.pipeline.autofigure2; "
            "print(before); "
            "print(sys.stdout.encoding); "
            "print('对象')"
        )

        result = subprocess.run(
            [sys.executable, "-c", code],
            check=True,
            capture_output=True,
            env=env,
            text=True,
        )

        lines = result.stdout.strip().splitlines()
        self.assertEqual(lines, ["ascii", "utf-8", "对象"])

    def test_ascii_stdout_falls_back_without_crashing(self) -> None:
        from autodraw.backend.app.services.pipeline_service import TeeStream

        ascii_buffer = io.BytesIO()
        ascii_stream = io.TextIOWrapper(ascii_buffer, encoding="ascii")
        utf8_buffer = io.BytesIO()
        utf8_stream = io.TextIOWrapper(utf8_buffer, encoding="utf-8")

        tee = TeeStream(ascii_stream, utf8_stream)
        tee.write("原图尺寸: 1376 x 768\n")
        ascii_stream.flush()
        utf8_stream.flush()

        ascii_text = ascii_buffer.getvalue().decode("ascii")
        utf8_text = utf8_buffer.getvalue().decode("utf-8")

        self.assertIn(r"\u539f", ascii_text)
        self.assertIn("原图尺寸", utf8_text)

    def test_teestream_continues_when_one_stream_rejects_all_writes(self) -> None:
        from autodraw.backend.app.services.pipeline_service import TeeStream

        utf8_buffer = io.BytesIO()
        utf8_stream = io.TextIOWrapper(utf8_buffer, encoding="utf-8")

        tee = TeeStream(AlwaysFailingTextStream(), utf8_stream)
        tee.write("    对象 1: 原图尺寸\n")
        tee.flush()
        utf8_stream.flush()

        self.assertEqual(
            utf8_buffer.getvalue().decode("utf-8"),
            "    对象 1: 原图尺寸\n",
        )

    def test_run_pipeline_continues_when_console_rejects_unicode_logs(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            output_dir = tmp_path / "job-output"
            log_path = output_dir / "run.log"

            request = CreateJobRequest(
                job_type="autodraw",
                method_text="unicode console failure",
                provider="local",
                api_key="test-key",
                base_url="http://127.0.0.1:9999/v1",
            )

            def fake_method_to_svg(**kwargs: object) -> dict[str, object]:
                print("步骤二：SAM3 分割 + 灰色填充+黑色边框+序号标记")
                print("    对象 1: 原图尺寸")
                return {
                    "figure_path": str(
                        Path(str(kwargs["output_dir"])) / "figure.png"
                    )
                }

            with mock.patch.object(sys, "stdout", AlwaysFailingTextStream()), mock.patch(
                "autodraw.backend.app.services.pipeline_service.autofigure2.method_to_svg",
                side_effect=fake_method_to_svg,
            ):
                result = run_pipeline(
                    request=request,
                    output_dir=output_dir,
                    log_path=log_path,
                )

            self.assertEqual(result["figure_path"], str(output_dir / "figure.png"))
            log_text = log_path.read_text(encoding="utf-8")
            self.assertIn("步骤二：SAM3 分割", log_text)
            self.assertIn("对象 1", log_text)

    def test_segment_with_sam3_tolerates_ascii_stdout_logs(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            image_path = tmp_path / "figure.png"
            output_dir = tmp_path / "output"
            Image.new("RGB", (40, 24), "#ddeeff").save(image_path, format="PNG")

            ascii_buffer = io.BytesIO()
            ascii_stdout = io.TextIOWrapper(ascii_buffer, encoding="ascii")

            fake_response = {
                "metadata": [
                    {
                        "box": [0.5, 0.5, 0.5, 0.5],
                        "score": 0.95,
                    }
                ]
            }

            with mock.patch.object(sys, "stdout", ascii_stdout), mock.patch(
                "autodraw.backend.app.pipeline.autofigure2._prepare_remote_sam3_upload",
                return_value=(
                    "https://example.com/input.png",
                    {
                        "original_width": 40,
                        "original_height": 24,
                        "sent_width": 40,
                        "sent_height": 24,
                        "payload_bytes": 1234,
                        "transport": "mock",
                    },
                ),
            ), mock.patch(
                "autodraw.backend.app.pipeline.autofigure2._call_sam3_api",
                return_value=fake_response,
            ):
                samed_path, boxlib_path, valid_boxes = autofigure2.segment_with_sam3(
                    image_path=str(image_path),
                    output_dir=str(output_dir),
                    text_prompts="icon,person",
                    sam_backend="fal",
                    merge_threshold=0,
                )

            ascii_stdout.flush()
            ascii_text = ascii_buffer.getvalue().decode("ascii")

            self.assertTrue(Path(samed_path).is_file())
            self.assertTrue(Path(boxlib_path).is_file())
            self.assertEqual(len(valid_boxes), 2)
            self.assertIn(r"\u6b65\u9aa4", ascii_text)
            self.assertIn(r"\u539f\u56fe\u5c3a\u5bf8", ascii_text)


if __name__ == "__main__":
    unittest.main()
