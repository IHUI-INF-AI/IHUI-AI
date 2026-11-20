# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent Client Protocol (ACP) HTTP 桥 —— 2026-11-20(对标取证第 14 项)。

来源(取证,不抄码):WorkBuddyAI 5.11.4 的 `resources/app.asar` 内
`main__acp.js`(86KB)把「编辑器客户端」与「agent 后端」之间的会话面抽成一套
JSON-RPC 2.0 方法(`initialize` / `session/new` / `session/load` / `session/prompt`
/ `session/cancel`),客户端只认协议不认实现。本仓原有会话能力全部挂在自己的
HTTP+SSE 契约上,外部编辑器(Zed / Neovim / 自研壳)要接就得读我们的私有文档。

本模块把已有的 `SessionStore` 会话面**适配**成 ACP 形状,只做协议翻译,不新建
第二个真相源:
- 身份只从承载层入参 `user_id` 进来,不接受请求体自报(`IDENTITY_METADATA_KEYS`
  / `owner_scoped_allows` 仍是唯一判据,本模块不重写条件);
- 属主不符与"没这条会话"一律同形(ACP 规范里就是 `-32000` + 同一句 message,
  不新造可分辨信号);
- `session/prompt` 这类需要长连接流式执行的语义**不在 HTTP 桥上假装支持**:返回
  `-32001 unsupported`,并在 data 里点名该走哪个既有 SSE 端点。造一个"看起来能
  跑"的桩比不实现更坏(§0.3:没判不写成判过)。

公开入口:
    - `handle_acp_payload(payload, *, store, user_id) -> dict | list[dict]`
      单个请求或批量数组,返回 JSON-RPC 响应(与项目 `{code,message,data}` 信封
      刻意不同:对外协议面必须是客户认得的形状)。
