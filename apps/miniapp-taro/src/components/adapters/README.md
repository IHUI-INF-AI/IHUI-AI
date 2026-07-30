# Taro 适配层 (apps/miniapp-taro)

> 跨端共享组件的 Taro 端薄包装层 — P2-F 架构性阻塞项起步

## 1. 目标

`packages/app` 是 IHUI-AI 跨端共享 UI 组件的单一来源(当前主要服务于 mobile-rn / 未来 web 端)。
由于 Taro 4 + 微信小程序 渲染管线与 React Web / React Native 不兼容(`div`/`span` → `View`/`Text`,
`onClick` → `onTap`,`overflowX:auto` → `ScrollView` 等),本目录为 Taro 端**薄适配层**,
复用 `packages/app` 的 props 契约、状态机、主题 token 注入逻辑,仅替换 web 元素。

## 2. 当前已迁移(本批次,P2-F 起步)

| 共享组件                      | Taro 适配文件             | 行数 | 替换要点                                                                              |
| ----------------------------- | ------------------------- | ---- | ------------------------------------------------------------------------------------- |
| `packages/app/SectionHeader`  | `SectionHeader.taro.tsx`  | ~95  | `div`/`span` → `View`/`Text`;`onClick` → `onTap`;rpx 单位转换                         |
| `packages/app/ColorfulLoader` | `ColorfulLoader.taro.tsx` | ~88  | `div`/`span` → `View`;HSL 着色算法保留;`document` keyframes → Tailwind `animate-spin` |
| `packages/app/PayButton`      | `PayButton.taro.tsx`      | ~290 | `button` → `View`;`onClick` → `onTap`;Modal 自绘;Toast → `Taro.showToast`             |
| `packages/app/Selecter`       | `Selecter.taro.tsx`       | ~280 | `div + overflowX:auto` → `ScrollView scrollX`;`onClick` → `onTap`;5 种 type 行为保留  |

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

## 4. 验证清单(本批次必须全绿)

```bash
pnpm --filter @ihui/miniapp-taro typecheck      # TS 严格类型 0 错误
pnpm --filter @ihui/miniapp-taro lint           # ESLint 0 错误(含 no-explicit-any)
```

> 当前适配层仅完成"可行性验证"阶段(P2-F 起步),尚未在 page 实际替换旧组件。
> 后续动作见 `PROJECT_PLAN.md` 的 P2-F 章节。

## 5. 未来扩展(本批次不做)

- 16 屏共享组件适配(FeedbackScreen / SettingsScreen / ProfileScreen 等) — 见 `packages/types/src/app.ts`
- 适配层单元测试(`*.test.tsx` 用 `@tarojs/test-utils` mock View/Text/ScrollView)
- 适配层 Storybook(@storybook/react-native + taro-rn preset)
- `packages/app` 升级为支持 H5 + 小程序 + RN 三端 — 当前仅 RN;web 端需先迁移到 `packages/ui-react`

## 6. 守门

- 禁止在适配层引入 `any`(AGENTS.md §3 TypeScript 类型零技术债强制)
- 禁止把 `useTt()` 替换为 `useTranslation`(后者依赖 next-intl,web 端专用)
- 禁止硬编码颜色 hex/rgb,统一用 `getTokens(colorScheme).*` 注入
- 禁止新增 `onClick` / `onMouseDown` / `onKeyDown`(Taro 端统一 `onTap`)
- 禁止复用旧 Taro 端 SectionHeader/ColorfulLoader/PayButton/Selecter 业务实现
  (那 4 个文件在 `apps/miniapp-taro/src/components/` 根目录,属"待迁移"阶段)
