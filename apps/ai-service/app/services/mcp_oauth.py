# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""MCP OAuth 授权与 Token 管理(对标 MCP OAuth 发现 / RFC 8414)。

面向新版 MCP Streamable HTTP 传输的 OAuth 能力:
- client_credentials 与 authorization_code 两种授权码流
- authorization server metadata 发现(RFC 8414 OAuth Authorization Server Metadata)
- Token 存取:内存 + 可选加密持久化(cryptography Fernet,失败降级)
- `Authorization: Bearer <token>` 注入
- 过期自动刷新(refresh_token),并发下用 asyncio.Lock 防"多刷新"
- 失败重试(幂等 POST,短退避)

设计约束:
- 纯后端、无 web 依赖;仅依赖 httpx + cryptography(均已列入 pyproject 依赖)
- 所有方法 async;持久化任何异常都降级为内存模式,不崩服务
  (风格对齐 mcp_store / mcp_directory)
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import secrets
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode, urlsplit

import httpx

logger = logging.getLogger(__name__)

# 默认超时(秒)
DEFAULT_OAUTH_TIMEOUT = 30.0
# 解析/刷新失败后的重试次数与初始退避
DEFAULT_RETRIES = 2
DEFAULT_RETRY_DELAY = 0.5
# 过期前多少秒视为已过期(留时钟/网络余量,避免飘在过期边界)
TOKEN_EXPIRY_SKEW = 60.0
# 授权码流的默认回调地址(MCP 规范常用于本地回环收集)
DEFAULT_REDIRECT_URI = "http://127.0.0.1:0/callback"


@dataclass
class MCPOAuthConfig:
    """MCP OAuth 客户端配置。

    两种 token endpoint 指定方式(二选一,优先 token_url):
    - token_url: 直接给 token 端点
    - auth_server_url: RFC 8414 的 authorization server metadata 端点,启动时发现
    """

    client_id: str = ""
    client_secret: str = ""
    # 授权方式:"client_credentials" 或 "authorization_code"
    grant_type: str = "client_credentials"
    token_url: str = ""
    # RFC 8414 metadata 端点(发现),与 token_url 二选一
    auth_server_url: str = ""
    scopes: list[str] = field(default_factory=list)
    redirect_uri: str = DEFAULT_REDIRECT_URI
    # 可选加密持久化路径(文件);为空则仅内存
    persist_path: str = ""


