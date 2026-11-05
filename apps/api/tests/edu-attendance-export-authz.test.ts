// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B71 —— GET /attendance/export(考勤导出)权限成对用例 + 越权用例(2026-11-05 立,**全程不连库**)。
 *
 * 本票只做 export 这一条(台账逐字:归属成对用例已在 edu-attendance-parent-portal-authz.test.ts
 * 落地勿重复;其余无行为用例路由由后续票逐条登记,不得塞进本票)。
 * 现读核正:实现住在 `apps/api/src/routes/edu-ai-management.ts` 第 8c 段,注册前缀
 * `/api/edu-ai-management`;立票前全仓 grep,apps/api/tests 内无任何用例引用 `/attendance/export`
 * (admin-audit-log-validation 等件覆盖的是 audit-logs/export,与本端点无关)。
 *
 * 尺子(与同族 edu-attendance-*-authz 件同一形状):
 * 1. **结构锁**:处理器体内必须走 `requireEduView(request, reply)`(鉴权先于取数),不读 request.body;
 *    入参形状表直接 import 源实例 `attendanceExportQuerySchema`(§22c,不抄第二份取值表),
 *    钉住"键集里没有 studentId 位 ⇒ 无法自报学生维度圈定导出面"。
 * 2. **权限成对**:匿名 ⇒ 401 / 有凭据无 edu:view|edu:manage ⇒ 403 / edu:view ⇒ 200 出 CSV /
 *    管理员(roleId≥1)豁免腿 ⇒ 200 且不查 RBAC。
 * 3. **越权 = 未导出他人班级数据**:世界状态同时埋乙班行、超范围日期行、软删行,
 *    断言 CSV 数据行集合恰为甲班范围内那一条(逐字节比对由源出口 toCsvCell/toIsoCell 组成的期望行),
 *    且查询谓词字面量含甲班 uuid、不含乙班 uuid。
 * 4. **鉴权失败零副作用**:考勤表一次都没查(reads=0)、不产生附件头(无文件形态出口)、
 *    pino 流里不出现「考勤导出」debug 行(不落日志副作用)。
 *
 * 身份不走测试侧手写 `request.userId`:桩 `@ihui/auth.verifyAccessToken` + getUserStatus,
 * RBAC 只替掉 `checkAnyPermission` 这一格查询,其余 requireAnyPermission 链为真。
 * 测试隔离铁律(AGENTS §5):不连 PG 8810 / Redis 8811;REDIS_URL 指 6379(无监听 ⇒ 快速失败放行)。
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/** 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。每轮用例前清零。 */
const H = vi.hoisted(() => {
  // 测试侧"签名":FNV-1a 摘要,把凭据内容(header+payload)绑进签名段。
  const fnv1a = (s: string): string => {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }
  const testSecret = 'ihui-test-jwt-secret'

  /** 从 drizzle 条件对象里取出被绑定的字面值(列对象不是字面值,自然被跳过)。唯一实现。 */
  const literalsOf = (node: unknown, out: string[] = [], depth = 0): string[] => {
    if (node === null || node === undefined || depth > 24) return out
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      out.push(String(node))
      return out
    }
    if (Array.isArray(node)) {
      for (const child of node) literalsOf(child, out, depth + 1)
      return out
    }
    if (typeof node !== 'object') return out
    const rec = node as Record<string, unknown>
    for (const key of ['queryChunks', 'value', 'inlineParam', 'inlineParams', 'params']) {
      if (key in rec) literalsOf(rec[key], out, depth + 1)
    }
    return out
  }

  return {
    /** 世界状态:考勤行集(edu_attendance_record 的假库投影) */
    attendance: [] as Array<Record<string, unknown>>,
    /** RBAC 授权面:userId → 持有的权限点清单 */
    grants: [] as Array<{ userId: string; permissions: string[] }>,
    /** checkAnyPermission 的调用记账(正向/拒绝成对的直接证据面) */
    rbacCalls: [] as Array<{ userId: string; permissions: string[] }>,
    results: [] as unknown[],
    /** 该次 select 是否带投影(paginate 的 count 查询形态) */
    projections: [] as boolean[],
    wheres: [] as unknown[],
    reads: 0,
    writes: [] as string[],
    /** pino 定制流收到的行(「不落日志副作用」断言的可读面) */
    logLines: [] as string[],
    statusOverrides: new Map<string, number>(),
    testSecret,
    sigOf: (headerAndPayload: string) =>
      `${fnv1a(`${headerAndPayload}.${testSecret}`)}${fnv1a(`${headerAndPayload}.reverse`)}`,
    literalsOf,
  }
})

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/forbidden-in-mock-tests',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

