from __future__ import annotations

import base64
import unittest
from unittest import mock

from autodraw.backend.app.pipeline.autofigure2 import call_llm_image_generation


class _FakeResponse:
    def __init__(self, status_code: int, json_payload: dict, text: str = "") -> None:
        self.status_code = status_code
        self._json_payload = json_payload
        self.text = text
        self.content = b""

    def json(self) -> dict:
        return self._json_payload


class QingyunImagesGenerationsTest(unittest.TestCase):
    def test_qingyun_gpt_image_2_all_uses_images_generations_endpoint(self) -> None:
        # 1x1 transparent PNG
        png_b64 = (
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP8"
            "z/C/HwAFgwJ/lR7S2wAAAABJRU5ErkJggg=="
        )
        expected_bytes = base64.b64decode(png_b64)

        def fake_post(url: str, **kwargs):
            self.assertTrue(url.endswith("/v1/images/generations") or url.endswith("/images/generations"))
            payload = kwargs.get("json")
            self.assertIsInstance(payload, dict)
            self.assertEqual(payload.get("model"), "gpt-image-2-all")
            self.assertEqual(payload.get("response_format"), "b64_json")
            return _FakeResponse(
                200,
                {"data": [{"b64_json": png_b64}]},
            )

        with mock.patch(
            "autodraw.backend.app.pipeline.autofigure2.requests.post",
            side_effect=fake_post,
        ) as post_mock:
            image = call_llm_image_generation(
                prompt="draw a simple diagram",
                api_key="test-key",
                model="gpt-image-2-all",
                base_url="https://api.qingyuntop.top/v1",
                provider="qingyun",
                reference_image=None,
                image_size="4K",
            )

        self.assertIsNotNone(image)
        buf = image.tobytes()
        # PIL may convert modes; we only assert that an image object was produced and request was made.
        self.assertTrue(post_mock.called)
        self.assertGreater(len(buf), 0)
        self.assertGreater(len(expected_bytes), 0)


if __name__ == "__main__":
    unittest.main()
