# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器自动化 Record & Replay(2-4,H9)单元测试:全离线,不启动真实浏览器。

覆盖:
- BrowserTraceStore:步骤归一化 / 持久化往返 / 列表删除 / 截图落盘 / 断言提取
- replay_trace:全成功 / 元素不存在差异 / 断言失败差异 / 失败中止与继续 /
  失败截图回调 / select_option 透传 / classify_error 分类
- bench 检查器与报告:evaluate_checks / _materialize_steps / _write_reports 汇总
- computer-use trace 端点:start/stop/list/detail/delete/replay + 自动记步
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Any

_PKG = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _PKG not in sys.path:
    sys.path.insert(0, _PKG)

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.jwt_auth import get_current_user_id  # noqa: E402
from app.routers import computer_use as cu  # noqa: E402
from app.services.browser_replay import (  # noqa: E402
    check_expectation,
    classify_error,
    replay_trace,
)
from app.services.browser_trace import (  # noqa: E402
    BrowserTraceStore,
    extract_assertions,
)
from bench.run_browser_bench import (  # noqa: E402
    _materialize_steps,
    _write_reports,
    evaluate_checks,
)

# =============================================================================
# Mock 驱动(实现 BrowserDriver 协议,离线替代真实 Playwright)
# =============================================================================


class MockDriver:
    """可脚本化失败的浏览器驱动替身:记录调用序列,按动作注入异常。"""

    def __init__(
        self,
        *,
        body: str = "",
        title: str = "",
        url: str = "http://mock.test/",
        fail_actions: dict[str, BaseException] | None = None,
        selector_texts: dict[str, str] | None = None,
        input_values: dict[str, str] | None = None,
        exists: set[str] | None = None,
    ) -> None:
        self.calls: list[tuple[Any, ...]] = []
        self._body = body
        self._title = title
        self._url = url
        self._fail_actions = fail_actions or {}
        self._selector_texts = selector_texts or {}
        self._input_values = input_values or {}
        self._exists = exists or set()

    def _maybe_fail(self, action: str) -> None:
        err = self._fail_actions.get(action)
        if err is not None:
            raise err

    async def navigate(self, url: str, timeout_ms: int) -> dict[str, Any]:
        self._maybe_fail("navigate")
        self.calls.append(("navigate", url))
        self._url = url
        return {"url": url, "title": self._title}

    async def click(self, target: dict[str, Any]) -> None:
        self._maybe_fail("click")
        self.calls.append(("click", dict(target)))

    async def type_text(self, target: dict[str, Any], text: str, clear: bool) -> None:
        self._maybe_fail("type")
        self.calls.append(("type", dict(target), text, clear))

    async def select_option(self, target: dict[str, Any], value: str) -> None:
        self._maybe_fail("select_option")
        self.calls.append(("select_option", dict(target), value))

    async def body_text(self) -> str:
        return self._body

    async def extract_text(self) -> str:
        return self._body

    async def page_title(self) -> str:
        return self._title

    async def current_url(self) -> str:
        return self._url

    async def selector_exists(self, selector: str) -> bool:
        return selector in self._exists

    async def selector_text(self, selector: str) -> str:
        return self._selector_texts.get(selector, "")

    async def input_value(self, selector: str) -> str:
        return self._input_values.get(selector, "")

    async def screenshot_bytes(self) -> bytes | None:
        return b"fake-png-bytes"


# =============================================================================
# BrowserTraceStore
# =============================================================================


def _new_store(tmp_path: Path) -> BrowserTraceStore:
    return BrowserTraceStore(
        file_path=tmp_path / "traces.json",
        screenshot_dir=tmp_path / "shots",
    )


