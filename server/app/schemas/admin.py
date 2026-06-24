"""Admin 系统模块 schemas (admin_* 表对应的 Pydantic 模型).

兼容: schemas/sys.py 从本文件导入 Sys* 别名, 保持旧代码向后兼容.
"""

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class AdminUserCreate(BaseModel):
    user_name: str
    nick_name: str
    password: str | None = Field(default=None, min_length=8)
    phone: str | None = None
    sex: Literal["0", "1", "2"] | None = "0"
    email: str | None = None
    dept_id: int | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return v
        if not re.match(r"^1[3-9]\d{9}$", v):
            raise ValueError("phone 格式不正确, 需为 11 位手机号")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return v
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("email 格式不正确")
        return v


class AdminUserOut(BaseModel):
    user_id: int
    user_name: str
    nick_name: str
    phone: str | None = None
    email: str | None = None
    sex: str = "0"
    status: str = "0"
    create_time: datetime | None = None

    model_config = {"from_attributes": True}


class AdminMenuOut(BaseModel):
    menu_id: int
    menu_name: str
    parent_id: int
    order_num: int
    path: str
    component: str | None = None
    perms: str | None = None
    menu_type: str = "M"
    visible: str = "0"
    icon: str = "#"

    model_config = {"from_attributes": True}
