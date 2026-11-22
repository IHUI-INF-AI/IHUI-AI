# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""一次性清理工具:`agent_memory_procedural` 历史遗留明文 doom_loop pattern 就地脱敏。

背景(已实测的链路,动手前请自行复核):
  1. 缺陷源头已修 —— `apps/cli/src/doom-loop-detector.ts` 的 `hashInput()` 现返回
     sha256 hex(HEAD 面实测 `createHash('sha256')…digest('hex')`);它过去返回
     `JSON.stringify(整个工具入参)`,即**明文**(文件路径 / 文件正文 / 命令行原文)。
  2. 写入落点 —— `apps/cli/src/commands/agent.ts` 拼 `doom_loop:<toolName>:<inputHash>`
     POST `/api/memory/procedural` → `apps/ai-service/app/api/memory.py` 的
     `save_procedural` → `apps/ai-service/app/services/memory_service.py:547 add_procedural`
     (`ON CONFLICT (user_id, pattern, tool_name)` upsert)。⇒ **这张表的写入方只有
     ai-service(Python)**,apps/api 侧只在 `purge-user-pii.ts` 按 user_id 整行删除,
     没有任何"改写 pattern"的路径,所以本工具落在 `apps/ai-service/scripts/`,只此一份。
  3. 召回侧不按 pattern 匹配 —— 全仓 `pattern` 在 procedural 这条线上只有
     ①请求体写入 ②`list_procedural` 列表返回 ③`active_forgetter.py:63` 把它当
     展示/去重列名 ④`metacognition.py` 的"同 tool_name 不同 pattern"冲突判定
     (比较两行的值,不匹配固定串)。⇒ **改写 pattern 不打断任何功能**,代价只是旧的
     失败计数与新行分成两条。

本工具做什么:把 `doom_loop:<tool>:<旧明文尾>` 改写为
`doom_loop:<tool>:redacted-<sha256(旧尾)[:16]>`。只做 UPDATE,绝不 DELETE/DROP
(AGENTS.md §7 删除安全;删用户记忆行不属本票授权范围)。

安全设计(不可动摇):
  * **默认 dry-run,零写盘**。要写必须同时给 `--apply` 与 `--confirm
    REDACT-LEGACY-PATTERNS`,并在终端里**再答一次当前 DSN 的库名**。
    这是多会话共享的生产库,误 `--apply` 不可回滚。
  * **绝不打印任何原文样本** —— 一个量明文的工具自己把明文打到终端,等于把同一个
    缺陷搬进日志。样本只打印 `id / tool_name / 脱敏后形态`。
  * 已经长成 `redacted-` 或 64 位 hex 的行**跳过**(幂等:跑第二次零 UPDATE)。
  * 唯一约束 `(user_id, pattern, tool_name)` 下改写可能与既有行撞键:dry-run 先把
    "改写后会撞唯一约束的行数"算出来并点名,`--apply` 撞键行**跳过并计数**,
    不靠捕获异常硬扛后静默。
  * 判不出来就喊:表不存在 / 列名不符预期 / 缺唯一索引 / DSN 解析失败 / 连不上库
    ⇒ 明确报错 + 退出码 2,**绝不把"0 行"当成功**。

退出码:0 = 判定完成(dry-run 有发现也算完成) / 1 = 改写被拒绝或写入异常(已回滚) /
2 = 无法判定(连不上、库结构不符、DSN 解析失败)。

在部署机上怎么跑:
    cd G:/IHUI-AI/apps/ai-service
    # ① 先看数字(零写盘)
    ./.venv/Scripts/python.exe scripts/redact_legacy_procedural_patterns.py --dry-run
    # ② 数字对得上预期(并且 apps/cli 的 hashInput 修复已部署,否则清了还会再长明文)
    # ③ 才谈写
    ./.venv/Scripts/python.exe scripts/redact_legacy_procedural_patterns.py \
        --apply --confirm REDACT-LEGACY-PATTERNS
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import os
import re
import sys
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Protocol
from urllib.parse import unquote, urlsplit

if TYPE_CHECKING:
    import asyncpg

TABLE = "agent_memory_procedural"
PATTERN_PREFIX = "doom_loop:"
REDACTED_MARK = "redacted-"
CONFIRM_TOKEN = "REDACT-LEGACY-PATTERNS"
HASH_PREFIX_LEN = 16
SAMPLE_LIMIT_DEFAULT = 3
NAMED_COLLISION_LIMIT_DEFAULT = 10
CONNECT_TIMEOUT_SEC = 8.0

