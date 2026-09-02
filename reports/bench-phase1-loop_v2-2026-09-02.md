# IHUI-Bench v0 报告

- 任务总数: 20
- 通过: 12
- 通过率: 60.0%

| 任务ID                  | 类别      | 夹具                | 迭代 | 耗时(ms) | 检查 | 结果 |
| ----------------------- | --------- | ------------------- | ---- | -------- | ---- | ---- |
| fix-calc-divzero        | fix       | fixture_calculator  | 6    | 30350.4  | 1/1  | PASS |
| fix-calc-percent        | fix       | fixture_calculator  | 8    | 47750.5  | 1/1  | PASS |
| fix-calc-multiply       | fix       | fixture_calculator  | 8    | 57845.4  | 0/1  | FAIL |
| fix-cli-import          | fix       | fixture_cli_tools   | 6    | 39197.9  | 1/1  | PASS |
| fix-cli-deadcode        | fix       | fixture_cli_tools   | 4    | 19920.7  | 1/1  | PASS |
| fix-text-reverse        | fix       | fixture_text_utils  | 8    | 58223.1  | 1/1  | PASS |
| fix-report-avg          | fix       | fixture_data_report | 4    | 26570.6  | 1/1  | PASS |
| fix-report-total        | fix       | fixture_data_report | 6    | 31902.2  | 1/1  | PASS |
| test-text-slugify       | test      | fixture_text_utils  | 10   | 39799.8  | 1/1  | PASS |
| test-calc-edge          | test      | fixture_calculator  | 10   | 183315.5 | 1/1  | PASS |
| test-cli-errors         | test      | fixture_cli_tools   | 2    | 17333.9  | 0/1  | FAIL |
| test-report-empty       | test      | fixture_data_report | 10   | 78332.0  | 1/1  | PASS |
| test-text-wordcount     | test      | fixture_text_utils  | 10   | 91965.5  | 0/1  | FAIL |
| refactor-report-common  | refactor  | fixture_data_report | 10   | 69468.1  | 1/2  | FAIL |
| refactor-calc-validate  | refactor  | fixture_calculator  | 10   | 73952.2  | 1/2  | FAIL |
| refactor-cli-dispatch   | refactor  | fixture_cli_tools   | 10   | 44515.6  | 1/2  | FAIL |
| refactor-text-normalize | refactor  | fixture_text_utils  | 10   | 90073.8  | 0/2  | FAIL |
| multifile-report-split  | multifile | fixture_data_report | 11   | 151833.9 | 0/3  | FAIL |
| multifile-cli-parser    | multifile | fixture_cli_tools   | 11   | 83689.2  | 2/2  | PASS |
| multifile-calc-split    | multifile | fixture_calculator  | 12   | 68772.4  | 2/2  | PASS |

## 逐任务检查明细

### fix-calc-divzero — 修复计算器除零崩溃

- 类别: fix / 夹具: fixture_calculator
- 迭代: 6 / 停止原因: completed / 耗时: 30350.4ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.02s)

### fix-calc-percent — 修复百分比计算放大 100 倍

- 类别: fix / 夹具: fixture_calculator
- 迭代: 8 / 停止原因: completed / 耗时: 47750.5ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.02s)

### fix-calc-multiply — 修复乘法写成加法

- 类别: fix / 夹具: fixture_calculator
- 迭代: 8 / 停止原因: max_iterations / 耗时: 57845.4ms

- [x] `pytest_pass`: exit=1 (1 failed in 0.26s)

### fix-cli-import — 移除坏 import 让模块可导入

- 类别: fix / 夹具: fixture_cli_tools
- 迭代: 6 / 停止原因: completed / 耗时: 39197.9ms

- [OK] `pytest_pass`: exit=0 (2 passed in 0.01s)

### fix-cli-deadcode — 删除死代码函数

- 类别: fix / 夹具: fixture_cli_tools
- 迭代: 4 / 停止原因: completed / 耗时: 19920.7ms

- [OK] `file_not_contains`: 不包含子串: 'dead_code_helper'

### fix-text-reverse — 修复字符串反转步长

