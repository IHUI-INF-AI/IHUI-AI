import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { FileItem } from '@/components/workspace/file-list'
import type { ProjectDetail } from './types'

export const AI_MOCK = {
  diffOld: 'export function auth(token: string) {\n  return verify(token)\n}',
  diffNew:
    'export function auth(token: string): Promise<User> {\n  return verify(token).then(decode)\n}',
  inlineDiff:
    ' export function auth(token) {\n-  return verify(token)\n+  return verify(token).then(decode)\n }',
  tasks: [
    {
      id: 't1',
      title: 'review 认证模块',
      status: 'in-progress' as const,
      priority: 'high' as const,
      assignee: 'Alice',
    },
    { id: 't2', title: '补充 README', status: 'todo' as const, priority: 'low' as const },
  ],
  routines: [
    { id: 'r1', name: '每日构建', schedule: '0 9 * * *', enabled: true, lastRun: '今天 09:00' },
    { id: 'r2', name: '每周清理', schedule: '0 0 * * 0', enabled: false },
  ],
  folders: [
    {
      id: 'f1',
      name: 'src',
      path: '/src',
      children: [
        { id: 'f1-1', name: 'auth', path: '/src/auth' },
        { id: 'f1-2', name: 'utils', path: '/src/utils' },
      ],
    },
    { id: 'f2', name: 'tests', path: '/tests' },
  ],
}

export async function fetchProject(id: string): Promise<ProjectDetail> {
  const res = await fetchApi<{ project: ProjectDetail }>(`/api/workspace/projects/${id}`)
  if (!res.success) throw new Error(res.error)
  return res.data.project
}

export async function fetchFiles(projectId: string): Promise<FileItem[]> {
  const res = await fetchApi<{ files: FileItem[] }>(`/api/workspace/projects/${projectId}/files`)
  if (!res.success) throw new Error(res.error)
  return res.data.files
}

export async function uploadFile(
  projectId: string,
  file: File,
  errorMsg: string,
): Promise<FileItem> {
  const token = useAuthStore.getState().token
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`/api/workspace/projects/${projectId}/files`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const json = (await response.json()) as {
    code: number
    message: string
    data?: { file: FileItem }
  }
  if (!response.ok || json.code !== 0) throw new Error(json.message || errorMsg)
  return json.data!.file
}

export async function downloadFile(file: FileItem, errorMsg: string) {
  const token = useAuthStore.getState().token
  const response = await fetch(`/api/workspace/files/${file.id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error(errorMsg)
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export async function removeFile(fileId: string): Promise<void> {
  const res = await fetchApi(`/api/workspace/files/${fileId}`, { method: 'DELETE' })
  if (!res.success) throw new Error(res.error)
}
