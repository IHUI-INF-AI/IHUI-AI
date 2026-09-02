"""cli 模块的确定性测试。"""

from cli import greet, main


def test_greet() -> None:
    assert greet("World") == "Hello, World!"


def test_main_prints(capsys) -> None:
    rc = main(["Alice"])
    assert rc == 0
    assert "Alice" in capsys.readouterr().out
