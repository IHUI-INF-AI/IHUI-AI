# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""G-415/A9 跨语言快照:钉住 str.splitlines() 的行边界语义(与前端 pySplitLines 同表)。

前端复刻本口径于 apps/web/src/components/ai/progress-sections/tool-call-summary-card.tsx
的 pySplitLines(快照表逐字同表钉在
apps/web/src/components/ai/progress-sections/__tests__/tool-call-summary-line-stats.test.tsx)。
2026-10-02 G-415/A9 实测:前端旧正则漏 \\u001c\\u001d\\u001e 三个行边界码位,
Python 对 'a\\x1cb' 得 2 行而前端得 1 行 —— 一侧改动另一侧必红(照守门 147/151
"一份表、两侧判"形状,测试级对账,不另立门)。

本文件是纯字符串断言:零 DB、零网络、零 monkeypatch,满足 AGENTS §5 测试隔离铁律。
"""

import pytest

# 与前端 tool-call-summary-line-stats.test.tsx 逐字同表(改任一侧必须同笔改另一侧)
SPLITLINES_SNAPSHOT = [
    ("a\nb", ["a", "b"]),
    ("a\r\nb", ["a", "b"]),
    ("a\rb", ["a", "b"]),
    ("a\x0bb", ["a", "b"]),  # \v 垂直制表
    ("a\x0cb", ["a", "b"]),  # \f 换页
    ("a\x1cb", ["a", "b"]),  # FS —— 前端旧正则漏掉的三个码位之一
    ("a\x1db", ["a", "b"]),  # GS —— 同上
    ("a\x1eb", ["a", "b"]),  # RS —— 同上
    ("a\x85b", ["a", "b"]),  # NEL
    ("a\u2028b\u2029c", ["a", "b", "c"]),  # LS/PS
    ("a\n", ["a"]),  # 末尾行边界不产生空行
    ("", []),
    ("a", ["a"]),
    ("a\n\n", ["a", ""]),  # 中间空行保留,只去末尾
    ("a\n\nb", ["a", "", "b"]),
]


@pytest.mark.parametrize("text,expected", SPLITLINES_SNAPSHOT, ids=[repr(t) for t, _ in SPLITLINES_SNAPSHOT])
def test_splitlines_snapshot(text: str, expected: list[str]) -> None:
    """本侧真值钉:若某天 Python 语义变化,这张表必须被有意识地重审,而不是静默漂移。"""
    assert text.splitlines() == expected


def test_snapshot_covers_file_group_record_separators() -> None:
    """表必须覆盖 \\x1c\\x1d\\x1e 三个码位(防对账表自身腐烂 —— 漏了就钉不住当年那次真漂移)。"""
    covered = [text for text, _ in SPLITLINES_SNAPSHOT if any(ch in text for ch in "\x1c\x1d\x1e")]
    assert len(covered) == 3
