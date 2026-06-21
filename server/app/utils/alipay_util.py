"""Alipay utilities (RSA2 签名/验签 + 通用下单)."""

import base64
import json
import time
import uuid
from urllib.parse import quote_plus

import httpx
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from loguru import logger

from app.config import settings


def _load_alipay_private_key() -> str:
    """读取应用私钥(PEM 字符串)."""
    try:
        with open(settings.ALIPAY_PRIVATE_KEY_PATH, encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        logger.warning(f"Load Alipay private key failed: {e}")
        return ""


def _load_alipay_public_key() -> str:
    """读取支付宝公钥(PEM 字符串)."""
    try:
        with open(settings.ALIPAY_PUBLIC_KEY_PATH, encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        logger.warning(f"Load Alipay public key failed: {e}")
        return ""


def _rsa_sign(content: str, private_key_pem: str) -> str:
    """RSA2 签名(SHA256WithRSA)."""
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode("utf-8"),
        password=None,
        backend=default_backend(),
    )
    signature = private_key.sign(
        content.encode("utf-8"),
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
    return base64.b64encode(signature).decode("utf-8")


def _rsa_verify(content: str, signature_b64: str, public_key_pem: str) -> bool:
    """RSA2 验签."""
    try:
        public_key = serialization.load_pem_public_key(
            public_key_pem.encode("utf-8"),
            backend=default_backend(),
        )
        public_key.verify(
            base64.b64decode(signature_b64),
            content.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return True
    except Exception as e:
        logger.error(f"Alipay verify failed: {e}")
        return False


def build_signed_url(biz_content: dict, method: str = "alipay.trade.page.pay") -> str:
    """生成已签名的支付宝网关 URL(用于 PC/H5 网页支付)."""
    public_params = {
        "app_id": settings.ALIPAY_APP_ID,
        "method": method,
        "charset": "utf-8",
        "sign_type": "RSA2",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "version": "1.0",
        "biz_content": json.dumps(biz_content, ensure_ascii=False),
    }
    sorted_str = "&".join(f"{k}={quote_plus(str(v))}" for k, v in sorted(public_params.items()))
    private_key = _load_alipay_private_key()
    if not private_key:
        return f"{settings.ALIPAY_GATEWAY}?{sorted_str}"
    sign = _rsa_sign(sorted_str, private_key)
    return f"{settings.ALIPAY_GATEWAY}?{sorted_str}&sign={quote_plus(sign)}"


def verify_notify(params: dict) -> bool:
    """验签支付宝异步回调."""
    sign = params.pop("sign", None)
    sign_type = params.pop("sign_type", "RSA2")
    if not sign or sign_type != "RSA2":
        return False
    sorted_str = "&".join(f"{k}={quote_plus(str(v))}" for k, v in sorted(params.items()))
    public_key = _load_alipay_public_key()
    if not public_key:
        logger.warning("Alipay public key missing, skip verify (DEV only)")
        return True
    return _rsa_verify(sorted_str, sign, public_key)


async def app_pay_order(out_trade_no: str, total_amount: str, subject: str, notify_url: str = "") -> str:
    """生成 app 支付的 orderStr(移动端)."""
    biz = {
        "out_trade_no": out_trade_no,
        "total_amount": total_amount,
        "subject": subject,
        "product_code": "QUICK_MSECURITY_PAY",
    }
    if notify_url:
        biz["notify_url"] = notify_url
    public_params = {
        "app_id": settings.ALIPAY_APP_ID,
        "method": "alipay.trade.app.pay",
        "charset": "utf-8",
        "sign_type": "RSA2",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "version": "1.0",
        "biz_content": json.dumps(biz, ensure_ascii=False),
    }
    sorted_str = "&".join(f"{k}={quote_plus(str(v))}" for k, v in sorted(public_params.items()))
    private_key = _load_alipay_private_key()
    sign = _rsa_sign(sorted_str, private_key) if private_key else ""
    return f"{sorted_str}&sign={quote_plus(sign)}"


async def query_order(out_trade_no: str) -> dict:
    """查询支付宝订单."""
    biz = {"out_trade_no": out_trade_no}
    public_params = {
        "app_id": settings.ALIPAY_APP_ID,
        "method": "alipay.trade.query",
        "charset": "utf-8",
        "sign_type": "RSA2",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "version": "1.0",
        "biz_content": json.dumps(biz, ensure_ascii=False),
    }
    sorted_str = "&".join(f"{k}={quote_plus(str(v))}" for k, v in sorted(public_params.items()))
    private_key = _load_alipay_private_key()
    sign = _rsa_sign(sorted_str, private_key) if private_key else ""
    url = f"{settings.ALIPAY_GATEWAY}?{sorted_str}&sign={quote_plus(sign)}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        return resp.json()


def generate_out_trade_no() -> str:
    """生成支付宝订单号."""
    return f"{time.strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:8]}"


async def create_pay_order(
    order_id: str,
    desc: str,
    amount: float,
    product_id: str = "",
    product_type: int = 1,
) -> str:
    """生成支付宝 PC 网页支付表单 (兼容 Fund 接口).

    返回已经签好名的跳转 URL, 前端直接 window.location 即可.
    """
    biz = {
        "out_trade_no": order_id,
        "total_amount": f"{amount:.2f}",
        "subject": desc or "Product purchase",
        "product_code": "FAST_INSTANT_TRADE_PAY",
    }
    if product_id:
        biz["passback_params"] = f"{product_type}:{product_id}"
    return build_signed_url(biz)


async def verify_alipay_signature(params: dict) -> bool:
    """异步验签包装 (兼容 v1 路由 async 调用).

    内部委托同步 verify_notify, 在线程池执行.
    """
    import asyncio

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, verify_notify, dict(params))


async def refund_order(
    out_trade_no: str,
    refund_amount: str,
    reason: str = "用户申请退款",
    out_request_no: str = "",
) -> dict:
    """调用 alipay.trade.refund 真实退款.

    out_request_no: 退款请求号(同一订单多次退款需不同),默认生成.
    """
    if not out_request_no:
        out_request_no = f"r{int(time.time() * 1000)}{uuid.uuid4().hex[:6]}"
    biz = {
        "out_trade_no": out_trade_no,
        "refund_amount": refund_amount,
        "refund_reason": reason,
        "out_request_no": out_request_no,
    }
    public_params = {
        "app_id": settings.ALIPAY_APP_ID,
        "method": "alipay.trade.refund",
        "charset": "utf-8",
        "sign_type": "RSA2",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "version": "1.0",
        "biz_content": json.dumps(biz, ensure_ascii=False),
    }
    sorted_str = "&".join(f"{k}={quote_plus(str(v))}" for k, v in sorted(public_params.items()))
    private_key = _load_alipay_private_key()
    sign = _rsa_sign(sorted_str, private_key) if private_key else ""
    url = f"{settings.ALIPAY_GATEWAY}?{sorted_str}&sign={quote_plus(sign)}"
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url)
            return {"out_request_no": out_request_no, **resp.json()}
        except Exception as e:
            logger.error(f"Alipay refund error: {e}")
            return {"code": -1, "msg": str(e), "out_request_no": out_request_no}


async def close_order(out_trade_no: str) -> dict:
    """关闭支付宝订单(未支付时)."""
    biz = {"out_trade_no": out_trade_no}
    public_params = {
        "app_id": settings.ALIPAY_APP_ID,
        "method": "alipay.trade.close",
        "charset": "utf-8",
        "sign_type": "RSA2",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "version": "1.0",
        "biz_content": json.dumps(biz, ensure_ascii=False),
    }
    sorted_str = "&".join(f"{k}={quote_plus(str(v))}" for k, v in sorted(public_params.items()))
    private_key = _load_alipay_private_key()
    sign = _rsa_sign(sorted_str, private_key) if private_key else ""
    url = f"{settings.ALIPAY_GATEWAY}?{sorted_str}&sign={quote_plus(sign)}"
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url)
            return resp.json()
        except Exception as e:
            logger.error(f"Alipay close error: {e}")
            return {"code": -1, "msg": str(e)}


