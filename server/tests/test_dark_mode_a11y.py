"""暗黑模式 + A11y 验证 - 服务端 404 HTML 错误页面的 A11y 检查."""
from pathlib import Path

import pytest


def test_404_html_exists():
    """404 HTML 错误页应存在."""
    p = Path("app/static/errors/404.html")
    assert p.exists(), "404.html 缺失"


def test_500_html_exists():
    p = Path("app/static/errors/500.html")
    assert p.exists(), "500.html 缺失"


def test_403_html_exists():
    p = Path("app/static/errors/403.html")
    assert p.exists(), "403.html 缺失"


def test_404_html_has_prefers_color_scheme():
    """暗黑模式支持: 应使用 prefers-color-scheme media query."""
    content = Path("app/static/errors/404.html").read_text(encoding="utf-8")
    # 我们的 404 页默认深色 (深色背景变量), 通过 light media query 覆盖
    assert "prefers-color-scheme" in content, "404.html 缺少 prefers-color-scheme 媒体查询"


def test_404_html_has_aria_attributes():
    """A11y: 关键元素应有 ARIA 属性."""
    content = Path("app/static/errors/404.html").read_text(encoding="utf-8")
    assert 'role="main"' in content, "缺少 role=main"
    assert "aria-labelledby" in content, "缺少 aria-labelledby"
    assert "aria-label" in content, "缺少 aria-label"
    assert "lang=\"zh-CN\"" in content, "缺少 lang 属性"


def test_500_html_has_prefers_color_scheme():
    content = Path("app/static/errors/500.html").read_text(encoding="utf-8")
    assert "prefers-color-scheme" in content


def test_500_html_has_aria_attributes():
    content = Path("app/static/errors/500.html").read_text(encoding="utf-8")
    assert 'role="main"' in content
    assert "aria-labelledby" in content


def test_403_html_has_aria_attributes():
    content = Path("app/static/errors/403.html").read_text(encoding="utf-8")
    assert 'role="main"' in content
    assert "aria-labelledby" in content
