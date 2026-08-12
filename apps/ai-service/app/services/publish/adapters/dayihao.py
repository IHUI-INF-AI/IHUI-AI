"""大鱼号 适配器(基于 Playwright + 反风控五层防线)。

凭证:{ cna, _csrf_token, unb } — 均为 .dayu.com 域 cookie

实现:
- verify_credentials: 打开 https://mp.dayu.com 检查登录态
- publish: 打开 https://mp.dayu.com/dashboard/article/edit
          → 人类化填标题 → 分段填正文(富文本 execCommand)→ 填标签 → 点发布

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class DayihaoAdapter(PlaywrightBaseAdapter):
    """大鱼号适配器。"""

    platform_id = "dayihao"
    platform_name = "大鱼号"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["cna", "_csrf_token", "unb"]

    home_url = "https://mp.dayu.com"
    create_url = "https://mp.dayu.com/dashboard/article/edit"
    title_selector = "input.article-title, #title"
    editor_selector = '.editor-content [contenteditable="true"], [contenteditable="true"]'
    tag_selector = 'input[placeholder*="标签"]'
    publish_selector = 'button:has-text("发布")'
    success_selector = (
        ".el-message--success, .toast-success, .success-tip, "
        ".ant-message-success, .msg-success"
    )
    cookie_specs = [
        CookieSpec("cna", ".dayu.com", http_only=True),
        CookieSpec("_csrf_token", ".dayu.com"),
        CookieSpec("unb", ".dayu.com", http_only=True),
    ]
    primary_cookie = "cna"
    verify_logout_required = True
    max_title_len = 80
    max_tags = 5
    simulate_read_min = 15.0
    simulate_read_max = 45.0
    success_url_include = ""
    success_url_exclude = ("/article/edit", "login")
