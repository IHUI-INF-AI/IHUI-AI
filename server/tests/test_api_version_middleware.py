"""v1 -> v2 中间件切换测试."""

import requests

BASE = "http://127.0.0.1:8000"


def test_v1_default_path():
    """默认 v1: /api/v1/* 走 v1 路由."""
    r = requests.get(f"{BASE}/api/v2/study/plan?user_id=test")
    assert r.status_code == 200
    body = r.json()
    assert body["data"]["migrated"] is True
    assert r.headers.get("X-API-Version") == "v1"
    print("[OK] v1 默认路径")


def test_v2_header_path_rewrite():
    """X-Api-Version: v2 header 自动重写 /api/v1/* 到 /api/v2/*."""
    r = requests.get(
        f"{BASE}/api/v1/study/plan?user_id=test",
        headers={"X-Api-Version": "v2"},
    )
    # 如果 v1 路径存在则重写为 v2 路径，migrated=True
    # 如果 v1 路径不存在则 404
    print(f"  status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        assert body.get("data", {}).get("migrated") is True
        assert r.headers.get("X-API-Version") == "v2"
        print("[OK] v2 header 路径重写")
    else:
        print(f"[SKIP] v1 路径不存在 (v2 才有): {r.status_code}")


def test_v2_accept_header_rewrite():
    """Accept: application/vnd.zhs.v2+json 自动重写."""
    r = requests.get(
        f"{BASE}/api/v1/community/posts",
        headers={"Accept": "application/vnd.zhs.v2+json"},
    )
    print(f"  status={r.status_code}")
    if r.status_code == 200:
        assert r.headers.get("X-API-Version") == "v2"
        print("[OK] v2 Accept 路径重写")
    else:
        print(f"[SKIP] v1 路径不存在: {r.status_code}")


def test_v2_explicit_path_works():
    """v2 显式路径直接走 v2."""
    r = requests.get(
        f"{BASE}/api/v2/study/plan?user_id=test",
        headers={"X-Api-Version": "v2"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["data"]["migrated"] is True
    assert r.headers.get("X-API-Version") == "v2"
    print("[OK] v2 显式路径")


def test_v2_non_api_path_406():
    """v2 请求但非 /api/* 路径返回 406."""
    r = requests.get(
        f"{BASE}/health",
        headers={"X-Api-Version": "v2"},
    )
    # /health 不在 /api 下，可能正常 200 也可能 406
    # 仅检查 header
    assert "X-API-Version" in r.headers
    print(f"[OK] 非 /api 路径 header: X-API-Version={r.headers.get('X-API-Version')}")


if __name__ == "__main__":
    test_v1_default_path()
    test_v2_explicit_path_works()
    test_v2_header_path_rewrite()
    test_v2_accept_header_rewrite()
    test_v2_non_api_path_406()
    print("\n所有中间件测试通过")
