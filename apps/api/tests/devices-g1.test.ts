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
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    // G1 新增两键(与 src/config/index.ts 同形态,字符串档位)
    DEVICE_DELEGATION_ENABLED: 'true',
    DEVICE_TOKEN_SECRET: '',
    // G1b 版本闸:空串 = 不启用(用例内会临时改成具体版本号再复位)
    DEVICE_MIN_CLIENT_VERSION: '',
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
    // G3:审批正文从会话消息现读(getTaskApproval 走 chat_messages),测试要能造那条消息
    chat_messages: [],
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
      if (m[3]) preds.push({ key: snakeToCamel(m[2]!), op: m[3], value: params[p++] })
      else preds.push({ key: snakeToCamel(m[5]!), op: 'is null' })
    }
    // 取消的"即时"分支用裸 SQL 写 status IN ('queued','claimed'),假库要能解释它,
    // 否则 running 任务会被误判成"还没被认领"而直接置 failed。
    const inRe = /"([a-z_]+)"\."([a-z_]+)"\s+IN\s*\(([^)]+)\)/gi
    let mi: RegExpExecArray | null
    while ((mi = inRe.exec(text)) !== null) {
      const values = mi[3]!
        .split(',')
        .map((s) => s.trim().replace(/^'/, '').replace(/'$/, ''))
      preds.push({ key: snakeToCamel(mi[2]!), op: 'in', value: values })
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
      if (op === 'in') return (value as string[]).includes(String(rv))
      return false
    })
  }

  function makeSelect() {
    const st: {
      table: string | null
      preds: any[]
      limitN: number
      join: { table: string; left: string; right: string } | null
    } = {
      table: null,
      preds: [],
      limitN: Infinity,
      join: null,
    }
    const q: any = {
      from(t: any) {
        st.table = getTableName(t)
        return q
      },
      /**
       * G3:审批要按会话属主校验,service 用 innerJoin(chat_conversations)。
       * 假库只需支持最常见的 `col = col` 连接,方向不敏感(既有写法是
       * eq(chatConversations.id, deviceTasks.sessionId),主表在右)。
       */
      innerJoin(t: any, cond: any) {
        const joinTable = getTableName(t)
        const { text } = parseSql(cond)
        const m = /"([a-z_]+)"\."([a-z_]+)"\s*=\s*"([a-z_]+)"\."([a-z_]+)"/.exec(text)
        if (m) {
          const leftTable = m[1]!
          const leftCol = snakeToCamel(m[2]!)
          const rightTable = m[3]!
          const rightCol = snakeToCamel(m[4]!)
          if (leftTable === st.table && rightTable === joinTable) {
            st.join = { table: joinTable, left: leftCol, right: rightCol }
          } else if (rightTable === st.table && leftTable === joinTable) {
            st.join = { table: joinTable, left: rightCol, right: leftCol }
          }
        }
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
        let rows = (store[st.table ?? ''] ?? []).filter((r) => matches(r, st.preds))
        if (st.join) {
          const join = st.join
          const other = store[join.table] ?? []
          rows = rows.flatMap((r) =>
            other
              .filter((o) => String(o[join.right]) === String(r[join.left]))
              .map((o) => ({ ...r, ...o })),
          )
        }
        return Promise.resolve(rows.slice(0, st.limitN).map((r) => ({ ...r }))).then(res, rej)
      },
    }
    return q
  }

  function applyInsert(tableName: string, v: any, conflictCfg: any): any[] {
    const rows = store[tableName]
    // 真库的列默认值(attempt default 1 等)假库不模拟 ⇒ device:task 广播构造器会因
    // attempt=undefined 校验失败而把一次成功的委派染成 500。这里按表补默认。
    const defaults: Record<string, unknown> =
      tableName === 'device_tasks'
        ? { attempt: 1, progress: null, error: null, approvalRequest: null, approvalDecision: null }
        : {}
    const row = { id: randomUUID(), createdAt: new Date(), ...defaults, ...v }
    if (conflictCfg) {
      // target 允许单列(devices.ts 的 token 唯一键)或复合列(chat 等)
      const targets: any[] = Array.isArray(conflictCfg.target) ? conflictCfg.target : [conflictCfg.target]
      const keys: string[] = targets.map((c: any) => snakeToCamel(c.name))
      const found = rows!.find((r) => keys.every((k) => String(r[k]) === String(v[k])))
      if (found) {
        // DO UPDATE 的 WHERE 不成立 ⇒ PG 不写这一行且 RETURNING 回 0 行(SDB-01 的并发兜底)
        if (conflictCfg.setWhere && !matches(found, parsePreds(conflictCfg.setWhere))) return []
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
    rows!.push(row)
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
      payload: r.payload ?? null,
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
      store.device_tasks!.forEach((r) => {
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
      const cands = store
        .device_tasks!.filter((r) => r.targetDeviceId === deviceId && r.status === 'queued')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      const pick = cands[0]
      if (!pick) return { rows: [] }
      pick.status = 'running'
      pick.claimedAt = new Date()
      return { rows: [toSnakeTask(pick)] }
    }
    // 已在跑的任务被取消:只落意图(cancel_requested_at + 一句人话),不抢状态
    if (text.includes('cancel_requested_at = now()')) {
      const taskId = params[0] as string
      const row = store.device_tasks!.find((r) => r.id === taskId)
      if (row) {
        row.cancelRequestedAt = new Date()
        row.progress = {
          ...(row.progress ?? {}),
          lastEvent: '已请求取消,等待执行端收口',
          updatedAt: new Date().toISOString(),
        }
      }
      return { rows: [] }
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
    store.device_pair_codes!.push({
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
    store.chat_conversations!.push(
      { id: randomUUID(), userId: USER_B },
      { id: randomUUID(), userId: USER_A },
    )
    const sessionB = store.chat_conversations!.find((c) => c.userId === USER_B)!.id
    const sessionA = store.chat_conversations!.find((c) => c.userId === USER_A)!.id
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
      // G2 起任务必须带可执行载荷;缺省会去取会话最后一条 user 消息,空会话 ⇒ 400
      prompt: '整理本周发布记录',
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().data).toMatchObject({ status: 'queued' })
    expect(ok.json().data.task_id).toBeTruthy()
    // 别名路径同形
    const alias = await asUser('POST', `/api/chat/conversations/${sessionA}/delegate`, USER_A, {
      target_device_id: deviceId,
      prompt: '整理本周发布记录',
    })
    expect(alias.statusCode).toBe(200)
  })

  it('claim 原子性:两并发认领恰一个拿到任务', async () => {
    const { deviceToken, deviceId } = await pairNewDevice(USER_A)
    const session = randomUUID()
    store.chat_conversations!.push({ id: session, userId: USER_A })
    const delegated = await asUser('POST', `/api/chat/sessions/${session}/delegate`, USER_A, {
      target_device_id: deviceId,
      prompt: '整理本周发布记录',
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
    store.device_tasks!.push({
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
    store.chat_conversations!.push({ id: session, userId: USER_A })
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

/**
 * SDB-01:device_tokens.token 全局唯一(device-tokens.ts:53 / 0225_create_device_tokens.sql:23),
 * 注册接口若在冲突时无条件改 user_id,任何登录用户知道他人 FCM token 即可把该设备的
 * 推送改投到自己账号。判据:非本人 token 一律拒绝且原行不被写;本人重复注册保持幂等。
 */
describe('推送令牌归属锁(SDB-01)', () => {
  it('他人 token:409 拒绝,且原 owner 与元数据一个字都没被改', async () => {
    const createdAt = new Date(Date.now() - 3_600_000)
    const ownerRow = {
      id: randomUUID(),
      userId: USER_B,
      token: 'fcm-token-owned-by-b',
      platform: 'android',
      deviceType: 'Pixel-7',
      appVersion: '1.0.0',
      locale: 'zh-CN',
      isActive: true,
      lastUsedAt: new Date(Date.now() - 1_800_000),
      createdAt,
      updatedAt: createdAt,
    }
    store.device_tokens!.push(ownerRow)
    const snapshot = structuredClone(ownerRow)

    const res = await asUser('PUT', '/api/devices/token', USER_A, {
      token: ownerRow.token,
      platform: 'android',
      deviceType: 'HACKED',
      appVersion: '9.9.9',
      locale: 'en-US',
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().errorCode).toBe('DEVICE_TOKEN_OWNED_BY_OTHER')
    // 行数不变 + 整行快照不变 ⇒ 改 owner 的 upsert(以及任何元数据写入)都没有执行
    expect(store.device_tokens).toHaveLength(1)
    expect(store.device_tokens![0]).toEqual(snapshot)
  })

  it('本人 token:幂等成功,刷新元数据且不新增行', async () => {
    const old = new Date(Date.now() - 3_600_000)
    const selfRow = {
      id: randomUUID(),
      userId: USER_A,
      token: 'fcm-token-owned-by-a',
      platform: 'android',
      deviceType: 'old-device',
      appVersion: '1.0.0',
      locale: 'zh-CN',
      isActive: false,
      lastUsedAt: old,
      createdAt: old,
      updatedAt: old,
    }
    store.device_tokens!.push(selfRow)

    const res = await asUser('PUT', '/api/devices/token', USER_A, {
      token: selfRow.token,
      platform: 'ios',
      deviceType: 'iPhone15,2',
      appVersion: '2.0.0',
      locale: 'en-US',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { token: selfRow.token, platform: 'ios', registered: true },
    })
    expect(store.device_tokens).toHaveLength(1)
    expect(store.device_tokens![0]).toMatchObject({
      id: selfRow.id,
      userId: USER_A,
      platform: 'ios',
      deviceType: 'iPhone15,2',
      appVersion: '2.0.0',
      locale: 'en-US',
      isActive: true,
    })
    expect(new Date(store.device_tokens![0].lastUsedAt).getTime()).toBeGreaterThan(old.getTime())
    expect(new Date(store.device_tokens![0].updatedAt).getTime()).toBeGreaterThan(old.getTime())
  })

  it('新 token:正常注册一行并归属当前用户', async () => {
    const res = await asUser('PUT', '/api/devices/token', USER_A, {
      token: 'fcm-brand-new-token',
      platform: 'web',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ token: 'fcm-brand-new-token', platform: 'web', registered: true })
    expect(store.device_tokens).toHaveLength(1)
    expect(store.device_tokens![0]).toMatchObject({
      userId: USER_A,
      token: 'fcm-brand-new-token',
      platform: 'web',
      isActive: true,
    })
    expect(store.device_tokens![0].id).toBeTruthy()
  })

  it('拒绝响应不回显原 owner 的用户信息', async () => {
    const createdAt = new Date(Date.now() - 60_000)
    store.device_tokens!.push({
      id: randomUUID(),
      userId: USER_B,
      token: 'fcm-token-owner-secret',
      platform: 'ios',
      deviceType: 'iPhone15,2',
      appVersion: '1.0.0',
      locale: 'zh-CN',
      isActive: true,
      lastUsedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    })

    const res = await asUser('PUT', '/api/devices/token', USER_A, {
      token: 'fcm-token-owner-secret',
      platform: 'ios',
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().data).toBeUndefined()
    expect(res.body).not.toContain(USER_B)
    expect(res.body).not.toContain('iPhone15,2')
    expect(res.body).not.toContain('zh-CN')
  })
})

/**
 * G2 派单载荷与任务状态机(2026-11-26)。
 * 判据:派单必须带可执行指令(不许"空指令 + 另一端显示运行中");认领按先来后到;
 * 取消分"还没跑"与"正在跑"两态(后者不能抢状态,只落意图等执行端收口);
 * 重排只对失败/过期任务开放,且不能把上一轮已经给用户看过的输出抹掉。
 */
describe('G2 派单载荷与任务状态机', () => {
  /** 配一台新设备 + 一个空会话(设备名唯一,避免注册幂等复用同一台) */
  async function setupQueue() {
    const { deviceToken, deviceId } = await pairNewDevice(USER_A, `执行器-${randomUUID().slice(0, 6)}`)
    const session = randomUUID()
    store.chat_conversations!.push({ id: session, userId: USER_A })
    return { deviceToken, deviceId, session }
  }

  it('缺 prompt:空会话 400;有最后一条 user 消息则取它并登记 contextMessageId;显式 prompt 优先', async () => {
    const { deviceId, session } = await setupQueue()

    const empty = await asUser('POST', `/api/chat/sessions/${session}/delegate`, USER_A, {
      target_device_id: deviceId,
    })
    expect(empty.statusCode).toBe(400)
    expect(empty.json().errorCode).toBe('TASK_PROMPT_MISSING')

    const msgId = randomUUID()
    // 列名以 schema 为准:chat_messages 是 conversation_id(delegateTask 按它取"最后一条用户消息")
    store.chat_messages!.push({
      id: msgId,
      conversationId: session,
      role: 'user',
      content: '  把本周发布记录整理成一页  ',
      createdAt: new Date('2026-11-25T10:00:00Z'),
    })
    const ok = await asUser('POST', `/api/chat/sessions/${session}/delegate`, USER_A, {
      target_device_id: deviceId,
    })
    expect(ok.statusCode).toBe(200)
    const task = store.device_tasks!.find((t) => t.id === ok.json().data.task_id)!
    expect(task.payload.prompt).toBe('把本周发布记录整理成一页')
    expect(task.payload.contextMessageId).toBe(msgId)
    expect(task.payload.mode).toBe('execute')
    expect(task.payload.autoApprove).toBe(false)

    // 显式 prompt 优先:不再去取会话消息,也不挂 contextMessageId
    const explicit = await asUser('POST', `/api/chat/sessions/${session}/delegate`, USER_A, {
      target_device_id: deviceId,
      prompt: '  只跑 lint  ',
      mode: 'plan',
      auto_approve: true,
    })
    expect(explicit.statusCode).toBe(200)
    const t2 = store.device_tasks!.find((t) => t.id === explicit.json().data.task_id)!
    expect(t2.payload.prompt).toBe('只跑 lint')
    expect(t2.payload.mode).toBe('plan')
    expect(t2.payload.autoApprove).toBe(true)
    expect(t2.payload.contextMessageId).toBeUndefined()
  })

  it('认领按创建顺序(FIFO):先排的先发,认领过的不再重复发出,空了给 204', async () => {
    const { deviceToken, deviceId, session } = await setupQueue()
    for (const prompt of ['第一条', '第二条']) {
      const d = await asUser('POST', `/api/chat/sessions/${session}/delegate`, USER_A, {
        target_device_id: deviceId,
        prompt,
      })
      expect(d.statusCode).toBe(200)
    }

    const t1 = await asDevice('GET', '/api/devices/claim', deviceToken)
    expect(t1.statusCode).toBe(200)
    expect(t1.json().data.payload.prompt).toBe('第一条')
    const t2 = await asDevice('GET', '/api/devices/claim', deviceToken)
    expect(t2.statusCode).toBe(200)
    expect(t2.json().data.payload.prompt).toBe('第二条')
    // 两条都已被认领 ⇒ 没有可发的了(设备不能把同一条领两次)
    const t3 = await asDevice('GET', '/api/devices/claim', deviceToken)
    expect(t3.statusCode).toBe(204)
  })

  it('取消两态:queued 即时 failed(进度 cancelled);running 只写意图,lease 读回 cancel_requested', async () => {
    const { deviceToken, deviceId, session } = await setupQueue()

    // 还没被认领:直接收口,不必等设备心跳
    const queued = await asUser('POST', `/api/chat/sessions/${session}/delegate`, USER_A, {
      target_device_id: deviceId,
      prompt: '还没跑的任务',
    })
    const qid = queued.json().data.task_id as string
    const c1 = await asUser('POST', `/api/devices/tasks/${qid}/cancel`, USER_A)
    expect(c1.statusCode).toBe(200)
    expect(c1.json().data).toMatchObject({ cancelled: true, immediate: true, status: 'failed' })
    expect(store.device_tasks!.find((t) => t.id === qid)!.progress.stage).toBe('cancelled')

    // 正在跑:不能抢先把状态改成 failed(执行端可能正写到一半)
    const running = await asUser('POST', `/api/chat/sessions/${session}/delegate`, USER_A, {
      target_device_id: deviceId,
      prompt: '正在跑的任务',
    })
    const rid = running.json().data.task_id as string
    const claimed = await asDevice('GET', '/api/devices/claim', deviceToken)
    expect(claimed.json().data.id).toBe(rid)
    const c2 = await asUser('POST', `/api/devices/tasks/${rid}/cancel`, USER_A)
    expect(c2.statusCode).toBe(200)
    expect(c2.json().data.immediate).toBe(false)
    const rrow = store.device_tasks!.find((t) => t.id === rid)!
    expect(rrow.status).toBe('running')
    expect(rrow.cancelRequestedAt).toBeTruthy()
    const lease = await asDevice('POST', `/api/devices/tasks/${rid}/lease`, deviceToken, {})
    expect(lease.statusCode).toBe(200)
    expect(lease.json().data.cancel_requested).toBe(true)

    // 已结束的任务不能再取消
    const done = await asDevice('POST', `/api/devices/tasks/${rid}/complete`, deviceToken, {
      summary: { ok: 1 },
    })
    expect(done.statusCode).toBe(200)
    const c3 = await asUser('POST', `/api/devices/tasks/${rid}/cancel`, USER_A)
    expect(c3.statusCode).toBe(409)
  })

  it('重排:仅 failed/expired 可重排,attempt 递增且保留 payload;completed 409;非属主 403', async () => {
    const { deviceToken, deviceId, session } = await setupQueue()
    const d = await asUser('POST', `/api/chat/sessions/${session}/delegate`, USER_A, {
      target_device_id: deviceId,
      prompt: '会缺依赖的那次',
    })
    const id = d.json().data.task_id as string
    expect((await asDevice('GET', '/api/devices/claim', deviceToken)).json().data.id).toBe(id)
    const failed = await asDevice('POST', `/api/devices/tasks/${id}/fail`, deviceToken, {
      error: '缺依赖',
    })
    expect(failed.statusCode).toBe(200)

    const retry = await asUser('POST', `/api/devices/tasks/${id}/retry`, USER_A)
    expect(retry.statusCode).toBe(200)
    expect(retry.json().data).toMatchObject({ status: 'queued', attempt: 2 })
    const row = store.device_tasks!.find((t) => t.id === id)!
    expect(row.messageId ?? null).toBeNull()
    expect(row.error ?? null).toBeNull()
    // payload 不动:重排不是"重写指令",用户不用重新说一遍
    expect(row.payload.prompt).toBe('会缺依赖的那次')

    const foreign = await asUser('POST', `/api/devices/tasks/${id}/retry`, USER_B)
    expect(foreign.statusCode).toBe(403)

    expect((await asDevice('GET', '/api/devices/claim', deviceToken)).json().data.id).toBe(id)
    await asDevice('POST', `/api/devices/tasks/${id}/complete`, deviceToken, { summary: { ok: 1 } })
    const notRetryable = await asUser('POST', `/api/devices/tasks/${id}/retry`, USER_A)
    expect(notRetryable.statusCode).toBe(409)
    expect(notRetryable.json().errorCode).toBe('TASK_NOT_RETRYABLE')
  })
})

/**
 * G3 plan 档跨端审批(2026-11-26)。
 * 判据:执行端出完方案不能被当成"完成" —— 必须停在 awaiting_approval 等一个真人决定;
 * 决策只写一次;设备靠租约轮询读回决策;计划正文的唯一真相源是会话里那条消息。
 */
describe('G3 plan 档跨端审批', () => {
  /** 配对设备 → 建会话 → 派 plan 任务 → 认领(状态 running) */
  async function setupPlanTask() {
    const { deviceToken, deviceId } = await pairNewDevice(USER_A)
    const session = randomUUID()
    store.chat_conversations!.push({ id: session, userId: USER_A })
    const delegated = await asUser('POST', `/api/chat/sessions/${session}/delegate`, USER_A, {
      target_device_id: deviceId,
      prompt: '重构登录模块',
      mode: 'plan',
    })
    expect(delegated.statusCode).toBe(200)
    const claimed = await asDevice('GET', '/api/devices/claim', deviceToken)
    expect(claimed.statusCode).toBe(200)
    return { deviceToken, deviceId, session, taskId: claimed.json().data.id as string }
  }

  it('交方案 → 读正文 → 批准 → lease 读回 approved', async () => {
    const { deviceToken, deviceId, session, taskId } = await setupPlanTask()
    const msgId = randomUUID()
    store.chat_messages!.push({
      id: msgId,
      sessionId: session,
      role: 'assistant',
      content: '第一步:梳理现状\n第二步:改三处\n第三步:回归',
    })

    const asked = await asDevice('POST', `/api/devices/tasks/${taskId}/approval`, deviceToken, {
      preview: '第一步:梳理现状,第二步:改三处',
      message_id: msgId,
      iterations: 4,
    })
    expect(asked.statusCode).toBe(200)
    expect(asked.json().data.stage).toBe('awaiting_approval')

    // 正在等你批的那份不能被换掉
    const dup = await asDevice('POST', `/api/devices/tasks/${taskId}/approval`, deviceToken, {
      preview: '另一份方案',
    })
    expect(dup.statusCode).toBe(409)

    // 列表行:进度阶段可判、带摘要,但正文不在行里
    const list = await asUser('GET', `/api/devices/${deviceId}/tasks`, USER_A)
    const row = list.json().data.find((t: any) => t.id === taskId)
    expect(row.progress.stage).toBe('awaiting_approval')
    expect(row.approvalRequest.preview).toContain('梳理现状')
    // 列表行只有摘要:"第三步:回归"只存在于会话消息里的正文,行里不该出现
    expect(JSON.stringify(row)).not.toContain('第三步:回归')

    // 用户读正文:从会话消息现读,不在库里存副本
    const detail = await asUser('GET', `/api/devices/tasks/${taskId}/approval`, USER_A)
    expect(detail.statusCode).toBe(200)
    expect(detail.json().data.plan).toContain('第二步:改三处')
    expect(detail.json().data.decision).toBeNull()

    // 非属主不可读计划
    const foreign = await asUser('GET', `/api/devices/tasks/${taskId}/approval`, USER_B)
    expect(foreign.statusCode).toBe(403)

    const ok = await asUser('POST', `/api/devices/tasks/${taskId}/approval/decision`, USER_A, {
      decision: 'approved',
    })
    expect(ok.statusCode).toBe(200)
    // 决策只写一次:再批/改拒都是 409(执行端已经按第一次的决策在跑)
    const again = await asUser('POST', `/api/devices/tasks/${taskId}/approval/decision`, USER_A, {
      decision: 'rejected',
    })
    expect(again.statusCode).toBe(409)

    // 设备在租约轮询里读到决策,据此以 acceptEdits 继续
    const lease = await asDevice('POST', `/api/devices/tasks/${taskId}/lease`, deviceToken, {})
    expect(lease.statusCode).toBe(200)
    expect(lease.json().data.approval_decision).toBe('approved')

    // 批准后进度回到"继续执行",不再显示待审批(走列表行:该接口不依赖 select 投影,
    // 假库对 `select({ task: table })` 的嵌套形态没有投影能力)
    const after = await asUser('GET', `/api/devices/${deviceId}/tasks`, USER_A)
    const afterRow = after.json().data.find((t: any) => t.id === taskId)
    expect(afterRow.progress.stage).toBe('thinking')
  })

  it('拒绝:决策为 rejected,lease 读回后执行端收口', async () => {
    const { deviceToken, deviceId, session, taskId } = await setupPlanTask()
    store.chat_messages!.push({ id: randomUUID(), sessionId: session, content: '方案正文' })
    const asked = await asDevice('POST', `/api/devices/tasks/${taskId}/approval`, deviceToken, {
      preview: '方案正文',
    })
    expect(asked.statusCode).toBe(200)

    const rejected = await asUser(
      'POST',
      `/api/devices/tasks/${taskId}/approval/decision`,
      USER_A,
      { decision: 'rejected' },
    )
    expect(rejected.statusCode).toBe(200)

    const lease = await asDevice('POST', `/api/devices/tasks/${taskId}/lease`, deviceToken, {})
    expect(lease.json().data.approval_decision).toBe('rejected')
  })

  it('没计划就决策 409;没人批时 lease 返回 null(执行端继续等)', async () => {
    const { deviceToken, taskId } = await setupPlanTask()

    const lease = await asDevice('POST', `/api/devices/tasks/${taskId}/lease`, deviceToken, {})
    expect(lease.statusCode).toBe(200)
    expect(lease.json().data.approval_decision).toBeNull()

    const noPlan = await asUser('POST', `/api/devices/tasks/${taskId}/approval/decision`, USER_A, {
      decision: 'approved',
    })
    expect(noPlan.statusCode).toBe(409)
    expect(noPlan.json().errorCode).toBe('TASK_APPROVAL_NONE')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
