/**
 * OpenClaw AI Agent API
 * 
 * 与后端 OpenClaw 服务对接的完整 API
 * 
 * 功能模块:
 * - Gateway: WebSocket 网关管理
 * - Channels: 多渠道消息接入
 * - Tools: 工具执行系统
 * - Skills: 技能管理
 * - Tasks: 任务执行
 * - Automation: 自动化任务
 * - Sessions: 会话管理
 * - Agents: 代理管理
 * - Memory: 记忆系统
 * - Evolution: 自我进化
 * - Nodes: 节点管理
 */

import { OPENCLAW_PATHS } from '@/config/backend-paths'
import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'

// ==================== Types ====================

// Gateway
export interface GatewayStatus {
  running: boolean
  uptimeMs: number
  connectedClients: number
  activeChannels: number
  version: string
  lastHeartbeat: number
}

export interface GatewayHealth {
  healthy: boolean
  status: 'healthy' | 'degraded' | 'unhealthy'
  components: Record<string, ComponentHealth>
  checkTime: number
}

export interface ComponentHealth {
  healthy: boolean
  status: string
  message?: string
  responseTimeMs: number
}

export interface GatewayConfig {
  port: number
  bindAddress: string
  verbose: boolean
  authEnabled: boolean
  enabled: boolean
  options?: Record<string, unknown>
  updateTime: number
}

// Channels
export interface ChannelType {
  type: string
  name: string
  description: string
  icon: string
  requiredCredentials: string[]
  available: boolean
}

export interface ChannelConfig {
  id: string
  type: string
  name: string
  enabled: boolean
  connected: boolean
  lastActivity?: number
  messageCount: number
  createTime: number
  updateTime: number
}

export interface ChannelStatus {
  channelId: string
  connected: boolean
  status: string
  connectedAt?: number
  error?: string
}

export interface SendMessage {
  content: string
  conversationId?: string
  userId?: string
  messageType?: 'text' | 'image' | 'audio' | 'video' | 'file'
  attachments?: Attachment[]
  replyTo?: string
  metadata?: Record<string, unknown>
}

export interface Attachment {
  type: string
  name: string
  url?: string
  mimeType: string
  size?: number
}

export interface MessageResult {
  messageId: string
  success: boolean
  timestamp: number
  error?: string
}

// Tools
export interface ToolDefinition {
  name: string
  description: string
  category: 'browser' | 'filesystem' | 'shell' | 'api' | 'data' | 'email' | 'calendar' | 'code' | 'custom'
  parameters?: Record<string, unknown>
  dangerous?: boolean
  requiresConfirmation?: boolean
  timeout?: number
  builtin?: boolean
}

export interface ToolExecutionResult {
  success: boolean
  data?: any
  error?: string
  executionTime: number
  output?: string
  attachments?: Attachment[]
}

// Skills
export interface Skill {
  id: string
  name: string
  description: string
  version: string
  category: string
  tags: string[]
  author: string
  downloads: number
  rating: number
  createTime: number
  updateTime: number
}

export interface SkillInstallation {
  skillId: string
  skillName: string
  version: string
  installedAt: number
  enabled: boolean
  config?: Record<string, unknown>
}

// Tasks
export interface Task {
  id: string
  name: string
  description?: string
  status: 'pending' | 'planning' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  steps: TaskStep[]
  result?: any
  error?: string
  createTime: number
  startTime?: number
  endTime?: number
}

export interface TaskStep {
  id: string
  name: string
  status: string
  result?: any
  error?: string
  startTime?: number
  endTime?: number
}

// Automation
export interface CronJob {
  id: string
  name: string
  schedule: string
  task: string
  enabled: boolean
  lastRun?: number
  nextRun?: number
  runCount: number
  timezone?: string
  createTime: number
}

export interface WebhookConfig {
  id: string
  name: string
  endpoint: string
  events: string[]
  enabled: boolean
  lastTriggered?: number
  triggerCount: number
  createTime: number
}

export interface HookConfig {
  id: string
  type: string
  name: string
  priority: number
  enabled: boolean
  createTime: number
}

// Sessions
export interface Session {
  id: string
  channelId: string
  channelType: string
  userId: string
  status: 'active' | 'ended' | 'expired'
  messageCount: number
  createTime: number
  lastActivity: number
  endTime?: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  messageType: string
  attachments?: Attachment[]
  timestamp: number
  metadata?: Record<string, unknown>
}

