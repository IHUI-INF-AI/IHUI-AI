"""自媒体定时任务调度器(轻量 asyncio 实现,无外部依赖)。

设计要点:
1. 每日定点触发口播稿 + 公众号文章生成(默认 8:00),失败仅记录日志,不阻塞服务。
2. 通过环境变量配置:
   - SELF_MEDIA_CRON_ENABLED=true / false(默认 false,需显式开启)
   - SELF_MEDIA_CRON_HOUR=8(0-23)
   - SELF_MEDIA_CRON_MINUTE=0(0-59)
3. 启动时延迟 60s(避免与 schema_check / DB 连接初始化争抢资源)。
4. 每 60s 轮询一次当前时间,匹配 hour:minute 后触发,同一日内不重复触发。
"""
import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# 默认时区:东八区(用户主要时区)
_CN_TZ = timezone(timedelta(hours=8))


class SelfMediaScheduler:
    """自媒体定时任务调度器(单例)。"""

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._last_run_date: str | None = None  # YYYY-MM-DD,防同日重复触发

    @property
    def enabled(self) -> bool:
        return os.environ.get("SELF_MEDIA_CRON_ENABLED", "false").lower() == "true"

    @property
    def cron_hour(self) -> int:
        try:
            return int(os.environ.get("SELF_MEDIA_CRON_HOUR", "8"))
        except ValueError:
            return 8

    @property
    def cron_minute(self) -> int:
        try:
            return int(os.environ.get("SELF_MEDIA_CRON_MINUTE", "0"))
        except ValueError:
            return 0

    def start(self) -> None:
        """启动调度任务(若已启动则跳过)。"""
        if not self.enabled:
            logger.info(
                "[self_media_scheduler] disabled (SELF_MEDIA_CRON_ENABLED != true)"
            )
            return
        if self._task is not None:
            return
        self._task = asyncio.create_task(self._loop())
        logger.info(
            "[self_media_scheduler] started, cron=%02d:%02d (CN time)",
            self.cron_hour,
            self.cron_minute,
        )

    async def stop(self) -> None:
        """停止调度任务。"""
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def _loop(self) -> None:
        """主循环:启动延迟 60s,然后每 60s 轮询一次。"""
        await asyncio.sleep(60)
        while True:
            try:
                now = datetime.now(_CN_TZ)
                if (now.hour, now.minute) == (self.cron_hour, self.cron_minute):
                    today = now.strftime("%Y-%m-%d")
                    if today != self._last_run_date:
                        self._last_run_date = today
                        await self._run_daily_jobs(now)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning(
                    "[self_media_scheduler] loop error: %s: %s", type(e).__name__, e
                )
            await asyncio.sleep(60)

    async def _run_daily_jobs(self, now: datetime) -> None:
        """触发当日所有定时任务(口播稿 + 公众号文章)。

        失败仅记录日志,不影响下次触发。
        """
        date_mmdd = now.strftime("%m%d")
        logger.info(
            "[self_media_scheduler] trigger daily jobs, date=%s", date_mmdd
        )

        # 1. 口播稿生成(LangGraph workflow,5-10 分钟)
        try:
            from app.services.koubo_workflow import koubo_workflow_service
            final_state = await koubo_workflow_service.run(
                date=date_mmdd,
                topic="",
                model=None,
                owner_uuid=None,
                dry_run=True,  # 定时任务默认 dry-run,真推草稿箱由人工审核后手动触发
            )
            status = final_state.get("status")
            err = final_state.get("error")
            logger.info(
                "[self_media_scheduler] koubo done, status=%s, err=%s, articles=%d",
                status,
                err,
                len(final_state.get("articles", [])),
            )
        except Exception as e:
            logger.warning(
                "[self_media_scheduler] koubo failed: %s: %s", type(e).__name__, e
            )

        # 2. 公众号文章生成(可选,需 SELF_MEDIA_CRON_WECHAT_TITLE 配置标题模板,
        #    否则跳过 - 公众号文章更需要人工选题,定时任务只跑口播稿)
        wechat_title_tpl = os.environ.get("SELF_MEDIA_CRON_WECHAT_TITLE", "")
        if wechat_title_tpl:
            try:
                from app.routers.self_media import _generate_md_with_llm, _safe_filename
                from pathlib import Path
                title = wechat_title_tpl.replace("{date}", date_mmdd)
                ok, md_content, err_msg = await _generate_md_with_llm(
                    title=title,
                    digest="",
                    topic="",
                    model=None,
                    owner_uuid=None,
                )
                if ok and md_content:
                    articles_dir = Path(__file__).resolve().parent.parent / "skills" / "content_engine" / "articles"
                    articles_dir.mkdir(parents=True, exist_ok=True)
                    md_path = articles_dir / f"{_safe_filename(title)}.md"
                    md_path.write_text(md_content, encoding="utf-8")
                    logger.info(
                        "[self_media_scheduler] wechat md generated, path=%s",
                        md_path,
                    )
                else:
                    logger.warning(
                        "[self_media_scheduler] wechat llm failed: %s", err_msg
                    )
            except Exception as e:
                logger.warning(
                    "[self_media_scheduler] wechat failed: %s: %s",
                    type(e).__name__,
                    e,
                )


self_media_scheduler = SelfMediaScheduler()
