<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 版本台账对账报告 — 批次 4(D15 D31 D48 D69 D86 O13 O59)

- 判定口径:一律判 **HEAD** 实现面。HEAD = `ae703ea1811d106b65304999c9b4c974c4b1d5aa`(`git rev-parse HEAD`)。
- 全程只读;唯一写出的文件是本报告。允许并执行了的"跑"只有三类只读取证:`node --test scripts/tests/*.test.mjs`、`apps/web` 的 vitest 单测(不改文件)、`node scripts/check-desktop-cache-plaintext.mjs`(该门自述"全程只读,永不删")。
- 命令中的 `git -c safe.directory=*` 在本批次实测非必需(直接 `git <verb>` 即可,`git rev-parse HEAD` 正常返回);为可复跑,下文命令一律按我实际敲进去的原样写。

---

### D15 C-已在库该翻勾

一句话结论:GitHub App 的两半(webhook 自动 PR review + @机器人触发)在 HEAD 已完整落地并有全链测试,条目仍挂 `- [ ]` 属台账漂移。

证据(命令 → 输出片段):

1. 实现物齐套 —— `git ls-tree -r --name-only HEAD | grep -i 'github'`
   ```
   apps/api/src/routes/github-app.ts
   apps/api/src/services/github-app/{comment-trigger,events,jwt,pr-review,signature}.ts
   apps/api/tests/github-app-webhook.test.ts
   ```
2. 注册点(不是命中而是装车) —— `git grep -n -I -E 'githubAppRoutes' HEAD -- apps/api/src`
   ```
   HEAD:apps/api/src/routes/index.ts:332:import githubAppRoutes from './github-app.js'
   HEAD:apps/api/src/routes/index.ts:1297:  server.register(githubAppRoutes, { prefix: '/api/github-app' })
   ```
3. 两条派发链 —— `git show HEAD:apps/api/src/routes/github-app.ts | sed -n '243,343p'`
   ```
   if (parsed.data.kind === 'pull_request') { … const outcome: PrReviewOutcome = await runPrReview(
   const decision = decideCommentTrigger({ … await handleIssueComment({ transport, complete: textModel },
   ```
   其中 `isPrReviewAction` 过滤 action、`isDraft` 跳过草稿、`X-GitHub-Delivery` 幂等去重、secret 未配置走 503 不 fail-open。
4. 用例(含全链) —— `git show HEAD:apps/api/tests/github-app-webhook.test.ts | grep -nE "it\("`
   ```
   341:  it('pull_request 全链:取 diff → 出结论 → 回写 review', async () => {
   ```

已落件 / 还欠件:——(C 态,无欠项)
落点建议:无需开发。
验收命令(供翻勾时复核):`pnpm --filter @ihui/api test -- github-app-webhook`(本批次未跑,只做了静态接线取证)。

---

### D31 A-确未开工

一句话结论:HEAD 无任何 Figma Frame/组件 → 可运行前端代码的实现物;全部 figma 命中都是营销文案、假数据目录条目和一张品牌 logo。

证据(命令 → 输出片段):

1. 代码面 grep(排除 .md/.png/.svg/.json 后只剩两处非实现) —— `git grep -n -I -i figma HEAD -- apps packages sdks scripts | grep -viE '\.(md|png|svg|json):'`
   ```
   HEAD:apps/api/src/routes/skills.ts:156:    name: 'figma-to-code',
   HEAD:apps/api/src/routes/skills.ts:157:    description: 'Figma 转代码 — Figma 设计稿一键转 React/Vue 组件',
   ```
2. 该命中经核是**硬编码的第三方市场假数据**,不是我方能力 —— `git show HEAD:apps/api/src/routes/skills.ts | sed -n '155,162p'`
   ```
   name: 'figma-to-code', … author: 'DesignTools', version: '3.1.0', installCount: 2150,
   ```
3. 否定式换形取证(7 种命名形态,按目录枚举而非按名字猜) —— `for t in design-to-code design2code frame-to-code screenshot-to-code lanhu sketch-to-code 设计稿; do git grep -l -I -i -F "$t" HEAD -- apps packages sdks scripts; done`
   ```
   design-to-code -> 0 files    design2code -> 0 files    frame-to-code -> 0 files    screenshot-to-code -> 0 files
   sketch-to-code -> apps/web/app/(main)/en/use-cases/ai-design/page.tsx(营销页 Schema.org 条目)
   ```
