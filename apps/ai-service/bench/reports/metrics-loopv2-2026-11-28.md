<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI-Bench v0 报告

- 任务总数: 41
- 通过: 0
- 通过率: 0.0%

## 指标面

| 维度 | p50 | p90 | p99 | 均值 | 最大 | 合计 |
|---|---|---|---|---|---|---|
| 工具轮次 | 1.0 | 7.0 | 9.6 | 2.88 | 10.0 | 118.0 |
| 耗时(ms) | 3874.9 | 67536.0 | 110811.22 | 25330.12 | 114126.1 | 1038535.1 |
| token(估算) | 50.0 | 779.0 | 2429.8 | 347.8 | 3161.0 | 14260.0 |
| 工具调用数 | 0.0 | 7.0 | 10.6 | 2.07 | 11.0 | 85.0 |

- token 样本: 41 条（0 条为 0，未参与均值/分位）
- 零工具调用任务: 25 / 41

### 失败分类

- `execution_error`: 25
- `iteration_exhausted`: 1
- `checks_failed`: 15

### 失败明细

- `fix-calc-divzero`（fix）→ `checks_failed`：失败检查: pytest_pass
- `fix-calc-percent`（fix）→ `checks_failed`：失败检查: pytest_pass
- `fix-calc-multiply`（fix）→ `checks_failed`：失败检查: pytest_pass
- `fix-cli-import`（fix）→ `checks_failed`：失败检查: pytest_pass
- `fix-cli-deadcode`（fix）→ `checks_failed`：失败检查: file_not_contains
- `fix-text-reverse`（fix）→ `checks_failed`：失败检查: pytest_pass
- `fix-report-avg`（fix）→ `checks_failed`：失败检查: pytest_pass
- `fix-report-total`（fix）→ `checks_failed`：失败检查: pytest_pass
- `test-text-slugify`（test）→ `checks_failed`：失败检查: file_contains
- `test-calc-edge`（test）→ `checks_failed`：失败检查: pytest_file_exists
- `test-cli-errors`（test）→ `checks_failed`：失败检查: pytest_file_exists
- `test-report-empty`（test）→ `checks_failed`：失败检查: pytest_file_exists
- `test-text-wordcount`（test）→ `checks_failed`：失败检查: pytest_file_exists
- `refactor-report-common`（refactor）→ `checks_failed`：失败检查: file_contains,pytest_pass
- `refactor-calc-validate`（refactor）→ `iteration_exhausted`：失败检查: file_contains,pytest_pass
- `refactor-cli-dispatch`（refactor）→ `checks_failed`：失败检查: file_contains,pytest_pass
- `refactor-text-normalize`（refactor）→ `execution_error`：失败检查: file_contains,pytest_pass
- `multifile-report-split`（multifile）→ `execution_error`：失败检查: file_contains,pytest_pass
- `multifile-cli-parser`（multifile）→ `execution_error`：失败检查: file_contains,pytest_pass
- `multifile-calc-split`（multifile）→ `execution_error`：失败检查: file_contains,pytest_pass
- `fix-calc-multiply-percent`（fix）→ `execution_error`：失败检查: pytest_pass
- `feature-calc-power`（feature）→ `execution_error`：失败检查: file_contains,pytest_pass
- `test-calc-divide-suite`（test）→ `execution_error`：失败检查: pytest_file_exists
- `feature-text-truncate`（feature）→ `execution_error`：失败检查: file_contains,pytest_pass
- `feature-text-title-case`（feature）→ `execution_error`：失败检查: file_contains,pytest_pass
- `test-text-uppercase-edge`（test）→ `execution_error`：失败检查: pytest_file_exists
- `fix-report-both-bugs`（fix）→ `execution_error`：失败检查: pytest_pass
- `feature-report-count`（feature）→ `execution_error`：失败检查: file_contains,pytest_pass
- `test-report-summarize-extra`（test）→ `execution_error`：失败检查: pytest_file_exists
- `fix-cli-greet`（fix）→ `execution_error`：失败检查: pytest_pass
- `feature-cli-main-exit-code`（feature）→ `execution_error`：失败检查: pytest_pass
- `fix-cli-full-clean`（fix）→ `execution_error`：失败检查: file_not_contains,pytest_pass
- `feature-cli-add-command`（feature）→ `execution_error`：失败检查: file_contains,pytest_pass
- `test-calc-add-subtract`（test）→ `execution_error`：失败检查: pytest_file_exists
- `test-cli-greet-format`（test）→ `execution_error`：失败检查: pytest_file_exists
- `test-report-avg-edge`（test）→ `execution_error`：失败检查: pytest_file_exists
- `test-text-reverse-edge`（test）→ `execution_error`：失败检查: pytest_file_exists
- `refactor-calc-docstrings`（refactor）→ `execution_error`：失败检查: file_not_contains,pytest_pass
- `refactor-cli-type-hints`（refactor）→ `execution_error`：失败检查: file_contains,pytest_pass
- `refactor-report-avg-safe`（refactor）→ `execution_error`：失败检查: file_contains,pytest_pass
- `refactor-text-reverse-normalize`（refactor）→ `execution_error`：失败检查: file_contains,pytest_pass

