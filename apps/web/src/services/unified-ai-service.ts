/**
 * 统一 AI 编排服务（合并版）
 *
 * 合并自旧架构：
 * - services/unified-ai-orchestrator.ts
 * - services/agentic-ai.ts
 *
 * 新架构基于 fetchApi 与纯 TypeScript，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'

/* ------------------------------------------------------------------ */
/* 类型定义                                                            */
/* ------------------------------------------------------------------ */

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'coze' | 'local'

export interface ProviderConfig {
  provider: AIProvider
  model: string
  apiKey?: string
  baseUrl?: string
  enabled: boolean
  priority: number
  maxTokens?: number
  temperature?: number
}

export interface OrchestrationStep {
  id: string
  type: 'llm_call' | 'tool_call' | 'condition' | 'loop' | 'parallel' | 'wait'
  name: string
  config: Record<string, unknown>
  /** 依赖的前置步骤 */
  dependsOn: string[]
  /** 重试次数 */
  retries?: number
  /** 超时（毫秒） */
  timeoutMs?: number
}

export interface OrchestrationPlan {
  id: string
  name: string
  description: string
  steps: OrchestrationStep[]
  inputs: Record<string, unknown>
  outputs: Record<string, string>
  version: string
  createdAt: number
}

export interface OrchestrationExecution {
  id: string
  planId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  currentStepId: string | null
  stepResults: Record<string, StepResult>
  startedAt: number
  finishedAt: number | null
  error: string | null
  totalCost: number
  totalTokens: number
}

export interface StepResult {
  stepId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  output: unknown
  error?: string
  startedAt: number
  finishedAt: number | null
  tokensUsed: number
  cost: number
}

/* ------------------------------------------------------------------ */
/* Agentic AI（自主智能体）                                            */
/* ------------------------------------------------------------------ */

export interface AgenticGoal {
  id: string
  description: string
  successCriteria: string
  maxIterations: number
  availableTools: string[]
  constraints: string[]
}

export interface AgenticAction {
  id: string
  type: 'thought' | 'tool_call' | 'observation' | 'final_answer'
  content: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: unknown
  timestamp: number
}

export interface AgenticRun {
  id: string
  goalId: string
  status: 'running' | 'completed' | 'failed' | 'stopped'
  iterations: number
  actions: AgenticAction[]
  finalAnswer: string | null
  startedAt: number
  finishedAt: number | null
  totalTokens: number
  totalCost: number
}

/* ------------------------------------------------------------------ */
/* 编排核心（运行时单例）                                              */
/* ------------------------------------------------------------------ */

const providers = new Map<AIProvider, ProviderConfig>()
const plans = new Map<string, OrchestrationPlan>()
const executions = new Map<string, OrchestrationExecution>()
const agenticRuns = new Map<string, AgenticRun>()

/* ------------------------------------------------------------------ */
/* Provider 管理                                                       */
/* ------------------------------------------------------------------ */

export function registerProvider(config: ProviderConfig): void {
  providers.set(config.provider, config)
}

export function getProvider(provider: AIProvider): ProviderConfig | undefined {
  return providers.get(provider)
}

export function listProviders(): ProviderConfig[] {
  return Array.from(providers.values()).sort((a, b) => a.priority - b.priority)
}

export function selectBestProvider(): ProviderConfig | undefined {
  return listProviders().find((p) => p.enabled)
}

/* ------------------------------------------------------------------ */
/* 编排计划管理                                                        */
/* ------------------------------------------------------------------ */

export function createPlan(plan: Omit<OrchestrationPlan, 'id' | 'createdAt'>): OrchestrationPlan {
  const full: OrchestrationPlan = {
    ...plan,
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  }
  plans.set(full.id, full)
  return full
}

export function getPlan(planId: string): OrchestrationPlan | undefined {
  return plans.get(planId)
}

