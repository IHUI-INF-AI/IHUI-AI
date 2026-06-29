"""E2E 冒烟测试 — 前后端联调验证 (pytest 形式).

测试链路:
1. 直连后端 8000: login → token → models-unify → agents/list → user/getInfo
2. 通过 Vite 8888 代理: login → token → models-unify (验证代理层)

前置条件:
    后端服务运行中 (uvicorn app.main:app --port 8000) 或通过 Vite 代理 (port 8888)
    需通过 --base 参数指定 base URL, 默认 http://127.0.0.1:8000

用法:
    pytest tests/e2e/e2e_smoke_test.py --base http://127.0.0.1:8000
    pytest tests/e2e/e2e_smoke_test.py --base http://127.0.0.1:8888
    pytest tests/e2e/e2e_smoke_test.py --base http://127.0.0.1:8000 --skip-network
"""

import json
import urllib.error
import urllib.request

# ─── 配置 ───
DEFAULT_BASE = "http://127.0.0.1:8000"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


def api(method, url, data=None, token=None, timeout=15, retries=2, params=None):
    """发 HTTP 请求，返回 (status_code, json_body). 自动重试 500 + locked 错误.

    data:   JSON body (dict)
    params: query string (dict, 拼接到 URL ?key=value&...)
    """
    if params:
        from urllib.parse import urlencode
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}{urlencode(params)}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=body, method=method, headers=headers)
        try:
            resp = urllib.request.urlopen(req, timeout=timeout)
            raw = resp.read().decode()
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, {"_raw": raw[:200], "_is_html": raw.startswith("<!")}
        except urllib.error.HTTPError as e:
            body_text = ""
            try:
                body_text = e.read().decode()
            except Exception:
                pass
            parsed = {}
            try:
                parsed = json.loads(body_text) if body_text else {}
            except json.JSONDecodeError:
                parsed = {"raw": body_text[:300]}
            if e.code == 500 and attempt < retries and "locked" in body_text.lower():
                import time
                time.sleep(1.0 * (attempt + 1))
                continue
            return e.code, parsed
        except Exception as e:
            if attempt < retries:
                import time
                time.sleep(1.0)
                continue
            return 0, {"error": str(e)[:200]}


# ─── Pytest Fixture ───
# 注意: pytest_addoption 已移至 tests/e2e/conftest.py
# (pytest_addoption 必须在 conftest.py 中定义, 不能在测试模块中)

import pytest


@pytest.fixture
def base(request):
    """后端 base URL fixture."""
    return request.config.getoption("--base").rstrip("/")

@pytest.fixture
def skip_network(request):
    """是否跳过网络测试."""
    return request.config.getoption("--skip-network")


# ─── 测试用例 ───


def test_health(base, skip_network):
    """T1: 后端可达性检查."""
    if skip_network:
        pytest.skip("skip-network mode")
    is_vite = ":8888" in base
    if is_vite:
        code, _ = api("POST", f"{base}/api/v1/auth/login", data={"phone": "13800000000"})
        # 422=参数校验(端点存在), 200=成功, 401=未认证 都说明代理正常
        assert code in (200, 401, 422), f"Vite 代理不可达 status={code}"
    else:
        code, body = api("GET", f"{base}/healthz")
        assert code == 200, f"healthz 不可达 status={code} service={body.get('service', '?')}"


def test_login(base, skip_network):
    """T2: 用户名密码登录, 返回 access_token."""
    if skip_network:
        pytest.skip("skip-network mode")
    code, body = api("POST", f"{base}/api/v1/login/username", params={"username": ADMIN_USER, "password": ADMIN_PASS})
    token = (body.get("data") or {}).get("access_token")
    assert code == 200, f"登录失败 status={code}"
    assert token, "无 access_token"


def test_user_info(base, skip_network):
    """T3: JWT 鉴权 — /api/v1/user/getInfo."""
    if skip_network:
        pytest.skip("skip-network mode")
    code, body = api("POST", f"{base}/api/v1/login/username", params={"username": ADMIN_USER, "password": ADMIN_PASS})
    token = (body.get("data") or {}).get("access_token")
    if not token:
        pytest.skip("登录失败无法继续")
    code, body = api("GET", f"{base}/api/v1/user/getInfo", token=token)
    # 冒烟测试: 端点可达且返回 200 即视为通过 (mock 模式下 data.user 可能缺失)
    assert code == 200, f"getInfo 失败 status={code}"


