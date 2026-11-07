<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# web 接屏流水线 v1 与 `settings/import` 走查（2026-11-08）

> 基线：`origin/main@6030e87763`；本轮 worktree `D:\IHUI-AI-wt-pipeline`，分支 `feat/cross-end-pipeline-inventory-20261108`。
> 本票不 push；不碰 `packages/app`、`apps/mobile-rn` 源码；不碰 Favorites / Coupon / ApiKeys / Patrol / Groups / RepoWiki / TeamKnowledge 的 web 页。
> 判定面：默认 HEAD blob；`--worktree` 为人工逃生舱；两面同给即 exit 2「未判定」。

## 0. 本轮新增的尺子

| 文件 | 作用 | 判红条件 |
| --- | --- | --- |
| `scripts/web-adopt-shared-screen.mjs` | 输入一条 adopt 候选，读 web 页面族 / RN 壳 / 共享屏，产出「宿主职责 + 注入 props」与补丁草案；不支持形态**拒绝出补丁** | 默认只报；`--diff` 拒绝时 exit 1 |
| `scripts/check-registry-layer-drift.mjs` | advisory ratchet：登记表按路径会把「已委托」读成「自实现」，本门读壳正文把这类行列出 | 默认 **exit 0**；`--gate` 才 exit 1（未来升阻断用） |

两枚均有 `--self-test`：接屏尺 10 条判据，层别尺 4 条正文判据 + 2 条分档断言。

## 1. 接屏脚手架：能力边界

### 1.1 它能处理什么形态

同时满足以下全部条件才出 diff：

1. web 路由族里能定位到**唯一替换单元**（一个导出组件、一个顶层 `return(`）；
2. 共享屏 props 契约可解（本文件接口 + `extends` 基接口，基接口可落在 `packages/types/src`）；
3. 每个 shared prop 都能在宿主**现有状态**里找到同名实体（state / const / function / query 派生），或命中声明过的映射规则（`colorScheme="light"`）；
4. web 调用的领域 API 与领域工具，RN 壳或共享屏**有对等出口**（同一 api-client 导出，或同一 `/api/...` 端点）；
5. web 用到的平台能力在共享屏 props 里有**注入点**；
6. 页面不是多面板页，且没有共享屏不覆盖的第二块功能。

出 diff 时只做机械替换：保留宿主 hooks / 取数 / 登录门，把唯一顶层 `return(` 换成 `<SharedXxxScreen ...props />`，并追加共享屏 import。**只打 stdout 或 `--out=<文件>`；`--apply` 一律 exit 2。**

### 1.2 它拒绝什么形态（R1–R6）

| 规则 | 判据 | 为什么拒绝 |
| --- | --- | --- |
| R1 领域 API | web 引了 api-client 的领域导出，RN 壳与共享屏都没有该导出，且其端点两端都没有 | 共享屏没有这条能力的宿主回调位；硬接会丢功能 |
| R2 领域工具 | web 引了 `@ihui/shared/*` 的领域工具，RN 壳与共享屏都没有 | 同上（如来源徽标、发言人摘要这类 web-only 逻辑） |
| R3 平台能力 | web 用文件选择 / 剪贴板 / 分享 / 富文本 / 媒体，而共享屏 props 无对应注入点 | 共享屏接受不了这类能力，只能功能退让 |
| R4 多面板 | 页面 `Tabs` 下 ≥2 块功能，共享屏只覆盖其中一块 | 机械替换会丢掉另一块 |
| R5 结构 | 替换单元导出组件 ≠1 或顶层 `return(` ≠1 | 无法机械定位替换边界 |
| R6 props | props 契约取不到，或某个 required prop 在宿主现有状态里没有来源 | 不做 TODO 占位；能编译但功能缺失的版本一律不出 |

## 2. `settings/import` 完整走查

### 2.1 输入面

