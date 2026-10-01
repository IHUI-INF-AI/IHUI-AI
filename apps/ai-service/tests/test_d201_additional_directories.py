# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D201 多根工作区:会话级附加目录(2026-10-02,自包含)。

钉住四件事:
① 准入校验(相对/不存在/非目录拒;resolve 归一去重;空表 = 清空);
② 校验覆盖层(附加集内放行、清空即失效、无集时行为与 D201 之前一致、写侧敏感
   黑名单在附加目录内照常生效 —— "权限面按新目录生效");
③ call_tool 按 session_id 注入(本会话可读附加目录内文件,他会话不可,移除即失效);
④ engine thread.settings 的 additionalDirectories 整表替换 + 快照回读 + 整表拒绝;
⑤ 工具执行器闭包把 session_key 透传给 call_tool(engine 链会话过桥)。
"""
from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from app.routers.agents import _build_loop_v2_tools
from app.services import mcp_server as mcp_server_module
from app.services.agent_engine import INVALID_PARAMS, THREAD_BUSY, AgentEngine
from app.services.mcp_server import (
    _validate_extra_directory,
    _validate_path_in_workspace,
    _validate_write_path_in_workspace,
    clear_session_extra_roots,
    get_session_extra_roots,
    set_session_extra_roots,
)
from app.services.session_store import SessionStore

# ---------------------------------------------------------------------------
# ① 准入校验
# ---------------------------------------------------------------------------


def test_admission_rejects_relative_path(tmp_path):
    ok, err = _validate_extra_directory("relative/dir")
    assert not ok and "绝对路径" in err


def test_admission_rejects_missing_and_file(tmp_path):
    ok, err = _validate_extra_directory(str(tmp_path / "nope"))
    assert not ok and "不存在" in err
    f = tmp_path / "a.txt"
    f.write_text("x", encoding="utf-8")
    ok, err = _validate_extra_directory(str(f))
    assert not ok and "不是目录" in err


def test_admission_resolves_and_dedups(tmp_path):
    d = tmp_path / "docs"
    d.mkdir()
    resolved = set_session_extra_roots("sess-adm", [str(d), str(d) + os.sep, str(d)])
    assert resolved == (str(d.resolve()),)
    # 空表 = 清空
    cleared = set_session_extra_roots("sess-adm", [])
    assert cleared == () and get_session_extra_roots("sess-adm") == ()
    clear_session_extra_roots("sess-adm")


def test_admission_rejects_empty_session_id(tmp_path):
    d = tmp_path / "docs"
    d.mkdir()
    try:
        set_session_extra_roots("  ", [str(d)])
        raise AssertionError("应当拒绝空 session_id")
    except ValueError as e:
        assert "session_id" in str(e)


# ---------------------------------------------------------------------------
# ② 校验覆盖层
# ---------------------------------------------------------------------------


def test_read_overlay_allows_and_expires(tmp_path):
    d = tmp_path / "extra-root"
    d.mkdir()
    f = d / "data.txt"
    f.write_text("hello", encoding="utf-8")

    # 无附加集:tmp_path 不在进程白名单内 → 拒(D201 之前行为)
    ok, _ = _validate_path_in_workspace(str(f), extra_roots=())
    assert not ok

    set_session_extra_roots("sess-read", [str(d)])
    roots = get_session_extra_roots("sess-read")
    ok, info = _validate_path_in_workspace(str(f), extra_roots=roots)
    assert ok and str(f.resolve()) == info

    # 移除即失效
    clear_session_extra_roots("sess-read")
    ok, _ = _validate_path_in_workspace(str(f), extra_roots=get_session_extra_roots("sess-read"))
    assert not ok


def test_write_overlay_enforces_sensitive_blacklist(tmp_path):
    d = tmp_path / "wroot"
    (d / "normal").mkdir(parents=True)
    (d / ".git").mkdir()
    set_session_extra_roots("sess-write", [str(d)])
    roots = get_session_extra_roots("sess-write")

    ok, _ = _validate_write_path_in_workspace(str(d / "normal" / "a.txt"), extra_roots=roots)
    assert ok
    # 附加目录内的 .git 照样被写侧黑名单拦(权限面按新目录生效,不是无条件放行)
    ok, err = _validate_write_path_in_workspace(str(d / ".git" / "hooks" / "pre-commit"), extra_roots=roots)
    assert not ok and err
    clear_session_extra_roots("sess-write")


# ---------------------------------------------------------------------------
# ③ call_tool 按 session_id 注入
# ---------------------------------------------------------------------------


async def test_call_tool_session_scoped_read(tmp_path):
    d = tmp_path / "scoped"
    d.mkdir()
    f = d / "note.txt"
    f.write_text("payload", encoding="utf-8")
    set_session_extra_roots("conv-A", [str(d)])

    r_a = await mcp_server_module.mcp_server.call_tool(
        "read_file", {"path": str(f)}, session_id="conv-A"
    )
    assert r_a.get("ok") is True and r_a.get("content") == "payload"

    # 他会话不可见(无该会话的附加集 → 白名单外照旧拒绝)
    r_b = await mcp_server_module.mcp_server.call_tool(
        "read_file", {"path": str(f)}, session_id="conv-B"
    )
    assert r_b.get("ok") is False and "白名单" in str(r_b.get("error", ""))

    # 不带 session_id(历史调用形态)同样不可见 —— 覆盖层是按会话的加号,不是全局放行
    r_none = await mcp_server_module.mcp_server.call_tool("read_file", {"path": str(f)})
    assert r_none.get("ok") is False

    # 移除即失效
    clear_session_extra_roots("conv-A")
    r_c = await mcp_server_module.mcp_server.call_tool(
        "read_file", {"path": str(f)}, session_id="conv-A"
    )
    assert r_c.get("ok") is False


# ---------------------------------------------------------------------------
# ④ engine thread.settings.additionalDirectories
# ---------------------------------------------------------------------------


class _FakeResult:
    success = True
    final_response = "ok"
    iterations: list = []
    compaction_events: list = []
    stop_reason = "stop"
    total_duration_ms = 1.0
    total_tokens_used = 0
    checkpoint_id = None
    error = None
    budget = None


class _FakeLoop:
    async def run(self, messages):
        return _FakeResult()

    async def resume_from_checkpoint(self, checkpoint_id):  # pragma: no cover
        return _FakeResult()

    async def interrupt(self, mode="cancel"):  # pragma: no cover
        return None


async def _rpc(engine, method, params, req_id=1, emit=None):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params},
        emit=emit,
    )
    assert response is not None and "error" not in response, response
    return response["result"]


async def _rpc_error(engine, method, params, req_id=1):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" in response, response
    return response["error"]


def _engine_with_store(tmp_path):
    async def factory(spec, host_tools):
        return _FakeLoop()

    store = SessionStore(str(tmp_path / "d201.db"))
    return AgentEngine(loop_factory=factory, store=store), store


async def test_engine_settings_additional_directories(tmp_path):
    engine, _store = _engine_with_store(tmp_path)
    d1 = tmp_path / "root-1"
    d1.mkdir()
    d2 = tmp_path / "root-2"
    d2.mkdir()

    tid = (await _rpc(engine, "thread.start", {"model": "base"}))["threadId"]
    th = engine._threads[tid]

    # 追加
    r = await _rpc(
        engine,
        "thread.settings",
        {"threadId": tid, "settings": {"additionalDirectories": [str(d1)]}},
    )
    assert "additionalDirectories" in r["applied"]
    assert th.additional_directories == (str(d1.resolve()),)
    assert get_session_extra_roots(th.session_id) == (str(d1.resolve()),)
    assert r["settings"]["additionalDirectories"] == [str(d1.resolve())]

    # 整表替换(d2 换下 d1,不是累加)
    await _rpc(
        engine,
        "thread.settings",
        {"threadId": tid, "settings": {"additionalDirectories": [str(d2)]}},
    )
    assert th.additional_directories == (str(d2.resolve()),)
    assert get_session_extra_roots(th.session_id) == (str(d2.resolve()),)

    # 空数组 = 清空(移除即失效)
    await _rpc(
        engine,
        "thread.settings",
        {"threadId": tid, "settings": {"additionalDirectories": []}},
    )
    assert th.additional_directories == ()
    assert get_session_extra_roots(th.session_id) == ()


async def test_engine_settings_rejects_invalid_dir_wholesale(tmp_path):
    """任一目录准入失败整表拒绝:合法目录也不得部分生效。"""
    engine, _store = _engine_with_store(tmp_path)
    d_ok = tmp_path / "ok-dir"
    d_ok.mkdir()
    tid = (await _rpc(engine, "thread.start", {"model": "base"}))["threadId"]
    th = engine._threads[tid]

    err = await _rpc_error(
        engine,
        "thread.settings",
        {
            "threadId": tid,
            "settings": {"additionalDirectories": [str(d_ok), "relative/bad"]},
        },
    )
    assert err["code"] == INVALID_PARAMS
    # 整表拒绝:注册表与本线程字段都保持空
    assert th.additional_directories == ()
    assert get_session_extra_roots(th.session_id) == ()

    # 非法类型同拒
    err2 = await _rpc_error(
        engine,
        "thread.settings",
        {"threadId": tid, "settings": {"additionalDirectories": "not-a-list"}},
    )
    assert err2["code"] == INVALID_PARAMS


async def test_engine_settings_rejects_running_thread(tmp_path):
    engine, _store = _engine_with_store(tmp_path)
    d = tmp_path / "d"
    d.mkdir()
    tid = (await _rpc(engine, "thread.start", {"model": "base"}))["threadId"]
    engine._threads[tid].status = "running"
    err = await _rpc_error(
        engine,
        "thread.settings",
        {"threadId": tid, "settings": {"additionalDirectories": [str(d)]}},
    )
    assert err["code"] == THREAD_BUSY


# ---------------------------------------------------------------------------
# ⑤ 工具执行器闭包的 session_key 过桥
# ---------------------------------------------------------------------------


async def test_build_loop_v2_tools_passes_session_key(monkeypatch, tmp_path):
    captured: dict[str, Any] = {}

    async def _fake_call_tool(name, args, *, user_role=0, user_id=None, session_id=None):
        captured["session_id"] = session_id
        captured["user_role"] = user_role
        return {"ok": True}

    monkeypatch.setattr(mcp_server_module.mcp_server, "call_tool", _fake_call_tool)

    tools = await _build_loop_v2_tools(["read_file"], 0, "", session_key="conv-key")
    target = [t for t in tools if getattr(t, "name", "") == "read_file"]
    assert target, "read_file 应在工具池中"
    await target[0].executor({"path": "x"})
    assert captured["session_id"] == "conv-key"
    assert captured["user_role"] == 0

    # 缺省(空会话键)→ None,与历史形态一致
    tools2 = await _build_loop_v2_tools(["read_file"], 0, "")
    target2 = [t for t in tools2 if getattr(t, "name", "") == "read_file"]
    captured.clear()
    await target2[0].executor({"path": "x"})
    assert captured["session_id"] is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
