# ShareCreatorScreen 任务分解 — tasks.md

> 顺序即执行顺序。① 台账改账先做但不占主任务前置；② 每完成 2 块输出一条中间读数。
> 中间读数格式：`块名 | 共享屏当前行数 | 是否已有消费点(file:line)`

## T0 环境（隔离树）

- [ ] `pnpm install --frozen-lockfile --prefer-offline`
- [ ] `pnpm --filter "./packages/*" run build`（workspace 包 dist）
- [ ] 基线快照：`apps/miniapp-taro/src/pages/share/index.tsx` 总行数 913 / 渲染行 320
- [ ] `rg -n "return \\(|</View>\\s*$"` 定位渲染区起止行，回填 spec §4.3

## T1 台账改账（①，小活）✅ 已落地

- [x] 改 `scripts/data/miniapp-shell-copy-ledger.jsonl:71`：`mapStatus:"none"`、删 `declaredSpecs`
- [x] 改 `apps/miniapp-taro/src/pkg-learn/subscription/contracts/index.tsx:107` 注释（去掉「对齐 + 裸屏名」）
- [x] 台账行数不变（93 行；门读数「存量台账 90 行」为其自身过滤口径）
- [x] `node scripts/check-miniapp-shell-form.mjs --worktree`：复制页 87→86，新增 1 条 S2 advisory
- [x] `learn-develop` 不动；结论写进最终报告

## T2 共享屏骨架 + 契约 ✅ 已落地

- [x] `packages/app/src/features/share-creator/types.ts`：`ShareCreatorScreenProps`
- [x] `packages/app/src/features/share-creator/ShareCreatorScreen.tsx`：空态可渲染骨架（t/colorScheme/items 必填）
- [x] `pnpm --filter @ihui/rn-app exec tsc --noEmit` 通过
- [x] `packages/app/src/pilot.ts` 追加导出

## T3 逐块上移（每块一条单测，每 2 块一条中间读数）

**裁决点 1 实读结论（`web`/`RN` 现状）：只有 B2/B4/B8(返回) 能进共享屏。
B1/B3/B5/B6/B7 在两端都无对应实现 ⇒ 按裁决点 5 判缺段，不为小程序单独加段。**

- [x] B2 分类横条（复用 `components/category/CategoryInlineBar`）+ 单测 → 中间读数 #1
- [ ] B3 搜索区：**缺段**。RN `NewsScreen` 无搜索态与 search 入参（数据层只拼 page/pageSize/categoryId）；web 搜索在 `NewsHeader` 独立件内，非共享件 ⇒ 不加 `keyword` prop
- [x] B4 信息流列表 + 空/加载/错误态（复用 `SquareScreen` 单一源）+ 单测 → 中间读数 #2
- [x] B8 返回（端口回调，传 `onBack` 时才渲染自带 header）+ 单测 → 中间读数 #2；分享动作 **缺段**（RN 根 Tab 无分享入口、web 无该动作；只有小程序有 ⇒ 不加 `onShare`/`onSave`）
- [ ] B7 分享卡注入位 `renderShareCard`：**缺段**（canvas 仅小程序有，`apps/miniapp-taro/src/pages/share/index.tsx:770-771`）⇒ 不加插槽
- [ ] B1 顶部 tab：**缺段**（`apps/miniapp-taro/src/pages/share/index.tsx:750-759`；RN/web 无 latest/hot/following 数据轴）
- [ ] B5 排行榜：**缺段**（`apps/miniapp-taro/src/pages/share/index.tsx:579-629`；RN `RankingScreen` 是独立整屏、非页内抽屉）
- [ ] B6 兴趣赛道弹窗：**缺段**（`apps/miniapp-taro/src/pages/share/index.tsx:884-908`；两端无该弹窗/存储轴）
- [x] `pnpm --filter @ihui/rn-app exec vitest run --environment jsdom src/features/share-creator`：5 passed

## T4 双端消费

