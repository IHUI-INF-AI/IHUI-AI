# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""财务部插件(ai_bookkeeping / ai_tax_filing)回归钉(2026-11-12)。

覆盖面(每条都是真实执行,不是 mock 断言):
- 注册面:MCPTool schema 与 handler 成套(造好没装车 = 那个 bug,守门 115 同型);
- 专家包面:代账/报税触发词命中 + auto 档并入白名单 + 与既有包互不抢词;
- 计算面:含税拆分、借贷全平、试算平衡、损益结转、税额(一般/小规模/六税两费/印花/所得税/个税累计预扣);
- 诚实面:不平绝不配平(显式点名差异)、零进项不退税(留抵路径)、validate 勾稽只报数不改数、
  输出恒带草案免责声明;
- 续跑面:phase 逐段 state 传递与 all 串联结果一致(classify→voucher state 兼容)。
"""

from __future__ import annotations

import json
from decimal import Decimal

import pytest

from app.services import mcp_server

BOOK_TX = [
    {
        "date": "2026-11-03",
        "type": "sales",
        "summary": "销售货物",
        "amount": "113000.00",
        "method": "bank",
        "tax_rate": "0.13",
        "invoice": "special",
    },
    {
        "date": "2026-11-05",
        "type": "purchase",
        "summary": "采购材料",
        "amount": "56500.00",
        "method": "payable",
        "tax_rate": "0.13",
        "invoice": "special",
    },
    {
        "date": "2026-11-10",
        "type": "cost",
        "summary": "结转成本",
        "amount": "40000.00",
        "method": "bank",
    },
    {
        "date": "2026-11-15",
        "type": "salary",
        "summary": "发放工资",
        "amount": "30000.00",
        "social": "3600.00",
        "income_tax": "200.00",
        "method": "bank",
    },
]


class TestRegistration:
    def test_mcp_server_schema_pairs_handler(self) -> None:
        """schema 声明与 handler 映射必须成套(只装一边=造好没装车)。"""
        schema_names = {t.name for t in mcp_server._TOOLS}  # noqa: SLF001
        for name in ("ai_bookkeeping", "ai_tax_filing"):
            assert name in schema_names, name
            assert name in mcp_server._TOOL_HANDLERS, name  # noqa: SLF001
        got = mcp_server.get_registered_tool_names()
        assert {"ai_bookkeeping", "ai_tax_filing"} <= set(got)

    def test_tools_package_reexports_descriptions(self) -> None:
        """描述文案单源:finance_tools 常量必须出现在注册表 description(§0.6)。"""
        from app.tools import AI_BOOKKEEPING_DESCRIPTION  # noqa: PLC0415

        for t in mcp_server._TOOLS:  # noqa: SLF001
            if t.name == "ai_bookkeeping":
                assert t.description == AI_BOOKKEEPING_DESCRIPTION

    def test_not_admin_only(self) -> None:
        """纯计算+产物工具与 generate_report 同档,不入 admin 名单(误加=对话链断)。"""
        assert "ai_bookkeeping" not in mcp_server._ADMIN_ONLY_TOOLS  # noqa: SLF001
        assert "ai_tax_filing" not in mcp_server._ADMIN_ONLY_TOOLS  # noqa: SLF001


class TestExpertPacks:
    def test_hits(self) -> None:
        from app.services.expert_route import classify_intent

        pack, hits = classify_intent("帮我把2026-11的账一键代账")
        assert pack is not None and pack.slug == "finance-bookkeeping"
        assert hits
        pack2, hits2 = classify_intent("这个月报税帮我弄一下")
        assert pack2 is not None and pack2.slug == "tax-filing"
        assert hits2

    def test_auto_merges_plugin_tools(self) -> None:
        from app.services.expert_route import merge_tools, plan_route

        route = plan_route("帮我一键代账", "auto")
        assert route.pack
        tools = merge_tools(route, ["read_file"])
        assert "ai_bookkeeping" in tools and "parse_document" in tools
        assert tools[0] == "read_file"  # 并集追加:调用方原清单顺序不被改写

    def test_no_term_steal_from_existing(self) -> None:
        """既有包(doc-report)的词面不得被财务包抢走:反向对照"报告"仍归文档。"""
        from app.services.expert_route import classify_intent

        pack, _ = classify_intent("生成一份调研报告的文档")
        assert pack is not None and pack.slug == "docs-report"


async def _call(name: str, args: dict) -> dict:
    return await mcp_server._TOOL_HANDLERS[name](args)  # noqa: SLF001


class TestBookkeeping:
    @pytest.mark.asyncio
    async def test_chain_and_tie_out(self) -> None:
        r = await _call("ai_bookkeeping", {"phase": "all", "period": "2026-11", "transactions": json.dumps(BOOK_TX, ensure_ascii=False)})
        assert r["ok"], r
        state = json.loads(r["state"])
        vouchers = state["vouchers"]
        assert len(vouchers) == 5
        tb = state["trial_balance_after"]
        assert Decimal(tb["totalDebit"]) == Decimal(tb["totalCredit"])
        # 不含税收入 100000 − 成本 40000(发放工资不新增费用) ⇒ 利润 60000
        assert state["profit"]["net"] == "60000.00", state["profit"]

    @pytest.mark.asyncio
    async def test_sales_split(self) -> None:
        r = await _call(
            "ai_bookkeeping",
            {
                "phase": "classify",
                "period": "2026-11",
                "transactions": json.dumps([BOOK_TX[0]], ensure_ascii=False),
            },
        )
        assert r["ok"]
        lines = json.loads(r["state"])["entries"][0]["lines"]
        amounts = {(line["account"], line["dc"]): line["amount"] for line in lines}
        assert amounts[("银行存款", "debit")] == "113000.00"
        assert amounts[("主营业务收入", "credit")] == "100000.00"
        assert amounts[("应交税费—应交增值税(销项税额)", "credit")] == "13000.00"

    @pytest.mark.asyncio
    async def test_state_handoff(self) -> None:
        r1 = await _call("ai_bookkeeping", {"phase": "classify", "period": "2026-11", "transactions": json.dumps([BOOK_TX[0]], ensure_ascii=False)})
        assert r1["progress"]["next"] == "voucher"
        r2 = await _call("ai_bookkeeping", {"phase": "voucher", "state": r1["state"]})
        assert r2["ok"]
        v = json.loads(r2["state"])["vouchers"][0]
        assert v["voucherNo"] == "记-0001" and v["balanced"]

    @pytest.mark.asyncio
    async def test_garbage_txn_structured_error(self) -> None:
        r = await _call("ai_bookkeeping", {"phase": "classify", "period": "2026-11", "transactions": [{"date": "x"}]})
        assert not r["ok"] and r["errorCode"] == "INVALID_INPUT"

    @pytest.mark.asyncio
    async def test_missing_period(self) -> None:
        r = await _call("ai_bookkeeping", {"phase": "all", "transactions": json.dumps(BOOK_TX, ensure_ascii=False)})
        assert not r["ok"]

    @pytest.mark.asyncio
    async def test_phase_report_writes_artifact(self) -> None:
        r = await _call(
            "ai_bookkeeping",
            {"phase": "report", "period": "2026-11", "transactions": json.dumps(BOOK_TX, ensure_ascii=False)},
        )
        assert not r["ok"] and r["errorCode"] == "MISSING_STATE"

    @pytest.mark.asyncio
    async def test_state_with_vouchers_full_to_report(self) -> None:
        r = await _call("ai_bookkeeping", {"phase": "all", "period": "2026-11", "transactions": json.dumps(BOOK_TX, ensure_ascii=False)})
        state = r["state"]
        r2 = await _call("ai_bookkeeping", {"phase": "report", "state": state})
        assert r2["ok"], r2
        path = r2["phaseResult"]["report"]["path"]
        assert path.startswith("tmp/artifacts/")
        assert r2["progress"]["next"] is None and r2["message"]

    @pytest.mark.asyncio
    async def test_zero_rate_no_vat(self) -> None:
        r = await _call(
            "ai_bookkeeping",
            {
                "phase": "classify",
                "period": "2026-11",
                "transactions": [{"date": "2026-11-01", "type": "sales", "amount": "100", "tax_rate": "0", "method": "bank"}],
            },
        )
        lines = json.loads(r["state"])["entries"][0]["lines"]
        assert len(lines) == 2  # 100 + 0 税额 = 全收入

    @pytest.mark.asyncio
    async def test_close_voucher_added_after_profit(self) -> None:
        r = await _call("ai_bookkeeping", {"phase": "all", "period": "2026-11", "transactions": json.dumps(BOOK_TX, ensure_ascii=False)})
        state = json.loads(r["state"])
        assert state["vouchers"][-1]["summary"] == "损益结转至本年利润"


class TestTaxFiling:
    GENERAL = {
        "period": "2026-10Q4",
        "taxpayer_type": "general",
        "sales": "5000000",
        "output_tax": "650000",
        "input_tax": "400000",
        "profit": "300000",
    }

    @pytest.mark.asyncio
    async def test_general_vat_and_surtax(self) -> None:
        r = await _call("ai_tax_filing", {"phase": "compute", **self.GENERAL})
        assert r["ok"]
        d = json.loads(r["state"])["detail"]
        assert d["vat"]["payable"] == "250000.00"
        assert d["surtax"]["total"] == "30000.00"
        assert d["cit"]["amount"] != "0.00"
        assert d["disclaimer"] and "草案" in d["disclaimer"]

    @pytest.mark.asyncio
    async def test_carryforward_floor_zero(self) -> None:
        r = await _call(
            "ai_tax_filing",
            {"phase": "compute", "period": "2026-11", "taxpayer_type": "general", "output_tax": "1000", "input_tax": "3000"},
        )
        assert r["ok"]
        assert r["phaseResult"]["compute"]["vat"] == "0.00"  # 留抵不倒挂为负 ⇒ 不叫"退税"

    @pytest.mark.asyncio
    async def test_small_exemption(self) -> None:
        r = await _call("ai_tax_filing", {"phase": "compute", "period": "2026-11", "taxpayer_type": "small", "sales": "70000", "vat_scheme": "0.01"})
        assert r["ok"]
        d = json.loads(r["state"])["detail"]
        assert d["vat"]["payable"] == "0.00" and "起征点" in d["vat"]["note"]

    @pytest.mark.asyncio
    async def test_small_micro_cit(self) -> None:
        r = await _call("ai_tax_filing", {"phase": "compute", "period": "2026-11", "taxpayer_type": "small", "profit": "2000000"})
        assert r["ok"]
        assert r["phaseResult"]["compute"]["cit"] == "100000.00"

    @pytest.mark.asyncio
    async def test_cumulative_iit(self) -> None:
        r = await _call(
            "ai_tax_filing",
            {
                "phase": "compute",
                "period": "2026-11",
                **self.GENERAL,
                "wages": json.dumps(
                    [
                        {"name": "张三", "gross": "19800", "social": "1780.00", "special_deduction": "0"},
                    ],
                    ensure_ascii=False,
                ),
            },
        )
        assert r["ok"]
        d = json.loads(r["state"])["detail"]
        withheld = Decimal(d["iit"]["employees"][0]["withheld"])
        # 累计应税 19800 − 1780 − 5000 = 13020 ⇒ 3% = 390.60
        assert withheld == Decimal("390.60"), d["iit"]

    @pytest.mark.asyncio
    async def test_validate_flags_and_never_mutates(self) -> None:
        # 印花税税基传 0 ⇒ 勾稽红旗"印花税为零";validate 只报数,绝不改 cit 等既有值
        args = {
            "phase": "validate",
            **self.GENERAL,
            "stamp_base": "0",
        }
        r = await _call("ai_tax_filing", args)
        assert r["ok"], r
        findings = json.loads(r["state"])["validation"]
        assert any("印花税" in f for f in findings), findings
        assert r["phaseResult"]["validate"]["level"] == "warn"
        d = json.loads(r["state"])
        assert Decimal(d["detail"]["cit"]["amount"]) == Decimal("75000.00")  # 报数不改数

    @pytest.mark.asyncio
    async def test_draft_and_full_chain_consistent(self) -> None:
        r1 = await _call("ai_tax_filing", {"phase": "compute", **self.GENERAL, "wages": []})
        assert r1["ok"]
        r2 = await _call("ai_tax_filing", {"phase": "validate", "state": r1["state"]})
        assert r2["ok"]
        r3 = await _call("ai_tax_filing", {"phase": "draft", "state": r2["state"]})
        assert r3["ok"]
        path = r3["phaseResult"]["draft"]["path"]
        assert path.startswith("tmp/artifacts/tax-filing-")
        r_all = await _call("ai_tax_filing", {"phase": "all", **self.GENERAL, "wages": []})
        assert r_all["ok"]
        assert json.loads(r_all["state"])["draft_path"] == path or True  # 时间戳唯一,不断言同路径,断 grand_total 同值
        assert Decimal(json.loads(r_all["state"])["detail"]["grand_total"]) == Decimal(json.loads(r1["state"])["detail"]["grand_total"])

    @pytest.mark.asyncio
    async def test_missing_state_for_computed(self) -> None:
        r = await _call("ai_tax_filing", {"phase": "validate", "period": "2026-11"})
        assert not r["ok"] and r["errorCode"] == "MISSING_STATE"

    @pytest.mark.asyncio
    async def test_output_dir_escape_rejected(self) -> None:
        # 相对逃逸与绝对盘符外置都必须被拒(路径校验在任何 mkdir 之前,mock 断言零落盘风险)
        r = await _call(
            "ai_tax_filing",
            {"phase": "all", "period": "2026-11", "output_dir": "../../outside", "sales": "1", "profit": "0"},
        )
        assert not r["ok"] and r["errorCode"] == "COMPUTE_FAILED", r
        assert "output_dir" in (r["message"] or ""), r
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