4. Figma 数据模型零解析(证明不是"换了个内部叫法") —— `for t in absoluteBoundingBox componentSet figmaFile figma_node designImport; do git grep -l -I -i -F "$t" HEAD -- apps packages; done`
   ```
   absoluteBoundingBox -> (空)   componentSet -> (空)   figmaFile -> (空)   figma_node -> (空)   designImport -> (空)
   ```
   `git grep -n -I -i -E 'figma\.com|FIGMA_(TOKEN|KEY|API)' HEAD` 仅 3 处外链文案(`plugins-data/market-plugins-parts/part-5.ts:213`、`public/roles.{ja,ko}.md`),无凭据、无 API 客户端。

已落件 / 还欠件:仅有一处**相邻但不同**的能力可复用 —— `apps/web/app/(main)/design/`(`DesignPage.tsx` / `HtmlSourceEditor.tsx` / `CssInspector.tsx`)与 `apps/api/src/routes/design.ts`(`/design/preview`、`/design/comments`),它是"我方自产 HTML/CSS 的预览评审",不摄入外部设计文件。
落点建议(按 §3 共享层优先,禁止端内重实现):
- `packages/types/src/figma-import.ts` —— Figma REST `nodes` → 平台无关 IR(Frame/Component/Variant/Token 引用)的类型契约,跨端共用;
- `packages/shared/src/figma/` —— node 树 → IR → 组件描述 的纯函数映射(不依赖 DOM/RN API);
- `packages/api-client/src/` —— 唯一取数出口(Figma REST 抓取 + 凭据只在服务端),端内**不得**裸 `fetch`;
- 服务端编排落 `apps/ai-service/app/services/`(与既有 `skills.py`/`capability_gate.py` 同层)或 `apps/api/src/services/`,并在 `apps/api/src/routes/index.ts` 注册路由;
- 出码消费点复用既有 `apps/web/app/(main)/design/DesignPage.tsx`,不再新起一个编辑器。
验收命令:`pnpm --filter @ihui/types typecheck && pnpm --filter @ihui/shared typecheck && pnpm --filter @ihui/api test` + `node scripts/check-direct-backend-calls.mjs --staged`(证明确实走了 api-client)。**夹具要求:必须用 Figma 官方导出的真实 nodes JSON 做回归夹具**,自造结构等于把假设写成断言。

---

### D48 B-部分开工

一句话结论:加密层、接线、降级用例、只读巡检门全部在 HEAD 且离线用例实测 15/15 + 镜像 12/12 全绿;但票面第一条验收"静态盘 grep 明文会话为 0"**至今没有正面证据**——那台机的盘上是改造前的残留明文,改造后桌面端从未在本机跑过(与 O59⑤ 同一件事)。

证据(命令 → 输出片段):

1. 实现在库 —— `git ls-tree -r --name-only HEAD | grep -iE 'vault|chat-persist|cache-plaintext'`
   ```
   apps/web/src/lib/{chat-persist-crypto,local-vault,desktop-token-vault}.ts
   apps/web/tests/d48-{chat-persist-encryption,local-vault,refresh-token-vault}.test.ts
   scripts/check-desktop-cache-plaintext.mjs
   ```
2. 接线点(不是 import 而是 store 装车) —— `git grep -n -I -E "createChatPersistStorage|name: 'ihui-chat'" HEAD -- apps/web/src/stores/chat.ts`
   ```
   HEAD:apps/web/src/stores/chat.ts:9:import { createChatPersistStorage } from '@/lib/chat-persist-crypto'
   HEAD:apps/web/src/stores/chat.ts:1430:      name: 'ihui-chat',
   HEAD:apps/web/src/stores/chat.ts:1433:      storage: createChatPersistStorage(ssrStorage),
   ```
