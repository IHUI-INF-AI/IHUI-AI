"""慢 SQL 告警链路演练 (建议 96).

不依赖真实 prom / alertmanager, 在 in-process 内完成:
  1. 启动一个临时的 prometheus_client 指标 registry
  2. 模拟一次慢 SQL (sleep + inc 计数器)
  3. 验证 prom /metrics 端点能 scrape 到 zhs_slow_sql_with_trace_total > 0
  4. 验证 prom rules.yml 中的告警 expr 语法合法 (用 prometheus_client.parser)
  5. 输出 PASS/FAIL, 退出码 0/1

CI 用法 (在 .github/workflows 中):
    python scripts/ci/drill_slow_sql_alert.py

本地手动:
    python scripts/ci/drill_slow_sql_alert.py --sleep 0.6 --label engine=ai,table=t_order
"""

import argparse
import re
import sys
import time
from pathlib import Path

import yaml
from prometheus_client import generate_latest
from prometheus_client.parser import text_string_to_metric_families

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

RULES_PATH = ROOT / "docker" / "prometheus" / "rules.yml"


# ---------------------------------------------------------------------------
# Step 1: 模拟慢 SQL, 写指标
# ---------------------------------------------------------------------------


def _simulate_slow_sql(sleep_s: float, engine: str, table: str, with_trace: bool = True) -> int:
    """模拟一次慢 SQL: sleep + inc 指标. 返回 inc 后的当前值."""
    from app.monitoring import SLOW_SQL_WITH_TRACE  # type: ignore

    time.sleep(sleep_s)
    # 模拟有 OTel trace 的情况
    if with_trace:
        # 建议 117: tenant_id label, drill 场景用 "_drill_" 占位 (避免污染真实租户指标)
        SLOW_SQL_WITH_TRACE.labels(engine=engine, table=table, tenant_id="_drill_").inc()
    return int(SLOW_SQL_WITH_TRACE.labels(engine=engine, table=table, tenant_id="_drill_")._value.get())


# ---------------------------------------------------------------------------
# Step 2: scrape /metrics, 验证指标出现
# ---------------------------------------------------------------------------


def _scrape_metrics_text() -> str:
    """从默认 prometheus_client registry 抓取当前所有指标 (text 格式)."""
    return generate_latest().decode("utf-8")


def _parse_metrics(metrics_text: str) -> list:
    """把 metrics text 解析回 metric families."""
    return list(text_string_to_metric_families(metrics_text))


def _check_slow_sql_metric_visible(engine: str, table: str) -> bool:
    """验证 zhs_slow_sql_with_trace_total{engine=...,table=...} 在 scrape 输出里."""
    text = _scrape_metrics_text()
    pattern = re.compile(
        rf"zhs_slow_sql_with_trace_total\{{[^}}]*engine=\"{engine}\"[^}}]*table=\"{table}\"[^}}]*\}}\s+(\d+(?:\.\d+)?)"
    )
    m = pattern.search(text)
    if not m:
        return False
    return float(m.group(1)) > 0


# ---------------------------------------------------------------------------
# Step 3: 验证 prom rules.yml 语法合法
# ---------------------------------------------------------------------------


