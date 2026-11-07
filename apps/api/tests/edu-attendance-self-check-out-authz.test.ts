// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B72① —— POST /attendance/self-check-out(学生本人签退)权限成对用例 + 越权用例
 * (2026-11-06 立,**全程不连库**:PG 8810 / Redis 8811 一条都不碰,DATABASE_URL 只是
 *  无人监听的哨兵字面量;AGENTS §5 测试隔离铁律)。
 *
 * 立因(现读):全仓此前只有教师侧 `PUT /attendance/check-out`(requireEduManage),学生本人
 * 签退无处可落 —— 三端「我的考勤」只进不出,而早退档(earlyBefore)只在教师代签那一条路径上
 * 写得进库。本端点补齐该格,本文件把它钉住四件事:
 *   1. **结构锁**(静态读路由源码):处理器体内必须接线 `checkAuthOrInternalService(request, reply)`
 *      且主体取 `request.userId`;`selfCheckOutSchema` 定义体内不得出现 studentId / classId /
 *      checkOutMethod / checkOutTime / status / operatedBy —— 客户端自报在源码结构上无路可达;
 *      helpers 侧必须问 `statusPreservedOnCheckOut` + `judgeStatus`(判据单源,§0.6),写面谓词
 *      必须再钉一次归属与"尚未签退",且不得出现第二把阈值尺。
 *   2. **身份纪律**(行为面):body 里硬塞 `studentId=乙 / classId=乙班 / checkOutMethod=manual
 *      / status=absent / checkOutTime=1970…` ⇒ 被 zod strip,更新的行仍是甲那一行,
 *      落库 set 里不含任何一个自报键,每个 where 谓词的绑定字面量含甲 uuid 而不含乙 uuid。
 *   3. **越权 ⇒ 副作用未发生**:匿名 401 ⇒ 零读零写;他人(乙)的行集在甲的整轮操作前后
 *      **逐字节**不变;404(无签到行)/ 409(已签退)两条拒绝分支都不得新增或改写任何行。
 *   4. **幂等 = CAS 而不是"读了再写"**:第二次签退回 409,且首笔的 checkOutTime 未被覆盖
 *      (UPDATE 谓词带 isNull(checkOutTime),`.returning()` 空集即判落空,门 134 计数诚实性同律)。
 *
 * 身份不走测试侧手写 `request.userId`(那等于绕过承载层自证):桩 `@ihui/auth.verifyAccessToken`
 * + `db/usercenter-queries.getUserStatus`,凭据以真三段式 JWS 形态经 Authorization: Bearer 传入,
 * 其余鉴权链(checkAuth → authenticate)为真。形状抄 tests/edu-attendance-qrcode-authz.test.ts。
 *
 * 时钟:全部用例在冻结时刻 2026-11-06T01:30:00Z(上海 09:30)下跑 —— bizDayKey 缺省日与
 * judgeStatus 的早退维因此可判;早退阈值取 '23:59',而该时刻在任何合法时区偏移(15 分钟粒度)
 * 下都不落在 23:59 那一分钟内,故此档与跑机器的时区无关。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'

/** 冻结时刻:上海业务日 2026-11-06(见头注「时钟」段) */
const FROZEN_UTC = '2026-11-06T01:30:00.000Z'
const FROZEN_DAY = '2026-11-06'
/** 早退阈值:任何时区下 01:30Z 对应的本地 HH:MM 都早于它 ⇒ early 恒可判 */
const EARLY_BEFORE = '23:59'

/** 假库谓词求值的一条绑定项:列对象 + 数据库列名(snake_case) + 绑定字面值(或哨兵) */
type PredicateEntry = { table: unknown; col: string; val: string }