| 面 | 文件 | 读数 |
| --- | --- | --- |
| web 页面族 | `apps/web/app/(main)/settings/import/{page,conversation-import-panel,helpers,types}.tsx/ts` | 双 tab；会话导入面板 ~865 行；面板单测 1 个文件 |
| RN 壳 | `apps/mobile-rn/src/screens/ConversationImportScreen.tsx` | 已 render 共享 `*Screen`，注入 9 个 props |
| 共享屏 | `packages/app/src/features/conversation-import/ConversationImportScreen.tsx` | props 9：`t / colorScheme / sources / onLoadHistory / onPickFile / onParse / onCommit / onOpenConversation / onAnalyze` |

### 2.2 判定：**拒绝出补丁**（6 项，逐条有证据）

| # | 规则 | 证据 | 说明 |
| --- | --- | --- | --- |
| 1 | R1 | `conversation-import-panel.tsx:47` | `addConversationToKnowledge`（`/api/user/conversation-import/to-knowledge`）两端都没有 |
| 2 | R1 | 同上 | `commitRuntimeImport`（`/api/user/conversation-import/commit-runtime`）两端都没有 |
| 3 | R2 | `conversation-import-panel.tsx:64` | `formatSpeakerList`（微信发言人摘要）两端都没有 |
| 4 | R2 | 同上 | `readImportProvenance`（导入来源徽标）两端都没有 |
| 5 | R4 | `page.tsx:79` | CLI 导入 tab 与会话导入 tab 共 2 块；共享屏只覆盖会话导入 |
| 6 | R5 | `conversation-import-panel.tsx` | 面板有 2 个顶层 `return(`，机械替换不安全 |

> 注意：登记表该行注记已经写过「web 双 tab 中的对话导入腿……CLI 导入腿 RN 缺（残余另记）」。**按路径判 adopt 会把这条算成候选**，按正文判它不是。

### 2.3 能力 delta 表（只判三值：等价 / 有意对齐 / 功能退让）

| 能力 | 改前 RN | 改前 web | 改后（共享屏 + 宿主注入） | 判定 |
| --- | --- | --- | --- | --- |
| 来源选择 / 选文件 | DocumentPicker | `input[type=file]` + accept + 20MB 预检 | 共享屏 `onPickFile`；预检留在宿主 `onParse` | 等价 |
| 解析 / 预览 | 上传解析 | 上传解析 + 微信发言人/时间范围摘要 | 共享屏预览行只有标题/条数/模型/时间 | **功能退让**（发言人/时间范围丢失） |
| 提交 | 串行提交 | 串行提交 + runtime 导入 | 共享屏 `onCommit`；runtime 可在宿主回调内继续提交 | 等价（需人工确认） |
| 加入知识库 | 无 | 每条会话一个入口 | 共享屏无此 UI，宿主拿不到 committed 列表渲染 | **功能退让**（web-only 能力丢失） |
| 结果区 | 打开会话 / 场景分析 | 打开会话 / 场景分析 / 加入知识库 / 关闭 | 共享屏只有前两项 | 前两项等价；后两项**功能退让** |
| 历史 | 文件名/状态/计数 | 另加来源徽标 + 行级「打开会话」 | 共享屏历史行无来源字段、无行级动作 | **功能退让**（来源徽标、行级打开会话丢失） |
| 用场景分析 | 内置简版 sheet | 210 条模板大弹窗 | 共享屏内置 sheet | **功能退让**（模板目录 UX 丢失） |
| CLI 导入 tab | 无 | 完整自实现（含 CLI 授权/上传） | 共享屏无对应物 | **结构性缺口**（R4） |

### 2.4 结论

- **补丁草案：0 份**。按本门拒则，任何一份能编译的草案都会带来上表 4 项功能退让 + 1 项结构性缺口，属于明令禁止的「能编译但功能缺失」。
- **落地：0 行**。因此没有改前/改后读数，四门读数是**基线**。
- 该页单测 1 个文件（`apps/web/tests/conversation-import-panel.test.tsx`，~650 行）大量断言 `data-testid`；即便未来共享屏补齐能力，落地必须同批重写断言。
- 解封条件（二选一）：
  1. 共享屏补 `knowledge` / `runtime` / 来源徽标 / 行级打开 / 富弹窗能力（需改 `packages/app`，本席只读）；
  2. 保留会话导入面板宿主自实现，只接「来源选择 + 解析 + 提交 + 历史」这四块能力齐平的部分——但这仍会丢 4 项，不能算零降级，本门仍拒绝。

