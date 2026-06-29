"""资源水印 API 端点.

迁移自 ZHS_Server_java/small/controller/ResourceNowController.java
中水印相关功能(图片/视频水印)补充.
"""


from fastapi import APIRouter, Body

from app.schemas.common import success, error
from app.schemas.error_codes import ErrorCode
from app.utils.image_watermark import add_image_watermark, add_text_watermark
from app.utils.video_watermark import add_image_watermark_video, add_text_watermark_video

router = APIRouter(prefix="/api/resource/watermark", tags=["资源水印"])


@router.post("/image/text", summary="给图片添加文字水印")
async def image_text_watermark(
    payload: dict = Body(...),
):
    input_path = payload.get("input_path", "")
    text = payload.get("text", "")
    output_path = payload.get("output_path")
    font_size = int(payload.get("font_size", 24))
    position = payload.get("position", "bottom-right")
    color_r = int(payload.get("color_r", 255))
    color_g = int(payload.get("color_g", 255))
    color_b = int(payload.get("color_b", 255))
    opacity = int(payload.get("opacity", 128))
    if not input_path or not text:
        return error("缺少 input_path 或 text", ErrorCode.BAD_REQUEST)
    data = add_text_watermark(
        image_path=input_path, text=text, output_path=output_path,
        font_size=font_size, color=(color_r, color_g, color_b),
        opacity=opacity, position=position,
    )
    if not data:
        return error("添加水印失败", ErrorCode.INTERNAL_ERROR)
    return success({"size": len(data)})


@router.post("/image/logo", summary="给图片添加 logo 水印")
async def image_logo_watermark(payload: dict = Body(...)):
    base_path = payload.get("base_path", "")
    logo_path = payload.get("logo_path", "")
    output_path = payload.get("output_path")
    position = payload.get("position", "bottom-right")
    scale = float(payload.get("scale", 0.15))
    opacity = int(payload.get("opacity", 128))
    if not base_path or not logo_path:
        return error("缺少 base_path 或 logo_path", ErrorCode.BAD_REQUEST)
    data = add_image_watermark(
        base_path=base_path, logo_path=logo_path, output_path=output_path,
        position=position, scale=scale, opacity=opacity,
    )
    if not data:
        return error("添加水印失败", ErrorCode.INTERNAL_ERROR)
    return success({"size": len(data)})


@router.post("/video/text", summary="给视频添加文字水印")
async def video_text_watermark(payload: dict = Body(...)):
    input_path = payload.get("input_path", "")
    text = payload.get("text", "")
    output_path = payload.get("output_path")
    font_size = int(payload.get("font_size", 24))
    font_color = payload.get("font_color", "white")
    position = payload.get("position", "bottom-right")
    if not input_path or not text:
        return error("缺少 input_path 或 text", ErrorCode.BAD_REQUEST)
    result = add_text_watermark_video(
        input_path=input_path, text=text, output_path=output_path,
        font_size=font_size, font_color=font_color, position=position,
    )
    if not result:
        return error("添加视频水印失败", ErrorCode.INTERNAL_ERROR)
    return success({"output_path": result})


@router.post("/video/logo", summary="给视频添加 logo 水印")
async def video_logo_watermark(payload: dict = Body(...)):
    input_path = payload.get("input_path", "")
    logo_path = payload.get("logo_path", "")
    output_path = payload.get("output_path")
    position = payload.get("position", "bottom-right")
    if not input_path or not logo_path:
        return error("缺少 input_path 或 logo_path", ErrorCode.BAD_REQUEST)
    result = add_image_watermark_video(
        input_path=input_path, logo_path=logo_path, output_path=output_path,
        position=position,
    )
    if not result:
        return error("添加视频 logo 水印失败", ErrorCode.INTERNAL_ERROR)
    return success({"output_path": result})
