"""阿里云 AI 服务.

迁移自 ZHS_Server_java/mcp/service/impl/AliAIServiceImpl.java.
实现音色复刻(CosyVoice generateTimbre)、数字人(videoToDigital)能力.
"""

import base64
import hashlib
import hmac
import time
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
from loguru import logger
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_session


class AliAIService:
    """阿里云 AI 服务封装."""

    DEFAULT_TIMEOUT = 60.0

    def __init__(self, access_key_id: str = "", access_key_secret: str = "", app_key: str = ""):
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret
        self.app_key = app_key
        self._token: dict[str, Any] | None = None

    def _get_token(self) -> str | None:
        """获取阿里云 NLS 访问 Token(24 小时有效,缓存复用)."""
        now = time.time()
        if self._token and self._token.get("expire_at", 0) > now + 300:
            return self._token.get("token")
        if not self.access_key_id or not self.access_key_secret:
            logger.warning("阿里云 AccessKey 未配置")
            return None
        try:
            url = "https://nls-meta.cn-shanghai.aliyuncs.com/stream/v1/tts/token"
            params = {
                "AccessKeyId": self.access_key_id,
                "Action": "CreateToken",
                "AppKey": self.app_key,
                "Format": "JSON",
                "RegionId": "cn-shanghai",
                "SignatureMethod": "HMAC-SHA1",
                "SignatureNonce": str(uuid.uuid4()),
                "SignatureVersion": "1.0",
                "Timestamp": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "Version": "2019-02-28",
            }
            sorted_q = "&".join(f"{k}={params[k]}" for k in sorted(params))
            sign_str = f"GET&%2F&{sorted_q}".replace("&", "%26").replace("=", "%3D")
            signature = base64.b64encode(
                hmac.new(
                    (self.access_key_secret + "&").encode("utf-8"),
                    sign_str.encode("utf-8"),
                    hashlib.sha1,
                ).digest()
            ).decode("utf-8")
            params["Signature"] = signature
            with httpx.Client(timeout=self.DEFAULT_TIMEOUT) as client:
                r = client.get(url, params=params)
                data = r.json()
            if "Token" in data and "Id" in data["Token"]:
                token = data["Token"]["Id"]
                expire = int(data["Token"].get("ExpireTime", now + 86400))
                self._token = {"token": token, "expire_at": expire}
                return token
        except Exception as e:
            logger.error(f"获取阿里云 Token 失败: {e}")
        return None

    async def generate_timbre(self, voice_prefix: str, url: str, sex: str = "female", age: int = 25) -> dict[str, Any]:
        """生成音色(CosyVoice generateTimbre).

        Args:
            voice_prefix: 音色前缀标识
            url: 音频文件 URL(用于训练音色)
            sex: 性别 female/male
            age: 年龄

        Returns:
            {"voice": voice_id, "status": "OK"/"FAIL", ...}
        """
        token = self._get_token()
        if not token:
            return {"voice": "", "status": "FAIL", "message": "Token 获取失败"}
        try:
            api_url = "https://nls-cn-shanghai.aliyuncs.com/stream/v1/tts/asyncvoice"
            payload = {
                "header": {"appkey": self.app_key, "token": token, "namespace": "FlowingSpeechSynthesizer"},
                "payload": {
                    "voice_prefix": voice_prefix,
                    "url": url,
                    "sex": sex,
                    "age": age,
                },
            }
            async with httpx.AsyncClient(timeout=self.DEFAULT_TIMEOUT) as client:
                r = await client.post(api_url, json=payload)
                return r.json()
        except Exception as e:
            logger.error(f"生成音色失败: {e}")
            return {"voice": "", "status": "FAIL", "message": str(e)}

    async def video_to_digital(self, video_url: str, voice: str = "") -> dict[str, Any]:
        """数字人合成(videoToDigital).

        Args:
            video_url: 输入视频 URL
            voice: 音色 ID

        Returns:
            {"task_id": ..., "status": "OK"/"FAIL"}
        """
        token = self._get_token()
        if not token:
            return {"task_id": "", "status": "FAIL", "message": "Token 获取失败"}
        try:
            api_url = "https://nls-cn-shanghai.aliyuncs.com/stream/v1/digitalhuman/job"
            payload = {
                "header": {"appkey": self.app_key, "token": token, "namespace": "DigitalHuman"},
                "payload": {
                    "video_url": video_url,
                    "voice": voice,
                },
            }
            async with httpx.AsyncClient(timeout=self.DEFAULT_TIMEOUT) as client:
                r = await client.post(api_url, json=payload)
                return r.json()
        except Exception as e:
            logger.error(f"数字人合成失败: {e}")
            return {"task_id": "", "status": "FAIL", "message": str(e)}


_service: AliAIService | None = None


def get_ali_ai_service(db: Session | None = None) -> AliAIService:
    global _service
    if _service is None:
        ak = ""
        aks = ""
        app_key = ""
        try:
            db = db or next(get_session())  # type: ignore[call-overload]
            row = db.execute(text("""
                SELECT config_key, config_value
                FROM admin_config
                WHERE config_key IN ('ali_access_key_id', 'ali_access_key_secret', 'ali_nls_app_key')
            """)).mappings().all()
            mp = {r["config_key"]: r["config_value"] for r in row}
            ak = mp.get("ali_access_key_id", "")
            aks = mp.get("ali_access_key_secret", "")
            app_key = mp.get("ali_nls_app_key", "")
        except Exception as e:
            logger.warning(f"加载阿里云配置失败, 使用环境变量: {e}")
        _service = AliAIService(
            access_key_id=ak,
            access_key_secret=aks,
            app_key=app_key,
        )
    return _service
