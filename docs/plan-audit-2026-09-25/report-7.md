<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 版本台账对账报告 — 批次 7(D18 D36 D58 D78 D106 O14b2)

> 口径:一律判 **HEAD** 实现面(`git -c 'safe.directory=*' show HEAD:<path>` / `ls-tree` / `grep … HEAD`),未按工作区文件下任何结论。全程只读,唯一写入物为本报告。
> 取证日期:2026-09-25(HEAD 现值)。

---

### D18 Agent SDK 对外开放(G-23) — **C-已在库该翻勾**

**一句话结论**:五语言 SDK(TS/Python/Go/Java/.NET)在 HEAD 齐备,Agent 编排层已进 TS SDK 公共出口,四+一通道发布链由 `release-sdk.yml` + `publish-ready.test.mjs` 机器看守,后者实跑 13/13 全绿 —— 台账挂 `- [ ]` 属漂移。

**证据(命令 → 输出片段)**:

1. `git -c 'safe.directory=*' ls-tree -r --name-only HEAD -- packages/sdk | awk -F/ '{print $3}' | sort | uniq -c | sort -rn`
   → `45 java` / `44 dotnet` / `38 go` / `29 python` / `18 src` / `4 tests`
2. `git -c 'safe.directory=*' show HEAD:packages/sdk/src/index.ts | sed -n '19,48p'`
   → `// Agent Engine 编程编排层(P2-④):模型无关的应用内 agent 编排` / `export { createAgent, AgentEngineError, ENGINE_METHODS, … } from './agent-engine.js'`(**注册点=公共出口,非仅存在文件**)
3. `git -c 'safe.directory=*' ls-tree -r --name-only HEAD | grep -iE "agent[-_]engine"`
   → `packages/sdk/src/agent-engine.ts` / `packages/sdk/python/ihui_ai/agent_engine.py` / `scripts/check-agent-engine-parity.mjs`(三方 parity 门在位)
4. `git -c 'safe.directory=*' ls-tree -r --name-only HEAD -- .github/workflows | grep -iE "sdk|publish"`
   → `.github/workflows/release-sdk.yml`
5. `node --test packages/sdk/tests/publish-ready.test.mjs` → 末两行 `ℹ tests 13` / `ℹ pass 13` / `ℹ fail 0`

**残余(不构成"未开工",但翻勾时建议附注)**:同一次跑输出含 `.NET 可构建性 **未判定**(本机实测:)—— 不得据此声称通道已可构建` —— 该判据刻意只落在 CI 的 `nuget-publish` job,本地不可证。

**验收命令**:`node --test packages/sdk/tests/publish-ready.test.mjs`(13 pass)+ `node scripts/check-agent-engine-parity.mjs`

---

### D36 输入草稿与历史(G-55) — **B-部分开工(半边已落 / 半边未落)**

**一句话结论**:**历史栈**已真实落地并接线(shared 纯函数 + web hook + message-input 消费,含 50 条淘汰单测);**草稿栈**票面点名的 `packages/shared/src/chat/prompt-drafts.ts` **不在 HEAD**,该半边只有 web 端内 localStorage 版本(共享层无实现、跨端零消费)。

**证据(命令 → 输出片段)**:

已落半边(历史):
1. `git -c 'safe.directory=*' ls-tree -r --name-only HEAD | grep -iE "(prompt-history|prompt-draft|draft)"`
   → `packages/shared/src/chat/prompt-history.ts` / `packages/shared/src/chat/__tests__/prompt-history.test.ts` / `apps/web/src/hooks/use-prompt-history.ts`(**无 prompt-drafts.ts**)
2. `git -c 'safe.directory=*' grep -n -I -F "prompt-history" HEAD -- apps packages | head`
   → `HEAD:apps/web/src/components/chat/message-input.tsx:53:import { usePromptHistory } from '@/hooks/use-prompt-history'`(**渲染消费点在位**)+ `packages/shared/src/chat/index.ts:25:export * from './prompt-history'`
