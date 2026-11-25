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
- Sand.ai MAGI-2(magi2):MAGI2_API_KEY 或 SAND_API_KEY(2026-11-25 接入,
  4–30s 1080p 有声,可见即可用前需在 Sand.ai 控制台申请开通)

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
from app.providers.agnes_video_provider import AgnesVideoProvider
from app.providers.alibaba_dashscope_provider import AlibabaDashscopeProvider
from app.providers.base_provider import ProviderError
from app.providers.jimeng_provider import JimengProvider
from app.providers.kling_provider import KlingProvider
from app.providers.magi2_provider import Magi2Provider
from app.providers.tencent_hunyuan_provider import TencentHunyuanProvider

logger = logging.getLogger(__name__)

# 默认 provider 优先级(可被 VIDEO_PROVIDER 覆盖);agnes 为聚合网关,凭据在 LLM_PROVIDERS 里,已配置则优先
_DEFAULT_PRIORITY = ["agnes", "magi2", "kling", "jimeng", "wan", "hunyuan"]

# 支持"先提交、后轮询"的厂商(长任务不阻塞 worker)
_POLLABLE_VIAS = ("magi2",)

# ---------------------------------------------------------------------------
# 凭据配置的播报去重(2026-10-18 立,治 5.2 万行/天的日志噪音)
#
# 现场:worker 每 `VIDEO_POLL_INTERVAL_S`(默认 10s)跑一轮 `_configured_providers()`,
# 而它对每个**未配置**厂商各打一条 INFO;实测 6 条/10s ≈ 51840 行/天,把 worker 自己的
# 启动/出片/报警日志全部埋掉(loki 侧同理放大)。
#
# 为什么不直接降级到 debug:"某厂商没配 key"是一条**环境事实**,运维配错凭据时它是唯一线索,
# 降级等于把线索从默认日志里删掉 ⇒ 沉默失效,与本仓告警治理的方向锁(§5e-1)相反。
#
# 采用标准解法 —— **按厂商的状态机播报**,只在状态翻转时打一次:
#   未配置 → 已配置 :打一条"凭据已就绪"(证明配置改动被进程感知到了)
#   已配置 → 未配置 :打一条"未配置,跳过"(证明凭据失效/被摘掉)
#   状态不变        :一句不打(同一事实重复 8640 次不增加任何信息)
# 两个方向都不静默,稳定态零噪音。进程重启后状态机归零 ⇒ 每次启动仍会完整报一遍。
# ---------------------------------------------------------------------------
_CRED_STATE: dict[str, bool] = {}


