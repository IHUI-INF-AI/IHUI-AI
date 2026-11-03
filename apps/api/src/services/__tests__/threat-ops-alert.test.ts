// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运行时威胁告警「到管理员」的回归锁。
 *
 * 病灶:threat-detector 自动封禁只写 logger.warn,机主只能主动读 /security 才知情;
 * 而登录异常通知的收件人是用户本人,替代不了这一格。
 *
 * 这里刻意喂**生产的** acquireThrottleWindow / notifyThreatBlock,假 Redis 只当存储,
 * 不另造一份节流判据(§22c)。每个"会少发"的分支都配一条反向对照,证明压住的
 * 是窗口内的同类事件,而不是判据坏掉后的静默。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Redis } from 'ioredis'

const pushAlertWithResult = vi.hoisted(() => vi.fn())
const loggerWarn = vi.hoisted(() => vi.fn())

vi.mock('../alert-notification-service.js', () => ({ pushAlertWithResult }))
vi.mock('../../utils/logger.js', () => ({
  logger: { warn: loggerWarn, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import {
  __test__ as T,
  notifyThreatBlock,
  notifyThreatWatch,
  type ThrottleMemory,
} from '../threat-ops-alert.js'

/* -------------------------------------------------------------------------- */
/* 假时钟 + 假 Redis(带 TTL 过期语义)                                          */
/* -------------------------------------------------------------------------- */

interface FakeClock {
  ms: number
}

function makeFakeRedis(clock: FakeClock, opts: { failOps?: boolean } = {}) {
  const rows = new Map<string, { value: string; expiresAtMs: number }>()
  const alive = (k: string) => {
    const r = rows.get(k)
    if (!r) return undefined
    if (r.expiresAtMs <= clock.ms) {
      rows.delete(k)
      return undefined
    }
    return r
  }
  const boom = () => {
    if (opts.failOps) throw new Error('redis down')
  }
  const client = {
    async set(...args: unknown[]): Promise<'OK' | null> {
      boom()
      const [k, v] = args as [string, string]
      const tail = args.slice(2)
      const nx = tail.includes('NX')
      const exIdx = tail.indexOf('EX')
      const ttlSec = exIdx >= 0 ? Number(tail[exIdx + 1]) : Number.POSITIVE_INFINITY
      if (nx && alive(k)) return null
      rows.set(k, { value: v, expiresAtMs: clock.ms + ttlSec * 1000 })
      return 'OK'
    },
    async get(k: string): Promise<string | null> {
      boom()
      return alive(k)?.value ?? null
    },
    async del(k: string): Promise<number> {
      boom()
      return rows.delete(k) ? 1 : 0
    },
    async incr(k: string): Promise<number> {
      boom()
      const cur = alive(k)
      const next = (Number(cur?.value ?? '0') || 0) + 1
      rows.set(k, {
        value: String(next),
        expiresAtMs: cur?.expiresAtMs ?? Number.POSITIVE_INFINITY,
      })
      return next
    },
    async expire(k: string, ttlSec: number): Promise<number> {
      boom()
      const cur = alive(k)
      if (!cur) return 0
      cur.expiresAtMs = clock.ms + ttlSec * 1000
      return 1
    },
  }
  return { client: client as unknown as Redis, rows }
}

const freshMemory = (): ThrottleMemory => ({ gateUntil: new Map(), pending: new Map() })

/** 把一次 warn 的全部参数摊平成文本 —— 断言不依赖消息/元数据的参数次序 */
const warnText = (args: unknown[]): string =>
  args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')

const blockInput = {
  ip: '203.0.113.7',
  score: 88,
  durationLabel: '24小时',
  reasons: ['sqli:3', 'bad-events:6'],
  badEvents: 6,
  recentBlocks: [
    { ip: '203.0.113.7', score: 88, duration: '24小时', timestamp: 1_730_000_000_000 },
    { ip: '198.51.100.9', score: 91, duration: '7天', timestamp: 1_730_000_001_000 },
  ],
}

const allChannelsDown = {
  dingtalk: false,
  wechat: false,
  feishu: false,
  email: false,
  pagerduty: false,
  slack: false,
  teams: false,
  generic: false,
}

beforeEach(() => {
  pushAlertWithResult.mockReset()
  pushAlertWithResult.mockResolvedValue({ ...allChannelsDown, email: true })
  loggerWarn.mockReset()
})

describe('节流窗口 · Redis 路径', () => {
  it('首条抢到开窗 ⇒ send，正文带封禁明细', async () => {
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock)
    const win = await notifyThreatBlock(client, blockInput, clock.ms, freshMemory())
    expect(win).toEqual({ outcome: 'send', suppressed: 0 })
    expect(pushAlertWithResult).toHaveBeenCalledTimes(1)
    const sent = pushAlertWithResult.mock.calls[0]?.[0]
    expect(sent?.severity).toBe('critical')
    expect(sent?.source).toBe('threat-detector')
    expect(sent?.title).toContain('203.0.113.7')
    expect(sent?.message).toContain('信誉评分 88')
    expect(sent?.message).toContain('24小时')
  })

  it('同窗口内第二条被压住，不开第二封', async () => {
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock)
    await notifyThreatBlock(client, blockInput, clock.ms, freshMemory())
    const second = await notifyThreatBlock(
      client,
      { ...blockInput, ip: '203.0.113.8' },
      clock.ms + 60_000,
      freshMemory(),
    )
    expect(second.outcome).toBe('throttled')
    expect(pushAlertWithResult).toHaveBeenCalledTimes(1)
  })

  it('窗口到期后重新开窗，并把上一窗口被压住的条数带进正文', async () => {
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock)
    const mem = freshMemory()
    await notifyThreatBlock(client, blockInput, clock.ms, mem)
    await notifyThreatBlock(client, { ...blockInput, ip: 'a' }, clock.ms + 60_000, mem)
    await notifyThreatBlock(client, { ...blockInput, ip: 'b' }, clock.ms + 120_000, mem)
    expect(pushAlertWithResult).toHaveBeenCalledTimes(1)

    // block 窗口 = 15 分钟，把假时钟推到窗口之后（TTL 判定读的是同一个时钟）
    const after = clock.ms + (T.THROTTLE_WINDOWS.block + 1) * 1000
    clock.ms = after
    const win = await notifyThreatBlock(client, blockInput, after, mem)
    expect(win.outcome).toBe('send')
    expect(win.suppressed).toBe(2)
    const last = pushAlertWithResult.mock.calls.at(-1)?.[0] as { message: string }
    expect(last.message).toContain('另有 2 次同类封禁未单独通报')
  })

  it('反向对照：suppressed=0 时正文不得出现"未单独通报"行', () => {
    const at = 1_730_000_000_000
    expect(T.buildBlockMessage(blockInput, 0, at)).not.toContain('未单独通报')
    expect(T.buildBlockMessage(blockInput, 3, at)).toContain('另有 3 次')
  })

  it('两类告警各有独立窗口，封禁压不住高危监控', async () => {
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock)
    await notifyThreatBlock(client, blockInput, clock.ms, freshMemory())
    const watch = await notifyThreatWatch(
      client,
      { ip: '203.0.113.9', score: 65, reasons: ['xss:2'], path: '/api/v1/chat', watchedCount: 4 },
      clock.ms + 1000,
      freshMemory(),
    )
    expect(watch.outcome).toBe('send')
    expect(pushAlertWithResult).toHaveBeenCalledTimes(2)
  })
})

