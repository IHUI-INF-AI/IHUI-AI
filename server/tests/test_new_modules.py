"""新模块路由测试 - product/identity/developer_link/remote/video/captcha

该测试通过真实 HTTP 请求 127.0.0.1:8000, 需要后端服务运行.
默认测试环境不启动服务, 全部 skip 避免误判. 集成测试时用 `pytest -m integration` 显式运行.
"""

import json
import urllib.error
import urllib.request

import pytest

pytestmark = pytest.mark.skip(reason="需要本地后端运行, 默认 skip; 集成测试时启用")

BASE = "http://127.0.0.1:8000"


def _get(url, timeout=15):
    """GET 请求"""
    try:
        with urllib.request.urlopen(BASE + url, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"raw": body[:200].decode("utf-8", errors="ignore")}
    except Exception as e:
        return -1, {"error": str(e)}


def _post(url, data=None, timeout=15):
    """POST 请求"""
    try:
        req = urllib.request.Request(
            BASE + url,
            method="POST",
            data=json.dumps(data or {}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"raw": body[:200].decode("utf-8", errors="ignore")}
    except Exception as e:
        return -1, {"error": str(e)}


# ---------------- 验证码 ----------------
def test_captcha_returns_200():
    """验证码端点应返回 200"""
    status, body = _get("/api/v1/auth/captcha")
    assert status == 200, f"期望 200，得到 {status}: {body}"
    assert body.get("code") in (0, "0", 200, "200"), f"业务码错误: {body}"


def test_captcha_has_image():
    """验证码响应应包含 base64 图片"""
    status, body = _get("/api/v1/auth/captcha")
    assert status == 200
    data = body.get("data") or {}
    img = data.get("img", "")
    assert "data:image/png" in img, "应包含 PNG base64"
    assert len(img) > 100, "图片 base64 长度应大于 100"
    assert data.get("captcha_key"), "应有 captcha_key"


# ---------------- Product (zhs_product) ----------------
def test_product_endpoints_registered():
    """Product 端点应已注册"""
    status, body = _get("/openapi.json")
    assert status == 200
    paths = body.get("paths", {})
    zhs_paths = [p for p in paths if "/zhs_product" in p]
    assert len(zhs_paths) >= 2, f"应至少有 2 个 zhs_product 端点，得到 {len(zhs_paths)}"


def test_product_list_endpoint():
    """Product 列表端点应可访问"""
    status, body = _get("/api/v1/zhs_product/list")
    # 401 表示端点存在但需鉴权（合理）
    assert status in (200, 401, 403, 422), f"端点异常: {status}"


# ---------------- Product Identity ----------------
def test_product_identity_endpoints_registered():
    """Product Identity 端点应已注册"""
    status, body = _get("/openapi.json")
    paths = body.get("paths", {})
    pi_paths = [p for p in paths if "/product_identity" in p]
    assert len(pi_paths) >= 2, f"应至少有 2 个 product_identity 端点，得到 {len(pi_paths)}"


# ---------------- Developer Link ----------------
def test_developer_link_endpoints_registered():
    """Developer Link 端点应已注册"""
    status, body = _get("/openapi.json")
    paths = body.get("paths", {})
    dl_paths = [p for p in paths if "/developerLink" in p]
    assert len(dl_paths) >= 2, f"应至少有 2 个 developerLink 端点，得到 {len(dl_paths)}"


# ---------------- Remote ----------------
def test_remote_endpoints_registered():
    """Remote 端点应已注册"""
    status, body = _get("/openapi.json")
    paths = body.get("paths", {})
    remote_paths = [p for p in paths if "/remote" in p or "remote" in p.lower()]
    assert len(remote_paths) >= 5, f"应至少有 5 个 remote 端点，得到 {len(remote_paths)}"


# ---------------- Video ----------------
def test_video_endpoints_registered():
    """Video 端点应已注册"""
    status, body = _get("/openapi.json")
    paths = body.get("paths", {})
    video_paths = [p for p in paths if "/video" in p or "breakpoint" in p.lower() or "preload" in p.lower()]
    assert len(video_paths) >= 5, f"应至少有 5 个 video 端点，得到 {len(video_paths)}"


# ---------------- 路由总数 ----------------
def test_total_routes_count():
    """总路径数应大于 500（paths 是 path 模板去重后的数量）"""
    status, body = _get("/openapi.json")
    paths = body.get("paths", {})
    # 558 个唯一路径（同一个路径可能有 GET/POST/PUT/DELETE 多个方法）
    assert len(paths) >= 500, f"路径数应 >= 500，实际 {len(paths)}"


# ---------------- 模块导入 ----------------
def test_app_main_import():
    """主应用应能成功导入"""
    import subprocess

    r = subprocess.run(
        ["python", "-c", "from app.main import app; print(len(app.routes))"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert r.returncode == 0, f"导入失败: {r.stderr}"
    routes = int(r.stdout.strip().split()[-1])
    # 632 个 routes（包含 GET/POST/PUT/DELETE 多个方法）
    assert routes >= 600, f"应用 routes 数应 >= 600，实际 {routes}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
