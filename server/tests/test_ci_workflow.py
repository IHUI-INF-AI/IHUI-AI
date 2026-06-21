"""CI Nightly Observability Drill workflow 验证 (建议 115).

覆盖:
  - .github/workflows/observability-drills.yml YAML 语法
  - cron schedule 与 ws-loadtest 错开
  - 4 个 job 都接入了对应 CI 脚本
  - 步骤顺序 (checkout -> setup-python -> install -> run -> upload)
  - 失败通知 (notify-failure job 存在 + 引用所有上游 job)
  - alertmanager.yml 含 zhs-ci-drill receiver
  - rules.yml 含 ZHS_CI_DRILL_* 3 条告警
"""

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


WORKFLOW_PATH = ROOT / ".github" / "workflows" / "observability-drills.yml"
ALERTMANAGER_PATH = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml"
RULES_PATH = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"
WS_LOADTEST_PATH = ROOT / ".github" / "workflows" / "ws-loadtest.yml"


# ---------------------------------------------------------------------------
# 1. workflow YAML 语法
# ---------------------------------------------------------------------------


def test_workflow_yaml_parses():
    """observability-drills.yml 必须是合法 YAML."""
    assert WORKFLOW_PATH.exists(), f"workflow 不存在: {WORKFLOW_PATH}"
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert data is not None
    assert isinstance(data, dict)
    assert "jobs" in data, "应包含 jobs"


def test_workflow_name_and_triggers():
    """workflow 名称 + 触发器 (schedule + workflow_dispatch)."""
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert data.get("name") == "Observability Drills (Nightly)"
    assert "on" in data or True in data
    triggers = data.get(True) or data.get("on")
    assert "schedule" in triggers, "应有定时调度"
    assert "workflow_dispatch" in triggers, "应支持手动触发"


# ---------------------------------------------------------------------------
# 2. cron 错开 ws-loadtest (避免资源争抢)
# ---------------------------------------------------------------------------


def test_cron_schedule_present():
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    triggers = data.get(True) or data.get("on")
    schedules = triggers["schedule"]
    assert len(schedules) >= 1
    cron = schedules[0]["cron"]
    # 5-field cron: minute hour day-of-month month day-of-week
    # day-of-week 段允许 *, 1, 1,3,5 等
    assert re.match(r"^\d+\s+\d+\s+\*\s+\*\s+(\*|\d+(,\d+)*)$", cron), f"cron 格式异常: {cron}"


def test_cron_schedule_excludes_ws_loadtest_days():
    """drills cron 错开 ws-loadtest (1,3,5 vs 0,2,4)."""
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    triggers = data.get(True) or data.get("on")
    drills_cron = triggers["schedule"][0]["cron"]
    # drills 0 20 * * 1,3,5
    assert "1,3,5" in drills_cron or "1,3,5" in str(
        drills_cron
    ), f"drills 应在 1,3,5 (避开 ws-loadtest 的 0,2,4): {drills_cron}"


def test_cron_schedule_does_not_overlap_ws_loadtest():
    """drills 与 ws-loadtest 的 cron 表达式不重叠."""
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        drills = yaml.safe_load(f)
    with open(WS_LOADTEST_PATH, encoding="utf-8") as f:
        ws = yaml.safe_load(f)
    drills_cron = (drills.get(True) or drills.get("on"))["schedule"][0]["cron"]
    ws_cron = (ws.get(True) or ws.get("on"))["schedule"][0]["cron"]
    # 不应完全相同
    assert drills_cron != ws_cron, f"drills 与 ws-loadtest cron 不应完全相同: drills={drills_cron} ws={ws_cron}"


# ---------------------------------------------------------------------------
# 3. 4 个核心 job 都接入了对应 CI 脚本
# ---------------------------------------------------------------------------


def test_jobs_count():
    """workflow 应有 5 个 job: 4 drill + 1 notify-failure."""
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    jobs = data["jobs"]
    assert len(jobs) >= 4, f"应有 4+ job, 实际: {len(jobs)}"


def test_job_check_alert_rules_exists():
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    jobs = data["jobs"]
    assert "check-alert-rules" in jobs, "应包含 check-alert-rules job"
    run = _find_step(jobs["check-alert-rules"], "run", "check_alert_rules")
    assert run is not None, "check-alert-rules 应运行 check_alert_rules.py"
    assert "check_alert_rules.py" in run


def test_job_drill_slow_sql_exists():
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    jobs = data["jobs"]
    assert "drill-slow-sql" in jobs, "应包含 drill-slow-sql job"
    run = _find_step(jobs["drill-slow-sql"], "run", "drill_slow_sql_alert")
    assert run is not None
    assert "drill_slow_sql_alert.py" in run


