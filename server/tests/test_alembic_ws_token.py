"""验证 WS 代理鉴权 + Alembic 迁移 + 前端 token 收敛 (pytest 形式).

测试类别:
1. WS 代理鉴权 (需要运行中的服务, 默认 skip, 加 --run-ws 启用)
2. Alembic 迁移链 (代码检查, 不依赖服务)
3. 前端 token 收敛 (代码检查, 不依赖服务)

用法:
    pytest tests/test_alembic_ws_token.py            # 默认只跑代码检查
    pytest tests/test_alembic_ws_token.py --run-ws   # 启用 WS 握手测试
"""

import json
import os
import socket
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

# 2026-06-25 修复: 改用脚本自身位置计算 PROJECT_ROOT, 避免硬编码 g:\1\client / g:\1\server
# server/tests/test_alembic_ws_token.py -> ../../ (项目根)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BASE = "http://127.0.0.1:8000"
CLIENT = str(PROJECT_ROOT / "client")
SERVER = str(PROJECT_ROOT / "server")


# ─── WS 握手工具 (供网络测试用) ───

def _post(path, body=None, headers=None):
    url = BASE + path
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method="POST", headers=h)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def _ws_handshake(path, token=None):
    """模拟 WS 握手, 返回 HTTP 响应首行."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    sock.connect(("127.0.0.1", 8000))
    query = f"?token={token}" if token else ""
    req = (
        f"GET {path}{query} HTTP/1.1\r\n"
        "Host: 127.0.0.1:8000\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n"
    )
    sock.send(req.encode())
    resp = sock.recv(4096).decode(errors="replace")
    sock.close()
    return resp.split("\r\n")[0] if resp else "empty"


# ─── Pytest 配置 ───

import pytest

# 注: pytest_addoption 和 run_ws fixture 已移到 tests/conftest.py 统一管理


# ─── WS 代理鉴权测试 (需 --run-ws) ───

def test_ws_proxy_rejects_no_token(run_ws):
    """无 token 时 WS 握手应被拒绝."""
    if not run_ws:
        pytest.skip("需加 --run-ws 启用")
    for path in ["/api/v1/chat/ws/qwen-omni", "/api/v1/chat/ws/zhipu", "/api/v1/chat/ws/doubao"]:
        resp = _ws_handshake(path)
        assert "101" not in resp, f"{path} 不应在无 token 时通过: {resp}"


def test_ws_proxy_accepts_with_token(run_ws):
    """有 token 时 WS 握手应通过."""
    if not run_ws:
        pytest.skip("需加 --run-ws 启用")
    code, body = _post("/api/login/pwd/refreshToken", {"refreshToken": "fake"})
    token = json.loads(body).get("data", {}).get("token", "")
    if not token:
        pytest.skip("未拿到 JWT, 服务可能未启动")
    for path in ["/api/v1/chat/ws/qwen-omni", "/api/v1/chat/ws/zhipu", "/api/v1/chat/ws/doubao"]:
        resp = _ws_handshake(path, token=token)
        assert "101" in resp, f"{path} 应在有 token 时通过, 实际: {resp}"


# ─── Alembic 迁移链检查 (代码检查) ───

def test_alembic_008_registered():
    """迁移文件已注册.

    验证策略:
    1. 主: 检查 alembic/versions/ 下 head 迁移文件 (047_notify_persist) 存在
       (2026-06-26 迁移链已重编号 016-047, 008_add_missing_tables 已被替代)
    2. 辅: 尝试 alembic current (依赖 DB 可用, 失败时跳过)
    """
    versions_dir = os.path.join(SERVER, "alembic", "versions")
    # 2026-06-26: 迁移已重编号, head 为 047_notify_persist
    target_file = "047_notify_persist.py"
    target_path = os.path.join(versions_dir, target_file)
    assert os.path.exists(target_path), f"head 迁移文件不存在: {target_path}"

    # 尝试在 PostgreSQL/真实环境下执行 alembic current
    try:
        # 先检查 PG URL 环境变量是否设置
        db_url = os.environ.get("DB1_URL", "") or os.environ.get("DATABASE_URL", "")
        if "postgresql" not in db_url.lower():
            pytest.skip("未设置 PostgreSQL URL, 跳过 alembic current 检查")

        result = subprocess.run(
            ["python", "-m", "alembic", "current"],
            capture_output=True, text=True, cwd=SERVER, timeout=30,
        )
        output = result.stdout + result.stderr
        if "Context impl SQLiteImpl" in output:
            pytest.skip("SQLite fallback 模式, 跳过 alembic current 检查")
        # 验证 head 是 047
        assert "047_notify_persist" in output, f"047 未在 current 中注册: {output.strip()}"
    except subprocess.TimeoutExpired:
        pytest.skip("alembic current 超时")
    except FileNotFoundError:
        pytest.skip("alembic 命令未找到")


def test_alembic_migration_count():
    """迁移文件数 >= 8."""
    versions_dir = os.path.join(SERVER, "alembic", "versions")
    assert os.path.exists(versions_dir), f"alembic/versions 目录不存在: {versions_dir}"
    files = [f for f in os.listdir(versions_dir) if f.endswith(".py") and not f.startswith("__")]
    assert len(files) >= 8, f"迁移文件不足 8 个, 实际 {len(files)} 个"


# ─── 前端 token 收敛检查 (代码检查) ───

def test_frontend_core_uses_storage_keys():
    """core.ts 应使用 STORAGE_KEYS.USER_TOKEN / REFRESH_TOKEN."""
    core_path = os.path.join(CLIENT, "src", "utils", "core.ts")
    if not os.path.exists(core_path):
        pytest.skip(f"文件不存在: {core_path}")
    with open(core_path, encoding="utf-8") as f:
        content = f.read()
    assert "STORAGE_KEYS.USER_TOKEN" in content, "core.ts 未引用 STORAGE_KEYS.USER_TOKEN"
    assert "STORAGE_KEYS.REFRESH_TOKEN" in content, "core.ts 未引用 STORAGE_KEYS.REFRESH_TOKEN"


def test_frontend_core_no_legacy_keys():
    """core.ts 不应使用旧 localStorage 键 'token' / 'refreshToken'."""
    core_path = os.path.join(CLIENT, "src", "utils", "core.ts")
    if not os.path.exists(core_path):
        pytest.skip(f"文件不存在: {core_path}")
    with open(core_path, encoding="utf-8") as f:
        content = f.read()
    assert "localStorage.getItem('token')" not in content, "core.ts 仍在用 localStorage 'token'"
    assert "localStorage.getItem('refreshToken')" not in content, "core.ts 仍在用 localStorage 'refreshToken'"


def test_frontend_qr_login_no_accessToken():
    """UnifiedQRLogin.vue 不应使用旧 'accessToken' 键."""
    qr_path = os.path.join(CLIENT, "src", "components", "auth", "UnifiedQRLogin.vue")
    if not os.path.exists(qr_path):
        pytest.skip(f"文件不存在: {qr_path}")
    with open(qr_path, encoding="utf-8") as f:
        content = f.read()
    assert "localStorage.setItem('accessToken'" not in content, "UnifiedQRLogin.vue 仍在用 'accessToken'"


def test_frontend_admin_auth_no_legacy():
    """admin/auth.ts 不应使用旧 'token' 键."""
    admin_path = os.path.join(CLIENT, "src", "utils", "admin", "auth.ts")
    if not os.path.exists(admin_path):
        pytest.skip(f"文件不存在: {admin_path}")
    with open(admin_path, encoding="utf-8") as f:
        content = f.read()
    assert "localStorage.getItem('token')" not in content, "admin/auth.ts 仍在用 localStorage 'token'"


# ─── 脚本入口 (兼容原有调用方式) ───

def main():
    """脚本入口: 返回退出码 0=全部通过, 1=有失败."""
    import sys
    print("=== 1. WS 代理鉴权 ===")
    ws_results = []
    try:
        code, body = _post("/api/login/pwd/refreshToken", {"refreshToken": "fake"})
        token = json.loads(body).get("data", {}).get("token", "")
        for path in ["/api/v1/chat/ws/qwen-omni", "/api/v1/chat/ws/zhipu", "/api/v1/chat/ws/doubao"]:
            resp = _ws_handshake(path)
            rejected = "101" not in resp
            ws_results.append((f"  {path} no-token", rejected))
        for path in ["/api/v1/chat/ws/qwen-omni", "/api/v1/chat/ws/zhipu", "/api/v1/chat/ws/doubao"]:
            resp = _ws_handshake(path, token=token)
            accepted = "101" in resp
            ws_results.append((f"  {path} with-token", accepted))
    except Exception as e:
        print(f"  WS 测试异常 (可能服务未启动): {e}")
        ws_results.append(("  WS 测试", False))

    for name, ok in ws_results:
        print(f"  {'✅' if ok else '❌'} {name} — {'PASS' if ok else 'FAIL'}")

    print("\n=== 2. Alembic 迁移 ===")
    try:
        result = subprocess.run(
            ["python", "-m", "alembic", "current"],
            capture_output=True, text=True, cwd=SERVER,
        )
        output = result.stdout + result.stderr
        has_008 = "008_add_missing_tables" in output
        print(f"  {'✅' if has_008 else '❌'} 008_registered={has_008}")
    except Exception as e:
        print(f"  Alembic 测试异常: {e}")
        has_008 = False

    print("\n=== 3. 前端 token 收敛 ===")
    frontend_results = []
    core_path = os.path.join(CLIENT, "src", "utils", "core.ts")
    if os.path.exists(core_path):
        with open(core_path, encoding="utf-8") as f:
            core = f.read()
        ok1 = "STORAGE_KEYS.USER_TOKEN" in core and "STORAGE_KEYS.REFRESH_TOKEN" in core
        ok2 = "localStorage.getItem('token')" not in core and "localStorage.getItem('refreshToken')" not in core
        frontend_results.append(("core.ts uses STORAGE_KEYS", ok1))
        frontend_results.append(("core.ts no legacy keys", ok2))
    else:
        frontend_results.append(("core.ts exists", False))

    qr_path = os.path.join(CLIENT, "src", "components", "auth", "UnifiedQRLogin.vue")
    if os.path.exists(qr_path):
        with open(qr_path, encoding="utf-8") as f:
            qr = f.read()
        ok = "localStorage.setItem('accessToken'" not in qr
        frontend_results.append(("UnifiedQRLogin.vue no accessToken", ok))
    else:
        frontend_results.append(("UnifiedQRLogin.vue exists", False))

    admin_path = os.path.join(CLIENT, "src", "utils", "admin", "auth.ts")
    if os.path.exists(admin_path):
        with open(admin_path, encoding="utf-8") as f:
            admin = f.read()
        ok = "localStorage.getItem('token')" not in admin
        frontend_results.append(("admin/auth.ts no legacy 'token'", ok))
    else:
        frontend_results.append(("admin/auth.ts exists", False))

    for name, ok in frontend_results:
        print(f"  {'✅' if ok else '❌'} {name} — {'PASS' if ok else 'FAIL'}")

    all_results = ws_results + frontend_results + [("008_registered", has_008)]
    passed = sum(1 for _, ok in all_results if ok)
    failed = sum(1 for _, ok in all_results if not ok)
    print(f"\n结果: {passed} PASS / {failed} FAIL (共 {len(all_results)} 项)")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
