"""统一扫描硬编码迁移名 (2026-06-26 新增).

历史教训: 迁移重编号时, 测试/CI 脚本中硬编码的迁移名会失效.
本脚本扫描所有 .py / .yml / .md / .ps1 文件中的 NNN_xxx 模式,
并对比实际 alembic/versions/ 目录, 报告:

1. 硬编码了已删除迁移名的引用 (需要修复)
2. 实际存在但未被引用的迁移 (可能是孤儿)
3. 引用了真实存在迁移的文件清单 (健康)

输出: JSON 报告 + 终端摘要
退出码: 发现 1+ 失效引用 → 1, 否则 0 (供 CI gate)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERSIONS = ROOT / "server" / "alembic" / "versions"

# 匹配 NNN_xxx.py 形式 (含 .py 后缀, 严格迁移名)
MIG_PATTERN = re.compile(r"\b(0\d{2}_[a-z0-9_]+)\.py\b")
# 匹配 "0XX_xxx" 或 '0XX_xxx' 字符串字面量形式 (必须带引号, 避免误识别测试函数名)
MIG_PATTERN_STR = re.compile(r'''["'](0\d{2}_[a-z0-9_]+)["']''')

# 排除目录 (文档/archive 目录允许引用历史迁移)
EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "logs",
    ".pytest_cache",
    "dist",
    "build",
}

# 排除文件后缀
INCLUDE_SUFFIX = {".py", ".yml", ".yaml", ".md", ".ps1", ".sh", ".json", ".txt", ".sql"}

# 排除文件
EXCLUDE_FILES = {
    "verify_002_admin_job.py",  # dev 脚本, 只检查 002
    "test_migrate_diff_mode.py",  # 测试 fixture 自建迁移
    "test_precommit_intercept.py",  # 同上
    "_scan_migration_refs.py",  # 本脚本自身
}
# 排除扫描器自身输出 (避免递归)
EXCLUDE_PATH_SUFFIX = {
    "_scan_migration_refs_report.json",
}


def list_real_migrations() -> set[str]:
    """返回实际存在的迁移 stem (NNN_xxx 形式, 不含 .py)."""
    if not VERSIONS.exists():
        return set()
    return {p.stem for p in VERSIONS.glob("0*.py") if p.stem.startswith("0")}


def scan_hardcoded_refs() -> dict:
    """扫描所有文件, 收集硬编码迁移引用.

    2026-06-26 P1: 增加有效性预过滤 - 只匹配 NNN 范围在 001-099 的字符串,
    避免误报如 "047_head_registered" (测试结果标签).
    """
    real_migs = list_real_migrations()
    real_nnn_prefixes: set[str] = set()
    for m in real_migs:
        # 取 NNN 前缀 (e.g. "047_notify_persist" -> "047")
        if len(m) >= 3 and m[:3].isdigit():
            real_nnn_prefixes.add(m[:3])

    refs: dict[str, list[dict]] = {}  # mig_stem -> [{file, line, snippet}]

    # 容错: 用 os.walk 避免 pathlib.rglob 遇损坏 symlink 时崩溃
    import os
    all_paths: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(ROOT, followlinks=False):
        # 排除目录 (in-place 修剪避免下钻)
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            all_paths.append(Path(dirpath) / fn)

    for path in all_paths:
        if not path.is_file():
            continue
        # 排除目录
        try:
            rel_parts = path.relative_to(ROOT).parts
        except ValueError:
            continue
        if any(p in EXCLUDE_DIRS for p in rel_parts):
            continue
        # 排除文件
        if path.name in EXCLUDE_FILES:
            continue
        # 排除扫描器自身输出 (避免递归)
        if any(path.name == sfx for sfx in EXCLUDE_PATH_SUFFIX):
            continue
        # 排除 alembic 目录本身 (定义迁移的地方不算硬编码)
        if "alembic" in rel_parts and "versions" in rel_parts:
            continue
        # 只看特定后缀
        if path.suffix.lower() not in INCLUDE_SUFFIX:
            continue
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        # 优先匹配 NNN_xxx.py 形式
        for match in MIG_PATTERN.finditer(content):
            mig = match.group(1)
            # 只接受 NNN 在 001-099 范围内, 且 NNN 已被实际迁移使用
            nnn = mig[:3]
            if nnn not in real_nnn_prefixes and real_nnn_prefixes:
                # NNN 不在任何真实迁移的前缀中, 可能是误报 (如 047_head_registered)
                continue
            line_no = content[: match.start()].count("\n") + 1
            snippet = match.group(0)
            refs.setdefault(mig, []).append(
                {"file": str(path.relative_to(ROOT)), "line": line_no, "snippet": snippet}
            )
        # 其次匹配 "NNN_xxx" 字符串形式 (如 "008_add_missing_tables" in output)
        for match in MIG_PATTERN_STR.finditer(content):
            mig = match.group(1)
            # 跳过 .py 后缀已匹配的
            if f"{mig}.py" in match.group(0):
                continue
            # 必须以数字 0 开头且长度 >= 4 (NNN_)
            if not (mig[0] == "0" and len(mig) >= 4 and "_" in mig):
                continue
            # 同样过滤 NNN 不在真实迁移前缀中的误报
            nnn = mig[:3]
            if nnn not in real_nnn_prefixes and real_nnn_prefixes:
                continue
            line_no = content[: match.start()].count("\n") + 1
            snippet = match.group(0)
            # 避免和 .py 形式重复
            if any(
                r["file"] == str(path.relative_to(ROOT))
                and r["line"] == line_no
                for r in refs.get(mig, [])
            ):
                continue
            refs.setdefault(mig, []).append(
                {"file": str(path.relative_to(ROOT)), "line": line_no, "snippet": snippet}
            )

    # 分类
    dead_refs: dict[str, list[dict]] = {}  # 引用了已删除迁移
    live_refs: dict[str, list[dict]] = {}  # 引用了真实迁移

    for mig, locations in refs.items():
        if mig in real_migs:
            live_refs[mig] = locations
        else:
            dead_refs[mig] = locations

    # 找出实际存在但未被引用的迁移 (孤儿)
    orphan_migs = real_migs - set(refs.keys())

    return {
        "real_migrations_count": len(real_migs),
        "real_migrations": sorted(real_migs),
        "dead_references": dead_refs,
        "live_references": live_refs,
        "orphan_migrations": sorted(orphan_migs),
    }


def render_summary(report: dict) -> str:
    """终端摘要."""
    lines: list[str] = []
    lines.append("=" * 70)
    lines.append("Alembic 硬编码迁移名扫描报告")
    lines.append("=" * 70)
    lines.append(f"实际迁移数: {report['real_migrations_count']}")
    lines.append(f"失效引用数: {len(report['dead_references'])}")
    lines.append(f"有效引用数: {len(report['live_references'])}")
    lines.append(f"孤儿迁移数: {len(report['orphan_migrations'])}")
    lines.append("")

    if report["dead_references"]:
        lines.append("❌ 失效引用 (引用了已删除迁移):")
        for mig, locations in sorted(report["dead_references"].items()):
            lines.append(f"  - {mig}.py ({len(locations)} 处)")
            for loc in locations[:3]:  # 最多显示 3 处
                lines.append(f"      {loc['file']}:{loc['line']}  {loc['snippet']}")
            if len(locations) > 3:
                lines.append(f"      ... +{len(locations) - 3} more")
        lines.append("")

    if report["orphan_migrations"]:
        lines.append("⚠️  孤儿迁移 (存在但未被任何文件引用):")
        for mig in report["orphan_migrations"]:
            lines.append(f"  - {mig}.py")
        lines.append("")

    if not report["dead_references"]:
        lines.append("✅ 所有硬编码引用都指向真实迁移!")

    lines.append("=" * 70)
    return "\n".join(lines)


def main():
    if not VERSIONS.exists():
        print(f"❌ Alembic versions 目录不存在: {VERSIONS}", file=sys.stderr)
        sys.exit(2)

    report = scan_hardcoded_refs()
    summary = render_summary(report)
    print(summary)

    # 输出 JSON 报告
    json_path = ROOT / "server" / "scripts" / "_scan_migration_refs_report.json"
    try:
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"\n📄 详细报告: {json_path}")
    except Exception as e:
        print(f"\n⚠️  写报告失败: {e}")

    # 退出码: 有失效引用 → 1
    if report["dead_references"]:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
