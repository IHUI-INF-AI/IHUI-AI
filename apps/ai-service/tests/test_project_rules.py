# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""project_rules 判据测试(Cursor .mdc 规则等价实现,2026-11-24)。"""

from __future__ import annotations

import os
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.core.project_rules import (
    DEFAULT_BUDGET_CHARS,
    RuleLookupError,
    RuleParseError,
    load_always_apply_rules_block,
    load_applicable_rules_block,
    load_project_rules_block,
    match_glob,
    normalize_rel_path,
    parse_frontmatter,
    read_rule_body,
    render_rules_block,
    rule_matches,
    select_rules,
)


@pytest.fixture(autouse=True)
def _isolate_user_rules(monkeypatch: pytest.MonkeyPatch) -> None:
    """默认关掉用户级规则目录:用例要测它时显式打开并指向 tmp。"""
    monkeypatch.setenv("IHUI_USER_RULES_DISABLE", "1")
    monkeypatch.delenv("IHUI_USER_RULES_DIRS", raising=False)


def _write_rule(root: Path, rel: str, text: str, *, folder: str = ".cursor/rules") -> Path:
    path = root / folder / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def _rule_text(
    description: str = "规则",
    globs: str | None = None,
    always: bool = False,
    body: str = "正文",
) -> str:
    lines = ["---", f"description: {description}"]
    if globs is not None:
        lines.append(f"globs: {globs}")
    lines.append(f"alwaysApply: {'true' if always else 'false'}")
    lines.extend(["---", body])
    return "\n".join(lines) + "\n"


def test_parse_basic_frontmatter() -> None:
    meta, body = parse_frontmatter(_rule_text(description="TS 约定", globs="**/*.ts"))
    assert meta.description == "TS 约定"
    assert meta.globs == ("**/*.ts",)
    assert meta.always_apply is False
    assert body == "正文"


def test_parse_block_scalar_description() -> None:
    text = "---\ndescription: >-\n  多行\n  描述\nglobs: src/**\nalwaysApply: false\n---\nBODY\n"
    meta, body = parse_frontmatter(text)
    assert meta.description == "多行 描述"
    assert meta.globs == ("src/**",)
    assert body == "BODY"


def test_parse_globs_inline_list_and_quotes() -> None:
    meta, _ = parse_frontmatter('---\nglobs: ["**/*.ts", \'src/**\']\n---\nBODY\n')
    assert meta.globs == ("**/*.ts", "src/**")


def test_parse_globs_bullet_list() -> None:
    text = "---\nglobs:\n  - **/*.tsx\n  - !**/*.test.tsx\n---\nBODY\n"
    meta, _ = parse_frontmatter(text)
    assert meta.globs == ("**/*.tsx", "!**/*.test.tsx")


def test_parse_invalid_always_apply_rejected() -> None:
    with pytest.raises(RuleParseError) as exc:
        parse_frontmatter("---\nalwaysApply: maybe\n---\nBODY\n")
    assert exc.value.reason == "invalid_alwaysApply"


def test_missing_frontmatter_rejected() -> None:
    with pytest.raises(RuleParseError) as exc:
        parse_frontmatter("# 没有 frontmatter\n")
    assert exc.value.reason == "missing_frontmatter"


def test_unterminated_frontmatter_rejected() -> None:
    with pytest.raises(RuleParseError) as exc:
        parse_frontmatter("---\ndescription: x\n")
    assert exc.value.reason == "frontmatter_unterminated"


def test_glob_star_matches_any_dir() -> None:
    assert match_glob("**/*.ts", "apps/api/src/a.ts")
    assert match_glob("*.ts", "a.ts")
    assert match_glob("*.ts", "deep/a.ts")
    assert not match_glob("*.ts", "a.tsx")


def test_glob_double_star_subtree() -> None:
    assert match_glob("src/**", "src/a/b.ts")
    assert not match_glob("src/**", "other/src/a.ts")