export function validatePlan(plan: OrchestrationPlan): {
  ok: boolean
  errors: string[]
} {
  const errors: string[] = []
  const ids = new Set(plan.steps.map((s) => s.id))
  for (const step of plan.steps) {
    for (const dep of step.dependsOn) {
      if (!ids.has(dep)) {
        errors.push(`步骤 ${step.id} 依赖不存在的步骤: ${dep}`)
      }
    }
  }
  // 检查循环依赖（简单 DFS）
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const dfs = (id: string, path: string[]): boolean => {
    if (visiting.has(id)) {
      errors.push(`检测到循环依赖: ${[...path, id].join(' -> ')}`)
      return true
    }
    if (visited.has(id)) return false
    visiting.add(id)
    const step = plan.steps.find((s) => s.id === id)
    if (step) {
      for (const dep of step.dependsOn) {
        if (dfs(dep, [...path, id])) return true
      }
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }
  for (const step of plan.steps) dfs(step.id, [])
  return { ok: errors.length === 0, errors }
}

/* ------------------------------------------------------------------ */
/* 编排执行                                                            */
/* ------------------------------------------------------------------ */

export function startExecution(
  planId: string,
  inputs: Record<string, unknown> = {},
): OrchestrationExecution | undefined {
  const plan = plans.get(planId)
  if (!plan) return undefined
  const validation = validatePlan(plan)
  if (!validation.ok) return undefined

  const execution: OrchestrationExecution = {
    id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    planId,
    status: 'pending',
    currentStepId: null,
    stepResults: {},
    startedAt: Date.now(),
    finishedAt: null,
    error: null,
    totalCost: 0,
    totalTokens: 0,
  }
  // 初始化所有步骤结果
  for (const step of plan.steps) {
    execution.stepResults[step.id] = {
      stepId: step.id,
      status: 'pending',
      output: null,
      startedAt: 0,
      finishedAt: null,
      tokensUsed: 0,
      cost: 0,
    }
  }
  // 合并输入
  Object.assign(execution.stepResults, {})
  void inputs
  executions.set(execution.id, execution)
  return execution
}

export function getExecution(executionId: string): OrchestrationExecution | undefined {
  return executions.get(executionId)
}

export function listExecutions(): OrchestrationExecution[] {
  return Array.from(executions.values()).sort((a, b) => b.startedAt - a.startedAt)
}

export function cancelExecution(executionId: string): boolean {
  const execution = executions.get(executionId)
  if (!execution || execution.status !== 'running') return false
  execution.status = 'cancelled'
  execution.finishedAt = Date.now()
  return true
}

/* ------------------------------------------------------------------ */
/* Agentic 运行                                                       */
/* ------------------------------------------------------------------ */

export function startAgenticRun(goal: AgenticGoal): AgenticRun {
  const run: AgenticRun = {
    id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    goalId: goal.id,
    status: 'running',
    iterations: 0,
    actions: [],
    finalAnswer: null,
    startedAt: Date.now(),
    finishedAt: null,
    totalTokens: 0,
    totalCost: 0,
  }
  agenticRuns.set(run.id, run)
  return run
}

export function appendAgenticAction(
  runId: string,
  action: Omit<AgenticAction, 'id' | 'timestamp'>,
): AgenticRun | undefined {
  const run = agenticRuns.get(runId)
  if (!run || run.status !== 'running') return undefined
  const full: AgenticAction = {
    ...action,
    id: `act_${run.actions.length + 1}`,
    timestamp: Date.now(),
  }
  run.actions.push(full)
  if (action.type === 'final_answer') {
    run.finalAnswer = action.content
    run.status = 'completed'
    run.finishedAt = Date.now()
  } else {
    run.iterations += 1
  }
  return run
}

export function stopAgenticRun(runId: string): boolean {
  const run = agenticRuns.get(runId)
  if (!run || run.status !== 'running') return false
  run.status = 'stopped'
  run.finishedAt = Date.now()
  return true
}

export function getAgenticRun(runId: string): AgenticRun | undefined {
  return agenticRuns.get(runId)
}

/* ------------------------------------------------------------------ */
/* 远程 API                                                            */
/* ------------------------------------------------------------------ */

export async function apiOrchestrate(input: {
  planId?: string
  prompt: string
  provider?: AIProvider
  context?: Record<string, unknown>
}): Promise<ApiResult<{ reply: string; executionId: string; tokensUsed: number }>> {
  return fetchApi<{ reply: string; executionId: string; tokensUsed: number }>('/ai/orchestrate', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function apiGetExecution(
  executionId: string,
): Promise<ApiResult<OrchestrationExecution>> {
  return fetchApi<OrchestrationExecution>(`/ai/executions/${encodeURIComponent(executionId)}`)
}

export async function apiRunAgentic(goal: AgenticGoal): Promise<ApiResult<AgenticRun>> {
  return fetchApi<AgenticRun>('/ai/agentic/run', {
    method: 'POST',
    body: JSON.stringify(goal),
  })
}

export async function apiStopAgentic(runId: string): Promise<ApiResult<{ stopped: boolean }>> {
  return fetchApi<{ stopped: boolean }>(`/ai/agentic/${encodeURIComponent(runId)}/stop`, {
    method: 'POST',
  })
}
