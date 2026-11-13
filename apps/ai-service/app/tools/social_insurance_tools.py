# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""财务部插件 · 社保医保真实缴费精算核心(social_insurance_calc)。

定位:把 finance_tools 里 `_automation_plan` 的「社保医保申报缴费」步骤桩背后的
**数字**补齐 —— 该桩负责的是国标平台网报厅/客户端的**操作**计划(browser_*/computer_*);
本模块负责的是**缴费测算**(逐人五险一金 + 医保个人账户/统筹拆分、基数封顶保底、
全员单位月度总缴费与代扣个人合计),产出供代账 salary 分录(其他应付款-代扣社保)与
个税扣缴(`employees[i].social` 字段)直接取用的口径。

计算纪律(同 finance_tools 的既定边界):
- **全部金额走 Decimal**(字符串入、字符串出),杜绝浮点误差进账表;
  Decimal(float) 会保留二进制原值(0.16 ⇒ 0.16000000000000001…)—— 缺省一律字符串
  构造,乘法边界积分不差分;
- 费率/基数上下限/社平工资全部做成**可覆盖缺省参数**,缺省值在 schema 与输出里
  **双处可见**,可覆盖;
- **红线(输出内如实声明)**:产物为"草案",真实申报须由执业资格人员复核;缴费口径
  **以参保地人社/医保核定为准**;本工具不代理任何对外报送、不写生产库、不联网
  (纯计算 + tmp/artifacts 产物,与 ai_bookkeeping/ai_tax_filing 同档)。

