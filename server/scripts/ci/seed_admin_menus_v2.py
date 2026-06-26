"""为 7 个历史迁移模块补配 admin_menu 菜单项 (2026-06-26).

幂等设计: 使用 _seed_table 助手, 按 menu_id 判断已存在则跳过.
菜单 ID 从 200 开始, 避免与 seed_admin.py 的 DEFAULT_MENUS (1-109) 冲突.

7 个模块对应的前端路由 (admin.ts):
  - 字典管理     /admin/dict + /admin/dict/data
  - 开发者管理   /admin/developer + /admin/developer/link
  - 需求广场     /admin/demandSquare + /admin/demandSquare/review
  - 日志管理     /admin/log/operlog + /admin/log/logininfor
  - 定时任务     /admin/job + /admin/job/log
  - 在线用户     /admin/online
  - 专区管理     /admin/zone

用法:
    python -m scripts.ci.seed_admin_menus_v2
    # 或在 main.py lifespan 中调用
"""
from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.database import engine1


# 7 个新模块的菜单项 (menu_id 从 200 开始)
# menu_type: M=目录, C=菜单, F=按钮
# path: 相对 /admin 的路径 (不含 /admin 前缀)
# component: 相对 @/views/admin/ 的组件路径 (目录类型用 Layout)
NEW_MENUS = [
    # --- 字典管理 (已有 menu_id=105 历史字典, 新增独立菜单组) ---
    {
        "menu_id": 200,
        "menu_name": "字典管理(新)",
        "parent_id": 0,
        "order_num": 20,
        "path": "dict",
        "component": "dict/index",
        "route_name": "adminDict",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "admin:dict:list",
        "icon": "dict",
    },
    {
        "menu_id": 201,
        "menu_name": "字典数据",
        "parent_id": 200,
        "order_num": 1,
        "path": "dict/data",
        "component": "dict/data",
        "route_name": "adminDictData",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "1",  # 隐藏 (作为字典管理的子页面, 不在侧边栏独立显示)
        "status": "0",
        "perms": "admin:dict:data",
        "icon": "#",
    },
    # --- 开发者管理 ---
    {
        "menu_id": 210,
        "menu_name": "开发者管理",
        "parent_id": 0,
        "order_num": 21,
        "path": "developer",
        "component": "developer/index",
        "route_name": "adminDeveloper",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "admin:developer:list",
        "icon": "people",
    },
    {
        "menu_id": 211,
        "menu_name": "开发者绑定",
        "parent_id": 210,
        "order_num": 1,
        "path": "developer/link",
        "component": "developer/link",
        "route_name": "adminDeveloperLink",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "1",
        "status": "0",
        "perms": "admin:developer:link",
        "icon": "#",
    },
    # --- 需求广场 ---
    {
        "menu_id": 220,
        "menu_name": "需求广场",
        "parent_id": 0,
        "order_num": 22,
        "path": "demandSquare",
        "component": "demandSquare/index",
        "route_name": "adminDemandSquare",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "admin:demand:list",
        "icon": "list",
    },
    {
        "menu_id": 221,
        "menu_name": "需求审核",
        "parent_id": 220,
        "order_num": 1,
        "path": "demandSquare/review",
        "component": "demandSquare/review",
        "route_name": "adminDemandSquareReview",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "1",
        "status": "0",
        "perms": "admin:demand:review",
        "icon": "#",
    },
    # --- 日志管理 (新独立组, 与历史 menu_id=108/109 区分) ---
    {
        "menu_id": 230,
        "menu_name": "日志管理(新)",
        "parent_id": 0,
        "order_num": 23,
        "path": "log",
        "component": "Layout",
        "route_name": "",
        "is_frame": "1",
        "menu_type": "M",
        "visible": "0",
        "status": "0",
        "perms": "",
        "icon": "log",
    },
    {
        "menu_id": 231,
        "menu_name": "操作日志",
        "parent_id": 230,
        "order_num": 1,
        "path": "log/operlog",
        "component": "log/operlog",
        "route_name": "adminLogOperlog",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "admin:log:operlog",
        "icon": "form",
    },
    {
        "menu_id": 232,
        "menu_name": "登录日志",
        "parent_id": 230,
        "order_num": 2,
        "path": "log/logininfor",
        "component": "log/logininfor",
        "route_name": "adminLogLogininfor",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "admin:log:logininfor",
        "icon": "logininfor",
    },
    # --- 定时任务 ---
    {
        "menu_id": 240,
        "menu_name": "定时任务",
        "parent_id": 0,
        "order_num": 24,
        "path": "job",
        "component": "Layout",
        "route_name": "",
        "is_frame": "1",
        "menu_type": "M",
        "visible": "0",
        "status": "0",
        "perms": "",
        "icon": "job",
    },
    {
        "menu_id": 241,
        "menu_name": "任务管理",
        "parent_id": 240,
        "order_num": 1,
        "path": "job",
        "component": "job/index",
        "route_name": "adminJob",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "admin:job:list",
        "icon": "job",
    },
    {
        "menu_id": 242,
        "menu_name": "任务日志",
        "parent_id": 240,
        "order_num": 2,
        "path": "job/log",
        "component": "job/log",
        "route_name": "adminJobLog",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "admin:job:log",
        "icon": "log",
    },
    # --- 在线用户 ---
    {
        "menu_id": 250,
        "menu_name": "在线用户",
        "parent_id": 0,
        "order_num": 25,
        "path": "online",
        "component": "online/index",
        "route_name": "adminOnline",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "admin:online:list",
        "icon": "online",
    },
    # --- 专区管理 ---
    {
        "menu_id": 260,
        "menu_name": "专区管理",
        "parent_id": 0,
        "order_num": 26,
        "path": "zone",
        "component": "zone/index",
        "route_name": "adminZone",
        "is_frame": "1",
        "menu_type": "C",
        "visible": "0",
        "status": "0",
        "perms": "admin:zone:list",
        "icon": "tree",
    },
]