### 分类别

| 类别 | 通过/总数 | 通过率 | 轮次 p50 |
|---|---|---|---|
| feature | 0/6 | 0.0% | 1.0 |
| fix | 0/12 | 0.0% | 3.5 |
| multifile | 0/3 | 0.0% | 1.0 |
| refactor | 0/8 | 0.0% | 1.0 |
| test | 0/12 | 0.0% | 1.0 |

| 任务ID | 类别 | 夹具 | 迭代 | 耗时(ms) | 检查 | 结果 |
|---|---|---|---|---|---|---|
| fix-calc-divzero | fix | fixture_calculator | 4 | 48162.7 | 0/1 | FAIL |
| fix-calc-percent | fix | fixture_calculator | 6 | 62344.7 | 0/1 | FAIL |
| fix-calc-multiply | fix | fixture_calculator | 5 | 53678.4 | 0/1 | FAIL |
| fix-cli-import | fix | fixture_cli_tools | 4 | 19759.8 | 0/1 | FAIL |
| fix-cli-deadcode | fix | fixture_cli_tools | 8 | 67536.0 | 0/1 | FAIL |
| fix-text-reverse | fix | fixture_text_utils | 3 | 96249.8 | 0/1 | FAIL |
| fix-report-avg | fix | fixture_data_report | 3 | 14525.8 | 0/1 | FAIL |
| fix-report-total | fix | fixture_data_report | 5 | 42950.5 | 0/1 | FAIL |
| test-text-slugify | test | fixture_text_utils | 5 | 29271.2 | 0/1 | FAIL |
| test-calc-edge | test | fixture_calculator | 7 | 67863.0 | 0/1 | FAIL |
| test-cli-errors | test | fixture_cli_tools | 6 | 62116.8 | 0/1 | FAIL |
| test-report-empty | test | fixture_data_report | 7 | 49757.1 | 0/1 | FAIL |
| test-text-wordcount | test | fixture_text_utils | 9 | 105838.9 | 0/1 | FAIL |
| refactor-report-common | refactor | fixture_data_report | 6 | 114126.1 | 0/2 | FAIL |
| refactor-calc-validate | refactor | fixture_calculator | 10 | 51687.2 | 0/2 | FAIL |
| refactor-cli-dispatch | refactor | fixture_cli_tools | 5 | 58889.6 | 0/2 | FAIL |
| refactor-text-normalize | refactor | fixture_text_utils | 1 | 4214.5 | 0/2 | FAIL |
| multifile-report-split | multifile | fixture_data_report | 1 | 4082.0 | 0/3 | FAIL |
| multifile-cli-parser | multifile | fixture_cli_tools | 1 | 3581.4 | 0/2 | FAIL |
| multifile-calc-split | multifile | fixture_calculator | 1 | 3802.7 | 0/2 | FAIL |
| fix-calc-multiply-percent | fix | fixture_calculator | 1 | 3512.8 | 0/2 | FAIL |
| feature-calc-power | feature | fixture_calculator | 1 | 4030.9 | 0/2 | FAIL |
| test-calc-divide-suite | test | fixture_calculator | 1 | 3499.4 | 0/1 | FAIL |
| feature-text-truncate | feature | fixture_text_utils | 1 | 3578.0 | 0/2 | FAIL |
| feature-text-title-case | feature | fixture_text_utils | 1 | 3637.0 | 0/2 | FAIL |
| test-text-uppercase-edge | test | fixture_text_utils | 1 | 3770.5 | 0/1 | FAIL |
| fix-report-both-bugs | fix | fixture_data_report | 1 | 3653.8 | 0/2 | FAIL |
| feature-report-count | feature | fixture_data_report | 1 | 3708.9 | 0/2 | FAIL |
| test-report-summarize-extra | test | fixture_data_report | 1 | 3705.5 | 0/1 | FAIL |
| fix-cli-greet | fix | fixture_cli_tools | 1 | 3727.3 | 0/1 | FAIL |
| feature-cli-main-exit-code | feature | fixture_cli_tools | 1 | 3874.9 | 0/1 | FAIL |
| fix-cli-full-clean | fix | fixture_cli_tools | 1 | 3701.6 | 0/3 | FAIL |
| feature-cli-add-command | feature | fixture_cli_tools | 1 | 3774.0 | 0/2 | FAIL |
| test-calc-add-subtract | test | fixture_calculator | 1 | 4199.1 | 0/1 | FAIL |
| test-cli-greet-format | test | fixture_cli_tools | 1 | 3673.4 | 0/1 | FAIL |
| test-report-avg-edge | test | fixture_data_report | 1 | 3608.5 | 0/1 | FAIL |
| test-text-reverse-edge | test | fixture_text_utils | 1 | 3644.1 | 0/1 | FAIL |
| refactor-calc-docstrings | refactor | fixture_calculator | 1 | 3608.8 | 0/2 | FAIL |
| refactor-cli-type-hints | refactor | fixture_cli_tools | 1 | 3570.1 | 0/2 | FAIL |
| refactor-report-avg-safe | refactor | fixture_data_report | 1 | 3827.0 | 0/2 | FAIL |
| refactor-text-reverse-normalize | refactor | fixture_text_utils | 1 | 3791.3 | 0/2 | FAIL |

