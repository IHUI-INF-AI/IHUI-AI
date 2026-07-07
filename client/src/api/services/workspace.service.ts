/**
 * Workspace API Service
 * 工作区文件系统访问层 — 对接后端 /api/v1/workspace/*
 *
 * 提供本地文件夹浏览/打开/最近列表/文件读写/Agent 对话等能力。
 * 对标 Claude Code / Codex 的工作区管理。
 */

import { request } from '@/utils/request'
import type { AxiosResponse } from 'axios'

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface DirEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  modified: number
}

export interface WorkspaceMeta {
  path: string
  name: string
  tech_stack: string[]
  git_branch: string | null
  git_status: string | null
  file_count: number
  last_opened: number
}

export interface RecentWorkspace {
  path: string
  name: string
  last_opened: number
  tech_stack: string[]
}

export interface TreeNode {
  name: string
  path: string
  is_dir: boolean
  children: TreeNode[]
}

export interface FileContent {
  content: string
  success: boolean
  error: string | null
}

export interface ToolResult {
  output: string
  success: boolean
  error: string | null
}

export interface SkillInfo {
  name: string
  description: string
  disable_model_invocation: boolean
  allowed_tools: string[] | null
  context: string
  model: string | null
}

export interface HookInfo {
  event: string
  matcher: string
  type: string
  command: string | null
  url: string | null
}

export interface ProjectMemory {
  project_memory: string
  user_memory: string
  rules: Array<{ file: string; paths: string[]; content: string }>
  files: string[]
}

// Agent WebSocket 事件
export interface AgentEvent {
  type: string
  content?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  output?: string
  error?: string
  success?: boolean
  iteration?: number
  workspace?: string
  model?: string
  tools?: string[]
  finish_reason?: string
  message?: string
  iterations?: number
  /** agent.tool.confirm 事件携带: 为什么需要用户确认 */
  reason?: string
  /** agent.todo.update 事件携带: 任务清单 (供 TaskListPanel 渲染) */
  todos?: Array<{
    content: string
    status: 'pending' | 'in_progress' | 'completed'
    priority?: 'high' | 'medium' | 'low'
  }>
  /** agent.command.result / agent.command.handled 事件携带: 命令名 + 附带数据 */
  command?: string
  commands?: Array<{ name: string; description: string; category: string }>
  /** agent.usage 事件携带: 单轮 token 用量 (对标 Codex/Gemini) */
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    iterations?: number
  }
  /** agent.usage 事件携带: 累计 token 用量 */
  total?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    iterations?: number
  }
  /** agent.done 事件携带: 最终用量汇总 */
  finalUsage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    iterations: number
  }
  /** agent.plan.proposed 事件携带: Plan 模式提交的完整计划 */
  plan?: unknown
  /** agent.command.handled 事件携带: 状态修改字段 */
  modify?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Token 用量信息 (对标 Codex/Gemini 用量追踪)
// ---------------------------------------------------------------------------

export interface UsageInfo {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  iterations: number
}

// ---------------------------------------------------------------------------
// Checkpoint 信息 (对标 Aider git revert / Gemini checkpointing)
// ---------------------------------------------------------------------------

export interface CheckpointInfo {
  id: string
  timestamp: number
  tool: string
  description: string
  files: string[]
  applied: boolean
}

// ---------------------------------------------------------------------------
// API 基础路径
// ---------------------------------------------------------------------------

const BASE = '/api/v1/workspace'

// ---------------------------------------------------------------------------
// Slash 命令 (对标 Claude Code / Codex / Trae)
// ---------------------------------------------------------------------------

export interface SlashCommandInfo {
  name: string
  description: string
  category: string
}

/** 拉取所有内置 slash 命令 — 供 SlashCommandPalette 启动时加载 */
export async function getSlashCommands(): Promise<SlashCommandInfo[]> {
  const resp = await request.get(`${BASE}/commands`)
  return resp.data?.data?.commands ?? []
}

// ---------------------------------------------------------------------------
// 文件系统 API
// ---------------------------------------------------------------------------

