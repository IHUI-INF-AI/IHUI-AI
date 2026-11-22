// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-219 回归锁(2026-11-13)。
 *
 * 病灶:Redis 不可用时的内存兜底表只按**插入序**淘汰 —— 表满 2 万后删除最早 set 的键,
 * 既不清过期条目,也不区分活跃/过期。于是故障期用 2 万个不同手机号就能把目标号码的
 * 24h 档配额挤掉(计数归零),继续发码;短信按条计费,直接是资损。
 *
 * 本文件锁:
 *   ① 淘汰前先按 `windowStart + windowMs < now` 全局清过期:过期键不挤占新键额度;
 *   ② 清完仍满且全活跃 ⇒ fail-closed:新键被拒(tryConsumeWindows 返回 >0、
 *      incrWindow 返回超上限值),既有活跃条目一个不删、计数不重置;
 *   ③ 正常窗口计数与过期重置语义不变;
 *   ④ 短信发码闸在 fail-closed 时走既有 429 + X-Challenge-Required(调用方能识别的失败形态)。
 *
 * 只 mock ioredis(构造即抛 ⇒ 全程内存兜底),不触达真实 Redis / PG。
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

// 与 account-lockout.test.ts 同一手法:构造即抛 ⇒ getRedis() 置 initFailed,
// 本文件全程走内存兜底,且不会真去连 localhost:6399。
vi.mock('ioredis', () => {
  class FailingRedis {
    constructor() {
      throw new Error('redis unavailable (F-219 mock)')
    }
  }
  return { default: FailingRedis }
})

import {
  tryConsumeWindows,
  incrWindow,
  resetCounters,
  LOCAL_CAPACITY_EXCEEDED_COUNT,
  __test__ as wc,
} from '../src/utils/window-counter.js'
import smsSendCaptchaPlugin from '../src/utils/sms-send-captcha.js'

/** 与 window-counter.ts 的 LOCAL_MAX_KEYS 对齐(回归锁:上限变了这条用例必须重新审一遍)。 */
const MAX_KEYS = 20_000
const T0 = 1_800_000_000_000
const FILL_WINDOW_MS = 60_000

let now = T0
let nowSpy: { mockRestore(): void }

beforeEach(async () => {
  now = T0
  nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
  process.env.SMS_SEND_CAPTCHA_MODE = 'escalate'
  process.env.SMS_SEND_CAPTCHA_THRESHOLD = '20'
  await resetCounters(['f219:', 'sms:cap:esc:'])
})

afterEach(() => {
  nowSpy.mockRestore()
})

afterAll(async () => {
  await resetCounters(['f219:', 'sms:cap:esc:'])
})

async function fillLocalStore(windowMs: number): Promise<void> {
  for (let i = 0; i < MAX_KEYS; i++) {
    await tryConsumeWindows([{ key: `f219:fill:${i}`, windowMs, max: 100 }])
  }
  expect(wc.localSize()).toBe(MAX_KEYS)
}

