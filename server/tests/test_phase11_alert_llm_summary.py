"""Phase 11 建议 4: LLM 告警摘要 (mock + 真 API) 验证."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))


@pytest.fixture()
def al():
    """import alert_llm_summary 模块."""
    if "alert_llm_summary" in sys.modules:
        del sys.modules["alert_llm_summary"]
    import alert_llm_summary

    return alert_llm_summary


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    """每个测试前清掉 LLM 环境变量, 默认走 mock."""
    monkeypatch.delenv("ZHS_LLM_API_KEY", raising=False)
    monkeypatch.delenv("ZHS_LLM_API_BASE", raising=False)
    monkeypatch.delenv("ZHS_LLM_MOCK", raising=False)


def test_summarize_alert_uses_mock_when_no_key(al):
    """无 API key 时自动用 mock."""
    summary = al.summarize_alert(
        {
            "alertname": "HighErrorRate",
            "severity": "critical",
            "service": "zhs-platform-api",
            "labels": {"region": "cn-east-1"},
        }
    )
    assert "zhs-platform-api" in summary
    assert "cn-east-1" in summary
    assert "critical" in summary


def test_summarize_alert_force_mock(al):
    """force_mock=True 必走 mock 模板."""
    summary = al.summarize_alert(
        {
            "alertname": "DiskSpaceLow",
            "service": "db",
            "severity": "warning",
            "labels": {"region": "cn-north-1"},
        },
        force_mock=True,
    )
    assert "db" in summary
    assert "cn-north-1" in summary


def test_summarize_unknown_alertname(al):
    """未知 alertname 走 Default 模板."""
    summary = al.summarize_alert(
        {
            "alertname": "WeirdUnknownAlert",
            "service": "x",
            "severity": "warning",
            "labels": {"region": "r"},
        }
    )
    assert "WeirdUnknownAlert" in summary
    assert "warning" in summary


def test_summarize_all_templates(al):
    """所有预定义模板都能正确填充."""
    for name, template in al.MOCK_TEMPLATES.items():
        if name == "Default":
            continue
        alert = {
            "alertname": name,
            "service": "test-svc",
            "severity": "critical",
            "labels": {"region": "test-region"},
        }
        summary = al.summarize_alert(alert, force_mock=True)
        # 模板应被正确填充, 不应含未替换的占位符
        assert "{service}" not in summary
        assert "{region}" not in summary
        assert "test-svc" in summary
        assert "test-region" in summary


def test_build_user_prompt_contains_alertname(al):
    """user prompt 必含 alertname."""
    prompt = al.build_user_prompt({"alertname": "X", "severity": "y", "service": "z"})
    assert "alertname: X" in prompt
    assert "severity: y" in prompt
    assert "service: z" in prompt


def test_build_user_prompt_with_labels(al):
    """user prompt 必含 region/tenant labels."""
    prompt = al.build_user_prompt(
        {
            "alertname": "X",
            "labels": {"region": "cn-east-1", "tenant": "tenant_alpha"},
        }
    )
    assert "region: cn-east-1" in prompt
    assert "tenant: tenant_alpha" in prompt


def test_summarize_batch_preserves_order(al):
    """批量摘要必按输入顺序返回."""
    alerts = [
        {"alertname": "A", "service": "s1", "severity": "info", "labels": {"region": "r1"}},
        {"alertname": "B", "service": "s2", "severity": "warning", "labels": {"region": "r2"}},
        {"alertname": "C", "service": "s3", "severity": "critical", "labels": {"region": "r3"}},
    ]
    summaries = al.summarize_batch(alerts)
    assert len(summaries) == 3
    for i, s in enumerate(summaries):
        assert alerts[i]["service"] in s


def test_summarize_alert_with_real_api_call(al, monkeypatch):
    """用真 API key 时调 _call_openai_compatible, 验证 stub 替代."""
    monkeypatch.setenv("ZHS_LLM_API_KEY", "fake-key")
    monkeypatch.setenv("ZHS_LLM_API_BASE", "https://api.example.com/v1")

    def fake_call(base, key, model, system, user, timeout=10):
        assert base == "https://api.example.com/v1"
        assert key == "fake-key"
        assert "系统提示" in system or "告警" in system
        return f"测试摘要: {user.split(chr(10))[0]}"

    with patch.object(al, "_call_openai_compatible", side_effect=fake_call) as mock_call:
        summary = al.summarize_alert(
            {
                "alertname": "TestAlert",
                "service": "test-svc",
                "severity": "critical",
            }
        )
        assert mock_call.called
        assert "测试摘要" in summary
        assert "alertname: TestAlert" in summary


def test_summarize_alert_handles_api_error(al, monkeypatch):
    """API 抛错时必向上传播 (调用方决定 fallback)."""
    monkeypatch.setenv("ZHS_LLM_API_KEY", "fake-key")

    def fake_call(*args, **kwargs):
        raise RuntimeError("网络超时")

    with patch.object(al, "_call_openai_compatible", side_effect=fake_call):
        with pytest.raises(RuntimeError, match="网络超时"):
            al.summarize_alert({"alertname": "X"})


def test_zhs_llm_mock_env_disables_real_call(al, monkeypatch):
    """ZHS_LLM_MOCK=1 必走 mock, 即使有 API key."""
    monkeypatch.setenv("ZHS_LLM_API_KEY", "fake-key")
    monkeypatch.setenv("ZHS_LLM_MOCK", "1")

    summary = al.summarize_alert(
        {
            "alertname": "HighErrorRate",
            "service": "x",
            "severity": "y",
            "labels": {"region": "z"},
        }
    )
    # mock 模板, 不调 API
    assert "x" in summary
    assert "z" in summary


def test_summary_under_100_chars(al):
    """mock 摘要必 ≤ 100 字符 (模板约束, 留余量给真实 LLM 输出)."""
    alert = {
        "alertname": "HighErrorRate",
        "service": "zhs-platform-api",
        "severity": "critical",
        "labels": {"region": "cn-east-1"},
    }
    summary = al.summarize_alert(alert, force_mock=True)
    assert len(summary) <= 100, f"摘要太长: {summary} ({len(summary)})"


def test_cli_stdin_pipe(monkeypatch):
    """CLI 从 stdin 读 JSON, 输出每行一个 alertname+summary."""
    script = ROOT / "scripts" / "ops" / "alert_llm_summary.py"
    inp = json.dumps(
        [
            {
                "alertname": "HighErrorRate",
                "service": "zhs-platform-api",
                "severity": "critical",
                "labels": {"region": "cn-east-1"},
            }
        ]
    )
    env = {
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1",
        "PATH": os.environ.get("PATH", ""),
    }
    result = subprocess.run(
        [sys.executable, str(script)],
        input=inp,
        capture_output=True,
        text=True,
        env=env,
        cwd=str(ROOT),
    )
    assert result.returncode == 0, f"stderr={result.stderr}"
    out = result.stdout.strip()
    assert "HighErrorRate" in out
    assert "summary" in out
    data = json.loads(out)
    assert data["alertname"] == "HighErrorRate"
    assert "zhs-platform-api" in data["summary"]


def test_cli_no_stdin_uses_demo(al, monkeypatch, capsys):
    """CLI 无 stdin 时用 demo."""
    script = ROOT / "scripts" / "ops" / "alert_llm_summary.py"
    env = {
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1",
        "PATH": os.environ.get("PATH", ""),
    }
    result = subprocess.run(
        [sys.executable, str(script)],
        input="",
        capture_output=True,
        text=True,
        env=env,
        cwd=str(ROOT),
    )
    # 无 stdin = isatty=True, 走 demo
    assert result.returncode == 0
    out = result.stdout.strip()
    assert "HighErrorRate" in out


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
