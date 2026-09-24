<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# report-1 — batch-1 七票 × HEAD 实现面对账(只读审计)

- 判据面:一律 `HEAD`(`git -c safe.directory=* show/grep HEAD:<path>`、`git ls-tree -r --name-only HEAD`),未读工作区文件内容作结论依据。
- 环境注记:本 harness 另有一个 Read 工具(非 MCP),其读工作区,故本审计过程中**未使用 Read 读任何被审判定物**;唯一非 git 取数的一次(`.husky/pre-commit` 体积)已放弃,不影响任何票的判定。
- 工具调用消耗:约 41 / 45。7 张票全部给出判定,无 `U-未判定`;D6 与 D64⑥ 的取证深度限制在「未判定项」小节如实列出。
- 台账交叉印证:`PROJECT_PLAN.md` HEAD:2416 已自行登记一批"件在库 ≠ 装上车"(点名 `D81②-⑥`、`D64⑤`、`D64③`),本审计独立取证与之一致,并补出 D20 的新缺失面(导出格式枚举)。

---

### D6 B-部分开工

一句话结论:四套面板**全部在库且真渲染**,`AgentLoopV2` 也已是可运行实现,但"收敛为单一事实源"未发生 —— 执行器开关默认仍是 `langgraph`,api 侧四套路由各自独立注册,HEAD 内找不到该票点名的"收敛方案评审"产物。

证据(命令 → 输出片段):

1. 四面板在库且有渲染位:
   `git -c safe.directory=* grep -n -I -E "KanbanBoard|AgentSwarmMonitor|OrchestrationHubPanel|TaskKanban" HEAD -- apps/web/app apps/web/src/components/ai apps/web/src/lib | grep -i -E "import|<[A-Z]"`
   → `apps/web/app/(main)/agent-kanban/page.tsx:10: return <KanbanBoard />`
   → `apps/web/src/components/ai/ai-side-panel-tools.tsx:619: return <OrchestrationHubPanel />`
2. AgentLoopV2 实现 + 测试均在库:
   `git -c safe.directory=* grep -l -I -E "AgentLoopV2|agent-loop-v2" HEAD -- apps packages sdks scripts`
   → `HEAD:apps/ai-service/app/services/agent_loop_v2.py` / `HEAD:apps/ai-service/tests/test_agent_loop_v2.py`
3. **未收敛的正反两面**(默认档 + 四套路由并列):
   `git -c safe.directory=* grep -n -I -E "AGENT_EXECUTOR|loop_v2" HEAD -- apps/ai-service/.env.example docs/AI_SERVICE.md`
   → `HEAD:apps/ai-service/.env.example:315: AGENT_EXECUTOR=langgraph`
   → `HEAD:docs/AI_SERVICE.md:660: | \`AGENT_EXECUTOR\` | \`langgraph\` | Agent 执行器开关,\`loop_v2\` 启用 AgentLoopV2(见下) |`
   `git ls-tree -r --name-only HEAD | grep -i -E "kanban|swarm|orchestrat"`
   → `apps/api/src/routes/agents-kanban.ts`、`apps/api/src/routes/orchestration.ts`、`apps/ai-service/app/routers/orchestration.py`、`apps/ai-service/app/routers/team_orchestration.py`(四套并存,未见合并/退役)

已落件 / 还欠件:
- 已落:①四套面板的前端实现与渲染位(含独立路由页与侧栏 Tab 两种入口);②`agent_loop_v2.py` 及其测试;③JSON-RPC 引擎面已有协议对账门 `scripts/check-agent-engine-parity.mjs`(AGENTS 守门速查在册)。
- 还欠:①**收敛本身** —— api 侧 `agents-kanban.ts` / `orchestration.ts` / `crew-orchestrator.ts` / `orchestration-service.ts` 与 ai-service 侧 `orchestration.py` / `team_orchestration.py` / `agent_orchestrator.py` / `orchestration_hub.py` 仍在 HEAD 并列存在,没有任何一套被指向 `agent_loop_v2`;②把 `AGENT_EXECUTOR` 默认切到 `loop_v2`(或显式记录"暂不切"的决策);③票面要求的"方案评审"产物(评审结论文档或决策记录)在 HEAD 检索不到;④"终项确认"票面自己就写着待给。

