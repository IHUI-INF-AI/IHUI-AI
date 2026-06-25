"""兼容别名: 从 admin_models 导入 Admin* 类, 暴露为 Sys* 名称.

本文件保留是为了向后兼容旧代码 (300+ 处引用 Sys*).
新代码请直接 from app.models.admin_models import AdminUser 等.

表清单见 admin_models.py.
"""

from sqlalchemy import BigInteger, Column, Index, Integer, String

from app.database import Base
from app.models.admin_models import (
    AdminBaseMixin,
    AdminConfig,
    AdminDept,
    AdminDictData,
    AdminDictType,
    AdminJob,
    AdminJobLog,
    AdminLoginInfo,
    AdminLogininfor,
    AdminMenu,
    AdminNotice,
    AdminOperLog,
    AdminPost,
    AdminRole,
    AdminRoleDept,
    AdminRoleMenu,
    AdminSmsTemplate,
    AdminUser,
    AdminUserRole,
)
from app.models.base import TimestampMixin, id_column

# 向后兼容别名: 旧代码使用 Sys* 名称
SysBaseMixin = AdminBaseMixin
SysUser = AdminUser
SysRole = AdminRole
SysMenu = AdminMenu
SysDept = AdminDept
SysDictType = AdminDictType
SysDictData = AdminDictData
SysConfig = AdminConfig
SysLogininfor = AdminLogininfor
SysLoginInfo = AdminLoginInfo
SysOperLog = AdminOperLog
SysUserRole = AdminUserRole
SysRoleMenu = AdminRoleMenu
SysRoleDept = AdminRoleDept
SysNotice = AdminNotice
SysPost = AdminPost
SysJob = AdminJob
SysJobLog = AdminJobLog
SysSmsTemplate = AdminSmsTemplate


# =============================================================================
# 文件/上传会话表 (edu_oss 服务依赖, 2026-06-25 字段对齐修复 - 创建缺失模型)
# =============================================================================


class SysFile(TimestampMixin, Base):
    """系统文件表 sys_file.

    2026-06-25 字段对齐修复 (创建缺失模型).
    记录上传到 MinIO/OSS 的文件元数据, 供 edu_oss 及其他模块引用.
    """

    __tablename__ = "sys_file"
    __table_args__ = (
        Index("ix_sys_file_file_key", "file_key"),
        Index("ix_sys_file_uploader_id", "uploader_id"),
        Index("ix_sys_file_status", "status"),
    )

    id = id_column(comment="文件ID")
    file_key = Column(String(200), nullable=False, unique=True, comment="文件唯一标识/对象名")
    file_name = Column(String(255), nullable=False, comment="原始文件名")
    bucket = Column(String(100), nullable=False, comment="MinIO bucket 名")
    content_type = Column(String(100), nullable=True, comment="MIME 类型")
    size_bytes = Column(BigInteger, nullable=False, default=0, comment="文件大小(字节)")
    uploader_id = Column(BigInteger, nullable=True, comment="上传者 user id")
    status = Column(Integer, default=0, comment="状态 (0=上传中 1=已完成 2=已失败)")


class SysUploadSession(TimestampMixin, Base):
    """分片上传会话表 sys_upload_session.

    2026-06-25 字段对齐修复 (创建缺失模型).
    记录分片上传的会话状态, 配合 SysFile 完成大文件上传.
    """

    __tablename__ = "sys_upload_session"
    __table_args__ = (
        Index("ix_sys_upload_session_session_id", "session_id"),
        Index("ix_sys_upload_session_uploader_id", "uploader_id"),
        Index("ix_sys_upload_session_status", "status"),
    )

    id = id_column(comment="会话ID")
    session_id = Column(String(64), nullable=False, unique=True, comment="分片上传会话 id")
    file_key = Column(String(200), nullable=False, comment="文件唯一标识/对象名")
    file_name = Column(String(255), nullable=False, comment="原始文件名")
    total_parts = Column(Integer, nullable=False, default=1, comment="总分片数")
    uploaded_parts = Column(Integer, nullable=False, default=0, comment="已上传分片数")
    status = Column(Integer, default=0, comment="状态 (0=进行中 1=已完成 2=已取消)")
    uploader_id = Column(BigInteger, nullable=True, comment="上传者 user id")


__all__ = [
    "SysBaseMixin",
    "SysUser",
    "SysRole",
    "SysMenu",
    "SysDept",
    "SysDictType",
    "SysDictData",
    "SysConfig",
    "SysLogininfor",
    "SysLoginInfo",
    "SysOperLog",
    "SysUserRole",
    "SysRoleMenu",
    "SysRoleDept",
    "SysNotice",
    "SysPost",
    "SysJob",
    "SysJobLog",
    "SysFile",
    "SysUploadSession",
    # 新名称也导出, 方便渐进迁移
    "AdminBaseMixin",
    "AdminUser",
    "AdminRole",
    "AdminMenu",
    "AdminDept",
    "AdminDictType",
    "AdminDictData",
    "AdminConfig",
    "AdminLogininfor",
    "AdminLoginInfo",
    "AdminOperLog",
    "AdminUserRole",
    "AdminRoleMenu",
    "AdminRoleDept",
    "AdminNotice",
    "AdminPost",
    "AdminJob",
    "AdminJobLog",
    "AdminSmsTemplate",
]
