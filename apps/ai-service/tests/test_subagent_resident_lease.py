# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""子代理常驻文件租约单测（2026-11-19，对照 deepseek-tui resident_file）。

钉住五组行为：
① 租约独占：同一文件第二个持有者被拒，且拒绝带 holder；
② 释放只认 owner，不认"谁先申请"；
③ 读取闸：超过上限 / 二进制 / 不存在各有独立错误码，不混成空文件；
④ 前缀：同一字节序、带定界、含原文；
⑤ 派发接线：单 agent 成功路径注入前缀并释放租约；失败路径也释放；并行/编排显式拒绝。
"""

from __future__ import annotations

import pytest

from app.services import mcp_server
from app.services.agent_orchestrator import AgentStepResult
from app.services.subagent_resident_lease import (
    ResidentLeaseRegistry,
    build_resident_prefix,
    normalize_path_key,
    read_resident_text,
    resident_lease_registry,
)


@pytest.fixture(autouse=True)
def _clean_registry():
    resident_lease_registry.reset()
    yield
    resident_lease_registry.reset()


class _FakeOrchestrator:
    def __init__(self, impl=None):
        self.calls: list[dict[str, object]] = []
        self._impl = impl

    async def invoke(self, agent_name, user_input, session_id=None, model_override=None):
        self.calls.append(
            {"agent_name": agent_name, "user_input": user_input, "session_id": session_id}
        )
        if self._impl is not None:
            return self._impl(agent_name, user_input, session_id)
        return AgentStepResult(
            agent_name=agent_name,
            input=user_input,
            output=f"ok-{agent_name}",
            status="completed",
            duration_ms=1.0,
        )


def _wire(monkeypatch, tmp_path, orchestrator=None):
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))
    orch = orchestrator or _FakeOrchestrator()
    monkeypatch.setattr(mcp_server, "_get_orchestrator", lambda: orch)
    return orch


class TestRegistry:
    def test_exclusive_lease(self):
        reg = ResidentLeaseRegistry()
        key = normalize_path_key("/work/x.md")
        assert reg.acquire(key, "a")["ok"] is True
        denied = reg.acquire(key, "b")
        assert denied["ok"] is False
        assert denied["errorCode"] == "RESIDENT_LEASE_HELD"
        assert denied["holder"] == "a"

    def test_release_only_by_owner(self):
        reg = ResidentLeaseRegistry()
        key = normalize_path_key("/work/x.md")
        reg.acquire(key, "a")
        assert reg.release(key, "b") is False
        assert reg.holder(key) == "a"
        assert reg.release(key, "a") is True
        assert reg.holder(key) is None

    def test_release_owner_clears_all(self):
        reg = ResidentLeaseRegistry()
        reg.acquire(normalize_path_key("/work/a.md"), "owner")
        reg.acquire(normalize_path_key("/work/b.md"), "owner")
        reg.acquire(normalize_path_key("/work/c.md"), "other")
        assert reg.release_owner("owner") == 2
        assert reg.holder(normalize_path_key("/work/c.md")) == "other"


class TestRead:
    def test_reads_utf8_text(self, tmp_path):
        f = tmp_path / "a.md"
        f.write_text("hello 常驻", encoding="utf-8")
        out = read_resident_text(str(f))
        assert out["ok"] is True
        assert out["text"] == "hello 常驻"
        assert out["bytes"] == len("hello 常驻".encode())

    def test_rejects_too_large(self, tmp_path):
        f = tmp_path / "big.md"
        f.write_text("x" * 100, encoding="utf-8")
        out = read_resident_text(str(f), max_bytes=10)
        assert out["ok"] is False
        assert out["errorCode"] == "RESIDENT_TOO_LARGE"
        assert out["bytes"] == 100
        assert out["limit"] == 10

    def test_rejects_binary(self, tmp_path):
        f = tmp_path / "bin.dat"
        f.write_bytes(b"\x00\x01\x02\xff")
        out = read_resident_text(str(f))
        assert out["ok"] is False
        assert out["errorCode"] == "RESIDENT_NOT_TEXT"

    def test_rejects_missing(self, tmp_path):
        out = read_resident_text(str(tmp_path / "nope.md"))
        assert out["ok"] is False
        assert out["errorCode"] == "RESIDENT_NOT_FOUND"


class TestPrefix:
    def test_frames_content_and_names_path(self):
        prefix = build_resident_prefix(display_path="docs/a.md", text="RESIDENT_BODY")
        assert "docs/a.md" in prefix
        assert "RESIDENT_BODY" in prefix
        assert "source=" in prefix  # 定界块来源属性
        assert prefix.endswith("\n\n")


class TestDispatchWiring:
    async def test_single_mode_prepends_and_releases(self, monkeypatch, tmp_path):
        f = tmp_path / "ctx.md"
        f.write_text("RESIDENT_BODY_ALPHA", encoding="utf-8")
        orch = _wire(monkeypatch, tmp_path)

        result = await mcp_server._tool_dispatch_subagent(
            {"name": "coder", "task": "改这个文件", "resident_file": str(f)}
        )

        assert result["ok"] is True
        sent = str(orch.calls[0]["user_input"])
        assert "RESIDENT_BODY_ALPHA" in sent
        assert sent.endswith("改这个文件")
        assert resident_lease_registry.holder(normalize_path_key(str(f))) is None

    async def test_second_lease_is_denied(self, monkeypatch, tmp_path):
        f = tmp_path / "ctx.md"
        f.write_text("BODY", encoding="utf-8")
        orch = _wire(monkeypatch, tmp_path)
        key = normalize_path_key(str(f))
        resident_lease_registry.acquire(key, "already-there")

        result = await mcp_server._tool_dispatch_subagent(
            {"name": "coder", "task": "t", "resident_file": str(f)}
        )

        assert result["ok"] is False
        assert result["errorCode"] == "RESIDENT_LEASE_HELD"
        assert result["holder"] == "already-there"
        assert orch.calls == []

    async def test_outside_workspace_rejected(self, monkeypatch, tmp_path):
        outside = tmp_path.parent / "outside-resident.md"
        outside.write_text("BODY", encoding="utf-8")
        orch = _wire(monkeypatch, tmp_path)

        result = await mcp_server._tool_dispatch_subagent(
            {"name": "coder", "task": "t", "resident_file": str(outside)}
        )

        assert result["ok"] is False
        assert result["errorCode"] == "RESIDENT_PATH_NOT_ALLOWED"
        assert orch.calls == []

    async def test_parallel_mode_rejected(self, monkeypatch, tmp_path):
        f = tmp_path / "ctx.md"
        f.write_text("BODY", encoding="utf-8")
        _wire(monkeypatch, tmp_path)

        result = await mcp_server._tool_dispatch_subagent(
            {
                "tasks": [{"name": "a", "task": "t1"}],
                "resident_file": str(f),
            }
        )

        assert result["ok"] is False
        assert result["errorCode"] == "RESIDENT_UNSUPPORTED_MODE"

    async def test_lease_released_on_failure(self, monkeypatch, tmp_path):
        f = tmp_path / "ctx.md"
        f.write_text("BODY", encoding="utf-8")

        def _boom(*_args, **_kwargs):
            raise RuntimeError("boom")

        _wire(monkeypatch, tmp_path, _FakeOrchestrator(impl=_boom))

        # 失败有两种收敛形态（向上抛 / 转成 SUBAGENT_FAILED 回包），
        # 这里只钉一件事：无论哪种，租约都必须释放。
        result = None
        try:
            result = await mcp_server._tool_dispatch_subagent(
                {"name": "coder", "task": "t", "resident_file": str(f)}
            )
        except RuntimeError:
            pass

        assert resident_lease_registry.holder(normalize_path_key(str(f))) is None
        if result is not None:
            assert result.get("ok") is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
