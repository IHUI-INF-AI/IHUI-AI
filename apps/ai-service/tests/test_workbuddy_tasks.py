# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""workbuddy_tasks(O68 任务赚积分四族)单元测试 — httpx.MockTransport,零真实网络。

覆盖:列表面合同形 / 信封与行形读不懂 ⇒ unjudged / token 与 web 双模式分流 /
401 回退 Cookie / growth dry-run 零写侧断言 / accept 批量 / claim 路径未配置拒绝执行 /
claim 路径配置后执行 / travel 状态解析+claim 差量+depart 配置闸+dry-run 零写 /
activity 未配置拒绝、坏 hosts、配置后上报 / blackcat 窗口边界(跨零点)、
窗口外跳过零调用、无补全面未判定、注入假补全后计数 / run_family 合同键集。
证据级别:路径与字段系竞品二进制取证(未真机验证),本测试只钉**我们的合同行为**。
"""

from __future__ import annotations

import base64
import json
import time
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx
import pytest

from app.core.config import settings
from app.services import workbuddy_tasks as wt
from app.services.workbuddy_tasks import (
    PATH_GROWTH_STREAK,
    PATH_GROWTH_TASKS,
    PATH_GROWTH_TASKS_ACCEPT,
    PATH_TRAVEL_CLAIM,
    PATH_TRAVEL_DEPART,
    PATH_TRAVEL_STATUS,
)

UID = "14f939c3-889b-4ea2-88b7-ca4582f3b435"
CN = ZoneInfo("Asia/Shanghai")


def _b64(obj: Any) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj).encode("utf-8")).decode().rstrip("=")


def make_wb_jwt() -> str:
    payload = {"sub": UID, "exp": int(time.time() + 86400 * 30)}
    return f"{_b64({'alg': 'RS256'})}.{_b64(payload)}.sig"


TOKEN = make_wb_jwt()


@pytest.fixture(autouse=True)
def _neutralize_outbound_throttle(monkeypatch: pytest.MonkeyPatch):
    """出站闸门的随机间隔与残留暂停都不该把单测拖慢/拖红(全 MockTransport,零真实网络)。"""
    from app.services.checkin_outbound import checkin_outbound_gate

    monkeypatch.setenv("CHECKIN_OUTBOUND_MIN", "0")
    monkeypatch.setenv("CHECKIN_OUTBOUND_MAX", "0")
    checkin_outbound_gate.reset()
    yield
    checkin_outbound_gate.reset()


class Recorder:
    """MockTransport 记录器:登记 (method, url, body),按路由表回包。"""

    def __init__(self, routes: dict[str, Any]) -> None:
        self.routes = routes
        self.calls: list[tuple[str, str, Any]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else {}
        self.calls.append((request.method, str(request.url), body))
        for frag, resp in self.routes.items():
            if frag in str(request.url):
                if callable(resp):
                    return resp(request)
                if isinstance(resp, httpx.Response):
                    return resp
                return httpx.Response(200, json=resp)
        return httpx.Response(404, json={"code": 404, "msg": "unmapped"})

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self.handler), trust_env=False)

    def paths(self) -> list[str]:
        return [url.split("?")[0] for _m, url, _b in self.calls]


def task_row(**over: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "task_code": "T1",
        "task_desc": "每日对话3次",
        "task_type": "daily",
        "progress": 0,
        "limit_num": 3,
        "status": "0",
        "accept_status": "0",
        "reward_credit": 10,
        "reward_energy": 2,
        "valid_to": None,
        "sku_code": "",
        "jump_url": "",
    }
    row.update(over)
    return row


def ok_envelope(data: Any) -> dict[str, Any]:
    return {"code": 0, "msg": "ok", "data": data}


# ---------------------------------------------------------------------------
# 列表面
# ---------------------------------------------------------------------------


class TestListContract:
    async def test_happy_shape_matches_contract(self):
        rec = Recorder({PATH_GROWTH_TASKS: ok_envelope({"tasks": [task_row()]})})
        async with rec.client() as client:
            out = await wt.list_growth_tasks(TOKEN, {}, client=client)
        assert out["ok"] is True
        assert out["kind"] == "list"
        assert out["unjudged"] is False
        row = out["tasks"][0]
        assert set(row) == {
            "task_code", "title", "progress", "target", "status",
            "accept_status", "reward_credit", "reward_energy", "valid_to",
        }
        assert row["task_code"] == "T1" and row["title"] == "每日对话3次"
        assert row["progress"] == 0 and row["target"] == 3
        assert row["reward_credit"] == 10 and row["reward_energy"] == 2

    async def test_unparseable_envelope_is_unjudged_not_green(self):
        rec = Recorder({PATH_GROWTH_TASKS: {"result": "weird-no-code"}})
        async with rec.client() as client:
            out = await wt.list_growth_tasks(TOKEN, {}, client=client)
        assert out["ok"] is False and out["unjudged"] is True
        assert out["tasks"] == [] and out["reason"]

    async def test_non_json_is_unjudged(self):
        rec = Recorder({PATH_GROWTH_TASKS: httpx.Response(200, text="<html>WAF</html>")})
        async with rec.client() as client:
            out = await wt.list_growth_tasks(TOKEN, {}, client=client)
        assert out["unjudged"] is True and out["ok"] is False

    async def test_bad_row_dropped_and_flagged(self):
        bad = task_row()
        del bad["task_desc"]  # 必解析字段缺位 ⇒ 该行读不懂,不猜标题
        rec = Recorder({PATH_GROWTH_TASKS: ok_envelope([task_row(), bad])})
        async with rec.client() as client:
            out = await wt.list_growth_tasks(TOKEN, {}, client=client)
        assert len(out["tasks"]) == 1
        assert out["unjudged"] is True and out["ok"] is True

    async def test_missing_rewards_default_zero_but_bad_type_unjudged(self):
        no_rw = task_row()
        del no_rw["reward_credit"], no_rw["reward_energy"]
        bad_rw = task_row(reward_credit="ten")
        rec = Recorder({PATH_GROWTH_TASKS: ok_envelope([no_rw, bad_rw])})
        async with rec.client() as client:
            out = await wt.list_growth_tasks(TOKEN, {}, client=client)
        assert out["tasks"][0]["reward_credit"] == 0  # 缺字段 = 无奖励合法形态
        assert out["unjudged"] is True  # 字段在而形态坏 = 读不懂

    async def test_web_mode_uses_v2_web_base_with_cookie(self):
        rec = Recorder({"/v2/activity/growth/tasks": ok_envelope([])})
        dm = {"login_type": "web", "web_cookie": "session=abc"}
        async with rec.client() as client:
            out = await wt.list_growth_tasks("irrelevant", dm, client=client)
        assert out["ok"] is True
        assert rec.paths()[0].startswith("https://www.workbuddy.cn/v2/activity/growth/tasks")

    async def test_token_401_falls_back_to_web_cookie(self):
        def first_401(request: httpx.Request) -> httpx.Response:
            if "copilot.tencent.com" in str(request.url):
                return httpx.Response(401, json={"code": 401})
            return httpx.Response(200, json=ok_envelope([]))

        rec = Recorder(
            {
                "copilot.tencent.com": first_401,
                "www.workbuddy.cn": first_401,
            }
        )
        dm = {"web_cookie": "session=abc"}  # 非 web 模式但有 Cookie 备料
        async with rec.client() as client:
            out = await wt.list_growth_tasks(TOKEN, dm, client=client)
        assert out["ok"] is True
        assert any("www.workbuddy.cn" in p for p in rec.paths())


# ---------------------------------------------------------------------------
# growth 执行面
# ---------------------------------------------------------------------------


class TestRunGrowth:
    async def test_dry_run_performs_zero_write_calls(self):
        rec = Recorder({PATH_GROWTH_TASKS: ok_envelope({"tasks": [task_row()]})})
        async with rec.client() as client:
            out = await wt.run_growth(TOKEN, {}, dry_run=True, client=client)
        assert out["ok"] is True and out["kind"] == "growth"
        assert out["accepted"] == [] and out["claimed"] == []
        paths = " ".join(rec.paths())
        assert PATH_GROWTH_TASKS_ACCEPT not in paths
        assert "/billing/meter/checkin-status" not in paths  # dry-run 连探针都不发
        assert all(PATH_TRAVEL_DEPART not in p and PATH_GROWTH_STREAK not in p for p in rec.paths())

    async def test_accept_live_flow_with_measured_credit_delta(self):
        balances = iter(
            [ok_envelope({"total_credits": 100}), ok_envelope({"total_credits": 130})]
        )
        rec = Recorder(
            {
                "/billing/meter/checkin-status": lambda _r: httpx.Response(
                    200, json=next(balances)
                ),
                # 注意路由表按插入序前缀匹配:"/activity/growth/tasks" 是 accept 路径的
                # 前缀,更长的 fragment 必须登记在前。
                PATH_GROWTH_TASKS_ACCEPT: ok_envelope({}),
                PATH_GROWTH_STREAK: ok_envelope({"streak": 5, "days": 5, "tier": 1}),
                PATH_GROWTH_TASKS: ok_envelope({"tasks": [task_row(reward_credit=30)]}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_growth(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is True
        assert out["accepted"] == ["T1"]
        assert out["credit_delta"] == 30  # 130-100 实测差量,不是猜的
        assert out["unjudged"] is False
        assert "streak=5" in (out["reason"] or "")
        # accept 请求体 = 取证形态 {"task_codes": [...]}
        accept_call = [c for c in rec.calls if PATH_GROWTH_TASKS_ACCEPT in c[1]][0]
        assert accept_call[2] == {"task_codes": ["T1"]}

    async def test_claim_refused_without_configured_path(self):
        done = task_row(accept_status="1", progress=3, limit_num=3, status="2")
        rec = Recorder(
            {
                "/billing/meter/checkin-status": ok_envelope({"total_credits": 10}),
                PATH_GROWTH_TASKS: ok_envelope({"tasks": [done]}),
                PATH_GROWTH_STREAK: ok_envelope({}),
            }
        )
        assert settings.workbuddy_tasks_claim_path == ""  # 出厂默认留空(未取证 ⇒ 拒绝执行)
        async with rec.client() as client:
            out = await wt.run_growth(TOKEN, {}, dry_run=False, client=client)
        assert out["claimed"] == []
        assert out["unjudged"] is False  # 这是"判过并拒绝",不是读不懂
        assert "拒绝猜 URL" in (out["reason"] or "")

    async def test_claim_executes_when_path_configured(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_claim_path", "/activity/growth/tasks/claim")
        done = task_row(accept_status="1", progress=3, limit_num=3, status="2")
        rec = Recorder(
            {
                "/billing/meter/checkin-status": ok_envelope({"total_credits": 10}),
                "/activity/growth/tasks/claim": ok_envelope({"credit": 10}),
                PATH_GROWTH_STREAK: ok_envelope({}),
                PATH_GROWTH_TASKS: ok_envelope({"tasks": [done]}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_growth(TOKEN, {}, dry_run=False, client=client)
        assert out["claimed"] == ["T1"]
        claim_body = [c for c in rec.calls if "tasks/claim" in c[1]][0][2]
        assert claim_body == {"task_code": "T1"}  # 取证 claim 体形

    async def test_unparseable_balance_never_reports_zero(self):
        rec = Recorder(
            {
                "/billing/meter/checkin-status": {"code": 0, "data": {}},  # 无余额字段
                PATH_GROWTH_TASKS: ok_envelope({"tasks": []}),
                PATH_GROWTH_STREAK: ok_envelope({}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_growth(TOKEN, {}, dry_run=False, client=client)
        assert out["credit_delta"] is None  # 测不到 ⇒ null,不冒 0
        assert out["ok"] is True  # 无待办任务本身是成功判定


# ---------------------------------------------------------------------------
# travel
# ---------------------------------------------------------------------------


def travel_state(**over: Any) -> dict[str, Any]:
    st: dict[str, Any] = {"state": "idle", "status": "ready", "remain": 3, "energy": 10, "credit": 5}
    st.update(over)
    return st


class TestTravel:
    async def test_dry_run_reads_status_only(self):
        rec = Recorder({PATH_TRAVEL_STATUS: ok_envelope(travel_state())})
        async with rec.client() as client:
            out = await wt.run_travel(TOKEN, {}, dry_run=True, client=client)
        assert out["ok"] is True and out["kind"] == "travel"
        assert rec.paths() == ["https://copilot.tencent.com" + PATH_TRAVEL_STATUS]
        assert "待发 credit=5" in (out["reason"] or "")

    async def test_pending_rewards_are_claimed_with_deltas(self):
        rec = Recorder(
            {
                PATH_TRAVEL_STATUS: ok_envelope(travel_state()),
                PATH_TRAVEL_CLAIM: ok_envelope({}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_travel(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is True
        assert out["claimed"] == ["travel"]
        assert out["credit_delta"] == 5 and out["energy_delta"] == 10

    async def test_depart_requires_configured_trigger_states(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_travel_depart_states", "")
        rec = Recorder({PATH_TRAVEL_STATUS: ok_envelope(travel_state(credit=0, energy=0))})
        async with rec.client() as client:
            out = await wt.run_travel(TOKEN, {}, dry_run=False, client=client)
        assert out["accepted"] == [] and out["unjudged"] is False
        assert "拒绝猜 state 值域" in (out["reason"] or "")
        assert not any(PATH_TRAVEL_DEPART in p for p in rec.paths())

    async def test_depart_fires_when_state_matches_config(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_travel_depart_states", "idle")
        rec = Recorder(
            {
                PATH_TRAVEL_STATUS: ok_envelope(travel_state(credit=0, energy=0)),
                PATH_TRAVEL_DEPART: ok_envelope({}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_travel(TOKEN, {}, dry_run=False, client=client)
        assert out["accepted"] == ["travel-depart"]

    async def test_unparseable_travel_state_is_unjudged(self):
        rec = Recorder({PATH_TRAVEL_STATUS: ok_envelope({"oops": 1})})
        async with rec.client() as client:
            out = await wt.run_travel(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is False and out["unjudged"] is True


# ---------------------------------------------------------------------------
# activity
# ---------------------------------------------------------------------------


class TestActivity:
    async def test_refuses_without_attested_path(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_activity_path", "")
        rec = Recorder({})
        async with rec.client() as client:
            out = await wt.run_activity(TOKEN, {}, dry_run=False, events=("buddyapp_show",), client=client)
        assert out["ok"] is False and out["unjudged"] is True
        assert rec.calls == []  # 拒绝猜测 = 一个包都不发
        assert "拒绝猜端点" in (out["reason"] or "")

    async def test_reports_when_path_and_host_configured(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_activity_path", "/v2/telemetry/event")
        monkeypatch.setattr(
            settings,
            "workbuddy_tasks_activity_hosts",
            json.dumps({"default": "https://www.workbuddy.ai"}),
        )
        rec = Recorder({"/v2/telemetry/event": ok_envelope({})})
        async with rec.client() as client:
            out = await wt.run_activity(TOKEN, {}, dry_run=False, events=("buddyapp_show",), client=client)
        assert out["ok"] is True and out["unjudged"] is False
        assert "www.workbuddy.ai" in rec.paths()[0]

    async def test_bad_hosts_json_is_unjudged(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_activity_path", "/x")
        monkeypatch.setattr(settings, "workbuddy_tasks_activity_hosts", "{not json")
        rec = Recorder({})
        async with rec.client() as client:
            out = await wt.run_activity(TOKEN, {}, dry_run=False, client=client)
        assert out["unjudged"] is True and rec.calls == []

    async def test_dry_run_zero_calls(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_activity_path", "")
        rec = Recorder({})
        async with rec.client() as client:
            out = await wt.run_activity(TOKEN, {}, dry_run=True, client=client)
        assert out["ok"] is True and rec.calls == []


# ---------------------------------------------------------------------------
# blackcat(节律规则,无上游端点)
# ---------------------------------------------------------------------------


def cn_time(h: int, m: int) -> datetime:
    return datetime(2026, 10, 29, h, m, tzinfo=CN)


class TestBlackcatWindow:
    def test_boundaries_23_to_08(self):
        assert wt.blackcat_window_active("23:00-08:00", cn_time(23, 0)) is True
        assert wt.blackcat_window_active("23:00-08:00", cn_time(22, 59)) is False
        assert wt.blackcat_window_active("23:00-08:00", cn_time(4, 0)) is True
        assert wt.blackcat_window_active("23:00-08:00", cn_time(7, 59)) is True
        assert wt.blackcat_window_active("23:00-08:00", cn_time(8, 0)) is False

    def test_non_midnight_window(self):
        assert wt.blackcat_window_active("09:00-17:00", cn_time(10, 0)) is True
        assert wt.blackcat_window_active("09:00-17:00", cn_time(18, 0)) is False

    def test_bad_specs_unjudged(self):
        assert wt.blackcat_window_active("garbage", cn_time(1, 0)) is None
        assert wt.blackcat_window_active("25:00-08:00", cn_time(1, 0)) is None
        assert wt.blackcat_window_active("08:00-08:00", cn_time(1, 0)) is None


class TestBlackcatRun:
    async def test_outside_window_skips_with_reason_and_zero_calls(self):
        rec = Recorder({})
        async with rec.client() as client:
            out = await wt.run_blackcat(
                TOKEN, {}, dry_run=False, now=cn_time(12, 0), client=client
            )
        assert out["ok"] is True and out["unjudged"] is False
        assert "不在 blackcat 窗口" in (out["reason"] or "")
        assert rec.calls == []

    async def test_inside_window_without_chat_surface_is_unjudged(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(settings, "workbuddy_tasks_blackcat_model", "wb-fast-model")
        rec = Recorder({})
        async with rec.client() as client:
            out = await wt.run_blackcat(
                TOKEN, {}, dry_run=False, chat_completion=None, now=cn_time(23, 30), client=client
            )
        assert out["unjudged"] is True  # 补全面没接线 ⇒ 不空转刷次数
        assert rec.calls == []

    async def test_dry_run_reports_plan_without_calls(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_blackcat_model", "wb-fast-model")
        calls: list[str] = []

        async def fake_chat(model: str) -> None:
            calls.append(model)

        out = await wt.run_blackcat(
            TOKEN, {}, dry_run=True, chat_completion=fake_chat, now=cn_time(0, 30)
        )
        assert out["ok"] is True and out["unjudged"] is False
        assert calls == []
        assert "dry-run" in (out["reason"] or "")

    async def test_live_runs_n_completions(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_blackcat_model", "wb-fast-model")
        monkeypatch.setattr(settings, "workbuddy_tasks_blackcat_count", 1)
        calls: list[str] = []

        async def fake_chat(model: str) -> None:
            calls.append(model)

        out = await wt.run_blackcat(
            TOKEN, {}, dry_run=False, chat_completion=fake_chat, now=cn_time(1, 0)
        )
        assert calls == ["wb-fast-model"]
        assert out["ok"] is True and out["unjudged"] is False
        assert "1/1" in (out["reason"] or "")

    async def test_bad_window_config_is_unjudged(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_blackcat_window", "nonsense")
        out = await wt.run_blackcat(TOKEN, {}, dry_run=False, now=cn_time(1, 0))
        assert out["unjudged"] is True and out["ok"] is False


# ---------------------------------------------------------------------------
# run_family 派发 + 合同键集
# ---------------------------------------------------------------------------


class TestRunFamily:
    async def test_contract_keysets(self, monkeypatch: pytest.MonkeyPatch):
        rec = Recorder({PATH_GROWTH_TASKS: ok_envelope({"tasks": []})})
        monkeypatch.setattr(wt, "client_for", lambda dm: (rec.client(), False))
        out = await wt.run_family("growth", TOKEN, {}, dry_run=True)
        assert set(out) == {
            "ok", "kind", "accepted", "claimed",
            "credit_delta", "energy_delta", "reason", "unjudged",
        }
        assert out["kind"] == "growth"

    async def test_unknown_kind_is_unjudged(self):
        out = await wt.run_family("nope", TOKEN, {}, dry_run=True)
        assert out["ok"] is False and out["unjudged"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
