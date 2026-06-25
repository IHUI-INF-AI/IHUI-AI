import { t } from '@/utils/i18n'

 
 
/**
 * 统一 AI API 接口
 * 提供统一的 AI 能力调用接口，整合 Model、Agent、Agentic、MCP 等所有 AI 能力
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { UNIFIED_AI_PATHS } from '@/config/backend-paths'
import { callModel } from '../models/models'
import type { AIModelInfo } from '../models/models'
import { getAgentsList } from '../agent/agents'
import type { Agent } from '../agent/agents'
import { createAgenticSwarm } from '../services/agentic.service'
import type { MCPServer, MCPTool } from '../tools/mcp'

// AgenticSwarmConfig 类型定义
export interface AgenticSwarmConfig {
  task: string
  userId?: string
  options?: {
    coordination?: 'hierarchical' | 'peer-to-peer' | 'market-based'
    maxIterations?: number
    agentSpecs?: unknown[]
  }
}
import { callMCPTool, getMCPServersList } from '../tools/mcp'

// AI 能力类型
export enum UnifiedAICapabilityType {
  MODEL = 'model',
  AGENT = 'agent',
  AGENTIC = 'agentic',
  MCP = 'mcp',
  HYBRID = 'hybrid',
}

// 统一 AI 调用请求
export interface UnifiedAIRequest {
  type: UnifiedAICapabilityType
  capabilityId?: string
  input: unknown
  context?: {
    userMessage?: string
    conversationHistory?: Array<{ role: string; content: string }>
    currentData?: unknown
    preferences?: Record<string, unknown>
  }
  options?: {
    timeout?: number
    retry?: boolean
    fallback?: UnifiedAIRequest
    parallel?: boolean
    temperature?: number
    maxTokens?: number
    stream?: boolean
  }
}

// 统一 AI 调用响应
export interface UnifiedAIResponse {
  success: boolean
  data?: unknown
  error?: string
  capabilityType: UnifiedAICapabilityType
  capabilityId: string
  metadata?: {
    latency?: number
    tokensUsed?: number
    cost?: number
    model?: string
    agent?: string
    tools?: string[]
  }
  timestamp: number
}

// 能力组合请求
export interface UnifiedAICompositionRequest {
  id: string
  name: string
  description?: string
  steps: Array<{
    capability: UnifiedAIRequest
    condition?: (prevResult: unknown) => boolean
    transform?: (prevResult: unknown) => unknown
  }>
  parallel?: boolean
}

// 能力组合响应
export interface UnifiedAICompositionResponse {
  success: boolean
  results: UnifiedAIResponse[]
  error?: string
  metadata?: {
    totalLatency?: number
    totalCost?: number
    completedSteps?: number
    failedSteps?: number
  }
  timestamp: number
}

/**
 * 调用统一 AI 能力
 */
export async function callUnifiedAI(
  aiRequest: UnifiedAIRequest
): Promise<ApiResponse<UnifiedAIResponse>> {
  try {
    const response = await request.post<UnifiedAIResponse>(UNIFIED_AI_PATHS.invoke, aiRequest)
    const responseData = response as { data?: UnifiedAIResponse } | UnifiedAIResponse
    return {
      code: 200,
      success: true,
      message: t('api.unified_ai.调用成功'),
      data: ('data' in responseData ? responseData.data : responseData) as UnifiedAIResponse,
      timestamp: Date.now(),
    }
  } catch (_error: unknown) {
    // 如果后端接口不存在，使用前端实现
    return await callUnifiedAIFallback(aiRequest)
  }
}

/**
 * 前端降级实现
 */
