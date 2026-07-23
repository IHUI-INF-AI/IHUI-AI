"""跨支柱编排中枢(Pillar Orchestration Hub)。

让 6 大超越支柱(Rules / Hook / Spec / Context / Subagent / Terminal)通过
事件总线协同决策,实现"一个事件 → 多支柱联动"的编排能力。

三层架构:
1. **事件总线(PillarEventBus)**:6 支柱发射事件 → 中枢订阅 → 分发给其他支柱。
   Redis stream(`hub:events`)持久化 + 内存 deque 降级。
2. **联合决策引擎(JointDecisionEngine)**:基于预置 playbook 做组合决策,
   例如"命令失败"→ Context 记录 + Hook 通知 + Rules 生成规则 + Subagent 派发排查。
3. **编排中枢(OrchestrationHub)**:整合事件总线 + 决策引擎,后台消费循环
   自动 evaluate + execute,对外提供 emit / get_dashboard 等简化接口。

设计原则:
- 全部 async 方法
- Redis 操作失败降级到内存 deque,不阻塞主流程
- 解耦:执行 action 时通过 HTTP 调用各支柱 API,而非直接 import
- 每个联动 action 独立 try/catch,单个失败不影响其他
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ====================== Redis 客户端(惰性导入,降级 None) ======================

try:
    import redis.asyncio as aioredis  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover
    aioredis = None  # type: ignore[assignment]

# settings(降级为环境变量)
try:
    from ..core.config import settings as _settings

    _REDIS_URL = str(_settings.redis_url)
except Exception:  # noqa: BLE001
    _settings = None  # type: ignore[assignment]
    _REDIS_URL = ""


# ====================== 常量 ======================

# Redis key 前缀
_STREAM_KEY = "hub:events"              # 事件 stream
_STREAM_GROUP = "hub-orchestrator"      # 消费者组
_DECISION_LIST_KEY = "hub:decisions"    # 决策历史 list
_PLAYBOOK_HASH_KEY = "hub:playbooks"    # playbook 启用状态 hash
_STATS_HASH_KEY = "hub:stats"           # 编排统计 hash

# 内存降级上限
_MEMORY_EVENT_MAXLEN = 10000
_MEMORY_DECISION_MAXLEN = 1000
_STREAM_MAXLEN = 10000  # XADD MAXLEN

# 支柱名称
PILLARS = ("rules", "hook", "spec", "context", "subagent", "terminal", "budget")

# 事件类型枚举(26 种事件,覆盖 6 支柱 + budget)
PILLAR_EVENTS: dict[str, str] = {
    "rules.matched": "规则命中",
    "rules.violated": "规则违反",
    "rules.conflict_resolved": "规则冲突解决",
    "rules.auto_generated": "规则自动生成",
    "hook.emitted": "Hook 触发",
    "hook.failed": "Hook 执行失败",
    "hook.health_degraded": "Hook 健康降级",
    "hook.ab_test_completed": "A/B 测试完成",
    "spec.generated": "Spec 生成",
    "spec.approved": "Spec 评审通过",
    "spec.rejected": "Spec 评审拒绝",
    "spec.task_split": "Spec 任务拆分",
    "spec.patch_applied": "Spec Patch 应用",
    "context.compressed": "Context 压缩",
    "context.enriched": "Context 增强",
    "context.behavior_recorded": "用户行为记录",
    "subagent.dispatched": "Subagent 派发",
    "subagent.completed": "Subagent 完成",
    "subagent.failed": "Subagent 失败",
    "subagent.evolved": "Subagent 演化",
    "terminal.command_failed": "命令失败",
    "terminal.command_succeeded": "命令成功",
    "terminal.ai_diagnosed": "AI 诊断完成",
    "terminal.recording_completed": "录制完成",
    "budget.exceeded": "预算超限",
    "budget.warning": "预算预警",
}

# 支柱 API 路径映射(执行 action 时 HTTP 调用)
_PILLAR_API_PATHS: dict[str, str] = {
    "rules": "/api/rules/orchestrate",
    "hook": "/api/hooks/orchestrate",
    "spec": "/api/specs/orchestrate",
    "context": "/api/context/orchestrate",
    "subagent": "/api/subagents/orchestrate",
    "terminal": "/api/terminal/orchestrate",
}


# ====================== 预置联动策略模板 ======================

ORCHESTRATION_PLAYBOOKS: dict[str, dict[str, Any]] = {
    "terminal_command_failed": {
        "name": "命令失败联动",
        "trigger": "terminal.command_failed",
        "actions": [
            {
                "pillar": "context",
                "action": "record_failure",
                "params": {"key": "terminal_failure", "ttl": 3600},
            },
            {
                "pillar": "hook",
                "action": "emit",
                "params": {"event": "terminal.command_failed", "notify": True},
            },
            {
                "pillar": "rules",
                "action": "auto_generate",
                "params": {
                    "pattern": "avoid_command_failure",
                    "confidence_threshold": 0.7,
                },
            },
            {
                "pillar": "subagent",
                "action": "dispatch_diagnostic",
                "params": {"priority": "normal", "max_retries": 1},
            },
        ],
    },
    "spec_approved": {
        "name": "Spec 评审通过联动",
        "trigger": "spec.approved",
        "actions": [
            {
                "pillar": "hook",
                "action": "emit",
                "params": {"event": "spec.approved", "trigger_ci": True},
            },
            {
                "pillar": "subagent",
                "action": "dispatch_implementation",
                "params": {"from_spec": True},
            },
            {"pillar": "context", "action": "refresh_index", "params": {}},
        ],
    },
    "subagent_completed": {
        "name": "Subagent 完成联动",
        "trigger": "subagent.completed",
        "actions": [
            {"pillar": "context", "action": "inject_result", "params": {}},
            {"pillar": "rules", "action": "learn_pattern", "params": {}},
            {
                "pillar": "hook",
                "action": "emit",
                "params": {"event": "subagent.completed", "notify": True},
            },
        ],
    },
    "rules_violated": {
        "name": "规则违反联动",
        "trigger": "rules.violated",
        "actions": [
            {
                "pillar": "hook",
                "action": "emit",
                "params": {"event": "rules.violated", "notify": True},
            },
            {
                "pillar": "subagent",
                "action": "dispatch_remediation",
                "params": {"priority": "high"},
            },
            {"pillar": "context", "action": "inject_warning", "params": {}},
        ],
    },
    "hook_health_degraded": {
        "name": "Hook 健康降级联动",
        "trigger": "hook.health_degraded",
        "actions": [
            {
                "pillar": "rules",
                "action": "auto_generate",
                "params": {"pattern": "hook_failure_avoidance"},
            },
            {
                "pillar": "context",
                "action": "record_failure",
                "params": {"key": "hook_degraded"},
            },
            {
                "pillar": "subagent",
                "action": "dispatch_diagnostic",
                "params": {"priority": "normal"},
            },
        ],
    },
    "budget_warning": {
        "name": "预算预警联动",
        "trigger": "budget.warning",
        "actions": [
            {
                "pillar": "context",
                "action": "inject_warning",
                "params": {"message": "LLM 预算接近上限"},
            },
            {
                "pillar": "subagent",
                "action": "throttle",
                "params": {"reduce_concurrency": True},
            },
        ],
    },
}


# ====================== 数据模型 ======================


@dataclass
class PillarEvent:
    """支柱事件。"""

    event_type: str           # PILLAR_EVENTS 的 key
    source_pillar: str        # rules/hook/spec/context/subagent/terminal/budget
    timestamp: str            # ISO 8601
    payload: dict             # 事件数据
    dispatch_id: str = ""     # 关联编排 ID(可选)
    severity: str = "info"    # info/warning/critical

    def to_dict(self) -> dict[str, Any]:
        """序列化为 dict(用于 Redis stream / HTTP 传输)。"""
        return {
            "event_type": self.event_type,
            "source_pillar": self.source_pillar,
            "timestamp": self.timestamp,
            "payload": self.payload,
            "dispatch_id": self.dispatch_id,
            "severity": self.severity,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PillarEvent:
        """从 dict 反序列化。"""
        return cls(
            event_type=data.get("event_type", ""),
            source_pillar=data.get("source_pillar", ""),
            timestamp=data.get("timestamp", ""),
            payload=data.get("payload", {}),
            dispatch_id=data.get("dispatch_id", ""),
            severity=data.get("severity", "info"),
        )


@dataclass
class OrchestrationDecision:
    """编排决策。"""

    decision_id: str         # uuid
    trigger_event: PillarEvent
    playbook_id: str
    actions: list[dict]      # 从 playbook 复制
    status: str = "pending"  # pending/executing/completed/partially_failed/failed/skipped
    results: list[dict] = field(default_factory=list)  # 每个 action 的执行结果
    created_at: str = ""
    executed_at: str = ""
    duration_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        """序列化为 dict。"""
        return {
            "decision_id": self.decision_id,
            "trigger_event": self.trigger_event.to_dict(),
            "playbook_id": self.playbook_id,
            "actions": self.actions,
            "status": self.status,
            "results": self.results,
            "created_at": self.created_at,
            "executed_at": self.executed_at,
            "duration_ms": self.duration_ms,
        }


# ====================== 事件总线 ======================


class PillarEventBus:
    """跨支柱事件总线 — Redis stream 持久化 + 内存 deque 降级。

    Redis stream(`hub:events`)XADD MAXLEN ~10000,消费者组 XREADGROUP;
    Redis 不可用时降级到内存 deque(maxlen 10000)+ 内存回调分发。
    """

    def __init__(self) -> None:
        self._redis: Any = None
        self._use_redis: bool = True  # 是否尝试用 Redis(首次失败后置 False)
        self._memory_events: deque[dict[str, Any]] = deque(maxlen=_MEMORY_EVENT_MAXLEN)
        self._subscriptions: dict[str, dict[str, Any]] = {}  # sub_id -> {pillar, event_types, callback}

    async def _ensure_redis(self) -> Any:
        """确保 Redis 客户端可用,惰性从 settings.redis_url 创建。"""
        if self._redis is not None:
            return self._redis
        if not self._use_redis:
            return None
        try:
            if not _REDIS_URL or aioredis is None:
                self._use_redis = False
                return None
            self._redis = aioredis.from_url(_REDIS_URL, decode_responses=True)
            await self._redis.ping()
            # 确保消费者组存在(不存在则创建)
            try:
                await self._redis.xgroup_create(_STREAM_KEY, _STREAM_GROUP, id="0", mkstream=True)
            except Exception:  # noqa: BLE001 — BUSYGROUP 表示组已存在
                pass
            logger.info("[orchestration_hub] 事件总线 Redis 已连接,启用 stream 持久化")
            return self._redis
        except Exception as e:  # noqa: BLE001
            self._use_redis = False
            logger.warning("[orchestration_hub] 事件总线 Redis 连接失败,降级内存模式: %s", e)
            return None

    async def publish(self, event: PillarEvent) -> str:
        """发布事件到 Redis stream(XADD MAXLEN ~10000),失败降级到内存 deque。

        返回 event_id(Redis 为 stream id,内存为 uuid)。
        """
        event_data = event.to_dict()
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                event_id = await redis.xadd(
                    _STREAM_KEY,
                    event_data,
                    maxlen=_STREAM_MAXLEN,
                    approximate=True,
                )
                # 内存镜像(供降级查询 + 内存订阅分发)
                self._memory_events.append({"id": event_id, **event_data})
                await self._dispatch_to_memory_subscribers(event)
                return str(event_id)
            except Exception as e:  # noqa: BLE001
                logger.warning("[orchestration_hub] XADD 失败,降级内存: %s", e)

        # 内存降级
        event_id = str(uuid.uuid4())
        self._memory_events.append({"id": event_id, **event_data})
        await self._dispatch_to_memory_subscribers(event)
        return event_id

    async def subscribe(
        self,
        pillar: str,
        event_types: list[str],
        callback: Any,
    ) -> str:
        """订阅事件(pillar 订阅自己关心的事件类型),返回 subscription_id。

        实际消费用 Redis XREADGROUP 消费者组(降级:内存分发)。
        """
        subscription_id = str(uuid.uuid4())
        self._subscriptions[subscription_id] = {
            "pillar": pillar,
            "event_types": set(event_types),
            "callback": callback,
        }
        logger.info(
            "[orchestration_hub] 支柱 %s 订阅事件 %s(sub_id=%s)",
            pillar,
            event_types,
            subscription_id,
        )
        return subscription_id

    async def unsubscribe(self, subscription_id: str) -> bool:
        """取消订阅。"""
        return self._subscriptions.pop(subscription_id, None) is not None

    async def _dispatch_to_memory_subscribers(self, event: PillarEvent) -> None:
        """向内存订阅者分发事件(降级模式 + Redis 模式双跑,保证实时性)。"""
        for sub in list(self._subscriptions.values()):
            if event.event_type in sub["event_types"]:
                try:
                    result = sub["callback"](event)
                    if asyncio.iscoroutine(result):
                        await result
                except Exception as e:  # noqa: BLE001
                    logger.warning(
                        "[orchestration_hub] 订阅回调执行失败(event=%s): %s",
                        event.event_type,
                        e,
                    )

    async def get_recent_events(
        self,
        limit: int = 50,
        pillar: str | None = None,
        event_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """查询最近事件(XREVRANGE 或内存),支持按支柱/事件类型过滤。"""
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                raw = await redis.xrevrange(_STREAM_KEY, count=limit * 4)
                events: list[dict[str, Any]] = []
                for entry_id, fields in raw:
                    evt = dict(fields)
                    evt["id"] = entry_id
                    if pillar and evt.get("source_pillar") != pillar:
                        continue
                    if event_type and evt.get("event_type") != event_type:
                        continue
                    events.append(evt)
                    if len(events) >= limit:
                        break
                return events
            except Exception as e:  # noqa: BLE001
                logger.warning("[orchestration_hub] XREVRANGE 失败,降级内存: %s", e)

        # 内存降级
        events = []
        for evt in reversed(self._memory_events):
            if pillar and evt.get("source_pillar") != pillar:
                continue
            if event_type and evt.get("event_type") != event_type:
                continue
            events.append(evt)
            if len(events) >= limit:
                break
        return events

    async def get_event_stats(self, window_hours: int = 24) -> dict[str, Any]:
        """按事件类型统计(window_hours 内各事件发生次数 + 成功/失败率)。"""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)
        cutoff_str = cutoff.isoformat()
        stats: dict[str, dict[str, int]] = {}

        events = await self.get_recent_events(limit=_MEMORY_EVENT_MAXLEN)
        for evt in events:
            ts = evt.get("timestamp", "")
            if ts and ts < cutoff_str:
                continue
            etype = evt.get("event_type", "unknown")
            if etype not in stats:
                stats[etype] = {"count": 0, "success": 0, "failed": 0}
            stats[etype]["count"] += 1
            payload = evt.get("payload", {})
            if isinstance(payload, dict):
                if payload.get("success"):
                    stats[etype]["success"] += 1
                elif payload.get("failed") or payload.get("error"):
                    stats[etype]["failed"] += 1

        return {
            "window_hours": window_hours,
            "total_events": sum(s["count"] for s in stats.values()),
            "by_type": stats,
        }


# ====================== 联合决策引擎 ======================


class JointDecisionEngine:
    """联合决策引擎 — 基于预置 playbook 做跨支柱组合决策。

    接收事件 → 匹配 playbook → 返回决策 → 执行决策(调用各支柱 action)。
    每个 action 独立 try/catch,单个失败不影响其他(partially_failed)。
    action 通过 HTTP 调用各支柱 API,解耦不直接 import。
    """

    def __init__(self) -> None:
        self._redis: Any = None
        self._use_redis: bool = True
        self._memory_decisions: deque[dict[str, Any]] = deque(maxlen=_MEMORY_DECISION_MAXLEN)
        self._playbook_states: dict[str, bool] = {
            pid: True for pid in ORCHESTRATION_PLAYBOOKS
        }
        # 编排统计
        self._stats: dict[str, Any] = {
            "total_decisions": 0,
            "completed": 0,
            "partially_failed": 0,
            "failed": 0,
            "skipped": 0,
            "total_duration_ms": 0,
            "playbook_triggers": {pid: 0 for pid in ORCHESTRATION_PLAYBOOKS},
        }

    async def _ensure_redis(self) -> Any:
        """确保 Redis 客户端可用。"""
        if self._redis is not None:
            return self._redis
        if not self._use_redis:
            return None
        try:
            if not _REDIS_URL or aioredis is None:
                self._use_redis = False
                return None
            self._redis = aioredis.from_url(_REDIS_URL, decode_responses=True)
            await self._redis.ping()
            # 加载 playbook 启用状态
            saved = await self._redis.hgetall(_PLAYBOOK_HASH_KEY)
            for pid, state in saved.items():
                self._playbook_states[pid] = state == "1"
            logger.info("[orchestration_hub] 决策引擎 Redis 已连接")
            return self._redis
        except Exception as e:  # noqa: BLE001
            self._use_redis = False
            logger.warning("[orchestration_hub] 决策引擎 Redis 连接失败,降级内存: %s", e)
            return None

    def _match_playbook(self, event: PillarEvent) -> str | None:
        """根据事件类型匹配 playbook,返回 playbook_id(未启用则返回 None)。"""
        for pid, playbook in ORCHESTRATION_PLAYBOOKS.items():
            if playbook["trigger"] == event.event_type:
                if self._playbook_states.get(pid, True):
                    return pid
                logger.debug("[orchestration_hub] playbook %s 已禁用,跳过", pid)
                return None
        return None

    async def evaluate(self, event: PillarEvent) -> OrchestrationDecision:
        """接收事件,匹配 playbook,返回决策。"""
        playbook_id = self._match_playbook(event)
        created_at = datetime.now(timezone.utc).isoformat()

        if playbook_id is None:
            # 无匹配 playbook 或 playbook 已禁用
            return OrchestrationDecision(
                decision_id=str(uuid.uuid4()),
                trigger_event=event,
                playbook_id="",
                actions=[],
                status="skipped",
                created_at=created_at,
            )

        playbook = ORCHESTRATION_PLAYBOOKS[playbook_id]
        decision = OrchestrationDecision(
            decision_id=str(uuid.uuid4()),
            trigger_event=event,
            playbook_id=playbook_id,
            actions=[dict(a) for a in playbook["actions"]],  # 深拷贝
            status="pending",
            created_at=created_at,
        )
        return decision

    async def _call_pillar_action(
        self,
        pillar: str,
        action: str,
        params: dict[str, Any],
        trigger_event: PillarEvent,
    ) -> dict[str, Any]:
        """通过 HTTP 调用支柱 API 执行 action(解耦,不直接 import)。

        失败返回 {"success": False, "error": ...},不抛异常。
        """
        api_path = _PILLAR_API_PATHS.get(pillar)
        if not api_path:
            return {
                "success": False,
                "error": f"未知支柱: {pillar}",
                "pillar": pillar,
                "action": action,
            }

        # 基础 URL:优先 settings.api_service_url,降级 localhost
        base_url = ""
        if _settings is not None:
            base_url = str(getattr(_settings, "api_service_url", "") or "")
        if not base_url:
            base_url = "http://localhost:8802"

        url = f"{base_url.rstrip('/')}{api_path}"
        body = {
            "action": action,
            "params": params,
            "trigger_event": trigger_event.to_dict(),
        }

        try:
            import httpx  # type: ignore[import-not-found]

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=body)
            return {
                "success": resp.status_code < 400,
                "status_code": resp.status_code,
                "pillar": pillar,
                "action": action,
                "response": resp.text[:500] if resp.text else "",
            }
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "[orchestration_hub] 调用支柱 %s action=%s 失败: %s",
                pillar,
                action,
                e,
            )
            return {
                "success": False,
                "error": str(e),
                "pillar": pillar,
                "action": action,
            }

    async def execute_decision(self, decision: OrchestrationDecision) -> dict[str, Any]:
        """执行决策(调用各支柱的 action),每个 action try/catch 独立。

        失败不影响其他:全部失败 → failed,部分失败 → partially_failed,
        全部成功 → completed,无 action → skipped。
        """
        if decision.status == "skipped" or not decision.actions:
            decision.status = "skipped"
            await self._record_decision(decision)
            return decision.to_dict()

        decision.status = "executing"
        decision.executed_at = datetime.now(timezone.utc).isoformat()
        start_ms = time.time() * 1000

        results: list[dict[str, Any]] = []
        success_count = 0
        for action_spec in decision.actions:
            pillar = action_spec.get("pillar", "")
            action = action_spec.get("action", "")
            params = action_spec.get("params", {})
            try:
                result = await self._call_pillar_action(
                    pillar, action, params, decision.trigger_event
                )
            except Exception as e:  # noqa: BLE001 — 兜底,确保单 action 失败不中断
                result = {
                    "success": False,
                    "error": str(e),
                    "pillar": pillar,
                    "action": action,
                }
            results.append(result)
            if result.get("success"):
                success_count += 1

        decision.results = results
        decision.duration_ms = int(time.time() * 1000 - start_ms)

        if success_count == len(decision.actions):
            decision.status = "completed"
        elif success_count == 0:
            decision.status = "failed"
        else:
            decision.status = "partially_failed"

        await self._record_decision(decision)
        return decision.to_dict()

    async def _record_decision(self, decision: OrchestrationDecision) -> None:
        """记录决策到历史(Redis list + 内存 deque)+ 更新统计。"""
        record = decision.to_dict()
        self._memory_decisions.append(record)

        # 更新统计
        self._stats["total_decisions"] += 1
        self._stats[total_key := decision.status] = self._stats.get(total_key, 0) + 1
        self._stats["total_duration_ms"] += decision.duration_ms
        if decision.playbook_id:
            self._stats["playbook_triggers"][decision.playbook_id] = (
                self._stats["playbook_triggers"].get(decision.playbook_id, 0) + 1
            )

        # 持久化到 Redis
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                await redis.lpush(_DECISION_LIST_KEY, json.dumps(record, ensure_ascii=False))
                await redis.ltrim(_DECISION_LIST_KEY, 0, _MEMORY_DECISION_MAXLEN - 1)
            except Exception as e:  # noqa: BLE001
                logger.debug("[orchestration_hub] 决策历史持久化失败: %s", e)

    async def get_playbooks(self) -> list[dict[str, Any]]:
        """列出所有 playbook(含启用状态)。"""
        return [
            {
                "id": pid,
                "name": playbook["name"],
                "trigger": playbook["trigger"],
                "actions": playbook["actions"],
                "enabled": self._playbook_states.get(pid, True),
            }
            for pid, playbook in ORCHESTRATION_PLAYBOOKS.items()
        ]

    async def enable_playbook(self, playbook_id: str, enabled: bool) -> bool:
        """启用/禁用 playbook(存 Redis hash)。"""
        if playbook_id not in ORCHESTRATION_PLAYBOOKS:
            return False
        self._playbook_states[playbook_id] = enabled
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                await redis.hset(_PLAYBOOK_HASH_KEY, playbook_id, "1" if enabled else "0")
            except Exception as e:  # noqa: BLE001
                logger.debug("[orchestration_hub] playbook 状态持久化失败: %s", e)
        logger.info(
            "[orchestration_hub] playbook %s %s",
            playbook_id,
            "已启用" if enabled else "已禁用",
        )
        return True

    async def get_decision_history(self, limit: int = 50) -> list[dict[str, Any]]:
        """决策历史(Redis list,降级内存)。"""
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                raw = await redis.lrange(_DECISION_LIST_KEY, 0, limit - 1)
                history: list[dict[str, Any]] = []
                for item in raw:
                    try:
                        history.append(json.loads(item))
                    except (json.JSONDecodeError, TypeError):
                        continue
                return history
            except Exception as e:  # noqa: BLE001
                logger.debug("[orchestration_hub] 决策历史读取失败: %s", e)
        # 内存降级
        return list(self._memory_decisions)[:limit]

    async def get_orchestration_stats(self) -> dict[str, Any]:
        """编排统计(总决策数/成功率/平均执行时间/各 playbook 触发次数)。"""
        total = self._stats["total_decisions"]
        completed = self._stats.get("completed", 0)
        avg_ms = (
            self._stats["total_duration_ms"] / total if total > 0 else 0
        )
        return {
            "total_decisions": total,
            "completed": completed,
            "partially_failed": self._stats.get("partially_failed", 0),
            "failed": self._stats.get("failed", 0),
            "skipped": self._stats.get("skipped", 0),
            "success_rate": (completed / total) if total > 0 else 0.0,
            "avg_duration_ms": round(avg_ms, 2),
            "playbook_triggers": dict(self._stats["playbook_triggers"]),
        }


# ====================== 编排中枢主类 ======================


class OrchestrationHub:
    """跨支柱编排中枢 — 事件总线 + 联合决策引擎。

    整合 PillarEventBus + JointDecisionEngine,后台消费循环自动 evaluate +
    execute,对外提供 emit / get_status / get_dashboard 等简化接口。
    """

    def __init__(self) -> None:
        self.event_bus = PillarEventBus()
        self.decision_engine = JointDecisionEngine()
        self._redis: Any = None
        self._memory_events: deque[dict[str, Any]] = deque(maxlen=_MEMORY_EVENT_MAXLEN)
        self._memory_decisions: deque[dict[str, Any]] = deque(maxlen=_MEMORY_DECISION_MAXLEN)
        self._playbook_states: dict[str, bool] = {
            pid: True for pid in ORCHESTRATION_PLAYBOOKS
        }
        self._running: bool = False
        self._consumer_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        """启动事件消费者(后台 asyncio task,消费 Redis stream)。"""
        if self._running:
            return
        self._running = True
        self._consumer_task = asyncio.create_task(self._consume_loop())
        logger.info("[orchestration_hub] 编排中枢已启动,后台消费循环运行中")

    async def stop(self) -> None:
        """停止事件消费者。"""
        self._running = False
        if self._consumer_task is not None:
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except asyncio.CancelledError:
                pass
            self._consumer_task = None
        logger.info("[orchestration_hub] 编排中枢已停止")

    async def _consume_loop(self) -> None:
        """事件消费循环:从 Redis stream 读取事件 → evaluate → execute_decision。

        Redis 不可用时降级为空循环(事件已在 publish 时通过内存订阅分发,
        此循环仅负责自动编排决策)。
        """
        redis = await self.event_bus._ensure_redis()
        consumer_name = f"hub-{uuid.uuid4().hex[:8]}"

        while self._running:
            if redis is not None:
                try:
                    # 阻塞读取(stream 中新事件),超时 5s 重循环
                    resp = await redis.xreadgroup(
                        _STREAM_GROUP,
                        consumer_name,
                        {_STREAM_KEY: ">"},
                        count=10,
                        block=5000,
                    )
                    if not resp:
                        continue
                    for _stream, messages in resp:
                        for entry_id, fields in messages:
                            event = PillarEvent.from_dict(fields)
                            await self._process_event(event)
                            # 确认已处理
                            try:
                                await redis.xack(_STREAM_KEY, _STREAM_GROUP, entry_id)
                            except Exception:  # noqa: BLE001
                                pass
                except asyncio.CancelledError:
                    break
                except Exception as e:  # noqa: BLE001
                    logger.warning("[orchestration_hub] 消费循环异常: %s", e)
                    await asyncio.sleep(1)
            else:
                # Redis 降级:publish 时已同步 evaluate,此处仅空转
                await asyncio.sleep(5)

    async def _process_event(self, event: PillarEvent) -> None:
        """处理单个事件:evaluate → execute_decision(自动编排)。"""
        try:
            decision = await self.decision_engine.evaluate(event)
            if decision.status == "skipped":
                return
            await self.decision_engine.execute_decision(decision)
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "[orchestration_hub] 事件处理失败(event=%s): %s",
                event.event_type,
                e,
            )

    async def emit(
        self,
        event_type: str,
        source_pillar: str,
        payload: dict[str, Any],
        severity: str = "info",
    ) -> str:
        """支柱调用此方法发射事件(简化接口)。返回 event_id。

        创建 PillarEvent → publish → 如果 _running 则自动 evaluate + execute。
        """
        event = PillarEvent(
            event_type=event_type,
            source_pillar=source_pillar,
            timestamp=datetime.now(timezone.utc).isoformat(),
            payload=payload,
            severity=severity,
        )
        event_id = await self.event_bus.publish(event)

        # 若消费循环未运行(Redis 降级模式),同步触发编排决策
        if not self._running:
            await self._process_event(event)

        return event_id

    async def get_status(self) -> dict[str, Any]:
        """中枢状态(running/事件数/决策数/各 playbook 启用状态)。"""
        return {
            "running": self._running,
            "event_count": len(self.event_bus._memory_events),
            "decision_count": len(self.decision_engine._memory_decisions),
            "playbook_states": dict(self.decision_engine._playbook_states),
            "redis_mode": self.event_bus._use_redis,
        }

    async def get_event_feed(
        self,
        limit: int = 50,
        pillar: str | None = None,
        event_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """事件流(供前端实时展示)。"""
        return await self.event_bus.get_recent_events(limit=limit, pillar=pillar, event_type=event_type)

    async def get_dashboard(self) -> dict[str, Any]:
        """编排仪表盘(事件统计 + 决策统计 + playbook 状态 + 各支柱健康)。"""
        event_stats = await self.event_bus.get_event_stats(window_hours=24)
        decision_stats = await self.decision_engine.get_orchestration_stats()
        playbooks = await self.decision_engine.get_playbooks()

        # 各支柱健康(基于近 1h 事件的成功/失败率)
        pillar_health: dict[str, dict[str, Any]] = {}
        for p in PILLARS:
            events = await self.event_bus.get_recent_events(limit=200, pillar=p)
            total = len(events)
            success = sum(
                1
                for e in events
                if isinstance(e.get("payload"), dict) and e["payload"].get("success")
            )
            failed = sum(
                1
                for e in events
                if isinstance(e.get("payload"), dict)
                and (e["payload"].get("failed") or e["payload"].get("error"))
            )
            pillar_health[p] = {
                "event_count": total,
                "success": success,
                "failed": failed,
                "health": "healthy" if failed == 0 else ("degraded" if success > failed else "unhealthy"),
            }

        return {
            "status": await self.get_status(),
            "event_stats": event_stats,
            "decision_stats": decision_stats,
            "playbooks": playbooks,
            "pillar_health": pillar_health,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# ====================== 模块级单例 ======================

orchestration_hub = OrchestrationHub()
