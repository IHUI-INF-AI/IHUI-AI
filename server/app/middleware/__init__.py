"""CORS middleware configuration -- kept for reference; actual config is in main.py."""

from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


def setup_cors(app):
    """Add CORS middleware to FastAPI app (not used -- main.py configures CORS directly)."""
    allowed_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
    if not allowed_origins:
        allowed_origins = ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
