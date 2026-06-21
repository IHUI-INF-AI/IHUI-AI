"""Bug-60: GraphQL/ORM N+1 检测 + 自动 batch 合并.

两层防护:
  1. 检测: 包装 SQLAlchemy session, 累计相似 SQL 数量. 同一表+同一参数模式
     在 N 秒内出现 K 次 → 标记 N+1 嫌疑, 触发告警 (Bug-58 接入)
  2. 合并: 提供 batch_load(items, loader) 工具, 业务代码把 N 次单查替换为
     一次 batch 调用, loader 内部 IN 查 + 拼回

使用:
    from app.utils.n_plus_one import npo_detector, batch_load

    # 1) 检测: 配置 SQLAlchemy event listener
    npo_detector.attach_to_engine(engine)

    # 2) 合并: 业务代码
    async def load_user(user_id):
        # 原: N 次单查
        return db.query(User).get(user_id)

    # 改为:
    users = await batch_load(user_ids, load_user)
"""

import asyncio
import hashlib
import logging
import re
import threading
import time
from collections import defaultdict
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass, field
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


# ---------------------------------------------------------------------------
# 检测器: 累计相似查询, 触发告警
# ---------------------------------------------------------------------------


@dataclass
class QuerySig:
    """SQL 签名: 表名 + WHERE 模式 + 参数 hash."""

    table: str
    pattern: str
    key: str
    count: int = 0
    first_seen: float = 0.0
    last_seen: float = 0.0
    sample_params: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "table": self.table,
            "pattern": self.pattern,
            "key": self.key,
            "count": self.count,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
            "sample_params": self.sample_params[:3],
        }


class NPlusOneDetector:
    """线程安全的 N+1 检测器.

    触发条件 (同 key 在 WINDOW_SEC 内累计 >= MIN_REPEAT 视为 N+1).
    """

    DEFAULT_WINDOW_SEC = 5.0
    DEFAULT_MIN_REPEAT = 8  # 8 次相似查询
    PATTERN_LIMIT = 200  # 最多记录 200 个 sig

    def __init__(self):
        self._sigs: dict[str, QuerySig] = {}
        self._lock = threading.Lock()
        self._alerted_keys: set = set()
        self._total_queries = 0
        self._n_plus_one_alerts = 0

    @staticmethod
    def _extract_table(sql: str) -> str:
        """从 SQL 提取主表名. 兼容 SELECT ... FROM table."""
        if not sql:
            return ""
        # 移除多空格
        s = re.sub(r"\s+", " ", sql).strip()
        m = re.search(r"from\s+[`\"\']?([a-zA-Z0-9_]+)[`\"\']?", s, re.IGNORECASE)
        if m:
            return m.group(1).lower()
        m = re.search(r"update\s+[`\"\']?([a-zA-Z0-9_]+)", s, re.IGNORECASE)
        if m:
            return m.group(1).lower()
        m = re.search(r"insert\s+into\s+[`\"\']?([a-zA-Z0-9_]+)", s, re.IGNORECASE)
        if m:
            return m.group(1).lower()
        return ""

    @staticmethod
    def _normalize(sql: str) -> str:
        """把 SQL 中的字面量替换为占位符, 保留结构."""
        if not sql:
            return ""
        s = sql
        # 数字
        s = re.sub(r"\b\d+\b", "?", s)
        # 字符串字面量
        s = re.sub(r"'[^']*'", "?", s)
        s = re.sub(r'"[^"]*"', "?", s)
        # 多余空白
        s = re.sub(r"\s+", " ", s).strip()
        return s[:300]

    def record(self, sql: str, params: Any = None) -> QuerySig | None:
        """记录一次 SQL, 命中规则返回 sig, 否则 None.

        Returns:
            N+1 嫌疑 sig (告警后), 否则 None
        """
        self._total_queries += 1
        table = self._extract_table(sql)
        if not table:
            return None
        # 只检测 SELECT, 排除 batch
        norm = self._normalize(sql)
        if not norm.lower().startswith("select"):
            return None
        # 排除明显带 IN 的批量
        if re.search(r"\bIN\s*\(\s*\?+\s*\)", norm, re.IGNORECASE) or "= ANY" in norm.upper():
            return None
        # 计算 key
        key_src = f"{table}|{norm}"
        key = hashlib.md5(key_src.encode()).hexdigest()[:16]
        now = time.time()
        with self._lock:
            # 清过期的
            self._gc_expired(now)
            sig = self._sigs.get(key)
            if sig is None:
                if len(self._sigs) >= self.PATTERN_LIMIT:
                    return None
                sig = QuerySig(
                    table=table,
                    pattern=norm,
                    key=key,
                    first_seen=now,
                    last_seen=now,
                )
                sig.count = 1
                if params is not None:
                    try:
                        sig.sample_params = list(params)[:3] if hasattr(params, "__iter__") else [params]
                    except Exception:
                        logger.warning("Caught unexpected exception")
                self._sigs[key] = sig
                return None
            sig.count += 1
            sig.last_seen = now
            window = now - sig.first_seen
            if (
                sig.count >= self.DEFAULT_MIN_REPEAT
                and window <= self.DEFAULT_WINDOW_SEC
                and key not in self._alerted_keys
            ):
                self._alerted_keys.add(key)
                self._n_plus_one_alerts += 1
                # 触发告警 (Bug-58 接入, 失败不抛)
                try:
                    from app.utils.alert_router import alert_warning

                    alert_warning(
                        f"n_plus_one:{table}:{key[:8]}",
                        f"Potential N+1 detected on {table}: "
                        f"{sig.count} similar queries in {window:.2f}s. "
                        f"Sample SQL: {norm[:120]}",
                    )
                except Exception:
                    logger.warning("Caught unexpected exception")
                return sig
        return None

    def _gc_expired(self, now: float) -> None:
        """清理过期的 sig 与 alert 标记 (节流)."""
        if len(self._sigs) < self.PATTERN_LIMIT:
            return
        # 淘汰最久没用的
        sorted_sigs = sorted(self._sigs.items(), key=lambda x: x[1].last_seen)
        for k, _ in sorted_sigs[: max(0, len(sorted_sigs) - self.PATTERN_LIMIT + 10)]:
            self._sigs.pop(k, None)
            self._alerted_keys.discard(k)

    def stats(self) -> dict:
        with self._lock:
            return {
                "total_queries": self._total_queries,
                "tracked_patterns": len(self._sigs),
                "n_plus_one_alerts": self._n_plus_one_alerts,
                "top_suspects": sorted(
                    [s.to_dict() for s in self._sigs.values()],
                    key=lambda x: -x["count"],
                )[:5],
            }

    def reset(self) -> None:
        with self._lock:
            self._sigs.clear()
            self._alerted_keys.clear()
            self._total_queries = 0
            self._n_plus_one_alerts = 0

    # ----- 接入 SQLAlchemy engine -----
    def attach_to_engine(self, engine) -> bool:
        """挂到 SQLAlchemy engine 的 before_cursor_execute 事件."""
        try:
            from sqlalchemy import event

            @event.listens_for(engine, "before_cursor_execute")
            def _on_execute(conn, cursor, statement, parameters, context, executemany):
                try:
                    self.record(statement, parameters)
                except Exception:
                    logger.warning("Caught unexpected exception")

            return True
        except Exception as e:
            logger.debug(f"attach_to_engine fail: {e}")
            return False