def test_glob_brace_alternation() -> None:
    assert match_glob("**/*.{ts,tsx}", "x/a.tsx")
    assert not match_glob("**/*.{ts,tsx}", "x/a.py")


def test_glob_negation_wins() -> None:
    globs = ("**/*.ts", "!**/*.test.ts")
    assert rule_matches(globs, "a.ts")
    assert not rule_matches(globs, "a.test.ts")
    assert not rule_matches(("!**/*.ts",), "a.ts")


def test_normalize_rel_path_rejects_escape() -> None:
    assert normalize_rel_path("a/b.ts") == "a/b.ts"
    assert normalize_rel_path("./a\\b.ts") == "a/b.ts"
    assert normalize_rel_path("../a.ts") is None
    assert normalize_rel_path("C:/a.ts") is None
    assert normalize_rel_path("/abs/a.ts") is None


def test_always_apply_selected_without_targets(tmp_path: Path) -> None:
    _write_rule(tmp_path, "core.mdc", _rule_text(always=True, body="核心规则"))
    selection = select_rules(tmp_path)
    assert [r.rel_path for r in selection.selected] == [".cursor/rules/core.mdc"]
    assert selection.selected[0].reason == "always"


def test_glob_rule_selected_when_target_matches(tmp_path: Path) -> None:
    _write_rule(tmp_path, "ts.mdc", _rule_text(globs="**/*.ts", body="TS 规则"))
    selection = select_rules(tmp_path, ["apps/web/a.ts"])
    assert [r.rel_path for r in selection.selected] == [".cursor/rules/ts.mdc"]
    assert selection.selected[0].matched_paths == ("apps/web/a.ts",)
    assert selection.selected[0].reason == "glob"


def test_glob_rule_excluded_when_no_target(tmp_path: Path) -> None:
    _write_rule(tmp_path, "ts.mdc", _rule_text(globs="**/*.ts", body="TS 规则"))
    selection = select_rules(tmp_path)
    assert selection.selected == ()
    assert any(r.reason == "no_match" for r in selection.excluded)


def test_budget_exceeded_named(tmp_path: Path) -> None:
    # 渲染成本 = 标题行(路径长度) + 正文;两条各 ~48 字符,预算 60 ⇒ 第一条进、第二条点名。
    _write_rule(tmp_path, "a.mdc", _rule_text(always=True, body="A" * 20))
    _write_rule(tmp_path, "b.mdc", _rule_text(always=True, body="B" * 20))
    selection = select_rules(tmp_path, budget_chars=60)
    assert [r.rel_path for r in selection.selected] == [".cursor/rules/a.mdc"]
    assert any(r.reason == "budget_exceeded" for r in selection.excluded)
    assert selection.truncated is True


def test_duplicate_body_deduped(tmp_path: Path) -> None:
    body = "同一段正文"
    _write_rule(tmp_path, "a.mdc", _rule_text(always=True, body=body), folder=".ihui/rules")
    _write_rule(tmp_path, "a.mdc", _rule_text(always=True, body=body), folder=".cursor/rules")
    selection = select_rules(tmp_path)
    assert len(selection.selected) == 1
    assert selection.selected[0].rel_path == ".ihui/rules/a.mdc"
    assert any(r.reason == "duplicate_body" for r in selection.excluded)


def test_symlink_skipped(tmp_path: Path) -> None:
    real = tmp_path / "outside.mdc"
    real.write_text(_rule_text(always=True), encoding="utf-8")
    link = tmp_path / ".cursor/rules/link.mdc"
    link.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.symlink(real, link)
    except (OSError, NotImplementedError):
        pytest.skip("本机不支持创建符号链接")
    selection = select_rules(tmp_path)
    assert selection.selected == ()
    assert any(r.reason == "symlink_skipped" for r in selection.excluded)


