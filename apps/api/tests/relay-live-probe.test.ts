// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 反代号池真上游联调探针 vitest 套件(2026-10-22 立)。
 *
 * 两部分:
 * 1. env 门控用例(RELAY_LIVE_PROBE=1 才跑):复用 src/services/relay-live-probe.ts
 *    同一实现逐平台打真实上游,断言产出结构化报告(不复制探针逻辑)。
 * 2. 不门控静态用例(默认必跑):证明无 RELAY_LIVE_PROBE 时探针实现与
 *    runLiveProbe 都不发起任何真实网络(fetch 打桩为 spy,断言零调用),
 *    并覆盖门控/凭据解析/上下文构造/报告格式化/退出码等纯函数行为。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isProbeEnabled,
  probeTimeoutMs,
  parseProbeCredential,
  buildAccountContext,
  runLiveProbe,
  formatProbeReport,
  probeExitCode,
  PROBE_ENABLE_ENV,
  PROBE_TIMEOUT_ENV,
  PROBE_CRED_ENV,
  type ProbeReport,
  type ProbeResult,
  type ProbeStepOutcome,
} from '../src/services/relay-live-probe.js'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

// ---------------------------------------------------------------------------
// fetch 零调用打桩(静态用例共用)
// ---------------------------------------------------------------------------

function installFetchSpy(): ReturnType<typeof vi.fn> {
  const spy = vi.fn(() => Promise.reject(new Error('探针静态用例禁止发起真实网络')))
  ;(globalThis as { fetch: unknown }).fetch = spy as unknown as typeof fetch
  return spy
}
const originalFetch = globalThis.fetch
afterEach(() => {
  ;(globalThis as { fetch: unknown }).fetch = originalFetch
})

// ---------------------------------------------------------------------------
// 1. env 门控:有 RELAY_LIVE_PROBE=1 才打真实上游
// ---------------------------------------------------------------------------

