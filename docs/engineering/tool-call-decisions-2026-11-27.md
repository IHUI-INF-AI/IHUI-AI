<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Function Call 能力：P0/P1/P2 决策账（2026-11-27）

> 这份记录只记“做过什么、为什么不做”。每条结论都能用文中命令复验；复验不过就把结论改成实际读数，不许留着旧结论当门面。

## 一、P0 工具链韧性（已做）

| 件 | 提交 | 行为 |
| --- | --- | --- |
| 崩溃折法 | `5b9112fc3` | 一枚工具真抛异常时折成该枚 `ToolResult{success:false,errorType:'tool_crashed'}`，不让整批 `Promise.all` 炸掉；原始 message 保留，不在可重试闭集 |
| tool_choice | `5b9112fc3` | `buildNativeToolsBody(schemas, toolChoice?)`；缺省**不写** `tool_choice` 键（逐字节兼容）；空 tools 返回 undefined |
| native 降级重试 | `5b9112fc3` | `shouldRetryNativeTools` + `NATIVE_TOOLS_RETRY_INTERVAL=5`：探测失败不再永久降级，满 5 轮重试一次 |
| 接线 | `7335c0837` | `agent.ts` 7 处（从 HEAD 原文构造，单独 tsc 验证 0 错误） |

复验：`cd apps/cli && node node_modules/vitest/vitest.mjs run tests/tool-call-resilience.test.ts`（9 条）。

## 二、P1 四件的判定

### P1-3 校验器约束（已做，`a7f6fe01b`）

`ToolParameter` 扩 5 个可选字段（pattern / minLength / maxLength / minimum / maximum）；`argument-validator` 补三类 reason（`pattern_mismatch` / `length_mismatch` / `range_mismatch`）；投影层 `packages/types/src/schema-projection.ts` 本就支持这些键（词汇表 49-61 行、显式发射 333-334 行）⇒ 校验面与模型面同源。**非法正则不静默跳过**，一律判 `pattern_mismatch`。

复验：`cd apps/cli && node node_modules/vitest/vitest.mjs run tests/argument-validator.test.ts`（46 条，其中 5 条专测本票）。

### P1-1 工具结果缓存（判定：不做）

三条事实叠在一起：

1. `executeToolCall` 已有 `runWithToolHookScope` + 幂等双键（`call.id` 绑定），同一调用不会被派发两次；
2. 再叠按参数指纹的缓存后，`read_file` / `grep` 这类工具会在文件被改后返回**旧内容**——“幽灵旧值”直接污染后续判断（本仓自己踩过：落地 checkout 覆盖工作树后读到的就是旧文件）；
3. 现值收益只是“省一次重复执行”，而模型几乎不重复同参数调用。

结论：要缓存先要有“缓存失效的正确性来源”（文件 mtime/hash 绑定），那是另一张票，不在本阶段。

### P1-2 先完成先回灌（待办，落点明确）

现状证据（`apps/cli/src/tools/tool-call-scheduler.ts` 49-52 行自述）：“批次内 `Promise.all`，批次间串行…… 任一枚 reject 时整批 reject，后续批次不再启动”。

即：流式期“先完成的工具结果先回灌给模型”**没有实现**，模型要等整批。

落点：`executeToolCallsInBatches` 的返回面（改成 async iterator 或 onResult 回调）。阻塞：该文件未入库（`git log` 对该路径 0 次），改动会与该文件作者冲突。

附带：P0 的 `toolCrashResult` 折法是“不炸批”的正解，但工作树重构版走 scheduler，需要在 scheduler 内同样包 try/catch（见 `agent.ts` 工作树版）。

### P1-4 工具级 OTel span（判定：不做）

- 全仓无 `@opentelemetry/*` 运行时依赖；引入要改 `package.json` + `pnpm-lock.yaml`；
- `package.json` 当前是他人暂存态（`M`），动它会抢同一份锁文件；
- 已有的 `runPreToolCall` / `fireToolOutcomeHooks` / `runPostToolCall` 三处钩子已覆盖“可观测/可拦截”，OTel 只是换一种导出格式。

结论：等有真实跨进程采集需求再引，不在本轮。

## 三、P2 ITCP 协议（已闭环）

