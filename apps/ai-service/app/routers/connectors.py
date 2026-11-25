# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Connectors 路由(2026-09-02 立,P2-2 中文连接器;2026-11-23 扩通用接入)。

让用户自己接入飞书/钉钉/企业微信/公众号/语雀,或任意自定义 HTTP 系统:
- 配置持久化走 app.services.connector_store(app_secret 加密落盘)
- 文档同步走旧 connectors 注册表(yuque/feishu/wecom/dingtalk,契约不变)
- 声明式操作(list/search/fetch/action)走 custom_http 执行层
- OpenAPI 导入走 openapi_import(本地解析,不触网)
- 所有返回条目均脱敏:app_id/app_secret/凭据类 extra 一律不回传明文
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from ..core.jwt_auth import require_request_user_id
from ..services import connector_store
from ..services import connectors as connector_registry
from ..services.connectors import (
    catalog,
    connector_oauth,
    coverage,
    coverage_probe,
    custom_http,
    managed,
    openapi_import,
)
from ..services.connectors import get_connector
from ..services.connectors.base import (
    CAPABILITIES,
    CONNECTOR_MODES,
    DEFAULT_PROBE_LIMIT,
    MAX_OPERATIONS,
    MAX_PROBE_LIMIT,
    ConnectorOperationError,
    ConnectorSpec,
    capability_summary,
    normalize_operations,
)
from ..services.tenant_scope import ConnectorScope, resolve_connector_context

logger = logging.getLogger(__name__)

# 路由前缀 /connectors,main.py 里 include_router(prefix="/api") 后完整路径为 /api/connectors/*
router = APIRouter(prefix="/connectors")

# 走旧「文档同步」实现的四类;其余类型(含 custom)用 custom_http 执行
LEGACY_TYPES = {"yuque", "feishu", "wecom", "dingtalk"}

# extra 里属于凭据的键:列表响应只回传"是否已配置",不回传值
# (非凭据键(语雀 user/repo、飞书 folder_token 之外的标识)原样回传,
#  修复编辑时无法回填的问题)
SENSITIVE_EXTRA_KEYS = {
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "app_secret",
    "password",
    "cookie",
    "webhook_url",
    "api_key",
    "private_key",
    "user_oauth",  # 用户 OAuth 令牌密文(connector_oauth),只回传"已授权"布尔位
    "robot_mcp_endpoint",  # 企业微信机器人 MCP 端点密文(含 apikey),只回传"已授权"布尔位
}


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class ConnectorSpecIn(BaseModel):
    """传输配置(自定义 HTTP / 平台模板)。"""

    base_url: str = ""
    auth_kind: str = "none"
    auth_name: str = "Authorization"
    auth_scheme: str = "Bearer"
    headers: dict[str, str] = Field(default_factory=dict)
    timeout_s: float = 15.0
    allow_write: bool = False
    allow_private_hosts: bool = False


class ConnectorConfigRequest(BaseModel):
    """连接器配置保存请求(POST /connectors/config)。

    app_secret 传空串时保留旧值(防止前端回显覆盖密钥)。
    2026-11-23 新增 mode / spec / operations:预置平台可只填凭据,
    自定义接入填 base_url+鉴权+操作清单。
    """

    key: str = Field(..., min_length=1, description="唯一标识,格式 {type}:{slug}")
    type: str = Field(..., min_length=1, description="连接器类型")
    name: str = Field("", description="显示名")
    app_id: str = Field("", description="开放平台 app_id")
    app_secret: str = Field("", description="密钥(空串时保留旧值)")
    extra: dict[str, Any] = Field(default_factory=dict, description="类型专属配置")
    mode: str = Field("preset", description="preset(预置平台)|custom(自定义 HTTP)")
    managed: bool = Field(False, description="平台托管凭据(用户不填 app_id/app_secret)")
    spec: ConnectorSpecIn | None = Field(None, description="传输配置")
    operations: list[dict[str, Any]] = Field(
        default_factory=list, description="声明式操作清单"
    )
    platform: str = Field("", description="台账展开平台;填写后按 api_ids/domains 从目录生成 operations")
    api_ids: list[str] = Field(default_factory=list, description="展开指定的台账 API id")
    domains: list[str] = Field(default_factory=list, description="展开指定业务域")


class ConnectorSyncRequest(BaseModel):
    """连接器同步请求(POST /connectors/sync)。"""

    key: str = Field(..., min_length=1, description="连接器记录 key")


class ConnectorFetchRequest(BaseModel):
    """单篇文档拉取请求(POST /connectors/{key}/fetch)。"""

    doc_id: str = Field("", description="文档 slug/id(空串由 handler 判定返回 400)")


class ConnectorInvokeRequest(BaseModel):
    """通用操作调用请求(POST /connectors/{key}/invoke)。"""

    operation_id: str = Field(..., min_length=1, description="操作 id")
    params: dict[str, Any] = Field(default_factory=dict, description="路径/查询/请求体参数")
    confirm: bool = Field(False, description="写操作二次确认标记")


class ManagedConnectRequest(BaseModel):
    """平台托管一键接入请求(POST /connectors/managed/connect)。"""

    type: str = Field(..., min_length=1, description="预置平台类型")
    name: str = Field("", description="显示名(空串用模板名)")


class OpenApiPreviewRequest(BaseModel):
    """OpenAPI 导入预览请求(POST /connectors/openapi/preview)。"""

    raw: str = Field("", description="OpenAPI JSON/YAML 原文")
    spec: dict[str, Any] | None = Field(None, description="已解析的 OpenAPI 对象")
    base_url: str = Field("", description="覆盖 servers[0].url")


class ProbeRequest(BaseModel):
    """能力探测请求(POST /connectors/{key}/probe)。"""

    api_ids: list[str] = Field(default_factory=list, description="指定探测的 API id;空=按 domains/全量")
    domains: list[str] = Field(default_factory=list, description="按业务域筛选")
    limit: int = Field(DEFAULT_PROBE_LIMIT, description="单批探测上限(1..MAX_PROBE_LIMIT)")
    offset: int = Field(0, ge=0, description="分批游标(配合响应 nextOffset 翻页;缺省 0=首批)")
    read_only: bool = Field(True, description="只探只读接口;false 才纳入写操作(仍走确认/写权限门)")


class CoveragePlanRequest(BaseModel):
    """目录分片规划请求(POST /connectors/{key}/coverage/plan)。"""

    platform: str = Field("", description="平台;空串回退连接器记录类型")
    domains: list[str] = Field(default_factory=list)
    api_ids: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def _effective_operations(rec: dict[str, Any]) -> list[dict[str, Any]]:
    """记录里的操作清单;预置平台未显式保存时用模板默认清单。"""
    ops = rec.get("operations")
    if isinstance(ops, list) and ops:
        return [op for op in ops if isinstance(op, dict)]
    conn_type = str(rec.get("type") or "")
    if str(rec.get("mode") or "preset") == "preset":
        return catalog.default_operations(conn_type)
    return []


