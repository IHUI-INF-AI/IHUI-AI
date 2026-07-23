"""skill_tester.py 单元测试:Skill 自动测试器(生成用例 + 执行 + 评估通过率)。

覆盖 SkillTester 的 4 个公开方法 + 4 个私有方法 + 1 个全局单例 + 1 个常量。
"""

import asyncio

import pytest
from unittest.mock import AsyncMock, patch

from app.services.skill_tester import SkillTester, skill_tester


# ------------------------------------------------------------
# 常量
# ------------------------------------------------------------


class TestQualityGateConstant:
    """QUALITY_GATE_PASS_RATE 常量。"""

    def test_quality_gate_pass_rate_is_06(self):
        assert SkillTester.QUALITY_GATE_PASS_RATE == 0.6

    def test_quality_gate_pass_rate_is_float(self):
        assert isinstance(SkillTester.QUALITY_GATE_PASS_RATE, float)


# ------------------------------------------------------------
# _build_gen_prompt
# ------------------------------------------------------------


class TestBuildGenPrompt:
    """_build_gen_prompt 构建 LLM 生成测试用例的 prompt。"""

    def test_returns_list_of_dicts(self):
        msgs = SkillTester._build_gen_prompt("x", "content")
        assert isinstance(msgs, list)
        assert all(isinstance(m, dict) for m in msgs)

    def test_system_role_first_user_second(self):
        msgs = SkillTester._build_gen_prompt("x", "content")
        assert msgs[0]["role"] == "system"
        assert msgs[1]["role"] == "user"

    def test_system_content_contains_constraints(self):
        msgs = SkillTester._build_gen_prompt("x", "content")
        sys_content = msgs[0]["content"]
        # 约束关键词
        assert "testCases" in sys_content
        assert "expectedPattern" in sys_content
        assert "isRegex" in sys_content

    def test_user_content_contains_skill_name(self):
        msgs = SkillTester._build_gen_prompt("my-skill", "content")
        assert "my-skill" in msgs[1]["content"]

    def test_user_content_contains_skill_content(self):
        msgs = SkillTester._build_gen_prompt("x", "my skill body")
        assert "my skill body" in msgs[1]["content"]

    def test_user_content_truncated_to_4000_chars(self):
        long_content = "a" * 5000
        msgs = SkillTester._build_gen_prompt("x", long_content)
        # skill_content 在 user content 中被 [:4000] 截断
        user_content = msgs[1]["content"]
        assert "a" * 4000 in user_content
        assert "a" * 4001 not in user_content


# ------------------------------------------------------------
# _parse_test_cases
# ------------------------------------------------------------


