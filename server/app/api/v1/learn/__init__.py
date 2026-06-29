"""学习模块路由注册 (迁移自 ihui-ai-edu-learn-service)

涵盖: 课程分类/课程/章节/专题/学习地图/作业/学习记录/报名 全链路.
"""
from fastapi import APIRouter

from app.api.v1.learn.category import router as category_router
from app.api.v1.learn.homework import router as homework_router
from app.api.v1.learn.learn_map import router as learn_map_router
from app.api.v1.learn.lesson import router as lesson_router
from app.api.v1.learn.order import router as order_router
from app.api.v1.learn.record import router as record_router
from app.api.v1.learn.signup import router as signup_router
from app.api.v1.learn.topic import router as topic_router

router = APIRouter()
router.include_router(category_router, prefix="/learn", tags=["Learn"])
router.include_router(lesson_router, prefix="/learn", tags=["Learn"])
router.include_router(topic_router, prefix="/learn", tags=["Learn"])
router.include_router(learn_map_router, prefix="/learn", tags=["Learn"])
router.include_router(homework_router, prefix="/learn", tags=["Learn"])
router.include_router(record_router, prefix="/learn", tags=["Learn"])
router.include_router(signup_router, prefix="/learn", tags=["Learn"])
router.include_router(order_router, prefix="/learn", tags=["Learn"])
