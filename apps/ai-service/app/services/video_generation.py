# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""真实视频生成编排服务(R74 审计后补建)。

把 4 家视频厂商适配器统一收口,并驱动 ai-service 侧的后台 worker 消费
`video_generation_tasks` 表(由 apps/api 的 /video-routes/tasks/create 写入 accepted 行):

- Kafka/可灵(kling):KLING_ACCESS_KEY + KLING_SECRET_KEY
- 字节即梦/Seedance(jimeng):ARK_API_KEY 或 ARK_ACCESS_KEY + ARK_SECRET_KEY
- 阿里通义万相(wan):DASHSCOPE_API_KEY
- 腾讯混元(hunyuan):TENCENT_SECRET_ID + TENCENT_SECRET_KEY(需开通混元视频)

provider 选择策略:env `VIDEO_PROVIDER`(逗号分隔,顺序即优先级,默认按上表顺序),配合
已配置凭据的那几家;首选 provider 失败时依次降级到下一家(自动故障转移)。

说明:text2video 单据普遍只支持数秒~15s 短视频,"90 秒长片"需拆分为多段分镜,视频接口
本身无 90s 输出能力,worker 会按分镜 prompt 生成多条短片段。
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
from typing import Any

from app.core.db import get_db_conn
from app.providers.alibaba_dashscope_provider import AlibabaDashscopeProvider
from app.providers.base_provider import ProviderError
from app.providers.jimeng_provider import JimengProvider
from app.providers.kling_provider import KlingProvider
from app.providers.tencent_hunyuan_provider import TencentHunyuanProvider
from app.providers.token6688_provider import Token6688Provider

logger = logging.getLogger(__name__)

# 默认 provider 优先级(可被 VIDEO_PROVIDER 覆盖);token6688 单 key 全模态,已配置则优先
_DEFAULT_PRIORITY = ["token6688", "kling", "jimeng", "wan", "hunyuan"]


def _configured_providers() -> list[tuple[str, Any]]:
    """按 env 优先级 + 凭据是否齐备,返回可用 provider 列表 [(name, instance)]。"""
    priority = os.environ.get("VIDEO_PROVIDER", "").strip()
    order = [p.strip() for p in priority.split(",") if p.strip()] or _DEFAULT_PRIORITY
    out: list[tuple[str, Any]] = []
    seen: set[str] = set()
    for name in order:
        if name in seen:
            continue
        seen.add(name)
        inst = _instantiate(name)
        if inst is None:
            continue
        out.append((name, inst))
    return out


def _instantiate(name: str) -> Any | None:
    """按厂商名实例化 provider;未配置凭据返回 None。"""
    try:
        if name in ("token6688", "t6688", "tokengo"):
            key = os.environ.get("TOKEN6688_API_KEY") or ""
            if not key:
                # 2026-09-08:LLM_PROVIDERS JSON token6688 条目兜底(单 key 配置约定)
                try:
                    from app.core.config import settings
                    key = settings.get_provider_config("token6688").api_key or ""
                except Exception:  # noqa: BLE001
                    key = ""
            if key:
                return Token6688Provider(key)
            logger.info("[video] token6688 未配置(TOKEN6688_API_KEY 或 LLM_PROVIDERS.token6688),跳过")
            return None
        if name in ("kling", "可灵"):
            p: Any = KlingProvider(None)
            if p.configured:
                return p
            logger.info("[video] 可灵未配置(KLING_ACCESS_KEY/SECRET_KEY),跳过")
            return None
        if name in ("jimeng", "即梦", "seedance"):
            p = JimengProvider(None)
            if p.configured:
                return p
            logger.info("[video] 即梦未配置(ARK_API_KEY 或 ARK_ACCESS_KEY/SECRET_KEY),跳过")
            return None
        if name in ("wan", "wann", "万相"):
            p = AlibabaDashscopeProvider("")
            if os.environ.get("DASHSCOPE_API_KEY"):
                return p
            logger.info("[video] 通义万相未配置(DASHSCOPE_API_KEY),跳过")
            return None
        if name in ("hunyuan", "混元"):
            if os.environ.get("TENCENT_SECRET_ID") and os.environ.get("TENCENT_SECRET_KEY"):
                return TencentHunyuanProvider("")
            logger.info("[video] 混元未配置(TENCENT_SECRET_ID/SECRET_KEY),跳过")
            return None
    except Exception as e:  # noqa: BLE001
        logger.warning("[video] provider 实例化失败 %s: %s", name, e)
        return None
    logger.warning("[video] 未知视频厂商: %s", name)
    return None


