"""avg_amount 边界测试(golden:单元素列表、全零金额)。"""

from report import avg_amount


def test_avg_amount_single() -> None:
    assert avg_amount([{"name": "A", "amount": 7.0}]) == 7.0


def test_avg_amount_all_zero() -> None:
    assert avg_amount([
        {"name": "A", "amount": 0.0},
        {"name": "B", "amount": 0.0},
    ]) == 0.0
