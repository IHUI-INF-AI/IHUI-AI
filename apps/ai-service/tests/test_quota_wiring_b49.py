# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""四维配额「装车」接线锁(goal-b49 W1,2026-11-05 立)。

治的是 AGENTS §0.9 那一格:判据在 `tool_budget_governor` 里躺着,全仓除台账文案外
**零真实消费点**。本文件逐维钉住"接上了 + 接得对",每条都有正反对照:

- mcp_tool_limit  → `MCPClientManager._collect_tools`(注册工具面唯一聚合出口)
- mcp_token_limit → `MCPClient.call_tool`(出站副作用前的令牌桶预扣)
- custom_prompt_token_limit → `AdditionalContextStore.merge`(自定义提示投出前)
- history_query_limit → `compaction_retention.truncate_retained_messages`(历史窗口请求)

最后一类对照(§12e「不得造恒拦门」):**未配置 ⇒ 该维不拦**;而拦下时也不许静默截断
(少一枚工具 / 少一段提示 / 少几行历史,对模型都等于"本来就没有")。

判据单源(§22c 同纪律):维度名 / 文案 / 阈值比较一律 import 源模块,本文件不复写;
token 量法只认 `core/context_compaction.estimate_tokens` 这一把尺(测试 ⑤ 钉引用)。
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.additional_context_store import (
    KIND_APPLICATION,
    KIND_UNTRUSTED,
    AdditionalContextEntry,
    AdditionalContextStore,
)
from app.core.compaction_retention import (
    check_history_window_quota,
    select_retained_history,
    truncate_retained_messages,
)
from app.core.context_compaction import estimate_tokens
from app.services import mcp_client as mcp_client_module
from app.services.mcp_client import (
    MCP_QUOTA_SERVER_BUCKET_PREFIX,
    MCPClient,
    MCPClientConfig,
    MCPClientManager,
    MCPClientTool,
    bind_mcp_principal,
    mcp_payload_tokens,
    mcp_quota_bucket,
    reset_mcp_principal,
)
from app.services.tool_budget_governor import (
    BUDGET_DIMENSIONS,
    BUDGET_EXCEEDED,
    DIM_CUSTOM_PROMPT_TOKEN_LIMIT,
    DIM_HISTORY_QUERY_LIMIT,
    DIM_MCP_TOKEN_LIMIT,
    DIM_MCP_TOOL_LIMIT,
    ToolBudgetConfig,
    ToolBudgetExceededError,
    ToolBudgetGovernor,
)


def _gov(**limits: int) -> ToolBudgetGovernor:
    """只开指定分维(run 循环维保持默认关闭)——维度名即配置字段名。"""
    return ToolBudgetGovernor(ToolBudgetConfig(**limits))


def _closed_gov() -> ToolBudgetGovernor:
    """等价于"env 一个都没配"的出厂形态:四维全 0 ⇒ 四维都不拦。"""
    return ToolBudgetGovernor(ToolBudgetConfig.from_env({}))


def _fake_client(server_name: str, tool_count: int) -> MagicMock:
    """已连接、固定工具数的假 client(聚合面只用到 is_connected 与 list_tools)。"""
    client = MagicMock()
    client.is_connected.return_value = True
    client.config = MCPClientConfig(name=server_name, transport="stdio")
    client.list_tools = AsyncMock(
        return_value=[
            MCPClientTool(
                name=f"{server_name}_t{i}",
                description=f"d{i}",
                input_schema={"type": "object"},
                server_name=server_name,
            )
            for i in range(tool_count)
        ]
    )
    return client


def _seeded_manager(gov: ToolBudgetGovernor, **servers: int) -> MCPClientManager:
    manager = MCPClientManager(budget_governor=gov)
    for name, count in servers.items():
        manager._clients[name] = _fake_client(name, count)
        manager._owners[name] = "u1"
    return manager


