/**
 * MCP 调用封装 Composable
 * 提供在项目中任意调用 MCP 的能力
 */

import { ref, computed } from 'vue'
import i18n from '@/locales'
import { logger } from '../utils/logger'
import { ElMessage } from 'element-plus'
import {
  getMCPServersList,
  getMCPServerCapabilities,
  callMCPTool,
  getMCPConnectorStatuses,
  type MCPServer,
  type MCPTool,
  type MCPResource,
  type MCPPrompt,
  type MCPConnectorStatus,
} from '@/api/mcp'
import { useMCPPerformance } from './useMCPPerformance'

// MCP 调用结果
export interface MCPCallResult {
  success: boolean
  data?: unknown
  error?: string
  serverId: string
  toolName: string
  timestamp: number
}

// MCP 调用历史
const callHistory = ref<MCPCallResult[]>([])

// 当前可用的 MCP 服务器
const availableServers = ref<MCPServer[]>([])
const serversLoading = ref(false)

// 服务器能力缓存
const serverCapabilitiesCache = ref<
  Record<string, { tools: MCPTool[]; resources: MCPResource[]; prompts: MCPPrompt[] }>
>({})

/**
 * 加载可用的 MCP 服务器
 */
export async function loadMCPServers(): Promise<void> {
  serversLoading.value = true
  try {
    const response = await getMCPServersList({ page: 1, pageSize: 100 })
    if (response.code === 200 && response.success === true) {
      availableServers.value = response.data?.list || []
      // 只保留活跃的服务器
      availableServers.value = availableServers.value.filter(
        (s: { status: string }) => s.status === 'active'
      )
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const status = error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined

    // 检查是否是未登录错误
    const isNotLoggedInError =
      !status && (
        errorMessage.includes('未登录') ||
        errorMessage.includes('请先登录') ||
        errorMessage.includes('not logged in')
      )

    // 未登录时静默处理，不记录错误日志
    if (isNotLoggedInError) {
      logger.debug('[MCP] User not logged in, skipping MCP server loading')
    } else {
      logger.error('Failed to load MCP server:', error)
    }
  } finally {
    serversLoading.value = false
  }
}

/**
 * 获取服务器能力（带缓存）
 */
export async function getServerCapabilities(serverId: string): Promise<{
  tools: MCPTool[]
  resources: MCPResource[]
  prompts: MCPPrompt[]
}> {
  // 检查缓存
  if (serverCapabilitiesCache.value[serverId]) {
    return serverCapabilitiesCache.value[serverId]
  }

  try {
    const response = await getMCPServerCapabilities(serverId)
    if (response.code === 200 && response.success === true && response.data) {
      const capabilities = {
        tools: response.data.tools || [],
        resources: response.data.resources || [],
        prompts: response.data.prompts || [],
      }
      // 缓存结果
      serverCapabilitiesCache.value[serverId] = capabilities
      return capabilities
    }
  } catch (error) {
    logger.error(`Failed to get server ${serverId} capabilities:`, error)
  }

  return { tools: [], resources: [], prompts: [] }
}

/**
 * 调用 MCP 工具
 * @param serverIdOrName - 服务器 ID 或名称
 * @param toolName - 工具名称
 * @param arguments_ - 工具参数
 * @param options - 选项
 */
export async function invokeMCPTool(
  serverIdOrName: string,
  toolName: string,
  arguments_: Record<string, unknown> = {},
  options: {
    silent?: boolean
    showError?: boolean
  } = {}
): Promise<MCPCallResult> {
  const { silent = false, showError = true } = options
  const t = (key: string, params?: Record<string, unknown>) =>
    i18n.global.t(key, params as Record<string, string | number | boolean> | undefined)
  const { recordCallStart, recordCallEnd } = useMCPPerformance()

  const startTime = recordCallStart(serverIdOrName, toolName)

  try {
    let serverId = serverIdOrName
    if (!serverId.includes('-') && !serverId.match(/^[0-9a-f]{24}$/i)) {
      const server = availableServers.value.find(
        (s: { name: string; id: string }) => s.name === serverIdOrName || s.id === serverIdOrName
      )
      if (server) {
        serverId = server.id
      }
    }

    if (!silent) {
      ElMessage.info(t('mcpComposable.calling', { tool: toolName }))
    }

    const response = await callMCPTool(serverId, toolName, arguments_)

    const result: MCPCallResult = {
      success: response.code === 200 && response.success === true,
      data: response.data,
      error: response.success === true ? undefined : response.message,
      serverId,
      toolName,
      timestamp: Date.now(),
    }

    // 记录性能
    recordCallEnd(serverIdOrName, toolName, result, startTime)

    // 记录调用历史
    callHistory.value.unshift(result)
    // 只保留最近 100 条记录
    if (callHistory.value.length > 100) {
      callHistory.value = callHistory.value.slice(0, 100)
    }

    if (result.success) {
      if (!silent) {
        ElMessage.success(t('mcpComposable.success', { tool: toolName }))
      }
    } else {
      if (showError) {
        ElMessage.error(t('mcpComposable.failed', { tool: toolName, error: result.error || '' }))
      }
    }

    return result
  } catch (error: unknown) {
    const err = error as { message?: string }
    const result: MCPCallResult = {
      success: false,
      error: err?.message || String(error),
      serverId: serverIdOrName,
      toolName,
      timestamp: Date.now(),
    }

    recordCallEnd(serverIdOrName, toolName, result, startTime)
    callHistory.value.unshift(result)

    if (showError) {
      ElMessage.error(t('mcpComposable.error', { error: result.error }))
    }

    return result
  }
}

/**
 * 批量调用 MCP 工具
 */
export async function invokeMCPToolsBatch(
  calls: Array<{
    serverIdOrName: string
    toolName: string
    arguments_?: Record<string, unknown>
  }>
): Promise<MCPCallResult[]> {
  const results = await Promise.all(
    calls.map(call =>
      invokeMCPTool(call.serverIdOrName, call.toolName, call.arguments_ || {}, {
        silent: true,
        showError: false,
      })
    )
  )

  const successCount = results.filter(r => r.success).length
  const t = (key: string, params?: Record<string, unknown>) =>
    i18n.global.t(key, params as Record<string, string | number | boolean> | undefined)
  ElMessage.info(t('mcpComposable.batchDone', { success: successCount, total: calls.length }))

  return results
}

/**
 * 查找可用的工具
 */
export function findAvailableTool(
  toolName: string,
  serverId?: string
): { server: MCPServer; tool: MCPTool } | null {
  const servers = serverId
    ? availableServers.value.filter((s: { id: string }) => s.id === serverId)
    : availableServers.value

  for (const server of servers) {
    const capabilities = serverCapabilitiesCache.value[server.id]
    if (capabilities) {
      const tool = capabilities.tools.find((t: { name: string }) => t.name === toolName)
      if (tool) {
        return { server, tool }
      }
    }
  }

  return null
}

/**
 * 查找所有可用的工具（按名称）
 */
export async function findAllToolsByName(
  toolName: string
): Promise<Array<{ server: MCPServer; tool: MCPTool }>> {
  const results: Array<{ server: MCPServer; tool: MCPTool }> = []

  // 确保所有服务器的能力都已加载
  for (const server of availableServers.value) {
    if (!serverCapabilitiesCache.value[server.id]) {
      await getServerCapabilities(server.id)
    }

    const capabilities = serverCapabilitiesCache.value[server.id]
    if (capabilities) {
      const tool = capabilities.tools.find((t: { name: string }) => t.name === toolName)
      if (tool) {
        results.push({ server, tool })
      }
    }
  }

  return results
}

/**
 * 使用 MCP 工具（智能查找并调用）
 */
export async function useMCPTool(
  toolName: string,
  arguments_: Record<string, unknown> = {},
  preferredServerId?: string
): Promise<MCPCallResult | null> {
  // 先尝试使用指定的服务器
  if (preferredServerId) {
    const found = findAvailableTool(toolName, preferredServerId)
    if (found) {
      return await invokeMCPTool(found.server.id, toolName, arguments_)
    }
  }

  // 查找所有可用的工具
  const allTools = await findAllToolsByName(toolName)
  const t = (key: string, params?: Record<string, unknown>) =>
    i18n.global.t(key, params as Record<string, string | number | boolean> | undefined)
  if (allTools.length === 0) {
    ElMessage.warning(t('mcpComposable.toolNotFound', { tool: toolName }))
    return null
  }

  // 如果有多个，使用第一个（不同服务器可能有同名工具，优先使用第一个找到的）
   

  return await invokeMCPTool(allTools[0].server.id, toolName, arguments_)
}

/**
 * 连接器状态 (P1 缺口补齐, 对标 WorkBuddy 连接器可视化)
 * 提供连接器在线/离线/工具数查询能力
 */
const connectorStatuses = ref<MCPConnectorStatus[]>([])
const connectorStatusLoading = ref(false)

/**
 * 加载所有连接器运行状态
 */
export async function loadConnectorStatuses(): Promise<void> {
  connectorStatusLoading.value = true
  try {
    const response = await getMCPConnectorStatuses()
    if (response.code === 200 && response.success === true) {
      connectorStatuses.value = response.data || []
    }
  } catch (error) {
    logger.error('Failed to load MCP connector statuses:', error)
  } finally {
    connectorStatusLoading.value = false
  }
}

/**
 * 连接器状态 Composable
 */
export function useMCPConnectors() {
  const onlineConnectors = computed(() =>
    connectorStatuses.value.filter((c) => c.online)
  )
  const offlineConnectors = computed(() =>
    connectorStatuses.value.filter((c) => !c.online)
  )
  const totalTools = computed(() =>
    connectorStatuses.value.reduce((sum, c) => sum + (c.tool_count || 0), 0)
  )

  /**
   * 按名称查询连接器状态
   */
  function getConnectorStatus(name: string): MCPConnectorStatus | undefined {
    return connectorStatuses.value.find((c) => c.name === name)
  }

  return {
    connectorStatuses,
    connectorStatusLoading,
    onlineConnectors,
    offlineConnectors,
    totalTools,
    loadConnectorStatuses,
    getConnectorStatus,
  }
}

/**
 * 主 Composable
 */
export function useMCP() {
  // 计算属性
  const activeServers = computed(() =>
    availableServers.value.filter((s: { status: string }) => s.status === 'active')
  )

  const allTools = computed(() => {
    const tools: Array<{ server: MCPServer; tool: MCPTool }> = []
    for (const server of availableServers.value) {
      const capabilities =
        serverCapabilitiesCache.value[server.id] ||
        (server.capabilities && {
          tools: server.capabilities.tools || [],
          resources: server.capabilities.resources || [],
          prompts: server.capabilities.prompts || [],
        })
      if (capabilities?.tools?.length) {
        for (const tool of capabilities.tools) {
          tools.push({ server, tool })
        }
      }
    }
    return tools
  })

  const allResources = computed(() => {
    const resources: Array<{ server: MCPServer; resource: MCPResource }> = []
    for (const server of availableServers.value) {
      const capabilities =
        serverCapabilitiesCache.value[server.id] ||
        (server.capabilities && {
          tools: server.capabilities.tools || [],
          resources: server.capabilities.resources || [],
          prompts: server.capabilities.prompts || [],
        })
      if (capabilities?.resources?.length) {
        for (const resource of capabilities.resources) {
          resources.push({ server, resource })
        }
      }
    }
    return resources
  })

  const allPrompts = computed(() => {
    const prompts: Array<{ server: MCPServer; prompt: MCPPrompt }> = []
    for (const server of availableServers.value) {
      const capabilities =
        serverCapabilitiesCache.value[server.id] ||
        (server.capabilities && {
          tools: server.capabilities.tools || [],
          resources: server.capabilities.resources || [],
          prompts: server.capabilities.prompts || [],
        })
      if (capabilities?.prompts?.length) {
        for (const prompt of capabilities.prompts) {
          prompts.push({ server, prompt })
        }
      }
    }
    return prompts
  })

  return {
    // 状态
    availableServers,
    serversLoading,
    callHistory,
    serverCapabilitiesCache,

    // 计算属性
    activeServers,
    allTools,
    allResources,
    allPrompts,

    // 方法
    loadMCPServers,
    getServerCapabilities,
    invokeMCPTool,
    invokeMCPToolsBatch,
    useMCPTool,
    findAvailableTool,
    findAllToolsByName,
  }
}
