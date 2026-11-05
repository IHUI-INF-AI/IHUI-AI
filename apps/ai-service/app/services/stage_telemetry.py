# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""阶段化遥测单源(2026-11-05 goal-b49 Z19,缺口表 T9 §10 #3)。

票面要的是「逐段 result + 耗时 + 计数」这一**维**;形状本仓不是没有 ——
`rag.RAGResult.trace`(`{node, duration_ms, *_count}`)与 `conversation.py` 都在产,缺的是
`search_codebase` 这条链路没接。本模块只补那两处没有的三件事,不与之并成第二份口径:
1. **固定段序**:每个工具的段清单只在这里声明一次(§0.6),消费方不得自立段名;
2. **结论词表零新造**:`ok/empty/failed/timeout/unavailable/skipped` 逐字取自在册的
   `reasons[].status`,`unjudged` 逐字取自 `stats["mode"]` 五档与 §0.3 —— 不加档;越界值
   原值留痕但按未判定记,不折叠成邻近档(与 sandbox_metrics 同律);
3. **缺项结构上不可能**:跳过段显式 `skipped`,没走到的段由 `finalize()` 显式补 `unjudged`。

两条硬规矩:量不到耗时 ⇒ `duration_ms=None`(行里渲染 `unjudged`),**绝不用 0 冒充 0ms**
(§0.3;0 还会污染直方图最低桶);记账腿(结论行 + metrics)坏不许带走业务 —— 只 warn,
段仍进返回体(§5e)。结论行 = 每段恰好一行 `[stage_result] tool=… stage=… result=…
duration_ms=… count=… trace_id=…`,整行预格式化(不靠位置参数),键名 snake_case 与全仓
遥测出参同族(不抄靶件的 camelCase);经 `app/core/logging.get_logger`,故凭据脱敏 processor
与既有落盘链一字不改地覆盖到它。
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)
# 结构化结论行的事件名(grep 锚点;改名即破在册消费方)
STAGE_LOG_EVENT = "stage_result"
# 取不到时的线格式哨兵(与 stats["mode"] 的 "unjudged" 同词,不另造 "unknown"/"n/a")
UNJUDGED = "unjudged"
# 既有 metrics 面的在册名(声明只在 telemetry_service._init_metrics 一处,这里只引用)
STAGE_COUNTER_NAME = "retrieval_stage_total"
STAGE_HISTOGRAM_NAME = "retrieval_stage_duration_ms"
# 结论词表:逐字来自在册两处(见 docstring 第 2 条);新增档必须同批改消费方。
STAGE_RESULTS: tuple[str, ...] = ("ok", "empty", "failed", "timeout", "unavailable", "skipped", "unjudged")
# 六段固定序(Z4 分诊表 §② #6 的「六段固定序」即此序);段清单的唯一登记处在 _TOOL_STAGES。
SEARCH_CODEBASE_STAGES: tuple[str, ...] = (
    "validate", "keyword_leg", "semantic_leg", "lazy_index", "fuse", "assemble",
)
_TOOL_STAGES: dict[str, tuple[str, ...]] = {"search_codebase": SEARCH_CODEBASE_STAGES}


def stages_of(tool: str) -> tuple[str, ...]:
    """取某工具的固定段序;未登记的工具 ⇒ 空元组(调用方据此记未判定)。"""
    return _TOOL_STAGES.get(tool, ())


def _monotonic_ms() -> float | None:
    """量一段的毫秒时刻;量不到 ⇒ None(未判定,绝不回落 0)。"""
    try:
        return time.perf_counter() * 1000.0
    except Exception as exc:  # noqa: BLE001 - 时钟取不到只是少一个维度,不许打挂检索
        logger.warning("stage_telemetry 时钟不可用,耗时维度记未判定: %s: %s", type(exc).__name__, exc)
        return None


