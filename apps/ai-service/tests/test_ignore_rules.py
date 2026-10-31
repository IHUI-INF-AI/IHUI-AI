# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`ignore_rules` 的行为钉:剪枝语义 + 出处可答 + 读不动要出声。

gitignore 的边角(最后命中者胜、目录被剪后负向规则救不回来、无斜杠模式跨层级)
是最容易被"看着像"地重写错的一格,所以每条都配**正反两档**用例。
"""

from __future__ import annotations

from app.services.ignore_rules import (
    IgnoreSet,
    filter_paths,
    is_ignored,
    load_ignore_set,
    parse_ignore_text,
)


def _set(*chunks: tuple[str, str]) -> IgnoreSet:
    rules = []
    for source, text in chunks:
        rules.extend(parse_ignore_text(text, source))
    return IgnoreSet(rules=rules)


def test_comments_and_blanks_are_not_rules():
    ign = _set((".gitignore", "# 注释\n\n  \n*.log\n"))
    assert len(ign.rules) == 1
    assert ign.rules[0].raw == "*.log"


def test_trailing_space_is_dropped_unless_escaped():
    plain = _set((".gitignore", "junk \n"))
    assert plain.rules[0].regex.match("junk") is not None, "未转义的结尾空格按 gitignore 口径被吃掉"
    escaped = _set((".gitignore", "junk\\ \n"))
    assert escaped.rules[0].regex.match("junk ") is not None, "反斜杠转义的结尾空格是文件名的一部分"
    assert escaped.rules[0].regex.match("junk") is None


def test_dir_rule_prunes_the_whole_subtree():
    ign = _set((".gitignore", "build/\n"))
    assert is_ignored("build", ign, is_dir=True)[0] is True
    assert is_ignored("build/app.js", ign)[0] is True
    assert is_ignored("deep/nested/build/main.o", ign)[0] is True
    assert is_ignored("built/app.js", ign)[0] is False, "前缀同名不许被吃"


def test_bare_pattern_matches_any_depth_while_slashed_pattern_is_anchored():
    ign = _set((".gitignore", "*.log\ndocs/*.md\n"))
    assert is_ignored("a/b/error.log", ign)[0] is True
    assert is_ignored("docs/x.md", ign)[0] is True
    assert is_ignored("apps/docs/x.md", ign)[0] is False, "带斜杠的模式锚定在根,不许跨层级命中"


def test_last_matching_rule_wins_negation_reincludes():
    ign = _set((".gitignore", "*.log\n!keep.log\n"))
    assert is_ignored("keep.log", ign)[0] is False
    assert is_ignored("other.log", ign)[0] is True
    order_swapped = _set((".gitignore", "!keep.log\n*.log\n"))
    assert is_ignored("keep.log", order_swapped)[0] is True, "顺序反过来结论就得反过来(最后命中者胜)"


def test_negation_cannot_rescue_inside_an_ignored_directory():
    ign = _set((".gitignore", "docs/\n!docs/keep.md\n"))
    assert is_ignored("docs/keep.md", ign)[0] is True, "目录先被剪 ⇒ 负向规则结构上救不回来(gitignore 语义)"


def test_double_star_forms():
    ign = _set((".gitignore", "a/**/b\n**/tmp\n"))
    assert is_ignored("a/x/b", ign)[0] is True
    assert is_ignored("a/x/y/b", ign)[0] is True
    assert is_ignored("a/b", ign)[0] is True, "git 口径:**/ 吃零或多层目录,不是至少一层"
    assert is_ignored("a/x/c", ign)[0] is False
    assert is_ignored("deep/tmp", ign)[0] is True
    assert is_ignored("tmp", ign)[0] is True


def test_pruned_entries_carry_which_file_and_line_decided_it():
    ign = _set((".gitignore", "*.log\n"), (".aiignore", "secret/**\n"))
    kept, pruned = filter_paths(["app.log", "secret/key.pem", "src/main.ts"], ign)
    assert kept == ["src/main.ts"]
    reasons = dict(pruned)
    assert reasons["app.log"] == ".gitignore:1"
    assert reasons["secret/key.pem"] == ".aiignore:1", "剪枝必须答得出是哪枚规则文件的哪一行判的"


def test_input_order_preserved_and_backslash_forms_normalized():
    ign = _set((".gitignore", "b/\n"))
    kept, pruned = filter_paths(["z/a.ts", "b", "m/n.ts", "b\\c.ts"], ign)
    assert kept == ["z/a.ts", "m/n.ts"]
    assert [p for p, _ in pruned] == ["b", "b/c.ts"], "Windows 反斜杠形态要归一,且顺序跟着输入"


def test_file_pattern_matches_the_exact_name_only():
    ign = _set((".gitignore", "data\n"))
    assert is_ignored("data", ign, is_dir=True)[0] is False, "无斜杠模式吃同名文件,不吃同名目录本身"
    assert is_ignored("data", ign)[0] is True
    assert is_ignored("data.txt", ign)[0] is False, "模式吃的是「名字等于 data」,不是前缀"


def test_load_from_disk_prunes_build_dirs_and_reports_unreadable(tmp_path):
    (tmp_path / "node_modules" / "pkg").mkdir(parents=True)
    (tmp_path / "node_modules" / "pkg" / ".gitignore").write_text("*\n", encoding="utf-8")
    (tmp_path / ".gitignore").write_text("dist/\n*.min.js\n", encoding="utf-8")
    (tmp_path / ".aiignore").mkdir()  # 目录冒充规则文件 ⇒ 必须点名而不是静默跳过
    ign = load_ignore_set(tmp_path)
    assert is_ignored("dist/x", ign)[0] is True
    assert is_ignored("vendor/a.min.js", ign)[0] is True
    assert is_ignored("node_modules/pkg/index.js", ign)[0] is False, "第三方包里的 .gitignore 不得对本仓生效"
    assert any(".aiignore 是目录" in e for e in ign.errors), "读不动的规则件要出声"


def test_lone_trailing_backslash_in_class_is_taken_literally(tmp_path):
    """真档实测:一枚畸形字符集合把整次骨架装配带崩过(re.error: unterminated character set)。

    修法是"这类写法按字面量处理",而不是猜作者想表达什么;同文件其它规则必须照常生效。
    """
    ign = _set((".gitignore", "weird[bar\\]\nx.txt\n"))
    assert len(ign.rules) == 2, "畸形模式降级成字面量,不该连坐同文件的其它规则"
    assert is_ignored("x.txt", ign)[0] is True
    assert is_ignored("weirdq", ign)[0] is False


def test_uncompilable_pattern_is_named_and_skipped_not_fatal():
    errors: list[str] = []
    rules = parse_ignore_text("bad[z-a]\ngood/\n", ".gitignore", errors=errors)
    assert errors and "无法编译" in errors[0], "编不过的模式必须点名,不能静默当没写过"
    assert [r.raw for r in rules] == ["good/"], "坏模式跳过,好规则照发"
    ign = IgnoreSet(rules=rules, errors=errors)
    assert is_ignored("good/x.ts", ign)[0] is True
    assert is_ignored("badz", ign)[0] is False


def test_rule_budget_is_enforced_and_speaks(tmp_path):
    big = "\n".join(f"junk{i:05d}/" for i in range(6000))
    (tmp_path / ".gitignore").write_text(big, encoding="utf-8")
    ign = load_ignore_set(tmp_path)
    assert len(ign.rules) <= 4000
    assert any("超过上限" in e for e in ign.errors), "截断必须点名,不许装作规则都在"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
