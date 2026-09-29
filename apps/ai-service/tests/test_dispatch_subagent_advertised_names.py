# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D145① 回归:dispatch_subagent 广告给模型的 agent 名必须逐个能在注册表解析。

取证 docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md §十一.3 D145 行与 §十 D145 第 2 栏:
旧工具描述硬编码 5 个注册表里**根本不存在**的名(code-reviewer/bug-fixer/feature-planner/
test-writer/refactorer),模型照说明书调用 `agent_orchestrator.invoke` 必回
"Agent 不存在"。修复 = 广告面改为**注册表现读拼接**(唯一出口
`mcp_server._dispatch_subagent_description`),未知名回包补 `availableAgents`。

本文件的三条判据各有成对的反向对照,证明"清单腐烂"与"回包自纠"两型都真的有牙:

- test_every_advertised_name_resolves —— 运行时广告名单与注册表集合**相等**
  (只判"逐个可解析"会放过"硬编码了一份今天恰好全合法、明天注册表一变即腐烂"的清单);
- test_advertised_surface_follows_registry —— 注册表增删一档,广告面必须跟随。
  **把拼接改回硬编码清单 ⇒ 本用例必红**(反向对照,任务书点名要求);
- test_hardcoded_ghost_list_fails_the_same_check —— 用**旧描述原文**喂同一解析,
  断言它逐名点不出 5 个幽灵名 = 判据对旧形态必红(阳性对照);
- test_deferred_surface_advertises_the_same_names —— **两条**广告面必须同源:
  TOOL_DEFERRAL=on 时模型只看到被截断的骨架,完整描述只能经 `get_full_tool_schema()` 反查,
  而那张 deferral 注册表是 import 期从 `_TOOLS` 灌的快照 ⇒ 反查面不现读就等于向模型广告
  0 个可用名(评审 Important 那一格)。**摘掉运行期那条展开 ⇒ 本用例必红**;
- test_unknown_agent_reply_carries_available_agents —— 未知名回包带
  availableAgents/errorCode,且既有键(status/error 文案)一字未动 —— wire 值纪律。

隔离纪律(评审 Minor③):本文件**不改全局单例**。"注册表演进而广告面跟随"那一维用
monkeypatch 把 `mcp_server._get_orchestrator` 指到一份**独立的** `AgentRegistry` ——
直接对 `agent_orchestrator.registry` 做 register/remove 会污染整个测试会话
(xdist 下别的用例同读那份单例 ⇒ 串味,且 `finally` 也救不回并发读取方)。

