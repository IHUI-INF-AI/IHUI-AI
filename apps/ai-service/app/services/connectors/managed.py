# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""平台托管凭据(2026-11-23 立)。

目标:终端用户不再填 app_id/app_secret。平台侧在部署环境配置一次应用凭据,
用户点「一键接入」即可;连接器记录本身只存 ``managed=True``,不落密钥。

- 凭据只在执行前从进程环境读取并注水到执行副本,不做持久化、不进响应体。
- 环境缺失时返回 ``available=False`` 与缺失键名(只给键名,不给值),
  前端据此把入口降级为「平台管理员配置」。
- 多租户场景下,平台仍应把应用发布到各开放平台;本模块只解决单企业部署
  的零配置接入,不伪造企业级授权。
"""

from __future__ import annotations

import os
from typing import Any

from . import catalog

# 类型 -> 环境变量候选。同一语义允许多个历史命名,按顺序取第一个非空值。
_CREDENTIAL_ENV: dict[str, dict[str, tuple[str, ...]]] = {
    "feishu": {
        "app_id": ("FEISHU_APP_ID",),
        "app_secret": ("FEISHU_APP_SECRET",),
    },
    "dingtalk": {
        "app_id": ("DINGTALK_APP_KEY", "DINGTALK_APPKEY"),
        "app_secret": ("DINGTALK_APP_SECRET", "DINGTALK_APPSECRET"),
    },
    "wecom": {
        "app_id": ("WECOM_CORP_ID",),
        "app_secret": ("WECOM_SECRET",),
    },
    "wechat_mp": {
        "app_id": ("WECHAT_MP_APP_ID", "WECHAT_MP_APPID"),
        "app_secret": ("WECHAT_MP_APP_SECRET", "WECHAT_MP_APPSECRET"),
    },
}

# 可托管的额外配置(非凭据,但用户也不该填)
_EXTRA_ENV: dict[str, dict[str, tuple[str, ...]]] = {
    "dingtalk": {"agent_id": ("DINGTALK_AGENT_ID",)},
    "wecom": {"agent_id": ("WECOM_AGENT_ID",)},
}

# 公开接口类型:不需要平台密钥,仍可一键接入(语雀公开知识库)
_PUBLIC_TYPES = {"yuque"}


class ManagedUnavailable(RuntimeError):
    """平台托管凭据未配置。"""

    def __init__(self, conn_type: str, missing: list[str]):
        self.conn_type = conn_type
        self.missing = missing
        super().__init__(f"平台托管凭据未配置: {', '.join(missing)}")


def _env_value(names: tuple[str, ...]) -> str:
    for name in names:
        value = str(os.environ.get(name) or "").strip()
        if value:
            return value
    return ""


def managed_key(conn_type: str) -> str:
    """托管连接器的稳定 key(同一类型只应有一条)。"""
    return f"{conn_type}:managed"


def status(conn_type: str) -> dict[str, Any]:
    """返回托管可用性;缺失只暴露环境变量名。"""
    tpl = catalog.template_for(conn_type)
    if tpl is None:
        return {
            "available": False,
            "supported": False,
            "credential_source": "",
            "missing": [],
            "reason": "该类型不支持预置模板",
        }
    if conn_type in _PUBLIC_TYPES:
        return {
            "available": True,
            "supported": True,
            "credential_source": "public",
            "missing": [],
            "reason": "",
        }
    spec = _CREDENTIAL_ENV.get(conn_type)
    if not spec:
        return {
            "available": False,
            "supported": False,
            "credential_source": "",
            "missing": [],
            "reason": "该平台需要企业自建应用凭据,不能由平台托管",
        }
    missing: list[str] = []
    for names in spec.values():
        if not _env_value(names):
            missing.extend(names)
    return {
        "available": not missing,
        "supported": True,
        "credential_source": "platform_env",
        "missing": missing,
        "reason": "" if not missing else "平台管理员尚未配置该平台应用凭据",
    }


def credentials(conn_type: str) -> dict[str, Any]:
    """读取托管凭据;不可用时抛 ManagedUnavailable。"""
    st = status(conn_type)
    if not st["available"]:
        raise ManagedUnavailable(conn_type, list(st["missing"]))
    if conn_type in _PUBLIC_TYPES:
        return {"app_id": "", "app_secret": "", "extra": {}}
    spec = _CREDENTIAL_ENV[conn_type]
    app_id = _env_value(spec["app_id"])
    app_secret = _env_value(spec["app_secret"])
    extra: dict[str, Any] = {}
    for key, names in _EXTRA_ENV.get(conn_type, {}).items():
        value = _env_value(names)
        if value:
            extra[key] = value
    return {"app_id": app_id, "app_secret": app_secret, "extra": extra}


def hydrate(record: dict[str, Any]) -> dict[str, Any]:
    """给托管记录补运行期凭据;非托管记录原样返回。

    只在内存副本上注水 —— app_id/app_secret 永不写回 connector_store,
    也永不进入 /connectors 列表响应。
    """
    if not bool(record.get("managed")):
        return record
    conn_type = str(record.get("type") or "")
    try:
        cred = credentials(conn_type)
    except ManagedUnavailable as exc:
        raise RuntimeError(
            f"平台托管凭据未配置,请管理员补齐环境变量: {', '.join(exc.missing)}"
        ) from exc
    enriched = dict(record)
    enriched["app_id"] = cred["app_id"]
    enriched["app_secret"] = cred["app_secret"]
    merged_extra = dict(record.get("extra") or {})
    for key, value in cred["extra"].items():
        merged_extra.setdefault(key, value)
    enriched["extra"] = merged_extra
    return enriched


def build_record(conn_type: str, name: str = "") -> dict[str, Any]:
    """构造托管连接器记录(不含任何密钥)。"""
    tpl = catalog.template_for(conn_type)
    if tpl is None:
        raise RuntimeError(f"不支持的连接器类型: {conn_type}")
    cred = credentials(conn_type)
    spec: dict[str, Any] = {
        "base_url": str(tpl.get("base_url") or ""),
        "auth_kind": str(tpl.get("auth_kind") or "none"),
        "auth_name": str(tpl.get("auth_name") or "Authorization"),
        "auth_scheme": "Bearer",
        "headers": {},
        "timeout_s": 15.0,
        "allow_write": False,
        "allow_private_hosts": False,
    }
    return {
        "key": managed_key(conn_type),
        "type": conn_type,
        "name": name.strip() or str(tpl.get("label") or conn_type),
        "app_id": "",
        "app_secret": "",
        "extra": dict(cred["extra"]),
        "mode": "preset",
        "spec": spec,
        "operations": catalog.default_operations(conn_type),
        "enabled": True,
        "managed": True,
        "credential_source": "public" if conn_type in _PUBLIC_TYPES else "platform_env",
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
