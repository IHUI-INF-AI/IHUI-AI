// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-269 回归：POST /api/gdpr/erase 的 PII 清除覆盖面与失败传播。
 *
 * 钉四件事：
 * 1. 删除覆盖现有 PII 表：user_emails / security_logs / devices /
 *    device_pair_codes / device_tasks（device_tasks 无 user_id，按 created_by 删）；
 * 2. users 主行匿名化必须同时清 gender / birthday（前者 0=未知，后者 NULL）；
 * 3. 任一单表 DELETE 失败 ⇒ purgeUserPii 抛出，绝不吞错后继续；
 * 4. 路由失败面返回 5xx + data.erased=false，而不是 200 erased:true。
 *
 * 全程 mock db（记录每条 DELETE/UPDATE 的表名与 WHERE），不连任何数据库。
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

type WhereQuery = { sql: string; params: unknown[] }
type DeleteCall = { table: string; sql: string; params: unknown[] }
type UpdateCall = { table: string; values: Record<string, unknown>; sql: string; params: unknown[] }

const USER_ID = '00000000-0000-4000-8000-000000000001'

const state = vi.hoisted(() => ({
  deletes: [] as DeleteCall[],
  updates: [] as UpdateCall[],
  failTable: null as string | null,
}))

const mocks = vi.hoisted(() => ({
  findUserById: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  findSearchHistory: vi.fn(),
  findAuditLogs: vi.fn(),
  addAuditLog: vi.fn(),
  clearSearchHistory: vi.fn(),
  loggerWarn: vi.fn(),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mocks.loggerWarn,
    error: vi.fn(),
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn().mockResolvedValue({}),
}))

vi.mock('../src/db/queries.js', () => ({
  findUserById: mocks.findUserById,
  revokeAllUserRefreshTokens: mocks.revokeAllUserRefreshTokens,
}))

vi.mock('../src/db/search-queries.js', () => ({
  findSearchHistory: mocks.findSearchHistory,
  findAuditLogs: mocks.findAuditLogs,
  addAuditLog: mocks.addAuditLog,
  clearSearchHistory: mocks.clearSearchHistory,
}))

// 假 db：delete/update 逐条记录“表名 + WHERE 真值”，transaction 直接把假事务交给回调。
vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const { getTableName } = await import('drizzle-orm')
  const dialect = new PgDialect()

  const toQuery = (where: unknown): WhereQuery => {
    const q = dialect.sqlToQuery(where as Parameters<typeof dialect.sqlToQuery>[0])
    return { sql: q.sql, params: q.params as unknown[] }
  }

  const deleteRows = (table: unknown) => ({
    where(where: unknown) {
      const name = getTableName(table as Parameters<typeof getTableName>[0])
      if (state.failTable === name) {
        return Promise.reject(new Error(`forced ${name} delete failure`))
      }
      const q = toQuery(where)
      state.deletes.push({ table: name, sql: q.sql, params: q.params })
      return Promise.resolve([])
    },
  })

  const updateRows = (table: unknown) => ({
    set(values: Record<string, unknown>) {
      const name = getTableName(table as Parameters<typeof getTableName>[0])
      const entry: UpdateCall = { table: name, values, sql: '', params: [] }
      state.updates.push(entry)
      return {
        where(where: unknown) {
          const q = toQuery(where)
          entry.sql = q.sql
          entry.params = q.params
          return {
            returning: () => Promise.resolve([{ id: USER_ID }]),
            then: (resolve: (v: unknown[]) => void) => resolve([]),
          }
        },
      }
    },
  })

  const tx = { delete: deleteRows, update: updateRows }
  return {
    db: {
      ...tx,
      transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => fn(tx),
    },
  }
})

import { purgeUserPii } from '../src/services/purge-user-pii.js'
import { gdprRoutes } from '../src/routes/gdpr.js'

