# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""自定义 HTTP 连接器执行层(2026-11-23 立)。

让用户接自己的业务系统或任意 SaaS:

- 用户填 ``base_url`` + 鉴权方式,再给一组声明式操作(手填或 OpenAPI 导入)
- 每条操作声明 method/path/query/body/response_path,执行层按模板拼请求
- 平台 token(飞书/企微/钉钉/公众号)由本层用 app_id/app_secret 换取并缓存

安全边界(缺一不可):
1. 出站只允许 http/https,且默认拒绝私网、回环、链路本地、云元数据地址
   (开 ``allow_private_hosts`` 才放行 —— 面向内网自建系统的显式选择)
2. 不跟随重定向(避免 302 跳内网绕过首跳校验)
3. 响应体大小上限 + 正文长度上限(防大响应撑爆内存/上下文)
4. 写操作(action)必须连接器显式开启 ``allow_write``,且执行前由前端二次确认
5. 凭据只从加密存储读出,不写日志、不回传响应
"""

from __future__ import annotations

import asyncio
import base64
import ipaddress
import json
import logging
import re
import socket
import time
from typing import Any
from urllib.parse import quote, urlparse

import httpx

from .. import audit_log
from .base import (
    CAPABILITIES,
    ConnectorOperation,
    ConnectorOperationError,
    ConnectorSpec,
    path_param_names,
)

logger = logging.getLogger(__name__)

CONNECTOR_TYPE = "custom"

# 单篇/单条内容注入上下文的上限(与 connectors.MAX_DOC_CHARS 一致)
MAX_CONTENT_CHARS = 20_000

# 平台 token 缓存:{cache_key: (token, expire_at)}
_TOKEN_CACHE: dict[str, tuple[str, float]] = {}
_TOKEN_TTL_MAX_S = 7000.0

# 禁止自定义的请求头(鉴权头白名单之外的安全边界)
_FORBIDDEN_HEADERS = {
    "host",
    "content-length",
    "content-type",
    "connection",
    "transfer-encoding",
}

# 云厂商元数据地址(即使 allow_private_hosts 也拒绝)
_METADATA_HOSTS = {"metadata.google.internal", "metadata", "instance-data"}


class ConnectorSecurityError(RuntimeError):
    """出站地址被安全策略拒绝。"""


class ConnectorExecutionError(RuntimeError):
    """执行失败(未配置、缺参数、上游报错等)。"""


# ---------------------------------------------------------------------------
# 出站地址校验(SSRF 防线)
# ---------------------------------------------------------------------------


def _is_blocked_ip(raw_ip: str) -> bool:
    """判断解析出的 IP 是否属于必须拒绝的网段。"""
    try:
        ip = ipaddress.ip_address(raw_ip)
    except ValueError:
        return True
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast:
        return True
    if ip.is_reserved or ip.is_unspecified:
        return True
    # 云元数据常见地址(部分落在 link-local 之外的历史别名)
    if str(ip) in {"100.100.100.200", "169.254.169.254", "fd00:ec2::254"}:
        return True
    return False


async def validate_outbound_url(url: str, *, allow_private_hosts: bool = False) -> None:
    """校验出站 URL;不允许则抛 ConnectorSecurityError。

    域名会经 DNS 解析后逐个 IP 校验 —— 只校验字面 host 会漏掉
    "公网域名解析到内网 IP" 这一型。
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ConnectorSecurityError("只允许 http/https 出站")
    host = (parsed.hostname or "").strip().lower()
    if not host:
        raise ConnectorSecurityError("URL 缺少 host")
    if host in _METADATA_HOSTS:
        raise ConnectorSecurityError("禁止访问云元数据地址")
    if not allow_private_hosts:
        if host in {"localhost", "localhost.localdomain"} or host.endswith(
            (".localhost", ".local", ".internal")
        ):
            raise ConnectorSecurityError("默认禁止访问内网/本机地址")
        # 字面 IP 先判
        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            ip = None
        if ip is not None and _is_blocked_ip(str(ip)):
            raise ConnectorSecurityError("默认禁止访问私网/回环/链路本地地址")
        # 域名解析后再判(解析失败按拒绝处理)
        try:
            infos = await asyncio.to_thread(socket.getaddrinfo, host, None)
        except OSError as exc:
            raise ConnectorSecurityError(f"域名解析失败: {host}") from exc
        for info in infos:
            sockaddr = info[4]
            if sockaddr and _is_blocked_ip(str(sockaddr[0])):
                raise ConnectorSecurityError(
                    f"域名 {host} 解析到受限地址 {sockaddr[0]},默认拒绝"
                )


