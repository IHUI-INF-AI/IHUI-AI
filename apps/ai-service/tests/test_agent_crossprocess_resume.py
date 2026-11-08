# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨进程续跑:真子进程硬中断用例。

这些用例**不用 mock 假装崩溃**:目标进程真的 `os._exit(137)` 死掉,父进程只读
标记文件(`effects.log` / `llm-seen.json` / `blocked.json`)、退出码与落盘 checkpoint
判定。判的不是"某函数被调用过",而是"崩溃后磁盘上留下了什么,续跑据此做了什么"。

覆盖:
① 已完成且已 settle 的副作用调用:续跑**重放**结果,不再执行(证据计数 1);
② 崩在只读工具里 ⇒ 未尝试的后续步骤继续执行(写恰好 1 次,循环推进);
③ 历史有结果但无回执:副作用步骤**零执行**被拦确认;只读步骤重跑并替换旧结果;
④ 崩在副作用工具执行中:无确认 ⇒ 零执行 + 409 载荷;retry ⇒ 计数 2 且 attempt_seq=2;
   skip ⇒ 计数 1 且落"崩溃后未执行、结果未知"的真实标记;
附加:参数指纹不一致不重放;回执写不进去 ⇒ 副作用不执行;旧 checkpoint 行为不变。

全程走默认严格路径(`IHUI_AGENT_RESUME_RECEIPTS` 不设 = "1"),不靠 `off` 变绿。
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from app.services.agent_resume_semantics import (
    RECEIPTS_EPOCH,
    SKIP_RESULT_TEXT,
    args_digest,
)
from tests._crossprocess_child import (
    HARD_KILL_EXIT,
    FileCheckpointManager,
    ScriptedLLM,
    _build_loop,
    _tool_calls,
)

_SERVICE_ROOT = Path(__file__).resolve().parents[1]

# 用例里的副作用计数口径:effects.log 一行一次真实执行。
_WRITE = "write"
_READ = "read"


def _effects(root: Path, kind: str) -> int:
    path = root / "effects.log"
    if not path.exists():
        return 0
    return sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.strip() == kind)


def _read_json(root: Path, name: str) -> dict[str, Any]:
    path = root / name
    assert path.exists(), f"子进程没有留下 {name}(说明它没走到该分支)"
    return json.loads(path.read_text(encoding="utf-8"))


def _resume_round(checkpoint: Any) -> dict[str, Any]:
    metadata = checkpoint.metadata if isinstance(checkpoint.metadata, dict) else {}
    value = metadata.get("resume_round")
    assert isinstance(value, dict), f"checkpoint {checkpoint.checkpoint_id} 没有 resume_round"
    return value


def _latest_by_phase(root: Path, phase: str) -> Any:
    matches = [
        ckpt
        for ckpt in FileCheckpointManager(root).all_checkpoints()
        if isinstance(ckpt.metadata, dict)
        and isinstance(ckpt.metadata.get("resume_round"), dict)
        and str(ckpt.metadata["resume_round"].get("phase")) == phase
    ]
    assert matches, f"临时目录里没有 phase={phase} 的 checkpoint"
    return matches[-1]


