# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""扫码登录 API 路由(2026-07-30 新增)。

端点:
- POST /publish/scan-login/start        启动扫码任务
- GET  /publish/scan-login/{task_id}/status  查询任务状态
- GET  /publish/scan-login/{task_id}/qr      获取二维码截图 PNG
- POST /publish/scan-login/{task_id}/cancel  取消任务
- GET  /publish/scan-login/platforms         列出支持的平台
- POST /publish/scan-login/import-cookies   手动导入 cookies 保存账号(2026-09-16 新增)
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..core.jwt_auth import get_current_user_id
from ..services.scan_login import (
    PLATFORM_SCAN_CONFIG,
    _cookie_hits,
    _parse_raw_cookies,
    _save_account_to_db,
    cancel_scan_task,
    detect_login_from_cdp_session,
    detect_login_from_profile,
    get_qr_image,
    get_task,
    start_scan_task,
)

router = APIRouter(prefix="/publish/scan-login", tags=["publish-scan-login"])


# =============================================================================
# Schema
# =============================================================================
class StartScanRequest(BaseModel):
    platform: str = Field(..., description="平台 ID,如 zhihu / bilibili / xiaohongshu")


# =============================================================================
# 端点
# =============================================================================
@router.get("/platforms")
async def list_supported_platforms() -> dict[str, Any]:
    """列出支持的扫码登录平台(供前端展示)。"""
    platforms = []
    for pid, cfg in PLATFORM_SCAN_CONFIG.items():
        platforms.append({
            "platform": pid,
            "name": cfg["name"],
            "login_url": cfg["login_url"],
            "success_cookies": cfg["success_cookies"],
        })
    return {"code": 0, "message": "ok", "data": {"platforms": platforms}}


@router.post("/start")
async def start_scan(body: StartScanRequest, request: Request) -> dict[str, Any]:
    """启动扫码登录任务。返回 task_id,前端轮询 status + qr。"""
    user_id = await get_current_user_id(request)
    try:
        task = start_scan_task(user_id=user_id, platform=body.platform)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "code": 0,
        "message": "扫码任务已启动",
        "data": {
            "task_id": task.task_id,
            "platform": task.platform,
            "status": task.status,
            "snapshot": task.snapshot(),
        },
    }


@router.get("/{task_id}/status")
async def get_task_status(task_id: str, request: Request) -> dict[str, Any]:
    """查询任务状态。"""
    # P1 修复(2026-08-06): 校验任务归属,防 IDOR 查询他人任务状态
    user_id = await get_current_user_id(request)
    task = get_task(task_id)
    if not task or task.user_id != user_id:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    data = task.snapshot()
    # P1 修复(2026-08-06): 响应不泄露 user_id
    data.pop("user_id", None)
    return {
        "code": 0,
        "message": "ok",
        "data": data,
    }


@router.get("/{task_id}/qr")
async def get_task_qr(task_id: str, request: Request) -> Response:
    """获取二维码截图 PNG。"""
    # P1 修复(2026-08-06): 校验任务归属,防 IDOR 拉取他人二维码/登录截图
    user_id = await get_current_user_id(request)
    task = get_task(task_id)
    if not task or task.user_id != user_id:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    img_bytes = get_qr_image(task_id)
    if not img_bytes:
        raise HTTPException(status_code=503, detail="二维码截图未就绪,请稍后重试")
    return Response(
        content=img_bytes,
        media_type="image/png",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Task-Status": task.status,
        },
    )


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str, request: Request) -> dict[str, Any]:
    """取消扫码任务。"""
    # P1 修复(2026-08-06): 校验任务归属,防 IDOR 取消他人任务
    user_id = await get_current_user_id(request)
    task = get_task(task_id)
    if not task or task.user_id != user_id:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    ok = cancel_scan_task(task_id)
    return {
        "code": 0 if ok else 1,
        "message": "已取消" if ok else "任务已完成,无法取消",
        "data": {"task_id": task_id, "cancelled": ok},
    }


# =============================================================================
# CDP 扫码登录(2026-07-31 新增,WorkPanel 内置浏览器 CDP 模式)
# =============================================================================
class DetectFromCdpRequest(BaseModel):
    session_id: str = Field(..., description="BrowserHub CDP 会话 ID(createBrowserSession 返回)")
    platform: str = Field(..., description="平台 ID,如 zhihu / bilibili / xiaohongshu")


@router.post("/detect-from-cdp")
async def detect_from_cdp(body: DetectFromCdpRequest, request: Request) -> dict[str, Any]:
    """从 BrowserHub CDP 会话检测登录态 + 自动保存账号。

    前端 WorkPanel CDP 扫码登录流程:
    1. createBrowserSession(url=平台登录页) → 在 WorkPanel 打开 CDP 画面
    2. 用户在 CDP 画面里扫码/登录
    3. 前端每 3s 调本端点 → 后端从 BrowserHub 拿 cookies → 检测 success_cookies
    4. detected=true → 命中则加密保存到 publish_accounts → 前端关闭会话 + 刷新列表
    """
    user_id = await get_current_user_id(request)
    result = await detect_login_from_cdp_session(body.session_id, body.platform, user_id)
    return {"code": 0, "message": "ok", "data": result}


