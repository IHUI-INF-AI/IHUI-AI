"""Phase 10 建议 5: 归档冷存储分级 — S3 Lifecycle 脚本验证."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "ops" / "s3_lifecycle_tiering.py"
CONFIG = ROOT / "config" / "s3-lifecycle.yml"


@pytest.fixture(scope="module")
def rules():
    """直接 import 加载规则."""
    sys.path.insert(0, str(ROOT / "scripts" / "ops"))
    from s3_lifecycle_tiering import load_rules, validate_rules

    rs = load_rules(CONFIG)
    assert not validate_rules(rs), "默认配置应校验通过"
    return rs


def test_config_exists():
    """lifecycle YAML 配置文件存在."""
    assert CONFIG.exists(), f"缺配置文件: {CONFIG}"


def test_rules_count(rules):
    """至少 7 条规则覆盖 logs/metrics/audit/canary/backups/drill/phase8."""
    assert len(rules) >= 7, f"应至少 7 条规则, 当前 {len(rules)}"


def test_all_rules_have_required_fields(rules):
    """id + (prefix 或 filter) 必填, transitions 含 days+storage_class (有 transitions 时)."""
    for r in rules:
        assert r.get("id"), f"rule 缺 id: {r}"
        has_prefix = bool(r.get("prefix"))
        has_filter = bool(r.get("filter"))
        assert has_prefix or has_filter, f"rule 缺 prefix/filter: {r['id']}"
        for t in r.get("transitions", []):
            assert t.get("days") is not None
            assert t.get("storage_class")


def test_storage_classes_are_valid(rules):
    """storage_class 必须是 S3 合法值 (有 transitions 时)."""
    valid = {"STANDARD", "GLACIER_IR", "DEEP_ARCHIVE", "GLACIER", "INTELLIGENT_TIERING"}
    for r in rules:
        for t in r.get("transitions", []):
            assert t["storage_class"] in valid, f"非法 storage_class: {t['storage_class']} (rule={r['id']})"


def test_days_monotonic_increasing(rules):
    """每个 rule 的 transitions days 必升序 (有 transitions 时)."""
    for r in rules:
        days_list = [t["days"] for t in r.get("transitions", [])]
        if days_list:
            assert days_list == sorted(days_list), f"rule[{r['id']}] days 非升序: {days_list}"


def test_rule_ids_unique(rules):
    """rule id 必唯一."""
    ids = [r["id"] for r in rules]
    assert len(ids) == len(set(ids)), f"id 重复: {ids}"


def test_validation_catches_duplicate_id():
    """validate_rules 必能捕获重复 id."""
    sys.path.insert(0, str(ROOT / "scripts" / "ops"))
    from s3_lifecycle_tiering import validate_rules

    bad = [
        {"id": "dup", "prefix": "a/", "transitions": [{"days": 30, "storage_class": "GLACIER_IR"}]},
        {"id": "dup", "prefix": "b/", "transitions": [{"days": 30, "storage_class": "GLACIER_IR"}]},
    ]
    errors = validate_rules(bad)
    assert any("重复" in e for e in errors)


def test_validation_catches_missing_prefix():
    """validate_rules 必能捕获 prefix/filter 缺失."""
    sys.path.insert(0, str(ROOT / "scripts" / "ops"))
    from s3_lifecycle_tiering import validate_rules

    bad = [{"id": "x", "transitions": [{"days": 30, "storage_class": "GLACIER_IR"}]}]
    errors = validate_rules(bad)
    assert any("prefix 或 filter" in e for e in errors)


def test_validation_catches_non_monotonic_days():
    """validate_rules 必能捕获 days 降序."""
    sys.path.insert(0, str(ROOT / "scripts" / "ops"))
    from s3_lifecycle_tiering import validate_rules

    bad = [
        {
            "id": "bad",
            "prefix": "x/",
            "transitions": [
                {"days": 100, "storage_class": "GLACIER_IR"},
                {"days": 50, "storage_class": "DEEP_ARCHIVE"},
            ],
        }
    ]
    errors = validate_rules(bad)
    assert any("升序" in e for e in errors)


def test_render_s3_xml(rules):
    """S3 XML 含所有 rule id, 含 LifecycleConfiguration 根."""
    sys.path.insert(0, str(ROOT / "scripts" / "ops"))
    from s3_lifecycle_tiering import render_s3_xml

    xml = render_s3_xml(rules)
    assert "<LifecycleConfiguration" in xml
    assert "</LifecycleConfiguration>" in xml
    for r in rules:
        assert f"<ID>{r['id']}</ID>" in xml
        # prefix-only 规则必含 <Prefix>; filter 规则必含 <Filter>
        if r.get("prefix"):
            assert f"<Prefix>{r['prefix']}</Prefix>" in xml
        if r.get("filter"):
            assert "<Filter>" in xml
    # 应含 transitions
    assert xml.count("<Transition>") >= 14
    assert "GLACIER_IR" in xml
    assert "DEEP_ARCHIVE" in xml


def test_render_terraform(rules):
    """Terraform 含 aws_s3_bucket_lifecycle_configuration + 所有 rule id."""
    sys.path.insert(0, str(ROOT / "scripts" / "ops"))
    from s3_lifecycle_tiering import render_terraform

    tf = render_terraform(rules)
    assert "aws_s3_bucket_lifecycle_configuration" in tf
    assert 'bucket = "zhs-archive"' in tf
    assert tf.count("rule {") == len(rules)
    for r in rules:
        assert f'id     = "{r["id"]}"' in tf
        # prefix-only 必含 prefix; filter 必含 filter { } 块
        if r.get("prefix"):
            assert f'prefix = "{r["prefix"]}"' in tf
        if r.get("filter"):
            assert "filter {" in tf


def test_cli_dry_run(tmp_path):
    """CLI dry-run 不报错, 退出 0."""
    env = {"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "PATH": __import__("os").environ.get("PATH", "")}
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--config", str(CONFIG)],
        capture_output=True,
        text=True,
        env=env,
        cwd=str(ROOT),
    )
    assert result.returncode == 0, f"stderr={result.stderr}"
    assert "[ok] 加载" in result.stdout
    assert "[dry-run]" in result.stdout
    assert "GLACIER_IR" in result.stdout


def test_cli_render_xml(tmp_path):
    """CLI --render-xml 写出 XML 文件."""
    out = tmp_path / "lifecycle.xml"
    env = {"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "PATH": __import__("os").environ.get("PATH", "")}
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--render-xml", "--output", str(out)],
        capture_output=True,
        text=True,
        env=env,
        cwd=str(ROOT),
    )
    assert result.returncode == 0, f"stderr={result.stderr}"
    assert out.exists()
    content = out.read_text(encoding="utf-8")
    assert "<LifecycleConfiguration" in content


def test_cli_render_tf(tmp_path):
    """CLI --render-tf 写出 Terraform 文件."""
    out = tmp_path / "lifecycle.tf"
    env = {"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "PATH": __import__("os").environ.get("PATH", "")}
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--render-tf", "--output", str(out)],
        capture_output=True,
        text=True,
        env=env,
        cwd=str(ROOT),
    )
    assert result.returncode == 0, f"stderr={result.stderr}"
    assert out.exists()
    content = out.read_text(encoding="utf-8")
    assert "aws_s3_bucket_lifecycle_configuration" in content


def test_cli_invalid_config(tmp_path):
    """CLI 加载不存在的配置文件应报错退出 1."""
    env = {"PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "PATH": __import__("os").environ.get("PATH", "")}
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--config", str(tmp_path / "nonexistent.yml")],
        capture_output=True,
        text=True,
        env=env,
        cwd=str(ROOT),
    )
    assert result.returncode == 1


def test_audit_rule_never_expires(rules):
    """审计/演练/Phase8 数据合规要求永久保存, 必无 expiration 字段 (兼容 prefix + filter)."""
    permanent_prefixes = ("audit/", "drill-archives/", "phase8/")
    for r in rules:
        # prefix 规则: 看 prefix
        if r.get("prefix") in permanent_prefixes:
            assert "expiration" not in r, f"rule[{r['id']}] 永久数据不应有 expiration: {r['prefix']}"


def test_backups_uses_glacier_ir_first(rules):
    """DB 备份 7d 内就要下沉到 GLACIER_IR (温存储), 释放标准存储空间."""
    backups = next(r for r in rules if r["prefix"] == "backups/")
    first_transition = backups["transitions"][0]
    assert first_transition["days"] <= 30
    assert first_transition["storage_class"] == "GLACIER_IR"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
