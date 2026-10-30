// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay 出网复检的回归锁。
 *
 * 病灶(现读代码核对):渠道 base_url 在**保存时**过 safeFetch,但 relay-account-forwarder
 * 的账号级 fetch 是裸 undici —— 保存之后域名改指内网(DNS 变更 / rebinding)没人再看。
 *
 * 这组用例的核心不是"能不能连内网"(自托管模型本来就在 LAN,拦了就是打断功能),
 * 而是**允许私网绝不能顺带放过元数据/回环/本机**。每条"放宽"都配一条"仍拦"的反证。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const lookupMock = vi.hoisted(() => vi.fn())
vi.mock('node:dns/promises', () => ({ lookup: lookupMock }))

/** 桩掉 undici 的 Agent：既不建真连接池（否则本进程留句柄），又能验"钩子真装上了" */
const agentCtorArgs = vi.hoisted(() => [] as unknown[])
vi.mock('undici', () => ({
  Agent: class {
    constructor(opts?: unknown) {
      agentCtorArgs.push(opts)
    }
    close(): void {}
  },
}))

import { assertSafeFetchUrl, isBlockedTargetIp } from '../src/utils/ssrf-guard.js'
import {
  RELAY_EGRESS_GUARD,
  assertRelayEgressSafe,
  directEgressDispatcher,
  relayGuardedLookup,
} from '../src/utils/relay-egress-guard.js'

/** 把 callback 形态的连接期守卫包成 Promise，好逐态断言 */
function runLookup(
  host: string,
): Promise<{ err: NodeJS.ErrnoException | null; addresses: unknown }> {
  return new Promise((resolve) => {
    relayGuardedLookup(host, {}, (err, addresses) => resolve({ err, addresses }))
  })
}

beforeEach(() => {
  lookupMock.mockReset()
})

describe('危险族判据（与私网族分开）', () => {
  it.each([
    '127.0.0.1',
    '127.2.3.4',
    '169.254.169.254',
    '0.0.0.0',
    '::1',
    'fe80::1',
    'localhost',
    // URL.hostname 对 IPv6 字面量带方括号 —— 剥不掉就是一扇敞开的门(实测既存绕过)
    '[::1]',
    '[fe80::1]',
    '[::ffff:127.0.0.1]',
    // URL 规范化后的等价形态：点分 127.0.0.1 会被写成 ::ffff:7f00:1
    '::ffff:7f00:1',
    '::7f00:1',
    '[::ffff:a9fe:a9fe]',
  ])('拦 %s', (ip) => {
    expect(isBlockedTargetIp(ip)).toBe(true)
  })

  it.each(['192.168.1.20', '10.1.2.3', '172.16.5.6', 'fc00::5', 'fd12::1', '8.8.8.8'])(
    '不拦 %s（私网/公网自托管属允许面）',
    (ip) => {
      expect(isBlockedTargetIp(ip)).toBe(false)
    },
  )
})

describe('默认档逐字不变（放宽只能发生在显式传档的调用侧）', () => {
  it('端口白名单与私网拦截照旧', async () => {
    expect((await assertSafeFetchUrl('http://example.com:8080/x')).safe).toBe(false)
    expect((await assertSafeFetchUrl('http://192.168.1.20:11434/v1')).safe).toBe(false)
    expect((await assertSafeFetchUrl('http://127.0.0.1/x')).safe).toBe(false)
    expect((await assertSafeFetchUrl('file:///etc/passwd')).safe).toBe(false)
  })

  it.each([
    'http://[::1]:8000/x',
    'http://[fe80::1]/x',
    'http://[::ffff:127.0.0.1]/x',
    'http://[::ffff:a9fe:a9fe]/latest/meta-data/',
  ])('反证（既存绕过）：%s 在默认档也必须拦', async (url) => {
    const r = await assertSafeFetchUrl(url)
    expect(r.safe).toBe(false)
  })
})

