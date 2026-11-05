// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B70① 请假审批 → 考勤联动契约锁(2026-11-06 立,**全程不连库**:PG 8810 / Redis 8811 一条都不碰)。
 *
 * 立因(现读,不是推测):台账 B70 的三条写路径中,「批量点名」由
 * tests/edu-attendance-rbac-contract.test.ts 与 tests/edu-attendance-status-judgment-contract.test.ts
 * 钉住,「考勤导出」由同族件钉住读面;而 `PUT /leave/:id/approve` 此前只被
 * edu-attendance-rbac-contract.test.ts 打过**权限轴**(401/403/正控),它承诺的行为轴
 * ——「审批通过同事务按区间幂等落 leave」——全仓零判定:`attendanceSynced` 这个键在
 * apps/api/tests 里的引用数实测为 **0**(git grep 现读),即"审批过了、考勤到底有没有落行"
 * 从来没有被任何用例看过一眼。本文件补的就是这一格,不重复权限轴的成对用例。
 *
 * 锁格(正向 + 反向成对):
 *   A. 同事务:整条链只开**一枚**事务,考勤侧零笔顶层(db)写 ⇒ "单已 approved 而考勤没落"
 *      的半状态在结构上不成立;
 *   B. 按区间逐日:三天区间 ⇒ 三行 status='leave',日期逐字节等于区间内的每一天,
 *      学生/班级身份一律来自**被审请假单**(不信客户端自报);
 *   C. 幂等:该日已有非 leave 行 ⇒ 不 insert 也不 update(教师手判的迟到不被假单抹掉);
 *      该日已是 leave 行 ⇒ 走 update 且 where 带 status='leave' 前置(源码切片锁);
 *   D. 计数诚实性(blocking 门 134):created/updated/skipped 只认 `.returning()` 回库集合,
 *      撞唯一索引没落库时 created 必须是 0 而不是"打算写的 3";
 *   E. 反向:rejected / 非待审批 / 单据不存在 / 区间过大 / 落库抛错 ⇒ 分别 200·零考勤写 /
 *      400 / 404 / 400 / 500,四型都不给"成功"读数。
 *
 * 夹具形态抄同目录 tests/edu-attendance-status-judgment-contract.test.ts 的链式桩基座,
 * 不自造第二套;判据零复制(§22c):本文件不内联任何日期加减或阈值比较,
 * 期望日期一律写成字面量,被审面的身份一律走 `paginate`/路由自己的取数路径。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'
import { eduAttendanceRecord, eduLeaveRequest } from '@ihui/database'

const CLASS_ID = 'aaaaaaaa-4111-8111-8111-111111111111'
const OTHER_CLASS_ID = 'aaaaaaaa-9999-8999-9999-999999999999'
const STUDENT_A = 'bbbbbbbb-4222-8222-8222-222222222222'
const OTHER_STUDENT_ID = 'bbbbbbbb-9999-8999-9999-999999999999'
const TEACHER = 'dddddddd-4444-8444-8444-444444444444'
const OTHER_USER_ID = 'dddddddd-9999-8999-9999-999999999999'
const LEAVE_ID = 'eeeeeeee-4555-8555-8555-555555555555'

/** 一枚 recorder = 一个"库面"(db 顶层 / tx 事务内),两侧分开计数才能证明写都进了事务。 */
const W = vi.hoisted(() => {
  const mkRec = () => ({
    selectCalls: 0,
    insertCalls: 0,
    updateCalls: 0,
    /** 每次 .from(table) 记一份表身份,用于"某张表一次都没被查过"的断言 */
    selectTables: [] as unknown[],
    selectQueue: [] as unknown[][],
    insertQueue: [] as unknown[][],
    updateQueue: [] as unknown[][],
    insertValues: [] as Record<string, unknown>[],
    updateSets: [] as Record<string, unknown>[],
  })
  return { db: mkRec(), tx: mkRec(), txRuns: 0, failInsert: false }
})