def _spec_for_execution(rec: dict[str, Any]) -> dict[str, Any]:
    """执行用 spec:存量预置连接器没有 spec 时用模板的 base_url/鉴权补齐。"""
    raw = rec.get("spec")
    spec: dict[str, Any] = dict(raw) if isinstance(raw, dict) else {}
    tpl = catalog.template_for(str(rec.get("type") or ""))
    if tpl and str(rec.get("mode") or "preset") == "preset":
        if not spec.get("base_url"):
            spec["base_url"] = tpl["base_url"]
        if not spec.get("auth_kind"):
            spec["auth_kind"] = tpl["auth_kind"]
        if not spec.get("auth_name") or spec.get("auth_name") == "Authorization":
            spec["auth_name"] = tpl.get("auth_name", "Authorization")
    return spec


async def connector_context(
    request: Request,
    user_id: str = Depends(require_request_user_id),
) -> ConnectorScope:
    """连接器归属上下文:经验证的租户 ID/角色,无租户时退回个人作用域。"""
    return await resolve_connector_context(request, user_id)


async def connector_scope(ctx: ConnectorScope = Depends(connector_context)) -> str:
    """只读/调用场景的连接器作用域键。"""
    return ctx.scope


async def connector_admin_scope(ctx: ConnectorScope = Depends(connector_context)) -> str:
    """增删改共享连接器要求租户 owner/admin;普通成员不得改企业集成凭据。"""
    if not ctx.can_manage:
        raise HTTPException(status_code=403, detail="需要租户管理员权限")
    return ctx.scope


def _record_for_execution(rec: dict[str, Any], scope: str | None = None) -> dict[str, Any]:
    """执行副本:补模板 spec + 托管凭据,不改原记录。"""
    enriched = managed.hydrate(rec, scope)
    enriched = dict(enriched)
    enriched["spec"] = _spec_for_execution(rec)
    return enriched


def _make_refresh_persister(
    rec: dict[str, Any],
    scope: str,
    tenant_id: str | None,
    key: str,
) -> custom_http.TokenRefreshedCallback:
    """构造用户令牌刷新后的持久化回调,供 invoke/sync/fetch 三条路由复用。"""

    def _persist_refreshed_token(cipher: str) -> None:
        """用户令牌刷新成功:把新密文落回**原记录**并持久化。

        执行副本经 managed.hydrate 注过托管凭据,不能直接拿它落库(会把
        app_secret 写回);只从原记录 rec 派生,仅替换 user_oauth 密文。
        作用域/租户沿用读取该记录时已校验的 scope/ctx.tenant_id,不采信
        记录自报值 —— refresh_token 单次有效,漏落库下次刷新必失败。
        """
        updated = dict(rec)
        extra = dict(rec.get("extra") or {})
        extra[connector_oauth.USER_TOKEN_EXTRA_KEY] = cipher
        updated["extra"] = extra
        saved = connector_store.save(scope, updated, tenant_id=tenant_id)
        if saved is None:
            logger.error("[oauth] 刷新后新令牌持久化失败 key=%s", key)
        else:
            logger.info("[oauth] 刷新后新令牌已持久化 key=%s", key)

    return _persist_refreshed_token


def _safe_spec(rec: dict[str, Any]) -> dict[str, Any] | None:
    """传输配置的脱敏形态:请求头值一律不回传,只保留"哪些头已配置"。"""
    raw = rec.get("spec")
    if not isinstance(raw, dict):
        raw = {}
    tpl = catalog.template_for(str(rec.get("type") or ""))
    merged: dict[str, Any] = dict(raw)
    if tpl and not merged.get("base_url") and str(rec.get("mode") or "preset") == "preset":
        merged["base_url"] = tpl["base_url"]
        merged.setdefault("auth_kind", tpl["auth_kind"])
        merged.setdefault("auth_name", tpl.get("auth_name", "Authorization"))
    if not merged:
        return None
    try:
        spec = ConnectorSpec.from_dict(merged)
    except ConnectorOperationError:
        # 存量记录里的 spec 可能不符合新校验(如旧 header 名);展示层不因此崩
        return {
            "base_url": str(merged.get("base_url") or ""),
            "auth_kind": str(merged.get("auth_kind") or "none"),
            "auth_name": str(merged.get("auth_name") or "Authorization"),
            "auth_scheme": str(merged.get("auth_scheme") or "Bearer"),
            "headers": {str(k): "" for k in (merged.get("headers") or {})},
            "headers_configured": sorted(str(k) for k in (merged.get("headers") or {})),
            "timeout_s": float(merged.get("timeout_s") or 15.0),
            "allow_write": bool(merged.get("allow_write")),
            "allow_private_hosts": bool(merged.get("allow_private_hosts")),
        }
    headers = {name: "" for name in spec.headers}
    return {
        "base_url": spec.base_url,
        "auth_kind": spec.auth_kind,
        "auth_name": spec.auth_name,
        "auth_scheme": spec.auth_scheme,
        "headers": headers,
        "headers_configured": sorted(headers),
        "timeout_s": spec.timeout_s,
        "allow_write": spec.allow_write,
        "allow_private_hosts": spec.allow_private_hosts,
    }


def _safe(rec: dict[str, Any]) -> dict[str, Any]:
    """脱敏输出条目:不返回 app_id/app_secret 明文。

    2026-11-23:extra 保留旧「键->布尔」契约(前端兼容),另给
    ``extra_fields`` 回传非凭据键的原值 —— 修复编辑语雀连接器时
    owner/repo 无法回填的问题。
    """
    extra_raw = rec.get("extra")
    extra_raw = extra_raw if isinstance(extra_raw, dict) else {}
    extra = {str(k): bool(v) for k, v in extra_raw.items()}
    extra_fields = {
        str(k): str(v)
        for k, v in extra_raw.items()
        if str(k) not in SENSITIVE_EXTRA_KEYS and isinstance(v, (str, int, float, bool))
    }
    configured = bool(rec.get("managed")) or bool(extra) or bool(rec.get("app_id"))
    if not configured and str(rec.get("mode") or "preset") == "custom":
        # 自定义 HTTP 可无 app_id/extra(auth_kind=none),有 base_url 就算已配置
        spec_raw = rec.get("spec")
        configured = bool(isinstance(spec_raw, dict) and spec_raw.get("base_url"))
    mod = get_connector(str(rec.get("type") or ""))
    ops = _effective_operations(rec)
    return {
        "key": str(rec.get("key") or ""),
        "type": str(rec.get("type") or ""),
        "name": str(rec.get("name") or ""),
        "extra": extra,
        "extra_fields": extra_fields,
        "configured": configured,
        "managed": bool(rec.get("managed")),
        "credential_source": str(rec.get("credential_source") or ""),
        "enabled": bool(rec.get("enabled")),
        "mode": str(rec.get("mode") or "preset"),
        "spec": _safe_spec(rec),
        "operations": ops,
        "operation_count": len(ops),
        "operation_capabilities": capability_summary(ops),
        "installed_at": str(rec.get("installed_at") or ""),
        "updated_at": str(rec.get("updated_at") or ""),
        "last_sync_at": str(rec.get("last_sync_at") or ""),
        "last_error": str(rec.get("last_error") or ""),
        "sync_items": list(rec.get("sync_items") or []),
        "capabilities": {
            "doc_list": bool(mod is not None and hasattr(mod, "sync")),
            "fetch_doc": bool(mod is not None and hasattr(mod, "fetch_document")),
        },
    }


