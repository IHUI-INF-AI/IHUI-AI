# IHUI-AI Design System Contract

> Category: Internal Product
> 本文件是 IHUI-AI 项目的「品牌设计契约」(Brand Design Contract),遵循 Open Design
> `DESIGN.md` 9 节规范 (awesome-claude-design schema)。所有 Agent 在生成或修改任何 UI
> 代码前,必须将本文件作为系统提示词上下文读取,严格遵循其中的 token、角色与反模式。
>
> 单一事实来源 (Single Source of Truth):
>   - SCSS token 定义: `client/src/styles/_global-tokens.scss` (浅色) +
>     `client/src/styles/_dark-mode-global.scss` (暗色) +
>     `client/src/styles/element-plus-vars.scss` (桥接)
>   - 行为规范: `AGENTS.md` (27 章) + `project_memory.md`
>   - 守门脚本: `client/scripts/check-*.mjs` (pre-commit + E2E 双层)
>
> 守门: `client/scripts/check-design-md.mjs` (防本文件漂移/篡改关键 token 值)

---

## 1. Visual Theme & Atmosphere

扁平化、描边驱动、内容优先。以「描边替代阴影」为核心层级语言,拒绝一切拟物与新拟态。

- **浅色模式**: 白净通透。容器浅灰 `#f7f8fa` 衬底,纯黑文字,全局唯一描边色 `#e9e9e9`。
  装饰极少,留白承担分隔职责。浅色模式颜色应「更白」(背景趋近白,而非灰)。
- **暗色模式**: 深邃纯粹。主背景 `#0d0d0d` 接近纯黑,文字必须为浅色 (`#e5eaf3` 系),
  描边色 `#171717`。暗色模式颜色应「更黑」(背景趋近纯黑,而非深灰)。
- **扁平化硬约束**: 全站禁用 `box-shadow` (`--global-box-shadow: none`),层级用描边
  与背景色差表达,不用投影。禁止 neumorphism(新拟态)、glassmorphism(毛玻璃)。
- **反相对比原则**: 浅色模式与暗色模式的容器背景、描边、强调色应形成「反向对比」
  (浅色模式深字浅底,暗色模式浅字深底;按钮 hover 态描边色也反向)。

---

## 2. Color Palette & Roles

### 2.1 浅色模式 (Light Mode)

| 角色 | Token | 值 | 用途 |
|---|---|---|---|
| 容器背景 | `--el-bg-color` | `#f7f8fa` (`--color-neutral-f7f8fa`) | 卡片/面板/容器底色 |
| 页面背景 | `--el-bg-color-page` | `= --el-bg-color` | 页面主背景 |
| 主文字 | `--el-text-color-primary` | `#000` | 标题/正文主文字 |
| 常规文字 | `--el-text-color-regular` | `= --el-text-color-primary` | 正文 |
| 次要文字 | `--el-text-color-secondary` | `= --el-text-color-primary` | 辅助文字 |
| 主色/强调 | `--el-color-primary` | `= --el-text-color-primary` (纯黑) | 主 CTA/链接/选中态 |
| 全局描边 | `--border-unified-color` | `#e9e9e9` (v26 定稿) | input/card/dialog/divider 等主内容区 |
| Sidebar 描边 | `--app-sidebar-border` | `#e9e9e9` | 侧边栏 + 全局 button 描边 (v18 统一) |
| Sidebar 表面 | `--app-sidebar-surface` | `#f8f8f8` | 侧边栏背景 |
| 浅填充 | `--el-fill-color-light` | `#f0f0f0` | ghost 按钮 hover 等 |
| 成功 | `--el-color-success` | `#67c23a` (语义) / 文字 `#15803d` | 成功状态 |
| 警告 | `--el-color-warning` | `#e6a23c` (语义) / 文字 `#b45309` | 警告状态 |
| 危险 | `--el-color-danger` | `#f56c6c` (语义) / 文字 `#b91c1c` | 危险状态 |
| 信息 | `--el-color-info` | `#909399` (语义) / 文字 `#4b5563` | 信息状态 |

