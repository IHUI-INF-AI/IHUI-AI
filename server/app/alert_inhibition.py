"""告警抑制 (Inhibition) 引擎 - app/alert_inhibition.py.

设计:
  - 复刻 alertmanager inhibit_rules 语义, 让应用层也能在 push 之前做预抑制
  - 规则: source_matchers 命中且 target_matchers 命中且 equal 字段全等 → target 被抑制
  - ZHS 平台预设 5 类场景:
      1. ZHSRollbackActive (critical) 抑制所有 canary 阶段告警
      2. ZHSDatabaseDown (critical) 抑制所有 DB 相关 warning
      3. ZHSServiceDown (critical) 抑制所有 canary ratio warning
      4. ZHSClusterDown (critical) 抑制所有 per-instance 告警
      5. CI drill failure 抑制其他 ZHS_CI_DRILL_*

用法:
    from app.alert_inhibition import AlertInhibitor, ZHS_INHIBITION_PRESETS

    inhibitor = AlertInhibitor(ZHS_INHIBITION_PRESETS)
    alerts = [
        {"labels": {"alertname": "ZHSRollbackActive", "severity": "critical"}},
        {"labels": {"alertname": "ZHSCanaryStageStuck", "severity": "warning"}},
    ]
    surviving = inhibitor.apply(alerts)
    # surviving[0] 是 ZHSRollbackActive, surviving[1] 被抑制
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------


@dataclass
class InhibitionRule:
    """单条抑制规则.

    语义 (与 alertmanager 一致):
      当存在 active 状态的 source_alert (其 labels 命中 source_matchers),
      且 candidate_alert 的 labels 命中 target_matchers,
      且两者在 equal 字段 (默认全字段) 上的值全部相等,
      则 candidate_alert 被抑制 (不发).

    Attributes:
        source_matchers: dict, source 告警 labels 必须全命中 (AND)
        target_matchers: dict, target 告警 labels 必须全命中 (AND)
        equal: list[str], 必须相等的 label 字段. None 表示 "任意字段相等即匹配"
                alertmanager 默认是 ['alertname'] (经典); 这里 None = "至少一个字段相等"
    """

    source_matchers: dict = field(default_factory=dict)
    target_matchers: dict = field(default_factory=dict)
    equal: list[str] | None = None
    name: str = ""  # 可选, 便于日志/调试

    def matches_source(self, labels: dict) -> bool:
        """判断告警 labels 是否命中 source 侧."""
        return _match(labels, self.source_matchers)

    def matches_target(self, labels: dict) -> bool:
        return _match(labels, self.target_matchers)

    def equal_labels_match(self, src: dict, tgt: dict) -> bool:
        """判断 source / target 在 equal 字段上是否全部相等."""
        if self.equal is None:
            # alertmanager 经典语义: equal 未指定时使用 ['alertname']
            keys = ["alertname"]
        else:
            keys = list(self.equal)
        return all(src.get(k) == tgt.get(k) for k in keys)


def _match(labels: dict, matchers: dict) -> bool:
    """labels 是否全命中 matchers (AND). 缺失键视为不命中."""
    return all(labels.get(k) == v for k, v in matchers.items())


# ---------------------------------------------------------------------------
# 抑制引擎
# ---------------------------------------------------------------------------


class AlertInhibitor:
    """告警抑制器: 对一组 active 告警按规则过滤掉被抑制的.

    Args:
        rules: 抑制规则列表
        dry_run: 若为 True, apply 不实际抑制 (返回全部告警), 但 would_suppress
                 仍会计算实际会抑制哪些, 方便先观察再开启
    """

    def __init__(self, rules: Iterable[InhibitionRule] | None = None, dry_run: bool = False):
        self._rules: list[InhibitionRule] = list(rules) if rules else []
        self._dry_run = dry_run

    @property
    def rules(self) -> list[InhibitionRule]:
        return list(self._rules)

    @property
    def dry_run(self) -> bool:
        return self._dry_run

    def set_dry_run(self, dry_run: bool) -> None:
        """动态切换 dry-run 模式."""
        self._dry_run = dry_run

    def add_rule(self, rule: InhibitionRule) -> None:
        self._rules.append(rule)

    def apply(self, alerts: list[dict]) -> list[dict]:
        """应用所有规则, 返回未被抑制的告警子集.

        内部保留顺序: 先出现的告警 (通常按时间序) 优先级高 (被识别为 source 后才能抑制后续).

        建议 146: dry_run=True 时不抑制, 全返回; 但 would_suppress 仍可调用拿预测.
        """
        if self._dry_run:
            # dry-run: 返回全部, 不抑制
            return list(alerts)
        surviving: list[dict] = []
        for alert in alerts:
            labels = alert.get("labels", {})
            # 看是否能被现存 source 抑制
            inhibited_by = self._find_inhibitor(labels, surviving)
            if inhibited_by is not None:
                rule_name = inhibited_by.name or "<unnamed>"
                logger.info(
                    f"[inhibition] suppress alert={labels.get('alertname')} "
                    f"severity={labels.get('severity', '?')} "
                    f"by_rule={rule_name}"
                )
                continue
            surviving.append(alert)
        return surviving

    def would_suppress(self, alerts: list[dict]) -> list[dict]:
        """预测 (不实际过滤) 哪些告警会被抑制. 永远返回 (即使 dry_run=True)."""
        surviving, _ = self._predict(alerts)
        return surviving

    def would_suppress_with_reason(self, alerts: list[dict]) -> list[tuple[dict, str]]:
        """预测并返回 (告警, 命中规则名) 列表. 永远返回."""
        _, suppressed = self._predict(alerts)
        return suppressed

    def _predict(self, alerts: list[dict]) -> tuple[list[dict], list[tuple[dict, str]]]:
        """预测: 返回 (surviving, [(alert, rule_name), ...])."""
        surviving: list[dict] = []
        suppressed: list[tuple[dict, str]] = []
        for alert in alerts:
            labels = alert.get("labels", {})
            rule = self._find_inhibitor(labels, surviving)
            if rule is not None:
                suppressed.append((alert, rule.name or "<unnamed>"))
            else:
                surviving.append(alert)
        return surviving, suppressed

    def _find_inhibitor(self, target_labels: dict, surviving: list[dict]) -> InhibitionRule | None:
        """在 surviving 中找 source, 看是否有规则能抑制 target_labels."""
        for rule in self._rules:
            if not rule.matches_target(target_labels):
                continue
            for source in surviving:
                src_labels = source.get("labels", {})
                if not rule.matches_source(src_labels):
                    continue
                if not rule.equal_labels_match(src_labels, target_labels):
                    continue
                return rule
        return None

    def classify(self, alerts: list[dict]) -> dict:
        """分类: 拆分 surviving / suppressed, 包含每条 suppressed 的命中规则.

        建议 146: dry_run=True 时, suppress_count 仍正确计算 (只是 apply 不真抑制).
        """
        surviving, suppressed = self._predict(alerts)
        return {
            "surviving": surviving,
            "suppressed": [{"alert": a, "inhibited_by_rule": rn} for a, rn in suppressed],
            "suppressed_count": len(suppressed),
        }


# ---------------------------------------------------------------------------
# ZHS 平台预设
# ---------------------------------------------------------------------------

# 1. canary 紧急回滚 → 抑制所有 canary 阶段告警
ZHS_ROLLBACK_INHIBITS_CANARY = InhibitionRule(
    name="zhs_rollback_inhibits_canary",
    source_matchers={"alertname": "ZHSRollbackActive", "severity": "critical"},
    target_matchers={"alertname": "ZHSCanaryStageStuck"},  # 阶段卡住
    equal=["service"],
)

# 2. 紧急回滚 → 抑制 canary 比例异常告警
ZHS_ROLLBACK_INHIBITS_RATIO = InhibitionRule(
    name="zhs_rollback_inhibits_ratio",
    source_matchers={"alertname": "ZHSRollbackActive", "severity": "critical"},
    target_matchers={"alertname": "ZHSCanaryRatioMismatch"},
    equal=["service"],
)

# 3. 数据库宕机 → 抑制所有 DB 慢查询 / 连接池告警 (同 service 即可)
ZHS_DATABASE_DOWN_INHIBITS_DB = InhibitionRule(
    name="zhs_db_down_inhibits_db_warnings",
    source_matchers={"alertname": "ZHSDatabaseDown", "severity": "critical"},
    target_matchers={"severity": "warning"},
    equal=["service"],
)

# 4. 服务整体宕机 → 抑制所有 per-instance / per-pod 告警
ZHS_SERVICE_DOWN_INHIBITS_INSTANCE = InhibitionRule(
    name="zhs_service_down_inhibits_instance_alerts",
    source_matchers={"alertname": "ZHSServiceDown", "severity": "critical"},
    target_matchers={"severity": "warning"},
    equal=["service"],
)

# 5. CI drill failure → 抑制其他 CI drill 子告警
ZHS_CI_DRILL_FAILURE_INHIBITS = InhibitionRule(
    name="zhs_ci_drill_failure_inhibits_subalerts",
    source_matchers={"alertname": "ZHS_CI_DRILL_FAILURE", "severity": "critical"},
    target_matchers={"severity": "warning"},
    equal=["service"],
)

# 6. classic critical→warning (沿用 alertmanager.yml 已有规则)
ZHS_CLASSIC_CRITICAL_INHIBITS_WARNING = InhibitionRule(
    name="zhs_classic_critical_inhibits_warning",
    source_matchers={"severity": "critical"},
    target_matchers={"severity": "warning"},
    equal=["alertname", "service"],
)


ZHS_INHIBITION_PRESETS: list[InhibitionRule] = [
    ZHS_ROLLBACK_INHIBITS_CANARY,
    ZHS_ROLLBACK_INHIBITS_RATIO,
    ZHS_DATABASE_DOWN_INHIBITS_DB,
    ZHS_SERVICE_DOWN_INHIBITS_INSTANCE,
    ZHS_CI_DRILL_FAILURE_INHIBITS,
    ZHS_CLASSIC_CRITICAL_INHIBITS_WARNING,
]


# ---------------------------------------------------------------------------
# YAML 生成 (与 alertmanager 格式一致, 用于 ops/alertmanager.yml 自动同步)
# ---------------------------------------------------------------------------


def to_alertmanager_yaml(rules: list[InhibitionRule]) -> str:
    """生成 alertmanager inhibit_rules YAML 片段.

    输出示例:
        inhibit_rules:
          - source_match:
              alertname: 'ZHSRollbackActive'
              severity: 'critical'
            target_match:
              alertname: 'ZHSCanaryStageStuck'
            equal: ['service']
            # name: zhs_rollback_inhibits_canary
    """
    lines = ["inhibit_rules:"]
    for rule in rules:
        lines.append(f"  - # name: {rule.name or 'unnamed'}")
        if rule.source_matchers:
            lines.append("    source_match:")
            for k, v in rule.source_matchers.items():
                lines.append(f"      {k}: '{v}'")
        if rule.target_matchers:
            lines.append("    target_match:")
            for k, v in rule.target_matchers.items():
                lines.append(f"      {k}: '{v}'")
        if rule.equal is not None:
            eq = ", ".join(f"'{e}'" for e in rule.equal)
            lines.append(f"    equal: [{eq}]")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# push_alert 集成钩子
# ---------------------------------------------------------------------------

_DEFAULT_INHIBITOR: AlertInhibitor | None = None
_INHIBITOR_LOCK_COUNTER = [0]  # 用 list 做引用, 避免全局锁依赖


def get_default_inhibitor() -> AlertInhibitor:
    """获取/创建默认 inhibitor (ZHS 平台预设)."""
    global _DEFAULT_INHIBITOR
    if _DEFAULT_INHIBITOR is None:
        _DEFAULT_INHIBITOR = AlertInhibitor(ZHS_INHIBITION_PRESETS)
    return _DEFAULT_INHIBITOR


def set_default_inhibitor(inhibitor: AlertInhibitor) -> None:
    """测试用: 注入自定义 inhibitor."""
    global _DEFAULT_INHIBITOR
    _DEFAULT_INHIBITOR = inhibitor


def reset_default_inhibitor() -> None:
    """测试用: 重置."""
    global _DEFAULT_INHIBITOR
    _DEFAULT_INHIBITOR = None


def filter_alerts(
    alerts: list[dict],
    inhibitor: AlertInhibitor | None = None,
    dry_run: bool = False,
) -> list[dict]:
    """便捷函数: 应用抑制规则, 返回未被抑制的告警.

    用法: 在 push_alert 之前调用:
        alerts = filter_alerts(alerts)

    建议 146: dry_run=True 时, 临时把 inhibitor 切到 dry-run 模式再 apply.
    """
    inh = inhibitor or get_default_inhibitor()
    if dry_run:
        # 临时切到 dry-run, 不改 inhibitor 本身的设置
        prev = inh.dry_run
        inh.set_dry_run(True)
        try:
            return inh.apply(alerts)
        finally:
            inh.set_dry_run(prev)
    return inh.apply(alerts)
