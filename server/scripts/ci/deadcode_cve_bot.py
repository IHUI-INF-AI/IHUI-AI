"""Phase 15 建议 3: 死代码检测 (vulture) + 依赖漏洞扫描 (pip-audit / safety).

目的:
  - CI 阶段自动跑死代码 + CVE 扫描
  - 失败时自动创建/更新 GitHub PR (含详细报告)
  - 支持 dry-run 模式 (本地调试)

设计:
  DeadCodeScanner:
    - 用 vulture CLI 扫描项目
    - 解析输出 (file:line: func_name (confidence%))
    - 按 confidence 阈值过滤
    - 返回结构化结果

  CVEScanner:
    - 用 pip-audit 或 safety 扫描 requirements
    - 解析 JSON 输出
    - 按 severity 过滤

  GHAReportBuilder:
    - 把两类扫描结果拼成 Markdown 报告
    - 生成 PR 内容

  AutoPRCreator:
    - GitHub API: 创建或更新 PR
    - 内容含报告
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# 数据类
# ---------------------------------------------------------------------------


@dataclass
class DeadCodeItem:
    file: str
    line: int
    func: str
    confidence: int  # 0-100

    def to_markdown(self) -> str:
        return f"- `{self.file}:{self.line}` **{self.func}** (置信度 {self.confidence}%)"


@dataclass
class DeadCodeReport:
    items: list[DeadCodeItem] = field(default_factory=list)
    scanned_files: int = 0
    error: str = ""

    @property
    def high_confidence_count(self) -> int:
        return sum(1 for x in self.items if x.confidence >= 80)

    def to_dict(self) -> dict:
        return {
            "scanned_files": self.scanned_files,
            "error": self.error,
            "total": len(self.items),
            "high_confidence": self.high_confidence_count,
            "items": [asdict(i) for i in self.items],
        }


@dataclass
class CVEItem:
    package: str
    installed: str
    fixed: str
    severity: str  # LOW/MEDIUM/HIGH/CRITICAL
    cve_id: str
    description: str = ""

    def to_markdown(self) -> str:
        return f"- **{self.package}** `{self.installed}` -> `{self.fixed}` ({self.severity}) `{self.cve_id}`"


@dataclass
class CVEReport:
    items: list[CVEItem] = field(default_factory=list)
    scanned_packages: int = 0
    error: str = ""

    @property
    def critical_count(self) -> int:
        return sum(1 for x in self.items if x.severity == "CRITICAL")

    @property
    def high_count(self) -> int:
        return sum(1 for x in self.items if x.severity == "HIGH")

    def to_dict(self) -> dict:
        return {
            "scanned_packages": self.scanned_packages,
            "error": self.error,
            "total": len(self.items),
            "critical": self.critical_count,
            "high": self.high_count,
            "items": [asdict(i) for i in self.items],
        }


# ---------------------------------------------------------------------------
# 1. DeadCodeScanner
# ---------------------------------------------------------------------------


class DeadCodeScanner:
    """调用 vulture 扫描项目死代码."""

    def __init__(self, min_confidence: int = 60):
        self.min_confidence = min_confidence

    def is_available(self) -> bool:
        return self._which("vulture") is not None

    def _which(self, cmd: str) -> str | None:
        from shutil import which

        return which(cmd)

    def scan(self, paths: list[str], min_confidence: int | None = None) -> DeadCodeReport:
        """扫描多个路径."""
        threshold = min_confidence if min_confidence is not None else self.min_confidence
        report = DeadCodeReport()
        if not self.is_available():
            report.error = "vulture 未安装 (pip install vulture)"
            return report
        try:
            cmd = ["vulture", "--min-confidence", str(threshold), "--sort-by-size"] + list(paths)
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            out = proc.stdout or ""
            for line in out.splitlines():
                line = line.strip()
                if not line:
                    continue
                item = self._parse_line(line)
                if item is not None:
                    report.items.append(item)
            # 统计扫描文件数 (vulture 不直接给, 用 wc 估)
            try:
                wc = subprocess.run(
                    (
                        [
                            "python",
                            "-c",
                            "import sys, os; print(sum(1 for r,_,fs in os.walk(sys.argv[1]) for f in fs if f.endswith('.py')) for _ in [0])",
                        ]
                        if False
                        else ["find"] + list(paths) + ["-name", "*.py", "-type", "f"]
                    ),
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if wc.returncode == 0:
                    report.scanned_files = len([l for l in wc.stdout.splitlines() if l.strip()])
            except Exception:
                pass
        except subprocess.TimeoutExpired:
            report.error = "vulture 超时 (300s)"
        except FileNotFoundError as e:
            report.error = f"vulture 启动失败: {e}"
        except Exception as e:
            report.error = f"vulture 异常: {e}"
        return report

    def _parse_line(self, line: str) -> DeadCodeItem | None:
        """解析 vulture 输出: 'path/to/file.py:123: unused_func (60% confidence)'."""
        m = re.match(r"^(.+?):(\d+):\s+(\S+)\s+\((\d+)%\s*confidence\)\s*$", line)
        if not m:
            return None
        return DeadCodeItem(
            file=m.group(1),
            line=int(m.group(2)),
            func=m.group(3),
            confidence=int(m.group(4)),
        )


# ---------------------------------------------------------------------------
# 2. CVEScanner
# ---------------------------------------------------------------------------


class CVEScanner:
    """调用 pip-audit 扫描依赖漏洞."""

    def __init__(self, severity_threshold: str = "MEDIUM"):
        self.severity_threshold = severity_threshold
        self._sev_order = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

    def is_available(self) -> bool:
        return self._which("pip-audit") is not None or self._which("safety") is not None

    def _which(self, cmd: str) -> str | None:
        from shutil import which

        return which(cmd)

    def scan(self, requirements_file: str = "requirements.txt") -> CVEReport:
        report = CVEReport()
        if not self.is_available():
            report.error = "pip-audit / safety 均未安装"
            return report
        if self._which("pip-audit"):
            return self._scan_pip_audit(requirements_file, report)
        return self._scan_safety(requirements_file, report)

    def _scan_pip_audit(self, requirements_file: str, report: CVEReport) -> CVEReport:
        try:
            proc = subprocess.run(
                ["pip-audit", "-r", requirements_file, "--format", "json", "--disable-pip"],
                capture_output=True,
                text=True,
                timeout=300,
            )
            data = json.loads(proc.stdout or "[]")
        except subprocess.TimeoutExpired:
            report.error = "pip-audit 超时"
            return report
        except Exception as e:
            report.error = f"pip-audit 异常: {e}"
            return report
        for dep in data:
            name = dep.get("name", "")
            ver = dep.get("version", "")
            for v in dep.get("vulns", []):
                sev_raw = (v.get("severity") or "MEDIUM").upper()
                sev = sev_raw if sev_raw in self._sev_order else "MEDIUM"
                if self._sev_order[sev] < self._sev_order[self.severity_threshold]:
                    continue
                report.items.append(
                    CVEItem(
                        package=name,
                        installed=ver,
                        fixed=",".join(v.get("fix_versions", [])) or "n/a",
                        severity=sev,
                        cve_id=v.get("id", ""),
                        description=(v.get("description") or "")[:200],
                    )
                )
            report.scanned_packages += 1
        return report

    def _scan_safety(self, requirements_file: str, report: CVEReport) -> CVEReport:
        try:
            proc = subprocess.run(
                ["safety", "check", "-r", requirements_file, "--json", "--disable-telemetry"],
                capture_output=True,
                text=True,
                timeout=300,
            )
            data = json.loads(proc.stdout or "{}")
        except subprocess.TimeoutExpired:
            report.error = "safety 超时"
            return report
        except Exception as e:
            report.error = f"safety 异常: {e}"
            return report
        vulns = data.get("vulnerabilities", []) if isinstance(data, dict) else data
        for v in vulns:
            sev_raw = (v.get("severity") or "MEDIUM").upper()
            sev = sev_raw if sev_raw in self._sev_order else "MEDIUM"
            if self._sev_order[sev] < self._sev_order[self.severity_threshold]:
                continue
            report.items.append(
                CVEItem(
                    package=v.get("package_name", ""),
                    installed=v.get("analyzed_version", ""),
                    fixed=",".join(v.get("fixed_versions", [])) or "n/a",
                    severity=sev,
                    cve_id=v.get("CVE") or v.get("cve") or v.get("id", ""),
                    description=(v.get("description") or v.get("advisory") or "")[:200],
                )
            )
        return report


# ---------------------------------------------------------------------------
# 3. GHAReportBuilder
# ---------------------------------------------------------------------------


class GHAReportBuilder:
    """把死代码 + CVE 结果拼成 Markdown 报告."""

    def build(
        self,
        dead_code: DeadCodeReport,
        cve: CVEReport,
        base_branch: str = "main",
    ) -> str:
        lines: list[str] = []
        lines.append("# 🛡️ 自动维护: 死代码 + CVE 扫描报告")
        lines.append("")
        lines.append(f"**基础分支**: `{base_branch}`")
        lines.append("")
        lines.append("## 1. 死代码扫描 (vulture)")
        lines.append("")
        if dead_code.error:
            lines.append(f"> ⚠️ 错误: {dead_code.error}")
        else:
            lines.append(f"- 扫描文件: **{dead_code.scanned_files}**")
            lines.append(f"- 命中项: **{len(dead_code.items)}** (高置信度 ≥80%: **{dead_code.high_confidence_count}**)")
            if dead_code.items:
                lines.append("")
                lines.append("| 文件 | 行 | 函数 | 置信度 |")
                lines.append("| --- | --- | --- | --- |")
                for x in sorted(dead_code.items, key=lambda i: -i.confidence)[:30]:
                    lines.append(f"| `{x.file}` | {x.line} | `{x.func}` | {x.confidence}% |")
                if len(dead_code.items) > 30:
                    lines.append(f"\n> 还有 {len(dead_code.items) - 30} 项, 详见工作流 artifact")
            else:
                lines.append("\n✅ 无死代码")
        lines.append("")
        lines.append("## 2. CVE 漏洞扫描 (pip-audit)")
        lines.append("")
        if cve.error:
            lines.append(f"> ⚠️ 错误: {cve.error}")
        else:
            lines.append(f"- 扫描包: **{cve.scanned_packages}**")
            lines.append(
                f"- 命中项: **{len(cve.items)}** (Critical: **{cve.critical_count}**, High: **{cve.high_count}**)"
            )
            if cve.items:
                lines.append("")
                lines.append("| 包 | 已装版本 | 修复版本 | 严重度 | CVE |")
                lines.append("| --- | --- | --- | --- | --- |")
                for x in sorted(
                    cve.items, key=lambda i: -{"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}.get(i.severity, 0)
                )[:30]:
                    lines.append(f"| `{x.package}` | `{x.installed}` | `{x.fixed}` | {x.severity} | {x.cve_id} |")
                if len(cve.items) > 30:
                    lines.append(f"\n> 还有 {len(cve.items) - 30} 项, 详见工作流 artifact")
            else:
                lines.append("\n✅ 无已知漏洞")
        lines.append("")
        lines.append("---")
        lines.append("_此 PR 由 GitHub Actions 自动创建, 请人工 review 后合并_")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# 4. AutoPRCreator
# ---------------------------------------------------------------------------


class AutoPRCreator:
    """通过 GitHub API 创建/更新 PR."""

    def __init__(self, repo: str, token: str, branch: str = "zhs/auto-fix-deps"):
        self.repo = repo  # "owner/name"
        self.token = token
        self.branch = branch

    def _api(self, path: str, method: str = "GET", data: dict | None = None) -> tuple[int, Any]:
        url = f"https://api.github.com/repos/{self.repo}{path}"
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=body, method=method)
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Accept", "application/vnd.github+json")
        req.add_header("X-GitHub-Api-Version", "2022-11-28")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                code = resp.getcode()
                payload = resp.read().decode("utf-8")
                return code, json.loads(payload) if payload else {}
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", errors="ignore")
            return e.code, {"error": body_text}
        except Exception as e:
            return 0, {"error": str(e)}

    def find_open_pr(self, head: str, base: str = "main") -> dict | None:
        code, data = self._api(f"/pulls?head={urllib.parse.quote(head)}&base={urllib.parse.quote(base)}&state=open")
        if code == 200 and isinstance(data, list) and data:
            return data[0]
        return None

    def upsert_pr(
        self,
        title: str,
        body: str,
        base: str = "main",
        head: str | None = None,
    ) -> dict:
        """创建或更新 PR."""
        head = head or self.branch
        existing = self.find_open_pr(head, base)
        if existing is not None:
            # 更新
            code, data = self._api(
                f"/pulls/{existing['number']}",
                method="PATCH",
                data={"title": title, "body": body},
            )
            return {"action": "updated", "number": existing["number"], "code": code, "data": data}
        # 创建
        code, data = self._api(
            "/pulls",
            method="POST",
            data={"title": title, "body": body, "head": head, "base": base, "draft": True},
        )
        return {
            "action": "created",
            "number": data.get("number") if isinstance(data, dict) else None,
            "code": code,
            "data": data,
        }

    def add_comment(self, pr_number: int, body: str) -> dict:
        code, data = self._api(
            f"/issues/{pr_number}/comments",
            method="POST",
            data={"body": body},
        )
        return {"code": code, "data": data}


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    """演示: 跑死代码 + CVE 扫描并打印报告."""
    import argparse

    p = argparse.ArgumentParser(description="死代码 + CVE 扫描 + PR 报告")
    p.add_argument("--path", default="scripts", help="死代码扫描路径")
    p.add_argument("--requirements", default="requirements.txt", help="依赖文件")
    p.add_argument("--min-confidence", type=int, default=60, help="vulture 最小置信度")
    p.add_argument("--severity", default="MEDIUM", choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    p.add_argument("--dry-run", action="store_true", help="只跑扫描, 不创建 PR")
    p.add_argument("--out", default="", help="报告输出文件 (默认 stdout)")
    args = p.parse_args(argv)

    print(f"🔍 死代码扫描: {args.path} (min_confidence={args.min_confidence})", file=sys.stderr)
    dc = DeadCodeScanner(min_confidence=args.min_confidence).scan([args.path])
    print(f"   命中: {len(dc.items)} 项, 扫描 {dc.scanned_files} 文件", file=sys.stderr)

    print(f"🛡️ CVE 扫描: {args.requirements} (severity>={args.severity})", file=sys.stderr)
    cve = CVEScanner(severity_threshold=args.severity).scan(args.requirements)
    print(f"   命中: {len(cve.items)} 项, 扫描 {cve.scanned_packages} 包", file=sys.stderr)

    report = GHAReportBuilder().build(dc, cve)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"📄 报告写入: {args.out}", file=sys.stderr)
    else:
        print(report)

    if not args.dry_run:
        token = os.environ.get("GITHUB_TOKEN", "")
        repo = os.environ.get("GITHUB_REPOSITORY", "")
        if token and repo:
            pr_creator = AutoPRCreator(repo, token)
            result = pr_creator.upsert_pr(
                title="[auto] 死代码 + CVE 扫描报告",
                body=report,
            )
            print(f"🤖 PR 操作: {result['action']} (#{result['number']})", file=sys.stderr)
        else:
            print("⚠️ 未设置 GITHUB_TOKEN / GITHUB_REPOSITORY, 跳过 PR 创建", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
