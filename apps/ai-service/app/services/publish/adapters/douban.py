"""豆瓣 适配器(基于 Playwright + 反风控五层防线)。

凭证:{ db_clnd, ck } — 均为 .douban.com 域 cookie

实现:
- verify_credentials: 打开 https://www.douban.com 检查登录态
- publish: 打开 https://www.douban.com/note/create → 人类化填标题/正文 → 点发表

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class DoubanAdapter(PlaywrightBaseAdapter):
    """豆瓣适配器。"""

    platform_id = "douban"
    platform_name = "豆瓣"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["db_clnd", "ck"]

    home_url = "https://www.douban.com"
    create_url = "https://www.douban.com/note/create"
    title_selector = 'input[placeholder*="标题"], input#title, input.note-title'
    editor_selector = '.ql-editor, [contenteditable="true"], textarea.editor-content, #content'
    publish_selector = 'button:has-text("发表"), input:has-text("发表"), .submit-btn'
    success_selector = (
        ".success-tip, .msg-success, .el-message--success, "
        ".ant-message-success"
    )
    cookie_specs = [
        CookieSpec("db_clnd", ".douban.com", http_only=True),
        CookieSpec("ck", ".douban.com"),
    ]
    primary_cookie = "db_clnd"
    verify_logout_required = True
    max_title_len = 80
    max_tags = 0
    simulate_read_min = 10.0
    simulate_read_max = 30.0
    success_url_include = "/note/"
    success_url_exclude = ("create",)
