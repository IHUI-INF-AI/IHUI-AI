// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批量删除告警静默:expectedIds"确认窗集合"执行前复验(票2,G-998148,出处 b76-12b)。
 *
 * 机制:POST /relay/alert-silences/batch-delete 配可选 `expectedIds` ——
 *   确认框打开时看到的静默 id 集合。端点在执行删除**前**把当前存量集合与它整集比对,
 *   不一致 ⇒ 409 + 独立错误码 `EXPECTED_IDS_CHANGED`(不复用容量/权限码),
 *   响应体回带 addedIds(新增未确认的)/ removedIds(已消失的)/ currentIds,且**一条都不删**。
 *   缺省(不携带)= 迁移期放行,不得做成破坏性必填。
 *
 * 用例设计(五条各守一格,互不重复,不连库:mock service):
 *   ① 票面 e2e 两步(红):GET 列表 → 另一会话插入 1 条 → 用第 1 步的 id 集合 POST 批量处置
 *      ⇒ 409 EXPECTED_IDS_CHANGED + addedIds 点名新增未确认的那条 + 库一条没动
 *   ② 集合一致(绿):expectedIds 与当前存量完全一致 ⇒ 放行执行,deleted 计数为库确认数
 *   ③ 缺省放行(迁移期):不带 expectedIds,即便集合已变也照删 —— 证明"缺省=放行、显式带=复验"
 *   ④ 集合缩小:expectedIds 含已消失的 id ⇒ 409,removedIds 点名,同样一条不动
 *   ⑤ 形状闸:空 ids / 非 uuid ⇒ 400,不触库(复验与删除都不发生)
 * 机制锁:①④ 都断言 silenceStore 长度不变 —— 否则"整体拒绝"可以靠"删了再说"蒙过。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

interface SilenceRow {
  id: string
  scope: 'rule' | 'all'
  ruleId: string | null
  reason: string | null
  startsAt: Date
  endsAt: Date
  createdBy: string | null
  createdAt: Date
}

const { silenceStore, mockService } = vi.hoisted(() => {
  interface Row {
    id: string
    scope: 'rule' | 'all'
    ruleId: string | null
    reason: string | null
    startsAt: Date
    endsAt: Date
    createdBy: string | null
    createdAt: Date
  }
  const silenceStore: Row[] = []
  let seq = 0
  const makeRow = (over?: Partial<Row>): Row => {
    seq += 1
    const id = over?.id ?? `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`
    return {
      id,
      scope: 'all',
      ruleId: null,
      reason: null,
      startsAt: new Date('2026-01-01T00:00:00Z'),
      endsAt: new Date('2099-01-01T00:00:00Z'),
      createdBy: 'test',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...over,
    }
  }
  const mockService = {
    listAlertRules: vi.fn(async () => []),
    createAlertRule: vi.fn(),
    updateAlertRule: vi.fn(),
    deleteAlertRule: vi.fn(),
    listRecentAlertEvents: vi.fn(async () => []),
    listAlertSilences: vi.fn(async (includeExpired = false) =>
      includeExpired
        ? [...silenceStore]
        : silenceStore.filter((r) => r.endsAt.getTime() >= Date.now()),
    ),
    createAlertSilence: vi.fn(async (input: Partial<Row>) => {
      const row = makeRow(input)
      silenceStore.push(row)
      return row
    }),
    deleteAlertSilence: vi.fn(async (id: string) => {
      const idx = silenceStore.findIndex((r) => r.id === id)
      if (idx === -1) return false
      silenceStore.splice(idx, 1)
      return true
    }),
    validateAlertRuleInput: vi.fn(() => undefined),
  }
  return { silenceStore, mockService }
})

vi.mock('../src/services/relay-alert-rules-service.js', () => mockService)
vi.mock('../src/jobs/relay-alert-rules-evaluation.js', () => ({
  runAlertRuleEvaluation: vi.fn(async () => ({ evaluated: 0, triggered: 0, skipped: 0 })),
}))
// 管理员闸门与本票机制无关,放行为 no-op(不加载 auth/rbac 链)。
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))
// 路由文件经 admin/_shared.js 间接载入 db(本票不触库,阻断连接池初始化)。
vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {},
  dbClient: {},
}))

import adminRelayAlertRulesRoutes from '../src/routes/admin/relay-alert-rules.js'

const ID_A = '11111111-1111-4111-8111-111111111111'
const ID_B = '22222222-2222-4222-8222-222222222222'

const BATCH = '/relay/alert-silences/batch-delete'

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(adminRelayAlertRulesRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  silenceStore.length = 0
  silenceStore.push(
    {
      id: ID_A,
      scope: 'all',
      ruleId: null,
      reason: null,
      startsAt: new Date('2026-01-01T00:00:00Z'),
      endsAt: new Date('2099-01-01T00:00:00Z'),
      createdBy: 'test',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: ID_B,
      scope: 'rule',
      ruleId: ID_A,
      reason: null,
      startsAt: new Date('2026-01-01T00:00:00Z'),
      endsAt: new Date('2099-01-01T00:00:00Z'),
      createdBy: 'test',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
  )
  vi.clearAllMocks()
})

