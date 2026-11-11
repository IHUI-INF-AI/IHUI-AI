// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B22:`POST /attendance/rule/rotate-qr-secret` 的权限面与越权副作用契约锁(2026-11-06 立,**全程不连库**)。
 *
 * 实测缺口(不是推测):该端点此前只被 `tests/edu-attendance-rule-crud-contract.test.ts` 现读过两格
 * (200 只回指纹 / 404 先建档),而那枚件把 `plugins/require-permission.js` 整桩替换成
 * `requirePermission: () => async () => {}`,又把 `checkAuthOrInternalService` 桩成恒过
 * ⇒ **权限面(401/403/正控成对)与"非授权主体调用后密钥是否逐字节未变"至今零判定**。
 * 本票只补这一格,不重复同族件已钉住的指纹投影与 404 文案。
 *
 * 端点逐字(注册面 apps/api/src/routes/edu-ai-management.ts,对外前缀 /api/edu-ai-management):
 *   POST /attendance/rule/rotate-qr-secret  守卫 = requireEduManage = requirePermission('edu:manage')
 *   GET  /attendance/qrcode                同一枚守卫(qrSecret 只作 HMAC key 参与签名)
 *   POST /attendance/qrcode-check-in        学生扫码(身份只取承载层注入的 request.userId)
 *
 * 两把尺子:
 * 1. 权限面四条:匿名 ⇒ 401;有凭据无 edu:manage ⇒ 403;有 edu:manage ⇒ 200(正控);
 *    roleId≥1 的管理员免权限点 ⇒ 200 且**一次都没查 RBAC**(豁免走真身 ADMIN_ROLE_ID 判序)。
 *    拒绝面一律断言 `db` 读写调用为零 ⇒ "副作用未发生"不靠口头(AGENTS §5)。
 * 2. 轮换的**下游效应**(qrSecret 唯一的真实消费者是扫码链路):
 *    出码 ⇒ 扫码成 201 ⇒ 轮换 ⇒ 同一枚旧 token 再扫码必 403 且零新增考勤 ⇒ 重新出码仍 201;
 *    以及对照面:未授权主体调用轮换被 403 之后,旧 token **仍然可用**(拒绝面不得留下"半轮换")。
 *
 * 判据零复制(§22c):本文件的"签名有效/失效"结论**全部来自生产实现自己** ——
 * import `edu-ai-management-attendance-helpers.ts` 的 `buildAttendanceQrToken` /
 * `verifyAttendanceQrToken` / `ATT_QR_FAILURE_MESSAGES`(失败码文案唯一源),测试侧不写第二份
 * HMAC、不自立失败码字面量;假库解答器只是"假数据库行为",权限/归属判据走真实
 * requirePermission → authenticate → checkAnyPermission 链(桩只答"授予与否")。
 *
 * 测试隔离铁律(AGENTS §5):禁止连生产库(PG 8810 / Redis 8811);DATABASE_URL 只是占位字面量。
 * 夹具形状抄同族既有件 tests/edu-attendance-rbac-contract.test.ts,不自造第二套基座。
 */
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
    /** RBAC 授予集:"<userId>|<permission>" 命中即 checkAnyPermission 返真(只答授予与否,不答判序) */
    permGrants: new Set<string>(),
    /** users.status 覆盖表(缺省 1=正常) */
    statusOverrides: new Map<string, number>(),
    /** 世界状态:edu_attendance_rule 行(对象引用直出,写侧 Object.assign 才落得进去) */
    rules: [] as Array<Record<string, unknown>>,
    /** 世界状态:在册报名行(eduEnrollment.status='enrolled' 口径) */
    enrollments: [] as Array<Record<string, unknown>>,
    /** 世界状态:考勤行 */
    attendance: [] as Array<Record<string, unknown>>,
    /** db.select() 调用次数 */
    reads: 0,
    /** 每次 where() 收到的谓词(归属/筛选判据的唯一可读面) */
    wheres: [] as unknown[],
    /** 每次 select() 的返回行集槽位 */
    results: [] as unknown[],
    /** 写侧调用记录(insert/update/delete/execute/transaction)—— 拒绝面必须恒空 */
    writes: [] as string[],
    /** update().set(v) 逐条留档 */
    updateSets: [] as Array<Record<string, unknown>>,
    /** insert().values(v) 逐条留档:"没多签一次到"直接对它断言 */
    insertValues: [] as Array<Record<string, unknown>>,
    /**
     * 假库分类器认不出的谓词(§0.3:取不到归属就显式点名,绝不静默回空集冒充"库里没有")。
     * 端到端流程末尾对本数组断言恒空 ⇒ "本文件确实把每条查询都答对了"是可证的。
     */
    unclassified: [] as string[],
  }
})

