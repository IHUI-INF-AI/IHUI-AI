// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D165 分组服务端 store 的常驻用例。
// 为什么把网络整层 mock 掉:本票要证的正是**失败分类**与**乐观回滚**,
// 那两类结论只有让失败可控地发生才量得到;顺利那一支已由真库端到端对账证明
// (见 PROJECT_PLAN D165 行的 T1–T11 取证),两侧互补,不是互相顶替。
//
// 负载一律写成 `{success:true, data:…}` 的 ApiResult 形态:上一版把 mock 写成裸负载,
// 于是"直接读 res.groups"这种在失败分支上是 undefined 的写法被 mock 掩护着全绿,
// 直到 web typecheck 才现形。形态由这里的 helper 单点给出,不得各案各抄。

import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  listConversationGroups: vi.fn(),
  listConversationGroupAssignments: vi.fn(),
  createConversationGroup: vi.fn(),
  updateConversationGroup: vi.fn(),
  deleteConversationGroup: vi.fn(),
  moveConversationsToGroup: vi.fn(),
}))

vi.mock('@ihui/api-client', () => api)

import { useOrgServerStore } from '../conversation-org-server'
import { useConversationOrgStore } from '../conversation-org'

const ok = <T>(data: T) => ({ success: true as const, data })
const fail = (status: number, error: string, errorCode?: string) =>
  ({ success: false, status, error, errorCode })