安全:output_dir 必须落在项目根内(finance_tools 同一条校验);输入规模上限防膨胀。
"""

from __future__ import annotations

import html
import json
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 项目根与产物目录:与 chart_tools/report_tools/finance_tools 同构
# (app/tools -> app -> ai-service -> apps -> 仓根)
_PROJECT_ROOT = Path(__file__).resolve().parents[4]
_DEFAULT_OUTPUT_DIR = _PROJECT_ROOT / "tmp" / "artifacts"

# 输入规模上限(同 finance_tools 的 _MAX_TXN)
_MAX_EMPLOYEES = 500
_MAX_TEXT_LEN = 300
_PERIOD_RE = re.compile(r"^\d{4}-(\d{2}|\d{2}Q[1-4])$")


# ---------------------------------------------------------------------------
# 通用小件:金额解析 / 结构化失败 / 进度块 / 输出目录(抄 finance_tools 惯例)
# ---------------------------------------------------------------------------


def _fail(tool: str, code: str, message: str) -> dict[str, Any]:
    return {"tool": tool, "ok": False, "errorCode": code, "message": message}


def _money(raw: Any, where: str) -> Decimal:
    """金额入参统一走字符串/整数/小数三形态,拒绝 NaN/Inf/负数以外的畸形。"""
    if isinstance(raw, bool):
        raise ValueError(f"{where}: 金额不接受布尔值")
    if isinstance(raw, (int, Decimal)):
        value = Decimal(str(raw))
    elif isinstance(raw, float):
        # float 走 repr:把 0.1 还原成字符串 "0.1" 再转 Decimal,边界积分不差
        value = Decimal(repr(raw))
    elif isinstance(raw, str) and raw.strip():
        try:
            value = Decimal(raw.strip())
        except InvalidOperation:
            raise ValueError(f"{where}: 无法解析为金额 ⇒ {raw!r}") from None
    else:
        raise ValueError(f"{where}: 金额缺失或形态非法")
    if not value.is_finite():
        raise ValueError(f"{where}: 金额必须是有限值")
    return value


def _q(value: Decimal | int) -> str:
    """金额出参:保留两位(分),字符串形态跨端无损(int 兜 sum 空序列的 0)。"""
    return str(Decimal(value).quantize(Decimal("0.01")))


def _rate(raw: Any, default: Decimal, where: str, *, lo: Decimal = Decimal(0), hi: Decimal = Decimal(1)) -> Decimal:
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return default
    value = _money(raw, where)
    if value < lo or value > hi:
        raise ValueError(f"{where}: 费率必须在 {lo}..{hi} 之间(如 {default})")
    return value


def _progress(phase: str, index: int, of: int, next_phase: str | None) -> dict[str, Any]:
    return {
        "phase": phase,
        "phaseIndex": index,
        "of": of,
        "completed": round(index / of, 4),
        "next": next_phase,
    }


def _resolve_output_dir(output_dir: Any) -> Path:
    target = Path(str(output_dir or _DEFAULT_OUTPUT_DIR)).expanduser()
    if not target.is_absolute():
        target = _PROJECT_ROOT / target
    target = target.resolve()
    try:
        target.relative_to(_PROJECT_ROOT.resolve())
    except ValueError:
        raise ValueError(f"output_dir 必须位于项目根内,拒绝:{output_dir}") from None
    return target


def _resolve_period(arguments: dict[str, Any]) -> str:
    period = str(arguments.get("period") or "").strip()
    if not period:
        raise ValueError("period 必填,形如 2026-11(月度)")
    if not _PERIOD_RE.match(period):
        raise ValueError(f"period 形态非法:{period}")
    return period


# ---------------------------------------------------------------------------
# 缺省费率表(可覆盖,双处可见:本表 = schema 缺省的单一真相源)
# ---------------------------------------------------------------------------

#: 常见口径缺省(单位% / 个人%)。具体城市/行业由参保地人社/医保核定,可逐项覆盖。
DEFAULT_RATES: dict[str, Decimal] = {
    # 养老保险
    "pension_employer": Decimal("0.16"),
    "pension_employee": Decimal("0.08"),
    # 医疗保险(含生育/大病,合并口径;可拆 medical_big_illness_*)
    "medical_employer": Decimal("0.098"),
    "medical_employee": Decimal("0.02"),
    # 大病互助(个人侧加收,绝对金额,非费率;0 = 不收)
    "medical_big_illness_employee_flat": Decimal(0),
    # 失业保险
    "unemployment_employer": Decimal("0.005"),
    "unemployment_employee": Decimal("0.005"),
    # 工伤保险(单位按行业费率;个人不缴)缺省给最低一档 0.2%
    "injury_employer": Decimal("0.002"),
    # 公积金(缺省各 12%,可不同;单位 = 个人时最常见)
    "fund_employer": Decimal("0.12"),
    "fund_employee": Decimal("0.12"),
    # 生育保险(部分城市并入医疗,缺省 0 = 已含在 medical_employer)
    "maternity_employer": Decimal(0),
}

#: 医保个人账户/统筹拆分规则(缺省口径,可覆盖):
#: - 个人缴纳(2%)全额计入**个人账户**;
#: - 单位缴纳部分(约 9.8% 中的一档)按缺省 **30%** 划入个人账户,余 70% 进统筹;
#: - 大病互助(如收)全额进统筹/共济,不进个人账户。
DEFAULT_MEDICAL_ACCOUNT_SPLIT: dict[str, Any] = {
    "employee_to_account": Decimal(1),  # 个人缴纳全额进个人账户
    "employer_to_account_ratio": Decimal("0.30"),  # 单位缴纳按 30% 划入个人账户
    "big_illness_to_pool": True,  # 大病互助全额进统筹
}

#: 缴费基数上下限 = 社平工资的 60% ~ 300%(social_avg_wage 做可覆盖缺省参数)
DEFAULT_BASE_FLOOR_RATIO = Decimal("0.60")
DEFAULT_BASE_CAP_RATIO = Decimal(3)

#: 工伤保险行业差别费率八档(任务2):按行业风险等级 1~8 对应单位费率,费率由用人单位
#: 所在行业基准费率 + 浮动档次综合核定,此处为**近似公开口径**,**以当地人社核定为准**;
#: 员工传 injury_class(1~8 整数)时用该档费率覆盖 DEFAULT_RATES["injury_employer"]。
INJURY_CLASS_RATES: dict[int, Decimal] = {
    1: Decimal("0.002"),  # 一类(低风险,如软件/金融)0.2%
    2: Decimal("0.004"),  # 二类 0.4%
    3: Decimal("0.007"),  # 三类 0.7%
    4: Decimal("0.009"),  # 四类 0.9%
    5: Decimal("0.011"),  # 五类 1.1%
    6: Decimal("0.013"),  # 六类 1.3%
    7: Decimal("0.016"),  # 七类 1.6%
    8: Decimal("0.019"),  # 八类(高风险,如采矿)1.9%
}

#: 逾期滞纳金日万分比缺省(万分之五)与说明文案(任务1)
DEFAULT_LATE_FEE_DAILY_RATE = Decimal("0.0005")
_LATE_FEE_NOTE = (
    "滞纳金 = 逾期未缴金额 × 日万分比 × 逾期天数;"
    "滞纳金/利息以参保地社保经办机构核定为准;"
    "部分地区另收利息或减免政策;本工具仅算基础金额。"
)

#: 跨年补缴利息年利率缺省(3%):与滞纳金独立——滞纳金是"逾期未缴的行政处罚性加收",
#: 利息是"占用资金的补偿",部分地区对跨年度欠费两者并收。缺省仅为基础参考值,
#: 以参保地社保经办机构核定利率为准(部分统筹地区按银行同期活期存款利率或 LPR 计)。
DEFAULT_CROSS_YEAR_RATE = Decimal("0.03")
_CROSS_YEAR_NOTE = (
    "跨年补缴利息按单利计;利率与是否加收以参保地社保经办机构核定为准;"
    "部分地区仅收滞纳金不另收利息;本工具仅算基础金额,不代理补缴申报。"
)


def _normalize_supplementary_medical(raw: Any) -> dict[str, Decimal] | None:
    """校验 supplementary_medical 入参(大额医疗/补充医疗):仅当传入且任一字段 > 0 才算(向后兼容)。

    字段(全部可缺省,缺省 0):employer_flat(单位每人每月固定额)、employee_flat(个人每人每月
    固定额)、employer_rate(单位比例)、employee_rate(个人比例)。全部为 0 / 缺 new_base 式缺失
    ⇒ 返回 None,不加 supplementary_medical 键。
    """
    if not isinstance(raw, dict):
        return None
    employer_flat = _money(raw.get("employer_flat") or 0, "supplementary_medical.employer_flat")
    employee_flat = _money(raw.get("employee_flat") or 0, "supplementary_medical.employee_flat")
    employer_rate = _rate(
        raw.get("employer_rate"),
        Decimal(0),
        "supplementary_medical.employer_rate",
    )
    employee_rate = _rate(
        raw.get("employee_rate"),
        Decimal(0),
        "supplementary_medical.employee_rate",
    )
    if employer_flat < 0 or employee_flat < 0:
        raise ValueError("supplementary_medical 固定额不能为负")
    # 全部为 0 ⇒ 不算,保持向后兼容(不传 ⇒ 不加键)
    if not any([employer_flat > 0, employee_flat > 0, employer_rate > 0, employee_rate > 0]):
        return None
    return {
        "employer_flat": employer_flat,
        "employee_flat": employee_flat,
        "employer_rate": employer_rate,
        "employee_rate": employee_rate,
    }


def _normalize_late_fee(raw: Any) -> dict[str, Any]:
    """校验 late_fee 入参:仅当传入且含 overdue_days 时才进入滞纳金计算(向后兼容)。

    字段:overdue_days(整数≥1,必填)、daily_rate(日万分比,缺省 DEFAULT_LATE_FEE_DAILY_RATE
    即万分之五)、overdue_amount(逾期未缴金额,缺省由调用方用本次 employee_total+employer_total)。
    """
    if not isinstance(raw, dict):
        return {}
    _overdue_days_raw = raw.get("overdue_days")
    if _overdue_days_raw is None or _overdue_days_raw == "":
        return {}
    try:
        overdue_days = int(_overdue_days_raw)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"late_fee.overdue_days 必须为整数:{raw.get('overdue_days')!r}") from exc
    if overdue_days < 1:
        raise ValueError(f"late_fee.overdue_days 必须≥1:{overdue_days}")
    daily_rate = _rate(
        raw.get("daily_rate"),
        DEFAULT_LATE_FEE_DAILY_RATE,
        "late_fee.daily_rate",
        lo=Decimal(0),
        hi=Decimal(1),
    )
    overdue_amount_raw = raw.get("overdue_amount")
    overdue_amount = _money(overdue_amount_raw, "late_fee.overdue_amount") if overdue_amount_raw not in (None, "") else None
    if overdue_amount is not None and overdue_amount < 0:
        raise ValueError(f"late_fee.overdue_amount 不能为负:{overdue_amount}")
    return {
        "overdue_days": overdue_days,
        "daily_rate": daily_rate,
        "overdue_amount": overdue_amount,  # None = 用本次计算的 employee_total+employer_total
    }


def _normalize_cross_year_interest(raw: Any) -> dict[str, Any]:
    """校验 cross_year_interest 入参:仅当传入且含 years(整数≥1)时才进入利息计算(向后兼容)。

    字段:years(跨年数,整数≥1,必填)、principal(补缴本金,缺省由调用方用本次
    employee_total+employer_total)、rate(年利率,缺省 DEFAULT_CROSS_YEAR_RATE 即 3%,以参保地
    社保经办机构核定利率为准)、rate_basis(利率基准说明,缺省 "参保地核定",如 "LPR" /
    "银行同期存款利率")。

    与 late_fee 的硬失败不同:years 缺失 / 非整数 / <1 ⇒ 返回 {}(不加键、不报错),
    保持向后兼容——老调用方与"没跨年"的补缴都不感知此项。
    """
    if not isinstance(raw, dict) or raw.get("years") in (None, ""):
        return {}
    # years 必须是整数形态(整数 / 整数字符串 / 整数值 float);非整数 ⇒ 视为未跨年,不加键
    years_raw = raw.get("years")
    if isinstance(years_raw, bool) or not isinstance(years_raw, (int, float, str)):
        return {}
    try:
        years = int(years_raw)
    except (TypeError, ValueError):
        return {}
    if float(years_raw) != years or years < 1:
        return {}
    principal_raw = raw.get("principal")
    principal = _money(principal_raw, "cross_year_interest.principal") if principal_raw not in (None, "") else None
    if principal is not None and principal < 0:
        raise ValueError(f"cross_year_interest.principal 不能为负:{principal}")
    rate = _rate(
        raw.get("rate"),
        DEFAULT_CROSS_YEAR_RATE,
        "cross_year_interest.rate",
        lo=Decimal(0),
        hi=Decimal(1),
    )
    rate_basis_raw = raw.get("rate_basis")
    rate_basis = (
        str(rate_basis_raw).strip()
        if isinstance(rate_basis_raw, str) and rate_basis_raw.strip()
        else "参保地核定"
    )
    return {
        "years": years,
        "principal": principal,  # None = 用本次计算的 employee_total+employer_total
        "rate": rate,
        "rate_basis": rate_basis,
    }


# ---------------------------------------------------------------------------
# 年度基数申报调整补差(base_adjustment):社保年度(多数地区 7月~次年6月)基数
# 申报调整后,对已按旧基数缴纳的月份补缴差额。
# ---------------------------------------------------------------------------

#: base_adjustment 个人/单位侧参与补差的费率键(与月度 `_compute_row` 的合计口径一致:
#: 个人侧含养老/医疗/失业/公积金;单位侧含养老/医疗/失业/工伤/生育/公积金。大病互助为
#: 绝对额不随基数变,故不参与;工伤/生育虽随基数但缺省由单位承担,保留在单位侧以对齐月度)。
_BASE_ADJ_EMPLOYER_KEYS = (
    "pension_employer",
    "medical_employer",
    "unemployment_employer",
    "injury_employer",
    "maternity_employer",
    "fund_employer",
)
_BASE_ADJ_EMPLOYEE_KEYS = (
    "pension_employee",
    "medical_employee",
    "unemployment_employee",
    "fund_employee",
)


def _clip_base(raw_base: Decimal, floor: Decimal, cap: Decimal) -> tuple[Decimal, str]:
    """对基数做封顶保底,返回 (核定基数, 标注),与 `_compute_row` 同一规则。"""
    if raw_base < floor:
        return floor, f"托底(按下限 {floor})"
    if raw_base > cap:
        return cap, f"封顶(按上限 {cap})"
    return raw_base, "核定=申报"


def _normalize_base_adjustment(raw: Any) -> dict[str, Any]:
    """校验 base_adjustment 入参:old_base/new_base/months 必填,months_list 可选。

    仅当传入且含 new_base 时才进入补差计算(向后兼容:不传 / 缺 new_base ⇒ 返回 None)。
    """
    if not isinstance(raw, dict):
        return {}
    if raw.get("new_base") in (None, ""):
        return {}
    old_raw = raw.get("old_base")
    if old_raw in (None, ""):
        raise ValueError("base_adjustment.old_base 必填(旧核定基数,可为 0 表示此前未按基数缴)")
    old_base = _money(old_raw, "base_adjustment.old_base")
    new_base = _money(raw.get("new_base"), "base_adjustment.new_base")
    if old_base < 0:
        raise ValueError(f"base_adjustment.old_base 不能为负:{old_base}")
    if new_base < 0:
        raise ValueError(f"base_adjustment.new_base 不能为负:{new_base}")
    months_raw = raw.get("months")
    if months_raw in (None, ""):
        raise ValueError("base_adjustment.months 必填(需补差月数,整数≥1)")
    try:
        months = int(months_raw)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"base_adjustment.months 必须为整数:{months_raw!r}") from exc
    if isinstance(months_raw, float) and months != months_raw:
        raise ValueError(f"base_adjustment.months 必须为整数:{months_raw!r}")
    if months < 1:
        raise ValueError(f"base_adjustment.months 必须≥1:{months}")

    months_list_raw = raw.get("months_list")
    months_list: list[str] = []
    if months_list_raw:
        if isinstance(months_list_raw, str):
            try:
                months_list_raw = json.loads(months_list_raw)
            except (json.JSONDecodeError, TypeError) as exc:
                raise ValueError(f"base_adjustment.months_list 必须是数组或其 JSON 字符串:{exc}") from None
        if not isinstance(months_list_raw, list):
            raise ValueError("base_adjustment.months_list 必须是数组")
        months_list = [str(m)[:_MAX_TEXT_LEN] for m in months_list_raw]
        if len(months_list) and len(months_list) != months:
            raise ValueError(
                f"base_adjustment.months_list 长度({len(months_list)})"
                f"与 months({months})不一致"
            )
    return {
        "old_base": old_base,
        "new_base": new_base,
        "months": months,
        "months_list": months_list,
    }


#: 大额医疗/补充医疗说明文案(任务1)
_SUPPLEMENTARY_MEDICAL_NOTE = (
    "大额医疗费用互助/补充医疗保险以参保地医保经办机构政策为准;"
    "部分地区并入基本医疗统一征缴,部分地区单列缴费;固定额(flat)不随基数/应发变,"
    "比例(rate)按应发工资计;本工具仅算基础金额,具体口径以当地政策为准。"
)


def _compute_supplementary_medical(
    sup: dict[str, Decimal],
    rows: list[_EmployeeRow],
) -> dict[str, Any]:
    """对全员逐人算大额医疗/补充医疗:单位 = 应发×employer_rate + employer_flat;个人同理。

    补医多为固定额或按应发的低比例,故用 gross(应发)而非核定基数(与固定额性质一致);
    逐人 quantize(0.01) 后求和,保证逐人合计 == 全员合计(勾稽)。
    """
    per_employee: list[dict[str, Any]] = []
    employer_total = Decimal(0)
    employee_total = Decimal(0)
    for r in rows:
        er = (r.gross * sup["employer_rate"] + sup["employer_flat"]).quantize(Decimal("0.01"))
        ee = (r.gross * sup["employee_rate"] + sup["employee_flat"]).quantize(Decimal("0.01"))
        total = (er + ee).quantize(Decimal("0.01"))
        employer_total += er
        employee_total += ee
        per_employee.append(
            {
                "name": r.name,
                "employer": _q(er),
                "employee": _q(ee),
                "total": _q(total),
            }
        )
    employer_total = employer_total.quantize(Decimal("0.01"))
    employee_total = employee_total.quantize(Decimal("0.01"))
    grand_total = (employer_total + employee_total).quantize(Decimal("0.01"))
    return {
        "per_employee": per_employee,
        "employer_total": _q(employer_total),
        "employee_total": _q(employee_total),
        "grand_total": _q(grand_total),
        "note": _SUPPLEMENTARY_MEDICAL_NOTE,
    }


def _compute_iit_withholding_notes(rows: list[_EmployeeRow], rates: dict[str, Decimal]) -> list[str]:
    """个税代扣协同校验(任务2):逐人核对个人公积金缴费比例是否超 12%。

    规则:社保个人缴费部分(养老8%+医疗2%+失业0.5%+公积金个人)在个税前扣除;但公积金个人缴
    超过「缴费基数 × 12%」(用封顶保底后的 verified_base × 0.12)的部分不得税前扣除。此处对
    fund_employee_rate > 0.12 的员工产出提示(仅提示,不改金额、不拒绝计算);缺省 0.12 ⇒ 不超限、
    不出提示。用费率直接判断(而非反解金额)以避免两位小数 quantize 造成误报。
    """
    notes: list[str] = []
    threshold = Decimal("0.12")
    fund_ee_rate = rates["fund_employee"]
    if fund_ee_rate <= threshold:
        return notes  # 缺省/未超限 ⇒ 无提示(向后兼容:0.12 不出超限提示)
    for idx, r in enumerate(rows):
        if r.verified_base <= 0:
            continue
        cap_amount = (r.verified_base * threshold).quantize(Decimal("0.01"))
        excess = (r.fund_ee - cap_amount).quantize(Decimal("0.01"))
        if excess <= 0:
            continue
        rate_pct = (fund_ee_rate * 100).quantize(Decimal("0.01"))
        notes.append(
            f"员工[{idx + 1}] {r.name}:个人公积金缴费比例 {rate_pct}% 超 12%,"
            f"税前可扣除上限 {_q(cap_amount)}(核定基数 {r.verified_base} × 12%),"
            f"超出部分 {_q(excess)} 不得税前扣除,需在个税计算时调增应纳税所得额。"
        )
    return notes


def _compute_base_adjustment(
    adj: dict[str, Any],
    rows: list[_EmployeeRow],
    group_wages: list[tuple[Decimal, int]],  # [(该组社平工资, 该组人数)],与 rows 顺序对齐
    *,
    rates: dict[str, Decimal],
    floor_ratio: Decimal,
    cap_ratio: Decimal,
) -> dict[str, Any]:
    """对全员逐人算年度基数调整补差:差额走封顶保底后的核定基数,再乘个人/单位比例合计×月数。

    逐险种分项 quantize(0.01) 后求和(与 `_compute_row` 同口径),保证个人/单位补差
    分项之和 == 各自合计,且全员合计 == 逐人合计(勾稽)。
    """
    old_declared = adj["old_base"]
    new_declared = adj["new_base"]
    months = adj["months"]
    months_list = adj["months_list"]

    per_employee: list[dict[str, Any]] = []
    personal_total = Decimal(0)
    employer_total = Decimal(0)

    # 按 group 切片定位每个员工所属组的社平工资(封顶保底锚)
    cursor = 0
    wage_of_row: list[Decimal] = []
    for wage, count in group_wages:
        wage_of_row.extend([wage] * count)
        cursor += count
    if len(wage_of_row) != len(rows):
        # 防御:切片数与行数不齐时统一回落顶层社平工资(理论不触发)
        wage_of_row = [group_wages[0][0] if group_wages else Decimal(0)] * len(rows)

    for idx, r in enumerate(rows):
        wage = wage_of_row[idx]
        floor = (wage * floor_ratio).quantize(Decimal("0.01"))
        cap = (wage * cap_ratio).quantize(Decimal("0.01"))
        old_verified, old_note = _clip_base(old_declared, floor, cap)
        new_verified, new_note = _clip_base(new_declared, floor, cap)
        base_gap_month = (new_verified - old_verified).quantize(Decimal("0.01"))

        er_parts: list[tuple[str, Decimal]] = []
        ee_parts: list[tuple[str, Decimal]] = []
        employer_diff = Decimal(0)
        personal_diff = Decimal(0)
        for key in _BASE_ADJ_EMPLOYER_KEYS:
            amount = (base_gap_month * rates[key] * months).quantize(Decimal("0.01"))
            er_parts.append((key, amount))
            employer_diff += amount
        for key in _BASE_ADJ_EMPLOYEE_KEYS:
            amount = (base_gap_month * rates[key] * months).quantize(Decimal("0.01"))
            ee_parts.append((key, amount))
            personal_diff += amount
        employer_diff = employer_diff.quantize(Decimal("0.01"))
        personal_diff = personal_diff.quantize(Decimal("0.01"))
        total_diff = (employer_diff + personal_diff).quantize(Decimal("0.01"))
        personal_total += personal_diff
        employer_total += employer_diff

        months_label = ",".join(months_list) if months_list else f"近{months}个月"
        per_employee.append(
            {
                "name": r.name,
                "old_base": _q(old_verified),
                "new_base": _q(new_verified),
                "months": months,
                "months_list": months_list,
                "base_gap_month": _q(base_gap_month),
                "old_clip_note": old_note,
                "new_clip_note": new_note,
                "personal_by_insurance": {k: _q(v) for k, v in ee_parts},
                "employer_by_insurance": {k: _q(v) for k, v in er_parts},
                "personal_diff": _q(personal_diff),
                "employer_diff": _q(employer_diff),
                "total_diff": _q(total_diff),
                "months_label": months_label,
            }
        )

    personal_total = personal_total.quantize(Decimal("0.01"))
    employer_total = employer_total.quantize(Decimal("0.01"))
    grand_total = (personal_total + employer_total).quantize(Decimal("0.01"))
    clip_note = ""
    if old_declared == new_declared:
        clip_note = "新旧基数一致,补差为 0。"
    note = (
        f"年度基数调整补差:旧核定基数(封顶保底后)→新核定基数(封顶保底后),"
        f"差额×个人/单位比例合计×{months}个月;逐险种分项两位小数后求和,"
        f"个人/单位合计与全员合计勾稽。{clip_note}"
    )
    return {
        "per_employee": per_employee,
        "personal_total": _q(personal_total),
        "employer_total": _q(employer_total),
        "grand_total": _q(grand_total),
        "note": note,
    }


@dataclass
class _EmployeeRow:
    name: str
    gross: Decimal
    declared_base: Decimal
    verified_base: Decimal  # 核定基数(封顶保底后)
    base_note: str  # "核定=申报" / "托底(按下限)" / "封顶(按上限)"

    # 各险种(单位,个人)
    pension_er: Decimal
    pension_ee: Decimal
    medical_er: Decimal
    medical_ee: Decimal
    unemployment_er: Decimal
    unemployment_ee: Decimal
    injury_er: Decimal
    big_illness_ee: Decimal  # 大病互助(个人绝对额)
    maternity_er: Decimal
    fund_er: Decimal
    fund_ee: Decimal

    # 医保拆分
    medical_account: Decimal  # 划入个人账户
    medical_pool: Decimal  # 划入统筹

    # 工伤行业差别费率(任务2):actual_injury_class 为 None 表示沿用缺省 0.2%,非 None 表示员工传了该档
    actual_injury_class: int | None
    actual_injury_rate: Decimal  # 实际使用的工伤单位费率(缺省取 rates["injury_employer"])

    # 汇总
    employer_total: Decimal  # 单位合计(五险一金单位侧,不含个人代扣)
    employee_total: Decimal  # 个人代扣合计(五险一金个人侧,含大病互助)
    employer_total_cost: Decimal  # 单位总成本 = 单位合计 + 应发工资(用于成本口径参考)


def _normalize_employees(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, str) and raw.strip():
        try:
            raw = json.loads(raw)
        except (json.JSONDecodeError, TypeError) as exc:
            raise ValueError(f"employees 必须是数组或其 JSON 字符串:{exc}") from None
    if not isinstance(raw, list) or not raw:
        raise ValueError("employees 必须是非空数组([{name, gross, base?}, ...])")
    if len(raw) > _MAX_EMPLOYEES:
        raise ValueError(f"employees 人数超过上限 {_MAX_EMPLOYEES}")
    return raw


def _fund_rate_warning(emp_label: str, rate_key: str, value: Decimal) -> dict[str, Any]:
    """公积金缴存比例区间校验(任务2):超出 [5%, 12%] 只标注不拒绝。

    红线:公积金比例由各地住房公积金管理中心核定,各地上下限可能不同
    (常见 5%~12%),超出区间不代表计算错,而是提示复核当地政策。
    """
    pct = (value * 100).quantize(Decimal("0.01"))
    return {
        "severity": "warning",
        "code": "FUND_RATE_OUT_OF_RANGE",
        "field": f"{rate_key}",
        "employee": emp_label,
        "value": str(value),
        "message": (
            f"{emp_label} 的 {rate_key}={pct}% 超出常见区间 [5%, 12%];"
            "公积金缴存比例应在5%~12%之间,超出需确认当地政策。本次仍按传入比例计算。"
        ),
    }


def _compute_row(
    emp: dict[str, Any],
    idx: int,
    *,
    rates: dict[str, Decimal],
    split: dict[str, Any],
    social_avg_wage: Decimal,
    floor_ratio: Decimal,
    cap_ratio: Decimal,
    default_base_to_gross: bool,
    findings: list[dict[str, Any]] | None = None,
) -> _EmployeeRow:
    name = str(emp.get("name") or f"员工{idx + 1}")[:_MAX_TEXT_LEN]
    gross = _money(emp.get("gross"), f"employees[{idx}].gross")
    if gross < 0:
        raise ValueError(f"employees[{idx}].gross 不能为负:{gross}")

    # 缴费基数:显式传 base 则用;否则按 default_base_to_gross 决定是否取 gross
    raw_base = emp.get("base")
    if raw_base is None or (isinstance(raw_base, str) and not str(raw_base).strip()):
        declared = gross if default_base_to_gross else Decimal(0)
    else:
        declared = _money(raw_base, f"employees[{idx}].base")
    if declared < 0:
        raise ValueError(f"employees[{idx}].base 不能为负:{declared}")

    # 封顶保底:上下限 = 社平工资 × 比例
    floor = (social_avg_wage * floor_ratio).quantize(Decimal("0.01"))
    cap = (social_avg_wage * cap_ratio).quantize(Decimal("0.01"))
    verified = declared
    if verified < floor:
        verified = floor
        note = f"托底(按下限 {floor})"
    elif verified > cap:
        verified = cap
        note = f"封顶(按上限 {cap})"
    else:
        note = "核定=申报"

    # 公积金比例区间校验(任务2):fund_employer/fund_employee 超出 [5%, 12%] 加 warning finding,
    # 不拒绝计算、不修改 rates,仅产出可读提示供前端/复核人员关注。
    _FUND_RATE_LO = Decimal("0.05")
    _FUND_RATE_HI = Decimal("0.12")
    label = f"员工[{idx + 1}] {name}"
    if findings is not None:
        if not (_FUND_RATE_LO <= rates["fund_employer"] <= _FUND_RATE_HI):
            findings.append(_fund_rate_warning(label, "fund_employer", rates["fund_employer"]))
        if not (_FUND_RATE_LO <= rates["fund_employee"] <= _FUND_RATE_HI):
            findings.append(_fund_rate_warning(label, "fund_employee", rates["fund_employee"]))

    # 工伤行业差别费率(任务2):员工传了 injury_class(1~8)时用对应档费率覆盖 rates["injury_employer"];
    # 未传或传 None ⇒ 沿用缺省费率,行为不变;传了但不在 1~8 ⇒ 拒绝。
    injury_class_raw = emp.get("injury_class")
    actual_injury_class: int | None = None
    actual_injury_rate = rates["injury_employer"]
    if injury_class_raw not in (None, ""):
        try:
            actual_injury_class = int(injury_class_raw)
        except (TypeError, ValueError) as exc:
            raise ValueError(
                f"employees[{idx}].injury_class 必须为整数:{injury_class_raw!r}"
            ) from exc
        if actual_injury_class not in INJURY_CLASS_RATES:
            raise ValueError(
                f"employees[{idx}].injury_class 必须在 1~8 之间:{actual_injury_class}"
            )
        actual_injury_rate = INJURY_CLASS_RATES[actual_injury_class]

    def contrib(rate_key: str) -> tuple[Decimal, Decimal]:
        er_rate = rates[f"{rate_key}_employer"]
        ee_rate = rates[f"{rate_key}_employee"]
        er = (verified * er_rate).quantize(Decimal("0.01"))
        ee = (verified * ee_rate).quantize(Decimal("0.01"))
        return er, ee

    pension_er, pension_ee = contrib("pension")
    medical_er, medical_ee = contrib("medical")
    unemployment_er, unemployment_ee = contrib("unemployment")
    injury_er = (verified * actual_injury_rate).quantize(Decimal("0.01"))
    big_illness_ee = rates["medical_big_illness_employee_flat"].quantize(Decimal("0.01"))
    maternity_er = (verified * rates["maternity_employer"]).quantize(Decimal("0.01"))
    fund_er = (verified * rates["fund_employer"]).quantize(Decimal("0.01"))
    fund_ee = (verified * rates["fund_employee"]).quantize(Decimal("0.01"))

    # 医保拆分:个人账户 vs 统筹
    # 个人账户 = 个人缴纳 × employee_to_account + 单位缴纳 × employer_to_account_ratio
    med_account = (
        medical_ee * split["employee_to_account"]
        + medical_er * split["employer_to_account_ratio"]
    ).quantize(Decimal("0.01"))
    # 统筹 = 单位 + 个人 缴入总额 - 个人账户 - 大病互助(全额进统筹)
    med_pool = (medical_er + medical_ee - med_account).quantize(Decimal("0.01"))
    if med_pool < 0:  # 拆分规则被覆盖得过于激进 ⇒ 不出现负统筹,把超出部分收回个人账户
        med_account = med_account + med_pool
        med_pool = Decimal(0)

    employer_total = (
        pension_er + medical_er + unemployment_er + injury_er + maternity_er + fund_er
    ).quantize(Decimal("0.01"))
    employee_total = (
        pension_ee + medical_ee + unemployment_ee + big_illness_ee + fund_ee
    ).quantize(Decimal("0.01"))
    employer_total_cost = (employer_total + gross).quantize(Decimal("0.01"))

    return _EmployeeRow(
        name=name,
        gross=gross,
        declared_base=declared,
        verified_base=verified,
        base_note=note,
        pension_er=pension_er,
        pension_ee=pension_ee,
        medical_er=medical_er,
        medical_ee=medical_ee,
        unemployment_er=unemployment_er,
        unemployment_ee=unemployment_ee,
        injury_er=injury_er,
        big_illness_ee=big_illness_ee,
        maternity_er=maternity_er,
        fund_er=fund_er,
        fund_ee=fund_ee,
        medical_account=med_account,
        medical_pool=med_pool,
        actual_injury_class=actual_injury_class,
        actual_injury_rate=actual_injury_rate,
        employer_total=employer_total,
        employee_total=employee_total,
        employer_total_cost=employer_total_cost,
    )


# ---------------------------------------------------------------------------
# HTML 产物(同 finance_tools 惯例:落 tmp/artifacts,前端 tool-call-card 直渲)
# ---------------------------------------------------------------------------


def _write_report(
    *,
    period: str,
    city: str,
    province: str,
    rows: list[_EmployeeRow],
    rates: dict[str, Decimal],
    social_avg_wage: Decimal,
    floor: Decimal,
    cap: Decimal,
    output_dir: Any,
    resolved_dir: Path | None = None,
) -> str:
    out_dir = resolved_dir if resolved_dir is not None else _resolve_output_dir(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
    file_path = out_dir / f"social-insurance-{period}-{stamp}.html"

    body_rows = "\n".join(
        "<tr>"
        f"<td>{html.escape(r.name)}</td>"
        f"<td class='num'>{html.escape(_q(r.gross))}</td>"
        f"<td class='num'>{html.escape(_q(r.verified_base))}</td>"
        f"<td>{html.escape(r.base_note)}</td>"
        f"<td class='num'>{html.escape(_q(r.pension_er))}</td>"
        f"<td class='num'>{html.escape(_q(r.pension_ee))}</td>"
        f"<td class='num'>{html.escape(_q(r.medical_er))}</td>"
        f"<td class='num'>{html.escape(_q(r.medical_ee))}</td>"
        f"<td class='num'>{html.escape(_q(r.unemployment_er))}</td>"
        f"<td class='num'>{html.escape(_q(r.unemployment_ee))}</td>"
        f"<td class='num'>{html.escape(_q(r.injury_er))}</td>"
        f"<td class='num'>{html.escape(_q(r.fund_er))}</td>"
        f"<td class='num'>{html.escape(_q(r.fund_ee))}</td>"
        f"<td class='num'>{html.escape(_q(r.medical_account))}</td>"
        f"<td class='num'>{html.escape(_q(r.medical_pool))}</td>"
        f"<td class='num'>{html.escape(_q(r.employer_total))}</td>"
        f"<td class='num'>{html.escape(_q(r.employee_total))}</td>"
        f"<td class='num'>{html.escape(_q(r.employer_total_cost))}</td>"
        "</tr>"
        for r in rows
    )

    rate_lines = " · ".join(
        f"{k}={_q(v)}" if v == v.to_integral() else f"{k}={v}" for k, v in rates.items()
    )

    doc = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>社保医保缴费测算 · {html.escape(period)}</title>
<style>
body {{ margin:0; padding:24px; font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif; color:#1f2328; background:#fff; }}
main {{ max-width:1400px; margin:0 auto; }}
h1 {{ font-size:22px; margin:0 0 4px; }}
h2 {{ font-size:17px; margin:28px 0 8px; }}
table {{ width:100%; border-collapse:collapse; font-size:12px; }}
th,td {{ border:1px solid #d8dee4; padding:5px 6px; }}
.num {{ text-align:right; font-variant-numeric:tabular-nums; }}
footer {{ margin-top:32px; color:#57606a; font-size:12px; }}
.warn {{ background:#fff8c5; border:1px solid #d4a72c66; padding:10px 12px; }}
.meta {{ color:#57606a; font-size:12px; margin:8px 0; }}
</style>
</head>
<body>
<main>
<h1>社保医保缴费测算 · {html.escape(period)}</h1>
<div class="warn">本产物为系统按公开常见口径的<strong>草案</strong>;真实申报缴费口径<strong>以参保地人社/医保核定为准</strong>,须由执业资格人员复核;本工具不代理任何对外报送、不联网。</div>
<p class="meta">参保地:{html.escape(province or "-")} / {html.escape(city or "-")} · 期间:{html.escape(period)} · 人数:{len(rows)}</p>
<p class="meta">社平工资(基数上下限锚):{html.escape(_q(social_avg_wage))} · 下限(60%)={html.escape(_q(floor))} · 上限(300%)={html.escape(_q(cap))}</p>
<p class="meta">费率(可覆盖缺省):{html.escape(rate_lines)}</p>
<h2>逐人缴费明细</h2>
<table>
<thead><tr>
<th>姓名</th><th>应发</th><th>核定基数</th><th>封顶/保底</th>
<th>养老·单位</th><th>养老·个人</th>
<th>医疗·单位</th><th>医疗·个人</th>
<th>失业·单位</th><th>失业·个人</th>
<th>工伤·单位</th>
<th>公积金·单位</th><th>公积金·个人</th>
<th>医保·个人账户</th><th>医保·统筹</th>
<th>单位合计</th><th>个人代扣合计</th><th>单位总成本</th>
</tr></thead>
<tbody>{body_rows}</tbody>
</table>
<footer>IHUI AI 财务部 · 社保医保缴费测算 · 生成于 {datetime.now().strftime("%Y-%m-%d %H:%M")}</footer>
</main>
</body>
</html>
"""
    file_path.write_text(doc, encoding="utf-8")
    try:
        relative = file_path.resolve().relative_to(_PROJECT_ROOT.resolve())
    except ValueError:
        relative = Path(file_path.name)
    return relative.as_posix()


