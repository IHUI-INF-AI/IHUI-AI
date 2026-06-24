"""兼容别名: 从 admin_models 导入 Admin* 类, 暴露为 Sys* 名称.

本文件保留是为了向后兼容旧代码 (300+ 处引用 Sys*).
新代码请直接 from app.models.admin_models import AdminUser 等.

表清单见 admin_models.py.
"""

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
