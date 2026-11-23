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

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..core.jwt_auth import require_request_user_id
from ..services import connector_store
from ..services import connectors as connector_registry
from ..services.connectors import catalog, custom_http, managed, openapi_import
from ..services.connectors import get_connector
from ..services.connectors.base import (
    CAPABILITIES,
    CONNECTOR_MODES,
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
            # 托管连接器不落任何密钥;记录只声明"凭据由平台提供"
            app_id = ""
            app_secret = ""
            credential_source = (
                "public" if req.type in {"yuque"} else "platform_env"
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
            result = await custom_http.sync(exec_rec)

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
                exec_rec, req.doc_id.strip()
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
            _record_for_execution(rec, scope), req.operation_id, req.params
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
