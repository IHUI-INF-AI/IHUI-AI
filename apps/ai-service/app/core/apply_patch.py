# app/core/apply_patch.py
"""apply_patch 补丁格式解析与应用纯算法 — 2026-09-19 第三十三批,对标 Codex
apply-patch crate(parser.rs / streaming_parser.rs / seek_sequence.rs / file_update.rs /
text_file.rs,共约 2200 行核心)。

Lark 官方文法:
    start: begin_patch environment_id? hunk+ end_patch
    begin_patch: "*** Begin Patch" LF
    environment_id: "*** Environment ID: " filename LF
    end_patch: "*** End Patch" LF?
    hunk: "*** Add File: " path LF ("+" line)+ | "*** Delete File: " path |
          "*** Update File: " path LF change_move? change+
    change_move: "*** Move to: " path
    change: ("@@" | "@@ " ctx) | (" "|"+"|"-") line | "*** End of File"

移植范围:
- 流式解析器 StreamingPatchParser:逐字符 push_delta(行缓冲,\r\n 归一)、六态状态机
  (NotStarted/StartedPatch/AddFile/DeleteFile/UpdateFile/EndedPatch)、environment_id
  幂等与空值校验、UpdateFile 空 hunk 拒绝、EOF 后仅容空白、无尾换行的 finish 语义;
- parse_patch:strict/lenient 两模式;lenient 剥 GPT-4.1 风格 heredoc(<<'EOF' ... EOF,
  至少 4 行)后再走严格边界检查;
- seek_sequence 四级递降匹配:精确 → rstrip → trim → Unicode 标点归一(各类连字符/
  弯引号/不间断空格 → ASCII;对齐 git apply 模糊上下文);eof 时优先从文件尾起匹配
  (PreserveLineEndings 下不越过 start);
- compute_replacements:change_context 定位推进 line_index、空 old_lines 插入语义、
  尾部空行哨兵重试、NormalizeToLf / PreserveLineEndings(按 context_line_indices
  保留原始行尾)两模式;apply_replacements 降序应用防位移;
- SourceFile:逐行解析保留 LF/CRLF/CR 行尾,首选行尾用于插入行,行尾补齐
  (apply-patch 历史行为:更新后必有尾换行);
- derive_new_contents_from_chunks 纯化版:original_contents 文本进出,不做文件 IO。

判定跳过(耦合证据):
- derive_new_contents_from_chunks 的 fs/sandbox/symlink 参数:执行器文件系统抽象;
- invocation.rs(工具调用参数装配)/standalone_executable.rs(CLI 进程):进程边界;
- unified_diff_from_chunks 系列展示层 diff 生成:非应用路径必需。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Union

BEGIN_PATCH_MARKER = "*** Begin Patch"
END_PATCH_MARKER = "*** End Patch"
ADD_FILE_MARKER = "*** Add File: "
DELETE_FILE_MARKER = "*** Delete File: "
UPDATE_FILE_MARKER = "*** Update File: "
MOVE_TO_MARKER = "*** Move to: "
EOF_MARKER = "*** End of File"
CHANGE_CONTEXT_MARKER = "@@ "
EMPTY_CHANGE_CONTEXT_MARKER = "@@"
ENVIRONMENT_ID_MARKER = "*** Environment ID:"

PARSE_IN_STRICT_MODE = False


class ParseError(ValueError):
    """补丁解析错误(kind=invalid_patch / invalid_hunk)。"""

    def __init__(self, message: str, kind: str = "invalid_patch", line_number: int = 0) -> None:
        super().__init__(message)
        self.kind = kind
        self.line_number = line_number

    @classmethod
    def invalid_patch(cls, message: str) -> "ParseError":
        return cls(message, kind="invalid_patch")

    @classmethod
    def invalid_hunk(cls, message: str, line_number: int) -> "ParseError":
        return cls(message, kind="invalid_hunk", line_number=line_number)


@dataclass
class AddFileHunk:
    path: str
    contents: str = ""


@dataclass
class DeleteFileHunk:
    path: str


@dataclass
class UpdateFileHunk:
    path: str
    move_path: Optional[str] = None
    chunks: list["UpdateFileChunk"] = field(default_factory=list)

    def affected_path(self) -> str:
        """受影响路径;重命名 hunk 取 move 目的地。"""
        return self.move_path if self.move_path is not None else self.path


Hunk = Union[AddFileHunk, DeleteFileHunk, UpdateFileHunk]


@dataclass
class UpdateFileChunk:
    """更新块:change_context 缩小定位;old→new 替换;context_line_indices 记录
    双侧同源上下文行索引(PreserveLineEndings 保留原行尾用);is_end_of_file 要求
    old_lines 必须出现在文件末尾(容忍尾换行差异)。"""

    change_context: Optional[str] = None
    old_lines: list[str] = field(default_factory=list)
    new_lines: list[str] = field(default_factory=list)
    context_line_indices: list[tuple[int, int]] = field(default_factory=list)
    is_end_of_file: bool = False

    def push_context_line(self, line: str) -> None:
        self.context_line_indices.append((len(self.old_lines), len(self.new_lines)))
        self.old_lines.append(line)
        self.new_lines.append(line)


@dataclass
class ApplyPatchArgs:
    hunks: list[Hunk]
    patch: str
    workdir: Optional[str] = None
    environment_id: Optional[str] = None


# ---------------------------------------------------------------------------
# 流式解析器(对标 streaming_parser.rs)
# ---------------------------------------------------------------------------

class StreamingPatchParser:
    """逐字符喂入、按行处理的有状态解析器;push_delta 可分片(流式输出场景)。"""

    def __init__(self) -> None:
        self._line_buffer: list[str] = []
        self._hunks: list[Hunk] = []
        self._environment_id: Optional[str] = None
        self._mode = "not_started"  # not_started/started_patch/add_file/delete_file/update_file/ended_patch
        self._hunk_line_number = 0
        self.line_number = 0

    def environment_id(self) -> Optional[str]:
        return self._environment_id

    def hunks(self) -> list[Hunk]:
        return self._hunks

    def _ensure_update_hunk_is_not_empty(self, line_number: int) -> None:
        last = self._hunks[-1] if self._hunks else None
        if (
            isinstance(last, UpdateFileHunk)
            and not last.chunks
            and self._mode == "update_file"
        ):
            raise ParseError.invalid_hunk(
                f"Update file hunk for path '{last.path}' is empty", self._hunk_line_number
            )

    def _handle_hunk_headers_and_end_patch(self, trimmed: str) -> bool:
        if self._mode == "started_patch" and trimmed.startswith(ENVIRONMENT_ID_MARKER):
            if self._environment_id is not None:
                raise ParseError.invalid_patch(
                    "apply_patch environment_id cannot be specified more than once"
                )
            environment_id = trimmed[len(ENVIRONMENT_ID_MARKER):].strip()
            if not environment_id:
                raise ParseError.invalid_patch("apply_patch environment_id cannot be empty")
            self._environment_id = environment_id
            return True
        if trimmed == END_PATCH_MARKER:
            self._ensure_update_hunk_is_not_empty(self.line_number)
            self._mode = "ended_patch"
            return True
        if trimmed.startswith(ADD_FILE_MARKER):
            self._ensure_update_hunk_is_not_empty(self.line_number)
            self._hunks.append(AddFileHunk(path=trimmed[len(ADD_FILE_MARKER):]))
            self._mode = "add_file"
            return True
        if trimmed.startswith(DELETE_FILE_MARKER):
            self._ensure_update_hunk_is_not_empty(self.line_number)
            self._hunks.append(DeleteFileHunk(path=trimmed[len(DELETE_FILE_MARKER):]))
            self._mode = "delete_file"
            return True
        if trimmed.startswith(UPDATE_FILE_MARKER):
            self._ensure_update_hunk_is_not_empty(self.line_number)
            self._hunks.append(UpdateFileHunk(path=trimmed[len(UPDATE_FILE_MARKER):]))
            self._mode = "update_file"
            self._hunk_line_number = self.line_number
            return True
        return False

    def push_delta(self, delta: str) -> list[Hunk]:
        """喂入增量;遇换行即处理整行(\r\n 的 \r 归一剥离)。返回当前已解析 hunks 快照。"""
        for ch in delta:
            if ch == "\n":
                line = "".join(self._line_buffer)
                self._line_buffer = []
                if line.endswith("\r"):
                    line = line[:-1]
                self.line_number += 1
                self._process_line(line)
            else:
                self._line_buffer.append(ch)
        return self._hunks

    def finish(self) -> list[Hunk]:
        """收尾:无尾换行的最后一行入处理;必须以 End Patch 结束。"""
        if self._line_buffer:
            line = "".join(self._line_buffer)
            self._line_buffer = []
            self.line_number += 1
            if line.strip() == END_PATCH_MARKER:
                self._ensure_update_hunk_is_not_empty(self.line_number)
                self._mode = "ended_patch"
            else:
                self._process_line(line)
        if self._mode != "ended_patch":
            raise ParseError.invalid_patch("The last line of the patch must be '*** End Patch'")
        return self._hunks

    def _process_line(self, line: str) -> None:
        trimmed = line.strip()
        if self._mode == "not_started":
            if trimmed == BEGIN_PATCH_MARKER:
                self._mode = "started_patch"
                return
            raise ParseError.invalid_patch("The first line of the patch must be '*** Begin Patch'")
        if self._mode == "started_patch":
            if self._handle_hunk_headers_and_end_patch(trimmed):
                return
            raise ParseError.invalid_hunk(
                f"'{trimmed}' is not a valid hunk header. Valid hunk headers: "
                "'*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'",
                self.line_number,
            )
        if self._mode == "add_file":
            if self._handle_hunk_headers_and_end_patch(trimmed):
                return
            if line.startswith("+") and isinstance(self._hunks[-1], AddFileHunk):
                self._hunks[-1].contents += line[1:] + "\n"
                return
            raise ParseError.invalid_hunk(
                f"'{trimmed}' is not a valid hunk header. Valid hunk headers: "
                "'*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'",
                self.line_number,
            )
        if self._mode == "delete_file":
            if self._handle_hunk_headers_and_end_patch(trimmed):
                return
            raise ParseError.invalid_hunk(
                f"'{trimmed}' is not a valid hunk header. Valid hunk headers: "
                "'*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'",
                self.line_number,
            )
        if self._mode == "update_file":
            self._process_update_file_line(line, trimmed)
            return
        # ended_patch:仅容空白
        if trimmed:
            raise ParseError.invalid_patch("The last line of the patch must be '*** End Patch'")

    def _process_update_file_line(self, line: str, trimmed: str) -> None:
        update_line = line.rstrip()
        if self._handle_hunk_headers_and_end_patch(update_line):
            return
        hunk = self._hunks[-1]
        assert isinstance(hunk, UpdateFileHunk)
        chunks = hunk.chunks

        def last_is_empty_chunk() -> bool:
            return bool(chunks) and not chunks[-1].old_lines and not chunks[-1].new_lines

        if chunks and chunks[-1].is_end_of_file:
            if not update_line:
                return
            if update_line != EMPTY_CHANGE_CONTEXT_MARKER and not update_line.startswith(
                CHANGE_CONTEXT_MARKER
            ):
                raise ParseError.invalid_hunk(
                    f"Expected update hunk to start with a @@ context marker, got: '{line}'",
                    self.line_number,
                )
        if not chunks and hunk.move_path is None and update_line.startswith(MOVE_TO_MARKER):
            hunk.move_path = update_line[len(MOVE_TO_MARKER):]
            return
        if (update_line == EMPTY_CHANGE_CONTEXT_MARKER or update_line.startswith(CHANGE_CONTEXT_MARKER)) and last_is_empty_chunk():
            raise ParseError.invalid_hunk(
                f"Unexpected line found in update hunk: '{line}'. Every line should start with "
                "' ' (context line), '+' (added line), or '-' (removed line)",
                self.line_number,
            )
        if update_line == EMPTY_CHANGE_CONTEXT_MARKER:
            chunks.append(UpdateFileChunk())
            return
        if update_line.startswith(CHANGE_CONTEXT_MARKER):
            chunks.append(UpdateFileChunk(change_context=update_line[len(CHANGE_CONTEXT_MARKER):]))
            return
        if update_line == EOF_MARKER:
            if last_is_empty_chunk():
                raise ParseError.invalid_hunk(
                    "Update hunk does not contain any lines", self.line_number
                )
            if chunks:
                chunks[-1].is_end_of_file = True
            return
        if not line:
            if not chunks:
                chunks.append(UpdateFileChunk())
            chunks[-1].push_context_line("")
            return
        if line.startswith(" "):
            if not chunks:
                chunks.append(UpdateFileChunk())
            chunks[-1].push_context_line(line[1:])
            return
        if line.startswith("+"):
            if not chunks:
                chunks.append(UpdateFileChunk())
            chunks[-1].new_lines.append(line[1:])
            return
        if line.startswith("-"):
            if not chunks:
                chunks.append(UpdateFileChunk())
            chunks[-1].old_lines.append(line[1:])
            return
        if chunks and (chunks[-1].old_lines or chunks[-1].new_lines):
            raise ParseError.invalid_hunk(
                f"Expected update hunk to start with a @@ context marker, got: '{line}'",
                self.line_number,
            )
        raise ParseError.invalid_hunk(
            f"Unexpected line found in update hunk: '{line}'. Every line should start with "
            "' ' (context line), '+' (added line), or '-' (removed line)",
            self.line_number,
        )


# ---------------------------------------------------------------------------
# 边界检查与 parse_patch 入口(对标 parser.rs)
# ---------------------------------------------------------------------------

def _check_start_and_end_lines_strict(first_line: Optional[str], last_line: Optional[str]) -> None:
    first = first_line.strip() if first_line is not None else None
    last = last_line.strip() if last_line is not None else None
    if first is not None and last is not None and first == BEGIN_PATCH_MARKER and last == END_PATCH_MARKER:
        return
    if first != BEGIN_PATCH_MARKER:
        raise ParseError.invalid_patch("The first line of the patch must be '*** Begin Patch'")
    raise ParseError.invalid_patch("The last line of the patch must be '*** End Patch'")


def _check_patch_boundaries_strict(lines: list[str]) -> list[str]:
    if lines:
        _check_start_and_end_lines_strict(lines[0], lines[-1])
    else:
        _check_start_and_end_lines_strict(None, None)
    return lines


def _check_patch_boundaries_lenient(original_lines: list[str]) -> list[str]:
    try:
        return _check_patch_boundaries_strict(original_lines)
    except ParseError as original_parse_error:
        if len(original_lines) >= 4:
            first, last = original_lines[0], original_lines[-1]
            if first in ("<<EOF", "<<'EOF'", '<<"EOF"') and last.endswith("EOF"):
                inner = original_lines[1:-1]
                return _check_patch_boundaries_strict(inner)
        raise original_parse_error from None


def parse_patch_text(patch: str, strict: bool) -> ApplyPatchArgs:
    lines = patch.strip().split("\n") if patch.strip() else [""]
    if not patch.strip():
        lines = []
    patch_lines = (
        _check_patch_boundaries_strict(lines) if strict else _check_patch_boundaries_lenient(lines)
    )
    patch_text = "\n".join(patch_lines)
    parser = StreamingPatchParser()
    parser.push_delta(patch_text)
    hunks = parser.finish()
    return ApplyPatchArgs(hunks=hunks, patch=patch_text, environment_id=parser.environment_id())


def parse_patch(patch: str) -> ApplyPatchArgs:
    return parse_patch_text(patch, strict=PARSE_IN_STRICT_MODE)


# ---------------------------------------------------------------------------
# seek_sequence(对标 seek_sequence.rs)
# ---------------------------------------------------------------------------

_UNICODE_DASHES = dict.fromkeys(map(ord, "\u2010\u2011\u2012\u2013\u2014\u2015\u2212"), "-")
_UNICODE_SINGLE_QUOTES = dict.fromkeys(map(ord, "\u2018\u2019\u201A\u201B"), "'")
_UNICODE_DOUBLE_QUOTES = dict.fromkeys(map(ord, "\u201C\u201D\u201E\u201F"), '"')
_UNICODE_SPACES = dict.fromkeys(
    map(ord, "\u00A0\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000"), " "
)
_NORMALISE_TABLE = {**_UNICODE_DASHES, **_UNICODE_SINGLE_QUOTES, **_UNICODE_DOUBLE_QUOTES, **_UNICODE_SPACES}


def _normalise(s: str) -> str:
    return s.strip().translate(_NORMALISE_TABLE)


def seek_sequence(
    lines: list[str],
    pattern: list[str],
    start: int,
    eof: bool,
    normalize_to_lf: bool = True,
) -> Optional[int]:
    """四级递降匹配(pattern 行序列在 lines 中的起始索引):精确 → rstrip → trim →
    Unicode 归一。eof 时优先从文件尾起匹配;PreserveLineEndings(normalize_to_lf=False)
    下不越过 start。空 pattern 视为 no-op 命中 start。"""
    if not pattern:
        return start
    if len(pattern) > len(lines):
        return None
    if eof and len(lines) >= len(pattern):
        eof_start = len(lines) - len(pattern)
        search_start = eof_start if normalize_to_lf else max(eof_start, start)
    else:
        search_start = start
    last_possible = len(lines) - len(pattern)

    for i in range(search_start, last_possible + 1):
        if lines[i : i + len(pattern)] == pattern:
            return i
    for i in range(search_start, last_possible + 1):
        if all(lines[i + j].rstrip() == pat.rstrip() for j, pat in enumerate(pattern)):
            return i
    for i in range(search_start, last_possible + 1):
        if all(lines[i + j].strip() == pat.strip() for j, pat in enumerate(pattern)):
            return i
    for i in range(search_start, last_possible + 1):
        if all(_normalise(lines[i + j]) == _normalise(pat) for j, pat in enumerate(pattern)):
            return i
    return None


# ---------------------------------------------------------------------------
# SourceFile / 替换计算(对标 text_file.rs + file_update.rs)
# ---------------------------------------------------------------------------

Replacement = tuple[int, int, list[str]]


class SourceFile:
    """逐行保留行尾(LF/CRLF/CR)的源文件模型;首个出现的行尾为插入行首选样式。"""

    def __init__(self, lines: list[tuple[str, Optional[str]]], preferred_ending: str) -> None:
        self._lines = lines  # (text, ending or None)
        self._preferred_ending = preferred_ending

    @classmethod
    def parse(cls, contents: str) -> "SourceFile":
        lines: list[tuple[str, Optional[str]]] = []
        preferred: Optional[str] = None
        line_start = 0
        cursor = 0
        n = len(contents)
        while cursor < n:
            ch = contents[cursor]
            if ch == "\r" and cursor + 1 < n and contents[cursor + 1] == "\n":
                ending, ending_len = "\r\n", 2
            elif ch == "\r":
                ending, ending_len = "\r", 1
            elif ch == "\n":
                ending, ending_len = "\n", 1
            else:
                cursor += 1
                continue
            if preferred is None:
                preferred = ending
            lines.append((contents[line_start:cursor], ending))
            cursor += ending_len
            line_start = cursor
        if line_start < n:
            lines.append((contents[line_start:], None))
        return cls(lines, preferred if preferred is not None else "\n")

    def line_texts(self) -> list[str]:
        return [text for text, _ in self._lines]

    def apply_replacements(self, replacements: list[Replacement]) -> None:
        """按替换表重建;未动行保留原行尾,插入行用首选行尾,末尾行尾补齐(历史行为)。"""
        new_lines: list[tuple[str, Optional[str]]] = []
        source_index = 0
        for start_idx, old_len, new_segment in replacements:
            for line in self._lines[source_index:start_idx]:
                new_lines.append(line)
            source_index = start_idx
            self._lines = self._lines[source_index + old_len :]
            source_index = start_idx + old_len
            new_lines.extend((text, self._preferred_ending) for text in new_segment)
        new_lines.extend(self._lines)
        self._lines = [(text, ending if ending is not None else self._preferred_ending) for text, ending in new_lines]

    def into_contents(self) -> str:
        parts: list[str] = []
        for text, ending in self._lines:
            parts.append(text)
            if ending is not None:
                parts.append(ending)
        return "".join(parts)


def compute_replacements(
    original_lines: list[str],
    path: str,
    chunks: list[UpdateFileChunk],
    normalize_to_lf: bool = True,
) -> list[Replacement]:
    """把 chunks 换算为 (start_index, old_len, new_lines) 替换表(排序后返回)。

    change_context 用 seek_sequence 定位并推进 line_index;空 old_lines 按模式选插入点;
    尾部空行哨兵(代表文件末换行)匹配失败时剔除重试;PreserveLineEndings 按上下文索引
    分段保留原始行。找不到目标行抛 ValueError(ComputeReplacements 语义)。"""
    replacements: list[Replacement] = []
    line_index = 0
    for chunk in chunks:
        if chunk.change_context is not None:
            idx = seek_sequence(
                original_lines, [chunk.change_context], line_index, False, normalize_to_lf
            )
            if idx is None:
                raise ValueError(f"Failed to find context '{chunk.change_context}' in {path}")
            line_index = idx + 1
        if not chunk.old_lines:
            if normalize_to_lf:
                insertion_idx = len(original_lines) - 1 if (original_lines and not original_lines[-1]) else len(original_lines)
            else:
                insertion_idx = len(original_lines)
            replacements.append((insertion_idx, 0, list(chunk.new_lines)))
            continue

        pattern = list(chunk.old_lines)
        new_slice = list(chunk.new_lines)
        found = seek_sequence(original_lines, pattern, line_index, chunk.is_end_of_file, normalize_to_lf)
        if found is None and pattern and not pattern[-1]:
            pattern = pattern[:-1]
            if new_slice and not new_slice[-1]:
                new_slice = new_slice[:-1]
            found = seek_sequence(original_lines, pattern, line_index, chunk.is_end_of_file, normalize_to_lf)

        if found is None:
            raise ValueError(
                f"Failed to find expected lines in {path}:\n" + "\n".join(chunk.old_lines)
            )
        start_idx = found
        if normalize_to_lf:
            replacements.append((start_idx, len(pattern), new_slice))
        else:
            old_start = 0
            new_start = 0
            for old_context, new_context in chunk.context_line_indices:
                if old_context >= len(pattern) or new_context >= len(new_slice):
                    break
                if old_start != old_context or new_start != new_context:
                    replacements.append(
                        (start_idx + old_start, old_context - old_start, new_slice[new_start:new_context])
                    )
                old_start = old_context + 1
                new_start = new_context + 1
            if old_start != len(pattern) or new_start != len(new_slice):
                replacements.append(
                    (start_idx + old_start, len(pattern) - old_start, new_slice[new_start:])
                )
        line_index = start_idx + len(pattern)

    replacements.sort(key=lambda item: item[0])
    return replacements


def apply_replacements(lines: list[str], replacements: list[Replacement]) -> list[str]:
    """降序应用替换防位移;越界删除安全截断。"""
    result = list(lines)
    for start_idx, old_len, new_segment in reversed(replacements):
        for _ in range(old_len):
            if start_idx < len(result):
                result.pop(start_idx)
        for offset, new_line in enumerate(new_segment):
            result.insert(start_idx + offset, new_line)
    return result


def derive_new_contents_from_chunks(
    original_contents: str,
    chunks: list[UpdateFileChunk],
    normalize_to_lf: bool = True,
) -> tuple[str, str]:
    """纯化版应用:返回 (original_contents, new_contents)。不做文件 IO。"""
    if normalize_to_lf:
        original_lines = original_contents.split("\n")
        if original_lines and not original_lines[-1]:
            original_lines.pop()
        replacements = compute_replacements(original_lines, "<memory>", chunks, True)
        new_lines = apply_replacements(original_lines, replacements)
        if not (new_lines and not new_lines[-1]):
            new_lines.append("")
        return original_contents, "\n".join(new_lines)
    source_file = SourceFile.parse(original_contents)
    replacements = compute_replacements(source_file.line_texts(), "<memory>", chunks, False)
    source_file.apply_replacements(replacements)
    return original_contents, source_file.into_contents()
