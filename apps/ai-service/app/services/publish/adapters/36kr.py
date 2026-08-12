"""36氪 适配器(基于 Playwright + 反风控五层防线)。

36氪是科技创投媒体平台,内容偏向创业/投资/科技资讯。

凭证:{ _36kr_session, acw_tc } — 均为 .36kr.com 域 cookie

实现:
- verify_credentials: 打开 https://www.36kr.com 检查登录态
- publish: 打开 https://write.36kr.com/posts/create → 人类化填标题/正文 → 点发布

反风控接入(强制):
- create_stealth_browser_context 替代裸 chromium.launch(每账号固定指纹+代理)
- human_type / human_click / human_pause / simulate_reading 人类化操作
- try/finally + close_stealth_context 统一清理

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class Kr36Adapter(PlaywrightBaseAdapter):
    """36氪适配器。"""

    platform_id = "36kr"
    platform_name = "36氪"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["_36kr_session", "acw_tc"]

    home_url = "https://www.36kr.com"
    create_url = "https://write.36kr.com/posts/create"
    title_selector = 'input[placeholder*="标题"], input#title, .article-title-input'
    editor_selector = '.ql-editor, [contenteditable="true"], .article-editor'
    publish_selector = 'button:has-text("发布"), button:has-text("发表"), .publish-btn'
    success_selector = (
        ".success-tip, .msg-success, .el-message--success, "
        ".ant-message-success"
    )
    cookie_specs = [
        CookieSpec("_36kr_session", ".36kr.com", http_only=True),
        CookieSpec("acw_tc", ".36kr.com"),
    ]
    primary_cookie = "_36kr_session"
    verify_logout_required = False
    max_title_len = 50
    max_tags = 3
    simulate_read_min = 10.0
    simulate_read_max = 30.0
    success_url_include = "/posts/"
    success_url_exclude = ("create",)
