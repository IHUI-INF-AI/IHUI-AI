# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""WorkBuddy desktop 口径事件链单测 — 零真实网络、零真实凭据。

被测:app/services/workbuddy_direct_api.py 新增的 desktop 链
(``build_desktop_fingerprint`` / ``report_desktop`` / ``fetch_market_experts`` /
``real_chat_with_expert`` / ``run_desktop_expert_task``)。

口径来源(2026-11-09 实测,本文件只锁行为,不重复验证):
  - desktop 上报走 chatBase ``copilot.tencent.com/v2/report``,body 是**数组**;
  - ``expert_actual_use`` 的 requestId 必须是真实 chat SSE 首个 data 帧的 ``id``,
    自造 UUID 不计数 —— 所以 SSE 解析必须容错且取不到就失败;
  - 市场列表结构是 **``data.experts[]``**(不是顶层 experts);
  - version 必须用市场真实值(默认 1.0.0 上报零前进);
  - 受理回执不算完成:全 200 但回读 progress 不变 ⇒ ok=False。

全部出站由 httpx.MockTransport 拦截;凭据一律明显假值。
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx
import pytest

from app.services import workbuddy_direct_api as wda

FAKE_TOKEN = "FAKE_TOKEN_FOR_DESKTOP_CHAIN_0123456789abcdef"
FAKE_UID = "u-desktop-chain-001"
FAKE_NICK = "测试昵称"
EXPERT_ID = "ex_GDl31WahyIH0"
TASK_CODE = "expert_use_maidehao"
SERVER_RID = "abcdef1234567890abcdef1234567890"

_REQ_ID_RE = re.compile(r"^[0-9a-f]{36}\d{6}$")

MARKET_EXPERT: dict[str, Any] = {
    "expert_id": EXPERT_ID,
    "expert_type": "agent",
    "display_name_zh": "中国电商运营专家",
    "profession_zh": "电商运营",
    "version": "1.6.2",
    "categories": ["ecommerce"],
}


def _market_response(expert: dict[str, Any] = MARKET_EXPERT) -> httpx.Response:
    return httpx.Response(200, json={"code": 0, "data": {"experts": [expert], "total": 1}})


def _chat_sse_response() -> httpx.Response:
    body = (
        ": keep-alive\n\n"
        "event: message\n"
        "data: not-json-line\n\n"
        'data: {"id": "' + SERVER_RID + '", "choices": [{"delta": {"content": "2"}}]}\n\n'
        "data: [DONE]\n\n"
    )
    return httpx.Response(
        200, text=body, headers={"content-type": "text/event-stream"}
    )


def _tasks(progress: int) -> dict[str, Any]:
    return {
        "code": 0,
        "data": {
            "tasks": [
                {
                    "task_code": TASK_CODE,
                    "progress": {"current": progress, "target": 1},
                    "accept_status": "accepted",
                }
            ]
        },
    }


# ---------------------------------------------------------------------------
# 1. 指纹:字段齐全 + 同 uid 幂等 + 不同 uid 不同
# ---------------------------------------------------------------------------


def test_desktop_fingerprint_fields_and_stability() -> None:
    fp1 = wda.build_desktop_fingerprint(FAKE_UID, FAKE_NICK, now_ms=1_700_000_000_000)
    fp2 = wda.build_desktop_fingerprint(FAKE_UID, FAKE_NICK, now_ms=1_700_000_000_000)
    other = wda.build_desktop_fingerprint("u-other", FAKE_NICK, now_ms=1_700_000_000_000)

    required = {
        "timezone",
        "reportDelay",
        "userId",
        "username",
        "userNickname",
        "product",
        "releaseDate",
        "commit",
        "ideName",
        "ideType",
        "ideVersion",
        "machineId",
        "sessionId",
        "extName",
        "extVersion",
        "os",
        "arch",
        "osVersion",
        "cpuCores",
        "memorySize",
        "timestamp",
        "presentAt",
    }
    assert required <= set(fp1)
    assert fp1["userId"] == FAKE_UID
    assert fp1["username"] == FAKE_NICK == fp1["userNickname"]
    assert fp1["product"] == "SaaS"
    assert fp1["ideName"] == fp1["ideType"] == "WorkBuddy"
    assert fp1["extName"] == "workbuddy-desktop"
    assert fp1["timestamp"] == fp1["presentAt"] == 1_700_000_000_000
    assert len(fp1["machineId"]) == 36 and len(fp1["sessionId"]) == 36
    assert fp1["machineId"] != fp1["sessionId"]

    # 幂等:同一 uid 两次调用（时间固定）完全一致
    assert fp1 == fp2
    # 不同 uid 派生不同设备标识
    assert other["machineId"] != fp1["machineId"]
    assert other["sessionId"] != fp1["sessionId"]


# ---------------------------------------------------------------------------
# 2. report_desktop:数组 body + 指纹合并 + X-Request-ID 形状
# ---------------------------------------------------------------------------