| 件 | 提交 |
| --- | --- |
| 规范 v0.1（含 §5.1 三态与跨代） | `6e8b160c` |
| 消费账（含“怎么跑”） | `1ef6a22a` |
| conformance 运行器（三态 + `--worktree-body`） | `52ff21b1` |
| 端到端 4 条 | `60d71518` |
| 独立包 `protocol/` + 同步器 + 4 条锁 | `9e3bb9c` |

复验：

```
node scripts/check-tool-contract-declared.mjs --self-test    # 52 通过 / 0 失败
node scripts/tool-contract-conformance.mjs                   # ok / not-ok / unknown 三态；unknown = 守门跨代拒绝回答
node --test scripts/tests/tool-contract-conformance.test.mjs # 4 条
node --test scripts/tests/itcp-package.test.mjs              # 4 条
node scripts/sync-itcp-package.mjs --check                   # 独立包与源同步(2/2)
```

## 四、不许再犯

- 不把 `unknown` 读成通过；跨代失真读数（`--worktree-body`）不进发布账。
- 不把保留位说成已启用（`denyPrecedence` / `persistAllowance` / `confirmation` 的判定见消费账）。
- 不做“没有失效正确性来源”的缓存。
- 落地器收尾报红不回滚，但也不许替它报绿；红面属存量时如实标注，属本票引入时当场修。
- 报告里出现的“已入库”必须有 `git show HEAD:<path>` 能取到的证据（本票有过一次失实：`aea20418d` 整票回滚后仍被写成已入库）。
- 断言“全仓没有 X”之前必须给出搜索面（文件/glob），且至少覆盖 `apps/cli/src/**` 与 `packages/**` 两个根。本票三次同类失实的第三次就在这里：只在 `apps/cli/src/tools/index.ts` 里查 `Promise.all` 零命中，就断言“执行串行、并行度 1”；真相是 `apps/cli/src/commands/agent.ts:3152` **早就有 `Promise.all`** 的全并行，两处 `for (const call of toolCalls)` 只是“执行前顺序触发副作用”（3118 起）与“执行后保序写账”（3230 起）。**不得再把这两处 `for` 读成串行执行器**。

## 五、并行会话下的提交安全（2026-11-27 事故复盘）

**事故**：并行会话在 HEAD 指向本票提交（`54b845cb4`）时跑了 `git commit --amend`，把本票提交改写为孤儿（reflog 可见、分支不可达），随后 HEAD 被其修正提交取代——6 枚提交从分支历史消失。

**排查**：`git cat-file -e HEAD:<path>` 逐条核对（8 个关键路径全 `MISS`）+ `git reflog`（看到孤儿提交仍在，内容未丢）。

**恢复**：内容仍在工作树与对象库 ⇒ 两票重建（`7bfc0e128` 14 个新路径 / `a57961348` 4 个既有文件），共 18 文件 +1929 行；验证 55/55（vitest）+ 8/8（node:test）。

**规矩（此后照做）**：

1. 每次提交后立刻 `git cat-file -e HEAD:<path>` 验证路径在树——这次正是它发现了事故；
2. `git commit --amend` 只允许在“HEAD 确是本会话刚写的那一枚提交”时用；不确定就新建提交；
3. 重要批次提交后打轻量保护 `git tag <name> <sha>`（本票打了 `itcp-recovery-2026-11-27`）并建 backup 分支；
4. 推送需显式开窗（`PUSH_WINDOW`）；未开窗时 `git-push-guard` 拒推是**设计**，不是故障——不得代开窗口；
5. 分叉时走 `scripts/git-sync-converge.mjs`（索引层合并、不碰工作区、`assertNoSilentRevert` fail-closed），不要手工 `reset --hard`。

## 六、双仓同步的操作口径（2026-11-27 立）

两远端：`origin`（GitHub）与 `gitee`。要求**任意时刻 main 三端一致**（本地 = origin = gitee）。

口径：

1. 先收敛 origin：`PUSH_WINDOW=1 node scripts/git-sync-converge.mjs --rounds 3`（索引层合并、不碰工作区、`assertNoSilentRevert` fail-closed）。
2. 再把 origin 的 SHA 推给 gitee：`git push gitee origin/main:refs/heads/main`。
3. 三端核对：`git rev-parse HEAD` / `git ls-remote origin refs/heads/main` / `git ls-remote gitee refs/heads/main` 三者必须相等。

两个必须知道的边界：

