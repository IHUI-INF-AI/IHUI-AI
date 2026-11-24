// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 人事请假审批流契约锁(HR-3,2026-11-11 立,**全程不连库**)。
 *
 * 形状抄同族 tests/hr-jobs-contract.test.ts(vi.hoisted 账本 + 脚本化假库 + 写链记账),
 * 不自造第二套夹具。表身份按对象引用分流(`t === hrApprovalInstance`),不靠字符串名字。
 *
 * 锁定契约:
 *   · 路由:假别相同 + active + 未软删 + min<=days<(max||∞),多条命中取 min_days 最大者(最具体优先);
 *   · 提交:校验请假单存在 → 路由 → 链非空 → 落实例(chain_snapshot+due_at+current_step=0);
 *   · 多级推进:中间步 approve 推 current_step、刷新 due_at、通知下一级;
 *   · 末步通过:status=approved + 回写 hr_leave_request=approved;
 *   · 驳回即终止:status=rejected + 回写 hr_leave_request=rejected,不再推进;
 *   · 超时升级:pending 且 due_at<now → 有 escalation 目标则追加链一级、记 byTimeout 步、status=escalated;
 *   · 无匹配规则:submitApproval 抛 ApprovalRouteError('NO_FLOW')。
 *
 * 假库只回答"这条链吐什么行 / update 回读成什么",不替生产做业务判断。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
// 表身份按对象引用分流,必须与 service 用同一模块实例(service 也从 @ihui/database 取)
import { hrApprovalFlow, hrApprovalInstance, hrLeaveRequest } from '@ihui/database'

type Row = Record<string, unknown>

/** 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。 */
const H = vi.hoisted(() => {
  type Tbl = 'flow' | 'instance' | 'leave'
  return {
    tables: {} as Record<Tbl, unknown>,
    keyOf(t: unknown): Tbl | undefined {
      if (t === H.tables.flow) return 'flow'
      if (t === H.tables.instance) return 'instance'
      if (t === H.tables.leave) return 'leave'
      return undefined
    },
    /** 脚本化读队列(每张表按调用序吐行集;耗尽后复用最后一条脚本) */
    reads: { flow: [] as Row[][], instance: [] as Row[][], leave: [] as Row[][] } as Record<
      Tbl,
      Row[][]
    >,
    /** 实例 insert 逐条留档 */
    instanceInserts: [] as Row[],
    /** 实例 update 逐条留档(推进/终态/升级) */
    instanceUpdates: [] as Row[],
    /** 请假单 update 逐条留档(回写审批结果) */
    leaveUpdates: [] as Row[],
    /** 实例行仓库(update 反查用) */
    instancesById: new Map<string, Row>(),
    /** 请假单行仓库 */
    leavesById: new Map<string, Row>(),
    nextId: 0,
    unscripted: 0,
  }
})

