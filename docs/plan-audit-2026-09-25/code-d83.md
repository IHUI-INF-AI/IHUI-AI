<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# code-d83 — MCP 工具活动定制措辞接线(web + miniapp-taro 装车)

日期:2026-09-26 · 批次:D83 · 工作树:`G:\IHUI-AI`

## 0. 任务书前提的两处修正(先于一切结论)

1. **"共享层入口尚未扩出"不成立**:HEAD 里 `packages/shared/src/chat/mcp-tool-activity.ts` 已是完整的
   server×tool → server → tool → 功能名 → 码名 五层回落实现,并经 `packages/shared/src/chat/index.ts:13`
   桶形导出。它的渲染位入口就是任务书要的"一个函数,签名带 server/tool/时态/上下文"。
   因此**没有**在 `tool-display.ts` 再加第二个入口(那会造双真相源,违 §3);本次交付 = 纯接线。
2. **"门 55/56 现在只测通用名"不成立**:两门现网实跑均已覆盖 29 枚 MCP 措辞键(见 §5 末行输出),
   无需扩判据;缺口只在"零消费点",本票修的正是这个。

## 1. 新入口签名(既有,本票开始被真实消费)

```ts
// packages/shared/src/chat/mcp-tool-activity.ts:325(HEAD 既有)
function describeMcpToolActivity(
  input: {
    serverName?: string | null   // MCP server 名(空即跳过第 1、2 级)
    toolName: string             // 可带 mcp__server__ / server: 命名空间前缀
    state: 'running' | 'completed'
    context?: string | null      // 可展示对象文本;空即按 base 档(withContext 键仍供后续票用)
    translate: (key: string, params?: Record<string, string | number>) => string
  },
  tables?: McpActivityTables,
): string   // 显式非空返回;链尾 code-name 级兜原始码名,无 undefined 分支
```

## 2. 消费点(装车证据,文件:行)

| # | 端 | 文件:行 | 渲染面 |
|---|----|---------|--------|
| 1 | web | `apps/web/src/components/ai/task-status-bar.tsx:154` | 输入框上方流式活动条(`case 'tool'`,喂 `currentTask.mcpName`)|
| 2 | web | `apps/web/src/components/ai/tool-call-card.tsx:913` | 对话气泡工具行 rowTitle(`serverSource==='mcp'` 时喂 `serverName ?? serverId`;error/cancelled 保持既有中性档)|
| 3 | miniapp-taro | `apps/miniapp-taro/src/pkg-ai/ai/cards/tool-line.ts:57`(`toolRowTitle` 内)| 工具卡主标题 + 流式活动行;**真实渲染点 = `ai-cards.tsx:148` 与 `task-status-bar.tsx:110` 调用 toolRowTitle**(既有接线,未改)|

数据面为消费点 3 补了两处极小 plumbing(清单内改动,理由:ToolCallEvent 的 `serverName/serverId`
在端内聚合处被丢弃,不接上则第 1、2 级永远跳过 ⇒ 等于白接):
- `apps/miniapp-taro/src/pkg-ai/ai/cards/types.ts:33` `ToolCallView.serverName?: string`
- `apps/miniapp-taro/src/pkg-ai/ai/chat.tsx:531/545/581` 三处聚合点透传 `serverName: evt.serverName ?? evt.serverId`

改动合计 5 文件 +59/−10,另有 3 个新测试文件(§3)。

## 3. 测试(每个消费点都有"定制措辞被取到"断言)

新建(均已 `node scripts/watermark.mjs inject` → `[watermark:inject] ... → injected`):

1. `apps/web/src/components/ai/__tests__/task-status-bar-mcp-activity.test.tsx`(4 例)
   - `mcp__github__create_issue` + mcpName=github → 标题含 `toolMcpGithubCreateIssueActivity`(running)渲染值,不含 `create_issue`,不再走 `activityMcp` 泛化句 ⇒ **非回落证明**;
   - server 登记/工具未登记 → 落 `toolMcpServerGithubActivity`(第二级);
   - 双未登记 → 链尾 `activityMcp`,裸码名不上界面,标题非空 ⇒ **任务书"永不空串/不吐码名"链尾用例**;
   - 内置 `read_file` 回归不变。
2. `apps/web/src/components/ai/__tests__/tool-call-card-mcp-activity.test.tsx`(3 例)
   - running/success 两档都取到 server×tool 定制键渲染值;行内无 `toolMcp` 键名回显、无 ICU 残留、无码名;
   - server 级回落;内置 read_file 双时态回归。
3. `apps/miniapp-taro/tests/tool-line-mcp.test.ts`(6 例,记录式 t)
   - running/done 取到定制键+state 参数、`github:create_pull_request` 命名空间形态解析、
     server 级回落、双未登记落 `activityTool`(非空、不含 `toolMcp`)、
     **error 态不进双时态定制链**、内置工具回归。
   - ⇒ 回落链各级"定制 → server 通用 → 通用名/activityTool 句式"逐级钉死。

