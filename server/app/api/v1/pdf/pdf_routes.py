import contextlib
import logging
import os
import uuid

from cryptography import x509
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.api.v1._legacy_internal.auth import verify_api_key
from app.api.v1._legacy_internal.config import settings
from app.schemas.legacy_schemas import (
    MergeResponse,
    PrintPreviewResponse,
    PrintSettings,
    SignatureResponse,
    SplitRequest,
    SplitResponse,
    WatermarkPosition,
    WatermarkResponse,
)
from app.services.pdf_service import (
    CertificateAuthority,
    PDFMergeSplitService,
    PDFPrintService,
    PDFSignatureService,
    PDFWatermarkService,
)

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = settings.UPLOAD_DIR
OUTPUT_DIR = settings.OUTPUT_DIR
MAX_FILE_SIZE = settings.MAX_FILE_SIZE

def get_file_path(file_id: str) -> str | None:
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(file_id):
            return os.path.join(UPLOAD_DIR, f)
    return None

def validate_file_size(file: UploadFile) -> None:
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"文件大小超过限制 ({MAX_FILE_SIZE // (1024*1024)}MB)"
        )


@router.post("/upload", summary="上传PDF文件", dependencies=[Depends(verify_api_key)])
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="只支持PDF文件")

    validate_file_size(file)

    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    from PyPDF2 import PdfReader
    reader = PdfReader(file_path)

    return {
        "file_id": file_id,
        "filename": file.filename,
        "page_count": len(reader.pages),
        "size": len(content)
    }


@router.post("/signature/add", response_model=SignatureResponse, summary="添加签名", dependencies=[Depends(verify_api_key)])
async def add_signature(
    file_id: str = Form(...),
    name: str = Form(...),
    reason: str | None = Form(None),
    location: str | None = Form(None),
    page_number: int = Form(1),
    x: float = Form(0),
    y: float = Form(0),
    width: float = Form(150),
    height: float = Form(75),
    signature_image: UploadFile = File(...)
):
    pdf_path = get_file_path(file_id)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="PDF文件未找到")

    sig_image_data = await signature_image.read()

    output_path, sig_info = PDFSignatureService.add_signature(
        pdf_path=pdf_path,
        signature_image=sig_image_data,
        name=name,
        reason=reason,
        location=location,
        page_number=page_number,
        x=x,
        y=y,
        width=width,
        height=height
    )

    return SignatureResponse(
        id=sig_info["id"],
        name=sig_info["name"],
        date=sig_info["date"],
        reason=sig_info.get("reason"),
        location=sig_info.get("location"),
        page_number=sig_info["page_number"],
        verified=sig_info["verified"],
        download_url=f"/api/pdf/download/{os.path.basename(output_path)}"
    )


@router.get("/signature/verify/{file_id}", summary="验证签名", dependencies=[Depends(verify_api_key)])
async def verify_signature(file_id: str):
    pdf_path = get_file_path(file_id)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="PDF文件未找到")

    signatures = PDFSignatureService.verify_signature(pdf_path)
    return {"signatures": signatures, "verified": len(signatures) > 0}


@router.post("/watermark/text", response_model=WatermarkResponse, summary="添加文字水印", dependencies=[Depends(verify_api_key)])
async def add_text_watermark(
    file_id: str = Form(...),
    content: str = Form(...),
    font_size: int = Form(48),
    color: str = Form("#808080"),
    opacity: float = Form(0.3),
    rotation: int = Form(-45),
    position: WatermarkPosition = Form(WatermarkPosition.DIAGONAL),
    pages: str | None = Form(None)
):
    pdf_path = get_file_path(file_id)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="PDF文件未找到")

    from PyPDF2 import PdfReader
    reader = PdfReader(pdf_path)
    first_page = reader.pages[0]
    page_width = float(first_page.mediabox.width)
    page_height = float(first_page.mediabox.height)

    watermark_data = PDFWatermarkService.create_text_watermark(
        page_width=page_width,
        page_height=page_height,
        content=content,
        font_size=font_size,
        color=color,
        opacity=opacity,
        rotation=rotation,
        position=position.value
    )

    page_list = None
    if pages:
        page_list = [int(p.strip()) for p in pages.split(",") if p.strip().isdigit()]

    output_path = PDFWatermarkService.apply_watermark(pdf_path, watermark_data, page_list)

    return WatermarkResponse(
        id=str(uuid.uuid4()),
        type="text",
        download_url=f"/api/pdf/download/{os.path.basename(output_path)}"
    )


