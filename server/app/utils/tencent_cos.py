"""腾讯云 COS 对象存储客户端 (迁移自 ihui-ai-edu-oss-service).

直接调用 COS REST API, 不依赖 cos-python-sdk-v5, 使用 HMAC-SHA1 签名.
支持: 上传 / 下载 / 删除 / 获取 URL / 列举文件.

依赖: httpx (异步 HTTP), loguru (日志).
"""

import hashlib
import hmac
import time
from urllib.parse import quote

import httpx
from loguru import logger

from app.config import settings

_DEFAULT_EXPIRE_SECONDS = 600  # 签名默认有效期 10 分钟
_HTTP_TIMEOUT = 30.0
_UPLOAD_MAX_BYTES = 5 * 1024 * 1024  # 简单上传上限 5MB (COS PutObject 限制)


def _url_encode_path(path: str) -> str:
    """对 COS 路径做 URL 编码 (斜杠保留)."""
    return quote(path, safe="/-_.~")


def _url_encode_value(val: str) -> str:
    """对参数值做 URL 编码."""
    return quote(str(val), safe="-_.~")


class TencentCOSClient:
    """腾讯云 COS 客户端 (REST API + HMAC-SHA1 签名)."""

    def __init__(
        self,
        secret_id: str | None = None,
        secret_key: str | None = None,
        bucket: str | None = None,
        region: str | None = None,
        cdn_visit_path: str | None = None,
    ) -> None:
        self.secret_id = secret_id or settings.TENCENT_COS_SECRET_ID
        self.secret_key = secret_key or settings.TENCENT_COS_SECRET_KEY
        self.bucket = (bucket or settings.TENCENT_COS_BUCKET).strip()
        self.region = (region or settings.TENCENT_COS_REGION).strip()
        self.cdn_visit_path = (cdn_visit_path or settings.TENCENT_COS_CDN_VISIT_PATH).strip().rstrip("/")

        if not self.secret_id or not self.secret_key:
            raise ValueError("TENCENT_COS_SECRET_ID / TENCENT_COS_SECRET_KEY 未配置")
        if not self.bucket or not self.region:
            raise ValueError("TENCENT_COS_BUCKET / TENCENT_COS_REGION 未配置")

    # ------------------------------------------------------------------
    # 对象操作
    # ------------------------------------------------------------------
    async def upload_file(self, key: str, file_bytes: bytes) -> dict:
        """上传文件 (简单上传 PutObject, 限 5MB 以内).

        Returns: {"key": ..., "url": ..., "size": ...}
        """
        if not key:
            raise ValueError("key 不能为空")
        if len(file_bytes) > _UPLOAD_MAX_BYTES:
            raise ValueError(
                f"文件超过简单上传上限 {_UPLOAD_MAX_BYTES} 字节, 请使用分片上传 (key={key})"
            )

        host = self._host()
        path = _url_encode_path(key)
        url = f"https://{host}/{path}"
        headers = {
            "Content-Type": "application/octet-stream",
            "Content-Length": str(len(file_bytes)),
            "Host": host,
        }
        auth = self._sign("put", key_path=f"/{key}", headers=headers, params={})
        headers["Authorization"] = auth

        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
                resp = await client.put(url, headers=headers, content=file_bytes)
                resp.raise_for_status()
            result = {
                "key": key,
                "url": self.get_file_url(key),
                "size": len(file_bytes),
            }
            logger.info(f"cos upload ok: key={key} size={len(file_bytes)}")
            return result
        except httpx.HTTPStatusError as e:
            logger.error(
                f"cos upload http error: key={key} status={e.response.status_code} body={e.response.text[:500]}"
            )
            raise
        except Exception as e:
            logger.error(f"cos upload failed: key={key} err={e}")
            raise

    async def download_file(self, key: str) -> bytes:
        """下载文件, 返回文件字节内容."""
        if not key:
            raise ValueError("key 不能为空")
        host = self._host()
        path = _url_encode_path(key)
        url = f"https://{host}/{path}"
        headers = {"Host": host}
        auth = self._sign("get", key_path=f"/{key}", headers=headers, params={})
        headers["Authorization"] = auth

        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                data = resp.content
            logger.info(f"cos download ok: key={key} size={len(data)}")
            return data
        except httpx.HTTPStatusError as e:
            logger.error(
                f"cos download http error: key={key} status={e.response.status_code} body={e.response.text[:500]}"
            )
            raise
        except Exception as e:
            logger.error(f"cos download failed: key={key} err={e}")
            raise

    async def delete_file(self, key: str) -> bool:
        """删除文件, 成功返回 True."""
        if not key:
            raise ValueError("key 不能为空")
        host = self._host()
        path = _url_encode_path(key)
        url = f"https://{host}/{path}"
        headers = {"Host": host}
        auth = self._sign("delete", key_path=f"/{key}", headers=headers, params={})
        headers["Authorization"] = auth

        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
                resp = await client.delete(url, headers=headers)
                # COS 删除不存在对象也返回 204
                if resp.status_code in (200, 204):
                    logger.info(f"cos delete ok: key={key}")
                    return True
                resp.raise_for_status()
                return True
        except httpx.HTTPStatusError as e:
            logger.error(
                f"cos delete http error: key={key} status={e.response.status_code} body={e.response.text[:500]}"
            )
            raise
        except Exception as e:
            logger.error(f"cos delete failed: key={key} err={e}")
            raise

    def get_file_url(self, key: str) -> str:
        """获取文件访问 URL.

        优先返回 CDN 域名 (TENCENT_COS_CDN_VISIT_PATH), 否则返回默认 COS 域名.
        注意: 返回的是公开访问 URL (需存储桶/对象为公开读; 私有读请用 get_presigned_url).
        """
        if not key:
            return ""
        encoded = _url_encode_path(key)
        if self.cdn_visit_path:
            return f"{self.cdn_visit_path}/{encoded}"
        return f"https://{self._host()}/{encoded}"

    async def list_files(self, prefix: str = "", limit: int = 100) -> dict:
        """列举文件 (GetBucket).

        Returns: {"contents": [{key, size, last_modified}], "total": N, "is_truncated": bool}
        """
        host = self._host()
        params: dict[str, str] = {
            "max-keys": str(limit),
            "prefix": prefix,
        }
        # 构造签名用的参数 (key 小写, 排序)
        sign_params = {k: v for k, v in params.items()}
        headers = {"Host": host}
        auth = self._sign("get", key_path="/", headers=headers, params=sign_params)
        headers["Authorization"] = auth

        query = "&".join(f"{k}={_url_encode_value(v)}" for k, v in params.items())
        url = f"https://{host}/?{query}"

        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                xml_text = resp.text
            contents = self._parse_list_xml(xml_text)
            return {
                "contents": contents,
                "total": len(contents),
                "is_truncated": "IsTruncated>true" in xml_text.replace(" ", ""),
            }
        except httpx.HTTPStatusError as e:
            logger.error(
                f"cos list http error: prefix={prefix} status={e.response.status_code} body={e.response.text[:500]}"
            )
            raise
        except Exception as e:
            logger.error(f"cos list failed: prefix={prefix} err={e}")
            raise

    def get_presigned_url(self, key: str, expire_seconds: int = _DEFAULT_EXPIRE_SECONDS, method: str = "get") -> str:
        """生成预签名 URL (私有读场景下临时访问)."""
        if not key:
            return ""
        host = self._host()
        path = _url_encode_path(key)
        start = int(time.time())
        end = start + int(expire_seconds)
        key_time = f"{start};{end}"

        # 预签名 URL: 参数中带 q-sign-algorithm/q-ak/q-sign-time/q-key-time/q-header-list/q-url-param-list/q-signature
        sign_params = {
            "q-sign-algorithm": "sha1",
            "q-ak": self.secret_id,
            "q-sign-time": key_time,
            "q-key-time": key_time,
            "q-header-list": "",
            "q-url-param-list": "",
        }
        # 签名: method=get, path=/key, headers={}, params=sign_params (参与签名)
        auth = self._sign(method.lower(), key_path=f"/{key}", headers={}, params=sign_params, key_time=key_time)
        # 从 auth 中提取 q-signature
        signature = ""
        for part in auth.split("&"):
            if part.startswith("q-signature="):
                signature = part[len("q-signature="):]
                break
        sign_params["q-signature"] = signature
        query = "&".join(f"{k}={_url_encode_value(v)}" for k, v in sign_params.items())
        return f"https://{host}/{path}?{query}"

    # ------------------------------------------------------------------
    # 签名与工具
    # ------------------------------------------------------------------
    def _host(self) -> str:
        """COS 访问域名: {bucket}.cos.{region}.myqcloud.com."""
        return f"{self.bucket}.cos.{self.region}.myqcloud.com"

    def _sign(
        self,
        method: str,
        key_path: str,
        headers: dict[str, str],
        params: dict[str, str],
        key_time: str | None = None,
    ) -> str:
        """生成 COS HMAC-SHA1 签名 Authorization 头.

        算法 (腾讯云 COS 单次签名):
            KeyTime = "start;end"
            SignKey = HMAC-SHA1(SecretKey, KeyTime) -> hex
            FormatString = method\nuri\nhttp_params\nhttp_headers\n
            StringToSign = "sha1\nKeyTime\nsha1(FormatString)\n"
            Signature = HMAC-SHA1(SignKey, StringToSign) -> hex
        """
        if key_time is None:
            start = int(time.time())
            end = start + _DEFAULT_EXPIRE_SECONDS
            key_time = f"{start};{end}"

        # 1. SignKey
        sign_key = hmac.new(
            self.secret_key.encode("utf-8"), key_time.encode("utf-8"), hashlib.sha1
        ).hexdigest()

        # 2. FormatString
        # HttpHeaders: 小写 key, 排序, key=value 用 & 连接 (value 为原始值)
        header_items = sorted((k.lower(), str(v).strip()) for k, v in headers.items() if k.lower() != "authorization")
        header_list = ";".join(k for k, _ in header_items)
        header_str = "&".join(f"{k}={v}" for k, v in header_items)

        # HttpParameters: 小写 key, 排序, key=value
        param_items = sorted((k.lower(), str(v)) for k, v in params.items())
        param_list = ";".join(k for k, _ in param_items)
        param_str = "&".join(f"{k}={v}" for k, v in param_items)

        uri = key_path if key_path.startswith("/") else f"/{key_path}"
        format_string = f"{method.lower()}\n{uri}\n{param_str}\n{header_str}\n"

        # 3. StringToSign
        format_sha = hashlib.sha1(format_string.encode("utf-8")).hexdigest()
        string_to_sign = f"sha1\n{key_time}\n{format_sha}\n"

        # 4. Signature
        signature = hmac.new(
            sign_key.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha1
        ).hexdigest()

        # 5. Authorization
        return (
            f"q-sign-algorithm=sha1"
            f"&q-ak={self.secret_id}"
            f"&q-sign-time={key_time}"
            f"&q-key-time={key_time}"
            f"&q-header-list={header_list}"
            f"&q-url-param-list={param_list}"
            f"&q-signature={signature}"
        )

    @staticmethod
    def _parse_list_xml(xml_text: str) -> list[dict]:
        """简易解析 COS ListBucket 返回的 XML (不依赖 lxml).

        提取每个 <Contents><Key>...</Key><Size>...</Size><LastModified>...</LastModified></Contents>
        """
        contents: list[dict] = []
        # 用字符串切片解析, 避免引入第三方 XML 库
        marker = 0
        while True:
            start = xml_text.find("<Contents>", marker)
            if start == -1:
                break
            end = xml_text.find("</Contents>", start)
            if end == -1:
                break
            block = xml_text[start + len("<Contents>"):end]
            key = _extract_xml_text(block, "Key")
            size_str = _extract_xml_text(block, "Size")
            last_mod = _extract_xml_text(block, "LastModified")
            try:
                size = int(size_str) if size_str else 0
            except ValueError:
                size = 0
            contents.append({
                "key": key,
                "size": size,
                "last_modified": last_mod,
            })
            marker = end + len("</Contents>")
        return contents


def _extract_xml_text(block: str, tag: str) -> str:
    """从 XML 片段中提取首个 <tag>...</tag> 文本."""
    open_tag = f"<{tag}>"
    close_tag = f"</{tag}>"
    s = block.find(open_tag)
    if s == -1:
        return ""
    s += len(open_tag)
    e = block.find(close_tag, s)
    if e == -1:
        return ""
    return block[s:e]


def get_cos_client() -> TencentCOSClient:
    """获取默认配置的腾讯云 COS 客户端实例."""
    return TencentCOSClient()
