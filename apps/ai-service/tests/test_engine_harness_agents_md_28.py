# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/agents_md.py 第二十八批测试(对标 Codex agents_md_tests.rs)。

from pathlib import Path

from app.core.agents_md import (
    AGENTS_MD_SEPARATOR,
    DEFAULT_AGENTS_MD_FILENAME,
    DEFAULT_PROJECT_DOC_MAX_BYTES,
    LOCAL_AGENTS_MD_FILENAME,
    collect_agents_md_candidates,
    find_project_root,
    load_project_instructions,
)


def _mk_tree(tmp_path, files: dict[str, str]):
    for rel, content in files.items():
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    return tmp_path


class TestFindProjectRoot:
    def test_git_marker(self, tmp_path):
        _mk_tree(tmp_path, {".git/HEAD": "", "a/b/c.txt": "x"})
        root = find_project_root(tmp_path / "a" / "b")
        assert root == tmp_path

    def test_no_marker_falls_back_to_cwd(self, tmp_path):
        d = tmp_path / "nogit"
        d.mkdir()
        assert find_project_root(d) == d.resolve()

    def test_empty_markers_disable_traversal(self, tmp_path):
        _mk_tree(tmp_path, {".git/HEAD": "", "sub/f": "x"})
        assert find_project_root(tmp_path / "sub", markers=()) == (tmp_path / "sub").resolve()

    def test_custom_markers(self, tmp_path):
        _mk_tree(tmp_path, {"pyproject.toml": "", "src/x.py": ""})
        root = find_project_root(tmp_path / "src", markers=("pyproject.toml",))
        assert root == tmp_path


class TestCollectCandidates:
    def test_root_to_cwd_order_with_override(self, tmp_path):
        _mk_tree(
            tmp_path,
            {
                ".git/HEAD": "",
                "AGENTS.md": "root-doc",
                "packages/app/AGENTS.override.md": "local-doc",
            },
        )
        cwd = tmp_path / "packages" / "app"
        cands = collect_agents_md_candidates(cwd, tmp_path)
        assert [Path(p).name for p in cands] == ["AGENTS.md", "AGENTS.override.md"]

    def test_cwd_outside_root_only_cwd_layer(self, tmp_path):
        # 两个互为兄弟的树:rootA(有 .git + AGENTS.md)与 cwdB(独立)
        root_a = tmp_path / "rootA"
        _mk_tree(root_a, {".git/HEAD": "", "AGENTS.md": "root-doc"})
        cwd_b = tmp_path / "cwdB"
        cwd_b.mkdir()
        cands = collect_agents_md_candidates(cwd_b, root_a)
        assert cands == []  # cwdB 不在 rootA 子树 → 仅看 cwdB 本层(无文档)

    def test_fallback_path_syntax_ignored(self, tmp_path):
        _mk_tree(tmp_path, {".git/HEAD": "", "AGENTS.md": "root-doc"})
        cands = collect_agents_md_candidates(
            tmp_path, tmp_path, fallback_filenames=["docs/AGENTS.md", "../evil.md", "LOCAL.md"]
        )
        assert [Path(p).name for p in cands] == ["AGENTS.md"]

    def test_fallback_used_when_primary_missing(self, tmp_path):
        _mk_tree(tmp_path, {".git/HEAD": "", "GUIDELINES.md": "fb"})
        cands = collect_agents_md_candidates(tmp_path, tmp_path, fallback_filenames=["GUIDELINES.md"])
        assert [Path(p).name for p in cands] == ["GUIDELINES.md"]


class TestLoadProjectInstructions:
    def test_concat_root_to_cwd(self, tmp_path):
        _mk_tree(
            tmp_path,
            {
                ".git/HEAD": "",
                "AGENTS.md": "ROOT",
                "packages/app/AGENTS.override.md": "LOCAL",
            },
        )
        loaded = load_project_instructions(tmp_path / "packages" / "app")
        assert loaded.content == "ROOT\n\nLOCAL"
        assert loaded.files == [
            str(tmp_path / "AGENTS.md"),
            str((tmp_path / "packages" / "app" / "AGENTS.override.md").resolve()),
        ]
        assert not loaded.truncated

    def test_byte_budget_truncates(self, tmp_path):
        _mk_tree(tmp_path, {".git/HEAD": "", "AGENTS.md": "R" * 100, "sub/AGENTS.md": "S" * 100})
        loaded = load_project_instructions(tmp_path / "sub", max_bytes=150)
        assert loaded.content.startswith("R" * 100)
        assert len(loaded.content) < 200
        assert loaded.truncated

    def test_budget_zero_disables(self, tmp_path):
        _mk_tree(tmp_path, {".git/HEAD": "", "AGENTS.md": "ROOT"})
        assert load_project_instructions(tmp_path, max_bytes=0).content == ""

    def test_missing_docs_empty(self, tmp_path):
        _mk_tree(tmp_path, {".git/HEAD": ""})
        loaded = load_project_instructions(tmp_path)
        assert loaded.is_empty()
        assert loaded.files == []

    def test_combine_with_user_instructions(self, tmp_path):
        _mk_tree(tmp_path, {".git/HEAD": "", "AGENTS.md": "PROJ"})
        loaded = load_project_instructions(tmp_path)
        assert loaded.combine_with_user_instructions("USER") == "USER" + AGENTS_MD_SEPARATOR + "PROJ"
        assert loaded.combine_with_user_instructions("") == "PROJ"
        empty = load_project_instructions(tmp_path / ".." / "..", max_bytes=0)
        assert empty.combine_with_user_instructions("ONLY") == "ONLY"

    def test_default_budget_is_32kib(self):
        assert DEFAULT_PROJECT_DOC_MAX_BYTES == 32 * 1024
        assert DEFAULT_AGENTS_MD_FILENAME == "AGENTS.md"
        assert LOCAL_AGENTS_MD_FILENAME == "AGENTS.override.md"
