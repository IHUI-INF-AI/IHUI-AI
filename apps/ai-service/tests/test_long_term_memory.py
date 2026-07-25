"""L8 长程一致性系统测试(2026-07-25 立)。

覆盖:
- SessionSummarizer.summarize_session:正常 LLM / LLM 失败降级 / 消息不足跳过 /
  JSON 解析失败降级 / DB UPSERT(INSERT + UPDATE 路径)/ embed 失败仍写其他字段 /
  返回字段完整
- SessionSummarizer.compress_working_memory:summary / sliding_window / hybrid 策略 /
  消息数不足不压缩 / DB 持久化日志失败仅 warning / 返回字段完整 / LLM 异常降级
- SessionSummarizer.list_user_summaries:DB 加载 / 失败返回 [] / top_k 限制
- SessionSummarizer.search_relevant_summaries:cosine 排序 / 失败降级 list_user_summaries /
  空结果 / embed 失败降级
- LongTermMemory.recall_cross_session:委托正确 / top_k 限制 / 异常返回 []
- LongTermMemory.build_context_for_new_session:格式正确 / 空返回空字符串 /
  超长截断 / max_summaries 限制
- LongTermMemory.extract_key_facts:聚合去重排序 / 空返回 [] / 异常返回 []
- LongTermMemory.update_importance:成功 / 失败返回 False / score 钳制
- LongTermMemory.load_recent_summaries:DB 加载 / 失败返回 0 / 空 user_id 返回 0
- 工具函数:_format_dialog / _truncate_prompt / _parse_json_response /
  _cosine_similarity / _extract_start_time / _extract_date_str / _parse_rows_affected

全部用 monkeypatch mock llm_gateway / asyncpg,不实际连 DB。
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.long_term_memory import (
    LongTermMemory,
    long_term_memory,
)
from app.services.session_summarizer import (
    SessionSummarizer,
    _cosine_similarity,
    _format_dialog,
    _parse_json_response,
    _truncate_prompt,
    session_summarizer,
)


# =============================================================================
# 工厂函数
# =============================================================================


def make_messages(count: int = 6) -> list[dict]:
    """构造 count 条对话消息(交替 user/assistant)。"""
    msgs = []
    for i in range(count):
        role = "user" if i % 2 == 0 else "assistant"
        msgs.append({"role": role, "content": f"消息 {i}: 这是测试内容。"})
    return msgs


def make_llm_response(
    content: str = "",
    *,
    error: bool = False,
    error_message: str = "",
) -> dict:
    """构造 llm_gateway.complete 返回值。"""
    resp = {
        "content": content,
        "model": "test-model",
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        "stub": False,
    }
    if error:
        resp["error"] = True
        resp["error_message"] = error_message
    return resp


def make_summary_row(
    summary_id: str = "11111111-1111-1111-1111-111111111111",
    session_id: str = "sess-1",
    summary: str = "测试摘要",
    key_facts: list | None = None,
    key_decisions: list | None = None,
    embedding: list | None = None,
    end_time: datetime | None = None,
    importance_score: float = 0.5,
) -> dict:
    """构造 asyncpg fetchrow/fetch 返回的行字典(mock 用)。"""
    return {
        "summary_id": summary_id,
        "session_id": session_id,
        "summary": summary,
        "key_facts": key_facts if key_facts is not None else [],
        "key_decisions": key_decisions if key_decisions is not None else [],
        "message_count": 10,
        "token_count": 100,
        "start_time": datetime(2025, 7, 25, 10, 0, tzinfo=timezone.utc),
        "end_time": end_time or datetime(2025, 7, 25, 11, 0, tzinfo=timezone.utc),
        "importance_score": importance_score,
        "embedding": embedding,
        "created_at": datetime(2025, 7, 25, 11, 0, tzinfo=timezone.utc),
    }


def make_mock_pool(
    *,
    fetch_rows: list | None = None,
    fetchrow_value: dict | None = None,
    execute_status: str = "INSERT 0 1",
) -> tuple[MagicMock, MagicMock]:
    """构造 mock asyncpg pool + conn,返回 (pool, conn)。

    fetch_rows: conn.fetch 返回值(列表)
    fetchrow_value: conn.fetchrow 返回值(dict 或 None)
    execute_status: conn.execute 返回值(状态字符串)
    """
    mock_pool = MagicMock()
    mock_conn = MagicMock()
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    mock_conn.fetch = AsyncMock(return_value=fetch_rows or [])
    mock_conn.fetchrow = AsyncMock(return_value=fetchrow_value)
    mock_conn.execute = AsyncMock(return_value=execute_status)
    return mock_pool, mock_conn


def install_mock_pool(monkeypatch, mock_pool) -> None:
    """把 mock_pool 注入到 session_summarizer 和 long_term_memory 的 _get_pool。"""
    async def fake_get_pool():
        return mock_pool
    monkeypatch.setattr(
        "app.services.session_summarizer._get_pool", fake_get_pool
    )
    monkeypatch.setattr(
        "app.services.long_term_memory._get_pool", fake_get_pool
    )


def install_llm_complete(monkeypatch, response: dict) -> None:
    """注入 llm_gateway.complete mock。"""
    monkeypatch.setattr(
        "app.services.session_summarizer.llm_gateway.complete",
        AsyncMock(return_value=response),
    )


def install_llm_embed(monkeypatch, embedding: list[float]) -> None:
    """注入 llm_gateway.embed mock。"""
    monkeypatch.setattr(
        "app.services.session_summarizer.llm_gateway.embed",
        AsyncMock(return_value=embedding),
    )


# =============================================================================
# 工具函数测试
# =============================================================================


class TestFormatDialog:
    """_format_dialog:把 messages 拼成对话文本。"""

    def test_normal_messages(self):
        msgs = [
            {"role": "user", "content": "你好"},
            {"role": "assistant", "content": "你好,有什么可以帮您?"},
        ]
        text = _format_dialog(msgs)
        assert "user: 你好" in text
        assert "assistant: 你好,有什么可以帮您?" in text

    def test_empty_content_filtered(self):
        """空 content 被过滤掉。"""
        msgs = [
            {"role": "user", "content": ""},
            {"role": "assistant", "content": "x"},
        ]
        text = _format_dialog(msgs)
        assert "user:" not in text
        assert "assistant: x" in text

    def test_non_dict_skipped(self):
        """非 dict 元素被跳过。"""
        text = _format_dialog([None, "string", {"role": "user", "content": "y"}])
        assert "user: y" in text

    def test_missing_role_defaults_user(self):
        """缺 role 字段时默认 user。"""
        text = _format_dialog([{"content": "hi"}])
        assert "user: hi" in text


class TestTruncatePrompt:
    """_truncate_prompt:超长截断保留首尾。"""

    def test_short_text_unchanged(self):
        text = "短文本"
        assert _truncate_prompt(text, limit=100) == text

    def test_long_text_truncated(self):
        text = "x" * 5000
        result = _truncate_prompt(text, limit=100)
        assert len(result) <= 100
        assert "已截断" in result
        # 保留首尾
        assert result.startswith("x")
        assert result.endswith("x")

    def test_limit_boundary(self):
        """刚好等于 limit 不截断。"""
        text = "a" * 100
        assert _truncate_prompt(text, limit=100) == text


class TestParseJsonResponse:
    """_parse_json_response:解析 LLM 返回的 JSON。"""

    def test_valid_json(self):
        result = _parse_json_response('{"summary": "x", "key_facts": ["a"]}')
        assert result is not None
        assert result["summary"] == "x"
        assert result["key_facts"] == ["a"]

    def test_markdown_code_block(self):
        result = _parse_json_response('```json\n{"summary": "x"}\n```')
        assert result is not None
        assert result["summary"] == "x"

    def test_plain_code_block(self):
        result = _parse_json_response('```\n{"summary": "x"}\n```')
        assert result is not None
        assert result["summary"] == "x"

    def test_noise_text_around_json(self):
        result = _parse_json_response('Sure, here is: {"summary": "x"} done.')
        assert result is not None
        assert result["summary"] == "x"

    def test_invalid_returns_none(self):
        assert _parse_json_response("not json at all") is None

    def test_empty_returns_none(self):
        assert _parse_json_response("") is None

    def test_non_dict_returns_none(self):
        """JSON 数组(非 dict)返回 None。"""
        assert _parse_json_response('["a", "b"]') is None

    def test_broken_json_returns_none(self):
        assert _parse_json_response('{"summary": broken') is None


class TestCosineSimilarity:
    """_cosine_similarity:余弦相似度。"""

    def test_orthogonal_vectors(self):
        a = [1.0, 0.0, 0.0]
        b = [0.0, 1.0, 0.0]
        assert _cosine_similarity(a, b) == 0.0

    def test_identical_vectors(self):
        a = [1.0, 1.0, 0.0]
        assert _cosine_similarity(a, a) == pytest.approx(1.0)

    def test_parallel_vectors(self):
        a = [1.0, 1.0]
        b = [2.0, 2.0]
        assert _cosine_similarity(a, b) == pytest.approx(1.0)

    def test_empty_vectors(self):
        assert _cosine_similarity([], [1.0]) == 0.0

    def test_length_mismatch(self):
        assert _cosine_similarity([1.0, 2.0], [1.0]) == 0.0

    def test_zero_norm(self):
        assert _cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0

    def test_negative_correlation(self):
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert _cosine_similarity(a, b) == pytest.approx(-1.0)


# =============================================================================
# SessionSummarizer.summarize_session
# =============================================================================


class TestSummarizeSession:
    """summarize_session:会话摘要主入口。"""

    @pytest.mark.asyncio
    async def test_normal_llm_returns_json(self, monkeypatch):
        """LLM 返回合法 JSON → 解析 summary + key_facts + key_decisions。"""
        summarizer = SessionSummarizer()
        llm_content = json.dumps({
            "summary": "用户询问天气,助手回复晴天。",
            "key_facts": ["用户在询问天气", "今天是晴天"],
            "key_decisions": ["决定出门"],
        })
        install_llm_complete(monkeypatch, make_llm_response(llm_content))
        install_llm_embed(monkeypatch, [0.1, 0.2, 0.3])
        mock_pool, mock_conn = make_mock_pool(fetchrow_value=None)
        install_mock_pool(monkeypatch, mock_pool)

        result = await summarizer.summarize_session(
            "user-1", "sess-1", make_messages(6)
        )
        assert result["skipped"] is False
        assert "天气" in result["summary"]
        assert len(result["key_facts"]) == 2
        assert len(result["key_decisions"]) == 1
        assert result["summary_id"]  # 非空

    @pytest.mark.asyncio
    async def test_messages_less_than_5_skipped(self, monkeypatch):
        """messages < 5 → skipped=True,不调 LLM。"""
        summarizer = SessionSummarizer()
        complete_mock = AsyncMock()
        monkeypatch.setattr(
            "app.services.session_summarizer.llm_gateway.complete", complete_mock
        )

        result = await summarizer.summarize_session(
            "user-1", "sess-1", make_messages(3)
        )
        assert result["skipped"] is True
        assert result["summary"] == ""
        assert result["key_facts"] == []
        assert result["key_decisions"] == []
        assert result["summary_id"] == ""
        # LLM 不应被调用
        assert complete_mock.await_count == 0

    @pytest.mark.asyncio
    async def test_empty_messages_skipped(self, monkeypatch):
        """空 messages → skipped=True。"""
        summarizer = SessionSummarizer()
        result = await summarizer.summarize_session("user-1", "sess-1", [])
        assert result["skipped"] is True

    @pytest.mark.asyncio
    async def test_llm_returns_error_fallback(self, monkeypatch):
        """LLM 返回 error=True → 降级用 raw_response[:500] 或占位。"""
        summarizer = SessionSummarizer()
        install_llm_complete(
            monkeypatch,
            make_llm_response(
                content="LLM 失败的原始响应",
                error=True,
                error_message="provider down",
            ),
        )
        install_llm_embed(monkeypatch, [0.1])
        mock_pool, _ = make_mock_pool(fetchrow_value=None)
        install_mock_pool(monkeypatch, mock_pool)

        result = await summarizer.summarize_session(
            "user-1", "sess-1", make_messages(6)
        )
        assert result["skipped"] is False
        assert result["summary"] == "LLM 失败的原始响应"
        assert result["key_facts"] == []
        assert result["key_decisions"] == []

    @pytest.mark.asyncio
    async def test_json_parse_failure_fallback(self, monkeypatch):
        """LLM 返回非 JSON 文本 → 降级 summary=raw_response[:500]。"""
        summarizer = SessionSummarizer()
        install_llm_complete(
            monkeypatch,
            make_llm_response("这不是 JSON,只是一段普通文本。"),
        )
        install_llm_embed(monkeypatch, [0.1])
        mock_pool, _ = make_mock_pool(fetchrow_value=None)
        install_mock_pool(monkeypatch, mock_pool)

        result = await summarizer.summarize_session(
            "user-1", "sess-1", make_messages(6)
        )
        assert result["skipped"] is False
        assert "普通文本" in result["summary"]
        assert result["key_facts"] == []
        assert result["key_decisions"] == []

    @pytest.mark.asyncio
    async def test_llm_exception_fallback(self, monkeypatch):
        """LLM 调用抛异常 → summary 设为异常占位。"""
        summarizer = SessionSummarizer()
        async def boom(*args, **kwargs):
            raise RuntimeError("LLM service down")
        monkeypatch.setattr(
            "app.services.session_summarizer.llm_gateway.complete", boom
        )
        install_llm_embed(monkeypatch, [0.1])
        mock_pool, _ = make_mock_pool(fetchrow_value=None)
        install_mock_pool(monkeypatch, mock_pool)

        result = await summarizer.summarize_session(
            "user-1", "sess-1", make_messages(6)
        )
        assert result["skipped"] is False
        assert "LLM" in result["summary"] or "异常" in result["summary"]

    @pytest.mark.asyncio
    async def test_db_upsert_insert_path(self, monkeypatch):
        """DB UPSERT 不存在 → INSERT 路径。"""
        summarizer = SessionSummarizer()
        install_llm_complete(
            monkeypatch,
            make_llm_response(json.dumps({"summary": "S1", "key_facts": [], "key_decisions": []})),
        )
        install_llm_embed(monkeypatch, [0.1, 0.2])
        mock_pool, mock_conn = make_mock_pool(fetchrow_value=None)
        install_mock_pool(monkeypatch, mock_pool)

        await summarizer.summarize_session("user-1", "sess-1", make_messages(6))
        # fetchrow 调用 1 次(查 existing)
        assert mock_conn.fetchrow.await_count == 1
        # execute 至少 2 次:1 次 INSERT summary + 1 次 UPDATE embedding
        assert mock_conn.execute.await_count >= 2
        # 第一次 execute 是 INSERT(包含 INSERT INTO)
        first_call_args = mock_conn.execute.await_args_list[0].args
        assert "INSERT INTO agent_session_summary" in first_call_args[0]

    @pytest.mark.asyncio
    async def test_db_upsert_update_path(self, monkeypatch):
        """DB UPSERT 已存在 → UPDATE 路径,summary_id 用 existing 的。"""
        summarizer = SessionSummarizer()
        existing_id = "22222222-2222-2222-2222-222222222222"
        install_llm_complete(
            monkeypatch,
            make_llm_response(json.dumps({"summary": "S1"})),
        )
        install_llm_embed(monkeypatch, [0.1])
        mock_pool, mock_conn = make_mock_pool(
            fetchrow_value={"sid": existing_id}
        )
        install_mock_pool(monkeypatch, mock_pool)

        result = await summarizer.summarize_session(
            "user-1", "sess-1", make_messages(6)
        )
        assert result["summary_id"] == existing_id
        # 第一次 execute 是 UPDATE(包含 UPDATE agent_session_summary SET)
        first_exec_args = mock_conn.execute.await_args_list[0].args
        assert "UPDATE agent_session_summary SET" in first_exec_args[0]

    @pytest.mark.asyncio
    async def test_db_failure_returns_empty_summary_id(self, monkeypatch):
        """_persist_summary 抛异常 → summary_id 为空,但仍返回内存 dict。"""
        summarizer = SessionSummarizer()
        install_llm_complete(
            monkeypatch,
            make_llm_response(json.dumps({"summary": "S1"})),
        )
        async def boom_pool():
            raise RuntimeError("DB down")
        monkeypatch.setattr(
            "app.services.session_summarizer._get_pool", boom_pool
        )
        monkeypatch.setattr(
            "app.services.long_term_memory._get_pool", boom_pool
        )

        result = await summarizer.summarize_session(
            "user-1", "sess-1", make_messages(6)
        )
        assert result["summary_id"] == ""
        # summary 仍从 LLM 解析得到
        assert result["summary"] == "S1"
        assert result["skipped"] is False

    @pytest.mark.asyncio
    async def test_embed_failure_does_not_block(self, monkeypatch):
        """embed 失败 → summary 仍持久化,embedding 字段为 None。"""
        summarizer = SessionSummarizer()
        install_llm_complete(
            monkeypatch,
            make_llm_response(json.dumps({"summary": "S1"})),
        )
        async def boom_embed(*args, **kwargs):
            raise RuntimeError("embed service down")
        monkeypatch.setattr(
            "app.services.session_summarizer.llm_gateway.embed", boom_embed
        )
        mock_pool, mock_conn = make_mock_pool(fetchrow_value=None)
        install_mock_pool(monkeypatch, mock_pool)

        result = await summarizer.summarize_session(
            "user-1", "sess-1", make_messages(6)
        )
        # summary_id 已持久化
        assert result["summary_id"]
        # 只 1 次 execute(INSERT summary),没有 UPDATE embedding
        assert mock_conn.execute.await_count == 1

    @pytest.mark.asyncio
    async def test_return_fields_complete(self, monkeypatch):
        """返回 dict 字段完整(summary_id/summary/key_facts/key_decisions/skipped)。"""
        summarizer = SessionSummarizer()
        install_llm_complete(
            monkeypatch,
            make_llm_response(
                json.dumps({
                    "summary": "S1",
                    "key_facts": ["f1"],
                    "key_decisions": ["d1"],
                })
            ),
        )
        install_llm_embed(monkeypatch, [0.1])
        mock_pool, _ = make_mock_pool(fetchrow_value=None)
        install_mock_pool(monkeypatch, mock_pool)

        result = await summarizer.summarize_session(
            "user-1", "sess-1", make_messages(6)
        )
        assert set(result.keys()) == {
            "summary_id", "summary", "key_facts", "key_decisions", "skipped"
        }

    @pytest.mark.asyncio
    async def test_long_dialog_truncated_in_prompt(self, monkeypatch):
        """超长 dialog 被截断到 4000 字符内。"""
        summarizer = SessionSummarizer()
        captured_prompts: list[str] = []

        async def capture_complete(messages, **kwargs):
            captured_prompts.append(messages[0]["content"])
            return make_llm_response(json.dumps({"summary": "S"}))
        monkeypatch.setattr(
            "app.services.session_summarizer.llm_gateway.complete",
            capture_complete,
        )
        install_llm_embed(monkeypatch, [0.1])
        mock_pool, _ = make_mock_pool(fetchrow_value=None)
        install_mock_pool(monkeypatch, mock_pool)

        long_msgs = [
            {"role": "user", "content": "x" * 2000},
            {"role": "assistant", "content": "y" * 2000},
            {"role": "user", "content": "z" * 2000},
            {"role": "assistant", "content": "a" * 2000},
            {"role": "user", "content": "b" * 2000},
            {"role": "assistant", "content": "c" * 2000},
        ]
        await summarizer.summarize_session("user-1", "sess-1", long_msgs)
        assert len(captured_prompts[0]) <= 4000
        assert "已截断" in captured_prompts[0]


# =============================================================================
# SessionSummarizer.compress_working_memory
# =============================================================================


class TestCompressWorkingMemory:
    """compress_working_memory:工作记忆压缩。"""

    @pytest.mark.asyncio
    async def test_no_compression_when_under_limit(self, monkeypatch):
        """messages 数 < max_messages → 不压缩,原样返回。"""
        summarizer = SessionSummarizer()
        msgs = make_messages(5)
        result = await summarizer.compress_working_memory(
            "user-1", "sess-1", msgs, max_messages=20
        )
        assert result["original_count"] == 5
        assert result["compressed_to"] == 5
        assert result["compressed_messages"] == msgs
        assert result["strategy"] == "hybrid"  # 默认 strategy

    @pytest.mark.asyncio
    async def test_sliding_window_strategy(self, monkeypatch):
        """sliding_window:直接丢弃前 N-max,保留最后 max 条。"""
        summarizer = SessionSummarizer()
        mock_pool, _ = make_mock_pool()
        install_mock_pool(monkeypatch, mock_pool)
        msgs = make_messages(10)
        result = await summarizer.compress_working_memory(
            "user-1", "sess-1", msgs, max_messages=4, strategy="sliding_window"
        )
        assert result["original_count"] == 10
        assert result["compressed_to"] == 4
        assert result["strategy"] == "sliding_window"
        # 保留最后 4 条
        assert result["compressed_messages"] == msgs[-4:]

    @pytest.mark.asyncio
    async def test_summary_strategy(self, monkeypatch):
        """summary:前 N-max 摘要成 1 system + 最后 max 条。"""
        summarizer = SessionSummarizer()
        install_llm_complete(monkeypatch, make_llm_response("前文摘要文本"))
        mock_pool, _ = make_mock_pool()
        install_mock_pool(monkeypatch, mock_pool)
        msgs = make_messages(10)
        result = await summarizer.compress_working_memory(
            "user-1", "sess-1", msgs, max_messages=4, strategy="summary"
        )
        assert result["original_count"] == 10
        # 1 summary + 4 recent = 5
        assert result["compressed_to"] == 5
        assert result["strategy"] == "summary"
        # 首条是 system message(摘要)
        first = result["compressed_messages"][0]
        assert first["role"] == "system"
        assert "[前文摘要]" in first["content"]
        # 后 4 条是原 messages 最后 4 条
        assert result["compressed_messages"][1:] == msgs[-4:]

    @pytest.mark.asyncio
    async def test_hybrid_strategy(self, monkeypatch):
        """hybrid:前 N-(max/2) 摘要 + 最后 max/2 条。"""
        summarizer = SessionSummarizer()
        install_llm_complete(monkeypatch, make_llm_response("hybrid 摘要"))
        mock_pool, _ = make_mock_pool()
        install_mock_pool(monkeypatch, mock_pool)
        msgs = make_messages(10)
        result = await summarizer.compress_working_memory(
            "user-1", "sess-1", msgs, max_messages=4, strategy="hybrid"
        )
        # max/2 = 2, 1 summary + 2 recent = 3
        assert result["compressed_to"] == 3
        assert result["strategy"] == "hybrid"
        # 首条是 system
        assert result["compressed_messages"][0]["role"] == "system"
        # 后 2 条是原 messages 最后 2 条
        assert result["compressed_messages"][1:] == msgs[-2:]

    @pytest.mark.asyncio
    async def test_compression_log_failure_only_warning(self, monkeypatch):
        """压缩日志持久化失败 → 仅 warning,返回仍正确。"""
        summarizer = SessionSummarizer()
        # _get_pool 抛异常 → _persist_compression_log 失败
        async def boom_pool():
            raise RuntimeError("DB down")
        monkeypatch.setattr(
            "app.services.session_summarizer._get_pool", boom_pool
        )
        monkeypatch.setattr(
            "app.services.long_term_memory._get_pool", boom_pool
        )
        msgs = make_messages(10)
        result = await summarizer.compress_working_memory(
            "user-1", "sess-1", msgs, max_messages=4, strategy="sliding_window"
        )
        # 仍返回压缩结果(DB 失败不影响)
        assert result["original_count"] == 10
        assert result["compressed_to"] == 4

    @pytest.mark.asyncio
    async def test_return_fields_complete(self, monkeypatch):
        """返回 dict 字段完整。"""
        summarizer = SessionSummarizer()
        mock_pool, _ = make_mock_pool()
        install_mock_pool(monkeypatch, mock_pool)
        result = await summarizer.compress_working_memory(
            "user-1", "sess-1", make_messages(10), max_messages=4,
            strategy="sliding_window",
        )
        assert set(result.keys()) == {
            "compressed_messages", "original_count", "compressed_to", "strategy"
        }

    @pytest.mark.asyncio
    async def test_compress_llm_exception_fallback(self, monkeypatch):
        """_compress_with_llm LLM 异常 → 降级占位 system 消息。"""
        summarizer = SessionSummarizer()
        async def boom(*args, **kwargs):
            raise RuntimeError("LLM down")
        monkeypatch.setattr(
            "app.services.session_summarizer.llm_gateway.complete", boom
        )
        mock_pool, _ = make_mock_pool()
        install_mock_pool(monkeypatch, mock_pool)
        msgs = make_messages(10)
        result = await summarizer.compress_working_memory(
            "user-1", "sess-1", msgs, max_messages=4, strategy="summary"
        )
        # 首条是降级占位 system 消息
        first = result["compressed_messages"][0]
        assert first["role"] == "system"
        assert "前文摘要" in first["content"]

    @pytest.mark.asyncio
    async def test_zero_messages_returns_empty(self, monkeypatch):
        """空 messages → original_count=0,不压缩。"""
        summarizer = SessionSummarizer()
        result = await summarizer.compress_working_memory(
            "user-1", "sess-1", [], max_messages=4
        )
        assert result["original_count"] == 0
        assert result["compressed_to"] == 0
        assert result["compressed_messages"] == []


# =============================================================================
# SessionSummarizer.list_user_summaries
# =============================================================================


class TestListUserSummaries:
    """list_user_summaries:DB 加载历史摘要。"""

    @pytest.mark.asyncio
    async def test_loads_rows_from_db(self, monkeypatch):
        summarizer = SessionSummarizer()
        rows = [
            make_summary_row(summary_id="id-1", summary="S1"),
            make_summary_row(summary_id="id-2", summary="S2"),
        ]
        mock_pool, _ = make_mock_pool(fetch_rows=rows)
        install_mock_pool(monkeypatch, mock_pool)

        result = await summarizer.list_user_summaries("user-1")
        assert len(result) == 2
        assert result[0]["summary_id"] == "id-1"
        assert result[0]["summary"] == "S1"

    @pytest.mark.asyncio
    async def test_db_failure_returns_empty_list(self, monkeypatch):
        summarizer = SessionSummarizer()
        async def boom_pool():
            raise RuntimeError("DB down")
        monkeypatch.setattr(
            "app.services.session_summarizer._get_pool", boom_pool
        )
        result = await summarizer.list_user_summaries("user-1")
        assert result == []

    @pytest.mark.asyncio
    async def test_top_k_limit_passed_to_query(self, monkeypatch):
        """top_k 透传到 SQL LIMIT。"""
        summarizer = SessionSummarizer()
        mock_pool, mock_conn = make_mock_pool(fetch_rows=[])
        install_mock_pool(monkeypatch, mock_pool)
        await summarizer.list_user_summaries("user-1", top_k=5)
        # fetch 第 2 个参数是 top_k
        fetch_args = mock_conn.fetch.await_args.args
        assert fetch_args[2] == 5


# =============================================================================
# SessionSummarizer.search_relevant_summaries
# =============================================================================


class TestSearchRelevantSummaries:
    """search_relevant_summaries:跨会话 RAG cosine 检索。"""

    @pytest.mark.asyncio
    async def test_cosine_ranking(self, monkeypatch):
        """cosine 相似度排序:更相似的排前面。"""
        summarizer = SessionSummarizer()
        query_emb = [1.0, 0.0]
        # row1 与 query 完全相似,row2 正交
        rows = [
            make_summary_row(
                summary_id="orthogonal", summary="orthogonal",
                embedding=[0.0, 1.0],
            ),
            make_summary_row(
                summary_id="similar", summary="similar",
                embedding=[1.0, 0.0],
            ),
        ]
        install_llm_embed(monkeypatch, query_emb)
        mock_pool, _ = make_mock_pool(fetch_rows=rows)
        install_mock_pool(monkeypatch, mock_pool)

        result = await summarizer.search_relevant_summaries(
            "user-1", "查询", top_k=2
        )
        assert len(result) == 2
        # 更相似的排前面
        assert result[0]["summary_id"] == "similar"
        assert result[1]["summary_id"] == "orthogonal"

    @pytest.mark.asyncio
    async def test_embed_failure_fallback_to_list(self, monkeypatch):
        """embed query 失败 → 降级 list_user_summaries。"""
        summarizer = SessionSummarizer()
        async def boom_embed(*args, **kwargs):
            raise RuntimeError("embed down")
        monkeypatch.setattr(
            "app.services.session_summarizer.llm_gateway.embed", boom_embed
        )
        rows = [make_summary_row(summary_id="id-1", summary="S1")]
        mock_pool, _ = make_mock_pool(fetch_rows=rows)
        install_mock_pool(monkeypatch, mock_pool)

        result = await summarizer.search_relevant_summaries(
            "user-1", "查询", top_k=5
        )
        # 降级返回 list_user_summaries 的结果
        assert len(result) == 1
        assert result[0]["summary_id"] == "id-1"

    @pytest.mark.asyncio
    async def test_empty_embedding_returns_empty(self, monkeypatch):
        """所有 summary embedding 都为 None → 跳过,返回 []。"""
        summarizer = SessionSummarizer()
        install_llm_embed(monkeypatch, [1.0, 0.0])
        rows = [
            make_summary_row(summary_id="id-1", embedding=None),
            make_summary_row(summary_id="id-2", embedding=[]),
        ]
        mock_pool, _ = make_mock_pool(fetch_rows=rows)
        install_mock_pool(monkeypatch, mock_pool)

        result = await summarizer.search_relevant_summaries(
            "user-1", "查询", top_k=5
        )
        assert result == []

    @pytest.mark.asyncio
    async def test_db_failure_fallback_to_list(self, monkeypatch):
        """DB 加载失败 → 降级 list_user_summaries(也失败则 [])。"""
        summarizer = SessionSummarizer()
        install_llm_embed(monkeypatch, [1.0, 0.0])
        async def boom_pool():
            raise RuntimeError("DB down")
        monkeypatch.setattr(
            "app.services.session_summarizer._get_pool", boom_pool
        )
        result = await summarizer.search_relevant_summaries(
            "user-1", "查询", top_k=5
        )
        # 降级链路:list_user_summaries 也失败 → []
        assert result == []

    @pytest.mark.asyncio
    async def test_top_k_limit(self, monkeypatch):
        """top_k 截断返回条数。"""
        summarizer = SessionSummarizer()
        install_llm_embed(monkeypatch, [1.0, 0.0])
        rows = [
            make_summary_row(
                summary_id=f"id-{i}", summary=f"S{i}",
                embedding=[1.0, 0.0],
            )
            for i in range(5)
        ]
        mock_pool, _ = make_mock_pool(fetch_rows=rows)
        install_mock_pool(monkeypatch, mock_pool)

        result = await summarizer.search_relevant_summaries(
            "user-1", "查询", top_k=2
        )
        assert len(result) == 2


# =============================================================================
# LongTermMemory.recall_cross_session
# =============================================================================


class TestRecallCrossSession:
    """recall_cross_session:委托 session_summarizer。"""

    @pytest.mark.asyncio
    async def test_delegates_to_session_summarizer(self, monkeypatch):
        memory = LongTermMemory()
        fake_summaries = [{"summary_id": "id-1", "summary": "S1"}]
        monkeypatch.setattr(
            session_summarizer,
            "search_relevant_summaries",
            AsyncMock(return_value=fake_summaries),
        )
        result = await memory.recall_cross_session("user-1", "查询", top_k=5)
        assert result == fake_summaries

    @pytest.mark.asyncio
    async def test_top_k_passed_through(self, monkeypatch):
        memory = LongTermMemory()
        mock_method = AsyncMock(return_value=[])
        monkeypatch.setattr(
            session_summarizer, "search_relevant_summaries", mock_method
        )
        await memory.recall_cross_session("user-1", "查询", top_k=7)
        # 验证 top_k 透传
        assert mock_method.await_args.kwargs["top_k"] == 7

    @pytest.mark.asyncio
    async def test_exception_returns_empty_list(self, monkeypatch):
        """session_summarizer 抛异常 → 返回 []。"""
        memory = LongTermMemory()
        async def boom(*args, **kwargs):
            raise RuntimeError("down")
        monkeypatch.setattr(
            session_summarizer, "search_relevant_summaries", boom
        )
        result = await memory.recall_cross_session("user-1", "查询")
        assert result == []


# =============================================================================
# LongTermMemory.build_context_for_new_session
# =============================================================================


class TestBuildContextForNewSession:
    """build_context_for_new_session:格式化历史摘要为 prompt 片段。"""

    @pytest.mark.asyncio
    async def test_format_correct(self, monkeypatch):
        memory = LongTermMemory()
        summaries = [
            {
                "summary_id": "id-1",
                "summary": "用户讨论了天气",
                "key_facts": ["今天是晴天"],
                "key_decisions": ["决定出门"],
                "end_time": "2025-07-25T11:00:00+00:00",
            },
        ]
        monkeypatch.setattr(
            session_summarizer,
            "search_relevant_summaries",
            AsyncMock(return_value=summaries),
        )
        result = await memory.build_context_for_new_session(
            "user-1", "查询", max_summaries=3
        )
        assert "## 历史会话参考" in result
        assert "### 会话 1 (2025-07-25)" in result
        assert "摘要: 用户讨论了天气" in result
        assert "关键事实: 今天是晴天" in result
        assert "关键决策: 决定出门" in result

    @pytest.mark.asyncio
    async def test_empty_summaries_returns_empty_string(self, monkeypatch):
        memory = LongTermMemory()
        monkeypatch.setattr(
            session_summarizer,
            "search_relevant_summaries",
            AsyncMock(return_value=[]),
        )
        result = await memory.build_context_for_new_session(
            "user-1", "查询", max_summaries=3
        )
        assert result == ""

    @pytest.mark.asyncio
    async def test_search_exception_returns_empty(self, monkeypatch):
        """检索抛异常 → 返回空字符串。"""
        memory = LongTermMemory()
        async def boom(*args, **kwargs):
            raise RuntimeError("down")
        monkeypatch.setattr(
            session_summarizer, "search_relevant_summaries", boom
        )
        result = await memory.build_context_for_new_session(
            "user-1", "查询", max_summaries=3
        )
        assert result == ""

    @pytest.mark.asyncio
    async def test_max_summaries_limit(self, monkeypatch):
        """max_summaries 透传到 search_relevant_summaries 的 top_k。"""
        memory = LongTermMemory()
        mock_method = AsyncMock(return_value=[])
        monkeypatch.setattr(
            session_summarizer, "search_relevant_summaries", mock_method
        )
        await memory.build_context_for_new_session(
            "user-1", "查询", max_summaries=5
        )
        assert mock_method.await_args.kwargs["top_k"] == 5

    @pytest.mark.asyncio
    async def test_overlong_context_truncated(self, monkeypatch):
        """超长上下文截断到 2000 字符内。"""
        memory = LongTermMemory()
        long_summary = "x" * 3000
        summaries = [
            {
                "summary_id": "id-1",
                "summary": long_summary,
                "key_facts": [],
                "key_decisions": [],
                "end_time": "2025-07-25T11:00:00+00:00",
            },
        ]
        monkeypatch.setattr(
            session_summarizer,
            "search_relevant_summaries",
            AsyncMock(return_value=summaries),
        )
        result = await memory.build_context_for_new_session(
            "user-1", "查询", max_summaries=3
        )
        assert len(result) <= 2000
        assert result.endswith("...")

    @pytest.mark.asyncio
    async def test_missing_end_time_shows_unknown_date(self, monkeypatch):
        """end_time 缺失 → 显示"未知日期"。"""
        memory = LongTermMemory()
        summaries = [
            {
                "summary_id": "id-1",
                "summary": "S1",
                "key_facts": [],
                "key_decisions": [],
                "end_time": None,
            },
        ]
        monkeypatch.setattr(
            session_summarizer,
            "search_relevant_summaries",
            AsyncMock(return_value=summaries),
        )
        result = await memory.build_context_for_new_session(
            "user-1", "查询", max_summaries=3
        )
        assert "未知日期" in result


# =============================================================================
# LongTermMemory.extract_key_facts
# =============================================================================


class TestExtractKeyFacts:
    """extract_key_facts:聚合 + 去重 + 排序。"""

    @pytest.mark.asyncio
    async def test_aggregate_dedup_sort(self, monkeypatch):
        """多 summary 的 key_facts 聚合 + 去重 + 按出现次数排序。"""
        memory = LongTermMemory()
        summaries = [
            {"key_facts": ["事实A", "事实B", "事实C"]},
            {"key_facts": ["事实A", "事实B"]},
            {"key_facts": ["事实A"]},
        ]
        monkeypatch.setattr(
            session_summarizer,
            "list_user_summaries",
            AsyncMock(return_value=summaries),
        )
        result = await memory.extract_key_facts("user-1")
        # 事实A 出现 3 次,事实B 出现 2 次,事实C 出现 1 次
        assert result[0] == "事实A"
        assert result[1] == "事实B"
        assert result[2] == "事实C"
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_empty_summaries_returns_empty(self, monkeypatch):
        memory = LongTermMemory()
        monkeypatch.setattr(
            session_summarizer,
            "list_user_summaries",
            AsyncMock(return_value=[]),
        )
        result = await memory.extract_key_facts("user-1")
        assert result == []

    @pytest.mark.asyncio
    async def test_exception_returns_empty(self, monkeypatch):
        memory = LongTermMemory()
        async def boom(*args, **kwargs):
            raise RuntimeError("down")
        monkeypatch.setattr(session_summarizer, "list_user_summaries", boom)
        result = await memory.extract_key_facts("user-1")
        assert result == []

    @pytest.mark.asyncio
    async def test_max_20_facts_limit(self, monkeypatch):
        """返回条数上限 20。"""
        memory = LongTermMemory()
        # 25 个不同 facts,每个出现 1 次
        many_facts = [f"事实{i}" for i in range(25)]
        summaries = [{"key_facts": many_facts}]
        monkeypatch.setattr(
            session_summarizer,
            "list_user_summaries",
            AsyncMock(return_value=summaries),
        )
        result = await memory.extract_key_facts("user-1")
        assert len(result) == 20

    @pytest.mark.asyncio
    async def test_empty_fact_filtered(self, monkeypatch):
        """空字符串 fact 被过滤。"""
        memory = LongTermMemory()
        summaries = [{"key_facts": ["", "  ", "有效事实"]}]
        monkeypatch.setattr(
            session_summarizer,
            "list_user_summaries",
            AsyncMock(return_value=summaries),
        )
        result = await memory.extract_key_facts("user-1")
        assert result == ["有效事实"]


# =============================================================================
# LongTermMemory.update_importance
# =============================================================================


class TestUpdateImportance:
    """update_importance:更新 summary 重要性。"""

    @pytest.mark.asyncio
    async def test_success_returns_true(self, monkeypatch):
        memory = LongTermMemory()
        mock_pool, _ = make_mock_pool(execute_status="UPDATE 1")
        install_mock_pool(monkeypatch, mock_pool)
        result = await memory.update_importance(
            "user-1", "11111111-1111-1111-1111-111111111111", 0.8
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_no_row_updated_returns_false(self, monkeypatch):
        """UPDATE 0 → 无行被更新 → 返回 False。"""
        memory = LongTermMemory()
        mock_pool, _ = make_mock_pool(execute_status="UPDATE 0")
        install_mock_pool(monkeypatch, mock_pool)
        result = await memory.update_importance(
            "user-1", "11111111-1111-1111-1111-111111111111", 0.8
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_db_failure_returns_false(self, monkeypatch):
        memory = LongTermMemory()
        async def boom_pool():
            raise RuntimeError("DB down")
        monkeypatch.setattr(
            "app.services.long_term_memory._get_pool", boom_pool
        )
        result = await memory.update_importance(
            "user-1", "11111111-1111-1111-1111-111111111111", 0.8
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_empty_summary_id_returns_false(self, monkeypatch):
        """空 summary_id → 直接返回 False,不查 DB。"""
        memory = LongTermMemory()
        mock_pool, mock_conn = make_mock_pool()
        install_mock_pool(monkeypatch, mock_pool)
        result = await memory.update_importance("user-1", "", 0.8)
        assert result is False
        # 不应执行任何 SQL
        assert mock_conn.execute.await_count == 0

    @pytest.mark.asyncio
    async def test_score_clamped_to_range(self, monkeypatch):
        """score 钳制到 [0, 1],传 1.5 / -0.5 仍能调用。"""
        memory = LongTermMemory()
        mock_pool, mock_conn = make_mock_pool(execute_status="UPDATE 1")
        install_mock_pool(monkeypatch, mock_pool)
        # 1.5 钳到 1.0
        await memory.update_importance(
            "user-1", "11111111-1111-1111-1111-111111111111", 1.5
        )
        score_arg = mock_conn.execute.await_args.args[1]
        assert score_arg == 1.0

        # -0.5 钳到 0.0
        await memory.update_importance(
            "user-1", "11111111-1111-1111-1111-111111111111", -0.5
        )
        score_arg = mock_conn.execute.await_args.args[1]
        assert score_arg == 0.0


# =============================================================================
# LongTermMemory.load_recent_summaries
# =============================================================================


class TestLoadRecentSummaries:
    """load_recent_summaries:启动时 hydrate 内存缓存。"""

    @pytest.mark.asyncio
    async def test_loads_rows_to_cache(self, monkeypatch):
        memory = LongTermMemory()
        rows = [
            make_summary_row(summary_id="id-1", summary="S1"),
            make_summary_row(summary_id="id-2", summary="S2"),
        ]
        mock_pool, _ = make_mock_pool(fetch_rows=rows)
        install_mock_pool(monkeypatch, mock_pool)
        count = await memory.load_recent_summaries("user-1", days=7)
        assert count == 2
        assert len(memory._cache["user-1"]) == 2

    @pytest.mark.asyncio
    async def test_db_failure_returns_zero(self, monkeypatch):
        memory = LongTermMemory()
        async def boom_pool():
            raise RuntimeError("DB down")
        monkeypatch.setattr(
            "app.services.long_term_memory._get_pool", boom_pool
        )
        count = await memory.load_recent_summaries("user-1", days=7)
        assert count == 0

    @pytest.mark.asyncio
    async def test_empty_user_id_returns_zero(self, monkeypatch):
        """空 user_id → 直接返回 0,不查 DB。"""
        memory = LongTermMemory()
        mock_pool, mock_conn = make_mock_pool()
        install_mock_pool(monkeypatch, mock_pool)
        count = await memory.load_recent_summaries("", days=7)
        assert count == 0
        assert mock_conn.fetch.await_count == 0

    @pytest.mark.asyncio
    async def test_empty_result_returns_zero(self, monkeypatch):
        """DB 返回空列表 → 加载 0 条。"""
        memory = LongTermMemory()
        mock_pool, _ = make_mock_pool(fetch_rows=[])
        install_mock_pool(monkeypatch, mock_pool)
        count = await memory.load_recent_summaries("user-1", days=7)
        assert count == 0
        # cache 仍被赋值为空列表
        assert memory._cache["user-1"] == []


# =============================================================================
# 工具方法测试
# =============================================================================


class TestExtractDateStr:
    """_extract_date_str:从 end_time 提取 YYYY-MM-DD。"""

    def test_iso_string(self):
        result = LongTermMemory._extract_date_str("2025-07-25T11:00:00+00:00")
        assert result == "2025-07-25"

    def test_iso_string_with_z(self):
        result = LongTermMemory._extract_date_str("2025-07-25T11:00:00Z")
        assert result == "2025-07-25"

    def test_datetime_object(self):
        dt = datetime(2025, 7, 25, 11, 0, tzinfo=timezone.utc)
        result = LongTermMemory._extract_date_str(dt)
        assert result == "2025-07-25"

    def test_none_returns_unknown(self):
        result = LongTermMemory._extract_date_str(None)
        assert result == "未知日期"

    def test_empty_returns_unknown(self):
        result = LongTermMemory._extract_date_str("")
        assert result == "未知日期"

    def test_invalid_string_returns_unknown(self):
        result = LongTermMemory._extract_date_str("not a date")
        assert result == "未知日期"


class TestParseRowsAffected:
    """_parse_rows_affected:解析 asyncpg execute 状态字符串。"""

    def test_update_status(self):
        assert LongTermMemory._parse_rows_affected("UPDATE 3") == 3

    def test_insert_status(self):
        assert LongTermMemory._parse_rows_affected("INSERT 0 1") == 1

    def test_zero_affected(self):
        assert LongTermMemory._parse_rows_affected("UPDATE 0") == 0

    def test_empty_string(self):
        assert LongTermMemory._parse_rows_affected("") == 0

    def test_non_numeric(self):
        assert LongTermMemory._parse_rows_affected("not a status") == 0

    def test_none(self):
        assert LongTermMemory._parse_rows_affected(None) == 0


class TestExtractStartTime:
    """SessionSummarizer._extract_start_time:从 messages 提取开始时间。"""

    def test_extract_from_timestamp_field(self):
        msgs = [{"role": "user", "content": "x", "timestamp": "2025-07-25T10:00:00Z"}]
        result = SessionSummarizer._extract_start_time(msgs)
        assert isinstance(result, datetime)
        assert result.year == 2025
        assert result.month == 7
        assert result.day == 25

    def test_extract_from_created_at_field(self):
        msgs = [
            {"role": "user", "content": "x", "created_at": "2025-07-25T10:00:00+00:00"}
        ]
        result = SessionSummarizer._extract_start_time(msgs)
        assert isinstance(result, datetime)
        assert result.day == 25

    def test_no_timestamp_returns_now(self):
        msgs = [{"role": "user", "content": "x"}]
        result = SessionSummarizer._extract_start_time(msgs)
        assert isinstance(result, datetime)

    def test_invalid_timestamp_skipped(self):
        msgs = [
            {"role": "user", "content": "x", "timestamp": "not a date"},
            {"role": "user", "content": "y", "timestamp": "2025-07-25T10:00:00Z"},
        ]
        result = SessionSummarizer._extract_start_time(msgs)
        assert isinstance(result, datetime)
        assert result.day == 25


class TestEstimateTokens:
    """SessionSummarizer._estimate_tokens:粗略估算 token 数。"""

    def test_empty_messages(self):
        assert SessionSummarizer._estimate_tokens([]) == 1

    def test_normal_messages(self):
        msgs = [{"role": "user", "content": "abcdefghij"}]  # 10 chars
        # 10 // 3 = 3, max(1, 3) = 3
        assert SessionSummarizer._estimate_tokens(msgs) == 3

    def test_non_dict_message_skipped(self):
        msgs = [None, "string", {"role": "user", "content": "abc"}]
        # 3 // 3 = 1
        assert SessionSummarizer._estimate_tokens(msgs) == 1


# =============================================================================
# 单例测试
# =============================================================================


class TestSingletons:
    """验证单例已导出。"""

    def test_session_summarizer_singleton(self):
        from app.services.session_summarizer import session_summarizer as s1
        from app.services.session_summarizer import session_summarizer as s2
        assert s1 is s2
        assert isinstance(s1, SessionSummarizer)

    def test_long_term_memory_singleton(self):
        from app.services.long_term_memory import long_term_memory as m1
        from app.services.long_term_memory import long_term_memory as m2
        assert m1 is m2
        assert isinstance(m1, LongTermMemory)

    def test_long_term_memory_has_cache(self):
        """LongTermMemory 实例有 _cache 字典。"""
        memory = LongTermMemory()
        assert hasattr(memory, "_cache")
        assert isinstance(memory._cache, dict)

    def test_session_summarizer_has_cache(self):
        """SessionSummarizer 实例有 _cache 字典。"""
        summarizer = SessionSummarizer()
        assert hasattr(summarizer, "_cache")
        assert isinstance(summarizer._cache, dict)
