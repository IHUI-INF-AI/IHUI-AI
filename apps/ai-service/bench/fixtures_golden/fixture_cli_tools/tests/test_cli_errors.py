"""cli.main 无参数退出码测试(golden)。"""

import pytest

from cli import main


def test_main_no_args_returns_1(capsys) -> None:
    assert main([]) == 1
    assert "usage" in capsys.readouterr().out
