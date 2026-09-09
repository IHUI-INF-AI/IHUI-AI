# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""媒体任务统一持久化(2026-09-09 立,补齐"对话内媒体任务不可查/不可取消"缺口)。

对话内媒体工具(video_generation / music_generation / voice_tts / image_generation /
image_edit / token6688 异步图片)提交后把 task_id / 产物 URL 统一落库 media_tasks,
支撑:
- "我的媒体任务"统一查询(REST GET /api/media/tasks,按 kind/status 过滤)
- 长任务取消(REST POST /api/media/tasks/{task_id}/cancel)
- 跨会话延续(对话链 call_tool 统一捕获,不依赖对话记忆)

设计要点:
- 落库全程 try/except 安全包裹:DB 不可用仅告警,绝不阻断对话主流程
- 非媒体工具直接跳过(零开销)
- status 归一化:有 task_id 无产物 URL → processing;有产物 URL → succeeded;ok=false → failed
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from ..core.db import get_db_conn

logger = logging.getLogger(__name__)

# media_tasks 表(kind 为媒体类型:video/music/tts/image)
_CREATE_SQL = """
CREATE TABLE IF NOT EXISTS media_tasks (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'media',
  tool TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  task_id TEXT NOT NULL DEFAULT '',
  user_uuid TEXT NOT NULL DEFAULT '',
  chat_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'processing',
  message TEXT NOT NULL DEFAULT '',
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_media_tasks_user_uuid ON media_tasks (user_uuid);
CREATE INDEX IF NOT EXISTS ix_media_tasks_task_id ON media_tasks (task_id);
CREATE INDEX IF NOT EXISTS ix_media_tasks_kind_status ON media_tasks (kind, status);
-- 2026-09-09 修复:ON CONFLICT(task_id) 依赖唯一约束,此前无约束导致重复 task_id
-- 永远走 INSERT 新行、UPDATE 分支不可达。部分唯一索引(空 task_id 不唯一)保证
-- 同任务二次落库走 UPDATE 刷新状态/产物。
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_tasks_task_id
  ON media_tasks (task_id) WHERE task_id <> '';
"""

# 媒体工具 → kind 映射(对话内 MCP 工具名)
_MEDIA_TOOL_KIND: dict[str, str] = {
    "video_generation": "video",
    "music_generation": "music",
    "voice_tts": "tts",
    "image_generation": "image",
    "image_edit": "image",
}


def _kind_for_tool(tool: str) -> str | None:
    """返回媒体 kind(video/music/tts/image);非媒体工具返回 None(跳过落库)。"""
    return _MEDIA_TOOL_KIND.get(tool)


def _normalize_status(ok: bool, task_id: str, has_url: bool) -> str:
    if not ok:
        return "failed"
    if has_url:
        return "succeeded"
    if task_id:
        return "processing"
    return "succeeded" if not task_id else "processing"


async def ensure_table() -> None:
    """幂等建表(ai-service 首次访问时调用;失败仅告警不抛)。"""
    try:
        conn = await get_db_conn()
        try:
            await conn.execute(_CREATE_SQL)
        finally:
            await conn.close()
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_tasks] 建表失败(不阻断): %s", e)


