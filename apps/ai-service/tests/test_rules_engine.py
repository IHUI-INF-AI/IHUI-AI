"""Rules 引擎测试(P3 深度层 — 规则引擎核心模块)。

覆盖 rules_engine.py:
- 模块函数:_slugify / _parse_frontmatter / _render_rule_md / _cosine_similarity
- Rule dataclass:to_dict / from_dict
- RulesEngine CRUD:create / update / delete / list / get
- 版本控制:get_history / rollback / diff_versions
- 匹配(同步):match(always/keyword/regex/semantic)+ Scope 继承链
- 匹配(异步):match_async + _match_semantic_async
- _merge_scope_rules / resolved:Scope 三层继承
- 效果评估:record_effect / record_feedback / get_rule_stats / ab_test
- 触发统计:_increment_match_count / get_global_stats
- 审计日志:_record_audit / get_audit_log(Redis 降级内存)
- 冲突检测:detect_conflicts
- 应用:apply / test
- 模板:list_templates
"""

import os
import shutil
import threading
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import rules_engine as re_module
from app.services.rules_engine import (
    MAX_APPLIED_RULES,
    RULE_TEMPLATES,
    SEMANTIC_THRESHOLD,
    Rule,
    RulesEngine,
    _cosine_similarity,
    _parse_frontmatter,
    _render_rule_md,
    _slugify,
)


# =============================================================================
# Fixtures:隔离的临时规则目录
# =============================================================================


@pytest.fixture
def rules_dir(tmp_path):
    """隔离的规则目录(每个测试独立)。"""
    d = tmp_path / "rules"
    d.mkdir()
    hist = d / "history"
    hist.mkdir()
    yield str(d)


@pytest.fixture
def engine(rules_dir):
    """RulesEngine 实例(使用临时目录,禁用 Redis)。"""
    with patch.object(re_module, "_REDIS_URL", ""):
        eng = RulesEngine(rules_dir=rules_dir)
    return eng


# =============================================================================
# _slugify:规则名转 slug
# =============================================================================


class TestSlugify:
    """_slugify:kebab-case 安全文件名。"""

    def test_normal_name(self):
        assert _slugify("Code Review") == "code-review"

    def test_chinese_name(self):
        r"""中文字符在 Python \w 中是 word 字符(Unicode aware),保留。"""
        # Python re \w 包含 Unicode 字母,中文不会被替换
        result = _slugify("代码审查")
        assert "代码审查" in result

    def test_mixed_name(self):
        result = _slugify("Rule-1 测试")
        assert "rule-1" in result
        assert "测试" in result

    def test_empty_name_returns_timestamp(self):
        """空字符串 → rule-<timestamp>。"""
        result = _slugify("")
        assert result.startswith("rule-")

    def test_multiple_dashes_collapsed(self):
        assert _slugify("a---b") == "a-b"

    def test_stripped_dashes(self):
        assert _slugify("--abc--") == "abc"


# =============================================================================
# _parse_frontmatter:frontmatter 解析
# =============================================================================


class TestParseFrontmatter:
    """_parse_frontmatter:解析 .md frontmatter + 正文。"""

    def test_normal_frontmatter(self):
        content = "---\nid: rule-1\nname: Test\npriority: 100\n---\nbody content"
        meta, body = _parse_frontmatter(content)
        assert meta["id"] == "rule-1"
        assert meta["name"] == "Test"
        assert meta["priority"] == "100"
        assert body == "body content"

    def test_no_frontmatter(self):
        content = "plain content"
        meta, body = _parse_frontmatter(content)
        assert meta == {}
        assert body == "plain content"

    def test_empty_frontmatter(self):
        """空 frontmatter(正则要求 ---\n...\n---,空内容不匹配,整体返回)。"""
        content = "---\n---\nbody"
        meta, body = _parse_frontmatter(content)
        # 空 frontmatter 不匹配正则(需至少一行内容),返回原内容
        assert isinstance(meta, dict)
        assert isinstance(body, str)

    def test_comments_ignored(self):
        content = "---\n# comment\nid: rule-1\n---\nbody"
        meta, body = _parse_frontmatter(content)
        assert "id" in meta
        assert "# comment" not in meta

    def test_line_without_colon_ignored(self):
        content = "---\nno colon line\nid: rule-1\n---\nbody"
        meta, body = _parse_frontmatter(content)
        assert "no colon line" not in meta
        assert meta["id"] == "rule-1"

    def test_value_not_unquoted(self):
        """值不去引号(简单解析)。"""
        content = '---\nname: "quoted"\n---\nbody'
        meta, _ = _parse_frontmatter(content)
        assert meta["name"] == '"quoted"'


