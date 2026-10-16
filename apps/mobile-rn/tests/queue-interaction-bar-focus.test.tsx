// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * QueueInteractionBar 编辑输入框的聚焦反馈锁
 * (票 G-978007 / G-42 第①格 —— RN 端在守门 `scripts/check-input-focus-feedback.mjs`
 * (runner id 212)上的最后一枚存量:裸 `TextInput` + `styles.editInput` 有描边却对聚焦毫无反应)
 *
 * 迁到唯一实现 `packages/app/src/components/TextField.tsx`(经 `@ihui/rn-app`)后,端内
 * **不得**再写第二份聚焦状态(票面点名的"两份实现再靠对账追平"反模式)。
 *
 * 断言落在真实边界上:取的是 jsdom 里真 fireEvent.focus 之后 DOM 节点上的内联样式
 * (React DOM 会把 '#000000' 归一成 'rgb(0, 0, 0)',所以判据两侧都用归一后的串),
 * 而不是截图、也不是自证的字符串比对。四格:
 *  1. 常态 1px 描边且取色**不是**墨档(AGENTS §4:墨档只允许出现在聚焦态);
 *  2. 聚焦 borderWidth 1→2(focusedStyle 通道)且取色逐字落墨档(亮 rgb(0,0,0) / 暗 rgb(255,255,255));
 *  3. 失焦不得粘住(回到常态粗细与非墨档取色);
 *  4. onChangeText / onSubmitEditing 经共享件透传仍然有效(迁件最容易吃掉的就是宿主回调)。
 * 另加一条接线锁(形态同 packages/app/tests/text-field.test.tsx 的 colorScheme 必填锁):
 * 本组件必须从 @ihui/rn-app 取 TextField,且不再 value 导入 RN TextInput、不再写本地 onFocus。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t, locale: 'zh-CN', setLocale: async () => {} }) }
})

import { QueueInteractionBar } from '../src/components/ai/QueueInteractionBar'
import { commitRnTheme } from '../src/theme/active-tokens'

/** react-native 替身把 TextInput 渲染成 <input>,样式经 flatten 落进内联 style */
const EDIT_TEXT = 'ai.pane.queueOps.edit'

const renderEditing = () => {
  const onEdit = vi.fn()
  const r = render(
    <QueueInteractionBar
      items={[{ id: 'sq-1', text: '原始队列内容' }]}
      streaming={false}
      mode="queue"
      onEdit={onEdit}
    />,
  )
  // 未进编辑态 ⇒ 屏幕上没有输入框;点「编辑」才出现(量的就是这条真实交互链)
  expect(r.container.querySelectorAll('input')).toHaveLength(0)
  fireEvent.click(r.getByText(EDIT_TEXT))
  const inputs = r.container.querySelectorAll('input')
  expect(inputs).toHaveLength(1)
  return { ...r, input: inputs[0] as HTMLInputElement, onEdit }
}

afterEach(() => {
  // currentRnTheme() 是模块级单例,翻档必须还原,否则同文件后续用例读到深色档
  commitRnTheme('light')
})

describe('QueueInteractionBar 编辑输入框聚焦反馈(G-978007 RN 端最后一枚存量)', () => {
  it('浅色:常态 1px 非墨档 ⇒ 聚焦 1→2 且取色逐字纯黑 ⇒ 失焦不粘住', () => {
    const { input } = renderEditing()
    expect(input.style.borderWidth).toBe('1px')
    expect(input.style.borderColor).not.toBe('')
    expect(input.style.borderColor).not.toBe('rgb(0, 0, 0)')

    fireEvent.focus(input)
    expect(input.style.borderWidth).toBe('2px')
    expect(input.style.borderColor).toBe('rgb(0, 0, 0)')

    fireEvent.blur(input)
    expect(input.style.borderWidth).toBe('1px')
    expect(input.style.borderColor).not.toBe('rgb(0, 0, 0)')
  })

  it('深色:同一枚聚焦取色必须是纯白(深色档案下取 #262626 那类"看着有、屏幕上没有"要挡住)', () => {
    expect(commitRnTheme('dark')).toBe(true)
    const { input } = renderEditing()
    expect(input.style.borderWidth).toBe('1px')
    expect(input.style.borderColor).not.toBe('rgb(255, 255, 255)')

    fireEvent.focus(input)
    expect(input.style.borderWidth).toBe('2px')
    expect(input.style.borderColor).toBe('rgb(255, 255, 255)')
  })

  it('宿主回调经共享件透传:改文本 + 回车 ⇒ onEdit 收到已 trim 的新文本,编辑态退出', () => {
    const { container, input, onEdit } = renderEditing()
    fireEvent.change(input, { target: { value: '  改写后的队列内容  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onEdit).toHaveBeenCalledWith('sq-1', '改写后的队列内容')
    expect(container.querySelectorAll('input')).toHaveLength(0)
  })

  it('接线锁:交出去的是 @ihui/rn-app 的共享件,端内没有第二份聚焦实现', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(here, '../src/components/ai/QueueInteractionBar.tsx'), 'utf8')
    expect(src).toMatch(/import \{ TextField \} from '@ihui\/rn-app'/)
    // 不再 value 导入 RN 裸 TextInput(普查锁 packages/app/tests/text-field.test.tsx 同判据)
    expect(src).not.toMatch(/import \{[^}]*\bTextInput\b[^}]*\} from 'react-native'/)
    // 本地聚焦 state / onFocus 一律不得回来(那是"两份实现靠对账追平"的起点)
    expect(src).not.toMatch(/\bonFocus\b/)
    expect(src).not.toMatch(/\bfocused\b/)
    expect(src).not.toMatch(/setFocused/)
    // 主题必须显式传(守门 91 在类型层强制 colorScheme 必填),粗细只走 focusedStyle 通道
    expect(src).toMatch(/colorScheme=\{currentRnTheme\(\)\}/)
    expect(src).toMatch(/focusedStyle=\{\{ borderWidth: 2 \}\}/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
