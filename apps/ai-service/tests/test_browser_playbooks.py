# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器自动化点位包(app.tools.browser_playbooks)的契约自检。

判据直接消费生产模块本身(单一真相源,不复制点位数据):
  · 目标集与 finance_tools.PLATFORM_TARGETS 双向对齐(含 housing_fund 补口);
  · 结构完整性:points 带候选定位器 + probe_order + receipt;
  · 红线不可退化:写操作/申报类目标必须 manual gate,资金类禁用词必须在 never_click;
  · build_point_pack 的缺事实行为:保留占位并点名 missing_facts,绝不猜地址/期间。
"""

from __future__ import annotations

import re

from app.tools import finance_tools
from app.tools.browser_playbooks import (
    COMMON_CONTRACT,
    PLAYBOOKS,
    POINT_PACK_VERSION,
    build_point_pack,
    list_targets,
)

DECLARATIVE_TARGETS = {
    "etax_vat_declaration",
    "etax_cit_quarterly",
    "etax_iit_declaration",
    "social_insurance",
    "medical_insurance",
    "housing_fund",
}

FUND_NEVER_WORDS = re.compile(r"缴款|缴费|转账|付款|作废|红字|扣款|代发")

_TEMPLATE_TOKEN = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}")


def test_target_set_aligns_with_platform_targets() -> None:
    """点位包目标与叙述面目标必须双向一致(漂移即红)。"""
    assert set(PLAYBOOKS) == set(finance_tools.PLATFORM_TARGETS)
    assert len(PLAYBOOKS) == 8
    assert "housing_fund" in PLAYBOOKS


def test_list_targets_shape() -> None:
    targets = list_targets()
    assert {t["id"] for t in targets} == set(PLAYBOOKS)
    for t in targets:
        assert t["label"] and t["surface"]
        assert t["pointCount"] > 0
        assert t["hasSubmitGate"] == (t["id"] in DECLARATIVE_TARGETS)


def test_every_point_pack_structure() -> None:
    for tid, pb in PLAYBOOKS.items():
        assert pb["entry"]["url"], f"{tid} 缺 entry.url"
        assert pb["entry"]["path_hint"], f"{tid} 缺 entry.path_hint"
        assert pb["points"], f"{tid} 无点位"
        keys = [p["key"] for p in pb["points"]]
        assert keys.count("login_state") == 1, f"{tid} 登录态探测点必须恰一枚"
        assert "captcha_or_gate" in keys, f"{tid} 缺验证码/人脸/U盾识别点"
        for p in pb["points"]:
            assert p["intent"], f"{tid}/{p['key']} 缺点位意图"
            assert p["locators"], f"{tid}/{p['key']} 无候选定位器"
            if "probe_order" in p:
                assert p["probe_order"] == COMMON_CONTRACT["probe_order"], (
                    f"{tid}/{p['key']} 探测顺序偏离共用契约"
                )
            for loc in p["locators"]:
                assert loc.get("by") and loc.get("value"), f"{tid}/{p['key']} 定位器候选缺 by/value"
            if p.get("action") == "type_text":
                assert p["value_template"], f"{tid}/{p['key']} 填值点缺 value_template"
        guards = pb["guards"]
        assert guards["never_click"] or guards["manual_gate"], f"{tid} 红线为空"
        assert "receipt_policy" in COMMON_CONTRACT


def test_declarative_targets_have_human_submit_gate() -> None:
    for tid in DECLARATIVE_TARGETS:
        submit = PLAYBOOKS[tid].get("submit")
        assert submit and submit["requires_human"] is True, f"{tid} 提交闸丢失(不得静默代报)"
    # 取数类目标不产生提交动作
    for tid in set(PLAYBOOKS) - DECLARATIVE_TARGETS:
        assert "submit" not in PLAYBOOKS[tid]


def test_fund_targets_never_click_money_words() -> None:
    for tid in ("bank_statement", "etax_vat_declaration", "social_insurance"):
        never = "|".join(PLAYBOOKS[tid]["guards"]["never_click"])
        assert FUND_NEVER_WORDS.search(never), f"{tid} 资金不可逆动作未列入 never_click"


def test_point_pack_requires_facts_no_guessing() -> None:
    pack = build_point_pack("etax_invoice_ledger", {})
    assert "missing_facts" in pack
    assert "etax_portal" in pack["missing_facts"]
    assert "period" in pack["missing_facts"]
    assert "缺事实" in pack["missing_policy"]
    assert pack["version"] == POINT_PACK_VERSION
    assert pack["contract"] is COMMON_CONTRACT or pack["contract"] == COMMON_CONTRACT


def test_point_pack_resolves_all_templates_with_facts() -> None:
    portal_targets = {}
    for tid, pb in PLAYBOOKS.items():
        tokens = {m.group(0).strip("{}") for m in _TEMPLATE_TOKEN.finditer(str(pb))}
        portal_targets[tid] = tokens
    for tid, tokens in portal_targets.items():
        facts = {t: f"https://example.test/{t}" for t in tokens}
        # 期间类模板给月份形态,金额位给数字串
        for t in tokens:
            if "period" in t or "month" in t or "date" in t:
                facts[t] = "2026-10"
            elif "amount" in t or "tax" in t or "base" in t:
                facts[t] = "1234.56"
            else:
                facts[t] = f"fact-{t}"
        pack = build_point_pack(tid, facts)
        assert "missing_facts" not in pack, f"{tid} 给全 facts 仍报缺:{pack.get('missing_facts')}"
        dumped = str(pack)
        left = [m.group(0) for m in _TEMPLATE_TOKEN.finditer(dumped)]
        assert not left, f"{tid} 存在未登记模板位:{left}"


def test_unknown_target_raises() -> None:
    try:
        build_point_pack("not_a_real_target", {})
    except ValueError as exc:
        assert "未注册点位包" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("未注册目标必须抛 ValueError")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
