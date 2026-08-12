"""企鹅号 适配器(基于 Playwright + 反风控五层防线)。

凭证:{ RK, ptcz, pgv_pvid } — 均为 .qq.com 域 cookie

实现:
- verify_credentials: 打开 https://om.qq.com 检查登录态
- publish: 打开 https://om.qq.com/article/articlepublish
          → 人类化填标题 → 分段填正文(富文本 execCommand)→ 选分类 → 填标签 → 点发布

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class QqAdapter(PlaywrightBaseAdapter):
    """企鹅号适配器。"""

    platform_id = "qq"
    platform_name = "企鹅号"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["RK", "ptcz", "pgv_pvid"]

    home_url = "https://om.qq.com"
    create_url = "https://om.qq.com/article/articlepublish"
    title_selector = "input.title-input, #title"
    editor_selector = '.article-content [contenteditable="true"], [contenteditable="true"]'
    tag_selector = 'input[placeholder*="标签"]'
    publish_selector = 'button:has-text("发布")'
    category_selector = "select.category-select"
    success_selector = (
        ".el-message--success, .toast-success, .success-tip, "
        ".ant-message-success, .msg-success"
    )
    cookie_specs = [
        CookieSpec("RK", ".qq.com", http_only=True),
        CookieSpec("ptcz", ".qq.com"),
        CookieSpec("pgv_pvid", ".qq.com"),
    ]
    primary_cookie = "RK"
    verify_logout_required = True
    max_title_len = 80
    max_tags = 5
    simulate_read_min = 15.0
    simulate_read_max = 45.0
    success_url_include = ""
    success_url_exclude = ("/articlepublish", "login")
