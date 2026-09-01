# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌‌​‌​​‌‌‌​‍​‌‌​​‌‌​​​‌​​‌​‌‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​‌‌​‌‌‌‍​‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍​‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

"""Artifact 安全静态文件服务(2026-09-01 立,对标 Claude Artifacts)。

对话中 generate_chart 工具生成的本地 ECharts HTML 产物,通过**短期签名 token**
在 web 端聊天卡片内以 iframe 直接预览。

鉴权设计:
- iframe 无法携带 Authorization header,故文件访问端点用 URL 内嵌的短期签名
  token(30 分钟,HS256 + 独立 aud)鉴权,不依赖 JWT 中间件。
- token 签发端点走 JWT 保护(Depends(get_current_user_id)),防未登录用户任意换取。

安全约束:
- 签名 token 校验(防伪造/防过期)。
- file_name 必须是相对路径,`..` 段 / 绝对路径 / 盘符 / 以 / 开头全部拒绝;
  `resolve()` 后必须落在白名单目录(项目根 tmp/charts + tmp/artifacts)内,防路径逃逸。
- 仅允许 .html 产物(图表 Artifact 均为 .html,杜绝经 token 读取任意文件)。
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse

from app.core.config import settings
from app.core.jwt_auth import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter()

# 项目根 = G:/IHUI-AI (app/routers -> app -> ai-service -> apps -> IHUI-AI)
_PROJECT_ROOT = Path(__file__).resolve().parents[4]

# 产物文件白名单根目录(相对项目根)。token 内 file_name 必须落在其一内。
_ARTIFACT_DIRS: tuple[Path, ...] = (
    _PROJECT_ROOT / "tmp" / "charts",
    _PROJECT_ROOT / "tmp" / "artifacts",
)

# 签名 token 有效期:30 分钟(与前端 iframe 预览生命周期匹配)
TOKEN_TTL_SECONDS = 30 * 60
TOKEN_AUDIENCE = "ihui-artifacts"
TOKEN_ISSUER = "ihui-ai"
# 开发环境(jwt_secret 为空)时的本地签名密钥;生产环境 jwt_secret 必填(fail-closed)
_DEV_SIGNING_KEY = "ihui-artifacts-dev-key"


def _signing_key() -> str:
    return settings.jwt_secret or _DEV_SIGNING_KEY


def sign_artifact_token(file_name: str) -> str:
    """为产物相对路径签发短期访问 token(HS256,含 iat/exp/aud)。"""
    now = int(time.time())
    payload = {
        "file": file_name,
        "iat": now,
        "exp": now + TOKEN_TTL_SECONDS,
        "iss": TOKEN_ISSUER,
        "aud": TOKEN_AUDIENCE,
    }
    return pyjwt.encode(payload, _signing_key(), algorithm="HS256")


def verify_artifact_token(token: str) -> str | None:
    """校验签名 token,返回其中携带的相对路径;无效/过期返回 None。"""
    try:
        payload = pyjwt.decode(
            token,
            _signing_key(),
            algorithms=["HS256"],
            issuer=TOKEN_ISSUER,
            audience=TOKEN_AUDIENCE,
        )
    except pyjwt.PyJWTError:
        return None
    file_name = payload.get("file")
    if not isinstance(file_name, str) or not file_name:
        return None
    return file_name


def validate_and_resolve(file_name: str) -> Path:
    """校验相对路径并解析到白名单目录内的绝对路径;非法直接抛 HTTPException。

    拒绝规则:空值 / 绝对路径 / 以 / 开头 / 含盘符 / 含 `..` 路径段 /
    resolve 后不在白名单目录内 / 非 .html 后缀。
    """
    name = file_name.replace("\\", "/").strip()
    if not name or name.startswith("/"):
        raise HTTPException(status_code=400, detail="非法文件路径")
    p = Path(name)
    if p.is_absolute() or p.drive or ".." in p.parts:
        raise HTTPException(status_code=400, detail="非法文件路径")
    resolved = (_PROJECT_ROOT / p).resolve()
    try:
        resolved.relative_to(_PROJECT_ROOT.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="非法文件路径") from None
    if resolved.suffix.lower() != ".html":
        raise HTTPException(status_code=400, detail="仅支持 .html 产物")
    for root in _ARTIFACT_DIRS:
        try:
            resolved.relative_to(root.resolve())
        except ValueError:
            continue
        return resolved
    raise HTTPException(status_code=400, detail="文件不在白名单目录内")


@router.get("/artifacts/token")
async def issue_artifact_token(
    request: Request,
    file: str,
    _user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """换取产物访问签名 token(JWT 保护)。

    查询参数:
        file: 产物相对路径(如 tmp/charts/20260901_2200_xxx.html)

    返回:
        {"token": "<签名token>", "url": "/api/artifacts/f/<token>", "expires_in": 1800}

    注:响应脱敏中间件会把字段名含 "token" 的值替换为 ***,而此 token 本就是
    返回给调用方使用的短期签名凭证(非内部 secret),故跳过脱敏。
    """
    validate_and_resolve(file)
    token = sign_artifact_token(file)
    request.state.skip_response_sanitization = True
    return {
        "token": token,
        "url": f"/api/artifacts/f/{token}",
        "expires_in": TOKEN_TTL_SECONDS,
    }


@router.get("/artifacts/f/{token}")
async def serve_artifact(token: str) -> HTMLResponse:
    """按签名 token 返回产物 HTML(iframe 可直接加载,无需 Authorization)。"""
    file_name = verify_artifact_token(token)
    if file_name is None:
        raise HTTPException(status_code=403, detail="签名 token 无效或已过期")
    target = validate_and_resolve(file_name)
    if not target.is_file():
        raise HTTPException(status_code=404, detail="产物文件不存在")
    try:
        content = target.read_text(encoding="utf-8")
    except OSError as exc:
        logger.error("读取产物失败 %s: %s", target, exc)
        raise HTTPException(status_code=500, detail="读取产物失败") from None
    return HTMLResponse(content=content)
# ⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌‌​‌​​‌‌‌​‍​‌‌​​‌‌​​​‌​​‌​‌‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​‌‌​‌‌‌‍​‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍​‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠
