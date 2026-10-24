# RN 端 × 小程序端 设计语言与组件契约(「一模一样」唯一真相源)

> 目标:`apps/mobile-rn`(Expo/RN)与 `apps/miniapp-taro`(Taro→微信)是两套框架,**源码不可能同一份**。
> 「一模一样」落在三层对齐 —— ① 设计语言(token)② 组件规格(视觉契约)③ 页面与流程。
> 本文是这三层的契约,所有页面精修与两端对齐都以它为准。
> 关联治理:`scripts/check-cross-end-ui-parity.mjs`(门 128)、`check-radius-role-conformance.mjs`、
> `check-cross-end-tokens.mjs`、`check-miniapp-taro-design-tokens.mjs`、`check-rn-parity.mjs`、
> `check-miniapp-parity.mjs`、`check-adapter-parity.mjs`。

---

## 1. 设计语言 token 层(单一真相源)

所有值定义在 `packages/design-tokens`,两端各自投影消费。**禁止在端内再写第二份字面量**。

| 维度 | 真相源文件 | RN 消费入口 | 小程序消费入口 | 说明 |
| --- | --- | --- | --- | --- |
| 颜色 | `rn-tokens.ts` ↔ `styles/tokens.css` | `getRnTokens(mode)` | `var(--color-*)` / `getRnTokens` | 由 `sync-rn-tokens.mjs` 派生,改色只改 tokens.css |
| 圆角 | `radius.js` | `rnRadius` / `rnRadiusFor[role]` | `rnRadius` / `RADIUS_REM` / `var(--radius-*)` | 角色→档位唯一映射见 `RADIUS_ROLES` |
| 几何 | `geometry.js` | `rnGeometry`(dp) | `taroGeometry`(rpx=dp×2) | 命中块/图标/抽屉宽等 |
| **间距** | **`spacing.ts`(本轮新增)** | `rnSpacing` / `rnSpacingFor[role]` | `taroSpacing` / `taroSpacingFor[role]`(rpx) | 4px 基,语义角色见 `SPACING_ROLES` |
| **字号** | **`typography.ts`(本轮新增)** | `rnType[step]` → `{fontSize,lineHeight,weight}` | `taroType[step]` → `{fontSize:rpx,...}` | 与 geometry 文字档对齐 |
| **阴影** | **`elevation.ts`(本轮新增)** | `rnElevation[step]`(ShadowStyle 四元组) | `taroElevation[step]` / `ELEVATION_CSS_VAR` | 轻投影,opacity 0.05→0.16 |
| z-index | `token-registry.ts` | — | — | 层级 |

### 1.1 间距档位(新增)

```
SPACING_STEPS: none0 xs4 sm8 md12 lg16 xl20 2xl24 3xl32 4xl40 5xl48 6xl64
SPACING_ROLES: gapTight:xs gap:sm gapLoose:md stack:lg section:xl
               pagePadX:lg cardPad:lg cardPadSm:md listItemPadX:lg listItemPadY:md
```

### 1.2 字号档位(新增)

```
caption 11/16/400   label 12/16/400   body 14/20/400   strong 15/22/500
title 16/24/600     subtitle 18/26/600 heading 20/28/700 display 24/32/700 displayLg 30/38/700
```

### 1.3 阴影档位(新增)

```
none → 无            sm  → 0 1px 2px /0.05
md  → 0 2px 8px /0.08   lg  → 0 4px 16px /0.12   xl → 0 8px 24px /0.16
```

---

## 2. 组件视觉契约(两端必须一致)

下列组件在两端**都存在同名实现**,必须共用同一份视觉契约。契约字段全部引用第 1 节 token,
**不得写死数字**。门 128 按此契约对账。

