// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { usePromptDrafts } from '@/hooks/use-prompt-drafts'
import { PROMPT_DRAFT_MAX_LENGTH, parsePromptDraft } from '@ihui/shared/chat/prompt-drafts'

// 本测试用真实 usePromptDrafts hook 搭最小接线,复刻 MessageInput 的消费方式
// (value/setValue 由调用方持有,draftKey 随 conversationId 变化),
// 以组件级粒度验收 D36 草稿半边:切会话保留/会话间隔离/清空不恢复/防抖写入/超长截断。

const KEY_A = 'chat:draft:conv-a'
const KEY_B = 'chat:draft:conv-b'

function Harness({ initialKey }: { initialKey: string }) {
  const [draftKey, setDraftKey] = React.useState(initialKey)
  const [value, setValue] = React.useState(() =>
    parsePromptDraft(window.localStorage.getItem(initialKey)),
  )
  const restoredCountRef = React.useRef(0)
  usePromptDrafts({
    draftKey,
    value,
    setValue,
    onRestored: React.useCallback(() => {
      restoredCountRef.current += 1
    }, []),
  })
  return (
    <div>
      <textarea data-testid="ta" value={value} onChange={(e) => setValue(e.target.value)} />
      <button data-testid="to-a" onClick={() => setDraftKey(KEY_A)}>
        to-a
      </button>
      <button data-testid="to-b" onClick={() => setDraftKey(KEY_B)}>
        to-b
      </button>
      <span data-testid="key">{draftKey}</span>
      <span data-testid="restored">{String(restoredCountRef.current)}</span>
    </div>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.localStorage.clear()
})

describe('D36 按会话输入草稿(组件级接线)', () => {
  it('输入停顿 500ms 后防抖写入当前会话桶', () => {
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(ta, { target: { value: 'draft-a' } })
    })
    // 防抖窗口内尚未落盘
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(window.localStorage.getItem(KEY_A)).toBe('draft-a')
  })

  it('切会话:输入写回旧桶,新桶草稿恢复到输入框(A 不漏进 B)', () => {
    window.localStorage.setItem(KEY_B, 'draft-b')
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(ta, { target: { value: 'draft-a' } })
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    act(() => {
      fireEvent.click(screen.getByTestId('to-b'))
    })
    // 新桶草稿恢复
    expect(ta.value).toBe('draft-b')
    // 旧桶内容保留:会话 A 的草稿不会漏进/丢失
    expect(window.localStorage.getItem(KEY_A)).toBe('draft-a')
    expect(screen.getByTestId('restored').textContent).toBe('1')
  })

  it('切走再切回:草稿仍在(切会话不丢)', () => {
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(ta, { target: { value: 'keep-me' } })
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    act(() => {
      fireEvent.click(screen.getByTestId('to-b'))
    })
    expect(ta.value).toBe('')
    act(() => {
      fireEvent.click(screen.getByTestId('to-a'))
    })
    expect(ta.value).toBe('keep-me')
  })

  it('清空后切换:旧桶被移除,切回不恢复(清空语义)', () => {
    window.localStorage.setItem(KEY_A, 'stale-draft')
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    expect(ta.value).toBe('stale-draft')
    act(() => {
      fireEvent.change(ta, { target: { value: '' } })
    })
    act(() => {
      fireEvent.click(screen.getByTestId('to-b'))
    })
    // 空输入切走 → 旧桶 removeItem
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
    act(() => {
      fireEvent.click(screen.getByTestId('to-a'))
    })
    expect(ta.value).toBe('')
  })

  it('超长草稿落盘时按共享层上限截断', () => {
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    const long = 'x'.repeat(PROMPT_DRAFT_MAX_LENGTH + 999)
    act(() => {
      fireEvent.change(ta, { target: { value: long } })
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    const stored = window.localStorage.getItem(KEY_A) ?? ''
    expect(stored).toHaveLength(PROMPT_DRAFT_MAX_LENGTH)
  })
})

describe('b75-5#2 pagehide/blur/visibilitychange 立即 flush(绕过防抖)', () => {
  it('pagehide:防抖未到期的草稿立即落盘', () => {
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(ta, { target: { value: 'before-hide' } })
    })
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(window.localStorage.getItem(KEY_A)).toBe('before-hide')
  })

  it('blur:防抖未到期的草稿立即落盘', () => {
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(ta, { target: { value: 'before-blur' } })
    })
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(window.localStorage.getItem(KEY_A)).toBe('before-blur')
  })

  it('visibilitychange(hidden):防抖未到期的草稿立即落盘', () => {
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(ta, { target: { value: 'before-hidden' } })
    })
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(window.localStorage.getItem(KEY_A)).toBe('before-hidden')
  })

  it('空内容 flush:removeItem 清桶', () => {
    window.localStorage.setItem(KEY_A, 'stale')
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(ta, { target: { value: '' } })
    })
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
  })
})
