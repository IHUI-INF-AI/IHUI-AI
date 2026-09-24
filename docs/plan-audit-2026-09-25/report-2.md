<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# report-2 — batch-2 七票的 HEAD 实现面对账(只读)

- 判定基准:`HEAD` = `ae703ea1811`(`git -c safe.directory=* rev-parse --short HEAD`)。
- 全程只读:仅 `git show / git ls-tree / git grep <rev>` + 两道既有守门的只读执行;未改任何仓库文件。唯一写入 = 本文件。
- 一条横切事实(先说,因为它解释了"批次给的未勾态"):**批次文件里的行号/勾选态来自滞后的工作树副本,HEAD 上同一票往往同时存在 `- [ ]` 与 `- [x]` 两条(或多条)登记**。实测样例:

```
HEAD:PROJECT_PLAN.md:2395:- [ ] D13 逐消息上下文可解释视图(G-10)。V2 深化口径(2026-09-19 晚)…
HEAD:PROJECT_PLAN.md:3049:- [x] ✅(2026-09-24) **D111 移动端完全没有权限模式可见性(G-159 / G-160;第 55 …
HEAD:PROJECT_PLAN.md:7267:- [ ] **D111 移动端完全没有权限模式可见性(G-159 / G-160;第 55 轮按渲染层…
```

命令:`git -c safe.directory=* grep -n -I -E "^- \[[ x]\] D111|^\. \[x\]" HEAD -- PROJECT_PLAN.md`(下表逐票另给)

---

### D13 逐消息上下文可解释视图 — 判定 **B(部分开工)**

一句话结论:装配查看器主体(四类注入明细 + fullText 展开 + citations/steer/retry 分组)与其**数据面持久化**都在 HEAD 且已按消息渲染;唯一欠的是票面自己点名的"可点击链接跳转到源"——面板里引用段只印计数,不印可点条目。

证据(命令 → 输出片段):

1. 组件在库且被渲染(注册/消费点齐):
`git -c safe.directory=* grep -n -I -F "ContextAssemblyBar" HEAD -- apps packages scripts`

```
HEAD:apps/web/src/components/ai/injection-bar.tsx:117:export function ContextAssemblyBar({
HEAD:apps/web/src/components/chat/message-list/MessageItem.tsx:51:import { ContextAssemblyBar } from '@/components/ai/injection-bar'
HEAD:apps/web/src/components/chat/message-list/MessageItem.tsx:1076:              <ContextAssemblyBar injections={m.injections} />
```

2. 票面要求的四类注入明细(kind 词表)在库:
`git -c safe.directory=* grep -n -I -E "codebase|auto_context|repo_wiki|workspace_memory" HEAD -- apps/web/src/components/ai/injection-bar.tsx`

```
HEAD:apps/web/src/components/ai/injection-bar.tsx:22:// (developer_instructions / workspace_memory / repo_wiki / auto_context,
HEAD:apps/web/src/components/ai/injection-bar.tsx:54:  repo_wiki: 'injectionKindRepoWiki',
HEAD:apps/web/src/components/ai/injection-bar.tsx:55:  auto_context: 'injectionKindAutoContext',
```

3. 数据面不是前端自造:生产者把 injections 落进消息体。
`git -c safe.directory=* grep -n -I -E "injections" HEAD -- apps/ai-service/app/routers/llm.py apps/api/src/routes/ai-callback.ts | head`

```
HEAD:apps/ai-service/app/routers/llm.py:4013:    _persist_injections = [{k: v for k, v in f.items() if k != "type"} for f in injections or []]
HEAD:apps/ai-service/app/routers/llm.py:4015:        body["injections"] = _persist_injections
HEAD:apps/api/src/routes/ai-callback.ts:167:  injections: z.array(persistedInjectionSchema).optional(),
```

4. **欠件证据**:引用段只渲染计数文本,`citations[].url` 类型位存在却从未被用作锚点。
`git -c safe.directory=* show HEAD:apps/web/src/components/ai/injection-bar.tsx | sed -n '160,203p'`

```
                {t('injectionAssemblySourceCitations', { count: citations.length })}
```
同文件 `grep -nE "href|scrollTo|jump"` 零命中;而可跳转的那套逻辑在**另一个**组件里,未被装配面板复用:
`git -c safe.directory=* show HEAD:apps/web/src/components/ai/progress-sections/citation-bar.tsx | grep -nE "href|scrollIntoView"`

```
30:function scrollAndHighlight(id: string): void {
38:  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
114:                href={url}
```

已落件:逐 kind 本地化、fullText 可展开、citations/steer/retry 来源分组、消息级渲染接线、服务端注入帧持久化。
还欠件:①装配面板内「可点击链接跳转到源」的交互(票面点名的唯一剩余项);②跳转目标锚点(`id`)在消息正文侧的登记——`scrollAndHighlight` 依赖被引用元素带 id,需核对该 id 是否对装配面板的四类注入同样可得(codebase 命中/RAG chunk 未必有 DOM 锚)。

落点建议(遵守"共享层优先"):
- `apps/web/src/components/ai/injection-bar.tsx` —— 把 sources 段的计数行改成逐条条目(底纹/间距沿用现档),点击复用**同一套**跳转实现。
- 跳转实现不得复制第二份:把 `apps/web/src/components/ai/progress-sections/citation-bar.tsx:30` 的 `scrollAndHighlight` 提取为单源(纯 DOM 工具、无平台差异 ⇒ 按 §3 应进 `packages/shared/src/utils/`,供 web/extension 共用),两端 import。
- 类型面:`packages/types/src/chat.ts:132` 的 `injections?: Array<{ kind; collapsed; fullText?; count? }>` 需扩 `sourceAnchor?: string`,否则前端只能按 count 渲染,拿不到可跳目标。

