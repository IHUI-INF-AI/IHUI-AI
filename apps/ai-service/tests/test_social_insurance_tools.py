# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""财务部插件 · 社保医保缴费精算(social_insurance_calc)回归钉(2026-11-13)。

覆盖面(逐条都是真实执行,不是 mock 断言):
- 计算面:逐人五险一金(养老/医疗/失业/工伤/生育/公积金)按缺省费率、逐项费率覆盖;
- 基数面:低于下限托底、高于上限封顶(逐人标注);
- 勾稽面:每人各险种单位/个人分项之和 == 该人单位合计 / 个人合计;全员分项之和 ==
  单位月度总缴费 / 代扣个人合计(可喂代账 salary 分录与个税 social 字段);
- 医保面:个人账户 vs 统筹划入拆分;
- 纪律面:Decimal 精度(字符串出参两位、费率乘法边界)、失败结构化、output_dir 越界拒绝、
  输入规模上限、进度块、免责声明。

注意:本文件尚未接入 mcp_server 注册面(模块已具备 schema 描述常量),故只测工具函数本体。
"""


from __future__ import annotations

from decimal import Decimal

from app.tools.social_insurance_tools import (
    DEFAULT_BASE_CAP_RATIO,
    DEFAULT_BASE_FLOOR_RATIO,
    DEFAULT_MEDICAL_ACCOUNT_SPLIT,
    DEFAULT_RATES,
    INJURY_CLASS_RATES,
    SOCIAL_INSURANCE_DESCRIPTION,
    social_insurance_calc,
)


def _d(s: str) -> Decimal:
    return Decimal(s)


def _call(payload: dict) -> dict:
    import asyncio
    return asyncio.run(social_insurance_calc(dict(payload)))


BASE_ARGS = {
    "period": "2026-11",
    "city": "杭州",
    "province": "浙江",
    "social_avg_wage": "8000",
    "output_dir": "tmp/artifacts/social_insurance_tests",
}


def _employees() -> list[dict]:
    return [
        {"name": "张三", "gross": "10000"},  # 在上下限之间
        {"name": "李四", "gross": "3000"},  # 低于下限(4800)
        {"name": "王五", "gross": "30000"},  # 高于上限(24000)
    ]


class TestNormal:
    def test_normal_contribution_and_outputs(self) -> None:
        r = _call({**BASE_ARGS, "employees": _employees()})
        assert r["ok"] is True, r
        ph = r["phaseResult"]
        assert ph["summary"]["headcount"] == 3
        # 张三在上下限之间:核定基数 = 10000
        z = next(e for e in ph["employees"] if e["name"] == "张三")
        assert z["verifiedBase"] == "10000.00"
        assert z["baseNote"] == "核定=申报"
        # 养老:单位16%/个人8%
        assert z["pension"]["employer"] == "1600.00"
        assert z["pension"]["employee"] == "800.00"
        # 医疗:单位9.8%/个人2%
        assert z["medical"]["employer"] == "980.00"
        assert z["medical"]["employee"] == "200.00"
        # 失业:各0.5%
        assert z["unemployment"]["employer"] == "50.00"
        assert z["unemployment"]["employee"] == "50.00"
        # 工伤:单位0.2%,个人0
        assert z["injury"]["employer"] == "20.00"
        assert z["injury"]["employee"] == "0.00"
        # 公积金:各12%
        assert z["housingFund"]["employer"] == "1200.00"
        assert z["housingFund"]["employee"] == "1200.00"
        # 单位合计 = 1600+980+50+20+0(生育)+1200 = 3850
        assert z["employerTotal"] == "3850.00"
        # 个人合计 = 800+200+50+0(大病)+1200 = 2250
        assert z["employeeWithheldTotal"] == "2250.00"
        # 单位总成本 = 单位合计 + 应发
        assert z["employerTotalCost"] == "13850.00"

    def test_floor_bottom(self) -> None:
        r = _call({**BASE_ARGS, "employees": [{"name": "李四", "gross": "3000"}]})
        e = r["phaseResult"]["employees"][0]
        assert e["verifiedBase"] == "4800.00"  # 8000*0.60
        assert "托底" in e["baseNote"] and "4800" in e["baseNote"]
        # 养老按托底基数 4800 算:单位16% = 768
        assert e["pension"]["employer"] == "768.00"

    def test_cap_top(self) -> None:
        r = _call({**BASE_ARGS, "employees": [{"name": "王五", "gross": "30000"}]})
        e = r["phaseResult"]["employees"][0]
        assert e["verifiedBase"] == "24000.00"  # 8000*3.0
        assert "封顶" in e["baseNote"] and "24000" in e["baseNote"]
        assert e["pension"]["employer"] == "3840.00"


class TestOverrides:
    def test_rate_override_applies(self) -> None:
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "赵六", "gross": "10000", "base": "10000"}],
                "pension_employer": "0.20",  # 覆盖
                "fund_employer": "0.05",  # 公积金单位降到5%
            }
        )
        z = r["phaseResult"]["employees"][0]
        assert z["pension"]["employer"] == "2000.00"
        assert z["housingFund"]["employer"] == "500.00"
        # 个人侧缺省不变
        assert z["pension"]["employee"] == "800.00"
        assert z["housingFund"]["employee"] == "1200.00"

    def test_maternity_rate_override(self) -> None:
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "孙七", "gross": "10000", "base": "10000"}],
                "maternity_employer": "0.008",  # 独立计提生育
            }
        )
        z = r["phaseResult"]["employees"][0]
        assert z["maternity"]["employer"] == "80.00"
        # 单位合计 = 3850 + 80 = 3930
        assert z["employerTotal"] == "3930.00"


class Test勾稽:
    def test_per_person_item_sums_equal_totals(self) -> None:
        r = _call({**BASE_ARGS, "employees": _employees()})
        for e in r["phaseResult"]["employees"]:
            er_sum = (
                _d(e["pension"]["employer"])
                + _d(e["medical"]["employer"])
                + _d(e["unemployment"]["employer"])
                + _d(e["injury"]["employer"])
                + _d(e["maternity"]["employer"])
                + _d(e["housingFund"]["employer"])
            )
            ee_sum = (
                _d(e["pension"]["employee"])
                + _d(e["medical"]["employee"])
                + _d(e["unemployment"]["employee"])
                + _d(e["bigIllnessEmployee"])
                + _d(e["housingFund"]["employee"])
            )
            assert er_sum == _d(e["employerTotal"]), e["name"]


# ---------------------------------------------------------------------------
# 大额医疗/补充医疗(supplementary_medical)+ 个税代扣协同校验(iit_withholding_check)
# ---------------------------------------------------------------------------


class TestSupplementaryMedical:
    def test_supplementary_medical_flat_two_employees(self) -> None:
        """固定额:employer_flat=10、employee_flat=5、2 员工 ⇒ 单位合计20、个人合计10。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [
                    {"name": "甲", "gross": "10000"},
                    {"name": "乙", "gross": "8000"},
                ],
                "supplementary_medical": {"employer_flat": "10", "employee_flat": "5"},
            }
        )
        assert r["ok"] is True
        sm = r["supplementary_medical"]
        assert sm["employer_total"] == "20.00"
        assert sm["employee_total"] == "10.00"
        assert sm["grand_total"] == "30.00"
        # 逐人:各 10 / 5
        assert [p["employer"] for p in sm["per_employee"]] == ["10.00", "10.00"]
        assert [p["employee"] for p in sm["per_employee"]] == ["5.00", "5.00"]
        assert all(p["total"] == "15.00" for p in sm["per_employee"])
        assert "以参保地医保经办机构政策为准" in sm["note"]

    def test_supplementary_medical_rate(self) -> None:
        """比例:employer_rate=0.01、gross 10000 ⇒ 单位 100。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "甲", "gross": "10000"}],
                "supplementary_medical": {"employer_rate": "0.01"},
            }
        )
        sm = r["supplementary_medical"]
        assert sm["employer_total"] == "100.00"
        assert sm["employee_total"] == "0.00"
        assert sm["per_employee"][0]["employer"] == "100.00"

    def test_supplementary_medical_backward_compat(self) -> None:
        """向后兼容:不传 supplementary_medical ⇒ 返回不含该键。"""
        r = _call({**BASE_ARGS, "employees": _employees()})
        assert r["ok"] is True
        assert "supplementary_medical" not in r


class TestIitWithholdingCheck:
    def test_iit_default_no_excess(self) -> None:
        """缺省 fund_employee=0.12 ⇒ 不超限,无提示(空数组)。"""
        r = _call(
            {**BASE_ARGS, "employees": [{"name": "甲", "gross": "10000"}], "iit_withholding_check": True}
        )
        assert r["ok"] is True
        assert r["iit_withholding_notes"] == []

    def test_iit_excess_fund_rate(self) -> None:
        """fund_employee=0.15 ⇒ 超限提示,含调增说明。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "甲", "gross": "10000"}],
                "fund_employee": "0.15",
                "iit_withholding_check": True,
            }
        )
        notes = r["iit_withholding_notes"]
        assert len(notes) == 1
        assert "甲" in notes[0]
        assert "12%" in notes[0]
        assert "调增" in notes[0]

    def test_iit_check_false_no_key(self) -> None:
        """iit_withholding_check 缺省 false ⇒ 不加 iit_withholding_notes 键(向后兼容)。"""
        r = _call({**BASE_ARGS, "employees": _employees()})
        assert r["ok"] is True
        assert "iit_withholding_notes" not in r


