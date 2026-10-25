// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type * as ApiClientModule from '@ihui/api-client'
import { useCustomNav } from '../use-custom-nav'
import { ALL_NAV_HREFS } from '../nav-data'

/**
 * 「自定义」栏数据层回归(2026-10-16 立,同日补同步/排序)
 *
 * 钉住容易在后续迭代中被悄悄改坏的事:
 *  ① 按用户 id 隔离 —— 换账号不串号,各自读写各自的 key
 *  ② 载入时只清洗形状 —— 数据层不判"这项还有效吗"(可见集是异步攒出来的,判了就是
 *     静默删用户数据);不在表里的 href 留在列表里,由视图层决定渲不渲染
 *  ③ addHref 幂等 / removeHref 精确移除 / reorderHref 按 href 搬移 / isCustom 与列表一致
 *  ④ 未登录不写 localStorage —— 不给游客残留任何自定义数据
 *  ⑤ 服务端同步归并规则 —— 远端 exists=true 时以远端为准;exists=false 时把本地推上去;
 *     同步刚完成的那一帧不推(否则"以远端为准"会被自己写回去)
 *  ⑥ 网络失败静默降级 —— 接口报错不影响本地可用性
 *
 * 只 mock auth store 与 api-client(把服务端变成可控的假实现),
 * nav-data / localStorage 全用真的 —— 判据不复制,测的是真实现。
 */

const authState = vi.hoisted(() => ({ user: null as { id: string } | null }))

/** 假服务端:exists/hrefs 可被每个用例摆布,并记录所有写入便于断言"推了什么" */
const server = vi.hoisted(() => ({
  exists: false,
  hrefs: [] as string[],
  fail: false,
  writes: [] as string[][],
  result: undefined as { success: boolean; data: { hrefs: string[]; exists: boolean } } | undefined,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) => selector(authState),
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  // 部分 mock:api-client 是全仓共用模块,直接整体替换会让 src/lib/api.ts 的
  // setTokenProvider 等导出凭空消失(测试会以"模块坏了"的形式炸,而不是断言失败)。
  // 只覆盖本 hook 真正依赖的那两个函数,其余原样透传。
  const actual = await importOriginal<typeof ApiClientModule>()
  return {
    ...actual,
    getSidebarNavPreference: async () => {
      if (server.fail) return { success: false, error: { code: 500, message: 'boom' } }
      return { success: true, data: { hrefs: server.hrefs, exists: server.exists } }
    },
    updateSidebarNavPreference: async (hrefs: string[]) => {
      if (server.fail) return { success: false, error: { code: 500, message: 'boom' } }
      server.writes.push(hrefs)
      server.hrefs = hrefs
      server.exists = true
      return { success: true, data: { hrefs, exists: true } }
    },
  }
})

function login(id: string | null) {
  authState.user = id === null ? null : { id }
}

const STORAGE_PREFIX = 'sidebar-custom-nav-'

/** 等同步 effect 跑完一轮(renderHook 的 effect 是异步的) */
async function flushSync() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(async () => {
  // 先把上一轮遗留的异步 effect 推完,再重置共享状态。
  // 不这么做的话:上一个用例的 sync/上推 promise 可能在本用例 beforeEach 重置**之后**
  // 才落地,把上一用例的数据越境写进假服务端,下一个用例读到脏数据
  // (实测形态:上一个用例的 '/' 出现在本用例的断言里)。
  await flushSync()
  window.localStorage.clear()
  login(null)
  server.exists = false
  server.hrefs = []
  server.fail = false
  server.writes = []
})


