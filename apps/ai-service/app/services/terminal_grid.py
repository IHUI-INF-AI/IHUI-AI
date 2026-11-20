# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""VT 屏幕网格(2026-11-21 立):把终端输出流当成**一块会动的字符格子**来记账。

为什么必须有它:在此之前本模块只知道"输出流归一后长什么样"(`strip_ansi`)与"缓冲区里
的历史行"。这两样都回答不了「光标现在停在哪」「屏幕上第 3 行第 12 列那个字符是什么」——
缓冲区是**行流水**,不是屏幕:一帧全屏重绘在流水里是几百行,在屏幕上只有一屏;`\r` 回车
刷新在流水里是换行,在屏幕上是**同一个格子被改写**。拿流水冒充屏幕去回答光标位置,答案
必然是错的("浅做会撒谎"),所以这里做的是一块真网格。

**建模边界(如实写清楚,不假装)**:
- 只建模**几何**(字符占格、光标、卷屏、换屏)。**不建模** SGR 颜色/字形 —— 颜色不在本模块
  的判据里,也不会因为"没存颜色"而丢字符。
- 宽字符按 `east_asian_width` 的 `W/F` 占两格,组合符/零宽格式符占零格(贴到前一格上),
  这样行文本按格拼回来与用户看到的一致。
- 支持的原语:字符写(含 pending-wrap 语义)、`\n`/`\r`/`\b`/`\t`/BEL、CUU/CUD/CUF/CUB、
  CNL/CPL、CHA/VPA、CUP/HVP、ED/EL、ICH/DCH/ECH、IL/DL、SU/SD、DECSTBM、DECSC/DECRC
  (`ESC 7`/`ESC 8` 与 `CSI s`/`CSI u`)、`?7`(自动折行)、`?25`(光标可见)、`?47/1047/1049`
  (备用屏幕),`?1048`(存/取光标)。
- **不支持**(遇到就整段吃掉、不影响文字与光标):origin mode(`?6`)、bracketed paste(`?2004`,
  已由会话层单独记)、鼠标模式(`?1000…`,同上)、SGR、字符集选择(`ESC ( ) * +`)、
  以及一切本表之外的私有序列 —— 统一按"消费整条、不落地为文字"处理。