3. 用例面:`… show HEAD:packages/shared/src/chat/__tests__/prompt-history.test.ts | grep -nE "^\s*(describe|it)\("`
   → `it('超过 50 条时淘汰最旧,保留最近 50 条'` / `it('↑↑ 到最旧再 ↓↓ 回到草稿'`;web 侧 `message-input-history.test.tsx` 有 6 条(含 `翻历史时附件(引用)保持不动`、多行光标不劫持)

未落半边(草稿)—— 票面点名物的"虚假已做"复现:
4. `git -c 'safe.directory=*' grep -n -I -E "promptDrafts|prompt-drafts|prompt_drafts" HEAD -- apps packages sdks scripts`
   → 仅 3 行:`packages/shared/src/chat/index.ts:71`(`// D43 / D36 / D35 这三个模块(voice-note、prompt-drafts、history-projection)在全仓任何 ref 上`)、`:78`(`// export * from './prompt-drafts'`)、`scripts/data/chat-element-coverage.json:615`(清单叙述)。**代码面 0 命中**。
5. 功能替代(端内、非共享层):`… show HEAD:apps/web/src/components/chat/message-input.tsx | sed -n '240,270p'`
   → `// W27(2026-09-14):草稿 key 按会话隔离 … 切换会话时草稿互不串扰` / `const draftKey = conversationId ? \`chat:draft:${conversationId}\` : 'chat:draft'`
6. 跨端面:`for d in apps/miniapp-taro apps/mobile-rn apps/extension apps/cli; do git -c … grep -c -I -F "prompt-history" HEAD -- "$d"; done` → 四端全部 0(命令 A 输出的命中清单里只有 web + shared)

**已落件 / 还欠件**:
- 已落:①历史栈纯函数(push/去重/50 上限/游标)+ barrel 出口 + 单测 13 例;②web 端 localStorage 分桶持久化(`chat:prompt-history:{id}`)+ 组件级 6 例;③web 端内按会话草稿分桶(W27)。
- 还欠:①`packages/shared/src/chat/prompt-drafts.ts`(截断上限/安全读取的共享实现)及其 barrel 出口 —— 现注释行仍在;②票面"跨端经 store 持久化"——miniapp/rn/extension/cli 四端零消费;③三态用例中的**"切会话保留"一条无测试**:全仓 `chat:draft` 断言只出现在 `apps/web/tests/message-send-clear.test.tsx:251` / `message-send-side.test.tsx:267` 的 `draftKey: 'chat:draft'` 入参,没有任何用例断言 `chat:draft:{id}` 分桶在切换会话后仍读回("发送后清空"有 `it('submit 后应立即清空 value,不等 onSend 返回'`,已覆盖)。

**落点建议**(遵守 §3 共享层优先):
- `packages/shared/src/chat/prompt-drafts.ts` —— 新增分桶 key 生成 + 截断上限 + `parseDraft` 安全读取纯函数(形态对齐同目录 `prompt-history.ts`,后者已是该模式的既有实现),随后取消 `packages/shared/src/chat/index.ts:78` 的注释出口。
- `apps/web/src/components/chat/message-input.tsx:248-266` —— 把端内手搓的 `chat:draft:{id}` 读写改为 import 上述共享模块(现为 §3 禁止的"端内重新实现")。
- 跨端:`packages/shared/src/stores/`(草稿 state shape 工厂)+ 各端注入平台 transport;或按 §4 跨端铁律先 `apps/miniapp-taro` 落一端并同步 web。
- 测试:`packages/shared/src/chat/__tests__/prompt-drafts.test.ts`(新)+ `apps/web/src/components/chat/__tests__/message-input-history.test.tsx` 补"切会话后草稿互不串扰/仍读回"一条。

**验收命令**:`pnpm --filter @ihui/shared typecheck` + `node --test packages/shared/src/chat/__tests__/prompt-drafts.test.ts`(落地后)+ `pnpm --filter @ihui/web test -- message-input-history message-send-clear`

---

### D58 工具类目聚合层(G-71/G-72) — **B-部分开工**

**一句话结论**:类目层真实落地且在渲染链上(web 侧 `CATEGORY_TABLE` 18 档 + `ShowMoreList` 容器 + 折叠联动 + 埋点断言齐备),但票面两处不符/两处未收:类目数不是"20"、层未沉共享包(跨端 0 消费)。