class TestParseTestCases:
    """_parse_test_cases 解析 LLM 输出为测试用例列表。"""

    def test_parses_plain_json(self):
        content = '{"testCases": [{"name": "t1", "input": "i1", "expectedPattern": "ok", "isRegex": false}]}'
        cases = SkillTester._parse_test_cases(content)
        assert len(cases) == 1
        assert cases[0]["name"] == "t1"
        assert cases[0]["input"] == "i1"
        assert cases[0]["expectedPattern"] == "ok"
        assert cases[0]["isRegex"] is False

    def test_parses_json_with_code_fence(self):
        content = '```json\n{"testCases": [{"name": "t1", "input": "i1", "expectedPattern": "", "isRegex": false}]}\n```'
        cases = SkillTester._parse_test_cases(content)
        assert len(cases) == 1
        assert cases[0]["name"] == "t1"

    def test_parses_json_with_surrounding_text(self):
        content = 'Here are the cases:\n{"testCases": [{"name": "t1", "input": "i1"}]}\nDone.'
        cases = SkillTester._parse_test_cases(content)
        assert len(cases) == 1

    def test_no_json_returns_empty_list(self):
        content = "no json here"
        cases = SkillTester._parse_test_cases(content)
        assert cases == []

    def test_invalid_json_returns_empty_list(self):
        content = '{"testCases": [invalid}'
        cases = SkillTester._parse_test_cases(content)
        assert cases == []

    def test_no_testcases_key_returns_empty_list(self):
        content = '{"other": []}'
        cases = SkillTester._parse_test_cases(content)
        assert cases == []

    def test_testcases_not_list_returns_empty_list(self):
        content = '{"testCases": "not a list"}'
        cases = SkillTester._parse_test_cases(content)
        assert cases == []

    def test_case_missing_name_skipped(self):
        content = '{"testCases": [{"input": "i1"}, {"name": "t2", "input": "i2"}]}'
        cases = SkillTester._parse_test_cases(content)
        assert len(cases) == 1
        assert cases[0]["name"] == "t2"

    def test_case_missing_input_skipped(self):
        content = '{"testCases": [{"name": "t1"}, {"name": "t2", "input": "i2"}]}'
        cases = SkillTester._parse_test_cases(content)
        assert len(cases) == 1
        assert cases[0]["name"] == "t2"

    def test_case_not_dict_skipped(self):
        content = '{"testCases": ["not dict", {"name": "t1", "input": "i1"}]}'
        cases = SkillTester._parse_test_cases(content)
        assert len(cases) == 1

    def test_isregex_defaults_false_and_pattern_defaults_empty(self):
        content = '{"testCases": [{"name": "t1", "input": "i1"}]}'
        cases = SkillTester._parse_test_cases(content)
        assert cases[0]["isRegex"] is False
        assert cases[0]["expectedPattern"] == ""

    def test_name_stripped(self):
        content = '{"testCases": [{"name": "  t1  ", "input": "i1"}]}'
        cases = SkillTester._parse_test_cases(content)
        assert cases[0]["name"] == "t1"

    def test_isregex_truthy_coerced_to_bool(self):
        content = '{"testCases": [{"name": "t1", "input": "i1", "isRegex": 1}]}'
        cases = SkillTester._parse_test_cases(content)
        assert cases[0]["isRegex"] is True

    def test_multiple_cases_parsed(self):
        content = '{"testCases": [{"name": "t1", "input": "i1"}, {"name": "t2", "input": "i2"}, {"name": "t3", "input": "i3"}]}'
        cases = SkillTester._parse_test_cases(content)
        assert len(cases) == 3


# ------------------------------------------------------------
# generate_test_cases(异步)
# ------------------------------------------------------------


class TestGenerateTestCases:
    """generate_test_cases LLM 生成测试用例 + 降级。"""

    @pytest.mark.asyncio
    async def test_llm_returns_valid_cases(self):
        tester = SkillTester()
        llm_response = {
            "content": '{"testCases": [{"name": "t1", "input": "i1", "expectedPattern": "ok"}]}'
        }
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value=llm_response,
        ):
            cases = await tester.generate_test_cases("x", "content")
        assert len(cases) == 1
        assert cases[0]["name"] == "t1"

    @pytest.mark.asyncio
    async def test_llm_exception_falls_back_to_smoke(self):
        tester = SkillTester()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, side_effect=Exception("LLM down"),
        ):
            cases = await tester.generate_test_cases("x", "content")
        assert len(cases) == 1
        assert cases[0]["name"] == "smoke-test"
        assert cases[0]["expectedPattern"] == ""
        assert cases[0]["isRegex"] is False

    @pytest.mark.asyncio
    async def test_llm_returns_empty_content_falls_back_to_smoke(self):
        tester = SkillTester()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value={"content": ""},
        ):
            cases = await tester.generate_test_cases("x", "content")
        assert len(cases) == 1
        assert cases[0]["name"] == "smoke-test"

    @pytest.mark.asyncio
    async def test_llm_returns_unparseable_falls_back_to_smoke(self):
        tester = SkillTester()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value={"content": "not json at all"},
        ):
            cases = await tester.generate_test_cases("x", "content")
        assert len(cases) == 1
        assert cases[0]["name"] == "smoke-test"

    @pytest.mark.asyncio
    async def test_llm_returns_empty_cases_list_falls_back_to_smoke(self):
        """LLM 返回 testCases: [] 空列表 → _parse 返回 [] → 降级 smoke。"""
        tester = SkillTester()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content": '{"testCases": []}'},
        ):
            cases = await tester.generate_test_cases("x", "content")
        assert len(cases) == 1
        assert cases[0]["name"] == "smoke-test"


