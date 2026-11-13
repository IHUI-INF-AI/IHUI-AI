# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""财务部插件 · 个税七项专项附加扣除(special_deduction_calc)回归钉(2026-11-13)。

覆盖面(逐条都是真实执行,不是 mock 断言):
- 七项标准缺省值正确(子女/婴幼儿/继续教育/大病/房贷/租金/赡养);
- 分摊面:子女教育/婴幼儿 50%/100%、赡养独生 3000 vs 非独生分摊≤1500;
- 合规面:非独生超1500点名、赡养分摊合计超3000点名、房贷与租房互斥、
  大病未超15000起付线为0;
- 继续教育:学历400/月 vs 职业资格3600定额(含分摊);
- 勾稽面:逐人七项之和 == special_deduction_total;全员之和 == total_special_deduction;
- 纪律面:Decimal 精度、进度块、disclaimer、失败结构化、output_dir 越界拒绝。

注意:本文件只测工具函数本体;接线到 mcp_server 由主 agent 完成。
"""


from __future__ import annotations

import asyncio
from decimal import Decimal

from app.tools.special_deduction_tools import (
    DEFAULT_CHILD_EDU_MONTHLY,
    DEFAULT_CONTINUING_EDU_MONTHLY,
    DEFAULT_ELDERLY_CAP_TOTAL,
    DEFAULT_ELDERLY_NON_ONLY_CAP,
    DEFAULT_ELDERLY_ONLY_MONTHLY,
    DEFAULT_HOUSING_LOAN_MONTHLY,
    DEFAULT_INFANT_MONTHLY,
    DEFAULT_MEDICAL_ANNUAL_CAP,
    DEFAULT_MEDICAL_THRESHOLD,
    DEFAULT_OCCUPATIONAL_QUAL_LUMP,
    RENT_TIER_CITY_POP_GT_1M,
    RENT_TIER_CITY_POP_LE_1M,
    RENT_TIER_TOP,
    SPECIAL_DEDUCTION_DESCRIPTION,
    special_deduction_calc,
)


def _d(s: str) -> Decimal:
    return Decimal(s)


def _call(payload: dict) -> dict:
    return asyncio.run(special_deduction_calc(dict(payload)))


BASE_ARGS = {
    "period": "2026-11",
    "output_dir": "tmp/artifacts/special_deduction_tests",
}


def _items_by_name(row: dict) -> dict[str, dict]:
    return {item["item"]: item for item in row["items"]}


def _emp_total(row: dict) -> Decimal:
    return _d(row["special_deduction_total"])


# ---------------------------------------------------------------------------
# ① 七项标准缺省值
# ---------------------------------------------------------------------------


def test_default_standards_constants():
    assert DEFAULT_CHILD_EDU_MONTHLY == _d("2000")
    assert DEFAULT_INFANT_MONTHLY == _d("2000")
    assert DEFAULT_CONTINUING_EDU_MONTHLY == _d("400")
    assert DEFAULT_OCCUPATIONAL_QUAL_LUMP == _d("3600")
    assert DEFAULT_MEDICAL_THRESHOLD == _d("15000")
    assert DEFAULT_MEDICAL_ANNUAL_CAP == _d("80000")
    assert DEFAULT_HOUSING_LOAN_MONTHLY == _d("1000")
    assert RENT_TIER_TOP == _d("1500")
    assert RENT_TIER_CITY_POP_GT_1M == _d("1100")
    assert RENT_TIER_CITY_POP_LE_1M == _d("800")
    assert DEFAULT_ELDERLY_ONLY_MONTHLY == _d("3000")
    assert DEFAULT_ELDERLY_NON_ONLY_CAP == _d("1500")
    assert DEFAULT_ELDERLY_CAP_TOTAL == _d("3000")


def test_default_params_visible_in_output():
    res = _call({**BASE_ARGS, "employees": [{"name": "张三"}]})
    assert res["ok"] is True
    st = res["standards"]
    assert _d(st["child_edu_monthly"]) == _d("2000")
    assert _d(st["infant_monthly"]) == _d("2000")
    assert _d(st["continuing_edu_monthly"]) == _d("400")
    assert _d(st["medical_threshold"]) == _d("15000")
    assert _d(st["housing_loan_monthly"]) == _d("1000")
    assert _d(st["rent_tiers"]["top"]) == _d("1500")
    assert _d(st["elderly_only_monthly"]) == _d("3000")


# ---------------------------------------------------------------------------
# ② 子女教育 / 婴幼儿 分摊
# ---------------------------------------------------------------------------


def test_child_edu_default_share_50():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "children": [{"age": 8}]},  # 未给 share → 缺省 50%
    ]})
    row = res["employees"][0]
    child = _items_by_name(row)["子女教育"]
    assert _d(child["monthly_amount"]) == _d("1000.00")  # 2000 × 0.5
    assert "share=0.5" in child["note"]


def test_child_edu_full_share_100():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "children": [{"age": 8, "share": "1.0"}]},
    ]})
    child = _items_by_name(res["employees"][0])["子女教育"]
    assert _d(child["monthly_amount"]) == _d("2000.00")


def test_infant_share_and_multiple_children():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "children": [{"age": 8}, {"age": 6, "share": "1.0"}],
         "infants3": [{"age": 1, "share": "1.0"}]},
    ]})
    row = res["employees"][0]
    items = _items_by_name(row)
    # 子女:1000 + 2000 = 3000
    assert _d(items["子女教育"]["monthly_amount"]) == _d("3000.00")
    # 婴幼儿:2000 × 1.0
    assert _d(items["3岁以下婴幼儿照护"]["monthly_amount"]) == _d("2000.00")


# ---------------------------------------------------------------------------
# ③ 继续教育
# ---------------------------------------------------------------------------


def test_continuing_edu_academic_monthly():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "continuing_edu": {"type": "academic", "months": 12}},
    ]})
    ce = _items_by_name(res["employees"][0])["继续教育"]
    assert _d(ce["monthly_amount"]) == _d("400.00")
    assert "学历" in ce["basis"]


def test_continuing_edu_occupational_lump():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "continuing_edu": {"type": "occupational"}},
    ]})
    ce = _items_by_name(res["employees"][0])["继续教育"]
    assert _d(ce["monthly_amount"]) == _d("3600.00")
    assert "职业资格" in ce["basis"]


def test_continuing_edu_occupational_amortize():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三",
         "continuing_edu": {"type": "occupational", "amortize_months": 12}},
    ]})
    ce = _items_by_name(res["employees"][0])["继续教育"]
    # 3600 / 12 = 300.00
    assert _d(ce["monthly_amount"]) == _d("300.00")


# ---------------------------------------------------------------------------
# ④ 大病医疗
# ---------------------------------------------------------------------------


def test_medical_below_threshold_is_zero():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "medical": {"self_paid": "12000"}},
    ]})
    row = res["employees"][0]
    med = _items_by_name(row)["大病医疗"]
    assert _d(med["monthly_amount"]) == _d("0.00")
    # 合规校验点名未超起付线
    kinds = [f["kind"] for f in res["compliance_findings"]]
    assert "MEDICAL_BELOW_THRESHOLD" in kinds


def test_medical_over_threshold_deducted():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "medical": {"self_paid": "40000"}},
    ]})
    med = _items_by_name(res["employees"][0])["大病医疗"]
    # 40000 - 15000 = 25000
    assert _d(med["monthly_amount"]) == _d("25000.00")


def test_medical_cap_at_annual_limit():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "medical": {"self_paid": "200000"}},
    ]})
    med = _items_by_name(res["employees"][0])["大病医疗"]
    # 触及年度限额 80000 封顶
    assert _d(med["monthly_amount"]) == _d("80000.00")
    assert "封顶" in med["note"]


# ---------------------------------------------------------------------------
# ⑤⑥ 住房贷款 / 租金 互斥
# ---------------------------------------------------------------------------


def test_housing_loan_monthly():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "housing": {"loan": True}},
    ]})
    items = _items_by_name(res["employees"][0])
    assert _d(items["住房贷款利息"]["monthly_amount"]) == _d("1000.00")
    # 未申报租金 → 租金项 0
    assert _d(items["住房租金"]["monthly_amount"]) == _d("0.00")


def test_housing_rent_top_tier():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "housing": {"rent_city": "北京"}},
    ]})
    rent = _items_by_name(res["employees"][0])["住房租金"]
    assert _d(rent["monthly_amount"]) == _d("1500.00")


def test_housing_rent_lower_tier():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "housing": {"rent_tier": "city_pop_le_1m"}},
    ]})
    rent = _items_by_name(res["employees"][0])["住房租金"]
    assert _d(rent["monthly_amount"]) == _d("800.00")


def test_housing_loan_and_rent_mutex():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "housing": {"loan": True, "rent_city": "北京"}},
    ]})
    items = _items_by_name(res["employees"][0])
    # 互斥:按房贷计,租金压制为 0
    assert _d(items["住房贷款利息"]["monthly_amount"]) == _d("1000.00")
    assert _d(items["住房租金"]["monthly_amount"]) == _d("0.00")
    kinds = [f["kind"] for f in res["compliance_findings"]]
    assert "HOUSING_MUTEX" in kinds


# ---------------------------------------------------------------------------
# ⑦ 赡养老人
# ---------------------------------------------------------------------------


def test_elderly_only_child_3000():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "elderly": {"only_child": True}},
    ]})
    el = _items_by_name(res["employees"][0])["赡养老人"]
    assert _d(el["monthly_amount"]) == _d("3000.00")


def test_elderly_non_only_share_within_cap():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "elderly": {"only_child": False, "share": "0.5"}},
    ]})
    el = _items_by_name(res["employees"][0])["赡养老人"]
    # 3000 × 0.5 = 1500,正好等于上限,不超
    assert _d(el["monthly_amount"]) == _d("1500.00")


def test_elderly_non_only_share_over_cap_capped():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "elderly": {"only_child": False, "share": "0.8"}},
    ]})
    row = res["employees"][0]
    el = _items_by_name(row)["赡养老人"]
    # 3000 × 0.8 = 2400 超 1500 → 封顶 1500
    assert _d(el["monthly_amount"]) == _d("1500.00")
    kinds = [f["kind"] for f in res["compliance_findings"]]
    assert "ELDERLY_NON_ONLY_OVER_CAP" in kinds


def test_elderly_sibling_count_over_total_cap():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "elderly": {"only_child": False, "elder_count": 3}},
    ]})
    kinds = [f["kind"] for f in res["compliance_findings"]]
    # 3 人 × 1500 = 4500 > 3000 合计上限 → 点名
    assert "ELDERLY_TOTAL_OVER_CAP" in kinds
    # 每人分摊 3000/3 = 1000(在每人上限内)
    el = _items_by_name(res["employees"][0])["赡养老人"]
    assert _d(el["monthly_amount"]) == _d("1000.00")


# ---------------------------------------------------------------------------
# ⑧ 勾稽面
# ---------------------------------------------------------------------------


def test_per_employee_subtotal_reconciles():
    emp = {
        "name": "张三",
        "children": [{"age": 8, "share": "1.0"}],       # 2000
        "infants3": [{"age": 1, "share": "1.0"}],        # 2000
        "continuing_edu": {"type": "academic", "months": 12},  # 400
        "housing": {"loan": True},                        # 1000
        "elderly": {"only_child": True},                  # 3000
    }
    res = _call({**BASE_ARGS, "employees": [emp]})
    row = res["employees"][0]
    items_sum = sum(
        (_d(i["monthly_amount"]) for i in row["items"]), Decimal("0")
    )
    assert items_sum == _emp_total(row) == _d("8400.00")


def test_total_across_employees_reconciles():
    employees = [
        {"name": "张三", "elderly": {"only_child": True}},              # 3000
        {"name": "李四", "housing": {"rent_city": "北京"}},              # 1500
        {"name": "王五", "children": [{"age": 8}]},                      # 1000
    ]
    res = _call({**BASE_ARGS, "employees": employees})
    rows_sum = sum((_emp_total(r) for r in res["employees"]), Decimal("0"))
    assert rows_sum == _d(res["total_special_deduction"]) == _d("5500.00")


# ---------------------------------------------------------------------------
# ⑨ 纪律面
# ---------------------------------------------------------------------------


def test_progress_block_present():
    res = _call({**BASE_ARGS, "employees": [{"name": "张三"}]})
    prog = res["progress"]
    assert "phaseIndex" in prog and "of" in prog and "next" in prog
    assert prog["of"] >= prog["phaseIndex"]


def test_disclaimer_present():
    res = _call({**BASE_ARGS, "employees": [{"name": "张三"}]})
    assert res["disclaimer"]
    assert "核定" in res["disclaimer"] or "复核" in res["disclaimer"]
    assert res["artifacts"]["json"] and res["artifacts"]["html"]


def test_description_nonempty():
    assert isinstance(SPECIAL_DEDUCTION_DESCRIPTION, str)
    assert len(SPECIAL_DEDUCTION_DESCRIPTION) > 50


def test_invalid_empty_employees_structured_fail():
    res = _call({**BASE_ARGS, "employees": []})
    assert res["ok"] is False
    assert res["errorCode"] == "INVALID_INPUT"


def test_invalid_output_dir_rejected():
    res = _call({
        **BASE_ARGS,
        "employees": [{"name": "张三"}],
        "output_dir": "/tmp/../../etc/passwd-escape",
    })
    assert res["ok"] is False
    assert res["errorCode"] == "INVALID_OUTPUT_DIR"


def test_decimal_precision_two_places():
    res = _call({**BASE_ARGS, "employees": [
        {"name": "张三", "children": [{"age": 8, "share": "0.33"}]},
    ]})
    child = _items_by_name(res["employees"][0])["子女教育"]
    # 2000 × 0.33 = 660.00,字符串两位
    assert child["monthly_amount"] == "660.00"
    assert child["monthly_amount"].count(".") == 1
