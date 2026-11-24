<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# batch-5 对账报告(HEAD 实现面,只读)

取证基准:`git rev-parse --short HEAD` → `ae703ea1811`。所有判定一律判 HEAD blob,未使用工作区文件。
命令前缀统一 `git -c safe.directory=*`,在 `G:\IHUI-AI` 下执行。

---

### D16 B-部分开工

一句话结论:分类器已真接进生产链路,但票面点名的"成本感知选模 + 预算降级"两条只作为库函数存在,**全仓无任何非测试调用点**,实时路由实际只用了复杂度分档跳池。

证据(命令 → 输出片段):

1. 路由件在库且含三块能力:
   `git show HEAD:apps/ai-service/app/services/model_router.py | grep -n -E "^class |budget_usd|max_price|estimated_cost"`
   ```
   53:@dataclass
   54:class RoutingDecision:
   60:    estimated_cost: float = 0.0  # 美元
   61:    # 预算降级(D16 ③)回显:调用方据此决定是否提示用户/是否放行,
   63:    budget_usd: float | None = None
   96:        TaskComplexity.TRIVIAL: {"min_reasoning": 1, "prefer_speed": True, "max_price": 0.5},
   ```
2. 唯一生产调用点只取复杂度,不调 route():
   `git show HEAD:apps/ai-service/app/core/llm_gateway.py | sed -n '1036,1052p'`
   ```
            from ..services.model_router import TaskComplexity, model_router
            complexity = model_router.assess_complexity(
                prompt=prompt_text[:20000],  # 截断避免超大 prompt 评估开销
   ```
3. `assess_complexity` 的消费者只有一个生产点(其余为定义自身与测试):
   `git grep -n -I -F "assess_complexity" HEAD -- apps`
   ```
   HEAD:apps/ai-service/app/core/llm_gateway.py:1043:            complexity = model_router.assess_complexity(
   HEAD:apps/ai-service/app/services/model_router.py:112:    def assess_complexity(
   ```
4. 成本感知/预算入口零非测试调用:
   `git grep -n -I -E "model_router\.route|route_live|from_catalog|budget_usd" HEAD -- apps packages | grep -v -E "tests/|model_router.py"`
   → 输出仅剩 FastAPI `server.route({` 与 Playwright `page.route(` 同名词形(`admin-saas-proxy.ts:88`、`e2e/*.spec.ts` 等),**无一处 ModelRouter 调用**。
5. 测试面确实覆盖预算语义(说明是"写好了没装车",不是"没写"):
   `git grep -c -I -E "budget" HEAD -- apps/ai-service/tests/test_model_router.py` → `HEAD:apps/ai-service/tests/test_model_router.py:21`

已落件 / 还欠件:

- 已落:任务类型/复杂度分类器(`assess_complexity` + 五档 `TaskComplexity`)、能力矩阵与 catalog 接入(`from_catalog`/`_load_catalog`)、每档成本上限 `max_price`、`estimated_cost` 成本估算、`budget_usd` + `budget_exceeded` 降级回显、`tests/test_model_router.py`、llm_gateway 侧"复杂/专家跳高级模型"的接线。
- 还欠:① 成本感知选模未在请求路径生效(gateway 自己排 free/cheap/premium 候选池,没有走 `route()` 的价格择优);② 预算降级没有任何上游把 `budget_usd` 喂进来(全仓无非测试传参点),即票面"预算降级"对真实用户不可达;③ 分类器实例是模块级 `ModelRouter()` 默认注册表,`from_catalog()` 无调用方,即"实时模型目录"也未接入。

落点建议(共享层优先:判定层已在 `packages`/`app/services`,不得在端内另写一套):

- `apps/ai-service/app/core/llm_gateway.py`(约 1020-1060 段候选构造处):把候选池决策改为调 `model_router.route(...)`(或 `route_live()`),用返回的 `selected_model/estimated_cost/budget_exceeded` 落 `RoutingDecision`;`budget_usd` 从请求上下文透传。
- `apps/api` 侧调用 ai-service 的推理入口(与 `ai-callback`/`llm` 同链路):补一个预算字段并向下透传,否则 ② 永远无源。
- `apps/ai-service/app/services/model_router.py`:把 `assess_complexity` 的单点用法收进 `route()` 内部(第 182 行已在 route 里调用),避免 gateway 与 route 两套决策并存。

验收命令:

