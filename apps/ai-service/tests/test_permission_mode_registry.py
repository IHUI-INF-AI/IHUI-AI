# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""权限模式唯一真源 Python 侧断言(G-161,2026-09-22 立)。

守的是两类过去真实发生的事故:
① 拼写漂移 —— 同一档 5 套写法并存,非法值在 AgentLoopV2 构造期 raise 成 500,
   在 Pydantic 请求模型里则被静默丢弃("客户端发了 ≠ 服务端生效");
② 跨语言镜像漂移 —— TS 注册表与 Python 注册表被分别编辑,一侧认的档另一侧不认。
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.core.permission_mode import (
    PERMISSION_MODES,
    is_readonly_permission_mode,
    normalize_permission_mode,
    permission_mode_error,
    permission_mode_key,
    skips_approval_permission_mode,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
TS_REGISTRY = REPO_ROOT / "packages" / "types" / "src" / "permission-mode.ts"

# 历史/文档拼写 → 规范档(每条都对应一处真实存在过的写法,不是随手造的样例)
ALIAS_CASES = {
    "accept-edits": "acceptEdits",
    "acceptEdits": "acceptEdits",
    "bypass-permissions": "bypassPermissions",
    "bypassPermissions": "bypassPermissions",
    "auto": "acceptEdits",
    "accept-all": "bypassPermissions",
    "read-only": "plan",
    "plan-only": "plan",
    "manual": "manual",
    "default": "default",
    "  Plan  ": "plan",
}


@pytest.mark.parametrize("raw", PERMISSION_MODES)
def test_canonical_members_round_trip(raw: str) -> None:
    assert normalize_permission_mode(raw) == raw


@pytest.mark.parametrize(("raw", "want"), list(ALIAS_CASES.items()))
def test_historical_spellings_normalize(raw: str, want: str) -> None:
    assert normalize_permission_mode(raw) == want


def test_unknown_value_returns_none_not_default() -> None:
    """认不出必须返回 None:静默回退 default 等于让用户以为高危档生效了。"""
    assert normalize_permission_mode("yolo-mode") is None
    assert normalize_permission_mode("bypass-permission") is None  # 少个 s:不做模糊匹配
    assert normalize_permission_mode("") is None
    assert normalize_permission_mode("   ") is None
    assert normalize_permission_mode(None) is None
    assert normalize_permission_mode(42) is None


def test_error_message_lists_canonical_values() -> None:
    msg = permission_mode_error("yolo-mode")
    for member in PERMISSION_MODES:
        assert member in msg


def test_policy_predicates_are_exhaustive() -> None:
    """两 predicate 的并集必须恰好覆盖 5 档(新增档位时此处必红,逼作者显式定语义)。"""
    readonly = {m for m in PERMISSION_MODES if is_readonly_permission_mode(m)}
    auto = {m for m in PERMISSION_MODES if skips_approval_permission_mode(m)}
    assert readonly == {"plan"}
    assert auto == {"acceptEdits", "bypassPermissions"}
    assert readonly & auto == set()


def test_permission_mode_key_matches_typescript_rule() -> None:
    """归一化键规则必须与 TS permissionModeKey 同语义(camel 拆 kebab + 小写)。"""
    assert permission_mode_key("acceptEdits") == "accept-edits"
    assert permission_mode_key("BypassPermissions") == "bypass-permissions"
    assert permission_mode_key(" plan ") == "plan"


def test_python_registry_mirrors_typescript_truth_source() -> None:
    """跨语言镜像逐字对账(guardian 第 67 项的运行时兜底,防有人绕过 pre-commit)。"""
    src = TS_REGISTRY.read_text(encoding="utf-8")
    ts_members = re.findall(r"'([^']+)'", re.search(
        r"export const PERMISSION_MODES\s*=\s*\[([\s\S]*?)\]", src
    ).group(1))
    assert list(ts_members) == list(PERMISSION_MODES)

    alias_block = re.search(r"PERMISSION_MODE_ALIASES[^{]*\{([\s\S]*?)\n\}", src).group(1)
    ts_aliases: dict[str, str] = {}
    # 键两种写法:'accept-edits'(带引号)与 acceptedits(标识符),与守门脚本同一解析口径
    for quoted, bare, value in re.findall(
        r"(?:'([^']+)'|([A-Za-z_][\w-]*))\s*:\s*'([^']+)'", alias_block
    ):
        ts_aliases[quoted or bare] = value
    # 与 Python 侧比对:两侧成员/别名键集必须完全一致
    from app.core.permission_mode import PERMISSION_MODE_ALIASES

    assert set(ts_aliases) == set(PERMISSION_MODE_ALIASES)
    for k, v in ts_aliases.items():
        assert PERMISSION_MODE_ALIASES[k] == v, f"别名 {k} 两侧目标不一致"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