// 现存 PII 表全集（packages/database/src/schema 已核实全部存在）：
// users.ts → user_emails；security-logs.ts → security_logs；
// devices.ts → devices / device_pair_codes / device_tasks；
// 其余为既有账号注销清单，防回退。
const REQUIRED_TABLES = [
  'user_auth_info',
  'user_addresses',
  'user_devices',
  'chat_conversations',
  'agent_memory_episodic',
  'agent_memory_semantic',
  'agent_memory_procedural',
  'user_memories',
  'notes',
  'behavior_watch_records',
  'oauth_sessions',
  'oauth_users',
  'user_third_party_accounts',
  'user_sk',
  'user_preferences',
  'user_passkeys',
  'device_tokens',
  'crash_reports',
  'visit_logs',
  'user_emails',
  'security_logs',
  'devices',
  'device_pair_codes',
  'device_tasks',
]

describe('F-269 purgeUserPii 表覆盖与失败传播（service）', () => {
  beforeEach(() => {
    state.deletes.length = 0
    state.updates.length = 0
    state.failTable = null
    mocks.findUserById.mockReset().mockResolvedValue({ id: USER_ID, status: 1 })
    mocks.revokeAllUserRefreshTokens.mockReset().mockResolvedValue(undefined)
    mocks.clearSearchHistory.mockReset().mockResolvedValue(0)
    mocks.addAuditLog.mockReset().mockResolvedValue(undefined)
  })

  it('DELETE 覆盖全部现存 PII 表，且 WHERE 命中该用户', async () => {
    await purgeUserPii(USER_ID)

    const deleted = state.deletes.map((d) => d.table)
    expect(deleted).toEqual(expect.arrayContaining(REQUIRED_TABLES))

    const byTable = new Map(state.deletes.map((d) => [d.table, d]))
    for (const table of ['user_emails', 'security_logs', 'devices', 'device_pair_codes']) {
      const call = byTable.get(table)
      expect(call).toBeDefined()
      expect(call?.sql).toContain('"user_id"')
      expect(call?.params).toContain(USER_ID)
    }
    // device_tasks 没有 user_id 列，归属列是 created_by。
    const tasks = byTable.get('device_tasks')
    expect(tasks).toBeDefined()
    expect(tasks?.sql).toContain('"created_by"')
    expect(tasks?.params).toContain(USER_ID)
  })

  it('users 匿名化 UPDATE 同时清 gender / birthday', async () => {
    await purgeUserPii(USER_ID)

    const update = state.updates.find((u) => u.table === 'users')
    expect(update).toBeDefined()
    expect(update?.values).toMatchObject({ gender: 0, birthday: null })
    expect(update?.values).toMatchObject({ phone: null, email: null, status: 3 })
    expect(update?.sql).toContain('"users"."id"')
    expect(update?.params).toContain(USER_ID)
  })

  it('任一单表 DELETE 失败 ⇒ 抛错，不再静默 erased:true', async () => {
    state.failTable = 'security_logs'

    await expect(purgeUserPii(USER_ID)).rejects.toThrow('forced security_logs delete failure')
    // 失败即中止：users 主行不得被继续匿名化后返回成功。
    expect(state.updates.some((u) => u.table === 'users')).toBe(false)
  })
})

describe('F-269 POST /api/gdpr/erase 失败面（route）', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.addHook('preHandler', async (request) => {
      request.userId = USER_ID
    })
    await app.register(gdprRoutes, { prefix: '/api/gdpr' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    state.deletes.length = 0
    state.updates.length = 0
    state.failTable = null
    mocks.findUserById.mockReset().mockResolvedValue({ id: USER_ID, status: 1 })
    mocks.revokeAllUserRefreshTokens.mockReset().mockResolvedValue(undefined)
    mocks.clearSearchHistory.mockReset().mockResolvedValue(0)
    mocks.addAuditLog.mockReset().mockResolvedValue(undefined)
  })

  it('单表失败 ⇒ 5xx 且 data.erased=false（不得 200 erased:true）', async () => {
    state.failTable = 'devices'

    const res = await app.inject({ method: 'POST', url: '/api/gdpr/erase' })
    expect(res.statusCode).toBe(500)
    const body = res.json() as { data?: { erased?: boolean } }
    expect(body.data?.erased).toBe(false)
  })

  it('成功路径仍返回 erased:true，且删除覆盖新增 PII 表', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/gdpr/erase' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.erased).toBe(true)
    expect(state.deletes.map((d) => d.table)).toEqual(expect.arrayContaining(REQUIRED_TABLES))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
