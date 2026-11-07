<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Spec — 小程序内容域薄壳化 第 2 批（live/list、category-detail）

状态：待批准（Spec Mode，已按父会话反馈修订）
隔离树：`D:/IHUI-AI-wt-shell-content2`（分支 `feat/miniapp-shell-content-batch2`，基于 `feat/miniapp-shell-content` HEAD `f96a23f6b2`）
基线：`origin/main = 609ecff87d`；本批不 push。

## 1. 目标与硬边界

- 先逐元素判别“web/RN 是否已渲染该元素”，已存在 ⇒ 抽共享段并让 web/RN 消费；两端都没有 ⇒ 该段判桶②并给最接近实现 `file:line` 作反证。
- 不为“只有小程序消费”的元素新增共享屏 prop/插槽（判搬码，不计单源）。
- 只动：`apps/miniapp-taro/src/pkg-learn/live/**`、`apps/miniapp-taro/src/pkg-content/category-detail/**`、`packages/app/src/features/live-list/**`、`packages/app/src/features/category-detail/**`、`packages/types/src/app-live.ts`、`packages/types/src/app-learning.ts`、`apps/mobile-rn/src/screens/LiveListScreen.tsx`、`apps/mobile-rn/src/screens/CategoryDetailScreen.tsx`、`apps/web/app/(main)/live/page.tsx`、`apps/miniapp-taro/tests/pkg-learn-live-list-shared-screen.test.tsx`、`apps/miniapp-taro/tests/pkg-content-category-detail-shared-screen.test.tsx`。
- **不动** `apps/web/app/(main)/agents/categories/[id]/PageClient.tsx`（category-detail 的 web 分类头/avatar 不抽共享，理由见 §2.2）。
- 不碰：`README*.md`、`scripts/guardian-runner.mjs`、`scripts/check-doc-numbers.mjs`、`scripts/gen-doc-numbers.mjs`、`scripts/data/miniapp-shell-copy-ledger.jsonl`；共享热区（`packages/app/src/index.ts`、`packages/i18n/messages/**`）只允许文件末尾追加且本批**零追加**。
- 不 `add -A`、不 `stash`、不 `reset --hard`、不 `clean`、不 `--no-verify`、不 `IHUI_LAND_SKIP_AFFECTED_GATES=1`、不 push。

## 2. 逐元素判别（判据：该 UI 元素在 web / RN 实现里是否真的被渲染）

### 2.1 `pkg-learn/live/list`（小程序页：`apps/miniapp-taro/src/pkg-learn/live/list.tsx:147-173` 动作条）

| 元素 | web 是否已渲染（file:line） | RN 是否已渲染（file:line） | 判定 |
|---|---|---|---|
| 开播入口 | 是 — `apps/web/app/(main)/live/page.tsx:134-140`（`Link href="/live/host"` + `RadioTower` + `t('hostLink')`） | 否（列表屏无入口；路由存在 `apps/mobile-rn/src/navigation/RootNavigator.tsx:1205-1206`） | 概念存在 ⇒ 抽共享动作条；web + RN 都消费 |
| 我的订阅入口 | 是 — `apps/web/app/(main)/subscriptions/page.tsx:64,96`（`subscriptions.title`）；直播页未挂入口 | 是 — 路由 `RootNavigator.tsx:1354`（`SubscriptionsScreen`） | 概念存在 ⇒ 抽共享动作条；web + RN 都消费 |
| 日历入口 | 否 — 仅有开始时间装饰图标 `apps/web/app/(main)/live/page.tsx:233-234`；无直播日历路由/页。最接近实现是发布日历 `/publish/calendar`（语义不同） | 否 — `PublishCalendar` 是发布日历（`RootNavigator.tsx:1082`），不是直播日历 | **桶②（不是桶③）**：日历动作仅小程序传（其自有 `/pkg-learn/live/calendar`），共享组件里 `onPressCalendar` 可选，web/RN 不传 |
| 副标题/标题 | 是 — `apps/web/app/(main)/live/page.tsx:142-148` | 是 — 共享屏 `packages/app/src/features/live-list/LiveListScreen.tsx:91-92` | 已在共享屏，不重复 |
| 状态 tabs | 是（分类筛选，非同一档位） | 是 — 共享屏 `LiveListScreen.tsx:32,95-110` | 小程序把 `living/ended/''` 映射为 `ongoing/ended/all`，交给共享屏 |
| 列表卡片/空态/骨架 | 是（web 自己的卡片网格） | 是 — 共享屏 `LiveListScreen.tsx:121-171` | 小程序改由共享屏渲染 |

