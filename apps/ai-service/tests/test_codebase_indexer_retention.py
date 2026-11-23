# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""索引保留期透传(P0-8 第十一批,2026-11-23)。

API 侧第九批开了 `retentionDays` 口,但 `_write_to_api` 从不传 ⇒ 那个口等于不存在。
本档钉住两件事:
  ① 解析的失效方向 = "不发该字段"(空/非法/0/负 一律 None),不是"发 0";
  ② 装车:`_write_to_api` 真的在 `if retention_days is not None` 之下写 payload,
     且字段名与 API schema 逐字一致(`retentionDays`,不是 retention_days)。
"""

from __future__ import annotations

import pathlib

import pytest

from app.services.codebase_indexer import (
    CODEBASE_INDEX_RETENTION_DAYS_ENV,
    _parse_retention_days,
)

SRC = (
    pathlib.Path(__file__).resolve().parents[1]
    / "app"
    / "services"
    / "codebase_indexer.py"
).read_text(encoding="utf-8")


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, None),
        ("", None),
        ("   ", None),
        ("abc", None),
        ("90.5", None),
        ("0", None),
        ("-3", None),
        ("90", 90),
        (" 30 ", 30),
        ("3650", 3650),
    ],
)
def test_parse_retention_days(raw: str | None, expected: int | None) -> None:
    """① 只有正整数放行;其余一律 None(交 API 默认上限)。"""
    assert _parse_retention_days(raw) == expected


def test_env_name_is_canonical() -> None:
    """环境变量名只有一份(§0.6):写死在测试里,改名会当场红。"""
    assert CODEBASE_INDEX_RETENTION_DAYS_ENV == "CODEBASE_INDEX_RETENTION_DAYS"


def test_write_to_api_passes_retention_under_guard() -> None:
    """② 装车:字段写入必须在 `if retention_days is not None` 之下。"""
    assert 'payload["retentionDays"] = retention_days' in SRC
    guarded = SRC.split('payload["retentionDays"] = retention_days')
    before = guarded[0]
    # 断言写入前紧邻的就是那道守卫(允许中间夹注释)
    tail = before[-400:]
    assert "if retention_days is not None:" in tail, "字段写入没有落在守卫之下"


def test_write_to_api_reads_env_not_constant() -> None:
    """保留期必须是**运行时可配**的,不是烘死的常量。"""
    assert "os.environ.get(CODEBASE_INDEX_RETENTION_DAYS_ENV)" in SRC


def test_null_is_not_used_as_long_retention_shortcut() -> None:
    """反向牙:解析结果不得出现 `return 0` 之类"用 0 冒充合法值"的分支。"""
    body = SRC.split("def _parse_retention_days")[1].split("CODEBASE_INDEX_RETENTION_DAYS_ENV")[0]
    assert "return 0" not in body
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
