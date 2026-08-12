"""百度贴吧 适配器(基于 Playwright + 反风控五层防线)。

百度贴吧是百度系论坛平台,与百家号共用 BDUSS/STOKEN 凭证。发帖需指定目标贴吧(platform_config.tieba_kw)。

凭证:{ BDUSS, STOKEN } — 均为 .baidu.com 域 httpOnly cookie

实现:
- verify_credentials: 打开 https://tieba.baidu.com 检查登录态
- publish: 打开 https://tieba.baidu.com/f?kw=<贴吧名> → 人类化填标题/正文 → 点发帖

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from typing import Any

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class BaiduTiebaAdapter(PlaywrightBaseAdapter):
    """百度贴吧适配器。"""

    platform_id = "baidu_tieba"
    platform_name = "百度贴吧"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["BDUSS", "STOKEN"]

    home_url = "https://tieba.baidu.com"
    title_selector = 'input[placeholder*="标题"], input#title, input.tieba-title'
    editor_selector = '.ql-editor, [contenteditable="true"], textarea.editor-content'
    publish_selector = 'button:has-text("发表"), button:has-text("发帖"), .submit-btn'
    success_selector = (
        ".success-tip, .msg-success, .el-message--success, "
        ".ant-message-success"
    )
    cookie_specs = [
        CookieSpec("BDUSS", ".baidu.com", http_only=True),
        CookieSpec("STOKEN", ".baidu.com", http_only=True),
    ]
    primary_cookie = "BDUSS"
    verify_logout_required = True
    max_title_len = 30
    max_tags = 0
    simulate_read_min = 10.0
    simulate_read_max = 30.0
    success_url_include = "/p/"
    success_url_exclude = ("login",)

    def build_create_url(self, platform_config: dict[str, Any]) -> str:
        tieba_kw = (platform_config.get("tieba_kw") or "").strip()
        return f"https://tieba.baidu.com/f?kw={tieba_kw}&fr=index"

    def validate_publish_config(self, platform_config: dict[str, Any]) -> str | None:
        if not (platform_config.get("tieba_kw") or "").strip():
            return "missing tieba_kw in platform_config (target forum name)"
        return None

    def extra_payload(self, platform_config: dict[str, Any]) -> dict[str, Any]:
        return {"tieba_kw": (platform_config.get("tieba_kw") or "").strip()}
