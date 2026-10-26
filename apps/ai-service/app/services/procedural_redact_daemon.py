# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""定时批量 dry-run 审计守护:历史遗留明文 doom_loop pattern(2026-10-26 立)。

成因:清洗器 ``scripts/redact_legacy_procedural_patterns.py`` 判据齐全(幂等、撞键先算后跳、
输出面不打原文),但全仓调用面只有它自己的测试(importlib 按路径加载)⇒ app/ 与提交/守护链
零调用点,存量脏 pattern 永不被清 —— 本仓记过多次的"造好没装车"型(§0.9:机制在而无人调 = 没有)。
写前触发点已由 ``memory_service._redact_legacy_pattern_tail`` 接上(新行不再长明文),本模块补
另一格:**定时批量审计触发点**,让存量脏行有人按时量、有人点名。

纪律(不可动摇,继承清洗器自身的安全设计):
  * 本守护**只跑 dry-run,零写盘** —— 只调 ``run_plan``(纯读),绝不碰 ``apply_updates``/
    ``execute``。写盘仍须部署机交互终端手动 ``--apply --confirm REDACT-LEGACY-PATTERNS`` 再答库名。
  * 判据**不在本模块重造**(§0.6 单一真相源):DSN 解析、schema 校验、撞键判定全部复用清洗器
    脚本本体,经 importlib 按路径加载(与它的测试同一入口,不存在第二份实现可漂移)。
  * 连不上 / 缺 DSN / 库结构不符 ⇒ ``status=undetermined`` 如实记录,**绝不读成"0 行待改写"**
    (清洗器"判不出来就喊 + 退出码 2"的同一条纪律)。
  * 发现待改写或撞键行 ⇒ logger.warning 点名手动 --apply 命令,把"该动手了"递到人面前。