3. 验收项 2(解锁失败降级可读空态不崩)= 离线用例真实通过 —— `cd apps/web && ./node_modules/.bin/vitest run tests/d48-chat-persist-encryption.test.ts`
   ```
   ✓ tests/d48-chat-persist-encryption.test.ts (15 tests) 52ms
   Test Files  1 passed (1)      Tests  15 passed (15)
   ```
   用例含 `describe('D48 · 解锁失败降级(可读空态,不崩)')` 4 例与"迁移后零明文残留"1 例(见 `git show HEAD:apps/web/tests/d48-chat-persist-encryption.test.ts | grep -nE "^\s*(it|test|describe)\("` 的 161/187/273 行)。
4. 验收项 3(密钥不落仓)+ 门的自身逻辑 —— `git ls-files | grep -icE 'ihui-vault|vault.*\.key$'` → `0`;`node --test scripts/tests/check-desktop-cache-plaintext.test.mjs` → `tests 12 / pass 12 / fail 0`。
5. 验收项 1 **不成立** —— `node scripts/check-desktop-cache-plaintext.mjs; echo EXIT=$?`
   ```
   [desktop-cache-plaintext] 状态: violations
     ✗ 明文 persist 记录: ihui-chat @ 000003.log (local-storage)   (×2)
     ✗ CJK 明文命中(utf16 字节形态)×11: …\Local Storage\leveldb\000003.log   EXIT=1
   ```

已落件:①加密三件套 + `ihui-chat` 接线;②降级/幂等/端隔离/写序 15 例离线绿;③只读巡检门(含 nonce 阳性对照与 junction 真身解析)+ 镜像 12 例;④门入口 `pnpm check:desktop-cache-plaintext`(`package.json:75`)。
还欠件:①**盘上正面证据**:改造后桌面端跑一次登录并产生会话持久化,复跑门须见 `ihuiVaultV1` 记录出现且 plain 命中归零(今日实测仍 exit 1);②结构性小缺口:`ihui-vault.json` 未进 `.gitignore`(`git grep -n -I -iE 'vault' HEAD -- .gitignore` 零命中),当前"密钥不入仓"只靠运行时巡检与"该文件写在 WebView KV 通道"这一事实,而非结构保证。
落点建议:代码侧只补一行 —— `.gitignore` 增 `ihui-vault.json`(与 `local-vault.ts:33 VAULT_STORE_FILE` 单源同名的字面量,门已要求单源);其余属运行条件,不动源码。
验收命令:`pnpm check:desktop-cache-plaintext`(须 exit 0 且实扫清单里出现 `ihui-chat:vault`)、`cd apps/web && ./node_modules/.bin/vitest run tests/d48-chat-persist-encryption.test.ts`。

---

### D69 B-部分开工

一句话结论:四族里 ①(压缩因与后果)与 ③(排队族含降级句)文案族已在共享层 + 五语言键 + 用例齐备,但 ① 的载体组件**造好未装车**;②(模型切换 / 停止生成两处失败反馈)**完全没有**;④(附件与速记上限)只落了"数量"和"单图"两条,缺"每条 ≤5 图""总量 ≤20MB"。

证据(命令 → 输出片段):

1. 词包源在共享层(符合 §3) —— `git grep -n -I -F "INPUT_NOTICES_NAMESPACE" HEAD -- packages/shared/src/chat/input-notices.ts` → `28:export const INPUT_NOTICES_NAMESPACE = 'ai.pane.inputNotices' as const`
2. 五语言 parity(整块存在) —— `for L in zh-CN zh-TW en ja ko; do git show HEAD:packages/i18n/messages/web/$L.json | grep -c '"inputNotices"'; done`
   ```
   zh-CN: 1   zh-TW: 1   en: 1   ja: 1   ko: 1
   ```
3. 票面点名的原句逐字在库 —— `git show HEAD:packages/i18n/messages/web/zh-CN.json | sed -n '7157,7186p'`
   ```
   "insufficientCredits": "压缩会消耗少量积分",
   "runningTurn": "压缩在当前 Turn 完成后执行，不能插入正在运行的 Turn",
   "runtimeNoInterject": "当前 Runtime 不支持插话，消息将继续排队"
   ```
   (`queue.reasonTitle` 排队原因 / `denied.reorder` 无法调整排队顺序 / `denied.undo` 无法撤回排队消息 / `reorderAria` 拖动调整排队顺序；聚焦后可使用上下方向键 同块齐)
