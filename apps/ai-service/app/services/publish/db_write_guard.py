# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""审计写入失败的归因与定级(唯一出口)。

为什么要有这个模块:2026-09-27 实测到 `publish_history` / `publish_notifications` 的
整数主键序列落后表内 max(id),于是每次 INSERT 都撞 `*_pkey` UniqueViolation,而两处写入方
都是 `except Exception → logger.warning` —— **审计静默丢失**(任务判 failed 而库里查不到任何
历史行),`git status`、typecheck、其余守门全都看不出来。

同一条禁令见 AGENTS §5e「失败必须响」:这类"能写下去但写坏了记账"的失败必须**响亮**并给出
修复出口,不得降成一行 warning。定级判据只有一份,两处写入方共用(禁止各写各的)。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

_PKEY_HINTS = ("_pkey", "duplicate key value violates unique constraint")


@dataclass(frozen=True)
class DbWriteFailure:
    """一次数据库写入失败的判定结果。"""

    level: str  # "error" | "warning"
    message: str
    repair_hint: str | None


def classify_db_write_failure(exc: BaseException, *, table: str) -> DbWriteFailure:
    """把异常分成"序列落后撞主键"(判 ERROR + 给出修复命令)与"其它"(判 WARNING)。

    Args:
        exc: 捕获到的异常(asyncpg 或别的驱动都可能)
        table: 目标表名,用于点名是哪张表、拼出可复制的修复命令
    """
    text = f"{type(exc).__name__}: {exc}"
    lowered = text.lower()
    is_pkey_clash = "uniqueviolation" in lowered or (
        "duplicate key" in lowered and any(h in lowered for h in _PKEY_HINTS)
    )
    if is_pkey_clash and table in text:
        return DbWriteFailure(
            level="error",
            message=(
                f"{table} 写入撞主键 —— 绝大多数原因是该表 id 序列落后于 max(id),"
                f"结果是**审计记录静默丢失**(不是功能失败,是记账消失):{text}"
            ),
            repair_hint="pnpm check:sequence-lag:fix(只向前推,绝不回拨)；只读探测:pnpm check:sequence-lag",
        )
    if is_pkey_clash:
        # 撞主键但报文本里没点名本表 ⇒ 可能是唯一索引冲突(真业务重复),按 ERROR 报但不给序列修复命令
        return DbWriteFailure(
            level="error",
            message=f"{table} 写入报唯一约束冲突(未必是序列落后,也可能是真重复):{text}",
            repair_hint="先跑 pnpm check:sequence-lag 排除序列落后,再判是否真重复",
        )
    return DbWriteFailure(level="warning", message=f"{table} 写入失败:{text}", repair_hint=None)


def log_db_write_failure(logger: Any, exc: BaseException, *, table: str, prefix: str) -> DbWriteFailure:
    """按判定结果打日志。失效方向:宁可多喊一次,绝不静默。"""
    verdict = classify_db_write_failure(exc, table=table)
    if verdict.level == "error":
        logger.error(f"{prefix} {verdict.message} 修复:{verdict.repair_hint}")
    else:
        logger.warning(f"{prefix} {verdict.message}")
    return verdict


__all__ = ["DbWriteFailure", "classify_db_write_failure", "log_db_write_failure"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