"""

from __future__ import annotations

from typing import Any

from .session_store import owner_scoped_allows, thread_owner

# ACP 协议版本(1 = 当前编辑器生态通用的 v1 形状)。
ACP_PROTOCOL_VERSION = 1
# 批量上限:一次 HTTP 请求最多处理这么多条(超过直接拒,不逐条跑半截)。
ACP_MAX_BATCH = 20

# JSON-RPC 2.0 规范错误码(规范值,不自定义)。
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603
# 实现侧自定义段(-32000..-32099):能力未实现 / 语义不在本面。
UNSUPPORTED = -32000
UNSUPPORTED_STREAMING = -32001

# 已实现的方法(其余一律 METHOD_NOT_FOUND / UNSUPPORTED,不静默当成功)。
_HANDLED_METHODS = ("initialize", "authenticate", "session/new", "session/load", "session/list")
_STREAMING_METHODS = ("session/prompt", "session/cancel", "session/set_mode", "session/set_model")

_SSE_HINT = "本仓流式执行面在 POST /api/agents/* 的 text/event-stream 契约上"


def _ok(req_id: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _err(req_id: Any, code: int, message: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"code": code, "message": message}
    if data:
        body["data"] = data
    return {"jsonrpc": "2.0", "id": req_id, "error": body}


def _session_or_none(store: Any, session_id: str, user_id: str) -> Any:
    """存在性 + 属主一次判定(与 sessions 路由 `_thread_or_404` 同一份判据)。"""
    row = store.get_thread(session_id)
    if row is None or not owner_scoped_allows(user_id, thread_owner(row)):
        return None
    return row


def _handle_initialize(params: dict[str, Any]) -> dict[str, Any]:
    # 客户端报的 protocolVersion 只作回显参考:本仓只有 v1,不猜别的版本。
    requested = params.get("protocolVersion")
    return {
        "protocolVersion": ACP_PROTOCOL_VERSION,
        "agentCapabilities": {
            "loadSession": True,
            "promptCapabilities": {"image": False, "audio": False, "embeddedContext": True},
        },
        "authMethods": [],
        "clientProtocolVersion": requested if isinstance(requested, int) else None,
    }


def _handle_session_new(params: dict[str, Any], *, store: Any, user_id: str) -> dict[str, Any]:
    title = params.get("title")
    cwd = params.get("cwd")
    metadata: dict[str, Any] = {}
    if isinstance(cwd, str) and cwd:
        metadata["acp"] = {"cwd": cwd}
    thread = store.create_thread(
        title=title if isinstance(title, str) else "",
        metadata=metadata,
        user_id=user_id,
    )
    return {"sessionId": thread.thread_id}


def _handle_session_load(params: dict[str, Any], *, store: Any, user_id: str) -> dict[str, Any]:
    session_id = params.get("sessionId")
    if not isinstance(session_id, str) or not session_id:
        raise ValueError("sessionId 必填")
    thread = _session_or_none(store, session_id, user_id)
    if thread is None:
        raise LookupError(session_id)
    items = store.list_items(session_id)
    snapshot = [
        {"seq": it.seq, "itemType": it.item_type, "clientItemId": it.client_item_id}
        for it in items
    ]
    return {
        "sessionId": thread.thread_id,
        "title": thread.title,
        "itemCount": len(snapshot),
        "items": snapshot,
    }


def _handle_session_list(params: dict[str, Any], *, store: Any, user_id: str) -> dict[str, Any]:
    limit = params.get("limit")
    cap = limit if isinstance(limit, int) and 1 <= limit <= 200 else 50
    page = store.list_threads(limit=cap, owner_user_id=user_id)
    return {
        "sessions": [
            {"sessionId": t.thread_id, "title": t.title, "updatedAt": t.updated_at}
            for t in page.threads
        ],
        "total": page.total,
    }


def handle_acp_call(call: Any, *, store: Any, user_id: str) -> dict[str, Any]:
    """处理单条 JSON-RPC 调用。任何异常都翻成规范错误码,不向上抛。"""
    if not isinstance(call, dict):
        return _err(None, INVALID_REQUEST, "请求必须是 JSON 对象")
    req_id = call.get("id")
    if call.get("jsonrpc") != "2.0" or not isinstance(call.get("method"), str):
        return _err(req_id, INVALID_REQUEST, "缺少 jsonrpc=2.0 或 method")
    method = str(call["method"])
    params = call.get("params")
    if params is None:
        params = {}
    if not isinstance(params, dict):
        return _err(req_id, INVALID_PARAMS, "params 必须是对象")

    if method in _STREAMING_METHODS:
        return _err(
            req_id,
            UNSUPPORTED_STREAMING,
            f"{method} 不属于 HTTP 桥的语义(需要双向流式)",
            {"hint": _SSE_HINT},
        )
    if method not in _HANDLED_METHODS:
        return _err(req_id, METHOD_NOT_FOUND, f"未实现的方法: {method}")

    try:
        if method == "initialize":
            return _ok(req_id, _handle_initialize(params))
        if method == "authenticate":
            # 身份由 HTTP 承载层(Bearer)给定,协议层不再要第二份凭据。
            return _ok(req_id, {})
        if method == "session/new":
            return _ok(req_id, _handle_session_new(params, store=store, user_id=user_id))
        if method == "session/load":
            return _ok(req_id, _handle_session_load(params, store=store, user_id=user_id))
        return _ok(req_id, _handle_session_list(params, store=store, user_id=user_id))
    except LookupError:
        return _err(req_id, INVALID_PARAMS, f"session 不存在: {params.get('sessionId')}")
    except ValueError as e:
        return _err(req_id, INVALID_PARAMS, str(e))
    except Exception:  # noqa: BLE001 —— 协议面不允许把内部异常原样抛给客户端
        return _err(req_id, INTERNAL_ERROR, "内部错误")


def handle_acp_payload(payload: Any, *, store: Any, user_id: str) -> Any:
    """入口:单条对象或批量数组 → JSON-RPC 响应。空数组 / 超批量上限直接拒。"""
    if isinstance(payload, list):
        if not payload:
            return _err(None, INVALID_REQUEST, "批量请求不能为空")
        if len(payload) > ACP_MAX_BATCH:
            return _err(None, INVALID_REQUEST, f"批量上限 {ACP_MAX_BATCH} 条")
        return [handle_acp_call(c, store=store, user_id=user_id) for c in payload]
    if not isinstance(payload, dict):
        return _err(None, INVALID_REQUEST, "请求必须是 JSON 对象或数组")
    return handle_acp_call(payload, store=store, user_id=user_id)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
