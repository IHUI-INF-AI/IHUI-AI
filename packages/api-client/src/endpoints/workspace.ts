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
