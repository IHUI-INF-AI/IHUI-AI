// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type * as ApiClientModule from '@ihui/api-client'
import { useCustomNav } from '../use-custom-nav'

/**
 * 自定义栏数据层 —— 2026-10-17 修的四个洞的回归(只钉新逻辑,不动既有语义):
 *
 *  ① 去重:同一 href 出现两次会同时产生重复 React key 和重复 dnd-kit sortable id
 *     (sortable id 就是 href),重复 id 下拖拽行为未定义。服务端只在 PUT 侧去重,
 *     GET/本地都可能带回重复 ⇒ 客户端必须兜住。
 *  ② 允许集放宽:admin 的后台路由是运行时合并进侧边栏的,不在静态 ALL_NAV_HREFS 里。
 *     不把它们并进允许集 ⇒ 用户收藏的动态项刷新后就被当失效项剔除("加了就没了")。
 *  ③ 同步失败退避重试:旧实现失败即 return,而同步 effect 依赖 [userId, hydrated]
 *     ⇒ 同一次挂载内永不再跑 ⇒ 登录瞬间网络抖一下,整会话远端通路关死(上推还被
 *     "同步未完成"闸门挡着)⇒ 跨设备同步静默失效。
 *  ④ 上推失败复位基线:服务端有 50 项上限;写失败而基线已推进 ⇒ 之后所有变更都判
 *     "与基线相同"⇒ 静默全丢、再也不重试。
 *  ⑤ 换号重置基线:B 账号归并后的串若恰好等于 A 账号留下的基线,上推判等直接 return
 *     ⇒ B 的收藏永远上不了云。
 *
 * 假服务端可控:GET 失败 / PUT 失败分别可摆布,并记录每次写入。
 */

const authState = vi.hoisted(() => ({ user: null as { id: string } | null }))

const server = vi.hoisted(() => ({
  exists: false,
  hrefs: [] as string[],
  getFail: false,
  putFail: false,
  writes: [] as string[][],
  /** 所有上推尝试(含失败)—— 失败也要留痕,否则"推了但被拒"无从断言 */
  putAttempts: [] as string[][],
  getCalls: 0,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) => selector(authState),
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>()
  return {
    ...actual,
    getSidebarNavPreference: async () => {
      server.getCalls += 1
      if (server.getFail) return { success: false, error: { code: 500, message: 'boom' } }
      return { success: true, data: { hrefs: server.hrefs, exists: server.exists } }
    },
    updateSidebarNavPreference: async (hrefs: string[]) => {
      server.putAttempts.push(hrefs)
      if (server.putFail) return { success: false, error: { code: 400, message: 'too many' } }
      server.writes.push(hrefs)
      server.hrefs = hrefs
      server.exists = true
      return { success: true, data: { hrefs, exists: true } }
    },
  }
})

const STORAGE_PREFIX = 'sidebar-custom-nav-'

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function login(id: string | null) {
  authState.user = id === null ? null : { id }
}

beforeEach(async () => {
  await flush()
  window.localStorage.clear()
  login(null)
  server.exists = false
  server.hrefs = []
  server.getFail = false
  server.putFail = false
  server.writes = []
  server.putAttempts = []
  server.getCalls = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCustomNav —— 允许集与去重', () => {
  it('本地存储里的重复 href 只保留一个(防重复 key / 重复 sortable id)', () => {
    const hrefs = ['/models', '/models', '/agents']
    window.localStorage.setItem(STORAGE_PREFIX + 'u1', JSON.stringify(hrefs))
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    expect(result.current.customHrefs).toEqual(['/models', '/agents'])
  })

  it('运行时才出现的 href(admin 动态路由)在传入允许集后不再被当失效项剔除', async () => {
    // 静态表里没有 /admin/dynamic-x:不传允许集时它被剔除(既有语义不变)
    window.localStorage.setItem(STORAGE_PREFIX + 'u2', JSON.stringify(['/admin/dynamic-x']))
    login('u2')
    const strict = renderHook(() => useCustomNav())
    expect(strict.result.current.customHrefs).toEqual([])

    // 传入"当前可见项"后,动态项被保留 —— 这就是刷新后不丢的关键
    // (载入发生在 effect 里,必须先 flush 再断言:首帧 state 还是 [])
    // 注意:上面那个 strict hook 仍挂载着,它的持久化 effect 已把 localStorage 写成 [],
    // 所以这里必须重写一次,否则读到的就是被它清空的副本。
    window.localStorage.setItem(STORAGE_PREFIX + 'u2', JSON.stringify(['/admin/dynamic-x']))
    const allowed = new Set(['/admin/dynamic-x'])
    const lenient = renderHook(() => useCustomNav(allowed))
    await flush()
    expect(lenient.result.current.customHrefs).toEqual(['/admin/dynamic-x'])

    // 顺带钉死:调用方每次渲染都新建集合也不许死循环(依赖是内容签名不是引用)
    const churn = renderHook(() => useCustomNav(new Set(['/admin/dynamic-x'])))
    await flush()
    await act(async () => {
      churn.rerender()
      churn.rerender()
    })
    expect(churn.result.current.customHrefs).toEqual(['/admin/dynamic-x'])
  })
})

describe('useCustomNav —— 同步失败退避重试', () => {
  it('GET 失败后会退避再试(不是一次失败就把远端通路关死)', async () => {
    vi.useFakeTimers()
    server.getFail = true
    login('u3')
    renderHook(() => useCustomNav())
    await flush()
    const first = server.getCalls
    expect(first).toBeGreaterThanOrEqual(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5001)
    })
    expect(server.getCalls).toBeGreaterThan(first)

    // 恢复后重试成功 ⇒ 标记同步完成
    server.getFail = false
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15001)
    })
    await flush()
    expect(server.getCalls).toBeGreaterThan(first + 1)
  })
})

describe('useCustomNav —— 上推基线与换号', () => {
  it('PUT 失败后复位基线:下一次变更仍会重试(不是静默全丢)', async () => {
    login('u4')
    server.exists = true
    server.hrefs = ['/models']
    const { result } = renderHook(() => useCustomNav())
    await flush() // 同步完成并立基线

    server.putFail = true
    await act(async () => {
      result.current.addHref('/agents')
    })
    await flush()
    expect(server.putAttempts).toHaveLength(1) // 这次写了但被拒
    expect(server.writes).toHaveLength(0)

    // 基线已复位 ⇒ 再改一次还会推(若基线没复位,这里会停在 1 次尝试:静默全丢)
    server.putFail = false
    await act(async () => {
      result.current.addHref('/publish/history')
    })
    await flush()
    expect(server.putAttempts.length).toBeGreaterThanOrEqual(2)
    expect(server.writes.length).toBeGreaterThanOrEqual(1)
  })

  it('换账号后基线重置:B 账号与 A 基线同串也照样上推', async () => {
    // A:同步 + 写一次,基线 = ["/models"]
    login('A')
    server.exists = true
    server.hrefs = ['/models']
    const a = renderHook(() => useCustomNav())
    await flush()
    await act(async () => {
      a.result.current.addHref('/agents')
    })
    await flush()

    // B:本地也是 ["/models"],若基线被 A 残留污染则会判等 return、一条都不推
    window.localStorage.setItem(STORAGE_PREFIX + 'B', JSON.stringify(['/models']))
    login('B')
    server.exists = false
    server.hrefs = []
    server.writes = []
    const b = renderHook(() => useCustomNav())
    await flush()
    expect(b.result.current.customHrefs).toEqual(['/models'])
    // 远端从未设置过 ⇒ 本地要被推上去(老用户上云路径)
    expect(server.writes.some((w) => w.includes('/models'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
