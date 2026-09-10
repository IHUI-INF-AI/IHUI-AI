# IHUI-Bench v0 报告

- 任务总数: 41
- 通过: 41
- 通过率: 100.0%

| 任务ID                          | 类别      | 夹具                | 迭代 | 耗时(ms) | 检查 | 结果 |
| ------------------------------- | --------- | ------------------- | ---- | -------- | ---- | ---- |
| fix-calc-divzero                | fix       | fixture_calculator  | 0    | 0.0      | 1/1  | PASS |
| fix-calc-percent                | fix       | fixture_calculator  | 0    | 0.0      | 1/1  | PASS |
| fix-calc-multiply               | fix       | fixture_calculator  | 0    | 0.0      | 1/1  | PASS |
| fix-cli-import                  | fix       | fixture_cli_tools   | 0    | 0.0      | 1/1  | PASS |
| fix-cli-deadcode                | fix       | fixture_cli_tools   | 0    | 0.0      | 1/1  | PASS |
| fix-text-reverse                | fix       | fixture_text_utils  | 0    | 0.0      | 1/1  | PASS |
| fix-report-avg                  | fix       | fixture_data_report | 0    | 0.0      | 1/1  | PASS |
| fix-report-total                | fix       | fixture_data_report | 0    | 0.0      | 1/1  | PASS |
| test-text-slugify               | test      | fixture_text_utils  | 0    | 0.0      | 1/1  | PASS |
| test-calc-edge                  | test      | fixture_calculator  | 0    | 0.0      | 1/1  | PASS |
| test-cli-errors                 | test      | fixture_cli_tools   | 0    | 0.0      | 1/1  | PASS |
| test-report-empty               | test      | fixture_data_report | 0    | 0.0      | 1/1  | PASS |
| test-text-wordcount             | test      | fixture_text_utils  | 0    | 0.0      | 1/1  | PASS |
| refactor-report-common          | refactor  | fixture_data_report | 0    | 0.0      | 2/2  | PASS |
| refactor-calc-validate          | refactor  | fixture_calculator  | 0    | 0.0      | 2/2  | PASS |
| refactor-cli-dispatch           | refactor  | fixture_cli_tools   | 0    | 0.0      | 2/2  | PASS |
| refactor-text-normalize         | refactor  | fixture_text_utils  | 0    | 0.0      | 2/2  | PASS |
| multifile-report-split          | multifile | fixture_data_report | 0    | 0.0      | 3/3  | PASS |
| multifile-cli-parser            | multifile | fixture_cli_tools   | 0    | 0.0      | 2/2  | PASS |
| multifile-calc-split            | multifile | fixture_calculator  | 0    | 0.0      | 2/2  | PASS |
| fix-calc-multiply-percent       | fix       | fixture_calculator  | 0    | 0.0      | 2/2  | PASS |
| feature-calc-power              | feature   | fixture_calculator  | 0    | 0.0      | 2/2  | PASS |
| test-calc-divide-suite          | test      | fixture_calculator  | 0    | 0.0      | 1/1  | PASS |
| feature-text-truncate           | feature   | fixture_text_utils  | 0    | 0.0      | 2/2  | PASS |
| feature-text-title-case         | feature   | fixture_text_utils  | 0    | 0.0      | 2/2  | PASS |
| test-text-uppercase-edge        | test      | fixture_text_utils  | 0    | 0.0      | 1/1  | PASS |
| fix-report-both-bugs            | fix       | fixture_data_report | 0    | 0.0      | 2/2  | PASS |
| feature-report-count            | feature   | fixture_data_report | 0    | 0.0      | 2/2  | PASS |
| test-report-summarize-extra     | test      | fixture_data_report | 0    | 0.0      | 1/1  | PASS |
| fix-cli-greet                   | fix       | fixture_cli_tools   | 0    | 0.0      | 1/1  | PASS |
| feature-cli-main-exit-code      | feature   | fixture_cli_tools   | 0    | 0.0      | 1/1  | PASS |
| fix-cli-full-clean              | fix       | fixture_cli_tools   | 0    | 0.0      | 3/3  | PASS |
| feature-cli-add-command         | feature   | fixture_cli_tools   | 0    | 0.0      | 2/2  | PASS |
| test-calc-add-subtract          | test      | fixture_calculator  | 0    | 0.0      | 1/1  | PASS |
| test-cli-greet-format           | test      | fixture_cli_tools   | 0    | 0.0      | 1/1  | PASS |
| test-report-avg-edge            | test      | fixture_data_report | 0    | 0.0      | 1/1  | PASS |
| test-text-reverse-edge          | test      | fixture_text_utils  | 0    | 0.0      | 1/1  | PASS |
| refactor-calc-docstrings        | refactor  | fixture_calculator  | 0    | 0.0      | 2/2  | PASS |
| refactor-cli-type-hints         | refactor  | fixture_cli_tools   | 0    | 0.0      | 2/2  | PASS |
| refactor-report-avg-safe        | refactor  | fixture_data_report | 0    | 0.0      | 2/2  | PASS |
| refactor-text-reverse-normalize | refactor  | fixture_text_utils  | 0    | 0.0      | 2/2  | PASS |