async def test_report_desktop_body_is_array_with_fingerprint() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["request"] = request
        seen["payload"] = json.loads(request.content)
        return httpx.Response(200, json={"code": 0, "msg": "ok"})

    events = [
        {"eventCode": "expert_summoned", "id": EXPERT_ID, "name": "中国电商运营专家"},
        {"eventCode": "expert_actual_use", "id": EXPERT_ID, "version": "1.6.2"},
    ]
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await wda.report_desktop(
            client, FAKE_TOKEN, FAKE_UID, FAKE_NICK, events, now_ms=1_700_000_000_123
        )

    payload = seen["payload"]
    assert isinstance(payload, list) and len(payload) == 2
    for item in payload:
        # 指纹注入到每一项,业务字段不被覆盖
        assert item["userId"] == FAKE_UID
        assert item["ideName"] == "WorkBuddy"
        assert item["extName"] == "workbuddy-desktop"
        assert item["timestamp"] == 1_700_000_000_123
    assert payload[0]["eventCode"] == "expert_summoned"
    assert payload[1]["version"] == "1.6.2"

    request = seen["request"]
    assert request.url == "https://copilot.tencent.com/v2/report"
    assert request.headers["Authorization"].startswith("Bearer ")
    assert _REQ_ID_RE.match(request.headers["X-Request-ID"])

    assert result.status == 200
    assert result.code == 0
    assert result.request_id == request.headers["X-Request-ID"]
    assert result.event_codes == ("expert_summoned", "expert_actual_use")
    # 出站摘要含 host+path+事件码+条数
    assert "copilot.tencent.com/v2/report" in result.outbound
    assert "expert_actual_use" in result.outbound
    assert "count=2" in result.outbound
    assert FAKE_TOKEN not in result.outbound


# ---------------------------------------------------------------------------
# 3. real_chat_with_expert:SSE 首个 data.id;注释/[DONE]/非 JSON 不崩
# ---------------------------------------------------------------------------


async def test_real_chat_extracts_server_request_id_from_sse() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["request"] = request
        return _chat_sse_response()

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        conversation_id, request_id = await wda.real_chat_with_expert(
            client, FAKE_TOKEN, FAKE_UID, EXPERT_ID
        )

    assert request_id == SERVER_RID
    assert conversation_id.startswith("wb2api-conv-")
    request = seen["request"]
    assert request.url == "https://copilot.tencent.com/v2/chat/completions"
    assert request.headers["X-Conversation-ID"] == conversation_id
    assert request.headers["X-Expert-Id"] == EXPERT_ID
    body = json.loads(request.content)
    assert body["stream"] is True
    assert body["stream_options"] == {"include_usage": True}


