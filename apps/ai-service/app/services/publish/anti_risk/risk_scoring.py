"""风险评分引擎 — 基于多维度计算账号风险评分(0-100)。

反风控核心:在发布前评估账号当前风险状态,高风险则自动进入冷却,
避免在已被平台盯上的账号上继续操作导致封号。

评分维度(总分 100,0=安全,100=高危):
1. 发布频率(近 24h/7d 发布次数,>10 次/24h 加 20 分)
2. 失败率(近 7d 失败率 >50% 加 15 分)
3. 设备指纹一致性(同账号跨会话指纹变化 加 25 分)
4. IP 稳定性(同账号 IP 频繁变化 加 20 分)
5. 行为模式异常(发布间隔 < 30s 加 10 分)
6. 平台风控信号(收到"请稍后再试"等关键词 加 30 分)
7. Cookie 健康度(Cookie 即将过期/已失效 加 15 分)— 2026-08-01 新增
8. 内容相似度(多平台发布相似度 >85% 加 20 分)— 2026-08-01 新增

风险等级:
- 0-20: safe(安全,可发布)
- 21-40: low(低风险,可发布但留意)
- 41-60: medium(中风险,建议冷却 1h)
- 61-80: high(高风险,强制冷却 1h)
- 81-100: critical(极高风险,强制冷却 24h)

设计:
- 单例模式(多适配器共享同一评分器)
- 线程安全(threading.Lock)
- 风险事件持久化到 .trae-cn/tmp/anti-risk-events.jsonl(AGENTS.md §15)
- 发布历史从 publish_history 表查询(DB 不可用时降级到内存事件)
- 新增维度(7/8)可选传入,不传时跳过该维度评分(向后兼容)
"""
from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from app.core.logging import get_logger

logger = get_logger(__name__)


# 风险事件持久化路径(AGENTS.md §15:临时文件放 .trae-cn/tmp/)
_EVENTS_FILE = Path(os.environ.get(
    "ANTI_RISK_EVENTS_FILE",
    ".trae-cn/tmp/anti-risk-events.jsonl",
)).resolve()

# 评分阈值
_SCORE_SAFE = 20       # <= 20: safe
_SCORE_LOW = 40        # <= 40: low
_SCORE_MEDIUM = 60     # <= 60: medium
_SCORE_HIGH = 80       # <= 80: high
# > 80: critical

# 平台风控触发关键词(命中任一即认定平台风控触发)
_PLATFORM_RISK_KEYWORDS: tuple[str, ...] = (
    "操作频繁", "稍后再试", "账号异常", "风控限制", "请验证",
    "请稍后", "请求过于频繁", "操作过于频繁", "账号已被限制",
    "安全验证", "滑块验证", "图形验证", "短信验证",
)

# 评分维度权重(总分 100,新增维度 7/8 可选)
_WEIGHT_FREQUENCY = 20      # 发布频率
_WEIGHT_FAILURE_RATE = 15   # 失败率
_WEIGHT_FINGERPRINT = 25    # 指纹一致性
_WEIGHT_IP_STABILITY = 20   # IP 稳定性
_WEIGHT_BEHAVIOR = 10       # 行为模式
_WEIGHT_PLATFORM_SIGNAL = 30  # 平台风控信号
_WEIGHT_COOKIE_HEALTH = 15    # Cookie 健康度(2026-08-01 新增)
_WEIGHT_CONTENT_SIMILARITY = 20  # 内容相似度(2026-08-01 新增)

# Cookie 健康度阈值
_COOKIE_EXPIRING_SOON_DAYS = 7  # 距过期 ≤7 天 → 加分

# 内容相似度阈值
_CONTENT_SIMILARITY_THRESHOLD = 0.85  # 相似度 >85% → 加分

# 冷却时长(秒)— 不同风险等级触发的冷却
_COOLDOWN_MEDIUM = 3600       # 1 小时
_COOLDOWN_HIGH = 3600         # 1 小时
_COOLDOWN_CRITICAL = 86400    # 24 小时


@dataclass
class RiskScore:
    """账号风险评分结果。

    Attributes:
        score: 0-100,0=安全,100=高危
        level: 风险等级(safe/low/medium/high/critical)
        factors: 触发的风险因素列表(人类可读)
        calculated_at: 计算时间戳
        cooldown_until: 冷却截止时间戳(无冷却时为 None)
    """

    score: int
    level: str  # 'safe' | 'low' | 'medium' | 'high' | 'critical'
    factors: list[str] = field(default_factory=list)
    calculated_at: float = field(default_factory=time.time)
    cooldown_until: Optional[float] = None

    def is_safe(self) -> bool:
        """是否安全可发布(safe / low 级别)。"""
        return self.score <= _SCORE_LOW

    def to_dict(self) -> dict[str, Any]:
        """序列化为 dict(供审计日志持久化)。"""
        return {
            "score": self.score,
            "level": self.level,
            "factors": list(self.factors),
            "calculated_at": self.calculated_at,
            "cooldown_until": self.cooldown_until,
        }


