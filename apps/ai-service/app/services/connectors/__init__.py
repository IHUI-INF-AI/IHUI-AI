# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""中文 Connectors 统一接口(2026-09-02 立,P2-2)。

让对话能"读取飞书文档/语雀知识库/企业微信/钉钉"的内容并转结构化返回。

统一接口(所有 connector 模块必须实现):
    async def sync(record: dict) -> dict:
        同步连接器数据源。
        返回 {"ok": bool, "message": str, "items": list[dict], "last_sync_at": str}
        items 元素形如 {"doc_id": str, "title": str}

    async def fetch_document(record: dict, doc_id: str) -> dict:
        拉取单篇文档转纯文本。
        返回 {"ok": bool, "title": str, "content": str, "chars": int,
              "truncated": bool, "message": str}
        语义对齐 app/tools/document_tools.py 的 parse_document 返回值。

注册表:
    REGISTRY: dict[str, ModuleType]  # type -> module
    get_connector(type) -> module | None

连接器类型:
    SUPPORTED_TYPES = ("yuque", "feishu", "wecom", "dingtalk")

超长截断:
    MAX_DOC_CHARS = 20000  # 与 document_tools.DEFAULT_MAX_CHARS 一致
"""

from __future__ import annotations

import logging
import types
from typing import Any

# 文档内容注入 LLM 上下文的上限(与 document_tools.DEFAULT_MAX_CHARS 一致)
MAX_DOC_CHARS: int = 20000

# 支持的连接器类型
SUPPORTED_TYPES: tuple[str, ...] = ("yuque", "feishu", "wecom", "dingtalk")

# 类型 -> connector 模块
REGISTRY: dict[str, types.ModuleType] = {}


def get_connector(conn_type: str) -> Any | None:
    """按类型取 connector 模块;未注册/不支持返回 None。"""
    return REGISTRY.get(conn_type)


def _register(name: str) -> None:
    """尝试导入并注册一个 connector 模块;导入失败仅告警,不崩 import。"""
    try:
        mod = __import__(f"app.services.connectors.{name}", fromlist=[name])
        REGISTRY[name] = mod
        logging.getLogger(__name__).info("connector 注册成功: %s", name)
    except Exception:  # noqa: BLE001 - 并行开发期模块可能尚未就绪,降级跳过
        logging.warning("connector 注册失败(跳过): %s", name)


# 语雀(本 worker 实现)+ 飞书/企微/钉钉(并行 worker 实现,未就绪时自动跳过)
for _type in SUPPORTED_TYPES:
    _register(_type)
