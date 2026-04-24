from __future__ import annotations

import os
import unittest
from unittest import mock

from autodraw.backend.app.pipeline.autofigure2 import (
    _get_svg_multimodal_max_tokens,
    call_llm_multimodal,
)


class QingyunSvgStrategyTest(unittest.TestCase):
    def test_qingyun_svg_prefers_native_when_enabled(self) -> None:
        with mock.patch.dict(
            os.environ,
            {"QINGYUN_SVG_PREFER_NATIVE": "true"},
            clear=False,
        ):
            with mock.patch(
                "autodraw.backend.app.pipeline.autofigure2._call_qingyun_gemini_native_multimodal",
                return_value="<svg></svg>",
            ) as native_mock, mock.patch(
                "autodraw.backend.app.pipeline.autofigure2._call_openrouter_multimodal",
                side_effect=AssertionError("should not call OpenAI-compatible path first"),
            ):
                result = call_llm_multimodal(
                    contents=["draw svg"],
                    api_key="test-key",
                    model="gemini-3.1-pro-preview",
                    base_url="https://api.qingyuntop.top/v1",
                    provider="qingyun",
                    max_tokens=24000,
                    prefer_qingyun_native=True,
                )

        self.assertEqual(result, "<svg></svg>")
        native_mock.assert_called_once()

    def test_svg_multimodal_max_tokens_uses_safe_default_and_env_override(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("SVG_MULTIMODAL_MAX_TOKENS", None)
            self.assertEqual(_get_svg_multimodal_max_tokens(), 24000)

        with mock.patch.dict(
            os.environ,
            {"SVG_MULTIMODAL_MAX_TOKENS": "18000"},
            clear=False,
        ):
            self.assertEqual(_get_svg_multimodal_max_tokens(), 18000)


if __name__ == "__main__":
    unittest.main()
