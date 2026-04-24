from __future__ import annotations

import sys
import types
import unittest
from unittest import mock

from PIL import Image

from autodraw.backend.app.pipeline.autofigure2 import (
    _call_sam3_api,
    _get_sam3_fal_application,
    _prepare_remote_sam3_upload,
)


class _FakeSyncClient:
    instances: list["_FakeSyncClient"] = []

    def __init__(self, key=None, default_timeout=None) -> None:
        self.key = key
        self.default_timeout = default_timeout
        self.upload_calls = []
        self.subscribe_calls = []
        _FakeSyncClient.instances.append(self)

    def upload(self, data, content_type, file_name=None, **kwargs):
        self.upload_calls.append(
            {
                "data": data,
                "content_type": content_type,
                "file_name": file_name,
                "kwargs": kwargs,
            }
        )
        return "https://v3.fal.media/files/test/sam3-input.jpg"

    def subscribe(self, application, **kwargs):
        self.subscribe_calls.append(
            {
                "application": application,
                "kwargs": kwargs,
            }
        )
        return {"predictions": []}


class Sam3FalClientTest(unittest.TestCase):
    def setUp(self) -> None:
        _FakeSyncClient.instances.clear()

    def test_get_sam3_fal_application_parses_model_path(self) -> None:
        with mock.patch(
            "autodraw.backend.app.pipeline.autofigure2.SAM3_FAL_API_URL",
            "https://fal.run/fal-ai/sam-3-1/image",
        ):
            self.assertEqual(_get_sam3_fal_application(), "fal-ai/sam-3-1/image")

        with mock.patch(
            "autodraw.backend.app.pipeline.autofigure2.SAM3_FAL_API_URL",
            "fal-ai/sam-3-1/image",
        ):
            self.assertEqual(_get_sam3_fal_application(), "fal-ai/sam-3-1/image")

    def test_prepare_remote_sam3_upload_uses_fal_client_upload(self) -> None:
        fake_module = types.SimpleNamespace(SyncClient=_FakeSyncClient)
        image = Image.new("RGB", (2400, 1200), color="white")

        with mock.patch.dict(sys.modules, {"fal_client": fake_module}):
            remote_url, meta = _prepare_remote_sam3_upload(
                image,
                api_key="test-key",
                max_side=1024,
                jpeg_quality=80,
            )

        self.assertEqual(remote_url, "https://v3.fal.media/files/test/sam3-input.jpg")
        self.assertEqual(meta["sent_width"], 1024)
        self.assertEqual(meta["sent_height"], 512)
        self.assertEqual(meta["transport"], "fal-cdn-url")
        client = _FakeSyncClient.instances[-1]
        self.assertEqual(client.key, "test-key")
        self.assertEqual(client.upload_calls[0]["content_type"], "image/jpeg")
        self.assertEqual(client.upload_calls[0]["file_name"], "sam3-input.jpg")
        self.assertGreater(len(client.upload_calls[0]["data"]), 0)

    def test_call_sam3_api_uses_subscribe_with_uploaded_url(self) -> None:
        fake_module = types.SimpleNamespace(SyncClient=_FakeSyncClient)
        with mock.patch.dict(sys.modules, {"fal_client": fake_module}), mock.patch(
            "autodraw.backend.app.pipeline.autofigure2.SAM3_FAL_PROXY_BASE_URL",
            "",
        ), mock.patch(
            "autodraw.backend.app.pipeline.autofigure2.SAM3_FAL_API_URL",
            "https://fal.run/fal-ai/sam-3-1/image",
        ):
            result = _call_sam3_api(
                image_url="https://v3.fal.media/files/test/sam3-input.jpg",
                prompt="icon",
                api_key="test-key",
                max_masks=8,
            )

        self.assertEqual(result, {"predictions": []})
        client = _FakeSyncClient.instances[-1]
        self.assertEqual(client.subscribe_calls[0]["application"], "fal-ai/sam-3-1/image")
        self.assertEqual(
            client.subscribe_calls[0]["kwargs"]["arguments"]["image_url"],
            "https://v3.fal.media/files/test/sam3-input.jpg",
        )
        self.assertEqual(client.subscribe_calls[0]["kwargs"]["arguments"]["prompt"], "icon")
        self.assertEqual(client.subscribe_calls[0]["kwargs"]["arguments"]["max_masks"], 8)


if __name__ == "__main__":
    unittest.main()