落点建议(遵守共享层优先):
- `apps/ai-service/app/services/agent_loop_v2.py`(唯一执行事实源)+ `apps/ai-service/app/routers/engine.py`(`from ..services.agent_loop_v2 import AgentLoopV2` 已是该路由的构造路径,把其余编排路由收到同一构造入口)。
- `apps/ai-service/app/routers/orchestration.py`、`team_orchestration.py`、`apps/ai-service/app/services/agent_orchestrator.py`、`orchestration_hub.py`:四者按"薄适配层 → AgentLoopV2"改写,不得各持一套循环。
- `apps/api/src/routes/agents-kanban.ts`、`orchestration.ts`、`apps/api/src/services/crew-orchestrator.ts`、`orchestration-service.ts`:api 侧只保留"视图/权限/SSE 总线"(`apps/api/src/services/agent-sse-bus.ts` 已是抽出正例),执行编排不得在 api 端二实现。
- `packages/types/src/orchestration.ts`:收敛后的契约单一真相源(现仅 1 个文件,是天然的落点)。
- `apps/ai-service/.env.example:315` + `apps/ai-service/app/core/config.py:341`(默认值),以及 `docs/AI_SERVICE.md` 的开关段。
- 评审结论属工程治理记录:按 §1 只能写进 `PROJECT_PLAN.md`(不得新建 docs 计划文件)。

验收命令:
- `git -c safe.directory=* grep -n -I -E "AGENT_EXECUTOR" HEAD -- apps/ai-service/.env.example`(期望切到 `loop_v2` 或票面显式记录)
- `cd apps/ai-service && python -c "import app.services.agent_loop_v2"` 之后的该票核心断言:编排路由不得自带循环 —— `git grep -n -I -E "async def .*(loop|step)\b" HEAD -- apps/ai-service/app/routers/orchestration.py apps/ai-service/app/routers/team_orchestration.py` 应为空(现值需先跑一次取基线)。
- `node scripts/check-agent-engine-parity.mjs --quiet`(协议三方 parity,blocking)
- `pnpm --filter @ihui/ai-service test`(`tests/test_agent_loop_v2.py`、`test_agent_engine.py`、`test_orchestration*.py` 全绿,收敛后应只剩一条执行链的用例面)
- `node scripts/guardian-runner.mjs --staged`

---

### D20 B-部分开工

一句话结论:票面三件事里只有**置顶**真正全链路落地(schema→api→api-client→列表 UI 渲染位);**会话文件夹/标签在 HEAD 零实现物**(四种命名形态均 0 命中、无建表迁移),**导出只有 txt/md 两档、无 PDF**。TTS 已按票面剔除,不计入。

证据(命令 → 输出片段):

1. 置顶已贯通(含渲染消费点):
   `git -c safe.directory=* grep -n -I -E "pinned|pinnedAt" HEAD -- packages/database/src/schema/chat.ts apps/api/src/routes/chat.ts apps/web/src/components/chat/conversation-list.tsx packages/api-client/src`
   → `packages/database/src/schema/chat.ts:42: pinned: boolean('pinned').default(false).notNull(),`
   → `apps/web/src/components/chat/conversation-list.tsx:240: setConversationPinned(id, pinned),` / `:675 {item.pinned ? (`
2. 文件夹/标签:换四种命名形态逐一否证(规则 3):
   `git -c safe.directory=* grep -n -I -E "chatFolder|chat_folder|conversationFolder|conversation_folder" HEAD -- apps packages` → 无输出
   `git -c safe.directory=* grep -n -I -E "conversation_folders|chat_tags|conversation_tags" HEAD -- packages/database apps/api` → 无输出
   `git -c safe.directory=* grep -n -I -E "groupId|chatGroup|conversationGroup|分类|目录" HEAD -- apps/api/src/routes/chat.ts apps/web/src/components/chat/conversation-list.tsx packages/database/src/schema/chat.ts` → 无输出
   `git ls-tree -r --name-only HEAD -- apps/api/src/routes | grep -i -E "folder|tag|label|bookmark"` → 无输出
3. 导出存在但**不含 PDF**(票面点名"导出 PDF"):
   `git -c safe.directory=* show HEAD:apps/api/src/routes/chat.ts | sed -n '996,1010p'`
   → `// GET /conversations/:id/export - 导出对话消息(md/txt)`
   → `const formatQuery = z.object({ format: z.enum(['txt', 'md']).default('md') })`
   全仓 PDF 生成能力确已存在(`apps/api/src/services/pdf-service.ts` 用 pdfkit),但**没有任何对话导出路径引用它**:`git -c safe.directory=* grep -n -I -E "exportConversation|导出会话|conversationExport" HEAD -- apps packages` 只命中上述 md/txt 一族与无关 edu 导出。

已落件 / 还欠件:
- 已落:置顶(`chat.pinned`/`pinned_at` + PATCH 透传 + `setConversationPinned` + 列表乐观更新与图标渲染 + `toast.pinned/unpinned`)。
- 还欠:①会话文件夹(建表 + 归属字段 + CRUD 路由 + 侧栏分组渲染 + 跨端同步);②会话标签(同上,含多对多);③**导出 PDF**(现有 export 路由加 `pdf` 档并接 `pdf-service`,或独立渲染链)。

