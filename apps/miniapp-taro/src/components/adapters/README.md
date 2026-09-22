<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Taro 适配层 (apps/miniapp-taro)

> 跨端共享组件的 Taro 端薄包装层 — P2-F 架构性阻塞项起步 + 二批深化 + 三批 9 屏

## 1. 目标

`packages/app` 是 IHUI-AI 跨端共享 UI 组件的单一来源(当前主要服务于 mobile-rn / 未来 web 端)。
由于 Taro 4 + 微信小程序 渲染管线与 React Web / React Native 不兼容(`div`/`span` → `View`/`Text`,
`onClick` → `onTap`,`overflowX:auto` → `ScrollView` 等),本目录为 Taro 端**薄适配层**,
复用 `packages/app` 的 props 契约、状态机、主题 token 注入逻辑,仅替换 web 元素。

## 2. 当前已迁移(3 个,全部已在 page 接线)

| 共享组件                      | Taro 适配文件             | 行数 | 替换要点                                                                              |
| ----------------------------- | ------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `packages/app/SectionHeader`  | `SectionHeader.taro.tsx`  | ~95  | `div`/`span` → `View`/`Text`;`onClick` → `onTap`;rpx 单位转换                         |
| `packages/app/ColorfulLoader` | `ColorfulLoader.taro.tsx` | ~88  | `div`/`span` → `View`;HSL 着色算法保留;`document` keyframes → Tailwind `animate-spin` |
| `packages/app/Selecter`       | `Selecter.taro.tsx`       | ~280 | `div + overflowX:auto` → `ScrollView scrollX`;`onClick` → `onTap`;5 种 type 行为保留  |

接线点:`pkg-learn/course/list` + `course-planet` + `pkg-shop/wallet/commission`(SectionHeader /
ColorfulLoader)+ `components/ModelConfigDialog`(Selecter)。

### 三批清理台账(2026-09-22,合计移除 4662 行零引用死代码)

| 批次 | 对象 | 行数 | 判据 |
| ---- | ---- | ---- | ---- |
| 一批 | 9 个屏级适配器(Feedback/Settings/Order/Wallet/MessageCenter/StudyPlan/Certificate/NoteList/NoteDetail) | 3078 | 小程序端 9 个对应屏均有自有页面在跑,接线即造第三份实现 |
| 二批 | PayButton / TabBar / Toolbar 适配器 + 端内孤儿 `components/PayButton.tsx` | 953 | 支付能力由 `PayPopup` 承接;TabBar 走原生 tabBar + `setTabBarStyle`;Toolbar 仅有职责不同的 `BottomActionBar` |
| 三批 | Carousel / NavBar / UserInfoCard 适配器 | 631 | **同名 ≠ 同契约**(见下) |

**三批判据(本目录最重要的教训)**:适配器复用 `packages/app` 的 props 契约,而端内同名组件早在
P2-F 立项前就已各自演进,两者是**不重叠的两套接口**,接线等于掉功能:

- `Carousel`:端内 `items`/`interval`/`onItemClick` + **`variant:'default'|'course'` + `courseMeta`**;
  适配器 `banner`/`autoplayInterval`/`onItemPress`,**`variant`/`courseMeta` 命中 0**
  → `pkg-learn/course-planet` 的课程卡模式会直接失效。
- `NavBar`:端内 `showBack`/`bgColor`/`textColor`/`rightText`/`onRightClick`/`notification`/
  **`variant:'default'|'ai-home'`**/`onMenuClick`(4 个 tabbar 首页级在用);适配器只有
  `title`/`subtitle`/`transparent`/`statusBarHeight`。
- `UserInfoCard`:端内吃扁平字段(`level`/`growthValue`/`growthMax`/`tokenValue`/`identityType`);
  适配器吃 `userInfo` 对象 + `onRecharge`/`onEdit`/`onLogin`。

后续若要跨端共享这三个,正解是**先统一 props 契约再下沉**,而不是把适配器接上去。
守门 64(`scripts/check-adapter-wiring.mjs`)基线已清零,新增未接线适配器一律 BLOCK。

## 3. 架构原则

### 3.1 不做"另写一份实现"

- ✅ 复用 `packages/design-tokens` 的 `getRnTokens(colorScheme)` 注入主题(与 `packages/app/theme/tokens` 同源,mobile-rn 端 1:1 对齐)
- ✅ 复用 `packages/app/src/components/*.tsx` 的 5 种 type 配置、状态机逻辑、HSL 着色算法
- ✅ props 字段名 + 类型完全对齐(`SectionHeaderProps` / `PayButtonProps` / `SelecterProps` 等)
- ❌ 禁止在适配层重新声明业务逻辑(如 PayButton 的 type→颜色映射、Selecter 的 ratio 二级选择)
- ❌ 禁止复制 `TFunction` 类型,直接 `import type { TFunction } from '@ihui/types'`

### 3.2 i18n 三级降级

```
prop t (强制注入) > I18nContext t (useTt) > 硬编码中文 fallback
```

