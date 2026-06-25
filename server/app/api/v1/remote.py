"""远程设备 / 第三方远程请求 -- 对应 Java ai-program 的 RemoteDeviceController + RemoteThirdController.

Java 端 11 个端点:
- POST /remote/myTeam/{uuid}        我的团队
- GET  /remote/info/{uuid}         当前用户信息
- POST /remote/uploadBusinessCard  上传名片
- GET  /remote/role                可购买身份
- GET  /remote/agent/category      智能体类型
- GET  /remote/agent/category2     智能体类型 (AjaxResult 形式)
- GET  /remote/agent/by/type       智能体按类型
- GET  /remote/agent/by/collect/{uuid}  收藏的智能体
- GET  /remote/agent/by/pay        购买的智能体
- POST /remote/get/tencent/sentence 腾讯云一句话 ASR
- GET  /remote/get/true            提现开关 (查 ZhsWithdrawalFlow id=1)
- GET  /remote/third/group/list    远程三方分组排行
"""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, status
from pydantic import BaseModel

from app.config import settings
from app.database import SessionFactory2
from app.models.activity_models import AgentBuy, AgentCategory
from app.models.agent_models import Agent
from app.models.app_content_models import ProductIdentity
from app.models.user_models import User, UserThirdPartyAccount
from app.security import require_login
from app.utils.pagination import paginate
from app.utils.response import fail, success

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/remote", tags=["Remote Device"])

# 子路由, 避免在主 router 上重复 prefix
third_router = APIRouter(prefix="/remote/third", tags=["Remote Third"])


def _is_admin(user_uuid: str) -> bool:
    """检查指定用户是否拥有 admin 角色 (用于跨用户查询的归属校验)."""
    from sqlalchemy import select

    from app.database import get_session
    from app.models.sys_models import SysRole, SysUser, SysUserRole

    with get_session() as db:
        stmt = (
            select(SysUser.user_id)
            .join(SysUserRole, SysUser.user_id == SysUserRole.user_id)
            .join(SysRole, SysUserRole.role_id == SysRole.role_id)
            .where(
                SysUser.user_uuid == user_uuid,
                SysRole.role_key == "admin",
                SysRole.status == "0",
                SysRole.del_flag == "0",
            )
            .limit(1)
        )
        return db.execute(stmt).scalar() is not None


# ---------------------------------------------------------------------------
# Pydantic
# ---------------------------------------------------------------------------


class BusinessCardReq(BaseModel):
    id: str
    card: str
    fileName: str = "card.png"  # noqa: 5


class TencentAsrReq(BaseModel):
    file: str  # 远程音频 URL


class MyTeamQuery(BaseModel):
    search: str | None = None
    begin: str | None = None
    end: str | None = None


# ---------------------------------------------------------------------------
# 1. 我的团队
# ---------------------------------------------------------------------------


@router.post("/myTeam/{uuid}")
async def my_team(
    uuid: str = Path(...),
    platform: str = Header(default="unknown", alias="X-Device-Type"),
    body: MyTeamQuery | None = None,
    user_uuid: str = Depends(require_login),
):
    """对应 Java: POST /remote/myTeam/{uuid} -- 查询我的团队 (邀请树子节点)."""
    if not uuid:
        return fail("无法识别的用户", code=400)
    body = body or MyTeamQuery()
    with SessionFactory2() as db:
        q = db.query(User).filter(User.parent_id == uuid, User.status == 1)
        if body.search:
            q = q.filter(User.nickname.contains(body.search))
        # begin/end 范围限定 created_at (粗筛, 实际项目按需精确化)
        if body.begin and body.end:
            from datetime import datetime

            try:
                t_begin = datetime.strptime(body.begin, "%Y-%m-%d")
                t_end = datetime.strptime(body.end, "%Y-%m-%d")
                q = q.filter(User.created_at.between(t_begin, t_end))
            except ValueError:
                return fail("日期格式错误, 应为 yyyy-MM-dd", code=400)
        items = q.order_by(User.created_at.desc()).limit(200).all()
        return success(
            [
                {
                    "uuid": u.uuid,
                    "nickname": u.nickname,
                    "avatar": u.avatar,
                    "createdAt": u.created_at.isoformat() if u.created_at else None,
                    "isVip": bool(u.is_vip),
                }
                for u in items
            ]
        )


