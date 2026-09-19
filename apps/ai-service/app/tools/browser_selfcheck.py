# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D11:浏览器自检截图工具(agent 完成前端/UI 任务后的自主截图自检)。

对标 Codex / Trae 的 completion verification:agent 改完 UI 后能自己截图 + 视觉判断
「按钮 X 是否可见」「有无白屏」等,把结构化结论回写 agent 循环,形成闭环。

实现策略(2026-09,按仓库实际环境选择):
- playwright 已安装(本仓库 ai-service .venv 已装)→ 直接用 sync_playwright:
  同步 API 跑在独立线程(asyncio.to_thread),绕开 Windows SelectorEventLoop 的
  greenlet 跨线程问题(与 services/screenshot_service.py 同款思路)。
- 若未来 playwright 缺失但 websockets 可用 → 可走 CDP(Chrome DevTools Protocol):
  HTTP /json 取 webSocketDebuggerUrl,WS 发 Page.captureScreenshot。本模块把 CDP
  路径以「延迟导入 + 清晰报错」形式预留(见 _cdp_capture),缺失时返回结构化错误,
  工具本体仍合入,待用户决定是否 pip install websockets 并启动带
  --remote-debugging-port 的 Chrome。

安全模型(本地开发自检工具):
- 协议白名单:仅允许 http / https,禁止 file:// 及其它 scheme(防本地文件读取)。
- 内网 / 云元数据(169.254.169.254 / 127.0.0.1)地址的 SSRF 拦截【本工具未启用】——
  本地自检常需截图 127.0.0.1:PORT 的 dev server,故放行;若需与生产 screenshot_url
  同级别防护,可复用 services.screenshot_service._validate_url_ssrf。

铁律:任何异常都绝不上抛到 agent 循环,统一收敛为 {ok: False, ...} 结构。
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import time
from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# 单步截图总超时(秒);全链路 wait_for 包裹,超时降级为 ok:False。
# 测试可通过 monkeypatch.setattr(browser_selfcheck, "CAPTURE_TIMEOUT_S", 0.2) 触发超时用例。
CAPTURE_TIMEOUT_S = 20

# 单步浏览器内部 goto 超时(毫秒),必须小于 CAPTURE_TIMEOUT_S*1000 留余量。
_GOTO_TIMEOUT_MS = 15000

_ALLOWED_SCHEMES = {"http", "https"}


def _validate_scheme(url: str) -> tuple[bool, str]:
    """协议白名单:仅 http/https,禁止 file:// 等。

    Returns:
        (True, "") 或 (False, reason)
    """
    if not url or not isinstance(url, str):
        return False, "url 为空或非字符串"
    try:
        parsed = urlparse(url)
    except Exception as e:  # pragma: no cover - urlparse 极难抛
        return False, f"URL 解析失败: {e}"
    if parsed.scheme not in _ALLOWED_SCHEMES:
        # file:// 是重点拦截对象;其它非常规 scheme 一并拒绝。
        return False, f"协议 {parsed.scheme!r} 不被允许(仅 http/https,禁止 file:// 等)"
    if not parsed.hostname:
        return False, "URL 缺少 hostname"
    return True, ""


# ---------------------------------------------------------------------------
# 同步截图核心(在线程中执行,绕开 EventLoop 限制)
# ---------------------------------------------------------------------------
def _sync_capture(
    url: str,
    viewport: dict[str, Any] | None,
    full_page: bool,
    wait_ms: int,
) -> dict[str, Any]:
    """同步截图(playwright sync API),在线程池中运行。

    收集 console error 与 pageerror,返回结构化 dict。任何异常向上抛,由
    capture_screenshot 的 wait_for / try 捕获收敛。

    Returns:
        {ok, imageBase64, width, height, consoleErrors, title, finalUrl}
    """
    from playwright.sync_api import sync_playwright

    vw = int((viewport or {}).get("width", 1280))
    vh = int((viewport or {}).get("height", 720))

    console_errors: list[str] = []

    def _on_console(msg: Any) -> None:
        # msg.type 为字符串:"error" / "warning" / "log" / "info" ...
        if getattr(msg, "type", "") == "error":
            console_errors.append(str(msg.text))

    def _on_pageerror(exc: Any) -> None:
        console_errors.append(f"pageerror: {exc}")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-plugins",
                "--disable-default-apps",
            ],
        )
        try:
            context = browser.new_context(
                viewport={"width": vw, "height": vh},
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
            )
            page = context.new_page()
            page.on("console", _on_console)
            page.on("pageerror", _on_pageerror)
            try:
                response = page.goto(url, wait_until="load", timeout=_GOTO_TIMEOUT_MS)
                if response is None:
                    raise RuntimeError(f"页面加载失败(无响应): {url}")
                # 等待前端渲染/动画稳定(截图自检常需等组件挂载)。
                if wait_ms and wait_ms > 0:
                    page.wait_for_timeout(int(wait_ms))
                screenshot_bytes = page.screenshot(full_page=full_page, type="png")
                image_base64 = base64.b64encode(screenshot_bytes).decode("ascii")
                vs = page.viewport_size or {"width": vw, "height": vh}
                return {
                    "ok": True,
                    "imageBase64": image_base64,
                    "width": int(vs.get("width", vw)),
                    "height": int(vs.get("height", vh)),
                    "consoleErrors": console_errors,
                    "title": page.title() or page.url,
                    "finalUrl": page.url,
                }
            finally:
                page.close()
                context.close()
        finally:
            browser.close()


