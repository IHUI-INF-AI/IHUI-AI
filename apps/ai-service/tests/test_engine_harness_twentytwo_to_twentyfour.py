# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""第二十二~二十四批测试:file_watcher / message_history / feature_flags。"""

from __future__ import annotations

import asyncio
import json
import threading
import time
from pathlib import Path

import pytest

from app.core.feature_flags import (
    FeatureRegistry,
    FeatureSpec,
    env_key_for,
)
from app.core.file_watcher import (
    DebouncedWatchReceiver,
    FileWatcherEvent,
    FileWatcherRouter,
    Receiver,
    ThrottledWatchReceiver,
)
from app.core.message_history import (
    append_batch,
    append_history,
    iter_history,
    purge_history,
    read_recent,
)

# =============================================================================
# 第二十二批 file_watcher
# =============================================================================


@pytest.mark.asyncio
async def test_receiver_detects_create_modify_delete(tmp_path):
    """粗粒度事件:监听目录时,事件路径为目录本身(codex 粗粒度语义)。"""

    def _hit(event: FileWatcherEvent | None) -> bool:
        if event is None:
            return False
        return any(
            p == str(tmp_path) or p.endswith("a.txt") for p in event.paths
        )

    rx = Receiver([tmp_path], poll_interval=0.02)
    await rx.start()
    try:
        assert rx.poll() is None  # 初次扫描无变更
        f = tmp_path / "a.txt"
        f.write_text("x", encoding="utf-8")
        deadline = time.monotonic() + 3
        seen_create = False
        while time.monotonic() < deadline and not seen_create:
            event = await asyncio.wait_for(rx.recv(), timeout=0.5)
            seen_create = _hit(event)
        assert seen_create
        # 修改
        f.write_text("y" * 20, encoding="utf-8")
        deadline = time.monotonic() + 3
        seen_modify = False
        while time.monotonic() < deadline and not seen_modify:
            event = await asyncio.wait_for(rx.recv(), timeout=0.5)
            seen_modify = _hit(event)
        assert seen_modify
        # 删除
        f.unlink()
        deadline = time.monotonic() + 3
        seen_delete = False
        while time.monotonic() < deadline and not seen_delete:
            event = await asyncio.wait_for(rx.recv(), timeout=0.5)
            seen_delete = _hit(event)
        assert seen_delete
    finally:
        await rx.close()
    assert await rx.recv() is None  # 关闭后 recv 返回 None


@pytest.mark.asyncio
async def test_throttled_receiver_enforces_min_interval(tmp_path):
    """限流:首个事件后,间隔未到前的产出被推迟。"""
    rx = Receiver([tmp_path], poll_interval=0.01)
    await rx.start()
    try:
        await asyncio.sleep(0.1)  # 让基线扫描落地
        (tmp_path / "f.txt").write_text("2", encoding="utf-8")
        throttled = ThrottledWatchReceiver(rx, interval=0.2)
        start = time.monotonic()
        first = await asyncio.wait_for(throttled.recv(), timeout=2)
        took = time.monotonic() - start
        assert first is not None
        assert took < 0.15  # 首个事件立即产出
        (tmp_path / "f.txt").write_text("3", encoding="utf-8")
        start = time.monotonic()
        second = await asyncio.wait_for(throttled.recv(), timeout=3)
        took = time.monotonic() - start
        assert second is not None
        assert took >= 0.15  # 第二次被限流推迟到间隔之后
    finally:
        await rx.close()


@pytest.mark.asyncio
async def test_debounced_receiver_coalesces_paths(tmp_path):
    """防抖:窗口内多个事件路径合并成一批。"""
    rx = Receiver([b_file := tmp_path / "b.txt", c_file := tmp_path / "c.txt"], poll_interval=0.01)
    await rx.start()
    try:
        await asyncio.sleep(0.1)  # 让基线扫描落地
        debounced = DebouncedWatchReceiver(rx, interval=0.15)
        b_file.write_text("1", encoding="utf-8")
        c_file.write_text("1", encoding="utf-8")

        async def pump():
            batch = await asyncio.wait_for(debounced.recv(), timeout=3)
            assert batch is not None
            names = {Path(p).name for p in batch.paths}
            assert {"b.txt", "c.txt"} <= names

        await asyncio.wait_for(pump(), timeout=4)
    finally:
        await rx.close()


def test_router_dispatches_to_matching_subscriptions(tmp_path):
    """路由:只把命中订阅路径的事件投递给对应订阅方。"""
    router = FileWatcherRouter()
    sub_a = router.subscribe([tmp_path / "a"])
    sub_b = router.subscribe([tmp_path / "b"])
    hit = FileWatcherEvent(paths=(str(tmp_path / "a" / "x.txt"),))
    assert router.dispatch(hit) == 1
    assert sub_a.queue.qsize() == 1
    assert sub_b.queue.qsize() == 0
    miss = FileWatcherEvent(paths=(str(tmp_path / "z" / "y.txt"),))
    assert router.dispatch(miss) == 0
    router.unsubscribe(sub_a)
    assert router.dispatch(hit) == 0


@pytest.mark.asyncio
async def test_receiver_add_remove_watch(tmp_path):
    rx = Receiver([], poll_interval=0.01)
    f = tmp_path / "late.txt"
    f.write_text("x", encoding="utf-8")
    rx.poll()
    rx.remove_watch(f)
    rx.add_watch(f)
    f.write_text("changed", encoding="utf-8")
    deadline = time.monotonic() + 2
    seen = False
    while time.monotonic() < deadline and not seen:
        event = rx.poll()
        seen = event is not None
    assert seen


# =============================================================================
# 第二十三批 message_history
# =============================================================================


