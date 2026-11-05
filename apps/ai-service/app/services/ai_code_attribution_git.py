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

import logging
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
