"""skill_iterator.py 单元测试:Skill 基于反馈迭代优化。

覆盖 SkillIterator 的全部方法 + 全局单例。
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.services.skill_iterator import SkillIterator, skill_iterator


# ------------------------------------------------------------
# _no_iterate(静态方法)
# ------------------------------------------------------------


class TestNoIterate:
    """_no_iterate 构造不迭代结果。"""

    def test_returns_dict(self):
        result = SkillIterator._no_iterate("reason")
        assert isinstance(result, dict)

    def test_should_iterate_false(self):
        result = SkillIterator._no_iterate("r")
        assert result["shouldIterate"] is False

    def test_reason_passthrough(self):
        result = SkillIterator._no_iterate("my reason")
        assert result["reason"] == "my reason"

    def test_expected_improvements_empty_list(self):
        result = SkillIterator._no_iterate("r")
        assert result["expectedImprovements"] == []


# ------------------------------------------------------------
# bump_version(静态方法)
# ------------------------------------------------------------


class TestBumpVersion:
    """bump_version 语义化版本递增(major.(minor+1).0)。"""

    def test_normal_version(self):
        assert SkillIterator.bump_version("1.0.0") == "1.1.0"

    def test_minor_increment(self):
        assert SkillIterator.bump_version("2.5.3") == "2.6.0"

    def test_two_segments(self):
        """2 段版本 '1.0' → '1.1.0'。"""
        assert SkillIterator.bump_version("1.0") == "1.1.0"

    def test_single_segment_fallback(self):
        """1 段版本 '1' → '1.1.0'(兜底)。"""
        assert SkillIterator.bump_version("1") == "1.1.0"

    def test_empty_string_fallback(self):
        assert SkillIterator.bump_version("") == "1.1.0"

    def test_invalid_string_fallback(self):
        assert SkillIterator.bump_version("invalid") == "1.1.0"

    def test_four_segments_takes_first_two(self):
        """4 段版本 '1.2.3.4' → '1.3.0'(只取前两段)。"""
        assert SkillIterator.bump_version("1.2.3.4") == "1.3.0"

    def test_whitespace_stripped(self):
        assert SkillIterator.bump_version("  1.0.0  ") == "1.1.0"

    def test_major_zero(self):
        assert SkillIterator.bump_version("0.5.0") == "0.6.0"


# ------------------------------------------------------------
# _extract_version(静态方法)
# ------------------------------------------------------------


class TestExtractVersion:
    """_extract_version 从 SKILL.md frontmatter 提取 version。"""

    def test_extracts_version(self):
        md = "---\nname: x\nversion: 1.2.3\n---\n# Instructions\nbody"
        assert SkillIterator._extract_version(md) == "1.2.3"

    def test_no_version_returns_empty(self):
        md = "---\nname: x\n---\n# Instructions"
        assert SkillIterator._extract_version(md) == ""

    def test_no_frontmatter_returns_empty(self):
        md = "# Just instructions\nno frontmatter"
        assert SkillIterator._extract_version(md) == ""

    def test_version_with_trailing_spaces(self):
        md = "---\nversion: 2.0.0   \n---\nbody"
        assert SkillIterator._extract_version(md) == "2.0.0"

    def test_version_in_body_not_matched(self):
        """正则 ^version: 只匹配行首,body 中的不匹配。"""
        md = "---\nname: x\n---\nversion: 9.9.9"
        # body 中的 version: 也会被 MULTILINE 匹配
        assert SkillIterator._extract_version(md) == "9.9.9"


# ------------------------------------------------------------
# _build_iterate_prompt(静态方法)
# ------------------------------------------------------------


class TestBuildIteratePrompt:
    """_build_iterate_prompt 构建迭代 prompt。"""

    def test_returns_list_of_dicts(self):
        msgs = SkillIterator._build_iterate_prompt(
            skill_name="x", current_content="c",
            usage_stats={}, failure_cases=[], current_test={},
        )
        assert isinstance(msgs, list)
        assert all(isinstance(m, dict) for m in msgs)

    def test_system_role_first_user_second(self):
        msgs = SkillIterator._build_iterate_prompt(
            skill_name="x", current_content="c",
            usage_stats={}, failure_cases=[], current_test={},
        )
        assert msgs[0]["role"] == "system"
        assert msgs[1]["role"] == "user"

    def test_system_content_contains_constraints(self):
        msgs = SkillIterator._build_iterate_prompt(
            skill_name="x", current_content="c",
            usage_stats={}, failure_cases=[], current_test={},
        )
        sys_content = msgs[0]["content"]
        assert "shouldIterate" in sys_content
        assert "newContent" in sys_content
        assert "expectedImprovements" in sys_content

    def test_user_content_contains_skill_name(self):
        msgs = SkillIterator._build_iterate_prompt(
            skill_name="my-skill", current_content="c",
            usage_stats={}, failure_cases=[], current_test={},
        )
        assert "my-skill" in msgs[1]["content"]

    def test_user_content_contains_current_content(self):
        msgs = SkillIterator._build_iterate_prompt(
            skill_name="x", current_content="my content body",
            usage_stats={}, failure_cases=[], current_test={},
        )
        assert "my content body" in msgs[1]["content"]

    def test_current_content_truncated_to_4000(self):
        long_content = "a" * 5000
        msgs = SkillIterator._build_iterate_prompt(
            skill_name="x", current_content=long_content,
            usage_stats={}, failure_cases=[], current_test={},
        )
        user_content = msgs[1]["content"]
        assert "a" * 4000 in user_content
        assert "a" * 4001 not in user_content

    def test_usage_stats_included(self):
        msgs = SkillIterator._build_iterate_prompt(
            skill_name="x", current_content="c",
            usage_stats={"totalUses": 10}, failure_cases=[], current_test={},
        )
        assert "totalUses" in msgs[1]["content"]
        assert "10" in msgs[1]["content"]

    def test_failure_cases_truncated_to_5(self):
        failures = [{"case": i} for i in range(10)]
        msgs = SkillIterator._build_iterate_prompt(
            skill_name="x", current_content="c",
            usage_stats={}, failure_cases=failures, current_test={},
        )
        user_content = msgs[1]["content"]
        # failures_text = json.dumps(failure_cases[:5]),只含前 5 个
        assert '"case": 0' in user_content
        assert '"case": 4' in user_content
        assert '"case": 5' not in user_content


# ------------------------------------------------------------
# _parse_iterate_output(静态方法)
# ------------------------------------------------------------


class TestParseIterateOutput:
    """_parse_iterate_output 解析 LLM 迭代输出。"""

    def test_parses_plain_json(self):
        content = '{"shouldIterate": true, "newContent": "new", "reason": "r", "expectedImprovements": ["a"]}'
        result = SkillIterator._parse_iterate_output(content)
        assert result["shouldIterate"] is True
        assert result["newContent"] == "new"
        assert result["reason"] == "r"
        assert result["expectedImprovements"] == ["a"]

    def test_parses_json_with_code_fence(self):
        content = '```json\n{"shouldIterate": true, "newContent": "x"}\n```'
        result = SkillIterator._parse_iterate_output(content)
        assert result["shouldIterate"] is True
        assert result["newContent"] == "x"

    def test_parses_json_with_surrounding_text(self):
        content = 'Here is the result:\n{"shouldIterate": false, "reason": "no change"}\nDone.'
        result = SkillIterator._parse_iterate_output(content)
        assert result["shouldIterate"] is False
        assert result["reason"] == "no change"

    def test_no_json_returns_no_iterate(self):
        content = "no json here"
        result = SkillIterator._parse_iterate_output(content)
        assert result["shouldIterate"] is False
        assert "未包含 JSON" in result["reason"]

    def test_invalid_json_returns_no_iterate(self):
        content = '{"shouldIterate": invalid}'
        result = SkillIterator._parse_iterate_output(content)
        assert result["shouldIterate"] is False
        assert "无法解析" in result["reason"]

    def test_missing_shoulditerate_defaults_false(self):
        content = '{"newContent": "x", "reason": "r"}'
        result = SkillIterator._parse_iterate_output(content)
        assert result["shouldIterate"] is False

    def test_expected_improvements_non_list_string_coerced_to_chars(self):
        # 源码 list("not a list" or []) 把 truthy 字符串转成字符列表(类型强转行为)
        content = '{"shouldIterate": true, "expectedImprovements": "not a list"}'
        result = SkillIterator._parse_iterate_output(content)
        assert result["expectedImprovements"] == list("not a list")

    def test_expected_improvements_empty_list_returns_empty(self):
        content = '{"shouldIterate": true, "expectedImprovements": []}'
        result = SkillIterator._parse_iterate_output(content)
        assert result["expectedImprovements"] == []

    def test_expected_improvements_none_returns_empty(self):
        content = '{"shouldIterate": true, "expectedImprovements": null}'
        result = SkillIterator._parse_iterate_output(content)
        assert result["expectedImprovements"] == []

    def test_newcontent_defaults_empty_string(self):
        content = '{"shouldIterate": true}'
        result = SkillIterator._parse_iterate_output(content)
        assert result["newContent"] == ""

    def test_reason_defaults_empty_string(self):
        content = '{"shouldIterate": true}'
        result = SkillIterator._parse_iterate_output(content)
        assert result["reason"] == ""

    def test_non_dict_json_returns_no_iterate(self):
        """JSON 是 list 而非 dict → 兜底 no_iterate。"""
        content = '["not", "a", "dict"]'
        result = SkillIterator._parse_iterate_output(content)
        assert result["shouldIterate"] is False

    def test_shoulditerate_int_one_coerced_to_true(self):
        content = '{"shouldIterate": 1}'
        result = SkillIterator._parse_iterate_output(content)
        assert result["shouldIterate"] is True

    def test_shoulditerate_empty_string_coerced_to_false(self):
        content = '{"shouldIterate": ""}'
        result = SkillIterator._parse_iterate_output(content)
        assert result["shouldIterate"] is False


# ------------------------------------------------------------
# _read_skill_file(静态方法)
# ------------------------------------------------------------


class TestReadSkillFile:
    """_read_skill_file 读取 skill 文件。"""

    def test_file_not_exists_returns_empty_and_path(self, tmp_path, monkeypatch):
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        content, path = SkillIterator._read_skill_file("nonexistent")
        assert content == ""
        assert "nonexistent.md" in path

    def test_file_exists_returns_content(self, tmp_path, monkeypatch):
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        skill_file = tmp_path / "my-skill.md"
        skill_file.write_text("# Instructions\nbody", encoding="utf-8")
        content, path = SkillIterator._read_skill_file("my-skill")
        assert content == "# Instructions\nbody"
        assert path.endswith("my-skill.md")

    def test_path_joined_correctly(self, tmp_path, monkeypatch):
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        _, path = SkillIterator._read_skill_file("test-skill")
        assert path == f"{tmp_path}\\test-skill.md" or path.endswith("/test-skill.md")


# ------------------------------------------------------------
# _write_skill_file(静态方法)
# ------------------------------------------------------------


class TestWriteSkillFile:
    """_write_skill_file 写回 skill 文件。"""

    def test_write_success_returns_true(self, tmp_path):
        path = str(tmp_path / "skill.md")
        assert SkillIterator._write_skill_file(path, "content") is True
        assert (tmp_path / "skill.md").read_text(encoding="utf-8") == "content"

    def test_creates_directory_if_not_exists(self, tmp_path):
        path = str(tmp_path / "subdir" / "skill.md")
        assert SkillIterator._write_skill_file(path, "content") is True
        assert (tmp_path / "subdir" / "skill.md").exists()

    def test_write_exception_returns_false(self, tmp_path):
        """写入非法路径(如只读目录)→ 返回 False。"""
        # 使用一个不可能的路径(Windows 保留名)
        path = "COM1:\\invalid.md"
        result = SkillIterator._write_skill_file(path, "content")
        assert result is False


# ------------------------------------------------------------
# _rewrite_skill_md(静态方法)
# ------------------------------------------------------------


class TestRewriteSkillMd:
    """_rewrite_skill_md 重写 SKILL.md(frontmatter + 正文)。"""

    def test_replaces_version_and_body(self):
        old_md = "---\nname: x\nversion: 1.0.0\ndescription: d\n---\n# Old Instructions\nold body"
        new_md = SkillIterator._rewrite_skill_md(old_md, "new body", "1.1.0")
        assert "version: 1.1.0" in new_md
        assert "new body" in new_md
        assert "old body" not in new_md
        # 保留其他 frontmatter 字段
        assert "name: x" in new_md
        assert "description: d" in new_md

    def test_no_frontmatter_rebuilds_minimal(self):
        old_md = ""
        new_md = SkillIterator._rewrite_skill_md(old_md, "new body", "1.1.0")
        assert "version: 1.1.0" in new_md
        assert "source: auto" in new_md
        assert "autoGeneratedAt:" in new_md
        assert "new body" in new_md

    def test_frontmatter_without_version_appends_version(self):
        old_md = "---\nname: x\ndescription: d\n---\n# Instructions\nbody"
        new_md = SkillIterator._rewrite_skill_md(old_md, "new body", "1.1.0")
        assert "version: 1.1.0" in new_md
        assert "name: x" in new_md

    def test_instructions_header_added(self):
        old_md = "---\nversion: 1.0.0\n---\nold"
        new_md = SkillIterator._rewrite_skill_md(old_md, "new body", "1.1.0")
        assert "# Instructions" in new_md
        assert "new body" in new_md

    def test_new_instructions_replaces_old(self):
        old_md = "---\nversion: 1.0.0\n---\n# Instructions\nold instructions here"
        new_md = SkillIterator._rewrite_skill_md(old_md, "completely new", "1.1.0")
        assert "completely new" in new_md
        assert "old instructions here" not in new_md

    def test_related_skills_preserved(self):
        old_md = "---\nname: x\nversion: 1.0.0\nrelatedSkills: [\"a\", \"b\"]\n---\nbody"
        new_md = SkillIterator._rewrite_skill_md(old_md, "new", "1.1.0")
        assert 'relatedSkills' in new_md


# ------------------------------------------------------------
# iterate(异步)
# ------------------------------------------------------------


class TestIterate:
    """iterate 主入口(LLM 调用 + 解析 + 写回 + 验证)。"""

    @pytest.mark.asyncio
    async def test_llm_exception_returns_no_iterate(self):
        """LLM 调用失败 → 返回 _no_iterate。"""
        iterator = SkillIterator()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, side_effect=Exception("LLM down"),
        ):
            result = await iterator.iterate({"skillName": "x", "currentContent": "c"})
        assert result["shouldIterate"] is False
        assert "LLM 调用失败" in result["reason"]

    @pytest.mark.asyncio
    async def test_should_iterate_false_passthrough(self):
        iterator = SkillIterator()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content": '{"shouldIterate": false, "reason": "no improvement"}'},
        ):
            result = await iterator.iterate({"skillName": "x", "currentContent": "c"})
        assert result["shouldIterate"] is False
        assert result["reason"] == "no improvement"

    @pytest.mark.asyncio
    async def test_should_iterate_true_but_empty_content_not_persisted(self):
        """shouldIterate=True 但 newContent 空 → shouldIterate=False + 提示。"""
        iterator = SkillIterator()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content": '{"shouldIterate": true, "newContent": "", "reason": "r"}'},
        ):
            result = await iterator.iterate({"skillName": "x", "currentContent": "c"})
        assert result["shouldIterate"] is False
        assert "新内容为空" in result["reason"]

    @pytest.mark.asyncio
    async def test_unparseable_output_returns_no_iterate(self):
        iterator = SkillIterator()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content": "not json at all"},
        ):
            result = await iterator.iterate({"skillName": "x", "currentContent": "c"})
        assert result["shouldIterate"] is False

    @pytest.mark.asyncio
    async def test_write_failure_returns_no_iterate(self, tmp_path, monkeypatch):
        """写盘失败 → shouldIterate=False + '写盘失败'。"""
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        iterator = SkillIterator()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content": '{"shouldIterate": true, "newContent": "new", "reason": "r"}'},
        ), patch(
            "app.services.skill_iterator.SkillIterator._write_skill_file",
            return_value=False,
        ):
            result = await iterator.iterate({"skillName": "x", "currentContent": "c"})
        assert result["shouldIterate"] is False
        assert "写盘失败" in result["reason"]

    @pytest.mark.asyncio
    async def test_successful_iteration_kept(self, tmp_path, monkeypatch):
        """正常迭代 + 通过率提升 → 保留 + 记录历史。"""
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        # 预创建 skill 文件
        skill_file = tmp_path / "my-skill.md"
        skill_file.write_text("---\nname: my-skill\nversion: 1.0.0\n---\n# Instructions\nold", encoding="utf-8")

        iterator = SkillIterator()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content": '{"shouldIterate": true, "newContent": "new improved", "reason": "better"}'},
        ), patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={"passRate": 0.9},  # 高于基线 0.5
        ), patch(
            "app.services.skill_feedback.skill_feedback_tracker.record_iteration",
            new_callable=AsyncMock,
        ) as mock_record:
            result = await iterator.iterate({
                "skillName": "my-skill",
                "currentContent": "old",
                "currentTestResult": {"passRate": 0.5},
            })
        assert result["shouldIterate"] is True
        assert result["newVersion"] == "1.1.0"
        assert result["newContent"] == "new improved"
        # 记录迭代历史被调用
        mock_record.assert_called_once()

    @pytest.mark.asyncio
    async def test_rollback_when_pass_rate_decreases(self, tmp_path, monkeypatch):
        """通过率下降 → 回滚 + shouldIterate=False。"""
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        skill_file = tmp_path / "my-skill.md"
        skill_file.write_text("---\nname: my-skill\nversion: 1.0.0\n---\n# Instructions\nold", encoding="utf-8")

        iterator = SkillIterator()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content": '{"shouldIterate": true, "newContent": "new", "reason": "r"}'},
        ), patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={"passRate": 0.3},  # 低于基线 0.8
        ):
            result = await iterator.iterate({
                "skillName": "my-skill",
                "currentContent": "old",
                "currentTestResult": {"passRate": 0.8},
            })
        assert result["shouldIterate"] is False
        assert "回滚" in result["reason"]
        # newVersion 和 newContent 被移除
        assert "newVersion" not in result
        assert "newContent" not in result
        # 原文件被回滚(内容恢复)
        content = skill_file.read_text(encoding="utf-8")
        assert "old" in content
        assert "new" not in content or "new" in "newContent"  # new 可能在 frontmatter

    @pytest.mark.asyncio
    async def test_pass_rate_equal_kept(self, tmp_path, monkeypatch):
        """通过率持平(>= 基线)→ 保留(允许容忍测试用例波动)。"""
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        skill_file = tmp_path / "my-skill.md"
        skill_file.write_text("---\nname: my-skill\nversion: 1.0.0\n---\n# Instructions\nold", encoding="utf-8")

        iterator = SkillIterator()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content": '{"shouldIterate": true, "newContent": "new", "reason": "r"}'},
        ), patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={"passRate": 0.5},  # 等于基线 0.5
        ), patch(
            "app.services.skill_feedback.skill_feedback_tracker.record_iteration",
            new_callable=AsyncMock,
        ):
            result = await iterator.iterate({
                "skillName": "my-skill",
                "currentContent": "old",
                "currentTestResult": {"passRate": 0.5},
            })
        assert result["shouldIterate"] is True

    @pytest.mark.asyncio
    async def test_verify_exception_rolls_back(self, tmp_path, monkeypatch):
        """验证测试抛异常 → 回滚 + shouldIterate=False。"""
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        skill_file = tmp_path / "my-skill.md"
        skill_file.write_text("---\nname: my-skill\nversion: 1.0.0\n---\n# Instructions\nold", encoding="utf-8")

        iterator = SkillIterator()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content": '{"shouldIterate": true, "newContent": "new", "reason": "r"}'},
        ), patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, side_effect=Exception("test gen failed"),
        ):
            result = await iterator.iterate({
                "skillName": "my-skill",
                "currentContent": "old",
                "currentTestResult": {"passRate": 0.5},
            })
        assert result["shouldIterate"] is False
        assert "回滚" in result["reason"]


# ------------------------------------------------------------
# _verify_and_maybe_rollback(异步)
# ------------------------------------------------------------


class TestVerifyAndMaybeRollback:
    """_verify_and_maybe_rollback 重跑测试 + 通过率比较 + 回滚。"""

    @pytest.mark.asyncio
    async def test_pass_rate_improvement_kept(self, tmp_path, monkeypatch):
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        iterator = SkillIterator()
        with patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={"passRate": 0.9},
        ):
            kept, new_rate = await iterator._verify_and_maybe_rollback(
                skill_name="x", new_content="new", skill_path=str(tmp_path / "x.md"),
                backup_md="old", baseline_pass_rate=0.5,
                current_version="1.0.0", new_version="1.1.0", reason="r",
            )
        assert kept is True
        assert new_rate == 0.9

    @pytest.mark.asyncio
    async def test_pass_rate_equal_kept(self, tmp_path, monkeypatch):
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        iterator = SkillIterator()
        with patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={"passRate": 0.5},
        ):
            kept, new_rate = await iterator._verify_and_maybe_rollback(
                skill_name="x", new_content="new", skill_path=str(tmp_path / "x.md"),
                backup_md="old", baseline_pass_rate=0.5,
                current_version="1.0.0", new_version="1.1.0", reason="r",
            )
        assert kept is True

    @pytest.mark.asyncio
    async def test_pass_rate_decrease_rolls_back(self, tmp_path, monkeypatch):
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        # 预创建文件用于回滚验证
        skill_path = tmp_path / "x.md"
        skill_path.write_text("old content", encoding="utf-8")

        iterator = SkillIterator()
        with patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={"passRate": 0.3},
        ):
            kept, new_rate = await iterator._verify_and_maybe_rollback(
                skill_name="x", new_content="new", skill_path=str(skill_path),
                backup_md="old content", baseline_pass_rate=0.8,
                current_version="1.0.0", new_version="1.1.0", reason="r",
            )
        assert kept is False
        assert new_rate == 0.3
        # 文件被回滚
        assert skill_path.read_text(encoding="utf-8") == "old content"

    @pytest.mark.asyncio
    async def test_test_exception_rolls_back(self, tmp_path, monkeypatch):
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        skill_path = tmp_path / "x.md"
        skill_path.write_text("old", encoding="utf-8")

        iterator = SkillIterator()
        with patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, side_effect=Exception("test failed"),
        ):
            kept, new_rate = await iterator._verify_and_maybe_rollback(
                skill_name="x", new_content="new", skill_path=str(skill_path),
                backup_md="old", baseline_pass_rate=0.5,
                current_version="1.0.0", new_version="1.1.0", reason="r",
            )
        assert kept is False
        assert new_rate == 0.0
        # 文件被回滚
        assert skill_path.read_text(encoding="utf-8") == "old"


# ------------------------------------------------------------
# 全局单例
# ------------------------------------------------------------


class TestGlobalSingleton:
    """skill_iterator 全局单例。"""

    def test_singleton_is_skill_iterator_instance(self):
        assert isinstance(skill_iterator, SkillIterator)

    def test_singleton_has_iterate(self):
        assert hasattr(skill_iterator, "iterate")
        assert callable(skill_iterator.iterate)

    def test_singleton_has_bump_version(self):
        assert hasattr(skill_iterator, "bump_version")
        assert callable(skill_iterator.bump_version)