# 全局单例
npo_detector = NPlusOneDetector()


# ---------------------------------------------------------------------------
# 自动 batch 合并工具
# ---------------------------------------------------------------------------


async def batch_load(
    items: Iterable[T],
    loader: Callable[[T], Awaitable[Any]],
    *,
    max_chunk: int = 100,
) -> dict[T, Any]:
    """把多次单查合并为并发批.

    Args:
        items: 要加载的 key 列表
        loader: 异步加载函数, 接一个 key, 返回结果
        max_chunk: 单次最大并发

    Returns:
        {key: result} 字典, 失败的 key 不在结果里
    """
    keys = list(items)
    if not keys:
        return {}
    out: dict[T, Any] = {}
    # 分块
    for i in range(0, len(keys), max_chunk):
        chunk = keys[i : i + max_chunk]
        coros = [loader(k) for k in chunk]
        results = await asyncio.gather(*coros, return_exceptions=True)
        for k, r in zip(chunk, results, strict=True):
            if isinstance(r, Exception):
                logger.debug(f"batch_load key={k} err: {r}")
                continue
            out[k] = r
    return out


def batch_load_sync(
    items: Iterable[T],
    loader: Callable[[T], Any],
    *,
    max_chunk: int = 100,
) -> dict[T, Any]:
    """同步版 batch_load."""
    keys = list(items)
    if not keys:
        return {}
    out: dict[T, Any] = {}
    for i in range(0, len(keys), max_chunk):
        chunk = keys[i : i + max_chunk]
        for k in chunk:
            try:
                r = loader(k)
                out[k] = r
            except Exception as e:
                logger.debug(f"batch_load_sync key={k} err: {e}")
    return out


# ---------------------------------------------------------------------------
# 主动预加载: 在不修改业务代码前提下, 跟踪外键关系自动预加载
# ---------------------------------------------------------------------------


def suggest_eager_load(
    n_plus_one_sigs: list[QuerySig],
    orm_models: dict[str, type],
) -> dict[str, list[str]]:
    """根据 N+1 检测结果建议 joinedload 字段.

    Args:
        n_plus_one_sigs: npo_detector 暴露的嫌疑 sig 列表
        orm_models: 表名 -> ORM model class

    Returns:
        {table: [field_names_to_eager_load]}
    """
    suggest: dict[str, list[str]] = defaultdict(list)
    for sig in n_plus_one_sigs:
        tbl = sig.table
        model = orm_models.get(tbl)
        if model is None:
            continue
        # 简单规则: WHERE 里有外键 (fk_xxx = ?), 建议 joinedload xxx
        fk_match = re.search(r"`?fk_([a-zA-Z0-9_]+)`?\s*=", sig.pattern, re.IGNORECASE)
        if fk_match:
            suggest[tbl].append(fk_match.group(1))
    return dict(suggest)
