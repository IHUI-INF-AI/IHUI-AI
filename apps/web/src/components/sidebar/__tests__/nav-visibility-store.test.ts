// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇 AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as ApiClientModule from '@ihui/api-client'
import { useNavVisibilityStore, ALL_NAV_TIERS } from '@/stores/nav-visibility'

/**
 * 简洁模式 store 的水合归并规则(2026-10-25 立)。
 *
 * 为什么单独测这个 store:它和侧边栏「自定义」栏是同一型判据(远端为准 + 本地做首帧),
 * 而它同样有一条"GET 在飞期间用户已经动过"的窗口 —— 侧栏先按本地态渲染出来了,
 * 设置页的开关当场就可拨。
 *
 * 假服务端可控:GET 可挂起,releaseGet 由测试决定何时返回;PUT 逐次留痕。
 */

const server = vi.hoisted(() => ({
  remoteValue: null as string | null,
  hold: false,
  releaseGet: () => {},
  writes: [] as Record<string, string>[],
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>()
  return {
    ...actual,
    getPreferences: async () => {
      if (server.hold) {
        await new Promise<void>((resolve) => {
          server.releaseGet = resolve
        })
      }
      // 取值必须在 await 之后:挂起期间测试会把远端内容摆布成想要的样子
      return {
        success: true,
        data: { settings: server.remoteValue === null ? {} : { navTiers: server.remoteValue } },
      }
    },
    updatePreferences: async (settings: Record<string, string>) => {
      server.writes.push(settings)
      return { success: true, data: {} as never }
    },
  }
})

const PREF_KEY = 'navTiers'
const STORAGE_KEY = 'nav-tiers'

beforeEach(() => {
  window.localStorage.clear()
  server.remoteValue = JSON.stringify(['developer'])
  server.hold = false
  server.releaseGet = () => {}
  server.writes = []
  // store 是模块级单例:逐例复位,否则上一条用例的水合态会渗进下一条
  useNavVisibilityStore.setState({ hydrated: false, hiddenTiers: [] })
})

describe('useNavVisibilityStore.hydrate —— 远端为准', () => {
  it('对照:水合期间没人动开关 ⇒ 采用远端值(这条绿证明"不采用"不是因为判据失灵)', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
    await useNavVisibilityStore.getState().hydrate('u1')
    expect(useNavVisibilityStore.getState().hiddenTiers).toEqual(['developer'])
  })

  it('远端从未设置过该键时不覆盖本地(不给半个空偏好盖掉用户已存的态)', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['experimental']))
    server.remoteValue = null
    await useNavVisibilityStore.getState().hydrate('u1')
    expect(useNavVisibilityStore.getState().hiddenTiers).toEqual(['experimental'])
  })

  it('GET 在飞期间用户拨了开关 ⇒ 远端那帧已过期,不许把用户刚拨的弹回去', async () => {
    // 首帧本地:什么都不藏(用户此前就把四档都开着)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
    server.hold = true
    server.remoteValue = JSON.stringify(['developer'])

    const hydrating = useNavVisibilityStore.getState().hydrate('u1')
    // GET 已发出并挂起;此刻用户在设置页把「实验性」关掉
    useNavVisibilityStore.getState().setTier('experimental', true)
    expect(useNavVisibilityStore.getState().hiddenTiers).toEqual(['experimental'])
    // 那一下确实上了云(写路径不被"同步未完成"挡着)
    expect(server.writes.length).toBe(1)
    expect(JSON.parse(server.writes.at(0)?.[PREF_KEY] ?? '[]')).toEqual(['experimental'])

    server.hold = false
    server.releaseGet()
    await hydrating

    // 弹回 ['developer'] = 用户拨的开关在屏幕上消失(而云端已经是他的新值)⇒ 两本账背离
    expect(useNavVisibilityStore.getState().hiddenTiers).toEqual(['experimental'])
  })

  it('未登录只走本地,不打接口也不上推', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ALL_NAV_TIERS]))
    await useNavVisibilityStore.getState().hydrate(null)
    expect(useNavVisibilityStore.getState().hiddenTiers).toEqual([...ALL_NAV_TIERS])
    expect(server.writes).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
