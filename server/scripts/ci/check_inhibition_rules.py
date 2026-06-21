"""alertmanager 抑制规则 CI 校验 (建议 143).

对比 docker/alertmanager/alertmanager.yml 与 deploy/helm/.../alertmanager.yml,
确保两个文件的 inhibit_rules 与 app/alert_inhibition.py 的 ZHS_INHIBITION_PRESETS
完全同步, 避免"代码改了, YAML 没改"或"两边各加一条"导致抑制不一致.

校验项:
  1. 两个 alertmanager.yml 文件的 inhibit_rules 数量 + 内容一致
  2. 与 ZHS_INHIBITION_PRESETS 完全一致 (6 条)
  3. 用预设 fixture 告警跑 AlertInhibitor.apply, 验证期望的抑制都发生
  4. 解析失败 / 缺规则 / 内容不一致 / 抑制未生效 都返回非 0 退出码

用法:
    python scripts/ci/check_inhibition_rules.py              # 全量校验
    python scripts/ci/check_inhibition_rules.py --fix         # 自动同步 (Python -> YAML)
    python scripts/ci/check_inhibition_rules.py --fixtures    # 只跑 fixture 测试
    python scripts/ci/check_inhibition_rules.py --yaml-only   # 只校验 YAML 一致性
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.alert_inhibition import (
    ZHS_INHIBITION_PRESETS,
    AlertInhibitor,
    InhibitionRule,
)

# ---------------------------------------------------------------------------
# 路径
# ---------------------------------------------------------------------------

DEFAULT_YAML_PATHS = [
    ROOT / "docker" / "alertmanager" / "alertmanager.yml",
    ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml",
]


# ---------------------------------------------------------------------------
# YAML 解析 (简单版, 不引入 yaml 依赖)
# ---------------------------------------------------------------------------


def _parse_inhibit_rules(yaml_path: Path) -> list[dict]:
    """从 alertmanager.yml 解析 inhibit_rules 段.

    返回: list[dict], 每条含 source_match, target_match, equal.
    不依赖 PyYAML, 避免增加依赖. 用正则匹配 - source_match: ... target_match: ... equal: [...]
    """
    if not yaml_path.exists():
        return []
    text = yaml_path.read_text(encoding="utf-8")
    # 截取 inhibit_rules 段
    m = re.search(r"^inhibit_rules:\s*(?:\n|$)([\s\S]*?)(?=^receive[rs]:|\Z)", text, re.MULTILINE)
    if not m:
        return []
    section = m.group(1)
    # 按 "- " 切分 (每条规则开头)
    rules: list[dict] = []
    blocks = re.split(r"^\s*-\s", section, flags=re.MULTILINE)
    for block in blocks[1:]:  # 跳过第一个空块
        # 截到下一条规则前 (下一个 "- " 或 section 末尾)
        end = re.search(r"^\s*-\s", block, re.MULTILINE)
        if end:
            block = block[: end.start()]
        rule: dict = {"source_match": {}, "target_match": {}, "equal": []}
        # source_match 块: 找 source_match: 行, 之后到 target_match: 之间的缩进 key: 'val'
        src_start = re.search(r"source_match:\s*\n", block)
        if src_start:
            after = block[src_start.end() :]
            # 截到 target_match: 之前
            tgt_in_block = re.search(r"^\s{4}target_match:", after, re.MULTILINE)
            if tgt_in_block:
                after = after[: tgt_in_block.start()]
            for k, v in re.findall(r"^\s{6,}(\w+):\s*'([^']*)'", after, re.MULTILINE):
                rule["source_match"][k] = v
        # target_match 块
        tgt_start = re.search(r"target_match:\s*\n", block)
        if tgt_start:
            after = block[tgt_start.end() :]
            # 截到 equal: 之前
            eq_in_block = re.search(r"^\s{4}equal:", after, re.MULTILINE)
            if eq_in_block:
                after = after[: eq_in_block.start()]
            for k, v in re.findall(r"^\s{6,}(\w+):\s*'([^']*)'", after, re.MULTILINE):
                rule["target_match"][k] = v
        # equal 块
        eq_m = re.search(r"equal:\s*\[([^\]]*)\]", block)
        if eq_m:
            rule["equal"] = [s.strip().strip("'") for s in eq_m.group(1).split(",") if s.strip()]
        rules.append(rule)
    return rules


# ---------------------------------------------------------------------------
# 与 Python 预设对比
# ---------------------------------------------------------------------------


def _rule_to_dict(rule: InhibitionRule) -> dict:
    """把 InhibitionRule 转为可比较的 dict."""
    eq = rule.equal if rule.equal is not None else ["alertname"]  # 默认 alertname
    return {
        "source_match": dict(rule.source_matchers),
        "target_match": dict(rule.target_matchers),
        "equal": list(eq),
    }


def compare_yaml_to_presets(yaml_path: Path) -> dict:
    """对比 yaml 与 ZHS 预设.

    Returns:
        {
            "yaml_rules": [...],
            "preset_rules": [...],
            "missing_in_yaml": [...],   # 预设里有, yaml 里没有
            "extra_in_yaml": [...],     # yaml 里有, 预设里没有
            "in_sync": bool,
        }
    """
    yaml_rules = _parse_inhibit_rules(yaml_path)
    preset_dicts = [_rule_to_dict(r) for r in ZHS_INHIBITION_PRESETS]
    yaml_set = {_canonical(_r) for _r in yaml_rules}
    preset_set = {_canonical(_r) for _r in preset_dicts}
    missing = list(preset_set - yaml_set)
    extra = list(yaml_set - preset_set)
    return {
        "yaml_rules": yaml_rules,
        "preset_rules": preset_dicts,
        "missing_in_yaml": missing,
        "extra_in_yaml": extra,
        "in_sync": len(missing) == 0 and len(extra) == 0,
    }


def _canonical(rule_dict: dict) -> tuple:
    """生成规则的规范化 (tuple) 用于 set 比较."""
    return (
        tuple(sorted(rule_dict.get("source_match", {}).items())),
        tuple(sorted(rule_dict.get("target_match", {}).items())),
        tuple(sorted(rule_dict.get("equal", []))),
    )


# ---------------------------------------------------------------------------
# Fixture 告警 (验证预设真的能工作)
# ---------------------------------------------------------------------------

# 每个 (alertname, severity, service, role) → 期望状态: "survive" 或 "suppressed"
# 用 (alertname, severity) 复合键确保同 alertname 多份 (如 critical+warning 配对) 可区分
FIXTURE_SCENARIOS = [
    # 场景 1: canary 紧急回滚 + canary 阶段卡住 → 阶段卡住被抑制
    {
        "name": "rollback_inhibits_stage_stuck",
        "alerts": [
            {
                "status": "firing",
                "labels": {"alertname": "ZHSRollbackActive", "severity": "critical", "service": "canary"},
            },
            {
                "status": "firing",
                "labels": {"alertname": "ZHSCanaryStageStuck", "severity": "warning", "service": "canary"},
            },
        ],
        "expected": {
            ("ZHSRollbackActive", "critical"): "survive",
            ("ZHSCanaryStageStuck", "warning"): "suppressed",
        },
    },
    # 场景 2: DB 宕机 → 所有 DB warning 被抑制
    {
        "name": "db_down_inhibits_db_warnings",
        "alerts": [
            {"status": "firing", "labels": {"alertname": "ZHSDatabaseDown", "severity": "critical", "service": "db"}},
            {"status": "firing", "labels": {"alertname": "DB_SlowQuery", "severity": "warning", "service": "db"}},
        ],
        "expected": {
            ("ZHSDatabaseDown", "critical"): "survive",
            ("DB_SlowQuery", "warning"): "suppressed",
        },
    },
    # 场景 3: 服务宕机 → 同 service warning 被抑制
    {
        "name": "service_down_inhibits_warning",
        "alerts": [
            {"status": "firing", "labels": {"alertname": "ZHSServiceDown", "severity": "critical", "service": "api"}},
            {"status": "firing", "labels": {"alertname": "HighLatency", "severity": "warning", "service": "api"}},
        ],
        "expected": {
            ("ZHSServiceDown", "critical"): "survive",
            ("HighLatency", "warning"): "suppressed",
        },
    },
    # 场景 4: 经典 critical → warning (同 alertname, 不同 severity)
    {
        "name": "classic_critical_inhibits_warning",
        "alerts": [
            {"status": "firing", "labels": {"alertname": "X", "severity": "critical", "service": "svc"}},
            {"status": "firing", "labels": {"alertname": "X", "severity": "warning", "service": "svc"}},
        ],
        "expected": {
            ("X", "critical"): "survive",  # 第 1 个
            ("X", "warning"): "suppressed",  # 第 2 个
        },
    },
    # 场景 5: CI drill 失败 → 抑制其他 CI drill warning
    {
        "name": "ci_drill_failure_inhibits",
        "alerts": [
            {
                "status": "firing",
                "labels": {"alertname": "ZHS_CI_DRILL_FAILURE", "severity": "critical", "service": "ci"},
            },
            {
                "status": "firing",
                "labels": {"alertname": "ZHS_CI_DRILL_SLOW_SQL", "severity": "warning", "service": "ci"},
            },
        ],
        "expected": {
            ("ZHS_CI_DRILL_FAILURE", "critical"): "survive",
            ("ZHS_CI_DRILL_SLOW_SQL", "warning"): "suppressed",
        },
    },
    # 场景 6: 不同 service 的告警不被互相抑制
    {
        "name": "different_service_not_inhibited",
        "alerts": [
            {
                "status": "firing",
                "labels": {"alertname": "ZHSCanaryStageStuck", "severity": "warning", "service": "canary"},
            },
        ],
        "expected": {
            ("ZHSCanaryStageStuck", "warning"): "survive",  # 没有 source, 不被抑制
        },
    },
]


def run_fixtures() -> dict:
    """跑预设场景, 验证所有期望的抑制都发生.

    Returns:
        {
            "scenarios": [{name, passed, expected, actual, ...}],
            "all_passed": bool,
            "passed_count": int,
            "total_count": int,
        }
    """
    inh = AlertInhibitor(ZHS_INHIBITION_PRESETS)
    results = []
    for sc in FIXTURE_SCENARIOS:
        actual = inh.apply(sc["alerts"])
        # 构造 surviving 集合 (用 (alertname, severity) 元组)
        surviving_keys = set()
        for a in actual:
            lbl = a["labels"]
            surviving_keys.add((lbl["alertname"], lbl.get("severity", "")))
        # 验证
        all_passed = True
        mismatches = []
        for (an, sv), expected_role in sc["expected"].items():
            in_surviving = (an, sv) in surviving_keys
            if expected_role == "suppressed":
                if in_surviving:
                    all_passed = False
                    mismatches.append(f"{an}/{sv} 期望被抑制但实际 survive")
            else:  # survive
                if not in_surviving:
                    all_passed = False
                    mismatches.append(f"{an}/{sv} 期望 survive 但实际被抑制")
        results.append(
            {
                "name": sc["name"],
                "passed": all_passed,
                "mismatches": mismatches,
                "surviving_count": len(actual),
                "alert_count": len(sc["alerts"]),
            }
        )
    passed = sum(1 for r in results if r["passed"])
    return {
        "scenarios": results,
        "all_passed": passed == len(results),
        "passed_count": passed,
        "total_count": len(results),
    }


# ---------------------------------------------------------------------------
# YAML 自动同步 (Python → YAML)
# ---------------------------------------------------------------------------


def _render_yaml_block(rule: InhibitionRule) -> str:
    """渲染单条规则为 alertmanager YAML 块."""
    lines = [f"  - # name: {rule.name}"]
    if rule.source_matchers:
        lines.append("    source_match:")
        for k, v in rule.source_matchers.items():
            lines.append(f"      {k}: '{v}'")
    if rule.target_matchers:
        lines.append("    target_match:")
        for k, v in rule.target_matchers.items():
            lines.append(f"      {k}: '{v}'")
    if rule.equal is not None:
        eq = ", ".join(f"'{e}'" for e in rule.equal)
        lines.append(f"    equal: [{eq}]")
    return "\n".join(lines)


def sync_yaml_to_presets(yaml_path: Path) -> bool:
    """用 ZHS_INHIBITION_PRESETS 重写 yaml_path 的 inhibit_rules 段.

    Returns: True if file was modified.
    """
    if not yaml_path.exists():
        return False
    text = yaml_path.read_text(encoding="utf-8")
    # 构造新段
    new_section = "inhibit_rules:\n"
    new_section += "  # 经典 critical → warning (按 alertname + service 配对)\n"
    new_section += _render_yaml_block(ZHS_INHIBITION_PRESETS[5]) + "\n"
    new_section += "  # 建议 141: ZHS 专属抑制 (与 app/alert_inhibition.py:ZHS_INHIBITION_PRESETS 同步)\n"
    for rule in ZHS_INHIBITION_PRESETS[:5]:
        new_section += _render_yaml_block(rule) + "\n"
    # 替换原段
    new_text = re.sub(
        r"^inhibit_rules:[\s\S]*?(?=^receive[rs]:|\Z)",
        new_section,
        text,
        count=1,
        flags=re.MULTILINE,
    )
    if new_text != text:
        yaml_path.write_text(new_text, encoding="utf-8")
        return True
    return False


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--yaml-only", action="store_true", help="只校验 YAML 一致性, 不跑 fixture")
    p.add_argument("--fixtures", action="store_true", help="只跑 fixture")
    p.add_argument("--fix", action="store_true", help="自动同步 Python → YAML")
    p.add_argument("--json", action="store_true", help="JSON 输出")
    p.add_argument("--verbose", "-v", action="store_true", help="详细输出")
    args = p.parse_args()

    if args.fix:
        modified = []
        for yp in DEFAULT_YAML_PATHS:
            if sync_yaml_to_presets(yp):
                modified.append(str(yp))
        if modified:
            print("[fix] 已同步以下文件:")
            for m in modified:
                print(f"  - {m}")
        else:
            print("[fix] 无需修改")
        return 0

    # 校验
    report: dict = {
        "yaml_files": [],
        "fixture_check": None,
        "all_passed": True,
    }

    if not args.fixtures:
        for yp in DEFAULT_YAML_PATHS:
            cmp = compare_yaml_to_presets(yp)
            yaml_check = {
                "path": str(yp),
                "yaml_count": len(cmp["yaml_rules"]),
                "preset_count": len(cmp["preset_rules"]),
                "missing_in_yaml": [list(c) for c in cmp["missing_in_yaml"]],
                "extra_in_yaml": [list(c) for c in cmp["extra_in_yaml"]],
                "in_sync": cmp["in_sync"],
            }
            report["yaml_files"].append(yaml_check)
            if not cmp["in_sync"]:
                report["all_passed"] = False

    if not args.yaml_only:
        fx = run_fixtures()
        report["fixture_check"] = {
            "passed": fx["passed_count"],
            "total": fx["total_count"],
            "all_passed": fx["all_passed"],
            "scenarios": fx["scenarios"],
        }
        if not fx["all_passed"]:
            report["all_passed"] = False

    # 输出
    if args.json:
        import json

        print(json.dumps(report, indent=2, ensure_ascii=False, default=str))
    else:
        print("=" * 60)
        print("INHIBITION RULES CI CHECK (建议 143)")
        print("=" * 60)
        if not args.fixtures:
            print("\n[YAML 校验]")
            for yc in report["yaml_files"]:
                status = "✓" if yc["in_sync"] else "✗"
                print(f"  {status} {yc['path']}")
                print(f"    yaml 规则数: {yc['yaml_count']}")
                print(f"    预设 规则数: {yc['preset_count']}")
                if yc["missing_in_yaml"]:
                    print(f"    ✗ 缺失 {len(yc['missing_in_yaml'])} 条")
                    for c in yc["missing_in_yaml"][:3]:
                        print(f"      - {c}")
                if yc["extra_in_yaml"]:
                    print(f"    ✗ 多余 {len(yc['extra_in_yaml'])} 条")
                    for c in yc["extra_in_yaml"][:3]:
                        print(f"      - {c}")
        if not args.yaml_only and report["fixture_check"]:
            print("\n[Fixture 校验]")
            fc = report["fixture_check"]
            status = "✓" if fc["all_passed"] else "✗"
            print(f"  {status} {fc['passed']}/{fc['total']} 场景通过")
            if args.verbose or not fc["all_passed"]:
                for sc in fc["scenarios"]:
                    s = "✓" if sc["passed"] else "✗"
                    print(f"    {s} {sc['name']}")
                    if not sc["passed"]:
                        for m in sc["mismatches"]:
                            print(f"      ✗ {m}")
        print()
        if report["all_passed"]:
            print("RESULT: ALL CHECKS PASSED ✓")
        else:
            print("RESULT: FAILED ✗")
    return 0 if report["all_passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