def _report_credential_state(name: str, configured: bool, hint: str = "") -> None:
    """厂商凭据状态播报(幂等):只在 discovered 状态发生变化时打一条 INFO。"""
    if _CRED_STATE.get(name) == configured:
        return
    _CRED_STATE[name] = configured
    if configured:
        logger.info("[video] %s 凭据已就绪,本轮起参与出片(状态未再变之前不重复播报)", name)
    else:
        detail = f"({hint})" if hint else ""
        logger.info(
            "[video] %s 未配置%s,跳过 —— 这是静态配置事实,后续轮次不再重复播报,"
            "补上凭据后本条会自动改为「凭据已就绪」",
            name, detail,
        )


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
        if name in ("agnes", "agnes-ai"):
            key = os.environ.get("AGNES_API_KEY", "").strip()
            base = os.environ.get("AGNES_API_BASE", "").strip()
            if not key:
                try:
                    from app.core.config import settings
                    cfg = settings.get_provider_config("agnes")
                    key = cfg.api_key or ""
                    base = (cfg.api_base or "").strip()
                except Exception:  # noqa: BLE001
                    key = ""
            if key:
                _report_credential_state(name, True)
                return AgnesVideoProvider(key, base or None)
            _report_credential_state(name, False, "AGNES_API_KEY 或 LLM_PROVIDERS.agnes")
            return None
        if name in ("magi2", "magi-2", "magi", "sand", "sandai"):
            # env 优先;生产常把厂商凭据收在 LLM_PROVIDERS JSON(与 agnes 同款),
            # 所以这里也要回退 settings.get_provider_config,否则只在 .env 配 key 才生效。
            key = (
                os.environ.get("MAGI2_API_KEY")
                or os.environ.get("SAND_API_KEY")
                or ""
            ).strip()
            base = os.environ.get("MAGI2_API_BASE", "").strip()
            model = os.environ.get("MAGI2_MODEL", "").strip()
            if not key or not base or not model:
                try:
                    from app.core.config import settings
                    cfg = settings.get_provider_config("magi2")
                    key = key or (cfg.api_key or "").strip()
                    base = base or (cfg.api_base or "").strip()
                    model = model or (cfg.default_model or "").strip()
                except Exception:  # noqa: BLE001
                    pass
            p: Any = Magi2Provider(
                key or None, base or None, model=model or None,
            )
            if p.configured:
                _report_credential_state(name, True)
                return p
            _report_credential_state(
                name, False, "MAGI2_API_KEY / SAND_API_KEY 或 LLM_PROVIDERS.magi2",
            )
            return None
        if name in ("kling", "可灵"):
            p: Any = KlingProvider(None)
            if p.configured:
                _report_credential_state(name, True)
                return p
            _report_credential_state(name, False, "KLING_ACCESS_KEY/SECRET_KEY")
            return None
        if name in ("jimeng", "即梦", "seedance"):
            p = JimengProvider(None)
            if p.configured:
                _report_credential_state(name, True)
                return p
            _report_credential_state(name, False, "ARK_API_KEY 或 ARK_ACCESS_KEY/SECRET_KEY")
            return None
        if name in ("wan", "wann", "万相"):
            p = AlibabaDashscopeProvider("")
            if os.environ.get("DASHSCOPE_API_KEY"):
                _report_credential_state(name, True)
                return p
            _report_credential_state(name, False, "DASHSCOPE_API_KEY")
            return None
        if name in ("hunyuan", "混元"):
            if os.environ.get("TENCENT_SECRET_ID") and os.environ.get("TENCENT_SECRET_KEY"):
                _report_credential_state(name, True)
                return TencentHunyuanProvider("")
            _report_credential_state(name, False, "TENCENT_SECRET_ID/SECRET_KEY")
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

    MAGI-2 长任务优化:30s 长片 + 排队,阻塞轮询会把单 worker 卡住 →
    提交(wait=False)后立即返回,任务置 processing 且 result 记 poll_via 标记,
    由 _poll_pending() 轮询终态;其余厂商保持阻塞编排。
    """
    # 只算一次并在下面复用,避免重复 IO/config 解析。
    available = _configured_providers()
    if not available:
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
    # 2026-10-03 数据出域合规整改:原为 `prompt=%r", task_id, prompt[:120]`,
    # 在**正常处理路径**上以 info 级把用户 prompt 前 120 字打进日志(stdout 落盘)。
    # 日志是典型的"留存面却无期限无权限隔离"的地方,把用户内容写进去等于绕过
    # 整套留存治理。改为只记长度与首部 40 字(够定位是哪种 prompt,不足以还原内容);
    # 真要看内容请查该任务的 DB 记录,那是有留存期与归属治理的地方。
    logger.info(
        "[video] worker 处理任务 id=%s prompt_len=%d prompt_head=%r",
        task_id,
        len(prompt),
        prompt[:40],
    )
    try:
        if not prompt:
            raise ProviderError("任务缺少 prompt(message 为空)")
        # MAGI-2:30s 长片 + 排队,阻塞轮询会把单 worker 卡住 → 先提交后轮询
        magi2 = next((inst for n, inst in available if n == "magi2"), None)
        if magi2 is not None:
            try:
                submitted = await magi2.generate_video(
                    prompt, "", duration=duration, wait=False,
                )
                remote_id = str(submitted.get("task_id") or "")
                if remote_id:
                    payload = json.dumps(
                        {
                            "poll_via": "magi2", "task_id": remote_id,
                            "model": submitted.get("model", ""), "duration": duration,
                        },
                        ensure_ascii=False,
                    )
                    await _set_status(task_id, "processing", payload)
                    logger.info("[video] magi2 任务已提交 remote=%s → 转入 polling", remote_id)
                    return True
            except Exception as submit_err:  # noqa: BLE001
                logger.warning("[video] magi2 提交失败,降级阻塞编排: %s", submit_err)
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
    """轮询已提交未落终态的任务(poll_via 标记)终态。返回更新条数。

    按 result 里的 poll_via 取对应 provider 逐行处理;某家凭据被摘除时该行保持
    processing,等凭据恢复后下一轮接管(不误标失败)。查询异常同样不更新状态。
    """
    conn = await get_db_conn()
    try:
        rows = await conn.fetch(_POLL_PENDING_SQL)
    finally:
        await conn.close()
    updated = 0
    instances: dict[str, Any] = {}
    for r in rows:
        try:
            meta = json.loads(r["result"] or "{}")
        except (TypeError, ValueError):
            meta = {}
        via = str(meta.get("poll_via") or "")
        remote_id = str(meta.get("task_id") or "")
        if not remote_id:
            await _set_status(r["id"], "failed", "poll_via 行缺 task_id")
            updated += 1
            continue
        if via not in _POLLABLE_VIAS:
            await _set_status(r["id"], "failed", f"未知 poll_via: {via or '<空>'}")
            updated += 1
            continue
        if via not in instances:
            instances[via] = _instantiate(via)
        inst = instances[via]
        if inst is None:
            continue
        try:
            st = await inst.get_task_status(remote_id)
        except Exception as e:  # noqa: BLE001
            logger.warning("[video] polling 任务 %s 查询失败(下轮重试): %s", remote_id, e)
            continue
        if st.get("ok") and st.get("video_url"):
            payload = json.dumps(
                {
                    "url": st["video_url"], "provider": via,
                    "model": meta.get("model", ""), "task_id": remote_id,
                    "duration": meta.get("duration", 5),
                },
                ensure_ascii=False,
            )
            await _set_status(r["id"], "succeed", payload)
            logger.info(
                "[video] polling 任务 %s 完成 provider=%s url=%s",
                remote_id, via, st["video_url"][:80],
            )
            updated += 1
        elif st.get("failed"):
            await _set_status(r["id"], "failed", st.get("error") or f"{via} 任务失败")
            logger.info("[video] polling 任务 %s 失败 provider=%s", remote_id, via)
            updated += 1
    return updated


async def _set_status(task_id: int, status: str, result: str) -> None:
    conn = await get_db_conn()
    try:
        await conn.execute(_update_sql, status, result, task_id)
    finally:
        await conn.close()


async def video_worker_loop() -> None:
    """无限轮询:领取 accepted 任务出片 + 轮询已提交任务终态。

    缺少厂商凭据时静默轮询不报错。启动时把卡死的 processing(无 poll_via 标记,
    即阻塞编排被服务重启打断的任务)重置回 accepted 重新领取;带 poll_via 标记的
    行不重置(上游任务仍在计费运行,重复提交会二次扣费),由 _poll_pending
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
