# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""D159 补:落规则的那个目标,必须就是弹窗里让用户看见的那一个。

为什么单独开这个文件(不并进 `test_network_approval_grant_d159.py`):那条判据住在写侧
`network_target_from_args`,而帧上的 `network_target` 住在 `approval_env_payload` ——
两处各自取"第一个"时取的是**不同列表**(一个含被判死的本地目标,一个只含可放行的),
用户批的是 A、库里落的是 B。`test_network_approval_grant_d159.py` 由另一路会话持有,
本文件只补它没有覆盖的这一格,不改它任何一条既有断言。

两条用例是成对的:
① 混带"本地(静态策略判死)+ 公网"两个目标 ⇒ 落库的必须是公网那个,且命中侧对公网免弹、
   对本地**不免弹**(静态策略不是靠免弹窗能绕的);
② 全部目标都被判死 ⇒ 什么都不能落(免弹窗规则改变不了静态策略,落它等于把"永远该问"
   写成"永远不问")。
全程独立 SQLite,不触生产库(AGENTS §5 测试隔离铁律)。
"""

from __future__ import annotations

import pytest

from app.services import approval_persistence as ap
from app.services import network_approval as na

A = "11111111-1111-4111-8111-111111111111"
LOCAL = "http://127.0.0.1:8080/x"
PUB = "https://api.example.com:8443/v1/echo"


@pytest.fixture()
def db(tmp_path, monkeypatch):
    monkeypatch.setattr(ap, "_DB_PATH", tmp_path / "d159_align.db")
    ap.close()
    yield ap
    ap.close()


@pytest.fixture()
def env_on(monkeypatch):
    monkeypatch.setenv("IHUI_APPROVAL_ENV_REPORT", "1")
    yield


def _mixed_args() -> dict[str, str]:
    """一次调用同时带两个出站目标:第一个被静态策略判死,第二个才是可批的那一个。"""
    return {"url": LOCAL, "webhook_url": PUB}


def test_落库目标等于帧上可见目标(db, env_on):
    args = _mixed_args()
    frame = na.approval_env_payload("send_message", args, owner=A)
    shown = (frame.get("network_target") or {}).get("display")
    assert shown == "api.example.com:8443", "帧上应当只报可放行的那个目标"

    fact = na.network_target_from_args(args, owner=A)
    assert fact is not None and fact.display == shown, (
        "写侧取的目标与帧上给用户看的目标必须同形 —— 不同形就是把用户没批过的目标连出去"
    )
    assert na.grant_network_target(fact, "always") is True
    assert na.check_network_grant(fact) == "always"
    # 本地那个目标既不因这条规则免弹,也不该被落库
    local = na.describe_network_target(LOCAL, owner=A)
    assert local is not None and local.reason == na.DENIAL_REASON_NOT_ALLOWED_LOCAL
    assert na.check_network_grant(local) is None
    keys = db.list_keys("network")
    assert keys == [fact.owner_bound_key], f"库里只该有公网那一条,实得 {keys}"


def test_全部目标都被判死时一条规则都不落(db, env_on):
    """无可放行目标 ⇒ None ⇒ 不落库(不是"落一条本地规则")。"""
    fact = na.network_target_from_args({"url": LOCAL}, owner=A)
    assert fact is None
    assert db.list_keys("network") == []


def test_两个都可放行时帧与写侧取同一个():
    """顺序维度的同形锁:帧报"第一个可放行的",写侧也必须落"第一个可放行的"。

    这条不是 test_落库目标… 的重复 —— 那一格在"第一个目标已被静态策略判死"时才会红,
    而这一格两个目标都可放行:若写侧改成取列表尾部(或最后一个),前者仍是绿的、
    这条会红。两处各排一遍序就分叉,而分叉的形态是"用户批了 A、免弹窗规则挂在 B"。
    """
    first = "https://api.example.com:8443/v1/echo"
    second = "https://other.example.com/hook"
    args = {"url": first, "webhook_url": second}
    frame = na.approval_env_payload("send_message", args, owner=A)
    shown = (frame.get("network_target") or {}).get("display")
    fact = na.network_target_from_args(args, owner=A)
    assert fact is not None
    assert shown == "api.example.com:8443"
    assert fact.display == shown, (
        f"帧上给用户看的是 {shown},写侧要落的是 {fact.display} —— 两个都要放行的目标取了不同的头"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