## 4. 验证输出(末行原文)

- `node --test packages/shared/tests/chat/tool-display.test.ts` **本机跑不了(既有基建限制,非本票引入)**:
  该 .ts 测试 import 无扩展名,Node 直跑 `ERR_MODULE_NOT_FOUND`;权威入口为 vitest,改跑
  `pnpm exec vitest run tests/chat/tool-display.test.ts tests/chat/mcp-tool-activity.test.ts`(packages/shared):
  `Tests  35 passed (35)`
- miniapp `pnpm exec vitest run tests/tool-line-mcp.test.ts tests/tool-line.test.ts`(新 + 既有回归):
  `Tests  15 passed (15)`
- web `pnpm exec vitest run`(4 个文件:2 新 + task-status-bar-activity + tool-call-card-activity 回归):
  `Tests  14 passed (14)`;改后复跑 2 新文件:`Tests  7 passed (7)`
- `pnpm --filter @ihui/shared typecheck` → `shared-typecheck-exit=0`(本票未改 shared)
- miniapp `pnpm exec tsc --noEmit` → `miniapp-typecheck-exit=0`
- web typecheck:**我的文件 0 错**(`tsc --noEmit | grep -E "task-status-bar-mcp|tool-call-card-mcp"` 零命中);
  既有红全部来自他人未提交在途文件(`??`/`M` 的 use-prompt-drafts、voice-note、tool-category、
  message-input、desktop-feed 等,区分命令即该条 grep)。
- 门 55:`node scripts/check-tool-name-display-coverage.mjs` →
  `[tool-name-coverage] ✅ 86/86 工具名有本地化功能名,五语言 taskStatus 全有值(词表另含 15 个未注册历史名)` exit 0
- 门 56:`node scripts/check-tool-display-resolvable.mjs` →
  `[tool-display-resolvable] ✅ 91 个工具功能名 + 29 个 MCP 措辞键(D83 三层表)在 5 语言 ×(shared + 5 端 + taro 生成物)全部取到值,共比对 3964 项` exit 0
- 小程序离线包实测(门 56 的 `decodeTaroBundle` 复用,只读):
  `zh-TW 29 / en 29 / ja 29 / ko 29` ⇒ 非中文 locale 运行时可取到定制措辞,无需重跑 gen:i18n。

## 5. 单写者对账与越界自检

- 开工前对全部 9 个目标路径跑 `git status --porcelain -- <file>`,全部为空(= 磁盘==索引==HEAD)才动笔。
- 收尾 `git status` 逐行核:本票触达 = §2 的 5 改 + 3 新,**清单外零触碰**。
  共享树上其余 `M/??`(packages/shared 的 auto-topup/cloud-chat-ops/edit-resend-rollback/tool-category/utils、
  miniapp 的 api/index.ts 与 ChatMessageItem.tsx、web 的 prompt-drafts/voice-note 等)为他人未提交现场,原样未动。
- 未做任何 git 写操作;未碰 PROJECT_PLAN/AGENTS/README;未改禁改清单文件。

## 6. 没做完的(如实)

1. **mobile-rn / desktop / extension 未接**:mobile-rn 的 `ToolCallItem` 已带 `serverName`
   (数据链是通的),剩渲染点(`AiAssistantN8nScreen` 的 `ToolCallList` 行标题)未喂新入口——该组件
   未导出且宿主 screen 测试夹具重,预算内未动;门/测试形态已在本票三个消费点验证可复制。
2. **miniapp 历史消息回放路径**未喂 serverName(持久化 metadata 里没有该字段的透传),历史 MCP 行
   回落既有中性文案——与改前行为一致,非回归;接线点=chat.tsx 历史映射处。
3. **门 55/56 未加"消费者存在性"判据**:两门对 29 键的覆盖面经实测本就完备(§0.2),本票按
   "确需扩才改"判定不动;若要把"件在库没人调"钉成机制(防未来消费点被摘线),建议在
   `check-tool-display-resolvable.mjs` 加一条"apps/ 下 import describeMcpToolActivity 的文件数 ≥ 3"
   的只加不减判据并同步其镜像测试——属门的增量,值得单独票做端到端取证。
4. 门 56 `scripts/check-tool-display-resolvable.mjs:163` 注释"目前无人消费"自本票起过时
   (纯注释陈旧,不影响判据行为:taro-gen 侧实测 29 键全在包内,§4)。
5. withContext 档位(措辞带 `{name}`)在三个消费点暂未喂 context(task-status-bar 无 subject 源;
   web 卡行/miniapp 行的对象已单独渲染,喂进去会同义重复)——键与回落逻辑在共享层与
   `mcp-tool-activity.test.ts` 已 21 例钉死,首个真需要"措辞含对象"的渲染面出现时即插即用。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
