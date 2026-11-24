// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 人事→财务交割路由契约锁(2026-11-13 立,**全程不连库**)。
 *
 * 立因:apps/api/src/routes/hr-payroll.ts 的 POST /handoff(算薪→财务记账 AI 联动)
 * 是财务动作,权限两档与状态门/借贷平衡判据必须锁死,否则一个越权或未审批的交割
 * 就能产出错误凭证。
 *
 * 形状抄同族 tests/hr-attendance-contract.test.ts(config/db/rbac/auth 桩基座),
 * 不自造第二套夹具。判定逻辑零复制:权限走真实 requirePermission →
 * authenticate → checkAnyPermission;状态门/借贷平衡走真实
 * buildPayrollHandoffVoucher(只替 db 的"读",计算逻辑全真)。
 *
 * 锁的面:
 *   权限面(hr:payroll:manage):无 token⇒401 / 无权限⇒403(零副作用)
 *   参数面:非法 periodMonth⇒400;周期不存在⇒404
 *   状态面:draft/calculated⇒409 PAYROLL_NOT_APPROVED;空明细⇒409 PAYROLL_NO_ITEMS
 *   业务面:approved+明细⇒200 且借贷平衡 + 计提/发放分录齐全 + 逐项勾稽
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'

/** 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。 */
const H = vi.hoisted(() => {
  const fnv1a = (s: string): string => {
    let h = 0x811c9dc5
    for (let h_i = 0; h_i < s.length; h_i += 1) {
      h ^= s.charCodeAt(h_i)
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
    /** 按表名预置的读结果(缺省空世界状态) */
    rowsByTable: new Map<string, unknown[]>(),
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

/** 假数据库:同族夹具 —— select 链按 from 表名回预置读结果,写侧一律记账。 */
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

  const writeChain = (kind: string) => {
    H.writes.push(kind)
    const step: Record<string, unknown> = {}
    for (const m of [
      'values',
      'set',
      'where',
      'returning',
      'onConflictDoNothing',
      'onConflictDoUpdate',
    ]) {
      step[m] = vi.fn(() => step)
    }
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

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  setFastify: vi.fn(),
  serializeErrorFields: vi.fn((m: unknown) => m),
}))

vi.mock('../src/db/rbac-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    checkAnyPermission: vi.fn(async (userId: string, permissions: string[]) =>
      permissions.some((p) => H.permGrants.has(`${userId}|${p}`)),
    ),
  }
})

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

import { hrPayrollRoutes } from '../src/routes/hr-payroll.js'

const PREFIX = '/api/hr-payroll'

const MANAGER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' // hr:payroll:manage
const PLAIN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' // 无任何权限点

const PERIOD_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

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
    await app.register(hrPayrollRoutes, { prefix: PREFIX })
    await app.ready()
    appPromise = Promise.resolve(app)
  }
  return appPromise
}

async function call(body: Record<string, unknown>, as?: string) {
  const app = await getApp()
  const headers: Record<string, string> = {}
  if (as) headers.authorization = `Bearer ${accessToken(as)}`
  const res = await app.inject({
    method: 'POST',
    url: `${PREFIX}/handoff`,
    headers,
    ...(body === undefined ? {} : { payload: body }),
  })
  let parsed: Record<string, unknown> = {}
  try {
    parsed = res.json() as Record<string, unknown>
  } catch {
    parsed = { raw: res.body }
  }
  return { statusCode: res.statusCode, body: parsed }
}

/** 导出端点专用:返回原始响应(二进制 xlsx,不能走 json 解析)。 */
async function callExport(body: Record<string, unknown>, as?: string) {
  const app = await getApp()
  const headers: Record<string, string> = {}
  if (as) headers.authorization = `Bearer ${accessToken(as)}`
  const res = await app.inject({
    method: 'POST',
    url: `${PREFIX}/handoff/export`,
    headers,
    ...(body === undefined ? {} : { payload: body }),
  })
  // 成功时 payload 是二进制 xlsx(json() 会解析失败);报错时是 JSON(带 errorCode)。
  let parsed: Record<string, unknown> = {}
  try {
    parsed = res.json() as Record<string, unknown>
  } catch {
    parsed = {}
  }
  return { statusCode: res.statusCode, headers: res.headers, payload: res.rawPayload, body: parsed }
}

