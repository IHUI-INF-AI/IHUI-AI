# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型化 Fast Apply 编辑(服务层,不含工具注册)。

背景(缺口证据)
--------------------------------------------------------------------------
本仓编辑面此前只有两条路:1) `file_editor.edit_file` —— 整段 old_string 精确
子串替换,0 次/多次命中一律失败;2) `patch_engine.apply_patch` —— Codex 风格
补丁文本,hunk 允许 fuzzy/bestfit 递降匹配。两条都不适合「模型只给出局部片段、
行尾空白/缩进/换行风格与仓库现状有轻微漂移」的场景:前者要求逐字节相同,
后者要求模型产出补丁文法。全仓 `fast_apply` 零命中 —— 本模块补的就是这条。

对外接口(工具注册面由另一条线接线,本层只定契约)
--------------------------------------------------------------------------
    apply_edit(file_path, target, replacement, *, strategy="auto",
               whole_file_content=None, session_id="") -> FastApplyResult

    apply_edit_with_fix(file_path, target, replacement, *, fixer,
                        strategy="auto", whole_file_content=None,
                        session_id="") -> FastApplyResult

- `target`:模型给出的「原片段」(要替换掉的局部内容);
- `replacement`:模型给出的「新片段」;空串 = 删除该片段(与 file_edit 同语义);
- `strategy`:三档 + auto ——
    * "exact"      精确子串唯一命中;
    * "fuzzy"      带上下文的行级模糊锚定(唯一命中才应用);
    * "whole_file" 整文件兜底(必须显式给 `whole_file_content`,不推断);
    * "auto"       精确 → 模糊 → 整文件(仅当调用方提供了整文件内容)递降。
- `fixer`:纠错回调,形如 `(FastApplyFailure) -> (target, replacement) | None`;
  首次失败时调用一次,`None` 表示放弃重试。重试上限硬编码 1 次(共 2 次尝试),
  不存在无限重试。
- 返回值 `FastApplyResult` 为冻结 dataclass,`to_dict()` 得到可直接 JSON 化的
  回执(键集恒定,不随成功/失败变化,便于前端契约稳定)。

安全边界(硬约束,不是尽力而为)
--------------------------------------------------------------------------
1. 路径:复用 `file_editor.validate_path`(工作区白名单 + 敏感目录黑名单),
   不新造第二份路径判据。
2. 唯一命中:精确/模糊两档都要求**恰好一处**命中;多处命中一律拒绝并回报
   候选行号,零处命中一律拒绝(或按 auto 递降)。歧义时不猜 —— 猜错就是
   把改动落到错误的同名代码块,比失败更糟。
3. 写后校验:落盘后**从磁盘回读**,校验(1)语法(py/json/ts/js,复用
   `patch_engine.validate_syntax` 这一权威源)、(2)新片段确实出现在预期行区间。
   任一不过 → 用写前原始字节原子回滚,并回读确认逐字节一致;
   回滚本身失效时如实回报 `ROLLBACK_FAILED`,绝不谎称成功。
4. 换行/BOM 保真:匹配在 LF 归一空间做,写回时只改动被替换区间,未触碰的
   字节原样保留(混用行尾的文件也不会被整体改写);BOM 原样保留。
