"""AI 助教(ai_tutor)service + router 单元测试。

覆盖:
- explain_concept 返回结构(answer / knowledge_points / follow_up_questions / resources)
- give_hint 返回 hint 而非 answer(且 system prompt 强调不给答案)
- generate_quiz 返回 questions 数组(每题含 6 字段)
- subject persona 选择(7 学科 + 未知学科兜底)
- context 字段透传到 prompt

mock llm_gateway.complete,不依赖真实 LLM 调用。
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import ai_tutor as ai_tutor_router_mod
from app.services import ai_tutor as ai_tutor_mod


# =============================================================================
# helpers
# =============================================================================


def _make_complete_mock(
    captured: list[dict[str, Any]],
    response_content: str,
) -> Any:
    """构造 mock async complete 函数,记录入参到 captured,返回固定 content。

    签名对齐 LLMGateway.complete(messages, model=None, *, owner_uuid=None, **kwargs)。
    """

    async def _mock_complete(
        messages: list[dict[str, Any]],
        model: str | None = None,
        *,
        owner_uuid: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        captured.append({
            "messages": messages,
            "model": model,
            "owner_uuid": owner_uuid,
            "kwargs": kwargs,
        })
        return {
            "content": response_content,
            "model": model or "mock-model",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "stub": True,
        }

    return _mock_complete


def _pick_user_msg(messages: list[dict[str, Any]]) -> dict[str, Any]:
    """从 messages 中取第一条 role=user 的消息。"""
    return next(m for m in messages if m["role"] == "user")


def _pick_system_msg(messages: list[dict[str, Any]]) -> dict[str, Any]:
    """从 messages 中取第一条 role=system 的消息。"""
    return next(m for m in messages if m["role"] == "system")


# =============================================================================
# explain_concept — 返回结构
# =============================================================================


@pytest.mark.asyncio
async def test_explain_concept_returns_valid_structure(monkeypatch: pytest.MonkeyPatch) -> None:
    """explain_concept 返回 answer/knowledge_points/follow_up_questions/resources 4 字段。"""
    captured: list[dict[str, Any]] = []
    mock = _make_complete_mock(captured, json.dumps({
        "answer": "向量是既有大小又有方向的量,可以用箭头表示...",
        "knowledge_points": ["向量定义", "向量表示"],
        "follow_up_questions": ["向量与标量的区别?", "向量如何运算?"],
        "resources": ["教材第3章", "Khan Academy 向量入门"],
    }))
    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", mock)

    result = await ai_tutor_mod.explain_concept("math", "什么是向量?")

    assert set(result.keys()) >= {"answer", "knowledge_points", "follow_up_questions", "resources"}
    assert isinstance(result["answer"], str)
    assert isinstance(result["knowledge_points"], list)
    assert isinstance(result["follow_up_questions"], list)
    assert isinstance(result["resources"], list)
    assert "向量" in result["answer"]
    assert "向量定义" in result["knowledge_points"]
    assert len(result["follow_up_questions"]) == 2


# =============================================================================
# give_hint — 返回 hint 而非 answer
# =============================================================================


@pytest.mark.asyncio
async def test_give_hint_returns_hint_not_answer(monkeypatch: pytest.MonkeyPatch) -> None:
    """give_hint 返回 hint/next_step_hint/encouragement,system prompt 强调不给答案。"""
    captured: list[dict[str, Any]] = []
    mock = _make_complete_mock(captured, json.dumps({
        "hint": "想想力的方向与运动方向的关系,合力会指向哪里?",
        "next_step_hint": "如果物体匀速,合力为零,那拉力和摩擦力有什么关系?",
        "encouragement": "你快想到了,继续!",
    }))
    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", mock)

    result = await ai_tutor_mod.give_hint(
        "physics",
        "一个物体在水平面上匀速运动,摩擦力是 5N,求拉力?",
    )

    assert set(result.keys()) >= {"hint", "next_step_hint", "encouragement"}
    assert isinstance(result["hint"], str)
    assert isinstance(result["next_step_hint"], str)
    assert isinstance(result["encouragement"], str)
    assert len(result["hint"]) > 0
    # hint 不应包含直接答案 "5N"
    assert "5N" not in result["hint"]
    # system prompt 应明确禁止直接给答案
    sys_msg = _pick_system_msg(captured[0]["messages"])
    assert "严禁" in sys_msg["content"] or "不要给出最终" in sys_msg["content"]


# =============================================================================
# generate_quiz — 返回 questions 数组
# =============================================================================


@pytest.mark.asyncio
async def test_generate_quiz_returns_questions(monkeypatch: pytest.MonkeyPatch) -> None:
    """generate_quiz 返回 questions 数组,每题含 6 个字段。"""
    captured: list[dict[str, Any]] = []
    mock = _make_complete_mock(captured, json.dumps({
        "questions": [
            {
                "question_text": "下列哪个物理量是向量?",
                "options": ["质量", "速度", "温度", "长度"],
                "answer": "B",
                "explanation": "速度既有大小又有方向,是向量;其余只有大小,是标量。",
                "knowledge_points": ["向量与标量的区别"],
                "difficulty": "easy",
            },
            {
                "question_text": "牛顿第二定律的表达式是?",
                "options": ["F=ma", "F=mv", "E=mc²", "P=mv"],
                "answer": "A",
                "explanation": "牛顿第二定律:物体加速度与所受合外力成正比,与质量成反比,F=ma。",
                "knowledge_points": ["牛顿第二定律"],
                "difficulty": "medium",
            },
        ]
    }))
    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", mock)

    result = await ai_tutor_mod.generate_quiz("physics", {"chapter": "力学"}, count=2)

    assert "questions" in result
    assert isinstance(result["questions"], list)
    assert len(result["questions"]) == 2
    for q in result["questions"]:
        assert set(q.keys()) == {
            "question_text", "options", "answer",
            "explanation", "knowledge_points", "difficulty",
        }
        assert isinstance(q["question_text"], str)
        assert isinstance(q["options"], list)
        assert isinstance(q["answer"], str)
        assert isinstance(q["explanation"], str)
        assert isinstance(q["knowledge_points"], list)
        assert q["difficulty"] in {"easy", "medium", "hard"}
    # count=2 应体现在 user message
    user_msg = _pick_user_msg(captured[0]["messages"])
    assert "2 道题" in user_msg["content"]


@pytest.mark.asyncio
async def test_generate_quiz_accepts_bare_list(monkeypatch: pytest.MonkeyPatch) -> None:
    """generate_quiz 兼容 LLM 返回裸数组 [...] 而非 {"questions": [...]} 的情况。"""
    captured: list[dict[str, Any]] = []
    mock = _make_complete_mock(captured, json.dumps([
        {
            "question_text": "1+1=?",
            "options": ["1", "2", "3", "4"],
            "answer": "B",
            "explanation": "基本加法。",
            "knowledge_points": ["加法"],
            "difficulty": "easy",
        }
    ]))
    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", mock)

    result = await ai_tutor_mod.generate_quiz("math", None, count=1)
    assert len(result["questions"]) == 1
    assert result["questions"][0]["answer"] == "B"


@pytest.mark.asyncio
async def test_generate_quiz_count_clamped(monkeypatch: pytest.MonkeyPatch) -> None:
    """count > 10 截断到 10,count < 1 提升到 1(在 user message 中体现)。"""
    captured: list[dict[str, Any]] = []
    mock = _make_complete_mock(captured, json.dumps({"questions": []}))
    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", mock)

    # count=99 → 截断到 10
    await ai_tutor_mod.generate_quiz("math", None, count=99)
    user_msg = _pick_user_msg(captured[0]["messages"])
    assert "10 道题" in user_msg["content"]

    # count=0 → 提升到 1
    await ai_tutor_mod.generate_quiz("math", None, count=0)
    user_msg = _pick_user_msg(captured[1]["messages"])
    assert "1 道题" in user_msg["content"]

    # count=-5 → 提升到 1
    await ai_tutor_mod.generate_quiz("math", None, count=-5)
    user_msg = _pick_user_msg(captured[2]["messages"])
    assert "1 道题" in user_msg["content"]


# =============================================================================
# subject persona selection
# =============================================================================


@pytest.mark.asyncio
async def test_subject_persona_selection(monkeypatch: pytest.MonkeyPatch) -> None:
    """每个学科对应不同 persona,system prompt 以 persona 开头;未知学科有兜底。"""
    captured: list[dict[str, Any]] = []
    mock = _make_complete_mock(captured, json.dumps({
        "answer": "", "knowledge_points": [], "follow_up_questions": [], "resources": []
    }))
    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", mock)

    # 验证 7 个学科:每个 persona 都被注入 system prompt 开头
    for subject in ["math", "physics", "chemistry", "biology", "english", "history", "geography"]:
        captured.clear()
        await ai_tutor_mod.explain_concept(subject, "test question")
        sys_msg = _pick_system_msg(captured[0]["messages"])
        expected_persona = ai_tutor_mod.SUBJECT_PERSONAS[subject]
        assert sys_msg["content"].startswith(expected_persona), (
            f"subject={subject} system prompt 应以 persona 开头"
        )

    # 英语 persona 是英文(双语教学)
    assert ai_tutor_mod.SUBJECT_PERSONAS["english"].startswith("You are")

    # 未知学科应使用兜底 persona(不抛异常,正常调用 LLM)
    captured.clear()
    await ai_tutor_mod.explain_concept("unknown_subject", "test")
    assert len(captured) == 1
    sys_msg = _pick_system_msg(captured[0]["messages"])
    assert "耐心" in sys_msg["content"]  # 兜底 persona 关键词

    # SUBJECT_VALID 含且仅含 7 个学科
    assert ai_tutor_mod.SUBJECT_VALID == {
        "math", "physics", "chemistry", "biology", "english", "history", "geography"
    }


# =============================================================================
# context propagation
# =============================================================================


@pytest.mark.asyncio
async def test_context_propagation(monkeypatch: pytest.MonkeyPatch) -> None:
    """context 的 chapter/knowledge_points/difficulty 透传到 user message。"""
    captured: list[dict[str, Any]] = []
    mock = _make_complete_mock(captured, json.dumps({
        "hint": "...", "next_step_hint": "...", "encouragement": "..."
    }))
    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", mock)

    ctx = {
        "chapter": "Chapter 5: Cellular Respiration",
        "knowledge_points": ["glycolysis", "Krebs cycle"],
        "difficulty": "hard",
    }
    await ai_tutor_mod.give_hint("biology", "为什么缺氧时细胞产生乳酸?", ctx)

    user_msg = _pick_user_msg(captured[0]["messages"])
    assert "Chapter 5" in user_msg["content"]
    assert "glycolysis" in user_msg["content"]
    assert "Krebs cycle" in user_msg["content"]
    assert "hard" in user_msg["content"]
    # 上下文标记应存在
    assert "上下文" in user_msg["content"]


@pytest.mark.asyncio
async def test_context_none_omits_context_line(monkeypatch: pytest.MonkeyPatch) -> None:
    """context=None 时 user message 不含上下文标记。"""
    captured: list[dict[str, Any]] = []
    mock = _make_complete_mock(captured, json.dumps({
        "answer": "", "knowledge_points": [], "follow_up_questions": [], "resources": []
    }))
    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", mock)

    await ai_tutor_mod.explain_concept("math", "什么是导数?")
    user_msg = _pick_user_msg(captured[0]["messages"])
    assert "上下文" not in user_msg["content"]


@pytest.mark.asyncio
async def test_explain_concept_propagates_context(monkeypatch: pytest.MonkeyPatch) -> None:
    """explain_concept 也透传 context(覆盖 explain 路径的 context 注入)。"""
    captured: list[dict[str, Any]] = []
    mock = _make_complete_mock(captured, json.dumps({
        "answer": "...", "knowledge_points": [], "follow_up_questions": [], "resources": []
    }))
    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", mock)

    ctx = {"chapter": "第3章 力学", "knowledge_points": ["牛顿第二定律"], "difficulty": "medium"}
    await ai_tutor_mod.explain_concept("physics", "解释牛顿第二定律", ctx)

    user_msg = _pick_user_msg(captured[0]["messages"])
    assert "第3章 力学" in user_msg["content"]
    assert "牛顿第二定律" in user_msg["content"]
    assert "medium" in user_msg["content"]


# =============================================================================
# JSON 解析容错
# =============================================================================


@pytest.mark.asyncio
async def test_explain_concept_fenced_json(monkeypatch: pytest.MonkeyPatch) -> None:
    """LLM 返回 ```json 代码块包裹的 JSON 也能正确解析。"""
    captured: list[dict[str, Any]] = []
    fenced = (
        "好的,这是讲解:\n"
        "```json\n"
        '{"answer": "导数是变化率", "knowledge_points": ["导数定义"], '
        '"follow_up_questions": [], "resources": []}\n'
        "```\n"
        "希望对你有帮助。"
    )
    mock = _make_complete_mock(captured, fenced)
    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", mock)

    result = await ai_tutor_mod.explain_concept("math", "什么是导数?")
    assert result["answer"] == "导数是变化率"
    assert "导数定义" in result["knowledge_points"]