/**
 * db 链式桩:paginate 的两条查询(count 投影 + 列表)都按 where 绑定字面值对世界状态求值。
 * 导出口径的假库语义:未软删 ∧ 谓词绑定该班 ∧ 日期落在谓词两端点之间。
 */
vi.mock('../src/db/index.js', () => {
  const CHAIN_METHODS = [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'groupBy',
    'having',
    'values',
    'set',
    'returning',
    'onConflictDoNothing',
    'onConflictDoUpdate',
  ] as const
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

  const rowsFor = (predicate: unknown): unknown[] => {
    const lits = H.literalsOf(predicate)
    const dates = lits.filter((l) => DATE_RE.test(l)).sort()
    const lo = dates[0] ?? null
    const hi = dates.length > 0 ? dates[dates.length - 1] : null
    return H.attendance.filter((r) => {
      if (r.deletedAt) return false
      if (!lits.includes(String(r.classId))) return false
      if (lo && hi) {
        const d = String(r.date)
        return d >= lo && d <= hi
      }
      return true
    })
  }

  const makeChain = (slot: number, projected: boolean) => {
    const step: Record<string, unknown> = {}
    for (const m of CHAIN_METHODS) {
      step[m] = vi.fn((arg?: unknown) => {
        if (m === 'where') {
          H.wheres[slot] = arg
          H.results[slot] = rowsFor(arg)
        }
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const rows = H.results[slot] ?? []
      // count 投影查询回 [{count:N}],列表查询回行集本体。
      const value = projected
        ? [{ count: Array.isArray(rows) ? rows.length : 0 }]
        : (rows as unknown[])
      return Promise.resolve(value).then(resolve, reject)
    }
    return step
  }

  const readChain = (projected: boolean) => {
    const slot = H.reads
    H.reads += 1
    H.projections[slot] = projected
    H.results[slot] = H.results[slot] ?? []
    return makeChain(slot, projected)
  }
  const writeChain = (kind: string) => {
    H.writes.push(kind)
    return makeChain(Number.MAX_SAFE_INTEGER, false)
  }

  return {
    db: {
      select: vi.fn((proj?: unknown) => readChain(proj !== undefined)),
      insert: vi.fn(() => writeChain('insert')),
      update: vi.fn(() => writeChain('update')),
      delete: vi.fn(() => writeChain('delete')),
      execute: vi.fn(() => {
        H.writes.push('execute')
        return Promise.resolve([])
      }),
      transaction: vi.fn(() => {
        H.writes.push('transaction')
        return Promise.resolve([])
      }),
    },
    dbRead: { select: vi.fn((proj?: unknown) => readChain(proj !== undefined)) },
    dbClient: {},
    dbWriter: { select: vi.fn((proj?: unknown) => readChain(proj !== undefined)) },
  }
})

vi.mock('../src/db/notification-queries.js', () => ({ createNotification: vi.fn() }))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  setFastify: vi.fn(),
  serializeErrorFields: vi.fn((m: unknown) => m),
}))
vi.mock('../src/services/wechat-subscribe-message.js', () => ({
  isSubscribeMessageConfigured: vi.fn(() => false),
  getWechatMiniOpenId: vi.fn(async () => null),
  buildFeeReminderData: vi.fn(() => ({})),
  sendSubscribeMessage: vi.fn(async () => ({ ok: false, errcode: 0 })),
}))

/** 承载层的验签步:只替掉「验签」这一件事,其余 authenticate 链是真的。 */
vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    verifyAccessToken: vi.fn(async (token: string) => {
      const reject = (): never => {
        throw Object.assign(new Error('JWS signature verification failed'), {
          code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
        })
      }
      const parts = String(token).split('.')
      if (parts.length !== 3) reject()
      if (parts[2] !== H.sigOf(`${parts[0]}.${parts[1]}`)) reject()
      const claims = safeJson(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'))
      if (!claims || typeof claims.userId !== 'string' || claims.userId === '') reject()
      return { phone: '', familyId: '', roleId: 0, ...claims }
    }),
  }
})

