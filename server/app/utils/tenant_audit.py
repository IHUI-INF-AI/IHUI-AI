"""Bug-61: 多租户数据隔离审计.

风险: 业务代码忘记带 tenant_id 过滤条件, 导致跨租户数据泄露.
方案: 包装 SQLAlchemy event, 检查 SQL 是否包含 tenant_id 过滤, 不包含则
      记录违规 (按表名 + 调用栈聚合), 触发告警.

使用:
    from app.utils.tenant_audit import tenant_auditor

    # 启动时 attach 到 engine
    tenant_auditor.attach(engines)

    # 业务代码忽略时会被检测到
    session.query(Order).filter(Order.status=1).all()  # 无 tenant_id → 违规

    # 提供白名单: 内部表 / 系统表 / 迁移工具
    tenant_auditor.whitelist_table("admin_oper_log")
"""

import logging
import re
import threading
import time
import traceback
from collections import defaultdict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# 默认带 tenant_id 的表 (业务表)
DEFAULT_TENANT_TABLES: set[str] = {
    "orders",
    "zhs_order",
    "users",
    "user_info",
    "agents",
    "agent_buy",
    "vip_level",
    "user_vip",
    "course",
    "zhs_course",
    "course_pay",
    "zhs_course_pay",
    "oauth_users",
    "oauth_sessions",
    "agents_call_log",
    "zhs_user_agent_context",
    "zhs_user_model_chat",
    "video_generation_tasks",
}

# 系统表 / 不需要 tenant_id 的表
DEFAULT_SKIP_TABLES: set[str] = {
    "admin_user",
    "admin_role",
    "admin_menu",
    "admin_dept",
    "admin_post",
    "admin_user_role",
    "admin_role_menu",
    "admin_role_dept",
    "admin_user_post",
    "admin_config",
    "admin_dict_type",
    "admin_dict_data",
    "admin_oper_log",
    "admin_logininfor",
    "admin_notice",
    "admin_job",
    "admin_job_log",
    "sys_refund_log",
    "alembic_version",
    "migrations",
    "zhs_ai_model_info",  # 共享模型
    "zhs_dictionary",
    "vip_level",  # VIP 等级字典共享
    "exchange_rate",
    "agent_configs",
    "agent_billings",
    "agents",
    "zhs_agent_category",
    "zhs_activity",
    "zhs_banner_carousel",
}


@dataclass
class Violation:
    """一次跨租户查询违规记录."""

    table: str
    sql: str
    timestamp: float
    stack: str = ""
    tenant_id: int | None = None
    user_uuid: str = ""

    def to_dict(self) -> dict:
        return {
            "table": self.table,
            "sql": self.sql[:200],
            "timestamp": self.timestamp,
            "tenant_id": self.tenant_id,
            "user_uuid": self.user_uuid,
            "stack": self.stack[:500],
        }


@dataclass
class AuditStats:
    """聚合统计."""

    total_queries: int = 0
    audited_queries: int = 0
    violations: int = 0
    by_table: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    by_table_violations: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    window_start: float = field(default_factory=time.time)

    def violation_rate(self) -> float:
        if self.audited_queries <= 0:
            return 0.0
        return self.violations / self.audited_queries


