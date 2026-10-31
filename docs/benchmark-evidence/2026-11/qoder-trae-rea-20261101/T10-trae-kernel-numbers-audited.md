<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# T10 — Trae agent 内核五条定量读数的取证复核(复核席,只读)

> 复核基线:`git rev-parse HEAD` 现读 = `54942dc36dd858d585faa501e7c6d1850dca9a10`(2026-11-01T01:41:09+08:00)。
> 被复核册:`G:/IHUI-AI/docs/benchmark-evidence/2026-10/trae-rea-20261031/T1-trae-ai-agent.md`(该册 §0.3 自述**未跑 REA**,全部为静态取样)。
> 复核席角色:**不挖新矿**,只把那 5 条 [推断] 级读数升到 [观察] 或当场否证。

## 0. 靶、手段与时间盒

### 0.1 三枚靶(2026-11-01 现读,`stat -c %s` + `certutil -hashfile … SHA256`)

| 绝对路径 | 字节 | sha256 |
| --- | --- | --- |
| `C:/Users/Administrator/AppData/Local/Programs/Trae CN/resources/app/modules/ai-agent/ai_agent.dll` | 282,523,024 | `12ad7860a5afa1a8a5c060911057df7adc7feb6316083cabc1c57805fdeb60bd` |
| `C:/Users/Administrator/AppData/Local/Programs/Trae CN/resources/app/modules/ai-agent/harness.dll` | 248,416,656 | `4738631d6d53658dffc672aa72c2bde6a81bed4259ee4cebbfc87c0d17583340` |
| `C:/Users/Administrator/AppData/Local/Programs/Trae CN/resources/app/modules/ai-agent/toolhost.dll` | 95,302,544 | `6a0b1f1c9a1cced3246e3a57c6dd19a87636af9b40284f945401106bc5cc64d9` |

体积与前册逐字一致 ⇒ 靶未腐烂(可排除"对方已换构建"这一种否证路径)。

### 0.2 用了哪几档手段

- **第 1 档 静态 PE 结构级(全部用了)**:段表解析、`.pdata` 异常表(RUNTIME_FUNCTION)函数计数、`.rdata` ASCII 串抽取、**连续串池的逐字节切分**(贪心消耗 + 残差点名)、**全文件字面量检索**(三枚 DLL 各自 `Buffer.indexOf`)、**源路径前缀去重计数**。器物:`.ihui-agent/tmp/rea-goal-b45/{b45-pe.mjs,hexdump.mjs,b45-audit1.mjs,b45-audit2.mjs,b45-audit3.mjs,q.mjs}`(只读字节,从不执行靶)。
- **第 2 档 Ghidra headless**:**未上**。理由如实:① 第 1 档已对 5 条全部给出裁定;② 剩下唯一没答的问题是"枚举穷尽性",而它需要的不是整仓反编译而是函数级注册表读取,95MB 的 `toolhost.dll` 在时间盒(40 分钟)耗到此时已不可能;③ 前册 §0.3 与任务书都认定 `rea analyze` 原生腿对 282MB PE 必超时。⇒ 该项按 §0.3 记 **未判定**,不冒绿。
- **第 3 档 JS 层交叉验证**:**未跑**(时间盒)。本席 5 条的靶全在原生侧,且第 1 档已给出可否证的答案;JS 层只会在"145 vs 137"那一腿提供第三个口径,不改变判定方向。列为本席留下的**未收口格子**。

### 0.3 附带产出:三枚靶的函数数下界 [观察]

`.pdata` / RUNTIME_FUNCTION 计数(`node .ihui-agent/tmp/rea-goal-b44/pe-pdata-funcs.mjs <三枚路径>`,末行现读):

| 文件 | runtimeFunctionEntries | 非空 | distinct begin RVA |
| --- | --- | --- | --- |
| `ai_agent.dll` | 714,991 | 714,991 | 714,991 |
| `harness.dll` | 663,620 | 663,620 | 663,620 |
| `toolhost.dll` | 192,262 | 192,262 | 192,262 |

三者条目**零空槽、零重复 begin** ⇒ "带展开信息的函数数"这个下界是干净的(不等于函数总数,静态链接的去掉展开项不计)。

