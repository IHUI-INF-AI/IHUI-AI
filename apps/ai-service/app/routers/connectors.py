# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Connectors 路由(2026-09-02 立,P2-2 中文连接器)。

让对话能"读取飞书文档/语雀知识库/企业微信/钉钉"的内容并转结构化返回。
- 配置持久化走 app.services.connector_store(JSON 文件)
- 实际同步/拉取走 app.services.connectors 注册表(yuque/feishu/wecom/dingtalk)
- 所有返回条目均脱敏:绝不返回 app_id/app_secret 明文
- 全部端点 try/except 降级:内部异常返回 500 且 message 明确,不裸抛
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..services import connector_store
from ..services.connectors import SUPPORTED_TYPES, get_connector

logger = logging.getLogger(__name__)

# 路由前缀 /connectors,main.py 里 include_router(prefix="/api") 后完整路径为 /api/connectors/*
router = APIRouter(prefix="/connectors")


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class ConnectorConfigRequest(BaseModel):
    """连接器配置保存请求(POST /connectors/config)。

    app_secret 传空串时保留旧值(防止前端回显覆盖密钥)。
    """

    key: str = Field(..., min_length=1, description="唯一标识,格式 {type}:{slug}")
    type: str = Field(..., min_length=1, description="连接器类型: yuque|feishu|wecom|dingtalk")
    name: str = Field("", description="显示名")
    app_id: str = Field("", description="开放平台 app_id")
    app_secret: str = Field("", description="密钥(空串时保留旧值)")
    extra: dict[str, Any] = Field(default_factory=dict, description="类型专属配置")


class ConnectorSyncRequest(BaseModel):
    """连接器同步请求(POST /connectors/sync)。"""

    key: str = Field(..., min_length=1, description="连接器记录 key")