# ---------------------------------------------------------------------------
# 工具入口
# ---------------------------------------------------------------------------


def _social_insurance_calc(arguments: dict[str, Any]) -> dict[str, Any]:
    tool = "social_insurance_calc"
    try:
        # 提前一次把关 output_dir:groups 多组会多次写报告,这里统一拒绝越界路径,
        # 单独捕获返回 INVALID_OUTPUT_DIR(保持向后兼容的错误码语义,不被后面
        # except ValueError 吞成 INVALID_INPUT)。
        resolved_dir = _resolve_output_dir(arguments.get("output_dir"))
    except ValueError as exc:
        return _fail(tool, "INVALID_OUTPUT_DIR", str(exc))
    try:
        if not isinstance(arguments, dict):
            return _fail(tool, "INVALID_ARGS", "arguments 必须为 dict")

        period = _resolve_period(arguments)
        city = str(arguments.get("city") or "").strip()[:_MAX_TEXT_LEN]
        province = str(arguments.get("province") or "").strip()[:_MAX_TEXT_LEN]

        # 社平工资(定基数上下限锚)—— 可覆盖缺省参数
        social_avg_wage = _money(
            arguments.get("social_avg_wage") or 8000,
            "social_avg_wage",
        )
        if social_avg_wage <= 0:
            return _fail(tool, "INVALID_INPUT", f"social_avg_wage 必须为正:{social_avg_wage}")

        floor_ratio = _rate(
            arguments.get("base_floor_ratio"),
            DEFAULT_BASE_FLOOR_RATIO,
            "base_floor_ratio",
            lo=Decimal(0),
            hi=Decimal(1),
        )
        cap_ratio = _rate(
            arguments.get("base_cap_ratio"),
            DEFAULT_BASE_CAP_RATIO,
            "base_cap_ratio",
            lo=Decimal(1),
            hi=Decimal(10),
        )
        floor = (social_avg_wage * floor_ratio).quantize(Decimal("0.01"))
        cap = (social_avg_wage * cap_ratio).quantize(Decimal("0.01"))

        # 费率:逐项可覆盖,缺省取 DEFAULT_RATES(字符串构造,杜绝 float 二进制漂移)
        rates: dict[str, Decimal] = {}
        for key, default in DEFAULT_RATES.items():
            rates[key] = _rate(arguments.get(key), default, key)

        # 医保拆分规则覆盖
        split = {
            "employee_to_account": _rate(
                arguments.get("medical_employee_to_account_ratio"),
                DEFAULT_MEDICAL_ACCOUNT_SPLIT["employee_to_account"],
                "medical_employee_to_account_ratio",
            ),
            "employer_to_account_ratio": _rate(
                arguments.get("medical_employer_to_account_ratio"),
                DEFAULT_MEDICAL_ACCOUNT_SPLIT["employer_to_account_ratio"],
                "medical_employer_to_account_ratio",
            ),
        }
        # base 缺省是否取 gross(可覆盖;缺省 True = 未传 base 视为按应发申报)
        default_base_to_gross = bool(arguments.get("base_defaults_to_gross", True))

        # 年度基数调整补差入参(向后兼容:未传 / 缺 new_base ⇒ 返回 {},不加 base_adjustment 键)
        base_adjustment = _normalize_base_adjustment(arguments.get("base_adjustment"))

        # 逾期滞纳金入参(任务1;向后兼容:未传 / 缺 overdue_days ⇒ 返回 {},不加 late_fee 键)
        late_fee = _normalize_late_fee(arguments.get("late_fee"))

        # 跨年补缴利息入参(向后兼容:未传 / 缺 years(整数≥1) ⇒ 返回 {},不加键)
        cross_year_interest = _normalize_cross_year_interest(arguments.get("cross_year_interest"))

        # 大额医疗/补充医疗入参(任务1;向后兼容:未传 / 全 0 ⇒ None,不加 supplementary_medical 键)
        supplementary_medical = _normalize_supplementary_medical(
            arguments.get("supplementary_medical")
        )

        # 个税代扣协同校验开关(任务2;缺省 False ⇒ 不算、不加 iit_withholding_notes 键)
        iit_withholding_check = bool(arguments.get("iit_withholding_check", False))

        # 公积金比例区间校验的收集器(任务2):逐人产出 warning finding
        findings: list[dict[str, Any]] = []

        def run_group(
            employees_list: list[dict[str, Any]],
            wage: Decimal,
        ) -> list[_EmployeeRow]:
            """对一组员工(单一社平工资锚)逐人精算;floor_ratio/cap_ratio 全局共用。"""
            g_floor = (wage * floor_ratio).quantize(Decimal("0.01"))
            g_cap = (wage * cap_ratio).quantize(Decimal("0.01"))
            g_rows: list[_EmployeeRow] = []
            for idx, emp in enumerate(employees_list):
                g_rows.append(
                    _compute_row(
                        emp,
                        idx,
                        rates=rates,
                        split=split,
                        social_avg_wage=wage,
                        floor_ratio=floor_ratio,
                        cap_ratio=cap_ratio,
                        default_base_to_gross=default_base_to_gross,
                        findings=findings,
                    )
                )
            return g_rows

        # 多统筹地区批量(任务1):groups 存在且非空 ⇒ 忽略顶层 city/employees,
        # 每个 group 用自己的 social_avg_wage(决定基数上下限)与 city 标签独立计算。
        groups_raw = arguments.get("groups")
        group_specs: list[dict[str, Any]] = []
        if isinstance(groups_raw, str) and groups_raw.strip():
            try:
                groups_raw = json.loads(groups_raw)
            except (json.JSONDecodeError, TypeError) as exc:
                raise ValueError(f"groups 必须是数组或其 JSON 字符串:{exc}") from None
        if isinstance(groups_raw, list) and groups_raw:
            for gi, grp in enumerate(groups_raw):
                if not isinstance(grp, dict):
                    raise ValueError(f"groups[{gi}] 必须是对象 {{city, social_avg_wage, employees}}")
                g_city = str(grp.get("city") or f"地区{gi + 1}").strip()[:_MAX_TEXT_LEN]
                g_province = str(grp.get("province") or province).strip()[:_MAX_TEXT_LEN]
                raw_wage = grp.get("social_avg_wage") or social_avg_wage
                g_wage = _money(raw_wage, f"groups[{gi}].social_avg_wage")
                if g_wage <= 0:
                    raise ValueError(f"groups[{gi}].social_avg_wage 必须为正:{g_wage}")
                g_emps = _normalize_employees(grp.get("employees"))
                group_specs.append(
                    {"city": g_city, "province": g_province, "wage": g_wage, "employees": g_emps}
                )

        # 逐组精算(单城市模式 = 只有一个匿名 group,city/province 取顶层)
        group_results: list[dict[str, Any]] = []  # 每组:{city, province, wage, rows, html}
        all_rows: list[_EmployeeRow] = []
        group_wages_aligned: list[tuple[Decimal, int]] = []  # [(组社平工资, 组人数)],与 all_rows 对齐(补差锚)
        if group_specs:
            for spec in group_specs:
                g_rows = run_group(spec["employees"], spec["wage"])
                g_html = _write_report(
                    period=period,
                    city=spec["city"],
                    province=spec["province"],
                    rows=g_rows,
                    rates=rates,
                    social_avg_wage=spec["wage"],
                    floor=(spec["wage"] * floor_ratio).quantize(Decimal("0.01")),
                    cap=(spec["wage"] * cap_ratio).quantize(Decimal("0.01")),
                    output_dir=arguments.get("output_dir"),
                    resolved_dir=resolved_dir,
                )
                group_results.append({**spec, "rows": g_rows, "html": g_html})
                all_rows.extend(g_rows)
                group_wages_aligned.append((spec["wage"], len(g_rows)))
        else:
            # 回落原逻辑:单 city + 顶层 employees
            employees_raw = _normalize_employees(arguments.get("employees"))
            rows = run_group(employees_raw, social_avg_wage)
            html_path = _write_report(
                period=period,
                city=city,
                province=province,
                rows=rows,
                rates=rates,
                social_avg_wage=social_avg_wage,
                floor=floor,
                cap=cap,
                output_dir=arguments.get("output_dir"),
                resolved_dir=resolved_dir,
            )
            group_results.append(
                {
                    "city": city,
                    "province": province,
                    "wage": social_avg_wage,
                    "rows": rows,
                    "html": html_path,
                }
            )
            all_rows = rows
            group_wages_aligned.append((social_avg_wage, len(rows)))
        rows = all_rows
    except ValueError as exc:
        return _fail(tool, "INVALID_INPUT", str(exc))

    # 年度基数调整补差(向后兼容:仅当 base_adjustment 传入且含 new_base 时才算)
    base_adjustment_out: dict[str, Any] | None = None
    if base_adjustment:
        try:
            base_adjustment_out = _compute_base_adjustment(
                base_adjustment,
                rows,
                group_wages_aligned,
                rates=rates,
                floor_ratio=floor_ratio,
                cap_ratio=cap_ratio,
            )
        except ValueError as exc:
            return _fail(tool, "INVALID_INPUT", str(exc))

    # 全员汇总
    def col(attr: str) -> Decimal:
        return sum((getattr(r, attr) for r in rows), Decimal(0))

    grand = {
        "pension_employer": col("pension_er"),
        "pension_employee": col("pension_ee"),
        "medical_employer": col("medical_er"),
        "medical_employee": col("medical_ee"),
        "unemployment_employer": col("unemployment_er"),
        "unemployment_employee": col("unemployment_ee"),
        "injury_employer": col("injury_er"),
        "big_illness_employee": col("big_illness_ee"),
        "maternity_employer": col("maternity_er"),
        "fund_employer": col("fund_er"),
        "fund_employee": col("fund_ee"),
        "medical_account": col("medical_account"),
        "medical_pool": col("medical_pool"),
    }
    employer_total = col("employer_total")
    employee_total = col("employee_total")  # 代扣个人合计(喂 salary 分录与个税 social 字段)
    employer_total_cost = col("employer_total_cost")

    # 勾稽断言:分项和 == 合计
    employer_parts = (
        grand["pension_employer"]
        + grand["medical_employer"]
        + grand["unemployment_employer"]
        + grand["injury_employer"]
        + grand["maternity_employer"]
        + grand["fund_employer"]
    )
    employee_parts = (
        grand["pension_employee"]
        + grand["medical_employee"]
        + grand["unemployment_employee"]
        + grand["big_illness_employee"]
        + grand["fund_employee"]
    )
    if employer_parts != employer_total or employee_parts != employee_total:
        return _fail(
            tool,
            "INTERNAL_INCONSISTENT",
            f"汇总勾稽失败:单位分项和={employer_parts} 合计={employer_total};"
            f"个人分项和={employee_parts} 合计={employee_total}",
        )

    # 逐人勾稽:每人单位合计 == 该人单位侧分项和;个人合计同理
    for idx, r in enumerate(rows):
        er_sum = (
            r.pension_er + r.medical_er + r.unemployment_er + r.injury_er + r.maternity_er + r.fund_er
        )
        ee_sum = r.pension_ee + r.medical_ee + r.unemployment_ee + r.big_illness_ee + r.fund_ee
        if er_sum != r.employer_total or ee_sum != r.employee_total:
            return _fail(
                tool,
                "INTERNAL_INCONSISTENT",
                f"员工[{idx}] {r.name} 勾稽失败:单位分项和={er_sum} 合计={r.employer_total};"
                f"个人分项和={ee_sum} 合计={r.employee_total}",
            )

    # 产物:HTML 已在 groups 循环里逐组写出;此处保留旧的 output_dir 校验面(向后兼容
    # 单城市路径的错误码语义),不重复生成单城市 HTML。
    try:
        _resolve_output_dir(arguments.get("output_dir"))
    except ValueError as exc:
        return _fail(tool, "INVALID_OUTPUT_DIR", str(exc))

    # 逐人明细(全部走 _q 字符串出参,跨端无损)
    employees_out = [
        {
            "name": r.name,
            "gross": _q(r.gross),
            "declaredBase": _q(r.declared_base),
            "verifiedBase": _q(r.verified_base),
            "baseNote": r.base_note,
            "pension": {"employer": _q(r.pension_er), "employee": _q(r.pension_ee)},
            "medical": {"employer": _q(r.medical_er), "employee": _q(r.medical_ee)},
            "unemployment": {"employer": _q(r.unemployment_er), "employee": _q(r.unemployment_ee)},
            "injury": {"employer": _q(r.injury_er), "employee": "0.00"},
            "injuryClass": r.actual_injury_class,  # 任务2:None = 沿用缺省,非 None = 该档(1~8)
            "injuryRateUsed": str(r.actual_injury_rate),  # 实际使用的工伤单位费率(字符串,跨端无损)
            "maternity": {"employer": _q(r.maternity_er), "employee": "0.00"},
            "bigIllnessEmployee": _q(r.big_illness_ee),
            "housingFund": {"employer": _q(r.fund_er), "employee": _q(r.fund_ee)},
            "medicalAccountSplit": {
                "personalAccount": _q(r.medical_account),
                "pool": _q(r.medical_pool),
            },
            "employerTotal": _q(r.employer_total),
            "employeeWithheldTotal": _q(r.employee_total),  # 代账 salary 分录 / 个税 social 字段口径
            "employerTotalCost": _q(r.employer_total_cost),
        }
        for r in rows
    ]

    # 多组模式:按 group 切片输出(city 标签 + 每组全员合计 + 各组 HTML 报告)
    is_group_mode = bool(group_specs)
    groups_out: list[dict[str, Any]] = []
    cursor = 0
    for g in group_results:
        g_len = len(g["rows"])
        g_slice = employees_out[cursor : cursor + g_len]
        cursor += g_len
        g_employer_total = sum((r.employer_total for r in g["rows"]), Decimal(0))
        g_employee_total = sum((r.employee_total for r in g["rows"]), Decimal(0))
        g_employer_cost = sum((r.employer_total_cost for r in g["rows"]), Decimal(0))
        g_gross = sum((r.gross for r in g["rows"]), Decimal(0))
        g_floor = (g["wage"] * floor_ratio).quantize(Decimal("0.01"))
        g_cap = (g["wage"] * cap_ratio).quantize(Decimal("0.01"))
        groups_out.append(
            {
                "city": g["city"],
                "province": g["province"],
                "socialAvgWage": _q(g["wage"]),
                "baseFloor": _q(g_floor),
                "baseCap": _q(g_cap),
                "headcount": g_len,
                "employees": g_slice,
                "employerTotal": _q(g_employer_total),  # 该组单位合计
                "employeeWithheldTotal": _q(g_employee_total),  # 该组代扣个人合计
                "employerTotalCost": _q(g_employer_cost),  # 该组单位总成本(含该组应发)
                "grossTotal": _q(g_gross),
                "html": g["html"],
            }
        )

    # summary 的 city/province/wage 字段:单城市模式保持原样;多组模式给"跨地区"标签
    summary_city = city if not is_group_mode else f"{len(group_specs)}个统筹地区"
    summary_province = province if not is_group_mode else ""
    summary_wage = social_avg_wage if not is_group_mode else Decimal(0)

    summary = {
        "headcount": len(rows),
        "period": period,
        "city": summary_city,
        "province": summary_province,
        "socialAvgWage": _q(summary_wage),
        "baseFloor": _q(floor if not is_group_mode else Decimal(0)),
        "baseCap": _q(cap if not is_group_mode else Decimal(0)),
        "ratesApplied": {k: (str(v) if v == v.to_integral() else str(v)) for k, v in rates.items()},
        "grand": {k: _q(v) for k, v in grand.items()},
        "employerMonthlyTotal": _q(employer_total),  # 单位月度总缴费(跨组汇总)
        "employeeWithheldTotal": _q(employee_total),  # 代扣个人合计(跨组汇总)
        "employerTotalCostMonthly": _q(employer_total_cost),  # 含应发工资的单位总成本(跨组汇总)
    }

    disclaimer = (
        "本测算为系统按公开常见口径生成的草案;真实缴费口径与费率**以参保地人社/医保核定为准**;"
        "实际申报前须由执业资格人员复核。本工具不代理任何对外报送、不写生产库、不联网。"
    )

    # 个税代扣协同校验(任务2):仅当 iit_withholding_check=True 才算,超限员工每人一条提示
    iit_notes: list[str] | None = None
    if iit_withholding_check:
        iit_notes = _compute_iit_withholding_notes(rows, rates)

    result: dict[str, Any] = {
        "tool": tool,
        "ok": True,
        "progress": _progress("compute", 1, 1, None),
        "phaseResult": {
            "summary": summary,
            "employees": employees_out,
            "html": html_path if not is_group_mode else (groups_out[0]["html"] if groups_out else ""),
            "groups": groups_out if is_group_mode else None,  # 多统筹地区模式按组分组输出
            "findings": findings,  # 任务2:公积金比例区间 warning(无 warning 时为空数组)
        },
        "state": json.dumps(
            {"period": period, "summary": summary}, ensure_ascii=False
        ),
        "summaryLine": (
            f"{period} 共 {len(rows)} 人:单位月度总缴费 {_q(employer_total)},"
            f"代扣个人合计 {_q(employee_total)},单位总成本 {_q(employer_total_cost)}"
        ),
        "disclaimer": disclaimer,
    }
    # 年度基数调整补差:仅当传入 base_adjustment 且含 new_base 时才加该键(向后兼容,
    # 不传 ⇒ 返回不含此键,老调用方零感知)。
    if base_adjustment_out is not None:
        result["base_adjustment"] = base_adjustment_out

    # 逾期滞纳金(任务1):仅当 late_fee 传入且含 overdue_days 时才加该键(向后兼容,
    # 不传 ⇒ 返回不含此键,老调用方零感知)。overdue_amount 缺省用本次 employee_total+employer_total。
    if late_fee:
        try:
            lf_amount = late_fee["overdue_amount"]
            if lf_amount is None:
                lf_amount = employee_total + employer_total
            lf_value = (lf_amount * late_fee["daily_rate"] * late_fee["overdue_days"]).quantize(
                Decimal("0.01")
            )
        except ValueError as exc:
            return _fail(tool, "INVALID_INPUT", str(exc))
        result["late_fee"] = {
            "overdue_amount": _q(lf_amount),
            "daily_rate": str(late_fee["daily_rate"]),
            "overdue_days": late_fee["overdue_days"],
            "late_fee_amount": _q(lf_value),
            "note": _LATE_FEE_NOTE,
        }
    # 跨年补缴利息:仅当 cross_year_interest 传入且含 years(整数≥1)时才加该键(向后兼容,
    # 不传 ⇒ 返回不含此键,老调用方零感知)。与 late_fee 独立:两者可同时收,互不干扰。
    # principal 缺省用本次 employee_total+employer_total;单利 = principal × rate × years
    # (实务多为单利,不复杂化到复利)。
    if cross_year_interest:
        try:
            cy_principal = cross_year_interest["principal"]
            if cy_principal is None:
                cy_principal = employee_total + employer_total
            cy_interest = (cy_principal * cross_year_interest["rate"] * cross_year_interest["years"]).quantize(
                Decimal("0.01")
            )
        except ValueError as exc:
            return _fail(tool, "INVALID_INPUT", str(exc))
        result["cross_year_interest"] = {
            "principal": _q(cy_principal),
            "years": cross_year_interest["years"],
            "rate": str(cross_year_interest["rate"]),
            "rate_basis": cross_year_interest["rate_basis"],
            "interest": _q(cy_interest),
            "note": _CROSS_YEAR_NOTE,
        }
    # 大额医疗/补充医疗(任务1):仅当传入且任一字段>0 时才加该键(向后兼容)
    if supplementary_medical is not None:
        result["supplementary_medical"] = _compute_supplementary_medical(
            supplementary_medical, rows
        )

    # 个税代扣协同校验(任务2):仅当开关为真才加该键(向后兼容,false ⇒ 不加键)
    if iit_notes is not None:
        result["iit_withholding_notes"] = iit_notes
    return result


