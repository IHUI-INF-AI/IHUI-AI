// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-393 回归锁（2026-11-13）：内容运营按 :id 的详情/更新/删除必须带分类条件。
 *
 * 病灶：admin-content-routes.ts 里 about-us / contact / mobile-adapter / recommendation-config
 * 的 :id 端点只按主键定位，URL 所属分类与实体真实归属脱节 ⇒ 可跨分类读改删。
 * carousels（advertise）无 category 列，不在本票范围。
 *
 * 本文件用 mock db 复刻"分类也参与匹配"的库语义，并通过 PgDialect 编译 where 片段：
 *  ① GET/PUT/DELETE 的每个 where 都含分类列等值条件；
 *  ② 跨分类取/改/删 ⇒ 404，且目标行未被改写/删除；
 *  ③ payload 显式带的 category/categoryId 与路径不一致 ⇒ 400，且不写入；
 *  ④ 同分类正常操作成功（防误伤）。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { userId?: string }) => {
    request.userId = 'f393-admin'
  },
}))

const { state } = vi.hoisted(() => {
  type Row = { id: string; category: string; [k: string]: unknown }
  const store: Row[] = []
  const whereLog: unknown[] = []

  // 收集 where 里真正会绑定的值（drizzle SQL 的 Param.value）
  const collect = (node: unknown, out: unknown[] = []): unknown[] => {
    if (!node || typeof node !== 'object') return out
    const rec = node as Record<string, unknown>
    if ('value' in rec && !('queryChunks' in rec)) out.push(rec.value)
    if (Array.isArray(rec.queryChunks)) for (const c of rec.queryChunks) collect(c, out)
    return out
  }

  const matched = (whereArg: unknown): Row[] => {
    if (whereArg === undefined) return [...store]
    const params = collect(whereArg)
    // 模拟库语义：id 与分类必须同时命中；只带 id 的实现会在这里命中跨分类行
    return store.filter((r) => params.includes(r.id) && params.includes(r.category))
  }

  let seq = 0
  const makeChain = (kind: 'select' | 'insert' | 'update' | 'delete') => {
    let whereArg: unknown
    let writeArg: Record<string, unknown> | undefined
    const exec = (): Row[] => {
      if (kind === 'select') return matched(whereArg)
      if (kind === 'update') {
        const rows = matched(whereArg)
        for (const r of rows) Object.assign(r, writeArg)
        return rows
      }
      if (kind === 'delete') {
        const rows = matched(whereArg)
        for (const r of rows) {
          const i = store.indexOf(r)
          if (i >= 0) store.splice(i, 1)
        }
        return rows
      }
      const row = { id: `new-${++seq}`, ...(writeArg ?? {}) } as Row
      store.push(row)
      return [row]
    }
    const chain: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'set', 'values', 'returning', 'orderBy', 'limit', 'offset']) {
      chain[m] = (arg?: unknown) => {
        if (m === 'where') {
          whereArg = arg
          whereLog.push(arg)
        }
        if (m === 'set' || m === 'values') writeArg = arg as Record<string, unknown>
        return chain
      }
    }
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve().then(exec).then(resolve, reject)
    return chain
  }

  const db = {
    select: vi.fn(() => makeChain('select')),
    insert: vi.fn(() => makeChain('insert')),
    update: vi.fn(() => makeChain('update')),
    delete: vi.fn(() => makeChain('delete')),
  }
  return { state: { store, whereLog, db } }
})

vi.mock('../src/db/index.js', () => ({ db: state.db }))

import { adminContentOpsRoutes } from '../src/routes/admin-content-routes.js'

const DOC_ABOUT_ID = '11111111-1111-4111-8111-111111111111'
const DOC_GUIDE_ID = '22222222-2222-4222-8222-222222222222'
const FB_CONTACT_ID = '33333333-3333-4333-8333-333333333333'
const FB_OTHER_ID = '44444444-4444-4444-8444-444444444444'
const REC_ID = '55555555-5555-4555-8555-555555555555'
const MOBILE_ID = '66666666-6666-4666-8666-666666666666'

function seed(): void {
  state.store.length = 0
  state.whereLog.length = 0
  state.store.push(
    { id: DOC_ABOUT_ID, category: 'about-us', title: '关于我们', content: '{}' },
    { id: DOC_GUIDE_ID, category: 'guide', title: '指南', content: '{}' },
    { id: FB_CONTACT_ID, category: 'contact', content: '{}' },
    { id: FB_OTHER_ID, category: 'feedback', content: '{}' },
    { id: REC_ID, category: 'recommendation', key: 'k', value: '{}' },
    { id: MOBILE_ID, category: 'mobile-adapter', key: 'm', value: '{}' },
  )
}

