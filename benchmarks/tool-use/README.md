<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 工具调用评测（tool-use）

这套件只做一件事：把“工具调用到底好不好”变成可复现的数字，不再靠感觉。

## 当前基线

`audit_tool_surface.py` 现读 `mcp_server.list_tools()` 得出：

| 指标                                                    |                    读数 |
| ------------------------------------------------------- | ----------------------: |
| 内置工具                                                |                     156 |
| 全量 schema tokens（cl100k_base）                       |                  50,063 |
| deferral 后 tokens                                      |      41,248（省 17.6%） |
| strict 兼容（全 required + additionalProperties=false） |        12 / 156（7.7%） |
| 参数说明覆盖率                                          |                     90% |
| 带 outputSchema / 工具示例                              |                   0 / 0 |
| 默认工具面同义对                                        | web_search / search_web |

完整报告在 `reports/tool-surface-baseline.md`，机器可读版是 `reports/tool-surface-baseline.json`。

纯 BM25 工具检索（无 embedding、无模型）在 100 条金标上的读数：

| 指标 | BM25 裸检 | BM25 + 35 枚工具别名 |
|---|---:|---:|
| Recall@1 | 59.0% | 73.0% |
| Recall@5 | 83.0% | 100.0% |
| MRR | 0.700 | 0.850 |

裸检有 17 条金标连 Top-5 都进不去，集中在“中文口语 → 英文工具名”的词面断裂：`git 状态` 对不上 `status`、`回车` 对不上 `Enter`、`待办` 对不上 `todo`、`截图` 分不清 `browser_screenshot` 与 `computer_screenshot_screen`。补 35 枚工具的通用别名后，同一批 100 条金标 Top-5 全中、Top-1 仍只有 73%。

结论：**瓶颈在元数据，不在检索算法**。P1 的顺序应改成“先给工具补 aliases / when_to_use，再上 hybrid 检索 + reranker”；只上 BM25 或只换 embedding 都会把错误工具捞进 Top-5，却选不对第一个。报告在 `reports/tool-retrieval-baseline.md` 与 `reports/tool-retrieval-aliases.md`。注意：别名是在同一批 100 条上补的，存在过拟合；下一批要用另一套隐藏用例复验。


## 四条命令

```bash
# 1) 重算工具面基线（无需外网、不调模型）
apps/ai-service/.venv/Scripts/python.exe benchmarks/tool-use/audit_tool_surface.py

# 2) 校验 100 条金标与真实工具 schema 是否对得上
apps/ai-service/.venv/Scripts/python.exe benchmarks/tool-use/score.py --validate-only

# 3) 给录制轨迹打分
apps/ai-service/.venv/Scripts/python.exe benchmarks/tool-use/score.py \
  --trajectories benchmarks/tool-use/tests/fixtures/sample_trajectories.jsonl

# 4) 重算 BM25 工具检索基线
apps/ai-service/.venv/Scripts/python.exe benchmarks/tool-use/tool_retrieval.py

# 5) 带手工别名重算检索上界
apps/ai-service/.venv/Scripts/python.exe benchmarks/tool-use/tool_retrieval.py \
  --aliases benchmarks/tool-use/data/tool-aliases.json
```

单测：

```bash
apps/ai-service/.venv/Scripts/python.exe -m pytest benchmarks/tool-use/tests/test_score.py -q
```

## 金标格式

`cases/golden.jsonl` 一行一例，当前 100 条，覆盖 education 20 / finance_hr 20 / code 20 / web 15 / desktop 10 / media_meta 15，命中 90 枚工具。

```json
{
  "id": "edu-001",
  "domain": "education",
  "user": "查一下三年级二班还有哪些学员欠费",
  "expected_tools": ["edu_list_arrears"],
  "alternatives": ["edu_list_students"],
  "required_args": { "edu_list_arrears": ["keyword"] },
  "forbidden_tools": ["edu_create_refund"],
  "notes": "只读查欠费"
}
```

- `expected_tools` 是首选序列；第一条用于 Top-1，全部用于序列召回。
- `alternatives` 是同等可接受的替代工具。
- `required_args` 只校验“关键参数在不在、类型对不对、空不空”，不校验具体值，避免金标过脆。
- `forbidden_tools` 抓“该读却写”的危险误选。

## 轨迹格式

```json
{
  "case_id": "edu-001",
  "tool_calls": [{ "name": "edu_list_arrears", "arguments": { "keyword": "三年级二班" } }],
  "turns": 2,
  "input_tokens": 1200,
  "output_tokens": 120
}
```

## 指标口径

- `top1_rate`：第一次工具调用是否命中首选或替代。
- `top3_rate`：前三次调用内是否命中。
- `sequence_rate`：期望序列是否按顺序全部出现（允许中间夹别的调用）。
- `arg_pass_rate`：命中调用的关键参数是否齐全、类型正确、没有 schema 禁止的多余参数。
- `clean_rate`：没有触发 forbidden、没有调用未注册工具。
- `avg_turns / avg_tokens`：端到端成本。

## 边界

当前只做“离线校验 + 录制轨迹打分”，不联网、不调付费模型。live runner 要等下一步接入 `/agents/execute` 或模型网关后加；在它落地前，任何“准确率”都只能算夹具结论，不能对外宣称。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