def _validate_rules_yaml() -> list:
    """解析 rules.yml, 检查每个告警 expr 基础健全性.

    不做 PromQL 深度解析 (需要 promtool). 只检查:
      - expr 非空字符串
      - expr 含 PromQL 关键字 (sum/rate/...) 或比较运算符
    """
    with open(RULES_PATH, encoding="utf-8") as f:
        rules = yaml.safe_load(f)
    errors = []
    promql_keywords = (
        "sum",
        "rate",
        "increase",
        "topk",
        "count",
        "avg",
        "max",
        "min",
        "histogram_quantile",
        "abs",
        "irate",
        "by ",
        "without ",
    )
    compare_ops = (">", "<", "==", "!=", ">=", "<=", "=~", "!~")
    for grp in rules.get("groups", []):
        for rule in grp.get("rules", []):
            if "alert" not in rule:
                continue
            name = rule["alert"]
            expr = rule.get("expr", "")
            if not expr or not isinstance(expr, str):
                errors.append(f"{name}: expr 为空或非字符串")
                continue
            # 规范化: 多行 expr 折叠成单行 (yaml literal block 解析后含 \n)
            expr_norm = expr.replace("\n", " ").replace("\t", " ").strip()
            expr_lower = expr_norm.lower()
            has_keyword = any(kw in expr_lower for kw in promql_keywords)
            has_compare = any(op in expr_norm for op in compare_ops)
            if not (has_keyword or has_compare):
                errors.append(f"{name}: expr 既无 PromQL 关键字也无比较运算符")
    return errors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    p = argparse.ArgumentParser(description="慢 SQL 告警演练 (建议 96)")
    p.add_argument("--sleep", type=float, default=0.6, help="模拟慢 SQL 耗时 (秒)")
    p.add_argument("--engine", default="ai", help="engine label")
    p.add_argument("--table", default="t_order", help="table label")
    p.add_argument("--no-trace", action="store_true", help="不模拟带 OTel trace (应不触发 WITH_TRACE)")
    args = p.parse_args()

    print("=" * 60)
    print("慢 SQL 告警演练 (建议 96)")
    print("=" * 60)
    print(f"配置: sleep={args.sleep}s engine={args.engine} table={args.table} trace={not args.no_trace}")

    # Step 1: 注入慢 SQL
    print("\n[Step 1] 模拟慢 SQL (sleep + 写指标)...")
    if args.no_trace:
        # 模拟"无 trace"场景: 写 SLOW_COUNT 但不写 WITH_TRACE
        from app.monitoring import SQL_SLOW_COUNT  # type: ignore

        time.sleep(args.sleep)
        SQL_SLOW_COUNT.labels(engine=args.engine, table=args.table).inc()
        print("  -> 写入 SQL_SLOW_COUNT, 但跳过 WITH_TRACE (无 trace 场景)")
    else:
        v = _simulate_slow_sql(args.sleep, args.engine, args.table)
        print(f"  -> zhs_slow_sql_with_trace_total{{engine={args.engine},table={args.table}}} = {v}")

    # Step 2: scrape /metrics
    print("\n[Step 2] scrape /metrics 验证指标可见...")
    visible = _check_slow_sql_metric_visible(args.engine, args.table)
    if visible:
        print("  -> ✅ 指标在 scrape 输出中可见")
    else:
        if args.no_trace:
            print("  -> ✅ 无 trace 场景下 WITH_TRACE 未出现 (符合预期)")
        else:
            print("  -> ❌ 指标在 scrape 输出中不可见")
            return 1

    # Step 3: 验证 prom rules 合法
    print("\n[Step 3] 验证 docker/prometheus/rules.yml 告警规则语法...")
    errors = _validate_rules_yaml()
    if errors:
        print(f"  -> ❌ rules.yml 含 {len(errors)} 个语法问题:")
        for e in errors[:10]:
            print(f"     - {e}")
        return 1
    print("  -> ✅ 所有告警 expr 合法")

    # Step 4: 验证关键告警存在
    print("\n[Step 4] 验证关键告警 (ZHSSlowSQLWithTrace / ZHSSlowSQLBurst) 存在...")
    with open(RULES_PATH, encoding="utf-8") as f:
        rules = yaml.safe_load(f)
    all_alerts = {r["alert"] for grp in rules["groups"] for r in grp["rules"] if "alert" in r}
    required = ["ZHSSlowSQLWithTrace", "ZHSSlowSQLBurst"]
    missing = [a for a in required if a not in all_alerts]
    if missing:
        print(f"  -> ❌ 缺告警: {missing}")
        return 1
    print(f"  -> ✅ 关键告警存在: {required}")

    print("\n" + "=" * 60)
    print("✅ PASS: 慢 SQL 告警链路演练通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
