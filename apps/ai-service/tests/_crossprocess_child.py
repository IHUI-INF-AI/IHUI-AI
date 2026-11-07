# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨进程续跑用例的子进程入口(support 模块,不被 pytest 收集)。

为什么必须是"另一个进程":崩溃要由进程自己 `os._exit(137)` 完成。同进程里 mock 抛
异常只能测到异常分支,测不到"崩死的那一刻磁盘上的回执/历史到底是什么"。父进程只看
标记文件、退出码与落盘 checkpoint,不用 sleep 猜时机。

子进程有两种模式:
- `run`   :起一个真 AgentLoopV2 跑一轮;按场景在指定工具里硬自杀(退出码 137)。
- `resume`:新进程里 `resume_from_checkpoint(claude_id, resume_confirmations=...)`;
            拦确认时把 409 载荷写进 `blocked.json`,正常续跑写 `run-result.json`。

存储是测试专用的 `FileCheckpointManager`:临时目录里一个 checkpoint 一个 JSON 文件,
`os.replace` 原子落盘,所以父/子进程看到的是同一份状态(不需要 redis / PG)。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

# 进程级隔离:必须在 import app.* 之前落 env,且**只在独立进程里做** —— 父进程
# (pytest)只是 import 本模块拿文件存储与公共件,不能反手改父进程的 os.environ。
# REDIS_URL 指向必然拒绝的端口,让事件流/钩子总线的 redis 连接**快速失败**而不是
# 吃满超时(与 tests/conftest.py 的隔离口径一致)。
if __name__ == "__main__":
    os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:1/0")
    os.environ.setdefault("SCHEDULE_REDIS_URL", "redis://127.0.0.1:1/0")
    os.environ.setdefault("AGENT_EXECUTOR", "langgraph")
    os.environ.setdefault("IHUI_PGVECTOR_DISABLE", "1")
    os.environ.setdefault("TOOL_APPROVAL_ENABLED", "false")
    os.environ.setdefault("AGENT_BUDGET_ENABLED", "false")
    os.environ.setdefault("AGENT_COMPACTION_ENABLED", "off")
    os.environ.setdefault("AGENT_TEAM_RELAY_ENABLED", "off")

from app.services.agent_checkpoint import AgentLoopCheckpoint  # noqa: E402
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition  # noqa: E402
from app.services.agent_resume_semantics import ResumeBlockedError  # noqa: E402

# 硬中断退出码(与 os._exit(137) 一致;父进程只判这个)。任务约定:137 = 被硬杀,
# 30 以内是脚本自检错误(带 error.json),0 = 正常跑完。
HARD_KILL_EXIT = 137
CHILD_ERROR_EXIT = 31

EFFECTS_FILE = "effects.log"
BLOCKED_FILE = "blocked.json"
RESULT_FILE = "run-result.json"
ERROR_FILE = "error.json"
SEEN_FILE = "llm-seen.json"


