# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""财务部「AI 一键报账报销」插件工具(2026-11-13 立)。

与同目录 finance_tools.py 的 ai_bookkeeping / ai_tax_filing 同构、同风格、同纪律。
覆盖面:企业费用报销单的 **合规判定 + 个税口径归类 + 增值税进项抵扣判定 + 会计分录草案**,
覆盖 差旅(交通/住宿/餐饮,含住宿限额)、业务招待费(60%/0.5% 孰低)、职工教育经费(8%)、
职工福利费(14%)、办公费、其他 六类费用。

计算纪律(与 finance_tools 一字同源):
- 全部金额走 Decimal(字符串入、字符串出),杜绝浮点误差进账表;
- 不平衡绝不配平(VOUCHER_UNBALANCED 同款):借贷差异显式点名,绝不静默塞科目凑平;
- 外部政策数字(住宿限额 / 招待 60%·0.5% / 教育 8% / 福利 14% / 进项税率)**全部为
  可覆盖缺省参数**,schema 与输出双处可见,以主管税务机关核定为准;
- 输出恒带 progress 块(phase / phaseIndex / of / next);
- 失败返回结构化 {ok:false, errorCode, message},不抛异常。

红线(输出内如实声明):产物为"报销单草案",真实报账须财务主管 / 执业资格人员复核;
本工具不代理任何对外报送、不写生产库、不联网(纯计算 + tmp/artifacts 产物,与
generate_report / finance_tools 同档 ⇒ 不入 _ADMIN_ONLY_TOOLS)。

