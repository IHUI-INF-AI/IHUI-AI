# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`repo_tree_render` 的行为钉(逆向复现超越 goal-b47)。

钉的是三件事:①预算是硬的(整段复量后不超);②骨架优先于文件(削预算时先削文件);
③每一次"没装进去"都能在核算面上找到名字。全部纯内存夹具,不碰磁盘、不连库。
"""

from __future__ import annotations

from app.core.context_compaction import estimate_tokens
from app.services import repo_tree_render as rtr
from app.services.repo_tree_render import render_rows, render_workspace_tree

PATHS = [
    "apps/api/src/index.ts",
    "apps/api/src/routes/health.ts",
    "apps/web/app/page.tsx",
    "apps/web/app/settings/page.tsx",
    "packages/shared/src/utils/x.ts",
    "README.md",
]


def test_deterministic_order_same_input_twice():
    a = render_rows(PATHS, max_tokens=4096)
    b = render_rows(list(reversed(PATHS)), max_tokens=4096)
    assert a.text == b.text, "同一棵树两次渲染必须逐字节相同(无序会让提示缓存无谓失效)"
    assert a.tokens == b.tokens


def test_skeleton_shape_and_dir_marker():
    out = render_rows(PATHS, max_tokens=4096)
    lines = out.text.splitlines()
    assert lines[0] == "apps/", "根目录行必须最先出现"
    assert "  api/" in lines and "  web/" in lines, "二级目录必须带一层缩进"
    assert "README.md" in lines, "根级文件也要出现"
    assert out.complete is True and out.drop_reason is None
    assert out.files_shown == len(PATHS)
    assert out.dirs_shown == len([line for line in lines if line.endswith("/")])


def test_budget_is_hard_constraint_measured_on_final_text():
    for budget in (24, 48, 96, 160, 4096):
        out = render_rows(PATHS, max_tokens=budget)
        assert out.tokens <= out.max_tokens, f"预算 {budget} 被突破:{out.tokens}"
        assert out.tokens == (estimate_tokens(out.text) if out.text else 0)


def test_floor_budget_is_visible_instead_of_silent():
    """maxTokens 给得比下限还小 ⇒ 夹到下限并在核算面如实写回夹后的值。"""
    out = render_rows(PATHS, max_tokens=1)
    assert out.max_tokens == rtr.MIN_MAX_TOKENS
    assert out.tokens <= out.max_tokens


def test_tight_budget_trades_files_not_the_whole_skeleton():
    out = render_rows(PATHS, max_tokens=rtr.MIN_MAX_TOKENS)
    assert out.files_dropped > 0, "预算不足时必须削掉文件并点名"
    assert out.files_shown + out.files_dropped <= len(PATHS)
    assert out.dirs_shown >= 1, "削预算时目录骨架必须仍在"
    assert out.drop_reason == "budget"
    assert out.complete is False


def test_scope_excludes_and_accounts_separately_from_budget():
    out = render_rows(PATHS, max_tokens=4096, scope="apps/web")
    assert out.files_shown == 2, f"scope 只该留下 apps/web 两枚文件,实得 {out.files_shown}"
    assert out.files_scoped_out == 4
    assert out.files_dropped == 0, "scope 削掉的不许记进 budget 削掉的格(两回事)"
    assert "scope" in str(out.drop_reason)
    assert out.complete is False


def test_scope_with_zero_matches_yields_empty_not_fabricated_tree():
    out = render_rows(PATHS, max_tokens=4096, scope="docs/nope")
    assert out.text == "" and out.files_shown == 0
    assert out.files_scoped_out == len(PATHS)
    assert out.complete is False, "零命中不许被读成「整仓骨架已就位」"


def test_duplicates_and_empty_entries_collapsed_with_counts():
    dup = PATHS + [PATHS[0], PATHS[1], "", "/", "."]
    out = render_rows(dup, max_tokens=4096)
    assert out.duplicates_collapsed == 2
    assert out.files_shown == len(PATHS), "副本折叠后不得少一份内容行"
    assert any("不可用路径条目" in n for n in out.notes), "坏条目要出声,不得静默丢"


def test_empty_corpus_is_not_confused_with_a_budget_shorn_tree():
    out = render_rows([], max_tokens=128, enumerated=0)
    assert out.text == "" and out.tokens == 0
    assert out.enumerated == 0
    assert out.dirs_dropped == 0 and out.files_dropped == 0
    assert out.complete is True, "空仓(真没有文件)与「被削过的仓」是两回事,前者才叫完整"


def test_enumeration_provenance_is_carried_into_accounting():
    out = render_rows(
        PATHS,
        max_tokens=4096,
        engine="python-walk",
        degraded_reason="rg_missing",
    )
    assert out.engine == "python-walk"
    assert out.degraded_reason == "rg_missing"
    assert "enum-degraded" in str(out.drop_reason), "降级通道必须进 dropReason,不能只住日志"


def test_workspace_enumeration_uses_single_source_and_respects_ignore(tmp_path):
    (tmp_path / "node_modules" / "leftpad").mkdir(parents=True)
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "a.ts").write_text("export const a = 1\n", encoding="utf-8")
    (tmp_path / "node_modules" / "leftpad" / "index.ts").write_text("junk\n", encoding="utf-8")
    (tmp_path / "notes.txt").write_text("not code\n", encoding="utf-8")
    out = render_workspace_tree(tmp_path, max_tokens=512)
    assert "a.ts" in out.text
    assert "leftpad" not in out.text, "忽略目录不得进骨架"
    assert "notes.txt" not in out.text, "白名单外扩展名不得进骨架"
    assert out.engine, "枚举通道必须具名(不得留空冒充判过)"
    assert out.enumerated >= 1


def test_teeth_overcounting_estimator_cannot_produce_a_breaching_render(monkeypatch):
    """变异牙:估算器恒报 1000 ⇒ 一枚目录都装不下,渲染必须空手而归而不是超预算输出。"""

    def fake_estimate(_text: str) -> int:
        return 1000

    monkeypatch.setattr(rtr, "estimate_tokens", fake_estimate)
    out = render_rows(PATHS, max_tokens=64)
    assert out.text == "" and out.files_shown == 0
    assert out.dirs_dropped >= 1, "目录全被削掉时要在 dirsDropped 上点名"
    assert out.complete is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
