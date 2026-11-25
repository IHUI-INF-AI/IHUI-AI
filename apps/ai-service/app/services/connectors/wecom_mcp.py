# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""企业微信智能机器人 MCP 客户端(2026-11-26 立)。

背景(官方 2026-11-05 上线的「智能机器人 AI 能力」):
  企业微信智能机器人经成员单独授权「可使用权限」后,提供一条 Streamable HTTP MCP
  端点(URL query 带 apikey),机器人可代替成员操作文档/表格/智能表格/智能文档/待办/
  日程/会议/微盘/通讯录。这与旧「网页 OAuth 只返 userid/user_ticket」是两套体系:
  前者是成员授权的办公能力,后者不提供 per-user access_token。

本模块只做 JSON-RPC over Streamable HTTP 的传输层,不含业务语义:
  - parse_mcp_endpoint:解析用户在企微客户端复制的 MCP URL / JSON Config,提取 apikey、
    能力位,并做官方域白名单校验(防把凭证发到外部主机);
  - WecomMcpClient.call_tool:initialize → notifications/initialized → tools/call,
    业务 JSON 从 result.content[0].text 二次解析;tools/list 结果可缓存复用。

安全:
  - apikey 是 bearer-equivalent 凭证,调用方必须加密落库、绝不下发浏览器/日志;
  - 只允许 qyapi.weixin.qq.com(官方)主机,禁私网/重定向;
  - 每次调用新建短连接,响应体限量截断,超时可配。
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx

logger = logging.getLogger(__name__)

# 官方 MCP 端点主机(写死白名单,不用通配符后缀匹配,防 qyapi.weixin.qq.com.evil.com)
_MCP_ALLOWED_HOSTS = frozenset({"qyapi.weixin.qq.com"})
# 能力位 → 官方 MCP 路径片段(v2 控制台形态),用于从 URL 反推能力标签
_CAPABILITY_BY_PATH: dict[str, str] = {
    "doc": "document",
    "msg": "message",
    "mail": "mail",
    "todo": "todo",
    "calendar": "calendar",
    "schedule": "calendar",
    "meeting": "meeting",
    "drive": "wedrive",
    "wedrive": "wedrive",
    "contacts": "contacts",
    "contact": "contacts",
}
# URL 兼容两代形态: /mcp/v2/bot/<cap>?apikey=... 与 /mcp/robot-<cap>?apikey=...
_V2_PATH_RE = re.compile(r"^/mcp/v2/bot/([A-Za-z0-9_-]+)/?$")
_V1_PATH_RE = re.compile(r"^/mcp/robot-([A-Za-z0-9_-]+)/?$")

_PROTOCOL_VERSION = "2025-06-18"


class WecomMcpError(RuntimeError):
    """企微 MCP 端点的可预期失败(配置非法/协议错误/平台返回 isError)。"""


@dataclass(frozen=True)
class McpEndpoint:
    """解析后的 MCP 端点(仅含官方主机 URL + apikey + 能力标签)。"""

    url: str  # 原样 URL(含 apikey),调用时直接用
    apikey: str
    capability: str  # document/calendar/... 未知则 "unknown"

    def safe_dict(self) -> dict[str, str]:
        """可安全记日志的形状:apikey 只留长度,不泄露明文。"""
        return {"url_host": urlparse(self.url).netloc, "apikey_len": str(len(self.apikey)), "capability": self.capability}


def parse_mcp_endpoint(raw: str) -> McpEndpoint:
    """从用户粘贴的 MCP URL 或 JSON Config 解析端点。

    接受:
      1) 裸 URL: https://qyapi.weixin.qq.com/mcp/v2/bot/doc?apikey=xxx
      2) JSON Config: {"mcpServers":{"企业微信文档":{"type":"streamable-http","url":"..."}}}
      3) 只含一条 mcpServers 项的其它键名形态(取第一条带 url 的)
    """
    text = (raw or "").strip()
    if not text:
        raise WecomMcpError("MCP 端点为空")

    url = text
    if text.startswith("{"):
        try:
            cfg = json.loads(text)
        except json.JSONDecodeError as exc:
            raise WecomMcpError("MCP 配置 JSON 非法") from exc
        servers = cfg.get("mcpServers") if isinstance(cfg, dict) else None
        if not isinstance(servers, dict) or not servers:
            raise WecomMcpError("MCP 配置缺少 mcpServers")
        found = ""
        for item in servers.values():
            if isinstance(item, dict) and str(item.get("url") or "").strip():
                found = str(item["url"]).strip()
                break
        if not found:
            raise WecomMcpError("MCP 配置中未找到 url")
        url = found

    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise WecomMcpError("MCP 端点必须是 https")
    if parsed.hostname not in _MCP_ALLOWED_HOSTS:
        raise WecomMcpError("MCP 端点主机非企业微信官方域,拒绝")
    if parsed.username or parsed.password:
        raise WecomMcpError("MCP 端点不得包含 userinfo")

    qs = parse_qs(parsed.query)
    apikey_list = qs.get("apikey") or []
    apikey = apikey_list[0].strip() if apikey_list else ""
    if not apikey:
        raise WecomMcpError("MCP 端点缺少 apikey")

    cap_raw = ""
    for regex in (_V2_PATH_RE, _V1_PATH_RE):
        m = regex.match(parsed.path)
        if m:
            cap_raw = m.group(1).lower()
            break
    capability = _CAPABILITY_BY_PATH.get(cap_raw, "unknown")
    logger.info("[wecom_mcp] 解析端点 %s", {"host": parsed.hostname, "cap": capability, "apikey_len": len(apikey)})
    return McpEndpoint(url=url, apikey=apikey, capability=capability)


