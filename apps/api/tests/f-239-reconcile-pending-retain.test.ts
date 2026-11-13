// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-239 回归锁(2026-11-13):对账批次级失败不得清 pending 账本。
 *
 * 病灶:reconcileCheckinSync 推送批次遇 ai-service 500 / 网络错误 / 密钥缺失时
 * pushPoolSync 返回 ok=false 且 failedIds=[](批次级失败没有逐条 id),整批先落
 * pending,紧接着成功集合又按 failedIds 反推 ⇒ okIds 等于全量,同轮把刚落的
 * pending 全清掉。pending 与 attempts 不留痕,retryPendingCheckinSyncs 与失败
 * 升级彻底失效。
 *
 * 本文件锁:
 *   ① 批次级失败(push.ok=false、failedIds=[])⇒ 全量落 pending,clear 一次都不调;
 *   ② 整批成功(push.ok=true)⇒ 正常 clear 全量,mark 不调;
 *   ③ 推送异常抛错 ⇒ 不上抛语义之外的清理:错误按既有语义向上抛,clear 不调;
 *   ④ 部分成功(push.ok=false、failedIds 非空)⇒ 只落失败 id,clear 仍不调。
 *
 * 只 mock db / 推送端 / 凭证解密 / fetch,不连真实 PG、Redis、ai-service。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  poolRows: [] as Array<Record<string, unknown>>,
  fullRows: [] as Array<Record<string, unknown>>,
  pushPoolSync: vi.fn(),
  clearCheckinSyncPending: vi.fn(async (_ids: string[]): Promise<void> => {}),
  markCheckinSyncPending: vi.fn(
    async (_ids: string[], _kind: string, _state: unknown, _error: string): Promise<void> => {},
  ),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    AI_CALLBACK_SECRET: 'f239-test-secret',
    AI_SERVICE_URL: 'http://ai-service.test:8803',
  },
}))
vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../src/utils/internal-call-headers.js', () => ({
  buildInternalCallHeaders: async () => ({ Authorization: 'Bearer f239-test' }),
}))
// 只用到 eq:替成可断言的轻量结构(真实 SQL 正确性由集成环境保证)
vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ __eq: [col, val] }),
}))
vi.mock('@ihui/database', () => ({
  aiRelayAccountPool: new Proxy(
    {},
    { get: (_t, prop) => ({ __col: typeof prop === 'string' ? prop : String(prop) }) },
  ),
}))
vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbRead: {
    select: (fields?: unknown) => ({
      from: () => ({
        // loadPoolSide: await dbRead.select({...}).from(table)
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(fields === undefined ? [] : hoisted.poolRows).then(resolve, reject),
        // loadFullRow: await dbRead.select().from(table).where(...).limit(1)
        where: () => ({
          limit: async () => {
            const row = hoisted.fullRows.shift()
            return row ? [row] : []
          },
        }),
      }),
    }),
  },
  dbClient: {},
}))
vi.mock('../src/services/relay-account-pool-checkin-sync.js', () => ({
  checkinPlatformFor: (providerCode: string) => (providerCode === 'doubao' ? 'doubao' : null),
  buildPoolSyncAccount: (src: { id: string; name: string }) => ({
    poolAccountId: src.id,
    name: src.name,
  }),
  pushPoolSync: hoisted.pushPoolSync,
  clearCheckinSyncPending: hoisted.clearCheckinSyncPending,
  markCheckinSyncPending: hoisted.markCheckinSyncPending,
  pushPoolState: vi.fn(async () => ({ ok: true, error: null })),
  extractCosy: () => null,
  pemFromSecrets: () => null,
  zcodePlanJwtFromSecrets: () => null,
}))
vi.mock('../src/services/relay-account-pool-service.js', () => ({
  decryptAccountCredentials: () => ({ token: 'tok', refreshToken: null, secrets: null }),
}))
vi.mock('../src/services/relay-proxy-pool.js', () => ({
  resolveAccountProxyUrl: () => null,
}))

import { reconcileCheckinSync } from '../src/services/relay-account-pool-reconcile.js'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** 签到侧全量:空数组 ⇒ 号池每个启用行都产出一条 missing push */
function accountsFetch() {
  return vi.fn(async () => jsonResponse({ accounts: [] }))
}

function poolRow(id: string): Record<string, unknown> {
  return {
    id,
    ownerUserId: null,
    providerCode: 'doubao',
    uid: `uid-${id}`,
    name: id,
    isEnabled: true,
    credVersion: 1,
  }
}