# 64 位 hex = hashInput 修复后的新形态(已是摘要,不含明文),必须跳过。
HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
# LIKE 里的 `_` 是单字符通配,必须转义,否则 doomXloop: 也会被扫进来。
ESCAPED_PREFIX_LIKE = r"doom\_loop:%"
REQUIRED_COLUMNS = frozenset({"id", "user_id", "pattern", "tool_name", "updated_at"})
_SELECT_COLS = (
    "id::text AS id, user_id::text AS user_id, "
    "COALESCE(tool_name, '')::text AS tool_name, pattern"
)


class DsnError(RuntimeError):
    """DSN 拿不到 / 解析不出库名 —— 属"无法判定",不是"0 行"。"""


class SchemaError(RuntimeError):
    """库结构不符合本工具判据的前提(表缺失 / 列名漂移 / 唯一索引不见)。"""


class WriteAnomaly(RuntimeError):
    """单事务改写里任一行没按预期命中 —— 整体回滚,绝不部分落盘后继续。"""


# ---------------------------------------------------------------------------
# 纯函数判据(不碰库,测试直接打这几个)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RowSnapshot:
    """一行 procedural 的最小投影 —— 刻意不含 metadata/正文,判据只吃 pattern。"""

    row_id: str
    user_id: str
    tool_name: str
    pattern: str


@dataclass(frozen=True)
class Triple:
    """唯一约束 `(user_id, pattern, tool_name)` 的内存形态。"""

    user_id: str
    pattern: str
    tool_name: str


def split_pattern(pattern: str) -> tuple[str, str] | None:
    """拆 `doom_loop:<tool>:<尾>`;不是这个形态返回 None(计入畸形,不猜)。

    尾段按**第一个之后的冒号**切:`partition` 只切一次,所以 JSON 明文里的冒号
    (`{"path":"G:/x"}`)整段落进尾段,不会被切碎。
    """
    if not pattern.startswith(PATTERN_PREFIX):
        return None
    tool, sep, tail = pattern[len(PATTERN_PREFIX) :].partition(":")
    if not sep or not tool:
        return None
    return tool, tail


def is_tail_already_safe(tail: str) -> bool:
    """已经是 `redacted-…` 或 64 位 hex ⇒ 这行不含明文,必须跳过(幂等的根)。

    只判"存在"不判"值对"是本仓踩过的型(`幂等守卫只判存在于是冻结了冗余`),
    所以这里两条各自写明:前者是我们产出的形态,后者是 hashInput 修复后的新形态。
    """
    if tail.startswith(REDACTED_MARK):
        return True
    return bool(HEX64_RE.match(tail))


def redact_tail(tail: str) -> str:
    """`sha256(旧尾)` 前 16 位十六进制,带 `redacted-` 标记。"""
    digest = hashlib.sha256(tail.encode("utf-8")).hexdigest()
    return f"{REDACTED_MARK}{digest[:HASH_PREFIX_LEN]}"


def build_new_pattern(tool: str, tail: str) -> str:
    return f"{PATTERN_PREFIX}{tool}:{redact_tail(tail)}"


@dataclass
class Analysis:
    """第一遍:把候选行分成"可改写 / 已安全 / 畸形"三堆,并按 tool_name 计数。"""

    targets: list[tuple[RowSnapshot, str]] = field(default_factory=list)
    safe_skipped: int = 0
    malformed_skipped: int = 0
    tool_counts: dict[str, int] = field(default_factory=dict)


def analyze(rows: list[RowSnapshot]) -> Analysis:
    out = Analysis()
    for row in rows:
        parsed = split_pattern(row.pattern)
        if parsed is None:
            out.malformed_skipped += 1
            continue
        tool, tail = parsed
        if is_tail_already_safe(tail):
            out.safe_skipped += 1
            continue
        out.targets.append((row, build_new_pattern(tool, tail)))
        key = row.tool_name if row.tool_name else "(空)"
        out.tool_counts[key] = out.tool_counts.get(key, 0) + 1
    return out


