# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-649 —— entitlement 层失败走显式 fail-closed 投影(2026-10-01 立)。

票面验收镜像:「账号源抛错 ⇒ 快照含 entitled:false 且非账号 provider 仍可解析」。
坏状态取证(立项会话实测):一枚上游源抛错会**整块打断装配**(连 provider_caps
一起没),而快照里从不出现 `entitled:false`;且 board 初始 `snapshot is None`
在生产面是合法稳态 —— 生产者、消费者、账号源注册三者当时都只存在于测试。

成对判据(缺一不成立):
① 某源抛错 ⇒ 只为该源所辖 provider 合成 `entitled:false`,其余 provider 与
   其余层(provider_caps / 别的源)照常解析;
② 不抛 ⇒ 装配结果与**改动前那份实现(HEAD blob)**逐字同形 —— 这条必须拿
   "改动前的实现"当对照尺子,而不是拿"我以为没变的那份",否则顺手改坏装配
   在账面上是看不见的。
"""

from __future__ import annotations

import importlib.util
import inspect
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from app.core import provider_capability_snapshot as pcs
from app.core import provider_caps

REPO_ROOT = Path(__file__).resolve().parents[3]
HEAD_SNAPSHOT_PATH = "apps/ai-service/app/core/provider_capability_snapshot.py"
# 对照基线的**出处**,不是 HEAD。G-649 已经入库(`5cf78e1a0c`),所以"HEAD 就是改动前
# 那份"这个前提在入库那一刻起就失效了 —— 拿 HEAD 当基线,判据量的是"新版 vs 新版",
# 一条空转的同形比对却长得像通过(本仓把这条写成规矩:阳性对照钉出处不钉 HEAD)。
# `^` 取的是那枚落地提交的父版本 = 改动前的真身。
BASELINE_REF = "5cf78e1a0c^"
GIT_BIN = shutil.which("git")


@pytest.fixture(autouse=True)
def _isolate_snapshot_state(monkeypatch):
    """用例间隔离:源表/作用域表/pending/两组计数全部换成干净的空面。

    `_SOURCE_PROVIDERS` 与 `_EXTRA_SOURCES` 必须**一起**换 —— 只换一边会留下
    "有作用域无源"或"有源无作用域"的第三种状态,而 fail-closed 恰好读它。
    """
    monkeypatch.setattr(pcs, "_EXTRA_SOURCES", {})
    monkeypatch.setattr(pcs, "_SOURCE_PROVIDERS", {})
    monkeypatch.setattr(pcs, "_PENDING_UPDATES", {})
    monkeypatch.setattr(pcs, "_LAST_READ_DEGRADED", {})
    monkeypatch.setattr(pcs, "FENCE_STATS", {"published": 0, "superseded": 0})
    monkeypatch.setattr(pcs, "DEGRADED_STATS", {"reads": 0, "sources": 0, "providers": 0})
    monkeypatch.delenv(pcs.SNAPSHOT_FENCE_ENABLED_ENV, raising=False)
    yield


def _make_board() -> pcs.ProviderCapabilitySnapshotBoard:
    return pcs.ProviderCapabilitySnapshotBoard(name="g649-test")


def _canon(payload: Any) -> str:
    """规范化序列化(判"逐字同形"用的唯一口径:键序/分隔符/非 ASCII 全钉死)。"""
    return json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


# ---------------------------------------------------------------------------
# 判据 ①:某源抛错 ⇒ 该 provider entitled:false,其余照常解析
# ---------------------------------------------------------------------------


def test_failing_source_synthesizes_entitled_false_only_for_its_providers():
    def _boom() -> dict[str, Any]:
        raise RuntimeError("账号解析失败")

    pcs.register_upstream_source("accounts_broken", _boom, providers=("openrouter",))
    pcs.register_upstream_source(
        "probe_ok", lambda: {"nvidia_nim": {"rtt_ms": 12}}, providers=("nvidia_nim",)
    )

    board = _make_board()
    outcome = board.publish_round(board.solve_round_sync())
    assert outcome["status"] == "published", outcome  # 坏源不再打断装配

    snapshot = board.snapshot
    assert snapshot is not None
    entitlements = snapshot["entitlements"]
    # —— 该源所辖 provider 被显式判"无权限" ——
    assert entitlements["openrouter"][pcs.ENTITLEMENT_FAIL_CLOSED_KEY] is False
    # —— 非账号 provider 仍可解析:没被牵连、不带标记 ——
    assert pcs.ENTITLEMENT_FAIL_CLOSED_KEY not in entitlements.get("nvidia_nim", {})
    # —— 其余层照常装配 ——
    assert set(snapshot["provider_caps"]) == set(provider_caps.PROVIDER_CAPS)
    assert snapshot["probe_ok"] == {"nvidia_nim": {"rtt_ms": 12}}
    # —— 坏源槽位留结构化标记,且不带异常原文(免把 env 值一型带进快照) ——
    assert snapshot["accounts_broken"] == {
        "degraded": True,
        "error_type": "RuntimeError",
        "governed_providers": ["openrouter"],
    }
    # —— 计数与对账面(读侧累计;本轮至少读源三遍) ——
    assert pcs.degraded_stats()["sources"] >= 1
    assert pcs.last_read_degraded() == {"accounts_broken": ("openrouter",)}


def test_unscoped_failing_source_degrades_without_guessing_providers():
    """未声明作用域的源抛错 ⇒ 只记 degraded,不猜它管谁(绝不牵连任何 provider)。"""

    def _boom() -> dict[str, Any]:
        raise ValueError("探测结果缓存读不到")

    pcs.register_upstream_source("probe_unknown", _boom)
    board = _make_board()
    assert board.publish_round(board.solve_round_sync())["status"] == "published"
    view = board.snapshot
    assert view is not None
    assert view is not None
    assert view["probe_unknown"]["degraded"] is True
    assert view["probe_unknown"]["governed_providers"] == []
    assert pcs.ENTITLEMENT_FAIL_CLOSED_KEY not in json.dumps(view, ensure_ascii=False)
    assert pcs.last_read_degraded() == {"probe_unknown": ()}


def test_all_governed_sentinel_covers_current_capability_table():
    """哨兵作用域按**当次**能力表现读,不落地成第二份会腐烂的名单。"""

    def _boom() -> dict[str, Any]:
        raise RuntimeError("账号解析失败")

    pcs.register_upstream_source(
        "accounts_broken", _boom, providers=pcs.ALL_GOVERNED_PROVIDERS
    )
    board = _make_board()
    board.publish_round(board.solve_round_sync())
    snapshot = board.snapshot
    assert snapshot is not None
    marked = {
        code
        for code, ent in snapshot["entitlements"].items()
        if isinstance(ent, dict) and ent.get(pcs.ENTITLEMENT_FAIL_CLOSED_KEY) is False
    }
    assert marked == set(provider_caps.PROVIDER_CAPS)


def test_failing_source_does_not_break_fingerprint_capture_or_round():
    """坏源存在时,指纹复读与轮次仍成立(不抛 ⇒ 栅栏照判,而不是整链崩)。"""

    def _boom() -> dict[str, Any]:
        raise RuntimeError("账号解析失败")

    pcs.register_upstream_source("accounts_broken", _boom, providers=("openrouter",))
    fp_before = pcs.capture_upstream_fingerprint()
    assert isinstance(fp_before, str) and len(fp_before) == 64

    board = _make_board()
    round_obj = board.solve_round_sync()
    # 源稳定(同样地坏)⇒ 复读同值 ⇒ 本轮可发布;坏不是弃轮的理由,漂移才是。
    assert board.publish_round(round_obj)["status"] == "published"

    # 反向对照:坏源被摘掉 = 上游版本变了 ⇒ 该轮必弃(栅栏未被削弱)
    stale = board.solve_round_sync()
    pcs.unregister_upstream_source("accounts_broken")
    assert board.publish_round(board.solve_round_sync())["status"] == "published"
    assert board.publish_round(stale)["status"] == "superseded"


# ---------------------------------------------------------------------------
# 消费端三态(不得把"无从判"折成"有权限")
# ---------------------------------------------------------------------------


def test_is_provider_entitled_three_states_do_not_merge(monkeypatch):
    # 无快照 ⇒ None(未判定),绝不冒 True;默认 board 换新的,免得被同 worker 的
    # 前一个文件播过种 ⇒ 把"无从判"这一态测成"已有快照"。
    monkeypatch.setattr(pcs, "_DEFAULT_BOARD", None)
    assert provider_caps.get_published_capability_snapshot() is None
    assert provider_caps.is_provider_entitled("openrouter") is None

    def _boom() -> dict[str, Any]:
        raise RuntimeError("账号解析失败")

    pcs.register_upstream_source("accounts_broken", _boom, providers=("openrouter",))
    board = _make_board()
    board.publish_round(board.solve_round_sync())
    # 本用例用的是私有 board,默认 board 仍无快照 ⇒ 消费口读到 None = 无从判
    assert provider_caps.is_provider_entitled("openrouter") is None

    pcs.seed_uninitialized()  # 播种默认 board(此时坏源仍在册)
    assert provider_caps.is_provider_entitled("openrouter") is False
    assert provider_caps.is_provider_entitled("nvidia_nim") is True
    assert "openrouter" in provider_caps.not_entitled_provider_codes()
    # 未知 provider 也不得被折成"有权限之外的第三种东西":快照里没有它 = 未标记
    assert provider_caps.is_provider_entitled("no_such_provider_xyz") is True



def test_clean_snapshot_marks_nothing_as_not_entitled():
    """正常装配不写 `entitled` 键 —— 键只由失败分支合成(不写 ≠ 有权限的逆否)。"""
    board = _make_board()
    board.publish_round(board.solve_round_sync())
    view = board.snapshot
    assert view is not None
    assert pcs.ENTITLEMENT_FAIL_CLOSED_KEY not in _canon(view["entitlements"])
    assert pcs.degraded_stats() == {"reads": 0, "sources": 0, "providers": 0}


# ---------------------------------------------------------------------------
# 播种:uninitialized 不再是稳态,且栅栏一字不绕
# ---------------------------------------------------------------------------


def test_seed_uninitialized_publishes_once_and_is_idempotent():
    board = _make_board()
    assert board.snapshot is None
    outcome = pcs.seed_uninitialized(board)
    assert outcome["status"] == "published"
    assert board.snapshot is not None
    assert board.generation == 1

    again = pcs.seed_uninitialized(board)
    assert again["status"] == "already_seeded"
    assert board.generation == 1  # 幂等:播种不是周期性重装配


def test_seed_uninitialized_does_not_bypass_the_fence():
    """有 pending 的上游更新时,播种轮仍被整份丢弃 —— 不得为了"有快照"绕栅栏。"""
    board = _make_board()
    pcs.mark_pending_update("u-boot", reason="config hot-reload in flight")
    outcome = pcs.seed_uninitialized(board)
    assert outcome["status"] == "superseded"
    assert board.snapshot is None
    assert pcs.FENCE_STATS["superseded"] == 1

    pcs.clear_pending_update("u-boot")
    assert pcs.seed_uninitialized(board)["status"] == "published"
    assert board.snapshot is not None


# ---------------------------------------------------------------------------
# 账号源自身:确定性 + 不吞异常
# ---------------------------------------------------------------------------


def test_account_source_is_deterministic_and_value_free():
    """账号源两次读取逐字同形(否则每一轮都会被自己的指纹弃掉),且不含凭据值。"""
    first = _canon(pcs.read_provider_accounts())
    second = _canon(pcs.read_provider_accounts())
    assert first == second
    assert set(json.loads(first)) == set(provider_caps.PROVIDER_CAPS)
    for entry in json.loads(first).values():
        assert set(entry) == {"status", "resolved"}
        assert entry["status"] in {"configured", "not_configured", "local"}


def test_register_account_source_declares_full_scope():
    name = pcs.register_account_source()
    assert name == pcs.ACCOUNT_SOURCE_NAME
    # 存的是哨兵(不是某一次现读的名单)—— 名单会腐烂,哨兵不会
    assert pcs._SOURCE_PROVIDERS[name] == pcs.ALL_GOVERNED_PROVIDERS
    assert pcs.source_provider_scope(name) == tuple(sorted(provider_caps.PROVIDER_CAPS))
    # 未注册的源没有作用域:解析成空集,而不是"全部"
    assert pcs.source_provider_scope("no_such_source_xyz") == ()


def test_bare_string_provider_scope_is_rejected_not_guessed():
    """providers 传裸字符串必须当场抛 —— 静默逐字符展开 = fail-closed 管错对象。"""
    with pytest.raises(TypeError, match="ALL_GOVERNED_PROVIDERS"):
        pcs.register_upstream_source("bad_scope", lambda: {}, providers="openrouter")
    # 反向对照:同一名按序列写法注册必须成功,且作用域就是那一个 provider
    pcs.register_upstream_source("bad_scope", lambda: {}, providers=("openrouter",))
    assert pcs.source_provider_scope("bad_scope") == ("openrouter",)




# ---------------------------------------------------------------------------
# 判据 ②:不抛 ⇒ 与「改动前那份实现(按出处 `BASELINE_REF` 锚定,不是 HEAD)」逐字同形
# ---------------------------------------------------------------------------


def _load_head_implementation(tmp_path: Path):
    """从**出处**取改动前那份实现,原样落临时文件后 import(对照尺子必须是旧实现本身)。

    锚点换过(见文件头 `BASELINE_REF` 那条):此前取的是 `HEAD:<path>`,而 G-649 一入库,
    HEAD 就同时是"改动前"与"改动后"两份里的后者 —— 同形判据于是量的是新版对自己,
    恒真、恒绿、恒空转。下面那道 `not hasattr(...ENTITLEMENT_FAIL_CLOSED_KEY)` 的护栏
    正是为了在这种情况下喊红,它喊到了(2026-10-08 实测:`AssertionError: 对照模块里已有
    G-649 常量`),所以本文件从来没有把这件事读成绿 —— 红的是锚点,不是产品。
    """
    proc = subprocess.run(
        [GIT_BIN, "-C", str(REPO_ROOT), "show", f"{BASELINE_REF}:{HEAD_SNAPSHOT_PATH}"],
        # 本机(node/WorkBuddy 宿主 + Windows)派生 git 不显式接管 stdio 会稳定 EBUSY
        # (AGENTS §12g:成组对照 30 组实测,不写 stdio 0/30 成功)。三档写死:
        # stdin=DEVNULL + capture_output(等价于 stdout/stderr 显式 PIPE)。
        stdin=subprocess.DEVNULL,
        capture_output=True,
        creationflags=(0x08000000 if sys.platform == "win32" else 0),
    )
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    # 两道"取到的确实是那份源码"的对账(不是 `git show <path>` 打出的 commit 正文,
    # 也不是被并发会话推进后的"新版"):结构位 + 本票新增常量必须缺席。
    assert b"class ProviderCapabilitySnapshotBoard" in proc.stdout, "取回的不是那份模块源码"
    target = tmp_path / "provider_capability_snapshot_head_g649.py"
    target.write_bytes(proc.stdout)
    spec = importlib.util.spec_from_file_location("pcs_head_g649", str(target))
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    assert not hasattr(module, "ENTITLEMENT_FAIL_CLOSED_KEY"), (
        "对照模块里已有 G-649 常量 ⇒ 取到的不是改动前那份,同形判据为空转"
    )
    return module


@pytest.mark.skipif(GIT_BIN is None, reason="本机 PATH 取不到 git ⇒ 旧实现对照无从跑(未判定)")
def test_clean_assembly_is_byte_identical_to_head_implementation(tmp_path: Path):
    head = _load_head_implementation(tmp_path)
    try:
        # 两边都在"无额外源"的空面上读(fixture 已把新实现的源表换成空 dict;
        # 旧实现那份模块的源表本来就是空的)。
        assert _canon(head.read_upstream_sources()) == _canon(pcs.read_upstream_sources())
        assert _canon(head.default_payload_builder()) == _canon(pcs.default_payload_builder())
        assert head.capture_upstream_fingerprint() == pcs.capture_upstream_fingerprint()

        # 判据有牙的对照:同样一枚坏源,旧实现整块打断装配(抛穿),新实现产出
        # entitled:false —— 少了这一条,"逐字同形"就只证明了"没改坏",没证明"改对了"。
        def _boom() -> dict[str, Any]:
            raise RuntimeError("账号解析失败")

        # 旧实现根本没有 providers 作用域这一维(注册签名只有两参),坏源只能整块打断。
        head.register_upstream_source("accounts_broken", _boom)
        pcs.register_upstream_source("accounts_broken", _boom, providers=("openrouter",))
        with pytest.raises(RuntimeError):
            head.read_upstream_sources()  # 改动前的真实行为(阳性对照)
        degraded_new = _canon(pcs.read_upstream_sources())
        assert f'"{pcs.ENTITLEMENT_FAIL_CLOSED_KEY}":false' in degraded_new
    finally:
        sys.modules.pop("pcs_head_g649", None)


# ---------------------------------------------------------------------------
# 生产接线自证(lifespan 里那一行 + 进程内 import 后播种)
# ---------------------------------------------------------------------------


def test_lifespan_wires_the_seeder():
    """装车证明:lifespan 源码里必须真有那一次调用(判据在有人跑它时才成立)。"""
    from app import main

    body = inspect.getsource(main.lifespan)
    assert "seed_provider_capability_snapshot()" in body


def test_production_seeder_seeds_default_board_and_reads_it(monkeypatch):
    """进程内播种 ⇒ 默认 board 非 None,且消费口读到它;坏账号源 ⇒ 消费口判 False。"""
    from app import main

    monkeypatch.setattr(pcs, "_DEFAULT_BOARD", None)
    outcome = main.seed_provider_capability_snapshot()
    assert outcome["seeded"] is True
    assert provider_caps.get_published_capability_snapshot() is not None
    # 生产注册的账号源在作用域上管全部 provider
    assert pcs.source_provider_scope(pcs.ACCOUNT_SOURCE_NAME) == tuple(
        sorted(provider_caps.PROVIDER_CAPS)
    )
    assert provider_caps.is_provider_entitled("openai") is True
    assert provider_caps.not_entitled_provider_codes() == ()

    # 反向对照:账号源真崩时,生产播种仍要落地(其余层可用),并把全部 provider
    # 投影成无权限 —— 这正是"不得静默当有权限"。
    def _explode() -> dict[str, Any]:
        raise RuntimeError("账号解析失败")

    monkeypatch.setattr(pcs, "read_provider_accounts", _explode)
    monkeypatch.setattr(pcs, "_DEFAULT_BOARD", None)
    broken = main.seed_provider_capability_snapshot()
    assert broken["seeded"] is True
    assert set(broken["not_entitled"]) == set(provider_caps.PROVIDER_CAPS)
    assert provider_caps.is_provider_entitled("openai") is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
