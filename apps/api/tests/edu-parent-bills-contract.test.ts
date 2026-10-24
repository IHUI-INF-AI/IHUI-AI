// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 家长端学费账单端点契约锁(G-954 学费账目线 ③,2026-10-23 立,**全程不连库**)。
 *
 * 锁的端点(内容锚点,不写行号):`server.get('/parent/children/:childId/bills', …)`,
 * 注册面 = `apps/api/src/routes/edu-ai-management.ts`,对外路径
 * `GET /api/edu-ai-management/parent/children/:childId/bills`(前端 Tabs「账单」调用它)。
 *
 * 2026-10-24 收口:本席交付时登记的两枚实装缺口**都已在生产码修掉**,本文件随之改为
 * 在真实路由形状下执行契约——原先那处「把路由参数 childId 复制成 handler 声明的 id 键」
 * 的显式垫片、以及那条「修好即红」的取证锁 F1,都已摘除(不是改成放行两个状态码):
 *  缺陷① 参数键名:`uuidParamSchema` 的键是 `id`,而真实参数键是 `childId` ⇒ 合法 uuid
 *    也必然 safeParse 失败,任何请求都到不了归属判据。现由 `childIdParamSchema` 解析。
 *  缺陷② 鉴权缺位:本路由原先既不挂 preHandler 也不内调鉴权,而全仓只往 `request.userId`
 *    赋值的三处(plugins/auth.ts 的 authenticate、plugins/internal-service-token.ts、
 *    utils/open-capability-gate.ts)结构上都覆盖不到这条路径 ⇒ 真人 JWT 恒 401。
 *    现按同文件 `/my-bills`(同为「非管理端权限」的自查端点)的既有惯例,在 handler 首行调
 *    `checkAuthOrInternalService(request, reply)`,身份由承载层显式注入。
 *
 * 因此**身份不再由测试侧手写 `request.userId`**(那等于绕过承载层自证),而是走真实鉴权链:
 * 桩 `@ihui/auth.verifyAccessToken` + `db/usercenter-queries.getUserStatus`(仓内既有惯例,
 * 见 tests/admin-agreements.test.ts 等),凭据以真三段式 JWS 形态传入 `Authorization: Bearer`。
 * 桩掉的只有签名验证与账号状态查询两步,链路本身(authenticate → checkAuth → 本端点)是真的。
 *
 * 为什么不连库也能锁:AGENTS §5 测试隔离铁律(禁止碰 PG 8810/Redis 8811,共享连接池必须
 * monkeypatch)。形状抄同族既有件 `tests/edu-payment-contract.test.ts` +
 * `tests/g962-b4b-cgroup-route-shape.test.ts`(同一套 config/db/logger mock + Fastify
 * 注入真实路由),不自造第二套夹具基座。
 *
 * 锁的是契约不是实现:状态码 + `{code, message, data}` 形状 + 鉴权资格正反对照 +
 * 入参被拒的形态 + 「身份来自承载层」(§5 认证不等于授权) + 只读(家长侧不得经此写缴费)。
 *
 * 本机实测边界(如实登记,不写成"已验证线上可出账"):离线只能证契约形状。真人 JWT 的端到端
 * (真签名验证 + 真绑定行 + 真账目)要连库与真凭据,本文件一条都没连,那一格未收。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/**
 * 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。
 * 每个计数都在 beforeEach 清零 ⇒ "跑两次逐字相同"才是判据而不是运气。
 */
