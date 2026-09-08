"""空输入行为测试(golden:generate_report([]) 与 summarize([]) 不抛异常)。"""

from report import generate_report
from aggregate import summarize


def test_generate_report_empty() -> None:
    assert generate_report([]) == "合计: ¥0.00"


def test_summarize_empty() -> None:
    assert summarize([]) == "¥0.00"