落点建议(共享层优先):
- 表与实体:`packages/database/src/schema/chat.ts`(加 `conversations.folderId` + 新建 `packages/database/src/schema/chat-folders.ts` / `chat-tags.ts` + 关联表),经 `packages/database/src/schema/index.ts` 导出;迁移走 `packages/database/drizzle/` 并同步 `drizzle/meta/_journal.json`(§守门 49 的记账双向双射判据)。
- 服务端:`apps/api/src/routes/chat.ts`(列表查询按 folder/tag 过滤 + 排序须让 `pinned` 仍居首)+ 新 `apps/api/src/routes/chat-organization.ts`(或并入 chat.ts,与既有 `requireAuth`/`ensureOwnedConversation` 同纪律)。
- 类型:`packages/types/src/`(跨端同名类型,§3 禁止端内重声明)。
- 调用:`packages/api-client/src/endpoints/chat.ts`(紧邻既有 `setConversationPinned` 追加,端内不得裸 fetch,§4/守门 73)。
- web 渲染:`apps/web/src/components/chat/conversation-list.tsx`(分组/标签 UI 与既处置顶行同层)。
- miniapp-taro 同步(§4 跨端样式同步铁律):`apps/miniapp-taro/src/pkg-ai/...` 对应会话列表页 + `ThemeRoot` 纪律。
- PDF 导出:`apps/api/src/services/pdf-service.ts`(已有 pdfkit + 中文字体注册 + 降级路径)→ 在 `chat.ts` 的 export handler 内加 `pdf` 分支,不得在 web 端另起一套 PDF 生成。

验收命令:
- `pnpm --filter @ihui/database build` + `pnpm --filter @ihui/api typecheck` + `pnpm --filter @ihui/web typecheck`
- `node scripts/check-migration-bookkeeping.mjs`(离线 B1-B5;journal↔sql 双射,新迁移必过)
- `node --test scripts/tests/check-migration-from-zero.test.mjs` 与 CI `db-from-zero-migrate.yml`(空库全链重放;本机无 PG 端口,`--db` 模式不可用,须如实标注)
- `node scripts/check-i18n-keys.mjs --staged`(新增 `folder/tag/exportPdf` 词键五语言 parity)
- `pnpm --filter @ihui/api test`(导出三档断言:`txt|md|pdf` 各自 200 + `Content-Type`,**不接受只断 200**)

---

### D39 C-已在库该挂勾

一句话结论:票面验收四条件(FallbackBanner 与 error 卡两套动作族、倒计时三态可观测、消费 D34 `retry_scheduled`/`injection_applied` 帧、免费额度心智不回退)在 HEAD **均有实现物与消费点**,挂 `- [ ]` 属台账漂移。

证据(命令 → 输出片段):

1. 两套动作族 + 三态倒计时都在真实渲染位:
   `git -c safe.directory=* grep -n -I -E "QuotaActionFamily|buildRetryCountdownView" HEAD -- apps/web/src/components/chat/message-list`
   → `FallbackBanner.tsx:64: ? buildRetryCountdownView(retryInfo, t as TFunction, remaining)` / `:163: <QuotaActionFamily`
   → `MessageErrorCard.tsx:70: ? buildRetryCountdownView(` / `:126: <QuotaActionFamily`
   `... show HEAD:apps/web/src/components/chat/message-list/MessageList.tsx | sed -n '364,371p'`
   → `<FallbackBanner fallbackNotice={fallbackNotice} onClearFallbackNotice={...} t={t} freeTierAvailable={freeTierAvailable} />`
2. HTTP 状态 / 无响应超时 / 互斥口径在判定层:
   `git -c safe.directory=* grep -n -I -E "httpStatus|noResponse" HEAD -- apps/web/src/components/chat/message-list/retry-countdown.ts`
   → `:82: httpStatusLabel = t('errorRetry.httpStatus', { status: info.httpStatus })`
   → `:86: if (info.noResponse === true && httpStatusLabel === null) {`
3. D34 帧端到端消费(生产 → 契约 → 解析 → 客户端 → store → 组件):
   `git -c safe.directory=* grep -n -I -E "retry_scheduled|injection_applied" HEAD -- apps/ai-service/app packages/shared/src apps/web/src packages/api-client/src | head`
   → `apps/ai-service/app/core/sse_contract.py:117: SSEEventContract("retry_scheduled", ("attempt", "maxRetries", "retryInMs", "httpStatus")),`
   → `packages/shared/src/utils/sse-parse.ts:302: json?.type === "retry_scheduled"` / `:308: retryScheduled: {`
   → `apps/web/src/hooks/use-chat/send-message.ts:903: // D39/D108 上游重试交代:retry_scheduled → 本条 assistant 消息的一行提示。`
   → `apps/web/src/stores/chat.ts:408: /** D39/D108 上游重试交代(retry_scheduled 命名帧)…`
   → `apps/web/src/hooks/use-chat/history-message.ts:120: 四字段与 SSE retry_scheduled 契约同名…`(刷新回放也接得上)