class TestCrossYearInterest:
    def test_cross_year_interest_principal_10000_3years(self) -> None:
        """本金 10000、跨 3 年、利率 3% ⇒ 单利利息 900(10000×0.03×3)。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "cross_year_interest": {
                    "principal": "10000",
                    "years": 3,
                    "rate": "0.03",
                },
            }
        )
        assert r["ok"] is True, r
        cy = r["cross_year_interest"]
        assert cy["principal"] == "10000.00"
        assert cy["years"] == 3
        assert cy["rate"] == "0.03"
        assert cy["interest"] == "900.00"
        assert cy["rate_basis"] == "参保地核定"  # 缺省基准
        # note 含口径红线
        assert "以参保地社保经办机构核定为准" in cy["note"]
        assert "单利" in cy["note"]
        assert "不代理补缴申报" in cy["note"]

    def test_cross_year_interest_default_rate(self) -> None:
        """缺省利率 3%:本金 20000、2 年 ⇒ 20000×0.03×2 = 1200。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "cross_year_interest": {"principal": "20000", "years": 2},
            }
        )
        assert r["ok"] is True
        cy = r["cross_year_interest"]
        assert cy["rate"] == "0.03"  # 缺省利率
        assert cy["interest"] == "1200.00"

    def test_cross_year_interest_default_principal_uses_totals(self) -> None:
        """不传 principal ⇒ 取本次 employee_total+employer_total(单利计息)。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "cross_year_interest": {"years": 2, "rate": "0.05"},
            }
        )
        assert r["ok"] is True
        z = r["phaseResult"]["employees"][0]
        expected_base = _d(z["employerTotal"]) + _d(z["employeeWithheldTotal"])
        cy = r["cross_year_interest"]
        assert _d(cy["principal"]) == expected_base
        assert _d(cy["interest"]) == (expected_base * Decimal("0.05") * 2).quantize(Decimal("0.01"))

    def test_cross_year_interest_rate_basis_passthrough(self) -> None:
        """rate_basis 自定义文本(如 LPR)正确透传。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "cross_year_interest": {
                    "principal": "10000",
                    "years": 1,
                    "rate": "0.035",
                    "rate_basis": "LPR",
                },
            }
        )
        assert r["ok"] is True
        cy = r["cross_year_interest"]
        assert cy["rate_basis"] == "LPR"
        assert cy["interest"] == "350.00"

    def test_cross_year_interest_backward_compatible_absent(self) -> None:
        """不传 cross_year_interest ⇒ 返回不含该键,原口径零变化。"""
        r = _call({**BASE_ARGS, "employees": _employees()})
        assert r["ok"] is True
        assert "cross_year_interest" not in r

    def test_cross_year_interest_invalid_years_no_key(self) -> None:
        """years=0 / 负数 / 缺 years / 非整数 ⇒ 不加键、不报错(向后兼容)。"""
        for years in (0, -3, None, "abc", 1.5):
            payload: dict = {**BASE_ARGS, "employees": _employees(), "cross_year_interest": {}}
            if years is not None:
                payload["cross_year_interest"]["years"] = years
            r = _call(payload)
            assert r["ok"] is True, (years, r)
            assert "cross_year_interest" not in r, years

    def test_cross_year_interest_with_late_fee_independent(self) -> None:
        """late_fee 与 cross_year_interest 同时传 ⇒ 两键都在、金额各自独立正确。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "late_fee": {"overdue_days": 10, "overdue_amount": "10000"},
                "cross_year_interest": {"principal": "10000", "years": 3, "rate": "0.03"},
            }
        )
        assert r["ok"] is True
        # 滞纳金独立:10000×0.0005×10 = 50
        assert r["late_fee"]["late_fee_amount"] == "50.00"
        # 跨年利息独立:10000×0.03×3 = 900
        assert r["cross_year_interest"]["interest"] == "900.00"

    def test_grand_sums_equal_totals(self) -> None:
        r = _call({**BASE_ARGS, "employees": _employees()})
        s = r["phaseResult"]["summary"]
        g = s["grand"]
        er_grand = (
            _d(g["pension_employer"])
            + _d(g["medical_employer"])
            + _d(g["unemployment_employer"])
            + _d(g["injury_employer"])
            + _d(g["maternity_employer"])
            + _d(g["fund_employer"])
        )
        ee_grand = (
            _d(g["pension_employee"])
            + _d(g["medical_employee"])
            + _d(g["unemployment_employee"])
            + _d(g["big_illness_employee"])
            + _d(g["fund_employee"])
        )
        assert er_grand == _d(s["employerMonthlyTotal"])
        assert ee_grand == _d(s["employeeWithheldTotal"])
        # 全员单位总成本 = 单位月度总缴费 + 全员应发工资
        gross_grand = sum((_d(e["gross"]) for e in r["phaseResult"]["employees"]), Decimal(0))
        assert _d(s["employerTotalCostMonthly"]) == er_grand + gross_grand
        # 喂代账/个税口径字段存在
        assert _d(s["employeeWithheldTotal"]) > 0


class TestMedicalSplit:
    def test_account_vs_pool_split_default(self) -> None:
        r = _call({**BASE_ARGS, "employees": [{"name": "张三", "gross": "10000", "base": "10000"}]})
        z = r["phaseResult"]["employees"][0]
        ms = z["medicalAccountSplit"]
        # 个人账户 = 个人缴纳×1 + 单位缴纳×0.30 = 200 + 980*0.30
        expected_account = _d("200.00") + (_d("980.00") * Decimal("0.30"))
        assert _d(ms["personalAccount"]) == expected_account.quantize(Decimal("0.01"))
        # 统筹 = 单位 + 个人 - 个人账户
        expected_pool = _d("980.00") + _d("200.00") - _d(ms["personalAccount"])
        assert _d(ms["pool"]) == expected_pool.quantize(Decimal("0.01"))

    def test_split_ratio_override(self) -> None:
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "medical_employer_to_account_ratio": "0",  # 单位侧全进统筹
            }
        )
        ms = r["phaseResult"]["employees"][0]["medicalAccountSplit"]
        assert _d(ms["personalAccount"]) == _d("200.00")  # 仅个人缴纳
        assert _d(ms["pool"]) == _d("980.00")  # 单位全进统筹


class TestDiscipline:
    def test_progress_block_present(self) -> None:
        r = _call({**BASE_ARGS, "employees": _employees()})
        prog = r["progress"]
        assert prog["phase"] == "compute"
        assert prog["of"] == 1 and prog["phaseIndex"] == 1
        assert prog["completed"] == 1.0

    def test_disclaimer_states_authority(self) -> None:
        r = _call({**BASE_ARGS, "employees": _employees()})
        d = r["disclaimer"]
        assert "以参保地人社/医保核定为准" in d
        assert "草案" in d and "复核" in d
        assert "不联网" in d
        assert "以参保地人社/医保核定为准" in SOCIAL_INSURANCE_DESCRIPTION

    def test_decimal_precision_two_places(self) -> None:
        # 费率乘法边界:0.098 * 10000 = 980.00;字符串出参恒两位
        r = _call({**BASE_ARGS, "employees": [{"name": "周八", "gross": "12345.678", "base": "12345.678"}]})
        z = r["phaseResult"]["employees"][0]
        # 缺省费率(养老16%/医疗9.8%/失业0.5%/工伤0.2%/公积金12%)
        assert z["medical"]["employer"] == "1209.88"  # 12345.678*0.098 = 1209.876 -> 四舍五入两位 1209.88
        for e in r["phaseResult"]["employees"]:
            for key in ("employerTotal", "employeeWithheldTotal", "employerTotalCost"):
                assert len(e[key].split(".")[-1]) == 2, e[key]

    def test_employees_json_string_accepted(self) -> None:
        import json
        payload = {**BASE_ARGS, "employees": json.dumps([{"name": "甲", "gross": "10000"}])}
        r = _call(payload)
        assert r["ok"] is True
        assert r["phaseResult"]["employees"][0]["name"] == "甲"

    def test_structured_failure_missing_period(self) -> None:
        r = _call({"employees": [{"name": "x", "gross": "100"}]})
        assert r["ok"] is False
        assert r["errorCode"] and r["message"]

    def test_structured_failure_empty_employees(self) -> None:
        r = _call({**BASE_ARGS, "employees": []})
        assert r["ok"] is False
        assert r["errorCode"] and r["message"]

    def test_structured_failure_bad_rate(self) -> None:
        r = _call({**BASE_ARGS, "employees": [{"name": "x", "gross": "100"}], "pension_employer": "2.0"})
        assert r["ok"] is False  # 费率 >1 越界

    def test_output_dir_outside_project_rejected(self) -> None:
        r = _call({**BASE_ARGS, "employees": [{"name": "x", "gross": "100"}], "output_dir": "/etc"})
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_OUTPUT_DIR"

    def test_defaults_visible_and_overridable(self) -> None:
        # 缺省费率表存在且均为 Decimal;上下限比例常量可见
        assert isinstance(DEFAULT_RATES, dict) and DEFAULT_RATES
        assert all(isinstance(v, Decimal) for v in DEFAULT_RATES.values())
        assert DEFAULT_BASE_FLOOR_RATIO == Decimal("0.60")
        assert DEFAULT_BASE_CAP_RATIO == Decimal(3)
        assert "employee_to_account" in DEFAULT_MEDICAL_ACCOUNT_SPLIT


# ---------------------------------------------------------------------------
# 年度基数调整补差(base_adjustment)
# ---------------------------------------------------------------------------


class TestBaseAdjustment:
    def test_single_employee_diff_default_rates(self) -> None:
        """单员工补差:8000→10000、3个月,按缺省比例算个人/单位补差。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "base_adjustment": {"old_base": "8000", "new_base": "10000", "months": 3},
            }
        )
        assert r["ok"] is True, r
        ba = r["base_adjustment"]
        assert ba is not None
        row = ba["per_employee"][0]
        assert row["name"] == "张三"
        assert row["months"] == 3
        # 核定基数均未被截断(8000/10000 都在 [4800,24000] 内)
        assert row["old_base"] == "8000.00"
        assert row["new_base"] == "10000.00"
        assert row["base_gap_month"] == "2000.00"
        # 个人侧 = (8%+2%+0.5%+12%)×2000 = 450/月 × 3 = 1350
        assert row["personal_diff"] == "1350.00"
        # 单位侧 = (16%+9.8%+0.5%+0.2%+0+12%)×2000 = 770/月 × 3 = 2310
        assert row["employer_diff"] == "2310.00"
        assert row["total_diff"] == "3660.00"
        # 逐险种分项两位、勾稽:分项和 == 各自合计
        assert _d(row["personal_by_insurance"]["pension_employee"]) == _d("480.00")  # 2000*0.08*3
        assert _d(row["personal_by_insurance"]["fund_employee"]) == _d("720.00")  # 2000*0.12*3
        assert _d(row["employer_by_insurance"]["pension_employer"]) == _d("960.00")  # 2000*0.16*3
        assert _d(row["employer_by_insurance"]["fund_employer"]) == _d("720.00")
        ee_sum = sum((_d(v) for v in row["personal_by_insurance"].values()), Decimal(0))
        er_sum = sum((_d(v) for v in row["employer_by_insurance"].values()), Decimal(0))
        assert ee_sum == _d(row["personal_diff"])
        assert er_sum == _d(row["employer_diff"])
        # 全员合计 = 逐人合计
        assert ba["personal_total"] == "1350.00"
        assert ba["employer_total"] == "2310.00"
        assert ba["grand_total"] == "3660.00"
        assert _d(ba["grand_total"]) == _d(ba["personal_total"]) + _d(ba["employer_total"])
        assert "补差" in ba["note"]

    def test_new_base_capped_at_300pct(self) -> None:
        """封顶生效:new_base 30000 超社平300%(24000),按封顶后算差。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "王五", "gross": "30000", "base": "30000"}],
                "base_adjustment": {"old_base": "10000", "new_base": "30000", "months": 1},
            }
        )
        ba = r["base_adjustment"]
        row = ba["per_employee"][0]
        assert row["new_base"] == "24000.00"  # 8000*3
        assert "封顶" in row["new_clip_note"] and "24000" in row["new_clip_note"]
        # 月差额 = 24000 - 10000 = 14000;个人 = 14000*22.5% = 3150
        assert row["base_gap_month"] == "14000.00"
        assert row["personal_diff"] == "3150.00"
        # 单位 = 14000*38.5% = 5390
        assert row["employer_diff"] == "5390.00"
        assert ba["grand_total"] == "8540.00"

    def test_old_base_floored(self) -> None:
        """保底生效:old_base 3000 低于下限 4800,按托底后算差。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "李四", "gross": "3000", "base": "3000"}],
                "base_adjustment": {"old_base": "3000", "new_base": "8000", "months": 2},
            }
        )
        row = r["base_adjustment"]["per_employee"][0]
        assert row["old_base"] == "4800.00"  # 托底
        assert "托底" in row["old_clip_note"]
        assert row["new_base"] == "8000.00"
        # 月差额 = 8000-4800 = 3200;个人 = 3200*22.5% = 720/月 × 2 = 1440
        assert row["personal_diff"] == "1440.00"

    def test_multi_employee_summary_ties_out(self) -> None:
        """多员工汇总:逐人合计 == personal_total / employer_total / grand_total。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": _employees(),
                "base_adjustment": {"old_base": "8000", "new_base": "10000", "months": 3},
            }
        )
        ba = r["base_adjustment"]
        assert len(ba["per_employee"]) == 3
        p_sum = sum((_d(e["personal_diff"]) for e in ba["per_employee"]), Decimal(0))
        e_sum = sum((_d(e["employer_diff"]) for e in ba["per_employee"]), Decimal(0))
        assert p_sum == _d(ba["personal_total"])
        assert e_sum == _d(ba["employer_total"])
        assert p_sum + e_sum == _d(ba["grand_total"])

    def test_months_list_labels_only(self) -> None:
        """months_list 仅做标签,长度需与 months 一致。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "base_adjustment": {
                    "old_base": "8000",
                    "new_base": "10000",
                    "months": 2,
                    "months_list": ["2026-01", "2026-02"],
                },
            }
        )
        row = r["base_adjustment"]["per_employee"][0]
        assert row["months_list"] == ["2026-01", "2026-02"]
        assert row["months_label"] == "2026-01,2026-02"
        # 2 个月:个人 = 2000*22.5%*2 = 900
        assert row["personal_diff"] == "900.00"

    def test_months_list_length_mismatch_rejected(self) -> None:
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "base_adjustment": {
                    "old_base": "8000",
                    "new_base": "10000",
                    "months": 3,
                    "months_list": ["2026-01", "2026-02"],  # 长度不一致
                },
            }
        )
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_INPUT"

    def test_months_zero_rejected(self) -> None:
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "base_adjustment": {"old_base": "8000", "new_base": "10000", "months": 0},
            }
        )
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_INPUT"

    def test_backward_compatible_no_key_when_absent(self) -> None:
        """不传 base_adjustment ⇒ 返回不含该键,原口径零变化。"""
        r = _call({**BASE_ARGS, "employees": _employees()})
        assert r["ok"] is True
        assert "base_adjustment" not in r

    def test_backward_compatible_no_key_when_missing_new_base(self) -> None:
        """传入 base_adjustment 但缺 new_base ⇒ 同样不加该键(向后兼容)。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": _employees(),
                "base_adjustment": {"old_base": "8000", "months": 3},
            }
        )
        assert r["ok"] is True
        assert "base_adjustment" not in r

    def test_groups_mode_adjustment_uses_group_wage(self) -> None:
        """groups 多统筹地区:补差按各员工所属组的社平工资封顶保底。"""
        r = _call(
            {
                **BASE_ARGS,
                "groups": [
                    {
                        "city": "杭州",
                        "social_avg_wage": "8000",
                        "employees": [{"name": "杭州甲", "gross": "10000", "base": "10000"}],
                    },
                    {
                        "city": "上海",
                        "social_avg_wage": "12000",  # 上限 36000,下限 7200
                        "employees": [{"name": "上海乙", "gross": "40000", "base": "40000"}],
                    },
                ],
                "base_adjustment": {"old_base": "8000", "new_base": "40000", "months": 1},
            }
        )
        assert r["ok"] is True, r
        ba = r["base_adjustment"]
        assert ba is not None
        hz = next(e for e in ba["per_employee"] if e["name"] == "杭州甲")
        sh = next(e for e in ba["per_employee"] if e["name"] == "上海乙")
        # 杭州甲:上限 = 8000*3 = 24000 ⇒ new_base 封顶 24000;月差 16000
        assert hz["new_base"] == "24000.00"
        assert "封顶" in hz["new_clip_note"]
        # 上海乙:上限 = 12000*3 = 36000 ⇒ new_base 封顶 36000;月差 28000
        assert sh["new_base"] == "36000.00"
        assert "封顶" in sh["new_clip_note"]
        p_sum = sum((_d(e["personal_diff"]) for e in ba["per_employee"]), Decimal(0))
        assert p_sum == _d(ba["personal_total"])


# ---------------------------------------------------------------------------
# 逾期滞纳金(late_fee)—— 任务1
# ---------------------------------------------------------------------------


class TestLateFee:
    def test_late_fee_default_rate_30_days_10000(self) -> None:
        """逾期 30 天、金额 10000 ⇒ 滞纳金 150(10000×0.0005×30)。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "late_fee": {"overdue_days": 30, "overdue_amount": "10000"},
            }
        )
        assert r["ok"] is True, r
        lf = r["late_fee"]
        assert lf["overdue_amount"] == "10000.00"
        assert lf["daily_rate"] == "0.0005"
        assert lf["overdue_days"] == 30
        assert lf["late_fee_amount"] == "150.00"
        # note 含口径红线
        assert "以参保地社保经办机构核定为准" in lf["note"]
        assert "利息" in lf["note"]

    def test_late_fee_backward_compatible_absent(self) -> None:
        """不传 late_fee ⇒ 返回不含该键,原口径零变化。"""
        r = _call({**BASE_ARGS, "employees": _employees()})
        assert r["ok"] is True
        assert "late_fee" not in r

    def test_late_fee_default_amount_uses_totals(self) -> None:
        """不传 overdue_amount ⇒ 用本次 employee_total+employer_total。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "late_fee": {"overdue_days": 10},
            }
        )
        z = r["phaseResult"]["employees"][0]
        expected_base = _d(z["employerTotal"]) + _d(z["employeeWithheldTotal"])
        lf = r["late_fee"]
        assert _d(lf["overdue_amount"]) == expected_base
        # 滞纳金 = base × 0.0005 × 10
        assert _d(lf["late_fee_amount"]) == (expected_base * Decimal("0.0005") * 10).quantize(
            Decimal("0.01")
        )

    def test_late_fee_custom_daily_rate(self) -> None:
        """覆盖 daily_rate(日万分之三):10000×0.0003×20 = 60。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "late_fee": {"overdue_days": 20, "overdue_amount": "10000", "daily_rate": "0.0003"},
            }
        )
        assert r["late_fee"]["late_fee_amount"] == "60.00"

    def test_late_fee_zero_days_rejected(self) -> None:
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "late_fee": {"overdue_days": 0},
            }
        )
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_INPUT"

    def test_late_fee_negative_amount_rejected(self) -> None:
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "late_fee": {"overdue_days": 10, "overdue_amount": "-100"},
            }
        )
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_INPUT"


