<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 版本台账对账报告 — batch 6(D17 D35 D55 D77 D91 O14)

- 仓库:`G:\IHUI-AI`,判据面一律 **HEAD**(实测 `git -c safe.directory=* rev-parse --short HEAD` → `ae703ea1811`)。
- 全程只读:未执行任何 Edit/写文件/ git 写操作(唯一写出物是本报告)。
- 台账自身的漂移在每票末尾登记(同一票在 HEAD 里既有 `- [ ]` 又有 `- [x]` 是本次实测常态)。

---

### D35 A-确未开工

**一句话结论**:票面"第一段数据面已落(迁移 288↔288、turn_ordinal 列、history_projection_state、shared 纯函数、GET /history 端点、回归 64 passed、barrel 已登记)"在 HEAD **整段不成立** —— 实现物在全仓跟踪面零命中,唯一命中是 `PROJECT_PLAN.md` 的散文本身。

**证据(命令 → 输出片段)**:

1. `git -c safe.directory=* grep -l -I -F "turn_ordinal" HEAD -- apps packages sdks scripts`
   → **空输出**(0 文件)
2. `git -c safe.directory=* grep -l -I -F "history_projection_state" HEAD`
   → `HEAD:PROJECT_PLAN.md`   ← 仅台账,无 schema/无迁移/无服务
3. `git -c safe.directory=* show HEAD:packages/shared/src/chat/index.ts | grep -nE "projection|voice-note|prompt-drafts"`
   ```
   71:// D43 / D36 / D35 这三个模块(voice-note、prompt-drafts、history-projection)在全仓任何 ref 上
   78:// export * from './prompt-drafts'
   80:// export * from './history-projection'
   ```
   ⇒ 票面"barrel 已由主会话登记(`export * from './history-projection'`)"为**假**:该行仍是注释态,且注释自己就写明"全仓任何 ref 上不存在"。
4. `git -c safe.directory=* ls-tree -r --name-only HEAD -- packages/database | grep -E "2026(09|10)" | tail -20`
   → 最新一枚是 `packages/database/drizzle/20260923120000_chat_message_feedbacks.sql`,**无** `20260924100000_chat_history_projection.sql`
5. 换形态复核(判据硬规则 3):`git -c safe.directory=* grep -l -I -E "turnOrdinal|by_turn|idx_chat_messages_by_turn|20260924100000" HEAD -- apps packages` → `(no match)`
6. `git -c safe.directory=* grep -l -I -E "projectHistoryPage|groupMessagesByTurn|HistoryPageDirection" HEAD` → `HEAD:PROJECT_PLAN.md`(仅此)
7. `git -c safe.directory=* grep -n -I -E "conversations/:id/history|/history\"" HEAD -- apps/api/src` → **空**(端点不存在)
8. `git -c safe.directory=* grep -l -I -E "rollout_byte_offset|next_rollout|projection_state" HEAD -- apps packages` → `(none outside PROJECT_PLAN)`

**落点建议**(按仓库"共享层优先"§3,数据面沉 `packages/database`,投影逻辑沉 `packages/shared`,端内只做接线):
- `packages/database/src/schema/chat*.ts` + 新迁移 `packages/database/drizzle/<ts>_chat_history_projection.sql`(turn_ordinal 列 + `idx_chat_messages_by_turn` + `chat_conversations.history_projection_state jsonb`)+ 同步 `packages/database/drizzle/meta/_journal.json`
- 写入路径:`apps/api/src/services/` 会话服务内的 createMessage / replaceMessages / branchConversationFrom(以及票面点名的两处直插 `patrol-scheduler.ts` / `conversation-import.ts`)
- 投影纯函数 + 单一真相源:`packages/shared/src/chat/history-projection.ts`,并**解开** `packages/shared/src/chat/index.ts:80` 的注释
- 端点:`apps/api/src/routes/` 会话路由新增 `GET /conversations/:id/history`(newest/older/newer)
- 回放物化:`apps/ai-service/app/core/message_history.py`
- 端内无限滚动:`apps/web/src/hooks/use-chat/`(仅调 `@ihui/api-client`,§12e/守门 73 禁止端内裸 fetch)
- 首屏计时:`apps/web/e2e/` 新增阈值断言

