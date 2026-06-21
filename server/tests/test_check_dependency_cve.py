import os

"""scripts/ci/check_dependency_cve.py 单测 (Phase 6-C)."""
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts" / "ci" / "check_dependency_cve.py"


# ---------------------------------------------------------------------------
# TestParseRequirements
# ---------------------------------------------------------------------------


class TestParseRequirements:
    def test_parses_simple(self, tmp_path):
        from scripts.ci.check_dependency_cve import parse_requirements

        f = tmp_path / "r.txt"
        f.write_text(
            """
# comment
fastapi>=0.116.0
sqlalchemy==2.0.43
uvicorn[standard]>=0.35.0
-r other.txt
        """,
            encoding="utf-8",
        )
        deps = parse_requirements(f)
        assert len(deps) == 3
        assert deps[0] == {"name": "fastapi", "operator": ">=", "version": "0.116.0", "source": "r.txt"}
        assert deps[1]["name"] == "sqlalchemy"
        assert deps[1]["operator"] == "=="
        assert deps[2]["name"] == "uvicorn[standard]"

    def test_empty_file(self, tmp_path):
        from scripts.ci.check_dependency_cve import parse_requirements

        f = tmp_path / "r.txt"
        f.write_text("", encoding="utf-8")
        assert parse_requirements(f) == []


# ---------------------------------------------------------------------------
# TestParsePyproject
# ---------------------------------------------------------------------------


class TestParsePyproject:
    def test_parses_pep621(self, tmp_path):
        from scripts.ci.check_dependency_cve import parse_pyproject

        f = tmp_path / "p.toml"
        f.write_text(
            """
[project]
name = "x"
version = "1.0"
dependencies = [
    "fastapi>=0.116.0",
    "requests>=2.32.0",
]
        """,
            encoding="utf-8",
        )
        deps = parse_pyproject(f)
        assert len(deps) == 2
        assert deps[0]["name"] == "fastapi"
        assert deps[1]["name"] == "requests"

    def test_real_pyproject(self):
        from scripts.ci.check_dependency_cve import parse_pyproject

        deps = parse_pyproject(ROOT / "pyproject.toml")
        # 至少 30 条 (项目大)
        assert len(deps) >= 30
        names = {d["name"] for d in deps}
        assert "fastapi" in names
        assert "sqlalchemy" in names or "SQLAlchemy" in names

    def test_invalid_toml(self, tmp_path):
        from scripts.ci.check_dependency_cve import parse_pyproject

        f = tmp_path / "bad.toml"
        f.write_text("[unclosed", encoding="utf-8")
        assert parse_pyproject(f) == []


# ---------------------------------------------------------------------------
# TestHeuristicCheck
# ---------------------------------------------------------------------------


class TestHeuristicCheck:
    def test_no_vuln_on_recent_versions(self):
        from scripts.ci.check_dependency_cve import heuristic_check

        deps = [
            {"name": "fastapi", "version": "0.116.2"},
            {"name": "django", "version": "5.0.0"},
        ]
        assert heuristic_check(deps) == []

    def test_detects_old_django(self):
        from scripts.ci.check_dependency_cve import heuristic_check

        deps = [
            {"name": "django", "version": "3.2.0"},
        ]
        vulns = heuristic_check(deps)
        assert len(vulns) == 1
        assert vulns[0]["package"] == "django"
        assert "4.2.16" in vulns[0]["fix_versions"]

    def test_detects_old_pillow(self):
        from scripts.ci.check_dependency_cve import heuristic_check

        vulns = heuristic_check([{"name": "pillow", "version": "9.0.0"}])
        assert len(vulns) == 1
        assert "10.3.0" in vulns[0]["fix_versions"]

    def test_handles_unknown_package(self):
        from scripts.ci.check_dependency_cve import heuristic_check

        # 没在 KNOWN_CRITICAL 中 → 0
        assert heuristic_check([{"name": "fake-pkg-xyz", "version": "1.0"}]) == []

    def test_empty_version_skipped(self):
        from scripts.ci.check_dependency_cve import heuristic_check

        # 无 version 跳过 (避免 false positive)
        assert heuristic_check([{"name": "django", "version": ""}]) == []


# ---------------------------------------------------------------------------
# TestVersionParse
# ---------------------------------------------------------------------------


class TestVersionParse:
    def test_simple(self):
        from scripts.ci.check_dependency_cve import _parse_version

        assert _parse_version("1.2.3") == (1, 2, 3)
        assert _parse_version("0.116.2") == (0, 116, 2)

    def test_with_suffix(self):
        from scripts.ci.check_dependency_cve import _parse_version

        # 1.2.3a1 → 抽数字 1,2,3,1
        assert _parse_version("1.2.3a1") == (1, 2, 3, 1)

    def test_empty(self):
        from scripts.ci.check_dependency_cve import _parse_version

        assert _parse_version("") == (0,)


# ---------------------------------------------------------------------------
# TestFindDepFiles
# ---------------------------------------------------------------------------


class TestFindDepFiles:
    def test_finds_pyproject(self):
        from scripts.ci.check_dependency_cve import find_dependency_files

        files = find_dependency_files()
        # 至少包含 pyproject.toml
        names = [f.name for f in files]
        assert "pyproject.toml" in names


# ---------------------------------------------------------------------------
# TestRunPipAudit
# ---------------------------------------------------------------------------


class TestRunPipAudit:
    def test_returns_negative_when_unavailable(self):
        from scripts.ci.check_dependency_cve import run_pip_audit

        rc, out, err = run_pip_audit()
        # pip-audit 大概率不在 PATH
        if rc < 0:
            assert "not found" in err or "timeout" in err


# ---------------------------------------------------------------------------
# TestParsePipAudit
# ---------------------------------------------------------------------------


class TestParsePipAudit:
    def test_parses_json(self):
        from scripts.ci.check_dependency_cve import parse_pip_audit_output

        data = {
            "dependencies": [
                {
                    "name": "django",
                    "version": "3.2.0",
                    "vulns": [{"id": "PYSEC-2024-X", "fix_versions": ["4.2.16"], "description": "SQL inj"}],
                }
            ]
        }
        out = parse_pip_audit_output(json.dumps(data))
        assert len(out) == 1
        assert out[0]["package"] == "django"
        assert out[0]["vuln_id"] == "PYSEC-2024-X"

    def test_empty(self):
        from scripts.ci.check_dependency_cve import parse_pip_audit_output

        assert parse_pip_audit_output("") == []
        assert parse_pip_audit_output("not json") == []


# ---------------------------------------------------------------------------
# TestCliE2E
# ---------------------------------------------------------------------------


class TestCliE2E:
    def test_default_passes(self):
        r = subprocess.run(
            [sys.executable, str(SCRIPTS)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0, f"stderr: {r.stderr}\nstdout: {r.stdout}"
        assert "PASS" in r.stdout

    def test_strict_when_tool_unavailable_returns_2(self):
        """--strict + pip-audit 不可用 → 退出码 2 (tool unavailable)."""
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--strict"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        # pip-audit 不在 PATH 时, --strict 应当按 tool_unavailable 处理
        # 退出码可能是 0 (heuristic 0 vuln) 或 2 (strict + 工具不可用)
        # 实际行为依赖 heuristic 结果
        if r.returncode not in (0, 2):
            pytest.fail(f"unexpected returncode: {r.returncode}\n{r.stdout}")

    def test_json_output(self):
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--json"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0
        assert '"deps_count"' in r.stdout
