# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""POST /orchestration/events/emit 的「结论三态」对账(第九轮 ZCode 吸收 · B2 实现票)。

被审事实(取证过程见交付报告,这里把它钉成回归):
  `orchestration_hub.emit()` 的返回值**只有 event_id**;编排结论
  (degraded / non_ok_pillars)只在 hub **未启动消费循环**时由 emit 内部同步调用
  的 `_process_event` 留在 `hub._orchestration_outcomes` 台账尾部,对外出口是
  `get_status()` 的 `orchestration_attempts` / `last_orchestration`。
  改前的响应对外一律 `{code:0,message:"success",data:{event_id}}` —— 调用方
  (apps/api/src/routes/orchestration.ts → web orchestration-hub-panel)不去另查
  dashboard/status 就**只能看到"成功"**,这正是"对外声称联动成功"的确切位置。

本文件判四件事:
  A. 全 ok ⇒ degraded=False 且 outcome 与真实可得性一致(settled);
  B. 单条 404 ⇒ degraded=True 且点名是哪条支柱;
  C. 结论不可得 ⇒ 必须落"未知"档,且**断言 degraded is not False**
     —— 这一条是判据有牙的证明(把未知写成 false 就是本票要消灭的形态);
  D. 既有响应形状不回退:信封三键 + data.event_id 的名字/类型/位置都还在。

测试隔离(AGENTS.md §5 铁律):Redis 关掉走内存档、httpx 全程打桩,不连生产
端口(8802/8810/8811)、不派生子进程。另有一条 autouse "出网绊线" 兜底:任何
忘记自带桩的写法都不会真的发出请求,而是被归成 transport_error 并由
TestNoRealEgress 显式证明绊线确实在链路上(缺了它的地雷等于没有地雷)。
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from app.core.executor_switch import PILOT_ERROR_MARKER
from app.routers import orchestration as or_router
from app.services import orchestration_hub as oh_module
from app.services.orchestration_hub import (
    JointDecisionEngine,
    OrchestrationHub,
    PillarCallStatus,
    PillarEvent,
)

# =============================================================================
# 常量:事件类型刻意从真 playbook 表里取,不自造
# =============================================================================

# terminal_failure playbook 的 trigger(4 条 action:terminal/hook/rules/subagent)
EVENT_WITH_PLAYBOOK = "terminal.command_failed"
# 没有任何 playbook 的 trigger ⇒ evaluate 返回 skipped ⇒ 联动根本没发生
EVENT_WITHOUT_PLAYBOOK = "rules.matched"
# 单独打 404 的那条支柱 URL 后缀(用于按 URL 分派假响应)
PILLAR_404_PATH = "/api/rules/orchestrate"

# 本票新增的键 + 既有键,写死一份用于"形状不回退"对账
LEGACY_DATA_KEYS = ("event_id",)
ADDED_DATA_KEYS = ("outcome", "degraded", "non_ok_pillars")


# =============================================================================
# fixture
# =============================================================================


