"""百度知道 适配器(基于 Playwright + 反风控五层防线)。

凭证:{ BDUSS, STOKEN } — 均为 .baidu.com 域 httpOnly cookie

实现:
- verify_credentials: 打开 https://zhidao.baidu.com 检查登录态
- publish: 打开 https://zhidao.baidu.com → 人类化填标题/正文 → 点提交

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class BaiduZhidaoAdapter(PlaywrightBaseAdapter):
    """百度知道适配器。"""

    platform_id = "baidu_zhidao"
    platform_name = "百度知道"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["BDUSS", "STOKEN"]

    home_url = "https://zhidao.baidu.com"
    create_url = "https://zhidao.baidu.com/ask"
    title_selector = 'input[placeholder*="问"], input.ask-title, #title'
    editor_selector = '.ql-editor, [contenteditable="true"], textarea.editor-content'
    publish_selector = 'button:has-text("提交"), button:has-text("发布"), .ask-submit-btn'
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
    max_title_len = 50
    max_tags = 5
    simulate_read_min = 10.0
    simulate_read_max = 30.0
    success_url_include = ""
    success_url_exclude = ("/ask", "login")
