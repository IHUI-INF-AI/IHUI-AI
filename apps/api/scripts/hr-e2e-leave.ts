// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * HR-3 员工请假端到端联调(临时脚本,用真实库 + 真实 service 层驱动整链)。
 * 场景:员工提交 5 天年假 → 命中"3~∞天"规则(两级链 mgr1→mgr2 + 48h超时 + 升级目标mgr2)
 *       → 验证提交时四件套快照落库 → 逐级审批推进 → 末步通过回写请假单。
 */
import { config } from 'dotenv'
config({ path: new URL('../../../.env', import.meta.url).pathname })

import { createHrLeave } from '../src/services/hr-attendance.js'
import {
  submitApproval,
  decideApproval,
  listMyPendingApprovals,
} from '../src/services/hr-approval.js'
import { db } from '../src/db/index.js'
import { hrLeaveRequest } from '@ihui/database'
import { eq } from 'drizzle-orm'

// 种子标记(上一步写入)
const empId = '49da441a-ca46-4c51-90ad-6a41ce81a212'
const deptId = '770fb992-7fa3-4746-b378-3ea59a979054'
// 从库回读审批链(避免硬编码 user id)
import { hrApprovalFlow } from '@ihui/database'
const flows = await db.select().from(hrApprovalFlow).where(eq(hrApprovalFlow.leaveType, '年假'))
const twoLevel = flows.find((f) => f.minDays === 3) // 3~∞ 两级链
if (!twoLevel) {
  console.error('❌ 未找到「年假」3 天以上的两级审批链规则,请先在后台配置后再跑本联调')
  process.exit(1)
}
// approverIds 类型是 string[](非空数组),解构元素被 TS 推导为 string,`!mgr1` 守卫恒假;
// 故先判 length 再解构,真跑不足 2 人时让守卫真正生效。
if (twoLevel.approverIds.length < 2) {
  console.error(`❌ 两级审批链 approverIds 不足 2 人(实得 ${twoLevel.approverIds.length})`)
  process.exit(1)
}
const [mgr1, mgr2] = twoLevel.approverIds

let step = 0
const ok = (label: string, cond: boolean, extra?: unknown) => {
  step += 1
  console.log(
    `${cond ? '✅' : '❌'} [${step}] ${label}`,
    extra !== undefined ? JSON.stringify(extra) : '',
  )
  if (!cond) process.exitCode = 1
}

// ① 创建请假单:5 天年假
const leave = await createHrLeave({
  employeeId: empId,
  departmentId: deptId,
  leaveType: '年假',
  startDate: '2026-11-16',
  endDate: '2026-11-20',
  totalDays: 5,
  reason: '端到端联调·5天年假',
})
if (!leave?.id) {
  console.error('❌ 创建请假单失败(未取回 id),后续步骤无法进行')
  process.exit(1)
}
ok('创建请假单', true, { leaveId: leave.id.slice(0, 8), status: leave.status })

// ② 提交进多级审批流(固化四件套快照)
const submit = await submitApproval({ leaveRequestId: leave.id })
const inst = submit.instance
ok('提交进审批流', inst.status === 'pending' && inst.currentStep === 0, {
  instanceId: inst.id.slice(0, 8),
})

// ③ 核心验证:四件套快照是否落库固化
ok('链快照 = [mgr1, mgr2]', JSON.stringify(inst.chainSnapshot) === JSON.stringify([mgr1, mgr2]), {
  chain: inst.chainSnapshot.map((x: string) => x.slice(0, 8)),
})
ok('超时时限快照 = 48h(规则值,非默认24)', inst.timeoutHoursSnapshot === 48, {
  v: inst.timeoutHoursSnapshot,
})
ok('升级目标快照 = mgr2', inst.escalationApproverSnapshot === mgr2, {
  v: inst.escalationApproverSnapshot?.slice(0, 8),
})
// dueAt 在实例未真正排期时为 null:此时判 NaN 即失败,不让缺值伪装成 48h
const dueHours =
  inst.dueAt && inst.submittedAt
    ? (inst.dueAt.getTime() - inst.submittedAt.getTime()) / 3_600_000
    : Number.NaN
ok('due_at 按 48h 折算', Math.round(dueHours) === 48, { dueHours: Math.round(dueHours) })

// ④ 逐级审批:一级通过 → 推进到二级
const r1 = await decideApproval({
  instanceId: inst.id,
  approverId: mgr1,
  action: 'approved',
  remark: '同意',
})
ok(
  '一级审批通过 → 推进 currentStep=1',
  r1.instance.currentStep === 1 && r1.instance.status === 'pending',
  {
    step: r1.instance.currentStep,
  },
)

// ⑤ 末步通过 → 终态 approved + 回写请假单
const r2 = await decideApproval({
  instanceId: inst.id,
  approverId: mgr2,
  action: 'approved',
  remark: '批准',
})
ok('末步审批通过 → status=approved', r2.instance.status === 'approved')

const leaveAfter = (
  await db.select().from(hrLeaveRequest).where(eq(hrLeaveRequest.id, leave.id))
)[0]
ok('请假单回写 = approved', leaveAfter?.status === 'approved', { status: leaveAfter?.status })

// ⑥ 待办列表:审批完成后 mgr1 不应再看到该实例
const pending = await listMyPendingApprovals({ approverId: mgr1, limit: 10, offset: 0 })
ok('审批人待办已清空该实例', !pending.list.some((p) => p.id === inst.id), {
  remaining: pending.total,
})

console.log(`\n端到端联调完成:${step} 步,exitCode=${process.exitCode ?? 0}`)
process.exit(process.exitCode ?? 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
