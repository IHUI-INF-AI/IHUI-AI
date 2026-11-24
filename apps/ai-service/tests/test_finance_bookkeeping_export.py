# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""代账→入账确定性转换器(ai_bookkeeping ledger_ops_payloads)的契约自检。

判据消费生产函数本身(单一真相源):
  · 零破坏:不传 ledger_id 时返回面不得出现 ledger_ops_payloads 键;
  · 映射写死:account→accountCode、dc→direction、memo→summary;
  · fail-closed:不平/缺科目/缺日期 ⇒ 整条进 blocked 点名,不静默丢条。
"""

from __future__ import annotations

import json

from app.tools.finance_tools import _bookkeeping, _ledger_ops_payloads

TX = [
    {
        "date": "2026-11-05",
        "type": "expense",
        "amount": "1130.00",
        "method": "bank",
        "tax_rate": "0.13",
        "invoice": "special",
        "counterparty": "供应商甲",
        "summary": "采购办公用品",
    }
]


def _run(**extra):
    """单步档必须续跑:vouchers 阶段只认 state.entries ⇒ 先 classify 再按 extra 跑 voucher 段"""
    r1 = _bookkeeping({"transactions": TX, "period": "2026-11", "phase": "classify"})
    assert r1["ok"] is True, r1
    r2 = _bookkeeping({"state": r1["state"], "period": "2026-11", "phase": "voucher", **extra})
    return r2


def test_without_ledger_id_no_export_key() -> None:
    r = _run()
    assert r["ok"] is True
    assert "ledger_ops_payloads" not in r, "不带 ledger_id 时返回面必须与历史一致(零破坏)"


def test_with_ledger_id_payload_mapping() -> None:
    r = _run(ledger_id="3f2b6b74-0000-4000-8000-aaaaaaaaaaaa")
    assert r["ok"] is True
    exp = r["ledger_ops_payloads"]
    assert exp["blocked"] == []
    assert len(exp["payloads"]) >= 1
    for item in exp["payloads"]:
        assert item["action"] == "voucher.create"
        p = item["payload"]
        assert p["ledgerId"] == "3f2b6b74-0000-4000-8000-aaaaaaaaaaaa"
        assert p["period"] == "2026-11"
        assert p["voucherDate"] == "2026-11-05"
        assert p["sourceRef"].startswith("ai-bookkeeping:2026-11:")
        for line in p["lines"]:
            # 两侧字段名钉死:api lineBody 只认这套
            assert set(line) <= {"accountCode", "direction", "amount", "summary"}
            assert line["direction"] in ("debit", "credit")
            assert line["accountCode"]
        debit = sum(float(l["amount"]) for l in p["lines"] if l["direction"] == "debit")
        credit = sum(float(l["amount"]) for l in p["lines"] if l["direction"] == "credit")
        assert round(debit - credit, 2) == 0


def test_blocked_entries_are_named_not_dropped() -> None:
    state = {
        "period": "2026-11",
        "vouchers": [
            {"voucherNo": "记-0001", "date": "2026-11-05", "summary": "平", "balanced": True,
             "lines": [{"account": "6602", "dc": "debit", "amount": "10.00", "memo": "a"},
                       {"account": "1002", "dc": "credit", "amount": "10.00", "memo": "b"}]},
            {"voucherNo": "记-0002", "date": "2026-11-06", "summary": "不平", "balanced": False,
             "lines": [{"account": "6602", "dc": "debit", "amount": "10.00", "memo": "a"},
                       {"account": "1002", "dc": "credit", "amount": "9.00", "memo": "b"}]},
            {"voucherNo": "记-0003", "date": "", "summary": "缺日期", "balanced": True,
             "lines": [{"account": "6602", "dc": "debit", "amount": "1.00", "memo": "a"},
                       {"account": "x", "dc": "sideways", "amount": "1.00", "memo": "b"}]},
            {"voucherNo": "记-0004", "date": "2026-11-07", "summary": "缺科目", "balanced": True,
             "lines": [{"account": "", "dc": "debit", "amount": "5.00", "memo": "a"},
                       {"account": "1002", "dc": "credit", "amount": "5.00", "memo": "b"}]},
        ],
    }
    out = _ledger_ops_payloads(state, "L1")
    nos_ok = {i["payload"]["sourceRef"].split(":")[-1] for i in out["payloads"]}
    blocked_nos = {b["voucherNo"] for b in out["blocked"]}
    assert nos_ok == {"记-0001"}
    assert blocked_nos == {"记-0002", "记-0003", "记-0004"}
    # 每条 blocked 都有点名理由
    assert all(b.get("reason") for b in out["blocked"])


def test_continuation_state_roundtrip_carries_export() -> None:
    r1 = _run(phase="classify", ledger_id="L2")
    assert r1["ok"]
    state = json.loads(r1["state"])
    r2 = _bookkeeping({"state": json.dumps({**state, "vouchers": None}), "period": "2026-11", "phase": "voucher"})
    # state 无 vouchers 时 voucher 阶段自 state.entries 重建
    assert r2["ok"]
    r3 = _bookkeeping({"state": r2["state"], "period": "2026-11", "phase": "trial_balance", "ledger_id": "L2"})
    assert r3["ok"]
    assert "ledger_ops_payloads" in r3 and r3["ledger_ops_payloads"]["payloads"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
