# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""钉钉 Connector(2026-09-02 立,2026-09-20 接入钉盘 Drive 真实实现)。

对标"读取钉钉文档"能力:钉钉文档能力以钉盘(Drive)与知识库为主,
本模块落地"钉盘 Drive 文件列表 + 文件下载转文本"(旧版 oapi 接口):
- token 获取:GET /gettoken(appkey + appsecret,带进程内缓存)
- 文件列表:POST /topapi/drive/space/file/list(space_id + folder_id,
  next_token 游标分页聚合)
- 文件下载:POST /topapi/drive/space/file/download 拿下载 URL 后 GET 拉字节,
  UTF-8 解码为纯文本(非文本文件降级提示),超出 MAX_DOC_CHARS 截断
- 空间配置:record.extra.space_id(必填,数字)/ extra.folder_id(缺省 0)/
  extra.union_id(下载接口要求的操作者标识,可选)

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
CONNECTOR_TYPE = "dingtalk"

# 单篇文档拉取最大字符数(超出截断,truncated=True)
MAX_DOC_CHARS = 20000

# 钉钉开放平台 API 基础 URL
_DINGTALK_BASE_URL = "https://oapi.dingtalk.com"

# HTTP 超时(秒)
_HTTP_TIMEOUT_S = 10.0

# access_token 缓存 TTL(秒,略小于 2 小时,提前刷新)
_TOKEN_TTL_S = 7100

# 钉盘文件列表单页条数(oapi 上限 100)
_FILES_PAGE_SIZE = 100

# 文件列表分页页数上限(防 next_token 异常导致死循环)
_MAX_LIST_PAGES = 200


