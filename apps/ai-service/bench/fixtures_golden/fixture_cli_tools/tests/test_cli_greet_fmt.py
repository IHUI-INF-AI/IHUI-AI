"""cli.greet 输出格式测试(golden:空字符串、含空格名字)。"""

from cli import greet


def test_greet_empty() -> None:
    assert greet("") == "Hello, !"


def test_greet_spaced_name() -> None:
    assert greet("Li Chunchuan") == "Hello, Li Chunchuan!"
