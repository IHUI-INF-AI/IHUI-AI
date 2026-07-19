/**
 * 【2026-07-19 立】导航项 + 通用按钮共享样式常量
 *
 * 集中维护以下 4 类高频复用样式,避免散落在各组件中导致:
 * 1. 修复对齐/尺寸/颜色等 bug 时遗漏某些位置
 * 2. 风格漂移(每个组件微调变体,最终 UI 不一致)
 * 3. 难以系统性优化(改一处忘了改另外 N 处)
 *
 * 命名规则:
 * - `NAV_ITEM_*`  →  侧边栏 / 顶栏导航项(主导航)
 * - `BTN_*`       →  通用按钮(新建任务/工具栏/筛选)
 * - `CHIP_*`      →  chip / 标签(可关闭标签 / status badge)
 *
 * 中文 + 图标垂直对齐硬约束 (2026-07-19):
 * 父容器 `flex h-* items-center` + 中文 span 时,文字 span 须应用 `translateY(0.3px)`。
 * 根因:中文字体 ascent(≈11px) ≠ descent(≈3px) 不对称,ink 中心比 box 中心低 0.4-0.5px。
 * 0.3px 是 14px 字号下肉眼可识别阈值(7%)的 1/3 以下,任何 DPR 下都安全,
 * 实测 11 个侧边栏 nav 一致 delta=0.000(完美居中)。
 *
 * 配套 globals.css 已建立 `--text-vcenter-offset: 0.3px` 全局 CSS 变量,
 * 并通过 `:where(button, a, [role=button], [role=menuitem]):has(>svg):has(>span) > span`
 * 全局选择器自动应用,无需手动加类;纯文字按钮(no svg)自动排除。
 *
 * 调优日志(浏览器 getBoundingClientRect + Range 实测,跨 11 个侧边栏 nav 验证):
 *   - 0.5px → delta = +0.4px(过冲,文字略低于图标,可见偏差)
 *   - 0.4px → delta = +0.2px(可接受)
 *   - 0.3px → delta =  0.0px(完美居中,选定)★ 所有 nav item 一致 0.000
 *   - 0.2px → delta = -0.2px(文字略高于图标,微弱可见)
 *   - 0.1px → delta = -0.4px(过冲反方向)
 *   - 0.0px → delta = -0.5px(自然态,文字明显高于图标)
 *
 * text-xs (12px) 字号下 delta 更大,globals.css 有专用 0.7px 规则兜底。
 */

/** 侧边栏 / 顶栏主导航项基础类 (h-9 = 36px)
 *  - 与新建任务按钮 h-9 一致,视觉规整
 *  - gap-2.5 = 10px,平衡 icon 与文字间距
 *  - px-2.5 + py-2 = 10px/8px 内边距
 *  - font-medium + leading-none + whitespace-nowrap
 *  - [&>span]:translate-y-[var(--text-vcenter-offset)] 读 CSS 变量(默认 0.3px)
 *  - transition-colors 仅过渡颜色(不会让 translateY 抖动)
 */
export const NAV_ITEM_BASE_CLASS =
  'flex h-9 min-w-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium leading-none whitespace-nowrap transition-colors [&>span]:translate-y-[var(--text-vcenter-offset)]'

/** 折叠态宽度类:w-9 = 36px 与 h-9 严格相等形成 36×36 正方形 */
export const NAV_ITEM_COLLAPSED_CLASS = 'w-9 mx-auto justify-center'

/** 展开态宽度类:占满父容器宽度 */
export const NAV_ITEM_EXPANDED_CLASS = 'w-full'

/** 展开子项(子级导航,缩进 5 单位)
 *  pl-5 = 20px 左缩进(与父级 icon 位置对齐)
 *  py-1.5 = 6px 上下内边距(高度略小于父级)
 */
export const NAV_CHILD_CLASS =
  'flex h-9 w-full min-w-0 items-center gap-2 rounded-md pl-5 pr-2.5 py-1.5 text-sm font-medium leading-none whitespace-nowrap transition-colors [&>span]:translate-y-[var(--text-vcenter-offset)]'

/** 通用按钮:新建任务 / 工具栏触发器
 *  - h-9 w-full 与导航项高度一致
 *  - bg-foreground/10 浅色态背景,hover 加深到 20%
 *  - [&>span]:translate-y-[var(--text-vcenter-offset)] 对齐(默认 0.3px)
 */
export const BTN_NEW_CONVERSATION_CLASS =
  'flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm font-medium leading-none transition-colors [&>span]:translate-y-[var(--text-vcenter-offset)]'

/** 通用 chip / 可关闭标签
 *  - h-7 = 28px(比主导航项略矮)
 *  - text-xs 字号小,自动走 globals.css text-xs 专用 0.7px 偏移规则
 */
export const CHIP_BASE_CLASS =
  'inline-flex h-7 shrink-0 items-center gap-1 rounded-md border py-0 pl-7 pr-1 text-xs leading-none transition-colors'

/** 顶部标题栏 (h-14 = 56px,含主标题 + 副标题)
 *  - 用于 ai-side-panel / chat-header 等场景
 *  - [&>div>span:first-child]:translate-y-[var(--text-vcenter-offset)] 对齐主标题
 */
export const HEADER_BAR_CLASS =
  'flex h-14 shrink-0 items-center gap-2 px-3 [&>div>span:first-child]:translate-y-[var(--text-vcenter-offset)]'

/** 模型选择器下拉触发器 (h-9,icon + 文字 + chevron)
 *  - 三元素同行,中间文字 span 加 translateY
 */
export const MODEL_SELECTOR_TRIGGER_CLASS =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm font-medium transition-colors [&>span]:translate-y-[var(--text-vcenter-offset)]'