/** 桩 config:避免 env 校验在测试进程里 process.exit(1);不建任何真连接。 */
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
 * 假数据库:select 返回行集 = 该次 where 谓词的字面值与世界状态求交;
 * update 把 set 的键**真的写回世界状态**(否则"旧二维码在轮换后失效"这一格无从观测)。
 * 表分类指纹(逐条都有反例守卫,认不出即记进 H.unclassified):
 *   带 'enrolled'            ⇒ edu_enrollment;
 *   带 YYYY-MM-DD 日期       ⇒ edu_attendance_record(签到判重/列表);
 *   带规则表里存在的 classId ⇒ edu_attendance_rule(谓词带 'true' 时才叠 enabled 条件,
 *                             与 loadEnabledAttendanceRule 的 eq(enabled,true) 对齐;
 *                             isNull(deletedAt) 两侧都有 ⇒ 一律滤掉软删行)。
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
    'returning',
    'onConflictDoNothing',
  ] as const
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

  function answerWith(predicate: unknown): Array<Record<string, unknown>> {
    const lits = H.literalsOf(predicate)
    if (lits.includes('enrolled')) {
      return H.enrollments.filter(
        (e) => lits.includes(String(e.studentId)) && lits.includes(String(e.classId)),
      )
    }
    if (lits.some((l) => DATE_RE.test(l))) {
      const dateLit = lits.find((l) => DATE_RE.test(l)) as string
      return H.attendance.filter(
        (a) =>
          (lits.includes(String(a.id)) ||
            (lits.includes(String(a.studentId)) && lits.includes(String(a.classId)))) &&
          dateLit === String(a.date),
      )
    }
    const ruleHits = H.rules.filter(
      (r) =>
        lits.includes(String(r.classId)) &&
        r.deletedAt === null &&
        (!lits.includes('true') || r.enabled === true),
    )
    if (ruleHits.length > 0 || H.rules.some((r) => lits.includes(String(r.classId))))
      return ruleHits

    const isBindingShaped = lits.some((l) => /^[0-9a-f-]{36}$/i.test(l))
    if (!isBindingShaped) return []
    H.unclassified.push(lits.join(','))
    return []
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

  const insertChain = () => {
    H.writes.push('insert')
    let valuesArr: Array<Record<string, unknown>> = []
    const step: Record<string, unknown> = {}
    step.values = vi.fn((v: Record<string, unknown> | Array<Record<string, unknown>>) => {
      valuesArr = Array.isArray(v) ? v : [v]
      for (const one of valuesArr) H.insertValues.push(one)
      return step
    })
    step.returning = vi.fn(() => {
      const rows: Array<Record<string, unknown>> = valuesArr.map((v, i) => ({
        id: `row-new-${i}`,
        ...v,
      }))
      // 假库也要"落库":把签到行并回世界状态 ⇒ 同一学生同日的判重才会真的命中
      // (否则"新码仍可用"那一步是夹具产物,不是事实)。
      for (const row of rows) {
        if (row.studentId !== undefined && row.date !== undefined) H.attendance.push(row)
      }
      return Promise.resolve(rows)
    })
    step.onConflictDoNothing = vi.fn(() => step)
    step.onConflictDoUpdate = vi.fn(() => step)
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve([]).then(resolve, reject)
    return step
  }

  /** update:把 set 真的并进命中行,再返回行集(与真库 .returning() 同形)。 */
  const updateChain = () => {
    H.writes.push('update')
    let setVals: Record<string, unknown> = {}
    let predicate: unknown
    let hasWhere = false
    const apply = (): Array<Record<string, unknown>> => {
      if (!hasWhere) return []
      const rows = answerWith(predicate)
      for (const row of rows) Object.assign(row, setVals)
      return rows
    }
    const step: Record<string, unknown> = {}
    step.set = vi.fn((v: Record<string, unknown>) => {
      setVals = v
      H.updateSets.push(v)
      return step
    })
    step.where = vi.fn((p: unknown) => {
      predicate = p
      hasWhere = true
      return step
    })
    step.returning = vi.fn(() => Promise.resolve(apply()))
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(apply()).then(resolve, reject)
    return step
  }

  const deleteChain = () => {
    H.writes.push('delete')
    const step: Record<string, unknown> = {}
    step.where = vi.fn(() => step)
    step.returning = vi.fn(() => Promise.resolve([]))
    step.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
    return step
  }

  const txApi = {
    select: vi.fn(() => readChain()),
    insert: vi.fn(() => insertChain()),
    update: vi.fn(() => updateChain()),
    delete: vi.fn(() => deleteChain()),
  }

  return {
    db: {
      select: vi.fn(() => readChain()),
      insert: vi.fn(() => insertChain()),
      update: vi.fn(() => updateChain()),
      delete: vi.fn(() => deleteChain()),
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

/** RBAC 查询桩:只答"授予集里有没有这一条";判序/401/403/管理员豁免全走真实 require-permission。 */
vi.mock('../src/db/rbac-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    checkAnyPermission: vi.fn(async (userId: string, permissions: string[]) =>
      permissions.some((p) => H.permGrants.has(`${userId}|${p}`)),
    ),
  }
})

