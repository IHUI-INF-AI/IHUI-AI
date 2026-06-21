"""Phase 17 建议 4 测试: S3 跨桶生命周期合规检查 v5."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

try:
    from s3_lifecycle_compliance import (
        DEFAULT_RULES,
        BucketConfig,
        ComplianceChecker,
        ComplianceReporter,
        ComplianceRule,
        Finding,
        Severity,
        _demo_configs,
        main,
    )

    HAS_MODULE = True
except Exception:  # pragma: no cover
    HAS_MODULE = False


pytestmark = pytest.mark.skipif(not HAS_MODULE, reason="module not importable")


# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------


def _last_json(text: str):
    """从含多 JSON 块的输出中提取最后一个 JSON 对象."""
    text = text.strip()
    candidates: list[str] = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch not in "{[":
            i += 1
            continue
        open_ch = ch
        close_ch = "}" if ch == "{" else "]"
        depth = 0
        in_str = False
        escape = False
        for j in range(i, len(text)):
            c = text[j]
            if escape:
                escape = False
                continue
            if c == "\\":
                escape = True
                continue
            if in_str:
                if c == '"':
                    in_str = False
                continue
            if c == '"':
                in_str = True
                continue
            if c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    candidate = text[i : j + 1]
                    try:
                        json.loads(candidate)
                        candidates.append(candidate)
                    except json.JSONDecodeError:
                        pass
                    i = j + 1
                    break
        else:
            i += 1
    return json.loads(candidates[-1])


# ---------------------------------------------------------------------------
# 1. 枚举 / 数据类
# ---------------------------------------------------------------------------


def test_severity_values():
    assert Severity.CRITICAL.value == "critical"
    assert Severity.HIGH.value == "high"
    assert Severity.MEDIUM.value == "medium"
    assert Severity.LOW.value == "low"


def test_finding_init():
    f = Finding(bucket="b1", rule_id="r1", rule_name="n1", severity=Severity.HIGH, message="m")
    assert f.bucket == "b1"
    assert f.severity == Severity.HIGH
    assert f.recommendation == ""


def test_finding_to_dict():
    f = Finding(bucket="b1", rule_id="r1", rule_name="n1", severity=Severity.HIGH, message="m")
    d = f.to_dict()
    assert d["severity"] == "high"
    assert d["bucket"] == "b1"


def test_bucket_config_defaults():
    cfg = BucketConfig(bucket="b1")
    pab = cfg.public_access_block
    assert pab["BlockPublicAcls"] is True
    assert cfg.encryption is None
    assert cfg.lifecycle_rules == []
    assert cfg.versioning is False
    assert cfg.tags == {}


# ---------------------------------------------------------------------------
# 2. 规则
# ---------------------------------------------------------------------------


def test_rule_public_acl_violation():
    cfg = BucketConfig(bucket="b1", has_public_policy=True)
    f = ComplianceChecker().check_one(cfg)
    ids = [x.rule_id for x in f]
    assert "public-access" in ids


def test_rule_public_acl_clean():
    cfg = BucketConfig(bucket="b1", encryption="AES256")
    cfg.public_access_block = dict.fromkeys(["BlockPublicAcls", "BlockPublicPolicy", "IgnorePublicAcls", "RestrictPublicBuckets"], True)
    cfg.has_public_policy = False
    f = ComplianceChecker().check_one(cfg)
    ids = [x.rule_id for x in f]
    assert "public-access" not in ids


def test_rule_no_encryption():
    cfg = BucketConfig(bucket="b1", encryption=None)
    f = ComplianceChecker().check_one(cfg)
    assert any(x.rule_id == "no-encryption" for x in f)


def test_rule_no_lifecycle():
    cfg = BucketConfig(bucket="b1", encryption="AES256")
    f = ComplianceChecker().check_one(cfg)
    assert any(x.rule_id == "no-lifecycle" for x in f)


def test_rule_old_versions_no_versioning():
    """未启用 versioning 时不报错."""
    cfg = BucketConfig(bucket="b1", encryption="AES256", versioning=False)
    cfg.lifecycle_rules = [{"ID": "x"}]
    f = ComplianceChecker().check_one(cfg)
    assert not any(x.rule_id == "old-versions-accumulate" for x in f)


def test_rule_old_versions_violation():
    cfg = BucketConfig(bucket="b1", encryption="AES256", versioning=True)
    cfg.lifecycle_rules = [{"ID": "x"}]
    f = ComplianceChecker().check_one(cfg)
    assert any(x.rule_id == "old-versions-accumulate" for x in f)


def test_rule_old_versions_clean():
    cfg = BucketConfig(bucket="b1", encryption="AES256", versioning=True)
    cfg.lifecycle_rules = [{"ID": "x", "NoncurrentVersionExpiration": {"NoncurrentDays": 30}}]
    f = ComplianceChecker().check_one(cfg)
    assert not any(x.rule_id == "old-versions-accumulate" for x in f)


def test_rule_access_log_missing():
    cfg = BucketConfig(bucket="b1", encryption="AES256")
    f = ComplianceChecker().check_one(cfg)
    assert any(x.rule_id == "no-access-log" for x in f)


def test_rule_access_log_present():
    cfg = BucketConfig(bucket="b1", encryption="AES256", access_log_target="tgt")
    f = ComplianceChecker().check_one(cfg)
    assert not any(x.rule_id == "no-access-log" for x in f)


def test_rule_replication_only_prod():
    cfg = BucketConfig(bucket="b1", encryption="AES256", tags={"env": "dev"})
    f = ComplianceChecker().check_one(cfg)
    assert not any(x.rule_id == "no-replication" for x in f)


def test_rule_replication_prod_violation():
    cfg = BucketConfig(bucket="b1", encryption="AES256", tags={"env": "prod"})
    f = ComplianceChecker().check_one(cfg)
    assert any(x.rule_id == "no-replication" for x in f)


def test_rule_replication_prod_clean():
    cfg = BucketConfig(
        bucket="b1",
        encryption="AES256",
        tags={"env": "prod"},
        replication_enabled=True,
    )
    f = ComplianceChecker().check_one(cfg)
    assert not any(x.rule_id == "no-replication" for x in f)


def test_rule_tags_missing():
    cfg = BucketConfig(bucket="b1", encryption="AES256", tags={"a": "b"})
    f = ComplianceChecker().check_one(cfg)
    f_tags = [x for x in f if x.rule_id == "missing-tags"][0]
    assert "project" in f_tags.detail["missing"]


def test_rule_tags_complete():
    cfg = BucketConfig(
        bucket="b1",
        encryption="AES256",
        tags={"project": "zhs", "env": "prod", "owner": "platform"},
    )
    f = ComplianceChecker().check_one(cfg)
    assert not any(x.rule_id == "missing-tags" for x in f)


def test_rule_abort_multipart():
    cfg = BucketConfig(bucket="b1", encryption="AES256")
    f = ComplianceChecker().check_one(cfg)
    assert any(x.rule_id == "no-abort-multipart" for x in f)


def test_rule_abort_multipart_present():
    cfg = BucketConfig(bucket="b1", encryption="AES256")
    cfg.lifecycle_rules = [{"ID": "x", "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7}}]
    f = ComplianceChecker().check_one(cfg)
    assert not any(x.rule_id == "no-abort-multipart" for x in f)


def test_default_rules_count():
    assert len(DEFAULT_RULES) >= 7


# ---------------------------------------------------------------------------
# 3. ComplianceChecker
# ---------------------------------------------------------------------------


def test_checker_add_custom_rule():
    chk = ComplianceChecker(rules=[])

    def my_rule(cfg):
        return [Finding(bucket=cfg.bucket, rule_id="custom", rule_name="c", severity=Severity.LOW, message="custom")]

    chk.add_rule(ComplianceRule(id="custom", name="c", severity=Severity.LOW, check_fn=my_rule))
    f = chk.check_one(BucketConfig(bucket="b1"))
    assert any(x.rule_id == "custom" for x in f)


def test_checker_rule_exception():
    """规则抛异常不阻塞其它规则."""

    def bad(cfg):
        raise ValueError("boom")

    chk = ComplianceChecker()
    chk.add_rule(ComplianceRule(id="bad", name="bad", severity=Severity.LOW, check_fn=bad))
    f = chk.check_one(BucketConfig(bucket="b1", encryption="AES256"))
    ids = [x.rule_id for x in f]
    assert "bad" in ids
    # 默认规则仍跑
    assert "no-encryption" not in ids  # 配置了 AES256, 不触发
    assert "no-lifecycle" in ids  # 仍触发


def test_check_many():
    chk = ComplianceChecker()
    configs = [
        BucketConfig(bucket="b1", encryption="AES256"),
        BucketConfig(bucket="b2", encryption="AES256"),
    ]
    out = chk.check_many(configs)
    assert "b1" in out and "b2" in out
    assert len(out["b1"]) > 0


def test_summary():
    chk = ComplianceChecker()
    configs = [
        BucketConfig(
            bucket="b1",
            encryption="AES256",
            access_log_target="t",
            lifecycle_rules=[
                {
                    "ID": "x",
                    "NoncurrentVersionExpiration": {"NoncurrentDays": 30},
                    "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7},
                }
            ],
            tags={"project": "zhs", "env": "prod", "owner": "platform"},
            replication_enabled=True,
        ),
        BucketConfig(bucket="b2", encryption=None, has_public_policy=True),
    ]
    results = chk.check_many(configs)
    s = chk.summary(results)
    assert s["total_buckets"] == 2
    assert s["compliant_buckets"] == 1
    assert s["non_compliant_buckets"] == 1
    assert s["by_severity"]["critical"] >= 1
    assert s["by_severity"]["high"] >= 1


def test_summary_empty():
    chk = ComplianceChecker()
    s = chk.summary({})
    assert s["total_buckets"] == 0
    assert s["compliance_pct"] == 0.0


def test_findings_to_list_ordering():
    chk = ComplianceChecker()
    cfg = BucketConfig(
        bucket="b1",
        encryption=None,
        has_public_policy=True,
        tags={"env": "prod"},
        versioning=True,
    )
    out = chk.check_many([cfg])
    fl = chk.findings_to_list(out)
    assert len(fl) > 0
    # 第一个应该是 CRITICAL
    assert fl[0].severity == Severity.CRITICAL


# ---------------------------------------------------------------------------
# 4. ComplianceReporter
# ---------------------------------------------------------------------------


def test_reporter_markdown():
    chk = ComplianceChecker()
    rep = ComplianceReporter(chk)
    configs = _demo_configs()
    results = chk.check_many(configs)
    md = rep.report(configs, results)
    assert "S3 跨桶生命周期合规报表" in md
    assert "桶总数" in md
    assert "按严重度分布" in md
    assert "不合规桶" in md
    assert "zhs-public-assets" in md
    assert "zhs-prod-backup" in md


def test_reporter_json():
    chk = ComplianceChecker()
    rep = ComplianceReporter(chk)
    configs = _demo_configs()
    results = chk.check_many(configs)
    js = rep.to_json(configs, results)
    data = json.loads(js)
    assert "summary" in data
    assert "findings" in data
    assert data["summary"]["total_buckets"] == 3
    assert data["summary"]["non_compliant_buckets"] == 2


def test_reporter_priority_top20():
    chk = ComplianceChecker()
    rep = ComplianceReporter(chk)
    # 造 30 个全不合规的桶
    configs = [BucketConfig(bucket=f"b{i}", encryption=None) for i in range(30)]
    results = chk.check_many(configs)
    md = rep.report(configs, results)
    assert "修复优先级 (Top 20)" in md


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def test_cli_demo_markdown(capsys):
    rc = main(["demo"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "S3 跨桶生命周期合规报表" in out


def test_cli_demo_json(capsys):
    rc = main(["demo", "--format", "json"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["summary"]["total_buckets"] == 3
    assert len(data["findings"]) > 0


def test_cli_scan_from_file(capsys, tmp_path):
    p = tmp_path / "buckets.json"
    payload = {
        "buckets": [
            {
                "bucket": "b1",
                "encryption": "AES256",
                "public_access_block": {
                    "BlockPublicAcls": True,
                    "BlockPublicPolicy": True,
                    "IgnorePublicAcls": True,
                    "RestrictPublicBuckets": True,
                },
                "has_public_policy": False,
                "lifecycle_rules": [],
                "versioning": False,
                "replication_enabled": False,
                "access_log_target": None,
                "tags": {},
                "size_gb": 10.0,
                "objects": 100,
                "region": "us-east-1",
            },
        ]
    }
    p.write_text(json.dumps(payload), encoding="utf-8")
    rc = main(["scan", "--config", str(p), "--format", "json"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["summary"]["total_buckets"] == 1
    assert data["summary"]["compliant_buckets"] == 0
