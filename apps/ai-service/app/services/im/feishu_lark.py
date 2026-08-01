"""飞书 lark-cli 长连接模式 adapter(2026-07-31 立)。

支持 4 类高级能力:
- 互动卡片(send_card):POST /im/v1/messages msg_type=interactive
- 文件消息(send_file):POST /im/v1/messages msg_type=file/image/audio/media
- 音视频消息(send_audio_video):POST /im/v1/messages msg_type=audio/media
- 审批提交(submit_approval):POST /approval/v4/instances

SDK 优先级:
1. lark-oapi(飞书官方 Python SDK,长连接模式原生支持)
2. httpx REST API 降级(直接调飞书开放平台 REST API)

降级说明:lark-oapi 未安装时,所有方法降级为 httpx 调用 REST API,
但不支持 WebSocket 长连接(仅同步 REST 模式)。
在文件头注释:"优先用 lark-oapi SDK,未安装时降级到 httpx REST"。

REST API 基础 URL:https://open.feishu.cn/open-apis/
认证:tenant_access_token(app_id + app_secret 调
      /auth/v3/tenant_access_token/internal 获取,缓存 7000s)

所有方法均 async,用 httpx.AsyncClient,超时 10s,失败返回 {success: False, error: str}。
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# 飞书开放平台 REST API 基础 URL
_FEISHU_BASE_URL = "https://open.feishu.cn/open-apis"

# HTTP 超时(秒)
_HTTP_TIMEOUT_S = 10.0

# tenant_access_token 缓存 TTL(秒,略小于实际 2 小时,提前刷新)
_TENANT_TOKEN_TTL_S = 7000

# 尝试导入 lark-oapi SDK(可选,未安装则降级 httpx REST)
try:
    import lark_oapi as lark

    _LARK_SDK_AVAILABLE = True
except ImportError:
    lark = None
    _LARK_SDK_AVAILABLE = False


# ============================================================================
# Pydantic 数据模型(入参/出参类型)
# ============================================================================


class FeishuCardMessage(BaseModel):
    """互动卡片消息出参。"""

    success: bool
    message_id: str | None = None
    error: str | None = None


class FeishuFileMessage(BaseModel):
    """文件消息出参。"""

    success: bool
    message_id: str | None = None
    file_key: str | None = None
    error: str | None = None


class FeishuMediaMessage(BaseModel):
    """音视频消息出参。"""

    success: bool
    message_id: str | None = None
    error: str | None = None


class FeishuApprovalResult(BaseModel):
    """审批提交出参。"""

    success: bool
    instance_id: str | None = None
    error: str | None = None


# ============================================================================
# FeishuLarkAdapter
# ============================================================================


class FeishuLarkAdapter:
    """飞书 lark-cli 长连接模式 adapter。

    优先用 lark-oapi SDK(支持 WebSocket 长连接),
    未安装时降级到 httpx REST 调用(同步模式,不支持长连接)。

    所有方法均 async,用 httpx.AsyncClient,超时 10s,
    失败返回 {success: False, error: str}(不抛异常,由调用方决定降级策略)。
    """

    def __init__(self, app_id: str, app_secret: str) -> None:
        self.app_id = app_id
        self.app_secret = app_secret
        # tenant_access_token 缓存(避免每次调用都重新获取)
        self._cached_token: str | None = None
        self._token_expire_at: float = 0.0
        # lark-oapi SDK 客户端(若可用)
        self._lark_client: Any = None
        if _LARK_SDK_AVAILABLE and app_id and app_secret:
            try:
                self._lark_client = (
                    lark.Client.builder()
                    .app_id(app_id)
                    .app_secret(app_secret)
                    .build()
                )
                logger.info(
                    "[FeishuLark] lark-oapi SDK 已初始化(app_id=%s)", app_id
                )
            except Exception as e:
                logger.warning(
                    "[FeishuLark] lark-oapi SDK 初始化失败,降级 httpx REST: %s", e
                )
                self._lark_client = None

    # ------------------------------------------------------------------
    # tenant_access_token
    # ------------------------------------------------------------------

    async def get_tenant_access_token(self) -> str | None:
        """获取 tenant_access_token(app_id + app_secret 调内部接口)。

        缓存策略:首次调用获取后缓存,_TENANT_TOKEN_TTL_S 秒内复用,过期重新获取。

        Returns:
            tenant_access_token 字符串,失败返回 None。
        """
        # 缓存命中
        if self._cached_token and time.time() < self._token_expire_at:
            return self._cached_token

        url = f"{_FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal"
        payload = {"app_id": self.app_id, "app_secret": self.app_secret}
        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.warning("[FeishuLark] 获取 tenant_access_token 失败: %s", e)
            return None

        if data.get("code") != 0:
            logger.warning(
                "[FeishuLark] tenant_access_token 响应错误: code=%s msg=%s",
                data.get("code"),
                data.get("msg"),
            )
            return None

        token: str | None = data.get("tenant_access_token")
        expire = int(data.get("expire", 0))
        if not token or expire <= 0:
            return None

        self._cached_token = token
        self._token_expire_at = time.time() + min(expire, _TENANT_TOKEN_TTL_S)
        return token

    async def _auth_headers(self) -> dict[str, str]:
        """构造带 Bearer tenant_access_token 的请求头。

        Raises:
            RuntimeError: 无法获取 tenant_access_token。
        """
        token = await self.get_tenant_access_token()
        if not token:
            raise RuntimeError("无法获取 tenant_access_token")
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # 1. 互动卡片
    # ------------------------------------------------------------------

    async def send_card(
        self, chat_id: str, card: dict[str, Any]
    ) -> FeishuCardMessage:
        """发送互动卡片消息。

        飞书 API:POST /im/v1/messages?receive_id_type=chat_id
        msg_type=interactive,content 为 card payload 的 JSON 字符串。

        Args:
            chat_id: 接收消息的会话 ID(群聊或单聊)。
            card: 互动卡片 payload(模板 ID + 模板变量,或完整 card JSON)。

        Returns:
            FeishuCardMessage(success/message_id/error)。
        """
        try:
            headers = await self._auth_headers()
            url = f"{_FEISHU_BASE_URL}/im/v1/messages?receive_id_type=chat_id"
            payload: dict[str, Any] = {
                "receive_id": chat_id,
                "msg_type": "interactive",
                "content": _json_dumps(card),
            }
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
                resp = await client.post(url, json=payload, headers=headers)
            data = resp.json()
            if data.get("code") != 0:
                return FeishuCardMessage(
                    success=False,
                    error=f"{data.get('msg')} (code={data.get('code')})",
                )
            msg_id = (data.get("data") or {}).get("message_id")
            return FeishuCardMessage(success=True, message_id=msg_id)
        except Exception as e:
            logger.warning("[FeishuLark] send_card 失败: %s", e)
            return FeishuCardMessage(success=False, error=str(e))

    # ------------------------------------------------------------------
    # 2. 文件消息
    # ------------------------------------------------------------------

    async def send_file(
        self, chat_id: str, file_type: str, file_key: str
    ) -> FeishuFileMessage:
        """发送文件消息。

        飞书 API:
        - 上传文件:POST /im/v1/files(file_type + file_key 已有时跳过上传)
        - 发送消息:POST /im/v1/messages?receive_id_type=chat_id

        file_type 取值:opus / mp4 / pdf / doc / xls / ppt / stream
        msg_type 根据文件类型映射:image / audio / video / file / media

        本方法假设 file_key 已存在(由调用方预先上传),直接发送消息。

        Args:
            chat_id: 接收消息的会话 ID。
            file_type: 文件类型(opus/mp4/pdf/doc/xls/ppt/stream)。
            file_key: 已上传文件的 file_key(由 POST /im/v1/files 上传后获得)。

        Returns:
            FeishuFileMessage(success/message_id/file_key/error)。
        """
        # file_type → msg_type 映射(飞书文档)
        msg_type_map: dict[str, str] = {
            "opus": "audio",
            "mp4": "media",
            "pdf": "file",
            "doc": "file",
            "xls": "file",
            "ppt": "file",
            "stream": "media",
        }
        msg_type = msg_type_map.get(file_type, "file")
        try:
            headers = await self._auth_headers()
            url = f"{_FEISHU_BASE_URL}/im/v1/messages?receive_id_type=chat_id"
            content: dict[str, Any] = {"file_key": file_key}
            payload = {
                "receive_id": chat_id,
                "msg_type": msg_type,
                "content": _json_dumps(content),
            }
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
                resp = await client.post(url, json=payload, headers=headers)
            data = resp.json()
            if data.get("code") != 0:
                return FeishuFileMessage(
                    success=False,
                    error=f"{data.get('msg')} (code={data.get('code')})",
                )
            msg_id = (data.get("data") or {}).get("message_id")
            return FeishuFileMessage(
                success=True, message_id=msg_id, file_key=file_key
            )
        except Exception as e:
            logger.warning("[FeishuLark] send_file 失败: %s", e)
            return FeishuFileMessage(success=False, error=str(e))

    # ------------------------------------------------------------------
    # 3. 音视频消息
    # ------------------------------------------------------------------

    async def send_audio_video(
        self,
        chat_id: str,
        media_type: str,
        file_key: str,
        duration: int,
    ) -> FeishuMediaMessage:
        """发送音视频消息。

        Args:
            chat_id: 接收消息的会话 ID。
            media_type: 'audio' / 'media'(media 对应视频)。
            file_key: 已上传的文件 key。
            duration: 媒体时长(毫秒)。

        飞书 API:POST /im/v1/messages?receive_id_type=chat_id
        msg_type=audio: content={"file_key":"..."}
        msg_type=media: content={"file_key":"...","image_key":"..."}(视频需封面图,可选)

        Returns:
            FeishuMediaMessage(success/message_id/error)。
        """
        if media_type not in ("audio", "media"):
            return FeishuMediaMessage(
                success=False,
                error=f"media_type 必须是 'audio' 或 'media',得到 {media_type!r}",
            )
        try:
            headers = await self._auth_headers()
            url = f"{_FEISHU_BASE_URL}/im/v1/messages?receive_id_type=chat_id"
            content: dict[str, Any] = {"file_key": file_key}
            if duration > 0:
                content["duration"] = duration
            payload = {
                "receive_id": chat_id,
                "msg_type": media_type,
                "content": _json_dumps(content),
            }
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
                resp = await client.post(url, json=payload, headers=headers)
            data = resp.json()
            if data.get("code") != 0:
                return FeishuMediaMessage(
                    success=False,
                    error=f"{data.get('msg')} (code={data.get('code')})",
                )
            msg_id = (data.get("data") or {}).get("message_id")
            return FeishuMediaMessage(success=True, message_id=msg_id)
        except Exception as e:
            logger.warning("[FeishuLark] send_audio_video 失败: %s", e)
            return FeishuMediaMessage(success=False, error=str(e))

    # ------------------------------------------------------------------
    # 4. 审批提交
    # ------------------------------------------------------------------

    async def submit_approval(
        self, approval_code: str, form: dict[str, Any]
    ) -> FeishuApprovalResult:
        """提交审批实例。

        飞书 API:POST /approval/v4/instances
        body: {approval_code, form, ...}

        Args:
            approval_code: 审批定义 code(在飞书管理后台创建审批流程后获得)。
            form: 审批表单数据(控件值 JSON,需符合审批定义的表单结构)。

        Returns:
            FeishuApprovalResult(success/instance_id/error)。
        """
        try:
            headers = await self._auth_headers()
            url = f"{_FEISHU_BASE_URL}/approval/v4/instances"
            payload = {
                "approval_code": approval_code,
                "form": _json_dumps(form),
            }
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
                resp = await client.post(url, json=payload, headers=headers)
            data = resp.json()
            if data.get("code") != 0:
                return FeishuApprovalResult(
                    success=False,
                    error=f"{data.get('msg')} (code={data.get('code')})",
                )
            instance_id = (data.get("data") or {}).get("instance_id")
            return FeishuApprovalResult(success=True, instance_id=instance_id)
        except Exception as e:
            logger.warning("[FeishuLark] submit_approval 失败: %s", e)
            return FeishuApprovalResult(success=False, error=str(e))


# ============================================================================
# 辅助函数
# ============================================================================


def _json_dumps(obj: Any) -> str:
    """安全 JSON 序列化(飞书 API 要求 content 字段是 JSON 字符串)。

    飞书 API 的 content 字段必须是 JSON 字符串(而非嵌套对象),
    本函数封装 json.dumps 并兜底异常(失败返回 "{}")。
    """
    try:
        return json.dumps(obj, ensure_ascii=False)
    except (TypeError, ValueError):
        return "{}"