const H = vi.hoisted(() => {
  // 测试侧"签名":FNV-1a 摘要,把凭据内容(header+payload)绑进签名段。
  // 要点不是密码学强度,而是让「改 payload」与「换签名段」两型伪造都能被判负 ——
  // 否则桩会把结构合法的伪造凭据照收,那格就成了假阳性。
  const fnv1a = (s: string): string => {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }
  const testSecret = 'ihui-test-jwt-secret'

  /**
   * 从 drizzle 条件对象里取出被绑定的字面值(列对象不是字面值,自然被跳过)。
   * 本文件唯一一份 walker:H 的查询解答器与用例断言共用它(§0.6 单一真相源)。
   */
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
    // SQL 组合体走 queryChunks;被绑定的值在 drizzle 里包成 { value } / { inlineParam } 一型
    for (const key of ['queryChunks', 'value', 'inlineParam', 'inlineParams', 'params']) {
      if (key in rec) literalsOf(rec[key], out, depth + 1)
    }
    return out
  }

  return {
    /**
     * 世界状态:已 confirmed 的 (家长, 学员) 绑定对。
     * 归属查询按**谓词里绑定的 uuid** 与它求交来回答 —— 家长不在集合里就查不到行,
     * 于是「越权/自报身份 ⇒ 403」是被世界状态证出来的,不是靠脚本顺序凑出来的。
     */
    bindings: [] as Array<{ parentId: string; childId: string }>,
    /** 世界状态:报名行集(报名查询按谓词里的 childId 过滤) */
    enrollments: [] as Array<Record<string, unknown>>,
    /** 第 n 次 db.select() 的返回值行集(下标 = 调用序;由 where 谓词解答后写入) */
    results: [] as unknown[],
    /** 第 n 次 db.select() 实际收到的 where() 条件对象(归属判据的唯一可读面) */
    wheres: [] as unknown[],
    /** db.select() 调用次数 */
    reads: 0,
    /** 写侧调用记录(insert/update/delete/execute/transaction)—— 只读端点必须恒空 */
    writes: [] as string[],
    /** loadEnrollmentLedger 的入参序列(账目出口被问了几次、问的是谁) */
    ledgerIds: [] as string[],
    /** loadEnrollmentLedger 的返回脚本(按调用序取;取完补 null) */
    ledgerScript: [] as unknown[],
    /** users.status 覆盖表(缺省 1 = 正常);0 = 封禁、3 = 注销,用于锁承载层的账号状态腿 */
    statusOverrides: new Map<string, number>(),
    /** 测试密钥:只参与 sigOf 的计算,不出现在凭据里 */
    testSecret,
    /** 凭据前两段的签名段算法(测试侧与被桩掉的验签侧共用这一份实现,§0.6) */
    sigOf: (headerAndPayload: string) =>
      `${fnv1a(`${headerAndPayload}.${testSecret}`)}${fnv1a(`${headerAndPayload}.reverse`)}`,
    /** drizzle 谓词 → 绑定字面值(唯一实现;模块级 boundLiteralsOf 是它的别名) */
    literalsOf,
  }
})

/** 桩掉 config:避免 env 校验在测试进程里 process.exit(1)(与既有 api 测试同形)。 */
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/forbidden-in-mock-tests',
    REDIS_URL: 'redis://localhost:8811/forbidden-in-mock-tests',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

/**
 * db 链式桩:select 的返回行集由**这次查询的谓词**对世界状态求值得到(见 rowsFor),
 * 写侧一律记账并返回空。
 * **本文件不建任何真连接**(DATABASE_URL 只是占位字面量,不会被用到)。
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
    'values',
    'set',
    'returning',
    'onConflictDoNothing',
    'onConflictDoUpdate',
  ] as const

  /**
   * 谓词解答器:返回"假如这是真库,这条 where 会命中哪些行"。
   * 两种查询靠谓词本身区分,不靠调用序:
   * - 归属查询带 status='confirmed' ⇒ 与 H.bindings 求交(家长/学员两个 uuid 都必须在谓词里);
   * - 报名查询按学员过滤 ⇒ 只回该学员的报名行。
   */
  const rowsFor = (predicate: unknown): unknown[] => {
    const literals = H.literalsOf(predicate)
    if (literals.includes('confirmed')) {
      return H.bindings
        .filter((b) => literals.includes(b.parentId) && literals.includes(b.childId))
        .map(() => ({ id: 'binding-row-1' }))
    }
    return H.enrollments.filter((row) => literals.includes(String(row.studentId)))
  }

  const makeChain = (slot: number) => {
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
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(H.results[slot] ?? []).then(resolve, reject)
    return step
  }

  const readChain = () => {
    const slot = H.reads
    H.reads += 1
    H.results[slot] = H.results[slot] ?? []
    return makeChain(slot)
  }
  const writeChain = (kind: string) => {
    H.writes.push(kind)
    return makeChain(Number.MAX_SAFE_INTEGER)
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
      transaction: vi.fn(() => {
        H.writes.push('transaction')
        return Promise.resolve([])
      }),
    },
    dbRead: { select: vi.fn(() => readChain()) },
    dbClient: {},
    dbWriter: { select: vi.fn(() => readChain()) },
  }
})

