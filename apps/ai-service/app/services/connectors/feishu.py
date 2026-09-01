# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""飞书云文档 Connector(2026-09-02 立)。

对标竞品"读取飞书文档"能力:通过飞书开放平台「云文档」API,
让 AI 对话能列出/读取飞书云文档内容并转为纯文本。

- token 复用 app/services/im/feishu_lark.py 的 FeishuLarkAdapter(不重复造轮子)
- 文档列表:GET /open-apis/drive/v1/files(folder_token 缺省用根目录)
- 单篇文档:GET /open-apis/docx/v1/documents/{doc_id} 拿 document_id + title,
  再 GET /open-apis/docx/v1/documents/{document_id}/blocks 遍历 blocks 拼纯文本
- 统一接口:CONNECTOR_TYPE + sync(record) + fetch_document(record, doc_id),
  供 Connector 路由层按类型分发

网络层用 httpx(已在 pyproject.toml 依赖中);所有对外方法不抛异常,
异常统一降级为 {ok: False, message: ...}(不崩服务)。
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import httpx

from app.services.im.feishu_lark import FeishuLarkAdapter

logger = logging.getLogger(__name__)

# 统一接口标识:路由层据此分发
CONNECTOR_TYPE = "feishu"

# 单篇文档拉取最大字符数(超出截断,truncated=True)
MAX_DOC_CHARS = 20000

# 飞书开放平台 REST API 基础 URL
_FEISHU_BASE_URL = "https://open.feishu.cn/open-apis"

# HTTP 超时(秒)
_HTTP_TIMEOUT_S = 10.0

# 文档列表单页条数(飞书 drive v1 上限 100)
_FILES_PAGE_SIZE = 100

# docx blocks 单页条数(飞书上限 500)
_BLOCKS_PAGE_SIZE = 500

# blocks 遍历页数上限(防死循环)
_MAX_BLOCK_PAGES = 200


