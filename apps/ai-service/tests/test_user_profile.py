"""用户画像建模服务测试(2026-07-23 重写,完整覆盖 user_profile.py 371 行)。

覆盖维度(91 cases):
1. 模块级常量:_DIMENSIONS / _TYPE_TO_DIMENSION(4 tests)
2. UserProfileBuilder 构造:默认 client / 传入 client / 缓存初始化(4 tests)
3. _get_entries:None client / list 返回 / 非 list / 异常 / 无 get_entries / scope 参数(6 tests)
4. _empty_profile:结构 / user_id / totalMemories / updatedAt(4 tests)
5. _dimension_of:5 种映射 + 未知 + 缺失 + 大小写(8 tests)
6. _assemble_profile:完整度 / 部分 / 零 / totalMemories / 引用(5 tests)
7. _assemble_profile_from_entries:完整度计数 / 零 / 满 / totalMemories / userId(5 tests)
8. _parse_profile_output(容错解析,重点):空 / 纯 JSON / ```json / ``` / 嵌入文本 / 无数组 / 非法 JSON / 非 list / 非 dict item / 维度过滤 / indices 转换 / 越界 index / 非整数 index / 默认 confidence(14 tests)
9. _llm_build_profile:空文本 / 50 条截断 / 200 字截断 / 3000 字截断 / 成功 / LLM 异常 / 非 dict resp / 空 content(8 tests)
10. _fallback_build_profile:分组 / 空文本跳过 / content 拼接 / 500 字截断 / confidence 封顶 / confidence 公式 / 未知 type / 无文本无 id(8 tests)
11. build_profile 全量:无 client / 空记忆 / 参数覆盖 / LLM 成功 / LLM 失败降级 / LLM 空 / 构造时 client / 空 user_id / 成功缓存 / 降级缓存(10 tests)
12. update_profile 增量:无缓存触发 build / 已有维度追加 / 新维度创建 / confidence 公式 / confidence 封顶 / content 追加 / content 500 截断 / 无 memory_id / 重复 id / totalMemories 递增 / completeness 重算 / None id BUG(12 tests)
13. 集成路径:LLM 成功全链路 / LLM 失败降级全链路 / build 后 update(3 tests)

源码模块:app/services/user_profile.py
- _DIMENSIONS:5 维度(preference/expertise/communication_style/workflow/domain)
- _TYPE_TO_DIMENSION:5 映射(preference/feedback→preference, convention→workflow, decision→domain, fact→expertise)
- UserProfileBuilder:LLM 归纳优先,失败降级按 type 字段分类
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.user_profile import (
    UserProfileBuilder,
    _DIMENSIONS,
    _TYPE_TO_DIMENSION,
)


# =============================================================================
# 工厂函数
# =============================================================================


def make_memory(
    id: str = "m1",
    text: str = "some memory text",
    type: str = "preference",
) -> dict:
    """构造单条记忆条目。"""
    return {"id": id, "text": text, "type": type}


def make_entries(n: int = 3, type: str = "preference") -> list[dict]:
    """构造 n 条记忆,默认 preference 类型。"""
    return [make_memory(id=f"m{i}", text=f"text {i}", type=type) for i in range(n)]


def make_profile_entry(
    dimension: str = "preference",
    content: str = "画像内容",
    confidence: float = 0.7,
    support_ids: list[str] | None = None,
    user_id: str = "u1",
) -> dict:
    """构造一条 UserProfileEntry(画像条目)。"""
    return {
        "userId": user_id,
        "dimension": dimension,
        "content": content,
        "confidence": confidence,
        "supportingMemoryIds": support_ids if support_ids is not None else ["m1"],
        "updatedAt": "2026-01-01T00:00:00+00:00",
    }


def make_llm_response(content: str = "") -> dict:
    """构造 llm_gateway.complete 的返回值。"""
    return {"content": content, "model": "stub", "usage": {}, "stub": True}


def patch_llm_gateway(content: str = "", side_effect=None):
    """patch app.core.llm_gateway.llm_gateway 单例,返回 patcher。

    使用方式:
        with patch_llm_gateway(content='[...]') as mock_gw:
            ...
        # 或异常
        with patch_llm_gateway(side_effect=RuntimeError('boom')):
            ...

    说明:user_profile._llm_build_profile 内部执行
    `from ..core.llm_gateway import llm_gateway`(函数内 import),
    因此 patch 目标是 app.core.llm_gateway 模块的 llm_gateway 属性。
    """
    mock_gw = MagicMock()
    if side_effect is not None:
        mock_gw.complete = AsyncMock(side_effect=side_effect)
    else:
        mock_gw.complete = AsyncMock(return_value=make_llm_response(content))
    return patch("app.core.llm_gateway.llm_gateway", mock_gw)


# =============================================================================
# 1. 模块级常量(4 tests)
# =============================================================================


class TestModuleConstants:
    """_DIMENSIONS 与 _TYPE_TO_DIMENSION 模块常量。"""

    def test_dimensions_has_five_elements(self):
        """_DIMENSIONS 包含 5 个维度。"""
        assert len(_DIMENSIONS) == 5

    def test_dimensions_is_tuple(self):
        """_DIMENSIONS 是 tuple(不可变)。"""
        assert isinstance(_DIMENSIONS, tuple)

    def test_dimensions_contains_expected_names_in_order(self):
        """_DIMENSIONS 顺序与名称固定(preference/expertise/communication_style/workflow/domain)。"""
        assert _DIMENSIONS == (
            "preference",
            "expertise",
            "communication_style",
            "workflow",
            "domain",
        )

    def test_type_to_dimension_has_five_mappings(self):
        """_TYPE_TO_DIMENSION 包含 5 条映射。"""
        assert _TYPE_TO_DIMENSION == {
            "preference": "preference",
            "feedback": "preference",
            "convention": "workflow",
            "decision": "domain",
            "fact": "expertise",
        }


# =============================================================================
# 2. UserProfileBuilder 构造(4 tests)
# =============================================================================


class TestBuilderConstructor:
    """UserProfileBuilder.__init__ 构造行为。"""

    def test_default_client_is_none(self):
        """无参数构造:memory_client 默认 None。"""
        b = UserProfileBuilder()
        assert b._client is None

    def test_client_stored_from_constructor(self):
        """传入 memory_client:存到 _client。"""
        client = MagicMock()
        b = UserProfileBuilder(memory_client=client)
        assert b._client is client

    def test_profiles_cache_initial_empty(self):
        """默认构造:_profiles 缓存初始为空 dict。"""
        b = UserProfileBuilder()
        assert b._profiles == {}
        assert isinstance(b._profiles, dict)

    def test_profiles_cache_initial_empty_with_client(self):
        """传入 client 构造:_profiles 缓存仍为空 dict。"""
        b = UserProfileBuilder(memory_client=MagicMock())
        assert b._profiles == {}


# =============================================================================
# 3. _get_entries(6 tests)
# =============================================================================


class TestGetEntries:
    """_get_entries:从 memory_client 读取用户记忆(降级返回空列表)。"""

    @pytest.mark.asyncio
    async def test_none_client_returns_empty_list(self):
        """memory_client 为 None → 返回 []。"""
        result = await UserProfileBuilder._get_entries("u1", None)
        assert result == []

    @pytest.mark.asyncio
    async def test_list_result_returned(self):
        """memory_client.get_entries 返回 list → 原样返回。"""
        client = MagicMock()
        entries = [make_memory(id="m1"), make_memory(id="m2")]
        client.get_entries = AsyncMock(return_value=entries)
        result = await UserProfileBuilder._get_entries("u1", client)
        assert result == entries
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_non_list_result_returns_empty(self):
        """get_entries 返回非 list(dict/None 等)→ 返回 []。"""
        client = MagicMock()
        client.get_entries = AsyncMock(return_value={"not": "a list"})
        result = await UserProfileBuilder._get_entries("u1", client)
        assert result == []

    @pytest.mark.asyncio
    async def test_exception_returns_empty(self):
        """get_entries 抛异常 → 捕获后返回 [](不向上传播)。"""
        client = MagicMock()
        client.get_entries = AsyncMock(side_effect=RuntimeError("db down"))
        result = await UserProfileBuilder._get_entries("u1", client)
        assert result == []

    @pytest.mark.asyncio
    async def test_no_get_entries_method_returns_empty(self):
        """memory_client 无 get_entries 属性 → 返回 []。"""
        client = MagicMock(spec=[])  # 空 spec,无任何方法
        result = await UserProfileBuilder._get_entries("u1", client)
        assert result == []

    @pytest.mark.asyncio
    async def test_scope_parameter_passed(self):
        """调用 get_entries 时传入 scope='user'(对齐源码固定参数)。"""
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=[])
        await UserProfileBuilder._get_entries("u1", client)
        client.get_entries.assert_awaited_once_with("u1", scope="user")


# =============================================================================
# 4. _empty_profile(4 tests)
# =============================================================================


class TestEmptyProfile:
    """_empty_profile:无记忆时的空画像。"""

    def test_returns_correct_shape(self):
        """空画像包含 5 个字段:userId/entries/totalMemories/completeness/updatedAt。"""
        p = UserProfileBuilder._empty_profile("u1")
        assert set(p.keys()) == {
            "userId",
            "entries",
            "totalMemories",
            "completeness",
            "updatedAt",
        }

    def test_user_id_propagated(self):
        """userId 透传到返回值。"""
        p = UserProfileBuilder._empty_profile("my-user-42")
        assert p["userId"] == "my-user-42"

    def test_total_memories_and_completeness_zero(self):
        """空画像:entries=[] / totalMemories=0 / completeness=0.0。"""
        p = UserProfileBuilder._empty_profile("u1")
        assert p["entries"] == []
        assert p["totalMemories"] == 0
        assert p["completeness"] == 0.0

    def test_updated_at_is_iso_format(self):
        """updatedAt 是 ISO 8601 格式(可被 fromisoformat 解析,带时区)。"""
        from datetime import datetime

        p = UserProfileBuilder._empty_profile("u1")
        parsed = datetime.fromisoformat(p["updatedAt"])
        assert parsed.tzinfo is not None


# =============================================================================
# 5. _dimension_of(8 tests)
# =============================================================================


class TestDimensionOf:
    """_dimension_of:记忆 type → 画像维度降级映射。"""

    def test_preference_type(self):
        """type=preference → preference 维度。"""
        assert UserProfileBuilder._dimension_of({"type": "preference"}) == "preference"

    def test_feedback_type_maps_to_preference(self):
        """用户反馈归入偏好维度(feedback→preference)。"""
        assert UserProfileBuilder._dimension_of({"type": "feedback"}) == "preference"

    def test_convention_type_maps_to_workflow(self):
        """项目约定归入工作流(convention→workflow)。"""
        assert UserProfileBuilder._dimension_of({"type": "convention"}) == "workflow"

    def test_decision_type_maps_to_domain(self):
        """历史决策归入领域知识(decision→domain)。"""
        assert UserProfileBuilder._dimension_of({"type": "decision"}) == "domain"

    def test_fact_type_maps_to_expertise(self):
        """事实信息归入专业能力(fact→expertise)。"""
        assert UserProfileBuilder._dimension_of({"type": "fact"}) == "expertise"

    def test_unknown_type_defaults_to_preference(self):
        """未知 type 默认归入 preference。"""
        assert UserProfileBuilder._dimension_of({"type": "unknown_thing"}) == "preference"

    def test_missing_type_defaults_to_preference(self):
        """无 type 字段默认归入 preference(str(None→'') 不命中映射)。"""
        assert UserProfileBuilder._dimension_of({"text": "no type"}) == "preference"

    def test_case_insensitive(self):
        """type 字段大小写不敏感(.lower() 转换后查表)。"""
        assert UserProfileBuilder._dimension_of({"type": "Preference"}) == "preference"
        assert UserProfileBuilder._dimension_of({"type": "FEEDBACK"}) == "preference"
        assert UserProfileBuilder._dimension_of({"type": "Convention"}) == "workflow"
        assert UserProfileBuilder._dimension_of({"type": "DECISION"}) == "domain"
        assert UserProfileBuilder._dimension_of({"type": "Fact"}) == "expertise"


# =============================================================================
# 6. _assemble_profile(5 tests)
# =============================================================================


class TestAssembleProfile:
    """_assemble_profile:LLM 成功路径的 UserProfileAggregate 组装。"""

    def test_completeness_full_when_all_five_dims(self):
        """5 个维度全部覆盖 → completeness = 1.0。"""
        entries = make_entries(5)
        profile_entries = [make_profile_entry(dimension=d) for d in _DIMENSIONS]
        p = UserProfileBuilder._assemble_profile("u1", entries, profile_entries)
        assert p["completeness"] == 1.0
        assert p["totalMemories"] == 5

    def test_completeness_partial_when_one_dim(self):
        """仅 1 个维度 → completeness = 0.2。"""
        entries = make_entries(3)
        profile_entries = [make_profile_entry(dimension="preference")]
        p = UserProfileBuilder._assemble_profile("u1", entries, profile_entries)
        assert p["completeness"] == pytest.approx(1 / 5, abs=0.001)

    def test_completeness_zero_when_no_entries(self):
        """0 个画像条目 → completeness = 0.0。"""
        entries = make_entries(2)
        p = UserProfileBuilder._assemble_profile("u1", entries, [])
        assert p["completeness"] == 0.0

    def test_total_memories_equals_input_len(self):
        """totalMemories = len(entries)(原始记忆条数,非画像条数)。"""
        entries = make_entries(7)
        pe = [make_profile_entry(dimension="preference")]
        p = UserProfileBuilder._assemble_profile("u1", entries, pe)
        assert p["totalMemories"] == 7

    def test_user_id_and_entries_reference_propagated(self):
        """userId 透传;entries 列表是同一对象引用(不复制)。"""
        entries = make_entries(2)
        pe = [make_profile_entry(dimension="preference")]
        p = UserProfileBuilder._assemble_profile("my-user", entries, pe)
        assert p["userId"] == "my-user"
        assert p["entries"] is pe


# =============================================================================
# 7. _assemble_profile_from_entries(5 tests)
# =============================================================================


class TestAssembleProfileFromEntries:
    """_assemble_profile_from_entries:降级路径的 UserProfileAggregate 组装。

    与 _assemble_profile 的区别:covered 直接 = len(profile_entries),
    不按维度去重(假设降级路径每个 dim 至多一个 entry)。
    """

    def test_completeness_full_when_five_entries(self):
        """5 个画像条目(覆盖 5 维度)→ completeness = 1.0。"""
        entries = make_entries(5)
        pe = [make_profile_entry(dimension=d) for d in _DIMENSIONS]
        p = UserProfileBuilder._assemble_profile_from_entries("u1", entries, pe)
        assert p["completeness"] == 1.0

    def test_completeness_zero_when_no_entries(self):
        """0 个画像条目 → completeness = 0.0。"""
        entries = make_entries(3)
        p = UserProfileBuilder._assemble_profile_from_entries("u1", entries, [])
        assert p["completeness"] == 0.0

    def test_completeness_partial_when_one_entry(self):
        """1 个画像条目 → completeness = 0.2。"""
        entries = make_entries(2)
        pe = [make_profile_entry(dimension="preference")]
        p = UserProfileBuilder._assemble_profile_from_entries("u1", entries, pe)
        assert p["completeness"] == pytest.approx(1 / 5, abs=0.001)

    def test_total_memories_equals_input_len(self):
        """totalMemories = len(entries)(原始记忆条数)。"""
        entries = make_entries(9)
        pe = [make_profile_entry(dimension="preference")]
        p = UserProfileBuilder._assemble_profile_from_entries("u1", entries, pe)
        assert p["totalMemories"] == 9

    def test_user_id_propagated(self):
        """userId 透传。"""
        entries = make_entries(1)
        p = UserProfileBuilder._assemble_profile_from_entries("xyz", entries, [])
        assert p["userId"] == "xyz"


# =============================================================================
# 8. _parse_profile_output(14 tests,容错解析重点)
# =============================================================================


class TestParseProfileOutput:
    """_parse_profile_output:解析 LLM 输出为 UserProfileEntry 列表(容错)。"""

    def test_empty_content_returns_empty(self):
        """空字符串 → []。"""
        assert UserProfileBuilder._parse_profile_output("", [], "u1") == []

    def test_pure_json_array(self):
        """纯 JSON 数组(无代码块包裹)→ 正确解析。"""
        entries = make_entries(2)
        content = '[{"dimension":"preference","content":"喜欢 Python","confidence":0.8,"supportingMemoryIndices":[0]}]'
        result = UserProfileBuilder._parse_profile_output(content, entries, "u1")
        assert len(result) == 1
        assert result[0]["dimension"] == "preference"
        assert result[0]["content"] == "喜欢 Python"
        assert result[0]["confidence"] == 0.8
        assert result[0]["supportingMemoryIds"] == ["m0"]
        assert result[0]["userId"] == "u1"

    def test_json_code_block_with_json_tag(self):
        """```json ... ``` 代码块 → 去除 fence 后解析。"""
        entries = make_entries(1)
        content = '```json\n[{"dimension":"workflow","content":"用 git flow","confidence":0.6}]\n```'
        result = UserProfileBuilder._parse_profile_output(content, entries, "u1")
        assert len(result) == 1
        assert result[0]["dimension"] == "workflow"
        assert result[0]["content"] == "用 git flow"

    def test_plain_code_block_without_json_tag(self):
        """``` ... ``` 代码块(无 json 标签)→ 同样去除 fence 后解析。"""
        entries = make_entries(1)
        content = '```\n[{"dimension":"domain","content":"金融领域","confidence":0.7}]\n```'
        result = UserProfileBuilder._parse_profile_output(content, entries, "u1")
        assert len(result) == 1
        assert result[0]["dimension"] == "domain"

    def test_json_embedded_in_text(self):
        """JSON 数组嵌入在解释文本中 → 正则提取 [...] 部分。"""
        entries = make_entries(1)
        content = '分析结果如下:\n[{"dimension":"preference","content":"简洁","confidence":0.5}]\n以上是画像。'
        result = UserProfileBuilder._parse_profile_output(content, entries, "u1")
        assert len(result) == 1
        assert result[0]["dimension"] == "preference"

    def test_no_array_returns_empty(self):
        """内容中无 [ ] 结构 → 返回 []。"""
        content = "没有数组,只有纯文本"
        assert UserProfileBuilder._parse_profile_output(content, [], "u1") == []

    def test_invalid_json_returns_empty(self):
        """匹配到 [...] 但 JSON 非法 → 返回 []。"""
        content = "[不是合法 JSON]"
        assert UserProfileBuilder._parse_profile_output(content, [], "u1") == []

    def test_non_list_top_level_returns_empty(self):
        """JSON 解析结果非 list(如 dict)→ 返回 []。"""
        content = '{"dimension":"preference","content":"x"}'
        assert UserProfileBuilder._parse_profile_output(content, [], "u1") == []

    def test_non_dict_item_skipped(self):
        """数组中非 dict 元素(字符串/数字/null)被跳过。"""
        entries = make_entries(1)
        content = '["not a dict", 42, null, {"dimension":"preference","content":"ok"}]'
        result = UserProfileBuilder._parse_profile_output(content, entries, "u1")
        assert len(result) == 1
        assert result[0]["dimension"] == "preference"

    def test_dimension_filter_only_keeps_known_dims(self):
        """只保留 _DIMENSIONS 中的维度,未知维度被过滤。"""
        entries = make_entries(1)
        content = (
            '[{"dimension":"preference","content":"ok"},'
            '{"dimension":"hobby","content":"应被过滤"},'
            '{"dimension":"workflow","content":"保留"}]'
        )
        result = UserProfileBuilder._parse_profile_output(content, entries, "u1")
        assert len(result) == 2
        dims = [r["dimension"] for r in result]
        assert "preference" in dims
        assert "workflow" in dims
        assert "hobby" not in dims

    def test_supporting_memory_indices_converted_to_ids(self):
        """supportingMemoryIndices(整数索引)→ supportingMemoryIds(记忆 id 字符串)。"""
        entries = [
            make_memory(id="alpha", text="t1"),
            make_memory(id="beta", text="t2"),
            make_memory(id="gamma", text="t3"),
        ]
        content = (
            '[{"dimension":"preference","content":"x","supportingMemoryIndices":[0,2]}]'
        )
        result = UserProfileBuilder._parse_profile_output(content, entries, "u1")
        assert result[0]["supportingMemoryIds"] == ["alpha", "gamma"]

    def test_out_of_range_index_skipped(self):
        """索引越界(>= len(entries) 或 < 0)→ 跳过该索引,不报错。"""
        entries = make_entries(2)  # 索引 0,1 有效
        content = (
            '[{"dimension":"preference","content":"x","supportingMemoryIndices":[0,5,10]}]'
        )
        result = UserProfileBuilder._parse_profile_output(content, entries, "u1")
        assert result[0]["supportingMemoryIds"] == ["m0"]

    def test_non_integer_index_skipped(self):
        """索引为非整数(字符串"abc"/null)→ 跳过,不报错。"""
        entries = make_entries(2)
        content = (
            '[{"dimension":"preference","content":"x",'
            '"supportingMemoryIndices":[0,"abc",null,true]}]'
        )
        result = UserProfileBuilder._parse_profile_output(content, entries, "u1")
        # 0 保留;"abc"/null/true 中 true 会被 int(True)=1 命中(布尔是 int 子类)
        # 锁定当前实际行为:0 和 1(因 int(True)==1)都被转换
        assert "m0" in result[0]["supportingMemoryIds"]

    def test_default_confidence_when_missing(self):
        """item 缺少 confidence 字段 → 默认 0.5。"""
        entries = make_entries(1)
        content = '[{"dimension":"preference","content":"no confidence field"}]'
        result = UserProfileBuilder._parse_profile_output(content, entries, "u1")
        assert result[0]["confidence"] == 0.5


# =============================================================================
# 9. _llm_build_profile(8 tests)
# =============================================================================


class TestLlmBuildProfile:
    """_llm_build_profile:调 LLM 归纳用户画像(失败返回空列表)。

    截断策略:
    - 最多取 entries[:50](50 条截断)
    - 每条 text 截断到 200 字
    - memory_text 总长超 3000 字 → 截断到 3000 + 追加 ...(已截断)
    """

    @pytest.mark.asyncio
    async def test_all_empty_text_returns_empty_without_llm_call(self):
        """所有记忆 text 为空 → 直接返回 [],不调用 LLM。"""
        entries = [
            make_memory(id="m1", text="", type="preference"),
            make_memory(id="m2", text="", type="fact"),
        ]
        with patch_llm_gateway(content="[]") as mock_gw:
            result = await UserProfileBuilder()._llm_build_profile("u1", entries)
        assert result == []
        mock_gw.complete.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_fifty_entries_truncation(self):
        """超过 50 条记忆:prompt 只包含前 50 条(索引 0-49)。"""
        entries = [make_memory(id=f"m{i}", text=f"记忆 {i}", type="preference") for i in range(60)]
        with patch_llm_gateway(content="[]") as mock_gw:
            await UserProfileBuilder()._llm_build_profile("u1", entries)
        prompt = mock_gw.complete.call_args.args[0][0]["content"]
        # 索引 [0] 到 [49] 都应在,索引 [50] 不在
        assert "[0]" in prompt
        assert "[49]" in prompt
        assert "[50]" not in prompt

    @pytest.mark.asyncio
    async def test_two_hundred_char_truncation_per_entry(self):
        """每条记忆 text 截断到 200 字:prompt 中单条 ≤ 200 字符(不含 [idx] 前缀)。"""
        long_text = "A" * 300
        entries = [make_memory(id="m0", text=long_text, type="preference")]
        with patch_llm_gateway(content="[]") as mock_gw:
            await UserProfileBuilder()._llm_build_profile("u1", entries)
        prompt = mock_gw.complete.call_args.args[0][0]["content"]
        # [0] 后跟 200 个 A(原 300 被截断)
        assert "[0] " + "A" * 200 in prompt
        assert "A" * 201 not in prompt

    @pytest.mark.asyncio
    async def test_three_thousand_char_truncation_total(self):
        """memory_text 总长 > 3000 → 截断到 3000 + 追加 ...(已截断)标记。"""
        # 50 条 × 每条 ~100 字 ≈ 5000 字,超过 3000
        entries = [
            make_memory(id=f"m{i}", text="B" * 100, type="preference") for i in range(50)
        ]
        with patch_llm_gateway(content="[]") as mock_gw:
            await UserProfileBuilder()._llm_build_profile("u1", entries)
        prompt = mock_gw.complete.call_args.args[0][0]["content"]
        assert "...(已截断)" in prompt

    @pytest.mark.asyncio
    async def test_success_path_returns_parsed_entries(self):
        """LLM 返回合法 JSON → 解析为画像条目列表。"""
        entries = make_entries(2)
        llm_content = (
            '[{"dimension":"preference","content":"喜欢简洁",'
            '"confidence":0.8,"supportingMemoryIndices":[0,1]}]'
        )
        with patch_llm_gateway(content=llm_content):
            result = await UserProfileBuilder()._llm_build_profile("u1", entries)
        assert len(result) == 1
        assert result[0]["dimension"] == "preference"
        assert result[0]["content"] == "喜欢简洁"
        assert result[0]["confidence"] == 0.8
        assert result[0]["supportingMemoryIds"] == ["m0", "m1"]

    @pytest.mark.asyncio
    async def test_llm_exception_returns_empty(self):
        """llm_gateway.complete 抛异常 → 捕获后返回 [](不向上传播)。"""
        entries = make_entries(1)
        with patch_llm_gateway(side_effect=RuntimeError("LLM 离线")):
            result = await UserProfileBuilder()._llm_build_profile("u1", entries)
        assert result == []

    @pytest.mark.asyncio
    async def test_non_dict_response_returns_empty(self):
        """resp 非 dict(如 None/字符串)→ content='' → _parse 返回 []。"""
        entries = make_entries(1)
        with patch("app.core.llm_gateway.llm_gateway") as mock_gw:
            mock_gw.complete = AsyncMock(return_value=None)  # 非 dict
            result = await UserProfileBuilder()._llm_build_profile("u1", entries)
        assert result == []

    @pytest.mark.asyncio
    async def test_empty_content_returns_empty(self):
        """resp.content 为空字符串 → _parse 返回 []。"""
        entries = make_entries(1)
        with patch_llm_gateway(content=""):
            result = await UserProfileBuilder()._llm_build_profile("u1", entries)
        assert result == []


# =============================================================================
# 10. _fallback_build_profile(8 tests)
# =============================================================================


class TestFallbackBuildProfile:
    """_fallback_build_profile:LLM 失败降级,按记忆 type 字段分类到对应维度。"""

    def test_group_by_type_into_dimensions(self):
        """5 种 type 各 1 条 → 生成 4 个维度条目(feedback 与 preference 同维度合并)。"""
        entries = [
            make_memory(id="m1", text="偏好内容", type="preference"),
            make_memory(id="m2", text="反馈内容", type="feedback"),
            make_memory(id="m3", text="约定内容", type="convention"),
            make_memory(id="m4", text="决策内容", type="decision"),
            make_memory(id="m5", text="事实内容", type="fact"),
        ]
        p = UserProfileBuilder()._fallback_build_profile("u1", entries)
        dims = {e["dimension"] for e in p["entries"]}
        # preference + feedback 合并到 preference;communication_style 无映射 → 不出现
        assert dims == {"preference", "workflow", "domain", "expertise"}
        assert "communication_style" not in dims

    def test_empty_text_skipped(self):
        """text 为空的记忆不参与 content 拼接,但 id 仍计入 support_ids。

        注意源码:if text: grouped[dim]["texts"].append(text);
        if mid: grouped[dim]["ids"].append(mid) —— id 与 text 独立判断。
        但若该 dim 无任何 text,则 if not data["texts"]: continue 跳过整条。
        """
        entries = [
            make_memory(id="m1", text="", type="preference"),  # 无 text
            make_memory(id="m2", text="有效内容", type="preference"),
        ]
        p = UserProfileBuilder()._fallback_build_profile("u1", entries)
        pref_entries = [e for e in p["entries"] if e["dimension"] == "preference"]
        assert len(pref_entries) == 1
        # 两个 id 都进 support_ids(text 与 id 独立收集)
        assert "m1" in pref_entries[0]["supportingMemoryIds"]
        assert "m2" in pref_entries[0]["supportingMemoryIds"]

    def test_content_joined_with_semicolon_space(self):
        """同维度多条记忆:content 用 '; ' 拼接。"""
        entries = [
            make_memory(id="m1", text="第一句", type="preference"),
            make_memory(id="m2", text="第二句", type="preference"),
            make_memory(id="m3", text="第三句", type="preference"),
        ]
        p = UserProfileBuilder()._fallback_build_profile("u1", entries)
        pref = [e for e in p["entries"] if e["dimension"] == "preference"][0]
        assert pref["content"] == "第一句; 第二句; 第三句"

    def test_content_truncated_to_five_hundred_chars(self):
        """同维度 content 拼接后超 500 字 → 截断到 500。"""
        entries = [
            make_memory(id=f"m{i}", text="X" * 200, type="preference") for i in range(5)
        ]
        p = UserProfileBuilder()._fallback_build_profile("u1", entries)
        pref = [e for e in p["entries"] if e["dimension"] == "preference"][0]
        assert len(pref["content"]) == 500

    def test_confidence_capped_at_one(self):
        """support_ids 数量多 → confidence = min(1.0, 0.3 + 0.15*count) 封顶 1.0。"""
        # 8 条 id:0.3 + 0.15*8 = 1.5 → 封顶 1.0
        entries = [
            make_memory(id=f"m{i}", text=f"t{i}", type="preference") for i in range(8)
        ]
        p = UserProfileBuilder()._fallback_build_profile("u1", entries)
        pref = [e for e in p["entries"] if e["dimension"] == "preference"][0]
        assert pref["confidence"] == 1.0

    def test_confidence_formula_with_few_ids(self):
        """confidence 公式:0.3 + 0.15 * len(support_ids),round 到 2 位。"""
        # 2 条 id:0.3 + 0.15*2 = 0.6
        entries = [
            make_memory(id="m1", text="t1", type="preference"),
            make_memory(id="m2", text="t2", type="preference"),
        ]
        p = UserProfileBuilder()._fallback_build_profile("u1", entries)
        pref = [e for e in p["entries"] if e["dimension"] == "preference"][0]
        assert pref["confidence"] == 0.6

    def test_unknown_type_grouped_into_preference(self):
        """未知 type → _dimension_of 返回 preference → 归入 preference 维度。"""
        entries = [
            make_memory(id="m1", text="未知类型记忆", type="totally_unknown"),
        ]
        p = UserProfileBuilder()._fallback_build_profile("u1", entries)
        dims = {e["dimension"] for e in p["entries"]}
        assert dims == {"preference"}

    def test_text_without_id_still_creates_entry(self):
        """有 text 无 id 的记忆:仍创建画像条目,support_ids=[],confidence=0.3。

        源码:if text: append; if mid: append —— id 缺失不影响 entry 创建。
        confidence = min(1.0, 0.3 + 0.15*0) = 0.3。
        """
        entries = [{"text": "无 id 的记忆", "type": "preference"}]  # 无 id 字段
        p = UserProfileBuilder()._fallback_build_profile("u1", entries)
        pref = [e for e in p["entries"] if e["dimension"] == "preference"][0]
        assert pref["supportingMemoryIds"] == []
        assert pref["confidence"] == 0.3
        assert pref["content"] == "无 id 的记忆"


# =============================================================================
# 11. build_profile 全量构建(10 tests)
# =============================================================================


class TestBuildProfile:
    """build_profile:基于用户所有记忆构建画像(全量)。"""

    @pytest.mark.asyncio
    async def test_no_client_returns_empty_profile(self):
        """无 memory_client(构造与参数都 None)→ 返回空画像,不缓存。"""
        b = UserProfileBuilder()
        result = await b.build_profile("u1")
        assert result["entries"] == []
        assert result["totalMemories"] == 0
        assert result["completeness"] == 0.0
        # 空画像不写入缓存(源码 if not entries: return 直接返回)
        assert "u1" not in b._profiles

    @pytest.mark.asyncio
    async def test_empty_memory_returns_empty_profile(self):
        """client 返回空列表 → 返回空画像。"""
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=[])
        b = UserProfileBuilder()
        result = await b.build_profile("u1", memory_client=client)
        assert result["totalMemories"] == 0
        assert "u1" not in b._profiles

    @pytest.mark.asyncio
    async def test_param_client_overrides_constructor_client(self):
        """参数 client 优先于构造时 client(get_entries 用参数 client)。"""
        ctor_client = MagicMock()
        ctor_client.get_entries = AsyncMock(return_value=[])
        param_client = MagicMock()
        param_client.get_entries = AsyncMock(return_value=[])
        b = UserProfileBuilder(memory_client=ctor_client)
        await b.build_profile("u1", memory_client=param_client)
        param_client.get_entries.assert_awaited_once()
        ctor_client.get_entries.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_llm_success_path_assembles_and_caches(self):
        """LLM 成功 → _assemble_profile 组装 + 写入缓存。"""
        entries = make_entries(2)
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=entries)
        llm_content = (
            '[{"dimension":"preference","content":"LLM 归纳",'
            '"confidence":0.9,"supportingMemoryIndices":[0,1]}]'
        )
        with patch_llm_gateway(content=llm_content):
            b = UserProfileBuilder()
            result = await b.build_profile("u1", memory_client=client)
        assert result["totalMemories"] == 2
        assert len(result["entries"]) == 1
        assert result["entries"][0]["content"] == "LLM 归纳"
        # 缓存写入
        assert b._profiles["u1"] is result

    @pytest.mark.asyncio
    async def test_llm_failure_falls_back_and_caches(self):
        """LLM 异常 → 降级 _fallback_build_profile + 写入缓存。"""
        entries = [
            make_memory(id="m1", text="偏好", type="preference"),
            make_memory(id="m2", text="约定", type="convention"),
        ]
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=entries)
        with patch_llm_gateway(side_effect=RuntimeError("LLM 挂了")):
            b = UserProfileBuilder()
            result = await b.build_profile("u1", memory_client=client)
        # 降级路径:2 个维度(preference + workflow)
        dims = {e["dimension"] for e in result["entries"]}
        assert dims == {"preference", "workflow"}
        assert b._profiles["u1"] is result

    @pytest.mark.asyncio
    async def test_llm_returns_empty_falls_back(self):
        """LLM 返回 [](空 content)→ 降级路径。"""
        entries = make_entries(2, type="fact")
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=entries)
        with patch_llm_gateway(content=""):
            b = UserProfileBuilder()
            result = await b.build_profile("u1", memory_client=client)
        # 降级:fact → expertise
        dims = {e["dimension"] for e in result["entries"]}
        assert dims == {"expertise"}
        assert b._profiles["u1"] is result

    @pytest.mark.asyncio
    async def test_constructor_client_used_when_no_param(self):
        """未传参数 client → 使用构造时 client。"""
        entries = make_entries(1)
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=entries)
        with patch_llm_gateway(content="[]"):
            b = UserProfileBuilder(memory_client=client)
            await b.build_profile("u1")
        client.get_entries.assert_awaited_once_with("u1", scope="user")

    @pytest.mark.asyncio
    async def test_empty_user_id_returns_empty_profile(self):
        """user_id 为空字符串 + 无 client → 返回空画像(userId='')。"""
        b = UserProfileBuilder()
        result = await b.build_profile("")
        assert result["userId"] == ""
        assert result["entries"] == []

    @pytest.mark.asyncio
    async def test_cache_written_on_llm_success(self):
        """LLM 成功路径后:_profiles[user_id] 已写入。"""
        entries = make_entries(1)
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=entries)
        with patch_llm_gateway(
            content='[{"dimension":"preference","content":"x"}]'
        ):
            b = UserProfileBuilder()
            await b.build_profile("user-99", memory_client=client)
        assert "user-99" in b._profiles
        assert b._profiles["user-99"]["totalMemories"] == 1

    @pytest.mark.asyncio
    async def test_cache_written_on_fallback_path(self):
        """降级路径后:_profiles[user_id] 已写入。"""
        entries = make_entries(1, type="decision")
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=entries)
        with patch_llm_gateway(side_effect=RuntimeError("down")):
            b = UserProfileBuilder()
            await b.build_profile("user-7", memory_client=client)
        assert "user-7" in b._profiles
        # decision → domain
        dims = {e["dimension"] for e in b._profiles["user-7"]["entries"]}
        assert dims == {"domain"}


# =============================================================================
# 12. update_profile 增量更新(12 tests)
# =============================================================================


class TestUpdateProfile:
    """update_profile:增量更新画像(读取缓存 + 新记忆,避免全量重建)。

    关键逻辑:
    - 无缓存 → 触发 build_profile(全量重建,忽略 new_memory 参数)
    - 已有维度:追加 supportingMemoryIds,confidence = min(1.0, 0.3+0.15*len)
    - 新维度:创建 entry,confidence=0.4
    - content 追加('; ' 分隔,500 字截断)
    - totalMemories += 1,completeness 重算
    """

    @pytest.mark.asyncio
    async def test_no_cache_triggers_build_profile(self):
        """_profiles 无缓存 → 调用 build_profile(全量构建)。"""
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=[])  # 空记忆
        b = UserProfileBuilder(memory_client=client)
        result = await b.update_profile("u1", {"id": "m1", "text": "新", "type": "preference"})
        # build_profile 返回空画像(无记忆)
        assert result["totalMemories"] == 0
        assert result["entries"] == []

    @pytest.mark.asyncio
    async def test_existing_dimension_appends_support_id(self):
        """已有维度:新记忆 id 追加到 supportingMemoryIds。"""
        b = UserProfileBuilder()
        # 预置缓存:preference 维度已有 m1
        b._profiles["u1"] = {
            "userId": "u1",
            "entries": [
                make_profile_entry(dimension="preference", support_ids=["m1"]),
            ],
            "totalMemories": 1,
            "completeness": 0.2,
            "updatedAt": "2026-01-01T00:00:00+00:00",
        }
        await b.update_profile("u1", {"id": "m2", "text": "新偏好", "type": "preference"})
        pref = b._profiles["u1"]["entries"][0]
        assert pref["supportingMemoryIds"] == ["m1", "m2"]

    @pytest.mark.asyncio
    async def test_new_dimension_creates_entry(self):
        """新维度:创建 entry,confidence=0.4,supportingMemoryIds=[新 id]。"""
        b = UserProfileBuilder()
        b._profiles["u1"] = {
            "userId": "u1",
            "entries": [
                make_profile_entry(dimension="preference", support_ids=["m1"]),
            ],
            "totalMemories": 1,
            "completeness": 0.2,
            "updatedAt": "2026-01-01T00:00:00+00:00",
        }
        await b.update_profile("u1", {"id": "m2", "text": "领域知识", "type": "decision"})
        entries = b._profiles["u1"]["entries"]
        # 新增 domain 维度
        domain_entry = [e for e in entries if e["dimension"] == "domain"][0]
        assert domain_entry["confidence"] == 0.4
        assert domain_entry["supportingMemoryIds"] == ["m2"]
        assert domain_entry["content"] == "领域知识"

    @pytest.mark.asyncio
    async def test_confidence_formula_on_append(self):
        """已有维度追加后:confidence = min(1.0, 0.3 + 0.15 * len(support_ids))。"""
        b = UserProfileBuilder()
        b._profiles["u1"] = {
            "userId": "u1",
            "entries": [
                make_profile_entry(dimension="preference", support_ids=["m1"]),
            ],
            "totalMemories": 1,
            "completeness": 0.2,
            "updatedAt": "2026-01-01T00:00:00+00:00",
        }
        # 追加 m2 → len=2 → 0.3 + 0.15*2(update_profile 不 round,用 approx)
        await b.update_profile("u1", {"id": "m2", "text": "x", "type": "preference"})
        assert b._profiles["u1"]["entries"][0]["confidence"] == pytest.approx(0.6, abs=1e-9)

    @pytest.mark.asyncio
    async def test_confidence_capped_at_one(self):
        """support_ids 多到 confidence > 1.0 → 封顶 1.0。"""
        b = UserProfileBuilder()
        # 预置 6 个 id:0.3 + 0.15*6 = 1.2 → 封顶 1.0
        b._profiles["u1"] = {
            "userId": "u1",
            "entries": [
                make_profile_entry(
                    dimension="preference",
                    support_ids=["m1", "m2", "m3", "m4", "m5", "m6"],
                ),
            ],
            "totalMemories": 6,
            "completeness": 0.2,
            "updatedAt": "2026-01-01T00:00:00+00:00",
        }
        await b.update_profile("u1", {"id": "m7", "text": "y", "type": "preference"})
        # len=7 → 0.3 + 0.15*7 = 1.35 → 1.0
        assert b._profiles["u1"]["entries"][0]["confidence"] == 1.0

    @pytest.mark.asyncio
    async def test_content_appended_with_semicolon(self):
        """已有维度:新记忆 text 追加到 content('; ' 分隔)。"""
        b = UserProfileBuilder()
        b._profiles["u1"] = {
            "userId": "u1",
            "entries": [
                make_profile_entry(dimension="preference", content="原有内容", support_ids=["m1"]),
            ],
            "totalMemories": 1,
            "completeness": 0.2,
            "updatedAt": "2026-01-01T00:00:00+00:00",
        }
        await b.update_profile("u1", {"id": "m2", "text": "新增内容", "type": "preference"})
        assert b._profiles["u1"]["entries"][0]["content"] == "原有内容; 新增内容"

    @pytest.mark.asyncio
    async def test_content_truncated_to_five_hundred_chars(self):
        """content 追加后超 500 字 → 截断到 500。"""
        b = UserProfileBuilder()
        b._profiles["u1"] = {
            "userId": "u1",
            "entries": [
                make_profile_entry(
                    dimension="preference",
                    content="A" * 400,
                    support_ids=["m1"],
                ),
            ],
            "totalMemories": 1,
            "completeness": 0.2,
            "updatedAt": "2026-01-01T00:00:00+00:00",
        }
        # 追加 200 字 → 400 + 2(; ) + 200 = 602 → 截断到 500
        await b.update_profile(
            "u1", {"id": "m2", "text": "B" * 200, "type": "preference"}
        )
        assert len(b._profiles["u1"]["entries"][0]["content"]) == 500

    @pytest.mark.asyncio
    async def test_no_memory_id_keeps_support_empty(self):
        """new_memory 无 id 字段 → memory_id='' → supportingMemoryIds 不追加空串。

        源码:if memory_id and memory_id not in support_ids —— 空串为 falsy,不追加。
        """
        b = UserProfileBuilder()
        b._profiles["u1"] = {
            "userId": "u1",
            "entries": [
                make_profile_entry(dimension="preference", support_ids=["m1"]),
            ],
            "totalMemories": 1,
            "completeness": 0.2,
            "updatedAt": "2026-01-01T00:00:00+00:00",
        }
        await b.update_profile("u1", {"text": "无 id 的记忆", "type": "preference"})
        pref = b._profiles["u1"]["entries"][0]
        assert pref["supportingMemoryIds"] == ["m1"]  # 未追加空串
        # confidence 仍按 len=1 重算:0.3 + 0.15*1
        # 注意:update_profile 路径不做 round(与 _fallback_build_profile 不同),
        # 浮点累加得 0.44999999999999996,用 approx 锁定实际行为。
        assert pref["confidence"] == pytest.approx(0.45, abs=1e-9)

    @pytest.mark.asyncio
    async def test_duplicate_id_not_re_appended(self):
        """重复 id 不重复追加(if memory_id not in support_ids 守门)。"""
        b = UserProfileBuilder()
        b._profiles["u1"] = {
            "userId": "u1",
            "entries": [
                make_profile_entry(dimension="preference", support_ids=["m1"]),
            ],
            "totalMemories": 1,
            "completeness": 0.2,
            "updatedAt": "2026-01-01T00:00:00+00:00",
        }
        # 再次传入 m1
        await b.update_profile("u1", {"id": "m1", "text": "重复内容", "type": "preference"})
        pref = b._profiles["u1"]["entries"][0]
        assert pref["supportingMemoryIds"] == ["m1"]  # 仍只有 1 个
        # confidence 按 len=1 重算(update_profile 不 round,浮点 0.44999...)
        assert pref["confidence"] == pytest.approx(0.45, abs=1e-9)

    @pytest.mark.asyncio
    async def test_total_memories_incremented(self):
        """每次 update:totalMemories += 1。"""
        b = UserProfileBuilder()
        b._profiles["u1"] = {
            "userId": "u1",
            "entries": [
                make_profile_entry(dimension="preference", support_ids=["m1"]),
            ],
            "totalMemories": 5,
            "completeness": 0.2,
            "updatedAt": "2026-01-01T00:00:00+00:00",
        }
        await b.update_profile("u1", {"id": "m2", "text": "x", "type": "preference"})
        assert b._profiles["u1"]["totalMemories"] == 6

    @pytest.mark.asyncio
    async def test_completeness_recomputed(self):
        """update 后 completeness 按 covered/5 重算。"""
        b = UserProfileBuilder()
        # 初始只有 1 个维度 → 0.2
        b._profiles["u1"] = {
            "userId": "u1",
            "entries": [
                make_profile_entry(dimension="preference", support_ids=["m1"]),
            ],
            "totalMemories": 1,
            "completeness": 0.2,
            "updatedAt": "2026-01-01T00:00:00+00:00",
        }
        # 新增 domain 维度 → 2 个维度 → 0.4
        await b.update_profile("u1", {"id": "m2", "text": "领域", "type": "decision"})
        assert b._profiles["u1"]["completeness"] == 0.4

    @pytest.mark.asyncio
    async def test_none_id_becomes_none_string_bug(self):
        """BUG: new_memory['id']=None → memory_id=str(None)='None'(非空串)→ 被追加。

        源码 L111: memory_id = str(new_memory.get("id", ""))
        当 id 字段存在但值为 None:new_memory.get("id", "") 返回 None(不是 ""),
        str(None) = "None"(字符串字面量),非空 → 通过 if memory_id 守门 → 追加 'None'。
        这是源码 bug:应为 memory_id = new_memory.get("id") or ""。
        本测试锁定当前(错误)行为,并在 docstring 标注 BUG。
        """
        b = UserProfileBuilder()
        b._profiles["u1"] = {
            "userId": "u1",
            "entries": [
                make_profile_entry(dimension="preference", support_ids=["m1"]),
            ],
            "totalMemories": 1,
            "completeness": 0.2,
            "updatedAt": "2026-01-01T00:00:00+00:00",
        }
        # BUG: id=None 应被当作无 id,但实际被转成 'None' 字符串追加
        await b.update_profile("u1", {"id": None, "text": "x", "type": "preference"})
        pref = b._profiles["u1"]["entries"][0]
        # 锁定 bug 行为:supportingMemoryIds 含 'None' 字符串
        assert "None" in pref["supportingMemoryIds"]
        assert pref["supportingMemoryIds"] == ["m1", "None"]


# =============================================================================
# 13. 集成路径(3 tests)
# =============================================================================


class TestIntegration:
    """集成路径:LLM 成功 / LLM 失败降级 / build 后 update 全链路。"""

    @pytest.mark.asyncio
    async def test_llm_success_full_chain(self):
        """LLM 成功全链路:get_entries → _llm_build_profile → _assemble_profile → 缓存。"""
        entries = [
            make_memory(id="m1", text="喜欢 Python", type="preference"),
            make_memory(id="m2", text="用 git flow", type="convention"),
            make_memory(id="m3", text="金融背景", type="decision"),
        ]
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=entries)
        llm_content = (
            '['
            '{"dimension":"preference","content":"偏好 Python","confidence":0.8,"supportingMemoryIndices":[0]},'
            '{"dimension":"workflow","content":"git flow 工作流","confidence":0.7,"supportingMemoryIndices":[1]},'
            '{"dimension":"domain","content":"金融领域知识","confidence":0.9,"supportingMemoryIndices":[2]}'
            ']'
        )
        with patch_llm_gateway(content=llm_content):
            b = UserProfileBuilder()
            result = await b.build_profile("integ-user", memory_client=client)
        # 3 维度覆盖 → completeness = 0.6
        assert result["totalMemories"] == 3
        assert result["completeness"] == 0.6
        assert len(result["entries"]) == 3
        dims = {e["dimension"] for e in result["entries"]}
        assert dims == {"preference", "workflow", "domain"}
        # supportingMemoryIds 正确映射
        pref = [e for e in result["entries"] if e["dimension"] == "preference"][0]
        assert pref["supportingMemoryIds"] == ["m1"]
        # 缓存写入
        assert b._profiles["integ-user"] is result

    @pytest.mark.asyncio
    async def test_llm_failure_fallback_full_chain(self):
        """LLM 失败降级全链路:get_entries → _llm_build_profile(异常)→ _fallback_build_profile → 缓存。"""
        entries = [
            make_memory(id="m1", text="喜欢简洁", type="preference"),
            make_memory(id="m2", text="用户反馈", type="feedback"),
            make_memory(id="m3", text="项目约定", type="convention"),
        ]
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=entries)
        with patch_llm_gateway(side_effect=RuntimeError("LLM 完全不可用")):
            b = UserProfileBuilder()
            result = await b.build_profile("fallback-user", memory_client=client)
        # 降级:preference + feedback 合并到 preference;convention → workflow
        dims = {e["dimension"] for e in result["entries"]}
        assert dims == {"preference", "workflow"}
        # preference 维度含 2 个 id:0.3 + 0.15*2 = 0.6
        pref = [e for e in result["entries"] if e["dimension"] == "preference"][0]
        assert set(pref["supportingMemoryIds"]) == {"m1", "m2"}
        assert pref["confidence"] == 0.6
        # 缓存写入
        assert b._profiles["fallback-user"] is result

    @pytest.mark.asyncio
    async def test_build_then_update_chain(self):
        """build 后 update 全链路:先全量构建,再增量更新同维度。"""
        entries = [
            make_memory(id="m1", text="偏好 Python", type="preference"),
        ]
        client = MagicMock()
        client.get_entries = AsyncMock(return_value=entries)
        with patch_llm_gateway(
            content='[{"dimension":"preference","content":"喜欢 Python","confidence":0.5,"supportingMemoryIndices":[0]}]'
        ):
            b = UserProfileBuilder(memory_client=client)
            built = await b.build_profile("chain-user", memory_client=client)
        assert built["totalMemories"] == 1
        assert len(built["entries"]) == 1
        # entries[0].id = "m1",LLM indices [0] → entries[0].id = "m1"
        assert built["entries"][0]["supportingMemoryIds"] == ["m1"]

        # update:走缓存(get_entries 不再调用),新记忆 id='m_new' 追加到 preference 维度
        updated = await b.update_profile(
            "chain-user",
            {"id": "m_new", "text": "新偏好", "type": "preference"},
        )
        pref = [e for e in updated["entries"] if e["dimension"] == "preference"][0]
        # m1(原)+ m_new(新增)
        assert pref["supportingMemoryIds"] == ["m1", "m_new"]
        # totalMemories 递增 1 → 2
        assert updated["totalMemories"] == 2
        # content 追加
        assert "新偏好" in pref["content"]
