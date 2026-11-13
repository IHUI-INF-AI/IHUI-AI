# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""个税七项专项附加扣除计算(财务部插件工具,2026-11-13 立)。

补齐 finance_tools._iit_cumulative 里 special_deduction 字段的上游:产出逐人七项
专项附加扣除明细 + 合计,合计可直接喂给 _iit_cumulative 的 special_deduction。

计算纪律(同 finance_tools):
- 全部金额走 Decimal(字符串入、字符串出),杜绝浮点误差进账表;
- 七项标准 + 分摊比例全部做成可覆盖缺省参数(schema 与输出双处可见);
- 互斥/合规校验显式点名,绝不静默放行;
- **红线(输出内如实声明)**:产物为"草案",真实申报须纳税主体与执业资格人员复核;
  以主管税务机关核定为准;政策可能调整;本工具不代理任何对外报送、不写生产库、
  不联网(纯计算 + tmp/artifacts 产物)。

安全:output_dir 必须落在项目根内(finance_tools 同一条校验);输入规模上限防膨胀。
零新依赖。
"""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any

_PROJECT_ROOT = Path(__file__).resolve().parents[4]
_DEFAULT_OUTPUT_DIR = _PROJECT_ROOT / "tmp" / "artifacts"
_TOOL = "special_deduction_calc"

# 输入规模上限(finance_tools 同款)
_MAX_EMPLOYEES = 500
_MAX_ITEMS = 50  # 单人单项下的子条目上限(子女/婴幼儿等)
_MAX_STATE_BYTES = 4_000_000


# ---------------------------------------------------------------------------
# 通用小件(抄 finance_tools 惯例)
# ---------------------------------------------------------------------------


def _fail(code: str, message: str) -> dict[str, Any]:
    return {"tool": _TOOL, "ok": False, "errorCode": code, "message": message}


def _money(raw: Any, where: str) -> Decimal:
    """金额入参统一走字符串/整数/小数三形态,拒绝 NaN/Inf/负数以外的畸形。"""
    if isinstance(raw, bool):
        raise ValueError(f"{where}: 金额不接受布尔值")
    if isinstance(raw, (int, Decimal)):
        value = Decimal(str(raw))
    elif isinstance(raw, float):
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
    if value < 0:
        raise ValueError(f"{where}: 金额不能为负 ⇒ {value}")
    return value


def _q(value: Decimal | int) -> str:
    """金额出参:保留两位(分),字符串形态跨端无损。"""
    return str(Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


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


def _parse_employees(raw: Any) -> list[dict[str, Any]]:
    """兼容三种形态:list / JSON 字符串 / 单个 dict。"""
    if isinstance(raw, dict):
        return [raw]
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            loaded = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"employees JSON 解析失败:{exc}") from None
        if isinstance(loaded, dict):
            return [loaded]
        if isinstance(loaded, list):
            return loaded
    raise ValueError("employees 必须是数组/JSON 字符串数组/dict 其一")


def _ensure_list(raw: Any, where: str) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if isinstance(raw, dict):
        return [raw]
    if isinstance(raw, list):
        if len(raw) > _MAX_ITEMS:
            raise ValueError(f"{where}: 条目数超限(≤{_MAX_ITEMS})")
        return [r for r in raw if isinstance(r, dict)]
    raise ValueError(f"{where}: 必须是数组或 dict")


def _share_of(raw: Any, default: Decimal) -> Decimal:
    """分摊比例入参:接受 0.5 形态的小数或 50 形态的百分数,统一到 0..1。"""
    if raw is None:
        return default
    value = _money(raw, "share")
    if value > 1:
        value = value / Decimal("100")
    if value < 0 or value > 1:
        raise ValueError("share 必须在 0..1 之间(或 0..100 之间的百分数)")
    return value


# ---------------------------------------------------------------------------
# 七项专项附加扣除现行标准(缺省参数,全部可覆盖)
# ---------------------------------------------------------------------------

# 1. 子女教育:每孩每月 2000 元(现行)
DEFAULT_CHILD_EDU_MONTHLY = Decimal("2000")
# 2. 3 岁以下婴幼儿照护:每孩每月 2000 元(现行)
DEFAULT_INFANT_MONTHLY = Decimal("2000")
# 3. 继续教育:学历教育每月 400 元(最长 48 个月);职业资格取得当年 3600 元定额
DEFAULT_CONTINUING_EDU_MONTHLY = Decimal("400")
DEFAULT_CONTINUING_EDU_MAX_MONTHS = 48
DEFAULT_OCCUPATIONAL_QUAL_LUMP = Decimal("3600")
# 4. 大病医疗:个人负担超 15000 元部分,在 80000 元限额内据实扣除
DEFAULT_MEDICAL_THRESHOLD = Decimal("15000")
DEFAULT_MEDICAL_ANNUAL_CAP = Decimal("80000")
# 5. 住房贷款利息:首套住房贷款每月 1000 元(最长 240 个月)
DEFAULT_HOUSING_LOAN_MONTHLY = Decimal("1000")
DEFAULT_HOUSING_LOAN_MAX_MONTHS = 240
# 6. 住房租金:按城市分档月定额
RENT_TIER_TOP = Decimal("1500")       # 直辖市/省会(首府)城市/计划单列市/国务院确定的其他城市
RENT_TIER_CITY_POP_GT_1M = Decimal("1100")  # 市辖区户籍人口 > 100 万
RENT_TIER_CITY_POP_LE_1M = Decimal("800")   # 市辖区户籍人口 ≤ 100 万
RENT_TIERS: dict[str, str] = {
    "top": "直辖市/省会(首府)城市/计划单列市/国务院确定的其他城市:月 1500 元",
    "city_pop_gt_1m": "市辖区户籍人口>100 万的城市:月 1100 元",
    "city_pop_le_1m": "市辖区户籍人口≤100 万的城市:月 800 元",
}
# 7. 赡养老人:独生子女每月 3000 元;非独生子女分摊每人不超 1500 元(合计不超 3000)
DEFAULT_ELDERLY_ONLY_MONTHLY = Decimal("3000")
DEFAULT_ELDERLY_CAP_TOTAL = Decimal("3000")
DEFAULT_ELDERLY_NON_ONLY_CAP = Decimal("1500")

DISCLAIMER: str = (
    "本工具输出为**草案**,仅用于内部核算与预扣辅助,须由纳税主体与具备执业资格的人员复核。"
    "专项附加扣除以主管税务机关核定为准;国家政策、扣除标准、分档口径可能调整,本工具内嵌的"
    "现行缺省值不构成政策承诺。本工具不代理任何对外申报、不写生产库、不联网,纯本地计算 + "
    "tmp/artifacts 产物落盘。"
)


SPECIAL_DEDUCTION_DESCRIPTION: str = (
    "个税七项专项附加扣除计算(财务部板块插件)。逐人产出七项明细 + 合计,合计可直接喂给"
    " ai_tax_filing/_iit_cumulative 的 special_deduction 字段。七项现行缺省标准:"
    "① 子女教育每孩每月 2000 元(父母各50%或一方100%,share 可配);"
    "② 3 岁以下婴幼儿照护每孩每月 2000 元(分摊同子女教育);"
    "③ 继续教育:学历教育每月 400 元(本人,最长48个月)/职业资格取得当年 3600 元定额;"
    "④ 大病医疗:医保目录范围内自付超 15000 元起付线部分,在 80000 元年度限额内据实扣除;"
    "⑤ 住房贷款利息:首套住房贷款每月 1000 元(最长240个月,夫妻选一方扣);"
    "⑥ 住房租金:按城市分档月定额(top=1500/city_pop_gt_1m=1100/city_pop_le_1m=800),"
    "与房贷利息不可同享(互斥校验);"
    "⑦ 赡养老人:独生子女每月 3000 元;非独生子女分摊每人不超 1500 元,合计不超 3000 元。"
    "employees 支持数组/JSON 字符串,简化形态只给若干字段其余按单项标准缺省。"
    "所有标准均可用 child_edu_monthly/infant_monthly/continuing_edu_monthly/medical_threshold/"
    "housing_loan_monthly/rent_tier/elderly_only_monthly 等参数覆盖。"
    "返回带 progress(phaseIndex/of/next)与逐人明细、互斥合规校验结果、HTML/JSON 扣除明细表"
    "产物路径与 disclaimer。以主管税务机关核定为准,政策可能调整,草案须复核。"
)


# ---------------------------------------------------------------------------
# 互斥 / 合规校验
# ---------------------------------------------------------------------------


def _validate_employee(name: str, emp: dict[str, Any], findings: list[dict[str, str]]) -> None:
    _housing_raw = emp.get("housing")
    housing = _housing_raw if isinstance(_housing_raw, dict) else {}
    has_loan = bool(housing.get("loan"))
    has_rent = bool(housing.get("rent_city") or housing.get("rent_tier"))

    if has_loan and has_rent:
        findings.append({
            "employee": name,
            "kind": "HOUSING_MUTEX",
            "message": (
                f"{name}: 住房贷款利息与住房租金不得同享(《个人所得税专项附加扣除操作办法》"
                "第十五条),请择一扣除。本工具本次仅按住房贷款利息计算,住房租金计 0。"
            ),
        })

    # 赡养老人
    _elderly_raw = emp.get("elderly")
    elderly = _elderly_raw if isinstance(_elderly_raw, dict) else {}
    if elderly:
        only = bool(elderly.get("only_child"))
        share = elderly.get("share")
        elder_count = elderly.get("elder_count") or elderly.get("count")
        if not only:
            # 非独生 share 超 1500 的点名已由 _calc_elderly 负责(它封顶并报
            # ELDERLY_NON_ONLY_OVER_CAP),此处不再重复 append,避免同一条发现出现两次。
            if elder_count is not None:
                try:
                    total_allocated = _money(elder_count, "elder_count") * Decimal("1500")
                except ValueError:
                    total_allocated = None
                if total_allocated is not None and total_allocated > Decimal("3000"):
                    findings.append({
                        "employee": name,
                        "kind": "ELDERLY_TOTAL_OVER_CAP",
                        "message": (
                            f"{name}: 赡养老人分摊合计不得超过 3000 元/月(非独生兄弟姊妹合计)。"
                            f"本次分摊合计 {total_allocated} 元/月已超限,请核减分摊比例。"
                        ),
                    })

    # 大病未超起付线
    medical = emp.get("medical") if isinstance(emp.get("medical"), dict) else {}
    if medical and medical.get("self_paid") is not None:
        try:
            sp = _money(medical.get("self_paid"), "medical.self_paid")
        except ValueError:
            sp = Decimal("0")
        if sp <= Decimal("15000"):
            findings.append({
                "employee": name,
                "kind": "MEDICAL_BELOW_THRESHOLD",
                "message": (
                    f"{name}: 医保目录范围内个人负担自付 {sp} 元未超过 15000 元起付线,"
                    "大病医疗本月扣除额按 0 处理。"
                ),
            })


# ---------------------------------------------------------------------------
# 七项逐项计算
# ---------------------------------------------------------------------------


def _calc_child_edu(emp: dict[str, Any], monthly: Decimal, index: int) -> tuple[Decimal, str, str]:
    """子女教育:每孩每月标准 × 该员工分摊比例,合计到本人。"""
    children = _ensure_list(emp.get("children"), f"employees[{index}].children")
    if not children:
        return Decimal("0"), "子女教育:无扣除(未申报子女)", ""
    total = Decimal("0")
    notes: list[str] = []
    for c_idx, child in enumerate(children):
        age = child.get("age")
        stage = str(child.get("stage") or "").strip()
        # 学前教育(满3岁至小学入学前)/学历教育(小学至博士)均适用;此处不细分会阶,按申报即可扣
        share = _share_of(child.get("share"), Decimal("0.5"))  # 缺省 50%
        per_child = (monthly * share).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total += per_child
        desc_bits = [f"子女{c_idx + 1}"]
        if age is not None:
            desc_bits.append(f"age={age}")
        if stage:
            desc_bits.append(stage)
        notes.append(f"{'/'.join(desc_bits)} share={share} ⇒ {per_child}/月")
    return total, f"子女教育(每孩每月 {monthly} 元 × 分摊比例)", "; ".join(notes)


def _calc_infant(emp: dict[str, Any], monthly: Decimal, index: int) -> tuple[Decimal, str, str]:
    """3 岁以下婴幼儿照护:每孩每月标准 × 分摊比例。"""
    infants = _ensure_list(emp.get("infants3") or emp.get("infants"), f"employees[{index}].infants3")
    if not infants:
        return Decimal("0"), "婴幼儿照护:无扣除(未申报 3 岁以下婴幼儿)", ""
    total = Decimal("0")
    notes: list[str] = []
    for c_idx, child in enumerate(infants):
        age = child.get("age")
        share = _share_of(child.get("share"), Decimal("0.5"))
        per_child = (monthly * share).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total += per_child
        notes.append(f"婴幼儿{c_idx + 1}(age={age if age is not None else '未填'}) share={share} ⇒ {per_child}/月")
    return total, f"3岁以下婴幼儿照护(每孩每月 {monthly} 元 × 分摊比例)", "; ".join(notes)


def _calc_continuing_edu(emp: dict[str, Any], monthly: Decimal, max_months: int,
                         lump: Decimal, index: int) -> tuple[Decimal, str, str]:
    """继续教育:学历教育按月,职业资格按取得当年定额。"""
    ce = emp.get("continuing_edu")
    if not isinstance(ce, dict):
        return Decimal("0"), "继续教育:无扣除(未申报)", ""
    kind = str(ce.get("type") or "academic").strip().lower()
    if kind in ("occupational", "professional", "职业资格", "职业资格取得"):
        amount = lump
        basis = f"职业资格继续教育取得当年定额 {lump} 元(年度)"
        note = f"type=occupational ⇒ 定额 {lump} 元计入本月(年度分摊 1 期)"
        # 定额 3600 计入一次;若按 12 个月均摊可由入参 override,此处默认本月一次性入账
        if ce.get("amortize_months") is not None:
            months = int(Decimal(str(ce.get("amortize_months"))))
            if months > 0:
                amount = (lump / Decimal(months)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                note = f"type=occupational, 分摊 {months} 个月 ⇒ {amount}/月"
        return amount, basis, note
    # 学历教育
    months_declared = ce.get("months")
    if months_declared is None:
        months = max_months
        note_basis = f"未填 months,按最长 {max_months} 个月口径"
    else:
        months = int(Decimal(str(months_declared)))
        if months <= 0:
            return Decimal("0"), "继续教育:months<=0,视为未申报", ""
        if months > max_months:
            note_basis = f"months={months} 超上限 {max_months},按 {max_months} 计"
            months = max_months
        else:
            note_basis = f"months={months}"
    amount = monthly
    return amount, f"学历继续教育每月 {monthly} 元({note_basis})", f"type=academic ⇒ {amount}/月"


def _calc_medical(emp: dict[str, Any], threshold: Decimal, annual_cap: Decimal,
                  index: int, findings: list[dict[str, str]]) -> tuple[Decimal, str, str]:
    """大病医疗:自付超起付线部分,在年度限额内据实扣除。"""
    med = emp.get("medical") if isinstance(emp.get("medical"), dict) else {}
    if not med or med.get("self_paid") is None:
        return Decimal("0"), "大病医疗:无扣除(未申报自付额)", ""
    self_paid = _money(med.get("self_paid"), f"employees[{index}].medical.self_paid")
    if self_paid <= threshold:
        return (
            Decimal("0"),
            f"大病医疗(自付 {self_paid} ≤ 起付线 {threshold} 元 ⇒ 扣除 0)",
            f"个人负担 {self_paid} 元未超起付线 {threshold} 元,本月扣除 0",
        )
    amount = (self_paid - threshold).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount > annual_cap:
        amount = annual_cap
        note = f"自付 {self_paid} - 起付线 {threshold} = {self_paid - threshold},触及年度限额 {annual_cap} 封顶 ⇒ {amount}"
    else:
        note = f"自付 {self_paid} - 起付线 {threshold} = {amount}(年度限额 {annual_cap} 内据实)"
    return amount, f"大病医疗(起付线 {threshold},年度限额 {annual_cap})", note


def _calc_housing(emp: dict[str, Any], loan_monthly: Decimal, loan_max_months: int,
                  index: int, findings: list[dict[str, str]]) -> tuple[Decimal, Decimal, str, str, str]:
    """住房贷款利息 / 住房租金,互斥。返回 (loan_amt, rent_amt, basis, note, item)。

    item ∈ {"loan", "rent"}:标明本月实际按哪一项扣除(互斥压制另一方为 0)。
    同享时按贷款计、租金置 0 并点名(HOUSING_MUTEX)。
    """
    housing = emp.get("housing") if isinstance(emp.get("housing"), dict) else {}
    if not housing:
        return (Decimal("0"), Decimal("0"),
                "住房贷款/租金:无扣除(未申报)", "", "none")
    has_loan = bool(housing.get("loan"))
    has_rent = bool(housing.get("rent_city") or housing.get("rent_tier"))

    if has_loan and has_rent:
        findings.append({
            "employee": emp.get("name") or f"员工{index + 1}",
            "kind": "HOUSING_MUTEX",
            "message": (
                f"{emp.get('name') or f'员工{index + 1}'}: 住房贷款利息与住房租金不得同享,"
                "本次仅按住房贷款利息计算,住房租金计 0。"
            ),
        })
        return (
            loan_monthly, Decimal("0"),
            f"住房贷款利息(首套,每月 {loan_monthly} 元,最长 {loan_max_months} 个月)",
            f"loan=true ⇒ {loan_monthly}/月;rent 被互斥规则压制为 0",
            "loan",
        )
    if has_loan:
        months_declared = housing.get("loan_months")
        basis = (
            f"住房贷款利息(首套,每月 {loan_monthly} 元,最长 {loan_max_months} 个月)"
        )
        if months_declared is not None:
            basis += f",已还 {months_declared} 个月"
        return (loan_monthly, Decimal("0"), basis,
                f"loan=true ⇒ {loan_monthly}/月", "loan")

    if has_rent:
        tier = str(housing.get("rent_tier") or "").strip().lower()
        city = str(housing.get("rent_city") or "").strip()
        if not tier:
            # 由 rent_city 推断分档(简单启发:直辖市/省会命中 top;否则默认 city_pop_gt_1m)
            top_cities = {"北京", "上海", "广州", "深圳", "天津", "重庆",
                          "成都", "杭州", "武汉", "西安", "南京", "苏州",
                          "郑州", "长沙", "合肥", "福州", "济南", "青岛",
                          "沈阳", "大连", "哈尔滨", "长春", "石家庄", "太原",
                          "呼和浩特", "南宁", "海口", "贵阳", "昆明", "拉萨",
                          "兰州", "西宁", "银川", "乌鲁木齐", "宁波", "厦门", "无锡"}
            tier = "top" if city in top_cities else "city_pop_gt_1m"
        if tier not in RENT_TIERS:
            raise ValueError(
                f"employees[{index}].housing.rent_tier 非法:{tier};"
                f"须为 {list(RENT_TIERS)} 其一"
            )
        amount = {
            "top": RENT_TIER_TOP,
            "city_pop_gt_1m": RENT_TIER_CITY_POP_GT_1M,
            "city_pop_le_1m": RENT_TIER_CITY_POP_LE_1M,
        }[tier]
        return (
            Decimal("0"), amount,
            f"住房租金({RENT_TIERS[tier]})",
            f"rent_city={city or '未填'}, rent_tier={tier} ⇒ {amount}/月",
            "rent",
        )
    return (Decimal("0"), Decimal("0"),
            "住房贷款/租金:无扣除(未申报)", "", "none")


def _calc_elderly(emp: dict[str, Any], only_monthly: Decimal, total_cap: Decimal,
                  non_only_cap: Decimal, index: int,
                  findings: list[dict[str, str]]) -> tuple[Decimal, str, str]:
    """赡养老人:独生 3000/月;非独生按分摊比例,每人不超 1500,合计不超 3000。"""
    _elderly_raw = emp.get("elderly")
    elderly = _elderly_raw if isinstance(_elderly_raw, dict) else {}
    if not elderly:
        return Decimal("0"), "赡养老人:无扣除(未申报)", ""
    only = bool(elderly.get("only_child"))
    if only:
        return (
            only_monthly,
            f"赡养老人(独生子女,每月 {only_monthly} 元)",
            f"only_child=true ⇒ {only_monthly}/月",
        )
    share_raw = elderly.get("share")
    if share_raw is not None:
        share = _share_of(share_raw, Decimal("0"))
        allocated = (Decimal("3000") * share).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if allocated > non_only_cap:
            name = emp.get("name") or f"员工{index + 1}"
            findings.append({
                "employee": name,
                "kind": "ELDERLY_NON_ONLY_OVER_CAP",
                "message": (
                    f"{name}: 非独生子女赡养分摊每人不得超过 {non_only_cap} 元/月,"
                    f"本次分摊比例 {share} 折算 {allocated} 元/月超限,按 {non_only_cap} 元封顶。"
                ),
            })
            allocated = non_only_cap
        return (
            allocated,
            f"赡养老人(非独生,合计 {total_cap} 元上限,每人分摊上限 {non_only_cap} 元)",
            f"share={share} ⇒ 分摊 {allocated}/月",
        )
    # 兄弟姊妹均摊形态:elder_count 人分摊 total_cap
    elder_count_raw = elderly.get("elder_count") or elderly.get("count")
    if elder_count_raw is not None:
        n = int(Decimal(str(elder_count_raw)))
        if n <= 0:
            return Decimal("0"), "赡养老人:elder_count 非法", ""
        total_allocated = (total_cap / Decimal(n)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if total_allocated > non_only_cap:
            name = emp.get("name") or f"员工{index + 1}"
            findings.append({
                "employee": name,
                "kind": "ELDERLY_NON_ONLY_OVER_CAP",
                "message": (
                    f"{name}: 非独生子女赡养分摊每人不得超过 {non_only_cap} 元/月,"
                    f"本次按 {n} 人均摊计算得 {total_allocated} 元/月超限,按 {non_only_cap} 元封顶。"
                ),
            })
            total_allocated = non_only_cap
        return (
            total_allocated,
            f"赡养老人(非独生,{n} 人均摊 {total_cap} 元,每人上限 {non_only_cap} 元)",
            f"elder_count={n} ⇒ 每人 {total_allocated}/月",
        )
    # 缺省:非独生但未给 share/elder_count,按兄弟姊妹均摊两人保守处理
    default_share = total_cap / Decimal("2")
    return (
        default_share,
        f"赡养老人(非独生,合计 {total_cap} 元上限,每人上限 {non_only_cap} 元)",
        "未填 share/elder_count,按两人均摊保守处理",
    )


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------


async def special_deduction_calc(arguments: Any) -> dict[str, Any]:
    """个税七项专项附加扣除逐人计算入口(async,与 finance_tools 同款)。"""
    if not isinstance(arguments, dict):
        return _fail("INVALID_ARGS", "arguments 必须为 dict")

    try:
        employees = _parse_employees(arguments.get("employees"))
        if not employees:
            return _fail("INVALID_INPUT", "employees 必须是非空数组")
        if len(employees) > _MAX_EMPLOYEES:
            return _fail("INVALID_INPUT", f"employees 数量超限(≤{_MAX_EMPLOYEES})")

        period = str(arguments.get("period") or datetime.now().strftime("%Y-%m")).strip()

        # 七项标准覆盖参数
        child_monthly = _money(
            arguments.get("child_edu_monthly") or DEFAULT_CHILD_EDU_MONTHLY,
            "child_edu_monthly",
        )
        infant_monthly = _money(
            arguments.get("infant_monthly") or DEFAULT_INFANT_MONTHLY,
            "infant_monthly",
        )
        continuing_monthly = _money(
            arguments.get("continuing_edu_monthly") or DEFAULT_CONTINUING_EDU_MONTHLY,
            "continuing_edu_monthly",
        )
        continuing_max_months = int(
            Decimal(str(arguments.get("continuing_edu_max_months")
                        or DEFAULT_CONTINUING_EDU_MAX_MONTHS))
        )
        occupational_lump = _money(
            arguments.get("occupational_qual_lump") or DEFAULT_OCCUPATIONAL_QUAL_LUMP,
            "occupational_qual_lump",
        )
        medical_threshold = _money(
            arguments.get("medical_threshold") or DEFAULT_MEDICAL_THRESHOLD,
            "medical_threshold",
        )
        medical_cap = _money(
            arguments.get("medical_annual_cap") or DEFAULT_MEDICAL_ANNUAL_CAP,
            "medical_annual_cap",
        )
        housing_loan_monthly = _money(
            arguments.get("housing_loan_monthly") or DEFAULT_HOUSING_LOAN_MONTHLY,
            "housing_loan_monthly",
        )
        housing_loan_max_months = int(
            Decimal(str(arguments.get("housing_loan_max_months")
                        or DEFAULT_HOUSING_LOAN_MAX_MONTHS))
        )
        elderly_only_monthly = _money(
            arguments.get("elderly_only_monthly") or DEFAULT_ELDERLY_ONLY_MONTHLY,
            "elderly_only_monthly",
        )
        elderly_total_cap = _money(
            arguments.get("elderly_total_cap") or DEFAULT_ELDERLY_CAP_TOTAL,
            "elderly_total_cap",
        )
        elderly_non_only_cap = _money(
            arguments.get("elderly_non_only_cap") or DEFAULT_ELDERLY_NON_ONLY_CAP,
            "elderly_non_only_cap",
        )
    except ValueError as exc:
        return _fail("INVALID_INPUT", str(exc))

    findings: list[dict[str, str]] = []
    rows: list[dict[str, Any]] = []
    total_all = Decimal("0")

    for idx, emp in enumerate(employees):
        if not isinstance(emp, dict):
            return _fail("INVALID_INPUT", f"employees[{idx}] 必须为 dict")
        name = str(emp.get("name") or f"员工{idx + 1}")[:200]
        try:
            child_amt, child_basis, child_note = _calc_child_edu(emp, child_monthly, idx)
            infant_amt, infant_basis, infant_note = _calc_infant(emp, infant_monthly, idx)
            ce_amt, ce_basis, ce_note = _calc_continuing_edu(
                emp, continuing_monthly, continuing_max_months, occupational_lump, idx
            )
            med_amt, med_basis, med_note = _calc_medical(
                emp, medical_threshold, medical_cap, idx, findings
            )
            housing_loan, housing_rent, housing_basis, housing_note, housing_item = _calc_housing(
                emp, housing_loan_monthly, housing_loan_max_months, idx, findings
            )
            elderly_amt, elderly_basis, elderly_note = _calc_elderly(
                emp, elderly_only_monthly, elderly_total_cap,
                elderly_non_only_cap, idx, findings,
            )
        except ValueError as exc:
            return _fail("INVALID_INPUT", f"employees[{idx}]({name}): {exc}")

        _validate_employee(name, emp, findings)

        items = [
            {"item": "子女教育", "monthly_amount": _q(child_amt), "basis": child_basis, "note": child_note},
            {"item": "3岁以下婴幼儿照护", "monthly_amount": _q(infant_amt), "basis": infant_basis, "note": infant_note},
            {"item": "继续教育", "monthly_amount": _q(ce_amt), "basis": ce_basis, "note": ce_note},
            {"item": "大病医疗", "monthly_amount": _q(med_amt), "basis": med_basis, "note": med_note},
            {"item": "住房贷款利息",
             "monthly_amount": _q(housing_loan) if housing_item == "loan" else _q(Decimal("0")),
             "basis": housing_basis if housing_item == "loan" else "与住房租金不可同享" if housing_item == "rent" else housing_basis,
             "note": housing_note if housing_item == "loan" else "房贷与租金互斥,本次按租金计" if housing_item == "rent" else housing_note},
            {"item": "住房租金",
             "monthly_amount": _q(housing_rent) if housing_item == "rent" else _q(Decimal("0")),
             "basis": housing_basis if housing_item == "rent" else "与住房贷款利息不可同享" if housing_item == "loan" else housing_basis,
             "note": housing_note if housing_item == "rent" else "房贷与租金互斥,本次按房贷计" if housing_item == "loan" else housing_note},
            {"item": "赡养老人", "monthly_amount": _q(elderly_amt), "basis": elderly_basis, "note": elderly_note},
        ]
        sub_total = (child_amt + infant_amt + ce_amt + med_amt
                     + housing_loan + housing_rent + elderly_amt)
        total_all += sub_total
        rows.append({
            "name": name,
            "items": items,
            "special_deduction_total": _q(sub_total),
        })

    # 进度块:四段(参数解析 → 逐人明细 → 互斥合规校验 → 产物落盘)
    phases = ("parse", "detail", "validate", "persist")
    progress = _progress("validate", 3, len(phases), "persist")

    # 产物落盘
    artifacts: dict[str, str] = {}
    try:
        out_dir = _resolve_output_dir(arguments.get("output_dir"))
        out_dir.mkdir(parents=True, exist_ok=True)
    except ValueError as exc:
        return _fail("INVALID_OUTPUT_DIR", str(exc))

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    safe_period = period.replace("/", "-").replace(":", "-")
    json_path = out_dir / f"special-deduction-{safe_period}-{stamp}.json"
    html_path = out_dir / f"special-deduction-{safe_period}-{stamp}.html"

    result_json: dict[str, Any] = {
        "period": period,
        "tool": _TOOL,
        "standards": {
            "child_edu_monthly": _q(child_monthly),
            "infant_monthly": _q(infant_monthly),
            "continuing_edu_monthly": _q(continuing_monthly),
            "continuing_edu_max_months": continuing_max_months,
            "occupational_qual_lump": _q(occupational_lump),
            "medical_threshold": _q(medical_threshold),
            "medical_annual_cap": _q(medical_cap),
            "housing_loan_monthly": _q(housing_loan_monthly),
            "housing_loan_max_months": housing_loan_max_months,
            "rent_tiers": {k: _q(v) for k, v in {
                "top": RENT_TIER_TOP,
                "city_pop_gt_1m": RENT_TIER_CITY_POP_GT_1M,
                "city_pop_le_1m": RENT_TIER_CITY_POP_LE_1M,
            }.items()},
            "elderly_only_monthly": _q(elderly_only_monthly),
            "elderly_total_cap": _q(elderly_total_cap),
            "elderly_non_only_cap": _q(elderly_non_only_cap),
        },
        "employees": rows,
        "total_special_deduction": _q(total_all),
        "compliance_findings": findings,
        "disclaimer": DISCLAIMER,
    }

    try:
        json_path.write_text(
            json.dumps(result_json, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        html_rows = []
        for r in rows:
            detail_rows = "".join(
                f"<tr><td>{item['item']}</td><td class='num'>{item['monthly_amount']}</td>"
                f"<td>{item['basis']}</td><td class='note'>{item['note']}</td></tr>"
                for item in r["items"]
            )
            html_rows.append(
                f"<section class='emp'><h3>{r['name']}"
                f"<span class='sum'>专项附加合计:{r['special_deduction_total']}</span></h3>"
                f"<table><thead><tr><th>项目</th><th>本月扣除(元)</th><th>依据</th>"
                f"<th>分摊说明</th></tr></thead><tbody>{detail_rows}</tbody></table></section>"
            )
        findings_html = "".join(
            f"<li><b>{f['employee']}</b> · {f['kind']}:{f['message']}</li>"
            for f in findings
        ) or "<li>无异常</li>"
        html = f"""<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<title>专项附加扣除明细 {period}</title>