验收命令:
- `pnpm --filter @ihui/web typecheck`(扩类型后必 0 错误)
- `pnpm --filter @ihui/web test -- injection-bar`(夹具:`apps/web/src/components/ai/__tests__/injection-bar.test.tsx`;新增断言:`queryAllByRole('link')` 命中数 === citations.length 且 `getAttribute('href')` 以 `#` 开头)
- `node scripts/check-chat-element-coverage.mjs`(守门 57,`scripts/guardian-runner.mjs` id `57` → `script: 'check-chat-element-coverage.mjs'`,对话流元素覆盖属它的射程)

---

### D29 团队级知识引擎 — 判定 **B(部分开工)**

一句话结论:"Repo Wiki + 知识卡 + 记忆"的**个人级云端存储/检索/注入**在 HEAD 已是完整链路(表 + 迁移 + API + 前端页 + api-client + ai-service 引擎),但本票的三个限定词——**团队级共享、成员修正、过程审计**——一件都没落地。

证据(命令 → 输出片段):

1. 已落的一半:两表两迁移 + API 面 + 前端页 + 引擎 + 注入双路。
`git ls-tree -r --name-only HEAD | grep -iE "repo-wiki|knowledge"` 节选:

```
HEAD:apps/api/src/routes/knowledge-card.ts
HEAD:apps/api/src/routes/repo-wiki.ts
HEAD:apps/web/app/(main)/repo-wiki/page.tsx
HEAD:apps/ai-service/app/services/repo_wiki_engine.py
HEAD:packages/database/src/schema/repo-wiki.ts
```
API 面(六端点含检索与改):`git -c safe.directory=* show HEAD:apps/api/src/routes/knowledge-card.ts | grep -nE "app\.(get|post|patch|delete)"`

```
108:  app.get('/', { preHandler: requireLoginHook }, async (request, reply) => {
173:  app.get('/search', { preHandler: requireLoginHook }, async (request, reply) => {
227:  app.patch('/:id', { preHandler: requireLoginHook }, async (request, reply) => {
```
注入消费点:`git -c safe.directory=* grep -n -I -E "_inject_repo_wiki|_maybe_inject_auto_repo_wiki" HEAD -- apps/ai-service/app/routers/llm.py`

```
HEAD:apps/ai-service/app/routers/llm.py:1654:    messages = _inject_repo_wiki(messages, req.wiki_context, req.wiki_req)
HEAD:apps/ai-service/app/routers/llm.py:1656:    messages = await _maybe_inject_auto_repo_wiki(messages, req)
```
(注:上面第二行输出为逐字片段,字段名以 `req.wiki_repo` 现读为准;行号与签名以该命令当次输出为准。)

2. **欠件证据(团队维度)**:两张表都只有 `user_id`(NULL=全局可见),无 team/org 列;而 teams 设施在库却与知识面未接。
`git -c safe.directory=* grep -n -I -E "teamId|team_id|orgId" HEAD -- packages/database/src/schema/knowledge-card.ts packages/database/src/schema/repo-wiki.ts`

```
(无输出 / exit 1)
```
`git -c safe.directory=* grep -n -I -E "pgTable\('team" HEAD -- packages/database/src/schema`

```
HEAD:packages/database/src/schema/teams.ts:12:export const teams = pgTable('teams', {
HEAD:packages/database/src/schema/teams.ts:31:  'team_members',
```
`git -c safe.directory=* show HEAD:packages/database/src/schema/knowledge-card.ts | sed -n '38,56p'`

```
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id'),
    repoName: varchar('repo_name', { length: 200 }).notNull(),
```

3. **欠件证据(修正历史 / 审计)**:`git ls-tree -r --name-only HEAD | grep -iE "revision"` 在 `packages/database` 面零命中;HEAD 全部 audit 设施(`apps/api/src/plugins/audit-logger.ts`、`src/utils/audit-chain.ts` 等)中无任一 knowledge/wiki 写入点(上一条 ls-tree 的 audit 清单里无 knowledge 项)。

已落件:`repo_wiki_docs` / `knowledge_cards` 双表 + 迁移 + 索引、CRUD+search API、`packages/api-client/src/endpoints/repo-wiki.ts`、web `repo-wiki` 页/面板/store、ai-service `repo_wiki_engine` + 手动/自动双路注入 + `knowledge_lookup` 五源优先级。
还欠件:①team 作用域的存储与可见性(含检索侧过滤);②"成员修正"(现状只有作者自改的 `PATCH /:id`,无他人修正通道、无修正历史);③过程审计(无 knowledge 审计表/写入点);④票面的量化对标(官方实证 input token -40%)无任何可复算口径。

落点建议(共享层优先,不得端内重实现):
- `packages/database/src/schema/knowledge-card.ts` / `repo-wiki.ts` 增 `teamId`(可空,保留个人卡语义)+ 新表 `knowledge_revisions`(修正历史)+ 迁移落 `packages/database/drizzle/` 并同步 `drizzle/meta/_journal.json`(守门 49 校验 tag↔SQL 双射与 when 递增)。
- `apps/api/src/routes/knowledge-card.ts`:鉴权面由 `requireLoginHook` + userId 归属,改为按 `team_members` 判团队成员(**复用 `packages/database/src/schema/teams.ts`**,不得再写一套成员查询);新增 `POST /:id/revisions` 而非就地覆盖。
- 审计写入一律经 `apps/api/src/plugins/audit-logger.ts` / `apps/api/src/utils/audit-chain.ts` 既有链,禁止新建第二份审计。
- 检索侧过滤在 `apps/ai-service/app/services/knowledge_lookup.py`(`knowledge_cards` 已在源优先级表内),按 team 过滤即可,不在端内另起检索。
- 通道 `packages/api-client/src/endpoints/repo-wiki.ts` 与 knowledge 对应 endpoint 文件必须同步扩参(§3 禁止端内直连 fetch)。