4. 免费额度心智不回退(判据落在判定层,不由渲染层自觉):
   `git -c safe.directory=* grep -n -I -E "免费额度|不充值可用" HEAD -- apps/web/src/components/chat/message-list/QuotaActionFamily.tsx packages/shared/src/chat/quota-ownership.ts`
   → `QuotaActionFamily.tsx:18: //   并明示"免费额度仍可使用"。判据显式:paid 两动作仅在 !freeTierAvailable 时渲染。`
   → `packages/shared/src/chat/quota-ownership.ts:105: // 剔除付费动作 —— 「不充值可用心智」边界在判定层落地,不由渲染层自觉。`

备注(不构成扣分,但续做者须知道):
- `MessageErrorCard` 的**渲染消费者**在 HEAD 未定位到(检索 `apps/web/src` 内 `<MessageErrorCard` 仅命中其自身定义),其动作族由共享层 `quota-ownership.ts` 提供且 web `MessageItem` 走 `message-retry-${id}` 契约(testid 见 `QuotaActionFamily.tsx:45` 注释);因此"error 卡这一套"的**可见性证据弱于 FallbackBanner**。翻勾前建议补跑:
  `node scripts/check-chat-element-coverage.mjs --staged`(守门 57,对话流元素覆盖;AGENTS 速查在册)与
  `pnpm --filter @ihui/web test -- message-item-error-card-wiring`(`apps/web/src/components/chat/message-list/__tests__/message-item-error-card-wiring.test.ts` 在 HEAD 存在)。

落点建议 / 验收命令:判 C,不需落点;验收以上两条复跑即可。

---

### D64 B-部分开工

一句话结论:①热力图、②图片预览翻页/缩放/保存复制、③思考卡双态标题、④后台子任务八态与停止失败文案 已在 HEAD 落地并有渲染位或用例;⑤反馈问卷**组件在库但零消费点、落库载荷仍只有 rating**(结构化未完成);⑥goal 卡对照表在 HEAD **不存在任何产物**。

证据(命令 → 输出片段):

1. ①热力图已装车:
   `git -c safe.directory=* grep -n -I -E "CreditsHeatmapCard" HEAD -- apps` →
   → `apps/web/app/(main)/settings/billing/page.tsx:26: import { CreditsHeatmapCard } from '@/components/billing/credits-heatmap-card'` / `:110: <CreditsHeatmapCard`
   → 另有 `apps/web/src/components/billing/__tests__/credits-heatmap-card.test.tsx`
2. ②图片预览器"装车"自述 + 翻页/缩放断言用例在库:
   `git -c safe.directory=* grep -n -I -E "imagePreview\.|data-image-nav|zoomIn" HEAD -- apps/web/src/components/media | head` →
   → `apps/web/src/components/media/FilePreview.tsx:155: * D64 ②(2026-09-24 装车):补**翻页 / 第 N·M 张 / 缩放档位 / 保存与复制成败**。`
   → `apps/web/src/components/media/__tests__/image-preview-pack.test.tsx:91: 'imagePreview.counter:{"index":2,"total":3}',`
3. ③双态标题:判定层在共享、渲染位有传参(与台账旧行"只有测试传"相反,已推进):
   `git -c safe.directory=* grep -n -I -E "refsCount|thinkingTitleView" HEAD -- apps/web packages/shared/src/chat/element-pack.ts | grep -v __tests__` →
   → `apps/web/src/components/chat/message-list/MessageItem.tsx:839: refsCount={citationsCount}`
   → `apps/web/src/components/ai/progress-sections/thinking-section.tsx:212: const titleView = thinkingTitleView(hasThinking, refsCount)`
   → `packages/shared/src/chat/element-pack.ts:273: const count = Math.floor(refsCount)`(词键 `ai.pane.elementPack…thinkingRefsTitle` 五语言在位)
4. ④八态 + 停止失败文案(单一真相源 + 端侧消费):
   `git -c safe.directory=* grep -n -I -E "stopFailed|八态|backgroundTask.state" HEAD -- apps packages/shared/src | head` →
   → `apps/mobile-rn/src/screens/SubagentsScreen.tsx:62: * 八态一律取 element-pack 的 tone —— 端内不再自写第二份状态表;`
   → `packages/i18n/messages/shared/zh-CN.json:2361: "stopFailed": "子任务仍在运行，请重试停止",`(en/ja/ko/zh-TW 同行号齐值对应)