/**
 * 链式 thenable 假库:select/insert/update 各自 pop 各自队列、各自计数;
 * `transaction(fn)` 把**另一枚 recorder** 当 tx 交出去,于是"顶层有没有写"是可量的事实。
 */
vi.mock('../src/db/index.js', () => {
  const chain = (rec: (typeof W)['db'], kind: 'select' | 'insert' | 'update') => {
    const step: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'set',
      'returning',
      'values',
      'onConflictDoNothing',
      'onConflictDoUpdate',
      'orderBy',
      'limit',
      'offset',
      'groupBy',
      'having',
    ]) {
      step[m] = vi.fn((arg?: unknown) => {
        if (kind === 'select' && m === 'from') rec.selectTables.push(arg)
        if (kind === 'insert' && m === 'values') {
          const arr = Array.isArray(arg) ? arg : [arg ?? {}]
          for (const one of arr) rec.insertValues.push(one as Record<string, unknown>)
        }
        if (kind === 'update' && m === 'set')
          rec.updateSets.push((arg ?? {}) as Record<string, unknown>)
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      if (kind === 'insert' && W.failInsert) {
        return Promise.reject(new Error('FAKE_DB_BOOM')).then(resolve, reject)
      }
      const q =
        kind === 'select' ? rec.selectQueue : kind === 'insert' ? rec.insertQueue : rec.updateQueue
      return Promise.resolve(q.length > 0 ? (q.shift() ?? []) : []).then(resolve, reject)
    }
    return step
  }
  const mk = (rec: (typeof W)['db'], scope: 'db' | 'tx') => {
    const dbMock = {
      select: vi.fn(() => {
        rec.selectCalls += 1
        return chain(rec, 'select')
      }),
      insert: vi.fn(() => {
        rec.insertCalls += 1
        return chain(rec, 'insert')
      }),
      update: vi.fn(() => {
        rec.updateCalls += 1
        return chain(rec, 'update')
      }),
      delete: vi.fn(() => chain(rec, 'select')),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => {
        if (scope === 'db') W.txRuns += 1
        return fn(mk(W.tx, 'tx'))
      }),
    }
    return dbMock
  }
  const dbMock = mk(W.db, 'db')
  return { db: dbMock, dbRead: dbMock, dbWriter: dbMock, dbClient: {} }
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requirePermission: () => async () => {},
  requireAnyPermission: () => async () => {},
  requireAdmin: async () => {},
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuthOrInternalService: vi.fn(async () => ({ valid: true, userId: TEACHER })),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  setFastify: vi.fn(),
  serializeErrorFields: vi.fn((m: unknown) => m),
}))

vi.mock('../src/db/notification-queries.js', () => ({
  createNotification: vi.fn(async () => ({})),
}))

vi.mock('../src/services/wechat-subscribe-message.js', () => ({
  isSubscribeMessageConfigured: vi.fn(() => false),
  getWechatMiniOpenId: vi.fn(async () => null),
  buildFeeReminderData: vi.fn(() => ({})),
  sendSubscribeMessage: vi.fn(async () => ({ ok: true })),
}))

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

import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'

const PREFIX = '/api/edu-ai-management'
// 根由取自身位置而非 cwd(AGENTS §15:共享工作树里 cwd 不可靠)
const ROUTE_FILE = fileURLToPath(new URL('../src/routes/edu-ai-management.ts', import.meta.url))

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 守卫桩成 no-op,登录态由 onRequest 注入(与同族件同一形态);主体只从 request.userId 取
  app.addHook('onRequest', async (request) => {
    ;(request as { userId?: string }).userId = TEACHER
  })
  await app.register(eduAiManagementRoutes, { prefix: PREFIX })
  await app.ready()
  return app
}

/** 请假单假行(edu_leave_request 的形态;日期一律字面量,测试不自算日期)。 */
function leaveRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: LEAVE_ID,
    studentId: STUDENT_A,
    classId: CLASS_ID,
    leaveType: 'sick',
    startDate: '2026-01-05',
    endDate: '2026-01-07',
    totalDays: 3,
    reason: '住院',
    status: 'pending',
    approverId: null,
    approveRemark: null,
    approveAt: null,
    deletedAt: null,
    createdAt: new Date('2026-01-04T02:00:00Z'),
    updatedAt: new Date('2026-01-04T02:00:00Z'),
    ...over,
  }
}

