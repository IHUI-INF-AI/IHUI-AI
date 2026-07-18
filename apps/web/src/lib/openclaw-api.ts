import { fetchApi } from '@/lib/api'
import { OPENCLAW_PATHS } from '@/config/backend-paths'

// ===== OpenclawItem (本地类型,对齐 packages/database/src/schema/openclaw-items.ts) =====

export interface OpenclawItem {
  id: string
  title: string
  content: string | null
  coverImage: string | null
  authorId: string | null
  viewCount: number
  status: number
  createdAt: string
  updatedAt: string
}

export interface OpenclawListResult {
  list: OpenclawItem[]
  total: number
  page: number
  pageSize: number
}

export interface ListOpenclawItemsParams {
  page?: number
  pageSize?: number
  search?: string
}

// ===== /api/openclaw 主端点(后端已实现) =====

export async function listOpenclawItems(
  params: ListOpenclawItemsParams = {},
): Promise<OpenclawListResult> {
  const q = new URLSearchParams()
  if (params.page !== undefined) q.set('page', String(params.page))
  if (params.pageSize !== undefined) q.set('pageSize', String(params.pageSize))
  if (params.search) q.set('search', params.search)
  const qs = q.toString()
  const url = qs
    ? `${OPENCLAW_PATHS.gateway.status.replace('/gateway/status', '')}?${qs}`
    : OPENCLAW_PATHS.gateway.status.replace('/gateway/status', '')
  const res = await fetchApi<OpenclawListResult>(url)
  if (!res.success) throw new Error(res.error || '查询 OpenClaw 列表失败')
  return res.data
}

export async function getOpenclawItem(id: string): Promise<OpenclawItem> {
  const base = OPENCLAW_PATHS.gateway.status.replace('/gateway/status', '')
  const res = await fetchApi<{ openclaw: OpenclawItem }>(`${base}/${encodeURIComponent(id)}`)
  if (!res.success) throw new Error(res.error || '查询 OpenClaw 条目失败')
  return res.data.openclaw
}

// ===== Memory =====

export type MemoryType = 'fact' | 'preference' | 'event'

export interface MemoryItem {
  id: string
  type: MemoryType
  content: string
  createdAt?: string
}

export interface MemoryContext {
  sessionId?: string
  memories?: MemoryItem[]
  count?: number
}

export async function searchMemory(keyword: string): Promise<MemoryItem[]> {
  const res = await fetchApi<{ memories: MemoryItem[]; count?: number }>(
    OPENCLAW_PATHS.memory.search,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword }),
    },
  )
  if (!res.success || !res.data) return []
  return res.data.memories ?? []
}

export async function getMemoryContext(): Promise<MemoryContext> {
  const res = await fetchApi<MemoryContext>(OPENCLAW_PATHS.memory.context)
  if (!res.success || !res.data) return { memories: [], count: 0 }
  return res.data
}

export async function createMemory(input: {
  type: MemoryType
  content: string
}): Promise<MemoryItem | null> {
  const res = await fetchApi<MemoryItem>(OPENCLAW_PATHS.memory.create, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.success || !res.data) return null
  return res.data
}

export async function clearMemory(): Promise<boolean> {
  const res = await fetchApi<{ cleared?: boolean }>(OPENCLAW_PATHS.memory.delete, {
    method: 'DELETE',
  })
  if (!res.success) return false
  return true
}

// ===== Skills =====

export interface SkillItem {
  id: string
  name: string
  description?: string
  installed?: boolean
}

export async function listAvailableSkills(): Promise<SkillItem[]> {
  const res = await fetchApi<{ skills: SkillItem[] } | SkillItem[]>(OPENCLAW_PATHS.skills.list)
  if (!res.success || !res.data) return []
  const data = res.data
  if (Array.isArray(data)) return data
  return data.skills ?? []
}

export async function listInstalledSkills(): Promise<SkillItem[]> {
  const res = await fetchApi<{ skills: SkillItem[] } | SkillItem[]>(OPENCLAW_PATHS.skills.installed)
  if (!res.success || !res.data) return []
  const data = res.data
  if (Array.isArray(data)) return data
  return data.skills ?? []
}

export async function installSkill(id: string): Promise<boolean> {
  const res = await fetchApi<{ installed?: boolean }>(OPENCLAW_PATHS.skills.install(id), {
    method: 'POST',
  })
  return res.success
}

export async function uninstallSkill(id: string): Promise<boolean> {
  const res = await fetchApi<{ uninstalled?: boolean }>(OPENCLAW_PATHS.skills.uninstall(id), {
    method: 'POST',
  })
  return res.success
}

// ===== Automation: Cron / Webhooks / Hooks =====

export interface CronJobItem {
  id: string
  name: string
  schedule: string
  task: string
  enabled?: boolean
}

export interface WebhookItem {
  id: string
  name: string
  endpoint: string
  events?: string
  enabled?: boolean
}

export interface HookItem {
  id: string
  type: string
  name: string
  handler: string
  enabled?: boolean
}

