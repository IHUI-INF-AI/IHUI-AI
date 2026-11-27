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

事实核对（2026-11-27 现读）：三端 = `1c769f0be9f`；`tool-call-resilience` 9 + `argument-validator` 46 = 55/55；保护 tag `dual-sync-2026-11-27`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
