# File upload module - ported from P3 file_upload.py
import base64
import io
import logging

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field

from app.utils.file_transfer import upload_file_to_server

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cozeZhsApi/file", tags=["File Upload"])


class Base64UploadRequest(BaseModel):
    file_name: str = Field(..., alias="fileName")
    base64_content: str = Field(..., alias="base64")

    model_config = {"populate_by_name": True}


class UploadResponse(BaseModel):
    code: int
    message: str
    url: str = None


@router.post("/upload/base64", summary="Upload base64 file")
async def upload_base64_file(request: Base64UploadRequest, http_request: Request):
    """Upload a base64-encoded file. Auto-converts webp to png."""
    try:
        # Decode base64
        content = request.base64_content
        if "," in content:
            _, content = content.split(",", 1)
        try:
            file_content = base64.b64decode(content)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid base64: " + str(e)) from e

        file_name = request.file_name

        # Convert webp to png
        if file_name.lower().endswith(".webp"):
            try:
                from PIL import Image

                image = Image.open(io.BytesIO(file_content))
                if image.mode in ("RGBA", "LA", "P"):
                    image = image.convert("RGB")
                png_buf = io.BytesIO()
                image.save(png_buf, format="PNG")
                file_content = png_buf.getvalue()
                file_name = file_name.rsplit(".", 1)[0] + ".png"
                logger.info("Converted webp to png: " + file_name)
            except ImportError:
                logger.warning("PIL not installed, skipping webp conversion")
            except Exception as e:
                raise HTTPException(status_code=400, detail="webp conversion failed: " + str(e)) from e

        url = await upload_file_to_server(file_content, file_name)
        if not url:
            raise HTTPException(status_code=500, detail="Upload failed")
        return UploadResponse(code=0, message="Upload successful", url=url)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Base64 upload error: " + str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/upload/form", summary="Upload file via form-data")
async def upload_form_file(file: UploadFile = File(...)):
    """Upload any file via multipart/form-data."""
    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Empty file")
        url = await upload_file_to_server(file_bytes, file.filename)
        if not url:
            raise HTTPException(status_code=500, detail="Upload failed")
        return UploadResponse(code=0, message="Upload successful", url=url)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Form upload error: " + str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/upload/octet", summary="Upload file via octet-stream")
async def upload_octet_file(request: Request, file_name: str = Query(...)):
    """Upload file via raw octet-stream body. file_name in query."""
    try:
        file_bytes = await request.body()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Empty body")
        url = await upload_file_to_server(file_bytes, file_name)
        if not url:
            raise HTTPException(status_code=500, detail="Upload failed")
        return UploadResponse(code=0, message="Upload successful", url=url)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Octet upload error: " + str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e
