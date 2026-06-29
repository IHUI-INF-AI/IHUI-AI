import { t } from '@/utils/i18n'

 
/**
 * mcp-use 框架适配器
 * 将 mcp-use 框架集成到统一 AI 编排系统
 *
 * 文章: https://mp.weixin.qq.com/s/pKdR28lS9yioU3xB4XwvPw
 */

import { ref } from 'vue'
import { logger } from '../utils/logger'
import type { MCPCallResult } from '@/composables/useMCP'
import { useMCP } from '@/composables/useMCP'

/**
 * mcp-use 客户端配置
 */
export interface MCPUseClientConfig {
  serverUrl: string
  apiKey?: string
  timeout?: number
  retry?: {
    maxRetries: number
    retryDelay: number
  }
}

/**
 * mcp-use Agent 配置
 */
export interface MCPUseAgentConfig {
  name: string
  description?: string
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: string[] // MCP 工具名称列表
}

/**
 * mcp-use 适配器
 * 提供简化的 MCP 服务器接入和 Agent 功能
 */
export class MCPUseAdapter {
  private mcp = useMCP()
  private clients = ref<Map<string, MCPUseClientConfig>>(new Map())
  private agents = ref<Map<string, MCPUseAgentConfig>>(new Map())

  /**
   * 6行代码接入 MCP 服务器
   *
   * @example
   * ```typescript
   * const adapter = new MCPUseAdapter();
   * await adapter.connectMCPServer({
   *   serverUrl: 'http://localhost:3000',
   *   apiKey: 'your-api-key'
   * });
   * ```
   */
  async connectMCPServer(config: MCPUseClientConfig & { serverId: string }): Promise<boolean> {
    try {
      // 1. 连接到 MCP 服务器
      this.clients.value.set(config.serverId, {
        serverUrl: config.serverUrl,
        apiKey: config.apiKey,
        timeout: config.timeout || 30000,
        retry: config.retry || { maxRetries: 3, retryDelay: 1000 },
      })

      // 2. 获取服务器能力（工具、资源、提示词）
      const capabilities = await this.mcp.getServerCapabilities(config.serverId)

      // capabilities 返回 { tools, resources, prompts }，没有 success 属性
      if (!capabilities || !capabilities.tools) {
        throw new Error(t('error.mcp_use_adapter.获取服务器能力失'))
      }

      return true
    } catch (error: unknown) {
      const err = error as { message?: string }
      logger.error(`[MCP-Use] Connection failed:`, err.message)
      return false
    }
  }

  /**
   * 创建 Agent（使用 MCP 工具）
   */
  async createAgent(config: MCPUseAgentConfig & { agentId: string }): Promise<boolean> {
    try {
      this.agents.value.set(config.agentId, {
        name: config.name,
        description: config.description,
        model: config.model || 'gpt-4',
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 2000,
        tools: config.tools || [],
      })

      return true
    } catch (error: unknown) {
      const err = error as { message?: string }
      logger.error(`[MCP-Use] Failed to create Agent:`, err.message)
      return false
    }
  }