- gitee **首次追赶历史**时，`.husky/pre-push` 的闸会拦：仓库重量预算（本次报“引入 374MB 新对象 > 50MB”）、推送区间大文件闸（`.ihui-agent/archive/PROJECT_PLAN_*.md` 单份 16MB/9MB，按“增量 > 2MB”判）。前者有官方应急开关 `HUSKY_SKIP_REPO_WEIGHT=1`；后者无开关，只能清理归档历史（会重写 SHA、需全会话停机协调）。本次追赶用 `HUSKY_SKIP_REPO_WEIGHT=1` 放行了前者。
- 一旦追上，后续增量很小，正常 `git push gitee` 即可过闸。当前推送门有 `rc=1` 但按机主 2026-11-23 改定“默认允许跳钩”放行，留痕在 `.ihui-agent/state/pre-push-skips.jsonl`（kind=`push-gate-default-skip`）——这是**跳过的门**，不是判定通过。

事实核对（2026-11-27 夜现读）：三端 = `36c60da4ea9`；`tool-call-resilience` 9 + `argument-validator` 46 = 55/55；保护 tag `dual-sync-2026-11-27` / `dual-sync-final-2026-11-27`。

## 七、为什么"114 枚契约铺满"这一票没有入库（2026-11-27 夜）

索引里有 24 个工具文件、**114 个纯契约块**（`git diff --cached HEAD` 逐文件判过：零删除行、零新增 import、工厂 `contractFor` 在 HEAD 的 `route-tools.ts:192` 与 `ai-bridge.ts:54` 已有）——形态上完全可以单独入库，一分钟都不用碰 ptc 链。但**没有入**，卡在一处量过的退化：

- 113/113 枚新契约的 `resultBudget.policy` 都是 `truncate`，其中 102 枚 `providerVisibleLimitBytes: 8 * 1024`。
- `budgets.ts:41` `CONTRACT_BYTES_PER_CHAR = 3`，`:152` `maxChars = Math.floor(limitBytes / 3)` ⇒ 8KB 折算 **2,730 字符**；`preview.bytes: 2048` ⇒ 预览 **682 字符**。
- 同文件 `:59-62` 的 `DEFAULT_TOOL_OUTPUT_BUDGET`（无契约工具走的那档）是 `maxChars: 24_000 / previewChars: 1_200`。

也就是说：给这 113 枚补契约，等于把它们的模型可见输出从 24,000 字符砍到 **2,730（-88.6%）**、预览从 1,200 砍到 **682**，且 `truncate` 不落盘——超限部分直接丢。受害最重的是 `run_tests`、`git_diff`、`git_*`、`terminal_exec_sandboxed`、`lsp_*`、`browser_evaluate` 这类日志/长文本工具：一次失败堆栈就过 2KB，模型只剩 682 字符预览，等于看不见失败原因。

契约层的价值在治理（审批 / 可见性 / 来源 / 预算），不该顺带削掉"模型能看见多少"。

修法（二选一，不许混着来）：

1. `providerVisibleLimitBytes` 提到 ≥ `24 * 1024`（与默认档 `maxChars` 持平），`preview.bytes` ≥ `4_800`；或
2. 长输出类（`run_tests` / `terminal_*` / `git_diff` / `lsp_*` / `browser_evaluate`）改 `policy: 'artifact'`，落盘回灌路径而不是丢。

改完重跑守门与契约面测试（48 条），整票即可入库。**在那之前，15/129 是唯一诚实的读数；129/129 不能靠削输出换。**

另附一层已核代码的安全结论（非推测）：这 114 枚全部 `requiresApproval: false`，但**不会放宽任何危险门**——`permissions.ts:165` 的契约轴是单向的（"只能把自动放行升成要人批准，不能反向，也不碰 deny"），`dangerLevel` 的 mode 矩阵先算完，契约只在 `allow` 上做升级。所以审批面无风险；唯一风险就是上面那笔输出预算。

## 八、W4-14（工具并行化）的真实状态：已完工，待整链交付（2026-11-27 夜）

逐条给位置，不写推测：

