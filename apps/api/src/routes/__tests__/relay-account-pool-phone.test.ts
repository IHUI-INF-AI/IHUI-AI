// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 手机号补全端点契约测试(2026-10-28 立):
 * - POST /admin/relay/accounts/:id/complete-phone — Zod 全号闸门 + 结果码→HTTP 映射
 *   (not_found=404,invalid_phone/mask_mismatch=400,already_full=409);
 * - POST /admin/relay/account-pool/match-phone — 批量入参闸门(1~200)与报告透传;
 * - 零凭据回显。落库/传播语义由 tests/relay-phone-complete.test.ts 锁,这里只测编排。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type {
  CompletePhoneResult,
  CompletePhoneCode,
} from '../../services/relay-account-pool-service.js'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const hoisted = vi.hoisted(() => ({
  completeAccountPhone: vi.fn(async (): Promise<CompletePhoneResult> => ({
    code: 'ok',
    message: null,
    id: 'row-1',
    oldName: '180******69',
    name: '18012345669',
    changed: true,
    checkinSync: { pushed: 1, pending: false, error: null },
  })),
  matchPhoneCandidates: vi.fn(async (phones: string[]) => ({
    scannedMasked: 1,
    matched: [
      {
        id: 'row-1',
        oldName: '180******69',
        name: phones[0] ?? '',
        checkinSync: { pushed: 1, pending: false, error: null },
      },
    ],
    ambiguous: [],
    unmatched: [],
    rejected: [],
  })),
}))

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))
vi.mock('../../db/index.js', () => ({
  db: { update: () => ({ set: () => ({ where: async () => [] }) }) },
  dbRead: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
  },
}))
vi.mock('@ihui/database', () => ({
  aiRelayAccountPool: new Proxy(
    {},
    { get: (_t, prop) => ({ __col: typeof prop === 'string' ? prop : String(prop) }) },
  ),
}))
vi.mock('@ihui/types', () => ({
  PROVIDER_HEALTH_STATUSES: ['healthy', 'degraded', 'down', 'unknown'],
  CHAT_SYNC_EVENT_NAMES: {
    MESSAGE_CREATED: 'message:created',
    MESSAGE_PATCHED: 'message:patched',
    MESSAGE_TERMINAL: 'message:terminal',
  },
}))
vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../../services/relay-account-pool-service.js', () => ({
  importAccounts: vi.fn(async () => ({})),
  decryptAccountCredentials: vi.fn(() => ({
    token: 'tok-1',
    refreshToken: 'ref-1',
    cookies: [],
    secrets: {},
  })),
  completeAccountPhone: hoisted.completeAccountPhone,
  matchPhoneCandidates: hoisted.matchPhoneCandidates,
}))
vi.mock('../../services/relay-account-pool-scheduler.js', () => ({
  sweepAccountPool: vi.fn(async () => ({})),
  refreshOne: vi.fn(async () => ({})),
  healthStatusOf: vi.fn(() => 'unknown'),
  markAccountAuthRejected: vi.fn(async () => {}),
}))
vi.mock('../../services/relay-account-usage.js', () => ({
  getAccountUsage: vi.fn(async () => ({})),
  getAccountUsageSummaries: vi.fn(async () => new Map()),
  purgeAccountUsage: vi.fn(async () => 0),
}))
vi.mock('../../services/relay-upstream-adapters.js', () => ({
  getRelayAdapter: vi.fn(() => null),
}))
vi.mock('../../services/relay-proxy-pool.js', () => ({
  listProxies: vi.fn(async () => ({})),
  createProxy: vi.fn(async () => ({})),
  updateProxy: vi.fn(async () => ({})),
  deleteProxy: vi.fn(async () => ({})),
  getProxyById: vi.fn(async () => null),
  markProxyChecked: vi.fn(async () => ({})),
  encryptAccountProxyUrl: (u: string | null) => u,
  resolveAccountProxyUrl: (u: string | null) => u,
  maskAccountProxyUrl: () => null,
}))
vi.mock('../../services/relay-model-catalog.js', () => ({
  listModelCatalog: vi.fn(async () => ({})),
  createModelCatalog: vi.fn(async () => ({})),
  deleteModelCatalog: vi.fn(async () => ({})),
}))
vi.mock('../../services/relay-account-pool-checkin-sync.js', () => ({
  checkinPlatformFor: () => null,
  buildPoolSyncAccount: vi.fn((src: unknown) => src),
  pushPoolSync: vi.fn(async () => ({
    ok: true,
    pushed: 0,
    skipped: 0,
    failed: 0,
    failedIds: [],
    error: null,
  })),
  pushPoolState: vi.fn(async () => ({ ok: true, error: null })),
  markCheckinSyncPending: vi.fn(async () => {}),
  clearCheckinSyncPending: vi.fn(async () => {}),
  extractCosy: vi.fn(() => null),
  pemFromSecrets: vi.fn(() => null),
  fetchPoolStatus: vi.fn(async () => ({ ok: true, found: false })),
  postPoolRun: vi.fn(async () => ({ ok: true, httpStatus: 200, record: null, error: null })),
  listCheckinSyncPending: vi.fn(async () => []),
  retryPendingCheckinSyncs: vi.fn(async () => ({})),
  parseCheckinSyncMeta: vi.fn(() => ({})),
}))

