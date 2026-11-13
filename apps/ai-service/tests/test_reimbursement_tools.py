# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""财务部插件 ai_reimbursement(一键报账报销)回归钉。

覆盖:正常差旅/招待/教育/福利各类的抵扣与限额判定、超限额点名、无票补票提示、
重复报销检出、借贷平衡、Decimal 边界(招待费 60% vs 0.5% 孰低)、progress 块、
草案 disclaimer 存在。每条都是真实执行,不是 mock 断言。
"""

from __future__ import annotations

import json
from decimal import Decimal

import pytest

from app.tools.reimbursement_tools import (
    AI_REIMBURSEMENT_DESCRIPTION,
    CATEGORIES,
    DEFAULT_EDU_RATIO,
    DEFAULT_ENTERTAIN_INCUR_RATIO,
    DEFAULT_ENTERTAIN_REVENUE_RATIO,
    DEFAULT_LODGING_LIMITS,
    DEFAULT_WELFARE_RATIO,
    _build_entries,
    _check_period_limits,
    _detect_duplicates,
    _judge_vat,
    _money,
    _normalize_reimbursements,
    _q,
    ai_reimbursement,
)


def _run(reimbursements, **kw):
    """便利:构造 arguments 并跑 async 入口(同步套一层 event loop)。"""
    import asyncio

    args = {"reimbursements": reimbursements, "period": kw.pop("period", "2026-11")}
    args.update(kw)
    return asyncio.run(ai_reimbursement(args))


class TestHelpers:
    def test_money_rejects_bool_and_nan(self) -> None:
        with pytest.raises(ValueError, match="不接受布尔值"):
            _money(True, "x")
        with pytest.raises(ValueError, match="有限值"):
            _money(float("nan"), "x")

    def test_normalize_accepts_json_string(self) -> None:
        rows = _normalize_reimbursements(
            json.dumps(
                [
                    {
                        "employee": "张三",
                        "category": "travel_transport",
                        "amount": "1000.00",
                        "date": "2026-11-05",
                        "invoice_type": "special",
                    }
                ]
            )
        )
        assert len(rows) == 1
        assert rows[0]["amount"] == Decimal("1000.00")
        assert rows[0]["category"] == "travel_transport"

    def test_normalize_rejects_bad_category(self) -> None:
        with pytest.raises(ValueError, match="category"):
            _normalize_reimbursements(
                [{"category": "nope", "amount": "1.00", "date": "2026-11-01"}]
            )

    def test_q_two_decimals(self) -> None:
        assert _q(Decimal("1.005")) == "1.00"  # ROUND_HALF_EVEN
        assert _q(Decimal("1.006")) == "1.01"


class TestVatDeduction:
    def test_special_invoice_deductible(self) -> None:
        item = {
            "employee": "张三",
            "category": "travel_transport",
            "amount": Decimal("106.00"),
            "date": "2026-11-05",
            "invoice_type": "special",
            "vat_rate": Decimal("0.06"),
        }
        r = _judge_vat(item)
        assert r["deductible"] is True
        assert r["inputVat"] == "6.00"
        assert r["netAmount"] == "100.00"

    def test_none_invoice_not_deductible_with_advice(self) -> None:
        item = {
            "employee": "李四",
            "category": "office",
            "amount": Decimal("200.00"),
            "date": "2026-11-05",
            "invoice_type": "none",
            "vat_rate": Decimal("0.06"),
        }
        r = _judge_vat(item)
        assert r["deductible"] is False
        assert "补票" in r["advice"]

    def test_entertainment_never_deductible(self) -> None:
        """招待费即便取到专票,多数情形进项也不得抵扣(税法口径的简化判定)。"""
        item = {
            "employee": "王五",
            "category": "entertainment",
            "amount": Decimal("1000.00"),
            "date": "2026-11-05",
            "invoice_type": "special",
            "vat_rate": Decimal("0.06"),
        }
        r = _judge_vat(item)
        assert r["deductible"] is False
        assert "招待" in r["reason"] or "福利" in r["reason"] or "餐饮" in r["reason"]

    def test_general_invoice_not_deductible(self) -> None:
        item = {
            "employee": "赵六",
            "category": "travel_transport",
            "amount": Decimal("100.00"),
            "date": "2026-11-05",
            "invoice_type": "general",
            "vat_rate": Decimal("0.06"),
        }
        r = _judge_vat(item)
        assert r["deductible"] is False


class TestCompliance:
    def test_lodging_over_limit_named(self) -> None:
        """住宿超限额必须逐条点名超多少。"""
        rows = [
            {
                "employee": "张三",
                "category": "travel_lodging",
                "amount": "1200.00",
                "date": "2026-11-05",
                "invoice_type": "special",
                "city_tier": "一线",
                "nights": "1",
            }
        ]
        r = _run(rows)
        assert r["ok"] is True
        codes = [i["code"] for i in r["phaseResult"]["issues"]]
        assert "LODGING_OVER_LIMIT" in codes
        over_issue = next(
            i for i in r["phaseResult"]["issues"] if i["code"] == "LODGING_OVER_LIMIT"
        )
        # 一线缺省 600/晚 × 1 晚 = 600,超出 600
        assert over_issue["cap"] == "600.00"
        assert over_issue["overAmount"] == "600.00"

    def test_lodging_limit_overridable(self) -> None:
        """住宿限额是可覆盖参数:把一线调到 1500 后不再触发。"""
        rows = [
            {
                "employee": "张三",
                "category": "travel_lodging",
                "amount": "1200.00",
                "date": "2026-11-05",
                "invoice_type": "special",
                "city_tier": "一线",
                "nights": "1",
            }
        ]
        r = _run(rows, lodging_limits={"一线": "1500.00"})
        codes = [i["code"] for i in r["phaseResult"]["issues"]]
        assert "LODGING_OVER_LIMIT" not in codes

    def test_missing_invoice_flagged(self) -> None:
        rows = [
            {
                "employee": "李四",
                "category": "office",
                "amount": "200.00",
                "date": "2026-11-05",
                "invoice_type": "none",
            }
        ]
        r = _run(rows)
        codes = [i["code"] for i in r["phaseResult"]["issues"]]
        assert "MISSING_INVOICE" in codes

    def test_zero_amount_rejected(self) -> None:
        rows = [
            {
                "employee": "李四",
                "category": "office",
                "amount": "0.00",
                "date": "2026-11-05",
                "invoice_type": "special",
            }
        ]
        r = _run(rows)
        codes = [i["code"] for i in r["phaseResult"]["issues"]]
        assert "NON_POSITIVE_AMOUNT" in codes

    def test_negative_amount_rejected(self) -> None:
        rows = [
            {
                "employee": "李四",
                "category": "office",
                "amount": "-50.00",
                "date": "2026-11-05",
                "invoice_type": "special",
            }
        ]
        r = _run(rows)
        codes = [i["code"] for i in r["phaseResult"]["issues"]]
        assert "NON_POSITIVE_AMOUNT" in codes

    def test_duplicate_detected(self) -> None:
        """同员工 + 同金额 + 同日期 ⇒ 疑似重复报销。"""
        rows = [
            {
                "employee": "张三",
                "category": "travel_transport",
                "amount": "500.00",
                "date": "2026-11-05",
                "invoice_type": "special",
            },
            {
                "employee": "张三",
                "category": "travel_transport",
                "amount": "500.00",
                "date": "2026-11-05",
                "invoice_type": "special",
            },
        ]
        r = _run(rows)
        codes = [i["code"] for i in r["phaseResult"]["issues"]]
        assert "SUSPECTED_DUPLICATE" in codes
        dups = _detect_duplicates(_normalize_reimbursements(rows))
        assert len(dups) == 1
        assert dups[0]["firstIndex"] == 0 and dups[0]["dupIndex"] == 1


class TestPeriodLimits:
    def test_entertainment_60_vs_05_whichever_lower(self) -> None:
        """Decimal 边界:招待 60% 与收入 0.5% 孰低——0.5% 更低时以 0.5% 为限。"""
        rows = [
            {
                "employee": "王五",
                "category": "entertainment",
                "amount": "10000.00",
                "date": "2026-11-05",
                "invoice_type": "general",
            }
        ]
        # 60% × 10000 = 6000;0.5% × 800000 = 4000 ⇒ 取 4000
        issues = _check_period_limits(
            _normalize_reimbursements(rows),
            revenue=Decimal("800000.00"),
            wage_total=None,
            entertain_incur_ratio=DEFAULT_ENTERTAIN_INCUR_RATIO,
            entertain_revenue_ratio=DEFAULT_ENTERTAIN_REVENUE_RATIO,
            edu_ratio=DEFAULT_EDU_RATIO,
            welfare_ratio=DEFAULT_WELFARE_RATIO,
        )
        ent = [i for i in issues if i["code"] == "ENTERTAINMENT_OVER_LIMIT"]
        assert ent, issues
        assert ent[0]["cap"] == "4000.00"
        assert ent[0]["overAmount"] == "6000.00"
        assert ent[0]["capRevenue"] == "4000.00"
        assert ent[0]["capIncur"] == "6000.00"

    def test_entertainment_60_lower_when_revenue_high(self) -> None:
        """60% 更低时以 60% 为限。"""
        rows = [
            {
                "employee": "王五",
                "category": "entertainment",
                "amount": "10000.00",
                "date": "2026-11-05",
                "invoice_type": "general",
            }
        ]
        # 60% × 10000 = 6000;0.5% × 5000000 = 25000 ⇒ 取 6000
        issues = _check_period_limits(
            _normalize_reimbursements(rows),
            revenue=Decimal("5000000.00"),
            wage_total=None,
            entertain_incur_ratio=DEFAULT_ENTERTAIN_INCUR_RATIO,
            entertain_revenue_ratio=DEFAULT_ENTERTAIN_REVENUE_RATIO,
            edu_ratio=DEFAULT_EDU_RATIO,
            welfare_ratio=DEFAULT_WELFARE_RATIO,
        )
        ent = [i for i in issues if i["code"] == "ENTERTAINMENT_OVER_LIMIT"]
        assert ent[0]["cap"] == "6000.00"
        assert ent[0]["capIncur"] == "6000.00"

    def test_entertainment_within_limit_when_ratio_overridden(self) -> None:
        """60% 是硬上限;把缺省 incur_ratio 覆盖到 1.00 后,发生额 1000.00 恰在限额内 ⇒ 不触发。"""
        rows = [
            {
                "employee": "王五",
                "category": "entertainment",
                "amount": "1000.00",
                "date": "2026-11-05",
                "invoice_type": "general",
            }
        ]
        # 缺省 60% × 1000 = 600,但 incur_ratio 覆盖为 1.00 ⇒ 上限抬到 1000.00
        # 0.5% × 5000000 = 25000,孰低取 1000.00 ⇒ 未超
        issues = _check_period_limits(
            _normalize_reimbursements(rows),
            revenue=Decimal("5000000.00"),
            wage_total=None,
            entertain_incur_ratio=Decimal("1.00"),
            entertain_revenue_ratio=DEFAULT_ENTERTAIN_REVENUE_RATIO,
            edu_ratio=DEFAULT_EDU_RATIO,
            welfare_ratio=DEFAULT_WELFARE_RATIO,
        )
        assert not [i for i in issues if i["code"] == "ENTERTAINMENT_OVER_LIMIT"]

    def test_education_over_8_pct(self) -> None:
        """教育经费超工资 8% 必须点名。"""
        rows = [
            {
                "employee": "赵六",
                "category": "education",
                "amount": "100000.00",
                "date": "2026-11-05",
                "invoice_type": "special",
            }
        ]
        r = _run(rows, wage_total="1000000.00")  # 8% ⇒ 80000,超 20000
        issues = [i for i in r["phaseResult"]["issues"] if i["code"] == "EDUCATION_OVER_LIMIT"]
        assert issues
        assert issues[0]["cap"] == "80000.00"
        assert issues[0]["overAmount"] == "20000.00"

    def test_welfare_over_14_pct(self) -> None:
        rows = [
            {
                "employee": "赵六",
                "category": "welfare",
                "amount": "200000.00",
                "date": "2026-11-05",
                "invoice_type": "special",
            }
        ]
        r = _run(rows, wage_total="1000000.00")  # 14% ⇒ 140000,超 60000
        issues = [i for i in r["phaseResult"]["issues"] if i["code"] == "WELFARE_OVER_LIMIT"]
        assert issues
        assert issues[0]["cap"] == "140000.00"
        assert issues[0]["overAmount"] == "60000.00"

    def test_ratios_overridable(self) -> None:
        """教育/福利/招待比例是可覆盖参数。"""
        rows = [
            {
                "employee": "赵六",
                "category": "education",
                "amount": "100000.00",
                "date": "2026-11-05",
                "invoice_type": "special",
            }
        ]
        # 把教育比例覆盖到 0.20 ⇒ 200000 限额,不触发
        r = _run(rows, wage_total="1000000.00", edu_ratio="0.20")
        assert not [
            i for i in r["phaseResult"]["issues"] if i["code"] == "EDUCATION_OVER_LIMIT"
        ]


class TestIncomeTax:
    def test_travel_transport_not_in_salary(self) -> None:
        rows = [
            {
                "employee": "张三",
                "category": "travel_transport",
                "amount": "500.00",
                "date": "2026-11-05",
                "invoice_type": "special",
            }
        ]
        r = _run(rows)
        assert r["phaseResult"]["incomeTaxDetails"][0]["includeInSalary"] is False

    def test_travel_meal_over_allowance_included(self) -> None:
        """餐饮超出定额补助(缺省 100/天)的部分并入工资薪金。"""
        rows = [
            {
                "employee": "张三",
                "category": "travel_meal",
                "amount": "800.00",
                "date": "2026-11-05",
                "invoice_type": "general",
                "nights": "2",  # 定额 100 × 2 = 200,超 600
            }
        ]
        r = _run(rows)
        d = r["phaseResult"]["incomeTaxDetails"][0]
        assert d["includeInSalary"] is True
        assert d["amountIncluded"] == "600.00"

    def test_include_in_salary_total_summed(self) -> None:
        rows = [
            {
                "employee": "张三",
                "category": "travel_meal",
                "amount": "800.00",
                "date": "2026-11-05",
                "invoice_type": "general",
                "nights": "2",
            },
            {
                "employee": "张三",
                "category": "travel_transport",
                "amount": "500.00",
                "date": "2026-11-06",
                "invoice_type": "special",
            },
        ]
        r = _run(rows)
        assert r["phaseResult"]["totals"]["includeInSalary"] == "600.00"


class TestEntries:
    def test_entries_balanced_normal(self) -> None:
        rows = [
            {
                "employee": "张三",
                "category": "travel_transport",
                "amount": "106.00",
                "date": "2026-11-05",
                "invoice_type": "special",
                "vat_rate": "0.06",
            },
            {
                "employee": "李四",
                "category": "office",
                "amount": "212.00",
                "date": "2026-11-06",
                "invoice_type": "special",
                "vat_rate": "0.06",
            },
        ]
        entries, warnings = _build_entries(_normalize_reimbursements(rows))
        assert entries, entries
        for e in entries:
            assert e["balanced"] is True
            assert e["debitTotal"] == e["creditTotal"]
        assert not warnings

    def test_entries_grouped_by_category(self) -> None:
        rows = [
            {
                "employee": "张三",
                "category": "travel_transport",
                "amount": "106.00",
                "date": "2026-11-05",
                "invoice_type": "special",
                "vat_rate": "0.06",
            },
            {
                "employee": "李四",
                "category": "travel_transport",
                "amount": "53.00",
                "date": "2026-11-06",
                "invoice_type": "special",
                "vat_rate": "0.06",
            },
        ]
        entries, _ = _build_entries(_normalize_reimbursements(rows))
        assert len(entries) == 1  # 同类别聚合为一张凭证
        assert "2 笔" in entries[0]["summary"]

    def test_input_vat_line_present(self) -> None:
        rows = [
            {
                "employee": "张三",
                "category": "travel_transport",
                "amount": "106.00",
                "date": "2026-11-05",
                "invoice_type": "special",
                "vat_rate": "0.06",
            }
        ]
        entries, _ = _build_entries(_normalize_reimbursements(rows))
        accounts = [l["account"] for l in entries[0]["lines"]]
        assert "应交税费-应交增值税(进项税额)" in accounts

    def test_entertainment_no_input_vat_line(self) -> None:
        """招待费即便专票也不可抵,分录不应出现进项税额行。"""
        rows = [
            {
                "employee": "王五",
                "category": "entertainment",
                "amount": "1000.00",
                "date": "2026-11-05",
                "invoice_type": "special",
                "vat_rate": "0.06",
            }
        ]
        entries, _ = _build_entries(_normalize_reimbursements(rows))
        accounts = [l["account"] for l in entries[0]["lines"]]
        assert "应交税费-应交增值税(进项税额)" not in accounts
        assert entries[0]["balanced"] is True


class TestContract:
    def test_progress_block_present(self) -> None:
        rows = [
            {
                "employee": "张三",
                "category": "travel_transport",
                "amount": "100.00",
                "date": "2026-11-05",
                "invoice_type": "special",
            }
        ]
        r = _run(rows)
        assert r["ok"] is True
        assert "progress" in r
        p = r["progress"]
        assert set(p) >= {"phase", "phaseIndex", "of", "completed", "next"}

    def test_disclaimer_present(self) -> None:
        r = _run([])
        assert "草案" in r["disclaimer"]
        assert "主管税务机关核定为准" in r["disclaimer"]

    def test_description_constant_declares_redlines(self) -> None:
        assert "草案" in AI_REIMBURSEMENT_DESCRIPTION
        assert "主管税务机关核定为准" in AI_REIMBURSEMENT_DESCRIPTION
        assert "reimbursements" in AI_REIMBURSEMENT_DESCRIPTION

    def test_structured_failure_on_bad_args(self) -> None:
        r = _run("not-a-list")
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_INPUT"
        assert r["tool"] == "ai_reimbursement"

    def test_structured_failure_on_missing_period(self) -> None:
        import asyncio

        r = asyncio.run(
            ai_reimbursement(
                {
                    "reimbursements": [
                        {
                            "employee": "张三",
                            "category": "office",
                            "amount": "100.00",
                            "date": "2026-11-05",
                            "invoice_type": "special",
                        }
                    ]
                }
            )
        )
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_INPUT"

    def test_output_dir_outside_project_root_rejected(self) -> None:
        import asyncio

        r = asyncio.run(
            ai_reimbursement(
                {
                    "reimbursements": [],
                    "period": "2026-11",
                    "output_dir": "C:/Windows/Temp",
                }
            )
        )
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_OUTPUT_DIR"

    def test_artifacts_written(self, tmp_path) -> None:
        """产物 HTML/JSON 必须真实落盘(落在项目根内的 tmp/artifacts 缺省目录)。"""
        rows = [
            {
                "employee": "张三",
                "category": "travel_transport",
                "amount": "106.00",
                "date": "2026-11-05",
                "invoice_type": "special",
                "vat_rate": "0.06",
            }
        ]
        r = _run(rows, period="2026-11")
        assert r["ok"] is True
        html_rel = r["artifacts"]["html"]
        json_rel = r["artifacts"]["json"]
        from pathlib import Path

        html_path = Path(html_rel)
        json_path = Path(json_rel)
        if not html_path.is_absolute():
            from app.tools.reimbursement_tools import _PROJECT_ROOT

            html_path = _PROJECT_ROOT / html_rel
            json_path = _PROJECT_ROOT / json_rel
        assert html_path.exists() and html_path.stat().st_size > 200
        assert json_path.exists()
        payload = json.loads(json_path.read_text(encoding="utf-8"))
        assert payload["tool"] == "ai_reimbursement"
        assert payload["disclaimer"]

    def test_categories_enum_declared(self) -> None:
        assert set(CATEGORIES) == {
            "travel_transport",
            "travel_lodging",
            "travel_meal",
            "entertainment",
            "education",
            "welfare",
            "office",
            "other",
            "conference",
            "travel_per_diem",
        }

    def test_default_params_visible(self) -> None:
        """外部政策数字必须做成可覆盖的缺省参数。"""
        assert Decimal(DEFAULT_LODGING_LIMITS["一线"]) == Decimal("600.00")
        assert DEFAULT_ENTERTAIN_INCUR_RATIO == Decimal("0.60")
        assert DEFAULT_ENTERTAIN_REVENUE_RATIO == Decimal("0.005")
        assert DEFAULT_EDU_RATIO == Decimal("0.08")
        assert DEFAULT_WELFARE_RATIO == Decimal("0.14")


# ---------------------------------------------------------------------------
# 增值税进项税额转出(独立能力 vat_input_transfer_out)
# ---------------------------------------------------------------------------
class TestVatInputTransferOut:
    """进项税额转出:集体福利/个人消费/非应税/非正常损失,价税分离与借贷平衡。"""

    def test_collective_welfare_split(self) -> None:
        from app.tools.reimbursement_tools import vat_input_transfer_out

        r = vat_input_transfer_out(
            [{"employee": "张三", "date": "2026-11-05", "category": "welfare",
              "amount": "1130.00", "reason": "collective_welfare"}]
        )
        assert r["ok"] is True
        d = r["details"][0]
        # 含税 1130 / 1.13 × 0.13 = 130.00,不含税 = 1000.00
        assert d["transferTax"] == "130.00"
        assert d["netAmount"] == "1000.00"
        assert d["debitAccount"] == "应付职工薪酬-集体福利"
        e = r["entries"][0]
        assert e["balanced"] is True
        assert e["lines"][1]["account"] == "应交税费-应交增值税(进项税额转出)"

    def test_personal_consumption_debit_account(self) -> None:
        from app.tools.reimbursement_tools import vat_input_transfer_out

        r = vat_input_transfer_out(
            [{"employee": "李四", "date": "2026-11-06", "category": "office",
              "amount": "226.00", "reason": "personal_consumption"}]
        )
        assert r["ok"] is True
        assert r["details"][0]["debitAccount"] == "管理费用"
        # 226 / 1.13 × 0.13 = 26.00
        assert r["details"][0]["transferTax"] == "26.00"

    def test_total_aggregation(self) -> None:
        from app.tools.reimbursement_tools import vat_input_transfer_out

        r = vat_input_transfer_out([
            {"employee": "甲", "date": "2026-11-01", "category": "welfare",
             "amount": "1130.00", "reason": "collective_welfare"},
            {"employee": "乙", "date": "2026-11-02", "category": "office",
             "amount": "1130.00", "reason": "personal_consumption"},
        ])
        assert r["ok"] is True
        # 两笔各转出 130,合计 260
        assert r["transferTaxTotal"] == "260.00"
        assert r["grossTotal"] == "2260.00"
        assert r["netTotal"] == "2000.00"
        assert len(r["entries"]) == 2

    def test_invalid_reason_rejected(self) -> None:
        from app.tools.reimbursement_tools import vat_input_transfer_out

        r = vat_input_transfer_out(
            [{"employee": "王五", "date": "2026-11-07", "category": "office",
              "amount": "113.00", "reason": "bogus_reason"}]
        )
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_INPUT"

    def test_backward_compat_no_key(self) -> None:
        """不传 input_tax_transfer_out 时主入口行为不变(向后兼容)。"""
        import asyncio
        from app.tools.reimbursement_tools import ai_reimbursement

        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "赵六", "date": "2026-11-08",
                                "category": "office", "amount": "100.00",
                                "invoice_type": "general"}],
            "output_dir": "tmp/artifacts/verify_transfer_out",
        }))
        assert r["ok"] is True
        assert "input_tax_transfer_out" not in json.dumps(r.get("phaseResult", {}))


# ---------------------------------------------------------------------------
# 住宿限额四档城市 + 借款冲销 advance_offset
# ---------------------------------------------------------------------------
class TestLodgingTiers:
    """住宿限额按城市档分四档:一线600/新一线500/二线400/三线及以下300。"""

    def test_default_constants_four_tiers(self) -> None:
        assert DEFAULT_LODGING_LIMITS["一线"] == "600.00"
        assert DEFAULT_LODGING_LIMITS["新一线"] == "500.00"
        assert DEFAULT_LODGING_LIMITS["二线"] == "400.00"
        assert DEFAULT_LODGING_LIMITS["三线及以下"] == "300.00"

    def test_xinyixian_over_limit_warns(self) -> None:
        """新一线限额 500,住 600 应点名超限。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "张三", "date": "2026-11-05",
                                "category": "travel_lodging", "amount": "600.00",
                                "invoice_type": "general", "nights": "1",
                                "lodging_city_tier": "新一线"}],
            "output_dir": "tmp/artifacts/verify_lodging",
        }))
        assert r["ok"] is True
        issues = r["phaseResult"]["issues"]
        assert any(i["code"] == "LODGING_OVER_LIMIT" for i in issues)

    def test_erxian_within_limit_no_warn(self) -> None:
        """二线限额 400,住 380 不超限。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "李四", "date": "2026-11-06",
                                "category": "travel_lodging", "amount": "380.00",
                                "invoice_type": "general", "nights": "1",
                                "lodging_city_tier": "二线"}],
            "output_dir": "tmp/artifacts/verify_lodging",
        }))
        assert r["ok"] is True
        issues = r["phaseResult"]["issues"]
        assert not any(i["code"] == "LODGING_OVER_LIMIT" for i in issues)

    def test_default_tier_is_yixian(self) -> None:
        """缺省档=一线600(最保守),与原行为一致。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "王五", "date": "2026-11-07",
                                "category": "travel_lodging", "amount": "550.00",
                                "invoice_type": "general", "nights": "1"}],
            "output_dir": "tmp/artifacts/verify_lodging",
        }))
        assert r["ok"] is True
        # 一线限额600,住550未超
        assert not any(i["code"] == "LODGING_OVER_LIMIT"
                       for i in r["phaseResult"]["issues"])


