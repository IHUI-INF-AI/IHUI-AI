# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/command_canonicalization.py
"""审批缓存命令规范化(2026-09-19 第二十六批,对标 Codex command_canonicalization.rs)。

用途:同一条命令经不同 shell 包装路径到达时(/bin/bash -lc 'git status' vs
bash -lc 'git status' vs 直接 ['git','status']),审批决策应保持一致——
避免"换个包装就要再批一次"的用户体验损耗,同时绝不放松安全性:

- **简单脚本还原**:bash/sh -lc 的脚本若只是"一条纯命令"(无 ;、|、&&、
  重定向、命令替换等复合结构),直接还原为词法化后的 argv,与"用户
  直接执行"同形 → 命中同一审批缓存;
- **复杂脚本保守规范化**:无法安全还原时,归一为固定前缀 + shell 模式 +
  原文脚本(`__ihui_shell_script__` / `__ihui_powershell_script__`),
  保证复杂脚本间不会误互相命中;
- **其余 argv 原样返回**。
"""

from __future__ import annotations

import shlex
from typing import Optional, Sequence

CANONICAL_BASH_SCRIPT_PREFIX = "__ihui_shell_script__"
CANONICAL_POWERSHELL_SCRIPT_PREFIX = "__ihui_powershell_script__"

_BASH_LIKE = {"bash", "sh", "zsh", "dash", "/bin/bash", "/bin/sh", "/usr/bin/bash", "/usr/bin/sh"}
_PWSH_LIKE = {"powershell", "pwsh", "powershell.exe", "pwsh.exe"}

# 纯命令判定:出现下列任一片段即视为复合脚本,不做词法还原
_COMPOSITE_MARKERS = (
    ";", "|", "&", ">", "<", "$(", "`", "\n", "#", "&&", "||",
)


def _extract_bash_command(argv: Sequence[str]) -> Optional[tuple[str, str]]:
    """从 argv 提取 (shell_mode, script);形如 bash [-l] -c '<script>'。"""
    if not argv:
        return None
    base = argv[0]
    if base not in _BASH_LIKE and not base.endswith("bash") and not base.endswith("/bash") and not base.endswith("/sh"):
        return None
    rest = argv[1:]
    login = False
    script: Optional[str] = None
    i = 0
    while i < len(rest):
        arg = rest[i]
        if arg == "-l" or arg == "--login":
            login = True
            i += 1
            continue
        if arg == "-c" or arg == "--command" or arg == "-lc" or arg == "-cl":
            # -lc 合并形式:脚本在下一个参数
            if arg in ("-lc", "-cl") and len(arg) == 3:
                script = rest[i + 1] if i + 1 < len(rest) else ""
                i += 2
                break
            script = rest[i + 1] if i + 1 < len(rest) else ""
            i += 2
            break
        # 其他选项(如 -e)则放弃识别(保守)
        if arg.startswith("-") and len(arg) > 1:
            return None
        return None
    if script is None:
        return None
    return ("login" if login else "shell", script)


def _extract_powershell_command(argv: Sequence[str]) -> Optional[str]:
    """从 argv 提取 PowerShell -Command 脚本。"""
    if not argv:
        return None
    base = argv[0]
    if base not in _PWSH_LIKE and not base.lower().endswith("powershell.exe") and not base.lower().endswith("pwsh.exe"):
        return None
    rest = argv[1:]
    for i, arg in enumerate(rest):
        if arg.lower() in ("-command", "-c"):
            return rest[i + 1] if i + 1 < len(rest) else ""
    return None


def _is_plain_single_command(script: str) -> bool:
    """脚本是否只是一条纯命令(可安全词法还原)。"""
    if not script.strip():
        return False
    return not any(marker in script for marker in _COMPOSITE_MARKERS)


def parse_shell_lc_plain_commands(argv: Sequence[str]) -> Optional[list[list[str]]]:
    """bash -lc '<纯单命令>' → 词法化后的单条命令 argv 列表。

    复合脚本返回 None(调用方走保守规范化);非 shell 包装返回 None。
    (对标 parse_shell_lc_plain_commands 的"恰好一条纯命令"用法)
    """
    extracted = _extract_bash_command(argv)
    if extracted is None:
        return None
    _mode, script = extracted
    if not _is_plain_single_command(script):
        return None
    try:
        tokens = shlex.split(script)
    except ValueError:
        return None
    if not tokens:
        return None
    return [tokens]


def canonicalize_command_for_approval(argv: Sequence[str]) -> list[str]:
    """审批缓存键规范化主入口(对标 canonicalize_command_for_approval)。"""
    argv = [str(a) for a in argv]
    commands = parse_shell_lc_plain_commands(argv)
    if commands is not None and len(commands) == 1:
        return list(commands[0])

    extracted = _extract_bash_command(argv)
    if extracted is not None:
        shell_mode, script = extracted
        return [CANONICAL_BASH_SCRIPT_PREFIX, shell_mode, script]

    ps_script = _extract_powershell_command(argv)
    if ps_script is not None:
        return [CANONICAL_POWERSHELL_SCRIPT_PREFIX, ps_script]

    return list(argv)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