# ---------------------------------------------------------------------------
# 平台 token 换取(带进程内 TTL 缓存)
# ---------------------------------------------------------------------------


async def _fetch_json(
    method: str,
    url: str,
    *,
    json_body: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    timeout_s: float = 15.0,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout_s, follow_redirects=False) as client:
        resp = await client.request(method, url, json=json_body, params=params)
    try:
        data = resp.json()
    except ValueError as exc:
        raise ConnectorExecutionError(
            f"上游返回非 JSON(status={resp.status_code})"
        ) from exc
    if not isinstance(data, dict):
        raise ConnectorExecutionError("上游响应不是 JSON 对象")
    return data


def _token_cache_key(record: dict[str, Any], kind: str) -> str:
    return f"{kind}:{record.get('app_id') or ''}:{record.get('key') or ''}"


async def _platform_token(record: dict[str, Any], kind: str) -> str:
    """按鉴权类型换取 access token(飞书/企微/钉钉/公众号)。"""
    cache_key = _token_cache_key(record, kind)
    cached = _TOKEN_CACHE.get(cache_key)
    if cached and cached[1] > time.time():
        return cached[0]

    app_id = str(record.get("app_id") or "").strip()
    app_secret = str(record.get("app_secret") or "").strip()
    if not app_id or not app_secret:
        raise ConnectorExecutionError("未配置 app_id/app_secret")

    token = ""
    expire_in = 0

    if kind == "feishu_tenant":
        data = await _fetch_json(
            "POST",
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
            json_body={"app_id": app_id, "app_secret": app_secret},
        )
        if data.get("code") != 0:
            raise ConnectorExecutionError(
                f"飞书 token 获取失败: {data.get('msg')} (code={data.get('code')})"
            )
        token = str(data.get("tenant_access_token") or "")
        expire_in = int(data.get("expire") or 0)
    elif kind == "wecom_corp":
        data = await _fetch_json(
            "GET",
            "https://qyapi.weixin.qq.com/cgi-bin/gettoken",
            params={"corpid": app_id, "corpsecret": app_secret},
        )
        if int(data.get("errcode") or 0) != 0:
            raise ConnectorExecutionError(
                f"企业微信 token 获取失败: {data.get('errmsg')} "
                f"(errcode={data.get('errcode')})"
            )
        token = str(data.get("access_token") or "")
        expire_in = int(data.get("expires_in") or 0)
    elif kind == "dingtalk":
        data = await _fetch_json(
            "GET",
            "https://oapi.dingtalk.com/gettoken",
            params={"appkey": app_id, "appsecret": app_secret},
        )
        if int(data.get("errcode") or 0) != 0:
            raise ConnectorExecutionError(
                f"钉钉 token 获取失败: {data.get('errmsg')} "
                f"(errcode={data.get('errcode')})"
            )
        token = str(data.get("access_token") or "")
        expire_in = int(data.get("expires_in") or 0)
    elif kind == "wechat_mp":
        data = await _fetch_json(
            "POST",
            "https://api.weixin.qq.com/cgi-bin/stable_token",
            json_body={
                "grant_type": "client_credential",
                "appid": app_id,
                "secret": app_secret,
                "force_refresh": False,
            },
        )
        if int(data.get("errcode") or 0) != 0:
            raise ConnectorExecutionError(
                f"公众号 token 获取失败: {data.get('errmsg')} "
                f"(errcode={data.get('errcode')})"
            )
        token = str(data.get("access_token") or "")
        expire_in = int(data.get("expires_in") or 0)

    if not token:
        raise ConnectorExecutionError(f"{kind} 未返回 access_token")

    ttl = max(60.0, min(float(expire_in or 0) - 60.0, _TOKEN_TTL_MAX_S))
    _TOKEN_CACHE[cache_key] = (token, time.time() + ttl)
    return token