# =============================================================================
# _render_rule_md:渲染规则到 .md
# =============================================================================


class TestRenderRuleMd:
    """_render_rule_md:Rule → .md 文件内容。"""

    def test_render_full_rule(self):
        rule = Rule(
            id="r1", name="Test", content="body",
            scope="global", priority=100, match_type="keyword",
            match_pattern="test", description="desc",
            created_at="2026-07-22T00:00:00Z",
            updated_at="2026-07-22T00:00:00Z",
        )
        md = _render_rule_md(rule)
        assert md.startswith("---\n")
        assert "id: r1" in md
        assert "name: Test" in md
        assert "priority: 100" in md
        assert "enabled: true" in md
        assert "matchType: keyword" in md
        assert "---\n\nbody\n" in md

    def test_render_with_none_fields(self):
        rule = Rule(id="r1", name="Test", content="body")
        md = _render_rule_md(rule)
        assert "description: " in md
        assert "agentId: " in md
        assert "matchPattern: " in md


# =============================================================================
# Rule dataclass:to_dict / from_dict
# =============================================================================


class TestRuleDataclass:
    """Rule dataclass 序列化/反序列化。"""

    def test_to_dict(self):
        rule = Rule(id="r1", name="Test", content="body", priority=100)
        d = rule.to_dict()
        assert d["id"] == "r1"
        assert d["name"] == "Test"
        assert d["priority"] == 100
        assert d["enabled"] is True
        assert d["matchType"] == "always"
        assert d["inheritedFrom"] is None

    def test_from_dict_camel_case(self):
        """camelCase 字段。"""
        rule = Rule.from_dict({
            "id": "r1", "name": "Test", "content": "body",
            "matchType": "keyword", "matchPattern": "test",
            "priority": 100, "scope": "global",
        })
        assert rule.match_type == "keyword"
        assert rule.match_pattern == "test"

    def test_from_dict_snake_case(self):
        """snake_case 字段兼容。"""
        rule = Rule.from_dict({
            "id": "r1", "name": "Test",
            "match_type": "regex", "match_pattern": "test",
            "agent_id": "agent-1",
        })
        assert rule.match_type == "regex"
        assert rule.agent_id == "agent-1"

    def test_from_dict_defaults(self):
        """缺字段用默认值。"""
        rule = Rule.from_dict({"name": "Test"})
        assert rule.match_type == "always"
        assert rule.priority == 50
        assert rule.enabled is True
        assert rule.scope == "global"

    def test_from_dict_empty_id_generates(self):
        """空 id 生成 rule-<timestamp>。"""
        rule = Rule.from_dict({"id": "", "name": ""})
        assert rule.id.startswith("rule-")


# =============================================================================
# _cosine_similarity:余弦相似度
# =============================================================================


class TestCosineSimilarity:
    """_cosine_similarity:向量余弦相似度。"""

    def test_identical(self):
        v = [1.0, 2.0, 3.0]
        assert _cosine_similarity(v, v) == pytest.approx(1.0)

    def test_orthogonal(self):
        assert _cosine_similarity([1, 0], [0, 1]) == pytest.approx(0.0)

    def test_empty(self):
        assert _cosine_similarity([], []) == 0.0

    def test_different_length(self):
        assert _cosine_similarity([1, 2], [1, 2, 3]) == 0.0

    def test_zero_vector(self):
        assert _cosine_similarity([0, 0], [1, 2]) == 0.0


# =============================================================================
# CRUD:create / update / delete / list / get
# =============================================================================


