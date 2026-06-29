"""圈子社区路由注册"""

from fastapi import APIRouter

from app.api.v1.circle.circle import router as circle_router
from app.api.v1.circle.post import router as post_router
from app.api.v1.circle.topic import router as topic_router

router = APIRouter()
router.include_router(circle_router, prefix="/circle", tags=["Circle: Circle"])
router.include_router(post_router, prefix="/circle/post", tags=["Circle: Post"])
router.include_router(topic_router, prefix="/circle", tags=["Circle: Topic"])