<style>
body{{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;margin:24px;color:#222}}
h1{{font-size:20px}} h3{{font-size:16px;margin-top:24px}}
table{{border-collapse:collapse;width:100%;margin-top:8px}}
th,td{{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:13px}}
td.num{{text-align:right;font-variant-numeric:tabular-nums}}
td.note{{color:#555;font-size:12px}}
.sum{{float:right;font-weight:normal;font-size:13px;color:#0a7}}
.findings{{margin-top:24px;padding:12px;background:#fff7e6;border:1px solid #ffe58f}}
.disclaimer{{margin-top:24px;color:#777;font-size:12px;border-top:1px solid #eee;padding-top:12px}}
</style></head><body>
<h1>个税七项专项附加扣除明细 · {period}</h1>
<p>合计:{_q(total_all)} 元/月 · 员工数:{len(rows)}</p>
{''.join(html_rows)}
<h3>互斥 / 合规校验</h3>
<ul class="findings">{findings_html}</ul>
<div class="disclaimer">{DISCLAIMER}</div>
</body></html>"""
        html_path.write_text(html, encoding="utf-8")
    except OSError as exc:
        return _fail("WRITE_FAILED", f"产物写盘失败:{exc}")

    artifacts["json"] = str(json_path.relative_to(_PROJECT_ROOT))
    artifacts["html"] = str(html_path.relative_to(_PROJECT_ROOT))

    return {
        "tool": _TOOL,
        "ok": True,
        "period": period,
        "progress": progress,
        "phases": list(phases),
        "standards": result_json["standards"],
        "employees": rows,
        "total_special_deduction": _q(total_all),
        "compliance_findings": findings,
        "artifacts": artifacts,
        "disclaimer": DISCLAIMER,
    }


__all__ = [
    "SPECIAL_DEDUCTION_DESCRIPTION",
    "special_deduction_calc",
    "DISCLAIMER",
    "DEFAULT_CHILD_EDU_MONTHLY",
    "DEFAULT_INFANT_MONTHLY",
    "DEFAULT_CONTINUING_EDU_MONTHLY",
    "DEFAULT_OCCUPATIONAL_QUAL_LUMP",
    "DEFAULT_MEDICAL_THRESHOLD",
    "DEFAULT_MEDICAL_ANNUAL_CAP",
    "DEFAULT_HOUSING_LOAN_MONTHLY",
    "RENT_TIER_TOP",
    "RENT_TIER_CITY_POP_GT_1M",
    "RENT_TIER_CITY_POP_LE_1M",
    "DEFAULT_ELDERLY_ONLY_MONTHLY",
    "DEFAULT_ELDERLY_NON_ONLY_CAP",
    "DEFAULT_ELDERLY_CAP_TOTAL",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
