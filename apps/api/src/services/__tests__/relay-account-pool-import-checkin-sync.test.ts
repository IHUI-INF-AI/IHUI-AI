// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * importAccounts ↔ 签到同步徽章单测(2026-11-01 立)。
 *
 * 立因:admin 号池页「签到同步徽章」的唯一数据源是
 * `ai_relay_account_pool.extra_metadata->'checkinSync'`(读取点
 * routes/admin/relay-account-pool.ts:416)。此前 importAccounts 只在**推送失败**分支调
 * markCheckinSyncPending,成功什么都不写 ⇒ 行上根本没有 checkinSync 键;而对账收敛器只在
 * "签到侧缺行 / pool_cred_version 落后"时才补推并 clear ⇒ 两侧一致时无人写成功态 ⇒ 徽章恒空。
 * 本套件钉住四个分支:
 * 1) 全成功 ⇒ 全批 clear、绝不 mark;
 * 2) 部分失败 ⇒ failed 走 mark、其余走 clear,两集合不重叠且并集 = 本批;
 * 3) clear 抛错 ⇒ fail-open(导入仍成功、imported 计数不变);
 * 4) 平台无签到引擎(codearts)⇒ 推送/clear/mark 全不被调用(保持 skipped 语义)。
 *
 * 测试模式:vi.mock 掉 db / crypto / logger / 签到同步(对齐同目录 relay-account-pool-*.test.ts
 * 与 apps/api/tests/relay-account-import-preserve-refresh.test.ts),零真实 IO。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
  /** db.select().from().where().limit(1) 按序供数;空队列 ⇒ 空数组(走 insert 分支) */
  selectQueue: [] as Array<Record<string, unknown>>,
  /** insert 自增行 id(row-1 / row-2 …) */
  insertSeq: 0,
  /** clearCheckinSyncPending 每次收到的 id 列表 */
  clearCalls: [] as string[][],
  /** markCheckinSyncPending 每次收到的 id 列表 */
  pendingCalls: [] as string[][],
  /** 置 true ⇒ clear 抛错(验证 fail-open) */
  clearThrows: false,
  pushResult: {
    ok: true,
    pushed: 0,
    skipped: 0,
    failed: 0,
    failedIds: [] as string[],
    error: null as string | null,
  },
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(hoisted.selectQueue.splice(0, 1)),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => {
          hoisted.insertSeq += 1
          return Promise.resolve([{ id: `row-${hoisted.insertSeq}`, credVersion: 1 }])
        },
      }),
    }),
    update: () => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
    }),
  },
  dbRead: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) },
  dbClient: {},
}))

vi.mock('../../utils/crypto.js', () => ({
  encryptField: (s: string) => `enc:${s}`,
  decryptField: (s: string) => (s.startsWith('enc:') ? s.slice(4) : s),
}))

vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../relay-account-pool-checkin-sync.js', () => ({
  buildPoolSyncAccount: (x: Record<string, unknown>) => ({ ...x, poolAccountId: x['id'] }),
  checkinPlatformFor: (p: string) => (p === 'trae' ? 'trae' : null),
  extractCosy: () => null,
  pemFromSecrets: () => null,
  pushPoolSync: vi.fn(),
  clearCheckinSyncPending: vi.fn(),
  markCheckinSyncPending: vi.fn(),
}))

