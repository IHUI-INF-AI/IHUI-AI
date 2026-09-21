# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""MCP 生态质量分与安全评分单元 + 端点测试(2026-09-12 立,P1 1-4 / P2-5)。

覆盖:
- mcp_quality:指标采集 / schema 校验 / 质量分加权聚合 / 安全分静态评分
  / 冲突检测 / 看板聚合
- mcp_stdio_bridge._make_forward_handler:转发时附带指标采集(延迟/成败/schema)
- MCPClientManager.call_external_tool:出站调用附带指标采集
- 端点:GET /api/mcp/store/{key}/score、GET /api/mcp/quality/dashboard、
  GET|POST /api/mcp/store/{key}/review(admin-only)、
  POST /api/mcp/store/install 高风险 409 RISK_CONFIRM_REQUIRED / 驳回 403
- mcp_market_review:默认状态(approved/pending)/ 状态流转 / 异常降级

隔离策略:
- autouse fixture 重置 mcp_quality 进程内统计,避免跨测试污染
- monkeypatch mcp_market_review._STORE_PATH 指向 pytest tmp_path
- bridge mock + clean_registry 复用 test_mcp_store 模式(不起真实子进程)
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import mcp as mcp_router
from app.services import (
    mcp_market_review,
    mcp_quality,
    mcp_server,
    mcp_stdio_bridge,
    mcp_store,
)
from app.services.mcp_client import MCPClientManager

# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def clean_quality():
    """每个测试前后清空 mcp_quality 进程内统计(含工具名登记)。"""
    mcp_quality.reset_metrics_for_tests()
    yield
    mcp_quality.reset_metrics_for_tests()


@pytest.fixture
def review_path(tmp_path, monkeypatch):
    """把市场审核持久化路径指向临时目录,隔离真实 data/。"""
    p = tmp_path / "mcp_market_review.json"
    monkeypatch.setattr(mcp_market_review, "_STORE_PATH", p)
    return p


@pytest.fixture
def store_path(tmp_path, monkeypatch):
    """把商店安装持久化路径指向临时目录,隔离真实 data/。"""
    p = tmp_path / "mcp_store.json"
    monkeypatch.setattr(mcp_store, "_STORE_PATH", p)
    return p


@pytest.fixture
def bridge_mock(monkeypatch):
    """mock stdio bridge 的 add/remove,不真实拉起子进程。"""
    calls = {"add": [], "remove": []}

    async def fake_add(name, command, args=None, env=None, description=""):
        calls["add"].append({"name": name, "command": command})
        return 2

    async def fake_remove(name):
        calls["remove"].append(name)
        return [f"{name}__tool1"]

    monkeypatch.setattr(mcp_stdio_bridge, "add_stdio_server_tool", fake_add)
    monkeypatch.setattr(mcp_stdio_bridge, "remove_stdio_server", fake_remove)
    return calls


def _make_client(role_id: int = 0) -> TestClient:
    """只挂载 mcp 路由的 FastAPI app;注入 role_id 模拟 JWT 中间件。"""
    app = FastAPI()

    @app.middleware("http")
    async def _inject_role(request, call_next):
        request.state.role_id = role_id
        request.state.user_id = 7
        return await call_next(request)

    app.include_router(mcp_router.router, prefix="/api")
    return TestClient(app)


@pytest.fixture
def api_client(store_path, review_path):
    """普通用户(role_id=0,非 admin)。"""
    return _make_client(role_id=0)


@pytest.fixture
def admin_client(store_path, review_path):
    """admin 用户(role_id=1)。"""
    return _make_client(role_id=1)


