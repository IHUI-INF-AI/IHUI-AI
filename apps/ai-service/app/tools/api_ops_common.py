# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""动作型工具公共层(2026-11-23 立)。

背景:财务账套(/api/fin-accounting)、发薪闭环(/api/hr-payout)、人事生命周期
(/api/hr-lifecycle)每块都有 20~60 个 REST 端点。若逐端点写一枚 LLM 工具,
注册表会被撑爆、schema 无法维护。故采用"一枚工具 + action 路由表"的形态:
工具只暴露 `action`(写清可选值)与 `payload`(一个对象),由本模块按表分发。

纪律:
  · 请求出口**只有这一处**(api_request):鉴权头走 internal_service_headers 唯一出口,
    失败优先回后端 errorCode,不把原始 HTTP 噪声抛给模型;
  · 路径参数只认 `:name` 占位,值从 payload 取,其余键归 body(GET 归 query);
  · action 未知时不静默,回可用清单(模型据此自纠一次,不靠猜)。
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any
from urllib.parse import quote

from ..core.internal_ticket import internal_service_headers

logger = logging.getLogger(__name__)

_UID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
_PATH_PARAM_RE = re.compile(r":([a-zA-Z_][a-zA-Z0-9_]*)")


def api_base_url() -> str:
    return os.environ.get("API_SERVICE_URL", "http://localhost:8802").rstrip("/")


def fail(tool: str, code: str, message: str) -> dict[str, Any]:
    return {"tool": tool, "ok": False, "errorCode": code, "message": message}


async def api_request(
    method: str,
    path: str,
    *,
    tool: str,
    user_id: Any,
    params: dict[str, Any] | None = None,
    body: Any = None,
) -> dict[str, Any]:
    """发请求并剥 `{code,message,data}` 壳。同 hr_tools._hr_request 的契约。"""
    import httpx

    headers = internal_service_headers(str(user_id), "api-tools")
    if not headers:
        return fail(tool, "INTERNAL_AUTH_UNAVAILABLE", "内部服务凭证不可用或用户身份缺失")
    url = f"{api_base_url()}{path}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=headers, params=params, json=body)
    except Exception as e:  # noqa: BLE001
        logger.warning("[%s] 接口请求失败:%s", tool, e)
        return fail(tool, "NETWORK_ERROR", f"后端接口请求失败: {e}")
    try:
        payload = resp.json()
    except Exception:  # noqa: BLE001
        payload = {}
    if resp.status_code < 400:
        data = payload.get("data") if isinstance(payload, dict) else None
        if isinstance(data, dict):
            return {"ok": True, **data}
        return {"ok": True, "data": data}
    message = payload.get("message") if isinstance(payload, dict) else None
    error_code = payload.get("errorCode") if isinstance(payload, dict) else None
    return fail(
        tool,
        str(error_code) if error_code else f"HTTP_{resp.status_code}",
        str(message) if message else f"后端接口返回 HTTP {resp.status_code}",
    )


async def dispatch(
    tool: str,
    arguments: dict[str, Any],
    routes: dict[str, tuple[str, str]],
    *,
    hint: str = "",
) -> dict[str, Any]:
    """按 action 路由表分发一次调用。

    routes: action → (method, path_template)。path_template 里的 `:id`/`:code`
    由 payload 同名键替换(替换后从 body 中剔除);其余键:
      · GET  → query 参数(剔除 None)
      · 其它 → JSON body(整个对象)
    """
    action = str(arguments.get("action") or "").strip()
    uid = str(arguments.get("__user_id") or "").strip()
    if not uid or not _UID_RE.fullmatch(uid):
        return fail(tool, "MISSING_USER", "缺少用户身份(__user_id 未注入或非法)")
    if not action:
        return fail(tool, "MISSING_ACTION", f"action 必填。可用:{', '.join(sorted(routes))}")
    route = routes.get(action)
    if route is None:
        return fail(tool, "UNKNOWN_ACTION", f"未知 action={action}。可用:{', '.join(sorted(routes))}")

    method, path_tpl = route
    payload = arguments.get("payload") or {}
    if not isinstance(payload, dict):
        return fail(tool, "INVALID_PAYLOAD", "payload 必须是对象")

    used: set[str] = set()
    missing: list[str] = []

    def repl(m: re.Match[str]) -> str:
        key = m.group(1)
        value = payload.get(key)
        if value is None or str(value).strip() == "":
            missing.append(key)
            return ""
        used.add(key)
        return quote(str(value), safe="")

    path = _PATH_PARAM_RE.sub(repl, path_tpl)
    if missing:
        return fail(tool, "MISSING_PATH_PARAM", f"payload 缺少路径参数:{', '.join(missing)}")

    rest = {k: v for k, v in payload.items() if k not in used and v is not None}
    if method == "GET":
        result = await api_request(method, path, tool=tool, user_id=uid, params=rest or None)
    else:
        result = await api_request(method, path, tool=tool, user_id=uid, body=rest)
    if result.get("ok") is False and hint:
        result = {**result, "hint": hint}
    return result
