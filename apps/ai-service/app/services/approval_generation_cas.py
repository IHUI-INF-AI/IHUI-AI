# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""审批注册/结算的代际 CAS(G-816004)。

上游出处:zcode `workspace-hook-review-flow.ts`(open() 遇 pending 且非同代 ⇒
抛 "must be superseded explicitly";validate 与 resolve 分离;matchesGeneration
与 matchesSnapshot 分别返回不同 reasonCode;deadline timer 结算 timed_out;
settle() 只在 pending 态生效)+ `permission/broker.ts`(重复 requestId 在
pending 态直接拒;resolvePermission 迟到返回 false 而不炸)。

我方现状(agent_loop_v2 的 _approval_registry)只有"有/没有"两态:用户对着
已换代或已换快照的弹窗点批准,会被当新请求落账。本模块把"路由代"与"内容代"
拆成两把锁,各给各的 reasonCode:

- 路由代锁(matchesGeneration):找不到 / 已终态 / generation 不匹配 ⇒
  ``superseded`` —— 旧弹窗已被显式换代,该重新问用户;
- 内容锁(matchesSnapshot):generation 匹配但内容摘要变了 ⇒
  ``snapshot_mismatch`` —— 决策对象不是当前快照。

两码合并等于把"该重新问用户"与"该丢弃"混成一件,所以这里坚持双码分形
(票面判据:两码不同形是判据本身)。

