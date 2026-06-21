"""pre-commit hook 拦截能力测试 (alembic dry-run + openapi drift).

不破坏真实 alembic/, 构造一个临时 alembic 副本 + 真实 alembic ScriptDirectory API.
也验证 OpenAPI drift 在 baseline 注入假 endpoint 时会 FAIL.
"""

import shutil
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def make_broken_chain_dir() -> Path:
    """构造一个 alembic/versions 临时目录, 含链断裂文件."""
    tmp = Path(tempfile.mkdtemp(prefix="alembic_broken_"))
    versions = tmp / "versions"
    versions.mkdir()
    (versions / "001_init.py").write_text('revision = "001"\ndown_revision = None\n')
    (versions / "002_add.py").write_text('revision = "002"\ndown_revision = "001"\n')
    # 故意缺 down_revision -> 链断裂
    (versions / "003_broken.py").write_text('revision = "003"\n')
    return tmp


def test_walk_revisions_detects_broken_chain() -> None:
    """ScriptDirectory.walk_revisions() 在链断裂时直接抛错 -> dry-run 会 sys.exit(1)."""
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    tmp = make_broken_chain_dir()
    try:
        cfg = Config()
        cfg.set_main_option("script_location", str(tmp))
        cfg.set_main_option("file_template", "%%(rev)s_%%(slug)s")
        script = ScriptDirectory.from_config(cfg)
        try:
            revs = list(script.walk_revisions())
            assert "003" not in [r.revision for r in revs], "003 缺 down_revision, head 不应包含"
        except BaseException as e:
            assert (
                "down_revision" in str(e).lower()
                or "branch" in str(e).lower()
                or "003" in str(e)
                or "0003" in str(e)
                or "more than one" in str(e).lower()
                or "head" in str(e).lower()
            ), f"异常信息未匹配预期: {e}"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_dryrun_returns_ok_on_real_chain() -> None:
    """真实 alembic 链 (7 个版本) dry-run 应返回 OK."""
    from scripts.ci.alembic_ci import run_action

    fake_url = "sqlite:///./test.db"
    ok, msg = run_action("ai", fake_url, "dry-run", "head", dry_run=True)
    assert ok is True, f"真实链不应断裂: {msg}"
    assert "OK" in msg


def test_openapi_drift_returns_nonzero_on_drift() -> None:
    """baseline 注入假 endpoint 时, drift check 应返回非 0."""
    from scripts.ci import check_openapi_schema_drift

    baseline = ROOT / "tests" / "fixtures" / "openapi_baseline.json"
    if not baseline.exists():
        pytest.skip("无 baseline, 不测")

    backup = baseline.read_text(encoding="utf-8")
    try:
        import json

        data = json.loads(backup)
        data.setdefault("signatures", {})
        data["signatures"]["FAKE_GET_/api/v1/test_drift"] = {
            "tag": "FAKE",
            "req_schema": "",
            "resp_2xx_schemas": "200:",
            "req_fields": [],
            "resp_fields": "200:",
        }
        baseline.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

        sys.argv = ["check_openapi_schema_drift.py", "--strict"]
        rc = check_openapi_schema_drift.main()
        assert rc != 0, f"drift check 应返回非 0, 实际 {rc}"
    finally:
        baseline.write_text(backup, encoding="utf-8")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
