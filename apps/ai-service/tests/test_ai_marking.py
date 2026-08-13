"""ai_marking 路由单元测试(2026-08-13 立,补齐 0 覆盖)。

策略:
- _grade_json:monkeypatch app.routers.ai_marking.llm_gateway.complete,
  覆盖 LLM 容错链路(error 透传 / 反斜杠修复 / 代码块提取 / 解析失败 / 非 dict 兜底)
  与分数归一化(clamp 0..maxScore / 字符串 / 非数字兜底 0)。
- grade 端点:空输入 400 + 成功路径(mock _grade_json)。
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.routers import ai_marking
from app.routers.ai_marking import GradeRequest, _grade_json


def json_dumps(raw) -> str:
    return json.dumps(raw)


# ---------------------------------------------------------------------------
# helper
# ---------------------------------------------------------------------------


async def _fake_complete(content: object | None = None, *, error: str | None = None,
                         error_message: str | None = None) -> dict:
    """构造 llm_gateway.complete 的返回。"""
    if error:
        return {"error": error, "error_message": error_message}
    return {"content": content}


# ---------------------------------------------------------------------------
# _grade_json:LLM 容错链路
# ---------------------------------------------------------------------------


class TestGradeJsonLLMChain:
    async def test_gateway_error_passthrough(self, monkeypatch):
        """complete 返回 error → 返回 {'error': ...}(取 error_message 优先)。"""
        monkeypatch.setattr(
            ai_marking.llm_gateway, "complete",
            AsyncMock(return_value={"error": "boom", "error_message": "msg"}),
        )
        result = await _grade_json([{"role": "user", "content": "x"}], 100)
        assert result == {"error": "msg"}

    async def test_gateway_error_only(self, monkeypatch):
        """error 无 error_message → 取 error 字段。"""
        monkeypatch.setattr(
            ai_marking.llm_gateway, "complete",
            AsyncMock(return_value={"error": "boom"}),
        )
        result = await _grade_json([], 100)
        assert result == {"error": "boom"}

    async def test_plain_json(self, monkeypatch):
        """裸 JSON content 正常解析。"""
        content = '{"score": 90, "comment": "很好", "strengths": ["A"], "weaknesses": ["B"], "suggestions": ["C"]}'
        monkeypatch.setattr(
            ai_marking.llm_gateway, "complete", AsyncMock(return_value={"content": content})
        )
        result = await _grade_json([], 100)
        assert result["score"] == 90
        assert result["comment"] == "很好"
        assert result["strengths"] == ["A"]
        assert result["weaknesses"] == ["B"]
        assert result["suggestions"] == ["C"]

    async def test_repair_escapes(self, monkeypatch):
        """content 含非法反斜杠 → _repair_escapes 修复后仍可解析。"""
        # \x 非法转义(JSON 里允许 \t,\x 不允许)→ 修复为 \\x
        content = '{"score": 85, "comment": "path=C:\\temp\\x"}'
        monkeypatch.setattr(
            ai_marking.llm_gateway, "complete", AsyncMock(return_value={"content": content})
        )
        result = await _grade_json([], 100)
        assert "error" not in result
        assert result["score"] == 85
        assert "path=C:" in result["comment"]

    async def test_fenced_code_block(self, monkeypatch):
        """```json 代码块包裹 → 提取后解析。"""
        content = '好的,以下是评分:\n```json\n{"score": 70, "comment": "ok"}\n```\n希望有帮助'
        monkeypatch.setattr(
            ai_marking.llm_gateway, "complete", AsyncMock(return_value={"content": content})
        )
        result = await _grade_json([], 100)
        assert result["score"] == 70
        assert result["comment"] == "ok"

    async def test_invalid_json(self, monkeypatch):
        """content 非 JSON → {'error': 解析异常}。"""
        monkeypatch.setattr(
            ai_marking.llm_gateway, "complete", AsyncMock(return_value={"content": "不是 JSON"})
        )
        result = await _grade_json([], 100)
        assert "error" in result

    async def test_empty_content(self, monkeypatch):
        """content 为空/None → 解析失败兜底 error。"""
        monkeypatch.setattr(
            ai_marking.llm_gateway, "complete", AsyncMock(return_value={"content": ""})
        )
        result = await _grade_json([], 100)
        assert "error" in result

    async def test_non_dict_json(self, monkeypatch):
        """解析出非 dict(如 list)→ 明确 error 提示。"""
        monkeypatch.setattr(
            ai_marking.llm_gateway, "complete", AsyncMock(return_value={"content": '[1, 2, 3]'})
        )
        result = await _grade_json([], 100)
        assert result == {"error": "LLM 输出非 JSON 对象"}


# ---------------------------------------------------------------------------
# _grade_json:分数归一化
# ---------------------------------------------------------------------------


class TestGradeJsonScoreNormalization:
    @pytest.mark.parametrize(
        "raw, max_score, expected",
        [
            (50, 100, 50),
            (0, 100, 0),
            (-10, 100, 0),        # 负分 clamp 到 0
            (150, 100, 100),      # 超满分 clamp 到 max_score
            ("75", 100, 75),      # 数字字符串
            (88.6, 100, 89),      # 小数四舍五入
            ("abc", 100, 0),      # 非数字兜底 0
            (None, 100, 0),       # None 兜底 0
        ],
    )
    async def test_score_clamped(self, monkeypatch, raw, max_score, expected):
        content = f'{{"score": {json_dumps(raw)}, "comment": "c"}}'
        monkeypatch.setattr(
            ai_marking.llm_gateway, "complete", AsyncMock(return_value={"content": content})
        )
        result = await _grade_json([], max_score)
        assert result["score"] == expected

    async def test_lists_filter_non_strings(self, monkeypatch):
        """strengths/weaknesses/suggestions 只保留 str 项。"""
        content = (
            '{"score": 60, "comment": "c", '
            '"strengths": ["a", 1, null, "b"], '
            '"weaknesses": ["x", {"k": 1}], '
            '"suggestions": ["y", ["z"]]}'
        )
        monkeypatch.setattr(
            ai_marking.llm_gateway, "complete", AsyncMock(return_value={"content": content})
        )
        result = await _grade_json([], 100)
        assert result["strengths"] == ["a", "b"]
        assert result["weaknesses"] == ["x"]
        assert result["suggestions"] == ["y"]

    async def test_missing_fields_default(self, monkeypatch):
        """缺 score/comment/列表字段 → 兜底默认值。"""
        monkeypatch.setattr(
            ai_marking.llm_gateway, "complete", AsyncMock(return_value={"content": "{}"})
        )
        result = await _grade_json([], 100)
        assert result == {
            "score": 0,
            "comment": "",
            "strengths": [],
            "weaknesses": [],
            "suggestions": [],
        }


# ---------------------------------------------------------------------------
# grade 端点
# ---------------------------------------------------------------------------


class TestGradeEndpoint:
    async def test_blank_question_400(self):
        with pytest.raises(HTTPException) as ei:
            await ai_marking.grade(GradeRequest(question="   ", studentAnswer="答案"))
        assert ei.value.status_code == 400
        assert "不能为空" in ei.value.detail

    async def test_blank_answer_400(self):
        with pytest.raises(HTTPException) as ei:
            await ai_marking.grade(GradeRequest(question="题目", studentAnswer="  "))
        assert ei.value.status_code == 400

    async def test_success(self, monkeypatch):
        """成功路径:_grade_json mock 返回 → 完整响应 + maxScore。"""
        monkeypatch.setattr(
            ai_marking, "_grade_json",
            AsyncMock(return_value={
                "score": 88,
                "comment": "不错",
                "strengths": ["A"],
                "weaknesses": ["B"],
                "suggestions": ["C"],
            }),
        )
        resp = await ai_marking.grade(
            GradeRequest(question="1+1?", studentAnswer="2", maxScore=100)
        )
        assert resp["score"] == 88
        assert resp["comment"] == "不错"
        assert resp["strengths"] == ["A"]
        assert resp["weaknesses"] == ["B"]
        assert resp["suggestions"] == ["C"]
        assert resp["maxScore"] == 100
        assert "error" not in resp

    async def test_success_with_error_field(self, monkeypatch):
        """_grade_json 返回 error → 响应透传 error 字段(不抛)。"""
        monkeypatch.setattr(
            ai_marking, "_grade_json",
            AsyncMock(return_value={"error": "解析失败"}),
        )
        resp = await ai_marking.grade(
            GradeRequest(question="题目", studentAnswer="答案", maxScore=50)
        )
        assert resp["maxScore"] == 50
        assert resp["score"] == 0
        assert resp["error"] == "解析失败"

    async def test_custom_max_score(self, monkeypatch):
        """自定义 maxScore 传入 _grade_json 与响应。"""
        captured: dict = {}

        async def fake_grade_json(messages, max_score):
            captured["max_score"] = max_score
            return {"score": 10, "comment": "c"}

        monkeypatch.setattr(ai_marking, "_grade_json", fake_grade_json)
        resp = await ai_marking.grade(
            GradeRequest(question="题目", studentAnswer="答案", maxScore=200)
        )
        assert resp["maxScore"] == 200
        assert captured["max_score"] == 200
