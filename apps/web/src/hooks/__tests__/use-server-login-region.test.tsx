// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

/**
 * useServerLoginRegion 的四档答复 + 一条"不许多打一次 GET"的钉子。
 *
 * 立因(2026-10-27 缺口审计现读):登录窗的地区判据靠这条 hook 把服务器按来源 IP 判的
 * loginRegion 送进 planLoginRegion,而它当时**零单测** —— 判据侧(ui-react 20 例)与
 * 产出侧(api 16 例)都有锁,唯独中间这一根接线没人管:它一旦把"未判定"读成某一侧、
 * 或者把脏值当真值,两端全绿而界面上排法错。
 *
 * 桩只 mock 网络出口 `@/lib/api` 与 toast,判据一律 import 被测模块本身(§22c:
 * 禁止在测试里复制一份判据)。
 */

const statusRef = { current: null as Record<string, unknown> | null | 'FAIL' }
const fetchCalls: string[] = []

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async (url: string) => {
    fetchCalls.push(url)
    if (!url.includes('oauth-status')) return { success: true, data: [] }
    if (statusRef.current === 'FAIL') return { success: false, status: 500, error: 'boom' }
    return { success: true, data: statusRef.current }
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: { error: vi.fn(), success: vi.fn() } }),
}))

const mod = await import('@/hooks/use-third-party-auth')
const { useServerLoginRegion } = mod

async function renderWith(status: Record<string, unknown> | null | 'FAIL') {
  statusRef.current = status
  const view = renderHook(() => useServerLoginRegion())
  await waitFor(() => expect(view.result.current !== undefined).toBe(true))
  return view
}

beforeEach(() => {
  // 这条缓存是模块级"只取一次",不清掉就没法在同一进程里逐档验服务器的不同答复。
  // 调用计数也在这里复位 —— 不能放进 renderWith:那样同一用例内的第二次消费
  // 会被清零后计数,"缓存命中"就读成"一次都没发",断言证的是夹具而不是行为。
  mod.__test__.resetOAuthStatusCache()
  fetchCalls.length = 0
  cleanup()
})

describe('useServerLoginRegion', () => {
  it('服务器判 domestic ⇒ 交回 domestic', async () => {
    const view = await renderWith({ loginRegion: 'domestic' })
    await waitFor(() => expect(view.result.current).toBe('domestic'))
  })

  it('服务器判 overseas ⇒ 交回 overseas(压过界面语言)', async () => {
    const view = await renderWith({ loginRegion: 'overseas' })
    await waitFor(() => expect(view.result.current).toBe('overseas'))
  })

  it('服务器显式回 null(判不出)⇒ 交回 null,不猜成国内或海外', async () => {
    const view = await renderWith({ loginRegion: null })
    await waitFor(() => expect(view.result.current).toBeNull())
  })

  it('缺键 / 脏值 一律按未判定:第三种值、国名、大小写变体都不当真值', async () => {
    for (const bad of [
      {},
      { loginRegion: 'CN' },
      { loginRegion: 'CHINA' },
      { loginRegion: 'Domestic' },
      { loginRegion: '' },
    ]) {
      mod.__test__.resetOAuthStatusCache()
      const view = await renderWith(bad)
      await waitFor(() => expect(view.result.current).toBeNull())
    }
  })

  it('取不到(端点挂 / 网络失败)⇒ null,不得把没判读成判过了', async () => {
    const view = await renderWith('FAIL')
    await waitFor(() => expect(view.result.current).toBeNull())
  })

  it('反向断言:同一进程内多个消费者只打一次 oauth-status', async () => {
    const a = await renderWith({ loginRegion: 'domestic' })
    await waitFor(() => expect(a.result.current).toBe('domestic'))
    const statusUrlHits = () => fetchCalls.filter((u) => u.includes('oauth-status')).length
    expect(statusUrlHits()).toBe(1)

    // 第二处取数必须复用那条模块级缓存,而不是自立一次 GET:
    // 两处各 fetch 会拿到不同时刻的答复(该端点已显式 no-store,每次都是真回源)。
    const b = await renderWith({ loginRegion: 'domestic' })
    await waitFor(() => expect(b.result.current).toBe('domestic'))
    expect(statusUrlHits(), '第二次消费不得再发一次 GET').toBe(1)
  })
})
