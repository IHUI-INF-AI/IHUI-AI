# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""workbuddy_tasks(O68 任务赚积分四族)单元测试 — httpx.MockTransport,零真实网络。

覆盖:列表面合同形 / 信封与行形读不懂 ⇒ unjudged / token 与 web 双模式分流 /
401 回退 Cookie / growth dry-run 零写侧断言 / accept 批量 / claim 路径未配置拒绝执行 /
claim 路径配置后执行 / travel 状态解析+claim 差量+depart 配置闸+dry-run 零写 /
activity 未配置拒绝、坏 hosts、配置后上报 / blackcat 窗口边界(跨零点)、
窗口外跳过零调用、无补全面未判定、注入假补全后计数 / run_family 合同键集 /
redeem+lottery 真机实证 body 形态(含 403 业务拒绝不得误判会话失效的回归)。
证据级别:读写双侧均 2026-10-31 真机报文级验证(见 workbuddy_tasks 模块 docstring)。
"""

from __future__ import annotations

import base64
import json
import time
import uuid
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx
import pytest

from app.core.config import settings
from app.services import workbuddy_tasks as wt
from app.services.workbuddy_tasks import (
    PATH_GROWTH_LOTTERY_DRAW,
    PATH_GROWTH_LOTTERY_SUMMARY,
    PATH_GROWTH_REDEEM,
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

    def methods(self) -> list[str]:
        """读侧必须 GET、写侧必须 POST —— 真机实测 404/200 的分界就在这一个词上。"""
        return [m for m, _u, _b in self.calls]


def task_row(**over: Any) -> dict[str, Any]:
    """2026-10-28 真机 GET /activity/growth/tasks 的实测行形态。

    二进制取证那份字段表(`task_code/task_desc/progress/limit_num/accept_status/
    reward_credit/reward_energy/valid_to`)在真响应里**一个都不存在** —— 夹具照真形态写,
    否则测试会跟着错误的取证面自证(本仓 §0.9:判据必须在真跑它的那一刻才成立)。
    """
    row: dict[str, Any] = {
        "task_id": 1,
        "code": "first_chat",
        "title": "完成一次对话",
        "description": "使用 WorkBuddy 完成至少一次对话交互",
        "icon_url": "",
        "level_name": "养虾尝试",
        "status": "available",
        "url": "",
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
        # 读侧方法 = GET。真机实测同路径 POST ⇒ 404,GET ⇒ 200 + code:0。
        assert rec.methods() == ["GET"]
        row = out["tasks"][0]
        assert set(row) == {
            "task_code", "title", "progress", "target", "status",
            "accept_status", "reward_credit", "reward_energy", "valid_to",
        }
        assert row["task_code"] == "first_chat" and row["title"] == "完成一次对话"
        assert row["status"] == "available"
        # 真形态没给的五族字段 ⇒ None;拿 0 冒充"没量到"是 §0.3 禁的假账。
        assert row["progress"] is None and row["target"] is None
        assert row["reward_credit"] is None and row["reward_energy"] is None
        assert row["valid_to"] is None and row["accept_status"] is None

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
        no_status = task_row()
        del no_status["status"]  # 真形态必读三件(code/title/status)之一缺位 ⇒ 该行读不懂
        rec = Recorder({PATH_GROWTH_TASKS: ok_envelope([task_row(), no_status])})
        async with rec.client() as client:
            out = await wt.list_growth_tasks(TOKEN, {}, client=client)
        assert len(out["tasks"]) == 1
        assert out["unjudged"] is True and out["ok"] is True

    async def test_title_falls_back_to_description_and_missing_both_is_unjudged(self):
        only_desc = task_row()
        del only_desc["title"]
        no_name = task_row()
        del no_name["title"]
        del no_name["description"]
        rec = Recorder({PATH_GROWTH_TASKS: ok_envelope([only_desc, no_name])})
        async with rec.client() as client:
            out = await wt.list_growth_tasks(TOKEN, {}, client=client)
        assert out["tasks"][0]["title"] == "使用 WorkBuddy 完成至少一次对话交互"
        assert len(out["tasks"]) == 1 and out["unjudged"] is True

    async def test_absent_reward_fields_are_null_not_zero(self):
        """真形态不带 reward 字段 ⇒ null。旧口径"缺字段按 0"会把"上游没给"说成"奖励为 0"。"""
        rec = Recorder({PATH_GROWTH_TASKS: ok_envelope([task_row()])})
        async with rec.client() as client:
            out = await wt.list_growth_tasks(TOKEN, {}, client=client)
        assert out["tasks"][0]["reward_credit"] is None
        assert out["tasks"][0]["reward_energy"] is None
        assert out["unjudged"] is False  # code/title/status 齐 ⇒ 这行是"读懂了",只是没奖励字段

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

    async def test_accept_refused_until_field_configured(self, monkeypatch: pytest.MonkeyPatch):
        """accept 字段名留空 ⇒ 一个 accept 请求都不发,并点名"不猜字段"(§0.3)。
        出厂默认现已填 task_codes(README 实证),故此处临时清空字段名来验拒绝路径。"""
        monkeypatch.setattr(settings, "workbuddy_tasks_accept_field", "")
        assert settings.workbuddy_tasks_accept_field == ""
        rec = Recorder(
            {
                PATH_GROWTH_TASKS_ACCEPT: ok_envelope({}),
                PATH_GROWTH_STREAK: ok_envelope({}),
                "/billing/meter/checkin-status": ok_envelope({"total_credits": 10}),
                PATH_GROWTH_TASKS: ok_envelope({"tasks": [task_row()]}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_growth(TOKEN, {}, dry_run=False, client=client)
        assert out["accepted"] == []
        assert out["unjudged"] is True
        assert "字段名未判定" in (out["reason"] or "")
        assert PATH_GROWTH_TASKS_ACCEPT not in " ".join(rec.paths())
        # 唯一被允许的 POST 是余额探针(读语义、上游用 POST 空体);任务写侧一次都没发。
        for method, url in zip(rec.methods(), rec.paths(), strict=True):
            if method == "POST":
                assert "/billing/meter/checkin-status" in url, f"意外发出写侧 POST:{url}"

    async def test_accept_live_flow_with_measured_credit_delta(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_accept_field", "codes")
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
                # streak 真形态是嵌套对象(旧实现按顶层平铺取 ⇒ 恒 None)
                PATH_GROWTH_STREAK: ok_envelope(
                    {"streak": {"days": 5, "next_tier": "7d"}, "makeup_cards": {"balance": 0, "max": 4}}
                ),
                PATH_GROWTH_TASKS: ok_envelope({"tasks": [task_row()]}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_growth(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is True
        assert out["accepted"] == ["first_chat"]
        assert out["credit_delta"] == 30  # 130-100 实测差量,不是猜的
        assert out["unjudged"] is False
        assert "streak_days=5" in (out["reason"] or "")
        accept_call = [c for c in rec.calls if PATH_GROWTH_TASKS_ACCEPT in c[1]][0]
        assert accept_call[0] == "POST"
        assert accept_call[2] == {"codes": ["first_chat"]}

    async def test_claim_refused_without_configured_path(self, monkeypatch: pytest.MonkeyPatch):
        """claim 路径留空 ⇒ 拒绝执行并点名"不猜 URL"(§0.3)。
        出厂默认现已填 /activity/growth/tasks/{code}/claim(README 实证),故此处临时清空验拒绝路径。"""
        monkeypatch.setattr(settings, "workbuddy_tasks_claim_path", "")
        done = task_row(status="completed", progress=3, limit_num=3)
        rec = Recorder(
            {
                "/billing/meter/checkin-status": ok_envelope({"total_credits": 10}),
                PATH_GROWTH_TASKS: ok_envelope({"tasks": [done]}),
                PATH_GROWTH_STREAK: ok_envelope({}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_growth(TOKEN, {}, dry_run=False, client=client)
        assert out["claimed"] == []
        assert out["unjudged"] is False  # 这是"判过并拒绝",不是读不懂
        assert "拒绝猜 URL" in (out["reason"] or "")

    async def test_claim_executes_when_path_configured(self, monkeypatch: pytest.MonkeyPatch):
        """有 web_cookie ⇒ Web 域 + /v2 + x-client-platform: web,模板 {code} 被替换、体为空。

        体为空是**真机取证**结论:对未完成任务,空体 / `{code}` / `{task_code}` 三种 body
        上游一律回同一句 400 `task not completed` ⇒ 任务码取自 URL 路径,body 无关。
        """
        monkeypatch.setattr(
            settings, "workbuddy_tasks_claim_path", "/activity/growth/tasks/{code}/claim"
        )
        done = task_row(status="completed", progress=3, limit_num=3)
        captured: dict[str, Any] = {}

        def claim_handler(request: httpx.Request) -> httpx.Response:
            captured["url"] = str(request.url)
            captured["headers"] = dict(request.headers)
            captured["body"] = json.loads(request.content) if request.content else {}
            return httpx.Response(200, json=ok_envelope({}))

        # "tasks/first_chat/claim" 须排在 PATH_GROWTH_TASKS 之前(后者是其父串,否则误匹配)。
        rec = Recorder(
            {
                "tasks/first_chat/claim": claim_handler,
                "/billing/meter/checkin-status": ok_envelope({"total_credits": 10}),
                PATH_GROWTH_STREAK: ok_envelope({}),
                PATH_GROWTH_TASKS: ok_envelope({"tasks": [done]}),
            }
        )
        dm = {"web_cookie": "session=abc"}  # 有网页登录态 ⇒ 走 Web 域(README 形态)
        async with rec.client() as client:
            out = await wt.run_growth(TOKEN, dm, dry_run=False, client=client)
        assert out["claimed"] == ["first_chat"]
        assert captured, "claim 未打到 Web 域"
        assert captured["url"].startswith(
            "https://www.workbuddy.cn/v2/activity/growth/tasks/first_chat/claim"
        )
        assert captured["body"] == {}  # 领奖空体(任务码在路径里,真机实证)
        assert captured["headers"].get("x-client-platform") == "web"

    async def test_claim_falls_back_to_token_domain_without_web_cookie(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        """回归:无 web_cookie(默认令牌采集形态)时,旧实现直接"跳过"⇒ 永远领不到奖。

        真机:令牌域 copilot.tencent.com 打同一路径回业务错误 `task not completed`
        (非 404/401)⇒ 令牌域同样可用,必须兜底而不是跳过。
        """
        monkeypatch.setattr(
            settings, "workbuddy_tasks_claim_path", "/activity/growth/tasks/{code}/claim"
        )
        done = task_row(status="completed", progress=3, limit_num=3)
        captured: dict[str, Any] = {}

        def claim_handler(request: httpx.Request) -> httpx.Response:
            captured["url"] = str(request.url)
            return httpx.Response(200, json=ok_envelope({}))

        rec = Recorder(
            {
                "tasks/first_chat/claim": claim_handler,
                "/billing/meter/checkin-status": ok_envelope({"total_credits": 10}),
                PATH_GROWTH_STREAK: ok_envelope({}),
                PATH_GROWTH_TASKS: ok_envelope({"tasks": [done]}),
            }
        )
        async with rec.client() as client:  # 无 web_cookie
            out = await wt.run_growth(TOKEN, {}, dry_run=False, client=client)
        assert out["claimed"] == ["first_chat"]
        assert "workbuddy.cn" not in captured["url"], "令牌模式不应强制打 Web 域"

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

    async def test_report_then_rejudge_then_claim(self, monkeypatch: pytest.MonkeyPatch):
        """注入 activity_reporter 后:先为本轮 to_accept 计分,重列后该任务流转到 completed
        ⇒ 进入 to_claim,并最终在 Web 域领奖。验证"上报→重判→claim"闭环(与 wb2api 同语义)。"""
        monkeypatch.setattr(
            settings, "workbuddy_tasks_claim_path", "/activity/growth/tasks/{code}/claim"
        )
        first_list = ok_envelope({"tasks": [task_row(status="available")]})
        second_list = ok_envelope({"tasks": [task_row(status="completed")]})
        lists = iter([first_list, second_list])

        def list_router(request: httpx.Request) -> httpx.Response:
            try:
                return httpx.Response(200, json=next(lists))
            except StopIteration:
                return httpx.Response(200, json=ok_envelope({"tasks": []}))

        captured_claim: dict[str, Any] = {}

        def claim_handler(request: httpx.Request) -> httpx.Response:
            captured_claim["url"] = str(request.url)
            return httpx.Response(200, json=ok_envelope({}))

        # "tasks/first_chat/claim" 须排在 PATH_GROWTH_TASKS 之前(后者是其父串)。
        rec = Recorder(
            {
                "tasks/first_chat/claim": claim_handler,
                "/billing/meter/checkin-status": ok_envelope({"total_credits": 10}),
                PATH_GROWTH_STREAK: ok_envelope({}),
                PATH_GROWTH_TASKS: list_router,
            }
        )
        dm = {"web_cookie": "session=abc"}
        reported: list[str] = []

        async def reporter(task_code: str) -> None:
            reported.append(task_code)

        async with rec.client() as client:
            out = await wt.run_growth(
                TOKEN, dm, dry_run=False, client=client, activity_reporter=reporter
            )
        assert reported == ["first_chat"]
        assert out["accepted"] == []  # available 态未走 accept,改走 报告→completed→claim
        assert out["claimed"] == ["first_chat"]
        assert "重判" in (out["reason"] or "")
        assert captured_claim["url"].startswith(
            "https://www.workbuddy.cn/v2/activity/growth/tasks/first_chat/claim"
        )


# ---------------------------------------------------------------------------
# travel
# ---------------------------------------------------------------------------


def travel_state(**over: Any) -> dict[str, Any]:
    """真机 GET /activity/growth/buddy/travel/status 的实测形态。

    旧夹具那套 `status/remain/energy/credit` 在真响应里不存在 ⇒ 旧解析恒返回 None,
    整族永远"未判定"。真形态必读只有 `state`。
    """
    st: dict[str, Any] = {
        "state": "idle",
        "buddy_id": 0,
        "record_id": 0,
        "location": None,
        "depart_at": 0,
        "arrive_at": 0,
        "server_now": 1793201004,
        "letter": None,
        "use_deeplink": "",
        "daily_limit_reached": False,
        "duration_hours": 0,
        "reward_credit": 0,
    }
    st.update(over)
    return st


class TestTravel:
    async def test_dry_run_reads_status_only(self):
        rec = Recorder({PATH_TRAVEL_STATUS: ok_envelope(travel_state())})
        async with rec.client() as client:
            out = await wt.run_travel(TOKEN, {}, dry_run=True, client=client)
        assert out["ok"] is True and out["kind"] == "travel"
        assert rec.paths() == ["https://copilot.tencent.com" + PATH_TRAVEL_STATUS]
        assert rec.methods() == ["GET"]
        assert "待发 credit=0" in (out["reason"] or "")
        assert out["unjudged"] is False

    async def test_pending_rewards_are_claimed_with_deltas(self):
        rec = Recorder(
            {
                PATH_TRAVEL_STATUS: ok_envelope(travel_state(reward_credit=5)),
                PATH_TRAVEL_CLAIM: ok_envelope({}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_travel(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is True
        assert out["claimed"] == ["travel"]
        assert out["credit_delta"] == 5
        # 真形态不带 energy 字段 ⇒ None,不冒充 0
        assert out["energy_delta"] is None

    async def test_missing_reward_credit_field_is_unjudged_not_zero(self):
        no_credit = travel_state()
        del no_credit["reward_credit"]
        rec = Recorder({PATH_TRAVEL_STATUS: ok_envelope(no_credit)})
        async with rec.client() as client:
            out = await wt.run_travel(TOKEN, {}, dry_run=False, client=client)
        assert out["claimed"] == [] and out["accepted"] == []
        assert out["unjudged"] is True
        assert "判不出有无待发奖励" in (out["reason"] or "")

    async def test_depart_requires_configured_trigger_states(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_travel_depart_states", "")
        rec = Recorder({PATH_TRAVEL_STATUS: ok_envelope(travel_state())})
        async with rec.client() as client:
            out = await wt.run_travel(TOKEN, {}, dry_run=False, client=client)
        assert out["accepted"] == [] and out["unjudged"] is False
        assert "拒绝猜 state 值域" in (out["reason"] or "")
        assert not any(PATH_TRAVEL_DEPART in p for p in rec.paths())

    async def test_depart_fires_when_state_matches_config(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_travel_depart_states", "idle")
        rec = Recorder(
            {
                PATH_TRAVEL_DEPART: ok_envelope({}),
                PATH_TRAVEL_STATUS: ok_envelope(travel_state()),
            }
        )
        async with rec.client() as client:
            out = await wt.run_travel(TOKEN, {}, dry_run=False, client=client)
        assert out["accepted"] == ["travel-depart"]

    async def test_depart_skipped_when_daily_limit_reached(self, monkeypatch: pytest.MonkeyPatch):
        """回归(2026-10-31 真机):daily_limit_reached=true 时不得再打 depart。

        旧实现无条件出发 ⇒ 上游必失败,每轮把 travel 记成 ok=False/unjudged=True(假失败),
        一键全族的聚合 ok 也被拖成 False。已用尽属正常态:跳过并写明,不算失败。
        """
        monkeypatch.setattr(settings, "workbuddy_tasks_travel_depart_states", "idle")
        rec = Recorder(
            {PATH_TRAVEL_STATUS: ok_envelope(travel_state(daily_limit_reached=True))}
        )
        async with rec.client() as client:
            out = await wt.run_travel(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is True and out["unjudged"] is False
        assert "今日出发次数已用尽" in (out["reason"] or "")
        assert not any(PATH_TRAVEL_DEPART in p for p in rec.paths())

    async def test_unparseable_travel_state_is_unjudged(self):
        rec = Recorder({PATH_TRAVEL_STATUS: ok_envelope({"oops": 1})})
        async with rec.client() as client:
            out = await wt.run_travel(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is False and out["unjudged"] is True


# ---------------------------------------------------------------------------
# 真机形态专项锁(2026-10-28 读侧实弹;判据直用生产实现,§22c 不在测试里复算)
# ---------------------------------------------------------------------------


class TestLiveShapes:
    async def test_streak_nested_shape_is_parsed(self):
        rec = Recorder(
            {
                PATH_GROWTH_STREAK: ok_envelope(
                    {
                        "streak": {
                            "days": 2,
                            "month_total_days": 2,
                            "next_tier": "7d",
                            "next_tier_remaining": 5,
                            "makeup_dates": [],
                        },
                        "makeup_cards": {"balance": 0, "max": 4},
                        "redemption_status": {"tiers": [{"tier": "7d", "days": 7}]},
                        "timezone": "Asia/Shanghai",
                    }
                )
            }
        )
        async with rec.client() as client:
            out = await wt.fetch_growth_streak(TOKEN, {}, client=client)
        assert rec.methods() == ["GET"]
        assert out is not None
        assert out["days"] == 2 and out["next_tier"] == "7d"
        assert out["makeup_card_max"] == 4 and out["tiers"] == 1

    async def test_streak_flat_binary_shape_is_not_guessed(self):
        """二进制那份平铺字段表在真域不存在 ⇒ 按嵌套判据读不到就 None,不猜回来。"""
        rec = Recorder({PATH_GROWTH_STREAK: ok_envelope({"streak": 5, "days": 5, "tier": 1})})
        async with rec.client() as client:
            assert await wt.fetch_growth_streak(TOKEN, {}, client=client) is None

    def test_binary_field_names_still_parse_as_fallback(self):
        row, understood = wt.parse_task_row(
            {"task_code": "legacy", "task_desc": "旧字段", "status": "0"}
        )
        assert understood is True
        assert row is not None and row["task_code"] == "legacy" and row["title"] == "旧字段"

    def test_real_travel_state_parses_without_inventing_energy(self):
        st = wt.parse_travel_state(
            {"state": "idle", "reward_credit": 0, "daily_limit_reached": True, "duration_hours": 0}
        )
        assert st is not None and st["state"] == "idle"
        assert st["reward_credit"] == 0 and st["daily_limit_reached"] is True


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

    async def test_activity_includes_user_id_and_web_header(self, monkeypatch: pytest.MonkeyPatch):
        """真机取证形态:body = {eventCode(驼峰), timestamp(毫秒), userId};Web 域带指纹头。

        2026-10-31 报文级证据:发 `event_code` ⇒ 400 10001「eventCode is empty or not
        string」;补 eventCode 但缺 timestamp ⇒ 400 10001「event missing both reportDelay
        and timestamp fields」;秒级 timestamp ⇒ 400 10001「too far from now」;毫秒 ⇒ 200。
        """
        monkeypatch.setattr(settings, "workbuddy_tasks_activity_path", "/v2/report")
        monkeypatch.setattr(
            settings,
            "workbuddy_tasks_activity_hosts",
            json.dumps({"default": "https://www.workbuddy.cn"}),
        )
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["headers"] = dict(request.headers)
            captured["body"] = json.loads(request.content) if request.content else {}
            return httpx.Response(200, json=ok_envelope({}))

        rec = Recorder({"/v2/report": handler})
        before_ms = int(time.time() * 1000)
        async with rec.client() as client:
            out = await wt.run_activity(
                TOKEN, {"web_cookie": "s=1"}, dry_run=False,
                events=("buddyapp_show",), client=client,
            )
        after_ms = int(time.time() * 1000)
        assert out["ok"] is True
        assert captured["headers"].get("x-client-platform") == "web"
        body = captured["body"]
        assert body["eventCode"] == "buddyapp_show"
        assert "event_code" not in body  # 旧字段名在上游 400,不得回潮
        assert body["userId"] == UID
        # 毫秒级(秒级会被上游判 too far from now)
        assert before_ms <= body["timestamp"] <= after_ms
        assert body["timestamp"] > 10**11

    async def test_activity_no_double_v2_prefix(self, monkeypatch: pytest.MonkeyPatch):
        """回归:activity_path 配置已是 /v2/report,绝不能再叠 /v2(旧 bug 会变成 /v2/v2/report)。"""
        monkeypatch.setattr(settings, "workbuddy_tasks_activity_path", "/v2/report")
        monkeypatch.setattr(
            settings,
            "workbuddy_tasks_activity_hosts",
            json.dumps({"default": "https://www.codebuddy.cn"}),
        )
        captured: dict[str, Any] = {}
        rec = Recorder(
            {
                "/v2/report": lambda r: (
                    captured.update({"url": str(r.url)}), httpx.Response(200, json=ok_envelope({}))
                )[1]
            }
        )
        async with rec.client() as client:
            out = await wt.run_activity(TOKEN, {}, dry_run=False, events=("chat_request_send",), client=client)
        assert out["ok"] is True
        assert captured["url"] == "https://www.codebuddy.cn/v2/report"


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


class TestUrgencyOrder:
    def test_none_mode_keeps_order(self):
        items = [("a", 10), ("b", 5), ("c", None)]
        assert wt.order_accounts_by_credit_urgency(items, "none") == ["a", "b", "c"]

    def test_lowest_balance_first(self):
        items = [("a", 10), ("b", 5), ("c", 1), ("d", None)]
        assert wt.order_accounts_by_credit_urgency(items, "lowest_balance") == ["c", "b", "a", "d"]

    def test_highest_balance_first(self):
        items = [("a", 10), ("b", 5), ("c", 1), ("d", None)]
        assert wt.order_accounts_by_credit_urgency(items, "highest_balance") == ["a", "b", "c", "d"]

    def test_unknown_mode_keeps_order(self):
        items = [("a", 10), ("b", 5)]
        assert wt.order_accounts_by_credit_urgency(items, "bogus") == ["a", "b"]

    def test_none_balance_sorted_last_stable(self):
        items = [("a", None), ("b", None), ("c", 3)]
        assert wt.order_accounts_by_credit_urgency(items, "lowest_balance") == ["c", "a", "b"]


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

    async def test_redeem_and_lottery_are_registered_kinds(self):
        """族五/六已登记进派发表(路由 Literal 与调度器 kind 元组同步扩展)。"""
        assert "redeem" in wt.VALID_FAMILY_KINDS
        assert "lottery" in wt.VALID_FAMILY_KINDS

    async def test_all_kind_runs_in_sweep_order(self, monkeypatch: pytest.MonkeyPatch):
        """kind="all" 按 SWEEP_ORDER 顺序跑完全族并聚合(顺序是硬契约)。

        activity 必须排在 growth 之前:上报计分先落地,growth 同轮列表才看得到
        「刚达标」的任务并在本轮 claim。顺序漂移 ⇒ 白丢一轮积分,故钉死。
        """
        seen: list[str] = []

        def make_stub(kind: str):
            async def _stub(jwt: str, dm: dict[str, Any], **_kwargs: Any) -> dict[str, Any]:
                seen.append(kind)
                return wt._run_result(kind, ok=True, claimed=[f"{kind}-x"])

            return _stub

        monkeypatch.setattr(
            wt, "_FAMILY_RUNNERS", {k: make_stub(k) for k in wt.VALID_FAMILY_KINDS}
        )
        out = await wt.run_all_families(TOKEN, {}, dry_run=False)
        assert seen == list(wt.SWEEP_ORDER)
        assert wt.SWEEP_ORDER.index("activity") < wt.SWEEP_ORDER.index("growth")
        assert out["kind"] == "all" and out["ok"] is True
        assert set(out["families"]) == set(wt.SWEEP_ORDER)
        assert len(out["claimed"]) == len(wt.SWEEP_ORDER)

    async def test_all_kind_survives_single_family_error(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        """单族抛异常不中断整轮:该族记 unjudged,其余照跑。"""

        def boom(_kind: str):
            async def _stub(jwt: str, dm: dict[str, Any], **_kwargs: Any) -> dict[str, Any]:
                raise RuntimeError("上游炸了")

            return _stub

        def ok_stub(kind: str):
            async def _stub(jwt: str, dm: dict[str, Any], **_kwargs: Any) -> dict[str, Any]:
                return wt._run_result(kind, ok=True)

            return _stub

        runners = {k: ok_stub(k) for k in wt.VALID_FAMILY_KINDS}
        runners["travel"] = boom("travel")
        monkeypatch.setattr(wt, "_FAMILY_RUNNERS", runners)
        out = await wt.run_all_families(TOKEN, {}, dry_run=False)
        assert out["unjudged"] is True
        assert out["families"]["travel"]["ok"] is False
        assert len(out["families"]) == len(wt.SWEEP_ORDER)  # 其余族仍全跑

    async def test_run_family_forwards_injection_points(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        """注入点必须能穿透 run_family —— 否则生产侧永远拿不到(闭环成死代码)。"""
        captured: dict[str, Any] = {}

        async def growth_stub(
            jwt: str, dm: dict[str, Any], **kwargs: Any
        ) -> dict[str, Any]:
            captured["growth_reporter"] = kwargs.get("activity_reporter")
            return wt._run_result("growth", ok=True)

        async def activity_stub(
            jwt: str, dm: dict[str, Any], **kwargs: Any
        ) -> dict[str, Any]:
            captured["activity_events"] = kwargs.get("events")
            return wt._run_result("activity", ok=True)

        monkeypatch.setattr(
            wt,
            "_FAMILY_RUNNERS",
            {"growth": growth_stub, "activity": activity_stub},
        )

        async def reporter(_code: str) -> None:
            return None

        await wt.run_family("growth", TOKEN, {}, activity_reporter=reporter)
        await wt.run_family("activity", TOKEN, {}, events=("chat_request_send",))
        assert captured["growth_reporter"] is reporter
        assert captured["activity_events"] == ("chat_request_send",)


# ---------------------------------------------------------------------------
# 族五 redeem(连签兑换):读写双侧 2026-10-31 真机实证 —— body = {tier, client_token}
# ---------------------------------------------------------------------------


def _streak_with_status(status: str, *, chances: int = 1) -> dict[str, Any]:
    """streak 真机形态裁剪版:解锁态在 `tier_<tier>_status` 平铺键上,不在 tiers[] 里。"""
    return {
        "streak": {"days": 7, "next_tier": "7d", "next_tier_remaining": 0},
        "redemption_status": {
            "tier_7d_status": status,
            "remaining_days": 7,
            "tiers": [
                {
                    "tier": "7d",
                    "days": 7,
                    "credit": 0,
                    "energy": 2,
                    "cards": 1,
                    "chances": chances,
                }
            ],
        },
    }


class TestRedeem:
    @pytest.fixture(autouse=True)
    def _no_sleep(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(wt.random, "uniform", lambda _a, _b: 0.0)

    async def test_dry_run_reads_tiers_only(self):
        rec = Recorder({PATH_GROWTH_STREAK: ok_envelope(_streak_with_status("unlocked"))})
        async with rec.client() as client:
            out = await wt.run_redeem(TOKEN, {}, dry_run=True, client=client)
        assert out["ok"] is True and out["kind"] == "redeem"
        assert rec.methods() == ["GET"]
        assert "7d" in (out["reason"] or "")
        assert out["accepted"] == []

    async def test_body_is_evidenced_shape(self):
        """钉死真机实证 body:`{"tier": <档>, "client_token": <uuid4>}`。

        对照实测:驼峰 `clientToken` 与省掉 `client_token` 均回 400
        「invalid redemption request」。此断言是对上游形态的硬约束,不是风格偏好。
        """
        rec = Recorder(
            {
                PATH_GROWTH_STREAK: ok_envelope(_streak_with_status("unlocked")),
                PATH_GROWTH_REDEEM: ok_envelope({"credit": 0}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_redeem(TOKEN, {}, dry_run=False, client=client)
        posts = [b for m, u, b in rec.calls if m == "POST" and "growth/redeem" in u]
        assert len(posts) == 1
        body = posts[0]
        assert body["tier"] == "7d"
        assert set(body) == {"tier", "client_token"}
        uuid.UUID(body["client_token"])  # 必须是合法 uuid 幂等键
        assert out["accepted"] == ["7d"]
        assert out["ok"] is True and out["unjudged"] is False

    async def test_locked_tier_is_skipped_without_write(self):
        """全 locked ⇒ 自动模式无目标,一个写请求都不发(幂等静默跳过,不是失败)。"""
        rec = Recorder({PATH_GROWTH_STREAK: ok_envelope(_streak_with_status("locked"))})
        async with rec.client() as client:
            out = await wt.run_redeem(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is True and out["unjudged"] is False
        assert out["accepted"] == []
        assert "locked" in (out["reason"] or "")
        assert PATH_GROWTH_REDEEM not in " ".join(rec.paths())

    async def test_business_403_is_not_session_dead(self):
        """真机 403「连续登录天数不足」是业务拒绝 —— 不得误报成令牌失效(既存缺陷回归)。"""
        rec = Recorder(
            {
                PATH_GROWTH_STREAK: ok_envelope(_streak_with_status("unlocked")),
                PATH_GROWTH_REDEEM: httpx.Response(
                    403,
                    json={"code": 403, "msg": "连续登录天数不足，请继续打卡或使用补签卡"},
                ),
            }
        )
        async with rec.client() as client:
            out = await wt.run_redeem(TOKEN, {}, dry_run=False, client=client)
        reason = out["reason"] or ""
        assert out["ok"] is True  # 业务拒绝 = 已判定,正常跳过
        assert out["unjudged"] is False
        assert out["accepted"] == []
        assert "天数不足" in reason
        assert "令牌" not in reason

    async def test_auth_403_still_reports_session_dead(self):
        """鉴权语义的 403 仍要报会话失效 —— 纠偏不能把真失效也放行。"""
        rec = Recorder(
            {
                PATH_GROWTH_STREAK: ok_envelope(_streak_with_status("unlocked")),
                PATH_GROWTH_REDEEM: httpx.Response(
                    403, json={"code": 403, "msg": "token expired, please login again"}
                ),
            }
        )
        async with rec.client() as client:
            out = await wt.run_redeem(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is False
        assert "令牌" in (out["reason"] or "")

    async def test_explicit_tiers_unknown_name_ignored(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_redeem_tiers", "7d,99d")
        rec = Recorder(
            {
                PATH_GROWTH_STREAK: ok_envelope(_streak_with_status("unlocked")),
                PATH_GROWTH_REDEEM: ok_envelope({}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_redeem(TOKEN, {}, dry_run=False, client=client)
        assert out["accepted"] == ["7d"]
        assert "99d" in (out["reason"] or "")

    async def test_unreadable_redemption_is_unjudged(self):
        rec = Recorder({PATH_GROWTH_STREAK: ok_envelope({})})
        async with rec.client() as client:
            out = await wt.run_redeem(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is False and out["unjudged"] is True


# ---------------------------------------------------------------------------
# 族六 lottery(抽奖):读写双侧 2026-10-31 真机实证 —— body = {client_token}
# ---------------------------------------------------------------------------


class TestLottery:
    @pytest.fixture(autouse=True)
    def _no_sleep(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(wt.random, "uniform", lambda _a, _b: 0.0)

    async def test_dry_run_reads_summary_only(self):
        rec = Recorder(
            {
                PATH_GROWTH_LOTTERY_SUMMARY: ok_envelope(
                    {"chances": 2, "module": {"enabled": True}}
                )
            }
        )
        async with rec.client() as client:
            out = await wt.run_lottery(TOKEN, {}, dry_run=True, client=client)
        assert out["ok"] is True and out["kind"] == "lottery"
        assert rec.methods() == ["GET"]
        assert out["unjudged"] is False
        assert "2" in (out["reason"] or "")

    async def test_body_is_evidenced_shape(self):
        """钉死真机实证 body:`{"client_token": <uuid4>}`(空体回 400 invalid request)。"""
        rec = Recorder(
            {
                PATH_GROWTH_LOTTERY_SUMMARY: ok_envelope({"chances": 1}),
                PATH_GROWTH_LOTTERY_DRAW: ok_envelope({"draw_uuid": "d-1"}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_lottery(TOKEN, {}, dry_run=False, client=client)
        posts = [b for m, u, b in rec.calls if m == "POST" and "lottery/draw" in u]
        assert len(posts) == 1
        assert set(posts[0]) == {"client_token"}
        uuid.UUID(posts[0]["client_token"])
        assert out["claimed"] == ["draw#1:d-1"]
        assert out["ok"] is True and out["unjudged"] is False

    async def test_draws_all_chances_up_to_limit(self):
        """对齐竞品「有次数自动抽完」:chances=3、上限 5 ⇒ 抽 3 次。"""
        rec = Recorder(
            {
                PATH_GROWTH_LOTTERY_SUMMARY: ok_envelope({"chances": 3}),
                PATH_GROWTH_LOTTERY_DRAW: ok_envelope({}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_lottery(TOKEN, {}, dry_run=False, client=client)
        assert len([1 for m, _u, _b in rec.calls if m == "POST"]) == 3
        assert out["claimed"] == ["draw#1", "draw#2", "draw#3"]

    async def test_limit_caps_draws(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_lottery_draw_count", 2)
        rec = Recorder(
            {
                PATH_GROWTH_LOTTERY_SUMMARY: ok_envelope({"chances": 10}),
                PATH_GROWTH_LOTTERY_DRAW: ok_envelope({}),
            }
        )
        async with rec.client() as client:
            out = await wt.run_lottery(TOKEN, {}, dry_run=False, client=client)
        assert len(out["claimed"]) == 2

    async def test_insufficient_balance_is_skipped_not_failed(self):
        """真机 400「insufficient lottery chance balance」= 业务拒绝(已过字段校验),不是失败。"""
        rec = Recorder(
            {
                PATH_GROWTH_LOTTERY_SUMMARY: ok_envelope({"chances": 1}),
                PATH_GROWTH_LOTTERY_DRAW: httpx.Response(
                    400, json={"code": 400, "msg": "insufficient lottery chance balance"}
                ),
            }
        )
        async with rec.client() as client:
            out = await wt.run_lottery(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is True and out["unjudged"] is False
        assert out["claimed"] == []
        assert "insufficient" in (out["reason"] or "")

    async def test_zero_chances_writes_nothing(self):
        rec = Recorder({PATH_GROWTH_LOTTERY_SUMMARY: ok_envelope({"chances": 0})})
        async with rec.client() as client:
            out = await wt.run_lottery(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is True and out["claimed"] == [] and out["unjudged"] is False
        assert "无抽奖次数" in (out["reason"] or "")
        assert PATH_GROWTH_LOTTERY_DRAW not in " ".join(rec.paths())

    async def test_count_zero_is_no_draw(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "workbuddy_tasks_lottery_draw_count", 0)
        rec = Recorder({PATH_GROWTH_LOTTERY_SUMMARY: ok_envelope({"chances": 3})})
        async with rec.client() as client:
            out = await wt.run_lottery(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is True and out["claimed"] == []
        assert PATH_GROWTH_LOTTERY_DRAW not in " ".join(rec.paths())

    async def test_missing_chances_is_unjudged(self):
        """没有 chances 字段 ⇒ 未判定(不拿 0 冒充"没次数")。"""
        rec = Recorder({PATH_GROWTH_LOTTERY_SUMMARY: ok_envelope({})})
        async with rec.client() as client:
            out = await wt.run_lottery(TOKEN, {}, dry_run=False, client=client)
        assert out["ok"] is False and out["unjudged"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