class TestAdvanceOffset:
    """借款冲销:预借差旅费,报销时多退少补。"""

    def test_need_pay_employee(self) -> None:
        """预借3000、报销3500 → 需补付500(贷银行存款)。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "张三", "date": "2026-11-05",
                                "category": "travel_transport", "amount": "3500.00",
                                "invoice_type": "general"}],
            "advance_offset": {"employee": "张三", "advance_amount": "3000.00"},
            "output_dir": "tmp/artifacts/verify_advance",
        }))
        assert r["ok"] is True
        adv = r["phaseResult"]["advanceOffset"]
        assert adv["balance"] == "500.00"
        assert adv["reimbursedTotal"] == "3500.00"
        assert adv["direction"] == "需补付"
        assert adv["advanceAmount"] == "3000.00"
        entry = adv["entries"][0]
        assert entry["balanced"] is True

    def test_need_refund_company(self) -> None:
        """预借3000、报销2500 → 需退回500(借银行存款)。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "李四", "date": "2026-11-06",
                                "category": "travel_meal", "amount": "2500.00",
                                "invoice_type": "general"}],
            "advance_offset": {"employee": "李四", "advance_amount": "3000.00"},
            "output_dir": "tmp/artifacts/verify_advance",
        }))
        assert r["ok"] is True
        adv = r["phaseResult"]["advanceOffset"]
        assert adv["balance"] == "-500.00"
        assert adv["direction"] == "需退回"

    def test_settled(self) -> None:
        """预借=报销 → 已结平。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "王五", "date": "2026-11-07",
                                "category": "office", "amount": "2000.00",
                                "invoice_type": "general"}],
            "advance_offset": {"employee": "王五", "advance_amount": "2000.00"},
            "output_dir": "tmp/artifacts/verify_advance",
        }))
        assert r["ok"] is True
        adv = r["phaseResult"]["advanceOffset"]
        assert adv["balance"] == "0.00"
        assert adv["direction"] == "已结平"

    def test_backward_compat_no_key(self) -> None:
        """不传 advance_offset 时 phaseResult 不带 advanceOffset 键。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "赵六", "date": "2026-11-08",
                                "category": "office", "amount": "100.00",
                                "invoice_type": "general"}],
            "output_dir": "tmp/artifacts/verify_advance",
        }))
        assert r["ok"] is True
        assert "advanceOffset" not in r["phaseResult"]


