# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 全量操控桥接(2026-09-20 立):端侧 UI 动作桥接,三族工具共用一条链路。

复用既有 agent-control 跨端控制协议(与 browser_*/computer_* 同一通道,不另造通道):
ai-service → POST /api/agent-control/execute(category=…)→ api 按 category 择端并经 WebSocket
推给该用户已上线的端 → 端执行后 POST /api/agent-control/result →
api 用 pending Map 把结果同步回给本工具。

三族(web 有 DOM 故七动作;RN / 小程序无 DOM,不含 click/fill/submit):
- web_ui_*     category='ui'         endpoint='web'      开关 UI_ACTION_TOOLS
- mobile_ui_*  category='app_ui'     endpoint='rn'       开关 APP_UI_TOOLS
- taro_ui_*    category='miniapp_ui' endpoint='miniapp'  开关 APP_UI_TOOLS

web 七个动作:describe(可操控清单) / read(页面状态) / navigate(站内跳转) /
click(点击) / fill(填写) / submit(提交) / invoke(命令,含 ChatMode、面板开关)。
RN 与小程序各四个:describe / read / navigate / invoke。

安全:
- 必带 __user_id 代调身份,api 侧按 userId 过滤端点(多用户隔离),缺失即拒
- 破坏性动作(删除/注销/提现/支付…)与密码字段由**前端**黑名单硬拦截,返回
  DESTRUCTIVE_BLOCKED / PERMISSION_DENIED,本侧原样回传
- 内部密钥未配置时 fail-closed(与 _tool_agent_control 同语义)

env:
- UI_ACTION_TOOLS:   是否注册本桥接(默认 true,'false'/'0'/'no'/'off' 关闭)
- UI_ACTION_TIMEOUT: 等待前端回传结果的超时秒数(默认 20)
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from .mcp_server import (
    MCPTool,
    _get_agent_control_secret,
    register_external_tool,
    unregister_external_tool_by_prefix,
)

logger = logging.getLogger(__name__)

_CATEGORY = "ui"
_TOOL_PREFIX = "web_ui_"
_DEFAULT_TIMEOUT_S = 20.0
_MIN_TIMEOUT_S = 1.0

# (userId, category) → 应答过的端实例 ID(2026-09-20 多标签页路由)。
# describe 返回的元素 id 只在**那一页**的映射里有意义;不钉回同一页,紧随其后的
# fill/click 会被 api 投给"最后心跳"的另一个标签页 → SELECTOR_NOT_FOUND。
# 键必须带 category:同一用户可能 web/RN/小程序同时在线,三端各自钉各自的页,
# 否则会拿 web 的 instanceId 去投 app_ui 指令,api 侧钉定失败静默回落 → 又串端。
_PINNED_INSTANCE: dict[tuple[str, str], str] = {}


def _timeout_seconds() -> float:
    """等待前端回传结果的超时秒数(env UI_ACTION_TIMEOUT,默认 20,下限 1s)。"""
    raw = os.environ.get("UI_ACTION_TIMEOUT", "")
    if not raw.strip():
        return _DEFAULT_TIMEOUT_S
    try:
        return max(_MIN_TIMEOUT_S, float(raw))
    except ValueError:
        logger.warning(
            "[ui_bridge] UI_ACTION_TIMEOUT 非数值(%s),回退默认 %.0fs", raw, _DEFAULT_TIMEOUT_S
        )
        return _DEFAULT_TIMEOUT_S


def _execute_url() -> str:
    """agent-control 执行端点(base 随 API_SERVICE_URL 配置,与 browser/computer 同源)。"""
    from ..core.config import settings

    return f"{settings.api_service_url}/api/agent-control/execute"