## 3. 四门读数（HEAD 基线）

| 门 | 脚本 | 读数 | 性质 |
| --- | --- | --- | --- |
| 173 文档数字 | `check-doc-numbers.mjs` | ✅ exit 0；DN5 `trackedFiles 已同步(20006)`；现算 22 个数字、守门 351 道 | 绿 |
| 288 跨端 props 配对 | `check-cross-end-component-props-parity.mjs` | ❌ exit 1；映射表体检失败 3 处：`entries[29]/[30] VideoPlayer` 重复，`entries[31] UserInfoCard` 重复 | **存量红**，非本票 |
| 291 web↔RN 文案对等 | `check-web-rn-copy-parity.mjs` | ❌ 无法运行：`SyntaxError: Identifier 'catBatch' has already been declared`（脚本第 72 行重复 import） | **存量红**，非本票；门体本身在 HEAD 上跑不起来 |
| 251 rn-compat 覆盖 | `check-rn-compat-coverage.mjs` | ❌ exit 1；C9 `rn-shells.generated.d.ts` 与面上 249 个说明符不同步；C10 `Cannot find module 'fflate'`（本 worktree 缺 `apps/miniapp-taro/node_modules`） | C9 **存量红**；C10 环境缺件 |

> 本票没有改 web / `packages/app` / `apps/mobile-rn` / i18n / miniapp 任何源码，四门读数与 `origin/main` 一致，所以不做「改前/改后」对照。288 与 291 是仓库现存问题，应另开票修（291 属于门体语法错误，优先级最高）。

## 4. advisory ratchet：登记表层别漂移

`node scripts/check-registry-layer-drift.mjs`

- 判定面 HEAD；扫 `web-rn-screen-map.jsonl` 的 `aligned/pending` 行。
- 读数：**登记行 484；已对账 293（共享路径行 105 / RN 壳行 188）；RN 壳里已 render 共享屏 = 126 条**（路径判据会把这 126 条读成「自实现」）；壳正文取不到 0。
- 与总账早前口径 124 差 2 条，逐条清单可复现（`--list`）。
- 档位：**advisory**，默认 exit 0，只报数不判红；`--gate` 为未来升阻断留口，不进守门批。

## 5. 226 条 adopt 候选的形态筛选

`node scripts/web-adopt-shared-screen.mjs --survey`

- 机判分母 **219**：总账 226 条 adopt − 10 条总账有、本门未纳入（9 条属别条产线屏按边界剔除，`exam/[id]` 已局部接共享屏）＋ 3 条总账未列 adopt 但本门认为可判（`live`、`articles`、`exam/[id]/result`）。
- **宿主修正前**读数:62 条「共享屏已有能力覆盖」;**修正后重算:71 条**。
- **定性:这是读数口径修正,不是能力变多。** 62→71 的 9 条全部是 R1/R2 误报消失(旧判定把共享屏当 RN 壳,web 领域 API/领域工具在“壳”里当然找不到);另有 22 条从「拿共享屏顶替」退回诚实的「未判定」。合计 **118 条(54%)** 宿主路径原本读错。219 条里没有任何一条真的多出了能力。
- **0 条**通过完整形态筛选(含 props 可从宿主现有状态映射)。
- 拒绝原因分布(可重叠,修正后):

| 规则 | 条数 | 含义 |
| --- | --- | --- |
| R5 结构 | 88 | 多导出组件 / 多顶层 return,机械替换不安全 |
| R6 props | 72 | 能力齐平但 props 需宿主重新设计(含 `t` 命名空间映射) |
| R3 平台能力 | 35 | 文件选择/剪贴板/分享/富文本/媒体在共享屏无注入点 |
| R2 领域工具 | 26 | web 有 RN/共享屏没有的领域工具 |
| R1 领域 API | 20 | web 有 RN 壳没有的领域接口 |
| R4 多面板 | 8 | 共享屏只覆盖页面的一块 |

### 5.1 被误判的 9 条(旧 R1/R2 → 新仅 R6)

