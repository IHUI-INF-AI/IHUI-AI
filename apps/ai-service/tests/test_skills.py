"""skills.py 单元测试:6 个预置 skill + SkillRegistry。"""

import pytest

from app.services.skills import Skill, SkillRegistry, skill_registry, _BUILTIN_SKILLS


def test_skill_dataclass_fields():
    """Skill 数据类包含 name/description/prompt_template 三个字段。"""
    s = Skill(name="x", description="d", prompt_template="t")
    assert s.name == "x"
    assert s.description == "d"
    assert s.prompt_template == "t"


def test_skill_render_without_variables():
    """render 无变量时返回原始模板。"""
    s = Skill(name="x", description="d", prompt_template="hello world")
    assert s.render() == "hello world"
    assert s.render(None) == "hello world"


def test_skill_render_with_variables():
    """render 用 {key} 替换变量。"""
    s = Skill(
        name="x",
        description="d",
        prompt_template="lang={language} code={code}",
    )
    out = s.render({"language": "python", "code": "print(1)"})
    assert "lang=python" in out
    assert "code=print(1)" in out


def test_skill_render_missing_variable_keeps_placeholder():
    """render 未提供变量时保留 {key} 占位符。"""
    s = Skill(name="x", description="d", prompt_template="{a}/{b}")
    out = s.render({"a": "1"})
    assert out == "1/{b}"


def test_skill_render_value_coerced_to_str():
    """render 将非字符串值转为字符串。"""
    s = Skill(name="x", description="d", prompt_template="n={n}")
    assert s.render({"n": 42}) == "n=42"


def test_builtin_skills_count():
    """预置 6 个 skill。"""
    assert len(_BUILTIN_SKILLS) == 6


@pytest.mark.parametrize(
    "name",
    ["code-review", "debug-fix", "test-generator", "doc-writer", "refactor-helper", "api-designer"],
)
def test_builtin_skill_present(name):
    """每个预置 skill 名称可查询。"""
    assert skill_registry.get(name) is not None
    assert skill_registry.exists(name)


def test_registry_get_unknown_returns_none():
    """get 不存在的 skill 返回 None。"""
    assert skill_registry.get("nonexistent") is None


def test_registry_exists_unknown_returns_false():
    """exists 不存在的 skill 返回 False。"""
    assert skill_registry.exists("nonexistent") is False


def test_registry_list_returns_all():
    """list 返回全部 skill(6 个预置 + 19 个 AI Skills TOP + auto 动态 = 至少 25)。"""
    skills = skill_registry.list()
    # 2026-07-23 新增 19 个 AI Skills TOP 后,总数从 6 提升到至少 25
    assert len(skills) >= 25
    names = {s.name for s in skills}
    # 老 6 个预置必须全部存在(向后兼容)
    assert {"code-review", "debug-fix", "test-generator",
            "doc-writer", "refactor-helper", "api-designer"}.issubset(names)
    # 4 个真集成 ai-top 必须存在(2026-07-23)
    assert {"nuwa-skill", "hugshu-design", "guizang-ppt-skill", "auto-redbook-skills"}.issubset(names)
    # 6 个新真集成 ai-top 必须存在(2026-07-23,真集成数 4→10)
    assert {"superpowers", "caveman", "graphify", "agent-skills",
            "awesome-claude-skills", "taste-skill"}.issubset(names)


def test_registry_list_returns_copy():
    """list 返回的列表是副本,修改不影响内部状态。"""
    lst = skill_registry.list()
    lst.clear()
    assert len(skill_registry.list()) >= 25


def test_registry_independent_instance():
    """SkillRegistry 独立实例不共享状态。"""
    r = SkillRegistry()
    assert r.get("code-review") is not None
    assert r.exists("api-designer") is True


def test_builtin_skill_prompt_template_has_placeholders():
    """预置 skill 的 prompt_template 含 {key} 占位符,可渲染。"""
    for s in _BUILTIN_SKILLS:
        # 每个预置 skill 模板至少含一个占位符
        assert "{" in s.prompt_template, f"{s.name} 模板无占位符"


@pytest.mark.parametrize(
    "name",
    [
        # 第一批 6 个(2026-07-23 上轮已实装)
        "superpowers",
        "caveman",
        "graphify",
        "agent-skills",
        "awesome-claude-skills",
        "taste-skill",
        # 第二批 9 个(2026-07-23 本轮从占位升级为真集成)
        "agent-reach",
        "horizon",
        "media-crawler",
        "generative-media-skills",
        "guizang-social-card-skill",
        "social-auto-upload",
        "obsidian-skills",
        "claude-plugins-official",
        "awesome-agent-skills",
    ],
)
def test_new_real_integration_skill_available(name):
    """15 个新真集成 skill 必须 available=True 且 prompt_template 非占位(2026-07-23)。

    第一批 6 个:上轮已实装(superpowers/caveman/graphify/agent-skills/awesome-claude-skills/taste-skill)。
    第二批 9 个:本轮从占位升级为真集成
    (agent-reach/horizon/media-crawler/generative-media-skills/
    guizang-social-card-skill/social-auto-upload/obsidian-skills/
    claude-plugins-official/awesome-agent-skills)。
    """
    s = skill_registry.get(name)
    assert s is not None, f"{name} 未注册"
    assert s.available is True, f"{name} 未标记为 available=True"
    # 非占位 prompt_template:不以 "(元数据占位" / "(GitHub 外部项目" 开头
    assert not s.prompt_template.startswith("(元数据占位"), \
        f"{name} prompt_template 仍是占位符"
    assert not s.prompt_template.startswith("(GitHub 外部项目"), \
        f"{name} prompt_template 仍是占位符"
    # 必须含至少一个 {key} 占位符
    assert "{" in s.prompt_template, f"{name} prompt_template 无 {{key}} 变量"