- `cd apps/ai-service && python -m pytest tests/test_model_router.py -q`(现有 21 处预算断言仍须全绿)
- 装车证明(必须新增,当前为 0):`git grep -n -I -E "\.route\(|route_live\(" HEAD -- apps/ai-service/app | grep -v services/model_router.py` 应非空
- `cd apps/ai-service && mypy app --ignore-missing-imports --strict`

---

### D33 B-部分开工

一句话结论:票面"HEAD 级九类矩阵 7/9 闭环"这一条**经符号级复核成立**(不是幽灵登记),但票面验收要求的"九类"确实只差 `queueItems`(全仓零痕迹)与 `subagentActivities`(仅内存事件态、无落库通道),主行不勾是对的。

证据(命令 → 输出片段):

1. 符号面计数(逐类):
   `for t in steerApplied queueItems subagentActivities capMetadataObject readCompactionFromMetadata persistedSteerAppliedSchema readSteerAppliedFromMetadata; do ... git grep -c -I -F "$t" HEAD -- apps packages; done`
   ```
   steerApplied: 56
   queueItems: 0
   subagentActivities: 22
   capMetadataObject: 4
   persistedSteerAppliedSchema: 4
   readSteerAppliedFromMetadata: 38
   ```
   `queueItems` 换四种命名形态再测:`queue_items` → 0、`queuedItems` → 7(另一语义,非 metadata 类)、`queueState` → 22(队列 UI 态,非落库)。票面"数据面全仓零痕迹"成立。
2. 落库端七类 schema 真在(不是注释):
   `git show HEAD:apps/api/src/routes/ai-callback.ts | grep -n -E "persisted.*Schema = |planSteps:|citations:|usageDetail:|steerApplied:"`
   ```
   57:const persistedPlanStepSchema = z.looseObject({
   67:const persistedCitationSchema = z.looseObject({
   101:const persistedUsageDetailSchema = z.looseObject({
   126:const persistedSteerAppliedSchema = z.array(
   164:  planSteps: z.array(persistedPlanStepSchema).optional(),
   175:  steerApplied: persistedSteerAppliedSchema.optional(),
   ```
3. 读回端七类真在并被 hydrate 使用:
   `git show HEAD:apps/web/src/hooks/use-chat/history-message.ts | grep -n -E "function read.*FromMetadata|planSteps: read|citations: read|compaction: read|fallback: read"`
   ```
   36:function readPlanStepsFromMetadata(raw: unknown): PlanStep[] | undefined {
   101:function readCompactionFromMetadata(raw: unknown): ChatMessage['compaction'] {
   277:    planSteps: readPlanStepsFromMetadata(meta?.planSteps),
   287:    compaction: readCompactionFromMetadata(meta?.compaction),
   ```
4. 发送端三端同源:`git grep -l -I -F "steerApplied" HEAD -- apps packages` → `apps/ai-service/app/routers/llm.py`、`apps/api/src/routes/ai-callback.ts`、`apps/web/src/hooks/use-chat/history-message.ts` 同时在列。
5. `subagentActivities` 的 22 处**全部是内存/渲染面**,无 api 落库点:
   `git grep -n -I -F "subagentActivities" HEAD -- apps packages | head`
   ```
   HEAD:apps/web/src/stores/chat.ts:842:                  subagentActivities: [...(target.subagentActivities ?? []), newActivity],
   HEAD:apps/web/src/components/chat/message-list/MessageItem.tsx:1040:                      activities={m.subagentActivities}
   HEAD:packages/types/src/chat.ts:116:  subagentActivities?: SubAgentActivity[]
   ```
   (对照:同一清单里 `apps/api/src/routes/ai-callback.ts` 只出现在 `steerApplied` 命中面,`subagentActivities` 命中文件清单**零 `apps/api`** ⇒ 未进 metadata schema,与票面"摘要落库禁两套"一致。)

已落件 / 还欠件:

- 已落:planSteps / citations / compaction / usageDetail / fallback / memoryUpdates / steerApplied 七类的 llm.py 发送 → ai-callback.ts zod 落库 → history-message.ts 读回三端链路;体积护栏 `capMetadataObject`。
- 还欠:`queueItems` 需先在 ai-service 侧立数据面(`_fire_callback` 无该产出);`subagentActivities` 摘要落库形状待 D40③ 裁定;票面验收"逐类 9 断言 / 九类空值不写 key"目前只能是七类。

落点建议:保持票面原计划(`apps/ai-service/app/routers/llm.py` `_fire_callback` 扩参 → `apps/api/src/routes/ai-callback.ts` schema → `apps/web/src/hooks/use-chat/history-message.ts` 读回),不得新表、不得在端内另建第二套 metadata 解析。

验收命令:

- `pnpm --filter @ihui/api test tests/ai-callback` (票面自述 7 files/47 tests)
- `pnpm --filter @ihui/web test -- d33-usage-fallback-rehydration`
- `git grep -c -I -F "queueItems" HEAD -- apps packages` 由 0 转正才算 ① 开工

---

### D50 A-确未开工

一句话结论:① 多端遥控配对与 ② 每会话浏览器 Tab 状态在 HEAD **都找不到实现物**;票面点名的两个对标名字全仓只以"对照台账字符串"形态出现一次。③ WorkBuddy 取证属另一台机器的取证动作,HEAD 上无从判定(不写结论)。

证据(命令 → 输出片段):

1. 票面点名符号逐个测(含 camel/snake 变体):
   `for t in remote_control_enrollments remoteControlEnrollment thread-tab-routes threadTabRoutes tabRoutes tab_routes; do ...; done`
   ```
   remote_control_enrollments -> 0
   remoteControlEnrollment -> 0
   thread-tab-routes -> 1
   threadTabRoutes -> 0
   tabRoutes -> 0
   tab_routes -> 0
   ```
2. 那唯一 1 处命中不是实现物,是对账数据里的**条目名字**:
   `git grep -n -I -F "thread-tab-routes" HEAD -- apps packages sdks scripts`
   ```
   HEAD:scripts/data/chat-element-coverage.json:634:      "name": "每会话浏览器Tab(thread-tab-routes-v1全URL,可开关)",
   ```
   `会话浏览器` 同一条命中(同文件同行),即全仓零第二处。
3. 建表面不存在:`git ls-tree -r --name-only HEAD | grep -i -E "(remote.?control|tab.?route|enrollment)"` → 只有 `apps/web/app/(main)/edu/edu-management/enrollment/page.tsx` 与 `packages/database/drizzle/0210_enrollment_batch6.sql`(教育"选课"语义,与设备配对无关)。`git grep -n -I -F "remote_control" HEAD -- packages/database` 零命中。
4. 名字最接近的现成件是**另一个域**:`git show HEAD:apps/api/src/routes/remote-device.ts`(前 20 行)
   ```
    * 远程设备任务管理路由 (迁移自旧架构 Java RemoteDeviceByTaskController)。
    * - POST   /remote-devices/:id/tasks    — 下发任务
   ```
   是 IoT 设备任务台账,不承载"手机看/接管桌面在跑会话"。
5. "接管"字样 91 处、`遥控` 4 处全部是**指向本票的前向引用注释**,不是实现:
   `git grep -n -I -F "遥控" HEAD -- apps packages | head -4`
   ```
   HEAD:packages/shared/src/chat/cloud-chat-ops.ts:11:// **与 D50 多端遥控合并设计,不另建第二套传输**(台账 D97 明文):
   HEAD:apps/web/src/components/ai/cloud-chat-ops-card.tsx:11:// 本组件不发起任何传输调用 —— 跨端操作复用 D50 多端遥控的既有通道
   ```
   (第二条注释宣称"复用既有通道",而上面测得该通道不存在 ⇒ 属注释先行,不计开工。)
6. 每会话 Tab 状态面测空:`for t in browser-tab browserTab tab-store useBrowserTabs; do ... done` → 全 0;`git ls-tree -r --name-only HEAD | grep -i -E "browser.*(tab|route)"` → 仅 `apps/extension/lib/browser-tab.ts`(扩展自身的活动标签页工具,无会话维度持久化)。`git grep -n -I -E "(tabs|Tabs)" HEAD -- apps/web/src/components/ai/work-panel.tsx` 零输出(该路径在 HEAD 无此文件)。

落点建议(遵守共享层优先:投递/载荷类型沉 `packages/shared`,端内只做挂载):

- ① 数据面:`packages/database/src/schema/*` 新增 enrollments 表 + `packages/database/drizzle/*.sql`(须同步 journal,受守门 49 记账结构校验)+ 路由 `apps/api/src/routes/*`(鉴权按 §5"显式列举",不得用 `/api/x/[^/]+` 兜底正则);投递层载荷沿用 `packages/shared/src/chat/cloud-chat-ops.ts` 的 `CloudChatOpEntry`(注释已声明它是唯一载荷类型)。
- ② 状态面:先确认落点属 `packages/shared/src/chat/*`(跨端可复用则共享优先),再在 `apps/web` 工作面板宿主挂载;存储键须进 `packages/shared/src/constants/` 而非端内硬编码。
- ③ WorkBuddy 取证:非代码项,HEAD 不可判;若要推进需按票面 E1/E2 升格流程在装有本体的机器上取包体。

