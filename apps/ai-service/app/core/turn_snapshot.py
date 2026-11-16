# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""turn 边界文件快照编排(2026-11-15 立,遵循统一工程规范)。

来源(四程序独立分析 T3§B / T4§B)
------------------------------
Trae 把 agent 每一轮(turn)的文件改动用一对边界包住:
``snapshot_turn_start``(turn 开始记录 manifest) → 写 → ``snapshot_turn_finish``,
之后 ``snapshot_revert`` / ``snapshot_revert_check`` 按轮整批回滚。**整轮是一个
可回滚单元**,而不是一堆互不相关的单文件版本。

本仓缺口(本轮现读确认)
------------------------
- ``file_editor.snapshot_file`` / ``rollback_file``:逐文件快照与回滚,能力完整
  (``existed_before`` / ``read_ok`` 双布尔位三态分流,绝不写空),但**无 turn 归集**
  —— 回滚一次 agent 改动要调用方自己记得这一轮动过哪些文件。
- ``app.core.revert_check``:回退前的独立一致性闸(纯数据),但**不执行**回滚。
- ``agent_checkpoint``:agent loop 状态 checkpoint,不覆盖文件内容。

=> 缺的是**编排层**:把「这一轮动过哪些文件」归集成一个 manifest,让整轮可一键
回滚。本模块只做编排,**不重复造单文件快照/回滚判据**——那些权威仍在
``file_editor``(§0.6 单一真相源)。

职责
----
- ``begin_turn``:开一个 turn,归集容器。
- ``record_snapshot``:记录本 turn 内某文件的一次快照(version_id 由 ``file_editor``
  产出,本模块只登记引用;快照的实际拍摄仍由调用方调 ``snapshot_file``)。
- ``finish_turn``:收口 turn,产出 manifest。
- ``revert_turn``:按 turn 整批回滚。逐文件走 ``file_editor.rollback_file``;
  回滚前若调用方提供了三面一致性输入,先过 ``evaluate_revert_check`` 闸
  (fail-closed,不一致即整批不动)。

纪律
----
- **不重造单文件判据**:快照/回滚权威在 ``file_editor``;一致性闸在 ``revert_check``。
  本模块只归集 + 编排,删了本模块两者照常可用。
- **无 console**;结构化返回 + logging。
- **不读盘**:manifest 归集的是调用方已拍好的 version 引用;本模块不 stat、不读内容
  (读盘权威在 ``file_editor.snapshot_file``)。
- **fail-closed**:一致性闸不一致 ⇒ 整批不动(绝不「回滚一半留一半」)。
- 诚实边界:纯内存编排(进程内),跨进程/重启不持久——要持久请走
  ``agent_checkpoint`` 的 ``revert_check_inputs`` 接线(那已是既有能力)。
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.core.revert_check import RevertVerdict, evaluate_revert_check
from app.services.file_editor import rollback_file

logger = logging.getLogger(__name__)

# 一致性闸判据来源(审计用,单一真相源仍是 revert_check 的常量)。
_TURN_SNAPSHOT_CRITERION = "app.core.turn_snapshot/v1:turn-scoped-revert"


@dataclass
class TurnRecord:
    """一个 turn 的文件改动归集容器(进程内)。"""

    turn_id: str
    session_id: str
    checkpoint_id: str | None
    started_at: float
    finished_at: float | None = None
    # 逐文件快照引用:[{path, version_id, checkpoint_id}]。
    # version_id 指向 file_editor 已拍好的版本(本模块不持有内容)。
    entries: list[dict[str, str]] = field(default_factory=list)

    def manifest(self) -> dict[str, Any]:
        """产出可审计 manifest(纯数据,不含文件内容)。"""
        return {
            "turn_id": self.turn_id,
            "session_id": self.session_id,
            "checkpoint_id": self.checkpoint_id,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "file_count": len(self.entries),
            "files": list(self.entries),
            "criterion": _TURN_SNAPSHOT_CRITERION,
        }