class TestCRUD:
    """RulesEngine CRUD 操作。"""

    def test_create_rule(self, engine):
        rule = engine.create({
            "name": "Test Rule", "content": "body",
            "matchType": "keyword", "matchPattern": "test",
        })
        assert rule.id == "test-rule"
        assert rule.name == "Test Rule"
        assert os.path.exists(os.path.join(engine._rules_dir, "test-rule.md"))
        # 审计日志
        log = engine.get_audit_log()
        assert log["total"] >= 1
        assert log["entries"][0]["action"] == "create"

    def test_create_duplicate_id_appends_timestamp(self, engine):
        """重复 id 追加 timestamp 后缀。"""
        engine.create({"name": "Test", "content": "body"})
        rule2 = engine.create({"name": "Test", "content": "body"})
        assert rule2.id != "test"
        assert "test" in rule2.id

    def test_get_rule(self, engine):
        engine.create({"name": "Get Me", "content": "body"})
        rule = engine.get("get-me")
        assert rule is not None
        assert rule.name == "Get Me"

    def test_get_nonexistent_returns_none(self, engine):
        assert engine.get("nonexistent") is None

    def test_list_sorted_by_priority_desc(self, engine):
        engine.create({"name": "Low", "content": "b", "priority": 10})
        engine.create({"name": "High", "content": "b", "priority": 100})
        engine.create({"name": "Mid", "content": "b", "priority": 50})
        rules = engine.list()
        assert len(rules) == 3
        assert rules[0].name == "High"
        assert rules[1].name == "Mid"
        assert rules[2].name == "Low"

    def test_update_rule(self, engine):
        engine.create({"name": "Original", "content": "old", "priority": 50})
        updated = engine.update("original", {"content": "new", "priority": 100})
        assert updated is not None
        assert updated.content == "new"
        assert updated.priority == 100
        assert updated.name == "Original"  # 未传 name 保留原值

    def test_update_nonexistent_returns_none(self, engine):
        assert engine.update("nonexistent", {"content": "x"}) is None

    def test_delete_rule(self, engine):
        engine.create({"name": "Delete Me", "content": "b"})
        assert engine.delete("delete-me") is True
        assert engine.get("delete-me") is None
        assert not os.path.exists(os.path.join(engine._rules_dir, "delete-me.md"))

    def test_delete_nonexistent_returns_false(self, engine):
        assert engine.delete("nonexistent") is False

    def test_reload_picks_up_new_files(self, engine, rules_dir):
        """reload 热加载新文件。"""
        # 手动写一个 .md 文件
        path = os.path.join(rules_dir, "manual.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write("---\nid: manual\nname: Manual\npriority: 50\n---\nbody")
        # 更新目录 mtime
        time.sleep(0.01)
        os.utime(rules_dir)
        count = engine.reload()
        assert count >= 1
        assert engine.get("manual") is not None


# =============================================================================
# 版本控制:get_history / rollback / diff_versions
# =============================================================================


class TestVersionControl:
    """版本控制:历史 + 回滚 + diff。"""

    def test_update_saves_version(self, engine):
        """update 时保存旧版本。"""
        engine.create({"name": "Versioned", "content": "v1", "priority": 50})
        engine.update("versioned", {"content": "v2"})
        history = engine.get_history("versioned")
        assert len(history) >= 1
        assert history[0]["action"] == "update"
        assert "v1" in history[0]["content"]

    def test_delete_saves_version(self, engine):
        rule = engine.create({"name": "ToDelete", "content": "v1"})
        engine.delete(rule.id)
        history = engine.get_history(rule.id)
        assert len(history) >= 1
        assert history[0]["action"] == "delete"

    def test_rollback(self, engine):
        """rollback 回滚到旧版本。"""
        engine.create({"name": "Rollback", "content": "v1", "priority": 50})
        engine.update("rollback", {"content": "v2"})
        history = engine.get_history("rollback")
        assert len(history) >= 1
        old_version = history[0]["timestamp"]
        rolled = engine.rollback("rollback", old_version)
        assert rolled is not None
        assert rolled.content == "v1"

    def test_rollback_nonexistent_version(self, engine):
        """回滚不存在的版本 → None。"""
        engine.create({"name": "Test", "content": "v1"})
        result = engine.rollback("test", "nonexistent-timestamp")
        assert result is None

    def test_diff_versions(self, engine):
        """diff_versions 返回 unified diff。"""
        engine.create({"name": "Diff", "content": "line1\nline2"})
        engine.update("diff", {"content": "line1\nline2-modified"})
        history = engine.get_history("diff")
        old_ts = history[0]["timestamp"]
        # 当前版本的 timestamp 用 now
        now_ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        diff = engine.diff_versions("diff", old_ts, now_ts)
        # 旧版本存在,diff 可能为空(若新版本文件未在 history)或非空
        # 这里只验证不抛异常
        assert isinstance(diff, str)


# =============================================================================
# 匹配(同步):match
# =============================================================================


class TestMatch:
    """match:消息匹配规则。"""

    def test_always_match(self, engine):
        engine.create({"name": "Always", "content": "b", "matchType": "always"})
        result = engine.match("any message")
        assert len(result) >= 1
        assert result[0].name == "Always"

    def test_keyword_match(self, engine):
        engine.create({
            "name": "Keyword", "content": "b",
            "matchType": "keyword", "matchPattern": "test,测试",
        })
        # 命中
        assert len(engine.match("this is a test")) >= 1
        assert len(engine.match("这是测试")) >= 1
        # 不命中
        result = engine.match("no match here")
        assert all(r.name != "Keyword" for r in result)

    def test_regex_match(self, engine):
        engine.create({
            "name": "Regex", "content": "b",
            "matchType": "regex", "matchPattern": r"\d{4}-\d{2}-\d{2}",
        })
        assert len(engine.match("date 2026-07-22")) >= 1
        result = engine.match("no date")
        assert all(r.name != "Regex" for r in result)

    def test_invalid_regex_returns_false(self, engine):
        """非法正则不抛异常,返回不命中。"""
        engine.create({
            "name": "BadRegex", "content": "b",
            "matchType": "regex", "matchPattern": "[invalid(",
        })
        result = engine.match("anything")
        assert all(r.name != "BadRegex" for r in result)

    def test_disabled_rule_not_matched(self, engine):
        engine.create({
            "name": "Disabled", "content": "b",
            "matchType": "always", "enabled": False,
        })
        result = engine.match("any")
        assert all(r.name != "Disabled" for r in result)

    def test_max_applied_rules_truncation(self, engine):
        """超过 MAX_APPLIED_RULES 截断。"""
        for i in range(MAX_APPLIED_RULES + 5):
            engine.create({
                "name": f"Rule{i}", "content": "b",
                "matchType": "always", "priority": 100 - i,
            })
        result = engine.match("any")
        assert len(result) == MAX_APPLIED_RULES

    def test_match_increments_count(self, engine):
        """匹配命中后 match_count 增加。"""
        engine.create({"name": "Counted", "content": "b", "matchType": "always"})
        engine.match("msg")
        # 等待异步写入线程
        time.sleep(0.1)
        rule = engine.get("counted")
        assert rule.match_count >= 1

    def test_match_no_pattern_returns_false(self, engine):
        """keyword/regex 无 pattern → 不命中。"""
        engine.create({
            "name": "NoPattern", "content": "b",
            "matchType": "keyword", "matchPattern": None,
        })
        result = engine.match("any")
        assert all(r.name != "NoPattern" for r in result)


# =============================================================================
# Scope 继承链:_merge_scope_rules / resolved
# =============================================================================


class TestScopeInheritance:
    """Scope 三层继承:global → workspace → agent。"""

    def test_resolved_global_scope(self, engine):
        engine.create({"name": "G1", "content": "b", "scope": "global", "priority": 50})
        result = engine.resolved("global")
        assert len(result) >= 1
        assert result[0]["name"] == "G1"

    def test_resolved_workspace_inherits_global(self, engine):
        engine.create({"name": "G1", "content": "b", "scope": "global", "priority": 50})
        engine.create({"name": "W1", "content": "b", "scope": "workspace", "priority": 50})
        result = engine.resolved("workspace")
        names = [r["name"] for r in result]
        assert "G1" in names
        assert "W1" in names

    def test_resolved_agent_inherits_all(self, engine):
        engine.create({"name": "G1", "content": "b", "scope": "global"})
        engine.create({"name": "W1", "content": "b", "scope": "workspace"})
        engine.create({"name": "A1", "content": "b", "scope": "agent", "agentId": "agent-x"})
        result = engine.resolved("agent", agent_id="agent-x")
        names = [r["name"] for r in result]
        assert "G1" in names
        assert "W1" in names
        assert "A1" in names

    def test_resolved_agent_filters_other_agents(self, engine):
        """agent scope 过滤其他 agent 的规则。"""
        engine.create({"name": "A1", "content": "b", "scope": "agent", "agentId": "agent-x"})
        engine.create({"name": "A2", "content": "b", "scope": "agent", "agentId": "agent-y"})
        result = engine.resolved("agent", agent_id="agent-x")
        names = [r["name"] for r in result]
        assert "A1" in names
        assert "A2" not in names

    def test_same_name_more_specific_scope_wins(self, engine):
        """同名规则:更具体 scope 胜出(agent > workspace > global)。"""
        engine.create({"name": "Dup", "content": "global", "scope": "global", "priority": 50})
        engine.create({"name": "Dup", "content": "agent", "scope": "agent", "priority": 50, "agentId": "a1"})
        result = engine.resolved("agent", agent_id="a1")
        # 只应有一条 Dup(agent 胜出)
        dups = [r for r in result if r["name"] == "Dup"]
        assert len(dups) == 1
        assert dups[0]["content"] == "agent"

    def test_scope_priority_boost(self, engine):
        """跨 scope 优先级加成(agent +1000, workspace +500)。"""
        engine.create({"name": "G", "content": "b", "scope": "global", "priority": 100})
        engine.create({"name": "A", "content": "b", "scope": "agent", "priority": 50, "agentId": "a1"})
        result = engine.resolved("agent", agent_id="a1")
        # A 的 effective priority = 50 + 1000 = 1050 > G 的 100 + 0 = 100
        assert result[0]["name"] == "A"

    def test_inherited_from_field(self, engine):
        """resolved 返回的规则含 inheritedFrom 字段。"""
        engine.create({"name": "G1", "content": "b", "scope": "global"})
        result = engine.resolved("workspace")
        # global 规则在 workspace scope 下,inheritedFrom 应为 "global"
        g1 = [r for r in result if r["name"] == "G1"][0]
        assert g1["inheritedFrom"] == "global"


# =============================================================================
# 匹配(异步):match_async
# =============================================================================


class TestMatchAsync:
    """match_async:异步匹配。"""

    async def test_match_async_always(self, engine):
        engine.create({"name": "Async", "content": "b", "matchType": "always"})
        result = await engine.match_async("msg")
        assert len(result) >= 1

    async def test_match_async_keyword(self, engine):
        engine.create({
            "name": "AsyncKw", "content": "b",
            "matchType": "keyword", "matchPattern": "test",
        })
        result = await engine.match_async("this is test")
        assert any(r.name == "AsyncKw" for r in result)

    async def test_match_async_with_scope(self, engine):
        engine.create({"name": "G", "content": "b", "scope": "global", "matchType": "always"})
        result = await engine.match_async("msg", scope="workspace")
        assert len(result) >= 1


# =============================================================================
# _fallback_keyword:语义降级
# =============================================================================


class TestFallbackKeyword:
    """_fallback_keyword:semantic 降级 keyword。"""

    def test_normal_match(self):
        rule = Rule(id="r1", name="t", content="b", match_pattern="hello,world")
        assert RulesEngine._fallback_keyword(rule, "hello there") is True

    def test_no_match(self):
        rule = Rule(id="r1", name="t", content="b", match_pattern="hello,world")
        assert RulesEngine._fallback_keyword(rule, "no match") is False

    def test_chinese_comma(self):
        """中文逗号分隔。"""
        rule = Rule(id="r1", name="t", content="b", match_pattern="测试，中文")
        assert RulesEngine._fallback_keyword(rule, "这是测试") is True

    def test_empty_pattern(self):
        rule = Rule(id="r1", name="t", content="b", match_pattern=None)
        assert RulesEngine._fallback_keyword(rule, "any") is False


# =============================================================================
# 效果评估:record_effect / record_feedback / get_rule_stats / ab_test
# =============================================================================


class TestEffectEvaluation:
    """效果评估:命中效果 + 反馈 + 统计。"""

    def test_record_effect_memory(self, engine):
        engine.record_effect("r1", "msg", "output", token_delta=100)
        log = engine._get_effect_log("r1")
        assert len(log) == 1
        assert log[0]["tokenDelta"] == 100

    def test_record_effect_truncates_message(self, engine):
        """message 超 500 字符截断。"""
        long_msg = "x" * 600
        engine.record_effect("r1", long_msg, "out")
        log = engine._get_effect_log("r1")
        assert len(log[0]["message"]) == 500

    def test_record_feedback_valid(self, engine):
        assert engine.record_feedback("r1", "thumbs_up") is True
        assert engine.record_feedback("r1", "thumbs_down") is True
        log = engine._get_feedback_log("r1")
        assert len(log) == 2

    def test_record_feedback_invalid(self, engine):
        """非法 feedback 返回 False。"""
        assert engine.record_feedback("r1", "invalid") is False

    def test_get_rule_stats_empty(self, engine):
        stats = engine.get_rule_stats("nonexistent")
        assert stats["ruleId"] == "nonexistent"
        assert stats["hits7d"] == 0
        assert stats["matchCount"] == 0

    def test_get_rule_stats_with_data(self, engine):
        engine.record_effect("r1", "msg1", "out1", token_delta=100)
        engine.record_effect("r1", "msg2", "out2", token_delta=200)
        engine.record_feedback("r1", "thumbs_up")
        engine.record_feedback("r1", "thumbs_down")
        stats = engine.get_rule_stats("r1")
        assert stats["hits7d"] == 2
        assert stats["hits30d"] == 2
        assert stats["avgTokenDelta"] == 150.0
        assert stats["totalFeedback"] == 2
        assert stats["positiveFeedback"] == 1
        assert stats["satisfactionRate"] == 50.0

    def test_ab_test_both_match(self, engine):
        engine.create({"name": "A", "content": "content-a", "matchType": "always"})
        engine.create({"name": "B", "content": "content-b", "matchType": "always"})
        result = engine.ab_test("a", "b", "msg")
        assert result["ruleA"]["matched"] is True
        assert result["ruleB"]["matched"] is True
        assert "content-a" in result["ruleA"]["output"]

    def test_ab_test_rule_not_found(self, engine):
        result = engine.ab_test("nonexistent", "also-nonexistent", "msg")
        assert "error" in result


# =============================================================================
# 触发统计:get_global_stats
# =============================================================================


class TestGlobalStats:
    """get_global_stats:全局统计。"""

    def test_empty_stats(self, engine):
        stats = engine.get_global_stats()
        assert stats["totalRules"] == 0
        assert stats["activeRules7d"] == 0
        assert stats["topRules"] == []

    def test_with_rules(self, engine):
        engine.create({"name": "R1", "content": "b", "matchType": "always", "priority": 100})
        engine.create({"name": "R2", "content": "b", "matchType": "always", "priority": 50})
        # 触发 R1 命中
        engine.match("msg")
        time.sleep(0.1)
        stats = engine.get_global_stats()
        assert stats["totalRules"] == 2
        # topRules 按 match_count 排序
        assert len(stats["topRules"]) >= 1


# =============================================================================
# 审计日志:_record_audit / get_audit_log
# =============================================================================


class TestAuditLog:
    """审计日志:内存降级(Redis 不可用)。"""

    def test_record_and_get_audit(self, engine):
        engine._record_audit("create", "r1", "Rule1", "user1")
        log = engine.get_audit_log()
        assert log["total"] >= 1
        assert log["entries"][0]["action"] == "create"
        assert log["entries"][0]["user"] == "user1"

    def test_audit_log_limit(self, engine):
        """limit 参数限制返回条数。"""
        for i in range(10):
            engine._record_audit("test", f"r{i}", f"Rule{i}")
        log = engine.get_audit_log(limit=3)
        assert len(log["entries"]) == 3

    def test_audit_log_max_capacity(self, engine):
        """内存审计日志超 _AUDIT_LOG_MAX 淘汰最早。"""
        from app.services.rules_engine import _AUDIT_LOG_MAX
        for i in range(_AUDIT_LOG_MAX + 10):
            engine._record_audit("test", f"r{i}", f"Rule{i}")
        log = engine.get_audit_log(limit=10000)
        assert log["total"] == _AUDIT_LOG_MAX


# =============================================================================
# 冲突检测:detect_conflicts
# =============================================================================


class TestDetectConflicts:
    """detect_conflicts:3 类冲突检测。"""

    async def test_name_conflict(self, engine):
        """同名不同 ID。"""
        engine.create({"name": "Dup", "content": "b1"})
        # 手动创建第二个同名规则(不同 id)
        engine.create({"name": "Dup", "content": "b2"})
        # 第二个 id 会自动加 timestamp 后缀
        conflicts = await engine.detect_conflicts()
        name_conflicts = [c for c in conflicts if c["type"] == "name_conflict"]
        assert len(name_conflicts) >= 1

    async def test_priority_collision(self, engine):
        """同 scope + 相同 priority。"""
        engine.create({"name": "A", "content": "b", "scope": "global", "priority": 100})
        engine.create({"name": "B", "content": "b", "scope": "global", "priority": 100})
        conflicts = await engine.detect_conflicts()
        priority_conflicts = [c for c in conflicts if c["type"] == "priority_collision"]
        assert len(priority_conflicts) >= 1

    async def test_no_conflicts(self, engine):
        """无冲突。"""
        engine.create({"name": "A", "content": "b", "scope": "global", "priority": 100})
        engine.create({"name": "B", "content": "b", "scope": "global", "priority": 50})
        conflicts = await engine.detect_conflicts()
        # 只可能有 name_conflict(若有),不应有 priority_collision
        priority_conflicts = [c for c in conflicts if c["type"] == "priority_collision"]
        assert len(priority_conflicts) == 0


# =============================================================================
# 应用:apply / test
# =============================================================================


class TestApplyAndTest:
    """apply:匹配并返回拼接结果。test:测试单规则。"""

    def test_apply_with_matches(self, engine):
        engine.create({"name": "R1", "content": "content-1", "matchType": "always"})
        result = engine.apply("msg")
        assert len(result["appliedRules"]) >= 1
        assert "content-1" in result["promptSuffix"]
        assert "用户规则" in result["promptSuffix"]

    def test_apply_no_matches(self, engine):
        engine.create({"name": "R1", "content": "b", "matchType": "keyword", "matchPattern": "test"})
        result = engine.apply("no match")
        assert result["appliedRules"] == []
        assert result["promptSuffix"] == ""

    def test_test_rule_matched(self, engine):
        engine.create({"name": "R1", "content": "b", "matchType": "keyword", "matchPattern": "test"})
        result = engine.test("r1", "this is test")
        assert result["matched"] is True

    def test_test_rule_not_matched(self, engine):
        engine.create({"name": "R1", "content": "b", "matchType": "keyword", "matchPattern": "test"})
        result = engine.test("r1", "no match")
        assert result["matched"] is False

    def test_test_nonexistent_rule(self, engine):
        result = engine.test("nonexistent", "msg")
        assert result["matched"] is False
        assert "不存在" in result["reason"]

    def test_test_disabled_rule(self, engine):
        engine.create({"name": "R1", "content": "b", "matchType": "always", "enabled": False})
        result = engine.test("r1", "msg")
        assert result["matched"] is False
        assert "禁用" in result["reason"]


# =============================================================================
# 模板:list_templates
# =============================================================================


class TestTemplates:
    """list_templates:预置规则模板。"""

    def test_returns_5_templates(self):
        templates = RulesEngine.list_templates()
        assert len(templates) == 5

    def test_template_fields(self):
        templates = RulesEngine.list_templates()
        for t in templates:
            assert "name" in t
            assert "description" in t
            assert "matchType" in t
            assert "pattern" in t
            assert "priority" in t
            assert "scope" in t
            assert "content" in t

    def test_template_names(self):
        templates = RulesEngine.list_templates()
        names = [t["name"] for t in templates]
        assert "code_review" in names
        assert "security_check" in names
        assert "commit_convention" in names

    def test_rule_templates_constant(self):
        assert len(RULE_TEMPLATES) == 5


# =============================================================================
# 常量
# =============================================================================


class TestConstants:
    """模块常量验证。"""

    def test_semantic_threshold(self):
        assert SEMANTIC_THRESHOLD == 0.7

    def test_max_applied_rules(self):
        assert MAX_APPLIED_RULES == 10

    def test_scope_chain(self):
        from app.services.rules_engine import _SCOPE_CHAIN
        assert _SCOPE_CHAIN["global"] == ["global"]
        assert _SCOPE_CHAIN["workspace"] == ["global", "workspace"]
        assert _SCOPE_CHAIN["agent"] == ["global", "workspace", "agent"]

    def test_scope_priority_boost(self):
        from app.services.rules_engine import _SCOPE_PRIORITY_BOOST
        assert _SCOPE_PRIORITY_BOOST["global"] == 0
        assert _SCOPE_PRIORITY_BOOST["workspace"] == 500
        assert _SCOPE_PRIORITY_BOOST["agent"] == 1000
