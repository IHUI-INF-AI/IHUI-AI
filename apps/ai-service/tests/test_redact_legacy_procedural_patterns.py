# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""一次性脱敏工具的测试(全内存假件,**绝不派生真连接** —— AGENTS.md §5 测试隔离铁律)。

覆盖的是「判据有没有牙」,不是「代码能不能跑」:
  * 幂等:跑第二次零 UPDATE、零行数变化(本仓踩过「幂等守卫只判存在于是冻结了冗余」那一型,
    所以 `redacted-` 与 64 位 hex 两条跳过路径各有一例)。
  * 撞唯一约束的两型都在 dry-run 阶段算出并跳过,不靠捕获异常后静默。
  * 连不上库 ⇒ 退出码 2 且报告里没有「待改写命中行数」(判据失明不得被读成扫过了)。
  * 输出面绝不出现原文片段(一个量明文的工具自己把明文打出来 = 把缺陷搬进日志)。

autouse 夹具把 `open_store` 打成必抛 —— 本模块任何用例都不许触达真实 asyncpg。
"""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import sys
from pathlib import Path
from typing import Any

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "redact_legacy_procedural_patterns.py"


def _load_module() -> Any:
    spec = importlib.util.spec_from_file_location("redact_legacy_procedural_patterns", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


mod = _load_module()

PLAIN_TAIL = '{"path":"G:/IHUI-AI/secret.txt","content":"李春川的口令是 abc123"}'
PLAIN_TAIL_2 = '{"command":"rm -rf /tmp/x && cat ~/.ssh/id_rsa"}'
DSN = "postgresql://u:p@127.0.0.1:8810/ihui"


@pytest.fixture(autouse=True)
def _forbid_real_connections(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _never(*_a: Any, **_k: Any) -> Any:
        raise AssertionError("测试不得开真连接(§5 测试隔离铁律)")

    monkeypatch.setattr(mod, "open_store", _never)


@pytest.fixture
def env_clean(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)


def row(rid: str, user: str, tool: str, pattern: str) -> Any:
    return mod.RowSnapshot(row_id=rid, user_id=user, tool_name=tool, pattern=pattern)


def expected_new(tail: str, tool: str = "read_file") -> str:
    digest = hashlib.sha256(tail.encode("utf-8")).hexdigest()[:16]
    return f"doom_loop:{tool}:redacted-{digest}"


class FakeStore:
    """内存表。apply_updates 模拟单事务:任一行 CAS 不命中 ⇒ 整批回滚并抛 WriteAnomaly。"""

    def __init__(
        self,
        rows: list[Any],
        *,
        table_exists: bool = True,
        columns: Any = None,
        unique_ok: bool = True,
        anomaly_on_index: int | None = None,
    ) -> None:
        self.rows = rows
        self.table_exists = table_exists
        self.columns = frozenset(mod.REQUIRED_COLUMNS) if columns is None else frozenset(columns)
        self.unique_ok = unique_ok
        self.anomaly_on_index = anomaly_on_index
        self.applied = 0
        self.rolled_back = False
        self.closed = False
        self.prefixed_fetches = 0

    async def schema_report(self) -> Any:
        return mod.SchemaReport(
            table_exists=self.table_exists,
            columns=self.columns,
            unique_index_ok=self.unique_ok,
        )

    async def count_rows(self) -> tuple[int, int]:
        prefixed = sum(1 for r in self.rows if r.pattern.startswith(mod.PATTERN_PREFIX))
        return len(self.rows), prefixed

    async def fetch_prefixed_rows(self) -> list[Any]:
        self.prefixed_fetches += 1
        return [r for r in self.rows if r.pattern.startswith(mod.PATTERN_PREFIX)]

    async def fetch_rows_by_patterns(self, patterns: list[str]) -> list[Any]:
        wanted = set(patterns)
        return [r for r in self.rows if r.pattern in wanted]

    async def apply_updates(self, updates: list[tuple[str, str, str]]) -> int:
        if not updates:
            return 0
        snapshot = copy.deepcopy(self.rows)
        applied = 0
        for i, (rid, expected, new_pattern) in enumerate(updates):
            by_id = {r.row_id: r for r in self.rows}
            target = by_id.get(rid)
            if target is None or target.pattern != expected or i == self.anomaly_on_index:
                self.rows = snapshot  # 模拟事务回滚
                self.rolled_back = True
                raise mod.WriteAnomaly(f"模拟第 {i} 行 CAS 未命中")
            self.rows = [
                r if r.row_id != rid else row(r.row_id, r.user_id, r.tool_name, new_pattern)
                for r in self.rows
            ]
            applied += 1
        self.applied = applied
        return applied

    async def close(self) -> None:
        self.closed = True


def make_store(rows: list[Any], **kwargs: Any) -> FakeStore:
    return FakeStore([copy.deepcopy(r) for r in rows], **kwargs)


def _opener(store: Any) -> Any:
    async def _inner() -> Any:
        return store

    return _inner


def _refuse(_db: str) -> bool:
    raise AssertionError("dry-run / 未命中档不该要二次确认")


def args_for(argv: list[str]) -> Any:
    return mod.parse_args(argv)


BASE_ROWS = [
    row("1", "u1", "read_file", f"doom_loop:read_file:{PLAIN_TAIL}"),
    row("2", "u1", "run_command", f"doom_loop:run_command:{PLAIN_TAIL_2}"),
    row("3", "u2", "read_file", f"doom_loop:read_file:{'b' * 64}"),
    row("4", "u1", "read_file", "doom_loop:read_file:redacted-ffffffffffffffff"),
]


# ---------------------------------------------------------------------------
# 纯判据
# ---------------------------------------------------------------------------


def test_split_pattern_keeps_colons_inside_tail() -> None:
    """JSON 明文里全是冒号 ⇒ 只能按前两段切,尾段必须整段保留。"""
    parsed = mod.split_pattern(f"doom_loop:read_file:{PLAIN_TAIL}")
    assert parsed is not None
    tool, tail = parsed
    assert tool == "read_file"
    assert tail == PLAIN_TAIL


@pytest.mark.parametrize(
    "pattern",
    [
        "doom_loop:read_file",  # 缺尾段分隔符
        "doom_loop::x",  # 工具段为空
        "doomXloop:read_file:abc",  # 不是本前缀(_ 未转义时的假阳形态)
        "other:read_file:abc",
    ],
)
def test_malformed_or_out_of_scope_patterns_return_none(pattern: str) -> None:
    assert mod.split_pattern(pattern) is None


def test_analyze_groups_by_tool_name_and_skips_safe_forms() -> None:
    analysis = mod.analyze(BASE_ROWS)
    assert [r.row_id for r, _ in analysis.targets] == ["1", "2"]
    assert analysis.safe_skipped == 2, "redacted- 与 64 位 hex 两型都必须被认作已安全"
    assert analysis.malformed_skipped == 0
    assert analysis.tool_counts == {"read_file": 1, "run_command": 1}


def test_analyze_counts_malformed_separately_from_safe() -> None:
    analysis = mod.analyze(
        [
            row("1", "u1", "read_file", "doom_loop:read_file"),
            row("2", "u1", "read_file", f"doom_loop:read_file:{PLAIN_TAIL}"),
        ]
    )
    assert analysis.malformed_skipped == 1
    assert analysis.safe_skipped == 0
    assert [r.row_id for r, _ in analysis.targets] == ["2"]


def test_new_pattern_is_sha256_prefix_and_deterministic() -> None:
    assert mod.build_new_pattern("read_file", PLAIN_TAIL) == expected_new(PLAIN_TAIL)
    assert mod.build_new_pattern("read_file", PLAIN_TAIL) != mod.build_new_pattern(
        "read_file", PLAIN_TAIL_2
    )


def test_finalize_plan_skips_collision_with_existing_row() -> None:
    new_form = expected_new(PLAIN_TAIL)
    legacy = row("1", "u1", "read_file", f"doom_loop:read_file:{PLAIN_TAIL}")
    existing = row("2", "u1", "read_file", new_form)
    plan = mod.finalize_plan(mod.analyze([legacy]), [existing])
    assert plan.planned == []
    assert [r.row_id for r, _ in plan.collide_with_existing] == ["1"]


def test_finalize_plan_skips_internal_hash_collision_without_choosing() -> None:
    """两条候选映射到同一目标(截断撞车)⇒ 两条都跳过 —— 选任何一条都是猜。"""
    a = row("1", "u1", "read_file", "doom_loop:read_file:aaa")
    b = row("2", "u1", "read_file", "doom_loop:read_file:bbb")
    same = mod.build_new_pattern("read_file", "aaa")
    analysis = mod.Analysis(targets=[(a, same), (b, same)], tool_counts={"read_file": 2})
    plan = mod.finalize_plan(analysis, [])
    assert plan.planned == []
    assert [r.row_id for r, _ in plan.collide_within_candidates] == ["1", "2"]


def test_other_users_same_target_is_not_a_collision() -> None:
    """唯一约束按 (user_id, pattern, tool_name) ⇒ 别的用户同形态不得误跳。"""
    legacy = row("1", "u1", "read_file", f"doom_loop:read_file:{PLAIN_TAIL}")
    other = row("2", "u2", "read_file", expected_new(PLAIN_TAIL))
    plan = mod.finalize_plan(mod.analyze([legacy]), [other])
    assert [r.row_id for r, _ in plan.planned] == ["1"]
    assert plan.collide_with_existing == []


def test_different_tool_name_same_target_is_not_a_collision() -> None:
    legacy = row("1", "u1", "read_file", f"doom_loop:read_file:{PLAIN_TAIL}")
    other = row("2", "u1", "write_file", expected_new(PLAIN_TAIL))
    plan = mod.finalize_plan(mod.analyze([legacy]), [other])
    assert [r.row_id for r, _ in plan.planned] == ["1"]


def test_build_updates_carries_old_pattern_as_cas_condition() -> None:
    legacy = row("1", "u1", "read_file", f"doom_loop:read_file:{PLAIN_TAIL}")
    plan = mod.finalize_plan(mod.analyze([legacy]), [])
    assert mod.build_updates(plan) == [("1", legacy.pattern, expected_new(PLAIN_TAIL))]


# ---------------------------------------------------------------------------
# DSN
# ---------------------------------------------------------------------------


def test_database_name_from_dsn_url_and_keyvalue() -> None:
    assert mod.database_name_from_dsn("postgresql://u:p@127.0.0.1:8810/ihui") == "ihui"
    assert mod.database_name_from_dsn("postgresql://u:p@h:5432/ihui?sslmode=disable") == "ihui"
    assert mod.database_name_from_dsn("host=127.0.0.1 dbname=ihui_prod user=x") == "ihui_prod"
    assert mod.database_name_from_dsn("host=127.0.0.1 dbname='quoted db'") == "quoted db"


@pytest.mark.parametrize(
    "dsn",
    ["", "   ", "postgresql://u:p@127.0.0.1:8810/", "host=127.0.0.1 user=x", "not a dsn at all"],
)
def test_database_name_from_dsn_failures_raise_dserror(dsn: str) -> None:
    with pytest.raises(mod.DsnError):
        mod.database_name_from_dsn(dsn)


def test_render_report_names_only_dbname_and_new_forms() -> None:
    """DSN 含口令 ⇒ 报告只准出现库名;明文样本一律不得进输出。"""
    plan = mod.Plan(
        planned=[(row("1", "u1", "read_file", f"doom_loop:read_file:{PLAIN_TAIL}"), expected_new(PLAIN_TAIL))],
        tool_counts={"read_file": 1},
    )
    joined = "\n".join(mod.render_report("ihui", 5, 1, plan, 3, 10))
    assert "ihui" in joined
    assert "p@127" not in joined and "password" not in joined.lower()
    assert "secret.txt" not in joined and "redacted-" in joined


# ---------------------------------------------------------------------------
# 端到端(假件)
# ---------------------------------------------------------------------------


async def test_dry_run_writes_nothing_and_reports_counts(capsys: pytest.CaptureFixture[str]) -> None:
    store = make_store(BASE_ROWS)
    before = copy.deepcopy(store.rows)
    rc = await mod.amain(
        args_for(["--dry-run", "--dsn", DSN]),
        store_opener=_opener(store),
        confirm_fn=_refuse,
    )
    assert rc == 0
    assert store.rows == before, "dry-run 必须零写盘"
    assert store.applied == 0
    assert store.closed is True
    out = capsys.readouterr().out
    assert "待改写命中行数         : 2" in out
    assert "已安全形态跳过         : 2" in out
    assert "read_file: 1" in out and "run_command: 1" in out
    assert "本轮是 dry-run" in out


async def test_output_never_contains_plaintext(capsys: pytest.CaptureFixture[str]) -> None:
    store = make_store(BASE_ROWS)
    await mod.amain(
        args_for(["--apply", "--confirm", mod.CONFIRM_TOKEN, "--dsn", DSN]),
        store_opener=_opener(store),
        confirm_fn=lambda _db: True,
    )
    captured = capsys.readouterr()
    text = captured.out + captured.err
    for fragment in ("secret.txt", "id_rsa", "李春川", "rm -rf", PLAIN_TAIL, PLAIN_TAIL_2):
        assert fragment not in text, f"输出泄漏了原文片段 {fragment!r}"
    assert "redacted-" in text, "至少要能看到脱敏后形态"


async def test_apply_writes_only_planned_rows(capsys: pytest.CaptureFixture[str]) -> None:
    store = make_store(BASE_ROWS)
    rc = await mod.amain(
        args_for(["--apply", "--confirm", mod.CONFIRM_TOKEN, "--dsn", DSN]),
        store_opener=_opener(store),
        confirm_fn=lambda db: db == "ihui",
    )
    assert rc == 0
    assert store.applied == 2
    by_id = {r.row_id: r.pattern for r in store.rows}
    assert by_id["1"] == expected_new(PLAIN_TAIL)
    assert by_id["2"] == expected_new(PLAIN_TAIL_2, tool="run_command")
    assert by_id["3"] == f"doom_loop:read_file:{'b' * 64}"
    assert by_id["4"] == "doom_loop:read_file:redacted-ffffffffffffffff"
    assert "已改写 2 行" in capsys.readouterr().out


async def test_second_run_is_idempotent_zero_updates(capsys: pytest.CaptureFixture[str]) -> None:
    store = make_store(BASE_ROWS)
    apply_args = args_for(["--apply", "--confirm", mod.CONFIRM_TOKEN, "--dsn", DSN])
    assert await mod.amain(apply_args, store_opener=_opener(store), confirm_fn=lambda _d: True) == 0
    rows_after_first = copy.deepcopy(store.rows)
    capsys.readouterr()

    rc = await mod.amain(
        args_for(["--dry-run", "--dsn", DSN]),
        store_opener=_opener(store),
        confirm_fn=_refuse,
    )
    assert rc == 0
    assert "待改写命中行数         : 0" in capsys.readouterr().out
    assert store.rows == rows_after_first

    assert await mod.amain(apply_args, store_opener=_opener(store), confirm_fn=lambda _d: True) == 0
    assert store.applied == 2, "第二次 apply 不得再写任何行"
    assert store.rows == rows_after_first, "幂等:第二次零行数变化"


async def test_colliding_row_is_skipped_and_counted_not_crashed(
    capsys: pytest.CaptureFixture[str],
) -> None:
    new_form = expected_new(PLAIN_TAIL)
    store = make_store(
        [
            row("1", "u1", "read_file", f"doom_loop:read_file:{PLAIN_TAIL}"),
            row("2", "u1", "read_file", new_form),
            row("3", "u2", "read_file", f"doom_loop:read_file:{PLAIN_TAIL_2}"),
        ]
    )
    rc = await mod.amain(
        args_for(["--apply", "--confirm", mod.CONFIRM_TOKEN, "--dsn", DSN]),
        store_opener=_opener(store),
        confirm_fn=lambda _db: True,
    )
    out = capsys.readouterr().out
    assert rc == 0
    assert store.applied == 1, "只有不撞键的第 3 行可写"
    assert "撞唯一约束·与既有行    : 1" in out
    assert "撞键行点名" in out and "id=1" in out
    assert {r.row_id: r.pattern for r in store.rows}["2"] == new_form, "既有行不得被顶掉"


async def test_apply_without_token_refuses_before_touching_store() -> None:
    opened = {"n": 0}

    async def opener() -> Any:
        opened["n"] += 1
        return make_store([])

    assert await mod.amain(args_for(["--apply", "--dsn", DSN]), store_opener=opener, confirm_fn=lambda _d: True) == 1
    assert await mod.amain(
        args_for(["--apply", "--confirm", "WRONG-TOKEN", "--dsn", DSN]),
        store_opener=opener,
        confirm_fn=lambda _d: True,
    ) == 1
    assert opened["n"] == 0, "令牌不对却已经连库 ⇒ 确认必须发生在任何连接之前"


async def test_apply_refused_by_second_confirmation_writes_nothing() -> None:
    store = make_store(BASE_ROWS)
    before = copy.deepcopy(store.rows)
    rc = await mod.amain(
        args_for(["--apply", "--confirm", mod.CONFIRM_TOKEN, "--dsn", DSN]),
        store_opener=_opener(store),
        confirm_fn=lambda _db: False,
    )
    assert rc == 1
    assert store.rows == before
    assert store.applied == 0


async def test_write_anomaly_rolls_back_and_exits_nonzero(capsys: pytest.CaptureFixture[str]) -> None:
    store = make_store(BASE_ROWS, anomaly_on_index=1)
    before = copy.deepcopy(store.rows)
    rc = await mod.amain(
        args_for(["--apply", "--confirm", mod.CONFIRM_TOKEN, "--dsn", DSN]),
        store_opener=_opener(store),
        confirm_fn=lambda _db: True,
    )
    assert rc == 1
    assert store.rolled_back is True
    assert store.rows == before, "整事务回滚后不得留下半改写的行"
    assert "回滚" in capsys.readouterr().err


@pytest.mark.parametrize(
    "kwargs,expect",
    [
        ({"table_exists": False}, "不存在"),
        ({"columns": ["id", "user_id", "pattern"]}, "列名不符预期"),
        ({"unique_ok": False}, "唯一索引"),
    ],
)
async def test_schema_mismatch_is_undetermined_not_zero_rows(
    capsys: pytest.CaptureFixture[str], kwargs: dict[str, Any], expect: str
) -> None:
    store = make_store(BASE_ROWS, **kwargs)
    rc = await mod.amain(
        args_for(["--dry-run", "--dsn", DSN]),
        store_opener=_opener(store),
        confirm_fn=_refuse,
    )
    err = capsys.readouterr().err
    assert rc == 2, "库结构判不出来必须非零退出,不得把无法判定记成扫过了"
    assert "无法判定" in err
    assert expect in err
    assert store.prefixed_fetches == 0, "前提不成立时不该再扫行"


async def test_no_database_exits_2_and_does_not_claim_zero_rows(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """本票唯一能在本机验证的档位:没有 PG 时必须喊无法判定,而不是打一句 0 行。"""

    async def failing_opener() -> Any:
        raise ConnectionError("模拟:8810 无监听")

    rc = await mod.amain(
        args_for(["--dry-run", "--dsn", DSN]),
        store_opener=failing_opener,
        confirm_fn=_refuse,
    )
    captured = capsys.readouterr()
    assert rc == 2
    assert "无法判定" in captured.err
    assert "待改写命中行数" not in captured.out, "连不上库却输出命中数 = 把没扫当成扫过"


async def test_missing_dsn_is_undetermined(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], env_clean: None
) -> None:
    def boom(_args: Any) -> str:
        raise mod.DsnError("DSN 未配置:三处都拿不到")

    monkeypatch.setattr(mod, "resolve_dsn", boom)
    rc = await mod.amain(
        args_for(["--dry-run"]),
        store_opener=_opener(make_store([])),
        confirm_fn=_refuse,
    )
    assert rc == 2
    assert "DSN" in capsys.readouterr().err


def test_default_mode_is_dry_run() -> None:
    assert args_for([]).apply is False
    assert args_for(["--dry-run"]).apply is False
    assert args_for(["--apply"]).apply is True


def test_required_columns_match_the_actual_schema_source() -> None:
    """列名前提要对着 schema 现读复核 —— 否则脚本要求的列与真表漂移而无人喊。"""
    schema_ts = (
        Path(__file__).resolve().parents[3] / "packages" / "database" / "src" / "schema" / "memory.ts"
    ).read_text(encoding="utf-8")
    block = schema_ts.split("agentMemoryProcedural", 1)[1].split("export type", 1)[0]
    assert "agent_memory_procedural" in block
    for col in sorted(mod.REQUIRED_COLUMNS):
        assert f"'{col}'" in block, f"脚本要求列 {col} 而 schema 里没有"


def test_module_exposes_the_confirm_token_constant() -> None:
    """令牌写死在脚本里并被 --help 点名:改掉常量必须让测试跟着动。"""
    assert mod.CONFIRM_TOKEN == "REDACT-LEGACY-PATTERNS"


def test_test_module_locks_the_real_connection_door() -> None:
    """autouse 夹具是唯一的真连接防线:它不在位,上面所有隔离断言就都是空的。"""
    assert "open_store" in dir(mod)
    src = Path(__file__).read_text(encoding="utf-8")
    assert "_forbid_real_connections" in src and "autouse=True" in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
