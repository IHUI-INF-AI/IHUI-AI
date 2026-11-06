// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B25 + B32:家长看孩子考勤的两枚登记形态 —— **绑定状态轴**(pending / rejected / 软删)契约锁
 * (2026-11-06 立,**全程不连库**,PG 8810 / Redis 8811 一条都不碰)。
 *
 * 实测形态(先把台账的三条口径归位,再补真缺的那格):
 *   · `/parent/child/:id/attendance` 与 `/parent/children/:childId/attendance` 是
 *     **两枚各自注册的独立处理器**(apps/api/src/routes/edu-ai-management.ts,内容锚点
 *     `server.get('/parent/child/:id/attendance'` 与
 *     `server.get('/parent/children/:childId/attendance'`),不是同一 handler 的两个别名;
 *     两枚的 `:id` 与 `:childId` 都当**学生 id** 用(各自 eq(...studentId, 路径参数)),
 *     并共用同一枚 `childAttendanceQuerySchema` 与同一条 confirmed 归属判据
 *     ⇒ 功能同题、路径两形(重复的 API 面,不是重复的台账行)。
 *   · 已经落地的行为面**不重复实现**:匿名 401 全表、未绑定 403(且零写、只查一次绑定表)、
 *     confirmed 200、返回形态 { list } 已由 tests/edu-attendance-parent-portal-authz.test.ts 钉住;
 *     status 枚举闸(400 点名 + 合法值真筛)已由 tests/edu-attendance-list-query.test.ts 钉住。
 *
 * 本票补的真缺(实测,不是推测):上述两件的世界状态里,绑定行**根本没有 status 维度**
 * (`H.bindings` 的行形是 {parentId, childId},见 edu-attendance-parent-portal-authz.test.ts 的
 * bind() 与 edu-attendance-list-query.test.ts 的 answerWith)⇒ 结构上无法表达
 * "绑定存在但状态是 pending / rejected / 已软删"这一输入。⇒ 这两件**结构上没有机会**判红"把
 * `eq(eduParentStudentBinding.status, 'confirmed')` 摘掉"这一型改动(判据面里根本不存在状态不符
 * 的绑定行);两件现跑实测 51 条全绿(2026-11-06 口径),绿的是它们已有的格,不是这一格。
 * —— "家长自报的绑定申请尚未通过就能看孩子考勤"这一格**此前零判定**(AGENTS §5 认证不等于授权:
 * 归属判据是 confirmed 绑定,不是"曾经申请过")。
 *
 * 判据零复制(§22c):状态词表**不从测试侧写死**——假库解答器的约束字面值由**路由自己下发的谓词**
 * 现取(谓词里既非 uuid、亦非日期、且不含空格的裸值字面值),行状态必须落在这束字面值里才算命中;
 * 谓词一旦丢掉状态条件,假库就把 pending / rejected 行如实交出 ⇒ 本文件的 403 断言必红。
 * 403 文案也不复制,现读响应体并与正向对照、另一枚路径同场逐字比对。
 *
 * 夹具形状抄同族既有件 tests/edu-attendance-parent-portal-authz.test.ts(config/db/logger/
 * auth/usercenter 桩基座);身份一律走真实鉴权链(桩只替"验签"这一步),不手写 request.userId。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'

