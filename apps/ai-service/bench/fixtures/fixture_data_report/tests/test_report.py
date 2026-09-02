"""report / aggregate 的确定性测试(基于行为,重构后仍应全部通过)。"""

from report import generate_report, format_currency, avg_amount
from aggregate import summarize


def test_generate_report() -> None:
    out = generate_report([
        {"name": "A", "amount": 10.0},
        {"name": "B", "amount": 20.0},
    ])
    assert "A: ¥10.00" in out
    assert "B: ¥20.00" in out
    assert "合计: ¥30.00" in out


def test_summarize() -> None:
    assert summarize([
        {"name": "A", "amount": 5.0},
        {"name": "B", "amount": 5.0},
    ]) == "¥10.00"


def test_format_currency() -> None:
    assert format_currency(3.5) == "¥3.50"


def test_avg_amount() -> None:
    # 期望平均值 15.0(当前 bug 返回 30.0)
    assert avg_amount([
        {"name": "A", "amount": 10.0},
        {"name": "B", "amount": 20.0},
    ]) == 15.0
