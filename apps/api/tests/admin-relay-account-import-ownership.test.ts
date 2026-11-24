// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * admin 批量导入的归属回显锁(2026-11-06 立,2026-11-07 契约反转为强制个人池)。
 *
 * 立因:`POST /admin/relay/accounts/import` 曾把本批交给运营池(owner=null),而运营池的语义是
 * 「对一切请求者可见可用」—— 与机主 2026-10-31 永久指令「我自己填入号池的账号只能跟着我的
 * 账号走」正好反方向;同一枚号被不同通道各导一次时还会造出运营池 + 个人池双行,
 * `chooseSyncTargetRow` 又运营池优先,个人池那行从此拿不到客户端新票。
 *
 * 2026-11-07 起端点不再提供"静默落运营池"的语义:owner 一律取承载层注入的 request.userId,
 * 首次导入强制落个人池;想对他人开放只能显式走 `POST /:id/share`(全局共享标记)。
 * 因此本锁钉四件事:
 *  ① 落个人池必须回显,并把"首次导入强制落个人池 / 可共享到运营池"写进措辞;
 *  ② 回显指出的出路必须**仓里真存在、真能跑**(share/unshare 端点 + 跨归属检测脚本);
 *  ③ 原 result 的统计字段不得被展开丢掉;
 *  ④ 反向牙:端点不得再静默落运营池(默认语义改回就翻红)。
 * 同 uid 跨归属的**检测**判据不在本层复算 —— 它已由 scripts/check-pool-isolation.mjs 的
 * sameUidMultiRow 维承担(§0.6 单一真相源),这里只负责把人指向它。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.DATABASE_APP_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'unit-test-credentials-encryption-key-0123456789ab'
  process.env.NODE_ENV = 'test'
  return { ownerArgs: [] as unknown[], accountsArg: [] as unknown[] }
})

vi.mock('../src/db/index.js', () => {
  const chain = () => ({
    from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
  })
  const stub = Object.assign(chain, {
    select: chain,
    update: chain,
    insert: chain,
    delete: chain,
    transaction: () => Promise.resolve([]),
  })
  return { db: stub, dbRead: stub, dbScoped: stub, dbReadScoped: stub, sql: (s: unknown) => s }
})

/** 承载层注入的管理员主体:2026-11-07 起 import 的 owner 只能来自 request.userId。 */
const ADMIN_ID = '00000000-0000-4000-8000-00000000ad01'
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { userId?: string }) => {
    request.userId = ADMIN_ID
  },
}))

// 落库出口换成替身:本文件判的是"路由交出去的归属是哪一格 + 回显写了什么",
// 不是 importAccounts 内部(那有自己的用例)。第三参 ownerUserId 被逐次记下来。
vi.mock('../src/services/relay-account-pool-service.js', () => ({
  importAccounts: async (
    providerCode: string,
    accounts: unknown[],
    ownerUserId: string | null,
    _options?: unknown,
  ) => {
    h.ownerArgs.push(ownerUserId)
    h.accountsArg.push(accounts)
    return {
      providerCode,
      total: accounts.length,
      imported: accounts.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      items: accounts.map((_a, i) => ({ index: i, status: 'imported', reason: null })),
      checkinSync: { pushed: accounts.length, skipped: 0, pending: 0, error: null },
    }
  },
  completeAccountPhone: async () => ({}),
  matchPhoneCandidates: async () => ({ matched: [], ambiguous: [] }),
  decryptAccountCredentials: () => ({}),
}))

const HERE = dirname(fileURLToPath(import.meta.url))
const IMPORT_URL = '/admin/relay/accounts/import'

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify()
  const { default: relayAccountPoolRoutes } =
    await import('../src/routes/admin/relay-account-pool.js')
  await app.register(relayAccountPoolRoutes)
  return app
}