vi.mock('../src/db/notification-queries.js', () => ({
  createNotification: vi.fn(),
}))
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

/**
 * 承载层的签名验证步:只替掉「验签」这一件事——claims 由真三段式 JWS 的 payload 段解出,
 * 签名段必须等于测试侧那把哨兵才算过(改过 payload 或换掉签名段的凭据一律验不过)。
 * `plugins/auth.ts` 的 authenticate 链(取凭据 → 验签 → challenge 判定 → 账号状态 → 注入
 * request.userId)整条是真的;验不过时抛 jose 形态的 code,让 authenticate 落到它自己的
 * 401 分支(不带 code 的匿名异常会被它收敛成 502「后端不可用」,那是另一种语义)。
 */
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

/** 承载层的账号状态查询步(P2-14 加固新增的那一次主键查询)。 */
vi.mock('../src/db/usercenter-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    getUserStatus: vi.fn(async (id: string) => H.statusOverrides.get(id) ?? 1),
  }
})

function safeJson(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * 账目出口只替掉 `loadEnrollmentLedger`(欠费额唯一来源),其余导出保持真身:
 * 契约是"欠费额只由账目出口给,这里不重算"(端点注释三条口径之二),
 * 所以既要能断言"逐条问过 enrollmentId",也要能断言"返回什么就透传什么"。
 */
vi.mock('../src/services/edu-ledger.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    loadEnrollmentLedger: vi.fn(async (enrollmentId: string) => {
      const idx = H.ledgerIds.length
      H.ledgerIds.push(enrollmentId)
      return H.ledgerScript[idx] ?? null
    }),
  }
})

import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'
import type { EnrollmentLedger } from '../src/services/edu-ledger.js'

const PREFIX = '/api/edu-ai-management'

const PARENT_A = '11111111-1111-4111-8111-111111111111'
const PARENT_B = '22222222-2222-4222-8222-222222222222'
const CHILD_X = '33333333-3333-4333-8333-333333333333'
const CHILD_Y = '44444444-4444-4444-8444-444444444444'
const NOT_A_UUID = 'child-x-not-a-uuid'
const ENROLLMENT_1 = '55555555-5555-4555-8555-555555555555'
const ENROLLMENT_2 = '66666666-6666-4666-8666-666666666666'

/** 统一响应壳的可读形态(`apps/api/src/utils/response.ts`:success=0/message='success')。 */
interface ResponseBody {
  code: number
  message?: string
  data?: { childId?: string; bills?: Array<Record<string, unknown>> }
}

interface InjectOptions {
  /** 承载层身份:发一条形态真的 Bearer 凭据,由真实鉴权链验过并注入 request.userId;不传 = 未登录 */
  as?: string
  /** 直接给定凭据串(用于"凭据形态真但验不过"与"挑战态"两型);与 `as` 互斥 */
  token?: string
  childId: string
  /** 客户端自报的身份字段(必须一概不改结论) */
  query?: Record<string, string>
  headers?: Record<string, string>
}

/** 造一条真三段式 JWS(header/payload 合法,签名段由 H.sigOf 生成,验签桩用同一份实现核对)。 */
function accessToken(userId: string, extraClaims: Record<string, unknown> = {}): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ userId, type: 'access', ...extraClaims })
  return `${head}.${body}.${H.sigOf(`${head}.${body}`)}`
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(eduAiManagementRoutes, { prefix: PREFIX })
  await app.ready()
  return app
}