## 逐任务检查明细

### fix-calc-divzero — 修复计算器除零崩溃

- 类别: fix / 夹具: fixture_calculator
- 迭代: 4 / 停止原因: completed / 耗时: 48162.7ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (1 failed in 0.13s)

### fix-calc-percent — 修复百分比计算放大 100 倍

- 类别: fix / 夹具: fixture_calculator
- 迭代: 6 / 停止原因: completed / 耗时: 62344.7ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (1 failed in 0.12s)

### fix-calc-multiply — 修复乘法写成加法

- 类别: fix / 夹具: fixture_calculator
- 迭代: 5 / 停止原因: completed / 耗时: 53678.4ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (1 failed in 0.10s)

### fix-cli-import — 移除坏 import 让模块可导入

- 类别: fix / 夹具: fixture_cli_tools
- 迭代: 4 / 停止原因: completed / 耗时: 19759.8ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=2 (1 error in 0.21s)

### fix-cli-deadcode — 删除死代码函数

- 类别: fix / 夹具: fixture_cli_tools
- 迭代: 8 / 停止原因: completed / 耗时: 67536.0ms / 自愈触发: 0 次

- [X] `file_not_contains`: 仍包含子串: 'dead_code_helper'

### fix-text-reverse — 修复字符串反转步长

- 类别: fix / 夹具: fixture_text_utils
- 迭代: 3 / 停止原因: completed / 耗时: 96249.8ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (1 failed in 0.10s)

### fix-report-avg — 修复平均金额除以 1 的 bug

- 类别: fix / 夹具: fixture_data_report
- 迭代: 3 / 停止原因: completed / 耗时: 14525.8ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (1 failed in 0.18s)

### fix-report-total — 修复合计 off-by-one 累加

- 类别: fix / 夹具: fixture_data_report
- 迭代: 5 / 停止原因: completed / 耗时: 42950.5ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (1 failed in 0.11s)

### test-text-slugify — 为 slugify 补测试

- 类别: test / 夹具: fixture_text_utils
- 迭代: 5 / 停止原因: completed / 耗时: 29271.2ms / 自愈触发: 0 次

- [X] `file_contains`: 不包含子串: 'def test_slugify'

### test-calc-edge — 为计算器补充边界测试

- 类别: test / 夹具: fixture_calculator
- 迭代: 7 / 停止原因: completed / 耗时: 67863.0ms / 自愈触发: 0 次

- [X] `pytest_file_exists`: 不存在: tests/test_calc_edge.py

### test-cli-errors — 为 CLI 错误路径补测试

- 类别: test / 夹具: fixture_cli_tools
- 迭代: 6 / 停止原因: completed / 耗时: 62116.8ms / 自愈触发: 0 次

- [X] `pytest_file_exists`: 不存在: tests/test_cli_errors.py

### test-report-empty — 为数据汇总补空输入测试

- 类别: test / 夹具: fixture_data_report
- 迭代: 7 / 停止原因: completed / 耗时: 49757.1ms / 自愈触发: 0 次

- [X] `pytest_file_exists`: 不存在: tests/test_report_empty.py

### test-text-wordcount — 为词数统计补更多测试

- 类别: test / 夹具: fixture_text_utils
- 迭代: 9 / 停止原因: completed / 耗时: 105838.9ms / 自愈触发: 0 次

- [X] `pytest_file_exists`: 不存在: tests/test_text_wordcount.py