安全:output_dir 必须落在项目根内(finance_tools 同一条校验);输入规模上限防膨胀。
"""

from __future__ import annotations

import html
import json
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 项目根与产物目录:与 finance_tools / chart_tools / report_tools 同构
# (app/tools -> app -> ai-service -> apps -> 仓根)
_PROJECT_ROOT = Path(__file__).resolve().parents[4]
_DEFAULT_OUTPUT_DIR = _PROJECT_ROOT / "tmp" / "artifacts"

# 输入规模上限(抄 finance_tools._MAX_TXN 同款)
_MAX_REIMBURSEMENTS = 500
_MAX_TEXT_LEN = 300

_TOOL = "ai_reimbursement"

# ---------------------------------------------------------------------------
# 通用小件:金额解析 / 结构化失败 / 进度块(抄 finance_tools 同款)
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
    return value


def _q(value: Decimal | int) -> str:
    """金额出参:保留两位(分),字符串形态跨端无损(int 兜 sum 空序列的 0)。"""
    return str(Decimal(value).quantize(Decimal("0.01")))


def _rate(raw: Any, default: Decimal, where: str) -> Decimal:
    if raw is None:
        return default
    value = _money(raw, where)
    if value < 0 or value > 1:
        raise ValueError(f"{where}: 税率必须是 0..1 之间的小数(如 0.06)")
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


# ---------------------------------------------------------------------------
# 缺省政策参数(全部可覆盖,以主管税务机关核定为准)
# ---------------------------------------------------------------------------

#: 住宿限额(元 / 人·晚),按城市档分四档;可由 arguments["lodging_limits"] 整体覆盖
DEFAULT_LODGING_LIMITS: dict[str, str] = {
    "一线": "600.00",
    "新一线": "500.00",
    "二线": "400.00",
    "三线及以下": "300.00",
}

#: 业务招待费扣除限额:发生额 × 60% 与 营业收入 × 0.5% 孰低
DEFAULT_ENTERTAIN_INCUR_RATIO = Decimal("0.60")
DEFAULT_ENTERTAIN_REVENUE_RATIO = Decimal("0.005")

#: 职工教育经费扣除限额:工资薪金总额 × 8%
DEFAULT_EDU_RATIO = Decimal("0.08")

#: 职工福利费扣除限额:工资薪金总额 × 14%
DEFAULT_WELFARE_RATIO = Decimal("0.14")

#: 差旅餐饮的定额补助口径(元 / 天,超出部分并入工资薪金计个税)
DEFAULT_MEAL_ALLOWANCE_PER_DAY = Decimal("100.00")

#: 差旅费包干补助的每日限额(元 / 天,无票实报;超出部分并入工资薪金计个税)。
#: 可由 arguments["per_diem_daily_limit"] 覆盖,以企业差旅制度 / 主管税务机关核定为准。
DEFAULT_PER_DIEM_DAILY_LIMIT = Decimal("100.00")

#: 费用类别枚举(与 mcp_server 注册处的 schema 保持单一真相源)
CATEGORIES: tuple[str, ...] = (
    "travel_transport",  # 差旅-交通
    "travel_lodging",  # 差旅-住宿
    "travel_meal",  # 差旅-餐饮
    "travel_per_diem",  # 差旅费包干补助(无票,按每日限额校验)
    "conference",  # 会议费
    "entertainment",  # 业务招待费
    "education",  # 职工教育经费
    "welfare",  # 职工福利费
    "office",  # 办公费
    "other",  # 其他
)

#: 发票类型枚举
INVOICE_TYPES: tuple[str, ...] = (
    "special",  # 增值税专用发票
    "general",  # 增值税普通发票
    "e_general",  # 电子普通发票
    "none",  # 无票
)

#: 城市档枚举(住宿限额分四档:一线 / 新一线 / 二线 / 三线及以下)
CITY_TIERS: tuple[str, ...] = ("一线", "新一线", "二线", "三线及以下")

#: 类别 ⇒ (会计科目, 是否默认可抵进项)
CATEGORY_ACCOUNT: dict[str, str] = {
    "travel_transport": "管理费用-差旅费",
    "travel_lodging": "管理费用-差旅费",
    "travel_meal": "管理费用-差旅费",
    # 差旅费包干补助:无票实报,缺省仍归差旅费科目(限额校验在合规层单独点名)
    "travel_per_diem": "管理费用-差旅费",
    "conference": "管理费用-会议费",
    "entertainment": "管理费用-业务招待费",
    "education": "管理费用-职工教育经费",
    "welfare": "管理费用-职工福利费",
    "office": "管理费用-办公费",
    "other": "管理费用-其他",
}

#: 招待费/餐饮/福利:多数情形进项不得抵扣(税法口径的简化判定,草案性)
_NON_DEDUCTIBLE_CATEGORIES: tuple[str, ...] = ("entertainment", "travel_meal", "welfare")

_DISCLAIMER = (
    "【红线声明】本工具产物为「报销单草案」,仅供内部复核参考;真实报账须财务主管 / "
    "执业资格人员复核签字,本系统不代理任何对外报送。住宿限额 / 招待费 60%·0.5% / "
    "职工教育经费 8% / 职工福利费 14% / 增值税进项税率等政策数字均为可覆盖的缺省参数,"
    "**以主管税务机关核定为准**。"
)

# ---------------------------------------------------------------------------
# 输入解析
# ---------------------------------------------------------------------------


def _normalize_reimbursements(raw: Any) -> list[dict[str, Any]]:
    """兼容:① 直接传数组;② JSON 字符串(finance_tools 的容忍口径)。"""
    if raw is None:
        return []
    if isinstance(raw, str) and raw.strip():
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"reimbursements 必须是合法 JSON: {exc}") from None
    if not isinstance(raw, list):
        raise ValueError("reimbursements 必须是数组或其 JSON 字符串")
    if len(raw) > _MAX_REIMBURSEMENTS:
        raise ValueError(
            f"reimbursements 条数 {len(raw)} 超上限 {_MAX_REIMBURSEMENTS}"
        )
    out: list[dict[str, Any]] = []
    for idx, item in enumerate(raw):
        if not isinstance(item, dict):
            raise ValueError(f"reimbursements[{idx}] 必须是对象")
        category = str(item.get("category") or "").strip().lower()
        if category not in CATEGORIES:
            raise ValueError(
                f"reimbursements[{idx}].category 必须是 {list(CATEGORIES)} 其一,收到 {category!r}"
            )
        invoice_type_raw = str(item.get("invoice_type") or "none").strip().lower()
        if invoice_type_raw not in INVOICE_TYPES:
            raise ValueError(
                f"reimbursements[{idx}].invoice_type 必须是 {list(INVOICE_TYPES)} 其一"
            )
        # 差旅费包干补助:制度上无票实报,强制走 none(即便误传 special/general 也压回 none)
        if category == "travel_per_diem":
            invoice_type = "none"
        else:
            invoice_type = invoice_type_raw
        amount = _money(item.get("amount"), f"reimbursements[{idx}].amount")
        vat_rate_raw = item.get("vat_rate")
        vat_rate = (
            _rate(vat_rate_raw, Decimal("0.06"), f"reimbursements[{idx}].vat_rate")
            if vat_rate_raw is not None
            else None
        )
        employee = str(item.get("employee") or "").strip()[:_MAX_TEXT_LEN]
        date = str(item.get("date") or "").strip()[:_MAX_TEXT_LEN]
        description = str(item.get("description") or "").strip()[:_MAX_TEXT_LEN]
        city_tier = str(item.get("city_tier") or "").strip()
        # 住宿城市档:仅住宿费按此选限额;缺省在合规层回落 "一线"(最保守)
        lodging_city_tier = str(item.get("lodging_city_tier") or "").strip()
        nights_raw = item.get("nights")
        nights = (
            _money(nights_raw, f"reimbursements[{idx}].nights")
            if nights_raw is not None
            else None
        )
        out.append(
            {
                "employee": employee,
                "category": category,
                "amount": amount,
                "date": date,
                "invoice_type": invoice_type,
                "description": description,
                "vat_rate": vat_rate,
                "city_tier": city_tier,
                "lodging_city_tier": lodging_city_tier,
                "nights": nights,
            }
        )
    return out


# ---------------------------------------------------------------------------
# 单条判定:进项抵扣 / 个税口径 / 合规校验
# ---------------------------------------------------------------------------


def _judge_vat(item: dict[str, Any]) -> dict[str, Any]:
    """增值税进项抵扣判定:专票可抵;普票/电子普票多数不可抵(招待/餐饮/福利硬性禁抵);
    无票不可抵且提示补票。"""
    category = item["category"]
    invoice_type = item["invoice_type"]
    amount = item["amount"]
    vat_rate = item["vat_rate"] or Decimal("0.06")
    result: dict[str, Any] = {
        "invoiceType": invoice_type,
        "deductible": False,
        "inputVat": "0.00",
        "netAmount": _q(amount),
        "reason": "",
        "advice": "",
    }
    if invoice_type == "none":
        if category == "travel_per_diem":
            # 差旅费包干补助制度上无票,属设计口径,不提示"补票"
            result["reason"] = (
                "差旅费包干补助按制度无票实报,增值税进项不可抵扣"
            )
            result["advice"] = (
                "如需进项抵扣,应改按实票报销(取得增值税专用发票的住宿/交通费)"
            )
            return result
        result["reason"] = "无发票,增值税进项不可抵扣"
        result["advice"] = "请尽快补票:向对方索取增值税发票(优先专用发票)"
        return result
    if category in _NON_DEDUCTIBLE_CATEGORIES:
        result["reason"] = (
            f"费用类别 {category}(业务招待/差旅餐饮/职工福利)多数情形进项不得抵扣"
        )
        result["advice"] = "以主管税务机关核定为准;如属例外情形请留存政策依据备查"
        return result
    if invoice_type in ("general", "e_general"):
        result["reason"] = (
            "普通发票 / 电子普通发票,多数情形进项不可抵扣"
            "(仅部分如国内旅客运输、农产品收购等例外可计算抵扣)"
        )
        result["advice"] = "如属例外情形(如国内旅客运输),请按政策口径计算抵扣并留存凭证"
        return result
    # special:按 vat_rate 拆价税
    net = (amount / (Decimal(1) + vat_rate)).quantize(Decimal("0.01"))
    tax = amount - net
    result["deductible"] = True
    result["inputVat"] = _q(tax)
    result["netAmount"] = _q(net)
    result["reason"] = f"专用发票,按税率 {_rate_text(vat_rate)} 计算进项税额"
    result["advice"] = "请核对专票认证状态(勾选确认)后再计入当期进项"
    return result


def _rate_text(rate: Decimal) -> str:
    value = (rate * 100).normalize()
    text = format(value, "f")
    return f"{text}%"


def _judge_income_tax(item: dict[str, Any]) -> dict[str, Any]:
    """个税口径:差旅定额补助以内的部分不征个税;超出定额部分与福利费超标部分
    原则上并入「工资、薪金所得」计个税。"""
    category = item["category"]
    amount = item["amount"]
    out: dict[str, Any] = {
        "includeInSalary": False,
        "amountIncluded": "0.00",
        "reason": "",
    }
    if category in ("travel_transport", "travel_lodging"):
        out["reason"] = (
            "凭票实报实销的差旅交通/住宿费,属经营费用,不并入工资薪金,不征个税"
        )
        return out
    if category == "travel_meal":
        # 以缺省定额补助为参考线;超定额部分并入工资薪金
        allowance = DEFAULT_MEAL_ALLOWANCE_PER_DAY
        nights = item.get("nights") or Decimal("1")
        cap = (allowance * nights).quantize(Decimal("0.01"))
        if amount > cap:
            out["includeInSalary"] = True
            out["amountIncluded"] = _q(amount - cap)
            out["reason"] = (
                f"差旅餐饮超出定额补助(缺省 {_q(allowance)}/天 × {_q(nights)} 天 = "
                f"{_q(cap)}){_q(amount - cap)} 元,超出部分建议并入工资薪金计个税"
            )
        else:
            out["reason"] = (
                f"差旅餐饮在定额补助(缺省 {_q(allowance)}/天 × {_q(nights)} 天 = "
                f"{_q(cap)})以内,可不并入工资薪金"
            )
        return out
    if category == "travel_per_diem":
        # 差旅费包干补助:标准内(每日限额 × 反推天数)免征个税,超出部分并入工资薪金
        _per_diem_cap = item.get("_per_diem_cap")
        if _per_diem_cap is None:
            # 单条直接调用(未走合规层回填)时按缺省限额 × 1 天兜底
            cap = DEFAULT_PER_DIEM_DAILY_LIMIT
        else:
            cap = Decimal(_per_diem_cap)
        if amount > cap:
            out["includeInSalary"] = True
            out["amountIncluded"] = _q(amount - cap)
            out["reason"] = (
                f"差旅费包干补助超出标准限额 {_q(cap)} 元,"
                f"超出部分 {_q(amount - cap)} 元并入工资薪金计个税"
            )
        else:
            out["reason"] = (
                f"标准内差旅费包干,免征个税(限额 {_q(cap)} 元)"
            )
        return out
    if category == "conference":
        out["reason"] = (
            "会议费属企业经营支出,凭真实合规凭证(会议通知/签到表/场地发票等)据实扣除,"
            "无特殊税前扣除限额,不并入个人工资薪金"
        )
        return out
    if category == "welfare":
        # 福利费超标部分并账:单条不作判定,由限额校验在汇总层点名
        out["reason"] = (
            "职工福利费超过工资薪金总额 14% 的部分,年度汇算时不得税前扣除;"
            "如以现金/实物发放给个人,建议并入工资薪金计个税(具体以政策口径为准)"
        )
        return out
    if category == "entertainment":
        out["reason"] = (
            "业务招待费属企业经营支出,不直接并入个人工资薪金;"
            "如以现金/实物发放给个人,建议并入工资薪金计个税"
        )
        return out
    if category == "education":
        out["reason"] = (
            "职工教育经费用于职工培训支出,不并入个人工资薪金;"
            "如以现金发放个人教育培训补贴,建议并入工资薪金计个税"
        )
        return out
    out["reason"] = "办公费/其他:凭票实报实销,不并入工资薪金"
    return out


def _lodging_limit_for(
    item: dict[str, Any], lodging_limits: dict[str, Decimal]
) -> tuple[Decimal | None, str]:
    """住宿限额:按条目的住宿城市档选限额。

    选档顺序:条目级 lodging_city_tier(住宿城市档,可选)→ 条目级 city_tier(全局回填)→
    缺省 "一线"(最保守口径);查不到对应档时返回 (None, "")。
    返回 (限额, 命中的城市档名),便于合规校验在 warning 里点名用了哪一档。
    """
    tier = (
        str(item.get("lodging_city_tier") or "").strip()
        or str(item.get("city_tier") or "").strip()
        or "一线"
    )
    if tier in lodging_limits:
        return lodging_limits[tier], tier
    return None, ""


def _parse_period_month(period: str) -> tuple[int, int] | None:
    """把 "2026-11" / "2026-11-30" 形态的核算期间解析为 (年, 月);解析不出返回 None(不校验)。"""
    text = (period or "").strip()
    if not text:
        return None
    head = text.split("-")
    if len(head) < 2:
        return None
    try:
        year = int(head[0])
        month = int(head[1])
    except ValueError:
        return None
    if not (1 <= month <= 12):
        return None
    return year, month


def _parse_date_month(date: str) -> tuple[int, int] | None:
    """把 "2026-11-05" 形态的报销日期解析为 (年, 月);解析不出返回 None(不校验)。"""
    text = (date or "").strip()
    if not text:
        return None
    head = text.split("-")
    if len(head) < 2:
        return None
    try:
        year = int(head[0])
        month = int(head[1])
    except ValueError:
        return None
    if not (1 <= month <= 12):
        return None
    return year, month


def _check_compliance(
    item: dict[str, Any],
    lodging_limits: dict[str, Decimal],
    period: str = "",
    per_diem_daily_limit: Decimal = DEFAULT_PER_DIEM_DAILY_LIMIT,
) -> list[dict[str, Any]]:
    """合规校验:缺票 / 负零金额 / 住宿超限额 / 差旅包干超每日限额 / 跨期费用。"""
    issues: list[dict[str, Any]] = []
    amount = item["amount"]
    idx_hint = f"{item.get('employee') or '(未填员工)'} · {item['category']} · {item['date']}"
    # 差旅费包干补助按制度无票实报,不属"缺票"问题,跳过 MISSING_INVOICE
    if item["invoice_type"] == "none" and item["category"] != "travel_per_diem":
        issues.append(
            {
                "severity": "error",
                "code": "MISSING_INVOICE",
                "message": f"{idx_hint}:缺票(无发票),请补票后再报销",
            }
        )
    if amount <= 0:
        issues.append(
            {
                "severity": "error",
                "code": "NON_POSITIVE_AMOUNT",
                "message": f"{idx_hint}:金额 {_q(amount)} 非正数,拒绝入账",
            }
        )
    if item["category"] == "travel_lodging":
        limit, tier_used = _lodging_limit_for(item, lodging_limits)
        if limit is not None:
            nights = item.get("nights") or Decimal("1")
            cap = (limit * nights).quantize(Decimal("0.01"))
            if amount > cap:
                over = amount - cap
                issues.append(
                    {
                        "severity": "warning",
                        "code": "LODGING_OVER_LIMIT",
                        "message": (
                            f"{idx_hint}:住宿费 {_q(amount)} 超限额 "
                            f"[{tier_used}] {_q(limit)}/晚 × {_q(nights)} 晚 = {_q(cap)},"
                            f"超出 {_q(over)} 元"
                        ),
                        "overAmount": _q(over),
                        "limitPerNight": _q(limit),
                        "nights": _q(nights),
                        "cap": _q(cap),
                        "cityTier": tier_used,
                    }
                )
    # 差旅费包干补助:按 amount ÷ 每日限额 反推天数,超每日限额点 warning,
    # 并把限额 cap 回填进 item,供 _judge_income_tax 判个税口径复用
    if item["category"] == "travel_per_diem" and per_diem_daily_limit > 0:
        # 反推天数 = amount / per_diem_daily_limit(向上取整到两位小数,不丢超限的零头)
        days = (amount / per_diem_daily_limit).quantize(Decimal("0.01"))
        cap = (per_diem_daily_limit * days).quantize(Decimal("0.01"))
        item["_per_diem_cap"] = cap
        if amount > cap:
            over = amount - cap
            issues.append(
                {
                    "severity": "warning",
                    "code": "PER_DIEM_OVER_LIMIT",
                    "message": (
                        f"{idx_hint}:差旅费包干补助 {_q(amount)} 元,按缺省限额 "
                        f"{_q(per_diem_daily_limit)}/天 反推 {_q(days)} 天 ⇒ 标准 "
                        f"{_q(cap)} 元,超出 {_q(over)} 元;超出部分应并入工资薪金计个税"
                    ),
                    "overAmount": _q(over),
                    "limitPerDay": _q(per_diem_daily_limit),
                    "days": _q(days),
                    "cap": _q(cap),
                }
            )
    # 跨期费用:报销日期与核算期间不同月 ⇒ warning(period 缺省不校验)
    period_month = _parse_period_month(period)
    date_month = _parse_date_month(item.get("date") or "")
    if period_month is not None and date_month is not None and period_month != date_month:
        issues.append(
            {
                "severity": "warning",
                "code": "CROSS_PERIOD_EXPENSE",
                "message": (
                    f"{idx_hint}:报销日期 {date_month[0]}年{date_month[1]}月 "
                    f"与核算期间 {period_month[0]}年{period_month[1]}月 不一致,"
                    f"属跨期费用,需在汇算清缴时确认归属期"
                ),
                "expenseYear": date_month[0],
                "expenseMonth": date_month[1],
                "periodYear": period_month[0],
                "periodMonth": period_month[1],
            }
        )
    return issues


# ---------------------------------------------------------------------------
# 汇总:招待/教育/福利 扣除限额
# ---------------------------------------------------------------------------


def _check_period_limits(
    reimbursements: list[dict[str, Any]],
    revenue: Decimal | None,
    wage_total: Decimal | None,
    entertain_incur_ratio: Decimal,
    entertain_revenue_ratio: Decimal,
    edu_ratio: Decimal,
    welfare_ratio: Decimal,
) -> list[dict[str, Any]]:
    """期间级扣除限额校验:业务招待费 60%/0.5% 孰低、教育经费 8%、福利费 14%。"""
    issues: list[dict[str, Any]] = []

    def _sum(cat: str) -> Decimal:
        return sum(
            (r["amount"] for r in reimbursements if r["category"] == cat),
            Decimal("0"),
        )

    if reimbursements:
        ent_total = _sum("entertainment")
        if ent_total > 0:
            if revenue is not None:
                cap_incur = (ent_total * entertain_incur_ratio).quantize(Decimal("0.01"))
                cap_revenue = (revenue * entertain_revenue_ratio).quantize(
                    Decimal("0.01")
                )
                cap = min(cap_incur, cap_revenue)
                basis = "孰低"
            else:
                cap = (ent_total * entertain_incur_ratio).quantize(Decimal("0.01"))
                cap_revenue = None
                basis = "仅按 60%(营业收入未提供)"
            if ent_total > cap:
                issues.append(
                    {
                        "severity": "warning",
                        "code": "ENTERTAINMENT_OVER_LIMIT",
                        "message": (
                            f"业务招待费发生额 {_q(ent_total)} 超扣除限额 "
                            f"(60%={_q(ent_total * entertain_incur_ratio)}"
                            + (
                                f" vs 0.5%×收入={_q(cap_revenue)} {basis}"
                                if cap_revenue is not None
                                else basis
                            )
                            + f" ⇒ 限额 {_q(cap)}),超出 {_q(ent_total - cap)} 元"
                        ),
                        "total": _q(ent_total),
                        "cap": _q(cap),
                        "overAmount": _q(ent_total - cap),
                        "capIncur": _q(ent_total * entertain_incur_ratio),
                        "capRevenue": _q(cap_revenue) if cap_revenue is not None else None,
                    }
                )
        edu_total = _sum("education")
        if edu_total > 0:
            if wage_total is not None:
                cap = (wage_total * edu_ratio).quantize(Decimal("0.01"))
                if edu_total > cap:
                    issues.append(
                        {
                            "severity": "warning",
                            "code": "EDUCATION_OVER_LIMIT",
                            "message": (
                                f"职工教育经费 {_q(edu_total)} 超扣除限额 "
                                f"(工资薪金 {_q(wage_total)} × {int(edu_ratio * 100)}% "
                                f"⇒ 限额 {_q(cap)}),超出 {_q(edu_total - cap)} 元"
                            ),
                            "total": _q(edu_total),
                            "cap": _q(cap),
                            "overAmount": _q(edu_total - cap),
                        }
                    )
            else:
                issues.append(
                    {
                        "severity": "info",
                        "code": "EDUCATION_WAGE_MISSING",
                        "message": "未提供 wage_total,职工教育经费 8% 限额无法校验",
                    }
                )
        welfare_total = _sum("welfare")
        if welfare_total > 0:
            if wage_total is not None:
                cap = (wage_total * welfare_ratio).quantize(Decimal("0.01"))
                if welfare_total > cap:
                    issues.append(
                        {
                            "severity": "warning",
                            "code": "WELFARE_OVER_LIMIT",
                            "message": (
                                f"职工福利费 {_q(welfare_total)} 超扣除限额 "
                                f"(工资薪金 {_q(wage_total)} × {int(welfare_ratio * 100)}% "
                                f"⇒ 限额 {_q(cap)}),超出 {_q(welfare_total - cap)} 元"
                            ),
                            "total": _q(welfare_total),
                            "cap": _q(cap),
                            "overAmount": _q(welfare_total - cap),
                        }
                    )
            else:
                issues.append(
                    {
                        "severity": "info",
                        "code": "WELFARE_WAGE_MISSING",
                        "message": "未提供 wage_total,职工福利费 14% 限额无法校验",
                    }
                )
    return issues


def _detect_duplicates(reimbursements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """疑似重复报销:同员工 + 同金额 + 同日期。"""
    seen: dict[tuple[str, str, str], int] = {}
    dups: list[dict[str, Any]] = []
    for idx, item in enumerate(reimbursements):
        key = (item["employee"], _q(item["amount"]), item["date"])
        if key in seen:
            dups.append(
                {
                    "severity": "error",
                    "code": "SUSPECTED_DUPLICATE",
                    "message": (
                        f"疑似重复报销:员工 {item['employee']} 在 {item['date']} "
                        f"同金额 {_q(item['amount'])} 出现多次"
                        f"(条目 #{seen[key] + 1} 与 #{idx + 1})"
                    ),
                    "firstIndex": seen[key],
                    "dupIndex": idx,
                }
            )
        else:
            seen[key] = idx
    return dups


# ---------------------------------------------------------------------------
# 分录草案(借贷必平,不平显式报差异)
# ---------------------------------------------------------------------------


def _build_entries(
    reimbursements: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """按类别聚合 → 分录草案。资金来源缺省银行存款(可由 arguments['fund_source'] 覆盖)。
    借贷必须平衡,不平显式点名差异(V OUCHER_UNBALANCED 纪律)。"""
    entries: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    groups: dict[str, list[dict[str, Any]]] = {}
    for item in reimbursements:
        groups.setdefault(item["category"], []).append(item)
    for seq, (category, items) in enumerate(groups.items(), start=1):
        gross = sum((i["amount"] for i in items), Decimal("0"))
        input_vat = Decimal("0")
        for item in items:
            vat = _judge_vat(item)
            if vat["deductible"]:
                input_vat += Decimal(vat["inputVat"])
        net = gross - input_vat
        account = CATEGORY_ACCOUNT[category]
        # 资金来源:缺省银行存款,条目级 fund_source 字段可覆盖
        fund = str(items[0].get("fund_source") or "银行存款")
        lines = [
            {"account": account, "dc": "debit", "amount": _q(net)},
        ]
        if input_vat > 0:
            lines.append(
                {
                    "account": "应交税费-应交增值税(进项税额)",
                    "dc": "debit",
                    "amount": _q(input_vat),
                }
            )
        lines.append({"account": fund, "dc": "credit", "amount": _q(gross)})
        total_d = sum(
            (Decimal(l["amount"]) for l in lines if l["dc"] == "debit"), Decimal("0")
        )
        total_c = sum(
            (Decimal(l["amount"]) for l in lines if l["dc"] == "credit"), Decimal("0")
        )
        balanced = total_d == total_c
        entry: dict[str, Any] = {
            "voucherNo": f"记-{seq:04d}",
            "date": items[0]["date"],
            "summary": f"{category} 报销({len(items)} 笔)",
            "lines": lines,
            "debitTotal": _q(total_d),
            "creditTotal": _q(total_c),
            "balanced": balanced,
        }
        if not balanced:
            diff = total_d - total_c
            entry["difference"] = _q(diff)
            warnings.append(
                {
                    "severity": "error",
                    "code": "VOUCHER_UNBALANCED",
                    "message": (
                        f"{entry['voucherNo']} 借贷不平:借方合计 {_q(total_d)} "
                        f"贷方合计 {_q(total_c)},差异 {_q(diff)} 元 —— **绝不配平**,请人工复核"
                    ),
                }
            )
        entries.append(entry)
    return entries, warnings


# ---------------------------------------------------------------------------
# 增值税进项税额转出(独立可选能力)
# 已认证抵扣的进项,后因用途改变(集体福利 / 个人消费 / 非应税项目 / 非正常损失)
# 需把原抵扣的进项税额冲回 —— 做成纯计算能力 + ai_reimbursement 可选入参双形态。
# ---------------------------------------------------------------------------

#: 转出原因枚举(缺省集体福利)
TRANSFER_OUT_REASONS: tuple[str, ...] = (
    "collective_welfare",   # 集体福利
    "personal_consumption",  # 个人消费
    "non_taxable",           # 非应税项目
    "abnormal_loss",         # 非正常损失
)

#: 转出原因 ⇒ 中文标签(输出可读)
TRANSFER_OUT_REASON_LABELS: dict[str, str] = {
    "collective_welfare": "集体福利",
    "personal_consumption": "个人消费",
    "non_taxable": "非应税项目",
    "abnormal_loss": "非正常损失",
}

#: 转出原因 ⇒ 借方科目(集体福利 → 应付职工薪酬;个人消费 / 其他 → 管理费用)
TRANSFER_OUT_DEBIT_ACCOUNTS: dict[str, str] = {
    "collective_welfare": "应付职工薪酬-集体福利",
    "personal_consumption": "管理费用",
    "non_taxable": "管理费用",
    "abnormal_loss": "管理费用",
}

#: 贷方固定科目(冲回原抵扣进项)
_TRANSFER_OUT_CREDIT_ACCOUNT = "应交税费-应交增值税(进项税额转出)"

#: 进项税额转出的独立红线声明(以主管税务机关认定为准)
_TRANSFER_OUT_DISCLAIMER = (
    "【进项税额转出声明】转出税额 = 含税金额 ÷ (1 + 转出税率) × 转出税率,"
    "仅为草案性计算;具体是否转出 / 转出金额 / 所属期 **以主管税务机关认定为准**,"
    "须财务主管 / 执业资格人员复核签字。"
)


def _normalize_transfer_out_items(raw: Any) -> list[dict[str, Any]]:
    """转出明细入参归一:兼容数组 / JSON 字符串;reason 缺省 collective_welfare。
    category 校验沿用 CATEGORIES(不加新枚举,复用现有类别)。"""
    if raw is None:
        return []
    if isinstance(raw, str) and raw.strip():
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"input_tax_transfer_out 必须是合法 JSON: {exc}") from None
    if not isinstance(raw, list):
        raise ValueError("input_tax_transfer_out 必须是数组或其 JSON 字符串")
    if len(raw) > _MAX_REIMBURSEMENTS:
        raise ValueError(
            f"input_tax_transfer_out 条数 {len(raw)} 超上限 {_MAX_REIMBURSEMENTS}"
        )
    out: list[dict[str, Any]] = []
    for idx, item in enumerate(raw):
        if not isinstance(item, dict):
            raise ValueError(f"input_tax_transfer_out[{idx}] 必须是对象")
        category = str(item.get("category") or "other").strip().lower()
        if category not in CATEGORIES:
            raise ValueError(
                f"input_tax_transfer_out[{idx}].category 必须是 {list(CATEGORIES)} 其一,"
                f"收到 {category!r}"
            )
        reason = str(item.get("reason") or "collective_welfare").strip().lower()
        if reason not in TRANSFER_OUT_REASONS:
            raise ValueError(
                f"input_tax_transfer_out[{idx}].reason 必须是 "
                f"{list(TRANSFER_OUT_REASONS)} 其一,收到 {reason!r}"
            )
        out.append(
            {
                "employee": str(item.get("employee") or "").strip()[:_MAX_TEXT_LEN],
                "date": str(item.get("date") or "").strip()[:_MAX_TEXT_LEN],
                "amount": _money(item.get("amount"), f"input_tax_transfer_out[{idx}].amount"),
                "category": category,
                "reason": reason,
                "description": str(item.get("description") or "").strip()[:_MAX_TEXT_LEN],
            }
        )
    return out


def vat_input_transfer_out(
    items: Any,
    *,
    rate: Decimal = Decimal("0.13"),
) -> dict[str, Any]:
    """增值税进项税额转出计算(独立能力,可脱离 ai_reimbursement 直接调用)。

    计算纪律:
    - 转出税额 = 含税金额 ÷ (1 + rate) × rate,即把原抵扣的进项税额冲回;
    - 不含税金额 = 含税金额 − 转出税额(价税分离回补);
    - 分录:借「应付职工薪酬-集体福利 / 管理费用」(按 reason 映射),
      贷「应交税费-应交增值税(进项税额转出)」;借贷必平,不平显式报差异;
    - 全部金额 Decimal(字符串入、字符串出),杜绝浮点误差。

    返回结构化结果(不抛异常):
    {ok, details[], transferTaxTotal, netTotal, grossTotal, entries[],
     warnings[], disclaimer, rate}
    失败形态:{ok: False, errorCode, message}。
    """
    try:
        rows = _normalize_transfer_out_items(items)
    except ValueError as exc:
        return {"ok": False, "errorCode": "INVALID_INPUT", "message": str(exc)}

    # rate 单独走 _rate(0..1 之间),保持与主入口的税率校验同源
    try:
        rate = _rate(rate, Decimal("0.13"), "input_tax_transfer_out.rate")
    except ValueError as exc:
        return {"ok": False, "errorCode": "INVALID_INPUT", "message": str(exc)}

    details: list[dict[str, Any]] = []
    entries: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    total_transfer = Decimal("0")
    total_net = Decimal("0")
    total_gross = Decimal("0")

    for idx, item in enumerate(rows, start=1):
        amount = item["amount"]
        # 转出税额:含税 ÷ (1 + rate) × rate,分位四舍五入(ROUND_HALF_EVEN,与主入口同源)
        transfer_tax = (amount / (Decimal(1) + rate) * rate).quantize(Decimal("0.01"))
        net = amount - transfer_tax
        debit_account = TRANSFER_OUT_DEBIT_ACCOUNTS[item["reason"]]
        # 标准进项税额转出分录:只挂转出税额一条借贷对
        #   借:应付职工薪酬-集体福利(或管理费用)  转出税额
        #   贷:应交税费-应交增值税(进项税额转出)  转出税额
        # 不含税部分原已计入成本费用科目,转出时不再重做价税分离。
        lines = [
            {"account": debit_account, "dc": "debit", "amount": _q(transfer_tax)},
            {
                "account": _TRANSFER_OUT_CREDIT_ACCOUNT,
                "dc": "credit",
                "amount": _q(transfer_tax),
            },
        ]
        total_d = total_c = transfer_tax
        balanced = total_d == total_c
        entry: dict[str, Any] = {
            "voucherNo": f"转出-{idx:04d}",
            "date": item["date"],
            "summary": (
                f"{item['category']} 进项税额转出({TRANSFER_OUT_REASON_LABELS[item['reason']]})"
            ),
            "lines": lines,
            "debitTotal": _q(total_d),
            "creditTotal": _q(total_c),
            "balanced": balanced,
        }
        if not balanced:
            diff = total_d - total_c
            entry["difference"] = _q(diff)
            warnings.append(
                {
                    "severity": "error",
                    "code": "TRANSFER_OUT_UNBALANCED",
                    "message": (
                        f"{entry['voucherNo']} 转出分录借贷不平:差异 {_q(diff)} 元 —— **绝不配平**"
                    ),
                }
            )
        entries.append(entry)
        details.append(
            {
                "employee": item["employee"],
                "date": item["date"],
                "category": item["category"],
                "reason": item["reason"],
                "reasonLabel": TRANSFER_OUT_REASON_LABELS[item["reason"]],
                "grossAmount": _q(amount),
                "transferTax": _q(transfer_tax),
                "netAmount": _q(net),
                "rate": _rate_text(rate),
                "debitAccount": debit_account,
                "creditAccount": _TRANSFER_OUT_CREDIT_ACCOUNT,
            }
        )
        total_transfer += transfer_tax
        total_net += net
        total_gross += amount

    return {
        "ok": True,
        "rate": _rate_text(rate),
        "details": details,
        "transferTaxTotal": _q(total_transfer),
        "netTotal": _q(total_net),
        "grossTotal": _q(total_gross),
        "entries": entries,
        "warnings": warnings,
        "disclaimer": _TRANSFER_OUT_DISCLAIMER,
    }


def _build_transfer_out_html_section(result: dict[str, Any] | None) -> str:
    """把进项税额转出结果块渲染成 HTML 片段;result 为 None(未启用)时返回空串。"""
    if not result or not result.get("ok"):
        return ""
    rows = "".join(
        "<tr>"
        f"<td>{html.escape(d['employee'] or '-')}</td>"
        f"<td>{html.escape(d['date'] or '-')}</td>"
        f"<td>{html.escape(d['category'])}</td>"
        f"<td>{html.escape(d['reasonLabel'])}</td>"
        f'<td class="num">{d["grossAmount"]}</td>'
        f'<td class="num">{d["rate"]}</td>'
        f'<td class="num">{d["transferTax"]}</td>'
        f'<td class="num">{d["netAmount"]}</td>'
        f"<td>{html.escape(d['debitAccount'])}</td>"
        "</tr>"
        for d in result.get("details", [])
    )
    entries_html = []
    for e in result.get("entries", []):
        lines_rows = "".join(
            f'<tr><td>{html.escape(l["account"])}</td><td>{l["dc"]}</td>'
            f'<td class="num">{l["amount"]}</td></tr>'
            for l in e["lines"]
        )
        entries_html.append(
            f'<div class="card"><h2>{html.escape(e["voucherNo"])} · {html.escape(e["summary"])} '
            f'<span class="ok">借贷平衡</span></h2>'
            f'<table><thead><tr><th>科目</th><th>借贷</th><th>金额</th></tr>'
            f'</thead><tbody>{lines_rows}</tbody></table></div>'
        )
    return (
        '<div class="card"><h2>增值税进项税额转出明细</h2>'
        "<table><thead><tr><th>员工</th><th>日期</th><th>类别</th><th>转出原因</th>"
        '<th class="num">含税金额</th><th class="num">转出税率</th>'
        '<th class="num">转出税额</th><th class="num">不含税金额</th>'
        "<th>借方科目</th></tr></thead>"
        f"<tbody>{rows}</tbody>"
        "<tfoot><tr>"
        "<th colspan=6>合计</th>"
        f'<th class="num">{result.get("transferTaxTotal", "0.00")}</th>'
        f'<th class="num">{result.get("netTotal", "0.00")}</th>'
        "<th></th>"
        "</tr></tfoot></table>"
        '<p style="font-size:12px;color:#6b7280;margin:8px 0 0">'
        "适用场景:已认证抵扣的进项,后因用途改变(集体福利 / 个人消费 / 非应税项目 / 非正常损失)"
        "需作进项税额转出,把原抵扣税额冲回。</p></div>"
        f"{''.join(entries_html)}"
    )


# ---------------------------------------------------------------------------
# 产物:HTML / JSON 报销单草案写 tmp/artifacts
# ---------------------------------------------------------------------------

_HTML_STYLE = """
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
         margin: 32px; color: #1f2933; background: #f5f7fa; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 20px; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 16px 20px; margin-bottom: 16px; }
  .card h2 { font-size: 15px; margin: 0 0 12px; color: #111827; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .ok { color: #047857; } .bad { color: #b91c1c; } .warn { color: #b45309; }
  .disclaimer { font-size: 12px; color: #6b7280; margin-top: 24px;
                padding: 12px; background: #fef3c7; border-radius: 6px; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 4px;
           font-size: 11px; margin-right: 4px; }
  .badge-ok { background: #d1fae5; color: #047857; }
  .badge-no { background: #fee2e2; color: #b91c1c; }
"""


def _write_html_report(
    output_dir: Path,
    period: str,
    reimbursements: list[dict[str, Any]],
    vat_details: list[dict[str, Any]],
    tax_details: list[dict[str, Any]],
    issues: list[dict[str, Any]],
    entries: list[dict[str, Any]],
    params_echo: dict[str, Any],
    transfer_out_section: str = "",
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    total_gross = sum((r["amount"] for r in reimbursements), Decimal("0"))
    total_input = sum(
        (Decimal(v["inputVat"]) for v in vat_details if v["deductible"]), Decimal("0")
    )
    rows_html = []
    for idx, (item, vat, itx) in enumerate(
        zip(reimbursements, vat_details, tax_details), start=1
    ):
        badge = (
            '<span class="badge badge-ok">可抵</span>'
            if vat["deductible"]
            else '<span class="badge badge-no">不可抵</span>'
        )
        rows_html.append(
            "<tr>"
            f"<td>{idx}</td>"
            f"<td>{html.escape(item['employee'] or '-')}</td>"
            f"<td>{html.escape(item['category'])}</td>"
            f"<td>{html.escape(item['date'] or '-')}</td>"
            f"<td>{html.escape(item['invoice_type'])}</td>"
            f'<td class="num">{_q(item["amount"])}</td>'
            f"<td>{badge}{html.escape(vat['reason'][:60])}</td>"
            f'<td class="num">{vat["inputVat"]}</td>'
            f'<td class="num">{"并入" if itx["includeInSalary"] else "不并入"}</td>'
            "</tr>"
        )
    issues_html = "".join(
        f'<li class="{i["severity"]}">[{i["code"]}] {html.escape(i["message"])}</li>'
        for i in issues
    ) or "<li>无异常</li>"
    entries_html = []
    for e in entries:
        cls = "ok" if e["balanced"] else "bad"
        lines_rows = "".join(
            f'<tr><td>{html.escape(l["account"])}</td><td>{l["dc"]}</td>'
            f'<td class="num">{l["amount"]}</td></tr>'
            for l in e["lines"]
        )
        entries_html.append(
            f'<div class="card"><h2>{e["voucherNo"]} · {html.escape(e["summary"])} '
            f'<span class="{cls}">{"借贷平衡" if e["balanced"] else "借贷不平 " + e.get("difference", "")}</span>'
            f'</h2><table><thead><tr><th>科目</th><th>借贷</th><th>金额</th></tr>'
            f'</thead><tbody>{lines_rows}</tbody></table></div>'
        )
    params_rows = "".join(
        f"<tr><td>{html.escape(str(k))}</td><td class='num'>{html.escape(str(v))}</td></tr>"
        for k, v in params_echo.items()
    )
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    doc = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>AI 报销单草案 · {html.escape(period)}</title>
<style>{_HTML_STYLE}</style></head>
<body>
<h1>AI 报销单草案 · {html.escape(period)}</h1>
<div class="meta">生成时间 {stamp} · 共 {len(reimbursements)} 条 · 合计 {_q(total_gross)} 元 · 可抵进项 {_q(total_input)} 元</div>

<div class="card"><h2>政策参数(缺省,可覆盖,以主管税务机关核定为准)</h2>
<table><tbody>{params_rows}</tbody></table></div>

<div class="card"><h2>报销明细与四维判定</h2>
<table><thead><tr><th>#</th><th>员工</th><th>类别</th><th>日期</th><th>票据</th>
<th class="num">金额</th><th>进项判定</th><th class="num">可抵进项</th>
<th>个税口径</th></tr></thead><tbody>{''.join(rows_html)}</tbody></table></div>

<div class="card"><h2>限额 / 合规校验清单</h2>
<ul>{issues_html}</ul></div>

{''.join(entries_html)}

{transfer_out_section}

<div class="card"><h2>会计分录草案说明</h2>
<p style="font-size:13px;color:#6b7280;margin:0">
按费用类别 → 会计科目映射(管理费用-差旅费 / 业务招待费 / 职工教育经费 / 职工福利费 /
办公费 / 其他 + 应交税费-应交增值税(进项税额) + 银行存款 / 其他应收款)。
**借贷必须平衡;不平显式点名差异,绝不"配平"。**</p></div>

<div class="disclaimer">{html.escape(_DISCLAIMER)}</div>
</body></html>
"""
    path = output_dir / f"reimbursement-draft-{period}.html"
    path.write_text(doc, encoding="utf-8")
    return path


def _write_json_report(
    output_dir: Path,
    period: str,
    payload: dict[str, Any],
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"reimbursement-draft-{period}.json"
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    return path


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------


def _parse_limit_map(raw: Any, where: str) -> dict[str, Decimal]:
    if raw is None:
        return {}
    if isinstance(raw, str) and raw.strip():
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{where} 必须是合法 JSON: {exc}") from None
    if not isinstance(raw, dict):
        raise ValueError(f"{where} 必须是对象或其 JSON 字符串")
    out: dict[str, Decimal] = {}
    for k, v in raw.items():
        out[str(k)] = _money(v, f"{where}.{k}")
    return out


#: 借款冲销:科目名常量(借:管理费用-差旅费;贷:其他应收款-员工;差额走银行存款)
_ADVANCE_DEBIT_ACCOUNT = "管理费用-差旅费"
_ADVANCE_RECEIVABLE_ACCOUNT = "其他应收款"
_ADVANCE_CASH_ACCOUNT = "银行存款"
_ADVANCE_DISCLAIMER = (
    "【借款冲销声明】balance = 该员工报销合计 − 预借金额;"
    "正数 ⇒ 需补付员工(贷 银行存款),负数 ⇒ 需退回公司(借 银行存款),"
    "零 ⇒ 已结平。分录草案,须财务主管复核;预借制度以企业差旅制度为准。"
)


def _normalize_advance_offset(raw: Any) -> dict[str, Any] | None:
    """借款冲销入参归一:仅当传入 dict 且含 advance_amount 与 employee 才生效。

    - raw 为 None / 空串 ⇒ 返回 None(未启用,向后兼容);
    - raw 为 JSON 字符串 ⇒ 先解析再校验;
    - 缺 advance_amount 或 employee ⇒ 返回 None(不计冲销,不报错,保持向后兼容);
    - 显式传了 dict 但字段非法(非对象 / 金额错 / 员工空) ⇒ 抛 ValueError 由上层 _fail。
    """
    if raw is None:
        return None
    if isinstance(raw, str) and not raw.strip():
        return None
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"advance_offset 必须是合法 JSON: {exc}") from None
    if not isinstance(raw, dict):
        raise ValueError("advance_offset 必须是对象或其 JSON 字符串")
    # 关键字段任缺其一 ⇒ 视为未启用(向后兼容,不报错)
    if "advance_amount" not in raw or "employee" not in raw:
        return None
    employee = str(raw.get("employee") or "").strip()[:_MAX_TEXT_LEN]
    if not employee:
        raise ValueError("advance_offset.employee 必填,不能为空")
    # advance_amount 允许 0(已结平场景):用 if is None 判,而非 not
    advance_raw = raw.get("advance_amount")
    if advance_raw is None:
        raise ValueError("advance_offset.advance_amount 必填")
    advance_amount = _money(advance_raw, "advance_offset.advance_amount")
    if advance_amount < 0:
        raise ValueError(
            f"advance_offset.advance_amount 不能为负数,收到 {_q(advance_amount)}"
        )
    return {"employee": employee, "advance_amount": advance_amount}


def _build_advance_offset(
    reimbursements: list[dict[str, Any]],
    advance: dict[str, Any],
) -> dict[str, Any]:
    """按员工名过滤报销条目算合计,构造冲销分录(借贷必平,不平显式点名差异)。"""
    employee = advance["employee"]
    advance_amount = advance["advance_amount"]
    reimbursed_total = sum(
        (r["amount"] for r in reimbursements if r["employee"] == employee),
        Decimal("0"),
    )
    balance = reimbursed_total - advance_amount
    if balance > 0:
        direction = "需补付"
    elif balance < 0:
        direction = "需退回"
    else:
        direction = "已结平"
    # 冲销分录:借 管理费用-差旅费(报销合计);贷 其他应收款-XXX(借款金额);
    # 差额方向:balance>0 贷 银行存款(补付员工);balance<0 借 银行存款(收回现金)。
    lines: list[dict[str, Any]] = [
        {"account": _ADVANCE_DEBIT_ACCOUNT, "dc": "借", "amount": _q(reimbursed_total)},
        {
            "account": f"{_ADVANCE_RECEIVABLE_ACCOUNT}-{employee}",
            "dc": "贷",
            "amount": _q(advance_amount),
        },
    ]
    if balance > 0:
        lines.append(
            {"account": _ADVANCE_CASH_ACCOUNT, "dc": "贷", "amount": _q(balance)}
        )
    elif balance < 0:
        lines.append(
            {"account": _ADVANCE_CASH_ACCOUNT, "dc": "借", "amount": _q(-balance)}
        )
    total_d = sum((Decimal(l["amount"]) for l in lines if l["dc"] == "借"), Decimal("0"))
    total_c = sum((Decimal(l["amount"]) for l in lines if l["dc"] == "贷"), Decimal("0"))
    balanced = total_d == total_c
    entry: dict[str, Any] = {
        "voucherNo": "冲销-0001",
        "date": "",
        "summary": f"{employee} 借款冲销(预借 {_q(advance_amount)} − 报销 {_q(reimbursed_total)})",
        "lines": lines,
        "debitTotal": _q(total_d),
        "creditTotal": _q(total_c),
        "balanced": balanced,
    }
    warnings: list[dict[str, Any]] = []
    if not balanced:
        diff = total_d - total_c
        entry["difference"] = _q(diff)
        warnings.append(
            {
                "severity": "error",
                "code": "ADVANCE_OFFSET_UNBALANCED",
                "message": (
                    f"{entry['voucherNo']} 冲销分录借贷不平:差异 {_q(diff)} 元 —— **绝不配平**"
                ),
            }
        )
    return {
        "ok": True,
        "employee": employee,
        "advanceAmount": _q(advance_amount),
        "reimbursedTotal": _q(reimbursed_total),
        "balance": _q(balance),
        "direction": direction,
        "entries": [entry],
        "warnings": warnings,
        "disclaimer": _ADVANCE_DISCLAIMER,
    }


def _normalize_department_allocation(raw: Any) -> list[dict[str, Any]] | None:
    """多部门费用分摊入参归一:仅当传入 dict 且含非空 allocations 数组才生效。

    - raw 为 None / 空串 ⇒ 返回 None(未启用,向后兼容);
    - raw 为 JSON 字符串 ⇒ 先解析再校验;
    - raw 非对象 / 缺 allocations / allocations 非 list / 空数组 ⇒ 抛 ValueError;
    - 单条 allocation.employee 或 department 为空 ⇒ 抛 ValueError;
    - ratio 无法转 Decimal / 为负 ⇒ 抛 ValueError(硬约束,费用必须分完)。
    返回归一后的列表,每项 {employee, department, ratio(Decimal)}。
    """
    if raw is None:
        return None
    if isinstance(raw, str) and not raw.strip():
        return None
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"department_allocation 必须是合法 JSON: {exc}") from None
    if not isinstance(raw, dict):
        raise ValueError("department_allocation 必须是对象或其 JSON 字符串")
    allocations_raw = raw.get("allocations")
    if not isinstance(allocations_raw, list):
        raise ValueError("department_allocation.allocations 必须是数组")
    if not allocations_raw:
        raise ValueError("department_allocation.allocations 不能为空数组")
    result: list[dict[str, Any]] = []
    for idx, item in enumerate(allocations_raw, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"department_allocation.allocations[{idx}] 必须是对象")
        employee = str(item.get("employee") or "").strip()[:_MAX_TEXT_LEN]
        if not employee:
            raise ValueError(
                f"department_allocation.allocations[{idx}].employee 必填,不能为空"
            )
        department = str(item.get("department") or "").strip()[:_MAX_TEXT_LEN]
        if not department:
            raise ValueError(
                f"department_allocation.allocations[{idx}].department 必填,不能为空"
            )
        ratio_raw = item.get("ratio")
        if ratio_raw is None:
            raise ValueError(
                f"department_allocation.allocations[{idx}].ratio 必填"
            )
        # ratio 用字符串构造 Decimal 防浮点漂移(如 "0.6" 不得经 float 中转)
        try:
            ratio = Decimal(str(ratio_raw))
        except (InvalidOperation, ValueError, TypeError):
            raise ValueError(
                f"department_allocation.allocations[{idx}].ratio 非法,收到 {ratio_raw!r}"
            ) from None
        if ratio < 0:
            raise ValueError(
                f"department_allocation.allocations[{idx}].ratio 不能为负数,"
                f"收到 {_q(ratio)}"
            )
        result.append(
            {"employee": employee, "department": department, "ratio": ratio}
        )
    # 同一 employee 的 ratio 之和必须等于 1.0(费用必须分完),在归一层早失败,
    # 使 errorCode 落 INVALID_INPUT 而非晚期的 COMPUTE_FAILED。
    sums: dict[str, Decimal] = {}
    for a in result:
        sums[a["employee"]] = sums.get(a["employee"], Decimal(0)) + a["ratio"]
    for emp, total in sums.items():
        if total != Decimal("1"):
            raise ValueError(
                f"department_allocation: 员工 {emp} 的各部门分摊比例之和必须等于 1.0,"
                f"实际合计 {_q(total)}"
            )
    return result


def _build_department_allocation(
    reimbursements: list[dict[str, Any]],
    allocations: list[dict[str, Any]],
) -> dict[str, Any]:
    """按 ratio 把每位员工的报销合计分摊到各部门成本中心(仅分析维度,不动分录)。

    - 同一 employee 的所有 allocation ratio 之和必须等于 1.0,否则抛 ValueError;
    - 报销合计用 Decimal 累加,分摊额 amount = 合计 × ratio 再 quantize 到分;
    - by_department 按部门跨员工汇总;by_employee 保留该员工的逐部门明细。
    """
    # 校验硬约束:同一 employee 的 ratio 之和 == 1
    ratio_sum_by_emp: dict[str, Decimal] = {}
    for a in allocations:
        emp = a["employee"]
        ratio_sum_by_emp[emp] = ratio_sum_by_emp.get(emp, Decimal("0")) + a["ratio"]
    for emp, ratio_sum in ratio_sum_by_emp.items():
        if ratio_sum != Decimal("1"):
            raise ValueError(
                f"department_allocation:员工 {emp} 的分摊比例合计为 {_q(ratio_sum)},"
                f"必须等于 1.00(费用必须分完)"
            )
    # 每位员工的报销合计(Decimal 累加,不经 float)
    employee_total: dict[str, Decimal] = {}
    for r in reimbursements:
        emp = r["employee"]
        employee_total[emp] = employee_total.get(emp, Decimal("0")) + r["amount"]
    # by_employee:逐员工逐部门分摊
    by_employee: list[dict[str, Any]] = []
    dept_totals: dict[str, Decimal] = {}
    # 分摊只对 allocation 中出现的员工生效;未出现在 allocation 中的员工不分摊
    alloc_by_emp: dict[str, list[dict[str, Any]]] = {}
    for a in allocations:
        alloc_by_emp.setdefault(a["employee"], []).append(a)
    for emp, emp_allocs in alloc_by_emp.items():
        total = employee_total.get(emp, Decimal("0"))
        emp_detail: list[dict[str, Any]] = []
        for a in emp_allocs:
            # Decimal × Decimal 再 quantize 到分,避免浮点(1000 × 0.6 = 600.00)
            share = (total * a["ratio"]).quantize(Decimal("0.01"))
            emp_detail.append(
                {
                    "department": a["department"],
                    "amount": _q(share),
                    "ratio": _q(a["ratio"]),
                }
            )
            dept_totals[a["department"]] = (
                dept_totals.get(a["department"], Decimal("0")) + share
            )
        by_employee.append(
            {
                "employee": emp,
                "employee_total": _q(total),
                "allocations": emp_detail,
            }
        )
    by_department = [
        {"department": dept, "amount": _q(amt)}
        for dept, amt in dept_totals.items()
    ]
    # 稳定排序:按部门名,便于比对
    by_department.sort(key=lambda x: x["department"])
    return {
        "ok": True,
        "by_department": by_department,
        "by_employee": by_employee,
        "note": (
            "部门分摊为成本中心归集分析,不影响分录借贷平衡;"
            "具体成本中心科目以企业财务制度为准"
        ),
    }


def _reimbursement(arguments: dict[str, Any]) -> dict[str, Any]:
    try:
        if not isinstance(arguments, dict):
            return _fail("INVALID_ARGS", "arguments 必须为 dict")

        # 政策缺省参数(可覆盖,schema 与输出双处可见)
        try:
            lodging_over = _parse_limit_map(
                arguments.get("lodging_limits"), "lodging_limits"
            )
            lodging_limits: dict[str, Decimal] = {
                k: _money(v, f"DEFAULT_LODGING_LIMITS.{k}")
                for k, v in DEFAULT_LODGING_LIMITS.items()
            }
            lodging_limits.update(lodging_over)
            entertain_incur_ratio = _rate(
                arguments.get("entertain_incur_ratio"),
                DEFAULT_ENTERTAIN_INCUR_RATIO,
                "entertain_incur_ratio",
            )
            entertain_revenue_ratio = _rate(
                arguments.get("entertain_revenue_ratio"),
                DEFAULT_ENTERTAIN_REVENUE_RATIO,
                "entertain_revenue_ratio",
            )
            edu_ratio = _rate(
                arguments.get("edu_ratio"), DEFAULT_EDU_RATIO, "edu_ratio"
            )
            welfare_ratio = _rate(
                arguments.get("welfare_ratio"),
                DEFAULT_WELFARE_RATIO,
                "welfare_ratio",
            )
            default_vat_rate = _rate(
                arguments.get("default_vat_rate"), Decimal("0.06"), "default_vat_rate"
            )
            # 进项税额转出:可选入参 + 独立税率(缺省 0.13,可覆盖)
            transfer_out_rate = _rate(
                arguments.get("input_tax_transfer_out_rate"),
                Decimal("0.13"),
                "input_tax_transfer_out_rate",
            )
            transfer_out_raw = arguments.get("input_tax_transfer_out")
            advance_offset_raw = arguments.get("advance_offset")
            revenue_raw = arguments.get("revenue")
            revenue = (
                _money(revenue_raw, "revenue") if revenue_raw is not None else None
            )
            wage_raw = arguments.get("wage_total")
            wage_total = (
                _money(wage_raw, "wage_total") if wage_raw is not None else None
            )
            city_tier = str(arguments.get("city_tier") or "一线").strip()
            if city_tier not in CITY_TIERS:
                raise ValueError(f"city_tier 必须是 {list(CITY_TIERS)} 其一")
            # 城市档全局缺省:条目未带 city_tier 时回填
        except ValueError as exc:
            return _fail("INVALID_INPUT", str(exc))

        try:
            reimbursements = _normalize_reimbursements(
                arguments.get("reimbursements")
            )
        except ValueError as exc:
            return _fail("INVALID_INPUT", str(exc))
        for item in reimbursements:
            if not item["city_tier"]:
                item["city_tier"] = city_tier
            if item["vat_rate"] is None:
                item["vat_rate"] = default_vat_rate

        period = str(arguments.get("period") or "").strip()
        if not period:
            return _fail("INVALID_INPUT", "period 必填,形如 2026-11")
        try:
            output_dir = _resolve_output_dir(arguments.get("output_dir"))
        except ValueError as exc:
            return _fail("INVALID_OUTPUT_DIR", str(exc))

        # 单条四维判定
        vat_details = [_judge_vat(item) for item in reimbursements]
        tax_details = [_judge_income_tax(item) for item in reimbursements]
        # 合规校验(条目级 + 重复)
        issues: list[dict[str, Any]] = []
        for item in reimbursements:
            issues.extend(_check_compliance(item, lodging_limits))
        issues.extend(_detect_duplicates(reimbursements))
        # 期间级扣除限额
        period_issues = _check_period_limits(
            reimbursements,
            revenue,
            wage_total,
            entertain_incur_ratio,
            entertain_revenue_ratio,
            edu_ratio,
            welfare_ratio,
        )
        issues.extend(period_issues)

        # 分录草案
        entries, entry_warnings = _build_entries(reimbursements)
        issues.extend(entry_warnings)

        # 汇总
        total_gross = sum((r["amount"] for r in reimbursements), Decimal("0"))
        total_input_vat = sum(
            (Decimal(v["inputVat"]) for v in vat_details if v["deductible"]),
            Decimal("0"),
        )
        total_include_in_salary = sum(
            (Decimal(t["amountIncluded"]) for t in tax_details), Decimal("0")
        )
        category_summary = {
            cat: _q(
                sum(
                    (r["amount"] for r in reimbursements if r["category"] == cat),
                    Decimal("0"),
                )
            )
            for cat in CATEGORIES
            if any(r["category"] == cat for r in reimbursements)
        }

        params_echo = {
            "city_tier": city_tier,
            "lodging_limits": {k: _q(v) for k, v in lodging_limits.items()},
            "entertain_incur_ratio": _rate_text(entertain_incur_ratio),
            "entertain_revenue_ratio": _rate_text(entertain_revenue_ratio),
            "edu_ratio": _rate_text(edu_ratio),
            "welfare_ratio": _rate_text(welfare_ratio),
            "default_vat_rate": _rate_text(default_vat_rate),
            "revenue": _q(revenue) if revenue is not None else None,
            "wage_total": _q(wage_total) if wage_total is not None else None,
        }

        # 进项税额转出:仅当调用方传入 input_tax_transfer_out 时才计算(向后兼容)
        transfer_out_result: dict[str, Any] | None = None
        if transfer_out_raw is not None:
            transfer_out_result = vat_input_transfer_out(
                transfer_out_raw, rate=transfer_out_rate
            )

        # 借款冲销:仅当调用方传入 advance_offset 且含 advance_amount 与 employee 时计算
        advance_offset_result: dict[str, Any] | None = None
        try:
            adv = _normalize_advance_offset(advance_offset_raw)
        except ValueError as exc:
            return _fail("INVALID_INPUT", str(exc))
        if adv is not None:
            advance_offset_result = _build_advance_offset(reimbursements, adv)

        # 多部门费用分摊:仅当调用方传入 department_allocation 时才计算(向后兼容)
        department_alloc_raw = arguments.get("department_allocation")
        department_allocation_result: dict[str, Any] | None = None
        try:
            dept_allocs = _normalize_department_allocation(department_alloc_raw)
        except ValueError as exc:
            return _fail("INVALID_INPUT", str(exc))
        if dept_allocs is not None:
            department_allocation_result = _build_department_allocation(
                reimbursements, dept_allocs
            )

        # 产物
        json_payload = {
            "tool": _TOOL,
            "period": period,
            "params": params_echo,
            "reimbursements": [
                {
                    "employee": item["employee"],
                    "category": item["category"],
                    "amount": _q(item["amount"]),
                    "date": item["date"],
                    "invoice_type": item["invoice_type"],
                    "vat_rate": _rate_text(item["vat_rate"] or Decimal("0")),
                    "description": item["description"],
                }
                for item in reimbursements
            ],
            "vatDetails": vat_details,
            "incomeTaxDetails": tax_details,
            "issues": issues,
            "entries": entries,
            "totals": {
                "gross": _q(total_gross),
                "inputVatDeductible": _q(total_input_vat),
                "includeInSalary": _q(total_include_in_salary),
                "categorySummary": category_summary,
            },
            "disclaimer": _DISCLAIMER,
        }
        # 进项税额转出结果块挂到 JSON 产物(未启用时省略键,保持向后兼容)
        if transfer_out_result is not None:
            json_payload["inputTaxTransferOut"] = transfer_out_result
        # 转出 HTML 片段(未启用时为空串,模板占位符渲染为空)
        transfer_out_section = _build_transfer_out_html_section(transfer_out_result)
        try:
            html_path = _write_html_report(
                output_dir,
                period,
                reimbursements,
                vat_details,
                tax_details,
                issues,
                entries,
                params_echo,
                transfer_out_section,
            )
            json_path = _write_json_report(output_dir, period, json_payload)
        except OSError as exc:
            return _fail("ARTIFACT_WRITE_FAILED", f"产物写入失败:{exc}")

        error_count = sum(1 for i in issues if i["severity"] == "error")
        warning_count = sum(1 for i in issues if i["severity"] == "warning")
        return {
            "tool": _TOOL,
            "ok": True,
            "message": (
                f"AI 报销单草案完成:共 {len(reimbursements)} 条,合计 {_q(total_gross)} 元,"
                f"可抵进项 {_q(total_input_vat)} 元,并入工资薪金 {_q(total_include_in_salary)} 元;"
                f"校验问题 error={error_count} warning={warning_count}"
            ),
            "progress": _progress("draft", 4, 4, None),
            "phaseResult": {
                "detailCount": len(reimbursements),
                "totals": json_payload["totals"],
                "vatDetails": vat_details,
                "incomeTaxDetails": tax_details,
                "issues": issues,
                "entries": entries,
                # 借款冲销:仅当传入 advance_offset 时非 None,否则缺省不带该键(向后兼容)
                **({"advanceOffset": advance_offset_result}
                   if advance_offset_result is not None else {}),
                # 多部门费用分摊:仅当传入 department_allocation 时非 None,否则缺省不带该键(向后兼容)
                **({"departmentAllocation": department_allocation_result}
                   if department_allocation_result is not None else {}),
            },
            "artifacts": {
                "html": str(html_path.relative_to(_PROJECT_ROOT))
                if html_path.is_relative_to(_PROJECT_ROOT)
                else str(html_path),
                "json": str(json_path.relative_to(_PROJECT_ROOT))
                if json_path.is_relative_to(_PROJECT_ROOT)
                else str(json_path),
            },
            "params": params_echo,
            "disclaimer": _DISCLAIMER,
        }
    except (ValueError, InvalidOperation) as exc:
        return _fail("COMPUTE_FAILED", str(exc))
    except Exception as exc:  # noqa: BLE001 工具层不向对话链抛异常
        logger.exception("[ai_reimbursement] 未预期异常")
        return _fail("UNEXPECTED", f"未预期异常:{exc}")


async def ai_reimbursement(arguments: Any) -> dict[str, Any]:
    """AI 一键报账报销:费用明细 → 进项抵扣 + 个税口径 + 合规校验 + 分录草案。"""
    payload = arguments if isinstance(arguments, dict) else {}
    return _reimbursement(payload)


#: schema 描述(mcp_server 注册处共用,单一真相源,不在两处各写一遍)
AI_REIMBURSEMENT_DESCRIPTION = (
    "AI 一键报账报销(财务部板块插件)。输入 reimbursements 数组(每条 "
    "{employee,category(travel_transport/travel_lodging/travel_meal/entertainment/"
    "education/welfare/office/other),amount(字符串金额),date,invoice_type(special/"
    "general/e_general/none),description,vat_rate(缺省 0.06),city_tier(一线/新一线/二线),"
    "nights(住宿晚数),fund_source(资金科目,缺省 银行存款)});"
    "revenue=营业收入(算招待费 0.5% 限额),wage_total=工资薪金总额(算教育 8% / 福利 14% 限额),"
    "city_tier=城市档(定住宿限额缺省),period 形如 2026-11;"
    "政策缺省参数全部可覆盖:lodging_limits(住宿限额表)、entertain_incur_ratio=0.60、"
    "entertain_revenue_ratio=0.005、edu_ratio=0.08、welfare_ratio=0.14、default_vat_rate=0.06。"
    "**扩展可选参数(2026-11-13 增)**:每条 reimbursement 可带 lodging_city_tier(一线/新一线/二线/"
    "三线及以下,定住宿限额分档,缺省一线)、travel_per_diem(差旅费包干补助,按 per_diem_daily_limit"
    "缺省100元/天校验,标准内免个税)、conference(会议费,区别招待费,专票可抵进项);"
    "input_tax_transfer_out(进项税额转出 [{employee,date,amount,category,reason:collective_welfare/"
    "personal_consumption/non_taxable/abnormal_loss}])、advance_offset({employee,advance_amount} 借款"
    "冲销,多退少补)、department_allocation({allocations:[{employee,department,ratio}]} 多部门费用分摊,"
    "同一员工 ratio 之和须=1.0,仅分析维度不动分录)。period 用于跨期费用 warning。"
    "输出恒带 progress 块 + 四维判定(进项抵扣 / 个税口径 / 合规校验 / 分录草案)+ "
    "HTML / JSON 报销单草案写 tmp/artifacts。"
    "**红线**:产物为草案,须财务主管复核;不代理对外报送;政策数字以主管税务机关核定为准。"
)


__all__ = [
    "AI_REIMBURSEMENT_DESCRIPTION",
    "ai_reimbursement",
    "CATEGORIES",
    "INVOICE_TYPES",
    "CITY_TIERS",
    "DEFAULT_LODGING_LIMITS",
    "DEFAULT_ENTERTAIN_INCUR_RATIO",
    "DEFAULT_ENTERTAIN_REVENUE_RATIO",
    "DEFAULT_EDU_RATIO",
    "DEFAULT_WELFARE_RATIO",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
