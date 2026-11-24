// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * 连接器总览的「按登录主体分键」回归测试(2026-09-29 立)
 *
 * 缺陷:后端 `GET /api/connectors` 已收窄成"只返回调用方自己拥有的连接器"
 * (提交 a7379cdba),条目含 name / key / type —— 属个人配置数据。但消费端
 * `useConnectors()` 的 queryKey 不含任何主体标识,而缓存落在模块级单例
 * (src/lib/query-client.ts:47-53,staleTime 5min / gcTime 10min),登出路径不清缓存,
 * src/providers/query-provider.tsx:29-40 又只在"登录态 false→true"时 invalidate。
 * ⇒ 同一浏览器换账号登录时,在 refetch 完成之前,上一个账号的连接器条目会被渲染给新账号。
 *
 * 五条用例各钉住修法的一格,缺一都被本文件咬住:
 * ① 换账号必须看到自己的条目(旧 queryKey 下这一条必红:键未变 + 缓存仍 fresh ⇒ 不重取)
 * ② **没有主体时照发请求** —— 修法刻意不用 `enabled` 闸:那会把渲染永久停在 pending,
 *    而 hub 的 pending 分支与"零条目"共用一个容器 ⇒ 整段空白(D17 在
 *    `src/components/ecosystem/__tests__/ecosystem-hub.test.tsx` 里钉的就是这件事,
 *    实测加 `enabled` 会把那两条判红)。结果落 'anonymous' 桶,不与任何真实主体共用键。
 * ③ 缓存必须按主体分桶,且不存在"无主体桶"与旧的裸键
 * ④ 同一主体重复挂载仍只取一次(证明修法不是"每次强制重取")
 * ⑤/⑥ 跨账号的另一半在 `providers/query-provider.tsx`:主体由有到无 ⇒ 清空缓存;
 *    反向对照 —— 冷启动第一帧无主体、以及登录后的 false→true 转换都**不得**清空
 *    (前者会把每次开页变成全量重取,后者是 2026-08-06 那条 401 修复的语义)。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import type { ReactNode } from 'react'
import { renderHook, waitFor, cleanup, act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { ConnectorEntry, ConnectorListResponse } from '@ihui/api-client/endpoints/connectors'
import type { AuthUser } from '@/stores/auth'

import { useConnectors } from '@/components/ecosystem/use-ecosystem-overview'
import { getQueryClient } from '@/lib/query-client'
import { QueryProvider } from '@/providers/query-provider'
import { useAuthStore } from '@/stores/auth'

// 服务端视图:只认识"当前调用方"的那一个账号的连接器。用可变模块变量模拟换账号,
// 这样任何"跨账号串面"都表现为读到了别人的名字,而不是断言实现细节。
const { getConnectors } = vi.hoisted(() => ({ getConnectors: vi.fn() }))

vi.mock('@ihui/api-client/endpoints/connectors', () => ({ getConnectors }))

function entry(overrides: Partial<ConnectorEntry> & { key: string; name: string }): ConnectorEntry {
  return {
    type: 'yuque',
    extra: { user: 'u', repo: 'r' },
    configured: true,
    enabled: true,
    installed_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    last_sync_at: '2026-09-01T00:00:00Z',
    last_error: '',
    sync_items: [{ doc_id: 'd1', title: 'doc' }],
    capabilities: { doc_list: true, fetch_doc: true },
    ...overrides,
  }
}

const OWNER_ENTRIES: Record<string, ConnectorEntry[]> = {
  'user-A': [entry({ key: 'yuque:A的语雀', name: 'A的语雀' })],
  'user-B': [entry({ key: 'feishu:B的飞书', name: 'B的飞书', type: 'feishu' })],
}

/** 当前登录主体(测试里由 auth store 决定,mock 据它返回"自己那份") */
let currentOwner = 'user-A'

function userOf(id: string): AuthUser {
  return { id, nickname: id }
}

/** 与线上同档的 staleTime / gcTime,否则测不出"缓存仍 fresh 因而不重取" */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, retry: false },
      mutations: {},
    },
  })
}

