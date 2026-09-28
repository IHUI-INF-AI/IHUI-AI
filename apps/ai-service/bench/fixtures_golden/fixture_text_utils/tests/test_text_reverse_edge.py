# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""reverse 边界用例(golden:空字符串、单字符、回文)。"""

from text_utils import reverse


def test_reverse_empty() -> None:
    assert reverse("") == ""


def test_reverse_single() -> None:
    assert reverse("a") == "a"


def test_reverse_palindrome() -> None:
    assert reverse("aba") == "aba"