/** 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。每轮用例前清零。 */
const H = vi.hoisted(() => {
  const fnv1a = (s: string): string => {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i)
      h = Math.imul(0x01000193, h) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }
  const testSecret = 'ihui-test-jwt-secret'
  // 两个哨兵用可见字符串:断言失败时能直接读出是哪一格没绑上(不是隐式 NUL 那种静默形态)
  const PENDING = '@@PENDING@@'
  const NULL_MARK = '@@IS_NULL@@'

  /**
   * drizzle 条件对象 → 「列 → 绑定字面值」有序表(假库解答器唯一实现,不是生产判据副本)。
   * 现读形态(drizzle 0.38):列对象的 `name` 是 **snake_case 数据库列名**(不是 JS 属性名),
   * 参数是 `Param{value}`,裸 SQL 片段是 `StringChunk{value:string[]}` —— isNull 的 ' is null'
   * 就藏在 StringChunk 里。三者按遍历顺序配对,故"换班/换人"这类谓词写错会被判成查不到,
   * 而不是静默命中。JS 属性名由 mock 工厂里的 jsKeyOf 逐表现查列对象得到(不手抄第二份列清单)。
   */
  const bindLast = (out: PredicateEntry[], val: string): void => {
    for (let i = out.length - 1; i >= 0; i -= 1) {
      if (out[i]!.val === PENDING) {
        out[i]!.val = val
        break
      }
    }
  }
  const walk = (node: unknown, out: PredicateEntry[], depth: number): void => {
    if (node === null || node === undefined || depth > 40) return
    if (typeof node === 'string') {
      if (/\bis\s+null\b/i.test(node)) bindLast(out, NULL_MARK)
      return
    }
    if (Array.isArray(node)) {
      for (const child of node) walk(child, out, depth + 1)
      return
    }
    if (typeof node !== 'object') return
    const rec = node as Record<string, unknown>
    if (typeof rec.name === 'string' && typeof rec.columnType === 'string') {
      out.push({ table: rec.table ?? null, col: rec.name, val: PENDING })
      return
    }
    if (rec.queryChunks !== undefined) {
      walk(rec.queryChunks, out, depth + 1)
      return
    }
    if (Array.isArray(rec.value)) {
      for (const s of rec.value) {
        if (typeof s === 'string' && /\bis\s+null\b/i.test(s)) bindLast(out, NULL_MARK)
      }
      return
    }
    const raw = rec.value ?? rec.inlineParam ?? rec.inlineParams ?? rec.params
    if (raw !== undefined && typeof raw !== 'object') bindLast(out, String(raw))
  }
  const predicateMapOf = (node: unknown): PredicateEntry[] => {
    const out: PredicateEntry[] = []
    walk(node, out, 0)
    return out
  }

  /** 绑定字面值池(归属判据的可读面)。 */
  const literalsOf = (map: PredicateEntry[]): string[] =>
    map.map((e) => e.val).filter((v) => v !== PENDING && v !== NULL_MARK)

  return {
    testSecret,
    sigOf: (headerAndPayload: string) =>
      `${fnv1a(`${headerAndPayload}.${testSecret}`)}${fnv1a(`${headerAndPayload}.reverse`)}`,
    predicateMapOf,
    literalsOf,
    PENDING,
    NULL_MARK,
    statusOverrides: new Map<string, number>(),
    /** 世界状态 = 本链路真正读写的三张表(按 getTableName 分桶,行内键用 JS 属性名) */
    world: {
      edu_attendance_record: [] as Array<Record<string, unknown>>,
      edu_enrollment: [] as Array<Record<string, unknown>>,
      edu_attendance_rule: [] as Array<Record<string, unknown>>,
    },
    reads: 0,
    wheres: [] as PredicateEntry[][],
    writes: [] as string[],
    updateSets: [] as Array<Record<string, unknown>>,
    insertValues: [] as Array<Record<string, unknown>>,
    seq: 0,
  }
})

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://127.0.0.1:5399/forbidden-in-mock-tests',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

/**
 * 假数据库:按 getTableName 认表、按谓词求值;select 回真命中行,update 真改世界状态并
 * 只回"实际被改写的那几行"(returning 语义)。写侧每一笔都记账 ⇒「副作用未发生」是可证的。
 * 本文件不建任何真连接,也不复制任何生产判据(判据一律 import 生产出口)。
 */
