# 项目文字样式全面汇总

本文档汇总本项目中所有使用的文字样式来源：设计令牌、全局样式、响应式字体、组件与页面内联样式。

---

## 一、设计令牌与全局变量

### 1.1 字体族 (Font Family)

| 来源 | 变量/类名 | 取值 | 用途 |
|------|-----------|------|------|
| **fonts-unified.scss** `:root` | `--font-family-chinese` | `'HarmonyOS Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif` | 中文正文、全局默认 |
| | `--font-family-english` | `'HarmonyOS Sans SC', -apple-system, ...` | 英文环境 |
| | `--font-family-heading` | `'HarmonyOS Sans SC', sans-serif` | h1–h6 标题 |
| | `--font-family-mono` | `'HarmonyOS Sans SC', monospace` | code / pre / kbd / samp（等宽用鸿蒙） |
| | `--font-family-edix` | `'EDIX', sans-serif` | 英文标题装饰字体 |
| **工具类** | `.font-edix` | 使用 EDIX | 首屏/定价等英文标题 |
| | `.font-default` | 使用 chinese | 恢复默认 |
| | `.font-mono` | 使用 mono | 等宽/代码（鸿蒙） |

**@font-face 定义（fonts-unified.scss）：**

- HarmonyOS Sans SC：Regular (400)、Semibold (600)、Bold (700)，woff2 子集
- EDIX：英文标题，woff2 子集  
- 本项目仅使用以上两种字体，无其他自定义 @font-face

---

### 1.2 文字颜色 (Text Color)

| 变量 | 亮色模式 | 暗色模式 | 说明 |
|------|----------|----------|------|
| **Element Plus / 设计令牌** | | | |
| `--el-text-color-primary` | `（--color-dark-bg-1）` | `（--color-gray-e5eaf3）` | 主文字 |
| `--el-text-color-regular` | `（--color-gray-222）` | `（--color-gray-cfd3dc）` | 常规正文 |
| `--el-text-color-secondary` | `（--color-gray-333）` | `（--color-gray-a3a6ad）` | 次要/说明 |
| `--el-text-color-placeholder` | `（--color-gray-a8abb2）` | `（--color-gray-8d9095）` | 占位符 |
| `--el-text-color-disabled` | `（--color-gray-c0c4cc）` | `（--el-text-color-primary）` | 禁用 |
| **应用语义** | | | |
| `--app-text-primary` | `var(--el-text-color-primary)` | 同左 | 主文字 |
| `--app-text-secondary` | `var(--el-text-color-regular)` | 同左 | 次要 |
| `--app-text-muted` | `var(--el-text-color-secondary)` | 同左 | 弱化 |
| **统一排版模块** | | | |
| `--global-text-color` | （未在代码库中显式定义，建议映射到 `--el-text-color-primary`） | 同左 | _typography-unified 中标题/正文使用 |
| `--global-text-color-secondary` | 同上，建议映射 secondary | 同左 | 辅助文字 |
| `--global-text-color-placeholder` | 同上，建议映射 placeholder | 同左 | 占位 |

**设计语言规范（design-language.mdc）：**

- 主文字：亮 `（--color-gray-111）` / 暗 `（--color-gray-ededed）`
- 次文字：亮 `（--color-gray-666）` / 暗 `（--color-gray-a1a1a1）`
- 禁用/辅助：`（--color-gray-888888）`

---

### 1.3 字号 (Font Size) — 设计令牌静态值

**_design-tokens.scss（SCSS 变量）：**

| 变量 | 值 | 用途 |
|------|-----|------|
| `$font-size-xs` | 12px | 辅助/标签 |
| `$font-size-sm` | 14px | 说明/次要 |
| `$font-size-base` | 16px | 正文 |
| `$font-size-lg` | 18px | 强调 |
| `$font-size-xl` | 20px | 小标题 |
| `$font-size-2xl` | 24px | 中标题 |
| `$font-size-3xl` | 30px | 大标题 |
| `$font-size-4xl` | 36px | 超大标题 |
| `$font-size-5xl` | 48px | 页面主标题 |
| `$font-size-6xl` | 60px | 英雄区标题 |

