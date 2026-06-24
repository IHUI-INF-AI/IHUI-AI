"""Services package."""

# Re-export legacy client/backend service classes for backwards-compat.
from app.services._legacy_settings import settings
from app.services.audit_service import AuditLogCreate, AuditLogService
from app.services.backup_service import BackupService, backup_service
from app.services.cleanup_service import FileCleanupService, cleanup_service
from app.services.database_service import (
    CertificateRecord,
    DatabaseService,
    FileRecord,
    OperationRecord,
    SignatureRecord,
    get_db,
)
from app.services.diff_service import FileDiffService
from app.services.metrics_service import (
    PrometheusMiddleware,
    metrics_endpoint,
    track_file_upload,
    track_pdf_operation,
    update_storage_metrics,
)
# pdf_service 依赖 PyPDF2 / reportlab 等可选库, 缺失时降级为 None,
# 避免单个可选依赖缺失导致整个 services 包导入失败 (进而阻塞 v1 router 注册).
try:
    from app.services.pdf_service import (
        CertificateAuthority,
        PDFMergeSplitService,
        PDFPrintService,
        PDFSignatureService,
        PDFWatermarkService,
    )
except ImportError:
    CertificateAuthority = None  # type: ignore[assignment,misc]
    PDFMergeSplitService = None  # type: ignore[assignment,misc]
    PDFPrintService = None  # type: ignore[assignment,misc]
    PDFSignatureService = None  # type: ignore[assignment,misc]
    PDFWatermarkService = None  # type: ignore[assignment,misc]
from app.services.security_service import (
    CSRFProtection,
    InputValidator,
    RateLimiter,
    SecurityHeaders,
    SecurityMiddleware,
    security_middleware,
)
from app.services.storage_service import (
    LocalStorage,
    StorageBackend,
    StorageService,
)
