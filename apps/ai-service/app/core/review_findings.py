# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D115 结构化代码审查(G-229)findings 判据单源。

review 模式的模型输出仍然是人读的三档 Markdown(P1 / P2 / Nits);本模块只做
**同一段文本的第二投影**:把末尾 `<review-findings>` JSON 块解析成 SSE
`review-finding` 帧,让端上能按严重度分组渲染并定位到 文件:行。

三条纪律:
  1. **判据单源** —— 严重度枚举、块标记、解析/帧构造只有这一份实现,
     `app/routers/llm.py` 的发帧包装与测试都 import 这里,不在别处抄第二份。
  2. **失效方向是多要一次说明,不是多造一条 finding** —— 解析不出/字段坏
     ⇒ 丢该条并计数,绝不猜测补全;整块缺失 ⇒ 空列表(端上走空态)。
  3. **能力边界诚实** —— 模型没按格式输出时退回 Markdown 三档的小标题 + 项目符号
     兜底解析;兜底同样只认「path:line」锚点,认不出就不产出。
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable, Mapping
from typing import Any

#: SSE 事件名(与 packages/shared/src/sse/contract.ts 的 REVIEW_FINDING 逐字一致)
REVIEW_FINDING_EVENT = "review-finding"

#: 严重度三档(封闭集合;P1 阻塞 / P2 建议 / Nit 细节)
REVIEW_SEVERITIES: tuple[str, str, str] = ("P1", "P2", "Nit")

#: 模型输出里机器可读块的标记(与 REVIEW_FINDING_INSTRUCTION 成对,改一处必须改两处)
REVIEW_FINDINGS_OPEN = "<review-findings>"
REVIEW_FINDINGS_CLOSE = "</review-findings>"

#: 追加到 review 模式 system prompt 末尾的机器可读块说明。
REVIEW_FINDING_INSTRUCTION = (
    "\n\nAfter the human-readable review, append ONE machine-readable block and nothing after it:\n"
    f"{REVIEW_FINDINGS_OPEN}\n"
    '[{"severity":"P1|P2|Nit","file":"path/to/file","line":123,'
    '"title":"one line","detail":"why it matters","suggestion":"one-line fix"}]\n'
    f"{REVIEW_FINDINGS_CLOSE}\n"
    "Rules: every object MUST have severity/file/title; line is the 1-based line number in the "
    'new file (use 0 when the finding is file-wide); emit [] when there are no findings.'
)

#: 单轮最多产出条数(与 web 卡的折叠阈值无关,只防模型吐长清单把流撑爆)
MAX_FINDINGS = 100

_SEVERITY_ALIASES: dict[str, str] = {
    "p1": "P1",
    "p1-blocking": "P1",
    "blocking": "P1",
    "critical": "P1",
    "p2": "P2",
    "p2-suggested": "P2",
    "suggestion": "P2",
    "suggested": "P2",
    "minor": "P2",
    "p3": "Nit",
    "nit": "Nit",
    "nits": "Nit",
    "nitpick": "Nit",
    "info": "Nit",
}

# Markdown 兜底:标题形如 "### P1 Blocking" / "## Nits"
_SECTION_RE = re.compile(
    r"^#{2,4}\s*(P1|P2|P3|Nit|Nits)\b[^\n]*$",
    re.IGNORECASE | re.MULTILINE,
)
_BULLET_RE = re.compile(r"^\s*[-*]\s+(.+?)\s*$")
# 行锚点:path/to/file.ext:123(路径不含空白;允许 ./ 前缀与 Windows 反斜杠)
_ANCHOR_RE = re.compile(r"`?((?:\.{0,2}/)?[\w./\\@+-]+\.[A-Za-z0-9]+)`?:(\d{1,7})")


def normalize_severity(value: Any) -> str | None:
    """严重度归一;表外值返回 None(调用方丢该条,不猜档位)。"""
    if not isinstance(value, str):
        return None
    key = value.strip().lower()
    if key in _SEVERITY_ALIASES:
        return _SEVERITY_ALIASES[key]
    return None


def _coerce_line(value: Any) -> int:
    """行号归一:非数字/负数 ⇒ 0(= 未定位到行,端上只显示文件)。"""
    try:
        num = int(str(value).strip())
    except (TypeError, ValueError):
        return 0
    return num if num > 0 else 0


def _pick(obj: Mapping[str, Any], *keys: str) -> str:
    for key in keys:
        val = obj.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""


def _normalize_item(raw: Any) -> dict[str, Any] | None:
    """单条 finding 归一;缺 file/title 或严重度不可识别 ⇒ None(丢弃并计数)。"""
    if not isinstance(raw, Mapping):
        return None
    severity = normalize_severity(raw.get("severity") or raw.get("level"))
    file_path = _pick(raw, "file", "path", "filename")
    title = _pick(raw, "title", "message", "summary")
    if severity is None or not file_path or not title:
        return None
    return {
        "severity": severity,
        "file": file_path,
        "line": _coerce_line(raw.get("line") if raw.get("line") is not None else raw.get("lineNumber")),
        "title": title,
        "detail": _pick(raw, "detail", "description", "body"),
        "suggestion": _pick(raw, "suggestion", "fix", "recommendation"),
    }