def _msgs(n: int) -> list[dict[str, Any]]:
    return [{"role": "user", "content": f"第 {i} 条历史"} for i in range(n)]


# ① MCP 注册工具面(mcp_tool_limit)==========================================


@pytest.mark.asyncio
async def test_mcp_tool_surface_unset_delivers_everything() -> None:
    """正向对照(未配置=不拦):一枚都不许少,且一个计数都不写。"""
    gov = _closed_gov()
    manager = _seeded_manager(gov, alpha=3, beta=2)
    tools = await manager.list_available_tools_async("u1")
    assert len(tools) == 5
    assert gov.dim_state("any")["used"][DIM_MCP_TOOL_LIMIT] == 0


@pytest.mark.asyncio
async def test_mcp_tool_surface_at_limit_still_full_pass() -> None:
    """实测 == 上限是放行;超限才拒 —— 边界不得自己造截断。"""
    tools = await _seeded_manager(_gov(mcp_tool_limit=5), alpha=3, beta=2).list_available_tools_async("u1")
    assert len(tools) == 5


@pytest.mark.asyncio
async def test_mcp_tool_surface_over_limit_denies_by_name_not_truncates() -> None:
    gov = _gov(mcp_tool_limit=4)
    manager = _seeded_manager(gov, alpha=3, beta=2)
    with pytest.raises(ToolBudgetExceededError) as exc:
        await manager.list_available_tools_async("u1")
    reason = exc.value.reason
    assert exc.value.dimension == DIM_MCP_TOOL_LIMIT
    assert exc.value.error_type == BUDGET_EXCEEDED
    # 具名拒绝三要素:维度名 + 实测条数 + 上限条数(缺一即没人知道该调哪一格)
    assert DIM_MCP_TOOL_LIMIT in reason
    assert "5" in reason and "4" in reason
    result = exc.value.result
    assert result is not None and result.used[DIM_MCP_TOOL_LIMIT] == 5


# ② MCP 令牌桶(mcp_token_limit)=============================================


@pytest.mark.asyncio
async def test_mcp_token_bucket_unset_executes_call_and_charges_nothing() -> None:
    """正向对照:该维未配 ⇒ 请求照常发出、结果照常返回、桶一个字节都不记。"""
    gov = _closed_gov()
    client = MCPClient(MCPClientConfig(name="svr", transport="stdio"), budget_governor=gov)
    client._send_request = AsyncMock(return_value={"result": {"content": "ok"}})
    out = await client.call_tool("t", {"q": "x"}, quota_run_id="r-off")
    assert out == {"content": "ok"}
    assert client._send_request.await_count == 1
    assert gov.dim_state("r-off")["used"][DIM_MCP_TOKEN_LIMIT] == 0


@pytest.mark.asyncio
async def test_mcp_token_bucket_over_limit_denies_before_any_side_effect() -> None:
    """超限 ⇒ 具名拒绝,且**一帧都不发出**(出站调用会用那台 server 的凭据起进程)。"""
    gov = _gov(mcp_token_limit=1)
    client = MCPClient(MCPClientConfig(name="svr", transport="stdio"), budget_governor=gov)
    send = AsyncMock(return_value={"result": {"content": "不该被执行"}})
    client._send_request = send

    denial = await client.call_tool("t", {"q": "x" * 400}, quota_run_id="r1")
    assert isinstance(denial, dict) and denial["ok"] is False
    assert denial["code"] == BUDGET_EXCEEDED
    assert denial["quotaDimension"] == DIM_MCP_TOKEN_LIMIT
    assert send.await_count == 0, "被拒的本次不得发出请求(副作用断言)"
    assert DIM_MCP_TOKEN_LIMIT in denial["error"]
    assert denial["quotaBucket"] == "r1"
    assert denial["quotaBucketSource"] == "run_id"
    # 被拒的本次不入库(判据侧同一条纪律),已用量不受污染
    assert gov.dim_state("r1")["used"][DIM_MCP_TOKEN_LIMIT] == 0


