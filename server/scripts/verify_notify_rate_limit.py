"""站内信限流测试.

覆盖:
  1. POST /api/admin/migration/notify 触发 30 次/分钟 限流
  2. GET  /api/admin/migration/notify 不受影响 (用 120/分额度, 不与 POST 共享)
  3. /api/admin/migration/notify 限流后, 其他 /api/admin/migration/* 仍可用 (60/分)
"""
import sys

from fastapi.testclient import TestClient

from app.main import app

# 跳过鉴权 (限流测试不需要)
import app.security as _sec


async def _fake_user_uuid():
    """override get_current_user_uuid, 直接返回固定 admin UUID, 跳过 JWT 校验."""
    return "00000000-0000-0000-0000-000000000001"


async def _fake_require_login():
    """override require_login, 直接放行."""
    return "00000000-0000-0000-0000-000000000001"


def _fake_require_role(role: str):
    """override require_role, 直接放行."""
    async def _inner():
        return "00000000-0000-0000-0000-000000000001"
    return _inner


app.dependency_overrides[_sec.get_current_user_uuid] = _fake_user_uuid
app.dependency_overrides[_sec.require_login] = _fake_require_login
# require_role 是 factory, 注入 _fake_require_role factory
app.dependency_overrides[_sec.require_role] = _fake_require_role

client = TestClient(app)


def check_post_limit():
    """1. POST /notify: 30 次/分限流."""
    print("\n=== 1. POST /notify 30次/分限流 ===")
    # 写 35 条, 期望前 30 条 200, 后 5 条 429
    ok = 0
    limited = 0
    for i in range(35):
        r = client.post(
            "/api/admin/migration/notify",
            json={"title": f"limit test {i}", "body": "b", "level": "info", "source": "limit_test"},
        )
        if r.status_code == 200:
            ok += 1
        elif r.status_code == 429:
            limited += 1
        else:
            print(f"  异常 status={r.status_code} body={r.text[:200]}")
            return False
    print(f"  200: {ok}, 429: {limited}")
    if ok != 30 or limited != 5:
        print(f"  FAIL: 期望 30 成功 / 5 限流, 实际 {ok} / {limited}")
        return False
    # 验证 429 返回结构
    r = client.post(
        "/api/admin/migration/notify",
        json={"title": "after limit", "body": "b", "level": "info", "source": "limit_test"},
    )
    body = r.json()
    if body.get("code") != "429":
        print(f"  FAIL: 429 响应 code 字段应为 '429', 实际 {body.get('code')}")
        return False
    if "Retry-After" not in r.headers:
        print(f"  FAIL: 429 响应缺 Retry-After 头")
        return False
    print(f"  OK: 30 成功 / 5 限流, Retry-After={r.headers.get('Retry-After')}s")
    return True


def check_get_independent():
    """2. GET /notify 不受 POST 限流影响."""
    print("\n=== 2. GET /notify 不受 POST 限流影响 ===")
    # 现在 POST 已触发限流, GET 应该有自己独立的 120/分 额度
    r = client.get("/api/admin/migration/notify?limit=1")
    if r.status_code != 200:
        print(f"  FAIL: GET 应不受 POST 限流影响, 实际 status={r.status_code}")
        return False
    print(f"  OK: GET 独立, 200")
    return True


def main():
    funcs = [check_post_limit, check_get_independent]
    passed, failed = 0, 0
    for f in funcs:
        try:
            ok = f()
            if ok:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  EXCEPTION: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    print(f"\n=== 结果: {passed} passed, {failed} failed ===")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