describe('admin 批量导入的归属回显', () => {
  /**
   * 整个路由模块 1800+ 行,动态 import 一次就要 30 秒级(本机并发跑守门时更慢)——
   * 每个用例各建一遍 app 会把用例打成「Test timed out」假红(与 rtl-waitfor-starvation
   * 同型:超时不是断言错)。故整批共用一枚 app,只在 afterAll 关一次。
   */
  let app: FastifyInstance
  const TMO = 240_000

  beforeAll(async () => {
    app = await buildApp()
  }, TMO)

  afterAll(async () => {
    await app?.close()
  }, TMO)

  beforeEach(() => {
    h.ownerArgs.length = 0
    h.accountsArg.length = 0
  })

  const payload = {
    providerCode: 'trae',
    accounts: [{ name: '15643495081', token: 'tok-fixture-only' }],
  }

  it(
    '① 落在个人池必须回显,并把"首次导入强制落个人池"写进措辞',
    async () => {
      const res = await app.inject({ method: 'POST', url: IMPORT_URL, payload })
      expect(res.statusCode).toBe(200)
      const data = res.json().data
      expect(data.ownership).toBeTruthy()
      expect(data.ownership.pool).toBe('personal')
      expect(data.ownership.label).toContain('个人池')
      expect(data.ownership.label).toContain('共享到运营池')
      // 新契约:交给落库出口的 owner 是承载层注入的本人 id,不再是 null(运营池)
      expect(h.ownerArgs).toEqual([ADMIN_ID])
    },
    TMO,
  )

  it(
    '② 回显指出的出路必须仓里真有、路径真对(§0.8 不写跑不通的出路)',
    async () => {
      const res = await app.inject({ method: 'POST', url: IMPORT_URL, payload })
      const data = res.json().data
      // HERE = apps/api/tests ⇒ 仓根在上一层之上(少跳一层会把路径指到 apps/ 下,自己验不出)
      const repoRoot = resolve(HERE, '..', '..', '..')

      // 出路一:显式共享到运营池(端点,不是脚本)
      expect(data.ownership.shareToOps.share).toMatch(/^POST \/admin\/relay\/accounts\/:id\/share$/)
      expect(data.ownership.shareToOps.unshare).toMatch(
        /^POST \/admin\/relay\/accounts\/:id\/unshare$/,
      )
      expect(data.ownership.shareToOps.why.length).toBeGreaterThan(4)

      // 出路二:跨归属同 uid 检测脚本,必须在仓里真存在
      const exit = data.ownership.detectSameUidAcrossOwners
      expect(typeof exit.cmd).toBe('string')
      expect(typeof exit.script).toBe('string')
      expect(typeof exit.cwd).toBe('string')
      expect(exit.cmd).toContain(exit.script)
      if (exit.cwd !== '.') expect(exit.cmd).toContain(`cd ${exit.cwd}`)
      expect(
        existsSync(resolve(repoRoot, exit.cwd, exit.script)),
        `detectSameUidAcrossOwners 指的文件不在仓里: ${exit.cwd}/${exit.script}`,
      ).toBe(true)
      expect(exit.why.length, 'detectSameUidAcrossOwners 没写为什么是这条出路').toBeGreaterThan(4)
      // .ts 出路不许被写成 node 直跑(本仓只有 .mjs 能 node 直执行)
      expect(exit.cmd).not.toMatch(/node \S+\.ts/)

      // 旧的"个人池出路"已随契约反转删除,不得再出现在响应里
      expect(data.ownership.toPersonalPool).toBeUndefined()
    },
    TMO,
  )

  it(
    '③ 展开不得吞掉原统计字段',
    async () => {
      const res = await app.inject({ method: 'POST', url: IMPORT_URL, payload })
      const data = res.json().data
      expect(data.imported).toBe(1)
      expect(data.total).toBe(1)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.checkinSync).toMatchObject({ pushed: 1, pending: 0 })
    },
    TMO,
  )

  it(
    '④ 反向牙:本端点必须落个人池,不得再静默落运营池(语义改回就翻红)',
    async () => {
      const res = await app.inject({ method: 'POST', url: IMPORT_URL, payload })
      const data = res.json().data
      expect(data.ownership.pool).toBe('personal')
      expect(h.ownerArgs).toEqual([ADMIN_ID])
      expect(JSON.stringify(data.ownership)).not.toContain('一切请求者')
    },
    TMO,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
