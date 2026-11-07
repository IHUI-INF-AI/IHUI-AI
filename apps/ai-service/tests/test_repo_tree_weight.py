# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""目录权重(Z12 第三格)—— 补的每维都要有真消费方与一条断言。

对照程序 = Trae/qoder mtree 的 `WeightConfig` 十维(取证只到字段名,见 T12 §4 第 88 行);
本格只补**本仓有信号源**的维,惰性的维必须在核算面点名。判据单源 =
`app.services.repo_tree_weight`,本文件零复算(§22c)。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services.repo_tree_render import (
    TreeRow,
    collect_node_facts,
    render_rows,
    render_workspace_tree,
)
from app.services.repo_tree_weight import (
    DEFAULT_WEIGHTS,
    NodeFacts,
    WeightConfig,
    order_rows,
    row_weight,
)

PATHS = [
    "docs/readme.md",
    "services/billing/svc.ts",
    "services/index.ts",
    "app/main.py",
    "assets/logo.png",
]


def _rows(paths: list[str] = PATHS) -> list[TreeRow]:
    from app.services.repo_tree_render import build_rows

    return build_rows(paths)[0]


def _child_before_parent(rows: list[TreeRow]) -> bool:
    seen: set[str] = set()
    for row in rows:
        if row.parent and row.parent not in seen:
            return True
        seen.add(row.path)
    return False


def test_order_rows_none_keeps_lexical_order_for_control() -> None:
    rows = _rows()
    ordered, orphans = order_rows(rows, None)
    assert [r.path for r in ordered] == [r.path for r in rows]
    assert orphans == 0


def test_parent_always_precedes_child_under_weights() -> None:
    """全局按分数摊平会造出假树;带权档必须仍给前序 DFS(这是本仓补的边界)。"""
    ordered, _ = order_rows(_rows(), DEFAULT_WEIGHTS)
    assert not _child_before_parent(ordered), "子行出现在父行之前 ⇒ 树不可解析"


def test_dir_and_file_name_dims_reorder_siblings() -> None:
    """`dirNameWeights` + `fileTypeWeights` + `entryNameWeights` 三维各自真的改变了兄弟序。"""
    cfg = WeightConfig()
    rows = _rows()
    ordered, _ = order_rows(rows, cfg)
    first_dir = next(r for r in ordered if r.is_dir)
    assert first_dir.name in {"services", "app"}, f"重要目录先出,读到 {first_dir.name}"

    # entryName:同目录下 index.ts 必须排在普通 .ts 之前
    svc_rows = [
        TreeRow(depth=1, name="index.ts", path="services/index.ts", is_dir=False, parent="services"),
        TreeRow(depth=1, name="zsvc.ts", path="services/zsvc.ts", is_dir=False, parent="services"),
    ]
    assert row_weight(svc_rows[0], cfg) > row_weight(svc_rows[1], cfg)
    assert [r.path for r in svc_rows] == [r.path for r in order_rows(svc_rows, cfg)[0]]

    # fileType:同目录同深度下 .ts 高于 .md(表内值不同 ⇒ 可归因到这一维)
    pair = [
        TreeRow(depth=1, name="note.md", path="docs/note.md", is_dir=False, parent="docs"),
        TreeRow(depth=1, name="core.ts", path="docs/core.ts", is_dir=False, parent="docs"),
    ]
    assert row_weight(pair[1], cfg) > row_weight(pair[0], cfg)


def test_depth_decay_and_dir_boost_are_monotone() -> None:
    cfg = DEFAULT_WEIGHTS
    shallow = TreeRow(depth=0, name="src", path="src", is_dir=True, parent="")
    deep = TreeRow(depth=3, name="src", path="a/b/c/src", is_dir=True, parent="a/b/c")
    assert row_weight(shallow, cfg) > row_weight(deep, cfg), "depthDecay 必须单调衰减"
    file_row = TreeRow(depth=0, name="src", path="src", is_dir=False, parent="")
    assert row_weight(shallow, cfg) > row_weight(file_row, cfg), "dirBoost 必须让目录在同名同深时靠前"


