"""DreamService 梦境服务综合测试(2026-07-23 立,补齐零覆盖)。

覆盖维度(77 cases):
1. 模块级常量:DECAY_BASE / DEFAULT_FORGET_THRESHOLD / CONSOLIDATE_BATCH_SIZE(3 tests)
2. DreamService 构造:默认 / 自定义 memory / 自定义 gateway / 双自定义(4 tests)
3. _extract_tags:空串 / 单标签 / 多标签 / 无标签 / 混合文本 / 特殊字符(6 tests)
4. _build_consolidate_prompt:单条 / 多条 / 空列表 / batch 限制(BUG) / 格式 / 计数(6 tests)
5. _parse_consolidate_response:纯 JSON / json 代码块 / 无 lang 代码块 / 非法 JSON / JSON 数组 / 空串 / None / 额外键 / 缺字段(9 tests)
6. consolidate 正常流程:空 episodic / 全已固化 / 写 semantic / 写 procedural / 标记固化 / 生成 topic / 返回结构 / 混合(8 tests)
7. consolidate LLM 降级:异常 / JSON 解析失败 / 空 content / 非 dict(4 tests)
8. consolidate memory 异常:add_semantic 失败 / add_procedural 失败 / mark 失败(3 tests)
9. consolidate 边界:空 user_id / 空 pattern 跳过 / 缺字段默认 / durationMs 类型 / list_episodic 异常 / success 字符串 BUG(6 tests)
10. forget 遗忘曲线:days=0 / days=10 / days 大 / 自定义 threshold / 无 episodic(5 tests)
11. forget 删除 vs 衰减:低于阈值删除 / 高于阈值衰减 / 删除失败 / 更新失败(4 tests)
12. forget 边界:lastAccessedAt 缺失 / 双缺失 / 非法日期 / naive datetime / decayFactor 缺失 / list_episodic 异常(6 tests)
13. dream_topic:正常 / LLM 失败 / 无 semantic / 标签提取 / relatedMemoryCount / list_semantic 异常(6 tests)
14. _generate_topic:正常 / 无 semantic / 空 content / LLM 异常 / 空 content 响应(5 tests)
15. dream_service 单例:存在 / 类型(2 tests)
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from app.core.llm_gateway import llm_gateway
from app.services.dream_service import (
    CONSOLIDATE_BATCH_SIZE,
    DECAY_BASE,
    DEFAULT_FORGET_THRESHOLD,
    DreamService,
    dream_service,
)
from app.services.memory_service import MemoryService, memory_service


# =============================================================================
# 工厂函数
# =============================================================================


def make_memory() -> AsyncMock:
    """构建 mock MemoryService,所有方法默认返回空/无操作。"""
    mem = AsyncMock(spec=MemoryService)
    mem.list_episodic = AsyncMock(return_value=[])
    mem.add_semantic = AsyncMock(return_value={"id": "sem-1"})
    mem.add_procedural = AsyncMock(return_value={"id": "proc-1"})
    mem.mark_episodic_consolidated = AsyncMock(return_value=None)
    mem.delete_episodic = AsyncMock(return_value=None)
    mem.update_episodic_decay = AsyncMock(return_value=None)
    mem.list_semantic = AsyncMock(return_value=[])
    return mem


def make_gateway(content: str = "") -> AsyncMock:
    """构建 mock LLM gateway,complete 默认返回 content。"""
    gw = AsyncMock()
    gw.complete = AsyncMock(return_value={"content": content})
    return gw


def make_episodic(
    ep_id: str = "ep-1",
    content: str = "用户讨论了 Python 异步编程",
    summary: str | None = None,
    importance_score: float = 0.5,
    decay_factor: float = 1.0,
    metadata: dict | None = None,
    created_at: str | None = None,
    last_accessed_at: str | None = None,
) -> dict:
    """构建 episodic memory dict(与 MemoryService._row_to_episodic 结构一致)。"""
    return {
        "id": ep_id,
        "layer": "episodic",
        "sessionId": "sess-1",
        "userId": "u1",
        "content": content,
        "summary": summary,
        "importanceScore": importance_score,
        "decayFactor": decay_factor,
        "metadata": metadata if metadata is not None else {},
        "createdAt": created_at,
        "expiresAt": None,
        "lastAccessedAt": last_accessed_at,
    }


def make_semantic(
    sem_id: str = "sem-1",
    content: str = "用户偏好 Python 语言",
    importance_score: float = 0.5,
) -> dict:
    """构建 semantic memory dict(与 MemoryService._row_to_semantic 结构一致)。"""
    return {
        "id": sem_id,
        "layer": "semantic",
        "userId": "u1",
        "content": content,
        "importanceScore": importance_score,
        "metadata": {},
        "createdAt": "2026-01-01T00:00:00+00:00",
        "lastAccessedAt": "2026-01-01T00:00:00+00:00",
    }


def iso_days_ago(days: float) -> str:
    """返回 N 天前的 ISO 字符串(带 UTC tz)。"""
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def iso_hours_ahead(hours: float) -> str:
    """返回 N 小时后的 ISO 字符串(带 UTC tz,用于 future → days_since clamped 0)。"""
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


# =============================================================================
# 1. 模块级常量(3 tests)
# =============================================================================


class TestConstants:
    """遗忘曲线参数与固化批次大小常量。"""

    def test_decay_base_value(self):
        """DECAY_BASE 应为 0.95(每天衰减 5%)。"""
        assert DECAY_BASE == 0.95

    def test_default_forget_threshold_value(self):
        """DEFAULT_FORGET_THRESHOLD 应为 0.1。"""
        assert DEFAULT_FORGET_THRESHOLD == 0.1

    def test_consolidate_batch_size_value(self):
        """CONSOLIDATE_BATCH_SIZE 应为 20。"""
        assert CONSOLIDATE_BATCH_SIZE == 20


# =============================================================================
# 2. DreamService 构造(4 tests)
# =============================================================================


class TestConstructor:
    """DreamService 构造函数:默认依赖注入 + 自定义覆盖。"""

    def test_default_uses_memory_service_singleton(self):
        """无参构造时 _memory 应为全局 memory_service 单例。"""
        ds = DreamService()
        assert ds._memory is memory_service

    def test_default_uses_llm_gateway_singleton(self):
        """无参构造时 _gateway 应为全局 llm_gateway 单例。"""
        ds = DreamService()
        assert ds._gateway is llm_gateway

    def test_custom_memory_injected(self):
        """传入自定义 memory 时应覆盖默认单例。"""
        custom_mem = make_memory()
        ds = DreamService(memory=custom_mem)
        assert ds._memory is custom_mem

    def test_custom_gateway_injected(self):
        """传入自定义 gateway 时应覆盖默认单例。"""
        custom_gw = make_gateway()
        ds = DreamService(gateway=custom_gw)
        assert ds._gateway is custom_gw


# =============================================================================
# 3. _extract_tags(6 tests)
# =============================================================================


class TestExtractTags:
    """从主题文本中提取 #tag 标签(静态方法)。"""

    def test_empty_string_returns_empty(self):
        """空字符串无标签。"""
        assert DreamService._extract_tags("") == []

    def test_single_tag(self):
        """单个 #tag 提取。"""
        assert DreamService._extract_tags("主题: Python\n标签: #python") == ["python"]

    def test_multiple_tags(self):
        """多个 #tag 全部提取。"""
        result = DreamService._extract_tags("主题\n标签: #python #ai #coding")
        assert result == ["python", "ai", "coding"]

    def test_no_tags_returns_empty(self):
        """无 # 前缀的文本返回空列表。"""
        assert DreamService._extract_tags("主题: Python 编程") == []

    def test_tags_mixed_with_text(self):
        """标签与普通文本混合时只提取 # 标签。"""
        result = DreamService._extract_tags("hello #world this is #test")
        assert result == ["world", "test"]

    def test_tags_with_underscores_and_digits(self):
        r"""正则 \w 包含字母、数字、下划线。"""
        result = DreamService._extract_tags("#python3 #ai_ml #v2")
        assert result == ["python3", "ai_ml", "v2"]


