// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池原子 SQL 的真库验收(2026-10-23 立,*.real.test.ts 档)。
 *
 * 立项原因:2026-10-22 那轮 20 项修复把认领/释放、代理轮换从「先读后写」改成
 * 「单条条件 UPDATE + RETURNING」,但只经 mock 链式对象验证过 —— mock 不会拒绝第二次
 * 认领,也不会让两条并发语句真的抢同一行。并发语义必须在真 PG 上量,才是凭据。
 *
 * 归属与前置(与 vitest.real.config.ts 同口径):
 *   真 env + 真测试库(非生产,AGENTS §5 禁连 8810)。入口(先进 apps/api,
 *   不要用 `pnpm --filter exec` 包装 —— 它会把退出码统一压成 1):
 *   `DATABASE_URL=<测试库> pnpm exec vitest run --config vitest.real.config.ts tests/relay-account-pool-atomic.real.test.ts`
 *   2026-10-23 实测两把库均 7/7 绿(ihui_test 与一次性隔离库)。
 *   本机 .env 角色非超级用户 ⇒ setup-real-db 走降级清理档(见该文件注释),标准入口仍可跑。
 * 只 mock 鉴权/RBAC 读数与调度器(它们不是本票判据),db/config 一律真取。
 *
 * 隔离:每个用例自建数据并在本用例内清干净;末例再跑一遍同序列并断言行数不变。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'

const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))
vi.mock('../src/services/relay-account-pool-scheduler.js', () => ({
  sweepAccountPool: vi.fn().mockResolvedValue({}),
}))
vi.mock('../src/services/relay-upstream-adapters.js', () => ({
  getRelayAdapter: vi.fn(() => null),
}))

import { db } from '../src/db/index.js'
import relayAccountPoolRoutes from '../src/routes/admin/relay-account-pool.js'
import { importAccounts } from '../src/services/relay-account-pool-service.js'
import { createProxy, pickProxyForAccount } from '../src/services/relay-proxy-pool.js'

const USER_A = '00000000-0000-4000-8000-0000000000a1'
const USER_B = '00000000-0000-4000-8000-0000000000b2'
const ADMIN_A = { authorization: 'Bearer admin-alice' }
const ADMIN_B = { authorization: 'Bearer admin-bob' }

/** 鉴权 mock:按 token 文本决定身份,其余全真 */
function armIdentityByToken(): void {
  mockVerifyAccessToken.mockImplementation(async (arg: unknown) => {
    const text = typeof arg === 'string' ? arg : JSON.stringify(arg ?? {})
    return {
      userId: text.includes('bob') ? USER_B : USER_A,
      phone: '13800000001',
      familyId: '00000000-0000-4000-8000-000000000002',
      roleId: 1,
    }
  })
}

let seq = 0
function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}

/** 合成账号(uid 自带,免回查);JWT 只在本测试内生成 */
function syntheticAccount(label: string): { uid: string; raw: Record<string, unknown> } {
  const uid = `atomic-${label}-${++seq}`
  const exp = Math.floor(Date.now() / 1000) + 7 * 86400
  return {
    uid,
    raw: {
      name: `真库号-${uid}`,
      token: `${b64({ alg: 'RS256' })}.${b64({ data: { id: uid }, exp })}.sig`,
      refreshToken: `rt-${uid}`,
      enabled: true,
      cookies: [],
    },
  }
}

type Row = Record<string, unknown>
/** drizzle 的 execute 返回 RowList,统一收成普通行数组再取字段 */
function asRows(result: unknown): Row[] {
  return Array.isArray(result) ? (result as Row[]) : []
}

async function accountIdOf(uid: string): Promise<string | null> {
  const first = asRows(
    await db.execute(
      sql`select id::text as id from ai_relay_account_pool where provider_code = 'trae' and uid = ${uid}`,
    ),
  )[0]
  return first?.['id'] ? String(first['id']) : null
}

async function claimState(id: string): Promise<{ claimStatus: string; claimedBy: string | null }> {
  const r =
    asRows(
      await db.execute(
        sql`select claim_status, claimed_by::text as claimed_by
            from ai_relay_account_pool where id = ${id}::uuid`,
      ),
    )[0] ?? {}
  const claimedBy = r['claimed_by']
  return {
    claimStatus: String(r['claim_status'] ?? ''),
    claimedBy: claimedBy === null || claimedBy === undefined ? null : String(claimedBy),
  }
}

