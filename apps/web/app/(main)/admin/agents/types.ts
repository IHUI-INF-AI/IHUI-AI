// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export interface Agent {
  agentId: string
  name: string
  description: string | null
  avatar: string | null
  cover: string | null
  categoryId: string | null
  status: string
  price: number
  isFree: boolean
  sort: number
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface Category {
  categoryId: string
  name: string
}

export interface AgentsData {
  list: Agent[]
  total: number
  page: number
  pageSize: number
}

export interface CategoriesData {
  list: Category[]
  total: number
  page: number
  pageSize: number
}

export interface AgentForm {
  name: string
  description: string
  avatar: string
  cover: string
  categoryId: string
  status: string
  price: string
  isFree: boolean
  sort: string
  remark: string
}

/** GET /api/agents/:agentId/coze/config 的返回体（管理员） */
export interface CozeConfigView {
  agentId: string
  name: string
  botId: string | null
  botName: string | null
  status: string
  source: string | null
  error: string | null
  syncedAt: string | null
  hash: string | null
  version: string | null
  prompt: {
    text: string | null
    mode: string | null
    prefixPrompt: Record<string, unknown> | null
  }
  model: {
    id: string | null
    name: string | null
    temperature: string | null
    topP: string | null
    topK: number | null
    maxTokens: number | null
    contextRound: number | null
    responseFormat: string | null
    presencePenalty: string | null
    frequencyPenalty: string | null
    parameters: Record<string, unknown> | null
  }
  onboarding: Record<string, unknown> | null
  prologue: string | null
  suggestedQuestions: unknown
  plugins: unknown[] | null
  workflows: unknown[] | null
  knowledge: unknown[] | null
  shortcutCommands: unknown[] | null
  voices: unknown[] | null
  mediaConfig: Record<string, unknown> | null
  backgroundImage: Record<string, unknown> | null
  suggestReply: Record<string, unknown> | null
  botMode: number | null
  defaultUserInputType: string | null
  folderId: string | null
  ownerUserId: string | null
  iconUrl: string | null
  description: string | null
  createTime: number | null
  updateTime: number | null
  variables: Array<{
    variableName: string
    variableValue: string | null
    description: string | null
    enabled: boolean | null
    promptEnable: boolean | null
    channel: string | null
  }>
  publicCapabilities: unknown
  raw: Record<string, unknown> | null
  snapshots: Array<{
    id: string
    source: string
    version: string | null
    payloadHash: string
    fetchedAt: string
    isPublished: boolean | null
  }>
}

export interface CozeCoverage {
  credentials: { configured: boolean; envName: string | null; baseUrl: string }
  totalBots: number
  status: {
    synced: number
    partial: number
    error: number
    not_found: number
    skipped_no_token: number
    never: number
  }
  fieldCoverage: Array<{ key: string; label: string; nonNull: number }>
  variables: { rows: number; bots: number }
  lastSyncedAt: string | null
  batch: { size: number; max: number; concurrency: number }
}

export interface CozeSyncManyResult {
  requested: number
  synced: number
  partial: number
  errors: number
  notFound: number
  remaining: number
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
