// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-625 回归锁(2026-11-13)。
 *
 * 病灶:relay-live-probe 的 withTimeout 用 Promise.race 超时后只是放弃等待,
 * 底层 fetch(checkHealth / executeChat)未被 abort,句柄滞留到上游自行超时。
 *
 * 本文件锁:
 *   ① 健康检查超时 ⇒ 透传的 signal.aborted 为 true;
 *   ② 超时仍按原语义返回 timeout 失败(错误分类与文案不变);
 *   ③ chat 超时同样中止底层请求;
 *   ④ 正常完成不 abort(信号只在超时分支触发)。
 *
 * 只注册假适配器覆盖 trae,不触达真实上游 / PG / Redis。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { probeProvider } from '../src/services/relay-live-probe.js'
import {
  registerRelayAdapter,
  getRelayAdapter,
  type RelayUpstreamAdapter,
} from '../src/services/relay-upstream-adapters.js'
import { registerAllRelayAdapters } from '../src/services/upstream-adapters/index.js'

registerAllRelayAdapters()
const realTrae = getRelayAdapter('trae')

interface CapturedSignals {
  health?: AbortSignal
  chat?: AbortSignal
}

function never(): Promise<never> {
  return new Promise<never>(() => {})
}

/** 假 trae 适配器:checkHealth / executeChat 按开关挂起,记录收到的 signal */
function installFakeTrae(mode: { health: 'hang' | 'ok'; chat: 'hang' | 'ok' }): CapturedSignals {
  const captured: CapturedSignals = {}
  const adapter = {
    providerCode: 'trae',
    buildChatRequest: () => ({ url: 'https://probe.invalid/chat', method: 'POST', headers: {} }),
    translateStreamChunk: () => null,
    translateNonStream: () => ({ choices: [] }),
    isAuthFailure: () => false,
    checkHealth: (_ctx: unknown, opts?: { signal?: AbortSignal }) => {
      captured.health = opts?.signal
      return mode.health === 'ok' ? Promise.resolve({ ok: true }) : never()
    },
    executeChat: (_ctx: unknown, _req: unknown, opts: { signal?: AbortSignal }) => {
      captured.chat = opts.signal
      if (mode.chat !== 'ok') return never()
      return Promise.resolve({
        stream: (async function* () {
          yield { choices: [{ delta: { content: 'pong' } }] }
        })(),
        completion: { choices: [] },
      })
    },
  } as unknown as RelayUpstreamAdapter
  registerRelayAdapter(adapter)
  return captured
}

afterEach(() => {
  vi.useRealTimers()
  if (realTrae) registerRelayAdapter(realTrae)
})

describe('F-625 live-probe 超时中止底层请求', () => {
  it('健康检查超时后 signal.aborted 为 true', async () => {
    vi.useFakeTimers()
    const captured = installFakeTrae({ health: 'hang', chat: 'ok' })
    const run = probeProvider('trae', { token: 'probe-token' }, { timeoutMs: 100 })
    await vi.advanceTimersByTimeAsync(100)
    const result = await run
    expect(captured.health?.aborted).toBe(true)
    expect(result.health.status).toBe('fail')
  })

  it('超时仍返回 timeout 失败(错误分类与文案不变)', async () => {
    vi.useFakeTimers()
    installFakeTrae({ health: 'hang', chat: 'ok' })
    const run = probeProvider('trae', { token: 'probe-token' }, { timeoutMs: 100 })
    await vi.advanceTimersByTimeAsync(100)
    const result = await run
    expect(result.health.kind).toBe('timeout')
    expect(result.health.error).toContain('健康检查 超时(>100ms)')
  })

  it('chat 超时同样中止底层请求', async () => {
    vi.useFakeTimers()
    const captured = installFakeTrae({ health: 'ok', chat: 'hang' })
    const run = probeProvider('trae', { token: 'probe-token' }, { timeoutMs: 100 })
    await vi.advanceTimersByTimeAsync(20_000)
    const result = await run
    expect(captured.chat?.aborted).toBe(true)
    expect(result.nonStream.kind).toBe('timeout')
    expect(result.stream.kind).toBe('timeout')
  })

  it('正常完成不 abort(health 与 chat 的 signal 均未中止)', async () => {
    vi.useFakeTimers()
    const captured = installFakeTrae({ health: 'ok', chat: 'ok' })
    const result = await probeProvider('trae', { token: 'probe-token' }, { timeoutMs: 100 })
    expect(captured.health?.aborted).toBe(false)
    expect(captured.chat?.aborted).toBe(false)
    expect(result.overall).toBe('pass')
  })
})