@dataclass
class Plan:
    """第二遍:算完撞唯一约束之后的最终计划。"""

    planned: list[tuple[RowSnapshot, str]] = field(default_factory=list)
    collide_with_existing: list[tuple[RowSnapshot, str]] = field(default_factory=list)
    collide_within_candidates: list[tuple[RowSnapshot, str]] = field(default_factory=list)
    safe_skipped: int = 0
    malformed_skipped: int = 0
    tool_counts: dict[str, int] = field(default_factory=dict)
    rows_scanned: int = 0


def finalize_plan(analysis: Analysis, other_rows: list[RowSnapshot]) -> Plan:
    """撞键判定分两型,都必须**先算后跳**,不得靠捕获唯一约束异常后静默:

    A. 目标三元组已被**非候选行**占用(库里已存在一条同 user/tool 且 pattern 正好等于
       我们要写的新形态)⇒ 本行跳过。
    B. 两条候选行映射到同一目标三元组(sha256 截断到 16 位后撞车)⇒ 两条都跳过 ——
       机器无从选择该留哪条,选任何一条都是猜。
    """
    plan = Plan(
        safe_skipped=analysis.safe_skipped,
        malformed_skipped=analysis.malformed_skipped,
        tool_counts=dict(analysis.tool_counts),
    )
    candidate_ids = {row.row_id for row, _ in analysis.targets}
    occupied: set[Triple] = {
        Triple(r.user_id, r.pattern, r.tool_name)
        for r in other_rows
        if r.row_id not in candidate_ids
    }
    contributions: dict[Triple, int] = {}
    for row, new_pattern in analysis.targets:
        triple = Triple(row.user_id, new_pattern, row.tool_name)
        contributions[triple] = contributions.get(triple, 0) + 1
    for row, new_pattern in analysis.targets:
        triple = Triple(row.user_id, new_pattern, row.tool_name)
        if triple in occupied:
            plan.collide_with_existing.append((row, new_pattern))
        elif contributions[triple] > 1:
            plan.collide_within_candidates.append((row, new_pattern))
        else:
            plan.planned.append((row, new_pattern))
    return plan


def build_updates(plan: Plan) -> list[tuple[str, str, str]]:
    """(row_id, 旧 pattern 作 CAS 条件, 新 pattern) —— 旧值只进参数,绝不进输出。"""
    return [(row.row_id, row.pattern, new_pattern) for row, new_pattern in plan.planned]


# ---------------------------------------------------------------------------
# 存储层(真实实现 = asyncpg;测试实现 = 内存假件,绝不派生真连接)
# ---------------------------------------------------------------------------


@dataclass
class SchemaReport:
    table_exists: bool
    columns: frozenset[str]
    unique_index_ok: bool


class ProceduralStore(Protocol):
    async def schema_report(self) -> SchemaReport: ...

    async def count_rows(self) -> tuple[int, int]: ...

    async def fetch_prefixed_rows(self) -> list[RowSnapshot]: ...

    async def fetch_rows_by_patterns(self, patterns: list[str]) -> list[RowSnapshot]: ...

    async def apply_updates(self, updates: list[tuple[str, str, str]]) -> int: ...

    async def close(self) -> None: ...


def database_name_from_dsn(dsn: str) -> str:
    """从 DSN 取库名(只取名 —— DSN 含口令,整串绝不打印)。"""
    text = dsn.strip()
    if not text:
        raise DsnError("DSN 为空:--dsn / 环境变量 DATABASE_URL / app 配置三处都拿不到")
    if "://" in text:
        name = unquote(urlsplit(text).path).lstrip("/").split("?")[0].strip()
        if not name:
            raise DsnError(f"DSN 形如 URL 但路径里没有库名(协议 {urlsplit(text).scheme})")
        return name
    match = re.search(r"(?:^|\s)dbname=(?:'([^']*)'|(\S+))", text)
    if match:
        name = (match.group(1) or match.group(2) or "").strip()
        if name:
            return name
    raise DsnError("DSN 既不是 URL 形态也没有 dbname= 键值:无法判定库名,拒绝继续")


def resolve_dsn(args: argparse.Namespace) -> str:
    if args.dsn:
        return str(args.dsn)
    env = os.environ.get("DATABASE_URL", "").strip()
    if env:
        return env
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from app.core.config import settings  # noqa: E402

        value = str(settings.database_url or "").strip()
        if value:
            return value
    except Exception as e:  # 配置层坏了也要喊,不得静默回落到"没连上"
        raise DsnError(f"读取 app.core.config.settings.database_url 失败:{e}") from e
    raise DsnError("DSN 未配置:请传 --dsn 或设置 DATABASE_URL")