vi.mock('../src/db/index.js', async () => {
  const { getTableName } = await import('drizzle-orm')
  type TableName = keyof typeof H.world
  const READ_METHODS = ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'having'] as const

  /** 数据库列名 → 世界状态里的 JS 属性名:逐表现查表对象的列属性名,不抄第二份列清单。 */
  const aliasCache = new Map<string, string>()
  const jsKeyOf = (table: unknown, dbCol: string): string => {
    const tableName = (() => {
      try {
        return table ? getTableName(table as never) : '?'
      } catch {
        return '?'
      }
    })()
    const cacheKey = `${tableName}|${dbCol}`
    const hit = aliasCache.get(cacheKey)
    if (hit) return hit
    let js = dbCol
    if (table && typeof table === 'object') {
      for (const k of Object.keys(table as Record<string, unknown>)) {
        const col = (table as Record<string, unknown>)[k] as { name?: string; columnType?: string }
        if (col && typeof col === 'object' && col.columnType && col.name === dbCol) {
          js = k
          break
        }
      }
    }
    aliasCache.set(cacheKey, js)
    return js
  }

  const rowsOf = (table: TableName): Array<Record<string, unknown>> => H.world[table] ?? []

  const matches = (row: Record<string, unknown>, map: PredicateEntry[]): boolean =>
    map.every((entry) => {
      const key = jsKeyOf(entry.table, entry.col)
      if (entry.val === H.PENDING) return true
      if (entry.val === H.NULL_MARK) return row[key] === null || row[key] === undefined
      const cell = row[key]
      if (cell instanceof Date) return cell.toISOString() === entry.val
      return String(cell ?? '') === entry.val
    })

  const makeSelect = () => {
    const slot = H.reads
    H.reads += 1
    H.wheres[slot] = []
    let table: TableName | null = null
    let rows: Array<Record<string, unknown>> = []
    const step: Record<string, unknown> = {}
    for (const m of READ_METHODS) {
      step[m] = vi.fn((arg?: unknown) => {
        if (m === 'from') table = getTableName(arg as never) as TableName
        if (m === 'where') {
          const map = H.predicateMapOf(arg)
          H.wheres[slot] = map
          rows = table ? rowsOf(table).filter((r) => matches(r, map)) : []
        }
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows.map((r) => ({ ...r }))).then(resolve, reject)
    return step
  }

  const makeUpdate = () => {
    H.writes.push('update')
    let table: TableName | null = null
    let setObj: Record<string, unknown> = {}
    let map: PredicateEntry[] = []
    let returning = false
    const step: Record<string, unknown> = {}
    const setTable = (t: unknown): Record<string, unknown> => {
      table = getTableName(t as never) as TableName
      return step
    }
    for (const m of ['set', 'where', 'returning'] as const) {
      step[m] = vi.fn((arg?: unknown) => {
        if (m === 'set') {
          setObj = (arg ?? {}) as Record<string, unknown>
          H.updateSets.push(setObj)
        }
        if (m === 'where') map = H.predicateMapOf(arg)
        if (m === 'returning') returning = true
        return step
      })
    }
    step.table = setTable
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const hit: Array<Record<string, unknown>> = []
      if (table) {
        for (const row of rowsOf(table)) {
          if (!matches(row, map)) continue
          Object.assign(row, setObj)
          hit.push({ ...row })
        }
      }
      return Promise.resolve(returning ? hit : []).then(resolve, reject)
    }
    return { step, setTable }
  }

  const makeInsert = () => {
    H.writes.push('insert')
    let table: TableName | null = null
    let values: Array<Record<string, unknown>> = []
    let returning = false
    const step: Record<string, unknown> = {}
    const setTable = (t: unknown): Record<string, unknown> => {
      table = getTableName(t as never) as TableName
      return step
    }
    step.values = vi.fn((v: unknown) => {
      values = (Array.isArray(v) ? v : [v]) as Array<Record<string, unknown>>
      for (const r of values) H.insertValues.push(r)
      return step
    })
    for (const m of ['returning', 'onConflictDoNothing', 'onConflictDoUpdate'] as const) {
      step[m] = vi.fn(() => {
        if (m === 'returning') returning = true
        return step
      })
    }
    step.table = setTable
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const applied: Array<Record<string, unknown>> = []
      if (table) {
        for (const v of values) {
          H.seq += 1
          const row = { id: `row-${H.seq}`, ...v }
          rowsOf(table).push(row)
          applied.push(row)
        }
      }
      return Promise.resolve(returning ? applied : []).then(resolve, reject)
    }
    return { step, setTable }
  }

  const dbMock = {
    select: vi.fn(() => makeSelect()),
    update: vi.fn((t: unknown) => makeUpdate().setTable(t)),
    insert: vi.fn((t: unknown) => makeInsert().setTable(t)),
    delete: vi.fn(() => {
      H.writes.push('delete')
      return makeSelect()
    }),
    execute: vi.fn(() => {
      H.writes.push('execute')
      return Promise.resolve([])
    }),
    transaction: vi.fn((fn: (tx: unknown) => unknown) => {
      H.writes.push('transaction')
      return fn(dbMock)
    }),
  }
  return {
    db: dbMock,
    dbRead: { select: vi.fn(() => makeSelect()) },
    dbWriter: { select: vi.fn(() => makeSelect()) },
    dbClient: {},
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

/** 承载层验签桩:只替"验签"这一步,其余 authenticate 链是真身 ⇒ 身份只能由承载层注入。 */
vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    verifyAccessToken: vi.fn(async (token: string) => {
      const reject = (): never => {
        throw Object.assign(new Error('JWS signature verification failed'), {
          code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
          statusCode: 401,
        })
      }
      const parts = String(token).split('.')
      if (parts.length !== 3) reject()
      if (parts[2] !== H.sigOf(`${parts[0]}.${parts[1]}`)) reject()
      let claims: Record<string, unknown> | null = null
      try {
        claims = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8')) as Record<
          string,
          unknown
        >
      } catch {
        reject()
      }
      if (!claims || typeof claims.userId !== 'string' || claims.userId === '') reject()
      return { phone: '', familyId: '', roleId: 0, ...claims }
    }),
  }
})

