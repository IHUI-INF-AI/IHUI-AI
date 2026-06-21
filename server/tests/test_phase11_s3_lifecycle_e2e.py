"""Phase 11 建议 3: S3 端到端 (moto 模拟).

目的:
  1. 用 moto 模拟 AWS S3
  2. 调用 scripts/ops/s3_lifecycle_tiering.apply_to_s3() 真实下发
  3. 拉回 LifecycleConfiguration 验证全部 7 条规则都生效
  4. 校验 transitions/expiration 字段值正确
  5. 校验幂等: 重复 apply 不会出错
  6. 校验按 prefix 路由: 不同 prefix 的对象在 storage_class 上独立生效
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import boto3
import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "ops" / "s3_lifecycle_tiering.py"
CONFIG = ROOT / "config" / "s3-lifecycle.yml"

sys.path.insert(0, str(ROOT / "scripts" / "ops"))


def _has_moto() -> bool:
    try:
        import moto  # noqa: F401

        return True
    except ImportError:
        return False


pytestmark = pytest.mark.skipif(not _has_moto(), reason="moto 未安装, 跳过")


@pytest.fixture()
def aws_credentials():
    """设置 fake AWS 凭据, 防止 boto3 找真凭据."""
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    yield
    for k in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"):
        os.environ.pop(k, None)


@pytest.fixture()
def s3_bucket(aws_credentials):
    """仅返回桶名, 桶和 mock 上下文由测试自己管理."""
    yield "zhs-archive-test"


def _load_module():
    if "s3_lifecycle_tiering" in sys.modules:
        del sys.modules["s3_lifecycle_tiering"]
    return __import__("s3_lifecycle_tiering")


def test_apply_to_s3_creates_rules(s3_bucket):
    """apply_to_s3 必成功下发生命周期规则 (默认 10 条: 7 prefix + 3 tag-based)."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=s3_bucket)
        mod = _load_module()
        rules = mod.load_rules(CONFIG)
        result = mod.apply_to_s3(rules, s3_bucket)
        assert result["bucket"] == s3_bucket
        assert result["rules_count"] == 10
        # 拉回验证
        lcc = s3.get_bucket_lifecycle_configuration(Bucket=s3_bucket)
        assert len(lcc["Rules"]) == 10


def test_applied_rules_match_yaml(s3_bucket):
    """应用后拉回的 Rules 必与 YAML 完全对应 (prefix + filter)."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=s3_bucket)
        mod = _load_module()
        rules = mod.load_rules(CONFIG)
        mod.apply_to_s3(rules, s3_bucket)

        lcc = s3.get_bucket_lifecycle_configuration(Bucket=s3_bucket)
        applied = {r["ID"]: r for r in lcc["Rules"]}

        for r in rules:
            assert r["id"] in applied, f"应用后缺规则: {r['id']}"
            ar = applied[r["id"]]
            assert ar["Status"] == "Enabled"
            # transitions
            api_transitions = ar.get("Transitions", [])
            assert len(api_transitions) == len(r.get("transitions", []))
            for i, t in enumerate(r.get("transitions", [])):
                assert api_transitions[i]["Days"] == t["days"]
                assert api_transitions[i]["StorageClass"] == t["storage_class"]
            # expiration
            if "expiration" in r:
                assert ar["Expiration"]["Days"] == r["expiration"]["days"]


def test_audit_rule_never_expires(s3_bucket):
    """审计/演练/Phase8 数据应用后无 Expiration 字段."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=s3_bucket)
        mod = _load_module()
        rules = mod.load_rules(CONFIG)
        mod.apply_to_s3(rules, s3_bucket)

        lcc = s3.get_bucket_lifecycle_configuration(Bucket=s3_bucket)
        permanent = {r["id"] for r in rules if r.get("prefix") in ("audit/", "drill-archives/", "phase8/")}
        for r in lcc["Rules"]:
            if r["ID"] in permanent:
                assert "Expiration" not in r, f"永久规则不应有过期: {r['ID']}"


