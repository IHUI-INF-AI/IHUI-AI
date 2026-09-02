# fixture_calculator

迷你计算器模块(确定性,无网络)。

源码 `calc.py` 含 2 个确定性 bug(供修复类任务使用):
- `divide` 未处理除零(应安全返回 `0.0`)。
- `percentage` 漏掉 `/100`,结果放大 100 倍。

另含 1 个误导性 bug(`multiply` 误写成 `a + b`),用于额外修复任务。

`tests/test_calc.py` 对正常路径与边界均有断言;修复前 `test_divide_by_zero` /
`test_percentage` / `test_multiply` 会失败。