vi.mock('../src/db/usercenter-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    getUserStatus: vi.fn(async (id: string) => H.statusOverrides.get(id) ?? 1),
  }
})

import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'
// §22c 判据零复制:早退这一档由生产 judgeStatus 现算,测试只问它、不抄它。
import { judgeStatus } from '../src/services/edu-attendance-rule.js'

const PREFIX = '/api/edu-ai-management'
const ROUTE = '/attendance/self-check-out'
const ROUTES_SOURCE = readFileSync(
  fileURLToPath(new URL('../src/routes/edu-ai-management.ts', import.meta.url)),
  'utf8',
)
const HELPERS_SOURCE = readFileSync(
  fileURLToPath(new URL('../src/routes/edu-ai-management-attendance-helpers.ts', import.meta.url)),
  'utf8',
)

const STUDENT_A = 'aaaaaaaa-4111-8111-8111-111111111111'
const STUDENT_B = 'bbbbbbbb-4222-8222-8222-222222222222'
const CLASS_A = 'cccccccc-4333-8333-8333-333333333333'
const CLASS_B = 'dddddddd-4444-8444-8444-444444444444'

function accessToken(userId: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ userId, type: 'access' })
  return `${head}.${body}.${H.sigOf(`${head}.${body}`)}`
}

let appPromise: Promise<FastifyInstance> | null = null
async function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    const app = Fastify({ logger: false })
    app.setErrorHandler((err: FastifyError, _request, reply) => {
      const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    await app.register(eduAiManagementRoutes, { prefix: PREFIX })
    await app.ready()
    appPromise = Promise.resolve(app)
  }
  return appPromise
}

interface Call {
  as?: string
  body?: Record<string, unknown>
}

async function call(
  o: Call,
): Promise<{ statusCode: number; body: Record<string, unknown>; raw: string }> {
  const app = await getApp()
  const headers: Record<string, string> = {}
  if (o.as) headers.authorization = `Bearer ${accessToken(o.as)}`
  const res = await app.inject({
    method: 'POST',
    url: `${PREFIX}${ROUTE}`,
    headers,
    payload: o.body ?? {},
  })
  let body: Record<string, unknown> = {}
  try {
    body = res.json() as Record<string, unknown>
  } catch {
    body = {}
  }
  return { statusCode: res.statusCode, body, raw: res.body }
}

/** 世界状态里的考勤行(按学生分桶后逐字节快照 —— 「副作用未发生」的比对面)。 */
const rowsOfStudent = (studentId: string): Array<Record<string, unknown>> =>
  H.world.edu_attendance_record.filter((r) => r.studentId === studentId)
const snapshotOf = (studentId: string): string => JSON.stringify(rowsOfStudent(studentId))

