# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
"""三端模型名归一化同源守卫(2026-09-13 立)。

`OFFICIAL_MODEL_NAMES` 官方名映射表有三份同源实现:
  1. TS    : packages/shared/src/constants/model-names.ts
  2. Python: apps/ai-service/app/core/model_naming.py(本文件被测对象)
  3. 脚本  : scripts/lib/model-names.mjs

三份必须逐字一致,否则会出现「同一模型在不同链路被归一到不同名字」的隐性分裂
(历史上正是 minimax-m3 / MiniMax-M3 双条目导致计费漏损与目录重复)。

本测试同时锁定两个函数的行为差异:
  - normalize_model_id     强归一:未知家族 → 全小写
  - to_official_model_name 保守改写:未命中映射表 → 原样透传(用于转发链路,防误改写上游)
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.core.model_naming import (
    OFFICIAL_MODEL_NAMES,
    normalize_model_id,
    to_official_model_name,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
TS_PATH = REPO_ROOT / "packages" / "shared" / "src" / "constants" / "model-names.ts"
MJS_PATH = REPO_ROOT / "scripts" / "lib" / "model-names.mjs"

# 形如  'minimax-m3': 'MiniMax-M3',   或   "minimax-m3": "MiniMax-M3",
_PAIR_RE = re.compile(r"""['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]""")


def _parse_ts_table(text: str) -> dict[str, str]:
    """从 TS/MJS 源码中提取 OFFICIAL_MODEL_NAMES 的字面量键值对。"""
    start = text.find("OFFICIAL_MODEL_NAMES")
    assert start != -1, "未在源文件中找到 OFFICIAL_MODEL_NAMES"
    # 取声明起点之后的第一个 { ... } 块
    brace = text.find("{", start)
    assert brace != -1, "OFFICIAL_MODEL_NAMES 缺少对象字面量"
    depth = 0
    for idx in range(brace, len(text)):
        ch = text[idx]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return dict(_PAIR_RE.findall(text[brace + 1 : idx]))
    raise AssertionError("OFFICIAL_MODEL_NAMES 对象字面量未闭合")


# ---------------------------------------------------------------------------
# 1. 三端映射表逐字一致
# ---------------------------------------------------------------------------


def test_python_table_is_non_empty() -> None:
    assert OFFICIAL_MODEL_NAMES, "Python 侧映射表为空(疑似被误删)"


@pytest.mark.skipif(not TS_PATH.exists(), reason="TS 源文件不存在")
def test_python_matches_typescript_table() -> None:
    ts_table = _parse_ts_table(TS_PATH.read_text(encoding="utf-8"))
    assert ts_table == dict(OFFICIAL_MODEL_NAMES), (
        "TS 与 Python 的 OFFICIAL_MODEL_NAMES 已漂移。\n"
        f"仅 TS 有: {sorted(set(ts_table) - set(OFFICIAL_MODEL_NAMES))}\n"
        f"仅 Python 有: {sorted(set(OFFICIAL_MODEL_NAMES) - set(ts_table))}\n"
        f"值不一致: {sorted(k for k in set(ts_table) & set(OFFICIAL_MODEL_NAMES) if ts_table[k] != OFFICIAL_MODEL_NAMES[k])}"
    )


@pytest.mark.skipif(not MJS_PATH.exists(), reason="脚本端源文件不存在")
def test_python_matches_script_table() -> None:
    mjs_table = _parse_ts_table(MJS_PATH.read_text(encoding="utf-8"))
    assert mjs_table == dict(OFFICIAL_MODEL_NAMES), (
        "脚本端(scripts/lib/model-names.mjs)与 Python 的 OFFICIAL_MODEL_NAMES 已漂移。"
    )


def test_all_keys_are_lowercase() -> None:
    """映射表键必须全小写,否则查表永远不命中。"""
    bad = [k for k in OFFICIAL_MODEL_NAMES if k != k.lower()]
    assert not bad, f"映射表键存在非小写写法(永不命中): {bad}"


def test_all_values_are_official_camel_case() -> None:
    """映射表值必须与键大小写不同(除纯小写生态名外),即『官方驼峰』而非小写。"""
    same = [k for k, v in OFFICIAL_MODEL_NAMES.items() if k == v]
    assert not same, f"映射表存在键值相同的条目(等于未归一): {same}"


# ---------------------------------------------------------------------------
# 2. normalize_model_id —— 强归一
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("MiniMax-M3", "MiniMax-M3"),
        ("minimax-m3", "MiniMax-M3"),
        ("MINIMAX-M3", "MiniMax-M3"),
        ("  minimax-m3  ", "MiniMax-M3"),
        ("GPT-4o", "gpt-4o"),  # 未知家族 → 全小写
        ("Qwen-Max", "qwen-max"),
        ("openrouter/minimax-m3", "openrouter/MiniMax-M3"),
        ("", ""),
        ("   ", ""),
    ],
)
def test_normalize_model_id(raw: str, expected: str) -> None:
    assert normalize_model_id(raw) == expected


# ---------------------------------------------------------------------------
# 3. to_official_model_name —— 保守改写(未命中原样透传)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("minimax-m3", "MiniMax-M3"),
        ("MiniMax-M3", "MiniMax-M3"),
        ("MINIMAX-M3", "MiniMax-M3"),
        ("openrouter/minimax-m3", "openrouter/MiniMax-M3"),
        # 未命中映射表 → 原样透传(与 normalize_model_id 的关键差异)
        ("GPT-4o", "GPT-4o"),
        ("gpt-4o", "gpt-4o"),
        ("Qwen-Max", "Qwen-Max"),
        ("", ""),
        ("   ", ""),
    ],
)
def test_to_official_model_name(raw: str, expected: str) -> None:
    assert to_official_model_name(raw) == expected


def test_to_official_model_name_never_lowercases_unknown() -> None:
    """回归守卫:保守改写绝不能把未知模型改小写(会把上游能用的名字改坏)。"""
    for raw in ("GPT-4o", "Claude-3.5-Sonnet", "DeepSeek-V3", "Qwen2.5-72B"):
        assert to_official_model_name(raw) == raw


def test_to_official_model_name_is_idempotent() -> None:
    for raw in ("minimax-m3", "MiniMax-M3", "openrouter/minimax-m3", "gpt-4o"):
        once = to_official_model_name(raw)
        assert to_official_model_name(once) == once
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
