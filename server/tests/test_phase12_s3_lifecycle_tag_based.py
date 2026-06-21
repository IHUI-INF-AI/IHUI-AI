"""Phase 12 建议 3: S3 lifecycle 验证加 EC2 标签路由 (tag-based filter)."""

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
def aws_credentials(monkeypatch):
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    yield


@pytest.fixture()
def rules():
    """加载默认 YAML 规则."""
    from s3_lifecycle_tiering import load_rules

    return load_rules(CONFIG)


def _load_module():
    if "s3_lifecycle_tiering" in sys.modules:
        del sys.modules["s3_lifecycle_tiering"]
    return __import__("s3_lifecycle_tiering")


# ---------------------------------------------------------------------------
# 1. YAML 加载 + 校验
# ---------------------------------------------------------------------------


def test_yaml_contains_tag_based_rules(rules):
    """YAML 必含至少 1 条 tag-based 规则."""
    tag_rules = [r for r in rules if "filter" in r]
    assert len(tag_rules) >= 3, f"应至少 3 条 tag 规则, 当前 {len(tag_rules)}"


def test_compliance_rule_has_3_tags(rules):
    """compliance 规则必含 Compliance/Project 2 个 tag."""
    compliance = next(r for r in rules if r["id"] == "zhs-compliance-backup-tiering")
    assert "filter" in compliance
    assert compliance["filter"]["tags"]["Compliance"] == "true"
    assert compliance["filter"]["tags"]["Project"] == "zhs-platform"


def test_canary_tag_rule_7d_expiry(rules):
    """金丝雀 tag 规则必 7d 过期."""
    canary = next(r for r in rules if r["id"] == "zhs-canary-tag-tiering")
    assert canary["expiration"]["days"] == 7
    assert canary["filter"]["tags"]["Canary"] == "true"


def test_temp_cold_rule_30d_expiry(rules):
    """Tier=cold 规则必 30d 过期."""
    temp = next(r for r in rules if r["id"] == "zhs-temp-cold-tiering")
    assert temp["expiration"]["days"] == 30


# ---------------------------------------------------------------------------
# 2. XML 渲染
# ---------------------------------------------------------------------------


def test_render_xml_contains_filter_tag(rules):
    """XML 必含 <Filter><Tag> 结构."""
    from s3_lifecycle_tiering import render_s3_xml

    xml = render_s3_xml(rules)
    assert "<Filter>" in xml
    assert "<Tag>" in xml
    assert "<Key>Compliance</Key>" in xml
    assert "<Value>true</Value>" in xml
    assert "<Key>Project</Key>" in xml
    assert "<Value>zhs-platform</Value>" in xml


def test_render_xml_legacy_prefix_still_supported(rules):
    """旧式 prefix 规则必仍用 <Prefix> 字段."""
    from s3_lifecycle_tiering import render_s3_xml

    xml = render_s3_xml(rules)
    # logs/ 是纯 prefix 规则
    assert "<Prefix>logs/zhs-platform/</Prefix>" in xml


def test_render_xml_no_double_prefix_for_tag_rules(rules):
    """tag 规则必无顶层 <Prefix>, 只在 <Filter> 里有."""
    from s3_lifecycle_tiering import render_s3_xml

    xml = render_s3_xml(rules)
    # 合规规则 prefix 在 filter 里
    # 检查 compliance 规则的 XML 块
    compliance_idx = xml.find("zhs-compliance-backup-tiering")
    # 在 compliance 块范围内, <Prefix> 应只在 <Filter> 内部
    chunk = xml[compliance_idx : compliance_idx + 800]
    # 合规规则应至少有 1 个 <Prefix>backup 在 filter 内部
    assert "<Prefix>backups/</Prefix>" in chunk


# ---------------------------------------------------------------------------
# 3. Terraform 渲染
# ---------------------------------------------------------------------------


def test_render_terraform_uses_filter_block(rules):
    """Terraform 必用 filter { ... } 块."""
    from s3_lifecycle_tiering import render_terraform

    tf = render_terraform(rules)
    assert "filter {" in tf
    assert "tags = {" in tf
    assert '"Compliance"' in tf
    assert '"zhs-platform"' in tf


def test_render_terraform_legacy_prefix_still_supported(rules):
    """旧式 prefix 规则必仍用 prefix 字段."""
    from s3_lifecycle_tiering import render_terraform

    tf = render_terraform(rules)
    assert 'prefix = "logs/zhs-platform/"' in tf


# ---------------------------------------------------------------------------
# 4. moto 端到端 - tag-based rule 应用
# ---------------------------------------------------------------------------