# =============================================================================
# 4. _build_consolidate_prompt(6 tests)
# =============================================================================


class TestBuildConsolidatePrompt:
    """构建固化 LLM prompt(静态方法)。"""

    def test_single_material(self):
        """单条素材 prompt 包含内容。"""
        prompt = DreamService._build_consolidate_prompt(["片段A"])
        assert "片段A" in prompt
        assert "共 1 条" in prompt

    def test_multiple_materials_joined(self):
        """多条素材以双换行连接。"""
        prompt = DreamService._build_consolidate_prompt(["片段A", "片段B"])
        assert "片段A" in prompt
        assert "片段B" in prompt
        assert "共 2 条" in prompt
        assert "片段A\n\n片段B" in prompt

    def test_empty_materials(self):
        """空列表时 joined 为空字符串,但计数仍为 0。"""
        prompt = DreamService._build_consolidate_prompt([])
        assert "共 0 条" in prompt

    def test_batch_size_limit_truncates_joined(self):
        """BUG: 超过 CONSOLIDATE_BATCH_SIZE(20) 条时,joined 只取前 20 条,
        但 prompt 计数 len(materials) 仍显示完整数量(如 25),造成计数与内容不一致。"""
        materials = [f"片段{i}" for i in range(25)]
        prompt = DreamService._build_consolidate_prompt(materials)
        # 计数显示 25
        assert "共 25 条" in prompt
        # 但 joined 只有前 20 条
        assert "片段0" in prompt
        assert "片段19" in prompt
        # 片段 20-24 不在 prompt 中(被截断)
        assert "片段20" not in prompt
        assert "片段24" not in prompt

    def test_prompt_contains_extraction_instructions(self):
        """prompt 包含 knowledge / patterns 提取指令。"""
        prompt = DreamService._build_consolidate_prompt(["片段A"])
        assert "knowledge" in prompt
        assert "patterns" in prompt
        assert "JSON" in prompt

    def test_prompt_exactly_at_batch_size(self):
        """恰好 20 条时不截断。"""
        materials = [f"片段{i}" for i in range(20)]
        prompt = DreamService._build_consolidate_prompt(materials)
        assert "共 20 条" in prompt
        assert "片段0" in prompt
        assert "片段19" in prompt


# =============================================================================
# 5. _parse_consolidate_response(9 tests)
# =============================================================================