业务语义色对(文字 + 8% 透明背景,浅色 mode):
`--app-color-success-text: #15803d` / `-bg: rgb(74 222 128 / 0.08)`
`--app-color-warning-text: #b45309` / `-bg: rgb(237 180 67 / 0.08)`
`--app-color-danger-text: #b91c1c` / `-bg: rgb(245 101 101 / 0.08)`
`--app-color-info-text: #4b5563` / `-bg: rgb(96 165 250 / 0.08)`
`--app-color-primary-text: #1d4ed8` / `-bg: rgb(37 99 235 / 0.08)`

### 2.2 暗色模式 (Dark Mode)

| 角色 | Token | 值 | 用途 |
|---|---|---|---|
| 主背景 | `--el-bg-color` | `#0d0d0d` (`--color-dark-bg-3`) | 页面/容器主背景 |
| Hover 背景 | `--el-bg-color-hover` | `#1a1a1a` (`--color-dark-bg-5`) | hover 态背景 |
| 主文字 | `--el-text-color-primary` | `#e5eaf3` (`--color-gray-e5eaf3`) | 标题/正文 |
| 常规文字 | `--el-text-color-regular` | `#cfd3dc` (`--color-gray-cfd3dc`) | 正文 |
| 次要文字 | `--el-text-color-secondary` | `#a3a6ad` (`--color-gray-a3a6ad`) | 辅助文字 |
| 占位符 | `--el-text-color-placeholder` | `#8d9095` (`--color-gray-8d9095`) | placeholder |
| 主色 | `--el-color-primary` | `#2563eb` (CTA 蓝) | 主按钮背景/链接 |
| 全局描边 | `--border-unified-color` | `#171717` (v26 定稿) | 主内容区描边 |
| Sidebar 描边 | `--app-sidebar-border` | `#171717` | 侧边栏 + button 描边 |
| 成功 | `--el-color-success` | `#15803d` (按钮背景) / 文字 `#bbf7d0` | 深底浅字 |
| 警告 | `--el-color-warning` | `#b45309` (按钮背景) / 文字 `#fde68a` | 深底浅字 |
| 危险 | `--el-color-danger` | `#fca5a5` (浅红,对比度 7.8:1) | 暗色用浅红非深红 |
| 信息 | `--el-color-info` | `#4b5563` (按钮背景) / 文字 `#d1d5db` | 白字配深灰底 |

深色背景色阶 (`--color-dark-bg-*`,全站唯一定义处):
`#000` (bg-1 纯黑) · `#0a0a0a` (bg-2) · `#1a1a1a` (bg-3 主背景) ·
`#222` (bg-4) · `#2d2d2d` (bg-5 悬浮) · `#333` (bg-6) · `#383838` (bg-7 最浅填充)

业务语义色对(暗色 mode 浅字 + 15% 透明深背景):
`--app-color-success-text: #bbf7d0` / `-bg: rgb(74 222 128 / 0.15)`
`--app-color-warning-text: #fde68a` / `-bg: rgb(237 180 67 / 0.15)`
`--app-color-danger-text: #fecaca` / `-bg: rgb(245 101 101 / 0.15)`
`--app-color-info-text: #d1d5db` / `-bg: rgb(96 165 250 / 0.15)`
`--app-color-primary-text: #93c5fd` / `-bg: rgb(37 99 235 / 0.15)`

### 2.3 AI 浮窗专属描边色 (独立体系,不与 sidebar v26 共享)

> 设计意图: AI 浮窗 dialog 需要比 sidebar v26 定稿色 (`#171717`) 更高的可见度。
> v26 暗色 `#171717` 与 page bg `#1a1a1a` 差值仅 3 几乎不可见,AI 浮窗必须用专属色。

| 角色 | 浅色 | 暗色 |
|---|---|---|
| AI 浮窗描边 | `#e6e8ed` | `#3a3b3d` |
| AI 浮窗描边 hover | `#ced1d8` | `#54555a` |

AI 输入框紫色描边 token (暗色专属,反相对比):
`--ai-purple-light-2: #a78bfa` (默认) · `--ai-purple-light-35: #c4b5fd` (hover) ·
`--ai-purple-light-5: #ddd6fe` (focus)

### 2.4 AI 浮窗发送按钮 (Trae 风格圆形绿底, 2026-07-06 立)