装配:随 lifespan 挂载(见 ``app/main.py``),与过期清扫守护同一档但**默认开** —— 审计本身零副作用,
关掉它只是把"存量没人量"留给下一次;提供 ``PROCEDURAL_REDACT_AUDIT_ENABLED=0`` 显式关档,以及
``PROCEDURAL_REDACT_AUDIT_INTERVAL_SECONDS`` 调间隔(默认 86400s,下限 300s)。循环**先扫后睡**:
进程活多久就至少审一次,频繁重启也不会让首次点名永远排不到。
"""

from __future__ import annotations

import argparse
import asyncio
import importlib.util
import logging
import os
import sys
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL_SECONDS = 86400.0
MIN_INTERVAL_SECONDS = 300.0

_FALSY = {"0", "false", "off", "no"}

# 模块名刻意区别于测试里按路径加载的那份(它叫 redact_legacy_procedural_patterns),
# 避免同一 sys.modules 键位上两个实例互相顶掉。
_CLEANER_MODNAME = "procedural_redact_legacy_cleaner"
_CLEANER_PATH = Path(__file__).resolve().parents[2] / "scripts" / "redact_legacy_procedural_patterns.py"


def _enabled_from_env() -> bool:
    return os.getenv("PROCEDURAL_REDACT_AUDIT_ENABLED", "1").strip().lower() not in _FALSY


def interval_seconds_from_env() -> float:
    """数值档必须校验并当场说明后回落(与 expiry_janitor 同一型:垃圾值不得让守护静默不跑)。"""
    raw = os.getenv("PROCEDURAL_REDACT_AUDIT_INTERVAL_SECONDS")
    if raw is None or not raw.strip():
        return DEFAULT_INTERVAL_SECONDS
    try:
        value = float(raw)
    except ValueError:
        logger.warning(
            "[procedural_redact_audit] PROCEDURAL_REDACT_AUDIT_INTERVAL_SECONDS=%r 读不出数 => 回落默认 %ss",
            raw,
            DEFAULT_INTERVAL_SECONDS,
        )
        return DEFAULT_INTERVAL_SECONDS
    if value != value or value <= 0:  # NaN / 非正值
        logger.warning("[procedural_redact_audit] 间隔=%r 不是正数 => 回落默认 %ss", value, DEFAULT_INTERVAL_SECONDS)
        return DEFAULT_INTERVAL_SECONDS
    if value < MIN_INTERVAL_SECONDS:
        logger.info("[procedural_redact_audit] 间隔 %.1fs 抬到下限 %.1fs", value, MIN_INTERVAL_SECONDS)
        return MIN_INTERVAL_SECONDS
    return value


_cleaner: Any = None


def load_cleaner() -> Any:
    """按路径加载清洗器脚本本体(缓存);判据单源,本模块不复制任何一行判定逻辑。"""
    global _cleaner
    if _cleaner is not None:
        return _cleaner
    spec = importlib.util.spec_from_file_location(_CLEANER_MODNAME, _CLEANER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"清洗器脚本加载失败: {_CLEANER_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    _cleaner = module
    return module


async def sweep_once() -> dict[str, Any]:
    """敲清洗器跑一遍 dry-run 计划(纯读,零写盘),交回结构化计数。

    返回形态两态:
      * ``status="ok"`` —— 真读到库面并完成判定,带 planned/撞键/跳过计数;
      * ``status="undetermined"`` —— 缺 DSN/连不上/schema 不符/任何读不上面的异常,
        只带 reason,**绝不带计数字段**(带 0 会被读成"扫过了,干净")。
    """
    try:
        mod = load_cleaner()
    except Exception as exc:  # 脚本文件被挪走/语法坏 ⇒ 本轮无法判定,不得静默跳过
        logger.warning("[procedural_redact_audit] 清洗器加载失败 => undetermined: %s: %s", type(exc).__name__, exc)
        return {"status": "undetermined", "reason": f"loader: {type(exc).__name__}: {exc}"}

    # 与 CLI --dry-run 同档:apply=False;samples/max_named=0 ⇒ 报告只出计数不出点名。
    args = argparse.Namespace(apply=False, dsn="", samples=0, max_named=0)
    store = None
    try:
        dsn = mod.resolve_dsn(args)
        db_name = mod.database_name_from_dsn(dsn)
        store = await mod.open_store(dsn)
        plan = await mod.run_plan(store, args, db_name)
    except (mod.DsnError, mod.SchemaError, ConnectionError, OSError, TimeoutError) as exc:
        logger.warning(
            "[procedural_redact_audit] 本轮无法判定(undetermined,不是 0 行): %s: %s",
            type(exc).__name__,
            exc,
        )
        return {"status": "undetermined", "reason": f"{type(exc).__name__}: {exc}"}
    except Exception as exc:  # asyncpg 驱动异常等读不上面的形态,同样如实记 undetermined
        logger.warning("[procedural_redact_audit] 本轮审计异常(undetermined): %s: %s", type(exc).__name__, exc)
        return {"status": "undetermined", "reason": f"{type(exc).__name__}: {exc}"}
    finally:
        if store is not None:
            try:
                await store.close()
            except Exception as exc:
                logger.info("[procedural_redact_audit] store.close 失败(忽略): %s", exc)

    collisions = len(plan.collide_with_existing) + len(plan.collide_within_candidates)
    if plan.planned or collisions:
        logger.warning(
            "[procedural_redact_audit] 存量明文 doom_loop:待改写 %d 行,撞键 %d 行;"
            "本守护只审计不写盘,要清请在部署机交互终端手动跑:"
            " python scripts/redact_legacy_procedural_patterns.py --apply --confirm %s(再答一次库名)",
            len(plan.planned),
            collisions,
            mod.CONFIRM_TOKEN,
        )
    return {
        "status": "ok",
        "planned": len(plan.planned),
        "collide_with_existing": len(plan.collide_with_existing),
        "collide_within_candidates": len(plan.collide_within_candidates),
        "safe_skipped": plan.safe_skipped,
        "malformed_skipped": plan.malformed_skipped,
    }


_task: asyncio.Task[Any] | None = None


def _running_task() -> asyncio.Task[Any] | None:
    if _task is not None and not _task.done():
        return _task
    return None


async def _loop(interval: float) -> None:
    while True:
        await sweep_once()
        await asyncio.sleep(interval)


def ensure_started() -> asyncio.Task[Any] | None:
    """幂等装载:已开 ⇒ 返回同一个任务;关档 ⇒ None(no-op)。"""
    global _task
    if not _enabled_from_env():
        logger.info("[procedural_redact_audit] PROCEDURAL_REDACT_AUDIT_ENABLED 关档 => 不装载(未判定为已运行)")
        return None
    existing = _running_task()
    if existing is not None:
        return existing
    interval = interval_seconds_from_env()
    _task = asyncio.create_task(_loop(interval), name="procedural-redact-audit")
    logger.info("[procedural_redact_audit] 已装载(dry-run 审计档,零写盘),间隔 %.0fs", interval)
    return _task


def stop() -> None:
    """lifespan 收尾:取消任务并复位闩,让重进 lifespan 的测试拿到干净状态。"""
    global _task
    if _task is not None:
        _task.cancel()
        _task = None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
