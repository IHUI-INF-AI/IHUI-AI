# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D11 浏览器自检截图工具单元测试(不真正启动浏览器)。

mock 掉 playwright 同步核心(_sync_capture)与视觉 LLM(_vision_analyze),
覆盖:
- URL 协议拒绝(file:// 等)
- console 错误收集
- 截图超时降级
- 自检报告结构(含 LLM 不可用降级)
- mcp_server 注册落点(工具名出现在 _TOOLS / _TOOL_HANDLERS)
"""

from __future__ import annotations

import time

from app.tools import browser_selfcheck as bs


def _async_return(value):
    """把同步 lambda mock 值包成 coroutine(_vision_analyze 已 async 化)。"""
    async def _inner():
        return value
    return _inner()


def _async_coro_raise(exc):
    """返回一个 await 时抛 exc 的 coroutine(模拟 LLM 异常)。"""
    async def _inner():
        raise exc
    return _inner()


def _fake_capture_ok(url, viewport, full_page, wait_ms):
    """模拟 playwright 成功截图。"""
    return {
        "ok": True,
        "imageBase64": "iVBORw0KGgoAAAANSUhEUg==",
        "width": 1280,
        "height": 720,
        "consoleErrors": ["Uncaught TypeError: x is not a function", "pageerror: boom"],
        "title": "Demo Page",
        "finalUrl": url,
    }


def _fake_capture_slow(url, viewport, full_page, wait_ms):
    time.sleep(2)  # 故意超过测试用的小超时
    return _fake_capture_ok(url, viewport, full_page, wait_ms)


# =============================================================================
# 1. URL 协议拒绝
# =============================================================================
async def test_scheme_rejected_file(monkeypatch):
    """file:// 等非 http/https 协议必须被拒绝,且不触发浏览器。"""
    called = {"n": 0}

    def _spy(*a, **k):
        called["n"] += 1
        return _fake_capture_ok(*a, **k)

    monkeypatch.setattr(bs, "_sync_capture", _spy)
    result = await bs.capture_screenshot("file:///etc/passwd")
    assert result["ok"] is False
    assert result["errorCode"] == "SCHEME_REJECTED"
    assert result["consoleErrors"] == []
    assert result["width"] == 0 and result["height"] == 0
    # 协议校验在 playwright 之前返回,浏览器未被调用
    assert called["n"] == 0


async def test_scheme_rejected_empty(monkeypatch):
    monkeypatch.setattr(bs, "_sync_capture", _fake_capture_ok)
    result = await bs.capture_screenshot("")
    assert result["ok"] is False
    assert result["errorCode"] == "SCHEME_REJECTED"


# =============================================================================
# 2. console 错误收集
# =============================================================================
async def test_console_errors_collected(monkeypatch):
    monkeypatch.setattr(bs, "_sync_capture", _fake_capture_ok)
    result = await bs.capture_screenshot("https://example.com")
    assert result["ok"] is True
    assert result["imageBase64"]
    assert result["width"] == 1280 and result["height"] == 720
    assert "Uncaught TypeError" in result["consoleErrors"][0]
    assert "pageerror: boom" in result["consoleErrors"]
    assert result["title"] == "Demo Page"
    assert result["finalUrl"] == "https://example.com"


# =============================================================================
# 3. 截图超时降级
# =============================================================================
async def test_capture_timeout_degradation(monkeypatch):
    """单步超时(<=20s)必须降级为 ok:False,绝不抛异常。"""
    monkeypatch.setattr(bs, "CAPTURE_TIMEOUT_S", 0.2)
    monkeypatch.setattr(bs, "_sync_capture", _fake_capture_slow)
    result = await bs.capture_screenshot("https://example.com")
    assert result["ok"] is False
    assert result["errorCode"] == "TIMEOUT"
    assert result["consoleErrors"] == []
    assert result["width"] == 0 and result["height"] == 0


# =============================================================================
# 4. 自检报告结构 + 降级
# =============================================================================
async def test_selfcheck_report_structure(monkeypatch):
    """截图成功 + 视觉 LLM 返回可解析 JSON → 逐项 pass/fail + 理由。"""
    monkeypatch.setattr(bs, "_sync_capture", _fake_capture_ok)
    monkeypatch.setattr(
        bs,
        "_vision_analyze",
        lambda src, prompt, **kw: _async_return({
            "ok": True,
            "analysis": (
                '{"checks":['
                '{"check":"提交按钮可见","pass":true,"reason":"截图右下角有主按钮"},'
                '{"check":"无白屏","pass":false,"reason":"页面主体为空白"}'
                "]} "
            ),
            "model": "vision-model-x",
        }),
    )
    result = await bs.selfcheck_report("https://example.com", ["提交按钮可见", "无白屏"])
    assert result["ok"] is True
    assert result["visionChecked"] is True
    assert result["visionModel"] == "vision-model-x"
    assert len(result["checks"]) == 2
    assert result["checks"][0]["check"] == "提交按钮可见"
    assert result["checks"][0]["pass"] is True
    assert result["checks"][0]["reason"]
    assert result["checks"][1]["pass"] is False
    # console 错误透传
    assert result["consoleErrors"]


async def test_selfcheck_report_vision_unavailable_degrade(monkeypatch):
    """视觉 LLM 不可用 → 降级为仅返回截图 + console 错误,不报错、不抛。"""
    monkeypatch.setattr(bs, "_sync_capture", _fake_capture_ok)
    monkeypatch.setattr(
        bs,
        "_vision_analyze",
        lambda src, prompt, **kw: _async_coro_raise(RuntimeError("llm down")),
    )
    result = await bs.selfcheck_report("https://example.com", ["提交按钮可见"])
    assert result["ok"] is True  # 截图成功
    assert result["visionChecked"] is False
    assert result["checks"] == []
    assert result["note"]  # 有降级说明
    assert result["consoleErrors"]


async def test_selfcheck_report_vision_unparseable_degrade(monkeypatch):
    """视觉 LLM 返回非 JSON → 解析失败降级,checks 空但不崩溃。"""
    monkeypatch.setattr(bs, "_sync_capture", _fake_capture_ok)
    monkeypatch.setattr(
        bs,
        "_vision_analyze",
        lambda src, prompt, **kw: _async_return(
            {"ok": True, "analysis": "我看不懂这段截图", "model": "m"}
        ),
    )
    result = await bs.selfcheck_report("https://example.com", ["X 可见"])
    assert result["ok"] is True
    assert result["visionChecked"] is False
    assert result["checks"] == []
    assert result["visionError"]


async def test_selfcheck_report_capture_failed(monkeypatch):
    """截图本身失败 → ok:False + checks 空。"""
    monkeypatch.setattr(
        bs,
        "_sync_capture",
        lambda *a, **k: {
            "ok": False,
            "imageBase64": None,
            "width": 0,
            "height": 0,
            "consoleErrors": [],
            "title": "",
            "finalUrl": "https://example.com",
            "error": "browser missing",
            "errorCode": "CAPTURE_FAILED",
        },
    )
    result = await bs.selfcheck_report("https://example.com", ["X 可见"])
    assert result["ok"] is False
    assert result["checks"] == []
    assert result["errorCode"] == "CAPTURE_FAILED"


# =============================================================================
# 5. mcp_server 注册落点
# =============================================================================
def test_mcp_registration_present():
    """两个新工具必须出现在 _TOOLS 与 _TOOL_HANDLERS。"""
    from app.services.mcp_server import _TOOL_HANDLERS, get_registered_tool_names

    names = get_registered_tool_names()
    assert "browser_selfcheck_screenshot" in names
    assert "browser_selfcheck" in names
    assert _TOOL_HANDLERS.get("browser_selfcheck_screenshot") is not None
    assert _TOOL_HANDLERS.get("browser_selfcheck") is not None
    # 不得覆盖既有的 extension 端 browser_screenshot(agent-control handler)
    assert _TOOL_HANDLERS.get("browser_screenshot") is not None


async def test_tool_handler_dispatch(monkeypatch):
    """mcp handler 调用 capture_screenshot 并把结果映射成统一工具返回格式。"""
    from app.services.mcp_server import _tool_browser_selfcheck_screenshot

    monkeypatch.setattr(bs, "_sync_capture", _fake_capture_ok)
    result = await _tool_browser_selfcheck_screenshot(
        {"url": "https://example.com", "wait_ms": 100}
    )
    assert result["tool"] == "browser_selfcheck_screenshot"
    assert result["ok"] is True
    assert result["width"] == 1280
    assert result["consoleErrors"]
    # 协议非法的输入走 handler 的入口校验
    bad = await _tool_browser_selfcheck_screenshot({"url": "file:///etc/passwd"})
    assert bad["ok"] is False
    assert bad["errorCode"] == "SCHEME_REJECTED"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
