"""本地依赖漏洞扫描脚本.

用法:
    python scripts/security_audit.py
    python scripts/security_audit.py --json report.json
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="依赖漏洞扫描 (pip-audit wrapper)")
    parser.add_argument("--json", help="输出 JSON 报告到指定路径")
    parser.add_argument("--strict", action="store_true", help="发现漏洞时返回非零退出码")
    args = parser.parse_args()

    try:
        import pip_audit  # noqa: F401
    except ImportError:
        print("ERROR pip-audit 未安装: pip install pip-audit", file=sys.stderr)
        sys.exit(1)

    cmd = [sys.executable, "-m", "pip_audit"]
    if args.strict:
        cmd.append("--strict")
    if args.json:
        cmd += ["--format", "json", "--output", args.json]

    print(f"执行: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    if args.json:
        json_path = Path(args.json)
        if json_path.exists():
            try:
                data = json.loads(json_path.read_text(encoding="utf-8"))
                vuln_count = sum(len(vulns) for vulns in data.get("dependencies", {}).values())
                print(f"\n扫描完成: {len(data.get('dependencies', {}))} 个包, {vuln_count} 个漏洞")
            except Exception as e:
                print(f"解析 JSON 失败: {e}", file=sys.stderr)

    sys.exit(result.returncode if args.strict else 0)


if __name__ == "__main__":
    main()
