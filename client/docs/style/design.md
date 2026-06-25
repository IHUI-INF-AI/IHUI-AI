# 前端设计规范（统一标准）

> 本文档是项目前端设计规范的**唯一汇总入口**，整合了散落在各处的规则、变量、用法。
> 写任何前端代码（页面、组件、样式）前，请先读完本文档。
> 大白话版本：所有视觉数值"一个口子出"，不允许在代码里自己写死。

---

## 一、铁律（强制遵守，违反即违规）

来源：[.cursorrules](file:///g:/1/client/.cursorrules)

### 1. 扁平化设计风格
- ❌ 禁止使用 `text-shadow`（文字投影）
- ❌ 禁止使用 `box-shadow` 做立体效果
- ✅ 用边框（border）分隔元素
- ✅ 用颜色对比做视觉层次

### 2. 两条红线（绝对禁止）
- ❌ 禁止使用 `!important`
- ❌ 禁止使用高特异性选择器（不能堆一长串类名强行覆盖，如 `.a .b .c .d` 或 `.foo.foo`）
- ✅ 单条选择器最多 1～2 层关系（如 `.block__element`、`.parent .child`）
- ✅ 需要覆盖时用 `:where()` 降特异性，或用 CSS Layer 控制顺序

### 3. 禁止硬编码数值
- ❌ 禁止硬编码十六进制颜色（如 `#409eff`）
- ❌ 禁止自己写 `1px solid #xxx`
- ❌ 禁止硬编码 z-index 数字
- ❌ 禁止在 `var()` 里写 fallback（如 `var(--x, #fff)`）
- ✅ 必须使用项目定义的 CSS 变量

---

## 二、视觉数值字典（全站唯一来源）

来源：[_global-tokens.scss](file:///g:/1/client/src/styles/_global-tokens.scss)、[element-plus-vars.scss](file:///g:/1/client/src/styles/element-plus-vars.scss)

### 1. 圆角（全站统一 8px）

| 变量名 | 值 | 用途 |
|---|---|---|
| `--global-border-radius` | `8px` | 所有圆角的唯一来源 |

> 所有 `border-radius` 必须用 `var(--global-border-radius)`，不能自己写数字。

### 2. 投影（全站统一）

| 变量名 | 值 | 用途 |
|---|---|---|
| `--global-box-shadow` | `0 2px 8px var(--color-black-6)` | 所有投影的唯一来源 |

> 所有 `box-shadow` 必须用 `var(--global-box-shadow)`。

### 3. 描边（全站统一）

| 变量名 | 值 | 用途 |
|---|---|---|
| `--border-unified-color` | 亮色 `#dcdfe6` / 暗色 `#4c4d4f` | 描边颜色 |
| `--border-unified-color-hover` | 亮色 `#c0c4cc` / 暗色 `#6c6e72` | hover/focus 描边 |
| `--unified-border` | `1px solid var(--border-unified-color)` | 完整描边（推荐用这个） |
| `--unified-border-bottom` | `1px solid var(--border-unified-color)` | 底部描边 |

> 禁止自己写 `1px solid #xxx`，必须用 `var(--unified-border)`。

### 4. 间距系统

| 变量名 | 值 | 用途 |
|---|---|---|
| `--spacing-xs` | `4px` | 超小间距（移动端按钮间距） |
| `--spacing-sm` | `8px` | 小间距（桌面端按钮间距） |
| `--spacing-md` | `16px` | 中间距（卡片内边距） |
| `--spacing-lg` | `24px` | 大间距（区块间距） |
| `--spacing-xl` | `32px` | 超大间距（页面间距） |

### 5. z-index 层级（必须用变量）

| 变量名 | 值 | 用途 |
|---|---|---|
| `--z-base` | `1` | 基础内容层 |
| `--z-header` | `100` | 头部导航栏 |
| `--z-sticky` | `990` | 粘性定位 |
| `--z-dropdown` | `1000` | 下拉菜单 |
| `--z-overlay` | `1000` | 遮罩层 |
| `--z-modal` | `2000` | 弹窗/对话框 |
| `--z-popover` | `2001` | 弹出层 |
| `--z-notification` | `9999` | 通知/提示 |
| `--z-loading` | `10000` | 全屏加载 |
| `--z-max` | `10003` | 最大层级（全屏覆盖） |

---

## 三、颜色系统

### 1. 语义化抽象层（新组件优先用这些）

| 变量名 | 映射 | 用途 |
|---|---|---|
| `--app-surface-1` | `--el-bg-color-page` | 页面主背景 |
| `--app-surface-2` | `--el-bg-color` | 容器背景 |
| `--app-overlay` | `--el-bg-color` | 遮罩层背景 |
| `--app-text-primary` | `--el-text-color-primary` | 主要文字 |
| `--app-text-secondary` | `--el-text-color-regular` | 次要文字 |
| `--app-text-muted` | `--el-text-color-secondary` | 弱化文字 |
| `--app-divider` | `--el-border-color` | 分割线 |

> 新组件优先用 `--app-*`，不要直接用 `--el-*`。换 UI 框架时只改 `--app-*` 定义即可。

### 2. 主题色（亮色模式：纯黑）

| 变量名 | 亮色值 | 暗色值 |
|---|---|---|
| `--el-color-primary` | 纯黑 | `#409eff` |
| `--el-text-color-primary` | `#000` | `#e5eaf3` |
| `--el-bg-color` | `#ffffff` | 深色变量 |
| `--el-bg-color-page` | `#ffffff` | 深色变量 |

### 3. 语义色

| 变量名 | 用途 |
|---|---|
| `--el-color-success` | 成功（绿） |
| `--el-color-warning` | 警告 |
| `--el-color-danger` | 危险（红） |
| `--el-color-info` | 信息 |

### 4. 透明度色板（全站唯一写死处）

所有 `rgba(255,255,255,x)` 和 `rgba(0,0,0,x)` 必须用现成变量：

- 白色透明度：`--color-white-2` 到 `--color-white-98`
- 黑色透明度：`--color-black-2` 到 `--color-black-95`

> 禁止自己写 `rgba(255,255,255,0.1)`，必须用 `var(--color-white-10)`。

### 5. 业务专用色（按需用）

| 变量名 | 用途 |
|---|---|
| `--color-miniapp-green` | 微信小程序按钮 |
| `--color-rank-gold/silver/bronze` | 排行榜名次 |
| `--color-vip-gold-start/end` | VIP 会员金色渐变 |
| `--color-payment-purple-start/end` | 支付页紫色渐变 |
| `--color-video-bg` | 视频播放器背景（固定纯黑） |

### 6. 装饰性渐变

| 变量名 | 用途 |
|---|---|
| `--color-gradient-purple-yellow` | 浅紫到浅黄（卡片背景） |
| `--color-gradient-purple-deep` | 浅紫到深紫（VIP 介绍） |
| `--color-gradient-white-blue` | 白到蓝（横幅） |
| `--color-gradient-card-left/right` | 卡片左右渐变 |
| `--color-gradient-group` | 组背景渐变 |

### 7. 对比色 token（明暗模式文字色自适应）⚠️ 强制

| 变量名 | 亮色值 | 暗色值 | 用途 |
|---|---|---|---|
| `--color-on-primary` | `#ffffff` | `#000000` | primary 背景上的文字/图标 |

**核心规则：**

- `--el-color-primary` 在明暗模式下会切换（亮色=`#000` / 暗色=`#fff`）。
- 若在 primary 背景上用 `var(--el-color-white)` / `var(--el-text-color-primary)` / `#fff` / `#000` 作为文字色，暗色模式必然"白底白字"。
- **必须**使用 `var(--color-on-primary)`，明暗模式自动切换对比色。

| 模式 | `--el-color-primary` | `--color-on-primary` | 效果 |
|---|---|---|---|
| 亮色 | `#000` | `#fff` | 黑底白字 |
| 暗色 | `#fff` | `#000` | 白底黑字 |

**铁律：**
- ❌ 禁止在 primary 背景（primary 按钮 / `.is-active` / 强调块）上用 `var(--el-color-white)` / `var(--el-text-color-primary)` / `#fff` / `#000` 作为文字或图标颜色
- ❌ 禁止为每个按钮单独写 `html.dark` 覆盖规则来修文字色
- ✅ 必须用 `var(--color-on-primary)`，明暗模式自动适配
- ✅ primary 按钮的 hover/active 文字也用 `var(--color-on-primary)` 或 `var(--el-button-text-color)`

**错误 vs 正确：**
```scss
/* ❌ 暗色模式白底白字 */
.x-button.is-active {
  background: var(--el-color-primary);
  color: var(--el-color-white);
}

/* ✅ 自动适配明暗模式 */
.x-button.is-active {
  background: var(--el-color-primary);
  color: var(--color-on-primary);
}
```

**适用范围：**
- primary 按钮（含 hover/active/disabled 文字色）
- `.is-active` / `.active` 等激活态元素
- primary 背景上的图标 SVG：`svg { color: var(--color-on-primary) }`
- 强调背景卡片/标签上的文字
- 自引用 token（如 `--xxx: var(--xxx)`）必须改为 `var(--color-on-primary)`

**配套 token（[element-plus-vars.scss](file:///g:/1/client/src/styles/element-plus-vars.scss)）：**
- `--el-button-text-color` → `#000000`
- `--el-button-hover-text-color` → `#000000`
- `--el-button-active-text-color` → `#000000`

**自检清单：**
- [ ] 凡是 `background: var(--el-color-primary)` 的元素，文字/图标都用 `var(--color-on-primary)`？
- [ ] 没有在 primary 背景上用 `var(--el-color-white)` / `var(--el-text-color-primary)` / `#fff` / `#000`？
- [ ] 没有写 `html.dark` 单点覆盖来修文字色？（用 token 一次性解决）

---

## 四、字体规范

| 变量名 | 值 | 用途 |
|---|---|---|
| `--global-font-family` | `var(--font-family-chinese)` | 全站默认字体 |
| `--el-font-family` | `var(--font-family-chinese)` | Element Plus 字体 |

字体族：`HarmonyOS Sans SC`（鸿蒙字体）

字号阶梯（SCSS 变量）：
- `$font-size-xs`: 12px
- `$font-size-sm`: 14px
- `$font-size-base`: 16px
- `$font-size-lg`: 18px
- `$font-size-xl`: 20px
- `$font-size-2xl`: 24px
- `$font-size-3xl`: 30px
- `$font-size-4xl`: 36px

---

## 五、布局规范

### 1. 尺寸

| 变量名 | 值 | 用途 |
|---|---|---|
| `--global-header-height` | `60px` | 顶部菜单栏高度 |
| `$header-height` | `64px` | Header 高度 |
| `$sidebar-width` | `240px` | 侧边栏宽度 |
| `$sidebar-collapsed-width` | `64px` | 侧边栏收起宽度 |
| `$content-max-width` | `1400px` | 内容最大宽度 |

### 2. 容器内边距（响应式）

```scss
// 所有含 container 关键字的容器自动应用
padding-left: clamp(12px, 3vw, 24px);
padding-right: clamp(12px, 3vw, 24px);
```

### 3. 栅格间距

| 变量名 | 值 |
|---|---|
| `--grid-gap` | `clamp(10px, 2vw, 15px)` |
| `--space-v` | `clamp(12px, 2vh, 24px)` |
| `--space-h` | `clamp(12px, 3vw, 24px)` |

### 4. 断点

| 变量名 | 值 |
|---|---|
| `$breakpoint-sm` | `640px` |
| `$breakpoint-md` | `768px` |
| `$breakpoint-lg` | `1024px` |
| `$breakpoint-xl` | `1280px` |
| `$breakpoint-2xl` | `1536px` |

---

## 六、按钮规范

### 1. 主按钮（亮色：黑底白字）

| 变量名 | 亮色值 |
|---|---|
| `--el-button-bg-color` | 纯黑 |
| `--el-button-text-color` | 白 |
| `--el-button-hover-bg-color` | 纯黑 |
| `--el-button-hover-text-color` | 白 |

### 2. 突出按钮（重要/推荐）

| 变量名 | 用途 |
|---|---|
| `--button-emphasized-bg` | 背景 |
| `--button-emphasized-text` | 文字 |
| `--button-emphasized-hover-bg` | hover 背景 |
| `--button-emphasized-hover-text` | hover 文字 |

### 3. 套餐按钮（按版本区分）

- `--button-basic-*`：基础版（浅灰）
- `--button-enterprise-*`：企业版（中灰）
- `--button-flagship-*`：旗舰版（深灰）

---

## 七、主题模式

### 1. 双模式支持
- 亮色模式（默认）
- 暗色模式（`html.dark` 类名切换）

### 2. 主题预设（3 种品牌色）
- 蓝色（默认）
- 绿色
- 紫色

通过 `data-theme` 属性切换，定义在 [_theme-presets.scss](file:///g:/1/client/src/styles/_theme-presets.scss)。

---

## 八、CSS Layer 架构

项目使用 CSS Layer 控制优先级（从低到高）：

```scss
@layer reset, base, vendor, components, utilities;
```

- `reset`：样式重置
- `base`：基础样式
- `vendor`：第三方库样式
- `components`：组件样式
- `utilities`：工具类样式（优先级最高）

> 需要覆盖时优先用 Layer，不要堆类名。

---

## 九、写代码前的检查清单

### 写样式前
- [ ] 圆角用 `var(--global-border-radius)`？
- [ ] 投影用 `var(--global-box-shadow)`？
- [ ] 描边用 `var(--unified-border)`？
- [ ] 颜色用 CSS 变量（优先 `--app-*`）？
- [ ] 透明度用 `--color-white-*` / `--color-black-*`？
- [ ] z-index 用 `--z-*` 变量？
- [ ] 间距用 `--spacing-*`？

### 写完样式后自检
- [ ] 没用 `!important`
- [ ] 没用 `text-shadow`
- [ ] 没用不必要的 `box-shadow`
- [ ] 没硬编码颜色（`#xxx`）
- [ ] 没硬编码 z-index 数字
- [ ] 选择器不超过 2 层深度
- [ ] 没在 `var()` 里写 fallback

---

## 十、自动化检查工具

项目配了 npm 脚本自动检查规范执行：

| 命令 | 作用 |
|---|---|
| `npm run tokens:check` | CI 检查死代码 token 数量 |
| `npm run tokens:docs` | 自动生成字典文档 |
| `npm run tokens:deprecated` | 检查弃用变量 |
| `npm run tokens:naming` | 检查命名规范 |
| `npm run tokens:usage` | 统计 token 使用情况 |
| `npm run tokens:dark-mode` | 检查暗色模式覆盖 |
| `npm run tokens:autocompletion` | CSS 变量自动补全 |

---

## 十一、相关文件索引

| 文件 | 作用 |
|---|---|
| [.cursorrules](file:///g:/1/client/.cursorrules) | 项目铁律 |
| [src/styles/_global-tokens.scss](file:///g:/1/client/src/styles/_global-tokens.scss) | 全局 token 字典 |
| [src/styles/element-plus-vars.scss](file:///g:/1/client/src/styles/element-plus-vars.scss) | Element Plus 变量映射 |
| [src/styles/variables.scss](file:///g:/1/client/src/styles/variables.scss) | SCSS 变量别名 |
| [src/styles/index.scss](file:///g:/1/client/src/styles/index.scss) | 全局样式入口 |
| [src/styles/_theme-presets.scss](file:///g:/1/client/src/styles/_theme-presets.scss) | 主题预设 |
| [docs/token-docs.md](file:///g:/1/client/docs/token-docs.md) | Token 文档（自动生成） |
| [src/styles/CSS_VARIABLES.md](file:///g:/1/client/src/styles/CSS_VARIABLES.md) | CSS 变量手册 |

---

## 十二、新增 Token 流程

需要新增颜色/尺寸变量时：

1. 检查是否能复用现有 token（优先复用）
2. 在 [_global-tokens.scss](file:///g:/1/client/src/styles/_global-tokens.scss) 的 `:root` 中添加
3. 按命名规范命名：
   - 业务品牌色：`--color-业务名-用途`
   - 装饰渐变：`--color-gradient-描述`
   - 语义化：`--app-用途`
4. 如需暗色模式覆盖，在 [_dark-mode-global.scss](file:///g:/1/client/src/styles/_dark-mode-global.scss) 添加
5. 在文件顶部的"Token 变更日志"中登记
6. 运行 `npm run tokens:docs` 更新文档

---

## 大白话总结

**一句话**：所有视觉数值（颜色、圆角、投影、描边、间距、层级）都从项目定义的 CSS 变量里取，不允许在代码里自己写死数字。只要按规矩用变量，整个项目视觉就自动保持一致。
