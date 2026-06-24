"""腾讯云直播客户端 (迁移自 ihui-ai-edu-live-service).

功能:
  - 生成带鉴权签名的推流/拉流地址 (txSecret = md5(key + streamName + txTime))
  - 调用腾讯云直播 API (TC3-HMAC-SHA256 签名): 查询流状态 / 断开流 / 查询在线列表

依赖: httpx (异步 HTTP), loguru (日志), 复用 app.utils.tencent_signature 做 TC3 签名.
"""

import hashlib
import time
from typing import Any

import httpx
from loguru import logger

from app.config import settings
from app.utils.tencent_signature import TencentCloudSignature

# 腾讯云直播 API 公共参数
_LIVE_SERVICE = "live"
_LIVE_API_VERSION = "2018-08-01"
_DEFAULT_EXPIRE_SECONDS = 60 * 60 * 24  # 推流/拉流地址默认有效期 24h
_HTTP_TIMEOUT = 10.0


def _normalize_pull_domain(domain: str) -> str:
    """拉流域名去掉协议前缀, 统一为裸域名 (用于拼接播放地址)."""
    if not domain:
        return ""
    d = domain.strip()
    for prefix in ("https://", "http://", "rtmp://"):
        if d.lower().startswith(prefix):
            d = d[len(prefix):]
            break
    return d.rstrip("/")


