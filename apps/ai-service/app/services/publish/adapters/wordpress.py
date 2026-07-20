"""WordPress 适配器(基于 XML-RPC API,真实可调通)。

凭证:{ site_url, username, application_password }

实现:
- verify_credentials: 调用 wp.getProfiles 验证用户名/应用密码
- publish: 调用 wp.newPost 发布文章(支持 HTML 内容 + 分类 + 标签)

依赖:python-wordpress-xmlrpc(若未安装,改用 httpx 直接发 XML-RPC 请求)
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.logging import get_logger
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)


class WordPressAdapter(BasePlatformAdapter):
    platform_id = "wordpress"
    platform_name = "WordPress"
    supported_formats = ["md", "html", "docx", "pdf"]
    requires_credentials = ["site_url", "username", "application_password"]

    def _xmlrpc(self, site_url: str, method: str, params: list[Any]) -> Any:
        """发送 XML-RPC 请求,返回解析后的 Python 对象。

        直接用 httpx POST XML body,不依赖 python-wordpress-xmlrpc 库。
        """
        xml_body = self._build_xmlrpc_request(method, params)
        # site_url 可能是首页路径,XML-RPC endpoint 固定为 /xmlrpc.php
        endpoint = site_url.rstrip("/")
        if not endpoint.endswith("xmlrpc.php"):
            endpoint = endpoint + "/xmlrpc.php"

        resp = httpx.post(
            endpoint,
            content=xml_body,
            headers={"Content-Type": "text/xml; charset=utf-8"},
            timeout=30.0,
        )
        resp.raise_for_status()
        return self._parse_xmlrpc_response(resp.content)

    def _build_xmlrpc_request(self, method: str, params: list[Any]) -> str:
        """构造 XML-RPC request body。"""
        root = ET.Element("methodCall")
        mname = ET.SubElement(root, "methodName")
        mname.text = method
        params_el = ET.SubElement(root, "params")
        for p in params:
            param_el = ET.SubElement(params_el, "param")
            value_el = ET.SubElement(param_el, "value")
            self._encode_value(value_el, p)
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")

    def _encode_value(self, parent: ET.Element, value: Any) -> None:
        if isinstance(value, bool):
            b = ET.SubElement(parent, "boolean")
            b.text = "1" if value else "0"
        elif isinstance(value, int):
            i = ET.SubElement(parent, "int")
            i.text = str(value)
        elif isinstance(value, float):
            d = ET.SubElement(parent, "double")
            d.text = str(value)
        elif isinstance(value, str):
            s = ET.SubElement(parent, "string")
            s.text = value
        elif isinstance(value, (list, tuple)):
            arr = ET.SubElement(parent, "array")
            data = ET.SubElement(arr, "data")
            for item in value:
                v = ET.SubElement(data, "value")
                self._encode_value(v, item)
        elif isinstance(value, dict):
            s = ET.SubElement(parent, "struct")
            for k, v in value.items():
                member = ET.SubElement(s, "member")
                name = ET.SubElement(member, "name")
                name.text = str(k)
                val = ET.SubElement(member, "value")
                self._encode_value(val, v)
        elif value is None:
            s = ET.SubElement(parent, "string")
            s.text = ""
        else:
            s = ET.SubElement(parent, "string")
            s.text = str(value)

    def _parse_xmlrpc_response(self, content: bytes) -> Any:
        """解析 XML-RPC response,返回 Python 对象。失败抛异常。"""
        root = ET.fromstring(content)
        # 检查 fault
        fault = root.find(".//fault")
        if fault is not None:
            fault_value = fault.find("value")
            fault_dict = self._decode_value(fault_value) if fault_value is not None else {}
            msg = fault_dict.get("faultString", "unknown XML-RPC fault") if isinstance(fault_dict, dict) else str(fault_dict)
            raise RuntimeError(f"WordPress XML-RPC fault: {msg}")
        # 取 params/param/value
        value = root.find(".//params/param/value")
        if value is None:
            return None
        return self._decode_value(value)

    def _decode_value(self, el: ET.Element) -> Any:
        if el is None:
            return None
        # 取第一个子元素(int/string/boolean/array/struct...)
        child = next(iter(el), None)
        if child is None:
            return el.text or ""
        tag = child.tag
        if tag == "int" or tag == "i4":
            try:
                return int(child.text or "0")
            except ValueError:
                return 0
        if tag == "double":
            try:
                return float(child.text or "0")
            except ValueError:
                return 0.0
        if tag == "boolean":
            return (child.text or "0") == "1"
        if tag == "string":
            return child.text or ""
        if tag == "array":
            return [self._decode_value(v) for v in child.findall("data/value")]
        if tag == "struct":
            result: dict[str, Any] = {}
            for member in child.findall("member"):
                name_el = member.find("name")
                val_el = member.find("value")
                if name_el is not None and val_el is not None:
                    result[name_el.text or ""] = self._decode_value(val_el)
            return result
        if tag == "dateTime.iso8601":
            return child.text or ""
        return child.text or ""

    async def verify_credentials(self, credentials: dict) -> tuple[bool, str]:
        site_url = credentials.get("site_url", "").strip()
        username = credentials.get("username", "").strip()
        app_pwd = credentials.get("application_password", "").strip()
        if not (site_url and username and app_pwd):
            return False, "missing required fields: site_url, username, application_password"

        try:
            # wp.getProfiles 拿当前用户信息(WordPress 5.4+)
            result = self._xmlrpc(site_url, "wp.getProfiles", [
                1,  # blog_id (多站点时用,单站点填 1)
                username,
                app_pwd,
            ])
        except httpx.HTTPError as e:
            return False, f"http error: {type(e).__name__}: {e}"
        except RuntimeError as e:
            return False, str(e)
        except Exception as e:
            return False, f"verify failed: {type(e).__name__}: {e}"

        if isinstance(result, dict):
            display_name = result.get("displayName") or result.get("display_name") or username
            user_id = result.get("user_id") or result.get("userId") or "?"
            return True, f"connected as {display_name} (user_id={user_id})"
        if isinstance(result, list) and result:
            return True, f"connected, {len(result)} profile(s)"
        return True, "connected"

    async def publish(
        self,
        content: PublishContent,
        credentials: dict,
        platform_config: dict,
    ) -> PublishResult:
        site_url = credentials.get("site_url", "").strip()
        username = credentials.get("username", "").strip()
        app_pwd = credentials.get("application_password", "").strip()
        if not (site_url and username and app_pwd):
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="invalid credentials (missing fields)",
            )

        html = content.html or ""
        if not html and content.text:
            # md → 简单换行转换(<p> + <br>)
            html = "".join(
                f"<p>{line}</p>" if line.strip() else "<br>"
                for line in content.text.split("\n\n")
            )

        post_data: dict[str, Any] = {
            "post_type": "post",
            "post_status": platform_config.get("post_status", "publish"),
            "post_title": content.title,
            "post_content": html,
            "post_excerpt": platform_config.get("excerpt", ""),
            "terms_names": {},
            "date_created": datetime.now(timezone.utc).strftime("%Y%m%dT%H:%M:%S"),
        }
        categories = platform_config.get("categories", [])
        tags = platform_config.get("tags", [])
        if categories:
            post_data["terms_names"]["category"] = categories
        if tags:
            post_data["terms_names"]["post_tag"] = tags

        try:
            post_id = self._xmlrpc(site_url, "wp.newPost", [
                1, username, app_pwd, post_data,
            ])
        except httpx.HTTPError as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"http error: {type(e).__name__}: {e}",
            )
        except RuntimeError as e:
            return PublishResult(
                success=False, platform=self.platform_id, error_message=str(e),
            )
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )

        post_id_str = str(post_id)
        # 构造前台 URL(简化:site_url/?p=id)
        published_url = site_url.rstrip("/") + f"/?p={post_id_str}"
        return PublishResult(
            success=True, platform=self.platform_id,
            published_url=published_url, platform_content_id=post_id_str,
            payload={"post_id": post_id_str, "post_status": post_data["post_status"]},
        )