- **票号自证**：`tool-executor.ts:5`、`tool-exec-budget-policy.ts:5`、`tool-call-scheduler.ts:5` 三处都标 W4-14。
- **零件齐**：`tool-call-scheduler.ts`（零 import；批内 `Promise.all`、批间串行、结果保序；上限默认 10 / 硬顶 64 / `IHUI_MAX_PARALLEL_TOOL_CALLS` 可覆盖，每批开始重读）、`tool-exec-budget-policy.ts`（零 import，墙钟预算第二轴）、`tool-executor.ts`（只 import `./index.js`，native 薄封装 + ptc 只读绑定接缝）、`tool-registration.ts`（import `./index.js` + `../audit.js`）。
- **接线已完成**（工作树）：`apps/cli/src/commands/agent.ts:3414` 已是 `executeToolCallsInBatches(...)`，`:57-58` 两个 import，`:273` / `:951` `maxParallelToolCalls?: number`。
- **测试齐**：`tool-call-scheduler.test.ts` 8 条 + `tool-parallelism-cost-guard.test.ts` 8 条（mock `streamChat` 的端到端）。
- **已于 2026-11-28 整链落地**（本节原判"HEAD 仍是全并行无上限"已过期）：`agent.ts:3421` 实际调用 `executeToolCallsInBatches(...)`，文件内已**无**裸 `Promise.all(toolCalls...)`；`:57-58` 两个 import，`:275` / `:958` 两处 `maxParallelToolCalls?: number`；四个零件 `tool-call-scheduler.ts` / `tool-exec-budget-policy.ts` / `tool-executor.ts` / `tool-registration.ts` 全部在 HEAD。
- **验证状态（2026-11-28 实测）**：`tests/tool-call-scheduler.test.ts` **8 passed**；`tests/tool-parallelism-cost-guard.test.ts` 因 `Cannot find package '@ihui/types'`（由 `packages/agent-sdk/dist/contract.js` 引用）**跑不起来**——这是 monorepo 依赖未安装/未构建的环境问题，不是代码缺陷，**不许当成通过，也不许当成失败**。
- **历史：11-27 夜为什么不能拆件入库**：`ptc-tool.ts` 的相对导入指向 `ptc-executor.ts` / `tool-executor.ts`，`agent.ts` 重构版与 `index.ts` / `permissions.ts` 的 MM 版互为前提，拆任何一件都会让当时的 HEAD 编译断裂。所以当时选择整链一次性交付。**这个判断是对的**——11-28 整链搬完，`agent.ts` 一次到位，没有留下半截状态。

**为什么这一节必须写**：这条链完工却没有登记、没有租约（`PROJECT_PLAN.md` 搜 `W4` / `parallel` 零命中，`lock-lease.json` 只有一枚 safe-commit 锁）。它被反复误读成"缺并行""差接线""在别人票上"——本票自己就误读了三次（见第四节第 6 条）。登记它，是为了下一个接手的人不必重新考古。

**读法纪律**：判断"某项能力在不在"，必须同时看 HEAD 与工作树两个面。HEAD 是交付面，工作树是正在做的面；只看一个面必然得出半张结论——本票三次失实全部出在这里。

## 九、44 条基线全送达：20→43，其中 19 条是判据失真而非真缺（2026-11-28）

### 读数

`scripts/deep-native-audit.mjs` 44 条候选，最终 **present 43 / partial 0 / absent 0 / n/a 1**。
n/a 唯一一条是 B3-10（硬件专用键盘钩子），取证文档自己写明"不建议照搬"，明确不做。

起点是 present 20 / partial 5 / absent 18 / n/a 1。中途一次校准到 24 / 1，之后逐条推进到 43。

### 最值得记的一件事：判据失真比能力缺口更危险

24 条被推进的条目里，**19 条不是"没做"，是"复核器钉错了位置或钉错了词表"**。分五型：

1. **钉不存在的文件**（5 例）：`auto-restart.ts`（真实 `graceful-restart.ts`）、
   `workspace_changes_service.py`（真实 `app/core/workspace_changes.py`）、
   `native_plugin_abi.rs`（真实 `native_module_abi.rs`）、
   `native_connector_host.rs`（真实 `bin/ihui_native_host.rs`）、
   `connection_watcher.py`（真实要新写）。
2. **钉对标程序的 API 名**（6 例）：`IsSBoxSupported`/`SBoxSDK_Init`（真实 `sandbox_capability`）、
   `InitIPCInterface2WithSecurityDescriptor`（真实 `build_restricted_sddl`）、
   `start-daemon`/`handedOff`（真实 `admitWorkerCommand`/`HandoffVerdict`）、
   `ClipboardToken`（真实 `GrantStore::consume`）、`LocalProxy`（真实 `startEgressLocalProxy`）、
   `IsSBoxSupported` 同型。
