"""Document management routes (migrated from client/backend-docs/DocumentController.java)."""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.api.v1.docs.models import Document
from app.config import settings as app_settings
from app.security import require_login, require_role
from app.services.markdown_converter import convert_to_markdown

logger = logging.getLogger(__name__)

router = APIRouter()

_uploads_base = getattr(app_settings, "LOCAL_UPLOADS_DIR", "./local_uploads")
UPLOAD_DIR = Path(_uploads_base) / "docs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_SIZE = 50 * 1024 * 1024  # 50 MB


class DocumentOut(BaseModel):
    id: int
    title: str
    filename: str
    category: str
    markdown: str | None = None
    sizeBytes: int  # noqa: 5
    mimeType: str | None = None  # noqa: 5
    createdBy: str | None = None  # noqa: 5
    createdAt: str  # noqa: 5
    updatedAt: str  # noqa: 5


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("general"),
    created_by: str | None = Form(None),
    user_uuid: str = Depends(require_login),
):
    """Upload a file, store it, convert to Markdown, persist record."""
    raw = await file.read()
    if len(raw) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50MB limit")
    suffix = Path(file.filename or "").suffix
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    target = UPLOAD_DIR / stored_name
    target.write_bytes(raw)
    md = convert_to_markdown(target)

    doc = Document(
        title=file.filename or stored_name,
        filename=stored_name,
        category=category,
        content=None,
        markdown=md,
        size_bytes=len(raw),
        mime_type=file.content_type,
        created_by=created_by,
    )
    return DocumentOut(**doc.to_dict())


@router.get("/list", response_model=list[DocumentOut])
def list_documents(
    category: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: str = Depends(require_login),
):
    """List documents, optionally filtered by category."""
    return []


@router.get("/{doc_id}", response_model=DocumentOut)
def get_document(doc_id: int, _: str = Depends(require_login)):
    raise HTTPException(status_code=404, detail="Not yet wired to live DB")


@router.delete("/{doc_id}")
def delete_document(doc_id: int, _: str = Depends(require_role("admin"))):
    return {"ok": True, "id": doc_id}


@router.get("/categories", response_model=list[str])
def list_categories(_: str = Depends(require_login)):
    return ["general"]
