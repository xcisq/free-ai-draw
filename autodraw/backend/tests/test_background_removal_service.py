from __future__ import annotations

import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

from autodraw.backend.app.services.background_removal_service import (
    remove_background_image,
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
        return "https://v3.fal.media/files/test/background-input.png"

    def subscribe(self, application, **kwargs):
        self.subscribe_calls.append(
            {
                "application": application,
                "kwargs": kwargs,
            }
        )
        return {
            "image": {
                "url": "https://files.example.com/background-removed.png",
            }
        }


class _FakeResponse:
    def __init__(self, content: bytes, status_code: int = 200, text: str = "") -> None:
        self.content = content
        self.status_code = status_code
        self.text = text

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(self.text or f"HTTP {self.status_code}")


class BackgroundRemovalServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        _FakeSyncClient.instances.clear()

    def test_remote_provider_uses_fal_birefnet_and_downloads_result(self) -> None:
        fake_module = types.SimpleNamespace(SyncClient=_FakeSyncClient)
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            source_path = tmp_path / 'input.png'
            output_path = tmp_path / 'output.png'
            Image.new('RGBA', (8, 6), '#88aaff').save(source_path, format='PNG')

            with mock.patch.dict(sys.modules, {'fal_client': fake_module}), mock.patch(
                'autodraw.backend.app.services.background_removal_service.requests.get',
                return_value=_FakeResponse(b'png-binary'),
            ) as get_mock, mock.patch.dict(
                'os.environ',
                {
                    'BACKGROUND_REMOVAL_FAL_MODEL': 'fal-ai/birefnet',
                    'BACKGROUND_REMOVAL_FAL_MODEL_VARIANT': 'Portrait',
                    'BACKGROUND_REMOVAL_FAL_OPERATING_RESOLUTION': '2048x2048',
                    'BACKGROUND_REMOVAL_FAL_REFINE_FOREGROUND': 'false',
                },
                clear=False,
            ):
                result = remove_background_image(
                    source_path=source_path,
                    output_path=output_path,
                    provider='remote',
                    remote_api_key='test-fal-key',
                    remote_format='png',
                )

            self.assertEqual(result, output_path)
            self.assertEqual(output_path.read_bytes(), b'png-binary')
            client = _FakeSyncClient.instances[-1]
            self.assertEqual(client.key, 'test-fal-key')
            self.assertEqual(client.upload_calls[0]['file_name'], 'input.png')
            self.assertEqual(
                client.subscribe_calls[0]['application'],
                'fal-ai/birefnet',
            )
            arguments = client.subscribe_calls[0]['kwargs']['arguments']
            self.assertEqual(arguments['image_url'], 'https://v3.fal.media/files/test/background-input.png')
            self.assertEqual(arguments['output_format'], 'png')
            self.assertEqual(arguments['model'], 'Portrait')
            self.assertEqual(arguments['operating_resolution'], '2048x2048')
            self.assertFalse(arguments['refine_foreground'])
            get_mock.assert_called_once_with(
                'https://files.example.com/background-removed.png',
                timeout=300,
            )

    def test_remote_provider_requires_result_url(self) -> None:
        class _BrokenSyncClient(_FakeSyncClient):
            def subscribe(self, application, **kwargs):
                self.subscribe_calls.append(
                    {
                        'application': application,
                        'kwargs': kwargs,
                    }
                )
                return {'image': {}}

        fake_module = types.SimpleNamespace(SyncClient=_BrokenSyncClient)
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            source_path = tmp_path / 'input.png'
            output_path = tmp_path / 'output.png'
            Image.new('RGBA', (8, 6), '#88aaff').save(source_path, format='PNG')

            with mock.patch.dict(sys.modules, {'fal_client': fake_module}):
                with self.assertRaisesRegex(RuntimeError, '缺少可下载的图片 URL'):
                    remove_background_image(
                        source_path=source_path,
                        output_path=output_path,
                        provider='remote',
                        remote_api_key='test-fal-key',
                    )


if __name__ == '__main__':
    unittest.main()