@pytest.fixture
def clean_registry():
    """测试后清理 mcp_server 注册表新增工具/连接,避免污染其他测试。"""
    before_handlers = set(mcp_server._TOOL_HANDLERS.keys())
    before_tools = {t.name for t in mcp_server._TOOLS}
    before_external = set(mcp_server._EXTERNAL_TOOL_NAMES)
    before_servers = dict(mcp_stdio_bridge._STDIO_SERVERS)
    yield
    for name in list(mcp_server._TOOL_HANDLERS.keys()):
        if name not in before_handlers:
            del mcp_server._TOOL_HANDLERS[name]
    mcp_server._TOOLS[:] = [t for t in mcp_server._TOOLS if t.name in before_tools]
    mcp_server._EXTERNAL_TOOL_NAMES.clear()
    mcp_server._EXTERNAL_TOOL_NAMES.update(before_external)
    mcp_stdio_bridge._STDIO_SERVERS.clear()
    mcp_stdio_bridge._STDIO_SERVERS.update(before_servers)


# =============================================================================
# mcp_quality:指标采集与派生指标
# =============================================================================


def test_record_tool_call_metrics():
    """3 成功 + 1 失败 → 成功率 0.75;schema 不兼容单独计数。"""
    mcp_quality.record_tool_call("srv", "t1", 0.2, True)
    mcp_quality.record_tool_call("srv", "t1", 0.4, True)
    mcp_quality.record_tool_call("srv", "t2", 0.6, True)
    mcp_quality.record_tool_call("srv", "t2", 0.8, False, schema_valid=False)
    m = mcp_quality.get_server_metrics("srv")
    assert m["calls"] == 4
    assert m["successes"] == 3
    assert m["failures"] == 1
    assert m["success_rate"] == 0.75
    assert m["avg_latency_s"] == 0.5
    assert m["schema_mismatches"] == 1
    assert m["schema_compatibility"] == 0.75


def test_get_server_metrics_no_data():
    """无调用数据:率字段为 None(而非除零)。"""
    m = mcp_quality.get_server_metrics("nobody")
    assert m["calls"] == 0
    assert m["success_rate"] is None
    assert m["avg_latency_s"] is None
    assert m["schema_compatibility"] is None


def test_collision_detection():
    """两个 server 注入同名工具 → 各自 collision_tools 计数正确。"""
    mcp_quality.note_server_tools("a", ["t1", "t2"])
    mcp_quality.note_server_tools("b", ["t2", "t3"])
    ma = mcp_quality.get_server_metrics("a")
    assert ma["tools"] == 2
    assert ma["collision_tools"] == 1  # t2 重名
    mb = mcp_quality.get_server_metrics("b")
    assert mb["collision_tools"] == 1
    # 卸载 a 后 b 不再有冲突
    mcp_quality.note_server_tools("a", [])
    assert mcp_quality.get_server_metrics("b")["collision_tools"] == 0


# =============================================================================
# mcp_quality:schema 校验
# =============================================================================


def test_validate_arguments():
    schema = {
        "type": "object",
        "properties": {"n": {"type": "integer"}, "s": {"type": "string"}},
        "required": ["n"],
    }
    assert mcp_quality.validate_arguments(schema, {"n": 1, "s": "x"}) is True
    # 缺 required
    assert mcp_quality.validate_arguments(schema, {"s": "x"}) is False
    # 类型不匹配
    assert mcp_quality.validate_arguments(schema, {"n": "1"}) is False
    # bool 不是 integer(Python bool 是 int 子类,须显式排除)
    assert mcp_quality.validate_arguments(schema, {"n": True}) is False
    # 无 schema / 非对象 schema 视为兼容
    assert mcp_quality.validate_arguments(None, {"anything": 1}) is True
    assert mcp_quality.validate_arguments({"type": "string"}, {}) is True


# =============================================================================
# mcp_quality:质量分加权聚合
# =============================================================================


def test_quality_assessment_full_score():
    """全成功 + 快延迟 + schema 全兼容 + 无冲突 → 100 分 / A 级。"""
    mcp_quality.note_server_tools("good", ["t1"])
    for _ in range(4):
        mcp_quality.record_tool_call("good", "t1", 0.3, True)
    q = mcp_quality.quality_assessment("good")
    assert q["score"] == 100.0
    assert q["grade"] == "A"
    dims = {d["name"]: d for d in q["dimensions"]}
    # 权重契约:成功率 40% / 延迟 30% / schema 20% / 冲突 10%
    assert dims["成功率"]["weight"] == 0.40
    assert dims["延迟"]["weight"] == 0.30
    assert dims["schema 兼容"]["weight"] == 0.20
    assert dims["冲突"]["weight"] == 0.10
    assert all(d["score"] == 100.0 for d in dims.values())