/** 考勤假行(审批联动读写的那张表)。 */
function attendanceRow(day: string, status: string): Record<string, unknown> {
  return {
    id: `att-${day}`,
    studentId: STUDENT_A,
    classId: CLASS_ID,
    date: day,
    status,
    checkInTime: null,
    checkOutTime: null,
    checkInMethod: 'manual',
    operatedBy: null,
    remark: null,
    deletedAt: null,
  }
}

/** 该日"库里没有未软删行"的假答复(路由拿到空数组 ⇒ 走 insert 分支)。 */
const NO_ROW: unknown[] = []

/** 从被审面的 selectTables 里数某张表被查了几次(表对象身份比对,不靠 SQL 文本猜)。 */
function selectCountOf(rec: (typeof W)['db'], table: unknown): number {
  return rec.selectTables.filter((t) => t === table).length
}

/** 取审批处理器在源码里的切片(内容锚点定头,尾锚点=下一条 /leave/:id 路由;行号会挪,不作锚)。 */
function approveHandlerSlice(): string {
  const src = readFileSync(ROUTE_FILE, 'utf8')
  const head = src.indexOf("server.put('/leave/:id/approve'")
  const tail = src.indexOf("server.delete('/leave/:id'", head + 1)
  if (head < 0 || tail < 0) throw new Error('APPROVE_HANDLER_SLICE_NOT_FOUND')
  return src.slice(head, tail)
}

async function approve(payload: Record<string, unknown>) {
  const app = await buildApp()
  const res = await app.inject({
    method: 'PUT',
    url: `${PREFIX}/leave/${LEAVE_ID}/approve`,
    payload,
  })
  await app.close()
  return res
}

/** 世界状态清零(两侧计数器 + 队列 + 载荷账本都算世界状态,漏一项就会把上一轮的数当本轮的)。 */
function resetWorld(): void {
  for (const rec of [W.db, W.tx]) {
    rec.selectCalls = 0
    rec.insertCalls = 0
    rec.updateCalls = 0
    rec.selectTables.length = 0
    rec.selectQueue.length = 0
    rec.insertQueue.length = 0
    rec.updateQueue.length = 0
    rec.insertValues.length = 0
    rec.updateSets.length = 0
  }
  W.txRuns = 0
  W.failInsert = false
}

beforeEach(() => {
  resetWorld()
})

// =============================================================================
// A. 同事务 + 按区间逐日落 leave(B70① 的两条主承诺)
// =============================================================================

