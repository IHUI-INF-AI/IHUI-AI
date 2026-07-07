/**
 * MCP (Model Context Protocol) 服务器配置管理
 *
 * 配置存储在 ~/.ihui/mcp.json, 记录所有已配置的 MCP 服务器。
 * 后端可通过 API 端点 GET /api/v1/workspace/mcp/servers 读取。
 *
 * P1 缺口补齐: 支持三传输 (stdio/http/sse) + 认证 (bearer/oauth),
 * 对标 Claude Code 三传输 + Codex OAuth。
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

/** MCP 传输类型 */
export type MCPTransport = 'stdio' | 'http' | 'sse'

/** MCP 认证类型 */
export type MCPAuthType = 'none' | 'bearer' | 'oauth'

/** MCP OAuth 配置 (授权码流程, 对标 Codex OAuth) */
export interface MCPOAuth {
  client_id?: string
  client_secret?: string
  auth_url?: string
  token_url?: string
  scopes?: string[]
  redirect_uri?: string
  access_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
}

/** MCP 认证配置 */
export interface MCPAuth {
  type: MCPAuthType
  token?: string // bearer 静态 token (支持 ${VAR} 环境变量展开)
  oauth?: MCPOAuth
}

export interface McpServer {
  name: string
  command?: string // stdio 传输使用 (http/sse 可缺省)
  args?: string[]
  env?: Record<string, string>
  /** 传输类型: stdio(默认) | http | sse */
  transport?: MCPTransport
  /** http/sse 传输端点 URL */
  url?: string
  /** 自定义请求头 (http/sse) */
  headers?: Record<string, string>
  /** 兼容字段: 等价于 auth.type=bearer + auth.token */
  api_key?: string
  /** 认证配置 (bearer/oauth) */
  auth?: MCPAuth
}

export interface McpConfig {
  servers: McpServer[]
}

export function getMcpConfigPath(): string {
  return path.join(os.homedir(), '.ihui', 'mcp.json')
}

export function loadMcpConfig(): McpConfig {
  const configPath = getMcpConfigPath()
  if (!fs.existsSync(configPath)) {
    return { servers: [] }
  }
  try {
    const data = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(data) as McpConfig
  } catch {
    return { servers: [] }
  }
}

export function saveMcpConfig(config: McpConfig): void {
  const configPath = getMcpConfigPath()
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

/** addMcpServer 扩展选项 (P1 缺口补齐, 向后兼容) */
export interface AddMcpServerOptions {
  transport?: MCPTransport
  url?: string
  headers?: Record<string, string>
  api_key?: string
  auth?: MCPAuth
  env?: Record<string, string>
}

/**
 * 添加 MCP 服务器配置。
 *
 * 向后兼容: 仅传 name/command/args 时默认 stdio 传输, 行为与旧版一致。
 * 通过 options 可启用 http/sse 传输与认证。
 */
export function addMcpServer(
  name: string,
  command: string | undefined,
  args?: string[],
  options?: AddMcpServerOptions
): McpServer {
  const config = loadMcpConfig()
  // 移除同名的旧配置
  config.servers = config.servers.filter((s) => s.name !== name)
  const server: McpServer = { name, command, args }
  if (options?.env) {
    server.env = options.env
  }
  if (options?.transport) {
    server.transport = options.transport
  } else {
    server.transport = 'stdio'
  }
  if (options?.url) {
    server.url = options.url
  }
  if (options?.headers) {
    server.headers = options.headers
  }
  if (options?.api_key) {
    server.api_key = options.api_key
  }
  if (options?.auth) {
    server.auth = options.auth
  }
  config.servers.push(server)
  saveMcpConfig(config)
  return server
}

export function removeMcpServer(name: string): boolean {
  const config = loadMcpConfig()
  const before = config.servers.length
  config.servers = config.servers.filter((s) => s.name !== name)
  if (config.servers.length < before) {
    saveMcpConfig(config)
    return true
  }
  return false
}