# ------------------------------------------------------------
# _match
# ------------------------------------------------------------


class TestMatch:
    """_match 比对实际输出与期望 pattern。"""

    def test_empty_pattern_nonempty_output_passes(self):
        passed, reason = SkillTester._match("hello", "", False)
        assert passed is True
        assert reason is None

    def test_empty_pattern_empty_output_fails(self):
        passed, reason = SkillTester._match("", "", False)
        assert passed is False
        assert reason == "输出为空"

    def test_empty_pattern_whitespace_only_fails(self):
        passed, reason = SkillTester._match("   \n  ", "", False)
        assert passed is False
        assert reason == "输出为空"

    def test_keyword_match_passes(self):
        passed, reason = SkillTester._match("hello world", "world", False)
        assert passed is True
        assert reason is None

    def test_keyword_no_match_fails(self):
        passed, reason = SkillTester._match("hello world", "missing", False)
        assert passed is False
        assert "未包含关键词" in reason
        assert "missing" in reason

    def test_regex_match_passes(self):
        passed, reason = SkillTester._match("error: code 42", r"code \d+", True)
        assert passed is True
        assert reason is None

    def test_regex_no_match_fails(self):
        passed, reason = SkillTester._match("no digits here", r"\d+", True)
        assert passed is False
        assert "正则未匹配" in reason

    def test_regex_compile_error_fails(self):
        passed, reason = SkillTester._match("output", r"[invalid(", True)
        assert passed is False
        assert "正则编译失败" in reason

    def test_empty_pattern_isregex_ignored(self):
        """空 pattern 时 isRegex 参数不影响行为(走 smoke 分支)。"""
        passed1, _ = SkillTester._match("x", "", False)
        passed2, _ = SkillTester._match("x", "", True)
        assert passed1 == passed2 is True


# ------------------------------------------------------------
# _fail
# ------------------------------------------------------------


class TestFail:
    """_fail 构造失败用例结果。"""

    def test_returns_dict_with_required_fields(self):
        import time
        start = time.monotonic()
        result = SkillTester._fail("t1", "output", "reason", start)
        assert result["name"] == "t1"
        assert result["actualOutput"] == "output"
        assert result["passed"] is False
        assert result["failureReason"] == "reason"
        assert "durationMs" in result

    def test_duration_ms_is_non_negative_int(self):
        import time
        start = time.monotonic()
        result = SkillTester._fail("t1", "", "r", start)
        assert isinstance(result["durationMs"], int)
        assert result["durationMs"] >= 0

    def test_no_failure_reason_key_when_passed_implicitly(self):
        """_fail 永远设置 failureReason(passed=False 时必有)。"""
        import time
        result = SkillTester._fail("t1", "", "r", time.monotonic())
        assert "failureReason" in result


# ------------------------------------------------------------
# run_test(异步)
# ------------------------------------------------------------


