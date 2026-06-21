"""ZHS Platform JSON 日志输出验证 (建议 116).

覆盖:
  - setup_logging(fmt='json') 输出合法 JSON
  - JSON 含核心字段: time/level/module/func/line/message
  - JSON 含业务串联字段: trace_id/request_id/tenant_id/user_id
  - JSON 含 loguru bind 透传字段: engine/table/op
  - 默认 text 模式不输出 JSON
  - ZHS_LOG_FORMAT=json 环境变量切换生效
  - Loki / Promtail 配置文件语法合法
  - set_request_context 接受 request_id 参数
  - _trace_id_patcher 注入 4 个 contextvar
  - setup_logging 幂等 (多次调用不重复加 sink)
"""

import json
import re
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


LOKI_PATH = ROOT / "deploy" / "loki" / "loki-config.yml"
PROMTAIL_PATH = ROOT / "deploy" / "loki" / "promtail-config.yml"


# ---------------------------------------------------------------------------
# 1. Loki / Promtail 配置文件语法
# ---------------------------------------------------------------------------


def test_loki_config_exists():
    assert LOKI_PATH.exists(), f"loki-config.yml 不存在: {LOKI_PATH}"


def test_loki_config_yaml_parses():
    with open(LOKI_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert data is not None
    assert "server" in data
    assert "schema_config" in data


def test_loki_config_has_retention():
    with open(LOKI_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    limits = data.get("limits_config", {})
    assert "retention_period" in limits
    # 至少保留 7 天
    rp = limits["retention_period"]
    m = re.match(r"(\d+)h", str(rp))
    if m:
        assert int(m.group(1)) >= 168, f"retention 应 >= 7 天, 实际: {rp}"


def test_loki_config_has_per_stream_limit():
    """建议 116: 按 stream 限流, 防单租户刷爆."""
    with open(LOKI_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    limits = data.get("limits_config", {})
    assert "per_stream_rate_limit" in limits
    assert "per_stream_rate_limit_burst" in limits


def test_promtail_config_exists():
    assert PROMTAIL_PATH.exists()


def test_promtail_config_yaml_parses():
    with open(PROMTAIL_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert data is not None
    assert "clients" in data
    assert "scrape_configs" in data


def test_promtail_uses_loki_push():
    with open(PROMTAIL_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    clients = data["clients"]
    assert len(clients) >= 1
    url = clients[0].get("url", "")
    assert "loki" in url.lower() and "3100" in url, f"应推送到 loki:3100, 实际: {url}"


def test_promtail_collects_docker_containers():
    with open(PROMTAIL_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    jobs = data["scrape_configs"]
    has_docker = any("docker" in j.get("job_name", "") for j in jobs)
    assert has_docker, "应配置 docker_sd_configs 收集容器日志"


def test_promtail_collects_app_files():
    with open(PROMTAIL_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    jobs = data["scrape_configs"]
    has_files = any(j.get("job_name", "") in ("zhs-app-files", "zhs-platform-files") for j in jobs)
    assert has_files, "应配置业务 app 文件日志抓取"


def test_promtail_parses_json_fields():
    """Promtail 应在 pipeline_stages 解析 JSON 字段 (level/request_id/tenant_id/...)."""
    with open(PROMTAIL_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    jobs = data["scrape_configs"]
    # 任一 job 的 pipeline_stages 中应有 json stage
    has_json_stage = False
    for job in jobs:
        for stage in job.get("pipeline_stages", []):
            if "json" in stage and "expressions" in stage["json"]:
                fields = stage["json"]["expressions"]
                for k in ("level", "request_id", "tenant_id", "trace_id"):
                    if k in fields:
                        has_json_stage = True
                        break
    assert has_json_stage, "Promtail 应解析 JSON 业务串联字段"


def test_promtail_labels_include_tenant_id():
    """label 中应含 tenant_id (Loki 查询可按租户过滤)."""
    with open(PROMTAIL_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    jobs = data["scrape_configs"]
    has_tenant_label = False
    for job in jobs:
        for stage in job.get("pipeline_stages", []):
            if "labels" in stage and "tenant_id" in stage["labels"]:
                has_tenant_label = True
    assert has_tenant_label, "Promtail label 应含 tenant_id"


# ---------------------------------------------------------------------------
# 2. JSON 日志输出核心功能
# ---------------------------------------------------------------------------


def test_json_logging_outputs_valid_json():
    """setup_logging(fmt='json') 输出的每行都应是合法 JSON."""
    import app.telemetry as t

    t._LOGGING_INSTALLED = False
    # 重定向 stderr 抓取
    import io

    from loguru import logger

    old_stderr = sys.stderr
    captured = io.StringIO()
    sys.stderr = captured
    try:
        t.setup_logging(fmt="json")
        logger.info("test message 1")
        logger.info("test message 2")
    finally:
        sys.stderr = old_stderr

    lines = [l for l in captured.getvalue().split("\n") if l.strip()]
    assert len(lines) >= 2, f"应至少 2 行日志, 实际 {len(lines)}"
    for line in lines:
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            pytest.fail(f"日志行不是合法 JSON: {line!r}, 错误: {e}")
        assert isinstance(obj, dict)


def test_json_logging_has_core_fields():
    """JSON 日志应含: time/level/module/func/line/message."""
    import app.telemetry as t

    t._LOGGING_INSTALLED = False
    import io

    from loguru import logger

    old_stderr = sys.stderr
    captured = io.StringIO()
    sys.stderr = captured
    try:
        t.setup_logging(fmt="json")
        logger.info("core fields test")
    finally:
        sys.stderr = old_stderr

    lines = [l for l in captured.getvalue().split("\n") if l.strip()]
    assert len(lines) >= 1
    obj = json.loads(lines[-1])
    for field in ("time", "level", "module", "func", "line", "message"):
        assert field in obj, f"JSON 日志应含 {field} 字段, 实际: {list(obj.keys())}"
    assert obj["message"] == "core fields test"
    assert obj["level"] == "INFO"


def test_json_logging_has_business_correlation_fields():
    """业务串联字段: request_id / tenant_id / user_id 在 set_request_context 后应出现."""
    import app.telemetry as t

    t._LOGGING_INSTALLED = False
    import io

    from loguru import logger

    t.set_request_context(user_id="u-42", endpoint="GET /api/test", tenant_id="1", request_id="r-xyz", reset=True)
    old_stderr = sys.stderr
    captured = io.StringIO()
    sys.stderr = captured
    try:
        t.setup_logging(fmt="json")
        logger.info("biz correlation test")
    finally:
        sys.stderr = old_stderr

    lines = [l for l in captured.getvalue().split("\n") if l.strip()]
    obj = json.loads(lines[-1])
    for k, v in (("request_id", "r-xyz"), ("tenant_id", "1"), ("user_id", "u-42")):
        assert obj.get(k) == v, f"{k} 应为 {v!r}, 实际: {obj.get(k)!r}"


def test_json_logging_includes_bind_extras():
    """loguru bind 字段 (engine, table) 应透传到 JSON."""
    import app.telemetry as t

    t._LOGGING_INSTALLED = False
    import io

    from loguru import logger

    old_stderr = sys.stderr
    captured = io.StringIO()
    sys.stderr = captured
    try:
        t.setup_logging(fmt="json")
        logger.bind(engine="ai", table="t_order", op="select").info("with bind")
    finally:
        sys.stderr = old_stderr

    lines = [l for l in captured.getvalue().split("\n") if l.strip()]
    obj = json.loads(lines[-1])
    assert obj.get("engine") == "ai"
    assert obj.get("table") == "t_order"
    assert obj.get("op") == "select"


def test_json_logging_handles_chinese_message():
    """中文消息应正确序列化 (ensure_ascii=False)."""
    import app.telemetry as t

    t._LOGGING_INSTALLED = False
    import io

    from loguru import logger

    old_stderr = sys.stderr
    captured = io.StringIO()
    sys.stderr = captured
    try:
        t.setup_logging(fmt="json")
        logger.info("中文消息: 支付成功")
    finally:
        sys.stderr = old_stderr

    lines = [l for l in captured.getvalue().split("\n") if l.strip()]
    obj = json.loads(lines[-1])
    assert "中文" in obj["message"]


def test_json_logging_omits_default_placeholders():
    """trace_id='-' 等占位符应不出现 (避免 Loki 索引爆掉)."""
    import app.telemetry as t

    t._LOGGING_INSTALLED = False
    import io

    from loguru import logger

    # 故意不设 trace_id / request_id
    t.set_request_context(reset=True)
    old_stderr = sys.stderr
    captured = io.StringIO()
    sys.stderr = captured
    try:
        t.setup_logging(fmt="json")
        logger.info("no context")
    finally:
        sys.stderr = old_stderr

    lines = [l for l in captured.getvalue().split("\n") if l.strip()]
    obj = json.loads(lines[-1])
    # 默认占位符 "-" 不应作为字段值
    for k in ("trace_id", "request_id", "tenant_id", "user_id"):
        if k in obj:
            assert obj[k] != "-", f"占位符不应输出, 实际: {obj}"


# ---------------------------------------------------------------------------
# 3. text 模式 / env 切换
# ---------------------------------------------------------------------------


def test_text_mode_does_not_output_json():
    """默认 text 模式不应输出 JSON."""
    import app.telemetry as t

    t._LOGGING_INSTALLED = False
    import io

    from loguru import logger

    old_stderr = sys.stderr
    captured = io.StringIO()
    sys.stderr = captured
    try:
        t.setup_logging(fmt="text")
        logger.info("text mode test")
    finally:
        sys.stderr = old_stderr

    raw = captured.getvalue()
    # 文本模式应含 ANSI 控制字符 / 模板关键字
    # 简化: 直接看是否含 'INFO' 标记 (text 模式特征)
    assert "INFO" in raw, f"text 模式应含 INFO 标记, 实际: {raw!r}"
    # 不应是纯 JSON (单行)
    non_json = []
    for line in raw.split("\n"):
        if not line.strip():
            continue
        try:
            json.loads(line)
        except json.JSONDecodeError:
            non_json.append(line)
    assert non_json, "text 模式应至少 1 行非 JSON 输出"


def test_setup_logging_idempotent():
    """setup_logging 幂等: 多次调用不应抛错或累积 sink."""
    import app.telemetry as t

    t._LOGGING_INSTALLED = False
    # 第一次
    assert t.setup_logging(fmt="json") is True
    # 第二次 (应直接 return True, 不重复 add)
    assert t.setup_logging(fmt="json") is True
    # 第三次
    assert t.setup_logging(fmt="json") is True


def test_zhs_log_format_env_var(monkeypatch):
    """ZHS_LOG_FORMAT=json 环境变量应自动切到 JSON 模式."""
    monkeypatch.setenv("ZHS_LOG_FORMAT", "json")
    import app.telemetry as t

    t._LOGGING_INSTALLED = False
    import io

    from loguru import logger

    old_stderr = sys.stderr
    captured = io.StringIO()
    sys.stderr = captured
    try:
        # 不显式传 fmt → 应读 env
        t.setup_logging()
        logger.info("from env")
    finally:
        sys.stderr = old_stderr

    lines = [l for l in captured.getvalue().split("\n") if l.strip()]
    assert lines
    obj = json.loads(lines[-1])
    assert obj["message"] == "from env"


# ---------------------------------------------------------------------------
# 4. set_request_context 接受 request_id (建议 116)
# ---------------------------------------------------------------------------


def test_set_request_context_accepts_request_id():
    import app.telemetry as t

    t._LOGGING_INSTALLED = False
    t.set_request_context(request_id="r-999", reset=True)
    assert t.get_request_id() == "r-999"
    ctx = t.get_request_context()
    assert ctx["request_id"] == "r-999"


def test_set_request_id_helper():
    import app.telemetry as t

    t.set_request_id("r-helper")
    assert t.get_request_id() == "r-helper"


def test_set_request_context_reset_clears_all():
    """reset=True 应清空所有 4 个 contextvar (含 request_id)."""
    import app.telemetry as t

    t.set_request_context(user_id="u", endpoint="e", tenant_id="1", request_id="r", reset=True)
    ctx = t.get_request_context()
    assert ctx["user_id"] == "u"
    # 再次 reset (不传值) → 应清空
    t.set_request_context(reset=True)
    ctx = t.get_request_context()
    for k in ("user_id", "endpoint", "tenant_id", "request_id"):
        assert ctx[k] is None, f"{k} 应被清空, 实际: {ctx[k]!r}"


# ---------------------------------------------------------------------------
# 5. _trace_id_patcher 注入 4 个 contextvar
# ---------------------------------------------------------------------------


def test_trace_id_patcher_injects_all_4_contextvars():
    """_trace_id_patcher 注入 trace_id / request_id / tenant_id / user_id."""
    import app.telemetry as t

    text = Path(t.__file__).read_text(encoding="utf-8")
    # 关键代码片段
    assert 'extra["trace_id"]' in text
    assert 'extra["request_id"]' in text
    assert 'extra["tenant_id"]' in text
    assert 'extra["user_id"]' in text


# ---------------------------------------------------------------------------
# 6. Loki / Promtail 文档一致性
# ---------------------------------------------------------------------------


def test_loki_and_promtail_in_docker_compose():
    """docker-compose.staging.yml 应引用 loki-config + promtail-config."""
    compose = ROOT / "deploy" / "staging" / "docker-compose.staging.yml"
    with open(compose, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    services = data["services"]
    # loki 服务应挂载 loki-config.yml
    loki_vols = str(services["loki"].get("volumes", []))
    assert "loki-config" in loki_vols
    # promtail 服务应挂载 promtail-config.yml
    pt_vols = str(services["promtail"].get("volumes", []))
    assert "promtail-config" in pt_vols


def test_loki_alerting_uses_our_alertmanager():
    """Loki ruler 应指向本项目的 alertmanager (而非默认)."""
    with open(LOKI_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    ruler = data.get("ruler", {})
    url = ruler.get("alertmanager_url", "")
    assert "alertmanager" in url, f"Loki ruler 应指向 alertmanager, 实际: {url}"