describe('A. 审批通过:同事务、按区间逐日幂等落 leave', () => {
  it('三天区间且库内无行 ⇒ 一枚事务、三行 status=leave、日期逐日精确等于区间', async () => {
    W.tx.selectQueue.push([leaveRow()], NO_ROW, NO_ROW, NO_ROW)
    W.tx.updateQueue.push([leaveRow({ status: 'approved', approverId: TEACHER })])
    W.tx.insertQueue.push(
      [attendanceRow('2026-01-05', 'leave')],
      [attendanceRow('2026-01-06', 'leave')],
      [attendanceRow('2026-01-07', 'leave')],
    )

    const res = await approve({ status: 'approved', approveRemark: '同意' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0) // 统一信封 { code, message, data }
    expect(body.data.attendanceSynced).toEqual({ created: 3, updated: 0, skipped: 0 })
    expect(W.txRuns).toBe(1)
    // 事务外零写:半状态("单已批、考勤没落")在结构上不成立
    expect(W.db.insertCalls).toBe(0)
    expect(W.db.updateCalls).toBe(0)
    expect(W.tx.insertValues).toHaveLength(3)
    expect(W.tx.insertValues.map((v) => v.date)).toEqual(['2026-01-05', '2026-01-06', '2026-01-07'])
    for (const v of W.tx.insertValues) {
      expect(v.status).toBe('leave')
      expect(v.operatedBy).toBe(TEACHER)
    }
  })

  it('身份来自请假单而非请求体:硬塞 studentId/classId/approverId 一律进不了写载荷', async () => {
    W.tx.selectQueue.push([leaveRow()], NO_ROW, NO_ROW, NO_ROW)
    W.tx.updateQueue.push([leaveRow({ status: 'approved', approverId: TEACHER })])
    W.tx.insertQueue.push(
      [attendanceRow('2026-01-05', 'leave')],
      [attendanceRow('2026-01-06', 'leave')],
      [attendanceRow('2026-01-07', 'leave')],
    )

    const res = await approve({
      status: 'approved',
      studentId: OTHER_STUDENT_ID,
      classId: OTHER_CLASS_ID,
      approverId: OTHER_USER_ID,
      operatedBy: OTHER_USER_ID,
    })

    expect(res.statusCode).toBe(200)
    for (const v of W.tx.insertValues) {
      expect(v.studentId).toBe(STUDENT_A) // 来自被审请假单
      expect(v.classId).toBe(CLASS_ID)
      expect(v.operatedBy).toBe(TEACHER) // 承载层注入的登录态
      expect(JSON.stringify(v)).not.toContain(OTHER_STUDENT_ID)
      expect(JSON.stringify(v)).not.toContain(OTHER_CLASS_ID)
      expect(JSON.stringify(v)).not.toContain(OTHER_USER_ID)
    }
    // 请假单自身的 set 同样只认承载层主体
    expect(W.tx.updateSets[0]?.approverId).toBe(TEACHER)
  })

  it('结构锁:审批处理器内的考勤读写一律走 tx,不含任何顶层 db 写', () => {
    const slice = approveHandlerSlice()
    expect(slice).toContain('db.transaction(')
    expect(slice).toContain('.insert(eduAttendanceRecord)')
    expect(slice).toContain('.update(eduAttendanceRecord)')
    expect(slice).toContain('.onConflictDoNothing()')
    expect(slice).not.toContain('db.insert(')
    expect(slice).not.toContain('db.update(')
  })
})

// =============================================================================
// B. 幂等:已有行不被改写、非 leave 态不被抹掉
// =============================================================================

describe('B. 幂等与优先级保护', () => {
  it('该日已是 present(教师手判的迟到)⇒ 不 insert 也不 update,只计 skipped', async () => {
    W.tx.selectQueue.push([leaveRow()], NO_ROW, [attendanceRow('2026-01-06', 'late')], NO_ROW)
    W.tx.updateQueue.push([leaveRow({ status: 'approved', approverId: TEACHER })])
    W.tx.insertQueue.push(
      [attendanceRow('2026-01-05', 'leave')],
      [attendanceRow('2026-01-07', 'leave')],
    )

    const res = await approve({ status: 'approved' })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.attendanceSynced).toEqual({ created: 2, updated: 0, skipped: 1 })
    expect(W.tx.insertValues.map((v) => v.date)).toEqual(['2026-01-05', '2026-01-07'])
    // update 只发生过一次 = 请假单自身;考勤行一条都没被改写
    expect(W.tx.updateCalls).toBe(1)
  })

  it('该日已是 leave 行 ⇒ 走 update 刷新归属,且结构上带 status=leave 前置', async () => {
    W.tx.selectQueue.push([leaveRow()], NO_ROW, [attendanceRow('2026-01-06', 'leave')], NO_ROW)
    W.tx.updateQueue.push(
      [leaveRow({ status: 'approved', approverId: TEACHER })],
      [attendanceRow('2026-01-06', 'leave')],
    )
    W.tx.insertQueue.push(
      [attendanceRow('2026-01-05', 'leave')],
      [attendanceRow('2026-01-07', 'leave')],
    )

    const res = await approve({ status: 'approved' })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.attendanceSynced).toEqual({ created: 2, updated: 1, skipped: 0 })
    expect(W.tx.updateSets[1]?.status).toBe('leave')
    // 前置条件写进同一把 where:select 与 update 之间别席把该行改成"迟到"也不会被覆盖
    expect(approveHandlerSlice()).toContain("eq(eduAttendanceRecord.status, 'leave')")
  })

  it('三天都已有非 leave 行 ⇒ 零 insert、零考勤 update,仍回 200(skipped=3)', async () => {
    W.tx.selectQueue.push(
      [leaveRow()],
      [attendanceRow('2026-01-05', 'present')],
      [attendanceRow('2026-01-06', 'present')],
      [attendanceRow('2026-01-07', 'present')],
    )
    W.tx.updateQueue.push([leaveRow({ status: 'approved', approverId: TEACHER })])

    const res = await approve({ status: 'approved' })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.attendanceSynced).toEqual({ created: 0, updated: 0, skipped: 3 })
    expect(W.tx.insertCalls).toBe(0)
    expect(W.tx.updateCalls).toBe(1)
  })

  it('同一次审批连打两次:第一轮落三行、第二轮单据已非 pending ⇒ 400 且一行都不补(重放不二次改考勤)', async () => {
    // 第一轮:三天都空 ⇒ 落三行
    W.tx.selectQueue.push([leaveRow()], NO_ROW, NO_ROW, NO_ROW)
    W.tx.updateQueue.push([leaveRow({ status: 'approved', approverId: TEACHER })])
    W.tx.insertQueue.push(
      [attendanceRow('2026-01-05', 'leave')],
      [attendanceRow('2026-01-06', 'leave')],
      [attendanceRow('2026-01-07', 'leave')],
    )
    const first = await approve({ status: 'approved' })
    expect(first.statusCode).toBe(200)

    // 第二轮:库里已有三行 leave,但单据已非 pending ⇒ 路由按"仅待审批可审批"回 400,
    // 一次考勤都不查、一行都不补(重放审批不二次改考勤 = 幂等的第二半)。
    const firstInserts = W.tx.insertCalls
    resetWorld()
    W.tx.selectQueue.push([leaveRow({ status: 'approved', approverId: TEACHER })])
    const second = await approve({ status: 'approved' })
    expect(second.statusCode).toBe(400)
    expect(W.tx.insertCalls).toBe(0)
    expect(selectCountOf(W.tx, eduAttendanceRecord)).toBe(0)
    expect(firstInserts).toBe(3)
  })
})