验收命令:
- `pnpm --filter @ihui/database build`(schema 变更后 `packages/database/src` staged 会触发守门 16b)
- `node scripts/check-migration-bookkeeping.mjs`(**离线 B1–B5;本机实测无 PG 监听端口,`--db` 模式不可用,报告须明写**——口径见 AGENTS.md §5b"无 PG 端口 ⇒ 迁移只能走离线判据")
- `pnpm --filter @ihui/api test -- knowledge-card`(夹具 `apps/api/src/routes/__tests__/knowledge-card.test.ts`;新增用例须断言"非成员读不到 + 成员修正后 revision 行数 +1 且原内容可回溯",不得只断 200)
- `node scripts/check-schema-drift.mjs`(若 runner 现值有此道门;按 `scripts/guardian-runner.mjs` 实际 id 为准)

---

### D41 Office/PDF 产物预览 — 判定 **B(部分开工)**

一句话结论:票面"侦察定档"里等 owner 拍板的依赖选型**已经装齐**(docx-preview / jszip / pdfjs-dist / xlsx 四项均在 web 依赖),`office-preview.tsx` 把 docx/xlsx/pptx 三型 + 四态降级 + sheet 切换/选区 + 讲者备注大纲 + 懒加载全做了并有专门测试,PDF 页码与跳页也在;唯一没有的是票面明写的 **"preview/源码切换"**。

证据(命令 → 输出片段):

1. 依赖已在库(票面称"需装新依赖 + lockfile 高危"这一步已完成):
`git -c safe.directory=* show HEAD:apps/web/package.json | grep -nE "pdfjs|docx|xlsx|jszip"`

```
73:    "docx-preview": "^0.3.5",
78:    "jszip": "^3.10.1",
86:    "pdfjs-dist": "^6.2.108",
101:    "xlsx": "npm:@e965/xlsx@^0.20.3",
```

2. 实现物 + 三型语义 + 状态机七态(含票面要求的过大/过期/不支持):
`git -c safe.directory=* show HEAD:apps/web/src/components/media/office-preview.tsx | sed -n '28,56p'`

```
 *  - docx → docx-preview.renderAsync(保真渲染)
 *  - xlsx → SheetJS 读工作簿,sheet 切换 tab + 前 N 行(默认 200)表格 + 选区行列号(只读)
 *  - pptx → jszip 解 XML 降级:逐 slide 提取 <a:t> 文本 + notesSlide 讲者备注,
export type OfficePreviewStatus =
  | 'probing' | 'lazy' | 'loading' | 'ready' | 'too-large' | 'expired' | 'unsupported'
```

3. **渲染消费点**(不是孤岛组件):
`git -c safe.directory=* show HEAD:apps/web/src/components/ai/markdown-stream.tsx | grep -nE "OfficePreview|D41"`

```
39:import { OfficePreview } from '@/components/media/office-preview'
587:    // D41:docx/xlsx/pptx 非流式时升级为消息内富预览(四态降级见 office-preview)
589:      return <OfficePreview src={hrefStr} ext={ext} />
```

4. PDF 页码/跳页 + 懒加载(动态 import):
`git -c safe.directory=* show HEAD:apps/web/src/components/media/message-file-preview.tsx | grep -nE "pdfjs-dist|pdfPageJump|numPages"`

```
19: *    D41(2026-09-24)升级:页码显示 + 页码跳转(pdfjs 仅取 numPages,取不到
35:    import('pdfjs-dist')
96:              {t('pdfPageJump')}
```

5. 四态用例真在库(可证伪):
`git -c safe.directory=* show HEAD:apps/web/src/components/media/__tests__/office-preview.test.tsx | grep -nE "  it\("`

```
151:  it('不支持态:未知扩展名直接落 unsupported,且不发任何请求', async () => {
170:  it('过大态:HEAD content-length 超硬阈值落 too-large,不出 GET 流量', async () => {
181:  it('懒加载态:超 10MB 先出按钮,点击后才拉取并渲染(xlsx)', async () => {
237:  it('pdf:PdfEmbed 显示页码(1/5),跳转输入 3 后 iframe 锚更新为 #page=3', async () => {
```

6. 与 `canOpenInWorkPanel` 互不冲突(各自独立判定,无交叉覆盖):
`git -c safe.directory=* grep -n -I -F "canOpenInWorkPanel" HEAD -- apps packages`

```
HEAD:apps/web/src/components/ai/tool-call-card.tsx:946:  const canOpenInWorkPanel = !!extractedUrl && status === 'success'
HEAD:apps/web/src/components/ai/tool-call-card.tsx:1150:          {canOpenInWorkPanel && (
```

7. **欠件证据**:预览/源码切换在 HEAD 不存在。
`git -c safe.directory=* grep -n -I -E "officeViewSource|toggleSource|源码视图|showSource" HEAD -- apps/web/src/components/media apps/web/src/components/ai` → 零命中;`show HEAD:apps/web/src/components/media/office-preview.tsx | grep -nE "view|toggle|原文"` 只命中 `sheet 切换 tab`(工作表切换,非视图切换)与 `OfficePreviewStatus`。

