/**
 * 统一 AI 能力编排系统
 * 深度集成 Agent、Agentic、Model、MCP 等所有 AI 能力
 * 提供统一调用接口和智能编排
 */

import { ref } from 'vue'
import { logger } from '../utils/logger'
import { ElMessage } from 'element-plus'
import { useMCP } from '@/composables/useMCP'
import { useMCPIntegration } from '@/composables/useMCPIntegration'
import { getMCPUseAdapter } from '@/services/mcp-use-adapter'
import { getAvailableModels, callModel } from '@/api/models'
import { getAgentsList, callAgent } from '@/api/agents'
import { createAgenticSwarm, getSwarmStatus } from '@/api/services/agentic.service'

// AI 能力类型
export enum AICapabilityType {
  MODEL = 'model', // 大模型
  AGENT = 'agent', // 单个智能体
  AGENTIC = 'agentic', // Agentic AI 系统
  MCP = 'mcp', // MCP 工具
  HYBRID = 'hybrid', // 混合能力（MCP + 模型）
  AUTO = 'auto', // 智能模式：自动在工具 / 智能体 / 模型间决策
}

// AI 能力请求
export interface AICapabilityRequest {
  type: AICapabilityType
  capabilityId?: string // 能力 ID（模型 ID、Agent ID、Swarm ID、MCP 工具名）
  input: unknown // 输入数据
  context?: {
    userMessage?: string
    conversationHistory?: Array<{ role: string; content: string }>
    currentData?: unknown
    preferences?: Record<string, unknown>
  }
  options?: {
    timeout?: number
    retry?: boolean
    fallback?: AICapabilityRequest // 降级方案
    parallel?: boolean // 是否并行调用多个能力
  }
}

// AI 能力响应
export interface AICapabilityResponse {
  success: boolean
  data?: unknown
  error?: string
  capabilityType: AICapabilityType
  capabilityId: string
  source?: string
  metadata?: {
    latency?: number
    tokensUsed?: number
    cost?: number
    model?: string
    agent?: string
    tools?: string[]
    resolvedMode?: string
  }
  /** Token 使用统计 */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  timestamp: number
}

// 能力组合配置
export interface CapabilityComposition {
  id: string
  name: string
  description?: string
  steps: Array<{
    capability: AICapabilityRequest
    condition?: (prevResult: unknown) => boolean // 条件执行
    transform?: (prevResult: unknown) => unknown // 结果转换
  }>
  parallel?: boolean // 是否并行执行
}

/**
 * 统一 AI 能力编排器
 */
export class UnifiedAIOrchestrator {
  private mcpIntegration = useMCPIntegration()
  private mcp = useMCP()
  private mcpUseAdapter = getMCPUseAdapter()

  // 能力注册表
  private capabilityRegistry = ref<
    Map<
      string,
      {
        type: AICapabilityType
        name: string
        description?: string
        available: boolean
        metadata?: Record<string, unknown>
      }
    >
  >(new Map())

  // 调用历史
  private callHistory = ref<AICapabilityResponse[]>([])

  // 性能统计
  private performanceStats = ref<
    Map<
      string,
      {
        callCount: number
        successCount: number
        averageLatency: number
        totalCost: number
      }
    >
  >(new Map())

  constructor() {
    void this.initializeCapabilities()
  }

  /**
   * 初始化所有能力
   */
  private async initializeCapabilities() {
    // 加载模型
    await this.loadModels()
    // 加载 Agent
    await this.loadAgents()
    // 加载 MCP 工具
    await this.loadMCPTools()
  }