## 逐任务检查明细

### fix-calc-divzero — 修复计算器除零崩溃

- 类别: fix / 夹具: fixture_calculator
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.02s)

### fix-calc-percent — 修复百分比计算放大 100 倍

- 类别: fix / 夹具: fixture_calculator
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.02s)

### fix-calc-multiply — 修复乘法写成加法

- 类别: fix / 夹具: fixture_calculator
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.02s)

### fix-cli-import — 移除坏 import 让模块可导入

- 类别: fix / 夹具: fixture_cli_tools
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (2 passed in 0.02s)

### fix-cli-deadcode — 删除死代码函数

- 类别: fix / 夹具: fixture_cli_tools
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `file_not_contains`: 不包含子串: 'dead_code_helper'

### fix-text-reverse — 修复字符串反转步长

- 类别: fix / 夹具: fixture_text_utils
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.02s)

### fix-report-avg — 修复平均金额除以 1 的 bug

- 类别: fix / 夹具: fixture_data_report
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.09s)

### fix-report-total — 修复合计 off-by-one 累加

- 类别: fix / 夹具: fixture_data_report
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.10s)

### test-text-slugify — 为 slugify 补测试

- 类别: test / 夹具: fixture_text_utils
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `file_contains`: 包含子串: 'def test_slugify'

### test-calc-edge — 为计算器补充边界测试

- 类别: test / 夹具: fixture_calculator
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_file_exists`: 存在: tests/test_calc_edge.py

### test-cli-errors — 为 CLI 错误路径补测试

- 类别: test / 夹具: fixture_cli_tools
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_file_exists`: 存在: tests/test_cli_errors.py

### test-report-empty — 为数据汇总补空输入测试

- 类别: test / 夹具: fixture_data_report
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_file_exists`: 存在: tests/test_report_empty.py

### test-text-wordcount — 为词数统计补更多测试

- 类别: test / 夹具: fixture_text_utils
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_file_exists`: 存在: tests/test_text_wordcount.py

### refactor-report-common — 提取重复的货币格式化逻辑

- 类别: refactor / 夹具: fixture_data_report
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (4 passed in 0.44s)
- [OK] `file_contains`: 包含子串: 'def format_currency'

### refactor-calc-validate — 提取数值校验辅助函数

- 类别: refactor / 夹具: fixture_calculator
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (8 passed in 0.03s)
- [OK] `file_contains`: 包含子串: 'def _is_number'

### refactor-cli-dispatch — 提取命令分发逻辑

- 类别: refactor / 夹具: fixture_cli_tools
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (2 passed in 0.02s)
- [OK] `file_contains`: 包含子串: 'def dispatch'

### refactor-text-normalize — 提取空白归一化辅助函数

- 类别: refactor / 夹具: fixture_text_utils
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (6 passed in 0.03s)
- [OK] `file_contains`: 包含子串: 'def normalize_whitespace'

### multifile-report-split — 拆分报表为数据与格式化两个模块

- 类别: multifile / 夹具: fixture_data_report
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (4 passed in 0.05s)
- [OK] `file_contains`: 包含子串: 'def generate_report'
- [OK] `file_contains`: 包含子串: 'def format_currency'

### multifile-cli-parser — 将参数解析移到独立模块

- 类别: multifile / 夹具: fixture_cli_tools
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (2 passed in 0.02s)
- [OK] `file_contains`: 包含子串: 'def parse_args'

### multifile-calc-split — 拆分计算器为运算与 IO 两模块

- 类别: multifile / 夹具: fixture_calculator
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (8 passed in 0.03s)
- [OK] `file_contains`: 包含子串: 'def add'

### fix-calc-multiply-percent — 一次修复乘法与百分比两个 bug

- 类别: fix / 夹具: fixture_calculator
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.02s)
- [OK] `pytest_pass`: exit=0 (1 passed in 0.01s)