# ---------------------------------------------------------------------------
# CDP 兜底路径(延迟导入 websockets;当前环境 playwright 已装,本路径为预留)
# ---------------------------------------------------------------------------
def _cdp_capture(
    url: str,
    viewport: dict[str, Any] | None,
    full_page: bool,
    wait_ms: int,
    debugger_url: str = "http://127.0.0.1:9222",
) -> dict[str, Any]:
    """CDP 截图兜底(Chrome DevTools Protocol)。

    前置:目标页面以 `chrome --remote-debugging-port=9222` 打开,且本环境已
    `pip install websockets`。若 websockets 缺失,返回结构化错误(不动 agent 循环)。

    注意:此路径仅做最小可用实现骨架,当前仓库 playwright 已装,主路径走 _sync_capture。
    """
    try:
        import websockets
    except ImportError:
        return {
            "ok": False,
            "imageBase64": None,
            "width": 0,
            "height": 0,
            "consoleErrors": [],
            "title": "",
            "finalUrl": url,
            "error": (
                "websockets 未安装,CDP 截图不可用。请执行: "
                "pip install websockets 并以 chrome --remote-debugging-port=9222 启动浏览器"
            ),
            "errorCode": "CDP_UNAVAILABLE",
        }
    # 真实 CDP 实现需:GET {debugger_url}/json 取 webSocketDebuggerUrl →
    # WS 发 Page.enable / Page.captureScreenshot。此处占位,主路径为 playwright。
    _ = (websockets, viewport, full_page, wait_ms)
    return {
        "ok": False,
        "imageBase64": None,
        "width": 0,
        "height": 0,
        "consoleErrors": [],
        "title": "",
        "finalUrl": url,
        "error": "CDP 路径未在此环境启用(本仓库 playwright 已装,优先使用 playwright 截图)",
        "errorCode": "CDP_DISABLED",
    }


# ---------------------------------------------------------------------------
# 对外异步 API
# ---------------------------------------------------------------------------
async def capture_screenshot(
    url: str,
    viewport: dict[str, Any] | None = None,
    full_page: bool = False,
    wait_ms: int = 1500,
) -> dict[str, Any]:
    """对指定 URL 截图自检,返回结构化结果。

    Returns:
        {
          ok: bool,
          imageBase64?: str,        # PNG base64(ok=True 时存在)
          width: int, height: int,  # 视口尺寸
          consoleErrors: list[str], # 页面 console error + pageerror 文本
          title: str, finalUrl: str,
          error?: str, errorCode?: str
        }
    任何异常(协议非法 / 浏览器缺失 / 超时 / 页面崩溃)均收敛为 {ok: False, ...},
    绝不抛到 agent 循环。
    """
    ok, reason = _validate_scheme(url)
    if not ok:
        return {
            "ok": False,
            "imageBase64": None,
            "width": 0,
            "height": 0,
            "consoleErrors": [],
            "title": "",
            "finalUrl": url,
            "error": reason,
            "errorCode": "SCHEME_REJECTED",
        }

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_sync_capture, url, viewport, full_page, wait_ms),
            timeout=CAPTURE_TIMEOUT_S,
        )
        return result
    except asyncio.TimeoutError:
        logger.warning("[browser_selfcheck] capture_screenshot 超时(%ss): %s", CAPTURE_TIMEOUT_S, url)
        return {
            "ok": False,
            "imageBase64": None,
            "width": 0,
            "height": 0,
            "consoleErrors": [],
            "title": "",
            "finalUrl": url,
            "error": f"截图超时(>{CAPTURE_TIMEOUT_S}s)",
            "errorCode": "TIMEOUT",
        }
    except Exception as e:  # noqa: BLE001 - 收敛所有异常,绝不上抛
        err_type = type(e).__name__
        logger.warning("[browser_selfcheck] capture_screenshot 失败: %s: %s", err_type, e)
        # playwright 浏览器二进制未安装时给出明确指引
        hint = ""
        if err_type in ("Error", "PlaywrightError") and "executable" in str(e).lower():
            hint = " (若提示浏览器未安装,请执行: playwright install chromium)"
        return {
            "ok": False,
            "imageBase64": None,
            "width": 0,
            "height": 0,
            "consoleErrors": [],
            "title": "",
            "finalUrl": url,
            "error": f"{err_type}: {str(e)[:240]}{hint}",
            "errorCode": "CAPTURE_FAILED",
        }


