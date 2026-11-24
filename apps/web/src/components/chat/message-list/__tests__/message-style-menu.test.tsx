// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 单条消息样式菜单(2026-11-15 v3)
 *
 * 验证的是「菜单 → store」这一段契约:选值写入 messages[messageId],
 * 选「继承」删除该字段而不是写默认值,「重置」清空整条覆盖。
 * 样式编译(messageStyleVars)另有纯函数测试,不在此重复。
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { useAppearanceScopeStore } from '@/stores/appearance-scope'
import { MessageStyleMenu } from '../message-style-menu'

const MESSAGE_ID = 'm-style-1'

function selects(container: HTMLElement): HTMLSelectElement[] {
  return Array.from(container.querySelectorAll('select'))
}

describe('MessageStyleMenu', () => {
  beforeEach(() => {
    useAppearanceScopeStore.setState({ workspaces: {}, messages: {} })
  })
  afterEach(() => cleanup())

  it('字体/行高/字距/对齐选择写入消息覆盖', () => {
    const { container } = render(<MessageStyleMenu messageId={MESSAGE_ID} />)
    const [font, lineHeight, letterSpacing, align] = selects(container)

    fireEvent.change(font!, { target: { value: 'serif' } })
    fireEvent.change(lineHeight!, { target: { value: 'relaxed' } })
    fireEvent.change(letterSpacing!, { target: { value: 'wide' } })
    fireEvent.change(align!, { target: { value: 'justify' } })

    expect(useAppearanceScopeStore.getState().messages[MESSAGE_ID]).toEqual({
      fontFamily: 'serif',
      lineHeight: 'relaxed',
      letterSpacing: 'wide',
      textAlign: 'justify',
    })
  })

  it('选「继承」删除字段,字段删空后整条覆盖消失', () => {
    const { container } = render(<MessageStyleMenu messageId={MESSAGE_ID} />)
    const [font] = selects(container)

    fireEvent.change(font!, { target: { value: 'mono' } })
    expect(useAppearanceScopeStore.getState().messages[MESSAGE_ID]).toEqual({ fontFamily: 'mono' })

    fireEvent.change(font!, { target: { value: 'inherit' } })
    expect(useAppearanceScopeStore.getState().messages[MESSAGE_ID]).toBeUndefined()
  })

  it('字号滑杆回到 100% 视为继承,120% 写入 1.2', () => {
    const { container } = render(<MessageStyleMenu messageId={MESSAGE_ID} />)
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement

    fireEvent.change(slider, { target: { value: '120' } })
    expect(useAppearanceScopeStore.getState().messages[MESSAGE_ID]?.fontScale).toBe(1.2)

    fireEvent.change(slider, { target: { value: '100' } })
    expect(useAppearanceScopeStore.getState().messages[MESSAGE_ID]).toBeUndefined()
  })

  it('重置按钮清空该消息的全部覆盖', () => {
    useAppearanceScopeStore
      .getState()
      .setMessageOverride(MESSAGE_ID, { fontFamily: 'serif', codeFontSize: 18 })

    render(<MessageStyleMenu messageId={MESSAGE_ID} />)
    fireEvent.click(screen.getByTestId(`message-style-reset-${MESSAGE_ID}`))

    expect(useAppearanceScopeStore.getState().messages[MESSAGE_ID]).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
