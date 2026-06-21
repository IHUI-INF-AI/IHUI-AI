"""依赖 CVE 自检 (Phase 6-C).

包装 pip-audit / safety, 扫描项目依赖是否有已知漏洞.

退出码:
  0  无漏洞 (或工具不可用且 --strict=false)
  1  发现已知漏洞
  2  工具不可用 (--strict 模式时)

用法:
  python scripts/ci/check_dependency_cve.py            # 默认 warning
  python scripts/ci/check_dependency_cve.py --strict    # 有漏洞即 fail
  python scripts/ci/check_dependency_cve.py --json
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

REQUIREMENTS = ROOT / "requirements.txt"
PYPROJECT = ROOT / "pyproject.toml"
SETUP_PY = ROOT / "setup.py"


# ---------------------------------------------------------------------------
# 1. 找依赖清单
# ---------------------------------------------------------------------------


def find_dependency_files() -> list[Path]:
    out = []
    for p in (REQUIREMENTS, PYPROJECT, SETUP_PY):
        if p.exists():
            out.append(p)
    return out


def parse_requirements(path: Path) -> list[dict[str, str]]:
    """解析 requirements.txt → [{name, version, source}]."""
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        # name 可能含 [extras], e.g. "uvicorn[standard]"
        m = re.match(r"^([A-Za-z0-9._-]+(?:\[[\w.-]+\])?)\s*([><=!~]+)\s*([\w.]+)?", line)
        if m:
            out.append(
                {
                    "name": m.group(1),
                    "operator": m.group(2),
                    "version": m.group(3) or "",
                    "source": path.name,
                }
            )
    return out


def parse_pyproject(path: Path) -> list[dict[str, str]]:
    """解析 pyproject.toml [project] dependencies → [{name, version, source}]."""
    out = []
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"  [WARN]  parse_pyproject 失败: {e}")
        return out
    # PEP 621: project.dependencies = ["requests>=2.31.0", ...]
    proj = data.get("project") or {}
    deps = proj.get("dependencies") or []
    for spec in deps:
        spec = str(spec).strip()
        m = re.match(r"^([A-Za-z0-9._-]+)\s*([><=!~]+)\s*([\w.]+)?", spec)
        if m:
            out.append(
                {
                    "name": m.group(1),
                    "operator": m.group(2),
                    "version": m.group(3) or "",
                    "source": path.name,
                }
            )
    # Optional: [tool.poetry.dependencies]
    poetry = (data.get("tool") or {}).get("poetry") or {}
    for name, spec in (poetry.get("dependencies") or {}).items():
        if name.lower() == "python":
            continue
        if isinstance(spec, str):
            m = re.match(r"^([><=!~]+)\s*([\w.]+)", spec.strip())
            if m:
                out.append(
                    {
                        "name": name,
                        "operator": m.group(1),
                        "version": m.group(2),
                        "source": path.name + ":poetry",
                    }
                )
        elif isinstance(spec, dict):
            ver = spec.get("version") or ""
            m = re.match(r"^([><=!~]+)\s*([\w.]+)", ver.strip()) if ver else None
            if m:
                out.append(
                    {
                        "name": name,
                        "operator": m.group(1),
                        "version": m.group(2),
                        "source": path.name + ":poetry",
                    }
                )
    return out


# ---------------------------------------------------------------------------
# 2. 调用外部工具
# ---------------------------------------------------------------------------


def run_pip_audit() -> tuple[int, str, str]:
    """返回 (returncode, stdout, stderr)."""
    if not shutil.which("pip-audit"):
        return -1, "", "pip-audit not found"
    try:
        r = subprocess.run(
            ["pip-audit", "-r", str(REQUIREMENTS), "--format=json"],
            capture_output=True,
            text=True,
            timeout=300,
        )
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return -2, "", "pip-audit timeout"
    except Exception as e:
        return -3, "", str(e)


def parse_pip_audit_output(output: str) -> list[dict[str, Any]]:
    """解析 pip-audit JSON 输出."""
    if not output:
        return []
    try:
        data = json.loads(output)
    except Exception:
        return []
    vulns = []
    for dep in data.get("dependencies", []) if isinstance(data, dict) else []:
        name = dep.get("name", "")
        version = dep.get("version", "")
        for v in dep.get("vulns", []):
            vulns.append(
                {
                    "package": name,
                    "installed_version": version,
                    "vuln_id": v.get("id", ""),
                    "fix_versions": v.get("fix_versions", []),
                    "description": v.get("description", "")[:200],
                    "severity": "unknown",
                }
            )
    return vulns


# ---------------------------------------------------------------------------
# 3. 启发式 fallback
# ---------------------------------------------------------------------------

# 已知严重 CVE (Phase 6-C 内置, 与 pip-audit 离线版数据库)
# 持续维护: 当上游发布高危 CVE 时手工补这里, 至少保证不放过影响范围广的包.
KNOWN_CRITICAL = {
    # 已修复: 不应再出现
    "django": {
        "lt": "4.2.16",
        "reason": "CVE-2024-53907 / 53908 / 53910 等多个高危 SQL injection / XSS",
    },
    "sqlalchemy": {
        "lt": "2.0.0",
        "reason": "CVE-2019-7164 (历史, 但部分老代码可能仍在用)",
    },
    "pillow": {
        "lt": "10.3.0",
        "reason": "CVE-2024-28219 heap overflow 等",
    },
    "cryptography": {
        "lt": "42.0.0",
        "reason": "CVE-2023-50782 / 2024-26130 (Bleichenbacher / NULL deref)",
    },
    "pyjwt": {
        "lt": "2.4.0",
        "reason": "CVE-2022-29217 algorithm confusion",
    },
    "requests": {
        "lt": "2.32.0",
        "reason": "CVE-2024-35195 session.verify=False persistence",
    },
    "urllib3": {
        "lt": "1.26.18",
        "reason": "CVE-2023-43804 / 2023-45803 redirect leak",
    },
    "jinja2": {
        "lt": "3.1.4",
        "reason": "CVE-2024-22195 XSS via xmlattr filter",
    },
    "fastapi": {
        "lt": "0.110.0",
        "reason": "CVE-2024-23346 / 23347 path traversal via docs",
    },
    "pydantic": {
        "lt": "1.10.13",
        "reason": "CVE-2024-3772 (v1) / 1.10.14+ 推荐",
    },
}


def _parse_version(v: str) -> tuple[int, ...]:
    """v1.2.3a1 → (1, 2, 3, 1) ; 数字 + 字母处理."""
    if not v:
        return (0,)
    # 抽数字部分
    parts = re.findall(r"\d+", v)
    return tuple(int(p) for p in parts) if parts else (0,)


def _is_lt(installed: str, threshold: str) -> bool:
    return _parse_version(installed) < _parse_version(threshold)


def heuristic_check(deps: list[dict]) -> list[dict]:
    """启发式已知漏洞检查 (pip-audit 不可用时 fallback)."""
    out = []
    for d in deps:
        name = d["name"].lower().replace("_", "-")
        if name in KNOWN_CRITICAL:
            rule = KNOWN_CRITICAL[name]
            if not d.get("version"):
                continue
            if _is_lt(d["version"], rule["lt"]):
                out.append(
                    {
                        "package": d["name"],
                        "installed_version": d["version"],
                        "vuln_id": f"heuristic-{name}",
                        "fix_versions": [rule["lt"]],
                        "description": rule["reason"],
                        "severity": "high",
                        "source": "heuristic",
                    }
                )
    return out


# ---------------------------------------------------------------------------
# 4. Main
# ---------------------------------------------------------------------------


def main() -> int:
    p = argparse.ArgumentParser(description="依赖 CVE 自检 (Phase 6-C)")
    p.add_argument("--strict", action="store_true", help="有漏洞即 fail")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    print("=" * 60)
    print("依赖 CVE 自检 (Phase 6-C)")
    print("=" * 60)

    dep_files = find_dependency_files()
    print(f"\n[Step 1] 依赖清单文件: {[f.name for f in dep_files]}")

    deps: list[dict] = []
    if REQUIREMENTS.exists():
        deps.extend(parse_requirements(REQUIREMENTS))
    if PYPROJECT.exists():
        deps.extend(parse_pyproject(PYPROJECT))
    print(f"  共解析依赖: {len(deps)} 条")

    # 尝试 pip-audit
    print("\n[Step 2] 调用 pip-audit ...")
    rc, out, err = run_pip_audit()
    if rc >= 0:
        vulns = parse_pip_audit_output(out)
        print(f"  pip-audit 退出码: {rc}")
        print(f"  发现漏洞: {len(vulns)} 条")
        source = "pip-audit"
    else:
        print(f"  pip-audit 不可用 ({err}), 降级到启发式检查")
        vulns = heuristic_check(deps)
        print(f"  启发式检查发现: {len(vulns)} 条")
        source = "heuristic"
        # strict 模式下工具不可用应当 fail
        if args.strict:
            print("  --strict 模式下工具不可用 → FAIL")
            if args.json:
                print(
                    json.dumps(
                        {
                            "status": "tool_unavailable",
                            "source": source,
                            "deps_count": len(deps),
                        },
                        ensure_ascii=False,
                        indent=2,
                    )
                )
            return 2

    # 报告
    print("\n[Step 3] 漏洞详情:")
    if not vulns:
        print(f"  [OK] 0 条漏洞 (来源: {source})")
    else:
        for v in vulns:
            print(f"  [WARN]  {v['package']}=={v['installed_version']} → {v['vuln_id']}")
            print(f"     描述: {v['description']}")
            if v.get("fix_versions"):
                print(f"     修复: 升级到 {', '.join(v['fix_versions'])}")
            print(f"     来源: {v.get('source', source)}")

    print()
    if vulns and args.strict:
        print("=" * 60)
        print(f"[FAIL] FAIL: {len(vulns)} 条已知漏洞")
        print("=" * 60)
        if args.json:
            print(
                json.dumps(
                    {
                        "status": "fail",
                        "source": source,
                        "deps_count": len(deps),
                        "vulns": vulns,
                    },
                    ensure_ascii=False,
                    indent=2,
                    default=str,
                )
            )
        return 1

    if vulns:
        print("=" * 60)
        print(f"[WARN]  发现 {len(vulns)} 条漏洞 (warning 模式, 加 --strict 严格 fail)")
        print("=" * 60)
    else:
        print("=" * 60)
        print(f"[OK] PASS: 0 条漏洞 (来源: {source}, 解析 {len(deps)} 条依赖)")
        print("=" * 60)

    if args.json:
        print(
            json.dumps(
                {
                    "status": "ok",
                    "source": source,
                    "deps_count": len(deps),
                    "vulns_count": len(vulns),
                    "vulns": vulns,
                },
                ensure_ascii=False,
                indent=2,
                default=str,
            )
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
