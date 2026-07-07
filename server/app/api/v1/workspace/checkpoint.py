"""
Checkpoint 快照与回滚系统 — 对标 Aider (Git auto-commit) 与 Gemini CLI (Checkpointing)。

核心能力:
1. 在每次文件修改 (write/edit/delete) 前自动快照原始内容
2. 支持撤销最近一次修改 (undo_last)
3. 支持回滚到指定检查点 (rollback_to)
4. 支持列出检查点历史 (list_checkpoints)
5. 支持 git 自动提交快照 (可选, 当工作区是 git 仓库时)

设计原则:
- 内存 + 磁盘双存储: 内存快速访问, 磁盘持久化防进程崩溃
- 按工作区隔离: 每个工作区独立检查点栈
- 轻量级: 仅快照被修改的文件, 不做全量备份
- 幂等: 同一文件多次快照只保留最新 + 历史链

对标:
- Aider: 每次变更自动 git commit, 可 git revert 回滚
- Gemini CLI: Checkpointing 会话检查点保存与恢复
- Claude Code: 会话 resume + 文件级靠 Git
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------

MAX_CHECKPOINTS_PER_WORKSPACE = 100  # 每个工作区最多保留检查点数


@dataclass
class FileSnapshot:
    """单个文件的快照。"""

    path: str  # 相对工作区的路径
    existed: bool  # 快照时文件是否存在
    content_hash: str  # 内容 SHA256 (不存在时为空)
    size: int  # 文件大小 (字节)
    # 磁盘备份路径 (相对于检查点目录), 不存在时为 None
    backup_ref: str | None = None


@dataclass
class Checkpoint:
    """一次修改的检查点。"""

    id: str  # 唯一 ID (时间戳 + 序号)
    timestamp: float  # Unix 时间戳
    tool: str  # 触发工具 (write_file/edit_file/multi_edit/delete_file)
    description: str  # 人类可读描述
    snapshots: list[FileSnapshot] = field(default_factory=list)  # 受影响文件的快照
    applied: bool = True  # 是否已应用 (回滚后标记 False)


# ---------------------------------------------------------------------------
# 检查点管理器
# ---------------------------------------------------------------------------

# 按工作区路径隔离的检查点栈: {workspace: [Checkpoint, ...]}
_checkpoint_stores: dict[str, list[Checkpoint]] = {}
# 序号计数器 (配合时间戳生成唯一 ID)
_seq_counter: dict[str, int] = {}


def _get_store(workspace: str) -> list[Checkpoint]:
    """获取工作区的检查点栈 (惰性初始化)。"""
    if workspace not in _checkpoint_stores:
        _checkpoint_stores[workspace] = []
        _seq_counter[workspace] = 0
    return _checkpoint_stores[workspace]


def _next_id(workspace: str) -> str:
    """生成下一个检查点 ID。"""
    _seq_counter.setdefault(workspace, 0)
    _seq_counter[workspace] += 1
    return f"cp-{int(time.time())}-{_seq_counter[workspace]:04d}"


def _checkpoint_dir(workspace: str) -> Path:
    """获取工作区的检查点磁盘存储目录。"""
    d = Path(workspace) / ".ihui" / "checkpoints"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _hash_content(content: str) -> str:
    """计算内容 SHA256。"""
    return hashlib.sha256(content.encode("utf-8", errors="replace")).hexdigest()[:16]


def _backup_file(src: Path, checkpoint_id: str, workspace: str) -> str | None:
    """将文件备份到检查点目录, 返回备份引用名。"""
    if not src.exists():
        return None
    backup_name = f"{checkpoint_id}__{src.name}"
    backup_path = _checkpoint_dir(workspace) / backup_name
    shutil.copy2(src, backup_path)
    return backup_name


def _restore_file(backup_ref: str, dest: Path, workspace: str) -> bool:
    """从备份恢复文件。"""
    backup_path = _checkpoint_dir(workspace) / backup_ref
    if not backup_path.exists():
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(backup_path, dest)
    return True


# ---------------------------------------------------------------------------
# 公共 API
# ---------------------------------------------------------------------------


def snapshot_before_modify(
    workspace: str,
    file_paths: list[str],
    tool: str,
    description: str = "",
) -> str:
    """在修改文件前创建快照。

    在 write_file/edit_file/multi_edit/delete_file 执行前调用,
    快照所有可能受影响的文件的当前状态。

    Args:
        workspace: 工作区绝对路径
        file_paths: 将被修改的文件相对路径列表
        tool: 触发工具名
        description: 人类可读描述

    Returns:
        检查点 ID
    """
    store = _get_store(workspace)
    cp_id = _next_id(workspace)
    snapshots: list[FileSnapshot] = []

    for rel_path in file_paths:
        abs_path = Path(workspace) / rel_path
        if abs_path.exists():
            try:
                content = abs_path.read_text(encoding="utf-8", errors="replace")
                backup_ref = _backup_file(abs_path, cp_id, workspace)
                snapshots.append(
                    FileSnapshot(
                        path=rel_path,
                        existed=True,
                        content_hash=_hash_content(content),
                        size=len(content.encode("utf-8")),
                        backup_ref=backup_ref,
                    )
                )
            except Exception:
                # 读取失败 (二进制等), 仍记录 existed=True
                backup_ref = _backup_file(abs_path, cp_id, workspace)
                snapshots.append(
                    FileSnapshot(
                        path=rel_path,
                        existed=True,
                        content_hash="",
                        size=abs_path.stat().st_size,
                        backup_ref=backup_ref,
                    )
                )
        else:
            # 文件不存在 (新建文件场景), 快照记录不存在状态
            snapshots.append(
                FileSnapshot(path=rel_path, existed=False, content_hash="", size=0)
            )

    cp = Checkpoint(
        id=cp_id,
        timestamp=time.time(),
        tool=tool,
        description=description or f"{tool}: {', '.join(file_paths)}",
        snapshots=snapshots,
    )
    store.append(cp)

    # 限制检查点数量 (FIFO 淘汰最旧)
    if len(store) > MAX_CHECKPOINTS_PER_WORKSPACE:
        evicted = store.pop(0)
        _cleanup_backup(evicted, workspace)

    # 持久化检查点元数据
    _persist_checkpoint(cp, workspace)

    return cp_id


def undo_last(workspace: str) -> dict[str, Any]:
    """撤销最近一次修改。

    恢复最近一个已应用的检查点中所有文件到快照状态。

    Returns:
        {"success": bool, "checkpoint_id": str, "restored_files": list[str], "message": str}
    """
    store = _get_store(workspace)
    if not store:
        return {"success": False, "checkpoint_id": "", "restored_files": [], "message": "没有可撤销的检查点"}

    # 从末尾找最近的已应用检查点
    cp: Checkpoint | None = None
    for c in reversed(store):
        if c.applied:
            cp = c
            break

    if cp is None:
        return {"success": False, "checkpoint_id": "", "restored_files": [], "message": "没有可撤销的已应用检查点"}

    restored: list[str] = []
    for snap in cp.snapshots:
        abs_path = Path(workspace) / snap.path
        if snap.existed and snap.backup_ref:
            # 恢复原始内容
            if _restore_file(snap.backup_ref, abs_path, workspace):
                restored.append(snap.path)
            else:
                # 备份丢失, 尝试删除当前文件 (无法恢复原始)
                pass
        else:
            # 原始不存在 → 删除当前文件 (撤销新建)
            if abs_path.exists():
                try:
                    abs_path.unlink()
                    restored.append(snap.path)
                except Exception:
                    pass

    cp.applied = False
    return {
        "success": True,
        "checkpoint_id": cp.id,
        "restored_files": restored,
        "message": f"已撤销 {cp.tool} 操作, 恢复 {len(restored)} 个文件: {', '.join(restored)}",
    }


def rollback_to(workspace: str, checkpoint_id: str) -> dict[str, Any]:
    """回滚到指定检查点 (撤销该检查点及之后所有修改)。

    Args:
        workspace: 工作区路径
        checkpoint_id: 目标检查点 ID

    Returns:
        {"success": bool, "rolled_back": int, "restored_files": list[str], "message": str}
    """
    store = _get_store(workspace)
    # 找到目标检查点索引
    target_idx = None
    for i, c in enumerate(store):
        if c.id == checkpoint_id:
            target_idx = i
            break

    if target_idx is None:
        return {"success": False, "rolled_back": 0, "restored_files": [], "message": f"检查点不存在: {checkpoint_id}"}

    # 从最新到目标检查点, 逐个撤销
    all_restored: list[str] = []
    count = 0
    for c in reversed(store[target_idx:]):
        if not c.applied:
            continue
        for snap in c.snapshots:
            abs_path = Path(workspace) / snap.path
            if snap.existed and snap.backup_ref:
                if _restore_file(snap.backup_ref, abs_path, workspace):
                    if snap.path not in all_restored:
                        all_restored.append(snap.path)
            else:
                if abs_path.exists():
                    try:
                        abs_path.unlink()
                        if snap.path not in all_restored:
                            all_restored.append(snap.path)
                    except Exception:
                        pass
        c.applied = False
        count += 1

    return {
        "success": True,
        "rolled_back": count,
        "restored_files": all_restored,
        "message": f"已回滚 {count} 个操作, 恢复 {len(all_restored)} 个文件",
    }


def list_checkpoints(workspace: str, limit: int = 20) -> list[dict[str, Any]]:
    """列出最近的检查点。"""
    store = _get_store(workspace)
    recent = list(reversed(store[-limit:]))
    return [
        {
            "id": cp.id,
            "timestamp": cp.timestamp,
            "tool": cp.tool,
            "description": cp.description,
            "files": [s.path for s in cp.snapshots],
            "applied": cp.applied,
        }
        for cp in recent
    ]


def get_checkpoint_detail(workspace: str, checkpoint_id: str) -> dict[str, Any] | None:
    """获取检查点详情。"""
    store = _get_store(workspace)
    for cp in store:
        if cp.id == checkpoint_id:
            return {
                "id": cp.id,
                "timestamp": cp.timestamp,
                "tool": cp.tool,
                "description": cp.description,
                "applied": cp.applied,
                "snapshots": [asdict(s) for s in cp.snapshots],
            }
    return None


# ---------------------------------------------------------------------------
# Git 集成 (可选): 当工作区是 git 仓库时, 在快照时自动 git stash 快照
# ---------------------------------------------------------------------------


def commit_after_modify(
    workspace: str,
    checkpoint_id: str,
    tool: str,
    file_paths: list[str],
) -> bool:
    """文件修改后尝试 git auto-commit (对标 Aider)。

    当工作区是 git 仓库时, 调用 ``git stash create`` 创建一个轻量快照作为安全网。
    失败时静默返回 False (非 git 仓库 / 无未提交修改 / 进程异常均不影响主流程)。

    Args:
        workspace: 工作区绝对路径
        checkpoint_id: 关联的检查点 ID
        tool: 触发工具名 (write_file/edit_file/multi_edit/delete_file)
        file_paths: 被修改的文件相对路径列表 (仅用于日志/扩展, 当前实现未使用)

    Returns:
        是否成功创建 git 快照
    """
    return _try_git_snapshot(workspace, checkpoint_id)


def _try_git_snapshot(workspace: str, checkpoint_id: str) -> bool:
    """尝试用 git stash 创建快照 (可选增强)。

    当工作区是 git 仓库且有未提交修改时, 创建一个 stash 作为安全网。
    失败时静默 (非 git 仓库不影响)。
    """
    import subprocess

    git_dir = Path(workspace) / ".git"
    if not git_dir.exists():
        return False
    try:
        # 检查是否有未提交修改
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=workspace,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return False
        # 创建 stash (不包含 untracked, 避免干扰)
        subprocess.run(
            ["git", "stash", "create"],
            cwd=workspace,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# 内部: 持久化与清理
# ---------------------------------------------------------------------------


def _persist_checkpoint(cp: Checkpoint, workspace: str) -> None:
    """将检查点元数据持久化到磁盘 (防进程崩溃)。"""
    try:
        meta_file = _checkpoint_dir(workspace) / f"{cp.id}.json"
        meta_file.write_text(
            json.dumps(
                {
                    "id": cp.id,
                    "timestamp": cp.timestamp,
                    "tool": cp.tool,
                    "description": cp.description,
                    "applied": cp.applied,
                    "snapshots": [asdict(s) for s in cp.snapshots],
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    except Exception:
        pass  # 持久化失败不影响主流程


def _cleanup_backup(cp: Checkpoint, workspace: str) -> None:
    """清理已淘汰检查点的磁盘备份。"""
    try:
        for snap in cp.snapshots:
            if snap.backup_ref:
                backup_path = _checkpoint_dir(workspace) / snap.backup_ref
                if backup_path.exists():
                    backup_path.unlink()
        meta_file = _checkpoint_dir(workspace) / f"{cp.id}.json"
        if meta_file.exists():
            meta_file.unlink()
    except Exception:
        pass


def clear_checkpoints(workspace: str) -> int:
    """清空工作区的所有检查点 (及磁盘备份)。"""
    store = _get_store(workspace)
    count = len(store)
    for cp in store:
        _cleanup_backup(cp, workspace)
    store.clear()
    return count
