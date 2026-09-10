# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex 风格补丁引擎(纯标准库实现)。

提供:
- parse_patch(text):解析 *** Begin Patch / *** Update File / *** Add File /
  *** Delete File 格式;畸形补丁抛出 PatchParseError 且错误消息含 1-based 行号。
- apply_patch(patch, root, dry_run=False):多文件事务性应用。
  hunk 采用三级匹配策略:精确(exact)→ 忽略行尾空白(fuzzy)→
  difflib.SequenceMatcher 定位回退(bestfit);每个 hunk 记录所用策略与置信度。
- 语法校验钩子:.py 用 ast.parse、.json 用 json.loads、.ts/.js 做括号/引号
  平衡扫描;任一文件失败则整批回滚(多文件事务性)。
- CRLF/BOM 保真:读写文件按原文件的换行风格与 BOM 往返,不被补丁破坏。
"""

from __future__ import annotations

import ast
import difflib
import json
import os
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Union

PathLike = Union[str, "os.PathLike[str]"]

# ---------------------------------------------------------------------------
# 常量与异常
# ---------------------------------------------------------------------------

BEGIN_PATCH = "*** Begin Patch"
END_PATCH = "*** End Patch"
UPDATE_FILE = "*** Update File:"
ADD_FILE = "*** Add File:"
DELETE_FILE = "*** Delete File:"
END_OF_FILE = "*** End of File"

# bestfit(SequenceMatcher)回退的最低接受相似度,低于此值视为未匹配
BESTFIT_MIN_SIMILARITY = 0.6

# 各匹配策略对应的置信度
CONFIDENCE_EXACT = 1.0
CONFIDENCE_FUZZY = 0.9
CONFIDENCE_BESTFIT = 0.6


class PatchError(ValueError):
    """补丁引擎错误基类。"""


class PatchParseError(PatchError):
    """补丁文本无法解析时抛出,消息含 1-based 行号。"""


class PatchApplyError(PatchError):
    """补丁无法应用到目标文件时抛出,消息含 1-based 行号。"""


class SyntaxValidationError(PatchError):
    """补丁产物未通过语法校验时抛出,消息含 1-based 行号。"""


class MatchStrategy(StrEnum):
    """hunk 匹配策略。"""

    EXACT = "exact"
    FUZZY = "fuzzy"
    BESTFIT = "bestfit"


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class HunkLine:
    """hunk 中的单行:kind 为 'context' / 'add' / 'delete'。"""

    kind: str
    text: str


@dataclass
class Hunk:
    """单个 hunk:上下文行 + 增删行的有序序列。"""

    lines: list[HunkLine] = field(default_factory=list)

    def old_lines(self) -> list[str]:
        """hunk 在旧文件中的全部行(上下文 + 删除)。"""
        return [ln.text for ln in self.lines if ln.kind != "add"]

    def added_count(self) -> int:
        return sum(1 for ln in self.lines if ln.kind == "add")

    def deleted_count(self) -> int:
        return sum(1 for ln in self.lines if ln.kind == "delete")


@dataclass
class FilePatch:
    """单个文件的补丁意图。"""

    path: str
    kind: str  # "update" | "add" | "delete"
    hunks: list[Hunk] = field(default_factory=list)
    new_content: str | None = None  # add 时的完整新内容


@dataclass
class HunkResult:
    """单个 hunk 的匹配结果:记录策略与置信度。"""

    index: int
    strategy: MatchStrategy
    confidence: float
    position: int  # 匹配到的旧文件起始下标(0-based)
    old_len: int  # 覆盖的旧行数
    new_len: int  # 替换后的新行数


@dataclass
class FileResult:
    """单个文件的应用结果报告。"""

    path: str
    kind: str
    hunks: list[HunkResult] = field(default_factory=list)
    added: int = 0
    deleted: int = 0


@dataclass
class PatchResult:
    """整批补丁的应用/预览结果。"""

    ok: bool
    dry_run: bool
    files: list[FileResult] = field(default_factory=list)
    error: str = ""

    def to_dict(self) -> dict[str, object]:
        """转为可 JSON 序列化的 dict。"""
        return {
            "ok": self.ok,
            "dry_run": self.dry_run,
            "error": self.error,
            "files": [
                {
                    "path": f.path,
                    "kind": f.kind,
                    "added": f.added,
                    "deleted": f.deleted,
                    "hunks": [
                        {
                            "index": h.index,
                            "strategy": h.strategy.value,
                            "confidence": h.confidence,
                            "position": h.position,
                        }
                        for h in f.hunks
                    ],
                }
                for f in self.files
            ],
        }


# ---------------------------------------------------------------------------
# 补丁解析
# ---------------------------------------------------------------------------


def parse_patch(text: str) -> list[FilePatch]:
    """解析 Codex 风格补丁文本,返回 FilePatch 列表。

    畸形补丁抛出 PatchParseError,消息包含出错行的 1-based 行号。
    """
    lines = text.splitlines()
    n = len(lines)

    begin = -1
    for i, ln in enumerate(lines):
        if ln.strip() == BEGIN_PATCH:
            begin = i
            break
    if begin < 0:
        raise PatchParseError("补丁第 1 行: 缺少 '*** Begin Patch' 头")

    end = -1
    for i in range(n - 1, begin, -1):
        if lines[i].strip() == END_PATCH:
            end = i
            break
    if end < 0:
        raise PatchParseError(f"补丁第 {begin + 1} 行后: 缺少 '*** End Patch' 尾")

    patches: list[FilePatch] = []
    i = begin + 1
    while i < end:
        stripped = lines[i].strip()
        if stripped.startswith(UPDATE_FILE):
            patch, i = _parse_update(lines, i, end)
            patches.append(patch)
        elif stripped.startswith(ADD_FILE):
            patch, i = _parse_add(lines, i, end)
            patches.append(patch)
        elif stripped.startswith(DELETE_FILE):
            patch, i = _parse_delete(lines, i, end)
            patches.append(patch)
        elif stripped == "" or stripped.startswith("@@"):
            i += 1
        else:
            raise PatchParseError(f"补丁第 {i + 1} 行: 未知指令 {stripped!r}")
    if not patches:
        raise PatchParseError(f"补丁第 {begin + 1} 行后: 未找到任何文件段")
    return patches


def _parse_update(lines: list[str], start: int, end: int) -> tuple[FilePatch, int]:
    """解析 *** Update File 段,返回 (patch, 下一段起始行下标)。"""
    path = lines[start].strip()[len(UPDATE_FILE):].strip()
    if not path:
        raise PatchParseError(f"补丁第 {start + 1} 行: Update File 缺少路径")
    patch = FilePatch(path=path, kind="update")
    i = start + 1
    cur: list[HunkLine] = []
    while i < end:
        raw = lines[i]
        s = raw.strip()
        if s == END_OF_FILE:
            i += 1
            continue
        # 其他 '*** ' 标记(含未知指令)交回顶层处理
        if raw.startswith("*** "):
            break
        if s.startswith("@@"):
            if cur:
                patch.hunks.append(Hunk(lines=list(cur)))
                cur = []
            i += 1
            continue
        if raw.startswith("+"):
            cur.append(HunkLine("add", raw[1:]))
        elif raw.startswith("-"):
            cur.append(HunkLine("delete", raw[1:]))
        else:
            # 上下文行:去掉 Codex 格式的前导空格标记(空行即 " " → "")
            cur.append(HunkLine("context", raw[1:] if raw.startswith(" ") else raw))
        i += 1
    if cur:
        patch.hunks.append(Hunk(lines=cur))
    if not patch.hunks:
        raise PatchParseError(f"补丁第 {start + 1} 行: Update File {path!r} 没有任何 hunk")
    return patch, i


def _parse_add(lines: list[str], start: int, end: int) -> tuple[FilePatch, int]:
    """解析 *** Add File 段(只允许 '+' 行)。"""
    path = lines[start].strip()[len(ADD_FILE):].strip()
    if not path:
        raise PatchParseError(f"补丁第 {start + 1} 行: Add File 缺少路径")
    body: list[str] = []
    i = start + 1
    while i < end:
        raw = lines[i]
        s = raw.strip()
        if s == END_OF_FILE:
            i += 1
            continue
        if raw.startswith("*** "):
            break
        if raw.startswith("+"):
            body.append(raw[1:])
        else:
            raise PatchParseError(
                f"补丁第 {i + 1} 行: Add File 段只允许 '+' 行,得到 {raw!r}"
            )
        i += 1
    if not body:
        raise PatchParseError(f"补丁第 {start + 1} 行: Add File {path!r} 内容为空")
    content = "\n".join(body) + "\n"
    return FilePatch(path=path, kind="add", new_content=content), i


def _parse_delete(lines: list[str], start: int, end: int) -> tuple[FilePatch, int]:
    """解析 *** Delete File 段(可携带 '-' 行,仅跳过)。"""
    path = lines[start].strip()[len(DELETE_FILE):].strip()
    if not path:
        raise PatchParseError(f"补丁第 {start + 1} 行: Delete File 缺少路径")
    i = start + 1
    while i < end and not lines[i].startswith("*** "):
        i += 1
    return FilePatch(path=path, kind="delete"), i


# ---------------------------------------------------------------------------
# 换行 / BOM 保真读取
# ---------------------------------------------------------------------------


def _detect_newline(raw: bytes) -> str:
    """嗅探字节流的换行风格:CRLF 优先,默认 LF。"""
    return "\r\n" if b"\r\n" in raw else "\n"


def _read_text(path: Path) -> tuple[str, str, bool]:
    """读取文本文件,返回 (LF 归一内容, 原换行风格, 是否含 BOM)。

    换行统一归一为 LF 参与匹配计算,写回时按原风格还原,保证 CRLF/BOM 保真。
    """
    raw = path.read_bytes()
    has_bom = raw.startswith(b"\xef\xbb\xbf")
    if has_bom:
        raw = raw[3:]
    newline = _detect_newline(raw)
    text = raw.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
    return text, newline, has_bom


def _encode_text(text: str, newline: str, has_bom: bool) -> bytes:
    """按原换行风格与 BOM 编码文本。"""
    out = text.replace("\n", newline)
    data = out.encode("utf-8")
    return b"\xef\xbb\xbf" + data if has_bom else data


# ---------------------------------------------------------------------------
# 路径安全(root 沙箱)
# ---------------------------------------------------------------------------


def _resolve_in_root(root: Path, relpath: str) -> Path:
    """把补丁声明的路径解析到 root 之下,拒绝越界与绝对路径。"""
    p = Path(relpath)
    if p.is_absolute() or ".." in p.parts:
        raise PatchApplyError(f"非法路径(越出 root): {relpath!r}")
    full = (root / p).resolve()
    root_resolved = root.resolve()
    if full != root_resolved and root_resolved not in full.parents:
        raise PatchApplyError(f"非法路径(越出 root): {relpath!r}")
    return full


# ---------------------------------------------------------------------------
# hunk 三级匹配:精确 → fuzzy(忽略行尾空白)→ SequenceMatcher 定位回退
# ---------------------------------------------------------------------------


def _apply_hunk_lines(hunk: Hunk, window: list[str]) -> list[str]:
    """把 hunk 的行序列作用到一段旧行窗口上,生成替换行。

    上下文行取文件原内容(而非补丁声明内容),保证 fuzzy/bestfit 下保真。
    """
    new_lines: list[str] = []
    pos = 0
    for hl in hunk.lines:
        if hl.kind == "context":
            new_lines.append(window[pos])
            pos += 1
        elif hl.kind == "delete":
            pos += 1
        else:  # add
            new_lines.append(hl.text)
    return new_lines


def _match_at(
    old_lines: list[str], hunk: Hunk, pos: int, *, fuzzy: bool
) -> list[str] | None:
    """尝试在 pos 处匹配 hunk 的旧行(context+delete);失败返回 None。

    fuzzy=True 时比较忽略行尾空白,但替换结果保留原文件行内容(保真)。
    """
    old = hunk.old_lines()
    if pos < 0 or pos + len(old) > len(old_lines):
        return None
    window = old_lines[pos:pos + len(old)]
    for want, have in zip(old, window, strict=False):
        if fuzzy:
            if want.rstrip() != have.rstrip():
                return None
        elif want != have:
            return None
    return _apply_hunk_lines(hunk, window)


def _bestfit_match(
    old_lines: list[str], hunk: Hunk, hint: int
) -> tuple[int | None, float]:
    """用 difflib.SequenceMatcher 在全文滑动窗口中定位 hunk 旧行的最佳位置。

    返回 (0-based 起始下标或 None, 相似度);相似度低于阈值视为未匹配。
    """
    old = hunk.old_lines()
    if not old or len(old) > len(old_lines):
        return None, 0.0
    target = [ln.rstrip() for ln in old]
    stripped = [ln.rstrip() for ln in old_lines]
    best_ratio = 0.0
    best_pos: int | None = None
    for pos in range(0, len(old_lines) - len(old) + 1):
        window = stripped[pos:pos + len(old)]
        ratio = difflib.SequenceMatcher(a=window, b=target, autojunk=False).ratio()
        if ratio > best_ratio or (
            ratio == best_ratio
            and best_pos is not None
            and abs(pos - hint) < abs(best_pos - hint)
        ):
            best_ratio = ratio
            best_pos = pos
    if best_pos is not None and best_ratio >= BESTFIT_MIN_SIMILARITY:
        return best_pos, best_ratio
    return None, best_ratio


def _match_hunk(
    old_lines: list[str], hunk: Hunk, hint: int
) -> tuple[int, list[str], MatchStrategy, float]:
    """在 old_lines 中为 hunk 定位并给出替换行。

    三级策略依次尝试:
    1. exact:在 hint 处精确匹配,失败则全文扫描精确匹配;
    2. fuzzy:忽略行尾空白匹配(hint 附近窗口 → 全文);
    3. bestfit:difflib.SequenceMatcher 全文定位回退(按相似度打分)。
    返回 (起始下标, 替换后的新行, 策略, 置信度)。
    """
    # 策略 1:精确
    res = _match_at(old_lines, hunk, hint, fuzzy=False)
    if res is not None:
        return hint, res, MatchStrategy.EXACT, CONFIDENCE_EXACT
    for pos in range(len(old_lines) + 1):
        if pos == hint:
            continue
        res = _match_at(old_lines, hunk, pos, fuzzy=False)
        if res is not None:
            return pos, res, MatchStrategy.EXACT, CONFIDENCE_EXACT

    # 策略 2:fuzzy(忽略行尾空白)——先扫 hint 附近,再扫全文
    lo = max(0, hint - 3)
    hi = min(len(old_lines), hint + 3)
    for pos in range(lo, hi + 1):
        res = _match_at(old_lines, hunk, pos, fuzzy=True)
        if res is not None:
            return pos, res, MatchStrategy.FUZZY, CONFIDENCE_FUZZY
    for pos in range(len(old_lines) + 1):
        if lo <= pos <= hi:
            continue
        res = _match_at(old_lines, hunk, pos, fuzzy=True)
        if res is not None:
            return pos, res, MatchStrategy.FUZZY, CONFIDENCE_FUZZY

    # 策略 3:SequenceMatcher 定位回退
    bf_pos, ratio = _bestfit_match(old_lines, hunk, hint)
    if bf_pos is not None:
        confidence = round(min(1.0, max(BESTFIT_MIN_SIMILARITY, ratio)), 4)
        window = old_lines[bf_pos:bf_pos + len(hunk.old_lines())]
        return bf_pos, _apply_hunk_lines(hunk, window), MatchStrategy.BESTFIT, confidence

    raise PatchApplyError(
        f"目标文件第 {hint + 1} 行附近: hunk 无法匹配"
        f"(最佳相似度 {ratio:.2f} < {BESTFIT_MIN_SIMILARITY})"
    )


# ---------------------------------------------------------------------------
# 文件级应用
# ---------------------------------------------------------------------------


def _split_lines(text: str) -> list[str]:
    """按行拆分(保留行内容,丢弃换行符);空文本返回空列表。"""
    if text == "":
        return []
    return text.split("\n")


def _apply_update(old_text: str, patch: FilePatch) -> tuple[str, list[HunkResult]]:
    """把 update 补丁应用到旧文本(LF 归一),返回 (新文本, hunk 结果)。"""
    lines = _split_lines(old_text)
    results: list[HunkResult] = []
    anchor = 0  # 上一 hunk 结束位置,作为下一 hunk 的搜索锚点
    for idx, hunk in enumerate(patch.hunks):
        pos, new_seg, strategy, conf = _match_hunk(lines, hunk, anchor)
        old_len = len(hunk.old_lines())
        lines[pos:pos + old_len] = new_seg
        results.append(
            HunkResult(
                index=idx,
                strategy=strategy,
                confidence=conf,
                position=pos,
                old_len=old_len,
                new_len=len(new_seg),
            )
        )
        anchor = pos + len(new_seg)
    return "\n".join(lines), results


# ---------------------------------------------------------------------------
# 语法校验钩子
# ---------------------------------------------------------------------------


def _validate_py(text: str, path: str) -> None:
    """Python 语法校验:ast.parse;失败抛 SyntaxValidationError(含行号)。"""
    try:
        ast.parse(text, filename=path)
    except SyntaxError as e:
        lineno = e.lineno if e.lineno is not None else 1
        raise SyntaxValidationError(
            f"{path} 第 {lineno} 行: Python 语法错误: {e.msg}"
        ) from None


def _validate_json(text: str, path: str) -> None:
    """JSON 语法校验:json.loads;失败时换算出行号。"""
    try:
        json.loads(text)
    except json.JSONDecodeError as e:
        raise SyntaxValidationError(
            f"{path} 第 {e.lineno} 行: JSON 语法错误: {e.msg}"
        ) from None


def _validate_ts_js(text: str, path: str) -> None:
    """TS/JS 括号与引号平衡扫描(忽略字符串/模板串/注释内部)。"""
    pairs = {"(": ")", "[": "]", "{": "}"}
    closing = {")": "(", "]": "[", "}": "{"}
    stack: list[tuple[str, int]] = []
    in_line_comment = False
    in_block_comment = False
    quote: str | None = None
    lineno = 1
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if ch == "\n":
            if quote is not None and quote != "`":
                raise SyntaxValidationError(
                    f"{path} 第 {lineno} 行: 字符串引号未闭合"
                )
            if quote is None:
                pass  # 行内普通状态保持
            lineno += 1
            in_line_comment = False
            i += 1
            continue
        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
        if in_line_comment:
            i += 1
            continue
        if quote is not None:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue
        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            continue
        if ch in pairs:
            stack.append((ch, lineno))
        elif ch in closing:
            if not stack or stack[-1][0] != closing[ch]:
                raise SyntaxValidationError(
                    f"{path} 第 {lineno} 行: 括号 {ch!r} 不匹配"
                )
            stack.pop()
        i += 1
    if quote is not None and quote != "`":
        raise SyntaxValidationError(f"{path} 第 {lineno} 行: 引号 {quote!r} 未闭合")
    if stack:
        opener, line = stack[-1]
        raise SyntaxValidationError(f"{path} 第 {line} 行: 括号 {opener!r} 未闭合")


_VALIDATORS: dict[str, Callable[[str, str], None]] = {
    ".py": _validate_py,
    ".json": _validate_json,
    ".ts": _validate_ts_js,
    ".js": _validate_ts_js,
}


def validate_syntax(path: str, text: str) -> None:
    """按扩展名分发语法校验钩子;未知扩展名直接通过。"""
    validator = _VALIDATORS.get(Path(path).suffix.lower())
    if validator is not None:
        validator(text, path)


# ---------------------------------------------------------------------------
# 事务性应用入口
# ---------------------------------------------------------------------------


@dataclass
class _FileChange:
    """单文件变更计划:写前快照 + 目标新内容(None=删除)。"""

    path: str
    full: Path
    before: bytes | None
    after: bytes | None
    result: FileResult


def _plan_file(root: Path, patch: FilePatch) -> _FileChange:
    """计算单个文件的变更计划(不落盘);校验失败在此抛错。"""
    full = _resolve_in_root(root, patch.path)
    result = FileResult(path=patch.path, kind=patch.kind)
    existed = full.exists()
    before = full.read_bytes() if existed else None

    if patch.kind == "delete":
        if not existed:
            raise PatchApplyError(f"{patch.path}: 待删除文件不存在")
        return _FileChange(patch.path, full, before, None, result)

    if patch.kind == "add":
        if existed:
            raise PatchApplyError(f"{patch.path}: Add File 目标已存在")
        assert patch.new_content is not None
        # 新文件默认 LF、无 BOM
        out = patch.new_content.replace("\r\n", "\n")
        validate_syntax(patch.path, out)
        body = _split_lines(out)
        result.added = len(body) - 1 if body and body[-1] == "" else len(body)
        return _FileChange(patch.path, full, before, out.encode("utf-8"), result)

    # update
    if not existed:
        raise PatchApplyError(f"{patch.path}: Update File 目标不存在")
    old_text, newline, has_bom = _read_text(full)
    new_text, hunk_results = _apply_update(old_text, patch)
    result.hunks = hunk_results
    result.added = sum(h.added_count() for h in patch.hunks)
    result.deleted = sum(h.deleted_count() for h in patch.hunks)
    validate_syntax(patch.path, new_text)
    return _FileChange(patch.path, full, before, _encode_text(new_text, newline, has_bom), result)


def _rollback(changes: list[_FileChange]) -> None:
    """把已落盘的文件恢复为写前快照(原本不存在则删除)。"""
    for ch in reversed(changes):
        try:
            if ch.before is None:
                ch.full.unlink(missing_ok=True)
            else:
                ch.full.parent.mkdir(parents=True, exist_ok=True)
                with open(ch.full, "wb") as fh:
                    fh.write(ch.before)
        except OSError:
            pass


def _commit(changes: list[_FileChange]) -> None:
    """落盘全部变更;中途失败时回滚已写入的文件。"""
    done: list[_FileChange] = []
    try:
        for ch in changes:
            if ch.after is None:
                ch.full.unlink(missing_ok=True)
            else:
                ch.full.parent.mkdir(parents=True, exist_ok=True)
                with open(ch.full, "wb") as fh:
                    fh.write(ch.after)
            done.append(ch)
    except BaseException:
        _rollback(done)
        raise


def apply_patch(
    patch: str | list[FilePatch],
    root: PathLike,
    *,
    dry_run: bool = False,
) -> PatchResult:
    """把 Codex 风格补丁事务性地应用到 root 目录。

    - patch 可以是补丁文本(内部先 parse_patch)或已解析的 FilePatch 列表。
    - dry_run=True 时只做匹配计算与语法校验并返回预览结果,不写盘。
    - 任一文件失败(解析/匹配/校验)则整批不落盘(多文件事务性),返回
      ok=False 且 error 含行号信息;成功时 files 逐文件记录 hunk 策略与置信度。
    """
    root_path = Path(root)
    try:
        patches = parse_patch(patch) if isinstance(patch, str) else list(patch)
        changes = [_plan_file(root_path, p) for p in patches]
    except PatchError as e:
        return PatchResult(ok=False, dry_run=dry_run, error=str(e))

    if not dry_run:
        try:
            _commit(changes)
        except OSError as e:
            return PatchResult(ok=False, dry_run=False, error=f"写入失败(已回滚): {e}")
    return PatchResult(ok=True, dry_run=dry_run, files=[ch.result for ch in changes])
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