vi.mock('../src/db/index.js', () => {
  const CHAIN = [
    'where',
    'orderBy',
    'limit',
    'offset',
    'groupBy',
    'having',
    'leftJoin',
    'innerJoin',
  ] as const
  const selectChain = () => {
    let rows: Row[] = []
    const step: Record<string, unknown> = {}
    step.from = vi.fn((t: unknown) => {
      const key = H.keyOf(t)
      const q = key ? H.reads[key] : undefined
      if (!q) {
        H.unscripted += 1
        rows = []
        return step
      }
      const next = q.shift()
      if (next) {
        rows = next
        q.unshift(next) // 耗尽后复用最后一条脚本
      } else if (q.length === 0) {
        H.unscripted += 1
        rows = []
      }
      return step
    })
    for (const m of CHAIN) step[m] = vi.fn(() => step)
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject)
    return step
  }

  const insertChain = (target: unknown) => {
    let values: Row | Row[] = []
    let applied: Row[] | null = null
    const applyOnce = (): Row[] => {
      if (applied) return applied
      const list = Array.isArray(values) ? values : [values]
      const recs = list.map((r) => {
        const id = `inst-${(H.nextId += 1)}`
        const rec = { id, ...r }
        if (H.keyOf(target) === 'instance') {
          H.instanceInserts.push(rec)
          H.instancesById.set(id, rec)
        }
        return rec
      })
      applied = recs
      return applied
    }
    const step: Record<string, unknown> = {}
    step.values = vi.fn((v: Row | Row[]) => {
      values = v
      return step
    })
    step.onConflictDoNothing = vi.fn(() => step)
    step.returning = vi.fn(() => Promise.resolve(applyOnce()))
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(applyOnce()).then(resolve, reject)
    return step
  }

  const updateChain = (target: unknown) => {
    let sets: Row = {}
    let idFilter: string | undefined
    const step: Record<string, unknown> = {}
    step.set = vi.fn((v: Row) => {
      sets = v
      return step
    })
    step.where = vi.fn((expr?: { id?: { value?: string } }) => {
      const id = expr?.id?.value
      if (typeof id === 'string') idFilter = id
      return step
    })
    step.returning = vi.fn(() => Promise.resolve(resolveUpdateRow()))
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolveUpdateRow()).then(resolve, reject)
    return step

    function resolveUpdateRow(): Row[] {
      const key = H.keyOf(target)
      if (key === 'instance') {
        const found = idFilter ? H.instancesById.get(idFilter) : undefined
        const rec: Row = found ? { ...found, ...sets } : { id: idFilter ?? `inst-?`, ...sets }
        H.instanceUpdates.push(rec)
        if (idFilter) H.instancesById.set(idFilter, rec)
        return [rec]
      }
      if (key === 'leave') {
        const found = idFilter ? H.leavesById.get(idFilter) : undefined
        const rec: Row = found ? { ...found, ...sets } : { id: idFilter ?? `leave-?`, ...sets }
        H.leaveUpdates.push(rec)
        if (idFilter) H.leavesById.set(idFilter, rec)
        return [rec]
      }
      H.instanceUpdates.push(sets)
      return [{ ...sets }]
    }
  }

  const dbMock = {
    select: vi.fn(() => selectChain()),
    insert: vi.fn((t: unknown) => insertChain(t)),
    update: vi.fn((t: unknown) => updateChain(t)),
    delete: vi.fn(() => selectChain()),
    execute: vi.fn(() => Promise.resolve([])),
    transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(dbMock)),
  }
  return { db: dbMock, dbRead: dbMock, dbWriter: dbMock, dbClient: {} }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  setFastify: vi.fn(),
  serializeErrorFields: vi.fn((m: unknown) => m),
}))

// 站内信 mock(不连库;校验"下一级审批人被通知")
const createNotification = vi.fn(async () => ({ id: 'notif-1' }))
vi.mock('../src/db/notification-queries.js', () => ({
  createNotification: (...args: unknown[]) => createNotification(...(args as [])),
}))

import {
  routeApprovalFlow,
  submitApproval,
  decideApproval,
  escalateTimedOut,
  listMyPendingApprovals,
} from '../src/services/hr-approval.js'

const APPROVER_A = '11111111-1111-4111-8111-111111111111'
const APPROVER_B = '22222222-2222-4222-8222-222222222222'
const APPROVER_C = '33333333-3333-4333-8333-333333333333'
const LEAVE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const INSTANCE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** 预置一条请假单 + 一条审批实例到假库仓库(供 decide / escalate 用) */
function seedInstance(opts: {
  chain: string[]
  currentStep: number
  status: 'pending' | 'approved' | 'rejected' | 'escalated'
  steps?: Row[]
  dueAt?: Date | null
  /** 提交时固化的超时升级目标(生产由 submitApproval 写入;escalate 测试按需设置) */
  escalationApproverSnapshot?: string | null
}) {
  H.leavesById.set(LEAVE_ID, {
    id: LEAVE_ID,
    leaveType: '事假',
    totalDays: 5,
    status: 'pending',
  })
  const inst = {
    id: INSTANCE_ID,
    leaveRequestId: LEAVE_ID,
    currentStep: opts.currentStep,
    chainSnapshot: opts.chain,
    // 快照字段:escalateTimedOut 读提交时刻固化的代理/超时时限/升级目标,
    // 夹具默认对齐生产提交态(timeoutHours=24、无代理/无升级目标),可按用例覆盖。
    approverProxySnapshot: null as string | null,
    timeoutHoursSnapshot: 24,
    escalationApproverSnapshot: opts.escalationApproverSnapshot ?? null,
    status: opts.status,
    steps: opts.steps ?? [],
    dueAt: opts.dueAt === undefined ? new Date('2026-11-10T00:00:00Z') : opts.dueAt,
    submittedAt: new Date('2026-11-09T00:00:00Z'),
    decidedAt: null,
  }
  H.instancesById.set(INSTANCE_ID, inst)
  return inst
}

