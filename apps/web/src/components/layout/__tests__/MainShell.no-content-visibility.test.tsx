// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * G-60 取证回归锁(2026-10-25):MainShell 工作区渲染树不得携带 content-visibility /
 * contain-intrinsic-size。
 *
 * 取证链(票 G-60,按 2026-10-07 机主拍板口径独立裁定,结论 = 维持 2026-08-11 移除):
 * - 引入:d53d5fa1a7(2026-08-06)把 content-visibility:auto + contain-intrinsic-size:1000px
 *   挂在 main 元素自身;
 * - 移除:06bbd6b486(2026-08-11)提交信息列三个并列根因(pending 永久卡死 / content-visibility
 *   渲染 bug / error boundary 未重置 pending),content-visibility 一项无 bug 编号、无浏览器
 *   版本、无单独复现 —— 事后无法把事故责任从它身上剔除,"无碍"举证不成立;
 * - 收益已被承接:G-828 窗口化挂载(chat/windowing.ts,阈值 60 / 挂载上限 120)消费方现读在位
 *   (use-message-list-scroll.ts),窗口外的行根本不挂载;且 2026-10-22 起 main 为 flex-1
 *   恒撑满工作区、恒在视口内,原挂载点上 content-visibility:auto 的跳过条件永不触发,
 *   恢复 = 死代码 + 重开 08-11 事故路径。
 *
 * 断言全部为 DOM 数值断言(类名/内联样式字符串匹配,三态可分),不用截图目测;
 * 附"探测有牙"控制用例:手工渲染带违规样式的元素必须被抓到,证明探测器非恒绿。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup } from '@testing-library/react'

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => boolean) =>
    selector({ isAuthenticated: true }),
}))
vi.mock('@/components/common/GlobalErrorBanner', () => ({
  GlobalErrorBanner: () => null,
}))
vi.mock('@/components/layout/ConnectivityBanner', () => ({
  ConnectivityBanner: () => null,
}))

import { MainShell } from '../MainShell'

/** 违规样式特征:CSS 属性名与其 camelCase 序列化形态共用小写归一(含 Tailwind 任意值类)。 */
const FORBIDDEN_PATTERNS = [
  'content-visibility',
  'contentvisibility',
  'contain-intrinsic-size',
  'containintrinsicsize',
] as const

/** 全树扫描:返回携带违规样式特征的元素描述(空数组 = 无违规)。 */
function collectVisibilityViolations(root: HTMLElement): string[] {
  const violations: string[] = []
  const elements: HTMLElement[] = [root, ...root.querySelectorAll<HTMLElement>('*')]
  for (const el of elements) {
    const className = typeof el.className === 'string' ? el.className : ''
    const styleAttr = el.getAttribute('style') ?? ''
    for (const source of [className, styleAttr]) {
      const normalized = source.toLowerCase()
      const hit = FORBIDDEN_PATTERNS.find((p) => normalized.includes(p))
      if (hit) {
        violations.push(`<${el.tagName.toLowerCase()}> 含 "${hit}" (源: ${source.trim()})`)
        break
      }
    }
  }
  return violations
}

afterEach(() => {
  cleanup()
})

describe('MainShell content-visibility 移除维持锁(G-60 取证裁定)', () => {
  it('渲染树内不得出现 content-visibility / contain-intrinsic-size(维持 2026-08-11 移除)', () => {
    const { container } = render(
      <MainShell>
        <div data-testid="page-content">页面内容</div>
      </MainShell>,
    )
    // 先锁"容器在位"(锁的是它不带违规样式,不是它不存在),再锁全树无违规。
    const main = container.querySelector('main#main')
    expect(main, 'main#main 工作区容器应在位').not.toBeNull()
    expect(
      container.querySelector('[data-testid="page-content"]'),
      'children 应被渲染进工作区',
    ).not.toBeNull()
    expect(collectVisibilityViolations(container), '全树不得携带两类样式特征').toEqual([])
  })

  it('探测有牙(控制测量):手工携带违规样式的元素必须被抓到', () => {
    const { container } = render(
      <div>
        <div className="flex [content-visibility:auto] [contain-intrinsic-size:1000px]">
          假装恢复后的元素
        </div>
      </div>,
    )
    const violations = collectVisibilityViolations(container)
    expect(violations.length, '探测器应抓到违规元素').toBeGreaterThan(0)
    expect(violations[0]).toContain('content-visibility')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