async def download_bill_url(bill_date: str, bill_type: str = "trade") -> dict:
    """获取支付宝对账单下载地址.

    bill_date: 格式 yyyy-MM-dd
    bill_type: trade/signcustomer (交易/客户签名)
    返回 {"bill_download_url": "https://..."}
    """
    biz = {"bill_date": bill_date, "bill_type": bill_type}
    public_params = {
        "app_id": settings.ALIPAY_APP_ID,
        "method": "alipay.data.dataservice.bill.downloadurl.query",
        "charset": "utf-8",
        "sign_type": "RSA2",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "version": "1.0",
        "biz_content": json.dumps(biz, ensure_ascii=False),
    }
    sorted_str = "&".join(f"{k}={quote_plus(str(v))}" for k, v in sorted(public_params.items()))
    private_key = _load_alipay_private_key()
    sign = _rsa_sign(sorted_str, private_key) if private_key else ""
    url = f"{settings.ALIPAY_GATEWAY}?{sorted_str}&sign={quote_plus(sign)}"
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url)
            return resp.json()
        except Exception as e:
            logger.error(f"Alipay bill query error: {e}")
            return {"code": -1, "msg": str(e)}


async def reconcile_alipay(bill_date: str) -> dict:
    """对账:拉取支付宝账单 + 与本地订单对比,输出差异."""
    from app.services.order_service import list_paid_orders_by_date

    remote = await download_bill_url(bill_date, "trade")
    bill_url = remote.get("alipay_data_dataservice_bill_downloadurl_query_response", {}).get("bill_download_url", "")
    if not bill_url:
        return {"date": bill_date, "remote": remote, "diff": [], "local_count": 0, "remote_count": 0}
    async with httpx.AsyncClient(timeout=30) as client:
        bill_resp = await client.get(bill_url)
    lines = bill_resp.text.splitlines()
    remote_trades = []
    for line in lines[4:]:
        parts = line.split(",")
        if len(parts) >= 6:
            remote_trades.append(
                {
                    "out_trade_no": parts[0].strip('"'),
                    "total_amount": parts[5].strip('"'),
                    "trade_status": parts[3].strip('"'),
                }
            )
    local_orders = list_paid_orders_by_date(bill_date)
    local_map = {o["out_trade_no"]: o for o in local_orders}
    remote_map = {t["out_trade_no"]: t for t in remote_trades}
    only_remote = [r for r in remote_trades if r["out_trade_no"] not in local_map]
    only_local = [l for l in local_orders if l["out_trade_no"] not in remote_map]
    return {
        "date": bill_date,
        "local_count": len(local_orders),
        "remote_count": len(remote_trades),
        "diff": {
            "only_remote": only_remote,
            "only_local": only_local,
        },
    }
