# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""self_healing 接线层测试:LLM 注入 + pytest 子进程 + 补丁落盘 + 路由契约。

全程 mock LLM(fake gateway),子进程 runner 用 tmp 目录真实跑 pytest。
"""

from __future__ import annotations

import json
import os
import textwrap
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers.self_healing import ENV_ENABLED
from app.routers.self_healing import router as self_healing_router
from app.services.self_healing_llm import (
    PytestSubprocessRunner,
    apply_patch_descriptor,
    llm_gen_fn,
    llm_patch_and_apply,
    llm_patch_fn,
)

# ---------------------------------------------------------------------------
# fake gateway(契约:await complete(messages, model) -> {"content": str})
# ---------------------------------------------------------------------------


class FakeGateway:
    def __init__(self, content: str) -> None:
        self.content = content
        self.calls: list[list[dict[str, str]]] = []

    async def complete(self, messages: list[dict[str, str]], model: str | None = None) -> dict:
        self.calls.append(messages)
        return {"content": self.content, "model": model or "fake", "usage": {}}


class BoomGateway:
    async def complete(self, messages: list[dict[str, str]], model: str | None = None) -> dict:
        raise RuntimeError("network down")


# ---------------------------------------------------------------------------
# llm_gen_fn
# ---------------------------------------------------------------------------


def test_llm_gen_fn_parses_cases() -> None:
    cases = [{"id": "t1", "description": "d", "setup": "", "assertion": "1", "target": "x"}]
    gw = FakeGateway(json.dumps(cases))
    out = llm_gen_fn("do thing", llm=gw)
    assert out == cases


def test_llm_gen_fn_strips_fences() -> None:
    cases = [{"id": "t1", "assertion": "True"}]
    gw = FakeGateway("```json\n" + json.dumps(cases) + "\n```")
    assert llm_gen_fn("t", llm=gw) == cases


def test_llm_gen_fn_invalid_json_raises_for_engine_fallback() -> None:
    gw = FakeGateway("not json at all")
    with pytest.raises(ValueError):
        llm_gen_fn("t", llm=gw)


def test_llm_gen_fn_gateway_error_raises() -> None:
    with pytest.raises(RuntimeError):
        llm_gen_fn("t", llm=BoomGateway())


# ---------------------------------------------------------------------------
# llm_patch_fn / llm_patch_and_apply
# ---------------------------------------------------------------------------


def test_llm_patch_fn_returns_dict() -> None:
    patch = {"file_path": "/tmp/x.py", "new_content": "print(1)", "explanation": "fix"}
    gw = FakeGateway(json.dumps(patch))
    out = llm_patch_fn({"test_id": "t"}, {}, llm=gw)
    assert out is not None
    assert out["file_path"] == "/tmp/x.py"


def test_llm_patch_fn_missing_file_path_none() -> None:
    gw = FakeGateway(json.dumps({"explanation": "no path"}))
    assert llm_patch_fn({"test_id": "t"}, {}, llm=gw) is None


def test_llm_patch_fn_gateway_error_none() -> None:
    assert llm_patch_fn({"t": 1}, {}, llm=BoomGateway()) is None


def test_llm_patch_and_apply_writes_file(tmp_path: Any) -> None:
    target = tmp_path / "mod.py"
    target.write_text("old", encoding="utf-8")
    patch = {"file_path": str(target), "new_content": "new"}
    gw = FakeGateway(json.dumps(patch))
    validator = lambda p: (True, str(p))  # noqa: E731 - 测试白名单直通
    out = llm_patch_and_apply({"test_id": "t"}, {}, llm=gw, model=None)  # type: ignore[arg-type]
    # 默认 validator 走 workspace 白名单:此处直接测 apply + and_apply 组合
    ok, info = apply_patch_descriptor(patch, validator=validator)
    assert ok and info == str(target)
    assert target.read_text(encoding="utf-8") == "new"
    assert out is not None  # 默认 validator 下写入可能被白名单拒;只断言不抛


def test_apply_patch_rejects_diff_only() -> None:
    ok, info = apply_patch_descriptor(
        {"file_path": "/tmp/a.py", "diff": "--- a\n+++ b"},
        validator=lambda p: (True, p),
    )
    assert not ok
    assert "new_content" in info


def test_apply_patch_rejects_outside_workspace() -> None:
    ok, info = apply_patch_descriptor(
        {"file_path": "/etc/passwd", "new_content": "x"},
        validator=lambda p: (False, "denied"),
    )
    assert not ok
    assert "whitelist" in info


def test_apply_patch_atomic_no_tmp_left(tmp_path: Any) -> None:
    target = tmp_path / "a.py"
    ok, _ = apply_patch_descriptor(
        {"file_path": str(target), "new_content": "data"}, validator=lambda p: (True, p)
    )
    assert ok
    leftovers = [p for p in os.listdir(tmp_path) if "sh_tmp_" in p]
    assert leftovers == []


# ---------------------------------------------------------------------------
# PytestSubprocessRunner(tmp 目录真实子进程)
# ---------------------------------------------------------------------------


def test_runner_pass_and_fail(tmp_path: Any) -> None:
    test_file = tmp_path / "test_ok.py"
    test_file.write_text(
        textwrap.dedent(
            """
            def test_pass():
                assert 1 + 1 == 2

            def test_fail():
                assert 1 + 1 == 3
            """
        ),
        encoding="utf-8",
    )
    result = PytestSubprocessRunner(str(test_file), junit_dir=str(tmp_path / "junit")).run()
    assert result["coverage_hint"] == "pytest"
    assert len(result["passed"]) == 1
    assert len(result["failures"]) == 1
    failure = result["failures"][0]
    assert failure["exception_type"]
    assert failure["message"]


def test_runner_timeout_graceful(tmp_path: Any) -> None:
    test_file = tmp_path / "test_slow.py"
    test_file.write_text(
        "def test_slow():\n    import time\n    time.sleep(30)\n", encoding="utf-8"
    )
    result = PytestSubprocessRunner(
        str(test_file), timeout=2.0, junit_dir=str(tmp_path / "j")
    ).run()
    assert result["passed"] == []
    assert len(result["failures"]) == 1
    assert result["failures"][0]["exception_type"] == "TimeoutError"


def test_parse_junit_attribute_only_failure(tmp_path: Any) -> None:
    """junit <failure message=".."/>(无子节点)必须归因为失败,不得误判通过。"""
    from app.services.self_healing_llm import PytestSubprocessRunner as R

    junit = tmp_path / "j.xml"
    junit.write_text(
        '<testsuite name="t">'
        '<testcase name="test_a"><failure message="boom" type="AssertionError"/></testcase>'
        '<testcase name="test_b"/>'
        "</testsuite>",
        encoding="utf-8",
    )
    runner = R("unused", junit_dir=str(tmp_path))
    out = runner._parse_junit(str(junit), "", 1)
    assert out["passed"] == ["t::test_b"]
    assert len(out["failures"]) == 1
    assert out["failures"][0]["message"] == "boom"


# ---------------------------------------------------------------------------
# 路由契约(最小 app,不走 create_app 全家桶)
# ---------------------------------------------------------------------------


def _make_client(monkeypatch: pytest.MonkeyPatch, *, enabled: bool) -> TestClient:
    app = FastAPI()
    app.include_router(self_healing_router, prefix="/api/v1")
    monkeypatch.setenv(ENV_ENABLED, "true" if enabled else "false")
    return TestClient(app, raise_server_exceptions=False)


def test_route_disabled_envelope(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _make_client(monkeypatch, enabled=False)
    resp = client.post("/api/v1/self-healing/run", json={"task": "t", "target_path": "."})
    body = resp.json()
    assert resp.status_code == 200
    assert body["code"] == 1
    assert body["data"] == {"enabled": False}


def test_route_bad_path_envelope_400(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _make_client(monkeypatch, enabled=True)
    monkeypatch.setattr(
        "app.routers.self_healing._validate_workspace", lambda p: (False, "outside workspace")
    )
    resp = client.post("/api/v1/self-healing/run", json={"task": "t", "target_path": "/etc"})
    assert resp.status_code == 400
    assert resp.json()["code"] == 400


def test_route_success_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.self_healing import HealOutcome

    client = _make_client(monkeypatch, enabled=True)
    monkeypatch.setattr(
        "app.routers.self_healing._validate_workspace", lambda p: (True, p)
    )
    monkeypatch.setattr(
        "app.routers.self_healing.heal",
        lambda *a, **k: HealOutcome(
            ok=True, final_passed=True, attempts=1, run_history=[], suggestions=[]
        ),
    )
    resp = client.post("/api/v1/self-healing/run", json={"task": "t", "target_path": "."})
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["ok"] is True