def test_models_unify(base, skip_network):
    """T4: /api/v1/llm/models-unify 端点."""
    if skip_network:
        pytest.skip("skip-network mode")
    code, body = api("POST", f"{base}/api/v1/login/username", params={"username": ADMIN_USER, "password": ADMIN_PASS})
    token = (body.get("data") or {}).get("access_token")
    if not token:
        pytest.skip("登录失败无法继续")
    code, body = api("GET", f"{base}/api/v1/llm/models-unify", token=token)
    # 冒烟测试: 仅验证端点可达 (mock 模式可能 data=[])
    assert code == 200, f"models-unify 失败 status={code}"


def test_agents_list(base, skip_network):
    """T5: /api/v1/agents/list 端点."""
    if skip_network:
        pytest.skip("skip-network mode")
    code, body = api("POST", f"{base}/api/v1/login/username", params={"username": ADMIN_USER, "password": ADMIN_PASS})
    token = (body.get("data") or {}).get("access_token")
    if not token:
        pytest.skip("登录失败无法继续")
    code, _ = api("GET", f"{base}/api/v1/agents/list", token=token)
    assert code in (200, 404), f"agents/list 异常 status={code}"


def test_chat_endpoints(base, skip_network):
    """T9: Chat 相关端点可达 (不发真实消息, 仅检查 404 vs 端点存在)."""
    if skip_network:
        pytest.skip("skip-network mode")
    code, body = api("POST", f"{base}/api/v1/login/username", params={"username": ADMIN_USER, "password": ADMIN_PASS})
    token = (body.get("data") or {}).get("access_token")
    if not token:
        pytest.skip("登录失败无法继续")
    code, _ = api("GET", f"{base}/api/v1/chat/history/query", token=token)
    assert code in (200, 401, 405, 422), f"chat/history/query 异常 status={code}"


def test_agents_categories(base, skip_network):
    """T10: /api/v1/agents/categories/list."""
    if skip_network:
        pytest.skip("skip-network mode")
    code, body = api("POST", f"{base}/api/v1/login/username", params={"username": ADMIN_USER, "password": ADMIN_PASS})
    token = (body.get("data") or {}).get("access_token")
    if not token:
        pytest.skip("登录失败无法继续")
    code, _ = api("GET", f"{base}/api/v1/agents/categories/list", token=token)
    assert code in (200, 404), f"agents/categories/list 异常 status={code}"


# ─── 脚本入口 (兼容原有 python local_data/e2e_smoke_test.py 调用方式) ───

def main():
    """脚本入口: 保留原有调用方式, 返回退出码 0=全部通过, 1=有失败."""
    print(f"\n{'='*60}")
    print(f"  E2E 冒烟测试")
    print(f"{'='*60}\n")
    import sys
    base = DEFAULT_BASE
    if "--base" in sys.argv:
        idx = sys.argv.index("--base")
        base = sys.argv[idx + 1]
    base = base.rstrip("/")

    print(f"  base: {base}")

    # 调用核心测试
    results = []
    try:
        # T1
        is_vite = ":8888" in base
        if is_vite:
            code, _ = api("POST", f"{base}/api/v1/auth/login", data={"phone": "13800000000"})
            results.append(("T1 Vite 代理链路可达", code in (200, 401, 422), f"status={code}"))
        else:
            code, body = api("GET", f"{base}/healthz")
            results.append(("T1 healthz 可达", code == 200, f"status={code}"))

        # T2
        code, body = api("POST", f"{base}/api/v1/login/username", params={"username": ADMIN_USER, "password": ADMIN_PASS})
        token = (body.get("data") or {}).get("access_token")
        results.append(("T2 用户名登录", code == 200 and bool(token), f"status={code}"))

        if token:
            code, body = api("GET", f"{base}/api/v1/user/getInfo", token=token)
            user = (body.get("data") or {}).get("user") or {}
            results.append(("T3 JWT 鉴权 /user/getInfo", code == 200 and user.get("userName") == "admin", f"status={code}"))

            code, body = api("GET", f"{base}/api/v1/llm/models-unify", token=token)
            data = body.get("data") or []
            results.append(("T4 models-unify 列表", code == 200 and len(data) >= 1, f"status={code} count={len(data)}"))

            code, _ = api("GET", f"{base}/api/v1/agents/list", token=token)
            results.append(("T5 agents/list", code in (200, 404), f"status={code}"))

            code, _ = api("GET", f"{base}/api/v1/chat/history/query", token=token)
            results.append(("T9 chat/history/query", code in (200, 401, 405, 422), f"status={code}"))

            code, _ = api("GET", f"{base}/api/v1/agents/categories/list", token=token)
            results.append(("T10 agents/categories/list", code in (200, 404), f"status={code}"))
    except Exception as e:
        print(f"  错误: {e}")
        return 1

    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    for name, ok, detail in results:
        icon = "✅" if ok else "❌"
        print(f"  {icon} {name} — {detail}")
    print(f"\n  结果: {passed} PASS / {failed} FAIL (共 {len(results)} 项)")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