/** 承载层的账号状态查询步。 */
vi.mock('../src/db/usercenter-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    getUserStatus: vi.fn(async (id: string) => H.statusOverrides.get(id) ?? 1),
  }
})

/** RBAC 权限点查询步:判据语义(任一命中即放行)由世界状态授权表决定,并逐次记账。 */
vi.mock('../src/db/rbac-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    checkAnyPermission: vi.fn(async (userId: string, permissions: string[]) => {
      H.rbacCalls.push({ userId, permissions })
      const grant = H.grants.find((g) => g.userId === userId)
      return !!grant && permissions.some((p) => grant.permissions.includes(p))
    }),
  }
})

vi.mock('../src/services/edu-ledger.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, loadEnrollmentLedger: vi.fn(async () => null) }
})

function safeJson(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'
// 判据单一真相源(§22c):导出入参形状表与 CSV 单元格出口一律 import 源实例,测试不抄第二份。
import { attendanceExportQuerySchema } from '../src/routes/edu-ai-management-schemas-core.js'
import { toCsvCell, toIsoCell } from '../src/routes/edu-ai-management-attendance-helpers.js'

const PREFIX = '/api/edu-ai-management'
const ROUTE_FILE = new URL('../src/routes/edu-ai-management.ts', import.meta.url)

const TEACHER_VIEW = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' // 持 edu:view
const TEACHER_NONE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' // 什么权限点都没有
const ADMIN = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' // roleId=1 豁免腿
const CLASS_A = '11111111-1111-4111-8111-111111111111'
const CLASS_B = '22222222-2222-4222-8222-222222222222'
const ST_A1 = '33333333-3333-4333-8333-333333333333'
const ST_A2 = '44444444-4444-4444-8444-444444444444'
const ST_B1 = '55555555-5555-4555-8555-555555555555'
const ST_D1 = '66666666-6666-4666-8666-666666666666'

const RANGE = { startDate: '2026-11-01', endDate: '2026-11-10' }

function accessToken(userId: string, extraClaims: Record<string, unknown> = {}): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ userId, type: 'access', ...extraClaims })
  return `${head}.${body}.${H.sigOf(`${head}.${body}`)}`
}

function toHttpError(err: unknown): { statusCode: number; message: string } {
  if (err instanceof Error) {
    const statusCode =
      'statusCode' in err && typeof err.statusCode === 'number' ? err.statusCode : 500
    return { statusCode, message: err.message }
  }
  return { statusCode: 500, message: String(err) }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: 'debug', stream: { write: (line: string) => void H.logLines.push(line) } },
  })
  app.setErrorHandler((err: unknown, _request, reply) => {
    const { statusCode, message } = toHttpError(err)
    reply.status(statusCode).send({ code: statusCode, message })
  })
  await app.register(eduAiManagementRoutes, { prefix: PREFIX })
  await app.ready()
  return app
}

async function call(o: { as?: string; query?: Record<string, string> }): Promise<{
  statusCode: number
  text: string
  json: Record<string, unknown>
  headers: Record<string, string | string[] | undefined>
}> {
  const app = await buildApp()
  const headers: Record<string, string> = {}
  if (o.as) headers.authorization = `Bearer ${accessToken(o.as)}`
  const qs = o.query ? `?${new URLSearchParams(o.query).toString()}` : ''
  const res = await app.inject({ method: 'GET', url: `${PREFIX}/attendance/export${qs}`, headers })
  await app.close()
  let json: Record<string, unknown> = {}
  try {
    json = res.json() as Record<string, unknown>
  } catch {
    json = {}
  }
  return {
    statusCode: res.statusCode,
    text: res.body,
    json,
    headers: res.headers as Record<string, string | string[] | undefined>,
  }
}

/** 「考勤导出」debug 行(pino 会把 msg 原样序列化进 JSON 行)。 */
const exportLogLines = (): string[] => H.logLines.filter((l) => l.includes('考勤导出'))

const allLiterals = (): string[] =>
  H.wheres.filter((w) => w !== undefined).flatMap((w) => H.literalsOf(w))

const seedAttendance = (
  id: string,
  classId: string,
  studentId: string,
  date: string,
  extra: Record<string, unknown> = {},
): void => {
  H.attendance.push({
    id,
    classId,
    studentId,
    date,
    status: 'present',
    checkInTime: `${date}T01:00:00.000Z`,
    checkOutTime: null,
    checkInMethod: 'manual',
    remark: null,
    deletedAt: null,
    ...extra,
  })
}