describe('useCustomNav', () => {
  it('未登录:列表为空、已水合、且不写 localStorage', () => {
    const { result } = renderHook(() => useCustomNav())
    expect(result.current.userId).toBeNull()
    expect(result.current.hydrated).toBe(true)
    expect(result.current.customHrefs).toEqual([])
    expect(window.localStorage.length).toBe(0)
  })

  it('载入时不删"表里没有"的 href:数据层只清洗形状(非字符串/重复)', () => {
    // 死链由视图层挡(可见项表查不到就不出链接),不由删数据挡 —— 见 use-custom-nav.ts 文件头。
    const valid = ALL_NAV_HREFS[0]
    window.localStorage.setItem(
      `${STORAGE_PREFIX}u1`,
      JSON.stringify([valid, '/route-deleted-last-week', '/also-gone', valid]),
    )
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    expect(result.current.customHrefs).toEqual([valid, '/route-deleted-last-week', '/also-gone'])
  })

  it('按用户 id 隔离:两个账号互不看到对方的收藏', () => {
    login('u1')
    const first = renderHook(() => useCustomNav())
    act(() => first.result.current.addHref('/models'))
    expect(first.result.current.customHrefs).toEqual(['/models'])
    first.unmount()

    login('u2')
    const second = renderHook(() => useCustomNav())
    expect(second.result.current.customHrefs).toEqual([])
    act(() => second.result.current.addHref('/agents'))
    expect(second.result.current.customHrefs).toEqual(['/agents'])
    second.unmount()

    // 回到 u1:自己的收藏仍在,没被 u2 污染
    login('u1')
    const third = renderHook(() => useCustomNav())
    expect(third.result.current.customHrefs).toEqual(['/models'])
    third.unmount()
  })

  it('addHref 幂等;removeHref 精确移除;isCustom 与列表一致', () => {
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    act(() => result.current.addHref('/models'))
    act(() => result.current.addHref('/models'))
    expect(result.current.customHrefs).toEqual(['/models'])

    act(() => result.current.addHref('/agents'))
    act(() => result.current.removeHref('/models'))
    expect(result.current.customHrefs).toEqual(['/agents'])
    expect(result.current.isCustom('/models')).toBe(false)
    expect(result.current.isCustom('/agents')).toBe(true)
  })

  it('挂载期间切换账号:重新载入对应用户的收藏(不串号)', () => {
    login('u1')
    const { result, rerender } = renderHook(() => useCustomNav())
    act(() => result.current.addHref('/models'))

    login('u2')
    act(() => rerender())
    expect(result.current.customHrefs).toEqual([])

    act(() => result.current.addHref('/voices'))
    expect(result.current.customHrefs).toEqual(['/voices'])
  })

  it('localStorage 不可用时静默降级为内存态(不抛错)', () => {
    login('u1')
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => useCustomNav())
    act(() => result.current.addHref('/models'))
    expect(result.current.customHrefs).toEqual(['/models'])
    spy.mockRestore()
  })

  it('reorderHref 按 href 搬移;原地不动/目标不在列表 ⇒ 引用不变', () => {
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    act(() => result.current.addHref('/models'))
    act(() => result.current.addHref('/agents'))
    act(() => result.current.addHref('/voices'))
    expect(result.current.customHrefs).toEqual(['/models', '/agents', '/voices'])

    // 首项搬到末项所在的位置
    act(() => result.current.reorderHref('/models', '/voices'))
    expect(result.current.customHrefs).toEqual(['/agents', '/voices', '/models'])

    // 原地不动:引用必须不变,否则会白触发远端写
    const before = result.current.customHrefs
    act(() => result.current.reorderHref('/agents', '/agents'))
    expect(result.current.customHrefs).toBe(before)

    // 目标不在列表里(拖到了不认识的槽位):同样不动
    act(() => result.current.reorderHref('/models', '/not-in-list'))
    expect(result.current.customHrefs).toBe(before)
  })

  it('列表里夹着"此刻不可见"的收藏项时,拖拽仍搬对东西(按 href 不按行下标)', () => {
    // 立因(2026-10-25):数据层不再删它判不准的 href ⇒ 数组里可以夹着渲染不出来的项
    // (后台路由没加载出来 / 该角色现在看不到它)。行下标与数组下标从此不同形,
    // 按下标搬会把隐藏项搬到别的槽位 —— 表现是"拖了没反应"或"拖了顺序乱"。
    window.localStorage.setItem(
      `${STORAGE_PREFIX}u1`,
      JSON.stringify(['/models', '/hidden-route', '/agents']),
    )
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    expect(result.current.customHrefs).toEqual(['/models', '/hidden-route', '/agents'])

    // 用户把可见的第一行 /models 拖到可见的第二行 /agents 上(隐藏项在它们中间)
    act(() => result.current.reorderHref('/models', '/agents'))
    // 隐藏项留在原位,可见序变成 [agents, models]
    expect(result.current.customHrefs).toEqual(['/hidden-route', '/agents', '/models'])
  })

  it('服务端同步:远端已设置(exists=true)⇒ 以远端为准,本地差异被丢弃', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}u1`, JSON.stringify(['/models', '/agents']))
    server.exists = true
    server.hrefs = ['/voices', '/web-tools']
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    await flushSync()
    expect(result.current.customHrefs).toEqual(['/voices', '/web-tools'])
    // 以远端为准 ⇒ 不该把本地那两条推上去
    expect(server.writes).toEqual([])
  })

  it('服务端同步:远端从未设置(exists=false)⇒ 本地推上去(老用户升级不丢数据)', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}u1`, JSON.stringify(['/models']))
    server.exists = false
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    await flushSync()
    expect(result.current.customHrefs).toEqual(['/models'])
    expect(server.writes).toEqual([['/models']])
  })

  it('服务端同步:远端 exists=true 但为空 ⇒ 尊重"已清空",不被本地旧数据复活', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}u1`, JSON.stringify(['/models']))
    server.exists = true
    server.hrefs = []
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    await flushSync()
    expect(result.current.customHrefs).toEqual([])
    expect(server.writes).toEqual([])
  })

  it('服务端同步:同步完成后用户新增 ⇒ 变更上推;且首次同步那一帧不推', async () => {
    server.exists = true
    server.hrefs = ['/models']
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    await flushSync()
    expect(result.current.customHrefs).toEqual(['/models'])
    expect(server.writes).toEqual([]) // 同步那一帧不推

    act(() => result.current.addHref('/agents'))
    await flushSync()
    expect(server.writes).toEqual([['/models', '/agents']])
  })

  it('服务端同步:接口失败 ⇒ 保持本地可用,不写远端、下次挂载重试', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}u1`, JSON.stringify(['/models']))
    server.fail = true
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    await flushSync()
    // 本地照常可用
    expect(result.current.customHrefs).toEqual(['/models'])
    expect(server.writes).toEqual([])
    // 失败不标记已同步 ⇒ 用户在失败期间的新增会被缓推(此处只断言不崩、本地正确)
    act(() => result.current.addHref('/agents'))
    expect(result.current.customHrefs).toEqual(['/models', '/agents'])
  })

  it('服务端同步:远端含"此刻不认识"的 href ⇒ 原样保留,不拿它当失效项删', async () => {
    server.exists = true
    server.hrefs = ['/models', '/route-deleted', '/agents']
    login('u1')
    const { result } = renderHook(() => useCustomNav())
    await flushSync()
    expect(result.current.customHrefs).toEqual(['/models', '/route-deleted', '/agents'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
