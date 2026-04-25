from __future__ import annotations

import base64
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

from autodraw.backend.app.schemas import CreateJobRequest
from autodraw.backend.app.services.image_edit_service import run_image_edit


class FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = "") -> None:
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self) -> dict:
        return self._payload

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(self.text or f"HTTP {self.status_code}")


class CreateJobRequestTest(unittest.TestCase):
    def test_image_edit_requires_prompt_and_source_path(self) -> None:
        request = CreateJobRequest(
            job_type="image-edit",
            prompt="turn it blue",
            source_image_path="/tmp/source.png",
        )

        self.assertEqual(request.job_type, "image-edit")
        self.assertIsNone(request.method_text)


class RunImageEditTest(unittest.TestCase):
    def test_run_image_edit_writes_source_and_result_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            source_path = tmp_path / "input.jpg"
            log_path = tmp_path / "run.log"
            log_path.write_text("", encoding="utf-8")

            Image.new("RGB", (12, 8), "#88aaff").save(source_path, format="JPEG")

            buffer_path = tmp_path / "result.png"
            Image.new("RGBA", (12, 8), "#112233").save(buffer_path, format="PNG")
            image_base64 = base64.b64encode(buffer_path.read_bytes()).decode("utf-8")

            class FakeImages:
                def edit(self, **_: object) -> object:
                    return types.SimpleNamespace(
                        data=[types.SimpleNamespace(b64_json=image_base64)]
                    )

            class FakeOpenAI:
                def __init__(self, **_: object) -> None:
                    self.images = FakeImages()

            fake_openai_module = types.SimpleNamespace(OpenAI=FakeOpenAI)

            request = CreateJobRequest(
                job_type="image-edit",
                prompt="make it sharper",
                source_image_path=str(source_path),
                provider="local",
                api_key="test-key",
                base_url="http://127.0.0.1:9999/v1",
                image_model="gpt-image-1.5",
            )

            with mock.patch.dict(sys.modules, {"openai": fake_openai_module}):
                result = run_image_edit(
                    request=request,
                    output_dir=tmp_path,
                    log_path=log_path,
                )

            self.assertTrue((tmp_path / "source.png").is_file())
            self.assertTrue((tmp_path / "edited.png").is_file())
            self.assertEqual(result["provider"], "local")
            self.assertEqual(result["model"], "gpt-image-1.5")

    def test_run_image_edit_cleans_low_alpha_noise(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            source_path = tmp_path / "input.png"
            log_path = tmp_path / "run.log"
            log_path.write_text("", encoding="utf-8")

            Image.new("RGBA", (2, 2), (255, 255, 255, 255)).save(
                source_path, format="PNG"
            )

            raw_result = Image.new("RGBA", (2, 2))
            raw_result.putdata(
                [
                    (255, 0, 0, 0),
                    (0, 255, 0, 4),
                    (20, 30, 40, 30),
                    (10, 20, 30, 255),
                ]
            )
            buffer_path = tmp_path / "result.png"
            raw_result.save(buffer_path, format="PNG")
            image_base64 = base64.b64encode(buffer_path.read_bytes()).decode("utf-8")

            class FakeImages:
                def edit(self, **_: object) -> object:
                    return types.SimpleNamespace(
                        data=[types.SimpleNamespace(b64_json=image_base64)]
                    )

            class FakeOpenAI:
                def __init__(self, **_: object) -> None:
                    self.images = FakeImages()

            fake_openai_module = types.SimpleNamespace(OpenAI=FakeOpenAI)

            request = CreateJobRequest(
                job_type="image-edit",
                prompt="clean transparency",
                source_image_path=str(source_path),
                provider="local",
                api_key="test-key",
                base_url="http://127.0.0.1:9999/v1",
                image_model="gpt-image-1.5",
            )

            with mock.patch.dict(sys.modules, {"openai": fake_openai_module}):
                run_image_edit(
                    request=request,
                    output_dir=tmp_path,
                    log_path=log_path,
                )

            with Image.open(tmp_path / "edited.png") as edited:
                pixels = list(edited.convert("RGBA").getdata())

            self.assertEqual(pixels[0], (0, 0, 0, 0))
            self.assertEqual(pixels[1], (0, 0, 0, 0))
            self.assertEqual(pixels[2], (20, 30, 40, 30))
            self.assertEqual(pixels[3], (10, 20, 30, 255))
            log_text = log_path.read_text(encoding="utf-8")
            self.assertIn("thresholded_pixels=1", log_text)

    def test_run_image_edit_can_remove_background_after_generation(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            source_path = tmp_path / "input.png"
            log_path = tmp_path / "run.log"
            log_path.write_text("", encoding="utf-8")

            Image.new("RGBA", (12, 8), "#ffffff").save(source_path, format="PNG")

            raw_result_path = tmp_path / "result.png"
            Image.new("RGBA", (12, 8), "#224466").save(raw_result_path, format="PNG")
            image_base64 = base64.b64encode(raw_result_path.read_bytes()).decode(
                "utf-8"
            )

            class FakeImages:
                def edit(self, **_: object) -> object:
                    return types.SimpleNamespace(
                        data=[types.SimpleNamespace(b64_json=image_base64)]
                    )

            class FakeOpenAI:
                def __init__(self, **_: object) -> None:
                    self.images = FakeImages()

            fake_openai_module = types.SimpleNamespace(OpenAI=FakeOpenAI)

            def fake_remove_background_image(**kwargs: object) -> Path:
                output_path = kwargs["output_path"]
                Image.new("RGBA", (12, 8), (34, 68, 102, 0)).save(
                    output_path, format="PNG"
                )
                return output_path

            request = CreateJobRequest(
                job_type="image-edit",
                prompt="remove the background",
                source_image_path=str(source_path),
                provider="local",
                api_key="test-key",
                base_url="http://127.0.0.1:9999/v1",
                image_model="gpt-image-1.5",
                remove_background=True,
                rmbg_model_path="/tmp/rmbg",
            )

            with mock.patch.dict(sys.modules, {"openai": fake_openai_module}):
                with mock.patch(
                    "autodraw.backend.app.services.image_edit_service.remove_background_image",
                    side_effect=fake_remove_background_image,
                ) as remove_background_mock:
                    run_image_edit(
                        request=request,
                        output_dir=tmp_path,
                        log_path=log_path,
                    )

            remove_background_mock.assert_called_once()
            self.assertEqual(
                remove_background_mock.call_args.kwargs["rmbg_model_path"], "/tmp/rmbg"
            )
            with Image.open(tmp_path / "edited.png") as edited:
                self.assertEqual(edited.convert("RGBA").getpixel((0, 0)), (34, 68, 102, 0))
            log_text = log_path.read_text(encoding="utf-8")
            self.assertIn("[image-edit] remove_background=true", log_text)

    def test_qingyun_image_edit_uses_chat_completions_generation_flow(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            source_path = tmp_path / "input.png"
            log_path = tmp_path / "run.log"
            log_path.write_text("", encoding="utf-8")

            Image.new("RGBA", (16, 10), "#88aaff").save(source_path, format="PNG")

            result_path = tmp_path / "generated.png"
            Image.new("RGBA", (16, 10), "#223344").save(result_path, format="PNG")
            image_base64 = base64.b64encode(result_path.read_bytes()).decode("utf-8")

            def fake_post(
                url: str,
                *,
                headers: dict | None = None,
                json: dict | None = None,
                timeout: int | None = None,
                params: dict | None = None,
            ) -> FakeResponse:
                self.assertEqual(url, "https://api.qingyuntop.top/v1/chat/completions")
                self.assertEqual(headers["Authorization"], "Bearer test-key")
                self.assertEqual(json["model"], "gemini-3.1-flash-image-preview")
                self.assertEqual(json["modalities"], ["image"])
                self.assertEqual(json["stream"], False)
                self.assertIsNone(params)
                content = json["messages"][0]["content"]
                self.assertEqual(content[0]["type"], "text")
                self.assertEqual(content[0]["text"], "make it cinematic")
                self.assertEqual(content[1]["type"], "image_url")
                self.assertTrue(
                    content[1]["image_url"]["url"].startswith("data:image/png;base64,")
                )
                self.assertEqual(timeout, 300)
                return FakeResponse(
                    200,
                    {
                        "choices": [
                            {
                                "message": {
                                    "content": (
                                        "![generated]"
                                        f"(data:image/png;base64,{image_base64})"
                                    )
                                }
                            }
                        ]
                    },
                )

            request = CreateJobRequest(
                job_type="image-edit",
                prompt="make it cinematic",
                source_image_path=str(source_path),
                provider="qingyun",
                api_key="test-key",
                base_url="https://api.qingyuntop.top/v1",
                image_model="gemini-3.1-flash-image-preview",
            )

            with mock.patch("autodraw.backend.app.services.image_edit_service.requests.post", side_effect=fake_post):
                result = run_image_edit(
                    request=request,
                    output_dir=tmp_path,
                    log_path=log_path,
                )

            self.assertTrue((tmp_path / "edited.png").is_file())
            self.assertEqual(result["provider"], "qingyun")
            self.assertEqual(result["model"], "gemini-3.1-flash-image-preview")
            log_text = log_path.read_text(encoding="utf-8")
            self.assertIn("[image-edit] route=qingyun-chat-completions", log_text)

    def test_qingyun_image_edit_falls_back_to_native_generation(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            source_path = tmp_path / "input.png"
            log_path = tmp_path / "run.log"
            log_path.write_text("", encoding="utf-8")

            Image.new("RGBA", (16, 10), "#88aaff").save(source_path, format="PNG")

            result_path = tmp_path / "generated.png"
            Image.new("RGBA", (16, 10), "#556677").save(result_path, format="PNG")
            image_base64 = base64.b64encode(result_path.read_bytes()).decode("utf-8")
            call_urls: list[str] = []

            def fake_post(
                url: str,
                *,
                headers: dict | None = None,
                json: dict | None = None,
                timeout: int | None = None,
                params: dict | None = None,
            ) -> FakeResponse:
                call_urls.append(url)
                self.assertEqual(timeout, 300)
                if url.endswith("/chat/completions"):
                    return FakeResponse(
                        500,
                        {"error": {"message": "not supported model for image generation"}},
                        "not supported model for image generation",
                    )
                self.assertEqual(
                    url,
                    "https://api.qingyuntop.top/v1beta/models/gemini-3.1-flash-image-preview:generateContent",
                )
                self.assertEqual(params, {"key": "test-key"})
                self.assertEqual(headers["Authorization"], "Bearer test-key")
                self.assertEqual(
                    json["generationConfig"]["responseModalities"],
                    ["TEXT", "IMAGE"],
                )
                return FakeResponse(
                    200,
                    {
                        "candidates": [
                            {
                                "content": {
                                    "parts": [
                                        {
                                            "inline_data": {
                                                "mime_type": "image/png",
                                                "data": image_base64,
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                )

            request = CreateJobRequest(
                job_type="image-edit",
                prompt="make it futuristic",
                source_image_path=str(source_path),
                provider="qingyun",
                api_key="test-key",
                base_url="https://api.qingyuntop.top/v1",
                image_model="gemini-3.1-flash-image-preview",
            )

            with mock.patch("autodraw.backend.app.services.image_edit_service.requests.post", side_effect=fake_post):
                result = run_image_edit(
                    request=request,
                    output_dir=tmp_path,
                    log_path=log_path,
                )

            self.assertEqual(len(call_urls), 2)
            self.assertTrue((tmp_path / "edited.png").is_file())
            self.assertEqual(result["provider"], "qingyun")
            log_text = log_path.read_text(encoding="utf-8")
            self.assertIn("qingyun_chat_error=", log_text)
            self.assertIn("[image-edit] route=qingyun-gemini-native", log_text)


    def test_run_image_edit_uses_remote_background_removal_provider(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            source_path = tmp_path / "input.png"
            log_path = tmp_path / "run.log"
            log_path.write_text("", encoding="utf-8")

            Image.new("RGBA", (12, 8), "#ffffff").save(source_path, format="PNG")

            raw_result_path = tmp_path / "result.png"
            Image.new("RGBA", (12, 8), "#224466").save(raw_result_path, format="PNG")
            image_base64 = base64.b64encode(raw_result_path.read_bytes()).decode("utf-8")

            class FakeImages:
                def edit(self, **_: object) -> object:
                    return types.SimpleNamespace(
                        data=[types.SimpleNamespace(b64_json=image_base64)]
                    )

            class FakeOpenAI:
                def __init__(self, **_: object) -> None:
                    self.images = FakeImages()

            fake_openai_module = types.SimpleNamespace(OpenAI=FakeOpenAI)

            def fake_remove_background_image(**kwargs: object) -> Path:
                output_path = kwargs["output_path"]
                self.assertEqual(kwargs["provider"], "remote")
                Image.new("RGBA", (12, 8), (34, 68, 102, 0)).save(
                    output_path, format="PNG"
                )
                return output_path

            request = CreateJobRequest(
                job_type="image-edit",
                prompt="remove the background remotely",
                source_image_path=str(source_path),
                provider="local",
                api_key="test-key",
                base_url="http://127.0.0.1:9999/v1",
                image_model="gpt-image-1.5",
                remove_background=True,
                background_removal_provider="remote",
            )

            with mock.patch.dict(sys.modules, {"openai": fake_openai_module}):
                with mock.patch(
                    "autodraw.backend.app.services.image_edit_service.remove_background_image",
                    side_effect=fake_remove_background_image,
                ) as remove_background_mock:
                    run_image_edit(
                        request=request,
                        output_dir=tmp_path,
                        log_path=log_path,
                    )

            remove_background_mock.assert_called_once()
            self.assertEqual(
                remove_background_mock.call_args.kwargs["provider"], "remote"
            )
            log_text = log_path.read_text(encoding="utf-8")
            self.assertIn("[image-edit] remove_background=true", log_text)


if __name__ == "__main__":
    unittest.main()
