// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * 独立页 `/mcp-store` 与 `/connectors` 的「按登录主体分键」回归测试(2026-09-29 立)
 *
 * 缺陷:后端把两个端点收窄成按调用方取数 ——
 *   GET /api/mcp/external/servers → require_request_user_id
 *                                     + MCPClientManager.list_registered(user_id)(判据 is_visible)
 *   GET /api/connectors           → connector_store.list_owned(user_id)
 * 而这两个页面的 useQuery 键里**不含任何主体标识**,缓存又是模块级单例
 * (src/lib/query-client.ts,staleTime 5min / gcTime 10min)。换账号那条路**不经过 user=null
 * 这一跳**(app/login/PageClient.tsx:71 无条件展开登录表单 → components/login/LoginFormContent.tsx:325-326
 * setToken(B) 紧接 setUser(B)),而 src/providers/query-provider.tsx:52-59 只在"有→无"清缓存、
 * :30-40 只在 false→true 失效 ⇒ A 的列表在整个 staleTime 窗口里被渲染给 B。
 *
 * 口径抄 src/components/ecosystem/use-ecosystem-overview.ts:77-84(同一族的第一处收口),
 * 不另立第二套:键含主体、**不加 enabled 闸**、无主体时结果落 'anonymous' 桶。四条判据:
 * ① 换账号(A→B,中间没有 null)B 不得读到 A 的条目
 * ② 没有主体时请求照发、数据照渲染 —— 加 `enabled` 会把页面永久停在 loading,
 *    正是 D17 在 src/components/ecosystem/__tests__/ecosystem-hub.test.tsx:198-218 钉住的那一型
 * ③ 裸键(不含主体段)在缓存里不得存在;失效目标必须是**同一个三段键**
 * ④ 主体由有到无仍清空整片缓存(query-provider 负责的另一半)
 *
 * 另钉一条**不得顺手收紧**的:`['mcp-store','store']`(全站目录)必须**仍不含主体** ——
 * 后端 GET /api/mcp/store 的 handler 根本不收 user_id(app/ai-service/app/routers/mcp.py:577),
 * 给它分桶只会让同一份目录在每个账号下各取一次,是往错误方向改。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import type { ReactNode } from 'react'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type {
  McpExternalServersResponse,
  McpRegisteredServer,
  McpStoreResponse,
} from '@ihui/api-client/endpoints/mcp'
import type { ConnectorEntry, ConnectorListResponse } from '@ihui/api-client/endpoints/connectors'
import type { AuthUser } from '@/stores/auth'

import ConnectorsPageClient from '../app/(main)/connectors/PageClient'
import McpStorePageClient from '../app/(main)/mcp-store/PageClient'
import { getQueryClient } from '@/lib/query-client'
import { QueryProvider } from '@/providers/query-provider'
import { useAuthStore } from '@/stores/auth'

// ─── 取数面 mock:服务端视图只认识"当前调用方"那一个账号的数据。
// 用可变模块变量模拟换账号 ⇒ 任何跨账号串面都表现为"读到了别人的名字",而不是断言实现细节。
const { getConnectors, listExternalServers, getMcpStore } = vi.hoisted(() => ({
  getConnectors: vi.fn(),
  listExternalServers: vi.fn(),
  getMcpStore: vi.fn(),
}))

vi.mock('@ihui/api-client/endpoints/connectors', () => ({
  getConnectors,
  saveConnectorConfig: vi.fn(),
  syncConnector: vi.fn(),
  fetchConnectorDoc: vi.fn(),
  setConnectorEnabled: vi.fn(),
  deleteConnector: vi.fn(),
}))

vi.mock('@ihui/api-client/endpoints/mcp', () => ({
  getMcpStore,
  listExternalServers,
  installStoreServer: vi.fn(),
  uninstallStoreServer: vi.fn(),
  setStoreServerEnabled: vi.fn(),
  getMcpServerScore: vi.fn(),
}))

// ─── 渲染面替身:本页用例不断言文案/图标,键名原样回落即可 ───
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('lucide-react', () => {
  const base: Record<PropertyKey, unknown> = { __esModule: true }
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop === 'symbol' || prop === 'then' || prop === 'default') return undefined
      return () => null
    },
    has() {
      return true
    },
  })
})