对比方法:`git show 75c8e01d93^:scripts/web-adopt-shared-screen.mjs`（原提交 `000ace2973^`）临时落盘,与修正后 `--survey --json` 逐条 diff;临时文件已删除,不入提交。

| # | 路由 | 修正前规则 | 修正后规则 | 真实 RN 壳 |
| --- | --- | --- | --- | --- |
| 1 | `user/ask` | R1-领域API | R6-props | `apps/mobile-rn/src/screens/AskListScreen.tsx` |
| 2 | `account-pool` | R1-领域API | R6-props | `apps/mobile-rn/src/screens/AccountPoolScreen.tsx` |
| 3 | `exam` | R1-领域API | R6-props | `apps/mobile-rn/src/screens/ExamScreen.tsx` |
| 4 | `points` | R1-领域API | R6-props | `apps/mobile-rn/src/screens/PointsScreen.tsx` |
| 5 | `subscriptions` | R1-领域API | R6-props | `apps/mobile-rn/src/screens/SubscriptionsScreen.tsx` |
| 6 | `image-gen/gallery` | R1-领域API | R6-props | `apps/mobile-rn/src/screens/ImageGenGalleryScreen.tsx` |
| 7 | `image-gen/history` | R1-领域API | R6-props | `apps/mobile-rn/src/screens/ImageGenHistoryScreen.tsx` |
| 8 | `image-gen/templates` | R1-领域API | R6-props | `apps/mobile-rn/src/screens/ImageGenTemplatesScreen.tsx` |
| 9 | `student/wrong-book` | R1-领域API | R6-props | `apps/mobile-rn/src/screens/WrongQuestionsScreen.tsx` |

### 5.2 22 条登记表缺 RN 行的路由(待办,不补登记行)

全部满足:映射表 `status=aligned`,跨端登记表**查无此行**(shared/rn 都不命中);web 页自实现,未接共享屏。补一行等于宣布「这屏有 RN 壳」,那是判断不是填空,故只列待办。