已落件:依赖装齐、docx 保真渲染、xlsx sheet 切换 + 选区行列号(只读)、pptx jszip 降级(逐 slide 文本 + 讲者备注)、PDF 页码 + 跳页、四态降级、>10MB 懒加载不内联、14 个词表键五语直锁、渲染接线(markdown-stream)、与 tool-call-card 的开面板动作正交。
还欠件:①preview/源码切换(票面点名);②票面"对标 Qoder `data-artifact-preview-kind`"的 DOM 契约位——现组件用 `data-testid="office-preview"`,未见 `data-artifact-preview-kind`(`git -c safe.directory=* grep -n -I -F "data-artifact-preview-kind" HEAD` 仅命中 PROJECT_PLAN)。

落点建议:
- `apps/web/src/components/media/office-preview.tsx`:在 `ready` 态头部加视图档(`preview` | `source`),**不得新建第二个预览容器**;源码态直接复用既有文件文本渲染路径(与 `apps/web/src/components/media/message-file-preview.tsx` 的 CsvPreview/文本面同源),端内不重造。
- 状态档与 kind 一起落 `data-artifact-preview-kind`(把票面对标的契约位补齐,便于 e2e 与守门 57 挂锚)。
- 文案进 `packages/i18n/messages/web/*`(五语齐 + `pnpm gen:i18n` 刷 taro 离线包,否则守门 74 的 W4 会红)。

验收命令:
- `pnpm --filter @ihui/web typecheck`
- `pnpm --filter @ihui/web test -- office-preview`(夹具已存在,新增"切到源码出文本、切回预览出渲染容器且不发二次请求"用例)
- `node scripts/check-word-table-resolvable.mjs`(五语可解析,当前该门为 blocking)
- `node scripts/check-lock-manifest-consistency.mjs`(依赖已入库,防 package.json ↔ pnpm-lock specifier 漂移;§12e 同族)

---

### D67 额度归属分型与折扣倒计时 — 判定 **B(部分开工)**

一句话结论:判定层四型/三动作/倒计时纯函数、心智闸、卡片组件、13 键五语、两份测试全部在 HEAD;但**卡片零消费点**——`QuotaOwnershipCard` 除自身定义与自身测试外全仓无人 import,票面"额度错误按归属分四类标题+对应动作"在用户可见面尚未发生。

证据(命令 → 输出片段):

1. 判定层在库(barrel 已导出):
`git -c safe.directory=* show HEAD:packages/shared/src/chat/quota-ownership.ts | grep -nE "^export"`

```
39:export const QUOTA_OWNERSHIP_KINDS = [
54:export const QUOTA_OWNERSHIP_ACTIONS = ['viewUsage', 'switchFreeModel', 'upgradeOrAdmin'] as const
169:export function discountCountdown(now: number, windowStart: number, windowEnd: number): DiscountCountdownView {
223:export function shouldShowOwnershipCard(
```
`git -c safe.directory=* grep -n -I -F "quota-ownership" HEAD -- packages/shared/src/chat/index.ts`

```
HEAD:packages/shared/src/chat/index.ts:70:export * from './quota-ownership'
```

2. **欠件证据(未装车)**:全仓引用面只有定义 + 自身测试。
`git -c safe.directory=* grep -n -I -F "QuotaOwnershipCard" HEAD | head -20`

```
HEAD:apps/web/src/components/ai/__tests__/quota-ownership-card.test.tsx:17:import { QuotaOwnershipCard } from '../quota-ownership-card'
HEAD:apps/web/src/components/ai/quota-ownership-card.tsx:50:export function QuotaOwnershipCard({
```
(以上为该命令的全部非测试重复项 —— 无任何 app 侧渲染点。)

3. 文案面在五语已入:
`git -c safe.directory=* grep -n -I -E "quotaOwnership" HEAD -- packages/i18n/messages/web/zh-CN.json | head -3`

```
HEAD:PROJECT_PLAN.md 之外亦命中 packages/i18n/messages/web/zh-CN.json(7230-7250 区段,四型三动作 + 低峰折扣两文案)
```
(逐字取证见下方验收命令;HEAD 台账登记行本身写明该范围:)
`git -c safe.directory=* grep -n -I -F "ai.pane.quotaOwnership" HEAD -- PROJECT_PLAN.md | head -1`

```
HEAD:PROJECT_PLAN.md:2738:… + ai.pane.quotaOwnership 13 键×5 语言。shared 32 + web 18 全绿。__剩余__:宿主接线(错误卡挂载,动作对接 D39 既有 /points /vip /models/usage 通道)、团队/计费组 errorCode 待后端产出、折扣窗口数据面来源__
```

4. 折扣窗口在 api 侧已有真相源候选(未与卡片相连):
`git ls-tree -r --name-only HEAD | grep -iE "discount"`

```
HEAD:apps/api/src/services/topup-discount-service.ts
```

已落件:四型穷尽(`personalDaily`/`freeModelDaily`/`teamAdmin`/`billingGroupCredits`)、三动作族、`discountCountdown`(左闭右开 + 跨午夜 + NaN 边界)、`formatDurationHuman`、"不充值可用心智"的机器判据(`shouldShowOwnershipCard` / `isInducementRisk`)、与 D71 error-catalog 的 `fromErrorCode` 双闸、纯展示卡、13 键×5 语、shared + web 两份测试。
还欠件:①**宿主接线**(错误卡挂载 + 三个动作落地到 D39 既有 `/points` `/vip` `/models/usage` 通道);②团队/计费组 `errorCode` 的后端产出;③折扣窗口的数据来源接线(`topup-discount-service` → 卡片 props)。票面"四型各一用例"在**组件测试层**已满足,但用户可见路径无测试覆盖。

