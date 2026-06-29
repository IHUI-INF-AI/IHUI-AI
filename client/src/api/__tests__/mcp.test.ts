// mcp.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

vi.mock('@/utils/envUtils', () => ({
  isDemoMode: vi.fn(() => false),
}))

vi.mock('@/config/backend-paths', () => ({
  DEVELOPER_PATHS: {
    mcp: {
      servers: '/api/mcp/servers',
      serverById: (id: string) => `/api/mcp/servers/${id}`,
      test: (id: string) => `/api/mcp/servers/${id}/test`,
      capabilities: (id: string) => `/api/mcp/servers/${id}/capabilities`,
      tool: (sid: string, tn: string) => `/api/mcp/servers/${sid}/tools/${tn}`,
      resource: (sid: string, uri: string) => `/api/mcp/servers/${sid}/resources/${uri}`,
      prompt: (sid: string, pn: string) => `/api/mcp/servers/${sid}/prompts/${pn}`,
    },
  },
}))

vi.mock('@/data/mcp-curated', () => ({
  MCP_CURATED_SERVERS: [
    { id: 'curated-1', name: 'curated', protocol: 'stdio', url: 'x', status: 'active' },
  ],
}))

import request from '@/utils/request'
import { isDemoMode } from '@/utils/envUtils'
import * as api from '../mcp'

describe('mcp API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(isDemoMode as any).mockReturnValue(false)
    ;(request.get as any).mockResolvedValue({ data: { list: [], ok: true } })
    ;(request.post as any).mockResolvedValue({ data: { success: true } })
    ;(request.put as any).mockResolvedValue({ data: { id: '1' } })
    ;(request.delete as any).mockResolvedValue({ data: undefined })
  })

  it('getMCPServersList 正常返回', async () => {
    const res = await api.getMCPServersList({ page: 1, pageSize: 10 })
    expect(res.success).toBe(true)
    expect(Array.isArray(res.data.list)).toBe(true)
  })

  it('getMCPServersList demo 模式', async () => {
    ;(isDemoMode as any).mockReturnValue(true)
    const res = await api.getMCPServersList()
    expect(res.success).toBe(true)
    expect(res.data.list.length).toBeGreaterThan(0)
  })

  it('getMCPServersList 错误回退', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    const res = await api.getMCPServersList()
    expect(res.success).toBe(true)
    expect(res.data.list.length).toBeGreaterThan(0)
  })

  it('getMCPServersList 非数组数据兼容', async () => {
    ;(request.get as any).mockResolvedValue({ data: { list: 'not-array' } })
    const res = await api.getMCPServersList()
    expect(res.data.list.length).toBeGreaterThan(0)
  })

  it('getMCPServerDetail 正常', async () => {
    const res = await api.getMCPServerDetail('1')
    expect(res.success).toBe(true)
  })

  it('getMCPServerDetail 错误', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    const res = await api.getMCPServerDetail('1')
    expect(res.success).toBe(false)
  })

  it('createMCPServer 正常', async () => {
    const res = await api.createMCPServer({ name: 's' })
    expect(res.success).toBe(true)
  })

  it('createMCPServer 错误', async () => {
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    const res = await api.createMCPServer({ name: 's' })
    expect(res.success).toBe(false)
  })

  it('updateMCPServer 正常', async () => {
    const res = await api.updateMCPServer('1', { name: 's' })
    expect(res.success).toBe(true)
  })

  it('updateMCPServer 错误', async () => {
    ;(request.put as any).mockRejectedValue(new Error('fail'))
    const res = await api.updateMCPServer('1', {})
    expect(res.success).toBe(false)
  })

  it('deleteMCPServer 正常', async () => {
    const res = await api.deleteMCPServer('1')
    expect(res.success).toBe(true)
  })

  it('deleteMCPServer 错误', async () => {
    ;(request.delete as any).mockRejectedValue(new Error('fail'))
    const res = await api.deleteMCPServer('1')
    expect(res.success).toBe(false)
  })

  it('testMCPServer 正常', async () => {
    ;(request.post as any).mockResolvedValue({ data: undefined })
    const res = await api.testMCPServer('1')
    expect(res.success).toBe(true)
  })

  it('testMCPServer 错误', async () => {
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    const res = await api.testMCPServer('1')
    expect(res.success).toBe(false)
  })

  it('getMCPServerCapabilities 正常', async () => {
    const res = await api.getMCPServerCapabilities('1')
    expect(res.success).toBe(true)
  })

  it('getMCPServerCapabilities 错误', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    const res = await api.getMCPServerCapabilities('1')
    expect(res.success).toBe(false)
  })

  it('callMCPTool 正常', async () => {
    const res = await api.callMCPTool('1', 'tool', { a: 1 })
    expect(res.success).toBe(true)
  })

  it('callMCPTool 错误', async () => {
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    const res = await api.callMCPTool('1', 'tool', {})
    expect(res.success).toBe(false)
  })

  it('getMCPResource 正常', async () => {
    const res = await api.getMCPResource('1', 'uri')
    expect(res.success).toBe(true)
  })

  it('getMCPResource 错误', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    const res = await api.getMCPResource('1', 'uri')
    expect(res.success).toBe(false)
  })

  it('callMCPPrompt 正常', async () => {
    const res = await api.callMCPPrompt('1', 'p')
    expect(res.success).toBe(true)
  })

  it('callMCPPrompt 错误', async () => {
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    const res = await api.callMCPPrompt('1', 'p')
    expect(res.success).toBe(false)
  })

  it('MCP_PROTOCOLS 常量', () => {
    expect(api.MCP_PROTOCOLS.stdio.name).toBe('STDIO')
    expect(api.MCP_PROTOCOLS.sse.name).toBe('SSE')
    expect(api.MCP_PROTOCOLS.websocket.name).toBe('WebSocket')
  })
})
