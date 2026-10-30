# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)

"""G2 create_automation 工具测试(2026-10-30 立)。

覆盖三格:①参数校验面(rrule 白名单各分支、carrier 必填/互斥、scheduled_at
必须带时区偏移、timezone IANA、goal 边界与归一、__user_id 缺失拒跑);
②HTTP 出口面(monkeypatch _api_request:body camelCase 映射、conversationId
只在 UUID 时携带、凭证缺失 fail-closed 不发请求、success() 壳剥离、错误透传);
③注册面(mcp_server._TOOLS / _TOOL_HANDLERS / tools.__all__ 三处都在,
schema required 与 additionalProperties 逐字对)。
"""

from __future__ import annotations

import uuid

import pytest

from app.tools import automation_tools as at
from app.tools.automation_tools import create_automation, validate_rrule

UID = "11111111-2222-4333-8444-555555555555"


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("AI_CALLBACK_SECRET", "test-internal-secret")
    monkeypatch.setenv("API_SERVICE_URL", "http://api.test:8802")


def _args(**overrides):
    base = {
        "name": "每日晨报",
        "prompt": "汇总今天的待办",
        "schedule_type": "recurring",
        "rrule": "FREQ=DAILY;BYHOUR=9;BYMINUTE=0",
        "__user_id": UID,
    }
    base.update(overrides)
    return base


class _Recorder:
    """替身 _api_request:记录入参、按脚本返回 (status, payload)。"""

    def __init__(self, status=201, payload=None):
        self.calls = []
        self.status = status
        self.payload = payload if payload is not None else {
            "code": 0,
            "message": "ok",
            "data": {"id": "auto-1", "name": "每日晨报", "status": "active"},
        }

    async def __call__(self, url, headers, body):
        self.calls.append({"url": url, "headers": headers, "body": body})
        return self.status, self.payload


# =============================================================================
# ① rrule 白名单(纯函数逐分支)
# =============================================================================

class TestRruleWhitelist:
    @pytest.mark.parametrize(
        "rrule",
        [
            "FREQ=HOURLY",
            "FREQ=DAILY;BYHOUR=9;BYMINUTE=30",
            "FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=8",
            "freq=daily;byhour=9",  # 大小写不敏感(与 api parseRruleParts 同档)
        ],
    )
    def test_valid(self, rrule):
        assert validate_rrule(rrule) is None

    def test_rejects_unknown_segment(self):
        # api 侧对未知段静默忽略 = 虚假承诺排程;工具层必须直接拒
        assert validate_rrule("FREQ=DAILY;BYMONTH=1") is not None

    @pytest.mark.parametrize(
        "rrule",
        [
            "",
            "   ",
            "FREQ=MONTHLY",  # 非 MVP 子集
            "BYHOUR=9",  # 缺 FREQ
            "FREQ=DAILY;FREQ=WEEKLY",  # 重复段
            "FREQ=DAILY;;BYHOUR=9",  # 空段
            "FREQ=DAILY;BYHOUR",  # 无 = 号
            "FREQ=DAILY;BYHOUR=",  # 空值
            "FREQ=DAILY;BYHOUR=24",
            "FREQ=DAILY;BYMINUTE=60",
            "FREQ=WEEKLY",  # WEEKLY 必带 BYDAY
            "FREQ=WEEKLY;BYDAY=XX",
            "FREQ=WEEKLY;BYDAY=MO,MO",
            "FREQ=HOURLY;BYHOUR=9",  # HOURLY 不接受 BY* 墙钟段
            "FREQ=DAILY;BYDAY=MO",  # DAILY 不接受 BYDAY
        ],
    )
    def test_invalid(self, rrule):
        assert validate_rrule(rrule) is not None


# =============================================================================
# ① 参数校验面(经 create_automation 入口)
# =============================================================================

