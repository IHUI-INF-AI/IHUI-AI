"""演练脚本本身的端到端测试 (mock 模式).

不依赖真实 webhook 配置, 用 respx/httpx mock 模拟 HTTP 端点.
"""
from __future__ import annotations

import asyncio
import json
import subprocess
import sys
from pathlib import Path

import pytest

SERVER_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_ROOT / "scripts" / "alert_drill_8channels.py"


def test_drill_script_dry_run_returns_2_when_no_config():
    """未配置任何通道时, dry-run 返回 2 (演练无效)."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--dry-run", "--channel", "dingtalk"],
        capture_output=True, text=True, cwd=str(SERVER_ROOT), timeout=20,
    )
    assert "SKIP" in result.stdout or "未配置" in result.stdout
    assert result.returncode == 2


def test_drill_script_help():
    """--help 可用."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--help"],
        capture_output=True, text=True, cwd=str(SERVER_ROOT), timeout=10,
    )
    assert "8 通道告警" in result.stdout
    assert "--dry-run" in result.stdout
    assert "--channel" in result.stdout
    assert "--output" in result.stdout


def test_drill_script_lists_8_channels_in_dry_run():
    """dry-run 模式应列出全部 8 通道."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--dry-run"],
        capture_output=True, text=True, cwd=str(SERVER_ROOT), timeout=20,
    )
    output = result.stdout
    for label in ["钉钉", "企业微信", "飞书", "邮件", "PagerDuty", "Slack", "Teams", "Generic"]:
        assert label in output, f"缺通道: {label}"


def test_drill_script_output_json(tmp_path):
    """--output 写入 JSON 报告."""
    out = tmp_path / "drill.json"
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--dry-run", "--output", str(out)],
        capture_output=True, text=True, cwd=str(SERVER_ROOT), timeout=20,
    )
    assert out.exists(), f"JSON 报告未生成: {out}"
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["tool"] == "alert_drill_8channels"
    assert data["mode"] == "dry-run"
    assert "summary" in data
    assert data["summary"]["total"] == 8


@pytest.mark.asyncio
async def test_drill_one_channel_not_configured_returns_skipped(monkeypatch):
    """未配置通道的演练结果含 skipped=True."""
    # 确保没有 DINGTALK_WEBHOOK
    monkeypatch.setattr("app.config.settings.DINGTALK_WEBHOOK", "")
    monkeypatch.setattr("app.config.settings.DINGTALK_SECRET", "")

    from scripts.alert_drill_8channels import _drill_one
    result = await _drill_one("dingtalk", dry_run=False)
    assert result["configured"] is False
    assert result["skipped"] is True
    assert "未配置" in result.get("skip_reason", "")
