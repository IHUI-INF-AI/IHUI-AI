"""百家号 适配器(基于 Playwright + 反风控五层防线)。

百家号是百度系内容创作平台,风控较严,本适配器完整接入反风控五层防线:
  stealth 反检测 / 指纹隔离 / 行为人类化 / 代理池 / 账号 profile 持久化。

凭证:{ BDUSS, STOKEN }  — 均为 .baidu.com 域 httpOnly cookie

实现:
- verify_credentials: 打开 https://baijiahao.baidu.com 检查登录态(是否跳登录页/有退出按钮)
- publish: 打开 https://baijiahao.baidu.com/builder/rc/edit?type=news
          → 人类化填标题 → 分段填正文(富文本 execCommand)→ 填标签 → 上传封面
          → 模拟阅读 → 人类化点发布 → 等待成功信号

2026-08-12 重构:骨架下沉到 PlaywrightBaseAdapter(声明式配置),本文件仅保留平台常量。
"""
from __future__ import annotations

from .playwright_base import CookieSpec, PlaywrightBaseAdapter


class BaijiahaoAdapter(PlaywrightBaseAdapter):
    """百家号适配器。"""

    platform_id = "baijiahao"
    platform_name = "百家号"
    supported_formats = ["md", "html", "image"]
    requires_credentials = ["BDUSS", "STOKEN"]

    home_url = "https://baijiahao.baidu.com"
    create_url = "https://baijiahao.baidu.com/builder/rc/edit?type=news"
    title_selector = "input.article-title, #articleTitle"
    editor_selector = '.ql-editor, [contenteditable="true"]'
    tag_selector = 'input[placeholder*="标签"]'
    publish_selector = 'button:has-text("发布")'
    success_selector = (
        ".el-message--success, .toast-success, .success-tip, "
        ".ant-message-success, .msg-success"
    )
    cookie_specs = [
        CookieSpec("BDUSS", ".baidu.com", http_only=True),
        CookieSpec("STOKEN", ".baidu.com", http_only=True),
    ]
    primary_cookie = "BDUSS"
    verify_logout_required = True
    max_title_len = 80
    max_tags = 5
    simulate_read_min = 15.0
    simulate_read_max = 45.0
    success_url_include = ""
    success_url_exclude = ("/edit", "login")
