# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# 2026-09-20 批 49,对标 OpenAI codex memory/status + memory/reset
# 引擎记忆面(memory facade)独立底层模块:为引擎记忆提供"只读聚合(status)"
# 与"确认后清空(reset)"两类能力,供主会话稍后接 JSON-RPC 协议出口。
# 设计原则:不引入第二条记忆源;只读路径全部真实读取,无落地文件则不报告文件维度;
# 所有对外函数失败均捕获返回 {"error": str(e)},绝不向上抛——将来挂在 RPC 处理器
# 上不能炸引擎。

from __future__ import annotations

from typing import Any

# 复用 meta_learner 单例(与 user_profile_builder / dream_scheduler 风格一致)。
# 只读聚合走 MetaLearner.get_status();清空按 meta_learner 既有数据结构
# (_lessons / _title_index)安全清除——meta_learner 本身没有批量清空方法。
# 绝不新建记忆实例,也不触碰 meta_learner 的内部逻辑(仅读取与安全清除索引)。
from .meta_learner import meta_learner


def memory_status() -> dict[str, Any]:
    """只读聚合引擎记忆(meta_learner)当前状态。

    聚合维度(全部真实读取;meta_learner 没有的维度省略,绝不 mock):
      - totalLessons:  lessons 总数(来自 meta_learner.get_status())
      - byType:        按 lesson 类型计数(来自 get_status 的 byType)
      - bySkill:       按 sourceSkills 累积的 skill 计数(从内存 lessons 真实派生)
      - avgConfidence: 平均置信度(来自 get_status)
      - lastWriteAt:   最近一次写入时间戳(从 lessons 的 updatedAt/createdAt 取最大,
                       真实派生;lessons 为空时为 None)

    说明:meta_learner 的持久化走 PostgreSQL(agent_meta_lessons 表),没有本地落盘
    文件,因此本接口不报告"文件存在/大小"维度(任务允许的省略情形)。

    任何内部或外部异常都被捕获,返回 {"error": str(e)}——本函数将挂在 RPC 处理器上,
    绝不能向上抛异常导致引擎崩溃。
    """
    try:
        # 外部依赖:meta_learner.get_status()(同步);包在 try 内以保证降级不炸。
        status = meta_learner.get_status()
        lessons = list(meta_learner._lessons.values())

        by_type = status.get("byType", {}) or {}
        total = int(status.get("totalLessons", 0) or 0)
        avg_conf = float(status.get("avgConfidence", 0.0) or 0.0)

        # 按 skill 聚合:一条 lesson 可能归属多个 sourceSkills。
        by_skill: dict[str, int] = {}
        last_write: str | None = None
        for lesson in lessons:
            for skill in lesson.get("sourceSkills") or []:
                key = str(skill)
                by_skill[key] = by_skill.get(key, 0) + 1
            # 最近写入时间戳:ISO 字符串同格式同 UTC,字典序可比,取最大即最新。
            for ts_key in ("updatedAt", "createdAt"):
                ts = lesson.get(ts_key)
                if ts and isinstance(ts, str):
                    if last_write is None or ts > last_write:
                        last_write = ts

        return {
            "totalLessons": total,
            "byType": by_type,
            "bySkill": by_skill,
            "avgConfidence": avg_conf,
            "lastWriteAt": last_write,
        }
    except Exception as e:  # 兜底:绝不向上抛,保证 RPC 出口稳定
        return {"error": str(e)}


def memory_reset(*, confirm: bool = False) -> dict[str, Any]:
    """清空引擎记忆(meta_learner 内存 lessons)。

    设计:meta_learner 没有批量清空方法,且 lessons 持久化在 PostgreSQL(异步、需连接池),
    本同步 facade 只做内存数据结构(_lessons + _title_index)的安全清除,保证在 RPC 处理
    器里不阻塞、不炸引擎。落盘(PostgreSQL)的清空由主会话在异步上下文中另行编排
    (非本模块职责,故返回 dbCleared=False 如实声明)。

    confirm=False(默认):不执行任何清空,返回中文提示,强制调用方明确意图。
    confirm=True:清空前先快照计数,再安全清除内存 lessons,返回清除计数。

    任何异常都被捕获,返回 {"error": str(e)}。
    """
    if not confirm:
        return {
            "confirmed": False,
            "hint": (
                "未确认清空。引擎记忆(meta_learner)将保持不变。"
                "确认清空请显式传入 confirm=True;该操作不可撤销,会清空内存中的全部 lessons。"
            ),
        }
    try:
        # 快照清空前的计数(走 meta_learner 真实状态)。
        before = int(meta_learner.get_status().get("totalLessons", 0) or 0)

        # 按 meta_learner 数据结构安全清除(无批量方法,直接清内存索引)。
        meta_learner._lessons.clear()
        meta_learner._title_index.clear()

        return {
            "confirmed": True,
            "cleared": before,
            "memoryCleared": True,
            "dbCleared": False,
        }
    except Exception as e:  # 兜底:绝不向上抛
        return {"error": str(e)}