vi.mock('@ihui/ui-react', () => {
  const Box = ({ children }: { children?: ReactNode }) => <>{children}</>
  return {
    Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? <>{children}</> : null,
    DialogContent: Box,
    DialogHeader: Box,
    DialogFooter: Box,
    DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
    Input: () => <input />,
    Label: Box,
    Select: Box,
    SelectTrigger: Box,
    SelectValue: Box,
    SelectContent: Box,
    SelectItem: Box,
    Switch: () => <button type="button" role="switch" aria-checked={false} />,
  }
})

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/common', () => ({ BackButton: () => null }))
vi.mock('@/components/common/ConfirmDialog', () => ({ ConfirmDialog: () => null }))
vi.mock('@/components/data', () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}))
vi.mock('@/components/mcp/mcp-quality-dashboard', () => ({ McpQualityDashboard: () => null }))
vi.mock('@/components/mcp/mcp-scoring-badges', () => ({
  ReviewBadge: () => null,
  ScoringBadges: () => null,
}))

// ─── 夹具 ────────────────────────────────────────────────────────────────
function connectorEntry(
  overrides: Partial<ConnectorEntry> & { key: string; name: string },
): ConnectorEntry {
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

const CONNECTORS_BY_OWNER: Record<string, ConnectorEntry[]> = {
  'user-A': [connectorEntry({ key: 'yuque:A的语雀', name: 'A的语雀' })],
  'user-B': [connectorEntry({ key: 'feishu:B的飞书', name: 'B的飞书', type: 'feishu' })],
}

const SERVERS_BY_OWNER: Record<string, McpRegisteredServer[]> = {
  'user-A': [{ name: 'A的外部Server', transport: 'stdio', connected: true }],
  'user-B': [{ name: 'B的外部Server', transport: 'sse', connected: false }],
}

/** 当前登录主体(测试里由 auth store 决定,mock 据它返回"自己那份") */
let currentOwner = 'user-A'

function userOf(id: string): AuthUser {
  return { id, nickname: id }
}

function connectorBody(): ConnectorListResponse {
  const connectors = CONNECTORS_BY_OWNER[currentOwner] ?? []
  return { connectors, count: connectors.length }
}

function externalBody(): McpExternalServersResponse {
  const servers = SERVERS_BY_OWNER[currentOwner] ?? []
  return { servers, count: servers.length }
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
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

/** 切账号且**中间不经过 null**(线上换账号的真实路径) */
async function switchPrincipalTo(id: string): Promise<void> {
  currentOwner = id
  await act(async () => {
    useAuthStore.setState({ isAuthenticated: true, user: userOf(id) })
  })
}

// ─── 源码面(行为断言看不见的那两格:失效目标 & 没有 enabled 闸) ─────────
const CONNECTORS_SRC = resolve(__dirname, '../app/(main)/connectors/PageClient.tsx')
const MCP_STORE_SRC = resolve(__dirname, '../app/(main)/mcp-store/PageClient.tsx')

/**
 * 取源码里所有 `useQuery({…})` 选项对象文本(括号配平)。
 * 判"有没有 enabled 闸"必须**先在 useQuery 调用里定位**,再去认键 —— 反过来做会让
 * `refresh()` 里那条同样写着 principalId 的 invalidate 文本冒充成查询键(实测第一版就是这样,
 * 把 queryKey 的主体段删掉后源码判据仍报绿)。
 * 名字刻意不以 `use` 开头:它是文本工具,不是 React Hook(react-hooks/rules-of-hooks 会按前缀认)。
 */
function extractQueryOptionBlocks(src: string): string[] {
  const blocks: string[] = []
  for (let at = src.indexOf('useQuery({'); at !== -1; at = src.indexOf('useQuery({', at + 1)) {
    let depth = 0
    for (let i = at + 'useQuery'.length; i < src.length; i += 1) {
      const ch = src[i]
      if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          blocks.push(src.slice(at, i + 1))
          break
        }
      }
    }
  }
  return blocks
}

/** 返回「键含主体的那个 useQuery 选项对象」;找不到就是分桶被摘掉了 */
function principalScopedQueryBlock(src: string, keyRe: RegExp, label: string): string {
  const hit = extractQueryOptionBlocks(src).filter((b) => keyRe.test(b))
  expect(hit.length, `${label}:没有任何 useQuery 的 queryKey 带主体段 ⇒ 跨账号串面回来了`).toBe(1)
  return hit[0] as string
}