验收命令:

- `git grep -c -I -F "remote_control_enrollments" HEAD -- packages/database` 由 0 转正
- `pnpm --filter @ihui/database build` + `node scripts/check-migration-bookkeeping.mjs`(离线 B1-B5;本机无 PG 端口,`--db` 模式不可用,须明写)
- `pnpm --filter @ihui/api typecheck`

---

### D73 B-部分开工

一句话结论:分屏三件套(共享判定层 `packages/shared/src/chat/multi-pane.ts` + 端内 store + 容器组件 + 两侧测试)**确实在 HEAD**,但 `PaneSplitContainer` 的生产消费点为 **0**,测试文件自己就把这件事写在了注释里 —— 属"造好没装车",用户侧不可见。

证据(命令 → 输出片段):

1. 判定层在库且有专测:
   `git ls-tree -r --name-only HEAD | grep -i -E "pane"`
   ```
   packages/shared/src/chat/__tests__/multi-pane.test.ts
   packages/shared/src/chat/multi-pane.ts
   ```
2. 端内 store 确实 import 共享层(未端内重实现):
   `git show HEAD:apps/web/src/stores/pane-split.ts | sed -n '24,40p'`
   ```
   import {
     type ForkFailureReason,
     ROOT_PANE_ID,
     closePaneInLayout,
     dropConversationToPane,
     splitPane,
   } from '@ihui/shared/chat/multi-pane'
   ```
3. 票面列的四项能力 + D22 拖拽通道 + Fork 失败提示都在容器里:
   `git show HEAD:apps/web/src/components/ai/pane-split-container.tsx | grep -n -E "splitPane\(node.id|data-action=|x-ihui-conversation|forkFailureView|联动"`
   ```
   13:// 本空窗格只接受 `application/x-ihui-conversation`(与
   262:              onClick={() => splitPane(node.id, 'right', null)}
   271:              onClick={() => splitPane(node.id, 'down', null)}
   282:            data-action="maximize"
   292:            data-action="restore"
   ```
   `git show HEAD:apps/web/src/stores/pane-split.ts | grep -n "联动"` → `50:  /** 联动调整:delta>0 扩大该窗格,相邻窗格等量吸收(判定层钳制) */`
4. **零宿主挂载**(本判定的核心):
   `git grep -n -I -F "PaneSplitContainer" HEAD -- apps packages | grep -v "pane-split-container.tsx"` → 命中文件只有 `apps/web/src/components/ai/__tests__/pane-split-container.test.tsx`,且其头注自证:
   ```
   HEAD:apps/web/src/components/ai/__tests__/pane-split-container.test.tsx:7:// **自证结论**:本文件是 PaneSplitContainer 的**唯一消费点**(宿主挂载由主 agent
   ```
5. 票面点名"落在既有 ai-side-panel + work-panel 之上"未发生:`git grep -n -I -E "<AiSidePanel|<WorkPanel" HEAD -- apps/web | head -8` 输出里只有 `ai-side-panel.tsx:1355: <AiSidePanelTools />` 与 `web-work-panel.tsx`,无任何 pane 组件;`git grep -n -I -F "pane-split" HEAD -- apps packages | grep -v __tests__`
   ```
   HEAD:apps/web/src/components/ai/pane-split-container.tsx:41:import { usePaneSplitStore } from '@/stores/pane-split'
   HEAD:apps/web/src/components/ai/pane-split-container.tsx:76:      data-pane-split-root=""
   ```
   (两条都在容器自身文件内 ⇒ 无外部 import。)
6. `forkConversation`(票面 Fork 语义的字面标识)`-> 0`,实际实现名为 `onForkConversation`/`forkFailureView`,已在第 3 条证据中确认存在 —— 计已落,不计缺失。

已落件 / 还欠件:

- 已落:窗格树判定层(split/close/maximize/restore/resize/drop 六操作)及其专测、端内 zustand store(含 `forkFailures` 渲染态)、容器组件(向右/向下拆分、最大化还原、联动调宽、空窗格 D22 通道拖入、Fork 失败显式渲染、键盘 `paneResizeKeyDelta` 调宽)、12 例以上组件测试。
- 还欠:宿主挂载 —— 没有任何页面/面板渲染 `PaneSplitContainer`,票面验收"拆分/拖入/Fork 失败三用例"目前只在 jsdom 层成立,真实交互链路(会话在窗格里承载)不存在;`application/x-ihui-conversation` 的 dragstart 侧(`sidebar-chat-history`)与宿主 drop 后**实际打开会话**的闭环也未接线(`dropConversation` 仅改树,`renderPaneContent` 无生产调用方)。

