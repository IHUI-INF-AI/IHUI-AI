/**
 * 跨支柱编排中枢服务 — apps/api → ai-service HTTP 转发层(2026-07-23 立)。
 *
 * 职责:
 *  - 转发编排中枢(事件总线/决策引擎)、LLM 预算治理、统一遥测到 ai-service /api/orchestration/*
 *  - 失败时降级:返回空数组/空对象,不抛错
 *  - 自动透传 traceparent + Authorization
 *
 * 设计:
 *  - apps/api 不存储编排状态,所有读写均委托 ai-service
 *  - 超时 10s
 *  - 响应统一 { code: 0, message: 'success', data: ... } 格式
 */

import type { FastifyRequest } from 'fastify'
import type {
  OrchestrationDashboard,
  OrchestrationPlaybook,
  OrchestrationDecision,
  BudgetCheckResult,
  UsageSummary,
  UsageTrendItem,
  PillarBudget,
  CostBreakdown,
  PillarHealth,
  TelemetryDashboard,
  TraceSpan,
  EmitEventRequest,
} from '@ihui/types/orchestration'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { logger } from '../utils/logger.js'

const AI_SERVICE_TIMEOUT_MS = 10_000

/** 调用 ai-service /api/orchestration/* 的 helper */
async function callOrchestration<T>(
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
      logger.warn('[orchestration-service] ai-service 调用失败', {
        path,
        status: response.status,
      })
      return null
    }
    const json = (await response.json()) as {
      code?: number
      data?: T
      message?: string
    }
    if (typeof json.code === 'number' && json.code !== 0) {
      logger.warn('[orchestration-service] ai-service 业务错误', {
        path,
        code: json.code,
        message: json.message,
      })
      return null
    }
    return json.data ?? (json as unknown as T)
  } catch (err) {
    logger.warn('[orchestration-service] 请求异常', { path, err })
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// 编排中枢
// ---------------------------------------------------------------------------

export async function getHubStatus(
  request: FastifyRequest,
): Promise<Record<string, unknown> | null> {
  return callOrchestration(request, '/api/orchestration/status')
}

export async function getHubDashboard(
  request: FastifyRequest,
): Promise<OrchestrationDashboard | null> {
  return callOrchestration(request, '/api/orchestration/dashboard')
}

export async function getEventFeed(
  request: FastifyRequest,
  limit = 50,
  pillar?: string,
  eventType?: string,
): Promise<unknown[] | null> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (pillar) params.set('pillar', pillar)
  if (eventType) params.set('event_type', eventType)
  return callOrchestration(request, `/api/orchestration/events?${params}`)
}

export async function emitEvent(
  request: FastifyRequest,
  body: EmitEventRequest,
): Promise<{ event_id: string } | null> {
  return callOrchestration(request, '/api/orchestration/events/emit', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getEventStats(
  request: FastifyRequest,
  windowHours = 24,
): Promise<Record<string, unknown> | null> {
  return callOrchestration(
    request,
    `/api/orchestration/events/stats?window_hours=${windowHours}`,
  )
}

export async function getPlaybooks(
  request: FastifyRequest,
): Promise<OrchestrationPlaybook[] | null> {
  return callOrchestration(request, '/api/orchestration/playbooks')
}

export async function togglePlaybook(
  request: FastifyRequest,
  playbookId: string,
  enabled: boolean,
): Promise<{ success: boolean } | null> {
  return callOrchestration(
    request,
    `/api/orchestration/playbooks/${playbookId}/toggle`,
    {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    },
  )
}

export async function getDecisions(
  request: FastifyRequest,
  limit = 50,
): Promise<OrchestrationDecision[] | null> {
  return callOrchestration(
    request,
    `/api/orchestration/decisions?limit=${limit}`,
  )
}

// ---------------------------------------------------------------------------
// LLM 预算治理
// ---------------------------------------------------------------------------

export async function recordBudgetUsage(
  request: FastifyRequest,
  body: {
    pillar: string
    model: string
    input_tokens: number
    output_tokens: number
    action: string
    request_id?: string
  },
): Promise<Record<string, unknown> | null> {
  return callOrchestration(request, '/api/orchestration/budget/record', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function checkBudget(
  request: FastifyRequest,
  pillar: string,
  estimatedTokens = 0,
): Promise<BudgetCheckResult | null> {
  return callOrchestration(request, '/api/orchestration/budget/check', {
    method: 'POST',
    body: JSON.stringify({ pillar, estimated_tokens: estimatedTokens }),
  })
}

export async function getBudgetSummary(
  request: FastifyRequest,
  period = 'today',
): Promise<UsageSummary | null> {
  return callOrchestration(
    request,
    `/api/orchestration/budget/summary?period=${period}`,
  )
}

export async function getBudgetTrend(
  request: FastifyRequest,
  days = 7,
): Promise<UsageTrendItem[] | null> {
  return callOrchestration(
    request,
    `/api/orchestration/budget/trend?days=${days}`,
  )
}

export async function getPillarBudget(
  request: FastifyRequest,
  pillar: string,
): Promise<PillarBudget | null> {
  return callOrchestration(
    request,
    `/api/orchestration/budget/pillar/${pillar}`,
  )
}

export async function resetPillarDegradation(
  request: FastifyRequest,
  pillar: string,
): Promise<{ success: boolean } | null> {
  return callOrchestration(
    request,
    `/api/orchestration/budget/pillar/${pillar}/reset`,
    { method: 'POST' },
  )
}

export async function updateBudgetConfig(
  request: FastifyRequest,
  config: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  return callOrchestration(request, '/api/orchestration/budget/config', {
    method: 'PATCH',
    body: JSON.stringify(config),
  })
}

export async function getCostBreakdown(
  request: FastifyRequest,
  period = 'today',
): Promise<CostBreakdown | null> {
  return callOrchestration(
    request,
    `/api/orchestration/budget/cost-breakdown?period=${period}`,
  )
}

// ---------------------------------------------------------------------------
// 统一遥测
// ---------------------------------------------------------------------------

export async function getMetrics(
  request: FastifyRequest,
  format = 'json',
): Promise<Record<string, unknown> | null> {
  return callOrchestration(
    request,
    `/api/orchestration/telemetry/metrics?format=${format}`,
  )
}

export async function getTelemetryHealth(
  request: FastifyRequest,
): Promise<Record<string, PillarHealth> | null> {
  return callOrchestration(request, '/api/orchestration/telemetry/health')
}

export async function getTelemetryDashboard(
  request: FastifyRequest,
): Promise<TelemetryDashboard | null> {
  return callOrchestration(request, '/api/orchestration/telemetry/dashboard')
}

export async function getRecentTraces(
  request: FastifyRequest,
  limit = 20,
): Promise<TraceSpan[] | null> {
  return callOrchestration(
    request,
    `/api/orchestration/telemetry/traces?limit=${limit}`,
  )
}

export async function getTraceDetail(
  request: FastifyRequest,
  traceId: string,
): Promise<TraceSpan[] | null> {
  return callOrchestration(
    request,
    `/api/orchestration/telemetry/traces/${traceId}`,
  )
}
