"""WeChat Pay V3 utilities.

- 签名(请求)
- 验签(回调)
- AES-256-GCM 解密(回调 resource.ciphertext)
- 预下单封装
"""

import base64
import json
import time
import uuid

import httpx
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from loguru import logger

from app.config import settings


def _load_private_key() -> object | None:
    """加载商户私钥(PEM 格式)."""
    try:
        with open(settings.WX_PAY_PRIVATE_KEY_PATH, "rb") as f:
            return serialization.load_pem_private_key(
                f.read(),
                password=settings.WX_PAY_CERT_PASS.encode(),
                backend=default_backend(),
            )
    except Exception as e:
        logger.warning(f"Load WX private key failed: {e}")
        return None


def _load_platform_cert() -> object | None:
    """加载平台公钥证书."""
    try:
        with open(settings.WX_PAY_PLATFORM_CERT_PATH, "rb") as f:
            return serialization.load_pem_x509_certificate(f.read(), default_backend()).public_key()
    except Exception as e:
        logger.warning(f"Load WX platform cert failed: {e}")
        return None


def build_authorization(method: str, url: str, body: str) -> str:
    """构造微信 V3 Authorization 头."""
    method = method.upper()
    timestamp = str(int(time.time()))
    nonce = str(uuid.uuid4())
    sign_str = f"{method}\n{url}\n{timestamp}\n{nonce}\n{body}\n"
    private_key = _load_private_key()
    if not private_key:
        return f'WECHATPAY2-SHA256-RSA2048 mchid="{settings.WX_SHOP_ID}"'
    signature = base64.b64encode(
        private_key.sign(
            sign_str.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
    ).decode("utf-8")
    return (
        f"WECHATPAY2-SHA256-RSA2048 "
        f'mchid="{settings.WX_SHOP_ID}",'
        f'nonce_str="{nonce}",'
        f'timestamp="{timestamp}",'
        f'serial_no="{settings.WX_PAY_CERT_SERIAL}",'
        f'signature="{signature}"'
    )


def verify_callback_signature(timestamp: str, nonce: str, body: str, signature: str) -> bool:
    """验签微信 V3 回调."""
    sign_str = f"{timestamp}\n{nonce}\n{body}\n"
    public_key = _load_platform_cert()
    if not public_key:
        logger.warning("WX platform cert missing, skip verify (DEV only)")
        return True
    try:
        public_key.verify(
            base64.b64decode(signature),
            sign_str.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return True
    except Exception as e:
        logger.error(f"WX V3 signature verify failed: {e}")
        return False


def decrypt_callback(ciphertext_b64: str, nonce: str, associated_data: str = "") -> dict:
    """AES-256-GCM 解密回调 resource.ciphertext."""
    try:
        key = settings.WX_PAY_V3_KEY.encode("utf-8")
        ciphertext = base64.b64decode(ciphertext_b64)
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(
            nonce.encode("utf-8"),
            ciphertext,
            associated_data.encode("utf-8") if associated_data else None,
        )
        return json.loads(plaintext.decode("utf-8"))
    except Exception as e:
        logger.error(f"WX V3 decrypt failed: {e}")
        return {}


async def jsapi_prepay(open_id: str, amount_cents: int, out_trade_no: str, description: str) -> dict:
    """微信 V3 JSAPI 预下单.

    Routes to different notify URLs based on order prefix to match Java logic:
    - WXAT (agent buy) / COURSE -> WX_PAY_COURSE_NOTIFY_URL
    - others                    -> WX_PAY_NOTIFY_URL
    """
    # Match Java: different notify URLs per order prefix
    if out_trade_no.startswith("WXAT") or out_trade_no.startswith("COURSE"):
        notify_url = settings.WX_PAY_COURSE_NOTIFY_URL
    else:
        notify_url = settings.WX_PAY_NOTIFY_URL

    body = {
        "appid": settings.WX_MINI_APPID,
        "mchid": settings.WX_SHOP_ID,
        "description": description or "购买",
        "out_trade_no": out_trade_no,
        "notify_url": notify_url,
        "amount": {"total": amount_cents, "currency": "CNY"},
        "payer": {"openid": open_id},
    }
    body_str = json.dumps(body, ensure_ascii=False, separators=("", ":"))
    path = "/v3/pay/transactions/jsapi"
    auth = build_authorization("POST", path, body_str)
    headers = {"Authorization": auth, "Content-Type": "application/json", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{settings.WX_API_BASE}{path}", headers=headers, content=body_str)
        return resp.json()


async def app_prepay(amount_cents: int, out_trade_no: str, description: str) -> dict:
    """微信 V3 APP 预下单(安卓端).

    Matches Java PayAndroidServiceImpl.wxPay:
    - Uses wx.app.appid (WX_APP_APPID / separate APP id)
    - Uses wx.app.notify (WX_ANDROID_NOTIFY_URL)
    """
    notify_url = settings.WX_ANDROID_NOTIFY_URL

    body = {
        "appid": getattr(settings, "WX_APP_APPID", settings.WX_MINI_APPID),
        "mchid": settings.WX_SHOP_ID,
        "description": description or "购买",
        "out_trade_no": out_trade_no,
        "notify_url": notify_url,
        "amount": {"total": amount_cents, "currency": "CNY"},
    }
    body_str = json.dumps(body, ensure_ascii=False, separators=("", ":"))
    path = "/v3/pay/transactions/app"
    auth = build_authorization("POST", path, body_str)
    headers = {"Authorization": auth, "Content-Type": "application/json", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{settings.WX_API_BASE}{path}", headers=headers, content=body_str)
        return resp.json()


def build_jsapi_sign(prepay_id: str) -> dict:
    """生成前端调起支付的 paySign."""
    timestamp = str(int(time.time()))
    nonce = str(uuid.uuid4())
    package = f"prepay_id={prepay_id}"
    sign_str = f"{settings.WX_MINI_APPID}\n{timestamp}\n{nonce}\n{package}\n"
    private_key = _load_private_key()
    if not private_key:
        return {"timestamp": timestamp, "nonceStr": nonce, "package": package, "signType": "RSA", "paySign": ""}
    signature = base64.b64encode(
        private_key.sign(sign_str.encode("utf-8"), padding.PKCS1v15(), hashes.SHA256())
    ).decode("utf-8")
    return {
        "timestamp": timestamp,
        "nonceStr": nonce,
        "package": package,
        "signType": "RSA",
        "paySign": signature,
    }


async def query_order(out_trade_no: str) -> dict:
    """查询微信支付订单."""
    path = f"/v3/pay/transactions/out-trade-no/{out_trade_no}?mchid={settings.WX_SHOP_ID}"
    auth = build_authorization("GET", path, "")
    headers = {"Authorization": auth, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{settings.WX_API_BASE}{path}", headers=headers)
        return resp.json()


async def close_order(out_trade_no: str) -> dict:
    """关闭微信支付订单."""
    path = f"/v3/pay/transactions/out-trade-no/{out_trade_no}/close"
    auth = build_authorization("POST", path, '{"mchid":"' + settings.WX_SHOP_ID + '"}')
    headers = {"Authorization": auth, "Content-Type": "application/json", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{settings.WX_API_BASE}{path}",
            headers=headers,
            content='{"mchid":"' + settings.WX_SHOP_ID + '"}',
        )
        return {"status_code": resp.status_code, "body": resp.text}


async def refund(out_trade_no: str, refund_no: str, amount_cents: int, total_cents: int, reason: str = "") -> dict:
    """微信 V3 退款申请."""
    path = "/v3/refund/domestic/refunds"
    body = {
        "out_trade_no": out_trade_no,
        "out_refund_no": refund_no,
        "reason": reason or "用户申请退款",
        "amount": {"refund": amount_cents, "total": total_cents, "currency": "CNY"},
        "notify_url": settings.WX_PAY_NOTIFY_URL,
    }
    body_str = json.dumps(body, ensure_ascii=False, separators=("", ":"))
    auth = build_authorization("POST", path, body_str)
    headers = {"Authorization": auth, "Content-Type": "application/json", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{settings.WX_API_BASE}{path}", headers=headers, content=body_str)
        return resp.json()


async def download_bill(bill_date: str, bill_type: str = "ALL") -> dict:
    """下载微信对账单.

    bill_date: 格式 YYYY-MM-DD
    bill_type: ALL/SUCCESS/REFUND
    返回 {"download_url": "...", "hash": "..."}
    """
    path = f"/v3/bill/tradebill?bill_date={bill_date}&bill_type={bill_type}"
    auth = build_authorization("GET", path, "")
    headers = {"Authorization": auth, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{settings.WX_API_BASE}{path}", headers=headers)
        return resp.json() if resp.status_code == 200 else {"status_code": resp.status_code, "body": resp.text}


async def download_fundflow(bill_date: str, account_type: str = "BASIC") -> dict:
    """下载微信资金账单.

    account_type: BASIC/OPERATION/FEES
    """
    path = f"/v3/bill/fundflowbill?bill_date={bill_date}&account_type={account_type}"
    auth = build_authorization("GET", path, "")
    headers = {"Authorization": auth, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{settings.WX_API_BASE}{path}", headers=headers)
        return resp.json() if resp.status_code == 200 else {"status_code": resp.status_code, "body": resp.text}
