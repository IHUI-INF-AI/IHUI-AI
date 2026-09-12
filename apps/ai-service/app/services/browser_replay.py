# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器自动化 trace 回放执行器(Replay)与断言检查(H9 失败可回放)。

按 trace 步骤顺序重放(navigate/click/type/extract_text/...),失败步骤记录
差异类型(元素不存在 / 超时 / 断言不符 / 异常);带 expect 的步骤回放后逐条
比对断言。执行层通过 BrowserDriver 协议解耦:

- ``PageDriver``:包装 playwright Page 的真驱动(computer-use 单例页 /
  bench 自建页共用,不依赖 computer_use 模块,避免循环导入);
- 测试/bench 单测注入 mock 驱动即可离线验证回放逻辑。

回放报告结构:
    total / ok / success_rate / status(passed|failed) /
    steps[{step_index, action, status, result_summary, diff, screenshot_ref}]
diff(失败步骤的差异记录):
    kind(element_not_found|timeout|assertion_failed|exception) /
    message / expected / actual
"""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from typing import Any, Protocol, runtime_checkable

# 检查器/断言比对所用页面文本截断长度(防 diff 记录超长)
_ACTUAL_LIMIT = 300
# 回放单步默认超时 ms
_STEP_TIMEOUT_MS = 5000


# ---------------------------------------------------------------------------
# 驱动协议(执行层解耦,真实实现见 PageDriver,测试注入 mock)
# ---------------------------------------------------------------------------


@runtime_checkable
class BrowserDriver(Protocol):
    """回放执行器所需的浏览器驱动最小接口。"""

    async def navigate(self, url: str, timeout_ms: int) -> dict[str, Any]:
        """打开 URL,返回 {"url":..., "title":...}。"""
        ...

    async def click(self, target: dict[str, Any]) -> None:
        """点击目标(selector 或 x,y)。"""
        ...

    async def type_text(self, target: dict[str, Any], text: str, clear: bool) -> None:
        """向目标输入文本。"""
        ...

    async def select_option(self, target: dict[str, Any], value: str) -> None:
        """为 select 控件选择选项。"""
        ...

    async def body_text(self) -> str:
        """当前页可见文本。"""
        ...

    async def extract_text(self) -> str:
        """当前页可见文本(与 body_text 同源,语义上供 extract_text 步骤)。"""
        ...

    async def page_title(self) -> str:
        """当前页标题。"""
        ...

    async def current_url(self) -> str:
        """当前页 URL。"""
        ...

    async def selector_exists(self, selector: str) -> bool:
        """选择器是否命中至少一个元素。"""
        ...

    async def selector_text(self, selector: str) -> str:
        """选择器命中元素的可见文本。"""
        ...

    async def input_value(self, selector: str) -> str:
        """表单控件当前值。"""
        ...

    async def screenshot_bytes(self) -> bytes | None:
        """当前页截图 PNG 字节(尽力,失败返回 None)。"""
        ...


class PageDriver:
    """基于 playwright Page 的 BrowserDriver 真实现。

    不 import computer_use(避免循环依赖),直接驱动传入的 Page 对象,
    click/type 同时支持 selector 与 x,y 坐标两种目标(与 computer-use 路由一致)。
    """

    def __init__(self, page: Any) -> None:
        self._page = page

    async def navigate(self, url: str, timeout_ms: int) -> dict[str, Any]:
        page = self._page
        await page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")
        return {"url": page.url, "title": (await page.title()) or ""}

    async def click(self, target: dict[str, Any]) -> None:
        page = self._page
        selector = target.get("selector")
        if selector:
            await page.click(selector, timeout=_STEP_TIMEOUT_MS)
            return
        x, y = target.get("x"), target.get("y")
        if x is None or y is None:
            raise ValueError("click 目标缺少 selector 或 x,y")
        await page.mouse.click(int(x), int(y))

    async def type_text(self, target: dict[str, Any], text: str, clear: bool) -> None:
        page = self._page
        selector = target.get("selector")
        if selector:
            loc = page.locator(selector).first
            await loc.click(timeout=_STEP_TIMEOUT_MS)
            if clear:
                await loc.fill("")
            await loc.type(text, delay=10)
            return
        x, y = target.get("x"), target.get("y")
        if x is None or y is None:
            raise ValueError("type 目标缺少 selector 或 x,y")
        await page.mouse.click(int(x), int(y))
        if clear:
            await page.keyboard.press("Control+A")
        await page.keyboard.type(text, delay=10)

    async def select_option(self, target: dict[str, Any], value: str) -> None:
        selector = target.get("selector")
        if not selector:
            raise ValueError("select_option 目标缺少 selector")
        await self._page.select_option(selector, value, timeout=_STEP_TIMEOUT_MS)

    async def body_text(self) -> str:
        text = await self._page.evaluate("() => document.body ? document.body.innerText : ''")
        return "\n".join(
            line.strip() for line in (text or "").splitlines() if line.strip()
        )

    async def extract_text(self) -> str:
        return await self.body_text()

    async def page_title(self) -> str:
        return (await self._page.title()) or ""

    async def current_url(self) -> str:
        return str(self._page.url)

    async def selector_exists(self, selector: str) -> bool:
        return int(await self._page.locator(selector).count()) > 0

    async def selector_text(self, selector: str) -> str:
        loc = self._page.locator(selector).first
        return (await loc.inner_text(timeout=_STEP_TIMEOUT_MS)) or ""

    async def input_value(self, selector: str) -> str:
        loc = self._page.locator(selector).first
        return (await loc.input_value(timeout=_STEP_TIMEOUT_MS)) or ""

    async def screenshot_bytes(self) -> bytes | None:
        try:
            data = await self._page.screenshot(type="png")
        except Exception:
            return None
        return bytes(data) if data else None


# ---------------------------------------------------------------------------
# 错误分类与断言
# ---------------------------------------------------------------------------


def classify_error(exc: BaseException, action: str) -> dict[str, str]:
    """把回放异常归类为差异类型(供报告统计与失败分析)。

    - playwright TimeoutError + 等待选择器语义 → element_not_found
    - 其他 TimeoutError → timeout
    - 其余 → exception
    """
    name = type(exc).__name__
    message = f"{name}: {str(exc)[:300]}"
    if name == "TimeoutError" or "Timeout" in name:
        if action in ("click", "type", "wait_for") or "selector" in str(exc) or "locator" in str(exc):
            return {"kind": "element_not_found", "message": message}
        return {"kind": "timeout", "message": message}
    return {"kind": "exception", "message": message}


async def check_expectation(expect: dict[str, Any], driver: BrowserDriver) -> tuple[bool, str]:
    """执行单条断言,返回 (通过与否, 实际值摘要)。断言类型非法按失败处理。"""
    etype = expect.get("type")
    value = str(expect.get("value", ""))
    if etype == "text_contains":
        actual = await driver.body_text()
        return (value in actual, actual[:_ACTUAL_LIMIT])
    if etype == "title_contains":
        actual = await driver.page_title()
        return (value in actual, actual[:_ACTUAL_LIMIT])
    if etype == "url_contains":
        actual = await driver.current_url()
        return (value in actual, actual[:_ACTUAL_LIMIT])
    if etype == "selector_exists":
        exists = await driver.selector_exists(value)
        return (exists, "存在" if exists else "不存在")
    return (False, f"未知断言类型: {etype}")


# ---------------------------------------------------------------------------
# 回放执行
# ---------------------------------------------------------------------------


def _clip(text: str, limit: int = _ACTUAL_LIMIT) -> str:
    return text[:limit] + "…" if len(text) > limit else text


async def replay_step(
    step: dict[str, Any],
    driver: BrowserDriver,
) -> dict[str, Any]:
    """重放单步:执行动作 → 断言比对 → 失败分类。返回该步回放结果。"""
    action = str(step.get("action") or "")
    target = step.get("target") or {}
    params = step.get("params") or {}
    started = time.monotonic()
    result: dict[str, Any] = {
        "step_index": int(step.get("step_index") or 0),
        "action": action,
        "status": "ok",
        "result_summary": "",
        "diff": None,
        "duration_ms": 0.0,
    }
    try:
        if action == "navigate":
            url = str(params.get("url") or "")
            if not url:
                raise ValueError("navigate 步骤缺少 params.url")
            nav = await driver.navigate(url, int(params.get("timeout_ms") or 15000))
            result["result_summary"] = f"url={nav.get('url', '')} title={nav.get('title', '')}"
        elif action == "click":
            await driver.click(target)
            result["result_summary"] = f"clicked {_clip(str(target), 120)}"
        elif action == "type":
            text = str(params.get("text") or "")
            await driver.type_text(target, text, bool(params.get("clear")))
            result["result_summary"] = f"typed {len(text)} chars into {_clip(str(target), 120)}"
        elif action == "select_option":
            value = str(params.get("value") or "")
            await driver.select_option(target, value)
            result["result_summary"] = f"selected {value!r} in {_clip(str(target), 120)}"
        elif action == "extract_text":
            text = await driver.extract_text()
            result["result_summary"] = _clip(text, 200)
        elif action == "snapshot":
            result["result_summary"] = "snapshot(no-op in replay)"
        elif action == "screenshot":
            result["result_summary"] = "screenshot(no-op in replay)"
        elif action == "close":
            result["result_summary"] = "close(no-op in replay)"
        else:
            # scroll/wait_for 等暂不驱动真实动作,按原样跳过
            result["result_summary"] = f"{action} skipped in replay"
    except Exception as e:
        result["status"] = "error"
        result["diff"] = classify_error(e, action)
        result["duration_ms"] = round((time.monotonic() - started) * 1000, 2)
        return result

    # 动作成功后比对断言(若该步带 expect)
    expect = step.get("expect")
    if expect:
        ok, actual = await check_expectation(expect, driver)
        if not ok:
            result["status"] = "error"
            result["diff"] = {
                "kind": "assertion_failed",
                "message": f"断言不符: {expect.get('type')}={expect.get('value')!r}",
                "expected": dict(expect),
                "actual": actual,
            }
    result["duration_ms"] = round((time.monotonic() - started) * 1000, 2)
    return result


async def replay_trace(
    steps: list[dict[str, Any]],
    driver: BrowserDriver,
    *,
    stop_on_error: bool = False,
    on_step_failure: Callable[[int], Awaitable[str | None]] | None = None,
) -> dict[str, Any]:
    """按序重放整个 trace,返回回放报告。

    on_step_failure: 可选异步回调 (step_index) -> screenshot_ref 字符串或 None,
    失败步骤调用并把返回的截图引用写入报告(供失败可回放取证)。
    """
    results: list[dict[str, Any]] = []
    for step in steps:
        r = await replay_step(step, driver)
        if r["status"] == "error" and on_step_failure is not None:
            try:
                ref = await on_step_failure(r["step_index"])
                r["screenshot_ref"] = ref
            except Exception:
                r["screenshot_ref"] = None
        results.append(r)
        if r["status"] == "error" and stop_on_error:
            break
    total_executed = len(results)
    ok = sum(1 for r in results if r["status"] == "ok")
    failed = [r for r in results if r["status"] == "error"]
    return {
        "total": len(steps),
        "executed": total_executed,
        "ok": ok,
        "error": len(failed),
        "success_rate": round(ok / len(steps), 4) if steps else 1.0,
        "status": "passed" if (not failed and total_executed == len(steps)) else "failed",
        "steps": results,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