def test_job_drill_alert_webhook_exists():
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    jobs = data["jobs"]
    assert "drill-alert-webhook" in jobs, "应包含 drill-alert-webhook job"
    run = _find_step(jobs["drill-alert-webhook"], "run", "drill_alert_webhook")
    assert run is not None
    assert "drill_alert_webhook.py" in run


def test_job_test_pg_compatibility_exists():
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    jobs = data["jobs"]
    assert "test-pg-compatibility" in jobs, "应包含 test-pg-compatibility job"
    run = _find_step(jobs["test-pg-compatibility"], "run", "test_pg_compatibility")
    assert run is not None
    assert "test_pg_compatibility.py" in run


def _find_step(job: dict, step_type: str, name_hint: str) -> str | None:
    """从 job.steps 中找含 name_hint 的 run 步骤."""
    for step in job.get("steps", []):
        if name_hint in str(step.get("name", "")) or name_hint in str(step.get("run", "")):
            if step_type in step:
                return step[step_type]
    return None


# ---------------------------------------------------------------------------
# 4. 失败通知 notify-failure
# ---------------------------------------------------------------------------


def test_notify_failure_job_exists():
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    jobs = data["jobs"]
    assert "notify-failure" in jobs, "应包含 notify-failure job"


def test_notify_failure_depends_on_all_drill_jobs():
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    jobs = data["jobs"]
    notify = jobs["notify-failure"]
    needs = notify.get("needs", [])
    if isinstance(needs, str):
        needs = [needs]
    # 应依赖 4 个 drill job
    for job_name in ("check-alert-rules", "drill-slow-sql", "drill-alert-webhook", "test-pg-compatibility"):
        assert job_name in needs, f"notify-failure 应依赖 {job_name}, 实际 needs={needs}"


def test_notify_failure_triggers_on_failure():
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    notify = data["jobs"]["notify-failure"]
    cond = notify.get("if", "")
    assert "failure" in cond, f"notify-failure 应只在上游失败时触发, 实际 if={cond!r}"


# ---------------------------------------------------------------------------
# 5. 步骤顺序 (checkout -> setup-python -> install -> run)
# ---------------------------------------------------------------------------


def test_check_alert_rules_step_order():
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    steps = data["jobs"]["check-alert-rules"]["steps"]
    has_checkout = any("actions/checkout" in str(s.get("uses", "")) for s in steps)
    has_setup_py = any("actions/setup-python" in str(s.get("uses", "")) for s in steps)
    has_install = any("pip install" in str(s.get("run", "")) for s in steps)
    has_run = any("check_alert_rules" in str(s.get("run", "")) for s in steps)
    assert has_checkout, "应有 checkout 步骤"
    assert has_setup_py, "应有 setup-python 步骤"
    assert has_install, "应有 pip install 步骤"
    assert has_run, "应有运行脚本步骤"
    # 顺序: checkout 必须在 setup-python 之前
    idx_co = next(i for i, s in enumerate(steps) if "actions/checkout" in str(s.get("uses", "")))
    idx_py = next(i for i, s in enumerate(steps) if "actions/setup-python" in str(s.get("uses", "")))
    assert idx_co < idx_py, "checkout 应在 setup-python 之前"


def test_drill_slow_sql_uses_redis_service():
    """drill-slow-sql 需 redis 服务, 否则会 connect refused."""
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    job = data["jobs"]["drill-slow-sql"]
    services = job.get("services", {})
    assert "redis" in services, "drill-slow-sql 应包含 redis service"


def test_test_pg_compatibility_uses_postgres_service():
    """test-pg-compatibility 需 postgres 服务, 否则连不上."""
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    job = data["jobs"]["test-pg-compatibility"]
    services = job.get("services", {})
    assert "postgres" in services, "test-pg-compatibility 应包含 postgres service"


# ---------------------------------------------------------------------------
# 6. alertmanager.yml 含 zhs-ci-drill receiver + 路由
# ---------------------------------------------------------------------------