beforeEach(() => {
  H.tables.flow = hrApprovalFlow
  H.tables.instance = hrApprovalInstance
  H.tables.leave = hrLeaveRequest
  H.reads = { flow: [[]], instance: [[]], leave: [[]] }
  H.instanceInserts = []
  H.instanceUpdates = []
  H.leaveUpdates = []
  H.instancesById = new Map()
  H.leavesById = new Map()
  H.nextId = 0
  H.unscripted = 0
  createNotification.mockClear()
})

describe('routeApprovalFlow · 区间命中与最具体规则优先', () => {
  it('多条命中时取 min_days 最大者;max_days=null 视为无上界', async () => {
    // 假库只模拟 SQL 已命中的行(leave_type=事假 ∧ status=active ∧ 未软删);
    // SQL 层的 disabled/软删/异假别过滤不在假库职责内(见 hr-jobs-contract 头注)。
    // JS 层验证的是"区间命中 + 最具体(min_days 最大)优先"。
    H.reads.flow = [
      [
        {
          id: 'f1',
          leaveType: '事假',
          minDays: 0,
          maxDays: 3,
          status: 'active',
          deletedAt: null,
          approverIds: [APPROVER_A],
          timeoutHours: 24,
        },
        {
          id: 'f2',
          leaveType: '事假',
          minDays: 3,
          maxDays: 7,
          status: 'active',
          deletedAt: null,
          approverIds: [APPROVER_A, APPROVER_B],
          timeoutHours: 24,
        },
        {
          id: 'f3',
          leaveType: '事假',
          minDays: 7,
          maxDays: null,
          status: 'active',
          deletedAt: null,
          approverIds: [APPROVER_A, APPROVER_B, APPROVER_C],
          timeoutHours: 12,
        },
      ],
    ]
    // 5 天事假:[0,3) 不中;[3,7) 命中 f2;[7,∞) 不中(5<7) → f2
    const hit = await routeApprovalFlow('事假', 5)
    expect(hit?.id).toBe('f2')
    // 8 天事假:只有 [7,∞) 命中 → f3
    const bigHit = await routeApprovalFlow('事假', 8)
    expect(bigHit?.id).toBe('f3')
  })
})

describe('submitApproval · 提交落实例', () => {
  it('命中规则 → 落 pending 实例(链快照+due_at+current_step=0)并通知首位审批人', async () => {
    // 顺序:submitApproval 先读 leave,再 route 读 flow
    H.reads.leave = [[{ id: LEAVE_ID, leaveType: '事假', totalDays: 5, status: 'pending' }]]
    H.reads.flow = [
      [
        {
          id: 'f2',
          leaveType: '事假',
          minDays: 3,
          maxDays: 7,
          status: 'active',
          deletedAt: null,
          approverIds: [APPROVER_A, APPROVER_B],
          timeoutHours: 24,
        },
      ],
    ]
    const result = await submitApproval({ leaveRequestId: LEAVE_ID })
    expect(result.instance.status).toBe('pending')
    expect(result.instance.currentStep).toBe(0)
    expect(result.instance.chainSnapshot).toEqual([APPROVER_A, APPROVER_B])
    expect(result.instance.dueAt).toBeInstanceOf(Date)
    expect(H.instanceInserts).toHaveLength(1)
    expect(H.instanceInserts[0]?.chainSnapshot).toEqual([APPROVER_A, APPROVER_B])
    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(createNotification.mock.calls[0]?.[0]?.userId).toBe(APPROVER_A)
    expect(result.notified).toBe(true)
  })

  it('提交时固化全套快照:链+代理+超时时限+超时升级目标一并写入实例(规则后续改动不影响在飞)', async () => {
    // solidify 决策(2026-11-12)验收锚:提交即快照 proxy/timeoutHours/escalation 四件套,
    // 保证提交后规则再改,decide/notify/escalate 全读快照、绝不二次取实时规则。
    H.reads.leave = [[{ id: LEAVE_ID, leaveType: '事假', totalDays: 5, status: 'pending' }]]
    H.reads.flow = [
      [
        {
          id: 'f-proxy',
          leaveType: '事假',
          minDays: 3,
          maxDays: 7,
          status: 'active',
          deletedAt: null,
          approverIds: [APPROVER_A],
          approverProxyId: APPROVER_B, // 链指向 A,代理是 B
          timeoutHours: 12,
          escalationApproverId: APPROVER_C,
        },
      ],
    ]
    const result = await submitApproval({ leaveRequestId: LEAVE_ID })
    const inserted = H.instanceInserts[0] as Row
    expect(inserted.chainSnapshot).toEqual([APPROVER_A])
    expect(inserted.approverProxySnapshot).toBe(APPROVER_B) // 代理固化
    expect(inserted.timeoutHoursSnapshot).toBe(12) // 超时时限固化(非默认 24)
    expect(inserted.escalationApproverSnapshot).toBe(APPROVER_C) // 升级目标固化
    // due_at 由提交时的 timeout_hours_snapshot 折算(12h)
    expect((result.instance.dueAt as Date).getTime()).toBe(
      result.instance.submittedAt.getTime() + 12 * 3_600_000,
    )
  })

  it('无匹配规则 → 抛 ApprovalRouteError NO_FLOW,不落实例', async () => {
    // 假库只模拟 SQL 已命中行:调休假别无任何 active 规则 ⇒ flow 读到空
    H.reads.leave = [[{ id: LEAVE_ID, leaveType: '调休', totalDays: 1, status: 'pending' }]]
    H.reads.flow = [[]]
    await expect(submitApproval({ leaveRequestId: LEAVE_ID })).rejects.toMatchObject({
      name: 'ApprovalRouteError',
      code: 'NO_FLOW',
    })
    expect(H.instanceInserts).toHaveLength(0)
  })

  it('请假单不存在 → 抛 INVALID_LEAVE', async () => {
    H.reads.leave = [[]]
    await expect(submitApproval({ leaveRequestId: LEAVE_ID })).rejects.toMatchObject({
      code: 'INVALID_LEAVE',
    })
  })
})

