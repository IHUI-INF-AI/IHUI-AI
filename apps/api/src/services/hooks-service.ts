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

/**
 * Hook 日志过滤参数(2026-07-22 立)。
 *
 * 透传给 ai-service(router 未来扩展可用),同时在 api 层做客户端兜底过滤
 * (当前 ai-service router 不识别这些 query 参数,需要 api 层确保过滤生效)。
 */
export interface HookLogsFilter {
  /** 按触发事件过滤 */
  event?: string
  /** 按成功/失败过滤 */
  success?: boolean
  /** 耗时下限(ms,含) */
  durationMin?: number
  /** 耗时上限(ms,含) */
  durationMax?: number
  /** 起始时间(ISO 字符串,含) */
  since?: string
  /** 截止时间(ISO 字符串,含) */
  until?: string
}

/**
 * Hook 执行统计(2026-07-22 立)。
 *
 * 由 api 层从 ai-service 拉取日志后计算(最多 1000 条)。
 */
export interface HookStats {
  total: number
  success: number
  failed: number
  avgDuration: number
}

/**
 * 把 HookLogsFilter 序列化为 query string。
 *
 * 同时透传给 ai-service(未来 router 扩展可用)+ api 层兜底过滤。
 */
function filterToQueryParams(filter: HookLogsFilter | undefined): URLSearchParams {
  const params = new URLSearchParams()
  if (!filter) return params
  if (filter.event) params.set('event', filter.event)
  if (filter.success !== undefined) params.set('success', String(filter.success))
  if (filter.durationMin !== undefined) params.set('durationMin', String(filter.durationMin))
  if (filter.durationMax !== undefined) params.set('durationMax', String(filter.durationMax))
  if (filter.since) params.set('since', filter.since)
  if (filter.until) params.set('until', filter.until)
  return params
}

/**
 * 客户端兜底过滤(ai-service router 可能不识别过滤参数)。
 *
 * 直接在 api 层对返回的 logs 做过滤,确保过滤条件生效。
 */
function applyLogsFilter(
  logs: unknown[],
  filter: HookLogsFilter | undefined,
): unknown[] {
  if (!filter) return logs
  return logs.filter((item) => {
    const log = item as Record<string, unknown>
    if (filter.event && log.event !== filter.event) return false
    if (filter.success !== undefined && log.success !== filter.success) return false
    if (filter.durationMin !== undefined) {
      const dur = Number(log.duration ?? 0)
      if (dur < filter.durationMin) return false
    }
    if (filter.durationMax !== undefined) {
      const dur = Number(log.duration ?? 0)
      if (dur > filter.durationMax) return false
    }
    if (filter.since) {
      const at = String(log.triggeredAt ?? '')
      if (at < filter.since) return false
    }
    if (filter.until) {
      const at = String(log.triggeredAt ?? '')
      if (at > filter.until) return false
    }
    return true
  })
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

/** 查询指定 Hook 的日志(支持过滤参数)。失败降级返回空数组。 */
export async function listHookLogs(
  request: FastifyRequest | null,
  hookId: string,
  limit = 100,
  filter?: HookLogsFilter,
): Promise<HookLogsResponse> {
  const params = filterToQueryParams(filter)
  params.set('limit', String(limit))
  const data = await callAiHooks<HookLogsResponse>(
    request,
    `/api/hooks/${encodeURIComponent(hookId)}/logs?${params.toString()}`,
    { method: 'GET' },
  )
  if (!data) return { logs: [], count: 0 }
  // 客户端兜底过滤(ai-service router 可能不识别过滤参数)
  const logs = applyLogsFilter(data.logs ?? [], filter)
  return { logs, count: logs.length }
}

/** 查询全部 Hook 日志(支持过滤参数)。 */
export async function listAllHookLogs(
  request: FastifyRequest | null,
  limit = 100,
  filter?: HookLogsFilter,
): Promise<HookLogsResponse> {
  const params = filterToQueryParams(filter)
  params.set('limit', String(limit))
  const data = await callAiHooks<HookLogsResponse>(
    request,
    `/api/hooks/logs?${params.toString()}`,
    { method: 'GET' },
  )
  if (!data) return { logs: [], count: 0 }
  const logs = applyLogsFilter(data.logs ?? [], filter)
  return { logs, count: logs.length }
}

// ============================================================================
// 批量操作 + 统计(2026-07-22 立)
// ============================================================================

/** 批量启用/禁用结果条目 */
export interface BatchToggleResultItem {
  id: string
  success: boolean
  /** 失败原因(success=false 时填) */
  error?: string
}

/** 批量启用/禁用响应 */
export interface BatchToggleResponse {
  results: BatchToggleResultItem[]
  /** 成功数 */
  succeeded: number
  /** 失败数 */
  failed: number
}

/**
 * 批量启用/禁用 Hook(2026-07-22 立)。
 *
 * 并发调用 toggleHook,每个 Hook 独立处理,单个失败不影响其他。
 * 返回每个 Hook 的处理结果。
 */
export async function batchToggleHooks(
  request: FastifyRequest | null,
  hookIds: string[],
  enabled: boolean,
): Promise<BatchToggleResponse> {
  if (hookIds.length === 0) {
    return { results: [], succeeded: 0, failed: 0 }
  }
  const results = await Promise.all(
    hookIds.map(async (id): Promise<BatchToggleResultItem> => {
      const hook = await toggleHook(request, id, enabled)
      if (hook === null) {
        return { id, success: false, error: 'Hook 不存在或服务不可用' }
      }
      return { id, success: true }
    }),
  )
  const succeeded = results.filter((r) => r.success).length
  return {
    results,
    succeeded,
    failed: results.length - succeeded,
  }
}

/**
 * 获取 Hook 执行统计(2026-07-22 立)。
 *
 * 从 ai-service 拉取日志(最多 1000 条)后在 api 层计算统计。
 * 失败降级返回全 0 统计。
 *
 * @param hookId 可选,指定 Hook ID 时只统计该 Hook
 */
export async function getHookStats(
  request: FastifyRequest | null,
  hookId?: string,
): Promise<HookStats> {
  const empty: HookStats = { total: 0, success: 0, failed: 0, avgDuration: 0 }
  const data = hookId
    ? await listHookLogs(request, hookId, 1000)
    : await listAllHookLogs(request, 1000)
  const logs = (data.logs ?? []) as Array<{
    success?: boolean
    duration?: number
  }>
  const total = logs.length
  if (total === 0) return empty
  const successCount = logs.filter((l) => l.success === true).length
  const failedCount = total - successCount
  const totalDuration = logs.reduce((sum, l) => sum + (Number(l.duration ?? 0)), 0)
  const avgDuration = Math.round((totalDuration / total) * 100) / 100
  return {
    total,
    success: successCount,
    failed: failedCount,
    avgDuration,
  }
}
