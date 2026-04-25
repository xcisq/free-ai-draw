from __future__ import annotations

import os
import sys
from typing import Any


def configure_standard_streams() -> None:
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    for name in ("stdout", "stderr", "__stdout__", "__stderr__"):
        stream = getattr(sys, name, None)
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is None:
            continue
        try:
            reconfigure(encoding="utf-8", errors="backslashreplace")
        except Exception:
            try:
                reconfigure(errors="backslashreplace")
            except Exception:
                continue


def _escape_for_stream(stream: Any, data: str) -> str:
    encoding = getattr(stream, "encoding", None) or "ascii"
    try:
        return data.encode(encoding, errors="backslashreplace").decode(
            encoding,
            errors="replace",
        )
    except LookupError:
        return data.encode("ascii", errors="backslashreplace").decode("ascii")


def safe_stream_flush(stream: Any) -> None:
    try:
        stream.flush()
    except UnicodeEncodeError:
        return


def safe_stream_write(stream: Any, data: str) -> None:
    try:
        stream.write(data)
    except UnicodeEncodeError:
        stream.write(_escape_for_stream(stream, data))
    safe_stream_flush(stream)


def safe_print(*args: Any, sep: str = " ", end: str = "\n", file: Any = None, flush: bool = False) -> None:
    stream = file if file is not None else sys.stdout
    message = sep.join(str(arg) for arg in args) + end
    safe_stream_write(stream, message)
    if flush:
        safe_stream_flush(stream)
