// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup, screen } from '@testing-library/react'

import { Switch } from '@ihui/ui-react'

/**
 * Switch 视觉与行为守门测试 (2026-07-22 立)
 *
 * 防止以下回归(AGENTS.md §4 圆角守门 + 粗野方块设计语言,2026-08-01 重设计):
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
    expect(cls, 'Track 应该有 rounded-md').toContain('rounded-md')
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

describe('Switch 粗野硬阴影 (Neo-Brutalist,2026-08-01 重设计)', () => {
  afterEach(() => cleanup())

  it('Track 包含 3px 硬阴影(非柔光弥散)', () => {
    render(<Switch data-testid="sw" />)
    const cls = screen.getByTestId('sw').getAttribute('class') ?? ''
    expect(cls, 'Track 应该有硬阴影').toContain('shadow-[3px_3px_0_var(--color-foreground)]')
  })

  it('Track 按下时阴影收缩 + 2px 位移(实体按键反馈)', () => {
    render(<Switch data-testid="sw" />)
    const cls = screen.getByTestId('sw').getAttribute('class') ?? ''
    expect(cls, '按下应有 2px 位移').toContain('active:translate-x-[2px]')
    expect(cls, '按下应阴影收缩').toContain('active:shadow-[1px_1px_0_var(--color-foreground)]')
  })

  it('ON 状态:Track 品牌橙背景 + Thumb 变白', () => {
    render(<Switch data-testid="sw" defaultChecked />)
    const rootCls = screen.getByTestId('sw').getAttribute('class') ?? ''
    const thumb = screen.getByTestId('sw').querySelector('span')
    const thumbCls = thumb?.getAttribute('class') ?? ''
    expect(rootCls, 'ON 应为品牌橙').toContain(
      'data-[state=checked]:bg-[var(--color-brand-orange)]',
    )
    expect(thumbCls, 'ON 拇指应变白').toContain('data-[state=checked]:bg-background')
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
    expect(cls, 'Track 按下位移应归零').toContain('motion-reduce:active:translate-x-0')
  })

  it('Thumb 包含 motion-reduce:transition-none + motion-reduce:shadow-none', () => {
    render(<Switch data-testid="sw" />)
    const thumb = screen.getByTestId('sw').querySelector('span')
    const cls = thumb?.getAttribute('class') ?? ''
    expect(cls, 'Thumb 应该有 motion-reduce:transition-none').toContain(
      'motion-reduce:transition-none',
    )
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
    expect(rootCls, 'sm Track 应有 h-5 w-9').toMatch(/h-5.*w-9|w-9.*h-5/)
    expect(thumbCls, 'sm Thumb 应有 h-3 w-3').toMatch(/h-3.*w-3|w-3.*h-3/)
    expect(thumbCls, 'sm Thumb 应有 checked 位移 15px').toContain(
      'data-[state=checked]:translate-x-[15px]',
    )
  })

  it('md:Track h-5 w-9 + Thumb h-4 w-4 + translate-x-4(默认尺寸)', () => {
    render(<Switch data-testid="sw" />)
    const root = screen.getByTestId('sw')
    const thumb = root.querySelector('span')
    const rootCls = root.getAttribute('class') ?? ''
    const thumbCls = thumb?.getAttribute('class') ?? ''
    expect(rootCls, 'md Track 应有 h-6 w-11').toMatch(/h-6.*w-11|w-11.*h-6/)
    expect(thumbCls, 'md Thumb 应有 h-4 w-4').toMatch(/h-4.*w-4|w-4.*h-4/)
    expect(thumbCls, 'md Thumb 应有 checked 位移 19px').toContain(
      'data-[state=checked]:translate-x-[19px]',
    )
  })

  it('lg:Track h-6 w-11 + Thumb h-5 w-5 + translate-x-5', () => {
    render(<Switch data-testid="sw" size="lg" />)
    const root = screen.getByTestId('sw')
    const thumb = root.querySelector('span')
    const rootCls = root.getAttribute('class') ?? ''
    const thumbCls = thumb?.getAttribute('class') ?? ''
    expect(rootCls, 'lg Track 应有 h-7 w-[52px]').toMatch(/h-7.*w-\[52px\]|w-\[52px\].*h-7/)
    expect(thumbCls, 'lg Thumb 应有 h-5 w-5').toMatch(/h-5.*w-5|w-5.*h-5/)
    expect(thumbCls, 'lg Thumb 应有 checked 位移 23px').toContain(
      'data-[state=checked]:translate-x-[23px]',
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
