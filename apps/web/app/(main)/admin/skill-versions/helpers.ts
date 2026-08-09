import { fetchApi } from '@/lib/api'

interface RawSkill {
  name: string
  version: string
  updatedAt: string
  changelog?: string
  content?: string
}

export async function fetchSkills(): Promise<RawSkill[]> {
  const res = await fetchApi<RawSkill[]>('/api/skills')
  if (!res.success) throw new Error(res.error)
  return res.data
}

export async function rollbackSkill(name: string, content: string): Promise<void> {
  const res = await fetchApi<void>(`/api/skills`, {
    method: 'POST',
    body: JSON.stringify({ name, content }),
  })
  if (!res.success) throw new Error(res.error)
}

export function computeDiff(oldText: string, newText: string): Array<{ type: 'added' | 'removed' | 'unchanged'; text: string }> {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const result: Array<{ type: 'added' | 'removed' | 'unchanged'; text: string }> = []

  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i] ?? ''
    const newLine = newLines[i] ?? ''
    if (i >= oldLines.length) {
      result.push({ type: 'added', text: newLine })
    } else if (i >= newLines.length) {
      result.push({ type: 'removed', text: oldLine })
    } else if (oldLine === newLine) {
      result.push({ type: 'unchanged', text: oldLine })
    } else {
      result.push({ type: 'removed', text: oldLine })
      result.push({ type: 'added', text: newLine })
    }
  }

  return result
}