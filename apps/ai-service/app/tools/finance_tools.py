# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""财务部「AI 一键代账 / AI 一键报税」插件工具(RP-46,2026-11-12 立)。

票面判据:
- **插件形态、AI 自动调用**:两工具注册于 mcp_server(`_TOOLS` schema + `_TOOL_HANDLERS`),
  由 D09 财务专家包(expert_route `finance-bookkeeping` / `tax-filing`)在对话命中触发词时
  自动并入工具白名单,模型按 phase 逐步调用 ⇒ 每一次工具调用都是一张实时工具卡
  (`tool-call-start`/`tool-result` 既有 SSE 帧,零新帧)。
- **实时进度回显**:返回值恒定携带 `progress` 块(phase / phaseIndex / of / next),
  模型据此发 `plan_updated` 步骤看板;前端 plan-steps-card 与 tool-calls-section 现成渲染。
- **分阶段可续跑**:阶段之间以 `state`(JSON 字符串)传递中间账状,任一阶段可单独重放,
  失败返回结构化 errorCode,不抛异常(同 report_tools 的既定纪律)。

计算纪律(专业性与诚实边界):
- 全部金额走 Decimal(字符串入、字符串出),杜绝浮点误差进账表;
- 记账凭证 = 规则引擎(业务类型→分录模板),试算不平衡一律显式点名差异,绝不"配平";
- 税额 = 现行公开规则的确定性套用(一般/小规模增值税、附加、印花税、企业所得税预缴、
  个税累计预扣法);参数缺省值在 schema 与输出里双处可见,可覆盖;
- **红线(输出内如实声明)**:产物为"草案",真实申报须纳税主体与执业资格人员复核;
  本工具不代理任何对外报送、不写生产库、不联网(纯计算 + tmp/artifacts 产物,
  与 generate_report 同档 ⇒ 不入 _ADMIN_ONLY_TOOLS)。