> 设计意图: 完全借鉴 Trae 程序 AI 输入框的圆形绿底发送按钮, 视觉冲击强且 WCAG AA 通过。
> 属 AI 浮窗专属色独立体系, 不污染 `--el-color-success` 全局语义 (Element Plus 默认 #67c23a 浅色, 与 Trae 视觉差异较大)。

| 角色 | 浅色 | 暗色 | 白字对比度 |
|---|---|---|---|
| 发送按钮 bg | `#16a34a` (Tailwind green-600) | `#15803d` (Tailwind green-700) | 4.14:1 ✓ AA Large / 5.5:1 ✓ AA |
| 发送按钮 hover bg | `#15803d` | `#052e16` | ≥ 4:1 ✓ |

实现: SCSS 桥接 `_global-tokens.scss` (4 个 SCSS 变量) → `element-plus-vars.scss` (:root + html.dark 桥接 2 个 CSS 变量 `--ai-send-btn-bg` / `--ai-send-btn-hover-bg`) → 组件用 `var(--ai-send-btn-bg)` 引用。

### 2.5 禁止事项

- ❌ 禁止在组件样式中硬编码十六进制颜色(如 `#409eff`),必须用 token
- ❌ 禁止暗色模式文字色映射到背景色阶 token(`--color-neutral-200/400` 暗色下是 `#222/#333` 深灰,与背景撞色)
- ❌ 禁止 `var()` 引用未定义变量且无 fallback(会退回 `currentColor`/`inherit` 导致不可预测)
- ❌ 禁止用 `--el-bg-color*` / `--el-color-white` 作为文字色(背景 token 不可作文字色)
- ❌ 禁止纯黑 `#000` 作为边框色(`--el-border-color` 永远是 `#e9e9e9`/`#171717`)

---

## 3. Typography Rules

- **字体栈**: `HarmonyOS Sans SC` (鸿蒙字体,全站唯一中文字体)
  - `--global-font-family: var(--font-family-chinese)`
  - `--el-font-family: var(--font-family-chinese)`
- **等宽字体**: `ui-monospace, 'JetBrains Mono', monospace` (代码块)
- **字号阶梯**: 详见 `client/src/styles/utilities/_typography.scss` 与
  `client/src/styles/_responsive-typography-spacing.scss`
- **行高**: body `1.5`,headings `1.2`
- **字距**: display 尺寸 (≥32px) 用 `letter-spacing: -0.01em`
- **响应式字体**: 移动端字号阶梯见 `_responsive-typography-spacing.scss`,
  禁止 `font-size` 硬编码 px 超出阶梯(移动端可读性守门: `check-mobile-fontsize.ts`)
- **i18n 联动**: 所有 UI 文字必须 i18n 翻译,禁止裸露英文键名
  (开发期 `missingWarn` + `fallbackWarn` 开启,生产构建自动关)
- **i18n 模块注册**: 新增 i18n 模块必须在 `locales/index.ts` 的 `coreModules` 注册,
  否则首屏渲染裸露键名字面量(异步 glob 兜底有 100ms 延迟)

---

## 4. Component Stylings

### 4.1 圆角 (Border Radius) — 全站唯一 8px

> 硬约束 (2026-07-03 立): 禁止彻底圆角/胶囊形 (pill / capsule)。
> 守门: `check-no-pill-radius.mjs` (pre-commit) + `e2e/tw-selector-radius.spec.ts`

| 用途 | Token | 值 |
|---|---|---|
| 容器/卡片/输入框 | `--global-border-radius` | `8px` (全站唯一标准) |
| 按钮 | `--app-button-radius` | `= --global-border-radius` (8px) |
| 小标签/小按钮 | `--global-border-radius-sm` | `4px` |
| 浮窗 (AI 浮窗专用) | `--fcd-radius-lg` | `15px` (定义于 `AIChat.vue:8565`,浮窗豁免) |
| 头像/装饰圆点 | (直接 `50%`) | 几何圆形,白名单允许 |

- ❌ 禁止 `border-radius: 14px` / `16px` / `20px` / `9999px` / `999px`
- ❌ 已移除 token: `--app-button-radius-pill: 14px` (违规源头,已删)
- miniapp 同步: `$global-border-radius: 8px` (`miniapp/src/uni.scss`)

### 4.2 按钮 (Button)

> v18 设计 (2026-07-05): 全局 button 描边统一指向 sidebar 专用 `--app-sidebar-border`。

| 属性 | Token / 值 |
|---|---|
| 高度 | xs 24 · sm 28 · md 32 · lg 36 · xl 40 · 2xl 44 (`--app-button-height-*`) |
| 圆角 | `var(--app-button-radius)` = 8px |
| 描边 | `var(--app-button-border)` → `var(--app-sidebar-border)` (3 个 token 全统一) |
| 描边 hover | `var(--app-button-border-color-hover)` → `var(--app-sidebar-border)` (不区分) |
| 过渡 | `background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease` |
| 背景语义 | primary(主色) / ghost(透明) / mini(纯黑) / surface(浅填充) / hover(浅填充) |
| primary 文字色 | `--app-button-text-on-primary: #fff` (浅色暗色统一,黑底白字 21:1 / 蓝底白字 5.17:1) |
| 透明描边 | `--app-button-border-transparent: 1px solid transparent` |

彩色按钮文字反色 (永定,不随 light/dark 切换):
`--app-text-on-success: #fff` · `--app-text-on-warning: #fff` ·
`--app-text-on-danger: #fff` · `--app-text-on-info: #fff`
(暗色下按钮背景用 Tailwind 700 级深饱和色,白字对比度 ≥ 5:1 WCAG AA)

### 4.3 描边 (Border) — 全站用 token,禁单独写 1px solid

| 场景 | Token | 浅色 / 暗色 |
|---|---|---|
| 主内容区 (input/card/dialog/divider) | `var(--unified-border)` / `var(--border-unified-color)` | `#e9e9e9` / `#171717` |
| Sidebar + 全局 button | `var(--app-sidebar-border)` | `#e9e9e9` / `#171717` |
| AI 浮窗 dialog | (直接 `1px solid #e6e8ed` / `:where(html.dark) & { border-color: #3a3b3d }`) | `#e6e8ed` / `#3a3b3d` |
| Tooltip | `--el-tooltip-border-color` | `= --border-unified-color` |

- ❌ 禁止单独写 `1px solid #xxx`,必须用 `var(--unified-border)` 或 `var(--border-unified-color)`
- ❌ AI 浮窗 embedded 模式禁止强制 `border: none`(会让整个浮窗区域无边界感)
- ❌ AI 浮窗禁止用 `var(--unified-border)`(v26 暗色 `#171717` 与 page bg 差值仅 3,不可见)

### 4.4 输入框 (Input) — 禁蓝色发光边框

> 硬约束: 输入框禁止蓝色发光边框 (box-shadow glow),用边框颜色过渡替代。

| 状态 | 浅色 | 暗色 |
|---|---|---|
| 默认描边 | `var(--border-unified-color)` `#e9e9e9` | `#171717` |
| hover | `#a0c4ff` | `#60a5fa` |
| focus | `#3b82f6` | `#93c5fd` |

AI 输入框暗色模式紫色描边 (反相对比,浅紫):
默认 `--ai-purple-light-2: #a78bfa` · hover `--ai-purple-light-35: #c4b5fd` · focus `--ai-purple-light-5: #ddd6fe`

- ❌ 禁止 `box-shadow: 0 0 0 2px rgba(...)` 形式的 focus glow
- ❌ 禁止 `outline` 蓝色发光

### 4.5 阴影 (Shadow) — 全站禁用

- `--global-box-shadow: none`
- `--el-box-shadow` / `--el-box-shadow-light` / `--el-box-shadow-dark` 全部 `= none`
- 层级用描边 + 背景色差表达,不用投影

### 4.6 头像 (Avatar)

- 必须为正方形且带小圆角(非圆形、非胶囊)
- 暗色模式下头像图标颜色为白色
- 点击头像后必须显示包含「退出登录」选项的上拉菜单

### 4.7 用户信息容器 (Sidebar User)

- 登录后的用户信息容器 (`.sidebar-user`) 禁止显示 chevron 箭头图标,仅保留头像和用户名
- 登录按钮 / 用户信息互斥显示:`v-if="!isLoggedIn"` 显示登录按钮,`v-else` 显示用户信息
- 禁止 `v-if="true"` 硬编码(高危,临时调试后必须还原)

---

## 5. Layout Principles

### 5.1 间距系统 (Spacing)

| Token | 值 | 用途 |
|---|---|---|
| `--spacing-xs` | `4px` | 超小间距:移动端按钮间距 |
| `--spacing-sm` | `8px` | 小间距:桌面端按钮间距 |
| `--spacing-md` | `16px` | 中间距:卡片内边距 |
| `--spacing-lg` | `24px` | 大间距:区块间距 |
| `--spacing-xl` | `32px` | 超大间距:页面间距 |

### 5.2 侧边栏 (Sidebar) — v11 尺寸永久锁定

> 硬约束 (2026-07-04 立): 侧边栏尺寸永久锁定 v11,禁止改动宽度/折叠态尺寸。
> 守门: `check-sidebar-config.mjs`

- 尺寸 token 详见 `client/src/styles/_sidebar-layout.scss` + `check-sidebar-config.mjs`
- 侧边栏 footer 用户区/登录按钮互斥显示(见 4.7)

### 5.3 z-index 层级 (全站唯一设定)

| Token | 值 | 用途 |
|---|---|---|
| `--z-base` | `1` | 基础内容层 |
| `--z-0` | `0` | 层叠上下文基底 |
| `--z-header` | `100` | 头部导航栏 |
| `--z-sticky` | `990` | 粘性定位元素 |
| `--z-dropdown` | `1000` | 下拉菜单 |
| `--z-overlay` | `1000` | 遮罩层 |
| `--z-modal` | `2000` | 弹窗/对话框 |
| `--z-popover` | `2001` | 弹出层(高于 modal) |
| `--z-notification` | `9999` | 通知/提示 |
| `--z-loading` | `10000` | 全屏加载 |
| `--z-max` | `10003` | 最大层级(全屏覆盖) |

- ❌ 禁止硬编码 z-index 数字,必须用上述 token

### 5.4 Popper Backdrop 防遮挡

> 硬约束 (2026-07-04 立): 防止 el-select/el-dropdown popper 的 backdrop 永久遮挡点击。
> 守门: `check-popper-backdrop-leak.mjs` + `e2e/popper-backdrop-leak.spec.ts`

三层防御 (`client/src/styles/fixes.scss`):
1. `:where(.dropdown--fullscreen-backdrop) { pointer-events: none !important }`
2. `:where([aria-hidden='true']) &.el-popper { display:none; visibility:hidden; opacity:0; pointer-events:none !important }`
3. `:where([class*='dropdown--'][class*='backdrop']) { pointer-events: none !important }`

---

## 6. Depth & Elevation

**扁平化唯一层级语言:描边 + 背景色差。**

- **0 阴影**: 全站 `--global-box-shadow: none`,禁止任何 `box-shadow`
- **层级表达**:
  - 同级元素: 描边 `var(--border-unified-color)` 分隔
  - 浮层 (dropdown/modal/popover): 背景色差(暗色下用更深的 `#0d0d0d` vs 页面 `#1a1a1a`)
  - hover 反馈: 背景色变化承担,描边保持单一色(v13/v18 简化原则)
- ❌ 禁止 neumorphism(新拟态柔光阴影)
- ❌ 禁止 glassmorphism(毛玻璃 backdrop-filter)
- ❌ 禁止用投影制造「悬浮感」,改用描边

---

## 7. Do's and Don'ts

### ✅ Do

- ✅ 圆角统一用 `var(--global-border-radius)` (8px) 或 `var(--app-button-radius)`
- ✅ 暗色模式文字色必须为浅色(亮度 > 100/255),用 `--el-text-color-*` 四个 token
- ✅ 描边用 `var(--unified-border)` / `var(--border-unified-color)` / `var(--app-sidebar-border)`
- ✅ 修改 SCSS 后必须**完全重启 dev server**(杀 vite 进程)触发全量重编译,HMR 不更新 SCSS 缓存
- ✅ UI 修复交付前必须 Puppeteer 截图亲眼看效果,不能用 getComputedStyle 数字代替视觉验证
- ✅ 新组件优先用 `--app-*` 语义化 token(而非直接 `--el-*`)
- ✅ 互斥组件(同一位置切换)用 `v-if`/`v-else`,不用两个独立 `v-if`(避免空 div 留白)
- ✅ 登录态相关 UI 必须用 `authStore.isLoggedIn` 联动,不可写死
- ✅ 浅色模式颜色更白,暗色模式颜色更黑
- ✅ hover 态描边色与 root sidebar 按钮同色(单一配置,不设 hover 区分)
- ✅ UI 文字必须 i18n 翻译,新 i18n 模块必须在 `coreModules` 注册
- ✅ tab 切换必须有平滑过渡动画

### ❌ Don't

- ❌ 禁止胶囊圆角 (`border-radius: 14/16/20/9999/999px`)
- ❌ 禁止纯黑边框 (`--el-border-color` 永远是 `#e9e9e9`/`#171717`,非 `#000`)
- ❌ 禁止输入框蓝色发光边框 (`box-shadow` glow / 蓝色 `outline`)
- ❌ 禁止暗色文字用背景色阶 token (`--color-neutral-200/400` 暗色下是 `#222/#333` 深灰)
- ❌ 禁止 `var()` 引用未定义变量无 fallback(退回 `currentColor` 不可预测)
- ❌ 禁止纯 CSS `<style scoped>`(无 `lang="scss"`)块用 `//` 注释(PostCSS 解析失败)
- ❌ 禁止 `v-if="true"` 硬编码(高危,登录态 UI 必须联动 `isLoggedIn`)
- ❌ 禁止 chevron 箭头图标出现在用户信息容器
- ❌ 禁止 light gray icons on white background(对比度不足看不见)
- ❌ 禁止容器滑动时拉伸/收缩(ugly,用固定尺寸)
- ❌ 禁止 UI 文字截断/省略号(必须完整显示)
- ❌ 禁止 AI 输入框描边色用其他颜色(浅色浅灰/暗色深灰,无其他色)
- ❌ 禁止新对话按钮容器背景色在浅/暗模式无反差
- ❌ 禁止 `--el-bg-color*` / `--el-color-white` 硬编码在彩色按钮上作文字色
- ❌ 禁止 `:where()` 包裹整个父选择器编译为 0 特异性(只包裹 dark 检测)

---

## 8. Responsive Behavior

- **断点**: 详见 `client/src/styles/_breakpoints.scss` 与 `_responsive.scss`
- **移动端优先**: 字号阶梯移动端独立(见 `_responsive-typography-spacing.scss`),
  守门 `check-mobile-fontsize.ts` 防移动端字号过小
- **触摸优化**: `_touch-optimization.scss` 处理移动端命中区域
- **安全区**: `_safe-area.scss` 处理刘海/底部安全区
- **miniapp**: `miniapp/src/uni.scss` 同步 Web 的圆角/间距 token,保持一致
- ❌ 禁止容器在滑动时拉伸/收缩(固定尺寸,响应式用断点切换而非流式拉伸)

---

## 9. Agent Prompt Guide

> 本节是专门写给 AI Agent 的硬指令。任何 Agent 在生成或修改 IHUI-AI 的 UI 代码前,
> 必须将本节作为不可跳过的行为约束。

### RULE 1 — 先问再做 (不可跳过)

任何涉及 UI 视觉改动的任务,Agent **必须先锁定以下 5 项**,然后才允许动任何一个像素:

1. **改动范围**: 哪些组件/文件/路由受影响?
2. **模式**: 浅色模式 / 暗色模式 / 双模式? (暗色模式是默认强制项,不可遗漏)
3. **影响的 token**: 会触碰哪些 `--el-*` / `--app-*` / `--color-*` token? 是否需要新增?
4. **守门规则**: 是否触碰以下任一守门?
   - 圆角 (`check-no-pill-radius`)
   - 描边色 (`check-sidebar-dark-tier` / `check-ai-dialog-border` / `check-hero-cta-border`)
   - 文字对比度 (`check-button-text-contrast` / `check-color-contrast-systemic`)
   - 暗色文字色 (`check-no-bg-token-as-text-color`)
   - popper backdrop (`check-popper-backdrop-leak`)
   - 本 DESIGN.md (`check-design-md`)
5. **验证方式**: 如何验证? (Puppeteer 截图 / getComputedStyle / E2E 测试)

未完成上述 5 项锁定就开始生成 UI 代码 = 违规。这能把「方向跑偏导致推倒重来」的
成本从生成后移到生成前,是设计流程里最贵的 30 秒。

### 硬指令清单

1. **不要发明调色板外的色值**。本文件第 2 节列出的 token 是全部允许的色值。
   若需求需要新色值,在 artifact 中用警告注释标注,并使用最接近的现有 token。
2. **暗色模式文字必须为浅色**(亮度 > 100/255)。禁止映射到 `--color-neutral-200/400`
   等背景色阶 token。四个 `--el-text-color-*` token 必须用浅色 + fallback。
3. **圆角必须用 token**。`var(--global-border-radius)` (8px) 是全站唯一标准,
   禁止 `border-radius: 14px+` 或 `9999px`。头像用 `50%`(白名单)。
4. **描边必须用 token**。`var(--unified-border)` / `var(--border-unified-color)` /
   `var(--app-sidebar-border)`,禁止单独写 `1px solid #xxx`。
5. **禁止 box-shadow**。层级用描边 + 背景色差,不用投影。
6. **SCSS 改动后必须完全重启 dev server**(杀 vite 进程)。HMR 不更新 SCSS 缓存,
   仅 HMR 会导致样式不生效的假象。
7. **UI 修复交付前必须截图验证**。不能用 `getComputedStyle` 数字 + 文字描述代替
   视觉验证。SCSS 改动后 Agent 必须自己重启 dev server 确保样式显示正确。
8. **i18n 模块必须在 `coreModules` 注册**。新模块不注册会导致首屏渲染裸露键名
   字面量(异步 glob 兜底有 100ms 延迟)。
9. **暗色模式是强制项,不可遗漏**。任何 UI 改动必须同时验证浅色 + 暗色双模式。
   暗色模式文字色 token 必须浅色,与背景对比度 ≥ WCAG AA 4.5:1。
10. **登录态 UI 必须用 `authStore.isLoggedIn` 联动**,禁止 `v-if="true"` 硬编码。
11. **修改 token 后必须同步**:`_global-tokens.scss` (浅色) + `_dark-mode-global.scss`
    (暗色) + `element-plus-vars.scss` (桥接) + `_design-tokens.scss` (fallback) 四处同步。
12. **守门脚本反向测试**: 新增守门脚本写完必须做反向测试(改坏看能不能抓到)+ 正向
    测试(当前代码看能不能放过),否则脚本可能 silent fail。

### 产物验证清单

UI 改动交付前,Agent 必须自验:

- [ ] 浅色模式截图通过(无低对比度文字、无蓝光边框、无胶囊圆角)
- [ ] 暗色模式截图通过(文字浅色可见、描边可见、无黑字黑底)
- [ ] `getComputedStyle` 确认关键 token 值正确(border-width > 0、color 非撞色)
- [ ] 相关守门脚本通过(`node scripts/check-*.mjs --all`)
- [ ] dev server 已完全重启(SCSS 改动),样式已刷新
- [ ] i18n 键名无裸露(0 个英文键名字面量在 UI 中)

---

## 附录 A: Open Design CLI 接入状态 (2026-07-06)

**schema 来源**: 遵循 Open Design (github.com/nexu-io/open-design, Apache-2.0) 的 `DESIGN.md` 9 节规范 (awesome-claude-design schema)。

**接入状态**: 仅作为 schema 参考, 未实际安装运行。

- `node_modules/@nexu-io/open-design` 未安装
- 未来如需安装: `cd client && pnpm add @nexu-io/open-design --save-dev` (本项目用 pnpm 11.10)
- 安装后可用 `npx open-design` 辅助生成/校验 DESIGN.md

Open Design 工具链 (如需用 Open Design 工具基于本契约生成 UI 原型/落地页/PPT):
1. 安装 Open Design CLI (支持 macOS / Windows 原生桌面应用)
2. 接入 Trae: `od mcp install trae` (Open Design 已原生支持 Trae)
3. 将本 `DESIGN.md` 放入项目根, Open Design 会自动读取作为品牌契约
4. 生成物会自动遵循本文件的 token 体系(圆角 8px、描边色、暗色模式文字色等)

Open Design 是 Claude Design (Anthropic 2026-04-17 发布, 闭源) 的开源替代, 支持 21 个 Coding Agent (含 Trae), 本地优先, Apache-2.0 协议。

本项目不强制安装, 但 **DESIGN.md 9 节 schema 是契约的格式基础**。

## 附录 B: RULE 1「先问再做」五层硬约束 (2026-07-06)

RULE 1 是本项目对「任何 UI 视觉改动必须先确认方向」的设计哲学, 已升级为 5 层防回归:

### B.1 第一层: commit-msg 钩子 (本地提交拦截)

`client/scripts/check-rule1-commit-msg.mjs` 由 `.husky/commit-msg` 调用, 在 `git commit` 阶段强制:

- (1) 非 UI 改动 (后端/文档/测试/构建) 自动放行
- (2) UI 改动必须含 `RULE1:` 前缀 (例: `RULE1: 修复 sidebar 暗色描边色撞背景`)
- (3) commit body 必须含 ≥ 4/5 项方向锁定关键词 (范围 / 模式 / token / 守门 / 验证)

### B.2 第二层: pre-commit 源码级守门

`client/scripts/check-design-md.mjs` (pre-commit 第 26 项):
- (1) `DESIGN.md` 9 节齐全
- (2) 关键 token 值未被篡改
- (3) RULE 1 章节 + 5 项方向锁定齐全
- (4) Agent Prompt Guide 12 条硬指令齐全

### B.3 第三层: PR 模板远程审查

`.github/pull_request_template.md` 是 GitHub PR 必填的 5 项 checkbox + 截图区:

- (1) 改动范围
- (2) 模式 (浅色 + 暗色 双模式勾选)
- (3) 影响的 token
- (4) 守门规则 (列出具体 check-* 脚本)
- (5) 验证方式 (Puppeteer 截图 / 视觉 diff / E2E)
- (6) 截图 / 录屏区 (浅色 + 暗色 + 视觉对比)
- (7) 回归检查清单 (全站 330 路由 / 侧边栏三态 / AI 浮窗等)

`client/scripts/check-rule1-pr-template.mjs` 校验模板 5 项关键字齐全 + ≥ 5 个 checkbox + 截图区存在 + RULE 1 引用 + 无 TODO 占位符。

### B.4 第四层: AGENTS.md 章节守门

`check-agents-md-sections.mjs` + `e2e/agents-md-sections.spec.ts` 的 `EXPECTED_SECTIONS` 包含 RULE 1 章节 (第 28 章), mustContain 校验章节正文含 `check-design-md.mjs` 关键字。

### B.5 第五层: E2E 浏览器级守门

`e2e/check-rule1-enforcement.spec.ts` 守门 RULE 1 三层:
- commit-msg 守门脚本 `check-rule1-commit-msg.mjs` 存在
- PR 模板 `pull_request_template.md` 存在
- AGENTS.md 章节文本含 RULE 1 硬约束关键词

详见 AGENTS.md 第 28 章「RULE 1 先问再做硬约束」。

## 附录 C: DESIGN.md / AGENTS.md / project_memory 三者关系

| 文件 | 角色 | 更新时机 | 守门 |
|---|---|---|---|
| `_global-tokens.scss` / `_dark-mode-global.scss` / `element-plus-vars.scss` | SCSS token 定义 (运行时) | 改 token 时 | stylelint + token check |
| **`DESIGN.md`** (本文件) | 品牌设计契约 (Agent 读取) | 改 token / 改 UI 规则时 | `check-design-md.mjs` |
| **`AGENTS.md`** | Agent 行为规范 (含 RULE 1) | 改硬约束时 | `check-agents-md-sections.mjs` |
| `project_memory.md` (memory) | 历史教训 + 临时约束 | 每次会话总结 | 无 (临时) |

**单一事实来源**: SCSS token 定义 → `DESIGN.md` (契约) → `AGENTS.md` (规范) → `project_memory.md` (历史)。
