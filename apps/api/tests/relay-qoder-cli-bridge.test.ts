// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder CLI 桥接 executeChat 单测(2026-10-23 立)。
 *
 * 不跑真实 Qoder CLI、不发任何真实上游请求、不触碰登录态:
 * - 翻译层:runner NDJSON → OpenAI chunk(增量/finish/usage/错误行→带 statusCode 抛错);
 * - 假 spawn:请求行形状、进程收尾 kill、abort/提前 return 必杀子进程;
 * - 互斥:两会话并发串行(第二个等第一个完成才 spawn,deferred 控时序);
 * - 门控:env 缺失/文件不存在 → statusCode 0 明确错误(不冒充);
 *   QODER_BRIDGE_ENABLED=1 时 executeChat 存在,=0 时缺省并落到
 *   QODER_CHAT_CONTRACT_UNVERIFIED 三件套;
 * - runner 协议:注入假 SDK(.mjs 夹具)真跑 runner 子进程,验证 stdin/stdout NDJSON 线。
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawn as realSpawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  QoderBridgeError,
  createRunnerTranslateState,
  isQoderBridgeEnabled,
  preflightQoderBridge,
  qoderCliChatChunks,
  renderQoderPrompt,
  translateRunnerMessage,
  type BridgeChild,
  type BridgeSpawn,
} from '../src/services/upstream-adapters/qoder-cli-bridge.js'

// =============================================================================
// 环境与夹具
// =============================================================================

const ENV_KEYS = [
  'QODER_BRIDGE_ENABLED',
  'QODER_BRIDGE_RUNNER',
  'QODER_SDK_PATH',
  'QODER_CLI_PATH',
  'QODER_CONFIG_DIR',
  'QODERCN_CONFIG_DIR',
] as const

let savedEnv: Record<string, string | undefined> = {}

let tmp = ''
let runnerPath = ''
let fakeSdkPath = ''
let dummyCliPath = ''
let dummyRunnerPath = ''
let dummySdkPath = ''

/** 假 SDK 夹具:不依赖任何包,回显请求参数 + 脚本化 query 消息(含 usage 终态) */
const FAKE_SDK_SOURCE = `
export async function* query({ prompt, options }) {
  yield {
    type: 'system',
    subtype: 'init',
    got_prompt: prompt,
    got_model: options.model,
    got_cli: options.pathToQoderCLIExecutable,
    got_dir: process.env.QODERCN_CONFIG_DIR ?? '',
  }
  yield { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'He' }] } }
  yield { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'llo' }] } }
  yield { type: 'result', subtype: 'success', is_error: false, usage: { input_tokens: 7, output_tokens: 3 }, total_credits: 1.5, duration_ms: 42 }
}
`

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'qoder-bridge-test-'))
  runnerPath = fileURLToPath(new URL('../scripts/qoder-chat-runner.mjs', import.meta.url))
  fakeSdkPath = join(tmp, 'fake-sdk.mjs')
  writeFileSync(fakeSdkPath, FAKE_SDK_SOURCE)
  dummyCliPath = join(tmp, 'cli.exe')
  writeFileSync(dummyCliPath, '')
  dummyRunnerPath = join(tmp, 'runner.mjs')
  writeFileSync(dummyRunnerPath, '')
  dummySdkPath = join(tmp, 'sdk.mjs')
  writeFileSync(dummySdkPath, '')
})

afterAll(() => {
  if (tmp !== '') rmSync(tmp, { recursive: true, force: true })
})

