// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 会话回灌判据锁(2026-10-24 立)。
 * 判据 import 自生产脚本 `__test__`(§22c),本文件不重写规则;不连库,不 spawn 真流程。
 */
import { describe, it, expect } from 'vitest'
import { __test__ } from '../scripts/relay-trae-session-sync.js'

const { decideSync, parseIso, parseArgs } = __test__

const base = {
  poolToken: 'pool-jwt',
  poolTokenExpiresAt: new Date('2026-11-07T02:27:01.600Z'),
  poolRefreshExpiresAt: new Date('2027-04-21T04:33:38.000Z'),
  clientToken: 'client-jwt',
  clientRefreshToken: 'client-rt',
  clientExpiresAt: new Date('2026-11-08T00:00:00.000Z'),
  clientRefreshExpiresAt: new Date('2027-04-22T00:00:00.000Z'),
}

describe('decideSync · 客户端为主回灌判据', () => {
  it('同票 ⇒ 不写(same-token)', () => {
    const d = decideSync({
      ...base,
      clientToken: 'pool-jwt',
      clientExpiresAt: base.poolTokenExpiresAt,
    })
    expect(d.apply).toBe(false)
    expect(d.reason).toBe('same-token')
  })

  it('池内票更新 ⇒ 不写(pool-newer,旧票不许覆盖兜底续期结果)', () => {
    const d = decideSync({ ...base, clientExpiresAt: new Date('2026-11-06T00:00:00.000Z') })
    expect(d.apply).toBe(false)
    expect(d.reason).toBe('pool-newer')
    expect(d.next.token).toBe('pool-jwt')
  })

  it('客户端票更新 ⇒ 写(client-newer),refreshToken 取客户端', () => {
    const d = decideSync(base)
    expect(d.apply).toBe(true)
    expect(d.reason).toBe('client-newer')
    expect(d.next.token).toBe('client-jwt')
    expect(d.next.refreshToken).toBe('client-rt')
    expect(d.next.tokenExpiresAt).toEqual(base.clientExpiresAt)
    expect(d.next.refreshExpiresAt).toEqual(base.clientRefreshExpiresAt)
  })

  it('到期时刻相同但 token 不同 ⇒ 写(client-rotated,客户端轮换)', () => {
    const d = decideSync({ ...base, clientExpiresAt: base.poolTokenExpiresAt })
    expect(d.apply).toBe(true)
    expect(d.reason).toBe('client-rotated')
    expect(d.next.token).toBe('client-jwt')
  })

  it('缺到期时刻 ⇒ 写(apply);refreshExpiresAt 缺失保留池内值', () => {
    const d = decideSync({ ...base, clientExpiresAt: null, clientRefreshExpiresAt: null })
    expect(d.apply).toBe(true)
    expect(d.reason).toBe('apply')
    expect(d.next.tokenExpiresAt).toEqual(base.poolTokenExpiresAt)
    expect(d.next.refreshExpiresAt).toEqual(base.poolRefreshExpiresAt)
  })

  it('客户端没给 refreshToken(web 号)⇒ next.refreshToken 为 null,池内该列不动', () => {
    const d = decideSync({ ...base, clientRefreshToken: null })
    expect(d.apply).toBe(true)
    expect(d.next.refreshToken).toBeNull()
  })
})

describe('CLI 参数面(未判定不猜)', () => {
  it('缺 --stdin ⇒ 报错;未知参数 ⇒ 报错', () => {
    expect(parseArgs([]).error).toContain('--stdin')
    expect(parseArgs(['--stdin']).error).toBeNull()
    expect(parseArgs(['--stdin', '--bogus']).error).toContain('未知参数')
    expect(parseArgs(['--stdin', '--dry-run', '--json']).error).toBeNull()
  })

  it('parseIso:空/坏值 ⇒ null,合法 ISO ⇒ Date', () => {
    expect(parseIso(null)).toBeNull()
    expect(parseIso('')).toBeNull()
    expect(parseIso('not-a-date')).toBeNull()
    expect(parseIso('2026-11-07T02:27:01.600Z')?.getTime()).toBe(
      Date.parse('2026-11-07T02:27:01.600Z'),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
