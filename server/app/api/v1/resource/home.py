"""资源接口 12 端点: 首页 / token / 文件 / 开发者价格 / 分享 / 商品 / 星球 / 免费次数 / 会员 / coze."""

import secrets
import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile
from loguru import logger

from app.config import settings
from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login
from app.utils.datetime_helper import utcnow
from app.utils.minio_util import upload_file as upload_to_minio

router = APIRouter()


@router.get("/home", summary="首页资源聚合")
def home_resources(user_uuid: str = Depends(require_login)):
    """返回首页所需的全部资源:banner、推荐 Agent、热门课程、公告."""
    with get_session() as db1:
        try:
            from app.models.agent_models import Agent
            from app.models.app_content_models import AppContent
            from app.models.course_models import EducationalCourse
            from app.models.sys_models import SysNotice

            hot_agents = db1.query(Agent).filter(Agent.is_deleted == 0).order_by(Agent.usage_count.desc()).limit(6).all()
            hot_courses = db1.query(EducationalCourse).order_by(EducationalCourse.id.desc()).limit(6).all()
            notices = (
                db1.query(SysNotice).filter(SysNotice.status == "0").order_by(SysNotice.notice_id.desc()).limit(3).all()
            )
            banners = (
                db1.query(AppContent)
                .filter(
                    AppContent.type == "banner",
                    AppContent.status == 1,
                )
                .order_by(AppContent.sort.desc())
                .limit(5)
                .all()
            )

            return success(
                {
                    "banners": [
                        {
                            "id": b.id,
                            "title": b.title,
                            "image": b.image_url,
                            "url": b.link_url,
                        }
                        for b in banners
                    ],
                    "hot_agents": [
                        {
                            "id": a.agent_id,
                            "name": a.agent_name,
                            "avatar": a.agent_avatar,
                            "usage_count": a.usage_count,
                        }
                        for a in hot_agents
                    ],
                    "hot_courses": [
                        {"id": c.id, "title": c.title, "cover": c.cover, "price": c.price} for c in hot_courses
                    ],
                    "notices": [{"id": n.notice_id, "title": n.notice_title, "type": n.notice_type} for n in notices],
                }
            )
        except Exception as e:
            logger.error(f"Home resources error: {e}")
            return error(str(e))


@router.get("/token/count", summary="获取用户 token 余量")
def token_count(user_uuid: str = Depends(require_login)):
    with get_session() as db2:
        from app.models.user_models import UserMargin

        margin = db2.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
        balance = margin.token_quantity if margin else 0
        return success({"user_uuid": user_uuid, "token_balance": balance})


@router.post("/file/upload", summary="上传文件到 MinIO")
async def file_upload(
    file: UploadFile = File(...),
    bucket: str = Query(None, description="存储桶,不传则用默认"),
    user_uuid: str = Depends(require_login),
):
    """上传文件,返回可访问的 URL."""
    try:
        content = await file.read()
        ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
        object_name = f"{user_uuid}/{utcnow().strftime('%Y%m%d')}/{uuid.uuid4().hex}.{ext}"
        url = upload_to_minio(
            content,
            file.filename or object_name,
            content_type=file.content_type or "application/octet-stream",
            bucket=bucket or settings.MINIO_BUCKET,
        )
        return success({"url": url, "object_name": object_name, "size": len(content)})
    except Exception as e:
        logger.error(f"File upload error: {e}")
        return error(str(e))


@router.get("/developer/price", summary="查询 Agent 开发者价格")
def developer_price(agent_id: str = Query(...)):
    """返回该 Agent 的开发者列表及价格档位."""
    with get_session() as db1:
        from app.models.activity_models import AgentDeveloper

        items = db1.query(AgentDeveloper).filter(AgentDeveloper.agent_id == agent_id).all()
        return success(
            [
                {
                    "developer_id": d.id,
                    "order_no": d.order_no,
                    "price": d.price,
                    "status": d.status,
                }
                for d in items
            ],
            total=len(items),
        )


