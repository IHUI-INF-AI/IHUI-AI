"""Phase 14 建议 3 测试: S3 Lifecycle 漂移 PR Bot."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

from s3_lifecycle_drift import DriftItem
from s3_lifecycle_drift_bot import (
    PR_COMMENT_MARKER,
    find_existing_comment,
    format_pr_comment,
    post_pr_comment,
)
from s3_lifecycle_drift_bot import main as bot_main

# ---------------------------------------------------------------------------
# format_pr_comment
# ---------------------------------------------------------------------------


class TestFormatPrComment:
    def test_marker_present(self):
        items = [DriftItem(rule_id="r1", action="add")]
        body = format_pr_comment(items, "test-bucket")
        assert body.startswith(PR_COMMENT_MARKER)

    def test_no_drift(self):
        body = format_pr_comment([], "test-bucket")
        assert "无漂移" in body
        assert body.startswith(PR_COMMENT_MARKER)

    def test_with_drift(self):
        items = [
            DriftItem(rule_id="r1", action="add"),
            DriftItem(rule_id="r2", action="modify", diff_fields=["Expiration"]),
        ]
        body = format_pr_comment(items, "test-bucket")
        assert "发现 2 条差异" in body
        assert "r1" in body
        assert "Expiration" in body

    def test_includes_config_path(self):
        items = [DriftItem(rule_id="r1", action="delete")]
        body = format_pr_comment(items, "test-bucket", config_path="custom/path.yml")
        assert "custom/path.yml" in body

    def test_idempotent_marker(self):
        # 多次调用, marker 始终在前
        for _ in range(3):
            body = format_pr_comment([], "b")
            assert body.startswith(PR_COMMENT_MARKER)


# ---------------------------------------------------------------------------
# GitHub API 集成 (用 mock)
# ---------------------------------------------------------------------------


class TestFindExistingComment:
    def test_no_existing_comment(self):
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps([]).encode("utf-8")
            mock_resp.__enter__ = lambda s: s
            mock_resp.__exit__ = lambda s, *a: None
            mock_urlopen.return_value = mock_resp
            result = find_existing_comment("owner/repo", 123, "token")
            assert result is None

    def test_existing_comment_found(self):
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps(
                [
                    {"id": 1, "body": "其他评论"},
                    {"id": 42, "body": f"{PR_COMMENT_MARKER}\n漂移检测"},
                ]
            ).encode("utf-8")
            mock_resp.__enter__ = lambda s: s
            mock_resp.__exit__ = lambda s, *a: None
            mock_urlopen.return_value = mock_resp
            result = find_existing_comment("owner/repo", 123, "token")
            assert result == 42

    def test_network_error_returns_none(self):
        with patch("urllib.request.urlopen", side_effect=Exception("网络错误")):
            result = find_existing_comment("owner/repo", 123, "token")
            assert result is None


class TestPostPrComment:
    def test_create_new_comment(self):
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps({"id": 99}).encode("utf-8")
            mock_resp.__enter__ = lambda s: s
            mock_resp.__exit__ = lambda s, *a: None
            mock_urlopen.return_value = mock_resp
            cid = post_pr_comment("owner/repo", 123, "body", "token")
            assert cid == 99

    def test_update_existing_comment(self):
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps({"id": 99}).encode("utf-8")
            mock_resp.__enter__ = lambda s: s
            mock_resp.__exit__ = lambda s, *a: None
            mock_urlopen.return_value = mock_resp
            cid = post_pr_comment("owner/repo", 123, "body", "token", comment_id=99)
            assert cid == 99

    def test_http_error_returns_zero(self):
        from urllib.error import HTTPError

        with patch(
            "urllib.request.urlopen",
            side_effect=HTTPError(
                url="x",
                code=403,
                msg="Forbidden",
                hdrs={},
                fp=None,
            ),
        ), patch("sys.stderr"):
            cid = post_pr_comment("owner/repo", 123, "body", "token")
            assert cid == 0


# ---------------------------------------------------------------------------
# CLI 集成
# ---------------------------------------------------------------------------


class TestCLI:
    def test_dry_run_no_drift(self, tmp_path, capsys):
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
            client.create_bucket(Bucket="cli-bkt-12345")
            from s3_lifecycle_tiering import _rule_to_api

            client.put_bucket_lifecycle_configuration(
                Bucket="cli-bkt-12345",
                LifecycleConfiguration={"Rules": [_rule_to_api({"id": "r1", "prefix": "a/", "transitions": []})]},
            )
            rc = bot_main(
                [
                    "--config",
                    str(cfg),
                    "--bucket",
                    "cli-bkt-12345",
                    "--dry-run",
                    "--no-comment",
                ]
            )
            assert rc == 0
            out = capsys.readouterr().out
            assert "无漂移" in out
            assert "PR comment 预览" in out

    def test_dry_run_with_drift_strict(self, tmp_path, capsys):
        pytest.importorskip("moto")
        import boto3
        from moto import mock_aws

        cfg = tmp_path / "lifecycle.yml"
        # YAML 含 r1, r2; 线上只有 r1
        cfg.write_text(
            "rules:\n  - id: r1\n    prefix: a/\n    transitions: []\n"
            "  - id: r2\n    prefix: b/\n    transitions: []\n",
            encoding="utf-8",
        )
        with mock_aws():
            client = boto3.client("s3", region_name="us-east-1")
            client.create_bucket(Bucket="strict-bkt-12345")
            from s3_lifecycle_tiering import _rule_to_api

            client.put_bucket_lifecycle_configuration(
                Bucket="strict-bkt-12345",
                LifecycleConfiguration={"Rules": [_rule_to_api({"id": "r1", "prefix": "a/", "transitions": []})]},
            )
            rc = bot_main(
                [
                    "--config",
                    str(cfg),
                    "--bucket",
                    "strict-bkt-12345",
                    "--dry-run",
                    "--no-comment",
                    "--strict",
                ]
            )
            assert rc == 1

    def test_no_drift_no_strict(self, tmp_path, capsys):
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
            client.create_bucket(Bucket="no-strict-12345")
            from s3_lifecycle_tiering import _rule_to_api

            client.put_bucket_lifecycle_configuration(
                Bucket="no-strict-12345",
                LifecycleConfiguration={"Rules": [_rule_to_api({"id": "r1", "prefix": "a/", "transitions": []})]},
            )
            rc = bot_main(
                [
                    "--config",
                    str(cfg),
                    "--bucket",
                    "no-strict-12345",
                    "--no-comment",
                ]
            )
            assert rc == 0

    def test_missing_config(self, tmp_path, capsys):
        rc = bot_main(
            [
                "--config",
                str(tmp_path / "missing.yml"),
                "--bucket",
                "any",
                "--no-comment",
            ]
        )
        assert rc == 2

    def test_invalid_yaml(self, tmp_path, capsys):
        pytest.importorskip("moto")
        import boto3
        from moto import mock_aws

        cfg = tmp_path / "bad.yml"
        # 缺 id 字段 → validate_rules 报错
        cfg.write_text("rules:\n  - prefix: a/\n", encoding="utf-8")
        with mock_aws():
            client = boto3.client("s3", region_name="us-east-1")
            client.create_bucket(Bucket="bad-yaml-bkt-1234")
            rc = bot_main(
                [
                    "--config",
                    str(cfg),
                    "--bucket",
                    "bad-yaml-bkt-1234",
                    "--no-comment",
                ]
            )
            assert rc == 2

    def test_pr_comment_posted(self, tmp_path, monkeypatch, capsys):
        pytest.importorskip("moto")
        import boto3
        from moto import mock_aws

        cfg = tmp_path / "lifecycle.yml"
        cfg.write_text(
            "rules:\n  - id: r1\n    prefix: a/\n    transitions: []\n",
            encoding="utf-8",
        )
        monkeypatch.setenv("GITHUB_REPOSITORY", "owner/repo")
        monkeypatch.setenv("PR_NUMBER", "42")
        monkeypatch.setenv("GITHUB_TOKEN", "secret")

        with mock_aws():
            client = boto3.client("s3", region_name="us-east-1")
            client.create_bucket(Bucket="comment-bkt-12345")
            with (
                patch("s3_lifecycle_drift_bot.find_existing_comment", return_value=None),
                patch("s3_lifecycle_drift_bot.post_pr_comment", return_value=100) as mock_post,
            ):
                rc = bot_main(
                    [
                        "--config",
                        str(cfg),
                        "--bucket",
                        "comment-bkt-12345",
                    ]
                )
                assert rc == 0
                assert mock_post.called
                # 检查位置参数
                args = mock_post.call_args.args
                assert args[0] == "owner/repo"  # repo
                assert args[1] == 42  # pr_number
                assert PR_COMMENT_MARKER in args[2]  # body