**Premium 扩展：**

- `$font-size-premium-title`: `clamp(32px, 5vw, 48px)`
- `$font-size-premium-subtitle`: `clamp(16px, 2vw, 20px)`
- `$font-size-premium-display`: `clamp(40px, 6vw, 56px)`

---

### 1.4 响应式字号 (responsive-fonts.scss)

| CSS 变量 | 取值 | 用途 |
|----------|------|------|
| `--font-size-base` | 16px | 基准 |
| `--font-size-xs` | `clamp(10px, 2vw, 12px)` | 辅助/标签 |
| `--font-size-sm` | `clamp(12px, 2.5vw, 14px)` | 说明 |
| `--font-size-base-responsive` | `clamp(14px, 3vw, 16px)` | 正文（随视口） |
| `--font-size-lg` | `clamp(16px, 3.5vw, 18px)` | 强调 |
| `--font-size-xl` | `clamp(18px, 4vw, 20px)` | 小标题 |
| `--font-size-2xl` ~ `--font-size-7xl` | 20px ~ 80px 的 clamp | 各级标题 |

**工具类：** `.text-xs` ~ `.text-7xl` 对应上述变量。

**断点覆盖：**

- 最大宽度 480px：xs=10px, sm=12px, base=14px, 5xl=32px, 7xl=48px 等固定值
- 481–768px：base 使用 `clamp(15px, 3vw, 16px)`
- ≥769px：base 使用 `clamp(16px, 1.2vw, 18px)`
- ≥1920px：5xl/6xl/7xl 上限 56/72/96px

---

### 1.5 字重 (Font Weight)

| 来源 | 变量/类名 | 值 |
|------|-----------|-----|
| **_design-tokens.scss** | `$font-weight-light` | 300 |
| | `$font-weight-normal` | 400 |
| | `$font-weight-medium` | 500 |
| | `$font-weight-semibold` | 600 |
| | `$font-weight-bold` | 700 |
| | `$font-weight-extrabold` | 800 |
| **_typography-unified.scss** | `.font-light` ~ `.font-bold` | 300–700 |
| **Header 系统** | `--header-btn-font-weight` | 700 |
| | `--menu-item-font-weight` | 700（桌面）/ 500（下拉项） |
| | `--header-dropdown-item-font-weight` | 500（激活 700） |

---

### 1.6 行高 (Line Height)

| 来源 | 变量/类名 | 值 |
|------|-----------|-----|
| **_design-tokens.scss** | `$line-height-tight` | 1.2 |
| | `$line-height-snug` | 1.375 |
| | `$line-height-normal` | 1.5 |
| | `$line-height-relaxed` | 1.625 |
| | `$line-height-loose` | 2 |
| **responsive-fonts.scss** | `--line-height-tight/normal/relaxed/loose` | 同上 |
| **_typography-unified.scss** | `.leading-none` ~ `.leading-loose` | 1 ~ 2 |

---

### 1.7 字间距 (Letter Spacing)

| 来源 | 类名/用法 | 值 |
|------|-----------|-----|
| **_typography-unified.scss** | `.tracking-tight` | -0.025em |
| | `.tracking-normal` | 0 |
| | `.tracking-wide` | 0.025em |
| | `.tracking-wider` | 0.05em |
| **设计语言** | 大标题 | -0.02em |
| | 正文/短标签 | 0.01em |
| **页面内联**（如 LearnAI.vue） | 主标题 | -0.04em ~ -0.02em |
| | 标签/大写 | 0.5px ~ 1px、`text-transform: uppercase` |

---

## 二、统一排版模块 (_typography-unified.scss)