| # | 路由 | 登记表现状 | web 实现 | RN 实现(实壳) |
| --- | --- | --- | --- | --- |
| 1 | `login` | 缺行 | `apps/web/app/login/page.tsx` | `apps/mobile-rn/src/screens/LoginScreen.tsx`(映射表误指共享源) |
| 2 | `mcp-store` | 缺行 | `apps/web/app/(main)/mcp-store/page.tsx` | `apps/mobile-rn/src/screens/McpStoreScreen.tsx`(映射表误指共享源) |
| 3 | `edu/edu-management/grades` | 缺行 | `apps/web/app/(main)/edu/edu-management/grades/page.tsx` | `apps/mobile-rn/src/screens/EduGradesScreen.tsx` |
| 4 | `edu/edu-management/enrollment` | 缺行 | `apps/web/app/(main)/edu/edu-management/enrollment/page.tsx` | `apps/mobile-rn/src/screens/EduEnrollmentScreen.tsx` |
| 5 | `edu/edu-management/finance` | 缺行 | `apps/web/app/(main)/edu/edu-management/finance/page.tsx` | `apps/mobile-rn/src/screens/EduFinanceScreen.tsx` |
| 6 | `edu/edu-management/meal` | 缺行 | `apps/web/app/(main)/edu/edu-management/meal/page.tsx` | `apps/mobile-rn/src/screens/EduMealScreen.tsx` |
| 7 | `edu/edu-management/schedule` | 缺行 | `apps/web/app/(main)/edu/edu-management/schedule/page.tsx` | `apps/mobile-rn/src/screens/EduScheduleScreen.tsx` |
| 8 | `edu/edu-management/scheduling` | 缺行 | `apps/web/app/(main)/edu/edu-management/scheduling/page.tsx` | `apps/mobile-rn/src/screens/EduSchedulingScreen.tsx` |
| 9 | `edu/parent/bind` | 缺行 | `apps/web/app/(main)/edu/parent/bind/page.tsx` | `apps/mobile-rn/src/screens/EduParentBindScreen.tsx` |
| 10 | `edu/parent/children/[childId]/courses` | 缺行 | `apps/web/app/(main)/edu/parent/children/[childId]/courses/page.tsx` | `apps/mobile-rn/src/screens/EduChildScheduleScreen.tsx` |
| 11 | `edu/parent/children/[childId]/attendance` | 缺行 | `apps/web/app/(main)/edu/parent/children/[childId]/attendance/page.tsx` | `apps/mobile-rn/src/screens/EduChildAttendanceScreen.tsx` |
| 12 | `edu/parent/children/[childId]/grades` | 缺行 | `apps/web/app/(main)/edu/parent/children/[childId]/grades/page.tsx` | `apps/mobile-rn/src/screens/EduChildGradesScreen.tsx` |
| 13 | `edu/parent/children/[childId]/meals` | 缺行 | `apps/web/app/(main)/edu/parent/children/[childId]/meals/page.tsx` | `apps/mobile-rn/src/screens/EduChildMealsScreen.tsx` |
| 14 | `edu/parent/children/[childId]/study-plans` | 缺行 | `apps/web/app/(main)/edu/parent/children/[childId]/study-plans/page.tsx` | `apps/mobile-rn/src/screens/EduChildStudyPlansScreen.tsx` |
| 15 | `models/prompts` | 缺行 | `apps/web/app/(main)/models/prompts/page.tsx` | `apps/mobile-rn/src/screens/ModelsPromptsScreen.tsx` |
| 16 | `agreement/[type]` | 缺行 | `apps/web/app/(main)/agreement/[type]/page.tsx` | `apps/mobile-rn/src/screens/AgreementByTypeScreen.tsx` |
| 17 | `ai-career` | 缺行 | `apps/web/app/(main)/ai-career/page.tsx` | `apps/mobile-rn/src/screens/AiCareerScreen.tsx` |
| 18 | `ai-world/history` | 缺行 | `apps/web/app/(main)/ai-world/history/page.tsx` | `apps/mobile-rn/src/screens/AiWorldHistoryScreen.tsx` |
| 19 | `bi-dashboard` | 缺行 | `apps/web/app/(main)/bi-dashboard/page.tsx` | `apps/mobile-rn/src/screens/DashboardScreen.tsx` |
| 20 | `registry` | 缺行 | `apps/web/app/(main)/registry/page.tsx` | `apps/mobile-rn/src/screens/McpStoreScreen.tsx`(映射表疑错位,无 `RegistryScreen`) |
| 21 | `edu/attendance` | 缺行 | `apps/web/app/(main)/edu/attendance/page.tsx` | `apps/mobile-rn/src/screens/EduMyAttendanceScreen.tsx` |
| 22 | `business-card` | 缺行 | `apps/web/app/(main)/business-card/page.tsx` | `apps/mobile-rn/src/screens/BusinessCardScreen.tsx` |

### 结论数字

**按「共享屏已有能力覆盖」估算：226 条 adopt 候选里约 71 条形态上能过（约 32%）。**

估算依据：本门 R1–R5 逐条读正文（web 页面族 / 真 RN 壳 / 共享屏三面）后，71 条的 web 能力面可被共享屏覆盖；其余 148 条至少有 1 项共享屏没有的能力或结构缺口。这个数是**保守下界**：R5（88 条）里有一部分能靠人工拆分变成可接，但 v1 流水线不处理；R1/R2/R3 是真实能力缺口，不是流水线保守。**0 条**能直接机械出 diff，因为 71 条都需要宿主重新设计 props（主要是 `t` 命名空间 mapper 与状态命名对齐），这正是「人工确认」那一步的工作量。

## 6. 下一屏建议

从 71 条能力齐平里挑，优先小面 + 无富文本 + 无多面板：

1. `settings/icp-record`（props 5；共享屏 label 错位已按“补公网安备标签、撤无值范围行”修掉，复制卡改为无 `onCopy` 不渲染；宿主侧只需 `t` mapper 与带降级的 `onBack`；页面草案 `icp-record-adoption-2026-11-08.diff` 标内容待定，卡在三条事实口径与行内外链退让）；
2. `member/feedback`（props 4）；
3. `edu/progress`（props 5）。

`settings/import` **不再作为下一屏**：它不是 adopt 候选，是「共享屏只覆盖一半的双 tab 页」，应先补共享屏能力或明确保留宿主自实现。

