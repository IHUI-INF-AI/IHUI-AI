// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { usePromptDrafts } from '@/hooks/use-prompt-drafts'
import { PROMPT_DRAFT_MAX_LENGTH } from '@ihui/shared/chat/prompt-drafts'

// 本测试用真实 usePromptDrafts hook 搭最小接线,复刻 MessageInput 的消费方式
// (value/setValue 由调用方持有,draftKey 随 conversationId 变化),
// 以组件级粒度验收 D36 草稿半边:切会话保留/会话间隔离/清空不恢复/防抖写入/超长截断。
//
// ## 2026-10-06(O59⑤):草稿值走加密通道后的两处口径变更
// 1. **写入断言不再看明文**:`write` 现在是异步的(加密把写入变异步),落盘值是信封。
//    故断言改为「读回来等于原值」而不是「盘上是原值」—— 这才是用户可见的不变量。
// 2. **fake timers 只 fake setTimeout/clearTimeout**:入队链走的是 Promise 微任务,
//    必须在 act() 里 await 把它排空,否则断言会打在"还没落盘"的中间态上。
//    (这是与本仓既有 async 测试同源的纪律,不是本次新增的特例。)

const KEY_A = 'chat:draft:conv-a'
const KEY_B = 'chat:draft:conv-b'

/** 排空入队链 + 让 React 提交 state 更新 */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function readBucket(key: string): Promise<string> {
  const { getChatDraftStorage } = await import('@/lib/chat-draft-storage')
  return getChatDraftStorage().read(key)
}

