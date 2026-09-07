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

/** MCP 商店条目(目录条目 + 安装状态合并,2026-09-02 立,P2-1) */
export interface McpStoreEntry {
  /** 唯一标识(URL path 安全,小写连字符) */
  key: string
  /**
   * 安装后的 server 名(2026-09-02 起=key,stdio 热挂载名;启停/卸载用它。
   * 注意非 `mcp:{key}` —— 那是外部工具命名空间前缀,bridge 名禁冒号)
   */
  server_name: string
  /** 展示名 */
  name: string
  /** 用途说明 */
  description: string
  /** 来源:official / community */
  source: McpDirectorySource
  /** 传输模式:stdio / sse */
  transport: McpServerTransport
  /** 需用户配置的环境变量名 */
  env_required: string[]
  /** 是否已安装 */
  installed: boolean
  /** 是否已启用(运行中) */
  enabled: boolean
  /** 已注入对话工具表的工具数 */
  tool_count: number
  /** 最近一次安装/启用的错误信息(空=正常) */
  last_error: string
}

/** MCP 商店合并列表响应 */
export interface McpStoreResponse {
  servers: McpStoreEntry[]
  count: number
}

/** 商店安装请求参数 */
export interface InstallStoreServerInput {
  /** 必需环境变量(如 DATABASE_URL / GITHUB_PERSONAL_ACCESS_TOKEN) */
  env?: Record<string, string>
  /** filesystem 类 server 的工作区路径 */
  workspace_path?: string
}

/** 商店安装响应 */
export interface McpStoreInstallResult {
  ok: boolean
  name: string
  tool_count: number
}

/** 商店启停/卸载响应 */
export interface McpStoreActionResult {
  ok: boolean
  name: string
  enabled?: boolean
  tools_removed?: number
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

// ===================== MCP 应用商店(P2-1,2026-09-02 立) =====================

/** 获取 MCP 商店合并列表(目录条目 + 安装状态,一个接口渲染整页) */
export async function getMcpStore(): Promise<ApiResult<McpStoreResponse>> {
  return fetchApi<McpStoreResponse>('/api/mcp/store')
}

/** 商店安装:目录条目 → 官方 SDK stdio 热挂载 → 状态持久化 */
export async function installStoreServer(
  key: string,
  input: InstallStoreServerInput,
): Promise<ApiResult<McpStoreInstallResult>> {
  return fetchApi<McpStoreInstallResult>(`/api/mcp/store/install`, {
    method: 'POST',
    body: JSON.stringify({ key, ...input }),
  })
}

/** 商店卸载:关闭子进程 + 移除注入工具 + 删除持久化记录 */
export async function uninstallStoreServer(name: string): Promise<ApiResult<McpStoreActionResult>> {
  return fetchApi<McpStoreActionResult>(`/api/mcp/store/${encodeURIComponent(name)}/uninstall`, {
    method: 'POST',
  })
}

/** 商店启停:enabled=true 重新热挂载注入工具;false 关闭子进程并清理工具表 */
export async function setStoreServerEnabled(
  name: string,
  enabled: boolean,
): Promise<ApiResult<McpStoreActionResult>> {
  return fetchApi<McpStoreActionResult>(
    `/api/mcp/store/${encodeURIComponent(name)}/${enabled ? 'enable' : 'disable'}`,
    { method: 'POST' },
  )
}

// ===================== 能力市场(P2-8 供给侧,2026-09 立) =====================

/** 能力类型:工具 / 资源 / 提示词 */
export type CapabilityKind = 'tool' | 'resource' | 'prompt'

/** 权限分级:admin 专属 / 全部用户 */
export type CapabilityPermission = 'admin' | 'all'

/** 健康状态:healthy / degraded(依赖外部网络)/ unhealthy */
export type CapabilityHealth = 'healthy' | 'degraded' | 'unhealthy'

/** 能力输入参数摘要(来自 tool.input_schema) */
export interface CapabilityParam {
  name: string
  type: string
  required: boolean
  description: string
}

/** 单个平台能力(能力市场列表/详情项) */
export interface Capability {
  id: string
  name: string
  kind: CapabilityKind
  description: string
  category: string
  permission: CapabilityPermission
  requires_network: boolean
  health: CapabilityHealth
  source: string
  enabled: boolean
  params: CapabilityParam[]
}

/** 能力市场列表响应 */
export interface CapabilityListResponse {
  items: Capability[]
  total: number
  page: number
  page_size: number
  categories: string[]
}

/** 能力启用/停用响应 */
export interface CapabilityActionResult {
  id: string
  enabled: boolean
}

/** 能力市场查询参数 */
export interface ListCapabilitiesInput {
  page?: number
  page_size?: number
  category?: string
  q?: string
}

/** 获取能力市场列表(分页 + 分类过滤 + 关键词检索) */
export async function getCapabilities(
  input: ListCapabilitiesInput = {},
): Promise<ApiResult<CapabilityListResponse>> {
  return fetchApi<CapabilityListResponse>('/api/mcp/capabilities', {
    params: {
      page: input.page ?? 1,
      page_size: input.page_size ?? 20,
      category: input.category ?? '',
      q: input.q ?? '',
    },
  })
}

/** 获取能力市场详情(单条) */
export async function getCapability(
  id: string,
): Promise<ApiResult<Capability>> {
  return fetchApi<Capability>(`/api/mcp/capabilities/${encodeURIComponent(id)}`)
}

/** 启用能力:加入对外暴露的 MCP 能力集 */
export async function enableCapability(
  id: string,
): Promise<ApiResult<CapabilityActionResult>> {
  return fetchApi<CapabilityActionResult>(
    `/api/mcp/capabilities/${encodeURIComponent(id)}/enable`,
    { method: 'POST' },
  )
}

/** 停用能力:从对外暴露的 MCP 能力集中移除 */
export async function disableCapability(
  id: string,
): Promise<ApiResult<CapabilityActionResult>> {
  return fetchApi<CapabilityActionResult>(
    `/api/mcp/capabilities/${encodeURIComponent(id)}/disable`,
    { method: 'POST' },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