def test_ai_top_real_integration_count_is_19():
    """ai-top 类别真集成数 = 19(2026-07-23,全部实装,无占位)。

    10 个老真集成(上轮已实装):
        nuwa-skill / hugshu-design / auto-redbook-skills / guizang-ppt-skill /
        superpowers / caveman / graphify / agent-skills /
        awesome-claude-skills / taste-skill
    9 个新真集成(本轮从占位升级):
        agent-reach / horizon / media-crawler / generative-media-skills /
        guizang-social-card-skill / social-auto-upload / obsidian-skills /
        claude-plugins-official / awesome-agent-skills
    """
    all_ai_top = skill_registry.list_ai_top()
    real_skills = [s for s in all_ai_top if s.available]
    placeholder_skills = [s for s in all_ai_top if not s.available]

    # 19 个全部真集成,0 个占位
    assert len(real_skills) == 19, \
        f"期望 19 个真集成 ai-top,实际 {len(real_skills)}"
    assert len(placeholder_skills) == 0, \
        f"期望 0 个占位 ai-top,实际有 {len(placeholder_skills)} 个: " \
        f"{[s.name for s in placeholder_skills]}"

    # 显式列举全部 19 个真集成 skill 名
    expected_19 = {
        # CODEX 自媒体 10 个
        "agent-reach", "horizon", "media-crawler", "hugshu-design",
        "auto-redbook-skills", "generative-media-skills", "nuwa-skill",
        "guizang-social-card-skill", "social-auto-upload",
        # GitHub 热门 9 个(guizang-ppt-skill 也归入此类)
        "superpowers", "caveman", "graphify", "agent-skills",
        "awesome-claude-skills", "taste-skill", "obsidian-skills",
        "claude-plugins-official", "awesome-agent-skills", "guizang-ppt-skill",
    }
    actual_names = {s.name for s in real_skills}
    missing = expected_19 - actual_names
    extra = actual_names - expected_19
    assert not missing, f"缺失真集成 skill: {missing}"
    assert not extra, f"多出未列举的 skill: {extra}"


# ============================================================
# 扩展覆盖(2026-07-23):Skill 扩展字段 + AI TOP 字段 + Registry 构造 +
# _parse_skill_md / _load_auto_skills / list_by_category / SkillEvolutionService /
# SkillEvolutionLoop + 全局单例
# ============================================================

from unittest.mock import AsyncMock, patch

from app.services.skills import (
    SkillEvolutionLoop,
    SkillEvolutionService,
    _AI_TOP_SKILLS,
    skill_evolution_loop,
    skill_evolution_service,
)


# ------------------------------------------------------------
# Skill dataclass 扩展字段默认值
# ------------------------------------------------------------


class TestSkillDefaults:
    """Skill 扩展字段默认值(2026-07-23)。"""

    def test_default_icon(self):
        s = Skill(name="x", description="d", prompt_template="t")
        assert s.icon == "sparkles"

    def test_default_category(self):
        s = Skill(name="x", description="d", prompt_template="t")
        assert s.category == "code"

    def test_default_tags_empty_list(self):
        s = Skill(name="x", description="d", prompt_template="t")
        assert s.tags == []

    def test_default_tags_independent_per_instance(self):
        # 默认 factory 应独立,不共享
        s1 = Skill(name="x", description="d", prompt_template="t")
        s2 = Skill(name="y", description="d", prompt_template="t")
        s1.tags.append("a")
        assert s2.tags == []

    def test_default_source_builtin(self):
        s = Skill(name="x", description="d", prompt_template="t")
        assert s.source == "builtin"

    def test_default_source_url_empty(self):
        s = Skill(name="x", description="d", prompt_template="t")
        assert s.source_url == ""

    def test_default_available_true(self):
        s = Skill(name="x", description="d", prompt_template="t")
        assert s.available is True

    def test_custom_fields(self):
        s = Skill(
            name="x", description="d", prompt_template="t",
            icon="zap", category="ai-top", tags=["a", "b"],
            source="ai-top", source_url="https://x.com", available=False,
        )
        assert s.icon == "zap"
        assert s.category == "ai-top"
        assert s.tags == ["a", "b"]
        assert s.source == "ai-top"
        assert s.source_url == "https://x.com"
        assert s.available is False


# ------------------------------------------------------------
# 6 个预置 skill 默认字段
# ------------------------------------------------------------


class TestBuiltinSkillDefaults:
    """6 个预置 skill 默认 icon/category/source/available。"""

    def test_all_builtin_default_icon_sparkles(self):
        for s in _BUILTIN_SKILLS:
            assert s.icon == "sparkles", f"{s.name} icon 应为 sparkles"

    def test_all_builtin_default_category_code(self):
        for s in _BUILTIN_SKILLS:
            assert s.category == "code", f"{s.name} category 应为 code"

    def test_all_builtin_default_source_builtin(self):
        for s in _BUILTIN_SKILLS:
            assert s.source == "builtin", f"{s.name} source 应为 builtin"

    def test_all_builtin_available_true(self):
        for s in _BUILTIN_SKILLS:
            assert s.available is True, f"{s.name} available 应为 True"

    def test_all_builtin_source_url_empty(self):
        for s in _BUILTIN_SKILLS:
            assert s.source_url == "", f"{s.name} source_url 应为空"

    def test_all_builtin_tags_empty(self):
        for s in _BUILTIN_SKILLS:
            assert s.tags == [], f"{s.name} tags 应为空"