def clear_token_cache(record: dict[str, Any] | None = None) -> None:
    """凭据变更后清缓存(不传 record 则全清)。"""
    if record is None:
        _TOKEN_CACHE.clear()
        return
    prefix = str(record.get("key") or "")
    for key in list(_TOKEN_CACHE):
        if prefix and key.endswith(f":{prefix}"):
            _TOKEN_CACHE.pop(key, None)


async def _auth_parts(
    record: dict[str, Any], spec: ConnectorSpec
) -> tuple[dict[str, str], dict[str, str]]:
    """返回 (额外请求头, 额外查询参数)。"""
    kind = spec.auth_kind
    secret = str(record.get("app_secret") or "").strip()
    app_id = str(record.get("app_id") or "").strip()
    header = spec.auth_name or "Authorization"
    headers: dict[str, str] = {}
    params: dict[str, str] = {}

    if kind == "none":
        return headers, params
    if kind == "bearer":
        token = secret or str((record.get("extra") or {}).get("token") or "").strip()
        if not token:
            raise ConnectorExecutionError("未配置 bearer token")
        scheme = (spec.auth_scheme or "Bearer").strip()
        headers[header] = f"{scheme} {token}".strip()
        return headers, params
    if kind == "header":
        # 可选请求头鉴权:留空表示公开接口(如语雀公开知识库),填了才注入
        if not secret:
            return headers, params
        headers[header] = secret
        return headers, params
    if kind == "basic":
        if not app_id or not secret:
            raise ConnectorExecutionError("basic 鉴权需要 app_id/app_secret")
        encoded = base64.b64encode(f"{app_id}:{secret}".encode()).decode()
        headers[header] = f"Basic {encoded}"
        return headers, params
    if kind == "query":
        if not secret:
            raise ConnectorExecutionError("未配置查询参数密钥")
        params[header] = secret
        return headers, params

    token = await _platform_token(record, kind)
    if kind == "wechat_mp":
        params["access_token"] = token
    elif kind in ("wecom_corp", "dingtalk"):
        params["access_token"] = token
    else:  # feishu_tenant
        headers["Authorization"] = f"Bearer {token}"
    return headers, params


# ---------------------------------------------------------------------------
# 模板展开与响应提取
# ---------------------------------------------------------------------------


def _fill_template(value: Any, params: dict[str, Any]) -> Any:
    """递归替换 ``{name}`` 占位符;缺参数抛错(fail-closed)。"""

    if isinstance(value, str):
        def repl(match: re.Match[str]) -> str:
            name = match.group(1)
            if name not in params or params[name] is None:
                raise ConnectorExecutionError(f"缺少参数: {name}")
            return str(params[name])

        return re.sub(r"\{([A-Za-z0-9_]+)\}", repl, value)
    if isinstance(value, list):
        return [_fill_template(v, params) for v in value]
    if isinstance(value, dict):
        return {k: _fill_template(v, params) for k, v in value.items()}
    return value


def _extract(data: Any, path: str) -> Any:
    """按点路径取值,支持 ``a.b[0].c`` 形态;取不到返回 None。"""
    if not path:
        return data
    current = data
    for token in re.findall(r"[A-Za-z0-9_.-]+|\[\d+\]", path):
        if token.startswith("[") and token.endswith("]"):
            idx = int(token[1:-1])
            if isinstance(current, list) and 0 <= idx < len(current):
                current = current[idx]
            else:
                return None
            continue
        for part in token.split("."):
            if not part:
                continue
            if isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, list) and part.isdigit():
                idx = int(part)
                current = current[idx] if 0 <= idx < len(current) else None
            else:
                return None
            if current is None:
                return None
    return current


