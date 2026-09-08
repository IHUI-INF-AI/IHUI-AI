"""divide 的完整测试套件(golden:整除、非整除、除零安全)。"""

from calc import divide


def test_divide_exact() -> None:
    assert divide(10, 2) == 5


def test_divide_inexact() -> None:
    assert divide(7, 2) == 3.5


def test_divide_by_zero_safe() -> None:
    assert divide(1, 0) == 0.0
