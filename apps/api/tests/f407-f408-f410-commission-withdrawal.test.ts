// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 佣金三联票回归锁(见 docs/tickets/2026-11/findings-api.md#F-407/#F-408/#F-410):
 *
 * F-407 退款不冲减佣金,退款单佣金仍可提现
 *   修复:refundOrder 在本金扣回后、落 refunded 前调 revokeOrderCommissions —— 按订单将
 *   commissionFlows 置 status=0(不再计入 availableWithdrawal),并对已入账 token 佣金
 *   refundTokenDeduct 冲减(幂等键 comm:<flow.id>)。失败与 F-33 同语义(订单保持 paid 重试)。
 *
 * F-408 佣金入钱包不写 token_flows,账实断链
 *   修复:createCommissionFlow 在 UPSERT userMargins 后同事务补 opType=4 流水
 *   (含 quantity 与 balanceAfter),口径对齐 relay-billing-service API Key 充值的钱包转出记账。
 *   同时接收 outerTx 实现 F-436 并入外层事务(不再另开嵌套事务)。
 *
 * F-410 开发者提现只冻结不扣余额,冻结额仍可被钱包消费路径花掉
 *   修复:POST /developer/withdrawals 改为「申请即扣减」—— tokenQuantity -= amount、
 *   frozenQuantity += amount(DB 级 WHERE 防超发),对齐 applyWithdrawal(F-406)口径;
 *   展示层 /income 的可用余额同步改为直接读 tokenQuantity(不再减 frozen,防双重扣)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const orderSvc = resolve(REPO_ROOT, 'apps/api/src/services/order-service.ts')
const commQueries = resolve(REPO_ROOT, 'apps/api/src/db/commission-queries.ts')
const developer = resolve(REPO_ROOT, 'apps/api/src/routes/developer.ts')

