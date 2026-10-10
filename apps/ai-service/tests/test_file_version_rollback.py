# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""文件版本快照 / 回滚的三态分流测试(G-815934)。

病灶:`snapshot_file` 原先在读取失败时把 content 记成 "" 且只 logger.debug,
`rollback_file` 又无条件 write_text —— 于是"文件本来不存在"与"文件存在但读不到"
两种情形都会变成"把现有文件写成空文件"(数据丢失,且账面全绿)。

本文件覆盖票面要求的三条成对用例 + 三条配套对照:
① 快照时文件不存在 → 回滚后文件**消失**(不是空文件)
② 快照期读取失败   → 回滚**拒绝执行并点名路径与原因**,原文件内容逐字未变
③ 正常读到的旧内容 → 回滚后与原文逐字等值
④ 删除分支幂等:文件已经不在了也不报错、更不新建空文件
⑤ 兼容改造前拍的旧快照(没有两个布尔位)→ 绝不据此删除文件
⑥ 原子写回不留 .fe_tmp_* 残件

测试隔离(AGENTS §5):纯文件系统用例,不碰 PostgreSQL / Redis。
autouse fixture 强制 file_editor 走纯内存模式并复位版本表。
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.services import file_editor

# =============================================================================
# fixtures / helpers
# =============================================================================


@pytest.fixture(autouse=True)
def _memory_mode(monkeypatch):
    """强制纯内存模式:本用例不得对生产 Redis(8811)产生任何副作用。"""
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setattr(file_editor, "_redis_available", False)
    monkeypatch.setattr(file_editor, "_redis_client_instance", None)
    file_editor._FILE_VERSION_STORE.clear()
    yield
    file_editor._FILE_VERSION_STORE.clear()
    file_editor._redis_available = None


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    """把 file_editor 工作区白名单指向临时目录。"""
    monkeypatch.setattr(file_editor, "_workspace_roots", lambda: [str(tmp_path)])
    return tmp_path


def _record(session_id: str, target: Path) -> dict:
    """取回本次写入版本表的那条快照记录(键与 file_editor 同算法,不看返回值)。"""
    versions = file_editor._FILE_VERSION_STORE[(session_id, os.path.abspath(str(target)))]
    return versions[-1]


def _tmp_residue(dir_path: Path) -> list[str]:
    return [p.name for p in dir_path.glob("*.fe_tmp_*")]


# =============================================================================
# ① 快照时文件不存在 → 回滚必须是"删除",不是"写空"
# =============================================================================


def test_rollback_of_created_file_deletes_it(workspace):
    """agent 新建的文件在回滚后应当消失,而不是变成空文件(票面用例①)。"""
    target = workspace / "created-by-agent.txt"
    assert not target.exists()

    snap = file_editor.snapshot_file("s-new", str(target))
    assert _record("s-new", target)["existed_before"] is False

    # 模拟 agent 写文件
    target.write_text("brand new content", encoding="utf-8")
    assert target.exists()

    result = file_editor.rollback_file("s-new", str(target), version_id=snap["version_id"])

    assert result["ok"] is True
    assert result["action"] == "deleted"
    # 断言"不存在",而不是"内容为空"——后者正是本票修掉的病灶
    assert not target.exists()


def test_delete_is_missing_ok_and_never_creates_file(workspace):
    """文件已经不在了:删除仍应成功,且绝不新建一个空文件(对照④)。"""
    target = workspace / "already-gone.txt"
    snap = file_editor.snapshot_file("s-gone", str(target))

    result = file_editor.rollback_file("s-gone", str(target), version_id=snap["version_id"])

    assert result["ok"] is True
    assert result["action"] == "deleted"
    assert not target.exists()


# =============================================================================
# ② 快照期读取失败 → 回滚必须拒绝并点名,绝不写空覆盖
# =============================================================================


def test_rollback_refuses_when_snapshot_could_not_read(workspace, monkeypatch):
    """读那一步抛异常时:拒绝执行 + 原文件逐字未变(票面用例②)。"""
    target = workspace / "precious.txt"
    original = "第一行原文\nline two\n\n最后一行,不能被抹掉\n"
    target.write_text(original, encoding="utf-8")

    real_read_text = Path.read_text
    # 只在"快照期"armed:monkeypatch.undo() 会连带撤销本 fixture 的其他补丁
    # (含 _memory_mode 的 Redis 中和),那会把用例推向真实 Redis,故不用它。
    armed = {"on": True}

    def boom(self, *args, **kwargs):  # noqa: ANN002, ANN003 - 模拟读取失败
        if armed["on"] and os.path.abspath(str(self)) == os.path.abspath(str(target)):
            raise OSError("模拟快照期读取失败")
        return real_read_text(self, *args, **kwargs)

    monkeypatch.setattr(Path, "read_text", boom)
    snap = file_editor.snapshot_file("s-readfail", str(target))
    armed["on"] = False

    record = _record("s-readfail", target)
    # 快照记录自身必须诚实:读失败 ⇒ read_ok=False,且不得留下"看似可信"的 content
    assert record["existed_before"] is True
    assert record["read_ok"] is False
    assert "content" not in record
    assert "模拟快照期读取失败" in record["read_error"]

    result = file_editor.rollback_file("s-readfail", str(target), version_id=snap["version_id"])

    assert result["ok"] is False
    assert result["errorCode"] == "SNAPSHOT_UNREADABLE"
    # 可诊断:点名路径与原因
    assert record["path"] in result["message"]
    assert "模拟快照期读取失败" in result["message"]
    # 关键:现有文件内容逐字未变
    assert target.read_text(encoding="utf-8") == original
    assert _tmp_residue(workspace) == []


# =============================================================================
# ③ 正向对照:正常读到的旧内容 → 回滚逐字等值
# =============================================================================


def test_rollback_restores_snapshot_content_verbatim(workspace):
    """正向对照:read_ok 的记录照常写回,且与原文逐字等值(票面用例③)。"""
    target = workspace / "normal.txt"
    original = "row1\nrow2\ntrailing newline kept\n"
    target.write_text(original, encoding="utf-8")

    snap = file_editor.snapshot_file("s-ok", str(target))
    record = _record("s-ok", target)
    assert record["existed_before"] is True
    assert record["read_ok"] is True
    assert record["content"] == original

    target.write_text("被写坏了", encoding="utf-8")

    result = file_editor.rollback_file("s-ok", str(target), version_id=snap["version_id"])

    assert result["ok"] is True
    assert result["action"] == "restored"
    assert target.read_text(encoding="utf-8") == original
    assert _tmp_residue(workspace) == []


# =============================================================================
# ⑤ 兼容改造前拍的旧快照:没有两个布尔位时绝不删文件
# =============================================================================


def test_legacy_record_without_flags_is_never_deleted(workspace):
    """旧记录(缺 existed_before/read_ok)按历史语义写回,不得据此删除文件。"""
    target = workspace / "legacy.txt"
    target.write_text("legacy-original", encoding="utf-8")
    snap = file_editor.snapshot_file("s-legacy", str(target))
    record = _record("s-legacy", target)
    # 造出改造前的记录形态:只有 content,没有两个布尔位
    record.pop("existed_before")
    record.pop("read_ok")
    record["content"] = "legacy-original"

    target.write_text("changed by someone else", encoding="utf-8")

    result = file_editor.rollback_file("s-legacy", str(target), version_id=snap["version_id"])

    assert result["ok"] is True
    assert target.exists()
    assert target.read_text(encoding="utf-8") == "legacy-original"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