5. ⑤问卷卡零消费点 + 无结构化落库(规则 2:命中≠实现):
   `git -c safe.directory=* grep -n -I -E "FeedbackSurveyCard|feedback-survey" HEAD -- apps packages | grep -v "components/chat/feedback-survey-card.tsx"` →
   → 全部命中都在 `apps/web/src/components/chat/__tests__/feedback-survey-card.test.tsx`(仅测试引用自己),生产渲染位 0 处
   → `apps/web/src/components/chat/feedback-survey-card.tsx:15: // 1. **不取数、不落库**:判据 `feedbackSurveyPayload` 只产载荷,**发不发、发到哪**由宿主`(宿主在 HEAD 不存在)
6. ⑥对照表不存在:
   `git -c safe.directory=* grep -n -I -E "对照表|D64⑥|D64 ⑥" HEAD -- docs apps/web/src/components/ai` → 无输出(HEAD 只有 pricing/enterprise 等无关 `ComparisonTable` 文件);`git ls-tree -r --name-only HEAD | grep -i goal-card` 只有 `apps/web/src/components/ai/goal-card.tsx` 与其耗时用例 `d89-goal-card-achieved-time.test.tsx`。

已落件 / 还欠件:
- 已落:①/②/③/④(判定层沉在 `packages/shared/src/chat/element-pack.ts`,端侧只渲染 —— 符合共享层优先)。
- 还欠:⑤问卷的**宿主接线 + 结构化落库**(现只有组件与判据函数,票面要求"把 toast 兜底升级为结构化落库");⑥的**逐字段对照表**(票面明写"必须先产出对照表再决定做/不做",HEAD 无表)。

落点建议:
- ⑤渲染位:`apps/web/src/components/chat/message-list/MessageItem.tsx`(与既有 toast 兜底同位,`:444` 那段注释即被替换对象);数据面:`packages/api-client/src/endpoints/`(新增问卷提交端点)→ `apps/api/src/routes/`(与既有反馈路由同一 `requireAuth` + zod 纪律)→ `packages/database/src/schema/`(问卷答案结构化表 + `packages/database/drizzle/` 迁移)。措辞仍走 `ai.pane.elementPack.feedbackSurvey.*`(`packages/shared/src/chat/element-pack.ts` 已有 `FEEDBACK_SURVEY_STATE`),禁止端内再抄一份键。
- ⑥对照表属评审记录:按 §1 落 `PROJECT_PLAN.md`(禁止新建 docs/计划文件);对照基准是 `apps/web/src/components/ai/goal-card.tsx` 逐字段 vs 对方五态/操作/时长格式,未出表前不得列差距(票面第 5 轮已因幻影差距拦过一次)。
- 跨端:⑤若上线须同步 miniapp-taro(§4 铁律),不得只交 web。

验收命令:
- `git -c safe.directory=* grep -n -I -E "FeedbackSurveyCard" HEAD -- apps/web/src/components/chat/message-list`(应为非 0 命中,现为 0)
- `pnpm --filter @ihui/web test -- feedback-survey-card` + `pnpm --filter @ihui/web typecheck`
- `node scripts/check-migration-bookkeeping.mjs`(⑤新表)
- `node scripts/check-word-table-resolvable.mjs`(守门 74,词表五语言可解析)+ `node scripts/check-i18n-keys.mjs --staged`
- `node scripts/check-chat-element-coverage.mjs --staged`(守门 57:为⑤⑥补登记元素与锚点,计数不得倒退)
- `node scripts/check-glyph-arrow-icon.mjs` / `node scripts/check-no-divider.mjs` 等非本票必需,列此备提交链自查

---

### D81 B-部分开工

一句话结论:第①项(双时态词表机制)真正落地并接线,还有专用棘轮守门;第②~⑥项的渲染件在 HEAD 是**一件未被任何人 import 的死码**(0 消费点、0 用例),票面三条验收里只有词表那条成立。

证据(命令 → 输出片段):