async def persist_media_task(
    tool: str,
    result: dict[str, Any],
    *,
    user_uuid: str = "",
    chat_id: str = "",
    prompt: str = "",
) -> bool:
    """对话内媒体工具结果落库。非媒体工具 / 无产物字段直接跳过。

    Args:
        tool: MCP 工具名(video_generation / music_generation / voice_tts / ...)
        result: 工具 handler 返回 dict(统一 shape:{ok, task_id, *_url, ...})
        user_uuid / chat_id: 调用者上下文(对话链传 owner_uuid / session_id)
        prompt: 描述(可选,取 result.prompt 兜底)
    """
    kind = _kind_for_tool(tool)
    if kind is None or not isinstance(result, dict):
        return False
    task_id = str(result.get("task_id") or "").strip()
    image_url = result.get("image_url")
    audio_url = result.get("audio_url")
    video_url = result.get("video_url")
    has_url = any(
        isinstance(u, str) and u and not u.startswith("data:")
        for u in (image_url, audio_url, video_url)
    )
    if not task_id and not has_url:
        return False  # 无在途/产物信息,不值得落库
    ok = bool(result.get("ok", True))
    status = _normalize_status(ok, task_id, has_url)
    provider = str(result.get("provider") or "").strip() or "token6688"
    message = str(result.get("message") or prompt or result.get("prompt") or "").strip()[:1000]
    payload: dict[str, Any] = {
        "image_url": image_url if isinstance(image_url, str) else None,
        "audio_url": audio_url if isinstance(audio_url, str) else None,
        "video_url": video_url if isinstance(video_url, str) else None,
        "completed": bool(result.get("completed")),
        "progress": result.get("progress"),
    }
    try:
        conn = await get_db_conn()
        try:
            rows = await conn.fetch(
                "INSERT INTO media_tasks "
                "(kind, tool, provider, task_id, user_uuid, chat_id, status, message, result) "
                "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) "
                "ON CONFLICT (task_id) WHERE task_id <> '' DO NOTHING RETURNING id",
                kind, tool, provider, task_id,
                user_uuid or "", chat_id or "",
                status, message, json.dumps(payload, ensure_ascii=False),
            )
            inserted = bool(rows)
            if not inserted and task_id:
                # 已存在同 task_id(对话内多次查询同一任务)→ 刷新状态与产物
                await conn.execute(
                    "UPDATE media_tasks SET status=$1, result=$2, message=$3, "
                    "provider=$4, updated_at=now() WHERE task_id=$5",
                    status, json.dumps(payload, ensure_ascii=False), message, provider, task_id,
                )
            return True
        finally:
            await conn.close()
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_tasks] 落库失败(不阻断): tool=%s err=%s", tool, e)
        return False