beforeEach(() => {
  cleanup()
  getConnectors.mockReset()
  listExternalServers.mockReset()
  getMcpStore.mockReset()
  currentOwner = 'user-A'
  getConnectors.mockImplementation(async () => ({ success: true as const, data: connectorBody() }))
  listExternalServers.mockImplementation(async () => ({
    success: true as const,
    data: externalBody(),
  }))
  // 商店目录是全站面:返回空目录即可,本文件不测它的内容
  getMcpStore.mockImplementation(async () => {
    const body: McpStoreResponse = { servers: [], count: 0 }
    return { success: true as const, data: body }
  })
  useAuthStore.setState({
    token: null,
    refreshToken: null,
    expiresIn: null,
    isAuthenticated: false,
    user: null,
  })
})

describe('/connectors 页的列表按登录主体分键', () => {
  it('① 换账号(A→B,中间没有 null):B 不得读到 A 的连接器', async () => {
    const qc = makeQueryClient()
    useAuthStore.setState({ isAuthenticated: true, user: userOf('user-A') })
    render(<ConnectorsPageClient />, { wrapper: wrapperOf(qc) })
    await waitFor(() => expect(screen.getByText('A的语雀')).toBeTruthy())

    await switchPrincipalTo('user-B')

    await waitFor(() => expect(screen.getByText('B的飞书')).toBeTruthy())
    expect(screen.queryByText('A的语雀')).toBeNull()
    expect(getConnectors).toHaveBeenCalledTimes(2)
  })

  it('② 没有主体时请求照发、数据照渲染(结果只落 "anonymous" 桶)', async () => {
    const qc = makeQueryClient()
    useAuthStore.setState({ isAuthenticated: false, user: null })
    render(<ConnectorsPageClient />, { wrapper: wrapperOf(qc) })

    // 断"数据渲染出来"而不是只断"调用发生过":加 enabled 闸时调用不会发生,
    // 而界面会永久停在 loading 文案 —— 两个症状这里都能抓到。
    await waitFor(() => expect(getConnectors).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText('A的语雀')).toBeTruthy())
    expect(screen.queryByText('loading')).toBeNull()

    const anon = qc.getQueryData<ConnectorListResponse>(['connectors', 'list', 'anonymous'])
    expect(anon?.connectors).toHaveLength(1)
    expect(qc.getQueryData(['connectors', 'list', 'user-A'])).toBeUndefined()
  })

  it('③ 缓存按主体分桶,裸键与 null 键都不存在;全站目录那格不受牵连', async () => {
    const qc = makeQueryClient()
    useAuthStore.setState({ isAuthenticated: true, user: userOf('user-A') })
    render(<ConnectorsPageClient />, { wrapper: wrapperOf(qc) })
    await waitFor(() => expect(screen.getByText('A的语雀')).toBeTruthy())

    await switchPrincipalTo('user-B')
    await waitFor(() => expect(screen.getByText('B的飞书')).toBeTruthy())

    // 缺陷本体就是这一格:裸键(不含主体)被两个账号共用
    expect(qc.getQueryData(['connectors', 'list'])).toBeUndefined()
    expect(qc.getQueryData(['connectors', 'list', null])).toBeUndefined()
    expect(
      qc.getQueryData<ConnectorListResponse>(['connectors', 'list', 'user-A'])?.connectors[0]?.name,
    ).toBe('A的语雀')
  })
})