// Agents
export interface AgentResponse {
  runId: string
  sessionId: string
  response: string
  status: 'accepted' | 'running' | 'completed' | 'failed'
  toolCalls?: ToolCall[]
  startTime: number
  endTime?: number
  tokenUsage?: TokenUsage
}

export interface ToolCall {
  toolName: string
  params: Record<string, unknown>
  result?: any
  success: boolean
  executionTime: number
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface AgentStatus {
  active: boolean
  activeSessions: number
  pendingTasks: number
  currentModel: string
  lastActivity: number
}

export interface SubAgent {
  id: string
  name: string
  task: string
  status: string
  tools: string[]
  createTime: number
  endTime?: number
}

// Memory
export interface Memory {
  id: string
  content: string
  type: string
  tags?: string[]
  relevance?: number
  createTime: number
  metadata?: Record<string, unknown>
}

export interface MemoryContext {
  memories: Memory[]
  summary: string
  totalMemories: number
  lastUpdate: number
}

// Evolution
export interface EvolutionAnalysis {
  gaps: CapabilityGap[]
  recommendations: string[]
  priority: number
}

export interface CapabilityGap {
  description: string
  category: string
  severity: number
  suggestedSkills: string[]
}

export interface GeneratedSkill {
  id: string
  name: string
  description: string
  code: string
  tested: boolean
  installed: boolean
  generateTime: number
}

// Nodes
export interface Node {
  id: string
  name: string
  platform: string
  deviceFamily?: string
  paired: boolean
  connected: boolean
  capabilities: string[]
  lastSeen: number
}

export interface NodePairing {
  nodeId: string
  pairingCode: string
  status: 'pending' | 'approved' | 'rejected' | 'verified'
  expiresAt: number
}

// Statistics
export interface UsageStats {
  totalMessages: number
  totalToolCalls: number
  totalTasks: number
  messagesByChannel: Record<string, number>
  toolCallsByTool: Record<string, number>
  dailyStats: DailyStats[]
}

export interface DailyStats {
  date: string
  messages: number
  toolCalls: number
  tasks: number
  tokens: number
}

export interface TokenStats {
  totalTokens: number
  promptTokens: number
  completionTokens: number
  tokensByModel: Record<string, number>
  dailyStats: DailyTokenStats[]
  estimatedCost: number
}

export interface DailyTokenStats {
  date: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
}

// ==================== Gateway API ====================

export async function getGatewayStatus(): Promise<ApiResponse<GatewayStatus>> {
  return request.get(OPENCLAW_PATHS.gateway.status)
}

export async function getGatewayHealth(): Promise<ApiResponse<GatewayHealth>> {
  return request.get(OPENCLAW_PATHS.gateway.health)
}

export async function getGatewayConfig(): Promise<ApiResponse<GatewayConfig>> {
  return request.get(OPENCLAW_PATHS.gateway.config)
}

export async function updateGatewayConfig(config: Partial<GatewayConfig>): Promise<ApiResponse<GatewayConfig>> {
  return request.put(OPENCLAW_PATHS.gateway.config, config)
}

export async function restartGateway(): Promise<ApiResponse<void>> {
  return request.post(OPENCLAW_PATHS.gateway.restart)
}

// ==================== Channels API ====================

export async function getSupportedChannels(): Promise<ApiResponse<ChannelType[]>> {
  return request.get(OPENCLAW_PATHS.channels.supported)
}

export async function getChannels(): Promise<ApiResponse<ChannelConfig[]>> {
  return request.get(OPENCLAW_PATHS.channels.list)
}

export async function getChannel(channelId: string): Promise<ApiResponse<ChannelConfig>> {
  return request.get(OPENCLAW_PATHS.channels.byId(channelId))
}

export async function createChannel(config: {
  type: string
  name: string
  credentials?: Record<string, string>
  options?: Record<string, unknown>
  enabled?: boolean
}): Promise<ApiResponse<ChannelConfig>> {
  return request.post(OPENCLAW_PATHS.channels.list, config)
}

export async function updateChannel(channelId: string, config: Partial<{
  name: string
  credentials: Record<string, string>
  options: Record<string, unknown>
  enabled: boolean
}>): Promise<ApiResponse<ChannelConfig>> {
  return request.put(OPENCLAW_PATHS.channels.byId(channelId), config)
}

export async function deleteChannel(channelId: string): Promise<ApiResponse<void>> {
  return request.delete(OPENCLAW_PATHS.channels.byId(channelId))
}

export async function connectChannel(channelId: string): Promise<ApiResponse<ChannelStatus>> {
  return request.post(OPENCLAW_PATHS.channels.connect(channelId))
}

export async function disconnectChannel(channelId: string): Promise<ApiResponse<void>> {
  return request.post(OPENCLAW_PATHS.channels.disconnect(channelId))
}

export async function sendChannelMessage(channelId: string, message: SendMessage): Promise<ApiResponse<MessageResult>> {
  return request.post(OPENCLAW_PATHS.channels.send(channelId), message)
}

/**
 * 获取频道类型（getSupportedChannels 的别名）
 */
export const getChannelTypes = getSupportedChannels

/**
 * 获取频道状态
 */
export async function getChannelStatus(channelId: string): Promise<ApiResponse<ChannelStatus>> {
  return request.get(OPENCLAW_PATHS.channels.status(channelId))
}

/**
 * 发送消息（sendChannelMessage 的别名）
 */
export const sendMessage = sendChannelMessage

// ==================== Tools API ====================

export async function getTools(category?: string): Promise<ApiResponse<ToolDefinition[]>> {
  return request.get(OPENCLAW_PATHS.tools.list, { params: { category } })
}

export async function getTool(toolName: string): Promise<ApiResponse<ToolDefinition>> {
  return request.get(OPENCLAW_PATHS.tools.byName(toolName))
}

export async function executeTool(toolName: string, params: Record<string, unknown>): Promise<ApiResponse<ToolExecutionResult>> {
  return request.post(OPENCLAW_PATHS.tools.execute(toolName), params)
}

export async function registerTool(tool: Omit<ToolDefinition, 'builtin'>): Promise<ApiResponse<ToolDefinition>> {
  return request.post(OPENCLAW_PATHS.tools.register, tool)
}

export async function unregisterTool(toolName: string): Promise<ApiResponse<void>> {
  return request.delete(OPENCLAW_PATHS.tools.byName(toolName))
}

// ==================== Skills API ====================

export async function getSkills(params?: PaginationParams & {
  category?: string
  search?: string
}): Promise<ApiResponse<PaginationResponse<Skill>>> {
  return request.get(OPENCLAW_PATHS.skills.list, { params })
}

export async function getSkill(skillId: string): Promise<ApiResponse<Skill>> {
  return request.get(OPENCLAW_PATHS.skills.byId(skillId))
}

export async function installSkill(skillId: string): Promise<ApiResponse<SkillInstallation>> {
  return request.post(OPENCLAW_PATHS.skills.install(skillId))
}

export async function uninstallSkill(skillId: string): Promise<ApiResponse<void>> {
  return request.delete(OPENCLAW_PATHS.skills.uninstall(skillId))
}

export async function getInstalledSkills(): Promise<ApiResponse<SkillInstallation[]>> {
  return request.get(OPENCLAW_PATHS.skills.installed)
}

export async function publishSkill(skill: {
  name: string
  description: string
  version: string
  category: string
  tags: string[]
  code: string
  config?: Record<string, unknown>
  dependencies?: string[]
  readme?: string
}): Promise<ApiResponse<Skill>> {
  return request.post(OPENCLAW_PATHS.skills.publish, skill)
}

// ==================== Tasks API ====================

export async function createTask(task: {
  name: string
  description?: string
  goal?: string
  steps?: string[]
  priority?: number
  timeout?: number
  context?: Record<string, unknown>
  tools?: string[]
}): Promise<ApiResponse<Task>> {
  return request.post(OPENCLAW_PATHS.tasks.list, task)
}

export async function getTasks(params?: PaginationParams & {
  status?: string
}): Promise<ApiResponse<PaginationResponse<Task>>> {
  return request.get(OPENCLAW_PATHS.tasks.list, { params })
}

export async function getTask(taskId: string): Promise<ApiResponse<Task>> {
  return request.get(OPENCLAW_PATHS.tasks.byId(taskId))
}

export async function cancelTask(taskId: string): Promise<ApiResponse<Task>> {
  return request.post(OPENCLAW_PATHS.tasks.cancel(taskId))
}

export async function retryTask(taskId: string): Promise<ApiResponse<Task>> {
  return request.post(OPENCLAW_PATHS.tasks.retry(taskId))
}

/**
 * 执行任务
 */
export async function executeTask(taskId: string): Promise<ApiResponse<Task>> {
  return request.post(OPENCLAW_PATHS.tasks.execute(taskId))
}

// ==================== Automation API ====================

// Cron Jobs
export async function getCronJobs(): Promise<ApiResponse<CronJob[]>> {
  return request.get(OPENCLAW_PATHS.automation.cron)
}

export async function createCronJob(cronJob: {
  name: string
  schedule: string
  task: string
  enabled?: boolean
  timezone?: string
  maxRuns?: number
  metadata?: Record<string, unknown>
}): Promise<ApiResponse<CronJob>> {
  return request.post(OPENCLAW_PATHS.automation.cron, cronJob)
}

export async function updateCronJob(cronId: string, cronJob: Partial<{
  name: string
  schedule: string
  task: string
  enabled: boolean
  timezone: string
  maxRuns: number
  metadata: Record<string, unknown>
}>): Promise<ApiResponse<CronJob>> {
  return request.put(OPENCLAW_PATHS.automation.cronById(cronId), cronJob)
}

export async function deleteCronJob(cronId: string): Promise<ApiResponse<void>> {
  return request.delete(OPENCLAW_PATHS.automation.cronById(cronId))
}

// Webhooks
export async function getWebhooks(): Promise<ApiResponse<WebhookConfig[]>> {
  return request.get(OPENCLAW_PATHS.automation.webhooks)
}

export async function createWebhook(webhook: {
  name: string
  endpoint: string
  secret?: string
  events: string[]
  enabled?: boolean
}): Promise<ApiResponse<WebhookConfig>> {
  return request.post(OPENCLAW_PATHS.automation.webhooks, webhook)
}

export async function updateWebhook(webhookId: string, webhook: Partial<{
  name: string
  endpoint: string
  secret: string
  events: string[]
  enabled: boolean
}>): Promise<ApiResponse<WebhookConfig>> {
  return request.put(OPENCLAW_PATHS.automation.webhookById(webhookId), webhook)
}

export async function deleteWebhook(webhookId: string): Promise<ApiResponse<void>> {
  return request.delete(OPENCLAW_PATHS.automation.webhookById(webhookId))
}

export async function triggerWebhook(webhookId: string, payload: any): Promise<ApiResponse<{
  success: boolean
  webhookId: string
  processedAt: number
  error?: string
}>> {
  return request.post(OPENCLAW_PATHS.automation.webhookTrigger(webhookId), payload)
}

// Hooks
export async function getHooks(): Promise<ApiResponse<HookConfig[]>> {
  return request.get(OPENCLAW_PATHS.automation.hooks)
}

export async function registerHook(hook: {
  type: string
  name: string
  handler: string
  priority?: number
  enabled?: boolean
}): Promise<ApiResponse<HookConfig>> {
  return request.post(OPENCLAW_PATHS.automation.hooks, hook)
}

export async function deleteHook(hookId: string): Promise<ApiResponse<void>> {
  return request.delete(OPENCLAW_PATHS.automation.hookById(hookId))
}

// ==================== Sessions API ====================

export async function getSessions(params?: PaginationParams & {
  channelId?: string
}): Promise<ApiResponse<PaginationResponse<Session>>> {
  return request.get(OPENCLAW_PATHS.sessions.list, { params })
}

export async function getSession(sessionId: string): Promise<ApiResponse<Session>> {
  return request.get(OPENCLAW_PATHS.sessions.byId(sessionId))
}

export async function getSessionMessages(sessionId: string, params?: PaginationParams): Promise<ApiResponse<PaginationResponse<Message>>> {
  return request.get(OPENCLAW_PATHS.sessions.messages(sessionId), { params })
}

export async function endSession(sessionId: string): Promise<ApiResponse<void>> {
  return request.post(OPENCLAW_PATHS.sessions.end(sessionId))
}

export async function deleteSession(sessionId: string): Promise<ApiResponse<void>> {
  return request.delete(OPENCLAW_PATHS.sessions.byId(sessionId))
}

// ==================== Agents API ====================

export async function sendAgentMessage(message: {
  message: string
  sessionId?: string
  channelId?: string
  attachments?: Attachment[]
  context?: Record<string, unknown>
  stream?: boolean
}): Promise<ApiResponse<AgentResponse>> {
  return request.post(OPENCLAW_PATHS.agents.message, message)
}

export async function getAgentStatus(): Promise<ApiResponse<AgentStatus>> {
  return request.get(OPENCLAW_PATHS.agents.status)
}

export async function createSubAgent(subAgent: {
  name: string
  task: string
  tools?: string[]
  timeout?: number
  context?: Record<string, unknown>
}): Promise<ApiResponse<SubAgent>> {
  return request.post(OPENCLAW_PATHS.agents.subagent, subAgent)
}

export async function getSubAgents(): Promise<ApiResponse<SubAgent[]>> {
  return request.get(OPENCLAW_PATHS.agents.subagents)
}

// ==================== Memory API ====================

export async function saveMemory(memory: {
  content: string
  type: string
  sessionId?: string
  metadata?: Record<string, unknown>
  tags?: string[]
}): Promise<ApiResponse<Memory>> {
  return request.post(OPENCLAW_PATHS.memory.create, memory)
}

export async function searchMemory(query: string, limit?: number): Promise<ApiResponse<Memory[]>> {
  return request.get(OPENCLAW_PATHS.memory.search, { params: { query, limit } })
}

export async function getMemoryContext(sessionId?: string): Promise<ApiResponse<MemoryContext>> {
  return request.get(OPENCLAW_PATHS.memory.context, { params: { sessionId } })
}

export async function clearMemory(sessionId?: string): Promise<ApiResponse<void>> {
  return request.delete(OPENCLAW_PATHS.memory.delete, { params: { sessionId } })
}

// ==================== Evolution API ====================

export async function analyzeCapabilityGap(data: {
  description: string
  failedTasks?: string[]
  context?: Record<string, unknown>
}): Promise<ApiResponse<EvolutionAnalysis>> {
  return request.post(OPENCLAW_PATHS.evolution.analyze, data)
}

export async function generateSkill(data: {
  name: string
  description: string
  capability: string
  examples?: string[]
  constraints?: Record<string, unknown>
}): Promise<ApiResponse<GeneratedSkill>> {
  return request.post(OPENCLAW_PATHS.evolution.generate, data)
}

export async function getEvolutionHistory(params?: PaginationParams): Promise<ApiResponse<{
  id: string
  type: string
  description: string
  status: string
  result?: any
  timestamp: number
}[]>> {
  return request.get(OPENCLAW_PATHS.evolution.history, { params })
}

// ==================== Nodes API ====================

export async function getNodes(): Promise<ApiResponse<Node[]>> {
  return request.get(OPENCLAW_PATHS.nodes.list)
}

export async function pairNode(data: {
  nodeId: string
  pairingCode: string
  deviceName?: string
  platform?: string
}): Promise<ApiResponse<NodePairing>> {
  return request.post(OPENCLAW_PATHS.nodes.pair, data)
}

export async function unpairNode(nodeId: string): Promise<ApiResponse<void>> {
  return request.delete(OPENCLAW_PATHS.nodes.unpair(nodeId))
}

export async function invokeNode(nodeId: string, data: {
  command: string
  params?: Record<string, unknown>
  timeout?: number
}): Promise<ApiResponse<{
  success: boolean
  result?: any
  error?: string
  executionTime: number
}>> {
  return request.post(OPENCLAW_PATHS.nodes.invoke(nodeId), data)
}

// ==================== Statistics API ====================

export async function getUsageStats(params?: {
  startDate?: string
  endDate?: string
}): Promise<ApiResponse<UsageStats>> {
  return request.get(OPENCLAW_PATHS.stats.usage, { params })
}

export async function getTokenStats(params?: {
  startDate?: string
  endDate?: string
}): Promise<ApiResponse<TokenStats>> {
  return request.get(OPENCLAW_PATHS.stats.tokens, { params })
}
