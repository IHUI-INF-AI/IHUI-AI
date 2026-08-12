"""人民网 适配器(基于 Playwright + 反风控五层防线)。

凭证:{ people_session, people_token } — 均为 .people.com.cn 域 cookie

实现:
- verify_credentials: 打开 https://www.people.com.cn 检查登录态
- publish: 打开 https://www.people.com.cn/creator/write → 人类化填标题/正文 → 点发布

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class PeopleAdapter(PlaywrightBaseAdapter):
    """人民网适配器。"""

    platform_id = "people"
    platform_name = "人民网"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["people_session", "people_token"]

    home_url = "https://www.people.com.cn"
    create_url = "https://www.people.com.cn/creator/write"
    title_selector = 'input[placeholder*="标题"], input#title, .article-title-input'
    editor_selector = '.ql-editor, [contenteditable="true"], .article-editor'
    publish_selector = 'button:has-text("发布"), button:has-text("提交"), .publish-btn'
    success_selector = (
        ".success-tip, .msg-success, .el-message--success, "
        ".ant-message-success"
    )
    cookie_specs = [
        CookieSpec("people_session", ".people.com.cn", http_only=True),
        CookieSpec("people_token", ".people.com.cn"),
    ]
    primary_cookie = "people_session"
    verify_logout_required = False
    max_title_len = 40
    max_tags = 0
    simulate_read_min = 10.0
    simulate_read_max = 30.0
    success_url_include = ""
    success_url_exclude = ("write", "login")