  /**
   * 使用 Agent 执行任务（自动调用 MCP 工具）
   */
  async runAgent(
    agentId: string,
    task: string,
    context?: Record<string, unknown>
  ): Promise<MCPCallResult> {
    const agent = this.agents.value.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} 不存在`)
    }

    try {
      // 1. 分析任务，确定需要调用的工具
      const toolsToUse = await this.selectTools(agent, task)

      // 2. 调用工具获取数据
      const toolResults: Array<{ tool: string; result: unknown }> = []
      for (const toolName of toolsToUse) {
        const result = await this.invokeTool(toolName, task, context)
        toolResults.push({ tool: toolName, result })
      }

      // 3. 使用 LLM 处理结果
      const finalResult = await this.processWithLLM(agent, task, toolResults, context)

      return {
        success: true,
        data: finalResult,
        serverId: (agent as { agentId?: string }).agentId || 'unknown',
        toolName: 'runAgent',
        timestamp: Date.now(),
      } as MCPCallResult
    } catch (error: unknown) {
      const err = error as { message?: string }
      return {
        success: false,
        error: err.message || 'Agent 执行失败',
        data: null,
        serverId: (agent as { agentId?: string }).agentId || 'unknown',
        toolName: 'runAgent',
        timestamp: Date.now(),
      } as MCPCallResult
    }
  }

  /**
   * 智能选择工具
   */
  private async selectTools(agent: MCPUseAgentConfig, task: string): Promise<string[]> {
    // 如果指定了工具，直接使用
    if (agent.tools && agent.tools.length > 0) {
      return agent.tools
    }

    // 否则，根据任务内容智能选择
    // 这里可以集成能力发现系统
    const allTools = this.mcp.allTools.value
    const selected: string[] = []

    // 简单的关键词匹配（实际应该使用更智能的匹配算法）
    const taskLower = task.toLowerCase()
    for (const toolItem of allTools) {
      const toolName = toolItem.tool.name.toLowerCase()
      const toolDesc = (toolItem.tool.description || '').toLowerCase()

      if (
        taskLower.includes(toolName) ||
        toolDesc.includes(taskLower) ||
        toolName.includes(taskLower)
      ) {
        selected.push(`${toolItem.server.id}:${toolItem.tool.name}`)
      }
    }

    return selected.slice(0, 5) // 最多选择5个工具
  }

  /**
   * 调用工具
   */
  private async invokeTool(
    toolIdentifier: string,
    task: string,
    context?: Record<string, unknown>
  ): Promise<unknown> {
    const [serverId, toolName] = toolIdentifier.split(':')

    // 提取工具参数（可以根据工具 schema 智能提取）
    const params = await this.extractToolParams(toolIdentifier, task, context)

    const result = await this.mcp.invokeMCPTool(serverId, toolName, params)
    return result
  }

  /**
   * 提取工具参数
   */
  private async extractToolParams(
    toolIdentifier: string,
    task: string,
    context?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const [serverId, toolName] = toolIdentifier.split(':')
    const toolItem = this.mcp.allTools.value.find(
      t => t.server.id === serverId && t.tool.name === toolName
    )

    if (!toolItem) {
      return {}
    }

    const schema = toolItem.tool.inputSchema || {}
    const params: Record<string, unknown> = {}

    // 简单的参数提取（实际应该使用 LLM 或更智能的提取）
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        const propSchema = prop as { type?: string; description?: string }

        // 从任务中提取参数
        if (propSchema.description && task.includes(propSchema.description)) {
          // 简单的提取逻辑
          params[key] = this.extractValueFromTask(task, key, propSchema)
        } else if (context && context[key]) {
          params[key] = context[key]
        }
      }
    }

    return params
  }

  /**
   * 从任务中提取值
   */
  private extractValueFromTask(
    task: string,
    key: string,
    schema: { type?: string; description?: string }
  ): unknown {
    // 简单的提取逻辑，实际应该使用更智能的方法
    const patterns = [
      new RegExp(`${key}[：:](\\S+)`, 'i'),
      new RegExp(`"${key}"[：:](\\S+)`, 'i'),
      new RegExp(`${key}\\s*=\\s*(\\S+)`, 'i'),
    ]

    for (const pattern of patterns) {
      const match = task.match(pattern)
      if (match && match[1]) {
        const value = match[1].trim()
        // 根据类型转换
        if (schema.type === 'number') {
          return Number(value)
        } else if (schema.type === 'boolean') {
          return value === 'true' || value === '1'
        }
        return value
      }
    }

    return undefined
  }

  /**
   * 使用 LLM 处理结果
   */
  private async processWithLLM(
    agent: MCPUseAgentConfig,
    task: string,
    toolResults: Array<{ tool: string; result: unknown }>,
    _context?: Record<string, unknown>
  ): Promise<unknown> {
    // 这里应该调用实际的 LLM API
    // 暂时返回工具结果的汇总
    return {
      task,
      toolResults,
      summary: `已使用 ${toolResults.length} 个工具完成任务`,
    }
  }

  /**
   * 获取所有连接的服务器
   */
  getConnectedServers(): MCPUseClientConfig[] {
    return Array.from(this.clients.value.values())
  }

  /**
   * 获取所有 Agent
   */
  getAgents(): MCPUseAgentConfig[] {
    return Array.from(this.agents.value.values())
  }

  /**
   * 断开服务器连接
   */
  disconnectServer(serverIdOrUrl: string): void {
    // 支持通过serverId或serverUrl断开
    for (const [id, config] of this.clients.value.entries()) {
      if (id === serverIdOrUrl || config.serverUrl === serverIdOrUrl) {
        this.clients.value.delete(id)
        break
      }
    }
  }

  /**
   * 删除 Agent
   */
  deleteAgent(agentId: string): void {
    this.agents.value.delete(agentId)
  }
}

// 单例实例
let adapterInstance: MCPUseAdapter | null = null

/**
 * 获取 mcp-use 适配器实例
 */
export function getMCPUseAdapter(): MCPUseAdapter {
  if (!adapterInstance) {
    adapterInstance = new MCPUseAdapter()
  }
  return adapterInstance
}