/** 浏览目录 */
export async function browseDirectory(path?: string): Promise<DirEntry[]> {
  const resp = await request.post(`${BASE}/browse`, { path: path ?? null })
  return resp.data?.data ?? []
}

/** 打开工作区 */
export async function openWorkspace(path: string, name?: string): Promise<WorkspaceMeta> {
  const resp = await request.post(`${BASE}/open`, { path, name })
  return resp.data?.data
}

/** 获取最近工作区列表 */
export async function getRecentWorkspaces(): Promise<RecentWorkspace[]> {
  const resp = await request.get(`${BASE}/recent`)
  return resp.data?.data ?? []
}

/** 获取工作区元数据 */
export async function getWorkspaceMeta(path: string): Promise<WorkspaceMeta> {
  const resp = await request.get(`${BASE}/meta`, { params: { path } })
  return resp.data?.data
}

/** 获取目录树 */
export async function getDirectoryTree(path: string, depth = 2): Promise<TreeNode> {
  const resp = await request.get(`${BASE}/tree`, { params: { path, depth } })
  return resp.data?.data
}

/** 读取文件 */
export async function readFile(workspacePath: string, path: string, startLine?: number, endLine?: number): Promise<FileContent> {
  const resp = await request.post(`${BASE}/read`, { workspace_path: workspacePath, path, start_line: startLine, end_line: endLine })
  return resp.data?.data
}

/** 写入文件 */
export async function writeFile(workspacePath: string, path: string, content: string): Promise<ToolResult> {
  const resp = await request.post(`${BASE}/write`, { workspace_path: workspacePath, path, content })
  return resp.data?.data
}

/** 编辑文件 (search/replace) */
export async function editFile(workspacePath: string, path: string, oldText: string, newText: string): Promise<ToolResult> {
  const resp = await request.post(`${BASE}/edit`, { workspace_path: workspacePath, path, old_text: oldText, new_text: newText })
  return resp.data?.data
}

/** 删除文件 */
export async function deleteFile(workspacePath: string, path: string, recursive = false): Promise<ToolResult> {
  const resp = await request.post(`${BASE}/delete`, { workspace_path: workspacePath, path, recursive })
  return resp.data?.data
}

/** grep 搜索 */
export async function grepFiles(
  workspacePath: string,
  path: string,
  pattern: string,
  glob?: string,
  outputMode: 'content' | 'files_with_matches' | 'count' = 'content',
): Promise<ToolResult> {
  const resp = await request.post(`${BASE}/grep`, { workspace_path: workspacePath, path, pattern, glob, output_mode: outputMode })
  return resp.data?.data
}

/** glob 匹配 */
export async function globFiles(workspacePath: string, path: string, pattern: string): Promise<ToolResult> {
  const resp = await request.post(`${BASE}/glob`, { workspace_path: workspacePath, path, pattern })
  return resp.data?.data
}

/** 执行命令 */
export async function runCommand(workspacePath: string, command: string, cwd?: string, timeoutMs = 60000): Promise<ToolResult> {
  const resp = await request.post(`${BASE}/run`, { workspace_path: workspacePath, command, cwd, timeout_ms: timeoutMs })
  return resp.data?.data
}

// ---------------------------------------------------------------------------
// Skills / Hooks / Memory API
// ---------------------------------------------------------------------------

/** 列出 Skills */
export async function listSkills(workspacePath: string): Promise<SkillInfo[]> {
  const resp = await request.get(`${BASE}/skills`, { params: { workspace_path: workspacePath } })
  return resp.data?.data ?? []
}

/** 创建 Skill */
export async function createSkill(workspacePath: string, name: string, description: string, body: string): Promise<boolean> {
  const resp = await request.post(`${BASE}/skills/create`, null, {
    params: { workspace_path: workspacePath, name, description, body },
  })
  return resp.data?.data?.created ?? false
}

