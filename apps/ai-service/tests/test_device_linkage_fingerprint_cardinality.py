# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""设备关联检测的**指纹维度基数保护**(票1「退化指纹的等值处置」拍板 A 档)。

拍板口径(机主 2026-10-06,授权代行@2026-10-18):**保留现状+消费侧基数保护** ——
不删 fingerprint_hash 列、不改摘要算法(那是 B/C 两档,会放弃"跨账号同设备"检测能力);
消费侧对指纹等值判定加基数保护:同哈希组超过阈值(10)判为退化指纹,该维度收起不判,
防指纹碰撞放大误报。

本文件钉死的四格(正反成对):
  ① 退化指纹(同值组 11+)⇒ 指纹维度收起、is_linked 不因它翻转,且收起**必须留痕**
    (fingerprint_discriminating=False + fingerprint_withheld_count 点数,静默与"没判"同形);
  ② 真实共享(同值组 ≤10)⇒ 照旧判关联 —— 保护不得吞掉真信号(A 档不选 B 的理由所在);
  ③ 边界 10/11:恰好 10 仍判、11 收起(与备份链 1f7800e37 的出口判同口径);
  ④ 退化收起只作用于指纹维:IP/UA/Canvas 照旧,其他维度照常出 is_linked。
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import pytest

from app.services.publish.anti_risk import device_graph_guard
from app.services.publish.anti_risk.device_graph_guard import (
    _FINGERPRINT_CARDINALITY_THRESHOLD,
    get_device_graph_guard,
)

DEGENERATE_FP = "a" * 64
SAME_UA = "ua" * 8


@pytest.fixture
def graph_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """图谱落点指到 tmp_path(仓库树之外),手法与既有夹具一致。"""
    target = tmp_path / "device_graph.json"
    monkeypatch.setenv("ANTI_RISK_DEVICE_GRAPH_FILE", str(target))
    monkeypatch.setattr(device_graph_guard, "_GRAPH_FILE", target)
    return target


def _write_graph(path: Path, bindings: list[dict[str, Any]]) -> None:
    path.write_text(
        json.dumps({"bindings": bindings, "updated_at": time.time()}, ensure_ascii=False),
        encoding="utf-8",
    )


def _binding(account_id: str, fingerprint_hash: str, ua_hash: str = "") -> dict[str, Any]:
    return {
        "account_id": account_id,
        "fingerprint_hash": fingerprint_hash,
        "proxy_ip": "direct",  # direct 在判据里显式跳过,不污染结论
        "ua_hash": ua_hash,  # 默认留空:只让指纹维度参与,免得两维叠在一起看不出是哪条判据生效
        "canvas_hash": "",
        "bound_at": time.time(),
        "updated_at": time.time(),
    }


def _guard() -> Any:
    g = get_device_graph_guard()
    # 单例缓存的绑定表必须每例重置,否则上一例的图谱会串进本例(本仓"夹具串味"那一型)。
    # `_loaded` 要置 **False** 而不是 True:置 True 会让 `_ensure_loaded` 直接早退,
    # 本例写到 tmp 的图谱根本没被读进来 —— 那是一支永远绿的尺子。
    g._bindings = {}  # noqa: SLF001
    g._loaded = False  # noqa: SLF001
    return g


async def test_degenerate_fingerprint_is_withheld_and_counted(graph_file: Path) -> None:
    """① 退化指纹(同值组 12):指纹维度收起,is_linked 不因它翻转,收起必须点数留痕。"""
    # 被检测账号 + 11 个同哈希账号 = 同值组 12 > 阈值 10 ⇒ 退化
    accounts = ["acct_main"] + [f"acct_p{i}" for i in range(11)]
    _write_graph(graph_file, [_binding(a, DEGENERATE_FP) for a in accounts])
    report = await _guard().detect_linkage("acct_main")
    assert report.fingerprint_discriminating is False
    assert report.fingerprint_withheld_count == 11
    assert "fingerprint" not in report.linkage_types
    assert report.is_linked is False  # 唯一参与维度是指纹,收起后不得误报
    assert report.risk_score == 0
    # 报告面必须看得见这一格(to_dict 是给审计/前端读的形态)
    d = report.to_dict()
    assert d["fingerprint_discriminating"] is False
    assert d["fingerprint_withheld_count"] == 11


