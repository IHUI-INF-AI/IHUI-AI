# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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
import json
import logging
import os
from typing import Any

from app.core.db import get_db_conn
from app.providers.base_provider import ProviderError
from app.providers.kling_provider import KlingProvider
from app.providers.jimeng_provider import JimengProvider
from app.providers.alibaba_dashscope_provider import AlibabaDashscopeProvider
from app.providers.tencent_hunyuan_provider import TencentHunyuanProvider

logger = logging.getLogger(__name__)

# 默认 provider 优先级(可被 VIDEO_PROVIDER 覆盖)
_DEFAULT_PRIORITY = ["kling", "jimeng", "wan", "hunyuan"]


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
        if name in ("kling", "可灵"):
            p = KlingProvider(None)
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
            result = await inst.generate_video(prompt, "", **kwargs)
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


async def _set_status(task_id: int, status: str, result: str) -> None:
    conn = await get_db_conn()
    try:
        await conn.execute(_update_sql, status, result, task_id)
    finally:
        await conn.close()


async def video_worker_loop() -> None:
    """无限轮询:领取 accepted 任务出片。缺少厂商凭据时静默轮询不报错。"""
    interval = max(3, int(os.environ.get("VIDEO_POLL_INTERVAL_S", "10")))
    logger.info("[video] worker 启动,轮询间隔 %ds", interval)
    while True:
        try:
            processed = await _process_one()
            if not processed:
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
        try:
            await _started_task
        except asyncio.CancelledError:
            pass
    _started_task = None
# ⁠​‌​​‌​​‌‍​​​​​​‌‍