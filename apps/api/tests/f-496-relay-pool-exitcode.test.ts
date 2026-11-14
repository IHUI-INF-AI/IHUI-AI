// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-496 回归锁(2026-11-13)。
 *
 * 病灶:账号池 worker 把回灌子进程的非 0 退出/超时当成功 —— 处理器正常 return,
 * BullMQ 记 completed,既不重试也不报警,账号池状态停在坏读数上直到下次调度。
 *
 * 本文件锁四条判据(mock 子进程与队列,不跑真实脚本/Redis):
 *   ① exitCode=1 ⇒ 抛错(处理器 reject),且不写成功("done")日志;
 *   ② 超时 ⇒ 抛错,timedOut=true、exitCode=null(不再降级成「未判定」warn);
 *   ③ 只有 exitCode=0 且输出可解析才正常返回(completed);
 *   ④ 失败日志带账号标识、退出码与耗时。
 * 另附:退出码 0 但输出不可解析 ⇒ 同样按失败抛错(F-496 判据的一次性收口)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'

type Job = { name: string }
type Processor = (job: Job) => Promise<unknown>

const h = vi.hoisted(() => ({
  spawn: vi.fn(),
  processor: null as unknown as Processor | null,
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logDebug: vi.fn(),
  sweep: vi.fn(),
}))

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => h.spawn(...args),
  default: { spawn: (...args: unknown[]) => h.spawn(...args) },
}))

vi.mock('bullmq', () => {
  class Queue {
    upsertJobScheduler = vi.fn(async () => ({}))
    removeJobScheduler = vi.fn(async () => false)
    close = vi.fn(async () => undefined)
  }
  class Worker {
    constructor(_name: string, processor: Processor) {
      h.processor = processor
    }
    on = vi.fn()
    close = vi.fn(async () => undefined)
  }
  return { Queue, Worker }
})

vi.mock('../src/services/relay-account-pool-scheduler.js', () => ({
  sweepAccountPool: (...args: unknown[]) => h.sweep(...args),
}))

vi.mock('../src/services/relay-queue-name.js', () => ({
  relayAccountPoolQueueName: () => 'relay-account-pool-queue-test',
  describeQueueIsolation: () => 'test-isolation',
}))

vi.mock('../src/services/relay-session-sync-noise.js', () => ({
  decideUnjudgedLog: (_state: unknown, _reason: string, now: number) => ({
    state: { reason: 'test', at: now },
    warn: true,
    suppressed: 0,
  }),
  unjudgedReasonOf: () => 'test-reason',
}))

// 适配器注册会带出 db/config 整条依赖图,与本票无关 ⇒ 空实现
vi.mock('../src/services/upstream-adapters/index.js', () => ({
  registerAllRelayAdapters: vi.fn(),
}))

const { startRelayAccountPoolWorker } = await import('../src/workers/relay-account-pool-worker.js')

interface ChildBehavior {
  stdout?: string
  stderr?: string
  code?: number | null
  signal?: string | null
  /** 超时用例:永不自行退出,只有 kill 才会 close */
  waitForKill?: boolean
  /** 触发 spawn 的 error 事件(派生失败) */
  spawnError?: string
}

let behavior: ChildBehavior = {}

function fakeChild(b: ChildBehavior) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: ReturnType<typeof vi.fn>
  }
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = vi.fn(() => {
    // 超时判据:定时器 kill 后同步 close(监听器已挂好)
    child.emit('close', null, 'SIGTERM')
    return true
  })
  void Promise.resolve().then(() => {
    if (b.stdout) child.stdout.emit('data', Buffer.from(b.stdout))
    if (b.stderr) child.stderr.emit('data', Buffer.from(b.stderr))
    if (b.spawnError) {
      child.emit('error', new Error(b.spawnError))
      return
    }
    if (b.waitForKill) return
    child.emit('close', b.code ?? 0, b.signal ?? null)
  })
  return child
}

function makeServer() {
  return {
    redisForQueue: {},
    log: { info: h.logInfo, warn: h.logWarn, error: h.logError, debug: h.logDebug },
    addHook: vi.fn(),
  }
}

function startAndGetProcessor(): Processor {
  startRelayAccountPoolWorker(makeServer() as never)
  const processor = h.processor
  expect(typeof processor).toBe('function')
  return processor as Processor
}

