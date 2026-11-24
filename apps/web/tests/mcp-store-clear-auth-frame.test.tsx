// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /mcp-store「撤回授权」入口 —— 控制帧 `mcp_clear_auth` 的前端侧证明(2026-10-28 立)
 *
 * 立因:D141 正本 §1.6 把 `mcp_clear_auth` 记为**真缺(刻意)** —— 原否证命中的是
 * 「可清除的是业务元数据,不是授权凭据」这条**不可清除口径本身**(AGENTS §5),即
 * 「一键抹掉平台级/系统级凭据」被禁;但**用户撤回自己对某个第三方的授权**(RFC 7009
 * revocation 的同族语义)并不在禁令里。本票把那一格拆细后落地。
 *
 * 竞品原帧是 `async mcpClearAuth(e){await this.request({type:"mcp_clear_auth",
 * serverName:e})}` —— **按 serverName 逐台点名**,没有「全清」出口。
 *
 * 本档钉三条纪律:
 * ① **逐台点名**:点哪台的按钮就只撤哪台,绝不能连带撤别的(撤授权是不可逆动作,
 *    误伤别人的授权比不清更糟);
 * ② **失败必须给可见原因**:403(不是你的)/404(已不在)/服务端失败 三者说不同的话,
 *    不能一律弹「操作失败」;
 * ③ **「本来就没有」不是错误**:这台压根没走 OAuth 通道时,报成功态(没有可撤的授权),
 *    不报错误态 —— 否则用户以为撤回失败而反复点。
 *
 * 纪律(AGENTS §22c 镜像测试纪律):本文件**不 mock next-intl**,而是挂**真的
 * NextIntlClientProvider + 真词包**(zh-CN.json),并从真词包里取期望文案 ——
 * 否则"文案里的名字 === 真实 server 名"这条只是在复读测试自己的替身。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearMcpAuth } from '@ihui/api-client/endpoints/control-frames'

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: toastMock }))

vi.mock('@ihui/api-client/endpoints/control-frames', () => ({
  clearMcpAuth: vi.fn(),
}))

vi.mock('@ihui/api-client/endpoints/mcp', () => ({
  getMcpStore: vi.fn(async () => ({ success: true, data: { servers: [], count: 0 } })),
  installStoreServer: vi.fn(),
  uninstallStoreServer: vi.fn(),
  setStoreServerEnabled: vi.fn(),
  listExternalServers: vi.fn(async () => ({
    success: true,
    data: {
      servers: [
        { name: 'server-a', transport: 'sse', connected: true },
        { name: 'server-b', transport: 'stdio', connected: false },
      ],
      count: 2,
    },
  })),
  getMcpServerScore: vi.fn(),
}))

vi.mock('@/components/mcp/mcp-quality-dashboard', () => ({
  McpQualityDashboard: () => null,
}))

vi.mock('@/components/mcp/mcp-scoring-badges', () => ({
  ReviewBadge: () => null,
  ScoringBadges: () => null,
}))

vi.mock('@/components/common', () => ({
  BackButton: () => null,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: { user?: { id: string } }) => { user?: { id: string } }) =>
    sel({ user: { id: 'u-1' } }),
}))

import McpStorePageClient from '../app/(main)/mcp-store/PageClient'

const here = dirname(fileURLToPath(import.meta.url))
// tests → web(apps/web) → packages/i18n/messages/web
const MESSAGES_FILE = join(here, '../../../packages/i18n/messages/web/zh-CN.json')

type Messages = Record<string, unknown>
const messages = JSON.parse(readFileSync(MESSAGES_FILE, 'utf8')) as Messages

const mcpStore = messages.mcpStore as Messages as Record<string, string>

/** 从真词包取词条(刻意不抄字面量 —— 抄一份就成了"测试替身自证")。 */
const w = (key: string): string => mcpStore[key] ?? ''

/** 把真词包里的 ICU `{name}` 占位填成期望文案。 */
const fillName = (template: string, name: string): string => template.replace('{name}', name)

const clearMcpAuthMock = vi.mocked(clearMcpAuth)

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="zh-CN" messages={messages}>
        <McpStorePageClient />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )
}

describe('/mcp-store 撤回授权入口(控制帧 mcp_clear_auth)', () => {
  beforeEach(() => {
    clearMcpAuthMock.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('点了哪台就只撤哪台 —— 逐台点名,没有"全清"出口', async () => {
    clearMcpAuthMock.mockResolvedValue({ cleared: true, hadToken: true, persistFileRemoved: true })

    renderPage()
    fireEvent.click(await screen.findByTestId('mcp-clear-auth-server-b'))

    await waitFor(() => {
      expect(clearMcpAuthMock).toHaveBeenCalledTimes(1)
    })
    // 只点名被点的那台 —— 撤授权不可逆,误伤别人的授权比不清更糟
    expect(clearMcpAuthMock).toHaveBeenCalledWith('server-b')
  })

  it('撤成功要给可见回执(带 server 名)', async () => {
    clearMcpAuthMock.mockResolvedValue({ cleared: true, hadToken: true, persistFileRemoved: true })

    renderPage()
    fireEvent.click(await screen.findByTestId('mcp-clear-auth-server-a'))

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledTimes(1)
    })
    expect(toastMock.success.mock.calls[0][0]).toContain('server-a')
    expect(toastMock.error).not.toHaveBeenCalled()
  })

  it('「本来就没走 OAuth 通道」报成功态而不是错误态 —— 否则用户会以为撤回失败而反复点', async () => {
    clearMcpAuthMock.mockResolvedValue({
      cleared: false,
      hadToken: false,
      persistFileRemoved: false,
      reason: 'no_oauth',
    })

    renderPage()
    fireEvent.click(await screen.findByTestId('mcp-clear-auth-server-a'))

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledTimes(1)
    })
    expect(toastMock.error).not.toHaveBeenCalled()
    expect(toastMock.success.mock.calls[0][0]).toContain(fillName(w('clearAuthNoOauth'), 'server-a'))
  })

  it('失败必须给可见原因(403 / 404 / 服务端失败说不同的话)', async () => {
    clearMcpAuthMock.mockResolvedValue({
      cleared: false,
      hadToken: true,
      persistFileRemoved: false,
      error: '无权清除该 MCP Server 的凭据: server-a',
    })

    renderPage()
    fireEvent.click(await screen.findByTestId('mcp-clear-auth-server-a'))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledTimes(1)
    })
    expect(toastMock.error.mock.calls[0][0]).toContain('无权清除该 MCP Server 的凭据')
    // 失败不得报成功态
    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it('网络异常也要给原因(不能吞异常)', async () => {
    clearMcpAuthMock.mockRejectedValue(new Error('网络异常'))

    renderPage()
    fireEvent.click(await screen.findByTestId('mcp-clear-auth-server-a'))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledTimes(1)
    })
    expect(toastMock.error.mock.calls[0][0]).toContain('网络异常')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