async def query_media_tasks(
    *,
    kind: str | None = None,
    status: str | None = None,
    user_uuid: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> dict[str, Any]:
    """媒体任务列表(kind/status 逗号分隔多值;倒序)。"""
    import json as _json

    limit = max(1, min(int(limit or 20), 100))
    offset = max(0, int(offset or 0))
    where: list[str] = []
    params: list[Any] = []
    for _field, _val in (("kind", kind), ("status", status)):
        if not _val:
            continue
        values = [v.strip() for v in str(_val).split(",") if v.strip()]
        if values:
            params.append(values)
            where.append(f"{_field} = ANY(${len(params)})")
    if user_uuid:
        params.append(user_uuid)
        where.append(f"user_uuid=${len(params)}")
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    conn = await get_db_conn()
    try:
        rows = await conn.fetch(
            "SELECT id, kind, tool, provider, task_id, user_uuid, chat_id, status, "
            "message, result, created_at, updated_at "
            f"FROM media_tasks {where_sql} ORDER BY id DESC LIMIT $%d OFFSET $%d"
            % (len(params) + 1, len(params) + 2),
            *params, limit, offset,
        )
        total = await conn.fetchval(
            f"SELECT count(*) FROM media_tasks {where_sql}", *params,
        )
    finally:
        await conn.close()
    items: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        res = d.get("result")
        if res:
            try:
                d["result"] = _json.loads(res)
            except (ValueError, TypeError):
                pass
        items.append(d)
    return {"items": items, "total": total or 0, "limit": limit, "offset": offset}


async def get_media_task(task_id: str) -> dict[str, Any] | None:
    """按 task_id 取单条(最新一条)。"""
    import json as _json

    task_id = str(task_id or "").strip()
    if not task_id:
        return None
    conn = await get_db_conn()
    try:
        rows = await conn.fetch(
            "SELECT id, kind, tool, provider, task_id, user_uuid, chat_id, status, "
            "message, result, created_at, updated_at "
            "FROM media_tasks WHERE task_id=$1 ORDER BY id DESC LIMIT 1",
            task_id,
        )
    finally:
        await conn.close()
    if not rows:
        return None
    d = dict(rows[0])
    res = d.get("result")
    if res:
        try:
            d["result"] = _json.loads(res)
        except (ValueError, TypeError):
            pass
    return d


async def update_media_task(task_id: str, **fields: Any) -> bool:
    """按 task_id 更新字段(如取消后置 status=cancelled)。"""
    import json as _json

    task_id = str(task_id or "").strip()
    if not task_id or not fields:
        return False
    sets: list[str] = []
    params: list[Any] = []
    for k, v in fields.items():
        if k == "result" and isinstance(v, (dict, list)):
            v = _json.dumps(v, ensure_ascii=False)
        params.append(v)
        sets.append(f"{k}=${len(params)}")
    if not sets:
        return False
    params.append(task_id)
    conn = await get_db_conn()
    try:
        row = await conn.fetchrow(
            f"UPDATE media_tasks SET {', '.join(sets)}, updated_at=now() "
            f"WHERE task_id=${len(params)} RETURNING id",
            *params,
        )
        return bool(row)
    finally:
        await conn.close()


# ---------------------------------------------------------------------------
# 终态自动收尾(2026-09-09 立):对话内媒体长任务(video/music/tts/image)不再只靠
# 用户主动问"好了吗",两条互补通道把产物/状态写回 media_tasks:
#   A. 官方 webhook 回调(POST /api/media/tasks/callback,HMAC 验签)→ 秒级终态
#   B. 后台周期探测(MEDIA_TASK_POLLER_ENABLED=1)→ 回调丢失/未配置时的兜底
# 两者与前端 5s 轮询 /media/tasks/{task_id} 幂等互补:谁先写终态谁生效,
# 已终态行不重复探测/回写(见 _STATUS_IN_FLIGHT 过滤)。
# ---------------------------------------------------------------------------

# 在途状态(可被收尾覆盖);终态(succeeded/failed/cancelled)永不回头
_STATUS_IN_FLIGHT = ("processing", "accepted", "submitted", "pending")

# kind → 产物字段名(前端播放/预览按此取 URL)
_KIND_URL_FIELD = {
    "video": "video_url",
    "music": "audio_url",
    "tts": "audio_url",
    "image": "image_url",
}


def _kind_url_field(kind: str) -> str:
    return _KIND_URL_FIELD.get(kind, "video_url")


async def handle_media_callback(snapshot: dict[str, Any]) -> dict[str, Any]:
    """token6688 官方终态回调快照 → media_tasks 实时回写。

    快照形状同 GET /v1/tasks/{task_id}(task_id/id/state/status/is_final/
    output_url/result_url/error...)。返回 {ok, matched}:
    matched=0 表示无在途匹配(未知/已终态任务,幂等静默);中间态快照忽略等终态。
    """
    remote_id = str(snapshot.get("task_id") or snapshot.get("id") or "").strip()
    if not remote_id:
        return {"ok": False, "matched": 0, "error": "快照缺 task_id"}
    state = str(snapshot.get("state") or "").lower()
    status = str(snapshot.get("status") or snapshot.get("task_status") or state or "").lower()
    is_final = bool(snapshot.get("is_final")) or state in ("success", "failed", "completed")
    media_url = (
        snapshot.get("output_url") or snapshot.get("result_url") or snapshot.get("url") or ""
    )
    ok = (
        (is_final and state in ("success", "completed", "succeeded"))
        or status in ("completed", "succeeded")
        or bool(media_url)
    )
    failed = (is_final and state in ("failed", "error", "cancelled")) or status in (
        "failed", "error",
    )
    if not (ok or failed):
        return {"ok": True, "matched": 0, "ignored": "non-final"}
    conn = await get_db_conn()
    try:
        rows = await conn.fetch(
            "SELECT id, kind FROM media_tasks "
            "WHERE task_id=$1 AND status = ANY($2) "
            "ORDER BY id ASC LIMIT 5",
            remote_id, list(_STATUS_IN_FLIGHT),
        )
    finally:
        await conn.close()
    matched = 0
    for r in rows:
        if ok and media_url:
            field = _kind_url_field(r["kind"])
            payload = {field: media_url, "completed": True, "progress": None, "via": "callback"}
            new_status = "succeeded"
        else:
            err = str(
                snapshot.get("error") or snapshot.get("error_message")
                or f"token6688 回调失败(state={state or status})"
            )[:1000]
            payload = {"error": err, "via": "callback"}
            new_status = "failed"
        await update_media_task(remote_id, status=new_status, result=payload)
        logger.info(
            "[media_tasks] 回调落终态: kind=%s task=%s status=%s url=%s",
            r["kind"], remote_id, new_status, (media_url or "")[:80],
        )
        matched += 1
    return {"ok": True, "matched": matched}


# 轮询开关与参数(env 可调;默认关闭,避免无 key 时空转调上游)
_MEDIA_POLLER_ENABLED = os.environ.get("MEDIA_TASK_POLLER_ENABLED", "0") == "1"
_MEDIA_POLL_INTERVAL = float(os.environ.get("MEDIA_TASK_POLL_INTERVAL", "60"))
_MEDIA_POLL_MAX_BATCH = int(os.environ.get("MEDIA_TASK_POLL_MAX_BATCH", "10"))
_MEDIA_POLL_MAX_AGE_HOURS = float(os.environ.get("MEDIA_TASK_POLL_MAX_AGE_HOURS", "24"))

_poller_task: asyncio.Task[Any] | None = None
_poller_stop = asyncio.Event()


async def _poll_processing_batch() -> int:
    """扫描一批在途 token6688 任务并探测终态;返回本次回写终态的行数。

    只读探测(get_task_status),不改上游、不扣费;与前端轮询/回调幂等互补。
    """
    conn = await get_db_conn()
    try:
        rows = await conn.fetch(
            "SELECT id, kind, task_id FROM media_tasks "
            "WHERE status = ANY($1) AND provider='token6688' AND task_id <> '' "
            "AND created_at > now() - ($2::float * interval '1 hour') "
            "ORDER BY updated_at ASC LIMIT $3",
            list(_STATUS_IN_FLIGHT), _MEDIA_POLL_MAX_AGE_HOURS, _MEDIA_POLL_MAX_BATCH,
        )
    finally:
        await conn.close()
    if not rows:
        return 0
    from ..core.config import settings
    from ..providers.token6688_provider import Token6688Provider

    cfg = settings.get_provider_config("token6688")
    if not cfg.api_key:
        return 0
    provider = Token6688Provider(api_key=cfg.api_key, api_base=cfg.api_base)
    updated = 0
    for r in rows:
        try:
            st = await provider.get_task_status(str(r["task_id"]))
        except Exception as e:  # noqa: BLE001
            logger.warning("[media_tasks] 探测失败 task=%s err=%s", r["task_id"], e)
            continue
        status = str(st.get("status") or "").lower()
        if status in ("completed", "succeeded", "success"):
            url = str(st.get("video_url") or "").strip()
            payload = {_kind_url_field(r["kind"]): url, "completed": True, "via": "poller"}
            if not url:
                continue  # 终态但尚无产物(stage=downloading 等),下次循环再收
            await update_media_task(str(r["task_id"]), status="succeeded", result=payload)
            updated += 1
            logger.info("[media_tasks] 轮询收尾成功: task=%s", r["task_id"])
        elif status in ("failed", "error", "cancelled"):
            await update_media_task(
                str(r["task_id"]),
                status="failed",
                result={"error": st.get("error") or "task failed", "via": "poller"},
            )
            updated += 1
            logger.info("[media_tasks] 轮询收尾失败: task=%s", r["task_id"])
    return updated


async def _media_task_poller_loop() -> None:
    """周期扫描在途任务(60s 一次,单循环异常不退出)。"""
    while True:
        try:
            await _poll_processing_batch()
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001
            logger.warning("[media_tasks] 轮询循环异常(继续): %s", e)
        try:
            await asyncio.wait_for(_poller_stop.wait(), timeout=_MEDIA_POLL_INTERVAL)
            return
        except asyncio.TimeoutError:
            continue


def start_media_task_poller() -> None:
    """启动后台轮询(MEDIA_TASK_POLLER_ENABLED=1 时由 main.py lifespan 调用)。"""
    global _poller_task, _poller_stop
    if not _MEDIA_POLLER_ENABLED:
        return
    if _poller_task and not _poller_task.done():
        return
    _poller_stop = asyncio.Event()
    _poller_task = asyncio.create_task(_media_task_poller_loop())
    logger.info("[media_tasks] 后台轮询已启动(interval=%ss batch=%d)", _MEDIA_POLL_INTERVAL, _MEDIA_POLL_MAX_BATCH)


async def stop_media_task_poller() -> None:
    """停止后台轮询(lifespan 关闭时调用,幂等)。"""
    global _poller_task
    _poller_stop.set()
    if _poller_task:
        _poller_task.cancel()
        try:
            await _poller_task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
        _poller_task = None
        logger.info("[media_tasks] 后台轮询已停止")