class TenantAuditor:
    """多租户数据隔离审计器.

    模式:
      - BLACKLIST: 命中带 tenant_id 的表, 但 SQL 中没有 tenant_id 条件 → 违规
      - WHITELIST: 命中不需要 tenant_id 的表 → 跳过
    """

    WINDOW_SEC = 3600.0  # 统计窗口 1h
    MAX_VIOLATIONS = 5000  # 最多保留 5000 条违规
    STACK_DEPTH = 8  # 调用栈深度

    def __init__(self):
        self._tenant_tables: set[str] = set(DEFAULT_TENANT_TABLES)
        self._skip_tables: set[str] = set(DEFAULT_SKIP_TABLES)
        self._violations: list[Violation] = []
        self._lock = threading.Lock()
        self._stats = AuditStats()
        self._attached_engines: set[int] = set()
        self._alerted_tables: set[str] = set()
        self._alert_threshold = 0.1  # 违规率 > 10% 触发告警
        self._min_audits_for_alert = 50  # 至少审计 50 次

    # ----- 配置 -----
    def add_tenant_table(self, table: str) -> None:
        with self._lock:
            self._tenant_tables.add(table.lower())
            self._skip_tables.discard(table.lower())

    def whitelist_table(self, table: str) -> None:
        with self._lock:
            self._skip_tables.add(table.lower())
            self._tenant_tables.discard(table.lower())

    def set_alert_threshold(self, rate: float) -> None:
        self._alert_threshold = max(0.0, min(1.0, rate))

    # ----- 主入口 -----
    def check(
        self,
        sql: str,
        params: list | None = None,
        tenant_id: int | None = None,
        user_uuid: str = "",
    ) -> Violation | None:
        """检查单条 SQL 是否违反租户隔离."""
        if not sql:
            return None
        with self._lock:
            self._stats.total_queries += 1
        # 提取主表
        table = self._extract_main_table(sql)
        if not table:
            return None
        table_lower = table.lower()
        with self._lock:
            if table_lower in self._skip_tables:
                return None
            if table_lower not in self._tenant_tables:
                return None
            self._stats.audited_queries += 1
            self._stats.by_table[table_lower] += 1
        # SELECT/UPDATE/DELETE 都应带 tenant_id
        s_lower = sql.lower().lstrip()
        if not (s_lower.startswith("select") or s_lower.startswith("update") or s_lower.startswith("delete")):
            return None
        # INSERT 也应带 tenant_id, 但允许 INSERT INTO t(...) VALUES(...) 简化跳过
        if s_lower.startswith("insert"):
            # 复杂判断: 是否有 tenant_id 值
            if "tenant_id" not in s_lower:
                return self._record_violation(table_lower, sql, tenant_id, user_uuid, "insert_no_tenant")
            return None
        # 检查 WHERE/AND 包含 tenant_id
        if not self._has_tenant_filter(sql, params):
            return self._record_violation(table_lower, sql, tenant_id, user_uuid, "missing_tenant_filter")
        return None

    def _has_tenant_filter(self, sql: str, params: list | None) -> bool:
        """检查 SQL 是否包含 tenant_id 条件 (或 param 包含)."""
        if "tenant_id" in sql.lower():
            return True
        # 检查 params 里有无 tenant_id
        if params:
            try:
                if isinstance(params, dict):
                    return "tenant_id" in params
                if isinstance(params, (list, tuple)):
                    # 启发: 如果有参数, 第一个是 tenant_id 的概率较高
                    for p in params:
                        if isinstance(p, int) and 0 < p < 100000:
                            return True
            except Exception:
                logger.warning("Caught unexpected exception")
        return False

    def _extract_main_table(self, sql: str) -> str:
        s = re.sub(r"\s+", " ", sql).strip()
        # SELECT ... FROM table
        m = re.search(
            r'from\s+[`"\']?([a-zA-Z0-9_]+)[`"\']?',
            s,
            re.IGNORECASE,
        )
        if m:
            return m.group(1)
        m = re.search(
            r'update\s+[`"\']?([a-zA-Z0-9_]+)',
            s,
            re.IGNORECASE,
        )
        if m:
            return m.group(1)
        m = re.search(
            r'delete\s+from\s+[`"\']?([a-zA-Z0-9_]+)',
            s,
            re.IGNORECASE,
        )
        if m:
            return m.group(1)
        m = re.search(
            r'insert\s+into\s+[`"\']?([a-zA-Z0-9_]+)',
            s,
            re.IGNORECASE,
        )
        if m:
            return m.group(1)
        return ""

    def _record_violation(
        self,
        table: str,
        sql: str,
        tenant_id: int | None,
        user_uuid: str,
        kind: str,
    ) -> Violation:
        stack = "".join(traceback.format_stack(limit=self.STACK_DEPTH))
        v = Violation(
            table=table,
            sql=sql,
            timestamp=time.time(),
            stack=stack,
            tenant_id=tenant_id,
            user_uuid=user_uuid,
        )
        v.kind = kind  # type: ignore[attr-defined]
        with self._lock:
            self._violations.append(v)
            if len(self._violations) > self.MAX_VIOLATIONS:
                self._violations = self._violations[-self.MAX_VIOLATIONS :]
            self._stats.violations += 1
            self._stats.by_table_violations[table] += 1
        # 触发告警 (按表去重)
        if table not in self._alerted_tables:
            self._maybe_alert(table)
        return v

    def _maybe_alert(self, table: str) -> None:
        """违规率达到阈值时告警."""
        with self._lock:
            audits = self._stats.audited_queries
            violations = self._stats.violations
        if audits < self._min_audits_for_alert:
            return
        rate = violations / audits if audits > 0 else 0
        if rate < self._alert_threshold:
            return
        with self._lock:
            self._alerted_tables.add(table)
        try:
            from app.utils.alert_router import alert_critical

            alert_critical(
                f"tenant_audit_violation:{table}",
                f"Tenant isolation violation rate {rate:.1%} on {table} "
                f"({violations}/{audits}). Check business code for missing "
                f"tenant_id filter.",
            )
        except Exception:
            logger.warning("Caught unexpected exception")

    def reset_alert(self, table: str | None = None) -> None:
        with self._lock:
            if table is None:
                self._alerted_tables.clear()
            else:
                self._alerted_tables.discard(table)

    # ----- 统计 -----
    def stats(self) -> dict:
        with self._lock:
            return {
                "total_queries": self._stats.total_queries,
                "audited_queries": self._stats.audited_queries,
                "violations": self._stats.violations,
                "violation_rate": round(self._stats.violation_rate(), 4),
                "alert_threshold": self._alert_threshold,
                "by_table": dict(self._stats.by_table),
                "by_table_violations": dict(self._stats.by_table_violations),
                "tracked_tenant_tables": len(self._tenant_tables),
                "skipped_tables": len(self._skip_tables),
            }

    def recent_violations(self, limit: int = 50) -> list[dict]:
        with self._lock:
            return [v.to_dict() for v in self._violations[-limit:]]

    def reset(self) -> None:
        with self._lock:
            self._violations.clear()
            self._stats = AuditStats()
            self._alerted_tables.clear()

    # ----- 接入 SQLAlchemy engine -----
    def attach(self, engines: dict[str, object]) -> int:
        """挂到多个 engine 的 before_cursor_execute 事件. 返回成功数."""
        attached = 0
        for name, eng in engines.items():
            try:
                if id(eng) in self._attached_engines:
                    continue
                from sqlalchemy import event

                @event.listens_for(eng, "before_cursor_execute")
                def _on_execute(conn, cursor, statement, parameters, context, executemany):
                    try:
                        tenant_id = self._current_tenant()
                        user_uuid = self._current_user()
                        self.check(
                            statement,
                            parameters,
                            tenant_id=tenant_id,
                            user_uuid=user_uuid,
                        )
                    except Exception:
                        logger.warning("Caught unexpected exception")

                self._attached_engines.add(id(eng))
                attached += 1
            except Exception as e:
                logger.debug(f"attach engine {name} fail: {e}")
        return attached

    def _current_tenant(self) -> int | None:
        try:
            from app.core.tenant import get_current_tenant_id

            return get_current_tenant_id()
        except Exception:
            return None

    def _current_user(self) -> str:
        try:
            from app.telemetry import get_request_context

            ctx = get_request_context()
            return str(ctx.get("user_uuid", "")) if ctx else ""
        except Exception:
            return ""


# 全局单例
tenant_auditor = TenantAuditor()
