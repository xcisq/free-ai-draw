from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .console_encoding import configure_standard_streams

configure_standard_streams()

from .config import settings
from .routers.health import router as health_router
from .routers.jobs import router as jobs_router
from .routers.uploads import router as uploads_router


app = FastAPI(title="AutoFigure Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(jobs_router)
app.include_router(uploads_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "autofigure-backend",
        "health": "/healthz",
        "jobs": "/api/jobs",
        "uploads": "/api/uploads",
        "runtime_dir": str(settings.runtime_dir),
    }