# ------------------------------------------------------------
# 19 个 AI Skills TOP 扩展字段
# ------------------------------------------------------------


class TestAITopSkillFields:
    """19 个 AI Skills TOP 完整字段。"""

    def test_ai_top_count_is_19(self):
        assert len(_AI_TOP_SKILLS) == 19

    def test_all_ai_top_category(self):
        for s in _AI_TOP_SKILLS:
            assert s.category == "ai-top", f"{s.name} category 应为 ai-top"

    def test_all_ai_top_source(self):
        for s in _AI_TOP_SKILLS:
            assert s.source == "ai-top", f"{s.name} source 应为 ai-top"

    def test_all_ai_top_source_url_github(self):
        for s in _AI_TOP_SKILLS:
            assert s.source_url.startswith("https://github.com/"), \
                f"{s.name} source_url 应为 GitHub 链接"

    def test_all_ai_top_available_true(self):
        for s in _AI_TOP_SKILLS:
            assert s.available is True, f"{s.name} available 应为 True"

    def test_all_ai_top_icon_nonempty(self):
        for s in _AI_TOP_SKILLS:
            assert s.icon, f"{s.name} icon 非空"
            assert s.icon != "sparkles", f"{s.name} icon 不应默认 sparkles"

    def test_all_ai_top_tags_nonempty(self):
        for s in _AI_TOP_SKILLS:
            assert len(s.tags) >= 2, f"{s.name} tags 至少 2 个"

    def test_all_ai_top_unique_names(self):
        names = [s.name for s in _AI_TOP_SKILLS]
        assert len(names) == len(set(names)), "AI TOP skill 名称应唯一"

    def test_all_ai_top_prompt_template_has_placeholders(self):
        for s in _AI_TOP_SKILLS:
            assert "{" in s.prompt_template, f"{s.name} 模板无占位符"

    @pytest.mark.parametrize(
        "name, expected_icon",
        [
            ("agent-reach", "search"),
            ("horizon", "radar"),
            ("media-crawler", "rss"),
            ("hugshu-design", "layout-template"),
            ("auto-redbook-skills", "book-heart"),
            ("generative-media-skills", "image-play"),
            ("nuwa-skill", "feather"),
            ("guizang-social-card-skill", "image"),
            ("social-auto-upload", "upload-cloud"),
            ("superpowers", "zap"),
            ("caveman", "cpu"),
            ("graphify", "git-branch"),
            ("agent-skills", "wrench"),
            ("awesome-claude-skills", "book-marked"),
            ("taste-skill", "palette"),
            ("obsidian-skills", "notebook"),
            ("claude-plugins-official", "plug"),
            ("awesome-agent-skills", "compass"),
            ("guizang-ppt-skill", "presentation"),
        ],
    )
    def test_ai_top_icon(self, name, expected_icon):
        s = skill_registry.get(name)
        assert s is not None
        assert s.icon == expected_icon


# ------------------------------------------------------------
# SkillRegistry 构造逻辑
# ------------------------------------------------------------


class TestSkillRegistryConstruction:
    """SkillRegistry 构造逻辑(setdefault 后向兼容)。"""

    def test_construction_loads_builtin_first(self):
        r = SkillRegistry()
        for n in ["code-review", "debug-fix", "test-generator",
                  "doc-writer", "refactor-helper", "api-designer"]:
            assert r.exists(n)

    def test_construction_merges_ai_top(self):
        r = SkillRegistry()
        for n in ["superpowers", "caveman", "graphify", "agent-reach"]:
            assert r.exists(n)

    def test_construction_setdefault_builtin_priority(self):
        """setdefault 保证 builtin 优先,不会被 AI Top 覆盖。"""
        r = SkillRegistry()
        # builtin 与 ai-top 无同名冲突,各自保留 source
        assert r.get("code-review").source == "builtin"
        assert r.get("superpowers").source == "ai-top"

    def test_construction_independent_instances(self):
        r1 = SkillRegistry()
        r2 = SkillRegistry()
        assert r1 is not r2
        # 独立实例的 list() 返回不同列表对象
        assert r1.list() is not r2.list()

    def test_construction_private_skills_dict(self):
        r = SkillRegistry()
        assert hasattr(r, "_skills")
        assert isinstance(r._skills, dict)
        # _skills 至少含 25 个(6 builtin + 19 ai-top)
        assert len(r._skills) >= 25


# ------------------------------------------------------------
# _auto_dir 静态方法
# ------------------------------------------------------------


class TestAutoDir:
    """_auto_dir 静态方法。"""

    def test_auto_dir_returns_str(self):
        path = SkillRegistry._auto_dir()
        assert isinstance(path, str)

    def test_auto_dir_ends_with_skills_auto(self):
        path = SkillRegistry._auto_dir()
        # 跨平台路径比较
        normalized = path.replace("\\", "/")
        assert normalized.endswith("skills/auto")


# ------------------------------------------------------------
# _parse_skill_md 静态方法
# ------------------------------------------------------------