def _table_exists(engine: Engine, table: str) -> bool:
    """检查表是否存在 (跨方言, 使用 inspect)."""
    inspector = inspect(engine)
    return table in inspector.get_table_names()


def _seed_menus(engine: Engine) -> int:
    """幂等插入菜单项 (按 menu_id 判断已存在则跳过)."""
    if not _table_exists(engine, "admin_menu"):
        print("[seed_admin_menus_v2] admin_menu 表不存在, 跳过")
        return -1

    inserted = 0
    with engine.begin() as conn:
        for item in NEW_MENUS:
            existing = conn.execute(
                text("SELECT 1 FROM admin_menu WHERE menu_id = :mid"),
                {"mid": item["menu_id"]},
            ).fetchone()
            if existing:
                continue
            cols = ", ".join(item.keys())
            placeholders = ", ".join(f":{k}" for k in item.keys())
            # 兼容 SQLite/PostgreSQL: create_time/update_time 用 current_timestamp
            conn.execute(
                text(
                    f"INSERT INTO admin_menu ({cols}, create_time, update_time) "
                    f"VALUES ({placeholders}, current_timestamp, current_timestamp)"
                ),
                item,
            )
            inserted += 1
    return inserted


def seed_admin_menus_v2(engine: Engine | None = None) -> int:
    """入口函数: 为 7 个新模块配置菜单项.

    返回:
        >=0: 新插入的菜单数
        -1 : admin_menu 表不存在
    """
    engine = engine or engine1
    try:
        inserted = _seed_menus(engine)
        if inserted >= 0:
            print(f"[seed_admin_menus_v2] 完成: 新增 {inserted} 条菜单 (共 {len(NEW_MENUS)} 条定义)")
        return inserted
    except Exception as e:
        print(f"[seed_admin_menus_v2] 失败: {e}")
        return -1


if __name__ == "__main__":
    seed_admin_menus_v2()