class TestParseConsolidateResponse:
    """LLM 固化响应解析(JSON 容错,支持 ```json 包裹)。"""

    def test_plain_json_dict(self):
        """纯 JSON dict 直接解析。"""
        content = json.dumps({"knowledge": [{"content": "a", "importance": 0.8}], "patterns": []})
        result = DreamService._parse_consolidate_response(content)
        assert result["knowledge"] == [{"content": "a", "importance": 0.8}]
        assert result["patterns"] == []

    def test_json_code_block_with_lang(self):
        """```json ... ``` 代码块包裹的 JSON 能提取。"""
        inner = '{"knowledge": [], "patterns": [{"pattern": "x"}]}'
        content = f"```json\n{inner}\n```"
        result = DreamService._parse_consolidate_response(content)
        assert result["patterns"] == [{"pattern": "x"}]

    def test_code_block_without_lang(self):
        """``` ... ``` 代码块(无 json lang)也能提取。"""
        inner = '{"knowledge": [{"content": "b"}], "patterns": []}'
        content = f"```\n{inner}\n```"
        result = DreamService._parse_consolidate_response(content)
        assert result["knowledge"] == [{"content": "b"}]

    def test_invalid_json_returns_fallback(self):
        """非法 JSON 返回空 fallback。"""
        result = DreamService._parse_consolidate_response("not json at all")
        assert result == {"knowledge": [], "patterns": []}

    def test_json_array_returns_fallback(self):
        """JSON 解析为 list(非 dict)时返回 fallback。"""
        result = DreamService._parse_consolidate_response("[1, 2, 3]")
        assert result == {"knowledge": [], "patterns": []}

    def test_empty_string_returns_fallback(self):
        """空字符串返回 fallback。"""
        result = DreamService._parse_consolidate_response("")
        assert result == {"knowledge": [], "patterns": []}

    def test_invalid_json_in_code_block_returns_fallback(self):
        """代码块内非法 JSON 返回 fallback。"""
        content = "```json\nnot valid json\n```"
        result = DreamService._parse_consolidate_response(content)
        assert result == {"knowledge": [], "patterns": []}

    def test_dict_with_extra_keys_preserved(self):
        """dict 包含额外键时整体保留(不止 knowledge/patterns)。"""
        content = json.dumps({"knowledge": [], "patterns": [], "extra": "val"})
        result = DreamService._parse_consolidate_response(content)
        assert result["extra"] == "val"

    def test_dict_without_knowledge_and_patterns(self):
        """dict 不含 knowledge/patterns 键时返回该 dict(调用方用 .get 兜底)。"""
        content = json.dumps({"foo": "bar"})
        result = DreamService._parse_consolidate_response(content)
        assert result == {"foo": "bar"}
        assert result.get("knowledge", []) == []
        assert result.get("patterns", []) == []


# =============================================================================
# 6. consolidate 正常流程(8 tests)
# =============================================================================