describe('/mcp-store 页的外部 Server 列表按登录主体分键', () => {
  it('① 换账号(A→B,中间没有 null):B 不得读到 A 的 Server', async () => {
    const qc = makeQueryClient()
    useAuthStore.setState({ isAuthenticated: true, user: userOf('user-A') })
    render(<McpStorePageClient />, { wrapper: wrapperOf(qc) })
    await waitFor(() => expect(screen.getByText('A的外部Server')).toBeTruthy())

    await switchPrincipalTo('user-B')

    await waitFor(() => expect(screen.getByText('B的外部Server')).toBeTruthy())
    expect(screen.queryByText('A的外部Server')).toBeNull()
    expect(listExternalServers).toHaveBeenCalledTimes(2)
  })

  it('② 没有主体时请求照发,结果只落 "anonymous" 桶', async () => {
    const qc = makeQueryClient()
    useAuthStore.setState({ isAuthenticated: false, user: null })
    render(<McpStorePageClient />, { wrapper: wrapperOf(qc) })

    await waitFor(() => expect(listExternalServers).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText('A的外部Server')).toBeTruthy())

    expect(
      qc.getQueryData<McpExternalServersResponse>(['mcp-store', 'registered', 'anonymous'])
        ?.servers,
    ).toHaveLength(1)
    expect(qc.getQueryData(['mcp-store', 'registered', 'user-A'])).toBeUndefined()
    // 缺陷本体:裸两段键
    expect(qc.getQueryData(['mcp-store', 'registered'])).toBeUndefined()
  })

  it('③′ 全站目录 mcp-store/store 那格仍**不含**主体(handler 不收 user_id)', async () => {
    const qc = makeQueryClient()
    useAuthStore.setState({ isAuthenticated: true, user: userOf('user-A') })
    render(<McpStorePageClient />, { wrapper: wrapperOf(qc) })
    await waitFor(() => expect(getMcpStore).toHaveBeenCalledTimes(1))
    expect(qc.getQueryData<McpStoreResponse>(['mcp-store', 'store'])).toBeDefined()
    expect(qc.getQueryData(['mcp-store', 'store', 'user-A'])).toBeUndefined()
  })
})

describe('两页共同的源码判据(行为面看不见的那两格)', () => {
  const CONN_KEY_RE = /queryKey:\s*\[\s*'connectors'\s*,\s*'list'\s*,\s*principalId/
  const MCP_KEY_RE = /queryKey:\s*\[\s*'mcp-store'\s*,\s*'registered'\s*,\s*principalId/

  it('③″ 两个含主体的 queryKey 都不得带 enabled 闸(否则无主体时永久 pending)', () => {
    for (const [file, re, label] of [
      [CONNECTORS_SRC, CONN_KEY_RE, 'connectors'],
      [MCP_STORE_SRC, MCP_KEY_RE, 'mcp-store/registered'],
    ] as const) {
      const block = principalScopedQueryBlock(readFileSync(file, 'utf8'), re, label)
      expect(
        /\benabled\s*:/.test(block),
        `${label}:出现 enabled 闸 ⇒ 无主体时整页停在 loading`,
      ).toBe(false)
    }
  })

  it('③‴ refresh() 的失效目标必须是同一个三段键,而全站目录仍打裸两段键', () => {
    const connectors = readFileSync(CONNECTORS_SRC, 'utf8')
    expect(connectors).toMatch(
      /invalidateQueries\(\{\s*queryKey:\s*\[\s*'connectors'\s*,\s*'list'\s*,\s*principalId/,
    )

    const mcpStore = readFileSync(MCP_STORE_SRC, 'utf8')
    expect(mcpStore).toMatch(
      /invalidateQueries\(\{\s*queryKey:\s*\[\s*'mcp-store'\s*,\s*'registered'\s*,\s*principalId/,
    )
    // 全站目录的失效保持裸键(它不是按人取数的面)
    expect(mcpStore).toMatch(
      /invalidateQueries\(\{\s*queryKey:\s*\[\s*'mcp-store'\s*,\s*'store'\s*\]/,
    )
  })
})

/**
 * 跨账号的另一半:主体由有到无 ⇒ 清空缓存(query-provider 那一道)。
 * 这一组与模块级单例 client 共用,所以单独 describe 并每次自己清面。
 */
describe('主体消失即清空查询缓存', () => {
  beforeEach(() => {
    getQueryClient().clear()
  })

  it('④ 登出(user 由有到无)必须把上一个账号的两份列表都带走', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: userOf('user-A') })
    const view = render(<QueryProvider>{null}</QueryProvider>)

    const qc = getQueryClient()
    qc.setQueryData(['connectors', 'list', 'user-A'], connectorBody())
    qc.setQueryData(['mcp-store', 'registered', 'user-A'], externalBody())
    expect(qc.getQueryData(['connectors', 'list', 'user-A'])).toBeDefined()

    await act(async () => {
      useAuthStore.setState({ isAuthenticated: false, user: null })
    })

    expect(qc.getQueryData(['connectors', 'list', 'user-A'])).toBeUndefined()
    expect(qc.getQueryData(['mcp-store', 'registered', 'user-A'])).toBeUndefined()
    view.unmount()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
