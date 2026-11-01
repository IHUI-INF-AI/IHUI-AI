// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `mcp-extended.ts` 的归属回归锁(2026-11-01 安全强化)。
 *
 * 缺陷形状(现读于该文件):
 *  · 11 条端点只 `await authenticate(request)`,**返回值整个文件一次都没用过**;
 *  · 数据混装在 `system_configs` 里按 `category='mcp_project' / 'mcp_integration'` 存,
 *    而四条 helper SQL **只按 category 过滤** ⇒ 任一登录用户可列/读/改/删他人的条目;
 *  · 最重的一格是 `configDelete`:它是裸 id(`WHERE "id"::text = ${id}`),**连 category 都不限**
 *    —— `system_configs` 是混装表,现读库里还有 `relay_commission`、`home_schema` 这类管理员
 *    配置行,所以任一登录用户拿到一枚 uuid 就能删不属于自己、甚至不属于 mcp 族的行。
 *
 * 这一档用**带语义的假库**跑,而不是只比 SQL 文本:假库真按 `updated_by` 过滤、真按 category
 * 拒绝,于是"越权 ⇒ 404 且副作用没发生"是按行为断言的(§5 越权用例必须断言副作用未发生)。
 * 生产库现读这两族 0 条 ⇒ 收权属不改变任何既有条目的可见性,这也是"当场能做"的依据。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const ROWS = new Map<
  string,
  {
    id: string
    key: string
    value: string
    type: string
    category: string
    updated_by: string | null
    created_at: string
    updated_at: string
  }
>()
const EXEC_LOG: Array<{ text: string; values: unknown[] }> = []

const TOKEN_SUBJECT = '11111111-1111-4111-8111-111111111111'
const OTHER_SUBJECT = '22222222-2222-4222-8222-222222222222'
const ADMIN_ROW = '33333333-3333-4333-8333-333333333333'
const OTHER_ROW = '44444444-4444-4444-8444-444444444444'
const MY_ROW = '55555555-5555-4555-8555-555555555555'

/**
 * drizzle 0.45 的 `sql` 模板 chunk 形状(现读 `_probe-sql-shape.mjs` 同形复现):
 *  **字面 SQL 是对象 `{ value: string[] }`,被绑定的值是裸字面量(string/number)**。
 * 按"对象带 .value 就是参数"去走必然把两边读反 —— 上一枚同族测试里那种写法要引以为戒。
 */
function collect(q: unknown): { text: string; values: unknown[] } {
  const text: string[] = []
  const values: unknown[] = []
  const walk = (chunks: unknown[]) => {
    for (const c of chunks) {
      if (c === null || c === undefined) continue
      if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') {
        values.push(c)
        text.push('?')
        continue
      }
      if (Array.isArray(c)) {
        walk(c)
        continue
      }
      const o = c as { value?: unknown; queryChunks?: unknown[] }
      if (Array.isArray(o.queryChunks)) {
        walk(o.queryChunks)
        continue
      }
      if (typeof o.value === 'string') text.push(o.value)
      else if (Array.isArray(o.value)) text.push(o.value.map((s) => String(s)).join(''))
      else values.push(o.value)
    }
  }
  const root = q as { queryChunks?: unknown[] }
  walk(Array.isArray(root?.queryChunks) ? root.queryChunks : [])
  return { text: text.join('').replace(/\s+/g, ' ').trim(), values }
}