**验收命令**:
- `node scripts/check-migration-bookkeeping.mjs`(离线 B1–B5;journal↔sql 双射,`--db` 模式本机不可用——实测无 PG 端口在听)
- `pnpm --filter @ihui/database typecheck && pnpm --filter @ihui/api typecheck && pnpm --filter @ihui/shared typecheck`
- `pnpm --filter @ihui/shared test`(投影纯函数用例)、`pnpm --filter @ihui/api test`(history 端点用例)

---

### D55 C-已在库该翻勾

**一句话结论**:决策徽章不是"只补渲染位"而是**已完整装车**——共享 15 值决策集 + 四归并态在 `packages/shared/src/chat/step-decision.ts`,后端 `_derive_step_decision`/`_decision_hints` 在库,web / miniapp-taro / mobile-rn / extension **四端渲染位**实际消费取词入口,五语言词包在 `packages/i18n/messages/shared`。

**证据**:

1. 共享层与状态机:`git -c safe.directory=* show HEAD:packages/shared/src/chat/step-decision.ts | sed -n '18,40p'`
   ```
   export const STEP_DECISIONS = [
     'plan_blocked',
     'security_blocked',
   export type StepDecisionState = 'approved' | 'rejected' | 'needsUser' | 'unknown'
   ```
   票面四态中的"自动审查中"在源码注释里被显式归并说明(`git show HEAD:...step-decision.ts | grep -n 审查` → `14: * - 状态只归并到 approved / rejected / needsUser / unknown 四类 —— "自动审查中"由`),即设计决定而非缺失。
2. 后端产出面(票面称"1-1 已产出"):`git -c safe.directory=* grep -n -I -E "_derive_step_decision|_decision_hints" HEAD -- apps/ai-service | head -5`
   ```
   HEAD:apps/ai-service/app/services/agent_loop_v2.py:711:def _derive_step_decision(tr: ToolResult) -> tuple[str, str]:
   HEAD:apps/ai-service/app/services/agent_loop_v2.py:1741:        self._decision_hints: dict[str, tuple[str, str]] = {}
   HEAD:apps/ai-service/app/services/agent_loop_v2.py:4360:                decision, reason = _derive_step_decision(tr)
   ```
3. **渲染消费点**(命中≠实现,故逐端找渲染位):`git -c safe.directory=* grep -n -I -E "permissionDecisionWord|stepDecisionLabel" HEAD -- apps packages | grep -viE "test|step-decision.ts"`
   ```
   HEAD:apps/web/src/components/ai/progress-sections/timeline-event.tsx:391:      evidence?.decision === undefined ? null : stepDecisionLabel(evidence.decision, tDecision),
   HEAD:apps/miniapp-taro/src/components/AgentRuntimePanel.tsx:78:                {permissionDecisionWord(permission.decision, (k) => t(`stepDecision.${k}`))}
   HEAD:apps/mobile-rn/src/components/AgentRuntimePanel.tsx:77:              {permissionDecisionWord(permission.decision, (k) => t(`stepDecision.${k}`))}
   ```
   (另有 `apps/extension/entrypoints/sidepanel/components/AgentRuntimePanel.tsx:117` 与 `apps/web/src/components/ai/agent-task-progress-pane.tsx:580,727`,共 4 端 + 2 个 web 面板)
4. 四态各一用例(票面验收第一条):`git show HEAD:packages/shared/tests/chat/step-decision.test.ts | grep -n needsUser`
   ```
   90:      for (const s of ['approved', 'rejected', 'needsUser', 'unknown'] as const) {
   101:    expect(stepDecisionState('approval_timeout')).toBe('needsUser')
   103:    expect(stepDecisionState('whatever_new_code')).toBe('unknown')
   ```
