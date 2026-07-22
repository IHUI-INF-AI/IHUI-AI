/**
 * Hook 服务 — apps/api → ai-service HTTP 转发层(2026-07-22 立)。
 *
 * 职责:
 *  - 转发 Hook CRUD / 测试 / 日志查询到 ai-service /api/hooks/*
 *  - 失败时降级:返回空数组/空对象,不抛错(供前端兜底渲染)
 *  - 自动透传 traceparent + Authorization
 *
 * 设计:
 *  - apps/api 不存储 Hook 状态,所有读写均委托 ai-service(内存引擎)
 *  - 超时 10s
 *  - 响应统一 { code: 0, message: 'ok', data: ... } 格式
 */

import type { FastifyRequest } from 'fastify'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { logger } from '../utils/logger.js'

/** 调 ai-service 超时(ms) */
const AI_SERVICE_TIMEOUT_MS = 10_000

/**
 * 调用 ai-service /api/hooks/* 的 helper。
 *
 * @param request Fastify request(用于透传 traceparent + Authorization)
 * @param path 相对 ai-service 的路径,如 '/api/hooks' 或 '/api/hooks/abc/test'
 * @param init 标准 fetch init
 * @returns 解析后的 data 字段;失败时返回 null(调用方自行降级)
 */
async function callAiHooks<T>(
  request: FastifyRequest | null,
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT_MS)
  try {
    const response = await aiServiceFetch(request, path, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
    })
    if (!response.ok) {
      logger.warn('[hooks-service] ai-service hooks 调用失败', {
        path,
        status: response.status,
      })
      return null
    }
    const json = (await response.json()) as { code?: number; data?: T; message?: string }
    if (typeof json.code === 'number' && json.code !== 0) {
      logger.warn('[hooks-service] ai-service hooks 业务错误', {
        path,
        code: json.code,
        message: json.message,
      })
      return null
    }
    return (json.data ?? null) as T | null
  } catch (e) {
    logger.warn('[hooks-service] ai-service 调用异常', {
      path,
      err: (e as Error).message,
    })
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================================
// Hook 列表
// ============================================================================

export interface HookListResponse {
  hooks: unknown[]
  count: number
}

/** 列出全部 Hook(可选按 event 过滤)。失败降级返回空数组。 */
export async function listHooks(
  request: FastifyRequest | null,
  event?: string,
): Promise<HookListResponse> {
  const qs = event ? `?event=${encodeURIComponent(event)}` : ''
  const data = await callAiHooks<HookListResponse>(request, `/api/hooks${qs}`, {
    method: 'GET',
  })
  return data ?? { hooks: [], count: 0 }
}

// ============================================================================
// Hook CRUD
// ============================================================================

/** 创建 Hook。返回 null 表示 ai-service 不可用。 */
export async function createHook(
  request: FastifyRequest | null,
  payload: unknown,
): Promise<unknown | null> {
  return callAiHooks<unknown>(request, '/api/hooks', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 获取 Hook 详情。 */
export async function getHook(
  request: FastifyRequest | null,
  hookId: string,
): Promise<unknown | null> {
  return callAiHooks<unknown>(request, `/api/hooks/${encodeURIComponent(hookId)}`, {
    method: 'GET',
  })
}

/** 更新 Hook。 */
export async function updateHook(
  request: FastifyRequest | null,
  hookId: string,
  payload: unknown,
): Promise<unknown | null> {
  return callAiHooks<unknown>(request, `/api/hooks/${encodeURIComponent(hookId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

/** 删除 Hook。返回 true=删除成功 / false=ai-service 不可用或不存在。 */
export async function deleteHook(
  request: FastifyRequest | null,
  hookId: string,
): Promise<boolean> {
  const data = await callAiHooks<{ deleted?: boolean }>(
    request,
    `/api/hooks/${encodeURIComponent(hookId)}`,
    { method: 'DELETE' },
  )
  return data?.deleted === true
}

/** 启用/禁用切换。 */
export async function toggleHook(
  request: FastifyRequest | null,
  hookId: string,
  enabled: boolean,
): Promise<unknown | null> {
  return callAiHooks<unknown>(request, `/api/hooks/${encodeURIComponent(hookId)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })
}

// ============================================================================
// 测试 + 日志
// ============================================================================

export interface HookLogsResponse {
  logs: unknown[]
  count: number
}

export interface TestHookResult {
  triggered: boolean
  logs: unknown[]
}

/** 测试 Hook(模拟触发)。失败降级返回 {triggered: false, logs: []}。 */
export async function testHook(
  request: FastifyRequest | null,
  hookId: string,
  payload: { event: string; context: Record<string, unknown> },
): Promise<TestHookResult> {
  const data = await callAiHooks<TestHookResult>(
    request,
    `/api/hooks/${encodeURIComponent(hookId)}/test`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return data ?? { triggered: false, logs: [] }
}

/** 查询指定 Hook 的日志。失败降级返回空数组。 */
export async function listHookLogs(
  request: FastifyRequest | null,
  hookId: string,
  limit = 100,
): Promise<HookLogsResponse> {
  const data = await callAiHooks<HookLogsResponse>(
    request,
    `/api/hooks/${encodeURIComponent(hookId)}/logs?limit=${limit}`,
    { method: 'GET' },
  )
  return data ?? { logs: [], count: 0 }
}

/** 查询全部 Hook 日志。 */
export async function listAllHookLogs(
  request: FastifyRequest | null,
  limit = 100,
): Promise<HookLogsResponse> {
  const data = await callAiHooks<HookLogsResponse>(
    request,
    `/api/hooks/logs?limit=${limit}`,
    { method: 'GET' },
  )
  return data ?? { logs: [], count: 0 }
}
