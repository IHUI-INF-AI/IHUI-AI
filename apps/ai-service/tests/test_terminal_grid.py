# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""VT 屏幕网格的判据(2026-11-21):光标位置必须"真",所以每一类原语都要钉住。

这些用例的存在理由:在网格之前,`snapshot` 拿的是**行流水**,`\\r` 刷新被记成换行、宽字符被
当成一格 —— 拿这种数据回答"光标在哪",答案必然错。这里逐条把"屏幕语义 vs 流水语义"的
分叉点写成断言,防止哪天有人把网格悄悄退回成行偏移。

注意真实输出的换行是 `\\r\\n`(两者各有几何意义):本文件按 `\\r\\n` 写日常用例,并**单独**
钉住"LF 不动列、CR 才回行首"这条 —— 把 LF 当换行+回行首是流水思维,正是要防的那种错。
"""

from __future__ import annotations

from app.services.terminal_grid import WIDE_TAIL, Grid, cell_width, row_text


def _grid(cols: int = 10, rows: int = 4) -> Grid:
    return Grid(cols, rows)


def test_printable_and_newline_move_cursor() -> None:
    g = _grid()
    g.feed("abc\r\ndef")
    assert g.lines() == ["abc", "def"]
    cur = g.cursor()
    assert (cur["row"], cur["col"]) == (2, 4)  # 第 2 行第 4 列(1 起)


def test_lf_moves_row_but_never_resets_column() -> None:
    """`\\n` 只下移一行,列**不动**;回行首是 `\\r` 的事。这是真终端语义,不是可选项。"""
    g = _grid(10, 3)
    g.feed("abc\ndef")
    assert g.lines() == ["abc", "   def"]  # 续写在第 3 列之后 ⇒ 前面是缩进
    g.feed("\rghi")
    assert g.lines() == ["abc", "ghidef"]  # `\r` 回行首后只覆盖前三格(末三格是残留)


def test_carriage_return_rewrites_same_cell_not_a_new_line() -> None:
    """`\\r` 是**改写同一行**,不是换行 —— 这正是流水冒充屏幕时会撒的第一个谎。"""
    g = _grid(20, 3)
    g.feed("下载中 10%\r下载中 99%\r完成")
    assert g.lines() == ["完成中 99%"]  # 第三次只写两字,残留尾巴是真实终端行为
    assert g.cursor()["row"] == 1


def test_pending_wrap_at_last_column() -> None:
    """写满最后一格后光标**停在**末格且置 pending;下一个字符才折行(xterm 语义)。"""
    g = _grid(5, 3)
    g.feed("abcde")
    cur = g.cursor()
    assert (cur["row"], cur["col"], cur["pending_wrap"]) == (1, 5, True)
    g.feed("f")
    assert g.lines() == ["abcde", "f"]
    assert g.cursor()["row"] == 2


def test_wide_chars_take_two_cells() -> None:
    g = _grid(6, 3)
    g.feed("中文ab")
    assert g.lines() == ["中文ab"]
    assert cell_width("中") == 2 and cell_width("a") == 1
    assert g.cursor()["col"] == 6  # 中文占 1-4 格,a 第 5 格 ⇒ 光标在第 6 格
    # 拼回文本时占位格必须**一个字符都不出**,否则每个汉字后面多一个幽灵格
    assert WIDE_TAIL not in row_text(g.screen.cells[0])
    assert g.screen.cells[0][1] == WIDE_TAIL


def test_wide_char_wraps_instead_of_half_cell() -> None:
    g = _grid(5, 3)
    g.feed("abcd中")
    assert g.lines() == ["abcd", "中"]


def test_line_feed_at_bottom_scrolls() -> None:
    g = _grid(10, 3)
    g.feed("1\r\n2\r\n3\r\n4")
    assert g.lines() == ["2", "3", "4"]


def test_decstbm_region_scrolls_only_inside() -> None:
    g = _grid(10, 5)
    g.feed("head\r\nA\r\nB\r\nC\r\ntail")
    g.feed("\x1b[2;4r")  # 卷屏区 = 2..4 行
    g.feed("\x1b[4;1H\nx")  # 移到区内底行再换行 ⇒ 只有区内滚,区外两行不动
    assert g.lines() == ["head", "B", "C", "x", "tail"]


def test_erase_display_and_line() -> None:
    g = _grid(10, 4)
    g.feed("one\r\ntwo\r\nthree")
    g.feed("\x1b[2J")
    assert g.lines() == []
    # ED 清屏**不**移动光标(真终端语义),所以先显式回左上角再写
    g.feed("\x1b[1;1Hhello world")  # 11 字符 × 10 列 ⇒ 自动折行
    assert g.lines() == ["hello worl", "d"]
    g.feed("\x1b[1;1H\x1b[K")  # EL 0:从光标抹到行尾
    assert g.lines() == ["", "d"]


def test_cup_and_line_text() -> None:
    g = _grid(20, 4)
    g.feed("alpha\r\nbeta\r\ngamma")
    g.feed("\x1b[2;3H")
    cur = g.cursor()
    assert (cur["row"], cur["col"]) == (2, 3)
    assert cur["line"] == "beta"


def test_alt_screen_keeps_main_face_and_cursor() -> None:
    """进全屏程序再退出:主屏内容与光标**原样回来**,alt 屏内容不进主屏。"""
    g = _grid(10, 3)
    g.feed("shell$ ls\r\nfile1")
    before = g.cursor()
    g.feed("\x1b[?1049h")
    assert g.on_alt is True and g.lines() == []
    g.feed("VIM SCREEN")
    g.feed("\x1b[?1049l")
    assert g.on_alt is False
    assert g.lines() == ["shell$ ls", "file1"]
    after = g.cursor()
    assert (after["row"], after["col"]) == (before["row"], before["col"])


def test_split_escape_sequences_across_chunks_are_joined() -> None:
    """块边界把 `ESC[31` 与 `m` 切开时,绝不能把那半条当文字印上去。"""
    g = _grid(10, 2)
    g.feed("\x1b[3")
    g.feed("1mred\x1b[0")
    g.feed("m")
    assert g.lines() == ["red"]


def test_unsupported_private_modes_are_consumed_not_printed() -> None:
    g = _grid(10, 2)
    g.feed("\x1b[?2004h\x1b[?1000h\x1b[?6hok")
    assert g.lines() == ["ok"]


def test_osc_hyperlink_is_consumed() -> None:
    g = _grid(20, 2)
    g.feed("\x1b]8;;https://a.b\x07点我\x1b]8;;\x07")
    assert g.lines() == ["点我"]


def test_backspace_and_tab() -> None:
    g = _grid(20, 2)
    g.feed("ab\bc")
    assert g.lines() == ["ac"]
    g.feed("\r\n\tX")
    assert g.lines()[1] == "        X"


def test_insert_delete_char_and_lines() -> None:
    g = _grid(6, 4)
    g.feed("abcdef")
    g.feed("\x1b[1;3H\x1b[@")  # ICH:光标处插空格,行尾丢一格
    assert g.lines() == ["ab cde"]
    g.feed("\x1b[1;3H\x1b[P")  # DCH:删掉刚插的那格(被挤掉的末格不会凭空回来)
    assert g.lines() == ["abcde"]
    g.feed("\x1b[1;1H\x1b[L")  # IL:光标行插入空行
    assert g.lines() == ["", "abcde"]


def test_resize_clamps_cursor_and_clips() -> None:
    g = _grid(10, 3)
    g.feed("abcdefghij\r\nklm\r\n\x1b[3;10H")
    g.resize(6, 2)
    cur = g.cursor()
    assert (cur["cols"], cur["rows"]) == (6, 2)
    assert (cur["row"], cur["col"]) == (2, 6)
    # 裁切不做 reflow:第一行刚好 6 格,第二行原样保留
    assert g.lines() == ["abcdef", "klm"]


def test_cursor_visibility_toggle() -> None:
    g = _grid(10, 2)
    g.feed("\x1b[?25l")
    assert g.cursor()["visible"] is False
    g.feed("\x1b[?25h")
    assert g.cursor()["visible"] is True


def test_decsc_decrc_roundtrip() -> None:
    g = _grid(10, 3)
    g.feed("abc")
    g.feed("\x1b7")  # 存光标
    g.feed("\r\nxyz\x1b[1;1H")
    g.feed("\x1b8")  # 取回
    cur = g.cursor()
    assert (cur["row"], cur["col"]) == (1, 4)


def test_combining_mark_sticks_to_previous_cell() -> None:
    """组合符是零宽:它必须贴到前一格上,不能自己占一格(否则 "e\u0301" 变两格)。"""
    g = _grid(6, 2)
    g.feed("e\u0301x")
    assert g.screen.cells[0][0] == "e\u0301"
    assert g.cursor()["col"] == 3
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
