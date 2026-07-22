/**
 * Clawdbot Integrations - 集成服务
 *
 * 第三方 API 管理。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export interface IntegrationConfig {
  id: string
  name: string
  type: string
  baseUrl?: string
  apiKey?: string
  authType?: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth'
  headers?: Record<string, string>
  enabled: boolean
  config: Record<string, unknown>
}

export interface IntegrationRequest {
  integrationId: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  query?: Record<string, string>
  headers?: Record<string, string>
}

export interface IntegrationResponse {
  status: number
  data: unknown
  headers: Record<string, string>
  duration: number
}

export class IntegrationManager extends EventEmitter {
  /**
   * 内存集成配置存储。
   *
   * 持久化现状(2026-07-22 评估):
   *   - 无对应 DB 表
   *   - 集成配置含 apiKey 等敏感字段,需加密存储
   *   - 现有 userPreferences 表设计为 userId-scoped 偏好,不适用于系统级集成配置
   *
   * 迁移规格(未来需要时):
   *   1. 新建 `clawdbot_integrations` 表:id / name / type / base_url / api_key_encrypted /
   *      auth_type / headers(jsonb) / enabled / config(jsonb) / created_by / created_at / updated_at
   *   2. api_key_encrypted 用 AES-256-GCM + KMS 包封,禁止明文入库
   *   3. register() 时 upsert 到 DB;unregister() 时软删除(enabled=false)
   *   4. list()/get() 优先读 DB,启动时全量加载到内存缓存
   *   5. 增加 rotate-key 接口定期轮换 apiKey
   */
  private integrations = new Map<string, IntegrationConfig>()

  register(config: IntegrationConfig): void {
    this.integrations.set(config.id, config)
    logger.info({ integration: config.id, type: config.type }, '[Integrations] Registered')
    this.emit('registered', config)
  }

  unregister(id: string): boolean {
    return this.integrations.delete(id)
  }

  get(id: string): IntegrationConfig | undefined {
    return this.integrations.get(id)
  }

  list(): IntegrationConfig[] {
    return Array.from(this.integrations.values())
  }

  listEnabled(): IntegrationConfig[] {
    return this.list().filter((i) => i.enabled)
  }

  async call(request: IntegrationRequest): Promise<IntegrationResponse> {
    const integration = this.integrations.get(request.integrationId)
    if (!integration || !integration.enabled) {
      throw new Error(`Integration "${request.integrationId}" not found or disabled`)
    }

    const url = integration.baseUrl
      ? new URL(request.path, integration.baseUrl).toString()
      : request.path

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...integration.headers,
      ...request.headers,
    }

    this.applyAuth(headers, integration)

    const start = Date.now()
    const queryString = request.query
      ? '?' + new URLSearchParams(request.query).toString()
      : ''
    const response = await fetch(`${url}${queryString}`, {
      method: request.method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
    })

    const data = await response.json().catch(() => null)
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    const result: IntegrationResponse = {
      status: response.status,
      data,
      headers: responseHeaders,
      duration: Date.now() - start,
    }

    logger.debug({ integration: request.integrationId, status: response.status, duration: result.duration }, '[Integrations] Called')
    this.emit('called', { request, result })
    return result
  }

  private applyAuth(headers: Record<string, string>, integration: IntegrationConfig): void {
    switch (integration.authType) {
      case 'api_key':
        if (integration.apiKey) headers['X-API-Key'] = integration.apiKey
        break
      case 'bearer':
        if (integration.apiKey) headers['Authorization'] = `Bearer ${integration.apiKey}`
        break
      case 'basic':
        if (integration.apiKey) headers['Authorization'] = `Basic ${Buffer.from(integration.apiKey).toString('base64')}`
        break
    }
  }

  getStats() {
    return {
      total: this.integrations.size,
      enabled: this.listEnabled().length,
    }
  }
}

let instance: IntegrationManager | null = null

export function getIntegrationManager(): IntegrationManager {
  if (!instance) instance = new IntegrationManager()
  return instance
}
