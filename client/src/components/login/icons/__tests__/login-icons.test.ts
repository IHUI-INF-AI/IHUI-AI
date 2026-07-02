/**
 * 登录图标 SVG 渲染参数回归 (Vitest 单元测试, 2026-07-02)
 *
 * 与 e2e/login-icons.spec.ts (Playwright) 的分工:
 *   - 本文件: jsdom 环境, Vue test-utils 挂载组件, 验证 SVG 属性严格符合规范
 *   - e2e/login-icons.spec.ts: 源码级 import 检查 + 浏览器视觉断言
 *
 * 验证范围: 19 个图标组件的 viewBox / stroke-width / currentColor / round 端点
 *
 * 运行: npx vitest run src/components/login/icons/__tests__/login-icons.spec.ts
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import {
  UserIcon,
  LockIcon,
  PhoneIcon,
  KeyIcon,
  KeyRoundIcon,
  MailIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshIcon,
  CloseIcon,
  ArrowDownIcon,
  DocumentCheckedIcon,
  UserTabIcon,
  PhoneTabIcon,
  EnterpriseTabIcon,
  ClockIcon,
  InfoIcon,
  SearchIcon,
  ForgotPasswordIcon,
  MessageSquareIcon,
  CircleCheckIcon,
  iconMap,
} from '../login-icons'

// ════════════════════════════════════════════════════════════════════════
// 工具: 挂载图标并读取 SVG 属性
// ════════════════════════════════════════════════════════════════════════

function renderSvg(component: ReturnType<typeof h>) {
  const wrapper = mount({ render: () => h(component) })
  const svg = wrapper.find('svg')
  return {
    wrapper,
    svg,
    viewBox: svg.attributes('viewBox'),
    width: svg.attributes('width'),
    height: svg.attributes('height'),
    fill: svg.attributes('fill'),
    stroke: svg.attributes('stroke'),
    strokeWidth: svg.attributes('stroke-width'),
    strokeLinecap: svg.attributes('stroke-linecap'),
    strokeLinejoin: svg.attributes('stroke-linejoin'),
  }
}

const ICONS: Array<[string, ReturnType<typeof h>]> = [
  ['UserIcon', UserIcon],
  ['LockIcon', LockIcon],
  ['PhoneIcon', PhoneIcon],
  ['KeyIcon', KeyIcon],
  ['KeyRoundIcon', KeyRoundIcon],
  ['MailIcon', MailIcon],
  ['EyeIcon', EyeIcon],
  ['EyeOffIcon', EyeOffIcon],
  ['RefreshIcon', RefreshIcon],
  ['CloseIcon', CloseIcon],
  ['ArrowDownIcon', ArrowDownIcon],
  ['DocumentCheckedIcon', DocumentCheckedIcon],
  ['UserTabIcon', UserTabIcon],
  ['PhoneTabIcon', PhoneTabIcon],
  ['EnterpriseTabIcon', EnterpriseTabIcon],
  ['ClockIcon', ClockIcon],
  ['InfoIcon', InfoIcon],
  ['SearchIcon', SearchIcon],
  ['ForgotPasswordIcon', ForgotPasswordIcon],
  ['MessageSquareIcon', MessageSquareIcon],
  ['CircleCheckIcon', CircleCheckIcon],
]

// ════════════════════════════════════════════════════════════════════════
// 1) viewBox = "0 0 24 24"
// ════════════════════════════════════════════════════════════════════════

describe('login-icons SVG 渲染参数严格规范', () => {
  describe.each(ICONS)('%s viewBox', (name, comp) => {
    it('必须为 "0 0 24 24"', () => {
      const { viewBox } = renderSvg(comp)
      expect(viewBox, `${name} viewBox 应为 0 0 24 24`).toBe('0 0 24 24')
    })
  })

  // ════════════════════════════════════════════════════════════════════
  // 2) stroke-width = "2"
  // ════════════════════════════════════════════════════════════════════

  describe.each(ICONS)('%s stroke-width', (name, comp) => {
    it('必须为 "2" (与侧边栏图标严格一致)', () => {
      const { strokeWidth } = renderSvg(comp)
      expect(strokeWidth, `${name} stroke-width 应为 2`).toBe('2')
    })
  })

  // ════════════════════════════════════════════════════════════════════
  // 3) stroke = "currentColor" (颜色继承)
  // ════════════════════════════════════════════════════════════════════

  describe.each(ICONS)('%s stroke', (name, comp) => {
    it('必须为 "currentColor" (允许 hover/focus 显式蓝色)', () => {
      const { stroke } = renderSvg(comp)
      expect(stroke, `${name} stroke 应继承 currentColor`).toBe('currentColor')
    })
  })

  // ════════════════════════════════════════════════════════════════════
  // 4) stroke-linecap/linejoin = "round"
  // ════════════════════════════════════════════════════════════════════

  describe.each(ICONS)('%s 端点/拐角', (name, comp) => {
    it('stroke-linecap/linejoin 必须为 round', () => {
      const { strokeLinecap, strokeLinejoin } = renderSvg(comp)
      expect(strokeLinecap, `${name} stroke-linecap 应为 round`).toBe('round')
      expect(strokeLinejoin, `${name} stroke-linejoin 应为 round`).toBe('round')
    })
  })

  // ════════════════════════════════════════════════════════════════════
  // 5) width/height = "1em" (随父级 font-size 缩放)
  // ════════════════════════════════════════════════════════════════════

  describe.each(ICONS)('%s 尺寸', (name, comp) => {
    it('width/height 必须为 "1em"', () => {
      const { width, height } = renderSvg(comp)
      expect(width, `${name} width 应为 1em`).toBe('1em')
      expect(height, `${name} height 应为 1em`).toBe('1em')
    })
  })

  // ════════════════════════════════════════════════════════════════════
  // 6) fill = "none" (默认无填充, MailIcon 内部圆除外)
  // ════════════════════════════════════════════════════════════════════

  describe.each(ICONS)('%s fill', (name, comp) => {
    it('必须为 "none"', () => {
      const { fill } = renderSvg(comp)
      expect(fill, `${name} fill 应为 none (默认无填充)`).toBe('none')
    })
  })
})

// ════════════════════════════════════════════════════════════════════════
// 7) iconMap 映射完整性
// ════════════════════════════════════════════════════════════════════════

describe('iconMap 字符串 key 映射', () => {
  const REQUIRED_KEYS = [
    // Tab 标签
    'user-tab', 'phone-tab', 'enterprise-tab',
    // 输入框前缀
    'user', 'mail', 'phone', 'key', 'key-round', 'lock', 'clock',
    // 操作类
    'close', 'info', 'eye', 'eye-off', 'refresh', 'search',
    'arrow-down', 'forgot-password', 'document-checked',
    'message-square', 'circle-check',
  ] as const

  it.each(REQUIRED_KEYS)('iconMap.%s 必须存在且非空', (key) => {
    expect(iconMap[key], `iconMap.${key} 缺失`).toBeDefined()
    expect(iconMap[key], `iconMap.${key} 不应为 null/undefined`).toBeTruthy()
  })
})

// ════════════════════════════════════════════════════════════════════════
// 8) 关键图标必须有几何内容 (非空 svg)
// ════════════════════════════════════════════════════════════════════════

describe('图标几何内容 (防止 createIcon 误传空数组)', () => {
  it.each(ICONS)('%s 必须渲染至少 1 个子元素 (path/circle/rect/line)', (_name, comp) => {
    const wrapper = mount({ render: () => h(comp) })
    const svg = wrapper.find('svg')
    // SVG 直接子元素 (path / circle / rect / line / polyline / polygon)
    const childCount = svg.element.children.length
    expect(childCount, `${_name} 至少要有 1 个子 SVG 元素, 实际 ${childCount}`).toBeGreaterThan(0)
  })
})