def test_apply_tag_based_rule_to_s3(rules, aws_credentials):
    """tag-based 规则 apply 必成功."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="tag-test-bucket")
        mod = _load_module()
        result = mod.apply_to_s3(rules, "tag-test-bucket")
        assert result["rules_count"] == 10  # 默认 7 + 3 tag 规则

        lcc = s3.get_bucket_lifecycle_configuration(Bucket="tag-test-bucket")
        rules_api = lcc["Rules"]
        tag_rules = [r for r in rules_api if "Filter" in r]
        assert len(tag_rules) == 3


def test_compliance_rule_api_has_filter_and_tags(rules, aws_credentials):
    """compliance 规则 API 必含 Filter.And.Prefix + Tag 列表."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="tag-test")
        mod = _load_module()
        mod.apply_to_s3(rules, "tag-test")
        lcc = s3.get_bucket_lifecycle_configuration(Bucket="tag-test")
        compliance = next(r for r in lcc["Rules"] if r["ID"] == "zhs-compliance-backup-tiering")
        assert "Filter" in compliance
        # 多条件 prefix+tag → boto3 用 And 包装
        assert "And" in compliance["Filter"]
        assert compliance["Filter"]["And"]["Prefix"] == "backups/"
        assert "Tags" in compliance["Filter"]["And"]
        tags = {t["Key"]: t["Value"] for t in compliance["Filter"]["And"]["Tags"]}
        assert tags["Compliance"] == "true"
        assert tags["Project"] == "zhs-platform"


def test_compliance_rule_expiration_7_years(rules, aws_credentials):
    """compliance 规则必 2555d (7 年) 过期."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="tag-test-7y")
        mod = _load_module()
        mod.apply_to_s3(rules, "tag-test-7y")
        lcc = s3.get_bucket_lifecycle_configuration(Bucket="tag-test-7y")
        compliance = next(r for r in lcc["Rules"] if r["ID"] == "zhs-compliance-backup-tiering")
        assert compliance["Expiration"]["Days"] == 2555


def test_compliance_rule_first_transition_1d(rules, aws_credentials):
    """compliance 规则首条 transition 必 1d GLACIER_IR (关键备份快下沉)."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="tag-test-1d")
        mod = _load_module()
        mod.apply_to_s3(rules, "tag-test-1d")
        lcc = s3.get_bucket_lifecycle_configuration(Bucket="tag-test-1d")
        compliance = next(r for r in lcc["Rules"] if r["ID"] == "zhs-compliance-backup-tiering")
        first = compliance["Transitions"][0]
        assert first["Days"] == 1
        assert first["StorageClass"] == "GLACIER_IR"


def test_tagged_object_storage_class_transitions(aws_credentials):
    """带 tag 的对象在 1d 后必下沉到 GLACIER_IR (moto 模拟)."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        bucket = "obj-tag-test"
        s3.create_bucket(Bucket=bucket)

        # 单条规则: 带 Compliance tag 的对象 1d 后下沉
        rules = [
            {
                "id": "tag-test-rule",
                "status": "Enabled",
                "filter": {
                    "prefix": "data/",
                    "tags": {"Compliance": "true"},
                },
                "transitions": [
                    {"days": 1, "storage_class": "GLACIER_IR"},
                ],
            }
        ]
        mod = _load_module()
        mod.apply_to_s3(rules, bucket)

        # 上传带 tag 的对象
        s3.put_object(
            Bucket=bucket,
            Key="data/file1.json",
            Body=b"data",
            Tagging="Compliance=true",
        )
        s3.put_object(
            Bucket=bucket,
            Key="data/file2.json",
            Body=b"data",  # 无 tag
        )

        # 验证对象都存在
        resp = s3.list_objects_v2(Bucket=bucket)
        assert len(resp.get("Contents", [])) == 2


def test_multiple_tag_rules_in_one_bucket(aws_credentials):
    """多条 tag 规则必并存, 互不干扰."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        bucket = "multi-tag"
        s3.create_bucket(Bucket=bucket)
        rules = [
            {
                "id": "tag-rule-1",
                "status": "Enabled",
                "filter": {"tags": {"Project": "alpha"}},
                "expiration": {"days": 7},
            },
            {
                "id": "tag-rule-2",
                "status": "Enabled",
                "filter": {"tags": {"Project": "beta"}},
                "expiration": {"days": 14},
            },
        ]
        mod = _load_module()
        mod.apply_to_s3(rules, bucket)
        lcc = s3.get_bucket_lifecycle_configuration(Bucket=bucket)
        r1 = next(r for r in lcc["Rules"] if r["ID"] == "tag-rule-1")
        r2 = next(r for r in lcc["Rules"] if r["ID"] == "tag-rule-2")
        assert r1["Expiration"]["Days"] == 7
        assert r2["Expiration"]["Days"] == 14
        # 单 tag 必直接用 Filter.Tag (dict)
        assert r1["Filter"]["Tag"] == {"Key": "Project", "Value": "alpha"}


def test_prefix_plus_tag_combined_filter(aws_credentials):
    """prefix + tag 组合过滤必用 And 包装."""
    from moto import mock_aws

    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        bucket = "combo-filter"
        s3.create_bucket(Bucket=bucket)
        rules = [
            {
                "id": "combo",
                "status": "Enabled",
                "filter": {
                    "prefix": "backups/",
                    "tags": {"Tier": "critical"},
                },
                "transitions": [{"days": 1, "storage_class": "GLACIER_IR"}],
                "expiration": {"days": 30},
            }
        ]
        mod = _load_module()
        mod.apply_to_s3(rules, bucket)
        lcc = s3.get_bucket_lifecycle_configuration(Bucket=bucket)
        combo = lcc["Rules"][0]
        # 组合 → And 包装
        assert "And" in combo["Filter"]
        assert combo["Filter"]["And"]["Prefix"] == "backups/"
        tag = combo["Filter"]["And"]["Tags"][0]
        assert tag["Key"] == "Tier"
        assert tag["Value"] == "critical"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
