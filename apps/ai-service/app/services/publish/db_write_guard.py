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

G-815958 补全第二维度:「该不该重试」三分语义 —— 40001/40P01 可重试(有界退避),
23505/23503 不可重试(立即上抛),其余错误码一律**未判定**(不自动重试、不吞异常、
原样上抛并在判定记录里标 undetermined)。三态不许压成两档:把未判定并进任何一档,
都是在替未知故障背书。判据与边界详见下方常量区注释。
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

_PKEY_HINTS = ("_pkey", "duplicate key value violates unique constraint")


# ---------------------------------------------------------------------------
# G-815958:「该不该重试」三分语义 —— 不许把失败统统塞进同一个 except。
#
# 上游经验(migration-runner):错误必须按"可处理位置"分型、退避必须有界。
# Postgres 侧三分:
#   - 40001(serialization failure)/ 40P01(deadlock detected) ⇒ **可重试**:
#     瞬时性冲突,有界退避后重试(10ms 起步、逐次翻倍、封顶 200ms、总尝试次数有界)
#     —— 业务连接绝不继承迁移工具那种长等待预算。
#   - 23505(unique violation)/ 23503(foreign key violation) ⇒ **不可重试**:
#     语义性失败,重试一万次还是同一个结果,必须立刻原样上抛。
#   - 其余错误码 ⇒ **未判定**(三态里的第三态):既不冒充可重试也不冒充不可重试,
#     不自动重试、不吞异常,原样上抛并在判定记录里标 undetermined。
#
# 判定只认两类硬证据,刻意**不认错误消息文本**(消息里出现 "serialization" 的场景
# 太多,例如 "error serializing request payload",拿文本判重试必然误伤):
#   1) 错误码属性:沿 __cause__ 链找 asyncpg 的 sqlstate / psycopg2 的 pgcode;
#   2) 异常类名:覆盖两族命名(asyncpg 的 *Error 与 psycopg2 的裸名)。
# 有码但码不在两份名单里(如 25P02)⇒ 未判定;此时哪怕类名看着像也不翻案:码是权威。
# ---------------------------------------------------------------------------

RETRYABLE_SQLSTATES: frozenset[str] = frozenset({"40001", "40P01"})
NON_RETRYABLE_SQLSTATES: frozenset[str] = frozenset({"23505", "23503"})

# 类名标记(小写子串):asyncpg(SerializationError/DeadlockDetectedError/
# UniqueViolationError/ForeignKeyViolationError)与 psycopg2(SerializationFailure/
# DeadlockDetected/UniqueViolation/ForeignKeyViolation)两族全覆盖。
_RETRYABLE_CLASS_MARKERS = ("serializationerror", "serializationfailure", "deadlockdetected")
_NON_RETRYABLE_CLASS_MARKERS = ("uniqueviolation", "foreignkeyviolation")

DISPOSITION_RETRY = "retry"
DISPOSITION_RAISE = "raise"
DISPOSITION_UNDETERMINED = "undetermined"

DEFAULT_MAX_ATTEMPTS = 3
DEFAULT_BACKOFF_INITIAL_MS = 10
DEFAULT_BACKOFF_CAP_MS = 200


@dataclass(frozen=True)
class DbWriteRetryVerdict:
    """一次失败「该不该重试」的三态判定。

    retryable 三态:True=可重试(有界退避) / False=不可重试(立即上抛) /
    None=未判定(不自动重试、不吞、原样上抛)。三态不许压成两档。
    """

    retryable: bool | None
    disposition: str  # DISPOSITION_RETRY / DISPOSITION_RAISE / DISPOSITION_UNDETERMINED
    sqlstate: str | None  # 判定所依据的错误码(拿不到时为 None)
    basis: str  # "sqlstate" | "exception-class" | "none"
    max_attempts: int  # retryable=True 时允许的总尝试次数(有界);其余恒为 1


def _pg_error_code(exc: BaseException) -> str | None:
    """沿 __cause__ 链找 SQLSTATE:asyncpg 挂在 sqlstate,psycopg2 挂在 pgcode。"""
    cur: BaseException | None = exc
    seen: set[int] = set()
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        for attr in ("sqlstate", "pgcode"):
            val = getattr(cur, attr, None)
            if isinstance(val, str) and val:
                return val.upper()
        cur = cur.__cause__
    return None


def _class_marker_hit(exc: BaseException, markers: tuple[str, ...]) -> bool:
    """类名标记是否命中(同样沿 __cause__ 链,包装异常不漏判)。"""
    cur: BaseException | None = exc
    seen: set[int] = set()
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        name = type(cur).__name__.lower()
        if any(marker in name for marker in markers):
            return True
        cur = cur.__cause__
    return False