def test_history_append_and_read_roundtrip(tmp_path):
    path = tmp_path / "history.jsonl"
    append_history(path, "s1", "第一条", ts=100.0)
    append_history(path, "s2", "第二条", ts=200.0)
    records = list(iter_history(path))
    assert [r["session_id"] for r in records] == ["s1", "s2"]
    assert records[0]["text"] == "第一条" and records[0]["ts"] == 100.0
    recent = read_recent(path, limit=1)
    assert len(recent) == 1 and recent[0]["session_id"] == "s2"


def test_history_batch_append_atomic_group(tmp_path):
    path = tmp_path / "history.jsonl"
    out = append_batch(path, [("s1", "a", None), ("s2", "b", None), ("s3", "c", None)])
    assert len(out) == 3
    lines = path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 3
    for line, expect in zip(lines, ["a", "b", "c"], strict=True):
        assert json.loads(line)["text"] == expect


def test_history_concurrent_processes_no_interleaving(tmp_path):
    """多线程并发追加(模拟多进程):每行都是完整 JSON,无交错损坏。"""
    path = tmp_path / "history.jsonl"
    errors: list[str] = []

    def worker(tag: str) -> None:
        try:
            for i in range(20):
                append_history(path, f"{tag}", f"{tag}-line-{i}" * 5)
        except Exception as e:  # noqa: BLE001
            errors.append(str(e))

    threads = [threading.Thread(target=worker, args=(f"w{n}",)) for n in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors
    records = list(iter_history(path))
    assert len(records) == 80
    assert all(isinstance(r["text"], str) and r["text"] for r in records)


def test_history_corrupt_lines_skipped(tmp_path):
    path = tmp_path / "history.jsonl"
    append_history(path, "s1", "good1", ts=1.0)
    with open(path, "a", encoding="utf-8") as fd:
        fd.write("这不是 JSON\n")
    append_history(path, "s2", "good2", ts=2.0)
    records = list(iter_history(path))
    assert [r["text"] for r in records] == ["good1", "good2"]
    with pytest.raises(json.JSONDecodeError):
        list(iter_history(path, skip_corrupt=False))


def test_history_purge(tmp_path):
    path = tmp_path / "history.jsonl"
    assert purge_history(path) is False  # 不存在
    append_history(path, "s", "x")
    assert purge_history(path) is True
    assert list(iter_history(path)) == []


def test_history_default_path_uses_ihui_home():
    from app.core.message_history import DEFAULT_HISTORY_PATH

    assert DEFAULT_HISTORY_PATH.name == "history.jsonl"


# =============================================================================
# 第二十四批 feature_flags
# =============================================================================


def _registry() -> FeatureRegistry:
    reg = FeatureRegistry()
    reg.register(FeatureSpec("cost_ledger", "stable", True, "成本账本"))
    reg.register(
        FeatureSpec(
            "voice_input",
            "experimental",
            False,
            "语音输入",
            experimental_menu_name="语音输入",
            experimental_menu_description="对话支持语音",
            experimental_announcement="实验功能:语音输入上线",
        )
    )
    reg.register(FeatureSpec("internal_cache_v2", "dev", False, "缓存 v2"))
    return reg


def test_feature_defaults():
    reg = _registry()
    resolved = reg.resolve_features(overrides={}, env={})
    assert resolved == {"cost_ledger": True, "voice_input": False, "internal_cache_v2": False}


def test_feature_precedence_overrides_then_env():
    reg = _registry()
    # 配置覆盖默认值,环境变量再覆盖配置(后写优先)
    resolved = reg.resolve_features(
        {"voice_input": True},
        env={env_key_for("voice_input"): "0", env_key_for("cost_ledger"): "0"},
    )
    assert resolved["voice_input"] is False
    assert resolved["cost_ledger"] is False


def test_feature_legacy_alias_mapping():
    reg = _registry()
    reg.register(
        FeatureSpec("voice_input_v2", "experimental", False, "语音输入 v2",
                    experimental_menu_name="语音输入 v2"),
        legacy_keys=("voice", "voiceInput"),
    )
    resolved = reg.resolve_features({"voice": True}, env={})
    assert resolved["voice_input_v2"] is True


def test_feature_unknown_override_raises_with_candidates():
    reg = _registry()
    with pytest.raises(ValueError, match="未知特性覆盖"):
        reg.resolve_features({"nonexistent_feature": True}, env={})
    with pytest.raises(ValueError, match="未注册特性"):
        reg.resolve_features({}, env={"IHUI_FEATURE_GHOST": "1"})


def test_feature_invalid_env_value_raises():
    reg = _registry()
    with pytest.raises(ValueError, match="取值非法"):
        reg.resolve_features({}, env={env_key_for("cost_ledger"): "maybe"})


def test_feature_experimental_requires_menu_name():
    with pytest.raises(ValueError, match="experimental_menu_name"):
        FeatureRegistry().register(
            FeatureSpec("bad", "experimental", False, "缺菜单名")
        )


def test_feature_duplicate_registration_rejected():
    reg = _registry()
    with pytest.raises(ValueError, match="重复注册"):
        reg.register(FeatureSpec("cost_ledger", "stable", True))


def test_feature_by_stage_and_keys():
    reg = _registry()
    assert [s.key for s in reg.by_stage("experimental")] == ["voice_input"]
    assert reg.keys() == ["cost_ledger", "internal_cache_v2", "voice_input"]


def test_feature_include_disabled_filter():
    reg = _registry()
    enabled_only = reg.resolve_features(
        {"voice_input": True}, env={env_key_for("cost_ledger"): "0"}, include_disabled=False
    )
    assert enabled_only == {"voice_input": True}
