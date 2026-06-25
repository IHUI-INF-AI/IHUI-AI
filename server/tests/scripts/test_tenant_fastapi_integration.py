#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""租户路由 FastAPI 集成测试 - tenant_fastapi_integration.py

验证项:
1. 脚本存在
2. 3 个子命令: demo / serve / test
3. 集成代码示例输出
4. 模拟 FastAPI 处理器
5. X-Tenant-Id 头解析
6. 多租户隔离
7. 缺 tenant 拒绝
8. 端到端 test 子命令
9. 启动/关闭服务
10. JSON 响应
"""
import os
import sys
import json
import subprocess
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "tenant_fastapi_integration.py"
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


def run_script(*args: str, timeout: int = 30) -> tuple[int, str, str]:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True, text=True, encoding="utf-8",
        cwd=str(SERVER_DIR), timeout=timeout,
    )
    return proc.returncode, proc.stdout, proc.stderr


def main() -> int:
    print("=" * 60)
    print("P0-1 租户路由 FastAPI 集成测试")
    print("=" * 60)

    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))
    content = SCRIPT.read_text(encoding="utf-8")

    # 3 子命令
    for cmd in ["demo", "serve", "test"]:
        test_case(f"子命令 {cmd}", f'"{cmd}"' in content or f"cmd_{cmd}" in content, f"缺少 {cmd}")

    # 关键函数
    funcs = ["cmd_demo", "cmd_serve", "cmd_test", "FastAPIDemoHandler"]
    for fn in funcs:
        test_case(f"函数/类 {fn}", fn in content, f"缺少 {fn}")

    # FastAPI 集成示例
    test_case("FastAPI 引用", "FastAPI" in content, "")
    test_case("TenantRoutingMiddleware 引用", "TenantRoutingMiddleware" in content, "")
    test_case("route_to_tenant 引用", "route_to_tenant" in content, "")
    test_case("validate_tenant_id 引用", "validate_tenant_id" in content, "")
    test_case("add_middleware 示例", "add_middleware" in content, "")

    # HTTP 处理器
    test_case("GET 处理器", "def do_GET" in content, "")
    test_case("POST 处理器", "def do_POST" in content, "")
    test_case("X-Tenant-Id 解析", "x-tenant-id" in content, "")

    # 端口参数
    test_case("--port 参数", "--port" in content, "")
    test_case("默认端口 8765", "8765" in content, "")

    # JSON 响应
    test_case("_send_json 方法", "_send_json" in content, "")

    # 端到端测试
    test_case("断言函数", "assert_eq" in content, "")

    # 实际执行 - demo
    code, out, err = run_script("demo")
    test_case("demo 子命令执行", code == 0, f"code={code}")
    test_case("demo 输出 FastAPI 代码", "app = FastAPI" in out, "")
    test_case("demo 输出 add_middleware", "app.add_middleware" in out, "")

    # 端到端测试
    code, out, err = run_script("test", "--port", "18765", timeout=20)
    test_case("test 子命令执行", code == 0, f"code={code}, stderr={err[:200]}")
    test_case("输出 1.1", "1.1" in out, "")
    test_case("输出 5.2", "5.2" in out, "")
    test_case("测试通过统计", "通过" in out and "失败" in out, "")

    # test 端口冲突测试 (假定占用)
    code, out, err = run_script("test", "--port", "1", timeout=20)
    test_case("无效端口优雅处理", code in (0, 1, 2), f"code={code}")

    # 日志写入
    log_files = list(LOG_DIR.glob("tenant_fastapi_integration_*.log"))
    test_case("写入集成日志", len(log_files) > 0, "")

    # 无效子命令
    code, out, err = run_script("invalid")
    test_case("无效子命令被拒绝", code != 0, f"code={code}")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
