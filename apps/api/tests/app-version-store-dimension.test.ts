// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

// app_versions 的 store(分发渠道)维度锁 —— 零连接档(链式假 db,同 notifications-archive-partition)。
// 这里判的是"这条 where 究竟长什么样",不是"端点跑没跑通":
//   R1(回归锁)不带 store 的 /latest 必须与**加列前逐字同形**:渲染出的 SQL 文本与参数
//      都与基线 `and(eq(status,'latest'))`(+ platform)全等,且整条谓词里不出现 store 列。
//      失效方向按票面写死:线上端内更新卡不传 store,一旦这里加上 store 谓词就突然取不到包。
//   R2 带 store ⇒ 谓词真的挂在 store 列上,且渠道值走参数而不是拼进文本。
//   R3/R4 store 空串折成"不带";未知渠道值不判 400(渠道名单在变,刻意不做枚举)。
//   R5 超过列宽 32 ⇒ 400,不许静默截断。
//   R6/R7 写侧降级只降"同渠道"那一格:不带 store ⇒ store is null;带 store ⇒ store = $n;
//      PUT 沿用它自己的原渠道,发华为不得把官网那条挤掉。
const state = vi.hoisted(() => ({
  wheres: [] as unknown[],
  sets: [] as Record<string, unknown>[],
  values: [] as Record<string, unknown>[],
  rows: [] as unknown[],
}))

vi.mock('../src/db/index.js', () => {
  function makeApi() {
    const api: Record<string, unknown> = {
      from: () => api,
      orderBy: () => api,
      limit: () => api,
      offset: () => api,
      where: (w: unknown) => {
        state.wheres.push(w)
        return api
      },
      set: (v: Record<string, unknown>) => {
        state.sets.push(v)
        return api
      },
      values: (v: Record<string, unknown>) => {
        state.values.push(v)
        return api
      },
      returning: () => Promise.resolve(state.rows),
      then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(state.rows).then(res, rej),
    }
    return api
  }
  return {
    db: {
      select: () => makeApi(),
      insert: () => makeApi(),
      update: () => makeApi(),
      delete: () => makeApi(),
    },
    dbRead: { select: () => makeApi() },
  }
})

// admin 前置钩子与鉴权面本档不判(另有归属锁),mock 掉以便直接打受保护端点
vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: async () => {} }))

import { and, eq } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQLWrapper } from 'drizzle-orm'
import { appVersions } from '@ihui/database'
import appVersionRoutes from '../src/routes/app-version.js'

// drizzle 0.45 的 SQL 片段没有 toSQL(),渲染口径只有一条:交给 PgDialect。
const dialect = new PgDialect()

function queryOf(w: unknown): { sql: string; params: unknown[] } {
  const wrapper = w as SQLWrapper | undefined
  if (!wrapper || typeof wrapper.getSQL !== 'function')
    throw new Error('where 片段取不到 getSQL,判据失效方向必须是显式报错而不是静默通过')
  const q = dialect.sqlToQuery(wrapper.getSQL())
  return { sql: q.sql, params: [...q.params] }
}

/** 加列前的 /latest 谓词(逐字照抄改动前的实现),用作回归基线。 */
function baselineLatestWhere(platform?: string) {
  const conditions = [eq(appVersions.status, 'latest')]
  if (platform) conditions.push(eq(appVersions.platform, platform))
  return queryOf(and(...conditions))
}

/** 本次捕获到的第一条 latest 相关谓词(跳过 PUT 里那条按 id 取行的谓词)。 */
function latestWhere() {
  const hit = state.wheres.find((w) => queryOf(w).sql.includes('"status"'))
  if (!hit) throw new Error(`没有捕获到任何带 status 的 where:${JSON.stringify(state.wheres)}`)
  return queryOf(hit)
}

const server = Fastify({ logger: false })

beforeAll(async () => {
  await server.register(appVersionRoutes, { prefix: '/api/app-version' })
  await server.ready()
})

afterAll(async () => {
  await server.close()
})

const ROW = {
  id: '00000000-0000-4000-8000-000000000001',
  version: '1.0.0',
  platform: 'android',
  store: null,
  buildNumber: 5,
  downloadUrl: 'https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk',
  forceUpdate: false,
  releaseNotes: null,
  status: 'latest',
  createdAt: new Date('2026-11-03T00:00:00Z'),
  updatedAt: new Date('2026-11-03T00:00:00Z'),
}