- 类别: fix / 夹具: fixture_text_utils
- 迭代: 8 / 停止原因: max_iterations / 耗时: 58223.1ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.02s)

### fix-report-avg — 修复平均金额除以 1 的 bug

- 类别: fix / 夹具: fixture_data_report
- 迭代: 4 / 停止原因: completed / 耗时: 26570.6ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.02s)

### fix-report-total — 修复合计 off-by-one 累加

- 类别: fix / 夹具: fixture_data_report
- 迭代: 6 / 停止原因: completed / 耗时: 31902.2ms

- [OK] `pytest_pass`: exit=0 (1 passed in 0.02s)

### test-text-slugify — 为 slugify 补测试

- 类别: test / 夹具: fixture_text_utils
- 迭代: 10 / 停止原因: max_iterations / 耗时: 39799.8ms

- [OK] `file_contains`: 包含子串: 'def test_slugify'

### test-calc-edge — 为计算器补充边界测试

- 类别: test / 夹具: fixture_calculator
- 迭代: 10 / 停止原因: max_iterations / 耗时: 183315.5ms

- [OK] `pytest_file_exists`: 存在: tests/test_calc_edge.py

### test-cli-errors — 为 CLI 错误路径补测试

- 类别: test / 夹具: fixture_cli_tools
- 迭代: 2 / 停止原因: completed / 耗时: 17333.9ms

- [x] `pytest_file_exists`: 不存在: tests/test_cli_errors.py

### test-report-empty — 为数据汇总补空输入测试

- 类别: test / 夹具: fixture_data_report
- 迭代: 10 / 停止原因: max_iterations / 耗时: 78332.0ms

- [OK] `pytest_file_exists`: 存在: tests/test_report_empty.py

### test-text-wordcount — 为词数统计补更多测试

- 类别: test / 夹具: fixture_text_utils
- 迭代: 10 / 停止原因: max_iterations / 耗时: 91965.5ms

- [x] `pytest_file_exists`: 不存在: tests/test_text_wordcount.py

### refactor-report-common — 提取重复的货币格式化逻辑

- 类别: refactor / 夹具: fixture_data_report
- 迭代: 10 / 停止原因: max_iterations / 耗时: 69468.1ms

- [x] `pytest_pass`: exit=1 (2 failed, 2 passed in 0.27s)
- [OK] `file_contains`: 包含子串: 'def format_currency'

### refactor-calc-validate — 提取数值校验辅助函数

- 类别: refactor / 夹具: fixture_calculator
- 迭代: 10 / 停止原因: max_iterations / 耗时: 73952.2ms

- [x] `pytest_pass`: exit=1 (3 failed, 5 passed in 0.35s)
- [OK] `file_contains`: 包含子串: 'def _is_number'

### refactor-cli-dispatch — 提取命令分发逻辑

- 类别: refactor / 夹具: fixture_cli_tools
- 迭代: 10 / 停止原因: max_iterations / 耗时: 44515.6ms

- [x] `pytest_pass`: exit=2 (1 error in 0.38s)
- [OK] `file_contains`: 包含子串: 'def dispatch'

### refactor-text-normalize — 提取空白归一化辅助函数

- 类别: refactor / 夹具: fixture_text_utils
- 迭代: 10 / 停止原因: max_iterations / 耗时: 90073.8ms

- [x] `pytest_pass`: exit=1 (1 failed, 3 passed in 0.30s)
- [x] `file_contains`: 不包含子串: 'def normalize_whitespace'

### multifile-report-split — 拆分报表为数据与格式化两个模块

- 类别: multifile / 夹具: fixture_data_report
- 迭代: 11 / 停止原因: completed / 耗时: 151833.9ms

- [x] `pytest_pass`: exit=1 (2 failed, 2 passed in 0.30s)
- [x] `file_contains`: 文件不存在: data.py
- [x] `file_contains`: 文件不存在: format.py

### multifile-cli-parser — 将参数解析移到独立模块

- 类别: multifile / 夹具: fixture_cli_tools
- 迭代: 11 / 停止原因: completed / 耗时: 83689.2ms