5. 五语言词表:`git -c safe.directory=* grep -rl -I -F "stepDecision" HEAD -- packages/i18n` → `shared/{en,ja,ko,zh-CN,zh-TW}.json` 五份齐(注:键位在 **shared** 包,**不在** `packages/i18n/messages/web/*.json` —— 我实测 web 侧 `"stepDecision"` 计数为 0,查词必须走 shared 命名空间)。
6. 与 D34 `injection_applied` 不重复计数:`injection_applied` 的生产/消费面在 `packages/shared/src/sse/contract.ts:58`、`apps/web/src/stores/chat.ts:401`、`use-chat/send-message.ts:891`(渲染成 InjectionBar),与 step-decision 徽章是两条独立通路,无共享取词入口。

**台账状态**:HEAD 内同票**双份且态相反**——`PROJECT_PLAN.md:2529/2530` 与 `:6773` 为 `- [x] ✅(2026-09-24 复核)`,而 `:6772` 仍为 `- [ ]`。属登记面漂移(与 D35 的实现面漂移是两类问题)。

**验收命令**(复核用,非开工):`pnpm --filter @ihui/shared test` + `pnpm --filter @ihui/web typecheck`。

---

### D77 B-部分开工

**一句话结论**:数据模型 + 卡片 + 测试"件在库",但**消息流里没有它** —— `business-form-card.tsx` 唯一 importer 是它自己的测试,票面点名的 `form_request`/`form_response` 两个事件**从未进入 D34 SSE 契约**,后端零落库路径,四端零覆盖。

**证据**:

1. 件在库:`git -c safe.directory=* ls-tree -r --name-only HEAD | grep -iE "business-form"`
   ```
   apps/web/src/components/ai/__tests__/business-form-card.test.tsx
   apps/web/src/components/ai/business-form-card.tsx
   packages/shared/src/chat/business-forms.ts
   ```
   (`packages/shared/src/chat/__tests__/business-forms.test.ts` 也在,describe 标题即 `D77 business-forms / …`,含"拒绝路径零副作用"一节)
2. **接线面为零**(核实用户给的假设):`git -c safe.directory=* grep -n -I -F "business-form-card" HEAD -- apps packages | grep -v __tests__`
   ```
   HEAD:apps/web/src/components/ai/__tests__/business-form-card.test.tsx:17:import { BusinessFormCard } from '../business-form-card'
   ```
   ⇒ 除自身测试外无人 import;组件名面亦零渲染点:`git grep -n -I -F "BusinessFormCard" HEAD -- apps packages | grep -v __tests__` 只命中该文件的 `export interface` / `export function` 两行。
3. 事件契约未落地:`git -c safe.directory=* grep -l -I -E "form_request|form_response" HEAD -- apps packages sdks`
   ```
   HEAD:apps/web/src/components/ai/business-form-card.tsx
   HEAD:packages/shared/src/chat/business-forms.ts
   HEAD:packages/shared/src/chat/index.ts
   ```
   ⇒ `packages/shared/src/sse/contract.ts` **不在**命中清单里(D34 契约双份缺失);`apps/api` 与 `apps/ai-service` 零命中(后端不存在该事件)。
4. 共享件本身无人消费(排除测试):`git -c safe.directory=* grep -l -I -E "validateFormValues|applyFormAction|attendeesFoldNeeded" HEAD -- apps packages | grep -v "__tests__|/tests/"`
   → 只有 `apps/web/src/components/ai/business-form-card.tsx` 与 `packages/shared/src/chat/business-forms.ts`(后者是定义处)。barrel 有导出:`git show HEAD:packages/shared/src/chat/index.ts | grep -n business-forms` → `92:export * from './business-forms'`。
5. 组件头注自陈缺口(不是我的推断):`business-form-card.tsx:10` → `// 事件契约属 D34、后端落库另票;表单请求形状由 \`@ihui/shared/chat/business-forms\``
6. 词表面**已有**:`git -c safe.directory=* grep -rl -I -E "businessForm" HEAD -- packages/i18n | head -5` → web 的 en/ja/ko/zh-CN/zh-TW 五份命中(票面"五语言词表"这一条不构成缺失)。