def test_trace_store_normalizes_steps(tmp_path: Path):
    store = _new_store(tmp_path)
    step = store.append_step(
        "bt-t1",
        {
            "action": "click",
            "target": {"selector": "#btn"},
            "params": {"x": 1},
            "status": "ok",
            "result_summary": "clicked",
            "duration_ms": 12.34,
        },
    )
    assert step["step_index"] == 0
    assert step["action"] == "click"
    assert step["target"] == {"selector": "#btn"}
    assert step["expect"] is None
    assert step["error"] is None
    assert step["screenshot_ref"] is None
    assert step["duration_ms"] == 12.34
    assert step["at"].endswith("Z")

    # 非法 action / status / expect 类型归一化
    s2 = store.append_step(
        "bt-t1",
        {
            "action": "hack",
            "status": "weird",
            "expect": {"type": "unknown_type", "value": "x"},
            "error": {"kind": "timeout", "message": "boom"},
        },
    )
    assert s2["action"] == "navigate"
    assert s2["status"] == "ok"
    assert s2["expect"] is None
    assert s2["error"] == {"kind": "timeout", "message": "boom"}
    assert s2["step_index"] == 1


def test_trace_store_persistence_roundtrip(tmp_path: Path):
    store = _new_store(tmp_path)
    store.append_step("bt-p1", {"action": "navigate", "params": {"url": "http://x"}})
    store2 = BrowserTraceStore(
        file_path=tmp_path / "traces.json", screenshot_dir=tmp_path / "shots"
    )
    trace = store2.get_trace("bt-p1")
    assert trace is not None
    assert len(trace["steps"]) == 1
    assert trace["steps"][0]["action"] == "navigate"


def test_trace_store_list_delete_and_invalid_id(tmp_path: Path):
    store = _new_store(tmp_path)
    store.append_step("bt-a", {"action": "navigate"})
    store.append_step("bt-a", {"action": "click", "status": "error"})
    store.append_step("bt-b", {"action": "close"})

    items = store.list_traces()
    assert len(items) == 2
    by_id = {it["trace_id"]: it for it in items}
    assert by_id["bt-a"]["ok_count"] == 1
    assert by_id["bt-a"]["error_count"] == 1

    assert store.delete_trace("bt-a") is True
    assert store.delete_trace("bt-a") is False
    assert store.get_trace("bt-a") is None
    assert store.get_trace("bt-b") is not None

    # 非法 trace_id(空 / 路径穿越)直接拒绝
    for bad in ("", "../etc", "a b", "x" * 100):
        try:
            store.append_step(bad, {"action": "close"})
            raised = False
        except ValueError:
            raised = True
        assert raised, f"trace_id={bad!r} 应被拒绝"


def test_trace_store_attach_screenshot(tmp_path: Path):
    store = _new_store(tmp_path)
    store.append_step("bt-s", {"action": "screenshot"})
    ref = store.attach_screenshot("bt-s", 0, b"\x89PNG")
    assert ref == "browser_traces/bt-s/step_000.png"
    assert (tmp_path / "shots" / "bt-s" / "step_000.png").read_bytes() == b"\x89PNG"
    trace = store.get_trace("bt-s")
    assert trace is not None and trace["steps"][0]["screenshot_ref"] == ref
    # 越界 step_index / 不存在 trace → None
    assert store.attach_screenshot("bt-s", 9, b"x") is None
    assert store.attach_screenshot("bt-none", 0, b"x") is None


def test_extract_assertions():
    trace = {
        "steps": [
            {"step_index": 0, "action": "navigate", "expect": {"type": "url_contains", "value": "x"}},
            {"step_index": 1, "action": "click"},
            {"step_index": 2, "action": "type", "expect": {"type": "text_contains", "value": "y"}},
        ]
    }
    assertions = extract_assertions(trace)
    assert [a["step_index"] for a in assertions] == [0, 2]
    assert assertions[0]["expect"]["type"] == "url_contains"


# =============================================================================
# replay_trace(差异分类 / 中止策略 / 断言 / 截图回调)
# =============================================================================


def _simple_steps() -> list[dict[str, Any]]:
    return [
        {"step_index": 0, "action": "navigate", "params": {"url": "http://mock.test/", "timeout_ms": 1000}},
        {"step_index": 1, "action": "type", "target": {"selector": "#kw"}, "params": {"text": "hi", "clear": True}},
        {"step_index": 2, "action": "click", "target": {"selector": "#go"}},
    ]


def test_replay_all_ok():
    driver = MockDriver()
    report = asyncio.run(replay_trace(_simple_steps(), driver))
    assert report["status"] == "passed"
    assert report["ok"] == 3 and report["error"] == 0
    assert report["success_rate"] == 1.0
    assert report["executed"] == 3
    assert [c[0] for c in driver.calls] == ["navigate", "type", "click"]