# =============================================================================
# 用户自己浏览器检测(2026-09-16 新增,外部模式 = "在你日常用的浏览器里登录")
# =============================================================================
class DetectFromProfileRequest(BaseModel):
    platform: str = Field(..., description="平台 ID,如 zhihu / bilibili / xiaohongshu")


@router.post("/detect-from-profile")
async def detect_from_profile(body: DetectFromProfileRequest, request: Request) -> dict[str, Any]:
    """从用户真实浏览器 profile 检测登录态 + 自动保存账号。

    外部模式闭环(前端流程):
    1. 前端用系统默认浏览器打开平台登录页——**用户日常那个浏览器**(真实 profile、
       Google 账号与平台登录态都在),不需要重新登录;
    2. 前端每 3s 调本端点 → 后端按平台域名读真实 profile 的 cookie 名判断是否已登录;
    3. 命中 → 无窗口 headless Chrome 读同一 profile 快照的 cookie 值 → 加密入库;
    4. 前端进入下一个平台。

    这样"浏览器"始终是用户自己的,副本/新建 profile 会丢 Google 登录态(实测),
    因此不再用托管浏览器承担外部模式。
    """
    user_id = await get_current_user_id(request)
    result = await detect_login_from_profile(body.platform, user_id)
    return {"code": 0, "message": "ok", "data": result}


# =============================================================================
# 外部 Chrome 扫码登录(2026-09-02 新增)
# =============================================================================
class ExternalStartRequest(BaseModel):
    platform: str = Field(..., description="平台 ID,如 zhihu / bilibili / xiaohongshu")


@router.post("/external-start")
async def external_start(body: ExternalStartRequest, request: Request) -> dict[str, Any]:
    """用**用户自己的浏览器**(系统默认 Chromium 浏览器 + 其真实 profile 副本)打开平台登录页,
    并通过 CDP 附着注册为 hub session。返回 session_id,前端复用 detect-from-cdp 轮询,
    已登录的平台直接命中自动保存账号(与内置 CDP 扫码同一条闭环链路),未登录的在该窗口里
    正常扫码即可。响应同时带上 browser / profile_used,供前端如实提示用的是哪个浏览器。
    """
    # 鉴权(登录用户才能发起);user_id 本身不用于本端点
    await get_current_user_id(request)
    config = PLATFORM_SCAN_CONFIG.get(body.platform)
    if not config:
        raise HTTPException(status_code=400, detail=f"不支持的平台: {body.platform}")

    from ..services.browser_hub import hub
    try:
        session, meta = await hub.launch_external_chrome(config["login_url"])
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"启动外部浏览器失败: {e}") from e
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "session_id": session.session_id,
            "platform": body.platform,
            "browser": meta.get("browser") or "",
            "profile_used": bool(meta.get("profile_used")),
            "profile_name": meta.get("profile_name") or "",
        },
    }


# =============================================================================
# 手动导入 cookies(2026-09-16 新增,系统默认浏览器登录模式)
# =============================================================================
class ImportCookiesRequest(BaseModel):
    platform: str = Field(..., description="平台 ID,如 zhihu / bilibili / xiaohongshu")
    cookies_raw: str = Field(..., min_length=1, description="手动粘贴的 Cookie 文本(JSON / cookies.txt / 请求头格式)")


@router.post("/import-cookies")
async def import_cookies(body: ImportCookiesRequest, request: Request) -> dict[str, Any]:
    """手动粘贴 cookies 保存账号(系统默认浏览器登录闭环的最后一步)。

    流程:前端用系统默认浏览器(Tauri shell|open)打开登录页 → 用户在日常浏览器
    的已登录状态里完成登录 → 从 DevTools 复制 cookies 粘贴回弹窗 → 本端点
    解析 → 校验平台关键字段 → 过滤统计类 cookie → 加密入库(与扫码登录同一张表)。

    背景:用户日常浏览器的登录态受默认 profile / App-Bound Encryption 保护,
    后端无法自动读取(Chrome 136+ 禁止默认 profile 开调试端口),只能手动导入。
    """
    user_id = await get_current_user_id(request)
    config = PLATFORM_SCAN_CONFIG.get(body.platform)
    if not config:
        raise HTTPException(status_code=400, detail=f"不支持的平台: {body.platform}")

    cookies = _parse_raw_cookies(body.cookies_raw)
    if not cookies:
        raise HTTPException(
            status_code=400,
            detail='未能从输入中解析出任何 Cookie,请确认格式:{"k":"v"} / k=v; k2=v2 / cookies.txt',
        )

    # 校验登录关键字段:一个都没命中说明用户还没登录成功/复制错了域名
    hits = _cookie_hits(config, cookies)
    if not hits:
        raise HTTPException(
            status_code=400,
            detail=(
                f"未检测到 {config['name']} 的登录 Cookie"
                f"(应包含: {', '.join(config['success_cookies'])}),"
                "请确认已在默认浏览器中登录成功后重新复制"
            ),
        )

    # 与扫码登录一致:剔除统计类 cookie,并确保关键字段必含
    relevant = {
        k: v for k, v in cookies.items()
        if not any(s in k.lower() for s in ["google", "baidu", "cnzz", "_ga", "hm.baidu"])
    }
    relevant.update({k: cookies[k] for k in hits})

    account_id = await _save_account_to_db(user_id, body.platform, relevant, config["name"])
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "account_id": account_id,
            "cookies_count": len(relevant),
            "matched": hits,
        },
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
