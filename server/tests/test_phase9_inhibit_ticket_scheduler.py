"""Phase 9 建议 2: 告警噪音分析 + 抑制工单 APScheduler 注册验证.

目标:
  1. 验证 scheduler 注册了 alert_noise_inhibit_ticket_daily job
  2. 验证 cron hour=4, minute=0 配置
  3. 验证 task_alert_noise_inhibit_ticket 异步函数可被调用 (mock 模式)
  4. 验证 generate_inhibit_ticket 脚本与 scheduler 调用路径一致
"""

from __future__ import annotations

import sys
from datetime import UTC
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def test_scheduler_registers_alert_noise_job():
    """scheduler 启动后, jobs 列表必须有 alert_noise_inhibit_ticket_daily."""
    from app.tasks.scheduler import scheduler, start_scheduler, stop_scheduler

    start_scheduler()
    try:
        job_ids = {j.id for j in scheduler.get_jobs()}
        assert (
            "alert_noise_inhibit_ticket_daily" in job_ids
        ), f"scheduler 缺 alert_noise_inhibit_ticket_daily, 现有 jobs: {job_ids}"
        job = scheduler.get_job("alert_noise_inhibit_ticket_daily")
        assert job.trigger is not None
        # cron trigger 必有 hour=4, minute=0 字段
        trigger_fields = {f.name for f in job.trigger.fields}
        assert "hour" in trigger_fields and "minute" in trigger_fields
        hour = next(f for f in job.trigger.fields if f.name == "hour")
        minute = next(f for f in job.trigger.fields if f.name == "minute")
        assert str(hour) == "4", f"hour 应为 4, 实际 {hour}"
        assert str(minute) == "0", f"minute 应为 0, 实际 {minute}"
    finally:
        stop_scheduler()


@pytest.mark.asyncio
async def test_task_alert_noise_runs_in_mock_mode(tmp_path, monkeypatch):
    """直接调 task_alert_noise_inhibit_ticket, mock 模式应成功生成工单."""
    from app.tasks.scheduler import task_alert_noise_inhibit_ticket

    # 重定向输出到 tmp_path, 不污染 logs/
    monkeypatch.setenv("ALERTMANAGER_URL", "")
    # 直接重定向 logs/ 目录: 通过命令行 args 注入 --out-dir
    # 简单做法: 临时备份 logs/inhibit_tickets/ 后清理
    target = ROOT / "logs" / "inhibit_tickets"
    backup = None
    if target.exists():
        backup = target.with_suffix(".bak")
        if backup.exists():
            import shutil

            shutil.rmtree(backup)
        target.rename(backup)
    try:
        await task_alert_noise_inhibit_ticket()
        # 跑完后应生成当天文件
        from datetime import datetime

        date_str = datetime.now(UTC).strftime("%Y%m%d")
        md_path = target / f"{date_str}.md"
        json_path = target / f"{date_str}.json"
        assert md_path.exists(), f"未生成 markdown: {md_path}"
        assert json_path.exists(), f"未生成 json: {json_path}"
        # 内容校验
        json_data = json_path.read_text(encoding="utf-8")
        assert '"ticket_count"' in json_data
    finally:
        # 清理测试产物
        if target.exists():
            import shutil

            shutil.rmtree(target)
        if backup is not None and backup.exists():
            backup.rename(target)


def test_generate_inhibit_ticket_mock_produces_tickets():
    """直接调 generate_inhibit_ticket 脚本 mock 模式, 至少 1 条工单."""
    from scripts.ops.generate_inhibit_ticket import build_ticket, get_mock_data

    data = get_mock_data()
    payload = build_ticket(data["alerts"], threshold=0.5, min_firing=5)
    assert payload["ticket_count"] >= 1, f"应有工单, 实际 {payload['ticket_count']}"
    # 按 flapping_score 降序
    scores = [t["flapping_score"] for t in payload["tickets"]]
    assert scores == sorted(scores, reverse=True), "工单应按 flapping_score 降序"
    # 极端 flapping (>=0.85) 抑制 24h
    high = [t for t in payload["tickets"] if t["flapping_score"] >= 0.85]
    for t in high:
        assert t["inhibit_hours"] == 24, f"{t['alertname']} 抑制应为 24h"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
