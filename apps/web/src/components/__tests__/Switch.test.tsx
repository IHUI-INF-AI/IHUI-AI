// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup, screen } from '@testing-library/react'

import { Switch } from '@ihui/ui'

/**
 * Switch 视觉与行为守门测试 (2026-07-22 立)
 *
 * 防止以下回归(AGENTS.md §4 圆角守门 + 3D 立体感 + 暗色模式):
 *   - Track 圆角从 rounded 退回 rounded-full(违反圆角守门)
 *   - Thumb 圆角从 rounded-sm 退回 rounded-full
 *   - 3D 阴影的 inset 高光 / drop shadow 误删
 *   - 暗色模式边缘 dark:ring-white/10 误删
 *   - prefers-reduced-motion 降级 motion-reduce:* 类误删
 *   - size 尺寸 map 偏移(checked translate-x 与 thumb size 不匹配)
 *
 * 设计说明:Switch 是 packages/ui 跨端共享的原子组件,通过 className 守门
 * 保证 Tailwind 编译后 token 完整落到 DOM,不需要在 web 端重复实现。
 */

describe('Switch 圆角守门 (AGENTS.md §4)', () => {
  afterEach(() => cleanup())

  it('Track 使用 rounded (4px) 圆形胶囊禁用', () => {
    render(<Switch data-testid="sw" />)
    const root = screen.getByTestId('sw')
    const cls = root.getAttribute('class') ?? ''
    expect(cls, 'Track 应该有 rounded 圆角').toContain('rounded')
    expect(cls, 'Track 不应该有 rounded-full 胶囊').not.toContain('rounded-full')
    expect(cls, 'Track 不应该有 rounded-pill').not.toContain('rounded-pill')
  })

  it('Thumb 使用 rounded-sm (2px) 方形微圆角,不是圆形', () => {
    render(<Switch data-testid="sw" />)
    // Switch thumb 渲染为 role=switch 内嵌的 span(无独立 data-testid)
    const root = screen.getByTestId('sw')
    const thumb = root.querySelector('span')
    expect(thumb, 'Switch 应该有 thumb span').not.toBeNull()
    const cls = thumb?.getAttribute('class') ?? ''
    expect(cls, 'Thumb 应该有 rounded-sm').toContain('rounded-sm')
    expect(cls, 'Thumb 不应该有 rounded-full').not.toContain('rounded-full')
  })
})

describe('Switch 3D 立体感阴影 (2026-07-22)', () => {
  afterEach(() => cleanup())

  it('Track unchecked 包含 inset 凹陷阴影', () => {
    render(<Switch data-testid="sw" />)
    const cls = screen.getByTestId('sw').getAttribute('class') ?? ''
    expect(cls, 'Track unchecked 应该有 inset 凹陷阴影').toContain(
      'data-[state=unchecked]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]',
    )
  })

  it('Track checked 包含双层 inset(顶部白光 + 底部深光)模拟按键凸起', () => {
    render(<Switch data-testid="sw" defaultChecked />)
    const cls = screen.getByTestId('sw').getAttribute('class') ?? ''
    expect(cls, 'Track checked 应该有顶部白光').toContain('rgba(255,255,255,0.25)')
    expect(cls, 'Track checked 应该有底部深光').toContain('rgba(0,0,0,0.12)')
  })

  it('Thumb 包含顶部白色高光(inset)+ 双层 drop shadow + 0.5px 黑边', () => {
    render(<Switch data-testid="sw" />)
    const thumb = screen.getByTestId('sw').querySelector('span')
    const cls = thumb?.getAttribute('class') ?? ''
    expect(cls, 'Thumb 应有顶部白色高光').toContain('inset_0_1px_0_rgba(255,255,255,0.9)')
    expect(cls, 'Thumb 应有第一层 drop shadow').toContain('0_1px_2px_rgba(0,0,0,0.18)')
    expect(cls, 'Thumb 应有第二层 drop shadow').toContain('0_1px_3px_rgba(0,0,0,0.1)')
    expect(cls, 'Thumb 应有 0.5px 黑色描边').toContain('0_0_0_0.5px_rgba(0,0,0,0.06)')
  })
})

describe('Switch 暗色模式边缘 (2026-07-22)', () => {
  afterEach(() => cleanup())

  it('Thumb 包含 dark:ring-1 dark:ring-white/10 增强暗色背景下的分离感', () => {
    render(<Switch data-testid="sw" />)
    const thumb = screen.getByTestId('sw').querySelector('span')
    const cls = thumb?.getAttribute('class') ?? ''
    expect(cls, 'Thumb 应该有 dark:ring-1').toContain('dark:ring-1')
    expect(cls, 'Thumb 应该有 dark:ring-white/10').toContain('dark:ring-white/10')
  })
})

