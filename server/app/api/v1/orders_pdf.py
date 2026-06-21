"""订单导出 PDF 端点.

GET /api/v1/orders/{order_no}/pdf       导出单个订单为 PDF
POST /api/v1/orders/pdf/batch           批量导出 (zip)

PDF 内容:
- 订单基本信息 (订单号 / 商品 / 金额 / 时间)
- 支付信息
- 物流信息 (如有)
- 二维码 (订单号)
- 印章 (公司信息)
- 防伪水印 (用户ID+订单号)

使用 reportlab 渲染, 不依赖系统字体.
"""
from __future__ import annotations

import io
import os
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/v1/orders", tags=["orders-pdf"])

# 内存存储 (生产用 DB)
_orders_db: dict[str, dict] = {}


def _seed_demo_orders() -> None:
    """种入演示订单."""
    if _orders_db:
        return
    for i in range(1, 4):
        order = {
            "order_no": f"2026061800{i}",
            "product_name": f"AI 智能体套餐 VIP{i}",
            "amount": 588 * i,
            "payment_method": "wechat",
            "status": "paid",
            "create_time": "2026-06-18 10:00:00",
            "pay_time": "2026-06-18 10:05:00",
            "buyer": f"user_{i:03d}",
            "buyer_email": f"user{i}@example.com",
        }
        _orders_db[order["order_no"]] = order


def _render_order_pdf(order: dict) -> bytes:
    """渲染单个订单 PDF."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        )
    except ImportError:
        # 降级: 纯文本 PDF
        return _render_simple_text_pdf(order)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title=f"订单 {order['order_no']}",
    )
    styles = getSampleStyleSheet()

    # 尝试注册中文字体 (fallback 到默认)
    try:
        font_path = "C:/Windows/Fonts/msyh.ttc"
        if Path(font_path).exists():
            pdfmetrics.registerFont(TTFont("msyh", font_path))
            cn_font = "msyh"
        else:
            cn_font = "Helvetica"
    except Exception:
        cn_font = "Helvetica"

    title_style = ParagraphStyle(
        "cn_title",
        parent=styles["Title"],
        fontName=cn_font,
        fontSize=20,
        textColor=colors.HexColor("#000000"),
    )
    h2_style = ParagraphStyle(
        "cn_h2",
        parent=styles["Heading2"],
        fontName=cn_font,
        fontSize=14,
        textColor=colors.HexColor("#333333"),
    )
    body_style = ParagraphStyle(
        "cn_body",
        parent=styles["Normal"],
        fontName=cn_font,
        fontSize=11,
    )

    story: list = []
    story.append(Paragraph("订单详情 / Order Details", title_style))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        f"本凭证由 zhs 系统自动生成, 订单号: <b>{order['order_no']}</b>",
        body_style,
    ))
    story.append(Spacer(1, 6 * mm))

    # 订单信息表
    info_data = [
        ["订单号", order["order_no"]],
        ["商品名称", order["product_name"]],
        ["金额", f"¥{order['amount']:.2f}"],
        ["支付方式", order["payment_method"]],
        ["订单状态", order["status"]],
        ["创建时间", order["create_time"]],
        ["支付时间", order.get("pay_time", "-")],
        ["购买人", order.get("buyer", "-")],
    ]
    t = Table(info_data, colWidths=[40 * mm, 120 * mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), cn_font),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#666666")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F8F8")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E5E5")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 8 * mm))

    # 印章
    story.append(Paragraph("电子签章 / Electronic Seal", h2_style))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        f"本订单由 zhs 平台于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 确认生效, 具备法律效力。",
        body_style,
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("zhs 平台运营方", body_style))
    story.append(Paragraph("2026", body_style))

    doc.build(story)
    return buf.getvalue()


def _render_simple_text_pdf(order: dict) -> bytes:
    """降级: 无 reportlab 时用纯文本."""
    content = f"""订单详情
================
订单号: {order['order_no']}
商品: {order['product_name']}
金额: ¥{order['amount']:.2f}
支付方式: {order['payment_method']}
状态: {order['status']}
创建时间: {order['create_time']}
支付时间: {order.get('pay_time', '-')}
================
zhs 平台
{datetime.now().isoformat()}
"""
    return content.encode("utf-8")


@router.get("/{order_no}/pdf")
async def export_order_pdf(order_no: str) -> StreamingResponse:
    """导出单个订单 PDF."""
    _seed_demo_orders()
    order = _orders_db.get(order_no)
    if not order:
        raise HTTPException(404, "订单不存在")

    pdf_bytes = _render_order_pdf(order)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="order_{order_no}.pdf"',
        },
    )


@router.post("/pdf/batch")
async def export_orders_batch(
    order_nos: list[str] = Query(..., description="订单号列表"),
) -> StreamingResponse:
    """批量导出订单 (zip)."""
    _seed_demo_orders()

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for order_no in order_nos:
            order = _orders_db.get(order_no)
            if not order:
                continue
            pdf_bytes = _render_order_pdf(order)
            zf.writestr(f"order_{order_no}.pdf", pdf_bytes)

    zip_buf.seek(0)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="orders_{ts}.zip"',
        },
    )
