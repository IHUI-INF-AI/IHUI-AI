import { fetchApi } from '@/lib/api'
import type {
  SpecGenerateInput,
  SpecGenerateResult,
  SpecTemplate,
  SpecHistoryEntry,
  SpecDocument,
  SpecDiff,
  SpecVariable,
  SpecScope,
} from '@ihui/shared/spec/index'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function generateSpec(input: SpecGenerateInput): Promise<SpecGenerateResult> {
  return api('/api/spec/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchTemplates(): Promise<SpecTemplate[]> {
  return api('/api/spec/templates')
}

export function fetchSpecHistory(scope?: SpecScope): Promise<SpecHistoryEntry[]> {
  const qs = new URLSearchParams()
  if (scope) {
    qs.set('type', scope.type)
    if (scope.path) qs.set('path', scope.path)
  }
  return api(`/api/spec/history${qs.toString() ? `?${qs.toString()}` : ''}`)
}

export function loadSpec(id: string): Promise<SpecDocument> {
  return api(`/api/spec/load?id=${encodeURIComponent(id)}`)
}

export function diffSpec(id: string, newSpec: string): Promise<SpecDiff> {
  return api('/api/spec/diff', {
    method: 'POST',
    body: JSON.stringify({ id, newSpec }),
  })
}

export function fetchVariables(): Promise<SpecVariable[]> {
  return api('/api/spec/variables')
}