4. ③ 装车 + 用例:`git grep -n -I -E 'InputNoticeBanner|QueueInteractionBar' HEAD -- apps/web/src/components/chat/message-input.tsx`
   ```
   62:import { QueueInteractionBar } from '@/components/chat/queue-interaction-bar'
   978:        <QueueInteractionBar
   63:import { queueInteractionPerms } from '@ihui/shared/chat/input-notices'
   ```
   并存在 `apps/web/src/components/chat/__tests__/{input-notice-banner,queue-interaction-bar}.test.tsx`、`packages/shared/src/chat/__tests__/{input-notices,queue-interactions}.test.ts`、`apps/web/e2e/queue-interactions.spec.ts`。
5. ① 未装车 —— `git grep -l -I -i -E "InputNoticeBanner" HEAD`
   ```
   HEAD:apps/web/src/components/chat/__tests__/input-notice-banner.test.tsx
   HEAD:apps/web/src/components/chat/input-notice-banner.tsx
   HEAD:apps/web/src/components/chat/message-input.tsx      ← 只有第 975 行注释点名,无 import、无 JSX
   ```
   `git grep -n -I -E '<[A-Za-z]*NoticeBanner' HEAD -- apps packages` 的渲染命中**全部**落在 `__tests__/` 里。
6. ② 零实现 —— `for t in 未能切换 切换失败 未能停止 停止失败 switchFailed stopFailed modelSwitch stopGeneration; do git grep -l -I -i -F "$t" HEAD -- packages/i18n packages/shared/src/chat apps/web/src/components/chat; done` 只产出:`permissionSwitchFailed`(五语言齐,但那是票面**明令不得重做**的权限切换)与 `elementPack` 的后台子任务 `stopFailed`;后者头注自证边界:`git show HEAD:packages/shared/src/chat/element-pack.ts | sed -n '17p'` → `stopping/stopFailed;「停止失败」唯一命中在 spec-panel 域`。`modelSwitch` / `stopGeneration` 两族命名形态均 0 命中。且 `git grep -n -I -E "setModel:" HEAD -- apps/web/src/stores/chat.ts` → `580:  setModel: (model) => set({ currentModel: model })`(纯本地赋值,无失败分支可挂文案)。
7. ④ 只有两条 —— 键计数 `maxAttachmentsReached`(zh-CN=1 zh-TW=1 en=1 ja=1 ko=1)/ `imageMaxSize`(五语言 1/1/1/1/1);`totalMaxSize` / `maxImagesPerMessage` / `imagesPerMessage` 五语言全 0;"每条最多 5""总量不超"字面 0 命中。

已落件:①词包 + 五语言键 + 组件 + 单测/e2e;③词包 + 五语言键 + 组件**且已渲染**;④数量上限与单图上限两条五语言键。
还欠件:(a)②两处开关失败反馈整族缺失(键、判定、用例三样都没有);(b)① `InputNoticeBanner` 生产渲染点为空,压缩族"在手未上屏";(c)④缺"每条 ≤5 图""总量 ≤20MB"逐项文案与对应 enforcement;(d)"速记"上限族未见(0 命中)。
落点建议:
- 文案一律进 `packages/shared/src/chat/input-notices.ts`(`ai.pane.inputNotices` 词包)再落 `packages/i18n/messages/web/{zh-CN,zh-TW,en,ja,ko}.json` 五语言,**禁止**端内自拼措辞(票面"不新增自创措辞" + §19);
- (a)模型切换/停止生成失败:先在 `packages/api-client` 与 `apps/web/src/stores/chat.ts` 的 `setModel` / 停流路径补出**可失败的真实通道**,再在 `apps/web/src/components/chat/message-input.tsx` 的 `onModelChange`(`:1291`)与 `onStop`(`:1215/:1327`)消费点取词提示;不得顺手改 `permission-mode-popover.tsx`(票面禁止重做削弱);
- (b)上屏:在 `message-input.tsx` 与 `QueueInteractionBar` 同区渲染 `<InputNoticeBanner>`,并把"已上屏"写进 `apps/web/e2e/queue-interactions.spec.ts` 同层断言(参照 §64"造好没装车"教训);
- (c)附件族:每条 ≤5 图 / 总量 ≤20MB 的常量应单源(共享层常量,§3 constants),文案键 `inputNotices.attachments.{perMessageImagesExceeded,totalSizeExceeded}`。
验收命令:`node scripts/check-i18n-keys.mjs`(五语言 parity + 无重复键)、`pnpm --filter @ihui/shared test`、`pnpm --filter @ihui/web test -- input-notice-banner queue-interaction-bar`。

