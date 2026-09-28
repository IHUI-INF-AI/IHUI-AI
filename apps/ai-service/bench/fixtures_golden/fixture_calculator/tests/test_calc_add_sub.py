# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""add/subtract 的组合用例(golden)。"""

from calc import add, subtract


def test_add_subtract_combo() -> None:
    assert subtract(add(1, 2), 3) == 0


def test_add_zero_identity() -> None:
    assert add(5, 0) == 5