async function getBills(o: InjectOptions): Promise<{
  statusCode: number
  body: ResponseBody
  raw: string
}> {
  if (o.as && o.token) throw new Error('InjectOptions: as 与 token 互斥')
  const app = await buildApp()
  const headers: Record<string, string> = { ...o.headers }
  const credential = o.as ? accessToken(o.as) : o.token
  if (credential) headers.authorization = `Bearer ${credential}`
  const qs = o.query ? `?${new URLSearchParams(o.query).toString()}` : ''
  const res = await app.inject({
    method: 'GET',
    url: `${PREFIX}/parent/children/${o.childId}/bills${qs}`,
    headers,
  })
  await app.close()
  return { statusCode: res.statusCode, body: res.json() as ResponseBody, raw: res.body }
}

/**
 * 从 drizzle 条件对象里取出被绑定的字面值(实现唯一在 H.literalsOf:查询解答器与断言共用一把尺子)。
 * 每条用到它的用例都先断言"集合非空且含 'confirmed'"⇒ 取不到就是红,不会静默放行。
 */
function boundLiteralsOf(node: unknown): string[] {
  return H.literalsOf(node)
}

/** 绑定查询(第 1 次 select)的条件;没有查询过就返回 undefined。 */
function bindingPredicate(): unknown {
  return H.wheres[0]
}

const enrollmentRow = (
  enrollmentId: string,
  termName: string,
  totalFee: number,
  studentId: string = CHILD_X,
) => ({
  studentId,
  enrollmentId,
  classId: '77777777-7777-4777-8777-777777777777',
  className: '春季提高班',
  termId: '88888888-8888-4888-8888-888888888888',
  termName,
  status: 'active',
  totalFee,
})

const ledgerOf = (enrollmentId: string, arrears: number): EnrollmentLedger => ({
  enrollmentId,
  totalFee: 1200,
  creditedAmount: 1200 - arrears,
  settledRefund: 0,
  paidAmount: 1200 - arrears,
  arrears,
  nextDueDate: '2026-09-30',
  schedules: [],
  unallocatedPaid: 0,
  overdueCount: arrears > 0 ? 1 : 0,
  dueSoonCount: 0,
})

/** 世界状态:登记一条 confirmed 绑定(家长 ↔ 学员)。 */
function bind(parentId: string, childId: string): void {
  H.bindings.push({ parentId, childId })
}

/** 一次成功调用所需的全部世界状态:PARENT_A 绑定 CHILD_X + 两期报名 + 两条账目。 */
function scriptHappyPath(): void {
  bind(PARENT_A, CHILD_X)
  H.enrollments.push(
    enrollmentRow(ENROLLMENT_1, '2026 春季', 1200),
    enrollmentRow(ENROLLMENT_2, '2026 秋季', 1500),
  )
  H.ledgerScript.length = 0
  H.ledgerScript.push(ledgerOf(ENROLLMENT_1, 800), ledgerOf(ENROLLMENT_2, 0))
}

/**
 * 清账本并可选地铺一个新世界状态。单一出口(beforeEach、D1 的每一步、A9 的多世界对照
 * 都用它)—— 判据面的清零清单不允许有第二份副本(§0.6)。
 */
function resetWorld(script?: () => void): void {
  H.results.length = 0
  H.bindings.length = 0
  H.enrollments.length = 0
  H.wheres.length = 0
  H.reads = 0
  H.writes.length = 0
  H.ledgerIds.length = 0
  H.ledgerScript.length = 0
  H.statusOverrides.clear()
  script?.()
}

beforeEach(() => {
  resetWorld()
})