function exec(q: unknown): Record<string, unknown>[] {
  const { text, values } = collect(q)
  EXEC_LOG.push({ text, values })
  const out = (r: (typeof ROWS extends Map<string, infer V> ? V : never) | undefined) =>
    r ? [{ id: r.id, value: r.value, created_at: r.created_at, updated_at: r.updated_at }] : []

  if (text.startsWith('SELECT count(')) {
    const [category, owner] = values as [string, string]
    const n = [...ROWS.values()].filter(
      (r) => r.category === category && r.updated_by === owner,
    ).length
    return [{ count: n }]
  }
  if (text.startsWith('SELECT id, value') && text.includes('WHERE "category" =')) {
    const [category, owner] = values as [string, string]
    return [...ROWS.values()]
      .filter((r) => r.category === category && r.updated_by === owner)
      .map((r) => ({
        id: r.id,
        value: r.value,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }))
  }
  if (text.startsWith('SELECT id, value') && text.includes('"id"::text =')) {
    const [id, owner] = values as [string, string]
    return out(ROWS.get(id) && ROWS.get(id)!.updated_by === owner ? ROWS.get(id) : undefined)
  }
  if (text.startsWith('INSERT INTO "system_configs"')) {
    const [id, , value, type, category, owner] = values as string[]
    const row = {
      id,
      key: id,
      value,
      type,
      category,
      updated_by: owner,
      created_at: '2026-11-01T00:00:00.000Z',
      updated_at: '2026-11-01T00:00:00.000Z',
    }
    ROWS.set(id, row)
    return [
      { id: row.id, value: row.value, created_at: row.created_at, updated_at: row.updated_at },
    ]
  }
  if (text.startsWith('SELECT value FROM "system_configs"')) {
    const [id, owner] = values as [string, string]
    const r = ROWS.get(id)
    return r && r.updated_by === owner ? [{ value: r.value }] : []
  }
  if (text.startsWith('UPDATE "system_configs"')) {
    const [value, id, owner] = values as [string, string, string]
    const r = ROWS.get(id)
    if (!r || r.updated_by !== owner) return []
    r.value = value
    r.updated_at = '2026-11-01T00:00:01.000Z'
    return [{ id: r.id, value: r.value, created_at: r.created_at, updated_at: r.updated_at }]
  }
  if (text.startsWith('DELETE FROM "system_configs"')) {
    const [id, owner, c0, c1] = values as [string, string, string, string]
    const r = ROWS.get(id)
    // 假库自己也只认"本族 + 本人"这一档:删不掉别人或别族的行
    if (!r || r.updated_by !== owner || (r.category !== c0 && r.category !== c1)) return []
    ROWS.delete(id)
    return [{ id }]
  }
  throw new Error(`假库没这条语句的语义(拒绝静默放行):${text.slice(0, 120)}`)
}

vi.mock('../src/db/index.js', () => ({ db: { execute: async (q: unknown) => exec(q) } }))

// 身份由生产同一条路给:`authenticate` 从令牌解出主体并写 request.userId。这里只替掉"验签"这一格,
// 主体语义与返回形态保持与生产一致(`plugins/auth.ts` 返回 JWTPayload,含 userId)。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { headers: Record<string, string>; userId?: string }) => {
    const header = request.headers.authorization ?? ''
    const m = /^Bearer tok-for-(.+)$/.exec(header)
    if (!m) {
      throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
    }
    const userId = m[1]!
    request.userId = userId
    return { userId, roleId: 0 }
  },
}))

let app: FastifyInstance

function seed() {
  ROWS.clear()
  EXEC_LOG.length = 0
  const base = {
    key: '',
    type: 'json',
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
  }
  ROWS.set(MY_ROW, {
    ...base,
    id: MY_ROW,
    key: MY_ROW,
    value: JSON.stringify({ name: '我的项目', endpoint: 'https://a' }),
    category: 'mcp_project',
    updated_by: TOKEN_SUBJECT,
  })
  ROWS.set(OTHER_ROW, {
    ...base,
    id: OTHER_ROW,
    key: OTHER_ROW,
    value: JSON.stringify({ name: '他人项目', endpoint: 'https://b' }),
    category: 'mcp_project',
    updated_by: OTHER_SUBJECT,
  })
  ROWS.set(ADMIN_ROW, {
    ...base,
    id: ADMIN_ROW,
    key: ADMIN_ROW,
    value: JSON.stringify({ rate: 1 }),
    category: 'relay_commission',
    updated_by: null,
  })
}

beforeAll(async () => {
  app = Fastify()
  const { mcpExtendedRoutes } = await import('../src/routes/mcp-extended.js')
  await app.register(mcpExtendedRoutes, { prefix: '/api' })
  await app.ready()
})

beforeEach(seed)

afterAll(async () => {
  await app.close()
})

const as = (userId: string) => ({ authorization: `Bearer tok-for-${userId}` })
const hits = (re: RegExp) => EXEC_LOG.filter((e) => re.test(e.text))

