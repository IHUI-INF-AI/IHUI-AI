# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""企业微信 Connector(2026-09-02 立,2026-09-20 接入微盘)。

通过企业微信「微盘」API,让 AI 对话能列出/读取微盘文件内容并转为纯文本:
- token 获取:GET /cgi-bin/gettoken(corpid + corpsecret,带进程内缓存)
- 文件列表:POST /cgi-bin/wedrive/file_list(space_id 必填,取 extra.space_id;
  father_id 缺省 0 即根目录;next_start 分页拉取)
- 单文件读取:POST /cgi-bin/wedrive/file_download 换 download_url,
  GET 下载字节(须回带响应中的 cookie),utf-8 解码失败视为非文本文件

统一接口:CONNECTOR_TYPE + sync(record) + fetch_document(record, doc_id),
供 Connector 路由层按类型分发。所有对外方法不抛异常,异常降级为
{ok: False, message: ...}(不崩服务)。
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# 统一接口标识:路由层据此分发
CONNECTOR_TYPE = "wecom"

# 单篇文档拉取最大字符数(超出截断,truncated=True)
MAX_DOC_CHARS = 20000

# 企业微信 API 基础 URL
_WECOM_BASE_URL = "https://qyapi.weixin.qq.com/cgi-bin"

# HTTP 超时(秒)
_HTTP_TIMEOUT_S = 10.0

# access_token 缓存 TTL(秒,略小于 2 小时,提前刷新)
_TOKEN_TTL_S = 7100

# 微盘文件列表单页条数(接口上限 100)
_FILE_LIST_PAGE_SIZE = 100

# 文件列表翻页次数上限(防死循环)
_MAX_FILE_PAGES = 50