### feature-calc-power — 为计算器新增 power 幂运算

- 类别: feature / 夹具: fixture_calculator
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `file_contains`: 包含子串: 'def power'
- [OK] `pytest_pass`: exit=0 (8 passed in 0.03s)

### test-calc-divide-suite — 为 divide 补完整测试套件

- 类别: test / 夹具: fixture_calculator
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_file_exists`: 存在: tests/test_calc_divide.py

### feature-text-truncate — 新增 truncate 文本截断函数

- 类别: feature / 夹具: fixture_text_utils
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `file_contains`: 包含子串: 'def truncate'
- [OK] `pytest_pass`: exit=0 (6 passed in 0.02s)

### feature-text-title-case — 新增 title_case 首字母大写函数

- 类别: feature / 夹具: fixture_text_utils
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `file_contains`: 包含子串: 'def title_case'
- [OK] `pytest_pass`: exit=0 (6 passed in 0.02s)

### test-text-uppercase-edge — 为 to_uppercase 补边界测试

- 类别: test / 夹具: fixture_text_utils
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_file_exists`: 存在: tests/test_text_upper_edge.py

### fix-report-both-bugs — 一次修复报表合计与平均值两个 bug

- 类别: fix / 夹具: fixture_data_report
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.04s)
- [OK] `pytest_pass`: exit=0 (1 passed in 0.01s)

### feature-report-count — 新增 count_rows 行数统计函数

- 类别: feature / 夹具: fixture_data_report
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `file_contains`: 包含子串: 'def count_rows'
- [OK] `pytest_pass`: exit=0 (4 passed in 0.09s)

### test-report-summarize-extra — 为 summarize 补补充用例

- 类别: test / 夹具: fixture_data_report
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_file_exists`: 存在: tests/test_report_summarize.py

### fix-cli-greet — 让 greet 测试恢复可通过

- 类别: fix / 夹具: fixture_cli_tools
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.02s)

### feature-cli-main-exit-code — 让 main 退出码测试恢复可通过

- 类别: feature / 夹具: fixture_cli_tools
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.02s)

### fix-cli-full-clean — 彻底清理 cli 坏 import 与死代码

- 类别: fix / 夹具: fixture_cli_tools
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (2 passed in 0.02s)
- [OK] `file_not_contains`: 不包含子串: 'nonexistent_fake_module'
- [OK] `file_not_contains`: 不包含子串: 'dead_code_helper'

### feature-cli-add-command — 为 CLI 新增 add 子命令

- 类别: feature / 夹具: fixture_cli_tools
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `file_contains`: 包含子串: 'def cmd_add'
- [OK] `pytest_pass`: exit=0 (2 passed in 0.12s)

### test-calc-add-subtract — 为 add/subtract 补组合测试

- 类别: test / 夹具: fixture_calculator
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_file_exists`: 存在: tests/test_calc_add_sub.py

### test-cli-greet-format — 为 greet 输出格式补测试

- 类别: test / 夹具: fixture_cli_tools
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_file_exists`: 存在: tests/test_cli_greet_fmt.py

### test-report-avg-edge — 为 avg_amount 补边界测试

- 类别: test / 夹具: fixture_data_report
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_file_exists`: 存在: tests/test_report_avg_edge.py

### test-text-reverse-edge — 为 reverse 补边界测试

- 类别: test / 夹具: fixture_text_utils
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_file_exists`: 存在: tests/test_text_reverse_edge.py

### refactor-calc-docstrings — 清理 calc.py 的 bug 注释并全绿

- 类别: refactor / 夹具: fixture_calculator
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (8 passed in 0.03s)
- [OK] `file_not_contains`: 不包含子串: '故意埋设的 bug'

### refactor-cli-type-hints — 为 cli.py 补全类型注解

- 类别: refactor / 夹具: fixture_cli_tools
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (2 passed in 0.02s)
- [OK] `file_contains`: 包含子串: 'argv: list[str]'

### refactor-report-avg-safe — 为 avg_amount 添加空列表保护

- 类别: refactor / 夹具: fixture_data_report
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.05s)
- [OK] `file_contains`: 包含子串: 'if not rows'

### refactor-text-reverse-normalize — 修复 reverse 并提取空白归一化

- 类别: refactor / 夹具: fixture_text_utils
- 迭代: 0 / 停止原因: golden / 耗时: 0.0ms

- [OK] `pytest_pass`: exit=0 (6 passed in 0.02s)
- [OK] `file_contains`: 包含子串: 'def _normalize_words'
