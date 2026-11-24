# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""working memory 属主的**幂等回填器**(2026-09-28;机主拍板「写侧补属主 + 回填再收紧」第二步)。

背景(现读事实,动手前不必再发现一遍):
  * 写侧已于本票补上属主 —— `app/services/memory_service.py::add_working(owner=…)` 在
    `_working_lock` **之内**把 `userId` 烘进条目。**收口之前写进桶的存量条目没有这个键**,
    而读侧判据 `entry_visible_to` 对无主条目「维持改动前行为」(见该函数分支 2 的注释),
    所以不回填 = 那批桶永远停在「任何人都能读」的回退档上。
  * session↔owner 的**唯一权威来源** = `agent_memory_episodic(session_id, user_id)`
    (packages/database/src/schema/memory.ts:82-101;`user_id` 是 notNull 的 uuid 列)。
    它只覆盖「写过 episodic 的会话」,覆盖不到的(纯 working 桶)按定义**推不出 owner**。
  * `session_store` 的 threads 是**另一个 id 命名空间**、且没有 user_id 列(属主只活在
    metadata JSON 里)⇒ 不得拿来当权威:那等于把一份不相关的表当授权凭据。

判据三条,每一条都是「推不出就不落」:
  1. 只对**桶当前存在**且权威侧**恰好一个** user_id 的 session 落 owner;
  2. 权威侧查不到行 ⇒ `no_evidence`;查到 ≥2 个不同 user_id ⇒ `ambiguous`。两种都
     **保持无主并如实计数**,绝不挑一个 —— 挑出来的「属主」会把一次合法读取永久判成
     越权,比无主更糟;两个 kind 也**不并桶**(前者是「库里没记」,后者是「数据本身
     矛盾、要人看」,合成一个「跳过」就把后者藏起来了);
  3. 条目**已有属主**一律不动(这是幂等的根:第二次跑 `entries_to_stamp` 必为 0);
     已有属主且与权威不同 ⇒ 计入 `entries_conflicting`,同样不动、只报数。

范围边界(不得读成「线上已回填」):working 桶是**进程内内存**(LRU 50,重启即空)。
  * 所以 CLI **拒绝** `--target service`:独立进程 import 到的 `memory_service` 只是这个
    CLI 自己那份空桶,在那里报「改了 0 条」会被读成「生产已回填」—— 一台永远绿的尺子。
    要给活进程回填,只能在**服务进程内**调 `apply_to_service(memory_service, authority)`;
    把它接到启动钩子是 §24 意义上的新能力,归持有人拍板,本票不接线(登记为未尽事项)。
  * CLI 的真实目标是 `--working-dir DIR`(一份 `working_buckets.json` 导出件),可在**临时
    目录**上完整演练(测试就是这么跑的),也可配 `--dsn` 打真库读权威。

安全设计:
  * **默认 dry-run,零写盘**;写盘必须同时给 `--apply` 与 `--confirm BACKFILL-WORKING-OWNER`。
  * 写盘前先落**快照**(`snapshot-<UTC>.json`),`--rollback <快照>` 整份还原;还原本身也先
    留一份快照(反悔的反悔仍可追)。只接受本工具产出的快照形态(带标记),否则**拒绝还原** ——
    拿一份来历不明的 JSON 去覆盖用户的会话缓冲,比不回填危险得多。
  * 权威侧拿不到(DB 连不上 / 表或列不在 / 映射文件读不出)、目标目录或导出件缺失 ⇒
    **exit 2 无法判定**,绝不把「0 条待回填」当结论。
  * 全程 SELECT 权威表,一个库面写入都没有;条目正文(content)不打印,只报 session 与计数。

退出码:0 = 判定完成(dry-run 有发现也算完成) / 1 = 写入被拒绝或写入异常(快照已在,可回滚) /
2 = 无法判定(权威不可达、目录或文件缺失、快照结构不符)。

