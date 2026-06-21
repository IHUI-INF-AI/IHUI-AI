"""API v2 渐进迁移规划与执行脚本.

按 tag 分批迁移 v1 → v2, 策略:
  - v1 保持 100% 兼容 (永不删除)
  - v2 用白名单方式引入新接口
  - 按 tag 优先级分批迁移 (P0: 核心, P1: 业务, P2: 辅助)
  - 每批迁移后跑回归测试

迁移批次:
  P0 (核心, 立即迁移):
    - Authentication (26 端点)
    - Users (2 端点)
    - System Admin (30 端点)

  P1 (业务, 第二批):
    - Courses Ext (29 端点)
    - Exam (32 端点)
    - Point (32 端点)
    - Message (28 端点)
    - Notification (26 端点)

  P2 (辅助, 第三批):
    - Behavior (34 端点)
    - Ask (26 端点)
    - Search (18 端点)
    - Organization (18 端点)
    - Live (22 端点)
    - Remote Device (22 端点)

用法:
  python scripts/v2_migration_plan.py                    # 显示迁移规划
  python scripts/v2_migration_plan.py --batch P0         # 显示 P0 批次详情
  python scripts/v2_migration_plan.py --migrate auth     # 迁移指定 tag
  python scripts/v2_migration_plan.py --verify           # 验证已迁移端点
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# 迁移批次规划 (tag → 优先级)
MIGRATION_BATCHES = {
    "P0": {
        "description": "核心 - 立即迁移",
        "tags": ["Authentication", "Users", "System Admin", "Username Login"],
    },
    "P1": {
        "description": "业务 - 第二批",
        "tags": ["Courses Ext", "Exam", "Point", "Message", "Notification", "System"],
    },
    "P2": {
        "description": "辅助 - 第三批",
        "tags": ["Behavior", "Ask", "Search", "Organization", "Live", "Remote Device"],
    },
    "P3": {
        "description": "低频 - 第四批",
        "tags": ["Captcha", "Ali Login", "Feishu Auth", "Enterprise WeChat", "Auth: Alipay"],
    },
}


def get_openapi_schema() -> dict:
    """获取 OpenAPI schema."""
    from fastapi.openapi.utils import get_openapi
    from app.main import app

    return get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )


def get_tag_stats(schema: dict) -> dict:
    """统计每个 tag 的端点数和路径."""
    tag_stats = {}
    for path, path_data in schema.get("paths", {}).items():
        for method, method_data in path_data.items():
            for tag in method_data.get("tags", []):
                if tag not in tag_stats:
                    tag_stats[tag] = {"count": 0, "paths": [], "methods": []}
                tag_stats[tag]["count"] += 1
                tag_stats[tag]["paths"].append(path)
                tag_stats[tag]["methods"].append(method.upper())
    return tag_stats


def show_plan() -> int:
    """显示迁移规划."""
    print("=" * 70)
    print("API v2 渐进迁移规划 (按 tag 分批)")
    print("=" * 70)

    try:
        schema = get_openapi_schema()
        tag_stats = get_tag_stats(schema)
    except Exception as e:
        print(f"❌ 无法获取 OpenAPI schema: {e}")
        return 1

    total_paths = len(schema.get("paths", {}))
    print(f"\n总端点数: {total_paths}")
    print(f"总 tag 数: {len(tag_stats)}")

    for batch, info in MIGRATION_BATCHES.items():
        print(f"\n[{batch}] {info['description']}")
        batch_count = 0
        for tag in info["tags"]:
            stat = tag_stats.get(tag, {"count": 0})
            count = stat["count"]
            batch_count += count
            print(f"  - {tag}: {count} 端点")
        print(f"  小计: {batch_count} 端点")

    return 0


def show_batch(batch: str) -> int:
    """显示指定批次详情."""
    if batch not in MIGRATION_BATCHES:
        print(f"❌ 未知批次: {batch} (可选: {list(MIGRATION_BATCHES.keys())})")
        return 1

    info = MIGRATION_BATCHES[batch]
    print(f"\n[{batch}] {info['description']}")
    print("=" * 70)

    try:
        schema = get_openapi_schema()
        tag_stats = get_tag_stats(schema)
    except Exception as e:
        print(f"❌ 无法获取 OpenAPI schema: {e}")
        return 1

    for tag in info["tags"]:
        stat = tag_stats.get(tag, {"count": 0, "paths": [], "methods": []})
        print(f"\n  Tag: {tag} ({stat['count']} 端点)")
        for path, method in zip(stat["paths"], stat["methods"]):
            print(f"    {method:6s} {path}")

    return 0


def migrate_tag(tag: str) -> int:
    """迁移指定 tag (生成 v2 路由模板)."""
    print(f"\n迁移 tag: {tag}")
    print("=" * 70)

    try:
        schema = get_openapi_schema()
        tag_stats = get_tag_stats(schema)
    except Exception as e:
        print(f"❌ 无法获取 OpenAPI schema: {e}")
        return 1

    stat = tag_stats.get(tag)
    if not stat:
        print(f"❌ tag '{tag}' 不存在")
        return 1

    print(f"  端点数: {stat['count']}")
    print(f"  路径数: {len(stat['paths'])}")

    # 生成 v2 路由模板
    tag_slug = tag.lower().replace(" ", "_").replace(":", "")
    v2_file = ROOT / "app" / "api" / f"v2_{tag_slug}.py"

    if v2_file.exists():
        print(f"  ⚠️  v2 文件已存在: {v2_file} (跳过生成)")
        return 0

    # 生成 v2 路由代码 (不用 prefix, 直接用完整路径, 避免路径不匹配)
    routes_code = ['"""v2 迁移: %s tag\n\n从 v1 → v2 渐进迁移, v1 保持兼容.\n"""' % tag, ""]
    routes_code.append("from fastapi import APIRouter, Request")
    routes_code.append("from app.schemas.common import success")
    routes_code.append("")
    routes_code.append('router = APIRouter(tags=["API v2: %s"])' % tag)
    routes_code.append("")

    for path, method in zip(stat["paths"], stat["methods"]):
        # v1 path → v2 path (只替换一次, 避免 /api/v2/ 被再次替换)
        if path.startswith("/api/v1/"):
            v2_path = "/api/v2/" + path[len("/api/v1/"):]
        elif path.startswith("/api/"):
            v2_path = "/api/v2/" + path[len("/api/"):]
        else:
            v2_path = path
        # 路由函数名
        func_name = method.lower() + "_" + path.strip("/").replace("/", "_").replace("-", "_").replace("{", "").replace("}", "").replace(":", "")
        # 简化函数名
        if len(func_name) > 60:
            func_name = func_name[:60]

        routes_code.append("@router.%s(\"%s\", summary=\"[v2] %s %s\")" % (
            method.lower(),
            v2_path,
            method,
            path,
        ))
        routes_code.append("async def %s(request: Request):" % func_name)
        routes_code.append('    """v2 端点 (从 v1 迁移)."""')
        routes_code.append('    return success(data={"migrated": True, "v1_path": "%s", "v2_path": "%s"})' % (path, v2_path))
        routes_code.append("")

    v2_file.write_text("\n".join(routes_code), encoding="utf-8")
    print(f"  ✅ 生成 v2 路由文件: {v2_file}")
    print(f"  ℹ️  下一步: 在 app/main.py 注册 router")
    print(f"     from app.api.v2_{tag_slug} import router as v2_{tag_slug}_router")
    print(f"     app.include_router(v2_{tag_slug}_router)")
    return 0


def verify_migration() -> int:
    """验证已迁移的 v2 端点."""
    print("\n验证 v2 迁移状态")
    print("=" * 70)

    try:
        schema = get_openapi_schema()
    except Exception as e:
        print(f"❌ 无法获取 OpenAPI schema: {e}")
        return 1

    v2_paths = [p for p in schema.get("paths", {}) if p.startswith("/api/v2/")]
    v1_paths = [p for p in schema.get("paths", {}) if p.startswith("/api/v1/")]

    print(f"  v1 端点: {len(v1_paths)}")
    print(f"  v2 端点: {len(v2_paths)}")
    print(f"  迁移率: {len(v2_paths) * 100 / max(len(v1_paths), 1):.1f}%")

    if v2_paths:
        print(f"\n  已迁移的 v2 端点:")
        for p in v2_paths[:20]:
            print(f"    {p}")
        if len(v2_paths) > 20:
            print(f"    ... 还有 {len(v2_paths) - 20} 个")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="API v2 渐进迁移规划")
    parser.add_argument("--batch", help="显示指定批次详情 (P0/P1/P2/P3)")
    parser.add_argument("--migrate", help="迁移指定 tag")
    parser.add_argument("--verify", action="store_true", help="验证迁移状态")
    args = parser.parse_args()

    if args.verify:
        return verify_migration()
    if args.batch:
        return show_batch(args.batch)
    if args.migrate:
        return migrate_tag(args.migrate)
    return show_plan()


if __name__ == "__main__":
    sys.exit(main())
