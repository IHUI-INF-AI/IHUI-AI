// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 134 后续批 · 第四批:批量写点全集的诚实性回归(不连库,全程 mock `src/db/index.js` 方法链)。
 *
 * 台账票:「守门 134 后续批(承 ② 裁定 B」——第一批(g134-batch1)只钉了 updated/created 布尔 ACK
 * 那一族,本批把同一把尺子铺到**现行 HEAD 现读的批量写点全集**。
 *
 * 现读全集(2026-10-29 按 HEAD 面,判据取自守门 134 自己的出口:`.where(` 里出现 `inArray(` 的
 * `db|tx|trx` 写链,`apps/api/src/routes` + `apps/api/src/db` 621 个跟踪文件):
 *   40 处 = 39 处 drizzle 链 + 1 处裸 SQL 链(`db/queries.ts:339` mergeUserAccounts)。
 * 其中 11 处**已有行为锁**(不重复钉):
 *   deleteNoticesBatch(g-815986)、chat-queries 批量三处(silent-distortion-batch-and-broadcast)、
 *   chat-group-queries.moveConversationsToGroup(chat-group-queries)、
 *   workspace-queries 两处(delete-ack-db-confirmed / user-batch-write-confirmed)、
 *   admin/_shared registerCrud 批量删(admin-crud-batch-delete-confirmed)、
 *   admin-demand-square /batch-review(admin-batch-missed-ids)、
 *   agents /examine/batch-approve(service-delete-confirmation ⑤)、
 *   voice-note-queries.deleteVoiceNotes(voice-note-predicate)。
 * 本批新钉 **26 处**(A 组 db 层 14 + B 组路由层 12),每处两格:库确认部分命中 ⇒ 计数/命中集
 * 必须是库回的那个子集;库确认零命中 ⇒ 必须回 0/空/undefined(或既有 404 语义),**绝不等于请求侧条数**。
 * 另有 3 处判为"实现不合规/无回执形态",本文件不动业务代码,逐条具名交主席(见交付报告未收格):
 * `routes/order.ts` /orders/batch-cancel 两条 UPDATE(无 .returning,cancelled 取自循环拼出的
 * cancellableIds.length)与 `db/queries.ts` mergeUserAccounts(裸 SQL DO 块,返回 void)。
 *
 * 测试隔离:不发任何真实 SQL(`src/db/index.js` 整体被替身顶掉),不连 PG/Redis;
 * 判据实现全在业务代码侧,本文件只观测行为,不复制守门 134 的任何正则(§22c)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify'

interface CapturedCall {
  op: 'select' | 'update' | 'delete' | 'insert'
  returningRequested: boolean
}

type Row = Record<string, unknown>

const stub = vi.hoisted(() => {
  const calls: Array<{ op: string; returningRequested: boolean }> = []
  const rows = {
    select: [] as unknown[],
    update: [] as unknown[],
    delete: [] as unknown[],
    insert: [] as unknown[],
  }
  return {
    calls,
    rows,
    reset(): void {
      calls.length = 0
      rows.select = []
      rows.update = []
      rows.delete = []
      rows.insert = []
    },
  }
})

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/ihui_test_g134b4'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:8811/0'
})

vi.mock('../src/db/index.js', () => {
  const makeChain = (op: CapturedCall['op']): Record<string, unknown> => {
    const entry: CapturedCall = { op, returningRequested: false }
    stub.calls.push(entry)
    const step: Record<string, unknown> = {}
    const self = (): Record<string, unknown> => step
    for (const m of [
      'from',
      'innerJoin',
      'leftJoin',
      'orderBy',
      'groupBy',
      'limit',
      'offset',
      'set',
      'values',
      'for',
      'onConflictDoUpdate',
      'onConflictDoNothing',
    ]) {
      step[m] = self
    }
    step.where = self
    step.returning = (): Record<string, unknown> => {
      entry.returningRequested = true
      return step
    }
    step.then = (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
      Promise.resolve(
        op === 'insert' ? stub.rows.insert : op === 'select' ? stub.rows.select : stub.rows[op],
      ).then(onOk, onErr)
    return step
  }
  const db: Record<string, unknown> = {
    select: () => makeChain('select'),
    update: () => makeChain('update'),
    delete: () => makeChain('delete'),
    insert: () => makeChain('insert'),
    execute: () => Promise.resolve([]),
  }
  db.transaction = (fn: (tx: Record<string, unknown>) => Promise<unknown>): Promise<unknown> =>
    fn(db)
  return { db, dbRead: db, dbClient: {} }
})

vi.mock('../src/plugins/auth.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  // 替身里的测试主体 id 必须是字面量:工厂在模块图初始化期就会被调用,引用后声明的常量会踩 TDZ。
  const principal = {
    userId: '00000000-0000-4000-8000-000000001134',
    phone: '',
    familyId: 'fam-test',
    roleId: 1,
  }
  return {
    ...actual,
    authenticate: async (request: { userId?: string; jwtPayload?: unknown }) => {
      request.userId = principal.userId
      request.jwtPayload = principal
      return principal
    },
    checkAuth: async (request: { userId?: string }) => {
      request.userId = principal.userId
      return true
    },
    requireActiveUser: async (): Promise<void> => undefined,
  }
})