class FileCheckpointManager:
    """测试专用:临时目录里的原子 JSON checkpoint 存储(可跨进程共享)。

    只实现 loop 真正用到的面(save/load/latest/receipts_durable/record_tool_receipt);
    回执 rev 用"文件内 rev 是否等于 expected_rev"做 CAS,与 PG 侧 `_RECEIPT_UPDATE_SQL`
    的同一条语义对齐(单写者前提下等价)。`refuse_receipts=True` 用来造"回执写不进去"
    的故障场景 —— 此时本 manager 的耐久后端对回执来说是坏的,但 checkpoint 本身照常落。
    """

    def __init__(self, root: Path | str, *, refuse_receipts: bool = False) -> None:
        self._root = Path(root)
        self._root.mkdir(parents=True, exist_ok=True)
        self._refuse_receipts = refuse_receipts
        self._lock = asyncio.Lock()

    # -- 内部 --------------------------------------------------------------
    def _path(self, checkpoint_id: str) -> Path:
        return self._root / f"ckpt-{checkpoint_id}.json"

    def _write_atomic(self, data: dict[str, Any]) -> None:
        target = self._path(str(data["checkpoint_id"]))
        tmp = target.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, target)

    def all_checkpoints(self) -> list[AgentLoopCheckpoint]:
        """按落盘时间排序读出全部 checkpoint(父进程取证用)。"""
        items: list[tuple[float, AgentLoopCheckpoint]] = []
        for path in self._root.glob("ckpt-*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                items.append((float(data.get("created_at", 0.0)), AgentLoopCheckpoint.from_dict(data)))
            except (OSError, ValueError, KeyError):
                continue
        items.sort(key=lambda pair: pair[0])
        return [ckpt for _, ckpt in items]

    # -- loop 用到的面 ------------------------------------------------------
    async def save_checkpoint(
        self,
        session_id: str,
        iteration: int,
        messages: list[dict[str, Any]],
        tool_state: dict[str, Any],
        status: str,
        metadata: dict[str, Any] | None = None,
        file_snapshots: list[Any] | None = None,
        owner_user_id: str | None = None,
    ) -> str:
        meta = dict(metadata or {})
        if owner_user_id:
            meta["owner_user_id"] = owner_user_id
        checkpoint = AgentLoopCheckpoint(
            checkpoint_id=uuid.uuid4().hex,
            session_id=session_id,
            iteration=iteration,
            # 深拷贝:存储里的历史不得与循环内对象共享引用(与真 manager 同口径)。
            messages=json.loads(json.dumps(messages, ensure_ascii=False)),
            tool_state=json.loads(json.dumps(tool_state, ensure_ascii=False)),
            status=status,
            created_at=time.time(),
            expires_at=time.time() + 3600,
            metadata=meta,
        )
        async with self._lock:
            self._write_atomic(checkpoint.to_dict())
        return checkpoint.checkpoint_id

    async def load_checkpoint(self, checkpoint_id: str) -> AgentLoopCheckpoint | None:
        path = self._path(checkpoint_id)
        if not path.exists():
            return None
        return AgentLoopCheckpoint.from_dict(json.loads(path.read_text(encoding="utf-8")))

    async def load_latest_by_session(self, session_id: str) -> AgentLoopCheckpoint | None:
        latest: AgentLoopCheckpoint | None = None
        for checkpoint in self.all_checkpoints():
            if checkpoint.session_id == session_id:
                latest = checkpoint
        return latest

    async def list_checkpoints(self, session_id: str | None = None) -> list[AgentLoopCheckpoint]:
        return [
            ckpt
            for ckpt in self.all_checkpoints()
            if session_id is None or ckpt.session_id == session_id
        ]

    async def receipts_durable(self) -> bool:
        return True

    async def record_tool_receipt(
        self,
        checkpoint_id: str,
        tool_call_id: str,
        record: dict[str, Any],
        expected_rev: int,
    ) -> bool:
        if self._refuse_receipts:
            return False
        async with self._lock:
            path = self._path(checkpoint_id)
            if not path.exists():
                return False
            data = json.loads(path.read_text(encoding="utf-8"))
            tool_state = data.setdefault("tool_state", {})
            root = tool_state.get("resume_receipts")
            if not isinstance(root, dict):
                root = {"v": 1, "rev": 0, "calls": {}}
                tool_state["resume_receipts"] = root
            calls = root.get("calls")
            if not isinstance(calls, dict):
                calls = {}
                root["calls"] = calls
            rev = root.get("rev", 0)
            if rev != expected_rev:
                return False
            root["rev"] = expected_rev + 1
            calls[tool_call_id] = record
            self._write_atomic(data)
            return True


def _write_json(path: Path, payload: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")
    os.replace(tmp, path)


def _append_effect(root: Path, kind: str) -> None:
    """工具真实副作用留痕:一行一次执行(父进程按行计数判定"跑了几次")。"""
    with open(root / EFFECTS_FILE, "a", encoding="utf-8") as handle:
        handle.write(f"{kind}\n")


def _make_tools(root: Path, crash_in: str | None) -> list[ToolDefinition]:
    """两个用例工具:`write_file`(副作用面 fs_write)与 `read_file`(只读 fs_read)。"""

    async def write_executor(args: dict[str, Any]) -> dict[str, Any]:
        _append_effect(root, "write")
        if crash_in == "write":
            # 副作用已经发生,但 settle 还没写 —— 磁盘上留下 attempting 回执。
            os._exit(HARD_KILL_EXIT)
        return {"ok": True, "path": str(args.get("path", ""))}

    async def read_executor(args: dict[str, Any]) -> dict[str, Any]:
        _append_effect(root, "read")
        if crash_in == "read":
            os._exit(HARD_KILL_EXIT)
        return {"ok": True, "path": str(args.get("path", ""))}

    return [
        ToolDefinition(
            name="write_file",
            description="写文件(用例替身:只追加一行效果标记)",
            parameters={
                "type": "object",
                "properties": {"path": {"type": "string"}},
                "required": ["path"],
            },
            executor=write_executor,
        ),
        ToolDefinition(
            name="read_file",
            description="读文件(用例替身:只追加一行效果标记)",
            parameters={
                "type": "object",
                "properties": {"path": {"type": "string"}},
                "required": ["path"],
            },
            executor=read_executor,
        ),
    ]


def _tool_calls(*calls: tuple[str, str, dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"id": cid, "name": name, "args": args} for cid, name, args in calls]


CRASH_SCENARIO_LLM_PLAN: dict[str, list[list[dict[str, Any]]]] = {
    # 一轮写文件后正常收尾:用来产出一条"已 settle 的写前 checkpoint"(①/④ 前置)。
    "write_round": [_tool_calls(("call-1", "write_file", {"path": "out.txt"}))],
    # 一读一写:崩在只读工具里 ⇒ 读执行了、写没被尝试(②)。
    "read_then_write": [
        _tool_calls(
            ("call-read", "read_file", {"path": "in.txt"}),
            ("call-write", "write_file", {"path": "out.txt"}),
        )
    ],
    # 单个有副作用工具,崩在它自己体内 ⇒ attempting 回执(④)。
    "write_only": [_tool_calls(("call-1", "write_file", {"path": "out.txt"}))],
}

CRASH_SCENARIO_TOOL: dict[str, str] = {
    "write_round": "",
    "read_then_write": "read",
    "write_only": "write",
}


class ScriptedLLM:
    """脚本化 LLM 替身:按调用次数给 tool_calls;最后一格 None = 收尾。

    `seen_dir` 非空时,每次调用把**模型真正看到的消息**落盘(`llm-seen.json`)——
    续跑用例据此判定"结果是重放回来的"还是"被重新发明"的。
    不接受 `**kwargs`(与既有用例同形:循环据此判定不支持流式回调)。
    """

    def __init__(self, plan: list[list[dict[str, Any]]], *, seen_dir: Path | None = None) -> None:
        self._plan = plan
        self._calls = 0
        self._seen_dir = seen_dir

    async def __call__(self, messages: Any, tools: Any) -> dict[str, Any]:
        self._calls += 1
        if self._seen_dir is not None:
            _write_json(
                self._seen_dir / SEEN_FILE,
                {"call": self._calls, "messages": messages},
            )
        if not self._plan:
            # 续跑进程的脚本是空表:模型第一次开口就收尾(不再要工具)。
            return {"content": f"第 {self._calls} 次模型输出(收尾)", "tool_calls": None}
        index = self._calls - 1
        if index >= len(self._plan):
            # 脚本走完 = 不再要工具(不能拿最后一格无限重复:那会把同一个 tool_call_id
            # 变成第二轮,尝试序号/副作用计数全被污染)。
            return {"content": f"第 {self._calls} 次模型输出(收尾)", "tool_calls": None}
        tool_calls = self._plan[index]
        return {"content": f"第 {self._calls} 次模型输出", "tool_calls": tool_calls}


def _build_loop(
    root: Path,
    llm: ScriptedLLM,
    *,
    session_id: str,
    crash_in: str | None = None,
    refuse_receipts: bool = False,
) -> AgentLoopV2:
    return AgentLoopV2(
        llm,
        _make_tools(root, crash_in),
        max_iterations=6,
        # 串行执行:② 需要"第一个工具崩死时第二个还没被尝试",并行会把这个前提打散。
        parallel_tool_calls=False,
        enable_checkpoint=True,
        session_id=session_id,
        checkpoint_manager=FileCheckpointManager(root, refuse_receipts=refuse_receipts),
        user_id=None,
        # 用例要真跑 write_file:角色矩阵(role>=1 = admin)会先于审批门拦普通用户,
        # 这里显式给 admin 身份,否则"工具没跑"会被误读成"续跑没继续"。
        user_role=1,
        enable_memory=False,
        approval_enabled=False,
        budget_enabled=False,
        permission_mode="default",
    )


async def _mode_run(args: argparse.Namespace) -> int:
    root = Path(args.dir)
    scenario = args.scenario
    plan = CRASH_SCENARIO_LLM_PLAN[scenario]
    crash_in = CRASH_SCENARIO_TOOL[scenario] or None
    loop = _build_loop(root, ScriptedLLM(plan), session_id=args.session, crash_in=crash_in)
    result = await loop.run([{"role": "user", "content": "跨进程续跑用例"}])
    _write_json(
        root / RESULT_FILE,
        {
            "stop_reason": str(result.stop_reason),
            "success": result.success,
            "error": result.error,
            "final_response": result.final_response,
            "checkpoint_id": result.checkpoint_id,
        },
    )
    return 0


async def _mode_resume(args: argparse.Namespace) -> int:
    root = Path(args.dir)
    loop = _build_loop(
        root,
        ScriptedLLM([], seen_dir=root),
        session_id=args.session,
        refuse_receipts=bool(args.refuse_receipts),
    )
    confirmations = None
    if args.confirmation:
        confirmations = {args.call_id: args.confirmation}
    try:
        result = await loop.resume_from_checkpoint(
            args.checkpoint_id, resume_confirmations=confirmations
        )
    except ResumeBlockedError as exc:
        _write_json(root / BLOCKED_FILE, dict(exc.payload))
        return 0
    except Exception as exc:  # noqa: BLE001 - 子进程要留证而不是仅仅非零退出
        _write_json(root / ERROR_FILE, {"error": f"{type(exc).__name__}: {exc}"})
        return CHILD_ERROR_EXIT
    _write_json(
        root / RESULT_FILE,
        {
            "stop_reason": str(result.stop_reason),
            "success": result.success,
            "error": result.error,
            "final_response": result.final_response,
            "checkpoint_id": result.checkpoint_id,
        },
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="跨进程续跑用例子进程入口")
    parser.add_argument("--mode", choices=["run", "resume"], required=True)
    parser.add_argument("--dir", required=True, help="checkpoint/标记文件目录")
    parser.add_argument("--session", required=True)
    parser.add_argument("--scenario", default="write_round")
    parser.add_argument("--checkpoint-id", default="")
    parser.add_argument("--call-id", default="call-1")
    parser.add_argument(
        "--confirmation",
        default="",
        choices=["", "retry", "skip", "accept", "abort"],
    )
    parser.add_argument("--refuse-receipts", action="store_true")
    args = parser.parse_args(argv)
    if args.mode == "run":
        return asyncio.run(_mode_run(args))
    return asyncio.run(_mode_resume(args))


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