接线说明:权威待决表在 agent_loop_v2(由他人持有,禁区格),本模块是独立
服务形态,待该格解阻(git status --porcelain 为空)后由调用方把注册盖章
(generation + content_digest)与结算双比对接进 _approval_registry。
"""

from __future__ import annotations

import hashlib
import json
import threading
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

# 两把锁各自的 reasonCode(分形是判据本身,不许并码)
REASON_SUPERSEDED = "superseded"
REASON_SNAPSHOT_MISMATCH = "snapshot_mismatch"

# 条目状态(settle 只从 pending 出发)
STATE_PENDING = "pending"
STATE_RESOLVED = "resolved"
STATE_SUPERSEDED = "superseded"
STATE_TIMED_OUT = "timed_out"


class ApprovalGenerationError(RuntimeError):
    """注册/换代被拒(上游 open()/supersede() 的抛错形态),带各自 reasonCode。"""

    def __init__(self, message: str, reason_code: str) -> None:
        super().__init__(message)
        self.reason_code = reason_code


@dataclass(frozen=True)
class ApprovalSpec:
    """注册盖章:待决审批携带路由代(generation)+ 内容摘要(snapshot_digest)。

    deadline_seconds 是相对注册时刻的秒数(上游是绝对 deadlineAt - now 的差)。
    """

    request_id: str
    session_id: str
    tool_name: str = ""
    generation: int = 0
    snapshot_digest: str = ""
    deadline_seconds: float | None = None


@dataclass(frozen=True)
class Veto:
    """validate 的否决形态:只带 reasonCode,不改任何状态。"""

    reason_code: str


@dataclass(frozen=True)
class SettlementOutcome:
    """resolve 的结算形态:applied=False 时 reason_code 指认是哪把锁拒的。"""

    applied: bool
    state: str
    reason_code: str | None = None


class _Entry:
    __slots__ = ("spec", "state", "decision", "reason", "event", "timer")

    def __init__(self, spec: ApprovalSpec) -> None:
        self.spec = spec
        self.state = STATE_PENDING
        self.decision: str | None = None
        self.reason: str | None = None
        self.event = threading.Event()
        self.timer: threading.Timer | None = None


class ApprovalGenerationCas:
    """待决审批的注册/结算代际 CAS(单实例持一把 RLock;结算即 CAS)。"""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._entries: dict[str, _Entry] = {}

    # ------------------------------------------------------------------
    # 注册(盖章)
    # ------------------------------------------------------------------
    def register(self, spec: ApprovalSpec) -> ApprovalSpec:
        """注册待决审批并盖章(携带 generation + 内容摘要)。

        - 同 request_id 在 pending 态且同代同快照 ⇒ 幂等返回现有盖章
          (上游 open() 的 sameGeneration 分支:重放同一请求不算新请求);
        - 同 request_id 在 pending 态但非同代 ⇒ 抛(必须显式 supersede,
          不允许把换代请求静默当新请求落账);
        - 其余(不存在 / 已终态)⇒ 新建条目。
        """
        with self._lock:
            existing = self._entries.get(spec.request_id)
            if existing is not None and existing.state == STATE_PENDING:
                if self._same_stamp(existing.spec, spec):
                    return existing.spec
                raise ApprovalGenerationError(
                    "A pending approval must be superseded explicitly",
                    REASON_SUPERSEDED,
                )
            entry = _Entry(spec)
            self._entries[spec.request_id] = entry
            self._arm_deadline(entry)
            return entry.spec

    def supersede(
        self,
        request_id: str,
        *,
        generation: int,
        snapshot_digest: str,
    ) -> ApprovalSpec:
        """显式换代:结算旧代为 superseded,同 id 登记新代条目并返回新盖章。"""
        with self._lock:
            current = self._entries.get(request_id)
            if (
                current is None
                or current.state != STATE_PENDING
                or generation <= current.spec.generation
            ):
                raise ApprovalGenerationError(
                    "Cannot supersede an unknown approval generation",
                    REASON_SUPERSEDED,
                )
            self._settle(current, STATE_SUPERSEDED)
            return self.register(
                ApprovalSpec(
                    request_id=request_id,
                    session_id=current.spec.session_id,
                    tool_name=current.spec.tool_name,
                    generation=generation,
                    snapshot_digest=snapshot_digest,
                    deadline_seconds=current.spec.deadline_seconds,
                )
            )

    # ------------------------------------------------------------------
    # 校验与结算分离(validate 只读;resolve 先 validate 再 CAS)
    # ------------------------------------------------------------------
    def validate(
        self,
        request_id: str,
        *,
        generation: int,
        snapshot_digest: str,
    ) -> Veto | None:
        """双比对:路由代锁先于内容锁;返回 None 表示放行。"""
        with self._lock:
            entry = self._entries.get(request_id)
            if (
                entry is None
                or entry.state != STATE_PENDING
                or entry.spec.generation != generation
            ):
                return Veto(REASON_SUPERSEDED)
            if entry.spec.snapshot_digest != snapshot_digest:
                return Veto(REASON_SNAPSHOT_MISMATCH)
            return None

    def resolve(
        self,
        request_id: str,
        decision: str,
        *,
        generation: int,
        snapshot_digest: str,
        apply: Callable[[], None] | None = None,
    ) -> SettlementOutcome:
        """结算:双比对通过才落决策并唤醒等待协程。

        迟到 resolve(条目已终态 / 换代 / 快照变)返回 applied=False 且不抛;
        ``apply`` 只在 CAS 成功的临界区内执行一次 —— 决策副作用与状态翻转
        同锁原子,"迟到决策不产生副作用"由此保证。
        """
        with self._lock:
            entry = self._entries.get(request_id)
            veto = self.validate(
                request_id, generation=generation, snapshot_digest=snapshot_digest
            )
            if veto is not None:
                state = entry.state if entry is not None else "missing"
                return SettlementOutcome(False, state, veto.reason_code)
            # validate 放行 ⇒ entry 必非 None(validate 对缺失 request_id 必返
            # REASON_SUPERSEDED);assert 是契约窄化,不是新行为面。
            assert entry is not None
            # CAS:pending → resolved,只有一个决策生效
            entry.state = STATE_RESOLVED
            entry.decision = str(decision)
            self._disarm(entry)
            entry.event.set()
            if apply is not None:
                apply()
            return SettlementOutcome(True, STATE_RESOLVED, None)

    # ------------------------------------------------------------------
    # 读取侧(只读快照,不改登记表、不取结算名额)
    # ------------------------------------------------------------------
    def state_of(self, request_id: str) -> str | None:
        with self._lock:
            entry = self._entries.get(request_id)
            return entry.state if entry is not None else None

    def describe(self, request_id: str) -> dict[str, Any] | None:
        with self._lock:
            entry = self._entries.get(request_id)
            if entry is None:
                return None
            return {
                "request_id": entry.spec.request_id,
                "session_id": entry.spec.session_id,
                "tool_name": entry.spec.tool_name,
                "generation": entry.spec.generation,
                "snapshot_digest": entry.spec.snapshot_digest,
                "state": entry.state,
                "decision": entry.decision,
                "reason": entry.reason,
            }

    def wait_terminal(self, request_id: str, timeout: float | None = None) -> str | None:
        """等待方出口:条目落任一终态(或超时)后返回当前状态。"""
        with self._lock:
            entry = self._entries.get(request_id)
            event = entry.event if entry is not None else None
        if event is None:
            return None
        if not event.wait(timeout):
            return None
        return self.state_of(request_id)

    # ------------------------------------------------------------------
    # 内部:settle 只在 pending 态生效;deadline timer 结算 timed_out
    # ------------------------------------------------------------------
    def _settle(self, entry: _Entry, state: str, reason: str | None = None) -> bool:
        # 调用方必须已持锁;非 pending 态一律拒绝(重复结算不生效)
        if entry.state != STATE_PENDING:
            return False
        entry.state = state
        entry.reason = reason
        self._disarm(entry)
        entry.event.set()
        return True

    def _arm_deadline(self, entry: _Entry) -> None:
        if entry.spec.deadline_seconds is None:
            return
        timer = threading.Timer(
            max(0.0, entry.spec.deadline_seconds),
            self._fire_deadline,
            args=(entry.spec.request_id,),
        )
        timer.daemon = True
        entry.timer = timer
        timer.start()

    def _disarm(self, entry: _Entry) -> None:
        if entry.timer is not None:
            entry.timer.cancel()
            entry.timer = None

    def _fire_deadline(self, request_id: str) -> None:
        with self._lock:
            entry = self._entries.get(request_id)
            if entry is not None:
                self._settle(entry, STATE_TIMED_OUT, reason="deadline_exceeded")

    @staticmethod
    def _same_stamp(left: ApprovalSpec, right: ApprovalSpec) -> bool:
        # 同代 = 路由代相同;同快照 = 内容摘要相同(上游 sameGeneration 的两半)
        return (
            left.generation == right.generation
            and left.snapshot_digest == right.snapshot_digest
        )


def content_digest(payload: Any) -> str:
    """审批内容摘要:args 稳定 json(排序键)的 sha256,注册盖章用。"""
    try:
        canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    except Exception:
        canonical = repr(payload)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
