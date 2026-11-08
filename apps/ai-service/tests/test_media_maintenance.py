# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""media_maintenance 单测(2026-09-09 第八轮):磁盘 TTL 清扫 + 僵尸任务强失败。"""
from __future__ import annotations

import asyncio
import time
from pathlib import Path

import pytest


@pytest.fixture()
def chart_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    d = tmp_path / "charts"
    d.mkdir()
    from app.services import media_maintenance as mm

    monkeypatch.setattr(mm, "_CHART_DIRS", (d,))
    return d


def test_sweep_deletes_expired_html_and_paired_owner(chart_dir: Path) -> None:
    old = time.time() - 8 * 86400
    new = time.time() - 60
    old_html = chart_dir / "20260801_1200_old_abcdef01.html"
    old_html.write_text("<html></html>", encoding="utf-8")
    (chart_dir / "20260801_1200_old_abcdef01.html.owner").write_text('{"user_id":"u1"}', encoding="utf-8")
    os_utime = old_html.touch  # noqa: F841
    import os

    os.utime(old_html, (old, old))
    new_html = chart_dir / "20260908_1200_new_abcdef02.html"
    new_html.write_text("<html></html>", encoding="utf-8")
    os.utime(new_html, (new, new))

    from app.services.media_maintenance import sweep_chart_files

    removed = sweep_chart_files()
    assert removed["html"] == 1
    assert not old_html.exists()
    assert not (chart_dir / "20260801_1200_old_abcdef01.html.owner").exists()
    assert new_html.exists()


def test_sweep_removes_orphan_owner(chart_dir: Path) -> None:
    import os

    orphan = chart_dir / "ghost_abcdef03.html.owner"
    orphan.write_text('{"user_id":"u2"}', encoding="utf-8")
    os.utime(orphan, (time.time() - 60, time.time() - 60))

    from app.services.media_maintenance import sweep_chart_files

    removed = sweep_chart_files()
    assert removed["owner"] == 1
    assert not orphan.exists()


def test_sweep_deletes_fresh_orphan_owner(chart_dir: Path) -> None:
    """孤儿 sidecar 一律清理:sidecar 在 html 之后写盘,无 html 的 owner
    只可能是 html 已被单独删除的残留(写盘间隙不存在)。"""
    fresh = chart_dir / "fresh_abcdef04.html.owner"
    fresh.write_text('{"user_id":"u3"}', encoding="utf-8")

    from app.services.media_maintenance import sweep_chart_files

    removed = sweep_chart_files()
    assert removed["owner"] == 1
    assert not fresh.exists()


def test_sweep_keeps_owner_paired_with_fresh_html(chart_dir: Path) -> None:
    """AIS-096 回归:成对的 `x.html.owner` 不是孤儿。

    旧实现用 `p.stem`(`x`)与 html 的 `stem` 比对,但 sidecar 名是 `x.html.owner`、
    stem 为 `x.html`,配对恒不成立 ⇒ 每轮清扫都会把归属凭证删光,导致
    /api/artifacts/token 因 sidecar 缺失而 fail-open 放行他人。
    """
    html = chart_dir / "20260908_1200_live_abcdef05.html"
    html.write_text("<html></html>", encoding="utf-8")
    owner = chart_dir / "20260908_1200_live_abcdef05.html.owner"
    owner.write_text('{"user_id":"u5"}', encoding="utf-8")

    from app.services.media_maintenance import sweep_chart_files

    removed = sweep_chart_files()
    assert removed == {"html": 0, "owner": 0}
    assert html.exists()
    assert owner.exists()


class _FakeConn:
    def __init__(self, rows: list[dict] | None = None, raise_on_fetch: Exception | None = None):
        self.rows = rows or []
        self.raise_on_fetch = raise_on_fetch
        self.calls: list[tuple] = []

    async def fetch(self, sql: str, *params):
        if self.raise_on_fetch:
            raise self.raise_on_fetch
        self.calls.append((sql, params))
        return self.rows

    async def close(self):
        pass


@pytest.mark.asyncio()
async def test_fail_stuck_tasks_uses_conditional_update(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = _FakeConn(rows=[{"task_id": "t-1"}])
    monkeypatch.setattr(
        "app.services.media_tasks.get_db_conn", lambda: asyncio.sleep(0, result=conn)
    )
    from app.services.media_maintenance import fail_stuck_tasks

    n = await fail_stuck_tasks()
    assert n == 1
    sql, params = conn.calls[0]
    # 条件更新:仅命中在途状态 + 超时阈值,终态任务不可能被翻转
    assert "status = ANY(" in sql and "updated_at < now()" in sql
    assert "RETURNING task_id" in sql
    assert params[1] == ["processing", "accepted", "submitted", "pending"]
    # AIS-097:按 kind 分档 —— 视频 120 分钟,其余维持 30 分钟
    assert "kind = 'video'" in sql
    assert params[2] == "120"
    assert params[3] == "30"


@pytest.mark.asyncio()
async def test_fail_stuck_tasks_fail_open(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = _FakeConn(raise_on_fetch=RuntimeError("db down"))
    monkeypatch.setattr(
        "app.services.media_tasks.get_db_conn", lambda: asyncio.sleep(0, result=conn)
    )
    from app.services.media_maintenance import fail_stuck_tasks

    assert await fail_stuck_tasks() == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