适配层使用 `useTt()`(miniapp-taro 端 I18nContext)作为 i18n 默认实现,适配层允许通过 `t` prop 覆盖,
未传 `t` 时降级到硬编码中文,保证最小可用。

### 3.3 主题色 token 复用

颜色通过 `getTokens(colorScheme)` 共享注入,支持 light/dark 双主题。
miniapp-taro 端已通过 `sync-design-tokens.mjs` 同步 `packages/design-tokens/src/styles/tokens.css`
到 `app.css`(pre-commit 第 36 项 blocking),主题色在 4 端保持一致。

### 3.4 Taro 端特殊处理

- **rpx 单位换算**:CSSProperties 中的 px 数值统一通过 `toRpx()` 转为 `rpx` 字符串,保持与 miniapp-taro 全局风格一致(1px = 2rpx,750 设计稿基准)
- **HSL 颜色字符串**:Taro View 端 HSL 字符串可直接生效(编译后通过内联 style 透传),不依赖 CSS @keyframes
- **Modal 自绘**:Taro `@tarojs/components` 未提供 styled `Modal`,沿用 packages/app 的 View 自绘 + onTap 模式
- **Tailwind `animate-spin`**:替代原 web 端 `document.head` 注入 `keyframes.spin`(小程序环境无 document)
- **下拉刷新**:RN `ScrollView refreshControl={<RefreshControl>}` → Taro `ScrollView refresherEnabled + refresherTriggered + onRefresherRefresh`
- **文本截断**:RN `numberOfLines={N}` → CSS `whiteSpace:nowrap + textOverflow:ellipsis`(单行)/ `display:-webkit-box + WebkitLineClamp:N`(多行)
- **RN 专有 CSS 属性**:`paddingHorizontal`/`paddingVertical` → 标准 CSS `paddingLeft/Right`/`paddingTop/Bottom`

## 4. 验证清单(本批次必须全绿)

```bash
pnpm --filter @ihui/miniapp-taro typecheck      # TS 严格类型 0 错误
pnpm --filter @ihui/miniapp-taro lint           # ESLint 0 错误(含 no-explicit-any)
```

> 当前适配层保留 **3 个**适配器(SectionHeader / ColorfulLoader / Selecter),**全部已在 page 接线**
> (`pkg-learn/course/list` + `course-planet` + `pkg-shop/wallet/commission` + `components/ModelConfigDialog`)。
> 2026-09-22 三批清理零引用死代码合计 **4662 行**:一批 9 个屏级适配器 3078 行、
> 二批 PayButton/TabBar/Toolbar + 端内孤儿 PayButton 共 953 行、
> 三批 Carousel/NavBar/UserInfoCard 共 631 行(**同名但 props 契约不重叠,接线即掉功能**)。
> 取证与判定见 `PROJECT_PLAN.md` P2-F.5/P2-F.6;新增适配器必须接线,由守门 64 `check-adapter-wiring.mjs` 强制(基线已清零)。

## 5. 未来扩展(本批次不做)

- ~~剩余 6 个通用件在 page 替换端内同名旧实现~~ — **本条已作废(2026-09-22 三批清理)**:实测两侧 props 契约不重叠(见 §2 台账),替换即掉功能而非去重;真要共享须**先统一契约再下沉**。
- 屏级适配层不再新增:小程序端 9 个对应屏(settings / order / message / plan / certificate / note / feedback / wallet)均有自有页面在跑,再造第二份即第三份实现。
- 适配层单元测试(`*.test.tsx` 用 `@tarojs/test-utils` mock View/Text/ScrollView)— 仅对现存 3 个适配器有意义
- `packages/app` 若将来要支持 H5 + 小程序 + RN 三端:前提是 web 端先迁到 `packages/ui-react`,且必须先解决本目录踩过的契约分叉问题(适配器与端内组件平行演进,同名不同接口)。A 路线(直引 ui-react)已实测否决,见 `PROJECT_PLAN.md` P2-F.5。

## 6. 守门

- 禁止在适配层引入 `any`(AGENTS.md §3 TypeScript 类型零技术债强制)
- 禁止把 `useTt()` 替换为 `useTranslation`(后者依赖 next-intl,web 端专用)
- 禁止硬编码颜色 hex/rgb,统一用 `getTokens(colorScheme).*` 注入 — 现由**守门 66** `check-adapter-style-parity.mjs` 在 pre-commit 拦截(基线只减不增)
- 禁止新增 `onClick` / `onMouseDown` / `onKeyDown`(Taro 端统一 `onTap`)
- 新增适配器必须**接线**且与 `packages/app` 契约一致 — 由**守门 64** `check-adapter-wiring.mjs` 强制(基线已清零,零豁免)
- 端内同名组件**不必然**要被适配器替换:三批清理的结论是,当两侧 props 契约不重叠时,端内版才是页面真正依赖的实现,
  正确处置是删适配器(现存 3 个 SectionHeader / ColorfulLoader / Selecter 是契约确实一致的那批),而不是反过来迁就适配器。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
