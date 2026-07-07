"""
Background Agents — 多会话并行管理。

对标:
- Claude Code 的 Background Agents
- Codex 的多会话并行 (max_threads)

设计要点:
- 通过 asyncio.create_task() 在后台运行 agent loop, 不阻塞 WebSocket
- 每个后台 agent 拥有独立 agent_id, 事件流写入 ~/.ihui/background-agents/{agent_id}.jsonl
- 完成后将结果摘要持久化到 ~/.ihui/background-agents/{agent_id}.summary.json
- 支持状态查询 / 列表 / 取消 / 获取结果
- 内存中维护运行态, 磁盘维护持久态 (服务重启后可恢复历史记录)

事件协议 (JSONL, 每行一个 JSON):
    {"ts": float, "agent_id": str, "type": str, ...}  — 与 agent_loop 事件一致, 额外附带 ts/agent_id
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from pathlib import Path
from typing import Any

from loguru import logger


# ---------------------------------------------------------------------------
# 存储目录
# ---------------------------------------------------------------------------

_STORE_ROOT = Path.home() / ".ihui"
_BG_AGENTS_DIR = _STORE_ROOT / "background-agents"


def _ensure_dirs() -> None:
    """确保存储目录存在。"""
    _BG_AGENTS_DIR.mkdir(parents=True, exist_ok=True)


def _events_file(agent_id: str) -> Path:
    """事件流 JSONL 文件路径。"""
    return _BG_AGENTS_DIR / f"{agent_id}.jsonl"


def _summary_file(agent_id: str) -> Path:
    """结果摘要 JSON 文件路径。"""
    return _BG_AGENTS_DIR / f"{agent_id}.summary.json"


# ---------------------------------------------------------------------------
# BackgroundAgentManager — 后台 Agent 管理器 (单例)
# ---------------------------------------------------------------------------


class BackgroundAgentManager:
    """管理多个后台 agent 会话。

    生命周期:
        running → completed / failed / cancelled

    内存态:
        _agents: agent_id -> agent 运行时信息 (含 asyncio.Task 引用)
    磁盘态:
        {agent_id}.jsonl       — 事件流 (运行中持续追加)
        {agent_id}.summary.json — 结果摘要 (完成时写入)

    线程安全: 仅在 asyncio 事件循环中使用 (FastAPI 单线程异步模型)。
    """

    def __init__(self) -> None:
        # agent_id -> agent 信息 dict
        self._agents: dict[str, dict[str, Any]] = {}
        # agent_id -> asyncio.Task (运行中的后台任务)
        self._tasks: dict[str, asyncio.Task[Any]] = {}
        _ensure_dirs()

    # ------------------------------------------------------------------
    # 启动后台 agent
    # ------------------------------------------------------------------

    def start_background_agent(
        self,
        prompt: str,
        workspace_path: str,
        model_id: str = "default",
        user_uuid: str = "anonymous",
        *,
        max_iterations: int = 25,
        system_prompt: str | None = None,
        permission_mode: str = "bypassPermissions",
    ) -> str:
        """启动一个后台 agent, 返回 agent_id。

        后台 agent 在独立 asyncio.Task 中运行 agent loop, 不阻塞调用方。
        事件流实时写入 JSONL 文件, 完成后写入结果摘要。

        Args:
            prompt: 任务描述
            workspace_path: 工作区绝对路径
            model_id: 模型 code
            user_uuid: 用户 UUID
            max_iterations: 最大工具循环次数
            system_prompt: 自定义系统提示词 (可选)
            permission_mode: 权限模式 (默认 bypassPermissions, 后台无人值守)

        Returns:
            agent_id (12 位 hex)
        """
        agent_id = uuid.uuid4().hex[:12]
        now = time.time()

        agent_info: dict[str, Any] = {
            "agent_id": agent_id,
            "status": "running",
            "prompt": prompt,
            "workspace_path": workspace_path,
            "model_id": model_id,
            "user_uuid": user_uuid,
            "created_at": now,
            "updated_at": now,
            "max_iterations": max_iterations,
            "permission_mode": permission_mode,
            # 运行时进度 (内存态, 实时更新)
            "progress": {
                "iterations": 0,
                "tool_calls": 0,
                "last_event_type": "",
                "text_preview": "",
            },
            # 结果 (完成时填充)
            "result": None,
            "error": None,
            "events_file": str(_events_file(agent_id)),
        }

        self._agents[agent_id] = agent_info

        # 写入初始事件 (agent.started)
        self._write_event(agent_id, {
            "type": "agent.started",
            "prompt": prompt,
            "workspace_path": workspace_path,
            "model_id": model_id,
        })

        # 创建后台任务
        task = asyncio.create_task(
            self._run_agent_background(
                agent_id=agent_id,
                prompt=prompt,
                workspace_path=workspace_path,
                model_id=model_id,
                user_uuid=user_uuid,
                max_iterations=max_iterations,
                system_prompt=system_prompt,
                permission_mode=permission_mode,
            ),
            name=f"bg-agent-{agent_id}",
        )
        self._tasks[agent_id] = task

        logger.info(
            f"后台 agent 已启动: id={agent_id}, workspace={workspace_path}, "
            f"model={model_id}, prompt={prompt[:80]}"
        )
        return agent_id

    # ------------------------------------------------------------------
    # 后台执行 agent loop (内部方法)
    # ------------------------------------------------------------------

    async def _run_agent_background(
        self,
        agent_id: str,
        prompt: str,
        workspace_path: str,
        model_id: str,
        user_uuid: str,
        max_iterations: int,
        system_prompt: str | None,
        permission_mode: str,
    ) -> None:
        """在后台运行 agent loop, 消费事件流。

        异常捕获: 任何异常都标记为 failed 并记录 error。
        """
        from app.api.v1.workspace.agent_loop import run_agent_loop

        accumulated_text = ""
        total_usage: dict[str, Any] = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "iterations": 0,
        }

        try:
            async for event in run_agent_loop(
                prompt=prompt,
                model_id=model_id,
                workspace_path=workspace_path,
                user_uuid=user_uuid,
                system_prompt=system_prompt,
                max_iterations=max_iterations,
                permission_mode=permission_mode,
            ):
                etype = event.get("type", "")

                # 写入事件流 JSONL
                self._write_event(agent_id, event)

                # 更新内存态进度
                info = self._agents.get(agent_id)
                if not info:
                    break  # 已被清理

                progress = info["progress"]
                progress["last_event_type"] = etype
                info["updated_at"] = time.time()

                if etype == "agent.text.delta":
                    text = event.get("content", "")
                    accumulated_text += text
                    # 保留最近 200 字符预览
                    progress["text_preview"] = accumulated_text[-200:]

                elif etype == "agent.tool.call":
                    progress["tool_calls"] += 1

                elif etype == "agent.usage":
                    usage = event.get("usage", {})
                    total_usage["prompt_tokens"] += usage.get("prompt_tokens", 0)
                    total_usage["completion_tokens"] += usage.get("completion_tokens", 0)
                    total_usage["total_tokens"] += usage.get("total_tokens", 0)

                elif etype == "agent.done":
                    total_usage["iterations"] = event.get("iterations", 0)
                    finish_reason = event.get("finish_reason", "completed")
                    done_usage = event.get("usage", {})
                    if done_usage:
                        total_usage["prompt_tokens"] = done_usage.get("prompt_tokens", total_usage["prompt_tokens"])
                        total_usage["completion_tokens"] = done_usage.get("completion_tokens", total_usage["completion_tokens"])
                        total_usage["total_tokens"] = done_usage.get("total_tokens", total_usage["total_tokens"])

                    # 标记完成
                    info["status"] = "completed"
                    info["result"] = {
                        "output": accumulated_text or "(无输出)",
                        "iterations": total_usage["iterations"],
                        "finish_reason": finish_reason,
                        "usage": dict(total_usage),
                    }
                    info["updated_at"] = time.time()

                    # 持久化摘要
                    self._persist_summary(agent_id, info)
                    self._write_event(agent_id, {
                        "type": "agent.completed",
                        "output": accumulated_text or "(无输出)",
                        "usage": dict(total_usage),
                    })

                    logger.info(f"后台 agent 完成: id={agent_id}, iterations={total_usage['iterations']}")
                    return

                elif etype == "agent.error":
                    err_msg = event.get("message", "未知错误")
                    info["status"] = "failed"
                    info["error"] = err_msg
                    info["updated_at"] = time.time()
                    self._persist_summary(agent_id, info)
                    self._write_event(agent_id, {"type": "agent.failed", "error": err_msg})
                    logger.error(f"后台 agent 失败: id={agent_id}, error={err_msg}")
                    return

        except asyncio.CancelledError:
            # 被 cancel_background_agent 取消
            info = self._agents.get(agent_id)
            if info:
                info["status"] = "cancelled"
                info["updated_at"] = time.time()
                self._persist_summary(agent_id, info)
            self._write_event(agent_id, {"type": "agent.cancelled"})
            logger.info(f"后台 agent 已取消: id={agent_id}")
            raise  # 重新抛出以正确终止 task

        except Exception as e:
            info = self._agents.get(agent_id)
            if info:
                info["status"] = "failed"
                info["error"] = str(e)
                info["updated_at"] = time.time()
                self._persist_summary(agent_id, info)
            self._write_event(agent_id, {"type": "agent.failed", "error": str(e)})
            logger.exception(f"后台 agent 异常: id={agent_id}, error={e}")

        finally:
            # 清理 task 引用
            self._tasks.pop(agent_id, None)

    # ------------------------------------------------------------------
    # 状态查询
    # ------------------------------------------------------------------

    def get_agent_status(self, agent_id: str) -> dict[str, Any] | None:
        """获取后台 agent 状态。

        优先从内存态读取 (运行中); 若内存中不存在则从磁盘摘要读取 (已完成)。

        Returns:
            agent 状态 dict, 或 None (不存在)
        """
        info = self._agents.get(agent_id)
        if info:
            return self._public_info(info)

        # 从磁盘恢复 (服务重启后)
        summary = self._load_summary(agent_id)
        if summary:
            return summary

        return None

    def list_background_agents(self, workspace_path: str | None = None) -> list[dict[str, Any]]:
        """列出所有后台 agent。

        合并内存态 (运行中) + 磁盘态 (已完成), 去重后按创建时间倒序排列。

        Args:
            workspace_path: 可选, 按工作区过滤

        Returns:
            agent 状态列表
        """
        result: dict[str, dict[str, Any]] = {}

        # 1. 磁盘态 (所有 summary 文件)
        _ensure_dirs()
        for sf in _BG_AGENTS_DIR.glob("*.summary.json"):
            try:
                summary = json.loads(sf.read_text(encoding="utf-8"))
                aid = summary.get("agent_id", sf.stem.replace(".summary", ""))
                result[aid] = summary
            except Exception:
                continue

        # 2. 内存态覆盖 (运行中的 agent 优先)
        for aid, info in self._agents.items():
            result[aid] = self._public_info(info)

        agents = list(result.values())

        # 按工作区过滤
        if workspace_path:
            agents = [a for a in agents if a.get("workspace_path") == workspace_path]

        # 按创建时间倒序
        agents.sort(key=lambda a: a.get("created_at", 0), reverse=True)
        return agents

    # ------------------------------------------------------------------
    # 取消
    # ------------------------------------------------------------------

    def cancel_background_agent(self, agent_id: str) -> bool:
        """取消运行中的后台 agent。

        Returns:
            是否成功取消 (仅 running 状态可取消)
        """
        info = self._agents.get(agent_id)
        if not info:
            return False

        if info["status"] != "running":
            return False

        task = self._tasks.get(agent_id)
        if task and not task.done():
            task.cancel()
            logger.info(f"已发送取消信号到后台 agent: id={agent_id}")
            return True

        # task 已结束但状态未更新 (边界情况)
        info["status"] = "cancelled"
        info["updated_at"] = time.time()
        self._persist_summary(agent_id, info)
        return True

    # ------------------------------------------------------------------
    # 获取结果
    # ------------------------------------------------------------------

    def get_agent_result(self, agent_id: str) -> dict[str, Any] | None:
        """获取已完成 agent 的结果。

        Returns:
            {"output": str, "iterations": int, "usage": dict, "status": str}
            或 None (不存在 / 仍在运行)
        """
        info = self._agents.get(agent_id)
        if info:
            if info["status"] == "running":
                return {"status": "running", "message": "agent 仍在运行中"}
            return {
                "status": info["status"],
                "output": info.get("result", {}).get("output", ""),
                "iterations": info.get("result", {}).get("iterations", 0),
                "usage": info.get("result", {}).get("usage", {}),
                "error": info.get("error"),
            }

        # 从磁盘恢复
        summary = self._load_summary(agent_id)
        if summary:
            result = summary.get("result") or {}
            return {
                "status": summary.get("status", "unknown"),
                "output": result.get("output", ""),
                "iterations": result.get("iterations", 0),
                "usage": result.get("usage", {}),
                "error": summary.get("error"),
            }

        return None

    # ------------------------------------------------------------------
    # 获取事件流 (供前端流式读取进度)
    # ------------------------------------------------------------------

    def get_agent_events(
        self,
        agent_id: str,
        *,
        from_line: int = 0,
        limit: int = 500,
    ) -> list[dict[str, Any]]:
        """读取 agent 事件流 (JSONL)。

        Args:
            agent_id: agent ID
            from_line: 起始行号 (0-based, 用于增量读取)
            limit: 最多返回事件数

        Returns:
            事件 dict 列表
        """
        ef = _events_file(agent_id)
        if not ef.exists():
            return []

        events: list[dict[str, Any]] = []
        try:
            lines = ef.read_text(encoding="utf-8").splitlines()
            for line in lines[from_line:]:
                if not line.strip():
                    continue
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
                if len(events) >= limit:
                    break
        except Exception as e:
            logger.warning(f"读取事件流失败 {agent_id}: {e}")

        return events

    # ------------------------------------------------------------------
    # 删除 (清理)
    # ------------------------------------------------------------------

    def delete_background_agent(self, agent_id: str) -> bool:
        """删除后台 agent 记录 (取消运行中的 + 删除磁盘文件)。

        Returns:
            是否删除成功
        """
        # 先取消运行中的
        self.cancel_background_agent(agent_id)

        # 清理内存
        self._agents.pop(agent_id, None)
        self._tasks.pop(agent_id, None)

        # 删除磁盘文件
        deleted = False
        ef = _events_file(agent_id)
        sf = _summary_file(agent_id)
        if ef.exists():
            ef.unlink()
            deleted = True
        if sf.exists():
            sf.unlink()
            deleted = True

        return deleted

    # ------------------------------------------------------------------
    # 内部: 文件 I/O
    # ------------------------------------------------------------------

    def _write_event(self, agent_id: str, event: dict[str, Any]) -> None:
        """追加写入事件到 JSONL 文件。"""
        try:
            _ensure_dirs()
            ef = _events_file(agent_id)
            line = json.dumps(
                {**event, "ts": time.time(), "agent_id": agent_id},
                ensure_ascii=False,
                default=str,
            )
            with ef.open("a", encoding="utf-8") as f:
                f.write(line + "\n")
        except Exception as e:
            logger.warning(f"写入事件流失败 {agent_id}: {e}")

    def _persist_summary(self, agent_id: str, info: dict[str, Any]) -> None:
        """持久化 agent 结果摘要到磁盘。"""
        try:
            _ensure_dirs()
            sf = _summary_file(agent_id)
            summary = self._public_info(info)
            sf.write_text(
                json.dumps(summary, ensure_ascii=False, indent=2, default=str),
                encoding="utf-8",
            )
        except Exception as e:
            logger.warning(f"持久化摘要失败 {agent_id}: {e}")

    def _load_summary(self, agent_id: str) -> dict[str, Any] | None:
        """从磁盘加载 agent 摘要 (服务重启后恢复)。"""
        sf = _summary_file(agent_id)
        if not sf.exists():
            return None
        try:
            return json.loads(sf.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning(f"加载摘要失败 {agent_id}: {e}")
            return None

    # ------------------------------------------------------------------
    # 内部: 信息脱敏 (移除不可序列化的 task 引用)
    # ------------------------------------------------------------------

    @staticmethod
    def _public_info(info: dict[str, Any]) -> dict[str, Any]:
        """提取可公开返回的 agent 信息 (去除内部字段)。"""
        return {
            "agent_id": info["agent_id"],
            "status": info["status"],
            "prompt": info.get("prompt", ""),
            "workspace_path": info.get("workspace_path", ""),
            "model_id": info.get("model_id", ""),
            "user_uuid": info.get("user_uuid", ""),
            "created_at": info.get("created_at", 0),
            "updated_at": info.get("updated_at", 0),
            "progress": info.get("progress", {}),
            "result": info.get("result"),
            "error": info.get("error"),
            "events_file": info.get("events_file", ""),
        }


# ---------------------------------------------------------------------------
# 单例
# ---------------------------------------------------------------------------

_manager: BackgroundAgentManager | None = None


def get_background_agent_manager() -> BackgroundAgentManager:
    """获取全局 BackgroundAgentManager 单例。"""
    global _manager
    if _manager is None:
        _manager = BackgroundAgentManager()
    return _manager