手动入口:
    cd G:/IHUI-AI/apps/ai-service
    # ① 演练(零写盘)
    ./.venv/Scripts/python.exe scripts/backfill_working_owner.py --working-dir <DIR> --dsn "$DATABASE_URL"
    # ② 数字对得上预期后才谈写
    ./.venv/Scripts/python.exe scripts/backfill_working_owner.py --working-dir <DIR> --dsn "$DATABASE_URL" \
        --apply --confirm BACKFILL-WORKING-OWNER
    # ③ 反悔
    ./.venv/Scripts/python.exe scripts/backfill_working_owner.py --working-dir <DIR> \
        --rollback <DIR>/backfill-snapshots/snapshot-<...>.json --apply --confirm BACKFILL-WORKING-OWNER
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal, Protocol

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.memory_service import working_entry_owner  # noqa: E402

CONFIRM_TOKEN = "BACKFILL-WORKING-OWNER"
BUCKETS_FILENAME = "working_buckets.json"
SNAPSHOT_SUBDIR = "backfill-snapshots"
EPISODIC_TABLE = "agent_memory_episodic"
EVIDENCE_COLUMNS = frozenset({"session_id", "user_id"})
CONNECT_TIMEOUT_SEC = 8.0
NAMED_LIMIT_DEFAULT = 10
BATCH_SIZE = 500

EvidenceKind = Literal["unique", "no_evidence", "ambiguous"]


class AuthorityError(RuntimeError):
    """权威来源拿不到 ⇒ 无法判定(绝不退化成「0 条待回填」)。"""


class StoreError(RuntimeError):
    """目标桶数据读不出 / 结构不符 ⇒ 无法判定。"""


# ---------------------------------------------------------------------------
# 权威侧:session -> owner 的证据
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Evidence:
    """一个 session 在权威列上的归属证据。`kind` 是封闭集,不做布尔压缩。"""

    session_id: str
    kind: EvidenceKind
    user_id: str | None = None
    distinct_users: int = 0


def classify_evidence(
    session_id: str, distinct_users: int, sample_user_id: str | None
) -> Evidence:
    """「这个 session 在 episodic 里有几个不同 user_id」→ 三态,不猜。"""
    if distinct_users <= 0 or not sample_user_id:
        return Evidence(session_id, "no_evidence", None, max(0, distinct_users))
    if distinct_users > 1:
        return Evidence(session_id, "ambiguous", None, distinct_users)
    return Evidence(session_id, "unique", sample_user_id, 1)


class SessionOwnerAuthority(Protocol):
    """session→owner 权威来源的出口(DB 只是其中一个实现)。"""

    async def evidence_for(self, sessions: Sequence[str]) -> dict[str, Evidence]: ...

    async def close(self) -> None: ...


