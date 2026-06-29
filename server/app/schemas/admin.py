"""Admin 系统模块 schemas (admin_* 表对应的 Pydantic 模型).

兼容: schemas/sys.py 从本文件导入 Sys* 别名, 保持旧代码向后兼容.
"""

from datetime import datetime

from pydantic import BaseModel


class AdminUserCreate(BaseModel):
    user_name: str
    nick_name: str
    password: str | None = None
    phone: str | None = None
    sex: str | None = "0"
    email: str | None = None
    dept_id: int | None = None


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
