// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信支付回调 · 报文级一次性去重(2026-10-30 立)。
 *
 * 被锁住的行为:同一份回调报文(同一 endpoint + 同一 Wechatpay-Timestamp/Nonce)只允许
 * 处理一次;Redis 不可用时**回 'unavailable' 让调用方回 FAIL**,而不是放行
 * —— 资金面宁可让微信按重试曲线重投,也不能在未知状态下重复入账。
 *
 * 为什么每个用例都成对:
 *  - 「首投 ok / 重投 replayed」成对 ⇒ 摘掉 `NX` 就翻红(第二次也拿到 'OK');
 *  - 「同 endpoint 重投 replayed / 换 endpoint ok」成对 ⇒ 去掉 endpoint 维度就翻红;
 *  - 「set 抛错 unavailable / 正常 ok」成对 ⇒ 把 catch 改成 return 'ok' 就翻红
 *    (那正是"Redis 抖动时把重放放进来"的原始缺陷形态)。
 *
 * 不连真实 Redis:全部走 tests/helpers/fake-redis.ts 的内存替身。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  store: new Map<string, { value: string; expiresAt: number }>(),
  calls: [] as Array<{ cmd: string; args: unknown[] }>,
  failures: new Set<string>(),
}))

vi.mock('ioredis', async () => {
  const { makeFakeRedisClass } = await import('./helpers/fake-redis.js')
  return { default: makeFakeRedisClass(state) }
})

import { consumeNotifyNonce } from '../src/services/wechat-pay.js'

const TS = '1730246400'
const NONCE = 'a1b2c3d4e5f6a7b8c9d0'

beforeEach(() => {
  state.store.clear()
  state.calls.length = 0
  state.failures.clear()
})

describe('consumeNotifyNonce · 一次性消费语义', () => {
  it('首次消费放行,同一份报文第二次消费判重放', async () => {
    await expect(consumeNotifyNonce('pay', TS, NONCE)).resolves.toBe('ok')
    await expect(consumeNotifyNonce('pay', TS, NONCE)).resolves.toBe('replayed')
  })

  it('不同端点各占一枚 nonce(支付回调与退款回调不会互相判重)', async () => {
    await expect(consumeNotifyNonce('pay', TS, NONCE)).resolves.toBe('ok')
    await expect(consumeNotifyNonce('refund', TS, NONCE)).resolves.toBe('ok')
    await expect(consumeNotifyNonce('withdrawal', TS, NONCE)).resolves.toBe('ok')
    await expect(consumeNotifyNonce('recurring', TS, NONCE)).resolves.toBe('ok')
  })

  it('换了 timestamp 或 nonce 就是新报文(微信重投会重新签名)', async () => {
    await consumeNotifyNonce('pay', TS, NONCE)
    await expect(consumeNotifyNonce('pay', '1730246401', NONCE)).resolves.toBe('ok')
    await expect(consumeNotifyNonce('pay', TS, 'ffffffffffffffffffff')).resolves.toBe('ok')
  })

  it('键不含 nonce 明文,只有摘要(泄露面最小化)', async () => {
    await consumeNotifyNonce('pay', TS, NONCE)
    const key = String(state.calls[0]?.args[0])
    expect(key).toMatch(/^wechatpay:notify:nonce:pay:[0-9a-f]{64}$/)
    expect(key).not.toContain(NONCE)
  })

  it('占位带 EX + NX:TTL 覆盖 ±5 分钟验收窗', async () => {
    await consumeNotifyNonce('pay', TS, NONCE)
    const setCall = state.calls.find((c) => c.cmd === 'set')
    expect(setCall).toBeDefined()
    const args = setCall?.args ?? []
    expect(args[2]).toBe('EX')
    const ttl = Number(args[3])
    expect(ttl).toBeGreaterThanOrEqual(600)
    expect(args[4]).toBe('NX')
  })
})

describe('consumeNotifyNonce · 失败方向', () => {
  it('Redis 写失败回 unavailable(调用方据此回 FAIL 让微信重投,绝不静默放行)', async () => {
    state.failures.add('set')
    await expect(consumeNotifyNonce('pay', TS, NONCE)).resolves.toBe('unavailable')
  })

  it('缺少 timestamp 或 nonce 时回 absent(没料可去重),且不占用任何键', async () => {
    // 这一态刻意与 unavailable 分开(2026-10-30 修):生产路径上缺头必然先被验签否掉回 400,
    // 走不到这里;能走到的是 DEV/测试(未配平台证书时验签放行)与显式跳过分支。
    // 若把"没头"判成 unavailable,拿到的就是 500 —— 把"没有去重材料"说成"去重库挂了",
    // 四条既有回调用例(无头空体)集体变 500 正是这么来的。
    await expect(consumeNotifyNonce('pay', '', NONCE)).resolves.toBe('absent')
    await expect(consumeNotifyNonce('pay', TS, '')).resolves.toBe('absent')
    expect(state.calls.filter((c) => c.cmd === 'set')).toHaveLength(0)
  })

  it('absent 与 unavailable 必须走不同分支(库挂了仍 fail-closed)', async () => {
    // 成对反证:两条路径若被合并,下面必有一条翻红。
    await expect(consumeNotifyNonce('pay', TS, NONCE)).resolves.toBe('ok')
    state.failures.add('set')
    await expect(consumeNotifyNonce('pay', TS, NONCE)).resolves.toBe('unavailable')
    await expect(consumeNotifyNonce('pay', '', '')).resolves.toBe('absent')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
