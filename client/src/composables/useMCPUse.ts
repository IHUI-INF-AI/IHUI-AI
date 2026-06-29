/**
 * mcp-use Composable
 * 提供简化的 MCP 服务器接入和 Agent 功能
 */

import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getI18nGlobal } from '@/locales'
import {
  getMCPUseAdapter,
  type MCPUseClientConfig,
  type MCPUseAgentConfig,
} from '@/services/mcp-use-adapter'
import type { MCPCallResult } from '@/composables/useMCP'

export function useMCPUse() {
  const { t } = useI18n()
  const adapter = getMCPUseAdapter()

  // 状态
  const loading = ref(false)
  const connectedServers = ref<MCPUseClientConfig[]>([])
  const agents = ref<MCPUseAgentConfig[]>([])

  /**
   * 连接 MCP 服务器（6行代码接入）
   */
  const connectServer = async (serverId: string, config: MCPUseClientConfig): Promise<boolean> => {
    loading.value = true
    try {
      const success = await adapter.connectMCPServer({
        ...config,
        serverId,
      })

      if (success) {
        connectedServers.value = adapter.getConnectedServers()
        ElMessage.success(t('msg.use_m_c_p_use.MCP服务器连接'))
      } else {
        ElMessage.error(t('msg.use_m_c_p_use.MCP服务器连接1'))
      }

      return success
    } catch (error: unknown) {
      const err = error as { message?: string }
      ElMessage.error(err?.message || t('common.errors.mcpConnectFailed'))
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建 Agent
   */
  const createAgent = async (agentId: string, config: MCPUseAgentConfig): Promise<boolean> => {
    loading.value = true
    try {
      const success = await adapter.createAgent({
        ...config,
        agentId,
      })

      if (success) {
        agents.value = adapter.getAgents()
        ElMessage.success(t('msg.use_m_c_p_use.Agent创建成2'))
      } else {
        ElMessage.error(t('msg.use_m_c_p_use.Agent创建失3'))
      }

      return success
    } catch (error: unknown) {
      const err = error as { message?: string }
      ElMessage.error(err?.message || t('common.errors.mcpCreateFailed'))
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 运行 Agent
   */
  const runAgent = async (
    agentId: string,
    task: string,
    context?: Record<string, unknown>
  ): Promise<MCPCallResult> => {
    loading.value = true
    try {
      const result = await adapter.runAgent(agentId, task, context)

      // 确保返回的结果包含所有必需的属性
      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success) {
          ElMessage.success(String(getI18nGlobal().t('messages.taskSuccess')))
        } else {
          ElMessage.error(result.error || String(getI18nGlobal().t('messages.operationFailed')))
        }

        // 确保返回完整的 MCPCallResult
        return {
          success: result.success,
          data: result.data ?? null,
          error: result.error,
          serverId: result.serverId || agentId,
          toolName: result.toolName || 'runAgent',
          timestamp: result.timestamp || Date.now(),
        }
      }

      // 如果结果格式不正确，返回默认值
      return {
        success: false,
        error: t('common.errors.invalidResponse'),
        data: null,
        serverId: agentId,
        toolName: 'runAgent',
        timestamp: Date.now(),
      }
    } catch (error: unknown) {
      const err = error as { message?: string }
      ElMessage.error(err?.message || t('common.errors.mcpExecuteFailed'))
      return {
        success: false,
        error: err?.message || t('common.errors.mcpExecuteFailed'),
        data: null,
        serverId: agentId,
        toolName: 'runAgent',
        timestamp: Date.now(),
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * 断开服务器
   */
  const disconnectServer = (serverIdOrUrl: string): void => {
    adapter.disconnectServer(serverIdOrUrl)
    connectedServers.value = adapter.getConnectedServers()
    ElMessage.info(t('mcpUse.manager.disconnectSuccess') || '已断开服务器连接')
  }

  /**
   * 删除 Agent
   */
  const deleteAgent = (agentId: string): void => {
    adapter.deleteAgent(agentId)
    agents.value = adapter.getAgents()
    ElMessage.info(t('mcpUse.manager.deleteAgentSuccess') || '已删除 Agent')
  }

  // 初始化时加载数据
  const refresh = () => {
    connectedServers.value = adapter.getConnectedServers()
    agents.value = adapter.getAgents()
  }

  // 计算属性
  const hasConnectedServers = computed(() => connectedServers.value.length > 0)
  const hasAgents = computed(() => agents.value.length > 0)

  return {
    // 状态
    loading,
    connectedServers,
    agents,

    // 计算属性
    hasConnectedServers,
    hasAgents,

    // 方法
    connectServer,
    createAgent,
    runAgent,
    disconnectServer,
    deleteAgent,
    refresh,
  }
}