# ---------------------------------------------------------------------------
# 2. 获取当前用户信息
# ---------------------------------------------------------------------------


@router.get("/info/{uuid}")
async def get_info(
    uuid: str = Path(...),
    platform: str = Header(default="unknown", alias="X-Device-Type"),
    user_uuid: str = Depends(require_login),
):
    """对应 Java: GET /remote/info/{uuid} -- 用户基本信息 + 第三方账号绑定.

    安全: 查询其他用户信息要求 admin 角色, 查询本人信息仅需登录.
    """
    # 跨用户查询归属校验: 非本人查询需 admin
    if uuid != user_uuid and not _is_admin(user_uuid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权查询其他用户信息",
        )
    with SessionFactory2() as db:
        user = db.query(User).filter(User.uuid == uuid).first()
        if not user:
            return fail("用户不存在", code=404)
        third = (
            db.query(UserThirdPartyAccount)
            .filter(
                UserThirdPartyAccount.user_uuid == uuid,
                UserThirdPartyAccount.platform == platform,
                UserThirdPartyAccount.deleted_at.is_(None),
            )
            .first()
        )
        return success(
            {
                "uuid": user.uuid,
                "nickname": user.nickname,
                "avatar": user.avatar,
                "isVip": bool(user.is_vip),
                "status": user.status,
                "thirdPartyAccounts": (
                    {
                        "openId": third.open_id if third else None,
                        "unionId": third.union_id if third else None,
                        "platform": third.platform if third else None,
                    }
                    if third
                    else None
                ),
            }
        )


# ---------------------------------------------------------------------------
# 3. 上传名片
# ---------------------------------------------------------------------------


@router.post("/uploadBusinessCard")
async def upload_business_card(
    body: BusinessCardReq,
    platform: str = Header(default="unknown", alias="X-Device-Type"),
    user_uuid: str = Depends(require_login),
):
    """对应 Java: POST /remote/uploadBusinessCard -- 上传 base64 名片到 MinIO."""
    if not body.id or not body.card:
        return fail("缺少用户 id 或名片内容", code=400)
    # MinIO 上传 (复用已有 client)
    try:
        from app.utils.minio_client import upload_base64_image

        url = upload_base64_image(body.card, prefix="cards", filename=body.fileName)
    except Exception as e:
        logger.error(f"名片上传失败: {e}")
        return fail(f"上传失败: {e}", code=500)
    # 这里把 url 写回 user.avatar (业务示意)
    with SessionFactory2() as db:
        user = db.query(User).filter(User.uuid == body.id).first()
        if user:
            user.avatar = url
            db.commit()
    return success({"url": url})


# ---------------------------------------------------------------------------
# 4. 可购买身份
# ---------------------------------------------------------------------------


@router.get("/role")
async def get_role(user_uuid: str = Depends(require_login)):
    """对应 Java: GET /remote/role -- 列出所有可购买的 ZhsProductIdentity."""
    with SessionFactory2() as db:
        items = db.query(ProductIdentity).filter(ProductIdentity.status == 1).order_by(ProductIdentity.sort.asc()).all()
        return success(
            [
                {
                    "id": p.id,
                    "name": p.name,
                    "description": p.description,
                    "price": p.price,
                    "tokenAmount": p.token_amount,
                    "identityType": p.identity_type,
                    "durationDays": p.duration_days,
                }
                for p in items
            ]
        )


# ---------------------------------------------------------------------------
# 5. 智能体类型 (两个变体, 对应 Java category + category2)
# ---------------------------------------------------------------------------