def _to_snapshot(row: asyncpg.Record) -> RowSnapshot:
    return RowSnapshot(
        row_id=str(row["id"]),
        user_id=str(row["user_id"]),
        tool_name=str(row["tool_name"] or ""),
        pattern=str(row["pattern"]),
    )


class AsyncpgStore:
    """真连接。只在 `open_store()` 里被创建 —— 测试永远不走到这一层。"""

    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def schema_report(self) -> SchemaReport:
        col_rows = await self._conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
            TABLE,
        )
        columns = frozenset(str(r["column_name"]) for r in col_rows)
        idx_rows = await self._conn.fetch(
            "SELECT indexdef FROM pg_indexes WHERE tablename = $1", TABLE
        )
        unique_ok = False
        for r in idx_rows:
            definition = str(r["indexdef"])
            if "UNIQUE" in definition.upper() and all(
                col in definition for col in ("user_id", "pattern", "tool_name")
            ):
                unique_ok = True
                break
        return SchemaReport(
            table_exists=bool(columns), columns=columns, unique_index_ok=unique_ok
        )

    async def count_rows(self) -> tuple[int, int]:
        total = await self._conn.fetchval(f"SELECT count(*) FROM {TABLE}")
        prefixed = await self._conn.fetchval(
            f"SELECT count(*) FROM {TABLE} WHERE pattern LIKE $1 ESCAPE '\\'",
            ESCAPED_PREFIX_LIKE,
        )
        return int(total or 0), int(prefixed or 0)

    async def fetch_prefixed_rows(self) -> list[RowSnapshot]:
        rows = await self._conn.fetch(
            f"SELECT {_SELECT_COLS} FROM {TABLE} "
            f"WHERE pattern LIKE $1 ESCAPE '\\' ORDER BY id",
            ESCAPED_PREFIX_LIKE,
        )
        return [_to_snapshot(r) for r in rows]

    async def fetch_rows_by_patterns(self, patterns: list[str]) -> list[RowSnapshot]:
        if not patterns:
            return []
        rows = await self._conn.fetch(
            f"SELECT {_SELECT_COLS} FROM {TABLE} WHERE pattern = ANY($1::text[]) ORDER BY id",
            list(patterns),
        )
        return [_to_snapshot(r) for r in rows]

    async def apply_updates(self, updates: list[tuple[str, str, str]]) -> int:
        if not updates:
            return 0
        applied = 0
        # 单事务:任何一行没按 CAS 命中就整体回滚,绝不留下"改了一半"的库面。
        async with self._conn.transaction():
            for row_id, expected_pattern, new_pattern in updates:
                got = await self._conn.fetch(
                    f"UPDATE {TABLE} SET pattern = $2, updated_at = NOW() "
                    "WHERE id = $1::uuid AND pattern = $3 RETURNING id",
                    row_id,
                    new_pattern,
                    expected_pattern,
                )
                if len(got) != 1:
                    raise WriteAnomaly(
                        f"id={row_id} 的 CAS 未命中(该行在我们读过后被别人改过,或已被改写)"
                    )
                applied += 1
        return applied

    async def close(self) -> None:
        await self._conn.close()


async def open_store(dsn: str, timeout_sec: float = CONNECT_TIMEOUT_SEC) -> ProceduralStore:
    import asyncpg

    try:
        conn = await asyncpg.connect(dsn=dsn, timeout=timeout_sec)
    except Exception as e:  # 连不上 = 无法判定,不得降级成"扫到 0 行"
        raise ConnectionError(f"连不上目标库:{type(e).__name__}: {e}") from e
    return AsyncpgStore(conn)


# ---------------------------------------------------------------------------
# 报告输出(只报数与脱敏后形态)
# ---------------------------------------------------------------------------


