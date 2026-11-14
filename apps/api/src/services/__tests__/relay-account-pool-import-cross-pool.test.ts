// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨池重复闸门单测(2026-11-14 立)。
 *
 * 立因(真机事故):2026-11-12 22:19 一次不带 --owner 的批量导入,为 6 个已在个人池的账号各造了
 * 一份运营池副本(trae 1 / qoder 5)。轮换式 refreshToken 被两条行各自续期时就互相消费 ——
 * 先刷的吃掉轮换票,后刷的那条必然 401 并被摘除,随后每 24h 报一封「号池保活摘除」邮件。
 * trae 146677888728619 就是这么假死的(运营池副本 down+摘除,个人池同行 healthy)。
 *
 * 钉住的语义:同一上游账号只保留一条续期链 ⇒ 命中跨池同 uid 行时**只拦不建、凭证绝不跨归属覆盖**;
 * 落运营池的意图用 shared_to_ops 标记表达(该标记本身参与运营池选路)。
 * 四个分支:1) 运营池导入命中个人池行;2) 同上但未共享 ⇒ 补共享标记;3) 个人池导入命中运营池行;
 * 4) 两池都没有 ⇒ 照旧插入(回归牙,防闸门误伤正常导入)。
 *
 * 测试模式对齐同目录 relay-account-pool-import-checkin-sync.test.ts:vi.mock 掉 db/crypto/logger/
 * 签到同步,零真实 IO;db.select().from().where().limit() 按序供数。
 */
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
  /** 每次 select(...).limit() 消费一格;缺省为空数组(= 查无此行) */
  selectQueue: [] as Array<Array<Record<string, unknown>>>,
  /** insert 自增行 id */
  insertSeq: 0,
  /** update 收到的 set 值(用于断言"补共享标记"这条唯一允许的写) */
  updateSets: [] as Array<Record<string, unknown>>,
  /** 置非空 ⇒ 本次 insert 以该错误拒绝(模拟数据库唯一索引 23505) */
  insertError: null as null | { code: string; constraint: string },
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(hoisted.selectQueue.shift() ?? []),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => {
          if (hoisted.insertError) return Promise.reject(hoisted.insertError)
          hoisted.insertSeq += 1
          return Promise.resolve([{ id: `row-${hoisted.insertSeq}`, credVersion: 1 }])
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        hoisted.updateSets.push(values)
        return { where: () => ({ returning: () => Promise.resolve([]) }) }
      },
    }),
  },
  dbRead: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    }),
  },
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
  checkinPlatformFor: () => null,
  extractCosy: () => null,
  pemFromSecrets: () => null,
  zcodePlanJwtFromSecrets: () => null,
  pushPoolSync: vi.fn(async () => ({
    ok: true,
    pushed: 0,
    skipped: 0,
    failed: 0,
    failedIds: [],
    error: null,
  })),
  clearCheckinSyncPending: vi.fn(async () => undefined),
  markCheckinSyncPending: vi.fn(async () => undefined),
}))

import { importAccounts } from '../relay-account-pool-service.js'

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}

/** 造一枚形状合法、票未过期的 trae 账号(uid 由 JWT sub 解析,与供数无关) */
function traeAccount(n: string): { name: string; token: string } {
  const exp = Math.floor(Date.UTC(2027, 0, 1) / 1000)
  const token = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ sub: `u-${n}`, exp })}.sig`
  return { name: `账号${n}`, token }
}

beforeEach(() => {
  hoisted.selectQueue.length = 0
  hoisted.insertSeq = 0
  hoisted.updateSets.length = 0
  hoisted.insertError = null
  // 打点文件落临时目录,别污染真实 ~/.wb-switch
  process.env['IHUI_POOL_SYNC_DIRTY_FILE'] = join(tmpdir(), 'ihui-test-pool-sync-dirty')
})

describe('importAccounts 跨池重复闸门(同一上游账号只有一条续期链)', () => {
  it('运营池导入命中个人池同 uid 行 ⇒ 跳过,不插入第二行', async () => {
    hoisted.selectQueue.push(
      [], // 运营池内查无此行
      [{ id: 'aaaaaaaa-1', sharedToOps: true, healthStatus: 'healthy' }], // 个人池已有
    )
    const r = await importAccounts('trae', [traeAccount('1')])

    expect(r.imported).toBe(0)
    expect(r.skipped).toBe(1)
    expect(hoisted.insertSeq).toBe(0)
    expect(hoisted.updateSets).toHaveLength(0)
    expect(r.items[0]?.status).toBe('skipped')
    expect(r.items[0]?.reason).toContain('只保留一条续期链')
  })

  it('同上但个人池行未共享 ⇒ 补 shared_to_ops,仍不插入第二行', async () => {
    hoisted.selectQueue.push(
      [],
      [{ id: 'aaaaaaaa-2', sharedToOps: false, healthStatus: 'healthy' }],
    )
    const r = await importAccounts('trae', [traeAccount('2')])

    expect(r.skipped).toBe(1)
    expect(hoisted.insertSeq).toBe(0)
    expect(hoisted.updateSets).toHaveLength(1)
    expect(hoisted.updateSets[0]?.['sharedToOps']).toBe(true)
  })

  it('个人池导入命中运营池同 uid 行 ⇒ 跳过,不插入第二行', async () => {
    hoisted.selectQueue.push(
      [], // 该用户名下查无此行
      [{ id: 'gggggggg-1', sharedToOps: true, healthStatus: 'healthy' }], // 运营池已有
    )
    const r = await importAccounts('trae', [traeAccount('3')], 'user-1')

    expect(r.skipped).toBe(1)
    expect(hoisted.insertSeq).toBe(0)
    // 个人池导入不得改写运营池行的共享标记(那里的 shared 语义与归属无关)
    expect(hoisted.updateSets).toHaveLength(0)
    expect(r.items[0]?.reason).toContain('运营池存在')
  })

  it('两池都没有 ⇒ 照旧插入(防闸门误伤正常导入)', async () => {
    hoisted.selectQueue.push([], [])
    const r = await importAccounts('trae', [traeAccount('4')])

    expect(r.imported).toBe(1)
    expect(r.skipped).toBe(0)
    expect(hoisted.insertSeq).toBe(1)
  })

  it('并发插队撞数据库唯一索引(23505) ⇒ 记 skipped 而非 failed,且不覆盖任何既有行', async () => {
    // 闸门查询那一刻两池都没有(并发窗口),插入时才撞上全表唯一索引
    hoisted.selectQueue.push([], [])
    hoisted.insertError = {
      code: '23505',
      constraint: 'ai_relay_account_pool_provider_uid_uniq',
    }
    const r = await importAccounts('trae', [traeAccount('5')])

    expect(r.skipped).toBe(1)
    expect(r.failed).toBe(0)
    expect(r.imported).toBe(0)
    // 关键:失败闭合,绝不退化成"冲突就改成更新既有行"(那会把本批旧票写到别人那一行)
    expect(hoisted.updateSets).toHaveLength(0)
    expect(r.items[0]?.status).toBe('skipped')
    expect(r.items[0]?.reason).toContain('唯一索引')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
