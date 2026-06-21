"""CI 慢 SQL 告警演练脚本 (建议 96) 单元测试.

覆盖:
  - argparse 参数解析 (--sleep / --engine / --table / --no-trace)
  - _simulate_slow_sql: inc 计数器并返回当前值
  - _scrape_metrics_text / _parse_metrics: prometheus 文本解析
  - _check_slow_sql_metric_visible: 正向 (含 trace) / 反向 (无此 label)
  - _validate_rules_yaml: 当前 rules.yml 合法 (返回空错误)
  - _validate_rules_yaml: 注入坏 expr (缺关键字 + 缺比较运算符) 应报错
  - 关键告警 ZHSSlowSQLWithTrace / ZHSSlowSQLBurst 存在
  - main() 正常路径退出码 0 (PASS)
  - main() --no-trace 路径退出码 0
  - main() 注入坏 rules 退出码 1 (FAIL)
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# 演练脚本是 CLI 工具, 但我们可以直接 import 其内部函数
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
import drill_slow_sql_alert as drill  # noqa: E402

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _fast_sleep(monkeypatch):
    """让 time.sleep 立即返回, 测试不需要真等."""
    monkeypatch.setattr(drill.time, "sleep", lambda *_a, **_k: None)


@pytest.fixture
def with_trace_counter_value():
    """注入一次慢 SQL (带 trace), 返回 inc 后的值."""
    return drill._simulate_slow_sql(sleep_s=0.0, engine="pytest", table="t_pytest", with_trace=True)


@pytest.fixture
def no_trace_counter_value():
    """注入一次慢 SQL (无 trace), 走 SQL_SLOW_COUNT 而不是 WITH_TRACE."""
    from app.monitoring import SQL_SLOW_COUNT

    v0 = SQL_SLOW_COUNT.labels(engine="pytest", table="t_pytest")._value.get()
    drill.time.sleep(0.0)
    SQL_SLOW_COUNT.labels(engine="pytest", table="t_pytest").inc()
    v1 = SQL_SLOW_COUNT.labels(engine="pytest", table="t_pytest")._value.get()
    return v1, v0


# ---------------------------------------------------------------------------
# _simulate_slow_sql
# ---------------------------------------------------------------------------


def test_simulate_slow_sql_increments_counter(with_trace_counter_value):
    """_simulate_slow_sql 返回 inc 后的 counter 当前值 (>0)."""
    assert with_trace_counter_value >= 1


def test_simulate_slow_sql_with_trace_false_skips_counter():
    """with_trace=False 时 SLOW_SQL_WITH_TRACE 不应增长."""
    from app.monitoring import SLOW_SQL_WITH_TRACE

    v0 = SLOW_SQL_WITH_TRACE.labels(engine="pytest", table="t_other", tenant_id="_drill_")._value.get()
    drill._simulate_slow_sql(sleep_s=0.0, engine="pytest", table="t_other", with_trace=False)
    v1 = SLOW_SQL_WITH_TRACE.labels(engine="pytest", table="t_other", tenant_id="_drill_")._value.get()
    assert v1 == v0, f"无 trace 时 WITH_TRACE 不应增长, 实际 {v0} -> {v1}"


def test_simulate_slow_sql_returns_int():
    """返回值类型为 int."""
    v = drill._simulate_slow_sql(sleep_s=0.0, engine="pytest", table="t_int")
    assert isinstance(v, int)


# ---------------------------------------------------------------------------
# _scrape_metrics_text / _parse_metrics
# ---------------------------------------------------------------------------


def test_scrape_metrics_text_returns_bytes_decoded():
    """_scrape_metrics_text 返回 str."""
    text = drill._scrape_metrics_text()
    assert isinstance(text, str)
    assert len(text) > 0


def test_parse_metrics_returns_families():
    """_parse_metrics 至少能解析一个 metric family (含默认 python_gc_*)"""
    text = drill._scrape_metrics_text()
    families = drill._parse_metrics(text)
    assert isinstance(families, list)
    names = {f.name for f in families}
    # prometheus_client 默认会注册 python_gc_*, process_*
    assert any(n.startswith("python_gc") for n in names), f"应含 python_gc_*, 实际: {names}"


# ---------------------------------------------------------------------------
# _check_slow_sql_metric_visible
# ---------------------------------------------------------------------------


def test_check_slow_sql_metric_visible_true_after_inc(with_trace_counter_value):
    """inc 后 _check_slow_sql_metric_visible 应返回 True."""
    visible = drill._check_slow_sql_metric_visible("pytest", "t_pytest")
    assert visible is True


def test_check_slow_sql_metric_visible_false_when_label_missing():
    """未 inc 的 label 组合应返回 False."""
    visible = drill._check_slow_sql_metric_visible("nonexistent_engine_xyz", "nonexistent_table_xyz")
    assert visible is False


# ---------------------------------------------------------------------------
# _validate_rules_yaml
# ---------------------------------------------------------------------------


def test_validate_rules_yaml_current_file_ok():
    """当前 docker/prometheus/rules.yml 应通过健全性检查 (返回空错误)."""
    errors = drill._validate_rules_yaml()
    assert errors == [], f"rules.yml 应合法, 实际错误: {errors}"


def test_validate_rules_yaml_detects_empty_expr(tmp_path, monkeypatch):
    """expr 为空应报错."""
    bad = tmp_path / "bad_rules.yml"
    bad.write_text(
        "groups:\n" "  - name: g\n" "    rules:\n" "      - alert: ZHSBadEmpty\n" "        expr: ''\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(drill, "RULES_PATH", bad)
    errors = drill._validate_rules_yaml()
    assert any("ZHSBadEmpty" in e and "空" in e for e in errors), f"应报空 expr, 实际: {errors}"


def test_validate_rules_yaml_detects_no_keyword_no_op(tmp_path, monkeypatch):
    """expr 既无 PromQL 关键字也无比较运算符应报错."""
    bad = tmp_path / "bad_rules2.yml"
    bad.write_text(
        "groups:\n" "  - name: g\n" "    rules:\n" "      - alert: ZHSBadJunk\n" "        expr: 'just_a_metric_name'\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(drill, "RULES_PATH", bad)
    errors = drill._validate_rules_yaml()
    assert any("ZHSBadJunk" in e and "既无" in e for e in errors), f"应报既无关键字也无运算符, 实际: {errors}"


def test_validate_rules_yaml_multiline_expr_normalized(tmp_path, monkeypatch):
    """多行 expr 折叠后能正确识别关键字 (回归测试: 之前 \n 导致漏判)."""
    good = tmp_path / "good_multiline.yml"
    good.write_text(
        "groups:\n"
        "  - name: g\n"
        "    rules:\n"
        "      - alert: ZHSMulti\n"
        "        expr: |\n"
        "          sum(rate(zhs_http_requests_total[5m]))\n"
        "            / sum(rate(zhs_http_requests_total[5m])) > 0.05\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(drill, "RULES_PATH", good)
    errors = drill._validate_rules_yaml()
    assert errors == [], f"多行 expr 应被规范化后识别, 实际错误: {errors}"


def test_validate_rules_yaml_ignores_recording_rules(tmp_path, monkeypatch):
    """没有 alert 键的 recording rule 不被检查 (无 expr 时也忽略)."""
    mixed = tmp_path / "mixed.yml"
    mixed.write_text(
        "groups:\n"
        "  - name: g\n"
        "    rules:\n"
        "      - record: zhs:http_requests:rate5m\n"
        "        expr: sum(rate(zhs_http_requests_total[5m]))\n"
        "      - alert: ZHSPlain\n"
        "        expr: zhs_ws_connections > 4000\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(drill, "RULES_PATH", mixed)
    errors = drill._validate_rules_yaml()
    assert errors == [], f"recording rule 应被跳过, 实际: {errors}"


# ---------------------------------------------------------------------------
# 关键告警存在性
# ---------------------------------------------------------------------------


def test_critical_alerts_present_in_rules():
    """ZHSSlowSQLWithTrace / ZHSSlowSQLBurst 必须在 rules.yml 中."""
    import yaml

    with open(drill.RULES_PATH, encoding="utf-8") as f:
        rules = yaml.safe_load(f)
    all_alerts = {r["alert"] for grp in rules["groups"] for r in grp["rules"] if "alert" in r}
    assert "ZHSSlowSQLWithTrace" in all_alerts, f"缺 ZHSSlowSQLWithTrace, 现有: {sorted(all_alerts)}"
    assert "ZHSSlowSQLBurst" in all_alerts, f"缺 ZHSSlowSQLBurst, 现有: {sorted(all_alerts)}"


# ---------------------------------------------------------------------------
# main() 完整路径
# ---------------------------------------------------------------------------


def test_main_normal_path_returns_zero(monkeypatch, capsys):
    """main() 默认参数 (有 trace) 应返回 0 (PASS)."""
    test_args = ["drill_slow_sql_alert.py", "--sleep", "0.0", "--engine", "main_ok", "--table", "t_ok"]
    monkeypatch.setattr(sys, "argv", test_args)
    rc = drill.main()  # 走完整 4 步
    captured = capsys.readouterr()
    assert rc == 0, f"应 PASS, 实际 rc={rc}. stdout=\n{captured.out}"
    assert "PASS" in captured.out
    assert "ZHSSlowSQLWithTrace" in captured.out or "关键告警" in captured.out


def test_main_no_trace_path_returns_zero(monkeypatch, capsys):
    """main() --no-trace 路径应返回 0 (无 trace 时 WITH_TRACE 不出现符合预期)."""
    test_args = [
        "drill_slow_sql_alert.py",
        "--sleep",
        "0.0",
        "--engine",
        "pytest_notrace",
        "--table",
        "t_pn",
        "--no-trace",
    ]
    monkeypatch.setattr(sys, "argv", test_args)
    rc = drill.main()
    captured = capsys.readouterr()
    assert rc == 0, f"--no-trace 应 PASS, 实际 rc={rc}. stdout=\n{captured.out}"
    assert "无 trace 场景下 WITH_TRACE 未出现" in captured.out


def test_main_custom_args(monkeypatch, capsys):
    """main() 自定义 --engine / --table 应被使用."""
    test_args = ["drill_slow_sql_alert.py", "--sleep", "0.0", "--engine", "myengine", "--table", "mytable"]
    monkeypatch.setattr(sys, "argv", test_args)
    rc = drill.main()
    captured = capsys.readouterr()
    assert rc == 0
    assert "myengine" in captured.out
    assert "mytable" in captured.out


def test_main_returns_one_when_metric_invisible(monkeypatch, capsys):
    """main() 当指标不可见 (mock 返回 False) 时应返回 1 (FAIL)."""
    test_args = ["drill_slow_sql_alert.py", "--sleep", "0.0", "--engine", "x", "--table", "y"]
    monkeypatch.setattr(sys, "argv", test_args)
    # 强制 _check_slow_sql_metric_visible 返回 False, 模拟 scrape 链路断裂
    monkeypatch.setattr(drill, "_check_slow_sql_metric_visible", lambda *a, **k: False)
    rc = drill.main()
    captured = capsys.readouterr()
    assert rc == 1, f"指标不可见应 FAIL, 实际 rc={rc}. stdout=\n{captured.out}"
    assert "不可见" in captured.out or "FAIL" in captured.out


def test_main_returns_one_when_rules_invalid(tmp_path, monkeypatch, capsys):
    """main() 当 rules.yml 损坏时应返回 1 (FAIL)."""
    bad = tmp_path / "bad_rules.yml"
    bad.write_text(
        "groups:\n"
        "  - name: g\n"
        "    rules:\n"
        "      - alert: ZHSJunkRule\n"
        "        expr: 'totally_not_promql'\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(drill, "RULES_PATH", bad)
    # 用 mock sys.argv, 跳过真实路径
    test_args = ["drill_slow_sql_alert.py", "--sleep", "0.0", "--engine", "x", "--table", "y"]
    monkeypatch.setattr(sys, "argv", test_args)
    rc = drill.main()
    captured = capsys.readouterr()
    assert rc == 1, f"rules 损坏应 FAIL, 实际 rc={rc}. stdout=\n{captured.out}"
    assert "ZHSJunkRule" in captured.out
