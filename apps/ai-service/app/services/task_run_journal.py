# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-244(2026-10-26 立):后台任务 run 状态的 append-only journal(仓内 journal 腿)。

上游对照(ZCode 两条纪律,见 PROJECT_PLAN 第五十一波·续十八 / G-244 票):
1. store 无 journal 能力 ⇒ **整个服务显式禁用 + 结构化日志**,绝不退回内存 journal
   —— 治的是"run 看起来跑起来了,却在进程退出时把一切静默丢掉"这一格;
2. 回放 = 事件按序重铸成与 live 同一种载荷、喂**同一个 reducer**;
   终态一律**从行派生**,而非信任旧事件词表。

建表迁移腿(DB 表)与 G-241 是同一张建表决策,属 §24 需人拍板领地;本模块只落
仓内文件 journal(JSONL)腿,不建表、不改任何对外契约。

append-only 契约:文件只以 "a" 模式追加、永不重写/截断;一行一个 JSON 事件,
每条落盘即 flush+fsync(崩溃安全契约,与 sqlite synchronous=FULL 同律)。
畸形行只点名不静默吞(`read_events` 返回行号清单)。
"""

from __future__ import annotations

import json
import os
import threading
from collections.abc import Iterable
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Final

# 事件词表:run 状态机的全部变更形态。新增形态必须先接进 reducer,再进这张表。
JOURNAL_KINDS: Final[tuple[str, ...]] = ("submit", "start", "resume", "terminal")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


@dataclass(frozen=True)
class RunEvent:
    """journal 单行事件:与 live 状态变更同一种载荷(重播与现网共用同一 reducer 的前提)。"""

    seq: int
    ts: str
    task_id: str
    attempt: int
    kind: str
    state: str
    error: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)

    def to_line(self) -> str:
        return json.dumps(
            {
                "seq": self.seq,
                "ts": self.ts,
                "task_id": self.task_id,
                "attempt": self.attempt,
                "kind": self.kind,
                "state": self.state,
                "error": self.error,
                "payload": self.payload,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )

    @staticmethod
    def parse_line(line: str) -> RunEvent | None:
        """解析一行;畸形(非 JSON / 缺键 / 错类型 / 词表越界)⇒ None,由读者点名,不静默吞。"""
        try:
            obj = json.loads(line)
        except ValueError:
            return None
        if not isinstance(obj, dict):
            return None
        seq = obj.get("seq")
        ts = obj.get("ts")
        task_id = obj.get("task_id")
        attempt = obj.get("attempt")
        kind = obj.get("kind")
        state = obj.get("state")
        error = obj.get("error")
        payload = obj.get("payload", {})
        if (
            not isinstance(seq, int) or isinstance(seq, bool)
            or not isinstance(ts, str) or not ts
            or not isinstance(task_id, str) or not task_id
            or not isinstance(attempt, int) or isinstance(attempt, bool) or attempt < 0
            or not isinstance(kind, str) or kind not in JOURNAL_KINDS
            or not isinstance(state, str) or not state
            or (error is not None and not isinstance(error, str))
            or not isinstance(payload, dict)
        ):
            return None
        return RunEvent(
            seq=seq,
            ts=ts,
            task_id=task_id,
            attempt=attempt,
            kind=kind,
            state=state,
            error=error,
            payload=dict(payload),
        )


@dataclass
class RunStateView:
    """从行派生的任务视图(回放产物;"从行派生而非信任旧事件词表"的载体)。"""

    task_id: str
    attempt: int
    state: str
    error: str | None
    created_at: str
    updated_at: str
    started_at: str | None
    finished_at: str | None
    payload: dict[str, Any] = field(default_factory=dict)


def reduce_run_event(view: RunStateView | None, ev: RunEvent) -> RunStateView:
    """唯一 reducer:重启回放按序喂它;live 侧的每次状态变更都对应且仅对应一行。

    终态一律从行派生:terminal 行携带 state/error,回放不查任何旁路。
    """
    if ev.kind == "submit":
        if view is not None:
            # 同一 task_id 再次出现 submit 行(异常形态):按续跑语义折叠,不回滚历史
            return reduce_run_event(view, replace(ev, kind="resume"))
        return RunStateView(
            task_id=ev.task_id,
            attempt=ev.attempt,
            state=ev.state,
            error=None,
            created_at=ev.ts,
            updated_at=ev.ts,
            started_at=None,
            finished_at=None,
            payload=dict(ev.payload),
        )
    if view is None:
        # 无 submit 行(journal 前缀被截断的外来事件):仍从行派生,空态起算
        view = RunStateView(
            task_id=ev.task_id,
            attempt=ev.attempt,
            state="pending",
            error=None,
            created_at=ev.ts,
            updated_at=ev.ts,
            started_at=None,
            finished_at=None,
        )
    if ev.kind == "start":
        return replace(view, attempt=ev.attempt, state=ev.state, updated_at=ev.ts, started_at=ev.ts)
    if ev.kind == "resume":
        return replace(
            view,
            attempt=ev.attempt,
            state=ev.state,
            error=None,
            updated_at=ev.ts,
            started_at=None,
            finished_at=None,
        )
    # terminal
    return replace(view, attempt=ev.attempt, state=ev.state, error=ev.error, updated_at=ev.ts, finished_at=ev.ts)


def derive_run_states(events: Iterable[RunEvent]) -> dict[str, RunStateView]:
    """按 seq 序重铸事件、逐个喂同一 reducer,得到每个 task_id 的行派生态。"""
    states: dict[str, RunStateView] = {}
    for ev in sorted(events, key=lambda e: e.seq):
        states[ev.task_id] = reduce_run_event(states.get(ev.task_id), ev)
    return states


class AppendOnlyRunJournal:
    """append-only JSONL journal:只追加、永不重写;能力缺失时置 `disabled_reason` 并拒绝再写。

    调用方(manager)拿到 `append(...) is None` 即知 journal 不可用 ⇒ 按票面纪律
    **显式禁用服务**,绝不静默退回内存态。
    """

    def __init__(self, path: Path | str) -> None:
        self._path = Path(path)
        self._lock = threading.Lock()
        self._seq = -1  # 首次 append 时按现有行数初始化(跨进程续号)
        self.disabled_reason: str | None = None

    @property
    def path(self) -> Path:
        return self._path

    def append(
        self,
        *,
        kind: str,
        task_id: str,
        attempt: int,
        state: str,
        error: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> RunEvent | None:
        if kind not in JOURNAL_KINDS:
            raise ValueError(f"未知 journal 事件类型: {kind!r}(词表 {JOURNAL_KINDS})")
        with self._lock:
            if self.disabled_reason is not None:
                return None
            try:
                if self._seq < 0:
                    self._seq = self._count_rows()
                ev = RunEvent(
                    seq=self._seq + 1,
                    ts=_now_iso(),
                    task_id=task_id,
                    attempt=attempt,
                    kind=kind,
                    state=state,
                    error=error,
                    payload=dict(payload or {}),
                )
                self._path.parent.mkdir(parents=True, exist_ok=True)
                with self._path.open("a", encoding="utf-8", newline="\n") as f:
                    f.write(ev.to_line() + "\n")
                    f.flush()
                    os.fsync(f.fileno())
                self._seq = ev.seq
                return ev
            except OSError as e:
                self.disabled_reason = f"journal 不可用: {e}"
                return None

    def _count_rows(self) -> int:
        try:
            with self._path.open("r", encoding="utf-8") as f:
                return sum(1 for _ in f)
        except FileNotFoundError:
            return 0

    def read_events(self) -> tuple[list[RunEvent], list[int]]:
        """顺序读取 (事件列表, 畸形行号列表)。畸形只点名不静默吞;读不动 ⇒ 置 disabled_reason。"""
        events: list[RunEvent] = []
        malformed: list[int] = []
        try:
            with self._path.open("r", encoding="utf-8") as f:
                lines = f.readlines()
        except FileNotFoundError:
            return events, malformed
        except OSError as e:
            self.disabled_reason = f"journal 不可读: {e}"
            return events, malformed
        for idx, raw in enumerate(lines, start=1):
            stripped = raw.strip()
            if not stripped:
                continue
            ev = RunEvent.parse_line(stripped)
            if ev is None:
                malformed.append(idx)
            else:
                events.append(ev)
        return events, malformed
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
