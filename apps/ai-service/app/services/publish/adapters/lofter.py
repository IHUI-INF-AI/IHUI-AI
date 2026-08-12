"""LOFTER 乐乎 适配器(基于 Playwright + 反风控五层防线)。

LOFTER 是网易系轻博客平台,与网易号共用 NTES_SESS/S_INFO 凭证。

凭证:{ NTES_SESS, S_INFO } — 均为 .163.com / .lofter.com 域 cookie

实现:
- verify_credentials: 打开 https://www.lofter.com 检查登录态
- publish: 打开 https://www.lofter.com/post → 人类化填标题/正文 → 点发布

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class LofterAdapter(PlaywrightBaseAdapter):
    """LOFTER 适配器。"""

    platform_id = "lofter"
    platform_name = "LOFTER"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["NTES_SESS", "S_INFO"]

    home_url = "https://www.lofter.com"
    create_url = "https://www.lofter.com/post"
    title_selector = 'input[placeholder*="标题"], input#title, .post-title-input'
    editor_selector = '.ql-editor, [contenteditable="true"], .post-editor'
    publish_selector = 'button:has-text("发布"), button:has-text("发表"), .submit-btn'
    success_selector = (
        ".success-tip, .msg-success, .el-message--success, "
        ".ant-message-success"
    )
    cookie_specs = [
        CookieSpec("NTES_SESS", ".163.com", http_only=True),
        CookieSpec("S_INFO", ".163.com"),
    ]
    primary_cookie = "NTES_SESS"
    verify_logout_required = False
    max_title_len = 50
    max_tags = 10
    simulate_read_min = 10.0
    simulate_read_max = 30.0
    success_url_include = "/post/"
    success_url_exclude = ("create",)