describe('decideApproval · 多级推进与终态回写', () => {
  it('中间步 approve → 推 current_step、刷新 due_at、通知下一级;请假单不回写', async () => {
    seedInstance({ chain: [APPROVER_A, APPROVER_B, APPROVER_C], currentStep: 0, status: 'pending' })
    H.reads.instance = [[H.instancesById.get(INSTANCE_ID) as Row]]
    H.reads.leave = [[H.leavesById.get(LEAVE_ID) as Row]]
    H.reads.flow = [
      [
        {
          id: 'f2',
          leaveType: '事假',
          minDays: 3,
          maxDays: 7,
          status: 'active',
          deletedAt: null,
          approverIds: [APPROVER_A, APPROVER_B, APPROVER_C],
          timeoutHours: 48,
        },
      ],
    ]
    const result = await decideApproval({
      instanceId: INSTANCE_ID,
      approverId: APPROVER_A,
      action: 'approved',
      remark: '同意',
    })
    expect(result.instance.status).toBe('pending')
    expect(result.instance.currentStep).toBe(1)
    expect(result.instance.steps).toHaveLength(1)
    expect(result.instance.steps[0]).toMatchObject({
      step: 0,
      action: 'approved',
      approverId: APPROVER_A,
    })
    expect(H.leaveUpdates).toHaveLength(0) // 未到末步,请假单不动
    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(createNotification.mock.calls[0]?.[0]?.userId).toBe(APPROVER_B)
  })

  it('末步 approve → status=approved + 回写 hr_leave_request=approved', async () => {
    seedInstance({
      chain: [APPROVER_A, APPROVER_B],
      currentStep: 1,
      status: 'pending',
      steps: [
        {
          step: 0,
          approverId: APPROVER_A,
          action: 'approved',
          decidedAt: '2026-11-09T01:00:00.000Z',
        },
      ],
    })
    H.reads.instance = [[H.instancesById.get(INSTANCE_ID) as Row]]
    H.reads.leave = [[H.leavesById.get(LEAVE_ID) as Row]]
    H.reads.flow = [
      [
        {
          id: 'f2',
          leaveType: '事假',
          minDays: 3,
          maxDays: 7,
          status: 'active',
          deletedAt: null,
          approverIds: [APPROVER_A, APPROVER_B],
          timeoutHours: 24,
        },
      ],
    ]
    const result = await decideApproval({
      instanceId: INSTANCE_ID,
      approverId: APPROVER_B,
      action: 'approved',
    })
    expect(result.instance.status).toBe('approved')
    expect(result.instance.decidedAt).toBeInstanceOf(Date)
    expect(H.leaveUpdates).toHaveLength(1)
    expect(H.leaveUpdates[0]?.status).toBe('approved')
    expect(H.leaveUpdates[0]?.approverId).toBe(APPROVER_B)
  })

  it('驳回即终止 → status=rejected + 回写 hr_leave_request=rejected,不再推进', async () => {
    seedInstance({ chain: [APPROVER_A, APPROVER_B], currentStep: 0, status: 'pending' })
    H.reads.instance = [[H.instancesById.get(INSTANCE_ID) as Row]]
    H.reads.leave = [[H.leavesById.get(LEAVE_ID) as Row]]
    H.reads.flow = [
      [
        {
          id: 'f2',
          leaveType: '事假',
          minDays: 3,
          maxDays: 7,
          status: 'active',
          deletedAt: null,
          approverIds: [APPROVER_A, APPROVER_B],
          timeoutHours: 24,
        },
      ],
    ]
    const result = await decideApproval({
      instanceId: INSTANCE_ID,
      approverId: APPROVER_A,
      action: 'rejected',
      remark: '天数超限',
    })
    expect(result.instance.status).toBe('rejected')
    expect(result.instance.steps).toHaveLength(1)
    expect(result.instance.steps[0]).toMatchObject({ step: 0, action: 'rejected' })
    expect(H.leaveUpdates).toHaveLength(1)
    expect(H.leaveUpdates[0]?.status).toBe('rejected')
    expect(H.leaveUpdates[0]?.approveRemark).toBe('天数超限')
    expect(createNotification).not.toHaveBeenCalled() // 驳回不通知下一级
  })

  it('非当前步审批人 → 抛 INVALID_LEAVE;已终态实例再决策 → 抛 INVALID_LEAVE', async () => {
    seedInstance({ chain: [APPROVER_A, APPROVER_B], currentStep: 0, status: 'pending' })
    H.reads.instance = [[H.instancesById.get(INSTANCE_ID) as Row]]
    H.reads.leave = [[H.leavesById.get(LEAVE_ID) as Row]]
    H.reads.flow = [
      [
        {
          id: 'f2',
          leaveType: '事假',
          minDays: 3,
          maxDays: 7,
          status: 'active',
          deletedAt: null,
          approverIds: [APPROVER_A, APPROVER_B],
          timeoutHours: 24,
        },
      ],
    ]
    await expect(
      decideApproval({ instanceId: INSTANCE_ID, approverId: APPROVER_B, action: 'approved' }),
    ).rejects.toMatchObject({ code: 'INVALID_LEAVE' })
    // 终态闸
    seedInstance({ chain: [APPROVER_A], currentStep: 0, status: 'approved' })
    H.reads.instance = [[H.instancesById.get(INSTANCE_ID) as Row]]
    await expect(
      decideApproval({ instanceId: INSTANCE_ID, approverId: APPROVER_A, action: 'approved' }),
    ).rejects.toMatchObject({ code: 'INVALID_LEAVE' })
  })
})