def _render(value: float | int | None) -> str:
    """把「取不到」渲染成在册的 unjudged 词,而不是空串或 0。"""
    if value is None:
        return UNJUDGED
    if isinstance(value, float):
        return f"{round(value, 2):g}"
    return str(value)


def _resolve_trace_id() -> str | None:
    """本轮 trace 身份**只从在册那一份 ContextVar 取**(与 core/tool_call_trace.py 同源):
    不在这里再解析一遍 traceparent(§0.6);取不到 ⇒ None,行里渲染 `unjudged`,不编临时 id。
    """
    try:
        from app.middleware.trace_context import current_trace_id

        value = current_trace_id()
    except Exception:  # noqa: BLE001 - 无请求上下文(离线/测试)本就不是错误
        return None
    return value if isinstance(value, str) and value else None


@dataclass(frozen=True)
class StageRecord:
    """一段的结论(返回体 `stages` 里的一项的形状,全仓只此一份)。"""

    stage: str
    result: str
    duration_ms: float | None
    count: int | None
    detail: str | None = None

    def as_dict(self) -> dict[str, Any]:
        """投影成响应体条目(键名在册:duration_ms 同 rag/conversation 的 trace)。"""
        return {
            "stage": self.stage,
            "result": self.result,
            "duration_ms": None if self.duration_ms is None else round(self.duration_ms, 2),
            "count": self.count,
            "detail": self.detail,
        }


class StageRecorder:
    """一次调用一份段账:按固定序记账、出投影、逐段落一条结构化结论行。"""

    def __init__(self, tool: str, trace_id: str | None = None) -> None:
        self._tool = tool
        self._stages = stages_of(tool)
        self._trace_id = trace_id or _resolve_trace_id()
        self._records: dict[str, StageRecord] = {}

    def record(
        self,
        stage: str,
        result: str,
        *,
        duration_ms: float | None = None,
        count: int | None = None,
        detail: str | None = None,
    ) -> StageRecord:
        """记一段的结论并出结构化行。

        越界的段名/结论词**不判死、不折叠成邻近档**(§0.3 与 sandbox_metrics 同律):
        原值保留、可查,但会在行里点名 `result=unjudged`,不让「词表外的值」冒充判定过。
        """
        known_result = result in STAGE_RESULTS
        known_stage = stage in self._stages
        previous = self._records.get(stage)
        if previous is not None:
            # 一格一读数:同段二次记账只保留第一次的既成事实,并当场点名(绝不补发第二行)
            logger.warning(
                "stage_telemetry 同段二次记账(取第一次结论 %s,新值 %s 不进册): tool=%s stage=%s",
                previous.result, result, self._tool, stage,
            )
            return previous
        emitted = result if known_result else UNJUDGED
        if not known_result:
            logger.warning("stage_telemetry 结论词越界: tool=%s stage=%s value=%s", self._tool, stage, result)
        if not known_stage:
            logger.warning("stage_telemetry 段名越界(不折进在册段): tool=%s stage=%s", self._tool, stage)
        rec = StageRecord(
            stage=stage,
            result=emitted,
            duration_ms=duration_ms,
            count=count,
            detail=detail if known_result else f"词表外的结论 {result!r}(按未判定记)",
        )
        self._records[stage] = rec
        self._emit(rec)
        return rec

    def finalize(self) -> list[dict[str, Any]]:
        """按固定序出整册;**没走到的段补 unjudged**(缺项即破票面)。"""
        for stage in self._stages:
            if stage not in self._records:
                rec = StageRecord(stage=stage, result=UNJUDGED, duration_ms=None, count=None,
                                  detail="本轮没走到该段(不冒充判定过)")
                self._records[stage] = rec
                self._emit(rec)
        ordered: list[dict[str, Any]] = []
        for stage in self._stages:
            settled = self._records.get(stage)
            if settled is not None:
                ordered.append(settled.as_dict())
        # 词表外的段名也要留在册尾:它点名的是一次"段清单与代码脱节",不是可丢的细节
        for stage, stray in self._records.items():
            if stage not in self._stages:
                ordered.append(stray.as_dict())
        return ordered

    def clock(self) -> StageClock:
        """取一段的手表:段内多个 return 位时按位收尾,`with` 反而改不出最小 diff。"""
        return StageClock()

    def _emit(self, rec: StageRecord) -> None:
        """一段一行结构化结论(唯一出口;新增投影不得绕过这里)。

        整行**预格式化**、不靠位置参数:structlog 与 stdlib 兜底两条落盘链都得产出同一
        串可 grep 的文本(`app/core/logging.py` 的 processor 链里没有
        PositionalArgumentsFormatter,把 `%s` 交给渲染器就等于赌后端)。
        """
        try:
            logger.info(format_stage_line(self._tool, rec, trace_id=self._trace_id))
            _observe(self._tool, rec)
        except Exception as exc:  # noqa: BLE001 - 记账腿坏了不许带走检索(§5e:响但不穿透)
            logger.warning("stage_telemetry 记账失败(stage=%s): %s: %s", rec.stage, type(exc).__name__, exc)