def render_report(
    db_name: str,
    total_rows: int,
    prefixed_rows: int,
    plan: Plan,
    samples: int,
    named_limit: int,
) -> list[str]:
    lines = [
        f"当前 DSN 指向库名 = {db_name}(口令不回显)",
        f"表 {TABLE} 总行数        : {total_rows}",
        f"其中 doom_loop 前缀行  : {prefixed_rows}",
        f"已安全形态跳过         : {plan.safe_skipped}(redacted- / 64 位 hex)",
        f"畸形形态跳过(判不出) : {plan.malformed_skipped}(非 doom_loop:tool:tail 三段)",
        f"待改写命中行数         : {len(plan.planned)}",
        f"撞唯一约束·与既有行    : {len(plan.collide_with_existing)}(apply 时跳过并计数)",
        f"撞唯一约束·候选互撞    : {len(plan.collide_within_candidates)}(两条都跳过,不猜留哪条)",
        f"非 doom_loop 前缀行    : {total_rows - prefixed_rows}(不在本工具射程,见"
        "「本工具判不出的东西」)",
        "",
        "按 tool_name 分组的命中计数(取 tool_name 列,空值归 (空)):",
    ]
    if plan.tool_counts:
        for tool_name, count in sorted(plan.tool_counts.items(), key=lambda kv: (-kv[1], kv[0])):
            lines.append(f"  {tool_name}: {count}")
    else:
        lines.append("  (无命中)")
    lines.append("")
    lines.append(f"脱敏后形态样本(最多 {samples} 条;绝不打印原文,只打 id / tool_name / 新形态):")
    if plan.planned:
        for row, new_pattern in plan.planned[:samples]:
            lines.append(
                f"  - id={row.row_id} user_id={row.user_id} tool_name="
                f"{row.tool_name or '(空)'} -> {new_pattern}"
            )
    else:
        lines.append("  (无可改写命中)")
    collisions = plan.collide_with_existing + plan.collide_within_candidates
    if collisions:
        lines.append("")
        lines.append(f"撞键行点名(前 {named_limit} 条):")
        for row, new_pattern in collisions[:named_limit]:
            kind = "既有行" if (row, new_pattern) in plan.collide_with_existing else "候选互撞"
            lines.append(
                f"  - [{kind}] id={row.row_id} user_id={row.user_id} "
                f"tool_name={row.tool_name or '(空)'} -> {new_pattern}"
            )
        if len(collisions) > named_limit:
            lines.append(f"  …另有 {len(collisions) - named_limit} 条未点名")
    return lines


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def interactive_confirm_db_name(db_name: str) -> bool:
    """把库名再答一次。非交互终端一律拒绝 —— 少了这一道,--apply 就只是一次手滑。"""
    try:
        if not sys.stdin.isatty():
            print(
                "❌ 拒绝写入:stdin 不是交互终端,无法完成「再答一次库名」这道确认。"
                "请在部署机的交互式终端里手动跑。",
                file=sys.stderr,
            )
            return False
    except (ValueError, OSError) as e:
        print(f"❌ 拒绝写入:stdin 不可读({e})", file=sys.stderr)
        return False
    print(f'当前 DSN 指向库名 = "{db_name}";请再输入一次该库名以确认(其他任何输入即放弃):')
    answer = sys.stdin.readline().strip()
    if answer != db_name:
        print("❌ 库名不匹配,放弃写入(零改动)。", file=sys.stderr)
        return False
    return True


async def run_plan(
    store: ProceduralStore,
    args: argparse.Namespace,
    db_name: str,
) -> Plan:
    schema = await store.schema_report()
    if not schema.table_exists:
        raise SchemaError(f"表 {TABLE} 不存在(或当前账号看不见它)—— 无法判定,不做任何写")
    missing = sorted(REQUIRED_COLUMNS - schema.columns)
    if missing:
        raise SchemaError(f"表 {TABLE} 列名不符预期,缺 {missing} —— 判据前提不成立")
    if not schema.unique_index_ok:
        raise SchemaError(
            f"表 {TABLE} 上找不到 (user_id, pattern, tool_name) 唯一索引 —— "
            "撞键判定依赖它,拒绝在看不见约束的库上改写"
        )
    total_rows, prefixed_rows = await store.count_rows()
    rows = await store.fetch_prefixed_rows()
    analysis = analyze(rows)
    target_patterns = sorted({new_pattern for _, new_pattern in analysis.targets})
    other_rows = await store.fetch_rows_by_patterns(target_patterns)
    plan = finalize_plan(analysis, other_rows)
    for line in render_report(
        db_name, total_rows, prefixed_rows, plan, args.samples, args.max_named
    ):
        print(line)
    return plan


