import { fetchApi } from '@/lib/api'
import type {
  Mention,
  TableSchema,
  SymbolResult,
  EnrichInput,
  EnrichResult,
  ContextSource,
  VisualizationData,
  CompressionStats,
  SessionMemory,
  TrackVisualizationInput,
  ContextType,
} from '@ihui/shared/context/index'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchMentions(
  q: string,
  type: ContextType = 'file',
  limit = 20,
): Promise<{ mentions: Mention[]; total: number }> {
  const qs = new URLSearchParams({ q, type, limit: String(limit) })
  return api(`/api/context/mentions?${qs.toString()}`)
}

export function fetchDatabaseTables(
  q = '',
  limit = 50,
): Promise<{ mentions: Mention[]; total: number }> {
  const qs = new URLSearchParams({ limit: String(limit) })
  if (q) qs.set('q', q)
  return api(`/api/context/database/tables?${qs.toString()}`)
}

export function fetchTableSchema(table: string): Promise<TableSchema> {
  return api(`/api/context/database/schema/${encodeURIComponent(table)}`)
}

export function fetchSymbols(
  q: string,
  limit = 20,
): Promise<{ symbols: SymbolResult[]; total: number }> {
  const qs = new URLSearchParams({ q, limit: String(limit) })
  return api(`/api/context/symbols?${qs.toString()}`)
}

export function enrichContext(input: EnrichInput): Promise<EnrichResult> {
  return api('/api/context/enrich', { method: 'POST', body: JSON.stringify(input) })
}

export function fetchSources(): Promise<ContextSource[]> {
  return api('/api/context/sources')
}

export function trackVisualization(input: TrackVisualizationInput): Promise<{ recorded: boolean }> {
  return api('/api/context/visualization/track', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchVisualization(
  conversationId = '',
  userId = '',
): Promise<VisualizationData> {
  const qs = new URLSearchParams()
  if (conversationId) qs.set('conversationId', conversationId)
  if (userId) qs.set('userId', userId)
  return api(`/api/context/visualization${qs.toString() ? `?${qs.toString()}` : ''}`)
}

export function fetchCompressionStats(userId = ''): Promise<CompressionStats> {
  const qs = new URLSearchParams()
  if (userId) qs.set('userId', userId)
  return api(`/api/context/compression-stats${qs.toString() ? `?${qs.toString()}` : ''}`)
}

export function fetchSessionMemory(
  conversationId = '',
  userId = '',
): Promise<SessionMemory> {
  const qs = new URLSearchParams()
  if (conversationId) qs.set('conversationId', conversationId)
  if (userId) qs.set('userId', userId)
  return api(`/api/context/memory${qs.toString() ? `?${qs.toString()}` : ''}`)
}

export function clearSessionMemory(conversationId: string): Promise<{ cleared: boolean }> {
  const qs = new URLSearchParams({ conversationId })
  return api(`/api/context/memory?${qs.toString()}`, { method: 'DELETE' })
}