| 组件 | 圆角角色 | 内边距 | 字号 | 阴影 | 颜色 token | RN 实体现状 | 小程序实体现状 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Button / 主按钮 | control(sm) | cardPadSm | strong | none | `brand.cta`+`ctaForeground` | `ui-native/button.tsx` | `components/Button.tsx`(本轮新增,逐类镜像 ui-native/button.tsx;底/字色/尺寸档共用 `button-variants.ts` 的 SHARED_BUTTON_*) |
| Card / 卡片 | card(lg) | cardPad(lg) | body | none | `surface.card`+`border.light` | `ui-native/card.tsx` | 各页内联 / 新增 `components/Card.tsx` |
| Input / 输入框 | control(sm) | cardPadSm | body | none | `surface.inputBg`+`border.light` | `ui-native/input.tsx` / `packages/app/TextField` | 各页内联 FocusField / 新增 `components/Input.tsx`(逐类镜像 ui-native/input.tsx,基座 `h-10 rounded-sm border border-input bg-transparent px-3 text-sm text-foreground`;聚焦描边复用 `useFieldFocus` 取 `var(--color-primary)`,不接 RN AI 注册表) |
| NavBar / 顶栏 | — | pagePadX | title | none | `surface.chrome` | `mobile-rn NavBar` / `packages/app NavBar` | `@/components/NavBar` |
| TabBar / 底栏 | panel(xl) | — | label | none(glass) | `glass.bg` | `mobile-rn TabBar` | `custom-tab-bar` |
| Dialog / 弹窗 | panel(xl) | cardPad(lg) | title/body | xl | `surface.card`+`overlay.modal` | `ui-native/dialog.tsx` | `@/components/ConfirmDialog`(已 1:1 打磨:遮罩 `bg-[var(--color-black-50)]`=RN `bg-black/50`、容器 `bg-background`+圆角 `rounded-lg`+边框 `border-border`、RN 子组件 API 分歧如实标注) |
| Sheet / 底部弹层 | panel(xl) | cardPad(lg) | body | lg | `surface.card` | `ui-native/sheet.tsx` | `*Popup` 散件 / 新增 `components/Sheet.tsx`(逐类镜像 ui-native/sheet.tsx;API `open`/`onOpenChange`/`children`/`side` 同形;遮罩 `var(--color-black-50)`、面板 `bg-card p-6 rounded-t-lg`/`rounded-b-lg`、手柄 `h-1.5 w-10 rounded bg-border`;滑入用 CSS `transform+transition` 模拟 RN Animated,无下拉手势关闭,分歧如实标注) |
| Avatar | tiny(xs) | — | — | none | `muted`/`muted-foreground` | `ui-native/avatar.tsx` | `@/components/Avatar`(已 1:1 对齐:circle→`rounded-2xl`、回退 `bg-muted`+`text-muted-foreground`+首字母缩写≤2大写;尺寸遵循共享 `avatar-spec` 五档,sm/md/lg 与 RN 同值) |
| Badge / 徽章 | tiny(xs) | gapTight | caption | none | `brandAccent`/`success`/`danger` | `ui-native/badge.tsx`/`vip-badge.tsx` | 各页领域徽章(UnreadBadge/LevelBadge) / 新增 `components/Badge.tsx`(通用,逐类镜像 ui-native/badge.tsx;variant default/secondary/destructive/outline 复用 `BadgeBaseProps` 共享类型,类常量本地化) |
| VipBadge / VIP 徽章 | tiny(xs) | gapTight | caption | none | amber(#f59e0b/10)+amber-600 | `ui-native/vip-badge.tsx` | 各页无通用件 / 新增 `components/VipBadge.tsx`(逐类镜像 ui-native/vip-badge.tsx;复用 `VipBadgeBaseProps` 共享类型;amber 调色板未进共享 preset,用等价 rgba 内联保「一模一样」) |
| Tooltip | popover(md) | gapTight | caption | sm | `surface.dark`+`text.light` | `ui-native/tooltip.tsx` | `@/components/Tooltip`(已 1:1 打磨:气泡 `bg-popover`+边框 `border-border`+`shadow-md`、文本 `text-popover-foreground`、`max-w-[240px] line-clamp-2`;触发 RN Modal+onLongPress vs 小程序点击,分歧如实标注) |
| Switch | control(sm) | — | — | none | `brand.cta`(on) | `ui-native/switch.tsx` | `components/Switch.tsx`(本轮新增,薄封装 Taro 原生 Switch,逐类镜像 ui-native) |
| Tabs | chip(md) | gap | label | none | `brand.DEFAULT`(active) | `ui-native/tabs.tsx` | `TitleSwitch*` / 新增 `components/Tabs.tsx`(逐类镜像 ui-native/tabs.tsx;受控 `tabs`/`value`/`onChange`+内部非受控兜底;容器 `flex-row rounded-lg bg-muted p-1`,项 `flex-1 rounded-md py-1.5` 激活 `bg-background`,文案 `text-sm font-medium` 激活 `text-foreground`) |
| Loading | — | — | — | none | `brandAccent` | `ui-native/loading.tsx` | `LoadingSpinner`(已 1:1 打磨:spinner `rounded-full`+`border-current border-t-transparent text-primary`,尺寸 w-4/h-4｜w-6/h-6｜w-8/h-8 与 RN 逐像素一致)/`ColorfulLoader` |
| VideoPlayer | card(lg) | — | — | md | `surface.dark` | `mobile-rn VideoPlayer` | `@/components/VideoPlayer` |
| VoiceInput | control(sm) | — | — | none | `brandAccent` | `mobile-rn VoiceInput` | `@/components/VoiceInput` |
| VerifyCodeModal | panel(xl) | cardPad(lg) | body | xl | `surface.card` | `mobile-rn VerifyCodeModal` | `@/components/VerifyCodeModal` |
| Drawer | panel(xl) | pagePadX | body | lg | `surface.card` | `mobile-rn Drawer` | `@/components/DrawerComponent` |
| EmptyState | — | section(xl) | body/label | none | `text.tertiary` | `mobile-rn Empty` | `@/components/EmptyState`/`EmptyIllustration` |
| UserInfoCard | card(lg) | cardPad(lg) | strong/label | md | `surface.card` | `mobile-rn UserInfoCard` | `@/components/UserInfoCard` |

**契约铁律**:同表内同一组件,RN 与小程序在圆角/间距/字号/阴影上必须取同一 token 档。
若出现 `rnRadius.lg` 对 `rounded-xl`(12) 这类跨档偏差,即触发门 128 红。

---

## 3. 页面与流程对齐

页面清单与两端映射见 `rn-miniapp-parity-matrix.md`(由 `scripts/...` 生成,随代码更新)。
对齐顺序按业务优先级:首页 / 对话 / 智能体 / 会员 / 课程 / 社区 / 设置。

**对齐判定标准**(每页逐条核对):
1. 进入方式、路由参数、空态、加载态一致;
2. 主区块使用的组件取自第 2 节契约,视觉参数一致;
3. 暗色模式两套 token 同步翻转(颜色只走 `getRnTokens`,不写死)。

---

## 4. 一致性闸门(防回潮)

- 改 token 改 `packages/design-tokens` 一处,跑 `pnpm check:cross-end-tokens` / `pnpm check:design-tokens-sync`。
- 圆角走 `RADIUS_ROLES` / `rnRadiusFor`,跑 `pnpm check:radius-role`。
- 组件视觉偏差由门 128 `check-cross-end-ui-parity.mjs` 对账(基线 `cross-end-ui-parity-baseline.json`、债务 `cross-end-ui-parity-debt.json`)。
- 小程序 token 一致性跑 `pnpm check:miniapp-parity`(`check-miniapp-taro-design-tokens.mjs` / `check-miniapp-taro-style-parity.mjs`)。
- RN 样式一致性跑 `pnpm check:rn-parity`(`check-mobile-rn-style-parity.mjs`)。

> 任何「让两端看起来一样」的修改,优先改 token / 组件契约,而非在 254 个屏里逐个贴数字。