async def _ui_call(
    action: str,
    args: dict[str, Any],
    category: str = _CATEGORY,
    prefix: str = _TOOL_PREFIX,
) -> dict[str, Any]:
    """把一个 UI 动作转发到 api 层 agent-control 并归一化回执。

    category/prefix 参数化是因为 web('ui'/web_ui_)、RN('app_ui'/mobile_ui_)、
    小程序('miniapp_ui'/taro_ui_)三族走的是同一条 agent-control 链路,只有
    投递类别与工具名前缀不同 —— 共用一份身份剥离、fail-closed、超时与回执归一化逻辑。

    params 只带模型给的可见参数:内部注入字段(__user_id/__user_role/__session_id)
    一律剥离,不下发到端上(与 mcp_stdio_bridge 的前缀剥离约定一致)。
    """
    user_id = str(args.get("__user_id") or "").strip()
    if not user_id:
        return {
            "ok": False,
            "errorCode": "PERMISSION_DENIED",
            "error": "缺少用户身份(__user_id),无法定位待操控的前端",
        }
    secret = _get_agent_control_secret()
    if not secret:
        return {
            "ok": False,
            "errorCode": "MISSING_SECRET",
            "error": "AGENT_CONTROL_INTERNAL_SECRET 未配置,拒绝 UI 控制调用(fail-closed)",
        }
    params = {k: v for k, v in args.items() if not k.startswith("__")}
    timeout_s = _timeout_seconds()
    request: dict[str, Any] = {
        "requestId": f"ui-{uuid.uuid4().hex[:12]}",
        "category": category,
        "action": action,
        "params": params,
        "userId": user_id,
        "timeout": int(timeout_s * 1000),
    }
    session_id = str(args.get("__session_id") or "").strip()
    if session_id:
        request["sessionId"] = session_id
    pinned = _PINNED_INSTANCE.get((user_id, category))
    if pinned:
        request["targetInstanceId"] = pinned
    started = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=timeout_s + 10.0) as client:
            response = await client.post(
                _execute_url(),
                json=request,
                # Bearer = /execute 的鉴权凭据;x-internal-service-token 是**必须**的第二个头 ——
                # apps/api 的 CSRF 钩子只对"带自定义头/非浏览器表单"的请求放行(见
                # apps/api/src/plugins/csrf.ts:`x-internal-service-token` 存在即豁免),
                # 只发 Bearer 会被拦成 403「CSRF 令牌缺失或无效」。这条**只有真实聊天
                # round-trip 才能暴露**(直打 /execute 用用户 JWT 会顺带带 auth_token cookie 而绕过),
                # 2026-09-21 端到端实证时就是被它挡住的。x-user-id 与 api_tools_bridge 口径一致。
                headers={
                    "Authorization": f"Bearer {secret}",
                    "x-internal-service-token": secret,
                    "x-user-id": user_id,
                },
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.TimeoutException:
        return {
            "ok": False,
            "errorCode": "TIMEOUT",
            "error": f"前端未在 {timeout_s:g}s 内回传执行结果",
        }
    except Exception as e:  # noqa: BLE001 网络/解析层统一兜底,错误回传 LLM 而非抛出
        return {"ok": False, "errorCode": "EXECUTION_FAILED", "error": str(e)[:200]}

    # api 层返回 ApiResponse<AgentActionResponse> = { code, message, data }
    data = payload.get("data", payload) if isinstance(payload, dict) else {}
    if not isinstance(data, dict):
        data = {}
    out: dict[str, Any] = {
        "ok": bool(data.get("success", False)),
        "tool": f"{prefix}{action}",
        "action": action,
        "durationMs": int((time.monotonic() - started) * 1000),
    }
    result = data.get("data")
    if isinstance(result, dict):
        out["result"] = result
        answered = str(result.get("instanceId") or "").strip()
        if answered:
            _PINNED_INSTANCE[(user_id, category)] = answered
    if not out["ok"]:
        out["error"] = str(data.get("error") or "前端执行失败")
        out["errorCode"] = data.get("errorCode") or "EXECUTION_FAILED"
        # 钉定的页面已关掉/掉线:清掉,下一条命令回落"最近活跃端"重新探测。
        # TIMEOUT 也要清 —— 页面重载后旧 instance 在 api 注册表里还能存活到 5min TTL,
        # 推过去没人应答就是走满超时的这一形态(api 侧已加活性判据,但清掉钉定能立刻自愈,
        # 不必等那个周期越过保活容差)。
        if out["errorCode"] in ("TARGET_NOT_CONNECTED", "TIMEOUT"):
            _PINNED_INSTANCE.pop((user_id, category), None)
    return out


def _make_ui_handler(
    action: str, category: str = _CATEGORY, prefix: str = _TOOL_PREFIX
) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]:
    """生成绑定 (action, category, prefix) 的 handler(闭包,供 register_external_tool 注入)。"""

    async def handler(args: dict[str, Any]) -> dict[str, Any]:
        return await _ui_call(action, args, category, prefix)

    return handler