1. ①已接线(共享判定层 + 三处渲染位 + 守门):
   `git -c safe.directory=* grep -n -I -E "describeToolActivity|describeToolActivityByStatus" HEAD -- apps/web/src packages/shared/src/chat | grep -v __tests__` →
   → `apps/web/src/components/ai/tool-call-card.tsx:903: const rowTitle = describeToolActivityByStatus({`
   → `apps/web/src/components/ai/progress-sections/tool-calls-section.tsx:165: describeToolActivityByStatus({` / `apps/web/src/components/ai/task-status-bar.tsx:152: const activity = describeToolActivity({`
   词表五语言齐 + 守门在册:`for f in zh-CN zh-TW en ja ko; do git -c safe.directory=* show HEAD:packages/i18n/messages/shared/$f.json | grep -c "Activity\""; done`
   → `zh-CN 59 / zh-TW 59 / en 59 / ja 59 / ko 59`(五语言逐位同数)
   → `git -c safe.directory=* grep -n -I -E "D81|双时态" HEAD -- scripts` → `scripts/check-tool-activity-coverage.mjs:6: // 工具活动行双时态措辞覆盖守门(PROJECT_PLAN.md D81①/D83/H28)`
   口径更正(相对票面字面):实现选择**一语义一键 + ICU select**(`packages/shared/src/chat/tool-activity.ts` 头注:"键约定:taskStatus 下 `<功能名键>Activity`,值走 ICU select(一种语义一键,不拆 running/completed 两键)"),而非票面的"两键";两键判据因此按现口径等价满足,不得回头拆键。
2. ②~⑥是死码(规则 2 的正面用例):
   `git -c safe.directory=* grep -n -I -E "ActivityCodeBlock|ActivityDurationBar|ActivitySearchQuery|ActivityConnectorGroupLabel|activity-codeblock" HEAD -- apps packages` →
   → 命中只有 `apps/web/src/components/ai/tool-activity-line.tsx` 自身的 `:15/:75/:139` 三处 export(以及共享层一个同名纯函数 `tool-category.ts:181`),**没有任何 import 方**
   → 该文件的两个入库来源:`git -c safe.directory=* log --oneline HEAD -- apps/web/src/components/ai/tool-activity-line.tsx` → `200ac5ae42f chore(watermark)…` / `e09d866222f chore(snapshot): 事故后现场保全 —— 工作区全量在途状态入库`(即从未有过功能提交)
   → 文件头自述:`apps/web/src/components/ai/tool-activity-line.tsx:6: // 活动条目 · D81 ②~⑥ 的可复用呈现原语(工具活动条上的子组件)。`
3. 票面另外两条验收无对应实现物:
   - ④"完整内容可达"的用例:HEAD 内不存在引用 `activity-codeblock` 的测试(`git ls-tree -r --name-only HEAD | grep -i "tool-activity"` 无 `*.test.*` 命中该组件)。
   - 取消态用例:`apps/web/src/components/ai/progress-sections/tool-calls-section.tsx:253` 有 cancelled 撤回徽章(web 既有能力),但票面点名的 `canceledItemLabel` 只在死码里出现(`tool-activity-line.tsx:133`)。

已落件 / 还欠件:
- 已落:①双时态措辞机制 + 首批 24/91 惯用档 + 长尾通用档兜底 + 五语言齐 + 守门 `check-tool-activity-coverage.mjs`;⑥在 `tool-calls-section.tsx` 侧有一份"撤回不静默消失"的既有实现(Ban 图标 + `tools.revoked`),算部分覆盖。
- 还欠:②`workedForDuration` 耗时条(需要 D34 的 item 级时间戳四元组,台账 HEAD:3005 明确"item 级时间戳四元组仍未接");③`searchWithQuery`;④`showAllLines`/`hideLines` 展开收起及其"完整内容可达"用例;⑤`sourcesButton` + `readingConnector`/`writingConnector` 读写分组;⑥`canceledItemLabel` 的按票面形态;以及票面第⑦项(HEAD:2787 追加的"活动条目内渲染 workflow",落 `ArtifactCanvas` 通道)完全未动。

落点建议:
- 接线点(端内只做渲染,不新建第二套判定):`apps/web/src/components/ai/tool-call-card.tsx` 与 `apps/web/src/components/ai/progress-sections/tool-calls-section.tsx` 是既有活动条渲染位 —— 把 `tool-activity-line.tsx` 的 `ActivityCodeBlock/ActivityDurationBar/ActivitySearchQuery/ActivityConnectorGroupLabel` 接进去,而不是新造组件。
- 数据面:`packages/shared/src/sse/contract.ts` + `packages/shared/src/utils/sse-parse.ts`(item 级时间戳四元组需先在契约声明,再经 `packages/api-client/src/client.ts` 透传)→ 否则耗时条只有动词没有耗时(该教训已写进 `packages/shared/src/chat/tool-activity.ts` 头注与台账第 41 轮)。
- 判定层:`packages/shared/src/chat/tool-category.ts`(已有 `toolActivitySearchQuery`),连接器分组与取消态标签同样不得在端内判。
- miniapp-taro / mobile-rn 同步(§4 铁律 + §9 多端):对应 `apps/miniapp-taro/src/pkg-ai/ai-cards.tsx`、`packages/app` 共享活动条。
- ⑦按票面复用 `apps/web/src/components/chat/message-list/MessageItem.tsx` 的 `ArtifactCanvas` 流内对象通道,禁止新建内联渲染栈。

