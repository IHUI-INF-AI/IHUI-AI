// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-1 / DBG-2 / DBG-3 / DBG-5：未校验的 x-tenant-id 不得切库，缺省不得 fail-open。
 *
 * 旧路径：tenant-db 在 request.tenantId 缺失时直接读 header 调 getTenantDatabase；
 * tenant-db-isolation 的 onRequest 同样读 header 填 tenantDbContext；
 * withTenant 若在事务外 SET LOCAL，search_path 实际不变；
 * TENANT_STRICT_MODE 不是精确的 'true' 时，无租户标识的请求被放行。
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'
import type * as DatabaseModule from '@ihui/database'
import type * as DbModule from '../../db/index.js'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const LEGIT_ID = '11111111-1111-1111-1111-111111111111'
const LEGIT_SCHEMA = 'tenant_11111111_1111_1111_1111_111111111111'
const FORGED = 'victim-tenant'

interface LookupRow {
  id: string
  status: number
}

const dbBox = vi.hoisted(() => {
  const txExecute = vi.fn(async (_query: unknown) => undefined)
  const execute = vi.fn(async (_query: unknown) => undefined)
  const transaction = vi.fn(
    async (cb: (handle: { execute: typeof txExecute }) => Promise<unknown>) =>
      cb({ execute: txExecute }),
  )
  return {
    txExecute,
    execute,
    transaction,
    rows: [] as LookupRow[],
  }
})

const routed = vi.hoisted(() => ({
  ids: [] as Array<string | null | undefined>,
  defaultMarker: { kind: 'default' as const },
  markers: new Map<string, { kind: 'tenant'; id: string }>(),
}))

vi.mock('../../db/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof DbModule>()
  return {
    ...actual,
    db: new Proxy(actual.db, {
      get(target, prop, receiver) {
        if (prop === 'execute') return dbBox.execute
        if (prop === 'transaction') return dbBox.transaction
        if (prop === 'select') {
          return () => ({
            from: () => ({
              where: () => ({
                limit: async () => dbBox.rows,
              }),
            }),
          })
        }
        if (prop === 'update') {
          return () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          })
        }
        return Reflect.get(target, prop, receiver)
      },
    }),
  }
})

vi.mock('@ihui/database', async (importOriginal) => {
  const actual = await importOriginal<typeof DatabaseModule>()
  return {
    ...actual,
    setDefaultDatabase: () => undefined,
    closeAllTenantDatabases: async () => undefined,
    getTenantDatabase: (tenantId: string | null | undefined): DatabaseModule.Database => {
      routed.ids.push(tenantId)
      if (!tenantId) return routed.defaultMarker as unknown as DatabaseModule.Database
      let marker = routed.markers.get(tenantId)
      if (!marker) {
        marker = { kind: 'tenant', id: tenantId }
        routed.markers.set(tenantId, marker)
      }
      return marker as unknown as DatabaseModule.Database
    },
  }
})

import tenantPlugin, { clearTenantCache, isTenantStrictMode } from '../tenant.js'
import tenantDbPlugin from '../tenant-db.js'
import { tenantDbIsolation, withTenant } from '../tenant-db-isolation.js'

interface Observed {
  handled: boolean
  tenantId: string | undefined
  tenantDB: unknown
  context: { tenantId: string | null; schema: string } | undefined
}

function blankObserved(): Observed {
  return { handled: false, tenantId: undefined, tenantDB: undefined, context: undefined }
}

function render(fragment: unknown): string {
  if (fragment === undefined || fragment === null) {
    throw new Error('missing sql fragment')
  }
  const query = new PgDialect().sqlToQuery(fragment as Parameters<PgDialect['sqlToQuery']>[0])
  return query.sql
}