_TARGET_DESC = (
    "动作定位符:优先用 web_ui_describe 返回的 id(如 'el:btn#7'),"
    "也可用元素可见文本(如 '保存')或 CSS 选择器。"
)


def _ui_tools() -> list[tuple[MCPTool, Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]]]:
    """七个 UI 工具定义 + handler(定义与 UiControlActionType 一一对应)。"""
    str_prop = {"type": "string"}
    specs: list[tuple[str, str, dict[str, Any]]] = [
        (
            "describe",
            "[UI桥接] 列出用户当前浏览器页面可操控的内容:站内导航、命令面板命令、"
            "表单字段、可点击元素(含上传位 kind=file、富文本 kind=richtext、"
            "代码编辑器 kind=code)。返回 {result:{registry:{page,commands,forms,elements,routes}}}。"
            "registry.elements[].id 即 click/fill 的 target。"
            "registry.routes 是全站路由摘要 {total,navigable,groups:[{prefix,count}]}——"
            "**不含完整路径**。要跳到摘要之外的页面时严禁猜路径:传 query=关键词"
            "(如 'wallet'、'agent 规则') 再调一次本工具,matches[].path 即合法目标,"
            "随后用 web_ui_navigate 跳转。执行 UI 动作前先调用本工具。",
            {
                "type": "object",
                "properties": {
                    "query": {
                        **str_prop,
                        "description": "可选:全站路由检索词(关键词/路径片段),命中 top≤40 条于 routes.matches",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "可选:检索命中上限,默认且封顶 40",
                    },
                },
            },
        ),
        (
            "read",
            "[UI桥接] 读取用户当前页面的可读状态:标题、URL、正文文本(截断)、"
            "表单当前值。用于确认页面处于预期状态,或提取页面信息给对话。",
            {"type": "object", "properties": {}},
        ),
        (
            "navigate",
            "[UI桥接] 让用户浏览器跳转到指定站内路由(如 /settings/preferences、/orders)。"
            "目标必须命中站点路由白名单,否则返回 ROUTE_NOT_ALLOWED。"
            "可用路由见 web_ui_describe 返回的 commands(group='navigate')。",
            {
                "type": "object",
                "properties": {"path": {**str_prop, "description": "站内路由路径,以 / 开头"}},
                "required": ["path"],
            },
        ),
        (
            "click",
            "[UI桥接] 点击用户页面上的元素(按钮/链接/开关/标签页)。"
            "破坏性目标(删除/注销/提现/支付等)会被前端拦截为 DESTRUCTIVE_BLOCKED,"
            "此时应把操作交回用户手动完成,不要重试。",
            {
                "type": "object",
                "properties": {"target": {**str_prop, "description": _TARGET_DESC}},
                "required": ["target"],
            },
        ),
        (
            "fill",
            "[UI桥接] 填写用户页面上的输入框/文本域/下拉框(含 react-hook-form 受控组件)、"
            "contenteditable 富文本(kind=richtext)与 Monaco 代码编辑器(kind=code,仅当能取到"
            "editor 实例)。密码与验证码字段会被拦截(PERMISSION_DENIED);文件上传位"
            "(kind=file)因浏览器安全策略无法代填,同样返回 PERMISSION_DENIED,请引导用户手动选择。"
            "填写后通常需配合 web_ui_click(提交按钮)或 web_ui_submit 才会真正提交。",
            {
                "type": "object",
                "properties": {
                    "target": {**str_prop, "description": _TARGET_DESC},
                    "value": {
                        "type": ["string", "number", "boolean"],
                        "description": "要填入的值(下拉框传选项文本或值)",
                    },
                    "clear": {
                        "type": "boolean",
                        "description": "填写前是否清空原值,默认 true",
                    },
                },
                "required": ["target", "value"],
            },
        ),
        (
            "submit",
            "[UI桥接] 提交页面上的表单。form 传 web_ui_describe 返回的表单 id;"
            "省略时提交当前页面主表单。破坏性表单同样会被前端拦截。",
            {
                "type": "object",
                "properties": {
                    "form": {**str_prop, "description": "表单 id(可选)"},
                },
            },
        ),
        (
            "invoke",
            "[UI桥接] 调用站点命令注册表里的命令(新建会话、打开/关闭 AI 面板、"
            "切换工作区、切换对话模式 ask/build/plan/review/spec 等)。"
            "name 取 web_ui_describe 返回的 commands[].id。",
            {
                "type": "object",
                "properties": {
                    "name": {**str_prop, "description": "命令 ID(来自 web_ui_describe)"},
                    "args": {"type": "object", "description": "命令参数(可选)"},
                },
                "required": ["name"],
            },
        ),
    ]
    tools: list[tuple[MCPTool, Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]]] = []
    for action, description, input_schema in specs:
        tools.append(
            (
                MCPTool(
                    name=f"{_TOOL_PREFIX}{action}",
                    description=description,
                    input_schema=input_schema,
                ),
                _make_ui_handler(action),
            )
        )
    return tools