- [OK] `pytest_pass`: exit=0 (2 passed in 0.02s)
- [OK] `file_contains`: 包含子串: 'def parse_args'

### multifile-calc-split — 拆分计算器为运算与 IO 两模块

- 类别: multifile / 夹具: fixture_calculator
- 迭代: 12 / 停止原因: max_iterations / 耗时: 68772.4ms

- [OK] `pytest_pass`: exit=0 (8 passed in 0.04s)
- [OK] `file_contains`: 包含子串: 'def add'

---

## 验收结论与根因分析(2026-09-02 22:40)

**Phase 0 验收指标达成:完成率 60.0%(12/20)≥ 60% 门槛。** 本轮前 0%(0/5),两处阻断已根治:

### 根治 1:run_bench.py 检查器/LLM 两 bug(修复于本轮前期)

- `_check_pytest_pass`:node 选择器曾作为独立参数 → pytest exit=4 no tests ran → 恒 FAIL。已合成单参 `f"{path}::{node}"`。
- `_build_loop_v2_llm`:llm_gateway.complete 未透传 tools → 模型看不到工具 → 1 轮纯文本即 completed。已透传 OpenAI function-calling schema。

### 根治 2(llm_gateway.py,本轮核心):agent loop 第 2 轮起请求必 400

**现象**:agent 读了文件后"空手完成",从不写盘;bench trace 显示 iter2 空 content、0 tool_calls。
**铁证**(repro 复现):`litellm.BadRequestError 400 — ChatCompletionMessageFunctionToolCallParam.function/type: Field required`。两缺陷叠加:

1. **AgentLoopV2 消息累积用自定义 tool_calls 形态** `{id,name,args}`(agent_loop_v2.py 消息追加),非 OpenAI 原生 `{id,type:"function",function:{name,arguments:JSON串}}` → 第 2 轮起 litellm/provider 校验 400;
2. **repair_messages 只保留 system/user/assistant**(llm_gateway.py Rule 1)→ agent loop 的工具结果(tool role)每轮被剥,模型永远看不到文件内容。
   **修复**:llm_gateway.complete/astream 双路径新增 agent loop 消息流检测(`_is_agent_loop_messages`)+ 专用修复(`_repair_agent_loop_messages` 保留 tool role、不合并并行 tool 结果)+ tool_calls 归一化(`_normalize_agent_tool_calls`);chat API 消息(无 tool role)行为不变。回归:新增 11 用例全过,既有 test_llm_gateway.py 113 passed,mypy 0 错误。修复前后对照:fix-calc-divzero 由 "0/1 FAIL,2 iters,不写文件" → "PASS,6 iters,file_edit 落盘 + 自验"。

### 失败任务归类(8 FAIL,下一轮优化靶点)

| 类                         | 任务                                                                                                                                                                  | 证据                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 提前完成(未创建产物即收尾) | test-cli-errors(2 iters)                                                                                                                                              | 目标文件从未创建,模型误以为已做         |
| 语义改写错(修了但行为变)   | fix-calc-multiply;refactor-report-common(2/4 用例挂)、refactor-calc-validate(3/8)、refactor-text-normalize(1/4 + helper 未提取)、refactor-cli-dispatch(exit=2 收集错) | pytest 仍挂 → 重构破坏了既有行为/import |
| 多文件拆分超预算           | multifile-report-split(0/3,data.py/format.py 从未创建)                                                                                                                | 3 检查全挂,任务复杂度 > 8-11 轮预算     |

### 观察(供 Phase 1 后续)

- 6 个 PASS 任务 stop_reason=max_iterations(检查已过但 agent 未主动收尾)→ 缺"检查即止/成功检测"会空耗 token;对应能力路线图 agent 循环可靠性项。
- 平均 45s/任务(17-183s),全量 20 任务约 22 分钟;带 `run_command` 自验的任务被危险命令守卫拦 `python -c`(分号模式),agent 换招后仍通过,但多耗 2-3 轮。
- 环境噪音:`[orchestration_hub] XADD 失败`(redis 未起,降级内存)与 `auto-route 放宽 function calling`(免费模型无 key)不阻塞,非本任务引入。
