# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-054 / AIS-056 / AIS-085 夹具(同一批)。

- AIS-054:`_tool_web_search` 包装层把子检索的 `ok/error/errorCode` 全丢掉,
  永远返回 `ok:true`;空 query 也报成功。现在失败态透传,空 query 直接
  `MISSING_PARAMS` 且不再调用子检索。
- AIS-056:Windows 下超时/取消只 `proc.kill()`(只杀 cmd.exe),子进程继续跑。
  现在统一走进程树终止(`taskkill /F /T /PID`),失败才回退 `proc.kill()`。
- AIS-085:`db_query` 只挡写关键词,`SELECT pg_read_file('/etc/passwd')`
  能穿过。现在函数名黑名单(词边界)在连 DB 之前拒绝。
"""

from __future__ import annotations

import asyncio
import re
import sys
import types
from typing import Any

import pytest

from app.services import mcp_server


# ---------------------------------------------------------------------------
# AIS-054:web_search 包装层不得吞失败/空 query
# ---------------------------------------------------------------------------


@pytest.fixture()
def _search_calls(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []

    async def _fake(arguments: dict[str, Any]) -> dict[str, Any]:
        calls.append(dict(arguments))
        return {
            "ok": False,
            "error": "upstream boom",
            "errorCode": "NETWORK_ERROR",
            "results": [],
            "total": 0,
            "message": "检索失败",
        }

    monkeypatch.setattr(mcp_server, "_tool_search_web", _fake)
    return calls


async def test_empty_query_is_missing_params_not_ok(
    _search_calls: list[dict[str, Any]],
) -> None:
    """改前必红:空 query 旧码返回 ok:true。"""
    out = await mcp_server._tool_web_search({"query": ""})
    assert out["ok"] is False, out
    assert out["errorCode"] == "MISSING_PARAMS", out
    assert _search_calls == [], "空 query 仍打到了子检索"


async def test_search_failure_is_passed_through(
    _search_calls: list[dict[str, Any]],
) -> None:
    """改前必红:旧码把子检索 ok:false 包装成 ok:true + 空 results。"""
    out = await mcp_server._tool_web_search({"query": "rag", "max_results": 3})
    assert out["ok"] is False, out
    assert out["errorCode"] == "NETWORK_ERROR", out
    assert out["error"] == "upstream boom", out
    assert out["results"] == [], out
    assert _search_calls == [{"query": "rag", "max_results": 3}], _search_calls


async def test_search_success_is_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    """正向控制:成功态字段与旧契约一致,不把包装层改成一律失败。"""

    async def _fake(arguments: dict[str, Any]) -> dict[str, Any]:
        return {
            "ok": True,
            "results": [{"title": "t", "url": "https://e.test"}],
            "total": 1,
            "message": "",
        }

    monkeypatch.setattr(mcp_server, "_tool_search_web", _fake)
    out = await mcp_server._tool_web_search({"query": "rag"})
    assert out["ok"] is True, out
    assert out["total"] == 1
    assert out["results"] == [{"title": "t", "url": "https://e.test"}]
    assert "errorCode" not in out


# ---------------------------------------------------------------------------
# AIS-056:Windows 超时要杀进程树,不能只杀 cmd.exe
# ---------------------------------------------------------------------------


class _FakeStream:
    async def readline(self) -> bytes:
        return b""


class _FakeProc:
    pid = 4242
    stdin = None
    returncode = None

    def __init__(self, killed: list[str]) -> None:
        self._killed = killed
        self.stdout = _FakeStream()
        self.stderr = _FakeStream()

    def kill(self) -> None:
        self._killed.append("proc.kill")

    async def wait(self) -> int:
        return 0


class _FakeKillerProc:
    async def wait(self) -> int:
        return 0


def _install_policy_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mcp_server, "_is_dangerous_command_blocked", lambda: False)

    async def _cfg(principal):
        return types.SimpleNamespace(exec_policy_mode="off")

    monkeypatch.setattr(mcp_server, "resolve_security_config", _cfg)


@pytest.mark.skipif(sys.platform != "win32", reason="cmd 内建命令分支仅 Windows 可达")
async def test_timeout_kills_process_tree_on_windows(monkeypatch: pytest.MonkeyPatch) -> None:
    """改前必红:旧码只 proc.kill(),taskkill 一次都不发。"""
    _install_policy_off(monkeypatch)
    killed: list[str] = []
    taskkills: list[tuple[str, ...]] = []
    proc = _FakeProc(killed)

    async def _spawn(*args, **kwargs):
        if args and args[0] == "taskkill":
            taskkills.append(tuple(str(a) for a in args))
            return _FakeKillerProc()
        return proc

    async def _timed_out(drain, base_timeout, state):
        return True

    monkeypatch.setattr(asyncio, "create_subprocess_exec", _spawn)
    monkeypatch.setattr(mcp_server, "_drain_with_input_grace", _timed_out)

    out = await mcp_server._tool_run_command({"command": "echo hello", "timeout": 1})

    assert out["ok"] is False and out["errorCode"] == "TIMEOUT", out
    assert any(t[:4] == ("taskkill", "/F", "/T", "/PID") for t in taskkills), taskkills
    assert taskkills[0][-1] == "4242", taskkills


async def test_tree_kill_falls_back_to_proc_kill(monkeypatch: pytest.MonkeyPatch) -> None:
    """taskkill 自身不可用时必须回退 proc.kill(),不能因为改了实现就放弃终止。"""
    assert hasattr(mcp_server, "_terminate_process_tree"), (
        "缺少统一的进程树终止入口(AIS-056)"
    )
    killed: list[str] = []
    proc = _FakeProc(killed)

    async def _spawn(*args, **kwargs):
        raise FileNotFoundError("taskkill unavailable")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", _spawn)
    await mcp_server._terminate_process_tree(proc)
    assert killed == ["proc.kill"], killed


# ---------------------------------------------------------------------------
# AIS-085:db_query 不得借 pg_read_file 等函数读 DB 主机文件
# ---------------------------------------------------------------------------


@pytest.fixture()
def _no_db(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """把 DB 连接换成"一旦被调用就记账"的替身,断言非法 SQL 根本不连库。"""
    calls: list[str] = []

    async def _connect(*args, **kwargs):
        calls.append(str(args[0]) if args else "")
        raise RuntimeError("connect should not be reached")

    fake_asyncpg = types.ModuleType("asyncpg")
    fake_asyncpg.connect = _connect  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "asyncpg", fake_asyncpg)
    monkeypatch.setattr(
        "app.core.config.settings",
        types.SimpleNamespace(database_url="postgresql://db.test/ihui"),
    )
    return calls


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT pg_read_file('/etc/passwd')",
        "SELECT pg_catalog.pg_read_file('/etc/passwd')",
        "SELECT pg_read_binary_file('/etc/passwd')",
        "SELECT pg_ls_dir('/')",
        "SELECT lo_import('/etc/passwd')",
    ],
)
async def test_host_file_functions_are_rejected_before_connect(
    _no_db: list[str], sql: str
) -> None:
    """改前必红:旧码只挡写关键词,这些 SELECT 会一路走到 asyncpg.connect。"""
    out = await mcp_server._tool_db_query({"sql": sql})
    assert out["ok"] is False, out
    assert out["errorCode"] == "SQL_FORBIDDEN_FUNCTION", out
    fn_name = re.search(r"(\w+)\s*\(", sql).group(1)  # type: ignore[union-attr]
    assert fn_name.lower() in out["message"].lower(), out
    assert _no_db == [], f"非法 SQL 仍尝试连库: {_no_db}"


async def test_normal_select_is_not_blocked_by_function_blacklist(
    _no_db: list[str],
) -> None:
    """正向控制:普通 SELECT 不得被新黑名单误杀(仍会走到连库)。"""
    out = await mcp_server._tool_db_query({"sql": "SELECT current_database()"})
    assert out.get("errorCode") != "SQL_FORBIDDEN_FUNCTION", out
    assert _no_db, "普通 SELECT 被拦下,说明黑名单误杀"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
