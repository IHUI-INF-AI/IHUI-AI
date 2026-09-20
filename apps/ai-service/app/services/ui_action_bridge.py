# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 全量操控桥接(2026-09-20 立):web 前端 UI 动作桥接(web_ui_* 七工具)。

复用既有 agent-control 跨端控制协议(与 browser_*/computer_* 同一通道,不另造通道):
ai-service → POST /api/agent-control/execute(category='ui')→ api 经 WebSocket 推给
已上报 endpoint='web' 的前端实例 → 前端执行后 POST /api/agent-control/result →
api 用 pending Map 把结果同步回给本工具。

七个工具对应 UiControlActionType 七个动作:
- web_ui_describe  拉取当前页面可操控清单(导航/命令/表单/交互元素)
- web_ui_read      读取当前页面可读状态(标题/URL/可见文本/表单当前值)
- web_ui_navigate  站内路由跳转(前端按 ui-routes 白名单校验)
- web_ui_click     点击注册表内的按钮/链接/开关
- web_ui_fill      填写输入框/下拉框
- web_ui_submit    提交表单
- web_ui_invoke    调用命令注册表里的命令(含 ChatMode 切换、面板开关)

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
from typing import Any, Awaitable, Callable

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


def _timeout_seconds() -> float:
    """等待前端回传结果的超时秒数(env UI_ACTION_TIMEOUT,默认 20,下限 1s)。"""
    raw = os.environ.get("UI_ACTION_TIMEOUT", "")
    if not raw.strip():
        return _DEFAULT_TIMEOUT_S
    try:
        return max(_MIN_TIMEOUT_S, float(raw))
    except ValueError:
        logger.warning("[ui_bridge] UI_ACTION_TIMEOUT 非数值(%s),回退默认 %.0fs", raw, _DEFAULT_TIMEOUT_S)
        return _DEFAULT_TIMEOUT_S


def _execute_url() -> str:
    """agent-control 执行端点(base 随 API_SERVICE_URL 配置,与 browser/computer 同源)。"""
    from ..core.config import settings

    return f"{settings.api_service_url}/api/agent-control/execute"


async def _ui_call(action: str, args: dict[str, Any]) -> dict[str, Any]:
    """把一个 ui 动作转发到 api 层 agent-control 并归一化回执。

    params 只带模型给的可见参数:内部注入字段(__user_id/__user_role/__session_id)
    一律剥离,不下发到浏览器(与 mcp_stdio_bridge 的前缀剥离约定一致)。
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
        "category": _CATEGORY,
        "action": action,
        "params": params,
        "userId": user_id,
        "timeout": int(timeout_s * 1000),
    }
    session_id = str(args.get("__session_id") or "").strip()
    if session_id:
        request["sessionId"] = session_id
    started = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=timeout_s + 10.0) as client:
            response = await client.post(
                _execute_url(),
                json=request,
                headers={"Authorization": f"Bearer {secret}"},
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
        "tool": f"{_TOOL_PREFIX}{action}",
        "action": action,
        "durationMs": int((time.monotonic() - started) * 1000),
    }
    result = data.get("data")
    if isinstance(result, dict):
        out["result"] = result
    if not out["ok"]:
        out["error"] = str(data.get("error") or "前端执行失败")
        out["errorCode"] = data.get("errorCode") or "EXECUTION_FAILED"
    return out


def _make_ui_handler(action: str) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]:
    """生成绑定 action 的 handler(闭包,供 register_external_tool 注入)。"""

    async def handler(args: dict[str, Any]) -> dict[str, Any]:
        return await _ui_call(action, args)

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
            "表单字段、可点击元素。返回 {result:{registry:{page,commands,forms,elements}}},"
            "registry.elements[].id 即 click/fill 的 target。执行 UI 动作前先调用本工具。",
            {"type": "object", "properties": {}},
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
            "[UI桥接] 填写用户页面上的输入框/文本域/下拉框(含 react-hook-form 受控组件)。"
            "密码与验证码字段会被拦截(PERMISSION_DENIED)。填写后通常需配合 "
            "web_ui_click(提交按钮)或 web_ui_submit 才会真正提交。",
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
