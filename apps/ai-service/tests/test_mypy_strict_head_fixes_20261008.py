# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""守门 35(mypy --strict)HEAD 面 15 条红的逐条回归 —— 修代码,不修判据。

覆盖面(每条一个"回退我的修改就会翻红"的载体,弱断言不算):

1. ``app/core/exec_env.py::resolve_stdio_command``(:191 no-redef / :198 :201 attr-defined)
   根因不是"少个注解",是**一个名字绑了两种类型**:显式路径分支把 ``tried`` 绑成
   tuple,PATH 搜索分支把同名变量当 list 逐条 ``append``。运行时靠"该分支立刻 return"
   侥幸不相撞,而尺子从此看不见累加逻辑。⇒ 行为用例钉住两支各自的 ``tried`` 语义
   (显式支恰为一元 tuple;搜索支按候选序累加),并加一条 AST 形状锁 + 构造面阳性对照
   (把修复前那一形喂进去必须判红)—— 因为这一型**没有可观测的运行时差异**,
   只靠行为断言无法在回退时翻红。
2. ``app/providers/openai_provider.py::astream``(:174 no-redef)同一型:两条语义不同的
   done 帧(带真 usage / 空 usage 兜底)共用一个 ``_done_evt`` 并各声明一次。
3. ``app/services/mcp_client.py::_stdio_connect``(:418 arg-type):把 ``str | None`` 递进
   子进程可执行路径位。行为用例钉"spawn 收到的必须是解析出的绝对路径(且非 None)";
   形状锁钉"该位置不得直接取 ``resolution.resolved``"。
4. ``app/services/ttl_json_store.py::load_ttl_records``(:374 :382)联合收窄 ⇒ 行为用例
   钉 mapping / sequence 两种存档形态在 validate 剔除与环形截断后仍各归各的清扫器。
5. ``app/services/checkin_store.py``(:94 :269 :286 :355 :515 :567)⇒ 用假 asyncpg 连接
   钉住新注解所断言的事实:``execute()`` 回状态文本(``"DELETE 1"`` 才算删除)、
   ``RETURNING`` 的计数列回 int、行投影只按键读。

