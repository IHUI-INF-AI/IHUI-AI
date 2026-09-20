# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""patch_safety.py 单元测试(2026-09-20 第三十七批,对标 codex-rs safety.rs)。

覆盖:
1. never 恒 auto_approve(含越界场景仍 auto)
2. on_request + 全路径在根内 + 沙箱可用 → auto_approve
3. on_request + 全路径在根内 + 沙箱不可用 → ask_user
4. unless_trusted + 全路径在根内 + 沙箱可用 → auto_approve
5. granular_sandbox_approval + 全路径在根内 + 沙箱可用 → auto_approve
6. 路径越界(非空根) → reject + outside-of-project 文案逐字断言
7. 只读沙箱(空 roots) → reject + read-only 文案逐字断言
8. move 双路径(源+目标)均在根内 + 沙箱可用 → auto_approve
9. move 任一路径越界 → reject(越界判定)
10. cwd 作为隐式可写根(路径落在 cwd 但不在 writable_roots)→ auto_approve
11. Windows 盘符/大小写(normcase)兼容 → 判定为可写
12. extract_patch_paths:Add/Update/Delete/Move 四类型 + 去重保序
13. unless_trusted + 路径越界 + 沙箱可用 → reject(outside-of-project)
14. granular_sandbox_approval + 全路径在根内 + 沙箱不可用 → ask_user
"""
from __future__ import annotations

from app.core.patch_safety import (
    APPROVAL_POLICY_GRANULAR_SANDBOX_APPROVAL,
    APPROVAL_POLICY_NEVER,
    APPROVAL_POLICY_ON_REQUEST,
    APPROVAL_POLICY_UNLESS_TRUSTED,
    PATCH_REJECTED_OUTSIDE_PROJECT_REASON,
    PATCH_REJECTED_READ_ONLY_REASON,
    PatchSafetyDecision,
    assess_patch_safety,
    extract_patch_paths,
)

OUTSIDE = PATCH_REJECTED_OUTSIDE_PROJECT_REASON
READONLY = PATCH_REJECTED_READ_ONLY_REASON


def _auto(approval_policy, patch_paths, writable_roots, cwd="", sandbox_available=True):
    return assess_patch_safety(
        approval_policy=approval_policy,
        patch_paths=patch_paths,
        writable_roots=writable_roots,
        cwd=cwd,
        sandbox_available=sandbox_available,
    )


# 1. never 恒 auto_approve(即使越界)
def test_never_always_auto_approve():
    d = _auto(APPROVAL_POLICY_NEVER, ["/evil/outside.txt"], ["/proj"], sandbox_available=False)
    assert d == PatchSafetyDecision.auto_approve()
    assert d.outcome == "auto_approve"


# 2. on_request + 全路径在根内 + 沙箱可用 → auto
def test_on_request_all_in_roots_sandbox_available_auto():
    d = _auto(APPROVAL_POLICY_ON_REQUEST, ["/proj/a.py"], ["/proj"], sandbox_available=True)
    assert d.outcome == "auto_approve"


# 3. on_request + 全路径在根内 + 沙箱不可用 → ask_user
def test_on_request_all_in_roots_no_sandbox_ask_user():
    d = _auto(APPROVAL_POLICY_ON_REQUEST, ["/proj/a.py"], ["/proj"], sandbox_available=False)
    assert d.outcome == "ask_user"


# 4. unless_trusted + 全路径在根内 + 沙箱可用 → auto
def test_unless_trusted_all_in_roots_sandbox_available_auto():
    d = _auto(APPROVAL_POLICY_UNLESS_TRUSTED, ["/proj/a.py"], ["/proj"], sandbox_available=True)
    assert d.outcome == "auto_approve"


# 5. granular_sandbox_approval + 全路径在根内 + 沙箱可用 → auto
def test_granular_all_in_roots_sandbox_available_auto():
    d = _auto(
        APPROVAL_POLICY_GRANULAR_SANDBOX_APPROVAL,
        ["/proj/a.py"],
        ["/proj"],
        sandbox_available=True,
    )
    assert d.outcome == "auto_approve"


# 6. 路径越界(非空根) → reject + outside-of-project 文案逐字断言
def test_out_of_bounds_reject_outside_project():
    d = _auto(APPROVAL_POLICY_ON_REQUEST, ["/evil/outside.txt"], ["/proj"], sandbox_available=True)
    assert d.outcome == "reject"
    assert d.reason == OUTSIDE


# 7. 只读沙箱(空 roots) → reject + read-only 文案逐字断言
def test_read_only_sandbox_reject():
    d = assess_patch_safety(
        approval_policy=APPROVAL_POLICY_ON_REQUEST,
        patch_paths=["anywhere.txt"],
        writable_roots=[],
        cwd="",
        sandbox_available=True,
    )
    assert d.outcome == "reject"
    assert d.reason == READONLY


# 8. move 双路径(源+目标)均在根内 + 沙箱可用 → auto
def test_move_both_in_roots_auto():
    d = _auto(
        APPROVAL_POLICY_ON_REQUEST,
        ["/proj/old.py", "/proj/new.py"],  # 调用方已展开 move 双路径
        ["/proj"],
        sandbox_available=True,
    )
    assert d.outcome == "auto_approve"


# 9. move 任一路径越界 → reject(越界判定)
def test_move_one_out_of_bounds_reject():
    d = _auto(
        APPROVAL_POLICY_ON_REQUEST,
        ["/proj/old.py", "/evil/new.py"],
        ["/proj"],
        sandbox_available=True,
    )
    assert d.outcome == "reject"
    assert d.reason == OUTSIDE


# 10. cwd 作为隐式可写根(路径落在 cwd 但不在 writable_roots)→ auto
def test_cwd_implicit_writable_root():
    d = assess_patch_safety(
        approval_policy=APPROVAL_POLICY_ON_REQUEST,
        patch_paths=["/work/b.py"],
        writable_roots=["/proj"],
        cwd="/work",
        sandbox_available=True,
    )
    assert d.outcome == "auto_approve"


# 11. Windows 盘符/大小写(normcase)兼容 → 判定为可写
def test_windows_case_insensitive_normcase():
    # 根用小写盘符,路径用大写盘符+大写文件名,应当判为可写
    d = assess_patch_safety(
        approval_policy=APPROVAL_POLICY_ON_REQUEST,
        patch_paths=["C:/proj/File.py"],
        writable_roots=["c:/proj"],
        cwd="",
        sandbox_available=True,
    )
    assert d.outcome == "auto_approve"


# 12. extract_patch_paths:四类型 + 去重保序
def test_extract_patch_paths_four_types_dedup_order():
    patch = (
        "*** Begin Patch\n"
        "*** Update File: src/a.py\n"
        "@@\n"
        " *** Move to: src/renamed.py\n"
        "*** Add File: src/b.py\n"
        "*** Delete File: src/c.py\n"
        "*** Update File: src/renamed.py\n"
        "*** End Patch\n"
    )
    paths = extract_patch_paths(patch)
    # 期望去重保序:Update 源 / Move 目标 / Add / Delete
    assert paths == ["src/a.py", "src/renamed.py", "src/b.py", "src/c.py"]


# 13. unless_trusted + 路径越界 + 沙箱可用 → reject(outside-of-project)
def test_unless_trusted_out_of_bounds_reject():
    d = _auto(
        APPROVAL_POLICY_UNLESS_TRUSTED,
        ["/evil/x.py"],
        ["/proj"],
        sandbox_available=True,
    )
    assert d.outcome == "reject"
    assert d.reason == OUTSIDE


# 14. granular_sandbox_approval + 全路径在根内 + 沙箱不可用 → ask_user
def test_granular_no_sandbox_ask_user():
    d = _auto(
        APPROVAL_POLICY_GRANULAR_SANDBOX_APPROVAL,
        ["/proj/a.py"],
        ["/proj"],
        sandbox_available=False,
    )
    assert d.outcome == "ask_user"
