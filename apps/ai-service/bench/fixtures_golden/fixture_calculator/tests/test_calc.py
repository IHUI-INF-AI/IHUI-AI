"""calc 模块的确定性测试(golden:补充 slugify 无关,此为计算器基线用例)。"""

from calc import add, subtract, multiply, divide, percentage, average


def test_add() -> None:
    assert add(2, 3) == 5


def test_subtract() -> None:
    assert subtract(5, 2) == 3


def test_multiply() -> None:
    assert multiply(3, 4) == 12


def test_divide_normal() -> None:
    assert divide(6, 3) == 2


def test_divide_by_zero() -> None:
    assert divide(1, 0) == 0.0


def test_percentage() -> None:
    assert percentage(50, 10) == 5.0


def test_average() -> None:
    assert average([1.0, 2.0, 3.0]) == 2.0


def test_average_empty() -> None:
    assert average([]) == 0.0