async def test_real_chat_without_server_id_raises() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        # 只有注释/心跳/[DONE],没有可用 id
        return httpx.Response(
            200,
            text=": ping\n\ndata: [DONE]\n\n",
            headers={"content-type": "text/event-stream"},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(wda.DesktopChainError):
            await wda.real_chat_with_expert(client, FAKE_TOKEN, FAKE_UID, EXPERT_ID)


async def test_real_chat_non_json_and_comment_lines_do_not_break() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text=(
                ": heartbeat\n"
                "data: oops-not-json\n"
                "data: [DONE]\n"
                'data: {"id": "' + SERVER_RID + '"}\n'
            ),
            headers={"content-type": "text/event-stream"},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        _conversation_id, request_id = await wda.real_chat_with_expert(
            client, FAKE_TOKEN, FAKE_UID, EXPERT_ID
        )
    assert request_id == SERVER_RID


# ---------------------------------------------------------------------------
# 4. fetch_market_experts:必须解析 data.experts（本轮实证坑）
# ---------------------------------------------------------------------------


async def test_fetch_market_experts_parses_data_experts() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["payload"] = json.loads(request.content)
        seen["url"] = str(request.url)
        return _market_response()

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        rows = await wda.fetch_market_experts(
            client, FAKE_TOKEN, FAKE_UID, expert_type="agent", keyword="无畏契约"
        )

    assert len(rows) == 1
    assert rows[0]["expert_id"] == EXPERT_ID
    assert rows[0]["version"] == "1.6.2"
    assert seen["url"] == (
        "https://copilot.tencent.com/portal/operation-platform/market/expert/list"
    )
    assert seen["payload"]["keyword"] == "无畏契约"
    assert seen["payload"]["expert_type"] == "agent"


async def test_fetch_market_experts_ignores_top_level_experts() -> None:
    """仅顶层 experts、无 data.experts ⇒ 解析为空（防止回归成旧口径）。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"experts": [MARKET_EXPERT]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        rows = await wda.fetch_market_experts(client, FAKE_TOKEN, FAKE_UID)

    assert rows == []


# ---------------------------------------------------------------------------
# 5/6/7 组合:run_desktop_expert_task 的判据、version 来源、脱敏
# ---------------------------------------------------------------------------


class _ChainStub:
    """一套完整成功的出站桩（市场/chat/report 全 200）+ 可编排的回读进度。"""

    def __init__(self, progresses: list[int]) -> None:
        self.progresses = progresses
        self.report_payloads: list[Any] = []
        self.calls = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/portal/operation-platform/market/expert/list"):
            return _market_response()
        if path.endswith("/v2/chat/completions"):
            return _chat_sse_response()
        if path.endswith("/v2/report"):
            self.report_payloads.append(json.loads(request.content))
            return httpx.Response(200, json={"code": 0, "msg": "ok"})
        return httpx.Response(404, json={"code": 404})

    async def read_tasks(self) -> dict[str, Any]:
        index = min(self.calls, len(self.progresses) - 1)
        self.calls += 1
        return _tasks(self.progresses[index])


def _expert_with_stale_version() -> dict[str, Any]:
    """动作表绑定形态:version 故意写旧值 1.0.0,市场才给真实 1.6.2。"""
    return {
        "task_code": TASK_CODE,
        "expert_id": EXPERT_ID,
        "display_name_zh": "中国电商运营专家",
        "version": "1.0.0",
    }


async def test_run_desktop_expert_task_all_200_without_progress_is_failure() -> None:
    stub = _ChainStub(progresses=[0, 0])
    async with httpx.AsyncClient(transport=httpx.MockTransport(stub.handler)) as client:
        result = await wda.run_desktop_expert_task(
            client,
            FAKE_TOKEN,
            FAKE_UID,
            FAKE_NICK,
            _expert_with_stale_version(),
            read_tasks=stub.read_tasks,
        )

    assert result.ok is False
    assert result.reason == wda.REASON_NO_PROGRESS_ADVANCE
    # 三步都 200（市场/chat/report）却仍不认完成
    assert [step.http_status for step in result.steps] == [200, 200, 200]
    assert stub.report_payloads, "report 确实发出（受理回执不等于完成）"
    assert result.before is not None and result.after is not None
    assert result.before[TASK_CODE]["progress_current"] == 0
    assert result.after[TASK_CODE]["progress_current"] == 0


async def test_run_desktop_expert_task_uses_market_version_and_advances() -> None:
    stub = _ChainStub(progresses=[0, 1])
    async with httpx.AsyncClient(transport=httpx.MockTransport(stub.handler)) as client:
        result = await wda.run_desktop_expert_task(
            client,
            FAKE_TOKEN,
            FAKE_UID,
            FAKE_NICK,
            _expert_with_stale_version(),
            read_tasks=stub.read_tasks,
        )

    assert result.ok is True
    assert result.reason == wda.REASON_OK
    assert len(stub.report_payloads) == 1
    payload = stub.report_payloads[0]
    assert isinstance(payload, list) and len(payload) == 4  # summon×3 + actual_use
    codes = [item["eventCode"] for item in payload]
    assert codes == [
        "web_element_click",
        "expert_summon_click",
        "expert_summoned",
        "expert_actual_use",
    ]
    # version 用市场真实值,不是绑定表里的 1.0.0
    assert {item.get("version") for item in payload if "version" in item} == {"1.6.2"}
    use = payload[-1]
    assert use["requestId"] == SERVER_RID
    assert use["messageId"] == "msg-" + SERVER_RID[-8:]
    assert use["conversationId"].startswith("wb2api-conv-")


async def test_run_desktop_expert_task_never_leaks_token() -> None:
    stub = _ChainStub(progresses=[0, 1])
    async with httpx.AsyncClient(transport=httpx.MockTransport(stub.handler)) as client:
        result = await wda.run_desktop_expert_task(
            client,
            FAKE_TOKEN,
            FAKE_UID,
            FAKE_NICK,
            _expert_with_stale_version(),
            read_tasks=stub.read_tasks,
        )

    haystack = [
        repr(result),
        str(result),
        json.dumps(
            {
                "outbound": list(result.outbound),
                "error": result.error,
                "steps": [
                    [step.url, step.response_excerpt, step.error] for step in result.steps
                ],
                "before": result.before,
                "after": result.after,
            },
            ensure_ascii=False,
            default=str,
        ),
    ]
    for text in haystack:
        assert FAKE_TOKEN not in text
        assert FAKE_TOKEN[:16] not in text
    # 允许的唯一凭据形态:长度 + sha256 前 8
    assert result.credential_fingerprint["token_len"] == len(FAKE_TOKEN)
    assert len(result.credential_fingerprint["token_sha256_8"]) == 8


async def test_execute_task_code_refuses_desktop_kind_without_outbound() -> None:
    """动作表 kind=desktop_expert 由专用 runner 跑,通用执行器零出站拒跑。"""
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={"code": 0})

    async def read_tasks() -> dict[str, Any]:
        return _tasks(0)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await wda.execute_task_code(
            TASK_CODE,
            {
                "uid": FAKE_UID,
                "domain": "www.workbuddy.cn",
                "access_token": FAKE_TOKEN,
                "host": wda.WEB_BASE_CN,
            },
            client,
            read_tasks,
        )

    assert result.ok is False
    assert result.reason == wda.REASON_UNSUPPORTED_KIND
    assert calls == []
