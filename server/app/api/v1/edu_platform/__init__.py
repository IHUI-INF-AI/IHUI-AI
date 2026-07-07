"""教育平台后端模块路由聚合 (2026-07-06)

从旧 Java Spring Boot 项目迁移到 Python FastAPI.
各子模块 prefix 在此统一添加:
    /auth            认证模块
    /setting         设置模块
    /content         内容模块
    /member          教育会员模块
    /user-center     用户中心模块
    /pay             支付模块
    /oss             文件上传模块
    /learn           课程学习模块
    /exam            考试模块
    /resource        资源模块
    /circle          圈子模块
    /comment         评论模块
    /ask             问答模块
    /live            直播模块
    /point           积分模块
    /message         消息模块
    /search          搜索模块
    /statistics      统计模块
    /index           首页配置模块
    /topic           专题模块
    /order           订单模块
    /visit-tracking  访问统计模块
    /notification    通知模块
    /schedule        调度模块
    /behavior        行为模块
"""
from fastapi import APIRouter
from loguru import logger

router = APIRouter(tags=["Edu Platform"])

from app.api.v1.edu_platform import (  # noqa: E402
    auth, setting, content, member, usercenter, pay, oss,
    learn, exam, resource, circle, comment, ask,
    live, point, message, search, statistics, index, topic,
    order, visit_tracking, notification, schedule, behavior,
)

# 基础模块 (7)
router.include_router(auth.router, prefix="/auth")
router.include_router(setting.router, prefix="/setting")
router.include_router(content.router, prefix="/content")
router.include_router(member.router, prefix="/member")
router.include_router(usercenter.router, prefix="/user-center")
router.include_router(pay.router, prefix="/pay")
router.include_router(oss.router, prefix="/oss")

# 教育核心模块 (15)
router.include_router(learn.router, prefix="/learn")
router.include_router(exam.router, prefix="/exam")
router.include_router(resource.router, prefix="/resource")
router.include_router(circle.router, prefix="/circle")
router.include_router(comment.router, prefix="/comment")
router.include_router(ask.router, prefix="/ask")
router.include_router(live.router, prefix="/live")
router.include_router(point.router, prefix="/point")
router.include_router(message.router, prefix="/message")
router.include_router(search.router, prefix="/search")
router.include_router(statistics.router, prefix="/statistics")
router.include_router(index.router, prefix="/index")
router.include_router(topic.router, prefix="/topic")

# 补充模块 (5) - 旧项目微服务
router.include_router(order.router, prefix="/order")
router.include_router(order.router, prefix="/order-api")
router.include_router(visit_tracking.router, prefix="/visit-tracking")
router.include_router(notification.router, prefix="/notification")
router.include_router(schedule.router, prefix="/schedule")
router.include_router(behavior.router, prefix="/behavior")

logger.info("[edu_platform] 路由聚合完成: 7 基础 + 15 核心 + 5 补充 = 27 模块")