def test_invalid_target_path_excluded(tmp_path: Path) -> None:
    _write_rule(tmp_path, "ts.mdc", _rule_text(globs="**/*.ts", body="x"))
    selection = select_rules(tmp_path, ["../escape.ts"])
    assert any(r.reason == "invalid_target_path" for r in selection.excluded)


def test_empty_body_excluded(tmp_path: Path) -> None:
    _write_rule(tmp_path, "empty.mdc", "---\ndescription: 空\nalwaysApply: true\n---\n  \n")
    selection = select_rules(tmp_path)
    assert selection.selected == ()
    assert any(r.reason == "empty_body" for r in selection.excluded)


def test_body_too_long_excluded(tmp_path: Path) -> None:
    _write_rule(tmp_path, "long.mdc", _rule_text(always=True, body="x" * 2001))
    selection = select_rules(tmp_path)
    assert selection.selected == ()
    assert any(r.reason == "body_too_long" for r in selection.excluded)


def test_render_block_none_when_no_rules(tmp_path: Path) -> None:
    assert load_always_apply_rules_block(tmp_path) is None


def test_render_block_contains_header(tmp_path: Path) -> None:
    _write_rule(tmp_path, "a.mdc", _rule_text(description="A 规则", always=True, body="do A"))
    block = load_always_apply_rules_block(tmp_path)
    assert block is not None
    assert block.startswith("[项目规则]")
    assert "## A 规则 (.cursor/rules/a.mdc)" in block
    assert "do A" in block


def test_ihui_rules_loaded_before_cursor(tmp_path: Path) -> None:
    _write_rule(tmp_path, "a.mdc", _rule_text(always=True, body="自有"), folder=".ihui/rules")
    _write_rule(tmp_path, "b.mdc", _rule_text(always=True, body="兼容"), folder=".cursor/rules")
    selection = select_rules(tmp_path)
    assert [r.rel_path for r in selection.selected] == [
        ".ihui/rules/a.mdc",
        ".cursor/rules/b.mdc",
    ]


def test_applicable_block_with_targets(tmp_path: Path) -> None:
    _write_rule(tmp_path, "py.mdc", _rule_text(globs="**/*.py", body="PY 规则"))
    block = load_applicable_rules_block(tmp_path, ["apps/api/a.py"])
    assert block is not None and "PY 规则" in block
    assert load_applicable_rules_block(tmp_path, ["apps/api/a.ts"]) is None


AGENT_ENGINE_SRC = Path(__file__).resolve().parents[1] / "app" / "services" / "agent_engine.py"
LLM_ROUTER_SRC = Path(__file__).resolve().parents[1] / "app" / "routers" / "llm.py"


def test_llm_auto_context_appends_path_rules() -> None:
    """自动检索命中文件路径时,必须叠加该路径的规则(否则 globs 层没有消费方)。"""
    src = LLM_ROUTER_SRC.read_text(encoding="utf-8")
    assert "from ..core.project_rules import load_applicable_rules_block as _pr_load" in src
    retrieve_at = src.index("_ac_chunks = await _ac_retrieve")
    load_at = src.index("_pr_load(req.workspace_path, _ac_rule_paths)")
    assert retrieve_at < load_at
    assert "_ac_block = f\"{_ac_block}\\n\\n{_ac_rules}\" if _ac_block else _ac_rules" in src


def test_agent_engine_wires_project_rules_after_agents_md() -> None:
    src = AGENT_ENGINE_SRC.read_text(encoding="utf-8")
    assert "def _inject_project_rules(" in src
    assert "load_project_rules_block" in src
    # 顺序判据:AGENTS.md 先注入,项目规则随后(不依赖中间是否有注释行)。
    agents_at = src.index("self._inject_agents_md(thread)")
    rules_at = src.index("self._inject_project_rules(thread)")
    assert agents_at < rules_at