安全:output_dir 必须落在项目根内(report_tools 同一条校验);输入规模上限防膨胀。
"""

from __future__ import annotations

import html
import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 项目根与产物目录:与 chart_tools/report_tools 同构(app/tools -> app -> ai-service -> apps -> 仓根)
_PROJECT_ROOT = Path(__file__).resolve().parents[4]
_DEFAULT_OUTPUT_DIR = _PROJECT_ROOT / "tmp" / "artifacts"

# 输入规模上限
_MAX_TXN = 500
_MAX_TEXT_LEN = 300
_MAX_STATE_BYTES = 4_000_000

# ---------------------------------------------------------------------------
# 通用小件:金额解析 / 结构化失败 / 进度块
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
        raise ValueError(f"{where}: 税率必须是 0..1 之间的小数(如 0.13)")
    return value


def _progress(phase: str, index: int, of: int, next_phase: str | None) -> dict[str, Any]:
    return {
        "phase": phase,
        "phaseIndex": index,
        "of": of,
        "completed": round(index / of, 4),
        "next": next_phase,
    }


# ---------------------------------------------------------------------------
# 科目表(常用企业会计准则科目的简化映射)
# ---------------------------------------------------------------------------

ASSETS = "assets"
LIABILITIES = "liabilities"
EQUITY = "equity"
REVENUE = "revenue"
EXPENSE = "expense"

#: 科目 ⇒ (类别, 余额方向)。借方科目 debit=True。
CHART_OF_ACCOUNTS: dict[str, tuple[str, bool]] = {
    "库存现金": (ASSETS, True),
    "银行存款": (ASSETS, True),
    "应收账款": (ASSETS, True),
    "预付账款": (ASSETS, True),
    "其他应收款": (ASSETS, True),
    "原材料": (ASSETS, True),
    "库存商品": (ASSETS, True),
    "固定资产": (ASSETS, True),
    "累计折旧": (ASSETS, False),
    "应交税费—应交增值税(进项税额)": (LIABILITIES, False),
    "应交税费—应交增值税(销项税额)": (LIABILITIES, True),
    "应交税费—未交增值税": (LIABILITIES, True),
    "应交税费—应交城市维护建设税": (LIABILITIES, True),
    "应交税费—应交教育费附加": (LIABILITIES, True),
    "应交税费—应交地方教育附加": (LIABILITIES, True),
    "应交税费—应交印花税": (LIABILITIES, True),
    "应交税费—应交企业所得税": (LIABILITIES, True),
    "应交税费—应交个人所得税": (LIABILITIES, True),
    "应付账款": (LIABILITIES, True),
    "预收账款": (LIABILITIES, True),
    "应付职工薪酬": (LIABILITIES, True),
    "其他应付款": (LIABILITIES, True),
    "短期借款": (LIABILITIES, True),
    "实收资本": (EQUITY, True),
    "本年利润": (EQUITY, True),
    "利润分配": (EQUITY, True),
    "主营业务收入": (REVENUE, True),
    "其他业务收入": (REVENUE, True),
    "营业外收入": (REVENUE, True),
    "主营业务成本": (EXPENSE, False),
    "管理费用": (EXPENSE, False),
    "销售费用": (EXPENSE, False),
    "财务费用": (EXPENSE, False),
    "税金及附加": (EXPENSE, False),
    "所得税费用": (EXPENSE, False),
    "营业外支出": (EXPENSE, False),
}

#: 损益类科目(期末结转至本年利润)
PnL_ACCOUNTS = tuple(
    name for name, (kind, _) in CHART_OF_ACCOUNTS.items() if kind in (REVENUE, EXPENSE)
)

_DATE_RE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")
_PERIOD_RE = re.compile(r"^\d{4}-(\d{2}|\d{2}Q[1-4])$")


# ---------------------------------------------------------------------------
# 一键代账:业务流水 → 凭证 → 试算平衡 → 结账 → 报表产物
# ---------------------------------------------------------------------------

_BOOK_PHASES: tuple[str, ...] = (
    "classify",
    "voucher",
    "trial_balance",
    "close",
    "report",
)

#: 结算方式 ⇒ 资金科目
SETTLEMENT_ACCOUNTS = {
    "bank": "银行存款",
    "cash": "库存现金",
    "credit": "应收账款",
    "payable": "应付账款",
    "advance": "预收账款",
    "prepaid": "预付账款",
}


def _normalize_transactions(raw: Any) -> list[dict[str, str]]:
    """业务流水入参校验并归一为字符串字典(全字段 Decimal 就绪形态)。"""
    if isinstance(raw, str):
        try:
            payload = json.loads(raw)
        except (json.JSONDecodeError, TypeError) as exc:
            raise ValueError(f"transactions 必须是合法 JSON 字符串: {exc}") from None
    elif isinstance(raw, list):
        payload = raw
    else:
        raise ValueError("transactions 必须是 JSON 数组或其字符串形态")
    if not isinstance(payload, list) or not payload:
        raise ValueError("transactions 必须是非空数组")
    if len(payload) > _MAX_TXN:
        raise ValueError(f"transactions 数量超限(最多 {_MAX_TXN} 笔)")
    out: list[dict[str, str]] = []
    for idx, item in enumerate(payload):
        if not isinstance(item, dict):
            raise ValueError(f"transactions[{idx}] 必须是对象")
        date = str(item.get("date", "")).strip()
        if not _DATE_RE.match(date):
            raise ValueError(f"transactions[{idx}].date 必须形如 YYYY-MM-DD")
        biz = str(item.get("type", "")).strip().lower() or "expense"
        summary = str(item.get("summary", "")).strip() or biz
        if len(summary) > _MAX_TEXT_LEN:
            raise ValueError(f"transactions[{idx}].summary 超长(≤{_MAX_TEXT_LEN})")
        row = {
            "date": date,
            "type": biz,
            "summary": summary,
            "amount": _q(_money(item.get("amount"), f"transactions[{idx}].amount")),
            "method": str(item.get("method", "bank")).strip().lower() or "bank",
            "counterparty": str(item.get("counterparty", "")).strip()[:_MAX_TEXT_LEN],
        }
        if row["method"] not in SETTLEMENT_ACCOUNTS:
            raise ValueError(
                f"transactions[{idx}].method 必须是 {sorted(SETTLEMENT_ACCOUNTS)} 其一"
            )
        row["tax_rate"] = str(
            _rate(item.get("tax_rate"), Decimal("0.13"), f"transactions[{idx}].tax_rate")
        )
        # 透传工资拆分所需的数值字段(salary 分支用),其余字段丢弃防注入
        for extra in ("social", "income_tax"):
            if item.get(extra) is not None:
                row[extra] = _q(_money(item.get(extra), f"transactions[{idx}].{extra}"))
        invoice = str(item.get("invoice", "special")).strip().lower()
        if invoice not in ("special", "general", "none"):
            raise ValueError(f"transactions[{idx}].invoice 必须是 special/general/none")
        row["invoice"] = invoice
        out.append(row)
    return out


def _split_tax(amount: Decimal, rate: Decimal) -> tuple[Decimal, Decimal]:
    """含税金额拆价税:不含税 = 金额/(1+率),税额 = 金额-不含税。"""
    net = (amount / (Decimal(1) + rate)).quantize(Decimal("0.01"))
    return net, amount - net


@dataclass
class _Entry:
    date: str
    summary: str
    lines: list[dict[str, str]] = field(default_factory=list)
    source: int = -1


def _classify_one(row: dict[str, str], seq: int) -> _Entry:
    """单笔业务 → 会计分录(规则引擎)。未知类型显式归入管理费用并标注复核。"""
    amount = Decimal(row["amount"])
    rate = Decimal(row["tax_rate"])
    method = row["method"]
    biz = row["type"]
    summary = row["summary"]
    money_account = SETTLEMENT_ACCOUNTS[method]
    entry = _Entry(date=row["date"], summary=summary, source=seq)

    def debit(account: str, value: Decimal, memo: str | None = None) -> None:
        entry.lines.append(
            {"account": account, "dc": "debit", "amount": _q(value), "memo": memo or summary}
        )

    def credit(account: str, value: Decimal, memo: str | None = None) -> None:
        entry.lines.append(
            {"account": account, "dc": "credit", "amount": _q(value), "memo": memo or summary}
        )

    if biz in ("sales", "sales_service", "service_income", "other_income"):
        to_revenue = "其他业务收入" if biz == "other_income" else "主营业务收入"
        if method in ("credit", "advance"):
            fund = "应收账款" if method == "credit" else "预收账款"
        else:
            fund = money_account
        net, vat = _split_tax(amount, rate)
        debit(fund, amount)
        credit(to_revenue, net, f"{summary}(不含税)")
        if vat:
            credit("应交税费—应交增值税(销项税额)", vat, f"税率 {_rate_text(rate)}")
    elif biz in ("sales_return", "return"):
        net, vat = _split_tax(amount, rate)
        credit("应收账款" if method in ("credit", "advance") else money_account, amount)
        debit("主营业务收入", net, "销售退回到冲减(不含税)")
        if vat:
            debit("应交税费—应交增值税(销项税额)", vat, "退货冲减销项")
    elif biz in ("purchase", "purchase_service"):
        if biz == "purchase_service":
            net, vat = _split_tax(amount, rate)
            debit("管理费用", net, f"{summary}(不含税)")
            if row["invoice"] == "special" and vat:
                debit("应交税费—应交增值税(进项税额)", vat, f"税率 {_rate_text(rate)}")
            credit(money_account if method not in ("payable",) else "应付账款", amount)
        else:
            warehouse = "库存商品"
            if row["invoice"] == "special" and rate > 0:
                net, vat = _split_tax(amount, rate)
                debit(warehouse, net, f"{summary}(不含税)")
                debit("应交税费—应交增值税(进项税额)", vat, f"税率 {_rate_text(rate)}")
                credit("应付账款" if method in ("payable", "prepaid") else money_account, amount)
            else:
                debit(warehouse, amount, "普票/无票不认证进项,全额入成本")
                credit("应付账款" if method in ("payable", "prepaid") else money_account, amount)
    elif biz in ("purchase_return",):
        debit("应付账款" if method in ("payable", "prepaid") else money_account, amount)
        credit("库存商品", amount, "采购退回冲减")
    elif biz == "cost":
        debit("主营业务成本", amount, f"{summary}(成本结转)")
        credit("库存商品", amount, f"{summary}出库")
    elif biz == "salary":
        social = _money(row.get("social", "0"), f"transactions[{seq}].social")
        individual_tax = _money(row.get("income_tax", "0"), f"transactions[{seq}].income_tax")
        net_pay = amount - social - individual_tax
        if net_pay <= 0:
            raise ValueError(
                f"transactions[{seq}]: 实发必须为正(应发{amount} − 社保{social} − 个税{individual_tax})"
            )
        debit("应付职工薪酬", amount)
        credit("银行存款", net_pay, f"{summary}(实发)")
        if social:
            credit("其他应付款", social, "代扣社保")
        if individual_tax:
            credit("应交税费—应交个人所得税", individual_tax, "代扣个税")
    elif biz == "salary_accrue":
        debit("管理费用", amount, f"{summary}(计提)")
        credit("应付职工薪酬", amount, f"{summary}")
    elif biz in ("social_insurance", "housing_fund"):
        debit("管理费用", amount, f"{summary}(企业部分)")
        credit("应付职工薪酬", amount, f"{summary}")
    elif biz == "rent":
        debit("管理费用", amount, f"{summary}(租金)")
        credit(money_account if method not in ("prepaid",) else "预付账款", amount)
    elif biz in ("utilities", "freight", "office", "travel", "entertain", "expense"):
        expense_account = "销售费用" if biz == "freight" else "管理费用"
        debit(expense_account, amount, summary)
        credit(money_account if method not in ("payable",) else "应付账款", amount)
    elif biz == "interest":
        debit("财务费用", amount, f"{summary}(利息支出)")
        credit("银行存款" if method in ("bank", "cash") else "应付利息", amount)
    elif biz == "tax_payment":
        debit("应交税费—未交增值税", amount, f"{summary}(缴纳)")
        credit("银行存款", amount)
    elif biz == "receipt":
        debit(money_account, amount, f"{summary}(回款)")
        credit("应收账款", amount)
    elif biz == "payment":
        debit("应付账款", amount, f"{summary}(付款)")
        credit(money_account, amount)
    elif biz == "depreciation":
        debit("管理费用", amount, f"{summary}(折旧)")
        credit("累计折旧", amount)
    elif biz in ("investment", "capital"):
        debit(money_account, amount, f"{summary}(投入)")
        credit("实收资本", amount)
    else:
        debit("管理费用", amount, f"未知业务类型 {biz} 暂归集至管理费用,需人工复核")
        credit(money_account, amount)
    return entry


def _rate_text(rate: Decimal) -> str:
    return f"{(rate * 100).normalize()}%"


def _load_state(arguments: dict[str, Any], keys: tuple[str, ...]) -> dict[str, Any]:
    """从 state 恢复上游阶段产物(阶段间续跑通道)。"""
    raw = arguments.get("state")
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        raise ValueError("本阶段需要 state 入参(上游阶段返回的 JSON 字符串)")
    if isinstance(raw, str):
        if len(raw.encode("utf-8", "ignore")) > _MAX_STATE_BYTES:
            raise ValueError(f"state 超限(≤{_MAX_STATE_BYTES} 字节)")
        try:
            payload = json.loads(raw)
        except (json.JSONDecodeError, TypeError) as exc:
            raise ValueError(f"state 必须是合法 JSON 字符串: {exc}") from None
    elif isinstance(raw, dict):
        payload = raw
    else:
        raise ValueError("state 必须是对象或其 JSON 字符串")
    if not isinstance(payload, dict) or any(key not in payload for key in keys):
        raise ValueError(f"state 缺少必需字段:{','.join(keys)}")
    return payload


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
        raise ValueError("period 必填,形如 2026-11(月度)或 2026-03Q1/2026-Q1(季度)")
    if not _PERIOD_RE.match(period):
        raise ValueError(f"period 形态非法:{period}")
    return period


def _bookkeeping(arguments: dict[str, Any]) -> dict[str, Any]:
    tool = "ai_bookkeeping"
    try:
        if not isinstance(arguments, dict):
            return _fail(tool, "INVALID_ARGS", "arguments 必须为 dict")
        phase = str(arguments.get("phase") or "all").strip().lower()
        valid = _BOOK_PHASES + ("all",)
        if phase not in valid:
            return _fail(tool, "INVALID_PHASE", f"phase 必须是 {list(valid)} 其一")

        state: dict[str, Any] = {}
        transactions: list[dict[str, str]] | None = None
        # 入口两形态:① 显式 transactions ⇒ 从头起;② state 续跑 ⇒ period 必带,明细按需恢复
        try:
            if arguments.get("transactions") is not None:
                transactions = _normalize_transactions(arguments.get("transactions"))
                state = {"period": _resolve_period(arguments), "transactions": transactions}
            elif arguments.get("state") is not None:
                loaded = _load_state(arguments, ("period",))
                state = dict(loaded)
                if state.get("transactions"):
                    transactions = _normalize_transactions(state["transactions"])
            else:
                return _fail(tool, "INVALID_INPUT", "请提供 transactions(新任务)或 state(续跑)")
        except ValueError as exc:
            return _fail(tool, "INVALID_INPUT", str(exc))

        # 阶段序列与当前索引(all=从头串到尾,每段仍产入 state;非 all=单段)
        if phase == "all":
            chain: tuple[str, ...] = _BOOK_PHASES
            done_index = len(_BOOK_PHASES)
            next_name: str | None = None
        else:
            chain = (phase,)
            done_index = _BOOK_PHASES.index(phase) + 1
            after = done_index  # 0-based 的下一枚
            next_name = _BOOK_PHASES[after] if after < len(_BOOK_PHASES) else None

        results: dict[str, Any] = {}
        for step in chain:
            if step == "classify":
                if transactions is None:
                    return _fail(
                        tool, "MISSING_STATE", "classify 需要 transactions(入参或 state 携带)"
                    )
                entries = [_classify_one(row, seq) for seq, row in enumerate(transactions)]
                state["entries"] = [
                    {
                        "date": e.date,
                        "summary": e.summary,
                        "lines": e.lines,
                        "source": e.source,
                    }
                    for e in entries
                ]
                results["classify"] = {"entries": len(state["entries"])}
            elif step == "voucher":
                if not state.get("entries"):
                    return _fail(tool, "MISSING_STATE", "voucher 需要 state.entries(先跑 classify)")
                vouchers: list[dict[str, Any]] = []
                for n, entry in enumerate(state["entries"], start=1):
                    total_d = sum(
                        Decimal(line["amount"]) for line in entry["lines"] if line["dc"] == "debit"
                    )
                    total_c = sum(
                        Decimal(line["amount"]) for line in entry["lines"] if line["dc"] == "credit"
                    )
                    vouchers.append(
                        {
                            "voucherNo": f"记-{n:04d}",
                            "date": entry["date"],
                            "summary": entry["summary"],
                            "lines": entry["lines"],
                            "totalDebit": _q(total_d),
                            "totalCredit": _q(total_c),
                            "balanced": total_d == total_c,
                        }
                    )
                unbalanced = [v["voucherNo"] for v in vouchers if not v["balanced"]]
                if unbalanced:
                    return _fail(
                        tool,
                        "VOUCHER_UNBALANCED",
                        f"以下凭证借贷不平(规则引擎缺陷,须复核):{unbalanced}",
                    )
                state["vouchers"] = vouchers
                results["voucher"] = {"vouchers": len(vouchers)}
            elif step == "trial_balance":
                vouchers = state.get("vouchers") or _ensure_vouchers(state)
                if not vouchers:
                    return _fail(tool, "MISSING_STATE", "trial_balance 需要 state.vouchers")
                ledgers = _trial_balance(vouchers)
                if not ledgers["balanced"]:
                    return _fail(
                        tool,
                        "TRIAL_UNBALANCED",
                        "科目余额表借贷不平,须按差异定位复核(绝不为配平而改数)",
                    )
                state["trial_balance"] = ledgers
                results["trial_balance"] = {
                    "accounts": len(ledgers["rows"]),
                    "totalDebit": ledgers["totalDebit"],
                    "totalCredit": ledgers["totalCredit"],
                    "balanced": True,
                }
            elif step == "close":
                if not state.get("trial_balance"):
                    return _fail(tool, "MISSING_STATE", "close 需要 state.trial_balance")
                close_vouchers, profit = _close_period(state["trial_balance"], state["vouchers"])
                state.setdefault("vouchers", []).extend(close_vouchers)
                state["profit"] = profit
                state["trial_balance_after"] = _trial_balance(state["vouchers"])
                results["close"] = {"profit": profit["net"], "closeVouchers": len(close_vouchers)}
            elif step == "report":
                vouchers = state.get("vouchers") or []
                if not vouchers:
                    return _fail(tool, "MISSING_STATE", "report 需要 state(vouchers)")
                tb = state.get("trial_balance_after") or state.get("trial_balance") or {}
                profit = state.get("profit") or {}
                try:
                    rel_path = _write_bookkeeping_report(
                        period=state.get("period", ""),
                        vouchers=vouchers,
                        trial_balance=tb,
                        profit=profit,
                        output_dir=arguments.get("output_dir"),
                    )
                except OSError as exc:
                    return _fail(tool, "REPORT_WRITE_FAILED", f"报表写入失败:{exc}")
                state["report_path"] = rel_path
                results["report"] = {"path": rel_path}

        summary_text = _book_summary(state, results, phase)
        return {
            "tool": tool,
            "ok": True,
            "message": summary_text,
            "progress": _progress(
                phase if phase != "all" else _BOOK_PHASES[done_index - 1],
                done_index,
                len(_BOOK_PHASES),
                next_name,
            ),
            "phaseResult": results,
            "state": json.dumps(_compact_state(state), ensure_ascii=False),
            "period": state.get("period"),
        }
    except (ValueError, InvalidOperation) as exc:
        return _fail(tool, "COMPUTE_FAILED", str(exc))
    except Exception as exc:  # noqa: BLE001 工具层不向对话链抛异常
        logger.exception("[ai_bookkeeping] 未预期异常")
        return _fail(tool, "UNEXPECTED", f"未预期异常:{exc}")


def _ensure_vouchers(state: dict[str, Any]) -> list[dict[str, Any]]:
    if state.get("vouchers"):
        return state["vouchers"]  # type: ignore[no-any-return]
    if state.get("entries"):
        vouchers: list[dict[str, Any]] = []
        for n, entry in enumerate(state["entries"], start=1):
            total_d = sum(
                Decimal(line["amount"]) for line in entry["lines"] if line["dc"] == "debit"
            )
            total_c = sum(
                Decimal(line["amount"]) for line in entry["lines"] if line["dc"] == "credit"
            )
            vouchers.append(
                {
                    "voucherNo": f"记-{n:04d}",
                    "date": entry["date"],
                    "summary": entry["summary"],
                    "lines": entry["lines"],
                    "totalDebit": _q(total_d),
                    "totalCredit": _q(total_c),
                    "balanced": total_d == total_c,
                }
            )
        return vouchers
    return []


def _trial_balance(vouchers: list[dict[str, Any]]) -> dict[str, Any]:
    """科目余额表:逐分录累计(借正贷负);平衡判据取全量发生额借贷合计。"""
    totals: dict[str, Decimal] = {}
    debit_total = Decimal(0)
    credit_total = Decimal(0)
    for voucher in vouchers:
        for line in voucher["lines"]:
            account = line["account"]
            amount = Decimal(line["amount"])
            signed = amount if line["dc"] == "debit" else -amount
            totals[account] = totals.get(account, Decimal(0)) + signed
            if line["dc"] == "debit":
                debit_total += amount
            else:
                credit_total += amount
    rows = [
        {
            "account": account,
            "kind": CHART_OF_ACCOUNTS.get(account, ("unknown", True))[0],
            "balance": _q(balance),
        }
        for account, balance in sorted(totals.items())
    ]
    return {
        "rows": rows,
        "totalDebit": _q(debit_total),
        "totalCredit": _q(credit_total),
        "balanced": debit_total == credit_total,
    }


def _close_period(
    trial_balance: dict[str, Any],
    vouchers: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """损益结转(期末):收入/费用余额全部转入本年利润,并给出本期利润。"""
    revenue = sum(
        (-Decimal(r["balance"]) for r in trial_balance["rows"] if r["kind"] == REVENUE),
        Decimal(0),
    )
    expense = sum(
        (Decimal(r["balance"]) for r in trial_balance["rows"] if r["kind"] == EXPENSE),
        Decimal(0),
    )
    net = revenue - expense
    next_no = len(vouchers) + 1
    close_lines: list[dict[str, str]] = []
    for row in trial_balance["rows"]:
        if row["kind"] not in (REVENUE, EXPENSE):
            continue
        amount = Decimal(row["balance"])
        if row["kind"] == REVENUE:
            close_lines.append(
                {
                    "account": row["account"],
                    "dc": "debit",
                    "amount": _q(-amount),
                    "memo": "期末结转",
                }
            )
            close_lines.append(
                {"account": "本年利润", "dc": "credit", "amount": _q(-amount), "memo": "期末结转"}
            )
        else:
            if amount == 0:
                continue
            close_lines.append(
                {"account": "本年利润", "dc": "debit", "amount": _q(amount), "memo": "期末结转"}
            )
            close_lines.append(
                {
                    "account": row["account"],
                    "dc": "credit",
                    "amount": _q(amount),
                    "memo": "期末结转",
                }
            )
    close_vouchers: list[dict[str, Any]] = []
    if close_lines:
        close_total = sum(Decimal(line["amount"]) for line in close_lines if line["dc"] == "debit")
        close_vouchers.append(
            {
                "voucherNo": f"记-{next_no:04d}",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "summary": "损益结转至本年利润",
                "lines": close_lines,
                "totalDebit": _q(close_total),
                "totalCredit": _q(close_total),
                "balanced": True,
            }
        )
    profit: dict[str, Any] = {
        "revenue": _q(revenue),
        "expense": _q(expense),
        "net": _q(net),
    }
    return close_vouchers, profit


def _compact_state(state: dict[str, Any]) -> dict[str, Any]:
    """state 出参:保留续跑所需字段;voucher 之后 entries/transactions 明细不再回传(payload 瘦身)。"""
    has_vouchers = bool(state.get("vouchers"))
    return {
        "period": state.get("period"),
        "transactions": None if has_vouchers else state.get("transactions"),
        "entries": None if has_vouchers else state.get("entries"),
        "vouchers": state.get("vouchers"),
        "trial_balance": state.get("trial_balance"),
        "trial_balance_after": state.get("trial_balance_after"),
        "profit": state.get("profit"),
        "report_path": state.get("report_path"),
    }


def _book_summary(state: dict[str, Any], results: dict[str, Any], phase: str) -> str:
    bits: list[str] = []
    if "classify" in results:
        bits.append(f"分录生成 {results['classify']['entries']} 笔")
    if "voucher" in results:
        bits.append(f"记账凭证 {results['voucher']['vouchers']} 张(借贷全平)")
    if "trial_balance" in results:
        tb = state.get("trial_balance") or {}
        bits.append(f"试算平衡通过:借合计 {tb.get('totalDebit')} = 贷合计 {tb.get('totalCredit')}")
    if "close" in results:
        bits.append(f"损益结转完成,本期利润 {state.get('profit', {}).get('net')}")
    if "report" in results:
        bits.append(f"报表产物 {state.get('report_path')}")
    tail = "(继续回传 state 调用下一阶段)" if phase != "all" else "(全流程已完成)"
    return ";".join(bits) + tail if bits else "阶段已执行" + tail


def _write_bookkeeping_report(
    *,
    period: str,
    vouchers: list[dict[str, Any]],
    trial_balance: dict[str, Any],
    profit: dict[str, Any],
    output_dir: Any,
) -> str:
    """账簿汇总 HTML 产物(落 tmp/artifacts,前端 tool-call-card 既有白名单直渲)。"""
    out_dir = _resolve_output_dir(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
    file_path = out_dir / f"bookkeeping-{period}-{stamp}.html"
    voucher_rows = "\n".join(
        "<tr>"
        f"<td>{html.escape(v['voucherNo'])}</td>"
        f"<td>{html.escape(v['date'])}</td>"
        f"<td>{html.escape(v['summary'])}</td>"
        + "\n".join(
            f'<tr class="sub"><td></td><td colspan="2">{html.escape(line["account"])}</td>'
            f'<td class="dc">{html.escape("借" if line["dc"] == "debit" else "贷")}</td>'
            f'<td class="num">{html.escape(line["amount"])}</td>'
            f"<td>{html.escape(line.get('memo') or '')}</td></tr>"
            for line in v["lines"]
        )
        + "</tr>"
        for v in vouchers
    )
    tb_rows = "\n".join(
        f"<tr><td>{html.escape(r['account'])}</td><td class='num'>{html.escape(r['balance'])}</td></tr>"
        for r in trial_balance.get("rows", [])
    )
    profit_html = (
        f"<p>收入合计 {html.escape(str(profit.get('revenue', '0')))} · "
        f"费用合计 {html.escape(str(profit.get('expense', '0')))} · "
        f"本期利润 {html.escape(str(profit.get('net', '0')))}</p>"
        if profit
        else "<p>尚未结账(未执行 close 阶段)</p>"
    )
    doc = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>AI 一键代账 · {html.escape(period)} 账务汇总</title>
<style>
body {{ margin:0; padding:24px; font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif; color:#1f2328; background:#fff; }}
main {{ max-width:860px; margin:0 auto; }}
h1 {{ font-size:22px; margin:0 0 4px; }}
h2 {{ font-size:17px; margin:28px 0 8px; }}
table {{ width:100%; border-collapse:collapse; font-size:13px; }}
th,td {{ border:1px solid #d8dee4; padding:6px 8px; }}
tr.sub td {{ border:none; border-bottom:1px dashed #eaeef2; }}
.num, .amount {{ text-align:right; font-variant-numeric:tabular-nums; }}
.dc {{ width:3em; text-align:center; }}
footer {{ margin-top:32px; color:#57606a; font-size:12px; }}
.warn {{ background:#fff8c5; border:1px solid #d4a72c66; padding:10px 12px; }}
</style>
</head>
<body>
<main>
<h1>AI 一键代账 · {html.escape(period)} 账务汇总</h1>
<div class="warn">本产物由系统按业务流水自动记账生成,正式账务与申报须由执业会计复核确认。</div>
<h2>记账凭证({len(vouchers)} 张)</h2>
<table><thead><tr><th>凭证号</th><th>日期</th><th>摘要</th><th>借/贷</th><th>金额</th></tr></thead>
<tbody>{voucher_rows}</tbody></table>
<h2>科目余额表(期末)</h2>
<table><thead><tr><th>科目</th><th>余额(借正贷负)</th></tr></thead><tbody>{tb_rows}</tbody></table>
<h2>本期利润</h2>
{profit_html}
<footer>IHUI AI 财务部 · 一键代账 · 生成于 {datetime.now().strftime("%Y-%m-%d %H:%M")}</footer>
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
# 一键报税:取数 → 计税 → 申报表草案 → 校验
# ---------------------------------------------------------------------------

_TAX_PHASES: tuple[str, ...] = ("compute", "validate", "draft")

#: 个人所得税累计预扣率表(级距:累计预扣预缴应纳税所得额,元)
_IIT_BRACKETS: tuple[tuple[Decimal, Decimal, Decimal], ...] = (
    (Decimal(36000), Decimal("0.03"), Decimal(0)),
    (Decimal(144000), Decimal("0.1"), Decimal(2520)),
    (Decimal(300000), Decimal("0.2"), Decimal(16920)),
    (Decimal(420000), Decimal("0.25"), Decimal(31920)),
    (Decimal(660000), Decimal("0.3"), Decimal(52920)),
    (Decimal(960000), Decimal("0.35"), Decimal(85920)),
    (Decimal(10**15), Decimal("0.45"), Decimal(181920)),
)
#: 基本减除费用(个月 5000)
IIT_MONTHLY_DEDUCTION = Decimal(5000)


@dataclass
class _IIT:
    name: str
    gross: Decimal
    social: Decimal
    special: Decimal
    tax: Decimal


def _iit_cumulative(monthly: list[dict[str, Any]]) -> list[_IIT]:
    """累计预扣法逐月计算(工资表 [{name, gross, social, special_deduction(子女教育/房贷等)}, ...])。"""
    cumulative_income = Decimal(0)
    cumulative_deductions = Decimal(0)
    cumulative_paid = Decimal(0)
    rows: list[_IIT] = []
    for idx, emp in enumerate(monthly):
        name = str(emp.get("name") or f"员工{idx + 1}")[:_MAX_TEXT_LEN]
        gross = _money(emp.get("gross"), f"employees[{idx}].gross")
        social = _money(emp.get("social") or 0, f"employees[{idx}].social")
        special = _money(emp.get("special_deduction") or 0, f"employees[{idx}].special_deduction")
        cumulative_income += gross
        cumulative_deductions += social + special + IIT_MONTHLY_DEDUCTION
        taxable = max(Decimal(0), cumulative_income - cumulative_deductions)
        for cap, rate, quick in _IIT_BRACKETS:
            if taxable <= cap:
                total_due = (taxable * rate - quick).quantize(Decimal("0.01"))
                break
        else:  # pragma: no cover 末档 10^15 必然覆盖
            total_due = taxable * Decimal("0.45")
        month_tax = total_due - cumulative_paid
        cumulative_paid = max(Decimal(0), cumulative_paid + month_tax)
        rows.append(_IIT(name=name, gross=gross, social=social, special=special, tax=month_tax))
    return rows


def _tax_compute(arguments: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    """增值税/附加/印花/所得税/个税五项计提(全部参数化,缺省值即 schema 缺省)。"""
    taxpayer = str(arguments.get("taxpayer_type") or "general").strip().lower()
    vat_special = str(arguments.get("vat_scheme") or "").strip().lower()
    sales = _money(arguments.get("sales") or 0, "sales")
    output_tax = _money(arguments.get("output_tax") or 0, "output_tax")
    input_tax = _money(arguments.get("input_tax") or 0, "input_tax")
    carryforward = _money(arguments.get("input_carryforward") or 0, "input_carryforward")
    profit = _money(arguments.get("profit") or 0, "profit")
    purchases = _money(arguments.get("purchases") or 0, "purchases")
    contracts = _money(arguments.get("stamp_base") or (sales + purchases), "stamp_base")
    wages = arguments.get("wages")
    # schema 声明 wages 为 JSON 字符串,但兼容模型直传数组(与 transactions 同一条容忍口径)
    if isinstance(wages, str) and wages.strip():
        try:
            wages = json.loads(wages)
        except (json.JSONDecodeError, TypeError) as exc:
            raise ValueError(f"wages 必须是工资表 JSON 数组或其字符串形态:{exc}") from None

    payable_vat = Decimal(0)
    vat_note = ""
    if taxpayer == "general":
        payable_vat = max(Decimal(0), output_tax - input_tax - carryforward)
        vat_note = "一般纳税人:应纳税额 = 销项 − 进项 − 上期留抵"
    elif taxpayer == "small":
        rate = Decimal(vat_special) if vat_special else Decimal("0.01")
        if rate not in (Decimal("0.01"), Decimal("0.03")):
            raise ValueError("小规模征收率仅支持 0.01(现行减按)或 0.03")
        sales_net = (sales / (Decimal(1) + rate)).quantize(Decimal("0.01"))
        threshold = _money(
            arguments.get("small_exemption_threshold") or 100000, "small_exemption_threshold"
        )
        if sales_net <= threshold:
            payable_vat = Decimal(0)
            vat_note = f"月销售额 ≤ {_q(threshold)}(未达起征点)免征"
        else:
            payable_vat = (sales_net * rate).quantize(Decimal("0.01"))
            vat_note = "小规模:应纳税额 = 不含税销售额 × 征收率"
    else:
        raise ValueError("taxpayer_type 必须是 general 或 small")

    sur_tax_rate = _money(arguments.get("city_rate") or 0, "city_rate")
    # Decimal(float) 会保留二进制原值(0.07 ⇒ 0.0699…)——缺省一律字符串构造,乘边界积分不差
    city = sur_tax_rate if sur_tax_rate != 0 else Decimal("0.07")
    edu = Decimal("0.03")
    local_edu = Decimal("0.02")
    half = bool(arguments.get("six_tax_half", taxpayer == "small"))
    city_pay = (payable_vat * city).quantize(Decimal("0.01"))
    edu_pay = (payable_vat * edu).quantize(Decimal("0.01"))
    local_pay = (payable_vat * local_edu).quantize(Decimal("0.01"))
    if half:
        city_pay, edu_pay, local_pay = (
            (v / 2).quantize(Decimal("0.01")) for v in (city_pay, edu_pay, local_pay)
        )
    sur_total = city_pay + edu_pay + local_pay

    stamp_rate = _rate(arguments.get("stamp_rate"), Decimal("0.0003"), "stamp_rate")
    stamp = (contracts * stamp_rate).quantize(Decimal("0.01"))

    cit_rate_input = arguments.get("cit_rate")
    small_cit = bool(arguments.get("small_micro_cit", taxpayer == "small"))
    if small_cit:
        cit_rate = Decimal("0.05")
        cit_note = "小型微利企业:实际税负 5%(所得额 ≤300 万等条件满足时)"
    elif cit_rate_input is not None:
        cit_rate = _rate(cit_rate_input, Decimal("0.25"), "cit_rate")
        cit_note = f"按参数税率 {(cit_rate * 100).normalize()}%"
    else:
        cit_rate = Decimal("0.25")
        cit_note = "一般企业 25%"
    citable = Decimal(str(arguments.get("taxable_income") or profit))
    loss_bf = _money(arguments.get("loss_carryforward") or 0, "loss_carryforward")
    citable = max(Decimal(0), citable - loss_bf)
    cit = (citable * cit_rate).quantize(Decimal("0.01"))

    iit_rows: list[_IIT] = []
    if isinstance(wages, list) and wages:
        if len(wages) > _MAX_TXN:
            raise ValueError(f"wages 数量超限(≤{_MAX_TXN} 条)")
        iit_rows = _iit_cumulative(wages)
    iit_total = sum((row.tax for row in iit_rows), Decimal(0))

    detail = {
        "period": state.get("period"),
        "taxpayer_type": taxpayer,
        "vat": {
            "payable": _q(payable_vat),
            "output": _q(output_tax),
            "input_used": _q(min(input_tax + carryforward, output_tax)),
            "note": vat_note,
        },
        "surtax": {
            "city": _q(city_pay),
            "education": _q(edu_pay),
            "local_education": _q(local_pay),
            "total": _q(sur_total),
            "note": "六税两费减半适用" if half else "未享受减半",
        },
        "stamp": {"amount": _q(stamp), "base": _q(contracts), "rate": str(stamp_rate)},
        "cit": {
            "amount": _q(cit),
            "taxable_income": _q(citable),
            "rate": str(cit_rate),
            "note": cit_note,
        },
        "iit": {
            "total": _q(iit_total),
            "employees": [
                {
                    "name": row.name,
                    "gross": _q(row.gross),
                    "social": _q(row.social),
                    "special": _q(row.special),
                    "withheld": _q(row.tax),
                }
                for row in iit_rows
            ],
            "method": "累计预扣法",
        },
        "grand_total": _q(payable_vat + sur_total + stamp + cit + iit_total),
        "disclaimer": "计税结果为草案;是否享受税收优惠以主管税务机关认定为准;本工具不代理对外申报。",
    }
    return detail


def _tax_filing(arguments: dict[str, Any]) -> dict[str, Any]:
    tool = "ai_tax_filing"
    try:
        if not isinstance(arguments, dict):
            return _fail(tool, "INVALID_ARGS", "arguments 必须为 dict")
        phase = str(arguments.get("phase") or "all").strip().lower()
        if phase not in _TAX_PHASES + ("all",):
            return _fail(tool, "INVALID_PHASE", f"phase 必须是 {list(_TAX_PHASES + ('all',))} 其一")
        # period 接受两个来源:入参(新任务)或 state(续跑)——缺一律显式拒绝,绝不猜
        loaded: dict[str, Any] = {}
        if arguments.get("state") is not None:
            try:
                loaded = _load_state(arguments, ("period",))
            except ValueError as exc:
                return _fail(tool, "INVALID_STATE", str(exc))
        raw_period = str(loaded.get("period") or arguments.get("period") or "").strip()
        try:
            period = _resolve_period({"period": raw_period})
        except ValueError as exc:
            return _fail(
                tool, "INVALID_INPUT", f"{exc};新任务须带 period,续跑须带含 period 的 state"
            )

        state: dict[str, Any] = dict(loaded)
        state["period"] = period

        chain: tuple[str, ...] = _TAX_PHASES if phase == "all" else (phase,)
        results: dict[str, Any] = {}
        detail: dict[str, Any] | None = None
        if phase == "all":
            current_index = len(_TAX_PHASES)
            next_name = None
        else:
            current_index = _TAX_PHASES.index(phase) + 1
            after = current_index
            next_name = _TAX_PHASES[after] if after < len(_TAX_PHASES) else None

        for step in chain:
            if step == "compute":
                try:
                    detail = _tax_compute(arguments, state)
                except ValueError as exc:
                    return _fail(tool, "INVALID_INPUT", str(exc))
                state["detail"] = detail
                results["compute"] = {
                    "grandTotal": detail["grand_total"],
                    "vat": detail["vat"]["payable"],
                    "cit": detail["cit"]["amount"],
                    "iit": detail["iit"]["total"],
                }
            elif step == "validate":
                detail = state.get("detail")
                if not detail:
                    # 单段直给取数键 ⇒ 就地 compute(与文案"同参数"一致);二者皆无才 MISSING_STATE
                    if _looks_like_compute_inputs(arguments):
                        try:
                            detail = _tax_compute(arguments, state)
                        except ValueError as exc:
                            return _fail(tool, "INVALID_INPUT", str(exc))
                        state["detail"] = detail
                    else:
                        return _fail(
                            tool, "MISSING_STATE", "validate 需要先 compute(带取数参数或传入 state)"
                        )
                findings = _tax_validate(detail, arguments)
                state["validation"] = findings
                results["validate"] = {
                    "blocks": len(findings),
                    "level": "warn" if findings else "pass",
                }
            elif step == "draft":
                detail = state.get("detail")
                if not detail:
                    # 与 validate 同一兜底口径:带取数参数就地在草案前补算一次
                    if _looks_like_compute_inputs(arguments):
                        try:
                            detail = _tax_compute(arguments, state)
                        except ValueError as exc:
                            return _fail(tool, "INVALID_INPUT", str(exc))
                        state["detail"] = detail
                    else:
                        return _fail(
                            tool, "MISSING_STATE", "draft 需要先 compute(带取数参数或传入 state)"
                        )
                validation = state.get("validation", [])
                try:
                    rel_path = _write_tax_draft(
                        period=period,
                        detail=detail,
                        validation=validation,
                        output_dir=arguments.get("output_dir"),
                    )
                except OSError as exc:
                    return _fail(tool, "DRAFT_WRITE_FAILED", f"申报表草案写入失败:{exc}")
                state["draft_path"] = rel_path
                results["draft"] = {"path": rel_path}

        bits = [f"期间 {period}"]
        if "compute" in results:
            bits.append(f"应纳税费合计 {results['compute']['grandTotal']}")
        if "validate" in results:
            bits.append(
                "勾稽校验通过"
                if results["validate"]["level"] == "pass"
                else f"勾稽校验 {results['validate']['blocks']} 项待复核"
            )
        if "draft" in results:
            bits.append(f"申报表草案 {state.get('draft_path')}")
        bits.append("正式申报须纳税主体与执业人员复核")
        return {
            "tool": tool,
            "ok": True,
            "message": ";".join(b for b in bits if b)
            + ("(可回传 state 续跑)" if next_name else "(全流程已完成)"),
            "progress": _progress(
                phase if phase != "all" else _TAX_PHASES[current_index - 1],
                current_index,
                len(_TAX_PHASES),
                next_name,
            ),
            "phaseResult": results,
            "state": json.dumps(state, ensure_ascii=False),
            "period": period,
        }
    except (ValueError, InvalidOperation) as exc:
        return _fail(tool, "COMPUTE_FAILED", str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.exception("[ai_tax_filing] 未预期异常")
        return _fail(tool, "UNEXPECTED", f"未预期异常:{exc}")


def _tax_validate(detail: dict[str, Any], arguments: dict[str, Any]) -> list[str]:
    """确定性勾稽校验:自洽性红旗逐条点名(只报数,不改数)。"""
    findings: list[str] = []
    vat = detail["vat"]
    payable = Decimal(vat["payable"])
    output = Decimal(vat["output"])
    if payable > output:
        findings.append("应纳增值税大于销项税额(进抵/留抵口径异常)")
    if payable < 0:
        findings.append("应纳增值税为负(须按留抵结转而非退税路径)")
    sur_total = Decimal(detail["surtax"]["total"])
    if payable == 0 and sur_total > 0:
        findings.append("增值税为零但附加税非零(勾稽不符)")
    citable = Decimal(detail["cit"]["taxable_income"])
    cit = Decimal(detail["cit"]["amount"])
    if citable == 0 and cit != 0:
        findings.append("应纳税所得额为零而所得税非零(勾稽不符)")
    stamp = Decimal(detail["stamp"]["amount"])
    if stamp <= 0:
        findings.append("印花税为零(核对合同基数或免税判断)")
    for emp in detail["iit"]["employees"]:
        if Decimal(emp["withheld"]) < 0:
            findings.append(f"员工 {emp['name']} 累计预扣出现负数(预扣口径需复核)")
    return findings


def _write_tax_draft(
    *,
    period: str,
    detail: dict[str, Any],
    validation: list[str],
    output_dir: Any,
) -> str:
    out_dir = _resolve_output_dir(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp_name = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
    file_path = out_dir / f"tax-filing-{period}-{stamp_name}.html"
    vat = detail["vat"]
    sur = detail["surtax"]
    stamp = detail["stamp"]
    cit = detail["cit"]
    iit = detail["iit"]
    iit_rows = (
        "\n".join(
            f"<tr><td>{html.escape(e['name'])}</td><td class='num'>{e['gross']}</td>"
            f"<td class='num'>{e['social']}</td><td class='num'>{e['special']}</td>"
            f"<td class='num'>{e['withheld']}</td></tr>"
            for e in iit.get("employees", [])
        )
        or "<tr><td colspan='5'>本期间未传入工资表</td></tr>"
    )
    checks = (
        "\n".join(f"<li>{html.escape(f)}</li>" for f in validation)
        if validation
        else "<li>勾稽校验无异常(以人工复核为最终口径)</li>"
    )
    doc = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>AI 一键报税 · {html.escape(period)} 申报表草案</title>
<style>
body {{ margin:0; padding:24px; font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif; color:#1f2328; background:#fff; }}
main {{ max-width:860px; margin:0 auto; }}
h1 {{ font-size:22px; margin:0 0 4px; }}
h2 {{ font-size:16px; margin:24px 0 6px; }}
table {{ width:100%; border-collapse:collapse; font-size:13px; }}
th,td {{ border:1px solid #d8dee4; padding:6px 8px; }}
.num {{ text-align:right; font-variant-numeric:tabular-nums; }}
.warn {{ background:#fff8c5; border:1px solid #d4a72c66; padding:10px 12px; }}
.total {{ font-weight:600; background:#f6f8fa; }}
ul {{ margin:0; padding-left:20px; }}
footer {{ margin-top:32px; color:#57606a; font-size:12px; }}
</style>
</head>
<body>
<main>
<h1>AI 一键报税 · {html.escape(period)} 申报表草案</h1>
<div class="warn">本表为 AI 生成的申报<b>草案</b>;正式申报须纳税主体与执业资格人员逐项复核后在电子税务局自行提交。{html.escape(str(detail.get("disclaimer", "")))}</div>
<h2>一、增值税</h2>
<table><tbody>
<tr><th>纳税人类型</th><td>{html.escape(str(detail.get("taxpayer_type", "")))}</td></tr>
<tr><th>销项税额</th><td class="num">{html.escape(vat["output"])}</td></tr>
<tr><th>进项(含留抵抵扣)</th><td class="num">{html.escape(vat["input_used"])}</td></tr>
<tr><th>应纳增值税</th><td class="num total">{html.escape(vat["payable"])}</td></tr>
</tbody></table>
<p>{html.escape(vat["note"])}</p>
<h2>二、附加税费</h2>
<table><tbody>
<tr><th>城市维护建设税 7%</th><td class="num">{html.escape(sur["city"])}</td></tr>
<tr><th>教育费附加 3%</th><td class="num">{html.escape(sur["education"])}</td></tr>
<tr><th>地方教育附加 2%</th><td class="num">{html.escape(sur["local_education"])}</td></tr>
<tr class="total"><th>附加合计</th><td class="num">{html.escape(sur["total"])}</td></tr>
</tbody></table>
<p>{html.escape(sur["note"])}</p>
<h2>三、印花税</h2>
<table><tbody>
<tr><th>计税依据(合同金额)</th><td class="num">{html.escape(stamp["base"])}</td></tr>
<tr><th>税率</th><td class="num">{html.escape(stamp["rate"])}</td></tr>
<tr><th>应纳税额</th><td class="num total">{html.escape(stamp["amount"])}</td></tr>
</tbody></table>
<h2>四、企业所得税(预缴)</h2>
<table><tbody>
<tr><th>应纳税所得额</th><td class="num">{html.escape(cit["taxable_income"])}</td></tr>
<tr><th>税率</th><td class="num">{html.escape(cit["rate"])}</td></tr>
<tr><th>预缴税额</th><td class="num total">{html.escape(cit["amount"])}</td></tr>
</tbody></table>
<p>{html.escape(cit["note"])}</p>
<h2>五、个人所得税(代扣代缴 · 累计预扣法)</h2>
<table><thead><tr><th>姓名</th><th>应发</th><th>社保公积金</th><th>专项附加</th><th>本期预扣</th></tr></thead>
<tbody>{iit_rows}</tbody></table>
<h2>六、勾稽校验</h2>
<ul>{checks}</ul>
<h2>本期税费合计</h2>
<table><tbody><tr class="total"><th>应纳税费(五税合计)</th><td class="num">{html.escape(str(detail.get("grand_total")))}</td></tr></tbody></table>
<footer>IHUI AI 财务部 · 一键报税 · 生成于 {datetime.now().strftime("%Y-%m-%d %H:%M")}</footer>
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
# 工具入口(LangChain 调用约定:async def handler(arguments) -> dict)
# ---------------------------------------------------------------------------


async def ai_bookkeeping(arguments: Any) -> dict[str, Any]:  # noqa: ARG001
    """一键代账:业务流水 → 分录 → 凭证 → 试算平衡 → 结账 → 报表产物(分阶段可续跑)。"""
    return _bookkeeping(
        {str(k): v for k, v in arguments.items()} if isinstance(arguments, dict) else {}
    )


#: 视为"就地可计税"的入参特征:validate/draft 单段调用允许直接带取数键而不必先拿 state
_COMPUTE_KEYS: tuple[str, ...] = (
    "taxpayer_type",
    "sales",
    "output_tax",
    "input_tax",
    "input_carryforward",
    "profit",
    "taxable_income",
    "wages",
)


def _looks_like_compute_inputs(arguments: dict[str, Any]) -> bool:
    return any(arguments.get(key) not in (None, "") for key in _COMPUTE_KEYS)


async def ai_tax_filing(arguments: Any) -> dict[str, Any]:  # noqa: ARG001
    """一键报税:取数 → 五项计提 → 勾稽校验 → 申报表草案(可续跑,不代理对外报送)。"""
    payload = arguments if isinstance(arguments, dict) else {}
    return _tax_filing(payload)


__all__ = [
    "AI_BOOKKEEPING_DESCRIPTION",
    "AI_TAX_FILING_DESCRIPTION",
    "ai_bookkeeping",
    "ai_tax_filing",
]

#: schema 描述(mcp_server 注册处共用,单一真相源,不在两处各写一遍)
AI_BOOKKEEPING_DESCRIPTION = (
    "AI 一键代账(财务部板块插件)。按阶段执行:phase=classify(流水→分录)、voucher(→记账凭证)、"
    "trial_balance(科目余额表+借贷试算)、close(损益结转至本年利润)、report(HTML 账务汇总产物)、"
    "all(串联全部)。period 形如 2026-11;transactions 为业务流水 JSON:每笔 "
    "{date,type(sales/purchase/salary/cost/rent/expense/tax_payment/receipt/payment/...),"
    "amount(字符串金额),method(bank/cash/credit/payable/advance/prepaid),tax_rate(0.13 等),"
    "invoice(special/general/none),counterparty,summary}。续阶段请回传上一次输出的 state JSON。"
    "返回带 progress(phaseIndex/of/next)与当前阶段 phaseResult。"
)
AI_TAX_FILING_DESCRIPTION = (
    "AI 一键报税(财务部板块插件)。按阶段执行:phase=compute(增值税一般/小规模、附加 7/3/2%"
    "六税两费减半可开关、印花税 0.03%、企业所得税一般 25%/小微 5%、个税累计预扣法)、"
    "validate(申报表勾稽校验)、draft(申报表草案 HTML 产物)、all(串联)。period 形如 2026-11;"
    "sales/output_tax/input_tax/input_carryforward/profit/taxable_income/loss_carryforward/"
    "purchases/stamp_base 为字符串金额;wages 为工资表 JSON;taxpayer_type=general|small;"
    "vat_scheme 小规模征收率 0.01 或 0.03。返回带 progress 与 state(可续跑)。"
    "**红线**:产物为草案,正式申报须纳税主体与执业资格人员复核后在电子税务局自行提交;"
    "本工具不代理对外申报、不写外部系统。"
)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
