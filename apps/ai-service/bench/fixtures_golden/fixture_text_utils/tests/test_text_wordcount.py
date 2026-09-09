"""word_count 补充用例(golden:连续空格、含标点句子)。"""

from text_utils import word_count


def test_word_count_multiple_spaces() -> None:
    assert word_count("a  b   c") == 3


def test_word_count_punctuation() -> None:
    assert word_count("Hello, world!") == 2