### 2.1 标题 (h1–h6 / .h1–.h6)

| 选择器 | font-size | font-weight | line-height | letter-spacing | color |
|--------|-----------|-------------|-------------|----------------|-------|
| h1 / .h1 | 36px (≤768: 30px, ≤640: 24px) | 700 | 1.25 | -0.02em | --global-text-color |
| h2 / .h2 | 30px (24/20) | 700 | 1.25 | -0.01em | 同上 |
| h3 / .h3 | 24px (20/18) | 600 | 1.375 | — | 同上 |
| h4 / .h4 | 20px (18) | 600 | 1.375 | — | 同上 |
| h5 / .h5 | 18px | 500 | 1.5 | — | 同上 |
| h6 / .h6 | 16px | 500 | 1.5 | — | 同上 |

### 2.2 正文与辅助

| 类名 | font-size | line-height | color |
|------|-----------|-------------|-------|
| .body-lg | 18px | 1.625 | --global-text-color |
| .body-base, p | 16px | 1.625 | 同上 |
| .body-sm | 14px | 1.5 | 同上 |
| .body-xs | 12px | 1.5 | 同上 |
| .text-muted | — | — | --global-text-color-secondary |
| .text-hint | — | — | --global-text-color-placeholder |
| .text-primary / .text-success / .text-warning / .text-danger / .text-info | — | — | 对应 Element 语义色 |

### 2.3 工具类（同一文件内）

- **字号：** `.text-xs`(12px) ~ `.text-4xl`(36px)（与 utilities/_typography 及 responsive-fonts 存在重叠，注意加载顺序）
- **字重：** `.font-light`(300) ~ `.font-bold`(700)
- **对齐：** `.text-left/center/right/justify`
- **装饰：** `.underline` / `.line-through` / `.no-underline`
- **变换：** `.uppercase` / `.lowercase` / `.capitalize` / `.normal-case`
- **字间距：** `.tracking-tight/normal/wide/wider`
- **行高：** `.leading-none` ~ `.leading-loose`
- **截断：** `.ellipsis`（单行省略）

### 2.4 代码与引用

- **code：** `var(--font-family-mono)`（鸿蒙 + monospace），0.875em，圆角背景
- **pre：** 14px，1.625 行高，背景+圆角
- **blockquote：** 左边框+主色，斜体，次要色

---

## 三、Header 与导航文字

| 变量/位置 | 字号 | 字重 | 行高 | 颜色 |
|-----------|------|------|------|------|
| `--header-btn-font-size` | 15px | 700 | — | — |
| `--menu-item-font-size` | 14px（平板 13px，大屏 15px） | 700 | 1.5 | --el-text-color-primary |
| `--header-dropdown-item-font-size` | 14px | 500（激活 700） | — | 同上 |
| HeaderNavigation 下拉项 | 14px | 500 | — | --el-text-color-primary |
| 移动端菜单项 | 14px | 500 | — | 同上，letter-spacing 0.01em |

---

## 四、页面/视图内联文字样式（典型）

### 4.1 LearnAI.vue

- **页面根：** `font-family: 'HarmonyOS Sans SC', 'Inter', system-ui, sans-serif`，颜色 `$text-main` / `$text-sec`（映射 --el-text-color-primary/secondary）
- **主标题：** `clamp(42px, 5vw, 72px)`，950，line-height 1.2，letter-spacing -0.04em
- **副标题/描述：** 18px，颜色 $text-sec，line-height 1.8
- **区块标题：** 22px–42px，字重 800–950，部分 letter-spacing -0.02em
- **正文/说明：** 12px–18px，字重 600–900，line-height 1.5–1.8
- **标签/角标：** 10px–12px，700–900，部分 `text-transform: uppercase`，letter-spacing 0.5px–1px
- **等宽：** `font-family: monospace`（如 section 序号）
- **按钮 .btn-luxe：** 14px，700