def test_replay_element_not_found_diff_and_stop():
    driver = MockDriver(
        fail_actions={
            "click": TimeoutError(
                "Timeout 5000ms exceeded waiting for selector '#go'"
            )
        }
    )
    # stop_on_error 默认 False:失败后继续
    report = asyncio.run(replay_trace(_simple_steps(), driver))
    assert report["status"] == "failed"
    assert report["error"] == 1
    diff = report["steps"][2]["diff"]
    assert diff["kind"] == "element_not_found"
    assert "Timeout" in diff["message"]

    # stop_on_error=True:失败即停,后续步骤不再执行
    driver2 = MockDriver(fail_actions={"click": TimeoutError("waiting for selector")})
    report2 = asyncio.run(replay_trace(_simple_steps(), driver2, stop_on_error=True))
    assert report2["executed"] == 3  # 第 3 步本身已执行(失败)
    assert len(report2["steps"]) == 3
    assert report2["steps"][2]["status"] == "error"


def test_replay_assertion_failed_diff():
    steps = [
        {
            "step_index": 0,
            "action": "navigate",
            "params": {"url": "http://mock.test/"},
            "expect": {"type": "text_contains", "value": "登录成功"},
        }
    ]
    driver = MockDriver(body="登录失败")
    report = asyncio.run(replay_trace(steps, driver))
    assert report["status"] == "failed"
    diff = report["steps"][0]["diff"]
    assert diff["kind"] == "assertion_failed"
    assert diff["expected"] == {"type": "text_contains", "value": "登录成功"}
    assert diff["actual"] == "登录失败"


def test_replay_select_option_and_failure_screenshot_callback():
    steps = [
        {"step_index": 0, "action": "select_option", "target": {"selector": "#city"}, "params": {"value": "上海"}},
        {"step_index": 1, "action": "click", "target": {"selector": "#missing"}},
    ]
    driver = MockDriver(fail_actions={"click": TimeoutError("waiting for selector '#missing'")})

    async def _shot(idx: int) -> str | None:
        return f"shots/fail_{idx}.png"

    report = asyncio.run(replay_trace(steps, driver, on_step_failure=_shot))
    assert driver.calls[0] == ("select_option", {"selector": "#city"}, "上海")
    failed = report["steps"][1]
    assert failed["status"] == "error"
    assert failed["screenshot_ref"] == "shots/fail_1.png"
    # 成功步骤不触发截图回调
    assert "screenshot_ref" not in report["steps"][0] or report["steps"][0].get("screenshot_ref") is None


def test_replay_empty_steps():
    report = asyncio.run(replay_trace([], MockDriver()))
    assert report["status"] == "passed"
    assert report["success_rate"] == 1.0 and report["total"] == 0


def test_classify_error_kinds():
    e1 = TimeoutError("Timeout 3000ms exceeded waiting for selector '#a'")
    assert classify_error(e1, "click")["kind"] == "element_not_found"
    e2 = TimeoutError("Timeout 30000ms exceeded")
    assert classify_error(e2, "navigate")["kind"] == "timeout"
    e3 = ValueError("bad target")
    assert classify_error(e3, "click")["kind"] == "exception"


def test_check_expectation_types():
    driver = MockDriver(body="hello world", title="T", url="http://u/")
    ok, _ = asyncio.run(check_expectation({"type": "text_contains", "value": "hello"}, driver))
    assert ok
    ok, _ = asyncio.run(check_expectation({"type": "title_contains", "value": "T"}, driver))
    assert ok
    ok, _ = asyncio.run(check_expectation({"type": "url_contains", "value": "u"}, driver))
    assert ok
    ok, _ = asyncio.run(check_expectation({"type": "selector_exists", "value": "#x"}, driver))
    assert not ok
    ok, actual = asyncio.run(check_expectation({"type": "bogus", "value": "x"}, driver))
    assert not ok and "未知断言类型" in actual


# =============================================================================
# bench:检查器 / 步骤物化 / 报告汇总
# =============================================================================