def format_stage_line(tool: str, rec: StageRecord, *, trace_id: str | None = None) -> str:
    """结构化结论行的唯一写法(grep 锚点 `[stage_result]`,一格一`键=值`)。

    `count` / `duration_ms` 取不到时渲染成在册词 `unjudged` —— 空值与 0 是两种事实,
    把「没量到」写成 0 就是把「没判」写成「判过」(§0.3)。
    """
    return (
        f"[{STAGE_LOG_EVENT}] tool={tool} stage={rec.stage} result={rec.result} "
        f"duration_ms={_render(rec.duration_ms)} count={_render(rec.count)} "
        f"trace_id={trace_id or UNJUDGED}"
    )


class StageClock:
    """一段的手表:起点取在段真正开跑的那一刻,终点取在收尾那一刻。

    量不到 ⇒ `elapsed_ms()` 恒 None(未判定),**不回落 0**——把"没量到"写成 0ms
    就是把"没判"写成"判过"(§0.3),而且会污染直方图的最低桶。
    """

    __slots__ = ("_started",)

    def __init__(self) -> None:
        self._started = _monotonic_ms()

    def elapsed_ms(self) -> float | None:
        """已走毫秒;起点或终点任一处取不到 ⇒ None。"""
        ended = _monotonic_ms()
        if self._started is None or ended is None:
            return None
        return ended - self._started


def _observe(tool: str, rec: StageRecord) -> None:
    """把段落进**既有**的 metrics 面(/metrics + dashboard 同一份 registry,不新建导出)。

    只**取**已在 `TelemetryService._init_metrics` 声明的 metric(声明处全仓一份,§0.6);
    取不到 ⇒ 点名出声后跳过这一维,绝不在这里顺手 register 一份同名的第二形状。
    """
    from app.services.telemetry_service import Counter as _Counter
    from app.services.telemetry_service import Histogram as _Histogram
    from app.services.telemetry_service import telemetry_service

    registry = telemetry_service.registry
    counter = registry.get_metric(STAGE_COUNTER_NAME)
    if isinstance(counter, _Counter):
        counter.inc(tool=tool, stage=rec.stage, result=rec.result)
    else:
        logger.warning("stage_telemetry metrics 声明缺失:%s 未注册为 counter", STAGE_COUNTER_NAME)
    if rec.duration_ms is None:
        return  # 耗时没量到 ⇒ 不进直方图(0 会把它伪造成一次"很快")
    histogram = registry.get_metric(STAGE_HISTOGRAM_NAME)
    if isinstance(histogram, _Histogram):
        histogram.observe(rec.duration_ms, tool=tool, stage=rec.stage)
    else:
        logger.warning("stage_telemetry metrics 声明缺失:%s 未注册为 histogram", STAGE_HISTOGRAM_NAME)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
