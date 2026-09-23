// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen } from '@testing-library/react'

// next-intl mock:ai.pane 命名空间的 memoryNoticeBar 三键
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: { count?: number }) => {
    const n = params?.count ?? 0
    switch (key) {
      case 'memoryNoticeBar.title':
        return `已记住 ${n} 条`
      case 'memoryNoticeBar.manage':
        return '管理'
      case 'memoryNoticeBar.moreItems':
        return `等 ${n} 条`
      default:
        return key
    }
  },
}))

// next/link 在 jsdom 下无需真实路由行为
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { MemoryNoticeBar } from '../progress-sections/memory-notice-bar'

/**
 * MemoryNoticeBar 渲染守门测试(P1 #27 记忆更新可视化,2026-09-16 立)
 *
 * 验证:
 *   - items 为空 → 不渲染(避免空提示条)
 *   - 单条 → 头部「已记住 1 条」+ 首条摘要全文,且不渲染「等 N 条」
 *   - 多条 → 头部计数为总条数,正文只展示首条 + 「等 N 条」聚合文案(每轮限 1 条展示)
 *   - 「管理」入口指向 /memory-manager(记忆管理页已存在,不走设置页)
 *
 * 断言风格:沿用仓库既有测试(原生 vitest 断言,未引入 jest-dom)。
 */
describe('MemoryNoticeBar', () => {
  afterEach(() => cleanup())

  it('items 为空时不渲染', () => {
    const { container } = render(<MemoryNoticeBar items={[]} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('memory-notice-bar')).toBeNull()
  })

  it('单条:渲染标题计数与首条摘要,不渲染「等 N 条」', () => {
    render(<MemoryNoticeBar items={['用户偏好 TypeScript']} />)
    const bar = screen.getByTestId('memory-notice-bar')
    expect(bar).toBeTruthy()
    // FoldableSection 标题承载计数文案
    expect(bar.textContent).toContain('已记住 1 条')
    expect(screen.getByTestId('memory-notice-item-0').textContent).toBe('用户偏好 TypeScript')
    expect(screen.queryByTestId('memory-notice-more')).toBeNull()
  })

  it('多条:标题计数为总条数,正文只展示首条 + 聚合「等 N 条」', () => {
    render(<MemoryNoticeBar items={['第一条摘要', '第二条摘要', '第三条摘要']} />)
    const bar = screen.getByTestId('memory-notice-bar')
    expect(bar.textContent).toContain('已记住 3 条')
    // 每轮限 1 条展示:正文仅首条
    expect(screen.getByTestId('memory-notice-item-0').textContent).toBe('第一条摘要')
    expect(bar.textContent).not.toContain('第二条摘要')
    const more = screen.getByTestId('memory-notice-more')
    expect(more.textContent).toBe('等 2 条')
  })

  it('「管理」入口指向 /memory-manager', () => {
    render(<MemoryNoticeBar items={['A']} />)
    const link = screen.getByTestId('memory-notice-manage')
    expect(link.getAttribute('href')).toBe('/memory-manager')
    expect(link.textContent).toContain('管理')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