async def generate_video(
    prompt: str,
    *,
    duration: int = 5,
    image: str | None = None,
    provider: str | None = None,
) -> dict[str, Any]:
    """按策略挑一家已配置视频厂商生成视频,失败自动降级下一家。

    返回统一的 {provider, model, task_id, video_url, duration}。
    """
    providers = _configured_providers()
    if not providers:
        raise ProviderError(
            "未配置任何视频厂商凭据。请在 ai-service 环境变量设置 KLING_*/ARK_*/"
            "DASHSCOPE_API_KEY/TENCENT_* 之一。",
            503,
        )
    if provider:
        providers = [item for item in providers if item[0] == provider] or providers

    errors: list[str] = []
    for name, inst in providers:
        try:
            kwargs: dict[str, Any] = {"duration": int(duration)}
            if image:
                kwargs["image"] = image
            result: dict[str, Any] = await inst.generate_video(prompt, "", **kwargs)
            logger.info("[video] %s 出片成功 task=%s url=%s",
                        name, result.get("task_id"), result.get("video_url"))
            return result
        except ProviderError as e:
            errors.append(f"{name}: {e}")
            logger.warning("[video] %s 出片失败,尝试下一家: %s", name, e)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: {type(e).__name__}: {e}")
            logger.warning("[video] %s 出片异常,尝试下一家: %s", name, e)
    raise ProviderError("所有视频厂商均失败: " + " | ".join(errors), 502)


# ---------------------------------------------------------------------------
# 后台 worker:消费 video_generation_tasks
# ---------------------------------------------------------------------------
_claim_sql = """
UPDATE video_generation_tasks
SET status='processing', updated_at=now()
WHERE id = (SELECT id FROM video_generation_tasks
            WHERE status='accepted' ORDER BY id ASC
            FOR UPDATE SKIP LOCKED LIMIT 1)
RETURNING id, task_id, user_uuid, message
"""

_update_sql = """
UPDATE video_generation_tasks
SET status=$1, result=$2, updated_at=now()
WHERE id=$3
"""


async def _process_one() -> bool:
    """领取并处理一个 accepted 任务。返回是否处理了任务。

    未配置任何视频厂商凭据时直接跳过(任务保持 accepted,不误标 failed),
    等待 Key 就绪后由下一轮轮询接管,避免把用户任务打成失败。

    token6688 长任务优化(2026-09-08):官方视频 p90 55~75 分钟,阻塞轮询会把
    单 worker 卡死 1 小时 → 提交(wait=False)后立即返回,任务置 processing 且
    result 记 poll_via 标记,由 _poll_pending() 轮询终态;其余厂商保持阻塞编排。
    """
    if not _configured_providers():
        return False

    conn = await get_db_conn()
    try:
        row = await conn.fetchrow(_claim_sql)
    finally:
        await conn.close()
    if not row:
        return False

    task_id = row["id"]
    prompt = (row["message"] or "").strip()
    # "90 秒"等长提示词按分镜拆段(每段默认 5s);多数接口上限 10~15s
    duration = 5
    logger.info("[video] worker 处理任务 id=%s prompt=%r", task_id, prompt[:120])
    try:
        if not prompt:
            raise ProviderError("任务缺少 prompt(message 为空)")
        # token6688 提交即返回(poll_via 标记),交给 _poll_pending 轮询;提交失败降级原编排
        t6688 = _instantiate("token6688")
        if t6688 is not None:
            try:
                # 官方 webhook:配置 TOKEN6688_CALLBACK_URL 后带 callback_url 提交,
                # 终态平台主动 POST 任务快照(最多重试 3 次)→ /api/video/token6688-callback
                # 提前落终态;_poll_pending 对已终态行不再处理(SQL 只查 processing),二者幂等互斥。
                cb_url = os.environ.get("TOKEN6688_CALLBACK_URL", "").strip()
                cb_secret = os.environ.get("TOKEN6688_CALLBACK_SECRET", "").strip()
                extra: dict[str, str] = {}
                if cb_url:
                    extra["callback_url"] = cb_url
                    if cb_secret:
                        extra["callback_secret"] = cb_secret
                submitted = await t6688.generate_video(
                    prompt, "", duration=duration, wait=False, **extra,
                )
                remote_id = str(submitted.get("task_id") or "")
                if remote_id:
                    payload = json.dumps(
                        {
                            "poll_via": "token6688", "task_id": remote_id,
                            "model": submitted.get("model", ""), "duration": duration,
                        },
                        ensure_ascii=False,
                    )
                    await _set_status(task_id, "processing", payload)
                    logger.info("[video] token6688 任务已提交 remote=%s → 转入 polling", remote_id)
                    return True
            except Exception as submit_err:  # noqa: BLE001
                logger.warning("[video] token6688 提交失败,降级阻塞编排: %s", submit_err)
        result = await generate_video(prompt, duration=duration)
        payload = json.dumps(
            {
                "url": result.get("video_url", ""),
                "provider": result.get("provider", ""),
                "model": result.get("model", ""),
                "task_id": result.get("task_id", ""),
                "duration": result.get("duration", duration),
            },
            ensure_ascii=False,
        )
        await _set_status(task_id, "succeed", payload)
        return True
    except Exception as e:  # noqa: BLE001
        logger.error("[video] worker 任务 %s 失败: %s", task_id, e)
        await _set_status(task_id, "failed", str(e)[:2000])
        return True


