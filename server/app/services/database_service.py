import logging
from datetime import datetime

from pydantic import BaseModel
from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

from app.services._legacy_settings import settings
from app.utils.datetime_helper import utcnow

logger = logging.getLogger(__name__)

DATABASE_URL = settings.DATABASE_URL
ASYNC_DATABASE_URL = settings.ASYNC_DATABASE_URL

_engine_kw: dict = {"pool_pre_ping": True, "pool_recycle": 3600, "echo": False}
if DATABASE_URL.startswith("sqlite"):
    _engine_kw["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **_engine_kw)

async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
AsyncSessionLocal = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


class FileRecord(Base):
    __tablename__ = "file_records"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String(64), unique=True, index=True)
    filename = Column(String(255))
    original_name = Column(String(255))
    file_path = Column(String(512))
    file_size = Column(Integer)
    page_count = Column(Integer, nullable=True)
    mime_type = Column(String(128))
    user_id = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=utcnow, index=True)
    expires_at = Column(DateTime, nullable=True)
    is_processed = Column(Boolean, default=False)

    operations = relationship("OperationRecord", back_populates="file")


class OperationRecord(Base):
    __tablename__ = "operation_records"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String(64), ForeignKey("file_records.file_id"))
    operation_type = Column(String(64))
    status = Column(String(32))
    input_file = Column(String(512))
    output_file = Column(String(512), nullable=True)
    parameters = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    processing_time = Column(Float, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)

    file = relationship("FileRecord", back_populates="operations")


class SignatureRecord(Base):
    __tablename__ = "signature_records"

    id = Column(Integer, primary_key=True, index=True)
    signature_id = Column(String(64), unique=True, index=True)
    file_id = Column(String(64))
    signer_name = Column(String(128))
    signer_email = Column(String(128), nullable=True)
    reason = Column(String(255), nullable=True)
    location = Column(String(128), nullable=True)
    certificate_serial = Column(String(128), nullable=True)
    certificate_issuer = Column(String(255), nullable=True)
    valid_from = Column(DateTime, nullable=True)
    valid_to = Column(DateTime, nullable=True)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)


class CertificateRecord(Base):
    __tablename__ = "certificate_records"

    id = Column(Integer, primary_key=True, index=True)
    serial_number = Column(String(128), unique=True, index=True)
    common_name = Column(String(128))
    organization = Column(String(128), nullable=True)
    email = Column(String(128), nullable=True)
    certificate_pem = Column(Text)
    public_key_pem = Column(Text, nullable=True)
    valid_from = Column(DateTime)
    valid_to = Column(DateTime)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)


class UploadRecord(Base):
    __tablename__ = "upload_records"

    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(String(64), unique=True, index=True)
    file_id = Column(String(64), index=True)
    filename = Column(String(255))
    file_size = Column(Integer)
    total_chunks = Column(Integer)
    uploaded_chunks = Column(JSON, default=list)
    status = Column(String(32), default='pending')
    user_id = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)


class UploadedFileRecord(Base):
    __tablename__ = "uploaded_file_records"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String(64), unique=True, index=True)
    filename = Column(String(255))
    original_name = Column(String(255))
    file_path = Column(String(512))
    file_size = Column(Integer)
    mime_type = Column(String(128))
    user_id = Column(String(64), nullable=True, index=True)
    upload_id = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class ShareRecord(Base):
    __tablename__ = "share_records"

    id = Column(Integer, primary_key=True, index=True)
    share_id = Column(String(32), unique=True, index=True)
    file_id = Column(String(64), index=True)
    filename = Column(String(255))
    file_url = Column(String(512))
    password = Column(String(64), nullable=True)
    max_downloads = Column(Integer, nullable=True)
    current_downloads = Column(Integer, default=0)
    expires_at = Column(DateTime, nullable=True, index=True)
    created_by = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=utcnow)