def test_bench_evaluate_checks():
    driver = MockDriver(
        selector_texts={"#status": "登录成功,欢迎 admin"},
        input_values={"#kw": "浏览器"},
        exists={"#go"},
    )
    checks = [
        {"type": "selector_text_contains", "params": {"selector": "#status", "text": "登录成功"}},
        {"type": "selector_text_contains", "params": {"selector": "#status", "text": "不存在字样"}},
        {"type": "input_value", "params": {"selector": "#kw", "value": "浏览器"}},
        {"type": "input_value", "params": {"selector": "#kw", "value": "错误值"}},
        {"type": "selector_exists", "params": {"selector": "#go"}},
        {"type": "url_contains", "params": {"text": "mock.test"}},
        {"type": "unknown_check", "params": {}},
    ]
    results = asyncio.run(evaluate_checks(checks, driver))
    assert [r["pass"] for r in results] == [True, False, True, False, True, True, False]
    assert "未知检查类型" in results[-1]["detail"]


def test_bench_materialize_steps_no_mutation():
    steps = [{"action": "navigate", "params": {"url": "{fixture_url}"}}]
    out = _materialize_steps(steps, "file:///f/login.html")  # type: ignore[arg-type]
    assert out[0]["params"]["url"] == "file:///f/login.html"
    assert steps[0]["params"]["url"] == "{fixture_url}"  # 原定义未被污染


def test_bench_write_reports_summary(tmp_path: Path):
    results = [
        {
            "id": "t1", "title": "任务1", "category": "form", "fixture": "login.html",
            "steps_ok": 4, "steps_total": 4, "replay_status": "passed",
            "checks_passed": 2, "checks_total": 2, "pass": True, "duration_ms": 100.0,
            "replay": {"steps": []}, "checks": [],
        },
        {
            "id": "t2", "title": "任务2", "category": "search", "fixture": "search.html",
            "steps_ok": 2, "steps_total": 3, "replay_status": "failed",
            "checks_passed": 1, "checks_total": 2, "pass": False, "duration_ms": 200.0,
            "replay": {
                "steps": [
                    {"step_index": 2, "action": "click", "status": "error",
                     "diff": {"kind": "element_not_found", "message": "Timeout ..."}}
                ]
            },
            "checks": [{"type": "input_value", "pass": False, "detail": "值不等"}],
        },
    ]
    report_path = tmp_path / "report.md"
    summary = _write_reports(results, report_path)  # type: ignore[arg-type]
    assert summary["total"] == 2 and summary["passed"] == 1
    assert summary["success_rate"] == 0.5
    assert report_path.exists()
    assert report_path.with_suffix(".json").exists()
    md = report_path.read_text(encoding="utf-8")
    assert "成功率: 50.0%" in md
    assert "element_not_found" in md  # 失败差异写入报告


# =============================================================================
# computer-use trace 端点(TestClient,隔离 store 与浏览器)
# =============================================================================


class FakePage:
    """open/click 端点自动记步测试用的假 Page。"""

    def __init__(self) -> None:
        self.url = "http://mock.test/"
        self.clicked: list[str] = []

    def is_closed(self) -> bool:
        return False

    async def goto(self, url: str, timeout: int = 0, wait_until: str = "") -> None:
        self.url = url

    async def title(self) -> str:
        return "Mock Page"

    async def click(self, selector: str) -> None:
        if selector == "#missing":
            raise TimeoutError(f"Timeout 5000ms exceeded waiting for selector '{selector}'")
        self.clicked.append(selector)


