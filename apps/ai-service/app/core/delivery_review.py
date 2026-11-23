# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""交付前 diff 自动复核(确定性,零模型成本)。

对照 DSH `dsh-delivery-review` 的"回合结束前独立自审 diff"语义,但本模块只做
**可证明的机械判据**,不调用模型、不修改文件、不阻止已完成的回合:

- blocker:新增内容含未解决的冲突标记(`<<<<<<<` / `>>>>>>>`);
- major:新增调试残留(`debugger` / `console.log` / `pdb.set_trace` / `breakpoint()`)、
  删除测试断言、单轮 diff 规模超预算、二进制变更;
- minor:新增 `TODO` / `FIXME`、行数不精确(`coarse`)。

结论只回 `approve` / `revise`;调用方(引擎客户端/UI)看到 `deliveryReview` 自行决定
是否提示。**不伪造"已审过"**:没有 diff 且没有 changes 时 `reviewed=false`。
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

__all__ = [
    "DeliveryFinding",
    "DeliveryReview",
    "review_delivery_diff",
    "MAX_CHANGED_LINES",
    "MAX_CHANGED_FILES",
]

#: 单轮 diff 规模预算(超过即 major,不阻断但必须显式提示)。
MAX_CHANGED_LINES = 5_000
MAX_CHANGED_FILES = 500

_CONFLICT_MARKERS = ("<<<<<<<", ">>>>>>>")
_DEBUG_SNIPPETS = ("debugger", "console.log(", "pdb.set_trace", "breakpoint()")
_TEST_DELETE_SNIPPETS = ("def test_", "it(", "describe(", "test(")


@dataclass(frozen=True)
class DeliveryFinding:
    """一条复核发现。"""

    severity: str  # blocker / major / minor
    code: str
    message: str
    path: str | None = None
    line: int | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "severity": self.severity,
            "code": self.code,
            "message": self.message,
            "path": self.path,
            "line": self.line,
        }


@dataclass
class DeliveryReview:
    """一次交付前复核结论。"""

    reviewed: bool
    verdict: str  # approve / revise
    findings: list[DeliveryFinding] = field(default_factory=list)
    files: int = 0
    additions: int = 0
    deletions: int = 0

    @property
    def blockers(self) -> int:
        return sum(1 for f in self.findings if f.severity == "blocker")

    @property
    def majors(self) -> int:
        return sum(1 for f in self.findings if f.severity == "major")

    def as_dict(self) -> dict[str, Any]:
        return {
            "reviewed": self.reviewed,
            "verdict": self.verdict,
            "findings": [f.as_dict() for f in self.findings],
            "blockers": self.blockers,
            "majors": self.majors,
            "minors": sum(1 for f in self.findings if f.severity == "minor"),
            "files": self.files,
            "additions": self.additions,
            "deletions": self.deletions,
        }


def _added_lines(unified_diff: str) -> list[tuple[int, str]]:
    """返回 `(行号, 内容)` 的新增行;文件头 `+++` 不算新增内容。"""
    added: list[tuple[int, str]] = []
    for index, line in enumerate(unified_diff.splitlines(), start=1):
        if not line.startswith("+") or line.startswith("+++ "):
            continue
        added.append((index, line[1:]))
    return added


def _deleted_lines(unified_diff: str) -> list[tuple[int, str]]:
    deleted: list[tuple[int, str]] = []
    for index, line in enumerate(unified_diff.splitlines(), start=1):
        if not line.startswith("-") or line.startswith("--- "):
            continue
        deleted.append((index, line[1:]))
    return deleted


def review_delivery_diff(
    unified_diff: str | None,
    changes: Sequence[Mapping[str, Any]] | None = None,
    *,
    max_changed_lines: int = MAX_CHANGED_LINES,
    max_changed_files: int = MAX_CHANGED_FILES,
) -> DeliveryReview:
    """对一轮的 unified diff + changes 摘要做确定性复核。"""
    diff = unified_diff or ""
    change_rows = list(changes or [])
    additions = sum(int(c.get("additions", 0) or 0) for c in change_rows)
    deletions = sum(int(c.get("deletions", 0) or 0) for c in change_rows)
    files = len(change_rows)
    findings: list[DeliveryFinding] = []

    if not diff and not change_rows:
        return DeliveryReview(reviewed=False, verdict="approve")

    conflict_seen = False
    for line_no, content in _added_lines(diff):
        stripped = content.strip()
        if any(marker in stripped for marker in _CONFLICT_MARKERS):
            if not conflict_seen:
                findings.append(
                    DeliveryFinding(
                        "blocker",
                        "conflict-marker",
                        "新增内容里仍有未解决的合并冲突标记",
                        line=line_no,
                    )
                )
                conflict_seen = True
        if any(snippet in stripped for snippet in _DEBUG_SNIPPETS):
            findings.append(
                DeliveryFinding(
                    "major",
                    "debug-leftover",
                    f"新增内容疑似调试残留: {stripped[:80]}",
                    line=line_no,
                )
            )
        if "TODO" in stripped or "FIXME" in stripped:
            findings.append(
                DeliveryFinding(
                    "minor",
                    "todo-added",
                    f"新增内容带 TODO/FIXME: {stripped[:80]}",
                    line=line_no,
                )
            )

    for line_no, content in _deleted_lines(diff):
        stripped = content.strip()
        if any(snippet in stripped for snippet in _TEST_DELETE_SNIPPETS):
            findings.append(
                DeliveryFinding(
                    "major",
                    "test-deleted",
                    "本轮删除了测试代码,需要确认不是误删",
                    line=line_no,
                )
            )

    for change in change_rows:
        if bool(change.get("binary")):
            findings.append(
                DeliveryFinding(
                    "major",
                    "binary-change",
                    "二进制文件变更,无法在本轮做行级复核",
                    path=str(change.get("path") or "") or None,
                )
            )
        if bool(change.get("coarse")):
            findings.append(
                DeliveryFinding(
                    "minor",
                    "coarse-stats",
                    "该文件增删行数不精确(非 git 基线或超预算),不要据此声称精确",
                    path=str(change.get("path") or "") or None,
                )
            )

    if files > max_changed_files:
        findings.append(
            DeliveryFinding(
                "major",
                "too-many-files",
                f"本轮变更文件 {files} 个,超过预算 {max_changed_files}",
            )
        )
    if additions + deletions > max_changed_lines:
        findings.append(
            DeliveryFinding(
                "major",
                "too-many-lines",
                f"本轮增删 {additions + deletions} 行,超过预算 {max_changed_lines}",
            )
        )

    verdict = "revise" if any(f.severity in ("blocker", "major") for f in findings) else "approve"
    return DeliveryReview(
        reviewed=True,
        verdict=verdict,
        findings=findings,
        files=files,
        additions=additions,
        deletions=deletions,
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