function seedRecord(row: {
  studentId: string
  classId: string
  date: string
  status?: string
  checkInTime?: Date | null
  checkOutTime?: Date | null
  checkInMethod?: string
  operatedBy?: string | null
  deletedAt?: Date | null
  remark?: string | null
}): Record<string, unknown> {
  H.seq += 1
  const record: Record<string, unknown> = {
    id: `att-${H.seq}`,
    studentId: row.studentId,
    classId: row.classId,
    date: row.date,
    checkInTime:
      row.checkInTime === undefined ? new Date(`${row.date}T00:30:00.000Z`) : row.checkInTime,
    checkOutTime: row.checkOutTime === undefined ? null : row.checkOutTime,
    status: row.status ?? 'present',
    checkInMethod: row.checkInMethod ?? 'manual',
    checkOutMethod: null,
    // 签到侧留痕:缺省记为本人(自签形态);教师代签的行在越权用例里由 operatedBy 显式给
    operatedBy: row.operatedBy === undefined ? row.studentId : row.operatedBy,
    deletedAt: row.deletedAt === undefined ? null : row.deletedAt,
    remark: row.remark ?? null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  }
  H.world.edu_attendance_record.push(record)
  return record
}

function seedEnrollment(row: { studentId: string; classId: string; status?: string }): void {
  H.seq += 1
  H.world.edu_enrollment.push({
    id: `enr-${H.seq}`,
    studentId: row.studentId,
    classId: row.classId,
    status: row.status ?? 'enrolled',
    deletedAt: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
  })
}

function seedRule(row: { classId: string; earlyBefore?: string | null }): void {
  H.seq += 1
  H.world.edu_attendance_rule.push({
    id: `rule-${H.seq}`,
    classId: row.classId,
    lateAfter: null,
    earlyBefore: row.earlyBefore === undefined ? EARLY_BEFORE : row.earlyBefore,
    absentAfter: null,
    enabled: true,
    qrSecret: null,
    deletedAt: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  })
}

/** 取路由文件里某条处理器注册到下一条注册之间的源码切片(结构锁唯一读法)。 */
function handlerSlice(routeDecl: string): string {
  const start = ROUTES_SOURCE.indexOf(routeDecl)
  expect(start, `源码里必须能定位 ${routeDecl}`).toBeGreaterThan(-1)
  const bounds = [
    ROUTES_SOURCE.indexOf("server.post('/attendance/", start + routeDecl.length),
    ROUTES_SOURCE.indexOf("server.get('/attendance/", start + routeDecl.length),
    ROUTES_SOURCE.indexOf("server.put('/attendance/", start + routeDecl.length),
    ROUTES_SOURCE.indexOf("server.delete('/attendance/", start + routeDecl.length),
  ].filter((i) => i > -1)
  const end = bounds.length > 0 ? Math.min(...bounds) : ROUTES_SOURCE.length
  return ROUTES_SOURCE.slice(start, end)
}

/** 函数切片的唯一取法(结构锁读 helpers 用)。 */
function fnSlice(source: string, decl: string): string {
  const start = source.indexOf(decl)
  expect(start, `源码里必须能定位 ${decl}`).toBeGreaterThan(-1)
  const end = source.indexOf('\n}\n', start)
  expect(end, `${decl} 的函数体必须能收口`).toBeGreaterThan(-1)
  return source.slice(start, end + 3)
}

