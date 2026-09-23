// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { usePromptHistory } from '@/hooks/use-prompt-history'

// 本测试用真实 usePromptHistory hook + 真实 <textarea> 搭最小接线,
// 复刻 MessageInput 的 onKeyDown 分支(↑/↓ 翻历史),以组件级粒度验收 D36 四项行为。
// 真词包模式参考 apps/web/src/components/ai/progress-sections/__tests__/terminal-section-isolation.test.tsx。

function Harness({ initialValue = '', attachments = '' }: { initialValue?: string; attachments?: string }) {
  const [value, setValue] = React.useState(initialValue)
  const taRef = React.useRef<HTMLTextAreaElement>(null)
  const promptHistory = usePromptHistory({
    getHistoryKey: () => 'test-conv',
    getCaretPosition: () => taRef.current?.selectionStart ?? 0,
    applyText: (text: string) => {
      setValue(text)
      requestAnimationFrame(() => {
        const len = text.length
        taRef.current?.focus()
        taRef.current?.setSelectionRange(len, len)
      })
    },
  })
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.nativeEvent.isComposing) {
      const handled = promptHistory.handleArrowKey(e, { value })
      if (handled) e.preventDefault()
    }
  }
  return (
    <div>
      <textarea
        data-testid="ta"
        ref={taRef}
        value={value}
        onChange={(e) => {
          promptHistory.resetCursor()
          setValue(e.target.value)
        }}
        onKeyDown={onKeyDown}
      />
      <span data-testid="attachments">{attachments}</span>
      <button data-testid="push1" onClick={() => promptHistory.pushSent('first-sent')}>
        push1
      </button>
      <button data-testid="push2" onClick={() => promptHistory.pushSent('second-sent')}>
        push2
      </button>
    </div>
  )
}

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  window.localStorage.clear()
})

describe('D36 会话内输入历史(组件级接线)', () => {
  it('↑ 回填上一条发送文本(最新在栈尾,首次上翻得到最新)', () => {
    render(<Harness />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      screen.getByTestId('push1').click()
      screen.getByTestId('push2').click()
    })
    expect(ta.value).toBe('')
    act(() => {
      fireEvent.keyDown(ta, { key: 'ArrowUp' })
    })
    // 最新发送文本 = second-sent
    expect(ta.value).toBe('second-sent')
  })

  it('连续 ↑ 上翻到更旧,↓ 反向回到原始草稿', () => {
    render(<Harness />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      screen.getByTestId('push1').click() // first-sent
      screen.getByTestId('push2').click() // second-sent
    })
    act(() => fireEvent.keyDown(ta, { key: 'ArrowUp' }))
    expect(ta.value).toBe('second-sent')
    act(() => fireEvent.keyDown(ta, { key: 'ArrowUp' }))
    expect(ta.value).toBe('first-sent')
    // ↓ 回到最新
    act(() => fireEvent.keyDown(ta, { key: 'ArrowDown' }))
    expect(ta.value).toBe('second-sent')
    // ↓ 再回到原始草稿(空)
    act(() => fireEvent.keyDown(ta, { key: 'ArrowDown' }))
    expect(ta.value).toBe('')
  })

  it('未发送新文本:首次 ↑ 先保存草稿,↓ 可返回该草稿', () => {
    render(<Harness />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      screen.getByTestId('push1').click()
      screen.getByTestId('push2').click()
    })
    // 用户输入了未发送的新文本
    act(() => {
      fireEvent.change(ta, { target: { value: 'my-unsent-draft' } })
    })
    act(() => fireEvent.keyDown(ta, { key: 'ArrowUp' }))
    expect(ta.value).toBe('second-sent')
    act(() => fireEvent.keyDown(ta, { key: 'ArrowDown' }))
    // ↓ 回到被保存的草稿
    expect(ta.value).toBe('my-unsent-draft')
  })

  it('翻历史时附件(引用)保持不动', () => {
    render(<Harness attachments="IMG-1.png" />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    const attachmentsEl = screen.getByTestId('attachments')
    act(() => {
      screen.getByTestId('push1').click()
      screen.getByTestId('push2').click()
    })
    act(() => fireEvent.keyDown(ta, { key: 'ArrowUp' }))
    expect(ta.value).toBe('second-sent')
    // 附件展示未被历史回填触碰
    expect(attachmentsEl.textContent).toBe('IMG-1.png')
  })

  it('多行且光标不在首行时,↑ 不劫持翻历史(只移动光标)', () => {
    render(<Harness />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      screen.getByTestId('push1').click()
      screen.getByTestId('push2').click()
    })
    // 输入多行文本并把光标放到第二行(索引 3 = 'a\n' 之后)
    act(() => {
      fireEvent.change(ta, { target: { value: 'line1\nline2' } })
    })
    act(() => {
      ta.setSelectionRange(3, 3)
    })
    const before = ta.value
    act(() => fireEvent.keyDown(ta, { key: 'ArrowUp' }))
    // 光标不在首行 → 不应回填历史,文本保持原样
    expect(ta.value).toBe(before)
    expect(ta.value).toBe('line1\nline2')
  })

  it('多行但光标在首行时,↑ 仍触发翻历史', () => {
    render(<Harness />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      screen.getByTestId('push1').click()
      screen.getByTestId('push2').click()
    })
    act(() => {
      fireEvent.change(ta, { target: { value: 'line1\nline2' } })
    })
    // 光标置于首行(索引 2 = 'line1' 末尾)
    act(() => {
      ta.setSelectionRange(2, 2)
    })
    act(() => fireEvent.keyDown(ta, { key: 'ArrowUp' }))
    expect(ta.value).toBe('second-sent')
  })
})