---

### D86 A-确未开工

一句话结论:摘要卡与其赖以成立的数据面(source 五枚举 + blocked 计数)在 HEAD 均不存在;台账第 66 轮"自证更正/二探"的三条实测断言我在 HEAD 逐条复现成立,该票仍未解阻。

证据(命令 → 输出片段):

1. 类型层零 source / 零 blocked —— `git show HEAD:packages/types/src/hooks.ts | grep -nE 'interface |blocked|source'`
   ```
   102:export interface Hook {  … 117:  enabled: boolean   (字段面仅 id/name/description/event/condition/action/enabled/createdAt/updatedAt)
   143:export interface HookLog { … 151:  success: boolean 153:  duration: number
   ```
   (两接口内均无 `source`;`HookLog` 无 blocked/denied 语义)
2. 服务层 stats 缺"已阻止" —— `git grep -n -I -E 'HookStats|avgDuration' HEAD -- apps/api/src/services/hooks-service.ts`
   ```
   372:  const empty: HookStats = { total: 0, success: 0, failed: 0, avgDuration: 0 }
   ```
   `git grep -n -I -i -E '\bblocked\b' HEAD -- apps/api/src/services/hooks-service.ts apps/ai-service/app/routers/hooks.py apps/ai-service/app/core/hook_runtime.py` → 空。
3. "已阻止"语义唯一存在处仍是进程内执行器(二探结论复现) —— `git grep -n -I -F 'denial_reason' HEAD -- apps/ai-service/app/core/hook_runtime.py`
   ```
   76:    denial_reason: str | None = None  # PRE_TOOL_USE:非 None 即拒绝
   ```
4. 卡片侧零落地:`git ls-tree -r --name-only HEAD | grep -iE 'web/app/.*hook'` → 唯一页面 `apps/web/app/(main)/hooks/page.tsx`,其 import 为 `8:import { HooksManager } from '@/components/hooks/hooks-manager'`;而 `git grep -n -I -iE 'stats|摘要|source' HEAD -- apps/web/src/components/hooks` → 空;`git grep -n -I -F 'useHookStats' HEAD | grep -v 'apps/web/src/hooks/use-hooks.ts'` → 空(即 `use-hooks.ts:276 useHookStats` 已写好但**无人调用**,又是一例"造好没装车",但它只含 total/success/failed/avgDuration,不含票面要求的五态与来源)。
5. 唯一存在过的 source 枚举在**另一套 hook 体系**(CLI),且只有 2/5 值 —— `git grep -n -I -E "source: *'(admin|user|project|plugin|session)'" HEAD` → `apps/cli/src/hooks/index.ts:237:  source: 'project' | 'user',`(与 REST `/api/hooks`、`core/hook_runtime.py` 无交集)。

