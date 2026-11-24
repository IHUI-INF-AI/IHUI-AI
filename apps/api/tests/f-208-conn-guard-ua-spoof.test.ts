// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-208 回归锁(2026-11-13)。
 *
 * 病灶:http-conn-guard 的 preHandler 在计数之前先按 UA 白名单(kube-probe / prometheus /
 * uptime / health-check …)整条 return ⇒ 攻击者伪造 User-Agent 即可无限开慢连接,
 * 单 IP 并发上限形同不存在(白名单判据的输入完全由客户端控制)。
 *
 * 本文件锁:
 *   ① 伪造探针 UA 仍按单 IP 计数:占满阈值后第 N+1 条必须 429;
 *   ② 普通浏览器 UA / 无 UA 正常放行,不被误伤;
 *   ③ 上限内的多条连接正常放行,onResponse / socket close 都能归还槽位;
 *   ④ UA 白名单不再影响计数:每条历史关键词命中的请求都必须真的占一格;
 *   ⑤ 源锁:preHandler 内不读 User-Agent,只有健康路径(服务端事实)可豁免;
 *   ⑥ 健康路径(按 URL)豁免保持,监控探活不被计入/误伤。
 *
 * 不起真监听端口:把插件挂到只收集 addHook 的伪 server 上,再用伪 request/reply 直接
 * 调用 preHandler —— 判据落在守卫自己的钩子体上,不经 Fastify 路由层。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { EventEmitter } from 'node:events'
import type { FastifyInstance } from 'fastify'
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { httpConnGuard, __test__ } from '../src/plugins/http-conn-guard.js'

const { MAX_CONN_PER_IP, reset, activeIpCount, activeCountForIp, HEALTH_PATHS } = __test__

/** 历史上被当作白名单的所有探针 UA —— 逐个验证它们都不再换来任何放行。 */
const HISTORICAL_PROBE_UAS = [
  'kube-probe/1.0',
  'Prometheus/2.45.0',
  'ELB-HealthChecker/2.0',
  'UptimeRobot/2.0',
  'GoogleHC/1.0',
  'health-check/1.0',
  'gthealthcheck',
]

const IP = '203.0.113.7'

type HookFn = (...args: unknown[]) => unknown

interface GuardHooks {
  preHandler: HookFn[]
  onResponse: HookFn[]
  onRequestAbort: HookFn[]
  onClose: HookFn[]
}

interface FakeRequest {
  ip: string
  url: string
  id: string
  headers: Record<string, string>
}

interface FakeReply {
  statusCode: number
  headers: Record<string, string>
  payload: unknown
  raw: EventEmitter
  code(code: number): FakeReply
  header(name: string, value: string): FakeReply
  send(payload: unknown): FakeReply
}

/** 只收 addHook 的伪 server:插件体照常执行,但不触达 Fastify 实例/路由/端口。 */
async function installGuard(): Promise<GuardHooks> {
  const hooks: GuardHooks = { preHandler: [], onResponse: [], onRequestAbort: [], onClose: [] }
  const fakeServer = {
    addHook(name: string, fn: HookFn) {
      if (name === 'preHandler') hooks.preHandler.push(fn)
      else if (name === 'onResponse') hooks.onResponse.push(fn)
      else if (name === 'onRequestAbort') hooks.onRequestAbort.push(fn)
      else if (name === 'onClose') hooks.onClose.push(fn)
    },
  }
  await httpConnGuard(fakeServer as unknown as FastifyInstance, {})
  return hooks
}

function makeReply(): FakeReply {
  const raw = new EventEmitter()
  const reply: FakeReply = {
    statusCode: 200,
    headers: {},
    payload: undefined,
    raw,
    code(code: number) {
      reply.statusCode = code
      return reply
    },
    header(name: string, value: string) {
      reply.headers[name] = value
      return reply
    },
    send(payload: unknown) {
      reply.payload = payload
      return reply
    },
  }
  return reply
}

let seq = 0

/** 直接调用 preHandler(不经 Fastify),返回伪 request/reply 供断言。 */
async function hit(
  preHandler: HookFn,
  opts: { ip?: string; url?: string; ua?: string; id?: string } = {},
): Promise<{ request: FakeRequest; reply: FakeReply }> {
  seq += 1
  const headers: Record<string, string> = {}
  if (opts.ua !== undefined) headers['user-agent'] = opts.ua
  const request: FakeRequest = {
    ip: opts.ip ?? IP,
    url: opts.url ?? '/api/orders',
    id: opts.id ?? `f208-req-${seq}`,
    headers,
  }
  const reply = makeReply()
  await preHandler(request, reply)
  return { request, reply }
}