### refactor-report-common — 提取重复的货币格式化逻辑

- 类别: refactor / 夹具: fixture_data_report
- 迭代: 6 / 停止原因: completed / 耗时: 114126.1ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (2 failed, 2 passed in 0.09s)
- [X] `file_contains`: 文件不存在: common.py

### refactor-calc-validate — 提取数值校验辅助函数

- 类别: refactor / 夹具: fixture_calculator
- 迭代: 10 / 停止原因: max_iterations / 耗时: 51687.2ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (3 failed, 5 passed in 0.08s)
- [X] `file_contains`: 不包含子串: 'def _is_number'

### refactor-cli-dispatch — 提取命令分发逻辑

- 类别: refactor / 夹具: fixture_cli_tools
- 迭代: 5 / 停止原因: completed / 耗时: 58889.6ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=2 (1 error in 0.21s)
- [X] `file_contains`: 不包含子串: 'def dispatch'

### refactor-text-normalize — 提取空白归一化辅助函数

- 类别: refactor / 夹具: fixture_text_utils
- 迭代: 1 / 停止原因: error / 耗时: 4214.5ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (1 failed, 3 passed in 0.08s)
- [X] `file_contains`: 不包含子串: 'def normalize_whitespace'

### multifile-report-split — 拆分报表为数据与格式化两个模块

- 类别: multifile / 夹具: fixture_data_report
- 迭代: 1 / 停止原因: error / 耗时: 4082.0ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (2 failed, 2 passed in 0.12s)
- [X] `file_contains`: 文件不存在: data.py
- [X] `file_contains`: 文件不存在: format.py

### multifile-cli-parser — 将参数解析移到独立模块

- 类别: multifile / 夹具: fixture_cli_tools
- 迭代: 1 / 停止原因: error / 耗时: 3581.4ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=2 (1 error in 0.13s)
- [X] `file_contains`: 文件不存在: parser.py

### multifile-calc-split — 拆分计算器为运算与 IO 两模块

- 类别: multifile / 夹具: fixture_calculator
- 迭代: 1 / 停止原因: error / 耗时: 3802.7ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (3 failed, 5 passed in 0.09s)
- [X] `file_contains`: 文件不存在: ops.py

### fix-calc-multiply-percent — 一次修复乘法与百分比两个 bug

- 类别: fix / 夹具: fixture_calculator
- 迭代: 1 / 停止原因: error / 耗时: 3512.8ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (1 failed in 0.10s)
- [X] `pytest_pass`: exit=1 (1 failed in 0.08s)

### feature-calc-power — 为计算器新增 power 幂运算

- 类别: feature / 夹具: fixture_calculator
- 迭代: 1 / 停止原因: error / 耗时: 4030.9ms / 自愈触发: 0 次

- [X] `file_contains`: 不包含子串: 'def power'
- [X] `pytest_pass`: exit=1 (3 failed, 5 passed in 0.09s)

### test-calc-divide-suite — 为 divide 补完整测试套件

- 类别: test / 夹具: fixture_calculator
- 迭代: 1 / 停止原因: error / 耗时: 3499.4ms / 自愈触发: 0 次

- [X] `pytest_file_exists`: 不存在: tests/test_calc_divide.py

### feature-text-truncate — 新增 truncate 文本截断函数

- 类别: feature / 夹具: fixture_text_utils
- 迭代: 1 / 停止原因: error / 耗时: 3578.0ms / 自愈触发: 0 次

- [X] `file_contains`: 不包含子串: 'def truncate'
- [X] `pytest_pass`: exit=1 (1 failed, 3 passed in 0.08s)

### feature-text-title-case — 新增 title_case 首字母大写函数

- 类别: feature / 夹具: fixture_text_utils
- 迭代: 1 / 停止原因: error / 耗时: 3637.0ms / 自愈触发: 0 次

- [X] `file_contains`: 不包含子串: 'def title_case'
- [X] `pytest_pass`: exit=1 (1 failed, 3 passed in 0.08s)

### test-text-uppercase-edge — 为 to_uppercase 补边界测试

- 类别: test / 夹具: fixture_text_utils
- 迭代: 1 / 停止原因: error / 耗时: 3770.5ms / 自愈触发: 0 次

- [X] `pytest_file_exists`: 不存在: tests/test_text_upper_edge.py

### fix-report-both-bugs — 一次修复报表合计与平均值两个 bug

- 类别: fix / 夹具: fixture_data_report
- 迭代: 1 / 停止原因: error / 耗时: 3653.8ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (1 failed in 0.08s)
- [X] `pytest_pass`: exit=1 (1 failed in 0.08s)