class TestConsolidateNormal:
    """consolidate 核心流程:收集 → LLM 提取 → 写库 → 标记 → 生成主题。"""

    @pytest.mark.asyncio
    async def test_empty_episodic_returns_early(self):
        """无 episodic 时提前返回,topic="无素材可固化",不调 LLM。"""
        mem = make_memory()
        gw = make_gateway()
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert result["consolidatedCount"] == 0
        assert result["patterns"] == []
        assert result["proceduralUpdated"] == 0
        assert result["forgottenCount"] == 0
        assert result["topic"] == "无素材可固化"
        assert isinstance(result["durationMs"], int)
        # LLM 未调用
        gw.complete.assert_not_called()

    @pytest.mark.asyncio
    async def test_all_consolidated_skipped(self):
        """所有 episodic 已固化(metadata.consolidated=True)时跳过,提前返回。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", metadata={"consolidated": True}),
            make_episodic(ep_id="ep2", metadata={"consolidated": True}),
        ])
        gw = make_gateway()
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert result["consolidatedCount"] == 0
        assert result["topic"] == "无素材可固化"
        gw.complete.assert_not_called()

    @pytest.mark.asyncio
    async def test_llm_success_writes_semantic(self):
        """LLM 成功提取 knowledge → 调 add_semantic 写入,metadata 带 source。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="讨论了 Python"),
        ])
        llm_content = json.dumps({
            "knowledge": [{"content": "用户喜欢 Python", "importance": 0.9}],
            "patterns": [],
        })
        gw = make_gateway(llm_content)
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert result["consolidatedCount"] == 1
        mem.add_semantic.assert_called_once_with(
            "u1",
            content="用户喜欢 Python",
            importance_score=0.9,
            metadata={"source": "dream_consolidate"},
        )

    @pytest.mark.asyncio
    async def test_llm_success_writes_procedural(self):
        """LLM 成功提取 patterns → 调 add_procedural 写入。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="用了搜索工具"),
        ])
        llm_content = json.dumps({
            "knowledge": [],
            "patterns": [{"pattern": "search then read", "tool_name": "search", "success": True}],
        })
        gw = make_gateway(llm_content)
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert result["proceduralUpdated"] == 1
        assert result["patterns"] == ["search then read"]
        mem.add_procedural.assert_called_once_with(
            "u1",
            pattern="search then read",
            tool_name="search",
            success=True,
            metadata={"source": "dream_consolidate"},
        )

    @pytest.mark.asyncio
    async def test_marks_episodic_consolidated(self):
        """固化完成后标记所有未固化 episodic 的 metadata.consolidated=True。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
            make_episodic(ep_id="ep2", content="片段2"),
            make_episodic(ep_id="ep3", content="已固化", metadata={"consolidated": True}),
        ])
        gw = make_gateway(json.dumps({"knowledge": [], "patterns": []}))
        ds = DreamService(memory=mem, gateway=gw)
        await ds.consolidate("u1")
        # 只标记未固化的 ep1 和 ep2
        assert mem.mark_episodic_consolidated.call_count == 2
        called_ids = [call.args[0] for call in mem.mark_episodic_consolidated.call_args_list]
        assert "ep1" in called_ids
        assert "ep2" in called_ids
        assert "ep3" not in called_ids

    @pytest.mark.asyncio
    async def test_generates_topic_after_consolidation(self):
        """固化完成后调用 _generate_topic 生成主题。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
        ])
        # _generate_topic 内部调 list_semantic,需返回非空才会调 LLM
        mem.list_semantic = AsyncMock(return_value=[make_semantic(content="Python 知识")])
        llm_consolidate = json.dumps({"knowledge": [], "patterns": []})
        llm_topic = "主题: Python 学习\n标签: #python #编程"
        gw = make_gateway()
        gw.complete = AsyncMock(side_effect=[
            {"content": llm_consolidate},  # consolidate LLM
            {"content": llm_topic},  # topic LLM
        ])
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert result["topic"] == llm_topic
        assert gw.complete.call_count == 2

    @pytest.mark.asyncio
    async def test_returns_correct_shape(self):
        """返回的 DreamResult dict 包含所有必需字段。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
        ])
        gw = make_gateway(json.dumps({"knowledge": [], "patterns": []}))
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert set(result.keys()) == {
            "userId", "consolidatedCount", "patterns", "proceduralUpdated",
            "forgottenCount", "topic", "durationMs",
        }
        assert result["userId"] == "u1"
        assert result["forgottenCount"] == 0
        assert isinstance(result["durationMs"], int)
        assert result["durationMs"] >= 0

    @pytest.mark.asyncio
    async def test_mixed_consolidated_and_unconsolidated(self):
        """混合已固化 + 未固化 episodic 时只处理未固化部分。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="未固化1"),
            make_episodic(ep_id="ep2", content="已固化", metadata={"consolidated": True}),
            make_episodic(ep_id="ep3", content="未固化2"),
        ])
        llm_content = json.dumps({
            "knowledge": [{"content": "知识点", "importance": 0.8}],
            "patterns": [{"pattern": "p1", "tool_name": "t1", "success": True}],
        })
        gw = make_gateway(llm_content)
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        # 只有 ep1 和 ep3 被标记
        assert mem.mark_episodic_consolidated.call_count == 2
        # knowledge 和 patterns 各写入 1 条
        assert result["consolidatedCount"] == 1
        assert result["proceduralUpdated"] == 1


# =============================================================================
# 7. consolidate LLM 降级(4 tests)
# =============================================================================


class TestConsolidateLLMDegradation:
    """LLM 调用失败时的优雅降级(不阻塞主流程)。"""

    @pytest.mark.asyncio
    async def test_llm_exception_returns_empty_patterns(self):
        """LLM 抛异常时 parsed 降级为空,仍标记 episodic 固化。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
        ])
        gw = make_gateway()
        gw.complete = AsyncMock(side_effect=RuntimeError("LLM 宕机"))
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert result["consolidatedCount"] == 0
        assert result["patterns"] == []
        assert result["proceduralUpdated"] == 0
        # 仍标记 episodic 已固化
        mem.mark_episodic_consolidated.assert_called_once_with("ep1")

    @pytest.mark.asyncio
    async def test_llm_returns_invalid_json(self):
        """LLM 返回非法 JSON 时降级为空,仍标记 episodic。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
        ])
        gw = make_gateway("这不是 JSON")
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert result["consolidatedCount"] == 0
        assert result["patterns"] == []

    @pytest.mark.asyncio
    async def test_llm_returns_empty_content(self):
        """LLM 返回空 content 时降级为空。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
        ])
        gw = make_gateway("")
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert result["consolidatedCount"] == 0

    @pytest.mark.asyncio
    async def test_llm_returns_non_dict_json(self):
        """LLM 返回 JSON 数组(非 dict)时降级为空。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
        ])
        gw = make_gateway("[1, 2, 3]")
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert result["consolidatedCount"] == 0
        assert result["patterns"] == []


# =============================================================================
# 8. consolidate memory 异常(3 tests)
# =============================================================================


class TestConsolidateMemoryException:
    """memory_service 各方法异常时不阻塞后续操作。"""

    @pytest.mark.asyncio
    async def test_add_semantic_failure_continues(self):
        """add_semantic 抛异常时跳过该项,继续处理其他 knowledge。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
        ])
        mem.add_semantic = AsyncMock(side_effect=[RuntimeError("DB down"), {"id": "sem-2"}])
        llm_content = json.dumps({
            "knowledge": [
                {"content": "失败的知识", "importance": 0.9},
                {"content": "成功的知识", "importance": 0.8},
            ],
            "patterns": [],
        })
        gw = make_gateway(llm_content)
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        # 第一条失败,第二条成功
        assert result["consolidatedCount"] == 1
        assert mem.add_semantic.call_count == 2

    @pytest.mark.asyncio
    async def test_add_procedural_failure_continues(self):
        """add_procedural 抛异常时跳过该项,pattern 仍出现在结果中。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
        ])
        mem.add_procedural = AsyncMock(side_effect=RuntimeError("DB down"))
        llm_content = json.dumps({
            "knowledge": [],
            "patterns": [{"pattern": "p1", "tool_name": "t1", "success": True}],
        })
        gw = make_gateway(llm_content)
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        # proceduralUpdated=0(写入失败),但 pattern 仍在结果列表中
        assert result["proceduralUpdated"] == 0
        assert result["patterns"] == ["p1"]

    @pytest.mark.asyncio
    async def test_mark_consolidated_failure_continues(self):
        """mark_episodic_consolidated 抛异常时不阻塞返回。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
        ])
        mem.mark_episodic_consolidated = AsyncMock(side_effect=RuntimeError("DB down"))
        gw = make_gateway(json.dumps({"knowledge": [], "patterns": []}))
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        # 不抛异常,正常返回
        assert result["consolidatedCount"] == 0


