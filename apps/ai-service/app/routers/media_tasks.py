# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""媒体任务统一管理 HTTP 路由(ai-service,内网,2026-09-09 立)。

对话内媒体工具(video/music/tts/image/改图)任务统一持久化在 media_tasks 表
(见 app.services.media_tasks),此处提供对外管理出口:
- GET  /api/media/tasks                列表(kind/status/user_uuid 过滤)
- GET  /api/media/tasks/{task_id}      详情(库内 + 在途任务实时向 token6688 探测)
- POST /api/media/tasks/{task_id}/cancel  取消在途任务(provider 取消 + 置 cancelled)

与 /api/video/tasks 并存:video_generation_tasks 是 REST 视频任务队列(worker 消费),
media_tasks 是对话内 MCP 媒体调用记录。
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
from typing import Any
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from ..services.media_tasks import (
    _STATUS_IN_FLIGHT,
    cancel_media_tasks,
    clear_media_tasks,
    delete_media_task,
    get_media_task,
    handle_media_callback,
    media_task_stats,
    query_media_tasks,
    update_media_task,
)
from ..services.screenshot_service import _validate_url_ssrf

router = APIRouter()
logger = logging.getLogger(__name__)

# 2026-10-31 安全强化第 10 批:代理三端点(download/stream/image)统一手动逐跳跟随
# 重定向。follow_redirects=True 会自动跟随落点且不复检 —— 公网页 302 →
# http://169.254.169.254/ 即整条 SSRF(与 web_crawl_tools._http_get_html
# 2026-10-27 同型修复)。每一跳重新过 _validate_url_ssrf,超上限按最后落点返回。
_MAX_PROXY_REDIRECT_HOPS = 5