## 1. 五条裁定总表(格式按任务书)

| # | 原判读数 | 复核手段 | 复核后读数 | 判定 | 依据(文件 + 可复验命令) |
| --- | --- | --- | --- | --- | --- |
| 1 | 工具 **145–161 枚** | 源路径前缀去重 + 串池 marker 切分 | **161 逐字复现**(`modules\ai-agent\src\domain\toolcall\tools\` 下 distinct=161,其中 `browser_use\` = 40);**145 那腿两法都不给 145**:严格三后缀切分 = **137** 枚去重基名,`.rdata` 全域 `toolcall_` marker = **1153** 处(原册记 904) | **上限成立 [观察] / 下限数值修正(145 → 137,口径敏感)** | `node .ihui-agent/tmp/rea-goal-b45/b45-audit3.mjs`(前缀枚举)、`node …/b45-audit2.mjs` 第 (2) 节;清单落 `…/rea-goal-b45/toolcall-bases-b45.txt`、`toolcall-defer-b45.txt`(defer 载键 **49** 枚与前册逐字一致) |
| 2 | 权限决策枚举 **16 值**,且「命令级粒度,无审批通道时拒绝执行而不降级」 | 连续块逐字节切分 + 三枚 DLL 全文件字面量检索 + harness 同族块对照 | ai_agent 面该块 = **17 枚字面量**(非 16);原册列出的 `sandbox_execute_failure_to_recovery` **在三枚 DLL 中 0 命中**(子串 `failure_to_recovery` 亦 0 命中),真实相邻字节是 `sandbox_execute_failure` + `to_recovery` 两枚;harness 面同族块 = **22 枚**,多出 `enterprise_command_blacklist · unknown · generate_video_budget_confirmation · schedule_mutation · sandbox_model_escape` 五枚原册未列 | **数值不成立(16 → 17 / 22,含一枚幻影名);「命令级粒度」成立 [观察];「无审批即拒不降级」成立 [观察]** | 见 §2(值集合逐条 + 拒绝路径字面量偏移) |
| 3 | 压缩 **≥4 档** | 22 枚档位字面量逐条检索(全 HIT)+ `*compact*/*compress*` 去重 | **22/22 HIT**;`.rdata` 内 `*compact*|*compaction*|*compress*` snake 串去重 **162** 枚 | **成立 [观察]**(档位键名齐备;"≥4"作为下限被直接满足) | `node …/b45-audit1.mjs` 第 (CLAIM 3) 节;令牌清单落 `…/rea-goal-b45/compact-tokens-b45.txt` |
| 4 | 会话落 SQLite **89 次迁移**,`fork`/`resume`/`continue`/`list` 齐 | 两种独立切分口径的去重计数 + 四操作字面量检索 | 迁移名:`.rs` 锚定口径 = **84**(ai-agent `migration_version` 79 + `crates\snapshot\migration` 5);字符边界口径 = **95**。**89 是两个独立口径都没给出的点值**(落在 84–95 带内);四操作字面量 **4/4 HIT** | **前半数值修正(89 → 区间 [84,95],点值不可复现);后半成立 [观察]** | `node …/rea-goal-b45/q.mjs`(边界口径 95)、`node …/b45-audit2.mjs` 第 (4) 节(`.rs` 口径 84,清单 `…/migrations-b45.txt`)、`q.mjs` 的 SESSIOPOP 四行 |
| 5 | 子代理 **43 型 × 隔离 4 档** | 632 字节连续块贪心消耗 + 残差点名 | agent 类型块 `ai_agent.dll@167522768` 长 **632**,按 43 值贪心消耗后**残差为空字符串** ⇒ 43 枚逐字复现、块内不多不少;隔离块 `@167545072` = `VsockStream·kind·Proxy·Trailer·Isolated·SameType·SameTypeWithMain·Fork`,4 枚目标值齐,但**与另一枚举共享同一连续块**(切分靠词形不靠块边界) | **43 型成立 [观察];隔离 4 值存在成立 [观察],"恰好 4 档"的穷尽性未判定 [推断]** | `node …/b45-audit2.mjs` 第 (3) 节(`greedy consumed=43/43 residual=""`) |

## 2. 第 2 条的两问(任务书点名)

### 2.1 ① 权限决策那组枚举的真实值集合

**ai_agent.dll 面**(块起点 `176426648`,整块长 335 B,前邻是 `Blocked destructive script copy or move`、后邻是 `ProgrammaticCommandRule`)按字节逐字切分出 **17** 枚(偏移为逐枚字面量起点):

```
176426687 immutable_safety_deny        176426835 command_rule_allow
176426708 sandbox_fail_immediately     176426853 command_rule_ask
176426732 command_rule_deny            176426869 mcp_rule_allow
176426749 mcp_rule_deny                176426883 mcp_rule_ask
176426762 dangerous_command            176426895 sandbox_execute_failure      ← 注意:后面直接跟
176426779 permission_request              176426918 to_recovery              ← 这两枚,不是 34 字符的一枚
176426797 mcp_tool_execution           176426929 sandbox_unavailable
176426815 unrecoverable_delete         176426948 sandbox_to_recovery
                                       176426967 sandbox_disabled
```

复验(逐字节,含 `failure` 与 `to` 之间**没有**下划线这一事实):
`node .ihui-agent/tmp/rea-goal-b45/hexdump.mjs "<ai_agent.dll>" 176426600 480` —— 行 `176426888` 的 ASCII 列读到 `ule_asksandbox_execute_failureto`,行 `176426920` 读到 `_recoverysandbox_unavailablesand`。

**harness.dll 面**(同族块,起点 `208383760`,跨 `208383760–208384215`)= **22** 枚,逐字:`enterprise_command_blacklist · immutable_safety_deny · unknown · sandbox_fail_immediately · command_rule_deny · mcp_rule_deny · dangerous_command · permission_request · mcp_tool_execution · unrecoverable_delete · command_rule_allow · command_rule_ask · mcp_rule_allow · mcp_rule_ask · generate_video_budget_confirmation · schedule_mutation · sandbox_execute_failure · sandbox_model_escape · to_recovery · sandbox_unavailable · sandbox_to_recovery · sandbox_disabled`。
复验:`node .ihui-agent/tmp/rea-goal-b45/b45-pe.mjs dump "<harness.dll>" 208383700 260 5` 与 `… dump "<harness.dll>" 208383900 600 5`。

**否证性检索**(同一命令跑三枚 DLL):`sandbox_execute_failure_to_recovery`、`failure_to_recovery`、`sandbox_execute_failure_to`、`execute_failure_to`、`SandboxExecuteFailureToRecovery` **在五枚待测串 × 两枚 DLL 全部 0 命中**,`toolhost.dll` 对整族 `*_rule_*`/`sandbox_*` 决策串 **0 命中**(它是工具宿主,不持决策枚举)。
复验:`node .ihui-agent/tmp/rea-goal-b45/b45-audit3.mjs`(`MISS sandbox_execute_failure_to_recovery` × 3)+ `node .ihui-agent/tmp/rea-goal-b45/q.mjs`(前两行)。

⇒ 结论:**"16 值"这个数不成立**。它是把相邻两枚字面量误当一枚读出的产物;按面取值是 ai_agent=17 / harness=22,harness 是超集且含 5 枚从未被登记的决策值(其中 `enterprise_command_blacklist`、`sandbox_model_escape`、`unknown` 语义上都会改变"命令级粒度"的覆盖面)。
⇒ 同时如实写明本席的边界:**"这块串池就是这个枚举的全部变体"仍是 [推断]**——指针-长度法定位 `&str` 胖指针数组的尝试在三枚 DLL 上全部 0 命中(本席按 ImageBase=0x80000000 + RVA 编码检索未获站点),穷尽性只有函数级反编译能定,而那一档本席未跑(§0.2 理由)。所以本席只否证了"16"与那枚幻影名,**没有**给出"权威值总数"。

### 2.2 ② 「无审批通道时拒绝执行而不降级」有没有拒绝路径实锤

**有,[观察] 级,逐条点名**(全部在 `ai_agent.dll`;`harness.dll`/`toolhost.dll` 对同串 **0 命中** ⇒ 这条语义只在领域侧,不在 harness 侧):

| 偏移 | 字面量形态(截最长几行) |
| --- | --- |
| `176161373` + `176161426` | `tool '` … `requires confirmation, but direct mode has no confirmation channel`(前邻 `auto`@176161414 ⇒ 该串在 `auto`/`direct` 两种模式的分支表里) |
| `176161497` | `skipped` + `block_level` |
| `176161544` | `safety_level` + `rule_id` |
| `176161345` | `not found or not enabled`;`176161380` `is not allowed in exec context` |
| `176426656` | `Blocked destructive script copy or move` |
| `176427027`+`176427050`+`176427146` | `ProgrammaticCommandRule` + `This command was blocked by built-in, non-bypassable destructive system operation safety rules. You MUST NOT retry it, request approval to bypass the rule, or use equivalent commands…`(`175837544`/`175837640` 有同文第二份) |
| `176427332` | 危险后果枚举:`delete large amounts of system files or configuration…` / `rebuild the target device's filesystem…` / `destroy filesystem signatures or partition tables…` / `overwrite or damage device data…` |
| `176424928`,`176425136` | `Script file inspection timed out; continuing existing permission checks`、`Copy source path extraction incomplete; continuing existing permission checks`(**fail-open 只作用于"继续走检查",不作用于"放行"** ⇒ 前册那句的细化证据) |
| `176425688`,`176425816` | `[Permission] cannot load enterprise command policy: no valid snapshot available`、`… Execution target environment unavailable; unable to confirm device type; continuing existing permission checks`(源锚 `domain/permission/command_policy.rs:63/:90/:126`) |

复验:`node .ihui-agent/tmp/rea-goal-b45/b45-audit2.mjs`(第 (5) 节直接打印 176161100–176162000 的串池)与 `node .ihui-agent/tmp/rea-goal-b45/b45-audit1.mjs`(CLAIM 2b 段的逐串 HIT/MISS)。

⇒ 「命令级粒度」另有独立实锤(不依赖枚举个数):决策串把 `command_rule_{deny,allow,ask}` 与 `mcp_rule_{deny,allow,ask}` **分列六枚**,且 harness 面新增 `generate_video_budget_confirmation`/`schedule_mutation` 两枚**按动作而非按工具**的决策值。前册这一句**方向成立**。

## 3. 第 6 问:波及面(主席要不要补更正)

按"哪张票的哪句前提"落到具体行:

1. **`T3-gap-matrix.md:205` 行 —— 前提里的数字要更正,判定不用改。** 该行「命令级权限粒度(对方**16 值**枚举,命令级,无审批即拒不降级)」判 **A**,依据列的是本仓侧件(`core/command_safety.py::_split_script_into_commands`、`core/exec_policy.py::prefix_rule`、`permissions_instructions.py` 等)。本席复核:**"命令级"与"无审批即拒"两句各有独立字面量实锤(§2.2),判定 A 不倒**;但"16 值"是错的点值,且漏登记 5 枚决策值 ⇒ **需更正为"ai_agent 面 17 / harness 面 22,含 `enterprise_command_blacklist`/`sandbox_model_escape`/`unknown` 等未登记档"**,并因此**追加一条差距**:本仓侧目前有没有"企业命令黑名单"与"沙箱模型逃逸"这两档的对应物,是个新问题(不在原 27 行判定射程内)。
2. **`T3-gap-matrix.md:207` 行(子代理隔离,对方 43 型 × 4 档)—— 不用更正。** 43 逐字复现;"4 档"是本席未证穷尽但也没否证的那半句,该行结论(本仓 `ISOLATION_MODES=['none','worktree','subprocess'] 三档 + 第 4 档属 OS 原生)不依赖"恰好 4"这个数 ⇒ 保留,建议把措辞从"4 档"软化为"4 值已见(穷尽性未证)"。
3. **`G-10`(压缩)票 —— 不受影响。** 该票前提来自"≥4 档 + micro_compact 键族",本席 22/22 字面量 HIT、`MicroCompactSignal`@166955135 与迁移 `m20260330_000001_add_micro_compact_strategy`/列 `micro_compacted` 都在;`T3:31` 那句"G-08/G-10/G-11/G-17 已结清(micro_compact 接进 `agent_loop_v2:3008`)"的对照面读数成立 ⇒ **已落地的本仓能力没有建在沙上**。
4. **`G-01`(workflow)票 —— 与本席 5 条无关**(其前提是本仓 `resumeFromRunId` 现读 0 命中,不引用工具数)。
5. **工具数那腿:** `T3` 未以 145 为前提(现读 grep 无该行);引用面只有 `T1 §1` 与 **`2026-10/trae-rea-20261031/README.md:20`**(该行把五条数字逐字并排摘要)。⇒ 更正点在 README 那一行 + T1 本体,不在派单链上。
6. **`README.md:20` —— 五条里四条要改。** 该行逐字写着"工具 145–161 枚、权限决策枚举 16 值(命令级粒度…)、压缩 ≥4 档、会话落 SQLite(89 次迁移…)、子代理 43 型 × 隔离 4 档"。按本席:161/≥4 档/43 型 三处**不动**;145 改 137(并标注口径)、16 值改 17/22、89 改"84–95(点值不可复现)"。**这是摘要行,主席更正当先更它**,否则下一个下游会照抄。

**净结论**:五条里没有一条导致**已落地能力被推翻**(压缩、命令级权限、子代理隔离三张票的判定各自另有独立实锤);需要的是**三处数字更正 + 一个新暴露的差距(企业命令黑名单 / 沙箱模型逃逸两档决策值)**,以及一条诚实标注:枚举穷尽性至今 [未判定],两席都没到函数级。

## 4. 本席未收口的格子(如实登记)

| 格子 | 到哪一档 | 卡在哪 | 已落盘中间产物 |
| --- | --- | --- | --- |
| 枚举穷尽性(17/22 是不是全集) | [推断] | 指针-长度法 0 命中(编码或寻址面假设错),需 `toolhost.dll`/`ai_agent.dll` 的注册表函数级反编译;Ghidra headless 在时间盒外 | `…/rea-goal-b45/perm-ptr-hits.json`(逐枚字面量偏移,可直接喂给 headless 定位) |
| 145 vs 137 vs 904/1153(marker 数) | [观察] 但口径分裂 | 串池无分隔符拼接,marker 计数与后缀切分两种口径互不等价;JS 层交叉验证未跑 | `…/toolcall-bases-b45.txt`(137)、`…/toolcall-defer-b45.txt`(49)、`…/toolcall-all-b45.tsv`(851 条原始命中) |
| 89 次迁移 | 区间 [84,95] | 同一拼接问题:`.rs` 锚定漏掉非路径引用,边界规则口径又把 `…columns` + `apps\…` 粘连计入 | `…/migrations-b45.txt`(84 枚清单) |
| 第 3 档 JS 层交叉验证 | 未跑 | 时间盒(总机器时间 40 min)已尽 | — |

## 5. 复现入口(全部只读,不执行靶)

```bash
node .ihui-agent/tmp/rea-goal-b44/pe-pdata-funcs.mjs "<ai_agent.dll>" "<harness.dll>" "<toolhost.dll>"   # §0.3 函数数
node .ihui-agent/tmp/rea-goal-b45/b45-audit1.mjs   # CLAIM 2/3/5 偏移读数 + 拒绝串 HIT/MISS
node .ihui-agent/tmp/rea-goal-b45/b45-audit2.mjs   # 逐枚指针探测 + 43 值贪心残差 + toolcall 切分 + 迁移切分 + 拒绝串上下文
node .ihui-agent/tmp/rea-goal-b45/b45-audit3.mjs   # 三枚 DLL 字面量 MISS 证明 + 161/40 源路径计数
node .ihui-agent/tmp/rea-goal-b45/q.mjs            # failure_to_recovery MISS 证明 + 四操作字面量 + 迁移边界口径 95
node .ihui-agent/tmp/rea-goal-b45/hexdump.mjs "<ai_agent.dll>" 176426600 480   # 17 枚切分的逐字节证据
```

红线自查:本册**未粘任何对方源码或反编译产物**,只有结构事实、符号/键名、计数与字面量偏移;未读 `AppData/Roaming/Trae CN/` 任何内容(前册 §4 的存在性读数本席只复核了程序包侧);未执行 Trae、未联网、未提取凭据。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