class FileVersionRecord(Base):
    __tablename__ = "file_version_records"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(String(64), unique=True, index=True)
    file_id = Column(String(64), index=True)
    version_number = Column(Integer, default=1)
    file_path = Column(String(512))
    file_size = Column(Integer)
    checksum = Column(String(64))
    change_summary = Column(String(500), nullable=True)
    changed_by = Column(String(64), nullable=True, index=True)
    is_current = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow, index=True)


class UserRecord(Base):
    __tablename__ = "user_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), unique=True, index=True)
    username = Column(String(128), unique=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)
    display_name = Column(String(128), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    roles = relationship("UserRoleRecord", back_populates="user")


class RoleRecord(Base):
    __tablename__ = "role_records"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(String(64), unique=True, index=True)
    name = Column(String(64), unique=True)
    display_name = Column(String(128))
    description = Column(String(255), nullable=True)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)

    permissions = relationship("RolePermissionRecord", back_populates="role")


class PermissionRecord(Base):
    __tablename__ = "permission_records"

    id = Column(Integer, primary_key=True, index=True)
    permission_id = Column(String(64), unique=True, index=True)
    name = Column(String(64), unique=True)
    display_name = Column(String(128))
    resource = Column(String(64))
    action = Column(String(32))
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utcnow)


class UserRoleRecord(Base):
    __tablename__ = "user_role_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("user_records.user_id"), index=True)
    role_id = Column(String(64), ForeignKey("role_records.role_id"), index=True)
    assigned_by = Column(String(64), nullable=True)
    assigned_at = Column(DateTime, default=utcnow)

    user = relationship("UserRecord", back_populates="roles")


class RolePermissionRecord(Base):
    __tablename__ = "role_permission_records"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(String(64), ForeignKey("role_records.role_id"), index=True)
    permission_id = Column(String(64), ForeignKey("permission_records.permission_id"), index=True)
    created_at = Column(DateTime, default=utcnow)

    role = relationship("RoleRecord", back_populates="permissions")


class FileAccessRecord(Base):
    __tablename__ = "file_access_records"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String(64), index=True)
    user_id = Column(String(64), index=True)
    permission = Column(String(32))
    granted_by = Column(String(64), nullable=True)
    granted_at = Column(DateTime, default=utcnow)
    expires_at = Column(DateTime, nullable=True)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


class FileRecordCreate(BaseModel):
    file_id: str
    filename: str
    original_name: str
    file_path: str
    file_size: int
    page_count: int
    mime_type: str = "application/pdf"
    user_id: str | None = None


class OperationRecordCreate(BaseModel):
    file_id: str
    operation_type: str
    input_file: str
    parameters: str | None = None


class UploadRecordCreate(BaseModel):
    upload_id: str
    file_id: str
    filename: str
    file_size: int
    total_chunks: int
    user_id: str | None = None


class UploadedFileCreate(BaseModel):
    file_id: str
    filename: str
    original_name: str
    file_path: str
    file_size: int
    mime_type: str
    user_id: str | None = None
    upload_id: str | None = None


class ShareCreate(BaseModel):
    share_id: str
    file_id: str
    filename: str
    file_url: str
    password: str | None = None
    max_downloads: int | None = None
    expires_at: datetime | None = None
    created_by: str | None = None