def _json_text(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, indent=2)
    except (TypeError, ValueError):
        return str(value)


def _content_of(extracted: Any) -> str:
    """把提取结果转成可注入上下文的文本。"""
    if extracted is None:
        return ""
    if isinstance(extracted, str):
        return extracted
    if isinstance(extracted, dict):
        for key in ("content", "text", "body", "raw_content", "markdown"):
            value = extracted.get(key)
            if isinstance(value, str) and value:
                return value
    return _json_text(extracted)


def _items_of(extracted: Any) -> list[dict[str, str]]:
    """把列表结果规范成 [{doc_id, title}](同步按钮与旧界面复用)。"""
    raw_list = extracted
    if isinstance(raw_list, dict):
        for key in ("items", "list", "records", "data", "files", "messages"):
            if isinstance(raw_list.get(key), list):
                raw_list = raw_list[key]
                break
    if not isinstance(raw_list, list):
        return []
    items: list[dict[str, str]] = []
    for item in raw_list:
        if isinstance(item, str):
            items.append({"doc_id": item, "title": item})
            continue
        if not isinstance(item, dict):
            continue
        doc_id = ""
        for key in ("doc_id", "id", "token", "record_id", "message_id", "userid", "chat_id"):
            if item.get(key):
                doc_id = str(item[key])
                break
        title = ""
        for key in ("title", "name", "text", "summary", "content"):
            if item.get(key):
                title = str(item[key])
                break
        if doc_id or title:
            items.append({"doc_id": doc_id or title[:40], "title": title or doc_id})
    return items


# ---------------------------------------------------------------------------
# 执行入口
# ---------------------------------------------------------------------------


