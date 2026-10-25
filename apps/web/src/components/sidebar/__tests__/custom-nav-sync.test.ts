// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
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
  /** 置 true 则 GET 挂起,直到测试调用 releaseGet() —— 用来摆出"同步在飞期间用户动手"的窗口 */
  holdGet: false,
  releaseGet: () => {},
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
      if (server.holdGet) {
        await new Promise<void>((resolve) => {
          server.releaseGet = resolve
        })
      }
      // 取值必须在 await 之后:挂起期间测试会把远端内容和/或本地列表改掉
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
  server.holdGet = false
  server.releaseGet = () => {}
})

afterEach(() => {
  // 必须显式 cleanup:本仓 vitest 未开 globals: true,而 RTL 的 auto-cleanup 是靠探测
  // 全局 afterEach 才注册的 ⇒ 不生效 ⇒ renderHook 实例跨用例泄漏,旧实例的
  // window focus / storage 监听一直活着。本文件的用例断言"某条通路**没**被调用",
  // 一旦有旧实例在场就会翻红(实测 getCalls 从 0 变 14)。
  // 别删这行;要全局修得改 vitest config,那会波及全仓 400+ 测试文件的行为,属另一件事。
  cleanup()
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

  it('运行时才出现的 href(admin 动态路由)不在数据层的射程内 ⇒ 不得被当失效项剔除', async () => {
    // 2026-10-25:数据层不再有"允许集"这个东西。可见项集合是异步攒出来的,
    // 任何一刻的快照都不完整,拿它当删除依据就是静默删用户数据(见文件头用例组的立因)。
    window.localStorage.setItem(STORAGE_PREFIX + 'u2', JSON.stringify(['/admin/dynamic-x']))
    login('u2')
    const { result } = renderHook(() => useCustomNav())
    await flush()
    expect(result.current.customHrefs).toEqual(['/admin/dynamic-x'])
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
  it('新账号的第一项就要落账号(远端 exists=false 且本地为空 ⇒ 同步成功但零重渲染)', async () => {
    // 立因(2026-10-19 实测):exists=false + 本地为空这条路径同步成功后既不 setHrefs 也不上传,
    // ⇒ 不重渲染 ⇒ 上推 effect 不会再跑 ⇒ 基线留在 null。于是用户的第一次改动撞进
    // 「首次只立基线,不推」分支被静默吞掉,PUT 尝试 0 次,服务端永远是空的。
    // 表现为「每台设备都得重新设置」:只有再收藏第二项时才会连带把第一项推上去。
    login('fresh')
    const { result } = renderHook(() => useCustomNav())
    await flush()
    expect(server.getCalls).toBeGreaterThanOrEqual(1)

    await act(async () => {
      result.current.addHref('/models')
    })
    await flush()
    // 只加 1 项就必须已经上云(若基线仍留在 null,这里 putAttempts 会停在 0)
    expect(server.putAttempts).toHaveLength(1)
    expect(server.writes).toEqual([['/models']])

    // 正向对照:第二项照旧整表覆盖,且带上第一项(证明上的是完整列表而不是增量)
    await act(async () => {
      result.current.addHref('/agents')
    })
    await flush()
    expect(server.writes[server.writes.length - 1]).toEqual(['/models', '/agents'])
  })

  it('远端已有记录时首次添加照旧上推(修基线不许把已正常的那条路弄坏)', async () => {
    login('with-remote')
    server.exists = true
    server.hrefs = ['/models']
    const { result } = renderHook(() => useCustomNav())
    await flush()
    expect(result.current.customHrefs).toEqual(['/models'])
    expect(server.writes).toHaveLength(0) // 同步不该回声上传

    await act(async () => {
      result.current.addHref('/agents')
    })
    await flush()
    expect(server.writes).toEqual([['/models', '/agents']])
  })

  it('远端存在但为空数组时首次添加也照旧上推(exists=true 不等于"没设过")', async () => {
    login('remote-empty')
    server.exists = true
    server.hrefs = []
    const { result } = renderHook(() => useCustomNav())
    await flush()
    await act(async () => {
      result.current.addHref('/models')
    })
    await flush()
    expect(server.writes).toEqual([['/models']])
  })

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

/**
 * 跨设备实时同步(2026-10-19 立)。
 * 立因:此前只在挂载时拉一次,之后本页再也不问服务端 ⇒ A 设备改了、B 设备开着的
 * 标签页永远停在旧值,表现就是"同步没生效、每台设备各是一套"。
 *
 * 真核心风险只有一个:重拉会用远端**盖掉**本地。所以每个用例都在钉"什么时候可以盖"。
 */
describe('useCustomNav —— 跨设备实时同步(焦点/可见性重拉)', () => {
  async function focusAndSettle() {
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(301)
    })
    await flush()
  }

  it('窗口重新获得焦点时跟随远端新增(A 加项 → B 聚焦即见)', async () => {
    vi.useFakeTimers()
    login('dev-A')
    server.exists = true
    server.hrefs = ['/models']
    const { result } = renderHook(() => useCustomNav())
    await flush()
    expect(result.current.customHrefs).toEqual(['/models'])

    server.hrefs = ['/models', '/agents'] // A 设备那边加了 /agents
    await focusAndSettle()
    expect(result.current.customHrefs).toEqual(['/models', '/agents'])
  })

  it('页面从后台恢复可见同样触发跟随', async () => {
    vi.useFakeTimers()
    login('dev-B')
    server.exists = true
    server.hrefs = ['/models']
    const { result } = renderHook(() => useCustomNav())
    await flush()

    server.hrefs = ['/models', '/ecosystem']
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(301)
    })
    await flush()
    expect(result.current.customHrefs).toEqual(['/models', '/ecosystem'])
  })

  it('远端删除也跟着删(A 删项 → B 聚焦后不再复活)', async () => {
    vi.useFakeTimers()
    login('dev-C')
    server.exists = true
    server.hrefs = ['/models', '/agents']
    const { result } = renderHook(() => useCustomNav())
    await flush()
    expect(result.current.customHrefs).toEqual(['/models', '/agents'])

    server.hrefs = ['/models'] // A 删了 /agents
    await focusAndSettle()
    expect(result.current.customHrefs).toEqual(['/models'])
  })

  it('本机有未落库改动时不拉远端(防未落库的改动被覆盖丢失)', async () => {
    vi.useFakeTimers()
    login('dev-D')
    server.exists = true
    server.hrefs = ['/models']
    const { result } = renderHook(() => useCustomNav())
    await flush()

    // 本机改动后 PUT 被拒 ⇒ 基线停在 NEEDS_PUSH,本地有一项正待落库
    server.putFail = true
    await act(async () => {
      result.current.addHref('/agents')
    })
    await flush()
    expect(result.current.customHrefs).toEqual(['/models', '/agents'])

    // 远端此刻是旧值(只有 /models)。若照拉不误,本机待落库的 /agents 会被抹掉。
    server.getCalls = 0
    await focusAndSettle()
    expect(server.getCalls).toBe(0)
    expect(result.current.customHrefs).toEqual(['/models', '/agents'])
  })

  it('同步未完成时不拉(不给半截远端盖掉刚载入的本地)', async () => {
    vi.useFakeTimers()
    server.getFail = true
    login('dev-E')
    window.localStorage.setItem(STORAGE_PREFIX + 'dev-E', JSON.stringify(['/models']))
    const { result } = renderHook(() => useCustomNav())
    await flush() // 同步未完成(GET 一直失败)
    expect(result.current.customHrefs).toEqual(['/models'])

    const before = server.getCalls
    await focusAndSettle()
    expect(server.getCalls).toBe(before) // 重拉被"同步未完成"闸门挡下
    expect(result.current.customHrefs).toEqual(['/models'])
  })

  it('远端无变化时不写回(基线随重拉更新 ⇒ 不产生乒乓回写)', async () => {
    vi.useFakeTimers()
    login('dev-F')
    server.exists = true
    server.hrefs = ['/models']
    const { result } = renderHook(() => useCustomNav())
    await flush()

    server.writes = []
    server.putAttempts = []
    await focusAndSettle()
    await focusAndSettle()
    // 跟随远端后若基线没跟着换,上推 effect 会把"刚采用"的值当本机改动推回去
    expect(server.putAttempts).toHaveLength(0)
    expect(server.writes).toHaveLength(0)
    expect(result.current.customHrefs).toEqual(['/models'])
  })

  it('请求期间本机发生改动 ⇒ 丢弃这次过期结果(防 GET 慢于 PUT 时回退本机操作)', async () => {
    vi.useFakeTimers()
    login('dev-G')
    server.exists = true
    server.hrefs = ['/models']
    const { result } = renderHook(() => useCustomNav())
    await flush()

    server.hrefs = ['/models', '/agents'] // 远端有新项
    window.dispatchEvent(new Event('focus'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(301)
    })
    // GET 刚发出、本机此刻又改了一项(基线随之推进)
    await act(async () => {
      result.current.addHref('/publish/history')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    await flush()
    // 过期结果不得把本机刚加的 /publish/history 抹掉
    expect(result.current.customHrefs).toContain('/publish/history')
  })

  it('登出后不再跟随远端(结果属于别的用户,必须丢弃)', async () => {
    vi.useFakeTimers()
    login('dev-H')
    server.exists = true
    server.hrefs = ['/models']
    const { result } = renderHook(() => useCustomNav())
    await flush()

    server.hrefs = ['/models', '/agents']
    window.dispatchEvent(new Event('focus'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(301)
    })
    login(null)
    await act(async () => {
      result.current.removeHref('/models')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    await flush()
    expect(result.current.customHrefs).toEqual([])
  })
})

/**
 * 「此刻不认识的 href」不得被当失效项删除(2026-10-25 立;机主报"换新设备还要重新设置、
 * 各设备还不一致")。
 *
 * 立因:admin 的后台路由由 `useAdminRouters()` 每次挂载**异步**拉取(该 hook 刻意不做模块级
 * 缓存,防跨账号菜单泄漏),而 `/settings/sidebar-nav` 的 GET 是另一条独立请求 ⇒ 谁先回来
 * 不确定。GET 先回时,远端列表里的动态项还不在那一刻的可见集内 ⇒ 被当"失效项"剔除 ⇒
 * 持久化 effect 紧接着把剔完的短名单写回 localStorage ⇒ 动态路由随后到了也补不回来
 * (载入 effect 的"补回"读的就是那份已被覆盖的本地)。用户下一次改动还会把短名单整体
 * PUT 回服务端 ⇒ 云端跟着一起丢。
 *
 * 时序竞态 ⇒ 同一账号在不同设备/不同次刷新上结果不同,这正是"不一致"的来源。
 * 正解是把"有效性判定"从数据层删掉:数据层只清洗形状,可见性归视图层。
 */
describe('useCustomNav —— 云端收藏里"此刻不认识"的项不得被静默丢弃', () => {
  const DYNAMIC = '/admin/dynamic-x'

  it('GET 先回、后台路由后到:动态项必须原样留在列表里,本地副本也一样', async () => {
    login('allowed-late')
    server.exists = true
    server.hrefs = ['/models', DYNAMIC]
    const { result } = renderHook(() => useCustomNav())
    await flush()

    expect(result.current.customHrefs).toEqual(['/models', DYNAMIC])
    // 本地副本也不许留短名单(否则换标签页/刷新又是新一轮丢失)
    expect(JSON.parse(window.localStorage.getItem(STORAGE_PREFIX + 'allowed-late') ?? '[]')).toEqual([
      '/models',
      DYNAMIC,
    ])
  })

  it('动态项被保留后用户再改一项,上推的必须是完整列表(云端不得被短名单覆盖)', async () => {
    login('allowed-late-push')
    server.exists = true
    server.hrefs = ['/models', DYNAMIC]
    const { result } = renderHook(() => useCustomNav())
    await flush()

    server.writes = []
    await act(async () => {
      result.current.addHref('/ecosystem')
    })
    await flush()
    const last = server.writes[server.writes.length - 1]
    expect(last).toEqual(['/models', DYNAMIC, '/ecosystem'])
  })
})

/**
 * 同步在飞期间的本机新增(2026-10-25 立)。
 * 「以远端为准」这条规则本身是对的(否则 B 设备删掉的项会被 A 设备的陈旧缓存复活),
 * 但它盖住的应当是"上一次同步为止的状态",而不是把本会话刚做的操作也算成陈旧缓存:
 * GET 发出到返回之间对话框已经可点(侧栏先渲染本地态),这期间加的那一项此刻还
 * 推不上云(上推被"同步未完成"闸门挡着),返回后被 setHrefs(remote) 原地抹掉 ——
 * 症状与票面同形:"新设备上加的第一项没保存"。
 */
describe('useCustomNav —— 同步在飞期间的本机新增不得被远端盖掉', () => {
  it('GET 未返回时用户加了一项 ⇒ 采用远端时把那项带上,并推上云', async () => {
    login('in-flight')
    server.exists = true
    server.hrefs = ['/models']
    server.holdGet = true
    const { result } = renderHook(() => useCustomNav())
    await flush() // GET 已发出并挂起

    await act(async () => {
      result.current.addHref('/agents')
    })
    await act(async () => {
      server.releaseGet()
    })
    await flush()

    expect(result.current.customHrefs).toEqual(['/models', '/agents'])
    expect(server.writes.some((w) => w.includes('/agents'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
