# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""沙箱生命周期控制面。

语义译自 CubeSandbox 的暂停 / 恢复 / 快照 / 克隆 / 回滚（Apache-2.0，
https://github.com/TencentCloud/CubeSandbox），按本仓执行器重写，不引入对方仓库。

落在本仓的部分：
- 长寿命沙箱工作区，而不是一次性命令；
- 暂停只留文件系统，恢复后续跑（空闲超时 -1 = 永不自动暂停）；
- 快照彼此独立，删一张不影响工作区和其他快照；
- 克隆是全有或全无：中途失败会拆掉已造出的副本；
- 原地回滚保持沙箱 id；
- 调用方环境里的密钥键名不进子进程。网络开关不接受请求方自带。

不移植的部分：KVM MicroVM、内存快照、亚百毫秒冷启动。那些依赖 Linux KVM。
本面只有文件系统。因此文件系统快照允许原地回滚——Cube 对 memory=false
的快照会拒绝回滚，这里没有内存面可错位，回滚就是把文件树换回去。
暂停中的沙箱也可以克隆，状态就是这份文件树。

执行仍走 ``app.services.sandbox.sandbox_executor`` 的严档（白名单、工作区根、
环境白名单）。本模块只补生命周期。
"""

from __future__ import annotations

import json
import os
import re
import shutil
import threading
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.services.sandbox import SandboxResult, sandbox_executor

MAX_CLONE = 8
MAX_FILES = 32
MAX_FILE_BYTES = 256 * 1024
STATE_RUNNING = "running"
STATE_PAUSED = "paused"
SESSION_ACTIONS = (
    "create",
    "get",
    "pause",
    "resume",
    "kill",
    "snapshot",
    "list_snapshots",
    "delete_snapshot",
    "rollback",
    "clone",
    "write_file",
    "read_file",
    "exec",
    "set_timeout",
    "reap_idle",
)

_SECRET_KEY = re.compile(
    r"(secret|token|password|passwd|credential|api[_-]?key|private[_-]?key)",
    re.IGNORECASE,
)
_SECRET_EXACT = frozenset({"DATABASE_URL", "REDIS_URL"})

Executor = Callable[[str, str, dict[str, str], int], Awaitable[SandboxResult]]


class SandboxLifecycleError(Exception):
    """生命周期拒绝。``code`` 给机器读，``status`` 给 HTTP 层。"""

    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.status = status
        super().__init__(message)


@dataclass
class SandboxInfo:
    sandbox_id: str
    state: str
    timeout_s: int
    parent_id: str
    network: str = "deny"
    snapshot_kind: str = "filesystem"

    def as_dict(self) -> dict[str, Any]:
        return {
            "sandbox_id": self.sandbox_id,
            "state": self.state,
            "timeout_s": self.timeout_s,
            "parent_id": self.parent_id,
            "network": self.network,
            "snapshot_kind": self.snapshot_kind,
        }


@dataclass
class SnapshotInfo:
    snapshot_id: str
    sandbox_id: str
    kind: str = "filesystem"

    def as_dict(self) -> dict[str, Any]:
        return {
            "snapshot_id": self.snapshot_id,
            "sandbox_id": self.sandbox_id,
            "kind": self.kind,
        }


@dataclass
class _Sandbox:
    id: str
    state: str
    timeout_s: int | None
    last_active: float
    parent_id: str
    created_at: float


@dataclass
class _Snapshot:
    id: str
    sandbox_id: str
    created_at: float


def scrub_env(env: dict[str, str] | None) -> tuple[dict[str, str], list[str]]:
    """丢掉密钥形态的键。返回（可下发环境，被丢键名）。值不出这个函数的日志。"""
    kept: dict[str, str] = {}
    dropped: list[str] = []
    for key, value in (env or {}).items():
        if key.upper() in _SECRET_EXACT or _SECRET_KEY.search(key):
            dropped.append(key)
            continue
        kept[key] = value
    return kept, dropped


def _normalize_timeout(timeout_s: int) -> int | None:
    if timeout_s == -1:
        return None
    if isinstance(timeout_s, bool) or not isinstance(timeout_s, int) or timeout_s < 1:
        raise SandboxLifecycleError(
            "bad_request",
            "timeout_s 必须为正整数秒，或 -1 表示不自动暂停",
        )
    return timeout_s


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class SandboxLifecycleStore:
    """一个状态根目录上的沙箱登记。测试传入 tmp 目录；进程内单例见 ``get_store``。"""

    def __init__(self, root: str | Path, executor: Executor | None = None) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "sandboxes").mkdir(exist_ok=True)
        (self.root / "snapshots").mkdir(exist_ok=True)
        self._executor = executor
        self._lock = threading.RLock()
        self._sandboxes: dict[str, _Sandbox] = {}
        self._snapshots: dict[str, _Snapshot] = {}
        self._load()

    def create(
        self,
        *,
        timeout_s: int = 600,
        files: dict[str, str] | None = None,
        parent_id: str = "",
    ) -> SandboxInfo:
        timeout = _normalize_timeout(timeout_s)
        with self._lock:
            sandbox_id = _new_id("sbx")
            workspace = self._workspace(sandbox_id)
            workspace.mkdir(parents=True)
            record = _Sandbox(
                id=sandbox_id,
                state=STATE_RUNNING,
                timeout_s=timeout,
                last_active=time.time(),
                parent_id=parent_id,
                created_at=time.time(),
            )
            self._sandboxes[sandbox_id] = record
            try:
                self._write_files_unlocked(sandbox_id, files or {})
            except SandboxLifecycleError:
                self._sandboxes.pop(sandbox_id, None)
                shutil.rmtree(self._home(sandbox_id), ignore_errors=True)
                raise
            self._save_unlocked()
            return self._public(record)

    def get(self, sandbox_id: str) -> SandboxInfo:
        with self._lock:
            return self._public(self._require(sandbox_id))

    def pause(self, sandbox_id: str) -> SandboxInfo:
        with self._lock:
            record = self._require(sandbox_id)
            if record.state != STATE_RUNNING:
                raise SandboxLifecycleError(
                    "invalid_state",
                    f"只有运行中的沙箱可以暂停，当前是 {record.state}",
                    409,
                )
            record.state = STATE_PAUSED
            self._save_unlocked()
            return self._public(record)

    def resume(self, sandbox_id: str) -> SandboxInfo:
        with self._lock:
            record = self._require(sandbox_id)
            if record.state != STATE_PAUSED:
                raise SandboxLifecycleError(
                    "invalid_state",
                    f"只有已暂停的沙箱可以恢复，当前是 {record.state}",
                    409,
                )
            record.state = STATE_RUNNING
            record.last_active = time.time()
            self._save_unlocked()
            return self._public(record)

    def kill(self, sandbox_id: str) -> None:
        with self._lock:
            self._require(sandbox_id)
            self._destroy_unlocked(sandbox_id)

    def set_timeout(self, sandbox_id: str, timeout_s: int) -> SandboxInfo:
        timeout = _normalize_timeout(timeout_s)
        with self._lock:
            record = self._require(sandbox_id)
            record.timeout_s = timeout
            self._save_unlocked()
            return self._public(record)

    def reap_idle(self, now: float | None = None) -> list[str]:
        """运行中且空闲超过 timeout 的沙箱改为暂停。timeout 为空则跳过。"""
        clock = time.time() if now is None else now
        paused: list[str] = []
        with self._lock:
            for record in self._sandboxes.values():
                if record.state != STATE_RUNNING or record.timeout_s is None:
                    continue
                if clock - record.last_active >= record.timeout_s:
                    record.state = STATE_PAUSED
                    paused.append(record.id)
            if paused:
                self._save_unlocked()
        return paused

    def snapshot(self, sandbox_id: str) -> SnapshotInfo:
        with self._lock:
            record = self._require_alive(sandbox_id)
            self._assert_no_symlinks(self._workspace(record.id))
            snapshot_id = _new_id("snap")
            dest = self._snapshot_dir(snapshot_id)
            try:
                self._copy_tree(self._workspace(record.id), dest)
            except SandboxLifecycleError:
                shutil.rmtree(dest, ignore_errors=True)
                raise
            except Exception as exc:
                shutil.rmtree(dest, ignore_errors=True)
                raise SandboxLifecycleError(
                    "snapshot_failed",
                    "快照写入失败",
                    500,
                ) from exc
            info = _Snapshot(
                id=snapshot_id,
                sandbox_id=record.id,
                created_at=time.time(),
            )
            self._snapshots[snapshot_id] = info
            record.last_active = time.time()
            self._save_unlocked()
            return SnapshotInfo(snapshot_id=snapshot_id, sandbox_id=record.id)

    def list_snapshots(self, sandbox_id: str) -> list[SnapshotInfo]:
        with self._lock:
            self._require(sandbox_id)
            return [
                SnapshotInfo(snapshot_id=snap.id, sandbox_id=snap.sandbox_id)
                for snap in self._snapshots.values()
                if snap.sandbox_id == sandbox_id
            ]

    def delete_snapshot(self, snapshot_id: str) -> None:
        with self._lock:
            info = self._snapshots.get(snapshot_id)
            if info is None:
                raise SandboxLifecycleError("snapshot_not_found", "快照不存在", 404)
            self._snapshots.pop(snapshot_id)
            shutil.rmtree(self._snapshot_dir(snapshot_id), ignore_errors=True)
            self._save_unlocked()

    def rollback(self, sandbox_id: str, snapshot_id: str) -> SandboxInfo:
        with self._lock:
            record = self._require_alive(sandbox_id)
            snap = self._snapshots.get(snapshot_id)
            if snap is None:
                raise SandboxLifecycleError("snapshot_not_found", "快照不存在", 404)
            if snap.sandbox_id != record.id:
                raise SandboxLifecycleError(
                    "snapshot_wrong_sandbox",
                    "只能回滚到本沙箱自己的快照",
                    409,
                )
            self._assert_no_symlinks(self._snapshot_dir(snapshot_id))
            self._replace_tree(self._workspace(record.id), self._snapshot_dir(snapshot_id))
            record.state = STATE_RUNNING
            record.last_active = time.time()
            self._save_unlocked()
            return self._public(record)

    def clone(self, sandbox_id: str, n: int = 1) -> list[SandboxInfo]:
        if isinstance(n, bool) or not isinstance(n, int) or n < 1 or n > MAX_CLONE:
            raise SandboxLifecycleError(
                "bad_request",
                f"克隆份数必须是 1 到 {MAX_CLONE} 的整数",
            )
        with self._lock:
            source = self._require_alive(sandbox_id)
            self._assert_no_symlinks(self._workspace(source.id))
            created: list[str] = []
            try:
                for _ in range(n):
                    child_id = _new_id("sbx")
                    try:
                        self._copy_tree(
                            self._workspace(source.id), self._workspace(child_id)
                        )
                    except Exception:
                        shutil.rmtree(self._home(child_id), ignore_errors=True)
                        raise
                    self._sandboxes[child_id] = _Sandbox(
                        id=child_id,
                        state=STATE_RUNNING,
                        timeout_s=source.timeout_s,
                        last_active=time.time(),
                        parent_id=source.id,
                        created_at=time.time(),
                    )
                    created.append(child_id)
            except SandboxLifecycleError:
                for child_id in created:
                    self._destroy_unlocked(child_id)
                raise
            except Exception as exc:
                for child_id in created:
                    self._destroy_unlocked(child_id)
                raise SandboxLifecycleError(
                    "clone_failed",
                    "克隆失败，已拆掉未完成的副本",
                    500,
                ) from exc
            source.last_active = time.time()
            self._save_unlocked()
            return [self._public(self._sandboxes[child_id]) for child_id in created]

    def write_file(self, sandbox_id: str, rel_path: str, content: str) -> None:
        with self._lock:
            self._require_alive(sandbox_id)
            self._write_files_unlocked(sandbox_id, {rel_path: content})
            self._sandboxes[sandbox_id].last_active = time.time()
            self._save_unlocked()

    def read_file(self, sandbox_id: str, rel_path: str) -> str:
        with self._lock:
            self._require_alive(sandbox_id)
            path = self._resolve_inside(self._workspace(sandbox_id), rel_path)
            if not path.is_file():
                raise SandboxLifecycleError("file_not_found", "文件不存在", 404)
            return path.read_text(encoding="utf-8")

    async def exec(
        self,
        sandbox_id: str,
        command: str,
        *,
        env: dict[str, str] | None = None,
        timeout: int = 60,
    ) -> tuple[SandboxResult, list[str]]:
        """执行命令。已暂停的沙箱会先恢复（对标 connect 自动 resume）。"""
        with self._lock:
            self._reap_unlocked()
            record = self._require(sandbox_id)
            if record.state == STATE_PAUSED:
                record.state = STATE_RUNNING
                self._save_unlocked()
            elif record.state != STATE_RUNNING:
                raise SandboxLifecycleError(
                    "invalid_state",
                    f"沙箱当前状态不可执行: {record.state}",
                    409,
                )
            workdir = str(self._workspace(record.id))
        scrubbed, dropped = scrub_env(env)
        executor = self._executor or _default_executor
        result = await executor(command, workdir, scrubbed, timeout)
        with self._lock:
            current = self._sandboxes.get(sandbox_id)
            if current is not None and current.state == STATE_RUNNING:
                current.last_active = time.time()
                self._save_unlocked()
        return result, dropped

    def _require(self, sandbox_id: str) -> _Sandbox:
        record = self._sandboxes.get(sandbox_id)
        if record is None:
            raise SandboxLifecycleError("sandbox_not_found", "沙箱不存在", 404)
        return record

    def _require_alive(self, sandbox_id: str) -> _Sandbox:
        record = self._require(sandbox_id)
        if record.state not in (STATE_RUNNING, STATE_PAUSED):
            raise SandboxLifecycleError(
                "invalid_state",
                f"沙箱当前状态不可操作: {record.state}",
                409,
            )
        return record

    def _public(self, record: _Sandbox) -> SandboxInfo:
        return SandboxInfo(
            sandbox_id=record.id,
            state=record.state,
            timeout_s=-1 if record.timeout_s is None else record.timeout_s,
            parent_id=record.parent_id,
        )

    def _home(self, sandbox_id: str) -> Path:
        return self.root / "sandboxes" / sandbox_id

    def _workspace(self, sandbox_id: str) -> Path:
        return self._home(sandbox_id) / "workspace"

    def _snapshot_dir(self, snapshot_id: str) -> Path:
        return self.root / "snapshots" / snapshot_id

    def _resolve_inside(self, workspace: Path, rel_path: str) -> Path:
        if not isinstance(rel_path, str) or rel_path == "":
            raise SandboxLifecycleError("bad_request", "路径不能为空")
        if rel_path.startswith(("/", "\\")) or (len(rel_path) >= 2 and rel_path[1] == ":"):
            raise SandboxLifecycleError("bad_request", "只接受工作区相对路径")
        workspace_resolved = workspace.resolve()
        candidate = (workspace / rel_path).resolve()
        try:
            candidate.relative_to(workspace_resolved)
        except ValueError as exc:
            raise SandboxLifecycleError("bad_request", "路径越出沙箱工作区") from exc
        return candidate

    def _write_files_unlocked(self, sandbox_id: str, files: dict[str, str]) -> None:
        if len(files) > MAX_FILES:
            raise SandboxLifecycleError("bad_request", f"单次最多写入 {MAX_FILES} 个文件")
        workspace = self._workspace(sandbox_id)
        for rel_path, content in files.items():
            if not isinstance(content, str):
                raise SandboxLifecycleError("bad_request", "文件内容必须是字符串")
            encoded = content.encode("utf-8")
            if len(encoded) > MAX_FILE_BYTES:
                raise SandboxLifecycleError("bad_request", "单个文件超过 256KB")
            dest = self._resolve_inside(workspace, rel_path)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content, encoding="utf-8")

    def _assert_no_symlinks(self, root: Path) -> None:
        if not root.exists():
            return
        for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
            for name in list(dirnames) + list(filenames):
                path = Path(dirpath) / name
                if path.is_symlink():
                    raise SandboxLifecycleError(
                        "symlink_rejected",
                        "沙箱工作区不允许符号链接",
                    )

    def _copy_tree(self, src: Path, dest: Path) -> None:
        self._assert_no_symlinks(src)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src, dest, symlinks=False, dirs_exist_ok=False)

    def _replace_tree(self, workspace: Path, snapshot_dir: Path) -> None:
        for child in workspace.iterdir():
            if child.is_symlink() or child.is_file():
                child.unlink()
            else:
                shutil.rmtree(child)
        if not snapshot_dir.exists():
            raise SandboxLifecycleError("snapshot_not_found", "快照目录缺失", 404)
        for child in snapshot_dir.iterdir():
            target = workspace / child.name
            if child.is_dir():
                self._copy_tree(child, target)
            else:
                shutil.copy2(child, target)

    def _destroy_unlocked(self, sandbox_id: str) -> None:
        self._sandboxes.pop(sandbox_id, None)
        shutil.rmtree(self._home(sandbox_id), ignore_errors=True)
        self._save_unlocked()

    def _reap_unlocked(self, now: float | None = None) -> None:
        clock = time.time() if now is None else now
        changed = False
        for record in self._sandboxes.values():
            if record.state != STATE_RUNNING or record.timeout_s is None:
                continue
            if clock - record.last_active >= record.timeout_s:
                record.state = STATE_PAUSED
                changed = True
        if changed:
            self._save_unlocked()

    def _manifest_path(self) -> Path:
        return self.root / "manifest.json"

    def _save_unlocked(self) -> None:
        payload = {
            "sandboxes": {
                record.id: {
                    "state": record.state,
                    "timeout_s": record.timeout_s,
                    "last_active": record.last_active,
                    "parent_id": record.parent_id,
                    "created_at": record.created_at,
                }
                for record in self._sandboxes.values()
            },
            "snapshots": {
                snap.id: {
                    "sandbox_id": snap.sandbox_id,
                    "created_at": snap.created_at,
                }
                for snap in self._snapshots.values()
            },
        }
        target = self._manifest_path()
        temporary = target.with_suffix(".json.tmp")
        temporary.write_text(
            json.dumps(payload, ensure_ascii=False, sort_keys=True),
            encoding="utf-8",
        )
        os.replace(temporary, target)

    def _load(self) -> None:
        path = self._manifest_path()
        if not path.exists():
            return
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise SandboxLifecycleError(
                "manifest_unreadable",
                "沙箱登记读不出来，拒绝按空登记继续",
                500,
            ) from exc
        if not isinstance(raw, dict):
            raise SandboxLifecycleError("manifest_unreadable", "沙箱登记格式不对", 500)
        sandboxes = raw.get("sandboxes")
        snapshots = raw.get("snapshots")
        if not isinstance(sandboxes, dict) or not isinstance(snapshots, dict):
            raise SandboxLifecycleError("manifest_unreadable", "沙箱登记缺字段", 500)
        for sandbox_id, item in sandboxes.items():
            if not isinstance(item, dict):
                raise SandboxLifecycleError("manifest_unreadable", "沙箱条目损坏", 500)
            state = item.get("state")
            if state not in (STATE_RUNNING, STATE_PAUSED):
                raise SandboxLifecycleError("manifest_unreadable", "沙箱状态无法识别", 500)
            if not self._workspace(str(sandbox_id)).is_dir():
                continue
            timeout = item.get("timeout_s")
            self._sandboxes[str(sandbox_id)] = _Sandbox(
                id=str(sandbox_id),
                state=str(state),
                timeout_s=None if timeout is None else int(timeout),
                last_active=float(item.get("last_active") or 0),
                parent_id=str(item.get("parent_id") or ""),
                created_at=float(item.get("created_at") or 0),
            )
        for snapshot_id, item in snapshots.items():
            if not isinstance(item, dict):
                raise SandboxLifecycleError("manifest_unreadable", "快照条目损坏", 500)
            if not self._snapshot_dir(str(snapshot_id)).is_dir():
                continue
            self._snapshots[str(snapshot_id)] = _Snapshot(
                id=str(snapshot_id),
                sandbox_id=str(item.get("sandbox_id") or ""),
                created_at=float(item.get("created_at") or 0),
            )


async def _default_executor(
    command: str,
    workdir: str,
    env: dict[str, str],
    timeout: int,
) -> SandboxResult:
    return await sandbox_executor.execute(
        command,
        backend="local",
        timeout=timeout,
        workdir=workdir,
        env=env,
        allow_network=False,
    )


_SINGLETON: SandboxLifecycleStore | None = None


def default_state_root() -> Path:
    """状态目录必须落在服务端工作区根内。环境变量指到根外时拒绝，不回落。"""
    from app.services.sandbox import _path_within, _workspace_roots

    roots = _workspace_roots()
    override = os.environ.get("IHUI_SANDBOX_LIFECYCLE_ROOT", "").strip()
    if override:
        if not any(_path_within(override, root) for root in roots):
            raise SandboxLifecycleError(
                "bad_request",
                "IHUI_SANDBOX_LIFECYCLE_ROOT 必须落在服务端工作区根内",
            )
        return Path(override)
    return Path(roots[0]) / ".ihui-agent" / "tmp" / "sandbox-lifecycle"


def _files_arg(raw: Any) -> dict[str, str]:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise SandboxLifecycleError("bad_request", "files 必须是路径到文本的对象")
    files: dict[str, str] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or not isinstance(value, str):
            raise SandboxLifecycleError("bad_request", "files 的键和值都必须是字符串")
        files[key] = value
    return files


def _env_arg(raw: Any) -> dict[str, str] | None:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise SandboxLifecycleError("bad_request", "env 必须是字符串键值")
    env: dict[str, str] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or not isinstance(value, str):
            raise SandboxLifecycleError("bad_request", "env 的键和值都必须是字符串")
        env[key] = value
    return env


def _int_arg(raw: Any, key: str, default: int) -> int:
    if raw is None:
        return default
    if isinstance(raw, bool) or not isinstance(raw, int):
        raise SandboxLifecycleError("bad_request", f"{key} 必须是整数")
    return raw


def _need_text(raw: Any, key: str) -> str:
    if not isinstance(raw, str) or not raw.strip():
        raise SandboxLifecycleError("bad_request", f"缺少 {key}")
    return raw.strip()


async def dispatch_sandbox_session(arguments: dict[str, Any] | None) -> dict[str, Any]:
    """Agent 工具 ``sandbox_session`` 的唯一入口。未知 action 不执行。"""
    payload = arguments if isinstance(arguments, dict) else {}
    action = payload.get("action")
    if not isinstance(action, str) or action not in SESSION_ACTIONS:
        return {
            "ok": False,
            "tool": "sandbox_session",
            "error": "bad_request",
            "message": "action 必须是已登记的沙箱操作",
        }
    store = get_store()
    try:
        if action == "create":
            info = store.create(
                timeout_s=_int_arg(payload.get("timeout_s"), "timeout_s", 600),
                files=_files_arg(payload.get("files")),
            )
            return {"ok": True, "tool": "sandbox_session", **info.as_dict()}
        if action == "reap_idle":
            return {
                "ok": True,
                "tool": "sandbox_session",
                "paused": store.reap_idle(),
            }
        if action == "delete_snapshot":
            snapshot_id = _need_text(payload.get("snapshot_id"), "snapshot_id")
            store.delete_snapshot(snapshot_id)
            return {
                "ok": True,
                "tool": "sandbox_session",
                "snapshot_id": snapshot_id,
            }
        sandbox_id = _need_text(payload.get("sandbox_id"), "sandbox_id")
        if action == "get":
            return {"ok": True, "tool": "sandbox_session", **store.get(sandbox_id).as_dict()}
        if action == "pause":
            return {"ok": True, "tool": "sandbox_session", **store.pause(sandbox_id).as_dict()}
        if action == "resume":
            return {"ok": True, "tool": "sandbox_session", **store.resume(sandbox_id).as_dict()}
        if action == "kill":
            store.kill(sandbox_id)
            return {
                "ok": True,
                "tool": "sandbox_session",
                "sandbox_id": sandbox_id,
                "state": "killed",
            }
        if action == "snapshot":
            info = store.snapshot(sandbox_id)
            return {"ok": True, "tool": "sandbox_session", **info.as_dict()}
        if action == "list_snapshots":
            rows = store.list_snapshots(sandbox_id)
            return {
                "ok": True,
                "tool": "sandbox_session",
                "snapshots": [item.as_dict() for item in rows],
            }
        if action == "rollback":
            snapshot_id = _need_text(payload.get("snapshot_id"), "snapshot_id")
            info = store.rollback(sandbox_id, snapshot_id)
            return {"ok": True, "tool": "sandbox_session", **info.as_dict()}
        if action == "clone":
            clones = store.clone(sandbox_id, _int_arg(payload.get("n"), "n", 1))
            return {
                "ok": True,
                "tool": "sandbox_session",
                "clones": [item.as_dict() for item in clones],
            }
        if action == "write_file":
            rel_path = _need_text(payload.get("path"), "path")
            content = payload.get("content")
            if not isinstance(content, str):
                raise SandboxLifecycleError("bad_request", "content 必须是字符串")
            store.write_file(sandbox_id, rel_path, content)
            return {"ok": True, "tool": "sandbox_session", "path": rel_path}
        if action == "read_file":
            rel_path = _need_text(payload.get("path"), "path")
            return {
                "ok": True,
                "tool": "sandbox_session",
                "path": rel_path,
                "content": store.read_file(sandbox_id, rel_path),
            }
        if action == "set_timeout":
            info = store.set_timeout(
                sandbox_id, _int_arg(payload.get("timeout_s"), "timeout_s", 600)
            )
            return {"ok": True, "tool": "sandbox_session", **info.as_dict()}
        if action != "exec":
            return {
                "ok": False,
                "tool": "sandbox_session",
                "error": "bad_request",
                "message": "action 必须是已登记的沙箱操作",
            }
        command = _need_text(payload.get("command"), "command")
        result, dropped = await store.exec(
            sandbox_id,
            command,
            env=_env_arg(payload.get("env")),
            timeout=_int_arg(payload.get("timeout"), "timeout", 60),
        )
        return {
            "ok": result.exit_code == 0,
            "tool": "sandbox_session",
            "sandbox_id": sandbox_id,
            "exit_code": result.exit_code,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "timed_out": result.timed_out,
            "backend": result.backend,
            "dropped_env_keys": dropped,
        }
    except SandboxLifecycleError as exc:
        return {
            "ok": False,
            "tool": "sandbox_session",
            "error": exc.code,
            "message": str(exc),
        }


def get_store() -> SandboxLifecycleStore:
    global _SINGLETON
    if _SINGLETON is None:
        _SINGLETON = SandboxLifecycleStore(default_state_root())
    return _SINGLETON


def set_store(store: SandboxLifecycleStore | None) -> None:
    """测试替换进程内单例。传 None 清掉。"""
    global _SINGLETON
    _SINGLETON = store
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