/** 承载层验签桩:只替"验签"这一步,身份仍走真实 authenticate(不得由测试侧手写 request.userId)。 */
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
    // 2026-11-11:生产 authenticateInner 已改 fail-closed——getTokenBlacklist() 返回 null
    // 即判 token「已吊销」⇒ 401。测试环境 createBlacklist 内部 new IORedis 恒连不上 ⇒ null
    // ⇒ 合法 token 被 401。覆盖为内存假黑名单(has 恒 false)。不回退生产 fail-closed 语义。
    createBlacklist: vi.fn(() => ({
      async has() {
        return false
      },
      async add() {},
      async revoke() {},
    })),
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
import { checkAnyPermission } from '../src/db/rbac-queries.js'
import {
  ATT_QR_FAILURE_MESSAGES,
  ATT_QR_TOKEN_TTL_MS,
  buildAttendanceQrToken,
  verifyAttendanceQrToken,
} from '../src/routes/edu-ai-management-attendance-helpers.js'

const PREFIX = '/api/edu-ai-management'
const ROTATE_PATH = '/attendance/rule/rotate-qr-secret'

const TEACHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' // edu:manage
const PLAIN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' // 已登录、无任何权限点
const ADMIN = 'ad000000-0000-4000-8000-000000000001' // roleId=1(免权限点档)
const STUDENT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' // 在册学生(扫码主体)
const STUDENT_B = 'dbe00000-0000-4000-8000-000000000002' // 另一名在册学生(新码可用性对照)
const CLASS_1 = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
/** 轮换前的旧密钥(64 位十六进制形态,与 qrSecret 列宽一致)。 */
const SECRET_OLD = 'a1b2c3'.repeat(10) + 'a1b2' + 'c3d4e5'

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
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string>
  body?: Record<string, unknown>
  as?: string
  /** 额外 claim(仅用于 roleId 档管理员:豁免判定走真身 ADMIN_ROLE_ID,不由测试侧写 request.userId) */
  asClaims?: Record<string, unknown>
}

async function call(
  o: CallOptions,
): Promise<{ statusCode: number; body: Record<string, unknown>; text: string }> {
  const app = await getApp()
  const headers: Record<string, string> = {}
  if (o.as) headers.authorization = `Bearer ${accessToken(o.as, o.asClaims ?? {})}`
  const qs = o.query ? `?${new URLSearchParams(o.query).toString()}` : ''
  const res = await app.inject({
    method: o.method,
    url: `${PREFIX}${o.path}${qs}`,
    headers,
    ...(o.body === undefined ? {} : { payload: o.body }),
  })
  let body: Record<string, unknown> = {}
  try {
    body = res.json() as Record<string, unknown>
  } catch {
    body = {}
  }
  return { statusCode: res.statusCode, body, text: res.body }
}

/** 世界状态:一条启用的规则行(密钥 = SECRET_OLD),外加该生的在册关系。 */
function scriptRuleAndRoster(): void {
  H.rules.push({
    id: 'rule-1',
    classId: CLASS_1,
    lateAfter: '08:30',
    earlyBefore: null,
    absentAfter: null,
    qrSecret: SECRET_OLD,
    enabled: true,
    deletedAt: null,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
  })
  H.enrollments.push(
    {
      id: 'enroll-1',
      studentId: STUDENT,
      classId: CLASS_1,
      status: 'enrolled',
      deletedAt: null,
    },
    {
      id: 'enroll-2',
      studentId: STUDENT_B,
      classId: CLASS_1,
      status: 'enrolled',
      deletedAt: null,
    },
  )
}

const currentSecret = (): string => String(H.rules[0]?.qrSecret)

/** 经真实出码端点取一枚可用 token(测试侧不自造载荷形状)。 */
async function issueQrToken(as: string): Promise<string> {
  const res = await call({
    method: 'GET',
    path: '/attendance/qrcode',
    query: { classId: CLASS_1 },
    as,
  })
  expect(res.statusCode, '出码端点必须真给出载荷').toBe(200)
  const payload = JSON.parse(String((res.body.data as { payload: string }).payload)) as {
    token: string
  }
  return payload.token
}