def _level_from_score(score: int) -> str:
    """根据评分返回等级。"""
    if score <= _SCORE_SAFE:
        return "safe"
    if score <= _SCORE_LOW:
        return "low"
    if score <= _SCORE_MEDIUM:
        return "medium"
    if score <= _SCORE_HIGH:
        return "high"
    return "critical"


def _cooldown_for_level(level: str) -> Optional[float]:
    """根据等级返回冷却截止时间戳(无冷却返回 None)。"""
    now = time.time()
    if level == "medium":
        return now + _COOLDOWN_MEDIUM
    if level == "high":
        return now + _COOLDOWN_HIGH
    if level == "critical":
        return now + _COOLDOWN_CRITICAL
    return None


class RiskScorer:
    """风险评分引擎(单例)。

    维护账号风险事件流,基于 publish_history + 实时事件计算评分。
    所有状态线程安全,事件持久化到文件(进程重启后可恢复)。
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # 风险事件:(account_id, platform) -> [event_dict, ...]
        # event_dict: {type, timestamp, details}
        self._events: dict[tuple[str, str], list[dict[str, Any]]] = {}
        # 最后一次评分缓存(避免短时间内重复计算)
        self._score_cache: dict[tuple[str, str], RiskScore] = {}
        self._cache_ttl = 30.0  # 缓存 30s
        self._loaded = False

    def _ensure_loaded(self) -> None:
        """惰性加载持久化的事件文件(进程重启后恢复)。"""
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            try:
                if _EVENTS_FILE.is_file():
                    with _EVENTS_FILE.open("r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            try:
                                evt = json.loads(line)
                            except json.JSONDecodeError:
                                continue
                            key = (evt.get("account_id", ""), evt.get("platform", ""))
                            if key == ("", ""):
                                continue
                            self._events.setdefault(key, []).append({
                                "type": evt.get("type", ""),
                                "timestamp": evt.get("timestamp", 0.0),
                                "details": evt.get("details", {}),
                            })
                    logger.info(
                        "[risk_scoring] 加载历史风险事件: %d 个账号",
                        len(self._events),
                    )
            except OSError as e:
                logger.warning("[risk_scoring] 加载事件文件失败: %s", e)
            self._loaded = True

    def _persist_event(self, account_id: str, platform: str,
                       event_type: str, details: dict[str, Any],
                       timestamp: float) -> None:
        """追加一条事件到 JSONL 文件(线程外调用,无锁)。"""
        try:
            _EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
            record = {
                "account_id": account_id,
                "platform": platform,
                "type": event_type,
                "timestamp": timestamp,
                "details": details,
            }
            with _EVENTS_FILE.open("a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
        except OSError as e:
            logger.warning("[risk_scoring] 持久化事件失败: %s", e)

    # -----------------------------------------------------------------
    # 公开 API
    # -----------------------------------------------------------------

    def calculate_risk_score(
        self,
        account_id: str,
        platform: str,
        publish_history: Optional[list[dict[str, Any]]] = None,
        cookie_health: Optional[dict[str, Any]] = None,
        content_similarity: Optional[float] = None,
    ) -> RiskScore:
        """计算账号风险评分。

        Args:
            account_id: 账号唯一标识
            platform: 平台 ID
            publish_history: 近 7d 的 publish_history 记录列表(每条含
                success/duration_ms/error_message/created_at 等字段)。
                为 None 时仅依赖内存事件流评分(降级模式)。
            cookie_health: Cookie 健康度字典(含 status/days_until_expiry),
                为 None 时跳过该维度(向后兼容)。
            content_similarity: 多平台内容相似度(0-1),
                为 None 时跳过该维度(向后兼容)。

        Returns:
            RiskScore 实例
        """
        self._ensure_loaded()

        # 缓存命中(30s 内)— 仅当未传入新维度参数时用缓存
        # (新维度参数每次可能不同,不能复用缓存)
        cache_key = (account_id, platform)
        use_cache = cookie_health is None and content_similarity is None
        if use_cache:
            with self._lock:
                cached = self._score_cache.get(cache_key)
                if cached and (time.time() - cached.calculated_at) < self._cache_ttl:
                    return cached

        score = 0
        factors: list[str] = []

        # 维度 1+2+5:基于 publish_history(若提供)
        if publish_history:
            score, factors = self._score_from_history(
                publish_history, score, factors,
            )
        else:
            # 降级:仅基于内存事件流估算
            score, factors = self._score_from_events(
                account_id, platform, score, factors,
            )

        # 维度 3+4:指纹/IP 一致性(基于内存事件流)
        score, factors = self._score_fingerprint_ip(
            account_id, platform, score, factors,
        )

        # 维度 6:平台风控信号(基于内存事件流)
        score, factors = self._score_platform_signals(
            account_id, platform, score, factors,
        )

        # 维度 7:Cookie 健康度(2026-08-01 新增,可选)
        if cookie_health is not None:
            score, factors = self._score_cookie_health(
                cookie_health, score, factors,
            )

        # 维度 8:内容相似度(2026-08-01 新增,可选)
        if content_similarity is not None:
            score, factors = self._score_content_similarity(
                content_similarity, score, factors,
            )

        # 限制在 [0, 100]
        score = max(0, min(100, score))
        level = _level_from_score(score)
        cooldown_until = _cooldown_for_level(level)

        result = RiskScore(
            score=score,
            level=level,
            factors=factors,
            cooldown_until=cooldown_until,
        )

        # 仅当未传入新维度参数时缓存(新维度参数每次可能不同)
        if use_cache:
            with self._lock:
                self._score_cache[cache_key] = result
        return result

    def _score_from_history(
        self,
        history: list[dict[str, Any]],
        score: int,
        factors: list[str],
    ) -> tuple[int, list[str]]:
        """从 publish_history 计算维度 1/2/5(频率/失败率/行为)。"""
        now = time.time()
        last_24h: list[dict[str, Any]] = []
        last_7d: list[dict[str, Any]] = []
        for rec in history:
            created = rec.get("created_at")
            ts = _parse_timestamp(created)
            if ts is None:
                continue
            if now - ts <= 86400:  # 24h
                last_24h.append(rec)
            if now - ts <= 604800:  # 7d
                last_7d.append(rec)

        # 维度 1:发布频率(>10 次/24h 加 20 分)
        if len(last_24h) > 10:
            score += _WEIGHT_FREQUENCY
            factors.append(f"近 24h 发布 {len(last_24h)} 次(>10,频率异常)")

        # 维度 2:失败率(近 7d 失败率 >50% 加 15 分)
        if last_7d:
            failed = sum(1 for r in last_7d if not r.get("success", False))
            fail_rate = failed / len(last_7d)
            if fail_rate > 0.5:
                score += _WEIGHT_FAILURE_RATE
                factors.append(
                    f"近 7d 失败率 {fail_rate:.0%}({failed}/{len(last_7d)},>50%)"
                )

        # 维度 5:行为模式异常(发布间隔 < 30s 加 10 分)
        if len(last_24h) >= 2:
            timestamps = sorted(
                _parse_timestamp(r.get("created_at")) or 0
                for r in last_24h
            )
            rapid_intervals = sum(
                1 for i in range(1, len(timestamps))
                if 0 < (timestamps[i] - timestamps[i - 1]) < 30
            )
            if rapid_intervals > 0:
                score += _WEIGHT_BEHAVIOR
                factors.append(
                    f"近 24h 有 {rapid_intervals} 次发布间隔 <30s(行为异常)"
                )

        return score, factors

    def _score_from_events(
        self,
        account_id: str,
        platform: str,
        score: int,
        factors: list[str],
    ) -> tuple[int, list[str]]:
        """降级模式:仅基于内存事件流估算频率/失败率/行为。"""
        now = time.time()
        key = (account_id, platform)
        with self._lock:
            events = list(self._events.get(key, []))

        last_24h = [e for e in events if now - e.get("timestamp", 0) <= 86400]
        last_7d = [e for e in events if now - e.get("timestamp", 0) <= 604800]

        # 维度 1:近 24h 发布事件数
        publish_events_24h = [
            e for e in last_24h
            if e.get("type") in ("publish_success", "publish_failed")
        ]
        if len(publish_events_24h) > 10:
            score += _WEIGHT_FREQUENCY
            factors.append(f"近 24h 发布 {len(publish_events_24h)} 次(>10,频率异常)")

        # 维度 2:近 7d 失败率
        if last_7d:
            failed = sum(
                1 for e in last_7d if e.get("type") == "publish_failed"
            )
            total = sum(
                1 for e in last_7d
                if e.get("type") in ("publish_success", "publish_failed")
            )
            if total > 0:
                fail_rate = failed / total
                if fail_rate > 0.5:
                    score += _WEIGHT_FAILURE_RATE
                    factors.append(
                        f"近 7d 失败率 {fail_rate:.0%}({failed}/{total},>50%)"
                    )

        # 维度 5:行为模式异常(发布间隔 < 30s)
        publish_events = sorted(
            (e for e in last_24h
             if e.get("type") in ("publish_success", "publish_failed")
             and e.get("timestamp", 0) > 0),
            key=lambda e: e["timestamp"],
        )
        rapid_count = sum(
            1 for i in range(1, len(publish_events))
            if 0 < (publish_events[i]["timestamp"] - publish_events[i - 1]["timestamp"]) < 30
        )
        if rapid_count > 0:
            score += _WEIGHT_BEHAVIOR
            factors.append(f"近 24h 有 {rapid_count} 次发布间隔 <30s(行为异常)")

        return score, factors

    def _score_fingerprint_ip(
        self,
        account_id: str,
        platform: str,
        score: int,
        factors: list[str],
    ) -> tuple[int, list[str]]:
        """维度 3/4:指纹一致性 + IP 稳定性(基于内存事件流)。"""
        key = (account_id, platform)
        with self._lock:
            events = list(self._events.get(key, []))

        # 维度 3:设备指纹一致性
        fingerprints: set[str] = set()
        for e in events:
            if e.get("type") == "fingerprint_recorded":
                fp = e.get("details", {}).get("fingerprint_hash", "")
                if fp:
                    fingerprints.add(fp)
        if len(fingerprints) > 1:
            score += _WEIGHT_FINGERPRINT
            factors.append(
                f"同账号跨会话指纹变化({len(fingerprints)} 种,疑似多设备)"
            )

        # 维度 4:IP 稳定性
        ips: set[str] = set()
        for e in events:
            if e.get("type") == "proxy_recorded":
                ip = e.get("details", {}).get("proxy_server", "")
                if ip:
                    ips.add(ip)
        if len(ips) > 1:
            score += _WEIGHT_IP_STABILITY
            factors.append(
                f"同账号 IP 频繁变化({len(ips)} 个不同 IP,异地登录特征)"
            )

        return score, factors

    def _score_platform_signals(
        self,
        account_id: str,
        platform: str,
        score: int,
        factors: list[str],
    ) -> tuple[int, list[str]]:
        """维度 6:平台风控信号(基于 platform_risk_trigger 事件)。"""
        key = (account_id, platform)
        with self._lock:
            events = list(self._events.get(key, []))

        now = time.time()
        # 近 24h 内有平台风控触发事件 → 加 30 分
        recent_triggers = [
            e for e in events
            if e.get("type") == "platform_risk_trigger"
            and now - e.get("timestamp", 0) <= 86400
        ]
        if recent_triggers:
            score += _WEIGHT_PLATFORM_SIGNAL
            last_trigger = recent_triggers[-1]
            err = last_trigger.get("details", {}).get("error", "")
            factors.append(
                f"近 24h 平台风控触发({len(recent_triggers)} 次,"
                f"最近错误: {err[:50] if err else '未知'})"
            )

        return score, factors

    def _score_cookie_health(
        self,
        cookie_health: dict[str, Any],
        score: int,
        factors: list[str],
    ) -> tuple[int, list[str]]:
        """维度 7:Cookie 健康度(2026-08-01 新增)。

        Cookie 状态:
        - expired/invalid: Cookie 已失效 → 加满分(15 分)
        - expiring_soon: 即将过期 → 加满分(15 分)
        - healthy: 健康 → 不加分
        """
        status = cookie_health.get("status", "healthy")
        days = cookie_health.get("days_until_expiry", -1)

        if status in ("expired", "invalid"):
            score += _WEIGHT_COOKIE_HEALTH
            factors.append(
                f"Cookie {status}(需重新登录,发布会被拒绝)"
            )
        elif status == "expiring_soon":
            score += _WEIGHT_COOKIE_HEALTH
            factors.append(
                f"Cookie 即将过期(剩余 {days} 天,需刷新保活)"
            )
        # healthy 不加分

        return score, factors

    def _score_content_similarity(
        self,
        similarity: float,
        score: int,
        factors: list[str],
    ) -> tuple[int, list[str]]:
        """维度 8:内容相似度(2026-08-01 新增)。

        多平台发布相同内容会被识别为机器操作/营销号:
        - 相似度 >85%: 加满分(20 分,高风险)
        - 相似度 70-85%: 加半分(10 分,中风险)
        - 相似度 <70%: 不加分(已差异化)
        """
        if similarity > _CONTENT_SIMILARITY_THRESHOLD:
            score += _WEIGHT_CONTENT_SIMILARITY
            factors.append(
                f"多平台内容相似度 {similarity:.0%}(>85%,机器操作特征)"
            )
        elif similarity > 0.70:
            half_score = _WEIGHT_CONTENT_SIMILARITY // 2
            score += half_score
            factors.append(
                f"多平台内容相似度 {similarity:.0%}(70-85%,建议进一步差异化)"
            )
        # <70% 不加分

        return score, factors

    def is_account_safe_to_publish(
        self,
        account_id: str,
        platform: str,
        publish_history: Optional[list[dict[str, Any]]] = None,
        cookie_health: Optional[dict[str, Any]] = None,
        content_similarity: Optional[float] = None,
    ) -> tuple[bool, RiskScore]:
        """综合判断账号是否安全可发布。

        Args:
            account_id: 账号唯一标识
            platform: 平台 ID
            publish_history: 近 7d 的 publish_history 记录(可选)
            cookie_health: Cookie 健康度字典(可选,含 status/days_until_expiry)
            content_similarity: 多平台内容相似度 0-1(可选)

        Returns:
            (is_safe, risk_score) — is_safe=True 时可发布,
            False 时应进入冷却。RiskScore.cooldown_until 给出建议冷却时长。
        """
        score = self.calculate_risk_score(
            account_id, platform, publish_history,
            cookie_health, content_similarity,
        )
        return score.is_safe(), score

    def record_risk_event(
        self,
        account_id: str,
        platform: str,
        event_type: str,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        """记录风险事件(内存 + 文件持久化)。

        Args:
            account_id: 账号唯一标识
            platform: 平台 ID
            event_type: 事件类型,推荐值:
                - publish_success(发布成功,评分衰减)
                - publish_failed(发布失败)
                - platform_risk_trigger(平台风控触发)
                - fingerprint_recorded(指纹记录)
                - proxy_recorded(代理记录)
            details: 事件详情(可序列化为 JSON)
        """
        self._ensure_loaded()
        details = details or {}
        timestamp = time.time()
        key = (account_id, platform)

        with self._lock:
            self._events.setdefault(key, []).append({
                "type": event_type,
                "timestamp": timestamp,
                "details": details,
            })
            # 清理超过 30 天的事件(防止内存无限增长)
            cutoff = timestamp - 2592000  # 30d
            self._events[key] = [
                e for e in self._events[key] if e.get("timestamp", 0) >= cutoff
            ]
            # 失效缓存(新事件可能改变评分)
            self._score_cache.pop(key, None)

        # 持久化(锁外执行,避免长持有锁)
        self._persist_event(account_id, platform, event_type, details, timestamp)

        logger.debug(
            "[risk_scoring] 记录事件 account=%s platform=%s type=%s",
            account_id, platform, event_type,
        )

    @staticmethod
    def is_platform_risk_error(error_message: str) -> bool:
        """检查错误信息是否包含平台风控关键词。

        Args:
            error_message: 平台返回的错误信息

        Returns:
            True 表示命中风控关键词
        """
        if not error_message:
            return False
        return any(kw in error_message for kw in _PLATFORM_RISK_KEYWORDS)

    @classmethod
    def get_instance(cls) -> "RiskScorer":
        """获取全局 RiskScorer 单例(类方法,便于 scheduler 调用)。"""
        return get_instance()


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

def _parse_timestamp(value: Any) -> Optional[float]:
    """解析时间戳(支持 datetime/ISO 字符串/float/int)。"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # 尝试 ISO 格式
        try:
            from datetime import datetime
            # 兼容带时区的 ISO 字符串
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt.timestamp()
        except (ValueError, TypeError):
            return None
    # datetime 对象
    if hasattr(value, "timestamp"):
        try:
            return float(value.timestamp())
        except (ValueError, TypeError):
            return None
    return None


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_global_scorer: Optional[RiskScorer] = None
_global_scorer_lock = threading.Lock()


def get_instance() -> RiskScorer:
    """获取全局 RiskScorer 单例。"""
    global _global_scorer
    if _global_scorer is None:
        with _global_scorer_lock:
            if _global_scorer is None:
                _global_scorer = RiskScorer()
    return _global_scorer


__all__ = [
    "RiskScore",
    "RiskScorer",
    "get_instance",
]
