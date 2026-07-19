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