**证据(命令 → 输出片段)**:

1. 文件面:`git -c 'safe.directory=*' ls-tree -r --name-only HEAD | grep -iE "tool-call-summary|fold-policy|show-more|tool-category"`
   → `apps/web/src/components/ai/progress-sections/{tool-call-summary-card,tool-category,show-more-list}.tsx?` + `apps/web/src/components/chat/message-list/fold-policy.ts` + 两个测试 `__tests__/tool-call-summary-category.test.tsx`、`__tests__/tool-category.test.ts`
2. 类目表:`… show HEAD:apps/web/src/components/ai/progress-sections/tool-category.ts | grep -cE "key: '"` → `18`;首行原文
   → `{ key: 'file_read', labelKey: 'catFileRead', order: 1, countable: true, expandStrategy: 'auto' }`(order/countable 各 18,四要素齐)
3. 埋点断言:`git -c 'safe.directory=*' grep -n -I -E "cardType|group_key|children_count" HEAD -- apps/web/src/components/ai/progress-sections/__tests__`
   → `it('点击类目卡头部 → 经既有通道上报 cardType/group_key/children_count'` + `cardType: 'tool_category', group_key: 'file_read', children_count: 2`
4. 渲染消费点(非仅文件存在):`git -c 'safe.directory=*' grep -ln -E "ToolCallSummaryCard|tool-call-summary-card" HEAD -- apps packages`
   → 含 `apps/web/src/components/chat/message-list/MessageItem.tsx`、`apps/web/src/components/chat/message-list/fold-policy.ts`、`next-steps-card.tsx`
5. "不建第二套分组逻辑"自证:`… fold-policy.ts | sed -n '91p'` → `// 不新建第二套分组逻辑:类目映射与纯函数全部来自唯一入口 tool-category.ts,`
6. 跨端面:`for d in apps/miniapp-taro apps/mobile-rn apps/extension packages/app packages/shared; do git -c … grep -l -E "CATEGORY_TABLE|catFileRead|group_key" HEAD -- "$d" | wc -l; done` → **五处全部 `0 files`**

**已落件 / 还欠件**:
- 已落:类目表(order/countable/expandStrategy 三要素)、同类连续步骤聚合(`CATEGORY_TABLE_BY_KEY`、`summarize`)、`show-more-list.tsx` 容器、折叠点击埋点三字段 + 断言、与 D21 `fold-policy` 的 `resolveCategoryInitialOpen` 联动。
- 还欠:①**票面数字失真**:表是 **18 档**(order 1..18),票面写"20 类"而自身括号枚举恰为 18 项 —— 属票面文字错,不是实现缺;②**层未沉共享包**:18 档表在 `apps/web/…/tool-category.ts`,与 `packages/shared/src/chat/tool-category.ts`(D81 的**五类双时态**聚合,语义不同)**同名不同物**,miniapp/rn/extension 无类目层可复用(§9 默认全端连通 + §3 共享层优先);③验收第三项"现有 D21 折叠测试不回退"**本次未跑**:`git -c … diff --name-only HEAD -- <D58 files>` 显示 `apps/web/…/tool-category.ts` 与 `__tests__/tool-call-summary-category.test.tsx` 工作树≠HEAD,按磁盘跑不构成 HEAD 证据,故不冒充"实测通过"。

**落点建议**:把 `CATEGORY_TABLE` / `CategoryKey` / `ExpandStrategy` 从 `apps/web/src/components/ai/progress-sections/tool-category.ts` 提到 `packages/shared/src/chat/`(建议更名避让现有 `tool-category.ts`,如 `tool-category-aggregation.ts`)并在 `packages/shared/src/chat/index.ts` 出口;各端 `…/progress-sections` 与 rn `utils/chat-render-model.ts` 改为 import 共享层;`show-more-list` 若跨端复用则按 §4 沉 `packages/ui-react`(web 类名形态)+ `packages/app`(RN 形态)。

**验收命令**:`pnpm --filter @ihui/shared typecheck` + `pnpm --filter @ihui/web test -- tool-category tool-call-summary-category fold-policy` + `node scripts/check-shared-layer-duplication.mjs`(端内重复实现门)+ `node scripts/check-word-table-resolvable.mjs`(新增 `cat*` 取词键的五语言可解析)