function wrapperOf(qc: QueryClient) {
  return function Wrapper({ children }: { children?: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

const names = (entries: ConnectorEntry[]) => entries.map((e) => e.name)

beforeEach(() => {
  cleanup()
  getConnectors.mockReset()
  currentOwner = 'user-A'
  getConnectors.mockImplementation(async () => {
    const connectors = OWNER_ENTRIES[currentOwner] ?? []
    const body: ConnectorListResponse = { connectors, count: connectors.length }
    return { success: true as const, data: body }
  })
  useAuthStore.setState({ token: null, refreshToken: null, expiresIn: null, isAuthenticated: false, user: null })
})

describe('useConnectors 按登录主体分键', () => {
  it('① 同一浏览器换账号登录:新账号必须看到自己的条目,而不是上一个账号的', async () => {
    const qc = makeQueryClient()
    useAuthStore.setState({ isAuthenticated: true, user: userOf('user-A') })

    const { result, rerender } = renderHook(() => useConnectors(), { wrapper: wrapperOf(qc) })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(names(result.current.entries)).toEqual(['A的语雀'])

    // 登出后换 B 登录:此处不清 qc(线上登出也不清),缓存仍是 A 那份且未过期
    currentOwner = 'user-B'
    useAuthStore.setState({ isAuthenticated: true, user: userOf('user-B') })
    rerender()

    await waitFor(() => expect(names(result.current.entries)).toEqual(['B的飞书']))
    expect(names(result.current.entries)).not.toContain('A的语雀')
    expect(getConnectors).toHaveBeenCalledTimes(2)
  })

  it('② 没有主体时**照发**请求(不得永久 pending ⇒ 整段空白),结果只落 "anonymous" 桶', async () => {
    // 这一条刻意与"加 enabled 把请求关掉"的写法相反:该组件的 pending 分支与"零条目"
    // 渲染同一个容器(D17 在 ecosystem-hub.test.tsx 里钉的就是这个),把请求关掉等于
    // 造一个永不落地的加载态。跨账号那一半改由 query-provider 的"主体消失即清缓存"兜。
    const qc = makeQueryClient()
    useAuthStore.setState({ isAuthenticated: false, user: null })

    const { result } = renderHook(() => useConnectors(), { wrapper: wrapperOf(qc) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(getConnectors).toHaveBeenCalledTimes(1)
    expect(names(result.current.entries)).toEqual(['A的语雀'])
    const anon = qc.getQueryData<ConnectorListResponse>(['ecosystem', 'connectors', 'anonymous'])
    expect(names(anon?.connectors ?? [])).toEqual(['A的语雀'])
    // 真实主体的桶必须与匿名桶分开,否则"分键"只是换了个名字
    expect(qc.getQueryData(['ecosystem', 'connectors', 'user-A'])).toBeUndefined()
    expect(qc.getQueryData(['ecosystem', 'connectors'])).toBeUndefined()
  })

  it('③ 缓存按主体分桶:两个主体各占一格,裸键与无主体键都不存在', async () => {
    const qc = makeQueryClient()
    useAuthStore.setState({ isAuthenticated: true, user: userOf('user-A') })

    const { result, rerender } = renderHook(() => useConnectors(), { wrapper: wrapperOf(qc) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    currentOwner = 'user-B'
    useAuthStore.setState({ isAuthenticated: true, user: userOf('user-B') })
    rerender()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    const cachedA = qc.getQueryData<ConnectorListResponse>(['ecosystem', 'connectors', 'user-A'])
    const cachedB = qc.getQueryData<ConnectorListResponse>(['ecosystem', 'connectors', 'user-B'])
    expect(names(cachedA?.connectors ?? [])).toEqual(['A的语雀'])
    expect(names(cachedB?.connectors ?? [])).toEqual(['B的飞书'])
    // 缺陷本体就是这一格:裸键(不含主体)被两个账号共用
    expect(qc.getQueryData(['ecosystem', 'connectors'])).toBeUndefined()
    expect(qc.getQueryData(['ecosystem', 'connectors', null])).toBeUndefined()
  })

  it('④ 同一主体重复挂载只取一次(修法不是"每次强制重取",缓存仍复用)', async () => {
    const qc = makeQueryClient()
    useAuthStore.setState({ isAuthenticated: true, user: userOf('user-A') })

    const first = renderHook(() => useConnectors(), { wrapper: wrapperOf(qc) })
    await waitFor(() => expect(first.result.current.status).toBe('ready'))
    first.unmount()

    const second = renderHook(() => useConnectors(), { wrapper: wrapperOf(qc) })
    await waitFor(() => expect(second.result.current.status).toBe('ready'))

    expect(getConnectors).toHaveBeenCalledTimes(1)
    expect(names(second.result.current.entries)).toEqual(['A的语雀'])
  })
})

/**
 * 跨账号的另一半:主体由有到无 ⇒ 清空缓存(query-provider 那一道)。
 * 这两条与上面那组共用模块级单例 client,所以单独一个 describe 并**每次自己造状态**。
 */
describe('主体消失即清空查询缓存', () => {
  beforeEach(() => {
    getQueryClient().clear()
  })

  it('⑤ 登出(user 由有到无)必须把上一个账号的条目从缓存里带走', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: userOf('user-A') })
    const view = render(React.createElement(QueryProvider, null, null))

    const qc = getQueryClient()
    qc.setQueryData(['ecosystem', 'connectors', 'user-A'], OWNER_ENTRIES['user-A'])
    expect(qc.getQueryData(['ecosystem', 'connectors', 'user-A'])).toBeDefined()

    await act(async () => {
      useAuthStore.setState({ isAuthenticated: false, user: null })
    })

    expect(qc.getQueryData(['ecosystem', 'connectors', 'user-A'])).toBeUndefined()
    view.unmount()
  })

  it('⑥ 反向对照:冷启动第一帧没有主体 ⇒ 不得清空(否则每次开页都全量重取)', async () => {
    const qc = getQueryClient()
    qc.setQueryData(['ecosystem', 'connectors', 'anonymous'], OWNER_ENTRIES['user-A'])

    useAuthStore.setState({ isAuthenticated: false, user: null })
    const view = render(React.createElement(QueryProvider, null, null))
    await act(async () => {
      await Promise.resolve()
    })
    expect(qc.getQueryData(['ecosystem', 'connectors', 'anonymous'])).toBeDefined()

    // 登录拿到主体后也只是失效重取,不得把缓存清掉(那是 2026-08-06 那条修复的语义)
    await act(async () => {
      useAuthStore.setState({ isAuthenticated: true, user: userOf('user-B') })
    })
    expect(qc.getQueryData(['ecosystem', 'connectors', 'anonymous'])).toBeDefined()
    view.unmount()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