@router.post("/watermark/image", response_model=WatermarkResponse, summary="添加图片水印", dependencies=[Depends(verify_api_key)])
async def add_image_watermark(
    file_id: str = Form(...),
    opacity: float = Form(0.3),
    position: WatermarkPosition = Form(WatermarkPosition.CENTER),
    scale: float = Form(1.0),
    pages: str | None = Form(None),
    watermark_image: UploadFile = File(...)
):
    pdf_path = get_file_path(file_id)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="PDF文件未找到")

    from PyPDF2 import PdfReader
    reader = PdfReader(pdf_path)
    first_page = reader.pages[0]
    page_width = float(first_page.mediabox.width)
    page_height = float(first_page.mediabox.height)

    image_data = await watermark_image.read()

    watermark_data = PDFWatermarkService.create_image_watermark(
        page_width=page_width,
        page_height=page_height,
        image_data=image_data,
        opacity=opacity,
        position=position.value,
        scale=scale
    )

    page_list = None
    if pages:
        page_list = [int(p.strip()) for p in pages.split(",") if p.strip().isdigit()]

    output_path = PDFWatermarkService.apply_watermark(pdf_path, watermark_data, page_list)

    return WatermarkResponse(
        id=str(uuid.uuid4()),
        type="image",
        download_url=f"/api/pdf/download/{os.path.basename(output_path)}"
    )


@router.post("/merge", response_model=MergeResponse, summary="合并PDF", dependencies=[Depends(verify_api_key)])
async def merge_pdfs(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="至少需要2个PDF文件")

    pdf_paths = []
    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            continue
        validate_file_size(file)
        file_id = str(uuid.uuid4())
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        pdf_paths.append(file_path)

    if len(pdf_paths) < 2:
        raise HTTPException(status_code=400, detail="至少需要2个有效的PDF文件")

    output_path, page_count = PDFMergeSplitService.merge_pdfs(pdf_paths)

    for path in pdf_paths:
        with contextlib.suppress(OSError):
            os.remove(path)

    return MergeResponse(
        download_url=f"/api/pdf/download/{os.path.basename(output_path)}",
        page_count=page_count
    )


@router.post("/split/{file_id}", response_model=SplitResponse, summary="拆分PDF", dependencies=[Depends(verify_api_key)])
async def split_pdf(file_id: str, request: SplitRequest):
    pdf_path = get_file_path(file_id)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="PDF文件未找到")

    ranges = [{"start": r.start, "end": r.end} for r in request.ranges]
    results = PDFMergeSplitService.split_pdf(pdf_path, ranges)

    files = []
    for path, info in results:
        files.append({
            "download_url": f"/api/pdf/download/{os.path.basename(path)}",
            "page_range": info["page_range"],
            "page_count": info["page_count"]
        })

    return SplitResponse(files=files)


@router.post("/print/preview/{file_id}", response_model=PrintPreviewResponse, summary="生成打印预览", dependencies=[Depends(verify_api_key)])
async def generate_print_preview(file_id: str, settings: PrintSettings):
    pdf_path = get_file_path(file_id)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="PDF文件未找到")

    preview_path, page_count = PDFPrintService.generate_preview(
        pdf_path,
        settings.model_dump()
    )

    return PrintPreviewResponse(
        preview_url=f"/api/pdf/download/{os.path.basename(preview_path)}",
        page_count=page_count
    )


@router.post("/print/prepare/{file_id}", summary="准备打印文件", dependencies=[Depends(verify_api_key)])
async def prepare_print(file_id: str, settings: PrintSettings):
    pdf_path = get_file_path(file_id)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="PDF文件未找到")

    output_path = PDFPrintService.prepare_print(pdf_path, settings.model_dump())

    return {
        "download_url": f"/api/pdf/download/{os.path.basename(output_path)}",
        "ready": True
    }


