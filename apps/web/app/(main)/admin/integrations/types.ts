export type Provider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'stripe'
  | 'alipay'
  | 'wechat'
  | 'oss'
  | 's3'
  | 'smtp'
  | 'webhook'

export interface Integration {
  id: string
  name: string
  provider: Provider
  credentials: Record<string, unknown> | string
  isEnabled: boolean
  lastTestedAt?: string
  updatedAt?: string
}

export interface TestResult {
  success: boolean
  message: string
  latency?: number
}

export interface IntegrationForm {
  name: string
  provider: Provider
  credentials: string
  isEnabled: boolean
}
