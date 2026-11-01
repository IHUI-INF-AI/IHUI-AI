# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""目录级递归前像(rhash)的判据锁 —— 缺口表 #1。

钉住的六条性质:
  ① 前像自底向上、键序无关:同一文件面乱序输入给出逐字节相同的表;
  ② 改动只影响该目录与**全部祖先**,兄弟枝保持未变(整枝比对的全部理由);
  ③ 整枝搬家只报**最浅**那一枝(计数随嵌套深度不膨胀);
  ④ 同一 rhash 两侧各出现多次 ⇒ 整族判 ambiguous、一条都不报 moved(不猜);
  ⑤ 旧档(上一轮无这一维)单独一档:判不出就说判不出,不冒充"全都新增";
  ⑥ 输入形态不合 ⇒ 抛错,绝不静默当空表(§0.3「没判」≠「判过且干净」)。

本件只 import 源模块(§22c:判据只有一份,测试不复制实现)。
"""

from __future__ import annotations

import hashlib

import pytest

from app.services.dir_rhash import (
    DirRHashDiff,
    depth_of,
    diff_dir_rhash,
    dir_rhash_map,
    parent_of,
)


def make_repo() -> dict[str, str]:
    """一棵小夹具树:

    apps/web/a.ts
    apps/web/b.ts
    apps/api/c.ts
    README.md
    """
    return {
        "apps/web/a.ts": "h-a",
        "apps/web/b.ts": "h-b",
        "apps/api/c.ts": "h-c",
        "README.md": "h-r",
    }


# ── ① 前像形态与键序无关 ─────────────────────────────────────────────────


def test_rhash_covers_every_directory_including_root() -> None:
    table = dir_rhash_map(make_repo())
    assert set(table) == {"", "apps", "apps/web", "apps/api"}
    assert all(len(v) == 64 for v in table.values()), "每一枚都必须是 sha256 hex"


def test_rhash_is_order_insensitive() -> None:
    forward = dir_rhash_map(make_repo())
    backward = dir_rhash_map(dict(reversed(list(make_repo().items()))))
    assert forward == backward


def test_root_rhash_changes_when_any_leaf_changes() -> None:
    base = dir_rhash_map(make_repo())
    changed = make_repo()
    changed["apps/api/c.ts"] = "h-c2"
    after = dir_rhash_map(changed)
    assert base[""] != after[""], "任一叶变 ⇒ 根必变(递归聚合的基本性质)"


def test_empty_input_has_only_root() -> None:
    table = dir_rhash_map({})
    assert set(table) == {""}


# ── ② 改动只影响该目录与全部祖先 ──────────────────────────────────────────


def test_change_touches_directory_and_all_ancestors_only() -> None:
    prev = dir_rhash_map(make_repo())
    cur_files = make_repo()
    cur_files["apps/web/a.ts"] = "h-a2"
    cur = dir_rhash_map(cur_files)

    diff = diff_dir_rhash(prev, cur)
    assert prev["apps/web"] != cur["apps/web"]
    assert prev["apps"] != cur["apps"]
    assert prev[""] != cur[""]
    assert prev["apps/api"] == cur["apps/api"], "兄弟枝必须未变"

    assert diff.changed == 3, "apps/web + apps + 根 三层"
    assert diff.unchanged == 1, "apps/api 未变"
    assert diff.added == 0 and diff.removed == 0
    assert diff.moved == {}


# ── ③ 整枝搬家只报最浅一枝 ────────────────────────────────────────────────


def test_moved_branch_reports_topmost_only() -> None:
    prev = dir_rhash_map({"src/pkg/deep/x.ts": "h1", "src/pkg/y.ts": "h2", "other.ts": "h3"})
    cur = dir_rhash_map({"lib/pkg/deep/x.ts": "h1", "lib/pkg/y.ts": "h2", "other.ts": "h3"})
    diff = diff_dir_rhash(prev, cur)

    # 整枝搬家的"最浅一枝"是 src→lib(它整体换了位置),pkg/deep 两级都是它的后代。
    assert diff.moved == {"lib": "src"}
    assert "lib/pkg" not in diff.moved, "祖先已报,后代不再重复计"
    assert "lib/pkg/deep" not in diff.moved


def test_whole_repo_move_reports_root_once() -> None:
    prev = dir_rhash_map({"a/x.ts": "h1"})
    cur = dir_rhash_map({"b/x.ts": "h1"})
    diff = diff_dir_rhash(prev, cur)
    assert diff.moved == {"b": "a"}, "只报被搬走的那一层"


# ── ④ 歧义不猜 ───────────────────────────────────────────────────────────


def test_duplicate_content_dirs_are_ambiguous_not_moved() -> None:
    # 两个目录内容完全相同 ⇒ rhash 相同;搬家配对任意 ⇒ 不许报 moved。
    prev = dir_rhash_map({"one/x.ts": "same", "two/x.ts": "same"})
    cur = dir_rhash_map({"three/x.ts": "same", "four/x.ts": "same"})
    diff = diff_dir_rhash(prev, cur)
    assert diff.moved == {}, "歧义族一条都不许报"
    assert diff.ambiguous >= 1, "歧义必须出声,不许静默当没有"


def test_single_sided_duplicates_still_ambiguous() -> None:
    prev = dir_rhash_map({"one/x.ts": "same", "two/x.ts": "same"})
    cur = dir_rhash_map({"three/x.ts": "same"})
    diff = diff_dir_rhash(prev, cur)
    assert diff.moved == {}
    assert diff.ambiguous >= 1


# ── ⑤ 旧档单独一档 ───────────────────────────────────────────────────────


def test_absent_previous_dimension_is_its_own_state() -> None:
    diff = diff_dir_rhash(None, dir_rhash_map(make_repo()))
    assert isinstance(diff, DirRHashDiff)
    assert diff.prev_present is False
    assert diff.total_cur == 4
    assert diff.unchanged == 0 and diff.changed == 0 and diff.moved == {}
    note = diff.as_note()
    assert "判不出" in note, "旧档必须明确说判不出,而不是给一个 0 让人读成'全都新增'"


def test_removed_directory_is_counted() -> None:
    prev = dir_rhash_map(make_repo())
    cur = dir_rhash_map({"apps/web/a.ts": "h-a"})
    diff = diff_dir_rhash(prev, cur)
    # 根目录仍在(还有 apps),消失的是 apps/api 这一层;README.md 的消失由文件面
    # 差分负责,不在目录维重复计(两维不许互相冒充)。
    assert diff.removed == 1


# ── ⑥ 形态不合必须出声 ───────────────────────────────────────────────────


@pytest.mark.parametrize(
    "bad",
    [
        {"": "h"},
        {"/abs/x.ts": "h"},
        {"trailing/x.ts/": "h"},
        {1: "h"},
        {"x.ts": 1},
    ],
)
def test_malformed_input_raises(bad: dict[object, object]) -> None:
    with pytest.raises(ValueError):
        dir_rhash_map(bad)  # type: ignore[arg-type]


# ── 辅助判据自身 ─────────────────────────────────────────────────────────


def test_depth_and_parent_helpers() -> None:
    assert depth_of("") == 0
    assert depth_of("apps") == 1
    assert depth_of("apps/web") == 2
    assert parent_of("") == ""
    assert parent_of("apps") == ""
    assert parent_of("apps/web") == "apps"


def test_rhash_is_not_the_flat_merkle_root() -> None:
    """维度不同不是缺陷:根 rhash 只聚合直接子项。这条钉住"两者不是同一件东西",
    免得后来者以为可以拿它替换 codebase_indexer 的 `_merkle_root`。"""
    files = make_repo()
    flat = hashlib.sha256(
        "\n".join(f"{p}:{h}" for p, h in sorted(files.items())).encode("utf-8")
    ).hexdigest()
    assert dir_rhash_map(files)[""] != flat