describe('降级路径', () => {
  it('无 Redis ⇒ 进程内窗口同样生效（单实例等效，不是照发一堆）', async () => {
    const clock = { ms: 1_730_000_000_000 }
    const mem = freshMemory()
    const first = await notifyThreatBlock(null, blockInput, clock.ms, mem)
    const second = await notifyThreatBlock(null, blockInput, clock.ms + 1000, mem)
    expect(first.outcome).toBe('send')
    expect(second.outcome).toBe('throttled')
    expect(pushAlertWithResult).toHaveBeenCalledTimes(1)
  })

  it('Redis 抛错 ⇒ 回落进程内并照发一封（判不出绝不冒充"已报过"）', async () => {
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock, { failOps: true })
    const win = await notifyThreatBlock(client, blockInput, clock.ms, freshMemory())
    expect(win.outcome).toBe('send')
    expect(pushAlertWithResult).toHaveBeenCalledTimes(1)
    expect(loggerWarn.mock.calls.some((c) => warnText(c).includes('回落进程内'))).toBe(true)
  })

  it('全渠道未落地 ⇒ 必须喊响，不允许"以为寄了"', async () => {
    pushAlertWithResult.mockResolvedValue(allChannelsDown)
    const clock = { ms: 1_730_000_000_000 }
    await notifyThreatBlock(null, blockInput, clock.ms, freshMemory())
    expect(loggerWarn.mock.calls.some((c) => warnText(c).includes('未送达任何渠道'))).toBe(true)
  })

  it('反向对照：邮件已落地时不得报"未送达"', async () => {
    const clock = { ms: 1_730_000_000_000 }
    await notifyThreatBlock(null, blockInput, clock.ms, freshMemory())
    expect(loggerWarn.mock.calls.some((c) => warnText(c).includes('未送达任何渠道'))).toBe(false)
  })
})

describe('接线锁（造好没装车 = 没有）', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../../plugins/threat-detector.ts', import.meta.url)),
    'utf8',
  )

  it('threat-detector import 并同时接上封禁与高危两处出口', () => {
    expect(src).toContain("from '../services/threat-ops-alert.js'")
    expect(src).toContain('notifyThreatBlock(')
    expect(src).toContain('notifyThreatWatch(')
  })

  it('告警失败不得阻断封禁主流程（两个调用点各有失败留痕）', () => {
    const calls = (src.match(/void notifyThreat(Block|Watch)\(/g) ?? []).length
    const catches = (src.match(/alert dispatch failed/g) ?? []).length
    expect(calls).toBe(2)
    expect(catches).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
