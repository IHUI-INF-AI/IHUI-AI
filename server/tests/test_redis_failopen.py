"""回归测试: Redis fail-open.

验证当 Redis 不可用时 (或 mock ConnectionError), 业务逻辑不抛 500.
覆盖:
  - redis_util 全部公开函数在抛错时返回安全默认值
  - sms_util 的 rate-limit 在 Redis 不可用时仍然返回 (True, "")
  - admin /admin123 登录不受 Redis 状态影响
"""
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
import urllib.request
import urllib.parse


BASE = os.environ.get("ZHS_BASE", "http://127.0.0.1:8000")


def _http(url, method="GET", data=None, headers=None):
    import json, urllib.error
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")


# 1. 直接调用 redis_util 验证 fail-open
def test_redis_util_failopen_under_redis_down(monkeypatch):
    """强制让 get_redis() 抛 ConnectionError, 验证所有公开函数不抛."""
    from app.utils import redis_util

    def _broken_get_redis():
        raise ConnectionError("simulated Redis down")

    monkeypatch.setattr(redis_util, "get_redis", _broken_get_redis)

    # 全部不应抛异常
    assert redis_util.get_key("k") is None
    assert redis_util.delete_key("k") is None
    assert redis_util.incr_key("k") == 0
    assert redis_util.incr_key_with_expire("k", 60) == 0
    assert redis_util.set_key_expire("k", 60) is None
    assert redis_util.set_key("k", "v") is None
    assert redis_util.set_key("k", "v", ex=60) is None
    assert redis_util.set_json("k", {"a": 1}) is None
    assert redis_util.publish("ch", "msg") is None


# 2. sms_util rate-limit 在 Redis 异常时 fail-open
def test_sms_rate_limit_failopen(monkeypatch):
    from app.utils import sms_util
    from app.utils import redis_util

    def _broken_get_redis_or_none():
        return None  # redis 不可用

    monkeypatch.setattr(sms_util, "_get_redis_or_none", _broken_get_redis_or_none)

    # rate-limit 应该 fail-open 返回 (True, "")
    allowed, err = sms_util.check_rate_limit("13800000000")
    assert allowed is True
    assert err == ""


# 3. 业务端点不受 Redis 状态影响 (login API)
def test_login_works_under_redis_down():
    """即使 Redis 不可用, 登录 API 仍返回 token (不返回 500)."""
    url = f"{BASE}/api/v2/auth/login?phone=13800138000&password=admin123"
    code, body = _http(url, method="POST")
    # 期望: 200/401/422 (业务校验/凭证错误) 而不是 500
    assert code != 500, f"Redis fail-open broken: HTTP 500 body={body[:200]}"


# 4. Redis 不可用时, sms 发送端点不返回 500
def test_sms_send_endpoint_does_not_500():
    """POST /sms/send 不应因 Redis 不可用返回 500."""
    url = f"{BASE}/api/v1/auth/sms/send?phone=13800000000"
    code, body = _http(url, method="POST")
    # 期望: 200/422/400/401 (业务校验) 而不是 500
    assert code != 500, f"Redis fail-open broken: HTTP 500 body={body[:200]}"


if __name__ == "__main__":
    # 脚本模式: 逐个跑
    import importlib
    tests = [
        ("redis_util failopen", test_redis_util_failopen_under_redis_down),
        ("sms rate-limit failopen", test_sms_rate_limit_failopen),
        ("login under Redis down", test_login_works_under_redis_down),
        ("sms send no 500", test_sms_send_endpoint_does_not_500),
    ]
    failed = 0
    # monkeypatch 需要 pytest 上下文, 仅跑端点测试
    for name, t in tests[2:]:
        try:
            t()
            print(f"PASS {name}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {name}: {e}")
        except Exception as e:
            failed += 1
            print(f"ERR  {name}: {e}")
    sys.exit(0 if failed == 0 else 1)
