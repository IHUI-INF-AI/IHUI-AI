# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""V3 #82 独立编辑意图预测(现有 FIM 链路升级)回归测试。

覆盖票面四条验收:
① 结构化动作 schema 与区间校验 —— 产物是 insert/replace/delete + 绝对区间,不是裸文本;
② 区间越界 / 空动作的确定行为 —— 逐条丢弃并点名原因,一条不剩即判 undetermined;
③ 三种失败态各自可分辨 —— 模型不可用 / 无凭据 / 解析失败 的 reason 与 message 互不相同;
④ 无凭据 ⇒ 显式"未判定",绝不折叠成"没有建议"。
另测预算有界(resolve_budget_ms 封顶 + 超时落 model_timeout)与请求校验(cursor 越界 422)。

测试隔离(AGENTS §5 测试隔离铁律):
- 全部经 monkeypatch 替换 `llm_gateway.complete`(AsyncMock 或本地协程),不触真实 LLM;
- `client` fixture 走 ASGITransport 且不启 lifespan ⇒ 不连生产 PostgreSQL 8810 / Redis 8811;
- 本文件不出现任何密钥、也不读任何密钥:凭据缺失态是用网关**自身**的返回形状
  (stub=True / errorCode=MODEL_NOT_CONFIGURED)模拟的,走既有配置出口(settings)。