// ===========================================================================
// A 组 —— 鉴权资格:身份只认真实鉴权链注入的那个主体
// ===========================================================================
describe('A 组 GET /parent/children/:childId/bills 的鉴权资格(真实路由形状,零垫片)', () => {
  it('A1 无任何凭据 ⇒ 401 + {code:401},且拒绝来自承载层不是端点手写守卫;一条查询都没发出', async () => {
    const r = await getBills({ childId: CHILD_X })
    expect(r.statusCode).toBe(401)
    expect(r.body.code).toBe(401)
    // 承载层文案是 'Authentication required';端点原先那句手写的 '未登录' 已不再是 reachable 结论
    // ⇒ 这条断言就是"authenticate 真在链上"的形状锁(摘掉鉴权接线 ⇒ 本条立刻红)。
    expect(r.body.message).not.toBe('未登录')
    expect(typeof r.body.message).toBe('string')
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })

  it('A2 客户端整包自报 userId/parentId/studentId + x-user-id 头也换不来身份:响应与 A1 逐字节相同且仍零查询', async () => {
    const spoofed = await getBills({
      childId: CHILD_X,
      query: { userId: PARENT_A, parentId: PARENT_A, studentId: CHILD_X },
      headers: { 'x-user-id': PARENT_A },
    })
    const clean = await getBills({ childId: CHILD_X })
    // 自报字段不得改变资格结论(§5 认证不等于授权:身份不得住客户端可整写字段)
    expect(spoofed.statusCode).toBe(401)
    expect(spoofed.raw).toBe(clean.raw)
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })

  it('A3 承载层在场(真凭据验过 + 绑定命中)⇒ 200,结论必须与"未登录"不同 ⇒ 证明 handler 读的是注入身份', async () => {
    const anonymous = await getBills({ childId: CHILD_X })
    scriptHappyPath()
    const carriered = await getBills({ as: PARENT_A, childId: CHILD_X })
    expect(anonymous.statusCode).toBe(401)
    expect(carriered.statusCode).toBe(200)
    expect(carriered.statusCode).not.toBe(anonymous.statusCode)
    expect(carriered.raw).not.toBe(anonymous.raw)
  })

  it('A4 非法 childId(非 uuid)⇒ 400 且校验排在任何归属查询之前(零查询、零写)', async () => {
    const r = await getBills({ as: PARENT_A, childId: NOT_A_UUID })
    expect(r.statusCode).toBe(400)
    expect(r.body.code).toBe(400)
    expect(typeof r.body.message).toBe('string')
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })

  it('A5 未绑定的家长与不存在的学员必须同形:两枚 childId 的响应逐字节相等且都不是 404', async () => {
    // 端点注释口径一:"这个孩子不存在"与"不是你的孩子"同形,否则端点自己变成存在性预言机
    const notMine = await getBills({ as: PARENT_B, childId: CHILD_X })
    const notExist = await getBills({ as: PARENT_B, childId: CHILD_Y })
    expect(notMine.statusCode).toBe(403)
    expect(notExist.statusCode).not.toBe(404)
    expect(notExist.raw).toBe(notMine.raw)
  })

  it('A6【缺陷② 回归锁·其一】凭据形态真(Bearer 三段式)但验不过 ⇒ 承载层判 401,一条查询都没发', async () => {
    const forged = await getBills({
      childId: CHILD_X,
      token: `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ userId: PARENT_A, type: 'access' })).toString('base64url')}.bm90LXRoZS1zaWc`,
    })
    expect(forged.statusCode).toBe(401)
    expect(forged.body.code).toBe(401)
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
    // 垃圾凭据同样判 401(不是 500、不是放行)
    const garbage = await getBills({ childId: CHILD_X, token: 'some.jwt.value' })
    expect(garbage.statusCode).toBe(401)
    expect(H.reads).toBe(0)
  })

  it('A7【承载层确在链上】登录挑战态 token(type=challenge)⇒ 401 拒绝,零查询:该判定住在 authenticate 内', async () => {
    scriptHappyPath()
    const challenge = await getBills({
      childId: CHILD_X,
      token: accessToken(PARENT_A, { type: 'challenge' }),
    })
    expect(challenge.statusCode).toBe(401)
    expect(challenge.body.message).toContain('Challenge token')
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })

  it('A8【承载层确在链上】账号被封禁(status=0)⇒ 403,零查询:该判定也住在 authenticate 内', async () => {
    scriptHappyPath()
    H.statusOverrides.set(PARENT_A, 0)
    const r = await getBills({ as: PARENT_A, childId: CHILD_X })
    expect(r.statusCode).toBe(403)
    expect(r.body.message).toContain('封禁')
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })

  it('A9【缺陷② 回归锁·其二】承载层是 PARENT_B 时,整包自报 PARENT_A 的身份字段不得改变响应:与什么都不自报逐字节相同', async () => {
    scriptHappyPath() // 世界状态:这个孩子确实有两期账(归属对了就该出账)
    const spoofed = await getBills({
      as: PARENT_B,
      childId: CHILD_X,
      query: { parentId: PARENT_A, userId: PARENT_A, studentId: CHILD_X },
      headers: { 'x-user-id': PARENT_A },
    })
    const honest = await getBills({ as: PARENT_B, childId: CHILD_X })
    const legitOwner = await getBills({ as: PARENT_A, childId: CHILD_X })
    expect(spoofed.raw).toBe(honest.raw)
    expect(spoofed.statusCode).toBe(403)
    // 正向对照:同一枚 childId、同一份账目脚本,归属对了才出账 ⇒ 自报没能顶替承载层身份
    expect(legitOwner.statusCode).toBe(200)
    expect(spoofed.raw).not.toBe(legitOwner.raw)
  })
})