vi.mock('../src/plugins/require-permission.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    requireAdmin: async (): Promise<void> => undefined,
    requireAuth: async (): Promise<void> => undefined,
    requirePermission: () => async (): Promise<void> => undefined,
  }
})

// edu-ai-management 在模块顶层 import 这些副作用件;批量写点本体不依赖它们。
vi.mock('../src/db/notification-queries.js', () => ({ createNotification: vi.fn() }))
vi.mock('../src/services/wechat-subscribe-message.js', () => ({
  isSubscribeMessageConfigured: () => false,
  getWechatMiniOpenId: vi.fn(async () => null),
  buildFeeReminderData: vi.fn(() => ({})),
  sendSubscribeMessage: vi.fn(async () => ({ ok: true })),
}))

import {
  cancelAllUserRole,
  selectAllUserRole,
  deleteJobsBatch,
  deletePostsBatch,
  deleteConfigsBatch,
  deleteDictTypesBatch,
  deleteDictDataBatch,
  deleteOperlogsBatch,
} from '../src/db/admin-sys-queries.js'
import { deleteSettlements } from '../src/db/agents-queries.js'
import { removeUserRoleBatch } from '../src/db/rbac-queries.js'
import { deleteSkillsByAuthorAndSlugs } from '../src/db/skills-queries.js'
import { cancelPayment, processRefund, handleRefund } from '../src/db/order-queries.js'
import { eduRoutes } from '../src/routes/admin-extended/edu-routes.js'
import { logininforRoutes } from '../src/routes/admin-sys/logininfor-routes.js'
import ossFilesRoutes from '../src/routes/admin/oss-files.js'
import relayChannelsRoutes from '../src/routes/admin/relay-channels.js'
import { messageRoutes } from '../src/routes/message.js'
import { businessCardRoutes } from '../src/routes/other/business-card-routes.js'
import { agentsRoutes } from '../src/routes/agents.js'
import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'

const USER_ID = '00000000-0000-4000-8000-000000001134'
const ID_A = '11111111-1111-4111-8111-1111111111a1'
const ID_B = '22222222-2222-4222-8222-2222222222b2'
const ID_C = '33333333-3333-4333-8333-3333333333c3'
const NUM_IDS = [7, 8, 9]

function supplyHit(hit: Row[]): void {
  stub.rows.update = hit
  stub.rows.delete = hit
}

beforeEach(() => {
  stub.reset()
})

// ── A 组:db 层批量写点 ────────────────────────────────────────────────────────

interface DbSite {
  readonly label: string
  /** 返回形态:count = 命中行数;ids = 命中 id 集;row = 单行条件更新的结果行 */
  readonly shape: 'count' | 'ids' | 'row'
  /** 请求侧条数(用于断言"虚报请求数"这一型) */
  readonly requestedLength: number
  readonly hit: Row[]
  readonly run: () => Promise<unknown>
  /** 空入参是否应当在任何 IO 之前早退(源码里有 `length === 0` 早退的才测这一格) */
  readonly runEmpty?: () => Promise<unknown>
}