beforeEach(() => {
  savedEnv = {}
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    const v = savedEnv[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  vi.resetModules()
})

/** 预检用 env:三路径全指向真实存在的夹具文件(与探测目录解耦,任何机器可跑) */
function setFixtureEnv(overrides: Record<string, string> = {}): void {
  process.env['QODER_BRIDGE_RUNNER'] = dummyRunnerPath
  process.env['QODER_SDK_PATH'] = dummySdkPath
  process.env['QODER_CLI_PATH'] = dummyCliPath
  process.env['QODER_CONFIG_DIR'] = join(tmp, 'cfg')
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

async function* linesGen(lines: string[]): AsyncGenerator<string> {
  for (const l of lines) yield l.endsWith('\n') ? l : `${l}\n`
}

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

// =============================================================================
// 假子进程
// =============================================================================

interface FakeChildCtl {
  child: BridgeChild
  written: string[]
  killMock: ReturnType<typeof vi.fn>
}

function makeFake(
  script: () => AsyncGenerator<string>,
  opts: { onKill?: () => void; exitCode?: number } = {},
): FakeChildCtl {
  const written: string[] = []
  const closeListeners: Array<(...args: unknown[]) => void> = []
  const killMock = vi.fn(() => {
    opts.onKill?.()
    return true
  })
  const ctl: FakeChildCtl = {
    child: {
      stdin: {
        write: (chunk: string) => {
          written.push(chunk)
          return true
        },
      },
      stdout: null,
      stderr: (async function* () {})(),
      kill: killMock,
      once: (event, listener) => {
        if (event === 'close') closeListeners.push(listener)
        return undefined
      },
    },
    written,
    killMock,
  }
  // stdout 流结束(含被 return/kill)即子进程 stdio 关闭 → 触发 close(退出码)
  const exitCode = opts.exitCode ?? 0
  ctl.child.stdout = (async function* () {
    try {
      yield* script()
    } finally {
      for (const l of closeListeners) l(exitCode)
    }
  })()
  return ctl
}

function recordingSpawn(factories: Array<() => BridgeChild>): {
  spawnImpl: BridgeSpawn
  calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }>
} {
  const calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> = []
  let i = 0
  const spawnImpl: BridgeSpawn = (command, args, options) => {
    calls.push({ command, args, options })
    const factory = factories[Math.min(i, factories.length - 1)]!
    i += 1
    return factory()
  }
  return { spawnImpl, calls }
}

function asst(text: string): string {
  return `${JSON.stringify({ type: 'assistant', text })}\n`
}

function resultOk(usage?: Record<string, number>): string {
  return `${JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    ...(usage ? { usage } : {}),
  })}\n`
}

function contentOf(chunk: Record<string, unknown>): unknown {
  const choices = chunk['choices']
  if (!Array.isArray(choices) || choices.length === 0) return undefined
  const delta = (choices[0] as { delta?: Record<string, unknown> }).delta
  return delta?.['content']
}

// =============================================================================
// 1. 翻译层(NDJSON → OpenAI chunk)
// =============================================================================

describe('translateRunnerMessage: runner 消息 → OpenAI chunk', () => {
  it('assistant 增量(message.content 文本块)→ delta chunk 全形状', () => {
    const state = createRunnerTranslateState('auto')
    const chunks = translateRunnerMessage(
      {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: '你好' }] },
      },
      state,
    )
    expect(chunks).toHaveLength(1)
    const c = chunks[0]!
    expect(c['object']).toBe('chat.completion.chunk')
    expect(typeof c['id']).toBe('string')
    expect(c['model']).toBe('auto')
    expect(typeof c['created']).toBe('number')
    expect(c['choices']).toEqual([{ index: 0, delta: { content: '你好' }, finish_reason: null }])
    expect(state.finished).toBe(false)
  })

  it('assistant 顶层 text / delta 字段也认', () => {
    const state = createRunnerTranslateState('m')
    expect(contentOf(translateRunnerMessage({ type: 'assistant', text: '顶' }, state)[0]!)).toBe(
      '顶',
    )
    expect(contentOf(translateRunnerMessage({ type: 'assistant', delta: '增' }, state)[0]!)).toBe(
      '增',
    )
    // 多文本块按序拼接
    const multi = translateRunnerMessage(
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'a' },
            { type: 'text', text: 'b' },
          ],
        },
      },
      state,
    )
    expect(contentOf(multi[0]!)).toBe('ab')
  })

  it('result success → usage chunk(choices:[]) + finish 帧,置 finished', () => {
    const state = createRunnerTranslateState('auto')
    const chunks = translateRunnerMessage(
      {
        type: 'result',
        subtype: 'success',
        is_error: false,
        usage: { input_tokens: 7, output_tokens: 3 },
        total_credits: 1.5,
        duration_ms: 42,
      },
      state,
    )
    expect(chunks).toHaveLength(2)
    expect(chunks[0]!['choices']).toEqual([])
    expect(chunks[0]!['usage']).toEqual({
      prompt_tokens: 7,
      completion_tokens: 3,
      total_tokens: 10,
    })
    expect(chunks[1]!['choices']).toEqual([{ index: 0, delta: {}, finish_reason: 'stop' }])
    expect(chunks[0]!['id']).toBe(chunks[1]!['id'])
    expect(state.finished).toBe(true)
  })

  it('result 无 usage → 只补 finish 帧', () => {
    const state = createRunnerTranslateState('auto')
    const chunks = translateRunnerMessage(
      { type: 'result', subtype: 'success', is_error: false },
      state,
    )
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!['choices']).toEqual([{ index: 0, delta: {}, finish_reason: 'stop' }])
    expect(state.finished).toBe(true)
  })

  it('error 行(登录类文案)→ 抛 QoderBridgeError statusCode 401', () => {
    const state = createRunnerTranslateState('auto')
    expect(() =>
      translateRunnerMessage({ type: 'error', message: '401 Unauthorized: login required' }, state),
    ).toThrow(QoderBridgeError)
    let caught: unknown
    try {
      translateRunnerMessage({ type: 'error', message: 'session expired, please log in' }, state)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(QoderBridgeError)
    expect((caught as QoderBridgeError).statusCode).toBe(401)
    expect((caught as QoderBridgeError).message).toContain('Qoder CLI 桥接错误')
    expect(state.finished).toBe(false)
  })

  it('result 失败终态(非登录类)→ 抛错 statusCode 0(按 network 冷却)', () => {
    const state = createRunnerTranslateState('auto')
    let caught: unknown
    try {
      translateRunnerMessage(
        {
          type: 'result',
          subtype: 'error_during_execution',
          is_error: true,
          result: 'cloud agent failed',
        },
        state,
      )
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(QoderBridgeError)
    expect((caught as QoderBridgeError).statusCode).toBe(0)
    expect((caught as QoderBridgeError).message).toContain('error_during_execution')
  })

  it('assistant isApiErrorMessage → 抛错', () => {
    const state = createRunnerTranslateState('auto')
    let caught: unknown
    try {
      translateRunnerMessage(
        {
          type: 'assistant',
          isApiErrorMessage: true,
          message: { content: [{ type: 'text', text: 'model not found' }] },
        },
        state,
      )
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(QoderBridgeError)
    expect((caught as QoderBridgeError).statusCode).toBe(0)
  })

  it('system/init、user 回显与未知类型 → 不产出 chunk', () => {
    const state = createRunnerTranslateState('auto')
    expect(translateRunnerMessage({ type: 'system', subtype: 'init' }, state)).toEqual([])
    expect(translateRunnerMessage({ type: 'user', message: { role: 'user' } }, state)).toEqual([])
    expect(translateRunnerMessage({ type: 'stream_event', event: {} }, state)).toEqual([])
    expect(translateRunnerMessage(null, state)).toEqual([])
    expect(state.finished).toBe(false)
  })
})

// =============================================================================
// 2. 假 spawn 集成(qoderCliChatChunks)
// =============================================================================

describe('qoderCliChatChunks: 假 spawn 全流程', () => {
  it('NDJSON → chunk 流;spawn 形状、stdin 请求行、收尾 kill', async () => {
    setFixtureEnv()
    const ctl = makeFake(() =>
      linesGen([
        JSON.stringify({ type: 'system', subtype: 'init' }),
        asst('你'),
        asst('好'),
        resultOk({ input_tokens: 2, output_tokens: 1 }),
      ]),
    )
    const { spawnImpl, calls } = recordingSpawn([() => ctl.child])
    const chunks: Array<Record<string, unknown>> = []
    for await (const c of qoderCliChatChunks({ prompt: '你好呀', model: 'auto', spawnImpl })) {
      chunks.push(c)
    }
    expect(chunks).toHaveLength(4)
    expect(contentOf(chunks[0]!)).toBe('你')
    expect(contentOf(chunks[1]!)).toBe('好')
    expect(chunks[2]!['usage']).toEqual({ prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 })
    expect(chunks[3]!['choices']).toEqual([{ index: 0, delta: {}, finish_reason: 'stop' }])
    // 同一次会话共用一个 chunk id
    expect(new Set(chunks.map((c) => c['id'])).size).toBe(1)

    // spawn 形状:node 跑 runner,stdio 三管道,Windows 隐藏窗口
    expect(calls).toHaveLength(1)
    expect(calls[0]!.command).toBe(process.execPath)
    expect(calls[0]!.args).toEqual([dummyRunnerPath])
    expect(calls[0]!.options['windowsHide']).toBe(true)
    expect(calls[0]!.options['stdio']).toEqual(['pipe', 'pipe', 'pipe'])

    // stdin 请求行:协议六键齐备
    expect(ctl.written).toHaveLength(1)
    const reqLine = JSON.parse(ctl.written[0]!) as Record<string, unknown>
    expect(reqLine['prompt']).toBe('你好呀')
    expect(reqLine['model']).toBe('auto')
    expect(reqLine['sdkPath']).toBe(dummySdkPath)
    expect(reqLine['cliPath']).toBe(dummyCliPath)
    expect(reqLine['configDir']).toBe(join(tmp, 'cfg'))
    expect(typeof reqLine['cwd']).toBe('string')

    // 收尾:无论正常与否都 kill
    expect(ctl.killMock).toHaveBeenCalled()
  })

  it('error 行 mid-stream → 抛错带 statusCode 401,并 kill 子进程', async () => {
    setFixtureEnv()
    const ctl = makeFake(() =>
      linesGen([asst('前'), JSON.stringify({ type: 'error', message: '401 Unauthorized' })]),
    )
    const { spawnImpl } = recordingSpawn([() => ctl.child])
    const it = qoderCliChatChunks({ prompt: 'p', spawnImpl })[Symbol.asyncIterator]()
    const first = await it.next()
    expect(first.done).toBe(false)
    expect(contentOf(first.value!)).toBe('前')
    let caught: unknown
    try {
      await it.next()
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(QoderBridgeError)
    expect((caught as QoderBridgeError).statusCode).toBe(401)
    expect(ctl.killMock).toHaveBeenCalled()
  })

  it('abort → 杀子进程,迭代干净结束(不抛错)', async () => {
    setFixtureEnv()
    const killGate = deferred()
    const ctl = makeFake(
      () =>
        (async function* () {
          yield asst('A')
          await killGate.promise // 挂起直到被 kill
        })(),
      { onKill: () => killGate.resolve() },
    )
    const { spawnImpl } = recordingSpawn([() => ctl.child])
    const ac = new AbortController()
    const it = qoderCliChatChunks({ prompt: 'p', spawnImpl, signal: ac.signal })[
      Symbol.asyncIterator
    ]()
    const first = await it.next()
    expect(contentOf(first.value!)).toBe('A')
    ac.abort()
    const end = await it.next()
    expect(end.done).toBe(true)
    expect(ctl.killMock).toHaveBeenCalled()
  })

  it('消费方提前 return/break → finally 仍 kill 子进程', async () => {
    setFixtureEnv()
    const killGate = deferred()
    const ctl = makeFake(
      () =>
        (async function* () {
          yield asst('X')
          yield asst('Y')
          await killGate.promise
        })(),
      { onKill: () => killGate.resolve() },
    )
    const { spawnImpl } = recordingSpawn([() => ctl.child])
    const it = qoderCliChatChunks({ prompt: 'p', spawnImpl })[Symbol.asyncIterator]()
    const first = await it.next()
    expect(contentOf(first.value!)).toBe('X')
    await it.return?.()
    expect(ctl.killMock).toHaveBeenCalled()
  })

  it('stdout 结束但无 result 终态 → 抛错 statusCode 0(如实报告,不冒充)', async () => {
    setFixtureEnv()
    const ctl = makeFake(() => linesGen([asst('半途')]), { exitCode: 3 })
    const { spawnImpl } = recordingSpawn([() => ctl.child])
    let caught: unknown
    try {
      for await (const _c of qoderCliChatChunks({ prompt: 'p', spawnImpl })) {
        /* 消费到抛错 */
      }
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(QoderBridgeError)
    expect((caught as QoderBridgeError).statusCode).toBe(0)
    expect((caught as QoderBridgeError).message).toContain('未产生 result 终态')
    expect(ctl.killMock).toHaveBeenCalled()
  })

  it('预检:SDK 路径缺失 → 起进程前抛 statusCode 0 明确错误', async () => {
    setFixtureEnv({ QODER_SDK_PATH: join(tmp, 'missing-sdk.mjs') })
    const { spawnImpl, calls } = recordingSpawn([])
    let caught: unknown
    try {
      for await (const _c of qoderCliChatChunks({ prompt: 'p', spawnImpl })) {
        /* 不应进入 */
      }
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(QoderBridgeError)
    expect((caught as QoderBridgeError).statusCode).toBe(0)
    expect((caught as QoderBridgeError).message).toContain('未配置或文件缺失')
    expect(calls).toHaveLength(0) // 没起任何进程
  })
})

// =============================================================================
// 3. 并发互斥(CLI 单登录态)
// =============================================================================

describe('qoderCliChatChunks: 并发互斥', () => {
  it('两会话并发串行:第二个等第一个完成才 spawn', async () => {
    setFixtureEnv()
    const aGate = deferred()
    const a = makeFake(() =>
      (async function* () {
        yield asst('A1')
        await aGate.promise
        yield resultOk()
      })(),
    )
    const b = makeFake(() => linesGen([asst('B1'), resultOk()]))
    const { spawnImpl, calls } = recordingSpawn([() => a.child, () => b.child])

    const itA = qoderCliChatChunks({ prompt: 'p1', spawnImpl })[Symbol.asyncIterator]()
    const itB = qoderCliChatChunks({ prompt: 'p2', spawnImpl })[Symbol.asyncIterator]()

    const firstA = await itA.next()
    expect(contentOf(firstA.value!)).toBe('A1')
    expect(calls).toHaveLength(1)

    const pendingB = itB.next()
    await tick()
    expect(calls).toHaveLength(1) // B 在等锁,尚未 spawn

    aGate.resolve()
    for (;;) {
      const n = await itA.next()
      if (n.done) break
    }
    const firstB = await pendingB
    expect(calls).toHaveLength(2)
    expect(contentOf(firstB.value!)).toBe('B1')
    for (;;) {
      const n = await itB.next()
      if (n.done) break
    }
    expect(a.killMock).toHaveBeenCalled()
    expect(b.killMock).toHaveBeenCalled()
  })

  it('等锁期间被 abort → 不 spawn 直接取消,不破坏后续队列', async () => {
    setFixtureEnv()
    const aGate = deferred()
    const a = makeFake(() =>
      (async function* () {
        yield asst('A1')
        await aGate.promise
        yield resultOk()
      })(),
    )
    const b = makeFake(() => linesGen([asst('B1'), resultOk()]))
    const { spawnImpl, calls } = recordingSpawn([() => a.child, () => b.child])

    const itA = qoderCliChatChunks({ prompt: 'p1', spawnImpl })[Symbol.asyncIterator]()
    await itA.next()
    expect(calls).toHaveLength(1)

    const ac = new AbortController()
    const itB = qoderCliChatChunks({ prompt: 'p2', spawnImpl, signal: ac.signal })[
      Symbol.asyncIterator
    ]()
    const pendingB = itB.next()
    await tick()
    ac.abort()
    const cancelledErr = await pendingB.then(
      () => null,
      (e: unknown) => e,
    )
    expect((cancelledErr as Error).name).toBe('AbortError') // 等锁被取消 → 如实抛 abort
    expect(calls).toHaveLength(1) // 没为 B spawn

    // 队列未被破坏:A 正常跑完
    aGate.resolve()
    for (;;) {
      const n = await itA.next()
      if (n.done) break
    }
    expect(a.killMock).toHaveBeenCalled()
  })
})

// =============================================================================
// 4. 门控与 qoder-adapter 接线
// =============================================================================

describe('门控与适配器接线', () => {
  it('preflight:路径齐备 → 通过;SDK 缺失 → statusCode 0 明确错误', () => {
    setFixtureEnv()
    expect(preflightQoderBridge().sdkPath).toBe(dummySdkPath)
    process.env['QODER_SDK_PATH'] = join(tmp, 'missing.mjs')
    let caught: unknown
    try {
      preflightQoderBridge()
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(QoderBridgeError)
    expect((caught as QoderBridgeError).statusCode).toBe(0)
    expect((caught as QoderBridgeError).message).toContain('未配置或文件缺失')
  })

  it('门控开关:QODER_BRIDGE_ENABLED=1 显式开 / =0 显式关', () => {
    setFixtureEnv()
    process.env['QODER_BRIDGE_ENABLED'] = '0'
    expect(isQoderBridgeEnabled()).toBe(false)
    process.env['QODER_BRIDGE_ENABLED'] = '1'
    expect(isQoderBridgeEnabled()).toBe(true)
    // =1 时即便路径残缺也视为"显式启用"(调用期预检兜底,不冒充成功)
    process.env['QODER_SDK_PATH'] = join(tmp, 'gone.mjs')
    expect(isQoderBridgeEnabled()).toBe(true)
  })

  it('接线(开):QODER_BRIDGE_ENABLED=1 → executeChat 存在,stream 请求返回惰性流', async () => {
    setFixtureEnv({ QODER_BRIDGE_ENABLED: '1' })
    vi.resetModules()
    const { qoderAdapter } = await import('../src/services/upstream-adapters/qoder-adapter.js')
    expect(typeof qoderAdapter.executeChat).toBe('function')
    const result = await qoderAdapter.executeChat!(
      {} as never,
      { model: 'auto', messages: [{ role: 'user', content: 'hi' }], stream: true },
      {},
    )
    expect(result.stream).toBeDefined()
    expect(result.completion).toBeUndefined()
  })

  it('接线(开):非流式本地聚合(真 runner + 假 SDK,不出网)', async () => {
    setFixtureEnv({
      QODER_BRIDGE_ENABLED: '1',
      QODER_BRIDGE_RUNNER: runnerPath,
      QODER_SDK_PATH: fakeSdkPath,
    })
    vi.resetModules()
    const { qoderAdapter } = await import('../src/services/upstream-adapters/qoder-adapter.js')
    const result = await qoderAdapter.executeChat!(
      {} as never,
      { model: 'auto', messages: [{ role: 'user', content: 'hi' }], stream: false },
      {},
    )
    expect(result.stream).toBeUndefined()
    expect(result.completion).toMatchObject({
      object: 'chat.completion',
      model: 'auto',
      choices: [
        { index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' },
      ],
      usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
    })
    expect(typeof (result.completion as Record<string, unknown>)['id']).toBe('string')
  }, 15000)

  it('接线(开但 SDK 缺失):executeChat 拒绝 statusCode 0,不冒充可用', async () => {
    setFixtureEnv({
      QODER_BRIDGE_ENABLED: '1',
      QODER_SDK_PATH: join(tmp, 'missing-sdk.mjs'),
    })
    vi.resetModules()
    const { qoderAdapter } = await import('../src/services/upstream-adapters/qoder-adapter.js')
    expect(typeof qoderAdapter.executeChat).toBe('function')
    const err = await qoderAdapter.executeChat!(
      {} as never,
      { model: 'auto', messages: [{ role: 'user', content: 'hi' }], stream: true },
      {},
    )
      .then(() => null)
      .catch((e: unknown) => e)
    expect(err).not.toBeNull()
    expect((err as { statusCode?: number }).statusCode).toBe(0)
    expect((err as Error).message).toContain('未配置或文件缺失')
  })

  it('接线(关):executeChat 缺省,三件套如实抛 QODER_CHAT_CONTRACT_UNVERIFIED', async () => {
    setFixtureEnv({ QODER_BRIDGE_ENABLED: '0' })
    vi.resetModules()
    const mod = await import('../src/services/upstream-adapters/qoder-adapter.js')
    expect(mod.qoderAdapter.executeChat).toBeUndefined()
    const ctx = {} as never
    const req = { model: 'auto', messages: [], stream: true } as never
    expect(() => mod.qoderAdapter.buildChatRequest(ctx, req)).toThrow(
      mod.QODER_CHAT_CONTRACT_UNVERIFIED,
    )
    expect(() => mod.qoderAdapter.translateStreamChunk(ctx, '', {})).toThrow(
      mod.QODER_CHAT_CONTRACT_UNVERIFIED,
    )
    expect(() => mod.qoderAdapter.translateNonStream(ctx, {})).toThrow(
      mod.QODER_CHAT_CONTRACT_UNVERIFIED,
    )
  })
})

// =============================================================================
// 5. runner 协议(注入假 SDK,真跑 runner 子进程)
// =============================================================================

function runRunner(
  req: Record<string, unknown>,
): Promise<{ code: number | null; lines: Array<Record<string, unknown>> }> {
  return new Promise((resolve, reject) => {
    const child = realSpawn(process.execPath, [runnerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let out = ''
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (d: string) => {
      out += d
    })
    child.on('error', reject)
    child.on('close', (code) => {
      const lines = out
        .split(/\r?\n/)
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as Record<string, unknown>)
      resolve({ code, lines })
    })
    child.stdin?.end(`${JSON.stringify(req)}\n`)
  })
}

describe('qoder-chat-runner.mjs 协议(真跑子进程,假 SDK)', () => {
  it('stdin 一行 JSON → SDK 消息逐行回传,configDir 注入 env,result 后 exit 0', async () => {
    const configDir = join(tmp, 'cfg-run')
    const { code, lines } = await runRunner({
      prompt: 'hi',
      cwd: tmp,
      model: 'auto',
      configDir,
      sdkPath: fakeSdkPath,
      cliPath: dummyCliPath,
    })
    expect(code).toBe(0)
    expect(lines).toHaveLength(4)
    // 请求参数如实透传给 SDK query()
    expect(lines[0]).toMatchObject({
      type: 'system',
      subtype: 'init',
      got_prompt: 'hi',
      got_model: 'auto',
      got_cli: dummyCliPath,
      got_dir: configDir,
    })
    expect(lines[1]).toEqual({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'He' }] },
    })
    expect(lines[2]).toEqual({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'llo' }] },
    })
    expect(lines[3]).toMatchObject({
      type: 'result',
      subtype: 'success',
      total_credits: 1.5,
      duration_ms: 42,
      usage: { input_tokens: 7, output_tokens: 3 },
    })
  }, 15000)

  it('SDK 缺失 → stdout 一行 error(SDK not found)且 exit 1', async () => {
    const missing = join(tmp, 'definitely-missing-sdk.mjs')
    const { code, lines } = await runRunner({
      prompt: 'hi',
      cwd: tmp,
      model: 'auto',
      configDir: tmp,
      sdkPath: missing,
      cliPath: dummyCliPath,
    })
    expect(code).toBe(1)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toEqual({ type: 'error', message: `SDK not found: ${missing}` })
  }, 15000)

  it('桥接全链路(缺省真 spawn + 假 SDK):chunk 序列与 result 终态对齐', async () => {
    setFixtureEnv({ QODER_BRIDGE_RUNNER: runnerPath, QODER_SDK_PATH: fakeSdkPath })
    const chunks: Array<Record<string, unknown>> = []
    for await (const c of qoderCliChatChunks({ prompt: 'hi', model: 'auto' })) {
      chunks.push(c)
    }
    expect(chunks).toHaveLength(4)
    expect(chunks[0]).toMatchObject({
      object: 'chat.completion.chunk',
      model: 'auto',
      choices: [{ index: 0, delta: { content: 'He' }, finish_reason: null }],
    })
    expect(contentOf(chunks[1]!)).toBe('llo')
    expect(chunks[2]).toMatchObject({
      choices: [],
      usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
    })
    expect(chunks[3]).toMatchObject({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
    expect(new Set(chunks.map((c) => c['id'])).size).toBe(1)
  }, 15000)
})

// =============================================================================
// 6. prompt 渲染
// =============================================================================

describe('renderQoderPrompt', () => {
  it('多消息按 [role] 分段;多模态文本块取 text;空文本消息跳过', () => {
    const prompt = renderQoderPrompt({
      model: 'auto',
      stream: true,
      messages: [
        { role: 'system', content: '你是助手' },
        {
          role: 'user',
          content: [
            { type: 'text', text: '问题A' },
            { type: 'image_url', image_url: {} },
          ],
        },
        { role: 'assistant', content: '答A' },
        { role: 'user', content: '' },
      ],
    })
    expect(prompt).toContain('[system]\n你是助手')
    expect(prompt).toContain('[user]\n问题A')
    expect(prompt).toContain('[assistant]\n答A')
    expect(prompt.split('[user]')).toHaveLength(2) // 空文本消息被跳过
  })

  it('全部消息为空 → statusCode 400(请求级错误,不罚号)', () => {
    let caught: unknown
    try {
      renderQoderPrompt({ model: 'auto', stream: true, messages: [{ role: 'user', content: '' }] })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(QoderBridgeError)
    expect((caught as QoderBridgeError).statusCode).toBe(400)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