function whereSql(arg: unknown): string {
  return new PgDialect().sqlToQuery(arg as Parameters<PgDialect['sqlToQuery']>[0]).sql
}

function whereParams(arg: unknown): unknown[] {
  return new PgDialect().sqlToQuery(arg as Parameters<PgDialect['sqlToQuery']>[0]).params
}

describe('F-393 内容运营 :id 端点必须按分类限定', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorateRequest('userId', '')
    await app.register(adminContentOpsRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(seed)

  it('① GET/PUT/DELETE 的每个 where 都带分类列等值条件', async () => {
    const specs: Array<{
      method: 'GET' | 'PUT' | 'DELETE'
      url: string
      payload?: Record<string, unknown>
      col: 'category' | 'type'
      value: string
    }> = [
      {
        method: 'GET',
        url: `/api/admin/about-us/${DOC_ABOUT_ID}`,
        col: 'category',
        value: 'about-us',
      },
      {
        method: 'PUT',
        url: `/api/admin/about-us/${DOC_ABOUT_ID}`,
        payload: { network: 'n' },
        col: 'category',
        value: 'about-us',
      },
      {
        method: 'DELETE',
        url: `/api/admin/about-us/${DOC_ABOUT_ID}`,
        col: 'category',
        value: 'about-us',
      },
      { method: 'GET', url: `/api/admin/contact/${FB_CONTACT_ID}`, col: 'type', value: 'contact' },
      {
        method: 'PUT',
        url: `/api/admin/contact/${FB_CONTACT_ID}`,
        payload: { introduction: 'i' },
        col: 'type',
        value: 'contact',
      },
      {
        method: 'DELETE',
        url: `/api/admin/contact/${FB_CONTACT_ID}`,
        col: 'type',
        value: 'contact',
      },
      {
        method: 'GET',
        url: `/api/admin/mobile-adapter/${MOBILE_ID}`,
        col: 'category',
        value: 'mobile-adapter',
      },
      {
        method: 'GET',
        url: `/api/admin/recommendation-config/${REC_ID}`,
        col: 'category',
        value: 'recommendation',
      },
      {
        method: 'PUT',
        url: `/api/admin/recommendation-config/${REC_ID}`,
        payload: { name: 'k' },
        col: 'category',
        value: 'recommendation',
      },
      {
        method: 'PUT',
        url: `/api/admin/recommendation-config/${REC_ID}/toggle`,
        col: 'category',
        value: 'recommendation',
      },
      {
        method: 'DELETE',
        url: `/api/admin/recommendation-config/${REC_ID}`,
        col: 'category',
        value: 'recommendation',
      },
    ]

    for (const s of specs) {
      state.whereLog.length = 0
      const res = await app.inject({ method: s.method, url: s.url, payload: s.payload })
      expect(res.statusCode, `${s.method} ${s.url}`).toBeLessThan(400)
      expect(state.whereLog.length, `${s.method} ${s.url} 未发出 where`).toBeGreaterThan(0)
      for (const arg of state.whereLog) {
        const sql = whereSql(arg)
        expect(sql, `${s.method} ${s.url} where=${sql}`).toMatch(
          new RegExp(`"${s.col}"\\s*=\\s*\\$`),
        )
        expect(whereParams(arg), `${s.method} ${s.url} 分类值缺失`).toContain(s.value)
      }
    }
  })

  it('② 跨分类访问返回 404，且目标行未被改写/删除', async () => {
    const guideBefore = { ...state.store.find((r) => r.id === DOC_GUIDE_ID)! }
    expect(
      (await app.inject({ method: 'GET', url: `/api/admin/about-us/${DOC_GUIDE_ID}` })).statusCode,
    ).toBe(404)
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/api/admin/about-us/${DOC_GUIDE_ID}`,
          payload: { network: '被篡改' },
        })
      ).statusCode,
    ).toBe(404)
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/admin/about-us/${DOC_GUIDE_ID}` }))
        .statusCode,
    ).toBe(404)
    expect(state.store.find((r) => r.id === DOC_GUIDE_ID)).toEqual(guideBefore)

    // contact 同族：type='feedback' 的行不得经 /contact/:id 读写
    const fbBefore = { ...state.store.find((r) => r.id === FB_OTHER_ID)! }
    expect(
      (await app.inject({ method: 'GET', url: `/api/admin/contact/${FB_OTHER_ID}` })).statusCode,
    ).toBe(404)
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/api/admin/contact/${FB_OTHER_ID}`,
          payload: { introduction: '被篡改' },
        })
      ).statusCode,
    ).toBe(404)
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/admin/contact/${FB_OTHER_ID}` })).statusCode,
    ).toBe(404)
    expect(state.store.find((r) => r.id === FB_OTHER_ID)).toEqual(fbBefore)

    // systemConfigs 两张分类互串
    expect(
      (await app.inject({ method: 'GET', url: `/api/admin/mobile-adapter/${REC_ID}` })).statusCode,
    ).toBe(404)
    expect(
      (await app.inject({ method: 'GET', url: `/api/admin/recommendation-config/${MOBILE_ID}` }))
        .statusCode,
    ).toBe(404)
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/api/admin/recommendation-config/${MOBILE_ID}/toggle`,
        })
      ).statusCode,
    ).toBe(404)
  })

  it('③ payload 分类与路径不一致 ⇒ 400，且不写入', async () => {
    const before = { ...state.store.find((r) => r.id === DOC_ABOUT_ID)! }
    const put = await app.inject({
      method: 'PUT',
      url: `/api/admin/about-us/${DOC_ABOUT_ID}`,
      payload: { network: 'x', categoryId: 'guide' },
    })
    expect(put.statusCode).toBe(400)
    expect(state.store.find((r) => r.id === DOC_ABOUT_ID)).toEqual(before)

    const post = await app.inject({
      method: 'POST',
      url: '/api/admin/about-us',
      payload: { network: 'x', categoryId: 'guide' },
    })
    expect(post.statusCode).toBe(400)
    expect(state.store.filter((r) => r.category === 'guide').length).toBe(1)

    const rec = await app.inject({
      method: 'PUT',
      url: `/api/admin/recommendation-config/${REC_ID}`,
      payload: { name: 'k', category: 'mobile-adapter' },
    })
    expect(rec.statusCode).toBe(400)

    // 与路径一致时放行（以路径为准的强校验 等价实现）
    const ok = await app.inject({
      method: 'PUT',
      url: `/api/admin/recommendation-config/${REC_ID}`,
      payload: { name: 'k2', categoryId: 'recommendation' },
    })
    expect(ok.statusCode).toBe(200)
  })

  it('④ 同分类正常操作成功（防误伤）', async () => {
    const get = await app.inject({ method: 'GET', url: `/api/admin/about-us/${DOC_ABOUT_ID}` })
    expect(get.statusCode).toBe(200)
    expect(get.json().data.network).toBe('关于我们')

    const put = await app.inject({
      method: 'PUT',
      url: `/api/admin/about-us/${DOC_ABOUT_ID}`,
      payload: { network: '新关于' },
    })
    expect(put.statusCode).toBe(200)
    expect(state.store.find((r) => r.id === DOC_ABOUT_ID)?.title).toBe('新关于')

    const post = await app.inject({
      method: 'POST',
      url: '/api/admin/about-us',
      payload: { network: '新条目' },
    })
    expect(post.statusCode).toBe(201)
    expect(state.store.filter((r) => r.category === 'about-us').length).toBe(2)

    expect(
      (await app.inject({ method: 'GET', url: `/api/admin/contact/${FB_CONTACT_ID}` })).statusCode,
    ).toBe(200)
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/api/admin/contact/${FB_CONTACT_ID}`,
          payload: { introduction: 'hi' },
        })
      ).statusCode,
    ).toBe(200)

    const mobile = await app.inject({
      method: 'GET',
      url: `/api/admin/mobile-adapter/${MOBILE_ID}`,
    })
    expect(mobile.statusCode).toBe(200)
    expect(mobile.json().data.model).toBe('m')

    const recGet = await app.inject({
      method: 'GET',
      url: `/api/admin/recommendation-config/${REC_ID}`,
    })
    expect(recGet.statusCode).toBe(200)
    expect(recGet.json().data.name).toBe('k')

    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/api/admin/recommendation-config/${REC_ID}`,
          payload: { name: 'k2' },
        })
      ).statusCode,
    ).toBe(200)

    const toggle = await app.inject({
      method: 'PUT',
      url: `/api/admin/recommendation-config/${REC_ID}/toggle`,
    })
    expect(toggle.statusCode).toBe(200)
    expect(toggle.json().data.isEnabled).toBe(true)

    const recDel = await app.inject({
      method: 'DELETE',
      url: `/api/admin/recommendation-config/${REC_ID}`,
    })
    expect(recDel.statusCode).toBe(200)
    expect(recDel.json().data.deleted).toBe(true)
    expect(state.store.some((r) => r.id === REC_ID)).toBe(false)

    expect(
      (await app.inject({ method: 'DELETE', url: `/api/admin/about-us/${DOC_ABOUT_ID}` }))
        .statusCode,
    ).toBe(200)
    expect(state.store.some((r) => r.id === DOC_ABOUT_ID)).toBe(false)
  })
})