/** 预置一个 approved 周期 + 三员工工资单(勾稽样例:净额口径逐条自洽)。 */
function seedApprovedWithItems(): void {
  H.rowsByTable.set('hr_payroll_period', [{ id: PERIOD_ID, status: 'approved' }])
  H.rowsByTable.set('hr_payroll_item', [
    {
      grossPay: '10000.00',
      insurancePersonal: '800.00',
      housingFundPersonal: '500.00',
      incomeTax: '150.00',
      netPay: '8550.00',
    },
    {
      grossPay: '8000.00',
      insurancePersonal: '640.00',
      housingFundPersonal: '400.00',
      incomeTax: '80.00',
      netPay: '6880.00',
    },
    {
      grossPay: '12000.00',
      insurancePersonal: '960.00',
      housingFundPersonal: '600.00',
      incomeTax: '250.00',
      netPay: '10190.00',
    },
  ])
}

beforeEach(() => {
  H.permGrants.clear()
  H.statusOverrides.clear()
  H.writes.length = 0
  H.rowsByTable.clear()
})

afterAll(async () => {
  if (appPromise) (await appPromise).close()
  appPromise = null
})

describe('POST /api/hr-payroll/handoff 财务交割凭证', () => {
  it('无 token ⇒ 401 且零副作用', async () => {
    const { statusCode } = await call({ periodMonth: '2026-10' })
    expect(statusCode).toBe(401)
    expect(H.writes).toEqual([])
  })

  it('登录但无 hr:payroll:manage ⇒ 403 且零副作用', async () => {
    const { statusCode } = await call({ periodMonth: '2026-10' }, PLAIN)
    expect(statusCode).toBe(403)
    expect(H.writes).toEqual([])
  })

  it('非法 periodMonth ⇒ 400(格式不合法的月份字符串)', async () => {
    H.permGrants.add(`${MANAGER}|hr:payroll:manage`)
    const { statusCode, body } = await call({ periodMonth: 'abc' }, MANAGER)
    expect(statusCode).toBe(400)
    expect(body.message).toContain('YYYY-MM')
  })

  it('周期不存在 ⇒ 404 PAYROLL_PERIOD_NOT_FOUND(errorCode 经 errorCodeResponses 到端上)', async () => {
    H.permGrants.add(`${MANAGER}|hr:payroll:manage`)
    // rowsByTable 空 ⇒ period 表查不到
    const { statusCode, body } = await call({ periodMonth: '2026-10' }, MANAGER)
    expect(statusCode).toBe(404)
    expect(body.errorCode).toBe('PAYROLL_PERIOD_NOT_FOUND')
  })

  it('周期 draft ⇒ 409 PAYROLL_NOT_APPROVED(未审批不得交割)', async () => {
    H.permGrants.add(`${MANAGER}|hr:payroll:manage`)
    H.rowsByTable.set('hr_payroll_period', [{ id: PERIOD_ID, status: 'draft' }])
    const { statusCode, body } = await call({ periodMonth: '2026-10' }, MANAGER)
    expect(statusCode).toBe(409)
    expect(body.errorCode).toBe('PAYROLL_NOT_APPROVED')
  })

  it('calculated ⇒ 409 PAYROLL_NOT_APPROVED(仅 calculated 未审账同样拒绝)', async () => {
    H.permGrants.add(`${MANAGER}|hr:payroll:manage`)
    H.rowsByTable.set('hr_payroll_period', [{ id: PERIOD_ID, status: 'calculated' }])
    const { statusCode, body } = await call({ periodMonth: '2026-10' }, MANAGER)
    expect(statusCode).toBe(409)
    expect(body.errorCode).toBe('PAYROLL_NOT_APPROVED')
  })

  it('approved 但无明细 ⇒ 409 PAYROLL_NO_ITEMS', async () => {
    H.permGrants.add(`${MANAGER}|hr:payroll:manage`)
    H.rowsByTable.set('hr_payroll_period', [{ id: PERIOD_ID, status: 'approved' }])
    // hr_payroll_item 空
    const { statusCode, body } = await call({ periodMonth: '2026-10' }, MANAGER)
    expect(statusCode).toBe(409)
    expect(body.errorCode).toBe('PAYROLL_NO_ITEMS')
  })

  it('approved + 明细 ⇒ 200,借贷平衡,计提+发放分录齐全,逐项勾稽', async () => {
    H.permGrants.add(`${MANAGER}|hr:payroll:manage`)
    seedApprovedWithItems()
    const { statusCode, body } = await call({ periodMonth: '2026-10' }, MANAGER)
    expect(statusCode).toBe(200)

    const data = body.data as {
      periodMonth: string
      periodStatus: string
      headcount: number
      balanced: boolean
      entries: Array<{ group: string; account: string; direction: string; amount: string }>
      totals: Record<string, string>
    }
    expect(data.periodMonth).toBe('2026-10')
    expect(data.periodStatus).toBe('approved')
    expect(data.headcount).toBe(3)
    expect(data.balanced).toBe(true)

    // 汇总勾稽:应发 30000 实发 25620 社保 2400 公积金 1500 个税 480
    expect(data.totals.grossPay).toBe('30000.00')
    expect(data.totals.netPay).toBe('25620.00')
    expect(data.totals.insurancePersonal).toBe('2400.00')
    expect(data.totals.housingFundPersonal).toBe('1500.00')
    expect(data.totals.incomeTax).toBe('480.00')

    // 计提组:借=贷=30000
    const accrue = data.entries.filter((e) => e.group === '计提')
    expect(accrue).toHaveLength(2)
    expect(accrue.find((e) => e.account === '管理费用')?.direction).toBe('借')
    expect(accrue.find((e) => e.account === '应付职工薪酬')?.direction).toBe('贷')

    // 发放组:借 应付职工薪酬 30000 = 贷(银行存款 25620 + 社保 2400 + 公积金 1500 + 个税 480)
    const pay = data.entries.filter((e) => e.group === '发放')
    const debit = pay.filter((e) => e.direction === '借').reduce((s, e) => s + Number(e.amount), 0)
    const credit = pay.filter((e) => e.direction === '贷').reduce((s, e) => s + Number(e.amount), 0)
    expect(Math.abs(debit - credit)).toBeLessThan(0.005)
    expect(debit).toBeCloseTo(30000, 2)
    // 四个贷方科目齐全
    const creditAccounts = pay.filter((e) => e.direction === '贷').map((e) => e.account)
    expect(creditAccounts).toContain('银行存款')
    expect(creditAccounts).toContain('其他应付款—社保个人')
    expect(creditAccounts).toContain('其他应付款—公积金个人')
    expect(creditAccounts).toContain('应交税费—应交个人所得税')
  })

  it('纯产出:全程零写副作用(不落库、不改账)', async () => {
    H.permGrants.add(`${MANAGER}|hr:payroll:manage`)
    seedApprovedWithItems()
    await call({ periodMonth: '2026-10' }, MANAGER)
    expect(H.writes).toEqual([])
  })

  // ── 导出端点 /handoff/export(Excel 凭证单) ─────────────────────────────
  it('导出:无 token ⇒ 401 且零副作用', async () => {
    const { statusCode } = await callExport({ periodMonth: '2026-10' })
    expect(statusCode).toBe(401)
    expect(H.writes).toEqual([])
  })

  it('导出:无 hr:payroll:manage ⇒ 403 且零副作用', async () => {
    const { statusCode } = await callExport({ periodMonth: '2026-10' }, PLAIN)
    expect(statusCode).toBe(403)
    expect(H.writes).toEqual([])
  })

  it('导出:draft ⇒ 409 PAYROLL_NOT_APPROVED(与 /handoff 同状态门)', async () => {
    H.permGrants.add(`${MANAGER}|hr:payroll:manage`)
    H.rowsByTable.set('hr_payroll_period', [{ id: PERIOD_ID, status: 'draft' }])
    const { statusCode, body } = await callExport({ periodMonth: '2026-10' }, MANAGER)
    expect(statusCode).toBe(409)
    expect((body as { errorCode?: string }).errorCode).toBe('PAYROLL_NOT_APPROVED')
    expect(H.writes).toEqual([])
  })

  it('导出:approved ⇒ 200,返回 xlsx 二进制,带归档文件名头', async () => {
    H.permGrants.add(`${MANAGER}|hr:payroll:manage`)
    seedApprovedWithItems()
    const { statusCode, headers, payload } = await callExport({ periodMonth: '2026-10' }, MANAGER)
    expect(statusCode).toBe(200)
    const ct = String(headers['content-type'] ?? '')
    expect(ct).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const cd = String(headers['content-disposition'] ?? '')
    expect(cd).toContain('attachment')
    expect(cd).toContain('payroll-handoff-2026-10.xlsx')
    // xlsx 本质是 zip:xlsx 二进制以 PK zip 魔数开头
    const buf = Buffer.from(payload)
    expect(buf.length).toBeGreaterThan(0)
    expect(buf[0]).toBe(0x50) // 'P'
    expect(buf[1]).toBe(0x4b) // 'K'
    // 纯产出:导出全程零写副作用
    expect(H.writes).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