/** 加载 Skill 正文 */
export async function getSkillBody(workspacePath: string, name: string): Promise<string> {
  const resp = await request.get(`${BASE}/skills/${name}/body`, { params: { workspace_path: workspacePath } })
  return resp.data?.data?.body ?? ''
}

/** 列出 Hooks */
export async function listHooks(workspacePath: string): Promise<HookInfo[]> {
  const resp = await request.get(`${BASE}/hooks`, { params: { workspace_path: workspacePath } })
  return resp.data?.data ?? []
}

/** 加载项目记忆 */
export async function getProjectMemory(workspacePath: string): Promise<ProjectMemory> {
  const resp = await request.get(`${BASE}/memory`, { params: { workspace_path: workspacePath } })
  return resp.data?.data
}

/** 获取系统提示词 */
export async function getSystemPrompt(workspacePath: string): Promise<{ system_prompt: string; files_loaded: string[] }> {
  const resp = await request.get(`${BASE}/memory/system-prompt`, { params: { workspace_path: workspacePath } })
  return resp.data?.data
}

// ---------------------------------------------------------------------------
// MCP API
// ---------------------------------------------------------------------------

/** 列出 MCP 服务器配置 */
export async function listMCPServers(workspacePath: string): Promise<Array<{ name: string; command: string | null; args: string[]; transport: string; url: string | null }>> {
  const resp = await request.get(`${BASE}/mcp/servers`, { params: { workspace_path: workspacePath } })
  return resp.data?.data ?? []
}

/** 连接 MCP 服务器 */
export async function connectMCPServer(workspacePath: string, serverName: string): Promise<boolean> {
  const resp = await request.post(`${BASE}/mcp/connect`, null, {
    params: { workspace_path: workspacePath, server_name: serverName },
  })
  return resp.data?.data?.connected ?? false
}

/** 列出 MCP 工具 */
export async function listMCPTools(workspacePath: string): Promise<Array<{ name: string; description: string; input_schema: Record<string, unknown>; server_name: string }>> {
  const resp = await request.get(`${BASE}/mcp/tools`, { params: { workspace_path: workspacePath } })
  return resp.data?.data ?? []
}

// ---------------------------------------------------------------------------
// Checkpoint API (对标 Aider git revert / Gemini checkpointing)
// ---------------------------------------------------------------------------

/** 列出检查点历史 */
export async function listCheckpoints(workspacePath: string, limit: number = 20): Promise<CheckpointInfo[]> {
  const resp = await request.get(`${BASE}/checkpoints`, { params: { workspace_path: workspacePath, limit } })
  return resp.data?.data ?? []
}

/** 撤销最近一次文件修改 */
export async function undoLastCheckpoint(workspacePath: string): Promise<{ success: boolean; message: string; restored_files: string[] }> {
  const resp = await request.post(`${BASE}/checkpoints/undo`, null, { params: { workspace_path: workspacePath } })
  return resp.data?.data ?? { success: false, message: '请求失败', restored_files: [] }
}

/** 回滚到指定检查点 */
export async function rollbackToCheckpoint(workspacePath: string, checkpointId: string): Promise<{ success: boolean; message: string; rolled_back: number; restored_files: string[] }> {
  const resp = await request.post(`${BASE}/checkpoints/rollback`, null, { params: { workspace_path: workspacePath, checkpoint_id: checkpointId } })
  return resp.data?.data ?? { success: false, message: '请求失败', rolled_back: 0, restored_files: [] }
}

/** 获取检查点详情 */
export async function getCheckpointDetail(workspacePath: string, checkpointId: string): Promise<CheckpointInfo | null> {
  const resp = await request.get(`${BASE}/checkpoints/${checkpointId}`, { params: { workspace_path: workspacePath } })
  return resp.data?.data ?? null
}

/** 清空所有检查点 */
export async function clearCheckpoints(workspacePath: string): Promise<{ cleared: number }> {
  const resp = await request.delete(`${BASE}/checkpoints`, { params: { workspace_path: workspacePath } })
  return resp.data?.data ?? { cleared: 0 }
}

// ---------------------------------------------------------------------------
// Agent WebSocket
// ---------------------------------------------------------------------------