describe('F-208 连接数守卫:UA 白名单不得作为放行条件', () => {
  let hooks: GuardHooks
  let preHandler: HookFn

  beforeAll(async () => {
    hooks = await installGuard()
  })

  beforeEach(() => {
    reset()
    seq = 0
    expect(hooks.preHandler).toHaveLength(1)
    preHandler = hooks.preHandler[0]!
  })

  it('① 伪造探针 UA 仍受单 IP 上限约束:占满后第 N+1 条 429', async () => {
    const spoofUa = 'kube-probe/1.0'

    for (let i = 0; i < MAX_CONN_PER_IP; i += 1) {
      const { reply } = await hit(preHandler, { ua: spoofUa, id: `spoof-${i}` })
      expect(reply.statusCode, `第 ${i + 1} 条伪造 UA 请求被拒 ⇒ 白名单仍在放行`).toBe(200)
    }
    expect(activeCountForIp(IP)).toBe(MAX_CONN_PER_IP)

    const overflow = await hit(preHandler, { ua: spoofUa, id: 'spoof-overflow' })
    expect(overflow.reply.statusCode).toBe(429)
    expect(overflow.reply.headers['Retry-After']).toBe('1')
    expect(overflow.reply.payload).toEqual({ code: 429, message: '单 IP 并发连接数超限' })
    // 被拒的那条不得残留占位
    expect(activeCountForIp(IP)).toBe(MAX_CONN_PER_IP)
  })

  it('② 普通浏览器 UA / 无 UA 正常放行,不被误伤', async () => {
    const browser = await hit(preHandler, {
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36',
    })
    expect(browser.reply.statusCode).toBe(200)
    expect(browser.reply.payload).toBeUndefined()

    const noUa = await hit(preHandler, { id: 'no-ua' })
    expect(noUa.reply.statusCode).toBe(200)
    expect(noUa.reply.payload).toBeUndefined()

    expect(activeCountForIp(IP)).toBe(2)
  })

  it('③ 上限内的多条连接全部放行,onResponse / socket close 都能归还槽位', async () => {
    const issued: Array<{ request: FakeRequest; reply: FakeReply }> = []
    for (let i = 0; i < 5; i += 1) {
      const one = await hit(preHandler, { ua: 'Mozilla/5.0', id: `normal-${i}` })
      expect(one.reply.statusCode).toBe(200)
      issued.push(one)
    }
    expect(activeCountForIp(IP)).toBe(5)

    // onResponse 归还一路
    await hooks.onResponse[0]!(issued[0]!.request)
    expect(activeCountForIp(IP)).toBe(4)

    // socket close 归还一路(hijack 的 SSE/WS 出口只有这条通道)
    issued[1]!.reply.raw.emit('close')
    expect(activeCountForIp(IP)).toBe(3)

    // 释放后仍在上限内,继续占槽正常
    const again = await hit(preHandler, { id: 'after-release' })
    expect(again.reply.statusCode).toBe(200)
    expect(activeCountForIp(IP)).toBe(4)
  })

  it('④ UA 白名单不影响计数:历史关键词命中的请求也必须真的占一格', async () => {
    for (const [i, ua] of HISTORICAL_PROBE_UAS.entries()) {
      reset()
      const { reply } = await hit(preHandler, { ua, id: `probe-${i}` })
      expect(reply.statusCode).toBe(200)
      expect(activeCountForIp(IP), `UA=${ua} 未进入计数 ⇒ 白名单仍被当放行条件`).toBe(1)
      expect(activeIpCount(), `UA=${ua} 未建立任何 IP 计数桶`).toBe(1)
    }
  })

  it('⑤ 源锁:preHandler 内不读 User-Agent,计数在豁免之后无条件执行', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/plugins/http-conn-guard.ts', import.meta.url)),
      'utf8',
    )
    const start = src.indexOf("server.addHook('preHandler'")
    const end = src.indexOf("server.addHook('onResponse'", start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const block = src.slice(start, end)

    expect(block).toContain('tryAcquireSlot(ip, request.id)')
    // 客户端可控头不参与本钩子的任何判定
    expect(block.toLowerCase()).not.toContain('user-agent')
    expect(block).not.toContain('HEALTH_UA_KEYWORDS')
  })

  it('⑥ 健康路径(按 URL)豁免保持:监控探活不计入、不被误伤', async () => {
    for (const path of HEALTH_PATHS) {
      const { reply } = await hit(preHandler, {
        url: `${path}?probe=1`,
        ua: 'kube-probe/1.0',
        id: `health-${path}`,
      })
      expect(reply.statusCode).toBe(200)
    }
    expect(activeIpCount()).toBe(0)
  })
})