@pytest.mark.asyncio
async def test_mcp_token_bucket_accumulates_and_names_current_usage() -> None:
    gov = _gov(mcp_token_limit=4000)
    client = MCPClient(MCPClientConfig(name="svr", transport="stdio"), budget_governor=gov)
    client._send_request = AsyncMock(return_value={"result": {"content": "响应正文"}})
    first = await client.call_tool("t", {"q": "第一次"}, quota_run_id="r2")
    assert isinstance(first, dict) and first.get("content") == "响应正文"
    used = gov.dim_state("r2")["used"][DIM_MCP_TOKEN_LIMIT]
    assert used > 0, "请求与响应都要入账,否则令牌桶形同虚设"

    gov.config.mcp_token_limit = used  # 把上限钉在"已用量"⇒ 下一次调用必被拦
    denial = await client.call_tool("t", {"q": "第二次"}, quota_run_id="r2")
    assert isinstance(denial, dict) and denial["ok"] is False
    assert str(used) in denial["error"], "拒绝文案必须点名当前用量/上限"


@pytest.mark.asyncio
async def test_mcp_token_bucket_unresolvable_bucket_is_refused_not_skipped() -> None:
    """判不出归属桶 ⇒ 大声拒绝并说要什么(§0.10:绝不能"判不出就当没这一维")。"""
    gov = _gov(mcp_token_limit=100)
    client = MCPClient(MCPClientConfig(name="", transport="stdio"), budget_governor=gov)
    send = AsyncMock(return_value={"result": {}})
    client._send_request = send
    denial = await client.call_tool("t", {"a": 1})
    assert isinstance(denial, dict) and denial["ok"] is False
    assert denial["quotaBucketSource"] == "unresolved"
    assert "run_id" in denial["error"]
    assert send.await_count == 0


def test_mcp_quota_bucket_resolution_order_is_the_single_exit() -> None:
    assert mcp_quota_bucket("run-9", server_name="svr") == ("run-9", "run_id")
    token = bind_mcp_principal("user-7")
    try:
        assert mcp_quota_bucket("", server_name="svr") == ("user-7", "principal")
    finally:
        reset_mcp_principal(token)
    bucket, source = mcp_quota_bucket("", server_name="svr")
    assert bucket == f"{MCP_QUOTA_SERVER_BUCKET_PREFIX}svr"
    assert source == "server-fallback"
    assert mcp_quota_bucket("") == ("", "unresolved")


# ③ 自定义提示面(custom_prompt_token_limit)==================================


def test_custom_prompt_unset_renders_the_same_fragments_as_before() -> None:
    """正向对照:未配置 ⇒ 片段角色 / 正文 / content_kind 与接线前逐字相同。"""
    store = AdditionalContextStore(budget_governor=_closed_gov())
    values = {
        "note": AdditionalContextEntry(kind=KIND_UNTRUSTED, value="外部笔记"),
        "policy": AdditionalContextEntry(kind=KIND_APPLICATION, value="应用侧提示"),
    }
    fragments = store.merge(values)
    assert len(fragments) == 2
    assert [f["_content_kind"] for f in fragments] == [
        "additional_content.note",
        "additional_content.policy",
    ]
    assert fragments[0]["role"] == "user"
    assert "外部笔记" in json.dumps(fragments[0], ensure_ascii=False)
    assert store.denied_keys() == []


def test_custom_prompt_under_limit_passes_through() -> None:
    store = AdditionalContextStore(budget_governor=_gov(custom_prompt_token_limit=10_000))
    fragments = store.merge({"p": AdditionalContextEntry(kind=KIND_APPLICATION, value="短提示")})
    assert len(fragments) == 1
    assert fragments[0]["_content_kind"] == "additional_content.p"
    assert store.denied_keys() == []