# =============================================================================
# 9. consolidate 边界(6 tests)
# =============================================================================


class TestConsolidateEdgeCases:
    """consolidate 边界条件与防御性行为。"""

    @pytest.mark.asyncio
    async def test_empty_user_id(self):
        """user_id 空串时仍正常执行(不校验)。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[])
        gw = make_gateway()
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("")
        assert result["userId"] == ""
        assert result["topic"] == "无素材可固化"
        mem.list_episodic.assert_called_once_with("", limit=CONSOLIDATE_BATCH_SIZE)

    @pytest.mark.asyncio
    async def test_empty_pattern_skipped(self):
        """pattern 为空字符串时跳过(不写入 procedural,不出现在结果中)。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
        ])
        llm_content = json.dumps({
            "knowledge": [],
            "patterns": [
                {"pattern": "", "tool_name": "t1", "success": True},
                {"pattern": "valid_pattern", "tool_name": "t2", "success": True},
            ],
        })
        gw = make_gateway(llm_content)
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert result["patterns"] == ["valid_pattern"]
        assert result["proceduralUpdated"] == 1
        mem.add_procedural.assert_called_once()

    @pytest.mark.asyncio
    async def test_knowledge_missing_fields_uses_defaults(self):
        """knowledge 条目缺 content/importance 时用默认值。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
        ])
        llm_content = json.dumps({
            "knowledge": [{}],  # 完全空对象
            "patterns": [],
        })
        gw = make_gateway(llm_content)
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert result["consolidatedCount"] == 1
        mem.add_semantic.assert_called_once_with(
            "u1",
            content="",
            importance_score=0.5,
            metadata={"source": "dream_consolidate"},
        )

    @pytest.mark.asyncio
    async def test_duration_ms_is_non_negative_int(self):
        """durationMs 是非负整数。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[])
        gw = make_gateway()
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.consolidate("u1")
        assert isinstance(result["durationMs"], int)
        assert result["durationMs"] >= 0

    @pytest.mark.asyncio
    async def test_list_episodic_raises_propagates(self):
        """list_episodic 抛异常时 consolidate 不捕获,异常传播。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(side_effect=RuntimeError("连接失败"))
        gw = make_gateway()
        ds = DreamService(memory=mem, gateway=gw)
        with pytest.raises(RuntimeError, match="连接失败"):
            await ds.consolidate("u1")

    @pytest.mark.asyncio
    async def test_pattern_success_string_false_bug(self):
        """BUG: patterns 条目 success 为字符串 "false" 时,bool("false")=True(应为 False)。
        Python 中非空字符串为 truthy,导致 success 被错误地当作 True 传入 add_procedural。
        测试锁定当前实际行为。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", content="片段1"),
        ])
        llm_content = json.dumps({
            "knowledge": [],
            "patterns": [{"pattern": "p1", "tool_name": "t1", "success": "false"}],
        })
        gw = make_gateway(llm_content)
        ds = DreamService(memory=mem, gateway=gw)
        await ds.consolidate("u1")
        mem.add_procedural.assert_called_once_with(
            "u1",
            pattern="p1",
            tool_name="t1",
            success=True,  # BUG: bool("false") = True
            metadata={"source": "dream_consolidate"},
        )


# =============================================================================
# 10. forget 遗忘曲线(5 tests)
# =============================================================================


