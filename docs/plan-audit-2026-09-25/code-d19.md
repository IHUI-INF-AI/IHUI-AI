<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D19(收窄)批次报告 — terminal_delta 接入 extension + cli

日期:2026-09-26 · 代理:编码子代理(不碰 git)

## 任务目标

把 `terminal_delta` 流式帧接进 extension 与 cli 两端的对话渲染面;不碰 miniapp-taro / mobile-rn(他端在途)。

## Contract(权威帧名与字段,未新造)

- 帧名 `terminal_delta`(snake_case,与 `terminal_start`/`terminal_end` 同族;`apps/ai-service/app/core/sse_contract.py` 只读 HEAD 取证,**未修改**)。
- 载荷 = `TerminalDeltaEvent`(`packages/api-client/src/client.ts` 821-836 行):`{ terminalId, command, stream:'stdout'|'stderr', text, iteration, messageId? }`。
- 解析层不重复实现:两端均消费 api-client `streamChat` 既有 `onTerminalDelta` 通道(`tryParseTerminalDelta`,含"不落正文"分流守卫)。
- 渲染语义对齐基准(读 mobile-rn / web,不改它们):live 按 terminalId 累加、超限保尾部(web/mobile-rn 同值 20000)、terminal_end 归并"取更长者"(web `terminal-section.tsx` effectiveOutput 口径)。

## 改动清单

### extension(消费点:`apps/extension/entrypoints/sidepanel/pages/ChatPage.tsx`)

- `:83-127` 新增导出纯函数:`TERMINAL_LIVE_MAX_CHARS`(20000)/ `foldTerminalDeltaIntoTasks` / `pickTerminalEndOutput`。
- `:437-448` `streamChat` opts 枚举表新增 `onTerminalDelta`:把增量折进既有 `message.terminalTasks[].output`(terminalId 匹配;空帧/无主帧丢弃,与 web 同口径)。**渲染复用既有终端 UI**:`MessageContent` ← `@ihui/shared buildRenderModel`(toTerminalBlock)→ `TerminalBlockView` 的 `<pre>{block.output}</pre>`(:549-552),零新组件、零新 UI。
- `:466` `onTerminalEnd` 的 `output` 由整帧覆盖改为 `pickTerminalEndOutput(evt.output, task.output)`(整帧截 8000,不吃掉流期累计尾部)。
- **回放可回退性**:增量落在消息模型 `terminalTasks[].output` 上,流结束后该 assistant 消息仍持有完整内容,`MessageContent` 渲染不区分流式/历史;分叉回放(`hydrateBranchTranscript`)只重载 content,与本改动无冲突(端内消息态存续)。

### cli(消费点:`apps/cli/src/commands/agent.ts` + `apps/cli/src/commands/repl.ts`)

- `agent.ts:27` import 增 `type TerminalDeltaEvent`。
- `agent.ts:411-412`(runToolLoop options)与 `:712-713`(SampleWithRetryOptions)各增 `onTerminalDelta?: NonNullable<StreamChatOptions['onTerminalDelta']>`,透传两处:`:880`(sampleWithRetry→streamChat)与 `:1278`(doSample→sampleWithRetry)。
- `agent.ts:715-767` 新增导出:`TERMINAL_LINE_MAX_CHARS`(200)/ `takeTerminalDeltaLines`(整行才出、半行按 terminalId 留 pending、空帧丢、stderr 标 `[terminal:err]`、超长截断)/ `createTerminalDeltaSink`(repl 装车点)。
- `repl.ts:23` import `createTerminalDeltaSink`;`:2394-2397` runToolLoop 事件表新增 `onTerminalDelta: createTerminalDeltaSink((line) => state.statusLine.noteLine(line))` —— 打进 noteLine 家族同一出口(retry/steer/budget 同纪律),状态行头注自证的"逐行输出只适合低频源"由**整行门控**满足(半行不落地)。
- 输出行仅含 ASCII 标签 + 命令原文 + 输出行(无任何新增本地化文案,零 i18n 键;`[terminal]` 形态沿用端内既有 `[retry]` 括号标签先例)。
- 定位结论:消费面确认在 `src/commands/{agent,repl}.ts`(非 `src/tools/**`);`apps/cli/src/tools/terminal.ts` 是本地执行工具,与 SSE 帧无关,未触碰。

### 覆盖面对账(守门 90 台账)

`scripts/data/sse-dispatch-coverage.json`(check-sse-dispatch-parity.mjs 的数据文件,任务清单虽未点名,判据要求"代码与台账同票",不动它则提交链必红):

- `missing.extension` / `missing.cli` 删除 `onTerminalDelta`(两端现已真接);
- `baseline.extension 16→17`、`baseline.cli 12→14` 随命中上调(判据要求的维护动作);
- `no-terminal-delta-ui` 分组文案更新为真实现状(仍被 miniapp-taro 引用,不孤儿);
- **顺带修复他人存量红**:台账登记 `cli.onUsage: no-usage-ui` 但 HEAD 的 cli 早已接线(agent.ts 的 WP-2 usage 透传)——门在本票之前就跑红("声明了其实已注册的帧");按判据"该删的删"删除该条,并由镜像测试 ⑥"分组不得留无人引用"连带删除孤儿分组 `no-usage-ui`。此为存量失账回补,不放宽任何判据。
- `scripts/tests/check-sse-dispatch-parity.test.mjs`:⑤b"代码与台账同票"暂存集补入 `ChatPage.tsx`(缺它会让 extension 在暂存区口径读到 HEAD 旧命中 16<17 假红;方向是收紧)。
- **守门 57/`check-chat-element-coverage`**:全量复跑确认其 132 条元素清单**不含** terminal_delta 类元素(events 只登记 terminal_start/terminal_end),该面无需登记,exit 0 保持。