---

### D78 连接器授权卡(G-107) — **B-部分开工(组件已造,无人装车)**

**一句话结论**:五态卡组件 + 五语言词表 + 19 条用例在 HEAD,但**全仓无任何渲染消费点**,票面点名的"复用 permission-mode-popover 通道"未接,后端/客户端也无连接器授权事件生产者 —— 典型"造好没装车"。

**证据(命令 → 输出片段)**:

1. 文件面:`git -c 'safe.directory=*' ls-tree -r --name-only HEAD | grep -iE "connector"`
   → `apps/web/src/components/ai/connector-auth-card.tsx` + `apps/web/src/components/ai/__tests__/connector-auth-card.test.tsx`
2. 验收点(五态 + 暂不 + 不阻断):`… show HEAD:apps/web/src/components/ai/__tests__/connector-auth-card.test.tsx | grep -nE "^\s*(describe|it)\("`
   → `describe('D78 ConnectorAuthCard / 五态渲染(G-107)'` / `凡需授权决策的三态,「暂不」恒在(disconnected/connecting/reconnect)` / `点「暂不」→ onAction(decline) 不抛错,且同流后续消息照常渲染(对话继续语义)` / `zh-CN 负向出口逐字为「暂不」,标题逐字为「连接到 {connectorName}」`
3. **消费点为零**(关键否定,已按 §判据换 3 种命名形态复核):
   - `git -c 'safe.directory=*' grep -n -I -F "connector-auth-card" HEAD -- apps packages` → 仅 `__tests__/connector-auth-card.test.tsx:13:import { ConnectorAuthCard } from '../connector-auth-card'`
   - `git -c 'safe.directory=*' grep -n -I -E "ConnectorAuthCard" HEAD -- apps packages sdks scripts` → 命中全部落在 `connector-auth-card.tsx`(定义)与其测试文件,**无第三文件**
   - `git -c 'safe.directory=*' grep -rln -I -E "connectorAuth|ConnectorAuth" HEAD -- apps packages` → 6 项:`connector-auth-card.tsx`、其测试、`packages/i18n/messages/web/{en,ja,ko,zh-CN,zh-TW}.json`(词表≠接线)
4. 通道面:`git -c 'safe.directory=*' grep -rn -I -E "connector_auth|connectorAuth" HEAD -- apps/api/src apps/ai-service/app packages/api-client/src` → **空输出**(后端与 api-client 均无该事件/回调生产者);`permission-mode-popover` 消费清单里无 connector(`grep PermissionModePopover` 命中为 `full-access-confirm-bridge.tsx` / `high-risk-warning-banner.tsx` 等,无授权卡)

**已落件 / 还欠件**:
- 已落:`ConnectorAuthCard` 组件(五态 `CONNECTOR_AUTH_STATES` + `data-connector-auth-state`)、web 五语言 `chat.connectorAuth` 八键词表、19 条用例(含"暂不"不阻断与插值一致性)。
- 还欠:①**渲染消费点**(MessageItem / 对话流分发处无人 import);②**事件契约**(SSE/`injection`/`permission` 帧里没有 connector 授权语义,端收不到态);③**复用 permission-mode-popover 通道**(票面明文"复用我方 connectors 体系与 permission-mode-popover 通道,不新建授权流",现两条都未接);④跨端(§9 默认全端):miniapp/rn/extension/cli 零命中,词表也只落 web 命名空间。

**落点建议**:`apps/web/src/components/chat/message-list/MessageItem.tsx`(既有卡片分发处,已消费 `InjectionBar`/`ToolCallSummaryCard`,加 connector 授权分支)← 状态源 `apps/web/src/hooks/use-chat/*.ts` + `packages/api-client/src/client.ts` 新增/复用一个回调;契约面 `apps/api/src/routes/ai-callback.ts` + `apps/ai-service/app/routers/connectors.py`(现仅有 CRUD,无"对话流内请求授权"发射点);类型 `packages/types/src/`。词表按 §19 同步 `packages/i18n/messages/{miniapp-taro,mobile-rn,cli,extension}`。