### feature-report-count — 新增 count_rows 行数统计函数

- 类别: feature / 夹具: fixture_data_report
- 迭代: 1 / 停止原因: error / 耗时: 3708.9ms / 自愈触发: 0 次

- [X] `file_contains`: 不包含子串: 'def count_rows'
- [X] `pytest_pass`: exit=1 (2 failed, 2 passed in 0.09s)

### test-report-summarize-extra — 为 summarize 补补充用例

- 类别: test / 夹具: fixture_data_report
- 迭代: 1 / 停止原因: error / 耗时: 3705.5ms / 自愈触发: 0 次

- [X] `pytest_file_exists`: 不存在: tests/test_report_summarize.py

### fix-cli-greet — 让 greet 测试恢复可通过

- 类别: fix / 夹具: fixture_cli_tools
- 迭代: 1 / 停止原因: error / 耗时: 3727.3ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=4 (1 error in 0.08s)

### feature-cli-main-exit-code — 让 main 退出码测试恢复可通过

- 类别: feature / 夹具: fixture_cli_tools
- 迭代: 1 / 停止原因: error / 耗时: 3874.9ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=4 (1 error in 0.08s)

### fix-cli-full-clean — 彻底清理 cli 坏 import 与死代码

- 类别: fix / 夹具: fixture_cli_tools
- 迭代: 1 / 停止原因: error / 耗时: 3701.6ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=2 (1 error in 0.12s)
- [X] `file_not_contains`: 仍包含子串: 'nonexistent_fake_module'
- [X] `file_not_contains`: 仍包含子串: 'dead_code_helper'

### feature-cli-add-command — 为 CLI 新增 add 子命令

- 类别: feature / 夹具: fixture_cli_tools
- 迭代: 1 / 停止原因: error / 耗时: 3774.0ms / 自愈触发: 0 次

- [X] `file_contains`: 不包含子串: 'def cmd_add'
- [X] `pytest_pass`: exit=2 (1 error in 0.14s)

### test-calc-add-subtract — 为 add/subtract 补组合测试

- 类别: test / 夹具: fixture_calculator
- 迭代: 1 / 停止原因: error / 耗时: 4199.1ms / 自愈触发: 0 次

- [X] `pytest_file_exists`: 不存在: tests/test_calc_add_sub.py

### test-cli-greet-format — 为 greet 输出格式补测试

- 类别: test / 夹具: fixture_cli_tools
- 迭代: 1 / 停止原因: error / 耗时: 3673.4ms / 自愈触发: 0 次

- [X] `pytest_file_exists`: 不存在: tests/test_cli_greet_fmt.py

### test-report-avg-edge — 为 avg_amount 补边界测试

- 类别: test / 夹具: fixture_data_report
- 迭代: 1 / 停止原因: error / 耗时: 3608.5ms / 自愈触发: 0 次

- [X] `pytest_file_exists`: 不存在: tests/test_report_avg_edge.py

### test-text-reverse-edge — 为 reverse 补边界测试

- 类别: test / 夹具: fixture_text_utils
- 迭代: 1 / 停止原因: error / 耗时: 3644.1ms / 自愈触发: 0 次

- [X] `pytest_file_exists`: 不存在: tests/test_text_reverse_edge.py

### refactor-calc-docstrings — 清理 calc.py 的 bug 注释并全绿

- 类别: refactor / 夹具: fixture_calculator
- 迭代: 1 / 停止原因: error / 耗时: 3608.8ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (3 failed, 5 passed in 0.12s)
- [X] `file_not_contains`: 仍包含子串: '故意埋设的 bug'

### refactor-cli-type-hints — 为 cli.py 补全类型注解

- 类别: refactor / 夹具: fixture_cli_tools
- 迭代: 1 / 停止原因: error / 耗时: 3570.1ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=2 (1 error in 0.15s)
- [X] `file_contains`: 不包含子串: 'argv: list[str]'

### refactor-report-avg-safe — 为 avg_amount 添加空列表保护

- 类别: refactor / 夹具: fixture_data_report
- 迭代: 1 / 停止原因: error / 耗时: 3827.0ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (1 failed in 0.08s)
- [X] `file_contains`: 不包含子串: 'if not rows'

### refactor-text-reverse-normalize — 修复 reverse 并提取空白归一化

- 类别: refactor / 夹具: fixture_text_utils
- 迭代: 1 / 停止原因: error / 耗时: 3791.3ms / 自愈触发: 0 次

- [X] `pytest_pass`: exit=1 (1 failed, 3 passed in 0.08s)
- [X] `file_contains`: 不包含子串: 'def _normalize_words'
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
