"""即梦 JiMeng 4.0 代理路由 -- 通过 volcengine 模块实现.

POST /jimeng4          - 文字生成图片(兼容旧路径 /cozeZhsApi/jimeng4)
"""

from fastapi import APIRouter

from app.api.v1.ai.volcengine.route import jimeng4_image as _jimeng4_image

router = APIRouter()

# 直接复用 volcengine 的即梦 4.0 实现
router.add_api_route(
    "/jimeng4",
    _jimeng4_image,
    methods=["POST"],
    summary="即梦 4.0 文字生成图片(兼容旧路径)",
)
