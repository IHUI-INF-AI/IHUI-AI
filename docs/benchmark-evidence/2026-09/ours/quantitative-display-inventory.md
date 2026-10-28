<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 我方侧「量化显示项 × 端」对账(机器生成,HEAD 面)

> D160 的产物之二(与 `frame-by-end-matrix.md` 同一套纪律)。重新生成:
> `node scripts/benchmark-ours-quantitative.mjs`。**格子里的数字与文件名都是 git grep 的输出**,
> 不要手工改本文件 —— 要改的是代码,然后重跑。

**判读口径(三条,缺一条就会把这张表读反)**

1. `N 个文件(代表 site)` = 该端**源码里**有这个语义的标识符/文案键,且已排除测试面。
   它只到"这端有实现"这一层,**不判**"用户在屏幕上看得见"—— 那需要浏览器/模拟器会话,本机没有。
2. `**无命中**` = 该端源码里没有这些标识符。它**不等于**"该端没有这个功能"(别名、动态拼接、
   经共享层透传都会让它失明),也**不等于**"该端不该有"。要下结论必须按 V4 §十二 的正向证据规矩另查。
3. 标识符集合是按**现有实现实际用的词**列的(如 `contextUsage`/`usageRatio`、`elapsed`/`durationSec`),
   不是竞品有的概念。换句话说:这张表回答"我们已经把哪些数字上屏、在哪端",
   不回答"竞品还应该有哪个数字"—— 后者是差距票的活。

| 量化显示项 | web | 小程序 | RN | 共享屏 | 扩展 | CLI |
| --- | --- | --- | --- | --- | --- | --- |
| 消息/轮次时间戳 | 38 个文件(src/components/agents/UnifiedTaskDashboard.tsx、src/components/ai/agent-hooks-panel.tsx …) | 7 个文件(src/components/MaterialPopup.tsx、src/pages/exam/answer.tsx …) | 9 个文件(src/components/NotificationPanel.tsx、src/components/UserInfoCard.tsx …) | 1 个文件(app/src/features/memory/MemoryScreen.tsx) | **无命中** | 11 个文件(src/commands/chat-subcommands.ts、src/commands/developer.ts …) |
| 耗时(秒) | 55 个文件(src/api/agent-recorder-api.ts、src/api/best-of-api.ts …) | 6 个文件(src/components/VoiceInput.tsx、src/pkg-ai/ai/cards/ai-cards.tsx …) | 3 个文件(src/screens/AiAssistantN8nScreen.tsx、src/screens/LiveHostScreen.tsx …) | 1 个文件(app/src/features/self-media/SelfMediaScreen.tsx) | 2 个文件(entrypoints/sidepanel/components/MessageContent.tsx、entrypoints/sidepanel/pages/ChatPage.tsx) | 21 个文件(src/checkpoints/hunk-tracker.ts、src/codegraph/manager.ts …) |
| token 用量 | 21 个文件(src/components/ai/agent-task-progress-pane.tsx、src/components/ai/ai-side-panel-tools.tsx …) | 5 个文件(src/api/index.ts、src/pages/index/index.tsx …) | 1 个文件(src/screens/AiAssistantN8nScreen.tsx) | 1 个文件(app/src/features/chat/ContextUsagePanel.tsx) | 1 个文件(entrypoints/sidepanel/components/MessageContent.tsx) | 10 个文件(src/acp/server.ts、src/client/remote-adapter.ts …) |
| 上下文占用比例 | 5 个文件(src/components/ai/agent-task-progress-pane.tsx、src/components/ai/context-reference-panel.tsx …) | 2 个文件(src/api/index.ts、src/pkg-ai/ai/context-usage-strip.tsx) | **无命中** | 1 个文件(app/src/features/chat/ContextUsagePanel.tsx) | **无命中** | 3 个文件(src/commands/agent.ts、src/compaction-v2.ts …) |
| 队列位次/排队态 | 30 个文件(src/components/ai/model-load-bar.tsx、src/components/ai/progress-sections/next-steps-card.tsx …) | **无命中** | 1 个文件(src/screens/SubagentsScreen.tsx) | **无命中** | 2 个文件(entrypoints/sidepanel/components/QueueBar.tsx、entrypoints/sidepanel/pages/ChatPage.tsx) | 12 个文件(src/acp/server.ts、src/commands/agent.ts …) |

## 由这张表立刻能读出的三件事(每条都能被上面的命令复核)

- **上下文占用比例**在 RN / 扩展 是**无命中** —— 而"这一轮还剩多少上下文"是
  Codex/Qoder 都摆在决策面上的信息。这一格要不要补,得先回答"那些端有没有等价的用量帧消费面"
  (见 `frame-by-end-matrix.md` 的 usage 行),不能直接照竞品补个 UI。
- **队列位次/排队态**在 小程序 / 共享屏 是**无命中** —— 与 D162(队列动作缺拒因说明)
  同片区域,但这格说明的是**整条队列可视化在那些端还没有落点**,不是"文案没写好"。
- **时间戳 / 耗时 / token** 三项各端命中密度差得很多(web 38 / 56 / 21 对比共享屏与扩展的个位数)——
  这种差异**不能**直接当差距读:共享屏只有一个文件命中很可能是因为多数渲染在 web 侧;
  要判"某端少了什么"必须逐 site 看渲染归属,那是下一票的活。

## 这份清单不覆盖的(如实登记)

- 不判竞品侧对应项(竞品侧的同类判定走三份 `codex/qoder/trae` 清单 + V4 §十二 的否证规矩);
- 不判 i18n 文案是否五语言齐(那是 §19 那套门的活);
- 不判运行时是否真的渲染出来(本机无浏览器/模拟器会话)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
