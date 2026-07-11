/**
 * Clawdbot 智能体平台服务（合并版）
 *
 * 合并自旧架构 services/clawdbot/ 下的 20+ 文件：
 * - gateway / channels / tools / task-executor / self-evolution
 * - message-processor / automation / browser / canvas / integrations
 * - mcp / memory / models / nodes / pairing / skills / system / voice
 *
 * 新架构基于 fetchApi（@/lib/api）与纯 TypeScript，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'

/* ------------------------------------------------------------------ */
/* 通用类型                                                            */
/* ------------------------------------------------------------------ */

export type ChannelType =
  'web' | 'api' | 'cli' | 'mobile' | 'desktop' | 'wechat' | 'dingtalk' | 'feishu'

export interface ChannelConfig {
  type: ChannelType
  enabled: boolean
  options?: Record<string, unknown>
}

export interface GatewayConfig {
  endpoint: string
  reconnectInterval?: number
  heartbeatInterval?: number
  token?: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters?: Record<string, unknown>
  handler?: (input: Record<string, unknown>) => Promise<unknown>
}

export interface ToolExecutionResult {
  ok: boolean
  data?: unknown
  error?: string
  durationMs: number
}

export interface IntentAnalysis {
  intent: string
  confidence: number
  entities: Record<string, unknown>
}

export interface ProcessedMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  intent?: IntentAnalysis
  toolCalls?: Array<{ name: string; result: ToolExecutionResult }>
  timestamp: number
}

export interface Task {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority: number
  payload?: Record<string, unknown>
  createdAt: number
  startedAt?: number
  finishedAt?: number
  result?: unknown
  error?: string
}

export interface TaskResult {
  taskId: string
  ok: boolean
  data?: unknown
  error?: string
}

export interface SkillInstallation {
  skillId: string
  version: string
  installedAt: number
  enabled: boolean
}

export interface MemoryRecord {
  id: string
  scope: 'user' | 'session' | 'global'
  key: string
  value: unknown
  ttl?: number
  createdAt: number
}

export interface NodeDefinition {
  id: string
  type: string
  inputs: string[]
  outputs: string[]
  config?: Record<string, unknown>
}

export interface ClawdbotStatus {
  initialized: boolean
  gateway: { connected: boolean; activeChannels: number }
  tools: { registered: number; available: string[] }
  tasks: { total: number; running: number; completed: number; failed: number }
  evolution: { skills: number; gaps: number; autoEvolve: boolean }
  messages: { contexts: number; queued: number }
}

export interface ClawdbotConfig {
  gateway?: Partial<GatewayConfig>
  channels?: ChannelConfig[]
  autoEvolve?: boolean
  ai?: {
    provider: 'openai' | 'anthropic' | 'gemini' | 'local'
    model: string
    apiKey?: string
    baseUrl?: string
  }
  user?: { id: string; name?: string; preferences?: Record<string, unknown> }
}

/* ------------------------------------------------------------------ */
/* 内部运行时（模块级单例）                                            */
/* ------------------------------------------------------------------ */

const tools = new Map<string, ToolDefinition>()
const tasks = new Map<string, Task>()
const memories: MemoryRecord[] = []
const skills = new Map<string, SkillInstallation>()
const messageQueue: ProcessedMessage[] = []

let gatewayConfig: GatewayConfig | null = null
let channelsConfig: ChannelConfig[] = []
let autoEvolve = false

/* ------------------------------------------------------------------ */
/* 工具注册与执行（tools/extended-tools 合并）                         */
/* ------------------------------------------------------------------ */

export function registerTool(tool: ToolDefinition): void {
  tools.set(tool.name, tool)
}

export function unregisterTool(name: string): boolean {
  return tools.delete(name)
}

export function listTools(): ToolDefinition[] {
  return Array.from(tools.values())
}

export async function executeTool(
  name: string,
  input: Record<string, unknown> = {},
): Promise<ToolExecutionResult> {
  const tool = tools.get(name)
  const start = Date.now()
  if (!tool?.handler) {
    return { ok: false, error: `工具未注册: ${name}`, durationMs: 0 }
  }
  try {
    const data = await tool.handler(input)
    return { ok: true, data, durationMs: Date.now() - start }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    }
  }
}

