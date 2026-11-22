// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * D166 useLinkPreview hook 测试(2026-09-30 立)。
 *
 * 覆盖(票面验收 ①②③ 的 hook 面):
 * - 三态映射:ok(标题/摘要)/ unavailable(404)/ undetermined(401、传输失败)区别化;
 * - 防双抓:同 URL 单实例只发一次探测请求(请求数 == 1,并发与 resolved 后都挡住);
 * - 超时面:传输层 timeoutMs 显式传入(后端 3s 探测时限由 api 侧测试断言);
 * - 不阻断发送:probeFromPaste 同步不抛、异步无 unhandled rejection,
 *   探测失败后发送动作照常执行。
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(),
}))

import { fetchApi } from '@/lib/api'
import {
  detectPastedUrl,
  useLinkPreview,
  LINK_PREVIEW_TRANSPORT_TIMEOUT_MS,
} from '@/hooks/use-link-preview'

afterEach(() => {
  vi.mocked(fetchApi).mockReset()
})

const okEnvelope = {
  success: true,
  data: { status: 'ok', url: 'https://example.com/', title: 'Example Domain', description: 'For use in examples.' },
} as const

function okFetch() {
  return vi.mocked(fetchApi).mockResolvedValue(okEnvelope as never)
}

describe('detectPastedUrl — 粘贴文本里的第一条 http(s) 链接', () => {
  it('普通链接原样返回', () => {
    expect(detectPastedUrl('看下 https://example.com/a?b=1 这个')).toBe('https://example.com/a?b=1')
  })

  it('剪掉尾随中英文标点', () => {
    expect(detectPastedUrl('https://example.com/a。')).toBe('https://example.com/a')
    expect(detectPastedUrl('(https://example.com/a)')).toBe('https://example.com/a')
  })

  it('无链接/非 http 协议 ⇒ null', () => {
    expect(detectPastedUrl('没有链接的一句话')).toBeNull()
    expect(detectPastedUrl('ftp://example.com/file')).toBeNull()
    expect(detectPastedUrl('')).toBeNull()
  })
})

describe('useLinkPreview 三态映射(票面验收 ①)', () => {
  it('正常链接:出标题 + 摘要(status=ok)', async () => {
    okFetch()
    const { result } = renderHook(() => useLinkPreview())
    act(() => {
      result.current.probeFromPaste('https://example.com/')
    })
    expect(result.current.preview?.status).toBe('loading')
    await waitFor(() => expect(result.current.preview?.status).toBe('ok'))
    expect(result.current.preview).toMatchObject({ title: 'Example Domain', description: 'For use in examples.' })
  })

  it('404 ⇒ unavailable,与 401 ⇒ undetermined 严格区别(把没判写成判过禁令)', async () => {
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({ success: true, data: { status: 'unavailable', url: 'u', reason: 'http_404' } } as never)
      .mockResolvedValueOnce({ success: true, data: { status: 'undetermined', url: 'p', reason: 'http_401' } } as never)
    const first = renderHook(() => useLinkPreview())
    act(() => {
      first.result.current.probeFromPaste('https://gone.example.com/x')
    })
    await waitFor(() => expect(first.result.current.preview?.status).toBe('unavailable'))
    expect(first.result.current.preview).toMatchObject({ reason: 'http_404' })

    const second = renderHook(() => useLinkPreview())
    act(() => {
      second.result.current.probeFromPaste('https://private.example.com/x')
    })
    await waitFor(() => expect(second.result.current.preview?.status).toBe('undetermined'))
    expect(second.result.current.preview).toMatchObject({ reason: 'http_401' })
  })

  it('传输失败 ⇒ 未判定(不是"读不到"),且 timeoutMs 显式传入', async () => {
    vi.mocked(fetchApi).mockRejectedValue(new Error('aborted'))
    const { result } = renderHook(() => useLinkPreview())
    act(() => {
      result.current.probeFromPaste('https://slow.example.com/')
    })
    await waitFor(() => expect(result.current.preview?.status).toBe('undetermined'))
    expect(result.current.preview).toMatchObject({ reason: 'probe_error' })
    // 传输层超时显式(后端探测 3s 由 api 侧测试断言)。
    expect(vi.mocked(fetchApi)).toHaveBeenCalledWith(
      expect.stringContaining('/api/url-preview/preview?url='),
      expect.objectContaining({ timeoutMs: LINK_PREVIEW_TRANSPORT_TIMEOUT_MS }),
    )
  })
})

describe('防双抓(票面铁律:预检不得变成抓取两次)', () => {
  it('同 URL 并发重复触发 ⇒ 请求数 == 1', async () => {
    okFetch()
    const { result } = renderHook(() => useLinkPreview())
    act(() => {
      result.current.probeFromPaste('https://example.com/')
      result.current.probeFromPaste('https://example.com/')
    })
    await waitFor(() => expect(result.current.preview?.status).toBe('ok'))
    expect(vi.mocked(fetchApi)).toHaveBeenCalledTimes(1)
  })

  it('resolved 后同 URL 再粘贴 ⇒ 仍然请求数 == 1(记账挡住)', async () => {
    okFetch()
    const { result } = renderHook(() => useLinkPreview())
    act(() => {
      result.current.probeFromPaste('https://example.com/')
    })
    await waitFor(() => expect(result.current.preview?.status).toBe('ok'))
    act(() => {
      result.current.probeFromPaste('https://example.com/')
    })
    expect(vi.mocked(fetchApi)).toHaveBeenCalledTimes(1)
  })

  it('不同 URL 各探测一次(记账按 URL 计,不误伤)', async () => {
    okFetch()
    const { result } = renderHook(() => useLinkPreview())
    act(() => {
      result.current.probeFromPaste('https://a.example.com/')
      result.current.probeFromPaste('https://b.example.com/')
    })
    await waitFor(() => expect(vi.mocked(fetchApi)).toHaveBeenCalledTimes(2))
  })

  it('无链接文本不触发任何请求', () => {
    okFetch()
    const { result } = renderHook(() => useLinkPreview())
    act(() => {
      result.current.probeFromPaste('纯文本,没有链接')
    })
    expect(vi.mocked(fetchApi)).not.toHaveBeenCalled()
    expect(result.current.preview).toBeNull()
  })
})

describe('不阻断发送(票面显式断言)', () => {
  it('fetchApi 同步抛 ⇒ probeFromPaste 不向调用方抛,状态落到未判定', async () => {
    vi.mocked(fetchApi).mockImplementation(() => {
      throw new Error('sync boom')
    })
    const { result } = renderHook(() => useLinkPreview())
    expect(() =>
      act(() => {
        result.current.probeFromPaste('https://boom.example.com/')
      }),
    ).not.toThrow()
    await waitFor(() => expect(result.current.preview?.status).toBe('undetermined'))
  })

  it('探测失败(异步 reject)后,发送动作照常可执行且被调用', async () => {
    vi.mocked(fetchApi).mockRejectedValue(new Error('network down'))
    const send = vi.fn()
    const { result } = renderHook(() => useLinkPreview())
    act(() => {
      result.current.probeFromPaste('https://fail.example.com/')
    })
    await waitFor(() => expect(result.current.preview?.status).toBe('undetermined'))
    // 用户无视预览失败,照常发送 —— 发送路径不读预览态,预览失败不阻止发送。
    await act(async () => {
      send('https://fail.example.com/')
    })
    expect(send).toHaveBeenCalledTimes(1)
    // 且未产生 unhandled rejection(preview 稳定落在 undetermined 即探测链路已收口)。
    expect(result.current.preview).toMatchObject({ status: 'undetermined', url: 'https://fail.example.com/' })
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
