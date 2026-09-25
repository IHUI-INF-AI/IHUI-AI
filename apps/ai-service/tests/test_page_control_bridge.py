# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""页面语义快照句柄族工具面测试(2026-09-25 立,该能力开放为对外产品能力那张票)。

三条验收口径各自对应一组用例,缺一条就是没交付:
① 未授权时这一族**不出现在模型可见工具面**(`TestGate`,含查询失败的 fail-closed);
② 授权后模型可声明、**执行体仍在端侧**(`TestEndpointSideExecution`:本进程只发一次
   agent-control POST,绝不本地执行动词);
③ 页面正文**不随对外响应泄漏**(`TestNoOutboundLeak`:反向对照,读网关与凭据登记表本体,
   证明机器凭据既请求不到这一族、也打不开执行通道 —— 而不是靠"我把 body 塞进返回体才跑得通"
   这种反向的绿)。
另有一组防漂移用例:动词清单对共享契约逐字比、客户端携带清单对服务端注册面双向比、
闸必须真的接在 llm.py 的入口上(装车证明)。
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import httpx
import pytest

from app.services import control_autonomy as ca
from app.services import page_control_bridge as pc
from app.services import ui_action_bridge as ub
from app.services.mcp_server import mcp_server

_REPO_ROOT = Path(__file__).resolve().parents[3]
_USER = "6b8cd0f6-546f-44c8-853a-5f96edbe08be"
_PAGE_TOOLS = [f"browser_{v}" for v in pc.PAGE_CONTROL_VERBS]


