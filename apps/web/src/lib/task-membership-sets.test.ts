// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildMembershipEntityKey,
  fetchMembershipSetsCached,
  resetMembershipCacheForTests,
  type MembershipScope,
  type MembershipService,
  type MembershipSessionRow,
} from './task-membership-sets'

/**
 * 权威 membership 读取 + 版本化 in-flight promise 缓存 单测(2026-09-30,票 G-977977)。
 *
 * 锁定五条不变量:
 *  1. 同版本同拓扑下多列表实例共享同一轮 RPC(1 + 3×scopes)
 *  2. 核心分区 reject → 抛错保留旧视图,绝不发布权威空集
 *  3. service 实例更换后缓存不共享(WeakMap 编号进 key)
 *  4. 缓存有界 8 条,超出淘汰最旧
 *  5. 失败 promise 不缓存(下一次同 key 重新发起 RPC)
 */

const SCOPE_A: MembershipScope = { workspacePath: 'G:/ws/a' }
const SCOPE_B: MembershipScope = { workspacePath: 'G:/ws/b', workspaceIdentity: 'remote:host:b' }

function makeRow(partial: Partial<MembershipSessionRow> & { sessionId: string }): MembershipSessionRow {
  return {
    workspacePath: 'G:/ws/a',
    title: `会话 ${partial.sessionId}`,
    ...partial,
  }
}

interface MockServiceHarness {
  service: MembershipService
  calls: string[]
  failPartition: (() => Error) | null
}

function createMockService(rows: MembershipSessionRow[] = []): MockServiceHarness {
  const calls: string[] = []
  let failPartition: (() => Error) | null = null
  const harness: MockServiceHarness = {
    calls,
    get failPartition() {
      return failPartition
    },
    set failPartition(value: (() => Error) | null) {
      failPartition = value
    },
    service: {
      async listPinnedSessionIds() {
        calls.push('pinnedIds')
        return rows.filter((row) => row.sessionId.startsWith('pin')).map((row) => row.sessionId)
      },
      async listArchivedSessions() {
        calls.push('archived')
        if (failPartition) throw failPartition()
        return rows.filter((row) => row.sessionId.startsWith('arc'))
      },
      async listSessions() {
        calls.push('active')
        if (failPartition) throw failPartition()
        return rows.filter((row) => row.sessionId.startsWith('act'))
      },
      async listPinnedSessions() {
        calls.push('pinnedRows')
        if (failPartition) throw failPartition()
        return rows.filter((row) => row.sessionId.startsWith('pin'))
      },
    },
  }
  return harness
}

/** 单 endpoint 单 scope 的一轮完整 RPC = 1(pinnedIds)+ 3×scopes(archived/active/pinnedRows)。 */
const ONE_ROUND_ONE_SCOPE = 4

beforeEach(() => {
  resetMembershipCacheForTests()
})

describe('fetchMembershipSetsCached 共享与计数', () => {
  it('两个组件先后订阅只发一轮 1+3×scopes RPC,结果同一引用', async () => {
    const harness = createMockService([
      makeRow({ sessionId: 'act-1', unreadAt: 100, status: 'completed' }),
    ])
    const params = {
      cacheKey: '1::eps-a',
      endpoints: [{ service: harness.service, scopes: [SCOPE_A] }],
    }

    const first = await fetchMembershipSetsCached(params)
    const second = await fetchMembershipSetsCached(params)

    expect(second).toBe(first)
    // 1(pinnedIds)+ 3×1(archived/active/pinnedRows),多实例不翻倍
    expect(harness.calls).toHaveLength(ONE_ROUND_ONE_SCOPE)
    expect(harness.calls.filter((call) => call === 'active')).toHaveLength(1)
  })

  it('同版本多 endpoint 并发共享同一 in-flight promise', async () => {
    const harness = createMockService()
    const params = {
      cacheKey: '1::eps-ab',
      endpoints: [{ service: harness.service, scopes: [SCOPE_A] }],
    }
    const [first, second] = await Promise.all([
      fetchMembershipSetsCached(params),
      fetchMembershipSetsCached(params),
    ])
    expect(first).toBe(second)
    expect(harness.calls).toHaveLength(ONE_ROUND_ONE_SCOPE)
  })

  it('membership 与内容帧解耦:同版本不同 cacheKey 不会互相命中', async () => {
    const harness = createMockService()
    await fetchMembershipSetsCached({
      cacheKey: '1::eps-a',
      endpoints: [{ service: harness.service, scopes: [SCOPE_A] }],
    })
    await fetchMembershipSetsCached({
      cacheKey: '1::eps-b',
      endpoints: [{ service: harness.service, scopes: [SCOPE_B] }],
    })
    // 两个签名各自一轮
    expect(harness.calls).toHaveLength(ONE_ROUND_ONE_SCOPE * 2)
  })
})