/** 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它);每轮用例前清零。 */
const H = vi.hoisted(() => {
  const fnv1a = (s: string): string => {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }
  const testSecret = 'ihui-test-jwt-secret'

  /** drizzle 条件对象 → 被绑定的字面值(假库解答器唯一实现,§0.6 单源)。 */
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
    testSecret,
    sigOf: (headerAndPayload: string) =>
      `${fnv1a(`${headerAndPayload}.${testSecret}`)}${fnv1a(`${headerAndPayload}.reverse`)}`,
    literalsOf,
    /** 世界状态:家长-学生绑定行(**带 status 与 deletedAt**,这正是既有两件缺的那一维) */
    bindings: [] as Array<{
      id: string
      parentId: string
      studentId: string
      status: string
      deletedAt: string | null
    }>,
    /** 世界状态:考勤行 */
    attendance: [] as Array<Record<string, unknown>>,
    /** users.status 覆盖表(缺省 1=正常) */
    statusOverrides: new Map<string, number>(),
    reads: 0,
    wheres: [] as unknown[],
    results: [] as unknown[],
    /** 写侧调用记录 —— 403 用例必须断言它恒空(副作用没发生) */
    writes: [] as string[],
    /** 假库分类器认不出的谓词(§0.3:认不出就点名,不静默回空集冒充"库里没有") */
    unclassified: [] as string[],
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
 * 假数据库。表分类指纹(零状态常量、零词表复制):
 *   谓词里 **≥2 枚 uuid 字面值** ⇒ 绑定查询(这两枚端点的绑定谓词恒带 parentId + studentId 两枚,
 *   考勤谓词只带 studentId 一枚)。故意不用 'confirmed' 这个词来分类:否则"路由把状态条件整条
 *   摘掉"这一型变异会掉进别的分支、把该红的红变成绿;
 *   其余 ⇒ 考勤行查询(按 id / studentId 命中,日期与状态条件同样只在"谓词真带了"时才叠)。
 *   状态约束**由路由自己下发的谓词字面值现取**(谓词里非 uuid、非日期那束),测试侧零词表常量;
 *   谓词带状态 ⇒ 行状态必须相等,谓词不带状态 ⇒ 视为"路由未按状态筛",于是 pending 行会被如实
 *   交出、把 403 用例打红(变异自证)。
 */
vi.mock('../src/db/index.js', () => {
  const CHAIN_METHODS = [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'innerJoin',
    'leftJoin',
    'rightJoin',
    'crossJoin',
    'groupBy',
    'having',
    'forUpdate',
  ] as const
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  /**
   * 状态约束字面值 = 谓词里"既不是 uuid、也不是日期、且是裸值(不含空格/括号/等号)"的字面值。
   * 探针实测:drizzle 把 SQL 语法碎片(' = ' / ' and ' / ' is null' / '(' / ')')也作为字符串
   * 混进 queryChunks ⇒ 不筛掉就会把"确实存在的行"答成空集(假库自己先失准,§0.3 的反面)。
   * 约束仍由**路由自己下发的谓词**现取,测试侧零词表常量:谓词带了状态 ⇒ 行状态必须相等;谓词没带
   * 任何状态 ⇒ 视为"路由未按状态筛"(变异自证:摘掉 eq(status,'confirmed') 那一句 ⇒ pending /
   * rejected 行被如实交出 ⇒ 本文件的 403 断言必红)。
   */
  const bareValueRe = /^[0-9A-Za-z_-]{3,}$/

  function answerWith(predicate: unknown): Array<Record<string, unknown>> {
    const lits = H.literalsOf(predicate)
    const uuidLits = lits.filter((l) => UUID_RE.test(l))
    const constraintLits = lits.filter(
      (l) => !UUID_RE.test(l) && !DATE_RE.test(l) && bareValueRe.test(l),
    )
    if (uuidLits.length >= 2) {
      return H.bindings
        .filter(
          (b) =>
            b.deletedAt === null &&
            lits.includes(b.parentId) &&
            lits.includes(b.studentId) &&
            (constraintLits.length === 0 || constraintLits.includes(b.status)),
        )
        .map((b) => ({ ...b }))
    }
    if (uuidLits.length === 0 && !lits.some((l) => DATE_RE.test(l))) {
      H.unclassified.push(lits.join(','))
      return []
    }
    const dateLits = lits.filter((l) => DATE_RE.test(l)).sort()
    return H.attendance.filter((a) => {
      const mine =
        uuidLits.length === 0 ||
        uuidLits.includes(String(a.id)) ||
        uuidLits.includes(String(a.studentId))
      if (!mine) return false
      if (a.deletedAt !== null) return false
      // eq(单枚)按等值;between(≥2 枚)按闭区间。单边 gte/lte 形态本文件不测(注明局限,不装全)。
      if (dateLits.length === 1 && dateLits[0] !== String(a.date)) return false
      if (
        dateLits.length >= 2 &&
        (String(a.date) < dateLits[0]! || String(a.date) > dateLits[dateLits.length - 1]!)
      )
        return false
      if (constraintLits.length > 0 && !constraintLits.includes(String(a.status))) return false
      return true
    })
  }

  const readChain = () => {
    const slot = H.reads
    H.reads += 1
    H.wheres[slot] = undefined
    H.results[slot] = []
    const step: Record<string, unknown> = {}
    for (const m of CHAIN_METHODS) {
      step[m] = vi.fn((arg?: unknown) => {
        if (m === 'where') {
          H.wheres[slot] = arg
          H.results[slot] = answerWith(arg)
        }
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(H.results[slot] ?? []).then(resolve, reject)
    return step
  }

  const writeChain = (kind: string) => {
    H.writes.push(kind)
    const step: Record<string, unknown> = {}
    step.values = vi.fn(() => step)
    step.set = vi.fn(() => step)
    step.where = vi.fn(() => step)
    step.returning = vi.fn(() => Promise.resolve([]))
    step.onConflictDoNothing = vi.fn(() => step)
    step.onConflictDoUpdate = vi.fn(() => step)
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve([]).then(resolve, reject)
    return step
  }

  const txApi = {
    select: vi.fn(() => readChain()),
    insert: vi.fn(() => writeChain('insert')),
    update: vi.fn(() => writeChain('update')),
    delete: vi.fn(() => writeChain('delete')),
  }

  return {
    db: {
      select: vi.fn(() => readChain()),
      insert: vi.fn(() => writeChain('insert')),
      update: vi.fn(() => writeChain('update')),
      delete: vi.fn(() => writeChain('delete')),
      execute: vi.fn(() => {
        H.writes.push('execute')
        return Promise.resolve([])
      }),
      transaction: vi.fn(async (cb: (tx: typeof txApi) => unknown) => {
        H.writes.push('transaction')
        return cb(txApi)
      }),
    },
    dbRead: { select: vi.fn(() => readChain()) },
    dbClient: {},
    dbWriter: { select: vi.fn(() => readChain()) },
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

/** 承载层验签桩:只替"验签"这一步,身份仍由真实鉴权链注入 request.userId。 */
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

vi.mock('../src/db/rbac-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, checkAnyPermission: vi.fn(async () => false) }
})

import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'

const PREFIX = '/api/edu-ai-management'

const PARENT_A = '11111111-1111-4111-8111-111111111111'
const PARENT_B = '22222222-2222-4222-8222-222222222222'
const CHILD_X = '33333333-3333-4333-8333-333333333333' // PARENT_A 家孩子
const CHILD_Y = '44444444-4444-4444-8444-444444444444' // PARENT_B 家孩子(对 PARENT_A 是别人家)

/** 两枚登记形态(路径模板 → 真实 URL;:id 与 :childId 都当学生 id 用,与路由体内一致)。 */
const FORMS: Array<{ label: string; url: (studentId: string) => string }> = [
  { label: 'GET /parent/child/:id/attendance', url: (s) => `/parent/child/${s}/attendance` },
  {
    label: 'GET /parent/children/:childId/attendance',
    url: (s) => `/parent/children/${s}/attendance`,
  },
]

function accessToken(userId: string, extraClaims: Record<string, unknown> = {}): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ userId, type: 'access', ...extraClaims })
  return `${head}.${body}.${H.sigOf(`${head}.${body}`)}`
}

let appPromise: Promise<FastifyInstance> | null = null
async function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    const app = Fastify({ logger: false })
    app.setErrorHandler((err: FastifyError, _request, reply) => {
      const statusCode =
        typeof (err as { statusCode?: number }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    await app.register(eduAiManagementRoutes, { prefix: PREFIX })
    await app.ready()
    appPromise = Promise.resolve(app)
  }
  return appPromise
}

interface CallOptions {
  url: string
  as?: string
  query?: Record<string, string>
}

async function call(
  o: CallOptions,
): Promise<{ statusCode: number; body: Record<string, unknown>; text: string }> {
  const app = await getApp()
  const headers: Record<string, string> = {}
  if (o.as) headers.authorization = `Bearer ${accessToken(o.as)}`
  const qs = o.query ? `?${new URLSearchParams(o.query).toString()}` : ''
  const res = await app.inject({ method: 'GET', url: `${PREFIX}${o.url}${qs}`, headers })
  let body: Record<string, unknown> = {}
  try {
    body = res.json() as Record<string, unknown>
  } catch {
    body = {}
  }
  return { statusCode: res.statusCode, body, text: res.body }
}

function pushBinding(
  parentId: string,
  studentId: string,
  status: string,
  deletedAt: string | null = null,
): void {
  H.bindings.push({
    id: `binding-${parentId}-${studentId}-${status}`,
    parentId,
    studentId,
    status,
    deletedAt,
  })
}

function pushAttendance(id: string, studentId: string, date: string): void {
  H.attendance.push({
    id,
    studentId,
    classId: '88888888-8888-4888-8888-888888888888',
    date,
    status: 'present',
    checkInMethod: 'self',
    deletedAt: null,
  })
}

/** 谓词字面值全集(归属判据的唯一可读面)。 */
const allLiterals = (): string[] =>
  H.wheres.filter((w) => w !== undefined).flatMap((w) => H.literalsOf(w))

const listOf = (body: Record<string, unknown>): Array<Record<string, unknown>> => {
  const data = body.data as { list?: Array<Record<string, unknown>> } | undefined
  return data?.list ?? []
}

beforeEach(() => {
  H.bindings.length = 0
  H.attendance.length = 0
  H.statusOverrides.clear()
  H.reads = 0
  H.wheres.length = 0
  H.results.length = 0
  H.writes.length = 0
  H.unclassified.length = 0
})

afterAll(async () => {
  if (appPromise) (await appPromise).close()
  appPromise = null
})

// =============================================================================
// 1. 绑定状态轴:confirmed 才放过;pending / rejected / 软删 一律 403 且零泄露
//    (正向对照与拒绝面成对,拒绝面一律断言"副作用未发生")
// =============================================================================

for (const form of FORMS) {
  describe(`${form.label} 的归属状态轴`, () => {
    it('正对照:confirmed 绑定 ⇒ 200,且 list 只含自家孩子的行', async () => {
      pushBinding(PARENT_A, CHILD_X, 'confirmed')
      pushAttendance('att-x-1', CHILD_X, '2026-11-04')
      pushAttendance('att-y-1', CHILD_Y, '2026-11-04')
      const res = await call({ url: form.url(CHILD_X), as: PARENT_A })
      expect(res.statusCode, res.text).toBe(200)
      expect(listOf(res.body).map((r) => r.id)).toEqual(['att-x-1'])
      // 归属判据确实带在谓词里:登录主体 + 被看孩子
      expect(allLiterals()).toContain(PARENT_A)
      expect(allLiterals()).toContain(CHILD_X)
      expect(H.writes).toEqual([])
    })

    it('pending 绑定(家长自报申请尚未通过)⇒ 403,零泄露、考勤表一次都没查、零写', async () => {
      pushBinding(PARENT_A, CHILD_X, 'pending')
      pushAttendance('att-x-1', CHILD_X, '2026-11-04')
      const res = await call({ url: form.url(CHILD_X), as: PARENT_A })
      expect(res.statusCode, `pending 绑定不得放过:实测 ${res.text}`).toBe(403)
      expect(listOf(res.body)).toEqual([])
      expect(res.body.code).toBe(403)
      expect(H.reads, '归属不成立时不得再去查归属外的考勤表').toBe(1)
      expect(H.writes).toEqual([])
      // 谓词里必须是"confirmed"这一档,而不是任意状态
      expect(allLiterals()).toContain('confirmed')
    })

    it('rejected 绑定 ⇒ 403,同样只问绑定表一次且零写', async () => {
      pushBinding(PARENT_A, CHILD_X, 'rejected')
      pushAttendance('att-x-1', CHILD_X, '2026-11-04')
      const res = await call({ url: form.url(CHILD_X), as: PARENT_A })
      expect(res.statusCode, `rejected 绑定不得放过:实测 ${res.text}`).toBe(403)
      expect(listOf(res.body)).toEqual([])
      expect(H.reads).toBe(1)
      expect(H.writes).toEqual([])
    })

    it('已 confirmed 但绑定被软删 ⇒ 403 且不泄露,库里孩子的行仍在(未发生删除副作用)', async () => {
      pushBinding(PARENT_A, CHILD_X, 'confirmed', '2026-11-05T00:00:00Z')
      pushAttendance('att-x-1', CHILD_X, '2026-11-04')
      const res = await call({ url: form.url(CHILD_X), as: PARENT_A })
      expect(res.statusCode, '软删绑定不得当有效归属').toBe(403)
      expect(listOf(res.body)).toEqual([])
      expect(H.writes).toEqual([])
      expect(H.attendance.map((a) => a.id)).toEqual(['att-x-1'])
    })

    it('别人家已 confirmed 的孩子:非归属家长拿不到其考勤(跨家庭越权面)', async () => {
      pushBinding(PARENT_B, CHILD_Y, 'confirmed')
      pushAttendance('att-y-1', CHILD_Y, '2026-11-04')
      const res = await call({ url: form.url(CHILD_Y), as: PARENT_A })
      expect(res.statusCode).toBe(403)
      expect(res.text).not.toContain('att-y-1')
      expect(listOf(res.body)).toEqual([])
      expect(H.reads).toBe(1)
      expect(H.writes).toEqual([])
      const literals = allLiterals()
      expect(literals).toContain(PARENT_A)
      expect(literals, '归属查询必须按登录主体筛,不得只按被请求的孩子').not.toContain(PARENT_B)
      // 正向对照:PARENT_B 自己查同一个孩子是通的(同一条数据、同一个时刻)
      H.reads = 0
      const ownerRes = await call({ url: form.url(CHILD_Y), as: PARENT_B })
      expect(ownerRes.statusCode, ownerRes.text).toBe(200)
      expect(listOf(ownerRes.body).map((r) => r.id)).toEqual(['att-y-1'])
    })

    it('客户端自报 parentId / studentId 一律被忽略:身份只认承载层', async () => {
      pushBinding(PARENT_A, CHILD_X, 'confirmed')
      pushAttendance('att-x-1', CHILD_X, '2026-11-04')
      const res = await call({
        url: form.url(CHILD_X),
        as: PARENT_A,
        query: { parentId: PARENT_B, studentId: CHILD_Y },
      })
      expect(res.statusCode, res.text).toBe(200)
      expect(listOf(res.body).map((r) => r.id)).toEqual(['att-x-1'])
      const literals = allLiterals()
      expect(literals).toContain(PARENT_A)
      expect(literals, '自报的归属主体不得进谓词').not.toContain(PARENT_B)
      expect(literals, '自报的学生不得顶替路径参数').not.toContain(CHILD_Y)
    })

    it('同一份世界状态下连打两次结论逐字相同(不靠运气绿)', async () => {
      pushBinding(PARENT_A, CHILD_X, 'pending')
      pushAttendance('att-x-1', CHILD_X, '2026-11-04')
      const first = await call({ url: form.url(CHILD_X), as: PARENT_A })
      const second = await call({ url: form.url(CHILD_X), as: PARENT_A })
      expect(second.statusCode).toBe(first.statusCode)
      expect(JSON.stringify(second.body)).toBe(JSON.stringify(first.body))
      expect(H.writes).toEqual([])
    })
  })
}

// =============================================================================
// 2. 两枚形态同题同判(功能同题、路径两形 ⇒ 同一输入的结论必须逐字相同)
// =============================================================================

describe('两枚登记形态对同一枚 pending 绑定必须同判', () => {
  for (const status of ['pending', 'rejected']) {
    it(`${status} 绑定:两枚路径的状态码与文案逐字相同`, async () => {
      pushBinding(PARENT_A, CHILD_X, status)
      pushAttendance('att-x-1', CHILD_X, '2026-11-04')
      const [singular, plural] = await Promise.all([
        call({ url: FORMS[0]!.url(CHILD_X), as: PARENT_A }),
        call({ url: FORMS[1]!.url(CHILD_X), as: PARENT_A }),
      ])
      expect(singular.statusCode, `单数形实测 ${singular.text}`).toBe(403)
      expect(plural.statusCode).toBe(singular.statusCode)
      expect(String(plural.body.message)).toBe(String(singular.body.message))
      expect(String(plural.body.code)).toBe(String(singular.body.code))
      expect(H.writes, '两条路径都不得留下写副作用').toEqual([])
    })
  }

  it('本文件把每一条查询都答对了:假库零"认不出的谓词"(§0.3 不冒判)', async () => {
    pushBinding(PARENT_A, CHILD_X, 'confirmed')
    pushAttendance('att-x-1', CHILD_X, '2026-11-04')
    const res = await call({
      url: FORMS[1]!.url(CHILD_X),
      as: PARENT_A,
      query: { status: 'present', startDate: '2026-11-01', endDate: '2026-11-30' },
    })
    expect(res.statusCode, res.text).toBe(200)
    expect(listOf(res.body).map((r) => r.id)).toEqual(['att-x-1'])
    expect(H.unclassified).toEqual([])
  })
})

// =============================================================================
// 3. RP-70 收敛形状锁:两枚注册都指向同一出口 serveChildAttendance(§0.6 单源),
//    confirmed 归属判据只落一份,不得再退回两枚独立处理器各抄一份
// =============================================================================

/** 静态取证面:照抄同族 tests/edu-attendance-write-and-parent-list-contract.test.ts 的内容锚点法。 */
const ROUTE_SRC = readFileSync(
  fileURLToPath(new URL('../src/routes/edu-ai-management.ts', import.meta.url)),
  'utf8',
)

function handlerBody(registration: string): string {
  const start = ROUTE_SRC.indexOf(registration)
  if (start < 0) return ''
  const next = ROUTE_SRC.indexOf('\n  server.', start + registration.length)
  return ROUTE_SRC.slice(start, next < 0 ? start + 4000 : next)
}

describe('RP-70:两路由指向同一出口(收敛形状锁)', () => {
  const singular = handlerBody(`server.get('/parent/child/:id/attendance'`)
  const plural = handlerBody(`server.get('/parent/children/:childId/attendance'`)
  const outlet = (() => {
    const start = ROUTE_SRC.indexOf('async function serveChildAttendance(')
    if (start < 0) return ''
    const next = ROUTE_SRC.indexOf('\n  server.', start)
    return ROUTE_SRC.slice(start, next < 0 ? start + 4000 : next)
  })()

  it('出口函数只定义一份', () => {
    expect(ROUTE_SRC.match(/async function serveChildAttendance\(/g) ?? []).toHaveLength(1)
    expect(outlet, '出口函数体必须可读').not.toBe('')
  })

  it('两条路由注册都委托给同一出口(不是两枚独立处理器各落一份)', () => {
    expect(singular.match(/serveChildAttendance\(request, reply/g) ?? []).toHaveLength(1)
    expect(plural.match(/serveChildAttendance\(request, reply/g) ?? []).toHaveLength(1)
  })

  it('confirmed 归属判据只在出口里落一次:两条路由切片内不得再各抄一份', () => {
    const clause = "eq(eduParentStudentBinding.status, 'confirmed')"
    expect(outlet, '出口函数必须自持归属判据').toContain(clause)
    expect(singular, '单数端点不得再内联归属判据').not.toContain(clause)
    expect(plural, '复数端点不得再内联归属判据').not.toContain(clause)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