class ConnectorFetchRequest(BaseModel):
    """单篇文档拉取请求(POST /connectors/{key}/fetch)。"""

    doc_id: str = Field("", description="文档 slug/id(空串由 handler 判定返回 400)")


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def _safe(rec: dict[str, Any]) -> dict[str, Any]:
    """脱敏输出条目:不返回 app_id/app_secret 明文。

    configured = extra 非空 或 app_id 非空(语雀看 extra.user/repo)。
    capabilities 由注册表是否有对应模块决定。
    """
    extra = rec.get("extra")
    extra = dict(extra) if isinstance(extra, dict) else {}
    configured = bool(extra) or bool(rec.get("app_id"))
    mod = get_connector(str(rec.get("type") or ""))
    return {
        "key": str(rec.get("key") or ""),
        "type": str(rec.get("type") or ""),
        "name": str(rec.get("name") or ""),
        "extra": extra,
        "configured": configured,
        "enabled": bool(rec.get("enabled")),
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


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.get("", response_model=None)
async def list_connectors() -> dict[str, Any] | JSONResponse:
    """列出全部连接器配置(脱敏)。"""
    try:
        records = connector_store.list_all()
        items = [_safe(rec) for rec in records]
        return {"connectors": items, "count": len(items)}
    except Exception as e:  # noqa: BLE001 - 内部异常降级,不裸抛
        logger.error("获取连接器列表失败: %s", e)
        return _error(500, f"获取连接器列表失败: {e}")


@router.post("/config", response_model=None)
async def save_connector_config(req: ConnectorConfigRequest) -> dict[str, Any] | JSONResponse:
    """新增或覆盖连接器配置;返回脱敏条目。"""
    try:
        if req.type not in SUPPORTED_TYPES:
            return _error(400, f"不支持的连接器类型: {req.type}")
        existing = connector_store.get(req.key)
        if existing is not None:
            # app_secret 空串保留旧值(防前端回显覆盖密钥);app_id 同样防覆盖
            app_secret = req.app_secret if req.app_secret else str(existing.get("app_secret") or "")
            app_id = req.app_id if req.app_id else str(existing.get("app_id") or "")
            installed_at = str(existing.get("installed_at") or "")
        else:
            app_secret = req.app_secret
            app_id = req.app_id
            installed_at = connector_store.now_iso()
        record = {
            "key": req.key,
            "type": req.type,
            "name": req.name or req.key,
            "app_id": app_id,
            "app_secret": app_secret,
            "extra": dict(req.extra or {}),
            "enabled": bool((existing or {}).get("enabled", True)),
            "installed_at": installed_at,
            "updated_at": connector_store.now_iso(),
            "last_sync_at": str((existing or {}).get("last_sync_at") or ""),
            "last_error": str((existing or {}).get("last_error") or ""),
            "sync_items": list((existing or {}).get("sync_items") or []),
        }
        saved = connector_store.save(record)
        if saved is None:
            return _error(500, "保存连接器配置失败")
        logger.info("连接器配置保存成功: %s(%s)", req.key, req.type)
        return _safe(saved)
    except Exception as e:  # noqa: BLE001
        logger.error("保存连接器配置失败(%s): %s", req.key, e)
        return _error(500, f"保存连接器配置失败: {e}")


@router.post("/sync", response_model=None)
async def sync_connector(req: ConnectorSyncRequest) -> dict[str, Any] | JSONResponse:
    """同步连接器数据源:调模块 sync,结果持久化。
    成功记 last_sync_at + sync_items;失败记 last_error。
    """
    try:
        rec = connector_store.get(req.key)
        if rec is None:
            return _error(404, f"连接器不存在: {req.key}")
        if not _safe(rec)["configured"]:
            return _error(400, "未配置，无法同步")
        mod = get_connector(str(rec.get("type") or ""))
        if mod is None or not hasattr(mod, "sync"):
            return _error(500, "连接器模块未就绪")
        result = await mod.sync(rec)
        ok = bool(result.get("ok"))
        raw_items = result.get("items")
        items = list(raw_items) if isinstance(raw_items, list) else []
        last_sync_at = str(result.get("last_sync_at") or "")
        if ok:
            connector_store.set_sync_state(req.key, last_sync_at, "", items=items)
        else:
            connector_store.set_sync_state(req.key, "", str(result.get("message") or "同步失败"))
        logger.info("连接器同步 %s: ok=%s", req.key, ok)
        return {
            "ok": ok,
            "key": req.key,
            "type": str(rec.get("type") or ""),
            "message": str(result.get("message") or ""),
            "items": items,
            "last_sync_at": last_sync_at if ok else "",
        }
    except Exception as e:  # noqa: BLE001
        logger.error("连接器同步失败(%s): %s", req.key, e)
        return _error(500, f"连接器同步失败: {e}")


@router.post("/{key}/fetch", response_model=None)
async def fetch_connector_document(
    key: str, req: ConnectorFetchRequest
) -> dict[str, Any] | JSONResponse:
    """拉取单篇文档转纯文本(对齐 parse_document 语义)。"""
    try:
        rec = connector_store.get(key)
        if rec is None:
            return _error(404, f"连接器不存在: {key}")
        if not _safe(rec)["configured"]:
            return _error(400, "未配置，无法拉取文档")
        if not req.doc_id.strip():
            return _error(400, "doc_id 为空")
        mod = get_connector(str(rec.get("type") or ""))
        if mod is None or not hasattr(mod, "fetch_document"):
            return _error(500, "连接器模块未就绪")
        result = await mod.fetch_document(rec, req.doc_id.strip())
        return result if isinstance(result, dict) else {"ok": False, "message": "模块返回异常"}
    except Exception as e:  # noqa: BLE001
        logger.error("拉取连接器文档失败(%s): %s", key, e)
        return _error(500, f"拉取连接器文档失败: {e}")


@router.post("/{key}/enable", response_model=None)
async def enable_connector(key: str) -> dict[str, Any] | JSONResponse:
    """启用连接器。"""
    try:
        if connector_store.get(key) is None:
            return _error(404, f"连接器不存在: {key}")
        updated = connector_store.set_enabled(key, True)
        if updated is None:
            return _error(500, "更新启用状态失败")
        return _safe(updated)
    except Exception as e:  # noqa: BLE001
        logger.error("启用连接器失败(%s): %s", key, e)
        return _error(500, f"启用连接器失败: {e}")


@router.post("/{key}/disable", response_model=None)
async def disable_connector(key: str) -> dict[str, Any] | JSONResponse:
    """停用连接器(保留持久化记录)。"""
    try:
        if connector_store.get(key) is None:
            return _error(404, f"连接器不存在: {key}")
        updated = connector_store.set_enabled(key, False)
        if updated is None:
            return _error(500, "更新启用状态失败")
        return _safe(updated)
    except Exception as e:  # noqa: BLE001
        logger.error("停用连接器失败(%s): %s", key, e)
        return _error(500, f"停用连接器失败: {e}")


@router.delete("/{key}", response_model=None)
async def delete_connector(key: str) -> dict[str, Any] | JSONResponse:
    """删除连接器配置。"""
    try:
        if connector_store.get(key) is None:
            return _error(404, f"连接器不存在: {key}")
        connector_store.remove(key)
        logger.info("连接器已删除: %s", key)
        return {"ok": True}
    except Exception as e:  # noqa: BLE001
        logger.error("删除连接器失败(%s): %s", key, e)
        return _error(500, f"删除连接器失败: {e}")