class _Resp:
    def __init__(self, payload: Any = None, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code
        self.text = ""

    def raise_for_status(self) -> None:
        return None

    def json(self) -> Any:
        return self._payload


@pytest.fixture(autouse=True)
def _clean(monkeypatch: pytest.MonkeyPatch) -> Any:
    monkeypatch.setattr(ub, "_get_agent_control_secret", lambda: "page-test-secret")
    monkeypatch.delenv("PAGE_CONTROL_TOOLS", raising=False)
    ub._PINNED_INSTANCE.clear()
    ca.clear_cache_for_tests()
    yield
    pc.unregister_external_tool_by_prefix(pc._FAMILY_PREFIX)
    ub._PINNED_INSTANCE.clear()
    ca.clear_cache_for_tests()


@pytest.fixture
def captured(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    """截下所有出站到 agent-control 的请求(本进程唯一的副作用面)。"""
    calls: list[dict[str, Any]] = []

    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _Resp:
        calls.append({"method": method, "url": str(url), **kwargs})
        return _Resp(
            payload={
                "code": 0,
                "message": "ok",
                "data": {
                    "success": True,
                    "data": {"instanceId": "ext-test-1", "rows": [], "body": []},
                },
            }
        )

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    return calls


# ---------------------------------------------------------------------------
# 防漂移:动词清单 / 客户端携带清单 / 注册面 三方对齐
# ---------------------------------------------------------------------------


def _contract_page_actions() -> list[str]:
    """从共享契约 `PAGE_ACTIONS` 字面量取动词清单(唯一真相源)。"""
    text = (_REPO_ROOT / "packages/dom-actions/src/page-snapshot/contract.ts").read_text(
        encoding="utf-8"
    )
    block = re.search(r"export const PAGE_ACTIONS[^=]+=\s*\[(.*?)\]", text, re.S)
    assert block, "contract.ts 里找不到 export const PAGE_ACTIONS = [...](改名即断链,视为失败)"
    return re.findall(r"'([a-z_]+)'", block.group(1))


def test_verb_list_matches_shared_contract() -> None:
    """Python 侧动词清单必须与 @ihui/dom-actions 的 PAGE_ACTIONS 逐字同集合。

    跨语言复制一份字面量是本仓既有范式(_FAMILY_ACTIONS / _APP_ACTIONS 同此),但复制必须
    被机器看守:共享包加一条动词而这里没跟上 ⇒ 新动词永远进不了模型工具面(静默少能力);
    这里多一条 ⇒ 端上回 UNSUPPORTED_ACTION(谎报能力)。两种都是本用例要红的形态。
    """
    contract = _contract_page_actions()
    assert contract, "契约里解析出空清单(数组形态变了,不是没有动词)"
    assert set(pc.PAGE_CONTROL_VERBS) == set(contract), (
        f"服务端缺 {sorted(set(contract) - set(pc.PAGE_CONTROL_VERBS))} / "
        f"服务端多 {sorted(set(pc.PAGE_CONTROL_VERBS) - set(contract))}"
    )


def test_registered_tool_names_are_prefixed_family() -> None:
    """工具名 = `browser_` + 契约动词 ⇒ 与 CLI 侧逐字同名(跨端一个名字)。"""
    names = [tool.name for tool, _ in pc._page_tools()]
    assert names == _PAGE_TOOLS
    # 族名前缀必须整齐:服务端闸按 `browser_page_` 前缀摘工具,名字不规则的那条会漏网
    assert all(n.startswith("browser_page_") for n in names), names
    assert {n[len("browser_") :] for n in names} == set(pc.PAGE_CONTROL_VERBS)


def test_client_carried_list_matches_registered_surface() -> None:
    """web 携带清单 ↔ 服务端注册面 **双向**相等(与四族应用内 UI 同一把尺子)。

    端清单落后 ⇒ 模型看不见已注册的能力(静默少功能);端清单多出 ⇒ 请求一个不存在的工具名。
    """
    text = (_REPO_ROOT / "apps/web/src/hooks/use-chat/tool-config.ts").read_text(encoding="utf-8")
    block = re.search(
        r"export const BROWSER_PAGE_CONTROL_TOOLS\s*=\s*\[(.*?)\]",
        text,
        re.S,
    )
    assert block, "web 里找不到 BROWSER_PAGE_CONTROL_TOOLS 数组(改名即断链,视为失败)"
    client = set(re.findall(r"'([A-Za-z0-9_]+)'", block.group(1)))
    registered = {tool.name for tool, _ in pc._page_tools()}
    assert client, "客户端清单解析出空数组"
    assert client == registered, f"端缺 {sorted(registered - client)} / 端多 {sorted(client - registered)}"
    # 清单必须真的挂进 AGENT_TOOLS(声明了却没人展开=没有,守门 70 同型)
    agent_block = re.search(r"export const AGENT_TOOLS\s*=\s*\[(.*?)\]\s*as const", text, re.S)
    assert agent_block, "找不到 AGENT_TOOLS 数组"
    assert (
        "BROWSER_PAGE_CONTROL_TOOLS" in agent_block.group(1)
    ), "AGENT_TOOLS 没有展开 BROWSER_PAGE_CONTROL_TOOLS ⇒ 客户端永远不携带这一族"


# ---------------------------------------------------------------------------
# ② 授权后模型可声明、执行体仍在端侧
# ---------------------------------------------------------------------------


def test_register_page_control_tools_counts_and_idempotent() -> None:
    assert pc.register_page_control_tools() == 7
    assert pc.register_page_control_tools() == 0  # 同名不覆盖
    names = {t.name for t in mcp_server.list_tools()}
    assert set(_PAGE_TOOLS) <= names


def test_register_disabled_env_unregisters(monkeypatch: pytest.MonkeyPatch) -> None:
    assert pc.register_page_control_tools() == 7
    monkeypatch.setenv("PAGE_CONTROL_TOOLS", "false")
    assert pc.register_page_control_tools() == 0
    names = {t.name for t in mcp_server.list_tools()}
    assert not {n for n in names if n.startswith("browser_page_")}


async def test_handler_posts_to_agent_control_only(captured: list[dict[str, Any]]) -> None:
    """执行体在端侧:本进程只做一次 POST /api/agent-control/execute,category='browser'。"""
    pc.register_page_control_tools()
    handlers = {t.name: h for t, h in pc._page_tools()}
    out = await handlers["browser_page_click"]({"__user_id": _USER, "handle": "el:abcd1234:1"})

    assert len(captured) == 1, "除 agent-control 之外不应有任何执行副作用"
    call = captured[0]
    assert call["url"].endswith("/api/agent-control/execute")
    body = call["json"]
    assert body["category"] == "browser"
    assert body["action"] == "page_click"
    assert body["userId"] == _USER
    assert body["params"] == {"handle": "el:abcd1234:1"}, "内部字段必须剥离后再下发"
    assert not [k for k in body["params"] if k.startswith("__")]
    assert out["ok"] is True
    assert out["tool"] == "browser_page_click"


async def test_handler_requires_user_id(captured: list[dict[str, Any]]) -> None:
    out = await pc._make_page_handler("page_snapshot")({})
    assert out["ok"] is False
    assert out["errorCode"] == "PERMISSION_DENIED"
    assert captured == [], "缺身份时连一次请求都不该发出去"


async def test_handler_fail_closed_without_secret(
    captured: list[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ub, "_get_agent_control_secret", lambda: "")
    out = await pc._make_page_handler("page_click")({"__user_id": _USER, "handle": "el:a:1"})
    assert out["ok"] is False and out["errorCode"] == "MISSING_SECRET"
    assert captured == []


async def test_snapshot_pins_instance_for_next_verb(
    captured: list[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    """句柄的 scope 是**那一份文档**的私事:快照之后必须钉回同一实例,否则即刻 HANDLE_SCOPE_MISMATCH。"""

    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _Resp:
        captured.append({"method": method, "url": str(url), **kwargs})
        return _Resp(payload={"code": 0, "data": {"success": True, "data": {"instanceId": "ext-9"}}})

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    await pc._make_page_handler("page_snapshot")({"__user_id": _USER})
    await pc._make_page_handler("page_click")({"__user_id": _USER, "handle": "el:x:1"})
    assert captured[1]["json"].get("targetInstanceId") == "ext-9"


async def test_identity_reaches_handler_via_call_tool(captured: list[dict[str, Any]]) -> None:
    """真入口取证:模型只调工具名,身份由 call_tool 注入 —— 与 web_ui_* 同一条路径。

    刻意不断言"直接调 handler 也能拿到 userId"(它拿不到,那是设计):这一族的授权对象是
    会话主人,只能来自 request.state.user_id,不能来自模型给的参数。
    """
    assert pc.register_page_control_tools() == 7
    out = await mcp_server.call_tool("browser_page_snapshot", {}, user_id=_USER)
    assert len(captured) == 1
    assert captured[0]["json"]["userId"] == _USER
    assert captured[0]["json"]["category"] == "browser"
    assert out.get("ok") is True


def test_module_does_not_execute_pages_itself() -> None:
    """本服务没有 DOM:模块里不得出现任何"自己执行页面动词"的通道。

    出现 jsdom/playwright/document. 这一类,就意味着 ai-service 在给模型一份本地假回执 ——
    那比不登记这一族更糟(它会同时骗过模型与审计)。
    """
    src = Path(pc.__file__).read_text(encoding="utf-8")
    for forbidden in ("jsdom", "playwright", "selenium", "document.", "querySelector"):
        assert forbidden not in src, f"模块里出现了本地执行面 {forbidden!r}"


def test_schema_does_not_advertise_budget_params_the_endpoint_ignores() -> None:
    """反向对照:端侧通道不把 params 当预算喂 runPageAction ⇒ schema 里不得出现预算字段。

    把一个被静默忽略的参数交给模型,与谎报能力是同一种错(而且这次错在"看起来更灵活")。
    """
    ignored = {"max_elements", "maxElements", "max_body_chars", "max_row_chars", "budget"}
    for tool, _ in pc._page_tools():
        props = set((tool.input_schema or {}).get("properties", {}))
        assert not (props & ignored), f"{tool.name} 暴露了端侧会静默忽略的预算参数 {props & ignored}"


# ---------------------------------------------------------------------------
# ① 未授权 ⇒ 不进模型可见工具面
# ---------------------------------------------------------------------------


def _status(endpoints: list[dict[str, Any]]) -> _Resp:
    return _Resp(payload={"code": 0, "message": "ok", "data": {"endpoints": endpoints}})


def _extension_ep(**over: Any) -> dict[str, Any]:
    ep: dict[str, Any] = {"endpoint": "extension", "instanceId": "ext-1", "browserActions": 12}
    ep.update(over)
    return ep


async def test_gate_keeps_page_tools_when_endpoint_declares_family(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake(_user_id: str) -> list[dict[str, Any]]:
        return [_extension_ep(browserPageActions=7)]

    monkeypatch.setattr(ca, "_online_endpoints", fake)
    assert await ca.filter_unauthorized_page_tools(_PAGE_TOOLS, _USER) == _PAGE_TOOLS


async def test_gate_strips_when_extension_does_not_declare(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """扩展在线但没申报这一族(旧版本扩展)⇒ 摘掉:给了只会换 TARGET_NOT_CONNECTED,
    更糟的是让模型以为自己读得到用户的页面。"""

    async def fake(_user_id: str) -> list[dict[str, Any]]:
        return [_extension_ep(browserPageActions=0), {"endpoint": "web", "uiActions": 7}]

    monkeypatch.setattr(ca, "_online_endpoints", fake)
    out = await ca.filter_unauthorized_page_tools([*(_PAGE_TOOLS[:2]), "web_ui_read"], _USER)
    assert out == ["web_ui_read"]


async def test_gate_strips_when_no_endpoint_online(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake(_user_id: str) -> list[dict[str, Any]]:
        return []

    monkeypatch.setattr(ca, "_online_endpoints", fake)
    assert await ca.filter_unauthorized_page_tools(_PAGE_TOOLS, _USER) is None


async def test_gate_strips_without_identity() -> None:
    """没有身份就没有授权对象 —— 摘,而不是"判不出来就当允许"。"""
    assert await ca.filter_unauthorized_page_tools(_PAGE_TOOLS, None) is None


async def test_gate_is_zero_cost_when_no_page_tools(monkeypatch: pytest.MonkeyPatch) -> None:
    """清单里没有这一族 ⇒ 一次查询都不发(绝大多数请求走这条)。"""
    called: list[str] = []

    async def fake(user_id: str) -> list[dict[str, Any]]:
        called.append(user_id)
        return []

    monkeypatch.setattr(ca, "_online_endpoints", fake)
    tools = ["web_ui_read", "browser_navigate"]
    assert await ca.filter_unauthorized_page_tools(tools, _USER) == tools
    assert called == []


async def test_gate_strips_when_status_query_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    """真·fail-closed:查询抛异常时 _online_endpoints 必须吞成空列表,闸随后摘工具。"""

    async def boom(self: Any, method: str, url: str, **kwargs: Any) -> _Resp:
        raise httpx.ConnectError("api down")

    monkeypatch.setattr(httpx.AsyncClient, "request", boom)
    from app.services import api_tools_bridge as atb

    monkeypatch.setattr(atb, "internal_headers", lambda _u: {"x-internal-service-token": "t"})
    monkeypatch.setattr(atb, "api_base_url", lambda: "http://127.0.0.1:1")
    assert await ca.filter_unauthorized_page_tools(_PAGE_TOOLS, _USER) is None


def test_page_family_is_not_auto_injected() -> None:
    """这一族刻意不进 `_FAMILY_ACTIONS`(词面自动注入):那张表只覆盖应用内 UI。"""
    assert all(
        not prefix.startswith("browser_page") for prefix in ca._FAMILY_ACTIONS
    ), "页面句柄族被接进词面自动注入 —— 任何一句带『点一下』的普通问答都会把用户当前页交给模型"


def test_gate_is_wired_into_llm_entry() -> None:
    """装车证明:闸必须真挂在 llm.py 的工具面入口上,否则判据存在而永不调用=没有。"""
    src = (_REPO_ROOT / "apps/ai-service/app/routers/llm.py").read_text(encoding="utf-8")
    assert "filter_unauthorized_page_tools" in src
    assert (
        "await filter_unauthorized_page_tools(" in src
    ), "只 import 没调用(或调用没接 await / 没传身份)⇒ 这道闸在提交链上不存在"


# ---------------------------------------------------------------------------
# ③ 反向对照:页面正文不进对外通道
# ---------------------------------------------------------------------------


def _read(rel: str) -> str:
    return (_REPO_ROOT / rel).read_text(encoding="utf-8")


def test_v1_gateway_does_not_forward_agent_tools() -> None:
    """/v1 机器凭据构造上游请求体的字段里没有 agent_tools ⇒ 它请求不到这一族。

    这条断言读的是网关源码本体,不是注释:白名单一旦加上 agent_tools,今天所有"够不到"的
    证明同时失效,而页面正文就顺着那条字段流进对外响应 —— 所以宁可把它钉成红。
    """
    for rel in ("apps/api/src/routes/v1-messages.ts", "apps/api/src/routes/v1-responses.ts"):
        src = _read(rel)
        assert "agent_tools" not in src, f"{rel} 出现了 agent_tools:对外通道拿到了指定工具面的把手"
        # agentTools(驼峰形态)同样是把手;ai-chat-stream 那条是用户 JWT 通道,不在此列
        assert "agentTools" not in src, f"{rel} 出现了 agentTools"


def test_agent_control_is_not_machine_reachable() -> None:
    """`/api/agent-control/*` 不在机器凭据开放登记表里 —— 该表是封闭白名单,漏挂即不可达。"""
    registry = _read("apps/api/src/config/open-capability-registry.ts")
    paths = re.findall(r"paths:\s*\[([^\]]*)\]", registry, re.S)
    joined = " ".join(paths)
    assert "agent-control" not in joined, "agent-control 被登记进机器凭据面 ⇒ 页面执行通道对外开敞"


def test_status_surface_returns_counts_only() -> None:
    """授权判定读的 /status 只回动作**计数**,不含任何页面内容 —— 所以这道闸本身不是数据出口。"""
    src = _read("apps/api/src/routes/agent-control.ts")
    block = src[src.index("browserActions: ep.capability") :][:400]
    assert "browserPageActions?.length ?? 0" in src, "句柄族计数没进 /status ⇒ 闸无从判授权"
    assert "capability.browserPageActions," not in block, "/status 不应把申报面原样带出"


def test_page_tools_are_not_registered_as_local_mcp_handlers() -> None:
    """注册面必须落在 external tool 表里(可撤销),而不是混进 _TOOLS 的本地实现。

    混进本地实现会被读成"服务端自己有这个能力",那正是谎报能力的形态。
    """
    pc.register_page_control_tools()
    from app.services.mcp_server import list_external_tools_injected

    injected = [n for n in list_external_tools_injected() if n.startswith("browser_page_")]
    assert len(injected) == 7
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