export interface AutomationListResponse {
  cronJobs?: CronJobItem[]
  webhooks?: WebhookItem[]
  hooks?: HookItem[]
}

export async function listAutomation(): Promise<AutomationListResponse> {
  const res = await fetchApi<AutomationListResponse>(OPENCLAW_PATHS.tasks.list)
  if (!res.success || !res.data) return { cronJobs: [], webhooks: [], hooks: [] }
  return {
    cronJobs: res.data.cronJobs ?? [],
    webhooks: res.data.webhooks ?? [],
    hooks: res.data.hooks ?? [],
  }
}

export async function createCronJob(input: {
  name: string
  schedule: string
  task: string
}): Promise<CronJobItem | null> {
  const res = await fetchApi<CronJobItem>(OPENCLAW_PATHS.tasks.execute('cron'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.success || !res.data) return null
  return res.data
}

export async function deleteCronJob(id: string): Promise<boolean> {
  const res = await fetchApi<{ deleted?: boolean }>(OPENCLAW_PATHS.tasks.byId(id), {
    method: 'DELETE',
  })
  return res.success
}

export async function createWebhook(input: {
  name: string
  endpoint: string
  events?: string
}): Promise<WebhookItem | null> {
  const res = await fetchApi<WebhookItem>(OPENCLAW_PATHS.tasks.execute('webhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.success || !res.data) return null
  return res.data
}

export async function deleteWebhook(id: string): Promise<boolean> {
  const res = await fetchApi<{ deleted?: boolean }>(OPENCLAW_PATHS.tasks.byId(id), {
    method: 'DELETE',
  })
  return res.success
}

export async function createHook(input: {
  type: string
  name: string
  handler: string
}): Promise<HookItem | null> {
  const res = await fetchApi<HookItem>(OPENCLAW_PATHS.tasks.execute('hook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.success || !res.data) return null
  return res.data
}

export async function deleteHook(id: string): Promise<boolean> {
  const res = await fetchApi<{ deleted?: boolean }>(OPENCLAW_PATHS.tasks.byId(id), {
    method: 'DELETE',
  })
  return res.success
}

// ===== Integrations / Channels =====

export interface ChannelItem {
  id: string
  type: string
  name: string
  connected?: boolean
}

export async function listChannels(): Promise<ChannelItem[]> {
  const res = await fetchApi<{ channels: ChannelItem[] } | ChannelItem[]>(
    OPENCLAW_PATHS.channels.list,
  )
  if (!res.success || !res.data) return []
  const data = res.data
  if (Array.isArray(data)) return data
  return data.channels ?? []
}

export async function listSupportedChannels(): Promise<ChannelItem[]> {
  const res = await fetchApi<{ channels: ChannelItem[] } | ChannelItem[]>(
    OPENCLAW_PATHS.channels.supported,
  )
  if (!res.success || !res.data) return []
  const data = res.data
  if (Array.isArray(data)) return data
  return data.channels ?? []
}

export async function connectChannel(id: string): Promise<boolean> {
  const res = await fetchApi<{ connected?: boolean }>(OPENCLAW_PATHS.channels.connect(id), {
    method: 'POST',
  })
  return res.success
}

export async function disconnectChannel(id: string): Promise<boolean> {
  const res = await fetchApi<{ disconnected?: boolean }>(OPENCLAW_PATHS.channels.disconnect(id), {
    method: 'POST',
  })
  return res.success
}

export async function createChannel(input: {
  type: string
  name: string
}): Promise<ChannelItem | null> {
  const res = await fetchApi<ChannelItem>(OPENCLAW_PATHS.channels.list, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.success || !res.data) return null
  return res.data
}

export async function deleteChannel(id: string): Promise<boolean> {
  const res = await fetchApi<{ deleted?: boolean }>(OPENCLAW_PATHS.channels.byId(id), {
    method: 'DELETE',
  })
  return res.success
}

// ===== Models =====

export interface OpenclawModelItem {
  id: string
  name: string
  provider?: string
  context_length?: number
}

export async function listOpenclawModels(): Promise<OpenclawModelItem[]> {
  const base = OPENCLAW_PATHS.gateway.status.replace('/gateway/status', '')
  const res = await fetchApi<OpenclawListResult>(base)
  if (!res.success || !res.data) return []
  return res.data.list.map((item) => ({
    id: item.id,
    name: item.title,
    provider: item.authorId ?? undefined,
  }))
}

// ===== Tools (浏览器面板使用) =====

export interface OpenclawToolItem {
  name: string
  description?: string
  category?: string
}

export async function listOpenclawTools(): Promise<OpenclawToolItem[]> {
  const res = await fetchApi<{ tools: OpenclawToolItem[] } | OpenclawToolItem[]>(
    OPENCLAW_PATHS.tools.list,
  )
  if (!res.success || !res.data) return []
  const data = res.data
  if (Array.isArray(data)) return data
  return data.tools ?? []
}

export async function executeBrowserTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown> | null> {
  const res = await fetchApi<Record<string, unknown>>(OPENCLAW_PATHS.tools.execute(name), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.success || !res.data) return null
  return res.data
}
