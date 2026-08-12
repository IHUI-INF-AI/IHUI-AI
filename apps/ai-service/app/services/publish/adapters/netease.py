"""网易号 适配器(基于 Playwright + 反风控五层防线)。

凭证:{ P_INFO, S_INFO, NTES_SESS } — 均为 .163.com 域 cookie

实现:
- verify_credentials: 打开 https://mp.163.com 检查登录态
- publish: 打开 https://mp.163.com/editor/article.html
          → 人类化填标题 → 分段填正文(富文本 execCommand)→ 选分类 → 填标签 → 点发布

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class NeteaseAdapter(PlaywrightBaseAdapter):
    """网易号适配器。"""

    platform_id = "netease"
    platform_name = "网易号"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["P_INFO", "S_INFO", "NTES_SESS"]

    home_url = "https://mp.163.com"
    create_url = "https://mp.163.com/editor/article.html"
    title_selector = "input.article-title"
    editor_selector = '.article-editor [contenteditable="true"], [contenteditable="true"]'
    tag_selector = 'input[placeholder*="标签"]'
    publish_selector = 'button:has-text("发布")'
    category_selector = "select.category"
    success_selector = (
        ".el-message--success, .toast-success, .success-tip, "
        ".ant-message-success, .msg-success"
    )
    cookie_specs = [
        CookieSpec("P_INFO", ".163.com", http_only=True),
        CookieSpec("S_INFO", ".163.com"),
        CookieSpec("NTES_SESS", ".163.com", http_only=True),
    ]
    primary_cookie = "P_INFO"
    verify_logout_required = True
    max_title_len = 80
    max_tags = 5
    simulate_read_min = 15.0
    simulate_read_max = 45.0
    success_url_include = ""
    success_url_exclude = ("/editor/article", "login")
