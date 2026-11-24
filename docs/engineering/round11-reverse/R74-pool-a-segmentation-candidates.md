<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R74 · 池 A 切分账：749 B 里抠出 16 个可信新候选 + 4 个疑段

> 对象：`codex.exe`（OpenAI Codex 26.1111.2228.0，Rust PE）
> 前序：R73 找到「池残渣 = 未记录字段名」判据，Thread 池 B 得 `experimentalRawEvents`，并把「池 A 也要切一遍」列为下一步。

## 1. 结论先行

池 A（`0x151b43120..0x151b4340d`，749 B）**不是单个结构的名字表，是 Thread 家族多结构的混排串**。用 R65 的 20,287 条 ident 全量字典（首字母分桶、最长前缀优先）切分：

| 读数 | 值 |
| --- | --- |
| 池字节 | 749 |
| 切出段 | **50** |
| 残渣 | **3 段 / 4 字节** |
| 覆盖率 | **99.47%** |
| 字段形段 | 32 |
| 其中新候选（不在任何已认证集） | **22** |
| 前缀碰撞（疑） | 4 |
| 过长（疑） | 1 |
| **可信新候选** | **16** |

**16 个可信新候选**（全部首次出现，机器派生）：

```
turnId  outputDeferred  experimentalPredictionMode  lastTurnId  beforeTurnId
attachToSource  excludeTurns  deferGoalContinuation  includeAttachedThreads
currentAccountOnly  excludedThreadIds  sortKey  sortDirection
useStateDbOnly  ancestorThreadId  tokenBudget
```

**4 个前缀碰撞**：`modelProviders`（← `modelProvider`）、`sourceKinds`、`sectionId`、`experimentalRawEventsstartupclear`（← `experimentalRawEvents`）。
**1 个过长**：`includeTurnssubAgentThreadSpawn`（32 B > 30，本镜像已知真字段名上界）。

## 2. 两级诚实（这轮最要紧的部分）

池切分证明「这些字节在名字池里以这个名字存在」，**不证明**任何结构接受它：

- `POOL_A_CANDIDATES_ATTESTED = False`，测试断言翻转它会被 `validate_pool_account` 拒绝。
- 测试逐一断言 16 个可信候选的 `position_of()` 返回**空**——它们既无结构归属、也无声明位置。
- 前缀碰撞不判"错"，只记"疑"：`modelProviders` 完全可能是**真字段**（复数派生），也可能是池里 `modelProvider` + `s` 两个相邻名。`POOL_A_PREFIXED_BY` 把"被谁前缀"逐个记下来，让这个疑点可审计，而不是拍板。
- 过长判据用**本镜像自己的读数**（最长已认证字段名 30 B），不是主观阈值。

## 3. 交付

| 文件 | 内容 |
| --- | --- |
| `apps/ai-service/app/core/struct_pool_a_candidates.py` | 50 段 + 残渣 + 32 字段形 + 22 候选 + 前缀碰撞（带 `POOL_A_PREFIXED_BY` 逐条前缀）+ 过长 + 可信 16 + `validate_pool_account()` / `account_summary()` |
| `apps/ai-service/tests/test_struct_pool_a_candidates.py` | **8 passed**，含 2 例反向变异（残渣变大 / attested 翻转）与 1 例"候选不得被当成已知" |
| 本报告 | — |

验证：`ruff` 全绿、`mypy` `Success: no issues found`、水印 3/3。

## 4. 为什么这比 R73 更进一步

R73 只在一个池（B）上做，得到 1 个名；R74 把同一判据推到**混排池**，并用「全量 ident 字典 + 字段形 + 双疑类」把结果切成「可信 / 疑」两层。计量上也升级：残渣从"段数"变成**字节覆盖率**（99.47%），可做棘轮——字典缩小、池变大都会让这个百分比掉下来。

## 5. 下一步

1. **给 16 个候选找归属**：池 A 的混排里必含 `ThreadResumeParams` / `ListThreadsParams` 等结构名，用 `struct <Name> with <N> elements` 模板定位每个结构的池边界，把候选分配过去——这是把「候选」升成「字段」的唯一途径。
2. **`cyberAccessProgram` 之外的 Turn 缺口**：池 C 已排除，改从 `TurnStartParams` 的 `Debug` 序缺位反推——序里 25 名、arity 28，缺的 3 名中 2 名已知无位置，只剩 1 名无名。
3. 把 `POOL_A_COVERAGE_PCT` 与 `POOL_A_RESIDUE_BYTES` 接进 R66 漂移哨兵：**上游新增字段时，池会变大而覆盖率会掉**，这比 arity 变化更早。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
