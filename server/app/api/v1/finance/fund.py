# Fund management endpoints -- token operations, product info, payment callbacks, file streaming.
# Ported from P2 FundController.java

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import text

from app.database import get_session

router = APIRouter(prefix="/fund", tags=["Fund Management"])


@router.post("/useToken")
async def use_token(request: Request, platform: str = "WEB"):
    # Deduct tokens for a user
    body = await request.json()
    uuid_val = body.get("uuid")
    quantity = body.get("quantity")
    if not uuid_val or quantity is None:
        return {"code": "400", "msg": "uuid and quantity are required"}
    from app.services.token_service import deduct_user_token

    result = deduct_user_token(uuid_val, int(quantity), "Fund useToken API")
    return {
        "code": "200" if result.get("success") else "500",
        "msg": result.get("reason", ""),
        "data": result,
    }


@router.get("/getInfo")
async def get_info(token: str = Query(..., description="user uuid")):
    # Get product identity order info for a user
    try:
        with get_session() as db:
            rows = db.execute(
                text("SELECT * FROM zhs_product_identity WHERE user_uuid = :uuid ORDER BY created_at DESC LIMIT 1"),
                {"uuid": token},
            ).fetchall()
            if rows:
                row = rows[0]
                return {"code": "200", "msg": "success", "data": dict(row._mapping)}
            return {"code": "200", "msg": "No order found", "data": None}
    except Exception as e:
        logger.error("getInfo error: " + str(e))
        return {"code": "500", "msg": str(e)}


@router.get("/getProduct")
async def get_product():
    # Get product list and active activity
    try:
        with get_session() as db1:
            products = db1.execute(text("SELECT * FROM zhs_product_identity")).fetchall()
            activities = db1.execute(
                text("SELECT * FROM zhs_activity WHERE status = 1 ORDER BY begin_time DESC LIMIT 1")
            ).fetchall()
            product_list = [dict(r._mapping) for r in products]
            activity = dict(activities[0]._mapping) if activities else None
            return {
                "code": "200",
                "msg": "success",
                "data": {"productIdentities": product_list, "activity": activity},
            }
    except Exception as e:
        logger.error("getProduct error: " + str(e))
        return {"code": "500", "msg": str(e)}


@router.post("/notify")
async def fund_notify(request: Request):
    # WeChat payment callback
    body = await request.body()
    serial = request.headers.get("Wechatpay-Serial", "")
    signature = request.headers.get("Wechatpay-Signature", "")
    timestamp = request.headers.get("Wechatpay-Timestamp", "")
    nonce = request.headers.get("Wechatpay-Nonce", "")
    logger.info("Fund notify received, serial=" + serial)
    # Delegate to wechat pay service
    try:
        from app.utils.wechat_pay_util import handle_pay_notify  # type: ignore[attr-defined]

        result = await handle_pay_notify(body.decode("utf-8"), serial, signature, timestamp, nonce)
        return result
    except Exception as e:
        logger.error("Fund notify error: " + str(e))
        return {"code": "FAIL", "message": str(e)}


@router.post("/app/notify")
async def fund_app_notify(request: Request):
    # Mobile app payment callback
    body = await request.body()
    serial = request.headers.get("Wechatpay-Serial", "")
    signature = request.headers.get("Wechatpay-Signature", "")
    timestamp = request.headers.get("Wechatpay-Timestamp", "")
    nonce = request.headers.get("Wechatpay-Nonce", "")
    logger.info("Fund app notify received")
    try:
        from app.utils.wechat_pay_util import handle_pay_notify  # type: ignore[attr-defined]

        result = await handle_pay_notify(body.decode("utf-8"), serial, signature, timestamp, nonce)
        return result
    except Exception as e:
        logger.error("Fund app notify error: " + str(e))
        return {"code": "FAIL", "message": str(e)}


@router.get("/getStatistics")
async def get_statistics(request: Request):
    # Get user usage statistics
    body = await request.json()
    now = body.get("now")
    uuid_val = body.get("uuid")
    if not now:
        return {"code": "400", "msg": "now is required"}
    return {
        "code": "200",
        "msg": "success",
        "data": {"uuid": uuid_val, "timestamp": now},
    }


@router.post("/file/to/stream")
async def file_to_stream(request: Request):
    # Proxy a remote file URL as a stream
    import httpx

    body = await request.json()
    file_url = body.get("file", "")
    if not file_url:
        return {"code": "400", "msg": "file URL is required"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(file_url)
            return StreamingResponse(
                iter([resp.content]),
                media_type=resp.headers.get("content-type", "application/octet-stream"),
            )
    except Exception as e:
        logger.error("file_to_stream error: " + str(e))
        return {"code": "500", "msg": str(e)}


@router.post("/agent/transfer/notify")
async def agent_transfer_notify(request: Request):
    # Agent payment transfer callback
    body = await request.body()
    serial = request.headers.get("Wechatpay-Serial", "")
    logger.info("Agent transfer notify received")
    try:
        from app.utils.wechat_pay_util import handle_transfer_notify  # type: ignore[attr-defined]

        result = await handle_transfer_notify(
            body.decode("utf-8"),
            serial,
            request.headers.get("Wechatpay-Signature", ""),
            request.headers.get("Wechatpay-Timestamp", ""),
            request.headers.get("Wechatpay-Nonce", ""),
        )
        return result
    except Exception as e:
        logger.error("Agent transfer notify error: " + str(e))
        return {"code": "FAIL", "message": str(e)}
