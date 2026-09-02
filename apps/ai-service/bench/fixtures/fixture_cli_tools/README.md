# fixture_cli_tools

命令行小工具(确定性,无网络)。

`cli.py` 含两类待修复问题:

- **坏 import**:`import nonexistent_fake_module` 会导致整体 ImportError,
  任何测试都无法导入该模块。
- **死代码**:`dead_code_helper()` 从未被调用,应删除。

`tests/test_cli.py` 在坏 import 被修复前会整体报错(无法 import `cli`)。
