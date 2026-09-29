<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 我方侧 AI 对话流「帧 × 端」消费面对账(机器生成,HEAD 面)

> 由 `scripts/benchmark-frame-end-matrix.mjs` 生成,D160 的产物之一。重新生成:
> `node scripts/benchmark-frame-end-matrix.mjs` —— **本文件的任何一格都不该手工改**,
> 读数变了就说明代码或契约变了,那就去改代码或另立一票,而不是改这张表。
>
> **取材面**:全部读数来自 `git grep -n -I -E <分派位模式> HEAD -- <端路径>`,不看工作树
> (本机工作树对上千个路径滞后 HEAD,按磁盘判会在"恒红/假绿"之间来回跳 —— 本仓所有对账门同口径)。
> **帧全集** = TS 契约 `packages/shared/src/sse/contract.ts` 的 `SSE_EVENTS`(26 名) ∪
> Python 契约 `apps/ai-service/app/core/sse_contract.py` 的 `SSE_EVENTS` frozenset(31 名),合计 31 名。
>
> ## 怎么读(四条,别只挑好看的)
>
> 1. `有·switch / 有·table / 有·compare(路径:行 +N)` = 该帧名在该端**生产面**落在一个分派位上
>    (`case 'x'` / `'x':` 分派表键 / `=== 'x'` 或线格式 `event: x`),已排除 `tests/`、`__tests__/`、
>    `e2e/`、`*.test.*`。它是"接线存在"的证据,**不是**"用户看得见"的证据:到端渲染要浏览器/模拟器
>    会话,本机结构性缺这两样,所以本表一律不下"已实测"结论。
> 2. `判不出(字面量 N 处,无分派位)` = 有带引号的该名字,但不在分派位上。**不得**读成"接了",
>    也**不得**读成"没接",要人工看一眼。
> 3. `—` 只表示"该端源码里没有这个带引号的帧名字面量"。以下三型它结构上判不出来,
>    因此**不得**被读成"该端没有这一能力":① 帧名由模板字符串动态拼接;② 经命名空间对象或
>    `export *` 转发;③ 该端走 api-client 的集中分派(端内只见回调 prop 名,不见帧名)。
>    —— 已知实例:web 侧消费 `citations`/`goal_updated` 是经 api-client 的 `onCitations` prop,
>    所以 web 列里该帧显示 `—` 或"判不出",而**不代表** web 没有这个功能。
> 4. `**仅测试面**` = 只有测试文件提到该帧 ⇒ 本仓最高频的失效型("造好没装车"),按 §12f 的优先级
>    它比新增功能票更该先修。
>
> ## 表
>
| 帧名 | web | miniapp-taro | mobile-rn | packages/app | extension | desktop | cli | api-client | shared |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `budget` | 有·compare(apps/web/src/components/ai/orchestration-hub-panel.tsx:1073) | — | — | — | — | 判不出(字面量 1 处,无分派位) | 有·compare(apps/cli/src/tools/index.ts:250) | 有·switch(packages/api-client/src/client.ts:3668 +5) | 有·compare(packages/shared/src/utils/sse-parse.ts:361) |
| `chunk` | **仅测试面** | 有·switch(apps/miniapp-taro/src/api/index.ts:436) | — | — | **仅测试面** | — | — | — | **仅测试面** |
| `citations` | 判不出(字面量 1 处,无分派位) | 有·switch(apps/miniapp-taro/src/api/index.ts:530) | — | — | — | — | — | 有·switch(packages/api-client/src/client.ts:3648 +3) | 有·compare(packages/shared/src/utils/sse-parse.ts:749) |
| `cleared` | 有·compare(apps/web/src/stores/goal.ts:177) | 判不出(字面量 3 处,无分派位) | — | — | — | — | 判不出(字面量 1 处,无分派位) | 判不出(字面量 2 处,无分派位) | 有·compare(packages/shared/src/sse/contract.ts:460 +1) |
| `compaction` | 有·compare(apps/web/app/(main)/settings/gateway/types.ts:43) | 有·switch(apps/miniapp-taro/src/api/index.ts:445) | — | — | — | — | — | 有·switch(packages/api-client/src/client.ts:3662 +3) | 有·table(packages/shared/src/sse/contract.ts:18) |
| `done` | 有·switch(apps/web/app/(main)/agent-canvas/AgentCanvasClient.tsx:215 +44) | 有·switch(apps/miniapp-taro/src/api/index.ts:448 +6) | 有·table(apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx:376 +3) | — | — | — | 有·switch(apps/cli/src/client/tui-client.ts:170 +4) | 有·switch(packages/api-client/src/endpoints/agent-runtime.ts:706 +3) | 有·switch(packages/shared/src/chat/handoff-package.ts:406 +3) |
| `error` | 有·switch(apps/web/app/(main)/admin/crew/helpers.ts:28 +85) | 有·switch(apps/miniapp-taro/src/api/index.ts:456 +10) | 有·table(apps/mobile-rn/src/utils/chat-render-model.ts:145 +2) | 有·switch(packages/app/src/features/live-detail/LiveDetailScreen.tsx:47 +3) | 有·switch(apps/extension/entrypoints/sidepanel/components/MessageContent.tsx:367 +7) | 判不出(字面量 1 处,无分派位) | 有·switch(apps/cli/src/client/tui-client.ts:167 +20) | 有·switch(packages/api-client/src/endpoints/agent-runtime.ts:709 +4) | 有·switch(packages/shared/src/chat/auto-topup.ts:380 +5) |
| `fallback` | 有·compare(apps/web/src/components/ai/voice-input.tsx:316 +1) | 有·switch(apps/miniapp-taro/src/api/index.ts:517) | — | — | 有·compare(apps/extension/entrypoints/sidepanel/components/VoiceInput.tsx:232) | — | 判不出(字面量 1 处,无分派位) | 有·compare(packages/api-client/src/client.ts:1814) | 有·compare(packages/shared/src/utils/sse-parse.ts:561) |
| `form_request` | 判不出(字面量 4 处,无分派位) | — | — | — | — | — | — | 有·switch(packages/api-client/src/client.ts:3676 +3) | 判不出(字面量 9 处,无分派位) |
| `goal_updated` | 判不出(字面量 4 处,无分派位) | 有·switch(apps/miniapp-taro/src/api/index.ts:547) | — | — | — | — | — | 有·switch(packages/api-client/src/client.ts:3657 +2) | 有·compare(packages/shared/src/utils/sse-parse.ts:477) |
| `injection_applied` | — | 有·switch(apps/miniapp-taro/src/api/index.ts:524) | — | — | — | — | — | 有·switch(packages/api-client/src/client.ts:3671 +4) | 有·compare(packages/shared/src/utils/sse-parse.ts:376) |
| `plan_updated` | 有·compare(apps/web/src/components/ide/agent-pane/AgentPane.tsx:217 +1) | 有·switch(apps/miniapp-taro/src/api/index.ts:493) | — | — | — | — | 判不出(字面量 1 处,无分派位) | 有·switch(packages/api-client/src/client.ts:3642 +2) | 有·compare(packages/shared/src/utils/sse-parse.ts:704) |
| `question` | 有·table(apps/web/app/(main)/a2a/page.tsx:559) | — | — | 判不出(字面量 1 处,无分派位) | — | — | 有·table(apps/cli/src/tools/ask-user.ts:16) | 有·switch(packages/api-client/src/client.ts:3622 +2) | 判不出(字面量 2 处,无分派位) |
| `reasoning` | 有·switch(apps/web/app/(main)/models/ModelsMarketplace.tsx:176) | 有·switch(apps/miniapp-taro/src/api/index.ts:439) | 有·compare(apps/mobile-rn/src/screens/ChatScreen.tsx:718) | — | 有·switch(apps/extension/entrypoints/sidepanel/components/MessageContent.tsx:872) | — | — | 有·compare(packages/api-client/src/client.ts:1414 +1) | 有·compare(packages/shared/src/utils/sse-parse.ts:509) |
| `resume_from` | — | — | — | — | — | — | — | — | — |
| `retry_scheduled` | — | 有·switch(apps/miniapp-taro/src/api/index.ts:527) | — | — | — | — | — | 有·switch(packages/api-client/src/client.ts:3673 +3) | 有·compare(packages/shared/src/utils/sse-parse.ts:394) |
| `session_id` | 判不出(字面量 3 处,无分派位) | — | — | — | — | — | 判不出(字面量 2 处,无分派位) | 有·table(packages/api-client/src/client.ts:1777) | — |
| `start` | 有·switch(apps/web/app/(main)/admin/crew/helpers.ts:38 +7) | — | — | — | — | — | 有·switch(apps/cli/src/headless-format.ts:97 +1) | 判不出(字面量 1 处,无分派位) | 判不出(字面量 5 处,无分派位) |
| `steer` | 判不出(字面量 5 处,无分派位) | 有·switch(apps/miniapp-taro/src/api/index.ts:535) | — | — | 判不出(字面量 3 处,无分派位) | — | 判不出(字面量 1 处,无分派位) | 有·switch(packages/api-client/src/client.ts:3665 +5) | 有·compare(packages/shared/src/chat/queue-interactions.ts:283 +1) |
| `subagent_end` | 有·compare(apps/web/src/hooks/use-agent-progress.ts:593) | 有·switch(apps/miniapp-taro/src/api/index.ts:484) | — | — | — | — | — | 有·switch(packages/api-client/src/client.ts:3630 +1) | 有·compare(packages/shared/src/utils/sse-parse.ts:645) |
| `subagent_progress` | — | 有·switch(apps/miniapp-taro/src/api/index.ts:481) | — | — | — | — | — | 有·switch(packages/api-client/src/client.ts:3629 +1) | 有·compare(packages/shared/src/utils/sse-parse.ts:618) |
| `subagent_spawn` | 有·compare(apps/web/src/hooks/use-agent-progress.ts:564) | 有·switch(apps/miniapp-taro/src/api/index.ts:478) | — | — | — | — | — | 有·switch(packages/api-client/src/client.ts:3628 +1) | 有·compare(packages/shared/src/utils/sse-parse.ts:605) |
| `task_id` | 有·compare(apps/web/src/components/ide/agent-pane/AgentPane.tsx:246) | — | — | — | — | — | 判不出(字面量 3 处,无分派位) | — | — |
| `terminal_delta` | — | 有·switch(apps/miniapp-taro/src/api/index.ts:502) | — | — | 有·compare(apps/extension/entrypoints/sidepanel/pages/ChatPage.tsx:85) | — | — | 有·switch(packages/api-client/src/client.ts:3651 +5) | 有·compare(packages/shared/src/utils/sse-parse.ts:417) |
| `terminal_end` | 有·compare(apps/web/src/components/ide/agent-pane/AgentPane.tsx:190 +1) | 有·switch(apps/miniapp-taro/src/api/index.ts:514) | — | — | — | — | — | 有·switch(packages/api-client/src/client.ts:3646 +1) | 有·compare(packages/shared/src/utils/sse-parse.ts:729) |
| `terminal_interaction` | 判不出(字面量 3 处,无分派位) | 有·switch(apps/miniapp-taro/src/api/index.ts:511) | — | — | — | — | — | 有·switch(packages/api-client/src/client.ts:3654 +3) | 有·compare(packages/shared/src/utils/sse-parse.ts:458) |
| `terminal_start` | 有·compare(apps/web/src/components/ide/agent-pane/AgentPane.tsx:175 +1) | 有·switch(apps/miniapp-taro/src/api/index.ts:496) | — | — | — | — | — | 有·switch(packages/api-client/src/client.ts:3645 +1) | 有·compare(packages/shared/src/utils/sse-parse.ts:716) |
| `thinking` | 有·switch(apps/web/src/lib/subagent-timeline-mapper.ts:89 +5) | 有·compare(apps/miniapp-taro/src/pkg-ai/ai/ChatMessageItem.tsx:665) | — | — | — | 判不出(字面量 7 处,无分派位) | — | 有·switch(packages/api-client/src/client.ts:3659 +7) | 有·switch(packages/shared/src/chat/element-pack.ts:468 +3) |
| `token` | 有·switch(apps/web/app/(main)/agent-canvas/AgentCanvasClient.tsx:187 +7) | 判不出(字面量 2 处,无分派位) | 有·switch(apps/mobile-rn/src/screens/ProfileScreen.tsx:321 +1) | — | — | 判不出(字面量 1 处,无分派位) | 有·switch(apps/cli/src/client/tui-client.ts:132 +1) | 判不出(字面量 5 处,无分派位) | 判不出(字面量 5 处,无分派位) |
| `type` | 有·table(apps/web/app/(main)/workflows/helpers.ts:53 +11) | **仅测试面** | 判不出(字面量 1 处,无分派位) | 判不出(字面量 1 处,无分派位) | 有·table(apps/extension/package.json:6) | 有·table(apps/desktop/package.json:6 +2311) | 有·table(apps/cli/src/plugins/marketplace.ts:21 +2) | 有·table(packages/api-client/src/client.ts:978 +10) | 有·table(packages/shared/src/sse/contract.ts:17 +4) |
| `usage` | 有·compare(apps/web/src/stores/chat.ts:89) | 有·switch(apps/miniapp-taro/src/api/index.ts:520) | — | — | — | — | 有·compare(apps/cli/src/tools/codegraph.ts:552 +1) | 有·compare(packages/api-client/src/client.ts:1056 +5) | 有·table(packages/shared/src/utils/sse-parse.ts:518) |

