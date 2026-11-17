<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R72 · 声明顺序攻破：`Debug` impl 的 lea 语句序（25/25 名），缺口 2/3

> 对象：`codex.exe`（OpenAI Codex 26.1111.2228.0，Rust PE）
> 前序：R71 判死「call 站点定序」（`DebugStruct::field` 已内联），并把 `cwd` 从 Turn 候选里否证。R71 §5 把 Ghidra 列为唯一未用重手段。

## 1. 结论先行：顺序拿到了（部分覆盖，但**是声明序**）

不再需要 Ghidra。改用一个更廉价的判据：**`#[derive(Debug)]` 的打印顺序就是声明序**，而内联后打印序原样保留在代码里——每个字段名对应一条 `lea r64, [rip + <&str>]`，**这些 lea 的地址顺序就是语句顺序**。用 Capstone 对四个候选函数做严格线性反汇编（x86-64，rip-relative 解析），按地址序取出字段名：

**ThreadStartParams（`merged` @ `0x145800120..0x145808ea8`，25 名）**
```
baseInstructions → ephemeral → personality → model → runtimeWorkspaceRoots
→ threadSource → modelProvider → allowProviderModelFallback → historyMode
→ developerInstructions → environments → mockExperimentalField
→ selectedCapabilityRoots → serviceName → approvalPolicy → permissions
→ approvalsReviewer → daybreakEnabled → multiAgentMode → sandbox → serviceTier
→ config → dynamicTools → projectId → sessionStartSource
```

**TurnStartParams（`turn_worker` @ `0x145772930..0x14577e0e7`，25 名）**
```
summary → approvalPolicy → permissions → disabledPluginIds → additionalContext
→ outputSchema → multiAgentMode → threadId → effort → sandboxPolicy
→ collaborationMode → parentTurnId → rootTurnId → environments
→ clientUserMessageId → responsesapiClientMetadataPatch → serviceTierForTurn
→ toolOutput → responsesapiClientMetadata → turnTrigger → model → personality
→ approvalsReviewer → runtimeWorkspaceRoots → serviceTier
```

两条序列的 `lea` 站点**严格递增**（Thread 中位间距 0x12E≈302 B，Turn 中位 0x174≈372 B），是同一个 `Debug` impl 的连续代码块。

## 2. 三重自证

| 校验 | 读数 |
| --- | --- |
| Thread 首 7 名 vs R69 认证链 | **逐字吻合**（`baseInstructions` … `modelProvider`），零漂移 |
| Turn 顺序名 ⊄ visitor 集 | **0**（`TURN_ORDER_OUTSIDE_VISITOR = ()`） |
| Thread 顺序名 ⊄ 43 名集 | **0**（`THREAD_ORDER_OUTSIDE_VISITOR = ()`） |
| Turn 集内未被定位的名 | **2**：`modelProvider`、`cyberAccessProgram`（`TURN_ORDER_UNPOSITIONED`） |

## 3. 覆盖率（诚实边界）

| 结构 | arity | 有序名 | 缺口 |
| --- | --- | --- | --- |
| `ThreadStartParams` | 27 | 25 | **2** |
| `TurnStartParams` | 28 | 25 | **3** |

`ORDER_COMPLETE = False`。顺序是**相对序**（谁先打印），**不是内存布局**；缺口名在序列里**没有位置**，不做推定。

## 4. 手法（可复现）

1. `D:/DevEnv/Temp/r72/probe50.py`：Capstone 线性反汇编四个函数区间，只留 `lea` 且 `mem.base == RIP`，目标落入 `.rdata`，字面量以**相邻 lea 目标**为右界截断（避免把 `'cwdstruct GitDiffToRemoteParams…'` 这类合并串当成字段名）。
2. `D:/DevEnv/Temp/r72/ordered_names.json`：机器产物，名字零手敲。
3. `D:/DevEnv/Temp/r72/gen_r72.py`：读产物生成模块与测试；`turn_worker` 首个 `threadId` 因与下一名相隔 7285 B 被**程序判据**判为另一 impl 的碎片并剔除（不是手工删）。
4. 交叉校验与未定位名在生成阶段算好写进常量，测试再断言一遍。

## 5. 交付

| 文件 | 内容 |
| --- | --- |
| `apps/ai-service/app/core/struct_declaration_order.py` | 两条有序元组 + 两套 lea 站点 + `ORDER_COVERAGE` + `TURN_ORDER_UNPOSITIONED` + 双向交叉校验常量 + `validate_declaration_order` / `position_of` |
| `apps/ai-service/tests/test_struct_declaration_order.py` | **12 passed**，含 3 例反向变异（重复名 / 站点非单调 / 篡改 Thread 头） |
| 本报告 | — |

验证：`ruff` 全绿、`mypy` `Success: no issues found`、水印 3/3（模块 + 测试 + 本报告）。

## 6. 下一步

1. **补缺口**：`modelProvider` 在 `turn_worker2` 有邻域（`approvalPolicy → approvalsReviewer → sandboxPolicy → model → modelProvider`），可用同一判据在**该函数**取序后与主序列拼接；`cyberAccessProgram` 走 R69 的 xref 邻域。
2. **顺序漂移哨兵**：把本序接入 R66 的漂移框架——上游改字段时 `Debug` 打印序会变，这比"名字集合变了"更早报警。
3. `turn_worker2`(19) / `turn_worker3`(15) 的重复序列是同一结构的包装实例，未并入；若它们能覆盖缺口名，按第 1 条处理。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