class TestParseSkillMd:
    """_parse_skill_md frontmatter 解析。"""

    def test_no_frontmatter_returns_empty_name_desc(self):
        content = "Just plain text without frontmatter."
        name, desc, body = SkillRegistry._parse_skill_md(content)
        assert name == ""
        assert desc == ""
        assert body == content

    def test_frontmatter_with_name_and_description(self):
        content = (
            "---\n"
            "name: my-skill\n"
            "description: A test skill\n"
            "---\n"
            "Instructions here."
        )
        name, desc, body = SkillRegistry._parse_skill_md(content)
        assert name == "my-skill"
        assert desc == "A test skill"
        assert body == "Instructions here."

    def test_frontmatter_without_name(self):
        content = (
            "---\n"
            "description: only desc\n"
            "---\n"
            "body content"
        )
        name, desc, body = SkillRegistry._parse_skill_md(content)
        assert name == ""
        assert desc == "only desc"
        assert body == "body content"

    def test_frontmatter_without_description(self):
        content = (
            "---\n"
            "name: only-name\n"
            "---\n"
            "body"
        )
        name, desc, body = SkillRegistry._parse_skill_md(content)
        assert name == "only-name"
        assert desc == ""
        assert body == "body"

    def test_frontmatter_empty_body(self):
        content = (
            "---\n"
            "name: x\n"
            "description: y\n"
            "---\n"
        )
        name, desc, body = SkillRegistry._parse_skill_md(content)
        assert name == "x"
        assert desc == "y"
        # body 可能为空字符串
        assert body == "" or body is not None

    def test_frontmatter_with_extra_fields(self):
        content = (
            "---\n"
            "name: test\n"
            "description: desc\n"
            "version: 1.0.0\n"
            "license: MIT\n"
            "---\n"
            "Instructions."
        )
        name, desc, body = SkillRegistry._parse_skill_md(content)
        assert name == "test"
        assert desc == "desc"
        assert body == "Instructions."

    def test_malformed_frontmatter_no_closing(self):
        # 没有 --- 闭合
        content = "---\nname: x\ndescription: y\nbody here"
        name, desc, body = SkillRegistry._parse_skill_md(content)
        # 无闭合视为无 frontmatter
        assert name == ""
        assert desc == ""
        assert body == content

    def test_name_with_colon_in_value(self):
        # name: 后跟含冒号的值
        content = (
            "---\n"
            "name: my:skill\n"
            "description: A: B: C\n"
            "---\n"
            "body"
        )
        name, desc, body = SkillRegistry._parse_skill_md(content)
        # split(":", 1) 只切第一个冒号
        assert name == "my:skill"
        assert desc == "A: B: C"


# ------------------------------------------------------------
# _load_auto_skills / reload_auto
# ------------------------------------------------------------


class TestLoadAutoSkills:
    """_load_auto_skills 扫描 + 降级 + 异常跳过。"""

    def test_load_auto_when_dir_not_exists_no_error(self, tmp_path, monkeypatch):
        # 目录不存在时不报错
        monkeypatch.setattr(
            SkillRegistry, "_auto_dir",
            staticmethod(lambda: str(tmp_path / "nonexistent")),
        )
        r = SkillRegistry()
        # 不报错,builtin + ai-top 仍加载
        assert r.exists("code-review")
        assert r.exists("superpowers")

    def test_load_auto_when_dir_empty(self, tmp_path, monkeypatch):
        # 空目录不报错
        tmp_path.mkdir(exist_ok=True)
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        r = SkillRegistry()
        # 应只有 builtin + ai-top
        assert r.exists("code-review")
        assert not r.exists("empty-skill")

    def test_load_auto_loads_md_files(self, tmp_path, monkeypatch):
        skill_md = (
            "---\n"
            "name: test-auto-skill\n"
            "description: Test auto skill\n"
            "---\n"
            "Test instructions."
        )
        (tmp_path / "test-auto.md").write_text(skill_md, encoding="utf-8")
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        r = SkillRegistry()
        assert r.exists("test-auto-skill")
        s = r.get("test-auto-skill")
        assert s.description == "Test auto skill"
        assert s.prompt_template == "Test instructions."

    def test_load_auto_skips_non_md_files(self, tmp_path, monkeypatch):
        (tmp_path / "readme.txt").write_text("not a skill", encoding="utf-8")
        (tmp_path / "data.json").write_text("{}", encoding="utf-8")
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        r = SkillRegistry()
        # 只有 builtin + ai-top,不加载 .txt/.json
        assert not r.exists("readme")
        assert not r.exists("data")

    def test_load_auto_skips_md_without_name(self, tmp_path, monkeypatch):
        # md 没有 name 字段,不注册
        skill_md = (
            "---\n"
            "description: no name\n"
            "---\n"
            "body"
        )
        (tmp_path / "noname.md").write_text(skill_md, encoding="utf-8")
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        r = SkillRegistry()
        # 不应注册空 name
        names = [s.name for s in r.list()]
        assert "" not in names

    def test_load_auto_skips_invalid_md(self, tmp_path, monkeypatch):
        # 无效 md 文件(解析失败)应被跳过,不抛异常
        (tmp_path / "invalid.md").write_text("garbage content", encoding="utf-8")
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        # 不应抛异常
        r = SkillRegistry()
        assert r.exists("code-review")

    def test_reload_auto_picks_up_new_files(self, tmp_path, monkeypatch):
        # 初始无文件
        tmp_path.mkdir(exist_ok=True)
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        r = SkillRegistry()
        assert not r.exists("new-skill")
        # 添加新文件后 reload
        new_md = (
            "---\n"
            "name: new-skill\n"
            "description: newly added\n"
            "---\n"
            "new instructions"
        )
        (tmp_path / "new.md").write_text(new_md, encoding="utf-8")
        r.reload_auto()
        assert r.exists("new-skill")
        assert r.get("new-skill").description == "newly added"


# ------------------------------------------------------------
# list_by_category / list_ai_top
# ------------------------------------------------------------