**已落件**:共享表单模型 + 状态机(`packages/shared/src/chat/business-forms.ts`,barrel 已导出)+ 其单测 + web 展示卡 + web 卡测试 + web 五语言词键。
**还欠件**:① SSE 契约 `form_request`/`form_response` 双份登记;② 消息流渲染位接线(唯一 importer 是自己测试 = 守门 64/§"造好没装车"同一型);③ 后端批准/拒绝动作的落库路由与副作用;④ `apps/miniapp-taro` / `apps/mobile-rn` / `apps/desktop` / `apps/extension` 端覆盖(§9 矩阵,未见豁免理由);⑤ 端到端"填→批准→后端落→状态回显"用例。

**落点建议**:
- 契约:`packages/shared/src/sse/contract.ts`(与 `INJECTION_APPLIED:58` 同表)+ `packages/shared/src/utils/sse-parse.ts`
- 生产:`apps/ai-service/app/services/agent_loop_v2.py`(发帧)+ `apps/api/src/routes|services` 的会话动作路由(落库,响应 `{code,message,data}`)
- 接线:`apps/web/src/components/chat/message-list/MessageItem.tsx` 按 kind 渲染 `<BusinessFormCard>`(该文件已是 `ihui:add-text-reference` 消费点,同一处接线)
- 端覆盖:`packages/shared` 出跨端表单状态机(已有),端内 `apps/miniapp-taro/src/components/`、`apps/mobile-rn/src/components/` 只做平台 adapter;表单件按票面复用 `packages/ui-react`

**验收命令**:
- `pnpm --filter @ihui/shared test && pnpm --filter @ihui/web test -- business-form-card`
- `pnpm --filter @ihui/api typecheck && pnpm --filter @ihui/web typecheck`
- 接线是否有牙(零 importer 直接判失败):`git -c safe.directory=* grep -n -I -F "business-form-card" HEAD -- apps packages | grep -v __tests__` 应出现 `MessageItem.tsx` 一行
- `node scripts/check-agent-event-parity.mjs`(SSE 契约双端对账,该脚本在 HEAD 存在)

---

### D91 B-部分开工

**一句话结论**:四类坐标的**共享分型 + 单一状态机 + 五语言词包**在库,docx / xlsx 两类的渲染位**真接上了**;PDF 页码与 PPTX slide 两类在 HEAD **没有任何渲染点注入坐标**,且为四类共用的展示组件 `annotation-anchor-label.tsx` 零生产 importer。

**证据**:

1. 分型与状态机在库:`git -c safe.directory=* show HEAD:packages/shared/src/chat/annotation-anchors.ts | grep -nE "^export"`
   ```
   30:export const ANNOTATION_ANCHOR_KINDS = ['pdf', 'pptx', 'docx', 'xlsx'] as const
   73:export const ANNOTATION_ANCHOR_ACTIONS = ['label', 'add', 'cancel', 'delete', 'relabel'] as const
   176:export function anchorLabel(anchor: AnnotationAnchor): AnchorLabel {
   ```
   barrel 导出:`git show HEAD:packages/shared/src/chat/index.ts | grep -n annotation-anchors` → `67:export * from './annotation-anchors'`
2. 事件族与采集件在库并被 import:`git -c safe.directory=* grep -n -I -E "AnnotationAnchorCapture|ADD_TEXT_REFERENCE_EVENT" HEAD -- apps/web/src | grep -v __tests__`
   ```
   HEAD:apps/web/src/components/media/office-preview.tsx:11:import { AnnotationAnchorCapture } from '@/components/chat/annotation-anchor'
   HEAD:apps/web/src/components/work-panel/annotation-style-panel.tsx:20:import { ADD_TEXT_REFERENCE_EVENT } from '@/components/chat/annotation-anchor'
   ```