describe.skipIf(process.env[PROBE_ENABLE_ENV] !== '1')('relay live probe(真实上游联调)', () => {
  it('逐平台执行探针并产出结构化报告(有凭据平台不得为 skip)', { timeout: 300_000 }, async () => {
    const report = await runLiveProbe(process.env)
    // eslint-disable-next-line no-console
    console.log(formatProbeReport(report))
    expect(report.enabled).toBe(true)
    expect(report.results).toHaveLength(3)
    for (const r of report.results) {
      expect(['pass', 'fail', 'skip']).toContain(r.overall)
      for (const step of [r.health, r.nonStream, r.stream]) {
        expect(['pass', 'fail', 'skip']).toContain(step.status)
        expect(step.ms).toBeGreaterThanOrEqual(0)
      }
      // 配了凭据 env 的平台必须真正执行过(整体或至少一步非 skip)
      if (process.env[PROBE_CRED_ENV[r.provider]]) {
        expect(r.overall).not.toBe('skip')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// 2. 不门控静态断言:无 RELAY_LIVE_PROBE 时零网络 + 纯函数行为
// ---------------------------------------------------------------------------

describe('relay live probe(静态断言,零网络)', () => {
  it('探针模块(含适配器导入链)被导入时不产生任何 fetch 调用', async () => {
    vi.resetModules()
    const spy = installFetchSpy()
    await import('../src/services/relay-live-probe.js')
    expect(spy).not.toHaveBeenCalled()
  })

  it('isProbeEnabled 仅认 RELAY_LIVE_PROBE=1', () => {
    expect(isProbeEnabled({})).toBe(false)
    expect(isProbeEnabled({ [PROBE_ENABLE_ENV]: '0' })).toBe(false)
    expect(isProbeEnabled({ [PROBE_ENABLE_ENV]: 'true' })).toBe(false)
    expect(isProbeEnabled({ [PROBE_ENABLE_ENV]: '1' })).toBe(true)
  })

  it('probeTimeoutMs 缺省 20000,非法值回退缺省', () => {
    expect(probeTimeoutMs({})).toBe(20_000)
    expect(probeTimeoutMs({ [PROBE_TIMEOUT_ENV]: '5000' })).toBe(5_000)
    expect(probeTimeoutMs({ [PROBE_TIMEOUT_ENV]: 'abc' })).toBe(20_000)
    expect(probeTimeoutMs({ [PROBE_TIMEOUT_ENV]: '-1' })).toBe(20_000)
  })

  it('未开启探针时 runLiveProbe 直接返回空报告且零网络', async () => {
    const spy = installFetchSpy()
    const report = await runLiveProbe({})
    expect(report.enabled).toBe(false)
    expect(report.results).toHaveLength(0)
    expect(spy).not.toHaveBeenCalled()
  })

  it('开启探针但无任何平台凭据 env:三平台全部 skip 且零网络', async () => {
    const spy = installFetchSpy()
    const report = await runLiveProbe({ [PROBE_ENABLE_ENV]: '1' })
    expect(report.enabled).toBe(true)
    expect(report.results).toHaveLength(3)
    for (const r of report.results) {
      expect(r.overall).toBe('skip')
      expect(r.note).toContain('跳过')
    }
    expect(spy).not.toHaveBeenCalled()
    expect(probeExitCode(report)).toBe(0)
  })

  it('parseProbeCredential:合法/非法凭据的清晰报错(不触网)', () => {
    const cred = parseProbeCredential('{"token":"t-1","model":"m-1"}', 'trae')
    expect(cred.token).toBe('t-1')
    expect(() => parseProbeCredential('not-json', 'trae')).toThrow(
      /RELAY_PROBE_TRAE_CRED.*合法 JSON/,
    )
    expect(() => parseProbeCredential('[1]', 'workbuddy')).toThrow(/RELAY_PROBE_WORKBUDDY_CRED/)
    expect(() => parseProbeCredential('{"model":"m"}', 'codearts')).toThrow(
      /RELAY_PROBE_CODEARTS_CRED.*token/,
    )
    expect(() => parseProbeCredential('{"token":"  "}', 'trae')).toThrow(/非空 token/)
  })

  it('buildAccountContext:凭据 JSON 映射为适配器上下文最小 row(缺省项有兜底)', () => {
    const ctx = buildAccountContext('trae', { token: ' jwt-1 ' })
    expect(ctx.credentials.token).toBe('jwt-1')
    expect(ctx.credentials.refreshToken).toBeNull()
    expect(ctx.credentials.cookies).toEqual([])
    expect(ctx.credentials.secrets).toEqual({})
    expect(ctx.row.providerCode).toBe('trae')
    expect(ctx.row.uid).toBe('probe-trae')
    expect(ctx.row.proxyUrl).toBeNull()
    const ctx2 = buildAccountContext('codearts', {
      token: 'st',
      uid: 'u-9',
      proxyUrl: 'http://127.0.0.1:8899',
      secrets: { accessKeyId: 'ak' },
      refreshToken: 'rt',
    })
    expect(ctx2.row.uid).toBe('u-9')
    expect(ctx2.row.proxyUrl).toBe('http://127.0.0.1:8899')
    expect(ctx2.credentials.secrets.accessKeyId).toBe('ak')
    expect(ctx2.credentials.refreshToken).toBe('rt')
  })

  it('buildAccountContext:web 号的 cookies 原样透传(带 sessionid 才测得续票全链路)', () => {
    const cookies = [
      { name: 'sessionid', value: 's-1', domain: '.trae.cn', httpOnly: true },
      { name: 'other', value: 'o-1', domain: '.trae.cn' },
    ]
    const ctx = buildAccountContext('trae', { token: 'jwt-1', cookies })
    expect(ctx.credentials.cookies).toHaveLength(2)
    expect(ctx.credentials.cookies[0]).toMatchObject({ name: 'sessionid', value: 's-1' })
  })

  it('formatProbeReport / probeExitCode:纯函数按结果表渲染并反映成败', () => {
    const step = (
      status: ProbeStepOutcome['status'],
      kind = 'none',
      error?: string,
    ): ProbeStepOutcome => ({
      status,
      ms: 12,
      kind: kind as ProbeStepOutcome['kind'],
      error,
    })
    const okResult: ProbeResult = {
      provider: 'trae',
      credEnv: PROBE_CRED_ENV.trae,
      health: step('pass'),
      nonStream: step('pass'),
      stream: step('pass'),
      overall: 'pass',
    }
    const badResult: ProbeResult = {
      provider: 'workbuddy',
      credEnv: PROBE_CRED_ENV.workbuddy,
      health: step('fail', 'auth', 'HTTP 401 鉴权失效'),
      nonStream: step('fail', 'auth', '上游 HTTP 401'),
      stream: step('skip'),
      overall: 'fail',
    }
    const report: ProbeReport = { enabled: true, timeoutMs: 20_000, results: [okResult, badResult] }
    const text = formatProbeReport(report)
    expect(text).toContain('trae')
    expect(text).toContain('PASS(12ms)')
    expect(text).toContain('FAIL(12ms)')
    expect(text).toContain('auth')
    expect(text).toContain('1 平台通过 / 1 失败')
    expect(probeExitCode(report)).toBe(1)
    expect(probeExitCode({ enabled: false, timeoutMs: 1, results: [] })).toBe(0)
    expect(formatProbeReport({ enabled: false, timeoutMs: 20_000, results: [] })).toContain(
      '未开启',
    )
  })

  it('探针已装车:有可发现的命令入口,入口只 import 生产判据不复算', () => {
    const pkg = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    const cli = join(PKG_DIR, 'scripts', 'relay-live-probe.ts')
    expect(pkg.scripts?.['relay:live-probe']).toBe('tsx scripts/relay-live-probe.ts')
    expect(existsSync(cli)).toBe(true)
    const src = readFileSync(cli, 'utf8')
    // 判据单源(§0.6):入口只准 import,自带网络/探测逻辑就是第二份真相
    expect(src).toContain("from '../src/services/relay-live-probe.js'")
    expect(src).not.toMatch(/\bfetch\(/)
    expect(src).not.toContain('undici')
    // 未开启档必须显式喊"未判定",不许被读成"已验证"(§0.3)
    expect(src).toContain('未判定')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