class TencentLiveClient:
    """腾讯云直播客户端.

    推流/拉流地址签名使用 settings.TENCENT_LIVE_CALLBACK_KEY;
    腾讯云 API 调用使用 settings.TENCENT_LIVE_SECRET_ID/KEY (TC3 签名).
    """

    def __init__(
        self,
        secret_id: str | None = None,
        secret_key: str | None = None,
        push_domain: str | None = None,
        pull_domain: str | None = None,
        callback_key: str | None = None,
        endpoint: str | None = None,
        region: str | None = None,
    ) -> None:
        self.secret_id = secret_id or settings.TENCENT_LIVE_SECRET_ID
        self.secret_key = secret_key or settings.TENCENT_LIVE_SECRET_KEY
        self.push_domain = (push_domain or settings.TENCENT_LIVE_PUSH_DOMAIN).strip()
        self.pull_domain = _normalize_pull_domain(
            pull_domain or settings.TENCENT_LIVE_PULL_DOMAIN
        )
        self.callback_key = callback_key or settings.TENCENT_LIVE_CALLBACK_KEY
        self.endpoint = (endpoint or settings.TENCENT_LIVE_ENDPOINT).strip()
        self.region = (region or settings.TENCENT_LIVE_REGION).strip()

        if not self.callback_key:
            logger.warning("TENCENT_LIVE_CALLBACK_KEY 未配置, 推流地址将不带鉴权签名")

    # ------------------------------------------------------------------
    # 推流 / 拉流地址生成 (本地签名, 不调用 API)
    # ------------------------------------------------------------------
    def create_push_url(self, stream_name: str, expire_seconds: int = _DEFAULT_EXPIRE_SECONDS) -> str:
        """生成带鉴权签名的 RTMP 推流地址.

        签名规则 (腾讯云直播推流鉴权):
            txTime = hex(现在 + expire)
            txSecret = md5(callback_key + streamName + txTime)
            url = rtmp://{push_domain}/live/{stream_name}?txSecret={txSecret}&txTime={txTime}
        """
        if not self.push_domain:
            raise ValueError("TENCENT_LIVE_PUSH_DOMAIN 未配置")

        tx_time_hex = self._calc_tx_time(expire_seconds)
        tx_secret = self._calc_tx_secret(stream_name, tx_time_hex)
        url = (
            f"rtmp://{self.push_domain}/live/{stream_name}"
            f"?txSecret={tx_secret}&txTime={tx_time_hex}"
        )
        logger.debug(f"live push url generated: stream={stream_name}")
        return url

    def create_pull_url(self, stream_name: str, expire_seconds: int = _DEFAULT_EXPIRE_SECONDS) -> str:
        """生成带鉴权签名的拉流(播放)地址 (HLS m3u8).

        同时返回 FLV / RTMP 备用地址在 dict 中 (供调用方选择).
        本方法返回主地址 (m3u8), 如需其他格式请用 create_pull_urls.
        """
        urls = self.create_pull_urls(stream_name, expire_seconds)
        return urls["hls"]

    def create_pull_urls(self, stream_name: str, expire_seconds: int = _DEFAULT_EXPIRE_SECONDS) -> dict:
        """生成全部播放格式地址 (hls/flv/rtmp)."""
        if not self.pull_domain:
            raise ValueError("TENCENT_LIVE_PULL_DOMAIN 未配置")

        tx_time_hex = self._calc_tx_time(expire_seconds)
        tx_secret = self._calc_tx_secret(stream_name, tx_time_hex)
        qs = f"?txSecret={tx_secret}&txTime={tx_time_hex}"
        base = f"http://{self.pull_domain}/live/{stream_name}"
        urls = {
            "hls": f"{base}.m3u8{qs}",
            "flv": f"{base}.flv{qs}",
            "rtmp": f"rtmp://{self.pull_domain}/live/{stream_name}{qs}",
        }
        logger.debug(f"live pull urls generated: stream={stream_name}")
        return urls

    # ------------------------------------------------------------------
    # 腾讯云直播 API 调用 (TC3-HMAC-SHA256 签名)
    # ------------------------------------------------------------------
    async def create_live_stream(
        self,
        stream_name: str,
        stream_alias: str | None = None,
    ) -> dict:
        """创建直播流.

        腾讯云直播流在客户端首次推流时自动创建, 没有独立的 "CreateStream" API.
        本方法调用 DescribeLiveStreamOnlineInfo 确认流状态, 并返回推流/拉流地址
        供客户端开始推流. stream_alias 作为备注返回 (腾讯云直播通过推流地址绑定).
        """
        self._check_api_creds()
        # 查询当前流是否已在线
        online_info = await self._describe_stream_online_info(stream_name)
        result: dict[str, Any] = {
            "stream_name": stream_name,
            "stream_alias": stream_alias,
            "online": bool(online_info.get("online")),
            "push_url": self.create_push_url(stream_name),
            "pull_urls": self.create_pull_urls(stream_name),
        }
        logger.info(
            f"live stream ready: stream={stream_name} alias={stream_alias} online={result['online']}"
        )
        return result

    async def stop_live_stream(self, stream_name: str) -> dict:
        """停止(断开)直播流 -- 调用 DropLiveStream."""
        self._check_api_creds()
        params = {
            "StreamName": stream_name,
            "DomainName": self.push_domain,
            "AppName": "live",
        }
        resp = await self._call_api("DropLiveStream", params)
        logger.info(f"live stream stopped: stream={stream_name} resp_code={resp.get('Response', {}).get('Error', {}).get('Code', 'OK')}")
        return resp

    async def describe_live_streams(
        self,
        page_num: int = 1,
        page_size: int = 100,
        stream_name: str | None = None,
    ) -> dict:
        """查询在线直播流列表 -- 调用 DescribeLiveStreamOnlineList."""
        self._check_api_creds()
        params: dict[str, Any] = {
            "DomainName": self.push_domain,
            "AppName": "live",
            "PageNum": page_num,
            "PageSize": page_size,
        }
        if stream_name:
            params["StreamName"] = stream_name
        resp = await self._call_api("DescribeLiveStreamOnlineList", params)
        return resp

    # ------------------------------------------------------------------
    # 内部工具
    # ------------------------------------------------------------------
    def _check_api_creds(self) -> None:
        if not self.secret_id or not self.secret_key:
            raise ValueError("TENCENT_LIVE_SECRET_ID / TENCENT_LIVE_SECRET_KEY 未配置, 无法调用腾讯云直播 API")
        if not self.push_domain:
            raise ValueError("TENCENT_LIVE_PUSH_DOMAIN 未配置")

    @staticmethod
    def _calc_tx_time(expire_seconds: int) -> str:
        """txTime = hex(当前时间戳 + 过期秒数)."""
        expire_at = int(time.time()) + int(expire_seconds)
        return format(expire_at, "x")

    def _calc_tx_secret(self, stream_name: str, tx_time_hex: str) -> str:
        """txSecret = md5(callback_key + streamName + txTime)."""
        if not self.callback_key:
            return ""
        raw = f"{self.callback_key}{stream_name}{tx_time_hex}"
        return hashlib.md5(raw.encode("utf-8")).hexdigest()

    async def _describe_stream_online_info(self, stream_name: str) -> dict:
        """查询单条流在线状态 -- 调用 DescribeLiveStreamOnlineInfo."""
        params = {
            "StreamName": stream_name,
            "DomainName": self.push_domain,
            "AppName": "live",
        }
        try:
            return await self._call_api("DescribeLiveStreamOnlineInfo", params)
        except Exception as e:
            logger.warning(f"describe stream online info failed (treat as offline): stream={stream_name} err={e}")
            return {"online": False}

    async def _call_api(self, action: str, params: dict) -> dict:
        """调用腾讯云直播 API (TC3-HMAC-SHA256 签名).

        复用 app.utils.tencent_signature.TencentCloudSignature, 传入直播专用密钥.
        """
        signer = TencentCloudSignature(self.secret_id, self.secret_key)
        payload = _json_dumps(params)
        headers = signer.generate_authorization_header(
            method="POST",
            uri="/",
            payload=payload,
            service=_LIVE_SERVICE,
            host=self.endpoint,
            action=action,
            version=_LIVE_API_VERSION,
            region=self.region,
        )
        url = f"https://{self.endpoint}"
        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
                resp = await client.post(url, headers=headers, content=payload)
                resp.raise_for_status()
                data = resp.json()
                # 腾讯云返回结构: {"Response": {...}}
                if "Response" in data and data["Response"].get("Error"):
                    err = data["Response"]["Error"]
                    logger.error(
                        f"tencent live api error: action={action} code={err.get('Code')} msg={err.get('Message')}"
                    )
                return data
        except httpx.HTTPStatusError as e:
            logger.error(f"tencent live api http error: action={action} status={e.response.status_code} body={e.response.text[:500]}")
            raise
        except Exception as e:
            logger.error(f"tencent live api call failed: action={action} err={e}")
            raise


def _json_dumps(obj: dict) -> str:
    """紧凑 JSON 序列化 (无空格), 保证签名与请求体一致."""
    import json

    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def get_live_client() -> TencentLiveClient:
    """获取默认配置的腾讯云直播客户端实例."""
    return TencentLiveClient()