function Harness({ initialKey }: { initialKey: string }) {
  const [draftKey, setDraftKey] = React.useState(initialKey)
  const [value, setValue] = React.useState('')
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

beforeEach(async () => {
  window.localStorage.clear()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const { __resetChatDraftStorageForTest } = await import('@/lib/chat-draft-storage')
  __resetChatDraftStorageForTest()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.localStorage.clear()
})

describe('D36 按会话输入草稿(组件级接线)', () => {
  it('输入停顿 500ms 后防抖写入当前会话桶', async () => {
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    await settle()
    act(() => {
      fireEvent.change(ta, { target: { value: 'draft-a' } })
    })
    // 防抖窗口内尚未落盘
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
    act(() => {
      vi.advanceTimersByTime(500)
    })
    await settle()
    expect(await readBucket(KEY_A)).toBe('draft-a')
  })

  it('切会话:输入写回旧桶,新桶草稿恢复到输入框(A 不漏进 B)', async () => {
    window.localStorage.setItem(KEY_B, 'draft-b')
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    await settle()
    act(() => {
      fireEvent.change(ta, { target: { value: 'draft-a' } })
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    await settle()
    act(() => {
      fireEvent.click(screen.getByTestId('to-b'))
    })
    await settle()
    // 新桶草稿恢复
    expect(ta.value).toBe('draft-b')
    // 旧桶内容保留:会话 A 的草稿不会漏进/丢失
    expect(await readBucket(KEY_A)).toBe('draft-a')
    expect(await readBucket(KEY_B)).toBe('draft-b')
    expect(screen.getByTestId('restored').textContent).toBe('1')
  })

  it('切走再切回:草稿仍在(切会话不丢)', async () => {
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    await settle()
    act(() => {
      fireEvent.change(ta, { target: { value: 'keep-me' } })
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    await settle()
    act(() => {
      fireEvent.click(screen.getByTestId('to-b'))
    })
    await settle()
    expect(ta.value).toBe('')
    act(() => {
      fireEvent.click(screen.getByTestId('to-a'))
    })
    await settle()
    expect(ta.value).toBe('keep-me')
  })

  it('清空后切换:旧桶被移除,切回不恢复(清空语义)', async () => {
    window.localStorage.setItem(KEY_A, 'stale-draft')
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    await settle()
    expect(ta.value).toBe('stale-draft')
    act(() => {
      fireEvent.change(ta, { target: { value: '' } })
    })
    act(() => {
      fireEvent.click(screen.getByTestId('to-b'))
    })
    await settle()
    // 空输入切走 → 旧桶清桶
    expect(await readBucket(KEY_A)).toBe('')
    act(() => {
      fireEvent.click(screen.getByTestId('to-a'))
    })
    await settle()
    expect(ta.value).toBe('')
  })

  it('超长草稿落盘时按共享层上限截断', async () => {
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    await settle()
    const long = 'x'.repeat(PROMPT_DRAFT_MAX_LENGTH + 999)
    act(() => {
      fireEvent.change(ta, { target: { value: long } })
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    await settle()
    const stored = await readBucket(KEY_A)
    expect(stored).toHaveLength(PROMPT_DRAFT_MAX_LENGTH)
  })

  it('解密未完成时不回填错桶:解密期间切会话,旧结果必须丢弃', async () => {
    // 这是异步化引入的新竞态。旧实现是同步 setValue,结构上不可能发生;
    // 现在读是 await 出来的,回来时 draftKey 可能已经变了 ⇒ 回填到错的桶比不回填更糟。
    //
    // 竞态窗口必须**真的造出来**,否则这条测试是无牙的:浏览器路径的 read 同步 resolve,
    // `.then` 排进微任务就完成,等不到 cleanup 生效。所以这里 mock 出一个受控的 read,
    // 手动卡住解密结果,模拟"解密还在飞"的真实桌面端时序。
    const { getChatDraftStorage } = await import('@/lib/chat-draft-storage')
    const real = getChatDraftStorage()
    let release: (() => void) | null = null
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const reads: string[] = []
    const spy = vi.spyOn(real, 'read').mockImplementation(async (key: string) => {
      reads.push(key)
      // 第一次真实读(拿 KEY_B 的真值),之后卡住模拟解密未完成
      if (reads.length === 1) {
        await gate
        return 'draft-b'
      }
      return ''
    })

    window.localStorage.setItem(KEY_B, 'draft-b')
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    act(() => {
      fireEvent.click(screen.getByTestId('to-b'))
    })
    // KEY_B 的解密被卡住、结果还在飞;此刻切到 KEY_A
    act(() => {
      fireEvent.click(screen.getByTestId('to-a'))
    })
    ;(release as unknown as () => void)()
    await settle()
    // KEY_A 本来没有草稿 ⇒ 输入框必须为空;若 KEY_B 的漏进来就是 'draft-b'
    expect(ta.value).toBe('')
    spy.mockRestore()
  })
})

describe('b75-5#2 pagehide/blur/visibilitychange 立即 flush(绕过防抖)', () => {
  it('pagehide:防抖未到期的草稿立即落盘', async () => {
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    await settle()
    act(() => {
      fireEvent.change(ta, { target: { value: 'before-hide' } })
    })
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    await settle()
    expect(await readBucket(KEY_A)).toBe('before-hide')
  })

  it('blur:防抖未到期的草稿立即落盘', async () => {
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    await settle()
    act(() => {
      fireEvent.change(ta, { target: { value: 'before-blur' } })
    })
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    await settle()
    expect(await readBucket(KEY_A)).toBe('before-blur')
  })

  it('visibilitychange(hidden):防抖未到期的草稿立即落盘', async () => {
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    await settle()
    act(() => {
      fireEvent.change(ta, { target: { value: 'before-hidden' } })
    })
    expect(window.localStorage.getItem(KEY_A)).toBeNull()
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await settle()
    expect(await readBucket(KEY_A)).toBe('before-hidden')
  })

  it('空内容 flush:清桶', async () => {
    window.localStorage.setItem(KEY_A, 'stale')
    render(<Harness initialKey={KEY_A} />)
    const ta = screen.getByTestId('ta') as HTMLTextAreaElement
    await settle()
    act(() => {
      fireEvent.change(ta, { target: { value: '' } })
    })
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    await settle()
    expect(await readBucket(KEY_A)).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
