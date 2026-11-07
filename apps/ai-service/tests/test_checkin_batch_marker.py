# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批次执行标记(marker)单测(2026-11-04 立)。

覆盖三件事:
1) 写/刷/删语义:进批写盘带 pid+时间戳+批次名,心跳按间隔刷新,收尾删文件;
2) 失败不致命:写不出来只返回 False(不抛),否则状态文件会把签到主线打断;
3) 装车证明:`_run_batch` 真的构造/启动/停止 marker(造好没装车 = 没有)。

部署侧如何判读这份 marker(fresh / stale / unknown / absent)在
deploy/win/lib/checkin-batch-gate.ps1 与 deploy/win/tests/checkin-batch-gate.test.ps1
里有独立的自检,不在本文件重复。
"""

from __future__ import annotations

import asyncio
import inspect
import json
import os
from datetime import datetime

from app.services import checkin_batch_marker as bm
from app.services import checkin_scheduler as cs
from app.services.checkin_batch_marker import CheckinBatchMarker


def test_default_path_derives_from_repo_root(monkeypatch):
    """不写死盘符:默认路径由本文件位置推导到 <仓库根>/deploy/run/checkin-batch.json。"""
    monkeypatch.delenv(bm.MARKER_ENV, raising=False)
    p = bm.default_marker_path()
    assert p.is_absolute()
    assert p.name == "checkin-batch.json"
    assert p.parent.name == "run"
    assert p.parent.parent.name == "deploy"
    # 反证推导出的就是仓库根:那里必须能找到本模块自己(换盘符/换根也成立)。
    repo_root = p.parent.parent.parent
    selftest = repo_root / "apps" / "ai-service" / "app" / "services" / "checkin_batch_marker.py"
    assert selftest.exists()


def test_env_override_wins(monkeypatch, tmp_path):
    target = tmp_path / "marker.json"
    monkeypatch.setenv(bm.MARKER_ENV, str(target))
    assert bm.default_marker_path() == target


def test_write_payload_shape(tmp_path):
    """字段契约:部署侧靠 heartbeatAt/startedAt 判 freshness,靠 pid/batch 给证据。"""
    path = tmp_path / "marker.json"
    m = CheckinBatchMarker("主窗口", path=path)
    assert m.write() is True
    raw = json.loads(path.read_text("utf-8"))
    assert raw["schema"] == bm.SCHEMA
    assert raw["pid"] == os.getpid()
    assert raw["batch"] == "主窗口"
    started = datetime.fromisoformat(raw["startedAt"])
    heartbeat = datetime.fromisoformat(raw["heartbeatAt"])
    assert started.tzinfo is not None
    assert heartbeat.tzinfo is not None
    assert heartbeat >= started


def test_atomic_write_leaves_no_temp_files(tmp_path):
    """原子写(临时文件 + os.replace):读侧不会看到半截 JSON,也不留 .tmp 残渣。"""
    path = tmp_path / "marker.json"
    m = CheckinBatchMarker("Qoder窗口", path=path)
    assert m.write() is True
    assert [p.name for p in tmp_path.iterdir()] == ["marker.json"]


def test_write_failure_is_swallowed(tmp_path):
    """写不出来只记 WARN、返回 False:状态文件缺陷绝不许把签到批次打断。"""
    blocker = tmp_path / "blocker"
    blocker.write_text("x", encoding="utf-8")
    m = CheckinBatchMarker("主窗口", path=blocker / "marker.json")
    assert m.write() is False
    # beat() 在未 stop 时同样不抛
    assert m.beat() is False


async def test_start_beat_stop_lifecycle(tmp_path):
    """start 写盘 + 起心跳;stop 停心跳并删文件(正常收尾 ⇒ 部署侧应看到 absent)。"""
    path = tmp_path / "marker.json"
    m = CheckinBatchMarker("主窗口", path=path, heartbeat_seconds=1.0)
    assert await m.start() is True
    assert path.exists()
    first = json.loads(path.read_text("utf-8"))
    m.beat()
    second = json.loads(path.read_text("utf-8"))
    assert datetime.fromisoformat(second["heartbeatAt"]) >= datetime.fromisoformat(
        first["heartbeatAt"]
    )
    await m.stop()
    assert path.exists() is False
    # stop 可重复调用(批次 finally 与服务关闭路径都可能走到)
    await m.stop()
    assert path.exists() is False


async def test_heartbeat_loop_refreshes_without_changing_identity(tmp_path):
    """心跳每 20s 一次(单测压到 1s):只刷新 heartbeatAt,pid/batch 不动。"""
    path = tmp_path / "marker.json"
    m = CheckinBatchMarker("Qoder补跑", path=path, heartbeat_seconds=1.0)
    await m.start()
    before = json.loads(path.read_text("utf-8"))
    await asyncio.sleep(1.2)
    after = json.loads(path.read_text("utf-8"))
    assert datetime.fromisoformat(after["heartbeatAt"]) > datetime.fromisoformat(
        before["heartbeatAt"]
    )
    assert after["pid"] == before["pid"]
    assert after["batch"] == before["batch"]
    assert after["startedAt"] == before["startedAt"]
    await m.stop()


def test_run_batch_wires_marker_in_source():
    """装车证明(源码面):_run_batch 构造 → start → finally stop,三者缺一即失效。"""
    src = inspect.getsource(cs.checkin_scheduler._run_batch)
    assert "CheckinBatchMarker(label)" in src
    assert "await marker.start()" in src
    assert "await marker.stop()" in src


async def test_run_batch_writes_and_clears_marker_behaviourally(tmp_path, monkeypatch):
    """装车证明(行为面):批次进行中盘上有 marker,批次结束 marker 被删。

    这里把引擎与落库都换成替身(不触 DB、不打上游),只看 marker 的进出。
    """
    path = tmp_path / "marker.json"
    monkeypatch.setenv(bm.MARKER_ENV, str(path))
    monkeypatch.setenv("CHECKIN_CRON_ENABLED", "true")

    observed: dict[str, object] = {}

    async def fake_checkin_one(acc: dict[str, object]) -> dict[str, object]:
        observed["marker"] = json.loads(path.read_text("utf-8"))
        return {"ok": True, "action": "skip_already", "message": "单测替身"}

    async def fake_record_result(account_id: int, result: dict[str, object]) -> dict[str, object]:
        return {"id": account_id}

    monkeypatch.setattr(cs.checkin_scheduler, "checkin_one", fake_checkin_one)
    monkeypatch.setattr(cs.checkin_scheduler, "record_result", fake_record_result)
    monkeypatch.setattr(cs.random, "shuffle", lambda x: None)
    monkeypatch.setattr(cs.random, "uniform", lambda a, b: 0)

    await cs.checkin_scheduler._run_batch(
        [{"id": 1, "name": "acc1", "platform": "trae"}], {}, "单测批次"
    )

    marker = observed.get("marker")
    assert isinstance(marker, dict)
    assert marker["batch"] == "单测批次"
    assert marker["pid"] == os.getpid()
    assert path.exists() is False
    assert cs.checkin_scheduler._batch_running is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
