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
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..core.jwt_auth import get_current_user_id
from ..services.publish.platform_cookie_domains import (
    extract_cookie_domains,
    filter_platform_cookies,
)
from ..services.scan_login import (
    PLATFORM_SCAN_CONFIG,
    _cookie_hits,
    _existing_account_row,
    _parse_raw_cookies,
    _save_account_to_db,
    cancel_scan_task,
    detect_login_from_cdp_session,
    detect_login_from_profile,
    get_qr_image,
    get_task,
    list_live_scan_tasks,
    request_interaction,
    should_overwrite_existing_credentials,
    start_scan_task,
    verify_login_candidate,
)

router = APIRouter(prefix="/publish/scan-login", tags=["publish-scan-login"])


# =============================================================================
# Schema
# =============================================================================
class StartScanRequest(BaseModel):
    platform: str = Field(..., description="平台 ID,如 zhihu / bilibili / xiaohongshu")
    reuse_session: bool = Field(
        True,
        description="会话复用:True=该平台已有有效登录态时直接复用(免扫码);False=强制全新扫码(清登录态出码)",
    )


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
        task = start_scan_task(user_id=user_id, platform=body.platform, reuse_session=body.reuse_session)
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
    # 2026-09-29:头条微信通道下发的是微信官方码原图(JPEG),截图通道仍是 PNG,
    # 按魔数嗅探,别让 image/png 头误标 JPEG。
    media_type = "image/jpeg" if img_bytes[:3] == b"\xff\xd8\xff" else "image/png"
    return Response(
        content=img_bytes,
        media_type=media_type,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Task-Status": task.status,
        },
    )


@router.post("/{task_id}/interact")
async def interact_task(task_id: str, request: Request) -> dict[str, Any]:
    """对进行中的扫码任务做一次页面交互(多步验证:短信验证码等)。

    body: {"action": "screenshot|fill|click|text", "selector"?: str, "value"?: str}
    sync Playwright 非线程安全 ⇒ 动作经队列投递进任务线程执行,这里只等结果。
    """
    user_id = await get_current_user_id(request)
    task = get_task(task_id)
    if not task or task.user_id != user_id:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="body 必须是 JSON")
    action = str(body.get("action") or "")
    if not action:
        raise HTTPException(status_code=400, detail="action 必填(screenshot/fill/click/text)")
    result = await run_in_threadpool(
        request_interaction,
        task_id,
        action,
        body.get("selector"),
        body.get("value"),
        15.0,
    )
    return {"code": 0 if result.get("ok") else 1, "message": "ok" if result.get("ok") else "interaction failed", "data": result}


