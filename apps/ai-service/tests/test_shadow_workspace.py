# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""影子工作区四段(影子副本 / 校验 / 原子回写 / 全链回滚)的回归测试。"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from app.services import shadow_workspace
from app.services.shadow_workspace import apply_patch_set


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.mark.asyncio
async def test_dry_run_validates_without_touching_workspace(tmp_path: Path) -> None:
    (tmp_path / "a.py").write_text("x = 1\n", encoding="utf-8")
    before = (tmp_path / "a.py").read_bytes()
    result = await apply_patch_set(
        tmp_path,
        [
            {"path": "a.py", "content": "x = 2\n"},
            {"path": "pkg/b.json", "content": '{"ok": true}\n'},
        ],
        dry_run=True,
    )
    assert result["status"] == "validated"
    assert result["ok"] is True
    assert (tmp_path / "a.py").read_bytes() == before
    assert not (tmp_path / "pkg" / "b.json").exists()
    assert list((tmp_path / ".ihui-agent" / "tmp").iterdir()) == []


@pytest.mark.asyncio
async def test_apply_writes_every_patch_and_cleans_shadow(tmp_path: Path) -> None:
    (tmp_path / "a.py").write_text("x = 1\n", encoding="utf-8")
    result = await apply_patch_set(
        tmp_path,
        [
            {"path": "a.py", "content": "x = 2\n"},
            {"path": "nested/new.py", "content": "def f():\n    return 3\n"},
        ],
    )
    assert result["status"] == "applied"
    assert [item["action"] for item in result["files"]] == ["update", "create"]
    assert (tmp_path / "a.py").read_text(encoding="utf-8") == "x = 2\n"
    assert (tmp_path / "nested" / "new.py").read_text(encoding="utf-8").startswith("def f")
    assert result["shadow"]["cleaned"] is True


@pytest.mark.asyncio
async def test_python_syntax_error_fails_closed(tmp_path: Path) -> None:
    original = "x = 1\n"
    (tmp_path / "a.py").write_text(original, encoding="utf-8")
    result = await apply_patch_set(tmp_path, [{"path": "a.py", "content": "def broken(:\n"}])
    assert result["status"] == "validation_failed"
    assert result["ok"] is False
    assert result["validation"]["errors"] == 1
    assert (tmp_path / "a.py").read_text(encoding="utf-8") == original


@pytest.mark.asyncio
async def test_invalid_json_and_toml_are_reported(tmp_path: Path) -> None:
    result = await apply_patch_set(
        tmp_path,
        [
            {"path": "bad.json", "content": '{"a": '},
            {"path": "bad.toml", "content": "key = [\n"},
        ],
    )
    assert result["status"] == "validation_failed"
    assert {item["file"] for item in result["validation"]["diagnostics"]} == {"bad.json", "bad.toml"}
    assert not (tmp_path / "bad.json").exists()
    assert not (tmp_path / "bad.toml").exists()


@pytest.mark.asyncio
async def test_expected_sha_mismatch_rejects_whole_batch(tmp_path: Path) -> None:
    (tmp_path / "a.py").write_text("x = 1\n", encoding="utf-8")
    result = await apply_patch_set(
        tmp_path,
        [{"path": "a.py", "content": "x = 2\n", "expectedSha256": "0" * 64}],
    )
    assert result["status"] == "rejected"
    assert result["errorCode"] == "conflict"
    assert (tmp_path / "a.py").read_text(encoding="utf-8") == "x = 1\n"


@pytest.mark.asyncio
async def test_correct_expected_sha_is_accepted(tmp_path: Path) -> None:
    (tmp_path / "a.py").write_text("x = 1\n", encoding="utf-8")
    result = await apply_patch_set(
        tmp_path,
        [{"path": "a.py", "content": "x = 2\n", "expectedSha256": _sha(tmp_path / "a.py")}],
    )
    assert result["status"] == "applied"


