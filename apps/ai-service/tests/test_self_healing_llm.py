# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""self_healing 接线层测试:LLM 注入 + pytest 子进程 + 补丁落盘 + 路由契约。

全程 mock LLM(fake gateway),子进程 runner 用 tmp 目录真实跑 pytest。
"""

from __future__ import annotations

import difflib
import json
import os
import sys
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
    read_failure_sources,
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


# ---------------------------------------------------------------------------
# 补丁 v2:unified diff 应用(merge3 三方合并,2026-09-12 立,fix-8)
# ---------------------------------------------------------------------------


def _udiff(old_text: str, new_text: str, path: str = "mod.py") -> str:
    """生成标准 unified diff(与 LLM patch_fn 产出的 diff 形态一致)。"""
    return "".join(
        difflib.unified_diff(
            old_text.splitlines(keepends=True),
            new_text.splitlines(keepends=True),
            fromfile=f"a/{path}",
            tofile=f"b/{path}",
        )
    )


def test_apply_patch_rejects_missing_content_and_diff() -> None:
    """既无 new_content 也无 diff → 明确拒绝(原 diff-only 拒绝语义的 v2 拆分)。"""
    ok, info = apply_patch_descriptor(
        {"file_path": "/tmp/a.py"}, validator=lambda p: (True, p)
    )
    assert not ok
    assert "new_content" in info


def test_apply_patch_diff_no_hunks(tmp_path: Any) -> None:
    """diff 只有文件头没有 hunk → 拒绝且不落盘。"""
    target = tmp_path / "mod.py"
    target.write_text("l1\n", encoding="utf-8")
    ok, info = apply_patch_descriptor(
        {"file_path": str(target), "diff": "--- a/mod.py\n+++ b/mod.py\n"},
        validator=lambda p: (True, p),
    )
    assert not ok
    assert "no hunks" in info
    assert target.read_text(encoding="utf-8") == "l1\n"


def test_apply_patch_diff_target_missing(tmp_path: Any) -> None:
    """diff 补丁的目标文件不存在 → 拒绝(diff 不能凭空建文件)。"""
    target = tmp_path / "nope.py"
    ok, info = apply_patch_descriptor(
        {"file_path": str(target), "diff": _udiff("l1\n", "l2\n")},
        validator=lambda p: (True, p),
    )
    assert not ok
    assert "does not exist" in info


def test_apply_patch_diff_clean_apply(tmp_path: Any) -> None:
    """磁盘未漂移:diff 干净应用,结果与 new_content 全量覆写一致。"""
    target = tmp_path / "mod.py"
    old_text, new_text = "l1\nl2\nl3\n", "l1\nL2\nl3\n"
    target.write_text(old_text, encoding="utf-8")
    ok, info = apply_patch_descriptor(
        {"file_path": str(target), "diff": _udiff(old_text, new_text)},
        validator=lambda p: (True, p),
    )
    assert ok, info
    assert target.read_text(encoding="utf-8") == new_text


def test_apply_patch_diff_drift_merged(tmp_path: Any) -> None:
    """磁盘侧漂移(区域内插入行):merge3 三方合并,LLM 变更与磁盘漂移都保留。"""
    base, patched = "a1\na2\na3\na4\n", "a1x\na2\na3\na4\n"
    drifted = "a1\na2\na3-inserted\na3\na4\nb-extra\n"
    target = tmp_path / "mod.py"
    target.write_text(drifted, encoding="utf-8")
    ok, info = apply_patch_descriptor(
        {"file_path": str(target), "diff": _udiff(base, patched)},
        validator=lambda p: (True, p),
    )
    assert ok, info
    result = target.read_text(encoding="utf-8")
    assert "a1x" in result  # diff 侧变更被应用
    assert "a3-inserted" in result  # 磁盘侧漂移被保留
    assert "b-extra" in result  # hunk 区域之外的磁盘内容原样保留


def test_apply_patch_diff_conflict_rejected(tmp_path: Any) -> None:
    """磁盘侧已改 diff 要改的同一行 → 双边修改冲突,整体失败且不半应用。"""
    base, patched = "l1\nl2\nl3\n", "l1\nL2\nl3\n"
    drifted = "l1\nY\nl3\n"
    target = tmp_path / "mod.py"
    target.write_text(drifted, encoding="utf-8")
    ok, info = apply_patch_descriptor(
        {"file_path": str(target), "diff": _udiff(base, patched)},
        validator=lambda p: (True, p),
    )
    assert not ok
    assert "conflict" in info.lower()
    assert target.read_text(encoding="utf-8") == drifted


def test_apply_patch_diff_merge3_missing(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """merge3 未安装(可选依赖)→ 优雅降级为失败原因,不抛错不落盘。"""
    target = tmp_path / "mod.py"
    old_text, new_text = "l1\nl2\nl3\n", "l1\nL2\nl3\n"
    target.write_text(old_text, encoding="utf-8")
    # sys.modules[name] = None 时 import 语句抛 ImportError(模拟包缺失)
    monkeypatch.setitem(sys.modules, "merge3", None)
    ok, info = apply_patch_descriptor(
        {"file_path": str(target), "diff": _udiff(old_text, new_text)},
        validator=lambda p: (True, p),
    )
    assert not ok
    assert "merge3" in info
    assert target.read_text(encoding="utf-8") == old_text


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


# ---------------------------------------------------------------------------
# read_failure_sources:失败测试真实源码收集(2026-09-12,补丁命中质量)
# ---------------------------------------------------------------------------


def test_read_failure_sources_dotted_module_resolves(tmp_path: Any) -> None:
    """pytest junit classname 是点分模块名(test_calc)-> 还原到 test_calc.py。"""
    src = "from calc import divide\n\n\ndef test_divide_by_zero():\n    assert divide(6, 0) == 0\n"
    (tmp_path / "test_calc.py").write_text(src, encoding="utf-8")
    out = read_failure_sources(
        {"test_id": "test_calc::test_divide_by_zero"},
        {"workspace_root": str(tmp_path)},
    )
    assert "assert divide(6, 0) == 0" in out


def test_read_failure_sources_relative_path_and_root(tmp_path: Any) -> None:
    """test_id 相对路径(tests/test_x.py::test_a)+ workspace_root 拼接。"""
    d = tmp_path / "tests"
    d.mkdir()
    (d / "test_x.py").write_text("def test_a():\n    assert 1\n", encoding="utf-8")
    out = read_failure_sources(
        {"test_id": "tests/test_x.py::test_a"}, {"workspace_root": str(tmp_path)}
    )
    assert "def test_a()" in out


def test_read_failure_sources_absolute_path(tmp_path: Any) -> None:
    """test_id 为绝对路径时直接读取(仍在 workspace_root 内)。"""
    f = tmp_path / "test_abs.py"
    f.write_text("def test_abs():\n    assert True\n", encoding="utf-8")
    out = read_failure_sources(
        {"test_id": f"{f}::test_abs"}, {"workspace_root": str(tmp_path)}
    )
    assert "test_abs" in out


def test_read_failure_sources_rejects_traversal(tmp_path: Any) -> None:
    """目录穿越(../ 逃出 workspace_root)-> 拒绝,返回空串。"""
    root = tmp_path / "ws"
    root.mkdir()
    (tmp_path / "outside.py").write_text("SECRET = 1\n", encoding="utf-8")
    out = read_failure_sources(
        {"test_id": "../outside.py::test_x"}, {"workspace_root": str(root)}
    )
    assert out == ""


def test_read_failure_sources_no_file_returns_empty(tmp_path: Any) -> None:
    """test_id 解析不出文件 -> 优雅返回空串(不抛错)。"""
    assert (
        read_failure_sources({"test_id": "test_a"}, {"workspace_root": str(tmp_path)})
        == ""
    )
    assert read_failure_sources({"test_id": "pytest::test_x"}, {"workspace_root": str(tmp_path)}) == ""


def test_read_failure_sources_no_root_or_bad_context() -> None:
    """缺 workspace_root / context 非 dict / failure 非 dict-str -> 空串。"""
    assert read_failure_sources({"test_id": "test_x"}, {}) == ""
    assert read_failure_sources({"test_id": "test_x"}, "nope") == ""
    assert read_failure_sources(123, {"workspace_root": "x"}) == ""
    assert read_failure_sources(None, {"workspace_root": "x"}) == ""


def test_read_failure_sources_truncates_long_file(tmp_path: Any) -> None:
    """超长文件按 200 行 / limit_chars 截断并注明截断。"""
    (tmp_path / "test_big.py").write_text(
        "\n".join(f"assert {i}" for i in range(500)), encoding="utf-8"
    )
    out = read_failure_sources(
        {"test_id": "test_big::test_x"}, {"workspace_root": str(tmp_path)}
    )
    assert "[truncated" in out
    assert out.count("\n") <= 201
    # 字符上限同样生效
    out2 = read_failure_sources(
        {"test_id": "test_big::test_x"},
        {"workspace_root": str(tmp_path)},
        limit_chars=50,
    )
    assert "[truncated" in out2
    assert len(out2) < 200


# ---------------------------------------------------------------------------
# llm_patch_fn:失败测试源码必须进 user prompt
# ---------------------------------------------------------------------------


def test_llm_patch_fn_prompt_includes_failing_test_source(tmp_path: Any) -> None:
    """context 只给 workspace_root -> llm_patch_fn 自行收集源码并写入 prompt。"""
    src = "def test_divide_by_zero():\n    assert divide(6, 0) == 0\n"
    (tmp_path / "test_calc.py").write_text(src, encoding="utf-8")
    gw = FakeGateway(json.dumps({"file_path": str(tmp_path / "calc.py"), "new_content": "x"}))
    failure = {"test_id": "test_calc::test_divide_by_zero", "message": "ZeroDivisionError"}
    out = llm_patch_fn(failure, {"workspace_root": str(tmp_path)}, llm=gw)
    assert out is not None
    user = gw.calls[0][1]["content"]
    assert "Failing test source (authoritative" in user
    assert "assert divide(6, 0) == 0" in user
    # 位置:源码段落紧跟在 "Failing test:" 之后
    assert user.index("Failing test:") < user.index("Failing test source (authoritative")


def test_llm_patch_fn_uses_injected_source(tmp_path: Any) -> None:
    """_patch_adapter 显式注入的 context["failing_test_source"] 被直接采用。"""
    gw = FakeGateway(json.dumps({"file_path": "x.py", "new_content": "y"}))
    ctx = {"workspace_root": str(tmp_path), "failing_test_source": "MARKER_ASSERT_SRC"}
    llm_patch_fn({"test_id": "t"}, ctx, llm=gw)
    assert "MARKER_ASSERT_SRC" in gw.calls[0][1]["content"]


def test_llm_patch_fn_no_source_still_works(tmp_path: Any) -> None:
    """无源码可注入时 prompt 不含段落,契约不变(仍返回补丁)。"""
    gw = FakeGateway(json.dumps({"file_path": "x.py", "new_content": "y"}))
    out = llm_patch_fn({"test_id": "t"}, {"workspace_root": str(tmp_path)}, llm=gw)
    assert out is not None
    assert "Failing test source (authoritative" not in gw.calls[0][1]["content"]