async def social_insurance_calc(arguments: Any) -> dict[str, Any]:
    """社保医保月度缴费精算:逐人五险一金 + 医保个人账户/统筹拆分 + 基数封顶保底。"""
    payload = arguments if isinstance(arguments, dict) else {}
    return _social_insurance_calc(payload)


__all__ = [
    "SOCIAL_INSURANCE_DESCRIPTION",
    "social_insurance_calc",
    "DEFAULT_RATES",
    "DEFAULT_MEDICAL_ACCOUNT_SPLIT",
    "DEFAULT_BASE_FLOOR_RATIO",
    "DEFAULT_BASE_CAP_RATIO",
    "INJURY_CLASS_RATES",
    "DEFAULT_LATE_FEE_DAILY_RATE",
    "DEFAULT_CROSS_YEAR_RATE",
]


#: schema 描述(mcp_server 注册处共用,单一真相源)
SOCIAL_INSURANCE_DESCRIPTION = (
    "社保医保月度缴费精算(财务部板块插件,补 finance_tools automation 社保腿背后的数字)。"
    "按**参保地人社/医保核定口径**逐人算五险一金:养老、医疗(含生育/大病,可拆)、失业、"
    "工伤(单位按行业费率,个人不缴)、公积金(单位/个人可不同),产出逐人缴费明细 + "
    "全员单位月度总缴费 + 代扣个人合计(直接喂代账 salary 分录『其他应付款-代扣社保』与"
    "个税扣缴 employees[i].social 字段)+ 医保个人账户 vs 统筹拆分 + 基数封顶保底逐人标注。"
    "**入参**:period(形如 2026-11,必填)、employees(数组 [{name, gross(应发), base(缴费基数,"
    "缺省=gross)}],兼容 JSON 字符串)、social_avg_wage(社平工资,定基数上下限锚,缺省 8000)、"
    "city/province(参保地,提示口径差异)、base_floor_ratio(下限,缺省 0.60)、"
    "base_cap_ratio(上限,缺省 3.0);费率覆盖参数 pension_employer/pension_employee/"
    "medical_employer/medical_employee/unemployment_employer/unemployment_employee/"
    "injury_employer/fund_employer/fund_employee/maternity_employer/"
    "medical_big_illness_employee_flat(绝对额)、medical_employee_to_account_ratio/"
    "medical_employer_to_account_ratio(医保个人账户/统筹拆分);output_dir(落项目根内,缺省 tmp/artifacts)。"
    "**扩展可选参数(2026-11-13 增)**:groups(多统筹地区批量 [{city,social_avg_wage,employees}],一次算多城市)、"
    "base_adjustment({old_base,new_base,months,months_list?} 年度基数调整补差,个人/单位差额)、"
    "late_fee({overdue_days,daily_rate?,overdue_amount?} 逾期滞纳金,缺省日万分之五)、"
    "supplementary_medical({employer_flat?,employee_flat?,employer_rate?,employee_rate?} 大额/补充医疗)、"
    "iit_withholding_check=true(个人公积金缴超12%部分不得税前扣除的提示)、cross_year_interest"
    "({principal?,years,rate?,rate_basis?} 跨年补缴利息:单利 本金×利率×年数,与滞纳金独立可同时收)。"
    "employees 每人可带 injury_class(1~8 工伤行业差别费率档)。以上均为可选,不传即不计该项(向后兼容)。"
    "**红线**:草案须复核、以参保地人社/医保核定为准、不代理对外申报、不联网。"
)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
