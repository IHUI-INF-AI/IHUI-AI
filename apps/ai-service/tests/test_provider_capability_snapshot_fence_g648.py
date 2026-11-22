# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""G-648 —— 供应商能力/entitlement 快照发布前复读栅栏行为测试。

票面验收镜像:注入式「改中间面 ⇒ 本轮必弃」—— 解算启动后、发布前上游源被
改动(版本指纹变了)或仍有 pending 的上游更新 ⇒ 本轮解算整份丢弃
(superseded 标记 + 计数),快照保持旧值,绝不"先发布再修正"。
"""

import asyncio
from dataclasses import replace

import pytest

from app.core import provider_capability_snapshot as pcs
from app.core import provider_caps


@pytest.fixture(autouse=True)
def _isolate_fence_state(monkeypatch):
    """用例间隔离:清空额外源/pending 台账,栅栏恢复默认开,计数归零。"""
    monkeypatch.setattr(pcs, "_EXTRA_SOURCES", {})
    monkeypatch.setattr(pcs, "_PENDING_UPDATES", {})
    monkeypatch.delenv(pcs.SNAPSHOT_FENCE_ENABLED_ENV, raising=False)
    monkeypatch.setattr(pcs, "FENCE_STATS", {"published": 0, "superseded": 0})
    yield


def _make_board() -> pcs.ProviderCapabilitySnapshotBoard:
    return pcs.ProviderCapabilitySnapshotBoard(name="g648-test")


# ---------------------------------------------------------------------------
# 基线:上游没动 ⇒ 正常发布
# ---------------------------------------------------------------------------


def test_publish_round_clean_source_publishes_whole_snapshot():
    board = _make_board()
    round = board.solve_round_sync()
    outcome = board.publish_round(round)

    assert outcome["status"] == "published"
    assert board.snapshot is not None
    assert board.snapshot["provider_caps"]["openai"]["supports_stream_usage"] is True
    assert pcs.FENCE_STATS["published"] == 1
    assert pcs.FENCE_STATS["superseded"] == 0


def test_async_solve_round_publishes():
    async def _run():
        board = _make_board()
        outcome = await board.refresh()
        return board, outcome

    board, outcome = asyncio.run(_run())
    assert outcome["status"] == "published"
    assert board.snapshot["entitlements"] == pcs.read_entitlements()


# ---------------------------------------------------------------------------
# 验收镜像(注入式):改中间面 ⇒ 本轮必弃
# ---------------------------------------------------------------------------


def test_midround_extra_source_injection_supersedes_round():
    """解算启动后注入新上游源(改中间面)⇒ 本轮整份丢弃,快照保持旧值。"""
    board = _make_board()
    round_v1 = board.solve_round_sync()
    assert board.publish_round(round_v1)["status"] == "published"
    old_snapshot = board.snapshot

    round_v2 = board.solve_round_sync()
    # —— 注入点:解算启动之后、发布之前,上游面被改 ——
    pcs.register_upstream_source("probe_results", lambda: {"gpt-x": {"context": 4096}})
    outcome = board.publish_round(round_v2)

    assert outcome["status"] == "superseded"
    assert any("upstream_version_changed" in r for r in outcome["reasons"])
    assert outcome["generation"] == 1  # 弃轮不推进代数
    assert board.snapshot is old_snapshot  # 快照保持旧值(同一份,未被覆盖)
    assert pcs.FENCE_STATS["superseded"] == 1
    assert pcs.FENCE_STATS["published"] == 1


def test_midround_caps_mutation_supersedes_round():
    """解算启动后静态能力表被改 ⇒ 本轮必弃(指纹面覆盖 PROVIDER_CAPS)。"""
    board = _make_board()
    round = board.solve_round_sync()

    provider_caps.PROVIDER_CAPS["openai"] = replace(
        provider_caps.PROVIDER_CAPS["openai"], supports_vision=False
    )
    try:
        outcome = board.publish_round(round)
    finally:
        provider_caps.PROVIDER_CAPS["openai"] = replace(
            provider_caps.PROVIDER_CAPS["openai"], supports_vision=True
        )

    assert outcome["status"] == "superseded"
    assert board.snapshot is None  # 首轮即弃 ⇒ 快照从未被写入
    assert pcs.FENCE_STATS["superseded"] == 1


def test_midround_entitlement_env_change_supersedes_round():
    """解算启动后 entitlement env(凭据可用性)被改 ⇒ 本轮必弃。"""
    import os

    board = _make_board()
    round = board.solve_round_sync()

    os.environ["OPENROUTER_HTTP_REFERER"] = "https://midround.example"
    try:
        outcome = board.publish_round(round)
    finally:
        os.environ.pop("OPENROUTER_HTTP_REFERER", None)

    assert outcome["status"] == "superseded"
    assert pcs.FENCE_STATS["superseded"] == 1
    assert board.snapshot is None


def test_pending_update_blocks_publish_and_clear_unblocks():
    """仍有 pending 的上游更新 ⇒ 弃;落定(clear)后新轮可正常发布。"""
    board = _make_board()
    round = board.solve_round_sync()

    pcs.mark_pending_update("u1", reason="config hot-reload in flight")
    outcome = board.publish_round(round)
    assert outcome["status"] == "superseded"
    assert any("pending_updates_remaining" in r for r in outcome["reasons"])
    assert board.snapshot is None

    pcs.clear_pending_update("u1")
    outcome2 = board.publish_round(board.solve_round_sync())
    assert outcome2["status"] == "published"
    assert board.snapshot is not None
    assert pcs.FENCE_STATS == {"published": 1, "superseded": 1}


# ---------------------------------------------------------------------------
# 栅栏门控(门控类,默认开;关闭仅排障,留痕退回 legacy)
# ---------------------------------------------------------------------------


def test_fence_disabled_falls_back_to_legacy_publish(monkeypatch):
    monkeypatch.setenv(pcs.SNAPSHOT_FENCE_ENABLED_ENV, "false")
    board = _make_board()
    round = board.solve_round_sync()
    pcs.register_upstream_source("probe_results", lambda: {"late": True})

    outcome = board.publish_round(round)  # legacy:不检查,直接发布
    assert outcome["status"] == "published"
    assert pcs.FENCE_STATS["published"] == 1


def test_fence_enabled_by_default():
    assert pcs.fence_enabled() is True
    assert pcs.fence_enabled({"PROVIDER_CAP_SNAPSHOT_FENCE_ENABLED": "true"}) is True
    assert pcs.fence_enabled({"PROVIDER_CAP_SNAPSHOT_FENCE_ENABLED": "0"}) is False
    assert pcs.fence_enabled({"PROVIDER_CAP_SNAPSHOT_FENCE_ENABLED": "off"}) is False


# ---------------------------------------------------------------------------
# 指纹与消费口
# ---------------------------------------------------------------------------


def test_fingerprint_stable_and_sensitive():
    fp1 = pcs.capture_upstream_fingerprint()
    fp2 = pcs.capture_upstream_fingerprint()
    assert fp1 == fp2  # 上游没动 ⇒ 指纹稳定

    mutated = dict(pcs.read_upstream_sources())
    mutated["provider_caps"] = dict(mutated["provider_caps"])
    mutated["provider_caps"]["openai"] = {"supports_tools": False}
    env_changed_fp = pcs.capture_upstream_fingerprint(
        {"OPENROUTER_HTTP_REFERER": "https://x.example"}
    )
    assert env_changed_fp != fp1
    assert mutated["provider_caps"]["openai"] != pcs.read_upstream_sources()[
        "provider_caps"
    ]["openai"]


def test_get_published_capability_snapshot_wiring():
    # G-649(2026-10-01)改断言:原样「未发布过 ⇒ None」把 None 钉成了契约,而
    # None 恰恰是本票要拆掉的病灶 —— "未初始化"只能是"还没播种"这一次,不能是
    # 生产稳态。播种出口(seed_uninitialized)必须让消费口拿到可判的快照。
    board = pcs.get_snapshot_board()
    outcome = pcs.seed_uninitialized(board)
    assert outcome["status"] in ("published", "already_seeded")
    assert board.snapshot is not None

    snapshot = provider_caps.get_published_capability_snapshot()
    assert snapshot is not None
    assert set(snapshot["provider_caps"]) == set(provider_caps.PROVIDER_CAPS)

    # 第二次播种是幂等空操作:不重播、不推进代数(否则"播种"会变成周期性重装配)
    generation_before = board.generation
    assert pcs.seed_uninitialized(board)["status"] == "already_seeded"
    assert board.generation == generation_before