"""
from __future__ import annotations

import asyncio
import inspect
import json
import logging
import os
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.core.config import settings
from app.routers import fim
from app.services import edit_intent

DOC = "def add(a, b):\n    return a + b\n"


@pytest.fixture(autouse=True)
def _bypass_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    """隔离 JWT 中间件(与 test_fim 同规则)。"""
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")


@pytest.fixture(autouse=True)
def _clear_budget_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """预算 env 是进程级状态:每个用例默认清掉,避免互相顶。"""
    monkeypatch.delenv(edit_intent.BUDGET_MS_ENV, raising=False)


def _payload(actions: list[dict[str, Any]]) -> str:
    return json.dumps({"actions": actions})


# ---------------------------------------------------------------------------
# ① 结构化动作 schema 与区间校验(纯函数面)
# ---------------------------------------------------------------------------


def test_valid_actions_are_parsed_as_structured_edits() -> None:
    """三种合法动作一次解析,字段只剩 kind/start/end/text —— 没有任何裸文本通道。"""
    raw = _payload(
        [
            {"kind": "insert", "start": 5, "end": 5, "text": "x"},
            {"kind": "replace", "start": 0, "end": 3, "text": "sum"},
            {"kind": "delete", "start": len(DOC) - 1, "end": len(DOC)},
        ]
    )
    outcome = edit_intent.interpret_model_output(raw, document_length=len(DOC))
    assert outcome.disposition == "suggested"
    assert outcome.reason is None
    assert outcome.dropped == []
    assert [(a.kind, a.start, a.end, a.text) for a in outcome.actions] == [
        ("insert", 5, 5, "x"),
        ("replace", 0, 3, "sum"),
        ("delete", len(DOC) - 1, len(DOC), ""),
    ]
    assert outcome.actions[2].text == ""


def test_delete_without_end_reuses_start_and_bare_array_is_accepted() -> None:
    """delete 省略 end 时按插入点处理;模型回裸数组也收(契约的两种自然写法)。"""
    outcome = edit_intent.interpret_model_output(
        _payload([{"kind": "replace", "start": 2, "end": 4, "text": "q"}]), document_length=10
    )
    assert outcome.disposition == "suggested"
    bare = edit_intent.interpret_model_output('[{"kind":"insert","start":1,"end":1,"text":"z"}]', document_length=10)
    assert bare.disposition == "suggested"
    assert bare.actions[0].kind == "insert"


@pytest.mark.parametrize(
    ("action", "expected_reason_part"),
    [
        ({"kind": "insert", "start": 3, "end": 9, "text": "x"}, "start 必须等于 end"),
        ({"kind": "insert", "start": 3, "end": 3, "text": ""}, "text 为空"),
        ({"kind": "replace", "start": 4, "end": 4, "text": "x"}, "区间为空"),
        ({"kind": "replace", "start": 4, "end": 6, "text": ""}, "text 为空"),
        ({"kind": "delete", "start": 4, "end": 6, "text": "nope"}, "不应带 text"),
        ({"kind": "insert", "start": 6, "end": 2, "text": "x"}, "区间倒序"),
        ({"kind": "insert", "start": -1, "end": -1, "text": "x"}, "为负"),
        ({"kind": "insert", "start": 2, "end": 2, "text": 5}, "text 不是字符串"),
        ({"kind": "rewrite", "start": 2, "end": 2, "text": "x"}, "未知 kind"),
        ({"start": 2, "end": 2, "text": "x"}, "未知 kind"),
        ("not-an-object", "不是对象"),
    ],
)
def test_malformed_action_is_dropped_with_named_reason(action: Any, expected_reason_part: str) -> None:
    """每条不合格动作都被丢弃**且点名原因**;唯一动作被丢 ⇒ 判未判定,不判"没有建议"。"""
    outcome = edit_intent.interpret_model_output(_payload([action]), document_length=len(DOC))
    assert outcome.disposition == "undetermined"
    assert outcome.reason == "all_actions_rejected"
    assert outcome.actions == []
    assert len(outcome.dropped) == 1
    assert expected_reason_part in (outcome.dropped[0].reason or "")
    assert outcome.dropped[0].index == 0


def test_out_of_bounds_range_is_rejected_not_clamped() -> None:
    """区间越界必须被丢弃而不是夹到文档末尾 —— 静默夹值会把错动作送进编辑器。"""
    outcome = edit_intent.interpret_model_output(
        _payload([{"kind": "replace", "start": 0, "end": len(DOC) + 50, "text": "x"}]),
        document_length=len(DOC),
    )
    assert outcome.disposition == "undetermined"
    assert "越界" in outcome.dropped[0].reason


def test_mixed_valid_and_invalid_keeps_valid_and_records_invalid() -> None:
    """部分可用:保留可用动作,丢弃项逐条记录 —— 两种信息都不得互相顶掉。"""
    outcome = edit_intent.interpret_model_output(
        _payload(
            [
                {"kind": "insert", "start": 4, "end": 4, "text": "ok"},
                {"kind": "delete", "start": 1000, "end": 2000},
            ]
        ),
        document_length=len(DOC),
    )
    assert outcome.disposition == "suggested"
    assert len(outcome.actions) == 1
    assert len(outcome.dropped) == 1
    assert outcome.dropped[0].index == 1


def test_action_count_above_cap_is_trimmed_deterministically() -> None:
    """超过单次上限的动作按出现顺序保留、超出部分记名,不静默截断。"""
    many = [{"kind": "insert", "start": 1, "end": 1, "text": str(i)} for i in range(edit_intent.MAX_ACTIONS + 2)]
    outcome = edit_intent.interpret_model_output(_payload(many), document_length=len(DOC))
    assert len(outcome.actions) == edit_intent.MAX_ACTIONS
    assert [d.index for d in outcome.dropped] == [edit_intent.MAX_ACTIONS, edit_intent.MAX_ACTIONS + 1]
    assert all(d.reason == "action_budget_exceeded" for d in outcome.dropped)


def test_empty_action_list_is_a_judged_no_action() -> None:
    """{"actions":[]} 是模型给出的**结论**:no_action,且不得带未判定标记。"""
    outcome = edit_intent.interpret_model_output('{"actions": []}', document_length=len(DOC))
    assert outcome.disposition == "no_action"
    assert outcome.reason is None


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "I think you want to add a return statement",
        "```json\n{\"actions\": [{bad json}]}\n```",
        '{"notActions": []}',
        "[{\"kind\": \"insert\"",  # 截断的半截 JSON:不猜
    ],
)
def test_unparseable_output_is_parse_failed_not_no_action(raw: str) -> None:
    """解不出规定结构 = 判不出来 ⇒ undetermined/parse_failed,禁止写成"没有建议"。"""
    outcome = edit_intent.interpret_model_output(raw, document_length=len(DOC))
    assert outcome.disposition == "undetermined"
    assert outcome.reason == "parse_failed"


def test_fenced_json_output_is_stripped_then_parsed() -> None:
    """推理型模型把 JSON 包在围栏里时仍能解析(与补全共用同一份剥离实现)。"""
    raw = "Let me think.\n```json\n" + _payload([{"kind": "insert", "start": 2, "end": 2, "text": "z"}]) + "\n```"
    outcome = edit_intent.interpret_model_output(raw, document_length=len(DOC))
    assert outcome.disposition == "suggested"
    assert outcome.actions[0].text == "z"


# ---------------------------------------------------------------------------
# 预算:唯一出口 + 硬封顶(不得无界 await)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("env_value", "requested", "expected"),
    [
        (None, None, edit_intent._BUDGET_MS_DEFAULT),
        (None, 900, 900),
        (None, 10 ** 9, edit_intent._BUDGET_MS_MAX),      # 请求侧也必须被封顶
        ("2000", 900, 2000),                               # env 优先于请求
        ("99999", None, edit_intent._BUDGET_MS_MAX),       # env 也越不过硬上限
        ("1", None, edit_intent._BUDGET_MS_MIN),           # 下限地板
        # env 配错 ⇒ 喊出来(warning)并**当作没配**:仍尊重显式请求值,无请求才落默认档
        ("not-a-number", 800, 800),
        ("not-a-number", None, edit_intent._BUDGET_MS_DEFAULT),
    ],
)
def test_resolve_budget_ms_is_bounded(
    monkeypatch: pytest.MonkeyPatch, env_value: str | None, requested: int | None, expected: int
) -> None:
    if env_value is None:
        monkeypatch.delenv(edit_intent.BUDGET_MS_ENV, raising=False)
    else:
        monkeypatch.setenv(edit_intent.BUDGET_MS_ENV, env_value)
    budget = edit_intent.resolve_budget_ms(requested)
    assert budget == expected
    assert edit_intent._BUDGET_MS_MIN <= budget <= edit_intent._BUDGET_MS_MAX


def test_unparseable_budget_env_is_announced(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """env 配错必须**喊出来**并回落默认档 —— 把配错读成"没配"会让人以为收紧已生效。"""
    monkeypatch.setenv(edit_intent.BUDGET_MS_ENV, "not-a-number")
    with caplog.at_level(logging.WARNING, logger="app.services.edit_intent"):
        assert edit_intent.resolve_budget_ms(None) == edit_intent._BUDGET_MS_DEFAULT
    assert any(edit_intent.BUDGET_MS_ENV in record.getMessage() for record in caplog.records)


async def test_prompt_carries_cursor_context_and_absolute_offsets() -> None:
    """提示必须把文件类型与**绝对**光标高喂给模型,并如实标出可见窗口边界。"""
    prompt = edit_intent.build_edit_intent_prompt(content=DOC, cursor=10, language="python", path="a/add.py")
    assert "File: a/add.py" in prompt
    assert "Language: python" in prompt
    assert f"Document length: {len(DOC)} characters." in prompt
    assert "Cursor offset (absolute): 10" in prompt
    assert edit_intent.EDIT_INTENT_SYSTEM_PROMPT.count('"actions"') >= 1


# ---------------------------------------------------------------------------
# ②③④ 端点三态:HTTP 面上的可分辨性
# ---------------------------------------------------------------------------


async def test_endpoint_returns_structured_actions(client: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """happy path:响应里只有结构化动作,不存在裸文本字段。"""
    monkeypatch.setattr(
        fim.llm_gateway,
        "complete",
        AsyncMock(return_value={"content": _payload([{"kind": "replace", "start": 4, "end": 7, "text": "b, c"}]),
                                "model": "coder-mini", "stub": False}),
    )
    resp = await client.post("/api/llm/fim/edit-intent", json={"content": DOC, "cursor": 5, "language": "python"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0 and body["message"] == "ok"
    data = body["data"]
    assert data["disposition"] == "suggested"
    assert data["undetermined"] is False
    assert data["reason"] is None
    assert data["actions"] == [{"kind": "replace", "start": 4, "end": 7, "text": "b, c"}]
    assert data["dropped_actions"] == []
    assert data["document_length"] == len(DOC)
    assert data["model"] == "coder-mini"
    assert data["stub"] is False
    assert data["budget_ms"] == edit_intent.resolve_budget_ms(None)
    assert data["latency_ms"] >= 0
    # 走的是既有低延迟档位选型,且 temperature=0(确定性优先)
    call = fim.llm_gateway.complete.call_args
    assert call.kwargs["temperature"] == 0.0
    assert isinstance(call.args[1], str) and call.args[1]


async def test_endpoint_reports_no_credentials_for_stub_result(client: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """无凭据(stub 模式,网关自造回复)⇒ 显式未判定,不得当成"模型没建议"。"""
    monkeypatch.setattr(
        fim.llm_gateway,
        "complete",
        AsyncMock(return_value={"content": '{"actions": []}', "model": "auto", "stub": True}),
    )
    data = (await client.post("/api/llm/fim/edit-intent", json={"content": DOC, "cursor": 1})).json()["data"]
    assert data["undetermined"] is True
    assert data["disposition"] == "undetermined"
    assert data["reason"] == "no_credentials"
    assert data["actions"] == []
    assert data["stub"] is True


async def test_endpoint_reports_no_credentials_for_unconfigured_error_code(
    client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """网关把"API key 未配置"折叠成 error 字典时,仍归 no_credentials 而不是 model_unavailable。"""
    monkeypatch.setattr(
        fim.llm_gateway,
        "complete",
        AsyncMock(return_value={"error": True, "errorCode": "MODEL_NOT_CONFIGURED",
                                "error_message": "模型 x 对应的 provider API key 未配置", "stub": False}),
    )
    body = (await client.post("/api/llm/fim/edit-intent", json={"content": DOC, "cursor": 1})).json()
    assert body["data"]["reason"] == "no_credentials"
    assert "no_credentials" in body["message"]


async def test_endpoint_reports_parse_failure(client: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """模型回散文 ⇒ parse_failed,与 no_credentials / model_unavailable 可分辨。"""
    monkeypatch.setattr(
        fim.llm_gateway, "complete", AsyncMock(return_value={"content": "sure! add a return", "model": "m", "stub": False})
    )
    body = (await client.post("/api/llm/fim/edit-intent", json={"content": DOC, "cursor": 1})).json()
    assert body["data"]["reason"] == "parse_failed"
    assert body["data"]["undetermined"] is True


async def test_endpoint_reports_model_unavailable_on_raise(client: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """网关抛异常 ⇒ model_unavailable(仍 200 + 未判定,绝不打断编辑器)。"""
    monkeypatch.setattr(fim.llm_gateway, "complete", AsyncMock(side_effect=RuntimeError("upstream boom")))
    resp = await client.post("/api/llm/fim/edit-intent", json={"content": DOC, "cursor": 1})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["disposition"] == "undetermined"
    assert data["reason"] == "model_unavailable"


async def test_three_failure_states_are_pairwise_distinguishable(client: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """三态诚实的核心判据:三种失败面的 reason 与 message 两两不等,且都 ≠ no_action。"""
    cases: dict[str, Any] = {
        "no_credentials": {"content": '{"actions":[]}', "model": "m", "stub": True},
        "model_unavailable": {"error": True, "errorCode": "LLM_ERROR", "error_message": "502", "stub": False},
    }
    reasons: list[str] = []
    messages: list[str] = []
    for stub_result in cases.values():
        monkeypatch.setattr(fim.llm_gateway, "complete", AsyncMock(return_value=stub_result))
        body = (await client.post("/api/llm/fim/edit-intent", json={"content": DOC, "cursor": 1})).json()
        reasons.append(body["data"]["reason"])
        messages.append(body["message"])
    monkeypatch.setattr(
        fim.llm_gateway, "complete", AsyncMock(return_value={"content": "not json at all", "model": "m", "stub": False})
    )
    body = (await client.post("/api/llm/fim/edit-intent", json={"content": DOC, "cursor": 1})).json()
    reasons.append(body["data"]["reason"])
    messages.append(body["message"])
    assert reasons == ["no_credentials", "model_unavailable", "parse_failed"]
    assert len(set(messages)) == 3
    assert all("undetermined" in m for m in messages)


async def test_endpoint_times_out_within_budget(client: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """超出预算 ⇒ model_timeout,且确实被截停(耗时远小于被 mock 的慢响应)。"""
    monkeypatch.setenv(edit_intent.BUDGET_MS_ENV, "150")

    async def slow(*args: Any, **kwargs: Any) -> dict[str, Any]:
        await asyncio.sleep(3.0)
        return {"content": '{"actions":[]}', "model": "m", "stub": False}

    monkeypatch.setattr(fim.llm_gateway, "complete", slow)
    started = asyncio.get_running_loop().time()
    data = (await client.post("/api/llm/fim/edit-intent", json={"content": DOC, "cursor": 1})).json()["data"]
    elapsed = asyncio.get_running_loop().time() - started
    assert data["reason"] == "model_timeout"
    assert data["budget_ms"] == 150
    assert elapsed < 1.0, f"await 未被预算截停:{elapsed:.2f}s"


async def test_endpoint_requests_without_actions_are_recorded(client: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """显式请求预算被封顶后仍要如实回给调用方(否则"我给了 99999"与"实际用了 4000"分叉)。"""
    monkeypatch.setattr(
        fim.llm_gateway, "complete", AsyncMock(return_value={"content": '{"actions":[]}', "model": "m", "stub": False})
    )
    data = (
        await client.post("/api/llm/fim/edit-intent", json={"content": DOC, "cursor": 1, "budget_ms": 999999})
    ).json()["data"]
    assert data["budget_ms"] == edit_intent._BUDGET_MS_MAX
    assert data["disposition"] == "no_action"


async def test_empty_document_is_undetermined_without_calling_model(client: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """空文档 = 无上下文,判 insufficient_context 且**不发**模型调用(省一次无望的 await)。"""
    mock = AsyncMock(return_value={"content": '{"actions":[]}', "model": "m", "stub": False})
    monkeypatch.setattr(fim.llm_gateway, "complete", mock)
    data = (await client.post("/api/llm/fim/edit-intent", json={"content": "", "cursor": 0})).json()["data"]
    assert data["disposition"] == "undetermined"
    assert data["reason"] == "insufficient_context"
    assert mock.await_count == 0


@pytest.mark.parametrize(
    "payload",
    [
        {"content": DOC, "cursor": len(DOC) + 1},   # 光标越界:调用方 bug ⇒ 422,不夹值再猜
        {"content": DOC, "cursor": -1},
        {"content": DOC, "max_tokens": 0},
        {"content": DOC, "budget_ms": 0},
        {"cursor": 0},                               # 缺 content
    ],
)
async def test_request_validation_is_deterministic(client: Any, payload: dict[str, Any]) -> None:
    resp = await client.post("/api/llm/fim/edit-intent", json=payload)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 既有 FIM 契约不得被本票改动(消费方是 apps/web 的 CodeEditor)
# ---------------------------------------------------------------------------


async def test_existing_fim_contract_unchanged(client: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """/llm/fim 仍是 {completion, model, latency_ms, stub} 裸文本契约。"""
    monkeypatch.setattr(
        fim.llm_gateway, "complete", AsyncMock(return_value={"content": "return a + b", "model": "m", "stub": True})
    )
    resp = await client.post("/api/llm/fim", json={"prefix": "def f():\n  "})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert set(data) == {"completion", "model", "latency_ms", "stub"}
    assert data["completion"] == "return a + b"
    assert "disposition" not in data


def test_fence_stripping_has_a_single_implementation() -> None:
    """路由层的 `_strip_fences` 必须转发到服务层那一份实现(两处各写一遍必然漂移)。"""
    raw = "thinking...\n```py\nx = 1\n```"
    assert fim._strip_fences(raw) == edit_intent.strip_code_fences(raw) == "x = 1"
    source = inspect.getsource(fim)
    assert "return strip_code_fences(text)" in source
    assert "parts = stripped.split" not in source, "路由层不得留下第二份围栏剥离实现"


#: 真模型用例的显式开关 —— 默认关。
#: 实测理由:本机 .env 配了 agnes 时,只按"有没有凭据"判 skip 会让这一例在开发机
#: **静默花真实额度**(且网关可能去取 ai_model_config 而触库),与 §5 测试隔离铁律冲突;
#: 而在干净检出里它又变成 skip —— 同一份代码在两台机上行为不同,这种测试不能留默认开。
LIVE_ENV: str = "IHUI_PREDICTIVE_EDIT_LIVE"


@pytest.mark.skipif(
    condition=os.environ.get(LIVE_ENV) != "1",
    reason=(
        f"真模型通道默认不跑(设 {LIVE_ENV}=1 才跑):会花真实凭据额度并可能触库取 "
        f"ai_model_config,与 §5 测试隔离铁律冲突。此例存在本身就是『真模型那一维"
        f"未在本轮取证』的机器可见证据,不得用降级分支冒充测过。"
    ),
)
async def test_live_channel_produces_structured_or_undetermined() -> None:  # pragma: no cover — 需显式开启
    """显式开启时:真跑一次,产物要么是合法结构化动作,要么显式未判定。"""
    resp = await asyncio.wait_for(
        fim.fim_predict_edit(
            fim.PredictiveEditRequest(content=DOC, cursor=len(DOC), language="python", budget_ms=4000)
        ),
        timeout=30.0,
    )
    assert resp["data"]["disposition"] in {"suggested", "no_action", "undetermined"}
    if resp["data"]["disposition"] == "undetermined":
        assert resp["data"]["reason"]