async def _send_following_redirects(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    """手动逐跳 GET,每跳先过 SSRF 尺再发请求;中间跳响应即时关闭。

    落点校验失败抛 HTTPException(400),由调用方决定错误形状;
    网络异常原样上抛(调用方已有 502 映射)。
    """
    from ..services.screenshot_service import resolve_pinned_target

    current = url
    resp: httpx.Response | None = None
    for _hop in range(_MAX_PROXY_REDIRECT_HOPS + 1):
        ok, reason = _validate_url_ssrf(current)
        if not ok:
            raise HTTPException(status_code=400, detail=f"URL 不允许访问: {reason}")
        # 2026-10-31 安全强化第 10 批 R6:钉 IP(DNS rebinding TOCTOU)——
        # 校验期与请求期两次解析可不一致,连接只用于校验过的那个 IP;
        # Host 头保持原域名,同段 http 无 SNI 语义,原调用方自带头不受影响。
        pinned = resolve_pinned_target(current)
        if pinned is None:
            raise HTTPException(status_code=400, detail="URL 无法钉定公网 IP,已拒绝")
        pinned_url, orig_host = pinned
        hop_headers = {**(headers or {})}
        hop_headers.setdefault("Host", orig_host)
        resp = await client.send(client.build_request("GET", pinned_url, headers=hop_headers))
        location = resp.headers.get("location")
        if resp.is_redirect and location:
            current = str(resp.url.join(location))
            await resp.aclose()
            continue
        break
    assert resp is not None
    return resp



def _user_scope(request: Request) -> tuple[str, bool]:
    """从 JWT 派生当前用户 (user_id, is_admin)(2026-09-09 P0 越权修复)。

    此前媒体任务路由不校验身份且 user_uuid 可选,任何登录用户可查看/取消/删除
    全平台所有人的任务(IDOR,与 llm.py P0-9 同类)。修复:普通用户强制按自身
    过滤;admin(role_id>=1)可看全部。与 agent_runtime._get_current_user 同模式。
    测试可通过 app.dependency_overrides 注入假身份。
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    role_id = getattr(request.state, "role_id", 0) or 0
    return str(user_id), int(role_id) >= 1


def _scoped_user_uuid(user_uuid: str | None, scope: tuple[str, bool]) -> str | None:
    """非 admin 强制按当前用户过滤;admin 尊重显式传参(不传=查全部)。"""
    user_id, is_admin = scope
    return user_uuid if is_admin else user_id


def _owner_allows(owner: str, scope: tuple[str, bool]) -> bool:
    """单条记录的归属判定**唯一**出口(G-754,2026-09-29)。

    旧写法在三处各写一遍 `if owner and owner != user_id and not is_admin`,而
    `owner and` 让空属主行短路成"放行" —— 那一行注释把它解释成"历史行为不强制",
    但只要还有无主体通道在铸新行(G-753 `/api/workflows` 整族没有主体),这类行就在
    **持续新增**,于是"空属主"被读成了"人人可见可改"。这是把**属主未知**当成了
    **无属主即公开**,而媒体任务行是归属型(user_uuid 有列、有索引、list/stats 按等值过滤),
    所以正确语义只有一条:属主未知 ⇒ 仅 admin 可达,非 admin 一律 404(与不归属同形,
    不给存在性 oracle)。

    list/stats/clear/批量取消走的是 `_scoped_user_uuid` 的等值过滤,非 admin 本来就
    取不到空属主行;本函数补齐的是**按 task_id 直取的那三侧门**,两侧结论从此一致。
    """
    user_id, is_admin = scope
    if is_admin:
        return True
    return bool(owner) and owner == user_id


@router.post("/media/tasks/callback")
async def media_tasks_callback(request: Request) -> dict[str, Any]:
    """token6688 官方终态 webhook → media_tasks 实时回写(对话内媒体任务自动收尾)。

    与 /api/video/token6688-callback 同验签协议(X-TokenGo-Signature=sha256+HMAC)。
    快照形状同 GET /v1/tasks/{task_id};终态(成功带产物 URL/失败)落库,
    中间态快照忽略。401=验签失败;200 ok=false=解析失败/快照缺 task_id(幂等确认)。
    """
    body = await request.body()
    secret = os.environ.get("TOKEN6688_CALLBACK_SECRET", "").strip()
    if secret:
        sig = request.headers.get("X-TokenGo-Signature", "").strip()
        expected = "sha256=" + hmac.new(
            secret.encode("utf-8"), body, hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            logger.warning("[media_tasks] 回调验签失败: sig=%r", sig[:24])
            raise HTTPException(status_code=401, detail="签名校验失败")
    else:
        # 2026-09-09 P0 fail-closed:与 video.py 回调同修——密钥为空时此前跳过验签
        # 继续处理 = 匿名可伪造任务终态(公开白名单端点)。现拒绝处理。
        logger.error("[media_tasks] 回调拒绝: TOKEN6688_CALLBACK_SECRET 未配置(fail-closed)")
        raise HTTPException(status_code=503, detail="回调密钥未配置,拒绝处理")
    event = request.headers.get("X-TokenGo-Event", "")
    try:
        snapshot = json.loads(body or b"{}")
        if not isinstance(snapshot, dict):
            raise ValueError("回调体非 JSON 对象")
    except ValueError as e:
        logger.warning("[media_tasks] 回调体解析失败: %s", e)
        return {"ok": False, "error": f"回调体解析失败: {e}"}
    result = await handle_media_callback(snapshot)
    logger.info(
        "[media_tasks] 回调处理: event=%s ok=%s matched=%s ignored=%s",
        event, result.get("ok"), result.get("matched"), result.get("ignored"),
    )
    return result


@router.post("/media/upload")
async def media_upload(
    file: UploadFile | None = File(default=None, description="本地文件(multipart,≤50MB)"),
    url: str | None = Form(default=None, description="远程 http(s) URL(SSRF 校验后拉取)"),
    purpose: str | None = Form(default=None, description="官方用途语义(如 voice/assistants)"),
) -> dict[str, Any]:
    """上传文件换 token6688 24h 公网 URL(视频参考素材/声纹/改图输入,2026-09-09)。

    file 与 url 二选一;成功返回 {file_url, filename, size}。
    """
    if file is None and not url:
        raise HTTPException(status_code=400, detail="file 与 url 必须二选一")
    from ..core.config import settings
    from ..providers.base_provider import ProviderError
    from ..providers.token6688_provider import Token6688Provider

    cfg = settings.get_provider_config("token6688")
    if not cfg.api_key:
        raise HTTPException(
            status_code=503,
            detail="token6688 未配置:请在 .env 设置 TOKEN6688_API_KEY 或 LLM_PROVIDERS.token6688.api_key",
        )
    provider = Token6688Provider(api_key=cfg.api_key, api_base=cfg.api_base)
    try:
        if file is not None:
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail="上传文件为空")
            if len(data) > 50 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="文件超过 50MB 上限")
            filename = file.filename or "file.bin"
            upload_url = await provider.upload_file(data, filename, purpose=purpose)
            return {"ok": True, "data": {"file_url": upload_url, "filename": filename, "size": len(data)}}
        from ..services.screenshot_service import _validate_url_ssrf

        ok_ssrf, reason = _validate_url_ssrf(url or "")
        if not ok_ssrf:
            raise HTTPException(status_code=400, detail=f"URL 不允许访问: {reason}")
        import httpx

        # 2026-10-31 安全强化第 14 批:本端点此前只有首跳校验 + follow_redirects=True,
        # 是"302 到内网即整条 SSRF"的同型漏网(代理三端点已于第 10 批修过)。改走同文件
        # 的手动逐跳辅助,判据单源;错误文案不带上游原文(URL/内网主机名不进响应体)。
        try:
            async with httpx.AsyncClient(timeout=60, follow_redirects=False) as _c:
                _r = await _send_following_redirects(_c, url or "")
                _r.raise_for_status()
                data = _r.content
        except HTTPException:
            raise
        except Exception as e:  # noqa: BLE001
            logger.warning("[media] 远程文件拉取失败: %s", e)
            raise HTTPException(status_code=502, detail="拉取远程文件失败") from e
        if len(data) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="远程文件超过 50MB 上限")
        filename = (url or "").rsplit("/", 1)[-1][:200] or "file.bin"
        upload_url = await provider.upload_file(data, filename, purpose=purpose)
        return {"ok": True, "data": {"file_url": upload_url, "filename": filename, "size": len(data)}}
    except ProviderError as e:
        raise HTTPException(status_code=e.status_code or 502, detail=str(e)) from None
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.warning("[media] 上传失败: %s", e)
        raise HTTPException(status_code=500, detail=f"上传异常: {e}") from e


@router.get("/media/tasks")
async def media_task_list(
    request_user: tuple[str, bool] = Depends(_user_scope),
    kind: str | None = None,
    status: str | None = None,
    user_uuid: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> dict[str, Any]:
    """媒体任务列表:kind/status 支持逗号分隔多值(video/music/tts/image;processing/succeeded/failed/cancelled)。

    2026-09-09 P0 越权修复:非 admin 强制按当前用户过滤(user_uuid 参数仅 admin 可用)。
    """
    try:
        data = await query_media_tasks(
            kind=kind, status=status, user_uuid=_scoped_user_uuid(user_uuid, request_user),
            limit=limit, offset=offset,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_tasks] 列表查询失败: %s", e)
        raise HTTPException(status_code=500, detail=f"媒体任务查询异常: {e}") from e
    return {"ok": True, "data": data}


@router.get("/media/tasks/stats")
async def media_tasks_stats(
    request_user: tuple[str, bool] = Depends(_user_scope),
    user_uuid: str | None = None,
) -> dict[str, Any]:
    """媒体任务统计概览(2026-09-09 F7):按 kind 分组 + 全局在途/终态计数。

    任务中心顶部概览卡片消费(总数/在途/已完成/失败/已取消,及各类型明细)。
    2026-09-09 P0 越权修复:非 admin 强制按当前用户统计。
    """
    try:
        data = await media_task_stats(user_uuid=_scoped_user_uuid(user_uuid, request_user))
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_tasks] 统计查询失败: %s", e)
        raise HTTPException(status_code=500, detail=f"媒体任务统计异常: {e}") from e
    return {"ok": True, "data": data}


@router.get("/media/tasks/{task_id}")
async def media_task_detail(
    task_id: str,
    request_user: tuple[str, bool] = Depends(_user_scope),
) -> dict[str, Any]:
    """媒体任务详情:库内记录;在途且 provider=token6688 时实时探测最新状态。

    2026-09-09 P0 越权修复:非 admin 只能看自己的任务(不归属按 404,不泄露存在性;
    与 agent_runtime._require_session 同策略)。
    G-754(2026-09-29)改了这条的后半:历史上"空属主行不强制"等于任何登录用户按
    task_id 就能读到别人的媒体任务(无主体通道仍在铸这类行,见 G-753),现按
    `_owner_allows` 走 —— 空属主 = 属主未知 ⇒ 仅 admin 可达,非 admin 同样 404。
    """
    row = await get_media_task(task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="媒体任务不存在")
    owner = str(row.get("user_uuid") or "")
    if not _owner_allows(owner, request_user):
        raise HTTPException(status_code=404, detail="媒体任务不存在")
    if (
        row.get("status") in _STATUS_IN_FLIGHT
        and row.get("task_id")
        and row.get("provider") == "token6688"
    ):
        try:
            from ..core.config import settings
            from ..providers.token6688_provider import Token6688Provider

            cfg = settings.get_provider_config("token6688")
            if cfg.api_key:
                st = await Token6688Provider(api_key=cfg.api_key, api_base=cfg.api_base).get_task_status(
                    str(row["task_id"])
                )
                if isinstance(st, dict) and st.get("status"):
                    row["live_status"] = st.get("status")
                    if st.get("video_url"):
                        # 2026-09-09 修复:探测到成片 URL 必须连产物一起落库,
                        # 否则页面刷新后 media-tasks 列表/详情读库仍无 result → 任务中心不可播放。
                        # 按 kind 映射产物字段(image_url/audio_url/video_url),与回调/轮询一致。
                        from ..services.media_tasks import _kind_url_field

                        field = _kind_url_field(str(row.get("kind") or ""))
                        merged = {**(row.get("result") or {}), field: st["video_url"]}
                        row["result"] = merged
                        # 2026-09-09 P1 竞态修复:仅在途可写,防把已取消任务翻成 succeeded
                        await update_media_task(
                            str(row["task_id"]),
                            status="succeeded",
                            result=merged,
                            only_if_in_flight=True,
                        )
                    elif st.get("failed"):
                        await update_media_task(
                            str(row["task_id"]), status="failed", only_if_in_flight=True,
                        )
        except Exception as e:  # noqa: BLE001
            logger.warning("[media_tasks] 实时探测失败(降级返回库内数据): %s", e)
    return {"ok": True, "data": row}


@router.delete("/media/tasks")
async def media_task_clear(
    kind: str | None = None,
    status: str | None = None,
    before: str | None = None,
    request_user: tuple[str, bool] = Depends(_user_scope),
) -> dict[str, Any]:
    """批量清理已终态媒体任务记录(2026-09-09 F1)。

    只删 succeeded/failed/cancelled;在途任务(processing 等)一律保留,防收尾通道
    回写失败而任务消失。kind/status 逗号分隔多值;before=ISO 时间截点只删更早。
    2026-09-09 P0 越权修复:非 admin 只能清理自己的记录。
    """
    try:
        result = await clear_media_tasks(
            kind=kind, status=status, before=before,
            user_uuid=_scoped_user_uuid(None, request_user),
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_tasks] 批量清理失败: %s", e)
        raise HTTPException(status_code=500, detail=f"媒体任务清理异常: {e}") from e
    return {"ok": True, "data": result}


@router.delete("/media/tasks/{task_id}")
async def media_task_delete(
    task_id: str,
    request_user: tuple[str, bool] = Depends(_user_scope),
) -> dict[str, Any]:
    """删除单条媒体任务记录(2026-09-09 F1;仅删本地记录,长任务应先取消再删)。

    2026-09-09 P0 越权修复:非 admin 不能删他人记录(不归属按 404)。
    """
    row = await get_media_task(task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="媒体任务不存在")
    owner = str(row.get("user_uuid") or "")
    if not _owner_allows(owner, request_user):
        raise HTTPException(status_code=404, detail="媒体任务不存在")
    try:
        deleted = await delete_media_task(task_id)
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_tasks] 单条删除失败: %s", e)
        raise HTTPException(status_code=500, detail=f"媒体任务删除异常: {e}") from e
    if not deleted:
        raise HTTPException(status_code=404, detail="媒体任务不存在")
    return {"ok": True, "data": {"task_id": task_id, "deleted": True}}


@router.post("/media/tasks/{task_id}/cancel")
async def media_task_cancel(
    task_id: str,
    request_user: tuple[str, bool] = Depends(_user_scope),
) -> dict[str, Any]:
    """取消在途媒体任务:优先调 token6688 取消端点,成功/不支持均如实返回并置 cancelled。

    2026-09-09 收尾修复:只允许取消在途任务(_STATUS_IN_FLIGHT),已终态任务
    (succeeded/failed/cancelled)返回 409,防止误点把终态任务翻转成 cancelled
    (与批量取消 cancel_media_tasks 的"只处理在途"语义一致)。
    2026-09-09 P0 越权修复:非 admin 不能取消他人任务(不归属按 404)。
    """
    row = await get_media_task(task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="媒体任务不存在")
    owner = str(row.get("user_uuid") or "")
    if not _owner_allows(owner, request_user):
        raise HTTPException(status_code=404, detail="媒体任务不存在")
    if row.get("status") not in _STATUS_IN_FLIGHT:
        raise HTTPException(
            status_code=409,
            detail=f"任务已终态(status={row.get('status')}),无需取消",
        )
    provider = str(row.get("provider") or "token6688")
    remote_id = str(row.get("task_id") or "").strip()
    cancel_result: dict[str, Any] = {"provider": provider, "task_id": remote_id or task_id}
    if provider == "token6688" and remote_id:
        try:
            from ..core.config import settings
            from ..providers.base_provider import ProviderError
            from ..providers.token6688_provider import Token6688Provider

            cfg = settings.get_provider_config("token6688")
            if not cfg.api_key:
                cancel_result["error"] = "token6688 未配置(TOKEN6688_API_KEY),无法取消远端任务"
            else:
                r = await Token6688Provider(
                    api_key=cfg.api_key, api_base=cfg.api_base
                ).cancel_task(remote_id)
                cancel_result.update(r or {})
        except ProviderError as e:
            cancel_result["error"] = str(e)
        except Exception as e:  # noqa: BLE001
            logger.warning("[media_tasks] 取消远端任务异常: %s", e)
            cancel_result["error"] = f"取消远端任务异常: {e}"
    else:
        cancel_result["error"] = f"provider={provider} 不支持远端取消,仅本地置 cancelled"
    try:
        # 2026-09-09 P1 竞态修复:实际置位用条件更新(仅在途可写)。上方 409 预检与
        # 写入之间存在窗口(回调/轮询/他人取消可能并发落终态),无守卫会把刚完成的
        # 任务翻转成 cancelled。命中失败按 409 返回,与预检语义一致。
        applied = await update_media_task(
            remote_id or task_id, status="cancelled", only_if_in_flight=True,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_tasks] 取消后更新状态失败: %s", e)
        raise HTTPException(status_code=500, detail="取消状态写入失败") from e
    if not applied:
        raise HTTPException(
            status_code=409,
            detail="任务已终态(并发收尾),无需取消",
        )
    return {"ok": True, "data": cancel_result}


@router.post("/media/tasks/cancel")
async def media_tasks_cancel_batch(
    payload: dict[str, Any] | None = None,
    request_user: tuple[str, bool] = Depends(_user_scope),
) -> dict[str, Any]:
    """批量取消在途媒体任务(2026-09-09 F8,任务中心"取消全部在途")。

    body(可选 JSON):{"task_ids": ["..."], "kind": "video"}。
    不传 task_ids → 取消全部在途任务;已终态任务永远不受影响。
    返回 {requested, cancelled, remote_failed} 供前端展示批量结果。
    2026-09-09 P0 越权修复:非 admin 只能取消自己的在途任务。
    """
    task_ids: list[str] | None = None
    kind: str | None = None
    if isinstance(payload, dict):
        raw_ids = payload.get("task_ids")
        if isinstance(raw_ids, list):
            task_ids = [str(i) for i in raw_ids]
        raw_kind = payload.get("kind")
        if isinstance(raw_kind, str) and raw_kind.strip():
            kind = raw_kind
    try:
        result = await cancel_media_tasks(
            task_ids=task_ids, kind=kind,
            user_uuid=_scoped_user_uuid(None, request_user),
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_tasks] 批量取消失败: %s", e)
        raise HTTPException(status_code=500, detail=f"媒体任务批量取消异常: {e}") from e
    return {"ok": True, "data": result}


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/media/download?url=<产物直链> —— 媒体产物下载代理(2026-10-30 立)
#
# 起因(UI 走查实证):视频卡片的「下载视频」按钮在对话框里点不动 —— 浏览器侧
# fetch 外部 CDN(agnes 的 cos-platform-outputs.*)被 CORS 拒绝,blob 落盘这条路
# 在跨域且源站不带 ACAO 时根本不成立,实测只能退化成新窗口打开(等于没下载)。
# 同源代理是唯一稳解:前端 fetchApi → 本端 → 源站,浏览器全程只碰同源。
#
# SSRF 防线(关键):2026-10-30 放宽 —— 不再要求 url 命中 media_tasks 登记
# (与 /api/media/image 一致)。AI 视频/音频来自不可枚举的公网域名(kling/luma/
# runway/suno/elevenlabs/mureka…),无法预先登记;CSM media-src 已收窄到
# 'self' blob:,故所有媒体必须走同源代理。此处仅保留 `_user_scope` + `_validate_url_ssrf`
# 两道闸门:任意 SSRF 安全的公网直链均可经同源代理下载。攻击者无法借本端去打
# 内网/元数据服务(SSRF 闸门封死)。
# ─────────────────────────────────────────────────────────────────────────────
_DOWNLOAD_KIND_SUFFIX = {"video": "mp4", "music": "mp3", "tts": "mp3", "image": "png"}
_DOWNLOAD_NAME_RE = re.compile(r"[^A-Za-z0-9._-]")
# 2026-10-30:download/stream 放宽后不再查 media_tasks,kind 无从取得;
# 当直链末段无扩展名时按 URL 路径扩展名反推,避免下载文件名一律退化成 .bin。
_DOWNLOAD_EXT_SUFFIX = {
    "mp4": "mp4", "m4v": "mp4", "webm": "webm", "mov": "mov",
    "mp3": "mp3", "m4a": "mp3", "wav": "wav", "aac": "mp3", "ogg": "ogg", "flac": "flac",
    "png": "png", "jpg": "jpg", "jpeg": "jpg", "webp": "webp", "gif": "gif", "svg": "svg",
}


def _safe_filename(url: str, kind: str | None) -> str:
    """从直链末段取文件名并做 header 安全化(去引号/换行/路径分隔符)。"""
    try:
        path = urlsplit(url).path
        seg = path.rsplit("/", 1)[-1]
    except Exception:  # noqa: BLE001
        path, seg = "", ""
    name = _DOWNLOAD_NAME_RE.sub("_", (seg or "").strip())[:80].strip("._")
    if not name or "." not in name:
        ext = _DOWNLOAD_KIND_SUFFIX.get(kind or "")
        if not ext:
            # 按 URL 路径扩展名反推(如 .../result.mp4 → mp4)
            raw_ext = path.rsplit(".", 1)[-1].lower() if "." in path.rsplit("/", 1)[-1] else ""
            ext = _DOWNLOAD_EXT_SUFFIX.get(raw_ext, "bin")
        name = f"ihui-media.{ext}"
    return name


# ── 同源代理响应加固(2026-10-30 补;修实测确认的高危同源 XSS) ──────────────────
# 立因:/media/image、/media/stream、/media/download 三个端点是**同源**端点,而修前
# 都把源站 content-type 原样转发。攻击者构造
#     /api/media/image?url=https://evil.example/x.html
# 浏览器就会在**同源**下把攻击者 HTML 当文档渲染并执行其中脚本 —— 同源 XSS:可读
# 同源 localStorage、可带 httpOnly auth_token cookie 发同源请求(等于账号接管)。
# 修前实测:该 URL 返回 200 + `content-type: text/html`,既无 nosniff 也无 CSP。
#
# 三道防线(纵深防御,缺一不可):
#   ① **content-type 白名单**:非白名单一律 415,绝不把源站类型原样转发;
#   ② **显式拒绝 image/svg+xml**:SVG 可内嵌 <script>,同源直接导航即 XSS
#      (在 <img> 上下文虽安全,但攻击者能直接导航,不能指望渲染上下文);
#   ③ 一律加 `X-Content-Type-Options: nosniff` + CSP `default-src 'none'; sandbox`
#      —— 即便类型判断被绕过或旧浏览器忽略 nosniff,该文档也不加载任何子资源、不执行脚本。
_IMAGE_CT_ALLOW = frozenset({
    "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
    "image/avif", "image/bmp", "image/tiff", "image/x-icon", "image/vnd.microsoft.icon",
    # 部分图床不写具体类型;octet-stream 浏览器不会内联渲染成文档,配合 nosniff 安全。
    "application/octet-stream", "binary/octet-stream",
})
# 「可渲染成文档 / 可执行」的类型:即便将来误加进白名单,也先被这张表拦下。
_CT_RENDERABLE_DENY = frozenset({
    "text/html", "application/xhtml+xml", "text/xml", "application/xml",
    "image/svg+xml", "text/plain", "text/css",
    "application/javascript", "text/javascript", "application/json",
})
_MEDIA_CT_PREFIXES = ("video/", "audio/")
_MEDIA_CT_EXACT = frozenset({
    "application/octet-stream", "binary/octet-stream",
    "application/mp4", "application/ogg", "application/vnd.apple.mpegurl",
    "application/x-mpegurl", "application/dash+xml",
})


def _normalize_ctype(raw: str | None) -> str:
    """取 media type 主值(去参数、小写、去空白)。"""
    return (raw or "").split(";", 1)[0].strip().lower()


def _proxy_hardening_headers() -> dict[str, str]:
    """同源代理通用安全响应头:禁嗅探 + 禁一切子资源/脚本。"""
    return {
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
    }


def _raise_unsafe_ctype(ctype: str, kind: str) -> None:
    """内容类型不合规时抛 415(附可读原因,便于排障)。"""
    raise HTTPException(
        status_code=415,
        detail=(
            f"{kind}代理拒绝该内容类型({ctype or '未声明'}):"
            "只允许安全的图片/音视频类型,避免同源端点被用作任意 HTML 托管(同源 XSS)"
        ),
    )


# 三个代理的 httpx 客户端统一用「不压缩」上游:httpx 默认发 `accept-encoding: gzip`
# 并**自动解压** `aiter_bytes()`,此时上游 content-length 是压缩后长度,与本端产出
# 的字节数不一致 —— 原样透传会让浏览器少读(截断)或挂起等永不来的后续字节
# (实测 httpbin/gzip:header=198,实际 252)。要求 identity 后两者恒等。
_UPSTREAM_NO_COMPRESSION = {"accept-encoding": "identity"}


def _safe_content_length(headers: Any) -> str | None:
    """上游 content-length 仅在「响应未被压缩」时才可透传。

    兜底第二层:即便上游无视 `accept-encoding: identity` 仍返回压缩体,只要它声明了
    非 identity 的 content-encoding,就不透传长度(交给 chunked 传输),避免长度谎报。
    """
    enc = str(headers.get("content-encoding") or "").strip().lower()
    if enc and enc != "identity":
        return None
    clen = headers.get("content-length")
    if clen is not None and str(clen).strip().isdigit():
        return str(clen).strip()
    return None


@router.get("/media/download")
async def download_media_artifact(url: str, request: Request) -> Any:
    """按产物直链代理下载(带 Content-Disposition: attachment)。

    不再要求 media_tasks 登记(与 /api/media/image 一致),仅保留 _user_scope +
    _validate_url_ssrf 两道闸门;任意 SSRF 安全的公网直链均可经同源代理取流/下载。
    源站异常回 502;文件按 URL 末段命名;kind/扩展名从 URL 推导(无 row 时用默认 bin)。
    """
    _user_scope(request)  # 401 未登录;越权不在本端点(产物 URL 命中即放行,URL 本身是凭证)
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="url 必须是 http(s) 直链")

    # SSRF 闸门:封死私有/环回/链路本地/元数据 IP;任意 SSRF 安全公网直链放行
    ok_ssrf, reason_ssrf = _validate_url_ssrf(url)
    if not ok_ssrf:
        raise HTTPException(status_code=400, detail=f"URL 不允许访问: {reason_ssrf}")

    # 不再查 media_tasks:kind 无法从 row 取,改为从 URL 推导(默认 'bin')
    fname = _safe_filename(url, None)
    client = httpx.AsyncClient(
        timeout=httpx.Timeout(20.0, read=180.0),
        follow_redirects=False,
        headers=_UPSTREAM_NO_COMPRESSION,
    )
    try:
        # 2026-10-31 安全强化第 10 批:手动逐跳,每跳过 SSRF 尺(重定向绕过封死)
        resp = await _send_following_redirects(client, url)
    except HTTPException:
        await client.aclose()
        raise  # SSRF 拒绝保持 400,不被吞成 502
    except Exception as e:  # noqa: BLE001
        await client.aclose()
        logger.warning("[media_tasks] 下载代理连接源站失败: %s", e)
        raise HTTPException(status_code=502, detail=f"源站连接失败: {e}") from e
    if resp.status_code >= 400:
        status = resp.status_code
        await resp.aclose()
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"源站返回 {status}")

    ctype = resp.headers.get("content-type", "application/octet-stream") or "application/octet-stream"

    async def _body() -> Any:
        try:
            async for chunk in resp.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    headers = {"Content-Disposition": f'attachment; filename="{fname}"'}
    # 纵深防御:attachment 已强制下载不渲染,再加 nosniff + CSP 兜住
    # 「浏览器忽略 attachment / 被中间层改写」这类极端情况。
    headers.update(_proxy_hardening_headers())
    safe_len = _safe_content_length(resp.headers)
    if safe_len:
        headers["Content-Length"] = safe_len
    return StreamingResponse(_body(), media_type=ctype, headers=headers)


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/media/stream?url=<产物直链> —— 媒体产物流式播放代理(2026-10-30 立)
#
# 与 /media/download 同族:同源代理。2026-10-30 放宽 —— 不再要求 URL 命中
# media_tasks 登记(与 /api/media/image 一致):AI 视频/音频来自不可枚举公网域名,
# 预先登记不可行;CSM media-src 已收窄到 'self' blob:,故媒体必须走同源代理。
# 仅保留 _user_scope + _validate_url_ssrf 两道闸门(SSRF 封死内网/元数据)。
# 面向 <video>/<audio> 播放而非下载,关键差异:
#  - **透传浏览器 Range 请求**到源站,原样回传 200/206 + Content-Range +
#    Accept-Ranges,使播放器可拖拽进度、可 seek(不转发 Range 则进度条拖不动、
#    部分浏览器全屏异常);
#  - 不返回 Content-Disposition,透传上游 content-type —— 但**先过类型白名单**
#    (2026-10-30 补:仅 video/*、audio/* 与少数容器类型放行,其余 415;否则
#    /media/stream?url=<任意HTML> 会在同源渲染攻击者页面 = 同源 XSS)。
#  - 浏览器经 web rewrites(/api/media/* → 8803)同源访问,自动带 httpOnly
#    auth_token cookie,无需在 <video src> 里拼 token,也无需 CSP 放开 https:
#    ⇒ media-src 可收窄回 'self' blob:,外泄信道面清零(根治 img-src 同型遗留)。
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/media/stream")
async def stream_media_artifact(url: str, request: Request) -> Any:
    """按产物直链代理流式播放(透传 Range,支持 seek)。

    不再要求 media_tasks 登记(与 /api/media/image 一致),仅保留 _user_scope +
    _validate_url_ssrf 两道闸门;任意 SSRF 安全的公网直链均可经同源代理取流/下载。
    """
    _user_scope(request)  # 401 未登录;产物 URL 命中即放行,URL 本身是凭证
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="url 必须是 http(s) 直链")

    # SSRF 闸门:封死私有/环回/链路本地/元数据 IP;任意 SSRF 安全公网直链放行
    ok_ssrf, reason_ssrf = _validate_url_ssrf(url)
    if not ok_ssrf:
        raise HTTPException(status_code=400, detail=f"URL 不允许访问: {reason_ssrf}")

    client = httpx.AsyncClient(
        timeout=httpx.Timeout(20.0, read=300.0),
        follow_redirects=False,
        headers=_UPSTREAM_NO_COMPRESSION,
    )
    req_headers: dict[str, str] = {}
    rng = request.headers.get("range")
    if rng:
        req_headers["range"] = rng
    try:
        # 2026-10-31 安全强化第 10 批:手动逐跳,每跳过 SSRF 尺(重定向绕过封死)
        resp = await _send_following_redirects(client, url, headers=req_headers)
    except HTTPException:
        await client.aclose()
        raise  # SSRF 拒绝保持 400,不被吞成 502
    except Exception as e:  # noqa: BLE001
        await client.aclose()
        logger.warning("[media_tasks] 播放代理连接源站失败: %s", e)
        raise HTTPException(status_code=502, detail=f"源站连接失败: {e}") from e
    if resp.status_code >= 400:
        status = resp.status_code
        await resp.aclose()
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"源站返回 {status}")

    # 透传上游与播放相关的响应头(含 Range 场景的 content-range / accept-ranges)。
    # content-length 走 _safe_content_length:压缩响应绝不透传长度(见该函数头注)。
    passthrough: dict[str, str] = {}
    for k in ("content-type", "content-range", "accept-ranges"):
        v = resp.headers.get(k)
        if v:
            passthrough[k] = v
    safe_len = _safe_content_length(resp.headers)
    if safe_len:
        passthrough["content-length"] = safe_len

    # 同源代理加固:只放行音视频类型,绝不把源站 text/html 之类原样转发
    # (修前 /media/stream?url=<任意HTML> 会返回 200 + text/html ⇒ 同源 XSS)。
    raw_ct = _normalize_ctype(passthrough.get("content-type"))
    if raw_ct in _CT_RENDERABLE_DENY or not (
        raw_ct.startswith(_MEDIA_CT_PREFIXES) or raw_ct in _MEDIA_CT_EXACT
    ):
        await resp.aclose()
        await client.aclose()
        _raise_unsafe_ctype(raw_ct, "音视频")
    passthrough.update(_proxy_hardening_headers())

    async def _stream_body() -> Any:
        try:
            async for chunk in resp.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    # 不传 media_type:保留上游 content-type,避免覆盖视频格式
    return StreamingResponse(_stream_body(), status_code=resp.status_code, headers=passthrough)


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/media/image?url=<图片直链> —— 同源自适应图片代理(2026-10-30 立)
#
# 与 /media/download、/media/stream 同族:同源代理 + 同一道 SSRF 闸门(复用
# screenshot_service._validate_url_ssrf,封死私有/环回/链路本地/元数据 IP)。
# 但本端点**不碰数据库**:download/stream 只允许命中 media_tasks 表里平台自己
# 记录过的产物 URL,而 markdown/用户贴入的图片来自不可枚举的任意公网域名,无法
# 预先登记 —— 它们本就因前端透传 https: 外链,导致 img-src 必须放开 https: 这道
# 外泄信道。本端点把"任意 SSRF 安全的公网直链"收口到同域 /api/media/image,
# 浏览器只碰同源,img-src 可收窄回 'self' blob:,外泄信道面清零。
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/media/image")
async def proxy_image(url: str, request: Request) -> Any:
    """按图片直链同源代理(内联显示,非下载);SSRF 闸门 + 任意安全公网 URL。

    与 download/stream 不同:本端点不查 media_tasks 库,允许任何通过
    _validate_url_ssrf 的公网直链 —— AI/markdown/用户图片来自不可枚举域名,
    无法预先登记,只能靠 SSRF 防护而非白名单鉴权。无 Content-Disposition(内联)。
    """
    _user_scope(request)  # 401 未登录;本端点是 SSRF 收口,不做库内产物归属校验
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="url 必须是 http(s) 直链")

    from ..services.screenshot_service import _validate_url_ssrf

    ok, reason = _validate_url_ssrf(url)
    if not ok:
        raise HTTPException(status_code=400, detail=f"URL 不允许访问: {reason}")

    client = httpx.AsyncClient(
        timeout=httpx.Timeout(20.0, read=60.0),
        follow_redirects=False,
        headers=_UPSTREAM_NO_COMPRESSION,
    )
    try:
        # 2026-10-31 安全强化第 10 批:手动逐跳,每跳过 SSRF 尺(重定向绕过封死)
        resp = await _send_following_redirects(client, url)
    except HTTPException:
        await client.aclose()
        raise  # SSRF 拒绝保持 400,不被吞成 502
    except Exception as e:  # noqa: BLE001
        await client.aclose()
        logger.warning("[media_tasks] 图片代理连接源站失败: %s", e)
        raise HTTPException(status_code=502, detail=f"源站连接失败: {e}") from e
    if resp.status_code >= 400:
        status = resp.status_code
        await resp.aclose()
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"源站返回 {status}")

    # 同源代理加固(核心):本端点是同源端点,修前把源站类型原样转发 ⇒
    # /media/image?url=<任意HTML> 返回 200 + text/html,浏览器同源渲染攻击者页面。
    # 只放行图片白名单类型;空类型/可渲染类型一律 415,绝不原样透传。
    raw_ct = _normalize_ctype(resp.headers.get("content-type"))
    if raw_ct in _CT_RENDERABLE_DENY or raw_ct not in _IMAGE_CT_ALLOW:
        await resp.aclose()
        await client.aclose()
        _raise_unsafe_ctype(raw_ct, "图片")
    ctype = raw_ct

    passthrough: dict[str, str] = {"cache-control": "private, max-age=3600"}
    passthrough.update(_proxy_hardening_headers())
    safe_len = _safe_content_length(resp.headers)
    if safe_len:
        passthrough["Content-Length"] = safe_len

    async def _body() -> Any:
        try:
            async for chunk in resp.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    # 透传上游 content-type(已过白名单校验),不内联下载
    return StreamingResponse(_body(), media_type=ctype, headers=passthrough)


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
