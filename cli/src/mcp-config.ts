/**
 * MCP (Model Context Protocol) 服务器配置管理
 *
 * 配置存储在 ~/.ihui/mcp.json, 记录所有已配置的 MCP 服务器。
 * 后端可通过 API 端点 GET /api/v1/workspace/mcp/servers 读取。
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface McpServer {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
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

export function addMcpServer(name: string, command: string, args?: string[]): McpServer {
  const config = loadMcpConfig()
  // 移除同名的旧配置
  config.servers = config.servers.filter((s) => s.name !== name)
  const server: McpServer = { name, command, args }
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