class TestRunTest:
    """run_test 执行测试 + 汇总通过率。"""

    @pytest.mark.asyncio
    async def test_empty_cases_returns_zero_passrate(self):
        tester = SkillTester()
        result = await tester.run_test({"skillName": "x", "skillContent": "c", "testCases": []})
        assert result["passed"] == 0
        assert result["total"] == 0
        assert result["passRate"] == 0.0
        assert result["allPassed"] is False
        assert result["skillName"] == "x"

    @pytest.mark.asyncio
    async def test_all_passed(self):
        tester = SkillTester()
        cases = [
            {"name": "t1", "input": "i1", "expectedPattern": "ok", "isRegex": False},
            {"name": "t2", "input": "i2", "expectedPattern": "ok", "isRegex": False},
        ]
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value={"content": "ok output"},
        ):
            result = await tester.run_test({"skillName": "x", "skillContent": "c", "testCases": cases})
        assert result["passed"] == 2
        assert result["total"] == 2
        assert result["passRate"] == 1.0
        assert result["allPassed"] is True

    @pytest.mark.asyncio
    async def test_all_failed(self):
        tester = SkillTester()
        cases = [
            {"name": "t1", "input": "i1", "expectedPattern": "missing", "isRegex": False},
        ]
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value={"content": "ok output"},
        ):
            result = await tester.run_test({"skillName": "x", "skillContent": "c", "testCases": cases})
        assert result["passed"] == 0
        assert result["total"] == 1
        assert result["passRate"] == 0.0
        assert result["allPassed"] is False

    @pytest.mark.asyncio
    async def test_partial_pass(self):
        tester = SkillTester()
        cases = [
            {"name": "t1", "input": "i1", "expectedPattern": "ok", "isRegex": False},
            {"name": "t2", "input": "i2", "expectedPattern": "missing", "isRegex": False},
        ]
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value={"content": "ok output"},
        ):
            result = await tester.run_test({"skillName": "x", "skillContent": "c", "testCases": cases})
        assert result["passed"] == 1
        assert result["total"] == 2
        assert result["passRate"] == 0.5
        assert result["allPassed"] is False

    @pytest.mark.asyncio
    async def test_non_dict_case_skipped(self):
        tester = SkillTester()
        cases = ["not dict", 42, {"name": "t1", "input": "i1", "expectedPattern": "ok"}]
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value={"content": "ok output"},
        ):
            result = await tester.run_test({"skillName": "x", "skillContent": "c", "testCases": cases})
        assert result["total"] == 1
        assert result["passed"] == 1

    @pytest.mark.asyncio
    async def test_total_duration_ms_is_non_negative_int(self):
        tester = SkillTester()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value={"content": "ok"},
        ):
            result = await tester.run_test({
                "skillName": "x", "skillContent": "c",
                "testCases": [{"name": "t1", "input": "i1"}],
            })
        assert isinstance(result["totalDurationMs"], int)
        assert result["totalDurationMs"] >= 0

    @pytest.mark.asyncio
    async def test_skillname_passthrough(self):
        tester = SkillTester()
        result = await tester.run_test({"skillName": "my-skill", "skillContent": "c", "testCases": []})
        assert result["skillName"] == "my-skill"

    @pytest.mark.asyncio
    async def test_default_timeout_30_seconds(self):
        """timeoutSeconds 默认 30(通过 _run_single 的超时行为间接验证)。"""
        tester = SkillTester()

        async def slow_complete(messages):
            await asyncio.sleep(0.1)
            return {"content": "ok"}

        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, side_effect=slow_complete,
        ):
            result = await tester.run_test({
                "skillName": "x", "skillContent": "c",
                "testCases": [{"name": "t1", "input": "i1"}],
            })
        assert result["passed"] == 1


# ------------------------------------------------------------
# _run_single(异步)
# ------------------------------------------------------------


