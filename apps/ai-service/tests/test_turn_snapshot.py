# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""turn_snapshot 编排层单测(2026-11-15)。

覆盖面:
- begin/record/finish/manifest 归集正确性(纯内存,不读盘);
- record_snapshot 按 path 去重(同文件后登记者覆盖);
- revert_turn 逐文件走 file_editor.rollback_file(monkeypatch,不碰真盘);
- revert_turn 一致性闸 fail-closed:闸不一致 ⇒ 整批不动(绝不回滚一半);
- 一致性闸 opt-in:不提供三面 ⇒ 不跑闸(不冒充已判),照常逐文件回滚。

刻意不测的:
- 真实磁盘回滚(那属 file_editor.rollback_file 的既有测试);
- 一致性闸内部判据(那属 app.core.revert_check 的既有测试)。
本模块只钉编排行为。
"""

from __future__ import annotations

from typing import Any

from app.core.turn_snapshot import TurnSnapshotLedger, default_ledger


# ---------------------------------------------------------------------------
# begin / record / finish / manifest 归集
# ---------------------------------------------------------------------------


def test_begin_finish_produces_manifest() -> None:
    led = TurnSnapshotLedger()
    tid = led.begin_turn(session_id="s1", checkpoint_id="cp1")
    manifest = led.manifest(tid)
    assert manifest is not None
    assert manifest["turn_id"] == tid
    assert manifest["session_id"] == "s1"
    assert manifest["checkpoint_id"] == "cp1"
    assert manifest["file_count"] == 0
    assert manifest["files"] == []
    assert manifest["criterion"] == "app.core.turn_snapshot/v1:turn-scoped-revert"
    # finish 幂等,finished_at 落定
    done = led.finish_turn(tid)
    assert done["ok"] is True
    assert done["manifest"]["finished_at"] is not None
    done2 = led.finish_turn(tid)
    assert done2["ok"] is True
    assert done2["manifest"]["finished_at"] == done["manifest"]["finished_at"]


def test_record_snapshot_dedupes_by_path() -> None:
    led = TurnSnapshotLedger()
    tid = led.begin_turn("s1")
    led.record_snapshot(tid, "/a/x.py", "v1")
    led.record_snapshot(tid, "/b/y.py", "v2")
    # 同路径再登记 → 覆盖,不重复
    led.record_snapshot(tid, "/a/x.py", "v1b")
    manifest = led.manifest(tid)
    assert manifest is not None
    assert manifest["file_count"] == 2
    paths = {e["path"]: e["version_id"] for e in manifest["files"]}
    assert paths == {"/a/x.py": "v1b", "/b/y.py": "v2"}


def test_record_snapshot_unknown_turn() -> None:
    led = TurnSnapshotLedger()
    out = led.record_snapshot("nope", "/a/x.py", "v1")
    assert out["ok"] is False
    assert out["errorCode"] == "TURN_NOT_FOUND"


def test_revert_turn_unknown_turn() -> None:
    led = TurnSnapshotLedger()
    out = led.revert_turn("nope")
    assert out["ok"] is False
    assert out["errorCode"] == "TURN_NOT_FOUND"
    assert out["reverted"] == []
    assert out["failed"] == []


# ---------------------------------------------------------------------------
# revert_turn 逐文件走 file_editor.rollback_file(monkeypatch)
# ---------------------------------------------------------------------------


def _patch_rollback(monkeypatch: Any, behavior: dict[str, dict[str, Any]]) -> None:
    """把 file_editor.rollback_file 换成查表实现(按 version_id 返回预定结果)。

    turn_snapshot 通过 ``from app.services.file_editor import rollback_file`` 引入,
    所以要 patch 的是 ``app.core.turn_snapshot.rollback_file`` 这个绑定。
    """

    def _fake(
        session_id: str,
        file_path: str,
        version_id: str | None = None,
        checkpoint_id: str | None = None,
    ) -> dict[str, Any]:
        return behavior.get(version_id or "", {"ok": False, "errorCode": "VERSION_NOT_FOUND"})

    monkeypatch.setattr("app.core.turn_snapshot.rollback_file", _fake)


def test_revert_turn_all_ok(monkeypatch: Any) -> None:
    led = TurnSnapshotLedger()
    tid = led.begin_turn("s1")
    led.record_snapshot(tid, "/a/x.py", "v1")
    led.record_snapshot(tid, "/b/y.py", "v2")
    _patch_rollback(
        monkeypatch,
        {
            "v1": {"ok": True, "action": "restored", "path": "/a/x.py", "version_id": "v1"},
            "v2": {"ok": True, "action": "deleted", "path": "/b/y.py", "version_id": "v2"},
        },
    )
    out = led.revert_turn(tid)
    assert out["ok"] is True
    assert len(out["reverted"]) == 2
    assert out["failed"] == []
    assert out["gate"] is None  # 未提供三面 ⇒ 不跑闸


def test_revert_turn_partial_failure_still_reverts_rest(monkeypatch: Any) -> None:
    """单文件失败是文件级问题,不连坐:其余文件照常回滚。"""
    led = TurnSnapshotLedger()
    tid = led.begin_turn("s1")
    led.record_snapshot(tid, "/a/x.py", "v1")
    led.record_snapshot(tid, "/b/y.py", "v2")
    _patch_rollback(
        monkeypatch,
        {
            "v1": {"ok": True, "action": "restored", "path": "/a/x.py", "version_id": "v1"},
            "v2": {"ok": False, "errorCode": "SNAPSHOT_UNREADABLE", "path": "/b/y.py"},
        },
    )
    out = led.revert_turn(tid)
    assert out["ok"] is False
    assert len(out["reverted"]) == 1
    assert len(out["failed"]) == 1
    assert out["failed"][0]["errorCode"] == "SNAPSHOT_UNREADABLE"


# ---------------------------------------------------------------------------
# 一致性闸 fail-closed
# ---------------------------------------------------------------------------


def _consistent_inputs() -> dict[str, Any]:
    """构造「一致」的三面输入(两侧同内容 ⇒ verdict=consistent)。"""
    return {
        "target_snapshot": {"files": {"a.py": "hello"}},
        "current_workspace": {"files": {"a.py": "hello"}},
        "policy": {"enabled": True},
    }


def _diverged_inputs() -> dict[str, Any]:
    """构造「有在途改动」的三面输入 ⇒ verdict=diverged ⇒ 阻断。"""
    return {
        "target_snapshot": {"files": {"a.py": "hello"}},
        "current_workspace": {"files": {"a.py": "CHANGED"}},
        "policy": {"enabled": True},
    }


def test_revert_turn_gate_blocks_on_diverged(monkeypatch: Any) -> None:
    """闸不过 ⇒ 整批不动,一个都不回滚(绝不回滚一半)。"""
    led = TurnSnapshotLedger()
    tid = led.begin_turn("s1")
    led.record_snapshot(tid, "/a/x.py", "v1")
    led.record_snapshot(tid, "/b/y.py", "v2")
    called: list[str] = []

    def _spy(session_id: str, file_path: str, version_id: str | None = None,
             checkpoint_id: str | None = None) -> dict[str, Any]:
        called.append(version_id or "")
        return {"ok": True, "action": "restored", "version_id": version_id}

    monkeypatch.setattr("app.core.turn_snapshot.rollback_file", _spy)
    out = led.revert_turn(tid, consistency_inputs=_diverged_inputs())
    assert out["ok"] is False
    assert out["errorCode"] == "CONSISTENCY_GATE_BLOCKED"
    assert out["reverted"] == []
    assert out["failed"] == []
    assert out["gate"] is not None
    assert out["gate"]["verdict"] == "diverged"
    # 关键:闸不过 ⇒ rollback_file 一次都没被调
    assert called == []


def test_revert_turn_gate_passes_on_consistent(monkeypatch: Any) -> None:
    led = TurnSnapshotLedger()
    tid = led.begin_turn("s1")
    led.record_snapshot(tid, "/a/x.py", "v1")
    _patch_rollback(
        monkeypatch,
        {"v1": {"ok": True, "action": "restored", "path": "/a/x.py", "version_id": "v1"}},
    )
    out = led.revert_turn(tid, consistency_inputs=_consistent_inputs())
    assert out["ok"] is True
    assert len(out["reverted"]) == 1
    assert out["gate"]["verdict"] == "consistent"


def test_revert_turn_gate_unjudged_also_blocks(monkeypatch: Any) -> None:
    """取不到输入(policy 坏)⇒ unjudged ⇒ 阻断(§0.3 不记绿也不冒红)。"""
    led = TurnSnapshotLedger()
    tid = led.begin_turn("s1")
    led.record_snapshot(tid, "/a/x.py", "v1")
    called: list[str] = []

    def _spy(session_id: str, file_path: str, version_id: str | None = None,
             checkpoint_id: str | None = None) -> dict[str, Any]:
        called.append(version_id or "")
        return {"ok": True}

    monkeypatch.setattr("app.core.turn_snapshot.rollback_file", _spy)
    out = led.revert_turn(
        tid,
        consistency_inputs={"policy": {"enabled": False}},  # 策略关 ⇒ unjudged
    )
    assert out["ok"] is False
    assert out["errorCode"] == "CONSISTENCY_GATE_BLOCKED"
    assert out["gate"]["verdict"] == "unjudged"
    assert called == []  # 闸不过,一次都不回滚


def test_default_ledger_is_singleton() -> None:
    assert default_ledger() is default_ledger()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
