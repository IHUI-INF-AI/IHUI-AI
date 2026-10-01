// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-815967 的装车证明(组件级):迟到的上传批次**不得**把上一个作业的结果落进当前列表,
// 而同一作业即使迟到也**必须**照常落态 —— 两臂同判据,缺一臂都能被"永不落态"的恒哑实现糊过。
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AttachmentsUpload, type AttachmentItem } from '@/components/form/AttachmentsUpload'

// 每一批上传的 resolve 由测试握着:这样"谁先回来"是**安排**出来的,不是碰运气等时序。
const inflight = vi.hoisted(() => new Map<string, (value: unknown) => void>())

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async (_url: string, opts?: { body?: FormData }) => {
    const part = opts?.body?.get('file')
    const name = part instanceof File ? part.name : String(part)
    return new Promise((resolve) => {
      inflight.set(name, resolve)
    })
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}))

function mkFile(name: string): File {
  return new File([new Uint8Array(8)], name, { type: 'application/pdf' })
}

function inputOf(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector('input[type="file"]')
  if (!(el instanceof HTMLInputElement)) throw new Error('夹具没拿到隐藏 file input')
  return el
}

function pickFiles(el: HTMLInputElement, files: File[]): void {
  Object.defineProperty(el, 'files', { value: files, configurable: true, writable: true })
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function okResponse(name: string) {
  return {
    success: true,
    data: { file: { id: `id-of-${name}`, name, size: 8, mimeType: 'application/pdf' } },
  }
}

afterEach(() => {
  cleanup()
  inflight.clear()
})

describe('迟到的上传批次:换人即拒(只判 mounted 拦不住这一型)', () => {
  it('A 在飞时发起 B ⇒ A 的回调不得把它的附件落进列表', async () => {
    const onChange = vi.fn()
    const { container } = render(<AttachmentsUpload value={[]} onChange={onChange} />)
    const el = inputOf(container)

    act(() => pickFiles(el, [mkFile('a.pdf')]))
    expect(inflight.has('a.pdf')).toBe(true)

    // 组件仍挂着(mounted 位为真)—— 这正是 mountedRef 单条件守卫判不住的那一格
    act(() => pickFiles(el, [mkFile('b.pdf')]))
    expect(inflight.has('b.pdf')).toBe(true)

    // B 先回、A 后回(迟到的那一批属于已被换掉的作业)
    await act(async () => inflight.get('b.pdf')?.(okResponse('b.pdf')))
    await act(async () => inflight.get('a.pdf')?.(okResponse('a.pdf')))

    const pushed = onChange.mock.calls.map((c) => (c[0] as AttachmentItem[]).map((i) => i.name))
    expect(pushed).toEqual([['b.pdf']])
    expect(pushed.flat()).not.toContain('a.pdf')
  })

  it('同一作业即使迟到 ⇒ 照旧生效(反向对照,防"永不落态"的恒哑实现)', async () => {
    const onChange = vi.fn()
    const { container } = render(<AttachmentsUpload value={[]} onChange={onChange} />)
    const el = inputOf(container)

    act(() => pickFiles(el, [mkFile('only.pdf')]))
    // 中间穿插一次与本轮无关的重渲染:身份未换,回调必须仍被承认
    expect(inflight.has('only.pdf')).toBe(true)
    await act(async () => inflight.get('only.pdf')?.(okResponse('only.pdf')))

    const pushed = onChange.mock.calls.map((c) => (c[0] as AttachmentItem[]).map((i) => i.name))
    expect(pushed).toEqual([['only.pdf']])
  })

  it('合并基准取"当前列表":在飞期间删掉一项 ⇒ 迟到的成功批不得复活它', async () => {
    const onChange = vi.fn()
    const held: AttachmentItem[] = [{ url: '/uploads/keep', name: 'keep.pdf', type: 'application/pdf', size: 8 }]
    const { container, rerender } = render(<AttachmentsUpload value={held} onChange={onChange} />)
    const el = inputOf(container)

    act(() => pickFiles(el, [mkFile('late.pdf')]))
    // 父组件在上传期间把列表改成了"只剩一项"(删除动作已落到当前值)
    rerender(<AttachmentsUpload value={held.slice(0, 1)} onChange={onChange} />)
    await act(async () => inflight.get('late.pdf')?.(okResponse('late.pdf')))

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]![0] as AttachmentItem[]
    expect(next.map((i) => i.name)).toEqual(['keep.pdf', 'late.pdf'])
  })
})

describe('卸载后的迟到回调:不写 state(挂载位是第二个条件,不是唯一条件)', () => {
  it('unmount 之后回包 ⇒ onChange 一次都不被调用', async () => {
    const onChange = vi.fn()
    const { container, unmount } = render(<AttachmentsUpload value={[]} onChange={onChange} />)
    const el = inputOf(container)

    act(() => pickFiles(el, [mkFile('after-unmount.pdf')]))
    unmount()
    await act(async () => inflight.get('after-unmount.pdf')?.(okResponse('after-unmount.pdf')))

    expect(onChange).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
