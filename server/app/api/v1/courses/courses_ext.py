"""教育平台扩展端点 -- 视频 / 分类 / 平台 / 支付 / 评论 / 日志 / 用户绑定 全量 CRUD."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from loguru import logger
from pydantic import BaseModel, Field

from app.database import SessionFactory3
from app.schemas.common import error, success
from app.security import require_login
from app.services.order_service import create_order
from app.services.token_service import check_user_token, deduct_user_token

router = APIRouter()


# ===========================================================================
# Pydantic Schemas
# ===========================================================================


class VideoCreate(BaseModel):
    course_id: int
    title: str = Field(..., min_length=1, max_length=200)
    subtitle: str | None = None
    content: str | None = None
    video_path: str = Field(..., min_length=1, max_length=500)
    duration: int | None = None
    adjunct_url: str | None = None
    is_pay: int = 0
    amount: float | None = None
    lecturer: str | None = None
    label: str | None = None
    stage: str | None = None
    sort: int = 0
    binding: str | None = None
    remark: str | None = None


class VideoBatchCreate(BaseModel):
    course_id: int
    videos: list[VideoCreate]


class VideoUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    subtitle: str | None = None
    content: str | None = None
    video_path: str | None = None
    duration: int | None = None
    adjunct_url: str | None = None
    is_pay: int | None = None
    amount: float | None = None
    lecturer: str | None = None
    label: str | None = None
    stage: str | None = None
    sort: int | None = None
    status: int | None = None
    binding: str | None = None
    remark: str | None = None
    audit_status: int | None = None


class PlatformCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    domain: str | None = None
    remark: str | None = None
    binding: str | None = None
    file_path: str | None = None
    type: int | None = None
    status: int = 1
    sort: int = 0


class PlatformUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    domain: str | None = None
    remark: str | None = None
    binding: str | None = None
    file_path: str | None = None
    type: int | None = None
    status: int | None = None
    sort: int | None = None


class CommentCreate(BaseModel):
    course_id: int
    content: str = Field(..., min_length=1, max_length=500)
    star: int = Field(5, ge=1, le=5)
    parent_id: int | None = None
    nickname: str = ""


class UserPlatformBind(BaseModel):
    platform_id: int
    account: str | None = None
    remark: str | None = None


# ===========================================================================
# 1. 视频列表(按课程过滤)
# ===========================================================================


@router.get("/videos", summary="课程视频列表")
async def list_videos(
    course_id: int = Query(...),
    is_pay: int = Query(None, description="0 免费 1 付费"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = SessionFactory3()
    try:
        from app.models.course_models import CourseVideo

        q = db.query(CourseVideo).filter(CourseVideo.course_id == course_id, CourseVideo.status == 1)
        if is_pay is not None:
            q = q.filter(CourseVideo.is_pay == is_pay)
        total = q.count()
        items = q.order_by(CourseVideo.sort, CourseVideo.id).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": v.id,
                "title": v.title,
                "subtitle": v.subtitle,
                "video_path": v.video_path,
                "duration": v.duration,
                "is_pay": v.is_pay,
                "amount": v.amount,
                "lecturer": v.lecturer,
            }
            for v in items
        ]
        return success(data, total=total)
    finally:
        db.close()


@router.get("/videos/{video_id}", summary="视频详情")
async def get_video(video_id: int):
    db = SessionFactory3()
    try:
        from app.models.course_models import CourseVideo

        v = db.query(CourseVideo).filter(CourseVideo.id == video_id).first()
        if not v:
            return error("视频不存在")
        return success(
            {
                "id": v.id,
                "title": v.title,
                "subtitle": v.subtitle,
                "content": v.content,
                "video_path": v.video_path,
                "duration": v.duration,
                "is_pay": v.is_pay,
                "amount": v.amount,
                "lecturer": v.lecturer,
                "label": v.label,
                "stage": v.stage,
            }
        )
    finally:
        db.close()


# ===========================================================================
# 2. 视频 CRUD -- create / batch / update / delete / move / issue / my
# ===========================================================================


@router.post("/videos/create", summary="创建视频")
async def create_video(body: VideoCreate, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from app.models.course_models import CourseVideo

        video = CourseVideo(
            course_id=body.course_id,
            title=body.title,
            subtitle=body.subtitle,
            content=body.content,
            video_path=body.video_path,
            duration=body.duration,
            adjunct_url=body.adjunct_url,
            is_pay=body.is_pay,
            amount=body.amount,
            lecturer=body.lecturer,
            label=body.label,
            stage=body.stage,
            sort=body.sort,
            binding=body.binding,
            remark=body.remark,
            status=1,
            audit_status=0,
            creator=user_uuid,
        )
        db.add(video)
        db.commit()
        db.refresh(video)
        return success({"id": video.id, "title": video.title})
    except Exception as e:
        db.rollback()
        logger.error(f"Create video error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.post("/videos/batch", summary="批量创建视频")
async def batch_create_videos(body: VideoBatchCreate, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from app.models.course_models import CourseVideo

        created_ids = []
        for v in body.videos:
            video = CourseVideo(
                course_id=body.course_id,
                title=v.title,
                subtitle=v.subtitle,
                content=v.content,
                video_path=v.video_path,
                duration=v.duration,
                adjunct_url=v.adjunct_url,
                is_pay=v.is_pay,
                amount=v.amount,
                lecturer=v.lecturer,
                label=v.label,
                stage=v.stage,
                sort=v.sort,
                binding=v.binding,
                remark=v.remark,
                status=1,
                audit_status=0,
                creator=user_uuid,
            )
            db.add(video)
            db.flush()
            created_ids.append(video.id)
        db.commit()
        return success({"ids": created_ids, "count": len(created_ids)})
    except Exception as e:
        db.rollback()
        logger.error(f"Batch create videos error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.put("/videos/{video_id}", summary="更新视频")
async def update_video(video_id: int, body: VideoUpdate, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from app.models.course_models import CourseVideo

        video = db.query(CourseVideo).filter(CourseVideo.id == video_id).first()
        if not video:
            return error("视频不存在")
        update_data = body.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(video, key, value)
        db.commit()
        return success({"id": video.id})
    except Exception as e:
        db.rollback()
        logger.error(f"Update video error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.delete("/videos/{video_id}", summary="删除视频")
async def delete_video(video_id: int, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from app.models.course_models import CourseVideo

        video = db.query(CourseVideo).filter(CourseVideo.id == video_id).first()
        if not video:
            return error("视频不存在")
        db.delete(video)
        db.commit()
        return success({"id": video_id})
    except Exception as e:
        db.rollback()
        logger.error(f"Delete video error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.post("/videos/{video_id}/move", summary="移动视频到其他课程")
async def move_video(
    video_id: int,
    target_course_id: int = Query(..., description="目标课程 ID"),
    user_uuid: str = Depends(require_login),
):
    db = SessionFactory3()
    try:
        from app.models.course_models import Course, CourseVideo

        video = db.query(CourseVideo).filter(CourseVideo.id == video_id).first()
        if not video:
            return error("视频不存在")
        target = db.query(Course).filter(Course.id == target_course_id, Course.is_del == 0).first()
        if not target:
            return error("目标课程不存在")
        old_course_id = video.course_id
        video.course_id = target_course_id
        db.commit()
        return success({"id": video_id, "old_course_id": old_course_id, "new_course_id": target_course_id})
    except Exception as e:
        db.rollback()
        logger.error(f"Move video error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.post("/videos/{video_id}/issue", summary="视频发布/下架")
async def issue_video(video_id: int, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from app.models.course_models import CourseVideo

        video = db.query(CourseVideo).filter(CourseVideo.id == video_id).first()
        if not video:
            return error("视频不存在")
        video.status = 0 if video.status == 1 else 1
        db.commit()
        return success({"id": video_id, "status": video.status})
    except Exception as e:
        db.rollback()
        logger.error(f"Issue video error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.get("/videos/my", summary="我创建的视频")
async def my_videos(
    user_uuid: str = Depends(require_login),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = SessionFactory3()
    try:
        from app.models.course_models import CourseVideo

        q = db.query(CourseVideo).filter(CourseVideo.creator == user_uuid)
        total = q.count()
        items = q.order_by(CourseVideo.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": v.id,
                "title": v.title,
                "course_id": v.course_id,
                "video_path": v.video_path,
                "duration": v.duration,
                "status": v.status,
                "audit_status": v.audit_status,
                "is_pay": v.is_pay,
                "amount": v.amount,
            }
            for v in items
        ]
        return success(data, total=total)
    finally:
        db.close()


# ===========================================================================
# 3. 课程分类(裸 SQL,分类表 zhs_course_category)
# ===========================================================================


@router.get("/categories", summary="课程分类列表")
async def list_categories(status: int = Query(1, description="0 禁用 1 启用")):
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        rows = db.execute(
            text(
                "SELECT id, name, code, sort, parent_id, icon "
                "FROM zhs_course_category WHERE status = :s ORDER BY sort"
            ),
            {"s": status},
        ).fetchall()
        data = [{"id": r[0], "name": r[1], "code": r[2], "sort": r[3], "parent_id": r[4], "icon": r[5]} for r in rows]
        return success(data, total=len(data))
    except Exception as e:
        logger.error(f"List categories error (table may not exist): {e}")
        return success([], total=0)
    finally:
        db.close()


@router.get("/categories/{category_id}/parent", summary="查询分类的父级链")
async def get_category_parent(category_id: int):
    """递归查询分类的父级链,返回从根到当前节点的完整路径."""
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        chain = []
        current_id = category_id
        visited = set()
        while current_id and current_id not in visited:
            visited.add(current_id)
            row = db.execute(
                text("SELECT id, name, code, parent_id FROM zhs_course_category WHERE id = :id"),
                {"id": current_id},
            ).fetchone()
            if not row:
                break
            chain.append({"id": row[0], "name": row[1], "code": row[2], "parent_id": row[3]})
            current_id = row[3]
        chain.reverse()
        return success(chain, total=len(chain))
    except Exception as e:
        logger.error(f"Get category parent error: {e}")
        return success([], total=0)
    finally:
        db.close()


# ===========================================================================
# 4. 教育平台列表 / 详情 / CRUD
# ===========================================================================


@router.get("/platforms", summary="教育平台列表")
async def list_platforms(
    status: int = Query(1),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
):
    db = SessionFactory3()
    try:
        from app.models.course_models import EducationPlatform

        q = db.query(EducationPlatform).filter(
            EducationPlatform.status == status,
            EducationPlatform.is_del == 0,
        )
        total = q.count()
        items = q.order_by(EducationPlatform.sort, EducationPlatform.id).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "domain": p.domain,
                "file_path": p.file_path,
                "sort": p.sort,
                "type": p.type,
            }
            for p in items
        ]
        return success(data, total=total)
    finally:
        db.close()


@router.get("/platforms/{code}", summary="教育平台详情")
async def get_platform(code: str):
    db = SessionFactory3()
    try:
        from app.models.course_models import EducationPlatform

        p = db.query(EducationPlatform).filter(EducationPlatform.code == code).first()
        if not p:
            return error("平台不存在")
        return success(
            {
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "domain": p.domain,
                "remark": p.remark,
                "binding": p.binding,
                "file_path": p.file_path,
            }
        )
    finally:
        db.close()


@router.post("/platforms/create", summary="创建教育平台")
async def create_platform(body: PlatformCreate, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from app.models.course_models import EducationPlatform

        existing = db.query(EducationPlatform).filter(EducationPlatform.code == body.code).first()
        if existing:
            return error("平台编码已存在")
        platform = EducationPlatform(
            code=body.code,
            name=body.name,
            domain=body.domain,
            remark=body.remark,
            binding=body.binding,
            file_path=body.file_path,
            type=body.type,
            status=body.status,
            sort=body.sort,
            is_del=0,
            is_hidden=0,
        )
        db.add(platform)
        db.commit()
        db.refresh(platform)
        return success({"id": platform.id, "code": platform.code})
    except Exception as e:
        db.rollback()
        logger.error(f"Create platform error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.put("/platforms/{platform_id}", summary="更新教育平台")
async def update_platform(platform_id: int, body: PlatformUpdate, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from app.models.course_models import EducationPlatform

        p = (
            db.query(EducationPlatform)
            .filter(EducationPlatform.id == platform_id, EducationPlatform.is_del == 0)
            .first()
        )
        if not p:
            return error("平台不存在")
        update_data = body.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(p, key, value)
        db.commit()
        return success({"id": p.id})
    except Exception as e:
        db.rollback()
        logger.error(f"Update platform error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.delete("/platforms/{platform_id}", summary="删除教育平台(软删除)")
async def delete_platform(platform_id: int, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from app.models.course_models import EducationPlatform

        p = (
            db.query(EducationPlatform)
            .filter(EducationPlatform.id == platform_id, EducationPlatform.is_del == 0)
            .first()
        )
        if not p:
            return error("平台不存在")
        p.is_del = 1
        db.commit()
        return success({"id": platform_id})
    except Exception as e:
        db.rollback()
        logger.error(f"Delete platform error: {e}")
        return error(str(e))
    finally:
        db.close()


# ===========================================================================
# 5. 课程支付(生成订单,扣 token 模式)
# ===========================================================================


@router.post("/pay", summary="课程支付(先用 token 扣减)")
async def pay_course(
    course_id: int = Query(...),
    cost_tokens: int = Query(..., description="所需 token"),
    pay_type: int = Query(0, description="0 token 1 微信 2 支付宝"),
    user_uuid: str = Depends(require_login),
):
    if pay_type == 0:
        check = check_user_token(user_uuid, cost_tokens)
        if not check["sufficient"]:
            return error(f"token 余额不足: 当前 {check['current_balance']}")
        result = deduct_user_token(user_uuid, cost_tokens, desc=f"课程购买:{course_id}")
        if not result["success"]:
            return error(result.get("reason"))
        return success(
            {
                "course_id": course_id,
                "pay_type": pay_type,
                "cost": cost_tokens,
                "balance": result["balance"],
                "paid": True,
            }
        )
    # 微信/支付宝生成订单
    order = create_order(
        user_uuid,
        cost_tokens * 100,
        order_type=4,
        product_id=str(course_id),
        pay_type=f"course_{pay_type}",
    )
    if not order["success"]:
        return error(order["msg"])
    return success(
        {
            "course_id": course_id,
            "out_trade_no": order["out_trade_no"],
            "pay_type": pay_type,
            "amount": cost_tokens * 100,
        }
    )


# ===========================================================================
# 6. 支付日志(裸 SQL 表 zhs_course_pay_log)
# ===========================================================================


@router.get("/pay-logs", summary="课程支付日志列表")
async def list_pay_logs(
    course_id: int = Query(None),
    user_id: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _: str = Depends(require_login),
):
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        where = "WHERE 1=1"
        params: dict = {}
        if course_id is not None:
            where += " AND course_id = :cid"
            params["cid"] = course_id
        if user_id:
            where += " AND user_id = :uid"
            params["uid"] = user_id
        total = db.execute(text(f"SELECT COUNT(*) FROM zhs_course_pay_log {where}"), params).scalar() or 0
        params["lim"] = limit
        params["off"] = (page - 1) * limit
        rows = db.execute(
            text(
                f"SELECT id, course_id, user_id, pay_type, amount, status, created_at "
                f"FROM zhs_course_pay_log {where} ORDER BY id DESC LIMIT :lim OFFSET :off"
            ),
            params,
        ).fetchall()
        data = [
            {
                "id": r[0],
                "course_id": r[1],
                "user_id": r[2],
                "pay_type": r[3],
                "amount": r[4],
                "status": r[5],
                "created_at": r[6].isoformat() if r[6] else None,
            }
            for r in rows
        ]
        return success(data, total=total)
    except Exception as e:
        logger.error(f"List pay logs error: {e}")
        return success([], total=0)
    finally:
        db.close()


# ===========================================================================
# 7. 课程评论(裸 SQL 表 zhs_course_comment / zhs_user_video_comment)
# ===========================================================================


@router.get("/comments", summary="课程评论列表")
async def list_comments(
    course_id: int = Query(...),
    parent_id: int = Query(None, description="父评论 ID,不传则只查顶级"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        where = "WHERE course_id = :cid AND is_del = 0"
        params: dict = {"cid": course_id}
        if parent_id is not None:
            where += " AND parent_id = :pid"
            params["pid"] = parent_id
        else:
            where += " AND (parent_id = 0 OR parent_id IS NULL)"
        rows = db.execute(
            text(
                f"SELECT id, user_id, nickname, content, star, parent_id, created_at "
                f"FROM zhs_course_comment {where} ORDER BY id DESC LIMIT :lim OFFSET :off"
            ),
            {**params, "lim": limit, "off": (page - 1) * limit},
        ).fetchall()
        total = db.execute(text(f"SELECT COUNT(*) FROM zhs_course_comment {where}"), params).scalar() or 0
        data = [
            {
                "id": r[0],
                "user_id": r[1],
                "nickname": r[2],
                "content": r[3],
                "star": r[4],
                "parent_id": r[5],
                "created_at": r[6].isoformat() if r[6] else None,
            }
            for r in rows
        ]
        return success(data, total=total)
    except Exception as e:
        logger.error(f"List comments error: {e}")
        return success([], total=0)
    finally:
        db.close()


@router.post("/comments/create", summary="提交课程评论")
async def create_comment(body: CommentCreate, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        result = db.execute(
            text(
                "INSERT INTO zhs_course_comment "
                "(course_id, user_id, nickname, content, star, parent_id, is_del, created_at) "
                "VALUES (:cid, :uid, :nick, :content, :star, :pid, 0, :now)"
            ),
            {
                "cid": body.course_id,
                "uid": user_uuid,
                "nick": body.nickname or user_uuid[:8],
                "content": body.content,
                "star": body.star,
                "pid": body.parent_id or 0,
                "now": datetime.utcnow(),
            },
        )
        db.commit()
        return success({"id": result.lastrowid, "star": body.star, "parent_id": body.parent_id})
    except Exception as e:
        db.rollback()
        logger.error(f"Create comment error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.get("/comments/parent", summary="查询评论的父级评论")
async def get_comment_parent(comment_id: int = Query(...)):
    """查询指定评论的父级评论内容."""
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        comment = db.execute(
            text("SELECT id, parent_id FROM zhs_course_comment WHERE id = :id AND is_del = 0"),
            {"id": comment_id},
        ).fetchone()
        if not comment:
            return error("评论不存在")
        if not comment[1] or comment[1] == 0:
            return success(None, msg="该评论为顶级评论,无父级")
        parent = db.execute(
            text(
                "SELECT id, user_id, nickname, content, star, created_at "
                "FROM zhs_course_comment WHERE id = :pid AND is_del = 0"
            ),
            {"pid": comment[1]},
        ).fetchone()
        if not parent:
            return success(None, msg="父级评论不存在或已删除")
        return success(
            {
                "id": parent[0],
                "user_id": parent[1],
                "nickname": parent[2],
                "content": parent[3],
                "star": parent[4],
                "created_at": parent[5].isoformat() if parent[5] else None,
            }
        )
    except Exception as e:
        logger.error(f"Get comment parent error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.delete("/comments/{comment_id}", summary="删除评论(软删除)")
async def delete_comment(comment_id: int, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        result = db.execute(
            text("UPDATE zhs_course_comment SET is_del = 1 WHERE id = :id AND is_del = 0"),
            {"id": comment_id},
        )
        db.commit()
        if result.rowcount == 0:
            return error("评论不存在或已删除")
        return success({"id": comment_id})
    except Exception as e:
        db.rollback()
        logger.error(f"Delete comment error: {e}")
        return error(str(e))
    finally:
        db.close()


# ===========================================================================
# 8. 用户视频日志(裸 SQL 表 zhs_user_video_log)
# ===========================================================================


@router.post("/video-log", summary="记录用户视频观看日志")
async def create_video_log(
    video_id: int = Query(...),
    course_id: int = Query(...),
    progress: int = Query(0, description="观看进度(秒)"),
    duration: int = Query(0, description="视频总时长(秒)"),
    user_uuid: str = Depends(require_login),
):
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        # 检查是否已有记录,有则更新
        existing = db.execute(
            text("SELECT id FROM zhs_user_video_log WHERE user_id = :uid AND video_id = :vid"),
            {"uid": user_uuid, "vid": video_id},
        ).fetchone()
        if existing:
            db.execute(
                text(
                    "UPDATE zhs_user_video_log SET progress = :prog, duration = :dur, updated_at = :now "
                    "WHERE id = :id"
                ),
                {"prog": progress, "dur": duration, "now": datetime.utcnow(), "id": existing[0]},
            )
            db.commit()
            return success({"id": existing[0], "action": "updated"})
        result = db.execute(
            text(
                "INSERT INTO zhs_user_video_log "
                "(user_id, video_id, course_id, progress, duration, created_at, updated_at) "
                "VALUES (:uid, :vid, :cid, :prog, :dur, :now, :now)"
            ),
            {
                "uid": user_uuid,
                "vid": video_id,
                "cid": course_id,
                "prog": progress,
                "dur": duration,
                "now": datetime.utcnow(),
            },
        )
        db.commit()
        return success({"id": result.lastrowid, "action": "created"})
    except Exception as e:
        db.rollback()
        logger.error(f"Create video log error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.get("/video-log/list", summary="用户视频观看日志列表")
async def list_video_logs(
    course_id: int = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        where = "WHERE user_id = :uid"
        params: dict = {"uid": user_uuid}
        if course_id is not None:
            where += " AND course_id = :cid"
            params["cid"] = course_id
        total = db.execute(text(f"SELECT COUNT(*) FROM zhs_user_video_log {where}"), params).scalar() or 0
        params["lim"] = limit
        params["off"] = (page - 1) * limit
        rows = db.execute(
            text(
                f"SELECT id, video_id, course_id, progress, duration, created_at, updated_at "
                f"FROM zhs_user_video_log {where} ORDER BY id DESC LIMIT :lim OFFSET :off"
            ),
            params,
        ).fetchall()
        data = [
            {
                "id": r[0],
                "video_id": r[1],
                "course_id": r[2],
                "progress": r[3],
                "duration": r[4],
                "created_at": r[5].isoformat() if r[5] else None,
                "updated_at": r[6].isoformat() if r[6] else None,
            }
            for r in rows
        ]
        return success(data, total=total)
    finally:
        db.close()


# ===========================================================================
# 9. 用户操作日志(裸 SQL 表 zhs_user_comment_log / zhs_operate_log)
# ===========================================================================


@router.get("/operate/list", summary="用户操作日志列表")
async def list_operate_logs(
    type: str = Query(None, description="操作类型: comment / pay / video 等"),
    user_id: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        where = "WHERE 1=1"
        params: dict = {}
        if type:
            where += " AND type = :tp"
            params["tp"] = type
        if user_id:
            where += " AND user_id = :uid"
            params["uid"] = user_id
        total = db.execute(text(f"SELECT COUNT(*) FROM zhs_user_comment_log {where}"), params).scalar() or 0
        params["lim"] = limit
        params["off"] = (page - 1) * limit
        rows = db.execute(
            text(
                f"SELECT id, user_id, type, content, target_id, created_at "
                f"FROM zhs_user_comment_log {where} ORDER BY id DESC LIMIT :lim OFFSET :off"
            ),
            params,
        ).fetchall()
        data = [
            {
                "id": r[0],
                "user_id": r[1],
                "type": r[2],
                "content": r[3],
                "target_id": r[4],
                "created_at": r[5].isoformat() if r[5] else None,
            }
            for r in rows
        ]
        return success(data, total=total)
    except Exception as e:
        logger.error(f"List operate logs error: {e}")
        return success([], total=0)
    finally:
        db.close()


# ===========================================================================
# 10. 平台日志(裸 SQL 表 zhs_course_platform_log)
# ===========================================================================


@router.get("/platform-logs", summary="平台操作日志列表")
async def list_platform_logs(
    platform_id: int = Query(None),
    user_id: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        where = "WHERE 1=1"
        params: dict = {}
        if platform_id is not None:
            where += " AND platform_id = :pid"
            params["pid"] = platform_id
        if user_id:
            where += " AND user_id = :uid"
            params["uid"] = user_id
        total = db.execute(text(f"SELECT COUNT(*) FROM zhs_course_platform_log {where}"), params).scalar() or 0
        params["lim"] = limit
        params["off"] = (page - 1) * limit
        rows = db.execute(
            text(
                f"SELECT id, platform_id, user_id, action, content, created_at "
                f"FROM zhs_course_platform_log {where} ORDER BY id DESC LIMIT :lim OFFSET :off"
            ),
            params,
        ).fetchall()
        data = [
            {
                "id": r[0],
                "platform_id": r[1],
                "user_id": r[2],
                "action": r[3],
                "content": r[4],
                "created_at": r[5].isoformat() if r[5] else None,
            }
            for r in rows
        ]
        return success(data, total=total)
    except Exception as e:
        logger.error(f"List platform logs error: {e}")
        return success([], total=0)
    finally:
        db.close()


# ===========================================================================
# 11. 用户平台绑定(裸 SQL 表 zhs_user_platform)
# ===========================================================================


@router.post("/user-platform/bind", summary="用户绑定教育平台")
async def bind_user_platform(body: UserPlatformBind, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        existing = db.execute(
            text("SELECT id FROM zhs_user_platform WHERE user_id = :uid AND platform_id = :pid"),
            {"uid": user_uuid, "pid": body.platform_id},
        ).fetchone()
        if existing:
            return error("已绑定该平台")
        result = db.execute(
            text(
                "INSERT INTO zhs_user_platform "
                "(user_id, platform_id, account, remark, created_at) "
                "VALUES (:uid, :pid, :acc, :remark, :now)"
            ),
            {
                "uid": user_uuid,
                "pid": body.platform_id,
                "acc": body.account,
                "remark": body.remark,
                "now": datetime.utcnow(),
            },
        )
        db.commit()
        return success({"id": result.lastrowid, "platform_id": body.platform_id})
    except Exception as e:
        db.rollback()
        logger.error(f"Bind user platform error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.delete("/user-platform/unbind", summary="用户解绑教育平台")
async def unbind_user_platform(
    platform_id: int = Query(...),
    user_uuid: str = Depends(require_login),
):
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        result = db.execute(
            text("DELETE FROM zhs_user_platform WHERE user_id = :uid AND platform_id = :pid"),
            {"uid": user_uuid, "pid": platform_id},
        )
        db.commit()
        if result.rowcount == 0:
            return error("未绑定该平台")
        return success({"platform_id": platform_id})
    except Exception as e:
        db.rollback()
        logger.error(f"Unbind user platform error: {e}")
        return error(str(e))
    finally:
        db.close()


@router.get("/user-platform/my", summary="我的平台绑定列表")
async def my_platforms(user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from sqlalchemy import text

        rows = db.execute(
            text(
                "SELECT up.id, up.platform_id, up.account, up.remark, up.created_at, "
                "ep.name, ep.code "
                "FROM zhs_user_platform up "
                "LEFT JOIN zhs_education_platform ep ON up.platform_id = ep.id "
                "WHERE up.user_id = :uid ORDER BY up.id DESC"
            ),
            {"uid": user_uuid},
        ).fetchall()
        data = [
            {
                "id": r[0],
                "platform_id": r[1],
                "account": r[2],
                "remark": r[3],
                "created_at": r[4].isoformat() if r[4] else None,
                "platform_name": r[5],
                "platform_code": r[6],
            }
            for r in rows
        ]
        return success(data, total=len(data))
    except Exception as e:
        logger.error(f"My platforms error: {e}")
        return success([], total=0)
    finally:
        db.close()
