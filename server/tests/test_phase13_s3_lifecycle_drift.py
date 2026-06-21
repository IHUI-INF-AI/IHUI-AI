"""Phase 13 建议 3 测试: S3 Lifecycle 漂移检测."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

from s3_lifecycle_drift import (
    DriftItem,
    _diff_fields,
    _normalize,
    compare,
    fetch_live_rules,
    format_human,
    format_json,
    format_markdown,
)
from s3_lifecycle_drift import main as drift_main

# ---------------------------------------------------------------------------
# _normalize
# ---------------------------------------------------------------------------


class TestNormalize:
    def test_dict_keys_sorted(self):
        out = _normalize({"b": 1, "a": 2})
        assert list(out.keys()) == ["a", "b"]

    def test_nested_dict(self):
        out = _normalize({"b": {"d": 3, "c": 4}})
        assert out == {"b": {"c": 4, "d": 3}}

    def test_list_of_tags_sorted_by_key(self):
        tags = [
            {"Key": "Project", "Value": "zhs"},
            {"Key": "Compliance", "Value": "true"},
        ]
        out = _normalize(tags)
        assert out[0]["Key"] == "Compliance"
        assert out[1]["Key"] == "Project"

    def test_list_of_transitions_sorted_by_days(self):
        ts = [
            {"Days": 30, "StorageClass": "DEEP_ARCHIVE"},
            {"Days": 1, "StorageClass": "GLACIER_IR"},
        ]
        out = _normalize(ts)
        assert out[0]["Days"] == 1
        assert out[1]["Days"] == 30

    def test_primitive_unchanged(self):
        assert _normalize(42) == 42
        assert _normalize("x") == "x"
        assert _normalize(None) is None


# ---------------------------------------------------------------------------
# _diff_fields
# ---------------------------------------------------------------------------


class TestDiffFields:
    def test_no_diff(self):
        a = {"ID": "x", "Transitions": [{"Days": 1, "StorageClass": "GLACIER"}]}
        b = {"ID": "x", "Transitions": [{"Days": 1, "StorageClass": "GLACIER"}]}
        assert _diff_fields(a, b) == []

    def test_diff_in_transitions(self):
        a = {"ID": "x", "Transitions": [{"Days": 1, "StorageClass": "GLACIER"}]}
        b = {"ID": "x", "Transitions": [{"Days": 2, "StorageClass": "GLACIER"}]}
        assert "Transitions" in _diff_fields(a, b)

    def test_diff_in_expiration(self):
        a = {"ID": "x", "Expiration": {"Days": 30}}
        b = {"ID": "x", "Expiration": {"Days": 90}}
        assert "Expiration" in _diff_fields(a, b)

    def test_diff_in_filter(self):
        a = {"ID": "x", "Filter": {"Tag": {"Key": "Tier", "Value": "cold"}}}
        b = {"ID": "x", "Filter": {"Tag": {"Key": "Tier", "Value": "hot"}}}
        assert "Filter" in _diff_fields(a, b)

    def test_status_ignored(self):
        a = {"ID": "x", "Status": "Enabled"}
        b = {"ID": "x", "Status": "Disabled"}
        assert _diff_fields(a, b) == []

    def test_extra_field(self):
        a = {"ID": "x"}
        b = {"ID": "x", "Filter": {}}
        assert "Filter" in _diff_fields(a, b)


# ---------------------------------------------------------------------------
# compare
# ---------------------------------------------------------------------------


class TestCompare:
    def test_no_drift(self):
        yaml_rules = [
            {
                "id": "r1",
                "prefix": "a/",
                "transitions": [{"days": 30, "storage_class": "GLACIER"}],
            }
        ]
        # 用 _rule_to_api 把 YAML 转 API, 再当 live 喂入
        from s3_lifecycle_tiering import _rule_to_api

        live_rules = [_rule_to_api(yaml_rules[0])]
        items = compare(yaml_rules, live_rules)
        assert items == []

    def test_add(self):
        yaml_rules = [
            {"id": "r1", "prefix": "a/", "transitions": []},
            {"id": "r2", "prefix": "b/", "transitions": []},
        ]
        from s3_lifecycle_tiering import _rule_to_api

        live_rules = [_rule_to_api(yaml_rules[0])]
        items = compare(yaml_rules, live_rules)
        assert len(items) == 1
        assert items[0].action == "add"
        assert items[0].rule_id == "r2"

    def test_delete(self):
        from s3_lifecycle_tiering import _rule_to_api

        yaml_rules = [
            {"id": "r1", "prefix": "a/", "transitions": []},
        ]
        live_rules = [
            _rule_to_api({"id": "r1", "prefix": "a/", "transitions": []}),
            _rule_to_api({"id": "r2", "prefix": "b/", "transitions": []}),
        ]
        items = compare(yaml_rules, live_rules)
        assert len(items) == 1
        assert items[0].action == "delete"
        assert items[0].rule_id == "r2"

    def test_modify(self):
        yaml_rules = [
            {"id": "r1", "prefix": "a/", "transitions": [{"days": 30, "storage_class": "GLACIER"}]},
        ]
        from s3_lifecycle_tiering import _rule_to_api

        live_rules = [
            _rule_to_api({"id": "r1", "prefix": "a/", "transitions": [{"days": 90, "storage_class": "GLACIER"}]}),
        ]
        items = compare(yaml_rules, live_rules)
        assert len(items) == 1
        assert items[0].action == "modify"
        assert items[0].rule_id == "r1"
        assert "Transitions" in items[0].diff_fields

    def test_mixed(self):
        yaml_rules = [
            {"id": "r1", "prefix": "a/", "transitions": []},  # add
            {"id": "r2", "prefix": "b/", "transitions": [{"days": 1, "storage_class": "GLACIER"}]},
            {"id": "r3", "prefix": "c/", "transitions": [{"days": 30, "storage_class": "DEEP_ARCHIVE"}]},
        ]
        from s3_lifecycle_tiering import _rule_to_api

        live_rules = [
            # r2 modify: 改 transition days
            _rule_to_api({"id": "r2", "prefix": "b/", "transitions": [{"days": 99, "storage_class": "GLACIER"}]}),
            # r3 一致
            _rule_to_api({"id": "r3", "prefix": "c/", "transitions": [{"days": 30, "storage_class": "DEEP_ARCHIVE"}]}),
            # r4 delete: 线上有, YAML 无
            _rule_to_api({"id": "r4", "prefix": "d/", "transitions": []}),
        ]
        items = compare(yaml_rules, live_rules)
        actions = {it.rule_id: it.action for it in items}
        assert actions["r1"] == "add"
        assert actions["r2"] == "modify"
        assert actions["r4"] == "delete"
        assert "r3" not in actions

    def test_sort_order(self):
        yaml_rules = [
            {"id": "z_add", "prefix": "a/", "transitions": []},
            {"id": "a_modify", "prefix": "b/", "transitions": [{"days": 1, "storage_class": "GLACIER"}]},
        ]
        from s3_lifecycle_tiering import _rule_to_api

        live_rules = [
            _rule_to_api({"id": "a_modify", "prefix": "b/", "transitions": [{"days": 99, "storage_class": "GLACIER"}]}),
            _rule_to_api({"id": "z_delete", "prefix": "c/", "transitions": []}),
        ]
        items = compare(yaml_rules, live_rules)
        # 顺序: add → modify → delete
        order = [it.action for it in items]
        assert order == ["add", "modify", "delete"]

    def test_modify_with_tag_filter(self):
        yaml_rules = [
            {
                "id": "r_tag",
                "filter": {"tags": {"Tier": "cold"}},
                "transitions": [{"days": 7, "storage_class": "GLACIER_IR"}],
            }
        ]
        from s3_lifecycle_tiering import _rule_to_api

        # live 改 Tier 值
        live_rules = [
            _rule_to_api(
                {
                    "id": "r_tag",
                    "filter": {"tags": {"Tier": "hot"}},
                    "transitions": [{"days": 7, "storage_class": "GLACIER_IR"}],
                }
            )
        ]
        items = compare(yaml_rules, live_rules)
        assert len(items) == 1
        assert items[0].action == "modify"
        assert "Filter" in items[0].diff_fields


# ---------------------------------------------------------------------------
# 输出格式
# ---------------------------------------------------------------------------


class TestFormats:
    def test_format_human_no_drift(self):
        out = format_human([])
        assert "无漂移" in out
        assert "✓" in out

    def test_format_human_with_drift(self):
        items = [
            DriftItem(rule_id="r_add", action="add"),
            DriftItem(rule_id="r_del", action="delete"),
            DriftItem(rule_id="r_mod", action="modify", diff_fields=["Transitions"]),
        ]
        out = format_human(items)
        assert "[ADD]" in out
        assert "[DELETE]" in out
        assert "[MODIFY]" in out
        assert "r_add" in out
        assert "Transitions" in out

    def test_format_json(self):
        items = [DriftItem(rule_id="r1", action="add")]
        out = format_json(items)
        data = json.loads(out)
        assert data["drift_count"] == 1
        assert data["items"][0]["rule_id"] == "r1"
        assert data["items"][0]["action"] == "add"

    def test_format_markdown_no_drift(self):
        out = format_markdown([], "test-bucket")
        assert "无漂移" in out
        assert "test-bucket" in out

    def test_format_markdown_with_drift(self):
        items = [
            DriftItem(rule_id="r1", action="add"),
            DriftItem(rule_id="r2", action="modify", diff_fields=["Expiration"]),
        ]
        out = format_markdown(items, "test-bucket")
        assert "S3 Lifecycle 漂移检测" in out
        assert "test-bucket" in out
        assert "r1" in out
        assert "ADD" in out
        assert "Expiration" in out


# ---------------------------------------------------------------------------
# fetch_live_rules (用 moto)
# ---------------------------------------------------------------------------


class TestFetchLiveRules:
    def test_no_lifecycle_returns_empty(self):
        pytest.importorskip("moto")
        import boto3
        from moto import mock_aws

        with mock_aws():
            client = boto3.client("s3", region_name="us-east-1")
            client.create_bucket(Bucket="test-empty-bkt")
            rules = fetch_live_rules(client, "test-empty-bkt")
            assert rules == []

    def test_apply_then_fetch_roundtrip(self):
        pytest.importorskip("moto")
        import boto3
        from moto import mock_aws
        from s3_lifecycle_tiering import apply_to_s3

        with mock_aws():
            client = boto3.client("s3", region_name="us-east-1")
            client.create_bucket(Bucket="test-rt-bkt")
            yaml_rules = [
                {
                    "id": "r1",
                    "prefix": "a/",
                    "transitions": [{"days": 30, "storage_class": "GLACIER"}],
                }
            ]
            # 走 apply_to_s3
            apply_to_s3(yaml_rules, "test-rt-bkt")
            live = fetch_live_rules(client, "test-rt-bkt")
            assert len(live) == 1
            assert live[0]["ID"] == "r1"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


class TestCLI:
    def test_cli_no_drift(self, tmp_path, capsys):
        pytest.importorskip("moto")
        import boto3
        from moto import mock_aws
        from s3_lifecycle_tiering import apply_to_s3

        cfg = tmp_path / "lifecycle.yml"
        cfg.write_text(
            "rules:\n  - id: r1\n    prefix: a/\n    transitions: []\n",
            encoding="utf-8",
        )
        with mock_aws():
            client = boto3.client("s3", region_name="us-east-1")
            client.create_bucket(Bucket="cli-bkt")
            apply_to_s3([{"id": "r1", "prefix": "a/", "transitions": []}], "cli-bkt")
            rc = drift_main(
                [
                    "--config",
                    str(cfg),
                    "--bucket",
                    "cli-bkt",
                ]
            )
            assert rc == 0
            out = capsys.readouterr().out
            assert "无漂移" in out

    def test_cli_with_drift_strict(self, tmp_path, capsys):
        pytest.importorskip("moto")
        import boto3
        from moto import mock_aws

        cfg = tmp_path / "lifecycle.yml"
        # YAML 有 r1 和 r2, 线上只有 r1
        cfg.write_text(
            "rules:\n  - id: r1\n    prefix: a/\n    transitions: []\n"
            "  - id: r2\n    prefix: b/\n    transitions: []\n",
            encoding="utf-8",
        )
        with mock_aws():
            client = boto3.client("s3", region_name="us-east-1")
            client.create_bucket(Bucket="strict-bkt")
            from s3_lifecycle_tiering import _rule_to_api

            client.put_bucket_lifecycle_configuration(
                Bucket="strict-bkt",
                LifecycleConfiguration={"Rules": [_rule_to_api({"id": "r1", "prefix": "a/", "transitions": []})]},
            )
            rc = drift_main(
                [
                    "--config",
                    str(cfg),
                    "--bucket",
                    "strict-bkt",
                    "--strict",
                ]
            )
            assert rc == 1

    def test_cli_json_output(self, tmp_path, capsys):
        pytest.importorskip("moto")
        import boto3
        from moto import mock_aws

        cfg = tmp_path / "lifecycle.yml"
        cfg.write_text(
            "rules:\n  - id: r1\n    prefix: a/\n    transitions: []\n",
            encoding="utf-8",
        )
        with mock_aws():
            client = boto3.client("s3", region_name="us-east-1")
            client.create_bucket(Bucket="json-bkt")
            rc = drift_main(
                [
                    "--config",
                    str(cfg),
                    "--bucket",
                    "json-bkt",
                    "--json",
                ]
            )
            assert rc == 0
            out = capsys.readouterr().out
            data = json.loads(out)
            assert "drift_count" in data
            assert "items" in data

    def test_cli_missing_config(self, tmp_path, capsys):
        rc = drift_main(
            [
                "--config",
                str(tmp_path / "missing.yml"),
                "--bucket",
                "x",
            ]
        )
        assert rc == 2

    def test_cli_markdown_output(self, tmp_path, capsys):
        pytest.importorskip("moto")
        import boto3
        from moto import mock_aws

        cfg = tmp_path / "lifecycle.yml"
        cfg.write_text(
            "rules:\n  - id: r1\n    prefix: a/\n    transitions: []\n",
            encoding="utf-8",
        )
        with mock_aws():
            client = boto3.client("s3", region_name="us-east-1")
            client.create_bucket(Bucket="md-bkt")
            rc = drift_main(
                [
                    "--config",
                    str(cfg),
                    "--bucket",
                    "md-bkt",
                    "--markdown",
                ]
            )
            assert rc == 0
            out = capsys.readouterr().out
            assert "S3 Lifecycle 漂移检测" in out