class DingtalkConnector:
    """钉钉连接器(钉盘 Drive:文件列表 + 文件下载转文本)。"""

    def __init__(self, record: dict[str, Any]) -> None:
        self.record = record
        self.appkey = (record.get("app_id") or "").strip()
        self.appsecret = (record.get("app_secret") or "").strip()
        self._extra: dict[str, Any] = record.get("extra") or {}
        self._cached_token: str | None = None
        self._token_expire_at = 0.0

    def _configured(self) -> bool:
        return bool(self.appkey and self.appsecret)

    async def get_access_token(self) -> str | None:
        """获取钉钉 access_token(带进程内缓存,失败返回 None)。

        钉盘文件列表 / 文件下载能力复用本方法拿 token。
        """
        if not self._configured():
            return None
        if self._cached_token and time.time() < self._token_expire_at:
            return self._cached_token
        url = f"{_DINGTALK_BASE_URL}/gettoken"
        params = {"appkey": self.appkey, "appsecret": self.appsecret}
        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
                resp = await client.get(url, params=params)
            data = resp.json()
        except Exception as e:
            logger.warning("[DingtalkConnector] 获取 access_token 失败: %s", e)
            return None
        if not isinstance(data, dict):
            logger.warning("[DingtalkConnector] gettoken 响应格式异常")
            return None
        if data.get("errcode") != 0:
            logger.warning("[DingtalkConnector] gettoken 错误: %s", data.get("errmsg"))
            return None
        token = data.get("access_token")
        if not isinstance(token, str) or not token:
            return None
        self._cached_token = token
        self._token_expire_at = time.time() + _TOKEN_TTL_S
        return token

    async def sync(self) -> dict[str, Any]:
        """同步钉盘文件列表(钉盘 Drive,next_token 游标分页聚合)。"""
        if not self._configured():
            return {
                "ok": False,
                "message": "未配置钉钉 appkey/appsecret",
                "items": [],
                "last_sync_at": "",
            }
        raw_space_id = self._extra.get("space_id")
        if raw_space_id in (None, ""):
            return {
                "ok": False,
                "message": "未配置钉盘 space_id（extra.space_id）",
                "items": [],
                "last_sync_at": "",
            }
        try:
            space_id = int(raw_space_id)
        except (TypeError, ValueError):
            return {
                "ok": False,
                "message": "未配置钉盘 space_id（extra.space_id 须为数字）",
                "items": [],
                "last_sync_at": "",
            }
        try:
            folder_id = int(self._extra.get("folder_id") or 0)
        except (TypeError, ValueError):
            folder_id = 0
        token = await self.get_access_token()
        if not token:
            return {
                "ok": False,
                "message": "获取钉钉 access_token 失败",
                "items": [],
                "last_sync_at": "",
            }

        url = f"{_DINGTALK_BASE_URL}/topapi/drive/space/file/list"
        items: list[dict[str, str]] = []
        next_token = ""
        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
                for _ in range(_MAX_LIST_PAGES):
                    body: dict[str, Any] = {
                        "space_id": space_id,
                        "folder_id": folder_id,
                        "next_token": next_token,
                        "limit": _FILES_PAGE_SIZE,
                    }
                    resp = await client.post(
                        url, params={"access_token": token}, json=body
                    )
                    data = resp.json()
                    if not isinstance(data, dict):
                        return {
                            "ok": False,
                            "message": "钉盘文件列表响应格式异常",
                            "items": [],
                            "last_sync_at": "",
                        }
                    if data.get("errcode") != 0:
                        return {
                            "ok": False,
                            "message": (
                                f"钉盘文件列表 API 错误: {data.get('errmsg')}"
                                f" (errcode={data.get('errcode')})"
                            ),
                            "items": [],
                            "last_sync_at": "",
                        }
                    result = data.get("result") or {}
                    for f in result.get("files") or []:
                        if not isinstance(f, dict):
                            continue
                        file_id = f.get("file_id")
                        if file_id in (None, ""):
                            continue
                        items.append(
                            {
                                "doc_id": str(file_id),
                                "title": str(
                                    f.get("file_name") or f"file-{file_id}"
                                ),
                            }
                        )
                    next_token = str(result.get("next_token") or "")
                    if not next_token:
                        break
        except Exception as e:
            logger.warning("[DingtalkConnector] sync 网络异常: %s", e)
            return {
                "ok": False,
                "message": f"同步钉盘文件失败: {e}",
                "items": [],
                "last_sync_at": "",
            }

        return {
            "ok": True,
            "message": f"同步 {len(items)} 个钉盘文件",
            "items": items,
            "last_sync_at": _now_iso(),
        }

    async def fetch_document(self, doc_id: str) -> dict[str, Any]:
        """拉取单篇钉盘文件转纯文本(下载 URL + GET 字节 + UTF-8 解码,超长截断)。"""
        if not self._configured():
            return _doc_fail("未配置钉钉 appkey/appsecret")
        raw_space_id = self._extra.get("space_id")
        if raw_space_id in (None, ""):
            return _doc_fail("未配置钉盘 space_id（extra.space_id）")
        try:
            space_id = int(raw_space_id)
        except (TypeError, ValueError):
            return _doc_fail("未配置钉盘 space_id（extra.space_id 须为数字）")
        try:
            file_id = int(doc_id)
        except (TypeError, ValueError):
            return _doc_fail("doc_id 非法（须为钉盘文件 file_id）")
        token = await self.get_access_token()
        if not token:
            return _doc_fail("获取钉钉 access_token 失败")

        url = f"{_DINGTALK_BASE_URL}/topapi/drive/space/file/download"
        body: dict[str, Any] = {"space_id": space_id, "file_id": file_id}
        union_id = self._extra.get("union_id")
        if union_id:
            body["union_id"] = str(union_id)
        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
                resp = await client.post(
                    url, params={"access_token": token}, json=body
                )
                data = resp.json()
                if not isinstance(data, dict):
                    return _doc_fail("钉盘文件下载响应格式异常")
                if data.get("errcode") != 0:
                    return _doc_fail(
                        f"钉盘文件下载 API 错误: {data.get('errmsg')}"
                        f" (errcode={data.get('errcode')})"
                    )
                result = data.get("result") or {}
                download_url = (
                    str(result.get("url") or "") if isinstance(result, dict) else ""
                )
                if not download_url:
                    return _doc_fail("钉盘文件下载 URL 为空")
                file_resp = await client.get(download_url)
        except Exception as e:
            logger.warning("[DingtalkConnector] fetch_document 异常: %s", e)
            return _doc_fail(f"拉取钉盘文件失败: {e}")

        try:
            content = file_resp.content.decode("utf-8")
        except UnicodeDecodeError:
            return _doc_fail("非文本文件，当前仅支持文本类文件解析")

        chars = len(content)
        truncated = False
        if chars > MAX_DOC_CHARS:
            content = content[:MAX_DOC_CHARS]
            chars = MAX_DOC_CHARS
            truncated = True
        return {
            "ok": True,
            "title": str(doc_id),
            "content": content,
            "chars": chars,
            "truncated": truncated,
            "message": f"已拉取钉盘文件 {doc_id}({chars} 字)",
        }


# ============================================================================
# 统一接口(路由层按 CONNECTOR_TYPE 调用)
# ============================================================================


async def sync(record: dict[str, Any]) -> dict[str, Any]:
    """同步钉钉连接器数据源。"""
    return await DingtalkConnector(record).sync()


async def fetch_document(record: dict[str, Any], doc_id: str) -> dict[str, Any]:
    """拉取单篇钉钉文档。"""
    return await DingtalkConnector(record).fetch_document(doc_id)


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
    """当前 UTC 时间 ISO 格式(对齐 feishu.py)。"""
    return datetime.now(UTC).isoformat()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