结论：**本页做薄壳**。动作条抽为共享组件 `LiveQuickActions`，由共享屏可选渲染；web 消费“开播 + 我的订阅”，RN 消费“开播 + 我的订阅”，小程序三类全传（日历为桶②的端内独有动作）。

**日历桶②的落地前置（谁先建页）**：web 需先建直播日历页（`apps/web/app/(main)/live/calendar/page.tsx`），或 RN 先建 `LiveCalendarScreen` 并在 `RootNavigator.tsx` 注册路由；任一端建成后把该端 `onPressCalendar` 接到共享动作条，才可从桶②移出。在此之前不把 `/publish/calendar`（发布日历）冒充直播日历。

### 2.2 `pkg-content/category-detail`（小程序页 `apps/miniapp-taro/src/pkg-content/category-detail/index.tsx`）

| 元素 | web 是否已渲染（file:line） | RN 是否已渲染（file:line） | 判定 |
|---|---|---|---|
| 分类头（图标/名称/状态/付费/创建时间/描述） | 是 — `apps/web/app/(main)/agents/categories/[id]/PageClient.tsx:121-164` | 共享屏 header 只有返回 + 标题 `packages/app/src/features/category-detail/CategoryDetailScreen.tsx:70-73` | **映射，不是缺段**：给共享屏加可选 `title`；RN 传“分类详情”，小程序传 `categoryId/allCategories` |
| hot/new 切换 | 否 — 最接近是列表头总数行 `PageClient.tsx:167-172` | 是 — 共享屏“推荐/热门/最新”tabs `CategoryDetailScreen.tsx:29,74-84` | **语义等价**：RN 三档 ⊃ 小程序两档；`hot→热门`、`new→最新`，`推荐`=接口原序。映射 + RN 补排序 |
| 条目 avatar | 是 — `PageClient.tsx:189-201` | 共享屏条目无 avatar（`CategoryDetailScreen.tsx:48-66`）；RN wrapper 只映射 cover（`apps/mobile-rn/src/screens/CategoryDetailScreen.tsx:41-46`） | **缺字段**：API `Agent.avatar` 存在（`packages/api-client/src/endpoints/agent.ts:22`）⇒ 共享卡片加 `avatar` 并渲染，RN 真消费（映射 `a.avatar`） |
| 条目 tags | 否 — 最接近描述/价格区 `PageClient.tsx:202-220` | 否；且 API `Agent` 契约无 tags（`agent.ts:18-39`） | **死段**：小程序页声明 `tags` 但从未映射（`index.tsx:42-48` 只映射 avatar/uses）⇒ 转化时删除，不新增共享字段 |
| 条目 useCount | 否 — 最接近总数 `PageClient.tsx:169-171` | 否；API `Agent.usageCount` 存在（`agent.ts:33`） | **缺字段**：共享卡片加 `useCount` 并渲染，RN 真消费（映射 `a.usageCount`） |

**hot/new 与 RN 三档的等价性答复（是，附 3 条映射差异，不判缺段）**
1. 档数：RN 3 档（推荐/热门/最新），小程序 2 档（hot/new，默认 hot）；`热门`/`最新` 与 hot/new 一一对应，`推荐`为 RN 超集档（保留为接口原序）。
2. 行为：RN 现 `onTabChange` 只 `setActiveTab`，`load` 不依赖 `activeTab`、列表不排序（实现缺口，本批补齐：热门=usageCount 降序、最新=createdAt 倒序、推荐=接口原序）；小程序原本真排序（hot=useCount 降序、new=反转），迁移后两者一致。
3. 取词：RN 硬编码中文三枚，小程序走 i18n；新增 `tabLabels` prop 由 RN 与小程序各自传，避免小程序 i18n 回退。