beforeEach(() => {
  H.attendance.length = 0
  H.grants.length = 0
  H.rbacCalls.length = 0
  H.results.length = 0
  H.projections.length = 0
  H.wheres.length = 0
  H.reads = 0
  H.writes.length = 0
  H.logLines.length = 0
  H.statusOverrides.clear()
})

describe('结构锁:GET /attendance/export 鉴权先于取数,入参形状表无学生自报位', () => {
  it('处理器体内走 requireEduView(request, reply) 且不读 request.body', () => {
    const src = readFileSync(ROUTE_FILE, 'utf8').split('\n')
    const routeRe = /^\s*server\.(get|post|put|delete|patch)\('([^']+)'/
    const starts: Array<{ idx: number; method: string; path: string }> = []
    for (let i = 0; i < src.length; i += 1) {
      const m = routeRe.exec(src[i]!)
      if (m) starts.push({ idx: i, method: m[1]!.toUpperCase(), path: m[2]! })
    }
    const hit = starts.filter((s) => s.method === 'GET' && s.path === '/attendance/export')
    expect(hit, 'GET /attendance/export 路由注册必须恰命中 1 条').toHaveLength(1)
    const next = starts.find((s) => s.idx > hit[0]!.idx)
    const body = src.slice(hit[0]!.idx, next ? next.idx : src.length).join('\n')
    expect(body).toMatch(/requireEduView\(\s*request\s*,\s*reply\s*\)/)
    expect(body, '导出面不接受请求体入参').not.toMatch(/request\.body/)
  })

  it('入参形状表(源实例 import)只认 classId/startDate/endDate/format,无 studentId 位', () => {
    expect(Object.keys(attendanceExportQuerySchema.shape)).toEqual([
      'classId',
      'startDate',
      'endDate',
      'format',
    ])
  })
})