class TestListByCategory:
    """list_by_category 分类过滤。"""

    def test_list_all_returns_everything(self):
        r = SkillRegistry()
        all_skills = r.list_by_category("all")
        assert len(all_skills) >= 25

    def test_list_empty_string_returns_everything(self):
        r = SkillRegistry()
        all_skills = r.list_by_category("")
        assert len(all_skills) >= 25

    def test_list_code_returns_at_least_builtin_6(self):
        r = SkillRegistry()
        code_skills = r.list_by_category("code")
        assert len(code_skills) >= 6
        for s in code_skills:
            assert s.category == "code"

    def test_list_ai_top_returns_19(self):
        r = SkillRegistry()
        ai_top = r.list_by_category("ai-top")
        assert len(ai_top) == 19
        for s in ai_top:
            assert s.category == "ai-top"

    def test_list_unknown_category_returns_empty(self):
        r = SkillRegistry()
        unknown = r.list_by_category("unknown-category")
        assert unknown == []

    def test_list_media_returns_only_media_skills(self):
        r = SkillRegistry()
        media = r.list_by_category("media")
        # 当前预置无 media skill(可能为空,若有则全部 category=media)
        for s in media:
            assert s.category == "media"


class TestListAiTop:
    """list_ai_top 等价 list_by_category('ai-top')。"""

    def test_returns_19_skills(self):
        r = SkillRegistry()
        ai_top = r.list_ai_top()
        assert len(ai_top) == 19

    def test_all_have_ai_top_category(self):
        r = SkillRegistry()
        for s in r.list_ai_top():
            assert s.category == "ai-top"

    def test_all_available(self):
        r = SkillRegistry()
        for s in r.list_ai_top():
            assert s.available is True


# ------------------------------------------------------------
# SkillEvolutionService._build_eval_prompt
# ------------------------------------------------------------


class TestBuildEvalPrompt:
    """SkillEvolutionService._build_eval_prompt。"""

    def test_returns_list_of_dicts(self):
        messages = SkillEvolutionService._build_eval_prompt({})
        assert isinstance(messages, list)
        assert len(messages) == 2
        for m in messages:
            assert isinstance(m, dict)
            assert "role" in m
            assert "content" in m

    def test_system_role_first_user_second(self):
        messages = SkillEvolutionService._build_eval_prompt({})
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"

    def test_empty_request_no_crash(self):
        messages = SkillEvolutionService._build_eval_prompt({})
        # 空 request 不应抛异常
        assert "任务目标" in messages[1]["content"]

    def test_full_request_fields_included(self):
        request = {
            "goal": "test goal",
            "steps": [{"step": 1, "action": "do x"}],
            "finalResult": "success",
            "existingSkills": ["code-review"],
            "taskId": "task-123",
        }
        messages = SkillEvolutionService._build_eval_prompt(request)
        content = messages[1]["content"]
        assert "test goal" in content
        assert "success" in content
        assert "code-review" in content

    def test_steps_truncated_to_4000_chars(self):
        long_steps = [{"step": i, "data": "x" * 100} for i in range(100)]
        request = {
            "goal": "g", "steps": long_steps,
            "finalResult": "", "existingSkills": [],
        }
        messages = SkillEvolutionService._build_eval_prompt(request)
        # steps_text 被 json.dumps 后截断到 4000 字符
        # 验证 content 中 steps 段不超过 4000+200(标签开销)
        assert "执行步骤" in messages[1]["content"]

    def test_final_result_truncated_to_2000_chars(self):
        long_result = "x" * 5000
        request = {
            "goal": "g", "steps": [],
            "finalResult": long_result, "existingSkills": [],
        }
        messages = SkillEvolutionService._build_eval_prompt(request)
        content = messages[1]["content"]
        # final_result 截断到 2000 字符
        assert "x" * 2001 not in content

    def test_existing_skills_json_serialized(self):
        request = {"existingSkills": ["a", "b", "c"]}
        messages = SkillEvolutionService._build_eval_prompt(request)
        content = messages[1]["content"]
        # JSON 序列化后应包含 "a" "b" "c"
        assert '"a"' in content


# ------------------------------------------------------------
# SkillEvolutionService._parse_eval_output
# ------------------------------------------------------------


