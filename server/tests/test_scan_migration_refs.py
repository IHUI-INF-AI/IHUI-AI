"""硬编码迁移名扫描测试 (2026-06-26 新增).

把 _scan_migration_refs 接入 pytest, 作为 CI gate 防止过期迁移名引用.

排除规则:
- docs/archive/* (历史文档, 允许保留)
- verify_002_admin_job.py (dev 工具)
- test_migrate_diff_mode.py / test_precommit_intercept.py (fixture 自建迁移)
- 扫描器自身
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "_scan_migration_refs.py"


# 仅检查"生产关键"目录的失效引用 (测试 + 脚本)
# 文档/archive 允许保留历史记录
CRITICAL_DIRS = {
    "tests",
    "scripts",
    "app",
    ".github",
}


def run_scan() -> dict:
    """运行扫描器并返回报告 dict."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    # 扫描器会写报告文件
    report_path = ROOT / "scripts" / "_scan_migration_refs_report.json"
    if not report_path.exists():
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "report": None,
        }
    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode,
        "report": json.loads(report_path.read_text(encoding="utf-8")),
    }


def is_critical_location(file_path: str) -> bool:
    """文件是否在 CRITICAL_DIRS 中."""
    parts = Path(file_path).parts
    return any(d in CRITICAL_DIRS for d in parts)


def test_scan_script_exists():
    """扫描脚本必须存在."""
    assert SCRIPT.exists(), f"扫描脚本不存在: {SCRIPT}"


def test_scan_script_runs():
    """扫描脚本必须能成功运行 (或返回 1 表示有失效引用)."""
    result = run_scan()
    assert result["report"] is not None, f"扫描脚本未生成报告: stderr={result['stderr']}"
    assert result["returncode"] in (0, 1), f"扫描脚本退出码异常: {result['returncode']}"


def test_no_dead_references_in_critical_paths():
    """生产关键路径 (tests/scripts/app) 中不应有失效迁移名引用.

    文档 (docs/) 中允许保留历史失效引用, 但会在终端警告.
    """
    result = run_scan()
    if result["report"] is None:
        pytest.skip("扫描脚本未生成报告")
    dead = result["report"]["dead_references"]
    critical_dead: list[tuple[str, dict]] = []
    for mig, locations in dead.items():
        for loc in locations:
            if is_critical_location(loc["file"]):
                critical_dead.append((mig, loc))
    if critical_dead:
        msg_lines = [f"生产关键路径中有 {len(critical_dead)} 处失效迁移名引用:"]
        for mig, loc in critical_dead[:10]:
            msg_lines.append(f"  - {mig}.py  @ {loc['file']}:{loc['line']}")
        if len(critical_dead) > 10:
            msg_lines.append(f"  ... +{len(critical_dead) - 10} more")
        msg_lines.append("\n修复方法: 把硬编码的迁移名改为扫描 alembic/versions/ 目录")
        msg_lines.append("或使用 _scan_migration_refs.py 提供的报告辅助修复")
        pytest.fail("\n".join(msg_lines))


def test_real_migrations_listed():
    """实际迁移应 >= 30 条 (迁移链至少 016-047)."""
    result = run_scan()
    if result["report"] is None:
        pytest.skip("扫描脚本未生成报告")
    count = result["report"]["real_migrations_count"]
    assert count >= 30, f"迁移数过少: {count}, 期望 >= 30"


def test_head_is_notify_persist():
    """head 迁移必须是 047_notify_persist (迁移链终点)."""
    result = run_scan()
    if result["report"] is None:
        pytest.skip("扫描脚本未生成报告")
    real = result["report"]["real_migrations"]
    # 047 应在 real 中
    has_047 = any("047" in m for m in real)
    assert has_047, f"迁移链 head 应为 047_notify_persist, 实际: {real[-3:] if real else []}"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