_POLL_PENDING_SQL = """
SELECT id, result FROM video_generation_tasks
WHERE status='processing' AND result LIKE '%"poll_via"%'
ORDER BY id ASC LIMIT 20
"""

_RESET_STUCK_SQL = """
UPDATE video_generation_tasks SET status='accepted', updated_at=now()
WHERE status='processing' AND (result IS NULL OR result NOT LIKE '%"poll_via"%')
"""


async def _poll_pending() -> int:
    """轮询 token6688 已提交任务(poll_via 标记)的终态。返回更新条数。

    查询异常不更新状态(下一轮重试);终态成功→succeed、失败→failed。
    """
    t6688 = _instantiate("token6688")
    if t6688 is None:
        return 0
    conn = await get_db_conn()
    try:
        rows = await conn.fetch(_POLL_PENDING_SQL)
    finally:
        await conn.close()
    updated = 0
    for r in rows:
        try:
            meta = json.loads(r["result"] or "{}")
        except (TypeError, ValueError):
            meta = {}
        remote_id = str(meta.get("task_id") or "")
        if not remote_id:
            await _set_status(r["id"], "failed", "poll_via 行缺 task_id")
            updated += 1
            continue
        try:
            st = await t6688.get_task_status(remote_id)
        except Exception as e:  # noqa: BLE001
            logger.warning("[video] polling 任务 %s 查询失败(下轮重试): %s", remote_id, e)
            continue
        if st.get("ok") and st.get("video_url"):
            payload = json.dumps(
                {
                    "url": st["video_url"], "provider": "token6688",
                    "model": meta.get("model", ""), "task_id": remote_id,
                    "duration": meta.get("duration", 5),
                },
                ensure_ascii=False,
            )
            await _set_status(r["id"], "succeed", payload)
            logger.info("[video] polling 任务 %s 完成 url=%s", remote_id, st["video_url"][:80])
            updated += 1
        elif st.get("failed"):
            await _set_status(r["id"], "failed", st.get("error") or "token6688 任务失败")
            logger.info("[video] polling 任务 %s 失败", remote_id)
            updated += 1
    return updated


async def _set_status(task_id: int, status: str, result: str) -> None:
    conn = await get_db_conn()
    try:
        await conn.execute(_update_sql, status, result, task_id)
    finally:
        await conn.close()


async def video_worker_loop() -> None:
    """无限轮询:领取 accepted 任务出片 + 轮询 token6688 已提交任务终态。

    缺少厂商凭据时静默轮询不报错。启动时把卡死的 processing(无 poll_via 标记,
    即阻塞编排被服务重启打断的任务)重置回 accepted 重新领取;带 poll_via 标记的
    行不重置(token6688 侧任务仍在计费运行,重复提交会二次扣费),由 _poll_pending
    继续接管轮询。
    """
    interval = max(3, int(os.environ.get("VIDEO_POLL_INTERVAL_S", "10")))
    conn = await get_db_conn()
    try:
        n = await conn.execute(_RESET_STUCK_SQL)
        reset_n = str(n).split()[-1] if n else "0"
        if reset_n not in ("", "0"):
            logger.info("[video] 启动恢复: %s 个卡死 processing 任务重置为 accepted", reset_n)
    except Exception as e:  # noqa: BLE001
        logger.warning("[video] 启动恢复失败(忽略): %s", e)
    finally:
        await conn.close()
    logger.info("[video] worker 启动,轮询间隔 %ds", interval)
    while True:
        try:
            processed = await _process_one()
            polled = await _poll_pending()
            if not processed and not polled:
                await asyncio.sleep(interval)
            # 处理完一个后立即继续下一个,避免冷启动批量积压拖慢
        except asyncio.CancelledError:
            logger.info("[video] worker 取消")
            raise
        except Exception as e:  # noqa: BLE001
            logger.warning("[video] worker 循环异常(忽略): %s", e)
            await asyncio.sleep(interval)