# ---------------------------------------------------------------------------
# 工伤保险行业差别费率(injury_class)—— 任务2
# ---------------------------------------------------------------------------


class TestInjuryClass:
    def test_injury_class_5_uses_011_rate(self) -> None:
        """injury_class=5 ⇒ 费率 0.011,工伤单位缴费 = 核定基数×0.011。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [
                    {"name": "张三", "gross": "10000", "base": "10000", "injury_class": 5}
                ],
            }
        )
        assert r["ok"] is True, r
        z = r["phaseResult"]["employees"][0]
        # 核定基数 10000 × 0.011 = 110
        assert z["injury"]["employer"] == "110.00"
        assert z["injuryClass"] == 5
        assert z["injuryRateUsed"] == "0.011"

    def test_injury_class_absent_uses_default(self) -> None:
        """未传 injury_class ⇒ 沿用缺省 0.002,行为不变。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
            }
        )
        z = r["phaseResult"]["employees"][0]
        assert z["injury"]["employer"] == "20.00"  # 10000×0.002
        assert z["injuryClass"] is None
        assert z["injuryRateUsed"] == "0.002"

    def test_injury_class_8_max_rate(self) -> None:
        """injury_class=8 ⇒ 费率 0.019(最高档,八类高风险)。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000", "injury_class": 8}],
            }
        )
        assert r["phaseResult"]["employees"][0]["injury"]["employer"] == "190.00"

    def test_injury_class_out_of_range_rejected(self) -> None:
        """injury_class=9 超出 1~8 ⇒ 拒绝。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000", "injury_class": 9}],
            }
        )
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_INPUT"

    def test_injury_class_zero_rejected(self) -> None:
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000", "injury_class": 0}],
            }
        )
        assert r["ok"] is False

    def test_injury_class_table_complete(self) -> None:
        """常量表完整覆盖 1~8 档,值符合业务口径。"""
        assert set(INJURY_CLASS_RATES.keys()) == {1, 2, 3, 4, 5, 6, 7, 8}
        assert INJURY_CLASS_RATES[1] == Decimal("0.002")
        assert INJURY_CLASS_RATES[5] == Decimal("0.011")
        assert INJURY_CLASS_RATES[8] == Decimal("0.019")
        # 单调递增
        rates = [INJURY_CLASS_RATES[i] for i in range(1, 9)]
        assert rates == sorted(rates)

    def test_injury_class_multi_employee_ties_out(self) -> None:
        """多员工不同档位:勾稽仍成立,每人按各自档位算。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [
                    {"name": "甲", "gross": "10000", "base": "10000", "injury_class": 1},
                    {"name": "乙", "gross": "10000", "base": "10000", "injury_class": 5},
                    {"name": "丙", "gross": "10000", "base": "10000"},  # 缺省 0.002
                ],
            }
        )
        emps = r["phaseResult"]["employees"]
        assert emps[0]["injury"]["employer"] == "20.00"  # 0.002
        assert emps[1]["injury"]["employer"] == "110.00"  # 0.011
        assert emps[2]["injury"]["employer"] == "20.00"  # 缺省
        # 勾稽:分项和 == 合计(已在核心逻辑断言;此处抽验)
        for e in emps:
            er_sum = (
                _d(e["pension"]["employer"])
                + _d(e["medical"]["employer"])
                + _d(e["unemployment"]["employer"])
                + _d(e["injury"]["employer"])
                + _d(e["maternity"]["employer"])
                + _d(e["housingFund"]["employer"])
            )
            assert er_sum == _d(e["employerTotal"]), e["name"]


# ---------------------------------------------------------------------------
# 大额医疗/补充医疗(supplementary_medical)+ 个税代扣协同校验(iit_withholding_check)
# ---------------------------------------------------------------------------


class TestSupplementaryMedical:
    def test_supplementary_medical_flat_two_employees(self) -> None:
        """固定额:employer_flat=10、employee_flat=5、2 员工 ⇒ 单位合计20、个人合计10。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [
                    {"name": "甲", "gross": "10000"},
                    {"name": "乙", "gross": "8000"},
                ],
                "supplementary_medical": {"employer_flat": "10", "employee_flat": "5"},
            }
        )
        assert r["ok"] is True
        sm = r["supplementary_medical"]
        assert sm["employer_total"] == "20.00"
        assert sm["employee_total"] == "10.00"
        assert sm["grand_total"] == "30.00"
        # 逐人:各 10 / 5
        assert [p["employer"] for p in sm["per_employee"]] == ["10.00", "10.00"]
        assert [p["employee"] for p in sm["per_employee"]] == ["5.00", "5.00"]
        assert all(p["total"] == "15.00" for p in sm["per_employee"])
        assert "以参保地医保经办机构政策为准" in sm["note"]

    def test_supplementary_medical_rate(self) -> None:
        """比例:employer_rate=0.01、gross 10000 ⇒ 单位 100。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "甲", "gross": "10000"}],
                "supplementary_medical": {"employer_rate": "0.01"},
            }
        )
        sm = r["supplementary_medical"]
        assert sm["employer_total"] == "100.00"
        assert sm["employee_total"] == "0.00"
        assert sm["per_employee"][0]["employer"] == "100.00"

    def test_supplementary_medical_backward_compat(self) -> None:
        """向后兼容:不传 supplementary_medical ⇒ 返回不含该键。"""
        r = _call({**BASE_ARGS, "employees": _employees()})
        assert r["ok"] is True
        assert "supplementary_medical" not in r


class TestIitWithholdingCheck:
    def test_iit_default_no_excess(self) -> None:
        """缺省 fund_employee=0.12 ⇒ 不超限,无提示(空数组)。"""
        r = _call(
            {**BASE_ARGS, "employees": [{"name": "甲", "gross": "10000"}], "iit_withholding_check": True}
        )
        assert r["ok"] is True
        assert r["iit_withholding_notes"] == []

    def test_iit_excess_fund_rate(self) -> None:
        """fund_employee=0.15 ⇒ 超限提示,含调增说明。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "甲", "gross": "10000"}],
                "fund_employee": "0.15",
                "iit_withholding_check": True,
            }
        )
        notes = r["iit_withholding_notes"]
        assert len(notes) == 1
        assert "甲" in notes[0]
        assert "12%" in notes[0]
        assert "调增" in notes[0]

    def test_iit_check_false_no_key(self) -> None:
        """iit_withholding_check 缺省 false ⇒ 不加 iit_withholding_notes 键(向后兼容)。"""
        r = _call({**BASE_ARGS, "employees": _employees()})
        assert r["ok"] is True
        assert "iit_withholding_notes" not in r


