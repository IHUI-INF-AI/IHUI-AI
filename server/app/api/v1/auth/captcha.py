"""Captcha API -- generate and verify image captchas."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.utils.captcha_util import generate_captcha, verify_captcha
from app.utils.response import fail, success

router = APIRouter()


class CaptchaResponse(BaseModel):
    """Response model for captcha generation."""

    captcha_key: str
    img: str


class CaptchaVerifyRequest(BaseModel):
    """Request model for captcha verification."""

    captcha_key: str
    code: str


@router.get("/captcha", summary="获取验证码图片")
async def get_captcha():
    """Generate a new image captcha.

    Returns a ``captcha_key`` (to send back on login) and a base64-encoded
    PNG image string (to render in an ``<img>`` tag).
    """
    img_base64, captcha_key = generate_captcha()
    return success(data={"captcha_key": captcha_key, "img": img_base64})


@router.post("/captcha/verify", summary="校验验证码")
async def verify_captcha_endpoint(body: CaptchaVerifyRequest):
    """Verify a captcha submission.

    Returns success/failure.  Each captcha can only be verified once.
    """
    if not body.captcha_key or not body.code:
        return fail(msg="captcha_key and code are required")

    ok = verify_captcha(body.captcha_key, body.code)
    if ok:
        return success(msg="验证码正确")
    return fail(msg="验证码错误或已过期")
