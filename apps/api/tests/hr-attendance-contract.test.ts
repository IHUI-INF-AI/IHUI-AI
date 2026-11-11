// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 人事考勤路由契约锁(2026-11-10 立,**全程不连库**)。
 *
 * 立因:2026-11-09 落地的 apps/api/src/routes/hr-attendance.ts 有 13 个端点却零单测,
 * 权限两档(hr:attendance:view / hr:attendance:manage)与参数校验从没人验过。
 *
 * 形状抄同族既有件 tests/edu-attendance-rbac-contract.test.ts(config/db/rbac/auth 桩基座),
 * 不自造第二套夹具;判定逻辑零复制 —— 权限/归属判据全部走真实 requirePermission →
 * authenticate → checkAnyPermission,RBAC 桩只答"该用户是否被授予该权限点"。
 * 假数据库只提供"空世界状态 + 写链记账"这一层底座行为(非生产判据副本)。
 *
 * 锁的端点(内容锚点,不写行号;注册面 = apps/api/src/routes/hr-attendance.ts):
 *   读面(hr:attendance:view):GET /departments · /employees · /attendance/rule ·
 *     /attendance/records · /attendance/stats · /leave
 *   写面(hr:attendance:manage):POST /departments · /employees · /attendance/backfill
 *     · PUT /attendance/rule · PUT /leave/:id/approve
 *   登录面(requireAuth):POST /attendance/check-in · /attendance/check-out · /leave
 *   参数面:非法日期 / 缺 departmentId / 非法 uuid ⇒ 400 且零副作用
 *   业务面:空名册签到 ⇒ 404 not_employed;空记录签退 ⇒ 404;请假单不存在 ⇒ 404
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'

/** 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。 */
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
  return {
    testSecret,
    sigOf: (headerAndPayload: string) =>
      `${fnv1a(`${headerAndPayload}.${testSecret}`)}${fnv1a(`${headerAndPayload}.reverse`)}`,
    /** RBAC 授予集:"<userId>|<permission>" 命中即 checkAnyPermission 返真 */
    permGrants: new Set<string>(),
    /** users.status 覆盖表(缺省 1=正常) */
    statusOverrides: new Map<string, number>(),
    /** 写侧调用记录 —— 越权用例必须恒空 */
    writes: [] as string[],
    /** insert().values(v) 逐条留档 */
    insertValues: [] as Array<Record<string, unknown>>,
    /** update().set(v) 逐条留档 */
    updateSets: [] as Array<Record<string, unknown>>,
    /** 按表名预置的读结果(缺省空世界状态) */
    rowsByTable: new Map<string, unknown[]>(),
  }
})

/** 桩掉 config:避免 env 校验在测试进程里 process.exit(1);不建任何真连接。 */
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
 * 假数据库:空世界状态 —— select 链恒解析 [],update/delete returning 恒 [],insert returning
 * 回显 values。写侧一律记账,供越权用例断言"副作用没发生"。
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

  const tableNameOf = (t: unknown): string => {
    const rec = t as Record<PropertyKey, unknown> | null
    if (!rec || typeof rec !== 'object') return 'unknown'
    const bySym = rec[Symbol.for('drizzle:Name')]
    if (typeof bySym === 'string') return bySym
    const byUnder = (rec as { _?: { name?: unknown } })._?.name
    if (typeof byUnder === 'string') return byUnder
    return 'unknown'
  }

  const readChain = () => {
    const step: Record<string, unknown> = {}
    let table = 'unknown'
    for (const m of CHAIN_METHODS) {
      step[m] = vi.fn((arg?: unknown) => {
        if (m === 'from') table = tableNameOf(arg)
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(H.rowsByTable.get(table) ?? []).then(resolve, reject)
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
    step.returning = vi.fn(() =>
      Promise.resolve(valuesArr.map((v, i) => ({ id: `row-new-${i}`, ...v }))),
    )
    step.onConflictDoNothing = vi.fn(() => step)
    step.onConflictDoUpdate = vi.fn(() => step)
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve([]).then(resolve, reject)
    return step
  }

  const updateChain = () => {
    H.writes.push('update')
    const step: Record<string, unknown> = {}
    step.set = vi.fn((v: Record<string, unknown>) => {
      H.updateSets.push(v)
      return step
    })
    step.where = vi.fn(() => step)
    step.returning = vi.fn(() => Promise.resolve([]))
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve([]).then(resolve, reject)
    return step
  }

  const deleteChain = () => {
    H.writes.push('delete')
    const step: Record<string, unknown> = {}
    step.where = vi.fn(() => step)
    step.returning = vi.fn(() => Promise.resolve([]))
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

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  setFastify: vi.fn(),
  serializeErrorFields: vi.fn((m: unknown) => m),
}))

/** RBAC 查询桩:只答"授予集里有没有这一条",判序/豁免/401-403 语义全走真实 require-permission。 */
vi.mock('../src/db/rbac-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    checkAnyPermission: vi.fn(async (userId: string, permissions: string[]) =>
      permissions.some((p) => H.permGrants.has(`${userId}|${p}`)),
    ),
  }
})