@dataclass
class MCPOAuthToken:
    """OAuth Token(不变对象,换新走新实例)。"""

    access_token: str = ""
    refresh_token: str = ""
    token_type: str = "Bearer"
    scope: str = ""
    expires_in: int = 3600
    obtained_at: float = field(default_factory=time.time)

    def is_expired(self, check_now: float | None = None) -> bool:
        """是否已过期(含 TOKEN_EXPIRY_SKEW 前移余量)。空 token 视为过期。"""
        if not self.access_token:
            return True
        now = time.time() if check_now is None else check_now
        return (now + TOKEN_EXPIRY_SKEW) > (self.obtained_at + self.expires_in)

    def to_dict(self) -> dict[str, Any]:
        """转可持久化字典。"""
        return {
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "token_type": self.token_type,
            "scope": self.scope,
            "expires_in": self.expires_in,
            "obtained_at": self.obtained_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> MCPOAuthToken:
        """从持久化字典恢复。"""
        return cls(
            access_token=str(data.get("access_token", "")),
            refresh_token=str(data.get("refresh_token", "")),
            token_type=str(data.get("token_type", "Bearer")),
            scope=str(data.get("scope", "")),
            expires_in=int(data.get("expires_in", 3600)),
            obtained_at=float(data.get("obtained_at", time.time())),
        )


class MCPOAuthError(Exception):
    """OAuth 流程异常(网络/端点/认证失败统一抛此类型)。"""


# ---------------------------------------------------------------------------
# OAuth localhost 回调守卫状态机(b75-4#1,2026-09-30 立)
# ---------------------------------------------------------------------------
# 吸收自上游 zcode auth/localhost-callback.ts:62-100 的守卫状态机,降维为本仓
# MCP OAuth 客户端域的纯 asyncio 实现(上游为 Node http server,一次性消费面
# 在 scripts/mcp_oauth_realnet_e2e.py 此前是无守卫的裸 HTTPServer 监听):
# - 陌生/不匹配 state 只回 HTTP 400 继续监听,不 kill 整个授权事务 —— 浏览器预取、
#   并发授权事务、残留旧授权 URL 的回调都会打到本监听,一个陌生 state 不得让
#   随后到达的正确回调再也无法成功;
# - provider 回 error=access_denied 即时失败,带稳定错误码 MCP_OAUTH_CALLBACK_DENIED,
#   不再等授权窗口超时;
# - state 匹配但 code/error 双缺失的畸形回调立即结构化失败,不消耗授权窗口。
# 调用方按 code/oauth_error 结构化字段区分「用户拒绝」与超时,不依赖错误文本。

MCP_OAUTH_CALLBACK_DENIED_ERROR_CODE = "MCP_OAUTH_CALLBACK_DENIED"

# 回调响应文案(与上游语义一致:成败都提示用户可关窗回到调用方)
_CALLBACK_SUCCESS_TEXT = "Authorization successful! You may close this window and return to the CLI."
_CALLBACK_FAILURE_TEXT = "Authorization failed. You may close this window and return to the CLI."
# 单连接读超时(秒):loopback 回调只读请求行+头部,超时即弃连接,防慢速连接占住 handler
_CALLBACK_READ_TIMEOUT = 10.0
# 头部行数上限(防畸形请求无限读)
_CALLBACK_MAX_HEADER_LINES = 100


class MCPOAuthCallbackDeniedError(MCPOAuthError):
    """授权服务器按 RFC 6749 §4.1.2.1 回传 `error` 时的结构化异常(稳定错误码)。"""

    def __init__(self, oauth_error: str, oauth_error_description: str | None = None) -> None:
        super().__init__(
            f"OAuth authorization was rejected by the authorization server: {oauth_error}"
        )
        self.code = MCP_OAUTH_CALLBACK_DENIED_ERROR_CODE
        self.oauth_error = oauth_error
        self.oauth_error_description = oauth_error_description


@dataclass
class MCPOAuthCallback:
    """守卫状态机成功结算的回调载荷。"""

    code: str
    url: str


class MCPLocalhostOAuthCallbackServer:
    """OAuth localhost 回调守卫状态机(纯 asyncio,监听 127.0.0.1)。

    判据(逐条对齐上游 localhost-callback.ts):
    - 回调路径不匹配 → HTTP 404,**继续监听**;
    - state 陌生/与本事务不匹配 → HTTP 400,**继续监听**(不 kill 授权事务);
    - state 匹配 + provider error → HTTP 400 + 立即失败(MCPOAuthCallbackDeniedError,
      稳定错误码 MCP_OAUTH_CALLBACK_DENIED);
    - state 匹配 + code/error 双缺 → HTTP 400 + 立即结构化失败(不消耗授权窗口);
    - state 匹配 + 有 code(authCode 兼容别名)→ HTTP 200 + 成功结算;
      此后重复回调不再改写结算结果(先到先得)。
    """

    def __init__(self, callback_path: str, state: str) -> None:
        self._callback_path = callback_path
        self._state = state
        self._settled = False
        self._done: asyncio.Future[MCPOAuthCallback] = (
            asyncio.get_running_loop().create_future()
        )
        self._server: asyncio.Server | None = None
        self._port = 0

    async def start(self) -> str:
        """启动监听(127.0.0.1 随机端口),返回完整回调 URL。"""
        self._server = await asyncio.start_server(self._handle_client, host="127.0.0.1", port=0)
        sock = self._server.sockets[0]
        self._port = int(sock.getsockname()[1])
        return f"http://127.0.0.1:{self._port}{self._callback_path}"

    async def wait_for_callback(self) -> MCPOAuthCallback:
        """等待本事务回调;守卫失败路径抛结构化异常,close() 未结算时也抛。"""
        return await self._done

    async def close(self) -> None:
        """关闭监听;未结算时以结构化失败收口,等待方不会永久悬挂。"""
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
            self._server = None
        self._settle_failure(MCPOAuthError("OAuth 回调监听已关闭,授权事务未完成"))

    # -- 内部:守卫状态机 --------------------------------------------------

    def _settle_success(self, callback: MCPOAuthCallback) -> None:
        if self._settled or self._done.done():
            return
        self._settled = True
        self._done.set_result(callback)

    def _settle_failure(self, error: Exception) -> None:
        if self._settled or self._done.done():
            return
        self._settled = True
        self._done.set_exception(error)

    @staticmethod
    async def _write_text(writer: asyncio.StreamWriter, status: int, message: str) -> None:
        reason = {200: "OK", 400: "Bad Request", 404: "Not Found"}.get(status, "OK")
        body = message.encode("utf-8")
        head = (
            f"HTTP/1.1 {status} {reason}\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            f"Content-Length: {len(body)}\r\n"
            "Connection: close\r\n\r\n"
        ).encode("latin-1")
        writer.write(head + body)
        await writer.drain()

    async def _handle_client(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ) -> None:
        try:
            try:
                request_line = await asyncio.wait_for(reader.readline(), _CALLBACK_READ_TIMEOUT)
                for _ in range(_CALLBACK_MAX_HEADER_LINES):
                    line = await asyncio.wait_for(reader.readline(), _CALLBACK_READ_TIMEOUT)
                    if line in (b"\r\n", b"\n", b""):
                        break
            except (TimeoutError, ConnectionError, OSError):
                return  # 连接层异常:不影响授权事务,继续监听
            segments = request_line.decode("latin-1").split(" ")
            if len(segments) < 2:
                await self._write_text(writer, 400, _CALLBACK_FAILURE_TEXT)
                return  # 畸形请求行:回 400 继续监听,不 kill 事务
            parts = urlsplit(segments[1])
            if parts.path != self._callback_path:
                await self._write_text(writer, 404, _CALLBACK_FAILURE_TEXT)
                return
            params = parse_qs(parts.query)
            state = (params.get("state") or [""])[0]
            if state != self._state:
                # 陌生/不匹配 state:浏览器预取/并发事务/残留旧授权 URL 的回调。
                # 只回 400,不 kill 本授权事务,继续等待真回调(b75-4#1 判据①)。
                await self._write_text(writer, 400, _CALLBACK_FAILURE_TEXT)
                return
            oauth_error = (params.get("error") or [""])[0]
            if oauth_error:
                # state 匹配说明确实是本事务的授权响应;用户点「拒绝」时授权服务器回
                # error=access_denied,立即失败,不再等窗口超时(b75-4#1 判据②)。
                await self._write_text(writer, 400, _CALLBACK_FAILURE_TEXT)
                desc_list = params.get("error_description")
                description = desc_list[0] if desc_list else None
                self._settle_failure(MCPOAuthCallbackDeniedError(oauth_error, description))
                return
            code = (params.get("code") or [""])[0] or (params.get("authCode") or [""])[0]
            if not code:
                # state 匹配但既无 code 也无 error:授权响应不合法,本事务不可能成功,
                # 直接失败,不消耗剩余授权窗口(b75-4#1 判据③)。
                await self._write_text(writer, 400, _CALLBACK_FAILURE_TEXT)
                self._settle_failure(
                    MCPOAuthError("OAuth callback is missing an authorization code.")
                )
                return
            await self._write_text(writer, 200, _CALLBACK_SUCCESS_TEXT)
            self._settle_success(
                MCPOAuthCallback(code=code, url=f"http://127.0.0.1:{self._port}{segments[1]}")
            )
        except Exception as e:  # noqa: BLE001 - handler 异常不逃逸(asyncio 仆从任务)
            logger.warning("OAuth 回调守卫 handler 异常: %s", e)
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:  # noqa: BLE001 - 连接已被对端断开等,不影响事务
                pass


def _backup_corrupt_persist_file(path: Path) -> None:
    """b75-4#2:凭据文件损坏先备份留证,绝不静默覆盖重置。

    上游机制(auth/shared-credentials.ts backupCorruptFile)降维:损坏文件 rename 到
    .corrupt-<毫秒时间戳> 隔离(留证不删),后续成功写入从干净状态开始,取证现场
    保留在备份里。备份失败只告警,不阻断降级路径。
    """
    try:
        backup = path.with_name(f"{path.name}.corrupt-{int(time.time() * 1000)}")
        path.rename(backup)
        logger.warning("OAuth 持久化 Token 文件损坏,已备份到 %s 后降级内存模式", backup)
    except Exception as e:  # noqa: BLE001 - 备份失败不影响降级语义
        logger.warning("OAuth 持久化 Token 文件损坏且备份失败: %s", e)


def _load_persisted_token(config: MCPOAuthConfig) -> MCPOAuthToken | None:
    """从持久化文件读取 Token(加密/明文二选一);失败返回 None 不报错。"""
    if not config.persist_path:
        return None
    try:
        path = Path(config.persist_path)
        if not path.exists():
            return None
        raw = path.read_text(encoding="utf-8").strip()
        if not raw:
            return None
        # 优先加密读取:环境变量 MCP_OAUTH_ENCRYPTION_KEY 提供 Fernet key
        from cryptography.fernet import Fernet

        key = os.environ.get("MCP_OAUTH_ENCRYPTION_KEY", "")
        if key:
            data = json.loads(Fernet(key.encode()).decrypt(raw.encode("utf-8")).decode("utf-8"))
        else:
            data = json.loads(raw)
        return MCPOAuthToken.from_dict(data)
    except Exception as e:  # noqa: BLE001 - 任何异常降级内存模式
        logger.warning("读持久化 OAuth Token 失败(降级内存): %s", e)
        # b75-4#2:内容层损坏(解密/解析失败)先备份留证再返回 None —— 若不备份,
        # 后续成功的写入会静默覆盖掉取证现场(上游 backupCorruptFile 判据)。
        # 文件不存在等非损坏路径在上面已提前返回,不会走到这里。
        try:
            if Path(config.persist_path).exists():
                _backup_corrupt_persist_file(Path(config.persist_path))
        except Exception:  # noqa: BLE001 - 备份探测失败不影响降级语义
            pass
        return None


def _persist_token(config: MCPOAuthConfig, token: MCPOAuthToken) -> None:
    """把 Token 写入持久化文件(加密/明文);失败仅记日志,不影响主流程。"""
    if not config.persist_path:
        return
    try:
        from cryptography.fernet import Fernet

        path = Path(config.persist_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(token.to_dict(), ensure_ascii=False)
        key = os.environ.get("MCP_OAUTH_ENCRYPTION_KEY", "")
        content = (
            Fernet(key.encode()).encrypt(payload.encode("utf-8")).decode("utf-8")
            if key
            else payload
        )
        tmp_path = path.with_name(
            f"{path.name}.tmp-{os.getpid()}-{uuid.uuid4().hex[:8]}"
        )
        # b75-4#2:tmp 名带 pid+随机后缀,不再共用固定 .json.tmp —— 并发写方各自
        # 独立 tmp 后原子 replace,杜绝两写方在同一 tmp 上交错产生半截文件;
        # 最终一致语义为"最后完成者胜"(Token 缓存可容忍)。
        tmp_path.write_text(content, encoding="utf-8")
        tmp_path.replace(path)
    except Exception as e:  # noqa: BLE001 - 持久化失败只告警,不崩主流程
        logger.warning("写持久化 OAuth Token 失败: %s", e)


class MCPOAuthClient:
    """OAuth Token 获取 / 刷新 / 注入管理器。"""

    def __init__(self, config: MCPOAuthConfig) -> None:
        self._config = config
        self._client = httpx.AsyncClient(timeout=DEFAULT_OAUTH_TIMEOUT)
        # 并发防抖:多个 await get_token() 同时触发时只有首个真正刷新
        self._lock = asyncio.Lock()
        self._token: MCPOAuthToken | None = None
        # 授权码流:授权成功回调后注入的授权码
        self._authorization_code: str | None = None
        self._state: str = ""
        # PKCE(code_verifier),构建授权 URL 时生成,换 code 时回传
        self._code_verifier: str | None = None
        # 从持久化恢复(是否过期交给 get_token 判定)
        if config.persist_path:
            restored = _load_persisted_token(config)
            if restored is not None:
                self._token = restored

    # ------------------------------------------------------------------
    # 发现与端点
    # ------------------------------------------------------------------

    async def _resolve_token_url(self) -> str:
        """解析 token endpoint:优先 config.token_url,否则走 metadata 发现。"""
        if self._config.token_url:
            return self._config.token_url
        if not self._config.auth_server_url:
            raise MCPOAuthError("未配置 token_url 或 auth_server_url")
        try:
            resp = await self._client.get(self._config.auth_server_url)
            resp.raise_for_status()
            md = resp.json()
        except MCPOAuthError:
            raise
        except Exception as e:
            raise MCPOAuthError(f"authorization server metadata 拉取失败: {e}") from e
        token_url = md.get("token_endpoint") if isinstance(md, dict) else None
        if not token_url:
            raise MCPOAuthError("metadata 中缺少 token_endpoint")
        return str(token_url)

    async def _resolve_authorization_url(self) -> str:
        """解析 authorization endpoint(授权码流跳转用)。"""
        if not self._config.auth_server_url:
            raise MCPOAuthError("authorization_code 流需要 auth_server_url 做发现")
        resp = await self._client.get(self._config.auth_server_url)
        resp.raise_for_status()
        md = resp.json()
        auth_url = md.get("authorization_endpoint") if isinstance(md, dict) else None
        if not auth_url:
            raise MCPOAuthError("metadata 中缺少 authorization_endpoint")
        return str(auth_url)

    def _scope_param(self) -> str:
        return " ".join(self._config.scopes)

    # ------------------------------------------------------------------
    # 获取 / 刷新
    # ------------------------------------------------------------------

    def set_authorization_code(self, code: str, state: str = "") -> None:
        """注入授权码流获得的 code(授权成功回调时调用)。

        b75-4#1 state 会话绑定守卫:本客户端经 build_authorization_url_async 发起
        授权事务后持有 _state(此前为自证缺陷"state 无会话绑定校验",见
        scan_login.py 同类探针结论);调用方携带与事务不匹配的 state 注入视为
        伪造/串线回调 —— 拒绝注入且**不消耗本事务**(保留 _state 与既有 code,
        真回调仍可继续注入)。state 缺省时保持旧宽松行为以兼容既有调用方;
        强制绑定的执法点在 MCPLocalhostOAuthCallbackServer 守卫状态机。
        """
        if state and self._state and state != self._state:
            raise MCPOAuthError("OAuth 回调 state 与本授权事务不匹配,已拒绝注入(事务保持等待)")
        self._authorization_code = code
        # 换新码后作废旧 token,确保下次 get_token 走授权码交换
        self._token = None

    async def build_authorization_url_async(self) -> str:
        """构造授权端点跳转 URL(授权码流),返回完整鉴权 URL,由外部引导用户访问。

        启用 PKCE(RFC 7636):
        - 生成随机 code_verifier(URL-safe,43~128 字符),S256 派生 code_challenge
        - 将 code_challenge / code_challenge_method 加入授权 URL
        - 保存 code_verifier,待授权码回调后换 token 时回传(见 fetch_token)
        """
        auth_url = await self._resolve_authorization_url()
        state = secrets.token_urlsafe(16)
        self._state = state
        # PKCE:code_verifier 需 [A-Za-z0-9-._~],token_urlsafe(48) 满足且足够的熵
        code_verifier = secrets.token_urlsafe(48)
        self._code_verifier = code_verifier
        digest = hashlib.sha256(code_verifier.encode("utf-8")).digest()
        code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
        query = urlencode({
            "response_type": "code",
            "client_id": self._config.client_id,
            "redirect_uri": self._config.redirect_uri,
            "scope": self._scope_param(),
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        })
        sep = "&" if "?" in auth_url else "?"
        return f"{auth_url}{sep}{query}"

    async def _request_token(self, form: dict[str, str]) -> MCPOAuthToken:
        """POST token 端点并解析/保存 Token(含失败重试)。"""
        token_url = await self._resolve_token_url()
        last_err: Exception | None = None
        for attempt in range(DEFAULT_RETRIES + 1):
            if attempt:
                await asyncio.sleep(DEFAULT_RETRY_DELAY * (2 ** (attempt - 1)))
            try:
                resp = await self._client.post(
                    token_url,
                    data=form,
                    headers={"Accept": "application/json"},
                )
                if resp.status_code >= 400:
                    detail = ""
                    try:
                        detail = str(resp.json().get("error_description", resp.text))
                    except Exception:  # noqa: BLE001 - 降级用响应原文
                        detail = resp.text[:200]
                    last_err = MCPOAuthError(f"token 端点返回 {resp.status_code}: {detail}")
                    continue
                data = resp.json()
            except MCPOAuthError:
                raise
            except Exception as e:
                last_err = e
                continue
            if not isinstance(data, dict) or "access_token" not in data:
                last_err = MCPOAuthError("token 响应缺少 access_token")
                continue
            token = MCPOAuthToken(
                access_token=str(data["access_token"]),
                refresh_token=str(data.get("refresh_token", "")),
                token_type=str(data.get("token_type", "Bearer")),
                scope=str(data.get("scope", self._scope_param())),
                expires_in=int(data.get("expires_in", 3600)),
                obtained_at=time.time(),
            )
            self._token = token
            _persist_token(self._config, token)
            return token
        # 全部重试失败
        raise MCPOAuthError(f"获取 token 失败: {last_err}") from last_err

    async def fetch_token(self) -> MCPOAuthToken:
        """主动获取全新 Token(client_credentials 或 authorization_code)。"""
        if self._config.grant_type == "authorization_code":
            code = self._authorization_code
            if not code:
                raise MCPOAuthError("authorization_code 流缺少 code,请先 set_authorization_code")
            form: dict[str, str] = {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self._config.redirect_uri,
                "client_id": self._config.client_id,
                "client_secret": self._config.client_secret,
            }
            # PKCE:构建授权 URL 时已生成 code_verifier 则一并回传(RFC 7636)
            if self._code_verifier:
                form["code_verifier"] = self._code_verifier
        else:
            # 默认 client_credentials
            form = {
                "grant_type": "client_credentials",
                "client_id": self._config.client_id,
                "client_secret": self._config.client_secret,
            }
            scope = self._scope_param()
            if scope:
                form["scope"] = scope
        return await self._request_token(form)

    async def _refresh(self) -> MCPOAuthToken:
        """用 refresh_token 刷新 Token。"""
        if self._token is None or not self._token.refresh_token:
            # 无 refresh_token 无法刷新,回退全量获取
            return await self.fetch_token()
        form: dict[str, str] = {
            "grant_type": "refresh_token",
            "refresh_token": self._token.refresh_token,
            "client_id": self._config.client_id,
            "client_secret": self._config.client_secret,
        }
        return await self._request_token(form)

    async def get_token(self) -> MCPOAuthToken:
        """返回有效 Token,过期自动刷新;并发安全(asyncio.Lock 防多刷新)。

        获取策略:
        1. 已有未过期 token → 直接复用
        2. 有过期 token 且有 refresh_token → 刷新
        3. 否则全量获取(fetch_token)
        """
        async with self._lock:
            if self._token is not None and not self._token.is_expired():
                return self._token
            if self._token is not None and self._token.refresh_token:
                try:
                    return await self._refresh()
                except MCPOAuthError:
                    logger.warning("refresh_token 刷新失败,回退全量获取")
            return await self.fetch_token()

    async def close(self) -> None:
        """释放底层 httpx 连接。"""
        await self._client.aclose()

    # ------------------------------------------------------------------
    # 注入
    # ------------------------------------------------------------------

    def access_token(self) -> str:
        """当前 access_token(可能为空/过期,配合 get_token 使用)。"""
        return self._token.access_token if self._token is not None else ""

    def inject(self, headers: dict[str, str]) -> dict[str, str]:
        """把 Bearer 注入副本并返回;无 token 时返回原字典副本。"""
        result = dict(headers)
        if self._token is not None and self._token.access_token:
            result["Authorization"] = (
                f"{self._token.token_type or 'Bearer'} {self._token.access_token}"
            )
        return result
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
