# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""全活动时间线回放(P1-4)聚合服务。

把一次 agent 会话的五类活动合并为一条可回放、可按时间排序的统一事件流,
供前端时间线组件(GET /api/timeline)一次拉取并可视化:

    step        — agent 步骤(工具调用 / 动作),来自 agent_step_recorder.replay
    compaction  — 上下文语义压缩事件,来自 context_compaction.list_compaction_events
    checkpoint  — 可回滚检查点,来自 agent_checkpoint.list_for_session
    cost        — 成本账本条目,来自 cost_ledger 按 session 过滤
    injection   — prompt 注入 / 危险工具入参拦截,来自 injection_event_recorder

设计:
- 复用既有服务,不重新实现数据面(各来源保持各自存储与写入语义)。
- 统一字段:kinds / at(epoch, 排序键) / at_iso / title / subtitle / status / meta / ref_id / raw。
- 时间在进程内内存聚合,无额外依赖;冷启动为空(跨重启不持久,与各来源一致)。
- aggregate_timeline 为 async(checkpoint 列表为异步)。
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from .agent_checkpoint import get_agent_checkpoint_manager
from .agent_step_recorder import agent_step_recorder
from .cost_ledger import cost_ledger
from .injection_event_recorder import list_injection_events

# 压缩事件列表函数位于 routers 层(进程内存储),延迟导入避免循环依赖。
from ..routers.context_compaction import list_compaction_events

logger = logging.getLogger(__name__)

# 单次聚合返回的事件上限(防止超长会话响应爆炸)
MAX_EVENTS = 500


def _to_epoch(value: Any) -> float:
    """把 ISO 字符串或 epoch 数字统一成 epoch 浮点(排序键)。无法解析返回 0.0。"""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s:
        return 0.0
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


def _iso(value: Any) -> str:
    """把任意 at 值尽量回填成 ISO 字符串(前端展示用)。"""
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value)).isoformat()
        except Exception:
            return ""
    return str(value)


def _step_event(step: dict[str, Any]) -> dict[str, Any]:
    stype = str(step.get("type") or "tool")
    tool = str(step.get("tool_name") or "")
    title = tool if tool else stype
    subtitle = str(step.get("input_summary") or "")[:160]
    return {
        "kind": "step",
        "at": _to_epoch(step.get("at")),
        "at_iso": _iso(step.get("at")),
        "title": title,
        "subtitle": subtitle,
        "status": str(step.get("status") or "ok"),
        "meta": {
            "step_type": stype,
            "tool_name": tool,
            "tokens": int(step.get("tokens") or 0),
            "tokens_in": int(step.get("tokens_in") or 0),
            "tokens_out": int(step.get("tokens_out") or 0),
            "duration_ms": round(float(step.get("duration_ms") or 0.0), 2),
            "cost": round(float(step.get("cost") or 0.0), 6),
            "http_summary": str(step.get("http_summary") or ""),
            "result_summary": str(step.get("result_summary") or ""),
            # 1-1 全可解释(2026-09-08):decision/reason/diff/test/rollback 提升
            # 进 meta 供前端结构化消费;完整原始 input 仍在 raw(避免聚合响应膨胀)。
            "decision": str(step.get("decision") or ""),
            "reason": str(step.get("reason") or ""),
            "diff": step.get("diff"),
            "test": step.get("test"),
            "rollback": step.get("rollback"),
        },
        "ref_id": f"step-{int(step.get('step_index', 0))}",
        "raw": step,
    }


def _compaction_event(rec: dict[str, Any]) -> dict[str, Any]:
    saved = int(rec.get("saved_tokens") or 0)
    ratio = rec.get("saved_ratio")
    ratio_txt = f"{ratio:.0%}" if isinstance(ratio, (int, float)) else "0%"
    return {
        "kind": "compaction",
        "at": _to_epoch(rec.get("compacted_at")),
        "at_iso": _iso(rec.get("compacted_at")),
        "title": "Context compaction",
        "subtitle": f"{saved} tokens saved ({ratio_txt})",
        "status": "ok",
        "meta": {
            "original_tokens": int(rec.get("original_tokens") or 0),
            "compressed_tokens": int(rec.get("compressed_tokens") or 0),
            "saved_tokens": saved,
            "saved_ratio": ratio,
            "trigger": str(rec.get("trigger") or ""),
            "summary": str(rec.get("summary") or ""),
        },
        "ref_id": str(rec.get("compaction_id") or ""),
        "raw": rec,
    }


def _checkpoint_event(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "checkpoint",
        "at": _to_epoch(meta.get("created_at")),
        "at_iso": _iso(meta.get("created_at")),
        "title": "Checkpoint",
        "subtitle": (
            f"iteration {int(meta.get('iteration', 0))} "
            f"· {int(meta.get('message_count', 0))} messages"
        ),
        "status": str(meta.get("status") or "ok"),
        "meta": {
            "iteration": int(meta.get("iteration", 0)),
            "message_count": int(meta.get("message_count", 0)),
            "expires_at": meta.get("expires_at"),
            "restorable": True,
        },
        "ref_id": str(meta.get("checkpoint_id") or ""),
        "raw": meta,
    }


