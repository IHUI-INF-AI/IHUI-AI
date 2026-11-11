# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""公众号任务「模拟完成」状态机单测 — 零真实网络、零真实凭据、零写服务端。

被测:app/services/workbuddy_oa_simulate.py(注入 MockTransport 后跑生产引擎
``workbuddy_autopilot.run_autopilot``)。

钉住的行为:
  - 未绑定 / 关注未满 24h:绝不领奖、绝不出现写请求;
  - 关注满 24h(服务端判 completed 1/1):引擎 claim-only 自动领奖 +100;
  - 下一轮巡检:全表 claimed ⇒ 幂等,零写、零重复加分;
  - 基线已 19/19 的账号不伪造「未完成」,只验幂等;
  - 仿真不碰 OneID 绑定端点、不伪造 openid、所有写请求都落在 claim 路径上。
"""

from __future__ import annotations

import asyncio

from app.services import workbuddy_oa_simulate as sim


def _report(*baselines: dict) -> dict:
    return asyncio.run(sim.simulate_pool(list(baselines)))


def test_four_phase_state_machine_claims_only_when_matured() -> None:
    report = _report(sim.build_offline_baseline("u-unfinished", "待绑定号"))
    a = report["accounts"][0]
    stages = a["stages"]
    assert [s["phase"] for s in stages] == list(sim.PHASE_ORDER)

    assert stages[0]["done"] == 18 and stages[0]["credits"] == 0
    assert stages[0]["write_requests"] == []
    assert stages[0]["pending_platform"][0]["code"] == sim.OA_CODE

    assert stages[1]["done"] == 18 and stages[1]["credits"] == 0
    assert stages[1]["write_requests"] == []
    assert stages[1]["server_status"]["remaining_seconds"] == 3600

    assert stages[2]["done"] == 19 and stages[2]["credits"] == sim.SIM_CREDIT
    assert stages[2]["claimed"] == [sim.OA_CODE]
    assert stages[2]["pending_platform"] == []
    assert stages[2]["subscribe_status"]["subscribed"] is True
    assert stages[2]["subscribe_status"]["task_status"] == "completed"
    assert stages[2]["subscribe_status"]["advanced"] is True
    assert stages[2]["write_requests"] == [
        {"method": "POST", "path": f"/activity/growth/tasks/{sim.OA_CODE}/claim"}
    ]

    assert stages[3]["done"] == 19 and stages[3]["credits"] == 0
    assert stages[3]["write_requests"] == []
    assert all(s["engine_ok"] for s in stages)
    assert all(s["read_failed"] is False for s in stages)
    assert all(s["unregistered"] == [] for s in stages)


def test_already_done_account_never_fakes_an_incomplete_state() -> None:
    report = _report(sim.build_offline_baseline("u-done", "已绑定主号", oa_claimed=True))
    a = report["accounts"][0]
    assert a["already_done"] is True
    assert [s["phase"] for s in a["stages"]] == ["claimed"]
    assert a["before_done"] == a["after_done"] == 19
    assert a["sim_credits"] == 0
    assert a["stages"][0]["write_requests"] == []


def test_pool_totals_and_no_openid_fabrication() -> None:
    report = _report(
        sim.build_offline_baseline("14f939c3", "主号", oa_claimed=True),
        sim.build_offline_baseline("0bc1074d", "号池A"),
        sim.build_offline_baseline("25913b4a", "号池B"),
    )
    t = report["totals"]
    assert t["accounts"] == 3
    assert t["before_full"] == 1
    assert t["after_full"] == 3
    assert t["sim_credits"] == 2 * sim.SIM_CREDIT
    assert t["mock_write_requests"] == 2
    assert t["real_write_requests"] == 0
    assert t["oneid_or_bind_calls"] == 0
    assert t["claim_paths"] == [f"/activity/growth/tasks/{sim.OA_CODE}/claim"]


def test_dry_run_baseline_never_posts_even_inside_mock() -> None:
    report = _report(sim.build_offline_baseline("u-dry", "只读取数号"))
    stages = report["accounts"][0]["stages"]
    assert stages[0]["write_requests"] == []
    # 现状阶段只读两次:订阅状态 + 任务表
    assert [r["method"] for r in stages[0]["requests"]] == ["GET", "GET"]
    assert stages[0]["requests"][0]["path"] == "/v2/activity/growth/subscribe-task/status"


def test_server_rejects_claim_before_matured_like_production() -> None:
    baseline = sim.build_offline_baseline("u-reject", "拒绝号")
    server = sim.SimulatedGrowthServer(baseline, "bound_waiting")
    resp = server.handler(
        _post(f"/activity/growth/tasks/{sim.OA_CODE}/claim")
    )
    assert resp.status_code == 400
    assert server.credit_granted == 0


def _post(path: str):
    import httpx

    return httpx.Request("POST", "https://www.workbuddy.cn" + path)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