  /**
   * 检查错误是否是未登录错误
   */
  private isNotLoggedInError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const status = error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined
    return !status && (
      errorMessage.includes('未登录') ||
      errorMessage.includes('请先登录') ||
      errorMessage.includes('not logged in')
    )
  }

  /**
   * 加载模型能力
   */
  private async loadModels() {
    try {
      const response = await getAvailableModels()
      if (response.code === 200 && response.success && response.data) {
        for (const model of response.data) {
          this.capabilityRegistry.value.set(`model:${model.id}`, {
            type: AICapabilityType.MODEL,
            name: model.name,
            description: model.description,
            available: (model as { enabled?: boolean }).enabled || false,
            metadata: model as unknown as Record<string, unknown>,
          })
        }
      }
    } catch (error) {
      if (this.isNotLoggedInError(error)) {
        logger.debug('[UnifiedAI] User not logged in, skipping model loading')
      } else {
        logger.error('Failed to load model:', error)
      }
    }
  }

  /**
   * 加载 Agent 能力
   */
  private async loadAgents() {
    try {
      const response = await getAgentsList({
        page: 1,
        pageSize: 100,
        platform: 'all',
      })
      if (response && response.code === 200 && response.success && response.data?.list) {
        for (const agent of response.data.list) {
          this.capabilityRegistry.value.set(`agent:${agent.id}`, {
            type: AICapabilityType.AGENT,
            name: (agent.agentName ?? agent.name ?? '').toString(),
            description: (agent.description ?? (agent as { prologue?: string }).prologue ?? '').toString(),
            available: agent.status === 'active',
            metadata: agent as unknown as Record<string, unknown>,
          })
        }
      }
    } catch (error) {
      if (this.isNotLoggedInError(error)) {
        logger.debug('[UnifiedAI] User not logged in, skipping Agent loading')
      } else {
        logger.error('Failed to load Agent:', error)
      }
    }
  }

  /**
   * 加载 MCP 工具能力
   * 包括传统MCP工具和mcp-use Agent
   */
  private async loadMCPTools() {
    try {
      // 加载传统MCP工具
      await this.mcp.loadMCPServers()
      const { allTools } = this.mcp
      for (const toolItem of allTools.value) {
        this.capabilityRegistry.value.set(`mcp:${toolItem.server.id}:${toolItem.tool.name}`, {
          type: AICapabilityType.MCP,
          name: toolItem.tool.name,
          description: toolItem.tool.description,
          available: toolItem.server.status === 'active',
          metadata: {
            server: toolItem.server,
            tool: toolItem.tool,
          },
        })
      }

      // 加载mcp-use Agent
      const agents = this.mcpUseAdapter.getAgents()
      for (const agent of agents) {
        const displayName = ((agent as { agentName?: string }).agentName ?? agent.name ?? '').toString()
        const agentId = displayName.toLowerCase().replace(/\s+/g, '-')
        this.capabilityRegistry.value.set(`mcp:agent:${agentId}`, {
          type: AICapabilityType.MCP,
          name: displayName,
          description: ((agent as { description?: string; prologue?: string }).description ?? (agent as { prologue?: string }).prologue ?? `mcp-use Agent: ${displayName}`).toString(),
          available: true,
          metadata: {
            agent,
            isMCPUseAgent: true,
          },
        })
      }
    } catch (error) {
      if (this.isNotLoggedInError(error)) {
        logger.debug('[UnifiedAI] User not logged in, skipping MCP tool loading')
      } else {
        logger.error('Failed to load MCP tool:', error)
      }
    }
  }

  /**
   * 智能选择最佳能力
   */
  private selectBestCapability(request: AICapabilityRequest): string | null {
    const { type, capabilityId, context } = request

    // 如果指定了能力 ID，直接使用
    if (capabilityId) {
      const key = `${type}:${capabilityId}`
      if (this.capabilityRegistry.value.has(key)) {
        return key
      }
    }

    // 智能选择
    const candidates: Array<{ key: string; score: number }> = []

    for (const [key, capability] of this.capabilityRegistry.value.entries()) {
      if (!capability.available) continue
      if (capability.type !== type && type !== AICapabilityType.HYBRID) continue

      let score = 0

      // 根据上下文匹配
      if (context?.userMessage) {
        const message = context.userMessage.toLowerCase()
        const name = capability.name.toLowerCase()
        const desc = (capability.description || '').toLowerCase()

        if (message.includes(name) || name.includes(message)) {
          score += 0.5
        }
        if (desc.includes(message)) {
          score += 0.3
        }
      }

      // 根据性能统计
      const stats = this.performanceStats.value.get(key)
      if (stats) {
        const successRate = stats.successCount / stats.callCount
        score += successRate * 0.2
        // 延迟越低，分数越高
        score += Math.max(0, (1000 - stats.averageLatency) / 1000) * 0.1
      }

      if (score > 0) {
        candidates.push({ key, score })
      }
    }

    // 返回分数最高的
    candidates.sort((a, b) => b.score - a.score)
    return candidates.length > 0 ? candidates[0].key : null
  }

  /**
   * 调用 AI 能力（内部方法，带递归深度控制）
   */
  private async invokeCapabilityInternal(
    request: AICapabilityRequest,
    depth: number = 0,
    maxDepth: number = 3
  ): Promise<AICapabilityResponse> {
    if (depth >= maxDepth) {
      throw new Error(`降级方案递归深度超过限制（${maxDepth}），可能存在循环降级配置`)
    }
    const startTime = performance.now()

    try {
      // 智能模式：自动在 工具+模型 / 智能体 / 模型 间决策
      if (request.type === AICapabilityType.AUTO) {
        return await this.resolveAndInvokeAuto(request, startTime)
      }

      // 选择最佳能力
      const capabilityKey = this.selectBestCapability(request)
      if (!capabilityKey) {
        throw new Error(`未找到可用的能力: ${request.type}`)
      }

      const capability = this.capabilityRegistry.value.get(capabilityKey)!
      let result: unknown
      const metadata: Record<string, unknown> = {}

      // 根据类型调用不同的能力
      switch (capability.type) {
        case AICapabilityType.MODEL:
          result = await this.invokeModel(capabilityKey, request)
          metadata.model = capability.metadata?.modelId
          break

        case AICapabilityType.AGENT:
          result = await this.invokeAgent(capabilityKey, request)
          metadata.agent = capability.name
          break

        case AICapabilityType.AGENTIC:
          result = await this.invokeAgentic(capabilityKey, request)
          metadata.swarm = capabilityKey
          break

        case AICapabilityType.MCP:
          result = await this.invokeMCP(capabilityKey, request)
          metadata.tools = [capability.name]
          break

        case AICapabilityType.HYBRID:
          result = await this.invokeHybrid(request)
          break

        default:
          throw new Error(`不支持的能力类型: ${capability.type}`)
      }

      const latency = performance.now() - startTime

      const response: AICapabilityResponse = {
        success: true,
        data: result,
        capabilityType: capability.type,
        capabilityId: capabilityKey,
        metadata: {
          ...metadata,
          latency,
        },
        timestamp: Date.now(),
      }

      // 记录历史
      this.callHistory.value.unshift(response)
      if (this.callHistory.value.length > 100) {
        this.callHistory.value = this.callHistory.value.slice(0, 100)
      }

      // 更新性能统计
      this.updatePerformanceStats(capabilityKey, true, latency)

      return response
    } catch (error: unknown) {
      const err = error as { message?: string }
      const latency = performance.now() - startTime

      const response: AICapabilityResponse = {
        success: false,
        error: err?.message || String(error),
        capabilityType: request.type,
        capabilityId: request.capabilityId || 'unknown',
        metadata: { latency },
        timestamp: Date.now(),
      }

      this.callHistory.value.unshift(response)
      this.updatePerformanceStats(request.capabilityId || 'unknown', false, latency)

      // 如果有降级方案，尝试降级
      if (request.options?.fallback) {
        ElMessage.warning(`主能力调用失败，尝试降级方案... (深度: ${depth + 1}/${maxDepth})`)
        return this.invokeCapabilityInternal(request.options.fallback, depth + 1, maxDepth)
      }

      throw error
    }
  }

  /**
   * 调用 AI 能力（公共方法）
   */
  async invokeCapability(request: AICapabilityRequest): Promise<AICapabilityResponse> {
    return this.invokeCapabilityInternal(request, 0, 3)
  }

  /**
   * 调用模型
   */
  private async invokeModel(capabilityKey: string, request: AICapabilityRequest): Promise<unknown> {
    const modelId = capabilityKey.replace('model:', '')
    const response = await callModel({
      modelId,
      messages: (request.context?.conversationHistory || [
        { role: 'user', content: String(request.input) },
      ]) as Array<{ role: string; content: string }>,
      ...request.options,
    })

    if (response.code === 200 && response.success) {
      return response.data
    }
    throw new Error(response.message || '模型调用失败')
  }

  /**
   * 调用 Agent
   */
  private async invokeAgent(capabilityKey: string, request: AICapabilityRequest): Promise<unknown> {
    const agentId = capabilityKey.replace('agent:', '')
    const response = await callAgent(agentId, {
      input: String(request.input),
      context: request.context,
    })

    if (response.code === 200 && response.success) {
      return response.data
    }
    throw new Error(response.message || 'Agent 调用失败')
  }

  /**
   * 调用 Agentic 系统
   */
  private async invokeAgentic(
    capabilityKey: string,
    request: AICapabilityRequest
  ): Promise<unknown> {
    // 如果已有 Swarm ID，获取状态
    if (capabilityKey.includes(':')) {
      const swarmId = capabilityKey.split(':')[1]
      const statusResponse = await getSwarmStatus(swarmId)
      if (statusResponse.code === 200 && statusResponse.success) {
        return statusResponse.data
      }
    }

    // 创建新的 Swarm
    const swarmResponse = await createAgenticSwarm({
      task: String(request.input),
      options: {
        coordination: 'hierarchical',
        maxIterations: 10,
      },
    })

    if (swarmResponse.code === 200 && swarmResponse.success) {
      return swarmResponse.data
    }
    throw new Error(swarmResponse.message || 'Agentic 系统调用失败')
  }

  /**
   * 调用 MCP 工具
   * 支持传统MCP调用和mcp-use Agent调用
   */
  private async invokeMCP(capabilityKey: string, request: AICapabilityRequest): Promise<unknown> {
    const parts = capabilityKey.replace('mcp:', '').split(':')
    const serverId = parts[0]
    const toolName = parts[1]

    // 检查是否是mcp-use Agent调用（格式: mcp:agent:agentId）
    if (serverId === 'agent' && toolName) {
      // 使用mcp-use Agent执行任务
      const agentId = toolName
      const task = request.context?.userMessage || request.input

      const result = await this.mcpUseAdapter.runAgent(agentId, String(task), request.context)

      if (result && result.success) {
        return result.data
      }
      throw new Error(result?.error || 'mcp-use Agent 调用失败')
    }

    // 传统MCP工具调用：已指定 serverId + toolName 时直接调用该工具，否则走智能匹配
    const userMessage = request.context?.userMessage || String(request.input ?? '')
    const hasExplicitTool = serverId && toolName

    if (hasExplicitTool) {
      const params: Record<string, unknown> =
        request.input && typeof request.input === 'object' && !Array.isArray(request.input)
          ? { ...(request.input as Record<string, unknown>) }
          : {}
      if (userMessage) {
        params.query = userMessage
      }
      const result = await this.mcp.invokeMCPTool(serverId, toolName, params, {
        silent: true,
        showError: false,
      })
      if (result && result.success) {
        return result.data
      }
      throw new Error(result?.error || 'MCP 工具调用失败')
    }

    const result = await this.mcpIntegration.smartInvoke(userMessage, {
      userMessage,
      conversationHistory: request.context?.conversationHistory,
      currentData: request.context?.currentData,
    })

    if (result && result.success) {
      return result.data
    }
    throw new Error(result?.error || 'MCP 工具调用失败')
  }

  /**
   * 智能模式：自动决策使用 工具+模型 / 智能体 / 模型，并执行
   */
  private async resolveAndInvokeAuto(
    request: AICapabilityRequest,
    startTime: number
  ): Promise<AICapabilityResponse> {
    const userMessage = request.context?.userMessage || String(request.input)

    // 1. 尝试匹配 MCP 工具，置信度够则走混合（工具 + 模型）
    const matches = this.mcpIntegration.matchTools(userMessage, {
      userMessage,
      conversationHistory: request.context?.conversationHistory,
      currentData: request.context?.currentData,
    })
    if (matches.length > 0 && matches[0].confidence >= 0.5) {
      try {
        const hybridResult = await this.invokeHybrid(request)
        const latency = performance.now() - startTime
        return {
          success: true,
          data: hybridResult,
          capabilityType: AICapabilityType.HYBRID,
          capabilityId: 'auto:hybrid',
          metadata: { latency, resolvedMode: 'hybrid' },
          timestamp: Date.now(),
        }
      } catch (e) {
        logger.warn('[UnifiedAI] Intelligent mode hybrid chain failed, trying Agent/model', e)
      }
    }

    // 2. 尝试可用智能体
    const agentKey = Array.from(this.capabilityRegistry.value.entries()).find(
      ([, cap]) => cap.type === AICapabilityType.AGENT && cap.available
    )?.[0]
    if (agentKey) {
      try {
        const result = await this.invokeAgent(agentKey, request)
        const latency = performance.now() - startTime
        const capability = this.capabilityRegistry.value.get(agentKey)!
        return {
          success: true,
          data: result,
          capabilityType: AICapabilityType.AGENT,
          capabilityId: agentKey,
          metadata: { latency, agent: capability.name, resolvedMode: 'agent' },
          timestamp: Date.now(),
        }
      } catch (e) {
        logger.warn('[UnifiedAI] Intelligent mode Agent chain failed, degrading to model', e)
      }
    }

    // 3. 降级：使用大模型
    const modelKey = Array.from(this.capabilityRegistry.value.entries()).find(
      ([, cap]) => cap.type === AICapabilityType.MODEL && cap.available
    )?.[0]
    if (modelKey) {
      const result = await this.invokeModel(modelKey, request)
      const latency = performance.now() - startTime
      const capability = this.capabilityRegistry.value.get(modelKey)!
      return {
        success: true,
        data: result,
        capabilityType: AICapabilityType.MODEL,
        capabilityId: modelKey,
        metadata: { latency, model: capability.metadata?.modelId as string | undefined, resolvedMode: 'model' },
        timestamp: Date.now(),
      }
    }

    throw new Error('智能模式未找到可用能力（无可用模型/智能体/工具）')
  }

  /**
   * 调用混合能力
   */
  private async invokeHybrid(request: AICapabilityRequest): Promise<unknown> {
    // 智能组合多个能力
    const results: Array<{ source: string; data: unknown }> = []

    // 1. 先尝试 MCP 工具获取数据
    const userMessage = request.context?.userMessage || String(request.input)
    const mcpResult = await this.mcpIntegration.smartInvoke(userMessage, {
      userMessage,
      conversationHistory: request.context?.conversationHistory,
      currentData: request.context?.currentData,
    })
    if (mcpResult && mcpResult.success) {
      results.push({ source: 'mcp', data: mcpResult.data } as { source: string; data: unknown })
    }

    // 2. 使用模型处理数据
    const modelRequest: AICapabilityRequest = {
      ...request,
      type: AICapabilityType.MODEL,
      input: {
        ...(request.input as Record<string, unknown>),
        context: mcpResult?.data,
      },
    }
    const modelResult = await this.invokeCapability(modelRequest)
    if (modelResult.success) {
      results.push({ source: 'model', data: modelResult.data } as { source: string; data: unknown })
    }

    return {
      results,
      combined: this.combineResults(results),
    }
  }

  /**
   * 组合多个结果
   */
  private combineResults(results: Array<{ source: string; data: unknown }>): unknown {
    // 简单的合并策略，可以根据需要扩展
    return results.reduce((acc, result) => {
      return { ...acc, [result.source]: result.data }
    }, {})
  }

  /**
   * 执行能力组合
   */
  async executeComposition(composition: CapabilityComposition): Promise<AICapabilityResponse[]> {
    const results: AICapabilityResponse[] = []

    if (composition.parallel) {
      // 并行执行
      const promises = composition.steps.map(step => this.invokeCapability(step.capability))
      try {
        const parallelResults = await Promise.all(promises)
        results.push(...parallelResults)
      } catch (e) {
        console.error(e)
      }
    } else {
      // 串行执行
      let prevResult: unknown = null
      for (const step of composition.steps) {
        // 检查条件
        if (step.condition && !step.condition(prevResult)) {
          continue
        }

        // 转换输入
        if (step.transform && prevResult) {
          step.capability.input = step.transform(prevResult)
        }

        const result = await this.invokeCapability(step.capability)
        results.push(result)
        prevResult = result.data
      }
    }

    return results
  }

  /**
   * 更新性能统计
   */
  private updatePerformanceStats(capabilityKey: string, success: boolean, latency: number) {
    if (!this.performanceStats.value.has(capabilityKey)) {
      this.performanceStats.value.set(capabilityKey, {
        callCount: 0,
        successCount: 0,
        averageLatency: 0,
        totalCost: 0,
      })
    }

    const stats = this.performanceStats.value.get(capabilityKey)!
    stats.callCount++
    if (success) {
      stats.successCount++
    }
    stats.averageLatency =
      (stats.averageLatency * (stats.callCount - 1) + latency) / stats.callCount
  }

  /**
   * 获取所有可用能力
   */
  getAvailableCapabilities(type?: AICapabilityType) {
    const capabilities = Array.from(this.capabilityRegistry.value.entries()).map(([key, value]) => ({
      id: key.split(':').slice(1).join(':') || key, // Extract id from key (e.g., "agent:123" -> "123")
      ...(value as {
        type: AICapabilityType
        name: string
        description?: string
        available: boolean
        metadata?: Record<string, unknown>
      }),
    }))
    return type
      ? capabilities.filter(c => c.type === type && c.available)
      : capabilities.filter(c => c.available)
  }

  /**
   * 获取调用历史
   */
  getCallHistory() {
    return this.callHistory.value
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return Array.from(this.performanceStats.value.entries()).map(([key, stats]) => ({
      capabilityKey: key,
      ...stats,
    }))
  }
}

// 单例实例
let orchestratorInstance: UnifiedAIOrchestrator | null = null

/**
 * 获取统一 AI 编排器实例
 */
export function getUnifiedAIOrchestrator(): UnifiedAIOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new UnifiedAIOrchestrator()
  }
  return orchestratorInstance
}