def classify_write_retryability(exc: BaseException) -> DbWriteRetryVerdict:
    """三态判定「该不该重试」。判据与边界见上方常量区注释。"""
    code = _pg_error_code(exc)
    if code is not None:
        if code in RETRYABLE_SQLSTATES:
            return DbWriteRetryVerdict(
                retryable=True,
                disposition=DISPOSITION_RETRY,
                sqlstate=code,
                basis="sqlstate",
                max_attempts=DEFAULT_MAX_ATTEMPTS,
            )
        if code in NON_RETRYABLE_SQLSTATES:
            return DbWriteRetryVerdict(
                retryable=False,
                disposition=DISPOSITION_RAISE,
                sqlstate=code,
                basis="sqlstate",
                max_attempts=1,
            )
        # 有码但不在两份名单 ⇒ 未判定,哪怕类名像也不翻案(码是权威)。
        return DbWriteRetryVerdict(
            retryable=None,
            disposition=DISPOSITION_UNDETERMINED,
            sqlstate=code,
            basis="sqlstate",
            max_attempts=1,
        )
    if _class_marker_hit(exc, _RETRYABLE_CLASS_MARKERS):
        return DbWriteRetryVerdict(
            retryable=True,
            disposition=DISPOSITION_RETRY,
            sqlstate=None,
            basis="exception-class",
            max_attempts=DEFAULT_MAX_ATTEMPTS,
        )
    if _class_marker_hit(exc, _NON_RETRYABLE_CLASS_MARKERS):
        return DbWriteRetryVerdict(
            retryable=False,
            disposition=DISPOSITION_RAISE,
            sqlstate=None,
            basis="exception-class",
            max_attempts=1,
        )
    return DbWriteRetryVerdict(
        retryable=None,
        disposition=DISPOSITION_UNDETERMINED,
        sqlstate=None,
        basis="none",
        max_attempts=1,
    )


def run_db_write_with_retry(
    write: Callable[[], Any],
    *,
    table: str,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    backoff_initial_ms: int = DEFAULT_BACKOFF_INITIAL_MS,
    backoff_cap_ms: int = DEFAULT_BACKOFF_CAP_MS,
    sleep: Callable[[float], None] = time.sleep,
    records: list[DbWriteRetryVerdict] | None = None,
) -> Any:
    """执行一次写入,失败按三分语义处理(判据见 classify_write_retryability)。

    - retryable=True:有界退避重试 —— initial 起步逐次翻倍、封顶 cap、总尝试
      max_attempts 次(含首次),预算耗尽即原样上抛最后一次的异常;
    - retryable=False / None(未判定):一律**不重试、不吞、原样**(同一对象)上抛;
    - records(可选):每失败一次追加一条判定,供调用方/测试核账,undetermined 在此留痕。
    上抛走裸 raise 不包装 —— 中间层不得覆盖原始数据库异常。
    """
    attempts_allowed = max_attempts if max_attempts >= 1 else 1
    delay_ms = backoff_initial_ms
    attempt = 0
    while True:
        attempt += 1
        try:
            return write()
        except Exception as exc:
            verdict = classify_write_retryability(exc)
            if records is not None:
                records.append(verdict)
            if verdict.retryable is True and attempt < attempts_allowed:
                sleep(min(delay_ms, backoff_cap_ms) / 1000)
                delay_ms = min(delay_ms * 2, backoff_cap_ms)
                continue
            raise


@dataclass(frozen=True)
class DbWriteFailure:
    """一次数据库写入失败的判定结果。"""

    level: str  # "error" | "warning"
    message: str
    repair_hint: str | None
    # G-815958 补全:「该不该重试」三态(True/False/None=未判定),与 severity 正交。
    retryable: bool | None = None


def classify_db_write_failure(exc: BaseException, *, table: str) -> DbWriteFailure:
    """把异常分成"序列落后撞主键"(判 ERROR + 给出修复命令)与"其它"(判 WARNING)。

    Args:
        exc: 捕获到的异常(asyncpg 或别的驱动都可能)
        table: 目标表名,用于点名是哪张表、拼出可复制的修复命令
    """
    text = f"{type(exc).__name__}: {exc}"
    lowered = text.lower()
    retry = classify_write_retryability(exc)
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
            retryable=retry.retryable,
        )
    if is_pkey_clash:
        # 撞主键但报文本里没点名本表 ⇒ 可能是唯一索引冲突(真业务重复),按 ERROR 报但不给序列修复命令
        return DbWriteFailure(
            level="error",
            message=f"{table} 写入报唯一约束冲突(未必是序列落后,也可能是真重复):{text}",
            repair_hint="先跑 pnpm check:sequence-lag 排除序列落后,再判是否真重复",
            retryable=retry.retryable,
        )
    return DbWriteFailure(
        level="warning",
        message=f"{table} 写入失败:{text}",
        repair_hint=None,
        retryable=retry.retryable,
    )


def log_db_write_failure(logger: Any, exc: BaseException, *, table: str, prefix: str) -> DbWriteFailure:
    """按判定结果打日志。失效方向:宁可多喊一次,绝不静默。"""
    verdict = classify_db_write_failure(exc, table=table)
    # 三态原样进日志:None=未判定,不许在日志里冒充两态(G-815958)。
    tag = f" [retryable={verdict.retryable}]"
    if verdict.level == "error":
        logger.error(f"{prefix} {verdict.message} 修复:{verdict.repair_hint}{tag}")
    else:
        logger.warning(f"{prefix} {verdict.message}{tag}")
    return verdict


__all__ = [
    "DbWriteFailure",
    "DbWriteRetryVerdict",
    "classify_db_write_failure",
    "classify_write_retryability",
    "log_db_write_failure",
    "run_db_write_with_retry",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