class FeishuConnector:
    """飞书云文档连接器(封装 token 复用 + 云文档 API 调用)。"""

    def __init__(self, record: dict[str, Any]) -> None:
        self.record = record
        self.app_id = (record.get("app_id") or "").strip()
        self.app_secret = (record.get("app_secret") or "").strip()
        # 复用 FeishuLarkAdapter:token 缓存 / 获取逻辑已有,不重复实现
        self._adapter: FeishuLarkAdapter | None = (
            FeishuLarkAdapter(self.app_id, self.app_secret)
            if self.app_id and self.app_secret
            else None
        )
        self._extra: dict[str, Any] = record.get("extra") or {}

    def _configured(self) -> bool:
        return bool(self.app_id and self.app_secret)

    async def _headers(self) -> dict[str, str]:
        """复用 FeishuLarkAdapter 的 tenant_access_token(含缓存)。

        Raises:
            RuntimeError: 未配置凭据或 token 获取失败。
        """
        if self._adapter is None:
            raise RuntimeError("未配置飞书 app_id/app_secret")
        token = await self._adapter.get_tenant_access_token()
        if not token:
            raise RuntimeError("获取飞书 tenant_access_token 失败")
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        url: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """GET 飞书开放平台 API,统一解析 JSON(异常降级为错误码响应)。"""
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
            resp = await client.get(url, headers=headers, params=params)
        try:
            data = resp.json()
        except ValueError:
            return {"code": -1, "msg": f"非 JSON 响应(status={resp.status_code})"}
        if not isinstance(data, dict):
            return {"code": -1, "msg": "响应格式异常"}
        return data

    async def sync(self) -> dict[str, Any]:
        """拉取飞书云文档列表(指定文件夹,缺省根目录)。"""
        if not self._configured():
            return {
                "ok": False,
                "message": "未配置飞书 app_id/app_secret",
                "items": [],
                "last_sync_at": "",
            }
        folder_token = (self._extra.get("folder_token") or "").strip() or None
        params: dict[str, Any] = {"page_size": _FILES_PAGE_SIZE}
        if folder_token:
            params["folder_token"] = folder_token
        try:
            data = await self._request(
                f"{_FEISHU_BASE_URL}/drive/v1/files", params=params
            )
        except RuntimeError as e:
            return {"ok": False, "message": str(e), "items": [], "last_sync_at": ""}
        except Exception as e:
            logger.warning("[FeishuConnector] sync 网络异常: %s", e)
            return {
                "ok": False,
                "message": f"同步飞书文档失败: {e}",
                "items": [],
                "last_sync_at": "",
            }

        if data.get("code") != 0:
            return {
                "ok": False,
                "message": f"飞书 API 错误: {data.get('msg')} (code={data.get('code')})",
                "items": [],
                "last_sync_at": "",
            }

        items: list[dict[str, str]] = []
        for f in (data.get("data") or {}).get("files") or []:
            if not isinstance(f, dict):
                continue
            # 只收集 docx 云文档(sheet/bitable 等不支持 docx API 拉取)
            if f.get("type") not in ("docx", "doc"):
                continue
            doc_id = f.get("token") or ""
            title = f.get("name") or ""
            if not doc_id:
                continue
            items.append({"doc_id": doc_id, "title": title})

        return {
            "ok": True,
            "message": f"同步 {len(items)} 篇飞书云文档",
            "items": items,
            "last_sync_at": _now_iso(),
        }

    async def fetch_document(self, doc_id: str) -> dict[str, Any]:
        """拉取单篇飞书云文档并转纯文本(超出 MAX_DOC_CHARS 截断)。"""
        doc_id = (doc_id or "").strip()
        if not doc_id:
            return self._doc_fail("缺少 doc_id")
        if not self._configured():
            return self._doc_fail("未配置飞书 app_id/app_secret")
        try:
            # 1. 文档元信息:document_id + title
            meta = await self._request(
                f"{_FEISHU_BASE_URL}/docx/v1/documents/{doc_id}"
            )
            if meta.get("code") != 0:
                return self._doc_fail(
                    f"飞书文档接口错误: {meta.get('msg')} (code={meta.get('code')})"
                )
            document = (meta.get("data") or {}).get("document") or {}
            real_doc_id: str = document.get("document_id") or doc_id
            title = document.get("title") or ""

            # 2. 遍历 blocks 拼纯文本
            parts, truncated = await self._collect_blocks(real_doc_id)
        except RuntimeError as e:
            return self._doc_fail(str(e))
        except Exception as e:
            logger.warning("[FeishuConnector] fetch_document 异常: %s", e)
            return self._doc_fail(f"拉取飞书文档失败: {e}")

        content = "\n".join(parts)
        chars = len(content)
        if chars > MAX_DOC_CHARS:
            content = content[:MAX_DOC_CHARS]
            chars = MAX_DOC_CHARS
            truncated = True
        return {
            "ok": True,
            "title": title,
            "content": content,
            "chars": chars,
            "truncated": truncated,
            "message": f"已拉取飞书文档「{title}」({chars} 字)",
        }

    async def _collect_blocks(self, document_id: str) -> tuple[list[str], bool]:
        """遍历 docx blocks 收集文本片段(分页拉取,超长提前终止)。

        Returns:
            (文本片段列表, 是否因超长截断)。
        """
        parts: list[str] = []
        total = 0
        page_token: str | None = None
        for _ in range(_MAX_BLOCK_PAGES):
            params: dict[str, Any] = {"page_size": _BLOCKS_PAGE_SIZE}
            if page_token:
                params["page_token"] = page_token
            data = await self._request(
                f"{_FEISHU_BASE_URL}/docx/v1/documents/{document_id}/blocks",
                params=params,
            )
            if data.get("code") != 0:
                raise RuntimeError(
                    f"飞书 blocks 接口错误: {data.get('msg')} (code={data.get('code')})"
                )
            item = data.get("data") or {}
            for block in item.get("items") or []:
                if not isinstance(block, dict):
                    continue
                text = _extract_block_text(block)
                if text:
                    parts.append(text)
                    total += len(text)
            if total >= MAX_DOC_CHARS:
                return parts, True
            page_token = item.get("page_token")
            if not page_token:
                return parts, False
        return parts, False

    @staticmethod
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
# 统一接口(路由层按 CONNECTOR_TYPE 调用)
# ============================================================================


async def sync(record: dict[str, Any]) -> dict[str, Any]:
    """同步飞书连接器数据源。"""
    return await FeishuConnector(record).sync()


async def fetch_document(record: dict[str, Any], doc_id: str) -> dict[str, Any]:
    """拉取单篇飞书文档转纯文本。"""
    return await FeishuConnector(record).fetch_document(doc_id)


# ============================================================================
# 辅助函数
# ============================================================================


def _extract_block_text(block: dict[str, Any]) -> str:
    """从飞书 docx block 中提取纯文本。

    text/heading/quote/bullet 等块取 block["text"]["element"],
    code 块取 block["code"]["element"];每个 element 的 text_run.content
    是文本内容。不同 run 直接拼接,不同 block 由调用方以换行分隔。
    """
    try:
        elements: list[Any] = []
        if isinstance(block.get("text"), dict):
            elements = (block["text"].get("element") or []) or []
        elif isinstance(block.get("code"), dict):
            elements = (block["code"].get("element") or []) or []
        texts: list[str] = []
        for el in elements:
            if not isinstance(el, dict):
                continue
            run = el.get("text_run")
            if not isinstance(run, dict):
                continue
            content = run.get("content")
            if isinstance(content, str) and content:
                texts.append(content)
        return "".join(texts)
    except Exception:
        return ""


def _now_iso() -> str:
    """当前 UTC 时间 ISO 格式。"""
    return datetime.now(UTC).isoformat()
