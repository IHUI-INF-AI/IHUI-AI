// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 入口限流模块的行为锁(2026-10-29)。
 *
 * 这一族的错法都是「安静」的,所以每条正例都配一条反向对照:
 *   · 阈值算错 ⇒ 正常用户被 429(用户侧表现为「网站偶尔打不开」,极难归因);
 *   · 桶永不满 ⇒ 限流等于没装(最贵的假绿:代码在、判据绿、攻击照穿);
 *   · key 用 XFF ⇒ 攻击者换头即绕过(必须用不可伪造的 TCP 对端);
 *   · 淘汰写反 ⇒ 内存无界增长(router 是常驻进程,泄漏到 OOM 就是全站故障)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { createIpRateLimiter, resolveRateLimitConfig } from '../ip-rate-limit.mjs'

/** 可控时钟:不 sleep,直接推进时间。 */
function makeClock(start = 1_000_000) {
  let t = start
  return {
    now: () => t,
    advance: (ms) => {
      t += ms
    },
  }
}

test('突发额度内全部放行:首次访问不该被限', () => {
  const clock = makeClock()
  const limiter = createIpRateLimiter({ rps: 10, burst: 5, now: clock.now })
  for (let i = 0; i < 5; i += 1) {
    assert.equal(limiter.check('1.1.1.1').allowed, true, `第 ${i + 1} 个请求应放行`)
  }
})

test('超出突发额度即拒绝,且给出正整数 Retry-After', () => {
  const clock = makeClock()
  const limiter = createIpRateLimiter({ rps: 10, burst: 3, now: clock.now })
  for (let i = 0; i < 3; i += 1) limiter.check('1.1.1.1')
  const denied = limiter.check('1.1.1.1')
  assert.equal(denied.allowed, false)
  assert.ok(denied.retryAfterSec >= 1, 'Retry-After 必须 >= 1 秒')
  assert.equal(Number.isInteger(denied.retryAfterSec), true)
})

test('桶会随时间回补:等够 1/rps 秒即恢复一个令牌', () => {
  const clock = makeClock()
  const limiter = createIpRateLimiter({ rps: 10, burst: 2, now: clock.now })
  limiter.check('a')
  limiter.check('a')
  assert.equal(limiter.check('a').allowed, false)
  clock.advance(100) // 10 rps ⇒ 100ms 恰好补 1 个
  assert.equal(limiter.check('a').allowed, true, '回补后应放行')
  assert.equal(limiter.check('a').allowed, false, '补的那一个用完即止')
})

test('回补不会超过桶容量(不会攒出无限突发)', () => {
  const clock = makeClock()
  const limiter = createIpRateLimiter({ rps: 10, burst: 3, now: clock.now })
  limiter.check('a') // 用掉 1,剩 2
  clock.advance(60_000) // 一分钟:理论补 600,但上限是 3
  let allowed = 0
  for (let i = 0; i < 10; i += 1) if (limiter.check('a').allowed) allowed += 1
  assert.equal(allowed, 3, '桶容量就是硬上限,长时间空闲不该攒出更多')
})

test('不同 IP 各自独立计数(不会互相挤占)', () => {
  const clock = makeClock()
  const limiter = createIpRateLimiter({ rps: 10, burst: 1, now: clock.now })
  assert.equal(limiter.check('a').allowed, true)
  assert.equal(limiter.check('a').allowed, false)
  assert.equal(limiter.check('b').allowed, true, '另一个 IP 有自己的一桶')
})

test('key 数量超上限时淘汰最旧,且淘汰后仍能服务新 IP', () => {
  const clock = makeClock()
  const limiter = createIpRateLimiter({ rps: 10, burst: 1, maxKeys: 10, now: clock.now })
  for (let i = 0; i < 10; i += 1) {
    limiter.check(`ip-${i}`)
    clock.advance(10)
  }
  assert.equal(limiter.size(), 10)
  limiter.check('ip-new') // 触发淘汰
  assert.ok(limiter.size() <= 10, `淘汰后不该超过 maxKeys,实际 ${limiter.size()}`)
  assert.equal(limiter.check('ip-newer').allowed, true, '淘汰不得把新 IP 也拒了')
})

test('配置:未设环境变量时启用且用默认阈值', () => {
  const cfg = resolveRateLimitConfig({})
  assert.equal(cfg.enabled, true)
  assert.equal(cfg.rps, 500)
  assert.equal(cfg.burst, 1000)
})

test('配置:显式阈值覆盖默认', () => {
  const cfg = resolveRateLimitConfig({ IHUI_BG_RATE_LIMIT_RPS: '50', IHUI_BG_RATE_LIMIT_BURST: '80' })
  assert.deepEqual(cfg, { enabled: true, rps: 50, burst: 80 })
})

test('配置:非法/负数阈值回落到默认,绝不变成 0(0 = 全拒 = 全站故障)', () => {
  for (const bad of ['0', '-5', 'abc', '', 'NaN']) {
    const cfg = resolveRateLimitConfig({ IHUI_BG_RATE_LIMIT_RPS: bad, IHUI_BG_RATE_LIMIT_BURST: bad })
    assert.equal(cfg.rps, 500, `rps 对 ${JSON.stringify(bad)} 应回落默认`)
    assert.equal(cfg.burst, 1000, `burst 对 ${JSON.stringify(bad)} 应回落默认`)
  }
})

test('配置:应急开关可整层关闭(off/0/false/no 四种写法)', () => {
  for (const flag of ['off', 'OFF', '0', 'false', 'no', ' off ']) {
    assert.equal(resolveRateLimitConfig({ IHUI_BG_RATE_LIMIT: flag }).enabled, false, flag)
  }
  assert.equal(resolveRateLimitConfig({ IHUI_BG_RATE_LIMIT: 'on' }).enabled, true)
})