### 4.2 EduDocumentation.vue

- **局部 SCSS 变量：** `$text-primary: （--el-text-color-primary）`，`$text-secondary: （--color-gray-4e5969）`，`$text-muted: （--el-text-color-primary）`
- **标题层级：** 24px/18px（700）、32px/24px/18px/15px（600–700），letter-spacing -0.02em ~ -0.01em
- **标签：** 12px（600），大写，letter-spacing 0.05em，$text-muted
- **代码块：** `var(--font-family-mono)`，13px

### 4.3 InlineOfficeViewer.vue

- 14px，500，line-height 1.5，颜色 --el-text-color-secondary，部分 text-align: center

---

## 五、设计系统 JS (useDesignSystem.ts)

**Typography 配置：**

- **sizes：** xs 12px, sm 14px, base 16px, lg 18px, xl 20px, 2xl 24px, 3xl 30px, 4xl 36px
- **weights：** normal 400, medium 500, semibold 600, bold 700

通过 `getFontSize()` / `getFontWeight()` 和 `applyDesignSystem({ fontSize, fontWeight })` 在组件中应用。

---

## 六、Tailwind 与工具层

- **tailwind.config.js：** 未扩展 `fontSize` / `fontWeight` / `letterSpacing`，仅扩展了 colors、borderRadius 等。
- **utilities/_typography.scss：** 使用 design-tokens 的 `$font-size-*`、`$font-weight-*` 定义 `.text-xs` ~ `.text-4xl`、`.font-normal` ~ `.font-bold` 以及 `.text-center/right/left`。

---

## 七、汇总与建议

### 7.1 文字样式来源一览

| 类型 | 主要来源 | 备注 |
|------|----------|------|
| 字体族 | fonts-unified.scss, runtime-overrides.scss | 全局 + EDIX/mono 工具类（仅鸿蒙+EDIX） |
| 文字颜色 | _design-tokens.scss（亮/暗 mixin）、index.scss :root | 以 --el-text-* 与 --app-text-* 为主 |
| 字号 | _design-tokens.scss（静态）、responsive-fonts.scss（响应式）、_typography-unified、utilities/_typography | 存在多套 .text-*，需注意优先级与统一 |
| 字重 | _design-tokens、_typography-unified、Header 变量、页面内联 | 500–950 在 Landing 中大量使用 |
| 行高 | _design-tokens、responsive-fonts、_typography-unified | 1.2–2 |
| 字间距 | _typography-unified 工具类、设计语言、页面内联 | -0.04em ~ 0.05em |

### 7.2 潜在问题与建议

1. **--global-text-color** 在 _typography-unified 和 _components-unified 中被使用，但未在代码库中显式定义，建议在 `:root` 或 design-tokens 中映射到 `--el-text-color-primary`（以及 secondary/placeholder），避免依赖浏览器 fallback。
2. **.text-xs` ~ `.text-4xl` 存在三处定义：** responsive-fonts（响应式 CSS 变量）、_typography-unified（固定 px）、utilities/_typography（design-tokens 变量）。建议统一到一套（例如以 responsive-fonts + 设计令牌为主），其余改为引用或废弃，避免冲突。
3. **设计语言规范**（（--color-gray-111）/（--color-gray-ededed）/（--color-gray-666）/（--color-gray-a1a1a1）/（--color-gray-888888））与当前 `--el-text-color-*`（（--color-dark-bg-1）/（--el-text-color-primary）/（--el-text-color-primary） 等）不完全一致，若需严格符合规范，可在 design-tokens 的亮/暗 mixin 中微调主色与次色。
4. **页面内联字号/字重**（如 LearnAI 中 10px–72px、600–950）较多，若需全站统一层级，可逐步收拢到设计令牌或统一排版类（如 .section-title、.hero-title），减少硬编码。

---

*文档生成自项目代码扫描，最后更新可随代码变更修订。*
