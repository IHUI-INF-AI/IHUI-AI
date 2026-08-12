"""虎扑社区 适配器(基于 Playwright + 反风控五层防线)。

凭证:{ hupu_token, hupu_session } — 均为 .hupu.com 域 cookie

实现:
- verify_credentials: 打开 https://bbs.hupu.com 检查登录态
- publish: 打开 https://bbs.hupu.com/{hupu_fid}/post → 人类化填标题/正文 → 点发帖

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from typing import Any

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class HupuAdapter(PlaywrightBaseAdapter):
    """虎扑社区适配器。"""

    platform_id = "hupu"
    platform_name = "虎扑社区"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["hupu_token", "hupu_session"]

    home_url = "https://bbs.hupu.com"
    title_selector = 'input[placeholder*="标题"], input#title, .post-title-input'
    editor_selector = '.ql-editor, [contenteditable="true"], textarea.editor-content'
    publish_selector = 'button:has-text("发表"), button:has-text("发帖"), .submit-btn'
    success_selector = (
        ".success-tip, .msg-success, .el-message--success, "
        ".ant-message-success"
    )
    cookie_specs = [
        CookieSpec("hupu_token", ".hupu.com", http_only=True),
        CookieSpec("hupu_session", ".hupu.com"),
    ]
    primary_cookie = "hupu_token"
    verify_logout_required = False
    max_title_len = 40
    max_tags = 0
    simulate_read_min = 10.0
    simulate_read_max = 30.0
    success_url_include = "/post-"
    success_url_exclude = ("login",)

    def build_create_url(self, platform_config: dict[str, Any]) -> str:
        hupu_fid = (platform_config.get("hupu_fid") or "").strip()
        return f"https://bbs.hupu.com/{hupu_fid}/post"

    def validate_publish_config(self, platform_config: dict[str, Any]) -> str | None:
        if not (platform_config.get("hupu_fid") or "").strip():
            return "missing hupu_fid in platform_config (target forum id)"
        return None

    def extra_payload(self, platform_config: dict[str, Any]) -> dict[str, Any]:
        return {"hupu_fid": (platform_config.get("hupu_fid") or "").strip()}