def test_quality_assessment_no_data_neutral():
    """无调用数据 → 中性基准分 75(B 级)。"""
    q = mcp_quality.quality_assessment("fresh")
    assert q["score"] == 75.0
    assert q["grade"] == "B"


def test_quality_assessment_latency_and_failures():
    """慢延迟(≥10s 零分)+ 一半失败 → 分数显著低于中性。"""
    mcp_quality.note_server_tools("slow", ["t1"])
    mcp_quality.record_tool_call("slow", "t1", 0.2, True)
    mcp_quality.record_tool_call("slow", "t1", 20.0, False)
    q = mcp_quality.quality_assessment("slow")
    # 成功率 50→50 分,延迟均值 10.1s→0 分,schema 100,冲突 100
    assert q["score"] == pytest.approx(50 * 0.4 + 0 * 0.3 + 100 * 0.2 + 100 * 0.1)
    assert q["grade"] == "D"


def test_grade_for_thresholds():
    assert mcp_quality.grade_for(85) == "A"
    assert mcp_quality.grade_for(84.9) == "B"
    assert mcp_quality.grade_for(70) == "B"
    assert mcp_quality.grade_for(55) == "C"
    assert mcp_quality.grade_for(54.9) == "D"


# =============================================================================
# mcp_quality:权限风险静态评分
# =============================================================================


def test_security_assessment_directory_keys():
    """内置目录条目按声明的高危维度扣分;等级阈值正确。"""
    fs = mcp_quality.security_assessment("filesystem", "Filesystem")
    assert fs["score"] == 75.0  # file_write 扣 25
    assert fs["level"] == "medium"
    assert fs["confirm_required"] is False

    git = mcp_quality.security_assessment("git", "Git")
    assert git["score"] == 55.0  # command_exec 30 + repo_write 15
    assert git["level"] == "high"
    assert git["confirm_required"] is True

    mem = mcp_quality.security_assessment("memory", "Memory")
    assert mem["score"] == 100.0
    assert mem["level"] == "low"
    assert mem["confirm_required"] is False


def test_security_assessment_unknown_server():
    """未知外部 server 从 70 起评(medium);名称含高危关键字进一步扣分。"""
    plain = mcp_quality.security_assessment("my-tool", "My Tool")
    assert plain["score"] == 70.0
    assert plain["level"] == "medium"
    assert plain["confirm_required"] is False

    shell = mcp_quality.security_assessment("my-shell", "Shell Runner")
    assert shell["score"] == 40.0  # 70 - command_exec 30
    assert shell["level"] == "high"
    assert shell["confirm_required"] is True


def test_scoring_summary_and_detail_contract():
    """摘要/明细结构对齐 api-client McpScoringSummary / McpScoreDetail。"""
    s = mcp_quality.scoring_summary("git", "Git")
    assert set(s) == {
        "score",
        "grade",
        "security_score",
        "security_level",
        "confirm_required",
    }
    d = mcp_quality.score_detail("git", "Git")
    assert d["key"] == "git"
    assert d["name"] == "Git"
    assert d["quality"]["grade"] in ("A", "B", "C", "D")
    assert d["security"]["level"] in ("low", "medium", "high", "critical")
    assert isinstance(d["risk_factors"], list)
    assert set(d["dimensions"]) == {"quality", "security"}
    assert isinstance(d["recommendation"], str)


def test_quality_dashboard():
    """看板覆盖 8 个内置目录条目,结构含 metrics/quality/security。"""
    mcp_quality.record_tool_call("ext-srv", "t", 0.1, True)
    servers = mcp_quality.quality_dashboard()
    keys = {s["key"] for s in servers}
    assert {"filesystem", "git", "github", "postgres"} <= keys
    assert "ext-srv" in keys  # 有统计的外部 server 也进看板
    for s in servers:
        assert set(s) == {"key", "name", "metrics", "quality", "security"}
        assert {"score", "grade", "dimensions"} <= set(s["quality"])
        assert {"score", "level", "risk_factors"} <= set(s["security"])