/* ------------------------------------------------------------------ */
/* 任务执行器（task-executor）                                          */
/* ------------------------------------------------------------------ */

export function createTask(name: string, payload?: Record<string, unknown>, priority = 0): Task {
  const task: Task = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    status: 'pending',
    priority,
    payload,
    createdAt: Date.now(),
  }
  tasks.set(task.id, task)
  return task
}

export async function runTask(taskId: string): Promise<TaskResult> {
  const task = tasks.get(taskId)
  if (!task) return { taskId, ok: false, error: '任务不存在' }
  if (task.status === 'running') return { taskId, ok: false, error: '任务已在运行' }

  task.status = 'running'
  task.startedAt = Date.now()
  try {
    // 任务执行实际由调用方通过 payload 中的 toolName 触发
    const toolName = (task.payload?.toolName as string) ?? ''
    const input = (task.payload?.input as Record<string, unknown>) ?? {}
    const result: ToolExecutionResult = toolName
      ? await executeTool(toolName, input)
      : { ok: true, data: undefined, error: undefined, durationMs: 0 }
    task.status = result.ok ? 'completed' : 'failed'
    task.result = result.data
    task.error = result.error
    task.finishedAt = Date.now()
    return { taskId, ok: result.ok, data: result.data, error: result.error }
  } catch (err) {
    task.status = 'failed'
    task.error = err instanceof Error ? err.message : String(err)
    task.finishedAt = Date.now()
    return { taskId, ok: false, error: task.error }
  }
}

export function getTask(taskId: string): Task | undefined {
  return tasks.get(taskId)
}

export function listTasks(): Task[] {
  return Array.from(tasks.values()).sort((a, b) => b.createdAt - a.createdAt)
}

export function cancelTask(taskId: string): boolean {
  const task = tasks.get(taskId)
  if (!task || task.status !== 'running') return false
  task.status = 'cancelled'
  task.finishedAt = Date.now()
  return true
}

/* ------------------------------------------------------------------ */
/* 消息处理（message-processor）                                       */
/* ------------------------------------------------------------------ */

export function analyzeIntent(text: string): IntentAnalysis {
  const lower = text.toLowerCase()
  let intent = 'unknown'
  if (/^(你好|hi|hello|嗨)/.test(lower)) intent = 'greeting'
  else if (/帮助|help|怎么用/.test(lower)) intent = 'help'
  else if (/运行|执行|跑一下/.test(lower)) intent = 'execute'
  else if (/查询|查一下|search/.test(lower)) intent = 'query'
  return {
    intent,
    confidence: intent === 'unknown' ? 0.2 : 0.85,
    entities: {},
  }
}

export function processMessage(role: ProcessedMessage['role'], content: string): ProcessedMessage {
  const msg: ProcessedMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    intent: role === 'user' ? analyzeIntent(content) : undefined,
    timestamp: Date.now(),
  }
  messageQueue.push(msg)
  return msg
}

export function getMessages(limit = 50): ProcessedMessage[] {
  return messageQueue.slice(-limit)
}

/* ------------------------------------------------------------------ */
/* 记忆管理（memory）                                                  */
/* ------------------------------------------------------------------ */

export function setMemory(
  scope: MemoryRecord['scope'],
  key: string,
  value: unknown,
  ttl?: number,
): MemoryRecord {
  const record: MemoryRecord = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    scope,
    key,
    value,
    ttl,
    createdAt: Date.now(),
  }
  const idx = memories.findIndex((m) => m.scope === scope && m.key === key)
  if (idx >= 0) memories[idx] = record
  else memories.push(record)
  return record
}

export function getMemory(scope: MemoryRecord['scope'], key: string): unknown {
  const record = memories.find((m) => m.scope === scope && m.key === key)
  if (!record) return undefined
  if (record.ttl && Date.now() - record.createdAt > record.ttl) return undefined
  return record.value
}