/** 承载层验签桩(与 edu-attendance-rbac-contract.test.ts 同形):只替"验签"这一步。 */
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

import { hrAttendanceRoutes } from '../src/routes/hr-attendance.js'

const PREFIX = '/api/hr-attendance'

const MANAGER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' // hr:attendance:manage
const VIEWER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' // hr:attendance:view
const PLAIN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' // 无任何权限点
const STAFF = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' // 仅登录,无 HR 权限点

const EMP_ID = '11111111-1111-4111-8111-111111111111'
const DEPT_ID = '22222222-2222-4222-8222-222222222222'
const LEAVE_ID = '33333333-3333-4333-8333-333333333333'
const DATE = '2026-03-02'

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
      const statusCode =
        typeof (err as { statusCode?: number }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    await app.register(hrAttendanceRoutes, { prefix: PREFIX })
    await app.ready()
    appPromise = Promise.resolve(app)
  }
  return appPromise
}

interface CallOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: Record<string, unknown>
  as?: string
}

async function call(
  o: CallOptions,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const app = await getApp()
  const headers: Record<string, string> = {}
  if (o.as) headers.authorization = `Bearer ${accessToken(o.as)}`
  const res = await app.inject({
    method: o.method,
    url: `${PREFIX}${o.path}`,
    headers,
    ...(o.body === undefined ? {} : { payload: o.body }),
  })
  let body: Record<string, unknown> = {}
  try {
    body = res.json() as Record<string, unknown>
  } catch {
    body = { raw: res.body }
  }
  return { statusCode: res.statusCode, body }
}

beforeEach(() => {
  H.permGrants.clear()
  H.statusOverrides.clear()
  H.writes.length = 0
  H.insertValues.length = 0
  H.updateSets.length = 0
  H.rowsByTable.clear()
})

afterAll(async () => {
  if (appPromise) (await appPromise).close()
  appPromise = null
})

// =============================================================================
// 1. 写面权限三条(无 token⇒401 / 无 manage⇒403 / 有 manage⇒正控通过)
//    401/403 同时断言零副作用
// =============================================================================

interface WriteCase {
  name: string
  method: 'POST' | 'PUT'
  path: string
  body: Record<string, unknown>
  okStatus: number
  /** 正控前置:预置读结果(仅供写入后回读类端点) */
  seed?: () => void
}