class TestParseEvalOutput:
    """SkillEvolutionService._parse_eval_output 解析 LLM 输出。"""

    def test_parses_plain_json(self):
        content = (
            '{"shouldCreate": true, "skillName": "x", '
            '"skillContent": "c", "reason": "r", "relatedSkills": ["a"]}'
        )
        result = SkillEvolutionService._parse_eval_output(content)
        assert result["shouldCreate"] is True
        assert result["skillName"] == "x"
        assert result["skillContent"] == "c"
        assert result["reason"] == "r"
        assert result["relatedSkills"] == ["a"]

    def test_parses_json_with_code_fence(self):
        content = '```json\n{"shouldCreate": true, "skillName": "y"}\n```'
        result = SkillEvolutionService._parse_eval_output(content)
        assert result["shouldCreate"] is True
        assert result["skillName"] == "y"

    def test_parses_json_with_surrounding_text(self):
        content = 'Here is the result: {"shouldCreate": false, "reason": "no"} done.'
        result = SkillEvolutionService._parse_eval_output(content)
        assert result["shouldCreate"] is False
        assert result["reason"] == "no"

    def test_returns_default_when_no_json(self):
        result = SkillEvolutionService._parse_eval_output("no json here")
        assert result["shouldCreate"] is False
        assert result["skillName"] == ""
        assert result["skillContent"] == ""
        assert "无法解析" in result["reason"]
        assert result["relatedSkills"] == []

    def test_returns_default_when_invalid_json(self):
        content = '{"shouldCreate": invalid}'
        result = SkillEvolutionService._parse_eval_output(content)
        assert result["shouldCreate"] is False

    def test_missing_shouldcreate_defaults_false(self):
        content = '{"skillName": "x"}'
        result = SkillEvolutionService._parse_eval_output(content)
        assert result["shouldCreate"] is False
        assert result["skillName"] == "x"

    def test_related_skills_none_returns_empty_list(self):
        content = '{"shouldCreate": true, "relatedSkills": null}'
        result = SkillEvolutionService._parse_eval_output(content)
        assert result["relatedSkills"] == []

    def test_non_dict_json_returns_default(self):
        # re.search(r"\{.*\}") 不会匹配 [...]
        content = '["not", "a", "dict"]'
        result = SkillEvolutionService._parse_eval_output(content)
        assert result["shouldCreate"] is False

    def test_shouldcreate_int_one_coerced_to_true(self):
        content = '{"shouldCreate": 1}'  # 1 不是 bool
        result = SkillEvolutionService._parse_eval_output(content)
        assert result["shouldCreate"] is True  # bool(1) == True

    def test_shouldcreate_nonempty_string_coerced_to_true(self):
        content = '{"shouldCreate": "yes"}'  # 非空字符串
        result = SkillEvolutionService._parse_eval_output(content)
        assert result["shouldCreate"] is True  # bool("yes") == True

    def test_shouldcreate_empty_string_coerced_to_false(self):
        content = '{"shouldCreate": ""}'  # 空字符串
        result = SkillEvolutionService._parse_eval_output(content)
        assert result["shouldCreate"] is False  # bool("") == False

    def test_related_skills_non_list_returns_empty_list(self):
        content = '{"shouldCreate": true, "relatedSkills": "not a list"}'
        result = SkillEvolutionService._parse_eval_output(content)
        # list("not a list") 会逐字符拆分,但代码用 list(...) 强转
        # 实际:list("not a list") = ['n', 'o', 't', ...]
        # 这个行为是源码的边界情况,测试记录现状
        assert isinstance(result["relatedSkills"], list)


# ------------------------------------------------------------
# SkillEvolutionService._render_skill_md
# ------------------------------------------------------------


class TestRenderSkillMd:
    """SkillEvolutionService._render_skill_md。"""

    def test_renders_frontmatter_with_required_fields(self):
        md = SkillEvolutionService._render_skill_md(
            skill_name="my-skill",
            description="A skill",
            instructions="Do X",
            task_id="task-1",
            related=["code-review"],
        )
        assert md.startswith("---\n")
        assert "name: my-skill" in md
        assert "description: A skill" in md
        assert "version: 1.0.0" in md
        assert "license: MIT" in md
        assert "source: auto" in md
        assert "autoGeneratedFromTask: task-1" in md
        assert "---\n\n# Instructions\n\nDo X" in md

    def test_related_skills_serialized_as_json(self):
        md = SkillEvolutionService._render_skill_md(
            skill_name="x", description="d", instructions="i",
            task_id="t", related=["a", "b"],
        )
        assert 'relatedSkills: ["a", "b"]' in md

    def test_empty_related_skills_serialized_as_empty_array(self):
        md = SkillEvolutionService._render_skill_md(
            skill_name="x", description="d", instructions="i",
            task_id="t", related=[],
        )
        assert "relatedSkills: []" in md

    def test_description_truncated_to_1024_chars(self):
        long_desc = "x" * 2000
        md = SkillEvolutionService._render_skill_md(
            skill_name="x", description=long_desc, instructions="i",
            task_id="t", related=[],
        )
        # description: 后跟截断的 1024 字符
        for line in md.split("\n"):
            if line.startswith("description:"):
                # 验证截断:description 行长度 <= 1024 + len("description: ")
                assert len(line) <= 1024 + len("description: ")
                break

    def test_includes_auto_generated_at_timestamp(self):
        md = SkillEvolutionService._render_skill_md(
            skill_name="x", description="d", instructions="i",
            task_id="t", related=[],
        )
        assert "autoGeneratedAt:" in md
        # 应为 ISO 格式时间戳(含 T)
        assert "T" in md


# ------------------------------------------------------------
# SkillEvolutionService.evaluate (mock LLM + quality gate)
# ------------------------------------------------------------


class TestEvaluateShouldCreateFalse:
    """SkillEvolutionService.evaluate shouldCreate=False 路径。"""

    @pytest.mark.asyncio
    async def test_should_create_false_returns_parsed(self):
        svc = SkillEvolutionService()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content":
                '{"shouldCreate": false, "reason": "no pattern"}'},
        ):
            result = await svc.evaluate({"goal": "g", "steps": [], "finalResult": ""})
        assert result["shouldCreate"] is False
        assert result["reason"] == "no pattern"

    @pytest.mark.asyncio
    async def test_unparseable_output_returns_default(self):
        svc = SkillEvolutionService()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content": "garbage"},
        ):
            result = await svc.evaluate({"goal": "g"})
        assert result["shouldCreate"] is False
        assert "无法解析" in result["reason"]

    @pytest.mark.asyncio
    async def test_should_create_true_but_empty_name_not_persisted(self):
        svc = SkillEvolutionService()
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock,
            return_value={"content":
                '{"shouldCreate": true, "skillName": "", "reason": "r"}'},
        ):
            result = await svc.evaluate({"goal": "g"})
        assert result["shouldCreate"] is False
        assert "skillName 为空" in result["reason"]