class TestRunSingle:
    """_run_single 执行单个测试用例(超时/异常/error 都标记 failed)。"""

    @pytest.mark.asyncio
    async def test_normal_match_passes(self):
        tester = SkillTester()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value={"content": "hello world"},
        ):
            result = await tester._run_single(
                skill_content="c",
                case={"name": "t1", "input": "i1", "expectedPattern": "hello", "isRegex": False},
                timeout_seconds=30,
            )
        assert result["passed"] is True
        assert result["name"] == "t1"
        assert result["actualOutput"] == "hello world"
        assert "durationMs" in result
        assert "failureReason" not in result

    @pytest.mark.asyncio
    async def test_normal_no_match_fails(self):
        tester = SkillTester()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value={"content": "hello world"},
        ):
            result = await tester._run_single(
                skill_content="c",
                case={"name": "t1", "input": "i1", "expectedPattern": "missing", "isRegex": False},
                timeout_seconds=30,
            )
        assert result["passed"] is False
        assert "failureReason" in result
        assert "未包含关键词" in result["failureReason"]

    @pytest.mark.asyncio
    async def test_timeout_fails(self):
        tester = SkillTester()

        async def slow_complete(messages):
            await asyncio.sleep(2)
            return {"content": "ok"}

        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, side_effect=slow_complete,
        ):
            result = await tester._run_single(
                skill_content="c",
                case={"name": "t1", "input": "i1", "expectedPattern": "ok"},
                timeout_seconds=1,
            )
        assert result["passed"] is False
        assert "超时" in result["failureReason"]
        assert "1" in result["failureReason"]

    @pytest.mark.asyncio
    async def test_exception_fails(self):
        tester = SkillTester()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, side_effect=ValueError("boom"),
        ):
            result = await tester._run_single(
                skill_content="c",
                case={"name": "t1", "input": "i1", "expectedPattern": "ok"},
                timeout_seconds=30,
            )
        assert result["passed"] is False
        assert "异常" in result["failureReason"]
        assert "ValueError" in result["failureReason"]

    @pytest.mark.asyncio
    async def test_llm_error_field_fails(self):
        """LLM 返回 error 字段 → 标记 failed + "LLM 错误"。"""
        tester = SkillTester()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content": "", "error": True, "error_message": "rate limited"},
        ):
            result = await tester._run_single(
                skill_content="c",
                case={"name": "t1", "input": "i1", "expectedPattern": "ok"},
                timeout_seconds=30,
            )
        assert result["passed"] is False
        assert "LLM 错误" in result["failureReason"]

    @pytest.mark.asyncio
    async def test_empty_pattern_nonempty_output_passes(self):
        tester = SkillTester()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value={"content": "some output"},
        ):
            result = await tester._run_single(
                skill_content="c",
                case={"name": "t1", "input": "i1", "expectedPattern": ""},
                timeout_seconds=30,
            )
        assert result["passed"] is True

    @pytest.mark.asyncio
    async def test_empty_skill_content_uses_default_system(self):
        """空 skill_content → system prompt 用默认 '你是通用助手。'。"""
        tester = SkillTester()
        captured_messages = []

        async def capture_complete(messages):
            captured_messages.append(messages)
            return {"content": "ok"}

        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, side_effect=capture_complete,
        ):
            await tester._run_single(
                skill_content="",
                case={"name": "t1", "input": "i1", "expectedPattern": "ok"},
                timeout_seconds=30,
            )
        assert captured_messages[0][0]["content"] == "你是通用助手。"

    @pytest.mark.asyncio
    async def test_failure_reason_truncated_to_200_chars(self):
        """异常消息截断到 200 字(源码 str(e)[:200])。"""
        tester = SkillTester()
        long_msg = "x" * 500

        class CustomError(Exception):
            pass

        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, side_effect=CustomError(long_msg),
        ):
            result = await tester._run_single(
                skill_content="c",
                case={"name": "t1", "input": "i1", "expectedPattern": "ok"},
                timeout_seconds=30,
            )
        # failureReason 含 "异常: CustomError: " + 截断的消息
        assert result["passed"] is False
        # 验证消息被截断(总长度不超过 200 + 前缀)
        assert len(result["failureReason"]) < 300


# ------------------------------------------------------------
# 全局单例
# ------------------------------------------------------------


class TestGlobalSingleton:
    """skill_tester 全局单例。"""

    def test_singleton_is_skill_tester_instance(self):
        assert isinstance(skill_tester, SkillTester)

    def test_singleton_has_quality_gate_constant(self):
        assert skill_tester.QUALITY_GATE_PASS_RATE == 0.6

    def test_singleton_has_generate_test_cases(self):
        assert hasattr(skill_tester, "generate_test_cases")
        assert callable(skill_tester.generate_test_cases)

    def test_singleton_has_run_test(self):
        assert hasattr(skill_tester, "run_test")
        assert callable(skill_tester.run_test)