describe('F-219 内存兜底计数器的淘汰必须是"先清过期,再 fail-closed"', () => {
  it('① 过期窗口先被全局清理,不会挤掉新键的额度', async () => {
    await fillLocalStore(1_000)
    now += 5_000 // 2 万个 1s 窗口全部过期

    expect(await tryConsumeWindows([{ key: 'f219:fresh', windowMs: FILL_WINDOW_MS, max: 1 }])).toBe(
      0,
    )
    // 过期条目不清理时这里会是 2 万(新键被挤掉,旧键留着自己已过期的计数)
    expect(wc.localSize()).toBe(1)

    // 旧键不带旧计数复活:过期即重新从 1 开始
    expect(await tryConsumeWindows([{ key: 'f219:fill:0', windowMs: 1_000, max: 1 }])).toBe(0)
  })

  it('② 清完仍满且全活跃 ⇒ 新键被拒,既有活跃条目一个不删', async () => {
    await fillLocalStore(FILL_WINDOW_MS)
    // 让一个既有键先累加到 2,用它证伪"被拒绝时顺手删掉了别人的窗口"
    expect(
      await tryConsumeWindows([{ key: 'f219:fill:0', windowMs: FILL_WINDOW_MS, max: 2 }]),
    ).toBe(0)

    // fail-closed:多档接口按"被第 1 档挡住"返回,调用方走限流拒绝
    expect(
      await tryConsumeWindows([{ key: 'f219:newcomer', windowMs: FILL_WINDOW_MS, max: 1 }]),
    ).toBe(1)
    // fail-closed:单键接口返回超上限的计数,调用方 `attempts <= max` 必然为假
    expect(await incrWindow('f219:newcomer-incr', FILL_WINDOW_MS)).toBe(
      LOCAL_CAPACITY_EXCEEDED_COUNT,
    )

    // 表没被"腾位置",新键也没被写进去
    expect(wc.localSize()).toBe(MAX_KEYS)

    // 既有活跃窗口原样保留:fill:0 仍是 2(再来一次就被挡),fill:1 仍带着自己的计数
    expect(
      await tryConsumeWindows([{ key: 'f219:fill:0', windowMs: FILL_WINDOW_MS, max: 2 }]),
    ).toBe(1)
    expect(
      await tryConsumeWindows([{ key: 'f219:fill:1', windowMs: FILL_WINDOW_MS, max: 1 }]),
    ).toBe(1)
  })

  it('③ 正常窗口计数与过期重置语义不变', async () => {
    const spec = { key: 'f219:normal', windowMs: FILL_WINDOW_MS, max: 2 }
    expect(await tryConsumeWindows([spec])).toBe(0)
    expect(await tryConsumeWindows([spec])).toBe(0)
    expect(await tryConsumeWindows([spec])).toBe(1)

    expect(await incrWindow('f219:incr', FILL_WINDOW_MS)).toBe(1)
    expect(await incrWindow('f219:incr', FILL_WINDOW_MS)).toBe(2)

    now += FILL_WINDOW_MS + 1 // 过窗
    expect(await incrWindow('f219:incr', FILL_WINDOW_MS)).toBe(1)
    expect(await tryConsumeWindows([spec])).toBe(0)
  })

  it('④ 短信发码闸在 fail-closed 时按既有形态拒绝(429 + X-Challenge-Required)', async () => {
    await fillLocalStore(FILL_WINDOW_MS)

    const app = Fastify({ logger: false })
    await app.register(smsSendCaptchaPlugin)
    app.post('/send-code', async () => ({ ok: true }))
    await app.ready()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/send-code',
        remoteAddress: '203.0.113.9', // 公网地址:不能被内网豁免短路
        payload: {},
      })
      expect(res.statusCode).toBe(429)
      expect(res.headers['x-challenge-required']).toBe('captcha')

      // 拒绝的那一次不得写进表里(否则 fail-closed 反而在帮对方占位)
      expect(wc.localSize()).toBe(MAX_KEYS)
    } finally {
      await app.close()
    }
  })

  it('⑤ 容量临界:"存在但已过期"的键清扫后要重算缺额,表不得越界', async () => {
    for (let i = 0; i < MAX_KEYS - 1; i++) {
      await tryConsumeWindows([{ key: `f219:mix:${i}`, windowMs: FILL_WINDOW_MS, max: 100 }])
    }
    now += 2
    expect(await tryConsumeWindows([{ key: 'f219:mix:short', windowMs: 1_000, max: 1 }])).toBe(0)
    expect(wc.localSize()).toBe(MAX_KEYS)

    now += 1_100 // short 过期,其余 60s 窗口仍活跃;两档都需要名额 ⇒ 一个都放不进
    expect(
      await tryConsumeWindows([
        { key: 'f219:mix:short', windowMs: 1_000, max: 1 },
        { key: 'f219:mix:fresh', windowMs: FILL_WINDOW_MS, max: 1 },
      ]),
    ).toBe(1)
    // 过期的那一个被清掉,但新键一个也没写进来
    expect(wc.localSize()).toBe(MAX_KEYS - 1)
  })
})
