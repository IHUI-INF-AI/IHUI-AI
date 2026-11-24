# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""影子工作区事务(2026-11-24,Cursor `cursor-shadow-workspace` 等价的有界实现)。

## 为什么需要它

`write_file` 是单文件原子写:它管不了"改 A、改 B 要么都成、要么都不成",更不会在
落盘前先把拟写内容放到一个**不影响真实工作区**的影子副本里跑一遍校验。Cursor 的
shadow workspace 要解决的正是这两件事。本模块把同一件事收成四段:

1. **影子副本**:只把"拟写的文件"写进 `<workspace>/.ihui-agent/tmp/shadow-<id>/`;
   真实工作区在这期间逐字节不变。
2. **校验**:内置语法校验(py/json/toml),并允许注入异步 validator(语言服务用同一
   个函数面接进来);Error 级诊断 ⇒ 整体不落盘。
3. **原子回写**:全部文件在内存里先算好,再逐个 `tmp + os.replace`;新文件新建,
   老文件保留权限位。
4. **全链回滚**:任一写失败 ⇒ 已写文件逆序恢复(原有内容写回/新文件删除);
   回滚本身失败必须点名 `rollback_failed`,绝不冒充已回滚。

边界:不是跨文件块设备的原子事务(OS 不提供),而是"全成功或全恢复"的应用级事务;
回滚失败会留下明确清单,让上层停手报人。
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import stat
import tempfile
import tomllib
import uuid
from collections.abc import Awaitable, Callable, Mapping, Sequence
from contextlib import AsyncExitStack
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.project_rules import normalize_rel_path
from app.services.file_write_gate import get_path_write_lock

logger = logging.getLogger(__name__)

MAX_PATCH_FILES = 64
MAX_FILE_BYTES = 2_000_000
MAX_TOTAL_BYTES = 8_000_000
MAX_DIAGNOSTICS = 200

ShadowValidator = Callable[[Path, tuple[str, ...]], Awaitable[Sequence[Mapping[str, Any]]]]


class ShadowPatchError(ValueError):
    """拟写集在进入影子副本前就被拒;code 机器可读。"""

    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(detail or code)
        self.code = code
        self.detail = detail or code


@dataclass(frozen=True)
class _Plan:
    rel: str
    abs_path: Path
    before_exists: bool
    before_bytes: bytes
    after_bytes: bytes

    @property
    def action(self) -> str:
        return "update" if self.before_exists else "create"


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _is_inside(root: Path, candidate: Path) -> bool:
    try:
        candidate.relative_to(root)
    except ValueError:
        return False
    return True


def _read_before(path: Path) -> tuple[bool, bytes]:
    if path.is_symlink():
        raise ShadowPatchError("symlink_target", f"目标是符号链接,拒绝影子写入: {path}")
    if not path.exists():
        return False, b""
    if not path.is_file():
        raise ShadowPatchError("not_a_file", f"目标不是普通文件: {path}")
    try:
        if path.stat().st_size > MAX_FILE_BYTES:
            raise ShadowPatchError("target_too_large", f"现有文件超过上限 {MAX_FILE_BYTES} 字节")
        return True, path.read_bytes()
    except ShadowPatchError:
        raise
    except OSError as exc:
        raise ShadowPatchError("target_unreadable", f"{type(exc).__name__}: {exc}") from None


def _plan_one(root: Path, raw: object, seen: set[str]) -> _Plan:
    if not isinstance(raw, Mapping):
        raise ShadowPatchError("invalid_patch", "patch 必须是对象")
    rel_raw = raw.get("path")
    rel = normalize_rel_path(str(rel_raw or ""))
    if not rel:
        raise ShadowPatchError("invalid_path", f"路径非法或越界: {rel_raw!r}")
    if rel in seen:
        raise ShadowPatchError("duplicate_path", f"同一路径出现两次: {rel}")
    seen.add(rel)
    content = raw.get("content")
    if not isinstance(content, str):
        raise ShadowPatchError("invalid_content", f"{rel} 的 content 必须是字符串")
    after = content.encode("utf-8")
    if len(after) > MAX_FILE_BYTES:
        raise ShadowPatchError("too_large", f"{rel} 超过单文件上限 {MAX_FILE_BYTES} 字节")
    abs_path = root / Path(*rel.split("/"))
    try:
        parent = abs_path.parent.resolve(strict=False)
    except OSError as exc:
        raise ShadowPatchError("path_unresolvable", f"{type(exc).__name__}: {exc}") from None
    if not _is_inside(root, parent):
        raise ShadowPatchError("outside_workspace", f"{rel} 的父目录解析到工作区外")
    before_exists, before = _read_before(abs_path)
    if before_exists:
        try:
            before.decode("utf-8")
        except UnicodeDecodeError:
            raise ShadowPatchError("non_utf8_target", f"{rel} 不是 UTF-8 文本,拒绝文本覆写") from None
    expected = raw.get("expectedSha256")
    if expected is not None:
        if not isinstance(expected, str):
            raise ShadowPatchError("invalid_expected_sha", f"{rel} 的 expectedSha256 必须是字符串")
        if expected == "":
            if before_exists:
                raise ShadowPatchError("conflict", f"{rel} 已存在,expectedSha256 不能为空串")
        else:
            if len(expected) != 64:
                raise ShadowPatchError("invalid_expected_sha", f"{rel} 的 expectedSha256 必须是 64 位 hex")
            actual = _sha256(before) if before_exists else ""
            if expected.lower() != actual:
                raise ShadowPatchError("conflict", f"{rel} 的现状与 expectedSha256 不一致")
    return _Plan(rel, abs_path, before_exists, before, after)


