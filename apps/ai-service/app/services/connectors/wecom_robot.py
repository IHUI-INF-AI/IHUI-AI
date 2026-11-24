# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""企业微信智能机器人 MCP 连接器服务(2026-11-26 立)。

把用户在企微客户端复制的「可使用权限」MCP 端点(带 apikey)加密落库,并以成员授权范围
调用文档/表格/智能表格/待办/日程/会议/微盘/通讯录等办公能力。

与旧「自建应用 access_token」连接器(wecom_corp)完全并存:
  - wecom_corp 走 qyapi/cgi-bin 的应用 API(通讯录/消息/审批),应用身份;
  - wecom_robot_mcp 走 qyapi/mcp 的 Streamable HTTP MCP,成员授权范围的机器人身份。

存储:作为独立 connector 记录,key = ``wecom:robot-mcp``,
extra 里 ``robot_mcp_endpoint`` 存加密端点(带 apikey + 能力位 + 授权时间),
7 天有效期由 ``authorized_at`` 推导,到期前端提示重新授权。

安全:
  - apikey 是 bearer-equivalent,复用 publish.credentials_crypto 加密,绝不回传明文;
  - 每条记录只服务一个 scope/tenant,不跨租户共享;
  - 端点解析强制官方域白名单(wecom_mcp.parse_mcp_endpoint)。
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from .. import connector_store
from . import connector_oauth, wecom_mcp

logger = logging.getLogger(__name__)

CONNECTOR_KEY = "wecom:robot-mcp"
ENDPOINT_EXTRA_KEY = "robot_mcp_endpoint"
# 官方:文档能力授权有效期 7 天;留 1 小时余量提前判过期
AUTHORIZED_TTL_S = 7 * 24 * 3600 - 3600
_TOOLS_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_TOOLS_CACHE_TTL_S = 300.0


class WecomRobotError(RuntimeError):
    """企微机器人连接器的可预期失败。"""


class EndpointPayload(dict[str, Any]):
    """落库载荷:端点 URL + 能力位 + 授权时间戳。"""


def _cipher_prefix() -> str:
    return "enc:robot-mcp-v1:"


def encrypt_endpoint(ep: wecom_mcp.McpEndpoint) -> str:
    """加密端点(apikey 在内)到可存 jsonb 的字符串。"""
    from app.services.publish.credentials_crypto import encrypt

    payload = {"url": ep.url, "capability": ep.capability, "authorized_at": int(time.time())}
    return _cipher_prefix() + encrypt(payload)


def decrypt_endpoint(value: str) -> EndpointPayload:
    """解密端点;密文损坏/密钥不匹配 fail-closed。"""
    prefix = _cipher_prefix()
    if not value or not value.startswith(prefix):
        raise WecomRobotError("机器人 MCP 端点不存在或格式非法")
    try:
        from app.services.publish.credentials_crypto import decrypt

        payload = decrypt(value[len(prefix):])
    except Exception as exc:  # noqa: BLE001
        raise WecomRobotError("机器人 MCP 端点解密失败(密钥不匹配或密文损坏)") from exc
    if not isinstance(payload, dict) or not payload.get("url"):
        raise WecomRobotError("机器人 MCP 端点载荷缺少 url")
    return EndpointPayload(payload)


def is_expired(payload: EndpointPayload, now: float | None = None) -> bool:
    """授权是否过期(7 天,官方无自动续期 API)。"""
    ts = float(payload.get("authorized_at") or 0)
    if ts <= 0:
        return True
    return (now if now is not None else time.time()) - ts > AUTHORIZED_TTL_S