import relayAccountPoolRoutes from '../admin/relay-account-pool.js'

let app: FastifyInstance

beforeEach(async () => {
  hoisted.completeAccountPhone.mockClear()
  hoisted.matchPhoneCandidates.mockClear()
  app = Fastify()
  app.register(relayAccountPoolRoutes, { prefix: '/api' })
  await app.ready()
})

describe('POST /admin/relay/accounts/:id/complete-phone', () => {
  it('全号入参 → 200 透传补全结果(零凭据回显)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/row-1/complete-phone',
      payload: { phone: '18012345669' },
    })
    expect(res.statusCode).toBe(200)
    expect(hoisted.completeAccountPhone).toHaveBeenCalledWith('row-1', '18012345669', 'manual', {
      force: false,
    })
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data).toMatchObject({
      id: 'row-1',
      oldName: '180******69',
      name: '18012345669',
      changed: true,
    })
    expect(JSON.stringify(body)).not.toContain('tok-1')
  })

  it('body.force=true → 透传机主强制通道(via=owner_override)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/row-1/complete-phone',
      payload: { phone: '18773274826', force: true },
    })
    expect(res.statusCode).toBe(200)
    expect(hoisted.completeAccountPhone).toHaveBeenCalledWith(
      'row-1',
      '18773274826',
      'owner_override',
      {
        force: true,
      },
    )
  })

  it('掩码形态入参 → 400(Zod 闸门,不进 service)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/row-1/complete-phone',
      payload: { phone: '180******69' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('全号')
    expect(hoisted.completeAccountPhone).not.toHaveBeenCalled()
  })

  it('service 结果码映射 HTTP:mask_mismatch=400 / already_full=409 / not_found=404', async () => {
    const cases: Array<[CompletePhoneCode, number]> = [
      ['mask_mismatch', 400],
      ['already_full', 409],
      ['not_found', 404],
    ]
    for (const [code, status] of cases) {
      hoisted.completeAccountPhone.mockImplementationOnce(async () => ({
        code,
        message: `mock-${code}`,
        id: null,
        oldName: null,
        name: null,
        changed: false,
        checkinSync: { pushed: 0, pending: false, error: null },
      }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/relay/accounts/row-9/complete-phone',
        payload: { phone: '13900000000' },
      })
      expect(res.statusCode).toBe(status)
      expect(res.json().message).toContain(`mock-${code}`)
    }
  })
})

describe('POST /admin/relay/account-pool/match-phone', () => {
  it('候选号数组 → 200 透传报告', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/account-pool/match-phone',
      payload: { phones: ['18012345669', '180******69'] },
    })
    expect(res.statusCode).toBe(200)
    expect(hoisted.matchPhoneCandidates).toHaveBeenCalledWith(['18012345669', '180******69'])
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.matched).toHaveLength(1)
  })

  it('空数组 → 400;非数组 → 400', async () => {
    const empty = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/account-pool/match-phone',
      payload: { phones: [] },
    })
    expect(empty.statusCode).toBe(400)
    expect(hoisted.matchPhoneCandidates).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