export function clearMemory(scope?: MemoryRecord['scope']): number {
  if (!scope) {
    const n = memories.length
    memories.length = 0
    return n
  }
  const before = memories.length
  for (let i = memories.length - 1; i >= 0; i--) {
    if (memories[i]?.scope === scope) memories.splice(i, 1)
  }
  return before - memories.length
}

/* ------------------------------------------------------------------ */
/* 技能 / 自我进化（skills / self-evolution）                          */
/* ------------------------------------------------------------------ */

export function installSkill(skillId: string, version: string): SkillInstallation {
  const installation: SkillInstallation = {
    skillId,
    version,
    installedAt: Date.now(),
    enabled: true,
  }
  skills.set(skillId, installation)
  return installation
}

export function uninstallSkill(skillId: string): boolean {
  return skills.delete(skillId)
}

export function listSkills(): SkillInstallation[] {
  return Array.from(skills.values())
}

export function detectSkillGaps(intents: IntentAnalysis[]): string[] {
  const known = new Set(intents.map((i) => i.intent))
  const required = ['greeting', 'help', 'execute', 'query']
  return required.filter((r) => !known.has(r))
}

/* ------------------------------------------------------------------ */
/* 网关与渠道（gateway / channels）                                    */
/* ------------------------------------------------------------------ */

export function configureGateway(config: GatewayConfig): void {
  gatewayConfig = config
}

export function getGatewayConfig(): GatewayConfig | null {
  return gatewayConfig
}

export function configureChannels(config: ChannelConfig[]): void {
  channelsConfig = config
}

export function getActiveChannels(): ChannelConfig[] {
  return channelsConfig.filter((c) => c.enabled)
}

/* ------------------------------------------------------------------ */
/* 节点编排（nodes）                                                   */
/* ------------------------------------------------------------------ */

export function validateNodes(nodes: NodeDefinition[]): {
  ok: boolean
  missing: string[]
} {
  const ids = new Set(nodes.map((n) => n.id))
  const missing: string[] = []
  for (const node of nodes) {
    for (const dep of node.inputs) {
      if (!ids.has(dep)) missing.push(`${node.id}<-${dep}`)
    }
  }
  return { ok: missing.length === 0, missing }
}

/* ------------------------------------------------------------------ */
/* 初始化与状态                                                        */
/* ------------------------------------------------------------------ */

export function initClawdbot(config: ClawdbotConfig): ClawdbotStatus {
  if (config.gateway) configureGateway(config.gateway as GatewayConfig)
  if (config.channels) configureChannels(config.channels)
  autoEvolve = config.autoEvolve ?? false
  return getStatus()
}

export function getStatus(): ClawdbotStatus {
  const taskList = listTasks()
  return {
    initialized: gatewayConfig !== null,
    gateway: {
      connected: gatewayConfig !== null,
      activeChannels: getActiveChannels().length,
    },
    tools: {
      registered: tools.size,
      available: Array.from(tools.keys()),
    },
    tasks: {
      total: taskList.length,
      running: taskList.filter((t) => t.status === 'running').length,
      completed: taskList.filter((t) => t.status === 'completed').length,
      failed: taskList.filter((t) => t.status === 'failed').length,
    },
    evolution: {
      skills: skills.size,
      gaps: 0,
      autoEvolve,
    },
    messages: {
      contexts: 1,
      queued: messageQueue.length,
    },
  }
}

/* ------------------------------------------------------------------ */
/* 远程 API（gateway 真实后端调用）                                     */
/* ------------------------------------------------------------------ */

export async function apiClawdbotInvoke(input: {
  message: string
  context?: Record<string, unknown>
}): Promise<ApiResult<{ reply: string; metadata?: Record<string, unknown> }>> {
  return fetchApi<{ reply: string; metadata?: Record<string, unknown> }>('/clawdbot/invoke', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function apiClawdbotStatus(): Promise<ApiResult<ClawdbotStatus>> {
  return fetchApi<ClawdbotStatus>('/clawdbot/status')
}

export async function apiClawdbotInstallSkill(
  skillId: string,
  version: string,
): Promise<ApiResult<SkillInstallation>> {
  return fetchApi<SkillInstallation>('/clawdbot/skills/install', {
    method: 'POST',
    body: JSON.stringify({ skillId, version }),
  })
}