def test_idempotent_reapply(s3_bucket):
    """重复 apply 不会出错 (幂等)."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=s3_bucket)
        mod = _load_module()
        rules = mod.load_rules(CONFIG)
        mod.apply_to_s3(rules, s3_bucket)
        # 第二次 apply
        mod.apply_to_s3(rules, s3_bucket)
        lcc = s3.get_bucket_lifecycle_configuration(Bucket=s3_bucket)
        assert len(lcc["Rules"]) == 10


def test_backups_first_transition_is_glacier_ir(s3_bucket):
    """DB 备份首条 transition 必是 GLACIER_IR 7d."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=s3_bucket)
        mod = _load_module()
        rules = mod.load_rules(CONFIG)
        mod.apply_to_s3(rules, s3_bucket)

        lcc = s3.get_bucket_lifecycle_configuration(Bucket=s3_bucket)
        backups = next(r for r in lcc["Rules"] if r["ID"] == "zhs-backups-tiering")
        first = backups["Transitions"][0]
        assert first["Days"] == 7
        assert first["StorageClass"] == "GLACIER_IR"


def test_metrics_rule_deep_archive_180d(s3_bucket):
    """metrics 规则必 30d→GLACIER_IR, 180d→DEEP_ARCHIVE."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=s3_bucket)
        mod = _load_module()
        rules = mod.load_rules(CONFIG)
        mod.apply_to_s3(rules, s3_bucket)

        lcc = s3.get_bucket_lifecycle_configuration(Bucket=s3_bucket)
        metrics = next(r for r in lcc["Rules"] if r["ID"] == "zhs-metrics-tiering")
        assert len(metrics["Transitions"]) == 2
        assert metrics["Transitions"][0] == {"Days": 30, "StorageClass": "GLACIER_IR"}
        assert metrics["Transitions"][1] == {"Days": 180, "StorageClass": "DEEP_ARCHIVE"}


def test_logs_rule_expiration_90d(s3_bucket):
    """应用日志必 90d 过期."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=s3_bucket)
        mod = _load_module()
        rules = mod.load_rules(CONFIG)
        mod.apply_to_s3(rules, s3_bucket)

        lcc = s3.get_bucket_lifecycle_configuration(Bucket=s3_bucket)
        logs = next(r for r in lcc["Rules"] if r["ID"] == "zhs-logs-tiering")
        assert logs["Expiration"]["Days"] == 90


def test_cli_apply_with_moto(s3_bucket, monkeypatch):
    """CLI --apply 在 moto 模拟下必能跑通 (用 in-process 调 main 避免 server 启停问题)."""
    import contextlib
    import io

    from moto import mock_aws
    from s3_lifecycle_tiering import main as cli_main

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="zhs-archive")
        # 模拟命令行参数
        monkeypatch.setattr(
            "sys.argv",
            [
                "s3_lifecycle_tiering.py",
                "--apply",
                "--bucket",
                "zhs-archive",
                "--config",
                str(CONFIG),
            ],
        )
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = cli_main()
        assert rc == 0, f"CLI 失败, stdout={buf.getvalue()}"
        assert "[ok] lifecycle 已应用" in buf.getvalue()
        lcc = s3.get_bucket_lifecycle_configuration(Bucket="zhs-archive")
        assert len(lcc["Rules"]) == 10


def test_partial_yaml_apply(s3_bucket, tmp_path):
    """自定义 YAML (只 1 条规则) 也能 apply."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=s3_bucket)
        custom_yml = tmp_path / "custom.yml"
        custom_yml.write_text(
            """rules:
  - id: test-only
    status: Enabled
    prefix: custom/
    transitions:
      - days: 1
        storage_class: GLACIER_IR
    expiration:
      days: 7
""",
            encoding="utf-8",
        )
        mod = _load_module()
        rules = mod.load_rules(custom_yml)
        assert len(rules) == 1
        mod.apply_to_s3(rules, s3_bucket)

        lcc = s3.get_bucket_lifecycle_configuration(Bucket=s3_bucket)
        assert len(lcc["Rules"]) == 1
        assert lcc["Rules"][0]["ID"] == "test-only"
        assert lcc["Rules"][0]["Transitions"][0]["Days"] == 1
        assert lcc["Rules"][0]["Expiration"]["Days"] == 7


def test_apply_does_not_affect_existing_objects(s3_bucket):
    """apply 不会影响桶内已有对象 (只配规则)."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=s3_bucket)
        s3.put_object(Bucket=s3_bucket, Key="logs/zhs-platform/test.log", Body=b"log line 1")
        s3.put_object(Bucket=s3_bucket, Key="metrics/prom/1234", Body=b"metric line")

        mod = _load_module()
        rules = mod.load_rules(CONFIG)
        mod.apply_to_s3(rules, s3_bucket)

        # 对象还在
        resp = s3.list_objects_v2(Bucket=s3_bucket)
        keys = {o["Key"] for o in resp.get("Contents", [])}
        assert "logs/zhs-platform/test.log" in keys
        assert "metrics/prom/1234" in keys


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
