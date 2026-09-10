# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""能力市场端点与清单生成单元测试(P2-8 供给侧,2026-09 立)。

覆盖:
- capability_market:清单生成(全部 _TOOLS + resource/prompt)、分类、参数摘要、
  健康状态、权限分级、缓存 + 失效(签名变化 / force / invalidate)
- capability_market_store:启用态默认 True、set_enabled 持久化、读失败降级
- GET  /api/mcp/capabilities            列表(分页 + 分类 + 关键词检索)
- GET  /api/mcp/capabilities/{id}       详情(命中 / 404)
- POST /api/mcp/capabilities/{id}/enable|disable  启用停用(幂等 + admin 权限校验)

隔离策略:
- monkeypatch capability_market_store._STORE_PATH 指向 tmp_path,不污染真实 data/
- 测试 app 注入中间件设置 request.state.role_id 模拟权限
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import mcp as mcp_router
from app.services import capability_market as cm
from app.services import capability_market_store as cms
from app.services import mcp_server


# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture
def store_path(tmp_path, monkeypatch):
    """把 capability_market_store 持久化路径指向临时目录,隔离真实 data/。"""
    p = tmp_path / "capability_market.json"
    monkeypatch.setattr(cms, "_STORE_PATH", p)
    return p


@pytest.fixture
def client(store_path):
    """构造仅挂载 mcp router 的测试 app,默认 role_id=0(普通用户)。"""
    app = FastAPI()

    @app.middleware("http")
    async def _inject_role(request, call_next):
        request.state.role_id = 0
        request.state.user_id = None
        return await call_next(request)

    app.include_router(mcp_router.router, prefix="/api")
    return TestClient(app)


@pytest.fixture
def admin_client(store_path):
    """role_id=1(admin)的测试客户端,用于 admin 专属能力启用校验。"""
    app = FastAPI()

    @app.middleware("http")
    async def _inject_role(request, call_next):
        request.state.role_id = 1
        request.state.user_id = None
        return await call_next(request)

    app.include_router(mcp_router.router, prefix="/api")
    return TestClient(app)


# =============================================================================
# 清单生成
# =============================================================================


def test_manifest_covers_all_tools_and_meta():
    """清单应覆盖全部 _TOOLS,且含 resource/prompt,字段完整。"""
    cm.invalidate_capability_cache()
    manifest = cm.get_manifest(force=True)
    tool_ids = {t.name for t in mcp_server._TOOLS}
    got_tool_ids = {c.id for c in manifest if c.kind == "tool"}
    assert tool_ids <= got_tool_ids
    assert any(c.kind == "resource" for c in manifest)
    assert any(c.kind == "prompt" for c in manifest)
    # 字段完整性
    for c in manifest:
        assert c.id and c.name and c.category and c.health
        assert c.permission in ("admin", "all")


def test_manifest_categorization_and_params():
    """read_file 应归入 file 类,且参数摘要正确提取 required。"""
    manifest = cm.get_manifest(force=True)
    read_file = next(c for c in manifest if c.id == "read_file")
    assert read_file.category == "file"
    assert read_file.permission == "all"
    param = next(p for p in read_file.params if p.name == "path")
    assert param.required is True
    assert param.type == "string"


def test_manifest_admin_and_health():
    """write_file 为 admin 专属;web_search 依赖网络标记为 degraded。"""
    manifest = cm.get_manifest(force=True)
    write_file = next(c for c in manifest if c.id == "write_file")
    assert write_file.permission == "admin"
    assert write_file.health == "healthy"
    web = next(c for c in manifest if c.id == "web_search")
    assert web.requires_network is True
    assert web.health == "degraded"


def test_manifest_cache_signature_and_invalidate():
    """缓存基于注册表签名;外部工具热挂载后签名变化应触发自动失效。"""
    import app.services.mcp_server as mcp_server

    cm.invalidate_capability_cache()
    first = cm.get_manifest()
    # 签名未变且 TTL 内,返回同一对象(缓存命中)
    assert cm.get_manifest() is first
    # 外部注入新工具 → 签名变化 → 自动失效并重建
    from app.services.mcp_server import MCPTool

    added = MCPTool(name="__cap_test_ext__", description="临时外部工具", input_schema={})
    mcp_server._TOOLS.append(added)
    mcp_server._TOOL_HANDLERS["__cap_test_ext__"] = lambda a: {"ok": True}
    try:
        rebuilt = cm.get_manifest()
        assert rebuilt is not first
        assert any(c.id == "__cap_test_ext__" for c in rebuilt)
    finally:
        mcp_server._TOOLS[:] = [t for t in mcp_server._TOOLS if t.name != "__cap_test_ext__"]
        mcp_server._TOOL_HANDLERS.pop("__cap_test_ext__", None)
        cm.invalidate_capability_cache()


