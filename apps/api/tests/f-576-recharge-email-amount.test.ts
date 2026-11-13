// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-576 回归锁(2026-11-13)。
 *
 * 病灶:充值成功邮件把 token 数量与订单金额(分)相加再除以 100 当「金额」,
 * tokenDelta=1_000_000 / costDeltaCents=0 的充值会渲染出 ¥10000.00(真实 ¥0.00)。
 *
 * 本文件锁:
 *   ① 金额只取订单分金额换算两位小数(token 数量不参与任何加法);
 *   ② 渲染出的邮件正文(html/text)金额 === 订单分/100,token 数量只出现在到账额度位置;
 *   ③ 路由装车:充值处理器取金额走同一函数,不得复活「token + 分」混用公式。
 *
 * 纯函数 + 邮件模板渲染,不连 DB / 邮件服务。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { buildWalletRechargeMailAmounts } from '../src/routes/developer-relay.js'
import { renderWalletRechargeEmail } from '../src/services/email-templates.js'

const KEYS_URL = 'https://aizhs.top/models/keys'

function render(costDeltaCents: number | undefined, tokenDelta: number | undefined) {
  const amounts = buildWalletRechargeMailAmounts({ costDeltaCents, tokenDelta })
  const mail = renderWalletRechargeEmail({
    keyName: 'relay-key',
    costYuan: amounts.costYuan,
    creditTokens: amounts.creditTokens,
    newTokenBalance: tokenDelta ?? 0,
    keysUrl: KEYS_URL,
  })
  return { amounts, mail }
}

describe('F-576 充值成功邮件金额只取订单金额(分→元)', () => {
  it('tokenDelta=1_000_000、costDeltaCents=0 ⇒ 金额 ¥0.00,token 只作为到账额度', () => {
    const { amounts, mail } = render(0, 1_000_000)

    expect(amounts.costYuan).toBe((0 / 100).toFixed(2))
    expect(amounts.creditTokens).toBe(1_000_000)

    expect(mail.text).toContain('¥0.00')
    expect(mail.html).toContain('¥0.00')
    // 混用公式 (token + 分) / 100 会渲染出 ¥10000.00
    expect(mail.text).not.toContain('¥10000.00')
    expect(mail.html).not.toContain('10000.00')

    // token 数量只出现在「到账额度」文案里
    expect(mail.html).toContain('+1000000')
    expect(mail.text).toContain('额度 +1000000')
    expect(mail.subject).toContain('额度 +1000000')
    expect(mail.html).not.toMatch(/¥1000000/)
  })

  it('订单 12345 分 + 2_000_000 token ⇒ 金额 ¥123.45,不含 (token+分)/100 的 20123.45', () => {
    const { amounts, mail } = render(12_345, 2_000_000)

    expect(amounts.costYuan).toBe('123.45')
    expect(mail.text).toContain('¥123.45')
    expect(mail.html).toContain('¥123.45')
    expect(mail.text).not.toContain('20123.45')
    expect(mail.html).not.toContain('20123.45')
    expect(mail.html).not.toMatch(/¥2000000/)
  })

  it('只充 token、未填订单金额 ⇒ 金额 ¥0.00', () => {
    const { amounts } = render(undefined, 500_000)

    expect(amounts.costYuan).toBe('0.00')
    expect(amounts.creditTokens).toBe(500_000)
  })

  it('分→元保留两位:1 分 / 99 分 / 100000 分', () => {
    expect(buildWalletRechargeMailAmounts({ costDeltaCents: 1 }).costYuan).toBe('0.01')
    expect(buildWalletRechargeMailAmounts({ costDeltaCents: 99 }).costYuan).toBe('0.99')
    expect(buildWalletRechargeMailAmounts({ costDeltaCents: 100_000 }).costYuan).toBe('1000.00')
  })

  it('路由装车:充值处理器用 buildWalletRechargeMailAmounts 取金额,且不再出现 token+分 相加', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/routes/developer-relay.ts', import.meta.url)),
      'utf8',
    )

    expect(src).toContain('buildWalletRechargeMailAmounts(parsed.data)')
    expect(src).not.toContain(
      '(parsed.data.tokenDelta ?? 0) + (parsed.data.costDeltaCents ?? 0)',
    )
  })
})