落点建议:

- `apps/web/src/components/chat/*`(或 `apps/web/app/(main)/ai/*` 的 PageClient):把 AI 会话区改为渲染 `PaneSplitContainer` 并传 `renderPaneContent`(复用既有会话面板,禁止新建第二套会话承载体系,与票面 D52/D68 协同一致)。
- `apps/web/src/components/ai/ai-side-panel.tsx`:作为窗格内容宿主之一被 `renderPaneContent` 取用,同时提供 `onForkConversation` 返回失败原因字符串。
- 侧栏 `sidebar-chat-history` 的 dragstart 已在库(容器注释引用同键),接入后须验证 types 含 `application/x-ihui-conversation`。

验收命令:

- `node --test packages/shared/src/chat/__tests__/multi-pane.test.ts`
- `pnpm --filter @ihui/web test -- pane-split-container`
- 装车证明(当前必红):`git grep -n -I -F "PaneSplitContainer" HEAD -- apps packages | grep -v __tests__ | grep -v "pane-split-container.tsx"` 应非空
- `pnpm --filter @ihui/web typecheck`

---

### D90 C-已在库该翻勾

一句话结论:四级降级文案 + "文件已更新"提示条(含刷新与关闭)+ "历史快照"明示 + 五语言词表 + L1–L4 用例在 HEAD **完整存在且被生产页面渲染**,挂 `- [ ]` 属台账漂移。

证据(命令 → 输出片段):

1. 实现物四个文件都在 HEAD:
   `git ls-tree -r --name-only HEAD -- apps/web/src/components/media | grep -i degradation|staleness`
   ```
   apps/web/src/components/media/preview-degradation-banner.tsx
   apps/web/src/components/media/preview-degradation-copy.ts
   apps/web/src/components/media/use-preview-staleness.ts
   apps/web/src/components/media/__tests__/file-preview-degradation.test.tsx
   ```
2. 票面四级文案逐字命中(含"无法读取当前文件…"):
   `git grep -n -I -F "无法读取当前文件" HEAD -- apps packages sdks scripts`
   ```
   HEAD:apps/web/src/components/media/preview-degradation-copy.ts:1
   HEAD:packages/i18n/messages/shared/zh-CN.json:1
   ```
   `git show HEAD:apps/web/src/components/media/preview-degradation-copy.ts | sed -n '41,56p'`
   ```
   previewSnapshotNotice: { zh: '无法读取当前文件，已展示工具记录中的内容。', … },
   previewIncompleteChange: { zh: '这次文件变更没有记录完整内容。', … },
   previewNoContent: { zh: '没有可预览内容。', en: 'Nothing to preview.' },
   ```
3. `文件已更新` + 刷新 + 关闭三件齐:
   `git grep -c -I -F "文件已更新" HEAD -- apps packages`(banner/copy/use-preview-staleness/zh-CN.json 各 1-2 处)
   `git show HEAD:apps/web/src/components/media/preview-degradation-banner.tsx | grep -n -E "^export function|closeLabel|refreshLabel"`
   ```
   39:export function PreviewSnapshotNotice({
   84:export function PreviewNoContentState({
   115:export function PreviewFileUpdatedBar({
   137:          <Tooltip content={closeLabel}>
   138:            <Button size="icon-2xs" variant="ghost" aria-label={closeLabel} onClick={onDismiss}>
   ```
   禁用原生弹窗合规(走 `Tooltip`,符合 §4)。
4. **渲染消费点**(非注释、非测试)在两个真实路由页:
   `git grep -n -I -E "<FilePreview" HEAD -- apps/web | grep -v __tests__`
   ```
   HEAD:apps/web/app/(main)/admin/oss/files/OssFileDialog.tsx:30:            <FilePreview url={file.url} name={file.fileName} className="max-h-[60vh]" />
   HEAD:apps/web/app/(main)/workspace/[id]/PreviewDialog.tsx:38:            <FilePreview url={preview.url} name={preview.file.name} className="max-h-[60vh]" />
   ```
   且组件内确实 import 降级件:
   `git show HEAD:apps/web/src/components/media/FilePreview.tsx | grep -n -E "preview-degradation-banner|use-preview-staleness"`
   ```
   28:} from './preview-degradation-banner'
   29:import { usePreviewMediaProbe, usePreviewTextFeed } from './use-preview-staleness'
   ```