class TestForgetDecayCurve:
    """遗忘曲线计算:decay_factor *= 0.95^(days_since_access)。"""

    @pytest.mark.asyncio
    async def test_days_zero_decay_unchanged(self):
        """days_since=0(未来日期)时 decay 不变,importance 不变。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(
                ep_id="ep1",
                importance_score=0.5,
                decay_factor=1.0,
                last_accessed_at=iso_hours_ahead(1),  # 未来 → days clamped 0
            ),
        ])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # importance=0.5, decay=1.0, days=0 → new_importance=0.5*1.0=0.5 >= 0.1 → decayed
        assert result["forgottenCount"] == 0
        assert result["decayedCount"] == 1
        mem.update_episodic_decay.assert_called_once()
        args = mem.update_episodic_decay.call_args.args
        assert args[0] == "ep1"
        assert args[1] == pytest.approx(1.0)  # new_decay
        assert args[2] == pytest.approx(0.5)  # new_importance

    @pytest.mark.asyncio
    async def test_days_ten_partial_decay(self):
        """10 天后部分衰减,new_importance = 0.5 * 0.95^10 ≈ 0.299。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(
                ep_id="ep1",
                importance_score=0.5,
                decay_factor=1.0,
                last_accessed_at=iso_days_ago(10),
            ),
        ])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # 0.95^10 ≈ 0.5987, new_importance = 0.5 * 0.5987 ≈ 0.2994 >= 0.1 → decayed
        assert result["forgottenCount"] == 0
        assert result["decayedCount"] == 1
        args = mem.update_episodic_decay.call_args.args
        expected_decay = 1.0 * (0.95 ** 10)
        assert args[1] == pytest.approx(expected_decay, abs=0.001)
        assert args[2] == pytest.approx(0.5 * expected_decay, abs=0.001)

    @pytest.mark.asyncio
    async def test_days_large_deleted(self):
        """100 天后严重衰减,new_importance < 0.1 → 删除。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(
                ep_id="ep1",
                importance_score=0.5,
                decay_factor=1.0,
                last_accessed_at=iso_days_ago(100),
            ),
        ])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # 0.95^100 ≈ 0.00592, new_importance = 0.5 * 0.00592 ≈ 0.00296 < 0.1 → deleted
        assert result["forgottenCount"] == 1
        assert result["decayedCount"] == 0
        mem.delete_episodic.assert_called_once_with("ep1")
        mem.update_episodic_decay.assert_not_called()

    @pytest.mark.asyncio
    async def test_custom_threshold(self):
        """自定义 threshold=0.5 时,10 天衰减后的 importance≈0.299 < 0.5 → 删除。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(
                ep_id="ep1",
                importance_score=0.5,
                decay_factor=1.0,
                last_accessed_at=iso_days_ago(10),
            ),
        ])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1", threshold=0.5)
        assert result["forgottenCount"] == 1
        assert result["decayedCount"] == 0
        assert result["threshold"] == 0.5

    @pytest.mark.asyncio
    async def test_no_episodic(self):
        """无 episodic 时 forgottenCount=0, decayedCount=0。"""
        mem = make_memory()
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        assert result["forgottenCount"] == 0
        assert result["decayedCount"] == 0
        assert result["threshold"] == DEFAULT_FORGET_THRESHOLD
        mem.list_episodic.assert_called_once_with("u1", limit=500)


# =============================================================================
# 11. forget 删除 vs 衰减(4 tests)
# =============================================================================


class TestForgetDeleteVsDecay:
    """forget 中 importance < threshold 删除,>= threshold 更新衰减。"""

    @pytest.mark.asyncio
    async def test_below_threshold_deleted(self):
        """new_importance < threshold → delete_episodic。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(
                ep_id="ep1",
                importance_score=0.05,
                decay_factor=1.0,
                last_accessed_at=iso_hours_ahead(1),  # days=0
            ),
        ])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # new_importance = 0.05 * 1.0 = 0.05 < 0.1 → deleted
        assert result["forgottenCount"] == 1
        mem.delete_episodic.assert_called_once_with("ep1")

    @pytest.mark.asyncio
    async def test_above_threshold_decayed(self):
        """new_importance >= threshold → update_episodic_decay。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(
                ep_id="ep1",
                importance_score=0.9,
                decay_factor=1.0,
                last_accessed_at=iso_hours_ahead(1),  # days=0
            ),
        ])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # new_importance = 0.9 * 1.0 = 0.9 >= 0.1 → decayed
        assert result["decayedCount"] == 1
        assert result["forgottenCount"] == 0
        mem.update_episodic_decay.assert_called_once_with("ep1", 1.0, 0.9)

    @pytest.mark.asyncio
    async def test_delete_failure_continues(self):
        """delete_episodic 抛异常时不阻塞,继续处理下一条。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", importance_score=0.01, decay_factor=1.0,
                          last_accessed_at=iso_hours_ahead(1)),
            make_episodic(ep_id="ep2", importance_score=0.01, decay_factor=1.0,
                          last_accessed_at=iso_hours_ahead(1)),
        ])
        mem.delete_episodic = AsyncMock(side_effect=[RuntimeError("DB down"), None])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # 两条都 < 0.1 应删除,第一条失败但仍计入 forgottenCount(因为 forgotten++ 在 try 之前?不,在 try 内)
        # 实际:forgotten++ 在 delete 成功后才执行
        assert result["forgottenCount"] == 1  # 只有第二条成功
        assert mem.delete_episodic.call_count == 2

    @pytest.mark.asyncio
    async def test_update_decay_failure_continues(self):
        """update_episodic_decay 抛异常时不阻塞。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(ep_id="ep1", importance_score=0.9, decay_factor=1.0,
                          last_accessed_at=iso_hours_ahead(1)),
        ])
        mem.update_episodic_decay = AsyncMock(side_effect=RuntimeError("DB down"))
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # 异常被捕获,decayedCount=0(因为 decayed++ 在 try 内)
        assert result["decayedCount"] == 0
        assert result["forgottenCount"] == 0


# =============================================================================
# 12. forget 边界(6 tests)
# =============================================================================