function fullRow(id: string): Record<string, unknown> {
  return {
    id,
    ownerUserId: null,
    providerCode: 'doubao',
    uid: `uid-${id}`,
    name: id,
    tokenEnc: 'enc:tok',
    refreshTokenEnc: null,
    secretsEnc: null,
    proxyUrl: null,
    deviceId: null,
    machineId: null,
    isEnabled: true,
    credVersion: 1,
    tokenExpiresAt: null,
    extraMetadata: {},
  }
}

/** 两个号池行一批推:①落 pending 全量;②清 pending 全量;④部分失败 */
function arrangeTwoRows() {
  hoisted.poolRows.push(poolRow('pool-a'), poolRow('pool-b'))
  hoisted.fullRows.push(fullRow('pool-a'), fullRow('pool-b'))
}

beforeEach(() => {
  hoisted.poolRows.length = 0
  hoisted.fullRows.length = 0
  hoisted.pushPoolSync.mockReset()
  hoisted.clearCheckinSyncPending.mockClear()
  hoisted.markCheckinSyncPending.mockClear()
})

describe('F-239 对账推送失败必须保留 pending 账本', () => {
  it('① 批次级失败(push.ok=false、failedIds=[]):全量落 pending,clear 不调用', async () => {
    arrangeTwoRows()
    hoisted.pushPoolSync.mockResolvedValue({
      ok: false,
      pushed: 0,
      skipped: 0,
      failed: 0,
      failedIds: [],
      error: 'pool-sync HTTP 500: boom',
    })

    const r = await reconcileCheckinSync({ fetchImpl: accountsFetch() })

    // 既有语义:pushFailed 只按 failedIds 计数,批次级失败(failedIds=[])记 0
    expect(r).toMatchObject({ ok: true, pushed: 0, pushFailed: 0 })
    expect(hoisted.markCheckinSyncPending).toHaveBeenCalledTimes(1)
    expect(hoisted.markCheckinSyncPending).toHaveBeenCalledWith(
      ['pool-a', 'pool-b'],
      'cred',
      null,
      'pool-sync HTTP 500: boom',
    )
    // 修复前这里会被 okIds=全量 清空 —— 本票的核心断言
    expect(hoisted.clearCheckinSyncPending).not.toHaveBeenCalled()
  })

  it('② 整批成功(push.ok=true):正常清 pending 全量,不落 pending', async () => {
    arrangeTwoRows()
    hoisted.pushPoolSync.mockResolvedValue({
      ok: true,
      pushed: 2,
      skipped: 0,
      failed: 0,
      failedIds: [],
      error: null,
    })

    const r = await reconcileCheckinSync({ fetchImpl: accountsFetch() })

    expect(r).toMatchObject({ ok: true, pushed: 2, pushFailed: 0 })
    expect(hoisted.markCheckinSyncPending).not.toHaveBeenCalled()
    expect(hoisted.clearCheckinSyncPending).toHaveBeenCalledTimes(1)
    expect(hoisted.clearCheckinSyncPending).toHaveBeenCalledWith(['pool-a', 'pool-b'])
  })

  it('③ 推送抛异常:错误按既有语义上抛,clear 不调用', async () => {
    arrangeTwoRows()
    hoisted.pushPoolSync.mockRejectedValue(new Error('socket hang up'))

    await expect(reconcileCheckinSync({ fetchImpl: accountsFetch() })).rejects.toThrow(
      'socket hang up',
    )
    expect(hoisted.clearCheckinSyncPending).not.toHaveBeenCalled()
  })

  it('④ 部分失败(push.ok=false、failedIds 非空):只落失败 id,clear 仍不调用', async () => {
    arrangeTwoRows()
    hoisted.pushPoolSync.mockResolvedValue({
      ok: false,
      pushed: 1,
      skipped: 0,
      failed: 1,
      failedIds: ['pool-b'],
      error: '1 条签到同步失败: pool-b: 已存在',
    })

    const r = await reconcileCheckinSync({ fetchImpl: accountsFetch() })

    expect(r).toMatchObject({ ok: true, pushed: 1, pushFailed: 1 })
    expect(hoisted.markCheckinSyncPending).toHaveBeenCalledTimes(1)
    expect(hoisted.markCheckinSyncPending).toHaveBeenCalledWith(
      ['pool-b'],
      'cred',
      null,
      '1 条签到同步失败: pool-b: 已存在',
    )
    // 部分成功也不清 pending:留给下轮重推,避免把同批 pending 账本抹掉
    expect(hoisted.clearCheckinSyncPending).not.toHaveBeenCalled()
  })
})
