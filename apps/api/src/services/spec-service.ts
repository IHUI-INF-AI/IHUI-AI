/**
 * Spec 服务(2026-07-22 新增,对标 Trae IDE Spec 模式)。
 *
 * 跨服务调用 ai-service 的 spec 端点,封装 HTTP 请求 + 超时控制 + 错误兜底。
 * - generate:  POST /api/spec/generate   → 从代码 AST 生成 spec 文档
 * - templates: GET  /api/spec/templates  → 预置模板列表
 *
 * 调用链路: web SpecPanel → apps/api /spec/* → 本服务 → ai-service /api/spec/*
 */

import type { FastifyRequest } from 'fastify'
import type {
  SpecGenerateInput,
  SpecGenerateOutput,
  SpecTemplate,
} from '@ihui/types'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { logger } from '../utils/logger.js'

/** ai-service spec 端点路径(已含 /api 前缀,由 ai-service main.py include_router 注册) */
const SPEC_GENERATE_PATH = '/api/spec/generate'
const SPEC_TEMPLATES_PATH = '/api/spec/templates'

/** spec 生成超时(30s,生成耗时较长) */
const SPEC_TIMEOUT_MS = 30_000

/** ai-service 统一响应格式 */
interface AiServiceResponse<T> {
  code: number
  message: string
  data: T | null
}

class SpecService {
  /**
   * 生成 spec 文档。
   *
   * @param request 当前 Fastify request(用于透传 traceparent + Authorization)
   * @param input   生成参数(scope + workspacePath + 可选 includeDependencies / languages)
   * @returns SpecGenerateOutput(spec markdown + sections + stats + durationMs),失败抛 Error
   */
  async generate(
    request: FastifyRequest,
    input: SpecGenerateInput,
  ): Promise<SpecGenerateOutput> {
    try {
      const resp = await aiServiceFetch(request, SPEC_GENERATE_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: input.scope,
          workspacePath: input.workspacePath,
          includeDependencies: input.includeDependencies ?? true,
          languages: input.languages,
        }),
        signal: AbortSignal.timeout(SPEC_TIMEOUT_MS),
      })

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        throw new Error(
          `ai-service spec/generate HTTP ${resp.status}: ${errText.slice(0, 200)}`,
        )
      }

      const json = (await resp.json()) as AiServiceResponse<SpecGenerateOutput>
      if (json.code !== 0 || !json.data) {
        throw new Error(json.message || 'ai-service spec 生成失败')
      }
      return json.data
    } catch (e) {
      logger.warn(`[spec-service.generate] 调用 ai-service 失败: ${(e as Error).message}`)
      throw e
    }
  }

  /**
   * 获取预置 spec 模板列表。
   *
   * @param request 当前 Fastify request(用于透传 traceparent + Authorization)
   * @returns SpecTemplate[],失败抛 Error
   */
  async getTemplates(request: FastifyRequest): Promise<SpecTemplate[]> {
    try {
      const resp = await aiServiceFetch(request, SPEC_TEMPLATES_PATH, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      })

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        throw new Error(
          `ai-service spec/templates HTTP ${resp.status}: ${errText.slice(0, 200)}`,
        )
      }

      const json = (await resp.json()) as AiServiceResponse<{
        templates: SpecTemplate[]
      }>
      if (json.code !== 0 || !json.data) {
        throw new Error(json.message || 'ai-service 模板获取失败')
      }
      return json.data.templates
    } catch (e) {
      logger.warn(`[spec-service.getTemplates] 调用 ai-service 失败: ${(e as Error).message}`)
      throw e
    }
  }
}

export const specService = new SpecService()
