from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_local_env(repo_root: Path) -> None:
    env_candidates = [
        repo_root / "backend" / ".env",
        repo_root / ".env",
    ]
    env_path = next((path for path in env_candidates if path.is_file()), None)
    if env_path is None:
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ[key] = value


@dataclass(frozen=True)
class Settings:
    repo_root: Path
    backend_dir: Path
    runtime_dir: Path
    jobs_dir: Path
    host: str
    port: int
    job_state_name: str = "job.json"
    manifest_name: str = "manifest.json"
    bundle_name: str = "bundle.zip"
    run_log_name: str = "run.log"
    max_concurrent_jobs: int = 1


def get_settings() -> Settings:
    repo_root = Path(__file__).resolve().parents[2]
    _load_local_env(repo_root)

    backend_dir = repo_root / "backend"
    runtime_dir = backend_dir / "runtime"
    jobs_dir = runtime_dir / "jobs"
    jobs_dir.mkdir(parents=True, exist_ok=True)

    host = os.environ.get("AUTOFIGURE_BACKEND_HOST", "0.0.0.0")
    port = int(os.environ.get("AUTOFIGURE_BACKEND_PORT", "8001"))

    return Settings(
        repo_root=repo_root,
        backend_dir=backend_dir,
        runtime_dir=runtime_dir,
        jobs_dir=jobs_dir,
        host=host,
        port=port,
    )


settings = get_settings()
