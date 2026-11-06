// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * `X-Internal-Secret` 族的统一鉴权出口(2026-11-06)。
 *
 * 背景:这把常驻共享密钥(`AI_CALLBACK_SECRET`)散落在 5 个内网端点里逐处手写比对,
 * 无 TTL、无用途绑定、无单次使用 —— 泄露一次即永久可用。本模块把它们统一收到
 * "票优先、旧密钥只在显式兼容档生效"的一条判据上:
 *
 * - `ticket`(默认, fail-closed):只认 `x-internal-service-ticket`;老密钥一律 401。
 * - `dual`(必须显式配置):带票先验票(票坏**不回落**老门);不带票才认老密钥。
 *   仅用于双侧滚动发布窗口。
 * - `legacy`(应急回退,生产启动即失败):只认老密钥。
 * - 未知档位一律落回 `ticket`:拼错档位名不得静默把老门打开。
 *
 * 判据顺序来自 `internal-service-token.ts` 的既有教训:老门是"有一把常驻密钥就过",
 * 若先判它,任何一张伪造的票都会因为"顺便带了把对的旧密钥"而被放过。
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import { config, isProductionGuard } from '../config/index.js'
import { logger } from '../utils/logger.js'
import {
  INTERNAL_TICKET_HEADER,
  createRedisReplayStore,
  verifyInternalServiceTicket,
  type InternalTicketScope,
  type RedisSetNxLike,
} from './internal-service-ticket.js'

/** 老门请求头(族内 5 个端点共用的那个名字)。 */
export const INTERNAL_SECRET_HEADER = 'x-internal-secret'

export type InternalSecretAuthMode = 'ticket' | 'dual' | 'legacy'

export const DEFAULT_INTERNAL_SECRET_AUTH_MODE: InternalSecretAuthMode = 'ticket'

/** 同一把密钥的比较口径必须全族一致:sha256 定长后再 timingSafeEqual。 */
function secretsEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

function readHeader(request: FastifyRequest, name: string): string | undefined {
  const raw = request.headers[name]
  return Array.isArray(raw) ? raw[0] : raw
}

export function resolveInternalSecretAuthMode(raw: unknown): InternalSecretAuthMode {
  return raw === 'dual' || raw === 'legacy' ? raw : 'ticket'
}

export function internalSecretAuthMode(): InternalSecretAuthMode {
  return resolveInternalSecretAuthMode(
    (config as unknown as { INTERNAL_SECRET_AUTH_MODE?: unknown }).INTERNAL_SECRET_AUTH_MODE,
  )
}

function ticketMaxTtlSeconds(): number | undefined {
  const raw = (config as unknown as { INTERNAL_SERVICE_TICKET_MAX_TTL_SECONDS?: number })
    .INTERNAL_SERVICE_TICKET_MAX_TTL_SECONDS
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : undefined
}

function resolveReplayStore(request: FastifyRequest) {
  const redis = (request.server as unknown as { redis?: RedisSetNxLike }).redis
  if (!redis || typeof redis.set !== 'function') return null
  return createRedisReplayStore(redis)
}

export type InternalSecretAuthResult =
  | { ok: true; via: 'ticket'; subject: string }
  | { ok: true; via: 'legacy'; subject: null }
  | {
      ok: false
      /** true = 请求根本没带任何内部凭据(登录态端点可据此回落用户鉴权)。 */
      missing: boolean
      /** `secret_not_configured` ⇒ 503;其余 ⇒ 401。 */
      status: 401 | 503
      reason: string
      /**
       * 是否允许端点回落到"另一条合法鉴权"(登录态)。
       * - 没带内部凭据 / 旧密钥不匹配 / 旧密钥未配置 ⇒ true(历史用户通道不受影响)
       * - 票验签失败(伪造/过期/错用途/重放) ⇒ false(坏票不得静默降级)
       */
      fallbackAllowed: boolean
    }

/**
 * 统一的"票据或旧密钥"判据。
 *
 * @param opts.scope 调用点声明的用途;票的 scope 与之不等即拒(跨用途票不可复用)。
 */