/** Agent 对话请求参数 */
export interface AgentChatParams {
  prompt: string
  modelId: string
  workspacePath: string
  userUuid?: string
  chatId?: string
  systemPrompt?: string
  maxIterations?: number
  allowedTools?: string[]
  permissionMode?: string
  onEvent: (event: AgentEvent) => void
  onError?: (error: string) => void
  onClose?: () => void
}

/** 创建 Agent WebSocket 连接 */
export function createAgentWebSocket(params: AgentChatParams): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const wsUrl = `${protocol}//${host}${BASE}/agent/ws`

  const ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        prompt: params.prompt,
        model_id: params.modelId,
        workspace_path: params.workspacePath,
        user_uuid: params.userUuid ?? 'anonymous',
        chat_id: params.chatId,
        system_prompt: params.systemPrompt,
        max_iterations: params.maxIterations ?? 25,
        allowed_tools: params.allowedTools,
        permission_mode: params.permissionMode ?? 'default',
      }),
    )
  }

  ws.onmessage = (event) => {
    try {
      const data: AgentEvent = JSON.parse(event.data)
      params.onEvent(data)
    } catch {
      // 忽略解析错误
    }
  }

  ws.onerror = () => {
    params.onError?.('Agent WebSocket 连接错误')
  }

  ws.onclose = () => {
    params.onClose?.()
  }

  return ws
}

// ---------------------------------------------------------------------------
// Subagents API
// ---------------------------------------------------------------------------

/** 列出子代理 */
export async function listSubagents(workspacePath: string): Promise<Array<{ name: string; description: string; tools: string[]; model: string }>> {
  const resp = await request.get(`${BASE}/agents`, { params: { workspace_path: workspacePath } })
  return resp.data?.data ?? []
}

// ---------------------------------------------------------------------------
// Sessions API
// ---------------------------------------------------------------------------

/** 列出 Agent 会话 */
export async function listSessions(workspacePath?: string, limit = 50): Promise<Array<{ id: string; workspace_path: string; model_id: string; created_at: number; updated_at: number; message_count: number }>> {
  const resp = await request.get(`${BASE}/sessions`, { params: { workspace_path: workspacePath, limit } })
  return resp.data?.data ?? []
}

/** 获取会话详情 */
export async function getSession(sessionId: string): Promise<Record<string, unknown> | null> {
  const resp = await request.get(`${BASE}/sessions/${sessionId}`)
  return resp.data?.data ?? null
}

/** 删除会话 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const resp = await request.delete(`${BASE}/sessions/${sessionId}`)
  return resp.data?.data?.deleted ?? false
}

/** 获取最近会话 */
export async function getRecentSession(workspacePath?: string): Promise<Record<string, unknown> | null> {
  const resp = await request.get(`${BASE}/sessions/recent`, { params: { workspace_path: workspacePath } })
  return resp.data?.data ?? null
}

// ---------------------------------------------------------------------------
// Codebase Index API
// ---------------------------------------------------------------------------

/** 构建代码库索引 */
export async function buildCodebaseIndex(workspacePath: string): Promise<{ total_files: number; total_lines: number; indexed_at: number }> {
  const resp = await request.post(`${BASE}/index/build`, null, { params: { workspace_path: workspacePath } })
  return resp.data?.data
}

/** 搜索代码库文件 */
export async function searchCodebase(workspacePath: string, query: string, limit = 20): Promise<Array<{ path: string; name: string; score: number; symbols: string[] }>> {
  const resp = await request.get(`${BASE}/index/search`, { params: { workspace_path: workspacePath, query, limit } })
  return resp.data?.data ?? []
}

/** 搜索符号 */
export async function searchSymbols(workspacePath: string, query: string, limit = 30): Promise<Array<{ name: string; file: string; ext: string }>> {
  const resp = await request.get(`${BASE}/index/symbols`, { params: { workspace_path: workspacePath, query, limit } })
  return resp.data?.data ?? []
}

