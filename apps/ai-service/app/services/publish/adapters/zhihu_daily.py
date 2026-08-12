"""知乎日报 适配器(基于 Playwright + 反风控五层防线)。

知乎日报是知乎旗下精选内容平台,与知乎主站共用 z_c0/d_c0 凭证。

凭证:{ z_c0, d_c0 } — 均为 .zhihu.com 域 cookie

实现:
- verify_credentials: 打开 https://daily.zhihu.com 检查登录态
- publish: 打开 https://daily.zhihu.com/contribute → 人类化填标题/正文 → 点投稿

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class ZhihuDailyAdapter(PlaywrightBaseAdapter):
    """知乎日报适配器。"""

    platform_id = "zhihu_daily"
    platform_name = "知乎日报"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["z_c0", "d_c0"]

    home_url = "https://daily.zhihu.com"
    create_url = "https://daily.zhihu.com/contribute"
    title_selector = 'input[placeholder*="标题"], input#title, .article-title-input'
    editor_selector = '.ql-editor, [contenteditable="true"], .public-DraftEditor-content'
    publish_selector = 'button:has-text("投稿"), button:has-text("提交"), .submit-btn'
    success_selector = (
        ".success-tip, .msg-success, .el-message--success, "
        ".ant-message-success"
    )
    cookie_specs = [
        CookieSpec("z_c0", ".zhihu.com", http_only=True, secure=True, same_site="Lax"),
        CookieSpec("d_c0", ".zhihu.com"),
    ]
    primary_cookie = "z_c0"
    verify_logout_required = False
    max_title_len = 100
    max_tags = 0
    simulate_read_min = 5.0
    simulate_read_max = 15.0
    login_redirect_markers = ("login", "/signin")
    success_url_include = "/story/"
    success_url_exclude = ("contribute",)
