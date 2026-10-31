// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 10 批 R10 —— 第三批回归锁（资金面 P1）。
 *
 *  R10-10【P1 一分钱买整档】`POST /api/payments/createOrder` 未做服务端价格反查。
 *         第 19 批只把 `resolveProductAmountCents` 接到支付调用点，下单侧仍自报金额；
 *         下 1 分钱的 orderType=2/5/6 订单，回调按 productId 激活整档权益（只查产品行
 *         不比对实付）⇒ 1 分钱买 VIP / 开发者套餐 / API 订阅配额。
 *
 *  R10-11【P1 银行信息泄露】`GET /api/finance/agent-withdrawal/list?userId=<victim>`
 *         任意登录用户可读他人提现单（含 accountInfo 收款账户）。
 *
 *  R10-12【P1 凭空提现】`POST /api/agent-ext/withdrawal/create` 无余额校验、不冻结资金，
 *         上限 10 万，安全性全押在"审批人不误批"。且 `PUT /withdrawal/:id` 允许本人
 *         把待审单金额从 1 元改成 10 万 —— 审批人看到的就是改后的行。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const read = (...rel: string[]) => readFileSync(resolve(ROOT, ...rel), 'utf8')

function blockOf(src: string, marker: string, span = 2200): string {
  const at = src.indexOf(marker)
  expect(at, `找不到 ${marker}（被删或改名，需同步本测试）`).toBeGreaterThan(-1)
  return src.slice(at, at + span)
}

// ---------------------------------------------------------------------------
// R10-10 下单金额服务端反查
// ---------------------------------------------------------------------------
describe('R10-10 基金下单必须服务端反查商品价', () => {
  const src = read('apps', 'api', 'src', 'routes', 'payment-gateway.ts')

  it('createOrder 调用了反查单源，并用反查结果覆盖客户端金额', () => {
    const block = blockOf(src, "'/payments/createOrder'", 2400)
    expect(block).toContain('resolveProductAmountCents(')
    // 覆盖形态：finalAmount = dbAmount ?? clientAmount，且 placeOrder 用的是 final
    expect(block).toContain('dbAmountCents ?? amountCents')
    expect(block).toContain('amount: finalAmountCents')
    // 不得再把客户端 amountCents 直接落库
    expect(block).not.toContain('amount: amountCents,')
  })

  it('反查单源覆盖 VIP / 开发者套餐 / API 订阅三档（不是只修一档）', () => {
    const at = src.indexOf('export async function resolveProductAmountCents')
    const block = src.slice(at, at + 4000)
    expect(block).toContain('vipLevels')
    expect(block).toContain('developerPricing')
    expect(block).toContain('plans')
    expect(block).toContain('isForSale')
  })

  it('反查在落库之前（顺序反了等于没查）', () => {
    const block = blockOf(src, "'/payments/createOrder'", 2400)
    const resolveAt = block.indexOf('resolveProductAmountCents(')
    const placeAt = block.indexOf('placeOrder({')
    expect(resolveAt).toBeGreaterThan(-1)
    expect(placeAt).toBeGreaterThan(resolveAt)
  })
})

// ---------------------------------------------------------------------------
// R10-11 提现列表读他人必须 admin
// ---------------------------------------------------------------------------
describe('R10-11 提现列表指定他人 userId 必须管理员', () => {
  const src = read('apps', 'api', 'src', 'routes', 'finance-extended.ts')

  it('userId 参数存在且非本人时先过 requireAdmin，并在已发送响应后立刻 return', () => {
    const block = blockOf(src, "'/finance/agent-withdrawal/list'", 2200)
    expect(block).toContain('userId !== request.userId')
    expect(block).toContain('await requireAdmin(request, reply)')
    expect(block).toContain('if (reply.sent) return')
    // 闸必须在查询之前
    const gateAt = block.indexOf('await requireAdmin(request, reply)')
    const queryAt = block.indexOf('.from(withdrawalFlows)')
    expect(queryAt).toBeGreaterThan(gateAt)
  })

  it('读自己不触发 admin 闸（不打断「我的提现」）', () => {
    const block = blockOf(src, "'/finance/agent-withdrawal/list'", 2200)
    // 条件是「传了 userId 且不等于自己」——不能写成「传了 userId 就闸」
    expect(block).not.toMatch(/if \(userId\) \{\s*await requireAdmin/)
  })
})

// ---------------------------------------------------------------------------
// R10-12 代理商提现：创建下线、金额不可改
// ---------------------------------------------------------------------------
describe('R10-12 代理商提现入口下线 + 金额不可改', () => {
  const src = read('apps', 'api', 'src', 'routes', 'agent-extended.ts')

  it('/withdrawal/create 不再落库，改为 410 + 指向正规通道', () => {
    const block = blockOf(src, "'/withdrawal/create'", 2000)
    expect(block).toContain('410')
    expect(block).toContain('/api/wallet/withdraw')
    // 不得再 INSERT 这张无资金支撑的表
    expect(block).not.toContain('.insert(zhsAgentWithdrawalDetail)')
  })

  it('全文件不再有对 zhsAgentWithdrawalDetail 的 insert（结构性移除，不是注释掉）', () => {
    expect(src).not.toContain('.insert(zhsAgentWithdrawalDetail)')
  })

  it('PUT /withdrawal/:id 的 schema 不接受 amount / type', () => {
    const at = src.indexOf('const withdrawalUpdateSchema')
    expect(at).toBeGreaterThan(-1)
    const block = src.slice(at, src.indexOf('server.put(', at))
    expect(block).not.toMatch(/^\s*amount\s*:/m)
    expect(block).not.toMatch(/^\s*type\s*:/m)
    expect(block).toContain('bankInfo')
  })

  it('PUT 的 update set 不再引用 amount / type（防 schema 移了 set 没移）', () => {
    const at = src.indexOf("server.put('/withdrawal/:id'")
    expect(at).toBeGreaterThan(-1)
    const block = src.slice(at, at + 2600)
    expect(block).not.toContain('body.amount')
    expect(block).not.toContain('body.type')
  })

  it('审核/处理端点仍 admin-only（下线创建不等于放宽审批）', () => {
    expect(blockOf(src, "'/withdrawal/:id/review'", 400)).toContain('preHandler: requireAdmin')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
