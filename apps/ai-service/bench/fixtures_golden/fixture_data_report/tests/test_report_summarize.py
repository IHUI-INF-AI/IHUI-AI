"""summarize 补充用例(golden:单行记录、空列表返回 ¥0.00)。"""

from aggregate import summarize


def test_summarize_single_row() -> None:
    assert summarize([{"name": "A", "amount": 8.0}]) == "¥8.00"


def test_summarize_empty() -> None:
    assert summarize([]) == "¥0.00"