已落件 / 还欠件:无票面实现物。欠:票面自证列出的数据面①②③ 三层全部未立项未实现。
落点建议(顺序即依赖,①② 未落地前 ③ 不得开工 —— 票面已钉):
- ① `packages/types/src/hooks.ts` 增 `export type HookSource = 'admin'|'user'|'project'|'plugin'|'session'`,`Hook` / `CreateHookInput` / `HookLog` 各带 `source`,`HookStats` 增 `blocked`;
- ② 持久化面:`packages/database/src/schema/` 新增 hooks/hook_logs 表(实测 `git grep -n -I -E "pgTable\('(hooks|hook_logs)'" HEAD -- packages/database/src` 零命中 —— 当前 hooks 存储不在 drizzle schema 里,**必须先定位真实落点**再改,不得盲建表),并在 `apps/api/src/services/hooks-service.ts` 与 `apps/ai-service/app/routers/hooks.py` 读写 source + `blocked`;
- ②' blocked 计数唯一来源是 `apps/ai-service/app/core/hook_runtime.py` 的 `denial_reason`,需由执行器回传给 ① 的存储(此步必须先做"聚合对象是哪套 / 跨两套还是分卡"的架构决策,票面二探已禁止各写一份 stats);
- ③ 卡片:五态 + 来源枚举渲染在 `apps/web/src/components/hooks/hooks-manager.tsx`(纯展示,取词走 `packages/i18n` + `@ihui/shared` 词包,§3 共享层优先;禁止在端内再拼一份措辞),折叠进活动条不抢主流程。
验收命令:`pnpm --filter @ihui/types typecheck && pnpm --filter @ihui/api typecheck && pnpm --filter @ihui/api test` + `cd apps/ai-service && python -m pytest tests/test_hooks.py tests/test_hook_engine.py -q`(数据面①②);卡片再补 `pnpm --filter @ihui/web test`。

---

### O13 B-部分开工

一句话结论:票面两半都有真实落地件——"按 catalog data-class 重新落地"已是可运行的数据闸 + owner RLS 全套(含迁移、开关工具、CI、三个 o4 测试),`roleId >= 1` 收敛也已集中化并清掉了台账点名的两处本地重定义;但 **RLS 尚未 ENABLE**,且 `app.user_id` 仍只写在超级用户池,故隔离在生产语义上尚未生效。

证据(命令 → 输出片段):

1. data-class catalog 在库 —— `git grep -n -I -F 'DB_MODE_BY_DATA_CLASS' HEAD -- apps packages`
   ```
   HEAD:packages/types/src/capability-catalog.ts:80:export const DB_MODE_BY_DATA_CLASS: Record<CapabilityDataClass, DbAccessMode> = {
   HEAD:apps/api/src/utils/scoped-guard.ts:186:  return DB_MODE_BY_DATA_CLASS[effectiveDataClass(capability)]
   ```
2. 受控出口已装车(不是孤立模块) —— `git grep -l -I -E 'dbScoped|dbReadScoped' HEAD -- apps packages`
   ```
   apps/api/src/db/index.ts   apps/api/src/routes/v1-ai-core.ts   apps/api/src/routes/developer/webhooks.ts
   apps/api/tests/o4-data-scope-gate.test.ts   apps/api/tests/o4-isolation-proof.test.ts   apps/api/tests/o4-route-wiring.test.ts
   ```
   定义见 `HEAD:apps/api/src/db/index.ts:193 export const dbScoped: Database = createScopedDb<Database>(…)`。
3. owner RLS 迁移自署 O13 并**写明不 ENABLE** —— `git show HEAD:packages/database/drizzle/20260921160000_scoped_app_role_owner_rls.sql | sed -n '6,26p'`
   ```
   -- O13(2026-09-21):给「受控出口」一条**非超级用户**的连接 + owner 维度行级策略
   -- ⚠️ 本迁移**不执行** `ENABLE ROW LEVEL SECURITY` —— 不是忘了,是现在开了必然把端点打死:
   --   前置 P1:策略读的是 `app.user_id` 会话变量,而它目前只写在**主(superuser)池**
   ```
   交叉验证:`git grep -n -I -F 'ENABLE ROW LEVEL SECURITY' HEAD` 在 `packages/database/drizzle/` 下**零命中**,只出现在 `packages/database/scripts/owner-rls.mjs:86 enableSqlOf()` 与 docs;
   池侧欠项复现:`git grep -n -I -E "import \{ db \}" HEAD -- apps/api/src/plugins/rls-context.ts` → `35:import { db } from '../db/index.js'`(set_config 只作用于主池)。
4. `roleId >= 1` 收敛半 —— `git grep -n -I -E 'export (const|function) (requireAdmin|isSystemAdmin)' HEAD -- apps/api/src/plugins/require-permission.ts`
   ```
   58:export function isSystemAdmin(request: FastifyRequest, policy: AdminChannelPolicy): boolean {
   152:export const requireAdmin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
   ```
   台账点名的两处本地重定义已消失:`git grep -n -I -E 'const requireAdmin|function requireAdmin' HEAD -- apps/api/src` 仅返回上述集中定义两行(无 `earnings-routes.ts` / `security.ts`)。
