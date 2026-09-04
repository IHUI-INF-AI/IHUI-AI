# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# 1-7 技能体系标准化:skill_md 解析 + SkillRegistry 增量热加载 + 业务目录审计。
from __future__ import annotations

import os

from app.services.skill_md import (
    parse_skill_md,
    validate_skill_md,
)
from app.services.skills import SkillRegistry

_SKILLS_ROOT = os.path.join(os.path.dirname(__file__), "..", "app", "skills")


# ------------------------------------------------------------
# parse_skill_md:Anthropic 风格 / 宽松风格 / 多行 / 引号 / extra
# ------------------------------------------------------------


class TestParseSkillMd:
    def test_anthropic_style(self):
        content = (
            "---\n"
            "name: my-skill\n"
            "description: 干什么用\n"
            "allowed-tools: [Read, Write]\n"
            "---\n"
            "# Instructions\n\n执行步骤..."
        )
        p = parse_skill_md(content)
        assert p.name == "my-skill"
        assert p.description == "干什么用"
        assert p.instructions == "# Instructions\n\n执行步骤..."
        assert p.extra.get("allowed-tools") == "[Read, Write]"
        assert p.has_frontmatter

    def test_loose_single_line(self):
        content = (
            "---\n"
            "name: loose-skill\n"
            "description: A test skill\n"
            "---\n"
            "Instructions here."
        )
        p = parse_skill_md(content)
        assert p.name == "loose-skill"
        assert p.description == "A test skill"
        assert p.instructions == "Instructions here."

    def test_multiline_description_block_literal(self):
        content = (
            "---\n"
            "name: m\n"
            "description: |\n"
            "  第一行\n"
            "  第二行\n"
            "---\n"
            "body"
        )
        p = parse_skill_md(content)
        assert p.description == "第一行\n第二行"

    def test_multiline_description_block_folded(self):
        content = (
            "---\n"
            "name: m\n"
            "description: >\n"
            "  一行\n"
            "  两行\n"
            "---\n"
            "body"
        )
        p = parse_skill_md(content)
        assert p.description == "一行 两行"

    def test_multiline_description_indented_continuation(self):
        content = (
            "---\n"
            "name: m\n"
            "description: 首行\n"
            "  续行\n"
            "---\n"
            "body"
        )
        p = parse_skill_md(content)
        assert p.description == "首行\n续行"

    def test_quoted_scalar_stripped(self):
        content = (
            "---\n"
            "name: 'content-engine'\n"
            "description: '带:冒号的描述'\n"
            "---\n"
            "body"
        )
        p = parse_skill_md(content)
        assert p.name == "content-engine"
        assert p.description == "带:冒号的描述"

    def test_leading_html_comment_tolerated(self):
        # 业务技能 SKILL.md 顶部带 Provenance HTML 注释,frontmatter 仍可解析
        content = (
            "<!-- copyright -->\n\n"
            "---\n"
            "name: commented-skill\n"
            "description: 有注释前缀\n"
            "---\n"
            "instructions"
        )
        p = parse_skill_md(content)
        assert p.name == "commented-skill"
        assert p.description == "有注释前缀"
        assert p.has_frontmatter

    def test_no_frontmatter_returns_body(self):
        content = "Just plain text without frontmatter."
        p = parse_skill_md(content)
        assert p.name == ""
        assert p.description == ""
        assert p.instructions == content
        assert not p.has_frontmatter

    def test_malformed_no_closing(self):
        content = "---\nname: x\ndescription: y\nbody here"
        p = parse_skill_md(content)
        assert p.name == ""
        assert p.description == ""
        assert p.instructions == content
        assert not p.has_frontmatter

    def test_extra_fields_preserved(self):
        content = (
            "---\n"
            "name: t\n"
            "description: d\n"
            "version: 1.0.0\n"
            "license: MIT\n"
            "metadata:\n"
            "  key: val\n"
            "---\n"
            "body"
        )
        p = parse_skill_md(content)
        assert p.extra.get("version") == "1.0.0"
        assert p.extra.get("license") == "MIT"
        assert "key: val" in p.extra.get("metadata", "")


# ------------------------------------------------------------
# validate_skill_md:缺失字段校验
# ------------------------------------------------------------


class TestValidateSkillMd:
    def test_missing_both(self):
        assert set(validate_skill_md("---\ndescription: x\n---\nbody")) == {"name"}
        assert set(validate_skill_md("---\nname: x\n---\nbody")) == {"description"}
        assert validate_skill_md("---\nname: x\ndescription: y\n---\nbody") == []

    def test_empty_values_missing(self):
        # name 为空视为缺失
        assert "name" in validate_skill_md("---\nname: \ndescription: y\n---\nbody")


