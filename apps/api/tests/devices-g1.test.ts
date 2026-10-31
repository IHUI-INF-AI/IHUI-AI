// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G1 跨设备互联闭环(devices / pair-code / pair-exchange / heartbeat / claim /
 * tasks / delegate)路由+服务层回归测试(2026-10-30 立)。
 *
 * Mock 策略(照 chat-steer-withdraw 的基建 + token-balance-concurrency 的
 * 内存态 db 桩):vi.mock ../src/db/index.js 为**有状态内存假库**——
 * 按 drizzle 链(select/insert/update/onConflictDoUpdate/returning)与
 * db.execute(FOR UPDATE SKIP LOCKED 认领、惰性过期清扫)的 SQL 文本+参数
 * 解释执行,行锁语义由 JS 单线程串行天然模拟(两并发 claim 恰一个拿到)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import Fastify, { type FastifyInstance } from 'fastify'

// =============================================================================
// config / auth mock
// =============================================================================

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    // G1 新增两键(与 src/config/index.ts 同形态,字符串档位)
    DEVICE_DELEGATION_ENABLED: 'true',
    DEVICE_TOKEN_SECRET: '',
  },
}))
vi.mock('../src/config/index.js', () => ({ config: mockConfig }))

// 人令牌鉴权 mock:x-test-user 头注入 request.userId(照 chat-collab 取主体姿势)
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: any) => {
    const uid = request.headers?.['x-test-user']
    if (!uid) {
      const e: any = new Error('Authentication required')
      e.statusCode = 401
      throw e
    }
    request.userId = uid
    return { userId: uid }
  }),
  requireActiveUser: vi.fn(),
  checkAuth: vi.fn(async () => true),
}))