describe('核心分区失败保留旧视图', () => {
  it('核心分区 reject 时抛错,不当作权威空集发布', async () => {
    const harness = createMockService([makeRow({ sessionId: 'act-1' })])
    const params = { cacheKey: '1::eps-a', endpoints: [{ service: harness.service, scopes: [SCOPE_A] }] }
    const oldView = await fetchMembershipSetsCached(params)
    expect(oldView.sessionIndexItems).toHaveLength(1)

    // bump 版本后核心分区 RPC 失败
    harness.failPartition = () => new Error('rpc down')
    await expect(
      fetchMembershipSetsCached({
        cacheKey: '2::eps-a',
        endpoints: [{ service: harness.service, scopes: [SCOPE_A] }],
      }),
    ).rejects.toThrow('会话索引行读取不完整')

    // 调用方视角:旧视图仍在(引用未被动过),等待下一轮 membership join 回到事实
    expect(oldView.sessionIndexItems).toHaveLength(1)
    expect(oldView.pinnedIds.size).toBe(0)
  })

  it('辅助集合失败按空集降级,不影响整轮成功', async () => {
    const harness = createMockService([
      makeRow({ sessionId: 'act-1' }),
      makeRow({ sessionId: 'pin-1' }),
    ])
    // 只让辅助的 pinnedIds 失败
    harness.service.listPinnedSessionIds = async () => {
      harness.calls.push('pinnedIds')
      throw new Error('aux down')
    }
    const sets = await fetchMembershipSetsCached({
      cacheKey: '1::eps-aux',
      endpoints: [{ service: harness.service, scopes: [SCOPE_A] }],
    })
    // pinned 行本身也是 membership 证据:行还在,归属不丢
    expect(sets.pinnedIds.has('pin-1')).toBe(true)
    expect(sets.sessionIndexItems).toHaveLength(2)
  })
})

describe('service 身份与缓存边界', () => {
  it('service 实例更换后缓存不共享(WeakMap 编号进 key)', async () => {
    const harnessA = createMockService()
    const harnessB = createMockService()
    const paramsA = { cacheKey: '1::eps-a', endpoints: [{ service: harnessA.service, scopes: [SCOPE_A] }] }
    const paramsB = { cacheKey: '1::eps-a', endpoints: [{ service: harnessB.service, scopes: [SCOPE_A] }] }

    await fetchMembershipSetsCached(paramsA)
    await fetchMembershipSetsCached(paramsB)

    // 同 cacheKey,但两个 service 各自一轮 RPC
    expect(harnessA.calls).toHaveLength(ONE_ROUND_ONE_SCOPE)
    expect(harnessB.calls).toHaveLength(ONE_ROUND_ONE_SCOPE)
  })

  it('缓存超 8 条淘汰最旧(被淘汰的 key 重新发起 RPC)', async () => {
    const harness = createMockService()
    const keys = Array.from({ length: 9 }, (_, index) => `1::eps-${index}`)
    for (const cacheKey of keys) {
      await fetchMembershipSetsCached({
        cacheKey,
        endpoints: [{ service: harness.service, scopes: [SCOPE_A] }],
      })
    }
    expect(harness.calls).toHaveLength(9 * ONE_ROUND_ONE_SCOPE)

    // 最旧的 eps-0 已被淘汰:再请求会发新一轮;未淘汰的 eps-8 仍命中缓存
    await fetchMembershipSetsCached({
      cacheKey: keys[0]!,
      endpoints: [{ service: harness.service, scopes: [SCOPE_A] }],
    })
    expect(harness.calls).toHaveLength(10 * ONE_ROUND_ONE_SCOPE)
    await fetchMembershipSetsCached({
      cacheKey: keys[8]!,
      endpoints: [{ service: harness.service, scopes: [SCOPE_A] }],
    })
    expect(harness.calls).toHaveLength(10 * ONE_ROUND_ONE_SCOPE)
  })

  it('失败 promise 不缓存:同 key 下一轮重新发起并成功', async () => {
    const harness = createMockService([makeRow({ sessionId: 'act-1' })])
    harness.failPartition = () => new Error('rpc down')
    const params = { cacheKey: '1::eps-a', endpoints: [{ service: harness.service, scopes: [SCOPE_A] }] }
    await expect(fetchMembershipSetsCached(params)).rejects.toThrow('会话索引行读取不完整')

    harness.failPartition = null
    const recovered = await fetchMembershipSetsCached(params)
    expect(recovered.sessionIndexItems).toHaveLength(1)
    // 第一次失败 4 次 + 恢复轮 4 次
    expect(harness.calls).toHaveLength(2 * ONE_ROUND_ONE_SCOPE)
  })
})

describe('平行 map join', () => {
  it('unreadAt / terminalStatus / titleOverride 从三分区完整行收集', async () => {
    const harness = createMockService([
      makeRow({ sessionId: 'act-1', unreadAt: 11, status: 'completed', title: '改过', titleOverridden: true }),
      makeRow({ sessionId: 'arc-1', unreadAt: 22, status: 'error', workspaceIdentity: undefined }),
      makeRow({ sessionId: 'pin-1' }),
    ])
    const sets = await fetchMembershipSetsCached({
      cacheKey: '1::eps-a',
      endpoints: [{ service: harness.service, scopes: [SCOPE_A] }],
    })
    expect(sets.unreadAtBySessionId.get('act-1')).toBe(11)
    expect(sets.unreadAtBySessionId.get('arc-1')).toBe(22)
    expect(sets.terminalStatusBySessionId.get('act-1')).toBe('completed')
    expect(sets.terminalStatusBySessionId.get('arc-1')).toBe('error')
    expect(sets.titleOverrideBySessionId.get('act-1')).toBe('改过')
    expect(sets.pinnedIds.has('pin-1')).toBe(true)
    // 左表按实体键去重后保留完整行
    expect(sets.sessionIndexItems.map((row) => row.sessionId).sort()).toEqual([
      'act-1',
      'arc-1',
      'pin-1',
    ])
    expect(buildMembershipEntityKey(sets.sessionIndexItems[0]!)).toContain('::')
  })
})