const A_SITES: DbSite[] = [
  {
    label: 'db/admin-sys-queries.deleteJobsBatch',
    shape: 'count',
    requestedLength: 3,
    hit: [{ jobId: 7 }, { jobId: 8 }],
    run: () => deleteJobsBatch(NUM_IDS),
  },
  {
    label: 'db/admin-sys-queries.deletePostsBatch',
    shape: 'count',
    requestedLength: 3,
    hit: [{ postId: 7 }, { postId: 8 }],
    run: () => deletePostsBatch(NUM_IDS),
  },
  {
    label: 'db/admin-sys-queries.deleteConfigsBatch',
    shape: 'count',
    requestedLength: 3,
    hit: [{ configId: 7 }, { configId: 8 }],
    run: () => deleteConfigsBatch(NUM_IDS),
  },
  {
    label: 'db/admin-sys-queries.deleteDictTypesBatch',
    shape: 'count',
    requestedLength: 3,
    hit: [{ dictId: 7 }, { dictId: 8 }],
    run: () => deleteDictTypesBatch(NUM_IDS),
  },
  {
    label: 'db/admin-sys-queries.deleteDictDataBatch',
    shape: 'count',
    requestedLength: 3,
    hit: [{ dictCode: 7 }, { dictCode: 8 }],
    run: () => deleteDictDataBatch(NUM_IDS),
  },
  {
    label: 'db/admin-sys-queries.deleteOperlogsBatch',
    shape: 'count',
    requestedLength: 3,
    hit: [{ operId: 7 }, { operId: 8 }],
    run: () => deleteOperlogsBatch(NUM_IDS),
  },
  {
    label: 'db/admin-sys-queries.cancelAllUserRole',
    shape: 'ids',
    requestedLength: 3,
    hit: [{ id: ID_A }],
    run: () => cancelAllUserRole([ID_A, ID_B, ID_C], 2),
    runEmpty: () => cancelAllUserRole([], 2),
  },
  {
    label: 'db/admin-sys-queries.selectAllUserRole',
    shape: 'ids',
    requestedLength: 3,
    hit: [{ id: ID_B }],
    run: () => selectAllUserRole([ID_A, ID_B, ID_C], 3),
    runEmpty: () => selectAllUserRole([], 3),
  },
  {
    label: 'db/agents-queries.deleteSettlements',
    shape: 'count',
    requestedLength: 3,
    hit: [{ id: ID_A }, { id: ID_B }],
    run: () => deleteSettlements([ID_A, ID_B, ID_C]),
    runEmpty: () => deleteSettlements([]),
  },
  {
    label: 'db/rbac-queries.removeUserRoleBatch',
    shape: 'count',
    requestedLength: 3,
    hit: [{ id: ID_A }, { id: ID_B }],
    run: () => removeUserRoleBatch([ID_A, ID_B, ID_C], 'role-1'),
    runEmpty: () => removeUserRoleBatch([], 'role-1'),
  },
  {
    label: 'db/skills-queries.deleteSkillsByAuthorAndSlugs',
    shape: 'count',
    requestedLength: 3,
    hit: [{ id: 'skill-1' }, { id: 'skill-2' }],
    run: () => deleteSkillsByAuthorAndSlugs(USER_ID, ['a', 'b', 'c']),
    runEmpty: () => deleteSkillsByAuthorAndSlugs(USER_ID, []),
  },
  {
    label: 'db/order-queries.cancelPayment(状态集合 inArray 条件更新)',
    shape: 'row',
    requestedLength: 1,
    hit: [{ id: ID_A, status: 'cancelled' }],
    run: () => cancelPayment(ID_A),
  },
  {
    label: 'db/order-queries.processRefund(状态集合 inArray 条件更新)',
    shape: 'row',
    requestedLength: 1,
    hit: [{ id: ID_B, status: 'approved' }],
    run: () => processRefund(ID_B, 'approved', null),
  },
  {
    label: 'db/order-queries.handleRefund(事务内状态集合 inArray 条件更新)',
    shape: 'row',
    requestedLength: 1,
    hit: [{ id: ID_C, status: 'processing' }],
    run: () => handleRefund(ID_C, 'processing', null),
  },
]

describe('守门 134 第四批 A 组 —— db 层批量写点的计数/命中集必须由 .returning() 的库确认集推出', () => {
  for (const site of A_SITES) {
    describe(site.label, () => {
      it('库确认部分命中 ⇒ 回报的是库回的那个子集,不是请求侧条数', async () => {
        supplyHit(site.hit)
        const result = await site.run()
        if (site.shape === 'count') {
          expect(result).toBe(site.hit.length)
          expect(result).not.toBe(site.requestedLength)
          expect(stub.calls.some((c) => c.returningRequested)).toBe(true)
        } else if (site.shape === 'ids') {
          expect(result).toEqual(site.hit.map((r) => r.id))
        } else {
          expect(result).toEqual(site.hit[0])
        }
      })

      it('库确认零命中 ⇒ 0 / 空集合 / undefined(与"改成功"不得同形)', async () => {
        supplyHit([])
        const result = await site.run()
        if (site.shape === 'count') expect(result).toBe(0)
        else if (site.shape === 'ids') expect(result).toEqual([])
        else expect(result).toBeUndefined()
      })

      if (site.runEmpty) {
        it('空入参 ⇒ 早退且一条查询都不发出', async () => {
          supplyHit(site.hit)
          const mark = stub.calls.length
          const result = await site.runEmpty!()
          expect(stub.calls.length).toBe(mark)
          if (site.shape === 'count') expect(result).toBe(0)
          else expect(result).toEqual([])
        })
      }
    })
  }
})

