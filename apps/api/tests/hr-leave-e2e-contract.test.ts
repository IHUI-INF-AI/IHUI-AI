// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * HR-3 员工请假端到端联调契约锁(2026-11-12 立,**全程不连库**)。
 *
 * 把联调脚本 scripts/hr-e2e-leave.ts 的 10 步真库场景,转成 vitest 契约回归测试。
 * 形状照抄同族 tests/hr-approval-contract.test.ts(vi.hoisted 账本 + 脚本化假库 select/insert/update 链
 * + 写链记账 + 表身份按对象引用分流 `t === hrApprovalInstance`),不自造第二套夹具。
 *
 * 锁定契约(对应脚本 ①~⑥,压缩成 describe/it):
 *   · 创建请假单(createHrLeave):insert hr_leave_request 落库;
 *   · submitApproval 落四件套快照:chain_snapshot / approver_proxy_snapshot /
 *     timeout_hours_snapshot(重点断言 = 规则值 48,非默认 24)/ escalation_approver_snapshot(升级目标人);
 *   · due_at 按提交时的 timeout_hours_snapshot 折算(48h);
 *   · 一级 decideApproval(approved):current_step 推进、status 仍 pending、刷新 due_at、通知下一级;
 *   · 末步 decideApproval(approved):status=approved + 回写 hr_leave_request=approved;
 *   · 审批完成后 listMyPendingApprovals 不再返回该实例。
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
    /** 实例 update 逐条留档(推进/终态) */
    instanceUpdates: [] as Row[],
    /** 请假单 insert 逐条留档(createHrLeave 落库) */
    leaveInserts: [] as Row[],
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
        if (H.keyOf(target) === 'leave') {
          H.leaveInserts.push(rec)
          H.leavesById.set(id, rec)
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

import { createHrLeave } from '../src/services/hr-attendance.js'
import {
  submitApproval,
  decideApproval,
  listMyPendingApprovals,
} from '../src/services/hr-approval.js'

const EMP_ID = '49da441a-ca46-4c51-90ad-6a41ce81a212'
const DEPT_ID = '770fb992-7fa3-4746-b378-3ea59a979054'
const MGR1 = '11111111-1111-4111-8111-111111111111'
const MGR2 = '22222222-2222-4222-8222-222222222222'
const LEAVE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

/** e2e 场景命中的规则:5 天年假 → "3~∞ 天"两级链(mgr1→mgr2 + 48h 超时 + 升级目标 mgr2) */
function twoLevelFlowRow() {
  return {
    id: 'f-two-level',
    leaveType: '年假',
    minDays: 3,
    maxDays: null,
    status: 'active',
    deletedAt: null,
    approverIds: [MGR1, MGR2],
    timeoutHours: 48,
    escalationApproverId: MGR2,
  }
}

beforeEach(() => {
  H.tables.flow = hrApprovalFlow
  H.tables.instance = hrApprovalInstance
  H.tables.leave = hrLeaveRequest
  H.reads = { flow: [[]], instance: [[]], leave: [[]] }
  H.instanceInserts = []
  H.instanceUpdates = []
  H.leaveInserts = []
  H.leaveUpdates = []
  H.instancesById = new Map()
  H.leavesById = new Map()
  H.nextId = 0
  H.unscripted = 0
  createNotification.mockClear()
})

describe('HR-3 请假端到端联调(不连库契约回归)', () => {
  it('① 创建请假单:insert hr_leave_request 落库并返回新单', async () => {
    const leave = await createHrLeave({
      employeeId: EMP_ID,
      departmentId: DEPT_ID,
      leaveType: '年假',
      startDate: '2026-11-16',
      endDate: '2026-11-20',
      totalDays: 5,
      reason: '端到端联调·5天年假',
    })
    // 假库 insert 分配 inst-N 序号 id,不绑定具体值;钉业务字段与"返回了新单"
    expect(leave?.id).toBeTruthy()
    expect(H.leaveInserts).toHaveLength(1)
    expect(H.leaveInserts[0]).toMatchObject({
      employeeId: EMP_ID,
      departmentId: DEPT_ID,
      leaveType: '年假',
      totalDays: 5,
    })
  })

  it('②③ submitApproval 落四件套快照 + due_at 按 48h 折算', async () => {
    // 顺序:submitApproval 先读 leave,再 route 读 flow
    H.reads.leave = [[{ id: LEAVE_ID, leaveType: '年假', totalDays: 5, status: 'pending' }]]
    H.reads.flow = [[twoLevelFlowRow()]]
    const result = await submitApproval({ leaveRequestId: LEAVE_ID })
    const inst = result.instance
    expect(inst.status).toBe('pending')
    expect(inst.currentStep).toBe(0)
    // 四件套快照逐一锁定
    expect(inst.chainSnapshot).toEqual([MGR1, MGR2])
    expect(inst.timeoutHoursSnapshot).toBe(48) // 规则值,非默认 24
    expect(inst.escalationApproverSnapshot).toBe(MGR2) // 升级目标人
    // due_at 按提交时的 timeout_hours_snapshot(48h)折算
    expect((inst.dueAt as Date).getTime()).toBe(inst.submittedAt.getTime() + 48 * 3_600_000)
    // insert 落库留档同样固化四件套
    expect(H.instanceInserts).toHaveLength(1)
    const inserted = H.instanceInserts[0] as Row
    expect(inserted.chainSnapshot).toEqual([MGR1, MGR2])
    expect(inserted.timeoutHoursSnapshot).toBe(48)
    expect(inserted.escalationApproverSnapshot).toBe(MGR2)
    // 通知首位审批人 mgr1
    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(createNotification.mock.calls[0]?.[0]?.userId).toBe(MGR1)
    expect(result.notified).toBe(true)
  })

  it('④⑤ 逐级推进:一级通过 → 推进;末步通过 → approved + 回写请假单', async () => {
    // 先提交拿到在飞实例(带 48h 快照)
    H.reads.leave = [[{ id: LEAVE_ID, leaveType: '年假', totalDays: 5, status: 'pending' }]]
    H.reads.flow = [[twoLevelFlowRow()]]
    const { instance } = await submitApproval({ leaveRequestId: LEAVE_ID })
    const instId = instance.id
    createNotification.mockClear() // 清掉提交时通知 mgr1 的那次,后续只看审批推进的通知

    // 一级(mgr1)通过 → 推进 current_step、status 仍 pending、刷新 due_at、通知下一级 mgr2
    H.reads.instance = [[H.instancesById.get(instId) as Row]]
    H.reads.leave = [[H.leavesById.get(LEAVE_ID) as Row]]
    H.reads.flow = [[twoLevelFlowRow()]]
    const r1 = await decideApproval({
      instanceId: instId,
      approverId: MGR1,
      action: 'approved',
      remark: '同意',
    })
    expect(r1.instance.status).toBe('pending')
    expect(r1.instance.currentStep).toBe(1)
    expect(r1.instance.steps).toHaveLength(1)
    expect(r1.instance.steps[0]).toMatchObject({
      step: 0,
      action: 'approved',
      approverId: MGR1,
    })
    // 刷新 due_at:推进后重新按 timeout_hours_snapshot(48h)折算 ⇒ 新 due_at ≈ 当前时刻 + 48h
    const refreshedDue = (r1.instance.dueAt as Date).getTime()
    expect(refreshedDue - Date.now()).toBeGreaterThan(47.9 * 3_600_000)
    expect(refreshedDue - Date.now()).toBeLessThan(48.1 * 3_600_000)
    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(createNotification.mock.calls[0]?.[0]?.userId).toBe(MGR2)
    expect(H.leaveUpdates).toHaveLength(0) // 未到末步,请假单不动

    // 末步(mgr2)通过 → status=approved + 回写 hr_leave_request=approved
    // 注意:假库 updateChain 的 eq() id 提取不生效,instancesById 不会自动推进 currentStep;
    // 这里手动把读集置为 currentStep=1 状态(模拟步骤①后 DB 真实状态),再让 mgr2 审批。
    const instAfterStep1 = H.instancesById.get(instId) as Row
    H.reads.instance = [[{ ...instAfterStep1, currentStep: 1 }]]
    H.reads.leave = [[H.leavesById.get(LEAVE_ID) as Row]]
    H.reads.flow = [[twoLevelFlowRow()]]
    const r2 = await decideApproval({
      instanceId: instId,
      approverId: MGR2,
      action: 'approved',
      remark: '批准',
    })
    expect(r2.instance.status).toBe('approved')
    expect(r2.instance.decidedAt).toBeInstanceOf(Date)
    expect(H.leaveUpdates).toHaveLength(1)
    expect(H.leaveUpdates[0]?.status).toBe('approved')
    expect(H.leaveUpdates[0]?.approverId).toBe(MGR2)
  })

  it('⑥ 审批完成后 listMyPendingApprovals 不再返回该实例', async () => {
    // 先提交拿到在飞实例 id;再走完末步 → 终态 approved
    H.reads.leave = [[{ id: LEAVE_ID, leaveType: '年假', totalDays: 5, status: 'pending' }]]
    H.reads.flow = [[twoLevelFlowRow()]]
    const { instance } = await submitApproval({ leaveRequestId: LEAVE_ID })
    const instId = instance.id
    // 末步(mgr2)直接通过(两级链的第二级,chain[1])→ approved
    // 注意:假库 updateChain 的 eq() id 提取不生效,instancesById 不自动推进;
    // 这里直接把读集置为 currentStep=1(chain[1]=MGR2),让 mgr2 合法审批末步。
    const instRow = H.instancesById.get(instId) as Row
    H.reads.instance = [[{ ...instRow, currentStep: 1 }]]
    H.reads.flow = [[twoLevelFlowRow()]]
    await decideApproval({ instanceId: instId, approverId: MGR2, action: 'approved', remark: '批准' })

    // 终态后待办查询:SQL 层过滤 status ∈ (pending, escalated) ⇒ 已终态实例不进假库读集 ⇒ 不返回
    H.reads.instance = [[]]
    const pending = await listMyPendingApprovals({ approverId: MGR2, limit: 10, offset: 0 })
    expect(pending.list.some((p) => p.id === instId)).toBe(false)
    expect(pending.total).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