def register_ui_action_tools() -> int:
    """注册 web 前端 UI 桥接工具,返回注册数量(UI_ACTION_TOOLS 关闭时返 0)。"""
    if os.environ.get("UI_ACTION_TOOLS", "true").strip().lower() in {"false", "0", "no", "off"}:
        logger.info("[ui_bridge] UI_ACTION_TOOLS 关闭,跳过 UI 桥接工具注册")
        unregister_external_tool_by_prefix(_TOOL_PREFIX)
        return 0
    count = 0
    for tool, handler in _ui_tools():
        if register_external_tool(tool, handler):
            count += 1
    if count:
        logger.info("[ui_bridge] 前端 UI 动作桥接注册完成: %d 个工具", count)
    return count


# ---------------------------------------------------------------------------
# RN / 微信小程序 工具族(2026-09-21 立,AGENTS.md §9 多端同步)
# ---------------------------------------------------------------------------
# 与 web 族共用 _ui_call(身份剥离 / fail-closed / 超时 / 钉定),只有 category、工具前缀与
# 动作集合不同。动作集与 web 同为七个 —— 但定位机理不同:web 靠 DOM 查询,无 DOM 端只能由
# 业务组件在挂载时把 onPress / 写入通道交给端内控件注册表(mobile-rn 的 ui-field-registry、
# miniapp-taro 的 ui-field-registry)。注册表里没有对应控件、或组件没交出通道,端上就如实回
# UNSUPPORTED_ACTION。宁可失败,也不能"回了 ok 而界面没动"。

_FAMILY_RN = "mobile"
_FAMILY_TARO = "taro"
_FAMILY_EXT = "extension"

# 与 packages/types 的 AppUiActionType 一一对应
_APP_ACTIONS = ("describe", "navigate", "read", "invoke", "click", "fill", "submit")

# family → (category, 工具前缀, 端说明, 动作集合)
_FAMILIES: dict[str, tuple[str, str, str, tuple[str, ...]]] = {
    _FAMILY_RN: ("app_ui", "mobile_ui_", "React Native App", _APP_ACTIONS),
    _FAMILY_TARO: ("miniapp_ui", "taro_ui_", "微信小程序", _APP_ACTIONS),
    # 第五族:浏览器扩展自有界面(sidepanel/popup 有真实同源 DOM,七动词与 web 同形)。
    # endpoint 与 browser 同为 extension,但 category 分开 —— 否则同一端点上"操控外部网页"与
    # "操控扩展面板"会互相抢指令(api 侧 category→endpoint 是 1:1 择端)。
_FAMILY_EXT: ("ext_ui", "ext_ui_", "浏览器扩展面板", _APP_ACTIONS),
}