**分块 feeds**:真输出是按块到的,转义序列会被**截在块边界**(`\x1b[31` 在一个块、`m` 在下一个)。
所以解析到末尾若是一条没写完的序列,它会被存进 `_tail` 等下一块拼回来 —— 否则那半条序列
会被当成可见文字印到屏幕上(比丢一段颜色糟糕得多)。
"""

from __future__ import annotations

import unicodedata
from typing import Any

#: 屏幕尺寸上界 —— 与会话层 `MAX_COLS`/`MAX_ROWS` 同量级(网格只是那块屏的记账,不得更大)。
MAX_GRID_COLS = 500
MAX_GRID_ROWS = 200

#: 组合符/格式符这些零宽字符最多往后贴多少,防止异常流把一格堆成千字符。
MAX_CELL_CHARS = 8

#: 宽字符**第二格**的占位符。必须与"空白格"区分开:空白格是 `""`(拼回文本时补一个空格),
#: 占位格是哨兵(拼回文本时**一个字符都不出**)。混用会导致两件事同时坏掉 ——
#: 缩进/表格对齐全被吃掉(`"ab cde"` 退化成 `"abcde"`),而宽字符行会多出幽灵空格。
#: 用不可打印的 `\x00` 当哨兵:它永远不会是真实字符,且肉眼能一眼看出是占位。
WIDE_TAIL = "\x00"


def row_text(cells: list[str]) -> str:
    """把一行格子拼回**人读文本**:空白格补一个空格、宽字符占位格一个都不出、右侧空白裁掉。

    三件事缺一不可:不补空格 ⇒ 缩进与表格列全塌;不跳占位 ⇒ 每个汉字后面多一个幽灵格;
    不裁右侧空白 ⇒ 每行拖着几十个空格,快照变噪音。行内空白**保留** —— 程序用它排版。
    """
    parts: list[str] = []
    for ch in cells:
        if ch == WIDE_TAIL:
            continue
        parts.append(ch if ch else " ")
    return "".join(parts).rstrip()


def cell_width(ch: str) -> int:
    """一个字符占几格(0/1/2)。宽字符占两格是终端物理事实,不是显示偏好。"""
    if unicodedata.east_asian_width(ch) in ("W", "F"):
        return 2
    if unicodedata.category(ch) in ("Mn", "Me", "Cf") or ch == "\u200b":
        return 0
    return 1


class _Screen:
    """一块屏(主屏或备用屏各一块)。定义域 = 尺寸 + 格子 + 光标 + 卷屏区。"""

    __slots__ = ("cols", "rows", "cells", "row", "col", "pending", "visible", "top", "bottom")

    def __init__(self, cols: int, rows: int) -> None:
        self.cols = cols
        self.rows = rows
        self.cells: list[list[str]] = [[""] * cols for _ in range(rows)]
        self.row = 0
        self.col = 0
        self.pending = False
        self.visible = True
        self.top = 0
        self.bottom = rows - 1

    def reset(self) -> None:  # noqa: D401 - 内部方法
        self.cells = [[""] * self.cols for _ in range(self.rows)]
        self.row = 0
        self.col = 0
        self.pending = False
        self.visible = True
        self.top = 0
        self.bottom = self.rows - 1

    def resize(self, cols: int, rows: int) -> None:
        """改变尺寸:保留左上角、裁掉越界内容、把光标夹回屏内。

        不做 reflow(重排历史文本):真终端在这里的行为分两派,而 reflow 会把"程序当年
        按 80 列排的版"重排成 120 列的样子 —— 那是**另一种**内容。所以这里如实做"从此刻起
        按新尺寸记账",旧内容按新窗口裁切,并把 `reset_region` 一起复位。
        """
        cols = max(1, min(int(cols), MAX_GRID_COLS))
        rows = max(1, min(int(rows), MAX_GRID_ROWS))
        if cols == self.cols and rows == self.rows:
            return
        new = [[""] * cols for _ in range(rows)]
        for r in range(min(rows, self.rows)):
            for c in range(min(cols, self.cols)):
                new[r][c] = self.cells[r][c]
        self.cells = new
        self.cols = cols
        self.rows = rows
        self.row = min(self.row, rows - 1)
        self.col = min(self.col, cols - 1)
        self.pending = False
        self.top = 0
        self.bottom = rows - 1

    def scroll_up(self, n: int) -> None:
        n = max(1, min(n, self.bottom - self.top + 1))
        for _ in range(n):
            del self.cells[self.top]
            self.cells.insert(self.bottom, [""] * self.cols)

    def scroll_down(self, n: int) -> None:
        n = max(1, min(n, self.bottom - self.top + 1))
        for _ in range(n):
            del self.cells[self.bottom]
            self.cells.insert(self.top, [""] * self.cols)

    def linefeed(self, *, carriage: bool = False) -> None:
        if self.row == self.bottom:
            self.scroll_up(1)
        else:
            self.row += 1
        if carriage:
            self.col = 0
        self.pending = False

    def clear_row(self, row: int) -> None:
        self.cells[row] = [""] * self.cols


class Grid:
    """一块终端屏幕:两块 `_Screen`(主/备) + 光标存档 + 未写完的序列尾巴。"""

    def __init__(self, cols: int, rows: int) -> None:
        cols = max(1, min(int(cols), MAX_GRID_COLS))
        rows = max(1, min(int(rows), MAX_GRID_ROWS))
        self.cols = cols
        self.rows = rows
        self.main = _Screen(cols, rows)
        self.alt = _Screen(cols, rows)
        self.on_alt = False
        self.autowrap = True
        self._saved: dict[str, tuple[int, int]] = {"main": (0, 0), "alt": (0, 0)}
        self._tail = ""
        self._buf = self.main

    # ─── 视图 ───

    @property
    def screen(self) -> _Screen:
        return self._buf

    def resize(self, cols: int, rows: int) -> None:
        self.cols = max(1, min(int(cols), MAX_GRID_COLS))
        self.rows = max(1, min(int(rows), MAX_GRID_ROWS))
        self.main.resize(self.cols, self.rows)
        self.alt.resize(self.cols, self.rows)

    def lines(self) -> list[str]:
        """当前屏面按行取文本(每行右侧空白裁掉、末尾空行整体去掉)。

        裁掉尾空白是**必须**的:不裁的话一屏 80 列每行都拖着 60 个空格,快照变噪音。
        行内空白保留 —— 程序用它排版(表格、对齐的列)。
        """
        out: list[str] = []
        for row in self._buf.cells:
            out.append(row_text(row))
        while out and not out[-1]:
            out.pop()
        return out

    def line_at(self, row: int) -> str:
        """第 `row` 行(**1 起**)的文本;越界给空串(不抛异常:问"屏幕上有这一行吗"是合法问题)。"""
        if not 1 <= row <= self.rows:
            return ""
        return row_text(self._buf.cells[row - 1])

    def cell_at(self, row: int, col: int) -> str:
        """第 `row` 行第 `col` 列(**1 起**)那一格是什么。

        占位格(宽字符的第二格)与空白格都回空串:问"这一格有什么字"时两者答案都是"没有"。
        越界同样回空串 —— 点击坐标越界时上层要能问出"那儿什么都没有",而不是吃异常。
        """
        if not (1 <= row <= self.rows and 1 <= col <= self.cols):
            return ""
        ch = self._buf.cells[row - 1][col - 1]
        if ch == WIDE_TAIL:
            return ""
        return ch if ch else ""

    def cursor(self) -> dict[str, Any]:
        """光标位置(行列 **1 起**)+ 它所在那一行的文本。"""
        scr = self._buf
        line = row_text(scr.cells[scr.row])
        return {
            "cols": self.cols,
            "rows": self.rows,
            "row": scr.row + 1,
            "col": scr.col + 1,
            "pending_wrap": scr.pending,
            "visible": scr.visible,
            "alt_screen": self.on_alt,
            "line": line,
        }

    # ─── 写字符 ───

    def _put(self, ch: str) -> None:
        width = cell_width(ch)
        if width == 0:
            # 零宽符(组合符)贴到光标**前**一格:不能占新的一格,否则 "e" + 声调会变成两格宽
            idx = self._buf.col - 1 if not self._buf.pending else self._buf.col
            if idx >= 0:
                cell = self._buf.cells[self._buf.row][idx]
                if len(cell) < MAX_CELL_CHARS:
                    self._buf.cells[self._buf.row][idx] = cell + ch
            return
        if self._buf.pending and self.autowrap:
            self._buf.linefeed(carriage=True)
        if width == 2 and self._buf.col >= self.cols - 1:
            # 最后一格放不下双宽字符:先折行(不放半宽残字)
            if self.autowrap:
                self._buf.linefeed(carriage=True)
            else:
                self._buf.col = max(0, self.cols - 2)
        self._buf.cells[self._buf.row][self._buf.col] = ch
        if width == 2:
            self._buf.cells[self._buf.row][self._buf.col + 1] = WIDE_TAIL
        self._buf.col += width
        if self._buf.col >= self.cols:
            self._buf.col = self.cols - 1
            self._buf.pending = True

    # ─── 解析 ───

    def feed(self, text: str) -> None:
        """吃一段输出。分块调用是常态,块边界上没写完的序列留到下一块。"""
        if not text:
            return
        data = self._tail + text
        self._tail = ""
        i, n = 0, len(data)
        while i < n:
            ch = data[i]
            if ch != "\x1b":
                i = self._control_or_text(data, i)
                continue
            i = self._escape(data, i)
        # 解析器遇到未写完的序列时把尾巴留在 `_tail`(见 `_escape`)

    def _control_or_text(self, data: str, i: int) -> int:
        ch = data[i]
        if ch == "\n" or ch == "\x0b" or ch == "\x0c":
            self._buf.linefeed()
            return i + 1
        if ch == "\r":
            self._buf.col = 0
            self._buf.pending = False
            return i + 1
        if ch == "\x08":
            if self._buf.pending:
                self._buf.pending = False
            else:
                self._buf.col = max(0, self._buf.col - 1)
            return i + 1
        if ch == "\t":
            self._buf.col = min(self.cols - 1, (self._buf.col // 8 + 1) * 8)
            self._buf.pending = False
            return i + 1
        if ch < "\x20" or ch == "\x7f":
            return i + 1  # BEL 与残余控制符:不影响几何
        self._put(ch)
        return i + 1

    def _escape(self, data: str, i: int) -> int:
        """从 `ESC` 开始消费一条序列;消费不完(块边界)就把尾巴存进 `_tail`。"""
        n = len(data)
        if i + 1 >= n:
            self._tail = data[i:]
            return n
        nxt = data[i + 1]
        if nxt == "[":
            return self._csi(data, i)
        if nxt == "]":
            # OSC:吃到 BEL 或 ST(`ESC \`)为止,内容一律不落地(标题/链接由会话层另记)
            j = i + 2
            while j < n:
                if data[j] == "\x07":
                    return j + 1
                if data[j] == "\x1b" and j + 1 < n and data[j + 1] == "\\":
                    return j + 2
                j += 1
            self._tail = data[i:]
            return n
        if nxt in "()*+-./":
            # 字符集选择:再吃一个字节
            if i + 2 >= n:
                self._tail = data[i:]
                return n
            return i + 3
        if nxt == "7":
            self._saved[self._key()] = (self._buf.row, self._buf.col)
            return i + 2
        if nxt == "8":
            self._restore()
            return i + 2
        if nxt == "M":  # RI 反向下标
            if self._buf.row == self._buf.top:
                self._buf.scroll_down(1)
            else:
                self._buf.row = max(0, self._buf.row - 1)
            self._buf.pending = False
            return i + 2
        if nxt == "D":  # IND 下标
            self._buf.linefeed()
            return i + 2
        if nxt == "E":  # NEL 下一行行首
            self._buf.linefeed(carriage=True)
            return i + 2
        if nxt == "c":  # RIS 全复位
            self.main.reset()
            self.alt.reset()
            self.on_alt = False
            self._buf = self.main
            self.autowrap = True
            return i + 2
        return i + 2  # `ESC =` / `ESC >` / 其他双字节:无几何意义

    def _key(self) -> str:
        return "alt" if self.on_alt else "main"

    def _restore(self) -> None:
        key = self._key()
        row, col = self._saved.get(key, (0, 0))
        self._buf.row = min(row, self.rows - 1)
        self._buf.col = min(col, self.cols - 1)
        self._buf.pending = False

    def _csi(self, data: str, i: int) -> int:
        n = len(data)
        j = i + 2
        private = False
        if j < n and data[j] in "?<=>":
            private = data[j] == "?"
            j += 1
        start = j
        while j < n and (data[j].isdigit() or data[j] in ";:"):
            j += 1
        if j >= n:
            self._tail = data[i:]
            return n
        final = data[j]
        if not ("@" <= final <= "~"):
            # 不是合法 CSI 终止符(异常流):只吃掉 ESC 与 `[`,其余交回文本处理
            return i + 2
        raw = data[start:j]
        params = [int(p) if p.isdigit() else 0 for p in raw.replace(":", ";").split(";")] if raw else []
        if final == "m":
            return j + 1  # SGR:颜色不在本模块判据里
        if private and final in "hl":
            self._mode(params, set_on=final == "h")
            return j + 1
        self._geometry(final, params)
        return j + 1

    def _mode(self, params: list[int], *, set_on: bool) -> None:
        for p in params:
            if p == 7:
                self.autowrap = set_on
            elif p == 25:
                self._buf.visible = set_on
            elif p == 1048:
                if set_on:
                    self._saved[self._key()] = (self._buf.row, self._buf.col)
                else:
                    self._restore()
            elif p in (47, 1047, 1049):
                if set_on and not self.on_alt:
                    self._saved["main"] = (self._buf.row, self._buf.col)
                    self.alt.reset()
                    self.on_alt = True
                    self._buf = self.alt
                elif not set_on and self.on_alt:
                    self.on_alt = False
                    self._buf = self.main
                    row, col = self._saved.get("main", (0, 0))
                    self._buf.row = min(row, self.rows - 1)
                    self._buf.col = min(col, self.cols - 1)

    def _geometry(self, final: str, params: list[int]) -> None:
        scr = self._buf
        first = params[0] if params else 0
        count = first if first > 0 else 1
        if final == "A":  # CUU
            scr.row = max(scr.top, scr.row - count)
        elif final == "B":  # CUD
            scr.row = min(scr.bottom, scr.row + count)
        elif final == "C":  # CUF
            scr.col = min(self.cols - 1, scr.col + count)
        elif final == "D":  # CUB
            scr.col = max(0, scr.col - count)
        elif final in ("E", "F"):  # CNL / CPL
            row = scr.row + count if final == "E" else scr.row - count
            scr.row = max(scr.top, min(scr.bottom, row))
            scr.col = 0
        elif final in ("G", "`"):  # CHA
            scr.col = max(0, min(self.cols - 1, count - 1))
        elif final == "d":  # VPA
            scr.row = max(scr.top, min(scr.bottom, count - 1))
        elif final in ("H", "f"):  # CUP / HVP
            row = (params[0] if len(params) > 0 and params[0] > 0 else 1) - 1
            col = (params[1] if len(params) > 1 and params[1] > 0 else 1) - 1
            scr.row = max(0, min(self.rows - 1, row))
            scr.col = max(0, min(self.cols - 1, col))
        elif final == "J":  # ED
            which = first
            if which == 0:
                self._erase_row(scr.row, scr.col, self.cols)
                for r in range(scr.row + 1, self.rows):
                    scr.clear_row(r)
            elif which == 1:
                for r in range(scr.row):
                    scr.clear_row(r)
                self._erase_row(scr.row, 0, scr.col + 1)
            else:
                for r in range(self.rows):
                    scr.clear_row(r)
        elif final == "K":  # EL
            which = first
            if which == 0:
                self._erase_row(scr.row, scr.col, self.cols)
            elif which == 1:
                self._erase_row(scr.row, 0, scr.col + 1)
            else:
                scr.clear_row(scr.row)
        elif final == "@":  # ICH 插格
            row_cells = scr.cells[scr.row]
            for _ in range(min(count, self.cols - scr.col)):
                row_cells.insert(scr.col, "")
                row_cells.pop()
        elif final == "P":  # DCH 删格
            row_cells = scr.cells[scr.row]
            for _ in range(min(count, self.cols - scr.col)):
                del row_cells[scr.col]
                row_cells.append("")
        elif final == "X":  # ECH 抹格
            self._erase_row(scr.row, scr.col, min(self.cols, scr.col + count))
        elif final == "L":  # IL 插行
            self._block(scr, count, insert=True)
        elif final == "M":  # DL 删行
            self._block(scr, count, insert=False)
        elif final == "S":  # SU
            scr.scroll_up(count)
        elif final == "T":  # SD(注意:这是 SU/SD,不是鼠标上报)
            scr.scroll_down(count)
        elif final == "r":  # DECSTBM
            top = (params[0] if len(params) > 0 and params[0] > 0 else 1) - 1
            bottom = (params[1] if len(params) > 1 and params[1] > 0 else self.rows) - 1
            if 0 <= top < bottom < self.rows:
                scr.top, scr.bottom = top, bottom
                scr.row, scr.col = top, 0
        elif final in ("s", "u"):  # SC/RC(与 DECSC/DECRC 同效)
            if final == "s":
                self._saved[self._key()] = (scr.row, scr.col)
            else:
                self._restore()
        scr.pending = False if final not in ("m",) else scr.pending

    def _erase_row(self, row: int, start: int, end: int) -> None:
        cells = self._buf.cells[row]
        for c in range(max(0, start), min(self.cols, end)):
            cells[c] = ""

    def _block(self, scr: _Screen, count: int, *, insert: bool) -> None:
        """IL/DL:只在光标所在行与卷屏底之间搬行(不越过卷屏区)。"""
        span = scr.bottom - scr.row + 1
        count = max(1, min(count, span))
        for _ in range(count):
            if insert:
                del scr.cells[scr.bottom]
                scr.cells.insert(scr.row, [""] * self.cols)
            else:
                del scr.cells[scr.row]
                scr.cells.insert(scr.bottom, [""] * self.cols)
        scr.col = 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
