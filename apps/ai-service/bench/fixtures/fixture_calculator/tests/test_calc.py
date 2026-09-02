"""calc 模块的确定性测试。"""

from calc import add, subtract, multiply, divide, percentage, average


def test_add() -> None:
    assert add(2, 3) == 5


def test_subtract() -> None:
    assert subtract(5, 2) == 3


def test_multiply() -> None:
    # 期望 3 * 4 == 12(当前 bug 返回 7)
    assert multiply(3, 4) == 12


def test_divide_normal() -> None:
    assert divide(6, 3) == 2


def test_divide_by_zero() -> None:
    # 期望除零安全返回 0.0(当前 bug 会抛 ZeroDivisionError)
    assert divide(1, 0) == 0.0


def test_percentage() -> None:
    # 期望 50 的 10% == 5.0(当前 bug 返回 500)
    assert percentage(50, 10) == 5.0


def test_average() -> None:
    assert average([1.0, 2.0, 3.0]) == 2.0


def test_average_empty() -> None:
    assert average([]) == 0.0