def _error(status: int, message: str) -> JSONResponse:
    """构造统一错误响应。"""
    return JSONResponse(status_code=status, content={"error": message})


def _validate_config(req: ConnectorConfigRequest) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """校验配置并返回(规范化的 spec, 规范化的操作清单)。"""
    if req.type not in connector_registry.SUPPORTED_TYPES and req.type not in {
        "custom",
        "wechat_mp",
    }:
        raise ConnectorOperationError(f"不支持的连接器类型: {req.type}")
    mode = req.mode if req.mode in CONNECTOR_MODES else "preset"
    spec_raw = req.spec.model_dump() if req.spec is not None else {}
    if mode == "custom" and not spec_raw.get("base_url"):
        raise ConnectorOperationError("自定义连接器必须填写 base_url")
    spec = ConnectorSpec.from_dict(spec_raw).to_dict()
    operations = normalize_operations(req.operations)
    return {"mode": mode, "spec": spec}, operations


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.get("", response_model=None)
async def list_connectors(
    scope: str = Depends(connector_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """列出**当前租户**的连接器配置(脱敏)。

    历史遗留、无属主的记录不列给任何人,只在服务端日志里报条数 ——
    响应体里不带这个数,免得又开一个"数得清别人有多少配置"的口。
    """
    try:
        unclaimed = connector_store.ownerless_count()
        if unclaimed:
            logger.warning(
                "连接器存储里有 %d 条无属主遗留记录(不对任何主体可见),需人工认领或清理", unclaimed
            )
        records = connector_store.list_owned(scope, tenant_id=ctx.tenant_id)
        items = [_safe(rec) for rec in records]
        return {"connectors": items, "count": len(items)}
    except Exception as e:  # noqa: BLE001 - 内部异常降级,不裸抛
        logger.error("获取连接器列表失败: %s", e)
        return _error(500, "获取连接器列表失败,请稍后重试")


# ---------------------------------------------------------------------------
# 用户 OAuth 授权(user_access_token) —— 让 AI 以用户本人身份调用平台 API
# ---------------------------------------------------------------------------


def _oauth_redirect_uri() -> str:
    """OAuth 回调地址 —— 复用平台既有的重定向配置，不另造一个新变量。

    优先级（与既有登录链路同源，可在已配好的项目上开箱即用）：
      1. ``CONNECTOR_OAUTH_REDIRECT_URI``：仅当需要与登录回调不同地址时显式覆盖；
      2. ``FEISHU_REDIRECT_URI``：``.env.production.example`` 中早已配置的飞书回调；
      3. ``NEXT_PUBLIC_FEISHU_REDIRECT_URI``：Web 侧早已配置的同值回调。
    这三者在同一个飞书应用的「重定向 URL」白名单里本就登记过，无需平台管理员新增配置。
    """
    import os

    for name in (
        "CONNECTOR_OAUTH_REDIRECT_URI",
        "FEISHU_REDIRECT_URI",
        "NEXT_PUBLIC_FEISHU_REDIRECT_URI",
    ):
        value = str(os.environ.get(name) or "").strip()
        if value:
            return value
    return ""


# 站点默认回调基址:与 .env.production.example 既有的
# NEXT_PUBLIC_FEISHU_REDIRECT_URI / NEXT_PUBLIC_DINGTALK_REDIRECT_URI 同源(开放平台后台
# 「重定向 URL」白名单登记的就是 https://aizhs.top/callback?platform=<platform>)。
# 仅作最后兜底:生产 ai-service 的 .env 未把这些变量同步进 os.environ,旧实现会在
# authorize 直接报「未配置回调地址」;此默认让已配好的平台开箱即用。
_OAUTH_SITE_BASE = "https://aizhs.top"


def _resolve_oauth_redirect_uri(platform: str, cred: dict[str, Any] | None = None) -> str:
    """按平台解析回调地址 —— authorize 与 callback 必须逐字相等,否则平台拒换 code。

    优先级(高→低):
      1. 租户/平台凭据 ``extra.redirect_uri``:生产钉钉租户凭据已带该值,飞书租户
         可同样配自己的开放平台回调,无需改服务环境;
      2. 平台专属环境变量 ``<PLATFORM>_REDIRECT_URI`` / ``NEXT_PUBLIC_<PLATFORM>_REDIRECT_URI``:
         兼容既有部署习惯(如 NEXT_PUBLIC_FEISHU_REDIRECT_URI);
      3. 连接器通用配置 :func:`_oauth_redirect_uri`(CONNECTOR_OAUTH_REDIRECT_URI 等);
      4. 站点默认 ``https://aizhs.top/callback?platform=<platform>``。

    刻意保留 :func:`_oauth_redirect_uri` 的无参签名:既有测试与部署直接 mock/调用它,
    在新解析链里把它作为一环,而不是替换,避免破坏「配置即复用」的既有语义。
    """
    if cred:
        extra = cred.get("extra") or {}
        value = str((extra.get("redirect_uri") if isinstance(extra, dict) else "") or "").strip()
        if value:
            return value
    import os

    upper = platform.upper()
    for name in (f"{upper}_REDIRECT_URI", f"NEXT_PUBLIC_{upper}_REDIRECT_URI"):
        value = str(os.environ.get(name) or "").strip()
        if value:
            return value
    generic = _oauth_redirect_uri()
    if generic:
        return generic
    return f"{_OAUTH_SITE_BASE}/callback?platform={platform}"


def _user_oauth_operations(platform: str) -> list[dict[str, Any]]:
    """用户 OAuth 连接器只装台账里的「用户授权态」API。

    用户扫码后得到的 ``{platform}:user-oauth`` 连接器,spec.auth_kind 是
    ``{platform}_user``,只能以授权人身份调用户态接口(台账 ``auth`` 以 ``_user``
    结尾,如 ``feishu_user``)。旧实现照抄内置模板(飞书仅 9 条 tenant 态操作),
    导致台账里 164 条用户态 API 全部调不到 —— 本函数即修此处。

    回退(绝不静默落空壳连接器):
    - 台账未判定(state != "ok")或无可用条目 ⇒ 内置默认模板;
    - 平台无用户态 API(钉钉/企微台账 auth 全是应用态)⇒ 内置默认模板;
    - 用户态数超过单连接器上限 MAX_OPERATIONS(防台账未来膨胀)⇒ 截断并记 warning。

    写操作的安全门(disabled/confirm)由 coverage.api_to_operation 原生生成,保持不动。
    """
    bundle = coverage.load_catalog(platform)
    if bundle.state != "ok" or not bundle.apis:
        return catalog.default_operations(platform)

    user_apis = [
        api
        for api in bundle.apis
        if str(api.get("auth") or "").strip().endswith(
            ("_user", "_user_access_token", "_user_token")
        )
    ]
    if not user_apis:
        return catalog.default_operations(platform)

    if len(user_apis) > MAX_OPERATIONS:
        logger.warning(
            "[oauth] 平台 %s 用户态 API 共 %d 条,超过单连接器上限 %d,截断至上限",
            platform,
            len(user_apis),
            MAX_OPERATIONS,
        )
        user_apis = user_apis[:MAX_OPERATIONS]

    return [coverage.api_to_operation(api, bundle.base_url) for api in user_apis]


@router.get("/oauth/callback", response_model=None)
async def oauth_callback(
    request: Request,
    code: str = "",
    state: str = "",
    error: str = "",
    error_description: str = "",
) -> JSONResponse:
    """平台 OAuth 回调:校验 state → 用 code 换 user_access_token → 加密落库。

    回调是浏览器跳转(无 JWT body),归属靠签名 state 里的 owner。code 只在回调里
    出现一次;令牌明文只在内存里流转,落库前加密,响应只回"授权成功"不回令牌。
    """
    if error or error_description:
        return JSONResponse(status_code=400, content={"error": error_description or error})
    if not code or not state:
        return JSONResponse(status_code=400, content={"error": "缺少 code 或 state"})
    try:
        # state 里带 platform,先解出平台再校验(verify_state 内部校验签名+平台+归属+TTL)
        import base64

        body = state.split(".", 1)[0]
        payload = json.loads(
            base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)).decode()
        )
        platform = str(payload.get("p") or "")
        scope = str(payload.get("o") or "")
        user_id = str(payload.get("u") or "")
        tenant_id = str(payload.get("t") or "") or None
        if not platform or not scope or not user_id:
            raise connector_oauth.ConnectorOAuthError("state 缺少平台/归属/用户")
        cfg = connector_oauth.provider(platform)
        connector_oauth.verify_state(state, platform, scope)

        # 应用凭据:优先租户自己的,再回落平台环境(与 managed 同源)
        cred = managed.credentials(platform, scope=scope)
        redirect_uri = _resolve_oauth_redirect_uri(platform, cred)
        if not redirect_uri:
            raise connector_oauth.ConnectorOAuthError("未配置 OAuth 回调地址：请设置 FEISHU_REDIRECT_URI（生产示例已配）或 CONNECTOR_OAUTH_REDIRECT_URI")

        async def _http_json(url: str, body: dict[str, Any]) -> dict[str, Any]:
            import httpx

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=body)
                resp.raise_for_status()
                data = resp.json()
            return data if isinstance(data, dict) else {}

        token = await connector_oauth.exchange_code(
            cfg,
            code,
            app_id=str(cred.get("app_id") or ""),
            app_secret=str(cred.get("app_secret") or ""),
            redirect_uri=redirect_uri,
            http_json=_http_json,
        )
        cipher = connector_oauth.encrypt_user_token(token)

        # 令牌落到与 list/invoke 完全相同的作用域:owner=scope、tenant_id=隔离键。
        # 个人模式 scope=user_id;租户模式 scope=tenant_id(租户成员共享该入口,
        # 但令牌是授权人本人的,租户内其他成员能否用由连接器可见性既有规则决定)。
        key = f"{platform}:user-oauth"
        rec = connector_store.get(scope, key, tenant_id=tenant_id)
        if rec is None:
            tpl = catalog.template_for(platform) or {}
            spec = {
                "base_url": str(tpl.get("base_url") or ""),
                "auth_kind": f"{platform}_user",
                "auth_name": "Authorization",
                "auth_scheme": "Bearer",
                "headers": {},
                "timeout_s": 15.0,
                "allow_write": False,
                "allow_private_hosts": False,
            }
            rec = {
                "key": key,
                "type": platform,
                "name": f"{tpl.get('label') or platform} · 用户授权",
                "app_id": "",
                "app_secret": "",
                "extra": {connector_oauth.USER_TOKEN_EXTRA_KEY: cipher},
                "mode": "preset",
                "spec": spec,
                "operations": _user_oauth_operations(platform),
                "enabled": True,
                "managed": True,
                "credential_source": str(cred.get("source") or "platform_env"),
            }
        else:
            extra = dict(rec.get("extra") or {})
            extra[connector_oauth.USER_TOKEN_EXTRA_KEY] = cipher
            rec["extra"] = extra
            # 存量用户(旧版只落 9 条静态操作)重新扫码时一并补齐全量 user 操作,
            # 否则重新授权只刷 token、AI 仍只能调旧的那几条 —— 与首次授权口径对齐。
            rec["operations"] = _user_oauth_operations(platform)
        saved = connector_store.save(scope, rec, tenant_id=tenant_id)
        if saved is None:
            raise connector_oauth.ConnectorOAuthError("用户授权凭据保存失败")
        logger.info("[oauth] 用户授权成功 platform=%s key=%s", platform, key)
        # 浏览器跳转来的回调(Accept 含 text/html)重定向回前端连接器页,
        # 免得用户盯着一屏 JSON;API 调用(Accept 缺省)仍拿结构化结果。
        accept = request.headers.get("accept", "")
        import os

        ui_redirect = str(os.environ.get("CONNECTOR_OAUTH_UI_REDIRECT") or "").strip()
        if "text/html" in accept and ui_redirect:
            return RedirectResponse(url=ui_redirect, status_code=303)
        return JSONResponse(
            content={
                "ok": True,
                "platform": platform,
                "connector_key": key,
                "message": "授权成功,AI 现在可以你的身份调用该平台 API",
            }
        )
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"error": "state 载荷非法"})
    except connector_oauth.ConnectorOAuthError as exc:
        logger.warning("[oauth] 回调拒绝: %s", exc)
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception as exc:  # noqa: BLE001
        logger.error("[oauth] 回调失败: %s", exc)
        return JSONResponse(status_code=500, content={"error": "用户授权处理失败,请稍后重试"})