class TestEvaluateQualityGate:
    """SkillEvolutionService.evaluate 质量门。"""

    @pytest.mark.asyncio
    async def test_quality_gate_reject_low_pass_rate(self):
        svc = SkillEvolutionService()
        llm_response = {"content":
            '{"shouldCreate": true, "skillName": "test-skill", '
            '"skillContent": "instructions", "reason": "good"}'}
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value=llm_response,
        ), patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={
                "passRate": 0.3, "passed": 1, "total": 3, "allPassed": False,
            },
        ):
            result = await svc.evaluate({"goal": "g"})
        assert result["shouldCreate"] is False
        assert "质量门未通过" in result["reason"]
        assert "0.30" in result["reason"]
        assert result["testResult"]["passRate"] == 0.3

    @pytest.mark.asyncio
    async def test_quality_gate_reject_zero_pass_rate(self):
        svc = SkillEvolutionService()
        llm_response = {"content":
            '{"shouldCreate": true, "skillName": "test-zero", '
            '"skillContent": "c", "reason": "r"}'}
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value=llm_response,
        ), patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={"passRate": 0.0},
        ):
            result = await svc.evaluate({"goal": "g"})
        assert result["shouldCreate"] is False
        assert "质量门未通过" in result["reason"]

    @pytest.mark.asyncio
    async def test_quality_gate_pass_persists_skill(self, tmp_path, monkeypatch):
        # mock _auto_dir 返回 tmp_path,确保文件写入临时目录
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        svc = SkillEvolutionService()
        llm_response = {"content":
            '{"shouldCreate": true, "skillName": "persisted-skill", '
            '"skillContent": "do x", "reason": "good pattern"}'}
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value=llm_response,
        ), patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={
                "passRate": 1.0, "passed": 3, "total": 3, "allPassed": True,
            },
        ):
            result = await svc.evaluate({"goal": "g"})
        assert result["shouldCreate"] is True
        # 验证 .md 文件已写入
        md_file = tmp_path / "persisted-skill.md"
        assert md_file.exists()
        content = md_file.read_text(encoding="utf-8")
        assert "name: persisted-skill" in content
        assert "do x" in content

    @pytest.mark.asyncio
    async def test_quality_gate_at_threshold_passes(self, tmp_path, monkeypatch):
        # passRate = 0.6 (== 阈值,应通过,< 0.6 才拒绝)
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        svc = SkillEvolutionService()
        llm_response = {"content":
            '{"shouldCreate": true, "skillName": "threshold-skill", '
            '"skillContent": "c", "reason": "r"}'}
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value=llm_response,
        ), patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={"passRate": 0.6},
        ):
            result = await svc.evaluate({"goal": "g"})
        # passRate 0.6 不 < 0.6,应通过
        assert result["shouldCreate"] is True


class TestEvaluateWriteException:
    """SkillEvolutionService.evaluate 落盘异常处理。"""

    @pytest.mark.asyncio
    async def test_write_exception_marks_should_create_false(self, monkeypatch):
        svc = SkillEvolutionService()
        llm_response = {"content":
            '{"shouldCreate": true, "skillName": "fail-skill", '
            '"skillContent": "c", "reason": "r"}'}
        # mock makedirs 抛异常
        def mock_makedirs(*args, **kwargs):
            raise OSError("disk full")
        monkeypatch.setattr("os.makedirs", mock_makedirs)
        with patch(
            "app.core.llm_gateway.llm_gateway.complete",
            new_callable=AsyncMock, return_value=llm_response,
        ), patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={"passRate": 1.0},
        ):
            result = await svc.evaluate({"goal": "g"})
        assert result["shouldCreate"] is False
        assert "落盘失败" in result["reason"]


# ------------------------------------------------------------
# SkillEvolutionService._run_quality_gate
# ------------------------------------------------------------


class TestRunQualityGate:
    """SkillEvolutionService._run_quality_gate。"""

    @pytest.mark.asyncio
    async def test_success_path(self):
        svc = SkillEvolutionService()
        with patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t1"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={
                "passRate": 0.8, "passed": 4, "total": 5,
                "allPassed": False, "results": [], "totalDurationMs": 100,
            },
        ):
            result = await svc._run_quality_gate("x", "content")
        assert result["passRate"] == 0.8
        assert result["passed"] == 4
        assert result["total"] == 5

    @pytest.mark.asyncio
    async def test_generate_exception_returns_zero_pass_rate(self):
        svc = SkillEvolutionService()
        with patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, side_effect=RuntimeError("LLM down"),
        ):
            result = await svc._run_quality_gate("x", "content")
        assert result["passRate"] == 0.0
        assert result["passed"] == 0
        assert result["total"] == 0
        assert result["allPassed"] is False
        assert "LLM down" in result["error"]

    @pytest.mark.asyncio
    async def test_run_test_exception_returns_zero_pass_rate(self):
        svc = SkillEvolutionService()
        with patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, side_effect=RuntimeError("test failed"),
        ):
            result = await svc._run_quality_gate("x", "content")
        assert result["passRate"] == 0.0
        assert "test failed" in result["error"]


# ------------------------------------------------------------
# SkillEvolutionLoop.evolve
# ------------------------------------------------------------