**结论：本页做薄壳（不是桶②）**。依据：hot/new 是映射；avatar/useCount 是 RN 卡片缺字段，补齐后 RN 真消费；tags 是无数据源死段，删除。**不走 (a)/(b)**：
- (a) 不成立：web 的分类头/avatar 是 Next/React inline JSX（`PageClient.tsx:121-164/189-201`，依赖 `next/image`、`@ihui/ui-react`），没有现成纯 TS/React 组件；即便抽到 `packages/shared/ui` 的“核心 + 原语注入”模式（`packages/shared/src/ui/back-chevron-core.tsx`），web 仍需另写 DOM adapter，且小程序页用不上，不构成本页单源。
- (b) 不成立：其前提“hot/new 不等价”已被 §2.2 等价性答复否定；本页可用共享屏自有 header/卡片收敛，不需要把 web 段抽到 shared。

## 3. 实现方案（精确到文件/函数）

### 3.1 live/list

1. `packages/types/src/app-live.ts`
   - `LiveListScreenProps` 前新增：
     ```ts
     export interface LiveQuickActionsLabels {
       host: string
       calendar: string
       subscriptions: string
     }
     export interface LiveQuickActionsProps {
       labels: LiveQuickActionsLabels
       onPressHost: () => void
       /** 可选：无直播日历对应实现的一端不传，组件不渲染该按钮 */
       onPressCalendar?: () => void
       onPressSubscriptions: () => void
       colorScheme?: 'light' | 'dark'
     }
     ```
   - `LiveListScreenProps` 追加 `quickActions?: LiveQuickActionsProps`。
2. 新建 `packages/app/src/features/live-list/LiveQuickActions.tsx`
   - 仅 `react-native` 原语（`View/Text/TouchableOpacity/StyleSheet`）+ `@ihui/design-tokens` + `../../theme/tokens`；零平台 API。
   - 三个等宽按钮；第一个 `tk.brand.cta` 主色，其余 `tk.surface.card` + 边框；`onPressCalendar` 缺失时不渲染日历按钮。
3. `packages/app/src/features/live-list/LiveListScreen.tsx`
   - 解构 `quickActions`；在 header（93 行）与 tabs（95 行）之间渲染 `{quickActions ? <LiveQuickActions {...quickActions} /> : null}`。
   - 类型 re-export 追加 `LiveQuickActionsProps`。
4. `apps/mobile-rn/src/screens/LiveListScreen.tsx`
   - 传 `quickActions={{ labels: { host: t('live.startLiveBtn'), calendar: '', subscriptions: t('live.mySubscriptionBtn') }, onPressHost: () => onNavigate('LiveHost'), onPressSubscriptions: () => onNavigate('Subscriptions'), colorScheme: resolvedTheme }}`（RN 无直播日历 ⇒ 不传 `onPressCalendar`）。
5. `apps/web/app/(main)/live/page.tsx`
   - 新增 `useRouter`、`useTranslations('subscriptions')`、`useTheme`（`next-themes`）。
   - 用 `<LiveQuickActions labels={{ host: t('hostLink'), calendar: '', subscriptions: subscriptionsT('title') }} onPressHost={() => router.push('/live/host')} onPressSubscriptions={() => router.push('/subscriptions')} colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'} />` 替换 134-140 的 host Link（保留左侧 `BackButton`）。
   - 不传 `onPressCalendar`（web 无直播日历页，桶②）。
