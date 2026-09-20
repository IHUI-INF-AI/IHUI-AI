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
"""

from __future__ import annotations

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
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Final, Literal

from app.core.config import settings

from app.core.jwt_auth import verify_access_token

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
        signing_key.encode("utf-8"), f"{PRINCIPAL_HEADER_PREFIX}.{b64}".encode("utf-8"), hashlib.sha256
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
        f"{PRINCIPAL_HEADER_PREFIX}.{b64}".encode("utf-8"),
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
    header_map: dict[str, str] = {k: v for k, v in request.headers.items()}
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


@dataclass(frozen=True)
class CapabilityManifest:
    tool_scope: dict[str, str]
    scope_meta: dict[str, ScopeMeta]


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
        scope_meta[scope] = ScopeMeta(
            data_class=data_class if isinstance(data_class, str) else "compute",
            risk=risk if isinstance(risk, str) else "critical",
            third_party_eligible=eligible if isinstance(eligible, bool) else False,
        )
    return CapabilityManifest(tool_scope=tool_scope, scope_meta=scope_meta)


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


__all__ = [
    "ALL_SCOPES",
    "API_KEY_HEADER_NAME",
    "CapabilityManifest",
    "PRINCIPAL_HEADER_NAME",
    "Principal",
    "PrincipalAuthError",
    "ScopeDeniedError",
    "ScopeMeta",
    "ToolAccessDecision",
    "build_principal_header",
    "check_tool_access",
    "enforce_scope",
    "enforce_tool_access",
    "load_capability_manifest",
    "manifest_file",
    "principal_from_jwt",
    "principal_secret",
    "resolve_principal",
    "resolve_principal_from_headers",
    "resolve_principal_from_request",
    "verify_principal_header",
]

# dataclasses import 保留供 re-export 语义清晰(避免 lint 误删注解依赖)
_ = dataclasses
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