// =============================================================================
// 有状态内存假库(表名→行数组;drizzle 链 + db.execute 的 SQL 文本解释器)
// =============================================================================
vi.mock('../src/db/index.js', async () => {
  const { getTableName } = await import('drizzle-orm')
  const store: Record<string, any[]> = {
    devices: [],
    device_pair_codes: [],
    device_tasks: [],
    chat_conversations: [],
    device_tokens: [],
  }

  const snakeToCamel = (s: string): string => s.replace(/_([a-z])/g, (_m, c) => c.toUpperCase())

  /**
   * drizzle 0.45.2 SQL 对象 → { text, params }。chunk 形态(源码 sql/sql.js 实测):
   * - StringChunk.value = 字符串数组 → 拼文本
   * - Param.value = 标量 → 绑定参数 '?'
   * - Column(PgUUID 等,带 table+name) → 渲染 "table"."name"
   * - SQL / SQLWrapper → 递归 queryChunks / getSQL()
   * - sql 模板内嵌裸值(string/Date) → 绑定参数(dialect buildQueryFromSourceParams 尾支)
   */
  function parseSql(node: any): { text: string; params: unknown[] } {
    const parts: string[] = []
    const params: unknown[] = []
    const walk = (c: unknown): void => {
      if (c === null || c === undefined) return
      if (Array.isArray(c)) {
        c.forEach(walk)
        return
      }
      // sql 模板内嵌裸标量(string/number/boolean)→ 绑定参数;Date 走下方兜底分支
      if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') {
        params.push(c)
        parts.push('?')
        return
      }
      const o = c as Record<string, any>
      const name = o.constructor?.name
      if (name === 'StringChunk') {
        ;(o.value as unknown[]).forEach((v) => parts.push(String(v)))
        return
      }
      if (name === 'Param') {
        params.push(o.value)
        parts.push('?')
        return
      }
      if (o.table && typeof o.name === 'string') {
        parts.push(`"${getTableName(o.table)}"."${o.name}"`)
        return
      }
      if ('queryChunks' in o) {
        walk(o.queryChunks)
        return
      }
      if (typeof o.getSQL === 'function') {
        walk(o.getSQL())
        return
      }
      params.push(o)
      parts.push('?')
    }
    walk(node?.queryChunks ?? node)
    return { text: parts.join(''), params }
  }

  /** where 条件 → 谓词表("t"."col" = ? / > ? / is null) */
  function parsePreds(cond: any): Array<{ key: string; op: string; value?: unknown }> {
    const { text, params } = parseSql(cond)
    const preds: Array<{ key: string; op: string; value?: unknown }> = []
    const re = /"([a-z_]+)"\."([a-z_]+)"\s*(=|>|<)\s*\?|"([a-z_]+)"\."([a-z_]+)"\s+is null/gi
    let m: RegExpExecArray | null
    let p = 0
    while ((m = re.exec(text)) !== null) {
      if (m[3]) preds.push({ key: snakeToCamel(m[2]), op: m[3], value: params[p++] })
      else preds.push({ key: snakeToCamel(m[5]), op: 'is null' })
    }
    return preds
  }

  function matches(row: any, preds: Array<{ key: string; op: string; value?: unknown }>): boolean {
    return preds.every(({ key, op, value }) => {
      const rv = row[key]
      if (op === 'is null') return rv === null || rv === undefined
      if (op === '=') return String(rv) === String(value)
      if (op === '>') return new Date(rv).getTime() > new Date(value as never).getTime()
      if (op === '<') return new Date(rv).getTime() < new Date(value as never).getTime()
      return false
    })
  }

  function makeSelect() {
    const st: { table: string | null; preds: any[]; limitN: number } = {
      table: null,
      preds: [],
      limitN: Infinity,
    }
    const q: any = {
      from(t: any) {
        st.table = getTableName(t)
        return q
      },
      where(c: any) {
        st.preds = st.preds.concat(parsePreds(c))
        return q
      },
      orderBy() {
        return q
      },
      groupBy() {
        return q
      },
      limit(n: number) {
        st.limitN = n
        return q
      },
      then(res: any, rej?: any) {
        const rows = (store[st.table ?? ''] ?? []).filter((r) => matches(r, st.preds))
        return Promise.resolve(rows.slice(0, st.limitN).map((r) => ({ ...r }))).then(res, rej)
      },
    }
    return q
  }

  function applyInsert(tableName: string, v: any, conflictCfg: any): any[] {
    const rows = store[tableName]
    const row = { id: randomUUID(), createdAt: new Date(), ...v }
    if (conflictCfg) {
      const keys: string[] = conflictCfg.target.map((c: any) => snakeToCamel(c.name))
      const found = rows.find((r) => keys.every((k) => String(r[k]) === String(v[k])))
      if (found) {
        for (const [sk, sv] of Object.entries(conflictCfg.set)) {
          // G1b:registerDevice 的 set 里出现 drizzle SQL 模板(如
          // `coalesce(${devices.fingerprint}, excluded.fingerprint)`,指纹只绑定
          // 一次)。内存假库按其语义解释:已有值非空取已有值,否则取本次插入值。
          // (sk/sv 避免遮蔽外层参数 v —— insert values;v[sk] 取本次插入的同列值。)
          if (sv !== null && typeof sv === 'object' && 'queryChunks' in (sv as object)) {
            ;(found as any)[sk] = found[sk] ?? (v as any)[sk] ?? null
          } else {
            ;(found as any)[sk] = sv
          }
        }
        return [{ ...found }]
      }
    }
    rows.push(row)
    return [{ ...row }]
  }

  function makeInsert(t: any) {
    const tableName = getTableName(t)
    let values: any = null
    let conflictCfg: any = null
    const b: any = {
      values(v: any) {
        values = v
        return b
      },
      onConflictDoUpdate(cfg: any) {
        conflictCfg = cfg
        return b
      },
      returning() {
        return Promise.resolve(applyInsert(tableName, values, conflictCfg))
      },
      then(res: any, rej?: any) {
        return Promise.resolve(applyInsert(tableName, values, conflictCfg)).then(res, rej)
      },
    }
    return b
  }

  function makeUpdate(t: any) {
    const tableName = getTableName(t)
    let setVals: any = null
    let preds: any[] = []
    const apply = (): any[] => {
      const hit = (store[tableName] ?? []).filter((r) => matches(r, preds))
      hit.forEach((r) => Object.assign(r, setVals))
      return hit.map((r) => ({ ...r }))
    }
    const u: any = {
      set(v: any) {
        setVals = v
        return u
      },
      where(c: any) {
        preds = parsePreds(c)
        return u
      },
      returning() {
        return Promise.resolve(apply())
      },
      then(res: any, rej?: any) {
        return Promise.resolve(apply()).then(res, rej)
      },
    }
    return u
  }

  function toSnakeTask(r: any): Record<string, unknown> {
    return {
      id: r.id,
      session_id: r.sessionId,
      target_device_id: r.targetDeviceId,
      status: r.status,
      claimed_at: r.claimedAt ?? null,
      finished_at: r.finishedAt ?? null,
      error: r.error ?? null,
      result_summary: r.resultSummary ?? null,
      created_at: r.createdAt,
      created_by: r.createdBy,
    }
  }

  async function execute(sqlObj: any): Promise<{ rows: any[] }> {
    const { text, params } = parseSql(sqlObj)
    // 惰性过期清扫(claim / 列表查询前置)
    if (text.includes("'expired'")) {
      const [deviceId, cutoff] = params as [string, Date]
      store.device_tasks.forEach((r) => {
        if (
          r.targetDeviceId === deviceId &&
          r.status === 'queued' &&
          new Date(r.createdAt).getTime() < new Date(cutoff).getTime()
        ) {
          r.status = 'expired'
          r.finishedAt = new Date()
        }
      })
      return { rows: [] }
    }
    // 原子认领:UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1)
    if (text.includes('FOR UPDATE SKIP LOCKED')) {
      const deviceId = params[0] as string
      const cands = store.device_tasks
        .filter((r) => r.targetDeviceId === deviceId && r.status === 'queued')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      const pick = cands[0]
      if (!pick) return { rows: [] }
      pick.status = 'running'
      pick.claimedAt = new Date()
      return { rows: [toSnakeTask(pick)] }
    }
    return { rows: [] }
  }

  const db = {
    select: () => makeSelect(),
    insert: (t: any) => makeInsert(t),
    update: (t: any) => makeUpdate(t),
    execute,
    transaction: async (fn: (tx: any) => Promise<unknown>) => fn(db),
  }
  return { db, dbRead: db, dbClient: {}, __store: store }
})