3. **`**/` glob 语义判空**（5 例）：`collab/**/*.ts`、`app/services/**/*.py`、
   `sandbox/egress/**/*.ts`、`apps/cli/src/commands/**/*.ts`、`apps/cli/src/**/*.ts`。
   本器的 `globToRegExp` 把 `**/` 解释成"至少一层目录"，而实际文件是平铺的。
4. **大小写错位**（2 例）：`pendingRestart` 实际是 `PendingRestart`；`manifest|version` 小写
   实际是 `PREWARM_SCHEMA_VERSION`。
5. **钉错语义层**（1 例）：`rtc_bridge.rs`（Rust）实际实现在 TS 侧 `apps/cli/src/rtc/`。

**为什么这比"真缺 19 条"更危险**：判据失真会让人给一份**虚假的缺口清单**排工期。
按那份清单做，等于把已经做好的能力重做一遍（重复实现），或者把已经通的路再挖开
（破坏性重构）。本票自己就因此差点重复实现 `output_ring.py`（写了一份字节版后删除）。

### 固化成规则的三条

1. **判据必须钉实现符号，文件路径只是定位手段**。文件不存在时先按**能力**搜，
   不要按名字搜——名字是别人的，能力是自己的。
2. **判据里出现"本项目从没用过的词"时，先怀疑是抄了对标程序的 API 名**。
   本项目对同类能力有自己的词表（sandbox_capability / build_restricted_sddl /
   GrantStore / admitWorkerCommand），直接用对方导出名必然零命中。
3. **复核器自身的 glob 也要被测**。`**/` 已经五次判空，说明这不是偶发；
   凡是判据写 `**/*.ext`，必须就地验证一次命中数 > 0。

### 真写代码的 8 条

| 条目 | 落点 | 判据核心 |
|---|---|---|
| B1-06 | `goal_round_driver.py` | 五态裁决、三元确定性判序、终态不参与 |
| B2-11 | `checkpoint_rewind.py` | 合成消息 id、身份与归属先于数据、400/404 分口 |
| B2-05 | `tool_timeout_policy.py` + `command_streamer.py` | `timeout_ms` 毫秒优先、向上取整 |
| P0-7 | `context_self_check.py` | 三态（ok/re_read_required/anchor_missing）只留痕不改流程 |
| B2-08 | `context_fs.py` | 四动词、动词面不改写鉴权结论、单目标拒通配符 |
| B2-04 | `connection_watcher.py` | 原因分级决定生死、次数分级决定节奏 |
| B4-11 | `watchdog-restart.ts` | 滑动窗口预算、时钟倒退判 `unjudged` 而非 `refuse` |
| B4-12 | `history-clean.ts` | 意图是第一类输入、认不出不落 all、keep 必非空 |

合计新增测试 17 + 7 + 18 + 19 + 20 + 23 + 17 + 20 + 20 = 161 条。

### 尚未闭环的两件（诚实登记）

1. **conformance 默认档仍是 `unknown`**。根因不在能力而在门体两代不一致：
   `scripts/check-tool-contract-declared.mjs` 工作树 blob `1def0f9`、HEAD blob `54bd98b`，
   该文件目前是 `M `（已 staged 未 commit，属并行会话在途）。
   `node scripts/tool-contract-conformance.mjs --worktree-body` 读数 **ok**：
   注册工具 129 / 无契约 0 / 棘轮余量 0 / 契约摘除 0 / 翻缺省 0 / 自检 52 通过 0 失败。
   **不把它改成"两代不一致就自动降级"** —— 那等于把未判定报成通过。等门体提交后自然转 ok。
2. **阶段 2/3/4 的其余项**（契约同源已在 T1.1–T1.3 落库）不在本文档关闭范围内。

### 并行会话下的 merge 死锁与破局（可复用）

本轮遇到一次新形态的死锁：origin 被并行会话推进，而本地工作树有 906 个文件、约 1.4 万行
未提交改动，`git merge` 直接拒绝（要覆盖的文件全脏），`git stash` 会干扰并行会话、
`--force` 会抹掉远端提交。

破局三步，全程不碰工作树：

1. `git merge-tree --write-tree --merge-base=<base> 本地 origin` → 得合并树 sha；
2. `git commit-tree <tree> -p <本地> -p <origin> -m "..."` → 得 merge commit；
3. `git update-ref refs/heads/main <merge>` + `git push origin/gitee` 。

这一步把"三端逐 sha 同源"从"必须停手等别人"变成"可以继续往前走"。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