## 新增测试(已 `watermark.mjs inject`,`verify` 2/2 完好)

- `apps/extension/tests/terminal-delta.test.tsx`(8 例):折叠/丢弃/保尾部、取更长者归并、**装车正则锁**(opts 里 `onTerminalDelta:` 必须调用被测折叠函数、terminal_end 必须走归并)、MessageContent 既有终端块渲染实证。夹具沿用 steer-notice.test.tsx(ui-react stub + i18n mock)。
- `apps/cli/tests/terminal-delta.test.ts`(6 例):整行门控/跨帧拼接/stderr 标记/截断/sink 小闭环/runToolLoop→streamChat 逐字段透传(镜像 agent-steer-note.test.ts 的 mock 形态)。

## 验证输出(末行原文)

| 命令 | 末行 |
| --- | --- |
| `pnpm --filter @ihui/cli typecheck` | `$ tsc --noEmit`(0 错误) |
| `pnpm --filter @ihui/extension typecheck` | 全包 1 错 = `lib/agent-control.ts(184)`(工作树该文件干净 ⇒ 他人/连带红);`grep -i "ChatPage\|terminal-delta"` 计数 **0** —— 我的文件 0 错。区分依据:上方 grep 两条计数命令 |
| `pnpm exec vitest run tests/terminal-delta.test.tsx`(extension) | `Tests 8 passed (8)` |
| `pnpm exec vitest run tests/terminal-delta.test.ts`(cli) | `Tests 6 passed (6)` |
| cli 邻接回归(agent-steer-note/native-fc/native-fc-config/tool-parallelism 4 文件) | `Tests 30 passed (30)` |
| extension 邻接回归(steer-notice/chat-branch/terminal-isolation 3 文件) | `Tests 46 passed (46)` |
| `node scripts/check-chat-element-coverage.mjs` | `✅ [chat-element-coverage] 清单 132 条…锚点与契约均一致`(exit 0) |
| `node scripts/check-sse-dispatch-parity.mjs`(HEAD 口径) | `🚫 …失败:4 项` —— **全部是"代码未入库、台账先行"的同票窗口红**(extension/cli 各 2:baseline 16<17、13<14 与 onTerminalDelta 未声明)。**落票即绿的机器证明**:① 镜像测试 `⑤b 暂存区口径实跑…必须判绿 ✔`(临时索引注入本票 3 个代码文件+台账后 `守门通过`);② `node .ihui-agent/tmp/plan-audit/d19-sim-parity.mjs`(工作树口径模拟该门判据)末行 `worktree-sim: ok=true`;③ 改动前 HEAD 实跑本门本就红(onUsage 存量失账),现 4 项红全部收敛到"待同票落地"。 |
| `node scripts/check-sse-dispatch-parity.mjs --self-test` | `[self-test] 8/8 通过` |
| `node --test scripts/tests/check-sse-dispatch-parity.test.mjs` | 10 例中 9 ✔,唯一 ✖ 即 ②"真仓 HEAD 实测与台账精确一致"——结构性窗口红(台账先行于 HEAD 代码;改动前该项因他人 onUsage 失账也已红),⑤b 为同判据的暂存区版本已 ✔ |

## 收尾自检

`git status --porcelain` 全量核对:我触碰的路径 = `ChatPage.tsx`、`agent.ts`、`repl.ts`、`sse-dispatch-coverage.json`、`check-sse-dispatch-parity.test.mjs`、两新测试文件,**恰在清单内(+台账/其镜像测试,理由如上)**。其余脏文件(PROJECT_PLAN、ai-service/*、miniapp-taro/*、mobile-rn/*、cli tools/hooks/tests、web tests、`apps/cli/tests/budget-note.test.ts` 等)均为他人在途,未读改写;禁改清单文件零触碰。

## 剩余缺口(如实)

1. **extension typecheck 的 1 枚 `agent-control.ts` 红**:HEAD 文件干净却编译不过,疑为他人对 `@ihui/types`/dist 的在途改动连带(非本票文件,越权修不修);主代理提交前若仍红需按其会话归因处理。
2. cli 端 `onTerminalStart/onTerminalEnd` 仍挂 `no-terminal-stream-ui`(D19 收窄票只接 delta;两帧要卡片宿主,另票)。
3. miniapp-taro 的 `onTerminalDelta` 保持登记未接 —— 他端会话在改 `ChatMessageItem.tsx`,按任务书禁区未触碰;台账分组文案已指明"补齐参照已接四端"。
4. 本票未 commit(按 RULES 交主代理 safe-commit);**代码与台账必须同票入库**,否则守门 90 的提交链(--staged 判索引)与镜像 ② 互斥。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
