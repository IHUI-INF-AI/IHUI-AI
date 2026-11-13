// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-404 回归锁:返佣基数取「被邀请人钱包总余额」而非本单 token 数 ⇒ 反复放大铸币。
 *
 * 缺陷(见 docs/tickets/2026-11/findings-api.md#F-404):
 *   邀请关系 A→B。B 历史余额 10 万 token,再下一笔 1 分钱订单 → 回调先 completeOrderWithSaga
 *   充值完成 → payment-gateway 三/四处 `getBalance` 取到「含历史余额」的 10 万 →
 *   `calcReturnToken(100000, proportion)` 给 A 返佣。返佣基数与订单解耦;calcReturnToken 也
 *   不区分 orderType,会员/身份单同样按 token 返佣。小额复购可对历史余额无限重复抽佣,
 *   返佣 token 直接进钱包且可提现 ⇒ 放大铸币。
 *
 * 修复:① createCommissionFlows 事务内按已锁订单的 orderNo 查 token_flows
 *   (related_order_no + op_type=0 充值)取**本单实际入账增量**作为返佣基数;非 token 充值单
 *   无此流水 → baseTokens=0 → 不发 token 佣金。② payment-gateway 四处返佣点移除
 *   getBalance 的 tokenQuantity,UserLike 只传 id(不再把钱包总余额喂进返佣)。
 *   本锁钉住:服务侧必须用本单流水增量、且 payment-gateway 返佣点不得再回退到 getBalance。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const svc = resolve(REPO_ROOT, 'apps/api/src/services/commission-service.ts')
const gw = resolve(REPO_ROOT, 'apps/api/src/routes/payment-gateway.ts')

describe('F-404:返佣基数必须是本单 token 增量(非钱包总余额)', () => {
  it('接线锁:事务内锁定订单须同时取 orderNo', () => {
    const src = readFileSync(svc, 'utf8')
    // 锁行 select 必须带 orderNo——它是后续按单查 token_flows 增量的键
    expect(src).toMatch(/\.select\(\{\s*id:\s*orders\.id,\s*orderNo:\s*orders\.orderNo\s*\}\)/)
  })

  it('接线锁:按本单充值流水(opType=0 + relatedOrderNo)取增量', () => {
    const src = readFileSync(svc, 'utf8')
    expect(src).toContain('tokenFlows')
    // 充值流水判据:related_order_no = 本单 orderNo 且 op_type = 0(充值)
    expect(src).toMatch(/eq\(\s*tokenFlows\.relatedOrderNo,\s*lockedOrder\.orderNo\s*\)/)
    expect(src).toMatch(/eq\(\s*tokenFlows\.opType,\s*0\s*\)/)
  })

  it('行为锁:普通用户父级返佣用本单增量 baseTokens,非 user.tokenQuantity', () => {
    const src = readFileSync(svc, 'utf8')
    expect(src).toMatch(/calcReturnToken\(\s*baseTokens,\s*proportion\s*\)/)
    // 旧的「拿钱包总余额算返佣」必须消失
    expect(src).not.toMatch(/calcReturnToken\(\s*user\.tokenQuantity/)
  })

  it('行为锁:非 token 单无充值流水 → baseTokens 初始化为 0(不发 token 佣金)', () => {
    const src = readFileSync(svc, 'utf8')
    expect(src).toMatch(/let\s+baseTokens\s*=\s*0/)
  })
})

describe('F-404:payment-gateway 返佣点不得再喂钱包总余额', () => {
  it('行为锁:四处 feedbackInvite 调用不再传 tokenQuantity', () => {
    const src = readFileSync(gw, 'utf8')
    // 旧形态:const tokenQuantity = await getBalance(...); feedbackInvite({id, tokenQuantity}, ...)
    expect(src).not.toMatch(/feedbackInvite\(\s*\{\s*id:[^}]*tokenQuantity/)
    expect(src).not.toMatch(
      /const\s+tokenQuantity\s*=\s*await\s+getBalance\([^)]*\)\s*\n\s*await\s+feedbackInvite/,
    )
  })

  it('接线锁:getBalance 仍保留(非返佣的余额查询用),但返佣链不再依赖它', () => {
    const src = readFileSync(gw, 'utf8')
    // import 仍在(getBalance 另有合法用途),但返佣调用点已不取 tokenQuantity
    expect(src).toMatch(/import\s*\{[^}]*getBalance[^}]*\}\s*from/)
    expect(src).not.toMatch(/const\s+tokenQuantity\s*=\s*await\s+getBalance/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