@router.post("/share", summary="生成分享链接")
def create_share(
    target_type: str = Query(..., description="agent/course/chat"),
    target_id: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    """生成一次性分享 token 短链."""
    share_token = secrets.token_urlsafe(8)
    return success(
        {
            "share_token": share_token,
            "target_type": target_type,
            "target_id": target_id,
            "share_url": f"{settings.MINIO_FILE_URL}/s/{share_token}",
        }
    )


# ---------------------------------------------------------------------------
# 新增端点
# ---------------------------------------------------------------------------


@router.get("/goods", summary="商品及汇率列表")
def goods_list(user_uuid: str = Depends(require_login)):
    """查询 zhs_product 表全部商品以及 exchange_rate 汇率表."""
    with get_session() as db1:
        try:
            from app.models.app_content_models import ExchangeRate, ZhsProduct

            products = db1.query(ZhsProduct).filter(ZhsProduct.status == 1).order_by(ZhsProduct.sort.asc()).all()
            rates = db1.query(ExchangeRate).filter(ExchangeRate.status == 1).order_by(ExchangeRate.sort.asc()).all()

            return success(
                {
                    "products": [
                        {
                            "id": p.id,
                            "name": p.name,
                            "price": p.price,
                            "token_amount": p.token_amount,
                            "type": p.type,
                        }
                        for p in products
                    ],
                    "exchange_rates": [
                        {
                            "id": r.id,
                            "currency_code": r.currency_code,
                            "currency_name": r.currency_name,
                            "rate": r.rate,
                        }
                        for r in rates
                    ],
                }
            )
        except Exception as e:
            logger.error(f"Goods list error: {e}")
            return error(str(e))


@router.get("/planets/course", summary="课程星球列表")
def planets_course(user_uuid: str = Depends(require_login)):
    """返回 type=course 的知识星球列表."""
    with get_session() as db1:
        from app.models.app_content_models import KnowledgePlanet

        planets = (
            db1.query(KnowledgePlanet)
            .filter(KnowledgePlanet.type == "course", KnowledgePlanet.status == 1)
            .order_by(KnowledgePlanet.sort.asc())
            .all()
        )
        return success(
            [
                {
                    "id": p.id,
                    "name": p.name,
                    "description": p.description,
                    "cover": p.cover,
                    "price": p.price,
                    "type": p.type,
                }
                for p in planets
            ]
        )


@router.get("/planets/knowledge", summary="知识星球列表")
def planets_knowledge(user_uuid: str = Depends(require_login)):
    """返回 type=knowledge 的知识星球列表."""
    with get_session() as db1:
        from app.models.app_content_models import KnowledgePlanet

        planets = (
            db1.query(KnowledgePlanet)
            .filter(KnowledgePlanet.type == "knowledge", KnowledgePlanet.status == 1)
            .order_by(KnowledgePlanet.sort.asc())
            .all()
        )
        return success(
            [
                {
                    "id": p.id,
                    "name": p.name,
                    "description": p.description,
                    "cover": p.cover,
                    "price": p.price,
                    "type": p.type,
                }
                for p in planets
            ]
        )


@router.post("/agent/free-time", summary="添加用户 Agent 免费次数")
def add_agent_free_time(
    agent_id: str = Query(..., description="Agent ID"),
    free_count: int = Query(..., description="免费次数"),
    user_uuid: str = Depends(require_login),
):
    """为指定用户增加 Agent 免费使用次数."""
    with get_session() as db1:
        try:
            from app.models.user_models import UserAgentFreeTime

            record = (
                db1.query(UserAgentFreeTime)
                .filter(
                    UserAgentFreeTime.user_uuid == user_uuid,
                    UserAgentFreeTime.agent_id == agent_id,
                )
                .first()
            )
            if record:
                record.free_count += free_count
            else:
                record = UserAgentFreeTime(
                    user_uuid=user_uuid,
                    agent_id=agent_id,
                    free_count=free_count,
                    used_count=0,
                )
                db1.add(record)
            return success({"free_count": record.free_count})
        except Exception as e:
            logger.error(f"Add agent free time error: {e}")
            return error(str(e))


@router.get("/agent/free-time", summary="获取用户 Agent 免费次数")
def get_agent_free_time(
    agent_id: str = Query(..., description="Agent ID"),
    user_uuid: str = Depends(require_login),
):
    """查询指定用户在指定 Agent 上剩余的免费次数."""
    with get_session() as db1:
        from app.models.user_models import UserAgentFreeTime

        record = (
            db1.query(UserAgentFreeTime)
            .filter(
                UserAgentFreeTime.user_uuid == user_uuid,
                UserAgentFreeTime.agent_id == agent_id,
            )
            .first()
        )
        if not record:
            return success({"free_count": 0, "used_count": 0})
        return success(
            {
                "free_count": record.free_count,
                "used_count": record.used_count,
                "expire_time": (record.expire_time.isoformat() if record.expire_time else None),
            }
        )


@router.get("/recharge", summary="判断是否为会员")
def recharge_check(user_uuid: str = Depends(require_login)):
    """查询 user_vip 表判断当前用户是否为会员."""
    with get_session() as db2:
        try:

            from app.models.user_models import UserVip

            vip = (
                db2.query(UserVip)
                .filter(UserVip.user_uuid == user_uuid, UserVip.status == 1)
                .order_by(UserVip.end_time.desc())
                .first()
            )
            is_vip = False
            vip_info = None
            if vip:
                if vip.end_time and vip.end_time > utcnow():
                    is_vip = True
                    vip_info = {
                        "vip_level_id": vip.vip_level_id,
                        "level_value": vip.level_value,
                        "start_time": (vip.start_time.isoformat() if vip.start_time else None),
                        "end_time": vip.end_time.isoformat() if vip.end_time else None,
                    }
                else:
                    # Expired, update status
                    vip.status = 0
            return success({"is_vip": is_vip, "vip_info": vip_info})
        except Exception as e:
            logger.error(f"Recharge check error: {e}")
            return error(str(e))


@router.get("/coze-access-token", summary="获取 Coze AccessToken")
async def get_coze_access_token(user_uuid: str = Depends(require_login)):
    """通过 Coze OAuth2 JWT 方式获取 access_token."""
    try:
        import time

        import jwt as pyjwt

        now = int(time.time())
        payload = {
            "iss": settings.COZE_OAUTH_APP_ID,
            "aud": settings.COZE_OAUTH_APP_AUD,
            "iat": now,
            "exp": now + 3600,
            "jti": f"{user_uuid}_{now}",
        }
        token = pyjwt.encode(
            payload,
            settings.COZE_PRIVATE_KEY,
            algorithm="RS256",
            headers={"kid": settings.COZE_PUBLIC_KEY_ID},
        )

        import httpx

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                settings.COZE_OAUTH_TOKEN_URL,
                json={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": token,
                },
                headers={"Content-Type": "application/json"},
            )
            data = resp.json()

        access_token = data.get("access_token")
        if not access_token:
            logger.error(f"Coze OAuth token error: {data}")
            return error(f"Failed to get Coze access_token: {data.get('error_description', data)}")

        return success({"access_token": access_token, "expires_in": data.get("expires_in")})
    except Exception as e:
        logger.error(f"Coze access token error: {e}")
        return error(str(e))