function scan(token: string, as: string = STUDENT) {
  return call({
    method: 'POST',
    path: '/attendance/qrcode-check-in',
    body: { token },
    as,
  })
}

beforeEach(() => {
  H.permGrants.clear()
  H.statusOverrides.clear()
  H.rules.length = 0
  H.enrollments.length = 0
  H.attendance.length = 0
  H.reads = 0
  H.wheres.length = 0
  H.results.length = 0
  H.writes.length = 0
  H.updateSets.length = 0
  H.insertValues.length = 0
  H.unclassified.length = 0
  vi.mocked(checkAnyPermission).mockClear()
})

afterAll(async () => {
  if (appPromise) (await appPromise).close()
  appPromise = null
})

// =============================================================================
// 1. 权限面成对(401 / 403 / 200 / 管理员免权限点档),拒绝面一律断言零副作用
// =============================================================================

describe('POST /attendance/rule/rotate-qr-secret 权限面(edu:manage)', () => {
  it('匿名 ⇒ 401,且一次数据库调用都没有:密钥逐字节未变', async () => {
    scriptRuleAndRoster()
    const res = await call({ method: 'POST', path: ROTATE_PATH, body: { classId: CLASS_1 } })
    expect(res.statusCode).toBe(401)
    expect(H.reads, '鉴权未过不得触达任何表').toBe(0)
    expect(H.writes).toEqual([])
    expect(H.updateSets).toEqual([])
    expect(currentSecret()).toBe(SECRET_OLD)
  })

  it('已登录但无 edu:manage ⇒ 403,且非授权主体调用后密钥逐字节未变', async () => {
    scriptRuleAndRoster()
    const res = await call({
      method: 'POST',
      path: ROTATE_PATH,
      body: { classId: CLASS_1 },
      as: PLAIN,
    })
    expect(res.statusCode).toBe(403)
    expect(res.body.code).toBe(403)
    expect(res.text).not.toMatch(/[0-9a-f]{64}/)
    expect(H.reads, '权限闸先于处理器').toBe(0)
    expect(H.writes).toEqual([])
    expect(H.updateSets).toEqual([])
    expect(currentSecret()).toBe(SECRET_OLD)
  })

  it('正对照:持 edu:manage ⇒ 200,新 64 位密钥真的入库且 ≠ 旧值,响应只回 6 位指纹', async () => {
    scriptRuleAndRoster()
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'POST',
      path: ROTATE_PATH,
      body: { classId: CLASS_1 },
      as: TEACHER,
    })
    expect(res.statusCode).toBe(200)
    const data = res.body.data as { rotated?: boolean; fingerprint?: string }
    expect(data.rotated).toBe(true)
    expect(data.fingerprint).toMatch(/^[0-9a-f]{6}$/)

    const written = String(H.updateSets[0]?.qrSecret)
    expect(written).toMatch(/^[0-9a-f]{64}$/)
    expect(written).not.toBe(SECRET_OLD)
    expect(written.startsWith(data.fingerprint as string)).toBe(true)
    // "入库"不是只记在 set 里:世界状态行本身已被真的推进(与上游读取同面)
    expect(currentSecret()).toBe(written)
    // 原文绝不出现在响应
    expect(res.text).not.toContain(written)
  })

  it('管理员(roleId≥1)免权限点 ⇒ 200 轮换,且一次都没查 RBAC 表(豁免走真身判序)', async () => {
    scriptRuleAndRoster()
    const res = await call({
      method: 'POST',
      path: ROTATE_PATH,
      body: { classId: CLASS_1 },
      as: ADMIN,
      asClaims: { roleId: 1 },
    })
    expect(res.statusCode).toBe(200)
    expect(vi.mocked(checkAnyPermission)).not.toHaveBeenCalled()
    expect(currentSecret()).not.toBe(SECRET_OLD)
  })

  it('无 edu:manage 且 body 非法 ⇒ 仍 403(权限先于形状闸),零查询零写', async () => {
    scriptRuleAndRoster()
    const res = await call({
      method: 'POST',
      path: ROTATE_PATH,
      body: { classId: 'not-a-uuid' },
      as: PLAIN,
    })
    expect(res.statusCode).toBe(403)
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
    expect(currentSecret()).toBe(SECRET_OLD)
  })
})

// =============================================================================
// 2. 轮换的下游效应(qrSecret 的真实消费者 = 扫码链路):旧码必须失效
// =============================================================================