// =============================================================================
// C. 计数诚实性(门 134:只认 .returning() 回库集合)
// =============================================================================

describe('C. 回库确认集合才是计数', () => {
  it('撞唯一索引:三笔 insert 的 returning 全空 ⇒ created=0、skipped=3(不把请求侧 length 当 affected)', async () => {
    W.tx.selectQueue.push([leaveRow()], NO_ROW, NO_ROW, NO_ROW)
    W.tx.updateQueue.push([leaveRow({ status: 'approved', approverId: TEACHER })])
    W.tx.insertQueue.push([], [], [])

    const res = await approve({ status: 'approved' })

    expect(res.statusCode).toBe(200)
    expect(W.tx.insertCalls).toBe(3) // 真的发了三笔
    expect(res.json().data.attendanceSynced).toEqual({ created: 0, updated: 0, skipped: 3 })
  })

  it('只落库两笔 ⇒ created=2、skipped=1:计数逐笔跟着回库结果走', async () => {
    W.tx.selectQueue.push([leaveRow()], NO_ROW, NO_ROW, NO_ROW)
    W.tx.updateQueue.push([leaveRow({ status: 'approved', approverId: TEACHER })])
    W.tx.insertQueue.push(
      [attendanceRow('2026-01-05', 'leave')],
      [],
      [attendanceRow('2026-01-07', 'leave')],
    )

    const res = await approve({ status: 'approved' })

    expect(res.json().data.attendanceSynced).toEqual({ created: 2, updated: 0, skipped: 1 })
  })

  it('考勤 update 没回库(被别席改走)⇒ updated=0、skipped=1,同样不谎报', async () => {
    W.tx.selectQueue.push([leaveRow()], NO_ROW, [attendanceRow('2026-01-06', 'leave')], NO_ROW)
    W.tx.updateQueue.push(
      [leaveRow({ status: 'approved', approverId: TEACHER })],
      [], // 那条 leave 行的 update 回库为空
    )
    W.tx.insertQueue.push(
      [attendanceRow('2026-01-05', 'leave')],
      [attendanceRow('2026-01-07', 'leave')],
    )

    const res = await approve({ status: 'approved' })

    expect(res.json().data.attendanceSynced).toEqual({ created: 2, updated: 0, skipped: 1 })
  })
})