3. **已接线的是两类**:
   `git -c safe.directory=* grep -n -I -E "anchor=\{\{ kind: " HEAD -- apps/web/src | grep -v __tests__`
   ```
   HEAD:apps/web/src/components/media/office-preview.tsx:133:          anchor={{ kind: 'docx' }}
   HEAD:apps/web/src/components/media/office-preview.tsx:312:          anchor={{ kind: 'xlsx', sheet: anchorCell.sheet, range: anchorCell.range }}
   ```
   (D41 预览器前置也确实在库:`ls-tree … apps/web/src/components/media` → `OfficeViewer.tsx` / `office-preview.tsx` / `PDFViewer.tsx` / `PDFTextLayer.tsx`,故本票**不再被 D41 阻塞**,票面"依赖定档"已过期)
4. **PDF / PPTX 未接线**(否定式换三种形态复核):
   - `git grep -n -I -E "anchor=\{\{ kind: " HEAD -- apps/web/src` → 仅 docx/xlsx 两行(上条逐字)
   - `git grep -n -I -E "AnnotationAnchor|anchor" HEAD -- apps/web/src/components/media/PDFViewer.tsx apps/web/src/components/media/PDFTextLayer.tsx | grep -iE anchor` → **空**(PDF 侧完全没引锚点;`pdfPage` 命中全是 pdf.js 页面句柄,不是批注坐标)
   - `git grep -n -I -E "kind: *['\"](pdf|pptx)['\"]|slideIndex|pptxSlide" HEAD -- apps packages | grep -v test` → `pptxSlide` 只出现在 `annotation-anchor-label.tsx:71` 与 `annotation-anchor.tsx:95` 的**取词分支**里,没有任何调用方把 `slide`/`element` 喂进来
5. 展示件零 importer:`git grep -rn -I -F "annotation-anchor-label" HEAD` → `PROJECT_PLAN.md` 叙述 + `apps/web/src/components/ai/__tests__/annotation-anchor-label.test.tsx:17`(唯一代码 importer 是自己的测试)
6. 回流成任务输入这一条**成立**:`git grep -l -I -F "ihui:add-text-reference" HEAD -- apps packages` 命中 `apps/web/src/components/chat/message-input.tsx` 与 `message-list/MessageItem.tsx`(派发方 `annotation-anchor.tsx:149 emitAnchorReference`)。
7. 五语言词包:`for l in zh-CN zh-TW en ja ko; do git show HEAD:packages/i18n/messages/web/$l.json | grep -c "annotationAnchors"; done` → 五份**均为 1**(命名空间在位)。

**已落件**:四类分型 + 共用状态机(反"各写一套")+ docx/xlsx 两类渲染位接线 + 事件族回流到输入框 + web 五语言词包 + e2e(`apps/web/e2e/annotation-flow.spec.ts` 在 HEAD 命中清单内)。
**还欠件**:PDF 第 {page} 页、PPTX 第 {slide} 张·{element}(含"批注 {element}"次标签)两类的**坐标注入与渲染位**;`annotation-anchor-label.tsx` 的接线或作为死件删除;四坐标各一用例中 PDF/PPTX 两项。

**落点建议**(遵守"禁止为四类各写一套状态机"):
- `apps/web/src/components/media/PDFViewer.tsx` / `PDFTextLayer.tsx`:复用同一 `<AnnotationAnchorCapture anchor={{ kind:'pdf' }} …>`,页码从既有 `pdfPage` 渲染循环取票面 `{page}`(不得新增第二套批注状态)
- `apps/web/src/components/media/office-preview.tsx` pptx 分支:现降级为 `<a:t>` 文本逐 slide 提取(文件头注释在库),把 slide 序号接成 `anchor={{ kind:'pptx', slide, element? }}`
- 二选一处置 `apps/web/src/components/ai/annotation-anchor-label.tsx`:被上述两处的渲染位 import(它已实现 `onAddToTask/onCancel/onDelete` 三回调),或按 §7 删除安全先确认 `chat/annotation-anchor.tsx` 的 `anchorCoordinateText` 已覆盖同类输出再删,不留孤儿件
**验收命令**:
- `pnpm --filter @ihui/shared test`(四类共用状态机轨迹一致)、`pnpm --filter @ihui/web test -- office-annotation-anchor`
- `pnpm --filter @ihui/web typecheck`
- 接线判据(应当从 2 行变 4 行):`git -c safe.directory=* grep -n -I -E "anchor=\{\{ kind: " HEAD -- apps/web/src | grep -v __tests__`
- `node scripts/check-i18n-keys.mjs --staged`(14 键 × 5 语言 parity)