// ---------------------------------------------------------------------------
// @文件提及: 模糊搜索工作区文件 (对标 Claude Code @file / Cursor @file)
// ---------------------------------------------------------------------------

/**
 * 模糊搜索工作区文件 — 供 @文件提及使用.
 *
 * 优先使用 codebase 索引 (searchCodebase, 带 score 排序); 若索引未构建或无结果,
 * 回退到 globFiles (按文件名子串匹配, 始终可用). 返回去重后的相对路径列表.
 *
 * @param workspacePath 工作区绝对路径
 * @param query 搜索关键词 (文件名子串); 空字符串时返回常见文件列表
 * @param limit 最多返回条数
 */
export async function searchFiles(workspacePath: string, query: string, limit = 30): Promise<string[]> {
  // 1. 空查询: 用 glob 列出常见源码文件 (限制数量, 避免大工作区卡顿)
  if (!query.trim()) {
    try {
      const result = await globFiles(workspacePath, '', '**/*.{ts,js,vue,py,go,rs,java,json,md,yaml,yml,txt}')
      const files = parseGlobOutput(result.output)
      return files.slice(0, limit)
    } catch {
      return []
    }
  }

  // 2. 非空查询: 优先 codebase 索引 (带 score)
  try {
    const indexed = await searchCodebase(workspacePath, query, limit)
    if (indexed.length > 0) {
      return indexed.map((r) => r.path).slice(0, limit)
    }
  } catch {
    // 索引未构建, 继续回退
  }

  // 3. 回退: glob 按文件名子串匹配 (始终可用)
  try {
    // 转义 glob 元字符 (\* ? [ ] { } ( ) . +), 让后端按字面解释.
    // 比起直接删除, 转义能保留 "test.js" 中的 . 等有效字符, 避免误匹配.
    const safe = query.replace(/[*?[\](){}.+]/g, '\\$&')
    const result = await globFiles(workspacePath, '', `*${safe}*`)
    return parseGlobOutput(result.output).slice(0, limit)
  } catch {
    return []
  }
}

/** 解析 glob 工具的输出 (换行分隔的相对路径列表) 为数组, 过滤截断提示行. */
function parseGlobOutput(output: string | undefined | null): string[] {
  if (!output) return []
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('...') && l !== '(无匹配)')
    .sort((a, b) => a.localeCompare(b))
}

// ---------------------------------------------------------------------------
// Background Agents API (多会话并行 — 对标 Claude Code Background Agents)
// ---------------------------------------------------------------------------

/** 后台 Agent 状态 */
export type BackgroundAgentStatus = 'running' | 'completed' | 'failed' | 'cancelled'

/** 后台 Agent 进度信息 */
export interface BackgroundAgentProgress {
  iterations: number
  tool_calls: number
  last_event_type: string
  text_preview: string
}

/** 后台 Agent 结果 */
export interface BackgroundAgentResult {
  output: string
  iterations: number
  finish_reason?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    iterations: number
  }
}

/** 后台 Agent 信息 */
export interface BackgroundAgentInfo {
  agent_id: string
  status: BackgroundAgentStatus
  prompt: string
  workspace_path: string
  model_id: string
  user_uuid: string
  created_at: number
  updated_at: number
  progress: BackgroundAgentProgress
  result: BackgroundAgentResult | null
  error: string | null
  events_file: string
}

/** 启动后台 Agent 的参数 */
export interface StartBackgroundAgentParams {
  prompt: string
  workspace_path: string
  model_id?: string
  user_uuid?: string
  max_iterations?: number
  system_prompt?: string
  permission_mode?: string
}

/** 启动后台 Agent */
export async function startBackgroundAgent(params: StartBackgroundAgentParams): Promise<{ agent_id: string; status: string }> {
  const resp = await request.post(`${BASE}/background-agents`, {
    prompt: params.prompt,
    workspace_path: params.workspace_path,
    model_id: params.model_id ?? 'default',
    user_uuid: params.user_uuid ?? 'anonymous',
    max_iterations: params.max_iterations ?? 25,
    system_prompt: params.system_prompt,
    permission_mode: params.permission_mode ?? 'bypassPermissions',
  })
  return resp.data?.data ?? { agent_id: '', status: 'running' }
}

