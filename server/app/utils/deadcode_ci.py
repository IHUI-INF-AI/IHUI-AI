"""Bug-81: 死代码检测 CI 集成.

设计:
  - 封装 dead_code_detector (Bug-73) 给出 CI 友好的输出格式
  - 输出 SARIF (静态分析结果交换格式) JSON, 供 GitHub Code Scanning / GitLab 等
  - 同时输出 Markdown 报告, 供 PR 评论
  - 支持 .deadcodeignore 文件 (白名单: 文件/函数/正则)
  - 阈值告警: dead 数量 > N 报错
  - 提供 pre-commit hook 模板

使用:
    from app.utils.deadcode_ci import ci_runner

    rc = ci_runner.run(paths=["app/utils"], ignore_file=".deadcodeignore", threshold=10)
    # rc=0 成功, rc=1 失败 (超过阈值)
"""

import json
import logging
import os
import re
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

DEFAULT_IGNORE_FILE = ".deadcodeignore"
SARIF_SCHEMA = "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json"


@dataclass
class IgnorePattern:
    file_glob: str = ""
    func_regex: str = ""
    reason: str = ""


class CiIgnoreLoader:
    """解析 .deadcodeignore 文件."""

    @staticmethod
    def load(path: str) -> list[IgnorePattern]:
        out: list[IgnorePattern] = []
        if not os.path.exists(path):
            return out
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                for raw in f:
                    line = raw.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = [p.strip() for p in line.split("|")]
                    out.append(
                        IgnorePattern(
                            file_glob=parts[0] if len(parts) > 0 else "",
                            func_regex=parts[1] if len(parts) > 1 else "",
                            reason=parts[2] if len(parts) > 2 else "",
                        )
                    )
        except Exception as e:
            logger.warning(f"deadcode_ci: load {path} fail: {e!r}")
        return out

    @staticmethod
    def matches(pattern: IgnorePattern, file_path: str, func_name: str) -> bool:
        if pattern.file_glob:
            # 简单 glob: * 通配
            regex = "^" + re.escape(pattern.file_glob).replace(r"\*", ".*") + "$"
            if not re.match(regex, file_path):
                return False
        return not (pattern.func_regex and not re.search(pattern.func_regex, func_name))


@dataclass
class CiResult:
    scanned_files: int = 0
    total_functions: int = 0
    total_dead: int = 0
    ignored_dead: int = 0
    after_ignore: int = 0
    threshold: int = 0
    passed: bool = True
    reasons: list[str] = field(default_factory=list)
    duration_sec: float = 0.0
    sarif: dict = field(default_factory=dict)
    markdown: str = ""

    def to_dict(self) -> dict:
        return {
            "scanned_files": self.scanned_files,
            "total_functions": self.total_functions,
            "total_dead": self.total_dead,
            "ignored_dead": self.ignored_dead,
            "after_ignore": self.after_ignore,
            "threshold": self.threshold,
            "passed": self.passed,
            "reasons": self.reasons,
            "duration_sec": round(self.duration_sec, 3),
        }


class CiRunner:
    """CI 集成入口."""

    def __init__(self, detector=None):
        from app.utils.dead_code_detector import dead_code_scanner

        self._scanner = detector or dead_code_scanner

    def run(
        self,
        paths: list[str],
        ignore_file: str = DEFAULT_IGNORE_FILE,
        threshold: int = 0,
        output_dir: str | None = None,
    ) -> CiResult:
        t0 = time.time()
        ignores = CiIgnoreLoader.load(ignore_file)
        report = self._scanner.scan(paths)
        s = report.summary()
        result = CiResult(
            scanned_files=s["scanned_files"],
            total_functions=s["total_functions"],
            total_dead=s["total_dead"],
            threshold=threshold,
        )

        # 应用 ignore
        kept = []
        ignored = 0
        for d in report.dead_functions:
            file_path = d.file if hasattr(d, "file") else ""
            func_name = d.name if hasattr(d, "name") else ""
            if any(CiIgnoreLoader.matches(p, file_path, func_name) for p in ignores):
                ignored += 1
                continue
            kept.append(d)
        result.ignored_dead = ignored
        result.after_ignore = len(kept)

        if threshold > 0 and result.after_ignore > threshold:
            result.passed = False
            result.reasons.append(f"dead count {result.after_ignore} > threshold {threshold}")

        result.duration_sec = time.time() - t0
        result.sarif = self._to_sarif(kept, paths)
        result.markdown = self._to_markdown(result, kept)

        if output_dir:
            self._write_outputs(output_dir, result)
        return result

    def _to_sarif(self, dead: list, paths: list[str]) -> dict:
        results = []
        rules_seen: dict[str, str] = {}
        for d in dead:
            rule_id = "DEAD-FUNCTION"
            if rule_id not in rules_seen:
                rules_seen[rule_id] = "Detected unused/dead function"
            results.append(
                {
                    "ruleId": rule_id,
                    "level": "warning",
                    "message": {"text": f"Function '{d.name}' appears unused"},
                    "locations": [
                        {
                            "physicalLocation": {
                                "artifactLocation": {"uri": d.file},
                                "region": {"startLine": d.line},
                            }
                        }
                    ],
                }
            )
        return {
            "$schema": SARIF_SCHEMA,
            "version": "2.1.0",
            "runs": [
                {
                    "tool": {
                        "driver": {
                            "name": "deadcode_ci",
                            "version": "1.0.0",
                            "rules": [
                                {
                                    "id": "DEAD-FUNCTION",
                                    "shortDescription": {"text": "Dead function"},
                                }
                            ],
                        }
                    },
                    "results": results,
                }
            ],
        }

    def _to_markdown(self, result: CiResult, dead: list) -> str:
        lines = [
            "# 死代码检测报告",
            "",
            f"- 扫描文件: {result.scanned_files}",
            f"- 总函数: {result.total_functions}",
            f"- 死函数: {result.total_dead}",
            f"- 豁免: {result.ignored_dead}",
            f"- 剩余: {result.after_ignore}",
            f"- 阈值: {result.threshold}",
            f"- 结果: {'PASS' if result.passed else 'FAIL'}",
            f"- 耗时: {result.duration_sec:.2f}s",
            "",
        ]
        if dead:
            lines.append("## 死函数列表")
            lines.append("")
            lines.append("| 文件 | 行号 | 函数 |")
            lines.append("| --- | --- | --- |")
            for d in dead[:200]:
                lines.append(f"| {d.file} | {d.line} | {d.name} |")
        return "\n".join(lines)

    def _write_outputs(self, output_dir: str, result: CiResult) -> None:
        os.makedirs(output_dir, exist_ok=True)
        with open(os.path.join(output_dir, "deadcode.sarif.json"), "w", encoding="utf-8") as f:
            json.dump(result.sarif, f, ensure_ascii=False, indent=2)
        with open(os.path.join(output_dir, "deadcode.md"), "w", encoding="utf-8") as f:
            f.write(result.markdown)
        with open(os.path.join(output_dir, "deadcode.summary.json"), "w", encoding="utf-8") as f:
            json.dump(result.to_dict(), f, ensure_ascii=False, indent=2)

    @staticmethod
    def pre_commit_template() -> str:
        """返回 .pre-commit-config.yaml 片段."""
        return (
            "# .pre-commit-config.yaml 片段\n"
            "repos:\n"
            "  - repo: local\n"
            "    hooks:\n"
            "      - id: deadcode\n"
            "        name: deadcode scan\n"
            "        entry: python -m app.utils.deadcode_ci\n"
            "        language: system\n"
            "        pass_filenames: false\n"
        )


# 全局单例
ci_runner = CiRunner()
