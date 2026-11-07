# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 代码归属账的 git 回溯执行器(2026-11-05,goal-b49)。

只做一件事:拿账目里的锚(提交 sha + 路径 + 行区间)真跑 ``git blame --porcelain``,
把「这段是谁写的」问出来。

判定与裁决不在这里:归属判定住在 app/core/ai_code_attribution.py,「回溯不出 ⇒
unresolved」的裁决也住在那儿(core 的 resolve_anchor);本模块只负责**执行**与
**如实报错**:git 不可用 / 非仓库 / 路径不存在 / 超时 ⇒ 一律返回失败 + 原因,
绝不返回空成功。
"""

from __future__ import annotations

import json
import logging
import re
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

#: git 子进程超时(秒):回溯是辅助面,不许把主链路挂住。
GIT_TIMEOUT_S = 15


def detect_repo_root(start: Path | None = None) -> Path | None:
    """探测 git 仓库根;取不到(无 git / 非仓库 / 超时)返回 None(未判定,不猜)。"""
    cwd = start or Path.cwd()
    try:
        proc = subprocess.run(
            ["git", "-C", str(cwd), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            timeout=GIT_TIMEOUT_S,
            check=False,
            encoding="utf-8",
            errors="replace",
        )
    except (OSError, subprocess.SubprocessError) as exc:
        logger.warning("git 仓库根探测失败: %s", exc)
        return None
    if proc.returncode != 0:
        return None
    root = proc.stdout.strip()
    return Path(root) if root else None


def git_blame(
    repo_root: Path,
    commit_sha: str,
    path: str,
    line_start: int,
    line_end: int,
) -> tuple[bool, str, tuple[str, ...]]:
    """真跑 git blame 回溯一段行区间。

    Returns:
        ``(成功?, 说明, 命中提交 sha 列表)``。任何失败都返回 ``(False, 原因, ())``
        —— 回溯不出就说回溯不出,绝不假装成功。
    """
    cmd = [
        "git",
        "-C",
        str(repo_root),
        "blame",
        "--porcelain",
        f"-L{line_start},{line_end}",
        commit_sha,
        "--",
        path,
    ]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=GIT_TIMEOUT_S,
            check=False,
            encoding="utf-8",
            errors="replace",
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return False, f"git blame 不可用:{exc}", ()
    if proc.returncode != 0:
        detail = (proc.stderr or "").strip().splitlines()
        reason = detail[0][:200] if detail else f"git blame rc={proc.returncode}"
        return False, reason, ()
    commits: list[str] = []
    for line in proc.stdout.splitlines():
        parts = line.split(" ")
        if len(parts) >= 3 and len(parts[0]) == 40:
            sha = parts[0]
            if sha not in commits:
                commits.append(sha)
    if not commits:
        return False, "git blame 未给出任何提交锚", ()
    return True, f"git blame 命中 {len(commits)} 个提交", tuple(commits)


_SHA40 = re.compile(r"^[0-9a-fA-F]{40}$")
_NAMESPACE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$")
NOTES_REF_DEFAULT = "refs/notes/ai"


def notes_ref_for_namespace(namespace: str | None) -> str | None:
    """空命名空间用默认 ref。带斜杠或其它形态的名字拒绝，不改写成默认。"""
    if namespace is None:
        return NOTES_REF_DEFAULT
    token = namespace.strip()
    if token == "" or token == "default":
        return NOTES_REF_DEFAULT
    if _NAMESPACE.fullmatch(token) is None:
        return None
    return f"refs/notes/ai-{token}"


def judge_notes_refs(refs: list[str] | None) -> dict[str, object]:
    """名单没量到就不说缺。一个都没有是缺。多于一个把全部点名，不取第一个。"""
    if refs is None:
        return {"status": "unjudged", "message": "notes 引用名单没量到", "refs": []}
    family = [
        ref
        for ref in refs
        if ref == NOTES_REF_DEFAULT or ref.startswith("refs/notes/ai-")
    ]
    if not family:
        return {"status": "absent", "message": "Expected notes ref is present", "refs": []}
    if len(family) > 1:
        return {
            "status": "multiple",
            "message": "Multiple git-ai note namespaces detected",
            "refs": family,
        }
    return {"status": "present", "message": "ok", "refs": family}


def _git(repo_root: Path, args: list[str]) -> subprocess.CompletedProcess[str] | None:
    try:
        return subprocess.run(
            ["git", "-C", str(repo_root), *args],
            capture_output=True,
            text=True,
            timeout=GIT_TIMEOUT_S,
            check=False,
            encoding="utf-8",
            errors="replace",
        )
    except (OSError, subprocess.SubprocessError) as exc:
        logger.warning("git notes 调用失败: %s", exc)
        return None


def list_notes_refs(repo_root: Path) -> list[str] | None:
    """列出 refs/notes。命令失败返回 None，成功但没有引用返回空列表。"""
    proc = _git(repo_root, ["for-each-ref", "--format=%(refname)", "refs/notes"])
    if proc is None or proc.returncode != 0:
        return None
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def attach_checkpoint_note(
    repo_root: Path,
    commit_sha: str,
    record: dict[str, object],
    *,
    namespace: str = "",
) -> tuple[str, str]:
    """把一条检查点追加到该提交的 notes。同一去重键不写第二次。失败不抛。"""
    ref = notes_ref_for_namespace(namespace)
    if ref is None:
        return "refused", "notes 命名空间不能用"
    sha = (commit_sha or "").strip().lower()
    if _SHA40.fullmatch(commit_sha or "") is None:
        return "refused", "提交号不是 40 位"
    key = record.get("dedupe_key")
    if not isinstance(key, str) or not key.strip():
        return "refused", "检查点没有去重键"
    shown = _git(repo_root, ["notes", "--ref", ref, "show", sha])
    if shown is None:
        return "refused", "git notes 读不到"
    if shown.returncode == 0:
        if key in shown.stdout:
            return "duplicate", ""
    else:
        err = shown.stderr or ""
        if "no note found" not in err.lower():
            shown_lines = err.strip().splitlines()
            return "refused", (shown_lines[0][:200] if shown_lines else "git notes 读不到")
    message = json.dumps(record, ensure_ascii=False, separators=(",", ":"))
    added = _git(repo_root, ["notes", "--ref", ref, "append", "-m", message, sha])
    if added is None or added.returncode != 0:
        reason = ""
        if added is not None:
            added_lines = (added.stderr or "").strip().splitlines()
            reason = added_lines[0][:200] if added_lines else f"rc={added.returncode}"
        return "refused", reason or "git notes 写不了"
    return "appended", ""


def _parse_note_body(body: str) -> tuple[list[dict[str, object]], str]:
    rows: list[dict[str, object]] = []
    for line in body.splitlines():
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except ValueError:
            return [], "notes 读不到,不能把它说成没有检查点"
        if not isinstance(item, dict):
            return [], "notes 读不到,不能把它说成没有检查点"
        rows.append(item)
    return rows, ""


def read_commit_notes(
    repo_root: Path,
    commit_sha: str,
    *,
    namespace: str = "",
) -> dict[str, object]:
    """按提交读 notes。引用不在、这个提交没记、名单没量到，三种读数各说各的。"""
    ref = notes_ref_for_namespace(namespace)
    if ref is None:
        return {"status": "refused", "message": "notes 命名空间不能用", "checkpoints": [], "refs": []}
    if _SHA40.fullmatch(commit_sha or "") is None:
        return {"status": "refused", "message": "提交号不是 40 位", "checkpoints": [], "refs": []}
    sha = commit_sha.strip().lower()
    listed = list_notes_refs(repo_root)
    if listed is None:
        return {"status": "unjudged", "message": "notes 引用名单没量到", "checkpoints": [], "refs": []}
    family = [item for item in listed if item == NOTES_REF_DEFAULT or item.startswith("refs/notes/ai-")]
    pinned = namespace.strip() not in ("", "default")
    if not pinned and len(family) > 1:
        return {
            "status": "multiple",
            "message": "Multiple git-ai note namespaces detected",
            "checkpoints": [],
            "refs": family,
        }
    if ref not in listed:
        message = "Expected notes ref is present" if ref == NOTES_REF_DEFAULT else "这个命名空间的 notes 引用不在"
        return {"status": "absent", "message": message, "checkpoints": [], "refs": family}
    shown = _git(repo_root, ["notes", "--ref", ref, "show", sha])
    if shown is None:
        return {"status": "unjudged", "message": "git notes 读不到", "checkpoints": [], "refs": family}
    if shown.returncode != 0:
        err = (shown.stderr or "").lower()
        if "no note found" in err:
            return {"status": "empty", "message": "这个提交上没有检查点", "checkpoints": [], "refs": family}
        if "bad object" in err or "needed a single revision" in err or "ambiguous argument" in err:
            return {"status": "refused", "message": "提交在这个仓库里找不到", "checkpoints": [], "refs": family}
        detail = (shown.stderr or "").strip().splitlines()
        return {
            "status": "refused",
            "message": detail[0][:200] if detail else "git notes 读不到",
            "checkpoints": [],
            "refs": family,
        }
    rows, refused = _parse_note_body(shown.stdout)
    if refused:
        return {"status": "refused", "message": refused, "checkpoints": [], "refs": family}
    if not rows:
        return {"status": "empty", "message": "这个提交上没有检查点", "checkpoints": [], "refs": family}
    return {"status": "present", "message": "ok", "checkpoints": rows, "refs": family}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