class WecomConnector:
    """企业微信连接器(封装 token 缓存 + 微盘文件列表/下载解析)。"""

    def __init__(self, record: dict[str, Any]) -> None:
        self.record = record
        self.corpid = (record.get("app_id") or "").strip()
        self.corpsecret = (record.get("app_secret") or "").strip()
        self._extra: dict[str, Any] = record.get("extra") or {}
        self._cached_token: str | None = None
        self._token_expire_at = 0.0

    def _configured(self) -> bool:
        return bool(self.corpid and self.corpsecret)

    async def get_access_token(self) -> str | None:
        """获取企业微信 access_token(带进程内缓存)。

        微盘文件列表 / 文件下载等能力的公共第一步,失败返回 None。
        """
        if not self._configured():
            return None
        if self._cached_token and time.time() < self._token_expire_at:
            return self._cached_token
        url = f"{_WECOM_BASE_URL}/gettoken"
        params = {"corpid": self.corpid, "corpsecret": self.corpsecret}
        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
                resp = await client.get(url, params=params)
            data = resp.json()
        except Exception as e:
            logger.warning("[WecomConnector] 获取 access_token 失败: %s", e)
            return None
        if not isinstance(data, dict):
            logger.warning("[WecomConnector] gettoken 响应格式异常")
            return None
        if data.get("errcode") != 0:
            logger.warning("[WecomConnector] gettoken 错误: %s", data.get("errmsg"))
            return None
        token = data.get("access_token")
        if not isinstance(token, str) or not token:
            return None
        self._cached_token = token
        self._token_expire_at = time.time() + _TOKEN_TTL_S
        return token

    def _space_id(self) -> int | None:
        """从 extra 读微盘 space_id(必填数字);缺失/非法返回 None。"""
        raw = self._extra.get("space_id")
        if raw is None or raw == "":
            return None
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None

    def _father_id(self) -> int:
        """从 extra 读目录 father_id;缺省 0 即微盘根目录。"""
        try:
            return int(self._extra.get("father_id") or 0)
        except (TypeError, ValueError):
            return 0

    async def _post(self, url: str, *, body: dict[str, Any]) -> dict[str, Any]:
        """POST 企业微信 API(自动带 access_token),统一解析 JSON。

        Raises:
            RuntimeError: access_token 获取失败。
        """
        token = await self.get_access_token()
        if not token:
            raise RuntimeError("获取企业微信 access_token 失败")
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
            resp = await client.post(url, params={"access_token": token}, json=body)
        try:
            data = resp.json()
        except ValueError:
            return {"errcode": -1, "errmsg": f"非 JSON 响应(status={resp.status_code})"}
        if not isinstance(data, dict):
            return {"errcode": -1, "errmsg": "响应格式异常"}
        return data

    async def sync(self) -> dict[str, Any]:
        """拉取微盘文件列表(extra.space_id 必填,father_id 缺省根目录)。"""
        if not self._configured():
            return {
                "ok": False,
                "message": "未配置企业微信 corpid/corpsecret",
                "items": [],
                "last_sync_at": "",
            }
        space_id = self._space_id()
        if space_id is None:
            return {
                "ok": False,
                "message": "未配置微盘 space_id（extra.space_id）",
                "items": [],
                "last_sync_at": "",
            }
        father_id = self._father_id()
        items: list[dict[str, str]] = []
        start = 0
        try:
            for _ in range(_MAX_FILE_PAGES):
                data = await self._post(
                    f"{_WECOM_BASE_URL}/wedrive/file_list",
                    body={
                        "space_id": space_id,
                        "father_id": father_id,
                        "sort_type": 1,
                        "start": start,
                        "limit": _FILE_LIST_PAGE_SIZE,
                    },
                )
                if data.get("errcode") != 0:
                    return {
                        "ok": False,
                        "message": (
                            f"企业微信 API 错误: {data.get('errmsg')}"
                            f" (errcode={data.get('errcode')})"
                        ),
                        "items": [],
                        "last_sync_at": "",
                    }
                for entry in data.get("file_list") or []:
                    file_info = (
                        entry.get("file_info") if isinstance(entry, dict) else None
                    )
                    if not isinstance(file_info, dict):
                        continue
                    fileid = file_info.get("fileid")
                    if not fileid:
                        continue
                    items.append(
                        {
                            "doc_id": str(fileid),
                            "title": file_info.get("file_name") or "",
                        }
                    )
                next_start = data.get("next_start")
                if next_start is None:
                    break
                start = int(next_start)
        except RuntimeError as e:
            return {"ok": False, "message": str(e), "items": [], "last_sync_at": ""}
        except Exception as e:
            logger.warning("[WecomConnector] sync 网络异常: %s", e)
            return {
                "ok": False,
                "message": f"同步企业微信微盘文件失败: {e}",
                "items": [],
                "last_sync_at": "",
            }

        return {
            "ok": True,
            "message": f"同步 {len(items)} 个微盘文件",
            "items": items,
            "last_sync_at": _now_iso(),
        }

    async def fetch_document(self, doc_id: str) -> dict[str, Any]:
        """拉取单篇微盘文件并转文本(超出 MAX_DOC_CHARS 截断)。

        file_download 响应不含文件名,title 以 doc_id 回填;
        二进制文件(utf-8 解码失败)降级为不支持。
        """
        doc_id = (doc_id or "").strip()
        if not doc_id:
            return _doc_fail("缺少 doc_id")
        if not self._configured():
            return _doc_fail("未配置企业微信 corpid/corpsecret")
        try:
            fileid = int(doc_id)
        except ValueError:
            return _doc_fail("doc_id 非法（须为微盘文件 fileid）")

        try:
            data = await self._post(
                f"{_WECOM_BASE_URL}/wedrive/file_download",
                body={"fileid": fileid},
            )
            if data.get("errcode") != 0:
                return _doc_fail(
                    f"企业微信 API 错误: {data.get('errmsg')}"
                    f" (errcode={data.get('errcode')})"
                )
            download_url = data.get("download_url")
            if not isinstance(download_url, str) or not download_url:
                return _doc_fail("企业微信未返回 download_url")
            decoded = await self._download_text(download_url, data)
        except RuntimeError as e:
            return _doc_fail(str(e))
        except Exception as e:
            logger.warning("[WecomConnector] fetch_document 异常: %s", e)
            return _doc_fail(f"拉取企业微信文档失败: {e}")

        if decoded is None:
            return _doc_fail("非文本文件，当前仅支持文本类文件解析")
        truncated = len(decoded) > MAX_DOC_CHARS
        content = decoded[:MAX_DOC_CHARS]
        return {
            "ok": True,
            "title": doc_id,
            "content": content,
            "chars": len(content),
            "truncated": truncated,
            "message": f"已拉取微盘文件 {doc_id}（{len(content)} 字）",
        }

    async def _download_text(
        self, download_url: str, meta: dict[str, Any]
    ) -> str | None:
        """下载文件字节并 utf-8 解码(企业微信下载须回带响应中的 cookie)。

        Returns:
            解码后的文本;二进制内容(utf-8 解码失败)返回 None。
        """
        cookies: dict[str, str] = {}
        cookie_name = meta.get("cookie_name")
        cookie_value = meta.get("cookie_value")
        if (
            isinstance(cookie_name, str)
            and cookie_name
            and isinstance(cookie_value, str)
            and cookie_value
        ):
            cookies[cookie_name] = cookie_value
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
            resp = await client.get(download_url, cookies=cookies)
        try:
            return resp.content.decode("utf-8")
        except UnicodeDecodeError:
            return None


# ============================================================================
# 统一接口(路由层按 CONNECTOR_TYPE 调用)
# ============================================================================


async def sync(record: dict[str, Any]) -> dict[str, Any]:
    """同步企业微信连接器数据源。"""
    return await WecomConnector(record).sync()


async def fetch_document(record: dict[str, Any], doc_id: str) -> dict[str, Any]:
    """拉取单篇企业微信文档。"""
    return await WecomConnector(record).fetch_document(doc_id)


# ============================================================================
# 辅助函数
# ============================================================================


def _doc_fail(message: str) -> dict[str, Any]:
    """统一的文档拉取失败响应。"""
    return {
        "ok": False,
        "title": "",
        "content": "",
        "chars": 0,
        "truncated": False,
        "message": message,
    }


def _now_iso() -> str:
    """当前 UTC 时间 ISO 格式。"""
    return datetime.now(UTC).isoformat()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