def _cost_event(entry: dict[str, Any]) -> dict[str, Any]:
    cost = round(float(entry.get("cost_usd") or 0.0), 6)
    tool = str(entry.get("tool_name") or "")
    model = str(entry.get("model") or "")
    name = tool or model or "agent"
    return {
        "kind": "cost",
        "at": _to_epoch(entry.get("at")),
        "at_iso": _iso(entry.get("at")),
        "title": f"Cost · {name}",
        "subtitle": f"${cost:.6f} · {int(entry.get('total_tokens') or 0)} tokens",
        "status": str(entry.get("status") or "ok"),
        "meta": {
            "tool_name": tool,
            "model": model,
            "tokens_in": int(entry.get("tokens_in") or 0),
            "tokens_out": int(entry.get("tokens_out") or 0),
            "total_tokens": int(entry.get("total_tokens") or 0),
            "cost_usd": cost,
            "estimated": bool(entry.get("estimated", False)),
        },
        "ref_id": str(entry.get("record_id") or ""),
        "raw": entry,
    }


def _injection_event(rec: dict[str, Any]) -> dict[str, Any]:
    blocked = bool(rec.get("blocked"))
    risk = str(rec.get("risk_level") or "low")
    hits = list(rec.get("hit_types") or [])
    return {
        "kind": "injection",
        "at": _to_epoch(rec.get("at")),
        "at_iso": _iso(rec.get("at")),
        "title": f"Injection intercept · {risk}",
        "subtitle": (", ".join(hits) if hits else str(rec.get("source") or "external")),
        "status": "blocked" if blocked else "flagged",
        "meta": {
            "source": str(rec.get("source") or ""),
            "risk_level": risk,
            "hit_types": hits,
            "action": str(rec.get("action") or "pass"),
            "blocked": blocked,
            "snippet": str(rec.get("snippet") or ""),
        },
        "ref_id": str(rec.get("event_id") or ""),
        "raw": rec,
    }


async def aggregate_timeline(
    session_id: str, *, limit: int = MAX_EVENTS
) -> dict[str, Any]:
    """聚合一次会话的全部活动为统一时间线事件流(时间升序)。

    Returns:
        {
          "session_id": str,
          "total": int,
          "events": [ {kind,at,at_iso,title,subtitle,status,meta,ref_id,raw}, ... ],
          "summary": { counts, total_cost_usd, total_tokens, window },
        }
    """
    events: list[dict[str, Any]] = []

    # 1. steps
    try:
        replay = agent_step_recorder.replay(session_id)
        for step in replay.get("steps", []):
            events.append(_step_event(step))
    except Exception as e:
        logger.warning("timeline 聚合 steps 失败(忽略): %s", e)

    # 2. compactions
    try:
        for rec in list_compaction_events(session_id, limit=MAX_EVENTS):
            events.append(_compaction_event(rec))
    except Exception as e:
        logger.warning("timeline 聚合 compactions 失败(忽略): %s", e)

    # 3. checkpoints(异步)
    try:
        mgr = get_agent_checkpoint_manager()
        metas = await mgr.list_for_session(session_id)
        for meta in metas:
            events.append(_checkpoint_event(meta.to_dict()))
    except Exception as e:
        logger.warning("timeline 聚合 checkpoints 失败(忽略): %s", e)

    # 4. costs(按 session 过滤账本)
    try:
        for entry in cost_ledger._filtered({"session_id": session_id}):
            events.append(_cost_event(entry))
    except Exception as e:
        logger.warning("timeline 聚合 costs 失败(忽略): %s", e)

    # 5. injections
    try:
        for rec in list_injection_events(session_id, limit=MAX_EVENTS):
            events.append(_injection_event(rec))
    except Exception as e:
        logger.warning("timeline 聚合 injections 失败(忽略): %s", e)

    # 时间升序排序
    events.sort(key=lambda e: e["at"])

    # 截断到 limit
    limit = max(1, min(int(limit), MAX_EVENTS))
    events = events[:limit]

    # 汇总
    counts: dict[str, int] = {}
    total_cost = 0.0
    total_tokens = 0
    for ev in events:
        counts[ev["kind"]] = counts.get(ev["kind"], 0) + 1
        if ev["kind"] == "cost":
            total_cost += float(ev["meta"].get("cost_usd", 0.0) or 0.0)
            total_tokens += int(ev["meta"].get("total_tokens", 0) or 0)
        elif ev["kind"] == "step":
            total_tokens += int(ev["meta"].get("tokens", 0) or 0)

    window = {
        "start": events[0]["at_iso"] if events else None,
        "end": events[-1]["at_iso"] if events else None,
    }

    return {
        "session_id": session_id,
        "total": len(events),
        "events": events,
        "summary": {
            "counts": counts,
            "total_cost_usd": round(total_cost, 6),
            "total_tokens": total_tokens,
            "window": window,
        },
    }


__all__ = ["aggregate_timeline", "MAX_EVENTS"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
