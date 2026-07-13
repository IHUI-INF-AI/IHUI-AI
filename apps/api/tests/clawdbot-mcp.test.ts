import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { McpClient, getMcpClient } from '../src/services/clawdbot/mcp.js'
import type { McpServerConfig, McpTool, McpResource } from '../src/services/clawdbot/mcp.js'

const mockServer = (id: string, enabled = true): McpServerConfig => ({
  id,
  name: `Server ${id}`,
  version: '1.0.0',
  transport: 'stdio',
  enabled,
})

const mockTool = (name: string): McpTool => ({
  name,
  description: `Tool ${name}`,
  inputSchema: { type: 'object' },
})

const mockResource = (uri: string): McpResource => ({
  uri,
  name: `Resource ${uri}`,
  mimeType: 'text/plain',
})

describe('clawdbot McpClient MCP 协议', () => {
  let client: McpClient

  beforeEach(() => {
    client = new McpClient()
  })

  describe('connect / disconnect', () => {
    it('connect 注册服务器', () => {
      client.connect(mockServer('s1'))
      expect(client.listServers()).toHaveLength(1)
    })

    it('connect 触发 connected 事件', () => {
      const handler = vi.fn()
      client.on('connected', handler)
      client.connect(mockServer('s1'))
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('disconnect 删除服务器', () => {
      client.connect(mockServer('s1'))
      expect(client.disconnect('s1')).toBe(true)
      expect(client.listServers()).toHaveLength(0)
    })

    it('disconnect 不存在返回 false', () => {
      expect(client.disconnect('not_exist')).toBe(false)
    })

    it('disconnect 级联删除该服务器工具与资源', () => {
      client.connect(mockServer('s1'))
      client.registerTool('s1', mockTool('t1'))
      client.registerResource('s1', mockResource('file://x'))
      client.disconnect('s1')
      expect(client.listTools()).toHaveLength(0)
      expect(client.listResources()).toHaveLength(0)
    })

    it('disconnect 触发 disconnected 事件', () => {
      const handler = vi.fn()
      client.on('disconnected', handler)
      client.connect(mockServer('s1'))
      client.disconnect('s1')
      expect(handler).toHaveBeenCalledWith('s1')
    })
  })

  describe('工具注册与调用', () => {
    it('registerTool 注册工具', () => {
      client.connect(mockServer('s1'))
      client.registerTool('s1', mockTool('t1'))
      expect(client.listTools()).toHaveLength(1)
    })

    it('registerTool 触发 toolRegistered 事件', () => {
      const handler = vi.fn()
      client.on('toolRegistered', handler)
      client.connect(mockServer('s1'))
      client.registerTool('s1', mockTool('t1'))
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('callTool 成功返回结果', async () => {
      client.connect(mockServer('s1'))
      client.registerTool('s1', mockTool('t1'))
      const r = await client.callTool('t1', { x: 1 })
      expect(r.isError).toBeFalsy()
      expect(r.content[0]!.data).toContain('t1')
    })

    it('callTool 工具不存在返回 isError', async () => {
      const r = await client.callTool('not_exist', {})
      expect(r.isError).toBe(true)
    })

    it('callTool 服务器禁用返回 isError', async () => {
      client.connect(mockServer('s1', false))
      client.registerTool('s1', mockTool('t1'))
      const r = await client.callTool('t1', {})
      expect(r.isError).toBe(true)
    })

    it('callTool 触发 toolCalled 事件', async () => {
      const handler = vi.fn()
      client.on('toolCalled', handler)
      client.connect(mockServer('s1'))
      client.registerTool('s1', mockTool('t1'))
      await client.callTool('t1', {})
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('资源注册与读取', () => {
    it('registerResource 注册资源', () => {
      client.connect(mockServer('s1'))
      client.registerResource('s1', mockResource('file://x'))
      expect(client.listResources()).toHaveLength(1)
    })

    it('registerResource 触发 resourceRegistered 事件', () => {
      const handler = vi.fn()
      client.on('resourceRegistered', handler)
      client.connect(mockServer('s1'))
      client.registerResource('s1', mockResource('file://x'))
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('readResource 成功返回', async () => {
      client.connect(mockServer('s1'))
      client.registerResource('s1', mockResource('file://x'))
      const r = await client.readResource('file://x')
      expect(r).toBeDefined()
    })

    it('readResource 不存在抛错', async () => {
      await expect(client.readResource('not_exist')).rejects.toThrow('not found')
    })

    it('readResource 服务器禁用抛错', async () => {
      client.connect(mockServer('s1', false))
      client.registerResource('s1', mockResource('file://x'))
      await expect(client.readResource('file://x')).rejects.toThrow('Server not available')
    })

    it('readResource 触发 resourceRead 事件', async () => {
      const handler = vi.fn()
      client.on('resourceRead', handler)
      client.connect(mockServer('s1'))
      client.registerResource('s1', mockResource('file://x'))
      await client.readResource('file://x')
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('getStats 统计', () => {
    it('返回 servers/enabledServers/tools/resources', () => {
      client.connect(mockServer('s1'))
      client.connect(mockServer('s2', false))
      client.registerTool('s1', mockTool('t1'))
      client.registerResource('s1', mockResource('file://x'))
      const s = client.getStats()
      expect(s.servers).toBe(2)
      expect(s.enabledServers).toBe(1)
      expect(s.tools).toBe(1)
      expect(s.resources).toBe(1)
    })
  })

  describe('单例', () => {
    it('getMcpClient 返回同一实例', () => {
      expect(getMcpClient()).toBe(getMcpClient())
    })
  })
})