def test_custom_prompt_over_limit_emits_named_denial_not_content() -> None:
    store = AdditionalContextStore(budget_governor=_gov(custom_prompt_token_limit=4))
    oversized = AdditionalContextEntry(kind=KIND_APPLICATION, value="这段自定义提示明显超出四个 token")
    small = AdditionalContextEntry(kind=KIND_APPLICATION, value="短")
    fragments = store.merge({"big": oversized, "small": small})
    assert len(fragments) == 2, "同批次里没超的那一格不受牵连"

    denial = fragments[0]  # sorted(keys) ⇒ big 在前
    assert denial["role"] == "developer"
    assert denial["_content_kind"] == "custom_prompt_quota.denied.big"
    text = denial["content"][0]["text"]
    assert DIM_CUSTOM_PROMPT_TOKEN_LIMIT in text
    assert 'limit="4"' in text
    assert "超出四个" not in text, "被拒正文一个字都不许投出(静默放行才是事故)"
    assert store.denied_keys() == ["big"]
    assert len(store) == 1, "被拒的 key 不算已交付"


def test_custom_prompt_denial_not_spammed_and_recovers_when_limit_rises() -> None:
    gov = _gov(custom_prompt_token_limit=4)
    store = AdditionalContextStore(budget_governor=gov)
    values = {"p": AdditionalContextEntry(kind=KIND_APPLICATION, value="很长很长很长很长的自定义提示")}
    assert len(store.merge(values)) == 1
    assert store.merge(values) == [], "同一个被拒值不逐轮刷屏(与既有同值去重同纪律)"

    gov.config.custom_prompt_token_limit = 10_000  # 运维把上限调高
    delivered = store.merge(values)
    assert len(delivered) == 1
    assert delivered[0]["_content_kind"] == "additional_content.p"
    assert store.denied_keys() == [], "被拒值没被误记成已交付 ⇒ 调高上限后能正常投出"


# ④ 历史查询窗口(history_query_limit)=======================================


def test_history_window_unset_keeps_existing_behaviour() -> None:
    """正向对照:未配置 ⇒ 保留区照常产出,且该维不写任何计数。"""
    gov = _closed_gov()
    retained, stats = truncate_retained_messages(_msgs(6), budget_governor=gov)
    assert stats["groups_total"] >= 1
    assert len(retained) >= 1
    assert gov.dim_state()["used"][DIM_HISTORY_QUERY_LIMIT] == 0


def test_history_window_over_limit_raises_named_denial() -> None:
    gov = _gov(history_query_limit=3)
    with pytest.raises(ToolBudgetExceededError) as exc:
        truncate_retained_messages(_msgs(4), budget_governor=gov)
    assert exc.value.dimension == DIM_HISTORY_QUERY_LIMIT
    assert DIM_HISTORY_QUERY_LIMIT in exc.value.reason
    assert "4" in exc.value.reason and "3" in exc.value.reason


def test_history_window_at_limit_and_empty_request_pass() -> None:
    gov = _gov(history_query_limit=3)
    retained, _stats = truncate_retained_messages(_msgs(3), budget_governor=gov)
    assert len(retained) >= 1
    check_history_window_quota(0, governor=gov)
    assert len(select_retained_history(_msgs(2), summary="摘要", budget_governor=gov)) >= 1


def test_select_retained_history_propagates_denial() -> None:
    with pytest.raises(ToolBudgetExceededError):
        select_retained_history(_msgs(5), budget_governor=_gov(history_query_limit=2))


# ⑤ 量法单源(§0.6:不得新增第二把尺)========================================


def test_mcp_payload_measure_is_the_context_compaction_ruler() -> None:
    """MCP 载荷计量必须等于 `context_compaction.estimate_tokens`(BPE 单源)。

    仓内两把占位粗估(mcp_server 的 len//4、additional_context_store 的 bytes//4)刻意
    不取 —— 配额只有和压缩链同一把尺,才与上下文预算可比。
    """
    assert mcp_client_module._MCP_QUOTA_TOKEN_MEASURE is estimate_tokens
    args = {"q": "积分与 english 混排"}
    expect = estimate_tokens("t" + json.dumps(args, ensure_ascii=False, sort_keys=True))
    assert mcp_payload_tokens("t", args) == expect
    assert mcp_payload_tokens() == 0