import { importAccounts } from '../relay-account-pool-service.js'
import {
  clearCheckinSyncPending,
  markCheckinSyncPending,
  pushPoolSync,
} from '../relay-account-pool-checkin-sync.js'
import { logger } from '../../utils/logger.js'

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}
function jwt(payload: Record<string, unknown>): string {
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}.sig`
}

const FUTURE = Math.floor(Date.UTC(2027, 0, 1) / 1000)

function traeAccount(n: string): { name: string; token: string } {
  return { name: `账号${n}`, token: jwt({ sub: `u-${n}`, exp: FUTURE }) }
}

beforeEach(() => {
  hoisted.selectQueue.length = 0
  hoisted.insertSeq = 0
  hoisted.clearCalls.length = 0
  hoisted.pendingCalls.length = 0
  hoisted.clearThrows = false
  hoisted.pushResult = {
    ok: true,
    pushed: 0,
    skipped: 0,
    failed: 0,
    failedIds: [],
    error: null,
  }
  vi.mocked(pushPoolSync).mockReset()
  vi.mocked(pushPoolSync).mockImplementation(async () => hoisted.pushResult)
  vi.mocked(clearCheckinSyncPending).mockReset()
  vi.mocked(clearCheckinSyncPending).mockImplementation(async (ids: string[]) => {
    hoisted.clearCalls.push([...ids])
    if (hoisted.clearThrows) throw new Error('simulated checkinSync update failure')
  })
  vi.mocked(markCheckinSyncPending).mockReset()
  vi.mocked(markCheckinSyncPending).mockImplementation(async (ids: string[]) => {
    hoisted.pendingCalls.push([...ids])
  })
  vi.mocked(logger.warn).mockClear()
})

describe('importAccounts 签到同步徽章(extra_metadata.checkinSync)', () => {
  it('推送全成功 ⇒ clear 收到本批全部 poolAccountId,且不调 markCheckinSyncPending', async () => {
    hoisted.pushResult = { ok: true, pushed: 2, skipped: 0, failed: 0, failedIds: [], error: null }
    const r = await importAccounts('trae', [traeAccount('1'), traeAccount('2')])

    expect(r.imported).toBe(2)
    expect(r.checkinSync).toMatchObject({ pushed: 2, skipped: 0, pending: 0, error: null })
    expect(hoisted.clearCalls).toHaveLength(1)
    expect(hoisted.clearCalls[0]).toEqual(['row-1', 'row-2'])
    expect(markCheckinSyncPending).not.toHaveBeenCalled()
  })

  it('推送部分失败 ⇒ failed 走 mark、其余走 clear,两集合不重叠且并集 = 本批', async () => {
    hoisted.pushResult = {
      ok: false,
      pushed: 1,
      skipped: 0,
      failed: 1,
      failedIds: ['row-2'],
      error: 'pool-sync HTTP 502: bad gateway',
    }
    const r = await importAccounts('trae', [traeAccount('1'), traeAccount('2')])

    expect(r.imported).toBe(2)
    const cleared = hoisted.clearCalls.flat()
    const pending = hoisted.pendingCalls.flat()
    expect(cleared).toEqual(['row-1'])
    expect(pending).toEqual(['row-2'])
    // 两集合不重叠,并集 = 本批(poolAccountId 全集)
    expect(cleared.filter((id) => pending.includes(id))).toEqual([])
    expect(new Set([...cleared, ...pending])).toEqual(new Set(['row-1', 'row-2']))
    expect(r.checkinSync).toMatchObject({
      pushed: 1,
      pending: 1,
      error: 'pool-sync HTTP 502: bad gateway',
    })
  })

  it('clearCheckinSyncPending 抛错 ⇒ fail-open:importAccounts 仍成功,imported 计数不受影响', async () => {
    hoisted.clearThrows = true
    hoisted.pushResult = { ok: true, pushed: 1, skipped: 0, failed: 0, failedIds: [], error: null }
    const r = await importAccounts('trae', [traeAccount('1')])

    expect(r.imported).toBe(1)
    expect(r.failed).toBe(0)
    expect(r.items).toHaveLength(1)
    expect(r.items[0]?.status).toBe('imported')
    expect(r.checkinSync).toMatchObject({ pushed: 1, pending: 0 })
    // 徽章写失败必须有痕迹,但绝不冒泡成导入失败
    expect(logger.warn).toHaveBeenCalled()
  })

  it('平台无签到引擎(codearts)⇒ 推送/clear/mark 全不被调用(保持 skipped 语义)', async () => {
    const r = await importAccounts('codearts', [
      {
        accessKey: 'HSTAKaaaaaaaaaaaaaaaa',
        secretKey: 'skbbbbbbbbbbbbbbbbbbbb',
        securitytoken: 'sts-AAA-security-token',
        account: { id: 'user-777', label: '小号A' },
      },
    ])

    expect(r.imported).toBe(1)
    expect(r.checkinSync).toEqual({ pushed: 0, skipped: 1, pending: 0, error: null })
    expect(pushPoolSync).not.toHaveBeenCalled()
    expect(clearCheckinSyncPending).not.toHaveBeenCalled()
    expect(markCheckinSyncPending).not.toHaveBeenCalled()
  })
})
