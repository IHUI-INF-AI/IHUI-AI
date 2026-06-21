"""Admin 系统模块 ORM 模型 (admin_* 表).

对应 Java: com.admin.system.domain.* / com.admin.system.api.domain.*

表清单:
  - admin_user        用户表
  - admin_role        角色表
  - admin_menu        菜单权限表
  - admin_dept        部门表
  - admin_dict_type   字典类型表
  - admin_dict_data   字典数据表
  - admin_config      参数配置表
  - admin_logininfor  系统访问记录表
  - admin_oper_log    操作日志记录表
  - admin_user_role   用户-角色关联表
  - admin_role_menu   角色-菜单关联表
  - admin_notice      通知公告表
  - admin_post        岗位表
  - admin_role_dept   角色-部门关联表
  - admin_job         定时任务表 (来自 admin-job)
  - admin_job_log     定时任务日志表 (来自 admin-job)

兼容: sys_models.py 从本文件导入 Sys* 别名, 保持旧代码向后兼容.
"""

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String

from app.database import Base
from app.utils.datetime_helper import utcnow


def _big_id(comment: str):
    """BigInteger 主键 (PostgreSQL), SQLite 走 Integer rowid 自增."""
    return Column(
        Integer().with_variant(BigInteger(), "postgresql"),
        primary_key=True,
        autoincrement=True,
        comment=comment,
    )


class AdminBaseMixin:
    """Admin BaseEntity 公共字段 (create_by/create_time/update_by/update_time/remark).

    注意: 与项目 TimestampMixin 不同, Admin 用 create_by/update_by 记录操作人字符串,
    且字段名为 create_time/update_time (非 created_at).
    """

    create_by = Column(String(64), nullable=True, comment="创建者")
    create_time = Column(DateTime, default=utcnow, comment="创建时间")
    update_by = Column(String(64), nullable=True, comment="更新者")
    update_time = Column(DateTime, default=utcnow, onupdate=utcnow, comment="更新时间")
    remark = Column(String(500), nullable=True, comment="备注")


# =============================================================================
# 主表
# =============================================================================


class AdminUser(AdminBaseMixin, Base):
    """用户表 admin_user."""

    __tablename__ = "admin_user"
    __table_args__ = (
        Index("ix_admin_user_create_by", "create_by"),
        Index("ix_admin_user_update_by", "update_by"),
        {"schema": "public", "extend_existing": True},
    )

    user_id = _big_id("用户ID")
    user_uuid = Column(
        String(36),
        nullable=True,
        unique=True,
        index=True,
        comment="用户UUID(跨库关联Key, 与UserAuthInfo.user_uuid对齐)",
    )
    dept_id = Column(BigInteger, nullable=True, comment="部门ID")
    user_name = Column(String(30), nullable=False, comment="用户账号")
    nick_name = Column(String(30), nullable=False, comment="用户昵称")
    email = Column(String(50), nullable=True, comment="用户邮箱")
    phonenumber = Column("phone", String(11), nullable=True, comment="手机号码")
    sex = Column(String(1), default="0", comment="用户性别 (0男 1女 2未知)")
    avatar = Column(String(100), nullable=True, comment="用户头像")
    password = Column(String(100), nullable=True, comment="密码")
    status = Column(String(1), default="0", comment="账号状态 (0正常 1停用)")
    del_flag = Column(String(1), default="0", comment="删除标志 (0存在 2删除)")
    login_ip = Column(String(128), nullable=True, comment="最后登录IP")
    login_date = Column(DateTime, nullable=True, comment="最后登录时间")


class AdminRole(AdminBaseMixin, Base):
    """角色表 admin_role."""

    __tablename__ = "admin_role"

    role_id = _big_id("角色ID")
    role_name = Column(String(30), nullable=False, comment="角色名称")
    role_key = Column(String(100), nullable=False, comment="角色权限字符串")
    role_sort = Column(Integer, nullable=False, comment="角色排序")
    data_scope = Column(String(1), default="1", comment="数据范围 (1全部 2自定义 3本部门 4本部门及以下 5仅本人)")
    menu_check_strictly = Column(Integer, default=1, comment="菜单树选择项是否关联显示")
    dept_check_strictly = Column(Integer, default=1, comment="部门树选择项是否关联显示")
    status = Column(String(1), default="0", comment="角色状态 (0正常 1停用)")
    del_flag = Column(String(1), default="0", comment="删除标志 (0存在 2删除)")