class TestArgumentValidation:
    async def test_missing_user_id_rejected_without_request(self, monkeypatch):
        rec = _Recorder()
        monkeypatch.setattr(at, "_api_request", rec)
        args = _args()
        args.pop("__user_id")
        res = await create_automation(args)
        assert res["ok"] is False and res["errorCode"] == "MISSING_USER"
        assert rec.calls == []  # fail-closed:校验没过一次请求都不发

    async def test_name_prompt_bounds(self, monkeypatch):
        monkeypatch.setattr(at, "_api_request", _Recorder())
        assert (await create_automation(_args(name="  ")))["errorCode"] == "INVALID_NAME"
        assert (await create_automation(_args(name="x" * 201)))["errorCode"] == "INVALID_NAME"
        assert (await create_automation(_args(prompt="")))[ "errorCode"] == "INVALID_PROMPT"
        assert (await create_automation(_args(prompt="p" * 8001)))["errorCode"] == "INVALID_PROMPT"

    async def test_schedule_type_and_carriers(self, monkeypatch):
        monkeypatch.setattr(at, "_api_request", _Recorder())
        assert (await create_automation(_args(schedule_type="cron")))["errorCode"] == "INVALID_SCHEDULE_TYPE"
        assert (await create_automation(_args(schedule_type="once", rrule=None)))[
            "errorCode"
        ] == "MISSING_SCHEDULED_AT"
        assert (
            await create_automation(
                _args(schedule_type="once", scheduled_at="2026-11-01T09:00:00+08:00")
            )
        )["errorCode"] == "CARRIER_CONFLICT"  # once 仍带着 rrule
        assert (await create_automation(_args(rrule=None)))["errorCode"] == "MISSING_RRULE"
        assert (
            await create_automation(
                _args(schedule_type="recurring", rrule=None, scheduled_at="2026-11-01T09:00:00+08:00")
            )
        )["errorCode"] == "MISSING_RRULE"

    async def test_scheduled_at_requires_offset(self, monkeypatch):
        monkeypatch.setattr(at, "_api_request", _Recorder())
        once = dict(schedule_type="once", rrule=None)
        assert (await create_automation(_args(**once, scheduled_at="2026-11-01T09:00:00")))[
            "errorCode"
        ] == "INVALID_SCHEDULED_AT"  # 裸本地时间会被按服务器时区误读 ⇒ 拒
        assert (await create_automation(_args(**once, scheduled_at="not-a-date")))[
            "errorCode"
        ] == "INVALID_SCHEDULED_AT"
        ok = await create_automation(_args(**once, scheduled_at="2026-11-01T09:00:00+08:00"))
        assert ok["ok"] is True

    async def test_rrule_rejected_at_entry(self, monkeypatch):
        rec = _Recorder()
        monkeypatch.setattr(at, "_api_request", rec)
        res = await create_automation(_args(rrule="FREQ=DAILY;BYMONTH=1"))
        assert res["ok"] is False and res["errorCode"] == "INVALID_RRULE"
        assert rec.calls == []

    async def test_timezone_must_be_iana(self, monkeypatch):
        monkeypatch.setattr(at, "_api_request", _Recorder())
        assert (await create_automation(_args(timezone="Beijing/Local")))["errorCode"] == "INVALID_TIMEZONE"
        assert (await create_automation(_args(timezone="Asia/Shanghai")))["ok"] is True

    @pytest.mark.parametrize(
        "goal",
        [
            {"target": ""},
            {"target": "x" * 2001},
            {"target": "达标线", "max_runs": 0},
            {"target": "达标线", "max_runs": 11},
            {"target": "达标线", "max_runs": 2.5},
            {"target": "达标线", "max_runs": True},
            "not-an-object",
        ],
    )
    async def test_goal_bounds(self, monkeypatch, goal):
        monkeypatch.setattr(at, "_api_request", _Recorder())
        res = await create_automation(_args(goal=goal))
        assert res["ok"] is False and res["errorCode"] == "INVALID_GOAL"


# =============================================================================
# ② HTTP 出口面
# =============================================================================

