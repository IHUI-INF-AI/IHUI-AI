import type { ApiResult, GitStatusSnapshot } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs, type PageData } from '../utils'

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
export async function browseDirectory(
  path?: string,
): Promise<ApiResult<{ entries: BrowseEntry[] }>> {
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
// FS Bridge Read/Write/Edit/Delete — 文件读写编辑删除
// =============================================================================

/** 读取文件内容(支持行号范围) */
export async function readFile(params: {
  path: string
  workspacePath: string
  startLine?: number
  endLine?: number
}): Promise<ApiResult<{ content: string; lines: number; path: string }>> {
  return fetchApi<{ content: string; lines: number; path: string }>('/api/workspace/fs/read', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 写文件(自动 checkpoint) */
export async function writeFile(params: {
  path: string
  workspacePath: string
  content: string
  createDirs?: boolean
}): Promise<ApiResult<{ path: string; size: number }>> {
  return fetchApi<{ path: string; size: number }>('/api/workspace/fs/write', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 编辑文件(基于 oldText/newText 替换) */
export async function editFile(params: {
  path: string
  workspacePath: string
  oldText: string
  newText: string
}): Promise<ApiResult<{ path: string; occurrences: number }>> {
  return fetchApi<{ path: string; occurrences: number }>('/api/workspace/fs/edit', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 删除文件 */
export async function deleteFile(params: {
  path: string
  workspacePath: string
  recursive?: boolean
}): Promise<ApiResult<{ path: string; deleted: boolean }>> {
  return fetchApi<{ path: string; deleted: boolean }>('/api/workspace/fs/delete', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 文件内容搜索(grep,3 种 outputMode) */
export async function grepFiles(params: {
  workspacePath: string
  pattern: string
  path?: string
  glob?: string
  outputMode?: 'content' | 'files_with_matches' | 'count'
}): Promise<ApiResult<{ results: unknown }>> {
  return fetchApi<{ results: unknown }>('/api/workspace/fs/grep', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** glob 模式文件查找 */
export async function globFiles(params: {
  workspacePath: string
  pattern: string
  path?: string
}): Promise<ApiResult<{ files: string[] }>> {
  return fetchApi<{ files: string[] }>('/api/workspace/fs/glob', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 执行命令(走 sandboxExecutor 白名单) */
export async function runCommand(params: {
  command: string
  workspacePath: string
  cwd?: string
  timeoutMs?: number
  mode?: 'read-only' | 'workspace-write' | 'danger-full-access'
}): Promise<ApiResult<{ stdout: string; stderr: string; exitCode: number; mode: string }>> {
  return fetchApi<{ stdout: string; stderr: string; exitCode: number; mode: string }>(
    '/api/workspace/fs/run',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  )
}

/**
 * 环境信息弹窗专用(2026-08-17 立,对标 Cursor 右上角 env info card):
<<<<<<< Updated upstream
 * 单次调用批量拉取 git status + branch + remote + ahead/behind + PR + lastCommit + localPath/remotes。
=======
 * 单次调用批量拉取 git status + branch + remote + ahead/behind + PR 状态 + 最近提交,
 * 避免前端串行多次 fs/run。
 *
 * - workspacePath 必填
 * - 返回统一信封结构(ApiResult<GitStatusSnapshot>)
 * - 非 git 仓库 / 命令失败 → isRepo=false,其他字段零/空
>>>>>>> Stashed changes
 */
export async function getGitStatus(params: {
  workspacePath: string
}): Promise<ApiResult<GitStatusSnapshot>> {
  return fetchApi<GitStatusSnapshot>('/api/workspace/git/status', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/**
 * GitHub 集成(2026-08-17 立,用户需求"GitHub 仓库配置"):
 * - 检测当前工作区是否为 GitHub 仓库 + 是否已配置 token
<<<<<<< Updated upstream
 * - 保存/清除 token(存 ~/.ihui/github_token)
 * - OAuth Device Flow(跳转授权,免粘贴 token)
=======
 * - 保存/清除 token(存 ~/.ihui/github_token,复用 githubClient.loadToken)
>>>>>>> Stashed changes
 */
export interface GithubStatus {
  /** 是否为 GitHub 仓库(origin/upstream remote 是 github.com) */
  isGithubRepo: boolean
  /** 仓库 owner/repo(非 GitHub remote 为 null) */
  owner: string | null
  repo: string | null
<<<<<<< Updated upstream
  /** 是否已配置 GitHub token(字段名禁含 "token" 子串,防响应脱敏) */
=======
  /** 是否已配置 GITHUB_TOKEN */
>>>>>>> Stashed changes
  ghConfigured: boolean
  /** 当前分支 */
  currentBranch: string | null
  /** 默认分支(origin/HEAD,探测失败为 null) */
  defaultBranch: string | null
}

/** 检测工作区 GitHub 状态 + token 配置情况 */
export async function getGithubStatus(params: {
  workspacePath: string
}): Promise<ApiResult<GithubStatus>> {
  return fetchApi<GithubStatus>('/api/workspace/github/status', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 保存 GitHub token(校验通过后写入 ~/.ihui/github_token) */
export async function setGithubToken(params: {
  workspacePath: string
  token: string
}): Promise<ApiResult<{ ok: boolean }>> {
  return fetchApi<{ ok: boolean }>('/api/workspace/github/token', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 清除 GitHub token */
export async function clearGithubToken(): Promise<ApiResult<{ ok: boolean }>> {
  return fetchApi<{ ok: boolean }>('/api/workspace/github/token', {
    method: 'DELETE',
  })
}

<<<<<<< Updated upstream
/**
 * GitHub OAuth Device Flow(2026-08-17 用户需求"跳转网站授权,免粘贴 token"):
 * 1. requestGithubDeviceCode → 返回 user_code + verification_uri(用户去 github.com/login/device 输 code)
 * 2. pollGithubDeviceToken → 轮询换 access_token,成功自动保存 ~/.ihui/github_token
 */
export interface GithubDeviceCode {
  /** 设备码(轮询 token 用,不展示给用户) */
  deviceCode: string
  /** 用户码(展示给用户,在 verification_uri 输入) */
  userCode: string
  /** 授权页面地址(https://github.com/login/device) */
  verificationUri: string
  /** 有效期(秒) */
  expiresIn: number
  /** 轮询间隔(秒) */
  interval: number
}

/** 发起设备授权:返回 user_code + verification_uri */
export async function requestGithubDeviceCode(params: {
  workspacePath: string
}): Promise<ApiResult<GithubDeviceCode>> {
  return fetchApi<GithubDeviceCode>('/api/workspace/github/device-code', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 轮询设备授权状态:authorization_pending 时返回 {status:'pending'};成功后已自动保存 token */
export async function pollGithubDeviceToken(params: {
  deviceCode: string
}): Promise<ApiResult<{ status: 'ok' | 'pending' | 'slow_down' | 'expired'; message?: string }>> {
  return fetchApi<{ status: 'ok' | 'pending' | 'slow_down' | 'expired'; message?: string }>(
    '/api/workspace/github/device-token',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  )
}

=======
>>>>>>> Stashed changes
// =============================================================================
// Sandbox — 沙箱执行环境
// =============================================================================

/** 沙箱执行(三模式:read-only / workspace-write / danger-full-access) */
export async function executeSandbox(params: {
  command: string
  workspacePath: string
  mode?: 'read-only' | 'workspace-write' | 'danger-full-access'
  timeoutMs?: number
}): Promise<ApiResult<{ stdout: string; stderr: string; exitCode: number; mode: string }>> {
  return fetchApi<{ stdout: string; stderr: string; exitCode: number; mode: string }>(
    '/api/workspace/sandbox/execute',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  )
}

// =============================================================================
// Codebase Index — 代码库符号索引与搜索
// =============================================================================

/** 代码库符号索引 */
export async function indexCodebase(params: {
  workspacePath: string
}): Promise<ApiResult<{ indexed: boolean; symbols: number }>> {
  return fetchApi<{ indexed: boolean; symbols: number }>('/api/workspace/codebase/index', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 符号搜索(GET,query 参数) */
export async function searchCodebase(params: {
  workspacePath: string
  query: string
}): Promise<ApiResult<{ symbols: unknown[] }>> {
  const qs = buildQs({ workspacePath: params.workspacePath, q: params.query })
  return fetchApi<{ symbols: unknown[] }>(`/api/workspace/codebase/search${qs}`)
}

// =============================================================================
// Checkpoint — 检查点状态恢复(list / rollback / undo)
// =============================================================================

/** 列出工作区所有检查点 */
export async function listCheckpoints(params: {
  workspacePath: string
}): Promise<ApiResult<{ checkpoints: unknown[] }>> {
  return fetchApi<{ checkpoints: unknown[] }>(
    `/api/workspace/checkpoints?workspacePath=${encodeURIComponent(params.workspacePath)}`,
  )
}

/** 回滚到指定检查点 */
export async function rollbackCheckpoint(params: {
  workspacePath: string
  checkpointId: string
}): Promise<ApiResult<{ rolled: boolean }>> {
  return fetchApi<{ rolled: boolean }>(
    `/api/workspace/checkpoints/${encodeURIComponent(params.checkpointId)}/rollback`,
    {
      method: 'POST',
      body: JSON.stringify({ workspacePath: params.workspacePath }),
    },
  )
}

/** 撤销最近一次操作 */
export async function undoCheckpoint(params: {
  workspacePath: string
}): Promise<ApiResult<{ undone: boolean }>> {
  return fetchApi<{ undone: boolean }>('/api/workspace/checkpoints/undo', {
    method: 'POST',
    body: JSON.stringify({ workspacePath: params.workspacePath }),
  })
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
export async function deletePermissionRule(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(
    `/api/workspace/permissions/rules/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}

/** 重置为默认安全模板 */
export async function resetPermissionRules(
  workspacePath: string,
): Promise<ApiResult<{ rules: WorkspacePermissionRule[] }>> {
  return fetchApi<{ rules: WorkspacePermissionRule[] }>('/api/workspace/permissions/rules/reset', {
    method: 'POST',
    body: JSON.stringify({ workspacePath }),
  })
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