describe('F-407:退款必须冲减佣金(置无效 + 冲减已入账 token 佣金)', () => {
  it('接线锁:存在 revokeOrderCommissions 且注释锚定 F-407', () => {
    const src = readFileSync(orderSvc, 'utf8')
    expect(src).toMatch(/async function revokeOrderCommissions/)
    expect(src).toContain('F-407')
  })

  it('接线锁:revokeOrderCommissions 把该单佣金置 status=0', () => {
    const src = readFileSync(orderSvc, 'utf8')
    // 按订单将佣金置无效 —— 不再计入 availableWithdrawal 的 status=1 求和
    expect(src).toMatch(
      /update\(commissionFlows\)\.set\(\{\s*status:\s*0\s*\}\)\.where\(eq\(commissionFlows\.orderId/,
    )
  })

  it('接线锁:已入账 token 佣金走 refundTokenDeduct 冲减(幂等键 comm:<id>)', () => {
    const src = readFileSync(orderSvc, 'utf8')
    expect(src).toMatch(/refundTokenDeduct\(\s*flow\.beneficiaryId,\s*flow\.token,\s*`comm:\$\{flow\.id\}`/)
  })

  it('行为锁:仅冲减已发放(status=1)且 token>0 的佣金,不动现金佣金', () => {
    const src = readFileSync(orderSvc, 'utf8')
    expect(src).toMatch(/flow\.status === 1 && flow\.token > 0 && flow\.beneficiaryId/)
  })

  it('接线锁:refundOrder 在落 refunded 前调用 revokeOrderCommissions', () => {
    const src = readFileSync(orderSvc, 'utf8')
    // 取 refundOrder 函数体(从 export async function refundOrder 起)内判断先后,
    // 避免全局 indexOf 命中更早的 claimRefund 里那处 refunded 迁移。
    // F-371 重构后 refunded 落库走事务版 updateOrderStatus(..., null, tx)。
    const fnStart = src.indexOf('export async function refundOrder')
    const body = src.slice(fnStart)
    const idxRevoke = body.indexOf('await revokeOrderCommissions(order)')
    const idxStatus = body.indexOf("updateOrderStatus(orderNo, 'refunded', 'paid'")
    expect(idxRevoke).toBeGreaterThan(-1)
    expect(idxStatus).toBeGreaterThan(-1)
    expect(idxRevoke).toBeLessThan(idxStatus)
  })

  it('行为锁:冲减失败订单保持 paid 等待重试(alreadyClaimed 先 abortRefund)', () => {
    const src = readFileSync(orderSvc, 'utf8')
    expect(src).toMatch(/await revokeOrderCommissions\(order\)\s*\}\s*catch\s*\(e\)\s*\{\s*if \(alreadyClaimed\) await abortRefund/)
  })
})

describe('F-408:佣金入钱包必须写 token_flows 流水(账实一致)', () => {
  it('接线锁:createCommissionFlow 同事务补 opType=4 流水', () => {
    const src = readFileSync(commQueries, 'utf8')
    // UPSERT userMargins(佣金转钱包)与 tokenFlows(opType=4 流水)同事务紧邻
    expect(src).toMatch(/onConflictDoUpdate\(\{\s*target:\s*userMargins\.userId/)
    expect(src).toMatch(/await tx\.insert\(tokenFlows\)\.values\(\{\s*userId:\s*input\.beneficiaryId,\s*opType:\s*4/)
  })

  it('行为锁:流水含 quantity(入账数量)与 balanceAfter(入账后余额)', () => {
    const src = readFileSync(commQueries, 'utf8')
    // opType=4 流水块内必含 quantity(入账数量)与 balanceAfter(入账后余额),DOTALL 跨多行
    expect(src).toMatch(/opType:\s*4,[\s\S]*?quantity:\s*input\.token,[\s\S]*?balanceAfter:/)
  })

  it('行为锁:仅当 token>0 才写流水(现金佣金不入钱包)', () => {
    const src = readFileSync(commQueries, 'utf8')
    expect(src).toMatch(/if \(flow && input\.token > 0\)/)
  })

  it('接线锁:signature 接收 outerTx 实现 F-436 并入外层事务', () => {
    const src = readFileSync(commQueries, 'utf8')
    expect(src).toMatch(/\n\s*outerTx\?:\s*DbTx,/)
    expect(src).toMatch(/if \(outerTx\) return run\(outerTx\)/)
  })
})

describe('F-410:开发者提现申请即扣减可用余额(对齐 applyWithdrawal F-406 口径)', () => {
  it('行为锁:申请时 tokenQuantity -= amount(不再只加 frozen 不减余额)', () => {
    const src = readFileSync(developer, 'utf8')
    expect(src).toMatch(
      /tokenQuantity:\s*sql`\$\{userMargins\.tokenQuantity\}\s*-\s*\$\{amount\}`/,
    )
  })

  it('行为锁:申请时 frozenQuantity += amount(冻结记账保留)', () => {
    const src = readFileSync(developer, 'utf8')
    expect(src).toMatch(
      /frozenQuantity:\s*sql`\$\{userMargins\.frozenQuantity\}\s*\+\s*\$\{amount\}`/,
    )
  })

  it('行为锁:DB 级 WHERE 防超发(token_quantity >= amount)', () => {
    const src = readFileSync(developer, 'utf8')
    expect(src).toMatch(/sql`\$\{userMargins\.tokenQuantity\}\s*>=\s*\$\{amount\}`/)
  })

  it('行为锁:balanceAfter 取扣减后真实余额(returning)', () => {
    const src = readFileSync(developer, 'utf8')
    expect(src).toMatch(
      /\.returning\(\{\s*tokenQuantity:\s*userMargins\.tokenQuantity\s*\}\)/,
    )
  })

  it('行为锁:/income 展示层不再双重扣(available = tokenQuantity,不减 frozen)', () => {
    const src = readFileSync(developer, 'utf8')
    // 旧形态:(margin?.tokenQuantity ?? 0) - (margin?.frozenQuantity ?? 0) ⇒ 双重扣
    expect(src).not.toMatch(
      /\(margin\?\.tokenQuantity \?\? 0\)\s*-\s*\(margin\?\.frozenQuantity \?\? 0\)/,
    )
    // 新形态:直接用 tokenQuantity 作为可用
    expect(src).toMatch(/const available = margin\?\.tokenQuantity \?\? 0/)
  })
})
