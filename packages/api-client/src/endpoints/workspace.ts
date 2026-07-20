import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

export interface Workspace {
  id: string
  name: string
  description: string
  icon: string | null
  ownerId: string
  memberCount: number
  fileCount: number
  swarmCount: number
  storageUsed: number
  storageLimit: number
  isShared: boolean
  createdAt: string
  updatedAt: string
}

export interface Swarm {
  id: string
  workspaceId: string
  name: string
  description: string
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'error'
  agents: { id: string; name: string; role: string }[]
  config: Record<string, unknown>
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkspaceFile {
  id: string
  workspaceId: string
  name: string
  path: string
  type: 'file' | 'directory'
  mimeType: string | null
  size: number
  url: string | null
  parentId: string | null
  uploadedBy: { id: string; nickname: string }
  createdAt: string
  updatedAt: string
}

export type WorkspaceListQuery = {
  page?: number
  pageSize?: number
  keyword?: string
}

export interface WorkspaceInput {
  name: string
  description?: string
  icon?: string
  isShared?: boolean
}

export interface SwarmInput {
  name: string
  description?: string
  agents?: { id: string; role: string }[]
  config?: Record<string, unknown>
}

export type FileListQuery = {
  page?: number
  pageSize?: number
  parentId?: string
  type?: string
  keyword?: string
}

export async function getWorkspaces(
  query: WorkspaceListQuery = {},
): Promise<ApiResult<PageData<Workspace>>> {
  return fetchApi<PageData<Workspace>>(`/api/workspace/projects${buildQs(query)}`)
}

export async function createWorkspace(input: WorkspaceInput): Promise<ApiResult<Workspace>> {
  return fetchApi<Workspace>('/api/workspace/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getWorkspaceById(id: string): Promise<ApiResult<Workspace>> {
  return fetchApi<Workspace>(`/api/workspace/projects/${encodeURIComponent(id)}`)
}

export async function updateWorkspace(
  id: string,
  input: Partial<WorkspaceInput>,
): Promise<ApiResult<Workspace>> {
  return fetchApi<Workspace>(`/api/workspace/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteWorkspace(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/workspace/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function getSwarm(
  workspaceId: string,
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<Swarm>>> {
  return fetchApi<PageData<Swarm>>(`/api/workspace/swarms${buildQs({ ...query, workspaceId })}`)
}

export async function createSwarm(
  workspaceId: string,
  input: SwarmInput,
): Promise<ApiResult<Swarm>> {
  return fetchApi<Swarm>('/api/workspace/swarms', {
    method: 'POST',
    body: JSON.stringify({ ...input, workspaceId }),
  })
}

export async function getFiles(
  workspaceId: string,
  query: FileListQuery = {},
): Promise<ApiResult<PageData<WorkspaceFile>>> {
  return fetchApi<PageData<WorkspaceFile>>(
    `/api/workspace/projects/${encodeURIComponent(workspaceId)}/files${buildQs(query)}`,
  )
}

export async function uploadFile(
  workspaceId: string,
  file: File,
  parentId?: string,
): Promise<ApiResult<WorkspaceFile>> {
  const formData = new FormData()
  formData.append('file', file)
  if (parentId) formData.append('parentId', parentId)
  return fetchApi<WorkspaceFile>(
    `/api/workspace/projects/${encodeURIComponent(workspaceId)}/files`,
    { method: 'POST', body: formData },
  )
}

/**
 * 最近文件轻量结构(用于聊天 @ 提及面板)。
 *
 * 后端 GET /api/files/recent 与 GET /api/files/search 返回的 serializeFile 结构,
 * 不含 path 字段(数据库中 path 仅在 workspace 项目文件表中存在);
 * 调用方按需用 name/mimeType/size 组装展示文本。
 */
export interface RecentFile {
  id: string
  projectId: string
  name: string
  size: number
  mimeType: string
  uploadedBy: string | null
  createdAt: string
}

/**
 * 获取当前用户最近上传的文件(按 createdAt 倒序)。
 * 用于 AI 输入框 @ 提及面板的初始列表。
 */
export async function getRecentFilesForMention(
  limit = 20,
): Promise<ApiResult<{ files: RecentFile[] }>> {
  return fetchApi<{ files: RecentFile[] }>(`/api/files/recent?limit=${limit}`)
}

/**
 * 按关键字搜索当前用户的文件(支持按文件名/mimeType 等匹配)。
 * 用于 @ 提及面板输入关键字时的实时筛选。
 */
export async function searchFilesForMention(
  q: string,
): Promise<ApiResult<{ files: RecentFile[] }>> {
  return fetchApi<{ files: RecentFile[] }>(`/api/files/search?q=${encodeURIComponent(q)}`)
}

// =============================================================================
// FS Bridge — 本地文件系统桥接
// =============================================================================

export interface BrowseEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  modified: number
}

export interface RecentWorkspace {
  path: string
  name: string
  lastOpened: number
}

export interface OpenWorkspaceResult {
  path: string
  name: string
  techStack: string[]
  permission: WorkspacePermission | null
  needsPermissionSetup: boolean
}

/** 浏览服务器本地目录(根路径返回盘符列表) */
export async function browseDirectory(path?: string): Promise<ApiResult<{ entries: BrowseEntry[] }>> {
  return fetchApi<{ entries: BrowseEntry[] }>('/api/workspace/fs/browse', {
    method: 'POST',
    body: JSON.stringify({ path: path ?? '' }),
  })
}

/** 打开工作区(写入 recent,检测技术栈,返回权限配置) */
export async function openWorkspace(
  path: string,
  name?: string,
): Promise<ApiResult<OpenWorkspaceResult>> {
  return fetchApi<OpenWorkspaceResult>('/api/workspace/fs/open', {
    method: 'POST',
    body: JSON.stringify({ path, name }),
  })
}

/** 列出最近打开的工作区 */
export async function getRecentWorkspaces(): Promise<ApiResult<{ workspaces: RecentWorkspace[] }>> {
  return fetchApi<{ workspaces: RecentWorkspace[] }>('/api/workspace/fs/recent')
}

// =============================================================================
// Workspace Permissions — 工作区权限治理
// =============================================================================

export type WorkspacePermissionMode = 'default' | 'accept-edits' | 'bypass-permissions'

export type PermissionRuleType = 'path' | 'command' | 'tool'
export type PermissionOperation = 'read' | 'write' | 'edit' | 'delete' | 'run' | 'grep' | 'glob'
export type PermissionDecision = 'allow' | 'deny'

export interface WorkspacePermission {
  id: string
  userId: string
  workspacePath: string
  name: string
  techStack: string | null
  mode: WorkspacePermissionMode
  lastAccessedAt: string
  createdAt: string
  updatedAt: string
}

export interface WorkspacePermissionRule {
  id: string
  workspacePath: string
  userId: string
  ruleType: PermissionRuleType
  pattern: string
  operation: PermissionOperation | null
  decision: PermissionDecision
  builtin: boolean
  createdAt: string
}

export interface WorkspacePermissionAuditLog {
  id: string
  userId: string
  workspacePath: string
  toolName: string | null
  args: string | null
  decision: string
  reason: string | null
  createdAt: string
}

export interface RuleTemplate {
  ruleType: PermissionRuleType
  pattern: string
  operation?: PermissionOperation
  decision: PermissionDecision
  description: string
}

/** 查询单个工作区权限配置 */
export async function getWorkspacePermission(
  path: string,
): Promise<ApiResult<{ permission: WorkspacePermission | null }>> {
  return fetchApi<{ permission: WorkspacePermission | null }>(
    `/api/workspace/permission?workspacePath=${encodeURIComponent(path)}`,
  )
}

/** 列出当前用户所有工作区权限 */
export async function listAllWorkspacePermissions(): Promise<
  ApiResult<{ permissions: WorkspacePermission[] }>
> {
  return fetchApi<{ permissions: WorkspacePermission[] }>('/api/workspace/permissions')
}

/** 设置/更新权限模式(首次打开时调用) */
export async function setWorkspacePermission(input: {
  workspacePath: string
  name: string
  techStack?: string
  mode: WorkspacePermissionMode
  initializeDefaults?: boolean
}): Promise<ApiResult<{ permission: WorkspacePermission }>> {
  return fetchApi<{ permission: WorkspacePermission }>('/api/workspace/permissions', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除权限配置 + 级联规则 */
export async function deleteWorkspacePermission(
  path: string,
): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(
    `/api/workspace/permission?workspacePath=${encodeURIComponent(path)}`,
    { method: 'DELETE' },
  )
}

/** 列出白名单规则 */
export async function listPermissionRules(
  path: string,
): Promise<ApiResult<{ rules: WorkspacePermissionRule[] }>> {
  return fetchApi<{ rules: WorkspacePermissionRule[] }>(
    `/api/workspace/permissions/rules?workspacePath=${encodeURIComponent(path)}`,
  )
}

/** 添加规则 */
export async function addPermissionRule(input: {
  workspacePath: string
  ruleType: PermissionRuleType
  pattern: string
  operation?: PermissionOperation | null
  decision: PermissionDecision
}): Promise<ApiResult<{ rule: WorkspacePermissionRule }>> {
  return fetchApi<{ rule: WorkspacePermissionRule }>('/api/workspace/permissions/rules', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新规则 */
export async function updatePermissionRule(
  id: string,
  patch: Partial<{
    ruleType: PermissionRuleType
    pattern: string
    operation: PermissionOperation | null
    decision: PermissionDecision
  }>,
): Promise<ApiResult<{ rule: WorkspacePermissionRule }>> {
  return fetchApi<{ rule: WorkspacePermissionRule }>(
    `/api/workspace/permissions/rules/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  )
}

/** 删除规则 */
export async function deletePermissionRule(
  id: string,
): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(
    `/api/workspace/permissions/rules/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}

/** 重置为默认安全模板 */
export async function resetPermissionRules(
  workspacePath: string,
): Promise<ApiResult<{ rules: WorkspacePermissionRule[] }>> {
  return fetchApi<{ rules: WorkspacePermissionRule[] }>(
    '/api/workspace/permissions/rules/reset',
    { method: 'POST', body: JSON.stringify({ workspacePath }) },
  )
}

/** 审计日志 */
export async function getPermissionAuditLog(
  path: string,
  limit = 50,
): Promise<ApiResult<{ logs: WorkspacePermissionAuditLog[] }>> {
  return fetchApi<{ logs: WorkspacePermissionAuditLog[] }>(
    `/api/workspace/permissions/audit-log?workspacePath=${encodeURIComponent(path)}&limit=${limit}`,
  )
}

/** 获取预置安全模板(只读) */
export async function getPermissionTemplates(): Promise<ApiResult<{ templates: RuleTemplate[] }>> {
  return fetchApi<{ templates: RuleTemplate[] }>('/api/workspace/templates')
}

// =============================================================================
// Workspace Permission Audit — 人工审计确认(default / accept-edits 无匹配模式)
// =============================================================================

/** 待决人工审计请求(后端通过 WebSocket 推送 + 此接口查询) */
export interface PendingPermissionRequest {
  requestId: string
  userId: string
  tool: string
  args: Record<string, unknown>
  status: 'pending' | 'approved' | 'denied'
  createdAt: number
  resolvedAt: number | null
}

/** 列出当前用户待决的人工审计请求(用于页面刷新兜底) */
export async function listPendingPermissionRequests(): Promise<
  ApiResult<{ requests: PendingPermissionRequest[] }>
> {
  return fetchApi<{ requests: PendingPermissionRequest[] }>('/api/workspace/permission/requests')
}

/**
 * 用户决策解锁审计 Promise(等待中的 FS 工具调用将根据 approved 同步放行/拒绝)。
 */
export async function resolvePermissionRequest(
  requestId: string,
  approved: boolean,
  reason?: string,
): Promise<ApiResult<{ resolved: boolean }>> {
  return fetchApi<{ resolved: boolean }>(
    `/api/workspace/permission/requests/${encodeURIComponent(requestId)}/resolve`,
    { method: 'POST', body: JSON.stringify({ approved, reason }) },
  )
}