§5 测试隔离:全程不碰 DB/Redis —— 注册表落空分支在 invoke 的 registry.get 处即返回,
不产生任何 LLM/网络/库副作用。
"""

from __future__ import annotations

import re

import pytest

from app.services.agent_orchestrator import (
    AgentDefinition,
    AgentOrchestrator,
    AgentRegistry,
    agent_orchestrator,
)
from app.services.mcp_server import (
    _dispatch_subagent_description,
    _tool_dispatch_subagent,
    get_full_tool_schema,
    mcp_server,
)

MARKER = "可用 agent 名称(注册表现读):"
_GHOSTS = ("code-reviewer", "bug-fixer", "feature-planner", "test-writer", "refactorer")

# 旧描述原文(逐字取自修复前的 HEAD,阳性对照专用;它**不是**任何一侧的真相,
# 只是判据的输入夹具 —— 拿它喂同一提取式,必须逐名点出幽灵)。
_LEGACY_DESC = (
    "派发子智能体执行独立任务(子任务分解 / 多视角审查 / 并行执行)。"
    "可用 agent 名称:code-reviewer(代码审查)、bug-fixer(Bug 修复)、"
    "feature-planner(功能规划)、test-writer(测试编写)、refactorer(重构建议)。"
    "调用后子智能体独立执行并返回结果,不污染主对话上下文。"
)


def _advertised_names(desc: str, marker: str = MARKER) -> list[str]:
    """从描述文本取广告名单:marker 后到句号,按 、 分档,每档取头部 ASCII 名串。

    取不到 marker 直接判失败 —— 广告面被整体摘掉(或改名)时,本文件必须喊出来,
    不得静默读成"没有广告名 ⇒ 无需解析"。
    """
    i = desc.find(marker)
    if i < 0:
        raise AssertionError(f"描述文本里找不到广告面标记 {marker!r}(广告面被摘线/改名)")
    j = desc.find("。", i)
    seg = desc[i + len(marker) : j if j >= 0 else None]
    names: list[str] = []
    for chunk in seg.split("、"):
        m = re.match(r"[a-z][a-z0-9-]*", chunk.strip())
        if m:
            names.append(m.group(0))
    return names


def _dispatch_tool_description() -> str:
    for t in mcp_server.list_tools():
        if t.name == "dispatch_subagent":
            return t.description
    raise AssertionError("list_tools() 里已找不到 dispatch_subagent(工具被摘线/改名)")


def test_every_advertised_name_resolves() -> None:
    """票面验收①:广告给模型的每个名字都必须能在注册表解析,且集合与注册表逐字相等。"""
    names = _advertised_names(_dispatch_tool_description())
    registry_names = sorted(set(agent_orchestrator.registry.names()))
    assert len(names) > 0, "广告名单为空(注册表读不到?)—— 空广告面同样是指路失败"
    unresolved = [n for n in names if agent_orchestrator.registry.get(n) is None]
    assert unresolved == [], f"广告名在注册表解析不到:{unresolved}"
    assert sorted(names) == registry_names, (
        "广告面与注册表现读集合不等(多/少任何一档都是'说明书指一条不存在的门'的同类形态)"
    )
    for ghost in _GHOSTS:
        assert ghost not in names, f"历史幽灵名 {ghost} 回潮"


def _deferred_description() -> str:
    """第二条广告面:deferral 反查入口(TOOL_DEFERRAL=on 时模型唯一的完整描述来源)。"""
    schema = get_full_tool_schema("dispatch_subagent")
    assert schema is not None, "deferral 注册表里没有 dispatch_subagent(注册面被摘线/改名)"
    desc = schema.get("description")
    assert isinstance(desc, str) and desc, "反查面交回的描述为空"
    return desc


def test_deferred_surface_advertises_the_same_names(monkeypatch: pytest.MonkeyPatch) -> None:
    """评审 Important:两条广告面必须**同源**从注册表现读拼接。

    `_populate_deferred_schemas()` 在 import 期把 `_TOOLS` 的描述(只有静态骨架)灌进
    `_DEFERRED_TOOL_SCHEMAS`,如果反查面原样交回那份快照,清单面修得再好,模型在
    TOOL_DEFERRAL=on 下仍然只看到 0 个可用名。本用例把这条面单独钉一次:
    ① 反查面的名单与注册表现读集合**相等**;
    ② 注册表演进(独立 registry + monkeypatch)时反查面必须跟随 ——
       **把 `get_full_tool_schema` 改回 `return _DEFERRED_TOOL_SCHEMAS.get(name)` ⇒ 本用例必红**。
    """
    names = _advertised_names(_deferred_description())
    registry_names = sorted(set(agent_orchestrator.registry.names()))
    assert names, "反查面广告 0 个名(import 期快照回潮:清单面修了、反查面没修)"
    assert sorted(names) == registry_names, (
        f"反查面与清单面/注册表不同源:反查=[{sorted(names)}] 注册表=[{registry_names}]"
    )
    # 两条面逐字同源(同一份出口产出,不是各拼一份再对账)
    assert names == _advertised_names(_dispatch_tool_description()), "两条广告面各自漂移"

    # 现读性:换一份独立注册表(带探针档),两条面都必须立刻跟随
    reg = AgentRegistry()
    probe = "d145-defer-probe"
    assert reg.get(probe) is None, f"探针名 {probe} 已被占用,本对照空转"
    reg.register(
        AgentDefinition(name=probe, description="D145 反查面探针(仅测试)", system_prompt="noop")
    )
    stub = AgentOrchestrator(registry=reg)
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: stub)
    assert probe in _advertised_names(_deferred_description()), (
        "注册表新增一档而反查面未跟随 ⇒ 那条面交回的是 import 期快照,不是现读名单"
    )
    assert probe in _advertised_names(_dispatch_tool_description()), "清单面同样必须跟随"


def test_advertised_surface_follows_registry(monkeypatch: pytest.MonkeyPatch) -> None:
    """反向对照(任务书点名):把"注册表现读拼接"改回硬编码清单 ⇒ 本用例必红。

    评审修复轮 1③:原写法直接对全局单例 register/remove,xdist 并行时别的用例会同读那份
    registry(串味),且 `finally` 恢复不了并发读取方看到的中间态。现改为 monkeypatch 把
    mcp_server 的 lazy 出口指到一份**独立的** AgentRegistry(默认档由它自己注册,与单例
    零共享),增删各验一次后由 monkeypatch 自动复位。
    """
    import app.services.mcp_server as m

    reg = AgentRegistry()
    base = sorted(set(reg.names()))
    assert base, "独立注册表读不到默认档(构造形态变了 ⇒ 本用例空转,必须喊出来)"
    stub = AgentOrchestrator(registry=reg)
    monkeypatch.setattr(m, "_get_orchestrator", lambda: stub)

    probe = "d145-probe-agent"
    assert reg.get(probe) is None, f"探针名 {probe} 已被占用,本对照空转"
    advertised = _advertised_names(_dispatch_tool_description())
    assert sorted(advertised) == base, f"桩注册表下广告面未等值:{advertised}"

    reg.register(
        AgentDefinition(name=probe, description="D145 回归探针(仅测试)", system_prompt="noop")
    )
    assert probe in _advertised_names(_dispatch_tool_description()), (
        "注册表新增一档而广告面未跟随 ⇒ 名单是被烘死的第二份清单"
    )
    removed = base[0]
    assert reg.remove(removed), f"独立注册表移除 {removed} 失败 ⇒ 本对照空转"
    assert removed not in _advertised_names(_dispatch_tool_description()), (
        "注册表已移除一档而广告面仍挂着它 ⇒ 同上,幽灵名就是这么产生的"
    )
    # 演进后广告面必须与**这一份**注册表逐字等值(既不多也不少)
    assert sorted(_advertised_names(_dispatch_tool_description())) == sorted(set(reg.names()))
    # 单例未被本用例触碰(隔离纪律):全局那份仍等于自己的默认档
    assert sorted(set(agent_orchestrator.registry.names())) == sorted(
        set(AgentRegistry().names())
    ), "本用例污染了全局单例"


def test_hardcoded_ghost_list_fails_the_same_check() -> None:
    """阳性对照:旧描述原文(修复前 HEAD 逐字)喂同一提取式,必须逐名点出 5 个幽灵。

    没有这一条,"广告名可解析"判据只是此刻碰巧绿;有了它,判据被削弱回旧形态时
    test_every_advertised_name_resolves 之外还有本条会红。
    """
    names = _advertised_names(_LEGACY_DESC, marker="可用 agent 名称:")
    assert set(names) == set(_GHOSTS), f"夹具与取证原文漂移:{names}"
    unresolved = [n for n in names if agent_orchestrator.registry.get(n) is None]
    assert unresolved == sorted(_GHOSTS) or set(unresolved) == set(_GHOSTS), (
        "旧描述里的幽灵名竟全部可解析 ⇒ 注册表已把这些名落地,本对照需持有人重新定性"
    )


async def test_unknown_agent_reply_carries_available_agents() -> None:
    """未知名回包补 availableAgents(让调用方自纠),且既有 wire 键一字未动。"""
    out = await _tool_dispatch_subagent({"name": "d145-ghost-agent", "task": "noop"})
    assert out["ok"] is False
    assert out["mode"] == "single"
    assert "不存在" in str(out["error"]), "wire 文案必须保持 invoke 的原话,不回显成另一套"
    assert out["errorCode"] == "AGENT_NOT_FOUND"
    assert out["availableAgents"] == sorted(set(agent_orchestrator.registry.names()))


def test_description_falls_back_loudly_without_registry(monkeypatch: pytest.MonkeyPatch) -> None:
    """注册表读不到时广告面**留空并说明**,绝不广告猜出来的名(降级必须可见)。

    monkeypatch 复位(评审修复轮 1③同一条纪律:手工 try/finally 赋值一旦中途抛错就会把
    模块函数留在被替换的状态)。
    """
    import app.services.mcp_server as m

    def _boom() -> None:
        raise RuntimeError("registry unavailable (D145 fallback fixture)")

    monkeypatch.setattr(m, "_get_orchestrator", _boom)
    for label, desc in (
        ("清单面", _dispatch_subagent_description()),
        ("反查面", _deferred_description()),
    ):
        assert MARKER not in desc, f"{label} 在读不到注册表时仍拼出了广告段"
        assert "availableAgents" in desc, f"{label} 降级文案必须告诉模型自纠出口在哪"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
