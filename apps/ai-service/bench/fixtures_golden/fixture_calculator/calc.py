"""迷你计算器模块(golden 参考实现:全部 bug 已修复 + power/_is_number)。"""

from ops import add, subtract, multiply, divide, percentage, average  # noqa: F401


def _is_number(value: object) -> bool:
    """校验输入是否为合法数值(bool 视为非数值)。"""
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def power(a: float, b: float) -> float:
    """幂运算:返回 a 的 b 次幂。"""
    return a ** b
