# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""media_maintenance 单测(2026-09-09 第八轮):磁盘 TTL 清扫 + 僵尸任务强失败。"""
from __future__ import annotations

import asyncio
import json
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


class _StuckDb:
    """假 DB:按新代码「每条 SQL 带 kind + 分钟数」的形态模拟条件更新命中集合。

    旧代码只有一条全局 SQL(参数里没有 kind),这里会把所有 kind 一起按同一阈值
    判死 —— 新夹具因此对旧代码必红(详见 AIS-097 用例)。
    """

    KINDS = ("video", "music", "tts", "image")

    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.calls: list[tuple[str, tuple]] = []

    async def fetch(self, sql: str, *params):
        self.calls.append((sql, params))
        kind_filter: str | None = None
        kind_exclude: set[str] | None = None
        minutes: int | None = None
        for p in params:
            if isinstance(p, (list, tuple)):
                # 表外兜底 SQL 的第 3 参是「已知 kind 排除集合」;状态集合与
                # KINDS 无交集,不能误当排除集合
                if set(p) & set(self.KINDS):
                    kind_exclude = set(p)
                continue
            if isinstance(p, str) and p in self.KINDS:
                kind_filter = p
            elif isinstance(p, str) and p.isdigit():
                minutes = int(p)
        if minutes is None:
            return []
        return [
            {"task_id": r["task_id"]}
            for r in self.rows
            if (kind_filter is None or r["kind"] == kind_filter)
            and (kind_exclude is None or r["kind"] not in kind_exclude)
            and r["age_minutes"] > minutes
        ]

    async def close(self):
        pass