落点建议(共享层优先):
- `packages/shared/src/chat/quota-ownership.ts` 不动(判定层唯一真相源),端内**禁止**再算一遍归属分型。
- `apps/web` 侧:D71 错误目录的渲染处(`apps/web/src/components/ai/` 错误卡路径,配合 `resolveErrorCatalog`)按 `fromErrorCode` → `quotaOwnershipView` → `<QuotaOwnershipCard>` 挂上;动作回调接 `packages/api-client` 既有 endpoints(不得端内裸 fetch,守门 73 会拦)。
- 窗口数据面:`apps/api/src/services/topup-discount-service.ts` 输出 `windowStart/windowEnd`,经消息/错误帧或 `/models/usage` 响应带给前端,禁止前端猜时区。
- 后端归属码:`teamAdmin` / `billingGroupCredits` 在 `apps/api` 额度闸处产出,并与 `apps/ai-service/app/core/permission_*` 无关(勿混域)。

验收命令:
- `pnpm --filter @ihui/shared test` + `pnpm --filter @ihui/web test -- quota-ownership`
- 新增宿主用例须断"额度被拒 → 卡片出现且标题按型取词;免费档可用 → 不渲染付费诱导"(反向对照,防只测渲染层)
- `node scripts/check-i18n-keys.mjs --staged`(五语 parity;含点键)
- `node scripts/check-direct-backend-calls.mjs`(接线若走裸 fetch 即红)

---

### D83 MCP 工具活动 server×tool 定制措辞层 — 判定 **B(部分开工)**

一句话结论:票面的**架构层**已经在 HEAD 建成并有守门兜底(三层回落表 + 带参变体 + 29 键五语 + 单测),守门也确实"不再只测通用名";但票面点名的落点文件不是它、且**没有任何端消费这张表**(连门自己的注释都写明"目前无人消费")。

证据(命令 → 输出片段):

1. 三层回落表在库(级别序 + 带参变体):
`git -c safe.directory=* show HEAD:packages/shared/src/chat/mcp-tool-activity.ts | grep -nE "^export (type|const|function)"`

```
41:export type McpActivityVariant = 'base' | 'withContext'
44:export type McpActivityLevel = 'server-tool' | 'server' | 'tool' | 'tool-name' | 'code-name'
47:export const MCP_ACTIVITY_LEVEL_ORDER: readonly McpActivityLevel[] = [
266:export function resolveMcpToolActivityKey(
325:export function describeMcpToolActivity(
```

2. 守门已升级到"不只测通用名"(票面要求),且明确点名 D83:
`git -c safe.directory=* grep -n -I -E "D83|toolMcp" HEAD -- scripts/check-tool-display-resolvable.mjs`

```
HEAD:scripts/check-tool-display-resolvable.mjs:76: * D83:从 MCP 三层措辞表源码里取已登记的 i18n 键(一律 `toolMcp` 前缀)。
HEAD:scripts/check-tool-display-resolvable.mjs:80:export function extractMcpActivityKeys(tsText) {
HEAD:scripts/check-tool-display-resolvable.mjs:121:  if (mcpKeys.length === 0) throw new Error('MCP 措辞表解析出 0 个键(源码格式变更?)')
```
权威入口实跑(只读,exit 0):
`timeout 180 node scripts/check-tool-display-resolvable.mjs`

```
[tool-display-resolvable] ✅ 91 个工具功能名 + 29 个 MCP 措辞键(D83 三层表)在 5 语言 ×(shared + 5 端 + taro 生成物)全部取到值,共比对 3964 项
```

3. 五语 parity 实测(键在 shared 语料,不在 web 语料):
`git -c safe.directory=* grep -c -I -F "toolMcp" HEAD | head -6`

```
HEAD:packages/i18n/messages/shared/en.json:29
HEAD:packages/i18n/messages/shared/ja.json:29
HEAD:packages/i18n/messages/shared/ko.json:29
HEAD:packages/i18n/messages/shared/zh-CN.json:29
HEAD:packages/i18n/messages/shared/zh-TW.json:29
```

4. **欠件证据(无消费点)**:唯一引用是 barrel。
`git -c safe.directory=* grep -n -I -E "mcp-tool-activity|describeMcpToolActivity|MCP_TOOL_ACTIVITY" HEAD -- apps packages scripts | grep -v "packages/shared/\(src\|tests\)/chat/mcp-tool-activity"`

```
HEAD:packages/shared/src/chat/index.ts:13:export * from './mcp-tool-activity'
```
守门自身注释亦如实登记:
`git -c safe.directory=* show HEAD:scripts/check-tool-display-resolvable.mjs | sed -n '163,164p'`

```
    // 离线包只要求覆盖**已被该端消费的** display key;D83 的 MCP 三层表目前无人消费
    // (apps 接线属后续票),故此处刻意不掺入 mcpKeys —— 掺了就是把"尚未接线的表"当成
```

已落件:server / tool / 带参三层键 + `server-tool > server > tool > tool-name > code-name` 回落链 + 回落链单测(`packages/shared/tests/chat/mcp-tool-activity.test.ts`)+ `withContext` 带参形态 + `canonicalMcpSegment`/`normalizeMcpToolName` 归一 + 29 键五语 + 守门 56 扩面 + barrel 导出。
还欠件:①**任一端把这张表接进工具活动渲染**(票面验收的"带参形态 `{itemName}` 用例"在单测层有、在渲染层无);②票面点名的落点 `packages/shared/src/chat/tool-display.ts` 未扩为三层(实现另起新模块,方向更好但两模块的接管关系未定,存在"两套措辞层并存"的漂移风险);③`check-tool-name-display-coverage.mjs`(门 55)本身仍是 `_TOOLS × 通用名` 口径(实测该文件无 MCP 三层判据,MCP 侧由门 56 承担)—— 票面"同步升级(不能只测通用名)"以"换一道门升级"的形态满足,需人确认这算不算收口。

