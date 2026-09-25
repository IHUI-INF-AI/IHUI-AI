# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ui_action_bridge.py(web 前端 UI 动作桥接)单元测试。

覆盖策略:与 api 侧的契约(agent-control category='ui')靠 httpx 层拦截断言请求
形状与响应归一化,不触达真实 apps/api / 浏览器 / DB / Redis。
注册进全局工具表的用例按 web_ui_ 前缀清理,防污染同进程其他用例。
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import httpx
import pytest

from app.services import ui_action_bridge as ub

_USER = "00000000-0000-4000-8000-00000000000b"
_EXPECTED_TOOLS = {
    "web_ui_describe",
    "web_ui_read",
    "web_ui_navigate",
    "web_ui_click",
    "web_ui_fill",
    "web_ui_submit",
    "web_ui_invoke",
}


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
    # settings.agent_control_internal_secret 有非空默认值,env 覆盖不生效,直替函数
    monkeypatch.setattr(ub, "_get_agent_control_secret", lambda: "ui-test-secret")
    ub._PINNED_INSTANCE.clear()
    yield
    ub._PINNED_INSTANCE.clear()
    for prefix in ("web_ui_", "mobile_ui_", "taro_ui_"):
        ub.unregister_external_tool_by_prefix(prefix)


@pytest.fixture
def captured(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []

    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _Resp:
        calls.append({"method": method, "url": str(url), **kwargs})
        return _Resp(
            payload={
                "code": 0,
                "message": "ok",
                "data": {
                    "success": True,
                    "data": {"registry": {"page": {"path": "/orders"}}},
                    "durationMs": 12,
                },
            }
        )

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    return calls


# ---------------------------------------------------------------------------
# 超时配置
# ---------------------------------------------------------------------------


def test_timeout_default_and_invalid(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("UI_ACTION_TIMEOUT", raising=False)
    assert ub._timeout_seconds() == 20.0
    monkeypatch.setenv("UI_ACTION_TIMEOUT", "45")
    assert ub._timeout_seconds() == 45.0
    monkeypatch.setenv("UI_ACTION_TIMEOUT", "abc")
    assert ub._timeout_seconds() == 20.0
    monkeypatch.setenv("UI_ACTION_TIMEOUT", "0.2")
    assert ub._timeout_seconds() == ub._MIN_TIMEOUT_S


# ---------------------------------------------------------------------------
# 工具定义
# ---------------------------------------------------------------------------


def test_ui_tools_names_and_schemas() -> None:
    tools = {t.name: t for t, _ in ub._ui_tools()}
    assert set(tools) == _EXPECTED_TOOLS
    # describe 全站路由检索(2026-09-21):query/limit 皆可选,不得进 required
    describe_props = set(tools["web_ui_describe"].input_schema["properties"])
    assert describe_props == {"query", "limit"}
    assert "required" not in tools["web_ui_describe"].input_schema
    assert "query" in tools["web_ui_describe"].description  # 描述里必须教会模型怎么用
    assert tools["web_ui_navigate"].input_schema["required"] == ["path"]
    assert tools["web_ui_click"].input_schema["required"] == ["target"]
    assert tools["web_ui_fill"].input_schema["required"] == ["target", "value"]
    assert tools["web_ui_invoke"].input_schema["required"] == ["name"]
    assert "web_ui_execute" not in tools  # 旧一次性 execute 工具已被七动词取代
    for name, tool in tools.items():
        assert tool.description.startswith("[UI桥接]"), name


def test_register_ui_action_tools_idempotent() -> None:
    from app.services.mcp_server import mcp_server

    assert ub.register_ui_action_tools() == 7
    names = {t.name for t in mcp_server.list_tools()}
    assert _EXPECTED_TOOLS.issubset(names)
    # 幂等:同名不覆盖,第二次注册返回 0(stdio bridge 同一约定)
    assert ub.register_ui_action_tools() == 0


def test_register_ui_action_tools_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("UI_ACTION_TOOLS", "false")
    assert ub.register_ui_action_tools() == 0
    assert ub.register_ui_action_tools() == 0


# ---------------------------------------------------------------------------
# 请求形状与身份
# ---------------------------------------------------------------------------


async def test_call_requires_user_id(captured: list[dict[str, Any]]) -> None:
    out = await ub._ui_call("describe", {})
    assert out["ok"] is False
    assert out["errorCode"] == "PERMISSION_DENIED"
    assert captured == []


async def test_call_fail_closed_without_secret(
    captured: list[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ub, "_get_agent_control_secret", lambda: "")
    out = await ub._ui_call("describe", {"__user_id": _USER})
    assert out["errorCode"] == "MISSING_SECRET"
    assert captured == []


async def test_call_request_shape(captured: list[dict[str, Any]]) -> None:
    out = await ub._ui_call(
        "fill",
        {
            "__user_id": _USER,
            "__user_role": 1,
            "__session_id": "s9",
            "target": "金额",
            "value": 100,
        },
    )
    assert out["ok"] is True
    body = captured[0]["json"]
    assert body["category"] == "ui"
    assert body["action"] == "fill"
    assert body["userId"] == _USER
    assert body["sessionId"] == "s9"
    assert body["params"] == {"target": "金额", "value": 100}  # 内部字段不下发到浏览器
    assert body["timeout"] == 20000
    assert body["requestId"].startswith("ui-")
    assert "/api/agent-control/execute" in captured[0]["url"]
    assert captured[0]["headers"]["Authorization"] == "Bearer ui-test-secret"


async def test_call_sends_internal_service_token_for_csrf_exempt(
    captured: list[dict[str, Any]],
) -> None:
    """必须同时带 `x-internal-service-token`,否则 apps/api 的 CSRF 钩子把请求拦成 403。

    `Authorization: Bearer` 只是 /execute 的鉴权凭据;CSRF 豁免判定看的是自定义头是否存在
    (apps/api/src/plugins/csrf.ts)。只发 Bearer 时整条 UI 桥 100% 不可用,而**直打 /execute
    用用户 JWT 会顺带带上 auth_token cookie 从而绕过该钩子** —— 所以这个缺陷只有真实聊天
    round-trip 才暴露(2026-09-21 端到端实证时就是被它挡住的)。
    """
    await ub._ui_call("describe", {"__user_id": _USER})
    headers = captured[0]["headers"]
    assert headers["x-internal-service-token"] == "ui-test-secret"
    assert headers["x-user-id"] == _USER


async def test_call_omits_empty_session(captured: list[dict[str, Any]]) -> None:
    await ub._ui_call("read", {"__user_id": _USER, "__session_id": "  "})
    assert "sessionId" not in captured[0]["json"]


# ---------------------------------------------------------------------------
# 响应归一化
# ---------------------------------------------------------------------------


async def test_success_unwraps_envelope(captured: list[dict[str, Any]]) -> None:
    out = await ub._ui_call("describe", {"__user_id": _USER})
    assert out["ok"] is True
    assert out["tool"] == "web_ui_describe"
    assert out["result"]["registry"]["page"]["path"] == "/orders"
    assert "error" not in out


async def test_failure_passthrough_error_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _Resp:
        return _Resp(
            payload={
                "code": 0,
                "data": {
                    "success": False,
                    "error": "该操作需用户手动执行",
                    "errorCode": "DESTRUCTIVE_BLOCKED",
                    "durationMs": 5,
                },
            }
        )

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    out = await ub._ui_call("click", {"__user_id": _USER, "target": "删除账号"})
    assert out["ok"] is False
    assert out["errorCode"] == "DESTRUCTIVE_BLOCKED"
    assert "手动" in out["error"]


async def test_timeout_maps_to_error_code(monkeypatch: pytest.MonkeyPatch) -> None:
    async def slow(self: Any, method: str, url: str, **kwargs: Any) -> Any:
        raise httpx.TimeoutException("too slow")

    monkeypatch.setattr(httpx.AsyncClient, "request", slow)
    out = await ub._ui_call("read", {"__user_id": _USER})
    assert out["ok"] is False
    assert out["errorCode"] == "TIMEOUT"


async def test_network_error_maps_execution_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom(self: Any, method: str, url: str, **kwargs: Any) -> Any:
        raise httpx.ConnectError("api down")

    monkeypatch.setattr(httpx.AsyncClient, "request", boom)
    out = await ub._ui_call("navigate", {"__user_id": _USER, "path": "/orders"})
    assert out["ok"] is False
    assert out["errorCode"] == "EXECUTION_FAILED"


async def test_non_dict_data_is_tolerated(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _Resp:
        return _Resp(payload={"code": 0, "data": None})

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    out = await ub._ui_call("read", {"__user_id": _USER})
    assert out["ok"] is False


# ---------------------------------------------------------------------------
# 多标签页路由:describe 之后必须钉回同一页
# ---------------------------------------------------------------------------


async def test_instance_pin_threads_target_instance_id(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, Any]] = []

    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _Resp:
        calls.append(dict(kwargs.get("json") or {}))
        return _Resp(
            payload={
                "code": 0,
                "data": {"success": True, "data": {"instanceId": "web-abc", "registry": {}}},
            }
        )

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    await ub._ui_call("describe", {"__user_id": _USER})
    assert ub._PINNED_INSTANCE[(_USER, "ui")] == "web-abc"
    assert "targetInstanceId" not in calls[0]  # 首条无从钉定

    await ub._ui_call("fill", {"__user_id": _USER, "target": "el:input#7", "value": 1})
    assert calls[1]["targetInstanceId"] == "web-abc"  # 后续动作钉回同一标签页


async def test_pin_cleared_when_target_gone(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _Resp:
        return _Resp(
            payload={
                "code": 0,
                "data": {
                    "success": False,
                    "errorCode": "TARGET_NOT_CONNECTED",
                    "error": "Web 前端未连接",
                },
            }
        )

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    ub._PINNED_INSTANCE[(_USER, "ui")] = "web-dead"
    out = await ub._ui_call("read", {"__user_id": _USER})
    assert out["errorCode"] == "TARGET_NOT_CONNECTED"
    assert (_USER, "ui") not in ub._PINNED_INSTANCE  # 掉线的页不再钉,下一条重新探测


async def test_pin_cleared_on_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    """TIMEOUT 也必须清钉。

    页面被重载后,旧 instance 在 api 注册表里还能存活到 5min TTL —— 推过去没人应答,
    表现就是走满超时的 TIMEOUT(2026-09-21 真实聊天 round-trip 复现)。只清
    TARGET_NOT_CONNECTED 的话,后续每条命令都要白等一次超时。
    """

    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _Resp:
        return _Resp(
            payload={
                "code": 0,
                "data": {"success": False, "errorCode": "TIMEOUT", "error": "执行超时(20000 毫秒)"},
            }
        )

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    ub._PINNED_INSTANCE[(_USER, "ui")] = "web-reloaded"
    out = await ub._ui_call("read", {"__user_id": _USER})
    assert out["errorCode"] == "TIMEOUT"
    assert (_USER, "ui") not in ub._PINNED_INSTANCE


async def test_pin_not_cleared_for_ordinary_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """普通执行失败(选择器没找到等)不该清钉 —— 页面还活着,下一条仍要落回同一页。"""

    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _Resp:
        return _Resp(
            payload={
                "code": 0,
                "data": {
                    "success": False,
                    "errorCode": "SELECTOR_NOT_FOUND",
                    "error": "元素已不在页面上",
                },
            }
        )

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    ub._PINNED_INSTANCE[(_USER, "ui")] = "web-live"
    out = await ub._ui_call("fill", {"__user_id": _USER, "target": "el:input#7", "value": 1})
    assert out["errorCode"] == "SELECTOR_NOT_FOUND"
    assert ub._PINNED_INSTANCE[(_USER, "ui")] == "web-live"


# ---------------------------------------------------------------------------
# handler 装配
# ---------------------------------------------------------------------------


async def test_handler_binds_action(captured: list[dict[str, Any]]) -> None:
    handler = ub._make_ui_handler("submit")
    out = await handler({"__user_id": _USER})
    assert captured[0]["json"]["action"] == "submit"
    assert out["tool"] == "web_ui_submit"


async def test_registered_handlers_reachable_via_call_tool(captured: list[dict[str, Any]]) -> None:
    """注册后必须能走既有 call_tool 链(权限矩阵/超时/截断全复用)。"""
    from app.services.mcp_server import mcp_server

    ub.register_ui_action_tools()
    out = await mcp_server.call_tool("web_ui_read", {}, user_id=_USER)
    assert out["ok"] is True
    assert out["tool"] == "web_ui_read"


_APP_ACTIONS = {"describe", "navigate", "read", "invoke", "click", "fill", "submit"}


def test_app_tool_families_shapes() -> None:
    """RN / 小程序 / 扩展三族各七工具:无 DOM 端靠控件注册表承接 click/fill/submit,不是砍掉能力。"""
    for family, prefix in (
        ("mobile", "mobile_ui_"),
        ("taro", "taro_ui_"),
        ("extension", "ext_ui_"),
    ):
        tools = {t.name: t for t, _ in ub._app_tools(family)}
        assert set(tools) == {prefix + a for a in _APP_ACTIONS}, family
        for name, tool in tools.items():
            assert "[UI桥接|" in tool.description, name
            assert "TARGET_NOT_CONNECTED" in tool.description, name  # 后台挂起是常态,须告知模型
        assert tools[prefix + "navigate"].input_schema["required"] == ["name"]
        assert tools[prefix + "invoke"].input_schema["required"] == ["name"]
        assert tools[prefix + "fill"].input_schema["required"] == ["target", "value"]
        # 定位来源必须在描述里讲清楚,否则模型只能猜 id
        for verb in ("click", "fill", "submit"):
            assert "registry.elements" in tools[prefix + verb].description, verb
        # 不承诺成功:如实失败是这些工具的存在前提
        assert "UNSUPPORTED_ACTION" in tools[prefix + "fill"].description


def test_app_family_action_set_matches_autonomy_gate() -> None:
    """工具族注册的动作集必须与控制闸 _FAMILY_ACTIONS 双向一致。

    单向校验会漏掉"注册了但闸不放行"这一侧 —— 那正是 2026-09-21 端侧注册表接好却
    到不了模型手上的成因。
    """
    from app.services.control_autonomy import _FAMILY_ACTIONS

    for family, prefix in (
        ("mobile", "mobile_ui_"),
        ("taro", "taro_ui_"),
        ("extension", "ext_ui_"),
    ):
        registered = {t.name.replace(prefix, "") for t, _ in ub._app_tools(family)}
        assert registered == set(_FAMILY_ACTIONS[prefix]), family


def test_register_app_ui_tools_counts_and_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.mcp_server import mcp_server

    assert ub.register_app_ui_tools() == 21
    assert ub.register_app_ui_tools() == 0  # 幂等:同名不覆盖
    monkeypatch.setenv("APP_UI_TOOLS", "false")
    # 关闭时既不再注册,也要把已注册的两族撤掉(与 web 族同一语义)
    assert ub.register_app_ui_tools() == 0
    names = {t.name for t in mcp_server.list_tools()}
    assert not {n for n in names if n.startswith(("mobile_ui_", "taro_ui_", "ext_ui_"))}


async def test_pin_is_per_category_so_ends_do_not_cross_steal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """同一用户 web + RN 同时在线:钉定必须按 category 分键,不能串页。"""
    calls: list[dict[str, Any]] = []

    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _Resp:
        req = dict(kwargs.get("json") or {})
        calls.append(req)
        inst = "web-1" if req["category"] == "ui" else "rn-1"
        return _Resp(payload={"code": 0, "data": {"success": True, "data": {"instanceId": inst}}})

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    await ub._ui_call("describe", {"__user_id": _USER})  # web 钉 web-1
    await ub._ui_call("describe", {"__user_id": _USER}, "app_ui", "mobile_ui_")  # RN 钉 rn-1
    assert ub._PINNED_INSTANCE[(_USER, "ui")] == "web-1"
    assert ub._PINNED_INSTANCE[(_USER, "app_ui")] == "rn-1"
    await ub._ui_call("navigate", {"__user_id": _USER, "name": "Chat"}, "app_ui", "mobile_ui_")
    assert calls[-1]["category"] == "app_ui"
    assert calls[-1]["targetInstanceId"] == "rn-1"  # 不会带 web 的 instanceId 去投 RN
    await ub._ui_call("read", {"__user_id": _USER})
    assert calls[-1]["category"] == "ui"
    assert calls[-1]["targetInstanceId"] == "web-1"


def test_app_families_are_registered_in_tool_table() -> None:
    from app.services.mcp_server import mcp_server

    ub.register_app_ui_tools()
    names = {t.name for t in mcp_server.list_tools()}
    assert {"mobile_ui_describe", "taro_ui_navigate"} <= names


def test_unregister_prefix_removes_tools() -> None:
    from app.services.mcp_server import mcp_server

    ub.register_ui_action_tools()
    removed = ub.unregister_external_tool_by_prefix("web_ui_")
    assert len(removed) == 7
    names = {t.name for t in mcp_server.list_tools()}
    assert not (_EXPECTED_TOOLS & names)


# 服务端把共享契约里的动作集合**复制**成一份 Python 字面量(`_APP_ACTIONS`,其上方注释写着
# "与 packages/types 的 AppUiActionType 一一对应")。page 族的同型复制早就被
# `test_page_control_bridge.py::test_verb_list_matches_shared_contract` 机器看守,
# 而这一族的"一一对应"至今**只有散文** —— 散文约束在本仓已被反复实测会腐烂,故补同一条对账。
def _spec_names(tools: list[Any]) -> tuple[str, ...]:
    """把服务端注册面的工具名削掉 `web_ui_` 前缀,还原成动作名。

    前缀只从 `ub._TOOL_PREFIX` 取,不在测试里再抄一遍字符串 —— 两处算同一个 key
    必须共用一份实现,否则改了生产侧前缀而测试仍按旧字面量通过。
    """
    return tuple(t.name.removeprefix(ub._TOOL_PREFIX) for t, _ in tools)


_ACTION_CONTRACTS: tuple[tuple[str, str, tuple[str, ...], str], ...] = (
    ("packages/types/src/agent-control.ts", "AppUiActionType", ub._APP_ACTIONS, "服务端 _APP_ACTIONS"),
    (
        "packages/types/src/agent-control.ts",
        "UiControlActionType",
        _spec_names(ub._ui_tools()),
        "服务端 _ui_tools() 注册面(去 web_ui_ 前缀)",
    ),
)


def _contract_actions(repo_root: Path, rel: str, type_name: str) -> set[str]:
    """逐行解析 TS 联合类型的成员集合。

    为什么不用一条正则扫到底(第一版就是这样的):同一个文件里 `AppUiActionType` 写成
    `= 'a' | 'b'` 单行,而 `UiControlActionType` 写成"等号后换行 + 每个成员前带一行 JSDoc +
    成员行以 `|` 开头"。单条正则**只认得前一种形态**,于是它对后一种直接判"断链"——
    一门只守得住自己顺手写的那种形态,等于其余形态没人守。

    逐行法同时解决另一个更危险的坑:成员的 JSDoc 里合法地写着 `'wallet'`、`'agent 规则'`
    这类带引号的东西。只从**以 `|` 开头的行**取值,注释行(以 `*` 或 `/` 开头)天然进不来,
    尺子就不会量到自己的解释注释。
    """
    lines = (repo_root / rel).read_text(encoding="utf-8").splitlines()
    try:
        start = next(i for i, ln in enumerate(lines) if re.match(rf"^export type {type_name}\b", ln))
    except StopIteration:
        raise AssertionError(f"{rel} 里找不到 `export type {type_name}`(改名即断链,视为失败)") from None

    out: set[str] = set()
    for ln in lines[start : start + 60]:
        head = ln.strip()
        if head.startswith("export type") and not head.startswith(f"export type {type_name}"):
            break  # 撞上下一个类型定义,本族的字面量到此为止
        if head.startswith(("/**", "*", "*/")) or not head:
            continue  # 注释与空行:里面的引号串一律不算成员
        if head == f"export type {type_name} =":
            continue
        tail = head[len(f"export type {type_name} =") :] if head.startswith(f"export type {type_name} =") else head
        if not tail.startswith(("|", "'")):
            break  # 既非成员也非注释 → 这一族已经结束(纯别名 `= OtherType` 走这条路)
        out.update(re.findall(r"'([a-z_]+)'", tail))
    assert out, (
        f"{rel} 里 `export type {type_name}` 解析出空成员集 —— 改成纯别名、换成非字符串成员或整体挪走"
        "都算断链,须同步更新本对账(不允许靠放宽判据蒙过去)"
    )
    return out


@pytest.mark.parametrize(("rel", "type_name", "py_side", "label"), _ACTION_CONTRACTS)
def test_python_action_copies_match_ts_contract(
    rel: str, type_name: str, py_side: tuple[str, ...], label: str
) -> None:
    """服务端每一份动作字面量必须与 TS 契约**双向**逐字同集合。

    两个漂移方向都红,因为两种都是静默失效:契约加一条而 Python 没跟上 ⇒ 新动词永远进不了
    模型工具面(能力缺失而不报错);Python 多一条而契约不认 ⇒ 端上回 `UNSUPPORTED_ACTION`(谎报能力)。
    """
    repo_root = Path(__file__).resolve().parents[3]
    contract = _contract_actions(repo_root, rel, type_name)
    assert contract, f"{type_name} 解析出空清单(联合类型形态变了,不是没有动作)"
    assert set(py_side) == contract, (
        f"{label} 与 {type_name} 漂移:"
        f"服务端缺 {sorted(contract - set(py_side))} / "
        f"服务端多 {sorted(set(py_side) - contract)}"
    )


# 端内"本次请求要带哪些工具"的清单(客户端正门)。三端各写一份 TS 常量,
# 服务端注册面写在 Python 里 —— 两边只有这一条机械路径能对上。
_CLIENT_TOOL_LISTS: tuple[tuple[str, str, str], ...] = (
    ("apps/web/src/hooks/use-chat/tool-config.ts", "WEB_UI_CONTROL_TOOLS", "web_ui_"),
    ("apps/mobile-rn/src/lib/ui-control-tools.ts", "MOBILE_UI_CONTROL_TOOLS", "mobile_ui_"),
    ("apps/miniapp-taro/src/lib/ui-control-tools.ts", "TARO_UI_CONTROL_TOOLS", "taro_ui_"),
    ("apps/extension/lib/ui-control-tools.ts", "EXT_UI_CONTROL_TOOLS", "ext_ui_"),
)


def _client_tools(repo_root: Path, rel: str, const: str) -> set[str]:
    """按 const 名抓出数组字面量里的工具名(不做 AST:这三处形态稳定且被本用例锁死)。"""
    text = (repo_root / rel).read_text(encoding="utf-8")
    block = re.search(rf"export const {const}\s*=\s*\[(.*?)\]", text, re.S)
    assert block, f"{rel} 里找不到 export const {const} = [...](改名即等于断链,故视为失败)"
    return set(re.findall(r"'([A-Za-z0-9_]+)'", block.group(1)))


def test_client_tool_lists_match_registered_surface() -> None:
    """四端客户端清单必须与服务端真实注册面**双向**相等。

    为什么常驻而不是"临时审计脚本":2026-09-21 一批把移动两族从 4 动词扩到 7 的改动被并行
    会话清空,一次性脚本当场过期无人察觉 —— 端清单落后于注册面时,AI 只会看见 describe/read/
    navigate/invoke 四个工具,移动端填输入框的能力**静默消失**,不报错也不掉线。
    """
    repo_root = Path(__file__).resolve().parents[3]
    registered_by_prefix = {
        "web_ui_": {t.name for t, _ in ub._ui_tools()},
        "mobile_ui_": {t.name for t, _ in ub._app_tools("mobile")},
        "taro_ui_": {t.name for t, _ in ub._app_tools("taro")},
        "ext_ui_": {t.name for t, _ in ub._app_tools("extension")},
    }
    for rel, const, prefix in _CLIENT_TOOL_LISTS:
        client = _client_tools(repo_root, rel, const)
        registered = registered_by_prefix[prefix]
        assert client, f"{const} 解析出空清单(解析式或数组形态变了)"
        assert client == registered, (
            f"{rel}::{const} 与 {prefix} 注册面漂移:"
            f"端缺 {sorted(registered - client)} / 端多 {sorted(client - registered)}"
        )


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
