# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

r"""批次 2(2026-11-06 立)工具输出落盘分页回归。

钉住四件事(每格对应一种"凭据在场但读不回来"的失效):
 A 落盘形状:32 位小写 hex artifactId、sha256 digest、chars/bytes/preview 同口径;
 B 分页语义:offset/next 单调,最后一页 complete=true,中途恒 false;
 C 有界:单工件 2M 字符上限 + truncatedOnDisk 如实标注,超限也**不假装完整**;
 D 安全与降级:非法 id(含目录穿越)一律 unknown_artifact,读不到文件返回
   artifact_unreadable,落盘失败返回 None(调用方退回纯截断)。

隔离纪律:工件目录整个换到 tmp_path(不写仓库 `.ihui-agent`),不触网络/数据库。
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path

import pytest

from app.services import tool_output_artifacts as toa


@pytest.fixture(autouse=True)
def tmp_artifact_dir(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """把工件目录换到 tmp_path:用例之间零共享,也不污染仓库工作区。"""
    dest = tmp_path / "tool-output"
    dest.mkdir()
    monkeypatch.setattr(toa, "artifact_dir", lambda: dest)
    return dest


def test_a_spill_shape(tmp_artifact_dir: Path) -> None:
    """A 落盘凭据:artifactId/digest/preview/offset 与原文逐字可复算。"""
    text = "x" * 5000
    artifact = toa.maybe_spill_tool_output(
        text,
        tool_name="run_command",
        session_id="sess-1",
        tool_call_id="tc-1",
        keep_chars=1000,
        force=True,
    )
    assert artifact is not None
    assert toa.ARTIFACT_ID_RE.match(artifact["artifactId"])
    assert artifact["digest"] == "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()
    assert artifact["chars"] == 5000
    assert artifact["bytes"] == 5000
    assert artifact["preview"] == text[:1000]
    assert artifact["offset"] == artifact["next"] == 1000
    assert artifact["complete"] is False
    assert artifact["truncatedOnDisk"] is False
    assert artifact["toolName"] == "run_command"
    # 元数据与正文分两个文件;元数据不含 preview(原文只住 .txt)
    meta = json.loads((tmp_artifact_dir / f"{artifact['artifactId']}.json").read_text("utf-8"))
    assert "preview" not in meta
    assert meta["artifactId"] == artifact["artifactId"]


def test_b_pagination_offsets_and_complete(tmp_artifact_dir: Path) -> None:
    """B 分页:next 单调前进,最后一页 complete=true,中途始终 false。"""
    text = "abcdefghij" * 30  # 300 字符
    artifact = toa.maybe_spill_tool_output(
        text, tool_name="read_file", keep_chars=0, force=True
    )
    assert artifact is not None
    artifact_id = artifact["artifactId"]

    first = toa.read_tool_output_page(artifact_id, offset=0, limit=100)
    assert first["ok"] is True
    assert first["content"] == text[:100]
    assert first["offset"] == 0
    assert first["next"] == 100
    assert first["complete"] is False

    second = toa.read_tool_output_page(artifact_id, offset=first["next"], limit=100)
    assert second["content"] == text[100:200]
    assert second["next"] == 200
    assert second["complete"] is False

    last = toa.read_tool_output_page(artifact_id, offset=second["next"], limit=200)
    assert last["content"] == text[200:300]
    assert last["next"] == 300
    assert last["complete"] is True


def test_b2_limit_and_offset_are_clamped(tmp_artifact_dir: Path) -> None:
    """B2 越界参数不抛:负 offset 归 0,limit 截到 MAX_PAGE_CHARS。"""
    text = "z" * (toa.MAX_PAGE_CHARS + 50)
    artifact = toa.maybe_spill_tool_output(
        text, tool_name="read_file", keep_chars=0, force=True
    )
    assert artifact is not None
    page = toa.read_tool_output_page(artifact["artifactId"], offset=-5, limit=10**9)
    assert page["offset"] == 0
    assert len(page["content"]) == toa.MAX_PAGE_CHARS


def test_c_truncated_on_disk_never_reports_complete(
    tmp_artifact_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """C 超落盘上限:只存前 N 字符并标 truncatedOnDisk;读到存储末尾也不算完整。"""
    monkeypatch.setattr(toa, "MAX_STORED_CHARS", 100)
    text = "q" * 250
    artifact = toa.maybe_spill_tool_output(
        text, tool_name="run_command", keep_chars=0, force=True
    )
    assert artifact is not None
    assert artifact["storedChars"] == 100
    assert artifact["chars"] == 250
    assert artifact["truncatedOnDisk"] is True

    page = toa.read_tool_output_page(artifact["artifactId"], offset=0, limit=100)
    assert page["content"] == "q" * 100
    assert page["complete"] is False, "磁盘上被截掉的部分不能假装读到"
    assert page["truncatedOnDisk"] is True


@pytest.mark.parametrize("bad_id", ["", "not-hex", "../../etc/passwd", "A" * 32, "a" * 31])
def test_d_invalid_artifact_id_is_unknown(tmp_artifact_dir: Path, bad_id: str) -> None:
    """D 非法 id(含目录穿越/大写/长度不符)一律 unknown_artifact,不拼路径。"""
    page = toa.read_tool_output_page(bad_id)
    assert page["ok"] is False
    assert page["error"] == "unknown_artifact"


def test_d2_missing_file_is_unreadable(tmp_artifact_dir: Path) -> None:
    """D2 元数据在、正文没了 ⇒ artifact_unreadable(不冒充 unknown)。"""
    artifact = toa.maybe_spill_tool_output(
        "abc", tool_name="read_file", keep_chars=0, force=True
    )
    assert artifact is not None
    (tmp_artifact_dir / f"{artifact['artifactId']}.txt").unlink()
    page = toa.read_tool_output_page(artifact["artifactId"])
    assert page["ok"] is False
    assert page["error"] == "artifact_unreadable"


def test_d3_spill_failure_returns_none(
    tmp_artifact_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """D3 落盘失败(权限/磁盘)⇒ 返回 None,调用方退回纯截断,不抛给工具面。"""

    def _boom(*_a: object, **_k: object) -> None:
        raise OSError("disk full")

    monkeypatch.setattr(Path, "write_text", _boom)
    assert (
        toa.maybe_spill_tool_output(
            "abc", tool_name="read_file", keep_chars=0, force=True
        )
        is None
    )


def test_e_expired_artifacts_are_pruned(
    tmp_artifact_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """E 保留期:过期工件的正文/元数据在下次落盘时被惰性清理。"""
    old = toa.maybe_spill_tool_output(
        "old", tool_name="read_file", keep_chars=0, force=True
    )
    assert old is not None
    old_time = time.time() - toa.RETENTION_SECONDS - 60
    for suffix in (".txt", ".json"):
        path = tmp_artifact_dir / f"{old['artifactId']}{suffix}"
        os.utime(path, (old_time, old_time))

    fresh = toa.maybe_spill_tool_output(
        "new", tool_name="read_file", keep_chars=0, force=True
    )
    assert fresh is not None
    assert not (tmp_artifact_dir / f"{old['artifactId']}.txt").exists()
    assert not (tmp_artifact_dir / f"{old['artifactId']}.json").exists()
    assert (tmp_artifact_dir / f"{fresh['artifactId']}.txt").exists()


def test_f_budget_guard_returns_none_under_limit(
    tmp_artifact_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """F force=False 且未超预算 ⇒ None(不落盘);超预算才落盘。"""
    from app.services import mcp_server

    monkeypatch.setattr(mcp_server, "_get_tool_output_max_tokens", lambda: 10)
    assert toa.maybe_spill_tool_output("short", tool_name="read_file", keep_chars=0) is None
    spilled = toa.maybe_spill_tool_output(
        "long " * 100, tool_name="read_file", keep_chars=0
    )
    assert spilled is not None


def test_g_serialize_is_stable() -> None:
    """G 序列化唯一形态:ensure_ascii=False;default=str 兜底不可序列化对象。"""
    assert toa.serialize_tool_payload({"a": "中文"}) == '{"a": "中文"}'
    payload = toa.serialize_tool_payload({"a": object()})
    assert payload.startswith('{"a": "<object object at ')
    assert payload.endswith('>"}')
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
