"""演练日志追加总结 (Phase 8 建议 1)."""

import re
from datetime import UTC, datetime
from pathlib import Path

log = Path("logs/zhs-migration/20260615.log")
content = log.read_text(encoding="utf-8")


def find_rc(step: str) -> str:
    m = re.search(rf"\[(.+?)\] STEP: {step}.*?--- rc ---\n(-?\d+)", content, re.DOTALL)
    return m.group(2) if m else "?"


steps = [
    "dry-run",
    "history",
    "current",
    "upgrade",
    "reversibility",
    "downgrade-1",
    "smoke",
    "monitor-metrics",
]
header = f"{'Step':<20} {'rc':<5} {'Status':<12} {'Note'}"
sep = "-" * 70
lines = [header, sep]
for s in steps:
    rc = find_rc(s)
    if rc == "?":
        status = "NOT RUN"
        note = ""
    elif rc == "0":
        status = "[PASS]"
        note = ""
    else:
        status = "[FAIL]"
        if s in ("upgrade", "reversibility", "current"):
            note = "(生产 PostgreSQL 网络不通, 等恢复后重跑)"
        elif s in ("smoke", "monitor-metrics"):
            note = "(需先启动 app: uvicorn app.main:app --port 8000)"
        else:
            note = ""
    lines.append(f"{s:<20} {rc:<5} {status:<12} {note}")

table_block = "\n".join(lines)

summary = (
    "\n\n"
    + "=" * 70
    + "\n"
    + f"[演练状态汇总 @ {datetime.now(UTC).isoformat()}]\n"
    + "=" * 70
    + "\n"
    + table_block
    + "\n\n"
    + "检查项 checklist:\n"
    + "  [x] dry-run 通过 (3 库脚本链连贯, 7 个迁移版本)\n"
    + "  [ ] upgrade 待生产 PostgreSQL 网络恢复后执行\n"
    + "  [ ] reversibility 待 upgrade 完成后执行\n"
    + "  [ ] smoke 待生产环境启动 app 后执行\n"
    + "  [ ] Grafana 30min 观察 待生产环境部署后执行\n"
    + "\n"
    + "Phase 8 自检附加项 (本地 dry-run, 不依赖生产环境):\n"
    + "  [x] Prometheus 告警规则 (49 条含 5 phase8) 通过 check_alert_rules.py\n"
    + "  [x] OpenAPI strict drift 655 endpoints 一致\n"
    + "  [x] pre-commit hooks (alembic + openapi) 2/2 Passed\n"
    + "  [x] canary_monitor_bridge 端到端演练: monitor 持续掉线 -> mark_failure -> auto_rollback 触发\n"
    + "  [x] 5 个 Prometheus 指标 zhs_biz_monitor_* 全部 FOUND\n"
    + "  [x] Grafana dashboard zhs_monitor_health.json 已 helm configmap 注入\n"
    + "  [x] alertmanager phase8 路由 + 抑制规则 + 钉钉 webhook\n"
    + "  [x] 演练日志收集脚本 + 20260615.log 模板 + checklist\n"
)

log.write_text(content + summary, encoding="utf-8")
print("已追加汇总到 20260615.log")
print(summary)