def _app_tools(
    family: str,
) -> list[tuple[MCPTool, Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]]]:
    """一个 app 端的工具定义 + handler(动作集取自 _FAMILIES[family],与端内白名单一致)。"""
    category, prefix, label, actions = _FAMILIES[family]
    offline_hint = (
        "该端切到后台会挂起导致 TARGET_NOT_CONNECTED,这属常态:"
        "遇到时提示用户把" + label + "切到前台并保持打开,再重试,不要谎称已完成。"
    )
    _field_desc = (
        f"目标取自 {prefix}describe 返回的 registry.elements[].id(也可用可见标签文本精确匹配)。"
    )
    specs: list[tuple[str, str, dict[str, Any]]] = [
        (
            "describe",
            f"[UI桥接|{label}] 列举{label}可导航到的页面清单(含是否需要参数、是否 tab 页)、"
            f"可调用命令、当前屏上可操控的控件与当前所在页。"
            "返回 {result:{registry:{screen,routes,commands,elements,suppressed,authed}}};"
            "elements[] 是 fill/click/submit 的定位来源(writable=false 的填不了,"
            "pressable=false 的点不了,别硬试);authed=false 表示未登录,此时绝大多数页面未挂载,"
            "跳转会静默失败。" + offline_hint,
            {"type": "object", "properties": {}},
        ),
        (
            "read",
            f"[UI桥接|{label}] 读取当前所在页面(路由名/key/参数键),用于确认导航是否真的到了目标页。"
            + offline_hint,
            {"type": "object", "properties": {}},
        ),
        (
            "navigate",
            f"[UI桥接|{label}] 导航到 {prefix}describe 返回的某个页面。name 必须在白名单内"
            "否则 ROUTE_NOT_ALLOWED;需要参数的页面必须同时给 args。导航后务必用 "
            f"{prefix}read 核对。" + offline_hint,
            {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": f"页面名(来自 {prefix}describe 的 routes)",
                    },
                    "args": {
                        "type": "object",
                        "description": "路由参数(按页面 requiresParams 提供)",
                    },
                },
                "required": ["name"],
            },
        ),
        (
            "invoke",
            f"[UI桥接|{label}] 调用一个已注册命令(如主题切换)。name 来自 {prefix}describe 的 "
            "commands;不在白名单返回 UNSUPPORTED_ACTION。破坏性动作(如退出登录)刻意不暴露。"
            + offline_hint,
            {
                "type": "object",
                "properties": {"name": {"type": "string", "description": "命令 ID"}},
                "required": ["name"],
            },
        ),
        (
            "click",
            f"[UI桥接|{label}] 触发当前屏上的一个按钮/可点控件。"
            + _field_desc
            + "组件没交出 onPress 的控件不入表,会返回 UNSUPPORTED_ACTION;"
            "删除/支付/提现/注销类控件被刻意屏蔽(误触即不可逆),不要重试,交回用户手动完成。"
            + offline_hint,
            {
                "type": "object",
                "properties": {"target": {"type": "string", "description": _field_desc}},
                "required": ["target"],
            },
        ),
        (
            "fill",
            f"[UI桥接|{label}] 填写当前屏上的输入框。"
            + _field_desc
            + "只有 writable=true 的控件可填:受控输入必须由父组件交出 onChangeText,"
            "否则如实 UNSUPPORTED_ACTION(不会假装成功)。密码/验证码框连 describe 都不出现。"
            "填写生效与否以返回的 valueAfter 为准(受控控件的值要等父组件回流才变)。" + offline_hint,
            {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": _field_desc},
                    "value": {"type": "string", "description": "要写入的文本"},
                },
                "required": ["target", "value"],
            },
        ),
        (
            "submit",
            f"[UI桥接|{label}] 提交当前屏上注册过的表单。"
            + _field_desc
            + "没有表单注册过会如实返回 UNSUPPORTED_ACTION,不会退化成「随便点一个按钮」。"
            + offline_hint,
            {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "表单 id 或标签,可省略"}
                },
            },
        ),
    ]
    out: list[tuple[MCPTool, Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]]] = []
    for action, description, input_schema in specs:
        if action not in actions:
            continue
        out.append(
            (
                MCPTool(
                    name=f"{prefix}{action}", description=description, input_schema=input_schema
                ),
                _make_ui_handler(action, category, prefix),
            )
        )
    return out


def register_app_ui_tools() -> int:
    """注册 RN / 小程序 UI 桥接工具(APP_UI_TOOLS=false 时全关并清旧)。"""
    if os.environ.get("APP_UI_TOOLS", "true").strip().lower() in {"false", "0", "no", "off"}:
        logger.info("[ui_bridge] APP_UI_TOOLS 关闭,跳过 RN/小程序 UI 桥接注册")
        for _category, prefix, _label, _actions in _FAMILIES.values():
            unregister_external_tool_by_prefix(prefix)
        return 0
    count = 0
    for family in _FAMILIES:
        for tool, handler in _app_tools(family):
            if register_external_tool(tool, handler):
                count += 1
    if count:
        logger.info("[ui_bridge] RN/小程序 UI 动作桥接注册完成: %d 个工具", count)
    return count


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