测试隔离(AGENTS §5 铁律):全程不连 PostgreSQL / Redis,DB 面一律假连接对象;
不派生任何子进程(``asyncio.create_subprocess_exec`` 被 monkeypatch 成捕获桩)。
"""

from __future__ import annotations

import ast
import json
import os
import stat
import sys
from pathlib import Path
from typing import Any

import pytest

from app.core import exec_env
from app.services import mcp_client as mcp_client_mod
from app.services import ttl_json_store
from app.services.mcp_client import MCPClient, MCPClientConfig

AI_ROOT = Path(__file__).resolve().parents[1]


# ---------------------------------------------------------------------------
# 共用:AST 形状锁的两把尺子(判"名字绑了两型"与"同一名字声明两次")
# ---------------------------------------------------------------------------


def _func_source(path: Path, func_name: str) -> ast.FunctionDef | ast.AsyncFunctionDef:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == func_name:
            return node
    raise AssertionError(f"{path.name} 里找不到函数 {func_name}(改名没同步=判据失明)")


def _dual_declaration_offenders(fn: ast.AST) -> list[str]:
    """同一函数体内被**两次带注解声明**的名字(mypy 的 no-redef 型)。"""
    counts: dict[str, int] = {}
    for node in ast.walk(fn):
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            counts[node.target.id] = counts.get(node.target.id, 0) + 1
    return sorted(name for name, n in counts.items() if n > 1)


def _tuple_bound_then_appended_offenders(fn: ast.AST) -> list[str]:
    """既被绑成 tuple 字面量、又被当 list 调 ``.append`` 的名字(同名两型那一型)。"""
    tuple_bound: set[str] = set()
    appended: set[str] = set()
    for node in ast.walk(fn):
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            value = node.value
            if isinstance(value, ast.Tuple):
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                for t in targets:
                    if isinstance(t, ast.Name):
                        tuple_bound.add(t.id)
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "append"
            and isinstance(node.func.value, ast.Name)
        ):
            appended.add(node.func.value.id)
    return sorted(tuple_bound & appended)


# 构造面阳性对照:逐字取自修复前那两种形态(不依赖 git,不依赖工作树此刻的状态)。
_BUGGY_SAME_NAME_TWO_TYPES = '''
def resolve_stdio_command_replica(command):
    if "/" in command:
        tried = (command,)
        return tried
    tried = []
    for d in ["/a", "/b"]:
        tried.append(d)
    return tuple(tried)
'''

_BUGGY_SAME_NAME_DECLARED_TWICE = '''
async def astream_replica():
    _done_evt: dict[str, Any] = {"type": "done", "usage": {"x": 1}}
    yield _done_evt
    _done_evt: dict[str, Any] = {"type": "done", "usage": {}}
    yield _done_evt
'''


def test_shape_lock_actually_has_teeth_on_the_pre_fix_forms():
    """阳性对照:形状锁必须认出修复前那两型(否则下面的"必须干净"就是恒绿断言)。"""
    buggy_two_types = _func_source_from_string(_BUGGY_SAME_NAME_TWO_TYPES, "resolve_stdio_command_replica")
    assert _tuple_bound_then_appended_offenders(buggy_two_types) == ["tried"]

    buggy_double_decl = _func_source_from_string(_BUGGY_SAME_NAME_DECLARED_TWICE, "astream_replica")
    assert _dual_declaration_offenders(buggy_double_decl) == ["_done_evt"]


def _func_source_from_string(src: str, func_name: str) -> ast.FunctionDef | ast.AsyncFunctionDef:
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == func_name:
            return node
    raise AssertionError(f"构造面里找不到 {func_name}")


def test_exec_env_resolver_has_no_name_bound_as_both_tuple_and_list():
    """回退 ``explicit_tried`` 那一改 ⇒ 本条立刻翻红(tried 又被绑成 tuple 还调 append)。"""
    fn = _func_source(AI_ROOT / "app" / "core" / "exec_env.py", "resolve_stdio_command")
    assert _tuple_bound_then_appended_offenders(fn) == []
    assert _dual_declaration_offenders(fn) == []


def test_openai_astream_declares_each_done_frame_once():
    """回退 ``_usage_done_evt`` / ``_fallback_done_evt`` 拆名 ⇒ 本条立刻翻红。"""
    src_path = AI_ROOT / "app" / "providers" / "openai_provider.py"
    assert _dual_declaration_offenders(_func_source(src_path, "astream")) == []
    tree = ast.parse(src_path.read_text(encoding="utf-8"))
    # 两条 done 帧必须各自独立成名,而不是让后一条借用前一条的声明(那会把两语义并成一个)。
    # 判在 **AST 面**而不是原文面:头注里逐字写着旧名作说明,按文本判会把"解释自己"
    # 的注释当成违规站点(守门 131/135 同一课 —— 遮噪方向错了,门就在自己的说明上误红)。
    names = {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)}
    assert "_done_evt" not in names, "共用的旧名 _done_evt 不得回来"
    assert {"_usage_done_evt", "_fallback_done_evt"} <= names, "两条分支各自成名的新名不得被合并回一个"


def test_mcp_client_exec_path_is_narrowed_not_the_optional_attribute():
    """可执行路径位必须取"判过 None 的局部量",不得把 ``resolution.resolved`` 直接递进去。"""
    tree = ast.parse(
        (AI_ROOT / "app" / "services" / "mcp_client.py").read_text(encoding="utf-8")
    )
    fn = next(
        n
        for n in ast.walk(tree)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == "_stdio_connect"
    )
    calls = [
        n
        for n in ast.walk(fn)
        if isinstance(n, ast.Call)
        and isinstance(n.func, ast.Attribute)
        and n.func.attr == "create_subprocess_exec"
    ]
    assert calls, "create_subprocess_exec 调用点不见了(判据对本站点失明)"
    for call in calls:
        first = call.args[0] if call.args else None
        assert isinstance(first, ast.Name), (
            "子进程可执行路径必须来自已收窄的局部变量;"
            f"实得形态={ast.dump(first) if first else '缺参数'}(str|None 直递即守门 35 :418 那一型)"
        )


# ---------------------------------------------------------------------------
# exec_env:两条分支的 tried 语义(行为面,钉"累加逻辑真的在跑")
# ---------------------------------------------------------------------------


def _mk_executable(directory: Path, name: str) -> Path:
    p = directory / name
    p.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    p.chmod(p.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return p


def test_explicit_path_branch_tried_is_exactly_one_candidate(tmp_path, monkeypatch):
    """显式路径分支:tried 恰为 (command,) —— 不因为共用名字被搜索分支的累加污染。"""
    real = _mk_executable(tmp_path, "real-bin")
    other = tmp_path / "dir-on-path"
    other.mkdir()
    monkeypatch.setenv("PATH", str(other))
    out = exec_env.resolve_stdio_command(str(real), {"PATH": str(other)})
    assert out.resolved == str(real)
    assert out.tried == (str(real),), "显式路径的候选序只许是它自己(多一个就是两支串了)"
    assert isinstance(out.tried, tuple)

    missing = str(tmp_path / "no-such-bin")
    out2 = exec_env.resolve_stdio_command(missing, {"PATH": str(other)})
    assert out2.resolved is None and out2.tried == (missing,)


def test_path_search_branch_appends_candidates_in_order(tmp_path):
    """PATH 搜索分支:tried 是逐条 append 出来的候选序,命中即早退(后面的目录不再试)。

    不 monkeypatch sys.platform:Windows 上的盘符自带 ``:``,把分隔符换成 ``:`` 会让
    PATH 被切成半截目录,测出来的就不是"逐条累加"而是"什么都没找到"(本条第一版就栽在
    这里)。两平台的候选序都保证:**被命中的那个候选一定在册**,且它是早退点。
    """
    first_dir = tmp_path / "a-first"
    second_dir = tmp_path / "b-second"
    first_dir.mkdir()
    second_dir.mkdir()
    hit = _mk_executable(first_dir, "g1008bin")
    second_hit = _mk_executable(second_dir, "g1008bin")
    out = exec_env.resolve_stdio_command(
        "g1008bin", {"PATH": os.pathsep.join([str(first_dir), str(second_dir)])}
    )
    base = str(hit)  # 即 os.path.join(第一目录, "g1008bin") —— 候选序里被命中的那一条
    assert out.resolved == base, f"应命中 PATH 首位目录里的入口,实得 {out.resolved!r}"
    assert base in out.tried, "命中候选必须在候选序里(它是被 append 进去的那一条)"
    assert os.path.join(str(second_dir), "g1008bin") not in out.tried, (
        "命中后不得继续试第二目录 —— 第二候选出现在册就等于早退丢了"
    )
    assert isinstance(out.tried, tuple), "出口是 frozen dataclass 的 tuple,不得回 list"
    assert str(second_hit).startswith(str(second_dir))  # 夹具自证:第二目录里确实有同名入口


def test_win32_branch_appends_extension_candidates_before_the_bare_name(tmp_path, monkeypatch):
    """win32 形态:PATHEXT 扩展候选先入册,命中的那一条就是出口(出处序完整)。

    2026-10-11 CI 对账(run 38084051334):入口文件名原写成小写 `g1008tool.cmd`,
    而 PATHEXT 语料是大写 `.CMD` —— 大小写不敏感的命中是 **Windows FS 的属性**,
    Linux CI 的 case-sensitive FS 上 isfile 直接 miss ⇒ resolved=None。本条要钉的
    判据是"PATHEXT 候选先于裸名、命中即早退、候选序完整",不是 FS 大小写行为
    (后者在 Windows 上恒真、在 POSIX 上恒假,属平台语义)。故入口文件名与候选
    同形(大写扩展),两侧平台都能钉同一份候选序判据。
    """
    bin_dir = tmp_path / "bindir"
    bin_dir.mkdir()
    target = _mk_executable(bin_dir, "g1008tool.CMD")
    monkeypatch.setattr(sys, "platform", "win32")
    out = exec_env.resolve_stdio_command(
        "g1008tool", {"PATH": str(bin_dir), "PATHEXT": ".COM;.EXE;.BAT;.CMD"}
    )
    assert out.resolved is not None and out.resolved.lower() == str(target).lower(), (
        "命中的必须是那个 .cmd(PATHEXT 扩展候选逐条试,命中即早退)"
    )
    tried_upper = [c.upper() for c in out.tried]
    assert tried_upper[0].endswith("G1008TOOL.COM"), "候选序首位应是 PATHEXT 的第一个扩展"
    assert tried_upper[-1].endswith("G1008TOOL.CMD"), "命中项是候选序的末位(命中即早退)"
    assert len(tried_upper) == 4, ".COM/.EXE/.BAT/.CMD 四条都该逐条 append 进册"


# ---------------------------------------------------------------------------
# mcp_client:spawn 收到的是解析出的绝对路径,且不是 None
# ---------------------------------------------------------------------------


async def test_stdio_connect_spawns_the_resolved_absolute_path(tmp_path, monkeypatch):
    """成功分支:create_subprocess_exec 的第一参数必须是解析到的绝对路径(收窄后的 str)。"""
    bin_dir = tmp_path / "bindir"
    bin_dir.mkdir()
    target = _mk_executable(bin_dir, "g1008server")

    captured: dict[str, Any] = {}

    class _SpawnSentinel(Exception):
        pass

    async def _fake_exec(*args: Any, **kwargs: Any) -> Any:
        captured["args"] = args
        captured["kwargs"] = kwargs
        raise _SpawnSentinel()

    monkeypatch.setattr(mcp_client_mod.asyncio, "create_subprocess_exec", _fake_exec)
    config = MCPClientConfig(
        name="g1008-narrowing",
        transport="stdio",
        command="g1008server",
        args=["--stdio"],
        env={"PATH": str(bin_dir)},
    )
    client = MCPClient(config)
    try:
        result = await client._stdio_connect()
    except _SpawnSentinel:
        result = None  # 捕获桩按设计炸掉派生,不影响"传了什么参数"这一判据
    assert result in (False, None)
    assert captured, "没有派生任何子进程 ⇒ 本条什么都没证明"
    executable = captured["args"][0]
    assert isinstance(executable, str), f"可执行路径位拿到了 {type(executable)!r}"
    assert executable == str(target), "spawn 的必须是解析出的绝对路径,不是原始裸名"
    assert captured["kwargs"].get("limit") == mcp_client_mod.PROTOCOL_FRAME_LIMIT_BYTES


# ---------------------------------------------------------------------------
# ttl_json_store:mapping / sequence 两支在收窄后仍各归各的清扫器
# ---------------------------------------------------------------------------


def test_load_ttl_records_mapping_shape_keeps_mapping_shape(tmp_path):
    path = tmp_path / "map.json"
    path.write_text(
        json.dumps({"a": {"v": 1}, "b": {"v": 2}}),
        encoding="utf-8",
    )
    cleaned, dropped = ttl_json_store.load_ttl_records(
        str(path),
        retention_days=0,  # 显式关闭 TTL:本条只验形态分派,不掺时间判定
        shape="mapping",
        validate=lambda rec: rec.get("v") != 2,
    )
    assert isinstance(cleaned, dict), f"mapping 存档被分派成了 {type(cleaned)!r}"
    assert list(cleaned) == ["a"]
    assert dropped == 1


def test_load_ttl_records_sequence_shape_keeps_sequence_shape(tmp_path):
    path = tmp_path / "seq.json"
    path.write_text(json.dumps([{"v": 1}, {"v": 2}, {"v": 3}]), encoding="utf-8")
    cleaned, dropped = ttl_json_store.load_ttl_records(
        str(path),
        retention_days=0,
        shape="sequence",
        max_items=2,
        validate=lambda rec: rec.get("v") != 9,
    )
    assert isinstance(cleaned, list), f"sequence 存档被分派成了 {type(cleaned)!r}"
    assert [r["v"] for r in cleaned] == [2, 3], "环形截断仍按'尾部最新'保留"
    assert dropped == 1


def test_load_ttl_records_shape_mismatch_stays_fail_closed(tmp_path):
    """shape 与实际形态不符 ⇒ 空值 + 不抛错(收窄改成 isinstance 后这条边界不得变软)。"""
    mapping_file = tmp_path / "m.json"
    mapping_file.write_text(json.dumps({"a": {"v": 1}}), encoding="utf-8")
    assert ttl_json_store.load_ttl_records(str(mapping_file), retention_days=0, shape="sequence") == ([], 0)

    list_file = tmp_path / "l.json"
    list_file.write_text(json.dumps([{"v": 1}]), encoding="utf-8")
    assert ttl_json_store.load_ttl_records(str(list_file), retention_days=0, shape="mapping") == ({}, 0)


# ---------------------------------------------------------------------------
# checkin_store:新注解断言的是 asyncpg 的真返回值形状,用假连接把它钉住
# ---------------------------------------------------------------------------


class _FakeRecord(dict):
    """asyncpg Record 的最小投影:按列名读 + ``in`` 判列存在(与 _*_row 的用法同形)。"""


class _FakeConn:
    def __init__(self, *, status: str = "", row: Any = None, rows: Any = None) -> None:
        self._status = status
        self._row = row
        self._rows = rows or []
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    async def execute(self, sql: str, *args: Any) -> str:
        self.executed.append((sql, args))
        return self._status

    async def fetchrow(self, sql: str, *args: Any) -> Any:
        self.executed.append((sql, args))
        return self._row

    async def fetch(self, sql: str, *args: Any) -> Any:
        self.executed.append((sql, args))
        return self._rows


class _FakeAcquire:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self._conn

    async def __aexit__(self, *exc: Any) -> bool:
        return False


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self._conn)


@pytest.fixture
def fake_pool(monkeypatch):
    from app.services import checkin_store

    holder: dict[str, _FakeConn] = {}

    async def _get_pool() -> _FakePool:
        return _FakePool(holder["conn"])

    monkeypatch.setattr(checkin_store, "get_shared_pool", _get_pool)
    return holder


async def test_delete_account_true_only_when_status_says_one_row(fake_pool):
    from app.services import checkin_store

    fake_pool["conn"] = _FakeConn(status="DELETE 1")
    assert await checkin_store.delete_account(7, "u-7") is True
    fake_pool["conn"] = _FakeConn(status="DELETE 0")
    assert await checkin_store.delete_account(7, "u-7") is False, (
        "状态文本(tag: str)是命中与否的唯一依据;改成 bool(tag) 之类的静默兜底本条即红"
    )


async def test_set_enabled_true_only_when_status_says_one_row(fake_pool):
    from app.services import checkin_store

    fake_pool["conn"] = _FakeConn(status="UPDATE 1")
    assert await checkin_store.set_enabled(7, "u-7", False) is True
    fake_pool["conn"] = _FakeConn(status="UPDATE 0")
    assert await checkin_store.set_enabled(7, "u-7", False) is False


async def test_bump_error_count_returns_the_returned_integer(fake_pool):
    from app.services import checkin_store

    fake_pool["conn"] = _FakeConn(row=_FakeRecord({"server_errors": 3}))
    got = await checkin_store.bump_error_count(7, "server_errors")
    assert got == 3 and isinstance(got, int), (
        ":567 钉的是「库回什么就报什么」——回成 0/None/长度即本条红"
    )
    with pytest.raises(ValueError):
        await checkin_store.bump_error_count(7, "not_a_column")


async def test_account_row_projection_is_key_only_and_never_leaks_secrets():
    from app.services import checkin_store

    row = _FakeRecord(
        {
            "id": 1,
            "name": "acct",
            "device_map": json.dumps({"a": {"b": "c"}}),
            "enabled": True,
            "created_at": None,
            "updated_at": None,
            "jwt_enc": b"never-echo-me",
        }
    )
    out = checkin_store._account_row(row)
    assert out["device_map"] == {"a": {"b": "c"}}, "device_map 为 JSON 文本时也要解出结构"
    assert "jwt" not in out and "jwt_enc" not in out, "脱敏投影:任何情况下不得回吐 jwt"
    assert "last_record" not in out, "缺 last_created_at 列时不得凭空造 last_record 键"

    record = checkin_store._record_row(
        _FakeRecord(
            {
                "id": 9,
                "account_id": 1,
                "ok": True,
                "action": "signin",
                "http_status": 200,
                "code": None,
                "message": None,
                "classified_error": None,
                "cooldown_until": None,
                "credits": 5,
                "credits_delta": 5,
                "created_at": None,
            }
        )
    )
    assert record["cooldown_until"] is None and record["credits"] == 5


async def test_ensure_tables_conn_runs_all_four_statements_on_given_conn(fake_pool):
    """连接参数钉成 asyncpg.Connection 后,裸连接入口仍必须只摸给它的这一条连接。

    函数名里的 "four" 是历史读数(写这条时建表面是 3 表 + 1 索引)。签到助手 Phase1c/1d
    (枚 a05e4df089)给 `publish/checkin_accounts` 加了 `account_group` 的**幂等加列**语句,
    建表面涨到五条 —— 按旧名去把产品改回四条就是回退那枚功能票。
    2026-10-11 对账 CI run 38084051334 红因②:源码此后又落了两段 —— WP-B 后端半
    (2026-10-09)的积分每日快照表 `_CREATE_CREDITS_DAILY_SQL` 与平台化(2026-10-10)
    的 `_ALTER_ACCOUNTS_PLATFORM_SQL`('trae'|'qoder' 加列),建表面为**七段**;
    测试此前仍钉五段,是测试过期、源码正确 ⇒ 更新期望清单而不是回退产品。
    这里**不数条数**,逐字钉"应当执行的就是这七段 DDL、按这个顺序、一条不多一条
    不少":按模块自己的 DDL 常量对账既抓得住"建表面被摘",
    也抓得住"顺序换了 / 塞进一条别的语句"。
    """
    from app.services import checkin_store

    conn = _FakeConn(status="CREATE TABLE")
    await checkin_store.ensure_tables_conn(conn)  # 假连接:与 asyncpg.Connection 同一条 execute 协议
    assert [sql for sql, _args in conn.executed] == [
        checkin_store._CREATE_ACCOUNTS_SQL,
        checkin_store._CREATE_RECORDS_SQL,
        checkin_store._CREATE_ERROR_COUNTS_SQL,
        checkin_store._CREATE_CREDITS_DAILY_SQL,
        checkin_store._ALTER_ACCOUNTS_GROUP_SQL,
        checkin_store._ALTER_ACCOUNTS_PLATFORM_SQL,
        checkin_store._CREATE_INDEXES_SQL,
    ], "建表面被摘/被替换/被加料 —— 裸连接入口必须逐段执行这七份 DDL"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