// ===========================================================================
// B 组 —— 只读面:家长侧绝不可能经此端点写账,也不可能拿到别人的账
// ===========================================================================
describe('B 组 只读与不泄漏不变式(覆盖以上全部请求形态)', () => {
  it('B1 六种请求形态打完后写侧调用数仍为 0(缴费是机构动作,须走 POST /payment-record)', async () => {
    await getBills({ childId: CHILD_X })
    await getBills({ childId: CHILD_X, query: { parentId: PARENT_A } })
    await getBills({ as: PARENT_A, childId: NOT_A_UUID })
    await getBills({ as: PARENT_A, childId: CHILD_X })
    await getBills({ as: PARENT_B, childId: CHILD_X })
    await getBills({ childId: CHILD_X, token: 'some.jwt.value' })
    expect(H.writes).toEqual([])
  })

  it('B2 绑定未命中时绝不发起第二次查询 ⇒ 报名/账目根本没被读过', async () => {
    // 世界状态:库里没有 PARENT_B ↔ CHILD_X 这条 confirmed 绑定(bindings 本就没有登记)
    const r = await getBills({ as: PARENT_B, childId: CHILD_X })
    expect(r.statusCode).toBe(403)
    expect(H.reads).toBe(1)
    expect(H.ledgerIds).toEqual([])
    expect(r.body.data?.bills ?? []).toEqual([])
  })

  it('B3 越权请求即便整包自报真家长/真学号也拿不到账单行(正向对照见 C2)', async () => {
    // 世界状态:这个孩子**确实有两期账**(enrollments/ledgerScript 都备着),
    // 但调用者 PARENT_B 名下没有那条 confirmed 绑定(bindings 里没有这一对)。
    // 归属判据一旦被摘掉或读错列,这些账就会随 200 一起出去 ⇒ 本条立刻红。
    H.enrollments.push(
      enrollmentRow(ENROLLMENT_1, '2026 春季', 1200),
      enrollmentRow(ENROLLMENT_2, '2026 秋季', 1500),
    )
    H.ledgerScript.push(ledgerOf(ENROLLMENT_1, 800), ledgerOf(ENROLLMENT_2, 0))
    const r = await getBills({
      as: PARENT_B,
      childId: CHILD_X,
      query: { parentId: PARENT_A, userId: PARENT_A, studentId: CHILD_X },
      headers: { 'x-user-id': PARENT_A },
    })
    expect(r.statusCode).toBe(403)
    expect(r.body.data?.bills ?? []).toEqual([])
    // 副作用没发生:第二次查询根本没发出,账目出口一次都没被问
    expect(H.reads).toBe(1)
    expect(H.ledgerIds).toEqual([])
    expect(H.writes).toEqual([])
  })
})

