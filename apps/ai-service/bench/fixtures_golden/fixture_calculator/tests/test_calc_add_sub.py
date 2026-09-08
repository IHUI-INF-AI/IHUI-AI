"""add/subtract 的组合用例(golden)。"""

from calc import add, subtract


def test_add_subtract_combo() -> None:
    assert subtract(add(1, 2), 3) == 0


def test_add_zero_identity() -> None:
    assert add(5, 0) == 5
