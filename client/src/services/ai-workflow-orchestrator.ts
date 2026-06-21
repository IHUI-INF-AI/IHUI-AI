 
/**
 * AI 工作流编排系统
 * 支持复杂的多步骤 AI 工作流定义和执行
 */

import { ref } from 'vue'
import type {
  AICapabilityRequest,
  AICapabilityResponse,
  AICapabilityType,
} from './unified-ai-orchestrator'
import { getUnifiedAIOrchestrator } from './unified-ai-orchestrator'

// 工作流节点
export interface WorkflowNode {
  id: string
  name: string
  type: AICapabilityType
  capabilityId?: string
  input: Record<string, unknown>
  condition?: (prevResults: Array<Record<string, unknown>>) => boolean // 条件执行
  transform?: (prevResults: Array<Record<string, unknown>>) => Record<string, unknown> // 输入转换
  retry?: {
    maxRetries: number
    retryDelay: number
  }
  timeout?: number
}

// 工作流边（连接）
export interface WorkflowEdge {
  from: string
  to: string
  condition?: (result: Record<string, unknown>) => boolean // 条件路由
}

// 工作流定义
export interface AIWorkflow {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  parallel?: boolean // 是否并行执行
  errorHandling?: {
    strategy: 'stop' | 'continue' | 'retry'
    maxRetries?: number
  }
}

// 工作流执行状态
export interface WorkflowExecutionState {
  workflowId: string
  currentNodeId?: string
  completedNodes: string[]
  failedNodes: string[]
  results: Map<string, AICapabilityResponse>
  status: 'running' | 'completed' | 'failed' | 'paused'
  startTime: number
  endTime?: number
}

/**
 * AI 工作流编排器
 */
export class AIWorkflowOrchestrator {
  private orchestrator = getUnifiedAIOrchestrator()
  private executions = ref<Map<string, WorkflowExecutionState>>(new Map())
  private executionLocks = new Set<string>() // 执行锁，防止同一工作流重复执行

  /**
   * 执行工作流
   */
  async executeWorkflow(
    workflow: AIWorkflow,
    initialInput?: unknown
  ): Promise<WorkflowExecutionState> {
    // 检查是否已经有相同工作流正在执行
    const existingExecution = Array.from(this.executions.value.values()).find(
      (exec: WorkflowExecutionState) => exec.workflowId === workflow.id && exec.status === 'running'
    )

    if (existingExecution) {
      throw new Error(`工作流 "${workflow.name || workflow.id}" 正在执行中，无法重复执行`)
    }

    const executionId = `${workflow.id}_${Date.now()}`
    const state: WorkflowExecutionState = {
      workflowId: workflow.id,
      completedNodes: [],
      failedNodes: [],
      results: new Map(),
      status: 'running',
      startTime: Date.now(),
    }

    // 使用锁机制保护并发写入
    if (this.executionLocks.has(workflow.id)) {
      throw new Error(`工作流 "${workflow.name || workflow.id}" 正在执行中`)
    }

    this.executionLocks.add(workflow.id)
    this.executions.value.set(executionId, state)

    try {
      if (workflow.parallel) {
        await this.executeParallel(workflow, state, initialInput)
      } else {
        await this.executeSequential(workflow, state, initialInput)
      }

      state.status = 'completed'
      state.endTime = Date.now()
      // 更新executions Map中的状态
      this.executions.value.set(executionId, { ...state })
    } catch (error: unknown) {
      state.status = 'failed'
      state.endTime = Date.now()
      // 更新executions Map中的状态
      this.executions.value.set(executionId, { ...state })
      throw error
    } finally {
      // 释放锁
      this.executionLocks.delete(workflow.id)
    }

    return state
  }