# ------------------------------------------------------------
# SkillRegistry 增量热加载
# ------------------------------------------------------------


def _make_registry(tmp_path, monkeypatch):
    monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
    return SkillRegistry()


class TestHotReload:
    def test_new_file_appears(self, tmp_path, monkeypatch):
        r = _make_registry(tmp_path, monkeypatch)
        assert not r.exists("new-skill")
        (tmp_path / "new.md").write_text(
            "---\nname: new-skill\ndescription: v1\n---\ninstructions",
            encoding="utf-8",
        )
        r.reload_auto()
        assert r.exists("new-skill")
        assert r.get("new-skill").description == "v1"

    def test_changed_content_reloads(self, tmp_path, monkeypatch):
        r = _make_registry(tmp_path, monkeypatch)
        path = tmp_path / "upd.md"
        path.write_text(
            "---\nname: upd-skill\ndescription: v1\n---\ninstructions",
            encoding="utf-8",
        )
        r.reload_auto()
        assert r.get("upd-skill").description == "v1"
        # 改写内容并强制 mtime 变化(避免快速写入 mtime 同值)
        path.write_text(
            "---\nname: upd-skill\ndescription: v2\n---\ninstructions",
            encoding="utf-8",
        )
        new_mtime = os.path.getmtime(str(path)) + 1.0
        os.utime(str(path), (new_mtime, new_mtime))
        r.reload_auto()
        assert r.get("upd-skill").description == "v2"

    def test_deleted_file_disappears(self, tmp_path, monkeypatch):
        r = _make_registry(tmp_path, monkeypatch)
        path = tmp_path / "del.md"
        path.write_text(
            "---\nname: del-skill\ndescription: d\n---\ninstructions",
            encoding="utf-8",
        )
        r.reload_auto()
        assert r.exists("del-skill")
        os.remove(str(path))
        r.reload_auto()
        assert not r.exists("del-skill")

    def test_unchanged_file_idempotent(self, tmp_path, monkeypatch):
        r = _make_registry(tmp_path, monkeypatch)
        (tmp_path / "id.md").write_text(
            "---\nname: id-skill\ndescription: d\n---\ninstructions",
            encoding="utf-8",
        )
        r.reload_auto()
        r.reload_auto()
        assert r.exists("id-skill")
        # 无变更仍幂等(内容一致,mtime 不变 → 不重复解析但 last_reload 刷新)
        assert r.last_reload is not None

    def test_source_dirs_diagnostic(self, tmp_path, monkeypatch):
        r = _make_registry(tmp_path, monkeypatch)
        assert r.source_dirs == [str(tmp_path)]


# ------------------------------------------------------------
# 业务技能目录审计(只读,不改写):结论为「均合规(name+description 具备)」
# ------------------------------------------------------------


class TestBusinessSkillAudit:
    def test_koubo_workflow_compliant(self):
        path = os.path.join(_SKILLS_ROOT, "koubo_workflow", "SKILL.md")
        if not os.path.exists(path):
            return
        with open(path, encoding="utf-8") as f:
            content = f.read()
        p = parse_skill_md(content)
        assert p.name == "koubo-workflow"
        assert p.description
        assert validate_skill_md(content) == []

    def test_content_engine_skills_compliant(self):
        root = os.path.join(_SKILLS_ROOT, "content_engine", "skills")
        # 直接遍历 SKILL.md 文件并逐个校验(只读)
        found: list[str] = []
        for dirpath, _dirs, files in os.walk(root):
            for fn in files:
                if fn != "SKILL.md":
                    continue
                path = os.path.join(dirpath, fn)
                with open(path, encoding="utf-8") as f:
                    text = f.read()
                p = parse_skill_md(text)
                found.append(p.name)
                assert p.name and p.description, f"{path} 缺 name/description"
                assert validate_skill_md(text) == [], f"{path} 缺必备字段"
        assert "content-engine" in found
        assert "short-post-skill" in found

    def test_gzh_design_study_is_not_a_skill_dir(self):
        # gzh-design-study 仅含参考资源,无 SKILL.md → 不作为技能登记
        path = os.path.join(
            _SKILLS_ROOT, "content_engine", "skills", "gzh-design-study", "SKILL.md"
        )
        assert not os.path.exists(path)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
