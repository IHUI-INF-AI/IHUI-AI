# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""号池成员健康 gauge 族测试(llm_metrics 池健康区 + combo_router 发布链)。

判据纪律(§22c):所有档位常量/上限/封闭档集合一律 import 源模块现读,
测试不复制第二份。每条新档都有"命中"与"不命中"成对夹具,并各有一条
变异自证:摘掉采样更新/发布更新后,对应档读不到值(序列缺失≠0)。
"""

from __future__ import annotations

import pytest
from prometheus_client import REGISTRY

from app.middleware import llm_metrics
from app.middleware.llm_metrics import (
    POOL_LEG_LABEL_MAX_LEN,
    POOL_QUOTA_STATE_NO_EVIDENCE,
    POOL_QUOTA_STATE_OK,
    POOL_QUOTA_STATE_SUSPECT,
    PoolLegHealth,
    normalize_pool_leg,
    record_llm_outcome,
    set_pool_leg_health,
)
from app.services import combo_router as combo_router_module
from app.services.combo_router import ComboRouter


def _read(name: str, leg: str) -> float | None:
    """读 gauge 当前值;序列不存在返回 None(与值 0 严格区分,不做 `or 0.0`)。"""
    return REGISTRY.get_sample_value(name, {'leg': leg})


@pytest.fixture()
def isolated_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    """隔离腿登记池/采样窗口/已发布集,防跨用例全局状态串扰(不还原 gauge)。"""
    monkeypatch.setattr(llm_metrics, '_known_pool_legs', set())
    monkeypatch.setattr(llm_metrics, '_pool_leg_outcomes', {})
    monkeypatch.setattr(llm_metrics, '_published_pool_health_legs', set())
    # 采样测试不需要冷却快照刷新,摘掉节流腿保证断言只盯采样档本身
    monkeypatch.setattr(llm_metrics, '_refresh_pool_health_metric', lambda: None)


# =============================================================================
# normalize_pool_leg:清洗规则(命中/不命中成对)
# =============================================================================


def test_normalize_keeps_clean_leg_verbatim():
    """命中:已合法的腿名逐字保留(大小写归下、空白剔除)。"""
    assert normalize_pool_leg('stepfun/step-3.7-flash') == 'stepfun/step-3.7-flash'
    assert normalize_pool_leg(' Kimi-K2 ') == 'kimi-k2'


def test_normalize_collapses_illegal_chars_and_truncates():
    """不命中:非法字符折叠为 '_'、超长截断到现读上限、空输入归 ''。"""
    assert normalize_pool_leg('Foo!!Bar') == 'foo_bar'
    long_leg = normalize_pool_leg('a' * (POOL_LEG_LABEL_MAX_LEN + 40))
    assert len(long_leg) == POOL_LEG_LABEL_MAX_LEN
    assert normalize_pool_leg('!!!') == ''
    assert normalize_pool_leg(None) == ''


# =============================================================================
# ihui_llm_pool_leg_success_ratio:record_llm_outcome 采样(命中/不命中/变异)
# =============================================================================


def test_success_ratio_sampled_from_record_llm_outcome(isolated_pool):
    """命中:ok=1、error/timeout/connection=0 进滚动窗口;2 ok + 1 error = 2/3。"""
    leg = 'pooltest-ratio-a'
    record_llm_outcome('pooltest', leg, status='ok')
    record_llm_outcome('pooltest', leg, status='ok')
    record_llm_outcome('pooltest', leg, status='error')
    assert _read('ihui_llm_pool_leg_success_ratio', leg) == pytest.approx(2 / 3)


def test_interrupted_not_sampled(isolated_pool):
    """不命中:status='interrupted' 是客户端断流,不入腿健康样本(序列缺失)。"""
    leg = 'pooltest-ratio-int'
    record_llm_outcome('pooltest', leg, status='interrupted')
    assert _read('ihui_llm_pool_leg_success_ratio', leg) is None


def test_ratio_gauge_dies_with_sampler_mutation(isolated_pool, monkeypatch):
    """变异自证:摘掉 _sample_pool_leg_outcome 后 record_llm_outcome 不再产出该档。"""
    ok_leg = 'pooltest-ratio-mut-on'
    record_llm_outcome('pooltest', ok_leg, status='ok')
    assert _read('ihui_llm_pool_leg_success_ratio', ok_leg) == 1.0

    monkeypatch.setattr(llm_metrics, '_sample_pool_leg_outcome', lambda *a, **k: None)
    dead_leg = 'pooltest-ratio-mut-off'
    record_llm_outcome('pooltest', dead_leg, status='ok')
    assert _read('ihui_llm_pool_leg_success_ratio', dead_leg) is None


# =============================================================================
# set_pool_leg_health:全集置值 + 摘除(命中/不命中)
# =============================================================================


def test_health_snapshot_hit_and_zero_baseline(isolated_pool):
    """命中 vs 不命中:冷却腿四档齐给;健康腿 in_cooldown=0/remaining=0/quota=1。"""
    hot = 'pooltest-snap-hot'
    ok_leg = 'pooltest-snap-ok'
    set_pool_leg_health({
        hot: PoolLegHealth(
            in_cooldown=True,
            cooldown_remaining_seconds=42.5,
            consecutive_failures=3,
            quota_state=POOL_QUOTA_STATE_SUSPECT,
        ),
        ok_leg: PoolLegHealth(
            in_cooldown=False,
            cooldown_remaining_seconds=0.0,
            consecutive_failures=0,
            quota_state=POOL_QUOTA_STATE_OK,
        ),
    })
    assert _read('ihui_llm_pool_leg_in_cooldown', hot) == 1.0
    assert _read('ihui_llm_pool_leg_cooldown_remaining_seconds', hot) == 42.5
    assert _read('ihui_llm_pool_leg_consecutive_failures', hot) == 3.0
    assert _read('ihui_llm_pool_leg_quota_state', hot) == float(POOL_QUOTA_STATE_SUSPECT)
    assert _read('ihui_llm_pool_leg_in_cooldown', ok_leg) == 0.0
    assert _read('ihui_llm_pool_leg_quota_state', ok_leg) == float(POOL_QUOTA_STATE_OK)
    # 未发布的腿不铺零基线(开放集):序列缺失而不是 0
    assert _read('ihui_llm_pool_leg_in_cooldown', 'pooltest-snap-never') is None


def test_health_snapshot_removes_vanished_leg(isolated_pool):
    """腿从全集消失 ⇒ 冷却系列摘除(读回 None),冷却幽灵不滞留。"""
    leg = 'pooltest-snap-gone'
    set_pool_leg_health({
        leg: PoolLegHealth(True, 10.0, 1, POOL_QUOTA_STATE_NO_EVIDENCE),
    })
    assert _read('ihui_llm_pool_leg_in_cooldown', leg) == 1.0
    set_pool_leg_health({})
    assert _read('ihui_llm_pool_leg_in_cooldown', leg) is None
    assert _read('ihui_llm_pool_leg_quota_state', leg) is None


def test_quota_state_outside_ladder_clamped_to_no_evidence(isolated_pool):
    """封闭档纪律:不在 POOL_QUOTA_STATES 集合内的档位按 0 写,拒绝自创档。"""
    assert {POOL_QUOTA_STATE_NO_EVIDENCE, POOL_QUOTA_STATE_OK, POOL_QUOTA_STATE_SUSPECT} \
        == set(llm_metrics.POOL_QUOTA_STATES)
    leg = 'pooltest-snap-ladder'
    set_pool_leg_health({
        leg: PoolLegHealth(False, 0.0, 0, quota_state=7),
    })
    assert _read('ihui_llm_pool_leg_quota_state', leg) == 0.0


# =============================================================================
# 基数上限(命中/不命中 + 超限计数)
# =============================================================================


def test_leg_cardinality_cap_drops_overflow_and_counts(isolated_pool, monkeypatch):
    """上限现读自源模块;超限的新腿丢弃写入并计入 dropped_total(写次数不是样本)。"""
    monkeypatch.setattr(llm_metrics, 'POOL_LEG_SERIES_CAP', 2)
    dropped = 'ihui_llm_pool_series_dropped_total'
    before = REGISTRY.get_sample_value(dropped) or 0.0

    def snap() -> PoolLegHealth:
        return PoolLegHealth(False, 0.0, 0, POOL_QUOTA_STATE_OK)

    batch = {'pooltest-cap-1': snap(), 'pooltest-cap-2': snap(), 'pooltest-cap-3': snap()}
    set_pool_leg_health(batch)

    assert _read('ihui_llm_pool_leg_in_cooldown', 'pooltest-cap-1') is not None
    assert _read('ihui_llm_pool_leg_in_cooldown', 'pooltest-cap-2') is not None
    assert _read('ihui_llm_pool_leg_in_cooldown', 'pooltest-cap-3') is None
    after = REGISTRY.get_sample_value(dropped) or 0.0
    assert after - before == 1

    # 已登记的腿在满帽后仍可复写(命中),不再计数
    set_pool_leg_health({'pooltest-cap-1': snap()})
    assert _read('ihui_llm_pool_leg_quota_state', 'pooltest-cap-1') == 1.0
    assert (REGISTRY.get_sample_value(dropped) or 0.0) == after


# =============================================================================
# ComboRouter 集成:变更点 ⇒ 快照(命中/不命中 + 变异)
# =============================================================================


def _make_router() -> ComboRouter:
    router = ComboRouter()
    router._combos.clear()  # 隔离 COMBO_CHAINS 环境残留,发布集只含本用例腿
    return router


def test_router_429_then_success_ladder(isolated_pool):
    """命中:mark_429 → 冷却/退避计数上账;mark_success → 全部回落且额度档=正常。"""
    router = _make_router()
    router.configure_combo('pooltest-combo', {
        'strategy': 'priority',
        'chain': ['pooltest-leg-hot', 'pooltest-leg-idle'],
    })
    router._mark_leg_429('pooltest-leg-hot', error_text='HTTP 429 Too Many Requests')

    assert _read('ihui_llm_pool_leg_in_cooldown', 'pooltest-leg-hot') == 1.0
    assert (_read('ihui_llm_pool_leg_cooldown_remaining_seconds', 'pooltest-leg-hot') or 0.0) > 0.0
    assert _read('ihui_llm_pool_leg_consecutive_failures', 'pooltest-leg-hot') == 1.0
    # 不命中对:429 文案未命中封闭额度清单 ⇒ 无证据档;rate limit 不是欠费
    assert _read('ihui_llm_pool_leg_quota_state', 'pooltest-leg-hot') == float(
        POOL_QUOTA_STATE_NO_EVIDENCE
    )
    # 命中对:配置链里从未出过事的腿有零基线(in_cooldown=0)
    assert _read('ihui_llm_pool_leg_in_cooldown', 'pooltest-leg-idle') == 0.0

    router._mark_leg_ok('pooltest-leg-hot')
    assert _read('ihui_llm_pool_leg_in_cooldown', 'pooltest-leg-hot') == 0.0
    assert _read('ihui_llm_pool_leg_cooldown_remaining_seconds', 'pooltest-leg-hot') == 0.0
    assert _read('ihui_llm_pool_leg_consecutive_failures', 'pooltest-leg-hot') == 0.0
    assert _read('ihui_llm_pool_leg_quota_state', 'pooltest-leg-hot') == float(
        POOL_QUOTA_STATE_OK
    )


def test_router_quota_suspect_only_on_closed_markers(isolated_pool):
    """额度档只认封闭判据:命中欠费清单 ⇒ 2;泛化 429/超时文案 ⇒ 0(不命中)。"""
    router = _make_router()
    router._mark_leg_429(
        'pooltest-leg-arrear',
        error_text='{"code":"Arrearage","message":"余额不足"}',
    )
    assert _read('ihui_llm_pool_leg_quota_state', 'pooltest-leg-arrear') == float(
        POOL_QUOTA_STATE_SUSPECT
    )
    router._mark_leg_429('pooltest-leg-timeout', error_text='upstream timeout 504')
    assert _read('ihui_llm_pool_leg_quota_state', 'pooltest-leg-timeout') == float(
        POOL_QUOTA_STATE_NO_EVIDENCE
    )
    # 欠费疑似在成功后可被清档(回到正常档)
    router._mark_leg_ok('pooltest-leg-arrear')
    assert _read('ihui_llm_pool_leg_quota_state', 'pooltest-leg-arrear') == float(
        POOL_QUOTA_STATE_OK
    )


def test_health_gauge_dies_with_publish_mutation(isolated_pool, monkeypatch):
    """变异自证:摘掉 combo_router 侧 set_pool_leg_health 注入后,冷却档读不到。"""
    monkeypatch.setattr(combo_router_module, 'set_pool_leg_health', lambda legs: None)
    router = _make_router()
    router._mark_leg_429('pooltest-leg-mut-pub', error_text='rate limit hit')
    assert _read('ihui_llm_pool_leg_in_cooldown', 'pooltest-leg-mut-pub') is None
    assert router._get_health('pooltest-leg-mut-pub').is_in_cooldown() is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
