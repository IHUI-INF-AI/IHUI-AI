"""sync_observability_config.py 单测 (Phase 7).

覆盖:
  - sync() 正常同步: 覆盖目标文件
  - sync() check=True: 一致时 rc=0
  - sync() check=True: 不一致时 rc=1 + drift 详情
  - sync() check=True: 目标不存在时 rc=1
  - sync() 源缺失时 rc=2
  - _unified_diff 输出正确 diff
  - CLI 端到端: 真实仓库 (一致) rc=0
  - CLI 端到端: 制造 drift 后 rc=1
  - CLI 端到端: --diff 模式输出 unified diff
  - CLI 端到端: sync 模式修复 drift
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "ci" / "sync_observability_config.py"

sys.path.insert(0, str(ROOT / "scripts" / "ci"))
import sync_observability_config as m  # noqa: E402

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_pairs(monkeypatch, tmp_path):
    """用 tmp_path 替换 PAIRS + REPO, 不污染真实仓库."""
    src_dir = tmp_path / "docker" / "prometheus"
    src_dir.mkdir(parents=True)
    src_alert_dir = tmp_path / "docker" / "alertmanager"
    src_alert_dir.mkdir(parents=True)
    dst_dir = tmp_path / "deploy" / "helm" / "zhs-platform" / "prometheus"
    dst_dir.mkdir(parents=True)
    # dashboard 源目录 (sync() 内部从 REPO 动态构建, 需存在以避免 missing)
    (tmp_path / "deploy" / "grafana" / "dashboards").mkdir(parents=True)
    # dashboard 目标目录 (check 模式下需存在以避免 drift)
    (tmp_path / "deploy" / "helm" / "zhs-platform" / "dashboards").mkdir(parents=True)

    src_rules = src_dir / "rules.yml"
    src_am = src_alert_dir / "alertmanager.yml"
    dst_rules = dst_dir / "rules.yml"
    dst_am = dst_dir / "alertmanager.yml"

    src_rules.write_text("groups:\n  - name: x\n", encoding="utf-8")
    src_am.write_text("route: {}\n", encoding="utf-8")
    dst_rules.write_text("groups:\n  - name: x\n", encoding="utf-8")
    dst_am.write_text("route: {}\n", encoding="utf-8")

    monkeypatch.setattr(m, "REPO", tmp_path)
    monkeypatch.setattr(m, "PAIRS", [(src_rules, dst_rules), (src_am, dst_am)])
    return {
        "src_rules": src_rules,
        "src_am": src_am,
        "dst_rules": dst_rules,
        "dst_am": dst_am,
    }


# ---------------------------------------------------------------------------
# TestSyncMode
# ---------------------------------------------------------------------------


class TestSyncMode:

    def test_sync_overwrites_destination(self, fake_pairs):
        fake_pairs["dst_rules"].write_text("OLD\n", encoding="utf-8")
        rc, drifts, synced, missing = m.sync(check=False)
        assert rc == m.EXIT_OK
        assert fake_pairs["dst_rules"].read_text(encoding="utf-8") == "groups:\n  - name: x\n"
        assert any("已同步" in s for s in synced)

    def test_sync_creates_dst_dir(self, fake_pairs, tmp_path, monkeypatch):
        # 删 dst_dir
        shutil.rmtree(fake_pairs["dst_rules"].parent)
        rc, _, synced, _ = m.sync(check=False)
        assert rc == m.EXIT_OK
        assert fake_pairs["dst_rules"].exists()
        assert fake_pairs["dst_am"].exists()


# ---------------------------------------------------------------------------
# TestCheckMode
# ---------------------------------------------------------------------------


class TestCheckMode:

    def test_check_consistent_returns_zero(self, fake_pairs):
        rc, drifts, synced, missing = m.sync(check=True)
        assert rc == m.EXIT_OK
        assert drifts == []
        assert any("OK" in s for s in synced)

    def test_check_drift_returns_one(self, fake_pairs):
        # 改 dst 制造 drift
        fake_pairs["dst_rules"].write_text("DIFF\n", encoding="utf-8")
        rc, drifts, synced, missing = m.sync(check=True)
        assert rc == m.EXIT_DRIFT
        assert len(drifts) >= 1
        assert any("DRIFT" in d for d in drifts)
        # missing 应为空
        assert missing == []

    def test_check_does_not_modify_files(self, fake_pairs):
        fake_pairs["dst_rules"].write_text("DIFF\n", encoding="utf-8")
        before = fake_pairs["dst_rules"].read_text(encoding="utf-8")
        m.sync(check=True)
        after = fake_pairs["dst_rules"].read_text(encoding="utf-8")
        assert before == after, "check 模式不应修改文件"

    def test_check_dst_missing(self, fake_pairs):
        fake_pairs["dst_rules"].unlink()
        rc, drifts, _, _ = m.sync(check=True)
        assert rc == m.EXIT_DRIFT
        assert any("不存在" in d for d in drifts)

    def test_check_src_missing(self, fake_pairs):
        fake_pairs["src_rules"].unlink()
        rc, _, _, missing = m.sync(check=True)
        assert rc == m.EXIT_SOURCE_MISSING
        assert any("不存在" in m_ for m_ in missing)

    def test_check_with_diff_output(self, fake_pairs, capsys):
        fake_pairs["dst_rules"].write_text("DIFF\n", encoding="utf-8")
        rc, drifts, _, _ = m.sync(check=True, show_diff=True)
        assert rc == m.EXIT_DRIFT
        # show_diff=True 时 drift_msgs 应含 unified diff 内容
        joined = "\n".join(drifts)
        assert "---" in joined or "@@" in joined


# ---------------------------------------------------------------------------
# TestUnifiedDiff
# ---------------------------------------------------------------------------


class TestUnifiedDiff:

    def test_unified_diff_basic(self, tmp_path):
        src = tmp_path / "src.txt"
        dst = tmp_path / "dst.txt"
        src.write_text("A\nB\nC\n", encoding="utf-8")
        dst.write_text("A\nX\nC\n", encoding="utf-8")
        # _unified_diff 期望 src/dst 是 Path 并读
        m.REPO = tmp_path  # 让 relative_to 不报错 (但实际它会抛 ValueError 因为 src/dst 都在 tmp_path 下)
        diff = m._unified_diff(src, dst)
        assert "B" in diff
        assert "X" in diff


# ---------------------------------------------------------------------------
# TestExitCodes
# ---------------------------------------------------------------------------


class TestExitCodes:

    def test_exit_codes_distinct(self):
        assert m.EXIT_OK != m.EXIT_DRIFT
        assert m.EXIT_OK != m.EXIT_SOURCE_MISSING
        assert m.EXIT_DRIFT != m.EXIT_SOURCE_MISSING


# ---------------------------------------------------------------------------
# TestCliE2E
# ---------------------------------------------------------------------------


class TestCliE2E:

    def test_real_repo_check_passes(self):
        """真实仓库 P6-E 末尾已同步, --check 应 rc=0."""
        r = subprocess.run(
            [sys.executable, str(SCRIPT), "--check"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.stdout is not None, f"subprocess stdout=None, stderr={r.stderr}"
        assert r.returncode == 0, f"stderr={r.stderr}\nstdout={r.stdout}"
        assert "PASS" in r.stdout
        assert "一致" in r.stdout

    def test_real_repo_diff_mode_passes(self):
        r = subprocess.run(
            [sys.executable, str(SCRIPT), "--diff"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.stdout is not None, f"subprocess stdout=None, stderr={r.stderr}"
        assert r.returncode == 0
        # 一致时无 diff 内容
        assert "一致" in r.stdout

    def test_drift_detected_in_real_repo(self, monkeypatch):
        """临时篡改 helm 副本 (真实路径), 跑 --check 应 rc=1, 然后恢复."""
        dst = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"
        original = dst.read_text(encoding="utf-8")
        try:
            # 注入 drift: 在文件末尾追加一行
            dst.write_text(original + "\n# DRIFT_INJECTED_BY_TEST\n", encoding="utf-8")
            r = subprocess.run(
                [sys.executable, str(SCRIPT), "--check"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                encoding="utf-8",
                errors="replace",
                cwd=str(ROOT),
                timeout=30,
                env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            )
            assert r.stdout is not None, f"subprocess stdout=None, stderr={r.stderr}"
            assert r.returncode == 1, f"应捕获 drift, 实际 rc={r.returncode}"
            assert "DRIFT" in r.stdout
        finally:
            dst.write_text(original, encoding="utf-8")

    def test_diff_mode_outputs_unified_diff_in_real_repo(self, monkeypatch):
        """--diff 模式应输出含 --- / +++ 头的 unified diff."""
        dst = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"
        original = dst.read_text(encoding="utf-8")
        try:
            dst.write_text(original + "\n# DRIFT_FOR_DIFF_TEST\n", encoding="utf-8")
            r = subprocess.run(
                [sys.executable, str(SCRIPT), "--diff"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                encoding="utf-8",
                errors="replace",
                cwd=str(ROOT),
                timeout=30,
                env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            )
            assert r.stdout is not None, f"subprocess stdout=None, stderr={r.stderr}"
            assert r.returncode == 1
            assert "---" in r.stdout or "@@" in r.stdout
        finally:
            dst.write_text(original, encoding="utf-8")

    def test_sync_mode_fixes_drift(self, monkeypatch):
        """sync 模式应能修复 drift."""
        dst = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"
        original = dst.read_text(encoding="utf-8")
        try:
            dst.write_text("DRIFT\n", encoding="utf-8")
            r = subprocess.run(
                [sys.executable, str(SCRIPT)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                encoding="utf-8",
                errors="replace",
                cwd=str(ROOT),
                timeout=30,
                env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            )
            assert r.stdout is not None, f"subprocess stdout=None, stderr={r.stderr}"
            assert r.returncode == 0
            # sync 后内容应与 src 一致
            src = ROOT / "deploy" / "monitoring" / "rules.yml"
            assert dst.read_text(encoding="utf-8") == src.read_text(encoding="utf-8")
        finally:
            # 写回原内容 (虽然 sync 后应该一致了, 但双重保险)
            dst.write_text(original, encoding="utf-8")

    def test_after_sync_check_passes(self, monkeypatch):
        """sync 后 --check 应 PASS."""
        dst = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"
        original = dst.read_text(encoding="utf-8")
        try:
            dst.write_text("DRIFT\n", encoding="utf-8")
            subprocess.run(
                [sys.executable, str(SCRIPT)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=str(ROOT),
                timeout=30,
            )
            r = subprocess.run(
                [sys.executable, str(SCRIPT), "--check"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                encoding="utf-8",
                errors="replace",
                cwd=str(ROOT),
                timeout=30,
                env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            )
            assert r.stdout is not None, f"subprocess stdout=None, stderr={r.stderr}"
            assert r.returncode == 0
        finally:
            dst.write_text(original, encoding="utf-8")