"""
from __future__ import annotations

import logging
import os
import uuid
from collections.abc import Callable
from dataclasses import dataclass, replace
from enum import StrEnum
from pathlib import Path

from app.core.ai_code_attribution import parse_diff_line_range
from app.core.apply_patch import seek_sequence
from app.services import file_editor, patch_engine
from app.services.ai_code_attribution_store import record_attribution
from app.services.patch_engine import SyntaxValidationError

logger = logging.getLogger(__name__)

# 文件大小上限复用 file_editor 的同一常量(单一真值;本模块不开第二份口径)。
MAX_FILE_SIZE = file_editor.MAX_FILE_SIZE

# 应用尝试上限:首次 + 一次纠错重试。写死为常量而非参数 —— 纠错回路刻意
# 只允许一次,防止「模型越改越差」在循环里烧掉上下文与磁盘写次数。
MAX_APPLY_ATTEMPTS = 2

# 归属账工具名:与 `app/core/ai_code_attribution_verdict.py` 的 AI_GENERATED_TOOLS
# 登记项逐字一致(登记表是判据唯一真源,改名必须两处同步)。
ATTRIBUTION_TOOL = "fast_apply"

_BOM = b"\xef\xbb\xbf"


class FastApplyStrategy(StrEnum):
    """三档应用策略 + auto 递降。"""

    AUTO = "auto"
    EXACT = "exact"
    FUZZY = "fuzzy"
    WHOLE_FILE = "whole_file"


class FastApplyErrorCode(StrEnum):
    """失败原因码(前端/编排层按码分支,message 只作人读)。"""

    EMPTY_TARGET = "EMPTY_TARGET"
    INVALID_ARGUMENT = "INVALID_ARGUMENT"
    PATH_NOT_IN_WORKSPACE = "PATH_NOT_IN_WORKSPACE"
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    UNREADABLE = "UNREADABLE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    ENCODING_ERROR = "ENCODING_ERROR"
    ANCHOR_NOT_FOUND = "ANCHOR_NOT_FOUND"
    ANCHOR_MULTIPLE_MATCHES = "ANCHOR_MULTIPLE_MATCHES"
    WHOLE_FILE_REQUIRED = "WHOLE_FILE_REQUIRED"
    WRITE_FAILED = "WRITE_FAILED"
    POST_VALIDATE_FAILED = "POST_VALIDATE_FAILED"
    ROLLBACK_FAILED = "ROLLBACK_FAILED"


@dataclass(frozen=True)
class FastApplyResult:
    """一次(或一次重试)应用的结果回执。键集恒定,便于对外契约稳定。"""

    ok: bool
    error_code: str = ""
    message: str = ""
    file_path: str = ""
    strategy: str = ""
    match_tier: str = ""
    attempts: int = 0
    fix_attempted: bool = False
    rollback_performed: bool = False
    start_line: int = 0
    end_line: int = 0
    candidates: tuple[int, ...] = ()
    diff: str = ""

    def to_dict(self) -> dict[str, object]:
        """转为可直接 JSON 序列化的 dict(键集与成败无关,恒为下面这些)。"""
        return {
            "ok": self.ok,
            "errorCode": self.error_code,
            "message": self.message,
            "filePath": self.file_path,
            "strategy": self.strategy,
            "matchTier": self.match_tier,
            "attempts": self.attempts,
            "fixAttempted": self.fix_attempted,
            "rollbackPerformed": self.rollback_performed,
            "startLine": self.start_line,
            "endLine": self.end_line,
            "candidates": list(self.candidates),
            "diff": self.diff,
        }


@dataclass(frozen=True)
class FastApplyFailure:
    """交给纠错回调的失败上下文:原因码 + 人读原因 + 候选行号。

    `candidates` 只在「多处命中」时有值(1-based 行号),模型据此补上下文
    把锚点收窄到唯一,这正是 fix prompt 最需要的信息。
    """

    error_code: str
    message: str
    file_path: str
    attempt: int
    candidates: tuple[int, ...] = ()


Fixer = Callable[[FastApplyFailure], tuple[str, str] | None]


# ---------------------------------------------------------------------------
# 文档模型:原始字节 ↔ LF 归一文本(匹配在归一空间,写回只改目标区间)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _Document:
    """一份待编辑文件的三视图。"""

    raw: bytes  # 磁盘原始字节(含 BOM)
    bom: bytes  # b"" 或 UTF-8 BOM
    raw_text: str  # 去 BOM 后的原文(保留 CRLF/CR)
    lf_text: str  # \r\n 与 \r 归一为 \n 的文本(匹配空间)
    lf_to_raw: tuple[int, ...] | None  # LF 下标 → 原文下标;None 表示恒等映射
    newline: str  # 插入行的首选行尾(嗅探自原文,默认 "\n")

    @property
    def lines(self) -> list[str]:
        return self.lf_text.split("\n")


def _decode_document(raw: bytes) -> _Document:
    """把原始字节解析为三视图;非 UTF-8 抛 UnicodeDecodeError 由调用方分流。"""
    bom = _BOM if raw.startswith(_BOM) else b""
    body = raw[len(bom):]
    raw_text = body.decode("utf-8")
    if "\r" not in raw_text:
        # 绝大多数文件走这条零成本路径:归一文本与原文逐字符一致。
        return _Document(
            raw=raw,
            bom=bom,
            raw_text=raw_text,
            lf_text=raw_text,
            lf_to_raw=None,
            newline="\n",
        )
    newline = "\r\n" if "\r\n" in raw_text else "\r"
    lf_chars: list[str] = []
    to_raw: list[int] = []
    i = 0
    n = len(raw_text)
    while i < n:
        ch = raw_text[i]
        if ch == "\r":
            to_raw.append(i)
            if i + 1 < n and raw_text[i + 1] == "\n":
                i += 2
            else:
                i += 1
            lf_chars.append("\n")
        else:
            to_raw.append(i)
            lf_chars.append(ch)
            i += 1
    to_raw.append(n)
    return _Document(
        raw=raw,
        bom=bom,
        raw_text=raw_text,
        lf_text="".join(lf_chars),
        lf_to_raw=tuple(to_raw),
        newline=newline,
    )


def _to_raw_offset(doc: _Document, lf_offset: int) -> int:
    """LF 归一下标 → 原文下标。"""
    if doc.lf_to_raw is None:
        return lf_offset
    return doc.lf_to_raw[lf_offset]


def _split_lines(text: str) -> list[str]:
    """按行拆分(空文本 = 空列表,与 patch_engine 的既有语义一致)。"""
    return [] if text == "" else text.split("\n")


def _line_offsets(lf_text: str) -> list[int]:
    """每行在 LF 文本中的起始下标(最后一行之后不追加哨兵)。"""
    offsets: list[int] = []
    acc = 0
    for line in lf_text.split("\n"):
        offsets.append(acc)
        acc += len(line) + 1
    return offsets


def _to_lf(text: str) -> str:
    """把模型给的片段归一为 LF(模型可能带回 CRLF)。"""
    return text.replace("\r\n", "\n").replace("\r", "\n")


def _find_exact_offsets(text: str, needle: str) -> list[int]:
    """全部精确命中的起始下标(允许重叠,因为目标片段可能自重叠)。

    `str.count` 只数不重叠出现,会把 "aa" 在 "aaa" 里数成 1 —— 唯一性判据
    因此必须自己做重叠扫描,不能拿 count 的语义当唯一性证据。
    """
    hits: list[int] = []
    start = 0
    while True:
        idx = text.find(needle, start)
        if idx < 0:
            return hits
        hits.append(idx)
        start = idx + 1


def _all_line_matches(lines: list[str], pattern: list[str]) -> list[int]:
    """行级锚定的**全部**命中位置。

    匹配阶梯本身只有一份真源:`app/core/apply_patch.seek_sequence`
    (精确 → rstrip → strip → Unicode 标点归一)。这里反复调用它、每次从
    上一个命中 +1 继续搜索,从而拿到全部候选 —— 唯一性判据需要「全量」
    而不是「首个」。
    """
    hits: list[int] = []
    cursor = 0
    while True:
        found = seek_sequence(lines, pattern, cursor, eof=False)
        if found is None:
            return hits
        hits.append(found)
        cursor = found + 1


def _match_tier(lines: list[str], pattern: list[str], pos: int) -> str:
    """给已命中的位置标注所用阶梯档位(仅用于回执可解释性)。

    判据档位仍由 seek_sequence 决定;这里只按同一阶梯顺序回标,不做取舍。
    """
    window = lines[pos:pos + len(pattern)]
    if window == pattern:
        return "exact"
    if all(a.rstrip() == b.rstrip() for a, b in zip(window, pattern, strict=False)):
        return "rstrip"
    if all(a.strip() == b.strip() for a, b in zip(window, pattern, strict=False)):
        return "strip"
    return "unicode"


def _line_of_offset(lf_text: str, offset: int) -> int:
    """LF 下标 → 1-based 行号。"""
    return lf_text.count("\n", 0, offset) + 1


# ---------------------------------------------------------------------------
# 变更计划:匹配 → 计算「写后应为」的原文,不落盘
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _Plan:
    """一次应用的完整计划(尚未落盘)。"""

    strategy: str
    match_tier: str
    expected_raw_text: str  # 写后磁盘上应为的原文(不含 BOM)
    start_line: int  # 1-based,回执展示用
    end_line: int  # 1-based,含末行
    # 写后校验用:新片段在写后 LF 文本中的起始下标与应有内容。
    # 刻意用「区间文本」而不是「整行相等」—— 精确档是子串语义(片段可以只占
    # 一行的后半段,如 "return 1" 之于 "    return 1"),整行比较会把正确结果判错。
    lf_fragment_start: int
    lf_fragment: str


@dataclass(frozen=True)
class _Failure:
    """计划阶段的失败(未落盘,文件必然未被改动)。"""

    error_code: str
    message: str
    candidates: tuple[int, ...] = ()


def _plan_exact(doc: _Document, target_lf: str, replacement: str) -> _Plan | _Failure:
    """第一档:精确子串唯一命中。"""
    hits = _find_exact_offsets(doc.lf_text, target_lf)
    if not hits:
        return _Failure(FastApplyErrorCode.ANCHOR_NOT_FOUND, "精确锚点未命中")
    if len(hits) > 1:
        return _Failure(
            FastApplyErrorCode.ANCHOR_MULTIPLE_MATCHES,
            f"精确锚点命中 {len(hits)} 处,拒绝应用(需要唯一命中)",
            tuple(_line_of_offset(doc.lf_text, h) for h in hits),
        )
    start = hits[0]
    end = start + len(target_lf)
    rendered = _to_lf(replacement).replace("\n", doc.newline)
    raw_start = _to_raw_offset(doc, start)
    raw_end = _to_raw_offset(doc, end)
    expected = doc.raw_text[:raw_start] + rendered + doc.raw_text[raw_end:]
    start_line = _line_of_offset(doc.lf_text, start)
    return _Plan(
        strategy=FastApplyStrategy.EXACT.value,
        match_tier="exact",
        expected_raw_text=expected,
        start_line=start_line,
        end_line=start_line + target_lf.count("\n"),
        lf_fragment_start=start,
        lf_fragment=_to_lf(replacement),
    )


def _plan_fuzzy(doc: _Document, target_lf: str, replacement: str) -> _Plan | _Failure:
    """第二档:带上下文的行级模糊锚定(唯一命中才应用)。"""
    pattern = _split_lines(target_lf)
    lines = doc.lines
    hits = _all_line_matches(lines, pattern)
    if not hits:
        return _Failure(FastApplyErrorCode.ANCHOR_NOT_FOUND, "模糊锚点未命中")
    if len(hits) > 1:
        return _Failure(
            FastApplyErrorCode.ANCHOR_MULTIPLE_MATCHES,
            f"模糊锚点命中 {len(hits)} 处,拒绝应用(需要唯一命中,请补充上下文行)",
            tuple(h + 1 for h in hits),
        )
    pos = hits[0]
    offsets = _line_offsets(doc.lf_text)
    start = offsets[pos]
    after = pos + len(pattern)
    if after < len(lines):
        # 块尾不含末尾换行:LF 文本里该换行由后一段保留,避免多/少吃一行。
        block_end = offsets[after] - 1
    else:
        block_end = len(doc.lf_text)
    rep_lines = _split_lines(_to_lf(replacement))
    if not rep_lines and block_end < len(doc.lf_text):
        # 纯删除:连带吃掉块尾的那个换行,否则会在原处留一条空行。
        block_end += 1
    rendered = "\n".join(rep_lines).replace("\n", doc.newline)
    raw_start = _to_raw_offset(doc, start)
    raw_end = _to_raw_offset(doc, block_end)
    expected = doc.raw_text[:raw_start] + rendered + doc.raw_text[raw_end:]
    return _Plan(
        strategy=FastApplyStrategy.FUZZY.value,
        match_tier=_match_tier(lines, pattern, pos),
        expected_raw_text=expected,
        start_line=pos + 1,
        end_line=pos + len(pattern),
        lf_fragment_start=start,
        lf_fragment="\n".join(rep_lines),
    )


def _plan_whole_file(doc: _Document, whole_file_content: str) -> _Plan | _Failure:
    """第三档:整文件兜底(内容由调用方显式给出,不推断)。"""
    rendered = _to_lf(whole_file_content).replace("\n", doc.newline)
    return _Plan(
        strategy=FastApplyStrategy.WHOLE_FILE.value,
        match_tier="whole_file",
        expected_raw_text=rendered,
        start_line=1,
        end_line=max(1, len(_split_lines(rendered))),
        lf_fragment_start=0,
        lf_fragment=_to_lf(whole_file_content),
    )


def _plan_edit(
    doc: _Document,
    target: str,
    replacement: str,
    strategy: FastApplyStrategy,
    whole_file_content: str | None,
) -> _Plan | _Failure:
    """按策略出计划。auto 只在「未命中」时递降;多处命中属歧义,直接拒绝。"""
    target_lf = _to_lf(target)
    if len(target_lf) == 0:
        return _Failure(FastApplyErrorCode.EMPTY_TARGET, "target 不能为空(删除语义请用空 replacement)")

    if strategy is FastApplyStrategy.EXACT:
        return _plan_exact(doc, target_lf, replacement)
    if strategy is FastApplyStrategy.FUZZY:
        return _plan_fuzzy(doc, target_lf, replacement)
    if strategy is FastApplyStrategy.WHOLE_FILE:
        if whole_file_content is None:
            return _Failure(
                FastApplyErrorCode.WHOLE_FILE_REQUIRED,
                "whole_file 策略必须显式给出 whole_file_content(不推断整文件内容)",
            )
        return _plan_whole_file(doc, whole_file_content)

    # auto:精确 → 模糊 → 整文件(仅当调用方提供了整文件兜底)
    first = _plan_exact(doc, target_lf, replacement)
    if not isinstance(first, _Failure):
        return first
    if first.error_code == FastApplyErrorCode.ANCHOR_MULTIPLE_MATCHES:
        return first
    second = _plan_fuzzy(doc, target_lf, replacement)
    if not isinstance(second, _Failure):
        return second
    if second.error_code == FastApplyErrorCode.ANCHOR_MULTIPLE_MATCHES:
        return second
    if whole_file_content is not None:
        return _plan_whole_file(doc, whole_file_content)
    return _Failure(
        FastApplyErrorCode.ANCHOR_NOT_FOUND,
        "精确与模糊锚定均未命中,且调用方未提供整文件兜底内容",
    )


# ---------------------------------------------------------------------------
# 落盘 / 回读校验 / 回滚
# ---------------------------------------------------------------------------


def _atomic_write(path: str, data: bytes) -> None:
    """原子写:同目录临时文件 + os.replace;保留原文件权限位。"""
    tmp_path = f"{path}.fa_tmp_{uuid.uuid4().hex}"
    try:
        with open(tmp_path, "wb") as f:
            f.write(data)
        try:
            os.chmod(tmp_path, os.stat(path).st_mode)
        except OSError:
            # 权限位复制失败不阻断写入内容;原文件仍可读。
            pass
        os.replace(tmp_path, path)
    except BaseException:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except OSError:
            pass
        raise


def _read_back(path: str) -> bytes:
    """从磁盘回读原始字节(校验的唯一证据来源)。"""
    with open(path, "rb") as f:
        return f.read()


def _verify_written(path: str, plan: _Plan) -> str | None:
    """写后回读校验;返回失败原因,None 表示通过。

    两层判据:
    1) 语法 —— 复用 patch_engine.validate_syntax(py/json/ts/js 的权威源);
    2) 结构 —— 回读内容必须与计划逐字节一致(含目标片段确实落在预期行区间)。
    第 2 层比「片段存在」更严:它同时证明换行/BOM 往返没有破坏未触碰的行。
    """
    try:
        raw = _read_back(path)
        doc_after = _decode_document(raw)
    except (OSError, UnicodeDecodeError) as e:
        return f"回读失败: {type(e).__name__}: {e}"

    if doc_after.raw_text != plan.expected_raw_text:
        return "回读内容与计划不一致(落盘被截断或被并发改写)"

    try:
        patch_engine.validate_syntax(path, doc_after.lf_text)
    except SyntaxValidationError as e:
        return f"语法校验未通过: {e}"

    lines = doc_after.lf_text
    fragment_start = plan.lf_fragment_start
    fragment_end = fragment_start + len(plan.lf_fragment)
    if lines[fragment_start:fragment_end] != plan.lf_fragment:
        return (
            f"目标片段未落在预期位置(第 {plan.start_line} 行起,"
            f"期望 {plan.strategy} 策略的新片段)"
        )
    return None


def _restore_bytes(path: str, original: bytes) -> bool:
    """用写前原始字节回滚,并回读确认真的是逐字节一致。"""
    try:
        _atomic_write(path, original)
        return _read_back(path) == original
    except OSError as e:
        logger.warning("fast_apply 回滚写入失败: %s", e)
        return False


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------


def _size_guard(resolved_path: str) -> _Failure | None:
    """文件存在性 + 大小守卫。

    判据刻意与 file_editor 同语义:读失败必须与「不存在」区分 ——
    把读不到说成不存在,后续就可能新建/空写覆盖真实文件。
    """
    try:
        stat = os.stat(resolved_path)
    except FileNotFoundError:
        return _Failure(FastApplyErrorCode.FILE_NOT_FOUND, f"文件不存在: {resolved_path}")
    except OSError as e:
        return _Failure(FastApplyErrorCode.UNREADABLE, f"文件读不到: {type(e).__name__}: {e}")
    if stat.st_size > MAX_FILE_SIZE:
        return _Failure(
            FastApplyErrorCode.FILE_TOO_LARGE,
            f"文件大小 {stat.st_size} 字节超过上限 {MAX_FILE_SIZE} 字节",
        )
    return None


def _record(tool_hunk: str, path: str, line_start: int, line_end: int, session_id: str) -> None:
    """归属记账(观测面):失败只记日志,绝不影响编辑主流程。"""
    try:
        record_attribution(
            ATTRIBUTION_TOOL,
            path,
            tool_hunk,
            session_id=session_id,
            line_start=line_start,
            line_end=line_end,
        )
    except Exception as e:  # noqa: BLE001 - 观测面不得反噬主流程
        logger.warning("fast_apply 归属记账失败(不影响编辑主流程): %s", e)


def apply_edit(
    file_path: str,
    target: str,
    replacement: str,
    *,
    strategy: str = FastApplyStrategy.AUTO.value,
    whole_file_content: str | None = None,
    session_id: str = "",
) -> FastApplyResult:
    """把模型给出的局部片段精确落到文件上(单次尝试,不做纠错重试)。

    Args:
        file_path: 目标文件(必须在工作区白名单内,且不在敏感目录)。
        target: 模型给出的原片段(要替换掉的内容);不能为空。
        replacement: 模型给出的新片段;空串等价于删除 target 片段。
        strategy: "auto" / "exact" / "fuzzy" / "whole_file"。
        whole_file_content: 整文件兜底内容;仅 "whole_file" 或 auto 的最后
            一档使用,且必须是调用方显式提供 —— 本层不推断整文件内容。
        session_id: 归属记账的会话隔离键。

    Returns:
        FastApplyResult。失败时 `error_code` 区分原因,文件保证保持应用前状态。
    """
    try:
        chosen = FastApplyStrategy(strategy)
    except ValueError:
        return FastApplyResult(
            ok=False,
            error_code=FastApplyErrorCode.INVALID_ARGUMENT.value,
            message=f"未知策略: {strategy!r}(可选 auto/exact/fuzzy/whole_file)",
            file_path=file_path,
            attempts=1,
        )

    if not target:
        return FastApplyResult(
            ok=False,
            error_code=FastApplyErrorCode.EMPTY_TARGET.value,
            message="target 不能为空字符串(删除语义请用空 replacement)",
            file_path=file_path,
            strategy=chosen.value,
            attempts=1,
        )

    ok, info = file_editor.validate_path(file_path)
    if not ok:
        return FastApplyResult(
            ok=False,
            error_code=FastApplyErrorCode.PATH_NOT_IN_WORKSPACE.value,
            message=info,
            file_path=file_path,
            strategy=chosen.value,
            attempts=1,
        )
    resolved_path = info

    guarded = _size_guard(resolved_path)
    if guarded is not None:
        return FastApplyResult(
            ok=False,
            error_code=guarded.error_code,
            message=guarded.message,
            file_path=resolved_path,
            strategy=chosen.value,
            attempts=1,
        )

    try:
        original_raw = _read_back(resolved_path)
    except OSError as e:
        return FastApplyResult(
            ok=False,
            error_code=FastApplyErrorCode.UNREADABLE.value,
            message=f"文件读取失败: {type(e).__name__}: {e}",
            file_path=resolved_path,
            strategy=chosen.value,
            attempts=1,
        )

    try:
        doc = _decode_document(original_raw)
    except UnicodeDecodeError as e:
        return FastApplyResult(
            ok=False,
            error_code=FastApplyErrorCode.ENCODING_ERROR.value,
            message=f"文件非 UTF-8 编码: {e}",
            file_path=resolved_path,
            strategy=chosen.value,
            attempts=1,
        )

    plan = _plan_edit(doc, target, replacement, chosen, whole_file_content)
    if isinstance(plan, _Failure):
        return FastApplyResult(
            ok=False,
            error_code=plan.error_code,
            message=plan.message,
            file_path=resolved_path,
            strategy=chosen.value,
            attempts=1,
            candidates=plan.candidates,
        )

    new_raw = doc.bom + plan.expected_raw_text.encode("utf-8")
    try:
        _atomic_write(resolved_path, new_raw)
    except OSError as e:
        # 原子写失败不会留下半改文件:临时文件已清理,原文件未被 replace。
        return FastApplyResult(
            ok=False,
            error_code=FastApplyErrorCode.WRITE_FAILED.value,
            message=f"写入失败: {type(e).__name__}: {e}",
            file_path=resolved_path,
            strategy=plan.strategy,
            match_tier=plan.match_tier,
            attempts=1,
            start_line=plan.start_line,
            end_line=plan.end_line,
        )

    verify_error = _verify_written(resolved_path, plan)
    if verify_error is not None:
        restored = _restore_bytes(resolved_path, original_raw)
        if not restored:
            return FastApplyResult(
                ok=False,
                error_code=FastApplyErrorCode.ROLLBACK_FAILED.value,
                message=(
                    f"写后校验失败: {verify_error};且回滚后回读内容与原始字节不一致,"
                    f"文件可能处于不一致状态,请人工介入: {resolved_path}"
                ),
                file_path=resolved_path,
                strategy=plan.strategy,
                match_tier=plan.match_tier,
                attempts=1,
                rollback_performed=False,
                start_line=plan.start_line,
                end_line=plan.end_line,
            )
        return FastApplyResult(
            ok=False,
            error_code=FastApplyErrorCode.POST_VALIDATE_FAILED.value,
            message=f"写后校验失败: {verify_error};已回滚到应用前内容",
            file_path=resolved_path,
            strategy=plan.strategy,
            match_tier=plan.match_tier,
            attempts=1,
            rollback_performed=True,
            start_line=plan.start_line,
            end_line=plan.end_line,
        )

    diff = file_editor.generate_diff(doc.lf_text, _decode_document(new_raw).lf_text, resolved_path)
    line_start, line_end = parse_diff_line_range(diff)
    _record(diff, resolved_path, line_start, line_end, session_id)

    return FastApplyResult(
        ok=True,
        file_path=resolved_path,
        strategy=plan.strategy,
        match_tier=plan.match_tier,
        attempts=1,
        start_line=plan.start_line,
        end_line=plan.end_line,
        diff=diff,
    )


def apply_edit_with_fix(
    file_path: str,
    target: str,
    replacement: str,
    *,
    fixer: Fixer | None = None,
    strategy: str = FastApplyStrategy.AUTO.value,
    whole_file_content: str | None = None,
    session_id: str = "",
) -> FastApplyResult:
    """带纠错回路的应用:首次失败 → 用失败原因换一次修正片段 → 仍失败即停。

    重试次数硬上限见 `MAX_APPLY_ATTEMPTS`(2 次尝试 = 1 次纠错),不存在
    「越改越差」的无限循环。两次尝试都从磁盘重新读文件,所以第一次的
    回滚(若有)不会污染第二次。

    Args:
        fixer: 纠错回调。收到 `FastApplyFailure`(含 error_code / message /
            候选行号),返回修正后的 `(target, replacement)`;返回 None 表示
            放弃重试。回调抛异常按「纠错不可用」处理,不向外冒泡。
       其余参数同 `apply_edit`。

    Returns:
        FastApplyResult。`attempts` 为真实尝试次数;`message` 在两次均失败时
        同时带首次与纠错后的原因,便于编排层把完整原因回灌给模型。
    """
    first = apply_edit(
        file_path,
        target,
        replacement,
        strategy=strategy,
        whole_file_content=whole_file_content,
        session_id=session_id,
    )
    result = replace(first, attempts=1)
    if result.ok or fixer is None:
        return result

    failure = FastApplyFailure(
        error_code=result.error_code,
        message=result.message,
        file_path=result.file_path,
        attempt=1,
        candidates=result.candidates,
    )
    try:
        fixed = fixer(failure)
    except Exception as e:  # noqa: BLE001 - 纠错回调是模型边界,异常不冒泡
        return replace(
            result,
            fix_attempted=True,
            message=f"{result.message};纠错回调异常: {type(e).__name__}: {e};已停止重试",
        )

    if fixed is None:
        return replace(
            result,
            fix_attempted=True,
            message=f"{result.message};纠错回调未给出新片段,已停止重试",
        )
    if not isinstance(fixed, tuple) or len(fixed) != 2:
        return replace(
            result,
            fix_attempted=True,
            message=f"{result.message};纠错回调返回值非法(应为 (target, replacement)),已停止重试",
        )
    fixed_target, fixed_replacement = fixed

    second = apply_edit(
        file_path,
        fixed_target,
        fixed_replacement,
        strategy=strategy,
        whole_file_content=whole_file_content,
        session_id=session_id,
    )
    second = replace(
        second,
        attempts=min(MAX_APPLY_ATTEMPTS, 2),
        fix_attempted=True,
    )
    if second.ok:
        return second
    return replace(
        second,
        message=(
            f"首次失败({result.error_code}): {result.message};"
            f"纠错后仍失败({second.error_code}): {second.message}"
        ),
    )


__all__ = [
    "FastApplyErrorCode",
    "FastApplyFailure",
    "FastApplyResult",
    "FastApplyStrategy",
    "Fixer",
    "MAX_APPLY_ATTEMPTS",
    "apply_edit",
    "apply_edit_with_fix",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
