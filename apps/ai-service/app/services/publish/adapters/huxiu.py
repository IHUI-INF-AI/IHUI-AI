"""虎嗅网 适配器(基于 Playwright + 反风控五层防线)。

凭证:{ huxiu_session, huxiu_token } — 均为 .huxiu.com 域 cookie

实现:
- verify_credentials: 打开 https://www.huxiu.com 检查登录态
- publish: 打开 https://www.huxiu.com/article/write → 人类化填标题/正文 → 点发布

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class HuxiuAdapter(PlaywrightBaseAdapter):
    """虎嗅网适配器。"""

    platform_id = "huxiu"
    platform_name = "虎嗅网"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["huxiu_session", "huxiu_token"]

    home_url = "https://www.huxiu.com"
    create_url = "https://www.huxiu.com/article/write"
    title_selector = 'input[placeholder*="标题"], input#title, .article-title-input'
    editor_selector = '.ql-editor, [contenteditable="true"], .article-editor'
    publish_selector = 'button:has-text("发布"), button:has-text("提交"), .publish-btn'
    success_selector = (
        ".success-tip, .msg-success, .el-message--success, "
        ".ant-message-success"
    )
    cookie_specs = [
        CookieSpec("huxiu_session", ".huxiu.com", http_only=True),
        CookieSpec("huxiu_token", ".huxiu.com"),
    ]
    primary_cookie = "huxiu_session"
    verify_logout_required = False
    max_title_len = 40
    max_tags = 0
    simulate_read_min = 10.0
    simulate_read_max = 30.0
    success_url_include = "/article/"
    success_url_exclude = ("write",)
