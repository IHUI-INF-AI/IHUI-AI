/**
 * AI 厂商统一调用服务（R4 重构产物）。
 *
 * 背景：原 ai-vendors.ts 中 callVendor 函数耦合了 fetch 逻辑、错误处理、鉴权头构造。
 * 重构后本服务作为唯一调用入口，封装以下流程：
 * 1. 解析厂商配置（DB → FALLBACK 回退）
 * 2. 校验启用状态与凭据完整性
 * 3. 选择鉴权策略并构建签名
 * 4. fetch + 统一错误处理
 *
 * 签名要求：业务路由文件（ai-vendors.ts）调用此服务后无需关心签名细节，
 * 也无需感知数据库是否可用（由 FALLBACK_VENDORS 兜底）。
 */
import type { FastifyReply } from 'fastify'
import { resolveVendor, getVendorCredentials } from './ai-vendor-config-service.js'
import { authStrategyFactory } from './vendor-auth-strategies.js'
import { VendorErrorHandler } from './vendor-error-handler.js'
import { generateCompactId } from '../utils/crypto-random.js'

/** 调用上下文 */
export interface CallVendorContext {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  endpoint: string
  body?: unknown
  queryParams?: Record<string, string>
  /** 超时时间（毫秒），默认 30 秒；同步任务 60 秒 */
  timeoutMs?: number
  /** 厂商额外配置覆盖（与 ai_vendor_configs.configJson 合并） */
  configOverride?: Record<string, unknown>
}

const DEFAULT_TIMEOUT_MS = 30_000

/**
 * 带超时的 fetch。AbortController 在 timeoutMs 后触发 abort。
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 调用厂商 API 并返回 JSON 响应。
 *
 * @returns 成功时返回 parsed JSON；失败时由本服务通过 reply 写入错误响应并返回 null。
 *          调用方应通过 `if (data === null) return` 终止后续流程。
 */
export async function callVendor(
  vendorCode: string,
  ctx: CallVendorContext,
  reply: FastifyReply,
): Promise<unknown | null> {
  // 1. 解析厂商配置（DB 优先，FALLBACK 兜底）
  const vendor = await resolveVendor(vendorCode)
  if (!vendor) {
    reply.status(400).send({
      code: 400,
      message: `不支持的厂商: ${vendorCode}`,
    })
    return null
  }

  if (!vendor.isEnabled) {
    VendorErrorHandler.handleConfigError(reply, vendorCode, '厂商已禁用')
    return null
  }

  // 2. 加载凭据（从环境变量）
  const credentials = getVendorCredentials(vendor)
  if (!VendorErrorHandler.validateCredentials(reply, vendor, credentials)) {
    return null
  }

  // 3. 选择鉴权策略
  let strategy
  try {
    strategy = authStrategyFactory.getStrategy(vendor.authType)
  } catch (err) {
    VendorErrorHandler.handleConfigError(
      reply,
      vendorCode,
      err instanceof Error ? err.message : `鉴权策略 ${vendor.authType} 不可用`,
    )
    return null
  }

  if (!strategy.validateCredentials(credentials)) {
    VendorErrorHandler.handleConfigError(reply, vendorCode, '凭据不完整')
    return null
  }

  // 4. 构建签名 / header
  const mergedConfig: Record<string, unknown> = {
    ...(vendor.configJson ?? {}),
    ...(ctx.configOverride ?? {}),
  }
  let authResult
  try {
    authResult = strategy.buildHeaders(credentials, {
      method: ctx.method,
      url: ctx.endpoint,
      body: ctx.body,
      queryParams: ctx.queryParams,
      config: mergedConfig,
    })
  } catch (err) {
    VendorErrorHandler.handleConfigError(
      reply,
      vendorCode,
      err instanceof Error ? err.message : '鉴权失败',
    )
    return null
  }

  // 5. 拼接 URL
  const url = authResult.url ?? `${vendor.baseUrl}${ctx.endpoint}`
  const timeoutMs = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const finalBody = authResult.body ?? (ctx.body ? JSON.stringify(ctx.body) : undefined)

  // 6. fetch
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: ctx.method,
        headers: {
          'Content-Type': 'application/json',
          ...authResult.headers,
        },
        body: finalBody,
      },
      timeoutMs,
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      VendorErrorHandler.handleApiError(reply, vendor.vendorName, response.status, errorData)
      return null
    }

    return await response.json().catch(() => ({}))
  } catch (err) {
    VendorErrorHandler.handleNetworkError(
      reply,
      vendor.vendorName,
      err instanceof Error ? err : new Error(String(err)),
    )
    return null
  }
}

/**
 * 异步调用厂商 API（用于立即返回 taskId、由前端轮询状态的场景）。
 * 与 callVendor 的区别：忽略 body，统一返回 { taskId, status, raw } 包装。
 */
export async function callVendorAsync(
  vendorCode: string,
  ctx: Omit<CallVendorContext, 'method'>,
  reply: FastifyReply,
): Promise<{ taskId: string; status: string; raw: unknown } | null> {
  const data = await callVendor(vendorCode, { ...ctx, method: 'POST' }, reply)
  if (data === null) return null
  return {
    // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成 taskId
    // 风险:可预测 taskId → 攻击者枚举其他用户的 AI 生成任务 → 越权查询结果
    taskId: generateCompactId('task'),
    status: 'pending',
    raw: data,
  }
}
