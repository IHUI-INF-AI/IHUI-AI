# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""空输入行为测试(golden:generate_report([]) 与 summarize([]) 不抛异常)。"""

from aggregate import summarize
from report import generate_report


def test_generate_report_empty() -> None:
    assert generate_report([]) == "合计: ¥0.00"


def test_summarize_empty() -> None:
    assert summarize([]) == "¥0.00"