- [x] RN：`apps/mobile-rn/src/screens/NewsScreen.tsx:45` 从 `@ihui/rn-app/pilot` 取 `ShareCreatorScreen`，`:458-478` 传 items/categories/刷新/分页/返回顶部（数据层不改）
- [ ] web：**接不上**。`apps/web/app/(main)/news/PageClient.tsx:64-82` 是桌面双栏（`NewsSidebar` 分类+pinned 自有数据源 `:49-53`）、页码分页 `:69-72`；共享屏根 `flex:1` + FlatList 需定高（`SquareScreen.tsx:191-214,232-235`），试点路线用定高盒才成立 ⇒ 强接会删 pinned 侧栏（违反裁决点 4）或出现两套分类 UI ⇒ 回退现状并上报
- [x] `pnpm --filter @ihui/mobile-rn run typecheck` / `pnpm --filter @ihui/web run typecheck`：0

## T5 小程序页改薄壳 ❌ 本批不换壳（缺段导致）

- [ ] `apps/miniapp-taro/src/pages/share/index.tsx` 只留取数/分页/缓存/鉴权/canvas/平台 API + 共享屏接线
- [x] 三条硬标读数（真读）：JSX 渲染行 **320 → 320（未改）**；与共享屏重复段 **0**（本批未渲染共享屏）；消费点 RN `apps/mobile-rn/src/screens/NewsScreen.tsx:458`
- **不换壳依据**：① B1/B3/B5/B6/B7 缺段（见 T3）；② 页内信息流是 `InformationItem`（封面+时间线+日期分组，`:783-822`），共享屏卡片无封面/时间线（`SquareScreen.tsx:93-160`）⇒ 换壳会降级；③ 整页原生滚动无 ScrollView（`:723-733`），共享屏 FlatList 需定高内滚 ⇒ 需改页面滚动模型；④ 顶部 tab/搜索/分享卡/热门/推荐/分类弹层/排行榜/兴趣弹窗全在共享屏之外，换壳后同上固定不滚动。

## T6 单测补全（壳页 + 阴性对照）

- [x] 共享屏段级：`packages/app/src/features/share-creator/__tests__/ShareCreatorScreen.test.tsx` 5 条（B2/B4×2/B8×2）
- [ ] 壳页一条：本批不换壳（T5），无壳页测试；待换壳批次补
- [x] 阴性对照：把 `ShareCreatorScreen.tsx` 的 `onItemClick={onPressItem}` 摘成 `noop` ⇒ `B4 渲染信息流条目并回调 onPressItem` 必红（`AssertionError: expected "vi.fn()" to be called with arguments: [ 'a1' ]`），已回滚；`onShare`/`onSave` 未添加（裁决点 1），不以死 prop 造对照
- [ ] `pnpm --filter @ihui/miniapp-taro exec vitest run src/pages/share`：本批未改该页，不跑

## T7 干净树全量验证

- [x] 四处 tsc：rn-app 0 / web 0 / mobile-rn 0 / miniapp-taro 0
- [x] `node scripts/check-miniapp-shell-form.mjs --worktree`：复制页 86（87→86）、台账 93 行、0 无法判定
- [ ] `node scripts/check-miniapp-generated.mjs --group ui-routes`：**存量红** [G5] `ui-routes.generated.ts` 自述钉陈旧，不一致输入为 `constants/storage.ts` / `pkg-content/community/create/index.tsx` / `pkg-user/edu-my-attendance/index.tsx`（本次均未改，非本批引入）
- [x] 测试：`@ihui/rn-app` share-creator 5 passed
- [x] 未用 `IHUI_LAND_SKIP_AFFECTED_GATES=1` / 未加 `--no-verify`

## T8 提交与对账

- [x] 按域拆提交：`fix(miniapp)`（台账+注释）、`feat(multi)`（共享屏+pilot+RN）
- [x] 三方对账（台账第 71 行 mapStatus=none / 门 299 读 86 / 文件实际无 SubscriptionsScreen 依赖）
- [x] 不 push；worktree 保留供复核
- [x] 终报（Markdown）

## 验收

