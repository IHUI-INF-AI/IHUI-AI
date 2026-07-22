/**
 * Clawdbot MCP - MCP 协议实现
 *
 * MCP 服务器、客户端核心接口。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export interface McpServerConfig {
  id: string
  name: string
  version: string
  transport: 'stdio' | 'http' | 'sse'
  endpoint?: string
  enabled: boolean
  tools?: string[]
  resources?: string[]
}

export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpResource {
  uri: string
  name: string
  mimeType?: string
}

export interface McpCallResult {
  content: Array<{ type: 'text' | 'image' | 'resource'; data: unknown }>
  isError?: boolean
}

export class McpClient extends EventEmitter {
  /** 内存 MCP 服务器注册表 — 需后续建表持久化(mcpServers 表缺少 transport/tools/resources 字段) */
  private servers = new Map<string, McpServerConfig>()
  private tools = new Map<string, McpTool & { serverId: string }>()
  private resources = new Map<string, McpResource & { serverId: string }>()

  connect(config: McpServerConfig): void {
    this.servers.set(config.id, config)
    logger.info({ server: config.id, transport: config.transport }, '[MCP] Connected')
    this.emit('connected', config)
  }

  disconnect(id: string): boolean {
    const removed = this.servers.delete(id)
    if (removed) {
      for (const [toolName, tool] of this.tools) {
        if (tool.serverId === id) this.tools.delete(toolName)
      }
      for (const [uri, res] of this.resources) {
        if (res.serverId === id) this.resources.delete(uri)
      }
      this.emit('disconnected', id)
    }
    return removed
  }

  listServers(): McpServerConfig[] {
    return Array.from(this.servers.values())
  }

  registerTool(serverId: string, tool: McpTool): void {
    this.tools.set(tool.name, { ...tool, serverId })
    this.emit('toolRegistered', { serverId, tool })
  }

  listTools(): Array<McpTool & { serverId: string }> {
    return Array.from(this.tools.values())
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { content: [{ type: 'text', data: `Tool "${name}" not found` }], isError: true }
    }
    const server = this.servers.get(tool.serverId)
    if (!server || !server.enabled) {
      return { content: [{ type: 'text', data: 'Server not available' }], isError: true }
    }
    logger.info({ tool: name, server: tool.serverId, args: Object.keys(args) }, '[MCP] Call tool')
    this.emit('toolCalled', { name, args })
    return {
      content: [{ type: 'text', data: `Tool "${name}" executed on ${server.name}` }],
    }
  }

  registerResource(serverId: string, resource: McpResource): void {
    this.resources.set(resource.uri, { ...resource, serverId })
    this.emit('resourceRegistered', { serverId, resource })
  }

  listResources(): Array<McpResource & { serverId: string }> {
    return Array.from(this.resources.values())
  }

  async readResource(uri: string): Promise<unknown> {
    const resource = this.resources.get(uri)
    if (!resource) throw new Error(`Resource "${uri}" not found`)
    const server = this.servers.get(resource.serverId)
    if (!server || !server.enabled) throw new Error('Server not available')
    this.emit('resourceRead', { uri })
    return { uri, mimeType: resource.mimeType, data: null }
  }

  getStats() {
    return {
      servers: this.servers.size,
      enabledServers: Array.from(this.servers.values()).filter((s) => s.enabled).length,
      tools: this.tools.size,
      resources: this.resources.size,
    }
  }
}

let instance: McpClient | null = null

export function getMcpClient(): McpClient {
  if (!instance) instance = new McpClient()
  return instance
}