# ⑥ 四维全关:一条都不拦(§12e 反恒拦门)=====================================


@pytest.mark.asyncio
async def test_all_four_dims_unset_never_blocks_any_consumption_point() -> None:
    gov = _closed_gov()
    assert all(gov.config.dim_limit(d) == 0 for d in BUDGET_DIMENSIONS)

    assert len(await _seeded_manager(gov, alpha=50).list_available_tools_async("u1")) == 50

    client = MCPClient(MCPClientConfig(name="svr", transport="stdio"), budget_governor=gov)
    client._send_request = AsyncMock(return_value={"result": {"content": "x"}})
    out = await client.call_tool("t", {"q": "y" * 5000}, quota_run_id="r-all")
    assert out == {"content": "x"}

    store = AdditionalContextStore(budget_governor=gov)
    big = AdditionalContextEntry(kind=KIND_APPLICATION, value="长" * 5000)
    assert len(store.merge({"p": big})) == 1
    assert store.denied_keys() == []

    retained, _stats = truncate_retained_messages(_msgs(120), budget_governor=gov)
    assert len(retained) >= 1
    used = gov.dim_state("r-all")["used"]
    assert all(used[d] == 0 for d in BUDGET_DIMENSIONS), used


# ⑦ 活消费点(agent loop)必须把拒绝说出来,而不是洗成 reason="error" ============


def _make_loop() -> Any:
    from app.services.agent_loop_v2 import AgentLoopV2

    async def _noop_complete(*_a: Any, **_k: Any) -> dict[str, Any]:
        return {"content": "", "tool_calls": None}

    return AgentLoopV2(llm_complete_fn=_noop_complete, tools=[])


def _retention_msgs() -> list[dict[str, Any]]:
    return [
        {"role": "user", "content": "[上下文摘要 — 之前 10 条消息已压缩]历史要点"},
        {"role": "user", "content": "近一条"},
        {"role": "user", "content": "再近一条"},
    ]


def test_loop_history_quota_denial_is_named_not_swallowed(monkeypatch: pytest.MonkeyPatch) -> None:
    """单测 `truncate_retained_messages` 会抛不算装车:这里量的是**主循环那一个消费点**。

    通用 `except Exception` 会把配额拒绝洗成 `reason="error"`(§0.9 的另一格:线接了、
    判据跑了,但拒绝在出口处没人看得见)。本用例钉住 meta 如实带出维度名与实测/上限。
    """
    from app.services.tool_budget_governor import tool_budget_governor as singleton

    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_ENABLED", "on")
    monkeypatch.setattr(singleton.config, "history_query_limit", 1)

    loop = _make_loop()
    messages = _retention_msgs()
    out, meta = loop._apply_retention_budget(messages)
    assert meta["reason"] == "history_query_quota_denied", meta
    assert meta["quotaDimension"] == DIM_HISTORY_QUERY_LIMIT
    assert meta["quotaMeasured"] == 2 and meta["quotaLimit"] == 1
    assert out is messages, "拒绝精修不等于清空活上下文(本函数自带的保守护栏)"


def test_loop_history_quota_unset_keeps_pre_wiring_meta(monkeypatch: pytest.MonkeyPatch) -> None:
    """正向对照:该维未配 ⇒ 走的就是接线前那条路(meta 里没有配额字样)。"""
    from app.services.tool_budget_governor import tool_budget_governor as singleton

    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_ENABLED", "on")
    monkeypatch.setattr(singleton.config, "history_query_limit", 0)

    loop = _make_loop()
    _out, meta = loop._apply_retention_budget(_retention_msgs())
    assert meta.get("enabled") is True
    assert "history_query_quota_denied" not in json.dumps(meta, default=str)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