// ── B 组:路由层批量写端点的响应 ack ─────────────────────────────────────────

interface RouteSite {
  readonly label: string
  readonly method: 'POST' | 'PUT' | 'DELETE'
  readonly url: string
  readonly payload: Record<string, unknown>
  /** 请求侧 id 数(虚报就是它) */
  readonly requested: readonly string[]
  /** 承载库确认数的响应键 */
  readonly countKey: string
  /** 未命中点名键(仅带 missedIds 的那一族) */
  readonly missedKey?: string
  /** 库回零行时的期望状态码(带 404 前置语义的端点用) */
  readonly zeroStatus: number
  readonly plugin: FastifyPluginAsync
  readonly prefix?: string
  /** 零行时是否仍回 200 且计数键为 0 */
  readonly zeroCountKey?: string
}

async function serve(plugin: FastifyPluginAsync, prefix = '/api'): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, pluginTimeout: 120_000 })
  app.setErrorHandler((err, _request, reply) => {
    const e = err as { statusCode?: number; message?: string }
    void reply.status(e?.statusCode ?? 500).send({ boom: e?.message ?? String(err) })
  })
  await app.register(plugin, { prefix })
  await app.ready()
  return app
}

const B_SITES: RouteSite[] = [
  {
    label: 'PUT /admin/messages/announcements',
    method: 'PUT',
    url: '/api/admin/messages/announcements',
    payload: { ids: [ID_A, ID_B, ID_C], patch: { status: 1 } },
    requested: [ID_A, ID_B, ID_C],
    countKey: 'updated',
    zeroStatus: 404,
    plugin: eduRoutes,
  },
  {
    label: 'PUT /admin/certificates/templates',
    method: 'PUT',
    url: '/api/admin/certificates/templates',
    payload: { ids: [ID_A, ID_B, ID_C], patch: { status: 1 } },
    requested: [ID_A, ID_B, ID_C],
    countKey: 'updated',
    zeroStatus: 404,
    plugin: eduRoutes,
  },
  {
    label: 'DELETE /logininfor/:infoIds',
    method: 'DELETE',
    url: '/logininfor/7,8,9',
    payload: {},
    requested: ['7', '8', '9'],
    countKey: 'deleted',
    zeroStatus: 200,
    zeroCountKey: 'deleted',
    plugin: logininforRoutes,
    prefix: '/logininfor',
  },
  {
    label: 'POST /oss/files/batch-delete',
    method: 'POST',
    url: '/api/oss/files/batch-delete',
    payload: { ids: [ID_A, ID_B, ID_C] },
    requested: [ID_A, ID_B, ID_C],
    countKey: 'deleted',
    zeroStatus: 200,
    zeroCountKey: 'deleted',
    plugin: ossFilesRoutes,
  },
  {
    label: 'POST /admin/relay/channels/batch-toggle',
    method: 'POST',
    url: '/api/admin/relay/channels/batch-toggle',
    payload: { ids: [ID_A, ID_B, ID_C], enabled: true },
    requested: [ID_A, ID_B, ID_C],
    countKey: 'updated',
    zeroStatus: 200,
    zeroCountKey: 'updated',
    plugin: relayChannelsRoutes,
  },
  {
    label: 'DELETE /messages/batch-delete',
    method: 'DELETE',
    url: '/api/messages/batch-delete',
    payload: { ids: [ID_A, ID_B, ID_C] },
    requested: [ID_A, ID_B, ID_C],
    countKey: 'deleted',
    missedKey: 'missedIds',
    zeroStatus: 200,
    zeroCountKey: 'deleted',
    plugin: messageRoutes,
  },
  {
    label: 'POST /business-card/batch-delete',
    method: 'POST',
    url: '/api/business-card/batch-delete',
    payload: { ids: [ID_A, ID_B, ID_C] },
    requested: [ID_A, ID_B, ID_C],
    countKey: 'deleted',
    missedKey: 'missedIds',
    zeroStatus: 200,
    zeroCountKey: 'deleted',
    plugin: businessCardRoutes,
  },
  {
    label: 'POST /examine/batch-reject',
    method: 'POST',
    url: '/api/examine/batch-reject',
    payload: { recordIds: [ID_A, ID_B, ID_C], reason: '不合规' },
    requested: [ID_A, ID_B, ID_C],
    countKey: 'rejected',
    missedKey: 'missedIds',
    zeroStatus: 200,
    zeroCountKey: 'rejected',
    plugin: agentsRoutes,
  },
  {
    label: 'POST /edu-ai-management/course-schedule/batch-delete',
    method: 'POST',
    url: '/api/edu-ai-management/course-schedule/batch-delete',
    payload: { ids: [ID_A, ID_B, ID_C] },
    requested: [ID_A, ID_B, ID_C],
    countKey: 'deleted',
    zeroStatus: 200,
    zeroCountKey: 'deleted',
    plugin: eduAiManagementRoutes,
    prefix: '/api/edu-ai-management',
  },
  {
    label: 'POST /edu-ai-management/scheduling-rule/batch-toggle',
    method: 'POST',
    url: '/api/edu-ai-management/scheduling-rule/batch-toggle',
    payload: { ids: [ID_A, ID_B, ID_C], isActive: true },
    requested: [ID_A, ID_B, ID_C],
    countKey: 'updated',
    zeroStatus: 200,
    zeroCountKey: 'updated',
    plugin: eduAiManagementRoutes,
    prefix: '/api/edu-ai-management',
  },
  {
    label: 'POST /edu-ai-management/lead/batch-status',
    method: 'POST',
    url: '/api/edu-ai-management/lead/batch-status',
    payload: { ids: [ID_A, ID_B, ID_C], status: 'converted' },
    requested: [ID_A, ID_B, ID_C],
    countKey: 'updated',
    zeroStatus: 200,
    zeroCountKey: 'updated',
    plugin: eduAiManagementRoutes,
    prefix: '/api/edu-ai-management',
  },
  {
    label: 'POST /edu-ai-management/enrollment/batch-status',
    method: 'POST',
    url: '/api/edu-ai-management/enrollment/batch-status',
    payload: { ids: [ID_A, ID_B, ID_C], status: 'paid' },
    requested: [ID_A, ID_B, ID_C],
    countKey: 'updated',
    zeroStatus: 200,
    zeroCountKey: 'updated',
    plugin: eduAiManagementRoutes,
    prefix: '/api/edu-ai-management',
  },
]