  /**
   * 串行执行
   */
  private async executeSequential(
    workflow: AIWorkflow,
    state: WorkflowExecutionState,
    initialInput?: unknown
  ): Promise<void> {
    const nodeMap = new Map(workflow.nodes.map(n => [n.id, n]))
    const edgeMap = new Map<string, string[]>()
    for (const edge of workflow.edges) {
      if (!edgeMap.has(edge.from)) {
        edgeMap.set(edge.from, [])
      }
      edgeMap.get(edge.from)!.push(edge.to)
    }

    // 找到起始节点（没有入边的节点）
    const startNodes = workflow.nodes.filter(n => !workflow.edges.some(e => e.to === n.id))

    const visited = new Set<string>()
    const queue: Array<{ nodeId: string; input: unknown }> = startNodes.map(n => ({
      nodeId: n.id,
      input: initialInput,
    }))

    while (queue.length > 0) {
      const { nodeId, input } = queue.shift()!

      if (visited.has(nodeId)) continue

      const node = nodeMap.get(nodeId)
      if (!node) continue

      // 检查前置条件
      if (node.condition) {
        const prevResults = Array.from(state.results.values())
        if (!node.condition(prevResults as unknown as Array<Record<string, unknown>>)) {
          continue
        }
      }

      // 转换输入
      let nodeInput: unknown = input
      if (node.transform) {
        const prevResults = Array.from(state.results.values())
        nodeInput = node.transform(prevResults as unknown as Array<Record<string, unknown>>)
      } else {
        nodeInput = node.input || input
      }

      // 执行节点
      state.currentNodeId = nodeId
      const request: AICapabilityRequest = {
        type: node.type,
        capabilityId: node.capabilityId,
        input: nodeInput,
        options: {
          timeout: node.timeout,
          retry: node.retry ? true : false,
        },
      }

      let result: AICapabilityResponse
      let retries = 0
      const maxRetries = node.retry?.maxRetries || 0

      while (true) {
        try {
          result = await this.orchestrator.invokeCapability(request)
          break
        } catch (error) {
          retries++
          if (retries > maxRetries) {
            throw error
          }
          await new Promise(resolve => setTimeout(resolve, node.retry?.retryDelay || 1000))
        }
      }

      state.results.set(nodeId, result)
      visited.add(nodeId)

      if (result.success) {
        state.completedNodes.push(nodeId)
      } else {
        state.failedNodes.push(nodeId)

        // 错误处理策略
        if (workflow.errorHandling?.strategy === 'stop') {
          throw new Error(`节点 ${nodeId} 执行失败: ${result.error}`)
        }
      }

      // 添加后续节点到队列
      const nextNodes = edgeMap.get(nodeId) || []
      for (const nextNodeId of nextNodes) {
        const edge = workflow.edges.find(e => e.from === nodeId && e.to === nextNodeId)

        // 检查边条件
        if (
          edge?.condition &&
          !(edge.condition as (data: Record<string, unknown>) => boolean)(
            result as unknown as Record<string, unknown>
          )
        ) {
          continue
        }

        if (!visited.has(nextNodeId)) {
          queue.push({ nodeId: nextNodeId, input: result.data })
        }
      }
    }
  }

  /**
   * 并行执行
   */
  private async executeParallel(
    workflow: AIWorkflow,
    state: WorkflowExecutionState,
    initialInput?: unknown
  ): Promise<void> {
    const promises = workflow.nodes.map(async node => {
      const request: AICapabilityRequest = {
        type: node.type,
        capabilityId: node.capabilityId,
        input: node.input || initialInput,
        options: {
          timeout: node.timeout,
        },
      }

      try {
        const result = await this.orchestrator.invokeCapability(request)
        state.results.set(node.id, result)

        if (result.success) {
          state.completedNodes.push(node.id)
        } else {
          state.failedNodes.push(node.id)
          // 存储错误结果
          state.results.set(node.id, result)
        }

        return { success: true as const, nodeId: node.id, result }
      } catch (error: unknown) {
        const err = error as { message?: string }
        const errorResult: AICapabilityResponse = {
          success: false,
          error: err?.message || String(error),
          capabilityType: node.type,
          capabilityId: node.capabilityId || 'unknown',
          timestamp: Date.now(),
        }
        state.failedNodes.push(node.id)
        state.results.set(node.id, errorResult)

        return { success: false as const, nodeId: node.id, error }
      }
    })

    // 使用 Promise.allSettled 等待所有节点完成，不会因为单个失败而中断
    const results = await Promise.allSettled(promises)

    // 检查是否有失败的节点
    const errors: Array<{ nodeId: string; error: unknown }> = []
    results.forEach((settledResult, index) => {
      if (settledResult.status === 'rejected') {
        const node = workflow.nodes[index]
        errors.push({ nodeId: node?.id || 'unknown', error: settledResult.reason })
      } else if (settledResult.value.success === false) {
        errors.push({ nodeId: settledResult.value.nodeId, error: settledResult.value.error })
      }
    })

    // 根据错误处理策略决定是否抛出错误
    if (errors.length > 0) {
      const errorHandlingStrategy = workflow.errorHandling?.strategy || 'stop'

      if (errorHandlingStrategy === 'stop') {
        const errorMessages = errors
          .map(
            e => `节点 ${e.nodeId}: ${e.error instanceof Error ? e.error.message : String(e.error)}`
          )
          .join('; ')
        throw new Error(`并行执行失败: ${errorMessages}`)
      }
      // 'continue' 策略：继续执行，不抛出错误
    }
  }

  /**
   * 获取执行状态
   */
  getExecutionState(executionId: string): WorkflowExecutionState | undefined {
    return this.executions.value.get(executionId)
  }

  /**
   * 获取所有执行状态
   */
  getAllExecutions(): WorkflowExecutionState[] {
    return Array.from(this.executions.value.values())
  }

  /**
   * 暂停工作流
   */
  pauseWorkflow(executionId: string): void {
    const state = this.executions.value.get(executionId)
    if (state && state.status === 'running') {
      state.status = 'paused'
    }
  }

  /**
   * 恢复工作流
   */
  resumeWorkflow(executionId: string): void {
    const state = this.executions.value.get(executionId)
    if (state && state.status === 'paused') {
      state.status = 'running'
    }
  }
}

// 单例实例
let workflowOrchestratorInstance: AIWorkflowOrchestrator | null = null

/**
 * 获取工作流编排器实例
 */
export function getAIWorkflowOrchestrator(): AIWorkflowOrchestrator {
  if (!workflowOrchestratorInstance) {
    workflowOrchestratorInstance = new AIWorkflowOrchestrator()
  }
  return workflowOrchestratorInstance
}
