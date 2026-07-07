"""
会话持久化存储 — 对标 Claude Code 的 session resume 功能。

将 Agent 会话和最近工作区持久化到文件系统:
- 会话: ~/.ihui/sessions/<session_id>.json
- 最近工作区: ~/.ihui/recent_workspaces.json

替代 routes.py 中的纯内存 _recent_workspaces。
"""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

from loguru import logger


# 存储根目录
_STORE_ROOT = Path.home() / ".ihui"
_SESSIONS_DIR = _STORE_ROOT / "sessions"
_RECENT_FILE = _STORE_ROOT / "recent_workspaces.json"


def _ensure_dirs() -> None:
    """确保存储目录存在。"""
    _STORE_ROOT.mkdir(parents=True, exist_ok=True)
    _SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# 最近工作区持久化
# ---------------------------------------------------------------------------

def load_recent_workspaces() -> list[dict[str, Any]]:
    """加载最近工作区列表。"""
    _ensure_dirs()
    if not _RECENT_FILE.exists():
        return []
    try:
        return json.loads(_RECENT_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"加载最近工作区失败: {e}")
        return []


def save_recent_workspaces(workspaces: list[dict[str, Any]]) -> None:
    """保存最近工作区列表。"""
    _ensure_dirs()
    try:
        _RECENT_FILE.write_text(
            json.dumps(workspaces, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as e:
        logger.warning(f"保存最近工作区失败: {e}")


def add_recent_workspace(meta: dict[str, Any]) -> list[dict[str, Any]]:
    """添加/更新最近工作区, 返回更新后的列表。"""
    workspaces = load_recent_workspaces()
    # 去重 (按 path)
    workspaces = [w for w in workspaces if w.get("path") != meta.get("path")]
    workspaces.insert(0, meta)
    workspaces = workspaces[:20]  # 保留最近 20 个
    save_recent_workspaces(workspaces)
    return workspaces


# ---------------------------------------------------------------------------
# Agent 会话持久化
# ---------------------------------------------------------------------------

def create_session(
    workspace_path: str,
    model_id: str,
    user_uuid: str = "anonymous",
    prompt: str = "",
) -> dict[str, Any]:
    """创建新会话, 返回会话元数据。"""
    _ensure_dirs()
    session_id = str(uuid.uuid4())[:12]
    session = {
        "id": session_id,
        "workspace_path": workspace_path,
        "model_id": model_id,
        "user_uuid": user_uuid,
        "created_at": time.time(),
        "updated_at": time.time(),
        "messages": [],
        "initial_prompt": prompt,
    }
    _save_session(session)
    return session


def _save_session(session: dict[str, Any]) -> None:
    """保存会话到文件。"""
    _ensure_dirs()
    file_path = _SESSIONS_DIR / f"{session['id']}.json"
    session["updated_at"] = time.time()
    file_path.write_text(
        json.dumps(session, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )


def load_session(session_id: str) -> dict[str, Any] | None:
    """加载指定会话。"""
    _ensure_dirs()
    file_path = _SESSIONS_DIR / f"{session_id}.json"
    if not file_path.exists():
        return None
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"加载会话 {session_id} 失败: {e}")
        return None


def list_sessions(
    workspace_path: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """列出会话, 可按工作区过滤。"""
    _ensure_dirs()
    sessions: list[dict[str, Any]] = []
    for file_path in sorted(_SESSIONS_DIR.glob("*.json"), reverse=True):
        try:
            session = json.loads(file_path.read_text(encoding="utf-8"))
            if workspace_path and session.get("workspace_path") != workspace_path:
                continue
            # 只返回摘要, 不包含完整消息
            sessions.append({
                "id": session["id"],
                "workspace_path": session["workspace_path"],
                "model_id": session["model_id"],
                "created_at": session["created_at"],
                "updated_at": session["updated_at"],
                "message_count": len(session.get("messages", [])),
                "initial_prompt": session.get("initial_prompt", ""),
            })
            if len(sessions) >= limit:
                break
        except Exception:
            continue
    return sessions


def get_most_recent_session(workspace_path: str | None = None) -> dict[str, Any] | None:
    """获取最近的会话。"""
    sessions = list_sessions(workspace_path, limit=1)
    return sessions[0] if sessions else None


def append_message(
    session_id: str,
    role: str,
    content: str,
    **extra: Any,
) -> None:
    """向会话追加消息。"""
    session = load_session(session_id)
    if not session:
        return
    msg: dict[str, Any] = {
        "role": role,
        "content": content,
        "timestamp": time.time(),
    }
    msg.update(extra)
    session.setdefault("messages", []).append(msg)
    _save_session(session)


def get_history(session_id: str) -> list[dict[str, Any]]:
    """获取会话历史消息 (供 Agent 多轮上下文)。"""
    session = load_session(session_id)
    if not session:
        return []
    return session.get("messages", [])


def delete_session(session_id: str) -> bool:
    """删除会话。"""
    _ensure_dirs()
    file_path = _SESSIONS_DIR / f"{session_id}.json"
    if file_path.exists():
        file_path.unlink()
        return True
    return False


# ---------------------------------------------------------------------------
# Plan 持久化 (Stage B: Plan Mode 两阶段分离)
# ---------------------------------------------------------------------------

def save_plan(session_id: str, plan: dict[str, Any]) -> bool:
    """保存 Plan 模式提交的待确认计划到会话。

    Args:
        session_id: 会话 ID
        plan: plan 数据, 包含 title/summary/steps/risks

    Returns:
        是否保存成功
    """
    session = load_session(session_id)
    if not session:
        return False
    session["pending_plan"] = {
        **plan,
        "submitted_at": time.time(),
    }
    _save_session(session)
    return True


def get_plan(session_id: str) -> dict[str, Any] | None:
    """获取会话中待确认的 plan (供 /plan-accept 读取)。"""
    session = load_session(session_id)
    if not session:
        return None
    return session.get("pending_plan")


def clear_plan(session_id: str) -> bool:
    """清空会话中的待确认 plan (供 /plan-reject 或 /plan-accept 后调用)。"""
    session = load_session(session_id)
    if not session:
        return False
    if "pending_plan" in session:
        del session["pending_plan"]
        _save_session(session)
    return True


# ---------------------------------------------------------------------------
# Token 用量持久化 (对标 Codex /cost /usage 和 Claude Code 的用量追踪)
# ---------------------------------------------------------------------------

def update_session_usage(session_id: str, usage: dict[str, Any]) -> bool:
    """累积更新会话的 token 用量。

    每次 agent loop 结束时调用, 将本轮 total_usage 累积到 session。
    累积维度: prompt_tokens / completion_tokens / total_tokens / iterations / api_calls

    Args:
        session_id: 会话 ID
        usage: agent_loop 的 total_usage dict

    Returns:
        是否更新成功
    """
    session = load_session(session_id)
    if not session:
        return False

    # 初始化或读取已有用量
    cur = session.get("usage", {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "iterations": 0,
        "api_calls": 0,
        "rounds": 0,  # 用户交互轮数
    })

    cur["prompt_tokens"] += usage.get("prompt_tokens", 0)
    cur["completion_tokens"] += usage.get("completion_tokens", 0)
    cur["total_tokens"] += usage.get("total_tokens", 0)
    cur["iterations"] = max(cur.get("iterations", 0), usage.get("iterations", 0))
    cur["api_calls"] = cur.get("api_calls", 0) + usage.get("iterations", 0)
    cur["rounds"] = cur.get("rounds", 0) + 1
    cur["last_updated"] = time.time()

    session["usage"] = cur
    _save_session(session)
    return True


def get_session_usage(session_id: str) -> dict[str, Any] | None:
    """获取会话的累计 token 用量。"""
    session = load_session(session_id)
    if not session:
        return None
    return session.get("usage", {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "iterations": 0,
        "api_calls": 0,
        "rounds": 0,
    })


def get_workspace_usage_summary(workspace_path: str) -> dict[str, Any]:
    """汇总工作区下所有会话的 token 用量 (供 /usage 全局统计)。

    Returns:
        {
            "total_prompt_tokens": int,
            "total_completion_tokens": int,
            "total_tokens": int,
            "total_api_calls": int,
            "session_count": int,
            "sessions": list[dict],  # 各会话摘要
        }
    """
    _ensure_dirs()
    summary: dict[str, Any] = {
        "total_prompt_tokens": 0,
        "total_completion_tokens": 0,
        "total_tokens": 0,
        "total_api_calls": 0,
        "session_count": 0,
        "sessions": [],
    }

    for file_path in _SESSIONS_DIR.glob("*.json"):
        try:
            session = json.loads(file_path.read_text(encoding="utf-8"))
            if session.get("workspace_path") != workspace_path:
                continue
            usage = session.get("usage", {})
            summary["total_prompt_tokens"] += usage.get("prompt_tokens", 0)
            summary["total_completion_tokens"] += usage.get("completion_tokens", 0)
            summary["total_tokens"] += usage.get("total_tokens", 0)
            summary["total_api_calls"] += usage.get("api_calls", 0)
            summary["session_count"] += 1
            summary["sessions"].append({
                "id": session["id"],
                "created_at": session.get("created_at", 0),
                "updated_at": session.get("updated_at", 0),
                "usage": usage,
                "initial_prompt": session.get("initial_prompt", "")[:80],
            })
        except Exception:
            continue

    # 按更新时间排序
    summary["sessions"].sort(key=lambda s: s.get("updated_at", 0), reverse=True)
    return summary