@pytest.mark.asyncio
async def test_explain_concept_parse_failure_returns_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """LLM 返回非 JSON 时,返回 error 字段而非抛异常。"""
    captured: list[dict[str, Any]] = []
    mock = _make_complete_mock(captured, "这不是 JSON,是一段纯文本回答。")
    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", mock)

    result = await ai_tutor_mod.explain_concept("math", "什么是导数?")
    assert "error" in result
    assert result["knowledge_points"] == []
    assert result["follow_up_questions"] == []


@pytest.mark.asyncio
async def test_llm_error_propagates(monkeypatch: pytest.MonkeyPatch) -> None:
    """llm_gateway.complete 返回 error=True 时,服务返回 error 字段。"""
    async def _mock_error_complete(
        messages: list[dict[str, Any]],
        model: str | None = None,
        *,
        owner_uuid: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return {
            "content": "",
            "model": model or "mock",
            "usage": {},
            "stub": False,
            "error": True,
            "error_message": "API key 未配置",
            "errorCode": "MODEL_NOT_CONFIGURED",
        }

    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", _mock_error_complete)

    result = await ai_tutor_mod.explain_concept("math", "什么是导数?")
    assert "error" in result
    assert "API key" in result["error"]


# =============================================================================
# router — FastAPI endpoints
# =============================================================================


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """独立 FastAPI app + mock llm_gateway,只挂 ai_tutor router。

    mock 按请求特征路由返回不同 JSON(explain / hint / quiz 三种)。
    """

    async def _mock_complete(
        messages: list[dict[str, Any]],
        model: str | None = None,
        *,
        owner_uuid: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        sys_content = messages[0]["content"] if messages else ""
        if "出题" in sys_content:
            return {
                "content": json.dumps({"questions": [{
                    "question_text": "Q",
                    "options": ["A", "B", "C", "D"],
                    "answer": "A",
                    "explanation": "E",
                    "knowledge_points": ["KP"],
                    "difficulty": "easy",
                }]}),
                "model": "mock",
                "usage": {},
                "stub": True,
            }
        if "严禁" in sys_content:
            return {
                "content": json.dumps({
                    "hint": "H",
                    "next_step_hint": "N",
                    "encouragement": "E",
                }),
                "model": "mock",
                "usage": {},
                "stub": True,
            }
        return {
            "content": json.dumps({
                "answer": "A",
                "knowledge_points": ["KP"],
                "follow_up_questions": ["Q1"],
                "resources": ["R1"],
            }),
            "model": "mock",
            "usage": {},
            "stub": True,
        }

    monkeypatch.setattr(ai_tutor_mod.llm_gateway, "complete", _mock_complete)

    app = FastAPI()
    app.include_router(ai_tutor_router_mod.router)
    return TestClient(app)


def test_router_explain_ok(client: TestClient) -> None:
    """POST /api/ai-tutor/explain 返回 200 + 结构化结果。"""
    resp = client.post("/api/ai-tutor/explain", json={
        "subject": "math",
        "question": "什么是导数?",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert "knowledge_points" in data


def test_router_explain_invalid_subject_400(client: TestClient) -> None:
    """POST /api/ai-tutor/explain 不支持的学科返回 400。"""
    resp = client.post("/api/ai-tutor/explain", json={
        "subject": "cooking",
        "question": "怎么炒鸡蛋?",
    })
    assert resp.status_code == 400


def test_router_hint_ok(client: TestClient) -> None:
    """POST /api/ai-tutor/hint 返回 200 + hint 字段。"""
    resp = client.post("/api/ai-tutor/hint", json={
        "subject": "physics",
        "question": "怎么算摩擦力?",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "hint" in data
    assert "next_step_hint" in data
    assert "encouragement" in data


def test_router_quiz_ok(client: TestClient) -> None:
    """POST /api/ai-tutor/quiz 返回 200 + questions 数组。"""
    resp = client.post("/api/ai-tutor/quiz", json={
        "subject": "biology",
        "count": 1,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data.get("questions"), list)
    assert len(data["questions"]) == 1
    assert set(data["questions"][0].keys()) == {
        "question_text", "options", "answer",
        "explanation", "knowledge_points", "difficulty",
    }


def test_router_quiz_count_too_large_422(client: TestClient) -> None:
    """POST /api/ai-tutor/quiz count > 10 返回 422(Pydantic 校验)。"""
    resp = client.post("/api/ai-tutor/quiz", json={
        "subject": "math",
        "count": 11,
    })
    assert resp.status_code == 422


def test_router_quiz_count_zero_422(client: TestClient) -> None:
    """POST /api/ai-tutor/quiz count=0 返回 422(Pydantic ge=1 校验)。"""
    resp = client.post("/api/ai-tutor/quiz", json={
        "subject": "math",
        "count": 0,
    })
    assert resp.status_code == 422


def test_router_explain_missing_question_422(client: TestClient) -> None:
    """POST /api/ai-tutor/explain 缺少 question 字段返回 422。"""
    resp = client.post("/api/ai-tutor/explain", json={
        "subject": "math",
    })
    assert resp.status_code == 422


def test_router_explain_with_context(client: TestClient) -> None:
    """POST /api/ai-tutor/explain 携带 context 正常返回。"""
    resp = client.post("/api/ai-tutor/explain", json={
        "subject": "chemistry",
        "question": "什么是化学键?",
        "context": {
            "chapter": "第2章",
            "knowledge_points": ["离子键", "共价键"],
            "difficulty": "medium",
        },
    })
    assert resp.status_code == 200
    assert "answer" in resp.json()
