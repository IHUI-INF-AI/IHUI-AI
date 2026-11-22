# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""人事部 AI 工具 hr_tools 回归钉 + 注册 / 专家包接线钉(2026-11-21)。

覆盖两层:
1. **工具本体**:五枚工具的身份 / 月份 / HTTP 剥壳 / 错误码 / 网络异常 / 凭证缺失
   全部**真实执行**(唯一被替换的是 httpx 客户端,不 mock 工具逻辑)。
2. **接线**:五枚同时出现在 mcp_server 的 `_TOOLS` 与 `_TOOL_HANDLERS`(双射),
   且 `hr-payroll` / `hr-self-service` 两个专家包按措辞命中并能把工具并进白名单。

票 scope 回归:断言走的是 "api-tools"(封闭集内),不是历史上那个不在集合里的
"mcp-hr" —— 后者会让工具永远 INTERNAL_AUTH_UNAVAILABLE。
"""

from __future__ import annotations

import asyncio
import sys
import types
from typing import Any

import pytest

from app.tools import hr_tools
from app.tools.hr_tools import (
    HR_INSURANCE_READINESS_DESCRIPTION,
    HR_MY_ATTENDANCE_DESCRIPTION,
    HR_MY_LEAVES_DESCRIPTION,
    HR_MY_PAYROLL_DESCRIPTION,
    HR_MY_PAYROLL_PERIODS_DESCRIPTION,
    HR_PAYROLL_CALC_DESCRIPTION,
    hr_insurance_readiness,
    hr_my_attendance,
    hr_my_leaves,
    hr_my_payroll,
    hr_my_payroll_periods,
    hr_payroll_calc,
)

TOOL_NAMES = (
    "hr_my_payroll",
    "hr_my_payroll_periods",
    "hr_my_attendance",
    "hr_my_leaves",
    "hr_payroll_calc",
    "hr_insurance_readiness",
)


def _run(coro):
    return asyncio.run(coro)


class _FakeResponse:
    def __init__(self, status_code: int, payload: Any) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self):
        if self._payload is None:
            raise ValueError("not json")
        return self._payload


def _install_fake_httpx(monkeypatch, *, status: int = 200, payload=None, boom=None) -> list:
    """把 httpx 换成记录型假客户端;返回 calls 列表供断言 URL/参数/方法。"""
    calls: list[dict[str, Any]] = []

    class _Client:
        def __init__(self, timeout=None):  # noqa: ARG002
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def request(self, method, url, headers=None, params=None, json=None):
            calls.append(
                {"method": method, "url": url, "headers": headers, "params": params, "json": json}
            )
            if boom is not None:
                raise boom
            return _FakeResponse(status, payload)

    monkeypatch.setitem(sys.modules, "httpx", types.SimpleNamespace(AsyncClient=_Client))
    return calls


def _stub_ticket(monkeypatch, uid: str = "u-1") -> None:
    """内部票出口固定返回一组头(不依赖本机 AI_CALLBACK_SECRET)。"""
    monkeypatch.setattr(
        hr_tools, "internal_service_headers", lambda user_id, scope, legacy_token=None: {
            "x-user-id": str(user_id),
            "x-internal-service-ticket": f"ticket:{scope}",
        }
    )


@pytest.fixture(autouse=True)
def _no_real_secret(monkeypatch):
    """单测默认不给真实密钥环境,避免误连真后端。"""
    monkeypatch.delenv("AI_CALLBACK_SECRET", raising=False)
    monkeypatch.setenv("API_SERVICE_URL", "http://api.test")


class TestIdentityAndValidation:
    def test_missing_user_fails_closed_without_request(self, monkeypatch) -> None:
        calls = _install_fake_httpx(monkeypatch, payload={"code": 0, "data": {}})
        got = _run(hr_my_payroll({"periodMonth": "2026-10"}))
        assert got["ok"] is False
        assert got["errorCode"] == "MISSING_USER"
        assert calls == []

    def test_illegal_user_shape_rejected(self, monkeypatch) -> None:
        calls = _install_fake_httpx(monkeypatch, payload={"code": 0, "data": {}})
        got = _run(hr_my_payroll({"periodMonth": "2026-10", "__user_id": "../../etc"}))
        assert got["ok"] is False
        assert got["errorCode"] == "MISSING_USER"
        assert calls == []

    def test_bad_period_rejected_before_request(self, monkeypatch) -> None:
        calls = _install_fake_httpx(monkeypatch, payload={"code": 0, "data": {}})
        got = _run(hr_my_payroll({"periodMonth": "2026-1", "__user_id": "u-1"}))
        assert got["ok"] is False
        assert got["errorCode"] == "INVALID_PERIOD"
        assert calls == []

    def test_no_ticket_means_no_request(self, monkeypatch) -> None:
        calls = _install_fake_httpx(monkeypatch, payload={"code": 0, "data": {}})
        monkeypatch.setattr(
            hr_tools, "internal_service_headers", lambda *a, **kw: {}
        )
        got = _run(hr_my_payroll_periods({"__user_id": "u-1"}))
        assert got["ok"] is False
        assert got["errorCode"] == "INTERNAL_AUTH_UNAVAILABLE"
        assert calls == []


class TestSelfServiceTools:
    def test_periods_lists_months(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        calls = _install_fake_httpx(
            monkeypatch,
            payload={
                "code": 0,
                "data": {
                    "periods": [
                        {"periodMonth": "2026-10", "status": "approved", "netPay": "8123.45"},
                        {"periodMonth": "2026-09", "status": "paid", "netPay": "7980.00"},
                    ]
                },
            },
        )
        got = _run(hr_my_payroll_periods({"__user_id": "u-1"}))
        assert got["ok"] is True
        assert got["count"] == 2
        assert got["periods"][0]["netPay"] == "8123.45"
        assert calls[0]["url"] == "http://api.test/api/hr-payroll/mine/periods"
        assert calls[0]["headers"]["x-user-id"] == "u-1"

    def test_payroll_keeps_decimal_strings_verbatim(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        calls = _install_fake_httpx(
            monkeypatch,
            payload={
                "code": 0,
                "data": {
                    "employeeName": "张三",
                    "periodMonth": "2026-10",
                    "periodStatus": "approved",
                    "baseSalary": "6000.00",
                    "grossPay": "8123.45",
                    "netPay": "7002.11",
                    "breakdown": {"steps": ["base"]},
                },
            },
        )
        got = _run(hr_my_payroll({"__user_id": "u-1", "periodMonth": "2026-10"}))
        assert got["ok"] is True
        assert got["payroll"]["netPay"] == "7002.11"
        assert got["payroll"]["grossPay"] == "8123.45"
        assert "7002.11" in got["message"]
        assert calls[0]["params"] == {"periodMonth": "2026-10"}

    def test_payroll_not_found_is_readable(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        _install_fake_httpx(
            monkeypatch,
            status=404,
            payload={"code": 404, "message": "该月暂无您的工资单", "errorCode": "NOT_FOUND"},
        )
        got = _run(hr_my_payroll({"__user_id": "u-1", "periodMonth": "2026-10"}))
        assert got["ok"] is False
        assert got["errorCode"] == "NOT_FOUND"
        assert "该月暂无您的工资单" in got["message"]

    def test_attendance_monthly_path_and_payload(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        calls = _install_fake_httpx(
            monkeypatch,
            payload={
                "code": 0,
                "data": {
                    "list": [
                        {
                            "periodMonth": "2026-10",
                            "scheduledDays": "22.0",
                            "actualDays": "21.5",
                            "lateCount": 1,
                            "otHours": "6.50",
                        }
                    ],
                    "employee": {"employeeNo": "E001", "name": "张三"},
                },
            },
        )
        got = _run(hr_my_attendance({"__user_id": "u-1", "periodMonth": "2026-10"}))
        assert got["ok"] is True
        assert got["monthly"][0]["actualDays"] == "21.5"
        assert calls[0]["url"] == "http://api.test/api/hr-attendance/my-monthly"
        assert calls[0]["params"] == {"periodMonth": "2026-10"}

    def test_attendance_records_default_limit(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        calls = _install_fake_httpx(
            monkeypatch,
            payload={
                "code": 0,
                "data": {"list": [{"date": "2026-11-20", "status": "normal"}], "total": 9},
            },
        )
        got = _run(hr_my_attendance({"__user_id": "u-1"}))
        assert got["ok"] is True
        assert got["total"] == 9
        assert calls[0]["url"] == "http://api.test/api/hr-attendance/my-records"
        assert calls[0]["params"]["limit"] == 31

    def test_leaves_status_filter_forwarded(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        calls = _install_fake_httpx(
            monkeypatch,
            payload={"code": 0, "data": {"list": [{"id": "l1", "status": "pending"}], "employee": None}},
        )
        got = _run(hr_my_leaves({"__user_id": "u-1", "status": "pending"}))
        assert got["ok"] is True
        assert got["count"] == 1
        assert calls[0]["params"] == {"status": "pending"}


class TestPayrollCalc:
    def test_calc_body_and_summary(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        calls = _install_fake_httpx(
            monkeypatch,
            payload={
                "code": 0,
                "data": {
                    "periodMonth": "2026-11",
                    "periodId": "p-1",
                    "employees": 12,
                    "inserted": 12,
                    "updated": 0,
                    "skippedNoConfig": 2,
                    "skippedSigned": 0,
                    "totalGross": "96000.00",
                    "totalNet": "78000.00",
                },
            },
        )
        got = _run(
            hr_payroll_calc({"__user_id": "u-1", "periodMonth": "2026-11", "regionName": "长春"})
        )
        assert got["ok"] is True
        assert got["payroll"]["skippedNoConfig"] == 2
        assert "缺薪资配置跳过 2 人" in got["message"]
        assert calls[0]["method"] == "POST"
        assert calls[0]["url"] == "http://api.test/api/hr-payroll/calculate"
        assert calls[0]["json"] == {"periodMonth": "2026-11", "regionName": "长春"}

    def test_calc_never_overwrites_approved_by_default(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        calls = _install_fake_httpx(monkeypatch, payload={"code": 0, "data": {"employees": 0}})
        _run(hr_payroll_calc({"__user_id": "u-1", "periodMonth": "2026-11"}))
        assert "overwriteApproved" not in calls[0]["json"]

    def test_calc_forbidden_surfaces_403(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        _install_fake_httpx(
            monkeypatch, status=403, payload={"code": 403, "message": "无权限:hr:payroll:manage"}
        )
        got = _run(hr_payroll_calc({"__user_id": "u-1", "periodMonth": "2026-11"}))
        assert got["ok"] is False
        assert got["errorCode"] == "HTTP_403"
        assert "hr:payroll:manage" in got["message"]

    def test_network_error_is_structured(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        _install_fake_httpx(monkeypatch, boom=RuntimeError("connect refused"))
        got = _run(hr_payroll_calc({"__user_id": "u-1", "periodMonth": "2026-11"}))
        assert got["ok"] is False
        assert got["errorCode"] == "NETWORK_ERROR"


class TestInsuranceReadiness:
    """社保配置体检(2026-11-21):算薪前那道关,必须只读、必须把缺失项原样转述。"""

    def test_ready_true_summary(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        calls = _install_fake_httpx(
            monkeypatch,
            payload={
                "code": 0,
                "data": {
                    "ready": True,
                    "effectiveYear": 2026,
                    "regionName": "长春",
                    "config": {"regionName": "长春", "effectiveYear": 2026},
                    "issues": [],
                    "roster": [],
                },
            },
        )
        got = _run(
            hr_insurance_readiness(
                {"__user_id": "u-1", "effectiveYear": 2026, "regionName": "长春"}
            )
        )
        assert got["ok"] is True
        assert got["ready"] is True
        assert "已就绪" in got["message"]
        assert calls[0]["method"] == "GET"
        assert calls[0]["url"] == "http://api.test/api/hr-salary-config/insurance/ready"
        assert calls[0]["params"] == {"effectiveYear": "2026", "regionName": "长春"}

    def test_not_ready_lists_issues_verbatim(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        _install_fake_httpx(
            monkeypatch,
            payload={
                "code": 0,
                "data": {
                    "ready": False,
                    "effectiveYear": 2026,
                    "regionName": None,
                    "config": None,
                    "issues": ["2026 年没有启用的社保费率配置"],
                    "roster": [],
                },
            },
        )
        got = _run(hr_insurance_readiness({"__user_id": "u-1"}))
        assert got["ready"] is False
        assert got["issues"] == ["2026 年没有启用的社保费率配置"]
        assert "没有启用的社保费率配置" in got["message"]
        assert "算薪会被拒绝" in got["message"]

    def test_illegal_year_rejected_before_request(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        calls = _install_fake_httpx(monkeypatch, payload={"code": 0, "data": {}})
        got = _run(hr_insurance_readiness({"__user_id": "u-1", "effectiveYear": "明年"}))
        assert got["ok"] is False
        assert got["errorCode"] == "INVALID_YEAR"
        assert calls == []

    def test_out_of_range_year_rejected(self, monkeypatch) -> None:
        _stub_ticket(monkeypatch, "u-1")
        calls = _install_fake_httpx(monkeypatch, payload={"code": 0, "data": {}})
        got = _run(hr_insurance_readiness({"__user_id": "u-1", "effectiveYear": 999}))
        assert got["ok"] is False
        assert got["errorCode"] == "INVALID_YEAR"
        assert calls == []

    def test_missing_user_fails_closed(self, monkeypatch) -> None:
        calls = _install_fake_httpx(monkeypatch, payload={"code": 0, "data": {}})
        got = _run(hr_insurance_readiness({}))
        assert got["ok"] is False
        assert got["errorCode"] == "MISSING_USER"
        assert calls == []


class TestWiring:
    def test_descriptions_are_exported(self) -> None:
        for text in (
            HR_MY_PAYROLL_DESCRIPTION,
            HR_MY_PAYROLL_PERIODS_DESCRIPTION,
            HR_MY_ATTENDANCE_DESCRIPTION,
            HR_MY_LEAVES_DESCRIPTION,
            HR_PAYROLL_CALC_DESCRIPTION,
            HR_INSURANCE_READINESS_DESCRIPTION,
        ):
            assert isinstance(text, str)
            assert len(text) >= 20

    def test_registered_in_both_faces(self) -> None:
        from app.services import mcp_server as ms

        names = {tool.name for tool in ms._TOOLS}
        for name in TOOL_NAMES:
            assert name in names, f"{name} 未进 _TOOLS"
            assert name in ms._TOOL_HANDLERS, f"{name} 未进 _TOOL_HANDLERS"
        assert len(ms._TOOLS) == len(ms._TOOL_HANDLERS)

    def test_ticket_scope_is_in_closed_set(self, monkeypatch) -> None:
        """真实取证:工具层交给 internal_service_headers 的 scope 必须是封闭集成员。

        历史缺陷就出在这里 —— 原文件写 "mcp-hr",不在集合内,mint 期直接抛错,
        两个自助工具因此永远是 INTERNAL_AUTH_UNAVAILABLE。
        """
        from app.core.internal_ticket import INTERNAL_TICKET_SCOPES

        seen: dict[str, str] = {}

        def _capture(user_id, scope, legacy_token=None, **kwargs):  # noqa: ARG001
            seen["scope"] = scope
            return {}

        monkeypatch.setattr(hr_tools, "internal_service_headers", _capture)
        assert hr_tools.hr_internal_headers("u-1") == {}
        assert seen["scope"] in INTERNAL_TICKET_SCOPES

    def test_expert_pack_routes_payroll(self) -> None:
        from app.services.expert_route import ExpertRoute, classify_intent, merge_tools

        pack, hits = classify_intent("帮我算工资,期间 2026-11")
        assert pack is not None and pack.slug == "hr-payroll"
        assert "算工资" in hits
        route = ExpertRoute(mode="auto", pack=pack, matched=hits)
        merged = merge_tools(route, ["read_file"])
        assert "read_file" in merged
        assert "hr_payroll_calc" in merged
        assert "hr_insurance_readiness" in merged
        assert "ai_payroll_handoff" in merged

    def test_expert_pack_routes_self_service(self) -> None:
        from app.services.expert_route import ExpertRoute, classify_intent, merge_tools

        pack, hits = classify_intent("我这个月工资多少钱")
        assert pack is not None and pack.slug == "hr-self-service"
        route = ExpertRoute(mode="auto", pack=pack, matched=hits)
        merged = merge_tools(route, [])
        for name in ("hr_my_payroll", "hr_my_payroll_periods", "hr_my_attendance", "hr_my_leaves"):
            assert name in merged
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
