// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 钱包 → AI 积分兑换契约测试(2026-11-25)。
 *
 * 这是“三本账”里唯一允许的钱包 → 积分桥;用源码契约锁住资金安全要点,
 * 避免后续重构把行锁、幂等索引、1:1 汇率或前端入口删掉。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const read = (rel: string) => readFileSync(`${root}${rel}`, 'utf8')

describe('钱包 → 积分兑换桥', () => {
  const service = read('apps/api/src/services/wallet-points-exchange-service.ts')
  const route = read('apps/api/src/routes/wallet.ts')
  const migration = read('packages/database/drizzle/20261125151000_wallet_points_exchange.sql')
  const web = read('apps/web/app/(main)/wallet/page.tsx')

  it('服务层:行锁 + 余额条件扣款 + 1:1 加积分', () => {
    expect(service).toContain(".for('update')")
    expect(service).toContain('gte(userMargins.tokenQuantity, amount)')
    expect(service).toContain('userPoints.points} + ${amount}')
    expect(service).toContain('availableOf(pointsRow)')
    expect(service).toContain("type: 'transfer'")
    expect(service).toContain('WALLET_EXCHANGE_OP_TYPE')
    expect(service).not.toContain('totalEarned')
  })

  it('幂等:同一用户同一 referenceId 只允许一条 wallet_exchange 流水', () => {
    expect(service).toContain('wallet_exchange:${idempotencyKey}')
    expect(service).toContain('alreadyExchanged: true')
    expect(service).toContain('walletExchangeOrderNo(userId, referenceId)')
    expect(service).toContain('createHash')
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS')
    expect(migration).toContain("WHERE source = 'wallet_exchange'")
    expect(migration).toContain('reference_id IS NOT NULL')
    expect(migration).toContain('7=兑换AI积分')
  })

  it('路由:金额 100–1,000,000、限流、错误映射齐全', () => {
    expect(route).toContain("'/convert-to-points'")
    expect(route).toContain('min(100')
    expect(route).toContain('max(1_000_000)')
    expect(route).toContain("rateLimit: { max: 10, timeWindow: '1 minute' }")
    expect(route).toContain('instanceof WalletExchangeError')
    expect(route).toContain("rate: '1 分 = 1 积分'")
  })

  it('前端:钱包页有兑换入口,并带幂等键', () => {
    expect(web).toContain('/api/wallet/convert-to-points')
    expect(web).toContain('钱包余额兑换 AI 积分')
    expect(web).toContain('idempotencyKey')
    expect(web).toContain("invalidateQueries({ queryKey: ['wallet'] })")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
