# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""能力门禁(Capability Gate)— MCP 执行面的凭据解析与工具级 scope 裁决。

「Agent 全面开放工程」O1 落地(2026-09-20):
- 关闭 /api/mcp 匿名后门:所有 MCP 请求必须先解析出 Principal;
- 工具级 scope 门禁:tools/call 前查能力清单(capabilities.json 的 toolScopeMap),
  Principal 的 scopes 必须包含该工具所需 scope;
- 身份透传:Principal.role/sub 透传给 mcp_server.call_tool(替代硬编码 user_role=0)。

三类凭据(任一通过即返回 Principal):
a. ``Authorization: Bearer <IHUI JWT>`` — 复用 app.core.jwt_auth.verify_access_token;
b. 内网可信头 ``X-IHUI-Principal: v1.<base64url(json)>.<hex hmac>`` —
   HMAC-SHA256(secret, "v1."+base64url),密钥 settings.ihui_principal_secret,
   回退 settings.ai_callback_secret;payload={sub,role,scopes[],apiKeyId?,exp};
   校验 exp(时钟偏容忍 5 秒)与 role>=0,签名比较用 hmac.compare_digest;
c. ``X-Api-Key`` / ``ihui_`` 前缀 Bearer — **不在本服务校验**,一律 401 并提示
   走 apps/api 的 /v1/mcp/* 通道(避免双实现密钥逻辑)。

fail-safe:能力清单(packages/types/generated/capabilities.json)缺失时——
- 内网 principal 头 / 本地开发回退 principal:维持现网行为,由
  mcp_server._ADMIN_ONLY_TOOLS 权限矩阵兜底;
- JWT 等外部凭据:tools/call 一律拒绝(默认拒绝,而非默认放行)。

platform/critical scope(如 computer:operate / sandbox:run)含 apiKeyId 的
机器凭据通道**永不**放行(dataClass=platform 或 thirdPartyEligible=false)。

O9「MCP server 协议完整化」(2026-09-21)在本文件**新增**(不改上述任何函数语义):

- 资源级 scope 登记表 ``RESOURCE_SCOPES`` / ``scope_of_resource()`` —— resources/read
  与 export 侧资源视图共用一张表,避免两端各搓一份映射;
- 工具注解推导 ``annotation_hints_for_tool()`` —— MCP ``ToolAnnotations`` 的
  readOnlyHint/destructiveHint/idempotentHint/openWorldHint 一律**由能力目录**
  (dataClass / risk / domain / idempotencyRequired)推导,两端输出必然一致,
  测试据此反查防漂移;
- 机器凭据限流 ``RateProfile`` / ``MachineKeyRateLimiter`` / ``enforce_rate_limit()`` ——
  档位取自 capabilities.json 的 rateProfiles(等价 TS 侧 ``rateProfileOf(scope)``),
  形态复用应用层已有令牌桶(``app.middleware.input_sanitizer.TokenBucket``);
- 工具集版本与变更广播登记 ``tools_revision()`` / ``refresh_tools_revision()`` ——
  带内层(mcp_official)与 transport 层(mcp_export)共用一个计数器,export 侧注册
  监听器把它接到真实 SSE / streamable 会话与 SubscriptionBus。

上述四项都是"执行面共享事实",故落在本模块;两端各自的协议帧格式仍留在各端点文件。
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import dataclasses
import hashlib
import hmac
import json
import logging
import os
import re
import time
from collections.abc import Awaitable, Callable, Iterable
from contextlib import suppress
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Final, Literal

from app.core.config import settings
from app.core.jwt_auth import verify_access_token
from app.middleware.input_sanitizer import TokenBucket

if TYPE_CHECKING:
    from collections.abc import Mapping

    from fastapi import Request

logger = logging.getLogger(__name__)

PRINCIPAL_HEADER_NAME: Final = "X-IHUI-Principal"
API_KEY_HEADER_NAME: Final = "X-Api-Key"
PRINCIPAL_HEADER_PREFIX: Final = "v1"
# exp 校验的时钟偏容忍(秒)
CLOCK_SKEW_TOLERANCE_S: Final = 5.0
# 通配 scope:代表"该主体已按用户身份认证,scope 由角色矩阵兜底"
ALL_SCOPES: Final = "*"

_B64URL_RE: Final = re.compile(r"[A-Za-z0-9_-]+")
_HEX64_RE: Final = re.compile(r"[0-9a-fA-F]{64}")

_API_KEY_HINT: Final = (
    "API key 不能直连 ai-service,请调用 apps/api 的 /v1/mcp/* 网关(由其对 key "
    "校验并签发内网 X-IHUI-Principal 头转发)"
)


class PrincipalAuthError(Exception):
    """凭据缺失/无效 → HTTP 401 {code,message}。绝不携带 token 明文。"""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.http_status = 401
        self.code = 401
        self.message = message


class ScopeDeniedError(Exception):
    """scope 不足 / manifest 缺失下的外部拒绝 → HTTP 403 结构化响应。"""

    def __init__(
        self, message: str, required_scope: str | None, *, error_code: str = "SCOPE_DENIED"
    ) -> None:
        super().__init__(message)
        self.http_status = 403
        self.code = 403
        self.message = message
        self.error_code = error_code
        self.required_scope = required_scope

    def to_body(self) -> dict[str, object]:
        return {
            "code": self.code,
            "message": self.message,
            "errorCode": self.error_code,
            "requiredScope": self.required_scope,
        }


class RateLimitExceeded(Exception):
    """机器凭据通道超出 rateProfile 配额 → HTTP 429 / 带内 JSON-RPC error。

    与 ``ScopeDeniedError`` 同一表达口径:传输层给 HTTP 状态,带内(JSON-RPC/MCP)给
    error 体 + 结构化裁决数据(``retryAfterMs`` 供客户端退避)。
    """

    def __init__(
        self,
        message: str,
        scope: str | None,
        *,
        retry_after_s: float,
        error_code: str = "RATE_LIMITED",
    ) -> None:
        super().__init__(message)
        self.http_status = 429
        self.code = 429
        self.message = message
        self.error_code = error_code
        self.scope = scope
        self.retry_after_s = max(0.0, float(retry_after_s))

    def to_body(self) -> dict[str, object]:
        return {
            "code": self.code,
            "message": self.message,
            "errorCode": self.error_code,
            "scope": self.scope,
            "retryAfterMs": int(self.retry_after_s * 1000),
        }


@dataclass(frozen=True)
class Principal:
    """一次 MCP 调用解析出的调用主体。"""

    kind: Literal["jwt", "internal", "dev-anonymous"]
    sub: str | None
    role: int
    scopes: frozenset[str]
    api_key_id: str | None = None

    @property
    def is_machine_channel(self) -> bool:
        """机器凭据通道:内网头但由 API key 派生(payload 携带 apiKeyId)。"""
        return self.kind == "internal" and self.api_key_id is not None

    def has_scope(self, scope: str) -> bool:
        return ALL_SCOPES in self.scopes or scope in self.scopes


# ---------------------------------------------------------------------------
# 内网可信头 X-IHUI-Principal
# ---------------------------------------------------------------------------


def principal_secret() -> str:
    """内网头 HMAC 密钥:IHUI_PRINCIPAL_SECRET,回退 AI_CALLBACK_SECRET。"""
    return settings.ihui_principal_secret or settings.ai_callback_secret


def _encode_b64url(payload: Mapping[str, object]) -> str:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def build_principal_header(
    *,
    sub: str,
    role: int,
    scopes: list[str],
    exp: float,
    api_key_id: str | None = None,
    secret: str | None = None,
) -> str:
    """按对端契约生成 X-IHUI-Principal 头值(供 apps/api 侧/测试复用)。"""
    payload: dict[str, object] = {"sub": sub, "role": role, "scopes": scopes, "exp": exp}
    if api_key_id is not None:
        payload["apiKeyId"] = api_key_id
    b64 = _encode_b64url(payload)
    signing_key = secret if secret is not None else principal_secret()
    sig = hmac.new(
        signing_key.encode("utf-8"), f"{PRINCIPAL_HEADER_PREFIX}.{b64}".encode(), hashlib.sha256
    ).hexdigest()
    return f"{PRINCIPAL_HEADER_PREFIX}.{b64}.{sig}"


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def _parse_principal_payload(b64: str) -> tuple[Principal | None, str | None]:
    """解码并校验 payload;返回 (Principal|None, 拒绝原因)。原因不含任何明文密钥。"""
    try:
        decoded: object = json.loads(_b64url_decode(b64).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, binascii.Error):
        return None, "payload 非法(base64url/JSON 解析失败)"
    if not isinstance(decoded, dict):
        return None, "payload 不是 JSON 对象"
    data: dict[str, object] = dict(decoded)

    sub_raw = data.get("sub")
    if not isinstance(sub_raw, str) or not sub_raw:
        return None, "payload.sub 缺失或非字符串"
    role_raw = data.get("role")
    if isinstance(role_raw, bool) or not isinstance(role_raw, int):
        return None, "payload.role 缺失或非整数"
    if role_raw < 0:
        return None, "payload.role 为负"
    scopes_raw = data.get("scopes")
    if not isinstance(scopes_raw, list) or not all(isinstance(s, str) for s in scopes_raw):
        return None, "payload.scopes 缺失或类型非法"
    exp_raw = data.get("exp")
    if isinstance(exp_raw, bool) or not isinstance(exp_raw, (int, float)):
        return None, "payload.exp 缺失或非数值"
    if time.time() > float(exp_raw) + CLOCK_SKEW_TOLERANCE_S:
        return None, "payload.exp 已过期"
    key_raw = data.get("apiKeyId")
    api_key_id: str | None = key_raw if isinstance(key_raw, str) and key_raw else None

    return (
        Principal(
            kind="internal",
            sub=sub_raw,
            role=role_raw,
            scopes=frozenset(scopes_raw),
            api_key_id=api_key_id,
        ),
        None,
    )


def verify_principal_header(value: str) -> Principal | None:
    """校验 X-IHUI-Principal 头(签名/exp/role),失败返回 None。"""
    secret = principal_secret()
    if not secret:
        logger.warning("[capability_gate] 内网 principal 密钥未配置(IHUI_PRINCIPAL_SECRET/AI_CALLBACK_SECRET 均为空),拒绝内网头")
        return None
    parts = value.split(".")
    if len(parts) != 3 or parts[0] != PRINCIPAL_HEADER_PREFIX:
        logger.warning("[capability_gate] principal 头格式非法(段数/前缀不符)")
        return None
    _, b64, sig = parts
    if not _B64URL_RE.fullmatch(b64) or not _HEX64_RE.fullmatch(sig):
        logger.warning("[capability_gate] principal 头字符集非法")
        return None
    expected = hmac.new(
        secret.encode("utf-8"),
        f"{PRINCIPAL_HEADER_PREFIX}.{b64}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        logger.warning("[capability_gate] principal 头签名校验失败")
        return None
    principal, reason = _parse_principal_payload(b64)
    if principal is None:
        logger.warning("[capability_gate] principal payload 校验失败: %s", reason)
    return principal


# ---------------------------------------------------------------------------
# JWT 通道
# ---------------------------------------------------------------------------


def principal_from_jwt(token: str) -> Principal | None:
    """用共享 secret 校验 IHUI JWT(复用 jwt_auth.verify_access_token,不重写)。"""
    payload = verify_access_token(token)
    if payload is None:
        return None
    sub = payload.get("sub") or payload.get("userId")
    role_raw = payload.get("roleId", 0)
    role = role_raw if isinstance(role_raw, int) and not isinstance(role_raw, bool) else 0
    scopes_claim = payload.get("scopes")
    scopes: frozenset[str]
    if isinstance(scopes_claim, list) and all(isinstance(s, str) for s in scopes_claim):
        # 用户 JWT 默认全量 scope(数据边界由 role + user_id 透传 + 权限矩阵兜底);
        # 若 claim 显式携带 scopes 则收紧到显式集合。
        scopes = frozenset(scopes_claim)
    else:
        scopes = frozenset({ALL_SCOPES})
    return Principal(kind="jwt", sub=sub if isinstance(sub, str) else None, role=role, scopes=scopes)


# ---------------------------------------------------------------------------
# 凭据解析(FastAPI 依赖)
# ---------------------------------------------------------------------------

_dev_fallback_warned = False


def _dev_fallback_principal() -> Principal:
    """本地开发回退:未配置任何凭据且非生产环境 → role 0 匿名主体。

    与 JWTAuthMiddleware 的「开发环境 + jwt_secret 为空 → 跳过」同一信任模型;
    生产环境(node_env=production)永不走此分支。
    """
    global _dev_fallback_warned
    if not _dev_fallback_warned:
        _dev_fallback_warned = True
        logger.warning(
            "[capability_gate] MCP 请求无凭据,非生产环境按本地开发回退放行"
            "(role=0,权限矩阵兜底);生产部署必须配置凭据通道"
        )
    return Principal(kind="dev-anonymous", sub=None, role=0, scopes=frozenset({ALL_SCOPES}))


def resolve_principal_from_headers(headers: Mapping[str, str]) -> Principal:
    """从请求头解析 Principal;任一失败抛 PrincipalAuthError(401,不落明文)。

    HTTP 头名大小写不敏感(starlette 传入的是小写),统一归一小写后再判定,
    否则 `X-Api-Key` 这类机器凭据会绕过提示分支被当成匿名。
    """
    lowered: dict[str, str] = {k.lower(): v for k, v in headers.items()}
    if lowered.get(API_KEY_HEADER_NAME.lower()):
        raise PrincipalAuthError(_API_KEY_HINT)
    raw_principal = lowered.get(PRINCIPAL_HEADER_NAME.lower())
    if raw_principal:
        principal = verify_principal_header(raw_principal)
        if principal is None:
            raise PrincipalAuthError("内网凭据(X-IHUI-Principal)校验失败")
        return principal
    auth = lowered.get("authorization") or ""
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
        if token.startswith("ihui_"):
            raise PrincipalAuthError(_API_KEY_HINT)
        jwt_principal = principal_from_jwt(token)
        if jwt_principal is None:
            raise PrincipalAuthError("Invalid or expired token")
        return jwt_principal
    if settings.node_env == "production":
        raise PrincipalAuthError("Authentication required")
    return _dev_fallback_principal()


async def resolve_principal(request: Request) -> Principal:
    """FastAPI 依赖:解析 MCP 调用主体。

    优先消费 JWTAuthMiddleware 已注入的 request.state.principal(避免二次验签);
    中间件未运行(如内网直连/单测直挂路由)时自行从请求头解析。
    """
    state_principal = getattr(request.state, "principal", None)
    if isinstance(state_principal, Principal):
        return state_principal
    header_map: dict[str, str] = dict(request.headers.items())
    return resolve_principal_from_headers(header_map)


def resolve_principal_from_request(request: Request | None) -> Principal:
    """从一个**可能不存在**的 HTTP 请求解析 Principal(供 MCP export 传输层复用)。

    MCP SDK 的 call_tool 上下文里 `request` 仅 HTTP transport(SSE 的 /messages/
    POST、streamable 的 POST)才有;stdio 恒为 None。故 None 按"无凭据请求"处理:
    生产 401,本地开发走既有回退主体 —— 而不是静默放行匿名调用。

    这里刻意做成"显式入参 → 显式返回",不用 contextvar:官方 SDK 在 SSE 下把
    JSON-RPC 消息投给后台任务处理,隐式上下文届时可能已经不在同一请求上。
    """
    headers: Mapping[str, str] = dict(request.headers) if request is not None else {}
    return resolve_principal_from_headers(headers)


# ---------------------------------------------------------------------------
# 能力清单(capabilities.json)
# ---------------------------------------------------------------------------

DEFAULT_MANIFEST_REL_PATH: Path = Path("packages") / "types" / "generated" / "capabilities.json"


@dataclass(frozen=True)
class ScopeMeta:
    data_class: str
    risk: str
    third_party_eligible: bool
    # O9 追加(带默认值 → 既有构造点零改动):注解推导与限流都要用到域与幂等要求。
    domain: str = ""
    idempotency_required: bool = False


@dataclass(frozen=True)
class RateProfile:
    """一个风险档的配额(与 packages/types 的 ``rateProfileOf(scope)`` 同义)。"""

    rpm: int
    burst: int
    daily_calls: int
    concurrent: int
    max_duration_ms: int

    @property
    def refill_per_second(self) -> float:
        return max(self.rpm, 1) / 60.0


@dataclass(frozen=True)
class CapabilityManifest:
    tool_scope: dict[str, str]
    scope_meta: dict[str, ScopeMeta]
    # risk -> 配额档(capabilities.json 顶层 rateProfiles)。缺省空 = 未知档不回退放行。
    rate_profiles: dict[str, RateProfile] = field(default_factory=dict)


def _default_manifest_path() -> Path:
    # <root>/apps/ai-service/app/services/capability_gate.py → parents[4] = repo root
    return Path(__file__).resolve().parents[4] / DEFAULT_MANIFEST_REL_PATH


def manifest_file() -> Path:
    env_path = os.environ.get("CAPABILITY_MANIFEST_PATH") or settings.capability_manifest_path
    return Path(env_path) if env_path else _default_manifest_path()


def _parse_manifest(raw: object) -> CapabilityManifest | None:
    if not isinstance(raw, dict):
        return None
    data: dict[str, object] = dict(raw)
    tool_scope_raw = data.get("toolScopeMap")
    caps_raw = data.get("capabilities")
    if not isinstance(tool_scope_raw, dict) or not isinstance(caps_raw, list):
        return None
    tool_scope: dict[str, str] = {}
    for k, v in tool_scope_raw.items():
        if isinstance(k, str) and isinstance(v, str):
            tool_scope[k] = v
    scope_meta: dict[str, ScopeMeta] = {}
    for entry in caps_raw:
        if not isinstance(entry, dict):
            continue
        item: dict[str, object] = dict(entry)
        scope = item.get("scope")
        if not isinstance(scope, str):
            continue
        data_class = item.get("dataClass")
        risk = item.get("risk")
        eligible = item.get("thirdPartyEligible")
        domain = item.get("domain")
        idem_required = item.get("idempotencyRequired")
        scope_meta[scope] = ScopeMeta(
            data_class=data_class if isinstance(data_class, str) else "compute",
            risk=risk if isinstance(risk, str) else "critical",
            third_party_eligible=eligible if isinstance(eligible, bool) else False,
            domain=domain if isinstance(domain, str) else "",
            idempotency_required=idem_required if isinstance(idem_required, bool) else False,
        )
    # 顶层 rateProfiles: risk -> 配额档(与 rate 字段同源,清单生成器逐 capability 复制)
    profiles_raw = data.get("rateProfiles")
    rate_profiles: dict[str, RateProfile] = {}
    if isinstance(profiles_raw, dict):
        for risk_key, profile_raw in profiles_raw.items():
            if not isinstance(risk_key, str) or not isinstance(profile_raw, dict):
                continue
            profile: dict[str, object] = dict(profile_raw)
            rate_profiles[risk_key] = RateProfile(
                rpm=_as_int(profile.get("rpm"), 60),
                burst=_as_int(profile.get("burst"), 1),
                daily_calls=_as_int(profile.get("dailyCalls"), 10_000),
                concurrent=_as_int(profile.get("concurrent"), 1),
                max_duration_ms=_as_int(profile.get("maxDurationMs"), 60_000),
            )
    return CapabilityManifest(
        tool_scope=tool_scope, scope_meta=scope_meta, rate_profiles=rate_profiles
    )


def _as_int(raw: object, default: int) -> int:
    """JSON 数值 → int(bool 不算数值),异常值回默认而非放大配额。"""
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        return default
    return max(0, int(raw))


_manifest_cache: tuple[str, int, int, CapabilityManifest | None] | None = None


def load_capability_manifest() -> CapabilityManifest | None:
    """加载能力清单;文件缺失/解析失败返回 None(由调用方走 fail-safe 拒绝路径)。

    按 (路径, mtime, size) 缓存,清单被导出脚本重写后自动失效。
    """
    global _manifest_cache
    path = manifest_file()
    try:
        stat = path.stat()
    except OSError:
        _manifest_cache = None
        return None
    cache_key = (str(path), stat.st_mtime_ns, stat.st_size)
    if _manifest_cache is not None and _manifest_cache[:3] == cache_key:
        return _manifest_cache[3]
    try:
        parsed_raw: object = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeDecodeError) as e:
        logger.warning("[capability_gate] 能力清单读取失败(%s): %s", path, type(e).__name__)
        manifest = None
    else:
        manifest = _parse_manifest(parsed_raw)
        if manifest is None:
            logger.warning("[capability_gate] 能力清单结构非法: %s", path)
    _manifest_cache = (str(path), stat.st_mtime_ns, stat.st_size, manifest)
    return manifest


# ---------------------------------------------------------------------------
# 工具级 scope 裁决
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ToolAccessDecision:
    allowed: bool
    required_scope: str | None
    error_code: str | None
    message: str | None
    matrix_fallback: bool = False


def check_tool_access(principal: Principal, tool_name: str) -> ToolAccessDecision:
    """tools/call 前置裁决。

    - manifest 缺失:internal/dev(本地开发)按 _ADMIN_ONLY_TOOLS 矩阵执行(现网行为),
      JWT 等外部凭据一律拒绝;
    - manifest 存在:工具必须已登记(toolScopeMap),scope 必须在 principal.scopes 内;
      机器凭据通道(apiKeyId)对 platform dataClass / 非 thirdPartyEligible scope 永不放行。
    """
    manifest = load_capability_manifest()
    if manifest is None:
        if principal.kind == "jwt":
            return ToolAccessDecision(
                allowed=False,
                required_scope=None,
                error_code="SCOPE_DENIED",
                message="能力清单(capabilities.json)缺失,外部凭据的 tools/call 一律拒绝(fail-safe)",
            )
        return ToolAccessDecision(
            allowed=True, required_scope=None, error_code=None, message=None, matrix_fallback=True
        )
    scope = manifest.tool_scope.get(tool_name)
    if scope is None:
        return ToolAccessDecision(
            allowed=False,
            required_scope=None,
            error_code="TOOL_NOT_REGISTERED",
            message=f"工具 {tool_name} 未登记能力目录,默认拒绝",
        )
    if principal.is_machine_channel:
        meta = manifest.scope_meta.get(scope)
        if meta is not None and (
            meta.data_class == "platform" or not meta.third_party_eligible
        ):
            return ToolAccessDecision(
                allowed=False,
                required_scope=scope,
                error_code="SCOPE_DENIED",
                message=f"scope {scope} 属平台/高危通道,机器凭据(API key)永不放行",
            )
    if not principal.has_scope(scope):
        return ToolAccessDecision(
            allowed=False,
            required_scope=scope,
            error_code="SCOPE_DENIED",
            message=f"缺少所需 scope: {scope}",
        )
    return ToolAccessDecision(allowed=True, required_scope=scope, error_code=None, message=None)


def enforce_tool_access(principal: Principal, tool_name: str) -> ToolAccessDecision:
    """check_tool_access 的抛错版:**任何** not-allowed 都抛 403 结构化错误。

    未登记工具(TOOL_NOT_REGISTERED)同样拒绝 —— 否则"默认拒绝"会被静默绕过。
    """
    decision = check_tool_access(principal, tool_name)
    if not decision.allowed:
        raise ScopeDeniedError(
            decision.message or "工具调用被拒绝",
            decision.required_scope,
            error_code=decision.error_code or "SCOPE_DENIED",
        )
    return decision


def enforce_scope(principal: Principal, scope: str, *, resource_label: str) -> None:
    """资源级 scope 检查(resources/read 等):scope 不在集合内 → ScopeDeniedError。"""
    if principal.is_machine_channel:
        manifest = load_capability_manifest()
        meta = manifest.scope_meta.get(scope) if manifest is not None else None
        if meta is not None and (meta.data_class == "platform" or not meta.third_party_eligible):
            raise ScopeDeniedError(
                f"scope {scope} 属平台/高危通道,机器凭据永不放行({resource_label})", scope
            )
    if not principal.has_scope(scope):
        raise ScopeDeniedError(f"访问 {resource_label} 需要 scope: {scope}", scope)


# ---------------------------------------------------------------------------
# O9-A 资源级 scope 登记(resources/read 与资源视图共用)
# ---------------------------------------------------------------------------

#: 已登记 MCP 资源 URI → 读取所需 scope。
#: 未在此表出现的 URI(含 mcp_server.read_resource 里的 ``sampling://handler`` 这类
#: 内部实现细节)一律视为**未登记资源**,不得经 MCP 协议读出 —— 视图与裁决同源。
RESOURCE_SCOPES: Final[dict[str, str]] = {
    "memory://current": "memory:read",
    "skills://available": "skills:read",
    "config://agent": "connectors:read",
}


def scope_of_resource(uri: str) -> str | None:
    """资源 URI 所需 scope;None = 该 URI 未在 MCP 面登记(拒绝读取)。"""
    return RESOURCE_SCOPES.get(uri)


# ---------------------------------------------------------------------------
# O9-B 工具注解提示:一律由能力目录推导(两端一致 + 防漂移)
# ---------------------------------------------------------------------------

#: 封闭世界域:只与用户自有数据/本地资源打交道,不涉及外部实体。
#: 其余域(model/multimodal/web/execution/platform/agent/chat)都要出网或驱动真机,
#: 属开放世界 → openWorldHint=True。
CLOSED_WORLD_DOMAINS: Final[frozenset[str]] = frozenset(
    {"file", "memory", "knowledge", "codebase", "tool"}
)
#: 会改动自有/平台数据 → 允许破坏性(需显式 destructiveHint=True)。
MUTATING_DATA_CLASSES: Final[frozenset[str]] = frozenset({"scoped-write", "platform"})


@dataclass(frozen=True)
class ToolAnnotationHints:
    """MCP ``Tool.annotations`` 的四项行为提示(hint,不是授权依据)。"""

    read_only_hint: bool
    destructive_hint: bool
    idempotent_hint: bool
    open_world_hint: bool

    def as_wire(self) -> dict[str, bool]:
        """转 MCP 线格式(camelCase)。

        只读工具的 destructive/idempotent 按规范"仅在 read_only_hint=false 时有意义",
        故不输出(免得客户端把默认值当成服务端承诺)。
        """
        wire: dict[str, bool] = {"readOnlyHint": self.read_only_hint}
        if not self.read_only_hint:
            wire["destructiveHint"] = self.destructive_hint
            wire["idempotentHint"] = self.idempotent_hint
        wire["openWorldHint"] = self.open_world_hint
        return wire


def annotation_hints_for_tool(tool_name: str) -> ToolAnnotationHints | None:
    """按能力目录(dataClass / risk / domain / idempotencyRequired)推导工具注解提示。

    返回 None 的两种情况都是"如实不声明":能力目录缺失,或该工具未登记 scope
    (未登记的工具本就调不动,给它贴注解等于凭空承诺行为)。
    """
    manifest = load_capability_manifest()
    if manifest is None:
        return None
    scope = manifest.tool_scope.get(tool_name)
    meta = manifest.scope_meta.get(scope) if scope is not None else None
    if meta is None:
        return None
    read_only = meta.data_class == "scoped-read"
    destructive = (not read_only) and (
        meta.data_class in MUTATING_DATA_CLASSES or meta.risk in {"high", "critical"}
    )
    idempotent = (not read_only) and meta.idempotency_required and meta.data_class in MUTATING_DATA_CLASSES
    return ToolAnnotationHints(
        read_only_hint=read_only,
        destructive_hint=destructive,
        idempotent_hint=idempotent,
        open_world_hint=meta.domain not in CLOSED_WORLD_DOMAINS,
    )


# ---------------------------------------------------------------------------
# O9-C 机器凭据限流(rpm / burst / concurrent;档位 = rateProfileOf(scope))
# ---------------------------------------------------------------------------

#: 档位查不到时使用的兜底档(最严),避免"未知 scope"变成"不限流"。
_FALLBACK_PROFILE_NAME: Final = "critical"
#: 通配 scope 主体的连接级档位取最宽档(它单条命令仍受各自 scope 的带内闸约束)。
_LOOSEST_PROFILE_NAME: Final = "low"
#: transport 入口洪泛闸的桶名后缀(与 per-scope 桶隔离,互不串额度)。
TRANSPORT_BUCKET_SUFFIX: Final = "__transport__"


def rate_profile_for_scope(scope: str | None) -> RateProfile | None:
    """取 scope 的限流档(等价 TS 侧 ``rateProfileOf(scope)`` = RATE_PROFILES[entry.risk])。

    能力目录整体缺失 → None(调用方跳过限流:此时机器凭据的 tools/call 已被 fail-safe
    拒绝,限流无对象);scope 有档名但清单没带 rateProfiles → 回落到 critical 档。
    """
    manifest = load_capability_manifest()
    if manifest is None:
        return None
    meta = manifest.scope_meta.get(scope or "")
    risk = meta.risk if meta is not None else _FALLBACK_PROFILE_NAME
    profile = manifest.rate_profiles.get(risk)
    if profile is not None:
        return profile
    return manifest.rate_profiles.get(_FALLBACK_PROFILE_NAME)


def loosest_rate_profile_for_principal(principal: Principal) -> RateProfile | None:
    """该主体已授 scopes 中**最宽**的一档(用于 transport 入口洪泛闸)。

    取最宽而非最严:入口闸必须不低于任何单 scope 的带内配额,否则会把"只调低风险工具"
    的合法机器凭据在握手/列工具阶段就掐掉(那些请求根本没碰到受限 scope)。
    """
    manifest = load_capability_manifest()
    if manifest is None:
        return None
    if ALL_SCOPES in principal.scopes:
        return manifest.rate_profiles.get(_LOOSEST_PROFILE_NAME)
    candidates = [
        manifest.rate_profiles.get(meta.risk)
        for scope in principal.scopes
        if (meta := manifest.scope_meta.get(scope)) is not None
    ]
    known = [p for p in candidates if p is not None]
    if not known:
        return manifest.rate_profiles.get(_LOOSEST_PROFILE_NAME)
    return max(known, key=lambda p: p.rpm)


@dataclass
class _KeyState:
    """一个 (apiKeyId, scope) 组合的令牌桶 + 在途并发计数。"""

    bucket: TokenBucket
    inflight: int = 0


class MachineKeyRateLimiter:
    """机器凭据通道的**进程内**令牌桶 + 并发闸(形态复用应用层 TokenBucket)。

    边界(刻意为之):
    - 只统计本进程。跨实例的总量配额(rpm/dailyCalls 的全集群口径)由 **apps/api 网关层**
      负责 —— 它是唯一对外入口且持有 Redis;此处不自造分布式算法,只做"单实例被同一
      key 打爆"的兜底保护。
    - 只作用于 ``principal.is_machine_channel``(内网头 + apiKeyId)。用户 JWT / 本地开发
      主体不限流,免得把交互式会话按机器配额掐死。
    - 执行 rpm(稳态速率)、burst(桶容量)、concurrent(在途数)。``dailyCalls`` 与
      ``maxDurationMs`` 不在本器结算(前者跨实例日累计、后者由引擎 MCP_GLOBAL_TIMEOUT 负责)。
    """

    def __init__(self) -> None:
        self._states: dict[str, _KeyState] = {}

    @staticmethod
    def _bucket_key(principal: Principal, scope: str | None) -> str:
        return f"{principal.api_key_id}|{scope or '*'}"

    def _state_for(self, key: str, profile: RateProfile) -> _KeyState:
        state = self._states.get(key)
        if state is None:
            state = _KeyState(TokenBucket(max(profile.burst, 1), profile.refill_per_second))
            self._states[key] = state
        return state

    def acquire(
        self, principal: Principal, scope: str | None, *, resource_label: str
    ) -> Callable[[], None]:
        """占一个配额:令牌 + 并发位。超限抛 ``RateLimitExceeded``(429)。

        Returns:
            释放函数(必须在使用方 finally 里调用,归还并发位)。非机器通道为空操作。
        """
        if not principal.is_machine_channel:
            return lambda: None
        profile = rate_profile_for_scope(scope)
        if profile is None:  # 能力目录缺失:无档位可查,不做限流(裁决层已 fail-safe 拒绝)
            return lambda: None
        key = self._bucket_key(principal, scope)
        state = self._state_for(key, profile)
        if profile.concurrent > 0 and state.inflight >= profile.concurrent:
            raise RateLimitExceeded(
                f"机器凭据并发已达上限({profile.concurrent}),请稍后重试:{resource_label}",
                scope,
                retry_after_s=0.25,
            )
        if not state.bucket.consume():
            raise RateLimitExceeded(
                f"机器凭据超出 scope {scope} 的速率配额({profile.rpm}/min):{resource_label}",
                scope,
                retry_after_s=_seconds_until_token(state.bucket),
            )
        state.inflight += 1
        return self._releaser(key)

    def acquire_transport(self, principal: Principal, *, resource_label: str) -> None:
        """transport 入口的**连接级洪泛闸**(只算令牌,不占并发位)。

        入口处还不知道本次要调哪个工具/scope,故取该 key 已授 scopes 里**最宽松**的一档
        作速率上限:它永远不低于任何单 scope 的配额,因此只会拦"把整条连接打成洪水"的
        客户端,绝不比带内 per-scope 闸更早拒绝合法请求。真正的按 scope 结算在带内。
        """
        if not principal.is_machine_channel:
            return
        profile = loosest_rate_profile_for_principal(principal)
        if profile is None:
            return
        state = self._state_for(f"{principal.api_key_id}|{TRANSPORT_BUCKET_SUFFIX}", profile)
        if not state.bucket.consume():
            raise RateLimitExceeded(
                f"机器凭据连接速率超限({profile.rpm}/min):{resource_label}",
                None,
                retry_after_s=_seconds_until_token(state.bucket),
            )

    def _releaser(self, key: str) -> Callable[[], None]:
        def _release() -> None:
            state = self._states.get(key)
            if state is not None and state.inflight > 0:
                state.inflight -= 1

        return _release

    def reset(self) -> None:
        """清空全部桶(测试与运维巡检用)。"""
        self._states.clear()

    def snapshot(self) -> dict[str, tuple[float, int]]:
        """(剩余令牌, 在途数) 概览,供诊断/测试断言。"""
        return {k: (s.bucket.tokens, s.inflight) for k, s in self._states.items()}


def _seconds_until_token(bucket: TokenBucket) -> float:
    """距下一个令牌可用的秒数(用于 Retry-After,封顶 60s)。"""
    missing = 1.0 - bucket.tokens
    if missing <= 0 or bucket.refill_rate <= 0:
        return 0.05
    return min(60.0, missing / bucket.refill_rate)


machine_rate_limiter: Final[MachineKeyRateLimiter] = MachineKeyRateLimiter()


def enforce_rate_limit(
    principal: Principal, scope: str | None, *, resource_label: str
) -> Callable[[], None]:
    """限流闸的抛错版:超限抛 ``RateLimitExceeded``;返回并发位释放函数(finally 调用)。"""
    return machine_rate_limiter.acquire(principal, scope, resource_label=resource_label)


def enforce_transport_rate_limit(principal: Principal, *, resource_label: str) -> None:
    """transport 入口洪泛闸(机器凭据通道):超限抛 ``RateLimitExceeded``(429)。"""
    machine_rate_limiter.acquire_transport(principal, resource_label=resource_label)


# ---------------------------------------------------------------------------
# O9-D 工具集版本 + 变更广播登记(带内层与 transport 层共用)
# ---------------------------------------------------------------------------

_TOOLS_REVISION: int = 0
_TOOLS_VIEW_DIGEST: str | None = None
_TOOLS_CHANGED_LISTENERS: list[Callable[[], Awaitable[None]]] = []


def tools_revision() -> int:
    """当前工具集版本号(ETag 风格,写入 tools/list 的 toolsVersion / _meta)。"""
    return _TOOLS_REVISION


def register_tools_changed_listener(listener: Callable[[], Awaitable[None]]) -> None:
    """注册"工具集已变更"的异步广播器(mcp_export 在构建 server 时挂一次)。

    幂等:同一可重复注册只保留一份,避免模块重载后向同一批会话重复推送。
    """
    if listener not in _TOOLS_CHANGED_LISTENERS:
        _TOOLS_CHANGED_LISTENERS.append(listener)


def _view_digest(names: Iterable[str]) -> str:
    joined = "\n".join(sorted({str(n) for n in names}))
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


async def refresh_tools_revision(
    tool_names: Iterable[str] | None = None, *, reason: str | None = None
) -> int:
    """按需自增工具集版本号并广播。

    - ``tool_names`` 给出:按"视图指纹"判定 —— 指纹未变 → 不自增不广播(幂等);
      首次观测只建立基线(启动期不该给客户端推 list_changed)。
    - ``tool_names`` 为 None 且给出 ``reason``:显式变更信号(如外部工具注册、
      客户端上报 list_changed),无条件自增并广播。

    广播 = 依次 await 已注册监听器(单个监听器异常只记日志,不影响其他订阅者)。
    """
    global _TOOLS_REVISION, _TOOLS_VIEW_DIGEST
    changed = False
    if tool_names is not None:
        digest = _view_digest(tool_names)
        if _TOOLS_VIEW_DIGEST is None:
            _TOOLS_VIEW_DIGEST = digest  # 建立基线:不算变更
        elif digest != _TOOLS_VIEW_DIGEST:
            _TOOLS_VIEW_DIGEST = digest
            changed = True
    else:
        changed = reason is not None
    if not changed:
        return _TOOLS_REVISION
    _TOOLS_REVISION += 1
    logger.info(
        "[capability_gate] 工具集版本自增 → %d(reason=%s, listeners=%d)",
        _TOOLS_REVISION,
        reason or "tool-view-changed",
        len(_TOOLS_CHANGED_LISTENERS),
    )
    for listener in list(_TOOLS_CHANGED_LISTENERS):
        try:
            await listener()
        except Exception as exc:  # noqa: BLE001 - 单个广播器失败不得影响其他订阅者
            logger.warning("[capability_gate] 工具变更广播器异常: %s", type(exc).__name__)
    return _TOOLS_REVISION


def reset_tools_revision_state() -> None:
    """清空版本号/指纹/监听器(仅测试用)。"""
    global _TOOLS_REVISION, _TOOLS_VIEW_DIGEST
    _TOOLS_REVISION = 0
    _TOOLS_VIEW_DIGEST = None
    _TOOLS_CHANGED_LISTENERS.clear()


# ---------------------------------------------------------------------------
# O9-E 长任务进度心跳(两端共用:官方带内层用 SSE 帧,export 层用 SDK Context)
# ---------------------------------------------------------------------------


async def await_with_progress_heartbeat[T](
    awaitable: Awaitable[T],
    report: Callable[[float, str], Awaitable[None]],
    *,
    interval_s: float = 2.0,
    label: str = "",
) -> T:
    """等待 ``awaitable``,期间按固定节拍上报**真实已耗时**进度。

    为什么只有"已耗时"而没有百分比:内部引擎(mcp_server.call_tool)对 handler 不回传
    分阶段计数,任何 total/percent 都是编造。MCP 的 progress 允许无 total 的指示性进度,
    值取单调递增的累计秒,消息带真实 elapsed ms —— 客户端可显示"已执行 Ns",
    不会得到假进度条。拿到真实分阶段进度的前置条件见交付报告(需引擎侧回调埋点)。

    ``report`` 抛错只记日志(进度上报绝不打断业务执行);结果与异常原样透传。
    """
    started = time.monotonic()

    async def _pump() -> None:
        tick = 0.0
        while True:
            await asyncio.sleep(interval_s)
            tick += interval_s
            elapsed_ms = int((time.monotonic() - started) * 1000)
            try:
                await report(tick, f"{label} 已执行 {elapsed_ms}ms,等待结果中")
            except Exception as exc:  # noqa: BLE001 - 上报失败不得影响执行
                logger.debug("[capability_gate] 进度上报失败(忽略): %s", type(exc).__name__)

    pump = asyncio.create_task(_pump())
    try:
        return await awaitable
    finally:
        pump.cancel()
        with suppress(asyncio.CancelledError):
            await pump


__all__ = [
    "ALL_SCOPES",
    "API_KEY_HEADER_NAME",
    "CLOSED_WORLD_DOMAINS",
    "CapabilityManifest",
    "MUTATING_DATA_CLASSES",
    "PRINCIPAL_HEADER_NAME",
    "Principal",
    "PrincipalAuthError",
    "RESOURCE_SCOPES",
    "RateLimitExceeded",
    "RateProfile",
    "ScopeDeniedError",
    "ScopeMeta",
    "TRANSPORT_BUCKET_SUFFIX",
    "ToolAccessDecision",
    "ToolAnnotationHints",
    "annotation_hints_for_tool",
    "await_with_progress_heartbeat",
    "build_principal_header",
    "check_tool_access",
    "enforce_rate_limit",
    "enforce_scope",
    "enforce_tool_access",
    "enforce_transport_rate_limit",
    "load_capability_manifest",
    "loosest_rate_profile_for_principal",
    "machine_rate_limiter",
    "manifest_file",
    "principal_from_jwt",
    "principal_secret",
    "rate_profile_for_scope",
    "refresh_tools_revision",
    "register_tools_changed_listener",
    "resolve_principal",
    "resolve_principal_from_headers",
    "resolve_principal_from_request",
    "reset_tools_revision_state",
    "scope_of_resource",
    "tools_revision",
    "verify_principal_header",
]

# dataclasses import 保留供 re-export 语义清晰(避免 lint 误删注解依赖)
_ = dataclasses
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
