// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-01 反向守护拓扑镜像测试 —— 准入 / 握手状态机 / 交接判据 / worker 追踪 / 薄 runner。
 *
 * 用例对应票面验收：
 *  ① 准入：会话类型取不到 / 类型不符 / 命令形态不符 ⇒ 具名原因拒绝；合规放行
 *  ② 握手配对：started 同 id ⇒ started；异 id 忽略不成交
 *  ③ 超时：假时钟推过 deadline ⇒ timed-out；未到点不超时
 *  ④ 断开：pending 中通道断开 ⇒ disconnected 显式失败；终态后消息不改判
 *  ⑤ start-failed 同 id ⇒ failed 带原因；异 id 忽略
 *  ⑥ 交接：无 worker + 父断开 ⇒ exit；有 worker / 仍连 ⇒ stay；观测缺失 ⇒ unjudged
 *  ⑦ WorkerTracker 增删计数；非法 pid 不入
 *  ⑧ runner：detached / windowsHide / ipc stdio / unref 接线；形态不成立 ⇒ null 不冒充
 *  ⑨ 形状锁：纯判据函数体内零 spawn / kill / fs / process.exit
 */

import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SpawnOptions } from 'node:child_process'
import {
  DAEMON_SESSION_KIND,
  DEFAULT_HANDSHAKE_TIMEOUT_MS,
  SERVE_FLAG,
  WorkerTracker,
  admitWorkerCommand,
  createDaemonSupervisorHandshake,
  decideSupervisorSelfExit,
  sessionKindFromEnv,
  spawnDetachedSupervisor,
  DaemonSupervisorHandshake,
  type SupervisorChannel,
  type SupervisorInboundMessage,
  type SupervisorOutboundMessage,
  type SupervisorSpawnFn,
} from '../src/daemon/supervisor.js'

const COMPLIED_ARGV = ['ihui', SERVE_FLAG]

function fakeChannel(): {
  channel: SupervisorChannel
  sent: SupervisorOutboundMessage[]
  emitMessage: (msg: SupervisorInboundMessage) => void
  emitDisconnect: () => void
} {
  const sent: SupervisorOutboundMessage[] = []
  let messageHandler: ((msg: SupervisorInboundMessage) => void) | null = null
  let disconnectHandler: (() => void) | null = null
  const channel: SupervisorChannel = {
    send: (msg) => sent.push(msg),
    onMessage: (handler) => {
      messageHandler = handler
    },
    onDisconnect: (handler) => {
      disconnectHandler = handler
    },
  }
  return {
    channel,
    sent,
    emitMessage: (msg) => messageHandler?.(msg),
    emitDisconnect: () => disconnectHandler?.(),
  }
}

function fakeClock(start = 1_000): { nowMs: () => number; advance: (ms: number) => void } {
  let now = start
  return {
    nowMs: () => now,
    advance: (ms: number) => {
      now += ms
    },
  }
}

function makeHandshake(overrides: { timeoutMs?: number; channel?: SupervisorChannel } = {}) {
  const channel = overrides.channel ?? fakeChannel().channel
  const clock = fakeClock()
  const handshake = new DaemonSupervisorHandshake({
    channel,
    nowMs: clock.nowMs,
    timeoutMs: overrides.timeoutMs ?? 1_000,
  })
  return { handshake, clock, channel }
}

describe('admitWorkerCommand（准入）', () => {
  it('会话类型取不到 ⇒ refused session-kind-unmeasured', () => {
    expect(admitWorkerCommand({ argv: COMPLIED_ARGV, sessionKind: null })).toEqual({
      admitted: false,
      reason: 'session-kind-unmeasured',
    })
  })

  it('会话类型非 daemon ⇒ refused session-kind-mismatch', () => {
    expect(admitWorkerCommand({ argv: COMPLIED_ARGV, sessionKind: 'tui' })).toEqual({
      admitted: false,
      reason: 'session-kind-mismatch',
    })
  })

  it('命令形态缺 --serve ⇒ refused command-form-invalid', () => {
    expect(admitWorkerCommand({ argv: ['ihui', 'repl'], sessionKind: DAEMON_SESSION_KIND })).toEqual({
      admitted: false,
      reason: 'command-form-invalid',
    })
  })

  it('daemon + --serve ⇒ admitted', () => {
    expect(admitWorkerCommand({ argv: COMPLIED_ARGV, sessionKind: DAEMON_SESSION_KIND })).toEqual({
      admitted: true,
    })
  })

  it('sessionKindFromEnv：缺失 / 空串 ⇒ null；有值 trim 后返回', () => {
    expect(sessionKindFromEnv({})).toBeNull()
    expect(sessionKindFromEnv({ IHUI_SESSION_KIND: '   ' })).toBeNull()
    expect(sessionKindFromEnv({ IHUI_SESSION_KIND: '  daemon  ' })).toBe('daemon')
  })
})