def _client(monkeypatch, tmp_path: Path) -> tuple[TestClient, BrowserTraceStore]:
    """构建隔离的 computer-use 路由客户端 + 独立 trace store。"""
    store = BrowserTraceStore(
        file_path=tmp_path / "traces.json", screenshot_dir=tmp_path / "shots"
    )
    monkeypatch.setattr(cu, "browser_trace_store", store)
    monkeypatch.setattr(cu, "_recording_trace_id", None)
    app = FastAPI()
    app.include_router(cu.router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: "test-user"
    return TestClient(app), store


def test_trace_start_stop_and_lifecycle(monkeypatch, tmp_path: Path):
    client, store = _client(monkeypatch, tmp_path)
    with client:
        r = client.post("/api/computer-use/trace/start", json={})
        assert r.status_code == 200
        assert r.json()["trace_id"]
        assert r.json()["status"] == "recording" and r.json()["resumed"] is False

        # 指定 trace_id 续录
        r = client.post("/api/computer-use/trace/start", json={"trace_id": "bt-ep1"})
        assert r.json()["trace_id"] == "bt-ep1" and r.json()["resumed"] is False

        # 空转 stop → idle
        client.post("/api/computer-use/trace/stop")
        r = client.post("/api/computer-use/trace/stop")
        assert r.json()["status"] == "idle"

        store.append_step("bt-ep2", {"action": "navigate", "status": "ok"})
        store.append_step("bt-ep2", {"action": "click", "status": "error"})
        items = client.get("/api/computer-use/trace").json()["traces"]
        assert any(it["trace_id"] == "bt-ep2" and it["error_count"] == 1 for it in items)

        detail = client.get("/api/computer-use/trace/bt-ep2").json()
        assert len(detail["steps"]) == 2

        assert client.get("/api/computer-use/trace/bt-none").status_code == 404
        assert client.delete("/api/computer-use/trace/bt-ep2").json()["ok"] is True
        assert client.get("/api/computer-use/trace/bt-ep2").status_code == 404


def test_auto_record_on_open_and_click(monkeypatch, tmp_path: Path):
    client, store = _client(monkeypatch, tmp_path)
    fake_page = FakePage()

    async def fake_ensure_page() -> Any:
        return fake_page

    monkeypatch.setattr(cu, "_ensure_page", fake_ensure_page)
    monkeypatch.setattr(cu, "_page", fake_page)

    with client:
        client.post("/api/computer-use/trace/start", json={"trace_id": "bt-auto"})
        r = client.post("/api/computer-use/open", json={"url": "http://mock.test/a"})
        assert r.status_code == 200
        r = client.post("/api/computer-use/click", json={"selector": "#btn"})
        assert r.status_code == 200
        # 点击失败也记 error 步骤
        r = client.post("/api/computer-use/click", json={"selector": "#missing"})
        assert r.status_code == 500

        r = client.post("/api/computer-use/trace/stop")
        assert r.json()["step_count"] == 3
        assert r.json()["ok_count"] == 2 and r.json()["error_count"] == 1

    trace = store.get_trace("bt-auto")
    assert trace is not None
    actions = [s["action"] for s in trace["steps"]]
    assert actions == ["navigate", "click", "click"]
    assert trace["steps"][2]["error"]["kind"] == "element_not_found"


def test_replay_endpoint_with_mock_driver(monkeypatch, tmp_path: Path):
    client, store = _client(monkeypatch, tmp_path)
    store.append_step(
        "bt-rp",
        {"action": "navigate", "params": {"url": "http://mock.test/"}},
    )
    store.append_step(
        "bt-rp",
        {"action": "click", "target": {"selector": "#go"}, "status": "ok"},
    )

    async def fake_ensure_page() -> Any:
        return FakePage()

    monkeypatch.setattr(cu, "_ensure_page", fake_ensure_page)
    driver = MockDriver()
    monkeypatch.setattr(cu, "PageDriver", lambda page: driver)

    with client:
        r = client.post(
            "/api/computer-use/replay",
            json={"trace_id": "bt-rp", "save_failure_screenshot": False},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["trace_id"] == "bt-rp"
        assert body["status"] == "passed" and body["ok"] == 2

        # 不存在的 trace → 404
        assert client.post("/api/computer-use/replay", json={"trace_id": "nope"}).status_code == 404

        # 失败步骤差异 + 截图回调(通过 on_step_failure 落盘引用)
        store.append_step(
            "bt-rp-fail",
            {"action": "click", "target": {"selector": "#gone"}, "status": "ok"},
        )
        fail_driver = MockDriver(
            fail_actions={"click": TimeoutError("waiting for selector '#gone'")}
        )
        monkeypatch.setattr(cu, "PageDriver", lambda page: fail_driver)
        r = client.post("/api/computer-use/replay", json={"trace_id": "bt-rp-fail"})
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "failed"
        assert body["steps"][0]["diff"]["kind"] == "element_not_found"
        assert body["steps"][0]["screenshot_ref"].startswith("browser_traces/bt-rp-fail/")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