# =============================================================================
# stdio bridge / mcp_client 指标采集接线
# =============================================================================


async def test_forward_handler_records_metrics(clean_registry):
    """stdio 转发 handler:成功调用记录延迟/成败/schema 不兼容。"""

    class FakeResult:
        isError = False
        content = [SimpleNamespace(text="done")]

    class FakeSession:
        async def call_tool(self, name, args):
            return FakeResult()

    mcp_stdio_bridge._STDIO_SERVERS["fake-srv"] = SimpleNamespace(  # type: ignore[assignment]
        session=FakeSession()
    )
    try:
        schema = {
            "type": "object",
            "properties": {"n": {"type": "integer"}},
            "required": ["n"],
        }
        handler = mcp_stdio_bridge._make_forward_handler("fake-srv", "do_thing", schema)
        result = await handler({"n": "not-an-int", "__user_role": 0})
        assert result["ok"] is True
        m = mcp_quality.get_server_metrics("fake-srv")
        assert m["calls"] == 1
        assert m["successes"] == 1
        # 入参 n 是 str 而 schema 声明 integer → 记一次不兼容
        assert m["schema_mismatches"] == 1
    finally:
        mcp_stdio_bridge._STDIO_SERVERS.pop("fake-srv", None)


async def test_forward_handler_unregistered_failure():
    """server 未注册 → ok=False,计入失败调用。"""
    handler = mcp_stdio_bridge._make_forward_handler("ghost", "t")
    result = await handler({})
    assert result["ok"] is False
    m = mcp_quality.get_server_metrics("ghost")
    assert m["calls"] == 1
    assert m["failures"] == 1


async def test_call_external_tool_records_metrics():
    """出站调用(mcp_client)记录延迟与成败。"""

    class FakeClient:
        def is_connected(self):
            return True

        async def call_tool(self, name, args):
            return {"ok": True, "content": "x"}

    manager = MCPClientManager()
    manager._clients["ext"] = FakeClient()  # type: ignore[assignment]
    result = await manager.call_external_tool("ext", "t", {})
    assert result["ok"] is True
    m = mcp_quality.get_server_metrics("ext")
    assert m["calls"] == 1
    assert m["successes"] == 1


# =============================================================================
# 端点:GET /api/mcp/store/{key}/score 与 /api/mcp/quality/dashboard
# =============================================================================


def test_score_endpoint(api_client):
    r = api_client.get("/api/mcp/store/git/score")
    assert r.status_code == 200
    body = r.json()
    assert body["key"] == "git"
    assert body["name"] == "Git"
    assert body["security"]["level"] == "high"
    assert body["confirm_required"] is True
    assert len(body["dimensions"]["quality"]) == 4


def test_score_endpoint_unknown_key_still_scores(api_client):
    """目录外 key 也能评分(未知 server 从 medium 起评)。"""
    r = api_client.get("/api/mcp/store/some-unknown/score")
    assert r.status_code == 200
    assert r.json()["security"]["score"] == 70.0


def test_dashboard_endpoint(api_client):
    r = api_client.get("/api/mcp/quality/dashboard")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 8
    keys = {s["key"] for s in body["servers"]}
    assert "filesystem" in keys


def test_store_list_has_scoring_and_review(api_client):
    """商店列表每条附 scoring(契约字段)与 review_status(目录条目默认 approved)。"""
    r = api_client.get("/api/mcp/store")
    assert r.status_code == 200
    for s in r.json()["servers"]:
        assert set(s["scoring"]) == {
            "score",
            "grade",
            "security_score",
            "security_level",
            "confirm_required",
        }
        assert s["review_status"] == "approved"


# =============================================================================
# 端点:安装风险确认门(409 RISK_CONFIRM_REQUIRED)与审核驳回门(403)
# =============================================================================