class AdminMenu(AdminBaseMixin, Base):
    """菜单权限表 admin_menu."""

    __tablename__ = "admin_menu"
    __table_args__ = (
        Index("ix_admin_menu_parent_id", "parent_id"),
        Index("ix_admin_menu_status", "status"),
    )

    menu_id = _big_id("菜单ID")
    menu_name = Column(String(50), nullable=False, comment="菜单名称")
    parent_id = Column(BigInteger, default=0, comment="父菜单ID")
    order_num = Column(Integer, default=0, comment="显示顺序")
    path = Column(String(200), nullable=True, comment="路由地址")
    component = Column(String(255), nullable=True, comment="组件路径")
    query = Column(String(255), nullable=True, comment="路由参数")
    route_name = Column(String(50), nullable=True, comment="路由名称")
    is_frame = Column(String(1), default="1", comment="是否为外链 (0是 1否)")
    is_cache = Column(String(1), default="0", comment="是否缓存 (0缓存 1不缓存)")
    menu_type = Column(String(1), default="", comment="类型 (M目录 C菜单 F按钮)")
    visible = Column(String(1), default="0", comment="显示状态 (0显示 1隐藏)")
    status = Column(String(1), default="0", comment="菜单状态 (0正常 1停用)")
    perms = Column(String(100), nullable=True, comment="权限字符串")
    icon = Column(String(100), default="#", comment="菜单图标")


class AdminDept(AdminBaseMixin, Base):
    """部门表 admin_dept."""

    __tablename__ = "admin_dept"
    __table_args__ = (
        Index("ix_admin_dept_parent_id", "parent_id"),
        Index("ix_admin_dept_status", "status"),
        Index("ix_admin_dept_del_flag", "del_flag"),
    )

    dept_id = _big_id("部门ID")
    parent_id = Column(BigInteger, default=0, comment="父部门ID")
    ancestors = Column(String(50), nullable=True, comment="祖级列表")
    dept_name = Column(String(30), default="", comment="部门名称")
    order_num = Column(Integer, default=0, comment="显示顺序")
    leader = Column(String(20), nullable=True, comment="负责人")
    phone = Column(String(11), nullable=True, comment="联系电话")
    email = Column(String(50), nullable=True, comment="邮箱")
    status = Column(String(1), default="0", comment="部门状态 (0正常 1停用)")
    del_flag = Column(String(1), default="0", comment="删除标志 (0存在 2删除)")


class AdminDictType(AdminBaseMixin, Base):
    """字典类型表 admin_dict_type."""

    __tablename__ = "admin_dict_type"
    __table_args__ = (Index("ix_admin_dict_type_status", "status"),)

    dict_id = _big_id("字典主键")
    dict_name = Column(String(100), default="", comment="字典名称")
    dict_type = Column(String(100), default="", comment="字典类型")
    status = Column(String(1), default="0", comment="状态 (0正常 1停用)")


class AdminDictData(AdminBaseMixin, Base):
    """字典数据表 admin_dict_data."""

    __tablename__ = "admin_dict_data"
    __table_args__ = (Index("ix_admin_dict_data_status", "status"),)

    dict_code = _big_id("字典编码")
    dict_sort = Column(Integer, default=0, comment="字典排序")
    dict_label = Column(String(100), default="", comment="字典标签")
    dict_value = Column(String(100), default="", comment="字典键值")
    dict_type = Column(String(100), default="", comment="字典类型")
    css_class = Column(String(100), nullable=True, comment="样式属性")
    list_class = Column(String(100), nullable=True, comment="表格字典样式")
    is_default = Column(String(1), default="N", comment="是否默认 (Y是 N否)")
    status = Column(String(1), default="0", comment="状态 (0正常 1停用)")


class AdminConfig(AdminBaseMixin, Base):
    """参数配置表 admin_config."""

    __tablename__ = "admin_config"

    config_id = _big_id("参数主键")
    config_name = Column(String(100), default="", comment="参数名称")
    config_key = Column(String(100), default="", comment="参数键名")
    config_value = Column(String(500), default="", comment="参数键值")
    config_type = Column(String(1), default="N", comment="系统内置 (Y是 N否)")


class AdminLogininfor(Base):
    """系统访问记录表 admin_logininfor (无 BaseEntity 公共字段)."""

    __tablename__ = "admin_logininfor"
    __table_args__ = (Index("ix_admin_logininfor_status", "status"),)

    info_id = _big_id("ID")
    user_name = Column(String(50), nullable=True, comment="用户账号")
    status = Column(String(1), default="0", comment="状态 (0成功 1失败)")
    ipaddr = Column(String(128), nullable=True, comment="登录IP地址")
    msg = Column(String(255), nullable=True, comment="提示消息")
    access_time = Column(DateTime, nullable=True, comment="访问时间")


# 别名: 兼容旧代码中的 AdminLoginInfo / SysLoginInfo
AdminLoginInfo = AdminLogininfor