# =============================================================================
# 持久化 store
# =============================================================================


def test_store_default_enabled_and_set(store_path):
    """未记录能力默认启用;set_enabled 持久化并可读回。"""
    assert cms.is_enabled("read_file") is True
    assert cms.set_enabled("read_file", False) is not None
    assert cms.is_enabled("read_file") is False
    # 重新加载(新建 store 实例语义:直接读文件)
    assert cms.get_enabled_map().get("read_file") is False


def test_store_write_failure_degrades(store_path, monkeypatch):
    """写失败降级返回 None,不抛异常。"""
    monkeypatch.setattr(cms, "_write", lambda records: False)
    assert cms.set_enabled("read_file", False) is None


# =============================================================================
# 列表 / 详情端点
# =============================================================================


def test_list_pagination_and_envelope(client):
    """列表返回 {code,message,data} 信封,分页正确且默认 enabled=True。"""
    r = client.get("/api/mcp/capabilities", params={"page": 1, "page_size": 5})
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == 0 and body["message"] == "ok"
    data = body["data"]
    assert data["total"] >= 5
    assert len(data["items"]) == 5
    assert data["page"] == 1 and data["page_size"] == 5
    assert "file" in data["categories"]
    assert all(item["enabled"] is True for item in data["items"])


def test_list_category_and_keyword_filter(client):
    """分类过滤 + 关键词检索按名称/描述/分类匹配。"""
    # 分类过滤:file 类
    r = client.get("/api/mcp/capabilities", params={"category": "file", "page_size": 100})
    items = r.json()["data"]["items"]
    assert items and all(i["category"] == "file" for i in items)
    # 关键词:read_file
    r = client.get("/api/mcp/capabilities", params={"q": "read_file", "page_size": 100})
    items = r.json()["data"]["items"]
    assert len(items) >= 1 and any(i["id"] == "read_file" for i in items)


def test_detail_found_and_not_found(client):
    """详情命中返回能力;未知 id 返回 404 + CAPABILITY_NOT_FOUND。"""
    r = client.get("/api/mcp/capabilities/read_file")
    assert r.status_code == 200
    assert r.json()["data"]["id"] == "read_file"
    r = client.get("/api/mcp/capabilities/__nope__")
    assert r.status_code == 404
    assert r.json()["code"] == 404


# =============================================================================
# 启用 / 停用端点(幂等 + 权限)
# =============================================================================


def test_enable_disable_idempotent(client, store_path):
    """停用 → 启用 幂等,持久化状态正确。"""
    cap_id = "read_file"
    r = client.post(f"/api/mcp/capabilities/{cap_id}/disable")
    assert r.status_code == 200 and r.json()["data"]["enabled"] is False
    # 再次停用仍幂等成功
    r = client.post(f"/api/mcp/capabilities/{cap_id}/disable")
    assert r.status_code == 200 and r.json()["data"]["enabled"] is False
    # 启用
    r = client.post(f"/api/mcp/capabilities/{cap_id}/enable")
    assert r.status_code == 200 and r.json()["data"]["enabled"] is True
    assert cms.is_enabled(cap_id) is True


def test_enable_unknown_returns_404(client):
    """启用未知能力返回 404。"""
    r = client.post("/api/mcp/capabilities/__nope__/enable")
    assert r.status_code == 404 and r.json()["code"] == 404


def test_enable_admin_capability_requires_role(client, admin_client):
    """admin 专属能力:普通用户 403,admin 200。"""
    cap_id = "write_file"
    r = client.post(f"/api/mcp/capabilities/{cap_id}/enable")
    assert r.status_code == 403 and r.json()["code"] == 403
    r = admin_client.post(f"/api/mcp/capabilities/{cap_id}/enable")
    assert r.status_code == 200 and r.json()["data"]["enabled"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