describe('escalateTimedOut · 超时升级', () => {
  it('pending 且 due_at 过期 → 有 escalation 目标则追加链一级、记 byTimeout 步、status=escalated', async () => {
    seedInstance({
      chain: [APPROVER_A, APPROVER_B],
      currentStep: 0,
      status: 'pending',
      dueAt: new Date('2026-11-09T00:00:00Z'), // 已过期
      escalationApproverSnapshot: APPROVER_C, // 提交时固化的升级目标
    })
    // escalateTimedOut 先扫 instance 拿 overdue 集,再读 leave;读快照列,不读 flow。
    H.reads.instance = [[H.instancesById.get(INSTANCE_ID) as Row]]
    H.reads.leave = [[H.leavesById.get(LEAVE_ID) as Row]]
    H.reads.flow = [
      [
        {
          id: 'f2',
          leaveType: '事假',
          minDays: 3,
          maxDays: 7,
          status: 'active',
          deletedAt: null,
          approverIds: [APPROVER_A, APPROVER_B],
          timeoutHours: 24,
          escalationApproverId: APPROVER_C,
        },
      ],
    ]
    const now = new Date('2026-11-10T00:00:00Z')
    const result = await escalateTimedOut({ now })
    expect(result.escalated).toBe(1)
    expect(H.instanceUpdates).toHaveLength(1)
    const updated = H.instanceUpdates[0]
    expect(updated?.status).toBe('escalated')
    expect(updated?.chainSnapshot).toEqual([APPROVER_A, APPROVER_B, APPROVER_C])
    expect(updated?.currentStep).toBe(2)
    expect((updated?.steps as Row[])?.[0]).toMatchObject({ action: 'escalated', byTimeout: true })
    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(createNotification.mock.calls[0]?.[0]?.userId).toBe(APPROVER_C)
  })

  it('未过期 → 不升级;无 escalation 目标 → 只记轨迹不追加链', async () => {
    seedInstance({
      chain: [APPROVER_A],
      currentStep: 0,
      status: 'pending',
      dueAt: new Date('2026-11-11T00:00:00Z'), // 晚于扫描时刻,未过期
    })
    H.reads.instance = [[H.instancesById.get(INSTANCE_ID) as Row]]
    const now = new Date('2026-11-10T00:00:00Z')
    const r1 = await escalateTimedOut({ now })
    expect(r1.escalated).toBe(0)
    expect(H.instanceUpdates).toHaveLength(0)
  })

  it('已 escalated 且再次到点 → 催办:不增长链、不换人、再通知当前升级目标、escalated 计数不增', async () => {
    seedInstance({
      chain: [APPROVER_A, APPROVER_B, APPROVER_C],
      currentStep: 2, // 已升级到 C
      status: 'escalated',
      dueAt: new Date('2026-11-09T00:00:00Z'), // 已过期
    })
    H.reads.instance = [[H.instancesById.get(INSTANCE_ID) as Row]]
    H.reads.leave = [[H.leavesById.get(LEAVE_ID) as Row]]
    H.reads.flow = [
      [
        {
          id: 'f2',
          leaveType: '事假',
          minDays: 3,
          maxDays: 7,
          status: 'active',
          deletedAt: null,
          approverIds: [APPROVER_A, APPROVER_B],
          timeoutHours: 24,
          escalationApproverId: APPROVER_C,
        },
      ],
    ]
    const now = new Date('2026-11-10T00:00:00Z')
    const result = await escalateTimedOut({ now })
    expect(result.escalated).toBe(0) // 催办不计入升级数
    expect(H.instanceUpdates).toHaveLength(1)
    const updated = H.instanceUpdates[0]
    // 注意:测试桩的 eq() id 提取不生效,update 返回的是 {...sets, 兜底id},不合并 seed 行。
    // 故催办用例应断言「显式 set 的字段」:催办分支只 set steps/dueAt/updatedAt,
    // 绝不 set status/chainSnapshot/currentStep(即不重写这些、不增长链、不换人)。
    expect(updated).not.toHaveProperty('status') // 没重写状态
    expect(updated).not.toHaveProperty('chainSnapshot') // 没增长链
    expect(updated).not.toHaveProperty('currentStep') // 没换人
    expect(updated?.steps).toBeDefined() // 追加了一条 byTimeout 催办轨迹
    expect(((updated?.steps as Row[]) ?? []).at(-1)).toMatchObject({
      action: 'escalated',
      byTimeout: true,
      step: 2, // 仍在原升级步(currentStep=2)
    })
    // due_at 顺延一个 timeout_hours
    expect((updated?.dueAt as Date).getTime()).toBe(now.getTime() + 24 * 3_600_000)
    // 仍通知当前升级目标 C
    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(createNotification.mock.calls[0]?.[0]?.userId).toBe(APPROVER_C)
  })
})

describe('listMyPendingApprovals · 当前步过滤与分页', () => {
  it('只返回链当前步指向该审批人的 pending/escalated 实例,分页切片正确', async () => {
    const mine = seedInstance({ chain: [APPROVER_A], currentStep: 0, status: 'pending' })
    // SQL 已过滤 status ∈ (pending, escalated);下面两行是 status=approved,SQL 层不会返回 ⇒ 不进假库
    void seedInstance({ chain: [APPROVER_A], currentStep: 0, status: 'approved' })
    // 指向他人当前步的 pending 实例:SQL 会返回,JS 层按 chain[current_step] 过滤掉
    const other = {
      ...seedInstance({ chain: [APPROVER_A], currentStep: 0, status: 'pending' }),
      id: 'inst-x',
      chainSnapshot: [APPROVER_B],
    }
    H.reads.instance = [[mine, other]]
    const result = await listMyPendingApprovals({ approverId: APPROVER_A, limit: 10, offset: 0 })
    expect(result.total).toBe(1)
    expect(result.list).toHaveLength(1)
    expect(result.list[0]?.id).toBe(INSTANCE_ID)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
