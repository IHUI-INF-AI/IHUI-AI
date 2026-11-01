# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# @ihui-seat S-P85 2026-11-01

"""票 L33565「P85 代码检索改名检测」的逐条判据(S-P85 席位补)。

与既有 `test_rename_detect.py` 的分工:那一份钉原语与主干分支,本份只钉**票面点名
但未被覆盖的四格**——输出形状(`kind`/`distance`/`needsReembed`)、一对一配对(⑤)、
阈值闭区间边界(⑥)、以及两枚变异反向例(⑦)所需的锚点。

近同档的用例优先用**合成指纹**而不是真实文本:真实文本的 64 bit 逐位多数在小文件上
不稳(改名模块常量注释里已实测记过),拿它去钉"距离恰好等于阈值"会变成钉住 blake2b
与 token 切分的偶然产物。合成指纹能把 `distance` 直接摆到边界上。
"""

from __future__ import annotations

from app.services.rename_detect import (
    RENAME_BASIS_HASH,
    RENAME_BASIS_SIMHASH,
    RENAME_MAX_HAMMING,
    compute_simhash,
    detect_renames,
    fingerprint_hex,
    hamming_distance,
)

_BODY = "\n".join(
    f"def handler_{i}(req):\n"
    f"    value = req.get('k{i}')\n"
    f"    return {{'id': {i}, 'value': value}}\n"
    for i in range(30)
)


def _hex(value: int) -> str:
    return fingerprint_hex(value)


def _near_report(
    old_fp: int,
    new_fp: int,
    *,
    old_path: str = "pkg/old.py",
    new_path: str = "pkg/new.py",
    max_hamming: int = RENAME_MAX_HAMMING,
):
    """两枚合成指纹 + 扩名相同 ⇒ 直接走近同档。"""
    return detect_renames(
        {old_path: "h-old"},
        {new_path: "h-new"},
        prev_fingerprints={old_path: _hex(old_fp)},
        cur_fingerprints={new_path: _hex(new_fp)},
        max_hamming=max_hamming,
    )


# ---------------------------------------------------------------------------
# ① 同内容不同路径 ⇒ rename / distance 0 / 不重嵌入
# ---------------------------------------------------------------------------


def test_c1_identical_content_is_rename_with_zero_distance_and_no_reembed():
    report = detect_renames({"pkg/old_util.py": "sha-1"}, {"pkg/new_util.py": "sha-1"})

    assert len(report.renames) == 1, "同 content-hash 必须直接判改名"
    rename = report.renames[0]
    assert rename.kind == "rename"
    assert (rename.old_path, rename.new_path) == ("pkg/old_util.py", "pkg/new_util.py")
    assert rename.distance == 0, "逐字节相同 ⇒ 距离恒为 0"
    assert rename.needs_reembed is False, "内容没变 ⇒ 不得重嵌入"
    assert report.added_only == () and report.removed_only == ()


# ---------------------------------------------------------------------------
# ② 内容微改(加注释) ⇒ rename_candidate / distance 严格小于阈值
# ---------------------------------------------------------------------------


def test_c2_comment_only_edit_is_candidate_with_distance_under_threshold():
    edited = _BODY + "# renamed by the migration script\n"
    measured = hamming_distance(compute_simhash(_BODY), compute_simhash(edited))
    assert measured < RENAME_MAX_HAMMING, f"夹具自身须严格落在阈值内(实测 {measured})"

    report = detect_renames(
        {"a/old.py": "h1"},
        {"b/new.py": "h2"},
        prev_fingerprints={"a/old.py": _hex(compute_simhash(_BODY))},
        cur_fingerprints={"b/new.py": _hex(compute_simhash(edited))},
    )

    assert len(report.renames) == 1
    rename = report.renames[0]
    assert rename.kind == "rename_candidate"
    assert rename.basis == RENAME_BASIS_SIMHASH
    assert rename.distance < RENAME_MAX_HAMMING
    assert rename.needs_reembed is True, "内容变过 ⇒ 候选档不豁免重嵌入"


# ---------------------------------------------------------------------------
# ③④ 反向例:大改 / 不相关 ⇒ 不判改名
# ---------------------------------------------------------------------------


def test_c3_wholly_different_content_is_never_a_rename():
    unrelated = "class CompletelyDifferent:\n    x = [i for i in range(10)]\n"
    measured = hamming_distance(compute_simhash(_BODY), compute_simhash(unrelated))
    assert measured > RENAME_MAX_HAMMING

    report = detect_renames(
        {"a/old.py": "h1"},
        {"b/new.py": "h2"},
        prev_fingerprints={"a/old.py": _hex(compute_simhash(_BODY))},
        cur_fingerprints={"b/new.py": _hex(compute_simhash(unrelated))},
    )

    assert report.renames == (), "内容大改不许被读成改名(会吞掉一次重嵌入)"
    assert report.added_only == ("b/new.py",)
    assert report.removed_only == ("a/old.py",)


