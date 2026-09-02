"""text_utils 的确定性测试(缺失 slugify 的测试)。"""

from text_utils import word_count, to_uppercase, reverse


def test_word_count() -> None:
    assert word_count("hello world foo") == 3


def test_word_count_empty() -> None:
    assert word_count("") == 0


def test_to_uppercase() -> None:
    assert to_uppercase("abc") == "ABC"


def test_reverse() -> None:
    # 期望反转(当前 bug 不反转)
    assert reverse("abc") == "cba"
