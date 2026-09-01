// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP 商店端点(2026-09-01 立)
 * 对应 ai-service 8803 的 MCP 外部生态接口:
 *  - GET  /api/mcp/directory                 → 内置 Server 目录(MCP 应用商店种子数据)
 *  - POST /api/mcp/directory/{key}/register  → 目录一键注册(缺 env 400 / 已存在 409 / 成功 201)
 *  - GET  /api/mcp/external/servers          → 已注册外部 Server 列表(含连接状态)
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'

// ===================== 类型定义 =====================

/** 目录 Server 来源:官方 / 社区 */
export type McpDirectorySource = 'official' | 'community'

/** MCP Server 传输模式 */
export type McpServerTransport = 'stdio' | 'sse'

/** 内置 MCP Server 目录条目(商店列表项) */
export interface McpDirectoryEntry {
  /** 唯一标识(URL path 安全,小写连字符) */
  key: string
  /** 展示名 */
  name: string
  /** 用途说明 */
  description: string
  /** 来源:official / community */
  source: McpDirectorySource
  /** 传输模式:stdio / sse */
  transport: McpServerTransport
  /** 需用户配置的环境变量名(缺则无法一键注册) */
  env_required: string[]
}

/** 目录列表响应 */
export interface McpDirectoryResponse {
  servers: McpDirectoryEntry[]
  count: number
}

/** 已注册外部 MCP Server 摘要(含连接状态,不含敏感 env) */
export interface McpRegisteredServer {
  name: string
  transport: McpServerTransport
  command?: string
  args?: string[]
  url?: string
  timeout?: number
  reconnect?: boolean
  max_reconnect_attempts?: number
  connected?: boolean
  [key: string]: unknown
}

/** 已注册 Server 列表响应 */
export interface McpExternalServersResponse {
  servers: McpRegisteredServer[]
  count: number
}

/** 目录一键注册请求参数(后端会用目录条目 command/args 兜底,前端仅需 env 与可选 args) */
export interface RegisterDirectoryServerInput {
  /** 注册名(通常为 `mcp:{key}`) */
  name: string
  /** 传输模式(与目录条目一致) */
  transport: McpServerTransport
  /** stdio 启动命令(后端会用目录条目默认值覆盖) */
  command: string
  /** stdio 命令参数(如 filesystem 的 workspace path) */
  args?: string[]
  /** 环境变量覆盖(如 DATABASE_URL / GITHUB_PERSONAL_ACCESS_TOKEN) */
  env?: Record<string, string>
}

// ===================== 接口函数 =====================

/** 获取内置 MCP Server 目录(MCP 商店种子数据) */
export async function getMcpDirectory(): Promise<ApiResult<McpDirectoryResponse>> {
  return fetchApi<McpDirectoryResponse>('/api/mcp/directory')
}

/** 目录一键注册:把内置条目转换为 MCP Server 并连接 */
export async function registerDirectoryServer(
  key: string,
  input: RegisterDirectoryServerInput,
): Promise<ApiResult<McpRegisteredServer>> {
  return fetchApi<McpRegisteredServer>(`/api/mcp/directory/${encodeURIComponent(key)}/register`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取已注册的外部 MCP Server 列表(含连接状态) */
export async function listExternalServers(): Promise<ApiResult<McpExternalServersResponse>> {
  return fetchApi<McpExternalServersResponse>('/api/mcp/external/servers')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
