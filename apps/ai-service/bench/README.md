# IHUI-Bench v0

自建 agent 能力基准,用于评估 IHUI-AI 的 agent 执行器(`AgentLoopV2`)在确定性、
离线、无网络环境下完成代码类任务的能力。

## 与 Terminal-Bench / SWE-bench 的定位差异

| 维度 | Terminal-Bench | SWE-bench | IHUI-Bench v0 |
|---|---|---|---|
| 任务形态 | 容器化真实运维/编码任务 | 真实 GitHub issue + PR diff | 迷你仓库确定性 bug/缺口 |
| 环境 | Docker 容器,常需网络 | 完整仓库 + 测试 | 临时目录副本,纯本地无网络 |
| 评分 | 容器内脚本断言 | FAIL_TO_PASS / PASS_TO_PASS | 文件/pytest 检查器 |
| 目标 | 端到端 agent 能力 | 模型代码修复排名 | 自研执行器链路 & 评分闭环 |

IHUI-Bench v0 刻意保持"小而确定":每个 fixture 代码量 ≤200 行、无外部依赖,
便于在 CI 中秒级跑通,重点验证**执行器链路(工具调用→结果回填→评分)**而非
模型排名。

## 目录结构

```
bench/
├── run_bench.py          # 执行器(CLI)
├── tasks_v0.json         # 20 个任务定义
├── README.md             # 本文件
└── fixtures/
    ├── fixture_calculator/   # 2~3 个确定性 bug(fix 类)
    ├── fixture_text_utils/   # 缺 1 个函数测试(test 类)
    ├── fixture_cli_tools/    # 坏 import + 死代码(fix 类)
    └── fixture_data_report/  # 跨 2 文件重复逻辑(refactor/multifile 类)
```

## 运行方式

```bash
cd apps/ai-service
.venv/Scripts/python.exe -m bench.run_bench --executor stub --limit 2 --report out.md
```

参数:
- `--limit N`        :只运行前 N 个任务
- `--category`       :按类别过滤(fix / test / refactor / multifile)
- `--executor`       :`stub`(确定性简化 LLM,无需 key)或 `loop_v2`(真实 llm_gateway 路径)
- `--report PATH`    :markdown 报告输出路径(同名 `.json` 为汇总)
- `--workdir DIR`    :临时目录根,默认系统临时目录

脚本始终以退出码 0 结束(bench 任务失败 ≠ 脚本报错),便于 CI 收集报告。

## 任务 schema

```json
{
  "id": "fix-calc-divzero",
  "title": "修复计算器除零崩溃",
  "category": "fix",
  "fixture": "fixture_calculator",
  "instructions": "自然语言任务描述(作为 AgentLoopV2 的 goal)",
  "max_iterations": 8,
  "allowed_tools": ["read_file", "list_files", "write_file", "file_edit", "run_command"],
  "checks": [
    {"type": "pytest_pass", "params": {"path": "tests/test_calc.py", "test": "test_divide_by_zero"}},
    {"type": "file_contains", "params": {"path": "calc.py", "substring": "0.0"}},
    {"type": "file_not_contains", "params": {"path": "cli.py", "substring": "dead_code"}},
    {"type": "pytest_file_exists", "params": {"path": "tests/test_x.py"}}
  ]
}
```

category 分布(v0):`fix` 8 / `test` 5 / `refactor` 4 / `multifile` 3,共 20 个。

## 检查器类型

| type | 含义 | 关键 params |
|---|---|---|
| `file_contains` | 工作目录副本中某文件包含子串 | `path`, `substring` |
| `file_not_contains` | 工作目录副本中某文件不含子串 | `path`, `substring` |
| `pytest_pass` | 在副本上跑 pytest 全部通过(退出码 0) | `path`(默认 `.`), `test`(可选 nodeid) |
| `pytest_file_exists` | 某测试文件存在 | `path` |

## 如何加任务

1. 在 `fixtures/<fixture>/` 下准备好确定性迷你仓库(README + 源码 + tests)。
2. 在 `tasks_v0.json` 追加一个任务对象,填写 `id/title/category/fixture/
   instructions/max_iterations/allowed_tools/checks`。
3. 运行 `python -m bench.run_bench --category <your-category>` 验证。

## stub 模式说明

stub 执行器使用确定性简化 LLM:首次调用探查工作目录(`list_files`),之后直接
结束,**不会实际修改代码**。因此 stub 模式下检查通常全 fail,但其价值在于验证
**完整链路(工具调用 → 结果回填 → 评分)在离线环境跑通**。真实能力评估请用
`--executor loop_v2` 并配置可用 LLM key。