async function callUnifiedAIFallback(
  req: UnifiedAIRequest
): Promise<ApiResponse<UnifiedAIResponse>> {
  const startTime = performance.now()

  try {
    let result: unknown
     
    const metadata: Record<string, unknown> = {}
     
    switch (req.type) {
      case UnifiedAICapabilityType.MODEL: {
        if (!req.capabilityId) {
          throw new Error(t('error.unified_ai.模型ID不能为空7'))
        }
        const modelResponse = await callModel({
          modelId: req.capabilityId,
          messages: req.context?.conversationHistory || [
            { role: 'user', content: String(req.input) },
          ],
          temperature: req.options?.temperature,
          maxTokens: req.options?.maxTokens,
          stream: req.options?.stream,
        })
        if (modelResponse.code === 200 && modelResponse.success) {
          result = modelResponse.data
          metadata.model = req.capabilityId
        } else {
          throw new Error(modelResponse.message || '模型调用失败')
        }
        break
      }

       
      case UnifiedAICapabilityType.AGENT: {
        if (!req.capabilityId) {
          throw new Error(t('error.unified_ai.AgentID不8'))
        }
        // 调用Agent功能
        const { callAgent } = await import('../agent/agents')
        const agentResponse = await callAgent(req.capabilityId, {
          input: req.context?.userMessage || String(req.input),
          context: req.context,
          stream: req.options?.stream || false,
        })
        if (agentResponse.code === 200 && agentResponse.success) {
          result = agentResponse.data
          metadata.agent = req.capabilityId
        } else {
          throw new Error(agentResponse.message || 'Agent调用失败')
        }
        break
      }

       
      case UnifiedAICapabilityType.AGENTIC: {
        const swarmResponse = await createAgenticSwarm({
          task: String(req.input),
          options: {
            coordination: 'hierarchical',
            maxIterations: 10,
          },
        })
        if (swarmResponse.code === 200 && swarmResponse.success) {
          result = swarmResponse.data
          metadata.swarm = swarmResponse.data?.swarmId
        } else {
          throw new Error(swarmResponse.message || 'Agentic 系统调用失败')
        }
        break
      }

       
      case UnifiedAICapabilityType.MCP: {
        if (!req.capabilityId) {
          throw new Error(t('error.unified_ai.MCP工具ID不9'))
        }
        const [serverId, toolName] = req.capabilityId.split(':')
        const mcpResponse = await callMCPTool(
          serverId,
          toolName,
          req.input as Record<string, unknown>
        )
        if (mcpResponse.code === 200 && mcpResponse.success) {
          result = mcpResponse.data
          metadata.tools = [toolName]
        } else {
          throw new Error(mcpResponse.message || 'MCP 工具调用失败')
        }
        break
      }

       
      case UnifiedAICapabilityType.HYBRID: {
        // 混合调用：先调用 MCP 获取数据，再调用模型处理
         
        const mcpResult = await callUnifiedAIFallback({
          ...req,
          type: UnifiedAICapabilityType.MCP,
        })
        if (mcpResult.success && mcpResult.data) {
          const modelResult = await callUnifiedAIFallback({
            ...req,
            type: UnifiedAICapabilityType.MODEL,
            input: {
              ...(req.input as Record<string, unknown>),
              context: mcpResult.data.data as Record<string, unknown>,
            },
          })
          result = {
            mcp: mcpResult.data.data as Record<string, unknown>,
            model: modelResult.data?.data as Record<string, unknown>,
            combined: {
              ...(mcpResult.data.data as Record<string, unknown>),
              ...(modelResult.data?.data as Record<string, unknown>),
            },
          }
        } else {
          // 如果 MCP 失败，直接调用模型
          result = await callUnifiedAIFallback({
            ...req,
            type: UnifiedAICapabilityType.MODEL,
          })
        }
        break
      }

      default:
        throw new Error(`不支持的能力类型: ${req.type}`)
    }

    const latency = performance.now() - startTime

    return {
      code: 200,
      success: true,
      message: t('api.unified_ai.调用成功1'),
      data: {
        success: true,
        data: result,
        capabilityType: req.type,
        capabilityId: req.capabilityId || 'auto',
        metadata: {
          ...metadata,
          latency,
        },
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    const latency = performance.now() - startTime

    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '调用失败',
      data: {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        capabilityType: req.type,
        capabilityId: req.capabilityId || 'unknown',
        metadata: { latency },
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    }
  }
}

/**
 * 执行能力组合
 */
export async function executeUnifiedAIComposition(
  composition: UnifiedAICompositionRequest
): Promise<ApiResponse<UnifiedAICompositionResponse>> {
  try {
    const response = await request.post(UNIFIED_AI_PATHS.composition, composition)
    return {
      code: 200,
      success: true,
      message: t('api.unified_ai.执行成功2'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (_error: unknown) {
    // 如果后端接口不存在，使用前端实现
    return await executeUnifiedAICompositionFallback(composition)
  }
}

/**
 * 前端降级实现
 */
 
async function executeUnifiedAICompositionFallback(
  composition: UnifiedAICompositionRequest
): Promise<ApiResponse<UnifiedAICompositionResponse>> {
  const startTime = performance.now()
  const results: UnifiedAIResponse[] = []

  try {
    if (composition.parallel) {
      // 并行执行
      const promises = composition.steps.map(step => callUnifiedAI(step.capability))
      const responses = await Promise.all(promises)
       
      results.push(...(responses.filter(r => r.success && r.data).map(r => r.data! as UnifiedAIResponse)))
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

        const response = await callUnifiedAI(step.capability)
        if (response.success && response.data) {
          results.push(response.data as UnifiedAIResponse)
          prevResult = (response.data as { data?: unknown })?.data
        } else {
          throw new Error(response.message || '步骤执行失败')
        }
      }
    }

    const totalLatency = performance.now() - startTime

    return {
      code: 200,
      success: true,
      message: t('api.unified_ai.执行成功3'),
      data: {
        success: true,
        results,
        metadata: {
          totalLatency,
          completedSteps: results.length,
          failedSteps: composition.steps.length - results.length,
        },
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    const totalLatency = performance.now() - startTime

    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '执行失败',
      data: {
        success: false,
        results,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          totalLatency,
          completedSteps: results.length,
          failedSteps: composition.steps.length - results.length,
        },
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    }
  }
}

/**
 * 获取所有可用能力
 */
export async function getAvailableCapabilities(type?: UnifiedAICapabilityType): Promise<
  ApiResponse<{
    models: AIModelInfo[]
    agents: Agent[]
    mcpTools: Array<{ server: MCPServer; tool: MCPTool }>
  }>
> {
  try {
    const response = await request.get(UNIFIED_AI_PATHS.capabilities, {
      params: { type },
    })
    return {
      code: 200,
      success: true,
      message: t('api.unified_ai.获取成功4'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (_error: unknown) {
    // 如果后端接口不存在，使用前端实现
    return await getAvailableCapabilitiesFallback(type)
  }
}

/**
 * 前端降级实现
 */
async function getAvailableCapabilitiesFallback(type?: UnifiedAICapabilityType): Promise<
  ApiResponse<{
    models: AIModelInfo[]
    agents: Agent[]
    mcpTools: Array<{ server: MCPServer; tool: MCPTool }>
  }>
> {
  try {
    const [modelsResponse, agentsResponse, mcpServersResponse] = await Promise.all([
      import('../models/models').then(m => m.getAvailableModels()),
      getAgentsList({ page: 1, pageSize: 100, platform: 'all' }),
      getMCPServersList({ page: 1, pageSize: 100 }),
    ])

    const models =
      modelsResponse.code === 200 && modelsResponse.success ? modelsResponse.data || [] : []

    const agents =
      agentsResponse.code === 200 && agentsResponse.success ? agentsResponse.data?.list || [] : []

    const mcpServers =
      mcpServersResponse.code === 200 && mcpServersResponse.success
        ? mcpServersResponse.data?.list || []
        : []

    // 收集所有 MCP 工具
    const mcpTools: Array<{ server: MCPServer; tool: MCPTool }> = []
    for (const server of mcpServers) {
      if (server.capabilities?.tools) {
        for (const tool of server.capabilities.tools) {
          mcpTools.push({ server, tool })
        }
      }
    }

    return {
      code: 200,
      success: true,
      message: t('api.unified_ai.获取成功5'),
      data: {
        models: type === UnifiedAICapabilityType.MODEL || !type ? models : [],
        agents: type === UnifiedAICapabilityType.AGENT || !type ? agents : [],
        mcpTools: type === UnifiedAICapabilityType.MCP || !type ? mcpTools : [],
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取失败',
      data: {
        models: [],
        agents: [],
        mcpTools: [],
      },
      timestamp: Date.now(),
    }
  }
}

/**
 * 获取能力性能统计
 */
export async function getCapabilityPerformanceStats(capabilityId?: string): Promise<
  ApiResponse<{
    callCount: number
    successCount: number
    failureCount: number
    averageLatency: number
    totalCost: number
  }>
> {
  try {
    const response = await request.get(UNIFIED_AI_PATHS.performance, {
      params: { capabilityId },
    })
    return {
      code: 200,
      success: true,
      message: t('api.unified_ai.获取成功6'),
       
      data: (response.data || response) as {
        callCount: number
        successCount: number
        failureCount: number
        averageLatency: number
        totalCost: number
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取失败',

      data: {
        callCount: 0,
        successCount: 0,
        failureCount: 0,
        averageLatency: 0,
        totalCost: 0,
      } as {
        callCount: number
        successCount: number
        failureCount: number
        averageLatency: number
        totalCost: number
      },
      timestamp: Date.now(),
    }
  }
}