describe('轮换确实把密钥换掉了:以扫码链路为观测面', () => {
  it('出码⇒扫码 201 ⇒  edu:manage 轮换 ⇒ 同一枚旧 token 扫码 403 且零新增考勤 ⇒ 重新出码仍 201', async () => {
    scriptRuleAndRoster()
    H.permGrants.add(`${TEACHER}|edu:manage`)

    const oldToken = await issueQrToken(TEACHER)
    // 正向对照:旧密钥下的码本来就好使
    const first = await scan(oldToken)
    expect(first.statusCode, `旧码首扫应成,实测 ${first.text}`).toBe(201)
    expect(first.body.data).toMatchObject({ classId: CLASS_1 })

    const rotate = await call({
      method: 'POST',
      path: ROTATE_PATH,
      body: { classId: CLASS_1 },
      as: TEACHER,
    })
    expect(rotate.statusCode).toBe(200)
    const newSecret = currentSecret()
    expect(newSecret).not.toBe(SECRET_OLD)

    // 生产实现自己判"旧码是否还可用":测试侧零复制 HMAC 判据
    expect(verifyAttendanceQrToken(oldToken, CLASS_1, SECRET_OLD, Date.now())).toBeNull()
    expect(verifyAttendanceQrToken(oldToken, CLASS_1, newSecret, Date.now())).toBe(
      'TOKEN_SIGNATURE_INVALID',
    )

    const insertsBefore = H.insertValues.length
    const replay = await scan(oldToken)
    expect(replay.statusCode).toBe(403)
    expect(replay.body.message).toBe(ATT_QR_FAILURE_MESSAGES.TOKEN_SIGNATURE_INVALID)
    expect(H.insertValues.length, '旧码被拒后不得再落一行考勤').toBe(insertsBefore)

    // 轮换没有把链路打坏:新密钥下重新出码,另一名学生扫码仍可用(判"可用"不靠夹具漏记)
    const freshToken = await issueQrToken(TEACHER)
    expect(freshToken).not.toBe(oldToken)
    expect(verifyAttendanceQrToken(freshToken, CLASS_1, newSecret, Date.now())).toBeNull()
    const insertsBeforeFresh = H.insertValues.length
    const second = await scan(freshToken, STUDENT_B)
    expect(second.statusCode, `新码应成,实测 ${second.text}`).toBe(201)
    expect(H.insertValues.length, '新码这一笔必须真落库').toBe(insertsBeforeFresh + 1)
    expect(H.insertValues[insertsBeforeFresh]?.studentId).toBe(STUDENT_B)
    expect(H.unclassified, '本流程内假库不得出现认不出的谓词').toEqual([])
  })

  it('对照面:未授权主体调用轮换被 403 之后,旧 token 仍然可用(拒绝面不得留下"半轮换")', async () => {
    scriptRuleAndRoster()
    // 出码本身要 edu:manage:先给教师授权,再让"未授权主体"由 PLAIN 充当
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const oldToken = await issueQrToken(TEACHER)
    const denied = await call({
      method: 'POST',
      path: ROTATE_PATH,
      body: { classId: CLASS_1 },
      as: PLAIN,
    })
    expect(denied.statusCode).toBe(403)
    expect(currentSecret()).toBe(SECRET_OLD)
    expect(verifyAttendanceQrToken(oldToken, CLASS_1, SECRET_OLD, Date.now())).toBeNull()
    expect(verifyAttendanceQrToken(oldToken, CLASS_1, currentSecret(), Date.now())).toBeNull()

    const after = await scan(oldToken)
    expect(after.statusCode, `密钥未变 ⇒ 旧码必须照常可用,实测 ${after.text}`).toBe(201)
  })

  it('出码载荷里绝不含密钥原文(旧密钥与新密钥都不许出仓)', async () => {
    scriptRuleAndRoster()
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      query: { classId: CLASS_1 },
      as: TEACHER,
    })
    expect(res.statusCode).toBe(200)
    expect(res.text).not.toContain(SECRET_OLD)
    expect(res.text).not.toMatch(/[0-9a-f]{64}/)
    // 载荷里的 token 确实是用该班密钥签的(把"出码↔扫码"两端钉在同一条口径上)
    const payload = JSON.parse(String((res.body.data as { payload: string }).payload)) as {
      token: string
    }
    const built = buildAttendanceQrToken(CLASS_1, SECRET_OLD, Date.now(), ATT_QR_TOKEN_TTL_MS)
    expect(built.token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(verifyAttendanceQrToken(payload.token, CLASS_1, SECRET_OLD, Date.now())).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
