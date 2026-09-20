# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""教育食堂采购小票 AI 三轮核对路由(2026-09-19 立)。

挂载到 main.py, prefix=/api/edu-canteen-receipt, tags=["edu-canteen-receipt"]。
配合 packages/database/src/schema/edu-canteen.ts 的 CanteenAiVerification 流水线:

- POST /extract    第1轮:小票图 → 结构化抽取(供应商/日期/单号/总额/明细行)
- POST /verify     第2轮:独立重识别(不看第1轮结果,防锚定) + 程序化数学自检
                   + 程序字段级 diff + LLM 语义比对 → 差异清单
- POST /arbitrate  第3轮:带图 + 两轮结果 + 差异清单 → 逐项裁决,产出最终台账数据

每端点返回与 TS 侧 CanteenAiVerification 接口对齐的一轮完整记录:
{round, type, model, at, receipt, checks, differences, confidence, ok, error}
外加扩展字段(verify: agreement/preferred;arbitrate: resolutions),由 Node API 层
存入 edu_canteen_procurement.ai_verifications jsonb,前端渲染核对报告。

图片来源复用 services/vision_helper 的三种形态(data URI / URL / 本地路径);
vision 调用 model=None 走 llm_gateway auto 路由(自动选择多模态可用模型),
纯文本比对用 stepfun/step-3.7-flash + response_format json_object。
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..core.llm_gateway import llm_gateway
from ..services.ai_tutor import _extract_json, _repair_escapes
from ..services.vision_helper import (
    download_image,
    encode_base64,
    is_data_uri,
    is_local_path,
    is_url,
    read_local_image,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/edu-canteen-receipt", tags=["edu-canteen-receipt"])

# 纯文本比对用非推理模型(JSON 输出干净);vision 调用传 None 走 auto 路由
_DEFAULT_MODEL: str | None = "stepfun/step-3.7-flash"

_ITEM_CATEGORIES = "蔬菜/肉禽蛋/水产/水果/粮油米面/调味品/冻品/干货/其他"

# 全角数字/句点 → 半角
_FW_TRANS = str.maketrans("０１２３４５６７８９．，", "0123456789.,")

# 数值容差:行内乘法自检
_ROW_TOL = 0.05
# 数值容差:合计 vs 总额(绝对 0.01 或总额的 0.2%)
_TOTAL_ABS_TOL = 0.01
_TOTAL_RATE_TOL = 0.002


# ---------------------------------------------------------------------------
# Pydantic 请求模型
# ---------------------------------------------------------------------------


class ReceiptItemIn(BaseModel):
    """AI 抽取的明细行输入(verify/arbitrate 回传上轮结果用)。"""

    name: str = ""
    category: str | None = None
    quantity: float | None = None
    unit: str | None = None
    unitPrice: float | None = None
    amount: float | None = None


class ReceiptDataIn(BaseModel):
    """AI 抽取的小票结构(verify/arbitrate 回传上轮结果用)。"""

    supplierName: str | None = None
    receiptDate: str | None = None
    receiptNo: str | None = None
    totalAmount: float | None = None
    items: list[ReceiptItemIn] = Field(default_factory=list)


class DifferenceIn(BaseModel):
    """轮次间字段级差异(arbitrate 回传 verify 轮差异清单用)。"""

    field: str
    previous: str
    current: str
    resolution: str | None = None


class ExtractRequest(BaseModel):
    """第1轮抽取请求。"""

    image: str = Field(..., min_length=16, description="小票图片(data URI / URL / 本地路径)")
    hint: str | None = Field(None, description="补充提示(如'这是蔬菜配送单',影响类别判断)")


class VerifyRequest(BaseModel):
    """第2轮交叉核对请求。"""

    image: str = Field(..., min_length=16, description="小票图片(与第1轮同图)")
    first: ReceiptDataIn = Field(..., description="第1轮抽取结果(仅在比对阶段使用,不参与重识别)")
    hint: str | None = None


class ArbitrateRequest(BaseModel):
    """第3轮差异仲裁请求。"""

    image: str = Field(..., min_length=16, description="小票图片(仲裁时再次看图定值)")
    round1: ReceiptDataIn = Field(..., description="第1轮结果")
    round2: ReceiptDataIn = Field(..., description="第2轮结果")
    differences: list[DifferenceIn] = Field(default_factory=list, description="第2轮产出的差异清单")


# ---------------------------------------------------------------------------
# 数值解析与归一化(中文小票场景容错)
# ---------------------------------------------------------------------------


def _parse_number(v: Any) -> float | None:
    """把 LLM 输出的数字安全转 float。

    兼容: "¥12.50" / "12.5元" / "1,234.56" / 全角"１２３" / "3斤" 等脏值。
    解析失败返回 None。
    """
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().translate(_FW_TRANS)
    # 去掉货币符号与单位后缀
    for ch in "¥￥$,，元":
        s = s.replace(ch, "")
    # 截断常见单位尾巴(kg/斤/份/箱/个/袋/瓶...)
    for suffix in ("kg", "KG", "Kg", "斤", "份", "箱", "个", "袋", "瓶", "桶", "包"):
        if s.endswith(suffix) and len(s) > len(suffix):
            s = s[: -len(suffix)]
            break
    s = s.strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _clean_str(v: Any, max_len: int = 200) -> str | None:
    """字符串清洗:None/空串 → None;去首尾空白 + 截断。"""
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() in ("null", "none", "undefined", "n/a", "无"):
        return None
    return s[:max_len]


def _norm_receipt(parsed: dict[str, Any]) -> dict[str, Any]:
    """把 LLM JSON 归一化为标准 receipt 结构(与 TS CanteenReceiptData 对齐)。"""
    raw_items = parsed.get("items")
    if not isinstance(raw_items, list):
        raw_items = []
    items: list[dict[str, Any]] = []
    for it in raw_items:
        if not isinstance(it, dict):
            continue
        name = _clean_str(it.get("name") or it.get("itemName") or it.get("品名"))
        if not name:
            continue  # 无品名的行丢弃
        items.append(
            {
                "name": name,
                "category": _clean_str(it.get("category"), 50),
                "quantity": _parse_number(it.get("quantity")),
                "unit": _clean_str(it.get("unit"), 20),
                "unitPrice": _parse_number(it.get("unitPrice") or it.get("price")),
                "amount": _parse_number(it.get("amount") or it.get("subtotal") or it.get("total")),
            }
        )
    receipt_date = _clean_str(parsed.get("receiptDate") or parsed.get("date"), 10)
    # 日期规整:仅保留 YYYY-MM-DD(截掉时间部分)
    if receipt_date:
        receipt_date = receipt_date.replace("年", "-").replace("月", "-").replace("日", "").split(" ")[0]
        parts = receipt_date.split("-")
        if len(parts) >= 3:
            try:
                receipt_date = f"{int(parts[0]):04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"
            except ValueError:
                pass
    return {
        "supplierName": _clean_str(parsed.get("supplierName") or parsed.get("supplier"), 200),
        "receiptDate": receipt_date,
        "receiptNo": _clean_str(parsed.get("receiptNo") or parsed.get("receiptNumber") or parsed.get("no"), 100),
        "totalAmount": _parse_number(parsed.get("totalAmount") or parsed.get("total")),
        "items": items,
    }


# ---------------------------------------------------------------------------
# 程序化数学自检(不依赖 LLM)
# ---------------------------------------------------------------------------


def _math_checks(receipt: dict[str, Any]) -> list[dict[str, Any]]:
    """对 receipt 做确定性校验,返回 checks 列表({name, passed, detail})。"""
    checks: list[dict[str, Any]] = []

    items = receipt.get("items") or []
    checks.append(
        {
            "name": "明细非空",
            "passed": len(items) > 0,
            "detail": f"识别到 {len(items)} 个明细行" if items else "未识别到任何明细行",
        }
    )

    # 行内自洽:数量 × 单价 ≈ 小计
    row_bad: list[int] = []
    row_checked = 0
    for idx, it in enumerate(items):
        q, p, a = it.get("quantity"), it.get("unitPrice"), it.get("amount")
        if q is None or p is None or a is None:
            continue
        row_checked += 1
        expected = round(q * p, 2)
        if abs(expected - round(a, 2)) > _ROW_TOL:
            row_bad.append(idx + 1)
    checks.append(
        {
            "name": "行内数量×单价=小计",
            "passed": not row_bad,
            "detail": (
                f"检查 {row_checked} 行,全部通过"
                if not row_bad
                else (f"第 {','.join(map(str, row_bad))} 行数量×单价与小计不符(容差±{_ROW_TOL}元)")
            ),
        }
    )

    # 合计自洽:明细之和 ≈ 总额
    total = receipt.get("totalAmount")
    amounts = [it.get("amount") for it in items if it.get("amount") is not None]
    if total is None:
        checks.append({"name": "总额已识别", "passed": False, "detail": "小票总额未能识别"})
    elif amounts:
        s = round(sum(amounts), 2)
        tol = max(_TOTAL_ABS_TOL, abs(total) * _TOTAL_RATE_TOL)
        ok = abs(s - round(total, 2)) <= tol
        # 明细缺失时(部分行无小计)不做硬失败,只提示
        checks.append(
            {
                "name": "明细合计=总额",
                "passed": ok,
                "detail": (
                    f"明细合计 {s:.2f} 元 ≈ 总额 {total:.2f} 元(容差±{tol:.2f})"
                    if ok
                    else f"明细合计 {s:.2f} 元 ≠ 总额 {total:.2f} 元,超出容差±{tol:.2f}"
                ),
            }
        )
    else:
        checks.append({"name": "明细合计=总额", "passed": False, "detail": "明细行均无小计,无法合计校验"})

    # 日期合法
    d = receipt.get("receiptDate")
    date_ok = False
    if d:
        try:
            datetime.strptime(d, "%Y-%m-%d")
            date_ok = True
        except ValueError:
            date_ok = False
    checks.append(
        {
            "name": "日期格式合法",
            "passed": date_ok,
            "detail": f"采购日期 {d}" if date_ok else (f"日期 '{d}' 无法解析为 YYYY-MM-DD" if d else "未识别到日期"),
        }
    )

    # 金额非负
    neg = [i + 1 for i, it in enumerate(items) if (it.get("amount") or 0) < 0 or (it.get("unitPrice") or 0) < 0]
    checks.append(
        {
            "name": "金额非负",
            "passed": not neg,
            "detail": "全部金额非负" if not neg else f"第 {','.join(map(str, neg))} 行出现负数金额",
        }
    )
    return checks


def _checks_confidence(checks: list[dict[str, Any]], receipt: dict[str, Any]) -> int:
    """由自检通过率 + 字段完整度估算置信度(0-100)。"""
    passed = sum(1 for c in checks if c.get("passed"))
    score = 40 + int(40 * passed / max(1, len(checks)))
    items = receipt.get("items") or []
    if items:
        complete = sum(
            1
            for it in items
            if it.get("quantity") is not None and it.get("unitPrice") is not None and it.get("amount") is not None
        )
        score += int(15 * complete / len(items))
    if receipt.get("supplierName"):
        score += 3
    if receipt.get("receiptNo"):
        score += 2
    return max(0, min(100, score))


# ---------------------------------------------------------------------------
# 程序化字段级 diff(verify 轮)
# ---------------------------------------------------------------------------


def _fmt(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, float):
        return f"{v:.2f}".rstrip("0").rstrip(".") if v != int(v) else str(int(v))
    return str(v)


def _num_eq(a: float | None, b: float | None, tol: float = _TOTAL_ABS_TOL) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return abs(a - b) <= tol


def _program_diff(a: dict[str, Any], b: dict[str, Any]) -> list[dict[str, Any]]:
    """两次识别结果的确定性字段级比对(数值容差 0.01)。"""
    diffs: list[dict[str, Any]] = []
    for f in ("supplierName", "receiptDate", "receiptNo"):
        va, vb = _clean_str(a.get(f)), _clean_str(b.get(f))
        if va != vb:
            diffs.append({"field": f, "previous": va or "", "current": vb or "", "resolution": None})
    if not _num_eq(a.get("totalAmount"), b.get("totalAmount")):
        diffs.append(
            {
                "field": "totalAmount",
                "previous": _fmt(a.get("totalAmount")),
                "current": _fmt(b.get("totalAmount")),
                "resolution": None,
            }
        )
    ia, ib = a.get("items") or [], b.get("items") or []
    if len(ia) != len(ib):
        diffs.append({"field": "items.count", "previous": str(len(ia)), "current": str(len(ib)), "resolution": None})
    for i in range(min(len(ia), len(ib))):
        ra, rb = ia[i], ib[i]
        row: str = f"items[{i}]"
        if (_clean_str(ra.get("name")) or "") != (_clean_str(rb.get("name")) or ""):
            diffs.append(
                {
                    "field": f"{row}.name",
                    "previous": ra.get("name") or "",
                    "current": rb.get("name") or "",
                    "resolution": None,
                }
            )
        for f, label in (("quantity", "quantity"), ("unitPrice", "unitPrice"), ("amount", "amount")):
            if not _num_eq(ra.get(f), rb.get(f)):
                diffs.append(
                    {
                        "field": f"{row}.{label}",
                        "previous": _fmt(ra.get(f)),
                        "current": _fmt(rb.get(f)),
                        "resolution": None,
                    }
                )
    return diffs


def _agreement(a: dict[str, Any], b: dict[str, Any]) -> float:
    """一致率 = 相同字段数 / 总比较字段数(0-1)。"""
    total = 4  # supplierName/receiptDate/receiptNo/totalAmount
    same = sum(
        1
        for f in ("supplierName", "receiptDate", "receiptNo")
        if (_clean_str(a.get(f)) or "") == (_clean_str(b.get(f)) or "")
    ) + (1 if _num_eq(a.get("totalAmount"), b.get("totalAmount")) else 0)
    ia, ib = a.get("items") or [], b.get("items") or []
    for i in range(min(len(ia), len(ib))):
        total += 4
        ra, rb = ia[i], ib[i]
        same += 1 if (_clean_str(ra.get("name")) or "") == (_clean_str(rb.get("name")) or "") else 0
        same += sum(1 for f in ("quantity", "unitPrice", "amount") if _num_eq(ra.get(f), rb.get(f)))
    total += abs(len(ia) - len(ib))  # 条数差异按每行 1 计
    if total == 0:
        return 0.0
    return same / total


# ---------------------------------------------------------------------------
# LLM 调用封装
# ---------------------------------------------------------------------------


async def _resolve_image_data_uri(image_source: str) -> tuple[str | None, str | None]:
    """图片来源 → base64 data URI。成功返回 (data_uri, None),失败返回 (None, error)。"""
    if is_data_uri(image_source):
        return image_source, None
    if is_url(image_source):
        try:
            data, mime = await download_image(image_source)
        except Exception as e:  # noqa: BLE001
            return None, f"下载图片失败: {type(e).__name__}: {str(e)[:150]}"
        return encode_base64(data, mime), None
    if is_local_path(image_source):
        try:
            data, mime = read_local_image(image_source)
        except (FileNotFoundError, ValueError, OSError) as e:
            return None, f"读取本地图片失败: {e}"
        return encode_base64(data, mime), None
    return None, "无法识别的图片来源(支持 data URI / http(s) URL / 本地路径)"


_EXTRACT_SYSTEM = (
    "你是食堂采购小票识别专家。请仔细逐字识别图片中的小票/配送单/收据,"
    "严格按以下 JSON 结构输出,不要输出 JSON 以外的任何内容:\n"
    "{\n"
    '  "supplierName": "供应商/商户名称(字符串,没有则 null)",\n'
    '  "receiptDate": "小票日期 YYYY-MM-DD(没有则 null)",\n'
    '  "receiptNo": "单号(字符串,没有则 null)",\n'
    '  "totalAmount": "总金额(数字,没有则 null)",\n'
    '  "items": [\n'
    '    {"name": "品名", "category": "类别", "quantity": "数量(数字)", '
    '"unit": "单位(kg/斤/份/箱等)", "unitPrice": "单价(数字)", "amount": "小计金额(数字)"}\n'
    "  ]\n"
    "}\n"
    f"类别必须从以下枚举中选择: {_ITEM_CATEGORIES}。\n"
    "注意:\n"
    "1. 数字必须是纯数字(可含小数点),不要带 ¥/元/逗号等符号。\n"
    "2. 每一行商品对应一个 items 元素,顺序与图片一致;模糊不清的字段填 null,不要编造。\n"
    "3. 金额保留小数点后两位语义(如 12.5);数量保留原始精度(如 2.5)。\n"
    "4. 若图片不是小票/单据,输出 {\"totalAmount\": null, \"items\": []} 并置 supplierName 为 null。"
)

_VERIFY_SYSTEM = (
    "你是小票核对专家。现有同一张小票的两轮独立识别结果,请比对它们:\n"
    "1. 逐字段比较(供应商/日期/单号/总额/每一行明细的品名、数量、单价、小计)。\n"
    "2. 特别注意语义等价但字面不同的情况(如'土豆'与'马铃薯'是同一物品,"
    "'大白菜'与'白菜'视为相同),这类不算差异。\n"
    "3. 数字比较容差为 0.01,超出才算差异。\n"
    "严格输出 JSON,不要输出其他内容:\n"
    "{\n"
    '  "differences": [{"field": "字段路径(如 items[2].unitPrice)", '
    '"previous": "第1轮值", "current": "第2轮值", "reason": "差异说明(中文,简短)"}],\n'
    '  "preferred": "round1 或 round2 或 none(哪一轮整体更可信)",\n'
    '  "reason": "判断依据(中文,1-2 句)"\n'
    "}"
)


def _arbitrate_system(n_diff: int) -> str:
    return (
        "你是小票终审专家。同一张小票经两轮识别,存在以下字段差异需要你重新仔细看图裁决:\n"
        "对每一处差异,重新观察图片中对应区域的原始内容,给出最终采纳值。\n"
        "严格输出 JSON,不要输出其他内容:\n"
        "{\n"
        '  "final": {完整的小票结构, 字段同识别轮: supplierName/receiptDate/receiptNo/'
        "totalAmount/items[{name,category,quantity,unit,unitPrice,amount}]},\n"
        '  "resolutions": [{"field": "差异字段路径", "adopted": "最终采纳值", '
        '"fromRound": 1 或 2, "reason": "采纳理由(中文,简短)"}],\n'
        '  "confidence": 0\n'
        "}\n"
        f"要求 resolutions 必须覆盖全部 {n_diff} 处差异;final 为裁决后的完整结构"
        "(未涉差异的字段沿用更可信的一轮);confidence 为 0-100 整数,表示你对最终结果的把握。"
    )


async def _vision_receipt(
    data_uri: str,
    system: str,
    user_text: str,
    temperature: float,
) -> tuple[dict[str, Any] | None, str | None, str]:
    """vision 调用 + JSON 容错解析,返回 (parsed_dict, error, model)。

    JSON 解析失败自动重试一次(温度 +0.2),仍失败则返回 error。
    """
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": user_text},
                {"type": "image_url", "image_url": {"url": data_uri}},
            ],
        },
    ]
    last_err = ""
    model = ""
    for attempt in range(2):
        try:
            result = await llm_gateway.complete(
                messages,
                model=None,  # auto 路由:网关按多模态可用性选模型
                temperature=temperature + 0.2 * attempt,
                max_tokens=4000,
            )
        except Exception as e:  # noqa: BLE001
            last_err = f"{type(e).__name__}: {str(e)[:200]}"
            continue
        model = result.get("model", "") or model
        if result.get("error"):
            last_err = str(result.get("error_message") or result.get("error"))[:200]
            continue
        content = result.get("content", "") or ""
        if "\\" in content:
            content = _repair_escapes(content)
        try:
            parsed = _extract_json(content)
        except (json.JSONDecodeError, ValueError) as e:
            last_err = f"JSON 解析失败: {e}"
            logger.warning("edu_canteen_receipt JSON 解析失败: %s; content=%s", e, content[:200])
            continue
        if isinstance(parsed, dict):
            return parsed, None, model
        last_err = "LLM 输出非 JSON 对象"
    return None, last_err, model