def chunked(items: Sequence[str], size: int = BATCH_SIZE) -> list[Sequence[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


class EpisodicDbAuthority:
    """`agent_memory_episodic` 的 (session_id, user_id) 列 —— 本票唯一权威。

    只读:回填目标是 working 桶,不是这张表,所以本工具对库零写入。
    """

    def __init__(self, conn: Any) -> None:  # asyncpg.Connection(由 open_db_authority 建)
        self._conn = conn

    async def evidence_for(self, sessions: Sequence[str]) -> dict[str, Evidence]:
        out: dict[str, Evidence] = {}
        for batch in chunked(list(sessions)):
            rows = await self._conn.fetch(
                f"""SELECT session_id,
                           COUNT(DISTINCT user_id)::int AS distinct_users,
                           MIN(user_id::text) AS sample_user
                      FROM {EPISODIC_TABLE}
                     WHERE session_id = ANY($1::text[])
                  GROUP BY session_id""",
                list(batch),
            )
            for row in rows:
                sid = str(row["session_id"])
                sample = str(row["sample_user"] or "") or None
                out[sid] = classify_evidence(sid, int(row["distinct_users"] or 0), sample)
        return out

    async def close(self) -> None:
        await self._conn.close()


class MappingAuthority:
    """离线演练用的权威:`session_id -> user_id`(或 `-> [user_id, …]` 演 ambiguous)。

    存在的理由不是方便:CLI 的写盘/快照/回滚三条路径必须能在**没有库**的临时目录上被
    真跑一遍(§5 测试隔离铁律不允许用例连生产 PG),而判据侧的三态分类两种实现共用同一份。
    """

    def __init__(self, raw: Mapping[str, Any]) -> None:
        self._raw = dict(raw)

    async def evidence_for(self, sessions: Sequence[str]) -> dict[str, Evidence]:
        out: dict[str, Evidence] = {}
        for sid in sessions:
            if sid not in self._raw:
                out[sid] = classify_evidence(sid, 0, None)
                continue
            value = self._raw[sid]
            if isinstance(value, list):
                users = sorted({str(v) for v in value if str(v)})
                out[sid] = classify_evidence(sid, len(users), users[0] if users else None)
                continue
            text = str(value) if value else ""
            out[sid] = classify_evidence(sid, 1 if text else 0, text or None)
        return out

    async def close(self) -> None:
        return None


async def open_db_authority(dsn: str) -> SessionOwnerAuthority:
    """连权威库并**先验结构**:表在不在、两个权威列在不在,任一不成立 ⇒ 无法判定。"""
    import asyncpg

    try:
        conn = await asyncpg.connect(dsn=dsn, timeout=CONNECT_TIMEOUT_SEC)
    except Exception as e:  # 连不上 = 无法判定,不得降级成「扫到 0 条」
        raise AuthorityError(f"连不上权威库:{type(e).__name__}: {e}") from e
    try:
        rows = await conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
            EPISODIC_TABLE,
        )
    except Exception as e:
        await conn.close()
        raise AuthorityError(f"读不到 {EPISODIC_TABLE} 的列清单:{e}") from e
    names = {str(r["column_name"]) for r in rows}
    if not names:
        await conn.close()
        raise AuthorityError(f"表 {EPISODIC_TABLE} 不存在(或当前账号看不见它)")
    missing = sorted(EVIDENCE_COLUMNS - names)
    if missing:
        await conn.close()
        raise AuthorityError(f"表 {EPISODIC_TABLE} 缺权威列 {missing} —— 判据前提不成立")
    return EpisodicDbAuthority(conn)


def load_mapping_authority(path: Path) -> MappingAuthority:
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise AuthorityError(f"权威映射 {path} 读不出:{e}") from e
    if not isinstance(parsed, dict):
        raise AuthorityError(f"权威映射 {path} 顶层必须是 object(session_id -> user_id)")
    return MappingAuthority({str(k): v for k, v in parsed.items()})


# ---------------------------------------------------------------------------
# 目标侧:working 桶的存取
# ---------------------------------------------------------------------------


class BucketStore(Protocol):
    """working 桶的一种落点(本文件实现 `JsonDirStore`;进程内走 `apply_to_service`)。"""

    name: str

    async def load(self) -> dict[str, list[dict[str, Any]]]: ...

    async def apply_owners(
        self, owners_by_session: Mapping[str, str], buckets: Mapping[str, Sequence[Mapping[str, Any]]]
    ) -> int: ...

    async def restore(self, buckets: Mapping[str, Sequence[Mapping[str, Any]]]) -> None: ...

    async def close(self) -> None: ...


def normalize_buckets(raw: Any, *, source: str) -> dict[str, list[dict[str, Any]]]:
    """把任意来源的桶数据归成 `{session: [entry]}`;结构不符一律 StoreError(不猜、不部分接受)。"""
    if not isinstance(raw, dict):
        raise StoreError(f"{source}: 顶层必须是 object(session_id -> 条目数组)")
    out: dict[str, list[dict[str, Any]]] = {}
    for session_id, entries in raw.items():
        if not isinstance(entries, list) or any(not isinstance(m, dict) for m in entries):
            raise StoreError(f"{source}: session {session_id!r} 的条目不是对象数组")
        out[str(session_id)] = [dict(m) for m in entries]
    return out


def buckets_to_snapshot(
    buckets: Mapping[str, Sequence[Mapping[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    return {sid: [dict(m) for m in msgs] for sid, msgs in buckets.items()}


class JsonDirStore:
    """`--working-dir` 档:目录里的 `working_buckets.json`(= `snapshot_working()` 的形态)。

    写盘是「整份新内容 + `os.replace`」,不追加、不留半写文件。
    """

    name = "working-dir"

    def __init__(self, directory: Path) -> None:
        self._dir = directory
        self._path = directory / BUCKETS_FILENAME

    async def load(self) -> dict[str, list[dict[str, Any]]]:
        if not self._dir.is_dir():
            raise StoreError(f"目标目录不存在:{self._dir}")
        if not self._path.is_file():
            raise StoreError(f"目标目录里没有 {BUCKETS_FILENAME}(先跑一次 working 桶导出)")
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            raise StoreError(f"{self._path} 读不出:{e}") from e
        return normalize_buckets(raw, source=str(self._path))

    async def apply_owners(
        self, owners_by_session: Mapping[str, str], buckets: Mapping[str, Sequence[Mapping[str, Any]]]
    ) -> int:
        stamped = 0
        next_state = buckets_to_snapshot(buckets)
        for session_id, owner in owners_by_session.items():
            for msg in next_state.get(session_id, []):
                if working_entry_owner(msg) is None:  # 已有属主的一律不动(幂等的根)
                    msg["userId"] = owner
                    stamped += 1
        self._write(next_state)
        return stamped

    async def restore(self, buckets: Mapping[str, Sequence[Mapping[str, Any]]]) -> None:
        self._write(buckets_to_snapshot(buckets))

    def _write(self, payload: Mapping[str, Sequence[Mapping[str, Any]]]) -> None:
        tmp = self._path.with_name(self._path.name + ".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self._path)

    async def close(self) -> None:
        return None


# ---------------------------------------------------------------------------
# 计划(纯函数;幂等与「不硬塞」的判据全部住在这里)
# ---------------------------------------------------------------------------


@dataclass
class BackfillPlan:
    """一次回填的完整结论。各计数彼此不并桶 —— 并桶就等于把「推不出」写成「没问题」。"""

    owners_to_write: dict[str, str] = field(default_factory=dict)
    entries_to_stamp: int = 0
    entries_already_owned: int = 0
    entries_conflicting: int = 0
    sessions_scanned: int = 0
    no_evidence_sessions: list[str] = field(default_factory=list)
    ambiguous_sessions: list[str] = field(default_factory=list)
    evidence_only_sessions: list[str] = field(default_factory=list)

    @property
    def has_work(self) -> bool:
        return bool(self.owners_to_write) and self.entries_to_stamp > 0


def plan_backfill(
    buckets: Mapping[str, Sequence[Mapping[str, Any]]],
    evidence: Mapping[str, Evidence],
) -> BackfillPlan:
    """算出「该给哪些桶的哪些条目补哪个 owner」,以及**为什么另一些不补**。

    只对桶里真实存在的 session 去问权威;权威侧多出来的 session 记
    `evidence_only_sessions` 只报数不落盘(桶已被 LRU 丢掉或属于别的进程,
    给它写 owner 等于凭空造数据)。
    """
    plan = BackfillPlan(sessions_scanned=len(buckets))
    for sid in sorted(buckets):
        ev = evidence.get(sid)
        if ev is None or ev.kind == "no_evidence":
            plan.no_evidence_sessions.append(sid)
            continue
        if ev.kind == "ambiguous":
            plan.ambiguous_sessions.append(sid)
            continue
        owner = ev.user_id
        if not owner:  # kind=unique 却带不出 id ⇒ 证据不完整,不猜
            plan.no_evidence_sessions.append(sid)
            continue
        stampable = 0
        for msg in buckets[sid]:
            current = working_entry_owner(msg)
            if current is None:
                stampable += 1
            elif current == owner:
                plan.entries_already_owned += 1
            else:
                plan.entries_conflicting += 1
        if stampable:
            plan.owners_to_write[sid] = owner
            plan.entries_to_stamp += stampable
    plan.evidence_only_sessions = sorted(set(evidence) - set(buckets))
    return plan


def render_plan(plan: BackfillPlan, named_limit: int) -> list[str]:
    def names(items: list[str]) -> str:
        if not items:
            return "(无)"
        head = ", ".join(items[:named_limit])
        return head if len(items) <= named_limit else f"{head} …另有 {len(items) - named_limit} 个"

    return [
        f"扫描到的 working 桶          : {plan.sessions_scanned}",
        f"计划补 owner 的桶            : {len(plan.owners_to_write)}",
        f"计划补上的条目数             : {plan.entries_to_stamp}",
        f"已有同值属主、跳过           : {plan.entries_already_owned}(幂等复跑应全落这一档)",
        f"已有**不同**属主、不动        : {plan.entries_conflicting}(冲突不猜,交人工)",
        f"权威侧推不出 owner 的桶      : {len(plan.no_evidence_sessions)} —— 保持无主: "
        f"{names(plan.no_evidence_sessions)}",
        f"权威侧多 user_id(歧义)      : {len(plan.ambiguous_sessions)} —— 保持无主: "
        f"{names(plan.ambiguous_sessions)}",
        f"权威侧多出、桶里没有的 session: {len(plan.evidence_only_sessions)} —— 只报数,不落盘",
    ]


# ---------------------------------------------------------------------------
# 快照与回滚
# ---------------------------------------------------------------------------

SNAPSHOT_MARKER = "__backfill_snapshot__"


def utc_stamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")


def harden_console_streams() -> None:
    """把 stdout/stderr 的编码策略设成 `errors='replace'`。

    为什么这是判据而不是观感问题:Windows 控制台(以及被重定向到的取证文件)常按
    **GBK 码页**编码,一个编不出的字符会在 `print` 处抛 UnicodeEncodeError —— 实测
    就发生在本工具「已经写完盘、正要打印 [OK]」那一行,于是退出码变 1,读起来像
    「回填失败」而数据其实已经改完。**输出面绝不允许推翻一个已经成立的结果**,
    所以宁可打出一个 `?` 也不让打印把成功改写成失败。(AGENTS §26 同族:码页吃掉的是
    "值参与判据"的那一半,不是显示的那一半。)
    """
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if not callable(reconfigure):
            continue
        try:
            reconfigure(errors="replace")
        except (OSError, ValueError):
            pass  # 量不到就不改,绝不因加固本身把主流程打断



def write_snapshot(
    snapshot_dir: Path, buckets: Mapping[str, Sequence[Mapping[str, Any]]], stamp: str
) -> Path:
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    path = snapshot_dir / f"snapshot-{stamp}.json"
    payload: dict[str, Any] = {
        SNAPSHOT_MARKER: {"written_at": stamp, "tool": "backfill_working_owner"},
        "buckets": buckets_to_snapshot(buckets),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def read_snapshot(path: Path) -> dict[str, list[dict[str, Any]]]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise StoreError(f"快照 {path} 读不出:{e}") from e
    if not isinstance(raw, dict) or SNAPSHOT_MARKER not in raw:
        raise StoreError(f"快照 {path} 不是本工具产出的形态(缺 {SNAPSHOT_MARKER} 标记),拒绝还原")
    return normalize_buckets(raw.get("buckets"), source=f"快照 {path}")


def default_snapshot_dir(working_dir: Path) -> Path:
    return working_dir / SNAPSHOT_SUBDIR


# ---------------------------------------------------------------------------
# 进程内出口(给活服务进程用;CLI 刻意不调它,见模块 docstring「范围边界」)
# ---------------------------------------------------------------------------


class _BackfillableService(Protocol):
    """`apply_to_service` 只用到这四个出口(MemoryService 是其实现)。"""

    async def snapshot_working(self) -> dict[str, list[dict[str, Any]]]: ...

    async def backfill_working_owner(
        self, owners_by_session: dict[str, str], *, overwrite_existing: bool = False
    ) -> tuple[int, int, int]: ...

    async def restore_working(self, snapshot: dict[str, list[dict[str, Any]]]) -> None: ...


async def apply_to_service(
    service: _BackfillableService,
    authority: SessionOwnerAuthority,
    *,
    dry_run: bool = True,
) -> tuple[BackfillPlan, dict[str, list[dict[str, Any]]]]:
    """对一个**当前进程内**的服务实例做回填,返回 `(计划, 回填前快照)`。

    回滚出口:拿着快照调 `service.restore_working(snapshot)`。
    """
    buckets = await service.snapshot_working()
    evidence = await authority.evidence_for(sorted(buckets))
    plan = plan_backfill(buckets, evidence)
    if dry_run or not plan.owners_to_write:
        return plan, buckets
    stamped, conflicted, missing = await service.backfill_working_owner(plan.owners_to_write)
    plan.entries_to_stamp = stamped
    plan.entries_conflicting = conflicted
    if missing:
        # 只报数:桶不存在就不造桶(那等于替一个已经没有会话的 id 复活数据)。
        plan.evidence_only_sessions.append(f"(服务侧 {missing} 个 session 已无桶)")
    return plan, buckets


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def resolve_dsn(args: argparse.Namespace) -> str:
    if args.dsn:
        return str(args.dsn)
    env = os.environ.get("DATABASE_URL", "").strip()
    if env:
        return env
    try:
        from app.core.config import settings

        value = str(settings.database_url or "").strip()
        if value:
            return value
    except Exception as e:  # 配置层坏了也要喊,不得静默回落成「没连上」
        raise AuthorityError(f"读取 settings.database_url 失败:{e}") from e
    raise AuthorityError("DSN 未配置:请传 --dsn / 设 DATABASE_URL / 或改用 --authority-json")


async def run_once(
    args: argparse.Namespace, store: BucketStore, authority: SessionOwnerAuthority, snapshot_dir: Path
) -> int:
    buckets = await store.load()
    evidence = await authority.evidence_for(sorted(buckets))
    plan = plan_backfill(buckets, evidence)
    print(f"目标 = {store.name}({getattr(args, 'working_dir', '')})")
    for line in render_plan(plan, args.max_named):
        print(line)
    if not args.apply:
        print("")
        print("本轮是 dry-run:未写盘、未改任何条目。")
        if plan.has_work:
            print(f"要落盘请跑 --apply --confirm {CONFIRM_TOKEN}(会先写快照再改)。")
        return 0
    if args.confirm != CONFIRM_TOKEN:
        print(f"[拒绝] 拒绝写入:--apply 必须同时给 --confirm {CONFIRM_TOKEN}(零改动)。", file=sys.stderr)
        return 1
    if not plan.owners_to_write:
        print("")
        print("本轮没有可写的条目(命中 0)—— 未写盘。幂等复跑正是这个结果。")
        return 0
    snap = write_snapshot(snapshot_dir, buckets, utc_stamp())
    print(f"已写快照:{snap}")
    print(f"  回滚:`--rollback <该文件> --apply --confirm {CONFIRM_TOKEN}`")
    try:
        stamped = await store.apply_owners(plan.owners_to_write, buckets)
    except Exception as e:
        print(f"[失败] 写入异常,未部分提交;快照仍在 {snap}:{e}", file=sys.stderr)
        return 1
    print(f"[OK] 已补 owner 的条目数 = {stamped}(计划 {plan.entries_to_stamp})")
    print("请再跑一次 dry-run 复核:`计划补上的条目数`应为 0。")
    return 0


async def run_rollback(args: argparse.Namespace, store: BucketStore, snapshot_dir: Path) -> int:
    restored = read_snapshot(Path(str(args.rollback)))
    if not args.apply:
        print(
            f"回滚 dry-run:将把 {store.name} 整份还原为 {args.rollback} 的形态"
            f"({len(restored)} 个桶)。要真还原请加 --apply --confirm {CONFIRM_TOKEN}"
        )
        return 0
    if args.confirm != CONFIRM_TOKEN:
        print(f"[拒绝] 拒绝还原:--rollback 同样必须 --apply --confirm {CONFIRM_TOKEN}(零改动)。", file=sys.stderr)
        return 1
    current = await store.load()
    snap = write_snapshot(snapshot_dir, current, utc_stamp())
    await store.restore(restored)
    print(f"[OK] 已整份还原 {len(restored)} 个桶;还原前的现场留在 {snap}")
    return 0


async def amain(
    args: argparse.Namespace, *, authority: SessionOwnerAuthority | None = None
) -> int:
    harden_console_streams()
    if args.target == "service":
        print(
            "[未判定] 无法判定:CLI 进程里的 memory_service 是这个进程自己那份空桶,对活服务进程\n"
            "   的内存没有任何通道 —— 在这里报「改了 0 条」会被读成「线上已回填」。\n"
            "   要给活进程回填:在服务进程内调 apply_to_service(memory_service, authority)。\n"
            "   要演练/处理导出件:--working-dir <DIR>。",
            file=sys.stderr,
        )
        return 2
    working_dir = Path(str(args.working_dir))
    store: BucketStore = JsonDirStore(working_dir)
    snapshot_dir = Path(args.snapshot_dir) if args.snapshot_dir else default_snapshot_dir(working_dir)
    resolved: SessionOwnerAuthority | None = authority
    own_authority = False
    try:
        if args.rollback:
            return await run_rollback(args, store, snapshot_dir)
        if resolved is None:
            if args.authority_json:
                try:
                    resolved = load_mapping_authority(Path(args.authority_json))
                except AuthorityError as e:
                    print(
                        f"[未判定] 无法判定:{e}\n"
                        "   离线权威映射读不出等同「权威不可达」:不出具任何结论,更不写盘。",
                        file=sys.stderr,
                    )
                    return 2
            else:
                try:
                    dsn = resolve_dsn(args)
                except AuthorityError as e:
                    print(f"[未判定] 无法判定:{e}", file=sys.stderr)
                    return 2
                try:
                    resolved = await open_db_authority(dsn)
                    own_authority = True
                except AuthorityError as e:
                    print(
                        f"[未判定] 无法判定:{e}\n"
                        "   这不是「扫到 0 条待回填」:权威来源没读到,本工具不出具任何结论。",
                        file=sys.stderr,
                    )
                    return 2
        return await run_once(args, store, resolved, snapshot_dir)
    except StoreError as e:
        print(f"[未判定] 无法判定:{e}", file=sys.stderr)
        return 2
    finally:
        if resolved is not None and own_authority:
            await resolved.close()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "给 working memory 的存量条目幂等补属主"
            "(权威 = agent_memory_episodic 的 (session_id, user_id))。默认 dry-run。"
        )
    )
    parser.add_argument("--target", choices=("working-dir", "service"), default="working-dir")
    parser.add_argument("--working-dir", default="", help="含 working_buckets.json 的目录(演练/导出件)")
    parser.add_argument("--dsn", default="", help="权威库 DSN;缺省读 DATABASE_URL 再回落 app 配置")
    parser.add_argument("--authority-json", default="", help="离线权威映射 session_id -> user_id(演练用)")
    parser.add_argument(
        "--snapshot-dir", default="", help=f"快照落点(默认 <working-dir>/{SNAPSHOT_SUBDIR})"
    )
    parser.add_argument("--rollback", default="", help="用这份快照整份还原 working 桶")
    parser.add_argument("--max-named", type=int, default=NAMED_LIMIT_DEFAULT, help="点名条数上限(计数不受它影响)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", dest="apply", action="store_false", help="默认档:零写盘")
    mode.add_argument(
        "--apply", dest="apply", action="store_true", help=f"写盘档:须同时 --confirm {CONFIRM_TOKEN}"
    )
    parser.add_argument("--confirm", default="", help=f"写入令牌:{CONFIRM_TOKEN}")
    parser.set_defaults(apply=False)
    args = parser.parse_args(argv)
    if args.max_named < 0:
        parser.error("--max-named 不得为负")
    if args.target == "working-dir" and not args.working_dir:
        parser.error("--target working-dir 必须给 --working-dir")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(list(sys.argv[1:] if argv is None else argv))
    return asyncio.run(amain(args))


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