@pytest.fixture(autouse=True)
def _force_memory_mode(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Redis 关成内存档、api_service_url 保持"未配置"现状、收敛开关钉回 legacy。

    三条都是必须的:_REDIS_URL="" 让 publish 走内存分支(否则用真 Redis 8811);
    _settings=None 是生产现状(兜底地址要被点名);env 钉 legacy 否则本机的
    ORCHESTRATION_CONVERGENCE_EXECUTOR 会把 emit 变成 500,测的就不是本票那条链。
    """
    monkeypatch.setattr(oh_module, "_REDIS_URL", "")
    monkeypatch.setattr(oh_module, "_settings", None)
    monkeypatch.setenv("ORCHESTRATION_CONVERGENCE_EXECUTOR", "legacy")
    monkeypatch.delenv("ORCHESTRATION_CONVERGENCE_SESSIONS", raising=False)
    monkeypatch.delenv("ORCHESTRATION_CONVERGENCE_TENANTS", raising=False)


class _EgressTripwireError(RuntimeError):
    """真实出网被拦下的指纹 —— 测试里出现它 = 有用例忘记打桩。"""


@pytest.fixture(autouse=True)
def _block_real_egress():
    """默认把 httpx.AsyncClient 换成"一律拒绝发请求"的绊线。

    方向刻意是"拒绝"而不是"回个 200 混过去":回 200 会让忘记打桩的用例产出一
    条假的成功结论,那正是本票要防的形态。用例内部再用 `_patch_http` 覆盖它。
    """

    class _Tripwire:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            raise _EgressTripwireError("测试试图发出真实网络请求,已被绊线拦下")

    with patch("httpx.AsyncClient", _Tripwire):
        yield


@pytest.fixture
def hub(monkeypatch: pytest.MonkeyPatch) -> OrchestrationHub:
    """每用例一枚全新的真 hub(内存台账不跨用例串),并接管路由里的单例。

    用真 hub 而不是假对象,是为了让 outcome 的三态判定跑在**真**台账语义上:
    假 hub 可以随意配合,真 hub 会自己决定这条事件到底有没有留下结论。
    """
    fresh = OrchestrationHub()
    monkeypatch.setattr(or_router, "orchestration_hub", fresh)
    return fresh


# =============================================================================
# 夹具辅助
# =============================================================================


def _event(event_type: str = EVENT_WITH_PLAYBOOK) -> PillarEvent:
    return PillarEvent(
        event_type=event_type,
        source_pillar="terminal",
        timestamp=datetime.now(UTC).isoformat(),
        payload={},
    )


def _body(event_type: str = EVENT_WITH_PLAYBOOK) -> or_router.EmitEventBody:
    return or_router.EmitEventBody(
        event_type=event_type,
        source_pillar="terminal",
        payload={"why": "emit-outcome"},
        severity="warning",
    )


def _patch_http(responder: Callable[[str], tuple[int, str] | Exception]):
    """把 httpx.AsyncClient 换成按 URL 分派的假客户端(与 B1 票同一套夹具)。"""

    class _FakeClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        async def __aenter__(self) -> _FakeClient:
            return self

        async def __aexit__(self, *exc: Any) -> None:
            return None

        async def post(self, url: str, json: Any = None, **kwargs: Any) -> Any:
            outcome = responder(url)
            if isinstance(outcome, Exception):
                raise outcome
            code, text = outcome
            resp = MagicMock()
            resp.status_code = code
            resp.text = text
            return resp

    return patch("httpx.AsyncClient", _FakeClient)


def _all_ok(url: str) -> tuple[int, str]:
    return 200, '{"ok":true}'


def _only_rules_404(url: str) -> tuple[int, str]:
    if url.endswith(PILLAR_404_PATH):
        return 404, "Not Found"
    return 200, '{"ok":true}'


# =============================================================================
# A. 结论当场可得 ⇒ settled + 真实 degraded
# =============================================================================


class TestSettledArms:
    """hub 未启动消费循环 ⇒ emit 同步跑完编排 ⇒ 本次调用拿得到结论。"""

    async def test_all_pillars_ok_reports_settled_and_not_degraded(self, hub: OrchestrationHub):
        with _patch_http(_all_ok):
            resp = await or_router.emit_event(_body())
        data = resp["data"]
        assert resp["code"] == 0
        assert data["outcome"] == or_router.EMIT_OUTCOME_SETTLED
        assert data["degraded"] is False
        assert data["non_ok_pillars"] == []

    async def test_single_404_marks_degraded_and_names_the_pillar(self, hub: OrchestrationHub):
        with _patch_http(_only_rules_404):
            resp = await or_router.emit_event(_body())
        data = resp["data"]
        assert data["outcome"] == or_router.EMIT_OUTCOME_SETTLED
        assert data["degraded"] is True
        # 点名到支柱级,且只点名那一条 —— 其余三条支柱不得被连坐
        assert data["non_ok_pillars"] == ["rules"]

    async def test_sequential_emits_do_not_reuse_previous_conclusion(self, hub: OrchestrationHub):
        """两条事件各得各的结论:第二条不能把第一条的 degraded 读成自己的。

        判据靠的是"台账尾部 event_type 与本次一致"+ 计数递增,这里两条事件类型
        相同,所以真正区分它们的是**计数增量**(每次 emit 只留一条结论)。
        """
        with _patch_http(_only_rules_404):
            first = (await or_router.emit_event(_body()))["data"]
        with _patch_http(_all_ok):
            second = (await or_router.emit_event(_body()))["data"]
        assert first["degraded"] is True
        assert first["non_ok_pillars"] == ["rules"]
        assert second["degraded"] is False
        assert second["non_ok_pillars"] == []
        assert second["event_id"] != first["event_id"]


# =============================================================================
# C. 结论不可得 ⇒ 未知档,**绝不等于 False**(判据有牙)
# =============================================================================


class TestUnknownIsNotSuccess:
    """三档"拿不到结论"的形态都必须落未知,而不是被洗成 degraded=False。"""

    async def test_running_consumer_loop_gives_accepted_not_false(self, hub: OrchestrationHub):
        """消费循环在跑 ⇒ 事件交给 Redis/后台 ⇒ 本次调用结构上拿不到结论。"""
        await hub.start()
        try:
            with _patch_http(_only_rules_404):
                resp = await or_router.emit_event(_body())
        finally:
            await hub.stop()
        data = resp["data"]
        assert data["outcome"] == or_router.EMIT_OUTCOME_ACCEPTED
        # 这条是判据有牙的证明:"还不知道"没有被写成"判过了"
        assert data["degraded"] is None
        assert data["degraded"] is not False
        assert data["non_ok_pillars"] is None
        # 而且后台确实一次都没编排(结论不是"晚点会出现在这台 hub 里")
        status = await hub.get_status()
        assert status["orchestration_attempts"] == 0

    async def test_skipped_playbook_is_unsettled_not_false(self, hub: OrchestrationHub):
        """无匹配 playbook ⇒ 联动根本没发生 ⇒ 未知档(不是"成功")。"""
        urls: list[str] = []

        def respond(url: str) -> tuple[int, str]:
            urls.append(url)
            return 200, "{}"

        with _patch_http(respond):
            resp = await or_router.emit_event(_body(EVENT_WITHOUT_PLAYBOOK))
        data = resp["data"]
        assert data["outcome"] == or_router.EMIT_OUTCOME_UNSETTLED
        assert data["degraded"] is None
        assert data["degraded"] is not False
        assert urls == []  # skipped 不该发出任何支柱调用

    async def test_evaluate_exception_is_unsettled_not_false(self, hub: OrchestrationHub):
        """编排中途抛异常(_process_event 内部兜底)⇒ 台账没结论 ⇒ 未知档。"""

        async def _boom(event: PillarEvent) -> None:
            raise RuntimeError("evaluate 内部炸了")

        hub.decision_engine.evaluate = _boom  # type: ignore[method-assign]
        with _patch_http(_all_ok):
            resp = await or_router.emit_event(_body())
        data = resp["data"]
        assert data["outcome"] == or_router.EMIT_OUTCOME_UNSETTLED
        assert data["degraded"] is None
        assert data["degraded"] is not False

    async def test_status_without_counters_is_unsettled_not_false(self, hub: OrchestrationHub):
        """status 形状不对(没有计数键)⇒ 尺子失灵 ⇒ 未知档,绝不返回 0 冒充判过。"""

        async def _broken_status() -> dict[str, Any]:
            return {"status": "ok"}

        async def _fake_emit(**kwargs: Any) -> str:
            return "evt-fake"

        hub.get_status = _broken_status  # type: ignore[method-assign]
        hub.emit = _fake_emit  # type: ignore[method-assign]
        resp = await or_router.emit_event(_body())
        data = resp["data"]
        assert data["outcome"] == or_router.EMIT_OUTCOME_UNSETTLED
        assert data["degraded"] is None
        assert data["degraded"] is not False


# =============================================================================
# D. 既有响应形状不回退
# =============================================================================


class TestResponseShapeNotRegressed:
    """三条消费端都在读现有形状:信封与 data 的既有键一个都不能少、不能改。"""

    async def test_envelope_keys_and_order_unchanged(self, hub: OrchestrationHub):
        with _patch_http(_all_ok):
            resp = await or_router.emit_event(_body())
        assert list(resp.keys()) == ["code", "message", "data"]
        assert resp["message"] == "success"

    async def test_event_id_still_present_first_and_str(self, hub: OrchestrationHub):
        with _patch_http(_all_ok):
            resp = await or_router.emit_event(_body())
        data = resp["data"]
        for legacy_key in LEGACY_DATA_KEYS:
            assert legacy_key in data, f"既有键 {legacy_key} 被本票写没了"
        assert list(data.keys())[0] == "event_id"
        assert isinstance(data["event_id"], str) and data["event_id"]

    async def test_added_keys_are_appended_after_legacy_ones(self, hub: OrchestrationHub):
        with _patch_http(_all_ok):
            resp = await or_router.emit_event(_body())
        data = resp["data"]
        assert list(data.keys()) == [*LEGACY_DATA_KEYS, *ADDED_DATA_KEYS]

    async def test_pilot_error_envelope_unchanged(self, hub: OrchestrationHub, monkeypatch):
        """D6① 开关命中 loop_v2 时的 500 信封一字未改(fail-fast 早于新增键)。"""
        monkeypatch.setenv("ORCHESTRATION_CONVERGENCE_EXECUTOR", "loop_v2")
        resp = await or_router.emit_event(_body())
        assert resp["code"] == 500
        assert resp["data"] is None
        assert PILOT_ERROR_MARKER in resp["message"]


# =============================================================================
# 纯函数判序表:每条判据单独钉住,防止日后被"顺手简化"
# =============================================================================


class TestOutcomeVocabulary:
    def test_outcome_values_are_a_closed_set(self):
        assert {
            or_router.EMIT_OUTCOME_SETTLED,
            or_router.EMIT_OUTCOME_ACCEPTED,
            or_router.EMIT_OUTCOME_UNSETTLED,
        } == {"settled", "accepted", "unsettled"}
        assert len({
            or_router.EMIT_OUTCOME_SETTLED,
            or_router.EMIT_OUTCOME_ACCEPTED,
            or_router.EMIT_OUTCOME_UNSETTLED,
        }) == 3

    def test_pilot_error_prefix_is_taken_from_d6_single_source(self):
        # 本票不复制第二份错误前缀:断言用的是 executor_switch 那份(它自述不得改动)
        assert PILOT_ERROR_MARKER == "AGENT_LOOP_V2_PILOT_NOT_WIRED"


def _snap(**fields: Any) -> dict[str, Any]:
    base: dict[str, Any] = {"running": False, "orchestration_attempts": 0, "last_orchestration": None}
    base.update(fields)
    return base


def _settled_last(event_type: str = EVENT_WITH_PLAYBOOK) -> dict[str, Any]:
    return {
        "decision_id": "d-1",
        "event_type": event_type,
        "playbook_id": "terminal_failure",
        "status": "failed",
        "degraded": True,
        "non_ok_pillars": [{"pillar": "rules", "action": "auto_generate", "status": "http_404"}],
        "base_url_configured": False,
    }


class TestResolveEmitOutcomeTable:
    """resolve_emit_outcome 的判序逐条成对(正例 ⇒ settled,反例 ⇒ 未知)。"""

    def test_running_takes_accepted_even_if_counts_grew(self):
        outcome, degraded, names = or_router.resolve_emit_outcome(
            _snap(running=True, orchestration_attempts=0),
            _snap(running=True, orchestration_attempts=1, last_orchestration=_settled_last()),
            EVENT_WITH_PLAYBOOK,
        )
        assert (outcome, degraded, names) == ("accepted", None, None)

    def test_missing_counter_is_undetermined_not_zero(self):
        for before, after in (
            (_snap(), _snap(orchestration_attempts=None)),
            (_snap(orchestration_attempts="3"), _snap(orchestration_attempts=4)),
        ):
            outcome, degraded, names = or_router.resolve_emit_outcome(before, after, EVENT_WITH_PLAYBOOK)
            assert (outcome, degraded, names) == ("unsettled", None, None)

    def test_bool_counter_is_rejected_as_shape_drift(self):
        # isinstance(True, int) 为真 ⇒ 必须单独排除,否则"计数=1"是布尔漂移伪装的
        outcome, degraded, names = or_router.resolve_emit_outcome(
            _snap(orchestration_attempts=True),
            _snap(orchestration_attempts=True, last_orchestration=_settled_last()),
            EVENT_WITH_PLAYBOOK,
        )
        assert (outcome, degraded, names) == ("unsettled", None, None)

    def test_counter_not_increased_is_unsettled(self):
        outcome, degraded, names = or_router.resolve_emit_outcome(
            _snap(orchestration_attempts=2),
            _snap(orchestration_attempts=2, last_orchestration=_settled_last()),
            EVENT_WITH_PLAYBOOK,
        )
        assert (outcome, degraded, names) == ("unsettled", None, None)

    def test_decreased_counter_is_unsettled(self):
        # 台账被换掉/重启过 ⇒ 前后不可比,不能拿来当结论
        outcome, degraded, names = or_router.resolve_emit_outcome(
            _snap(orchestration_attempts=5),
            _snap(orchestration_attempts=1, last_orchestration=_settled_last()),
            EVENT_WITH_PLAYBOOK,
        )
        assert (outcome, degraded, names) == ("unsettled", None, None)

    def test_missing_or_malformed_last_orchestration_is_unsettled(self):
        for last in (None, "nope", {}, 7):
            outcome, degraded, names = or_router.resolve_emit_outcome(
                _snap(orchestration_attempts=0),
                _snap(orchestration_attempts=1, last_orchestration=last),
                EVENT_WITH_PLAYBOOK,
            )
            assert (outcome, degraded, names) == ("unsettled", None, None), last

    def test_event_type_mismatch_is_not_attributed_to_this_call(self):
        # 并发交错:台账尾部是别人的事件,张冠李戴就是把别人的红算成我的
        outcome, degraded, names = or_router.resolve_emit_outcome(
            _snap(orchestration_attempts=0),
            _snap(
                orchestration_attempts=1,
                last_orchestration=_settled_last(event_type="budget.warning"),
            ),
            EVENT_WITH_PLAYBOOK,
        )
        assert (outcome, degraded, names) == ("unsettled", None, None)

    def test_non_bool_degraded_is_unsettled(self):
        for bad in ("false", 1, None, ""):
            last = _settled_last()
            last["degraded"] = bad
            outcome, degraded, names = or_router.resolve_emit_outcome(
                _snap(orchestration_attempts=0),
                _snap(orchestration_attempts=1, last_orchestration=last),
                EVENT_WITH_PLAYBOOK,
            )
            assert (outcome, degraded, names) == ("unsettled", None, None), bad

    def test_settled_projects_pillar_names_and_dedupes(self):
        last = _settled_last()
        last["non_ok_pillars"] = [
            {"pillar": "rules", "action": "a", "status": "http_404"},
            {"pillar": "hook", "action": "b", "status": "transport_error"},
            {"pillar": "rules", "action": "c", "status": "http_5xx"},  # 重复支柱只点一次
            {"action": "d", "status": "http_404"},  # 拿不出名字 ⇒ 跳过而非塞空串
            "",  # 空串同样跳过
        ]
        outcome, degraded, names = or_router.resolve_emit_outcome(
            _snap(orchestration_attempts=0),
            _snap(orchestration_attempts=1, last_orchestration=last),
            EVENT_WITH_PLAYBOOK,
        )
        assert outcome == "settled"
        assert degraded is True
        assert names == ["rules", "hook"]

    def test_projection_also_passes_through_bare_name_entries(self):
        """hub 若哪天把 non_ok_pillars 简化成 list[str],投影不该把它清空。

        刻意"两种形状都认":本票对外的字段契约就是 list[str],把已经是名字的
        条目丢掉会让 degraded=True 却点不出名 —— 那又是"把没判写成判过了"的近亲。
        """
        last = _settled_last()
        last["non_ok_pillars"] = ["terminal", {"pillar": "hook", "status": "http_5xx"}]
        outcome, degraded, names = or_router.resolve_emit_outcome(
            _snap(orchestration_attempts=0),
            _snap(orchestration_attempts=1, last_orchestration=last),
            EVENT_WITH_PLAYBOOK,
        )
        assert (outcome, degraded) == ("settled", True)
        assert names == ["terminal", "hook"]

    def test_settled_ok_keeps_empty_names(self):
        last = _settled_last()
        last["degraded"] = False
        last["non_ok_pillars"] = []
        outcome, degraded, names = or_router.resolve_emit_outcome(
            _snap(orchestration_attempts=0),
            _snap(orchestration_attempts=1, last_orchestration=last),
            EVENT_WITH_PLAYBOOK,
        )
        assert (outcome, degraded, names) == ("settled", False, [])

    def test_non_list_entries_yields_empty_names_not_crash(self):
        assert or_router._non_ok_pillar_names(None) == []
        assert or_router._non_ok_pillar_names([1, None, "", {"pillar": ""}]) == []


# =============================================================================
# 契约对齐:路由依赖的 hub 形状由真 hub 自证(防止"假 hub 配合假测试"自证)
# =============================================================================


class TestRealHubContract:
    """本票的三态判定建立在 hub 公开形状上;这几条钉住那个形状真的存在。"""

    async def test_emit_return_value_carries_no_conclusion(self, hub: OrchestrationHub):
        """前提取证:emit 只回 event_id ⇒ 结论必须另取 ⇒ 三态设计不是偷懒。"""
        with _patch_http(_all_ok):
            returned = await hub.emit(EVENT_WITH_PLAYBOOK, "terminal", {})
        assert isinstance(returned, str)

    async def test_status_exposes_the_keys_router_reads(self, hub: OrchestrationHub):
        status = await hub.get_status()
        for key in ("running", "orchestration_attempts", "last_orchestration"):
            assert key in status, f"hub.get_status() 不再提供 {key},路由侧判据将静默失效"

    async def test_last_orchestration_shape_after_real_emit(self, hub: OrchestrationHub):
        with _patch_http(_only_rules_404):
            await hub.emit(EVENT_WITH_PLAYBOOK, "terminal", {})
        last = (await hub.get_status())["last_orchestration"]
        assert isinstance(last, dict)
        assert last["event_type"] == EVENT_WITH_PLAYBOOK
        assert last["degraded"] is True
        # _non_ok_pillar_names 只认 {pillar:...} 这一形状,形状变了要同批改判据
        assert all(isinstance(item, dict) and "pillar" in item for item in last["non_ok_pillars"])
        assert [i["pillar"] for i in last["non_ok_pillars"]] == ["rules"]

    async def test_running_flag_matches_consumer_loop(self, hub: OrchestrationHub):
        assert (await hub.get_status())["running"] is False
        await hub.start()
        try:
            assert (await hub.get_status())["running"] is True
        finally:
            await hub.stop()
        assert (await hub.get_status())["running"] is False


# =============================================================================
# 出网绊线的阳性对照(先证明"看不见网络"这件事本身是真的)
# =============================================================================


class TestNoRealEgress:
    async def test_tripwire_is_on_the_call_path(self):
        """不打桩直接调支柱 ⇒ 必须被绊线拦成 transport_error,而不是真的发出去。"""
        engine = JointDecisionEngine()
        result = await engine._call_pillar_action("rules", "auto_generate", {}, _event())
        assert result["status"] == PillarCallStatus.TRANSPORT_ERROR
        assert "已被绊线拦下" in result["error"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