/** setFolder 的写穿是 fire-and-forget:等一个宏任务 tick 才能看到回滚/原因落定。 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const G1 = {
  id: 'g1',
  name: '工作',
  pinned: false,
  pinnedAt: null,
  conversationCount: 1,
}

function resetServer() {
  useOrgServerStore.setState({
    userId: null,
    folders: [],
    membership: {},
    ready: false,
    loading: false,
    lastError: null,
  })
  vi.clearAllMocks()
}

async function ready() {
  api.listConversationGroups.mockResolvedValue(ok({ groups: [G1] }))
  api.listConversationGroupAssignments.mockResolvedValue(
    ok({ assignments: [{ conversationId: 'c1', groupId: 'g1' }] }),
  )
  await useOrgServerStore.getState().refresh('u1')
}

describe('useOrgServerStore.refresh', () => {
  beforeEach(resetServer)

  it('O1 成功一回合并 ready=true,membership 按服务端确认集落', async () => {
    await ready()
    const s = useOrgServerStore.getState()
    expect(s.ready).toBe(true)
    expect(s.folders).toEqual([G1])
    expect(s.membership).toEqual({ c1: 'g1' })
  })

  it('O2 抛异常(网络层) ⇒ ready 保持 false,lastError=offline —— 不得把"没回来"写成"没有分组"', async () => {
    api.listConversationGroups.mockRejectedValue(new TypeError('fetch failed'))
    api.listConversationGroupAssignments.mockRejectedValue(new TypeError('fetch failed'))
    await useOrgServerStore.getState().refresh('u1')
    const s = useOrgServerStore.getState()
    expect(s.ready).toBe(false)
    expect(s.lastError).toBe('offline')
  })

  it('O3 失败分支走 ApiResult 而不是抛:status=401 必须归 unauthorized(这一例钉住上一版的形态 bug)', async () => {
    api.listConversationGroups.mockResolvedValue(fail(401, 'Invalid or expired token', 'UNAUTHORIZED'))
    api.listConversationGroupAssignments.mockResolvedValue(ok({ assignments: [] }))
    await useOrgServerStore.getState().refresh('u1')
    const s = useOrgServerStore.getState()
    expect(s.ready).toBe(false)
    expect(s.lastError).toBe('unauthorized')
    expect(s.folders).toEqual([])
  })

  it('O4 曾经 ready 之后一次刷新失败,ready 不得被改回 false(那会把同步过的用户演成"分组全没了")', async () => {
    await ready()
    api.listConversationGroups.mockResolvedValue(fail(500, 'internal server error'))
    api.listConversationGroupAssignments.mockResolvedValue(ok({ assignments: [{ conversationId: 'c1', groupId: 'g1' }] }))
    await useOrgServerStore.getState().refresh('u1')
    const s = useOrgServerStore.getState()
    expect(s.ready).toBe(true)
    expect(s.lastError).toBe('server')
  })
})

describe('写出口的失败分类', () => {
  beforeEach(async () => {
    resetServer()
    await ready()
  })

  it('O5 401 归 unauthorized,不归 unknown —— 措辞要把人导向"重新登录"而不是"再试一次"', async () => {
    api.updateConversationGroup.mockResolvedValueOnce(fail(401, 'Invalid or expired token'))
    expect(await useOrgServerStore.getState().renameFolder('u1', 'g1', '新名')).toEqual({
      ok: false,
      reason: 'unauthorized',
    })
  })

  it('O6 404 与 403 分家:not-found / forbidden(合并成一类就等于没告诉用户下一步做什么)', async () => {
    api.deleteConversationGroup.mockResolvedValueOnce(fail(404, '分组不存在或无权删除', 'NOT_FOUND'))
    expect(await useOrgServerStore.getState().deleteFolder('u1', 'g1')).toEqual({
      ok: false,
      reason: 'not-found',
    })
    api.deleteConversationGroup.mockResolvedValueOnce(fail(403, 'forbidden'))
    expect(await useOrgServerStore.getState().deleteFolder('u1', 'g1')).toEqual({
      ok: false,
      reason: 'forbidden',
    })
  })

  it('O7 空白名在客户端就拦下、不发请求;超长名走共享层归一化(同一套上限规则,不在门里另立第二条)', async () => {
    api.updateConversationGroup.mockResolvedValue(ok({ id: 'g1', renamed: true, pinned: false }))
    const before = api.updateConversationGroup.mock.calls.length
    expect(await useOrgServerStore.getState().renameFolder('u1', 'g1', '   ')).toEqual({
      ok: false,
      reason: 'name-too-long',
    })
    expect(api.updateConversationGroup.mock.calls.length).toBe(before)
    const r = await useOrgServerStore.getState().renameFolder('u1', 'g1', '名'.repeat(65))
    expect(r).toEqual({ ok: true })
    const sent = api.updateConversationGroup.mock.calls.at(-1)?.[1] as { name: string }
    expect(sent.name.length).toBeLessThanOrEqual(64)
  })

  it('O8 置顶翻转拿当前值取反,不写死 true(写死则第二次点"置顶"什么都没发生而界面显示成功)', async () => {
    api.updateConversationGroup.mockResolvedValue(ok({ id: 'g1', renamed: false, pinned: true }))
    await useOrgServerStore.getState().togglePinFolder('u1', 'g1')
    expect(api.updateConversationGroup).toHaveBeenCalledWith('g1', { pinned: true })
    useOrgServerStore.setState({ folders: [{ ...G1, pinned: true }] })
    await useOrgServerStore.getState().togglePinFolder('u1', 'g1')
    expect(api.updateConversationGroup).toHaveBeenLastCalledWith('g1', { pinned: false })
  })

  it('O9 分组不存在时 togglePin 直接 not-found,不发请求', async () => {
    const before = api.updateConversationGroup.mock.calls.length
    expect(await useOrgServerStore.getState().togglePinFolder('u1', 'zzz')).toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(api.updateConversationGroup.mock.calls.length).toBe(before)
  })
})

describe('assign(会话级归属)', () => {
  beforeEach(async () => {
    resetServer()
    await ready()
  })

  it('O10 库里没命中的那条不回 ok —— affected=0 与"改成功"必须不同形', async () => {
    api.moveConversationsToGroup.mockResolvedValue(
      ok({ requested: 1, affected: 0, missedIds: ['cX'], groupId: 'g1' }),
    )
    expect(await useOrgServerStore.getState().assign('u1', 'cX', '工作')).toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(useOrgServerStore.getState().membership.cX).toBeUndefined()
  })

  it('O11 已存在的同名分组不再新建(否则一次改名会攒出两行同名)', async () => {
    api.moveConversationsToGroup.mockResolvedValue(ok({ requested: 1, affected: 1, missedIds: [], groupId: 'g1' }))
    const before = api.createConversationGroup.mock.calls.length
    await useOrgServerStore.getState().assign('u1', 'c9', '工作')
    expect(api.createConversationGroup.mock.calls.length).toBe(before)
    expect(useOrgServerStore.getState().membership.c9).toBe('g1')
  })

  it('O12 传 null 是"移出分组",不建组也不报错', async () => {
    api.moveConversationsToGroup.mockResolvedValue(ok({ requested: 1, affected: 1, missedIds: [], groupId: null }))
    const before = api.createConversationGroup.mock.calls.length
    expect(await useOrgServerStore.getState().assign('u1', 'c1', null)).toEqual({ ok: true })
    expect(api.createConversationGroup.mock.calls.length).toBe(before)
    expect(useOrgServerStore.getState().membership.c1).toBe(null)
  })

  it('O13 新名字走幂等 create 并用服务端回的真实 id(不拿本地临时 id 写 membership)', async () => {
    api.createConversationGroup.mockResolvedValue(
      ok({ group: { id: 'g-new', name: '新项目', pinned: false, pinnedAt: null, conversationCount: 0 }, reused: true }),
    )
    api.moveConversationsToGroup.mockResolvedValue(ok({ requested: 1, affected: 1, missedIds: [], groupId: 'g-new' }))
    expect(await useOrgServerStore.getState().assign('u1', 'c7', '新项目')).toEqual({ ok: true })
    expect(useOrgServerStore.getState().membership.c7).toBe('g-new')
  })

  it('O14 assignMany 的 missedIds 原样递出去,调用方才敢说"3 条里有 1 条已不存在"', async () => {
    api.moveConversationsToGroup.mockResolvedValue(
      ok({ requested: 3, affected: 2, missedIds: ['c3'], groupId: 'g1' }),
    )
    const r = await useOrgServerStore.getState().assignMany('u1', ['c1', 'c2', 'c3'], 'g1')
    expect(r).toEqual({ ok: true, affected: 2, missedIds: ['c3'] })
    const m = useOrgServerStore.getState().membership
    expect(m.c1).toBe('g1')
    expect(m.c2).toBe('g1')
    expect(m.c3).toBeUndefined()
  })

  it('O15 assignMany 空清单不发请求', async () => {
    const r = await useOrgServerStore.getState().assignMany('u1', [], 'g1')
    expect(r).toEqual({ ok: true, affected: 0, missedIds: [] })
    expect(api.moveConversationsToGroup.mock.calls.length).toBe(0)
  })

  it('O16 deleteFolder 成功后该组下的会话立刻退回未分组(界面不得停在已消失的组上)', async () => {
    api.deleteConversationGroup.mockResolvedValue(ok({ id: 'g1', deleted: true }))
    expect(useOrgServerStore.getState().membership.c1).toBe('g1')
    expect(await useOrgServerStore.getState().deleteFolder('u1', 'g1')).toEqual({ ok: true })
    expect(useOrgServerStore.getState().membership.c1).toBeUndefined()
  })
})

describe('本地 store 与服务端 store 的写穿/回滚(D165 单一真相)', () => {
  beforeEach(async () => {
    resetServer()
    useConversationOrgStore.setState({ byUser: {} })
    await ready()
  })

  it('O17 服务端接管后 setFolder 会写穿;命中成功则本地值留着', async () => {
    api.moveConversationsToGroup.mockResolvedValue(ok({ requested: 1, affected: 1, missedIds: [], groupId: 'g1' }))
    useConversationOrgStore.getState().setFolder('u1', 'c5', '工作')
    await flush()
    expect(useConversationOrgStore.getState().byUser.u1?.c5?.folder).toBe('工作')
    expect(useOrgServerStore.getState().membership.c5).toBe('g1')
  })

  it('O18 写穿失败必须回滚乐观值并留下原因 —— 留着改过的本地值就是"屏幕上改了、库里没有"', async () => {
    api.moveConversationsToGroup.mockRejectedValue(new Error('network down: econnrefused'))
    useConversationOrgStore.getState().setFolder('u1', 'c6', '工作')
    await flush()
    expect(useConversationOrgStore.getState().byUser.u1?.c6).toBeUndefined()
    expect(useOrgServerStore.getState().lastError).toBe('offline')
  })

  it('O19 服务端未接管(ready=false)时 setFolder 保持既有纯本地语义,一个请求都不发', async () => {
    useOrgServerStore.setState({ ready: false })
    const before = api.moveConversationsToGroup.mock.calls.length
    useConversationOrgStore.getState().setFolder('u1', 'c7', '工作')
    await flush()
    expect(api.moveConversationsToGroup.mock.calls.length).toBe(before)
    expect(useConversationOrgStore.getState().byUser.u1?.c7?.folder).toBe('工作')
  })

  it('O20 别人的 userId 不触发本用户的写穿(共享浏览器串号那一型:切了账号还在替上一个账号发请求)', async () => {
    const before = api.moveConversationsToGroup.mock.calls.length
    useConversationOrgStore.getState().setFolder('u2', 'c8', '工作')
    await flush()
    expect(api.moveConversationsToGroup.mock.calls.length).toBe(before)
    expect(useConversationOrgStore.getState().byUser.u2?.c8?.folder).toBe('工作')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
