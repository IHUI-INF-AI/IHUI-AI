"""Phase 13 建议 1 测试: OIDC Vault 审计 JSON → SQL 迁移工具."""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

import pytest

# 允许从仓库根导入
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts" / "ci"))

from oidc_vault_audit_migrate import (
    Migrator,
    _canonical_json,
    checksum_entries,
    load_source,
)
from oidc_vault_audit_migrate import main as migrate_main

# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_json_path(tmp_path):
    def _make(entries, fmt="array"):
        p = tmp_path / "src.json"
        if fmt == "array":
            p.write_text(json.dumps(entries, ensure_ascii=False), encoding="utf-8")
        elif fmt == "jsonl":
            p.write_text(
                "\n".join(json.dumps(e, ensure_ascii=False) for e in entries),
                encoding="utf-8",
            )
        elif fmt == "dict_entries":
            p.write_text(json.dumps({"entries": entries}, ensure_ascii=False), encoding="utf-8")
        elif fmt == "single_dict":
            p.write_text(json.dumps(entries[0], ensure_ascii=False), encoding="utf-8")
        return p

    return _make


@pytest.fixture
def sample_entries():
    return [
        {
            "ts": "2026-06-16T10:00:00+00:00",
            "github_sub": "repo:owner/x:ref:refs/heads/main",
            "provider": "grafana",
            "ttl_min": 30,
            "client_ip": "1.2.3.4",
            "action": "exchange",
        },
        {
            "ts": "2026-06-16T10:05:00+00:00",
            "github_sub": "repo:owner/y:ref:refs/heads/dev",
            "provider": "dingtalk",
            "ttl_min": 15,
            "client_ip": "5.6.7.8",
            "action": "exchange",
        },
        {
            "ts": "2026-06-16T10:10:00+00:00",
            "github_sub": "repo:owner/z:ref:refs/heads/prod",
            "provider": "alertmanager",
            "ttl_min": 60,
            "client_ip": "9.10.11.12",
            "action": "redeem",
        },
    ]


# ---------------------------------------------------------------------------
# _canonical_json
# ---------------------------------------------------------------------------


class TestCanonicalJson:
    def test_canonical_stable(self):
        e = {
            "ts": "2026-01-01",
            "github_sub": "x",
            "provider": "grafana",
            "ttl_min": 30,
            "client_ip": "1.1.1.1",
            "action": "exchange",
        }
        s1 = _canonical_json(e)
        s2 = _canonical_json(e)
        assert s1 == s2

    def test_canonical_ignores_extra_keys(self):
        e1 = {
            "ts": "2026-01-01",
            "github_sub": "x",
            "provider": "grafana",
            "ttl_min": 30,
            "client_ip": "1.1.1.1",
            "action": "exchange",
            "extra": "a",
        }
        e2 = {
            "ts": "2026-01-01",
            "github_sub": "x",
            "provider": "grafana",
            "ttl_min": 30,
            "client_ip": "1.1.1.1",
            "action": "exchange",
            "extra": "b",
        }
        assert _canonical_json(e1) == _canonical_json(e2)

    def test_canonical_ttl_min_coerced(self):
        e1 = {
            "ts": "t",
            "github_sub": "x",
            "provider": "grafana",
            "ttl_min": "30",
            "client_ip": "1.1.1.1",
            "action": "exchange",
        }
        e2 = {
            "ts": "t",
            "github_sub": "x",
            "provider": "grafana",
            "ttl_min": 30,
            "client_ip": "1.1.1.1",
            "action": "exchange",
        }
        assert _canonical_json(e1) == _canonical_json(e2)


# ---------------------------------------------------------------------------
# checksum_entries
# ---------------------------------------------------------------------------


class TestChecksum:
    def test_empty(self):
        assert len(checksum_entries([])) == 64  # SHA256 hex

    def test_stable_for_same_input(self, sample_entries):
        s1 = checksum_entries(sample_entries)
        s2 = checksum_entries(list(reversed(sample_entries)))
        # 排序后应一致
        assert s1 == s2

    def test_differs_for_diff_input(self, sample_entries):
        s1 = checksum_entries(sample_entries)
        sample_entries[0]["provider"] = "changed"
        s2 = checksum_entries(sample_entries)
        assert s1 != s2


# ---------------------------------------------------------------------------
# load_source
# ---------------------------------------------------------------------------