@router.get("/tasks/live")
async def list_live_tasks(request: Request) -> dict[str, Any]:
    """列本实例的进行中任务(页面句柄仅实例内可用,Redis 快照不在列)。"""
    await get_current_user_id(request)  # 仅鉴权;列表不含他人信息字段
    items = list_live_scan_tasks()
    return {"code": 0, "message": "ok", "data": {"items": items}}


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
    # 鉴权(登录用户才能发起)。user_id 现在**要**用于本端点:外部浏览器会话带的是
    # 用户自己的真实 profile 副本(含他已登录的站点),过去创建时不盖章 ⇒ 该会话对
    # 全站任何持有效令牌的人可见可控。
    caller_user_id = await get_current_user_id(request)
    config = PLATFORM_SCAN_CONFIG.get(body.platform)
    if not config:
        raise HTTPException(status_code=400, detail=f"不支持的平台: {body.platform}")

    from ..services.browser_hub import hub
    try:
        session, meta = await hub.launch_external_chrome(
            config["login_url"], owner_user_id=caller_user_id
        )
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
    解析 → **按平台归属逐条过滤**(cookie 域名白名单优先,无域名信息才允许按
    cookie 名兜底;唯一归属表在 `app/services/publish/platform_cookie_domains.py`)
    → 过滤后仍不含该平台主登录 cookie ⇒ 400(点名缺失项 + kept/dropped 计数,
    绝不回显任何 cookie 值)→ 加密入库(与扫码登录同一张表)。

    根因修复(2026-09-27):旧实现的"过滤"只是对 cookie **名**做 5 项第三方统计类
    子串黑名单(名字既不说话、也不分平台),整浏览器混包(实测 533/537 字段,含
    .CNBlogsCookie/BDUSS/APISID 等跨站登录 cookie)只要有目标平台一枚登录 cookie
    就整包入库(库中 id=5/7/23 即此型事故)。现按归属表丢弃一切判不出平台的 cookie。

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

    # 按平台归属过滤:有 domain 的按域名白名单判,无 domain 的才允许按 cookie 名兜底;
    # 判不出归属 ⇒ 丢弃并计数(宁缺勿滥),不回显任何 cookie 值。
    domains_by_name = extract_cookie_domains(body.cookies_raw)
    filter_result = filter_platform_cookies(
        platform=body.platform,
        cookies=cookies,
        domains_by_name=domains_by_name,
        login_cookie_patterns=config["success_cookies"],
    )

    # 主登录 cookie 必须在**过滤后的保留集**里命中(旧版在整包上判,混包因此过闸)。
    hits = _cookie_hits(config, filter_result.kept)
    if not hits:
        missing = [
            pattern for pattern in config["success_cookies"]
            if not any(
                h == pattern or (pattern.endswith("*") and h.startswith(pattern[:-1]))
                for h in hits
            )
        ]
        raise HTTPException(
            status_code=400,
            detail={
                "message": (
                    f"未检测到 {config['name']} 的登录 Cookie"
                    f"(缺少: {', '.join(missing) or ', '.join(config['success_cookies'])})。"
                    f"粘贴内容中属于 {config['name']} 的 Cookie 已被过滤"
                    f"(共丢弃 {filter_result.dropped_count} 枚非本平台 Cookie)。"
                    f"请只复制 {config['name']} 域名下的 Cookie 重新导入,"
                    "或改走扫码登录入口重新登录:"
                    "POST /publish/scan-login/start(站内扫码)"
                    " / POST /publish/scan-login/external-start(系统浏览器)"
                ),
                "data": {
                    "kept": filter_result.kept_count,
                    "dropped": filter_result.dropped_count,
                    "missing_login_cookies": missing,
                },
            },
        )

    # 先验后写(与画像导入同一条裁决点):库里已有凭据时,校验不过的候选集不得覆盖它。
    # 粘贴口最容易产出"名字齐但值已过期"的集合 —— 而覆盖一旦落地,当时那份密文就没了。
    # 行 id 一次取回喂两件事:既是"是否破坏性"的判据,也是这趟校验该用哪个身份锚点。
    existing_row = await _existing_account_row(user_id, body.platform)
    verify_ok, verify_note = await verify_login_candidate(
        body.platform, filter_result.kept, (existing_row or {}).get("id")
    )
    if not should_overwrite_existing_credentials(existing_row is not None, verify_ok):
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"粘贴的 {config['name']} Cookie 未通过登录校验"
                    f"({verify_note or '无可用适配器,无法校验'}),"
                    "而账号里已有一份凭据 ⇒ 拒绝覆盖,原凭据一字未动。"
                    "请重新复制该站**当前有效**的 Cookie,或改走扫码登录"
                ),
                "data": {
                    "kept": filter_result.kept_count,
                    "dropped": filter_result.dropped_count,
                    "existing_kept": True,
                },
            },
        )
    if verify_ok:
        msg_to_store = "粘贴导入并校验通过"
    elif verify_ok is None:
        msg_to_store = "粘贴导入:无可用适配器,未校验"
    else:
        msg_to_store = f"粘贴导入(首建,校验未过): {verify_note}"

    account_id = await _save_account_to_db(
        user_id, body.platform, filter_result.kept, config["name"], verify_msg=msg_to_store
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "account_id": account_id,
            "cookies_count": filter_result.kept_count,
            "matched": hits,
            "verified": verify_ok,
            # 2026-09-27 新增(只增不改字段):归属过滤计数,供前端如实提示
            "kept": filter_result.kept_count,
            "dropped": filter_result.dropped_count,
        },
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