6. `apps/miniapp-taro/src/pkg-learn/live/list.tsx` 改薄壳
   - 保留：`LiveChannelRow` 取数（`GET /live/channels`）、分页/下拉/触底、`useShareAppMessage`/`useShareTimeline`。
   - 映射：`status = isLive ? 'ongoing' : 'ended'`；`startAt = formatStart(startTime)`；`lecturer = lecturerName ?? ''`；`viewerCount = viewCount`；`cover = null`。
   - tab 映射：`''↔'all'`、`living↔ongoing`、`ended↔ended`。
   - `onNavigate` 适配：`(target, params) => { if (target === 'LiveDetail' && params?.id != null) Taro.navigateTo({ url: '/pkg-learn/live/detail?id=' + params.id }) }`，满足共享屏 `assertRequiredPort('onNavigate')`。
   - `onBack = () => void Taro.navigateBack()`；`onRetry = () => void load(true)`；`error = loadFailed && list.length === 0 ? t('common.failed') : ''`。
   - `quickActions`：labels 用现有键 `tt('live.startLiveBtn')`、`tt('live.calendarBtn')`、`tt('live.mySubscriptionBtn')`；handlers → `/pkg-learn/live/{host/index,calendar,subscribe}`。
   - 渲染体只留 `<ThemeRoot><LiveListScreen … /></ThemeRoot>`；删除页内动作条/tabs/卡片/空态/骨架 JSX（原 138-243）。
7. 新建 `apps/miniapp-taro/tests/pkg-learn-live-list-shared-screen.test.tsx`
   - 复用社区发帖测试模式：`vi.hoisted` 哨兵 + `vi.mock('@ihui/rn-app/features/live-list/LiveListScreen')` 记录 props + `renderToStaticMarkup`。
   - ① 输出含 `data-testid="shared-live-list-screen"`，哨兵渲染 1 次。
   - ② prop 名集合精确相等（`t,items,activeTab,onSelectTab,loading,refreshing,error,onRefresh,onPressItem,onBack,onEndReached,loadingMore,onRetry,colorScheme,onNavigate,quickActions`）；值语义：初始 `items=[]`、`activeTab='all'`、`error=''`、`quickActions.labels` 三键取真实文案、三 handler 为函数、`onNavigate` 为函数、`colorScheme='dark'`。
   - ③ 阴性对照：删 `quickActions`、删 `colorScheme`、`items` 置 undefined、`activeTab` 置 undefined 时同一断言必须 throw。

### 3.2 category-detail（做薄壳，不抽 web 段）

1. `packages/types/src/app-learning.ts`
   - `CategoryDetailScreenProps.items` 元素追加 `avatar?: string | null`、`useCount?: number`。
   - `CategoryDetailScreenProps` 追加 `title?: string`、`tabLabels?: readonly [string, string, string]`。
2. `packages/app/src/features/category-detail/CategoryDetailScreen.tsx`
   - header 标题改 `title ?? '分类详情'`。
   - tabs 显示文案改 `tabLabels?.[i] ?? TABS[i]`；`activeTab` 仍用 `TABS` 字面量值。
   - 条目卡片：name 前渲染 avatar（有 `item.avatar` 用 `Image`，否则首字占位）；描述后/尾部渲染 `item.useCount`（`useCount !== undefined` 时显示数值）。
   - 不加 tags、不新增共享文件、零平台 API。
3. `apps/mobile-rn/src/screens/CategoryDetailScreen.tsx`
   - 映射 `avatar: a.avatar ?? undefined`、`useCount: a.usageCount`。
   - `fetcher` 内按 `statusTab` 排序：`热门`=usageCount 降序、`最新`=createdAt 倒序、`推荐`=接口原序。
   - 传 `title='分类详情'`、`tabLabels={['推荐', '热门', '最新']}`（两 prop 均由 RN 真消费）。
4. `apps/miniapp-taro/src/pkg-content/category-detail/index.tsx` 改薄壳
   - 保留 `useDidShow(load)`、路由参数 `id/categoryId`、`getAgentList` 映射（`avatar`、`useCount: a.uses`）。
   - `activeTab` 初值 `'热门'`；`onTabChange` 设档并重排：`热门`=useCount 降序、`最新`=反转、`推荐`=接口原序。
   - `title = categoryId ? t('categoryDetail.categoryId', { id: categoryId }) : t('categoryDetail.allCategories')`。
   - `tabLabels = [tt('categoryDetail.recommended', '推荐'), t('categoryDetail.hot'), t('categoryDetail.new')]`。
   - `hasMore=false`、`onLoadMore=noop`、`error=''`、`onRetry=load`、`onAgentPress→/pkg-ai/ai/agent-detail?id=`、`onBack=Taro.navigateBack`、`colorScheme` 取 `@/rn-compat/theme`。
   - 删除页内 header/toggle/卡片/空态/骨架与死 `tags` 分支（原 72-151）；渲染只留 `<ThemeRoot><CategoryDetailScreen … /></ThemeRoot>`。