class TestLoadSource:
    def test_load_json_array(self, tmp_json_path, sample_entries):
        p = tmp_json_path(sample_entries, fmt="array")
        loaded = load_source(p)
        assert len(loaded) == 3
        assert loaded[0]["provider"] == "grafana"

    def test_load_jsonl(self, tmp_json_path, sample_entries):
        p = tmp_json_path(sample_entries, fmt="jsonl")
        loaded = load_source(p)
        assert len(loaded) == 3

    def test_load_dict_with_entries(self, tmp_json_path, sample_entries):
        p = tmp_json_path(sample_entries, fmt="dict_entries")
        loaded = load_source(p)
        assert len(loaded) == 3

    def test_load_single_dict(self, tmp_json_path, sample_entries):
        p = tmp_json_path([sample_entries[0]], fmt="single_dict")
        loaded = load_source(p)
        assert len(loaded) == 1
        assert loaded[0]["provider"] == "grafana"

    def test_load_empty_file(self, tmp_path):
        p = tmp_path / "empty.json"
        p.write_text("", encoding="utf-8")
        assert load_source(p) == []

    def test_load_jsonl_with_blank_lines(self, tmp_path):
        p = tmp_path / "blank.jsonl"
        p.write_text('{"ts":"t1"}\n\n{"ts":"t2"}\n', encoding="utf-8")
        assert len(load_source(p)) == 2

    def test_load_file_not_found(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_source(tmp_path / "missing.json")

    def test_load_invalid_jsonl(self, tmp_path):
        p = tmp_path / "bad.jsonl"
        p.write_text('{"ts":"t1"}\nbad json\n', encoding="utf-8")
        with pytest.raises(ValueError):
            load_source(p)


# ---------------------------------------------------------------------------
# Migrator
# ---------------------------------------------------------------------------


class TestMigrator:
    def _url(self, tmp_path, name="audit.db"):
        return f"sqlite:///{tmp_path / name}"

    def test_migrate_basic(self, tmp_path, sample_entries):
        m = Migrator(self._url(tmp_path))
        report = m.migrate(sample_entries)
        assert report["source_count"] == 3
        assert report["inserted"] == 3
        assert report["skipped"] == 0
        assert report["target_count_after"] == 3
        assert report["error"] is None
        assert report["verify_ok"] is True

    def test_migrate_dry_run_does_not_write(self, tmp_path, sample_entries):
        m = Migrator(self._url(tmp_path))
        report = m.migrate(sample_entries, dry_run=True)
        assert report["dry_run"] is True
        assert report["inserted"] == 0
        # 验证文件未被创建
        assert not (tmp_path / "audit.db").exists()

    def test_migrate_in_memory(self, sample_entries):
        m = Migrator("sqlite:///:memory:")
        report = m.migrate(sample_entries)
        assert report["inserted"] == 3
        assert report["verify_ok"] is True

    def test_migrate_resume_skips_existing(self, tmp_path, sample_entries):
        m = Migrator(self._url(tmp_path))
        r1 = m.migrate(sample_entries)
        assert r1["inserted"] == 3
        # 再次迁移, 应全部跳过
        r2 = m.migrate(sample_entries, resume=True)
        assert r2["inserted"] == 0
        assert r2["skipped"] == 3
        assert r2["verify_ok"] is True

    def test_migrate_resume_with_new_records(self, tmp_path, sample_entries):
        m = Migrator(self._url(tmp_path))
        m.migrate(sample_entries[:2])
        # 追加 1 条新 + 1 条已存在
        new_entries = sample_entries[:2] + [sample_entries[2]]
        r = m.migrate(new_entries, resume=True)
        assert r["inserted"] == 1
        assert r["skipped"] == 2

    def test_migrate_no_resume_duplicates(self, tmp_path, sample_entries):
        m = Migrator(self._url(tmp_path))
        m.migrate(sample_entries)
        # 不启用断点续传, 全部重新插入
        r = m.migrate(sample_entries, resume=False)
        assert r["inserted"] == 3
        assert r["skipped"] == 0
        assert r["target_count_after"] == 6

    def test_migrate_batch_size(self, tmp_path, sample_entries):
        # 12 条独立数据 (复制并改 ts, 避免 resume 跳过)
        entries = []
        for i in range(12):
            e = dict(sample_entries[i % 3])
            e["ts"] = f"2026-06-16T10:{i:02d}:00+00:00"
            entries.append(e)
        m = Migrator(self._url(tmp_path), batch_size=2)
        r = m.migrate(entries)
        assert r["inserted"] == 12
        assert r["verify_ok"] is True

    def test_migrate_batch_size_invalid(self):
        with pytest.raises(ValueError):
            Migrator("sqlite:///:memory:", batch_size=0)

    def test_migrate_invalid_url(self, sample_entries):
        m = Migrator("not-a-valid-url")
        r = m.migrate(sample_entries)
        assert r["error"] is not None
        assert "inserted" in r

    def test_migrate_empty_entries(self, tmp_path):
        m = Migrator(self._url(tmp_path))
        r = m.migrate([])
        assert r["source_count"] == 0
        assert r["inserted"] == 0
        assert r["verify_ok"] is True

    def test_migrate_unicode_preserved(self, tmp_path):
        entries = [
            {
                "ts": "2026-06-16T10:00:00+00:00",
                "github_sub": "repo:组织名/项目名:ref:refs/heads/main",
                "provider": "grafana",
                "ttl_min": 30,
                "client_ip": "::1",
                "action": "exchange",
            }
        ]
        m = Migrator(self._url(tmp_path))
        r = m.migrate(entries)
        assert r["inserted"] == 1
        # 用 sqlite3 直连验证 unicode
        conn = sqlite3.connect(str(tmp_path / "audit.db"))
        row = conn.execute("SELECT github_sub FROM audit_log").fetchone()
        assert row[0] == "repo:组织名/项目名:ref:refs/heads/main"
        conn.close()

    def test_migrate_idempotent_double_run(self, tmp_path, sample_entries):
        """幂等性: 多次迁移结果一致."""
        m = Migrator(self._url(tmp_path))
        m.migrate(sample_entries)
        r = m.migrate(sample_entries)
        r2 = m.migrate(sample_entries)
        assert r["inserted"] == 0
        assert r2["inserted"] == 0
        assert r["target_count_after"] == 3
        assert r2["target_count_after"] == 3

    def test_migrate_target_checksum_matches_source(self, tmp_path, sample_entries):
        m = Migrator(self._url(tmp_path))
        r = m.migrate(sample_entries)
        assert r["source_checksum"] == r["target_checksum_after"]
        assert r["verify_ok"] is True


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


class TestCLI:
    def test_cli_dry_run(self, tmp_path, sample_entries, capsys):
        src = tmp_path / "src.json"
        src.write_text(json.dumps(sample_entries, ensure_ascii=False), encoding="utf-8")
        dst = f"sqlite:///{tmp_path / 'out.db'}"
        rc = migrate_main(
            [
                "--src",
                str(src),
                "--dst",
                dst,
                "--dry-run",
            ]
        )
        assert rc == 0
        out = capsys.readouterr().out
        assert "DRY-RUN" in out
        assert "源条数: 3" in out
        # dry-run 不应创建文件
        assert not (tmp_path / "out.db").exists()

    def test_cli_real_migrate(self, tmp_path, sample_entries, capsys):
        src = tmp_path / "src.json"
        src.write_text(json.dumps(sample_entries, ensure_ascii=False), encoding="utf-8")
        dst = f"sqlite:///{tmp_path / 'out.db'}"
        rc = migrate_main(
            [
                "--src",
                str(src),
                "--dst",
                dst,
            ]
        )
        assert rc == 0
        out = capsys.readouterr().out
        assert "MIGRATE" in out
        assert "插入: 3" in out
        assert "校验通过: True" in out
        assert (tmp_path / "out.db").exists()

    def test_cli_json_output(self, tmp_path, sample_entries, capsys):
        src = tmp_path / "src.json"
        src.write_text(json.dumps(sample_entries, ensure_ascii=False), encoding="utf-8")
        dst = f"sqlite:///{tmp_path / 'out.db'}"
        rc = migrate_main(
            [
                "--src",
                str(src),
                "--dst",
                dst,
                "--json-output",
            ]
        )
        assert rc == 0
        out = capsys.readouterr().out
        # 应是合法 JSON
        report = json.loads(out)
        assert report["source_count"] == 3
        assert report["inserted"] == 3
        assert report["verify_ok"] is True

    def test_cli_missing_src(self, tmp_path, capsys):
        rc = migrate_main(
            [
                "--src",
                str(tmp_path / "missing.json"),
                "--dst",
                f"sqlite:///{tmp_path / 'out.db'}",
            ]
        )
        assert rc == 2
        err = capsys.readouterr().err
        assert "加载源文件失败" in err

    def test_cli_invalid_dst(self, tmp_path, sample_entries, capsys):
        src = tmp_path / "src.json"
        src.write_text(json.dumps(sample_entries, ensure_ascii=False), encoding="utf-8")
        rc = migrate_main(
            [
                "--src",
                str(src),
                "--dst",
                "not-a-valid-url",
            ]
        )
        assert rc == 1
        err = capsys.readouterr().err
        assert "错误" in err