## 7. 未做的事

- 共享屏能力补齐（knowledge / runtime / 来源徽标 / 行级打开 / 富弹窗）——需改 `packages/app`，本席只读。
- 门 251 C9 派生件不同步：仓库存量，另有分支已修，本树不对齐。
- i18n 只增不改生成器、小程序存量页→薄壳预览：按用户排序在接屏流水线之后。

## 8. 推送前必办与本分支计数口径

- `221c85c80a`（原提交 `b0bc712cb6`，291 修法）原提交信息未带 `immutable-exempt`；重落分支以 `221c85c80a` 补声明，原提交保留在旧分支、不删不改。
- `trackedFiles` 是**按分支各自的树面**计算的（`staged` 面 = 该树 `git ls-files --cached`，不含未跟踪）；本分支读数只对本树成立，**合入时以目标分支重算为准，README 生成块冲突不手工挑边**。

## 9. 已接屏 `colorScheme` 扫描（2026-11-08）

判据：web 宿主把共享屏当子组件调用时，`colorScheme` 传的是字面量还是主题值。

| 文件:行 | 改前 | 改后 | 提交 |
| --- | --- | --- | --- |
| `apps/web/app/(main)/wallet/withdraw/page.tsx`（原 :136，现 :138） | `colorScheme="light"` | `colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}` | `ab50d8d70b`（原提交 `b5e968842a`，单独一枚） |
| `apps/web/app/(pilot)/shared-pilot/page.tsx` :120 / :128 / :131 / :159 | 4 处 `colorScheme="light"` | 4 处 `colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}` | `52ff17b485`（原提交 `2a52ad3a87`，本轮 `fix(web)` 批量提交） |
| `apps/web/app/h5/share/[code]/PageClient.tsx`（原 :168，现 :170） | `colorScheme="light"` | `colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}` | 同上 |
| `apps/web/app/(main)/exam/[id]/ExamIntro.tsx`（原 :49，现 :52） | `colorScheme="light"` | `colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}` | 同上 |
| `apps/web/app/(main)/agents/categories/[id]/PageClient.tsx` :136 / :165 | `theme`（已派生） | 不变 | — |
| `apps/web/app/(main)/live/page.tsx` :152 | `resolvedTheme` 派生 | 不变 | — |
| `apps/web/app/layout.tsx` :258 | 文档级 `style.colorScheme` | 不算组件 prop，不计 | — |

合计字面量 **7 处**（withdraw 1 + 其余 6），**现已全部改为 `resolvedTheme` 注入，剩余字面量 0 处**。6 处各自独立可回滚（互不共享重构），批量修改单独一枚提交，与 label 修复、icp-record 分开。

## 10. 生成物指纹不可跨分支搬运（cherry-pick 通则）

- 只 pick 业务 hunk；`apps/web/src/lib/ui-routes.generated.ts` 这类生成物**交给目标分支 heal/重算**，不跟着搬。
- 依据：`generate-ui-routes.mjs` 的 pin 是对全量页面输入的 sha256；而 `git cherry-pick` **不触发 pre-commit**（临时仓实测：普通提交写了钩子标记、cherry-pick 后无标记），所以 pick 过去的是「钉着源分支指纹」的文件。
- 目标分支页面输入不一致时：落地的提交本身不脏，但门 105 判 stale；一旦重算就是真脏 diff（pin 行 + 逐输入行，本次实测 `decfa430bad1… → 2c650bb8c009…`，6 行级变化）。
- 已按此记：`ab50d8d70b`（原提交 `b5e968842a`，withdraw 修复 + 同枚 pin）、`52ff17b485`（原提交 `2a52ad3a87`，6 处 colorScheme + 同枚 pin）。
- 推送说明必须注明：**生成物指纹不可跨分支搬运，生成物交给目标分支重算**。

## 11. staged typecheck 缺依赖产物：已修闸门（exit 2）