5. CI 承载在位:`git ls-tree` → `.github/workflows/db-owner-rls.yml`;台账自身仍把 O13b 第二段标为 `- [ ]（进行中）`(`git show HEAD:PROJECT_PLAN.md` 内多处)。

已落件:catalog(data-class → DB 访问模式)+ 数据闸 `scoped-guard.ts`(三类 errorCode、拿不到表名默认拒绝)+ 受控出口 `dbScoped/dbReadScoped` 及 4 个调用文件 + 3 个 o4 测试;应用角色与 owner 策略迁移 20260921160000;`owner-rls.mjs`(status/enable/disable,enable 带前置断言与 `--apply` 两段式);`db-owner-rls.yml`;`isSystemAdmin`/`requireAdmin` 集中化(且两处重复定义已删)。
还欠件:①`ENABLE ROW LEVEL SECURITY` 未执行(策略写了 ≠ 生效);②`rls-context` 未把 `app.user_id` 落到受控出口所用的应用池——这是迁移头注自列的前置 P1;③部署机 `ALTER ROLE ihui_app PASSWORD` + 配 `DATABASE_APP_URL`(生产侧动作);④O13b 剩余四小项:34 个白名单文件逐迁并删条目、`internalUserRoleId` 通道并入同一封装补提权断言、守门第 53 项升 blocking、`admin.ts:124` 统一 preHandler 收编(台账 L5616 还登记了 `idor-guard.ts` 的 `ADMIN_ROLE_ID` 归一为独立票)。
落点建议:②是唯一需要写码的欠项,且必须落在既有单点而非新加第二处:`apps/api/src/plugins/rls-context.ts`(改为对受控出口所在的 app 池 `set_config`,或与 `db/index.ts:193` 的 `createScopedDb` 同一层提供 `withScopedContext`)+ 用 `packages/database/scripts/owner-rls.mjs enable --apply` 做开关;①③ 属运维窗口动作,④ 属 `apps/api/src/plugins/require-permission.ts` 与白名单清单文件的机械收敛(不得在路由里再写第三种判定)。
验收命令:`node packages/database/scripts/owner-rls.mjs status`(看 enable 门槛是否已过)、`pnpm --filter @ihui/api test -- o4-data-scope-gate o4-isolation-proof o4-route-wiring`、`pnpm --filter @ihui/database typecheck && pnpm --filter @ihui/types typecheck`。

---

### O59 B-部分开工

一句话结论:本票点名的实现物(接线核对 + 只读巡检门)在 HEAD 齐备且**票面自述的实测数值我今天原样复现**;但它记的是"D48 加密生效缺正面证据"这一欠项,欠项本身未闭合,所以既不能当作"已入库该翻勾",也不是"未开工"。

证据(命令 → 输出片段):

1. 接线核对(票面"经核属实"复现)—— `git grep -n -I -E "createChatPersistStorage|name: 'ihui-chat'" HEAD -- apps/web/src/stores/chat.ts`
   ```
   9:import { createChatPersistStorage } from '@/lib/chat-persist-crypto'
   1430:      name: 'ihui-chat',      1433:      storage: createChatPersistStorage(ssrStorage),
   ```
2. 门在位、入口在位、且是 warn-only 不进提交链 —— `git grep -n -I -F 'check:desktop-cache-plaintext' HEAD -- package.json` → `75:    "check:desktop-cache-plaintext": "node scripts/check-desktop-cache-plaintext.mjs",`;`git show HEAD:package.json | grep -c 'desktop-cache-plaintext'` 在 `check:all`(第 71 行)串里为 0 命中 ⇒ 与票面"刻意定级 warn 不挂提交链"一致。
3. 该门逻辑自测绿 —— `node --test scripts/tests/check-desktop-cache-plaintext.test.mjs` → `tests 12 / pass 12 / fail 0`。
4. 判据在盘上仍红(票面数值原样复现,含"0 处 ihuiVaultV1"这一侧)—— `node scripts/check-desktop-cache-plaintext.mjs`
   ```
   [desktop-cache-plaintext] 状态: violations
     ✗ 明文 persist 记录: ihui-chat @ 000003.log (local-storage)   ← 2 条
     ✗ CJK 明文命中(utf16 字节形态)×11: …\appdata-local-com.ihui.desktop\EBWebView\Default\Local Storage\leveldb\000003.log   EXIT=1
   ```
   输出里 `records: ihui-chat:plain( persist 值以 {"state" 明文形态落盘)` 与 `实扫文件清单(9 个)` 均按票面要求打印;路径经 junction 解析到 `G:\DevEnv\cache\userhome\…`(与 §26"禁写死盘符"一致)。