**验收命令**:`git -c 'safe.directory=*' grep -l -I -E "ConnectorAuthCard" HEAD -- apps packages`(消费点必须出现第三个文件)+ `pnpm --filter @ihui/web test -- connector-auth-card` + `node scripts/check-i18n-keys.mjs --staged`(多端 parity)+ `node scripts/check-chat-element-coverage.mjs`(新增锚点入清单)

---

### D106 消息级"交代帧"跨端消费缺口(G-148) — **C-已在库该翻勾**

**一句话结论**:票面四条纪律与三项可机检验收在 HEAD 全部成立 —— 四端 `onSteer`/`citations` 命中由 0 变非 0、守门 57 的 `steer-injection-disclosure` 条目带 13 锚点覆盖五端、四端各有独立测试文件、`check-chat-element-coverage.mjs` 实跑 exit 0。

**证据(命令 → 输出片段)**:

1. 命中数由 0 变非 0:`for tok in onSteer citations; do for d in apps/extension apps/miniapp-taro apps/mobile-rn apps/cli; do git -c 'safe.directory=*' grep -c -I -F "$tok" HEAD -- "$d" | awk -F: '{s+=$NF} END{print s+0}'; done; done`
   → `onSteer`: extension 2 / miniapp-taro 5 / mobile-rn 10 / cli 15;`citations`: 9 / 22 / 25 / 3(**无一为 0**,推翻票面"四端 0 命中")
2. 真实注册点(排除 .md/测试/注释):`git -c 'safe.directory=*' grep -n -I -F "onSteer" HEAD -- apps/… | grep -vE "(__tests__|\.test\.|\.md)"`
   → `apps/extension/entrypoints/sidepanel/pages/ChatPage.tsx:473: onSteer: (evt) => {` / `apps/miniapp-taro/src/pkg-ai/ai/chat.tsx:671: onSteer: (evt) => {` / `apps/mobile-rn/src/screens/ChatScreen.tsx:738` / `apps/cli/src/commands/repl.ts:2385`
3. 渲染位:`git -c 'safe.directory=*' grep -n -I -E "ChatDisclosure|SteerNotice" HEAD -- apps packages`(经清单锚点反查)
   → `apps/miniapp-taro/src/pkg-ai/ai/cards/ai-cards.tsx:386: * 链路:SSE steer 事件 → onSteer → aiCards.steerNotices → 本组件` + `apps/mobile-rn/src/components/ChatDisclosure.tsx:135`
4. 守门 57 条目与锚点:`git -c 'safe.directory=*' show HEAD:scripts/data/chat-flow-elements.json | sed -n '715,775p' | grep -E "\"file\""`
   → `"id": "steer-injection-disclosure"`(第 715 行)+ 13 个锚点文件:ai-service `llm.py` / api `ai-callback.ts` / `packages/api-client/src/client.ts` / web `stores/chat.ts`+`history-message.ts` / extension `ChatPage.tsx`+`MessageContent.tsx` / miniapp `api/index.ts`+`ai-cards.tsx` / rn `chat-render-model.ts`+`ChatDisclosure.tsx` / cli `task-status-line.ts`+`repl.ts`(**含"未知 kind 回退"链路的读回锚点 `readSteerAppliedFromMetadata`**)
   同文件 `context-injection-disclosure`(第 391 行)标题已改为 `本轮上下文注入交代条(web/extension/miniapp-taro/mobile-rn/cli 五端已接;…)`
5. 每端用例存在:`git -c 'safe.directory=*' ls-tree -r --name-only HEAD | grep -iE "(steer).*(test)|test.*(steer)"`
   → `apps/cli/tests/agent-steer-note.test.ts` / `apps/extension/tests/steer-notice.test.tsx` / `apps/miniapp-taro/src/pkg-ai/ai/cards/__tests__/{steer,steer-history}.test.ts` / `apps/mobile-rn/tests/{steer-frames,steer-history-readback}.test.ts`
6. 清单自验:`node scripts/check-chat-element-coverage.mjs` → `✅ [chat-element-coverage] 清单 132 条(G-ID 93 + 已实现锚点 39)、planned 任务 160 行,锚点与契约均一致`,`EXIT=0`