describe('relay 档：放行 LAN 自托管，但危险族恒拦', () => {
  it('档位就是"放行私网 + 放行非常端"两维，没有第三维', () => {
    expect(RELAY_EGRESS_GUARD).toEqual({ allowPrivate: true, allowCustomPort: true })
  })

  it('私网 + 非常端 ⇒ 放行（否则 Ollama/vLLM 全废）', async () => {
    expect(
      await assertSafeFetchUrl('http://192.168.1.20:11434/v1/chat', RELAY_EGRESS_GUARD),
    ).toEqual({ safe: true })
  })

  it.each([
    'http://127.0.0.1:11434/v1/chat',
    'http://169.254.169.254/latest/meta-data/iam/',
    'http://0.0.0.0:8000/x',
    'http://[::1]:8000/x',
  ])('反证：%s 即便在 relay 档也必须拦', async (url) => {
    const r = await assertSafeFetchUrl(url, RELAY_EGRESS_GUARD)
    expect(r.safe).toBe(false)
    expect(r.reason).toContain('blocked target')
  })

  it('协议白名单不因放宽端口而放松', async () => {
    expect((await assertSafeFetchUrl('gopher://10.0.0.1:11434/x', RELAY_EGRESS_GUARD)).safe).toBe(
      false,
    )
    expect((await assertSafeFetchUrl('http://10.0.0.1:11434/x', RELAY_EGRESS_GUARD)).safe).toBe(
      true,
    )
  })
})

describe('DNS 重绑定面（解析后的每个 IP 都问一遍）', () => {
  it('域名解析到内网：默认档拦、relay 档放行', async () => {
    lookupMock.mockResolvedValue([{ address: '10.0.0.5', family: 4 }])
    expect((await assertSafeFetchUrl('http://self-host.example:11434/v1')).safe).toBe(false)
    expect(
      (await assertSafeFetchUrl('http://self-host.example:11434/v1', RELAY_EGRESS_GUARD)).safe,
    ).toBe(true)
  })

  it('反证：域名解析里混进云元数据 ⇒ relay 档也拦，并点名那个 IP', async () => {
    lookupMock.mockResolvedValue([
      { address: '10.0.0.5', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ])
    const r = await assertSafeFetchUrl('http://evil.example/x', RELAY_EGRESS_GUARD)
    expect(r.safe).toBe(false)
    expect(r.reason).toContain('169.254.169.254')
  })

  it('解析失败 ⇒ 拦（判不出不放行）', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'))
    expect((await assertSafeFetchUrl('http://gone.example/x', RELAY_EGRESS_GUARD)).safe).toBe(false)
  })
})

describe('出网入口自身', () => {
  it('LAN 自托管 URL ⇒ 不抛', async () => {
    await expect(assertRelayEgressSafe('http://192.168.66.9:8000/v1/chat')).resolves.toBeUndefined()
  })

  it('元数据 URL ⇒ 抛错并带拦因', async () => {
    await expect(assertRelayEgressSafe('http://169.254.169.254/latest/')).rejects.toThrow(
      /relay egress blocked.*169\.254\.169\.254|relay egress blocked/,
    )
  })

  it('空目标 / 非法 URL ⇒ 抛错（判不出即拦）', async () => {
    await expect(assertRelayEgressSafe('')).rejects.toThrow(/relay egress blocked/)
    await expect(assertRelayEgressSafe('not-a-url')).rejects.toThrow(/relay egress blocked/)
  })

  it('Request 形态的入参按它自己的 url 判定（不靠改写入参）', async () => {
    const req = new Request('http://169.254.169.254/latest/', { method: 'POST' })
    await expect(assertRelayEgressSafe(req)).rejects.toThrow(/relay egress blocked/)
  })
})

describe('接线锁（复检必须住在发请求那一刻）', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/services/relay-account-forwarder.ts', import.meta.url)),
    'utf8',
  )
  const fnMatch = src.match(/\nfunction poolFetch[\s\S]*?\n\}\n/)
  const body = fnMatch?.[0] ?? ''

  it('取到的是 poolFetch 函数体本身（夹具自证，防止空串假绿）', () => {
    expect(body).toContain('function poolFetch')
    expect(body.length).toBeLessThan(1200)
  })

  it('闸只有一处且在连接之前（两条分支共用同一函数体，不存在"只查代理"那一型）', () => {
    expect((body.match(/await assertRelayEgressSafe\(input\)/g) ?? []).length).toBe(1)
    expect(body.indexOf('assertRelayEgressSafe')).toBeLessThan(body.indexOf('undiciFetch'))
  })

  it('复检的是原始 input，不是被改写后的字符串（保住 Request 语义）', () => {
    expect(body).toContain('undiciFetch(input as string')
  })

  it('直连分支交的是带连接期钩子的 dispatcher，不再走内置 globalThis.fetch', () => {
    expect(body).toContain('directEgressDispatcher()')
    expect(body).not.toContain('globalThis.fetch')
  })

  it('转发器不再自带第二份地址判据', () => {
    expect(src).not.toContain('isPrivateOrReservedIp')
    expect(src).toContain("from '../utils/relay-egress-guard.js'")
  })
})