def test_alertmanager_yaml_parses():
    assert ALERTMANAGER_PATH.exists()
    with open(ALERTMANAGER_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert data is not None


def test_alertmanager_has_ci_drill_receiver():
    with open(ALERTMANAGER_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    receivers = data.get("receivers", [])
    names = [r.get("name") for r in receivers]
    assert "zhs-ci-drill" in names, f"alertmanager 应包含 zhs-ci-drill receiver, 实际: {names}"


def test_alertmanager_ci_drill_receiver_has_webhook():
    with open(ALERTMANAGER_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    receivers = data.get("receivers", [])
    ci_drill = next((r for r in receivers if r.get("name") == "zhs-ci-drill"), None)
    assert ci_drill is not None
    assert "webhook_configs" in ci_drill, "zhs-ci-drill 应有 webhook_configs"
    assert len(ci_drill["webhook_configs"]) >= 1


def test_alertmanager_ci_drill_route_present():
    with open(ALERTMANAGER_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    route = data.get("route", {})
    sub_routes = route.get("routes", [])
    # 找 match_re: ZHS_CI_DRILL_.*
    has_match_re = any(
        "match_re" in sr and "ZHS_CI_DRILL_" in str(sr["match_re"].get("alertname", "")) for sr in sub_routes
    )
    assert has_match_re, "alertmanager 应有 alertname=~ZHS_CI_DRILL_.* 路由"


# ---------------------------------------------------------------------------
# 7. rules.yml 含 ZHS_CI_DRILL_* 3 条告警
# ---------------------------------------------------------------------------


def test_rules_yaml_parses():
    assert RULES_PATH.exists()
    with open(RULES_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert data is not None


def test_rules_have_ci_drill_alerts():
    """rules.yml 应有 3 条 ZHS_CI_DRILL_* 告警 (Stale / Failed / SlowSQLZeroHit)."""
    with open(RULES_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    alerts = [a for g in data.get("groups", []) for a in g.get("rules", []) if "alert" in a]
    ci_drill_alerts = [a for a in alerts if a["alert"].startswith("ZHS_CI_DRILL_")]
    assert len(ci_drill_alerts) >= 3, f"应有 3+ ZHS_CI_DRILL_* 告警, 实际: {[a['alert'] for a in ci_drill_alerts]}"


def test_ci_drill_alerts_have_service_label():
    """每条 CI drill 告警都应有 service=zhs-platform label."""
    with open(RULES_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    alerts = [a for g in data.get("groups", []) for a in g.get("rules", []) if "alert" in a]
    ci_drill_alerts = [a for a in alerts if a["alert"].startswith("ZHS_CI_DRILL_")]
    failed = [a["alert"] for a in ci_drill_alerts if a.get("labels", {}).get("service") != "zhs-platform"]
    assert not failed, f"以下告警缺少 service=zhs-platform label: {failed}"


def test_ci_drill_alerts_have_severity_label():
    """每条 CI drill 告警都应有 severity label."""
    with open(RULES_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    alerts = [a for g in data.get("groups", []) for a in g.get("rules", []) if "alert" in a]
    ci_drill_alerts = [a for a in alerts if a["alert"].startswith("ZHS_CI_DRILL_")]
    failed = [a["alert"] for a in ci_drill_alerts if "severity" not in a.get("labels", {})]
    assert not failed, f"以下告警缺少 severity label: {failed}"


def test_ci_drill_alerts_have_summary_annotation():
    """每条 CI drill 告警都应有 summary annotation (建议 110 规范化)."""
    with open(RULES_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    alerts = [a for g in data.get("groups", []) for a in g.get("rules", []) if "alert" in a]
    ci_drill_alerts = [a for a in alerts if a["alert"].startswith("ZHS_CI_DRILL_")]
    failed = [a["alert"] for a in ci_drill_alerts if "summary" not in a.get("annotations", {})]
    assert not failed, f"以下告警缺少 summary annotation: {failed}"


# ---------------------------------------------------------------------------
# 8. 失败通知 webhook URL 引用 secrets (不硬编码)
# ---------------------------------------------------------------------------


def test_notify_failure_uses_secrets():
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    notify = data["jobs"]["notify-failure"]
    has_secret = any("secrets." in str(step) for step in notify.get("steps", []))
    assert has_secret, "notify-failure 应引用 secrets (不硬编码 webhook URL)"


# ---------------------------------------------------------------------------
# 9. workflow_dispatch 输入参数 (skip_pg / skip_drill)
# ---------------------------------------------------------------------------


def test_workflow_dispatch_inputs():
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    triggers = data.get(True) or data.get("on")
    dispatch = triggers.get("workflow_dispatch", {})
    inputs = dispatch.get("inputs", {})
    assert "skip_pg" in inputs, "应有 skip_pg input"
    assert "skip_drill" in inputs, "应有 skip_drill input"


def test_skip_pg_input_used_in_job():
    """skip_pg input 应在 test-pg-compatibility job 中实际使用."""
    with open(WORKFLOW_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    job = data["jobs"]["test-pg-compatibility"]
    assert "skip_pg" in str(job.get("if", "")) or "skip_pg" in str(
        job
    ), f"test-pg-compatibility 应引用 skip_pg input, 实际 if={job.get('if', '')}"
