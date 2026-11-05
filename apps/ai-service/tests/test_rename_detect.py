# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`rename_detect` 的行为钉(P85):同 hash 直判 / 阈值内 / 阈值外 / 删+增不误判。

本模块是纯函数层,所以用例不碰磁盘、不碰 git、不碰网络 —— 判定错在单测里就该炸,
而不是等到一次整仓索引把 embedding 白烧一遍才发现。
"""

from __future__ import annotations

from app.services.rename_detect import (
    NEAR_STAGE_DONE,
    NEAR_STAGE_NOT_NEEDED,
    NEAR_STAGE_SKIPPED_NO_FINGERPRINTS,
    NEAR_STAGE_SKIPPED_TOO_MANY,
    RENAME_BASIS_HASH,
    RENAME_BASIS_SIMHASH,
    RENAME_FINGERPRINT_MAX_TOKENS,
    RENAME_MAX_CANDIDATES_PER_SIDE,
    RENAME_MAX_HAMMING,
    SIMHASH_BITS,
    SIMHASH_HEX_LEN,
    compute_simhash,
    compute_simhash_batch,
    detect_renames,
    fingerprint_hex,
    hamming_distance,
    parse_fingerprint,
)

_BODY = "\n".join(
    f"def handler_{i}(req):\n"
    f"    value = req.get('k{i}')\n"
    f"    return {{'id': {i}, 'value': value}}\n"
    for i in range(30)
)


def _fp(text: str) -> str:
    return fingerprint_hex(compute_simhash(text))


# ---------------------------------------------------------------------------
# 指纹原语
# ---------------------------------------------------------------------------


def test_simhash_is_deterministic_and_bounded():
    first = compute_simhash(_BODY)
    assert first == compute_simhash(_BODY), "纯函数:同输入必须同输出(不得用带盐的 hash())"
    assert 0 <= first < (1 << SIMHASH_BITS)
    assert len(fingerprint_hex(first)) == SIMHASH_HEX_LEN
    assert parse_fingerprint(fingerprint_hex(first)) == first


def test_simhash_batch_matches_single_calls():
    texts = [_BODY, "class A:\n    pass\n", ""]
    assert compute_simhash_batch(texts) == [compute_simhash(t) for t in texts]


def test_simhash_costs_only_the_first_n_tokens():
    """前缀口径:超长文本只吃前 N 枚 token,成本是常数(见常量注释里的账)。"""
    head = " ".join(f"tok{i}" for i in range(RENAME_FINGERPRINT_MAX_TOKENS))
    assert compute_simhash(head + " tail" * 5000) == compute_simhash(head)


def test_hamming_distance_counts_flipped_bits_and_rejects_out_of_range():
    assert hamming_distance(0, 0) == 0
    assert hamming_distance(0b1011, 0b1001) == 1
    assert hamming_distance(0, (1 << SIMHASH_BITS) - 1) == SIMHASH_BITS
    for bad in (-1, 1 << SIMHASH_BITS):
        try:
            hamming_distance(bad, 0)
        except ValueError:
            continue
        raise AssertionError("越界指纹必须抛,静默截断会让阈值偏移而不出声")


def test_parse_fingerprint_returns_none_for_malformed_input():
    assert parse_fingerprint(None) is None
    assert parse_fingerprint("zz") is None, "长度/进制不合 ⇒ 没数据,不猜成 0"
    assert parse_fingerprint("f" * (SIMHASH_HEX_LEN + 1)) is None
    assert parse_fingerprint("0" * SIMHASH_HEX_LEN) == 0


def test_threshold_is_a_single_named_constant():
    """阈值单点:本模块只有这一枚,判定默认取它。"""
    assert isinstance(RENAME_MAX_HAMMING, int) and RENAME_MAX_HAMMING >= 1


# ---------------------------------------------------------------------------
# 差集判定
# ---------------------------------------------------------------------------


def test_same_content_hash_is_a_direct_rename():
    report = detect_renames({"src/old.py": "h1"}, {"src/new.py": "h1"})
    assert [(r.old_path, r.new_path, r.basis, r.hamming) for r in report.renames] == [
        ("src/old.py", "src/new.py", RENAME_BASIS_HASH, None)
    ]
    assert report.exact == report.renames, "同 hash 的必须进精确档(只有它允许跳过重嵌入)"
    assert report.added_only == () and report.removed_only == ()
    assert report.near_stage == NEAR_STAGE_NOT_NEEDED


def test_near_identical_content_within_threshold_is_a_candidate():
    old = _BODY
    new = _BODY + "# a comment added by the rename tool\n"
    distance = hamming_distance(compute_simhash(old), compute_simhash(new))
    assert distance <= RENAME_MAX_HAMMING, f"夹具自身必须落在阈值内(现读 {distance})"
    report = detect_renames(
        {"a/old.py": "h1"},
        {"b/new.py": "h2"},
        prev_fingerprints={"a/old.py": _fp(old)},
        cur_fingerprints={"b/new.py": _fp(new)},
    )
    assert [(r.old_path, r.new_path, r.basis) for r in report.renames] == [
        ("a/old.py", "b/new.py", RENAME_BASIS_SIMHASH)
    ]
    assert report.renames[0].hamming is not None and report.renames[0].hamming <= RENAME_MAX_HAMMING
    assert report.near == report.renames and report.exact == ()
    assert report.near_stage == NEAR_STAGE_DONE


def test_beyond_threshold_is_not_a_rename():
    old = "def a():\n    return 1\n"
    new = "class CompletelyDifferent:\n    x = [i for i in range(10)]\n"
    assert hamming_distance(compute_simhash(old), compute_simhash(new)) > RENAME_MAX_HAMMING
    report = detect_renames(
        {"a/old.py": "h1"},
        {"b/new.py": "h2"},
        prev_fingerprints={"a/old.py": _fp(old)},
        cur_fingerprints={"b/new.py": _fp(new)},
    )
    assert report.renames == ()
    assert report.added_only == ("b/new.py",) and report.removed_only == ("a/old.py",)


def test_delete_plus_unrelated_add_is_never_read_as_a_rename():
    report = detect_renames({"a/old.ts": "h1"}, {"b/new.ts": "h2"})
    assert report.renames == (), "没有指纹就不许猜;删+增各归各桶"
    assert report.added_only == ("b/new.ts",)
    assert report.removed_only == ("a/old.ts",)
    assert report.near_stage == NEAR_STAGE_SKIPPED_NO_FINGERPRINTS


def test_same_name_different_extension_is_not_paired_near():
    body = _BODY
    report = detect_renames(
        {"a/old.py": "h1"},
        {"a/old.ts": "h2"},
        prev_fingerprints={"a/old.py": _fp(body)},
        cur_fingerprints={"a/old.ts": _fp(body)},
    )
    assert report.renames == (), "扩展名不同不配对:那更像「换了一枚文件」而不是改名"


def test_multiple_identical_hashes_pair_deterministically():
    prev = {"z/b.py": "same", "a/c.py": "same"}
    cur = {"m/x.py": "same", "m/y.py": "same"}
    first = detect_renames(prev, cur)
    second = detect_renames(dict(reversed(list(prev.items()))), dict(reversed(list(cur.items()))))
    assert first.renames == second.renames, "同 hash 多枚时配对必须与输入顺序无关(字典序贪心)"
    assert [(r.old_path, r.new_path) for r in first.renames] == [
        ("a/c.py", "m/x.py"),
        ("z/b.py", "m/y.py"),
    ]


def test_too_many_candidates_skips_near_stage_and_says_so():
    count = RENAME_MAX_CANDIDATES_PER_SIDE + 1
    prev = {f"old/{i}.py": f"h{i}" for i in range(count)}
    cur = {f"new/{i}.py": f"g{i}" for i in range(count)}
    report = detect_renames(
        prev,
        cur,
        prev_fingerprints=dict.fromkeys(prev, "0" * SIMHASH_HEX_LEN),
        cur_fingerprints=dict.fromkeys(cur, "0" * SIMHASH_HEX_LEN),
    )
    assert report.near_stage == NEAR_STAGE_SKIPPED_TOO_MANY, "超限要如实报,不许静默退回精确档"
    assert report.renames == ()
    assert len(report.added_only) == count and len(report.removed_only) == count


def test_near_stage_enum_is_single_source_and_rejects_unknown():
    from app.services import rename_detect

    assert rename_detect.NEAR_STAGES == (
        NEAR_STAGE_DONE,
        NEAR_STAGE_NOT_NEEDED,
        NEAR_STAGE_SKIPPED_NO_FINGERPRINTS,
        NEAR_STAGE_SKIPPED_TOO_MANY,
    )
    try:
        rename_detect.RenameReport(near_stage="guessed")
    except ValueError:
        return
    raise AssertionError("未知档位必须当场抛,不许默默当成 done")


def test_no_diff_means_no_work():
    report = detect_renames({"a.py": "h1"}, {"a.py": "h1"})
    assert report.renames == () and report.added_only == () and report.removed_only == ()
    assert report.near_stage == NEAR_STAGE_NOT_NEEDED
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