class WecomMcpClient:
    """轻量 MCP over Streamable HTTP 客户端(每次调用短连接)。"""

    def __init__(
        self,
        endpoint: McpEndpoint,
        *,
        timeout_s: float = 15.0,
        max_response_bytes: int = 1_000_000,
        client_name: str = "ihui-ai",
        client_version: str = "1.0.0",
    ) -> None:
        self.endpoint = endpoint
        self.timeout_s = timeout_s
        self.max_response_bytes = max_response_bytes
        self.client_name = client_name
        self.client_version = client_version
        self._session_id = ""
        self._initialized = False

    def _headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            # 企微实测:缺 Accept: application/json 会返 -32600 Not Acceptable
            "Accept": "application/json",
            "MCP-Protocol-Version": _PROTOCOL_VERSION,
        }
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        return headers

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        # JSON-RPC 通知(无 id)按 Streamable HTTP 规范只回 202/204 空响应,
        # 不能按普通请求去解析 JSON,否则 notifications/initialized 会把 202 当失败。
        is_notification = "id" not in payload
        async with httpx.AsyncClient(
            timeout=self.timeout_s, follow_redirects=False, trust_env=False
        ) as client:
            resp = await client.post(
                self.endpoint.url, headers=self._headers(), json=payload
            )
        sid = resp.headers.get("Mcp-Session-Id") or ""
        if sid:
            self._session_id = sid
        raw = resp.content or b""
        if is_notification:
            if resp.status_code >= 400:
                raise WecomMcpError(f"MCP 通知被拒绝 HTTP {resp.status_code}")
            return {}
        truncated = False
        if len(raw) > self.max_response_bytes:
            raw = raw[: self.max_response_bytes]
            truncated = True
        try:
            data = json.loads(raw.decode("utf-8", errors="replace"))
        except json.JSONDecodeError as exc:
            raise WecomMcpError(f"MCP 响应非 JSON(status={resp.status_code})") from exc
        if resp.status_code >= 400:
            msg = ""
            if isinstance(data, dict):
                err = data.get("error")
                msg = str(err.get("message") if isinstance(err, dict) else err or "")
            raise WecomMcpError(f"MCP HTTP {resp.status_code}: {msg[:200]}")
        if truncated:
            raise WecomMcpError("MCP 响应超过大小上限,拒绝解析")
        if not isinstance(data, dict):
            raise WecomMcpError("MCP 响应不是对象")
        return data

    async def initialize(self) -> dict[str, Any]:
        """握手:initialize + initialized 通知;结果含服务端能力清单。"""
        result = await self._post(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": _PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": {
                        "name": self.client_name,
                        "version": self.client_version,
                    },
                },
            }
        )
        if "error" in result:
            raise WecomMcpError(f"MCP initialize 失败: {str(result['error'])[:200]}")
        await self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})
        self._initialized = True
        return result

    async def list_tools(self) -> list[dict[str, Any]]:
        """拉取工具清单(含 inputSchema),供 operation 参数映射与前端展示。"""
        if not self._initialized:
            await self.initialize()
        result = await self._post(
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
        )
        if "error" in result:
            raise WecomMcpError(f"MCP tools/list 失败: {str(result['error'])[:200]}")
        tools = (result.get("result") or {}).get("tools") or []
        return [t for t in tools if isinstance(t, dict)]

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        """调用工具;业务 JSON 从 result.content[0].text 二次解析。"""
        if not self._initialized:
            await self.initialize()
        result = await self._post(
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {"name": name, "arguments": arguments or {}},
            }
        )
        if "error" in result:
            raise WecomMcpError(f"MCP tools/call 失败: {str(result['error'])[:200]}")
        body = result.get("result") or {}
        if body.get("isError"):
            text = _first_content_text(body)
            raise WecomMcpError(f"MCP 工具返回错误: {text[:200]}")
        return _parse_business_payload(body)


def _first_content_text(result_body: dict[str, Any]) -> str:
    for item in result_body.get("content") or []:
        if isinstance(item, dict) and item.get("type") == "text":
            return str(item.get("text") or "")
    return ""


def _parse_business_payload(result_body: dict[str, Any]) -> Any:
    """MCP content[0].text 往往是企业微信业务 JSON 字符串,尽量解一层。"""
    text = _first_content_text(result_body)
    if not text:
        return result_body
    stripped = text.strip()
    if stripped.startswith(("{", "[")):
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            return text
    return text