---

### O14 B-部分开工

**一句话结论**:发布链的**判定层与包卫生**已按票面复核文字落地(gate job + `npm whoami` 实鉴 + 六 job 全 needs gate + `@ihui/api-client` 已去 `private` 并配 `files`/`publishConfig`/`build`),但票面点名的"真正发布"仍不可达成:**零版本 tag、Homebrew sha256 仍是 64 个 0 的占位**。

**证据**:

1. gate 与 needs 拓扑:`git -c safe.directory=* show HEAD:.github/workflows/release-sdk.yml | grep -nE "^  (gate|npm-publish|pypi-publish|maven-publish):|npm whoami|needs:"`
   ```
   147:  gate:
   221:              if WHO="$(npm whoami --registry=https://registry.npmjs.org/ 2>&1)"; then
   295:    needs: [extract, gate]
   ```
   另有 `418: pypi-publish` / `549: maven-publish` 均带 `needs: [extract, gate]`,`952:` 为**发布后回读**job(`needs: [extract, gate, npm-publish, pypi-publish, maven-publish, nuget-publish, go-publish]`)⇒ 票面"回读判红"一条在库。
2. `@ihui/api-client` 去 private:`git -c safe.directory=* show HEAD:packages/api-client/package.json | grep -nE "private|main|publishConfig|access|build"`
   ```
   6:  "main": "./dist/index.js",
   38:    "access": "public",
   ```
   ⇒ 全清单**无 `private` 键**(票面"需先补 build→dist + files + publishConfig 才能去 private"已完成:`32:"files"`、`47:"build": "rimraf dist && tsc -p tsconfig.json"` 均在)。
3. 零版本 tag:`git -c safe.directory=* tag -l 'v*' 'sdk-v*'` → **空输出**;而 `git tag -l | wc -l` = `4587`(全部是 `lost-commit/*`、`backup/*`、`desktop-v*`、`nightly-*` 一类)⇒ 票面"现 0 tag"对**发布用版本号**成立。
4. Homebrew 占位未回填:`git -c safe.directory=* show HEAD:deploy/homebrew/ihui.rb | grep -nE "sha256|url "`
   ```
   33:  url "https://github.com/IHUI-INF-AI/IHUI-AI/releases/latest/download/ihui-src-1.0.0.tar.gz"
   34:  sha256 "0000000000000000000000000000000000000000000000000000000000000000" # TODO(release): 回填 gh api digest,见上方命令
   ```
   且同文件第 10–19 行注释自证三重不可能:url 里的 `cli-v1.0.0` tag 在 origin 不存在、资产名 `ihui-src-1.0.0.tar.gz` 全仓无生产者、源码包不含 `dist/` 不满足 install 块。
5. .NET/Go 通道:workflow `952` 行的 needs 里含 `nuget-publish` 与 `go-publish` ⇒ 票面"(NET 无 NuGet 通道)"这句在 HEAD 已过期(两个 job 已在拓扑内),但**外部凭据**是否齐备在仓内不可判(NPM_TOKEN/PYPI_TOKEN/MAVEN_* 不入库,属账号侧,本次未证)。

**已落件**:gate 判定层(fail-safe)、发布后回读判据链、api-client 可发布形态(去 private + files + publishConfig.access + build→dist)。
**还欠件**:打 `sdk-v*`(或 `cli-v*`)版本 tag;brew formula 的 url 与资产名必须先有真实生产者再回填 sha256(禁止猜);外部凭据(NPM/PyPI/Maven)登记;`.NET` 通道虽在拓扑内但票面记录的"无通道"文字需按现 workflow 更正。