describe('app-version store 维度(R1 不带 store 的旧语义逐字不变)', () => {
  beforeEach(() => {
    state.wheres.length = 0
    state.sets.length = 0
    state.values.length = 0
    state.rows = [{ ...ROW }]
  })

  it('R1 GET /latest 不带任何参数 ⇒ 谓词与加列前基线全等,且整条不碰 store 列', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/app-version/latest' })
    expect(res.statusCode).toBe(200)
    expect(latestWhere()).toEqual(baselineLatestWhere())
    expect(latestWhere().sql).not.toContain('store')
  })

  it('R1 GET /latest?platform=android ⇒ 与加列前基线全等(只有 status+platform 两个条件)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/app-version/latest?platform=android',
    })
    expect(res.statusCode).toBe(200)
    expect(latestWhere()).toEqual(baselineLatestWhere('android'))
    expect(latestWhere().sql).not.toContain('store')
    expect(latestWhere().params).toEqual(['latest', 'android'])
  })

  it('R1 响应体把 store 带回去(取到行 ⇒ 渠道格可见,取不到 ⇒ latest 仍旧是 undefined)', async () => {
    const hit = await server.inject({
      method: 'GET',
      url: '/api/app-version/latest?platform=android',
    })
    expect(hit.json().data.latest.store).toBeNull()
    state.rows = []
    const miss = await server.inject({
      method: 'GET',
      url: '/api/app-version/latest?platform=android',
    })
    expect(miss.json().data.latest).toBeUndefined()
  })

  it('R2 带 store ⇒ 谓词挂上 store 列且渠道值按参数传,不再等于基线', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/app-version/latest?platform=android&store=huawei',
    })
    expect(res.statusCode).toBe(200)
    const got = latestWhere()
    expect(got.sql).toContain('"store"')
    expect(got.params).toEqual(['latest', 'android', 'huawei'])
    expect(got).not.toEqual(baselineLatestWhere('android'))
  })

  it('R3 store 空串 = 不带 store(与加列前同形,不得退化成 store is null 之外的第三种查询)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/app-version/latest?store=' })
    expect(res.statusCode).toBe(200)
    expect(latestWhere()).toEqual(baselineLatestWhere())
    expect(latestWhere().sql).not.toContain('store')
  })

  it('R4 未知渠道值不判 400(渠道名单在变,API 层刻意不开新枚举)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/app-version/latest?store=oppo' })
    expect(res.statusCode).toBe(200)
    expect(latestWhere().params).toContain('oppo')
  })

  it('R5 store 超过列宽 32 ⇒ 400(不静默截断,SQL 也不许发出去)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/app-version/latest?store=${'x'.repeat(33)}`,
    })
    expect(res.statusCode).toBe(400)
    expect(state.wheres.length).toBe(0)
  })

  it('R6a POST 不带 store ⇒ 降级只打 store is null 那一格(= 加列前的同平台唯一 latest)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/app-version',
      payload: { version: '1.0.1', platform: 'android', buildNumber: 6 },
    })
    expect(res.statusCode).toBe(201)
    const demote = queryOf(state.wheres[0])
    expect(demote.sql).toContain('"platform"')
    expect(demote.sql).toContain('"status"')
    expect(demote.sql).toContain('is null')
    expect(demote.sql).not.toContain('"store" =')
    expect(demote.params).toEqual(['android', 'latest'])
    expect(state.values[0].store).toBeUndefined()
  })

  it('R6b POST 带 store ⇒ 降级按该渠道收窄,INSERT 的 values 里带着 store', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/app-version',
      payload: {
        version: '1.0.1',
        platform: 'android',
        store: 'huawei',
        buildNumber: 6,
        downloadUrl: 'https://www.aizhs.top/d/ihui-ai-huawei.apk',
      },
    })
    expect(res.statusCode).toBe(201)
    const demote = queryOf(state.wheres[0])
    expect(demote.sql).toContain('"store"')
    expect(demote.params).toEqual(['android', 'latest', 'huawei'])
    expect(state.values[0].store).toBe('huawei')
  })

  it('R7 PUT 升格为 latest ⇒ 沿用该行自己的渠道格,不跨渠道降级', async () => {
    state.rows = [{ ...ROW, store: 'huawei' }]
    const res = await server.inject({
      method: 'PUT',
      url: `/api/app-version/${ROW.id}`,
      payload: { status: 'latest' },
    })
    expect(res.statusCode).toBe(200)
    // wheres[0] = 按 id 取行;wheres[1] = 降级谓词
    const demote = queryOf(state.wheres[1])
    expect(demote.sql).toContain('"store"')
    expect(demote.params).toEqual(['android', 'latest', 'huawei'])
  })

  it('R7b PUT:该行渠道为空 ⇒ 降级落回 store is null(与加列前同形)', async () => {
    state.rows = [{ ...ROW, store: null }]
    const res = await server.inject({
      method: 'PUT',
      url: `/api/app-version/${ROW.id}`,
      payload: { status: 'latest' },
    })
    expect(res.statusCode).toBe(200)
    const demote = queryOf(state.wheres[1])
    expect(demote.sql).toContain('is null')
    expect(demote.params).toEqual(['android', 'latest'])
  })

  it('R8 check-update:不带 store ⇒ 谓词与加列前全等;带 store ⇒ 只多一个 store 条件', async () => {
    const before = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?platform=android&version=1.0.0',
    })
    expect(before.statusCode).toBe(200)
    const latestPredicate = queryOf(state.wheres[1])
    expect(latestPredicate.sql).not.toContain('"store"')
    expect(latestPredicate.params).toEqual(['android', 'latest'])

    state.wheres.length = 0
    const withStore = await server.inject({
      method: 'GET',
      url: '/api/app-version/check-update?platform=android&store=huawei&version=1.0.0',
    })
    expect(withStore.statusCode).toBe(200)
    expect(queryOf(state.wheres[1]).params).toEqual(['android', 'latest', 'huawei'])
  })

  it('R9 列表端点按 store 收窄(admin 排障要看单渠道),不带 store 时一条 store 谓词都不加', async () => {
    const all = await server.inject({ method: 'GET', url: '/api/app-version?platform=android' })
    expect(all.statusCode).toBe(200)
    expect(queryOf(state.wheres[0]).sql).not.toContain('"store"')
    state.wheres.length = 0
    const one = await server.inject({
      method: 'GET',
      url: '/api/app-version?platform=android&store=huawei',
    })
    expect(one.statusCode).toBe(200)
    expect(queryOf(state.wheres[0]).params).toEqual(['android', 'huawei'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