def test_c4_far_apart_fingerprints_are_not_paired():
    """两枚不相关指纹(差满位宽-1)在近同档必须落空。"""
    report = _near_report(0, (1 << 63) - 1)

    assert report.renames == ()
    assert report.near_stage == "done", "跳过要分得清:这是「判过了但没有」,不是「没判」"
    assert report.added_only == ("pkg/new.py",) and report.removed_only == ("pkg/old.py",)


# ---------------------------------------------------------------------------
# ⑤ 一对一配对:一对多 / 多对一都只产出一条最优
# ---------------------------------------------------------------------------


def test_c5_one_old_against_two_similar_news_yields_single_best_pair():
    report = detect_renames(
        {"pkg/old.py": "h-old"},
        {"pkg/near.py": "h-near", "pkg/nearest.py": "h-nearest"},
        # old ↔ near 差 3 位,old ↔ nearest 差 1 位
        prev_fingerprints={"pkg/old.py": _hex(0b000)},
        cur_fingerprints={"pkg/near.py": _hex(0b111), "pkg/nearest.py": _hex(0b001)},
    )

    assert len(report.renames) == 1, "一个 old 只能配对一次,不许一对多"
    rename = report.renames[0]
    assert rename.new_path == "pkg/nearest.py", "同等合法时取距离最小的那一枚"
    assert rename.distance == 1
    assert report.added_only == ("pkg/near.py",), "落选的那枚回到 added 桶,不重复映射"


def test_c5_two_olds_against_one_new_yields_single_pair():
    report = detect_renames(
        {"pkg/far.py": "h-far", "pkg/close.py": "h-close"},
        {"pkg/new.py": "h-new"},
        prev_fingerprints={"pkg/far.py": _hex(0b111000), "pkg/close.py": _hex(0b000001)},
        cur_fingerprints={"pkg/new.py": _hex(0b000000)},
    )

    assert len(report.renames) == 1, "多对一也只能产出一条"
    assert report.renames[0].old_path == "pkg/close.py"
    assert report.removed_only == ("pkg/far.py",)


# ---------------------------------------------------------------------------
# ⑥ 阈值边界:闭区间 [0, max_hamming]
# ---------------------------------------------------------------------------


def test_c6_boundary_is_closed_on_the_threshold_side():
    """distance == threshold ⇒ **判**候选(闭区间)。"""
    report = _near_report(0b0000, 0b1111, max_hamming=4)

    assert len(report.renames) == 1, "d == threshold 必须落进候选(判据是 ≤,不是 <)"
    assert report.renames[0].distance == 4
    assert report.renames[0].kind == "rename_candidate"


def test_c6_boundary_is_open_just_past_the_threshold():
    """distance == threshold + 1 ⇒ **不判**候选(开区间)。"""
    report = _near_report(0b00000, 0b11111, max_hamming=4)

    assert report.renames == (), "d == threshold + 1 必须落空"
    assert report.added_only == ("pkg/new.py",)
    assert report.removed_only == ("pkg/old.py",)


def test_c6_default_threshold_is_the_single_constant_not_a_literal():
    """不传 max_hamming 时默认就是 `RENAME_MAX_HAMMING` —— 边界随常量一起移动。"""
    at = _near_report(0, (1 << RENAME_MAX_HAMMING) - 1)
    past = _near_report(0, (1 << (RENAME_MAX_HAMMING + 1)) - 1)

    assert len(at.renames) == 1 and at.renames[0].distance == RENAME_MAX_HAMMING
    assert past.renames == ()


# ---------------------------------------------------------------------------
# ⑦ 反向例锚点(变异由席位实测驱动,见 .ihui-agent/seats/S-P85.md)
# ---------------------------------------------------------------------------


def test_c7_exact_branch_anchor_is_independent_of_simhash():
    """删掉 content-hash 直判后本用例必须变红:两枚指纹差满位宽,只有直判能配成。"""
    report = detect_renames(
        {"pkg/old.py": "same-bytes"},
        {"pkg/new.py": "same-bytes"},
        prev_fingerprints={"pkg/old.py": _hex(0)},
        cur_fingerprints={"pkg/new.py": _hex((1 << 63) - 1)},
    )

    assert [(r.old_path, r.new_path, r.basis) for r in report.renames] == [
        ("pkg/old.py", "pkg/new.py", RENAME_BASIS_HASH)
    ]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