@router.get("/agent/category")
async def agent_category(
    type: str | None = Query(default=None, alias="type"),
    user_uuid: str = Depends(require_login),
):
    """对应 Java: GET /remote/agent/category?type=xxx -- ResponseResultInfo 包装."""
    with SessionFactory2() as db:
        q = db.query(AgentCategory)
        if type:
            q = q.filter(AgentCategory.type == type)
        items = q.all()
        return success(
            [
                {
                    "id": c.id,
                    "agentId": c.agent_id,
                    "group": c.group,
                    "type": c.type,
                    "typeChild": c.type_child,
                    "limitFree": c.limit_free,
                    "account": c.account,
                }
                for c in items
            ]
        )


@router.get("/agent/category2")
async def agent_category2(
    type: str | None = Query(default=None, alias="type"),
    user_uuid: str = Depends(require_login),
):
    """对应 Java: GET /remote/agent/category2 -- AjaxResult 包装 (与上同结构)."""
    return await agent_category(type=type, user_uuid=user_uuid)


# ---------------------------------------------------------------------------
# 6. 按类型查智能体
# ---------------------------------------------------------------------------


@router.get("/agent/by/type")
async def agent_by_type(
    search: str | None = None,
    code: str | None = None,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, le=100),
    user_uuid: str = Depends(require_login),
):
    """对应 Java: GET /remote/agent/by/type?search=&code="""
    with SessionFactory2() as db:
        q = db.query(Agent)
        if code:
            q = q.filter(Agent.category == code)
        if search:
            q = q.filter(Agent.agent_name.contains(search))
        items, total = paginate(q.order_by(Agent.created_at.desc()), page, size)
        return success(
            {
                "list": [
                    {
                        "agentId": a.agent_id,
                        "agentName": a.agent_name,
                        "agentDescription": a.agent_description,
                        "agentAvatar": a.agent_avatar,
                        "category": a.category,
                        "publishStatus": a.publish_status,
                    }
                    for a in items
                ],
                "total": total,
                "page": page,
                "size": size,
            }
        )


# ---------------------------------------------------------------------------
# 7. 收藏的智能体
# ---------------------------------------------------------------------------


@router.get("/agent/by/collect/{uuid}")
async def agent_by_collect(
    uuid: str = Path(...),
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, le=100),
    user_uuid: str = Depends(require_login),
):
    """对应 Java: GET /remote/agent/by/collect/{uuid}?search= (查收藏表, 此处简化)."""
    # 收藏通常存 Redis set: zhs:collect:{user_uuid} → [agent_id]
    from app.utils.redis_util import get_redis

    r = get_redis()
    key = f"zhs:collect:{uuid}"
    try:
        collected_ids = list(r.smembers(key))
    except Exception:
        collected_ids = []

    if not collected_ids:
        return success({"list": [], "total": 0, "page": page, "size": size})

    with SessionFactory2() as db:
        q = db.query(Agent).filter(Agent.agent_id.in_(collected_ids))
        if search:
            q = q.filter(Agent.agent_name.contains(search))
        items, total = paginate(q, page, size)
        return success(
            {
                "list": [
                    {
                        "agentId": a.agent_id,
                        "agentName": a.agent_name,
                        "agentAvatar": a.agent_avatar,
                    }
                    for a in items
                ],
                "total": total,
                "page": page,
                "size": size,
            }
        )


# ---------------------------------------------------------------------------
# 8. 购买的智能体
# ---------------------------------------------------------------------------


