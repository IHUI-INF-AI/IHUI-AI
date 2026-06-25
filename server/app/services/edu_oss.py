"""edu_oss service - Object storage (migrated from ihui-ai-edu-oss-service).

2026-06-25 字段对齐修复 (创建缺失模型):
  - 原 edu_models.py 通过 try/except ImportError 导入 SysFile/SysUploadSession,
    但 sys_models.py 中并不存在这两个类, 导致 EduOssFile/EduOssUploadSession 为 None.
  - 本次在 sys_models.py 中补全真实模型后, 将本模块所有字段对齐到新模型:
      * file_key/file_name/bucket/content_type/size_bytes/uploader_id 直接保留
      * status 由字符串 ("active"/"completed"/"aborted") 改为 Integer (0/1/2)
      * session_id/total_parts/uploaded_parts 直接保留
  - 补充 import 验证要求的函数: upload_part/complete_multipart_upload/
    get_upload_status/delete_file/list_files (基于现有逻辑实现, 不改签名风格).
"""

from __future__ import annotations

import secrets
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.edu_models import EduOssFile, EduOssUploadSession
from app.services.edu_base import EduNotFoundError, EduValidationError


def init_multipart_upload(
    db: Session, uploader_id: int, file_name: str, file_size: int,
    content_type: Optional[str] = None, total_parts: int = 1,
) -> EduOssUploadSession:
    """Initialize a multipart upload session.

    2026-06-25 字段对齐修复 (创建缺失模型):
      - session.status 由字符串 "active" 改为 Integer 0 (进行中)
      - file 记录显式设置 status=0 (上传中), file_name 对齐到新模型字段
    """
    if total_parts < 1 or total_parts > 10000:
        raise EduValidationError("total_parts must be 1-10000")
    session_id = secrets.token_urlsafe(24)
    file_key = f"edu/{datetime.now().strftime('%Y/%m/%d')}/{secrets.token_hex(8)}/{file_name}"
    s = EduOssUploadSession(
        session_id=session_id, file