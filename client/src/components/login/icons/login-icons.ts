/**
 * LoginIcons - 登录页面统一 SVG 图标库
 *
 * 严格对齐侧边栏 Sidebar.vue 的图标规范：
 * - 24×24 viewBox + 2px stroke + currentColor 颜色继承
 * - stroke-linecap/linejoin: round
 * - 通过 h() 函数动态构造（避免 v-html/XSS 风险）
 * - markRaw 跳过 Vue 响应式代理（图标无响应式数据）
 *
 * 使用方式：
 *   import { UserIcon, LockIcon } from './icons/login-icons'
 *   <component :is="UserIcon" class="my-icon" />
 *
 * 优势：
 * 1. 视觉统一：与侧边栏 1:1 像素级一致
 * 2. 可定制：每个图标可独立调整 size、stroke-width
 * 3. 性能优：markRaw + render() 比模板内 SVG 更快
 * 4. 易扩展：新增图标只需添加一个 markRaw 组件
 */

import { h, markRaw, type Component } from 'vue'

/* ═══════════════════════════════════════════════════════════════════════════
 * 基础 SVG 属性（与 Sidebar.svgBase 严格一致）
 * ═══════════════════════════════════════════════════════════════════════════ */
const svgBase = {
  xmlns: 'http://www.w3.org/2000/svg' as const,
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
  'aria-hidden': 'true',
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 工厂函数：创建可复用图标组件
 * ═══════════════════════════════════════════════════════════════════════════ */
type IconChildren = ReturnType<typeof h>[]

function createIcon(name: string, children: IconChildren): Component {
  return markRaw({
    name,
    render() {
      return h('svg', svgBase, children)
    },
  }) as unknown as Component
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Tab 标签图标（标签切换器专用）
 * ═══════════════════════════════════════════════════════════════════════════ */

/** 账号登录 tab 图标 — 头部圆 + 肩部弧形（Lucide User） */
export const UserTabIcon = createIcon('UserTabIcon', [
  h('circle', { cx: 12, cy: 8, r: 4 }),
  h('path', { d: 'M5.5 21a6.5 6.5 0 0 1 13 0' }),
])

/** 手机号登录 tab 图标 — 听筒式（Lucide Phone） */
export const PhoneTabIcon = createIcon('PhoneTabIcon', [
  h('path', {
    d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  }),
])

/** 企业登录 tab 图标 — 中间高两侧低（Lucide Building2） */
export const EnterpriseTabIcon = createIcon('EnterpriseTabIcon', [
  h('path', { d: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z' }),
  h('path', { d: 'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2' }),
  h('path', { d: 'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2' }),
  h('path', { d: 'M10 6h4' }),
  h('path', { d: 'M10 10h4' }),
  h('path', { d: 'M10 14h4' }),
  h('path', { d: 'M10 18h4' }),
])

/* ═══════════════════════════════════════════════════════════════════════════
 * 输入框前缀图标
 * ═══════════════════════════════════════════════════════════════════════════ */

/** User 图标（输入框前缀）— 与 TabSwitcher 一致 */
export const UserIcon = createIcon('UserIcon', [
  h('circle', { cx: 12, cy: 8, r: 4 }),
  h('path', { d: 'M5.5 21a6.5 6.5 0 0 1 13 0' }),
])

/** Lock 图标（输入框前缀）— Lucide Lock */
export const LockIcon = createIcon('LockIcon', [
  h('rect', { width: 18, height: 11, x: 3, y: 11, rx: 2, ry: 2 }),
  h('path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }),
])

/** Phone 图标（输入框前缀）— 听筒式 */
export const PhoneIcon = createIcon('PhoneIcon', [
  h('path', {
    d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  }),
])

/** KeyRound 图标（验证码输入框）— Lucide KeyRound */
export const KeyRoundIcon = createIcon('KeyRoundIcon', [
  h('path', {
    d: 'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z',
  }),
  h('circle', { cx: 16.5, cy: 7.5, r: 0.5, fill: 'currentColor' }),
])

/** Key 图标（图形验证码输入框）— Lucide Key */
export const KeyIcon = createIcon('KeyIcon', [
  h('circle', { cx: 7.5, cy: 15.5, r: 5.5 }),
  h('path', { d: 'm21 2-9.6 9.6' }),
  h('path', { d: 'm15.5 7.5 3 3L22 7l-3-3' }),
])

/** Clock 图标（历史账号）— Lucide Clock */
export const ClockIcon = createIcon('ClockIcon', [
  h('circle', { cx: 12, cy: 12, r: 10 }),
  h('polyline', { points: '12 6 12 12 16 14' }),
])

/** Mail 邮件图标（邮箱输入框）— Lucide Mail */
export const MailIcon = createIcon('MailIcon', [
  h('rect', { width: 20, height: 16, x: 2, y: 4, rx: 2 }),
  h('path', { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' }),
])

/** DocumentChecked 文档已签图标（协议确认）— Lucide FileCheck */
export const DocumentCheckedIcon = createIcon('DocumentCheckedIcon', [
  h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
  h('path', { d: 'M14 2v6h6' }),
  h('path', { d: 'm9 15 2 2 4-4' }),
])

/**
 * 消息对话气泡 (Lucide MessageSquare)
 * 用途: 密码重置页 - 邮箱验证方式 radio 图标
 */
export const MessageSquareIcon = createIcon('MessageSquareIcon', [
  h('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }),
])

/**
 * 圆形勾选 (Lucide CircleCheck / CheckCircle)
 * 用途: 密码重置成功页 - 大号成功徽章
 */
export const CircleCheckIcon = createIcon('CircleCheckIcon', [
  h('circle', { cx: 12, cy: 12, r: 10 }),
  h('path', { d: 'm9 12 2 2 4-4' }),
])

/* ═══════════════════════════════════════════════════════════════════════════
 * 操作类图标
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Close 关闭按钮（Lucide X） */
export const CloseIcon = createIcon('CloseIcon', [
  h('path', { d: 'M18 6 6 18' }),
  h('path', { d: 'm6 6 12 12' }),
])

/** Info 信息提示（企业登录模式 banner）— Lucide Info */
export const InfoIcon = createIcon('InfoIcon', [
  h('circle', { cx: 12, cy: 12, r: 10 }),
  h('path', { d: 'M12 16v-4' }),
  h('path', { d: 'M12 8h.01' }),
])

/** Eye 密码显示 — Lucide Eye */
export const EyeIcon = createIcon('EyeIcon', [
  h('path', { d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' }),
  h('circle', { cx: 12, cy: 12, r: 3 }),
])

/** EyeOff 密码隐藏 — Lucide EyeOff */
export const EyeOffIcon = createIcon('EyeOffIcon', [
  h('path', { d: 'M9.88 9.88a3 3 0 1 0 4.24 4.24' }),
  h('path', { d: 'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68' }),
  h('path', { d: 'M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61' }),
  h('line', { x1: 2, x2: 22, y1: 2, y2: 22 }),
])

/** Refresh 刷新（验证码图片）— Lucide RefreshCw */
export const RefreshIcon = createIcon('RefreshIcon', [
  h('path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }),
  h('path', { d: 'M21 3v5h-5' }),
  h('path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' }),
  h('path', { d: 'M3 21v-5h5' }),
])

/** Search 搜索 — Lucide Search */
export const SearchIcon = createIcon('SearchIcon', [
  h('circle', { cx: 11, cy: 11, r: 8 }),
  h('line', { x1: 21, x2: 16.65, y1: 21, y2: 16.65 }),
])

/** ArrowDown 下拉箭头 — Lucide ChevronDown */
export const ArrowDownIcon = createIcon('ArrowDownIcon', [
  h('polyline', { points: '6 9 12 15 18 9' }),
])

/** 忘记密码图标 — 与验证码 KeyRound 一致 */
export const ForgotPasswordIcon = KeyRoundIcon

/* ═══════════════════════════════════════════════════════════════════════════
 * 图标映射表（方便按字符串 key 动态获取）
 * ═══════════════════════════════════════════════════════════════════════════ */
export const iconMap: Record<string, Component> = {
  // Tab 标签
  'user-tab': UserTabIcon,
  'phone-tab': PhoneTabIcon,
  'enterprise-tab': EnterpriseTabIcon,
  // 输入框前缀
  user: UserIcon,
  lock: LockIcon,
  phone: PhoneIcon,
  'key-round': KeyRoundIcon,
  key: KeyIcon,
  clock: ClockIcon,
  mail: MailIcon,
  // 操作类
  close: CloseIcon,
  info: InfoIcon,
  eye: EyeIcon,
  'eye-off': EyeOffIcon,
  refresh: RefreshIcon,
  search: SearchIcon,
  'arrow-down': ArrowDownIcon,
  'forgot-password': ForgotPasswordIcon,
  'document-checked': DocumentCheckedIcon,
  'message-square': MessageSquareIcon,
  'circle-check': CircleCheckIcon,
}

