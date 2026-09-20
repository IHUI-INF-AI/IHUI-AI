// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ApiKeyPermission } from '@ihui/types'
import {
  getCapability,
  isM2MAllowed,
  requireCapabilityOrThrow,
  type CapabilityEntry,
} from '@ihui/types'
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import { authenticateApiKey } from '../plugins/api-key-auth.js'

declare module 'fastify' {
  interface FastifyRequest {
    /** 本请求命中的能力声明,由能力闸注入,供数据闸(scoped-guard)消费。 */
    capability?: CapabilityEntry
    /** 客户端传入的 Idempotency-Key(已去空白、截断),供重放层消费。 */
    idempotencyKey?: string
  }
}

const IDEMPOTENT_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** 请求是否携带 API Key 凭据(用于"API Key 或人 JWT 双通道"端点的分支判定)。 */
export function hasApiKeyCredential(request: FastifyRequest): boolean {
  const auth = request.headers.authorization
  if (typeof auth === 'string' && auth.startsWith('Bearer ihui_')) return true
  return typeof request.headers['x-api-key'] === 'string'
}

/** 单条路径→能力映射,供插件级 addHook 一次覆盖整个路由族。 */
export interface CapabilityRule {
  /** HTTP 方法(大写);省略表示任意方法 */
  methods?: readonly string[]
  /** 匹配完整 URL(含注册前缀,不含 query) */
  pattern: RegExp
  scope: ApiKeyPermission
}

function grantedPermissions(request: FastifyRequest): string[] {
  const granted = request.apiKey?.permissions
  if (Array.isArray(granted)) return granted as string[]
  const legacy = granted as { permissions?: unknown } | undefined
  if (Array.isArray(legacy?.permissions)) return legacy.permissions as string[]
  return []
}

/**
 * 鉴权兜底:链路里若已跑过 requireApiKeyAuth 则复用其结果,否则本闸自己鉴权 ——
 * 使 `[requireCapability(...)]` 单独使用、或被 addHook 抢先执行时都能正确工作。
 * 返回 false 表示已回复错误,调用方须立即 return。
 */
async function ensureApiKey(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (request.apiKey) return true
  try {
    await authenticateApiKey(request)
    return true
  } catch (e) {
    const err = e as Error & { statusCode?: number; code?: number; retryAfter?: number }
    const statusCode = err.statusCode ?? 401
    if (statusCode === 429 && typeof err.retryAfter === 'number') {
      await reply
        .status(429)
        .header('Retry-After', String(err.retryAfter))
        .send({
          code: err.code ?? 429,
          message: err.message || 'Rate limit exceeded',
          retryAfter: err.retryAfter,
        })
      return false
    }
    await reply
      .status(statusCode)
      .send({ code: statusCode, message: err.message || '请提供 API Key 鉴权' })
    return false
  }
}

/** 能力闸核心判定:鉴权 → 目录允许 → scope 命中 → 幂等键要求 → 注入 capability。 */
async function enforceCapability(
  scope: ApiKeyPermission,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const entry = requireCapabilityOrThrow(scope)
  if (!(await ensureApiKey(request, reply))) return false
  if (!isM2MAllowed(scope)) {
    await reply.status(403).send({
      code: 403,
      message: 'Capability is not available to API keys',
      errorCode: 'M2M_FORBIDDEN',
      scope,
    })
    return false
  }
  const granted = grantedPermissions(request)
  // '*' 通配只在目录已登记且 isM2MAllowed 的范围内生效(platform 域已在上一步拦住)
  if (!granted.includes(scope) && !granted.includes('*')) {
    await reply.status(403).send({
      code: 403,
      message: `Missing capability: ${scope}`,
      errorCode: 'SCOPE_REQUIRED',
      requiredScope: scope,
    })
    return false
  }
  // 幂等键:登记供重放层(O10)消费。此处不硬性 400 —— OpenAI 官方 SDK 不会发
  // Idempotency-Key,强制要求会直接打断标准客户端的互操作性。
  if (entry.idempotencyRequired && !IDEMPOTENT_SAFE_METHODS.has(request.method)) {
    const key = request.headers['idempotency-key']
    if (typeof key === 'string' && key.trim() !== '')
      request.idempotencyKey = key.trim().slice(0, 200)
  }
  request.capability = entry
  return true
}

/**
 * 能力闸 preHandler。用法:`preHandler: [requireApiKeyAuth, requireCapability('assistants:write')]`
 *
 * 与 requireApiKeyPermission 的关键差异:能否被机器凭据调用由能力目录判定 ——
 * platform 域、未登记 scope、thirdPartyEligible=false 一律 403,而不是"有 active key 就行"。
 * scope 未登记会在服务启动期直接抛错,目录与路由漂移不可能静默上线。
 */
export function requireCapability(scope: ApiKeyPermission): preHandlerAsyncHookHandler {
  requireCapabilityOrThrow(scope)
  return async (request, reply) => {
    await enforceCapability(scope, request, reply)
  }
}

/** 命中任一 scope 即放行(同一端点服务多种调用方时使用)。 */
export function requireAnyCapability(
  scopes: readonly ApiKeyPermission[],
): preHandlerAsyncHookHandler {
  const candidates = scopes.filter((s) => isM2MAllowed(s))
  return async (request, reply) => {
    if (!(await ensureApiKey(request, reply))) return
    const granted = grantedPermissions(request)
    const hit = candidates.find((s) => granted.includes(s) || granted.includes('*'))
    if (!hit) {
      await reply.status(403).send({
        code: 403,
        message: `Missing any capability of: ${candidates.join(', ') || 'none M2M-eligible'}`,
        errorCode: 'SCOPE_REQUIRED',
        requiredAnyOf: candidates,
      })
      return
    }
    request.capability = getCapability(hit)
  }
}

/**
 * 路径规则表版能力闸:`addHook('preHandler', requireCapabilityRules([...]))` 覆盖整族端点。
 * 未匹配任何规则 → 403 CAPABILITY_UNREGISTERED。新增端点必须先登记能力,默认拒绝。
 */
export function requireCapabilityRules(
  rules: readonly CapabilityRule[],
): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    const path = (request.url ?? '').split('?')[0] ?? ''
    const rule = rules.find(
      (r) => (!r.methods || r.methods.includes(request.method)) && r.pattern.test(path),
    )
    if (!rule) {
      await reply.status(403).send({
        code: 403,
        message: `No capability registered for ${request.method} ${path}`,
        errorCode: 'CAPABILITY_UNREGISTERED',
        method: request.method,
        path,
      })
      return
    }
    await enforceCapability(rule.scope, request, reply)
  }
}

/**
 * 迁移期登记:注入能力声明并拦截 platform 域,但不因缺少 scope 而 403。
 * 用于存量端点逐步铺开权限位,避免"登记即断流"。
 */
export function declareCapability(scope: ApiKeyPermission): preHandlerAsyncHookHandler {
  const entry = getCapability(scope)
  return async (request, reply) => {
    if (entry && !isM2MAllowed(scope)) {
      await reply.status(403).send({
        code: 403,
        message: 'Capability is not available to API keys',
        errorCode: 'M2M_FORBIDDEN',
        scope,
      })
      return
    }
    request.capability = entry
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