已落件:巡检门 + 镜像测试 + `pnpm` 入口 + 归属登记(本票本身)。
还欠件:解阻判据未成立 —— 桌面端在改造后从未于本机跑过登录并产生会话持久化,故无 `ihuiVaultV1` 正面证据,盘上是改造前残留明文(不是反证,但也不是通过)。
落点建议:无代码落点(改动会重做 D48 已交付的东西)。需要的是**一次带运行条件的取证 + 一条回写结论**:桌面端登录 → 产生会话持久化 → 复跑该门 → 把结论登记回 `PROJECT_PLAN.md` 本条(§1 唯一台账,不得新建文件)。若那台机确实没有登录条件,应把"本机不可判"如实写成本票状态,而不是让门继续红着无人认领。
验收命令:`pnpm check:desktop-cache-plaintext`(须 exit 0,且实扫清单里 `000003.log` 的 records 从 `ihui-chat:plain` 变为信封形态、CJK 命中归零)。

---

## 汇总

| 票号 | 判定 | 一句话 |
| ---- | ---- | ------ |
| D15 | C | GitHub App webhook PR review + @机器人 全链在库已注册已测,应翻勾 |
| D31 | A | 零实现;figma 命中全是营销文案 + 假数据目录条目 + logo,无 Figma 数据模型解析 |
| D48 | B | 加密三件套 + 接线 + 15 例离线绿 + 门 12 例绿;欠"盘上密文正面证据"(=O59⑤) |
| D69 | B | ①③ 文案族五语言齐、③ 已装车;① 组件造好未渲染、② 整族缺失、④ 缺两条上限逐项 |
| D86 | A | source 五枚举与 blocked 计数三层全无,卡片无;台账第 66 轮自证三条我逐条复现成立 |
| O13 | B | data-class 数据闸 + owner RLS 迁移已落地可测,`roleId>=1` 已集中化;RLS 未 ENABLE、app.user_id 未落到应用池 |
| O59 | B | 票面实测今日原样复现(门 exit 1);欠项是运行条件取证,非代码 |

## 没查透 / 未尽事项(如实登记)

- **D15**:未实际跑 `pnpm --filter @ihui/api test -- github-app-webhook`(只做了静态接线 + 测试清单取证);也未逐行读 `apps/ai-service/tests/test_review_pr_github.py`,即 Python 侧那半的评审实现是"存在但未读明",不影响 C 的判定(REST 侧接线已足)。
- **D69**:④ 的 enforcement 点我只证到"文案键在库",未逐行确认 `maxAttachmentsReached` / `imageMaxSize` 在聊天输入区(而非 `ai-generation` 等其他域)被真的消费;"速记"族我按中文字面 + 3 种英文键名探测均为 0,但未穷举所有可能命名(如 `scratch`/`note` 族)。②的判定基于"键 + 中文措辞 + 两个 handler 无失败分支"三向探测,未逐文件读完 model 选择器组件树。
- **D86**:未定位 hooks 的**真实持久化落点**(`pgTable('hooks')` 在 `packages/database/src` 零命中,存储可能在 JSON store 或 api 侧别处),因此"落点建议②"里给的是"先定位再改",而非确定文件行。
- **O13**:未跑 `owner-rls.mjs status`(需要数据库连接,本机无 PG 端口在听,§5b 实测),故"enable 门槛当前差哪几条"是从迁移头注与脚本头注读出来的,不是量出来的;白名单 34 文件的剩余条数未逐一目视核对。
- 7 张票全部给出判定,无 `U-未判定` 项。工具调用 40 次(上限 45),收尾于报告落地。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