async def execute(
    args: argparse.Namespace,
    store: ProceduralStore,
    db_name: str,
    confirm_fn: Callable[[str], bool],
) -> int:
    try:
        plan = await run_plan(store, args, db_name)
    except (SchemaError, ConnectionError) as e:
        print(f"❌ 无法判定:{e}", file=sys.stderr)
        return 2
    if not args.apply:
        print("")
        print("本轮是 dry-run:未发出任何 UPDATE。")
        if plan.planned or plan.collide_with_existing or plan.collide_within_candidates:
            print(f"要落盘请跑 --apply --confirm {CONFIRM_TOKEN}(并再答一次库名)。")
        return 0
    if not confirm_fn(db_name):
        return 1
    updates = build_updates(plan)
    if not updates:
        print("")
        print("本轮没有可写的行(命中 0)—— 未发出任何 UPDATE。幂等复跑应正是这个结果。")
        return 0
    try:
        applied = await store.apply_updates(updates)
    except WriteAnomaly as e:
        print(f"❌ 写入异常,整事务已回滚(库面零改动,请重跑 dry-run 看新状态):{e}", file=sys.stderr)
        return 1
    print("")
    print(f"✅ 已改写 {applied} 行(计划 {len(updates)} 行,撞键跳过 "
          f"{len(plan.collide_with_existing) + len(plan.collide_within_candidates)} 行)。")
    print("请再跑一次 --dry-run 复核:待改写命中行数应为 0。")
    return 0


async def amain(
    args: argparse.Namespace,
    store_opener: Callable[[], Awaitable[ProceduralStore]] | None = None,
    confirm_fn: Callable[[str], bool] | None = None,
) -> int:
    opener = store_opener or (lambda: open_store(resolve_dsn(args)))
    confirmer = confirm_fn or interactive_confirm_db_name
    if args.apply and args.confirm != CONFIRM_TOKEN:
        print(
            f"❌ 拒绝写入:--apply 必须同时给 --confirm {CONFIRM_TOKEN}"
            "(令牌不对或被省略 ⇒ 零改动)。",
            file=sys.stderr,
        )
        return 1
    try:
        dsn = resolve_dsn(args)
    except DsnError as e:
        print(f"❌ 无法判定:{e}", file=sys.stderr)
        return 2
    try:
        db_name = database_name_from_dsn(dsn)
    except DsnError as e:
        print(f"❌ 无法判定:{e}", file=sys.stderr)
        return 2
    try:
        store = await opener()
    except (ConnectionError, OSError, TimeoutError) as e:
        print(
            f"❌ 无法判定:连不上库({type(e).__name__})。这不是「扫到 0 行」,"
            "本工具在没有读到真实表面时不出具任何结论。",
            file=sys.stderr,
        )
        print(f"   原因:{e}", file=sys.stderr)
        return 2
    try:
        return await execute(args, store, db_name, confirmer)
    finally:
        await store.close()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "把 agent_memory_procedural 里历史遗留的明文 doom_loop pattern 就地脱敏"
            "(只 UPDATE,不 DELETE)。默认 dry-run,零写盘。"
        )
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        dest="apply",
        action="store_false",
        help="默认档:只量数、只报形态,绝不写盘。",
    )
    mode.add_argument(
        "--apply",
        dest="apply",
        action="store_true",
        help=f"写盘档:必须同时给 --confirm {CONFIRM_TOKEN} 并在终端再答一次库名。",
    )
    parser.add_argument("--dsn", default="", help="目标库 DSN;缺省读 DATABASE_URL 再回落 app 配置。")
    parser.add_argument("--confirm", default="", help=f"写入令牌:{CONFIRM_TOKEN}。")
    parser.add_argument(
        "--samples",
        type=int,
        default=SAMPLE_LIMIT_DEFAULT,
        help="脱敏后形态样本条数(默认 3;原文一条都不打)。",
    )
    parser.add_argument(
        "--max-named",
        type=int,
        default=NAMED_COLLISION_LIMIT_DEFAULT,
        help="撞键点名条数上限(计数不受它影响)。",
    )
    parser.set_defaults(apply=False)
    args = parser.parse_args(argv)
    if args.samples < 0:
        parser.error("--samples 不得为负")
    if args.max_named < 0:
        parser.error("--max-named 不得为负")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(list(sys.argv[1:] if argv is None else argv))
    return asyncio.run(amain(args))


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
