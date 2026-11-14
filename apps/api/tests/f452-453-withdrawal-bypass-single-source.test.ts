// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-452 / F-453 回归锁:提现旁路写入口必须复用统一提现服务(单源资金守恒)。
 *
 * 缺陷(见 docs/tickets/2026-11/findings-api.md#F-452 / #F-453):
 *   F-452 finance-extended 的 agent-withdrawal apply/approve/reject 绕开统一服务,自管
 *   withdrawalFlows:apply 不冻结、不生成 partnerTradeNo(回调 eq(partnerTradeNo) 永远匹配
 *   不到 ⇒ 单据无法闭环);approve 仅 currentStatus+1 无前置断言(可把已完成单再推进、两次
 *   释放冻结);reject 的 where 只有 id(可把已完成(2)改回 3、不退冻结 ⇒ 已打款单被驳回后
 *   可用额复原、可重复申请 ⇒ 资金损失)。
 *   F-453 admin-extended/order-routes 的第 5 条写入口同样直接 status=2|3、where 只有 id,
 *   无冻结释放/无退款/无守卫(0→2 后回调只处理 0/1 ⇒ 冻结永久沉淀;reject 丢 token)。
 *
 * 修复:三处 finance-extended 入口 + admin 旁路全部改调 commission-queries 单源
 *   applyWithdrawal / approveWithdrawal / rejectWithdrawal(冻结/单号/状态守卫/退冻结同源)。
 *   本锁钉住:旁路文件必须调用单源服务、且不得再出现「直写 withdrawalFlows.status」的旁路。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const financeExt = resolve(REPO_ROOT, 'apps/api/src/routes/finance-extended.ts')
const adminOrder = resolve(REPO_ROOT, 'apps/api/src/routes/admin-extended/order-routes.ts')

describe('F-452:finance-extended agent-withdrawal 必须走单源提现服务', () => {
  it('接线锁:必须 import 单源服务 apply/approve/rejectWithdrawal', () => {
    const src = readFileSync(financeExt, 'utf8')
    expect(src).toContain('applyWithdrawal')
    expect(src).toContain('approveWithdrawal')
    expect(src).toContain('rejectWithdrawal')
  })

  it('接线锁:apply 走 applyWithdrawal 且保持「仅佣金可提现」口径', () => {
    const src = readFileSync(financeExt, 'utf8')
    expect(src).toMatch(/await\s+applyWithdrawal\(/)
    expect(src).toMatch(/requireCommissionEligibility:\s*true/)
  })

  it('接线锁:approve/reject 必须走单源服务(带状态守卫),不得再自增推进提现状态', () => {
    const src = readFileSync(financeExt, 'utf8')
    expect(src).toMatch(/await\s+approveWithdrawal\(/)
    expect(src).toMatch(/await\s+rejectWithdrawal\(/)
    // 剥离注释行(// ...)再判定,避免「修复说明里描述旧行为」被当成仍在使用旧行为。
    const codeOnly = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
    // 精确取 approve handler 段(路由串起 → reject 路由串起之前):margin 调整(文件尾部)
    // 的合法自增/表更新与本票无关,不纳入判定范围。
    const approveStart = codeOnly.indexOf("'/finance/agent-withdrawal/:id/approve'")
    const rejectStart = codeOnly.indexOf("'/finance/agent-withdrawal/:id/reject'")
    expect(approveStart).toBeGreaterThan(-1)
    expect(rejectStart).toBeGreaterThan(approveStart)
    const approveSegment = codeOnly.slice(approveStart, rejectStart)
    expect(approveSegment).not.toMatch(/currentStatus\s*\+\s*1/)
    expect(approveSegment).not.toMatch(/\.update\(withdrawalFlows\)/)
  })

  it('行为锁:apply/reject/approve 不再出现旁路直插 withdrawalFlows(不冻结/不生成单号)', () => {
    const src = readFileSync(financeExt, 'utf8')
    // 剥离注释行后判定:修复说明里的旧行为描述不应被当成仍在使用。
    const codeOnly = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
    // agent-withdrawal 三入口原先直接 insert withdrawalFlows(不冻结 ⇒ 成功回调把 frozen 扣负/
    // 失败回调凭空铸币)。统一服务在事务内原子冻结并生成 partnerTradeNo,旁路 insert 必须消失。
    expect(codeOnly).not.toMatch(/\.insert\(withdrawalFlows\)/)
  })
})

describe('F-453:admin shop withdrawals 旁路写入口必须改调单源服务', () => {
  it('接线锁:必须 import approve/rejectWithdrawal 并调用', () => {
    const src = readFileSync(adminOrder, 'utf8')
    expect(src).toContain('approveWithdrawal')
    expect(src).toContain('rejectWithdrawal')
    expect(src).toMatch(/action\s*===\s*'approve'/)
  })

  it('行为锁:不得再出现「直接 set status=2|3 且 where 只有 id」的旁路 UPDATE', () => {
    const src = readFileSync(adminOrder, 'utf8')
    // 剥离注释行后判定:修复说明里的旧行为描述不应被当成仍在使用。
    const codeOnly = src
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
    // 旧的旁路:const status = action==='approve'?2:3; .update(withdrawalFlows).set({status,...}).where(eq(id))
    expect(codeOnly).not.toMatch(/action\s*===\s*'approve'\s*\?\s*2\s*:\s*3/)
    expect(codeOnly).not.toMatch(/\.update\(withdrawalFlows\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