@router.get("/{platform}/oauth/authorize", response_model=None)
async def oauth_authorize(
    platform: str,
    user_id: str = Depends(require_request_user_id),
    scope: str = Depends(connector_scope),
    ctx: ConnectorScope = Depends(connector_context),
    oauth_scope: str = "",
    redirect_uri: str = "",
) -> dict[str, Any] | JSONResponse:
    """生成平台 OAuth 授权 URL(前端拿到后跳转让用户扫码授权)。

    state 绑定当前用户与平台并签名,回调时校验,防 CSRF。scope 参数可缩小授权范围;
    缺省由平台返回该应用已申请的全部权限。
    """
    try:
        cfg = connector_oauth.provider(platform)
        cred = managed.credentials(platform, scope=scope)
        app_id = str(cred.get("app_id") or "")
        if not app_id:
            raise connector_oauth.ConnectorOAuthError("平台应用凭据缺少 app_id")
        configured_redirect = _resolve_oauth_redirect_uri(platform, cred)
        supplied_redirect = redirect_uri.strip()
        # 回调端点硬编码 _oauth_redirect_uri():authorize 若放行任意 redirect_uri,
        # 授权码会被发往该地址,而 token 换取仍用另一地址 —— 平台按 redirect_uri
        # 必须逐字相等的规则必然拒换,还给"把 code 钓鱼到外部回调"留了口。
        # 前端本就不传该参数;未配置白名单时只接受与已配置回调逐字相等的值。
        if supplied_redirect and supplied_redirect != configured_redirect:
            raise connector_oauth.ConnectorOAuthError(
                "redirect_uri 与已配置回调地址不一致,拒绝授权"
            )
        redirect = supplied_redirect or configured_redirect
        if not redirect:
            raise connector_oauth.ConnectorOAuthError("未配置 OAuth 回调地址：请设置 FEISHU_REDIRECT_URI（生产示例已配）或 CONNECTOR_OAUTH_REDIRECT_URI")
        # state 带全 scope/tenant_id/user_id,回调原样回传,
        # 使令牌落到与 list/invoke 相同的作用域(否则 AI 看不到也调不到)。
        state = connector_oauth.make_state(
            platform, scope, user_id=user_id, tenant_id=str(ctx.tenant_id or "") if ctx else ""
        )
        from urllib.parse import urlencode

        params: dict[str, Any] = {
            cfg.client_id_param: app_id,
            "redirect_uri": redirect,
            "response_type": "code",
            "state": state,
        }
        # 平台固定授权参数(钉钉需 scope=openid + prompt=consent);用户显式
        # 传入的 oauth_scope 优先,可覆盖平台默认 scope。
        for key, value in cfg.authorize_extra_params:
            params[key] = value
        requested = oauth_scope.strip()
        if requested:
            params["scope"] = requested
        # 平台默认 scope 与用户 scope 合并去重:飞书默认 offline_access 才能拿到
        # refresh_token,且不覆盖用户额外申请的 scope。钉钉 default_oauth_scope
        # 为空,scope=openid 原样保留(其 refreshToken 机制不同,不加 offline_access)。
        if cfg.default_oauth_scope:
            merged = str(params.get("scope") or "").split()
            for scope_part in cfg.default_oauth_scope.split():
                if scope_part not in merged:
                    merged.append(scope_part)
            if merged:
                params["scope"] = " ".join(merged)
        url = f"{cfg.authorize_url}?{urlencode(params)}"
        return {"url": url, "state": state, "platform": platform, "expires_in": connector_oauth.STATE_TTL_SECONDS}
    except connector_oauth.ConnectorOAuthError as exc:
        return _error(400, str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.error("[oauth] 生成授权 URL 失败: %s", exc)
        return _error(500, "生成授权 URL 失败")


@router.get("/catalog", response_model=None)
async def connector_catalog(
    scope: str = Depends(connector_scope),
) -> dict[str, Any] | JSONResponse:
    """返回预置平台模板目录(操作清单 + 不支持的类型原因)。"""
    try:
        payload = catalog.list_catalog()
        for tpl in payload.get("templates", []):
            tpl["managed"] = managed.status(str(tpl.get("type") or ""), scope)
        payload["capabilities"] = list(CAPABILITIES)
        return payload
    except Exception as e:  # noqa: BLE001
        logger.error("获取连接器目录失败: %s", e)
        return _error(500, "获取连接器目录失败,请稍后重试")


@router.get("/coverage", response_model=None)
async def connector_coverage(
    platform: str,
    scope: str = Depends(connector_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """平台目录覆盖视图:台账条目 + 最近探测状态(GET /connectors/coverage?platform=)。"""
    del scope
    if platform not in coverage.PLATFORMS:
        return _error(400, f"不支持的平台: {platform}(仅 feishu/dingtalk/wecom)")
    try:
        results = coverage_probe.load_results(ctx.tenant_id or "", platform)
        return coverage.build_coverage(platform, probe_results=results)
    except Exception as e:  # noqa: BLE001
        logger.error("获取目录覆盖视图失败(%s): %s", platform, e)
        return _error(500, "获取目录覆盖视图失败,请稍后重试")


@router.post("/{key}/probe", response_model=None)
async def probe_connector(
    key: str,
    req: ProbeRequest,
    scope: str = Depends(connector_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """对选中的目录 API 发真实只读探测,结果落 PostgreSQL 并按状态汇总。"""
    if req.limit < 1 or req.limit > MAX_PROBE_LIMIT:
        return _error(400, f"limit 须在 1..{MAX_PROBE_LIMIT} 之间")
    try:
        rec = connector_store.get(scope, key, tenant_id=ctx.tenant_id)
        if rec is None:
            return _error(404, f"连接器不存在: {key}")
        if not bool(rec.get("enabled")):
            return _error(400, "连接器已停用,请先启用")
        if not _safe(rec)["configured"]:
            return _error(400, "未配置，无法探测")

        platform = str(rec.get("type") or "")
        if platform not in coverage.PLATFORMS:
            return _error(400, "该连接器类型不支持目录能力探测")

        bundle = coverage.load_catalog(platform)
        if bundle.state != "ok":
            return _error(400, f"台账未判定,无法探测: {bundle.reason}")

        wanted_ids = set(req.api_ids)
        wanted_domains = set(req.domains)
        apis = [
            api
            for api in bundle.apis
            if (not wanted_ids or api["id"] in wanted_ids)
            and (not wanted_domains or api["domain"] in wanted_domains)
        ]

        exec_rec = _record_for_execution(rec, scope)
        exec_rec["tenant_id"] = ctx.tenant_id or ""
        exec_rec["scope"] = scope
        result = await coverage_probe.probe_apis(
            record=exec_rec,
            platform=platform,
            apis=apis,
            read_only=req.read_only,
            limit=req.limit,
            offset=req.offset,
            default_base_url=bundle.base_url,
        )
        return result
    except coverage_probe.ProbeStoreUnavailable as e:
        logger.error("探测结果持久化不可用(%s): %s", key, e)
        return _error(502, "探测结果持久化不可用(PostgreSQL 未启用),请稍后重试")
    except Exception as e:  # noqa: BLE001
        logger.error("连接器探测失败(%s): %s", key, e)
        return _error(500, "连接器探测失败,请稍后重试")


@router.post("/{key}/coverage/plan", response_model=None)
async def coverage_plan(
    key: str,
    req: CoveragePlanRequest,
    scope: str = Depends(connector_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """把平台目录按业务域切成 ≤200 操作的分片,供落成多个连接器。"""
    try:
        rec = connector_store.get(scope, key, tenant_id=ctx.tenant_id)
        platform = req.platform.strip()
        if not platform and rec is not None:
            platform = str(rec.get("type") or "")
        if platform not in coverage.PLATFORMS:
            return _error(400, f"不支持的平台: {platform}(仅 feishu/dingtalk/wecom)")

        bundle = coverage.load_catalog(platform)
        if bundle.state != "ok":
            return _error(400, f"台账未判定,无法规划分片: {bundle.reason}")

        return coverage.plan_shards(
            platform,
            bundle.apis,
            domains=req.domains,
            api_ids=req.api_ids,
            default_base_url=bundle.base_url,
        )
    except Exception as e:  # noqa: BLE001
        logger.error("目录分片规划失败(%s): %s", key, e)
        return _error(500, "目录分片规划失败,请稍后重试")


@router.post("/openapi/preview", response_model=None)
async def preview_openapi(
    req: OpenApiPreviewRequest,
    scope: str = Depends(connector_scope),
) -> dict[str, Any] | JSONResponse:
    """解析 OpenAPI/Swagger 文档,返回可导入的操作清单(不落盘)。"""
    del scope
    try:
        spec = req.spec if isinstance(req.spec, dict) else None
        if spec is None:
            spec = openapi_import.parse_spec_text(req.raw)
        result = openapi_import.parse_openapi(spec, base_url=req.base_url or None)
        return result
    except ConnectorOperationError as e:
        return _error(400, str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("OpenAPI 解析失败: %s", e)
        return _error(500, "OpenAPI 解析失败,请检查文档格式")


@router.post("/config", response_model=None)
async def save_connector_config(
    req: ConnectorConfigRequest,
    scope: str = Depends(connector_admin_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """新增或覆盖**当前租户**的连接器配置;返回脱敏条目。

    属主由承载层注入的已验证作用域盖章(见 connector_store.save),请求体自报的同名字段一律不采信;
    同名 key 在租户/个人作用域下各自成条,不会互相覆盖。
    """
    try:
        normalized, operations = _validate_config(req)
        # 目录展开:platform 或 api_ids/domains 任一给出时,走 coverage 同一生成器
        # 从台账展开 operations;台账缺失/未匹配 ⇒ 显式 400,不落空壳连接器。
        expand_platform = req.platform.strip() or (
            req.type if (req.api_ids or req.domains) else ""
        )
        if expand_platform:
            try:
                _selected, operations, bundle = coverage.resolve_expansion(
                    expand_platform,
                    api_ids=req.api_ids,
                    domains=req.domains,
                )
            except coverage.CatalogUnavailable as e:
                return _error(400, f"目录展开失败: {e.reason}")
            spec = normalized["spec"]
            if not spec.get("base_url") and bundle.base_url:
                spec["base_url"] = bundle.base_url
            if (not spec.get("auth_kind") or spec.get("auth_kind") == "none") and bundle.auth_kind:
                spec["auth_kind"] = bundle.auth_kind
        if normalized["mode"] == "custom" and not operations:
            raise ConnectorOperationError("自定义连接器至少需要一条操作")
        # 预置平台没填 spec 时用模板的 base_url/鉴权方式(存量与新建同口径)
        tpl = catalog.template_for(req.type) if normalized["mode"] == "preset" else None
        if tpl:
            spec = normalized["spec"]
            if not spec.get("base_url"):
                spec["base_url"] = tpl["base_url"]
            if not spec.get("auth_kind") or spec.get("auth_kind") == "none":
                spec["auth_kind"] = tpl["auth_kind"]
            if not spec.get("auth_name") or spec.get("auth_name") == "Authorization":
                spec["auth_name"] = tpl.get("auth_name", "Authorization")
        existing = connector_store.get(scope, req.key, tenant_id=ctx.tenant_id)
        if existing is not None:
            # app_secret 空串保留旧值(防前端回显覆盖密钥);app_id 同样防覆盖
            app_secret = req.app_secret if req.app_secret else str(existing.get("app_secret") or "")
            app_id = req.app_id if req.app_id else str(existing.get("app_id") or "")
            installed_at = str(existing.get("installed_at") or "")
        else:
            app_secret = req.app_secret
            app_id = req.app_id
            installed_at = connector_store.now_iso()
        # 预置平台未给操作清单时落模板默认(写操作仍被 allow_write 挡住)
        if not operations and normalized["mode"] == "preset":
            operations = catalog.default_operations(req.type)
        managed_flag = bool(req.managed and tpl is not None)
        if managed_flag:
            # 托管连接器不落任何密钥;来源必须与真实凭据一致 ——
            # 租户自己的应用凭据标 tenant,平台环境凭据标 platform_env,
            # 语雀公开知识库标 public。不能一律写成 platform_env。
            app_id = ""
            app_secret = ""
            credential_source = str(
                managed.status(req.type, scope).get("credential_source") or "platform_env"
            )
        else:
            credential_source = ""
        record = {
            "key": req.key,
            "type": req.type,
            "name": req.name or req.key,
            "app_id": app_id,
            "app_secret": app_secret,
            "extra": dict(req.extra or {}),
            "mode": normalized["mode"],
            "spec": normalized["spec"],
            "operations": operations,
            "enabled": bool((existing or {}).get("enabled", True)),
            "managed": managed_flag,
            "credential_source": credential_source,
            "installed_at": installed_at,
            "updated_at": connector_store.now_iso(),
            "last_sync_at": str((existing or {}).get("last_sync_at") or ""),
            "last_error": str((existing or {}).get("last_error") or ""),
            "sync_items": list((existing or {}).get("sync_items") or []),
        }
        saved = connector_store.save(scope, record, tenant_id=ctx.tenant_id)
        if saved is None:
            return _error(500, "保存连接器配置失败")
        # 凭据变更后清平台 token 缓存,避免继续用旧 token
        custom_http.clear_token_cache(saved)
        logger.info("连接器配置保存成功: %s(%s)", req.key, req.type)
        return _safe(saved)
    except ConnectorOperationError as e:
        return _error(400, str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("保存连接器配置失败(%s): %s", req.key, e)
        return _error(500, "保存连接器配置失败,请稍后重试")


@router.post("/managed/connect", response_model=None)
async def connect_managed_connector(
    req: ManagedConnectRequest,
    scope: str = Depends(connector_admin_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """一键接入平台托管连接器:用户不填任何凭据。

    凭据由平台部署环境提供,记录只落 ``managed=True``;执行时再注水。
    多租户模式下只有凭据归属租户可用,其他租户会被拒绝,不跨企业复用。
    """
    try:
        tpl = catalog.template_for(req.type)
        if tpl is None:
            return _error(400, f"不支持的连接器类型: {req.type}")
        key = managed.managed_key(req.type)
        existing = connector_store.get(scope, key, tenant_id=ctx.tenant_id)
        if existing is not None:
            if not bool(existing.get("managed")):
                return _error(409, f"该连接器 key 已被手动配置占用: {key}")
            return _safe(existing)
        try:
            record = managed.build_record(req.type, req.name, scope)
        except managed.ManagedUnavailable as e:
            return JSONResponse(
                status_code=400,
                content={
                    "error": "当前租户不能使用平台托管的该平台应用凭据,请配置本企业应用",
                    "missing_env": e.missing,
                    "reason": e.reason,
                    "type": req.type,
                },
            )
        now = connector_store.now_iso()
        record["installed_at"] = now
        record["updated_at"] = now
        record["last_sync_at"] = ""
        record["last_error"] = ""
        record["sync_items"] = []
        saved = connector_store.save(scope, record, tenant_id=ctx.tenant_id)
        if saved is None:
            return _error(500, "保存托管连接器失败")
        logger.info("平台托管连接器接入成功: %s(%s)", key, req.type)
        return _safe(saved)
    except Exception as e:  # noqa: BLE001
        logger.error("平台托管连接器接入失败(%s): %s", req.type, e)
        return _error(500, "平台托管连接器接入失败,请稍后重试")


@router.post("/sync", response_model=None)
async def sync_connector(
    req: ConnectorSyncRequest,
    scope: str = Depends(connector_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """同步连接器数据源:调模块 sync,结果持久化。"""
    try:
        rec = connector_store.get(scope, req.key, tenant_id=ctx.tenant_id)
        if rec is None:
            return _error(404, f"连接器不存在: {req.key}")
        if not rec.get("enabled", True):
            return _error(400, "连接器已停用,请先启用")
        if not _safe(rec)["configured"]:
            return _error(400, "未配置，无法同步")

        conn_type = str(rec.get("type") or "")
        exec_rec = _record_for_execution(rec, scope)
        if conn_type in LEGACY_TYPES:
            mod = get_connector(conn_type)
            if mod is None:
                return _error(500, "连接器模块未就绪")
            result = await mod.sync(exec_rec)
        else:
            result = await custom_http.sync(
                exec_rec,
                on_token_refreshed=_make_refresh_persister(
                    rec, scope, ctx.tenant_id, req.key
                ),
            )

        ok = bool(result.get("ok"))
        raw_items = result.get("items")
        items = list(raw_items) if isinstance(raw_items, list) else []
        last_sync_at = str(result.get("last_sync_at") or "")
        if ok:
            saved = connector_store.set_sync_state(
                scope, req.key, last_sync_at, "", items=items, tenant_id=ctx.tenant_id
            )
        else:
            saved = connector_store.set_sync_state(
                scope, req.key, "", str(result.get("message") or "同步失败"),
                tenant_id=ctx.tenant_id,
            )
        if saved is None:
            return _error(500, "同步已完成,但同步状态持久化失败,请稍后重试")
        logger.info("连接器同步 %s: ok=%s", req.key, ok)
        return {
            "ok": ok,
            "key": req.key,
            "type": conn_type,
            "message": str(result.get("message") or ""),
            "items": items,
            "last_sync_at": last_sync_at if ok else "",
        }
    except Exception as e:  # noqa: BLE001
        logger.error("连接器同步失败(%s): %s", req.key, e)
        return _error(500, "连接器同步失败,请稍后重试")


@router.post("/{key}/fetch", response_model=None)
async def fetch_connector_document(
    key: str,
    req: ConnectorFetchRequest,
    scope: str = Depends(connector_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """拉取单篇文档转纯文本(对齐 parse_document 语义;只认当前租户名下的连接器)。"""
    try:
        rec = connector_store.get(scope, key, tenant_id=ctx.tenant_id)
        if rec is None:
            return _error(404, f"连接器不存在: {key}")
        if not rec.get("enabled", True):
            return _error(400, "连接器已停用,请先启用")
        if not _safe(rec)["configured"]:
            return _error(400, "未配置，无法拉取文档")
        if not req.doc_id.strip():
            return _error(400, "doc_id 为空")

        conn_type = str(rec.get("type") or "")
        exec_rec = _record_for_execution(rec, scope)
        if conn_type in LEGACY_TYPES:
            mod = get_connector(conn_type)
            if mod is None or not hasattr(mod, "fetch_document"):
                return _error(500, "连接器模块未就绪")
            result = await mod.fetch_document(exec_rec, req.doc_id.strip())
        else:
            result = await custom_http.fetch_document(
                exec_rec,
                req.doc_id.strip(),
                on_token_refreshed=_make_refresh_persister(
                    rec, scope, ctx.tenant_id, key
                ),
            )
        return result if isinstance(result, dict) else {"ok": False, "message": "模块返回异常"}
    except Exception as e:  # noqa: BLE001
        logger.error("拉取连接器文档失败(%s): %s", key, e)
        return _error(500, "拉取连接器文档失败,请稍后重试")


@router.post("/{key}/invoke", response_model=None)
async def invoke_connector_operation(
    key: str,
    req: ConnectorInvokeRequest,
    user_id: str = Depends(require_request_user_id),
    scope: str = Depends(connector_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """执行一条声明式操作(读或写)。

    写操作(action)三重门:连接器开启 allow_write、请求带 confirm=true、
    执行后写审计;任一不满足直接拒绝。连接器按租户作用域读取,审计仍记真实操作者。
    """
    try:
        rec = connector_store.get(scope, key, tenant_id=ctx.tenant_id)
        if rec is None:
            return _error(404, f"连接器不存在: {key}")
        if not bool(rec.get("enabled")):
            return _error(400, "连接器已停用,请先启用")
        if not _safe(rec)["configured"]:
            return _error(400, "未配置，无法调用")

        operations = _effective_operations(rec)
        target = next(
            (op for op in operations if str(op.get("id")) == req.operation_id), None
        )
        if target is None:
            return _error(404, f"操作不存在: {req.operation_id}")
        if str(target.get("capability")) == "action":
            spec = ConnectorSpec.from_dict(rec.get("spec"))
            if not spec.allow_write:
                return _error(400, "该连接器未开启写权限,拒绝执行写操作")
            if not req.confirm:
                return _error(400, "写操作需要二次确认(confirm=true)")

        result = await custom_http.invoke(
            _record_for_execution(rec, scope),
            req.operation_id,
            req.params,
            on_token_refreshed=_make_refresh_persister(
                rec, scope, ctx.tenant_id, key
            ),
        )
        if str(target.get("capability")) == "action":
            custom_http.audit_write(rec, user_id, req.operation_id)
        return result
    except custom_http.ConnectorSecurityError as e:
        return _error(400, f"出站地址被安全策略拒绝: {e}")
    except custom_http._PartialFailure as e:  # noqa: SLF001 - 上游业务失败需带状态码
        logger.warning("连接器操作上游失败(%s/%s): %s", key, req.operation_id, e)
        return JSONResponse(
            status_code=502,
            content={
                "error": str(e),
                "status": e.status,
                "operation_id": e.operation_id,
                "data": str(e.data)[:2000],
            },
        )
    except ConnectorOperationError as e:
        return _error(400, str(e))
    except custom_http.ConnectorExecutionError as e:
        return _error(400, str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("连接器操作执行失败(%s/%s): %s", key, req.operation_id, e)
        return _error(500, "连接器操作执行失败,请稍后重试")


@router.post("/{key}/check", response_model=None)
async def check_connector(
    key: str,
    scope: str = Depends(connector_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """连通性自检(平台换 token / 自定义出站地址校验)。"""
    try:
        rec = connector_store.get(scope, key, tenant_id=ctx.tenant_id)
        if rec is None:
            return _error(404, f"连接器不存在: {key}")
        if not bool(rec.get("enabled")):
            return _error(400, "连接器已停用,请先启用")
        if not _safe(rec)["configured"]:
            return _error(400, "未配置，无法自检")
        result = await custom_http.check_connection(_record_for_execution(rec, scope))
        return result
    except custom_http.ConnectorExecutionError as e:
        return {"ok": False, "message": str(e)}
    except Exception as e:  # noqa: BLE001
        logger.error("连接器自检失败(%s): %s", key, e)
        return _error(500, "连接器自检失败,请稍后重试")


@router.post("/{key}/enable", response_model=None)
async def enable_connector(
    key: str,
    scope: str = Depends(connector_admin_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """启用连接器。"""
    try:
        if connector_store.get(scope, key, tenant_id=ctx.tenant_id) is None:
            return _error(404, f"连接器不存在: {key}")
        updated = connector_store.set_enabled(scope, key, True, tenant_id=ctx.tenant_id)
        if updated is None:
            return _error(500, "更新启用状态失败")
        return _safe(updated)
    except Exception as e:  # noqa: BLE001
        logger.error("启用连接器失败(%s): %s", key, e)
        return _error(500, "启用连接器失败,请稍后重试")


@router.post("/{key}/disable", response_model=None)
async def disable_connector(
    key: str,
    scope: str = Depends(connector_admin_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """停用连接器(保留持久化记录)。"""
    try:
        if connector_store.get(scope, key, tenant_id=ctx.tenant_id) is None:
            return _error(404, f"连接器不存在: {key}")
        updated = connector_store.set_enabled(scope, key, False, tenant_id=ctx.tenant_id)
        if updated is None:
            return _error(500, "更新启用状态失败")
        return _safe(updated)
    except Exception as e:  # noqa: BLE001
        logger.error("停用连接器失败(%s): %s", key, e)
        return _error(500, "停用连接器失败,请稍后重试")


@router.delete("/{key}", response_model=None)
async def delete_connector(
    key: str,
    scope: str = Depends(connector_admin_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """删除连接器配置(只删当前租户名下的;别的租户与"没这条"同形返回 404)。"""
    try:
        rec = connector_store.get(scope, key, tenant_id=ctx.tenant_id)
        if rec is None:
            return _error(404, f"连接器不存在: {key}")
        if not connector_store.remove(scope, key, tenant_id=ctx.tenant_id):
            return _error(500, "删除连接器失败,请稍后重试")
        custom_http.clear_token_cache(rec)
        logger.info("连接器已删除: %s", key)
        return {"ok": True}
    except Exception as e:  # noqa: BLE001
        logger.error("删除连接器失败(%s): %s", key, e)
        return _error(500, "删除连接器失败,请稍后重试")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# ---------------------------------------------------------------------------
# 企业微信智能机器人 MCP(成员授权办公能力,与自建应用 wecom_corp 并存)
# 官方 2026-11-05 上线的「可使用权限」:成员授权后机器人可代替成员操作
# 文档/表格/智能表格/待办/日程/会议/微盘/通讯录。端点(apikey)加密落库。
# ---------------------------------------------------------------------------


class WecomRobotAuthorizeRequest(BaseModel):
    """用户在企微客户端「可使用权限」授权后复制的 MCP URL / JSON Config。"""

    config: str = Field(..., min_length=1, max_length=8192)


class WecomRobotInvokeRequest(BaseModel):
    tool: str = Field(..., min_length=1, max_length=128)
    arguments: dict[str, Any] = Field(default_factory=dict)


@router.get("/wecom-robot/status", response_model=None)
async def wecom_robot_status(
    user_id: str = Depends(require_request_user_id),
    scope: str = Depends(connector_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any]:
    """企微机器人授权状态(脱敏,绝不含 apikey)。"""
    from ..services.connectors import wecom_robot

    return wecom_robot.status(scope, ctx.tenant_id)


@router.post("/wecom-robot/authorize", response_model=None)
async def wecom_robot_authorize(
    req: WecomRobotAuthorizeRequest,
    user_id: str = Depends(require_request_user_id),
    scope: str = Depends(connector_admin_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """保存 MCP 端点(加密落库)。仅租户 owner/admin 可写共享凭据。"""
    from ..services.connectors import wecom_mcp, wecom_robot

    try:
        return wecom_robot.save_endpoint(scope, ctx.tenant_id, req.config)
    except wecom_mcp.WecomMcpError as e:
        return _error(400, f"MCP 端点非法: {e}")
    except wecom_robot.WecomRobotError as e:
        return _error(400, str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("[wecom_robot] 保存端点失败: %s", e)
        return _error(500, "保存失败,请稍后重试")


@router.get("/wecom-robot/tools", response_model=None)
async def wecom_robot_tools(
    user_id: str = Depends(require_request_user_id),
    scope: str = Depends(connector_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """拉取授权范围内的 MCP 工具清单(含 inputSchema)。"""
    from ..services.connectors import wecom_robot

    try:
        tools = await wecom_robot.list_tools(scope, ctx.tenant_id)
        return {"tools": tools, "count": len(tools)}
    except wecom_robot.WecomRobotError as e:
        return _error(400, str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("[wecom_robot] tools/list 失败: %s", e)
        return _error(502, f"拉取工具失败: {type(e).__name__}")


@router.post("/wecom-robot/invoke", response_model=None)
async def wecom_robot_invoke(
    req: WecomRobotInvokeRequest,
    user_id: str = Depends(require_request_user_id),
    scope: str = Depends(connector_scope),
    ctx: ConnectorScope = Depends(connector_context),
) -> dict[str, Any] | JSONResponse:
    """调用一个授权范围内的 MCP 工具。只读/写由工具自身权限位决定。"""
    from ..services.connectors import wecom_robot

    try:
        result = await wecom_robot.invoke(scope, ctx.tenant_id, req.tool, req.arguments)
        return {"ok": True, "tool": req.tool, "result": result}
    except wecom_robot.WecomRobotError as e:
        return _error(400, str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("[wecom_robot] tools/call 失败: %s", e)
        return _error(502, f"调用失败: {type(e).__name__}")