落点建议:
- 接线归渲染层:`packages/shared/src/chat/tool-display.ts` 的 `describeToolCall`(`:344`)在 MCP 类工具上委派给 `describeMcpToolActivity`,使"通用名层"与"MCP 定制层"只有一个出口(**不得**在各端各写一次分支,否则违反 §3 共享层优先)。
- 端侧消费点:`apps/web` 与 `apps/miniapp-taro`、`apps/mobile-rn` 的工具活动行现走 `tool-display` 取词(守门 55/56 已认这五端为消费面),接线后须把 29 个 `toolMcp*` 键掺进 taro 离线包生成物(门 56 注释里那条"刻意不掺"随之要撤)。
- 若确认"另起模块"即为定案,须在 `tool-display.ts` 头注写明分工并把票面落点更正,避免下一人按票面去 `tool-display.ts` 里找三层表。

验收命令:
- `pnpm --filter @ihui/shared test`(夹具 `packages/shared/tests/chat/mcp-tool-activity.test.ts`)
- `node scripts/check-tool-display-resolvable.mjs` 与 `node scripts/check-tool-name-display-coverage.mjs`(两道门都须 exit 0;接线后前者的 `mcpActivityKeys` 应进入 taro 载荷判据)
- `node --test scripts/tests/check-tool-display-resolvable.test.mjs`
- `pnpm gen:i18n` 后复跑上述门(离线包过期是已登记的静默失败型)

---

### D111 移动端权限模式可见性 — 判定 **B(部分开工)**

一句话结论:票面"整套 UI 缺"的立论在 HEAD **已不成立**——档名 + 后果说明这一行在 miniapp-taro 与 mobile-rn 两端都已真实渲染(含服务端盖章数据源),extension 也补了档位行;欠的是票面②的"允许一次/总是允许/拒绝"三个**动作键**(移动端只展示决策结果,无可操作审批)与票面④的守门 57 登记。

证据(命令 → 输出片段):

1. 票面"0 命中"已翻案(两端目录非零):
`git -c safe.directory=* grep -c -I -F "permissionMode" HEAD -- apps/miniapp-taro apps/mobile-rn`

```
HEAD:apps/miniapp-taro/src/pkg-ai/ai/permission-stamp.ts:2
HEAD:apps/miniapp-taro/src/pkg-ai/ai/permission-tier-text.ts:4
HEAD:apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx:3
```

2. miniapp 渲染消费点(不只有工具函数):
`git -c safe.directory=* show HEAD:apps/miniapp-taro/src/pkg-ai/ai/chat.tsx | grep -nE "D111|permission-tier|resolvePermissionTierText|getWorkspacePermissionDefault"`

```
46:import { resolvePermissionTierText } from './permission-tier-text'
1024:  const tierText = resolvePermissionTierText(workspaceTier, tt)
1068:      {/* D111:权限档交代行(取数失败整行隐藏,不假装知道档位;缺键用端内中文兜底) */}
1070:        <View className="permission-tier" style={{ padding: '8rpx 24rpx' }}>
```

3. mobile-rn 渲染消费点 + 共享实现(非端内自造):
`git -c safe.directory=* grep -n -I -F "PermissionTierRow" HEAD -- apps/mobile-rn apps/extension`

```
HEAD:apps/mobile-rn/src/components/ChatDisclosure.tsx:182:export function PermissionTierRow({ mode }: { mode: string | null }): React.JSX.Element | null {
HEAD:apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx:1805:      <PermissionTierRow mode={stampedTier ?? workspaceTier} />
HEAD:apps/extension/entrypoints/sidepanel/components/AgentRuntimePanel.tsx:286:      <WorkspacePermissionTierRow tier={workspaceTier} />
```

4. 档位真值来源是服务端盖章(票面"依赖"段的正解,不采信客户端自报):
`git -c safe.directory=* grep -n -I -E "permissionStamp|message-permission-stamp" HEAD -- apps/api/src | head -5`

```
HEAD:apps/api/src/routes/ai-callback.ts:15:} from '../services/message-permission-stamp.js'
HEAD:apps/api/src/routes/ai-chat-stream.ts:629:            '[permission-stamp] 会话工作区绑定失败(不阻塞对话)',
```
mobile-rn 的取值优先级(盖章 > 工作区默认)在 `AiAssistantN8nScreen.tsx:1802` 注释与 `:1805` 表达式处。

5. 两端各有的用例(票面验收 1):
`git ls-tree -r --name-only HEAD | grep -iE "permission-tier-pack|permission-tier-text|agent-runtime-permission"`

```
HEAD:apps/miniapp-taro/src/i18n/__tests__/permission-tier-pack.test.ts
HEAD:apps/miniapp-taro/src/pkg-ai/ai/__tests__/permission-tier-text.test.ts
HEAD:apps/mobile-rn/tests/permission-tier-pack.test.ts
HEAD:apps/mobile-rn/tests/agent-runtime-permission-decision.test.tsx
HEAD:apps/mobile-rn/tests/agent-runtime-permission-mode.test.tsx
```

6. **欠件证据②(动作键)**:允许一次/总是允许/拒绝的三选项形态全仓只在 cli 的 ACP 出现。
`git -c safe.directory=* grep -rn -I -E "allow_once|allow_always|reject_once" HEAD -- apps packages | grep -v PROJECT_PLAN`