_started_task: asyncio.Task[Any] | None = None


def start_video_worker() -> None:
    """由 lifespan 启动后台 worker(幂等)。"""
    global _started_task
    if _started_task is not None and not _started_task.done():
        return
    _started_task = asyncio.create_task(video_worker_loop())


async def stop_video_worker() -> None:
    global _started_task
    if _started_task is not None and not _started_task.done():
        _started_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _started_task
    _started_task = None


# ---------------------------------------------------------------------------
# token6688 官方 webhook 回调(2026-09-08 文档校准)
# 提交时带 callback_url(+callback_secret 验签),任务终态平台主动 POST 任务快照
# (best-effort,最多重试 3 次)。与 _poll_pending 幂等互斥:本回调只认 processing
# 行,终态写入后轮询 SQL 自然跳过;轮询先写终态则回调无匹配行,不重复更新。
# ---------------------------------------------------------------------------

_CALLBACK_MATCH_SQL = """
SELECT id, result FROM video_generation_tasks
WHERE status='processing' AND result LIKE $1
ORDER BY id ASC LIMIT 5
"""


async def handle_token6688_callback(snapshot: dict[str, Any]) -> dict[str, Any]:
    """处理 token6688 终态回调快照(形状同 GET /v1/tasks/{task_id})。

    返回 {ok, matched}:matched=0 表示无在途任务匹配(已终态/未知任务,幂等静默)。
    """
    remote_id = str(snapshot.get("task_id") or snapshot.get("id") or "").strip()
    if not remote_id:
        return {"ok": False, "matched": 0, "error": "快照缺 task_id"}

    t6688 = _instantiate("token6688")
    state = str(snapshot.get("state") or "").lower()
    status = str(snapshot.get("status") or "").lower()
    is_final = bool(snapshot.get("is_final")) or state in ("success", "failed")
    video_url = (
        snapshot.get("output_url") or snapshot.get("result_url")
        or (t6688._extract_media_url(snapshot) if t6688 else "")
        or ""
    )
    ok = (is_final and state in ("success", "completed", "succeeded")) or status in (
        "completed", "succeeded",
    ) or bool(video_url)
    failed = (is_final and state in ("failed", "error", "cancelled")) or status in ("failed", "error")
    if not (ok or failed):
        # 中间态快照(best-effort 可能推 progress)——不更新 DB,等终态
        return {"ok": True, "matched": 0, "ignored": "non-final"}

    # result JSON 键序可能不同,退化为双 LIKE(task_id 必含)
    fallback_pattern = f'%"task_id":"{remote_id}"%'
    conn = await get_db_conn()
    try:
        rows = await conn.fetch(_CALLBACK_MATCH_SQL, fallback_pattern)
    finally:
        await conn.close()
    matched = 0
    for r in rows:
        try:
            meta = json.loads(r["result"] or "{}")
        except (TypeError, ValueError):
            meta = {}
        if str(meta.get("task_id") or "") != remote_id:
            continue  # like 误匹配(如前缀重叠)
        if ok and video_url:
            payload = json.dumps(
                {
                    "url": video_url, "provider": "token6688",
                    "model": meta.get("model", ""), "task_id": remote_id,
                    "duration": meta.get("duration", 5),
                    "via": "callback",
                },
                ensure_ascii=False,
            )
            await _set_status(r["id"], "succeed", payload)
            logger.info("[video] 回调落终态: 行 %s task=%s url=%s", r["id"], remote_id, video_url[:80])
        else:
            err = str(
                snapshot.get("error") or snapshot.get("error_message")
                or f"token6688 回调失败(state={state or status})"
            )[:2000]
            await _set_status(r["id"], "failed", err)
            logger.info("[video] 回调落失败: 行 %s task=%s", r["id"], remote_id)
        matched += 1
    return {"ok": True, "matched": matched}
# ⁠​‌​​‌​​‌‍​​​​​​‌‍
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