describe('守门 134 第四批 B 组 —— 批量写端点的响应 ack 必须由库确认集派生', () => {
  for (const site of B_SITES) {
    describe(site.label, () => {
      it(
        '库回 2/3 命中 ⇒ 计数键 = 2(虚报 3 即红)' +
          (site.missedKey ? ' + missedIds 点名第 3 个' : ''),
        async () => {
          const app = await serve(site.plugin, site.prefix)
          try {
            supplyHit([{ id: site.requested[0] }, { id: site.requested[1] }])
            const res = await app.inject({
              method: site.method,
              url: site.url,
              payload: site.payload,
            })
            expect(res.statusCode).toBe(200)
            const body = res.json() as { code: number; data: Record<string, unknown> }
            expect(body.code).toBe(0)
            expect(body.data[site.countKey]).toBe(2)
            if (site.missedKey) expect(body.data[site.missedKey]).toEqual([site.requested[2]])
          } finally {
            await app.close()
          }
        },
      )

      it(
        site.zeroStatus === 200
          ? '库回 0 命中 ⇒ 计数键 = 0(不得等于请求侧条数)'
          : `库回 0 命中 ⇒ 仍走既有 ${site.zeroStatus} 语义,不得回"成功改了 0 条"`,
        async () => {
          const app = await serve(site.plugin, site.prefix)
          try {
            supplyHit([])
            const res = await app.inject({
              method: site.method,
              url: site.url,
              payload: site.payload,
            })
            expect(res.statusCode).toBe(site.zeroStatus)
            if (site.zeroStatus === 200 && site.zeroCountKey) {
              const body = res.json() as { data: Record<string, unknown> }
              expect(body.data[site.zeroCountKey]).toBe(0)
              if (site.missedKey)
                expect(body.data[site.missedKey]).toEqual(site.requested.slice(0, 3))
            }
          } finally {
            await app.close()
          }
        },
      )
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