验收命令:
- `git -c safe.directory=* grep -n -I -E "tool-activity-line" HEAD -- apps/web/src`(**必须**出现除自身以外的 import 行才算装车;当前为 0)
- `node scripts/check-tool-activity-coverage.mjs --staged`(守门 60 双时态覆盖 floor)
- `pnpm --filter @ihui/web test -- tool-call-card` 与新增用例目录 `apps/web/src/components/ai/__tests__/`(票面要求 ④ 断"完整内容可达"、⑥ 取消态各 1 例)
- `pnpm --filter @ihui/shared test`(`packages/shared/src/chat/__tests__/tool-activity.test.ts`)
- `node scripts/check-i18n-keys.mjs --staged` + `node scripts/check-word-table-resolvable.mjs`
- `pnpm --filter @ihui/web typecheck`

---

### D110 C-已在库该翻勾

一句话结论:该票的交付物是"取证方法打通 + 9 条差距逐条在册",两者在 HEAD 都已具备 —— G-150~G-158 九枚编号全部登记在 `PROJECT_PLAN.md` 的 D110 块内,且台账里**已存在一条 `- [x] ✅(2026-09-24)` 的同标题行**;现挂在 `- [ ]` 只是同一行被并发活文档 union 复制成"未勾 + 已勾"孪生对,属台账漂移而非未开工。

证据(命令 → 输出片段):

1. 登记物在库(九枚编号逐条成行):
   `git -c safe.directory=* grep -n -I -E "G-15[0-8]" HEAD -- PROJECT_PLAN.md` →
   → `HEAD:PROJECT_PLAN.md:2961: - **G-150 压缩上限告警 + 可操作建议**:对方原文"上下文压缩已达上限,建议开始新对话…"`
   → `:2964 G-151 上下文生命周期显式交代` / `:2965 G-152` / `:2971 G-153` / `:2974 G-154` / `:2975 G-155` / `:2976 G-156` / `:2977 G-157` / `:2978 G-158 反向清单`
2. 票已勾版就在同一文件(孪生行):
   → `HEAD:PROJECT_PLAN.md:2959: - [ ] **D110 WorkBuddy 一手证据已打通 → 对话流 9 条新差距…**`
   → `HEAD:PROJECT_PLAN.md:2960: - [x] ✅(2026-09-24) **D110 WorkBuddy 一手证据已打通 → 对话流 9 条新差距…** …**对账改判(2026-09-24,HEAD 取证)**:PROJECT_PLAN HEAD 内 G-150…G-158 九枚编号全部在册,登记类交付已完成。`
3. 差距不是纸面条目,已反向驱动守门与代码(G-150/152/153/154 各有实现+用例):
   `git -c safe.directory=* grep -n -I -E "G-15[0-8]" HEAD -- apps packages scripts | head` →
   → `apps/ai-service/app/routers/llm.py:758: G-150(WorkBuddy 一手对标):过去只在 compressed=True 时发帧…`
   → `packages/shared/src/utils/sse-parse.ts:77: /** G-150:incompressible = 压缩已撞到上限…`
   → `apps/cli/src/commands/task-status-line.ts:448: * G-153(WorkBuddy 一手对标):权限档必须交代**后果**…`
   → `scripts/data/chat-flow-elements.json:502/549: "render": "…(G-153)/(G-150)"`(守门 57 元素已登记)

已落件 / 还欠件:判 C,不列欠件。**须如实区分的是**:票面"9 条差距"本身是 D110 的交付物;而**逐条差距的实现**属后续票(登记里 G-151/155/156/157/158 在 HEAD 代码面 0 命中 = 尚未开工,那是 D111 及后续措辞/能力票的范围,不得回头算进 D110 未完成)。

落点建议:仅需把 L2959 的未勾孪生行按 §1 翻成 `[x]` 并与 L2960 合并为一条(去重),不得删行(§12 活文档对账纪律)。
验收命令:`node scripts/check-plan-line-loss.mjs --self-test`(守门 71 登记行防丢)+ `node scripts/check-task-claims.mjs` + 复跑 `git -c safe.directory=* grep -c -E "^- \[[ x]\] \*\*D110" HEAD -- PROJECT_PLAN.md`(应为 1,现为 2)。

---

### O20 C-已在库该翻勾