5. 新建 `apps/miniapp-taro/tests/pkg-content-category-detail-shared-screen.test.tsx`
   - 同模式 mock `@ihui/rn-app/features/category-detail/CategoryDetailScreen`；断言 testid、prop 名集合（`t,items,activeTab,loading,hasMore,error,onTabChange,onLoadMore,onAgentPress,onBack,onRetry,colorScheme,title,tabLabels`）、值语义（`activeTab='热门'`、`title='全部分类'`、`tabLabels` 三枚真实文案、回调为函数、`colorScheme='dark'`）。
   - 阴性对照：删 `title`、删 `tabLabels`、删 `colorScheme`、`items` 置 undefined 必红。

## 4. 验收（干净树，真实安装依赖）

在 `D:/IHUI-AI-wt-shell-content2` 依次执行并贴原文读数：
1. `pnpm --filter @ihui/rn-app exec tsc --noEmit`
2. `pnpm --filter @ihui/miniapp-taro exec tsc --noEmit`
3. `pnpm --filter @ihui/mobile-rn exec tsc --noEmit`
4. `pnpm --filter @ihui/web exec tsc --noEmit`
5. `pnpm --filter @ihui/miniapp-taro exec vitest run tests/pkg-learn-live-list-shared-screen.test.tsx tests/pkg-content-category-detail-shared-screen.test.tsx` → 6 passed；再做一次阴性对照（临时删 `quickActions` / `tabLabels` 传参）→ 必须红，随后还原。
6. `node scripts/check-miniapp-shell-form.mjs --worktree`（门 299）：期望 shell `207→209`、copy `89→87`、unknown `0`；shared 计数按实际记录。
7. `node scripts/check-miniapp-generated.mjs --group ui-routes`（门 105）：`4/4 matched`。
8. 回归：`pnpm --filter @ihui/miniapp-taro exec vitest run tests/pkg-content-community-create-shared-screen.test.tsx`。
9. `safe-commit` 只点名本批文件；若门 173 因无远端快照全局红且未点名本票文件，用既定出口 `HUSKY_SKIP_DOC_NUMBERS=1` 并在 body 点名；禁用 `IHUI_LAND_SKIP_AFFECTED_GATES=1`。
10. 提交后 `git status --short` 干净，记录 sha；**不 push**；保留 worktree 待与第 1 批一并 `worktree remove --force` 复查。

## 5. 回报（≤12 行）

- 第 1 行：`本批 2 页：测试 6 条（各含阴性对照）/ tsc 三端（+web）exit / 门 299 / 门 105`。
- 每页一行：`page | 渲染行 a→b | 重复段 0 | 消费点 file:line | LOC 前后`。
- live/list 日历：桶② + 前置（web 建 `/live/calendar` 或 RN 建 `LiveCalendarScreen`）。
- category-detail：hot/new 等价答复（3 条映射差异）+ tags 死段 + 走收敛不走 (a)/(b)。
- 提交 sha；三方对账。

## 6. 已采纳的父会话判定

1. 日历入口 = **桶②（不是桶③）**，并写入落地前置（web 或 RN 先建直播日历页）。
2. category-detail **不抽 web 段、不走 (a)/(b)**；因 hot/new 与 RN 三档语义等价，改用“RN 卡片补 avatar/useCount + 共享屏渲染 + RN 真消费”的收敛路径，整页做薄壳。

## 7. 2026-11-05 改判（父会话 pilot 证据）：category-detail 走 (a)

> 本节覆盖 §2.2/§6.2 中“不走 (a)/(b)”的结论；其余不变。

### 7.1 pilot 是否覆盖（结论：覆盖，可走 (a)）