describe('Switch prefers-reduced-motion 降级', () => {
  afterEach(() => cleanup())

  it('Track 包含 motion-reduce:transition-none + motion-reduce:shadow-none', () => {
    render(<Switch data-testid="sw" />)
    const cls = screen.getByTestId('sw').getAttribute('class') ?? ''
    expect(cls, 'Track 应该有 motion-reduce:transition-none').toContain(
      'motion-reduce:transition-none',
    )
    expect(cls, 'Track 应该有 motion-reduce:shadow-none').toContain('motion-reduce:shadow-none')
  })

  it('Thumb 包含 motion-reduce:transition-none + motion-reduce:shadow-none', () => {
    render(<Switch data-testid="sw" />)
    const thumb = screen.getByTestId('sw').querySelector('span')
    const cls = thumb?.getAttribute('class') ?? ''
    expect(cls, 'Thumb 应该有 motion-reduce:transition-none').toContain(
      'motion-reduce:transition-none',
    )
    expect(cls, 'Thumb 应该有 motion-reduce:shadow-none').toContain('motion-reduce:shadow-none')
  })
})

describe('Switch 尺寸变体 sm/md/lg', () => {
  afterEach(() => cleanup())

  it('sm:Track h-4 w-7 + Thumb h-3 w-3 + translate-x-3', () => {
    render(<Switch data-testid="sw" size="sm" />)
    const root = screen.getByTestId('sw')
    const thumb = root.querySelector('span')
    const rootCls = root.getAttribute('class') ?? ''
    const thumbCls = thumb?.getAttribute('class') ?? ''
    expect(rootCls, 'sm Track 应有 h-4 w-7').toMatch(/h-4.*w-7|w-7.*h-4/)
    expect(thumbCls, 'sm Thumb 应有 h-3 w-3').toMatch(/h-3.*w-3|w-3.*h-3/)
    expect(thumbCls, 'sm Thumb 应有 translate-x-3').toContain(
      'data-[state=checked]:translate-x-3',
    )
  })

  it('md:Track h-5 w-9 + Thumb h-4 w-4 + translate-x-4(默认尺寸)', () => {
    render(<Switch data-testid="sw" />)
    const root = screen.getByTestId('sw')
    const thumb = root.querySelector('span')
    const rootCls = root.getAttribute('class') ?? ''
    const thumbCls = thumb?.getAttribute('class') ?? ''
    expect(rootCls, 'md Track 应有 h-5 w-9').toMatch(/h-5.*w-9|w-9.*h-5/)
    expect(thumbCls, 'md Thumb 应有 h-4 w-4').toMatch(/h-4.*w-4|w-4.*h-4/)
    expect(thumbCls, 'md Thumb 应有 translate-x-4').toContain(
      'data-[state=checked]:translate-x-4',
    )
  })

  it('lg:Track h-6 w-11 + Thumb h-5 w-5 + translate-x-5', () => {
    render(<Switch data-testid="sw" size="lg" />)
    const root = screen.getByTestId('sw')
    const thumb = root.querySelector('span')
    const rootCls = root.getAttribute('class') ?? ''
    const thumbCls = thumb?.getAttribute('class') ?? ''
    expect(rootCls, 'lg Track 应有 h-6 w-11').toMatch(/h-6.*w-11|w-11.*h-6/)
    expect(thumbCls, 'lg Thumb 应有 h-5 w-5').toMatch(/h-5.*w-5|w-5.*h-5/)
    expect(thumbCls, 'lg Thumb 应有 translate-x-5').toContain(
      'data-[state=checked]:translate-x-5',
    )
  })
})

describe('Switch 行为', () => {
  afterEach(() => cleanup())

  it('未受控:点击切换 checked 状态', () => {
    render(<Switch data-testid="sw" />)
    const root = screen.getByTestId('sw')
    expect(root.getAttribute('data-state')).toBe('unchecked')
    fireEvent.click(root)
    expect(root.getAttribute('data-state')).toBe('checked')
    fireEvent.click(root)
    expect(root.getAttribute('data-state')).toBe('unchecked')
  })

  it('受控:checked + onCheckedChange 双向绑定', () => {
    const onCheckedChange = vi.fn()
    const { rerender } = render(
      <Switch data-testid="sw" checked={false} onCheckedChange={onCheckedChange} />,
    )
    const root = screen.getByTestId('sw')
    expect(root.getAttribute('data-state')).toBe('unchecked')
    fireEvent.click(root)
    expect(onCheckedChange, '点击应触发 onCheckedChange(true)').toHaveBeenCalledWith(true)
    rerender(<Switch data-testid="sw" checked onCheckedChange={onCheckedChange} />)
    expect(root.getAttribute('data-state')).toBe('checked')
  })

  it('disabled:点击不切换 + opacity-50', () => {
    render(<Switch data-testid="sw" disabled />)
    const root = screen.getByTestId('sw')
    expect(root.getAttribute('data-state')).toBe('unchecked')
    fireEvent.click(root)
    expect(root.getAttribute('data-state')).toBe('unchecked')
    const cls = root.getAttribute('class') ?? ''
    expect(cls, 'disabled 应该有 cursor-not-allowed').toContain('cursor-not-allowed')
    expect(cls, 'disabled 应该有 opacity-50').toContain('disabled:opacity-50')
  })

  it('ref 转发到根元素(SwitchPrimitives.Root)', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<Switch ref={ref} data-testid="sw" />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.getAttribute('data-state')).toBe('unchecked')
  })

  it('自定义 className 透传(用户态可扩展)', () => {
    render(<Switch data-testid="sw" className="custom-class" />)
    const cls = screen.getByTestId('sw').getAttribute('class') ?? ''
    expect(cls, '自定义 className 应保留').toContain('custom-class')
  })
})