5. 票面"断言降级时明确告知是历史快照"有专测:
   `git show HEAD:apps/web/src/components/media/__tests__/file-preview-degradation.test.tsx | grep -n "it("`
   ```
   107:  it('L1+L2:重读失败时留住已记录内容,并明说看到的是工具记录里的历史快照', …
   129:  it('L3:重读到 0 字节(这次变更没记全)时保留旧记录并说明不完整', …
   141:  it('L4:首读就取不到内容时不摆空白框,给"没有可预览内容 + 刷新"这一步动作', …
   181:  it('文件已更新:提示可关闭,关掉后提示条消失但快照标识保留', …
   ```
6. 五语言词表齐(`previewSnapshotNotice` 逐语言各 1 命中):
   `for l in en ja ko zh-TW zh-CN; do git grep -c -I -F "previewSnapshotNotice" HEAD -- packages/i18n/messages/shared/$l.json; done` → 全为 1。

唯一需说明的偏差(不影响判定):票面 D33 段里"与 D33 同批"的措辞暗示依赖工具记录落库面,而 HEAD 的降级依据是 `use-preview-staleness` 的探测/记录读取,链路自洽;`FilePreview` 目前只挂在 oss 文件与工作区预览两处,聊天侧工件预览(`message-file-preview.tsx` / `UnifiedViewer`)虽 import 了同一 banner(`git grep -n -I -F "preview-degradation-banner" HEAD` → `UnifiedViewer.tsx:21`),但 `UnifiedViewer` 自身在 HEAD 无非测试渲染点 —— 若要覆盖"聊天里看到历史快照"这一子场景,需另接宿主。验收命令:`pnpm --filter @ihui/web test -- file-preview-degradation`。

---

### O13b B-部分开工

一句话结论:五条可核算项里 ②③④⑤ **全部在 HEAD 有实据**,① 已从登记的 34 文件收敛到 **1 文件 / 1 处**且该处写明不收敛的技术理由(属独立重构票),票面"另:"的 `DATABASE_APP_URL` 与 RLS 代码侧也已在库,只剩部署机 `ALTER ROLE` 这类机器动作(HEAD 不可判)。

证据(命令 → 输出片段):

1. ② 两处本地 `requireAdmin` 重定义已删,改为 import:
   `git grep -n -I -E "(function|const) requireAdmin" HEAD -- apps packages`
   ```
   HEAD:apps/api/src/plugins/require-permission.ts:152:export const requireAdmin = async (request: FastifyRequest, reply: FastifyReply)
   HEAD:apps/api/tests/regression/p0-audit-gaps.test.ts:67:function requireAdmin(endpoint: string, role: Role)   ← 测试夹具,不计实现
   ```
   `git grep -n -I -E "requireAdmin" HEAD -- apps/api/src/routes/earnings-routes.ts apps/api/src/routes/security.ts`
   ```
   HEAD:apps/api/src/routes/earnings-routes.ts:29:import { requireAdmin } from '../plugins/require-permission.js'
   HEAD:apps/api/src/routes/security.ts:21:import { requireAdmin } from '../plugins/require-permission.js'
   ```
2. ① 存量台账现值:
   `git show HEAD:scripts/check-admin-gate-consistency.mjs | sed -n '46,66p'`
   ```
    * 存量白名单(2026-09-21 盘点登记 34 文件 / 74 处;… → **1 文件 / 1 处**(仅 idor-guard,理由见表内 reason))。
   export const LEGACY_RAW_ROLEGATE = {
     'apps/api/src/utils/idor-guard.ts': { count: 1, …
   ```
   且第二张表已清零:`export const LEGACY_LOCAL_REQUIREADMIN = {}`(注释:"O13b 试点批已清零…保留空表作后续批次锚点")。
3. ③ internal 通道并入 + 提权断言:
   `git show HEAD:apps/api/src/plugins/require-permission.ts | sed -n '37,48p'`
   ```
    * 系统管理员 roleId 的**唯一读取点**(O13b-③:此前 jwtPayload / internalUserRoleId
    * 双通道的读取语义散落在本文件两处与各路由的裸比较里)。
   export function resolveAdminRoleId(request: FastifyRequest, policy: AdminChannelPolicy): number {
   ```
   `git show HEAD:apps/api/tests/o13b-batch3-admingate-channel.test.ts | grep -n -E "describe\(|it\("`
   ```
   82:describe('O13b-③ internalUserRoleId 通道并入集中封装:提权断言', () => {
   136:  describe('B. requireAdmin(admin 面)对 internal 通道恒拒绝', () => {
   ```