def test_install_high_risk_requires_confirm(api_client, bridge_mock, clean_registry):
    """git 为 high 风险:不带 confirm_risk → 409 + errorCode;带 → 200。"""
    r = api_client.post("/api/mcp/store/install", json={"key": "git"})
    assert r.status_code == 409
    body = r.json()
    assert body["errorCode"] == "RISK_CONFIRM_REQUIRED"
    assert body["scoring"]["security_level"] == "high"
    assert bridge_mock["add"] == []  # 未热挂载

    r2 = api_client.post(
        "/api/mcp/store/install", json={"key": "git", "confirm_risk": True}
    )
    assert r2.status_code == 200
    assert r2.json()["ok"] is True


def test_install_low_risk_no_confirm_needed(api_client, bridge_mock, clean_registry):
    """time 为 low 风险:无需 confirm_risk 直接安装。"""
    r = api_client.post("/api/mcp/store/install", json={"key": "time"})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_install_rejected_review_403(
    api_client, admin_client, bridge_mock, clean_registry
):
    """管理员驳回后:安装(即使 confirm_risk)→ 403。"""
    r = admin_client.post(
        "/api/mcp/store/git/review", json={"action": "reject", "note": "风险过高"}
    )
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"

    r2 = api_client.post(
        "/api/mcp/store/install", json={"key": "git", "confirm_risk": True}
    )
    assert r2.status_code == 403
    assert "驳回" in r2.json()["error"]
    assert bridge_mock["add"] == []


# =============================================================================
# 端点:市场审核(P2-5,admin-only)
# =============================================================================


def test_review_get_defaults(api_client):
    """目录条目默认 approved;未知条目默认 pending。"""
    r = api_client.get("/api/mcp/store/git/review")
    assert r.status_code == 200
    assert r.json()["status"] == "approved"

    r2 = api_client.get("/api/mcp/store/brand-new/review")
    assert r2.status_code == 200
    assert r2.json()["status"] == "pending"


def test_review_post_requires_admin(api_client, admin_client):
    """非 admin → 403;admin approve → 200 且状态流转可见。"""
    r = api_client.post("/api/mcp/store/brand-new/review", json={"action": "approve"})
    assert r.status_code == 403

    r2 = admin_client.post("/api/mcp/store/brand-new/review", json={"action": "approve"})
    assert r2.status_code == 200
    body = r2.json()
    assert body["ok"] is True
    assert body["status"] == "approved"
    assert body["reviewed_by"] == "7"
    assert body["reviewed_at"]

    assert api_client.get("/api/mcp/store/brand-new/review").json()["status"] == "approved"


def test_review_post_invalid_action_400(admin_client):
    r = admin_client.post("/api/mcp/store/git/review", json={"action": "maybe"})
    assert r.status_code == 400


def test_review_reject_with_note_persisted(admin_client, review_path):
    """驳回备注持久化到 JSON 文件。"""
    r = admin_client.post(
        "/api/mcp/store/git/review", json={"action": "reject", "note": "命令执行风险"}
    )
    assert r.status_code == 200
    data = json.loads(review_path.read_text(encoding="utf-8"))
    assert data["git"]["status"] == "rejected"
    assert data["git"]["note"] == "命令执行风险"


# =============================================================================
# mcp_market_review 持久化异常降级
# =============================================================================


def test_review_store_corrupt_json_defaults(review_path):
    """审核文件损坏 → 回退默认状态(目录 approved / 未知 pending),不崩。"""
    review_path.write_text("{broken", encoding="utf-8")
    assert mcp_market_review.get_status("git") == "approved"
    assert mcp_market_review.get_status("whatever") == "pending"


def test_review_store_invalid_status_raises(review_path):
    with pytest.raises(ValueError, match="非法审核状态"):
        mcp_market_review.set_status("git", "bogus")


def test_review_store_write_failure_returns_none(review_path, monkeypatch):
    """写失败(父目录被文件占用)→ set_status 返回 None。"""
    review_path.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(
        mcp_market_review, "_STORE_PATH", review_path / "sub" / "x.json"
    )
    assert mcp_market_review.set_status("git", "approved") is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