describe('连接期守卫（真防 DNS rebinding 的那一层）', () => {
  it('解析到云元数据 ⇒ 回调收到拦因，一个地址都不交回（连接不会发生）', async () => {
    lookupMock.mockResolvedValue([{ address: '169.254.169.254', family: 4 }])
    const res = await runLookup('metadata.example')
    expect(res.err?.message).toContain('blocked target')
    expect(res.err?.code).toBe('ERELAYEGRESS')
    expect(res.addresses).toEqual([])
  })

  it('解析结果里混一条危险地址 ⇒ 整批拦（不能只挑好的那条连）', async () => {
    lookupMock.mockResolvedValue([
      { address: '203.0.113.10', family: 4 },
      { address: '[::1]', family: 6 },
    ])
    const res = await runLookup('mixed.example')
    expect(res.err?.message).toContain('blocked target')
    expect(res.addresses).toEqual([])
  })

  it.each([
    { address: '203.0.113.10', family: 4 },
    { address: '10.0.0.5', family: 4 },
    { address: '192.168.66.9', family: 4 },
  ])('反证 %#：公网与 LAN 自托管地址原样交回（守卫不得顺手打断功能）', async (row) => {
    lookupMock.mockResolvedValue([row])
    const res = await runLookup('host.example')
    expect(res.err).toBeNull()
    expect(res.addresses).toEqual([row])
  })

  it('解析本身失败 ⇒ 错误交回，绝不"判不出就当放行"', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'))
    const res = await runLookup('gone.example')
    expect(res.err).not.toBeNull()
    expect(res.addresses).toEqual([])
  })

  it('钩子确实装进了 dispatcher（不是只在旁边定义了个函数）', () => {
    const first = directEgressDispatcher()
    expect(first).toBe(directEgressDispatcher()) // 单例：连接池不能每请求新建
    const opts = agentCtorArgs[0] as {
      connect?: { lookup?: unknown }
    }
    expect(opts.connect?.lookup).toBe(relayGuardedLookup)
  })
})

describe('接线锁·上游转发器（forwardToChannel 出网前复检，2026-10-28）', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/services/relay-upstream-forwarder.ts', import.meta.url)),
    'utf8',
  )
  // 取 forwardToChannel 函数体作夹具：顶层闭括号在行首，函数内嵌套块的括号都带缩进
  const start = src.indexOf('export async function forwardToChannel')
  const body = start >= 0 ? src.slice(start, src.indexOf('\n}\n', start)) : ''

  it('取到的是 forwardToChannel 函数体本身（防空串假绿）', () => {
    expect(body).toContain('export async function forwardToChannel')
    expect(body).toContain('for (const channel of candidates)')
  })

  it('闸只有一处，且复检的就是真正要发出去的那条 URL', () => {
    expect((body.match(/await assertRelayEgressSafe\(targetUrl\)/g) ?? []).length).toBe(1)
    expect(body.indexOf('assertRelayEgressSafe')).toBeLessThan(body.indexOf('fetch(targetUrl'))
  })

  it('闸与 fetch 同在候选的 try 块内：不安全目标抛错由 catch 走 failover，整轮循环不被打断', () => {
    const gate = body.indexOf('assertRelayEgressSafe')
    // 取"最近的外层"那一对：闸之前最近一个 try，闸之后第一个 catch
    expect(body.lastIndexOf('try {', gate)).toBeGreaterThan(0)
    const caught = body.indexOf('} catch', gate)
    expect(caught).toBeGreaterThan(gate)
    // catch 体内走 failover（含客户端断开时 break 的专例外），而不是把整轮循环抛出去
    expect(body.slice(caught, caught + 600)).toContain('continue')
  })

  it('判据不在本文件另起一份（与账号池回落同源，档位一致）', () => {
    expect(src).not.toContain('isPrivateOrReservedIp')
    expect(src).toContain("from '../utils/relay-egress-guard.js'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