describe('权限成对:匿名 401 ↔ edu:view 200 ↔ 无权限点 403 ↔ 管理员豁免腿', () => {
  it('匿名 ⇒ 401;考勤表零读、无附件头、不落「考勤导出」日志(副作用未发生)', async () => {
    seedAttendance('a1', CLASS_A, ST_A1, '2026-11-05')
    const res = await call({ query: { classId: CLASS_A, ...RANGE } })
    expect(res.statusCode).toBe(401)
    expect(H.reads, '匿名必须在任何取数之前终止').toBe(0)
    expect(H.rbacCalls, '匿名不得触达 RBAC 之后的取数面').toEqual([])
    expect(res.headers['content-disposition'], '鉴权失败不得产生附件/文件形态出口').toBeUndefined()
    expect(exportLogLines(), '鉴权失败不落导出日志').toEqual([])
    expect(String(res.headers['content-type'] ?? '')).not.toMatch(/text\/csv/)
  })

  it('有凭据但未持 edu:view/edu:manage ⇒ 403;RBAC 被问过、考勤表零读、零附件零日志', async () => {
    seedAttendance('a1', CLASS_A, ST_A1, '2026-11-05')
    const res = await call({ as: TEACHER_NONE, query: { classId: CLASS_A, ...RANGE } })
    expect(res.statusCode).toBe(403)
    expect(res.json.message).toBe('权限不足')
    expect(H.rbacCalls).toHaveLength(1)
    expect(H.rbacCalls[0]!.userId).toBe(TEACHER_NONE)
    expect(H.rbacCalls[0]!.permissions).toEqual(['edu:view', 'edu:manage'])
    expect(H.reads, '权限不成立时不得查询任何考勤数据').toBe(0)
    expect(H.writes).toEqual([])
    expect(res.headers['content-disposition']).toBeUndefined()
    expect(exportLogLines(), '权限不足不得落导出日志').toEqual([])
    expect(res.text).not.toContain(ST_A1)
  })

  it('持 edu:view ⇒ 200 导出 CSV(正向对照,与上面 403 同世界状态)', async () => {
    H.grants.push({ userId: TEACHER_VIEW, permissions: ['edu:view'] })
    seedAttendance('a1', CLASS_A, ST_A1, '2026-11-05', { remark: '正常,含逗号"引号"' })
    const res = await call({ as: TEACHER_VIEW, query: { classId: CLASS_A, ...RANGE } })
    expect(res.statusCode).toBe(200)
    expect(String(res.headers['content-type'] ?? '')).toMatch(/^text\/csv/)
    expect(String(res.headers['content-disposition'] ?? '')).toContain(
      `attendance-${CLASS_A}-${RANGE.startDate}_${RANGE.endDate}.csv`,
    )
    expect(res.text.startsWith('\uFEFF')).toBe(true)
    const lines = res.text.replace(/^\uFEFF/, '').split('\r\n')
    const header = ['学生ID', '日期', '状态', '签到时间', '签退时间', '签到方式', '备注']
      .map(toCsvCell)
      .join(',')
    expect(lines[0]).toBe(header)
    const row = H.attendance[0]!
    const expectedLine = [
      row.studentId,
      row.date,
      row.status,
      toIsoCell(row.checkInTime),
      toIsoCell(row.checkOutTime),
      row.checkInMethod,
      row.remark ?? '',
    ]
      .map(toCsvCell)
      .join(',')
    expect(lines.slice(1).filter((l) => l.length > 0)).toEqual([expectedLine])
    expect(exportLogLines().length, '成功导出落一条 debug 日志').toBe(1)
    expect(H.writes, '导出是只读面,全程零写').toEqual([])
  })

  it('管理员(roleId≥1)豁免腿 ⇒ 200 且 RBAC 权限点一次都不查', async () => {
    seedAttendance('a1', CLASS_A, ST_A1, '2026-11-05')
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/attendance/export?${new URLSearchParams({ classId: CLASS_A, ...RANGE }).toString()}`,
      headers: { authorization: `Bearer ${accessToken(ADMIN, { roleId: 1 })}` },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(H.rbacCalls, '豁免腿不得再查权限点').toEqual([])
    expect(H.writes).toEqual([])
  })
})

describe('越权用例:未导出他人班级/超范围/已软删的数据', () => {
  it('甲班导出集合逐字节只含甲班范围内行;乙班、超范围、软删行全部缺席;谓词从不绑乙班', async () => {
    H.grants.push({ userId: TEACHER_VIEW, permissions: ['edu:manage'] })
    seedAttendance('a1', CLASS_A, ST_A1, '2026-11-05')
    seedAttendance('a-out', CLASS_A, ST_A2, '2026-11-20') // 甲班但超出日期窗
    seedAttendance('b1', CLASS_B, ST_B1, '2026-11-06') // 乙班但在窗内
    seedAttendance('d1', CLASS_A, ST_D1, '2026-11-07', { deletedAt: '2026-11-07T10:00:00.000Z' })

    const res = await call({ as: TEACHER_VIEW, query: { classId: CLASS_A, ...RANGE } })
    expect(res.statusCode).toBe(200)
    // 返回集合的班级归属比对:只可能是甲班窗内未删那一条。
    expect(res.text).toContain(ST_A1)
    expect(res.text, '不得导出他人班级数据').not.toContain(ST_B1)
    expect(res.text, '不得导出窗口外数据').not.toContain(ST_A2)
    expect(res.text, '不得导出已软删数据').not.toContain(ST_D1)
    const dataLines = res.text
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .slice(1)
      .filter((l) => l.length > 0)
    expect(dataLines).toHaveLength(1)
    expect(dataLines[0]!.startsWith(`${ST_A1},2026-11-05,`)).toBe(true)
    // 查询谓词层面同样只绑甲班。
    const lits = allLiterals()
    expect(lits).toContain(CLASS_A)
    expect(lits, '谓词不得扫归属外的班级').not.toContain(CLASS_B)
    expect(lits).toContain(RANGE.startDate)
    expect(lits).toContain(RANGE.endDate)
  })

  it('形状闸在取数之前:缺 endDate ⇒ 400,零读、零附件、零导出日志', async () => {
    H.grants.push({ userId: TEACHER_VIEW, permissions: ['edu:view'] })
    seedAttendance('a1', CLASS_A, ST_A1, '2026-11-05')
    const res = await call({
      as: TEACHER_VIEW,
      query: { classId: CLASS_A, startDate: RANGE.startDate },
    })
    expect(res.statusCode).toBe(400)
    expect(H.reads).toBe(0)
    expect(res.headers['content-disposition']).toBeUndefined()
    expect(exportLogLines()).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
