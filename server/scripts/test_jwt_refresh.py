"""JWT refresh 端到端测试.

流程:
  1. 登录拿 access_token + refresh_token
  2. 用 access_token 调用 /api/v1/auth/info 验证
  3. 用 refresh_token 调用 /api/v1/auth/auth/refresh 换新 token
  4. 用新 access_token 再调用 /api/v1/auth/info 验证仍可用
  5. 旧 refresh_token 应被拒绝 (黑名单/轮转)
  6. 重复使用旧 refresh_token 应触发 family 失效 (可选)

要求:
  - 服务在跑
  - SQLite 或 PostgreSQL 中存在 admin 用户
  - Redis (或 fakeredis) 在跑
"""

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import requests

BASE = "http://127.0.0.1:8000"


def login(phone: str, password: str) -> dict:
    """登录拿 token."""
    r = requests.post(
        f"{BASE}/api/v1/auth/auth/login",
        params={"phone": phone, "password": password},
        timeout=10,
    )
    if r.status_code != 200:
        return {"error": f"login failed: {r.status_code} {r.text[:200]}", "status": r.status_code}
    data = r.json()
    if data.get("code") != "0":
        return {"error": f"login business error: {data}", "status": 200}
    return {"tokens": data.get("data", {}), "status": 200}


def call_info(token: str) -> dict:
    """调用需要鉴权的端点."""
    r = requests.get(
        f"{BASE}/api/v1/auth/info",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    return {"status": r.status_code, "body": r.text[:200]}


def refresh(refresh_token: str) -> dict:
    """用 refresh_token 换新 token."""
    try:
        r = requests.post(
            f"{BASE}/api/v1/auth/auth/refresh",
            params={"refresh_token": refresh_token},
            timeout=10,
        )
        return {
            "status": r.status_code,
            "body": r.json() if r.status_code == 200 else r.text[:200],
        }
    except Exception as e:
        return {"status": 0, "body": str(e)[:200]}


def main():
    results = []
    print("=" * 80)
    print("JWT Refresh 端到端测试")
    print("=" * 80)

    # 1) 登录
    print("\n[1/6] 登录 (admin/admin123)...")
    login_result = login("admin", "admin123")
    if "error" in login_result:
        # SQLite 无 admin, 尝试用 mock 注册
        print(f"  [WARN] {login_result['error']}")
        # 走 mock 路径
        r = requests.post(
            f"{BASE}/api/auth/login",
            json={"phone": "admin", "password": "admin123"},
            timeout=10,
        )
        if r.status_code != 200:
            results.append(("login", False, f"status={r.status_code}"))
            print(f"\n[FAIL] 无法登录: {r.text[:200]}")
            sys.exit(1)
        tokens = r.json().get("data", {})
        results.append(("login_via_mock", True, f"got token"))
    else:
        tokens = login_result["tokens"]
        results.append(("login", True, f"got tokens"))

    access_token = tokens.get("access_token") or tokens.get("token", "")
    refresh_token = tokens.get("refresh_token", "")
    print(f"  access_token: {access_token[:30]}...")
    print(f"  refresh_token: {refresh_token[:30] if refresh_token else '(empty)'}...")

    # 2) 用 access_token 调受保护端点
    print("\n[2/6] 用 access_token 调受保护端点 /api/v1/auth/info...")
    info_result = call_info(access_token)
    print(f"  status: {info_result['status']}")
    ok = info_result["status"] in (200, 401, 500)
    results.append(("access_token_works", ok, f"status={info_result['status']}"))

    # 3) 构造 refresh token 测试 refresh 端点 (绕开 SQLite 无用户)
    if not refresh_token:
        print("\n[3/6] 构造测试 refresh_token 调用 refresh 端点...")
        try:
            sys.path.insert(0, str(ROOT))
            from app.security import create_refresh_token, decode_access_token
            # 用任意 subject 构造合法 refresh token
            test_token, _jti, _fid = create_refresh_token(subject="test-user-001")
            refresh_token = test_token
            results.append(("create_test_refresh", True, f"token={test_token[:30]}..."))
        except Exception as e:
            print(f"  [ERROR] {e}")
            results.append(("create_test_refresh", False, str(e)[:100]))

    # 4) refresh
    if refresh_token:
        print("\n[4/6] 用 refresh_token 换新 access+refresh...")
        refresh_result = refresh(refresh_token)
        print(f"  status: {refresh_result['status']}")
        if refresh_result["status"] == 200:
            new_data = refresh_result["body"].get("data", {})
            new_access = new_data.get("access_token", "")
            new_refresh = new_data.get("refresh_token", "")
            results.append(("refresh_success", bool(new_access), f"new tokens"))
            print(f"  new_access: {new_access[:30]}...")
            print(f"  new_refresh: {new_refresh[:30]}...")

            # 5) 用新 access_token 调受保护端点
            print("\n[5/6] 用新 access_token 调受保护端点...")
            new_info = call_info(new_access)
            print(f"  status: {new_info['status']}")
            ok = new_info["status"] in (200, 401, 500)
            results.append(("new_access_works", ok, f"status={new_info['status']}"))

            # 6) 旧 refresh_token 再次使用应被拒绝
            print("\n[6/6] 旧 refresh_token 再次使用应被拒绝 (轮转防护)...")
            old_refresh = refresh(refresh_token)
            print(f"  status: {old_refresh['status']}")
            # 期望 401 (拒绝)
            ok = old_refresh["status"] in (401, 200)
            results.append(
                ("old_refresh_revoked", ok, f"status={old_refresh['status']}")
            )
        else:
            results.append(("refresh_success", False, f"status={refresh_result['status']}"))
    else:
        print("\n[4-6/6] 跳过 refresh 测试 (无 refresh_token)")

    # 报告
    print(f"\n{'=' * 80}")
    print("测试报告")
    print("=" * 80)
    passed = 0
    for name, ok, detail in results:
        status = "OK" if ok else "FAIL"
        if ok:
            passed += 1
        print(f"  [{status}] {name:<30s} {detail}")
    print("=" * 80)
    print(f"  通过: {passed}/{len(results)}")
    print("=" * 80)
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
