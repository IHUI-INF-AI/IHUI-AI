"""AcFun 适配器(基于 Playwright + 反风控五层防线)。

凭证:{ acPasstoken, ac_session } — 均为 .acfun.cn 域 cookie

实现:
- verify_credentials: 打开 https://www.acfun.cn 检查登录态
- publish: 打开 https://member.aifun.com/article/create → 人类化填标题/正文 → 点发布

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class AcfunAdapter(PlaywrightBaseAdapter):
    """AcFun 适配器。"""

    platform_id = "acfun"
    platform_name = "AcFun"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["acPasstoken", "ac_session"]

    home_url = "https://www.acfun.cn"
    create_url = "https://member.aifun.com/article/create"
    title_selector = 'input[placeholder*="标题"], input#title, .article-title-input'
    editor_selector = '.ql-editor, [contenteditable="true"], .article-editor'
    publish_selector = 'button:has-text("发布"), button:has-text("投稿"), .submit-btn'
    success_selector = (
        ".success-tip, .msg-success, .el-message--success, "
        ".ant-message-success"
    )
    cookie_specs = [
        CookieSpec("acPasstoken", ".acfun.cn", http_only=True),
        CookieSpec("ac_session", ".acfun.cn"),
    ]
    primary_cookie = "acPasstoken"
    verify_logout_required = False
    max_title_len = 50
    max_tags = 0
    simulate_read_min = 10.0
    simulate_read_max = 30.0
    success_url_include = "/article/"
    success_url_exclude = ("create",)
