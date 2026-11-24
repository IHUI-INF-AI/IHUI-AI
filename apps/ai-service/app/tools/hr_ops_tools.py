# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""人事动作工具:生命周期 + 发薪闭环(2026-11-23 立)。

补齐的两段"AI 到不了":
  · hr_lifecycle_ops —— 合同签发/续签/解除、试用转正评估、离职申请→批准→办结(含离职证明)、
    招聘岗位→候选人→面试→录用入职(录用会真的建员工 + 建合同草稿);
  · hr_payout_ops —— 员工收款账户、代发批次、导出银行批量文件、标记交银行/到账、工资条生成/推送/签收。

纪律:
  · 录用只走 candidate.hire(带工号与部门);裸推进 hired 会被后端拒绝(避免"已入职却无主档");
  · 离职办结要求交接清单全为 true,缺项时后端会点名缺哪条,照它补齐再提交;
  · 导出银行文件含明文卡号,只在被明确要求"导出代发文件"时调用,不要把内容转述给无关人。
"""

from __future__ import annotations

from typing import Any

from .api_ops_common import dispatch

HR_LIFECYCLE_ROUTES: dict[str, tuple[str, str]] = {
    "contract.create": ("POST", "/api/hr-lifecycle/contracts"),
    "contract.list": ("GET", "/api/hr-lifecycle/contracts"),
    "contract.summary": ("GET", "/api/hr-lifecycle/contracts/summary"),
    "contract.expiring": ("GET", "/api/hr-lifecycle/contracts/expiring"),
    "contract.sign": ("POST", "/api/hr-lifecycle/contracts/:id/sign"),
    "contract.terminate": ("POST", "/api/hr-lifecycle/contracts/:id/terminate"),
    "contract.expire": ("POST", "/api/hr-lifecycle/contracts/:id/expire"),
    "contract.renew": ("POST", "/api/hr-lifecycle/contracts/:id/renew"),
    "probation.review": ("POST", "/api/hr-lifecycle/probation/reviews"),
    "probation.list": ("GET", "/api/hr-lifecycle/probation/reviews"),
    "probation.due": ("GET", "/api/hr-lifecycle/probation/due"),
    "resign.apply": ("POST", "/api/hr-lifecycle/resignations"),
    "resign.list": ("GET", "/api/hr-lifecycle/resignations"),
    "resign.approve": ("POST", "/api/hr-lifecycle/resignations/:id/approve"),
    "resign.cancel": ("POST", "/api/hr-lifecycle/resignations/:id/cancel"),
    "resign.settle": ("POST", "/api/hr-lifecycle/resignations/:id/settle"),
    "resign.certificate": ("GET", "/api/hr-lifecycle/resignations/:id/certificate"),
    "opening.create": ("POST", "/api/hr-lifecycle/openings"),
    "opening.list": ("GET", "/api/hr-lifecycle/openings"),
    "opening.status": ("POST", "/api/hr-lifecycle/openings/:id/status"),
    "candidate.create": ("POST", "/api/hr-lifecycle/candidates"),
    "candidate.list": ("GET", "/api/hr-lifecycle/candidates"),
    "candidate.advance": ("POST", "/api/hr-lifecycle/candidates/:id/advance"),
    "candidate.interviews": ("POST", "/api/hr-lifecycle/candidates/:id/interviews"),
    "candidate.hire": ("POST", "/api/hr-lifecycle/candidates/:id/hire"),
    "interview.list": ("GET", "/api/hr-lifecycle/interviews"),
    "interview.feedback": ("POST", "/api/hr-lifecycle/interviews/:id/feedback"),
    "recruitment.summary": ("GET", "/api/hr-lifecycle/recruitment/summary"),
    "overview": ("GET", "/api/hr-lifecycle/overview"),
}

HR_PAYOUT_ROUTES: dict[str, tuple[str, str]] = {
    "bank.set": ("PUT", "/api/hr-payout/employees/:employeeId/bank"),
    "bank.get": ("GET", "/api/hr-payout/employees/:employeeId/bank"),
    "bank.coverage": ("GET", "/api/hr-payout/bank-coverage"),
    "batch.build": ("POST", "/api/hr-payout/batches"),
    "batch.list": ("GET", "/api/hr-payout/batches"),
    "batch.export": ("POST", "/api/hr-payout/batches/:id/export"),
    "batch.submit": ("POST", "/api/hr-payout/batches/:id/submit"),
    "batch.paid": ("POST", "/api/hr-payout/batches/:id/paid"),
    "payslip.generate": ("POST", "/api/hr-payout/payslips/generate"),
    "payslip.push": ("POST", "/api/hr-payout/payslips/push"),
    "payslip.list": ("GET", "/api/hr-payout/payslips"),
    "payslip.acknowledge": ("POST", "/api/hr-payout/payslips/:id/acknowledge"),
    "summary": ("GET", "/api/hr-payout/summary"),
}

# 人事补口(2026-11-24):排班 / 社保增减员 / 年终奖 / 经济补偿 / 算薪复核
HR_GAP_ROUTES: dict[str, tuple[str, str]] = {
    "shift.list": ("GET", "/api/hr-shift/shifts"),
    "shift.create": ("POST", "/api/hr-shift/shifts"),
    "shift.update": ("PATCH", "/api/hr-shift/shifts/:id"),
    "shift.delete": ("DELETE", "/api/hr-shift/shifts/:id"),
    "shift.assign": ("POST", "/api/hr-shift/assignments"),
    "shift.assignments": ("GET", "/api/hr-shift/assignments"),
    "shift.calendar": ("GET", "/api/hr-shift/calendar"),
    "shift.assignment.delete": ("DELETE", "/api/hr-shift/assignments/:id"),
    "social.list": ("GET", "/api/hr-shift/social-changes"),
    "social.create": ("POST", "/api/hr-shift/social-changes"),
    "social.summary": ("GET", "/api/hr-shift/social-changes/summary"),
    "social.submit": ("POST", "/api/hr-shift/social-changes/:id/submit"),
    "social.accepted": ("POST", "/api/hr-shift/social-changes/:id/accepted"),
    "social.failed": ("POST", "/api/hr-shift/social-changes/:id/failed"),
    "bonus.calc": ("POST", "/api/hr-comp/bonus/calc"),
    "bonus.create": ("POST", "/api/hr-comp/bonus-payments"),
    "bonus.list": ("GET", "/api/hr-comp/bonus-payments"),
    "severance.calc": ("POST", "/api/hr-comp/severance/calc"),
    "severance.create": ("POST", "/api/hr-comp/severance-records"),
    "severance.list": ("GET", "/api/hr-comp/severance-records"),
    "payroll.submit": ("POST", "/api/hr-comp/payroll/submit"),
    "payroll.review": ("POST", "/api/hr-comp/payroll/review"),
    "payroll.trail": ("GET", "/api/hr-comp/payroll/review-trail"),
    "expense.submit": ("POST", "/api/hr-expense/"),
    "expense.mySubmit": ("POST", "/api/hr-expense/my/submit"),
    "expense.my": ("GET", "/api/hr-expense/my"),
    "expense.list": ("GET", "/api/hr-expense/"),
    "expense.get": ("GET", "/api/hr-expense/:id"),
    "expense.decide": ("POST", "/api/hr-expense/:id/decide"),
    "expense.pay": ("POST", "/api/hr-expense/:id/pay"),
    "expense.linkVoucher": ("POST", "/api/hr-expense/:id/link-voucher"),
    "expense.void": ("POST", "/api/hr-expense/:id/void"),
}

HR_LIFECYCLE_DESCRIPTION = (
    "人事生命周期动作入口(调 apps/api /api/hr-lifecycle,权限 RBAC 现问)。"
    "action 取值:" + ", ".join(sorted(HR_LIFECYCLE_ROUTES)) + "。"
    "payload 放该动作参数;路径参数(id/employeeId)放同名键。"
    "典型串法:① 新员工 = opening.create(open)→ candidate.create → candidate.advance(screening)"
    "→ candidate.interviews(安排面试,自动进 interview)→ interview.feedback(pass)"
    "→ candidate.advance(offer)→ candidate.hire(工号+部门,自动建员工与合同草稿)→ contract.sign;"
    "② 转正 = probation.due(查到期未评估)→ probation.review(result=pass 写转正日期,extend 必带 extendedUntil);"
    "③ 离职 = resign.apply(最后工作日)→ resign.approve → resign.settle(交接清单全 true,自动置员工离职+出具证明)→ resign.certificate。"
    "日期一律 YYYY-MM-DD;解除合同必须给原因(terminate.reason ≥2 字)。"
)

HR_PAYOUT_DESCRIPTION = (
    "发薪闭环动作入口(调 apps/api /api/hr-payout)。"
    "action 取值:" + ", ".join(sorted(HR_PAYOUT_ROUTES)) + "。"
    "典型串法:bank.set(卡号 8~32 位纯数字,可含空格)→ bank.coverage(查谁缺账户)"
    "→ batch.build(month,可只发部分人)→ batch.export(得到 CSV 文本+sha256 指纹)"
    "→ batch.submit(标记已交银行)→ batch.paid(到账,周期同步 paid)"
    "→ payslip.generate → payslip.push → payslip.acknowledge。"
    "已到账批次不能再导出;缺卡号的人进 missingAccounts,不阻断整批。"
    "payslip.push 现在会真发站内通知(幂等),没有账号的人不会被标成已推送。"
)

HR_GAP_DESCRIPTION = (
    "人事补口动作入口(调 /api/hr-shift 与 /api/hr-comp)。"
    "action 取值:" + ", ".join(sorted(HR_GAP_ROUTES)) + "。"
    "排班:shift.create(班次定义)→ shift.assign(人+日期数组+shiftId)→ shift.calendar(月历);"
    "日结会优先取当日排班。社保:入职/离职已自动落 pending 增减员,social.submit/accepted/failed 回填平台回执;"
    "奖金:bonus.calc 先试算(单独计税),bonus.create 落台账;"
    "补偿:severance.calc 需 hireDate/lastWorkDate/monthlyAvgWage/localAvgMonthlyWage 四个事实,缺一不猜;"
    "复核:payroll.submit 提交留痕,payroll.review 批准/退回(提交人不得自批)。"
    "报销:expense.mySubmit(自助,服务端认本人档案)或 expense.submit(管理代提,必须附票据影像+审批链,"
    "非当前步审批人不可操作,提交人不能是自己单的唯一审批人)→ expense.decide 逐级 approve/reject "
    "→ expense.pay(bank/cash)→ expense.linkVoucher 生成正式账凭证(幂等,需账套);"
    "已付款不可作废,要回冲走红冲凭证。"
)


async def hr_lifecycle_ops(arguments: Any) -> dict[str, Any]:  # noqa: ARG001
    """合同/转正/离职/招聘动作。"""
    return await dispatch("hr_lifecycle_ops", arguments, HR_LIFECYCLE_ROUTES)


async def hr_payout_ops(arguments: Any) -> dict[str, Any]:  # noqa: ARG001
    """发薪闭环动作。"""
    return await dispatch("hr_payout_ops", arguments, HR_PAYOUT_ROUTES)


async def hr_gap_ops(arguments: Any) -> dict[str, Any]:  # noqa: ARG001
    """排班/社保增减员/年终奖/经济补偿/算薪复核动作(2026-11-24 补口)。"""
    return await dispatch("hr_gap_ops", arguments, HR_GAP_ROUTES)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
