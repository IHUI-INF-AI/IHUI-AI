"""兼容别名: 从 admin 导入 Admin* schemas, 暴露为 Sys* 名称.

本文件保留是为了向后兼容旧代码.
新代码请直接 from app.schemas.admin import AdminUserCreate 等.
"""

from app.schemas.admin import AdminMenuOut, AdminUserCreate, AdminUserOut

# 向后兼容别名: 旧代码使用 Sys* 名称
SysUserCreate = AdminUserCreate
SysUserOut = AdminUserOut
SysMenuOut = AdminMenuOut

__all__ = [
    "AdminMenuOut",
    # 新名称也导出, 方便渐进迁移
    "AdminUserCreate",
    "AdminUserOut",
    "SysMenuOut",
    "SysUserCreate",
    "SysUserOut",
]
