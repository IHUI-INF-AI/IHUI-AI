# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE-NEW]: new file. MCP 生态质量分与安全评分测试(P1 1-4,2026-09-08 立)。

"""MCP 质量分与安全评分单元 + 端点测试(P1 1-4)。

覆盖:
- mcp_scoring.score_entry:确定性(同输入同输出)、结构完整性
  (quality/security/confirm_required/risk_factors/dimensions/recommendation)
- 质量维度:official 加分、描述长度分档、transport 分档、env 文档化、tags、运行态
- 安全维度:凭据 env 扣分(个数递进)、npx 供应链(版本固定 vs 未固定)、
  未知命令、能力语义叠加(数据库/文件/网络/托管/命令执行)
- 风险等级阈值:scored < 40 critical / < 60 high / < 80 medium / >= 80 low
- 质量等级:A/B/C/D
- inline_summary / score_store_list 批量
- 端点:
  - GET  /api/mcp/store            每条携带 scoring 内联摘要
  - GET  /api/mcp/store/{key}/score 完整明细 + 未知 key 404
  - POST /api/mcp/store/install     high/critical 未 confirm_risk → 409
                                    RISK_CONFIRM_REQUIRED + scoring 详情;
                                    confirm_risk=true → 走正常安装流程
                                    (bridge mock,不起子进程)
- 内置 8 目录条目全量评分 sanity(postgres/github high 需确认,官方只读条目 low/medium)

隔离策略:对齐 test_mcp_store(临时 _STORE_PATH + bridge mock + clean_registry)。
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import mcp as mcp_router
from app.services import mcp_scoring, mcp_server, mcp_stdio_bridge, mcp_store
from app.services.mcp_directory import get_entry

# =============================================================================
# fixtures(对齐 test_mcp_store)
# =============================================================================


@pytest.fixture
def store_path(tmp_path, monkeypatch):
    p = tmp_path / "mcp_store.json"
    monkeypatch.setattr(mcp_store, "_STORE_PATH", p)
    return p


@pytest.fixture
def bridge_mock(monkeypatch):
    calls = {"add": [], "remove": []}

    async def fake_add(name, command, args=None, env=None, description=""):
        calls["add"].append(
            {"name": name, "command": command, "args": list(args or []), "env": dict(env or {})}
        )
        return 2

    async def fake_remove(name):
        calls["remove"].append(name)
        return [f"{name}__tool1", f"{name}__tool2"]

    monkeypatch.setattr(mcp_stdio_bridge, "add_stdio_server_tool", fake_add)
    monkeypatch.setattr(mcp_stdio_bridge, "remove_stdio_server", fake_remove)
    return calls


@pytest.fixture
def api_client(store_path):
    app = FastAPI()
    app.include_router(mcp_router.router, prefix="/api")
    return TestClient(app)


@pytest.fixture
def clean_registry():
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
# 评分核心:结构 + 确定性
# =============================================================================


def _mk(**overrides):
    """构造评分输入 dict(默认官方只读 stdio 条目)。"""
    base = {
        "key": "safe-echo",
        "name": "SafeEcho",
        "description": "只读回显工具,零副作用,用于连通自检",
        "source": "official",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-echo"],
        "env_required": [],
        "env_default": {},
        "installed": False,
        "enabled": False,
        "tool_count": 0,
        "verified": False,
        "tags": ["echo", "readonly", "selfcheck"],
    }
    base.update(overrides)
    return base


def test_score_entry_structure():
    r = mcp_scoring.score_entry(_mk())
    assert set(r.keys()) == {
        "key",
        "name",
        "quality",
        "security",
        "confirm_required",
        "risk_factors",
        "dimensions",
        "recommendation",
    }
    assert set(r["quality"].keys()) == {"score", "grade"}
    assert set(r["security"].keys()) == {"score", "level"}
    assert r["quality"]["grade"] in ("A", "B", "C", "D")
    assert r["security"]["level"] in ("low", "medium", "high", "critical")
    assert isinstance(r["confirm_required"], bool)
    assert isinstance(r["risk_factors"], list)
    assert set(r["dimensions"].keys()) == {"quality", "security"}
    for d in r["dimensions"]["quality"] + r["dimensions"]["security"]:
        assert set(d.keys()) == {"name", "score", "weight", "detail"}


def test_score_entry_deterministic():
    e = _mk()
    assert mcp_scoring.score_entry(e) == mcp_scoring.score_entry(_mk())
    assert mcp_scoring.score_entry(e) == mcp_scoring.score_entry(dict(e))


def test_score_entry_accepts_directory_entry_object():
    """duck-typing:直接传 DirectoryEntry(非 dict)也能评。"""
    entry = get_entry("time")
    assert entry is not None
    r = mcp_scoring.score_entry(entry)
    assert r["key"] == "time"
    assert 0 <= r["quality"]["score"] <= 100
    assert 0 <= r["security"]["score"] <= 100


# =============================================================================
# 质量维度
# =============================================================================


def test_quality_official_beats_community():
    official = mcp_scoring.score_entry(_mk(source="official"))
    community = mcp_scoring.score_entry(_mk(source="community"))
    assert official["quality"]["score"] > community["quality"]["score"]


def test_quality_description_tiers():
    long_desc = _mk(description="这是一个足够长的描述,超过三十个字符,详尽说明用途")
    short_desc = _mk(description="偏短描述")
    no_desc = _mk(description="")
    s_long = mcp_scoring.score_entry(long_desc)["quality"]["score"]
    s_short = mcp_scoring.score_entry(short_desc)["quality"]["score"]
    s_none = mcp_scoring.score_entry(no_desc)["quality"]["score"]
    assert s_long > s_short > s_none


def test_quality_transport_tiers():
    http = mcp_scoring.score_entry(_mk(transport="http"))
    sse = mcp_scoring.score_entry(_mk(transport="sse"))
    stdio = mcp_scoring.score_entry(_mk(transport="stdio"))
    assert (
        http["quality"]["score"] > sse["quality"]["score"] > stdio["quality"]["score"]
    )


def test_quality_env_docs():
    no_env = _mk(env_required=[])
    with_default = _mk(
        env_required=["API_KEY"], env_default={"API_KEY": "changeme"}
    )
    without_default = _mk(env_required=["API_KEY"], env_default={})
    s_no = mcp_scoring.score_entry(no_env)["quality"]["score"]
    s_def = mcp_scoring.score_entry(with_default)["quality"]["score"]
    s_nodef = mcp_scoring.score_entry(without_default)["quality"]["score"]
    assert s_no >= s_def > s_nodef


def test_quality_runtime_states():
    plain = _mk()
    running = _mk(installed=True, enabled=True, tool_count=4)
    verified = _mk(verified=True)
    assert (
        mcp_scoring.score_entry(verified)["quality"]["score"]
        > mcp_scoring.score_entry(running)["quality"]["score"]
        > mcp_scoring.score_entry(plain)["quality"]["score"]
    )


def test_grade_thresholds():
    """A/B/C/D 阈值(90/75/60)。"""
    assert mcp_scoring._grade_of(95) == "A"
    assert mcp_scoring._grade_of(90) == "A"
    assert mcp_scoring._grade_of(89) == "B"
    assert mcp_scoring._grade_of(75) == "B"
    assert mcp_scoring._grade_of(74) == "C"
    assert mcp_scoring._grade_of(60) == "C"
    assert mcp_scoring._grade_of(59) == "D"
    assert mcp_scoring._grade_of(0) == "D"


# =============================================================================
# 安全维度
# =============================================================================


def test_security_credential_env_penalties():
    """凭据 env 个数递进扣分,且触发人话因素。"""
    none = mcp_scoring.score_entry(_mk(env_required=[]))
    one = mcp_scoring.score_entry(_mk(env_required=["API_TOKEN"]))
    two = mcp_scoring.score_entry(
        _mk(env_required=["API_TOKEN", "DB_PASSWORD"])
    )
    s_none = none["security"]["score"]
    s_one = one["security"]["score"]
    s_two = two["security"]["score"]
    assert s_none > s_one > s_two
    # 凭据 env 名进入风险因素(人话)
    joined = " ".join(one["risk_factors"])
    assert "API_TOKEN" in joined


def test_security_npx_supply_chain():
    """npx 未固定版本扣分多于固定版本;本地运行时最安全。"""
    s_unpinned = mcp_scoring.score_entry(
        _mk(args=["-y", "@modelcontextprotocol/server-echo"])
    )["security"]["score"]
    s_pinned = mcp_scoring.score_entry(
        _mk(args=["-y", "@modelcontextprotocol/server-echo@1.2.0"])
    )["security"]["score"]
    s_local = mcp_scoring.score_entry(_mk(command="python"))["security"]["score"]
    assert s_local >= s_pinned > s_unpinned


def test_security_unknown_command():
    s_known = mcp_scoring.score_entry(_mk(command="node"))["security"]["score"]
    unknown = mcp_scoring.score_entry(_mk(command="curl-bash-exotic"))
    assert s_known > unknown["security"]["score"]
    assert any("白名单" in f for f in unknown["risk_factors"])


def test_security_capability_semantics():
    """能力语义叠加:命令执行 > 数据库 > 文件 > 网络 > 托管。"""
    s_base = mcp_scoring.score_entry(
        _mk(args=["-y", "@modelcontextprotocol/server-plain"], key="plain", name="Plain")
    )["security"]["score"]
    s_shell = mcp_scoring.score_entry(
        _mk(
            args=["-y", "@modelcontextprotocol/server-shell-exec"],
            key="shellexec",
            name="ShellExec",
        )
    )["security"]["score"]
    s_db = mcp_scoring.score_entry(
        _mk(args=["-y", "@modelcontextprotocol/server-postgres"], key="pg", name="PG")
    )["security"]["score"]
    assert s_base > s_db > s_shell


def test_risk_level_thresholds():
    assert mcp_scoring._risk_level_of(100) == "low"
    assert mcp_scoring._risk_level_of(80) == "low"
    assert mcp_scoring._risk_level_of(79) == "medium"
    assert mcp_scoring._risk_level_of(60) == "medium"
    assert mcp_scoring._risk_level_of(59) == "high"
    assert mcp_scoring._risk_level_of(40) == "high"
    assert mcp_scoring._risk_level_of(39) == "critical"
    assert mcp_scoring._risk_level_of(0) == "critical"


def test_confirm_required_consistent_with_level():
    for score, expect in [(95, False), (75, False), (55, True), (20, True)]:
        level = mcp_scoring._risk_level_of(score)
        assert (level in mcp_scoring.RISK_CONFIRM_REQUIRED) is expect


def test_high_risk_recommendation_wording():
    critical = mcp_scoring.score_entry(
        _mk(
            command="some-exotic",
            args=["-y", "@x/server-shell-exec"],
            key="crit",
            name="Crit",
            env_required=["API_SECRET", "DB_PASSWORD", "EXTRA_KEY"],
        )
    )
    assert critical["security"]["level"] in ("high", "critical")
    assert critical["confirm_required"] is True
    assert critical["risk_factors"]


# =============================================================================
# 内置目录 sanity + 批量 API
# =============================================================================


def test_builtin_directory_scoring_sanity():
    """8 个内置条目全可评;postgres/github 为 high(需确认);只读官方为 low/medium。"""
    from app.services.mcp_directory import _DIRECTORY

    reports = [mcp_scoring.score_entry(e) for e in _DIRECTORY]
    assert len(reports) == 8
    levels = {r["key"]: r["security"]["level"] for r in reports}
    assert levels["postgres"] == "high"
    assert levels["github"] == "high"
    assert levels["memory"] == "low"
    assert levels["sequential-thinking"] == "low"
    # 全部条目评分都在值域内
    for r in reports:
        assert 0 <= r["quality"]["score"] <= 100
        assert 0 <= r["security"]["score"] <= 100


def test_inline_summary_shape():
    s = mcp_scoring.inline_summary(_mk())
    assert set(s.keys()) == {
        "score",
        "grade",
        "security_score",
        "security_level",
        "confirm_required",
    }


def test_score_store_list_batch():
    entries = [
        _mk(key="a", name="A"),
        _mk(key="b", name="B", env_required=["API_KEY"]),
    ]
    out = mcp_scoring.score_store_list(entries)
    assert set(out.keys()) == {"a", "b"}
    assert set(out["a"].keys()) == {
        "score",
        "grade",
        "security_score",
        "security_level",
        "confirm_required",
    }
    # 无凭据条目安全分更高
    assert out["a"]["security_score"] > out["b"]["security_score"]


# =============================================================================
# 端点:GET /api/mcp/store(列表内联评分)
# =============================================================================


def test_store_list_includes_scoring(api_client):
    r = api_client.get("/api/mcp/store")
    assert r.status_code == 200
    servers = r.json()["servers"]
    assert len(servers) >= 8
    for s in servers:
        assert "scoring" in s
        sc = s["scoring"]
        assert 0 <= sc["score"] <= 100
        assert sc["grade"] in ("A", "B", "C", "D")
        assert 0 <= sc["security_score"] <= 100
        assert sc["security_level"] in ("low", "medium", "high", "critical")
        assert isinstance(sc["confirm_required"], bool)
    # postgres(凭据 + 数据库)与 github(PAT + 托管)需确认
    by_key = {s["key"]: s["scoring"] for s in servers}
    assert by_key["postgres"]["confirm_required"] is True
    assert by_key["github"]["confirm_required"] is True
    assert by_key["sequential-thinking"]["confirm_required"] is False


# =============================================================================
# 端点:GET /api/mcp/store/{key}/score(评分详情)
# =============================================================================


def test_score_endpoint_full_detail(api_client):
    r = api_client.get("/api/mcp/store/sequential-thinking/score")
    assert r.status_code == 200
    body = r.json()
    assert body["key"] == "sequential-thinking"
    assert body["quality"]["grade"] in ("A", "B", "C", "D")
    assert body["security"]["level"] == "low"
    assert "dimensions" in body
    q_names = {d["name"] for d in body["dimensions"]["quality"]}
    s_names = {d["name"] for d in body["dimensions"]["security"]}
    assert q_names == {"source", "description", "transport", "env_docs", "tags", "runtime"}
    assert s_names == {"credentials", "supply_chain", "capability"}
    assert isinstance(body["risk_factors"], list)
    assert body["recommendation"]


def test_score_endpoint_unknown_key_404(api_client):
    r = api_client.get("/api/mcp/store/nonexistent-key/score")
    assert r.status_code == 404


# =============================================================================
# 端点:安装风险确认门(POST /api/mcp/store/install)
# =============================================================================


def test_install_high_risk_requires_confirm(api_client, clean_registry):
    """postgres(high)未确认 → 409 RISK_CONFIRM_REQUIRED + scoring 详情,不落盘。"""
    r = api_client.post(
        "/api/mcp/store/install",
        json={"key": "postgres", "env": {"DATABASE_URL": "postgresql://x/y"}},
    )
    assert r.status_code == 409
    body = r.json()
    assert body["errorCode"] == "RISK_CONFIRM_REQUIRED"
    assert body["scoring"]["security"]["level"] == "high"
    assert body["scoring"]["confirm_required"] is True
    # 未确认 → 未安装、未挂载
    assert mcp_store.get_installed("postgres") is None


def test_install_high_risk_with_confirm_proceeds(
    api_client, bridge_mock, clean_registry
):
    """confirm_risk=true → 正常安装流程(bridge mock)。"""
    r = api_client.post(
        "/api/mcp/store/install",
        json={
            "key": "postgres",
            "env": {"DATABASE_URL": "postgresql://x/y"},
            "confirm_risk": True,
        },
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert bridge_mock["add"][0]["name"] == "postgres"
    assert mcp_store.get_installed("postgres") is not None


def test_install_low_risk_no_confirm_needed(api_client, bridge_mock, clean_registry):
    """低风险条目(sequential-thinking)无需 confirm_risk 直接装。"""
    r = api_client.post(
        "/api/mcp/store/install",
        json={"key": "sequential-thinking"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_install_unknown_key_404(api_client, clean_registry):
    r = api_client.post("/api/mcp/store/install", json={"key": "no-such-key"})
    assert r.status_code == 404


# =============================================================================
# 端点错误降级
# =============================================================================


def test_score_endpoint_internal_error_500(api_client, monkeypatch):
    """评分引擎异常 → 500(不崩进程)。"""

    def boom(entry):
        raise RuntimeError("scoring boom")

    monkeypatch.setattr(mcp_scoring, "score_entry", boom)
    r = api_client.get("/api/mcp/store/time/score")
    assert r.status_code == 500
