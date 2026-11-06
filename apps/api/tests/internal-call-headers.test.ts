// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * X-Internal-Secret 族票据化(2026-11-06):api 侧发送侧的唯一出口。
 *
 * 判据三条:
 * ① 正常路径:默认用服务主体 service:apps-api 签票,scope 精确,兼容窗口旧密钥同发。
 * ② 人为故障:JWT_SECRET 缺失/强度不足 ⇒ 返回 null(fail-closed),调用方据此拒绝发请求。
 * ③ 发送侧接线:relay 号池同步收到票头;签不出票时**一次请求都不发**(不能退化成只发旧密钥)。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildInternalCallHeaders,
  INTERNAL_SECRET_HEADER,
  INTERNAL_TICKET_HEADER,
  SERVICE_PRINCIPAL_API,
} from '../src/utils/internal-call-headers.js'
import {
  INTERNAL_TICKET_AUDIENCE,
  INTERNAL_TICKET_TYPE,
} from '../src/plugins/internal-service-ticket.js'
import { config } from '../src/config/index.js'
import {
  pushPoolSync,
  type PoolSyncAccount,
} from '../src/services/relay-account-pool-checkin-sync.js'

const USER_ID = '00000000-0000-4000-8000-00000000000e'
const LEGACY = 'legacy-callback-secret'

interface TicketPayload {
  sub: string
  aud: string
  type: string
  scope: string
  jti: string
  iat: number
  exp: number
}

function payloadOf(ticket: string): TicketPayload {
  return JSON.parse(
    Buffer.from(ticket.split('.')[1] ?? '', 'base64url').toString('utf8'),
  ) as TicketPayload
}

let originalSecret: string
let originalJwtSecret: string | undefined

beforeEach(() => {
  originalSecret = config.AI_CALLBACK_SECRET
  originalJwtSecret = process.env.JWT_SECRET
  ;(config as { AI_CALLBACK_SECRET: string }).AI_CALLBACK_SECRET = LEGACY
})

afterEach(() => {
  ;(config as { AI_CALLBACK_SECRET: string }).AI_CALLBACK_SECRET = originalSecret
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalJwtSecret
})

describe('buildInternalCallHeaders', () => {
  it('正常路径:服务主体票 + 旧密钥同发,用途与时效精确', async () => {
    const headers = await buildInternalCallHeaders({ scope: 'checkin-pool', legacySecret: LEGACY })
    expect(headers).not.toBeNull()
    expect(headers![INTERNAL_SECRET_HEADER]).toBe(LEGACY)
    const payload = payloadOf(headers![INTERNAL_TICKET_HEADER])
    expect(payload.sub).toBe(SERVICE_PRINCIPAL_API)
    expect(payload.scope).toBe('checkin-pool')
    expect(payload.aud).toBe(INTERNAL_TICKET_AUDIENCE)
    expect(payload.type).toBe(INTERNAL_TICKET_TYPE)
    expect(payload.exp - payload.iat).toBeGreaterThan(0)
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(300)
  })

  it('真人主体可覆盖服务主体;extra 不得顶掉票头', async () => {
    const headers = await buildInternalCallHeaders({
      scope: 'skills-market',
      subject: USER_ID,
      extra: { 'Content-Type': 'application/json', [INTERNAL_TICKET_HEADER]: 'forged' },
    })
    expect(headers![INTERNAL_TICKET_HEADER]).not.toBe('forged')
    expect(headers!['Content-Type']).toBe('application/json')
    expect(payloadOf(headers![INTERNAL_TICKET_HEADER]).sub).toBe(USER_ID)
  })

  it('人为故障:JWT_SECRET 缺失 ⇒ 返回 null(fail-closed)', async () => {
    process.env.JWT_SECRET = ''
    await expect(
      buildInternalCallHeaders({ scope: 'checkin-pool', legacySecret: LEGACY }),
    ).resolves.toBeNull()
  })

  it('人为故障:用途不在封闭集 ⇒ 返回 null,绝不签"任何用途"票', async () => {
    await expect(
      buildInternalCallHeaders({ scope: 'not-a-scope' as never, legacySecret: LEGACY }),
    ).resolves.toBeNull()
  })
})

describe('relay-account-pool-checkin-sync 发送侧接线', () => {
  const account: PoolSyncAccount = {
    poolAccountId: 'pa-1',
    ownerUserId: null,
    uid: 'u-1',
    name: 'acct',
    token: 'tok',
    refreshToken: 'ref',
    credVersion: 1,
    enabled: true,
    proxyUrl: null,
    deviceId: null,
    machineId: null,
    cosy: null,
    expiresAt: null,
  }

  function stubFetch(captured: Array<Record<string, string>>): typeof fetch {
    return (async (_url: string | URL | Request, init?: RequestInit) => {
      captured.push({ ...((init?.headers as Record<string, string>) ?? {}) })
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: [{ poolAccountId: 'pa-1', status: 'synced' }] }),
        text: async () => '',
      } as Response
    }) as typeof fetch
  }

  it('正常路径:pool-sync 带 x-internal-service-ticket(scope=checkin-pool)', async () => {
    const captured: Array<Record<string, string>> = []
    const result = await pushPoolSync('trae', [account], stubFetch(captured))
    expect(result.ok).toBe(true)
    expect(captured).toHaveLength(1)
    const payload = payloadOf(captured[0]![INTERNAL_TICKET_HEADER] ?? '')
    expect(payload.scope).toBe('checkin-pool')
    expect(payload.sub).toBe(SERVICE_PRINCIPAL_API)
    expect(captured[0]![INTERNAL_SECRET_HEADER]).toBe(LEGACY)
  })

  it('人为故障:签不出票 ⇒ 明确失败且**零请求**(不得只发旧密钥)', async () => {
    process.env.JWT_SECRET = ''
    const captured: Array<Record<string, string>> = []
    const result = await pushPoolSync('trae', [account], stubFetch(captured))
    expect(result.ok).toBe(false)
    expect(result.error).toContain('JWT_SECRET')
    expect(captured).toHaveLength(0)
  })
})
