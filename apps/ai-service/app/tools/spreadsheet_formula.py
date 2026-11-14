# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""表格公式求值/校验(sheet_formula_eval / sheet_formula_validate)。

对标取证:`docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261114/`
(NATIVE-DELTA W11)—— WorkBuddy `workbuddy-sheetagent/mcp/server.mjs` 把
"Apps Script 形状"的表格 DOM(SpreadsheetApp / Sheet / Range / Utility)、
R1C1 语法与公式校验搬进本地表格 Agent,但**单次只算一条公式**、且只能"执行",
不产出依赖关系,也分不清"算出来的值"与"文件里上次存盘的缓存值"。

本模块只读 xlsx(OOXML)并给出三件对侧没有的东西:
1. **依赖图** —— 每个公式格 → 它实际引用的格(区域展开、跨表限定);
2. **显式结构化错误** —— 循环引用/坏引用/未知函数/类型错/除零/无匹配/语法错
   一律带 `error_code`,绝不静默空串;循环引用还会给出闭环路径;
3. **逐格 provenance** —— `{value, formula, source, cached, cache_matches}`,
   `source ∈ computed|literal|empty`,缓存值与重算值不一致单独标记
   (`CACHED_VALUE_MISMATCH`),不拿旧缓存冒充新结果。

零新增依赖:xlsx 读取复用 `document_tools.py` 的 `zipfile + ElementTree` 路线
(不引入 openpyxl,也不调 soffice);公式解析/求值为纯标准库实现。
路径安全复用 `document_tools._resolve_path`(项目根内 + 敏感文件名拒绝),
只读不写,不落任何中间文件。

支持的语法(**有意收窄**,没实现的一律具名报错,不猜):
- 四则运算 `+ - * / ^`、百分号 `%`、连接 `&`、比较 `= <> < <= > >=`;
- 数字/字符串/布尔字面量、Excel 错误字面量(`#DIV/0!` 等);
- A1 / `$A$1` / 区域 `A1:B2` / 跨表 `Sheet2!A1` / 带引号表名 `'My Sheet'!A1`;
- 函数:SUM / AVERAGE / MIN / MAX / ROUND / ABS / IF / VLOOKUP / COUNT /
  COUNTA / CONCAT(别名 CONCATENATE)。
- R1C1 语法**不支持**(xlsx 存的是 A1;遇到 `R1C1` 形状会具名报语法错)。