describe('mcp 项目/集成面:主体只住令牌,读写都带归属', () => {
  it('列表只返回本人的条目,SQL 必须带 updated_by 谓词', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/mcp/projects',
      headers: as(TOKEN_SUBJECT),
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data as { list: Array<{ id: string }>; total: number }
    expect(data.list.map((r) => r.id)).toEqual([MY_ROW])
    expect(data.total).toBe(1)
    expect(hits(/FROM "system_configs" WHERE "category"/).length).toBeGreaterThan(0)
    for (const e of hits(/FROM "system_configs"/)) expect(e.text).toContain('"updated_by" =')
  })

  it('读他人 id ⇒ 404,且绑定值确实是令牌主体(不是 body 自报)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/mcp/projects/${OTHER_ROW}`,
      headers: as(TOKEN_SUBJECT),
    })
    expect(res.statusCode).toBe(404)
    const sel = hits(/^SELECT id, value.*"id"::text/)
    expect(sel.length).toBe(1)
    expect(sel[0]!.values.slice(0, 2)).toEqual([OTHER_ROW, TOKEN_SUBJECT])
  })

  it('删他人 id ⇒ 404 且那一行还在(副作用未发生)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/mcp/projects/${OTHER_ROW}`,
      headers: as(TOKEN_SUBJECT),
    })
    expect(res.statusCode).toBe(404)
    expect(ROWS.has(OTHER_ROW)).toBe(true)
    const del = hits(/^DELETE FROM "system_configs"/)
    expect(del.length).toBe(1)
    expect(del[0]!.values[1]).toBe(TOKEN_SUBJECT)
  })

  it('跨面删除被堵:管理员配置行(relay_commission)不在本族 category 射程内,删不掉', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/mcp/projects/${ADMIN_ROW}`,
      headers: as(TOKEN_SUBJECT),
    })
    expect(res.statusCode).toBe(404)
    expect(ROWS.has(ADMIN_ROW)).toBe(true)
    const del = hits(/^DELETE FROM "system_configs"/)
    expect(del.length).toBe(1)
    // 这一条是本格的核心:此前裸 id 就能删掉不属于 mcp 族的配置行
    expect(del[0]!.text).toContain('"category" IN')
    expect(del[0]!.values.slice(2)).toEqual(['mcp_project', 'mcp_integration'])
  })

  it('创建给新条目盖上属主 = 令牌主体;body 里塞 userId 也不会被用', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/mcp/projects',
      headers: as(OTHER_SUBJECT),
      payload: { name: '新项目', userId: TOKEN_SUBJECT },
    })
    expect(res.statusCode).toBe(201)
    const ins = hits(/^INSERT INTO "system_configs"/)
    expect(ins.length).toBe(1)
    expect(ins[0]!.values[5]).toBe(OTHER_SUBJECT)
    const id = res.json().data.id as string
    expect(ROWS.get(id)?.updated_by).toBe(OTHER_SUBJECT)
    // value 里没被塞进别人的 userId(schema 是封闭字段集)
    expect(JSON.parse(ROWS.get(id)!.value)).not.toHaveProperty('userId')
  })

  it('正向对照:本人删自己的条目 ⇒ 200 且行真消失', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/mcp/projects/${MY_ROW}`,
      headers: as(TOKEN_SUBJECT),
    })
    expect(res.statusCode).toBe(200)
    expect(ROWS.has(MY_ROW)).toBe(false)
  })

  it('toggle 写侧同样带归属:他人条目改不动', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/mcp/integrations/${OTHER_ROW}/toggle`,
      headers: as(TOKEN_SUBJECT),
    })
    expect(res.statusCode).toBe(404)
    expect(ROWS.get(OTHER_ROW)!.value).toContain('他人项目')
    expect(hits(/^UPDATE "system_configs"/).length).toBe(0)
  })

  it('接线锁:11 条碰库的端点都必须用起来 authenticate 的返回值', async () => {
    const { readFile } = await import('node:fs/promises')
    const src = await readFile(new URL('../src/routes/mcp-extended.ts', import.meta.url), 'utf8')
    const bare = src.split('\n').filter((l) => /^\s*await authenticate\(request\)$/.test(l)).length
    // 只剩两条纯代理腿(reload / clear-auth)没有归属语义可接
    expect(bare).toBe(2)
    expect((src.match(/const \{ userId \} = await authenticate\(request\)/g) || []).length).toBe(11)
    expect(src).not.toMatch(/DELETE FROM "system_configs" WHERE "id"::text = \$\{id\} RETURNING/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