@pytest.mark.asyncio
async def test_mid_write_failure_rolls_back_earlier_files(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "a.py").write_text("a = 1\n", encoding="utf-8")
    real = shadow_workspace._atomic_write
    calls = {"count": 0}

    def flaky(path: Path, content: bytes) -> None:
        calls["count"] += 1
        if calls["count"] == 2:
            raise OSError("simulated disk failure")
        real(path, content)

    monkeypatch.setattr(shadow_workspace, "_atomic_write", flaky)
    result = await apply_patch_set(
        tmp_path,
        [
            {"path": "a.py", "content": "a = 2\n"},
            {"path": "b.py", "content": "b = 2\n"},
        ],
    )
    assert result["status"] == "rolled_back"
    assert result["ok"] is False
    assert result["rolledBack"] == ["a.py"]
    assert (tmp_path / "a.py").read_text(encoding="utf-8") == "a = 1\n"
    assert not (tmp_path / "b.py").exists()
    assert "rollbackFailed" not in result


@pytest.mark.asyncio
async def test_custom_validator_can_block_before_any_real_write(tmp_path: Path) -> None:
    seen: list[tuple[str, str]] = []

    async def deny(shadow: Path, rels: tuple[str, ...]) -> list[dict[str, object]]:
        for rel in rels:
            seen.append((rel, (shadow / rel).read_text(encoding="utf-8")))
        return [{"file": "a.py", "severity": "Error", "message": "language-service says no"}]

    result = await apply_patch_set(
        tmp_path,
        [{"path": "a.py", "content": "x = 3\n"}],
        validator=deny,
    )
    assert result["status"] == "validation_failed"
    assert result["validation"]["engine"] == "custom"
    assert seen == [("a.py", "x = 3\n")]
    assert not (tmp_path / "a.py").exists()


@pytest.mark.asyncio
async def test_rejects_outside_duplicate_and_non_utf8_targets(tmp_path: Path) -> None:
    (tmp_path / "bin.dat").write_bytes(b"\xff\xfe\x00")
    outside = await apply_patch_set(tmp_path, [{"path": "../escape.py", "content": "x = 1\n"}])
    assert outside["errorCode"] == "invalid_path"

    duplicate = await apply_patch_set(
        tmp_path,
        [{"path": "a.py", "content": "x = 1\n"}, {"path": "./a.py", "content": "x = 2\n"}],
    )
    assert duplicate["errorCode"] == "duplicate_path"

    binary = await apply_patch_set(tmp_path, [{"path": "bin.dat", "content": "text"}])
    assert binary["errorCode"] == "non_utf8_target"


@pytest.mark.asyncio
async def test_rejects_symlink_target_when_supported(tmp_path: Path) -> None:
    real = tmp_path / "real.py"
    real.write_text("x = 1\n", encoding="utf-8")
    link = tmp_path / "link.py"
    try:
        link.symlink_to(real)
    except OSError as exc:
        pytest.skip(f"symlink unsupported: {exc}")
    result = await apply_patch_set(tmp_path, [{"path": "link.py", "content": "x = 2\n"}])
    assert result["errorCode"] == "symlink_target"
    assert real.read_text(encoding="utf-8") == "x = 1\n"


@pytest.mark.asyncio
async def test_validator_crash_is_validation_failed_not_a_silent_pass(tmp_path: Path) -> None:
    async def boom(_shadow: Path, _rels: tuple[str, ...]) -> list[dict[str, object]]:
        raise RuntimeError("validator exploded")

    result = await apply_patch_set(
        tmp_path,
        [{"path": "a.py", "content": "x = 1\n"}],
        validator=boom,
    )
    assert result["status"] == "validation_failed"
    assert result["errorCode"] == "validator_error"
    assert not (tmp_path / "a.py").exists()


@pytest.mark.asyncio
async def test_limits_are_enforced_before_shadow_copy(tmp_path: Path) -> None:
    too_many = [{"path": f"f{i}.py", "content": "x = 1\n"} for i in range(65)]
    result = await apply_patch_set(tmp_path, too_many)
    assert result["errorCode"] == "too_many_files"

    too_big = await apply_patch_set(tmp_path, [{"path": "big.py", "content": "x" * 2_000_001}])
    assert too_big["errorCode"] == "too_large"


@pytest.mark.asyncio
async def test_manifest_reports_stable_json_shape(tmp_path: Path) -> None:
    result = await apply_patch_set(tmp_path, [{"path": "a.json", "content": json.dumps({"a": 1})}])
    assert set(result) >= {"ok", "status", "files", "validation", "shadow"}
    json.dumps(result)  # 必须可被 MCP 序列化,不允许出现 Path 对象
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
