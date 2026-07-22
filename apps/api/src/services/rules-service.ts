/**
 * Rules 服务 — 调用 ai-service 的 HTTP client。
 *
 * 端点对应 ai-service 的 /api/rules/*:
 *  - GET    /rules          → listRules
 *  - POST   /rules          → createRule
 *  - GET    /rules/:id      → getRule
 *  - PATCH  /rules/:id      → updateRule
 *  - DELETE /rules/:id      → deleteRule
 *  - POST   /rules/:id/test → testRule
 *  - POST   /rules/match    → matchRules
 *
 * 超时 10s,失败降级返回空数组 + warning header(由调用方处理)。
 */

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || 'http://localhost:8000'
const TIMEOUT_MS = 10_000

export interface RuleDto {
  id: string
  name: string
  description?: string
  content: string
  scope: 'global' | 'workspace' | 'agent'
  agentId?: string
  priority: number
  enabled: boolean
  matchType: 'always' | 'keyword' | 'regex' | 'semantic'
  matchPattern?: string
  createdAt: string
  updatedAt: string
}

export interface RuleListDto {
  rules: RuleDto[]
  total: number
}

export interface RuleTestResultDto {
  matched: boolean
  reason: string
}

export interface RuleMatchResultDto {
  appliedRules: RuleDto[]
  promptSuffix: string
}

interface AiServiceResponse<T> {
  code: number
  message: string
  data: T
}

class RulesService {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || AI_SERVICE_URL).replace(/\/$/, '')
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}/api/rules${path}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const resp = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        throw new Error(`ai-service HTTP ${resp.status}: ${text.slice(0, 200)}`)
      }
      const body = (await resp.json()) as AiServiceResponse<T>
      if (body.code !== 0) {
        throw new Error(body.message || 'ai-service 返回错误')
      }
      return body.data
    } finally {
      clearTimeout(timer)
    }
  }

  async listRules(): Promise<RuleListDto> {
    try {
      return await this.request<RuleListDto>('')
    } catch (e) {
      console.warn('[rules-service] listRules 降级返回空:', (e as Error).message)
      return { rules: [], total: 0 }
    }
  }

  async createRule(input: Record<string, unknown>): Promise<RuleDto> {
    return this.request<RuleDto>('', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async getRule(id: string): Promise<RuleDto | null> {
    try {
      return await this.request<RuleDto>(`/${encodeURIComponent(id)}`)
    } catch {
      return null
    }
  }

  async updateRule(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<RuleDto | null> {
    try {
      return await this.request<RuleDto>(`/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
    } catch {
      return null
    }
  }

  async deleteRule(id: string): Promise<boolean> {
    try {
      await this.request<{ id: string; deleted: boolean }>(
        `/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      )
      return true
    } catch {
      return false
    }
  }

  async testRule(
    id: string,
    message: string,
  ): Promise<RuleTestResultDto> {
    return this.request<RuleTestResultDto>(
      `/${encodeURIComponent(id)}/test`,
      { method: 'POST', body: JSON.stringify({ message }) },
    )
  }

  async matchRules(
    message: string,
    scope?: string,
  ): Promise<RuleMatchResultDto> {
    try {
      return await this.request<RuleMatchResultDto>('/match', {
        method: 'POST',
        body: JSON.stringify({ message, scope }),
      })
    } catch (e) {
      console.warn('[rules-service] matchRules 降级返回空:', (e as Error).message)
      return { appliedRules: [], promptSuffix: '' }
    }
  }
}

export const rulesService = new RulesService()