def _run_child(
    root: Path,
    *,
    mode: str,
    session: str,
    scenario: str = "write_round",
    checkpoint_id: str = "",
    call_id: str = "call-1",
    confirmation: str = "",
    refuse_receipts: bool = False,
) -> subprocess.CompletedProcess[str]:
    """起一个独立 Python 进程跑指定模式;父进程绝不触碰它的内部状态。"""
    argv = [
        sys.executable,
        "-m",
        "tests._crossprocess_child",
        "--mode",
        mode,
        "--dir",
        str(root),
        "--session",
        session,
        "--scenario",
        scenario,
        "--checkpoint-id",
        checkpoint_id,
        "--call-id",
        call_id,
    ]
    if confirmation:
        argv.extend(["--confirmation", confirmation])
    if refuse_receipts:
        argv.append("--refuse-receipts")
    env = dict(os.environ)
    env["PYTHONPATH"] = str(_SERVICE_ROOT)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return subprocess.run(
        argv,
        cwd=str(_SERVICE_ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
    )


def _child_failed_message(proc: subprocess.CompletedProcess[str]) -> str:
    return f"子进程退出码 {proc.returncode}\nstdout:\n{proc.stdout[-2000:]}\nstderr:\n{proc.stderr[-4000:]}"


def _craft_checkpoint(
    root: Path,
    *,
    session: str,
    calls: list[dict[str, Any]],
    tool_messages: list[dict[str, Any]],
    resume_round: bool = True,
    receipts: dict[str, dict[str, Any]] | None = None,
) -> str:
    """按旧代码/崩溃窗口留下的真实形状写一条 checkpoint。

    只用于"历史里有结果但回执缺失"这类**只可能由旧版本产生**的状态:今天的代码
    已经不可能写出这种组合,造它比等它自然出现更可靠(不是 mock 崩溃)。
    """

    async def _write() -> str:
        manager = FileCheckpointManager(root)
        messages = [
            {"role": "user", "content": "跨进程续跑用例"},
            {"role": "assistant", "content": "调用工具", "tool_calls": calls},
            *tool_messages,
        ]
        metadata: dict[str, Any] = {}
        if resume_round:
            metadata["resume_round"] = {
                "phase": "tools_inflight",
                "iteration": 1,
                "assistant_index": 1,
                "tool_call_ids": [str(call.get("id") or "") for call in calls],
                "rev": 0,
                "epoch": RECEIPTS_EPOCH,
            }
        checkpoint_id = await manager.save_checkpoint(
            session_id=session,
            iteration=1,
            messages=messages,
            tool_state={},
            status="running",
            metadata=metadata,
        )
        for index, (call_id, record) in enumerate((receipts or {}).items()):
            await manager.record_tool_receipt(checkpoint_id, call_id, record, index)
        return checkpoint_id

    return asyncio.run(_write())


def _write_call(call_id: str = "call-1", path: str = "out.txt") -> dict[str, Any]:
    return {"id": call_id, "name": "write_file", "args": {"path": path}}


def _read_call(call_id: str = "call-read", path: str = "in.txt") -> dict[str, Any]:
    return {"id": call_id, "name": "read_file", "args": {"path": path}}


def _tool_message(call_id: str, name: str, content: str) -> dict[str, Any]:
    return {"role": "tool", "tool_call_id": call_id, "name": name, "content": content}


# ===========================================================================
# ① 已完成(已 settle)⇒ 重放,不再执行
# ===========================================================================


def test_settled_side_effect_is_replayed_not_reexecuted(tmp_path: Path) -> None:
    """写在崩溃窗口"settle 之后、轮末 checkpoint 之前"留下的写前快照续跑。

    这个快照是**真实跑出来的**:第一轮正常跑完时,写前 checkpoint 那一行的 messages
    永远是"assistant(tool_calls) 已入史、工具结果尚未入史",而回执 CAS 直接写进了
    同一行 —— 与"刚 settle 完就被硬杀"留下的磁盘状态逐字节同形。续跑必须从回执
    重放结果,副作用计数保持 1。
    """
    root = tmp_path
    proc = _run_child(root, mode="run", session="sess-xp-replay", scenario="write_round")
    assert proc.returncode == 0, _child_failed_message(proc)

    inflight = _latest_by_phase(root, "tools_inflight")
    assert _resume_round(inflight)["tool_call_ids"] == ["call-1"]
    receipt = inflight.tool_state["resume_receipts"]["calls"]["call-1"]
    assert receipt["state"] == "settled_ok"
    assert receipt["attempt_seq"] == 1
    assert receipt["result_message"], "settled 回执必须带可恢复的结果载荷"

    after = _run_child(
        root, mode="resume", session="sess-xp-replay", checkpoint_id=inflight.checkpoint_id
    )
    assert after.returncode == 0, _child_failed_message(after)

    assert _effects(root, _WRITE) == 1, "已完成的副作用调用被重复执行了"
    seen = _read_json(root, "llm-seen.json")
    replayed = [
        msg
        for msg in seen["messages"]
        if msg.get("role") == "tool" and msg.get("tool_call_id") == "call-1"
    ]
    assert replayed, "续跑没有把已完成步骤的结果重放进历史"
    assert "out.txt" in replayed[0]["content"]


# ===========================================================================
# ② 未尝试的后续步骤继续(循环推进)
# ===========================================================================


def test_unattempted_step_runs_once_after_hard_crash(tmp_path: Path) -> None:
    """崩在第一个(只读)工具里:第二个写调用**没被尝试**,续跑必须把它跑完一次。"""
    root = tmp_path
    proc = _run_child(
        root, mode="run", session="sess-xp-continue", scenario="read_then_write"
    )
    assert proc.returncode == HARD_KILL_EXIT, _child_failed_message(proc)

    # 崩溃现场:读执行了、写一次都没跑(第二个工具在串行序里还没轮到)。
    assert _effects(root, _READ) == 1
    assert _effects(root, _WRITE) == 0

    inflight = _latest_by_phase(root, "tools_inflight")
    assert _resume_round(inflight)["tool_call_ids"] == ["call-read", "call-write"]

    after = _run_child(
        root, mode="resume", session="sess-xp-continue", checkpoint_id=inflight.checkpoint_id
    )
    assert after.returncode == 0, _child_failed_message(after)

    assert _effects(root, _WRITE) == 1, "未尝试的步骤没有被继续执行"
    assert _effects(root, _READ) == 2, "只读步骤没有按安全侧重跑"
    result = _read_json(root, "run-result.json")
    assert result["success"] is True
    seen = _read_json(root, "llm-seen.json")
    tool_ids = {msg.get("tool_call_id") for msg in seen["messages"] if msg.get("role") == "tool"}
    assert tool_ids == {"call-read", "call-write"}, "崩溃轮没有被完整重建就继续了"


# ===========================================================================
# ③ 历史有结果、无回执 ⇒ 不能当凭证
# ===========================================================================


def test_history_result_without_receipt_blocks_side_effect(tmp_path: Path) -> None:
    """旧代码写下的"历史里有结果"不是凭证:副作用步骤零执行,拦确认。"""
    root = tmp_path
    checkpoint_id = _craft_checkpoint(
        root,
        session="sess-xp-unverified",
        calls=[_write_call()],
        tool_messages=[_tool_message("call-1", "write_file", "旧结果:看起来成功了")],
    )

    after = _run_child(
        root, mode="resume", session="sess-xp-unverified", checkpoint_id=checkpoint_id
    )
    assert after.returncode == 0, _child_failed_message(after)

    assert _effects(root, _WRITE) == 0, "没有回执却重放了有副作用步骤"
    payload = _read_json(root, "blocked.json")
    assert payload["code"] == "AGENT_RESUME_REQUIRES_CONFIRMATION"
    assert payload["allowed_decisions"] == ["retry", "skip", "accept", "abort"]
    blocked = payload["blocked"]
    assert [item["tool_call_id"] for item in blocked] == ["call-1"]
    assert blocked[0]["reason_code"] == "UNVERIFIED"
    assert blocked[0]["mutating"] is True


def test_history_result_without_receipt_reruns_readonly(tmp_path: Path) -> None:
    """只读面不确定可以安全重跑,且新结果必须替换历史里的旧结果。"""
    root = tmp_path
    checkpoint_id = _craft_checkpoint(
        root,
        session="sess-xp-readonly",
        calls=[_read_call()],
        tool_messages=[_tool_message("call-read", "read_file", "OLD_READ_RESULT_PLACEHOLDER")],
    )

    after = _run_child(
        root, mode="resume", session="sess-xp-readonly", checkpoint_id=checkpoint_id
    )
    assert after.returncode == 0, _child_failed_message(after)

    assert _effects(root, _READ) == 1, "只读步骤没有重跑"
    seen = _read_json(root, "llm-seen.json")
    content = json.dumps(seen["messages"], ensure_ascii=False)
    assert "OLD_READ_RESULT_PLACEHOLDER" not in content, "旧结果没有被新结果替换"


# ===========================================================================
# ④ 崩在副作用工具执行中 ⇒ attempting 回执
# ===========================================================================


def test_crashed_side_effect_without_confirmation_blocks(tmp_path: Path) -> None:
    """副作用已发生但没 settle:没有用户确认就**一次都不许再执行**。"""
    root = tmp_path
    proc = _run_child(root, mode="run", session="sess-xp-uncertain", scenario="write_only")
    assert proc.returncode == HARD_KILL_EXIT, _child_failed_message(proc)
    assert _effects(root, _WRITE) == 1

    inflight = _latest_by_phase(root, "tools_inflight")
    receipt = inflight.tool_state["resume_receipts"]["calls"]["call-1"]
    assert receipt["state"] == "attempting", "崩在执行中的调用不该被写成已完成"
    assert receipt["attempt_seq"] == 1

    after = _run_child(
        root, mode="resume", session="sess-xp-uncertain", checkpoint_id=inflight.checkpoint_id
    )
    assert after.returncode == 0, _child_failed_message(after)

    assert _effects(root, _WRITE) == 1, "判不出的副作用步骤被静默重跑了"
    payload = _read_json(root, "blocked.json")
    blocked = payload["blocked"]
    assert blocked[0]["reason_code"] == "UNCERTAIN"
    assert blocked[0]["mutating"] is True


def test_retry_after_crashed_side_effect_is_attempt_2(tmp_path: Path) -> None:
    """用户显式 retry:真的重跑(计数 2),且尝试序号续到 2 而不是从 1 重来。"""
    root = tmp_path
    proc = _run_child(root, mode="run", session="sess-xp-retry", scenario="write_only")
    assert proc.returncode == HARD_KILL_EXIT, _child_failed_message(proc)
    assert _effects(root, _WRITE) == 1

    inflight = _latest_by_phase(root, "tools_inflight")
    after = _run_child(
        root,
        mode="resume",
        session="sess-xp-retry",
        checkpoint_id=inflight.checkpoint_id,
        confirmation="retry",
    )
    assert after.returncode == 0, _child_failed_message(after)

    assert _effects(root, _WRITE) == 2, "确认 retry 之后没有真的重新执行"
    latest = FileCheckpointManager(root).all_checkpoints()[-1]
    receipt = latest.tool_state["resume_receipts"]["calls"]["call-1"]
    assert receipt["state"] == "settled_ok"
    assert receipt["attempt_seq"] == 2, f"重试没有续号(实得 {receipt['attempt_seq']})"
    assert receipt["ledger_id"].endswith(":call-1:2")


def test_skip_after_crashed_side_effect_marks_results_unknown(tmp_path: Path) -> None:
    """skip 必须写"崩溃后未执行、结果未知",不能伪造成功,也不能再执行一次。"""
    root = tmp_path
    proc = _run_child(root, mode="run", session="sess-xp-skip", scenario="write_only")
    assert proc.returncode == HARD_KILL_EXIT, _child_failed_message(proc)
    assert _effects(root, _WRITE) == 1

    inflight = _latest_by_phase(root, "tools_inflight")
    after = _run_child(
        root,
        mode="resume",
        session="sess-xp-skip",
        checkpoint_id=inflight.checkpoint_id,
        confirmation="skip",
    )
    assert after.returncode == 0, _child_failed_message(after)

    assert _effects(root, _WRITE) == 1, "skip 之后仍执行了副作用工具"
    seen = _read_json(root, "llm-seen.json")
    skipped = [
        msg
        for msg in seen["messages"]
        if msg.get("role") == "tool" and msg.get("tool_call_id") == "call-1"
    ]
    assert skipped and skipped[0]["content"] == SKIP_RESULT_TEXT

    latest = FileCheckpointManager(root).all_checkpoints()[-1]
    receipt = latest.tool_state["resume_receipts"]["calls"]["call-1"]
    assert receipt["resolution"] == "skip"
    assert receipt["result_message"]["content"] == SKIP_RESULT_TEXT
    assert receipt["result_message"].get("role") == "tool"


# ===========================================================================
# 附加:参数指纹不一致 / 回执写不进去 / 旧 checkpoint
# ===========================================================================


def test_args_mismatch_is_not_replayed(tmp_path: Path) -> None:
    """同 id 但参数指纹变了 ⇒ 不是同一次已完成调用,副作用面不得重放。"""
    root = tmp_path
    receipt = {
        "state": "settled_ok",
        "scope": "fs_write",
        "mutating": True,
        "args_digest": args_digest({"path": "另一个文件.txt"}),
        "attempt_seq": 1,
        "result_message": _tool_message("call-1", "write_file", "旧调用的结果"),
        "result_digest": None,
        "ledger_id": "",
        "attempted_at": time.time(),
        "settled_at": time.time(),
        "resolution": None,
    }
    checkpoint_id = _craft_checkpoint(
        root,
        session="sess-xp-args",
        calls=[_write_call()],
        tool_messages=[],
        receipts={"call-1": receipt},
    )

    after = _run_child(
        root, mode="resume", session="sess-xp-args", checkpoint_id=checkpoint_id
    )
    assert after.returncode == 0, _child_failed_message(after)

    assert _effects(root, _WRITE) == 0
    payload = _read_json(root, "blocked.json")
    assert payload["blocked"][0]["reason_code"] == "ARGS_MISMATCH"


def test_receipt_write_failure_prevents_side_effect(tmp_path: Path) -> None:
    """耐久意图写不进去 ⇒ 有副作用工具**不执行**(fail-closed),错误回填给模型。"""
    root = tmp_path

    async def _run() -> Any:
        loop = _build_loop(
            root,
            ScriptedLLM([_tool_calls(("call-1", "write_file", {"path": "out.txt"}))]),
            session_id="sess-xp-refuse",
            refuse_receipts=True,
        )
        return await loop.run([{"role": "user", "content": "跨进程续跑用例"}])

    result = asyncio.run(_run())
    assert result.success is True
    assert _effects(root, _WRITE) == 0, "回执写不进去却执行了副作用工具"

    latest = FileCheckpointManager(root).all_checkpoints()[-1]
    tool_messages = [
        msg
        for msg in latest.messages
        if msg.get("role") == "tool" and msg.get("tool_call_id") == "call-1"
    ]
    assert tool_messages, "工具没有回填结果(模型会以为什么都没发生)"
    assert "AGENT_RESUME_RECEIPT_UNAVAILABLE" in tool_messages[0]["content"]


def test_legacy_checkpoint_without_resume_round_keeps_old_behavior(tmp_path: Path) -> None:
    """旧 checkpoint(没有 resume_round)按老路径从下一轮继续:不重放、不拦、标 legacy。"""
    root = tmp_path
    checkpoint_id = _craft_checkpoint(
        root,
        session="sess-xp-legacy",
        calls=[_write_call()],
        tool_messages=[_tool_message("call-1", "write_file", "历史里已有的结果")],
        resume_round=False,
    )

    after = _run_child(
        root, mode="resume", session="sess-xp-legacy", checkpoint_id=checkpoint_id
    )
    assert after.returncode == 0, _child_failed_message(after)

    assert _effects(root, _WRITE) == 0, "旧 checkpoint 不该重新执行工具"
    assert _read_json(root, "run-result.json")["success"] is True
    latest = FileCheckpointManager(root).all_checkpoints()[-1]
    receipts = latest.tool_state.get("resume_receipts") or {}
    assert receipts.get("legacy_unverified") is True, "旧路径没有打上「无凭证」标记"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