class AdminOperLog(Base):
    """操作日志记录表 admin_oper_log (无 BaseEntity 公共字段, 只追加不修改)."""

    __tablename__ = "admin_oper_log"
    __table_args__ = (Index("ix_admin_oper_log_status", "status"),)

    oper_id = _big_id("日志主键")
    title = Column(String(50), default="", comment="操作模块")
    business_type = Column(Integer, default=0, comment="业务类型 (0其它 1新增 2修改 3删除...)")
    method = Column(String(200), default="", comment="请求方法")
    request_method = Column(Integer, default=0, comment="请求方式 (0GET 1POST 2PUT 3DELETE)")
    operator_type = Column(Integer, default=0, comment="操作类别 (0其它 1后台用户 2手机端用户)")
    oper_name = Column(String(50), default="", comment="操作人员")
    dept_name = Column(String(50), default="", comment="部门名称")
    oper_url = Column(String(255), default="", comment="请求URL")
    oper_ip = Column(String(128), default="", comment="操作地址")
    oper_param = Column(String(2000), default="", comment="请求参数")
    json_result = Column(String(2000), default="", comment="返回参数")
    status = Column(Integer, default=0, comment="操作状态 (0正常 1异常)")
    error_msg = Column(String(2000), default="", comment="错误消息")
    oper_time = Column(DateTime, default=utcnow, comment="操作时间")
    cost_time = Column(BigInteger, default=0, comment="消耗时间(毫秒)")


# =============================================================================
# 关联表 (多对多)
# =============================================================================


class AdminUserRole(Base):
    """用户-角色关联表 admin_user_role."""

    __tablename__ = "admin_user_role"

    user_id = Column(BigInteger, primary_key=True, comment="用户ID")
    role_id = Column(BigInteger, primary_key=True, comment="角色ID")


class AdminRoleMenu(Base):
    """角色-菜单关联表 admin_role_menu."""

    __tablename__ = "admin_role_menu"

    role_id = Column(BigInteger, primary_key=True, comment="角色ID")
    menu_id = Column(BigInteger, primary_key=True, comment="菜单ID")


class AdminRoleDept(Base):
    """角色-部门关联表 admin_role_dept."""

    __tablename__ = "admin_role_dept"

    role_id = Column(BigInteger, primary_key=True, comment="角色ID")
    dept_id = Column(BigInteger, primary_key=True, comment="部门ID")


class AdminNotice(AdminBaseMixin, Base):
    """通知公告表 admin_notice."""

    __tablename__ = "admin_notice"
    __table_args__ = (
        Index("ix_admin_notice_status", "status"),
        Index("ix_admin_notice_create_by", "create_by"),
    )

    notice_id = _big_id("公告ID")
    notice_title = Column(String(50), nullable=False, comment="公告标题")
    notice_type = Column(String(1), nullable=False, comment="公告类型 (1通知 2公告)")
    notice_content = Column(String(2000), nullable=True, comment="公告内容")
    status = Column(String(1), default="0", comment="公告状态 (0正常 1关闭)")


class AdminPost(AdminBaseMixin, Base):
    """岗位表 admin_post."""

    __tablename__ = "admin_post"
    __table_args__ = (Index("ix_admin_post_status", "status"),)

    post_id = _big_id("岗位ID")
    post_code = Column(String(64), nullable=False, comment="岗位编码")
    post_name = Column(String(50), nullable=False, comment="岗位名称")
    post_sort = Column(Integer, nullable=False, comment="岗位排序")
    status = Column(String(1), default="0", comment="状态 (0正常 1停用)")


class AdminJob(AdminBaseMixin, Base):
    """定时任务表 admin_job (来自 admin-job)."""

    __tablename__ = "admin_job"
    __table_args__ = (
        Index("ix_admin_job_status", "status"),
        Index("ix_admin_job_create_by", "create_by"),
        Index("ix_admin_job_update_by", "update_by"),
    )

    job_id = _big_id("任务ID")
    job_name = Column(String(64), nullable=False, comment="任务名称")
    job_group = Column(String(64), default="DEFAULT", comment="任务组名")
    invoke_target = Column(String(500), nullable=False, comment="调用目标字符串")
    cron_expression = Column(String(255), default="", comment="cron执行表达式")
    misfire_policy = Column(String(20), default="3", comment="计划执行错误策略 (1立即执行 2执行一次 3放弃执行)")
    concurrent = Column(String(1), default="1", comment="是否并发执行 (0允许 1禁止)")
    status = Column(String(1), default="0", comment="状态 (0正常 1暂停)")


class AdminJobLog(Base):
    """定时任务日志表 admin_job_log (来自 admin-job)."""

    __tablename__ = "admin_job_log"
    __table_args__ = (Index("ix_admin_job_log_status", "status"),)

    job_log_id = _big_id("任务日志ID")
    job_name = Column(String(64), nullable=True, comment="任务名称")
    job_group = Column(String(64), nullable=True, comment="任务组名")
    invoke_target = Column(String(500), nullable=True, comment="调用目标字符串")
    job_message = Column(String(500), nullable=True, comment="日志信息")
    status = Column(String(1), default="0", comment="执行状态 (0正常 1失败)")
    exception_info = Column(String(2000), default="", comment="异常信息")
    create_time = Column(DateTime, default=utcnow, comment="创建时间")
