# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""divide 的完整测试套件(golden:整除、非整除、除零安全)。"""

from calc import divide


def test_divide_exact() -> None:
    assert divide(10, 2) == 5


def test_divide_inexact() -> None:
    assert divide(7, 2) == 3.5


def test_divide_by_zero_safe() -> None:
    assert divide(1, 0) == 0.0
