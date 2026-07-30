/**
 * Playground 类型定义(中转站在线测试页)。
 * 所有类型显式标注,禁用 any(AGENTS.md §3)。
 */

export type PlaygroundRole = 'system' | 'user' | 'assistant'

export interface PlaygroundMessage {
  id: string
  role: PlaygroundRole
  content: string
}

export interface PlaygroundParams {
  model: string
  /** 0-2,采样温度 */
  temperature: number
  /** 1-8192,最大生成 token 数 */
  maxTokens: number
  /** 0-1,核采样概率 */
  topP: number
  /** 是否流式返回 */
  stream: boolean
}

export interface PlaygroundResponse {
  content: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** 成本估算(单位:分),API 未返回定价时为 0 */
  costCents: number
  latencyMs: number
  model: string
}

export interface PlaygroundHistoryItem {
  id: string
  timestamp: number
  messages: PlaygroundMessage[]
  params: PlaygroundParams
  response: PlaygroundResponse
}

export type CodeLanguage = 'curl' | 'python' | 'nodejs'

/** 默认参数(首次进入页面使用) */
export const DEFAULT_PLAYGROUND_PARAMS: PlaygroundParams = {
  model: '',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  stream: true,
}
