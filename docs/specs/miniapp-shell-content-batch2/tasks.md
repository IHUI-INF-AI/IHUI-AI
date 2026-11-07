<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Tasks — 小程序内容域薄壳化 第 2 批

依据：[spec.md](./spec.md)（待批准，已按父会话反馈修订）。执行树：`D:/IHUI-AI-wt-shell-content2`，分支 `feat/miniapp-shell-content-batch2`。批次 ≤3 页、一批一提交；本批薄壳 2 页：`pkg-learn/live/list`、`pkg-content/category-detail`。

## T1 — 类型契约（live）

- [ ] `packages/types/src/app-live.ts`：新增 `LiveQuickActionsLabels`、`LiveQuickActionsProps`；`LiveListScreenProps.quickActions?`
- 验收：`pnpm --filter @ihui/types exec tsc --noEmit` 通过；无其它文件引用破坏。

## T2 — 共享动作条（live）

- [ ] 新建 `packages/app/src/features/live-list/LiveQuickActions.tsx`（RN 原语、tokens、零平台 API；`onPressCalendar` 可选）
- [ ] `packages/app/src/features/live-list/LiveListScreen.tsx`：header 与 tabs 之间渲染 `quickActions`；类型 re-export
- 验收：`pnpm --filter @ihui/rn-app exec tsc --noEmit` 通过。

## T3 — RN 消费点（live）

- [ ] `apps/mobile-rn/src/screens/LiveListScreen.tsx` 传 `quickActions`（`LiveHost` / `Subscriptions`；无直播日历 ⇒ 不传 `onPressCalendar`）
- 验收：RN tsc 通过；`file:line` 记录到回报。

## T4 — web 消费点（live）

- [ ] `apps/web/app/(main)/live/page.tsx` 用 `LiveQuickActions` 替换 host Link；接 `/live/host`、`/subscriptions`（`subscriptions.title`），主题走 `next-themes`
- 验收：web tsc 通过；`file:line` 记录。

## T5 — 小程序 live 页薄壳（live）

- [ ] `apps/miniapp-taro/src/pkg-learn/live/list.tsx` 重写为薄壳：保留取数/分页/下拉/触底/分享钩子；映射 `LiveListItem`；tab 四档映射；`onNavigate` 端口适配；`quickActions` 三类全传
- 验收：页内 TS AST 渲染节点（`JsxElement/JsxSelfClosingElement/JsxFragment` + 非空 `JsxText`）从改前值 → 仅 `ThemeRoot` + `LiveListScreen`（wrapper）；LOC 下降；与共享屏重复 UI 段清单为空。

## T6 — live 单测（含阴性对照）

- [ ] 新建 `apps/miniapp-taro/tests/pkg-learn-live-list-shared-screen.test.tsx`：哨兵 mock 共享屏；断言渲染落地（testid）、prop 名集合精确相等、值语义逐条；阴性对照删 `quickActions`/`colorScheme`/`items`/`activeTab` 必红
- 验收：随 T9 一起 `vitest run` 通过。

## T7 — 类型契约（category-detail）

- [ ] `packages/types/src/app-learning.ts`：items 增 `avatar?`、`useCount?`；props 增 `title?`、`tabLabels?`
- [ ] `packages/app/src/features/category-detail/CategoryDetailScreen.tsx`：header 标题取 `title`；tabs 文案取 `tabLabels`；条目渲染 avatar 与 useCount；不加 tags、不新增共享文件
- [ ] `apps/mobile-rn/src/screens/CategoryDetailScreen.tsx`：映射 `avatar`、`useCount: a.usageCount`；按 `activeTab` 排序（热门=usageCount 降序、最新=createdAt 倒序、推荐=接口序）；传 `title`、`tabLabels`
- 验收：RN tsc 通过；新字段/新 prop 由 RN 真消费（`file:line` 记录）。

## T8 — 小程序 category-detail 页薄壳 + 单测

- [ ] `apps/miniapp-taro/src/pkg-content/category-detail/index.tsx` 改薄壳：保留 `useDidShow`/路由参数/取数映射；`activeTab` 三档与排序；`title` 取 categoryId/allCategories；`tabLabels` 走现有 i18n；删除页内 header/toggle/卡片与死 `tags` 分支
- [ ] 新建 `apps/miniapp-taro/tests/pkg-content-category-detail-shared-screen.test.tsx`：testid + prop 名集合 + 值语义 + 阴性对照（删 `title`/`tabLabels`/`colorScheme`/`items` 必红）
- 验收：页内渲染节点仅 wrapper；重复 UI 段 0；测试随 T9 通过。