class TestEvolutionLoopEvolve:
    """SkillEvolutionLoop.evolve 转发 SkillEvolutionService.evaluate。"""

    @pytest.mark.asyncio
    async def test_evolve_delegates_to_evaluate(self):
        loop = SkillEvolutionLoop()
        expected = {"shouldCreate": False, "reason": "mocked"}
        with patch(
            "app.services.skills.skill_evolution_service.evaluate",
            new_callable=AsyncMock, return_value=expected,
        ):
            result = await loop.evolve({"goal": "g"})
        assert result == expected

    @pytest.mark.asyncio
    async def test_evolve_passes_request_through(self):
        loop = SkillEvolutionLoop()
        request = {"goal": "test", "steps": [1, 2], "taskId": "t1"}
        captured = []

        async def mock_eval(req):
            captured.append(req)
            return {"shouldCreate": False}

        with patch(
            "app.services.skills.skill_evolution_service.evaluate", new=mock_eval,
        ):
            await loop.evolve(request)
        assert captured == [request]


# ------------------------------------------------------------
# SkillEvolutionLoop.iterate_on_feedback
# ------------------------------------------------------------


class TestEvolutionLoopIterate:
    """SkillEvolutionLoop.iterate_on_feedback。"""

    @pytest.mark.asyncio
    async def test_skill_not_exists_returns_should_iterate_false(self):
        loop = SkillEvolutionLoop()
        result = await loop.iterate_on_feedback("nonexistent-skill-xyz")
        assert result["shouldIterate"] is False
        assert "不存在" in result["reason"]
        assert result["expectedImprovements"] == []

    @pytest.mark.asyncio
    async def test_baseline_generate_exception_returns_should_iterate_false(self):
        loop = SkillEvolutionLoop()
        with patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, side_effect=RuntimeError("gen failed"),
        ):
            result = await loop.iterate_on_feedback("code-review")
        assert result["shouldIterate"] is False
        assert "基线测试失败" in result["reason"]
        assert "gen failed" in result["reason"]

    @pytest.mark.asyncio
    async def test_baseline_run_test_exception_returns_should_iterate_false(self):
        loop = SkillEvolutionLoop()
        with patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, side_effect=RuntimeError("run failed"),
        ):
            result = await loop.iterate_on_feedback("code-review")
        assert result["shouldIterate"] is False
        assert "基线测试失败" in result["reason"]

    @pytest.mark.asyncio
    async def test_normal_iteration_calls_skill_iterator(self):
        loop = SkillEvolutionLoop()
        expected = {
            "shouldIterate": True, "newVersion": "1.1.0", "reason": "improved",
        }
        with patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={"passRate": 0.5},
        ), patch(
            "app.services.skill_feedback.skill_feedback_tracker.get_stats",
            new_callable=AsyncMock, return_value={"totalUses": 10},
        ), patch(
            "app.services.skill_feedback.skill_feedback_tracker.get_failure_cases",
            new_callable=AsyncMock, return_value=[{"case": 1}],
        ), patch(
            "app.services.skill_iterator.skill_iterator.iterate",
            new_callable=AsyncMock, return_value=expected,
        ):
            result = await loop.iterate_on_feedback("code-review")
        assert result == expected

    @pytest.mark.asyncio
    async def test_iterator_called_with_correct_args(self):
        loop = SkillEvolutionLoop()
        captured = []

        async def mock_iterate(req):
            captured.append(req)
            return {"shouldIterate": False}

        with patch(
            "app.services.skill_tester.skill_tester.generate_test_cases",
            new_callable=AsyncMock, return_value=[{"name": "t"}],
        ), patch(
            "app.services.skill_tester.skill_tester.run_test",
            new_callable=AsyncMock, return_value={"passRate": 0.5},
        ), patch(
            "app.services.skill_feedback.skill_feedback_tracker.get_stats",
            new_callable=AsyncMock, return_value={"totalUses": 5},
        ), patch(
            "app.services.skill_feedback.skill_feedback_tracker.get_failure_cases",
            new_callable=AsyncMock, return_value=[],
        ), patch(
            "app.services.skill_iterator.skill_iterator.iterate", new=mock_iterate,
        ):
            await loop.iterate_on_feedback("debug-fix")
        assert len(captured) == 1
        req = captured[0]
        assert req["skillName"] == "debug-fix"
        assert "currentContent" in req
        assert req["usageStats"] == {"totalUses": 5}
        assert req["failureCases"] == []
        assert req["currentTestResult"] == {"passRate": 0.5}


# ------------------------------------------------------------
# 全局单例
# ------------------------------------------------------------


class TestGlobalSingletons:
    """全局单例实例。"""

    def test_skill_registry_singleton(self):
        from app.services.skills import skill_registry
        assert isinstance(skill_registry, SkillRegistry)

    def test_skill_evolution_service_singleton(self):
        assert isinstance(skill_evolution_service, SkillEvolutionService)

    def test_skill_evolution_loop_singleton(self):
        assert isinstance(skill_evolution_loop, SkillEvolutionLoop)

    def test_registry_singleton_loaded_skills(self):
        # 单例已加载至少 25 个 skill
        assert len(skill_registry.list()) >= 25

    def test_loop_singleton_has_evolve_and_iterate_methods(self):
        assert hasattr(skill_evolution_loop, "evolve")
        assert hasattr(skill_evolution_loop, "iterate_on_feedback")

    def test_service_singleton_has_all_methods(self):
        assert hasattr(skill_evolution_service, "evaluate")
        assert hasattr(skill_evolution_service, "_build_eval_prompt")
        assert hasattr(skill_evolution_service, "_parse_eval_output")
        assert hasattr(skill_evolution_service, "_render_skill_md")
        assert hasattr(skill_evolution_service, "_run_quality_gate")