- **取证（2026-11-08，移走 `packages/api-client/dist` 后）**：
  `node scripts/check-staged-typecheck.mjs --files "apps/web/app/(pilot)/shared-pilot/page.tsx" "apps/web/app/h5/share/[code]/PageClient.tsx" "apps/web/app/(main)/exam/[id]/ExamIntro.tsx"`
  → **不通过**：`app/h5/share/[code]/PageClient.tsx(14,54): error TS2307: Cannot find module '@ihui/api-client' or its corresponding type declarations.` 该 import 是存量代码，不是本轮新增；闸门按「错误文件 ∈ 声明集」归因，所以记在声明文件上。
- 把 dist 放回后同命令通过——但**本地 junction 不构成结论前提**，已移除，不再作为修复手段。
- **CI 有前置构建，不是 CI 缺口**：`.github/workflows/ci.yml` 在 `pnpm turbo run typecheck` 之前有 `pnpm --filter "@ihui/api-client..." run build`（L159；lint-typecheck-test job L563 同款）；`scripts/typecheck-full.mjs` 另带 `staleDistPreflight()`，可用 `--preflight-only` 单独补产物。
- **缺口只在本地闸门**：`check-staged-typecheck.mjs` 按包直接跑 `tsc`，不跑 `staleDistPreflight()`，缺 dist 就以声明文件 TS2307 假红。**已修闸门（`7f4f5b01c9`，原提交 `6e4291a20d`）**：判据三分——`0` 通过 / `1` 声明集真错误 / `2` 用法或脚本异常、**依赖产物取不到**。开跑前只做确定性检查（依赖包 `package.json` 的 `types`/`typings`/`exports['.'].types`，无类型入口才退到 `main`/`exports` 运行时入口），缺失即 exit 2，打印缺哪些包、期望入口、`pnpm --filter "<pkg>..." run build` 与 `node scripts/typecheck-full.mjs --preflight-only`；不跑 tsc、不把 TS2307 归到改动文件。头注写明理由：本地裸跑 tsc 产生假红，假红逼人跳门，比假绿更坏。
- **夹具**（`scripts/tests/check-staged-typecheck.test.mjs`）：有 dist → 干净文件 exit 0 / 写坏文件 exit 1；无 dist → exit 2 且带缺失包与补齐命令。`node --test scripts/tests/check-staged-typecheck.test.mjs` = 47/47 通过。
- **脱链复验（无 junction；`packages/api-client`、`@ihui/i18n` 等 dist 由 `node scripts/typecheck-full.mjs --preflight-only` 真实构建产出；`packages/app/node_modules` 由 `pnpm install --frozen-lockfile` 恢复的 pnpm 正常链接，非手工 junction）**：

  | 声明集 | 取数方式 | exit | 归因 |
  | --- | --- | --- | --- |
  | `52ff17b485`（原提交 `2a52ad3a87`，3 个 web 文件） | `--files` 三文件 | 0 | 声明文件全绿；`apps/web` 同包另有非声明文件错误被过滤 |
  | `8947e198c8`（原提交 `0eee6ac784`，3 个小程序生成物 + 共享屏历史内容） | `git restore --source=8947e198c8`（原提交 `0eee6ac784`）临时换入该版 `IcpRecordScreen.tsx`，跑完恢复 HEAD | 0 | `packages/app`、`apps/miniapp-taro` 均通过；taro 另有非声明文件错误被过滤 |
  | `a611c577d1`（原提交 `d06e4b4404`，共享屏 HEAD） | `--files` 一文件 | 0 | `packages/app` 通过 |

  **绿来自真实构建产物与真实安装，不是软链**；本轮已无任何手工 junction。
- **残存同类缺口（未并入判据，报机主决定）**：首次脱链复验在 `packages/app/node_modules` 缺失时，声明文件出现 `shared-pilot/page.tsx(141,13) TS2322: Property 't' does not exist`——`@ihui/rn-app` 以源码入口被消费，它自己的 `@ihui/types`/`react` 解析不到，基类退化造成假红；`pnpm install` 恢复后消失。新前置检查只看被审 package 的**直接** workspace 依赖入口，不覆盖「源码消费包」的传递解析。
- 以后本仓任何 staged typecheck 结论都必须带前提：**`packages/*/dist` 是否为真实构建产物、有无 junction、依赖安装是否完整**；junction 与手工补产物一律不算通过。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