class TestApiCall:
    async def test_body_maps_to_camel_case_and_unwraps_success_shell(self, monkeypatch):
        rec = _Recorder()
        monkeypatch.setattr(at, "_api_request", rec)
        res = await create_automation(_args(goal={"target": "覆盖全部章节", "max_runs": 5}))
        assert res["ok"] is True
        assert res["automation"] == {"id": "auto-1", "name": "每日晨报", "status": "active"}
        body = rec.calls[0]["body"]
        assert body["scheduleType"] == "recurring"
        assert body["rrule"] == "FREQ=DAILY;BYHOUR=9;BYMINUTE=0"
        assert body["timezone"] == "Asia/Shanghai"  # 缺省档
        assert body["goal"] == {"target": "覆盖全部章节", "maxRuns": 5}
        assert "scheduledAt" not in body
        assert "conversationId" not in body  # 无 __session_id
        assert rec.calls[0]["url"] == "http://api.test:8802/api/automations"

    async def test_goal_default_max_runs(self, monkeypatch):
        rec = _Recorder()
        monkeypatch.setattr(at, "_api_request", rec)
        await create_automation(_args(goal={"target": "写完第三章"}))
        assert rec.calls[0]["body"]["goal"] == {"target": "写完第三章", "maxRuns": 3}

    async def test_conversation_id_only_for_uuid_session(self, monkeypatch):
        rec = _Recorder()
        monkeypatch.setattr(at, "_api_request", rec)
        await create_automation(_args(__session_id="auto_deadbeef"))  # 非 UUID ⇒ 不带
        assert "conversationId" not in rec.calls[0]["body"]
        sid = str(uuid.uuid4())
        await create_automation(_args(__session_id=sid))
        assert rec.calls[1]["body"]["conversationId"] == sid

    async def test_missing_secret_fails_closed(self, monkeypatch):
        monkeypatch.delenv("AI_CALLBACK_SECRET")
        rec = _Recorder()
        monkeypatch.setattr(at, "_api_request", rec)
        res = await create_automation(_args())
        assert res["ok"] is False and res["errorCode"] == "INTERNAL_AUTH_UNAVAILABLE"
        assert rec.calls == []

    async def test_headers_carry_internal_credentials(self, monkeypatch):
        rec = _Recorder()
        monkeypatch.setattr(at, "_api_request", rec)
        await create_automation(_args())
        headers = rec.calls[0]["headers"]
        assert headers["x-internal-service-token"] == "test-internal-secret"
        assert headers["x-user-id"] == UID

    async def test_api_error_message_passthrough(self, monkeypatch):
        rec = _Recorder(status=400, payload={"code": 400, "message": "rrule 格式不支持"})
        monkeypatch.setattr(at, "_api_request", rec)
        res = await create_automation(_args())
        assert res["ok"] is False
        assert res["errorCode"] == "HTTP_400"
        assert res["message"] == "rrule 格式不支持"

    async def test_network_error(self, monkeypatch):
        rec = _Recorder(status=0, payload=None)
        monkeypatch.setattr(at, "_api_request", rec)
        res = await create_automation(_args())
        assert res["ok"] is False and res["errorCode"] == "NETWORK_ERROR"


# =============================================================================
# ③ 注册面(三处都在 + schema 逐字对)
# =============================================================================

class TestRegistration:
    def test_tools_package_exports(self):
        from app.tools import __all__ as tools_all

        assert "create_automation" in tools_all

    def test_mcp_server_registration(self):
        from app.services.mcp_server import _TOOLS, _TOOL_HANDLERS

        tool = next((t for t in _TOOLS if t.name == "create_automation"), None)
        assert tool is not None
        assert tool.input_schema["required"] == ["name", "prompt", "schedule_type"]
        assert tool.input_schema["additionalProperties"] is False
        goal_schema = tool.input_schema["properties"]["goal"]
        assert goal_schema["required"] == ["target"]
        assert goal_schema["additionalProperties"] is False
        assert _TOOL_HANDLERS["create_automation"] is create_automation

    def test_i18n_keys_present(self):
        import json
        from pathlib import Path

        # automation_tools.py 位于 apps/ai-service/app/tools/ ⇒ parents[4] = 仓库根
        root = Path(at.__file__).resolve().parents[4] / "packages" / "i18n" / "messages" / "shared"
        for loc in ("zh-CN", "zh-TW", "en", "ja", "ko"):
            data = json.loads((root / f"{loc}.json").read_text(encoding="utf-8"))
            flat = json.dumps(data, ensure_ascii=False)
            assert "toolCreateAutomation" in flat, loc
            assert "toolCreateAutomationActivity" in flat, loc
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
