"""add/subtract 的边界用例(golden:负数、零)。"""

from calc import add, subtract


def test_add_zero() -> None:
    assert add(0, 0) == 0


def test_add_negative() -> None:
    assert add(-3, -4) == -7


def test_subtract_to_positive() -> None:
    assert subtract(-2, -5) == 3
