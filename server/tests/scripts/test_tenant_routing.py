#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""多租户 schema 路由中间件测试 - tenant_routing.py

验证项:
1. 脚本存在
2. 4 个子命令: route/health/list/validate
3. 租户 ID 校验正则
4. 白名单校验
5. schema 名称构造
6. 路由成功 (dry-run)
7. 路由失败 (无效 tenant)
8. 路由失败 (白名单拒绝)
9. 健康检查
10. 租户列表
11. validate 子命令
12. Middleware 类定义
13. 环境变量读取
14. 历史记录追加
"""
import os
import sys
import json
import subprocess
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "tenant_routing.py"
LOG_DIR = SERVER_DIR / "logs"

passed = 0
failed = 0


def test_case(name: str, ok: bool, detail: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name} -- {detail}")


def run_script(*args: str) -> tuple[int, str, str]:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=str(SERVER_DIR),
    )
    return proc.returncode, proc.stdout, proc.stderr


def main() -> int:
    print("=" * 60)
    print("P0-1 租户路由 Python 中间件测试")
    print("=" * 60)

    # 1. 脚本存在
    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))

    content = SCRIPT.read_text(encoding="utf-8")

    # 2. 4 个子命令
    for cmd in ["route", "health", "list", "validate"]:
        test_case(f"子命令 {cmd}", f'"{cmd}"' in content or f"cmd_{cmd}" in content, f"缺少 {cmd}")

    # 3. 关键函数
    funcs = ["validate_tenant_id", "is_tenant_allowed", "build_schema_name", "route_to_tenant", "check_tenant_health", "list_tenants", "append_history"]
    for fn in funcs:
        test_case(f"函数 {fn}", f"def {fn}(" in content, f"缺少 {fn}")

    # 4. TenantRoutingMiddleware 类
    test_case("Middleware 类", "class TenantRoutingMiddleware" in content, "")

    # 5. 租户 ID 正则
    test_case("TENANT_ID_PATTERN 正则", "TENANT_ID_PATTERN" in content, "")
    test_case("正则校验字母数字下划线", r"^[a-zA-Z0-9_]{1,64}$" in content, "")

    # 6. 白名单
    test_case("DEFAULT_TENANT_WHITELIST", "DEFAULT_TENANT_WHITELIST" in content, "")
    test_case("包含租户 zhs", '"zhs"' in content, "")
    test_case("包含租户 demo", '"demo"' in content, "")
    test_case("包含租户 test", '"test"' in content, "")

    # 7. schema 构造
    test_case("schema 名称 tenant_ 前缀", "build_schema_name" in content and "tenant_" in content, "")

    # 8. 数据库连接
    env_vars = ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"]
    for v in env_vars:
        test_case(f"环境变量 {v}", v in content, f"缺少 {v}")

    # 9. 实际执行 - list
    code, out, err = run_script("list")
    test_case("list 子命令执行", code == 0, f"code={code}")
    test_case("list 输出含 zhs", "zhs" in out, "")

    # 10. validate 合法 tenant
    code, out, err = run_script("validate", "--tenant", "zhs_prod_2026")
    test_case("validate 合法 tenant", code == 0, f"code={code}")
    test_case("validate valid=true", '"valid": true' in out, "")

    # 11. validate 非法 tenant
    code, out, err = run_script("validate", "--tenant", "invalid-tenant!")
    test_case("validate 非法 tenant 被拒绝", code != 0, f"code={code}")
    test_case("validate 错误信息", "不合法" in out or "格式" in out or "validation" in err, "")

    # 12. route dry-run
    code, out, err = run_script("route", "--tenant", "zhs", "--dry-run")
    test_case("route --dry-run 执行", code == 0, f"code={code}")
    test_case("route 输出含 schema_name", "tenant_zhs" in out, "")
    test_case("route 输出含 search_path", "search_path" in out, "")

    # 13. route 不存在租户
    code, out, err = run_script("route", "--tenant", "nonexistent_tenant", "--dry-run")
    test_case("不存在租户被拒绝", code != 0, f"code={code}")
    test_case("错误信息含 whitelist", "whitelist" in out or "白名单" in out, "")

    # 14. health 子命令
    code, out, err = run_script("health", "--tenant", "zhs")
    test_case("health 子命令执行", code in (0, 1), f"code={code}")

    # 15. health 非法 tenant
    code, out, err = run_script("health", "--tenant", "bad-tenant")
    test_case("health 非法 tenant 被拒绝", code != 0, f"code={code}")

    # 16. 无子命令
    code, out, err = run_script()
    test_case("无子命令被拒绝", code != 0, f"code={code}")

    # 17. 日志写入
    log_files = list(LOG_DIR.glob("tenant_routing_*.log"))
    test_case("写入路由日志", len(log_files) > 0, "")

    # 18. history 文件
    history_file = LOG_DIR / "tenant_routing_history.jsonl"
    test_case("写入 history 文件", history_file.exists(), "")

    # 19. contextmanager
    test_case("使用 contextmanager", "@contextmanager" in content, "")

    # 20. ASGI 头解析
    test_case("解析 X-Tenant-Id 头", "x-tenant-id" in content, "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