## 本表自身的读数(判不出不是瑕疵,是它唯一诚实的那一列)

- 格数 279 = 帧 31 × 端 9;其中 **有分派位 107**、**仅测试面 4**、**判不出 29**、无字面量 139。
- 把「判不出」抹成「有」或「没有」都是假账 —— 本线的 §十一 勘误表里,一半以上的条目就是这么来的。

## 已知判不了的一格(如实登记,不得读成"已覆盖")

- **端内回调 prop 层**没进本表:帧名→`onDelta`/`onToolCall`/`onCitations` 的映射住在
  `packages/api-client/src/client.ts` 与 `packages/shared/src/sse/agent-events.ts`,那里按字段挑、
  不出现帧名的情况(如帧级 `traceId` 到端那一格)本表看不见 —— 已知实例:服务端每条帧都带
  `traceId`(`c92f0777f0` + `413a651551`),而端上取不到,该格由台账里「帧级 traceId 到端那一半」那张票跟。
- 小程序自写流式传输层(D138 登记的"同一续传逻辑养两份实现")在本表里表现为 miniapp 列的命中,
  但**它是否与 api-client 那条链等价**判不出 —— 属 D138,不在本表射程。
- 各端**渲染层**是否把这些帧变成用户看得见的东西,本表完全不判(见上面读法第 1 条)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