class DatabaseService:
    @staticmethod
    def create_file_record(db: Session, file_data: FileRecordCreate) -> FileRecord:
        db_file = FileRecord(**file_data.model_dump())
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        return db_file

    @staticmethod
    def get_file_record(db: Session, file_id: str) -> FileRecord | None:
        return db.query(FileRecord).filter(FileRecord.file_id == file_id).first()

    @staticmethod
    def delete_file_record(db: Session, file_id: str) -> bool:
        file_record = db.query(FileRecord).filter(FileRecord.file_id == file_id).first()
        if file_record:
            db.delete(file_record)
            db.commit()
            return True
        return False

    @staticmethod
    def create_operation_record(db: Session, op_data: OperationRecordCreate) -> OperationRecord:
        db_op = OperationRecord(**op_data.model_dump())
        db.add(db_op)
        db.commit()
        db.refresh(db_op)
        return db_op

    @staticmethod
    def update_operation_status(
        db: Session,
        op_id: int,
        status: str,
        output_file: str | None = None,
        error_message: str | None = None,
        processing_time: float | None = None
    ) -> OperationRecord | None:
        op = db.query(OperationRecord).filter(OperationRecord.id == op_id).first()
        if op:
            op.status = status
            op.output_file = output_file
            op.error_message = error_message
            op.processing_time = processing_time
            op.completed_at = utcnow()
            db.commit()
            db.refresh(op)
        return op

    @staticmethod
    def get_file_operations(db: Session, file_id: str) -> list[OperationRecord]:
        return db.query(OperationRecord).filter(OperationRecord.file_id == file_id).all()

    @staticmethod
    def create_signature_record(db: Session, sig_data: dict) -> SignatureRecord:
        db_sig = SignatureRecord(**sig_data)
        db.add(db_sig)
        db.commit()
        db.refresh(db_sig)
        return db_sig

    @staticmethod
    def create_certificate_record(db: Session, cert_data: dict) -> CertificateRecord:
        db_cert = CertificateRecord(**cert_data)
        db.add(db_cert)
        db.commit()
        db.refresh(db_cert)
        return db_cert

    @staticmethod
    def get_certificate_by_serial(db: Session, serial_number: str) -> CertificateRecord | None:
        return db.query(CertificateRecord).filter(
            CertificateRecord.serial_number == serial_number
        ).first()

    @staticmethod
    def revoke_certificate(db: Session, serial_number: str) -> bool:
        cert = db.query(CertificateRecord).filter(
            CertificateRecord.serial_number == serial_number
        ).first()
        if cert:
            cert.is_revoked = True
            db.commit()
            return True
        return False

    @staticmethod
    def cleanup_expired_files(db: Session, hours: int = 24) -> int:
        from datetime import timedelta
        cutoff = utcnow() - timedelta(hours=hours)
        expired = db.query(FileRecord).filter(FileRecord.created_at < cutoff).all()
        count = len(expired)
        for file_record in expired:
            db.delete(file_record)
        db.commit()
        return count


class UploadService:
    @staticmethod
    def create_upload(db: Session, data: UploadRecordCreate) -> UploadRecord:
        record = UploadRecord(**data.model_dump())
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get_upload(db: Session, upload_id: str) -> UploadRecord | None:
        return db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()

    @staticmethod
    def update_upload_chunks(db: Session, upload_id: str, chunk_index: int) -> UploadRecord | None:
        record = db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
        if record:
            chunks = record.uploaded_chunks or []
            if chunk_index not in chunks:
                chunks.append(chunk_index)
                record.uploaded_chunks = chunks
                db.commit()
                db.refresh(record)
        return record

    @staticmethod
    def complete_upload(db: Session, upload_id: str) -> UploadRecord | None:
        record = db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
        if record:
            record.status = 'completed'
            record.completed_at = utcnow()
            db.commit()
            db.refresh(record)
        return record

    @staticmethod
    def delete_upload(db: Session, upload_id: str) -> bool:
        record = db.query(UploadRecord).filter(UploadRecord.upload_id == upload_id).first()
        if record:
            db.delete(record)
            db.commit()
            return True
        return False


class UploadedFileService:
    @staticmethod
    def create(db: Session, data: UploadedFileCreate) -> UploadedFileRecord:
        record = UploadedFileRecord(**data.model_dump())
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get_by_file_id(db: Session, file_id: str) -> UploadedFileRecord | None:
        return db.query(UploadedFileRecord).filter(UploadedFileRecord.file_id == file_id).first()

    @staticmethod
    def get_all(db: Session, user_id: str | None = None, limit: int = 100, offset: int = 0) -> list[UploadedFileRecord]:
        query = db.query(UploadedFileRecord)
        if user_id:
            query = query.filter(UploadedFileRecord.user_id == user_id)
        return query.order_by(UploadedFileRecord.created_at.desc()).offset(offset).limit(limit).all()

    @staticmethod
    def delete(db: Session, file_id: str) -> bool:
        record = db.query(UploadedFileRecord).filter(UploadedFileRecord.file_id == file_id).first()
        if record:
            db.delete(record)
            db.commit()
            return True
        return False

    @staticmethod
    def count(db: Session, user_id: str | None = None) -> int:
        query = db.query(UploadedFileRecord)
        if user_id:
            query = query.filter(UploadedFileRecord.user_id == user_id)
        return query.count()


