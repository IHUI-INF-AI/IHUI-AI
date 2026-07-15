// 用户级 LLM 配置 — 类型定义

export interface PlatformTemplate {
  code: string
  name: string
  vendor: string
  description: string
  baseUrl: string
  apiFormat: 'openai_chat' | 'anthropic_messages' | 'openai_responses'
  defaultModelId: string
  defaultContextLength: number
  modelsListPath?: string
  isOfficial: boolean
  docsUrl?: string
  signupUrl?: string
}

export interface UserLlmConfig {
  id: number
  name: string
  providerCode: string
  isBuiltin: boolean
  baseUrl: string
  apiFormat: string
  modelIdForTest: string | null
  enabled: boolean
  description: string | null
  contextLength: number
  hasApiKey: boolean
  lastTestStatus: 'success' | 'failed' | null
  lastTestResponseMs: number | null
  lastTestedAt: string | null
  lastTestError: string | null
  createdAt: string
  updatedAt: string
}

export interface UpstreamModel {
  id: string
  owned_by?: string
  context_length?: number
}

export interface TestResult {
  status: 'success' | 'failed'
  responseMs?: number
  modelEcho?: string
  message?: string
}

export interface FetchModelsResult {
  total: number
  models: UpstreamModel[]
  message?: string
}

/** 新建/编辑表单状态(用户只填 apiKey / modelId / contextLength / name / baseUrl) */
export interface FormState {
  /** 编辑时为已有 id;新建时为 null */
  id: number | null
  templateCode: string
  name: string
  apiKey: string
  modelId: string
  contextLength: string
  description: string
  baseUrlOverride: string
  enabled: boolean
}

export const EMPTY_FORM: FormState = {
  id: null,
  templateCode: 'openai',
  name: '',
  apiKey: '',
  modelId: '',
  contextLength: '32000',
  description: '',
  baseUrlOverride: '',
  enabled: true,
}
