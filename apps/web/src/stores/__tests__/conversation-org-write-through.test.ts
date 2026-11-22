// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D165:端内本地 store ↔ 共享分组服务端 store 的**接合面**用例(写穿、失败回滚、未接管时不写网、串号防护)。
// 为什么留在 apps/web 而不是并进 packages/shared:被测对象是 apps/web 那份本地 store,
// 让共享包反向 import 端内文件会直接违反架构契约门的依赖方向(§3/守门 103)。

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

import { useOrgServerStore } from '@ihui/shared/chat/conversation-org-server'
import { useConversationOrgStore } from '../conversation-org'

const ok = <T>(data: T) => ({ success: true as const, data })
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const G1 = { id: 'g1', name: '工作', pinned: false, pinnedAt: null, conversationCount: 1 }

function resetServer() {
  useOrgServerStore.setState({ userId: null, folders: [], membership: {}, ready: false, loading: false, lastError: null })
  vi.clearAllMocks()
}

async function ready() {
  api.listConversationGroups.mockResolvedValue(ok({ groups: [G1] }))
  api.listConversationGroupAssignments.mockResolvedValue(ok({ assignments: [{ conversationId: 'c1', groupId: 'g1' }] }))
  await useOrgServerStore.getState().refresh('u1')
}

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