## T9 — 门与回归（干净树）

- [ ] `pnpm --filter @ihui/miniapp-taro exec vitest run tests/pkg-learn-live-list-shared-screen.test.tsx tests/pkg-content-category-detail-shared-screen.test.tsx tests/pkg-content-community-create-shared-screen.test.tsx`
- [ ] `node scripts/check-miniapp-shell-form.mjs --worktree`（门 299）：记录 shared / registered / shell / copy / unknown 全量读数
- [ ] `node scripts/check-miniapp-generated.mjs --group ui-routes`（门 105）：`4/4 matched`；若 pin 变化按既有流程重生成生成物
- 验收：读数贴原文；无 `IHUI_LAND_SKIP_AFFECTED_GATES=1`。

## T10 — 提交与交接

- [ ] `safe-commit` 仅点名本批文件；门 173 全局红且未点名本票文件时用 `HUSKY_SKIP_DOC_NUMBERS=1` 并在 body 点名
- [ ] 记录提交 sha；`git status --short` 干净；不 push
- [ ] 保留 `D:/IHUI-AI-wt-shell-content2`，待父会话复查后与第 1 批一并 `worktree remove --force`

## T11 — (a) 共享段抽取（category-detail，改判后）

- [x] `packages/app/src/features/category-detail/CategoryHeader.tsx`（新，纯 RN 原语 + tokens）
- [x] `packages/app/src/features/category-detail/AgentAvatar.tsx`（新，Image / Sparkles 占位）
- [x] `packages/app/src/features/category-detail/CategoryDetailScreen.tsx`：条目用 `AgentAvatar`；可选 `header` 渲染 `CategoryHeader`
- [x] `packages/types/src/app-learning.ts`：`CategoryHeaderProps` + `header?`
- 验收：`pnpm --filter @ihui/types build` 后 `pnpm --filter @ihui/rn-app exec tsc --noEmit` 通过。

## T12 — pilot 导出 + web 真消费

- [x] `packages/app/src/pilot.ts` 追加 `CategoryHeader`、`AgentAvatar`（+ props 类型）
- [x] `apps/web/app/(main)/agents/categories/[id]/PageClient.tsx`：从 pilot import 两段（`:17`，渲染 `:127` / `:165`），替换 inline 分类头与 avatar 块；`next/image` 与 Tag/Calendar/CreditCard 导入移除
- 验收：web tsc 通过；消费点 `file:line` 记录。

## T13 — RN 同屏消费

- [x] `apps/mobile-rn/src/screens/CategoryDetailScreen.tsx`：`useRoute` 取 `categoryId/title`，传 `header={{ name: route.params.title }}`（`:112`）
- 验收：RN tsc 通过；`header` 传参 `file:line` 记录。

## T14 — 单测（含阴性对照）

- [x] 新建 `packages/app/src/features/category-detail/__tests__/CategoryHeaderAgentAvatar.test.tsx`：字段渲染 + 摘 `name` 必红；`AgentAvatar` 有/无 `avatar` + 摘 `avatar` 后 `img` 断言必红（4 passed）
- [x] 复跑 `apps/miniapp-taro/tests/pkg-content-category-detail-shared-screen.test.tsx`（avatar/useCount 阴性对照仍在）（6 passed，另 live 3 passed）
- 验收：全绿；提交前再做一次临时摘参必红并还原。

## T15 — 门、提交与复查

- [x] 干净树：tsc rn-app / miniapp / mobile-rn / web 全 0；门 299 `共享屏 272 / 在册 329 / 壳 209 / 复制 87 / unknown 0`；门 105 `4/4 matched`
- [x] `safe-commit`（未用自拼 `HUSKY_SKIP_*`）；仅门 173 无远端快照存量全局红时用 `--allow-skip-hooks="门173 无远端快照,存量全局红,本票未触及"` 并点名（提交 8c74672e19）
- [x] 未 push；`D:/IHUI-AI-wt-shell-content3` 验收后 `worktree remove --force` 复查
- 验收：贴原文读数 + sha。

## 完成定义

- live/list：三条硬标全过 + 3 条测试（含阴性对照）+ web/RN 消费点 + 日历桶②（含落地前置）。
- category-detail：三条硬标全过 + 3 条测试（含阴性对照）+ RN 真消费 avatar/useCount/title/tabLabels + **走 (a)**：web 真 import `CategoryHeader`/`AgentAvatar`（file:line）+ RN 经 `header` 消费同一段；tags 按死段删除（三项证据）。
- 干净树 tsc 三端（+web）、门 299、门 105、回归测试全绿；提交 sha 与三方对账写入回报。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