describe('批量删除静默:expectedIds 确认窗集合执行前复验', () => {
  it('① e2e 两步(红):GET 列表 → 另一会话插入 1 条 → 用第 1 步集合处置 ⇒ 409 独立码 + addedIds 点名 + 一条不动', async () => {
    const app = await buildApp()

    // 第 1 步:确认窗打开,拿到当时的 id 集合
    const list1 = await app.inject({ method: 'GET', url: '/relay/alert-silences' })
    expect(list1.statusCode).toBe(200)
    const idsAtConfirm = (list1.json().data.list as SilenceRow[]).map((r) => r.id)
    expect(idsAtConfirm).toEqual([ID_A, ID_B])

    // 第 2 步:另开会话插入 1 条(走真实创建端点,不是直接改内存)
    const created = await app.inject({
      method: 'POST',
      url: '/relay/alert-silences',
      payload: { scope: 'all', endsAt: '2099-06-01T00:00:00Z', createdBy: 'other-session' },
    })
    expect(created.statusCode).toBe(200)
    const newId = (created.json() as { data: SilenceRow }).data.id
    expect(silenceStore).toHaveLength(3)

    // 第 3 步:用第 1 步的 id 集合 POST 批量处置 ⇒ 必须拒绝
    const res = await app.inject({
      method: 'POST',
      url: BATCH,
      payload: { ids: idsAtConfirm, expectedIds: idsAtConfirm },
    })
    expect(res.statusCode).toBe(409)
    const body = res.json() as {
      code: number
      message: string
      errorCode: string
      data: { addedIds: string[]; removedIds: string[]; currentIds: string[] }
    }
    // 独立码:不复用容量/权限码
    expect(body.errorCode).toBe('EXPECTED_IDS_CHANGED')
    expect(body.message).toContain('新增未确认的')
    expect(body.message).toContain(newId)
    expect(body.data.addedIds).toEqual([newId])
    expect(body.data.removedIds).toEqual([])
    expect(body.data.currentIds).toEqual([ID_A, ID_B, newId])
    // 机制锁:整体拒绝 = 一条都没删
    expect(silenceStore).toHaveLength(3)
    await app.close()
  })

  it('② 集合一致(绿):expectedIds 与当前存量一致 ⇒ 放行执行,deleted 为库确认数', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: BATCH,
      payload: { ids: [ID_A, ID_B], expectedIds: [ID_A, ID_B] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { deleted: number; deletedIds: string[]; missedIds: string[] } }
    expect(body.data.deleted).toBe(2)
    expect(body.data.deletedIds).toEqual([ID_A, ID_B])
    expect(body.data.missedIds).toEqual([])
    expect(silenceStore).toHaveLength(0)
    await app.close()
  })

  it('③ 缺省放行(迁移期):不带 expectedIds,即便集合已变也照删 —— 缺省不得是破坏性必填', async () => {
    const app = await buildApp()
    // 集合已变:另一会话插入了 1 条
    await app.inject({
      method: 'POST',
      url: '/relay/alert-silences',
      payload: { scope: 'all', endsAt: '2099-06-01T00:00:00Z' },
    })
    const newId = (silenceStore[2] as SilenceRow).id
    const res = await app.inject({
      method: 'POST',
      url: BATCH,
      payload: { ids: [ID_A, ID_B] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { deleted: number; missedIds: string[] } }
    expect(body.data.deleted).toBe(2)
    expect(body.data.missedIds).toEqual([])
    // 只删确认过的两条,新增未确认的那条仍在
    expect(silenceStore.map((r) => r.id)).toEqual([newId])
    await app.close()
  })

  it('④ 集合缩小:expectedIds 含已消失的 id ⇒ 409,removedIds 点名,一条不动', async () => {
    const app = await buildApp()
    // ID_B 先被另一会话删掉
    silenceStore.splice(
      silenceStore.findIndex((r) => r.id === ID_B),
      1,
    )
    const res = await app.inject({
      method: 'POST',
      url: BATCH,
      payload: { ids: [ID_A, ID_B], expectedIds: [ID_A, ID_B] },
    })
    expect(res.statusCode).toBe(409)
    const body = res.json() as {
      errorCode: string
      data: { addedIds: string[]; removedIds: string[] }
    }
    expect(body.errorCode).toBe('EXPECTED_IDS_CHANGED')
    expect(body.data.removedIds).toEqual([ID_B])
    expect(body.data.addedIds).toEqual([])
    expect(silenceStore.map((r) => r.id)).toEqual([ID_A])
    await app.close()
  })

  it('⑤ 形状闸:空 ids / 非 uuid ⇒ 400,复验与删除都不发生', async () => {
    const app = await buildApp()
    const empty = await app.inject({ method: 'POST', url: BATCH, payload: { ids: [] } })
    expect(empty.statusCode).toBe(400)
    const bad = await app.inject({
      method: 'POST',
      url: BATCH,
      payload: { ids: [ID_A, 'not-a-uuid'], expectedIds: [ID_A] },
    })
    expect(bad.statusCode).toBe(400)
    expect(silenceStore).toHaveLength(2)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