4. ④ 第 53 项确为 blocking:
   `git show HEAD:scripts/guardian-runner.mjs | grep -n -A6 "id: '53'"`
   ```
   1212:    id: '53',
   1213-    label: '🛡️  admin 面特权判定一致性(blocking,O13b roleId>=1 收敛)',
   1214-    script: 'check-admin-gate-consistency.mjs',
   1216-    mode: 'blocking',
   1217-    skipEnv: 'HUSKY_SKIP_ADMIN_GATE_GUARD',
   ```
5. ⑤ admin.ts preHandler 收编:
   `git grep -n -I -E "requireAdminRouteGuard" HEAD -- apps/api/src/routes/admin.ts`
   ```
   HEAD:apps/api/src/routes/admin.ts:8:import { requireAdminRouteGuard } from '../plugins/require-permission.js'
   HEAD:apps/api/src/routes/admin.ts:107:  // O13b-⑤ 已把这段判定收编进 plugins/require-permission.ts 的 requireAdminRouteGuard,
   HEAD:apps/api/src/routes/admin.ts:109:  server.addHook('preHandler', requireAdminRouteGuard)
   ```
   (票面写的 `admin.ts:124` 行号已漂到 107-109;§"按票编号定位,不依赖行号"。)
6. "另:"代码侧在库:`git grep -c -I -F "DATABASE_APP_URL" HEAD -- apps packages scripts deploy` → 26;`git grep -n -I -E "ENABLE ROW LEVEL SECURITY" HEAD -- packages/database | head -3`
   ```
   HEAD:packages/database/drizzle/0066_rls_tenant_isolation.sql:76:ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
   ```
   `apps/api/src/db/index.ts:112 const scopedClient: typeof writerClient | null = config.DATABASE_APP_URL ? …`

已落件 / 还欠件:

- 已落:②③④⑤ 四项;① 收敛到 1 文件 1 处;`DATABASE_APP_URL` 受控出口池 + RLS 迁移已在库。
- 还欠:① 的最后一枚 `apps/api/src/utils/idor-guard.ts`(表内 reason 明确:改引 `plugins/require-permission.js` 会把 auth 链拖进 `@ihui/database` mock 图致 17 例崩,正解是抽无依赖叶子模块统一 `ADMIN_ROLE_ID`,属独立重构票);部署机 `ALTER ROLE ihui_app PASSWORD` + `.env` 配 `DATABASE_APP_URL`(机器侧动作,HEAD 无法判定,本机实测无 PG 监听端口 ⇒ 也不能在本地应用/验证)。

落点建议:

- `apps/api/src/utils/idor-guard.ts` + `apps/api/src/plugins/require-permission.ts`:把 `ADMIN_ROLE_ID` 抽到无依赖叶子模块(如 `packages/auth` 或 `apps/api/src/constants`),两处内联值归一后再迁 idor-guard,删除最后一条台账项;不得为过门把该文件塞进 `CENTRAL_FILES`。
- 部署侧:按票面顺序先 `ALTER ROLE`,再配 `DATABASE_APP_URL`,复测 `apps/api/src/db/index.ts` 的 `scopedClient` 是否真挂上,之后才评估 RLS 扩表。

验收命令:

- `node scripts/check-admin-gate-consistency.mjs`(台账为空表时仍须 exit 0)+ `node --test scripts/tests/check-admin-gate-consistency.test.mjs`
- `pnpm --filter @ihui/api test -- o13b-batch3-admingate-channel o13b-batch4-admin-route-guard o13b-requireadmin-pilot`
- `node scripts/guardian-runner.mjs --staged` 中 id 53 须以 blocking 参与(见第 4 条证据)

---

### WP-1 A-确未开工

一句话结论:新命令策略 API 的两个 yolo 感知入口确实已实现并有专测,但 `builtins.ts` 与 `terminal.ts` 的执行链**仍走旧薄壳 + 裸 `process.env.IHUI_YOLO`**,票面"接一行"这一步在 HEAD 没有发生。

证据(命令 → 输出片段):

1. 新 API 在库:
   `git show HEAD:apps/cli/src/tools/command-policy/evaluate.ts | grep -n -E "^export function"`
   ```
   381:export function evaluateCommand(input: string): CommandAssessment {
   386:export function isAlwaysConfirmCommand(input: string): boolean {
   395:export function isAutoApprovableCommand(input: string, options: { yolo?: boolean } = {}): boolean {
   ```
   且 `command-policy/index.ts:13` 已 re-export 这两个入口。