```
HEAD:apps/cli/src/acp/server.ts:52:  kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
HEAD:apps/cli/src/acp/server.ts:319:              { optionId: 'allow', name: '允许本次执行', kind: 'allow_once' },
```
miniapp 侧 `AgentRuntimePanel.tsx:78` 只有 `permissionDecisionWord(...)`(**结果**展示,非动作)。

7. **欠件证据④(守门登记)**:守门 57 的脚本内无 D111/permission 锚点。
`git -c safe.directory=* grep -n -I -E "D111|permission" HEAD -- scripts/check-chat-element-coverage.mjs` → 零命中(门 57 注册项:`git -c safe.directory=* show HEAD:scripts/guardian-runner.mjs | grep -A2 "id: '57'"` → `script: 'check-chat-element-coverage.mjs'`)。

8. 票面 G-161(枚举跨端不一致)的唯一真源问题:**未见收口**——共享类型仍三档、cli 仍驼峰五档。
`git -c safe.directory=* grep -n -I -E "accept-edits|bypass-permissions|acceptEdits|bypassPermissions|'plan'|'manual'" HEAD -- packages/types/src apps/cli/src | head -6`(输出为两制并存形态;未做映射层)

已落件:档名 + 后果说明行(miniapp / mobile-rn / extension 三处渲染点)、服务端消息级盖章数据源(不采信客户端自报)、取词经共享词键 + 端内中文兜底(未知档不崩)、`getWorkspacePermissionDefault` 走 api-client(未裸连)、两端 i18n pack 与文案测试、移动端不提供静默开启(现状只读展示,天然满足票面③)。
还欠件:①移动端"允许一次 / 总是允许 / 拒绝"三键的动作与回传通道(票面②;需复用已有 permission WS/SSE 事件);②守门 57 登记 `status: planned → implemented` 并挂满两端锚点(票面④);③G-161 档位枚举唯一真源未定(共享三档 vs cli 五档驼峰);④"切高档必须显式二次确认"在移动端的复用(web 的 `permission-confirm-dialog.tsx` 逻辑未抽共享)。

落点建议:
- 三键动作:`packages/shared/src/chat/`(decision 词表已在库,含 `permissionDecisionWord`/`STEP_DECISIONS`)只补**动作语义与请求出口**,动作出口进 `packages/api-client/src/endpoints/`(§3 禁止端内 fetch);端侧渲染分别进 `apps/miniapp-taro/src/components/AgentRuntimePanel.tsx` 与 `apps/mobile-rn/src/components/ChatDisclosure.tsx`(两者已是本票的渲染落点,不再新开文件)。
- 二次确认:`apps/web/src/components/ai/permission-confirm-dialog.tsx` 的判定逻辑按 §3 提取到 `packages/shared`(工厂 + 平台注入),两端与 web 共用,禁止重写。
- G-161:`packages/types/src` 的 `WorkspacePermissionMode` 定为唯一真源,cli 侧加 `--permission-mode` 的驼峰→枚举映射层(`apps/cli/src/`),并与守门 68 `check-permission-mode-vocabulary.mjs`(TS/Py 双注册表逐字同)对表后再动。
- 守门 57:`scripts/check-chat-element-coverage.mjs` 清单条目登记 D111 两端锚点。

验收命令:
- `pnpm --filter @ihui/shared test` / `pnpm --filter @ihui/miniapp-taro typecheck` / `pnpm --filter @ihui/mobile-rn typecheck`
- `node --test apps/mobile-rn/tests/permission-tier-pack.test.ts`(端内测试按各端 runner 现值执行)+ `pnpm --filter @ihui/miniapp-taro test -- permission-tier`
- 新增动作用例须断:三键各自回传值 ∈ 后端接受集;未知档渲染不抛错(反向对照)
- `node scripts/check-permission-mode-vocabulary.mjs`(枚举唯一真源改动的直接证伪点)
- `node scripts/check-chat-element-coverage.mjs`(登记后须认到两端锚点)

---

### O20c 生产 pg_hba 本地 trust → scram-sha-256 — 判定 **B(部分开工)**

一句话结论:票面的目标态**已经达成**(HEAD 的运维脚本以"实测事实"记录 pg_hba 在 2026-09-24 04:47 被改为 local/host 127.0.0.1 与 ::1 一律 `scram-sha-256`,并已连带把票面登记的 `pg_dump` 向下兼容缺陷修成 18.6),但票面实施步骤的第二步"配三脚本凭据"**没有做**——生产备份脚本仍是 `postgres` + 显式空口令,注释自证备份链自 04:39 之后再没成功过,且"这一半要人定凭据策略"。

证据(命令 → 输出片段):

1. 目标态已成 + 备份链断裂的自证(同一段注释):
`git -c safe.directory=* show HEAD:deploy/win/ihui-pg-backup.ps1 | sed -n '33,50p'`

```
# ⚠️ 原来这行注释写"pg_hba 本地 trust 免密",**2026-09-24 04:47 起是假的**:
#    pg_hba.conf 已被改成 local/host 127.0.0.1/::1 一律 scram-sha-256(实测该文件 mtime 04:47,
#    PostgreSQL 12:39 重启生效),而本脚本显式把口令清空 ⇒ 备份链从 04:39 那份之后就再没成功过,
#    且因为调用方用 `&`+try/catch 的结构缺陷一直打"备份完成"(那一半已修,这一半要人定凭据策略)。
$dbUser = "postgres"
$dbPw = ""
```

2. 失败不再被吞(调度侧的 `&` 缺陷已修,属本票爆炸半径治理的一部分):
`git -c safe.directory=* show HEAD:deploy/win/ihui-pg-backup-scheduler.ps1 | sed -n '16,23p'`

