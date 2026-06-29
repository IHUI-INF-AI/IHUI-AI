"""Seed 默认 admin 用户 (idempotent, 可重复跑).

原 alembic 002_admin_job.py 在升级时硬塞 admin 账号, 违反了"迁移=DDL / seed=数据"的边界.
本脚本把 admin 账号挪出来, 由调用方在 upgrade 完成后显式调用, 避免迁移污染数据层.

用法:
    # 1. CLI 显式调用
    python scripts/ci/seed_admin.py

    # 2. CI pipeline 自动调用 (scripts/ci/alembic_ci.py 已集成)

    # 3. 应用启动时自动调用 (main.py startup hook)

默认账号: admin / admin123
密码哈希: bcrypt $2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Any

import sqlalchemy as sa
from sqlalchemy import text

ROOT = Path(__file__).resolve().parent.parent.parent

# 默认账号参数 (可通过 env 覆盖)
DEFAULT_USER_NAME = os.environ.get("ZHS_SEED_ADMIN_USER", "admin")
DEFAULT_NICK_NAME = os.environ.get("ZHS_SEED_ADMIN_NICK", "管理员")
DEFAULT_PASSWORD = os.environ.get("ZHS_SEED_ADMIN_PASSWORD", "admin123")
# bcrypt('admin123')
DEFAULT_HASH = os.environ.get(
    "ZHS_SEED_ADMIN_HASH",
    "$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2",
)
# 测试/CI 用固定 UUID, 方便断言; 生产用真实生成
DEFAULT_USER_UUID = os.environ.get("ZHS_SEED_ADMIN_UUID", "00000000-0000-0000-0000-000000000001")


def _db_url() -> str:
    """从 env 拿 DB URL, 默认 sqlite (CI 模式)."""
    return os.environ.get("DB1_URL", "sqlite:///./zhs_seed_admin.db")


def _engine():
    return sa.create_engine(_db_url())


def _table_exists(engine, name: str) -> bool:
    return name in sa.inspect(engine).get_table_names()


def seed_admin(
    engine: sa.Engine | None = None,
    user_name: str = DEFAULT_USER_NAME,
    nick_name: str = DEFAULT_NICK_NAME,
    password: str = DEFAULT_PASSWORD,
    password_hash: str = DEFAULT_HASH,
    user_uuid: str = DEFAULT_USER_UUID,
) -> int:
    """插入默认 admin 账号 (ON CONFLICT DO NOTHING, 可重入).

    返回:
        0  - 已存在 (skip)
        1  - 新建成功
        -1 - 失败 (admin_user 表不存在)
    """
    engine = engine or _engine()
    if not _table_exists(engine, "admin_user"):
        print("[seed_admin] admin_user 表不存在, 跳过 (请先跑 alembic upgrade)")
        return -1
    # 用 SELECT + INSERT/UPDATE, 不依赖 UNIQUE 约束 (兼容旧表结构)
    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT user_id, user_uuid FROM admin_user WHERE user_name = :un"),
            {"un": user_name},
        ).fetchone()
        if existing:
            updates = {
                "pw": password_hash,
                "nn": nick_name,
                "un": user_name,
            }
            set_clause = "password = :pw, nick_name = :nn, update_time = datetime('now')"
            # 如果 user_uuid 为空, 补一个
            if not existing[1] and user_uuid:
                set_clause += ", user_uuid = :uu"
                updates["uu"] = user_uuid
            conn.execute(
                text(f"UPDATE admin_user SET {set_clause} WHERE user_name = :un"),
                updates,
            )
            print(f"[seed_admin] {user_name} 已更新 (password={password})")
            return 1
        conn.execute(
            text(
                "INSERT INTO admin_user (user_name, nick_name, password, status, del_flag, user_uuid, create_time, update_time) "
                "VALUES (:un, :nn, :pw, '0', '0', :uu, datetime('now'), datetime('now'))"
            ),
            {"un": user_name, "nn": nick_name, "pw": password_hash, "uu": user_uuid},
        )
        print(f"[seed_admin] {user_name} 新建成功 (password={password}, user_uuid={user_uuid})")
        return 1


# ---------------------------------------------------------------------------
# 默认数据 (idempotent, 重复跑不会重复插入)
# ---------------------------------------------------------------------------

# 默认角色: admin (超级管理员, 全部权限) + common (普通用户, 无后台权限)
DEFAULT_ROLES = [
    {
        "role_name": "超级管理员",
        "role_key": "admin",
        "role_sort": 1,
        "data_scope": "1",
        "status": "0",
        "del_flag": "0",
        "remark": "超级管理员, 拥有所有权限",
    },
    {
        "role_name": "普通角色",
        "role_key": "common",
        "role_sort": 2,
        "data_scope": "5",
        "status": "0",
        "del_flag": "0",
        "remark": "普通用户, 仅查看权限",
    },
]

# 默认部门: 顶级 + 几个子部门
DEFAULT_DEPTS = [
    {"dept_id": 1, "parent_id": 0, "dept_name": "总公司", "order_num": 0},
    {"dept_id": 2, "parent_id": 1, "dept_name": "研发部门", "order_num": 1},
    {"dept_id": 3, "parent_id": 1, "dept_name": "运营部门", "order_num": 2},
    {"dept_id": 4, "parent_id": 1, "dept_name": "市场部门", "order_num": 3},
]

# 默认岗位
DEFAULT_POSTS = [
    {"post_code": "ceo", "post_name": "董事长", "post_sort": 1, "status": "0"},
    {"post_code": "cto", "post_name": "技术总监", "post_sort": 2, "status": "0"},
    {"post_code": "coo", "post_name": "运营总监", "post_sort": 3, "status": "0"},
    {"post_code": "dev", "post_name": "研发工程师", "post_sort": 4, "status": "0"},
]

# 字典类型 + 字典数据
DEFAULT_DICT_TYPES = [
    {
        "dict_name": "用户性别",
        "dict_type": "sys_user_sex",
        "status": "0",
    },
    {
        "dict_name": "系统是否",
        "dict_type": "sys_yes_no",
        "status": "0",
    },
    {
        "dict_name": "系统状态",
        "dict_type": "sys_normal_disable",
        "status": "0",
    },
    {
        "dict_name": "操作类型",
        "dict_type": "sys_oper_type",
        "status": "0",
    },
]

DEFAULT_DICT_DATA = {
    "sys_user_sex": [
        {"dict_label": "男", "dict_value": "0", "dict_sort": 1, "is_default": "Y", "status": "0"},
        {"dict_label": "女", "dict_value": "1", "dict_sort": 2, "is_default": "N", "status": "0"},
        {"dict_label": "未知", "dict_value": "2", "dict_sort": 3, "is_default": "N", "status": "0"},
    ],
    "sys_yes_no": [
        {"dict_label": "是", "dict_value": "Y", "dict_sort": 1, "is_default": "Y", "status": "0"},
        {"dict_label": "否", "dict_value": "N", "dict_sort": 2, "is_default": "N", "status": "0"},
    ],
    "sys_normal_disable": [
        {"dict_label": "正常", "dict_value": "0", "dict_sort": 1, "is_default": "Y", "status": "0"},
        {"dict_label": "停用", "dict_value": "1", "dict_sort": 2, "is_default": "N", "status": "0"},
    ],
    "sys_oper_type": [
        {"dict_label": "新增", "dict_value": "1", "dict_sort": 1, "is_default": "N", "status": "0"},
        {"dict_label": "修改", "dict_value": "2", "dict_sort": 2, "is_default": "N", "status": "0"},
        {"dict_label": "删除", "dict_value": "3", "dict_sort": 3, "is_default": "N", "status": "0"},
        {"dict_label": "查询", "dict_value": "4", "dict_sort": 4, "is_default": "N", "status": "0"},
        {"dict_label": "导出", "dict_value": "5", "dict_sort": 5, "is_default": "N", "status": "0"},
        {"dict_label": "导入", "dict_value": "6", "dict_sort": 6, "is_default": "N", "status": "0"},
    ],
}

# 默认菜单: 系统管理目录 + 几个子菜单
DEFAULT_MENUS = [
    {
        "menu_id": 1,
        "menu_name": "系统管理",
        "parent_id": 0,
        "order_num": 1,
        "path": "system",
        "component": "Layout",
        "is_frame": "1",
        "menu_type": "M",
        "visible": "0",
        "status": "0",
        "perms": "",
        "icon": "system",
    },
    {
        "menu_id": 100,
        "menu_name": "用户管理",
        "parent_id": 1,
        "order_num": 1,
        "path": "user",
        "component": "system/user/index",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "system:user:list",
        "icon": "user",
    },
    {
        "menu_id": 101,
        "menu_name": "角色管理",
        "parent_id": 1,
        "order_num": 2,
        "path": "role",
        "component": "system/role/index",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "system:role:list",
        "icon": "peoples",
    },
    {
        "menu_id": 102,
        "menu_name": "菜单管理",
        "parent_id": 1,
        "order_num": 3,
        "path": "menu",
        "component": "system/menu/index",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "system:menu:list",
        "icon": "tree-table",
    },
    {
        "menu_id": 103,
        "menu_name": "部门管理",
        "parent_id": 1,
        "order_num": 4,
        "path": "dept",
        "component": "system/dept/index",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "system:dept:list",
        "icon": "tree",
    },
    {
        "menu_id": 104,
        "menu_name": "岗位管理",
        "parent_id": 1,
        "order_num": 5,
        "path": "post",
        "component": "system/post/index",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "system:post:list",
        "icon": "post",
    },
    {
        "menu_id": 105,
        "menu_name": "字典管理",
        "parent_id": 1,
        "order_num": 6,
        "path": "dict",
        "component": "system/dict/index",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "system:dict:list",
        "icon": "dict",
    },
    {
        "menu_id": 106,
        "menu_name": "参数设置",
        "parent_id": 1,
        "order_num": 7,
        "path": "config",
        "component": "system/config/index",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "system:config:list",
        "icon": "edit",
    },
    {
        "menu_id": 107,
        "menu_name": "通知公告",
        "parent_id": 1,
        "order_num": 8,
        "path": "notice",
        "component": "system/notice/index",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "system:notice:list",
        "icon": "message",
    },
    {
        "menu_id": 108,
        "menu_name": "日志管理",
        "parent_id": 1,
        "order_num": 9,
        "path": "log",
        "component": "Layout",
        "is_frame": "1",
        "menu_type": "M",
        "visible": "0",
        "status": "0",
        "perms": "",
        "icon": "log",
    },
    {
        "menu_id": 109,
        "menu_name": "操作日志",
        "parent_id": 108,
        "order_num": 1,
        "path": "operlog",
        "component": "monitor/operlog/index",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "system:operlog:list",
        "icon": "form",
    },
]


def _seed_table(engine, table, unique_key, items, fixed_pk=None):
    """通用 idempotent seed 助手.

    unique_key: 用于判断已存在的字段名 (例如 "user_name", "role_key").
    fixed_pk:  如果指定, 按固定主键插入; 否则不指定主键让 DB 自增.
    """
    inserted = 0
    with engine.begin() as conn:
        for item in items:
            where_clause = f"WHERE {unique_key} = :v"
            params = {"v": item[unique_key]}
            if fixed_pk and fixed_pk in item:
                where_clause += f" OR {fixed_pk} = :pk"
                params["pk"] = item[fixed_pk]
            existing = conn.execute(
                text(f"SELECT 1 FROM {table} {where_clause}"),
                params,
            ).fetchone()
            if existing:
                continue
            cols = ", ".join(item.keys())
            placeholders = ", ".join(f":{k}" for k in item.keys())
            conn.execute(
                text(
                    f"INSERT INTO {table} ({cols}, create_time, update_time) "
                    f"VALUES ({placeholders}, datetime('now'), datetime('now'))"
                ),
                item,
            )
            inserted += 1
    return inserted


def _seed_dict_data(engine, dict_type, items):
    inserted = 0
    with engine.begin() as conn:
        for item in items:
            existing = conn.execute(
                text("SELECT 1 FROM admin_dict_data WHERE dict_type = :t AND dict_value = :v"),
                {"t": dict_type, "v": item["dict_value"]},
            ).fetchone()
            if existing:
                continue
            item["dict_type"] = dict_type
            cols = ", ".join(item.keys())
            placeholders = ", ".join(f":{k}" for k in item.keys())
            conn.execute(
                text(
                    f"INSERT INTO admin_dict_data ({cols}, create_time, update_time) "
                    f"VALUES ({placeholders}, datetime('now'), datetime('now'))"
                ),
                item,
            )
            inserted += 1
    return inserted


def _link_user_role(engine, user_id, role_id):
    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT 1 FROM admin_user_role WHERE user_id = :u AND role_id = :r"),
            {"u": user_id, "r": role_id},
        ).fetchone()
        if existing:
            return False
        conn.execute(
            text("INSERT INTO admin_user_role (user_id, role_id) VALUES (:u, :r)"),
            {"u": user_id, "r": role_id},
        )
        return True


def seed_full(engine: sa.Engine | None = None, admin_user_name: str = DEFAULT_USER_NAME) -> dict:
    """完整 seed: 角色 + 部门 + 岗位 + 字典 + 菜单 + 关联 admin user.

    返回每个表插入/跳过的数量, 例如 {"roles": (2, 0), "depts": (4, 0), ...}.
    """
    engine = engine or _engine()
    result: dict[str, Any] = {}
    # admin role
    for t in ("admin_role", "admin_dept", "admin_post", "admin_dict_type", "admin_menu"):
        if not _table_exists(engine, t):
            print(f"[seed_full] 表 {t} 不存在, 跳过 (请先跑 alembic upgrade)")
            return result

    # 1) 角色
    inserted = _seed_table(engine, "admin_role", "role_key", DEFAULT_ROLES)
    result["roles"] = inserted

    # 2) 部门 (用 dept_id 作为 fixed_pk)
    inserted = _seed_table(engine, "admin_dept", "dept_name", DEFAULT_DEPTS, fixed_pk="dept_id")
    result["depts"] = inserted

    # 3) 岗位
    inserted = _seed_table(engine, "admin_post", "post_code", DEFAULT_POSTS)
    result["posts"] = inserted

    # 4) 字典类型
    inserted = _seed_table(engine, "admin_dict_type", "dict_type", DEFAULT_DICT_TYPES)
    result["dict_types"] = inserted

    # 5) 字典数据
    total = 0
    for dtype, items in DEFAULT_DICT_DATA.items():
        total += _seed_dict_data(engine, dtype, items)
    result["dict_data"] = total

    # 6) 菜单
    inserted = _seed_table(engine, "admin_menu", "menu_id", DEFAULT_MENUS, fixed_pk="menu_id")
    result["menus"] = inserted

    # 7) 把 admin user 关联到 admin role (role_id=1, "超级管理员") + 顶级部门
    with engine.begin() as conn:
        admin = conn.execute(
            text("SELECT user_id FROM admin_user WHERE user_name = :u"),
            {"u": admin_user_name},
        ).fetchone()
        admin_role = conn.execute(
            text("SELECT role_id FROM admin_role WHERE role_key = 'admin'"),
        ).fetchone()
        if admin and admin_role:
            linked = _link_user_role(engine, int(admin[0]), int(admin_role[0]))
            result["user_role_linked"] = linked
        else:
            result["user_role_linked"] = False

    print(
        f"[seed_full] 完成: roles+{result.get('roles', 0)}, "
        f"depts+{result.get('depts', 0)}, posts+{result.get('posts', 0)}, "
        f"dict_types+{result.get('dict_types', 0)}, dict_data+{result.get('dict_data', 0)}, "
        f"menus+{result.get('menus', 0)}, user_role_linked={result.get('user_role_linked', False)}"
    )
    return result


def main():
    p = argparse.ArgumentParser(description="Seed admin (full)")
    p.add_argument("--user-name", default=DEFAULT_USER_NAME)
    p.add_argument("--nick-name", default=DEFAULT_NICK_NAME)
    p.add_argument("--password", default=DEFAULT_PASSWORD)
    p.add_argument("--password-hash", default=DEFAULT_HASH)
    p.add_argument("--user-uuid", default=DEFAULT_USER_UUID)
    p.add_argument("--full", action="store_true", help="完整 seed (角色/部门/岗位/字典/菜单)")
    args = p.parse_args()
    rc = seed_admin(
        user_name=args.user_name,
        nick_name=args.nick_name,
        password=args.password,
        password_hash=args.password_hash,
        user_uuid=args.user_uuid,
    )
    if rc < 0:
        return 1
    if args.full:
        seed_full(admin_user_name=args.user_name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