**验收命令**:
- `node scripts/check-pkg-installable.mjs @ihui/api-client`(HEAD 在库,发布前真包判据:dist 在包内 / 无 `workspace:` 残留 / 无凭据噪音)
- `git -c safe.directory=* ls-remote --tags origin | grep -E "sdk-v|cli-v"`(tag 缺失即此项仍红)
- `node scripts/check-workflow-step-order.mjs` + `node --test scripts/tests/check-pkg-installable.test.mjs`
- 本票的**终态判据只能是外部真值**:`npm view @ihui/api-client version` / PyPI JSON API / `repo1.maven.org` pom —— 在此之前 `- [ ]` 不应翻勾。

**台账状态**:HEAD 内 O14 有两条同文条目,`PROJECT_PLAN.md:506` 与 `:2361`,**均为 `- [ ]`**(与实现面一致,无漂移)。

---

### D17 B-部分开工

**一句话结论**:票面三条腿里"技能市场"和"连接器"各自成页并在顶栏**并列为五个入口**,而"统一入口"(单页聚合)与"专家包"这一类能力在 HEAD **零形状**;另有一张连接器授权卡造好无人接线。

**证据**:

1. 现状是"并列五入口"而非统一入口:`git -c safe.directory=* show HEAD:apps/web/src/components/layout/GlobalTopBar.tsx | sed -n '120,150p'`
   ```
   { key: 'capabilityMarket', icon: Boxes, href: '/capability-market' },
   { key: 'skillsMarket', icon: Wand2, href: '/skills-market' },
   { key: 'connectors', icon: Library, href: '/connectors' },
   ```
   同一 `titleKey: 'groupSettings'` 分组内另有 `{ key: 'skill', … href: '/ai-skills' }` 与 `{ key: 'mcpStore', … href: '/mcp-store' }` ⇒ 五个独立 href,无聚合页。
2. 各腿页面在库:`git ls-tree -r --name-only HEAD | grep -iE "(market|connector|plugin)" | grep ^apps/web/app`
   ```
   apps/web/app/(main)/capability-market/page.tsx
   apps/web/app/(main)/connectors/page.tsx
   apps/web/app/(main)/skills-market/page.tsx
   ```
   (`/plugins/PluginMarketplace.tsx`、`/skills/market/page.tsx`、`/mcp-store` 亦在。`capability-market/PageClient.tsx` 头注自陈为"能力市场页 — P2-8 供给侧",数据面是 `@ihui/api-client/endpoints/mcp` 的 capability 列表,不是三类生态的聚合。)
3. "专家包"这一类不存在:`git -c safe.directory=* grep -rln -I -F "专家包" HEAD -- apps/web packages/i18n` → **空输出**(UI 文案与五语言词包都没有该名词;路由枚举里也无 expert/persona-pack 一类页面)
4. 统一入口的交叉验证(否定式换落点,按目录枚举而非按名字猜):`git ls-tree -r --name-only HEAD -- "apps/web/app/(main)"` 的顶层目录清单共 **140+** 项,含 `connectors` / `skills-market` / `capability-market` / `plugins` / `mcp-store` / `personas` / `plaza` / `agents`,但**没有** ecosystem / hub / unified / 生态 一类聚合路由。
5. 第三块腿的授权卡件在库但零 importer:`git -c safe.directory=* grep -l -I -E "connector-auth-card|ConnectorAuthCard" HEAD -- apps packages | grep -v __tests__`
   → `HEAD:apps/web/src/components/ai/connector-auth-card.tsx`(只有定义文件自身)。
   而 `apps/web/app/(main)/connectors/PageClient.tsx` 走自己的 `useTranslations('connectors')` 实现(`:111`、`:560`)⇒ 第二套连接器授权呈现,属 §3"共享层优先"禁止的端内重复形态之一,需在收口时定性。

**已落件**:技能市场页、能力市场页、连接器页(含授权交互)、MCP 商店页、plugins 市场页,以及它们在顶栏 / `command-registry.ts` / `ui-routes.generated.ts` / `ui-route-index.ts` 的四处登记。
**还欠件**:① 票面主交付"统一入口"单页(三合一 tab 或聚合面板)在 HEAD 不存在;② "专家包"能力整体零形状(无数据模型、无词表、无页面);③ `connector-auth-card.tsx` 接线或删件;④ 多端一致(§9):`apps/miniapp-taro` / `apps/mobile-rn` 未见对应聚合入口,票面亦未写豁免理由。