const WRITE_CASES: WriteCase[] = [
  {
    name: 'POST /departments',
    method: 'POST',
    path: '/departments',
    body: { name: '研发部', sortOrder: 1 },
    okStatus: 201,
  },
  {
    name: 'POST /employees',
    method: 'POST',
    path: '/employees',
    body: { employeeNo: 'E001', name: '张三', departmentId: DEPT_ID },
    okStatus: 201,
  },
  {
    name: 'PUT /attendance/rule',
    method: 'PUT',
    path: '/attendance/rule',
    body: { departmentId: DEPT_ID, lateAfter: '09:00', workdays: 31 },
    okStatus: 200,
    // upsert 走"写入后回读安全投影",需要预置一行规则供回读命中
    seed: () => {
      H.rowsByTable.set('hr_attendance_rule', [
        {
          id: 'rule-seed-1',
          departmentId: DEPT_ID,
          lateAfter: '09:00',
          earlyBefore: null,
          absentAfter: null,
          workdays: 31,
          enabled: true,
          qrSecret: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ])
    },
  },
  {
    name: 'POST /attendance/backfill',
    method: 'POST',
    path: '/attendance/backfill',
    body: { backfillDays: 1 },
    okStatus: 200,
  },
  {
    name: 'PUT /leave/:id/approve',
    method: 'PUT',
    path: `/leave/${LEAVE_ID}/approve`,
    body: { decision: 'approved' },
    okStatus: 404, // 空世界状态 ⇒ 请假单不存在;403 面不受影响,正控只断言"没被权限门拦"
  },
]

describe('写面权限(hr:attendance:manage)', () => {
  for (const c of WRITE_CASES) {
    describe(c.name, () => {
      it('无 token ⇒ 401,且零副作用', async () => {
        const res = await call({ method: c.method, path: c.path, body: c.body })
        expect(res.statusCode).toBe(401)
        expect(H.writes).toEqual([])
        expect(H.insertValues).toEqual([])
      })

      it('已登录但无 hr:attendance:manage ⇒ 403,且零副作用', async () => {
        const res = await call({ method: c.method, as: PLAIN, path: c.path, body: c.body })
        expect(res.statusCode).toBe(403)
        expect(res.body.code).toBe(403)
        expect(H.writes).toEqual([])
        expect(H.insertValues).toEqual([])
      })

      it('仅持 hr:attendance:view(两档独立) ⇒ 403', async () => {
        H.permGrants.add(`${VIEWER}|hr:attendance:view`)
        const res = await call({ method: c.method, as: VIEWER, path: c.path, body: c.body })
        expect(res.statusCode).toBe(403)
        expect(H.writes).toEqual([])
      })

      it('持有 hr:attendance:manage ⇒ 通过权限门', async () => {
        H.permGrants.add(`${MANAGER}|hr:attendance:manage`)
        c.seed?.()
        const res = await call({ method: c.method, as: MANAGER, path: c.path, body: c.body })
        if (res.statusCode >= 500) {
          // 夹具缺形状时先暴露真实异常体,避免用弱断言掩盖 5xx(修夹具,不放宽判据)
          expect.fail(`正控意外 5xx:${JSON.stringify(res.body)}`)
        }
        expect(res.statusCode).toBe(c.okStatus)
        expect([401, 403]).not.toContain(res.statusCode)
      })
    })
  }
})

// =============================================================================
// 2. 读面权限三条(无 token⇒401 / 无 view⇒403 / 有 view⇒200 统一信封)
// =============================================================================

const READ_CASES: Array<{ name: string; path: string }> = [
  { name: 'GET /departments', path: '/departments' },
  { name: 'GET /employees', path: '/employees' },
  { name: 'GET /attendance/rule', path: `/attendance/rule?departmentId=${DEPT_ID}` },
  { name: 'GET /attendance/records', path: '/attendance/records' },
  { name: 'GET /attendance/stats', path: '/attendance/stats' },
  { name: 'GET /leave', path: '/leave' },
]

describe('读面权限(hr:attendance:view)', () => {
  for (const c of READ_CASES) {
    describe(c.name, () => {
      it('无 token ⇒ 401', async () => {
        const res = await call({ method: 'GET', path: c.path })
        expect(res.statusCode).toBe(401)
      })

      it('已登录但无 hr:attendance:view ⇒ 403', async () => {
        const res = await call({ method: 'GET', as: PLAIN, path: c.path })
        expect(res.statusCode).toBe(403)
      })

      it('持有 hr:attendance:view ⇒ 200 且走统一信封(code=0)', async () => {
        H.permGrants.add(`${VIEWER}|hr:attendance:view`)
        const res = await call({ method: 'GET', as: VIEWER, path: c.path })
        expect(res.statusCode).toBe(200)
        expect(res.body.code).toBe(0)
      })

      it('仅持 hr:attendance:manage(管理含读)⇒ 200', async () => {
        H.permGrants.add(`${MANAGER}|hr:attendance:manage`)
        const res = await call({ method: 'GET', as: MANAGER, path: c.path })
        expect(res.statusCode).toBe(200)
        expect(res.body.code).toBe(0)
      })
    })
  }
})

// =============================================================================
// 3. 登录面(requireAuth):签到/签退/提交请假 —— 权限点不能替代登录
// =============================================================================

describe('登录面(requireAuth)', () => {
  const AUTH_CASES: Array<{ name: string; path: string; body: Record<string, unknown> }> = [
    {
      name: 'POST /attendance/check-in',
      path: '/attendance/check-in',
      body: {
        employeeId: EMP_ID,
        departmentId: DEPT_ID,
        date: DATE,
        checkInMethod: 'self',
      },
    },
    {
      name: 'POST /attendance/check-out',
      path: '/attendance/check-out',
      body: {
        employeeId: EMP_ID,
        departmentId: DEPT_ID,
        date: DATE,
        checkOutTimeRaw: '2026-03-02T10:00:00+08:00',
      },
    },
    {
      name: 'POST /leave',
      path: '/leave',
      body: {
        employeeId: EMP_ID,
        departmentId: DEPT_ID,
        leaveType: 'sick',
        startDate: DATE,
        endDate: DATE,
        totalDays: 1,
        reason: '感冒',
      },
    },
  ]

  for (const c of AUTH_CASES) {
    describe(c.name, () => {
      it('无 token ⇒ 401,且零副作用', async () => {
        const res = await call({ method: 'POST', path: c.path, body: c.body })
        expect(res.statusCode).toBe(401)
        expect(H.writes).toEqual([])
        expect(H.insertValues).toEqual([])
      })

      it('已登录(即使无 HR 权限点)⇒ 不被权限门拦,落业务分支', async () => {
        const res = await call({ method: 'POST', as: STAFF, path: c.path, body: c.body })
        expect([401, 403]).not.toContain(res.statusCode)
      })
    })
  }

  it('POSITIVE-CONTROL:空名册签到 ⇒ 404(not_employed),不是 500', async () => {
    const res = await call({
      method: 'POST',
      as: STAFF,
      path: '/attendance/check-in',
      body: { employeeId: EMP_ID, departmentId: DEPT_ID, date: DATE, checkInMethod: 'self' },
    })
    expect(res.statusCode).toBe(404)
    expect(String(res.body.message ?? '')).toContain('在职名册')
  })

  it('NEGATIVE-CONTROL:签到非法日期格式 ⇒ 400,且零写入', async () => {
    const res = await call({
      method: 'POST',
      as: STAFF,
      path: '/attendance/check-in',
      body: {
        employeeId: EMP_ID,
        departmentId: DEPT_ID,
        date: '2026/03/02',
        checkInMethod: 'self',
      },
    })
    expect(res.statusCode).toBe(400)
    expect(H.insertValues).toEqual([])
  })

  it('NEGATIVE-CONTROL:签到 checkInMethod 枚举外 ⇒ 400', async () => {
    const res = await call({
      method: 'POST',
      as: STAFF,
      path: '/attendance/check-in',
      body: { employeeId: EMP_ID, departmentId: DEPT_ID, date: DATE, checkInMethod: 'face' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('空记录签退 ⇒ 404(no_record)', async () => {
    const res = await call({
      method: 'POST',
      as: STAFF,
      path: '/attendance/check-out',
      body: {
        employeeId: EMP_ID,
        departmentId: DEPT_ID,
        date: DATE,
        checkOutTimeRaw: '2026-03-02T10:00:00+08:00',
      },
    })
    expect(res.statusCode).toBe(404)
    expect(String(res.body.message ?? '')).toContain('签到记录')
  })
})

// =============================================================================
// 4. 参数面:非法 uuid / 缺必填 / 负数天数 ⇒ 400 且零副作用
// =============================================================================

describe('参数校验面', () => {
  beforeEach(() => {
    H.permGrants.add(`${MANAGER}|hr:attendance:manage`)
  })

  it('GET /attendance/rule 缺 departmentId ⇒ 400', async () => {
    const res = await call({ method: 'GET', as: MANAGER, path: '/attendance/rule' })
    expect(res.statusCode).toBe(400)
  })

  it('POST /employees 非法 departmentId ⇒ 400', async () => {
    const res = await call({
      method: 'POST',
      as: MANAGER,
      path: '/employees',
      body: { employeeNo: 'E002', name: '李四', departmentId: 'not-a-uuid' },
    })
    expect(res.statusCode).toBe(400)
    expect(H.insertValues).toEqual([])
  })

  it('PUT /leave/:id/approve 非法 uuid ⇒ 400', async () => {
    const res = await call({
      method: 'PUT',
      as: MANAGER,
      path: '/leave/not-a-uuid/approve',
      body: { decision: 'approved' },
    })
    expect(res.statusCode).toBe(400)
    expect(H.updateSets).toEqual([])
  })

  it('POST /leave totalDays 为负 ⇒ 400', async () => {
    const res = await call({
      method: 'POST',
      as: MANAGER,
      path: '/leave',
      body: {
        employeeId: EMP_ID,
        departmentId: DEPT_ID,
        leaveType: 'sick',
        startDate: DATE,
        endDate: DATE,
        totalDays: -1,
        reason: '感冒',
      },
    })
    expect(res.statusCode).toBe(400)
    expect(H.insertValues).toEqual([])
  })

  it('POST /departments 空名 ⇒ 400', async () => {
    const res = await call({
      method: 'POST',
      as: MANAGER,
      path: '/departments',
      body: { name: '' },
    })
    expect(res.statusCode).toBe(400)
    expect(H.insertValues).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
