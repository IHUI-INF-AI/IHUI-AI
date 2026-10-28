// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面偏好跨设备漫游客户端的行为契约(2026-09-28,G-301)。
 *
 * 钉的是四类"看起来对、其实错"的形态:
 *  - 把**读不到**当成**用户关掉了同步**(那会让下一次保存顺手把账号侧写成关闭);
 *  - 把账号里的**脏 payload** 当合法偏好套进宿主(表现是"换设备后设置莫名变默认");
 *  - 套用远端值之后立刻把它当"本地新改动"推回去(回环);
 *  - 未登录时照样发请求(拿 401 当数据)。
 * 每条都有正反两侧:失败态那一侧不许只是"没成功",必须留下看得见的返回值给 UI。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const fetchApiMock = vi.fn()

vi.mock('@/lib/api', () => ({
  fetchApi: (...args: unknown[]) => fetchApiMock(...args),
}))

import { fetchRoamingPrefs, useDesktopPrefsSync } from '@/lib/desktop-prefs-sync'
import { defaultDesktopPrefs } from '@/lib/desktop-prefs-bridge'

const P = { ...defaultDesktopPrefs(), closeBehavior: 'quit' as const }
/** fetchApi 的真返回值是 ApiResult 判别联合 —— 桩必须照这个形状给,给裸 data 等于让判据空转。 */
const ok = (data: unknown) => ({ success: true as const, data })
const bad = (error: string) => ({ success: false as const, error })

describe('fetchRoamingPrefs 的三态', () => {
  beforeEach(() => fetchApiMock.mockReset())

  it('网络/后端失败 ⇒ unknown,不是 off', async () => {
    fetchApiMock.mockRejectedValueOnce(new Error('offline'))
    expect(await fetchRoamingPrefs()).toEqual({ state: 'unknown', prefs: null })
  })

  it('enabled:false ⇒ off 且不解析 prefs', async () => {
    fetchApiMock.mockResolvedValueOnce(ok({ enabled: false, prefs: null }))
    expect(await fetchRoamingPrefs()).toEqual({ state: 'off', prefs: null })
  })

  it('账号里是脏 payload ⇒ unknown(绝不回退成默认档去套宿主)', async () => {
    fetchApiMock.mockResolvedValueOnce(ok({ enabled: true, prefs: { closeBehavior: 'yolo' } }))
    const r = await fetchRoamingPrefs()
    expect(r.state).toBe('unknown')
    expect(r.prefs).toBeNull()
  })

  it('合法且开启 ⇒ on + 归一后的值', async () => {
    fetchApiMock.mockResolvedValueOnce(ok({ enabled: true, prefs: P }))
    const r = await fetchRoamingPrefs()
    expect(r.state).toBe('on')
    expect(r.prefs?.closeBehavior).toBe('quit')
  })
})

describe('useDesktopPrefsSync', () => {
  beforeEach(() => fetchApiMock.mockReset())

  it('未登录 / 非宿主 ⇒ 整条链一次请求都不发', async () => {
    const applyRemote = vi.fn()
    const { result } = renderHook(() =>
      useDesktopPrefsSync({ prefs: P, available: false, authenticated: false, applyRemote }),
    )
    await waitFor(() => expect(result.current.state).toBe('off'))
    expect(fetchApiMock).not.toHaveBeenCalled()
    expect(applyRemote).not.toHaveBeenCalled()
  })

  it('登录后拉到 on ⇒ 经 applyRemote 写回宿主,且不会立刻把自己推回去(回环防线)', async () => {
    fetchApiMock.mockResolvedValueOnce(ok({ enabled: true, prefs: P }))
    const applyRemote = vi.fn().mockResolvedValue(P)
    const { rerender } = renderHook(
      ({ prefs }) =>
        useDesktopPrefsSync({ prefs, available: true, authenticated: true, applyRemote }),
      { initialProps: { prefs: null as ReturnType<typeof defaultDesktopPrefs> | null } },
    )
    rerender({ prefs: P })
    await waitFor(() => expect(applyRemote).toHaveBeenCalledTimes(1))
    // 指纹已对齐:同一份内容不再推(唯一一次 fetch 是那次 GET)
    await waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(1))
    expect(fetchApiMock.mock.calls[0][1]).toBeUndefined()
  })

  it('开关拨到 on ⇒ PUT 带整份 prefs;失败返回 false 且状态不变(不静默假装成功)', async () => {
    fetchApiMock.mockResolvedValueOnce(ok({ enabled: false, prefs: null }))
    fetchApiMock.mockResolvedValueOnce(bad('boom'))
    const applyRemote = vi.fn()
    const { result } = renderHook(() =>
      useDesktopPrefsSync({ prefs: P, available: true, authenticated: true, applyRemote }),
    )
    await waitFor(() => expect(result.current.state).toBe('off'))
    let done: boolean | undefined
    await act(async () => {
      done = await result.current.setEnabled(true)
    })
    expect(done).toBe(false)
    expect(result.current.state).toBe('off')
    expect(result.current.lastWriteFailed).toBe(true)
    const put = fetchApiMock.mock.calls.find((c) => typeof c[1] === 'object')
    expect(put?.[0]).toBe('/desktop/prefs')
    expect(JSON.parse((put?.[1] as { body: string }).body)).toEqual({ enabled: true, prefs: P })
  })

  it('拨到 off ⇒ PUT enabled:false,此后本机改动不再推给账号', async () => {
    fetchApiMock.mockResolvedValueOnce(ok({ enabled: true, prefs: P }))
    // GET 之后的所有调用(含那次 PUT)都回"已关闭",否则会误判成写失败
    fetchApiMock.mockResolvedValue(ok({ enabled: false, prefs: null }))
    const applyRemote = vi.fn().mockResolvedValue(P)
    const { result } = renderHook(() =>
      useDesktopPrefsSync({ prefs: P, available: true, authenticated: true, applyRemote }),
    )
    await waitFor(() => expect(result.current.state).toBe('on'))
    await act(async () => {
      expect(await result.current.setEnabled(false)).toBe(true)
    })
    const offBody = fetchApiMock.mock.calls
      .filter((c) => typeof c[1] === 'object')
      .map((c) => JSON.parse((c[1] as { body: string }).body))
    expect(offBody.some((b) => b.enabled === false)).toBe(true)
    expect(result.current.state).toBe('off')
    const before = fetchApiMock.mock.calls.length
    await new Promise((r) => setTimeout(r, 30))
    // 关掉之后推的通道必须断掉:否则一次本地改动就把账号侧又写回 on
    expect(fetchApiMock.mock.calls.length).toBe(before)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