class TestDepartmentAllocation:
    """多部门费用分摊:跨部门成本中心归集分析(不动分录借贷平衡)。"""

    def test_single_emp_single_dept_100pct(self) -> None:
        """单员工单部门 100%:by_department 该部门=报销全额。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "张三", "date": "2026-11-05",
                                "category": "travel_transport", "amount": "1000.00",
                                "invoice_type": "general"}],
            "department_allocation": {"allocations": [
                {"employee": "张三", "department": "销售部", "ratio": "1.0"},
            ]},
            "output_dir": "tmp/artifacts/verify_dept",
        }))
        assert r["ok"] is True
        alloc = r["phaseResult"]["departmentAllocation"]
        assert alloc["ok"] is True
        assert len(alloc["by_department"]) == 1
        assert alloc["by_department"][0]["department"] == "销售部"
        assert alloc["by_department"][0]["amount"] == "1000.00"
        assert alloc["by_employee"][0]["employee_total"] == "1000.00"
        assert alloc["by_employee"][0]["allocations"][0]["amount"] == "1000.00"
        assert alloc["by_employee"][0]["allocations"][0]["ratio"] == "1.00"
        assert "不影响分录借贷平衡" in alloc["note"]

    def test_single_emp_cross_dept_60_40(self) -> None:
        """单员工跨两部门 60/40:by_department 两部门分别 60%/40%。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "李四", "date": "2026-11-06",
                                "category": "travel_lodging", "amount": "1000.00",
                                "invoice_type": "general", "nights": "1"}],
            "department_allocation": {"allocations": [
                {"employee": "李四", "department": "研发部", "ratio": "0.6"},
                {"employee": "李四", "department": "市场部", "ratio": "0.4"},
            ]},
            "output_dir": "tmp/artifacts/verify_dept",
        }))
        assert r["ok"] is True
        alloc = r["phaseResult"]["departmentAllocation"]
        by_dept = {d["department"]: d["amount"] for d in alloc["by_department"]}
        assert by_dept == {"研发部": "600.00", "市场部": "400.00"}
        emp = alloc["by_employee"][0]
        assert emp["employee_total"] == "1000.00"
        assert len(emp["allocations"]) == 2
        # 分摊不改变分录借贷平衡
        for e in r["phaseResult"]["entries"]:
            assert e["balanced"] is True

    def test_multi_emp_same_dept_aggregated(self) -> None:
        """多员工同部门汇总:by_department 正确累加。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [
                {"employee": "张三", "date": "2026-11-05",
                 "category": "travel_transport", "amount": "500.00",
                 "invoice_type": "general"},
                {"employee": "李四", "date": "2026-11-06",
                 "category": "office", "amount": "300.00",
                 "invoice_type": "general"},
            ],
            "department_allocation": {"allocations": [
                {"employee": "张三", "department": "行政部", "ratio": "1.0"},
                {"employee": "李四", "department": "行政部", "ratio": "1.0"},
            ]},
            "output_dir": "tmp/artifacts/verify_dept",
        }))
        assert r["ok"] is True
        alloc = r["phaseResult"]["departmentAllocation"]
        assert len(alloc["by_department"]) == 1
        assert alloc["by_department"][0]["amount"] == "800.00"
        assert alloc["by_department"][0]["department"] == "行政部"

    def test_ratio_sum_not_one_rejected(self) -> None:
        """ratio 和 ≠1.0 → ok=false,INVALID_INPUT 拒绝。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "张三", "date": "2026-11-05",
                                "category": "travel_transport", "amount": "1000.00",
                                "invoice_type": "general"}],
            "department_allocation": {"allocations": [
                {"employee": "张三", "department": "销售部", "ratio": "0.6"},
                {"employee": "张三", "department": "研发部", "ratio": "0.3"},
            ]},
            "output_dir": "tmp/artifacts/verify_dept",
        }))
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_INPUT"
        assert "0.90" in r["message"]

    def test_backward_compat_no_key(self) -> None:
        """不传 department_allocation 时 phaseResult 不带 departmentAllocation 键。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "张三", "date": "2026-11-05",
                                "category": "travel_transport", "amount": "1000.00",
                                "invoice_type": "general"}],
            "output_dir": "tmp/artifacts/verify_dept",
        }))
        assert r["ok"] is True
        assert "departmentAllocation" not in r["phaseResult"]

    def test_decimal_exact_no_float_drift(self) -> None:
        """Decimal 精确:1000 × 0.6 = 600.00,不出现浮点漂移。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "王五", "date": "2026-11-07",
                                "category": "travel_meal", "amount": "1000.00",
                                "invoice_type": "general"}],
            "department_allocation": {"allocations": [
                {"employee": "王五", "department": "A部门", "ratio": "0.6"},
                {"employee": "王五", "department": "B部门", "ratio": "0.4"},
            ]},
            "output_dir": "tmp/artifacts/verify_dept",
        }))
        assert r["ok"] is True
        alloc = r["phaseResult"]["departmentAllocation"]
        by_dept = {d["department"]: d["amount"] for d in alloc["by_department"]}
        assert by_dept["A部门"] == "600.00"
        assert by_dept["B部门"] == "400.00"
        for d in alloc["by_department"]:
            assert isinstance(d["amount"], str)
            assert Decimal(d["amount"]) == Decimal(d["amount"]).quantize(Decimal("0.01"))

    def test_json_string_input_accepted(self) -> None:
        """department_allocation 也接受 JSON 字符串形式(与 advance_offset 对齐)。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [{"employee": "张三", "date": "2026-11-05",
                                "category": "travel_transport", "amount": "1000.00",
                                "invoice_type": "general"}],
            "department_allocation": json.dumps({"allocations": [
                {"employee": "张三", "department": "销售部", "ratio": "1.0"},
            ]}),
            "output_dir": "tmp/artifacts/verify_dept",
        }))
        assert r["ok"] is True
        alloc = r["phaseResult"]["departmentAllocation"]
        assert alloc["by_department"][0]["amount"] == "1000.00"

    def test_no_allocation_for_some_employee_skipped(self) -> None:
        """仅分摊 allocation 中出现的员工;未出现的员工不进 by_employee。"""
        import asyncio
        r = asyncio.run(ai_reimbursement({
            "period": "2026-11",
            "reimbursements": [
                {"employee": "张三", "date": "2026-11-05",
                 "category": "travel_transport", "amount": "500.00",
                 "invoice_type": "general"},
                {"employee": "李四", "date": "2026-11-06",
                 "category": "office", "amount": "200.00",
                 "invoice_type": "general"},
            ],
            "department_allocation": {"allocations": [
                {"employee": "张三", "department": "销售部", "ratio": "1.0"},
            ]},
            "output_dir": "tmp/artifacts/verify_dept",
        }))
        assert r["ok"] is True
        alloc = r["phaseResult"]["departmentAllocation"]
        assert len(alloc["by_employee"]) == 1
        assert alloc["by_employee"][0]["employee"] == "张三"
        assert alloc["by_department"][0]["amount"] == "500.00"