describe('DaemonSupervisorHandshake（请求-应答配对）', () => {
  it('② 配对成功：started 同 id ⇒ started，通道发出 start 请求', () => {
    const c = fakeChannel()
    const { handshake } = makeHandshake({ channel: c.channel })
    const state = handshake.requestStart({ id: 'req-1', argv: COMPLIED_ARGV, sessionKind: 'daemon' })
    expect(state.status).toBe('pending')
    expect(c.sent).toEqual([
      { type: 'start', id: 'req-1', argv: COMPLIED_ARGV, sessionKind: 'daemon' },
    ])

    c.emitMessage({ type: 'started', id: 'req-1' })
    expect(handshake.snapshot().status).toBe('started')
  })

  it('② id 不配对：异 id 的 started 忽略，仍 pending', () => {
    const c = fakeChannel()
    const { handshake } = makeHandshake({ channel: c.channel })
    handshake.requestStart({ id: 'req-1', argv: COMPLIED_ARGV, sessionKind: 'daemon' })
    c.emitMessage({ type: 'started', id: 'req-other' })
    expect(handshake.snapshot().status).toBe('pending')
  })

  it('③ 超时：假时钟推过 deadline ⇒ timed-out；未到点不超时', () => {
    const { handshake, clock } = makeHandshake({ timeoutMs: 1_000 })
    handshake.requestStart({ id: 'req-1', argv: COMPLIED_ARGV, sessionKind: 'daemon' })
    clock.advance(999)
    expect(handshake.tick().status).toBe('pending')
    clock.advance(1)
    expect(handshake.tick()).toEqual({
      status: 'timed-out',
      requestId: 'req-1',
      reason: 'handshake-timeout',
      startedAtMs: 1_000,
    })
  })

  it('④ 断开：pending 中通道断开 ⇒ disconnected 显式失败', () => {
    const c = fakeChannel()
    const { handshake } = makeHandshake({ channel: c.channel })
    handshake.requestStart({ id: 'req-1', argv: COMPLIED_ARGV, sessionKind: 'daemon' })
    c.emitDisconnect()
    expect(handshake.snapshot()).toEqual({
      status: 'disconnected',
      requestId: 'req-1',
      reason: 'channel-disconnected',
      startedAtMs: 1_000,
    })
  })

  it('④ 终态后再收到 started 不改判', () => {
    const c = fakeChannel()
    const { handshake } = makeHandshake({ channel: c.channel })
    handshake.requestStart({ id: 'req-1', argv: COMPLIED_ARGV, sessionKind: 'daemon' })
    c.emitDisconnect()
    c.emitMessage({ type: 'started', id: 'req-1' })
    expect(handshake.snapshot().status).toBe('disconnected')
  })

  it('⑤ start-failed 同 id ⇒ failed 带原因；异 id 忽略', () => {
    const c = fakeChannel()
    const { handshake } = makeHandshake({ channel: c.channel })
    handshake.requestStart({ id: 'req-1', argv: COMPLIED_ARGV, sessionKind: 'daemon' })
    c.emitMessage({ type: 'start-failed', id: 'req-other', reason: 'boom' })
    expect(handshake.snapshot().status).toBe('pending')
    c.emitMessage({ type: 'start-failed', id: 'req-1', reason: 'spawn-enoent' })
    expect(handshake.snapshot()).toEqual({
      status: 'failed',
      requestId: 'req-1',
      reason: 'spawn-enoent',
      startedAtMs: 1_000,
    })
  })

  it('① 准入拒绝 ⇒ refused，通道零 send', () => {
    const c = fakeChannel()
    const { handshake } = makeHandshake({ channel: c.channel })
    const state = handshake.requestStart({ id: 'req-1', argv: COMPLIED_ARGV, sessionKind: 'web' })
    expect(state).toEqual({
      status: 'refused',
      requestId: 'req-1',
      reason: 'session-kind-mismatch',
      startedAtMs: null,
    })
    expect(c.sent).toEqual([])
  })

  it('createDaemonSupervisorHandshake 默认装配：idle 起步，超时取默认常量', () => {
    const c = fakeChannel()
    const handshake = createDaemonSupervisorHandshake(c.channel)
    expect(handshake.snapshot().status).toBe('idle')
    expect(DEFAULT_HANDSHAKE_TIMEOUT_MS).toBe(60_000)
  })
})