class ShareService:
    @staticmethod
    def create(db: Session, data: ShareCreate) -> ShareRecord:
        record = ShareRecord(**data.model_dump())
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get(db: Session, share_id: str) -> ShareRecord | None:
        return db.query(ShareRecord).filter(ShareRecord.share_id == share_id).first()

    @staticmethod
    def get_active(db: Session, share_id: str) -> ShareRecord | None:
        record = db.query(ShareRecord).filter(ShareRecord.share_id == share_id).first()
        if record:
            if record.expires_at and record.expires_at < utcnow():
                return None
            if record.max_downloads and record.current_downloads >= record.max_downloads:
                return None
        return record

    @staticmethod
    def increment_downloads(db: Session, share_id: str) -> ShareRecord | None:
        record = db.query(ShareRecord).filter(ShareRecord.share_id == share_id).first()
        if record:
            record.current_downloads += 1
            db.commit()
            db.refresh(record)
        return record

    @staticmethod
    def delete(db: Session, share_id: str) -> bool:
        record = db.query(ShareRecord).filter(ShareRecord.share_id == share_id).first()
        if record:
            db.delete(record)
            db.commit()
            return True
        return False

    @staticmethod
    def get_by_user(db: Session, user_id: str) -> list[ShareRecord]:
        return db.query(ShareRecord).filter(
            ShareRecord.created_by == user_id
        ).order_by(ShareRecord.created_at.desc()).all()

    @staticmethod
    def cleanup_expired(db: Session) -> int:
        expired = db.query(ShareRecord).filter(
            ShareRecord.expires_at < utcnow()
        ).all()
        count = len(expired)
        for record in expired:
            db.delete(record)
        db.commit()
        return count