def test_agent_engine_inject_project_rules_zero_when_absent(tmp_path: Path) -> None:
    from app.services.agent_engine import AgentEngine

    thread = SimpleNamespace(workspace=str(tmp_path), messages=[{"role": "system", "content": "BASE"}])
    AgentEngine._inject_project_rules(SimpleNamespace(), thread)
    assert thread.messages[0]["content"] == "BASE"


def test_agent_engine_inject_project_rules_appends(tmp_path: Path) -> None:
    from app.services.agent_engine import AgentEngine

    _write_rule(tmp_path, "a.mdc", _rule_text(description="A", always=True, body="DO A"))
    thread = SimpleNamespace(workspace=str(tmp_path), messages=[{"role": "system", "content": "BASE"}])
    AgentEngine._inject_project_rules(SimpleNamespace(), thread)
    content = thread.messages[0]["content"]
    assert content.startswith("BASE")
    assert "[项目规则]" in content
    assert "DO A" in content


def test_agent_engine_inject_project_rules_kill_switch(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.agent_engine import AgentEngine

    _write_rule(tmp_path, "a.mdc", _rule_text(always=True, body="DO A"))
    monkeypatch.setenv("IHUI_PROJECT_RULES_DISABLE", "1")
    thread = SimpleNamespace(workspace=str(tmp_path), messages=[{"role": "system", "content": "BASE"}])
    AgentEngine._inject_project_rules(SimpleNamespace(), thread)
    assert thread.messages[0]["content"] == "BASE"


def test_default_budget_is_positive() -> None:
    assert DEFAULT_BUDGET_CHARS > 0
    assert render_rules_block(select_rules(Path("/nonexistent"))) is None


def _enable_user_rules(monkeypatch: pytest.MonkeyPatch, directory: Path) -> None:
    monkeypatch.setenv("IHUI_USER_RULES_DISABLE", "0")
    monkeypatch.setenv("IHUI_USER_RULES_DIRS", str(directory))


def _workspace_with_user_root(tmp_path: Path) -> tuple[Path, Path]:
    """用户级规则必须**在工作区之外**,否则就是项目级规则(两个作用域不能混)。"""
    workspace = tmp_path / "repo"
    workspace.mkdir()
    user_dir = tmp_path / "home" / ".cursor" / "rules"
    user_dir.mkdir(parents=True)
    return workspace, user_dir


def test_user_rule_always_applied_with_locator(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    workspace, user_dir = _workspace_with_user_root(tmp_path)
    (user_dir / "global.mdc").write_text(
        _rule_text(description="全局", always=True, body="GLOBAL"), encoding="utf-8"
    )
    _enable_user_rules(monkeypatch, user_dir)
    selection = select_rules(workspace)
    assert [r.rel_path for r in selection.selected] == ["user:.cursor/rules:global.mdc"]
    assert "GLOBAL" in (render_rules_block(selection) or "")


def test_user_rules_disabled_by_switch(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    workspace, user_dir = _workspace_with_user_root(tmp_path)
    (user_dir / "global.mdc").write_text(_rule_text(always=True, body="GLOBAL"), encoding="utf-8")
    _enable_user_rules(monkeypatch, user_dir)
    monkeypatch.setenv("IHUI_USER_RULES_DISABLE", "1")
    assert select_rules(workspace).selected == ()


def test_project_rules_come_before_user_rules(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    workspace, user_dir = _workspace_with_user_root(tmp_path)
    _write_rule(workspace, "p.mdc", _rule_text(always=True, body="PROJECT"), folder=".ihui/rules")
    (user_dir / "u.mdc").write_text(_rule_text(always=True, body="USER"), encoding="utf-8")
    _enable_user_rules(monkeypatch, user_dir)
    selection = select_rules(workspace)
    assert [r.rel_path for r in selection.selected] == [
        ".ihui/rules/p.mdc",
        "user:.cursor/rules:u.mdc",
    ]


def test_user_rule_duplicate_body_deduped_against_project(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace, user_dir = _workspace_with_user_root(tmp_path)
    body = "同一段正文"
    _write_rule(workspace, "p.mdc", _rule_text(always=True, body=body), folder=".ihui/rules")
    (user_dir / "u.mdc").write_text(_rule_text(always=True, body=body), encoding="utf-8")
    _enable_user_rules(monkeypatch, user_dir)
    selection = select_rules(workspace)
    assert [r.rel_path for r in selection.selected] == [".ihui/rules/p.mdc"]
    assert any(r.reason == "duplicate_body" for r in selection.excluded)


def test_agent_requested_rules_go_to_catalog_not_body(tmp_path: Path) -> None:
    _write_rule(tmp_path, "req.mdc", _rule_text(description="请求式", body="REQ-BODY"))
    selection = select_rules(tmp_path)
    assert selection.selected == ()
    assert [r.locator for r in selection.agent_requested] == [".cursor/rules/req.mdc"]
    block = render_rules_block(selection)
    assert block is not None
    assert "[项目规则·可请求]" in block
    assert "请求式" in block
    assert "REQ-BODY" not in block


def test_catalog_budget_exceeded_is_named(tmp_path: Path) -> None:
    _write_rule(tmp_path, "req.mdc", _rule_text(description="请求式", body="REQ"))
    selection = select_rules(tmp_path, budget_chars=10)
    assert selection.agent_requested == ()
    assert any(r.reason == "budget_exceeded" for r in selection.excluded)
    assert selection.truncated is True


def test_load_project_rules_block_includes_catalog_but_always_block_does_not(tmp_path: Path) -> None:
    _write_rule(tmp_path, "req.mdc", _rule_text(description="请求式", body="REQ"))
    assert load_always_apply_rules_block(tmp_path) is None
    block = load_project_rules_block(tmp_path)
    assert block is not None and "请求式" in block


def test_read_rule_body_project(tmp_path: Path) -> None:
    _write_rule(tmp_path, "a.mdc", _rule_text(description="A", body="BODY-A"), folder=".ihui/rules")
    loaded = read_rule_body(tmp_path, ".ihui/rules/a.mdc")
    assert loaded.body == "BODY-A"
    assert loaded.locator == ".ihui/rules/a.mdc"
    assert loaded.scope == "project"


def test_read_rule_body_user_roundtrip(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    workspace, user_dir = _workspace_with_user_root(tmp_path)
    (user_dir / "req.mdc").write_text(
        _rule_text(description="请求式", body="USER-BODY"), encoding="utf-8"
    )
    _enable_user_rules(monkeypatch, user_dir)
    locator = select_rules(workspace).agent_requested[0].locator
    loaded = read_rule_body(workspace, locator)
    assert loaded.body == "USER-BODY"
    assert loaded.scope == "user"
    assert loaded.locator == locator


def test_read_rule_body_rejects_traversal_and_unknown(tmp_path: Path) -> None:
    for locator, code in [
        ("../escape.mdc", "invalid_locator"),
        ("other/a.mdc", "unknown_locator"),
        (".cursor/rules/missing.mdc", "read_error"),
        ("", "missing_locator"),
    ]:
        with pytest.raises(RuleLookupError) as exc:
            read_rule_body(tmp_path, locator)
        assert exc.value.code == code


def test_read_rule_body_rejects_symlink(tmp_path: Path) -> None:
    outside = tmp_path / "outside.mdc"
    outside.write_text(_rule_text(body="OUTSIDE"), encoding="utf-8")
    link = tmp_path / ".cursor" / "rules" / "link.mdc"
    link.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.symlink(outside, link)
    except (OSError, NotImplementedError):
        pytest.skip("本机不支持创建符号链接")
    with pytest.raises(RuleLookupError) as exc:
        read_rule_body(tmp_path, ".cursor/rules/link.mdc")
    assert exc.value.code == "symlink_skipped"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