class TestCrossYearInterest:
    def test_cross_year_interest_principal_10000_3years(self) -> None:
        """本金 10000、跨 3 年、利率 3% ⇒ 单利利息 900(10000×0.03×3)。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "cross_year_interest": {
                    "principal": "10000",
                    "years": 3,
                    "rate": "0.03",
                },
            }
        )
        assert r["ok"] is True, r
        cy = r["cross_year_interest"]
        assert cy["principal"] == "10000.00"
        assert cy["years"] == 3
        assert cy["rate"] == "0.03"
        assert cy["interest"] == "900.00"
        assert cy["rate_basis"] == "参保地核定"  # 缺省基准
        # note 含口径红线
        assert "以参保地社保经办机构核定为准" in cy["note"]
        assert "单利" in cy["note"]
        assert "不代理补缴申报" in cy["note"]

    def test_cross_year_interest_default_rate(self) -> None:
        """缺省利率 3%:本金 20000、2 年 ⇒ 20000×0.03×2 = 1200。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "cross_year_interest": {"principal": "20000", "years": 2},
            }
        )
        assert r["ok"] is True
        cy = r["cross_year_interest"]
        assert cy["rate"] == "0.03"  # 缺省利率
        assert cy["interest"] == "1200.00"

    def test_cross_year_interest_default_principal_uses_totals(self) -> None:
        """不传 principal ⇒ 取本次 employee_total+employer_total(单利计息)。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "cross_year_interest": {"years": 2, "rate": "0.05"},
            }
        )
        assert r["ok"] is True
        z = r["phaseResult"]["employees"][0]
        expected_base = _d(z["employerTotal"]) + _d(z["employeeWithheldTotal"])
        cy = r["cross_year_interest"]
        assert _d(cy["principal"]) == expected_base
        assert _d(cy["interest"]) == (expected_base * Decimal("0.05") * 2).quantize(Decimal("0.01"))

    def test_cross_year_interest_rate_basis_passthrough(self) -> None:
        """rate_basis 自定义文本(如 LPR)正确透传。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "cross_year_interest": {
                    "principal": "10000",
                    "years": 1,
                    "rate": "0.035",
                    "rate_basis": "LPR",
                },
            }
        )
        assert r["ok"] is True
        cy = r["cross_year_interest"]
        assert cy["rate_basis"] == "LPR"
        assert cy["interest"] == "350.00"

    def test_cross_year_interest_backward_compatible_absent(self) -> None:
        """不传 cross_year_interest ⇒ 返回不含该键,原口径零变化。"""
        r = _call({**BASE_ARGS, "employees": _employees()})
        assert r["ok"] is True
        assert "cross_year_interest" not in r

    def test_cross_year_interest_invalid_years_no_key(self) -> None:
        """years=0 / 负数 / 缺 years / 非整数 ⇒ 不加键、不报错(向后兼容)。"""
        for years in (0, -3, None, "abc", 1.5):
            payload: dict = {**BASE_ARGS, "employees": _employees(), "cross_year_interest": {}}
            if years is not None:
                payload["cross_year_interest"]["years"] = years
            r = _call(payload)
            assert r["ok"] is True, (years, r)
            assert "cross_year_interest" not in r, years

    def test_cross_year_interest_with_late_fee_independent(self) -> None:
        """late_fee 与 cross_year_interest 同时传 ⇒ 两键都在、金额各自独立正确。"""
        r = _call(
            {
                **BASE_ARGS,
                "employees": [{"name": "张三", "gross": "10000", "base": "10000"}],
                "late_fee": {"overdue_days": 10, "overdue_amount": "10000"},
                "cross_year_interest": {"principal": "10000", "years": 3, "rate": "0.03"},
            }
        )
        assert r["ok"] is True
        # 滞纳金独立:10000×0.0005×10 = 50
        assert r["late_fee"]["late_fee_amount"] == "50.00"
        # 跨年利息独立:10000×0.03×3 = 900
        assert r["cross_year_interest"]["interest"] == "900.00"
