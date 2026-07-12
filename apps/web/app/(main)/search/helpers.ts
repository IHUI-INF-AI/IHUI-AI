import { fetchApi } from '@/lib/api'
import type { SearchResults, TabKey, SortKey, ProjectResult, FileResult } from './types'

export const TABS: { value: TabKey; labelKey: 'all' | 'users' | 'projects' | 'files' }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'user', labelKey: 'users' },
  { value: 'project', labelKey: 'projects' },
  { value: 'file', labelKey: 'files' },
]

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export async function fetchSearch(q: string, type: TabKey): Promise<SearchResults> {
  const qs = new URLSearchParams({ q })
  if (type !== 'all') qs.set('type', type)
  const res = await fetchApi<SearchResults>(`/api/search?${qs.toString()}`)
  if (!res.success) throw new Error(res.error)
  return res.data
}

export function sortResults(data: SearchResults | undefined, sort: SortKey): SearchResults {
  if (!data) return { users: [], projects: [], files: [] }
  if (sort === 'relevance') return data
  const byProjectTime = (a: ProjectResult, b: ProjectResult) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  const byFileTime = (a: FileResult, b: FileResult) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  const users =
    sort === 'name'
      ? [...data.users].sort((a, b) => a.nickname.localeCompare(b.nickname))
      : data.users
  const projects = [...data.projects]
  const files = [...data.files]
  if (sort === 'time') {
    projects.sort(byProjectTime)
    files.sort(byFileTime)
  } else if (sort === 'name') {
    projects.sort((a, b) => a.name.localeCompare(b.name))
    files.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sort === 'size') {
    projects.sort((a, b) => b.fileCount - a.fileCount)
    files.sort((a, b) => b.size - a.size)
  }
  return { users, projects, files }
}