- 台账 93 行、复制页 86
- 共享屏零平台 API（`rg "Taro|Platform|Share\.|FileSystem"` 0 命中）
- 页内渲染 ≤180（B1/B5/B6 保留与否影响此值，见 spec §4.3 裁决）
- 重复 UI 段 0
- 双端消费点 `file:line` 具名

## 裁决落地记录（2026-11-05，用户三点裁决）

1. **web 不接入，本批判定「web 不可接入」**（最终措辞，不再尝试、后续批次不得重问）：
   `apps/web/app/(main)/news/PageClient.tsx:64-82` 为桌面双栏，`NewsSidebar` 分类与 pinned 各有自有数据源（`:49-53`）、页码分页（`:69-72`）；共享屏根 `flex:1` + FlatList 需定高（`SquareScreen.tsx:191-214,232-235`）。为接一屏而删 pinned 侧栏与页码分页 = 给 web 用户降级，非单源化应付代价。**消费端只有 RN。**
2. **共享卡片补封面/时间线：只做加法**。新字段一律可选（`coverUrl?`、`timeline?`），缺省分支必须与现视觉逐像素等价（RN 不改一行）；单测锁两侧（传 ⇒ 渲染；不传 ⇒ 旧分支）。补完**不立即换壳**（B1/B5/B6/B7 仍在页内，硬标①过不去）。
3. **缺段维持**：B1 tab / B5 排行榜 / B6 兴趣赛道 / B7 分享卡（需注入点）不做；**B3 搜索改 parity 做**（共享屏加搜索栏 + RN 传 keyword/onSearch）。
- 台账口径：`mapStatus` 改 `none`、行数仍 93；门报「存量台账 90 行」= 剔除 3 条退休后口径，报告两处都写。
- `contracts/index` 纯复制、`learn-develop` 桶②（三段纯小程序业务，上端属产品新增待立项）—— 已认。

## 第二批（2026-11-05）：B3 parity + A 方案前置

- [x] `getNews` 的 `keyword → search` 归一（`packages/api-client/src/endpoints/community.ts:270-275`）；单测断言**实发键名为 `search`**（`news-keyword.test.ts`），阴性对照改回直传 ⇒ 必红（`expected '/news/articles?...keyword…' to contain 'search='`）
- [x] `getNews` 调用点 grep：仅 RN `NewsScreen.tsx:336`、web `HomeModules.tsx`、extension `NewsPage.tsx`，**无一处传 `keyword`/`search`**，无冲突
- [x] A 方案 api-client：`getLiveSubscriptions()` → `GET /api/live/subscriptions`、`unsubscribeLive()` → `DELETE /api/live/:id/subscribe`（路径逐字，`live-subscriptions.test.ts` 断言）；类型实名 `coverImage`/`lecturerName`/`status:number`，未造 `coverUrl`/`anchor`
- [x] 共享屏 B3：`keyword`/`onKeywordChange`/`onSearch`/`searchPlaceholder`，传 `onKeywordChange` 才渲染（旧调用方零变化）；RN `NewsScreen.tsx` 接 keyword 态并拼参、清空即回全量；单测 7 条（含两侧对照），阴性对照摘 `onChangeText` 必红
- [x] 四端 tsc 0（另加 api-client 0）；门 299 复制页仍 86；门 105 绿
- **status=1 语义（披露）**：`findUserSubscriptions` 只回 `status=1`（`apps/api/src/db/live-queries.ts:397-405`）；`status` 是**启用/上线**标志（对照 `live.ts:26` 分类「1=启用 0=禁用」），**直播中是 `isLive`**（`live.ts:55`），发布与否是 `isPublished`。小程序 `subscribe.tsx:46` 的 `'upcoming'` 是客户端**按时间推导**的 `LiveStatus`（`packages/types/src/app-live.ts:45`），与 DB `status` 不同轴 ⇒ **行为变化：从「全部即将开播」变「我订阅的频道（含直播中/已结束）」，不是换壳**，须单独向用户披露。
- [ ] 遗留：小程序 `@/api` 的 `getLiveList` 打 `/live/list`（`subscribe.tsx:10`），全仓无该路由 ⇒ 现状页数据源疑似失效，需单独立项核对，不在本批处理。