// ===========================================================================
// C 组 —— 归属判据与账目出口口径(真实路由形状,零垫片)
// ===========================================================================
describe('C 组 归属与账目契约(承载层显式注入身份)', () => {
  it('C1 绑定查询把**承载层**绑进归属位,客户端自报的家长不进去', async () => {
    // 世界状态:一条绑定都不登记 ⇒ 请求停在归属判据上,这次 where 仍会被 H.wheres 记下
    await getBills({
      as: PARENT_B,
      childId: CHILD_X,
      query: { parentId: PARENT_A },
      headers: { 'x-user-id': PARENT_A },
    })
    const literals = boundLiteralsOf(bindingPredicate())
    // 取不到值就是红(判据失效方向 = 多要一次定向说明,不是静默放行)
    expect(literals.length).toBeGreaterThan(0)
    expect(literals).toContain('confirmed')
    expect(literals).toContain(PARENT_B)
    expect(literals).toContain(CHILD_X)
    expect(literals).not.toContain(PARENT_A)
  })

  it('C2 已 confirmed 绑定的家长 ⇒ 200 + {code:0,message:"success",data:{childId,bills}}', async () => {
    scriptHappyPath()
    const r = await getBills({ as: PARENT_A, childId: CHILD_X })
    expect(r.statusCode).toBe(200)
    expect(r.body.code).toBe(0)
    expect(r.body.message).toBe('success')
    expect(r.body.data?.childId).toBe(CHILD_X)
    const bills = r.body.data?.bills ?? []
    expect(bills).toHaveLength(2)
  })

  it('C3 欠费额只由账目出口给:每行 ledger 与出口返回逐字节相等,且问的次数/入参都等于报名集合', async () => {
    scriptHappyPath()
    const r = await getBills({ as: PARENT_A, childId: CHILD_X })
    expect(H.ledgerIds).toEqual([ENROLLMENT_1, ENROLLMENT_2])
    const bills = r.body.data?.bills ?? []
    expect(bills[0]?.ledger).toEqual(ledgerOf(ENROLLMENT_1, 800))
    expect(bills[1]?.ledger).toEqual(ledgerOf(ENROLLMENT_2, 0))
    // 端点自己不得重算出口字段:响应里那行的 arrears 只能来自 ledger
    expect((bills[0]?.ledger as { arrears: number }).arrears).toBe(800)
    expect(bills[0]?.totalFee).toBe(1200)
  })

  it('C4 账目出口回 null 的报名不得被丢掉也不得被编造:行仍在、ledger 仍是 null', async () => {
    bind(PARENT_A, CHILD_X)
    H.enrollments.push(enrollmentRow(ENROLLMENT_1, '2026 春季', 1200))
    H.ledgerScript.length = 0
    H.ledgerScript.push(null)
    const r = await getBills({ as: PARENT_A, childId: CHILD_X })
    const bills = r.body.data?.bills ?? []
    expect(bills).toHaveLength(1)
    expect(bills[0]?.enrollmentId).toBe(ENROLLMENT_1)
    expect(bills[0]?.ledger).toBeNull()
  })

  it('C5 无报名的已绑定学员 ⇒ 200 + bills 空数组(不是 404、不是 null)', async () => {
    bind(PARENT_A, CHILD_X) // 绑定在,但这名学员名下一条报名都没有
    const r = await getBills({ as: PARENT_A, childId: CHILD_X })
    expect(r.statusCode).toBe(200)
    expect(r.body.data?.bills).toEqual([])
    expect(H.ledgerIds).toEqual([])
  })

  it('C6 整条链路只读:经真实鉴权路径命中绑定的成功路径同样零写(与 B1 分别覆盖两条分支)', async () => {
    scriptHappyPath()
    const r = await getBills({ as: PARENT_A, childId: CHILD_X })
    expect(r.statusCode).toBe(200)
    expect(H.writes).toEqual([])
    expect(H.reads).toBe(2)
  })
})