def plan_patches(root: Path, patches: Sequence[object]) -> list[_Plan]:
    """把外部补丁描述收成落盘计划(纯校验,不写任何文件)。"""
    if not isinstance(patches, Sequence) or isinstance(patches, (str, bytes)):
        raise ShadowPatchError("invalid_patches", "patches 必须是数组")
    if not patches:
        raise ShadowPatchError("empty_patches", "patches 不能为空")
    if len(patches) > MAX_PATCH_FILES:
        raise ShadowPatchError("too_many_files", f"一次最多 {MAX_PATCH_FILES} 个文件")
    plans: list[_Plan] = []
    seen: set[str] = set()
    total = 0
    for raw in patches:
        plan = _plan_one(root, raw, seen)
        total += len(plan.after_bytes)
        if total > MAX_TOTAL_BYTES:
            raise ShadowPatchError("total_too_large", f"总写入超过上限 {MAX_TOTAL_BYTES} 字节")
        plans.append(plan)
    return plans


async def builtin_validate(shadow_root: Path, rel_paths: tuple[str, ...]) -> list[dict[str, Any]]:
    """内置语法校验:py 编译 / json 解析 / toml 解析;其余扩展名不冒充已校验。"""
    out: list[dict[str, Any]] = []
    for rel in rel_paths:
        path = shadow_root / rel
        suffix = path.suffix.lower()
        if suffix not in {".py", ".json", ".toml"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            out.append({"file": rel, "severity": "Error", "message": f"{type(exc).__name__}: {exc}"})
            continue
        try:
            if suffix == ".py":
                compile(text, rel, "exec")
            elif suffix == ".json":
                json.loads(text)
            else:
                tomllib.loads(text)
        except SyntaxError as exc:
            out.append(
                {
                    "file": rel,
                    "severity": "Error",
                    "message": f"{type(exc).__name__}: {exc.msg}",
                    "line": exc.lineno or 0,
                    "column": exc.offset or 0,
                }
            )
        except ValueError as exc:
            out.append({"file": rel, "severity": "Error", "message": f"{type(exc).__name__}: {exc}"})
    return out


def _atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.shadow-{uuid.uuid4().hex}.tmp")
    try:
        with open(tmp, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        if path.exists():
            try:
                os.chmod(tmp, stat.S_IMODE(path.stat().st_mode))
            except OSError:
                pass
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass


def _create_shadow(root: Path, plans: Sequence[_Plan]) -> Path:
    base = root / ".ihui-agent" / "tmp"
    shadow: Path | None = None
    try:
        base.mkdir(parents=True, exist_ok=True)
        if not _is_inside(root, base.resolve(strict=False)):
            raise ShadowPatchError("shadow_unavailable", "影子目录解析到工作区外")
        shadow = Path(tempfile.mkdtemp(prefix="shadow-", dir=str(base)))
        for plan in plans:
            dst = shadow / Path(*plan.rel.split("/"))
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(plan.after_bytes)
        return shadow
    except ShadowPatchError:
        if shadow is not None:
            shutil.rmtree(shadow, ignore_errors=True)
        raise
    except OSError as exc:
        if shadow is not None:
            shutil.rmtree(shadow, ignore_errors=True)
        raise ShadowPatchError("shadow_unavailable", f"{type(exc).__name__}: {exc}") from None


def _rollback(plans: Sequence[_Plan], applied: Sequence[_Plan]) -> list[str]:
    failed: list[str] = []
    for plan in reversed(applied):
        try:
            if plan.before_exists:
                _atomic_write(plan.abs_path, plan.before_bytes)
            elif plan.abs_path.exists():
                plan.abs_path.unlink()
        except OSError as exc:
            logger.warning("[shadow] rollback %s failed: %s", plan.rel, exc)
            failed.append(plan.rel)
    return failed


async def apply_patch_set(
    workspace: str | os.PathLike[str],
    patches: Sequence[object],
    *,
    validator: ShadowValidator | None = None,
    dry_run: bool = False,
    engine_name: str | None = None,
) -> dict[str, Any]:
    """影子校验 + 全成功或全恢复的多文件写入。

    返回 `status` 封闭集:
    `rejected`(计划期拒)/`validation_failed`/`validated`(dryRun)/`applied`/
    `apply_failed`/`rolled_back`。
    """
    root = Path(workspace).expanduser()
    try:
        root = root.resolve(strict=True)
    except OSError:
        return {"ok": False, "status": "rejected", "errorCode": "workspace_missing", "error": str(workspace)}
    if not root.is_dir():
        return {"ok": False, "status": "rejected", "errorCode": "workspace_missing", "error": "工作区不是目录"}
    try:
        plans = plan_patches(root, patches)
    except ShadowPatchError as exc:
        return {"ok": False, "status": "rejected", "errorCode": exc.code, "error": exc.detail}
    abs_paths = [plan.abs_path for plan in plans]
    async with AsyncExitStack() as stack:
        for path in sorted(abs_paths):
            await stack.enter_async_context(get_path_write_lock(str(path)))
        # 持锁后复核:计划期的 before 必须仍是现状(否则有人在我们眼皮下改过)
        for plan in plans:
            try:
                exists, current = _read_before(plan.abs_path)
            except ShadowPatchError as exc:
                return {"ok": False, "status": "rejected", "errorCode": exc.code, "error": exc.detail}
            if exists != plan.before_exists or current != plan.before_bytes:
                return {
                    "ok": False,
                    "status": "rejected",
                    "errorCode": "conflict",
                    "error": f"{plan.rel} 在影子计划后被改动,整批不落",
                }
        try:
            shadow = _create_shadow(root, plans)
        except ShadowPatchError as exc:
            return {"ok": False, "status": "rejected", "errorCode": exc.code, "error": exc.detail}
        engine = validator or builtin_validate
        try:
            diagnostics = list(await engine(shadow, tuple(plan.rel for plan in plans)))
        except Exception as exc:  # noqa: BLE001 - 校验器崩了等于没校验,必须拒落
            return {
                "ok": False,
                "status": "validation_failed",
                "errorCode": "validator_error",
                "error": f"{type(exc).__name__}: {exc}",
                "shadow": {"path": str(shadow), "cleaned": True},
            }
        finally:
            shutil.rmtree(shadow, ignore_errors=True)
        errors = [item for item in diagnostics if str(item.get("severity", "")).lower() == "error"]
        body: dict[str, Any] = {
            "ok": not errors,
            "status": "validation_failed" if errors else ("validated" if dry_run else "applied"),
            "files": [
                {"path": plan.rel, "action": plan.action, "bytes": len(plan.after_bytes)}
                for plan in plans
            ],
            "validation": {
                "engine": engine_name
                or (getattr(validator, "engine_name", "custom") if validator is not None else "builtin"),
                "errors": len(errors),
                "diagnostics": diagnostics[:MAX_DIAGNOSTICS],
            },
            "shadow": {"path": str(shadow), "cleaned": True},
        }
        metadata = getattr(validator, "metadata", None) if validator is not None else None
        if isinstance(metadata, Mapping):
            body["validation"]["languageServer"] = dict(metadata)
        if errors or dry_run:
            return body
        applied: list[_Plan] = []
        try:
            for plan in plans:
                _atomic_write(plan.abs_path, plan.after_bytes)
                applied.append(plan)
        except OSError as exc:
            failed = _rollback(plans, applied)
            body["ok"] = False
            body["status"] = "rolled_back" if not failed else "apply_failed"
            body["errorCode"] = "apply_failed"
            body["error"] = f"{type(exc).__name__}: {exc}"
            body["rolledBack"] = [plan.rel for plan in applied if plan.rel not in failed]
            if failed:
                body["rollbackFailed"] = failed
            return body
        return body


__all__ = ["MAX_PATCH_FILES", "ShadowPatchError", "apply_patch_set", "builtin_validate", "plan_patches"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
