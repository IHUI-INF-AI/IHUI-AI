# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""partition_platforms 纯函数用例(平台化 2026-10-10:主窗口 vs Qoder 窗口拆分)。

Qoder 领取窗口每日 10:00(UTC+8)开放 ⇒ 调度器把 qoder 账号拆到 10:05 独立
job;这里只测拆分语义(不触 store / 引擎,纯函数无 IO)。
"""

from __future__ import annotations

from typing import Any

from app.services.checkin_scheduler import partition_platforms


def _acc(aid: int, platform: str | None) -> dict[str, Any]:
    acc: dict[str, Any] = {"id": aid, "name": f"acc{aid}", "jwt": f"j{aid}"}
    if platform is not None:
        acc["platform"] = platform
    return acc


def test_partition_mixed():
    """混合列表:qoder 进 Qoder 侧,trae 进主侧,各自保持原顺序。"""
    accounts = [
        _acc(1, "trae"),
        _acc(2, "qoder"),
        _acc(3, "trae"),
        _acc(4, "qoder"),
    ]
    main_side, qoder_side = partition_platforms(accounts)
    assert [a["id"] for a in main_side] == [1, 3]
    assert [a["id"] for a in qoder_side] == [2, 4]


def test_partition_all_trae():
    """纯 trae:主侧全量,Qoder 侧空。"""
    accounts = [_acc(1, "trae"), _acc(2, "trae")]
    main_side, qoder_side = partition_platforms(accounts)
    assert len(main_side) == 2
    assert qoder_side == []


def test_partition_all_qoder():
    """纯 qoder:Qoder 侧全量,主侧空。"""
    accounts = [_acc(1, "qoder"), _acc(2, "qoder")]
    main_side, qoder_side = partition_platforms(accounts)
    assert main_side == []
    assert len(qoder_side) == 2


def test_partition_missing_platform_defaults_trae():
    """platform 缺失按 'trae' 处理(存量账号语义,与 store 默认列值一致)。"""
    accounts = [_acc(1, None), _acc(2, "qoder"), _acc(3, None)]
    main_side, qoder_side = partition_platforms(accounts)
    assert [a["id"] for a in main_side] == [1, 3]
    assert [a["id"] for a in qoder_side] == [2]


def test_partition_unknown_platform_goes_main():
    """未知平台值(防御)走主窗口,不误入 Qoder 窗口。"""
    accounts = [_acc(1, ""), _acc(2, "TRAE")]
    main_side, qoder_side = partition_platforms(accounts)
    assert len(main_side) == 2
    assert qoder_side == []
# [IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
