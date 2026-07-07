"""教育平台 API 路由聚合 (2026-07-04)

将现有教育业务模块统一挂载到 /edu 前缀下,
使前端 /api/v1/edu/{module}/* 调用能路由到正确的后端端点.

迁移说明:
  教育平台源码已迁移到项目内 (2026-06-26),
  前端 client/src/api/edu/index.ts 调用 /api/v1/edu/* 前缀,
  后端教育业务模块原挂载在 /api/v1/{module}/* 下,
  此聚合路由桥接前后端路径差异.

  挂载后路径示例:
    前端调用: /api/v1/edu/learn/lesson/list
    路由匹配: /edu (本聚合) + /learn (learn 模块 prefix) + /lesson/list (端点)
    = /api/v1/edu/learn/lesson/list  ✓

注意:
  - 原有 /api/v1/{module}/* 挂载保留不变 (向后兼容)
  - 此聚合仅增加 /edu 前缀的访问路径, 不修改原路由逻辑
  - member 模块是企业会员体系, 与前端教育会员领域模型不同, 需前端适配
"""
from fastapi import APIRouter
from loguru import logger

# 教育业务模块导入 (与 router.py 保持一致的容错处理)
edu_sub_routers: list[tuple[str, APIRouter]] = []

try:
    from app.api.v1.learn import router as learn_router
    edu_sub_routers.append(("learn", learn_router))
except Exception as _e:
    logger.warning(f"[edu] 路由模块 learn 导入失败, 已跳过: {_e}")

try:
    from app.api.v1.ask import router as ask_router
    edu_sub_routers.append(("ask", ask_router))
except Exception as _e:
    logger.warning(f"[edu] 路由模块 ask 导入失败, 已跳过: {_e}")

try:
    from app.api.v1.circle import router as circle_router
    edu_sub_routers.append(("circle", circle_router))
except Exception as _e:
    logger.warning(f"[edu] 路由模块 circle 导入失败, 已跳过: {_e}")

try:
    from app.api.v1.exam import router as exam_router
    edu_sub_routers.append(("exam", exam_router))
except Exception as _e:
    logger.warning(f"[edu] 路由模块 exam 导入失败, 已跳过: {_e}")

try:
    from app.api.v1.live import router as live_router
    edu_sub_routers.append(("live", live_router))
except Exception as _e:
    logger.warning(f"[edu] 路由模块 live 导入失败, 已跳过: {_e}")

try:
    from app.api.v1.certificate import router as certificate_router
    edu_sub_routers.append(("certificate", certificate_router))
except Exception as _e:
    logger.warning(f"[edu] 路由模块 certificate 导入失败, 已跳过: {_e}")

try:
    from app.api.v1.member import router as member_router
    edu_sub_routers.append(("member", member_router))
except Exception as _e:
    logger.warning(f"[edu] 路由模块 member 导入失败, 已跳过: {_e}")

try:
    from app.api.v1.point import router as point_router
    edu_sub_routers.append(("point", point_router))
except Exception as _e:
    logger.warning(f"[edu] 路由模块 point 导入失败, 已跳过: {_e}")

try:
    from app.api.v1.message import router as message_router
    edu_sub_routers.append(("message", message_router))
except Exception as _e:
    logger.warning(f"[edu] 路由模块 message 导入失败, 已跳过: {_e}")

try:
    from app.api.v1.notification import router as notification_router
    edu_sub_routers.append(("notification", notification_router))
except Exception as _e:
    logger.warning(f"[edu] 路由模块 notification 导入失败, 已跳过: {_e}")

try:
    from app.api.v1.search import router as search_router
    edu_sub_routers.append(("search", search_router))
except Exception as _e:
    logger.warning(f"[edu] 路由模块 search 导入失败, 已跳过: {_e}")

try:
    from app.api.v1.edu_platform import router as edu_platform_modules_router
    edu_sub_routers.append(("platform", edu_platform_modules_router))
except Exception as _e:
    logger.warning(f"[edu] edu_platform 模块导入失败, 已跳过: {_e}")

# 创建 /edu 聚合路由
router = APIRouter(prefix="/edu", tags=["Edu Platform"])

for _name, _sub_router in edu_sub_routers:
    router.include_router(_sub_router)

logger.info(f"[edu] 教育平台路由聚合完成, 已挂载 {len(edu_sub_routers)} 个子模块: "
            f"{', '.join(name for name, _ in edu_sub_routers)}")
