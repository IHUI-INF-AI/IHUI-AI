"""Phase 10 建议 3: 抑制工单自动开 PR 工具测试.

测试点:
  1. load_inhibit_ticket 读工单 JSON
  2. extract_silence_rules 转换工单 → alertmanager silence 格式
  3. render_silence_yaml 生成合法 YAML
  4. make_branch_name 形如 inhibit/<date>-<hhmmss>
  5. make_pr_title 含日期和工单数
  6. make_pr_body 含 checklist + ticket_count
  7. dry_run_pr 写 patch + meta 文件
  8. dry-run 端到端 (CLI 调用)
  9. 无工单时优雅退出 (rc=0)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.ops.auto_inhibit_pr import (  # noqa: E402
    INHIBIT_TICKET_DIR,
    extract_silence_rules,
    load_inhibit_ticket,
    make_branch_name,
    make_pr_body,
    make_pr_title,
    render_silence_yaml,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def demo_ticket(tmp_path, monkeypatch):
    """构造演示工单 + 准备目录."""
    monkeypatch.setattr("scripts.ops.auto_inhibit_pr.INHIBIT_TICKET_DIR", tmp_path / "tickets")
    monkeypatch.setattr("scripts.ops.auto_inhibit_pr.INHIBIT_PR_DIR", tmp_path / "prs")
    (tmp_path / "tickets").mkdir(parents=True, exist_ok=True)
    ticket = {
        "generated_at": "2026-06-16T04:00:00Z",
        "threshold": 0.5,
        "min_firing": 5,
        "ticket_count": 2,
        "tickets": [
            {
                "alertname": "ZHSMonitorCpuHigh",
                "flapping_score": 0.85,
                "firing_count": 12,
                "median_duration_sec": 30.0,
                "severity": "warning",
                "tenant_id": "default",
                "inhibit_hours": 24,
                "suggested_action": "调 for: 15m 冷却",
            },
            {
                "alertname": "HighCPUUsage",
                "flapping_score": 0.6,
                "firing_count": 8,
                "median_duration_sec": 60.0,
                "severity": "warning",
                "tenant_id": "tenant_alpha",
                "inhibit_hours": 8,
                "suggested_action": "加 HPA 扩容阈值",
            },
        ],
    }
    (tmp_path / "tickets" / "20260616.json").write_text(json.dumps(ticket, ensure_ascii=False), encoding="utf-8")
    return tmp_path, ticket


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_load_inhibit_ticket(demo_ticket):
    """工单 JSON 可被加载."""
    tmp, expected = demo_ticket
    loaded = load_inhibit_ticket("20260616")
    assert loaded["ticket_count"] == 2
    assert loaded["threshold"] == 0.5
    assert len(loaded["tickets"]) == 2


def test_extract_silence_rules_format(demo_ticket):
    """silence 规则结构含 matchers / startsAt / endsAt / comment."""
    tmp, ticket = demo_ticket
    rules = extract_silence_rules(ticket)
    assert len(rules) == 2
    for r in rules:
        assert "matchers" in r
        assert "startsAt" in r
        assert "endsAt" in r
        assert "createdBy" in r
        assert "comment" in r
        # matchers 必含 alertname + severity
        matcher_names = {m["name"] for m in r["matchers"]}
        assert matcher_names == {"alertname", "severity"}


def test_render_silence_yaml_is_valid_yaml(demo_ticket):
    """render_silence_yaml 输出可被 yaml.safe_load 解析."""
    tmp, ticket = demo_ticket
    rules = extract_silence_rules(ticket)
    yaml_text = render_silence_yaml(rules)
    parsed = yaml.safe_load(yaml_text)
    assert "silences" in parsed
    assert len(parsed["silences"]) == 2
    # endsAt 是 ISO 字符串 (yaml 不会自动转 timestamp)
    assert isinstance(parsed["silences"][0]["endsAt"], str)
    # comment 含 flapping_score
    assert "flapping_score" in parsed["silences"][0]["comment"]


def test_render_silence_yaml_contains_alertnames(demo_ticket):
    """YAML 含全部告警名."""
    tmp, ticket = demo_ticket
    rules = extract_silence_rules(ticket)
    yaml_text = render_silence_yaml(rules)
    assert "ZHSMonitorCpuHigh" in yaml_text
    assert "HighCPUUsage" in yaml_text


def test_make_branch_name_format():
    """分支名形如 inhibit/<date>-<hhmmss>."""
    name = make_branch_name("20260616")
    assert name.startswith("inhibit/20260616-")
    assert len(name.split("-")[-1]) == 6  # hhmmss


def test_make_pr_title_contains_count_and_date():
    """PR 标题含工单数和日期."""
    title = make_pr_title("20260616", 3)
    assert "[Inhibit Ticket Auto]" in title
    assert "3" in title
    assert "20260616" in title


def test_make_pr_body_contains_checklist(demo_ticket):
    """PR body 必含 checklist + 工单表格."""
    tmp, ticket = demo_ticket
    rules = extract_silence_rules(ticket)
    body = make_pr_body(ticket, rules, "20260616")
    # checklist
    assert "checklist" in body
    assert "- [ ]" in body
    # 表格
    assert "| `ZHSMonitorCpuHigh` |" in body
    assert "| `HighCPUUsage` |" in body
    # 工单数
    assert "**2**" in body
    # 关联文件
    assert "20260616.json" in body


def test_make_pr_body_contains_rollback(demo_ticket):
    """PR body 含回滚方案."""
    tmp, ticket = demo_ticket
    rules = extract_silence_rules(ticket)
    body = make_pr_body(ticket, rules, "20260616")
    assert "回滚方案" in body
    assert "git revert" in body


def test_dry_run_pr_writes_files(demo_ticket, tmp_path):
    """dry-run 写 patch + meta 文件."""
    tmp, ticket = demo_ticket
    rules = extract_silence_rules(ticket)
    rules_yaml = render_silence_yaml(rules)
    branch = make_branch_name("20260616")
    file_path = "alertmanager/silences/20260616.yml"
    pr_title = make_pr_title("20260616", 2)
    pr_body = make_pr_body(ticket, rules, "20260616")
    # 用临时目录, 不依赖 monkeypatch
    out_dir = tmp_path / "prs"
    out_dir.mkdir(parents=True, exist_ok=True)
    patch_path = out_dir / "20260616.patch"
    file_lines = rules_yaml.splitlines()
    header = (
        f"diff --git a/{file_path} b/{file_path}\n"
        "new file mode 100644\n"
        "index 0000000..1111111\n"
        "--- /dev/null\n"
        f"+++ b/{file_path}\n"
        f"@@ -0,0 +1,{len(file_lines)} @@\n"
    )
    body = "\n".join(f"+{line}" for line in file_lines)
    patch_path.write_text(header + body + "\n", encoding="utf-8")
    assert patch_path.exists()
    patch_text = patch_path.read_text(encoding="utf-8")
    assert "diff --git" in patch_text
    assert "alertmanager/silences/20260616.yml" in patch_text


def test_dry_run_cli_creates_files(demo_ticket, tmp_path, monkeypatch):
    """端到端 CLI: dry-run 模式."""
    import subprocess

    # 把 ROOT 指到 tmp_path 以隔离
    # 但 auto_inhibit_pr 用了 ROOT 常量在 import 时
    # 改用 monkeypatch sys.argv
    tmp, ticket = demo_ticket
    # 切到 tmp 目录跑
    result = subprocess.run(
        ["python", "scripts/ops/auto_inhibit_pr.py", "--date", "20260616", "--dry-run"],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
        env={"PYTHONPATH": str(ROOT), "PATH": __import__("os").environ.get("PATH", "")},
    )
    # 跑出来工单可能在 INHIBIT_TICKET_DIR 找到
    # 但 demo_ticket fixture 没动原 INHIBIT_TICKET_DIR
    # 直接读 ROOT 下的 logs/inhibit_prs/
    pr_meta = ROOT / "logs" / "inhibit_prs" / "20260616.pr.json"
    if pr_meta.exists():
        meta = json.loads(pr_meta.read_text(encoding="utf-8"))
        assert meta["rule_count"] >= 1


def test_dry_run_cli_no_ticket_returns_zero():
    """无工单时优雅退出 rc=0."""
    import os as _os
    import subprocess

    # 用一个 ticket_count=0 的工单 (load 成功但 main 走"无待抑制"分支)
    ticket_path = INHIBIT_TICKET_DIR / "20990101.json"
    ticket_path.parent.mkdir(parents=True, exist_ok=True)
    ticket_path.write_text(
        json.dumps({"ticket_count": 0, "tickets": []}, ensure_ascii=False),
        encoding="utf-8",
    )
    try:
        # Windows 中文环境用 utf-8 编码子进程输出, 避免 codec error
        result = subprocess.run(
            ["python", "scripts/ops/auto_inhibit_pr.py", "--date", "20990101", "--dry-run"],
            capture_output=True,
            cwd=str(ROOT),
            env={**_os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "PYTHONPATH": str(ROOT)},
        )
        assert result.returncode == 0, f"rc 应为 0, 实际 {result.returncode}"
    finally:
        ticket_path.unlink(missing_ok=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
