# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""钉钉 Connector 框架(2026-09-02 立)。

对标"读取钉钉文档"能力:钉钉文档能力以钉盘(Drive)与知识库为主,
本模块先落地"框架":
- token 获取链路已就绪(GET /gettoken,appkey + appsecret,带缓存)
- 文档读取能力预留扩展点(TODO),当前 sync/fetch_document 返回"未接入"
- 意义:让 Connector 路由层能识别钉钉类型,后续对接
  钉盘空间文件 / 知识库文档读取时,在此模块补齐真实实现

统一接口:CONNECTOR_TYPE + sync(record) + fetch_document(record, doc_id),
供 Connector 路由层按类型分发。所有对外方法不抛异常,异常降级为
{ok: False, message: ...}(不崩服务)。
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# 统一接口标识:路由层据此分发
CONNECTOR_TYPE = "dingtalk"

# 单篇文档拉取最大字符数(预留常量,接入后生效)
MAX_DOC_CHARS = 20000

# 钉钉开放平台 API 基础 URL
_DINGTALK_BASE_URL = "https://oapi.dingtalk.com"

# HTTP 超时(秒)
_HTTP_TIMEOUT_S = 10.0

# access_token 缓存 TTL(秒,略小于 2 小时,提前刷新)
_TOKEN_TTL_S = 7100


class DingtalkConnector:
    """钉钉连接器(框架级:token 就绪,文档读取预留扩展点)。"""

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
        """获取钉钉 access_token(带进程内缓存)。

        TODO 接入点:钉盘文件列表 / 知识库文档读取等能力的第一步都是
        拿到 access_token,后续新能力直接复用本方法。
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
        """同步钉钉文档源(当前未接入)。"""
        if not self._configured():
            return {
                "ok": False,
                "message": "未配置钉钉 appkey/appsecret",
                "items": [],
                "last_sync_at": "",
            }
        # TODO 接入点:通过 get_access_token() 拉取钉盘空间文件列表 /
        # 知识库文档清单后,填充 items=[{"doc_id": ..., "title": ...}]
        return {
            "ok": False,
            "message": "钉钉文档源待接入（当前支持通过对话上传文件解析）",
            "items": [],
            "last_sync_at": "",
        }

    async def fetch_document(self, doc_id: str) -> dict[str, Any]:
        """拉取单篇钉钉文档(当前未接入)。"""
        if not self._configured():
            return _doc_fail("未配置钉钉 appkey/appsecret")
        # TODO 接入点:通过 get_access_token() 读取钉盘文件 /
        # 知识库文档,下载后转纯文本,超出 MAX_DOC_CHARS 截断
        return _doc_fail("钉钉文档源待接入（当前支持通过对话上传文件解析）")


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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