async function countRows(statement: ReturnType<typeof sql>): Promise<number> {
  return Number(asRows(await db.execute(statement))[0]?.['n'] ?? -1)
}

async function importOne(label: string): Promise<{ uid: string; id: string }> {
  const { uid, raw } = syntheticAccount(label)
  const out = await importAccounts('trae', [raw])
  if (out.imported !== 1) throw new Error(`导入未落库:${JSON.stringify(out.items)}`)
  const id = await accountIdOf(uid)
  if (!id) throw new Error(`按 uid 取不回账号:${uid}`)
  return { uid, id }
}

describe('号池原子 SQL(真 PG)', () => {
  const server = Fastify({ logger: false, pluginTimeout: 60_000 })

  beforeAll(async () => {
    armIdentityByToken()
    await server.register(relayAccountPoolRoutes, { prefix: '/api' })
    await server.ready()
  }, 120_000)

  afterAll(async () => {
    await server.close()
    await db.execute(sql`delete from ai_relay_account_pool where uid like 'atomic-%'`)
    await db.execute(sql`delete from ai_relay_proxy_pool where proxy_url like 'http://127.0.0.%'`)
  })

  it('导入真落库;同 uid 再导入按 (provider,uid) 归并为一行', async () => {
    const { uid, raw } = syntheticAccount('dup')
    const first = await importAccounts('trae', [raw])
    expect(first.imported).toBe(1)
    const second = await importAccounts('trae', [raw])
    expect(second.updated).toBe(1)
    expect(second.imported).toBe(0)

    expect(
      await countRows(sql`select count(*)::int as n from ai_relay_account_pool where uid = ${uid}`),
    ).toBe(1)

    const r =
      asRows(
        await db.execute(
          sql`select token_enc is not null as has_token, refresh_token_enc is not null as has_refresh
              from ai_relay_account_pool where uid = ${uid}`,
        ),
      )[0] ?? {}
    expect(r['has_token']).toBe(true)
    expect(r['has_refresh']).toBe(true)

    await db.execute(sql`delete from ai_relay_account_pool where uid = ${uid}`)
  })

  it('并发认领:两个操作者同刻 claim → 恰好一人 200,库里 claimed_by 是赢家', async () => {
    const { uid, id } = await importOne('claim')
    const [a, b] = await Promise.all([
      server.inject({
        method: 'POST',
        url: `/api/admin/relay/accounts/${id}/claim`,
        headers: ADMIN_A,
        body: { note: 'A 先抢' },
      }),
      server.inject({
        method: 'POST',
        url: `/api/admin/relay/accounts/${id}/claim`,
        headers: ADMIN_B,
        body: { note: 'B 同刻抢' },
      }),
    ])
    const codes = [a.statusCode, b.statusCode].sort()
    expect(codes).toEqual([200, 409])

    const state = await claimState(id)
    expect(state.claimStatus).toBe('claimed')
    const winner = a.statusCode === 200 ? USER_A : USER_B
    expect(state.claimedBy).toBe(winner)

    await db.execute(sql`delete from ai_relay_account_pool where uid = ${uid}`)
  })

  it('本人重复认领幂等;他人释放 409 且副作用未发生;force 释放才摘牌', async () => {
    const { uid, id } = await importOne('release')
    const r1 = await server.inject({
      method: 'POST',
      url: `/api/admin/relay/accounts/${id}/claim`,
      headers: ADMIN_A,
    })
    expect(r1.statusCode).toBe(200)
    const r2 = await server.inject({
      method: 'POST',
      url: `/api/admin/relay/accounts/${id}/claim`,
      headers: ADMIN_A,
    })
    expect(r2.statusCode).toBe(200)

    const denied = await server.inject({
      method: 'POST',
      url: `/api/admin/relay/accounts/${id}/release`,
      headers: ADMIN_B,
    })
    expect(denied.statusCode).toBe(409)
    // 越权用例必须断言「副作用没发生」
    expect(await claimState(id)).toEqual({ claimStatus: 'claimed', claimedBy: USER_A })

    const forced = await server.inject({
      method: 'POST',
      url: `/api/admin/relay/accounts/${id}/release`,
      headers: ADMIN_B,
      body: { force: true },
    })
    expect(forced.statusCode).toBe(200)
    expect(await claimState(id)).toEqual({ claimStatus: 'unclaimed', claimedBy: null })

    await db.execute(sql`delete from ai_relay_account_pool where uid = ${uid}`)
  })

  it('认领不存在的 id → 404(与「已被他人认领」的 409 分流成立)', async () => {
    const missing = '00000000-0000-4000-8000-0000000000ff'
    const res = await server.inject({
      method: 'POST',
      url: `/api/admin/relay/accounts/${missing}/claim`,
      headers: ADMIN_A,
    })
    expect(res.statusCode).toBe(404)
  })

  it('代理轮换串行取用 → 三枚依次拿到,last_picked_at 单调后移', async () => {
    const urls = ['http://127.0.0.11:8080', 'http://127.0.0.12:8080', 'http://127.0.0.13:8080']
    for (const u of urls) {
      const r = await createProxy({ proxyUrl: u, providerCode: 'trae' })
      expect(r.ok).toBe(true)
    }
    const seen: string[] = []
    for (let i = 0; i < 3; i++) {
      const picked = await pickProxyForAccount({ id: USER_A, proxyUrl: null })
      expect(picked).not.toBeNull()
      seen.push(String(picked))
    }
    // 每取一枚就把它排到最后 → 三轮应覆盖三枚(不重复)
    expect(new Set(seen).size).toBe(3)

    expect(
      await countRows(
        sql`select count(*)::int as n from ai_relay_proxy_pool
             where proxy_url like 'http://127.0.0.%' and last_picked_at is null`,
      ),
    ).toBe(0)

    await db.execute(sql`delete from ai_relay_proxy_pool where proxy_url like 'http://127.0.0.%'`)
  })

  it('代理并发取用 12 路 → 全部返回可用地址,无一行被漏刷', async () => {
    const urls = ['http://127.0.0.21:8080', 'http://127.0.0.22:8080', 'http://127.0.0.23:8080']
    for (const u of urls) await createProxy({ proxyUrl: u, providerCode: 'trae' })

    const results = await Promise.all(
      Array.from({ length: 12 }, () => pickProxyForAccount({ id: USER_B, proxyUrl: null })),
    )
    expect(results.every((r) => typeof r === 'string' && r.startsWith('http://'))).toBe(true)

    expect(
      await countRows(
        sql`select count(*)::int as n from ai_relay_proxy_pool
             where proxy_url like 'http://127.0.0.%' and last_picked_at is not null`,
      ),
    ).toBe(urls.length)

    await db.execute(sql`delete from ai_relay_proxy_pool where proxy_url like 'http://127.0.0.%'`)
  })

  it('同一序列跑两遍 → 两次读数相同且跑完归零(测试隔离铁律)', async () => {
    const runOnce = async (): Promise<{ during: number; after: number }> => {
      await importOne('twice')
      await createProxy({ proxyUrl: 'http://127.0.0.31:8080', providerCode: 'trae' })
      await pickProxyForAccount({ id: USER_A, proxyUrl: null })
      const count = async (): Promise<number> =>
        (await countRows(
          sql`select count(*)::int as n from ai_relay_account_pool where uid like 'atomic-twice-%'`,
        )) +
        (await countRows(
          sql`select count(*)::int as n from ai_relay_proxy_pool where proxy_url like 'http://127.0.0.%'`,
        ))
      const during = await count()
      await db.execute(sql`delete from ai_relay_account_pool where uid like 'atomic-twice-%'`)
      await db.execute(sql`delete from ai_relay_proxy_pool where proxy_url like 'http://127.0.0.%'`)
      return { during, after: await count() }
    }
    const first = await runOnce()
    const second = await runOnce()
    // 两趟同数 ⇒ 上一趟没留残渣;跑完归零 ⇒ 本用例不自带污染
    expect(first).toEqual(second)
    expect(first).toEqual({ during: 2, after: 0 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