def _parse_json_block(text: str) -> list[dict[str, Any]] | None:
    """解析最后一个 `<review-findings>` 块;标记缺失返回 None(交给兜底)。"""
    start = text.rfind(REVIEW_FINDINGS_OPEN)
    if start < 0:
        return None
    end = text.find(REVIEW_FINDINGS_CLOSE, start)
    body = text[start + len(REVIEW_FINDINGS_OPEN) : end if end >= 0 else len(text)]
    body = body.strip()
    # 容忍 ```json 围栏
    if body.startswith("```"):
        body = re.sub(r"^```[a-zA-Z]*\s*", "", body)
        body = re.sub(r"```\s*$", "", body).strip()
    try:
        parsed = json.loads(body)
    except (json.JSONDecodeError, ValueError):
        return []
    if isinstance(parsed, Mapping):
        parsed = parsed.get("findings")
    if not isinstance(parsed, list):
        return []
    out: list[dict[str, Any]] = []
    for item in parsed:
        norm = _normalize_item(item)
        if norm is not None:
            out.append(norm)
    return out


def _parse_markdown_fallback(text: str) -> list[dict[str, Any]]:
    """兜底:按 P1/P2/Nits 小标题切段,项目符号里取 `path:line` 锚点。"""
    sections = list(_SECTION_RE.finditer(text))
    if not sections:
        return []
    out: list[dict[str, Any]] = []
    for idx, match in enumerate(sections):
        severity = normalize_severity(match.group(1))
        if severity is None:
            continue
        body_start = match.end()
        body_end = sections[idx + 1].start() if idx + 1 < len(sections) else len(text)
        for line in text[body_start:body_end].splitlines():
            bullet = _BULLET_RE.match(line)
            if not bullet:
                continue
            content = bullet.group(1).strip()
            anchor = _ANCHOR_RE.search(content)
            if not anchor:
                continue
            title = content.replace(anchor.group(0), "").strip(" -—:：")
            if not title:
                continue
            out.append(
                {
                    "severity": severity,
                    "file": _strip_relative_prefix(anchor.group(1)),
                    "line": _coerce_line(anchor.group(2)),
                    "title": title[:200],
                    "detail": content[:600],
                    "suggestion": "",
                }
            )
    return out


def _strip_relative_prefix(path: str) -> str:
    """只剥掉相对前缀(`./` / `../`),**不动以点开头的文件名**。

    这里刻意不用 ``str.lstrip("./")``:它按字符集剥,`./.gitignore` 会被剥成
    `gitignore` —— 审查里点文件(`.gitignore` / `.env.example`)很常见,
    剥掉前导点等于把 finding 指到另一个不存在的路径上(端上点击定位必然落空)。
    """
    while path.startswith("./") or path.startswith("../"):
        path = path[2:]
    return path


def _dedupe(findings: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """同 (severity, file, line, title) 只留首条;顺序保持模型原序。"""
    seen: set[tuple[str, str, int, str]] = set()
    out: list[dict[str, Any]] = []
    for item in findings:
        key = (item["severity"], item["file"], item["line"], item["title"])
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= MAX_FINDINGS:
            break
    return out


def parse_review_findings(text: str) -> list[dict[str, Any]]:
    """从 review 输出取结构化 findings(JSON 块优先,Markdown 兜底)。"""
    if not text or not text.strip():
        return []
    parsed = _parse_json_block(text)
    findings = parsed if parsed else _parse_markdown_fallback(text)
    return _dedupe(findings)


def group_findings_by_severity(
    findings: Iterable[Mapping[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """按 P1 → P2 → Nit 分组;三档恒在(空档 = 空列表,端上据此渲染空态)。"""
    groups: dict[str, list[dict[str, Any]]] = {sev: [] for sev in REVIEW_SEVERITIES}
    for item in findings:
        severity = normalize_severity(item.get("severity"))
        if severity is None:
            continue
        groups[severity].append(dict(item))
    return groups


def build_review_finding_frames(
    text: str,
    *,
    target: str | None = None,
) -> list[dict[str, Any]]:
    """把 review 输出投影成 SSE 帧载荷列表(一 finding 一帧,顺序即渲染顺序)。"""
    findings = parse_review_findings(text)
    total = len(findings)
    frames: list[dict[str, Any]] = []
    for index, item in enumerate(findings, start=1):
        frame: dict[str, Any] = {
            "type": REVIEW_FINDING_EVENT,
            "findingId": f"rf-{index}",
            "index": index,
            "total": total,
            "severity": item["severity"],
            "file": item["file"],
            "line": item["line"],
            "title": item["title"],
            "detail": item["detail"],
            "suggestion": item["suggestion"],
        }
        if target:
            frame["target"] = target
        frames.append(frame)
    return frames


__all__ = [
    "MAX_FINDINGS",
    "REVIEW_FINDINGS_CLOSE",
    "REVIEW_FINDINGS_OPEN",
    "REVIEW_FINDING_EVENT",
    "REVIEW_FINDING_INSTRUCTION",
    "REVIEW_SEVERITIES",
    "build_review_finding_frames",
    "group_findings_by_severity",
    "normalize_severity",
    "parse_review_findings",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
