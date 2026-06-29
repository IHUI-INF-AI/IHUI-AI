"""Seed 初始化数据 — RuoYi 完整演示数据.

执行:
  python -m scripts.seed

效果:
  - 4 个内置角色 (超级管理员 / 管理员 / 运营 / 普通用户)
  - 完整菜单树 (9 个管理模块)
  - 演示 admin / ry 两个用户
  - 演示部门 (若依科技 / 深圳总公司 / 研发部门)
  - 演示岗位 (董事长 / 研发工程师 / 测试员)
  - 演示字典 (用户性别 / 系统开关 / 菜单状态 / 系统是否)
  - 演示通知公告
  - 演示参数配置
  - 演示定时任务
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from passlib.context import CryptContext

import app.models as _models  # noqa: F401
from app.database import Base, SessionFactory1, engine1
from app.models.sys_models import (
    SysConfig,
    SysDept,
    SysDictData,
    SysDictType,
    SysJob,
    SysMenu,
    SysNotice,
    SysPost,
    SysRole,
    SysRoleMenu,
    SysUser,
    SysUserRole,
)

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main():
    # 1. 确保表存在
    Base.metadata.create_all(bind=engine1)
    print("[1/9] 基础表已确保存在")

    with SessionFactory1() as db:
        # 2. 部门
        if not db.query(SysDept).first():
            top = SysDept(
                dept_id=1, dept_name="若依科技", parent_id=0, order_num=0, leader="若依", status="0", del_flag="0"
            )
            sz = SysDept(
                dept_id=2, dept_name="深圳总公司", parent_id=1, order_num=1, leader="若依", status="0", del_flag="0"
            )
            yf = SysDept(
                dept_id=3, dept_name="研发部门", parent_id=2, order_num=1, leader="若依", status="0", del_flag="0"
            )
            op = SysDept(
                dept_id=4, dept_name="运营部门", parent_id=2, order_num=2, leader="若依", status="0", del_flag="0"
            )
            db.add_all([top, sz, yf, op])
            db.commit()
        print("[2/9] 部门: 4 条")

        # 3. 岗位
        if not db.query(SysPost).first():
            db.add_all(
                [
                    SysPost(post_id=1, post_code="ceo", post_name="董事长", post_sort=1, status="0"),
                    SysPost(post_id=2, post_code="se", post_name="研发工程师", post_sort=2, status="0"),
                    SysPost(post_id=3, post_code="qa", post_name="测试员", post_sort=3, status="0"),
                    SysPost(post_id=4, post_code="op", post_name="运营", post_sort=4, status="0"),
                ]
            )
            db.commit()
        print("[3/9] 岗位: 4 条")

        # 4. 角色
        if not db.query(SysRole).first():
            db.add_all(
                [
                    SysRole(
                        role_id=1,
                        role_name="超级管理员",
                        role_key="admin",
                        role_sort=1,
                        status="0",
                        data_scope="1",
                        remark="超级管理员",
                        del_flag="0",
                    ),
                    SysRole(
                        role_id=2,
                        role_name="普通角色",
                        role_key="common",
                        role_sort=2,
                        status="0",
                        data_scope="5",
                        remark="普通用户",
                        del_flag="0",
                    ),
                    SysRole(
                        role_id=3,
                        role_name="运营",
                        role_key="operator",
                        role_sort=3,
                        status="0",
                        data_scope="3",
                        remark="运营人员",
                        del_flag="0",
                    ),
                    SysRole(
                        role_id=4,
                        role_name="审计",
                        role_key="auditor",
                        role_sort=4,
                        status="0",
                        data_scope="4",
                        remark="审计人员",
                        del_flag="0",
                    ),
                ]
            )
            db.commit()
        print("[4/9] 角色: 4 条")

        # 5. 菜单 (9 个管理模块)
        if not db.query(SysMenu).first():
            menus = [
                # 系统管理目录
                SysMenu(
                    menu_id=1,
                    menu_name="系统管理",
                    parent_id=0,
                    order_num=1,
                    path="system",
                    menu_type="M",
                    icon="system",
                    status="0",
                ),
                SysMenu(
                    menu_id=100,
                    menu_name="用户管理",
                    parent_id=1,
                    order_num=1,
                    path="user",
                    menu_type="C",
                    perms="system:user:list",
                    status="0",
                ),
                SysMenu(
                    menu_id=101,
                    menu_name="角色管理",
                    parent_id=1,
                    order_num=2,
                    path="role",
                    menu_type="C",
                    perms="system:role:list",
                    status="0",
                ),
                SysMenu(
                    menu_id=102,
                    menu_name="菜单管理",
                    parent_id=1,
                    order_num=3,
                    path="menu",
                    menu_type="C",
                    perms="system:menu:list",
                    status="0",
                ),
                SysMenu(
                    menu_id=103,
                    menu_name="部门管理",
                    parent_id=1,
                    order_num=4,
                    path="dept",
                    menu_type="C",
                    perms="system:dept:list",
                    status="0",
                ),
                SysMenu(
                    menu_id=104,
                    menu_name="岗位管理",
                    parent_id=1,
                    order_num=5,
                    path="post",
                    menu_type="C",
                    perms="system:post:list",
                    status="0",
                ),
                # 系统监控目录
                SysMenu(
                    menu_id=2,
                    menu_name="系统监控",
                    parent_id=0,
                    order_num=2,
                    path="monitor",
                    menu_type="M",
                    icon="monitor",
                    status="0",
                ),
                SysMenu(
                    menu_id=105,
                    menu_name="登录日志",
                    parent_id=2,
                    order_num=1,
                    path="logininfor",
                    menu_type="C",
                    perms="monitor:logininfor:list",
                    status="0",
                ),
                SysMenu(
                    menu_id=106,
                    menu_name="操作日志",
                    parent_id=2,
                    order_num=2,
                    path="operlog",
                    menu_type="C",
                    perms="monitor:operlog:list",
                    status="0",
                ),
                # 系统工具目录
                SysMenu(
                    menu_id=3,
                    menu_name="系统工具",
                    parent_id=0,
                    order_num=3,
                    path="tool",
                    menu_type="M",
                    icon="tool",
                    status="0",
                ),
                SysMenu(
                    menu_id=107,
                    menu_name="参数管理",
                    parent_id=3,
                    order_num=1,
                    path="config",
                    menu_type="C",
                    perms="tool:config:list",
                    status="0",
                ),
                SysMenu(
                    menu_id=108,
                    menu_name="字典管理",
                    parent_id=3,
                    order_num=2,
                    path="dict",
                    menu_type="C",
                    perms="tool:dict:list",
                    status="0",
                ),
                SysMenu(
                    menu_id=109,
                    menu_name="通知公告",
                    parent_id=3,
                    order_num=3,
                    path="notice",
                    menu_type="C",
                    perms="tool:notice:list",
                    status="0",
                ),
                # 任务调度目录
                SysMenu(
                    menu_id=4,
                    menu_name="任务调度",
                    parent_id=0,
                    order_num=4,
                    path="job",
                    menu_type="M",
                    icon="job",
                    status="0",
                ),
                SysMenu(
                    menu_id=110,
                    menu_name="定时任务",
                    parent_id=4,
                    order_num=1,
                    path="job",
                    menu_type="C",
                    perms="job:list",
                    status="0",
                ),
                SysMenu(
                    menu_id=111,
                    menu_name="任务日志",
                    parent_id=4,
                    order_num=2,
                    path="job/log",
                    menu_type="C",
                    perms="job:log:list",
                    status="0",
                ),
            ]
            db.add_all(menus)
            db.commit()
        print("[5/9] 菜单: 16 条 (4 目录 + 12 子页)")

        # 6. 角色菜单关联 (admin 拥有全部)
        if not db.query(SysRoleMenu).first():
            admin = db.query(SysRole).filter(SysRole.role_key == "admin").first()
            all_menus = db.query(SysMenu).all()
            for m in all_menus:
                db.add(SysRoleMenu(role_id=admin.role_id, menu_id=m.menu_id))
            db.commit()
        print("[6/9] 角色菜单关联已建")

        # 7. 用户 (admin/ry)
        if not db.query(SysUser).first():
            admin_pwd = pwd.hash("admin123")
            ry_pwd = pwd.hash("123456")
            db.add_all(
                [
                    SysUser(
                        user_id=1,
                        user_name="admin",
                        nick_name="超级管理员",
                        password=admin_pwd,
                        dept_id=3,
                        status="0",
                        del_flag="0",
                        remark="内置超管",
                    ),
                    SysUser(
                        user_id=2,
                        user_name="ry",
                        nick_name="若依",
                        password=ry_pwd,
                        dept_id=2,
                        status="0",
                        del_flag="0",
                        remark="内置普通用户",
                    ),
                ]
            )
            db.flush()
            admin_user = db.query(SysUser).filter(SysUser.user_name == "admin").first()
            ry_user = db.query(SysUser).filter(SysUser.user_name == "ry").first()
            admin_role = db.query(SysRole).filter(SysRole.role_key == "admin").first()
            common_role = db.query(SysRole).filter(SysRole.role_key == "common").first()
            db.add_all(
                [
                    SysUserRole(user_id=admin_user.user_id, role_id=admin_role.role_id),
                    SysUserRole(user_id=ry_user.user_id, role_id=common_role.role_id),
                ]
            )
            db.commit()
        print("[7/9] 用户: 2 条 (admin/admin123, ry/123456)")

        # 8. 字典
        if not db.query(SysDictType).first():
            db.add_all(
                [
                    SysDictType(dict_id=1, dict_name="用户性别", dict_type="sys_user_sex", status="0"),
                    SysDictType(dict_id=2, dict_name="系统开关", dict_type="sys_normal_disable", status="0"),
                    SysDictType(dict_id=3, dict_name="菜单状态", dict_type="sys_show_hide", status="0"),
                    SysDictType(dict_id=4, dict_name="系统是否", dict_type="sys_yes_no", status="0"),
                    SysDictType(dict_id=5, dict_name="操作类型", dict_type="sys_oper_type", status="0"),
                ]
            )
            db.flush()
            db.add_all(
                [
                    SysDictData(
                        dict_code="1",
                        dict_sort=1,
                        dict_label="男",
                        dict_value="0",
                        dict_type="sys_user_sex",
                        status="0",
                    ),
                    SysDictData(
                        dict_code="2",
                        dict_sort=2,
                        dict_label="女",
                        dict_value="1",
                        dict_type="sys_user_sex",
                        status="0",
                    ),
                    SysDictData(
                        dict_code="3",
                        dict_sort=3,
                        dict_label="未知",
                        dict_value="2",
                        dict_type="sys_user_sex",
                        status="0",
                    ),
                    SysDictData(
                        dict_code="11",
                        dict_sort=1,
                        dict_label="正常",
                        dict_value="0",
                        dict_type="sys_normal_disable",
                        status="0",
                    ),
                    SysDictData(
                        dict_code="12",
                        dict_sort=2,
                        dict_label="停用",
                        dict_value="1",
                        dict_type="sys_normal_disable",
                        status="0",
                    ),
                    SysDictData(
                        dict_code="21",
                        dict_sort=1,
                        dict_label="显示",
                        dict_value="0",
                        dict_type="sys_show_hide",
                        status="0",
                    ),
                    SysDictData(
                        dict_code="22",
                        dict_sort=2,
                        dict_label="隐藏",
                        dict_value="1",
                        dict_type="sys_show_hide",
                        status="0",
                    ),
                    SysDictData(
                        dict_code="31", dict_sort=1, dict_label="是", dict_value="Y", dict_type="sys_yes_no", status="0"
                    ),
                    SysDictData(
                        dict_code="32", dict_sort=2, dict_label="否", dict_value="N", dict_type="sys_yes_no", status="0"
                    ),
                    SysDictData(
                        dict_code="41",
                        dict_sort=1,
                        dict_label="新增",
                        dict_value="1",
                        dict_type="sys_oper_type",
                        status="0",
                    ),
                    SysDictData(
                        dict_code="42",
                        dict_sort=2,
                        dict_label="修改",
                        dict_value="2",
                        dict_type="sys_oper_type",
                        status="0",
                    ),
                    SysDictData(
                        dict_code="43",
                        dict_sort=3,
                        dict_label="删除",
                        dict_value="3",
                        dict_type="sys_oper_type",
                        status="0",
                    ),
                    SysDictData(
                        dict_code="44",
                        dict_sort=4,
                        dict_label="查询",
                        dict_value="4",
                        dict_type="sys_oper_type",
                        status="0",
                    ),
                ]
            )
            db.commit()
        print("[8/9] 字典: 5 类型 + 13 数据")

        # 9. 通知 + 参数 + 任务
        if not db.query(SysNotice).first():
            db.add_all(
                [
                    SysNotice(
                        notice_id=1,
                        notice_title="系统上线通知",
                        notice_type="1",
                        notice_content="<p>欢迎使用 ZHS Platform v1.0</p>",
                        status="0",
                        create_by="admin",
                    ),
                    SysNotice(
                        notice_id=2,
                        notice_title="维护通知",
                        notice_type="2",
                        notice_content="<p>本周日凌晨 02:00-04:00 系统维护</p>",
                        status="0",
                        create_by="admin",
                    ),
                ]
            )
            db.commit()
        if not db.query(SysConfig).first():
            db.add_all(
                [
                    SysConfig(
                        config_id=1,
                        config_name="用户管理-账号初始密码",
                        config_key="sys.user.initPassword",
                        config_value="123456",
                    ),
                    SysConfig(
                        config_id=2,
                        config_name="登录-是否开启验证码",
                        config_key="sys.account.captchaEnabled",
                        config_value="true",
                    ),
                    SysConfig(
                        config_id=3,
                        config_name="账号自助-是否开启注册",
                        config_key="sys.account.registerUser",
                        config_value="false",
                    ),
                ]
            )
            db.commit()
        if not db.query(SysJob).first():
            db.add_all(
                [
                    SysJob(
                        job_id=1,
                        job_name="清理访问日志",
                        invoke_target="ryTask.cleanLogininfor",
                        cron_expression="0 0 2 * * ?",
                        status="0",
                        remark="每天 02:00 清理 30 天前日志",
                    ),
                    SysJob(
                        job_id=2,
                        job_name="生成统计数据",
                        invoke_target="ryTask.genStatistics",
                        cron_expression="0 0 3 * * ?",
                        status="0",
                        remark="每天 03:00 生成统计",
                    ),
                ]
            )
            db.commit()
        print("[9/9] 通知/参数/任务: 已建")

    print("\n✓ Seed 完成, 演示账号: admin/admin123, ry/123456")


if __name__ == "__main__":
    main()
