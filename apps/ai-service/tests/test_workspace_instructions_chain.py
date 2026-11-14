# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

# 工作区指令链(第七遍对标 DSH dsh-agent-instructions)纯函数测试。

import app.core.agents_md_state as state
from app.core.agents_md import (
    DEFAULT_BASE_INSTRUCTION_FILENAMES,
    DEFAULT_OVERLAY_INSTRUCTION_FILENAMES,
    WORKSPACE_INSTRUCTIONS_CLOSE,
    WORKSPACE_INSTRUCTIONS_OPEN,
    build_workspace_instructions_fragment,
    build_workspace_instructions_removal_fragment,
    load_workspace_instructions,
    workspace_instructions_digest,
)


def _mk(root, files):
    for rel, content in files.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    return root


def test_claude_md_is_recognized(tmp_path):
    ws = _mk(tmp_path / "repo", {".git/HEAD": "", "CLAUDE.md": "C-RULE"})
    got = load_workspace_instructions(ws)
    assert "C-RULE" in got.content
    assert got.files == [str((ws / "CLAUDE.md").resolve())]


def test_user_home_instructions_are_not_read(tmp_path, monkeypatch):
    """§6.3-4:服务端不读用户主目录指令(云端读到的是服务器自己的 home)。"""
    monkeypatch.setenv("IHUI_HOME", str(tmp_path / "home"))
    _mk(tmp_path / "home", {"AGENTS.md": "HOME-RULE"})
    ws = _mk(tmp_path / "repo", {".git/HEAD": "", "AGENTS.md": "PROJECT-RULE"})
    got = load_workspace_instructions(ws)
    assert "HOME-RULE" not in got.content
    assert "PROJECT-RULE" in got.content


def test_identical_content_deduped(tmp_path):
    ws = _mk(
        tmp_path / "repo",
        {".git/HEAD": "", "AGENTS.md": "SAME-RULE", "CLAUDE.md": "SAME-RULE"},
    )
    got = load_workspace_instructions(ws)
    assert got.content.count("SAME-RULE") == 1
    assert len(got.files) == 1


def test_different_candidates_both_loaded(tmp_path):
    ws = _mk(
        tmp_path / "repo",
        {".git/HEAD": "", "AGENTS.md": "A-RULE", "CLAUDE.md": "C-RULE"},
    )
    got = load_workspace_instructions(ws)
    assert "A-RULE" in got.content and "C-RULE" in got.content
    assert got.content.index("A-RULE") < got.content.index("C-RULE")


def test_local_overlay_after_base(tmp_path):
    ws = _mk(
        tmp_path / "repo",
        {".git/HEAD": "", "AGENTS.md": "BASE-RULE", "AGENTS.local.md": "LOCAL-TUNE"},
    )
    got = load_workspace_instructions(ws)
    assert got.content.index("BASE-RULE") < got.content.index("LOCAL-TUNE")


def test_budget_keeps_most_specific(tmp_path):
    ws = _mk(
        tmp_path / "repo",
        {".git/HEAD": "", "AGENTS.md": "R" * 100, "sub/AGENTS.md": "S" * 100},
    )
    got = load_workspace_instructions(ws / "sub", max_bytes=120)
    assert "S" * 100 in got.content
    assert "R" * 100 not in got.content
    assert got.truncated


def test_extra_dirs_discover_nested_after_root(tmp_path):
    ws = _mk(
        tmp_path / "repo",
        {".git/HEAD": "", "AGENTS.md": "ROOT-RULE", "pkg/AGENTS.md": "PKG-RULE"},
    )
    got = load_workspace_instructions(ws, extra_dirs=[str(ws / "pkg")])
    assert got.content.index("ROOT-RULE") < got.content.index("PKG-RULE")


def test_missing_files_empty(tmp_path):
    got = load_workspace_instructions(tmp_path / "repo")
    assert got.is_empty()
    assert got.files == []


def test_zero_budget_disables(tmp_path):
    ws = _mk(tmp_path / "repo", {".git/HEAD": "", "AGENTS.md": "RULE"})
    assert load_workspace_instructions(ws, max_bytes=0).is_empty()


def test_fragment_builders_carry_digest_and_notice():
    text = "RULE-X"
    digest = workspace_instructions_digest(text)
    frag = build_workspace_instructions_fragment(text)
    body = frag["content"]
    assert frag["role"] == "developer"
    assert body.startswith(WORKSPACE_INSTRUCTIONS_OPEN)
    assert f'hash="{digest}"' in body
    assert body.endswith(WORKSPACE_INSTRUCTIONS_CLOSE)

    replaced = build_workspace_instructions_fragment(text, notice=state.REPLACEMENT_NOTICE)
    assert state.REPLACEMENT_NOTICE in replaced["content"]

    removed = build_workspace_instructions_removal_fragment(state.REMOVAL_NOTICE)
    assert state.REMOVAL_NOTICE in removed["content"]
    assert 'hash="removed"' in removed["content"]


def test_default_name_constants():
    assert DEFAULT_BASE_INSTRUCTION_FILENAMES == ("AGENTS.md", "CLAUDE.md")
    assert DEFAULT_OVERLAY_INSTRUCTION_FILENAMES == (
        "AGENTS.local.md",
        "CLAUDE.local.md",
    )
