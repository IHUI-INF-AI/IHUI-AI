<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# @ihui/ui-native — 契约与边界

一句话职责:React Native 侧的共享基础组件库(13 个组件 + 一组跨端同名组件的 props 类型)。
它是 `@ihui/ui-react`(web 侧)的对应物,两者**共享同一份 props 契约** —— 契约住在
`@ihui/design-tokens` 的 `component-props`,不住在本包。

## 1. 对外给谁用(现查 HEAD,`git grep -l "from '@ihui/ui-native'" HEAD -- apps packages`)

11 个文件,**全部在 `apps/mobile-rn` 一个端**,`packages/**` 零引用:

- 生产面 10 个:`src/components/AgentRuntimePanel.tsx`、`BottomFigure.tsx`、`Carousel.tsx`、`Menu.tsx`、
  `ModelConfigDialog.tsx`、`VideoPlayer.tsx`、`src/screens/AgentScreen.tsx`、`ChatScreen.tsx`、
  `HomeScreen.tsx`、`MoreCourseScreen.tsx`
- 测试面 1 个:`tests/ui-field-registry.test.ts`

## 2. 公开面(package.json `exports` 只有 `"."`,`main`/`types` = `./src/index.ts`)

`src/index.ts` 逐名递出(不是整表 `export *`,除最后一条):

- 基础件:`Button`/`buttonVariants`、`Input`、`Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`、
  `Loading`/`Spinner`、`VipBadge`、`Dialog`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`、
  `Avatar`、`Badge`/`badgeVariants`、`Tabs`、`Switch`、`Tooltip`、`Sheet`、`Collapsible`(含各自 Props 类型)
- `export * from './business/types'` —— 这一条是**纯 re-export**:14 个跨端同名组件的 props 类型
  (`CarouselItem`、`MenuItem`、`AgentRuntimeStatus`、`AgentRuntimePermissionEvent`、`AgentRuntimePanelProps`、
  `ModelConfigType`、`TitleSwitchOverlapItem/Props`、`TitleSwitchScrollPickerItem/Props`、
  `TitleSwitchScrollTitleItem/Props`、`TitleSwitchTypeBarItem/Props`),**主源在 `@ihui/types`**。
  该文件头注明写:miniapp-taro 不依赖本包(RN 专用),要同一批类型请从 `@ihui/types` 取。

## 3. 依赖方向与边界(`- id: 'packages/ui-native'`)

`layer: composite` · `exported: true` · `managed: true` ·
`requires: ['packages/design-tokens', 'packages/types']` · `public_entrypoints: ['.']`

- 两条 requires 都**有真实调用点**,不是纸面声明:10 个组件文件 `import { cn } from '@ihui/design-tokens'`
  (`vip-badge.tsx` 只取类型 `VipBadgeBaseProps`),`business/types.ts:35` 从 `@ihui/types` 取 14 个类型。
  层级 composite(30) → contract(10),方向合规。
- 运行时依赖只有 `class-variance-authority`(`button.tsx`、`badge.tsx` 用);
  `react` / `react-native` / `nativewind` 是 **peerDependencies** ⇒ 宿主版本由端定,本包不得自带一份 RN。
- **不得在本包内写颜色/圆角/几何数字**:色档取 `@ihui/design-tokens` 的 `tokens.*`,圆角取 `rnRadius`,
  尺寸取 `rnGeometry`(AGENTS §4 的三条单一源),由守门 77/83/128/150 判。
- 只有 `.` 一个出口 ⇒ `@ihui/ui-native/src/button` 这类穿透是 D3。
- 端内不得为"某个组件差点样式"而在 `apps/mobile-rn` 里再画一个同名组件 —— 本仓有守门 39/40 管回升。

## 4. 已知缺口 / 未收口的点

- **与 `packages/app` 并存成第二套 RN 组件层。** 现查 HEAD:`packages/app` 对 `@ihui/ui-native` 零引用,
  而 `packages/app` 自身也是 `layer: composite` / `managed: true` 的共享层(它的 `components/` 里
  有 BackChevron、MoreLink 等唯一实现)。⇒ "RN 端的基础件走 ui-native 还是走 packages/app"
  **没有一条判据在管**,新组件落到哪一侧全凭当时写它的人。这是归属决策,不是本包能自裁的缺口。
- **只递 TS 源,且没有 `build` 脚本也没有 `test` 脚本**(`scripts` 只有 `typecheck` + `lint`)。
  所以本包没有可分发的 dist,也没有任何自有用例;组件行为的回归完全依赖 `apps/mobile-rn` 那侧的测试。
- `src/nativewind-env.d.ts` 是给 NativeWind 的 ambient 声明,不在任何 export 面上 —— 改它等于改全包的
  className 类型判定,而它没有测试兜底。
- 无自有 `eslint.config.*`(同 `dom-actions` / `browser-platform` / `i18n` 那一格)。
- 本包不声明 `contract_files`,也不命中 `contract_file_patterns` ⇒ E2 齐备性由此文档补足。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