@router.get("/agent/by/pay")
async def agent_by_pay(
    uuid: str = Query(...),
    search: str | None = None,
    type: int | None = None,
    date: str | None = None,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, le=100),
    user_uuid: str = Depends(require_login),
):
    """对应 Java: GET /remote/agent/by/pay?uuid=&search=&type=&date="""
    from datetime import datetime

    with SessionFactory2() as db:
        q = (
            db.query(Agent)
            .join(AgentBuy, AgentBuy.agent_id == Agent.agent_id)
            .filter(
                AgentBuy.bug_uuid == uuid,  # 历史表字段 bug_uuid = 买家 UUID
            )
        )
        if type is not None:
            q = q.filter(AgentBuy.status == type)
        if date:
            try:
                d = datetime.strptime(date, "%Y-%m-%d")
                q = q.filter(AgentBuy.created_at >= d)
            except ValueError:
                pass
        if search:
            q = q.filter(Agent.agent_name.contains(search))
        items, total = paginate(q.order_by(AgentBuy.created_at.desc()), page, size)
        return success(
            {
                "list": [
                    {
                        "agentId": a.agent_id,
                        "agentName": a.agent_name,
                        "agentAvatar": a.agent_avatar,
                    }
                    for a in items
                ],
                "total": total,
                "page": page,
                "size": size,
            }
        )


# ---------------------------------------------------------------------------
# 9. 腾讯云一句话 ASR (代理)
# ---------------------------------------------------------------------------


@router.post("/get/tencent/sentence")
async def tencent_asr(body: TencentAsrReq, user_uuid: str = Depends(require_login)):
    """对应 Java: POST /remote/get/tencent/sentence -- 调用腾讯云一句话识别.

    Java 端直接用腾讯云 SDK.
    Python 这边如果想保真实现需安装 tencentcloud-sdk-python, 此处用占位实现
    (返回模拟结果, 生产部署时配置 TENCENT_SECRET_ID/SECRET_KEY 后切换为真实 SDK).
    """
    secret_id = getattr(settings, "TENCENT_SECRET_ID", "")
    secret_key = getattr(settings, "TENCENT_SECRET_KEY", "")
    if not (secret_id and secret_key):
        return fail("腾讯云 ASR 未配置 (TENCENT_SECRET_ID/SECRET_KEY)", code=500)
    if not body.file:
        return fail("参数异常, 缺少 file", code=400)
    try:
        from tencentcloud.asr.v20190614 import asr_client, models
        from tencentcloud.common import credential
        from tencentcloud.common.profile.client_profile import ClientProfile
        from tencentcloud.common.profile.http_profile import HttpProfile

        cred = credential.Credential(secret_id, secret_key)
        http = HttpProfile()
        http.endpoint = "asr.tencentcloudapi.com"
        profile = ClientProfile(httpProfile=http)
        client = asr_client.AsrClient(cred, "ap-beijing", profile)
        req = models.SentenceRecognitionRequest()
        req.EngSerViceType = "16k_zh-PY"
        req.VoiceFormat = "mp3"
        req.SourceType = 0
        req.Url = body.file
        resp = client.SentenceRecognition(req)
        return success(
            {
                "text": resp.Result,
                "audioDuration": resp.AudioDuration,
            }
        )
    except ImportError:
        return fail("tencentcloud-sdk-python 未安装", code=500)
    except Exception as e:
        logger.error(f"腾讯 ASR 失败: {e}")
        return fail(f"识别失败: {e}", code=500)


# ---------------------------------------------------------------------------
# 10. 提现开关
# ---------------------------------------------------------------------------


@router.get("/get/true")
async def get_withdrawal_open(user_uuid: str = Depends(require_login)):
    """对应 Java: GET /remote/get/true -- 查 ZhsWithdrawalFlow id=1.status==1 → true."""
    from app.models.payment_models import WithdrawalFlow

    with SessionFactory2() as db:
        flow = db.query(WithdrawalFlow).filter(WithdrawalFlow.id == 1).first()
        return success(bool(flow and flow.status == 1))


# ---------------------------------------------------------------------------
# 11. 远程三方分组排行
# ---------------------------------------------------------------------------


@third_router.get("/group/list")
async def third_group_list(user_uuid: str = Depends(require_login)):
    """对应 Java: GET /remote/third/group/list -- 不同榜单数据 (按 group 分组的排行)."""
    # TODO: 接入真实排行榜数据，当前为占位 mock
    return success(
        {
            "groups": [
                {"group": "agent_top", "items": []},
                {"group": "user_top", "items": []},
                {"group": "course_top", "items": []},
            ]
        }
    )