export async function authorizeInternalSecretCall(
  request: FastifyRequest,
  opts: { scope: InternalTicketScope },
): Promise<InternalSecretAuthResult> {
  const mode = internalSecretAuthMode()
  const rawTicket = readHeader(request, INTERNAL_TICKET_HEADER)

  // 票档优先:带票的请求先验票,票坏直接拒,绝不回落到老门。
  if (mode !== 'legacy' && rawTicket) {
    const verdict = await verifyInternalServiceTicket(rawTicket, {
      store: resolveReplayStore(request),
      expectedScope: opts.scope,
      maxTtlSeconds: ticketMaxTtlSeconds(),
    })
    if (!verdict.ok) {
      request.log.warn(
        { reason: verdict.reason, ip: request.ip, endpoint: request.url },
        '[internal-secret] internal service ticket rejected',
      )
      return {
        ok: false,
        missing: false,
        status: 401,
        reason: verdict.reason,
        fallbackAllowed: false,
      }
    }
    return { ok: true, via: 'ticket', subject: verdict.userId }
  }

  // `ticket` 档:只带老门(或不带头)⇒ 老门已关。
  if (mode === 'ticket') {
    return {
      ok: false,
      missing: !rawTicket,
      status: 401,
      reason: 'ticket_required',
      fallbackAllowed: true,
    }
  }

  // `dual` / `legacy`:老门只在显式兼容档下存在。
  const provided = readHeader(request, INTERNAL_SECRET_HEADER)
  // 先判"有没有带凭据":没带内部头的普通用户请求必须能回落到登录态,
  // 不能因为服务端没配旧密钥就先把人挡成 503(那是把"缺配置"错算成"缺凭据")。
  if (!provided) {
    return { ok: false, missing: true, status: 401, reason: 'missing', fallbackAllowed: true }
  }
  const secret = config.AI_CALLBACK_SECRET
  if (!secret) {
    // 未配置旧密钥时,对内网唯一鉴权端点 ⇒ 503(不裸奔);
    // 对可回落登录态的端点 ⇒ missing=true,让普通用户请求照常走用户鉴权。
    return {
      ok: false,
      missing: true,
      status: 503,
      reason: 'secret_not_configured',
      fallbackAllowed: true,
    }
  }
  if (!secretsEqual(provided, secret)) {
    request.log.warn(
      { ip: request.ip, endpoint: request.url },
      '[internal-secret] legacy secret mismatch',
    )
    return {
      ok: false,
      missing: false,
      status: 401,
      reason: 'secret_mismatch',
      fallbackAllowed: true,
    }
  }
  return { ok: true, via: 'legacy', subject: null }
}

/**
 * 票主体与请求体声明的归属是否一致。
 *
 * 只在"票里封的是真人 uuid"时设闸:服务主体票(`service:*`)天然不被归属字段约束,
 * 它表达的是"哪个服务在调用",而不是"替哪个用户操作"。
 */
export function ticketSubjectAllows(
  subject: string | undefined,
  declared: string | null | undefined,
): boolean {
  if (!subject) return false
  if (subject.startsWith('service:')) return true
  if (!declared) return true
  return subject === declared
}

/**
 * 启动守卫:生产 + `legacy` 直接中止;`dual` 打显著告警。
 *
 * 纯函数形态(参数可注入)让"生产 + legacy 启动失败"能被行为测试钉住。
 */
export function assertInternalSecretAuthModeAtStartup(
  opts: { mode?: unknown; isProduction?: boolean } = {},
): void {
  const mode =
    opts.mode === undefined ? internalSecretAuthMode() : resolveInternalSecretAuthMode(opts.mode)
  const production = opts.isProduction ?? Boolean(isProductionGuard)

  if (production && mode === 'legacy') {
    throw new Error(
      'INTERNAL_SECRET_AUTH_MODE=legacy 是"只认常驻共享密钥"的应急档 —— ' +
        '生产环境禁止启动。请改回 ticket(默认),或在滚动发布窗口内显式使用 dual。',
    )
  }
  if (mode === 'dual') {
    logger.warn(
      '⚠️ X-Internal-Secret 族处于兼容档(dual):旧共享密钥仍可通过。' +
        '双侧全部发布完成后请把 INTERNAL_SECRET_AUTH_MODE 切回 ticket 收口。',
    )
  }
}