class CustomHttpConnector:
    """声明式操作执行器(自定义连接器与平台模板共用)。"""

    def __init__(self, record: dict[str, Any]) -> None:
        self.record = record
        self.spec = ConnectorSpec.from_dict(record.get("spec"))
        raw_ops = record.get("operations")
        self.operations: list[ConnectorOperation] = []
        for raw in raw_ops if isinstance(raw_ops, list) else []:
            try:
                self.operations.append(ConnectorOperation.from_dict(raw))
            except ConnectorOperationError:
                logger.warning(
                    "[custom_http] 跳过非法操作定义 key=%s", record.get("key")
                )
        self._by_id = {op.id: op for op in self.operations}

    def operation(self, operation_id: str) -> ConnectorOperation:
        op = self._by_id.get(operation_id)
        if op is None:
            raise ConnectorExecutionError(f"操作不存在: {operation_id}")
        return op

    def _pick(self, capability: str) -> ConnectorOperation | None:
        for op in self.operations:
            if op.capability == capability:
                return op
        return None

    async def invoke(
        self, operation_id: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        op = self.operation(operation_id)
        if op.capability not in CAPABILITIES:
            raise ConnectorExecutionError(f"能力位非法: {op.capability}")
        if op.capability == "action" and not self.spec.allow_write:
            raise ConnectorExecutionError("该连接器未开启写权限,拒绝执行写操作")
        return await self._execute(op, params or {})

    async def _execute(
        self, op: ConnectorOperation, params: dict[str, Any]
    ) -> dict[str, Any]:
        # 操作级独立基址(台账 base_url_override)优先;空串回落到连接器 spec 基址
        base_url = (op.base_url or self.spec.base_url).rstrip("/")
        if not base_url:
            raise ConnectorExecutionError("未配置 base_url")
        if not base_url.startswith(("http://", "https://")):
            raise ConnectorExecutionError("操作 base_url 必须是 http(s):// 开头")

        # 路径占位符必须都能取到值
        for name in path_param_names(op.path):
            if name not in params:
                raise ConnectorExecutionError(f"缺少路径参数: {name}")
        path = _fill_template(op.path, params)
        url = f"{base_url}{path}"
        await validate_outbound_url(
            url, allow_private_hosts=self.spec.allow_private_hosts
        )

        auth_headers, auth_params = await _auth_parts(self.record, self.spec)
        headers: dict[str, str] = {}
        for key, value in self.spec.headers.items():
            if key.lower() in _FORBIDDEN_HEADERS:
                raise ConnectorExecutionError(f"禁止自定义请求头: {key}")
            headers[key] = str(value)
        headers.update(auth_headers)
        if op.method in ("POST", "PUT", "PATCH") and not any(
            k.lower() == "content-type" for k in headers
        ):
            headers["Content-Type"] = "application/json"

        query: dict[str, Any] = {}
        for key, value in op.query.items():
            query[key] = _fill_template(value, params)
        query.update(auth_params)

        body = _fill_template(op.body, params) if op.body else None

        timeout = self.spec.timeout_s
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
                resp = await client.request(
                    op.method, url, headers=headers, params=query, json=body
                )
        except httpx.HTTPError as exc:
            raise ConnectorExecutionError(f"请求失败: {type(exc).__name__}") from exc

        raw_bytes = resp.content or b""
        truncated = False
        if len(raw_bytes) > self.spec.max_response_bytes:
            raw_bytes = raw_bytes[: self.spec.max_response_bytes]
            truncated = True

        payload: Any = None
        try:
            payload = json.loads(raw_bytes.decode("utf-8", errors="replace"))
        except ValueError:
            payload = raw_bytes.decode("utf-8", errors="replace")

        if resp.status_code >= 400:
            message = f"上游返回 {resp.status_code}"
            if isinstance(payload, dict):
                message = str(
                    payload.get("msg")
                    or payload.get("message")
                    or payload.get("errmsg")
                    or message
                )
            raise _PartialFailure(
                message,
                status=resp.status_code,
                capability=op.capability,
                operation_id=op.id,
                data=payload,
            )

        extracted = _extract(payload, op.response_path) if op.response_path else payload

        result: dict[str, Any] = {
            "ok": True,
            "status": resp.status_code,
            "capability": op.capability,
            "operation_id": op.id,
            "message": "ok",
            "truncated": truncated,
            "data": extracted,
        }
        if op.capability in ("fetch", "list", "search"):
            content = _content_of(extracted)
            if len(content) > MAX_CONTENT_CHARS:
                content = content[:MAX_CONTENT_CHARS]
                result["truncated"] = True
            result["content"] = content
            result["items"] = _items_of(extracted)
        return result

    async def sync(self) -> dict[str, Any]:
        """用第一条 list 能力操作做数据源同步(兼容旧同步按钮)。"""
        op = self._pick("list") or self._pick("search")
        if op is None:
            return {
                "ok": False,
                "message": "该连接器没有 list/search 操作,请先在操作清单里添加",
                "items": [],
                "last_sync_at": "",
            }
        try:
            result = await self._execute(op, {})
        except ConnectorExecutionError as exc:
            return {"ok": False, "message": str(exc), "items": [], "last_sync_at": ""}
        except ConnectorSecurityError as exc:
            return {"ok": False, "message": str(exc), "items": [], "last_sync_at": ""}
        except Exception as exc:  # noqa: BLE001 - 单连接器失败不崩服务
            logger.warning("[custom_http] sync 异常: %s", exc)
            return {
                "ok": False,
                "message": f"同步失败: {exc}",
                "items": [],
                "last_sync_at": "",
            }
        from datetime import UTC, datetime

        return {
            "ok": True,
            "message": f"同步 {len(result.get('items') or [])} 条",
            "items": result.get("items") or [],
            "last_sync_at": datetime.now(UTC).isoformat(),
        }

    async def fetch_document(self, doc_id: str) -> dict[str, Any]:
        """用 fetch 能力操作拉单条正文(参数名按路径占位符自动匹配)。"""
        op = self._pick("fetch")
        if op is None:
            return _doc_fail("该连接器没有 fetch 操作")
        names = path_param_names(op.path)
        if len(names) != 1:
            return _doc_fail("fetch 操作必须且只能有一个路径占位符")
        try:
            result = await self._execute(op, {names[0]: doc_id})
        except (ConnectorExecutionError, ConnectorSecurityError) as exc:
            return _doc_fail(str(exc))
        except Exception as exc:  # noqa: BLE001
            logger.warning("[custom_http] fetch 异常: %s", exc)
            return _doc_fail(f"拉取失败: {exc}")
        content = str(result.get("content") or "")
        return {
            "ok": True,
            "title": doc_id,
            "content": content,
            "chars": len(content),
            "truncated": bool(result.get("truncated")),
            "message": f"正文 {len(content)} 字符",
        }


class _PartialFailure(ConnectorExecutionError):
    """上游业务失败(带状态码/响应体,供路由层回传脱敏信息)。"""

    def __init__(
        self,
        message: str,
        *,
        status: int,
        capability: str,
        operation_id: str,
        data: Any,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.capability = capability
        self.operation_id = operation_id
        self.data = data


def _doc_fail(message: str) -> dict[str, Any]:
    return {
        "ok": False,
        "title": "",
        "content": "",
        "chars": 0,
        "truncated": False,
        "message": message,
    }


# ============================================================================
# 统一接口(注册表按 CONNECTOR_TYPE 调用)
# ============================================================================


async def sync(record: dict[str, Any]) -> dict[str, Any]:
    """同步自定义连接器数据源。"""
    return await CustomHttpConnector(record).sync()


async def fetch_document(record: dict[str, Any], doc_id: str) -> dict[str, Any]:
    """拉取单条正文。"""
    return await CustomHttpConnector(record).fetch_document(doc_id)


async def invoke(
    record: dict[str, Any], operation_id: str, params: dict[str, Any] | None = None
) -> dict[str, Any]:
    """执行指定操作(路由层 /invoke 入口)。"""
    return await CustomHttpConnector(record).invoke(operation_id, params)


def audit_write(record: dict[str, Any], user_id: str, operation_id: str) -> None:
    """写操作审计埋点(只记元信息,不记凭据与请求体)。"""
    try:
        audit_log.record(
            "connector.action",
            actor=user_id,
            target=str(record.get("key") or ""),
            detail={"operation_id": operation_id, "type": record.get("type")},
        )
    except Exception as exc:  # noqa: BLE001 - 审计失败不阻断业务
        logger.warning("[custom_http] 审计埋点失败: %s", exc)


async def check_connection(record: dict[str, Any]) -> dict[str, Any]:
    """连通性自检:平台类换 token,自定义类查出站地址是否安全可达。

    不回传任何凭据;结果只含 ok/message。
    """
    spec = ConnectorSpec.from_dict(record.get("spec"))
    if not spec.base_url:
        return {"ok": False, "message": "未配置 base_url"}
    if spec.auth_kind in {"feishu_tenant", "wecom_corp", "dingtalk", "wechat_mp"}:
        try:
            await _platform_token(record, spec.auth_kind)
            return {"ok": True, "message": "平台令牌获取成功,凭据有效"}
        except ConnectorExecutionError as exc:
            return {"ok": False, "message": str(exc)}
    security_ok, security_msg = await check_url(
        spec.base_url, allow_private_hosts=spec.allow_private_hosts
    )
    if not security_ok:
        return {"ok": False, "message": security_msg}
    return {"ok": True, "message": "出站地址通过安全校验"}


# 供路由层做 URL 预校验(保存配置时提示用户,而不是等执行才报)
async def check_url(url: str, allow_private_hosts: bool = False) -> tuple[bool, str]:
    try:
        await validate_outbound_url(url, allow_private_hosts=allow_private_hosts)
    except ConnectorSecurityError as exc:
        return False, str(exc)
    return True, ""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