class TurnSnapshotLedger:
    """turn → 文件改动 的进程内台账。

    生命周期:进程内。跨进程/重启不持久(诚实边界,见模块头注)。
    """

    def __init__(self) -> None:
        self._turns: dict[str, TurnRecord] = {}

    # -- 编排 ---------------------------------------------------------------

    def begin_turn(
        self, session_id: str, checkpoint_id: str | None = None
    ) -> str:
        """开一个 turn,返回 turn_id。"""
        turn_id = uuid.uuid4().hex
        self._turns[turn_id] = TurnRecord(
            turn_id=turn_id,
            session_id=session_id,
            checkpoint_id=checkpoint_id,
            started_at=time.time(),
        )
        return turn_id

    def record_snapshot(
        self, turn_id: str, path: str, version_id: str
    ) -> dict[str, Any]:
        """登记本 turn 内某文件的一次快照引用。

        version_id 必须是 ``file_editor.snapshot_file`` 已产出的版本 id(本模块
        不拍快照、不持有内容)。重复登记同一路径以最后一次为准(一个 turn 内
        同文件多次改,回滚只需回到 turn 开始前的那一版)。
        """
        rec = self._turns.get(turn_id)
        if rec is None:
            return {"ok": False, "errorCode": "TURN_NOT_FOUND", "turn_id": turn_id}
        entry = {"path": path, "version_id": version_id}
        # 按 path 去重:同路径后登记者覆盖前者(保留 turn 开始前的最新一版)。
        rec.entries = [e for e in rec.entries if e["path"] != path]
        rec.entries.append(entry)
        return {"ok": True, "turn_id": turn_id, "path": path, "version_id": version_id}

    def finish_turn(self, turn_id: str) -> dict[str, Any]:
        """收口 turn,产出 manifest。重复 finish 幂等(只更新 finished_at)。"""
        rec = self._turns.get(turn_id)
        if rec is None:
            return {"ok": False, "errorCode": "TURN_NOT_FOUND", "turn_id": turn_id}
        rec.finished_at = rec.finished_at or time.time()
        return {"ok": True, "manifest": rec.manifest()}

    def manifest(self, turn_id: str) -> dict[str, Any] | None:
        """取某 turn 的 manifest(未收口也可取,finished_at 为 None)。"""
        rec = self._turns.get(turn_id)
        return rec.manifest() if rec else None

    # -- 回滚 ---------------------------------------------------------------

    def revert_turn(
        self,
        turn_id: str,
        *,
        consistency_inputs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """按 turn 整批回滚。

        流程:
        1. (可选)调用方提供了 ``consistency_inputs`` ⇒ 先过 ``evaluate_revert_check``
           一致性闸;不一致 ⇒ **整批不动**(fail-closed,绝不回滚一半)。
        2. 逐文件 ``file_editor.rollback_file``(按 turn 的 checkpoint_id 定位版本)。
        3. 汇总每文件结果;任一文件回滚失败不影响其他文件(单文件失败是文件级问题,
           不该连坐;但闸不过则一个都不动)。

        Returns:
            {"ok": bool, "reverted": [...], "failed": [...], "gate": {...}|None}
        """
        rec = self._turns.get(turn_id)
        if rec is None:
            return {
                "ok": False,
                "errorCode": "TURN_NOT_FOUND",
                "turn_id": turn_id,
                "reverted": [],
                "failed": [],
                "gate": None,
            }

        # 1. 一致性闸(opt-in:调用方提供三面才跑;不提供则跳过,不冒充已判)。
        gate_result: dict[str, Any] | None = None
        if consistency_inputs is not None:
            if not isinstance(consistency_inputs, dict):
                consistency_inputs = {}
            verdict = evaluate_revert_check(
                consistency_inputs.get("target_snapshot"),
                consistency_inputs.get("current_workspace"),
                consistency_inputs.get("policy"),
            )
            gate_result = dict(verdict)
            if verdict.get("verdict") != RevertVerdict.CONSISTENT:
                logger.warning(
                    "revert_turn 前置一致性闸阻断 turn=%s verdict=%s reason=%s",
                    turn_id,
                    verdict.get("verdict"),
                    verdict.get("reason"),
                )
                return {
                    "ok": False,
                    "errorCode": "CONSISTENCY_GATE_BLOCKED",
                    "turn_id": turn_id,
                    "reverted": [],
                    "failed": [],
                    "gate": gate_result,
                }

        # 2. 逐文件回滚(按 turn 的 checkpoint_id 定位版本)。
        reverted: list[dict[str, Any]] = []
        failed: list[dict[str, Any]] = []
        for entry in rec.entries:
            result = rollback_file(
                session_id=rec.session_id,
                file_path=entry["path"],
                version_id=entry["version_id"],
            )
            if result.get("ok"):
                reverted.append(result)
            else:
                failed.append(result)

        overall_ok = not failed
        return {
            "ok": overall_ok,
            "turn_id": turn_id,
            "reverted": reverted,
            "failed": failed,
            "gate": gate_result,
            "manifest": rec.manifest(),
        }

    # -- 测试支持 -----------------------------------------------------------

    def reset(self) -> None:
        """清空台账(仅测试用)。"""
        self._turns.clear()


# 模块级单例(进程内默认台账;调用方也可自建实例做隔离)。
_default_ledger = TurnSnapshotLedger()


def default_ledger() -> TurnSnapshotLedger:
    """返回进程内默认台账(单一实例,避免多处各建一份导致 turn 归集分裂)。"""
    return _default_ledger
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