import { devicesRoutes } from '../src/routes/devices.js'
import { hashPairCode } from '../src/services/device-service.js'

// =============================================================================
// 测试
// =============================================================================

const USER_A = randomUUID()
const USER_B = randomUUID()

let server: FastifyInstance
let store: Record<string, any[]>

beforeAll(async () => {
  store = ((await import('../src/db/index.js')) as any).__store
  server = Fastify({ logger: false })
  await server.register(devicesRoutes, { prefix: '/api' })
  await server.ready()
})

afterAll(async () => {
  await server.close()
})

beforeEach(() => {
  for (const k of Object.keys(store)) store[k]!.length = 0
  mockConfig.DEVICE_DELEGATION_ENABLED = 'true'
})

/** 人令牌请求 */
function asUser(method: string, url: string, userId: string, payload?: unknown) {
  return server.inject({
    method: method as never,
    url,
    headers: { 'x-test-user': userId },
    ...(payload !== undefined ? { payload: payload as never } : {}),
  })
}

/** 设备令牌请求 */
function asDevice(method: string, url: string, deviceToken: string, payload?: unknown) {
  return server.inject({
    method: method as never,
    url,
    headers: { authorization: `Bearer ${deviceToken}` },
    ...(payload !== undefined ? { payload: payload as never } : {}),
  })
}

/** 走完 pair-code → pair-exchange 全流程,拿 {deviceId, deviceToken} */
async function pairNewDevice(userId: string, name = '已配对设备') {
  const issued = await asUser('POST', '/api/devices/pair-code', userId)
  expect(issued.statusCode).toBe(200)
  const code = issued.json().data.code as string
  const exchanged = await server.inject({
    method: 'POST',
    url: '/api/devices/pair-exchange',
    payload: { code, name },
  })
  expect(exchanged.statusCode).toBe(200)
  const { device_token, device_id } = exchanged.json().data
  return { deviceToken: device_token as string, deviceId: device_id as string }
}

