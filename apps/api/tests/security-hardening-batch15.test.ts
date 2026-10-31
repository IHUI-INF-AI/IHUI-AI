// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 15 批(2026-10-31,R6 轮)修复钉住:DNS rebinding TOCTOU 收口(M3)。
 *
 * 背景:ensureSafeFetchUrl 问的是"一次解析",fetch 建连时传输层再解析一次 ——
 * TTL=0 的 A 记录能让"校验时公网、建连时内网"。收口范式 = relayGuardedLookup
 * (relay-egress-guard):把判定挪进 undici Agent 的 connect.lookup 钩子,校验与
 * 建连共用同一次解析。本批把该范式做成 ssrf-guard 通用档(ssrfGuardedLookup /
 * ssrfGuardedDispatcher),并接线三处:safeFetch / embed-proxy / url-preview。
 *
 * 钉的是 lookup 钩子的判定语义(私网/危险族/解析失败)、dispatcher 档位单例、
 * 以及 safeFetch 接 dispatcher 后正常链路不坏(本地回环放行面——mock 的 dns
 * lookup 交回 127.0.0.1,undici connect 拿钩子交回的地址真建连,恰好就是
 * "校验与建连共用同一次解析"的可测形态)。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const dnsMock = vi.hoisted(() => ({
  rows: [] as Array<{ address: string; family: number }>,
  lookup: vi.fn(async () => dnsMock.rows),
}))

vi.mock('node:dns/promises', () => ({ lookup: dnsMock.lookup }))

const undiciMock = vi.hoisted(() => ({ fetchSpy: vi.fn() }))

vi.mock('undici', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, fetch: undiciMock.fetchSpy }
})

import { ssrfGuardedLookup, ssrfGuardedDispatcher, safeFetch } from '../src/utils/ssrf-guard.js'
import { wsUpgradeRequiresCredential } from '../src/plugins/ws-helpers.js'

function buildReply() {
  const reply = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    send(body: unknown) {
      this.body = body
    },
  }
  return reply
}

describe('wsUpgradeRequiresCredential 升级前闸(第 15 批 WS fail-fast)', () => {
  it('query 无 token → 401 拒绝升级', async () => {
    const reply = buildReply()
    await wsUpgradeRequiresCredential()({ query: {} } as never, reply as never)
    expect(reply.statusCode).toBe(401)
  })

  it('token 为空串同样拒绝', async () => {
    const reply = buildReply()
    await wsUpgradeRequiresCredential()({ query: { token: '' } } as never, reply as never)
    expect(reply.statusCode).toBe(401)
  })

  it('带 token → 放行(不 reply,交由升级后 wsAuth 验签)', async () => {
    const reply = buildReply()
    await wsUpgradeRequiresCredential()({ query: { token: 'x' } } as never, reply as never)
    expect(reply.statusCode).toBe(0)
    expect(reply.body).toBeNull()
  })

  it('参数名清单可定制(如 ticket 换票面)', async () => {
    const reply = buildReply()
    await wsUpgradeRequiresCredential(['ticket'])(
      { query: { ticket: 't' } } as never,
      reply as never,
    )
    expect(reply.statusCode).toBe(0)
  })
})

type LookupCb = (err: { code?: string; message?: string } | null, rows: unknown) => void

function runLookup(
  hostname: string,
  allowPrivate?: boolean,
): Promise<{ err: unknown; rows: unknown }> {
  return new Promise((resolve) => {
    const cb: LookupCb = (err, rows) => resolve({ err, rows })
    ssrfGuardedLookup({ allowPrivate })(hostname, {}, cb)
  })
}

describe('ssrfGuardedLookup 判定语义(第 15 批 M3)', () => {
  beforeEach(() => {
    dnsMock.rows.length = 0
    dnsMock.lookup.mockClear()
  })

  it('公网地址放行(交回解析行,建连继续)', async () => {
    dnsMock.rows.push({ address: '93.184.216.34', family: 4 })
    const { err, rows } = await runLookup('example.com')
    expect(err).toBeNull()
    expect(rows).toEqual([{ address: '93.184.216.34', family: 4 }])
  })

  it('私网地址默认档拒绝(code=ESSRFBLOCKED)', async () => {
    dnsMock.rows.push({ address: '127.0.0.1', family: 4 })
    const { err } = await runLookup('rebinding.example.com')
    expect((err as { code?: string }).code).toBe('ESSRFBLOCKED')
  })

  it('allowPrivate 档私网放行(LAN 自托管合法面)', async () => {
    dnsMock.rows.push({ address: '192.168.1.10', family: 4 })
    const { err } = await runLookup('nas.lan', true)
    expect(err).toBeNull()
  })

  it('危险族(云元数据)即使 allowPrivate 也拦', async () => {
    dnsMock.rows.push({ address: '169.254.169.254', family: 4 })
    const { err } = await runLookup('metadata.internal', true)
    expect((err as { code?: string }).code).toBe('ESSRFBLOCKED')
  })

  it('解析失败 ⇒ 交回错误,绝不静默放行', async () => {
    dnsMock.lookup.mockRejectedValueOnce(new Error('ENOTFOUND'))
    const { err } = await runLookup('nx.example.com')
    expect((err as Error).message).toBe('ENOTFOUND')
  })
})

describe('ssrfGuardedDispatcher 档位单例(第 15 批 M3)', () => {
  it('同档复用同一实例,不同档各一枚', () => {
    expect(ssrfGuardedDispatcher()).toBe(ssrfGuardedDispatcher())
    expect(ssrfGuardedDispatcher({ allowPrivate: true })).toBe(
      ssrfGuardedDispatcher({ allowPrivate: true }),
    )
    expect(ssrfGuardedDispatcher()).not.toBe(ssrfGuardedDispatcher({ allowPrivate: true }))
  })
})

describe('safeFetch 接 dispatcher 接线(第 15 批 M3)', () => {
  beforeEach(() => {
    dnsMock.rows.length = 0
    dnsMock.lookup.mockClear()
    undiciMock.fetchSpy.mockReset()
    // 公网解析 + 一个 200 文本响应(重定向循环零跳返回)
    dnsMock.rows.push({ address: '93.184.216.34', family: 4 })
    undiciMock.fetchSpy.mockResolvedValue(
      new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
    )
  })

  it('默认档把默认档 dispatcher 传给建连层(TOCTOU 收口的关键接线)', async () => {
    await safeFetch('https://example.com/x')
    expect(undiciMock.fetchSpy).toHaveBeenCalledTimes(1)
    const init = undiciMock.fetchSpy.mock.calls[0][1] as { dispatcher?: unknown }
    expect(init.dispatcher).toBe(ssrfGuardedDispatcher())
  })

  it('allowPrivate 档把 allowPrivate 档 dispatcher 传给建连层', async () => {
    await safeFetch('https://example.com/x', {}, { allowPrivate: true })
    const init = undiciMock.fetchSpy.mock.calls[0][1] as { dispatcher?: unknown }
    expect(init.dispatcher).toBe(ssrfGuardedDispatcher({ allowPrivate: true }))
  })

  it('首跳判定仍在前:私网字面量不建连直接拒(私网禁面不回退)', async () => {
    await expect(safeFetch('http://10.0.0.5/x')).rejects.toThrow(/SSRF blocked/)
    expect(undiciMock.fetchSpy).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