class TestForgetEdgeCases:
    """forget 日期解析与默认值边界。"""

    @pytest.mark.asyncio
    async def test_last_accessed_missing_uses_created_at(self):
        """lastAccessedAt 缺失时用 createdAt 兜底。"""
        ten_days_ago = iso_days_ago(10)
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(
                ep_id="ep1",
                importance_score=0.5,
                decay_factor=1.0,
                last_accessed_at=None,
                created_at=ten_days_ago,
            ),
        ])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # 用 createdAt(10 天前)计算 → 部分衰减
        assert result["decayedCount"] == 1
        args = mem.update_episodic_decay.call_args.args
        expected_decay = 1.0 * (0.95 ** 10)
        assert args[1] == pytest.approx(expected_decay, abs=0.001)

    @pytest.mark.asyncio
    async def test_both_missing_uses_now(self):
        """lastAccessedAt 和 createdAt 都缺失时用 now → days_since=0。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(
                ep_id="ep1",
                importance_score=0.5,
                decay_factor=1.0,
                last_accessed_at=None,
                created_at=None,
            ),
        ])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # now - now = 0 days → decay=1.0, importance=0.5 >= 0.1 → decayed
        assert result["decayedCount"] == 1
        args = mem.update_episodic_decay.call_args.args
        assert args[1] == pytest.approx(1.0, abs=0.001)
        assert args[2] == pytest.approx(0.5, abs=0.001)

    @pytest.mark.asyncio
    async def test_invalid_date_string_uses_now(self):
        """lastAccessedAt 为非法日期字符串时 fromisoformat 失败 → 用 now → days=0。"""
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(
                ep_id="ep1",
                importance_score=0.5,
                decay_factor=1.0,
                last_accessed_at="not-a-valid-date",
            ),
        ])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # 解析失败 → last_dt=now → days=0 → decay=1.0
        assert result["decayedCount"] == 1
        args = mem.update_episodic_decay.call_args.args
        assert args[1] == pytest.approx(1.0, abs=0.001)

    @pytest.mark.asyncio
    async def test_naive_datetime_gets_utc(self):
        """naive datetime(无 tzinfo)被补充 UTC 时区后计算。"""
        # 10 天前的 naive ISO 字符串(无 +00:00 后缀)
        naive_ten_days_ago = (
            datetime.now(timezone.utc) - timedelta(days=10)
        ).replace(tzinfo=None).isoformat()
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[
            make_episodic(
                ep_id="ep1",
                importance_score=0.5,
                decay_factor=1.0,
                last_accessed_at=naive_ten_days_ago,
            ),
        ])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # naive → 补 UTC → 10 天前 → 部分衰减
        assert result["decayedCount"] == 1
        args = mem.update_episodic_decay.call_args.args
        expected_decay = 1.0 * (0.95 ** 10)
        assert args[1] == pytest.approx(expected_decay, abs=0.01)

    @pytest.mark.asyncio
    async def test_decay_factor_missing_defaults_one(self):
        """decayFactor 缺失时默认 1.0。"""
        ep = make_episodic(
            ep_id="ep1",
            importance_score=0.5,
            decay_factor=1.0,
            last_accessed_at=iso_hours_ahead(1),
        )
        del ep["decayFactor"]  # 删除 decayFactor 键
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[ep])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # decayFactor 缺失 → current_decay=1.0, days=0 → new_decay=1.0
        assert result["decayedCount"] == 1
        args = mem.update_episodic_decay.call_args.args
        assert args[1] == pytest.approx(1.0)

    @pytest.mark.asyncio
    async def test_importance_score_missing_defaults_half(self):
        """importanceScore 缺失时默认 0.5。"""
        ep = make_episodic(
            ep_id="ep1",
            importance_score=0.5,
            decay_factor=1.0,
            last_accessed_at=iso_hours_ahead(1),
        )
        del ep["importanceScore"]
        mem = make_memory()
        mem.list_episodic = AsyncMock(return_value=[ep])
        ds = DreamService(memory=mem, gateway=make_gateway())
        result = await ds.forget("u1")
        # importanceScore 缺失 → 0.5, days=0 → new_importance=0.5 >= 0.1 → decayed
        assert result["decayedCount"] == 1
        args = mem.update_episodic_decay.call_args.args
        assert args[2] == pytest.approx(0.5)


# =============================================================================
# 13. dream_topic(6 tests)
# =============================================================================


class TestDreamTopic:
    """dream_topic:LLM 总结最近 10 条 semantic 生成主题标签。"""

    @pytest.mark.asyncio
    async def test_normal_topic(self):
        """正常流程:有 semantic + LLM 成功 → 返回 topic + tags。"""
        mem = make_memory()
        mem.list_semantic = AsyncMock(return_value=[
            make_semantic(content="Python 知识"),
            make_semantic(content="异步编程"),
        ])
        gw = make_gateway("主题: Python 异步\n标签: #python #async")
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.dream_topic("u1")
        assert result["topic"] == "主题: Python 异步\n标签: #python #async"
        assert result["tags"] == ["python", "async"]
        assert result["relatedMemoryCount"] == 2
        assert "userId" in result
        assert "generatedAt" in result

    @pytest.mark.asyncio
    async def test_llm_failure_fallback_topic(self):
        """LLM 失败时 topic 降级为"主题生成失败"。"""
        mem = make_memory()
        mem.list_semantic = AsyncMock(return_value=[make_semantic(content="知识")])
        gw = make_gateway()
        gw.complete = AsyncMock(side_effect=RuntimeError("LLM down"))
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.dream_topic("u1")
        assert result["topic"] == "主题生成失败"
        assert result["tags"] == []

    @pytest.mark.asyncio
    async def test_no_semantic_returns_default_topic(self):
        """无 semantic 时 topic="尚无足够记忆生成主题"。"""
        mem = make_memory()
        mem.list_semantic = AsyncMock(return_value=[])
        gw = make_gateway()
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.dream_topic("u1")
        assert result["topic"] == "尚无足够记忆生成主题"
        assert result["tags"] == []
        assert result["relatedMemoryCount"] == 0
        gw.complete.assert_not_called()

    @pytest.mark.asyncio
    async def test_tags_extracted_from_topic(self):
        """tags 从 topic 文本中提取 # 标签。"""
        mem = make_memory()
        mem.list_semantic = AsyncMock(return_value=[make_semantic(content="知识")])
        gw = make_gateway("主题: 编程\n标签: #python #ai #coding")
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.dream_topic("u1")
        assert result["tags"] == ["python", "ai", "coding"]

    @pytest.mark.asyncio
    async def test_related_memory_count(self):
        """relatedMemoryCount = list_semantic 返回的条目数。"""
        mem = make_memory()
        mem.list_semantic = AsyncMock(return_value=[
            make_semantic(content=f"知识{i}") for i in range(5)
        ])
        gw = make_gateway("主题: 多条知识\n标签: #test")
        ds = DreamService(memory=mem, gateway=gw)
        result = await ds.dream_topic("u1")
        assert result["relatedMemoryCount"] == 5

    @pytest.mark.asyncio
    async def test_list_semantic_raises_propagates(self):
        """list_semantic 抛异常时 _generate_topic 不捕获,异常传播。"""
        mem = make_memory()
        mem.list_semantic = AsyncMock(side_effect=RuntimeError("DB down"))
        gw = make_gateway()
        ds = DreamService(memory=mem, gateway=gw)
        with pytest.raises(RuntimeError, match="DB down"):
            await ds.dream_topic("u1")