def test_stat_dims_are_inert_until_signals_are_supplied() -> None:
    """时间/体积维:没有 node_facts 就点名惰性,不得用中性值冒充"判过这一维"。"""
    applied, inert = DEFAULT_WEIGHTS.active_dims(None)
    assert set(inert) == {"timeDecay", "sizeImpact"}
    assert "dirName" in applied and "fileType" in applied and "entryName" in applied

    live = WeightConfig(time_decay_factor=0.02, size_impact_factor=0.015)
    facts = {"a.py": NodeFacts(age_days=3.0, size_bytes=2048)}
    applied2, inert2 = live.active_dims(facts)
    assert inert2 == []
    assert {"timeDecay", "sizeImpact"} <= set(applied2)
    assert row_weight(
        TreeRow(depth=0, name="a.py", path="a.py", is_dir=False, parent=""), live, facts=facts
    ) < row_weight(
        TreeRow(depth=0, name="a.py", path="a.py", is_dir=False, parent=""), live
    ), "有信号源时这两维必须真的改变分数"


def test_collect_node_facts_aggregates_dirs_and_counts_failures(tmp_path: Path) -> None:
    (tmp_path / "services").mkdir()
    (tmp_path / "services" / "a.ts").write_bytes(b"export const a = 1\n")
    facts, failed = collect_node_facts(tmp_path, ["services/a.ts", "services/missing.ts"])
    assert failed == 1, "读不到的那条必须计数,不静默当 0"
    assert facts["services/a.ts"].size_bytes == 19
    assert facts["services"].size_bytes == facts["services/a.ts"].size_bytes
    assert facts["services"].age_days is not None


def test_render_rows_uses_weighted_ranking_and_exposes_dims() -> None:
    out = render_rows(PATHS, max_tokens=500)
    lexical = render_rows(PATHS, max_tokens=500, weights=None)
    assert out.ranking == "weighted" and lexical.ranking == "lexical"
    assert out.text != lexical.text, "加权档与词序档必须给出可观察的差别(正向对照)"
    assert out.to_dict()["dimsApplied"] and out.to_dict()["dimsInert"] == ["timeDecay", "sizeImpact"]
    assert render_rows(PATHS, max_tokens=500).text == out.text, "两次渲染逐字节相同(确定性)"


def test_rendered_tree_stays_parseable_under_budget_cut() -> None:
    """预算削尾(加权档与词序档都测)后仍必须是可解析的树:每行的父级都在骨架里。"""
    for cfg in (DEFAULT_WEIGHTS, None):
        out = render_rows(PATHS, max_tokens=8, weights=cfg)
        stack: list[str] = []
        for line in out.text.splitlines():
            indent = (len(line) - len(line.lstrip())) // 2
            name = line.strip().rstrip("/")
            assert indent <= len(stack), f"{name} 出现在没有父级的深度(假树)"
            del stack[indent:]
            stack.append(name)
        assert out.text == out.text.rstrip("\n"), "骨架末尾不留空行"


def test_workspace_tree_activates_stat_dims_by_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """真消费方:MCP 工具走的 `render_workspace_tree` 在 env 开档时把两维点亮(带 stat 成本)。"""
    (tmp_path / "services").mkdir()
    (tmp_path / "docs").mkdir()
    (tmp_path / "services" / "billing.ts").write_text("export const b = 2\n", encoding="utf-8")
    (tmp_path / "docs" / "note.md").write_text("# note\n", encoding="utf-8")

    monkeypatch.delenv("IHUI_REPO_TREE_STAT_WEIGHTS", raising=False)
    off = render_workspace_tree(tmp_path, max_tokens=400)
    assert {"timeDecay", "sizeImpact"} <= set(off.dims_inert)

    monkeypatch.setenv("IHUI_REPO_TREE_STAT_WEIGHTS", "1")
    on = render_workspace_tree(tmp_path, max_tokens=400)
    assert {"timeDecay", "sizeImpact"} <= set(on.dims_applied)
    assert on.dims_inert == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
