# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""用户 shell 命令片段(2026-09-19 第四十二批,对标 codex context/user_shell_command.rs)。

用户批准后执行的命令,其结构化结果(command/exit_code/duration/output)以
``<user_shell_command>`` user 片段回填进历史,让模型以统一形态感知"用户亲自
批准的那条命令"的执行结果(与普通 tool 消息不同:该片段携带批准语义上下文)。

设计要点:
- 渲染函数纯函数化,失败安全(任何字段缺失都能渲染,不抛错)。
- output 截断上限可控(默认 4000 字符,防大输出打爆上下文)。
- USER_CONTEXTUAL_PREFIXES 补齐标记,摘要/裁剪链路不漏识别。
"""

from __future__ import annotations

from typing import Any

__all__ = [
    "USER_SHELL_COMMAND_OPEN_TAG",
    "USER_SHELL_COMMAND_CLOSE_TAG",
    "USER_SHELL_COMMAND_OUTPUT_LIMIT",
    "build_user_shell_command_fragment",
    "is_user_shell_command_fragment",
]

USER_SHELL_COMMAND_OPEN_TAG = "<user_shell_command>"
USER_SHELL_COMMAND_CLOSE_TAG = "</user_shell_command>"
USER_SHELL_COMMAND_OUTPUT_LIMIT = 4000


def _exit_code(result: dict[str, Any]) -> int:
    """exit code 提取(exit_code/exitCode 双键名兼容,缺省 -1)。"""
    raw = result.get("exit_code", result.get("exitCode", -1))
    try:
        return int(raw)
    except (TypeError, ValueError):
        return -1


def _duration_seconds(result: dict[str, Any]) -> float:
    """时长提取(duration_ms 毫秒 → 秒;兼容 duration_seconds 秒)。"""
    if "duration_seconds" in result:
        try:
            return float(result["duration_seconds"])
        except (TypeError, ValueError):
            return 0.0
    raw = result.get("duration_ms", 0)
    try:
        return max(0.0, float(raw)) / 1000.0
    except (TypeError, ValueError):
        return 0.0


def build_user_shell_command_fragment(
    command: str,
    result: dict[str, Any],
    *,
    output_limit: int = USER_SHELL_COMMAND_OUTPUT_LIMIT,
) -> dict[str, Any]:
    """渲染 ``<user_shell_command>`` user 片段(对标 UserShellCommand::body)。

    Args:
        command: 命令文本(用户批准的那条)。
        result: run_command 结果 dict(exit_code/stdout/stderr/duration_ms 等)。
        output_limit: 输出截断上限(字符)。

    Returns:
        OpenAI 格式 user 消息(content 为 list,单 input_text 项)。
        失败安全:result 非 dict 时按空结果渲染。
    """
    safe_result = result if isinstance(result, dict) else {}
    exit_code = _exit_code(safe_result)
    duration = _duration_seconds(safe_result)
    output = str(safe_result.get("stdout", "") or "")
    stderr = str(safe_result.get("stderr", "") or "")
    if stderr:
        output = f"{output}\n[stderr]\n{stderr}" if output else f"[stderr]\n{stderr}"
    if len(output) > output_limit:
        output = output[:output_limit] + f"\n...[truncated {len(output) - output_limit} chars]"
    text = (
        USER_SHELL_COMMAND_OPEN_TAG
        + "\n<command>\n"
        f"{command}\n"
        "</command>\n"
        "<result>\n"
        f"Exit code: {exit_code}\n"
        f"Duration: {duration:.4f} seconds\n"
        "Output:\n"
        f"{output}\n"
        "</result>\n"
        + USER_SHELL_COMMAND_CLOSE_TAG
    )
    return {
        "role": "user",
        "content": [{"type": "input_text", "text": text}],
    }


def is_user_shell_command_fragment(text: str) -> bool:
    """判定文本是否为 user_shell_command 片段(摘要/裁剪链路识别用)。"""
    return text.lstrip().startswith(USER_SHELL_COMMAND_OPEN_TAG)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