/** 列出后台 Agent (可按工作区过滤) */
export async function listBackgroundAgents(workspacePath?: string): Promise<BackgroundAgentInfo[]> {
  const resp = await request.get(`${BASE}/background-agents`, {
    params: workspacePath ? { workspace_path: workspacePath } : {},
  })
  return resp.data?.data ?? []
}

/** 获取后台 Agent 状态 */
export async function getBackgroundAgentStatus(agentId: string): Promise<BackgroundAgentInfo | null> {
  const resp = await request.get(`${BASE}/background-agents/${agentId}`)
  return resp.data?.data ?? null
}

/** 取消后台 Agent */
export async function cancelBackgroundAgent(agentId: string): Promise<boolean> {
  const resp = await request.delete(`${BASE}/background-agents/${agentId}`)
  return resp.data?.code === '0'
}

/** 获取后台 Agent 结果 */
export async function getBackgroundAgentResult(agentId: string): Promise<{
  status: string
  output: string
  iterations: number
  usage: Record<string, number>
  error: string | null
} | null> {
  const resp = await request.get(`${BASE}/background-agents/${agentId}/result`)
  return resp.data?.data ?? null
}

/** 获取后台 Agent 事件流 (增量读取) */
export async function getBackgroundAgentEvents(agentId: string, fromLine = 0, limit = 500): Promise<Record<string, unknown>[]> {
  const resp = await request.get(`${BASE}/background-agents/${agentId}/events`, {
    params: { from_line: fromLine, limit },
  })
  return resp.data?.data ?? []
}

/** 彻底删除后台 Agent 记录 */
export async function purgeBackgroundAgent(agentId: string): Promise<boolean> {
  const resp = await request.delete(`${BASE}/background-agents/${agentId}/purge`)
  return resp.data?.data?.deleted ?? false
}

// ---------------------------------------------------------------------------
// Routines 定时任务 API (对标 Claude Code Routines)
// ---------------------------------------------------------------------------

export interface RoutineInfo {
  id: string
  name: string
  prompt: string
  cron_expression: string
  workspace_path: string
  model_id: string
  enabled: boolean
  created_at: number
  last_run: number | null
  last_result: string | null
  next_run: number | null
}

export interface CreateRoutinePayload {
  name: string
  prompt: string
  cron_expression: string
  workspace_path: string
  model_id?: string
  enabled?: boolean
}

/** 列出定时任务 */
export async function listRoutines(workspacePath: string): Promise<RoutineInfo[]> {
  const resp = await request.get(`${BASE}/routines`, { params: { workspace_path: workspacePath } })
  return resp.data?.data ?? []
}

/** 创建定时任务 */
export async function createRoutine(payload: CreateRoutinePayload): Promise<RoutineInfo> {
  const resp = await request.post(`${BASE}/routines`, payload)
  return resp.data?.data
}

/** 获取定时任务详情 */
export async function getRoutine(routineId: string): Promise<RoutineInfo | null> {
  const resp = await request.get(`${BASE}/routines/${routineId}`)
  return resp.data?.data ?? null
}

/** 更新定时任务 */
export async function updateRoutine(routineId: string, updates: Partial<CreateRoutinePayload>): Promise<RoutineInfo | null> {
  const resp = await request.put(`${BASE}/routines/${routineId}`, updates)
  return resp.data?.data ?? null
}

/** 删除定时任务 */
export async function deleteRoutine(routineId: string): Promise<boolean> {
  const resp = await request.delete(`${BASE}/routines/${routineId}`)
  return resp.data?.data?.deleted ?? false
}

/** 手动触发定时任务 */
export async function triggerRoutine(routineId: string): Promise<{ triggered: boolean; agent_id?: string }> {
  const resp = await request.post(`${BASE}/routines/${routineId}/trigger`)
  return resp.data?.data ?? { triggered: false }
}