async def test_boundary_exactly_threshold_still_links(graph_file: Path) -> None:
    """② 边界下沿:同值组恰好 10(≤ 阈值)⇒ 照旧判关联,不得收起。"""
    accounts = ["acct_main"] + [f"acct_p{i}" for i in range(_FINGERPRINT_CARDINALITY_THRESHOLD - 1)]
    _write_graph(graph_file, [_binding(a, DEGENERATE_FP) for a in accounts])
    report = await _guard().detect_linkage("acct_main")
    assert report.fingerprint_discriminating is True
    assert report.fingerprint_withheld_count == 0
    assert "fingerprint" in report.linkage_types
    assert report.is_linked is True
    assert report.risk_score == 100  # 9 个同组账号 × 40,封顶 100(既有累加语义)


async def test_boundary_threshold_plus_one_withholds(graph_file: Path) -> None:
    """③ 边界上沿:同值组 11(> 阈值)⇒ 收起,withheld 点数 10。"""
    accounts = ["acct_main"] + [f"acct_p{i}" for i in range(_FINGERPRINT_CARDINALITY_THRESHOLD)]
    _write_graph(graph_file, [_binding(a, DEGENERATE_FP) for a in accounts])
    report = await _guard().detect_linkage("acct_main")
    assert report.fingerprint_discriminating is False
    assert report.fingerprint_withheld_count == _FINGERPRINT_CARDINALITY_THRESHOLD
    assert report.is_linked is False


async def test_small_group_still_links_protection_must_not_swallow_real_signal(graph_file: Path) -> None:
    """④ 反向锁:小同值组(真实共享)照旧判 —— 基数保护不得吞掉"跨账号同设备"真信号。"""
    _write_graph(graph_file, [_binding("acct_main", DEGENERATE_FP), _binding("acct_other", DEGENERATE_FP)])
    report = await _guard().detect_linkage("acct_main")
    assert report.is_linked is True
    assert "fingerprint" in report.linkage_types
    assert report.fingerprint_discriminating is True


async def test_degeneracy_only_touches_fingerprint_dimension(graph_file: Path) -> None:
    """⑤ 退化收起只作用于指纹维:同图若 UA 也同值,UA 照常出关联。"""
    accounts = ["acct_main"] + [f"acct_p{i}" for i in range(11)]
    _write_graph(graph_file, [_binding(a, DEGENERATE_FP, ua_hash=SAME_UA) for a in accounts])
    report = await _guard().detect_linkage("acct_main")
    # 指纹维收起留痕
    assert report.fingerprint_discriminating is False
    assert report.fingerprint_withheld_count == 11
    assert "fingerprint" not in report.linkage_types
    # UA 维照旧
    assert "ua" in report.linkage_types
    assert report.is_linked is True
    assert report.risk_score == 100  # 仅 UA 一维、11 个同组账号 × 20,封顶 100(既有累加语义)


async def test_empty_fingerprint_hash_keeps_pre_change_behaviour(graph_file: Path) -> None:
    """⑥ 空串哨兵(未记录指纹)⇒ 基数保护不启动,行为与改动前逐字一致。"""
    _write_graph(graph_file, [_binding("acct_main", ""), _binding("acct_other", "")])
    report = await _guard().detect_linkage("acct_main")
    assert report.fingerprint_discriminating is True
    assert report.fingerprint_withheld_count == 0
    assert report.is_linked is False  # 指纹维因空串跳过(既有语义),其余维也无命中
    assert report.linkage_types == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
