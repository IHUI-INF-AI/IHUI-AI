"""reverse 边界用例(golden:空字符串、单字符、回文)。"""

from text_utils import reverse


def test_reverse_empty() -> None:
    assert reverse("") == ""


def test_reverse_single() -> None:
    assert reverse("a") == "a"


def test_reverse_palindrome() -> None:
    assert reverse("aba") == "aba"