@router.get("/download/{filename}", summary="下载处理后的文件")
async def download_file(filename: str):
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件未找到")

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/pdf"
    )


@router.delete("/cleanup/{file_id}", summary="清理临时文件", dependencies=[Depends(verify_api_key)])
async def cleanup_files(file_id: str):
    cleaned = 0

    for directory in [UPLOAD_DIR, OUTPUT_DIR]:
        if os.path.exists(directory):
            for f in os.listdir(directory):
                if file_id in f:
                    try:
                        os.remove(os.path.join(directory, f))
                        cleaned += 1
                    except OSError:
                        pass

    return {"cleaned": cleaned, "file_id": file_id}


@router.get("/key/generate", summary="生成API密钥", dependencies=[Depends(verify_api_key)])
async def generate_key():
    from app.api.v1._legacy_internal.config import generate_api_key
    return {"api_key": generate_api_key()}


@router.post("/certificate/issue", summary="签发用户证书", dependencies=[Depends(verify_api_key)])
async def issue_certificate(
    common_name: str = Form(...),
    organization: str = Form("PDF Service User"),
    email: str | None = Form(None),
    validity_days: int = Form(365)
):
    cert, key = CertificateAuthority.issue_certificate(
        common_name=common_name,
        organization=organization,
        email=email,
        validity_days=validity_days
    )

    if not cert or not key:
        raise HTTPException(status_code=500, detail="证书签发失败")

    from cryptography.hazmat.primitives import serialization

    cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode('utf-8')
    key_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')

    return {
        "certificate": cert_pem,
        "private_key": key_pem,
        "subject": cert.subject.get_attributes_for_oid(x509.NameOID.COMMON_NAME)[0].value if hasattr(cert, 'subject') else common_name,
        "valid_from": cert.not_valid_before.isoformat(),
        "valid_to": cert.not_valid_after.isoformat()
    }


@router.post("/certificate/verify", summary="验证证书", dependencies=[Depends(verify_api_key)])
async def verify_certificate(certificate: UploadFile = File(...)):
    cert_data = await certificate.read()
    result = CertificateAuthority.verify_certificate(cert_data)
    return result


@router.get("/certificate/ca", summary="获取CA证书")
async def get_ca_certificate():
    ca_cert_path = CertificateAuthority.CA_CERT_PATH
    if not os.path.exists(ca_cert_path):
        CertificateAuthority.ensure_ca_exists()

    if not os.path.exists(ca_cert_path):
        raise HTTPException(status_code=404, detail="CA证书未找到")

    return FileResponse(
        path=ca_cert_path,
        filename="ca.crt",
        media_type="application/x-x509-ca-cert"
    )


@router.post("/signature/digital/add", summary="添加数字签名(证书)", dependencies=[Depends(verify_api_key)])
async def add_digital_signature(
    file_id: str = Form(...),
    name: str = Form(...),
    reason: str | None = Form(None),
    location: str | None = Form(None),
    page_number: int = Form(1),
    certificate: UploadFile = File(...),
    private_key: UploadFile = File(...)
):
    from cryptography import x509
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import serialization

    pdf_path = get_file_path(file_id)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="PDF文件未找到")

    cert_data = await certificate.read()
    key_data = await private_key.read()

    try:
        cert = x509.load_pem_x509_certificate(cert_data, default_backend())
        key = serialization.load_pem_private_key(key_data, password=None, backend=default_backend())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"证书或密钥格式错误: {e!s}") from e

    output_path, sig_info = PDFSignatureService.add_digital_signature(
        pdf_path=pdf_path,
        cert=cert,
        private_key=key,
        name=name,
        reason=reason,
        location=location,
        page_number=page_number
    )

    return {
        "id": sig_info["id"],
        "name": sig_info["name"],
        "date": sig_info["date"],
        "verified": sig_info["verified"],
        "certificate_info": sig_info.get("certificate_info"),
        "download_url": f"/api/pdf/download/{os.path.basename(output_path)}"
    }
