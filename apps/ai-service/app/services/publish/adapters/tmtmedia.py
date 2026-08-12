"""钛媒体 适配器(基于 Playwright + 反风控五层防线)。

凭证:{ tmt_session, tmt_token } — 均为 .tmtpost.com 域 cookie

实现:
- verify_credentials: 打开 https://www.tmtpost.com 检查登录态
- publish: 打开 https://www.tmtpost.com/article/write → 人类化填标题/正文 → 点发布

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class TmtmediaAdapter(PlaywrightBaseAdapter):
    """钛媒体适配器。"""

    platform_id = "tmtmedia"
    platform_name = "钛媒体"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["tmt_session", "tmt_token"]

    home_url = "https://www.tmtpost.com"
    create_url = "https://www.tmtpost.com/article/write"
    title_selector = 'input[placeholder*="标题"], input#title, .article-title-input'
    editor_selector = '.ql-editor, [contenteditable="true"], .article-editor'
    publish_selector = 'button:has-text("发布"), button:has-text("提交"), .publish-btn'
    success_selector = (
        ".success-tip, .msg-success, .el-message--success, "
        ".ant-message-success"
    )
    cookie_specs = [
        CookieSpec("tmt_session", ".tmtpost.com", http_only=True),
        CookieSpec("tmt_token", ".tmtpost.com"),
    ]
    primary_cookie = "tmt_session"
    verify_logout_required = False
    max_title_len = 40
    max_tags = 0
    simulate_read_min = 10.0
    simulate_read_max = 30.0
    success_url_include = "/article/"
    success_url_exclude = ("write",)