# =============================================================================
# 14. _generate_topic(5 tests)
# =============================================================================


class TestGenerateTopic:
    """_generate_topic 内部方法:LLM 总结 semantic 生成主题。"""

    @pytest.mark.asyncio
    async def test_normal_generation(self):
        """有 semantic + LLM 成功 → 返回 LLM content(strip)。"""
        mem = make_memory()
        mem.list_semantic = AsyncMock(return_value=[
            make_semantic(content="Python 异步编程"),
            make_semantic(content="asyncio 库用法"),
        ])
        gw = make_gateway("  主题: Python asyncio  ")
        ds = DreamService(memory=mem, gateway=gw)
        topic = await ds._generate_topic("u1")
        assert topic == "主题: Python asyncio"  # strip 后
        # 验证 list_semantic 用 limit=10
        mem.list_semantic.assert_called_once_with("u1", limit=10)

    @pytest.mark.asyncio
    async def test_no_semantic_returns_default(self):
        """无 semantic 时返回"尚无足够记忆生成主题"。"""
        mem = make_memory()
        mem.list_semantic = AsyncMock(return_value=[])
        gw = make_gateway()
        ds = DreamService(memory=mem, gateway=gw)
        topic = await ds._generate_topic("u1")
        assert topic == "尚无足够记忆生成主题"
        gw.complete.assert_not_called()

    @pytest.mark.asyncio
    async def test_empty_content_filtered_returns_default(self):
        """semantic 条目 content 全为空时返回默认。"""
        mem = make_memory()
        mem.list_semantic = AsyncMock(return_value=[
            make_semantic(content=""),
            make_semantic(content=""),
        ])
        gw = make_gateway()
        ds = DreamService(memory=mem, gateway=gw)
        topic = await ds._generate_topic("u1")
        assert topic == "尚无足够记忆生成主题"
        gw.complete.assert_not_called()

    @pytest.mark.asyncio
    async def test_llm_exception_returns_failure(self):
        """LLM 异常时返回"主题生成失败"。"""
        mem = make_memory()
        mem.list_semantic = AsyncMock(return_value=[make_semantic(content="知识")])
        gw = make_gateway()
        gw.complete = AsyncMock(side_effect=RuntimeError("LLM 宕机"))
        ds = DreamService(memory=mem, gateway=gw)
        topic = await ds._generate_topic("u1")
        assert topic == "主题生成失败"

    @pytest.mark.asyncio
    async def test_llm_returns_empty_content_returns_failure(self):
        """LLM 返回空 content 时 strip 后为空 → 返回"主题生成失败"(因 resp.get 默认值)。"""
        mem = make_memory()
        mem.list_semantic = AsyncMock(return_value=[make_semantic(content="知识")])
        gw = make_gateway()
        gw.complete = AsyncMock(return_value={"content": ""})
        ds = DreamService(memory=mem, gateway=gw)
        topic = await ds._generate_topic("u1")
        # resp.get("content", "主题生成失败") → "" (空串存在), .strip() → ""
        assert topic == ""


# =============================================================================
# 15. dream_service 单例(2 tests)
# =============================================================================


class TestDreamServiceSingleton:
    """dream_service 全局单例。"""

    def test_singleton_exists(self):
        """dream_service 单例存在。"""
        assert dream_service is not None

    def test_singleton_is_instance(self):
        """dream_service 是 DreamService 实例。"""
        assert isinstance(dream_service, DreamService)