async def _text_json(system: str, user_text: str) -> tuple[dict[str, Any] | None, str | None]:
    """纯文本 LLM 调用(step-3.7-flash + json_object),返回 (parsed, error)。"""
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_text},
    ]
    try:
        result = await llm_gateway.complete(
            messages,
            model=_DEFAULT_MODEL,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
    except Exception as e:  # noqa: BLE001
        return None, f"{type(e).__name__}: {str(e)[:200]}"
    if result.get("error"):
        return None, str(result.get("error_message") or result.get("error"))[:200]
    content = result.get("content", "") or ""
    if "\\" in content:
        content = _repair_escapes(content)
    try:
        parsed = _extract_json(content)
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("edu_canteen_receipt 文本比对 JSON 解析失败: %s; content=%s", e, content[:200])
        return None, f"JSON 解析失败: {e}"
    if not isinstance(parsed, dict):
        return None, "LLM 输出非 JSON 对象"
    return parsed, None


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _verification(
    round_no: int,
    vtype: str,
    model: str,
    receipt: dict[str, Any] | None,
    checks: list[dict[str, Any]],
    differences: list[dict[str, Any]],
    confidence: int,
    ok: bool,
    error: str | None,
) -> dict[str, Any]:
    """构造与 TS CanteenAiVerification 对齐的一轮记录。"""
    return {
        "round": round_no,
        "type": vtype,
        "model": model,
        "at": _now_iso(),
        "receipt": receipt,
        "checks": checks,
        "differences": differences,
        "confidence": confidence,
        "ok": ok,
        "error": error,
    }


def _extract_user_text(hint: str | None) -> str:
    text = "请识别这张食堂采购小票并输出 JSON。"
    if hint:
        text += f"\n补充提示: {hint}"
    return text


# ---------------------------------------------------------------------------
# 端点 1:第1轮结构化抽取
# ---------------------------------------------------------------------------


@router.post("/extract")
async def extract(req: ExtractRequest) -> dict[str, Any]:
    """第1轮:小票图 → 结构化抽取 + 数学自检。

    返回 {ok, verification, error}。verification 与 TS CanteenAiVerification 对齐。
    """
    data_uri, img_err = await _resolve_image_data_uri(req.image)
    if not data_uri:
        return {"ok": False, "verification": None, "error": img_err}

    parsed, llm_err, model = await _vision_receipt(
        data_uri, _EXTRACT_SYSTEM, _extract_user_text(req.hint), temperature=0.1
    )
    if parsed is None:
        return {
            "ok": False,
            "verification": _verification(1, "extract", model, None, [], [], 0, False, llm_err),
            "error": llm_err,
        }
    receipt = _norm_receipt(parsed)
    checks = _math_checks(receipt)
    confidence = _checks_confidence(checks, receipt)
    ok = bool(receipt.get("items")) and all(c["passed"] for c in checks[:1])  # 明细非空即可入待核对态
    return {
        "ok": True,
        "verification": _verification(1, "extract", model, receipt, checks, [], confidence, ok, None),
        "error": None,
    }


# ---------------------------------------------------------------------------
# 端点 2:第2轮独立交叉核对
# ---------------------------------------------------------------------------


@router.post("/verify")
async def verify(req: VerifyRequest) -> dict[str, Any]:
    """第2轮:独立重识别 + 数学自检 + 程序 diff + LLM 语义比对。

    返回 {ok, verification, agreement, preferred, error}。
    两轮一致(无差异)时 verification.ok=True → Node 侧置 ai_verified;
    存在差异时 ok=False → ai_conflict,需第3轮仲裁或人工修改。
    """
    data_uri, img_err = await _resolve_image_data_uri(req.image)
    if not data_uri:
        return {"ok": False, "verification": None, "agreement": 0.0, "preferred": "none", "error": img_err}

    # 独立重识别:不把第1轮结果喂给模型(防锚定),温度 0.0 尽量确定
    parsed, llm_err, model = await _vision_receipt(
        data_uri, _EXTRACT_SYSTEM, _extract_user_text(req.hint), temperature=0.0
    )
    if parsed is None:
        return {
            "ok": False,
            "verification": _verification(2, "verify", model, None, [], [], 0, False, llm_err),
            "agreement": 0.0,
            "preferred": "none",
            "error": llm_err,
        }
    receipt = _norm_receipt(parsed)
    checks = _math_checks(receipt)

    first = req.first.model_dump()
    # 程序化字段级 diff(确定性)
    diffs = _program_diff(first, receipt)
    # LLM 语义比对(捕捉语义等价/程序 diff 之外的差异)
    preferred = "none"
    cmp_parsed, cmp_err = await _text_json(
        _VERIFY_SYSTEM,
        f"第1轮识别结果:\n{json.dumps(first, ensure_ascii=False)}\n\n第2轮识别结果:\n{json.dumps(receipt, ensure_ascii=False)}",
    )
    if cmp_parsed is not None:
        preferred = str(cmp_parsed.get("preferred") or "none")
        seen_fields = {d["field"] for d in diffs}
        for d in cmp_parsed.get("differences") or []:
            if not isinstance(d, dict):
                continue
            field = _clean_str(d.get("field"))
            if not field or field in seen_fields:
                continue
            diffs.append(
                {
                    "field": field,
                    "previous": _clean_str(d.get("previous")) or "",
                    "current": _clean_str(d.get("current")) or "",
                    "resolution": _clean_str(d.get("reason"), 300),
                }
            )
            seen_fields.add(field)

    agreement = _agreement(first, receipt)
    # 一致率 + 自检通过率 → 置信度
    confidence = max(0, min(100, int(30 + agreement * 50 + 20 * sum(1 for c in checks if c["passed"]) / max(1, len(checks)))))
    ok = not diffs
    return {
        "ok": ok,
        "verification": _verification(2, "verify", model, receipt, checks, diffs, confidence, ok, cmp_err),
        "agreement": round(agreement, 4),
        "preferred": preferred,
        "error": None,
    }


# ---------------------------------------------------------------------------
# 端点 3:第3轮差异仲裁
# ---------------------------------------------------------------------------


@router.post("/arbitrate")
async def arbitrate(req: ArbitrateRequest) -> dict[str, Any]:
    """第3轮:带图裁决每处差异,产出最终台账数据。

    返回 {ok, verification, resolutions, error}。resolutions 为逐差异裁决结论,
    verification.receipt 为最终采纳结构(未涉差异字段沿用更可信一轮)。
    """
    data_uri, img_err = await _resolve_image_data_uri(req.image)
    if not data_uri:
        return {"ok": False, "verification": None, "resolutions": [], "error": img_err}

    round1 = req.round1.model_dump()
    round2 = req.round2.model_dump()
    diffs = [d.model_dump() for d in req.differences]

    user_text = (
        "第1轮识别结果:\n"
        f"{json.dumps(round1, ensure_ascii=False)}\n\n"
        "第2轮识别结果:\n"
        f"{json.dumps(round2, ensure_ascii=False)}\n\n"
        "待裁决差异清单:\n"
        f"{json.dumps(diffs, ensure_ascii=False)}\n\n"
        "请重新仔细观察图片,对每处差异给出最终采纳值。"
    )
    parsed, llm_err, model = await _vision_receipt(
        data_uri, _arbitrate_system(len(diffs)), user_text, temperature=0.0
    )
    if parsed is None:
        return {
            "ok": False,
            "verification": _verification(3, "arbitrate", model, None, [], diffs, 0, False, llm_err),
            "resolutions": [],
            "error": llm_err,
        }

    final_receipt = _norm_receipt(parsed.get("final") or {})
    # 差异清单回填 resolution
    resolutions: list[dict[str, Any]] = []
    res_map: dict[str, dict[str, Any]] = {}
    for r in parsed.get("resolutions") or []:
        if not isinstance(r, dict):
            continue
        field = _clean_str(r.get("field"))
        if not field:
            continue
        entry = {
            "field": field,
            "adopted": _clean_str(r.get("adopted")) or "",
            "fromRound": r.get("fromRound"),
            "reason": _clean_str(r.get("reason"), 300) or "",
        }
        res_map[field] = entry
        resolutions.append(entry)
    for d in diffs:
        matched = res_map.get(d.get("field") or "")
        if matched:
            d["resolution"] = f"采纳第{matched.get('fromRound')}轮值「{matched.get('adopted')}」:{matched.get('reason')}"
        else:
            d["resolution"] = None

    checks = _math_checks(final_receipt)
    raw_conf = _parse_number(parsed.get("confidence"))
    llm_conf = int(raw_conf) if raw_conf is not None else 0
    # 置信度 = LLM 自评(60%) + 数学自检(40%),全有 resolution 时才可 ok
    checks_score = int(100 * sum(1 for c in checks if c["passed"]) / max(1, len(checks)))
    confidence = max(0, min(100, int(llm_conf * 0.6 + checks_score * 0.4)))
    ok = bool(final_receipt.get("items")) and all(d.get("resolution") for d in diffs)
    return {
        "ok": ok,
        "verification": _verification(3, "arbitrate", model, final_receipt, checks, diffs, confidence, ok, None),
        "resolutions": resolutions,
        "error": None,
    }


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