def save_endpoint(
    scope: str,
    tenant_id: str | None,
    raw_config: str,
    *,
    name: str = "企业微信 · 智能机器人",
) -> dict[str, Any]:
    """解析用户粘贴的 MCP URL/JSON Config,加密落库,返回脱敏状态。"""
    ep = wecom_mcp.parse_mcp_endpoint(raw_config)
    cipher = encrypt_endpoint(ep)
    rec = connector_store.get(scope, CONNECTOR_KEY, tenant_id=tenant_id)
    template = {
        "key": CONNECTOR_KEY,
        "type": "wecom",
        "name": name,
        "app_id": "",
        "app_secret": "",
        "mode": "preset",
        "spec": {
            "base_url": "https://qyapi.weixin.qq.com/mcp",
            "auth_kind": "wecom_robot_mcp",
            "auth_name": "Authorization",
            "auth_scheme": "Bearer",
            "headers": {},
            "timeout_s": 15.0,
            "allow_write": True,
            "allow_private_hosts": False,
        },
        "operations": [],
        "enabled": True,
        "managed": False,
    }
    if rec is None:
        merged = dict(template)
        merged["extra"] = {ENDPOINT_EXTRA_KEY: cipher}
    else:
        merged = dict(rec)
        extra = dict(rec.get("extra") or {})
        extra[ENDPOINT_EXTRA_KEY] = cipher
        merged["extra"] = extra
    saved = connector_store.save(scope, merged, tenant_id=tenant_id)
    if saved is None:
        raise WecomRobotError("机器人 MCP 端点保存失败")
    _TOOLS_CACHE.clear()
    logger.info("[wecom_robot] 端点已保存 scope=%s cap=%s", scope, ep.capability)
    return status(scope, tenant_id)


def status(scope: str, tenant_id: str | None) -> dict[str, Any]:
    """脱敏状态:是否已授权/能力位/是否过期,绝不含 apikey。"""
    rec = connector_store.get(scope, CONNECTOR_KEY, tenant_id=tenant_id)
    if rec is None:
        return {"authorized": False, "capability": "", "expired": False, "message": "未授权"}
    extra = rec.get("extra") or {}
    cipher = str(extra.get(ENDPOINT_EXTRA_KEY) or "")
    if not cipher:
        return {"authorized": False, "capability": "", "expired": False, "message": "未配置端点"}
    try:
        payload = decrypt_endpoint(cipher)
    except WecomRobotError as exc:
        return {"authorized": False, "capability": "", "expired": False, "message": str(exc)}
    expired = is_expired(payload)
    return {
        "authorized": not expired,
        "capability": str(payload.get("capability") or ""),
        "expired": expired,
        "message": "授权已过期,请在企业微信客户端重新授权并粘贴新的 MCP 端点" if expired else "已授权",
    }


def _client(scope: str, tenant_id: str | None) -> wecom_mcp.WecomMcpClient:
    rec = connector_store.get(scope, CONNECTOR_KEY, tenant_id=tenant_id)
    if rec is None or not bool(rec.get("enabled")):
        raise WecomRobotError("企业微信机器人连接器不存在或已停用,请先完成授权")
    cipher = str((rec.get("extra") or {}).get(ENDPOINT_EXTRA_KEY) or "")
    payload = decrypt_endpoint(cipher)
    if is_expired(payload):
        raise WecomRobotError("授权已过期(7 天),请在企业微信客户端重新授权")
    ep = wecom_mcp.parse_mcp_endpoint(str(payload["url"]))
    return wecom_mcp.WecomMcpClient(ep)


async def list_tools(scope: str, tenant_id: str | None) -> list[dict[str, Any]]:
    """拉取 MCP 工具清单(带 inputSchema),5 分钟缓存。"""
    cache_key = f"{scope}:{tenant_id or ''}"
    now = time.monotonic()
    cached = _TOOLS_CACHE.get(cache_key)
    if cached and now - cached[0] < _TOOLS_CACHE_TTL_S:
        return cached[1]
    client = _client(scope, tenant_id)
    tools = await client.list_tools()
    _TOOLS_CACHE[cache_key] = (now, tools)
    return tools


async def invoke(
    scope: str,
    tenant_id: str | None,
    tool_name: str,
    arguments: dict[str, Any] | None = None,
) -> Any:
    """调用一个 MCP 工具;工具名须在 tools/list 清单里(防任意方法调用)。"""
    if not tool_name or not isinstance(tool_name, str):
        raise WecomRobotError("工具名非法")
    tools = await list_tools(scope, tenant_id)
    names = {str(t.get("name") or "") for t in tools}
    if tool_name not in names:
        raise WecomRobotError(f"工具不在授权清单内: {tool_name}")
    client = _client(scope, tenant_id)
    return await client.call_tool(tool_name, arguments)


def clear_cache() -> None:
    _TOOLS_CACHE.clear()
