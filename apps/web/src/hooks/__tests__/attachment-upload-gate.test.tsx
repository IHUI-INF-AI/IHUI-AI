// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ATTACHMENT_RETRY_QUOTA,
  canSendReferences,
  useMessageReferences,
  type ReferenceItem,
} from '@/hooks/use-message-references'

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async () => ({ success: false, error: 'mock-offline' })),
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

function mkFile(name = 'a.png', type = 'image/png'): File {
  return new File([new Uint8Array(16)], name, { type })
}

describe('canSendReferences 纯判据(b75-5#1)', () => {
  it('uploading 中阻发(blockingReason=uploading)', () => {
    expect(canSendReferences([{ id: '1', type: 'image', label: 'a', uploadState: 'uploading' }]))
      .toMatchObject({ canSend: false, blockingReason: 'uploading' })
  })

  it('error 态阻发(blockingReason=error)', () => {
    expect(canSendReferences([{ id: '1', type: 'image', label: 'a', uploadState: 'error' }]))
      .toMatchObject({ canSend: false, blockingReason: 'error' })
  })

  it('terminal(超配额)阻发', () => {
    expect(canSendReferences([{ id: '1', type: 'image', label: 'a', uploadState: 'terminal' }]))
      .toMatchObject({ canSend: false, blockingReason: 'error' })
  })

  it('ready 放行', () => {
    expect(canSendReferences([{ id: '1', type: 'image', label: 'a', uploadState: 'ready' }]))
      .toMatchObject({ canSend: true, blockingReason: null })
  })

  it('无 uploadState 的引用(文本/agent 参考块)放行', () => {
    expect(canSendReferences([{ id: '1', type: 'text', label: 'a' }])).toMatchObject({
      canSend: true,
      blockingReason: null,
    })
  })

  it('混合:一个 uploading + 一个 ready ⇒ 阻发', () => {
    const refs: ReferenceItem[] = [
      { id: '1', type: 'image', label: 'a', uploadState: 'ready' },
      { id: '2', type: 'image', label: 'b', uploadState: 'uploading' },
    ]
    expect(canSendReferences(refs).canSend).toBe(false)
  })
})

describe('retryReference 配额(b75-5#1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock/x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  const flush = async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
  }

  it('error 态重试 → 切回 uploading + retryCount+1', async () => {
    const { result } = renderHook(() => useMessageReferences())
    act(() => result.current.commitFileReference(mkFile()))
    await flush()
    const ref = result.current.references[0]
    expect(ref?.uploadState).toBe('error')
    act(() => result.current.retryReference(ref!.id))
    const after = result.current.references[0]
    expect(after?.uploadState).toBe('uploading')
    expect(after?.retryCount).toBe(1)
  })

  it('超配额(>=5)重试 → 置 terminal 终态,不再上传', async () => {
    const { result } = renderHook(() => useMessageReferences())
    act(() => result.current.commitFileReference(mkFile()))
    await flush()
    const ref = result.current.references[0]!
    // 逐轮重试:每轮 retry 后等上传失败回到 error,才能再 retry( uploading 态不可重入)
    // 配额 5 次:前 5 次 retry 后 retryCount 累加到 5,第 6 次触发 terminal
    for (let i = 0; i <= ATTACHMENT_RETRY_QUOTA; i++) {
      act(() => result.current.retryReference(ref.id))
      await flush()
    }
    const after = result.current.references[0]
    expect(after?.uploadState).toBe('terminal')
  })
})