**台账漂移实况(顺带取证)**:HEAD 的 `PROJECT_PLAN.md` 同一条 D106 **既有 `- [ ]`(L6685)又有 `- [x] ✅(2026-09-24)`(L2923/2926/6686/6921/6988)多份副本**,本批次票面取自那份未勾的旧基线 —— 属 §12"活文档整文件回写"产物,翻勾前先做一次 `node scripts/merge-live-doc.mjs --file PROJECT_PLAN.md` 归并去重。
**票面数字与现值差异(不影响判定)**:票面称 `implemented 32→33,13 锚点` —— 13 锚点逐字对上(见证据 4),但 implemented 口径已变,现读为"清单 132 条 / 已实现锚点 39"(锚点清单被后续会话继续扩过)。
**票面自记的残余(仍开放,但非本票验收项)**:miniapp 端历史走本地存储、无服务端会话消息拉取,跨端 metadata 读回需先接服务端历史接口(读回函数已备好)。

**验收命令**:`node scripts/check-chat-element-coverage.mjs`(exit 0)+ `pnpm --filter @ihui/cli test -- agent-steer-note` + `pnpm --filter @ihui/miniapp-taro test -- steer` + `pnpm --filter @ihui/mobile-rn test -- steer-frames steer-history-readback`

---

### O14b2 取舍待定:Go SDK 提到根模块 / tag 形态 — **A-确未开工(决策项,非实现缺口)**

**一句话结论**:HEAD 实测 `go.mod` **仍是嵌套模块路径**、发布 tag 仍用 `packages/sdk/go/v$VERSION`,即票面"未擅自动 go.mod"与仓库现状逐字一致 —— 这是一个等待用户拍板的架构取舍,**不构成台账漂移,不得自行翻勾**。

**证据(命令 → 输出片段)**:

1. `git -c 'safe.directory=*' show HEAD:packages/sdk/go/go.mod | grep module`
   → `module github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go`(**未提根**)
2. `git -c 'safe.directory=*' show HEAD:.github/workflows/release-sdk.yml | grep -nE "TAG=|packages/sdk/go/v"`
   → `855: #   → tag 必须是 packages/sdk/go/v$VERSION` / `862: TAG="packages/sdk/go/v$VERSION"`(现方案已把嵌套模块 tag 形态固化进发布链,含幂等回读 `git ls-remote --tags origin refs/tags/packages/sdk/go/v*`)

**落点建议(仅当用户选"提到根模块"时才动)**:`packages/sdk/go/go.mod`(module 行)、全部 `import "github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/…"`,以及 `.github/workflows/release-sdk.yml` 的 `go-publish` job(`TAG=` 与两处回读/证明行);改后须同步 `packages/sdk/tests/publish-ready.test.mjs` 的"五通道坐标:清单声明与 release-sdk.yml 逐一同名"判据(它正是钉这类漂移的尺子)。

**验收命令**:`node --test packages/sdk/tests/publish-ready.test.mjs`(现 13 pass,改坐标后必须仍 13 pass 或同步改用例)+ `cd packages/sdk/go && go build ./...`

---

## 未查透项(如实说明)

- **D58 验收第三项"D21 折叠测试不回退"未做运行级取证**:`git diff --name-only HEAD` 显示工作树的 `apps/web/src/components/ai/progress-sections/tool-category.ts` 与其 `__tests__/tool-call-summary-category.test.tsx` **不等于 HEAD**,按磁盘跑得到的结论不能归给 HEAD。测试**文件与用例名在 HEAD 存在**已逐项取证,但"跑通"未证。
- **D18 的"对外开放"外延未穷尽核对**:本报告只证到 SDK 代码面 + 发布链(含 parity 门),未核对 `apps/api` 侧对外开发者鉴权面/开发者文档站是否同属 G-23 范围(票面仅一行,无验收条件可依)。`.NET 可构建性`本门刻意不判,只有 CI job 能证。
- 其余四票(D36 D78 D106 O14b2)判定所依赖的证据均已到位,无未查透部分。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
