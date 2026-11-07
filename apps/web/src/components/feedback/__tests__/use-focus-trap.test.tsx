// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// useFocusTrap(2026-11-07 从 Drawer 抽出)的四项契约锁:
//   ① Tab 在层内循环(末→首、首→末);② Esc 只由栈顶层消费;
//   ③ 关闭后焦点回到打开前的触发元素;④ 多层打开时只有顶层响应 Esc。
//
// 这组用例的唯一目的:让"接上陷阱"可被证伪 —— 把 hook 摘成空实现,
// 下面 4 条必须红;否则说明这些断言测的不是陷阱本身。
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// 不 mock @ihui/ui-react:本文件只测 hook,但 @/lib/overlay-stack 是从该 barrel
// re-export 的;把 barrel 整体 mock 掉会把 pushOverlay/popOverlay 一起抹成 undefined,
// 测的就不再是真实的层栈语义了。

import { useFocusTrap } from '../Drawer'

function TrapPanel({
  open,
  stackId,
  onEscape,
  label,
}: {
  open: boolean
  stackId: string
  onEscape: () => void
  label: string
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  useFocusTrap({ open, panelRef, onEscape, stackId })
  if (!open) return null
  return React.createElement(
    'div',
    { ref: panelRef, role: 'dialog', 'aria-label': label },
    React.createElement('button', { type: 'button' }, `${label}-first`),
    React.createElement('button', { type: 'button' }, `${label}-mid`),
    React.createElement('button', { type: 'button' }, `${label}-last`),
  )
}

describe('useFocusTrap 四项契约', () => {
  afterEach(() => cleanup())

  it('Tab 在层内循环:末元素 Tab → 首元素,首元素 Shift+Tab → 末元素', async () => {
    render(
      React.createElement(TrapPanel, { open: true, stackId: 'a', onEscape: () => {}, label: 'A' }),
    )
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    const buttons = screen.getAllByRole('button')
    const first = buttons[0]!
    const last = buttons[buttons.length - 1]!

    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('Esc 由单层消费:onEscape 被调用一次', async () => {
    const onEscape = vi.fn()
    render(React.createElement(TrapPanel, { open: true, stackId: 'a', onEscape, label: 'A' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('关闭后焦点回到打开前的触发元素', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'open'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const { rerender } = render(
      React.createElement(TrapPanel, { open: true, stackId: 'a', onEscape: () => {}, label: 'A' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true),
    )

    rerender(
      React.createElement(TrapPanel, { open: false, stackId: 'a', onEscape: () => {}, label: 'A' }),
    )
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    trigger.remove()
  })

  it('多层同时打开:只有栈顶层响应 Esc', async () => {
    const onEscapeA = vi.fn()
    const onEscapeB = vi.fn()
    render(
      React.createElement(TrapPanel, { open: true, stackId: 'a', onEscape: onEscapeA, label: 'A' }),
    )
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'A' })).toBeTruthy())
    render(
      React.createElement(TrapPanel, { open: true, stackId: 'b', onEscape: onEscapeB, label: 'B' }),
    )
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'B' })).toBeTruthy())

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onEscapeB).toHaveBeenCalledTimes(1)
    expect(onEscapeA).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