@pytest.mark.asyncio()
async def test_fail_stuck_tasks_uses_per_kind_conditional_update(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """每个 kind 各用自己档位的分钟数,SQL 仍是在途条件更新(终态不可能被翻转)。"""
    db = _StuckDb([
        {"kind": "video", "age_minutes": 200, "task_id": "t-v"},
        {"kind": "music", "age_minutes": 200, "task_id": "t-m"},
        {"kind": "tts", "age_minutes": 200, "task_id": "t-t"},
        {"kind": "image", "age_minutes": 200, "task_id": "t-i"},
    ])
    monkeypatch.setattr(
        "app.services.media_tasks.get_db_conn", lambda: asyncio.sleep(0, result=db)
    )
    from app.services.media_maintenance import _STUCK_MINUTES_BY_KIND, fail_stuck_tasks

    n = await fail_stuck_tasks()
    assert n == 4
    assert db.calls, "应至少发起一次条件更新"
    seen_kinds: set[str] = set()
    for sql, params in db.calls:
        # 条件更新:仅命中在途状态 + 各自超时阈值,终态任务不可能被翻转
        assert "status = ANY(" in sql and "updated_at < now()" in sql
        assert "RETURNING task_id" in sql
        if "kind <> ALL(" in sql:
            continue  # 表外兜底 SQL 由下面的专门用例覆盖
        assert "kind = $" in sql
        assert params[1] == ["processing", "accepted", "submitted", "pending"]
        kind = next(p for p in params if isinstance(p, str) and p in _STUCK_MINUTES_BY_KIND)
        minutes = next(p for p in params if isinstance(p, str) and p.isdigit())
        seen_kinds.add(kind)
        assert minutes == str(_STUCK_MINUTES_BY_KIND[kind])
    assert seen_kinds == set(_STUCK_MINUTES_BY_KIND)


@pytest.mark.asyncio()
async def test_stuck_unmapped_kind_still_failed_at_base_threshold(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AIS-097(b'):表外 kind(schema 默认 'media')按基础档兜底,分档后不漏扫。"""
    db = _StuckDb([
        {"kind": "media", "age_minutes": 45, "task_id": "legacy-45"},
        {"kind": "video", "age_minutes": 45, "task_id": "v-45"},
    ])
    monkeypatch.setattr(
        "app.services.media_tasks.get_db_conn", lambda: asyncio.sleep(0, result=db)
    )
    from app.services.media_maintenance import _BASE_STUCK_MINUTES, fail_stuck_tasks

    assert _BASE_STUCK_MINUTES == 30
    assert await fail_stuck_tasks() == 1
    assert any("kind <> ALL(" in sql for sql, _p in db.calls)


@pytest.mark.asyncio()
async def test_stuck_video_at_60_and_75_minutes_not_failed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AIS-097(a):官方视频 p90 55~75 分钟,在途 60/75 分钟不得被强失败。"""
    db = _StuckDb([
        {"kind": "video", "age_minutes": 60, "task_id": "v-60"},
        {"kind": "video", "age_minutes": 75, "task_id": "v-75"},
    ])
    monkeypatch.setattr(
        "app.services.media_tasks.get_db_conn", lambda: asyncio.sleep(0, result=db)
    )
    from app.services.media_maintenance import fail_stuck_tasks

    assert await fail_stuck_tasks() == 0


@pytest.mark.asyncio()
async def test_stuck_audio_image_still_failed_at_short_threshold(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AIS-097(b):音频/图片仍按短档判死(防分档后一刀切回退成"全都不死")。"""
    db = _StuckDb([
        {"kind": "video", "age_minutes": 45, "task_id": "v-45"},
        {"kind": "music", "age_minutes": 45, "task_id": "m-45"},
        {"kind": "tts", "age_minutes": 45, "task_id": "t-45"},
        {"kind": "image", "age_minutes": 45, "task_id": "i-45"},
    ])
    monkeypatch.setattr(
        "app.services.media_tasks.get_db_conn", lambda: asyncio.sleep(0, result=db)
    )
    from app.services.media_maintenance import fail_stuck_tasks

    assert await fail_stuck_tasks() == 3


@pytest.mark.asyncio()
async def test_fail_stuck_tasks_fail_open(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = _FakeConn(raise_on_fetch=RuntimeError("db down"))
    monkeypatch.setattr(
        "app.services.media_tasks.get_db_conn", lambda: asyncio.sleep(0, result=conn)
    )
    from app.services.media_maintenance import fail_stuck_tasks

    assert await fail_stuck_tasks() == 0


# ---------------------------------------------------------------------------
# AIS-097(c)(d):在途节流心跳 + 终态写回守卫
# ---------------------------------------------------------------------------


class _ExecFetchConn:
    """假连接:记录 execute(心跳)+ 可配置 fetch 返回在途行。"""

    def __init__(self, rows: list[dict] | None = None) -> None:
        self.rows = rows or []
        self.exec_calls: list[tuple[str, tuple]] = []

    async def execute(self, sql: str, *params):
        self.exec_calls.append((sql, params))
        return "UPDATE 2"

    async def fetch(self, sql: str, *params):
        return self.rows

    async def close(self):
        pass


@pytest.mark.asyncio()
async def test_in_flight_heartbeat_touches_updated_at_only() -> None:
    """AIS-097(c):心跳只推进 updated_at(节流),不改 status/result。"""
    from app.services.media_tasks import (
        _HEARTBEAT_MIN_INTERVAL_MINUTES,
        _heartbeat_in_flight_tasks,
    )

    conn = _ExecFetchConn()
    n = await _heartbeat_in_flight_tasks(conn, [1, 2])
    assert n == 2
    sql, params = conn.exec_calls[0]
    assert "SET updated_at=now()" in sql
    assert "status = ANY(" in sql  # 只碰在途,终态不会被心跳复活
    assert "updated_at < now()" in sql  # SQL 侧节流(不是每轮无条件写)
    assert "status='" not in sql and "result=" not in sql
    assert params[0] == [1, 2]
    assert params[1] == ["processing", "accepted", "submitted", "pending"]
    assert params[2] == str(_HEARTBEAT_MIN_INTERVAL_MINUTES)


def _patch_poller(monkeypatch: pytest.MonkeyPatch, conn, provider_cls) -> None:  # noqa: ANN001
    from app.services import media_tasks as mt

    class _Cfg:
        api_key = "k"
        api_base = "https://api.example.test"

    class _FakeSettings:
        def get_provider_config(self, name):  # noqa: ANN001
            return _Cfg()

    monkeypatch.setattr("app.core.config.settings", _FakeSettings())
    monkeypatch.setattr(mt, "get_db_conn", lambda: asyncio.sleep(0, result=conn))
    monkeypatch.setattr(
        "app.providers.token6688_provider.Token6688Provider", provider_cls
    )


@pytest.mark.asyncio()
async def test_poller_heartbeats_only_when_upstream_still_processing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AIS-097(c):只有上游明确回 processing/pending 才续命 updated_at。"""
    from app.services import media_tasks as mt

    conn = _ExecFetchConn([{"id": 7, "kind": "video", "task_id": "v-7"}])

    class _Prov:
        def __init__(self, **_kw):  # noqa: ANN003
            pass

        async def get_task_status(self, _tid: str):
            return {"status": "processing"}

    _patch_poller(monkeypatch, conn, _Prov)
    assert await mt._poll_processing_batch() == 0  # 上游仍在处理,无终态回写
    assert conn.exec_calls, "上游确认在途时必须打心跳"
    sql, params = conn.exec_calls[0]
    assert "SET updated_at=now()" in sql
    assert params[0] == [7]


@pytest.mark.asyncio()
async def test_poller_does_not_renew_updated_at_when_probe_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AIS-097(c'):探测失败/无状态不得续命 —— 否则僵尸任务永远判不死。"""
    from app.services import media_tasks as mt

    conn = _ExecFetchConn([{"id": 7, "kind": "video", "task_id": "v-7"}])

    class _Prov:
        def __init__(self, **_kw):  # noqa: ANN003
            pass

        async def get_task_status(self, _tid: str):
            raise RuntimeError("upstream timeout")

    _patch_poller(monkeypatch, conn, _Prov)
    assert await mt._poll_processing_batch() == 0
    assert conn.exec_calls == [], "探测失败不得刷新 updated_at"


@pytest.mark.asyncio()
async def test_poller_without_api_key_never_heartbeats(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AIS-097(c''):未配 provider key 时不探测、也不得凭空续命。"""
    from app.services import media_tasks as mt

    conn = _ExecFetchConn([{"id": 7, "kind": "video", "task_id": "v-7"}])

    class _Cfg:
        api_key = ""

    class _FakeSettings:
        def get_provider_config(self, name):  # noqa: ANN001
            return _Cfg()

    monkeypatch.setattr("app.core.config.settings", _FakeSettings())
    monkeypatch.setattr(
        mt, "get_db_conn", lambda: asyncio.sleep(0, result=conn)
    )
    assert await mt._poll_processing_batch() == 0
    assert conn.exec_calls == []


class _UpdateDb:
    def __init__(self, row: dict | None) -> None:
        self.row = row
        self.calls: list[tuple[str, tuple]] = []

    async def fetchrow(self, sql: str, *params):
        self.calls.append((sql, params))
        return self.row

    async def close(self):
        pass


@pytest.mark.asyncio()
async def test_update_media_task_only_if_in_flight_still_applies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AIS-097(d):终态写回仍带在途守卫,正常命中仍返回 True。"""
    from app.services.media_tasks import update_media_task

    db = _UpdateDb({"id": 1})
    monkeypatch.setattr(
        "app.services.media_tasks.get_db_conn", lambda: asyncio.sleep(0, result=db)
    )
    assert await update_media_task(
        "t-1",
        status="succeeded",
        result={"video_url": "https://cdn/v.mp4"},
        only_if_in_flight=True,
    ) is True
    sql, params = db.calls[0]
    assert "status = ANY(" in sql
    assert params[-1] == ["processing", "accepted", "submitted", "pending"]


# ---------------------------------------------------------------------------
# AIS-096:owner sidecar 不得被清扫误删 + 产物归属 fail-closed
# ---------------------------------------------------------------------------


def test_sweep_keeps_live_html_with_owner_sidecar(chart_dir: Path) -> None:
    """(a) x.html + x.html.owner 均在世 → sidecar 不得被当孤儿删(旧代码必红)。"""
    import os

    html = chart_dir / "20261108_1200_live_abcdef05.html"
    owner = chart_dir / f"{html.name}.owner"
    html.write_text("<html></html>", encoding="utf-8")
    owner.write_text('{"user_id":"u5"}', encoding="utf-8")
    now = time.time() - 60
    os.utime(html, (now, now))
    os.utime(owner, (now, now))

    from app.services.media_maintenance import sweep_chart_files

    removed = sweep_chart_files()
    assert html.exists()
    assert owner.exists()
    assert removed == {"html": 0, "owner": 0}


def _write_chart(path: Path, owner_user: str | None = None) -> None:
    path.write_text("<html></html>", encoding="utf-8")
    if owner_user is not None:
        Path(str(path) + ".owner").write_text(
            json.dumps({"user_id": owner_user}), encoding="utf-8"
        )


@pytest.mark.asyncio()
async def test_artifact_new_product_without_sidecar_is_fail_closed(
    tmp_path: Path,
) -> None:
    """(c) 新产物缺 sidecar → 拒绝(fail-closed,防归属凭证被删后越权取图)。"""
    from fastapi import HTTPException

    from app.routers.artifacts import enforce_artifact_owner

    target = tmp_path / "20261108_1200_newchart_abcdef06.html"
    _write_chart(target)
    with pytest.raises(HTTPException) as excinfo:
        await enforce_artifact_owner(target, "user-1")
    assert excinfo.value.status_code == 403


@pytest.mark.asyncio()
async def test_artifact_own_sidecar_still_readable(tmp_path: Path) -> None:
    """(d) 归属正确的正常图表仍可读(防误挡)。"""
    from app.routers.artifacts import enforce_artifact_owner

    target = tmp_path / "20261108_1200_ownchart_abcdef07.html"
    _write_chart(target, "user-1")
    await enforce_artifact_owner(target, "user-1")
    assert target.exists()


@pytest.mark.asyncio()
async def test_artifact_other_owner_rejected(tmp_path: Path) -> None:
    """他人 sidecar → 403(原有归属校验不许被 fail-closed 改造回退)。"""
    from fastapi import HTTPException

    from app.routers.artifacts import enforce_artifact_owner

    target = tmp_path / "20261108_1200_otherchart_abcdef08.html"
    _write_chart(target, "user-2")
    with pytest.raises(HTTPException) as excinfo:
        await enforce_artifact_owner(target, "user-1")
    assert excinfo.value.status_code == 403


@pytest.mark.asyncio()
async def test_artifact_legacy_without_sidecar_still_allowed(tmp_path: Path) -> None:
    """存量兼容:sidecar 上线(2026-09-09)前的旧产物无 sidecar → 放行。

    判定口径:文件名时间戳前缀早于上线日 ⇒ 历史产物(当时存量无法重建归属,
    且生成时未带随机段不可枚举);上线日及之后的新产物缺 sidecar 一律 fail-closed。
    """
    from app.routers.artifacts import enforce_artifact_owner

    target = tmp_path / "20260901_1200_oldchart_abcdef09.html"
    _write_chart(target)
    await enforce_artifact_owner(target, "user-1")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