class FileVersionService:
    @staticmethod
    def create_version(db: Session, file_id: str, file_path: str, file_size: int,
                       checksum: str, changed_by: str | None = None,
                       change_summary: str | None = None) -> FileVersionRecord:
        db.query(FileVersionRecord).filter(
            FileVersionRecord.file_id == file_id
        ).update({"is_current": False})

        latest = db.query(FileVersionRecord).filter(
            FileVersionRecord.file_id == file_id
        ).order_by(FileVersionRecord.version_number.desc()).first()

        version_number = (latest.version_number + 1) if latest else 1
        version_id = f"{file_id}_v{version_number}"

        record = FileVersionRecord(
            version_id=version_id,
            file_id=file_id,
            version_number=version_number,
            file_path=file_path,
            file_size=file_size,
            checksum=checksum,
            change_summary=change_summary,
            changed_by=changed_by,
            is_current=True
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get_versions(db: Session, file_id: str) -> list[FileVersionRecord]:
        return db.query(FileVersionRecord).filter(
            FileVersionRecord.file_id == file_id
        ).order_by(FileVersionRecord.version_number.desc()).all()

    @staticmethod
    def get_version(db: Session, version_id: str) -> FileVersionRecord | None:
        return db.query(FileVersionRecord).filter(
            FileVersionRecord.version_id == version_id
        ).first()

    @staticmethod
    def get_current_version(db: Session, file_id: str) -> FileVersionRecord | None:
        return db.query(FileVersionRecord).filter(
            FileVersionRecord.file_id == file_id,
            FileVersionRecord.is_current
        ).first()

    @staticmethod
    def rollback_to_version(db: Session, version_id: str) -> FileVersionRecord | None:
        version = db.query(FileVersionRecord).filter(
            FileVersionRecord.version_id == version_id
        ).first()
        if not version:
            return None

        db.query(FileVersionRecord).filter(
            FileVersionRecord.file_id == version.file_id
        ).update({"is_current": False})

        version.is_current = True
        db.commit()
        db.refresh(version)
        return version

    @staticmethod
    def delete_version(db: Session, version_id: str) -> bool:
        version = db.query(FileVersionRecord).filter(
            FileVersionRecord.version_id == version_id
        ).first()
        if version and not version.is_current:
            db.delete(version)
            db.commit()
            return True
        return False


class UserService:
    @staticmethod
    def create(db: Session, user_id: str, username: str,
               email: str | None = None,
               hashed_password: str | None = None,
               display_name: str | None = None) -> UserRecord:
        record = UserRecord(
            user_id=user_id,
            username=username,
            email=email,
            hashed_password=hashed_password,
            display_name=display_name or username
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def create_user(db: Session, username: str, password_hash: str,
                    email: str | None = None, role: str = "user") -> UserRecord:
        import uuid
        user_id = str(uuid.uuid4())
        record = UserRecord(
            user_id=user_id,
            username=username,
            email=email,
            hashed_password=password_hash,
            display_name=username
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        UserRoleRecord(
            user_id=user_id,
            role_id=role
        )
        db.commit()

        return record

    @staticmethod
    def get(db: Session, user_id: str) -> UserRecord | None:
        return db.query(UserRecord).filter(UserRecord.user_id == user_id).first()

    @staticmethod
    def get_by_id(db: Session, id: int) -> UserRecord | None:
        return db.query(UserRecord).filter(UserRecord.id == id).first()

    @staticmethod
    def get_by_username(db: Session, username: str) -> UserRecord | None:
        return db.query(UserRecord).filter(UserRecord.username == username).first()

    @staticmethod
    def update_password(db: Session, user_id: int, password_hash: str) -> UserRecord | None:
        user = db.query(UserRecord).filter(UserRecord.id == user_id).first()
        if user:
            user.hashed_password = password_hash
            db.commit()
            db.refresh(user)
        return user

    @staticmethod
    def update_last_login(db: Session, user_id: str) -> UserRecord | None:
        user = db.query(UserRecord).filter(UserRecord.user_id == user_id).first()
        if user:
            user.last_login = utcnow()
            db.commit()
            db.refresh(user)
        return user

    @staticmethod
    def assign_role(db: Session, user_id: str, role_id: str,
                    assigned_by: str | None = None) -> UserRoleRecord:
        record = UserRoleRecord(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get_user_roles(db: Session, user_id: str) -> list[RoleRecord]:
        user_roles = db.query(UserRoleRecord).filter(
            UserRoleRecord.user_id == user_id
        ).all()
        role_ids = [ur.role_id for ur in user_roles]
        return db.query(RoleRecord).filter(RoleRecord.role_id.in_(role_ids)).all()

    @staticmethod
    def get_user_permissions(db: Session, user_id: str) -> list[PermissionRecord]:
        user_roles = db.query(UserRoleRecord).filter(
            UserRoleRecord.user_id == user_id
        ).all()
        role_ids = [ur.role_id for ur in user_roles]

        role_perms = db.query(RolePermissionRecord).filter(
            RolePermissionRecord.role_id.in_(role_ids)
        ).all()
        perm_ids = [rp.permission_id for rp in role_perms]

        return db.query(PermissionRecord).filter(
            PermissionRecord.permission_id.in_(perm_ids)
        ).all()


class RoleService:
    @staticmethod
    def create(db: Session, role_id: str, name: str, display_name: str,
               description: str | None = None, is_system: bool = False) -> RoleRecord:
        record = RoleRecord(
            role_id=role_id,
            name=name,
            display_name=display_name,
            description=description,
            is_system=is_system
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get(db: Session, role_id: str) -> RoleRecord | None:
        return db.query(RoleRecord).filter(RoleRecord.role_id == role_id).first()

    @staticmethod
    def get_all(db: Session) -> list[RoleRecord]:
        return db.query(RoleRecord).limit(500).all()

    @staticmethod
    def assign_permission(db: Session, role_id: str, permission_id: str) -> RolePermissionRecord:
        record = RolePermissionRecord(role_id=role_id, permission_id=permission_id)
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get_role_permissions(db: Session, role_id: str) -> list[PermissionRecord]:
        role_perms = db.query(RolePermissionRecord).filter(
            RolePermissionRecord.role_id == role_id
        ).all()
        perm_ids = [rp.permission_id for rp in role_perms]
        return db.query(PermissionRecord).filter(
            PermissionRecord.permission_id.in_(perm_ids)
        ).all()


class PermissionService:
    @staticmethod
    def create(db: Session, permission_id: str, name: str, display_name: str,
               resource: str, action: str, description: str | None = None) -> PermissionRecord:
        record = PermissionRecord(
            permission_id=permission_id,
            name=name,
            display_name=display_name,
            resource=resource,
            action=action,
            description=description
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get_all(db: Session) -> list[PermissionRecord]:
        return db.query(PermissionRecord).limit(500).all()

    @staticmethod
    def get_by_resource(db: Session, resource: str) -> list[PermissionRecord]:
        return db.query(PermissionRecord).filter(
            PermissionRecord.resource == resource
        ).all()


class FileAccessService:
    @staticmethod
    def grant_access(db: Session, file_id: str, user_id: str, permission: str,
                     granted_by: str | None = None,
                     expires_at: datetime | None = None) -> FileAccessRecord:
        record = FileAccessRecord(
            file_id=file_id,
            user_id=user_id,
            permission=permission,
            granted_by=granted_by,
            expires_at=expires_at
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def check_access(db: Session, file_id: str, user_id: str, permission: str) -> bool:
        record = db.query(FileAccessRecord).filter(
            FileAccessRecord.file_id == file_id,
            FileAccessRecord.user_id == user_id,
            FileAccessRecord.permission == permission
        ).first()

        if not record:
            return False

        return not (record.expires_at and record.expires_at < utcnow())

    @staticmethod
    def get_file_access_list(db: Session, file_id: str) -> list[FileAccessRecord]:
        return db.query(FileAccessRecord).filter(
            FileAccessRecord.file_id == file_id
        ).all()

    @staticmethod
    def revoke_access(db: Session, file_id: str, user_id: str) -> bool:
        records = db.query(FileAccessRecord).filter(
            FileAccessRecord.file_id == file_id,
            FileAccessRecord.user_id == user_id
        ).all()
        if records:
            for record in records:
                db.delete(record)
            db.commit()
            return True
        return False


def init_default_roles_and_permissions(db: Session):
    existing = db.query(RoleRecord).first()
    if existing:
        return

    permissions = [
        ("file_read", "file:read", "读取文件", "file", "read"),
        ("file_write", "file:write", "写入文件", "file", "write"),
        ("file_delete", "file:delete", "删除文件", "file", "delete"),
        ("file_share", "file:share", "分享文件", "file", "share"),
        ("admin_users", "admin:users", "用户管理", "admin", "users"),
        ("admin_roles", "admin:roles", "角色管理", "admin", "roles"),
    ]

    for perm_id, name, display_name, resource, action in permissions:
        PermissionService.create(db, perm_id, name, display_name, resource, action)

    roles = [
        ("admin", "admin", "管理员", "系统管理员,拥有所有权限", True),
        ("user", "user", "普通用户", "普通用户,拥有基本文件操作权限", True),
        ("guest", "guest", "访客", "访客,只能查看共享文件", True),
    ]

    for role_id, name, display_name, description, is_system in roles:
        RoleService.create(db, role_id, name, display_name, description, is_system)

    RoleService.assign_permission(db, "admin", "file_read")
    RoleService.assign_permission(db, "admin", "file_write")
    RoleService.assign_permission(db, "admin", "file_delete")
    RoleService.assign_permission(db, "admin", "file_share")
    RoleService.assign_permission(db, "admin", "admin_users")
    RoleService.assign_permission(db, "admin", "admin_roles")

    RoleService.assign_permission(db, "user", "file_read")
    RoleService.assign_permission(db, "user", "file_write")
    RoleService.assign_permission(db, "user", "file_share")

    RoleService.assign_permission(db, "guest", "file_read")

    db.commit()