async function settle(
  p: Promise<unknown>,
): Promise<{ ok: true; value: unknown } | { ok: false; error: Error }> {
  try {
    return { ok: true, value: await p }
  } catch (error) {
    return { ok: false, error: error as Error }
  }
}

function doneLogged(): boolean {
  return h.logInfo.mock.calls.some(
    (call) => typeof call[1] === 'string' && call[1].includes(' done'),
  )
}

beforeEach(() => {
  behavior = {}
  h.processor = null
  h.spawn.mockReset()
  h.spawn.mockImplementation(() => fakeChild(behavior))
  h.logInfo.mockReset()
  h.logWarn.mockReset()
  h.logError.mockReset()
  h.logDebug.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('F-496 账号池 worker 子进程结果判定', () => {
  it('① exitCode=1 ⇒ 抛错,不落 completed 成功路径', async () => {
    behavior = { code: 1, stderr: '编排器落库失败' }
    const processor = startAndGetProcessor()

    const r = await settle(processor({ name: 'trae-session-sync' }))

    expect(r.ok).toBe(false)
    const err = (r as { ok: false; error: Error & { exitCode?: number } }).error
    expect(err.name).toBe('RelayClientSyncError')
    expect(err.message).toContain('子进程失败')
    expect(err.message).toContain('exitCode=1')
    // 抛错 = BullMQ 记 failed;成功日志绝不能出现(它等同于 completed)
    expect(doneLogged()).toBe(false)
  })

  it('② 超时 ⇒ 抛错,timedOut=true 且 exitCode=null', async () => {
    vi.useFakeTimers()
    behavior = { waitForKill: true }
    const processor = startAndGetProcessor()

    const pending = settle(processor({ name: 'qoder-session-sync' }))
    // 既有超时配置 540s(CLIENT_SYNC_TIMEOUT_MS)
    await vi.advanceTimersByTimeAsync(540_000)
    await vi.advanceTimersByTimeAsync(0)
    const r = await pending

    expect(r.ok).toBe(false)
    const err = (
      r as { ok: false; error: Error & { timedOut?: boolean; exitCode?: number | null } }
    ).error
    expect(err.name).toBe('RelayClientSyncError')
    expect(err.timedOut).toBe(true)
    expect(err.exitCode).toBeNull()
    expect(doneLogged()).toBe(false)
  })

  it('③ 仅 exitCode=0 且输出可解析才正常返回(completed)', async () => {
    behavior = {
      code: 0,
      stdout: JSON.stringify({ applied: 3, skipped: 1, rows: [{ uid: 'uid-1' }] }),
    }
    const processor = startAndGetProcessor()

    const r = await settle(processor({ name: 'minimax-session-sync' }))

    expect(r.ok).toBe(true)
    const outcome = (r as { ok: true; value: Record<string, unknown> }).value
    expect(outcome.code).toBe(0)
    expect(outcome.applied).toBe(3)
    expect(outcome.skipped).toBe(1)
    expect(outcome.accountIds).toEqual(['uid-1'])
    expect(doneLogged()).toBe(true)
    expect(h.logError).not.toHaveBeenCalled()
  })

  it('④ 失败日志含账号标识、退出码与耗时', async () => {
    behavior = { code: 1, stderr: '脚本崩溃' }
    const processor = startAndGetProcessor()

    const r = await settle(processor({ name: 'trae-session-sync' }))
    expect(r.ok).toBe(false)

    const failureLog = h.logError.mock.calls.find(
      (call) => typeof call[1] === 'string' && call[1].includes('子进程失败'),
    )
    expect(failureLog).toBeTruthy()
    const fields = failureLog?.[0] as Record<string, unknown>
    expect(fields.accountId).toBe('trae-session-sync')
    expect(fields.platform).toBe('trae-session-sync')
    expect(fields.exitCode).toBe(1)
    expect(typeof fields.durationMs).toBe('number')
    expect(fields.code).not.toBe(0)
  })

  it('⑤ 退出码 0 但输出不可解析 ⇒ 也按失败抛错(不再静默归零)', async () => {
    behavior = { code: 0, stdout: 'not-json' }
    const processor = startAndGetProcessor()

    const r = await settle(processor({ name: 'zcode-session-sync' }))

    expect(r.ok).toBe(false)
    const err = (r as { ok: false; error: Error & { parseFailed?: boolean } }).error
    expect(err.name).toBe('RelayClientSyncError')
    expect(err.parseFailed).toBe(true)
  })
})