资源边界:工作簿 ≤ 64 MiB;单次最多求值 5000 个公式格(超出按时段截断并
在 `truncated` 里说明);单个区域引用最多展开 100000 格(超出报错误码)。
"""

from __future__ import annotations

import math
import os
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from typing import Any

from .document_tools import _resolve_path

TOOL_EVAL: str = "sheet_formula_eval"
TOOL_VALIDATE: str = "sheet_formula_validate"

S_NS: str = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R_NS: str = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

MAX_WORKBOOK_BYTES: int = 64 * 1024 * 1024
MAX_EVAL_CELLS: int = 5000
MAX_RANGE_CELLS: int = 100_000
MAX_DEPS_PER_CELL: int = 2000
MAX_EVAL_DEPTH: int = 200
DEFAULT_MAX_CELLS: int = 2000
HARD_MAX_CELLS: int = 20_000
DEFAULT_MAX_FINDINGS: int = 200
HARD_MAX_FINDINGS: int = 2000

_ALLOWED_EXTS: frozenset[str] = frozenset({".xlsx", ".xlsm"})

# Excel 错误文本 → 结构化错误码(缓存错误格与错误字面量共用这一张表)
_EXCEL_ERROR_CODES: dict[str, str] = {
    "#DIV/0!": "FORMULA_DIV_ZERO",
    "#VALUE!": "FORMULA_TYPE",
    "#REF!": "FORMULA_BAD_REFERENCE",
    "#NAME?": "FORMULA_UNKNOWN_NAME",
    "#NUM!": "FORMULA_NUMERIC",
    "#N/A": "FORMULA_NO_MATCH",
    "#NULL!": "FORMULA_BAD_REFERENCE",
}

_ADDR_RE: re.Pattern[str] = re.compile(r"^\$?([A-Za-z]{1,3})\$?([0-9]+)$")
_NUMBER_RE: re.Pattern[str] = re.compile(r"(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?")
_IDENT_RE: re.Pattern[str] = re.compile(
    r"[$A-Za-z_\u0080-\uffff][$A-Za-z0-9_.\u0080-\uffff]*"
)
_ERROR_LITERAL_RE: re.Pattern[str] = re.compile(
    r"#(?:NULL!|DIV/0!|VALUE!|REF!|NAME\?|NUM!|N/A)"
)

Scalar = float | str | bool | None


@dataclass(frozen=True)
class FormulaError:
    """结构化公式错误:`code` 给机器,`excel` 给阅读,`detail` 放闭环/引用等证据。"""

    code: str
    excel: str
    message: str
    detail: dict[str, Any] | None = None


@dataclass
class _Cell:
    """一个单元格的原始三态:静态值(或缓存值)、公式原文、缓存是否在场。"""

    value: Scalar = None
    formula: str | None = None
    cached: Scalar = None
    has_cached: bool = False
    cached_error: str | None = None


@dataclass
class _Workbook:
    sheets: dict[str, dict[str, _Cell]]
    order: list[str]
    by_lower: dict[str, str]


@dataclass
class _Tok:
    kind: str
    value: Any


@dataclass
class _RangeValue:
    """区域引用句柄(惰性展开,避免一次性物化整列)。"""

    sheet: str
    start_col: int
    start_row: int
    end_col: int
    end_row: int


class _SyntaxProblem(Exception):
    """公式词法/语法不成立(只在解析期抛出,对外折成 FORMULA_SYNTAX)。"""


def _col_index(letters: str) -> int:
    """列字母 → 0 基列号(A=0, XFD=16383)。"""
    n = 0
    for ch in letters.upper():
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def _col_name(index: int) -> str:
    """0 基列号 → 列字母。"""
    n = index + 1
    out = ""
    while n > 0:
        n, rem = divmod(n - 1, 26)
        out = chr(65 + rem) + out
    return out


def _parse_address(text: str) -> tuple[int, int] | None:
    """A1 地址 → (0 基列, 0 基行);不成立返回 None。"""
    m = _ADDR_RE.match(text)
    if m is None:
        return None
    return _col_index(m.group(1)), int(m.group(2)) - 1


def _format_address(col: int, row: int) -> str:
    """(0 基列, 0 基行) → A1 地址。"""
    return f"{_col_name(col)}{row + 1}"


def _quote_sheet(name: str) -> str:
    """工作表名需要时加单引号(Excel 规则:非字母数字下划线即引号,内引号加倍)。"""
    if re.fullmatch(r"[A-Za-z0-9_\u0080-\uffff]+", name):
        return name
    return "'" + name.replace("'", "''") + "'"


def _qualified(sheet: str, col: int, row: int) -> str:
    """跨表限定地址(输出与依赖图统一用这一种写法)。"""
    return f"{_quote_sheet(sheet)}!{_format_address(col, row)}"


# ---------------------------------------------------------------------------
# 词法 + 递归下降语法分析
# ---------------------------------------------------------------------------


def _tokenize(text: str) -> list[_Tok]:
    """把公式文本切成记号;不认识的一律抛 `_SyntaxProblem`(不静默跳过)。"""
    tokens: list[_Tok] = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch in " \t\r\n":
            i += 1
            continue
        if ch == '"':
            i += 1
            buf: list[str] = []
            closed = False
            while i < n:
                if text[i] == '"':
                    if i + 1 < n and text[i + 1] == '"':
                        buf.append('"')
                        i += 2
                        continue
                    i += 1
                    closed = True
                    break
                buf.append(text[i])
                i += 1
            if not closed:
                raise _SyntaxProblem("字符串未闭合")
            tokens.append(_Tok("str", "".join(buf)))
            continue
        if ch == "'":
            i += 1
            buf = []
            closed = False
            while i < n:
                if text[i] == "'":
                    if i + 1 < n and text[i + 1] == "'":
                        buf.append("'")
                        i += 2
                        continue
                    i += 1
                    closed = True
                    break
                buf.append(text[i])
                i += 1
            if not closed:
                raise _SyntaxProblem("工作表名引号未闭合")
            tokens.append(_Tok("sheet", "".join(buf)))
            continue
        if ch == "#":
            m = _ERROR_LITERAL_RE.match(text, i)
            if m is None:
                raise _SyntaxProblem("无法识别的错误字面量")
            tokens.append(_Tok("err", m.group(0)))
            i = m.end()
            continue
        if ch.isdigit() or ch == ".":
            m = _NUMBER_RE.match(text, i)
            if m is None:
                raise _SyntaxProblem(f"非法数字: {text[i:i + 8]}")
            tokens.append(_Tok("num", float(m.group(0))))
            i = m.end()
            continue
        m = _IDENT_RE.match(text, i)
        if m is not None:
            tokens.append(_Tok("ident", m.group(0)))
            i = m.end()
            continue
        two = text[i : i + 2]
        if two in ("<=", ">=", "<>"):
            tokens.append(_Tok("op", two))
            i += 2
            continue
        if ch in "+-*/^&%=<>():,!%":
            tokens.append(_Tok("op", ch))
            i += 1
            continue
        raise _SyntaxProblem(f"无法识别的字符: {ch}")
    tokens.append(_Tok("eof", ""))
    return tokens


class _Parser:
    """Excel 公式子集的递归下降解析器(输出元组 AST,便于静态检查)。"""

    _COMPARE_OPS: frozenset[str] = frozenset({"=", "<>", "<", "<=", ">", ">="})

    def __init__(self, tokens: list[_Tok]) -> None:
        self._tokens = tokens
        self._pos = 0

    def _peek(self) -> _Tok:
        return self._tokens[self._pos]

    def _next(self) -> _Tok:
        tok = self._tokens[self._pos]
        if tok.kind != "eof":
            self._pos += 1
        return tok

    def _peek_op(self, *ops: str) -> bool:
        tok = self._peek()
        return tok.kind == "op" and tok.value in ops

    def _expect_op(self, op: str) -> None:
        tok = self._next()
        if tok.kind != "op" or tok.value != op:
            raise _SyntaxProblem(f"期望 '{op}',实际是 '{tok.value}'")

    def parse(self) -> tuple[Any, ...]:
        node = self._expr()
        if self._peek().kind != "eof":
            raise _SyntaxProblem("公式尾部有多余内容")
        return node

    def _expr(self) -> tuple[Any, ...]:
        return self._comparison()

    def _comparison(self) -> tuple[Any, ...]:
        node = self._concat()
        while True:
            tok = self._peek()
            if tok.kind != "op" or tok.value not in self._COMPARE_OPS:
                return node
            self._next()
            node = ("bin", tok.value, node, self._concat())

    def _concat(self) -> tuple[Any, ...]:
        node = self._additive()
        while self._peek_op("&"):
            self._next()
            node = ("bin", "&", node, self._additive())
        return node

    def _additive(self) -> tuple[Any, ...]:
        node = self._multiplicative()
        while self._peek_op("+", "-"):
            op = str(self._next().value)
            node = ("bin", op, node, self._multiplicative())
        return node

    def _multiplicative(self) -> tuple[Any, ...]:
        node = self._power()
        while self._peek_op("*", "/"):
            op = str(self._next().value)
            node = ("bin", op, node, self._power())
        return node

    def _power(self) -> tuple[Any, ...]:
        node = self._unary()
        while self._peek_op("^"):
            self._next()
            node = ("bin", "^", node, self._unary())
        return node

    def _unary(self) -> tuple[Any, ...]:
        if self._peek_op("+", "-"):
            op = str(self._next().value)
            return ("un", op, self._unary())
        return self._postfix()

    def _postfix(self) -> tuple[Any, ...]:
        node = self._primary()
        while self._peek_op("%"):
            self._next()
            node = ("pct", node)
        return node

    def _primary(self) -> tuple[Any, ...]:
        tok = self._next()
        if tok.kind == "num":
            return ("num", tok.value)
        if tok.kind == "str":
            return ("str", tok.value)
        if tok.kind == "err":
            return ("err", str(tok.value))
        if tok.kind == "sheet":
            self._expect_op("!")
            return self._reference(str(tok.value), self._next())
        if tok.kind == "op" and tok.value == "(":
            node = self._expr()
            self._expect_op(")")
            return node
        if tok.kind == "ident":
            name = str(tok.value)
            if self._peek_op("("):
                self._next()
                args: list[tuple[Any, ...]] = []
                if not self._peek_op(")"):
                    while True:
                        args.append(self._expr())
                        if self._peek_op(","):
                            self._next()
                            continue
                        break
                self._expect_op(")")
                return ("func", name.upper(), args)
            if self._peek_op("!"):
                self._next()
                return self._reference(name, self._next())
            upper = name.upper()
            if upper == "TRUE":
                return ("bool", True)
            if upper == "FALSE":
                return ("bool", False)
            if _parse_address(name) is not None:
                return self._reference(None, tok)
            raise _SyntaxProblem(f"未识别的名字: {name}")
        if tok.kind == "eof":
            raise _SyntaxProblem("公式意外结束")
        raise _SyntaxProblem("意外的记号")

    def _reference(self, sheet: str | None, tok: _Tok) -> tuple[Any, ...]:
        if tok.kind != "ident":
            raise _SyntaxProblem("引用缺少单元格地址")
        start = _parse_address(str(tok.value))
        if start is None:
            raise _SyntaxProblem(f"非法单元格地址: {tok.value}")
        node: tuple[Any, ...] = ("ref", sheet, start[0], start[1])
        if not self._peek_op(":"):
            return node
        self._next()
        right_sheet = sheet
        right = self._next()
        if right.kind == "sheet":
            self._expect_op("!")
            right_sheet = str(right.value)
            right = self._next()
        elif right.kind == "ident" and self._peek_op("!"):
            self._next()
            right_sheet = str(right.value)
            right = self._next()
        if right.kind != "ident":
            raise _SyntaxProblem("区域引用缺少结束地址")
        end = _parse_address(str(right.value))
        if end is None:
            raise _SyntaxProblem(f"非法单元格地址: {right.value}")
        return ("range", sheet, start[0], start[1], right_sheet, end[0], end[1])


def _parse_formula(text: str) -> tuple[Any, ...]:
    """解析公式原文(不带前导 '='),失败抛 `_SyntaxProblem`。"""
    return _Parser(_tokenize(text)).parse()


# ---------------------------------------------------------------------------
# xlsx 读取(复用 document_tools 的 zipfile + ElementTree 路线,零新增依赖)
# ---------------------------------------------------------------------------


def _resolve_part(target: str) -> str:
    """rels 的 Target → zip 内规范路径(rels 相对 `xl/workbook.xml` 所在目录)。"""
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join("xl", target))


def _parse_number_literal(text: str) -> Scalar:
    """数字文本 → float;不是数字就原样保留(不猜)。"""
    try:
        return float(text)
    except ValueError:
        return text


def _parse_cell(node: ET.Element, shared: list[str]) -> _Cell | None:
    """解析单个 `<c>`;空壳(无值无公式)返回 None。"""
    t_attr = node.get("t")
    v_el = node.find(f"{S_NS}v")
    v_text = v_el.text if v_el is not None else None
    formula: str | None = None
    f_el = node.find(f"{S_NS}f")
    if f_el is not None:
        f_text = (f_el.text or "").strip()
        if f_text:
            formula = f_text[1:].strip() if f_text.startswith("=") else f_text
    if formula is None and v_text is None and t_attr != "inlineStr":
        return None
    cached: Scalar = None
    cached_error: str | None = None
    if t_attr == "s":
        try:
            idx = int(v_text or "")
        except ValueError:
            idx = -1
        cached = shared[idx] if 0 <= idx < len(shared) else ""
    elif t_attr == "inlineStr":
        is_el = node.find(f"{S_NS}is")
        cached = "".join(x.text or "" for x in is_el.iter(f"{S_NS}t")) if is_el is not None else ""
    elif t_attr == "str":
        cached = v_text or ""
    elif t_attr == "b":
        cached = v_text == "1"
    elif t_attr == "e":
        cached_error = v_text or ""
        cached = cached_error
    elif t_attr == "d":
        cached = v_text or ""
    elif v_text is not None:
        cached = _parse_number_literal(v_text)
    return _Cell(
        value=cached,
        formula=formula,
        cached=cached,
        has_cached=v_text is not None,
        cached_error=cached_error,
    )


def _parse_worksheet(root: ET.Element, shared: list[str]) -> dict[str, _Cell]:
    """解析一个 worksheet 的全部单元格(以 A1 地址为键)。"""
    cells: dict[str, _Cell] = {}
    row_index = 0
    for row_el in root.iter(f"{S_NS}row"):
        r_attr = row_el.get("r")
        row_index = int(r_attr) if r_attr and r_attr.isdigit() else row_index + 1
        col_index = -1
        for c in row_el.iter(f"{S_NS}c"):
            addr = c.get("r")
            parsed = _parse_address(addr) if addr else None
            if parsed is not None:
                col_index = parsed[0]
                row_zero = parsed[1]
            else:
                col_index += 1
                row_zero = row_index - 1
            cell = _parse_cell(c, shared)
            if cell is not None:
                cells[_format_address(col_index, row_zero)] = cell
    return cells


def _load_workbook(path: str) -> tuple[_Workbook | None, str | None, str | None]:
    """读 xlsx/xlsm → `_Workbook`;返回 (工作簿, 错误码, 错误消息)。"""
    try:
        size = os.path.getsize(path)
    except OSError as e:
        return None, "WORKBOOK_UNREADABLE", f"无法读取文件: {e}"
    if size > MAX_WORKBOOK_BYTES:
        return None, "WORKBOOK_TOO_LARGE", f"工作簿 {size} 字节,超过上限 {MAX_WORKBOOK_BYTES}"
    try:
        zf = zipfile.ZipFile(path, "r")
    except zipfile.BadZipFile as e:
        return None, "WORKBOOK_UNREADABLE", f"不是合法的 xlsx(zip)文件: {e}"
    with zf:
        names = set(zf.namelist())
        if "xl/workbook.xml" not in names:
            return None, "WORKBOOK_UNREADABLE", "缺少 xl/workbook.xml(xlsx 结构不完整)"
        try:
            wb_root = ET.fromstring(zf.read("xl/workbook.xml"))
        except (ET.ParseError, KeyError) as e:
            return None, "WORKBOOK_UNREADABLE", f"workbook.xml 解析失败: {e}"
        rels: dict[str, str] = {}
        if "xl/_rels/workbook.xml.rels" in names:
            try:
                rel_root = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
            except (ET.ParseError, KeyError):
                rel_root = None
            if rel_root is not None:
                for rel in rel_root:
                    rid = rel.get("Id")
                    target = rel.get("Target")
                    if rid and target:
                        rels[rid] = _resolve_part(target)
        shared: list[str] = []
        if "xl/sharedStrings.xml" in names:
            try:
                ss_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            except (ET.ParseError, KeyError):
                ss_root = None
            if ss_root is not None:
                for si in ss_root.iter(f"{S_NS}si"):
                    shared.append("".join(t.text or "" for t in si.iter(f"{S_NS}t")))
        fallback_parts = sorted(
            n for n in names if n.startswith("xl/worksheets/") and n.endswith(".xml")
        )
        entries: list[tuple[str, str | None]] = []
        for sh in wb_root.iter(f"{S_NS}sheet"):
            name = sh.get("name")
            if not name:
                continue
            entries.append((name, rels.get(sh.get(f"{R_NS}id") or "")))
        if not entries:
            return None, "NO_WORKSHEET", "工作簿里没有任何工作表"
        sheets: dict[str, dict[str, _Cell]] = {}
        order: list[str] = []
        by_lower: dict[str, str] = {}
        used: set[str] = set()
        for index, (name, part) in enumerate(entries):
            if part is None and index < len(fallback_parts):
                part = fallback_parts[index]
            if part is None or part not in names:
                part = next((p for p in fallback_parts if p not in used), None)
            if part is None:
                return None, "WORKBOOK_UNREADABLE", f"工作表 '{name}' 缺少对应部件"
            used.add(part)
            try:
                sheet_root = ET.fromstring(zf.read(part))
            except (ET.ParseError, KeyError) as e:
                return None, "WORKBOOK_UNREADABLE", f"工作表 '{name}' 解析失败: {e}"
            sheets[name] = _parse_worksheet(sheet_root, shared)
            order.append(name)
            by_lower[name.lower()] = name
    return _Workbook(sheets=sheets, order=order, by_lower=by_lower), None, None


# ---------------------------------------------------------------------------
# 求值引擎(记忆化 + 栈式循环检测 + 逐格依赖记录)
# ---------------------------------------------------------------------------


def _error_from_excel(text: str) -> FormulaError:
    """Excel 错误文本 → 结构化错误。"""
    excel = text.strip().upper()
    code = _EXCEL_ERROR_CODES.get(excel, "FORMULA_CACHED_ERROR")
    return FormulaError(code, excel, f"单元格缓存了 Excel 错误 {excel}")


def _to_number(value: Scalar) -> float | None:
    """宽松数值化(空 → 0,布尔 → 1/0,数字字符串可解析);失败返回 None。"""
    if value is None:
        return 0.0
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = value.strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _to_text(value: Scalar) -> str:
    """Excel 风格文本化(整数不带小数点,浮点保留 15 位有效数字)。"""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return format(value, ".15g")
    return str(value)


def _rank(value: Scalar) -> int:
    """Excel 比较序:数字(0) < 文本(1) < 布尔(2)。"""
    if isinstance(value, bool):
        return 2
    if isinstance(value, (int, float)):
        return 0
    return 1


def _compare_values(left: Scalar, right: Scalar) -> int:
    """三值比较;-1/0/1。空值按对端类型折成 0 或 ""(与 Excel 一致)。"""
    if left is None or right is None:
        if left is None:
            left = "" if isinstance(right, str) else 0.0
        if right is None:
            right = "" if isinstance(left, str) else 0.0
    left_rank = _rank(left)
    right_rank = _rank(right)
    if left_rank != right_rank:
        return -1 if left_rank < right_rank else 1
    if left_rank == 0:
        left_num = float(left)
        right_num = float(right)
        if left_num < right_num:
            return -1
        return 0 if left_num == right_num else 1
    if left_rank == 1:
        left_text = str(left).casefold()
        right_text = str(right).casefold()
        if left_text < right_text:
            return -1
        return 0 if left_text == right_text else 1
    left_bool = bool(left)
    right_bool = bool(right)
    if left_bool == right_bool:
        return 0
    return -1 if not left_bool else 1


def _excel_round(value: float, digits: int) -> float:
    """Excel ROUND 语义:四舍五入(远离零),不是 Python 的银行家舍入。"""
    digits = max(-300, min(300, digits))
    factor = 10.0**digits
    scaled = value * factor
    if scaled >= 0:
        return math.floor(scaled + 0.5) / factor
    return math.ceil(scaled - 0.5) / factor


class _Ctx:
    """一次求值会话的共享状态:记忆化、调用栈、依赖图。"""

    def __init__(self, workbook: _Workbook) -> None:
        self.wb = workbook
        self.memo: dict[tuple[str, int, int], Scalar | FormulaError] = {}
        self.stack: list[tuple[str, int, int]] = []
        self.deps: dict[tuple[str, int, int], list[tuple[str, int, int]]] = {}
        self.evaluated_formula_cells: int = 0

    def resolve_sheet(self, name: str | None, current: str) -> str | FormulaError:
        if not name:
            return current
        canonical = self.wb.by_lower.get(name.lower())
        if canonical is None:
            return FormulaError(
                "FORMULA_BAD_REFERENCE", "#REF!", f"工作表不存在: {name}", {"sheet": name}
            )
        return canonical


def _eval_cell(ctx: _Ctx, sheet: str, col: int, row: int, depth: int) -> Scalar | FormulaError:
    """求一个单元格的值(公式递归求值;循环/语法/深度问题都折成结构化错误)。"""
    key = (sheet, col, row)
    if key in ctx.memo:
        return ctx.memo[key]
    if key in ctx.stack:
        start = ctx.stack.index(key)
        path = [_qualified(s[0], s[1], s[2]) for s in ctx.stack[start:]]
        path.append(_qualified(sheet, col, row))
        return FormulaError(
            "FORMULA_CIRCULAR_REFERENCE",
            "#CYCLE!",
            "循环引用: " + " → ".join(path),
            {"cycle": path},
        )
    cell = ctx.wb.sheets.get(sheet, {}).get(_format_address(col, row))
    if cell is None:
        return None
    if cell.formula is None:
        if cell.cached_error:
            error = _error_from_excel(cell.cached_error)
            ctx.memo[key] = error
            return error
        ctx.memo[key] = cell.value
        return cell.value
    if depth > MAX_EVAL_DEPTH:
        return FormulaError(
            "FORMULA_EVAL_DEPTH", "#VALUE!", "公式依赖链过深", {"depth": MAX_EVAL_DEPTH}
        )
    if ctx.evaluated_formula_cells >= MAX_EVAL_CELLS:
        return FormulaError(
            "FORMULA_EVAL_LIMIT", "#VALUE!", "单次求值公式格数超过上限", {"limit": MAX_EVAL_CELLS}
        )
    ctx.stack.append(key)
    ctx.evaluated_formula_cells += 1
    deps: list[tuple[str, int, int]] = []
    ctx.deps[key] = deps
    try:
        try:
            ast = _parse_formula(cell.formula)
        except _SyntaxProblem as e:
            result: Scalar | FormulaError = FormulaError(
                "FORMULA_SYNTAX",
                "#SYNTAX!",
                f"公式语法错误: {e}",
                {"formula": "=" + cell.formula},
            )
        else:
            value = _eval_node(ast, ctx, sheet, depth + 1, deps)
            if isinstance(value, _RangeValue):
                result = FormulaError("FORMULA_TYPE", "#VALUE!", "公式结果不能是区域引用")
            else:
                result = value
    finally:
        ctx.stack.pop()
    ctx.memo[key] = result
    return result


def _append_dep(
    deps: list[tuple[str, int, int]], sheet: str, col: int, row: int
) -> None:
    if len(deps) < MAX_DEPS_PER_CELL:
        deps.append((sheet, col, row))


def _eval_ref(
    ctx: _Ctx,
    sheet_name: str | None,
    col: int,
    row: int,
    current_sheet: str,
    depth: int,
    deps: list[tuple[str, int, int]],
) -> Scalar | FormulaError:
    resolved = ctx.resolve_sheet(sheet_name, current_sheet)
    if isinstance(resolved, FormulaError):
        return resolved
    _append_dep(deps, resolved, col, row)
    return _eval_cell(ctx, resolved, col, row, depth)


def _eval_range(
    ctx: _Ctx,
    node: tuple[Any, ...],
    current_sheet: str,
    deps: list[tuple[str, int, int]],
) -> _RangeValue | FormulaError:
    _, left_sheet, col1, row1, right_sheet, col2, row2 = node
    resolved_left = ctx.resolve_sheet(left_sheet, current_sheet)
    if isinstance(resolved_left, FormulaError):
        return resolved_left
    resolved_right = ctx.resolve_sheet(right_sheet, current_sheet)
    if isinstance(resolved_right, FormulaError):
        return resolved_right
    if resolved_left != resolved_right:
        return FormulaError(
            "FORMULA_BAD_REFERENCE", "#REF!", "区域引用的两端不在同一工作表"
        )
    left, right = min(col1, col2), max(col1, col2)
    top, bottom = min(row1, row2), max(row1, row2)
    count = (right - left + 1) * (bottom - top + 1)
    if count > MAX_RANGE_CELLS:
        return FormulaError(
            "FORMULA_RANGE_TOO_LARGE",
            "#REF!",
            f"区域引用过大({count} 格,上限 {MAX_RANGE_CELLS})",
            {"cells": count},
        )
    for row in range(top, bottom + 1):
        for col in range(left, right + 1):
            _append_dep(deps, resolved_left, col, row)
    return _RangeValue(resolved_left, left, top, right, bottom)


def _eval_node(
    node: tuple[Any, ...],
    ctx: _Ctx,
    current_sheet: str,
    depth: int,
    deps: list[tuple[str, int, int]],
) -> Scalar | _RangeValue | FormulaError:
    """AST 求值;区域引用返回 `_RangeValue` 句柄,其余返回标量或结构化错误。"""
    kind = node[0]
    if kind == "num":
        return float(node[1])
    if kind == "str":
        return str(node[1])
    if kind == "bool":
        return bool(node[1])
    if kind == "err":
        return _error_from_excel(str(node[1]))
    if kind == "ref":
        return _eval_ref(ctx, node[1], node[2], node[3], current_sheet, depth, deps)
    if kind == "range":
        return _eval_range(ctx, node, current_sheet, deps)
    if kind == "pct":
        value = _eval_node(node[1], ctx, current_sheet, depth, deps)
        if isinstance(value, FormulaError):
            return value
        if isinstance(value, _RangeValue):
            return FormulaError("FORMULA_TYPE", "#VALUE!", "百分号不能作用于区域")
        number = _to_number(value)
        if number is None:
            return FormulaError("FORMULA_TYPE", "#VALUE!", f"百分号作用于非数字: {value!r}")
        return number / 100.0
    if kind == "un":
        value = _eval_node(node[2], ctx, current_sheet, depth, deps)
        if isinstance(value, FormulaError):
            return value
        if isinstance(value, _RangeValue):
            return FormulaError("FORMULA_TYPE", "#VALUE!", "一元运算不能作用于区域")
        number = _to_number(value)
        if number is None:
            return FormulaError("FORMULA_TYPE", "#VALUE!", f"一元运算作用于非数字: {value!r}")
        return -number if node[1] == "-" else number
    if kind == "bin":
        left = _eval_node(node[2], ctx, current_sheet, depth, deps)
        if isinstance(left, FormulaError):
            return left
        right = _eval_node(node[3], ctx, current_sheet, depth, deps)
        if isinstance(right, FormulaError):
            return right
        if isinstance(left, _RangeValue) or isinstance(right, _RangeValue):
            return FormulaError("FORMULA_TYPE", "#VALUE!", "区域不能直接参与四则运算")
        return _eval_binary(str(node[1]), left, right)
    if kind == "func":
        return _call_function(str(node[1]), node[2], ctx, current_sheet, depth, deps)
    return FormulaError("FORMULA_SYNTAX", "#SYNTAX!", f"未知 AST 节点: {kind}")


def _eval_binary(op: str, left: Scalar, right: Scalar) -> Scalar | FormulaError:
    if op == "&":
        return _to_text(left) + _to_text(right)
    if op in ("=", "<>", "<", "<=", ">", ">="):
        cmp = _compare_values(left, right)
        if op == "=":
            return cmp == 0
        if op == "<>":
            return cmp != 0
        if op == "<":
            return cmp < 0
        if op == "<=":
            return cmp <= 0
        if op == ">":
            return cmp > 0
        return cmp >= 0
    left_num = _to_number(left)
    right_num = _to_number(right)
    if left_num is None or right_num is None:
        return FormulaError(
            "FORMULA_TYPE", "#VALUE!", f"运算符 '{op}' 两侧不是数字"
        )
    if op == "+":
        return left_num + right_num
    if op == "-":
        return left_num - right_num
    if op == "*":
        return left_num * right_num
    if op == "/":
        if right_num == 0:
            return FormulaError("FORMULA_DIV_ZERO", "#DIV/0!", "除数为 0")
        return left_num / right_num
    if op == "^":
        try:
            result = math.pow(left_num, right_num)
        except (OverflowError, ValueError):
            return FormulaError("FORMULA_NUMERIC", "#NUM!", "幂运算结果不可表示")
        if math.isinf(result) or math.isnan(result):
            return FormulaError("FORMULA_NUMERIC", "#NUM!", "幂运算结果不可表示")
        return result
    return FormulaError("FORMULA_SYNTAX", "#SYNTAX!", f"未知运算符: {op}")


def _iter_values(
    value: Scalar | _RangeValue | FormulaError,
    ctx: _Ctx,
    depth: int,
) -> list[tuple[Scalar | FormulaError, bool]]:
    """展开函数实参:区域按行优先展开;第二个元素标记"是否来自区域"。"""
    if isinstance(value, _RangeValue):
        out: list[tuple[Scalar | FormulaError, bool]] = []
        for row in range(value.start_row, value.end_row + 1):
            for col in range(value.start_col, value.end_col + 1):
                out.append((_eval_cell(ctx, value.sheet, col, row, depth), True))
        return out
    return [(value, False)]


def _collect_numbers(
    values: list[Scalar | _RangeValue | FormulaError],
    ctx: _Ctx,
    depth: int,
) -> list[float] | FormulaError:
    """聚合类函数的数值收集:区域只收数字;直接实参允许数字文本与布尔。"""
    numbers: list[float] = []
    for value in values:
        for item, from_range in _iter_values(value, ctx, depth):
            if isinstance(item, FormulaError):
                return item
            if item is None:
                continue
            if isinstance(item, bool):
                if not from_range:
                    numbers.append(1.0 if item else 0.0)
                continue
            if isinstance(item, (int, float)):
                numbers.append(float(item))
                continue
            if not from_range:
                parsed = _to_number(item)
                if parsed is not None:
                    numbers.append(parsed)
    return numbers


def _truthy(value: Scalar | _RangeValue) -> bool | FormulaError:
    if isinstance(value, _RangeValue):
        return FormulaError("FORMULA_TYPE", "#VALUE!", "条件不能是区域引用")
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    text = value.strip().upper()
    if text == "TRUE":
        return True
    if text == "FALSE" or text == "":
        return False
    return FormulaError("FORMULA_TYPE", "#VALUE!", f"条件不是布尔值: {value!r}")


def _arg_error(name: str, expected: str) -> FormulaError:
    return FormulaError("FORMULA_ARGUMENT_COUNT", "#VALUE!", f"{name} 参数个数不对(期望 {expected})")


def _fn_if(
    name: str,
    arg_nodes: list[tuple[Any, ...]],
    ctx: _Ctx,
    current_sheet: str,
    depth: int,
    deps: list[tuple[str, int, int]],
) -> Scalar | FormulaError:
    if len(arg_nodes) not in (2, 3):
        return _arg_error(name, "2 或 3")
    condition = _eval_node(arg_nodes[0], ctx, current_sheet, depth, deps)
    if isinstance(condition, FormulaError):
        return condition
    truth = _truthy(condition)
    if isinstance(truth, FormulaError):
        return truth
    if truth:
        branch = _eval_node(arg_nodes[1], ctx, current_sheet, depth, deps)
    elif len(arg_nodes) == 3:
        branch = _eval_node(arg_nodes[2], ctx, current_sheet, depth, deps)
    else:
        return False
    if isinstance(branch, _RangeValue):
        return FormulaError("FORMULA_TYPE", "#VALUE!", "IF 分支不能是区域引用")
    return branch


def _fn_vlookup(
    name: str,
    arg_nodes: list[tuple[Any, ...]],
    ctx: _Ctx,
    current_sheet: str,
    depth: int,
    deps: list[tuple[str, int, int]],
) -> Scalar | FormulaError:
    if len(arg_nodes) not in (3, 4):
        return _arg_error(name, "3 或 4")
    needle = _eval_node(arg_nodes[0], ctx, current_sheet, depth, deps)
    if isinstance(needle, FormulaError):
        return needle
    if isinstance(needle, _RangeValue):
        return FormulaError("FORMULA_TYPE", "#VALUE!", "VLOOKUP 查找值不能是区域")
    table = _eval_node(arg_nodes[1], ctx, current_sheet, depth, deps)
    if isinstance(table, FormulaError):
        return table
    if not isinstance(table, _RangeValue):
        return FormulaError("FORMULA_TYPE", "#VALUE!", "VLOOKUP 第二参数必须是区域引用")
    raw_index = _eval_node(arg_nodes[2], ctx, current_sheet, depth, deps)
    if isinstance(raw_index, FormulaError):
        return raw_index
    if isinstance(raw_index, _RangeValue):
        return FormulaError("FORMULA_TYPE", "#VALUE!", "VLOOKUP 列序号不能是区域")
    index_number = _to_number(raw_index)
    if index_number is None:
        return FormulaError("FORMULA_TYPE", "#VALUE!", "VLOOKUP 列序号不是数字")
    width = table.end_col - table.start_col + 1
    col_offset = int(index_number)
    if col_offset < 1 or col_offset > width:
        return FormulaError(
            "FORMULA_BAD_REFERENCE",
            "#REF!",
            f"VLOOKUP 列序号 {col_offset} 超出区域宽度 {width}",
        )
    approximate = True
    if len(arg_nodes) == 4:
        flag = _eval_node(arg_nodes[3], ctx, current_sheet, depth, deps)
        if isinstance(flag, FormulaError):
            return flag
        if isinstance(flag, _RangeValue):
            return FormulaError("FORMULA_TYPE", "#VALUE!", "VLOOKUP 第四参数不能是区域")
        if isinstance(flag, bool):
            approximate = flag
        else:
            flag_number = _to_number(flag)
            if flag_number is None:
                return FormulaError("FORMULA_TYPE", "#VALUE!", "VLOOKUP 第四参数不是布尔值")
            approximate = flag_number != 0
    match_row: int | None = None
    lookup_number: float | None = None
    if approximate and isinstance(needle, (int, float)) and not isinstance(needle, bool):
        lookup_number = float(needle)
    for row in range(table.start_row, table.end_row + 1):
        candidate = _eval_cell(ctx, table.sheet, table.start_col, row, depth + 1)
        if isinstance(candidate, FormulaError):
            return candidate
        if (
            lookup_number is not None
            and isinstance(candidate, (int, float))
            and not isinstance(candidate, bool)
        ):
            if float(candidate) <= lookup_number:
                match_row = row
            continue
        if _compare_values(candidate, needle) == 0:
            match_row = row
            if not approximate:
                break
    if match_row is None:
        return FormulaError(
            "FORMULA_NO_MATCH",
            "#N/A",
            "VLOOKUP 未找到匹配项",
            {"lookup": needle},
        )
    result = _eval_cell(
        ctx, table.sheet, table.start_col + col_offset - 1, match_row, depth + 1
    )
    return 0.0 if result is None else result


def _call_function(
    name: str,
    arg_nodes: list[tuple[Any, ...]],
    ctx: _Ctx,
    current_sheet: str,
    depth: int,
    deps: list[tuple[str, int, int]],
) -> Scalar | FormulaError:
    """函数分派:IF / VLOOKUP 惰性求值,其余先求实参再聚合。"""
    if name == "IF":
        return _fn_if(name, arg_nodes, ctx, current_sheet, depth, deps)
    if name == "VLOOKUP":
        return _fn_vlookup(name, arg_nodes, ctx, current_sheet, depth, deps)
    args: list[Scalar | _RangeValue | FormulaError] = []
    for node in arg_nodes:
        args.append(_eval_node(node, ctx, current_sheet, depth, deps))
    for arg in args:
        if isinstance(arg, FormulaError):
            return arg
    if name in ("SUM", "AVERAGE", "MIN", "MAX"):
        numbers = _collect_numbers(args, ctx, depth + 1)
        if isinstance(numbers, FormulaError):
            return numbers
        if name == "SUM":
            return sum(numbers)
        if name == "AVERAGE":
            if not numbers:
                return FormulaError("FORMULA_DIV_ZERO", "#DIV/0!", "AVERAGE 没有可平均的数值")
            return sum(numbers) / len(numbers)
        if not numbers:
            return 0.0
        return min(numbers) if name == "MIN" else max(numbers)
    if name == "COUNT":
        count = 0
        for arg in args:
            for item, from_range in _iter_values(arg, ctx, depth + 1):
                if isinstance(item, bool):
                    if not from_range:
                        count += 1
                elif isinstance(item, (int, float)) or (
                    not from_range and isinstance(item, str) and _to_number(item) is not None
                ):
                    count += 1
        return float(count)
    if name == "COUNTA":
        total = 0
        for arg in args:
            for item, _ in _iter_values(arg, ctx, depth + 1):
                if item is not None:
                    total += 1
        return float(total)
    if name in ("CONCAT", "CONCATENATE"):
        parts: list[str] = []
        for arg in args:
            for item, _ in _iter_values(arg, ctx, depth + 1):
                if isinstance(item, FormulaError):
                    return item
                parts.append(_to_text(item))
        return "".join(parts)
    if name == "ROUND":
        if len(args) != 2:
            return _arg_error(name, "2")
        raw_number = args[0]
        raw_digits = args[1]
        if isinstance(raw_number, (_RangeValue, FormulaError)) or isinstance(
            raw_digits, (_RangeValue, FormulaError)
        ):
            return FormulaError("FORMULA_TYPE", "#VALUE!", "ROUND 需要两个数字")
        number = _to_number(raw_number)
        digits_raw = _to_number(raw_digits)
        if number is None or digits_raw is None:
            return FormulaError("FORMULA_TYPE", "#VALUE!", "ROUND 需要两个数字")
        return _excel_round(number, int(digits_raw))
    if name == "ABS":
        if len(args) != 1:
            return _arg_error(name, "1")
        raw_value = args[0]
        if isinstance(raw_value, (_RangeValue, FormulaError)):
            return FormulaError("FORMULA_TYPE", "#VALUE!", "ABS 需要数字")
        number = _to_number(raw_value)
        if number is None:
            return FormulaError("FORMULA_TYPE", "#VALUE!", "ABS 需要数字")
        return abs(number)
    return FormulaError(
        "FORMULA_UNKNOWN_FUNCTION",
        "#NAME?",
        f"未支持的函数: {name}",
        {"function": name, "supported": sorted(_SUPPORTED_FUNCTIONS)},
    )


_SUPPORTED_FUNCTIONS: frozenset[str] = frozenset(
    {
        "SUM",
        "AVERAGE",
        "MIN",
        "MAX",
        "ROUND",
        "ABS",
        "IF",
        "VLOOKUP",
        "COUNT",
        "COUNTA",
        "CONCAT",
        "CONCATENATE",
    }
)


# ---------------------------------------------------------------------------
# 结果装配与工具入口
# ---------------------------------------------------------------------------


def _fail(tool: str, code: str, message: str, **extra: Any) -> dict[str, Any]:
    """统一失败信封(不抛异常)。"""
    payload: dict[str, Any] = {
        "tool": tool,
        "ok": False,
        "errorCode": code,
        "message": message,
    }
    payload.update(extra)
    return payload


def _json_scalar(value: Scalar | FormulaError) -> Scalar:
    """数值归一(整值 float → int,抑制 0.30000000000000004 这类噪声)。"""
    if isinstance(value, FormulaError):
        return None
    if isinstance(value, float):
        if math.isinf(value) or math.isnan(value):
            return str(value)
        if value.is_integer():
            return int(value)
        return float(format(value, ".15g"))
    return value


def _error_payload(error: FormulaError) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "code": error.code,
        "excel": error.excel,
        "message": error.message,
    }
    if error.detail is not None:
        payload["detail"] = error.detail
    return payload


def _cache_matches(value: Scalar | FormulaError, cached: Scalar) -> bool | None:
    """重算值 vs 文件缓存值:True/False 为已判定,None 表示无法比较(如重算出错)。"""
    if isinstance(value, FormulaError):
        return None
    if isinstance(value, bool) or isinstance(cached, bool):
        return isinstance(value, bool) and isinstance(cached, bool) and value == cached
    if isinstance(value, (int, float)) and isinstance(cached, (int, float)):
        return math.isclose(float(value), float(cached), rel_tol=1e-9, abs_tol=1e-9)
    if value is None:
        return cached is None or cached == ""
    return _to_text(value) == _to_text(cached)


def _cell_payload(value: Scalar | FormulaError, cell: _Cell) -> dict[str, Any]:
    """逐格 provenance:`{value, formula, source, cached?, cache_matches?}`。"""
    is_formula = cell.formula is not None
    payload: dict[str, Any] = {
        "value": _json_scalar(value),
        "formula": ("=" + cell.formula) if cell.formula is not None else None,
        "source": "computed" if is_formula else ("empty" if cell.value is None else "literal"),
    }
    if isinstance(value, FormulaError):
        payload["error"] = _error_payload(value)
    elif not is_formula and cell.cached_error:
        payload["error"] = _error_payload(_error_from_excel(cell.cached_error))
    if cell.has_cached:
        payload["cached"] = _json_scalar(cell.cached)
        payload["cache_matches"] = _cache_matches(value, cell.cached)
    return payload


def _split_range(text: str) -> tuple[str | None, int, int, int, int] | None:
    """'A1:C20' / 'Sheet1!A1:C20' → (表名或 None, 左列, 上行, 右列, 下行)。"""
    raw = text.strip().replace("$", "")
    sheet: str | None = None
    if "!" in raw:
        sheet_part, raw = raw.rsplit("!", 1)
        sheet = sheet_part.strip().strip("'")
        if not sheet:
            return None
    if ":" not in raw:
        return None
    left_text, right_text = raw.split(":", 1)
    left = _parse_address(left_text.strip())
    right = _parse_address(right_text.strip())
    if left is None or right is None:
        return None
    return (
        sheet,
        min(left[0], right[0]),
        min(left[1], right[1]),
        max(left[0], right[0]),
        max(left[1], right[1]),
    )


def _resolve_scope(
    workbook: _Workbook,
    sheet_raw: Any,
    range_raw: Any,
) -> tuple[list[tuple[str, int, int]] | None, str | None, str | None]:
    """把 sheet/range 参数收敛成"要处理的公式格清单";错误具名返回。"""
    sheet_name: str | None = None
    if sheet_raw is not None:
        if not isinstance(sheet_raw, str) or not sheet_raw.strip():
            return None, "INVALID_REQUEST", "sheet 必须是非空字符串"
        canonical = workbook.by_lower.get(sheet_raw.strip().lower())
        if canonical is None:
            return None, "SHEET_NOT_FOUND", f"工作表不存在: {sheet_raw}"
        sheet_name = canonical
    rect: tuple[int, int, int, int] | None = None
    if range_raw is not None:
        if not isinstance(range_raw, str) or not range_raw.strip():
            return None, "INVALID_REQUEST", "range 必须是非空字符串"
        split = _split_range(range_raw)
        if split is None:
            return None, "INVALID_RANGE", f"区域写法不合法: {range_raw}(示例 A1:C20)"
        range_sheet, col1, row1, col2, row2 = split
        if range_sheet is not None:
            canonical = workbook.by_lower.get(range_sheet.lower())
            if canonical is None:
                return None, "SHEET_NOT_FOUND", f"工作表不存在: {range_sheet}"
            if sheet_name is not None and canonical != sheet_name:
                return None, "INVALID_REQUEST", "sheet 与 range 前缀指向不同工作表"
            sheet_name = canonical
        if sheet_name is None:
            if len(workbook.order) != 1:
                return None, "INVALID_REQUEST", (
                    "工作簿含多个工作表时,range 须配合 sheet,或写成 '表名!A1:B2'"
                )
            sheet_name = workbook.order[0]
        rect = (col1, row1, col2, row2)
    targets: list[tuple[str, int, int]] = []
    order_index = {name: index for index, name in enumerate(workbook.order)}
    for name in [sheet_name] if sheet_name else workbook.order:
        for addr, cell in workbook.sheets[name].items():
            if cell.formula is None:
                continue
            parsed = _parse_address(addr)
            if parsed is None:
                continue
            if rect is not None:
                col1, row1, col2, row2 = rect
                if not (col1 <= parsed[0] <= col2 and row1 <= parsed[1] <= row2):
                    continue
            targets.append((name, parsed[0], parsed[1]))
    targets.sort(key=lambda item: (order_index.get(item[0], 0), item[2], item[1]))
    return targets, None, None


def _int_arg(arguments: dict[str, Any], name: str, default: int, low: int, high: int) -> int:
    """整数参数:非法值回退默认,再钳制到 [low, high]。"""
    raw = arguments.get(name)
    if raw is None:
        return max(low, min(high, default))
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return max(low, min(high, default))
    return max(low, min(high, value))


def _bool_arg(arguments: dict[str, Any], name: str, default: bool) -> bool:
    raw = arguments.get(name)
    if raw is None:
        return default
    if isinstance(raw, bool):
        return raw
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def _prepare(
    tool: str, arguments: dict[str, Any]
) -> tuple[_Workbook | None, str | None, list[tuple[str, int, int]] | None, dict[str, Any] | None]:
    """路径/格式/工作簿/范围四道闸的共同前半段;失败时返回现成信封。"""
    path, err = _resolve_path(arguments.get("path"))
    if err is not None or path is None:
        return None, None, None, _fail(tool, "INVALID_PATH", err or "路径无效")
    ext = os.path.splitext(path)[1].lower()
    if ext not in _ALLOWED_EXTS:
        return None, None, None, _fail(
            tool,
            "UNSUPPORTED_FORMAT",
            f"仅支持 OOXML 表格(.xlsx/.xlsm),当前是 {ext or '无扩展名'};请先另存为 .xlsx",
        )
    workbook, code, message = _load_workbook(path)
    if workbook is None:
        return None, None, None, _fail(tool, code or "WORKBOOK_UNREADABLE", message or "工作簿读取失败")
    targets, scope_code, scope_message = _resolve_scope(
        workbook, arguments.get("sheet"), arguments.get("range")
    )
    if targets is None:
        return None, None, None, _fail(tool, scope_code or "INVALID_REQUEST", scope_message or "范围参数不合法")
    return workbook, path, targets, None


async def sheet_formula_eval(arguments: dict[str, Any]) -> dict[str, Any]:
    """对 xlsx 公式做重算,返回逐格 `{value, formula, source}` + 依赖图。

    入参:path(必填) / sheet / range / include_inputs(默认 true) / max_cells。
    `ok=True` 只表示工具执行成功;公式本身的错误在每格 `error` 与 `error_cells` 里。
    """
    workbook, path, targets, failure = _prepare(TOOL_EVAL, arguments)
    if failure is not None or workbook is None or path is None or targets is None:
        return failure or _fail(TOOL_EVAL, "INTERNAL_ERROR", "前置检查未产出工作簿")
    max_cells = _int_arg(arguments, "max_cells", DEFAULT_MAX_CELLS, 1, HARD_MAX_CELLS)
    include_inputs = _bool_arg(arguments, "include_inputs", True)
    ctx = _Ctx(workbook)
    truncated = len(targets) > max_cells
    selected = targets[:max_cells]
    target_keys = {(sheet, col, row) for sheet, col, row in selected}
    cells_out: dict[str, dict[str, Any]] = {}
    dependencies: dict[str, list[str]] = {}
    for sheet, col, row in selected:
        cell = workbook.sheets[sheet][_format_address(col, row)]
        value = _eval_cell(ctx, sheet, col, row, 0)
        key = _qualified(sheet, col, row)
        cells_out[key] = _cell_payload(value, cell)
        deps = ctx.deps.get((sheet, col, row), [])
        if deps:
            seen: dict[tuple[str, int, int], None] = {}
            for dep in deps:
                seen.setdefault(dep, None)
            dependencies[key] = [_qualified(*dep) for dep in seen]
            if len(deps) >= MAX_DEPS_PER_CELL:
                cells_out[key]["dependencies_truncated"] = True
    if include_inputs:
        remaining = max_cells - len(cells_out)
        extra_keys = [key for key in ctx.memo if key not in target_keys]
        extra_keys.sort(
            key=lambda item: (
                workbook.order.index(item[0]) if item[0] in workbook.order else 0,
                item[2],
                item[1],
            )
        )
        if remaining < len(extra_keys):
            truncated = True
        for sheet, col, row in extra_keys[: max(0, remaining)]:
            extra_cell = workbook.sheets.get(sheet, {}).get(_format_address(col, row))
            if extra_cell is None:
                continue
            key = _qualified(sheet, col, row)
            cells_out[key] = _cell_payload(ctx.memo[(sheet, col, row)], extra_cell)
            extra_deps = ctx.deps.get((sheet, col, row))
            if extra_deps:
                seen_extra: dict[tuple[str, int, int], None] = {}
                for dep in extra_deps:
                    seen_extra.setdefault(dep, None)
                dependencies[key] = [_qualified(*dep) for dep in seen_extra]
    error_cells = sum(1 for payload in cells_out.values() if "error" in payload)
    return {
        "tool": TOOL_EVAL,
        "ok": True,
        "path": path,
        "sheets": workbook.order,
        "cells": cells_out,
        "dependencies": dependencies,
        "formula_cells": len(targets),
        "returned_cells": len(cells_out),
        "error_cells": error_cells,
        "truncated": truncated,
        "provenance": (
            "source=computed|literal|empty;cached 为文件内上次存盘值,"
            "cache_matches 标记重算值是否与缓存一致"
        ),
    }


async def sheet_formula_validate(arguments: dict[str, Any]) -> dict[str, Any]:
    """校验 xlsx 公式:语法/函数/引用/循环/类型/除零/无匹配 + 缓存漂移。

    入参:path(必填) / sheet / range / max_findings / include_cache_mismatch。
    `clean=True` 等价于 "没有任何 error 级 finding"(warning 不算脏)。
    """
    workbook, path, targets, failure = _prepare(TOOL_VALIDATE, arguments)
    if failure is not None or workbook is None or path is None or targets is None:
        return failure or _fail(TOOL_VALIDATE, "INTERNAL_ERROR", "前置检查未产出工作簿")
    max_findings = _int_arg(arguments, "max_findings", DEFAULT_MAX_FINDINGS, 1, HARD_MAX_FINDINGS)
    include_cache = _bool_arg(arguments, "include_cache_mismatch", True)
    ctx = _Ctx(workbook)
    findings: list[dict[str, Any]] = []
    error_count = 0
    warning_count = 0
    for sheet, col, row in targets:
        cell = workbook.sheets[sheet][_format_address(col, row)]
        key = _qualified(sheet, col, row)
        value = _eval_cell(ctx, sheet, col, row, 0)
        if isinstance(value, FormulaError):
            error_count += 1
            findings.append(
                {
                    "severity": "error",
                    "code": value.code,
                    "cell": key,
                    "message": value.message,
                    "excel": value.excel,
                    "formula": ("=" + cell.formula) if cell.formula else None,
                    "detail": value.detail,
                }
            )
            continue
        if include_cache and cell.has_cached and cell.cached is not None:
            matches = _cache_matches(value, cell.cached)
            if matches is False:
                warning_count += 1
                findings.append(
                    {
                        "severity": "warning",
                        "code": "CACHED_VALUE_MISMATCH",
                        "cell": key,
                        "message": "文件缓存值与重算值不一致(缓存可能是上次存盘的旧值)",
                        "formula": ("=" + cell.formula) if cell.formula else None,
                        "cached": _json_scalar(cell.cached),
                        "computed": _json_scalar(value),
                    }
                )
    truncated = len(findings) > max_findings
    return {
        "tool": TOOL_VALIDATE,
        "ok": True,
        "path": path,
        "sheets": workbook.order,
        "findings": findings[:max_findings],
        "error_count": error_count,
        "warning_count": warning_count,
        "clean": error_count == 0,
        "scanned_formula_cells": len(targets),
        "truncated": truncated,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