beforeEach(() => {
  H.statusOverrides.clear()
  H.world.edu_attendance_record.length = 0
  H.world.edu_enrollment.length = 0
  H.world.edu_attendance_rule.length = 0
  H.reads = 0
  H.wheres.length = 0
  H.writes.length = 0
  H.updateSets.length = 0
  H.insertValues.length = 0
  H.seq = 0
  vi.useFakeTimers({ now: new Date(FROZEN_UTC), toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('结构锁:B72① 的主体只由承载层显式传入,判据只问单源', () => {
  it('路由注册恰一条,处理器体内接 checkAuthOrInternalService 且主体取 request.userId', () => {
    const decl = `server.post('${ROUTE}'`
    const first = ROUTES_SOURCE.indexOf(decl)
    const second = ROUTES_SOURCE.indexOf(decl, first + 1)
    expect(first, '路由必须已注册').toBeGreaterThan(-1)
    expect(second, '同一端点不得注册两条').toBe(-1)
    const body = handlerSlice(decl)
    expect(body).toMatch(/checkAuthOrInternalService\(\s*request\s*,\s*reply\s*\)/)
    expect(body).toMatch(/request\.userId/)
    // 学生签退不是教务管理动作:不得被教师侧权限守卫拦在外面(那正是自签页不可达的同型病)
    expect(body, '学生本人端点不得要求 edu:manage').not.toMatch(/await requireEduManage/)
    expect(body, '主体走登录态、班级走服务端现取,两者都不由客户端给').toMatch(
      /resolveSelfCheckInClassId\(\s*userId\s*,\s*date\s*\)/,
    )
  })

  it('selfCheckOutSchema 体内不含 studentId/classId/checkOutMethod/checkOutTime/status/operatedBy/remark', () => {
    const start = ROUTES_SOURCE.indexOf('const selfCheckOutSchema = z.object({')
    expect(start, 'selfCheckOutSchema 必须存在').toBeGreaterThan(-1)
    const body = ROUTES_SOURCE.slice(start, ROUTES_SOURCE.indexOf('})', start) + 2)
    for (const forbidden of [
      'studentId',
      'classId',
      'checkOutMethod',
      'checkOutTime',
      'status',
      'operatedBy',
      'remark',
    ]) {
      expect(body, `入参不得留可自报键:${forbidden}`).not.toContain(forbidden)
    }
  })

  it('helpers 的 checkOutByStudent 只问单源判据,不内联阈值比较', () => {
    const body = fnSlice(HELPERS_SOURCE, 'export async function checkOutByStudent')
    expect(body).toMatch(/statusPreservedOnCheckOut\(/)
    expect(body).toMatch(/judgeStatus\(/)
    expect(body, '签退写面必须再钉一次"尚未签退"(CAS) ').toMatch(
      /isNull\(\s*eduAttendanceRecord\.checkOutTime\s*\)/,
    )
    expect(body, '签退写面必须再钉一次归属(防越权)').toMatch(
      /eq\(\s*eduAttendanceRecord\.studentId\s*,\s*studentId\s*\)/,
    )
    expect(body).toMatch(/\.returning\(\)/)
    // 阈值比较的算术只许住在 judgeStatus 里,本函数体内不得出现第二把尺
    expect(body, '判据零内联(§0.6)').not.toMatch(/getHours\(\)|hmOfLocalDate|<\s*threshold/)
  })
})

describe('成对正向:本人签退 ⇒ 200 且判据由 judgeStatus 现算;匿名 ⇒ 401 零读零写', () => {
  it('登录本人签退 ⇒ 落库 checkOutMethod=self、status 等于生产 judgeStatus 的结果', async () => {
    seedRule({ classId: CLASS_A })
    const rec = seedRecord({ studentId: STUDENT_A, classId: CLASS_A, date: FROZEN_DAY })
    const res = await call({ as: STUDENT_A, body: { date: FROZEN_DAY } })
    expect(res.statusCode, res.raw).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(data.classId).toBe(CLASS_A)
    expect(data.judgedBy).toBe('edu_attendance_rule.judgeStatus')
    expect(data.checkOutMethod).toBe('self')
    const checkOutTime = new Date(String((data.record as Record<string, unknown>).checkOutTime))
    expect(
      data.status,
      'status 必须等于 judgeStatus(单源)对同一对时刻的结论,而非端点内联或客户端自报',
    ).toBe(
      judgeStatus({
        lateAfter: null,
        earlyBefore: EARLY_BEFORE,
        checkInTime: rec.checkInTime as Date,
        checkOutTime,
      }),
    )
    expect(data.status).toBe('early')
    expect(H.updateSets).toHaveLength(1)
    expect(H.updateSets[0]!.checkOutMethod).toBe('self')
    expect(H.world.edu_attendance_record).toHaveLength(1)
    expect(rowsOfStudent(STUDENT_A)[0]!.checkOutTime).toBeInstanceOf(Date)
  })

  it('不传 date ⇒ 缺省走 bizDayKey 的上海业务日(不是 UTC 日)', async () => {
    seedEnrollment({ studentId: STUDENT_A, classId: CLASS_A })
    seedRecord({ studentId: STUDENT_A, classId: CLASS_A, date: FROZEN_DAY })
    const res = await call({ as: STUDENT_A, body: {} })
    expect(res.statusCode, res.raw).toBe(200)
    // 谓词里出现的日期字面量必须就是上海业务日;此刻的 UTC 日是 11-05,拿错即命中 0 行
    const dayLiterals = H.wheres.flatMap((m) => m.filter((e) => e.col === 'date').map((e) => e.val))
    expect(dayLiterals, '缺省日必须是上海业务日').toContain(FROZEN_DAY)
    expect(dayLiterals).not.toContain('2026-11-05')
  })

  it('匿名 POST ⇒ 401,且零读零写(副作用未发生)', async () => {
    seedRecord({ studentId: STUDENT_A, classId: CLASS_A, date: FROZEN_DAY })
    const before = JSON.stringify(H.world.edu_attendance_record)
    const res = await call({})
    expect(res.statusCode).toBe(401)
    expect(H.reads, '匿名必须在任何查询之前终止').toBe(0)
    expect(H.writes, '匿名不得有任何写副作用').toEqual([])
    expect(JSON.stringify(H.world.edu_attendance_record), '匿名不得改动任何行').toBe(before)
  })

  it('封禁主体(状态腿)⇒ 拒绝且零副作用', async () => {
    seedRecord({ studentId: STUDENT_A, classId: CLASS_A, date: FROZEN_DAY })
    H.statusOverrides.set(STUDENT_A, 0)
    const res = await call({ as: STUDENT_A, body: { date: FROZEN_DAY } })
    expect(res.statusCode).toBe(403)
    expect(H.writes, '账号被拒不得有任何写副作用').toEqual([])
    expect(snapshotOf(STUDENT_A), '被拒主体的行不得被签退').toContain('"checkOutTime":null')
  })
})

describe('越权用例:甲不得替乙签退,自报键一律进不了库', () => {
  it('body 硬塞 studentId=乙/classId=乙班/checkOutMethod/status/checkOutTime ⇒ 只改甲的行,乙逐字节未变', async () => {
    // 甲所在 A 班不配阈值 ⇒ judgeStatus 判成 present;写面若出现 'absent' 只可能来自客户端自报
    const myRow = seedRecord({
      studentId: STUDENT_A,
      classId: CLASS_A,
      date: FROZEN_DAY,
      remark: '教师代签时写的备注',
    })
    seedRecord({ studentId: STUDENT_A, classId: CLASS_B, date: FROZEN_DAY })
    const otherRow = seedRecord({
      studentId: STUDENT_B,
      classId: CLASS_B,
      date: FROZEN_DAY,
      operatedBy: STUDENT_A,
    })
    const beforeB = snapshotOf(STUDENT_B)
    const totalBefore = H.world.edu_attendance_record.length

    const res = await call({
      as: STUDENT_A,
      body: {
        date: FROZEN_DAY,
        studentId: STUDENT_B,
        classId: CLASS_B,
        checkOutMethod: 'manual',
        checkOutTime: '1970-01-01T00:00:00.000Z',
        status: 'absent',
        operatedBy: STUDENT_B,
        remark: '越权改写签到侧留痕',
      },
    })
    expect(res.statusCode, res.raw).toBe(200)
    const data = res.body.data as Record<string, unknown>
    // 生效班级 = 服务端现取(当日考勤行按序取第一条 ⇒ 甲在 A 班那一行),不是自报的 CLASS_B
    expect(data.classId).toBe(CLASS_A)
    // 客户端自报的"怎么签的 / 什么时候签的 / 判成什么"三样都没进库
    expect(H.updateSets).toHaveLength(1)
    const set = H.updateSets[0]!
    expect(set.checkOutMethod, '签退方式由服务端恒定为 self').toBe('self')
    expect(set.status, '自报 status 不得进写面:写进去的只能是服务端现算值').toBe('present')
    expect(set, '签退不改写 operatedBy(签到侧操作留痕)').not.toHaveProperty('operatedBy')
    expect(set, '签退不改写 remark(签到/审批侧已写的说辞)').not.toHaveProperty('remark')
    expect(myRow.remark, '本人行的 remark 必须原样留着(自签退不得覆盖他人写的备注)').toBe(
      '教师代签时写的备注',
    )
    expect(String(set.checkOutTime)).not.toBe('1970-01-01T00:00:00.000Z')
    // 乙(他人)那一行逐字节未变;全局行数不变(没有为乙补写任何行)
    expect(snapshotOf(STUDENT_B), '乙的考勤行必须逐字节未变').toBe(beforeB)
    expect(otherRow.checkOutTime, '他人行不得被签退').toBeNull()
    expect(H.world.edu_attendance_record).toHaveLength(totalBefore)
    expect(H.insertValues, '签退不新增任何行').toHaveLength(0)
    // 每个谓词的绑定字面量里都没有乙的 uuid:归属外的主体从未进入任何查询/写面
    const lits = H.wheres.flatMap((m) => H.literalsOf(m))
    expect(lits).toContain(STUDENT_A)
    expect(lits, '他人主体不得进入任何谓词').not.toContain(STUDENT_B)
  })

  it('当日无签到行 ⇒ 404 且一行都不补写(不凭"签退"这个动作凭空造在场记录)', async () => {
    seedEnrollment({ studentId: STUDENT_A, classId: CLASS_A })
    const before = JSON.stringify(H.world)
    const res = await call({ as: STUDENT_A, body: { date: FROZEN_DAY } })
    expect(res.statusCode, res.raw).toBe(404)
    expect(H.insertValues, '404 分支不得有任何 insert values 入参').toHaveLength(0)
    // 事务壳本身会开(读在事务里),诚实的判据是"没有任何写形":update / insert 恒零
    expect(
      H.writes.filter((w) => w === 'update' || w === 'insert'),
      '404 分支不得有任何写形(update/insert)',
    ).toEqual([])
    expect(JSON.stringify(H.world), '世界状态必须逐字节未变').toBe(before)
  })

  it('既无当日行又无在册 ⇒ 409 可读 reason,且零写', async () => {
    const res = await call({ as: STUDENT_A, body: { date: FROZEN_DAY } })
    expect(res.statusCode).toBe(409)
    expect(String(res.body.message)).toContain('未找到在读班级')
    expect(H.writes.filter((w) => w === 'update' || w === 'insert')).toEqual([])
    expect(H.world.edu_attendance_record).toHaveLength(0)
  })
})

describe('幂等与优先级:CAS 挡住第二笔,高优先态不被重判洗掉', () => {
  it('同一主体重复签退 ⇒ 第二次 409,首笔 checkOutTime 未被覆盖', async () => {
    seedRule({ classId: CLASS_A })
    seedRecord({ studentId: STUDENT_A, classId: CLASS_A, date: FROZEN_DAY })
    const first = await call({ as: STUDENT_A, body: { date: FROZEN_DAY } })
    expect(first.statusCode, first.raw).toBe(200)
    const firstRow = JSON.stringify(H.world.edu_attendance_record)

    // 再放一分钟:若第二笔真写了,checkOutTime 一定会变 —— 不变才是"没发生"的证据
    vi.setSystemTime(new Date('2026-11-06T01:31:00.000Z'))
    const second = await call({ as: STUDENT_A, body: { date: FROZEN_DAY } })
    expect(second.statusCode).toBe(409)
    expect(JSON.stringify(H.world.edu_attendance_record), '409 之后行集必须逐字节不变').toBe(
      firstRow,
    )
    expect(H.updateSets, '409 分支的第二笔不得再产生写面入参').toHaveLength(1)
  })

  it('leave / absent 是高优先态:签退只写时刻,不重判这两档', async () => {
    seedRule({ classId: CLASS_A })
    seedRecord({ studentId: STUDENT_A, classId: CLASS_A, date: FROZEN_DAY, status: 'leave' })
    const res = await call({ as: STUDENT_A, body: { date: FROZEN_DAY } })
    expect(res.statusCode, res.raw).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(data.status).toBe('leave')
    expect(H.updateSets[0]!.status, '重判不得把 leave 洗成 early').toBe('leave')
  })

  it('软删行不参与:当日只剩软删记录 ⇒ 班级由在册报名现取、签退回 404,且软删行逐字节未变', async () => {
    seedRule({ classId: CLASS_A })
    // 软删行既不构成"当日考勤行"(resolveSelfCheckInClassId 第一步被 isNull(deletedAt) 挡掉),
    // 也不得被写面命中 ⇒ 班级走第二条(在册报名),落库面回 404。
    seedEnrollment({ studentId: STUDENT_A, classId: CLASS_A })
    seedRecord({
      studentId: STUDENT_A,
      classId: CLASS_A,
      date: FROZEN_DAY,
      deletedAt: new Date('2026-11-05T00:00:00.000Z'),
    })
    const before = JSON.stringify(H.world.edu_attendance_record)
    const res = await call({ as: STUDENT_A, body: { date: FROZEN_DAY } })
    expect(res.statusCode, res.raw).toBe(404)
    expect(JSON.stringify(H.world.edu_attendance_record), '软删行不得被签退改写').toBe(before)
  })
})
// 注:本文件不注册 app 级插件、不连库;每条"未发生"都靠世界状态逐字节比对,而不是"没报错";
// 判据本身(judgeStatus / bizDayKey / statusPreservedOnCheckOut)一律 import 生产出口(§22c)。
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