// ===========================================================================
// D 组 —— 无共享状态:同一场景序列跑两遍,响应与账本逐项相同
// ===========================================================================
describe('D 组 跑两遍等值(用例之间不共享状态、不污染库)', () => {
  interface Snapshot {
    statusCode: number
    raw: string
    reads: number
    writes: string[]
    ledgerIds: string[]
  }

  async function scenario(): Promise<Snapshot[]> {
    const out: Snapshot[] = []
    const step = async (o: InjectOptions, script?: () => void) => {
      resetWorld(script)
      const r = await getBills(o)
      out.push({
        statusCode: r.statusCode,
        raw: r.raw,
        reads: H.reads,
        writes: [...H.writes],
        ledgerIds: [...H.ledgerIds],
      })
    }
    await step({ childId: CHILD_X })
    await step({ childId: CHILD_X, query: { parentId: PARENT_A } })
    await step({ as: PARENT_A, childId: NOT_A_UUID })
    await step({ as: PARENT_A, childId: CHILD_X }, scriptHappyPath)
    await step({ as: PARENT_B, childId: CHILD_X }, () => {
      H.enrollments.push(enrollmentRow(ENROLLMENT_1, '2026 春季', 1200))
      H.ledgerScript.push(ledgerOf(ENROLLMENT_1, 800))
    })
    return out
  }

  it('D1 同一序列第二遍与第一遍逐字节相同(含 db 调用次数序列)', async () => {
    const run1 = await scenario()
    const run2 = await scenario()
    expect(run2).toEqual(run1)
    // 阳性对照:两遍都不是空数组,否则"相同"可以是两个空集
    expect(run1).toHaveLength(5)
    expect(run1.map((s) => s.statusCode)).toEqual([401, 401, 400, 200, 403])
    expect(run1[3]?.reads).toBe(2)
    expect(run1[4]?.reads).toBe(1)
    expect(run1.flatMap((s) => s.writes)).toEqual([])
  })
})

// ===========================================================================
// F 组 —— 两枚缺陷的回归锁(缺陷修好后自动成立;把缺陷改回去立刻红)
// ===========================================================================
describe('F 组 缺陷①② 的回归锁', () => {
  it('F1 缺陷① 行为面:真实路由形状下合法 uuid 不再被参数校验挡下,归属查询真的发出(旧锁"修好即红"的反面)', async () => {
    // 旧 F1 断言的是"合法 uuid 也只能拿 400(参数键名对不上)"—— 缺陷已修,那条取证锁随之删除;
    // 这里改成钉住修好的那一面:请求必须走到归属判据,而不是停在 400。
    scriptHappyPath()
    const r = await getBills({ as: PARENT_A, childId: CHILD_X })
    expect(r.statusCode).toBe(200)
    expect(H.reads).toBeGreaterThan(0)
    expect(r.body.message).not.toContain('expected string')
    expect(r.body.data?.childId).toBe(CHILD_X)
  })

  it('F2 缺陷①② 源码面:bills 的 handler 体必须调承载层鉴权出口,且不得再用 uuidParamSchema 解析参数', async () => {
    // 行为面已由 A1/A3/A6/A7/A8 钉住;这一条只补一格:防"把接线摘回端点手写的 401 守卫"
    // 或"参数键名再漂移回 id" —— 那两种回潮在特定脚本下能让行为面用例各自都还绿。
    const src = readFileSync(
      fileURLToPath(new URL('../src/routes/edu-ai-management.ts', import.meta.url)),
      'utf8',
    )
    const marker = `server.get('/parent/children/:childId/bills'`
    const start = src.indexOf(marker)
    expect(start).toBeGreaterThan(-1)
    const body = src.slice(start, src.indexOf('\n  })', start))
    expect(body).toContain('checkAuthOrInternalService')
    expect(body).not.toContain('uuidParamSchema')
    expect(body).toContain('childIdParamSchema')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