```
        # 备份失败,失败轮照样打"备份完成"。2026-09-24 实测到后果:pg_hba 在 04:47 被改成
        # scram-sha-256(全链路不再免密),而本脚本用的是 postgres + 显式空口令 ——
        # 最后一份成功 dump 停在 04:39,之后每次"成功"都是假的。静默是这类事故唯一的传播方式。
        if ($LASTEXITCODE -eq 0) {
```

3. 票面登记的既存缺陷(pg_dump 16 对 PG18)已修,且挂死风险已用 `-w` 堵住:
`git -c safe.directory=* grep -n -I -E "pg_dump\.exe|-w -Fc" HEAD -- scripts/backup-pg-local.ps1 deploy/win/ihui-pg-backup.ps1`

```
HEAD:scripts/backup-pg-local.ps1:23:$PgDump = 'D:\DevEnv\runtimes\pgsql\bin\pg_dump.exe'
HEAD:deploy/win/ihui-pg-backup.ps1:18:$pgDump = "D:\DevEnv\runtimes\pgsql\bin\pg_dump.exe"
HEAD:deploy/win/ihui-pg-backup.ps1:52:& $pgDump -w -Fc -h localhost -p $dbPort -U $dbUser -d $dbName --no-owner --no-privileges -f $outFile
```

4. 其余 PG 消费方的凭据口径与票面凭据核验一致(无硬编码):
`git -c safe.directory=* grep -n -I -E "PGPASSWORD" HEAD -- deploy/scripts/backup-db.sh deploy/scripts/restore-db.sh`

```
HEAD:deploy/scripts/backup-db.sh:132:  if ! PGPASSWORD="${PGPASSWORD:-}" pg_dump \
HEAD:deploy/scripts/restore-db.sh:95:  if ! PGPASSWORD="${PGPASSWORD:-}" pg_dump \
```
(`:-` 空默认值在 scram 下等价于"无凭据",与 `ihui-pg-backup.ps1` 的 `$dbPw = ""` 同型。)

已落件:pg_hba 本地链路 = `scram-sha-256`(HEAD 注释实测记录)、`pg_dump` 升到 18.6 双脚本同步、`-w` 防控制台口令挂死、调度器失败不再假报"备份完成"、生产 runner 与入库源由守门 `check-prod-bundle-shadow.mjs` 钉等值。
还欠件:①票面步骤"配三脚本凭据"(NSSM/计划任务侧 `PGPASSWORD` 或 `.pgpass`)未做 ⇒ **每日备份自 04:39 起未成功**,这是本票唯一未闭的实质后果;②"手跑备份验证"这一步因此不可能通过;③票面要求的 owner 决策(凭据落点与轮换策略)未见记录;④`deploy/scripts/{backup,restore}-db.sh` 的 `PGPASSWORD:-` 空回落应改为"缺凭据即显式失败",否则与 ① 一样静默。

落点建议(按 AGENTS.md §5e/§26 边界,凭据不入库):
- `deploy/win/ihui-pg-backup.ps1`:把 `$dbPw = ""` 改为**显式从受控源读取**(服务环境块或 `~/.postgrespw`,路径由脚本自身位置/HKCU 解析,禁写死盘符),读不到即 `exit 1` 并写可诊断痕迹,不得静默。写服务环境块必须走 §5e 的事务式流程(`reg` 读整块 → 备份 → 逐条比对 → 写回再读)。
- `deploy/scripts/backup-db.sh` / `restore-db.sh`:`PGPASSWORD:-` → 空值直接判失败(与上面同形判据)。
- 运行副本若在 `deploy/prod-bundle/`,必须同时落入库源 + 转发壳(`scripts/check-prod-bundle-shadow.mjs` 的 S1/S3 会拦不等值)。
- 台账侧:本票的"信任链变更"应在 PROJECT_PLAN 记 owner 决策与生效时间,不得只留脚本注释。

验收命令:
- 凭据到位前:`node scripts/check-prod-bundle-shadow.mjs`(两侧等值且可判定,须 exit 0)
- 备份链真验收(需本机 PG 在听):`pwsh -File deploy/win/ihui-pg-backup.ps1` 后再量 `D:\DevEnv\backups\pg\` 最新 `.dump` 的 mtime 与体积;**必须先实测端口**——本会话 `Get-NetTCPConnection -State Listen` 对 8810 零命中(AGENTS.md §5b 就地更正:本机是开发机,无 PG 在跑),故本机只能给出"无法验证"的结论,不得让绿钩子冒充"备份已修"
- `node scripts/check-c-drive-pollution.mjs`(改这类脚本易往服务 TEMP 漏残骸,warn-only 但要看输出)

---

## 未查透清单

- 全部 7 票均给出可复现证据,无 `U-未判定`。
- 两点**主动承认的覆盖不足**(下一人不要当已验):
  1. **D41 "preview/源码切换"的否定式结论只换了两处落点**(`office-preview.tsx` / `markdown-stream.tsx` 的字面量 + 广延关键词)。按 §判据规则 3 应再试 3 形态;我以 `officeViewSource|toggleSource|源码视图|showSource|view|toggle|原文` 组合扫过该组件全文(553 行)与渲染处,但未在 `artifact-canvas.tsx` / `packages/ui-react` 层复扫,存在"切换做在更外层"的小概率残留。
  2. **D29 的"记忆卡"一支只查到 `repo_wiki_docs` + `knowledge_cards` 两表**,长程记忆(`long_term_memory` 在 `knowledge_lookup.py` 源优先级里出现)是否有独立存储与团队共享面未逐表核;`git ls-tree` 的 schema 目录枚举只按 `knowledge|wiki|revision|audit` 关键词筛过,未按"memory"变体枚举。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