// =============================================================================
// E. 反向四型:不落考勤 / 不谎报成功
// =============================================================================

describe('E. 反向:拒绝·非待审批·不存在·超跨度·落库抛错', () => {
  it('审批成 rejected ⇒ 单据改状态但考勤表一次都不查、零写', async () => {
    W.tx.selectQueue.push([leaveRow()])
    W.tx.updateQueue.push([leaveRow({ status: 'rejected', approverId: TEACHER })])

    const res = await approve({ status: 'rejected', approveRemark: '不予批准' })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.attendanceSynced).toEqual({ created: 0, updated: 0, skipped: 0 })
    expect(W.tx.insertCalls).toBe(0)
    expect(selectCountOf(W.tx, eduAttendanceRecord)).toBe(0)
  })

  it('单据已非 pending ⇒ 400、零考勤查询、零写(重放审批不会二次改考勤)', async () => {
    W.tx.selectQueue.push([leaveRow({ status: 'approved', approverId: TEACHER })])

    const res = await approve({ status: 'approved' })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('仅待审批')
    expect(W.tx.insertCalls).toBe(0)
    expect(W.tx.updateCalls).toBe(0)
    expect(selectCountOf(W.tx, eduAttendanceRecord)).toBe(0)
  })

  it('请假单不存在 ⇒ 404、事务零写', async () => {
    W.tx.selectQueue.push(NO_ROW)

    const res = await approve({ status: 'approved' })

    expect(res.statusCode).toBe(404)
    expect(W.txRuns).toBe(1)
    expect(W.tx.insertCalls).toBe(0)
    expect(W.tx.updateCalls).toBe(0)
    // 被审面只被问了一次(请假单),考勤表连"要不要补"都没轮到 ⇒ 不存在即零联动
    expect(selectCountOf(W.tx, eduLeaveRequest)).toBe(1)
    expect(selectCountOf(W.tx, eduAttendanceRecord)).toBe(0)
  })

  it('请假单被并发软删(update 无回库行)⇒ 404,不给"审批成功"读数', async () => {
    W.tx.selectQueue.push([leaveRow()])
    W.tx.updateQueue.push(NO_ROW) // 请假单 update 的 returning 为空

    const res = await approve({ status: 'approved' })

    expect(res.statusCode).toBe(404)
    expect(W.tx.insertCalls).toBe(0)
  })

  it('区间跨度过大(>366 天)⇒ 400 且考勤零写(不是默默写几千行)', async () => {
    W.tx.selectQueue.push([leaveRow({ startDate: '2019-01-01', endDate: '2021-01-01' })])
    W.tx.updateQueue.push([leaveRow({ status: 'approved', approverId: TEACHER })])

    const res = await approve({ status: 'approved' })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('跨度过大')
    expect(W.tx.insertCalls).toBe(0)
  })

  it('落库抛错 ⇒ 500「审批失败」,绝不回 200(半状态不外报为成功)', async () => {
    W.tx.selectQueue.push([leaveRow()])
    W.tx.updateQueue.push([leaveRow({ status: 'approved', approverId: TEACHER })])
    W.failInsert = true

    const res = await approve({ status: 'approved' })

    expect(res.statusCode).toBe(500)
    expect(res.json().message).toBe('审批失败')
  })

  it('入参形状不合(status 非 approved/rejected)⇒ 400 且事务根本没开', async () => {
    const res = await approve({ status: 'all' })
    expect(res.statusCode).toBe(400)
    expect(W.txRuns).toBe(0)
    expect(W.tx.insertCalls).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