describe('租户头不得切库，缺省不得 fail-open', () => {
  let app: FastifyInstance
  let seen: Observed

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(tenantPlugin)
    await app.register(tenantDbIsolation)
    await app.register(tenantDbPlugin)
    app.addHook('onRequest', async (request) => {
      seen.tenantId = request.tenantId
      seen.tenantDB = request.tenantDB
      seen.context = request.tenantDbContext
    })
    const capture = async (request: FastifyRequest) => {
      seen.handled = true
      seen.tenantId = request.tenantId
      seen.tenantDB = request.tenantDB
      seen.context = request.tenantDbContext
      return { ok: true }
    }
    app.get('/api/private', capture)
    app.get('/api/health', capture)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    clearTenantCache()
    dbBox.rows = []
    routed.ids.length = 0
    seen = blankObserved()
    vi.clearAllMocks()
  })

  it('伪造 x-tenant-id 在非公开路径不会切到对应租户库', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/private',
      headers: { 'x-tenant-id': FORGED },
    })

    expect(res.statusCode).toBe(404)
    expect(seen.handled).toBe(false)
    expect(routed.ids).not.toContain(FORGED)
    expect(dbBox.execute).not.toHaveBeenCalled()
    expect(dbBox.transaction).not.toHaveBeenCalled()
  })

  it('伪造 x-tenant-id 在免租户公开路径也不会切库或建立 schema 上下文', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-tenant-id': FORGED },
    })

    expect(res.statusCode).toBe(200)
    expect(seen.handled).toBe(true)
    expect(seen.tenantId).toBeUndefined()
    expect(seen.context).toBeUndefined()
    expect(seen.tenantDB).toBe(routed.defaultMarker)
    expect(routed.ids).toEqual([undefined])
    expect(dbBox.execute).not.toHaveBeenCalled()
    expect(dbBox.transaction).not.toHaveBeenCalled()
  })

  it('停用租户的 header 不会切库', async () => {
    dbBox.rows = [{ id: LEGIT_ID, status: 0 }]
    const res = await app.inject({
      method: 'GET',
      url: '/api/private',
      headers: { 'x-tenant-id': 'acme' },
    })

    expect(res.statusCode).toBe(403)
    expect(seen.handled).toBe(false)
    expect(routed.ids).not.toContain(LEGIT_ID)
    expect(routed.ids).not.toContain('acme')
  })

  it('校验通过的租户仍走自己的库，且请求路径不在事务外发 SET LOCAL', async () => {
    dbBox.rows = [{ id: LEGIT_ID, status: 1 }]
    const res = await app.inject({
      method: 'GET',
      url: '/api/private',
      headers: { 'x-tenant-id': 'acme' },
    })

    expect(res.statusCode).toBe(200)
    expect(seen.handled).toBe(true)
    expect(seen.tenantId).toBe(LEGIT_ID)
    expect(seen.tenantDB).toEqual({ kind: 'tenant', id: LEGIT_ID })
    expect(seen.context).toEqual({ tenantId: LEGIT_ID, schema: LEGIT_SCHEMA })
    expect(routed.ids).toEqual([LEGIT_ID])
    expect(dbBox.execute).not.toHaveBeenCalled()
    expect(dbBox.transaction).not.toHaveBeenCalled()
  })

  it('withTenant 仍在事务内设置 search_path，请求钩子不再走事务外的旧路径', async () => {
    const seenTx: unknown[] = []
    const result = await withTenant(LEGIT_ID, async (tx) => {
      seenTx.push(tx)
      return 'ok'
    })

    expect(result).toBe('ok')
    expect(dbBox.transaction).toHaveBeenCalledTimes(1)
    expect(dbBox.execute).not.toHaveBeenCalled()
    expect(dbBox.txExecute).toHaveBeenCalledTimes(1)
    const text = render(dbBox.txExecute.mock.calls[0]?.[0])
    expect(text).toContain('SET LOCAL search_path')
    expect(text).toContain(LEGIT_SCHEMA)
    expect(seenTx).toEqual([{ execute: dbBox.txExecute }])
  })

  it('未设置 TENANT_STRICT_MODE 时无租户标识必须 401', async () => {
    const prev = process.env.TENANT_STRICT_MODE
    delete process.env.TENANT_STRICT_MODE
    try {
      expect(isTenantStrictMode()).toBe(true)
      expect(isTenantStrictMode('')).toBe(true)
      expect(isTenantStrictMode('true')).toBe(true)
      expect(isTenantStrictMode('FALSE')).toBe(false)
      const res = await app.inject({ method: 'GET', url: '/api/private' })
      expect(res.statusCode).toBe(401)
      expect(seen.handled).toBe(false)
      expect(routed.ids).not.toContain(FORGED)
    } finally {
      if (prev === undefined) delete process.env.TENANT_STRICT_MODE
      else process.env.TENANT_STRICT_MODE = prev
    }
  })

  it('显式 TENANT_STRICT_MODE=false 才放行无标识请求，且仍停在默认库', async () => {
    const prev = process.env.TENANT_STRICT_MODE
    process.env.TENANT_STRICT_MODE = 'false'
    try {
      const res = await app.inject({ method: 'GET', url: '/api/private' })
      expect(res.statusCode).toBe(200)
      expect(seen.handled).toBe(true)
      expect(seen.tenantId).toBeUndefined()
      expect(seen.tenantDB).toBe(routed.defaultMarker)
      expect(routed.ids).toEqual([undefined])
    } finally {
      if (prev === undefined) delete process.env.TENANT_STRICT_MODE
      else process.env.TENANT_STRICT_MODE = prev
    }
  })

  it('公开路径在严格缺省下仍可匿名访问', async () => {
    const prev = process.env.TENANT_STRICT_MODE
    delete process.env.TENANT_STRICT_MODE
    try {
      const res = await app.inject({ method: 'GET', url: '/api/health' })
      expect(res.statusCode).toBe(200)
      expect(seen.handled).toBe(true)
      expect(seen.tenantDB).toBe(routed.defaultMarker)
    } finally {
      if (prev === undefined) delete process.env.TENANT_STRICT_MODE
      else process.env.TENANT_STRICT_MODE = prev
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