2. 消费点只有 index 与测试(零执行链):
   `git grep -n -I -E "isAutoApprovableCommand|isAlwaysConfirmCommand" HEAD -- apps packages scripts`
   ```
   HEAD:apps/cli/src/tools/command-policy/evaluate.ts:395:export function isAutoApprovableCommand(…
   HEAD:apps/cli/src/tools/command-policy/index.ts:13:export { evaluateArgv, evaluateCommand, isAlwaysConfirmCommand, isAutoApprovableCommand, normalizeProgram } …
   HEAD:apps/cli/tests/command-policy.test.ts:251:    expect(isAutoApprovableCommand('git push origin main', { yolo: true })).toBe(true)
   ```
   (清单里除定义/re-export 外**只剩测试**⇒ 无生产接线。)
3. 两个执行点仍自己读 env:
   `git show HEAD:apps/cli/src/tools/builtins.ts | sed -n '442,448p'`
   ```
       // 危险命令模式检查:即使 allowDangerous=true 也强制拦截,除非 IHUI_YOLO=1
       const dangerousMatch = matchDangerousCommand(command);
       if (dangerousMatch && !process.env.IHUI_YOLO) {
   ```
   `git show HEAD:apps/cli/src/tools/terminal.ts | sed -n '229,235p'`
   ```
       const dangerousMatch = matchDangerousCommand(command);
       if (dangerousMatch && !process.env.IHUI_YOLO) {
   ```
4. 旧薄壳确实在委托新层(所以"部分接线"的错觉来自 `matchDangerousCommand`,而 yolo 分支没走新层):
   `git show HEAD:apps/cli/src/tools/command-safety.ts | sed -n '6,22p'`
   ```
    * 命令安全护栏 —— 对外签名保持不变的薄壳,内部委托 `command-policy/` 的 argv 结构化求值。
   import { evaluateCommand } from './command-policy/index.js';
   ```
   同时该文件头注自述保留旧语义的理由:
   `HEAD:apps/cli/src/tools/command-safety.ts:13: *      那会顺带改变 IHUI_YOLO 逃生舱的既有拦截面。`
5. 票面提到的"需同步改他人 `terminal.test.ts` 的 `vi.mock`"在 HEAD 未动:
   `git show HEAD:apps/cli/tests/terminal.test.ts | sed -n '138,155p'`
   ```
     origYolo = process.env.IHUI_YOLO;
     delete process.env.IHUI_YOLO;
   …
     if (origYolo !== undefined) process.env.IHUI_YOLO = origYolo;
   ```
   (测试仍在裸 env 保存/还原,与新 API 无关。)

落点建议:

- `apps/cli/src/tools/builtins.ts`(约 442-450 段,`run_command.execute`)与 `apps/cli/src/tools/terminal.ts`(约 229-236 段,`terminal_open.execute`):把 `matchDangerousCommand(...) && !process.env.IHUI_YOLO` + `isReadonlyCommand(...)` 两处换成 `isAutoApprovableCommand(command, { yolo })` / `isAlwaysConfirmCommand(command)`,`yolo` 由配置层(票面注释指向的 `config/yolo.ts` 语义,注意 **HEAD 的 `apps/cli/src/config/` 下没有 yolo.ts**,该注释是悬空指向)注入,不得在两处各写一次 env 读取。
- `apps/cli/tests/terminal.test.ts` 同步改 `vi.mock`,避免真实策略表进入单测。

验收命令:

- `pnpm --filter @ihui/cli test -- command-policy terminal`
- 装车证明(当前必红):`git grep -n -I -E "isAutoApprovableCommand|isAlwaysConfirmCommand" HEAD -- apps/cli/src/tools/builtins.ts apps/cli/src/tools/terminal.ts` 应非空
- `git grep -n -I -F "process.env.IHUI_YOLO" HEAD -- apps/cli/src` 收敛后应只剩配置层一处
- `pnpm --filter @ihui/cli typecheck`

---

## 本批未查透项

- **D50 ③(WorkBuddy 元素级取证)**:票面本身写明"本机四路探测确认无程序本体",需在装有 WorkBuddy 的机器上取包体或跑渲染取证 —— HEAD 上不存在可判定的实现物,也非代码项,**本票未判定**(不计入 A/B/C 的验收面)。
- **O13b "另:" 的部署机 `ALTER ROLE ihui_app PASSWORD`**:机器侧状态,只读审计不查数据库角色;HEAD 能证明的只是 `DATABASE_APP_URL` 与 RLS 迁移的代码面已在库。
- 其余 6 票的三态判定均给出了可复跑命令与逐字输出片段,无留空项。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