| 段所需原语 | pilot/仓内现状（file:line） | 结论 |
|---|---|---|
| `View/Text/Image/StyleSheet/TouchableOpacity` | `packages/app/src/features/agreement/AgreementScreen.tsx`、`.../announcement-detail/AnnouncementDetailScreen.tsx` 均为 RN 原语；web 侧 `apps/web/next.config.ts` 已配 `react-native → react-native-web`、`lucide-react-native → lucide-react` | 覆盖 |
| `lucide-react-native`（Tag/CreditCard/Calendar/Sparkles） | 同上别名；`packages/app/src/pilot.ts:12-15` 已试点导出 4 屏 | 覆盖 |
| 主题 token | `packages/app/src/theme/tokens.ts`（re-export `@ihui/design-tokens`），含 `success/warning/brandAccent` | 覆盖 |
| web 真实消费 pilot 段 | 机制已验证：另一线的 `apps/web/app/(main)/exam/[id]/result/PageClient.tsx:17` 从 `@ihui/rn-app/pilot` import 共享段并通过 web tsc | 覆盖 |

结论：**走 (a)**。新增两个共享段 `CategoryHeader`、`AgentAvatar`，从 `pilot.ts` 导出，web `agents/categories/[id]/PageClient.tsx` 真 import 并替换 inline 实现；RN 经共享屏 `header` 消费同一段；小程序页保持薄壳。

### 7.2 落地范围（精确）

1. `packages/app/src/features/category-detail/CategoryHeader.tsx`（新）：图标盒 + 名称 + 状态徽标 + 付费徽标 + 创建时间 + 描述；纯 RN 原语 + tokens，无平台 API；字段均“给了才渲染”。
2. `packages/app/src/features/category-detail/AgentAvatar.tsx`（新）：`avatar` 有则 `Image`，无则 `Sparkles` 占位（对齐 web 现有观感）。
3. `packages/app/src/features/category-detail/CategoryDetailScreen.tsx`：条目改用 `AgentAvatar`；新增可选 `header?: CategoryHeaderProps`，传了就在返回行下渲染 `CategoryHeader`。
4. `packages/types/src/app-learning.ts`：新增 `CategoryHeaderProps` 与 `CategoryDetailScreenProps.header?`。
5. `packages/app/src/pilot.ts`：追加导出 `CategoryHeader`、`AgentAvatar` 及其 props 类型。
6. `apps/web/app/(main)/agents/categories/[id]/PageClient.tsx`：从 `@ihui/rn-app/pilot` import 两段；`useTheme` 供 `colorScheme`；删除 inline 分类头与 avatar 块（`next/image`、Tag/Calendar/CreditCard 随之移除；`Sparkles` 仍用于空态）。
7. `apps/mobile-rn/src/screens/CategoryDetailScreen.tsx`：`useRoute` 取 `categoryId/title`，传 `header={{ name: route.params.title }}`（RN 没有分类详情对象时不伪造状态/时间）。
8. `apps/miniapp-taro/src/pkg-content/category-detail/index.tsx`：不改（已是薄壳；继续传 `title`/`tabLabels`）。

### 7.3 单测（含阴性对照）

- 新增 `packages/app/src/features/category-detail/__tests__/CategoryHeaderAgentAvatar.test.tsx`：断言名称/状态/付费/时间/描述渲染；阴性对照摘 `name` 必红。`AgentAvatar` 有 `avatar` 渲染 `img`、无 `avatar` 渲染占位；阴性对照摘 `avatar` 后 `img` 断言必红。
- 既有 `apps/miniapp-taro/tests/pkg-content-category-detail-shared-screen.test.tsx` 保持并复跑（`avatar`/`useCount` 映射阴性对照仍在）。

### 7.4 `tags` 死段三项证据（已在 b923 删除）

1. API 契约无字段：`packages/api-client/src/endpoints/agent.ts:18-39`（`avatar:22`、`usageCount:33`，无 `tags`）。
2. 仓内 grep：`tags` 在 `endpoints/agent.ts` 命中 **0** 次。
3. 从未映射：改前 `apps/miniapp-taro/src/pkg-content/category-detail/index.tsx:22` 声明 `tags?: string[]`，`:42-48` 映射仅写 `id/name/description/avatar/useCount` ⇒ 页面从未渲染过 tags。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
