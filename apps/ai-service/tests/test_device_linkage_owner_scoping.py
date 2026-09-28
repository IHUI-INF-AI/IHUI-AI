# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""设备关联检测的**归属作用域**（2026-09-27 立）。

起因是一条真报警：发第二篇推广文时，掘金账号被判"跨会话设备关联(类型:ua,风险=60)"并自动冷却 1h，
任务直接 failed。查图谱后发现成因不是隔离坏了，而是**判据里没有"主人"这一维**：
`detect_linkage` 拿 account_id 两两比 UA/指纹，而"一个人运营十几个平台账号、同一台机器、
同一个 UA"恰恰是本产品的前提 —— 于是每次发布都会自己给自己判一次关联并冷却。
用户那句"刷新 token 没几次就风控我"里，有相当一部分是我们自己这一层造的。

判据要点（也是本文件要钉死的四格）：
  ① 同主人 ⇒ 跳过，且**跳过数必须出现在报告里**（静默跳过与"没检查"在账面上同形）；
  ② 不同主人 ⇒ 照旧计入（多租户部署下这才是真风险）；
  ③ **查不到主人 ⇒ 照旧计入**（保守方向不可反：把"不知道是谁"当"是同一个人"就是开后门）；
  ④ 不传解析器 ⇒ 行为与改动前逐字一致（默认不改变任何既有调用方的结论）。
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import pytest

from app.services.publish.anti_risk import device_graph_guard
from app.services.publish.anti_risk.account_identity import (
    resolve_account_id,
    row_id_from_account_id,
)
from app.services.publish.anti_risk.device_graph_guard import get_device_graph_guard

SAME_UA = "a" * 16
OTHER_UA = "b" * 16


@pytest.fixture
def graph_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """图谱落点指到 tmp_path（仓库树之外），手法与既有夹具一致。"""
    target = tmp_path / "device_graph.json"
    monkeypatch.setenv("ANTI_RISK_DEVICE_GRAPH_FILE", str(target))
    monkeypatch.setattr(device_graph_guard, "_GRAPH_FILE", target)
    return target


def _write_graph(path: Path, bindings: list[dict[str, Any]]) -> None:
    path.write_text(
        json.dumps({"bindings": bindings, "updated_at": time.time()}, ensure_ascii=False),
        encoding="utf-8",
    )


def _binding(account_id: str, ua_hash: str) -> dict[str, Any]:
    return {
        "account_id": account_id,
        "fingerprint_hash": "",  # 刻意留空：只让 UA 维度参与，免得两维叠在一起看不出是哪条判据生效
        "proxy_ip": "direct",  # direct 在判据里显式跳过，不污染结论
        "ua_hash": ua_hash,
        "canvas_hash": "",
        "bound_at": time.time(),
        "updated_at": time.time(),
    }


def _guard() -> Any:
    g = get_device_graph_guard()
    # 单例缓存的绑定表必须每例重置，否则上一例的图谱会串进本例（本仓"夹具串味"那一型）。
    # `_loaded` 要置 **False** 而不是 True：置 True 会让 `_ensure_loaded` 直接早退，
    # 本例写到 tmp 的图谱根本没被读进来 —— 那是一支永远绿的尺子。
    g._bindings = {}  # noqa: SLF001
    g._loaded = False  # noqa: SLF001
    return g


async def test_same_owner_accounts_are_skipped_and_counted(graph_file: Path) -> None:
    """① 同主人两个账号同 UA：不判关联，但跳过数必须如实报出。"""
    _write_graph(graph_file, [_binding("juejin_db13", SAME_UA), _binding("csdn_db12", SAME_UA)])
    owners = {"13": "u1", "12": "u1"}
    report = await _guard().detect_linkage("juejin_db13", owner_of=lambda k: owners.get(row_id_from_account_id(k) or ""))
    assert report.is_linked is False
    assert report.linked_accounts == []
    assert report.same_owner_skipped == 1
    # 报告面必须看得见这一格（to_dict 是给审计/前端读的形态）
    assert report.to_dict()["same_owner_skipped"] == 1


async def test_different_owner_still_links(graph_file: Path) -> None:
    """② 不同主人同 UA：照旧判关联 —— 多租户部署下这才是该拦的东西。"""
    _write_graph(graph_file, [_binding("juejin_db13", SAME_UA), _binding("zhihu_db5", SAME_UA)])
    owners = {"13": "u1", "5": "u2"}
    report = await _guard().detect_linkage("juejin_db13", owner_of=lambda k: owners.get(row_id_from_account_id(k) or ""))
    assert report.is_linked is True
    assert [a["account_id"] for a in report.linked_accounts] == ["zhihu_db5"]
    assert "ua" in report.linkage_types
    assert report.same_owner_skipped == 0


async def test_unknown_owner_is_counted_not_exempted(graph_file: Path) -> None:
    """③ 查不到主人（legacy 档键）必须照旧计入 —— 保守方向不可反。"""
    _write_graph(
        graph_file,
        [_binding("juejin_db13", SAME_UA), _binding("zhihu_legacy-59e794d4", SAME_UA)],
    )
    owners = {"13": "u1"}  # legacy 键反解不出行 id ⇒ 主人未知
    report = await _guard().detect_linkage("juejin_db13", owner_of=lambda k: owners.get(row_id_from_account_id(k) or ""))
    assert report.is_linked is True
    assert report.linked_accounts[0]["account_id"] == "zhihu_legacy-59e794d4"


async def test_no_resolver_keeps_pre_change_behaviour(graph_file: Path) -> None:
    """④ 不传解析器 ⇒ 与改动前逐字一致（同主人也照样判），默认不改变任何既有调用方结论。"""
    _write_graph(graph_file, [_binding("juejin_db13", SAME_UA), _binding("csdn_db12", SAME_UA)])
    report = await _guard().detect_linkage("juejin_db13")
    assert report.is_linked is True
    assert report.same_owner_skipped == 0


async def test_mixed_graph_only_foreign_owners_are_reported(graph_file: Path) -> None:
    """正向证明：一图三账号，两个同主人一个外主人 ⇒ 只报外那个，跳过数=2（含自身比较的两次跳过）。"""
    _write_graph(
        graph_file,
        [
            _binding("juejin_db13", SAME_UA),
            _binding("csdn_db12", SAME_UA),
            _binding("zhihu_db5", SAME_UA),
        ],
    )
    owners = {"13": "u1", "12": "u1", "5": "u2"}
    report = await _guard().detect_linkage("juejin_db13", owner_of=lambda k: owners.get(row_id_from_account_id(k) or ""))
    assert [a["account_id"] for a in report.linked_accounts] == ["zhihu_db5"]
    assert report.same_owner_skipped == 1
    assert report.risk_score == 20  # 只剩 UA 一维、只剩一个外主人账号


def test_row_id_round_trips_with_the_key_builder() -> None:
    """反解必须与 `resolve_account_id` 同源对账：db 档能反解，另两档必须返回 None。"""
    assert row_id_from_account_id(resolve_account_id("juejin", {}, 13)) == "13"
    # 字段哈希档与 legacy 档都不带行 id —— 判据靠这条把"未知主人"留在保守侧
    assert row_id_from_account_id(resolve_account_id("juejin", {"sessionid": "s"})) is None
    assert row_id_from_account_id("juejin_legacy-abcd1234") is None
    assert row_id_from_account_id("") is None
    # 平台名里带 "db" 不得被误反解（前缀不是后缀）
    assert row_id_from_account_id("dbtest_field-0123456789ab") is None