describe('decideSupervisorSelfExit（交接自退）', () => {
  it('⑥ 无存活 worker + 父通道断开 ⇒ exit', () => {
    expect(decideSupervisorSelfExit({ workerCount: 0, parentDisconnected: true })).toBe('exit')
  })

  it('⑥ 名下仍有 worker ⇒ stay；无 worker 但父通道仍连 ⇒ stay', () => {
    expect(decideSupervisorSelfExit({ workerCount: 1, parentDisconnected: true })).toBe('stay')
    expect(decideSupervisorSelfExit({ workerCount: 0, parentDisconnected: false })).toBe('stay')
  })

  it('⑥ 任一维观测取不到 ⇒ unjudged（不冒自退也不冒常驻）', () => {
    expect(decideSupervisorSelfExit({ workerCount: null, parentDisconnected: true })).toBe('unjudged')
    expect(decideSupervisorSelfExit({ workerCount: 0, parentDisconnected: null })).toBe('unjudged')
  })
})

describe('WorkerTracker（名下 worker 集合）', () => {
  it('⑦ add / remove / count；非法 pid 不入集合', () => {
    const tracker = new WorkerTracker()
    tracker.add(101)
    tracker.add(102)
    expect(tracker.count()).toBe(2)
    tracker.add(-3)
    tracker.add(0)
    expect(tracker.count()).toBe(2)
    tracker.remove(101)
    expect(tracker.count()).toBe(1)
    tracker.remove(999)
    expect(tracker.count()).toBe(1)
  })
})

describe('spawnDetachedSupervisor（薄 runner）', () => {
  function fakeSpawn() {
    const calls: Array<{ command: string; args: string[]; options: SpawnOptions }> = []
    const unref = vi.fn()
    const fn = vi.fn((command: string, args: string[], options: SpawnOptions) => {
      calls.push({ command, args, options })
      return { pid: 4321, unref, on: vi.fn() }
    }) as unknown as SupervisorSpawnFn
    return { fn, calls, unref }
  }

  it('⑧ detached + 隐藏窗口 + ipc stdio + unref 接线，返回 pid', () => {
    const { fn, calls, unref } = fakeSpawn()
    const entryPath = path.resolve(process.cwd(), 'fixture.js')
    const result = spawnDetachedSupervisor({
      spawn: fn,
      execPath: process.execPath,
      entryPath,
      runnerArgs: [SERVE_FLAG],
    })
    expect(result).toEqual({ pid: 4321 })
    expect(fn).toHaveBeenCalledTimes(1)
    const first = calls[0]
    expect(first).toBeDefined()
    const options = first!.options
    expect(options.detached).toBe(true)
    expect(options.windowsHide).toBe(true)
    expect(options.stdio).toEqual(['ignore', 'ignore', 'ignore', 'ipc'])
    expect(unref).toHaveBeenCalledTimes(1)
  })

  it('⑧ 形态判据不成立（execPath 非 node）⇒ null，spawn 零调用', () => {
    const { fn } = fakeSpawn()
    const result = spawnDetachedSupervisor({
      spawn: fn,
      execPath: 'C:\\tools\\code.exe',
      entryPath: path.resolve(process.cwd(), 'fixture.js'),
    })
    expect(result).toBeNull()
    expect(fn).not.toHaveBeenCalled()
  })

  it('⑧ spawn 同步抛错 ⇒ null，不冒充已拉起', () => {
    const fn = vi.fn(() => {
      throw new Error('ENOENT')
    }) as unknown as SupervisorSpawnFn
    const result = spawnDetachedSupervisor({
      spawn: fn,
      execPath: process.execPath,
      entryPath: path.resolve(process.cwd(), 'fixture.js'),
    })
    expect(result).toBeNull()
  })
})

describe('形状锁（纯判据零副作用）', () => {
  it('⑨ admitWorkerCommand / decideSupervisorSelfExit 体内不得出现 spawn/kill/fs/进程退出调用', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/daemon/supervisor.ts', import.meta.url)), 'utf8')
    for (const fnName of ['admitWorkerCommand', 'decideSupervisorSelfExit']) {
      const start = src.indexOf(`export function ${fnName}`)
      expect(start).toBeGreaterThanOrEqual(0)
      const bodyEnd = src.indexOf('\n}', start)
      const body = src.slice(start, bodyEnd)
      const forbidden: Array<[string, RegExp]> = [
        ['spawn(', /\bspawn\s*\(/],
        ['kill(', /\bkill\s*\(/],
        ['process.kill', /process\.kill/],
        ['process.exit', /process\.exit/],
        ['readFileSync', /readFileSync/],
        ['writeFileSync', /writeFileSync/],
      ]
      for (const [name, re] of forbidden) {
        expect(re.test(body), `${fnName} 体内出现禁止调用:${name}`).toBe(false)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
