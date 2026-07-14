export interface ModelRow {
  id: number
  name: string
  providerCode: string
  isBuiltin: boolean
  baseUrl: string
  apiFormat: string
  modelIdForTest: string | null
  enabled: boolean
  description: string | null
  sortOrder: number
  ownerUuid: string | null
  lastTestStatus: string | null
  lastTestResponseMs: number | null
  lastTestedAt: string | null
  lastTestError: string | null
  hasApiKey: boolean
  createdAt: string
  updatedAt: string
}

export interface ListData {
  list: ModelRow[]
  total: number
  page: number
  pageSize: number
}

export interface FormState {
  name: string
  providerCode: string
  baseUrl: string
  apiFormat: string
  modelIdForTest: string
  apiKey: string
  description: string
  sortOrder: string
  enabled: boolean
  ownerUuid: string
}

export interface TestResult {
  status: string
  responseMs?: number
}