一句话结论:票面"最小正确顺序"的三步(① rewrites 只反代只读发现文档、②卡片 url 指向公网域、③公网可达性回归)在 HEAD 全部有实现物,且注释显式记录了 owner 已拍板该路线;票面残留的"待用户确认白名单"前提已消失。

证据(命令 → 输出片段):

1. ①反代白名单(仅发现文档,不做通配):
   `git -c safe.directory=* show HEAD:apps/web/next.config.ts | sed -n '377,391p'`
   → `// 2026-09-24 新增(O20 公网拓扑,owner 拍板"web 层反代白名单"方案):`
   → `// 白名单纪律:**只放只读发现文档**(GET /.well-known/agent.json + agent-card.json),不做 /ai-service/* 通配`
   → `source: '/.well-known/agent.json', destination: \`${IHUI_AI_PROXY_TARGET}/.well-known/agent.json\`,`
   提交可溯源:`git -c safe.directory=* log --oneline -1 HEAD -- apps/web/next.config.ts` → `2dddc85c588 feat(a2a): web 反代白名单暴露发现文档 + 卡片 Host 推导反代免疫`
2. ②卡片对外基址经反代 Host 推导(票面 O20b 的机制前提已在库):
   `git -c safe.directory=* grep -n -I -E "resolve_public_base_url|\"url\"" HEAD -- apps/ai-service/app/services/agent_card.py apps/ai-service/app/routers/agent_wellknown.py`
   → `agent_card.py:237: "url": f"{root}{TASKS_PATH}",` / `agent_card.py:294: def resolve_public_base_url(...)`
   → `agent_wellknown.py:67: base_url = resolve_public_base_url(headers, url_scheme=request.url.scheme)`
   → `agent_wellknown.py:13: —— 对外 URL 由请求 Host 或配置白名单域名推导(见 agent_card.resolve_public_base_url)。`
3. ③公网回归断言(票面点名"现 e2e 只测内网"):
   `git -c safe.directory=* grep -n -I -E "publicUrl" HEAD -- scripts/e2e-agent-access.mjs`
   → `scripts/e2e-agent-access.mjs:1595: title: \`GET ${OPTS.publicUrl}/.well-known/agent.json 公网可达且卡片 url 是公网域(O20 反代白名单回归)\`,`
   → `:94: flagOf('public-url') || envOr(['IHUI_AGENT_PUBLIC_URL', 'PUBLIC_URL'], 'https://aizhs.top')` / `:1609: const pubHost = new URL(OPTS.publicUrl).host`

已落件 / 还欠件:判 C。唯一不在代码面的动作是票面实施顺序的第④步"部署观察"——属运维事实,HEAD 结构上无法自证,翻勾时按 §14 附一次 `--live --public-url` 实跑记录。
验收命令:
- `node scripts/e2e-agent-access.mjs --live --json`(现含公网段断言)
- `node scripts/e2e-agent-access.mjs --live --public-url https://aizhs.top --json`
- `curl -sS https://aizhs.top/.well-known/agent.json`(期望 200 且 `"url"` 主机段为 `aizhs.top`)
- `node scripts/check-capability-catalog.mjs`(守门 51,71 项 `host:'ai-service'` 能力目录一致性)
- `pnpm --filter @ihui/web typecheck`(next.config 改动面)

---

## 未判定 / 取证深度受限的条目(如实登记)

1. **D6 的"评审已启动"这一子面**:票面自述"终项确认待并行批次恢复后给出"。我在 HEAD 只否证了"收敛已发生"(默认档 `langgraph` + 四套路由并列),未能确认是否存在未入库的评审记录(`.ihui-agent/` 部分子树被 gitignore,不在 HEAD 取证面内)。**判定 B 不依赖这一条**,但"是否已有第三份未入库文档"属未判定。
2. **D64⑥ 的对照表**:票面要求的对照表可能在 `.ihui-agent/tmp/wb-evidence/`(该目录已被 gitignore,按定义不入 HEAD)。我判"⑥未完成"的依据是 **HEAD 内不存在该产物**;若审计口径要覆盖"磁盘上的未入库产物",这一条应改判"未判定"。
3. **D39 的 MessageErrorCard 渲染消费者**:HEAD 内 `<MessageErrorCard` 的 JSX 消费点未定位到(见该票"备注")。我按"动作族与倒计时两套均有实现、且共享判定层 `quota-ownership.ts` 在别处被消费"给 C,但**该组件是否在页面上真出现**未取证到渲染位 —— 这是本批最弱的一条 C,续做者翻勾前请复跑守门 57。
4. 全部 7 票均未跑任何 `pnpm`/`node` 命令(任务书判据是 HEAD 内容面,且红线要求只读);所有"验收命令"是**给人或下一轮跑的**,本审计未执行。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