**落点建议**:
- 统一入口页:`apps/web/app/(main)/ecosystem/page.tsx` + `PageClient.tsx`,按仓库既有形态把三类数据请求全部经 `@ihui/api-client`(不得端内裸 fetch,守门 73);分类 tab 的文案进 `packages/i18n/messages/web/*` 五语言;
- 跨端复用:`packages/shared/src/constants/` 落三个 kind 的枚举与 storage key(§3),`packages/ui-react` 出卡片壳,端内只 adapter;
- 注册面必须**同批四处**改齐:`apps/web/src/components/layout/GlobalTopBar.tsx`、`apps/web/src/lib/command-registry.ts`、`apps/web/src/lib/ui-route-index.ts`、`apps/web/src/lib/ui-routes.generated.ts`(漏一处即触发守门 69"声明未绑"或死链门);
- 专家包若不做,应在票面显式写"能力取消 + 理由",而非留 `- [ ]` 幽灵。

**验收命令**:
- `node scripts/check-nav-dead-links.mjs`(HEAD 在库;新 href 无 page 即红)
- `pnpm --filter @ihui/web typecheck && pnpm --filter @ihui/web test -- connector-auth-card`
- `node scripts/check-i18n-keys.mjs --staged`(新词包 parity + 白名单)
- 接线判据:`git -c safe.directory=* grep -l -I -E "connector-auth-card" HEAD -- apps packages | grep -v __tests__ | grep -v "components/ai/connector-auth-card.tsx"` 应为**非空**(否则仍是孤儿件)

---

## 汇总

| 票号 | 判定 | 一句话 |
| --- | --- | --- |
| D17 | B-部分开工 | 五个并列入口各自在库,票面主交付"统一入口"与"专家包"零形状;connector-auth-card 无人接线 |
| D35 | A-确未开工 | 迁移/列/共享模块/端点/纯函数在 HEAD 全部 0 命中,barrel 那行仍是注释且注释自陈"从未存在" |
| D55 | C-已在库该翻勾 | 共享 15 值 + 四态 + 4 端渲染位 + 后端推导 + 五语言词包齐,四态用例在库;台账 `- [ ]`/`- [x]` 双份并存属登记漂移 |
| D77 | B-部分开工 | 模型与卡片在库,但卡片零生产 importer、form_request/form_response 未进 SSE 契约、后端与四端全缺 |
| D91 | B-部分开工 | 四类分型 + 单一状态机 + docx/xlsx 已接线回流成任务;PDF 页码与 PPTX slide 两类无渲染点,label 组件零 importer |
| O14 | B-部分开工 | gate 实鉴 + api-client 已可发布形态 + 回读链在库;零版本 tag 与 brew sha256 全 0 占位使"真正发布"仍不可达成 |

**未查透项(如实声明,不当结论用)**:
1. D55 的"与 D34 `injection_applied` 帧不重复计数"我只做了**通路分离**取证(两条独立渲染位、无共享取词入口),**没有**跑用例或读两端渲染代码证明"同一帧不会同时出两条徽章"。
2. O14 的外部凭据是否登记在 repo secrets、以及 nuget/go 两个 job 的实装完整度未查(仓内不可判 + 账号侧动作)。
3. D17 未逐个打开 5 个市场页核对其内部 tab 是否已构成"事实上的统一入口"(判据用的是路由枚举 + 顶栏 href 面)。
4. D91 的 `apps/web/e2e/annotation-flow.spec.ts` 只确认**文件在 HEAD 且命中事件族字面量**,未读其断言是否覆盖四坐标(若已覆盖则 PDF/PPTX 的缺失只落在生产位、不在测试位)。
5. 各票的**工作区状态**一律未采信(判据要求),因此未报告"盘上是否有他人未提交的同类实现"。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
