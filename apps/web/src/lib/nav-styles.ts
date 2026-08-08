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
 * 并通过 `:where(button, a, [role=button], [role=menuitem]):has(> span) > span`
 * 全局选择器自动应用,无需手动加类;覆盖 icon+文字 和 纯文字 两种场景
 * (2026-07-24 从 :has(>svg):has(>span) 放宽到 :has(>span),根治纯文字按钮偏下)。
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
 *  - gap-2.5 + px-2.5 + py-2 与 NAV_ITEM_BASE_CLASS 完全对齐(2026-08-02 修:原 gap-2/px-3 导致文字位置与导航项不一致)
 *  - [&>span]:translate-y-[var(--text-vcenter-offset)] 对齐(默认 0.3px)
 */
export const BTN_NEW_CONVERSATION_CLASS =
  'flex h-9 min-w-0 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium leading-none whitespace-nowrap transition-colors [&>span]:translate-y-[var(--text-vcenter-offset)]'

/** 通用 chip / 可关闭标签
 *  - h-7 = 28px(比主导航项略矮)
 *  - text-xs 字号小,自动走 globals.css text-xs 专用 0.7px 偏移规则
 */
export const CHIP_BASE_CLASS =
  'inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2.5 py-0 text-xs leading-none transition-colors'

/** 顶部标题栏 (h-14 = 56px,含主标题 + 副标题)
 *  - 用于 ai-side-panel / chat-header 等场景
 *  - [&>div>span:first-child]:translate-y-[var(--text-vcenter-offset)] 对齐主标题
 */
export const HEADER_BAR_CLASS =
  'flex h-14 shrink-0 items-center gap-2 px-3 [&>div>span:first-child]:translate-y-[var(--text-vcenter-offset)]'

/** 顶栏按钮/标签共享基础类 (h-9 = 36px, 2026-07-30 立)
 *  - 复用范围:GlobalTopBar(Plus 按钮 / 窗口控制按钮 Min/Max/Close)+ TagsView(搜索按钮 / 标签 Link / Dropdown trigger)
 *  - 4 处元素高度雷同(都是 h-full 撑满 h-9 父容器),共享 base 杜绝"看似不同其实只是 padding/bg 不同"的雷同 className 重复
 *  - 约束:所有子项 h-full 撑满父容器严丝合缝对齐 / rounded-md (6px) / 文字图标垂直水平居中
 *  - 包含 focus 行为(focus-visible:bg-accent),4 类元素统一焦点环
 *
 *  2026-07-30 用户规则:"这些按钮应该有背景色设定啊 全局统一 hover时突出"
 *  2026-07-30 用户反馈:"睁开你的狗眼看看 哪里有背景色?跟底色背景也没区分开啊"
 *
 *  修正(原 bg-muted/30 在亮色下计算 94.87% L,跟背景 96.1% L 差距仅 1.23% L 肉眼不可见):
 *  - 默认 bg-card:亮色 100% L(比 bg 96.1% 亮 3.9%,更白符合用户偏好)/
 *    暗色 10% L(比 bg 14% 深 4%,更黑符合用户偏好)— 与背景明显区分
 *  - hover:bg-accent:亮色 88% L(比默认 100% 深 12%,明显加深)/
 *    暗色 17% L(比默认 10% 浅 7%,反相但差距足够大,突出)— hover 突出
 *  - text-foreground/80:统一文字色(原本散落在各使用处,现提到 base 统一)
 *  - 层级:bg-card(默认 亮100/暗10) < bg-accent(hover 亮88/暗17) ≤ bg-accent text-foreground(active,Plus 打开,文字加深)
 *  - close 变体保留红色 hover(WindowControlButton variant='close'),在 base 之后追加覆盖
 *
 *  ⚠️ 防回归(2026-08-01 立):本常量是顶栏/TagsView 等场景的共享 base,默认 bg-card 是用户既定要求,
 *  不得擅自移除。侧边栏底部工具栏5按钮(收起/语言/下载/消息/主题)用户要求默认透明,
 *  应在 sidebar.tsx 使用处用 cn(TOPBAR_BTN_BASE, 'bg-transparent', ...) 局部覆盖,
 *  不得改本常量影响其他按钮(Plus/窗口控制/搜索/标签/Dropdown trigger 等)。
 */
export const TOPBAR_BTN_BASE =
  'inline-flex h-full shrink-0 items-center justify-center rounded-md bg-card text-foreground/80 transition-colors hover:bg-accent focus:outline-none focus-visible:bg-accent [&>svg]:!h-3.5 [&>svg]:!w-3.5'

/** 顶栏按钮/标签宽度(2026-07-30 第十轮"做减法 v6"用户反馈"搜索/chevron-down/Plus 按钮应一致 + 正方形"后升级 w-7 → w-9)
 *  - Plus 按钮 / 窗口控制按钮 / Dropdown trigger / 搜索按钮 4 类全部统一 36×36 正方形
 *  - 之前 w-7 (28×36) 矩形,3 类按钮"看似不同实则都是 28×36 雷同"但跟搜索按钮 36×36 视觉参差 */
export const TOPBAR_BTN_W9 = 'w-9'

/** 模型选择器下拉触发器 (h-9,icon + 文字 + chevron)
 *  - 三元素同行,中间文字 span 加 translateY
 */
export const MODEL_SELECTOR_TRIGGER_CLASS =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm font-medium transition-colors [&>span]:translate-y-[var(--text-vcenter-offset)]'

/** 消息输入框附加状态栏 — 容器 (2026-08-07 立)
 *  - 位于 message-input.tsx 顶部第一行(权限模式/历史/添加 三按钮所在)
 *  - 父 div 高度 = INPUT_ATTACHMENT_BAR_BTN_BASE 的 h-7(28px)+ py-1(8px)= 36px
 *  - 之前 py-1.5(12px)+ 子按钮最高 h-9(36px)= 48px,缩窄 12px
 *  - bg-muted/50 + rounded-t-xl:与输入卡片顶部融合(卡片无独立描边时也有视觉分界)
 *  - 配套按钮类 INPUT_ATTACHMENT_BAR_BTN_BASE(h-7,28px)严格统一
 */
export const INPUT_ATTACHMENT_BAR_CLASS =
  'flex items-center gap-1 rounded-t-xl bg-muted/50 px-2 py-1'

/** 消息输入框附加状态栏 — 按钮基础类 (h-7 = 28px,2026-08-07 立)
 *  - 高度规整 h-7(28px),与 chip / 状态徽章档一致,小于底部 ai-input-toolbar 的 h-8(32px)
 *  - 视觉层级:顶部附加栏(状态/切换) < 底部工具栏(主操作),h-7 < h-8 自然分层
 *  - gap-1.5 + px-2 + leading-none:紧凑可点击,文字图标不偏斜
 *  - text-xs 字号下,globals.css 专用 0.7px 偏移规则兜底图标/中文对齐
 *  - 含 disabled 兜底(disabled:cursor-not-allowed disabled:opacity-50)
 *  - 不含颜色态(text-/bg-/hover-):使用方按场景在 cn() 中追加(权限模式有风险色变体,历史/添加用中性色)
 *  - 不含 shrink-0 之外的尺寸约束(部分按钮是纯图标如历史,可补 w-7 形成 28×28 正方形)
 *  - 根治规则(2026-08-07 立):消息输入框附加栏所有 button 必须 import 此常量,禁止各组件独立写 h-*,
 *    杜绝"h-7 / h-9 / py-1 各写各的"导致高度参差再发生。
 */
export const INPUT_ATTACHMENT_BAR_BTN_BASE =
  'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium leading-none whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50'