# ---------------------------------------------------------------------------
# 视觉自检报告(复用 services.vision_helper.analyze_image 的图片编码 + LLM 惯例)
# ---------------------------------------------------------------------------
async def _vision_analyze(image_source: str, prompt: str, **kw: Any) -> dict[str, Any]:
    """懒封装 vision_helper.analyze_image(延迟导入,避免 httpx 缺失时模块加载失败)。

    Returns:
        vision_helper.analyze_image 的结果 dict。
    """
    from ..services.vision_helper import analyze_image

    return await analyze_image(image_source, prompt, **kw)


def _build_vision_prompt(checks: list[str]) -> str:
    """构造视觉判断 prompt,要求模型返回可解析 JSON。"""
    lines = "\n".join(f"- {c}" for c in checks)
    return (
        "你是一个 UI 完成度自检器。请仔细阅读这张网页截图,逐项判断以下检查点是否成立。\n"
        "只依据截图可见内容判断,不要臆测。\n"
        "请严格只返回一个 JSON 对象(不要 markdown 代码块、不要多余文字),结构如下:\n"
        '{"checks":[{"check":"检查点原文","pass":true或false,"reason":"一句话理由"}]}\n'
        "检查点列表:\n"
        f"{lines}"
    )


def _extract_json(text: str) -> dict[str, Any] | None:
    """从 LLM 文本中容忍提取首个 JSON 对象。"""
    if not text:
        return None
    text = text.strip()
    # 去 markdown 代码块围栏
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            parsed = json.loads(text[start : end + 1])
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


async def selfcheck_report(url: str, checks: list[str]) -> dict[str, Any]:
    """截图 + 把 checks 交给 LLM 视觉判断,返回逐项 pass/fail + 理由。

    Args:
        url: 目标页面 URL(http/https)。
        checks: 检查点列表,如 ["提交按钮可见", "无白屏", "标题含『登录』"]。

    Returns:
        {
          ok: bool,                        # 截图是否成功
          url, title, finalUrl,
          consoleErrors: list[str],
          screenshot_length: int,          # base64 长度(ok=True)
          visionChecked: bool,             # 是否完成 LLM 视觉判断
          visionModel: str,                # 实际使用的视觉模型(若完成)
          checks: list[{check, pass, reason}],
          visionError?: str,               # LLM 失败时的原因
          note?: str,                      # 降级说明
          error?: str, errorCode?: str     # 截图失败
        }
    降级:截图成功但 LLM/视觉不可用 → 返回截图 + console 错误 + visionChecked=False,
    不抛异常。截图本身失败 → ok:False + checks=[]。
    """
    capture = await capture_screenshot(url)
    if not capture.get("ok"):
        return {
            "ok": False,
            "url": url,
            "title": capture.get("title", ""),
            "finalUrl": capture.get("finalUrl", url),
            "consoleErrors": capture.get("consoleErrors", []),
            "screenshot_length": 0,
            "visionChecked": False,
            "checks": [],
            "error": capture.get("error", "截图失败"),
            "errorCode": capture.get("errorCode", "CAPTURE_FAILED"),
        }

    image_base64 = capture.get("imageBase64") or ""
    data_uri = f"data:image/png;base64,{image_base64}"
    prompt = _build_vision_prompt(checks)

    base = {
        "ok": True,
        "url": url,
        "title": capture.get("title", ""),
        "finalUrl": capture.get("finalUrl", url),
        "consoleErrors": capture.get("consoleErrors", []),
        "screenshot_length": len(image_base64),
        "visionChecked": False,
        "checks": [],
    }

    try:
        # _vision_analyze 为 async 封装(内部走 llm_gateway,IO 等待不阻塞事件循环)
        vision = await asyncio.wait_for(
            _vision_analyze(data_uri, prompt, max_tokens=1200),
            timeout=CAPTURE_TIMEOUT_S,
        )
    except Exception as e:  # noqa: BLE001 - 视觉判断失败降级,不阻断
        logger.warning("[browser_selfcheck] vision_analyze 不可用,降级: %s", e)
        base["visionError"] = f"{type(e).__name__}: {str(e)[:200]}"
        base["note"] = "LLM 视觉判断不可用,已降级为仅返回截图与 console 错误"
        return base

    if not vision.get("ok"):
        base["visionError"] = vision.get("message") or vision.get("errorCode") or "LLM 返回错误"
        base["note"] = "LLM 视觉判断失败,已降级为仅返回截图与 console 错误"
        return base

    parsed = _extract_json(vision.get("analysis", ""))
    checks_out: list[dict[str, Any]] = []
    if parsed and isinstance(parsed.get("checks"), list):
        for item in parsed["checks"]:
            if not isinstance(item, dict):
                continue
            checks_out.append(
                {
                    "check": str(item.get("check", "")),
                    "pass": bool(item.get("pass", False)),
                    "reason": str(item.get("reason", "")),
                }
            )
        base["visionChecked"] = True
        base["visionModel"] = vision.get("model", "")
        base["checks"] = checks_out
        return base

    # LLM 返回了但内容不可解析 → 视为降级(visionChecked 仍为 False)
    base["visionError"] = "LLM 未返回可解析的 JSON"
    base["note"] = "视觉判断结果无法解析,已降级为仅返回截图与 console 错误"
    return base
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