describe('G1 跨设备互联闭环', () => {
  it('注册幂等:同 user+name 重复注册返回原行并刷新 last_seen', async () => {
    const first = await asUser('POST', '/api/devices', USER_A, { name: 'PC-1', os: 'win' })
    expect(first.statusCode).toBe(200)
    const d1 = first.json().data
    const second = await asUser('POST', '/api/devices', USER_A, { name: 'PC-1', os: 'win11' })
    const d2 = second.json().data
    expect(d2.id).toBe(d1.id)
    expect(d2.os).toBe('win11')
    // 列表附 online(刚注册 last_seen=now ⇒ true)
    const list = await asUser('GET', '/api/devices', USER_A)
    const item = list.json().data.find((d: any) => d.id === d1.id)
    expect(item.online).toBe(true)
  })

  it('配对码单次使用:兑换成功一次后再次兑换 410;错码 400', async () => {
    const issued = await asUser('POST', '/api/devices/pair-code', USER_A)
    expect(issued.statusCode).toBe(200)
    const { code, expires_at } = issued.json().data
    expect(code).toMatch(/^\d{8}$/)
    expect(new Date(expires_at).getTime() - Date.now()).toBeLessThanOrEqual(5 * 60_000 + 1000)
    const ok = await server.inject({
      method: 'POST',
      url: '/api/devices/pair-exchange',
      payload: { code },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().data.device_token).toBeTruthy()
    expect(ok.json().data.device_id).toBeTruthy()
    const replay = await server.inject({
      method: 'POST',
      url: '/api/devices/pair-exchange',
      payload: { code },
    })
    expect(replay.statusCode).toBe(410)
    const wrong = await server.inject({
      method: 'POST',
      url: '/api/devices/pair-exchange',
      payload: { code: code === '00000000' ? '00000001' : '00000000' },
    })
    expect(wrong.statusCode).toBe(400)
  })

  it('配对码过期:expires_at 已过 → 410', async () => {
    store.device_pair_codes.push({
      id: randomUUID(),
      userId: USER_A,
      codeHash: hashPairCode('65432100'),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
      createdAt: new Date(Date.now() - 6 * 60_000),
    })
    const res = await server.inject({
      method: 'POST',
      url: '/api/devices/pair-exchange',
      payload: { code: '65432100' },
    })
    expect(res.statusCode).toBe(410)
  })

  it('配对码速率限制:每用户 10 次/小时,第 11 次 429', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await asUser('POST', '/api/devices/pair-code', USER_A)
      expect(res.statusCode).toBe(200)
    }
    const over = await asUser('POST', '/api/devices/pair-code', USER_A)
    expect(over.statusCode).toBe(429)
  })

  it('G1b 配对码 8 位形状:签发 8 位,6 位兑换 400', async () => {
    const issued = await asUser('POST', '/api/devices/pair-code', USER_A)
    expect(issued.statusCode).toBe(200)
    expect(String(issued.json().data.code)).toMatch(/^\d{8}$/)
    const short = await server.inject({
      method: 'POST',
      url: '/api/devices/pair-exchange',
      payload: { code: '123456' },
    })
    expect(short.statusCode).toBe(400)
  })

  it('G1b 指纹绑定:兑换带指纹 ⇒ 每请求须带同一指纹,不匹配 403;未绑定设备跳过(向后兼容)', async () => {
    const issued = await asUser('POST', '/api/devices/pair-code', USER_A)
    const code = issued.json().data.code as string
    const bound = await server.inject({
      method: 'POST',
      url: '/api/devices/pair-exchange',
      payload: { code, name: 'fp-bound', fingerprint: 'fp-device-aaaa' },
    })
    expect(bound.statusCode).toBe(200)
    const boundToken = bound.json().data.device_token as string

    const bad = await server.inject({
      method: 'POST',
      url: '/api/devices/heartbeat',
      headers: { authorization: `Bearer ${boundToken}`, 'x-device-fingerprint': 'fp-evil' },
    })
    expect(bad.statusCode).toBe(403)
    expect(bad.json().errorCode).toBe('DEVICE_FINGERPRINT_MISMATCH')

    const ok = await server.inject({
      method: 'POST',
      url: '/api/devices/heartbeat',
      headers: { authorization: `Bearer ${boundToken}`, 'x-device-fingerprint': 'fp-device-aaaa' },
    })
    expect(ok.statusCode).toBe(200)

    // 未声明指纹的设备(存量形态)不带指纹头照常工作 —— 旧行为逐字节保持。
    const { deviceToken: bareToken } = await pairNewDevice(USER_A, 'fp-bare')
    const bare = await server.inject({
      method: 'POST',
      url: '/api/devices/heartbeat',
      headers: { authorization: `Bearer ${bareToken}` },
    })
    expect(bare.statusCode).toBe(200)
  })

  it('G1b 版本闸:DEVICE_MIN_CLIENT_VERSION 非空时低于/缺失 409,达标通过;空 env 不启用', async () => {
    // 空 env(默认形态):不传 clientVersion 照常兑换
    const issued = await asUser('POST', '/api/devices/pair-code', USER_A)
    const code = issued.json().data.code as string
    const noGate = await server.inject({
      method: 'POST',
      url: '/api/devices/pair-exchange',
      payload: { code, name: 'ver-nogate' },
    })
    expect(noGate.statusCode).toBe(200)

    mockConfig.DEVICE_MIN_CLIENT_VERSION = '2.0.0'
    try {
      const issued2 = await asUser('POST', '/api/devices/pair-code', USER_A)
      const code2 = issued2.json().data.code as string
      const tooOld = await server.inject({
        method: 'POST',
        url: '/api/devices/pair-exchange',
        payload: { code: code2, name: 'ver-old', clientVersion: '1.9.9' },
      })
      expect(tooOld.statusCode).toBe(409)
      expect(tooOld.json().errorCode).toBe('DEVICE_VERSION_INCOMPATIBLE')

      const issued3 = await asUser('POST', '/api/devices/pair-code', USER_A)
      const code3 = issued3.json().data.code as string
      const missing = await server.inject({
        method: 'POST',
        url: '/api/devices/pair-exchange',
        payload: { code: code3, name: 'ver-missing' },
      })
      expect(missing.statusCode).toBe(409)

      const issued4 = await asUser('POST', '/api/devices/pair-code', USER_A)
      const code4 = issued4.json().data.code as string
      const ok = await server.inject({
        method: 'POST',
        url: '/api/devices/pair-exchange',
        payload: { code: code4, name: 'ver-ok', clientVersion: '2.1.0' },
      })
      expect(ok.statusCode).toBe(200)
    } finally {
      mockConfig.DEVICE_MIN_CLIENT_VERSION = ''
    }
  })

  it('delegate:到他用户设备 403;本人设备 queued;设备不存在 404', async () => {
    const reg = await asUser('POST', '/api/devices', USER_A, { name: 'PC-A' })
    const deviceId = reg.json().data.id as string
    store.chat_conversations.push(
      { id: randomUUID(), userId: USER_B },
      { id: randomUUID(), userId: USER_A },
    )
    const sessionB = store.chat_conversations.find((c) => c.userId === USER_B)!.id
    const sessionA = store.chat_conversations.find((c) => c.userId === USER_A)!.id
    // B 把 A 的设备当目标 → 403
    const forbidden = await asUser('POST', `/api/chat/sessions/${sessionB}/delegate`, USER_B, {
      target_device_id: deviceId,
    })
    expect(forbidden.statusCode).toBe(403)
    // 设备不存在 → 404
    const missing = await asUser('POST', `/api/chat/sessions/${sessionA}/delegate`, USER_A, {
      target_device_id: randomUUID(),
    })
    expect(missing.statusCode).toBe(404)
    // 本人设备 + 离线(从未心跳)允许入队
    const ok = await asUser('POST', `/api/chat/sessions/${sessionA}/delegate`, USER_A, {
      target_device_id: deviceId,
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().data).toMatchObject({ status: 'queued' })
    expect(ok.json().data.task_id).toBeTruthy()
    // 别名路径同形
    const alias = await asUser('POST', `/api/chat/conversations/${sessionA}/delegate`, USER_A, {
      target_device_id: deviceId,
    })
    expect(alias.statusCode).toBe(200)
  })

  it('claim 原子性:两并发认领恰一个拿到任务', async () => {
    const { deviceToken, deviceId } = await pairNewDevice(USER_A)
    const session = randomUUID()
    store.chat_conversations.push({ id: session, userId: USER_A })
    const delegated = await asUser('POST', `/api/chat/sessions/${session}/delegate`, USER_A, {
      target_device_id: deviceId,
    })
    expect(delegated.statusCode).toBe(200)
    const [r1, r2] = await Promise.all([
      asDevice('GET', '/api/devices/claim', deviceToken),
      asDevice('GET', '/api/devices/claim', deviceToken),
    ])
    const statuses = [r1.statusCode, r2.statusCode].sort()
    expect(statuses).toEqual([200, 204])
    const won = r1.statusCode === 200 ? r1 : r2
    expect(won.json().data.status).toBe('running')
    // 认领后 progress → complete 全链路
    const taskId = won.json().data.id as string
    const prog = await asDevice('POST', `/api/devices/tasks/${taskId}/progress`, deviceToken, {
      summary: { step: 1 },
    })
    expect(prog.statusCode).toBe(200)
    const done = await asDevice('POST', `/api/devices/tasks/${taskId}/complete`, deviceToken, {
      summary: { step: 2 },
    })
    expect(done.statusCode).toBe(200)
    expect(done.json().data.status).toBe('completed')
    // 终态后不可再更新
    const late = await asDevice('POST', `/api/devices/tasks/${taskId}/progress`, deviceToken, {
      summary: { step: 3 },
    })
    expect(late.statusCode).toBe(404)
  })

  it('expired 惰性判定:queued 超 24h 在 claim 与列表查询时置 expired', async () => {
    const { deviceToken, deviceId } = await pairNewDevice(USER_A)
    store.device_tasks.push({
      id: randomUUID(),
      sessionId: randomUUID(),
      targetDeviceId: deviceId,
      status: 'queued',
      claimedAt: null,
      finishedAt: null,
      error: null,
      resultSummary: null,
      createdAt: new Date(Date.now() - 25 * 60 * 60_000),
      createdBy: USER_A,
    })
    const claim = await asDevice('GET', '/api/devices/claim', deviceToken)
    expect(claim.statusCode).toBe(204)
    const list = await asUser('GET', `/api/devices/${deviceId}/tasks`, USER_A)
    expect(list.statusCode).toBe(200)
    expect(list.json().data[0].status).toBe('expired')
    // 跨用户读他人设备任务 → 404
    const foreign = await asUser('GET', `/api/devices/${deviceId}/tasks`, USER_B)
    expect(foreign.statusCode).toBe(404)
  })

  it('feature flag 关闭:delegate/claim 返回 503', async () => {
    mockConfig.DEVICE_DELEGATION_ENABLED = 'false'
    const { deviceToken, deviceId } = await pairNewDevice(USER_A)
    const session = randomUUID()
    store.chat_conversations.push({ id: session, userId: USER_A })
    const claim = await asDevice('GET', '/api/devices/claim', deviceToken)
    expect(claim.statusCode).toBe(503)
    const delegated = await asUser('POST', `/api/chat/sessions/${session}/delegate`, USER_A, {
      target_device_id: deviceId,
    })
    expect(delegated.statusCode).toBe(503)
  })

  it('心跳刷新 last_seen;撤销设备后令牌即刻失效', async () => {
    const { deviceToken, deviceId } = await pairNewDevice(USER_A)
    const hb = await asDevice('POST', '/api/devices/heartbeat', deviceToken)
    expect(hb.statusCode).toBe(200)
    expect(hb.json().data.device_token).toBeTruthy()
    const del = await asUser('DELETE', `/api/devices/${deviceId}`, USER_A)
    expect(del.statusCode).toBe(200)
    const after = await asDevice('POST', '/api/devices/heartbeat', deviceToken)
    expect(after.statusCode).toBe(401)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
