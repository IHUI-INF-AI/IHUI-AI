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
    """list 返回全部 6 个 skill。"""
    skills = skill_registry.list()
    assert len(skills) == 6
    names = {s.name for s in skills}
    assert names == {
        "code-review", "debug-fix", "test-generator",
        "doc-writer", "refactor-helper", "api-designer",
    }


def test_registry_list_returns_copy():
    """list 返回的列表是副本,修改不影响内部状态。"""
    lst = skill_registry.list()
    lst.clear()
    assert len(skill_registry.list()) == 6


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
