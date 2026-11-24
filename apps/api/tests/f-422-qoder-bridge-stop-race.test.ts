// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-422 回归锁(2026-11-13)。
 *
 * 病灶:Qoder 桥 stop 只 kill 当前 child,`stopped` 仅在 ensure 入口检查一次;
 * 在途启动(Promise 已发出)、重试退避或 READY 迟到时,进程会被重新拉起/继续存活,
 * 导致 API 关停后残留 Electron 与端口占用。
 *
 * 本文件锁:
 *   ① stop 后 ensure 被拒:返回 null 且不 spawn;
 *   ② 在途启动与 stop 交错:进程被 kill,迟到的 READY 不能复活端点;
 *      退避重试期间 stop:不再发起第二次 spawn;
 *   ③ stop 幂等:重复调用不抛错、不重复 kill;
 *   ④ 正常 start/stop 流程不变(端点形状、复用、关停后端点作废)。
 *
 * 只 mock node:child_process 的 spawn,不起真实 Electron,不触达网络。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ChildProcess } from 'node:child_process'
import type * as BridgeClient from '../src/services/qoder-bridge-client.js'

const spawnMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({ spawn: spawnMock }))

const ENV_KEYS = [
  'QODER_APP_DIR',
  'QODER_BRIDGE_SCRIPT',
  'QODER_BRIDGE_CWD',
  'QODER_BRIDGE_START_ATTEMPTS',
  'QODER_BRIDGE_READY_TIMEOUT_MS',
] as const

let savedEnv: Record<string, string | undefined> = {}
let tmp = ''

type BridgeModule = typeof BridgeClient
let mod: BridgeModule

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

interface FakeProcCtl {
  proc: ChildProcess
  killMock: ReturnType<typeof vi.fn>
  stdout: EventEmitter
}

/** 假子进程:默认 kill 时同步发 exit;exitOnKill=false 用于模拟"已被 kill 但 READY 仍到达" */
function makeProc(opts: { exitOnKill?: boolean } = {}): FakeProcCtl {
  const exitOnKill = opts.exitOnKill ?? true
  const emitter = new EventEmitter()
  const stdout = new EventEmitter()
  const stderr = new EventEmitter()
  const killMock = vi.fn(() => {
    if (exitOnKill) emitter.emit('exit', 0, 'SIGTERM')
    return true
  })
  Object.assign(emitter, { stdout, stderr, pid: 4321, kill: killMock })
  return { proc: emitter as unknown as ChildProcess, killMock, stdout }
}

function readyLine(port: number, pid = 4321): Buffer {
  return Buffer.from(`QODER_BRIDGE_READY ${JSON.stringify({ port, pid })}\n`)
}

/** 每个用例重新加载模块,拿到干净的单例状态 */
async function load(): Promise<BridgeModule> {
  vi.resetModules()
  return import('../src/services/qoder-bridge-client.js')
}

beforeEach(() => {
  savedEnv = {}
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k]

  tmp = mkdtempSync(join(tmpdir(), 'f422-qoder-bridge-'))
  const appRoot = join(tmp, 'Qoder CN')
  const bridgeScript = join(tmp, 'qoder-chat-bridge.mjs')
  // resolveQoderAppRoot / launchOnce 的落地检查:必须是真实存在的文件
  mkdirSync(appRoot, { recursive: true })
  writeFileSync(join(appRoot, 'Qoder CN.exe'), '')
  writeFileSync(bridgeScript, '')

  process.env['QODER_APP_DIR'] = appRoot
  process.env['QODER_BRIDGE_SCRIPT'] = bridgeScript
  process.env['QODER_BRIDGE_CWD'] = join(tmp, 'cwd')
  delete process.env['QODER_BRIDGE_START_ATTEMPTS']
  delete process.env['QODER_BRIDGE_READY_TIMEOUT_MS']
  spawnMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  for (const k of ENV_KEYS) {
    const v = savedEnv[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  if (tmp !== '') rmSync(tmp, { recursive: true, force: true })
})

describe('F-422 Qoder 桥 stop/start 竞态', () => {
  it('① stop 后 ensure 被拒:返回 null 且不 spawn', async () => {
    mod = await load()
    mod.stopQoderBridge()
    expect(await mod.ensureQoderBridge()).toBeNull()
    expect(spawnMock).not.toHaveBeenCalled()
    expect(mod.getQoderBridgeEndpoint()).toBeNull()
  })

  it('② 在途启动期间 stop:进程被 kill,迟到 READY 不复活端点', async () => {
    mod = await load()
    const { proc, killMock, stdout } = makeProc({ exitOnKill: false })
    spawnMock.mockReturnValueOnce(proc)

    const pending = mod.ensureQoderBridge()
    await tick()
    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(killMock).not.toHaveBeenCalled()

    mod.stopQoderBridge()
    expect(killMock).toHaveBeenCalled()

    // stop 之后才到的 READY:不得把端点写回去(旧实现会在此复活)
    stdout.emit('data', readyLine(41000))
    expect(await pending).toBeNull()
    expect(mod.getQoderBridgeEndpoint()).toBeNull()
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })

  it('② 退避重试期间 stop:不再发起第二次 spawn', async () => {
    vi.useFakeTimers()
    process.env['QODER_BRIDGE_START_ATTEMPTS'] = '3'
    mod = await load()
    const { proc } = makeProc()
    spawnMock.mockReturnValueOnce(proc)

    const pending = mod.ensureQoderBridge()
    await vi.advanceTimersByTimeAsync(0)
    expect(spawnMock).toHaveBeenCalledTimes(1)

    proc.emit('exit', 1, null) // 首次启动失败 → 进入退避
    await vi.advanceTimersByTimeAsync(0)
    mod.stopQoderBridge()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(await pending).toBeNull()
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })

  it('③ stop 幂等:重复调用不抛错、不重复 kill', async () => {
    mod = await load()
    const { proc, killMock, stdout } = makeProc()
    spawnMock.mockReturnValueOnce(proc)

    const pending = mod.ensureQoderBridge()
    await tick()
    stdout.emit('data', readyLine(42000))
    expect(await pending).not.toBeNull()

    expect(() => mod.stopQoderBridge()).not.toThrow()
    const killed = killMock.mock.calls.length
    expect(killed).toBe(1)
    expect(() => mod.stopQoderBridge()).not.toThrow()
    expect(killMock.mock.calls.length).toBe(killed)
    expect(mod.getQoderBridgeEndpoint()).toBeNull()
  })

  it('④ 正常 start/stop:端点形状不变、复用、关停后作废', async () => {
    mod = await load()
    const { proc, killMock, stdout } = makeProc()
    spawnMock.mockReturnValueOnce(proc)

    const pending = mod.ensureQoderBridge()
    await tick()
    stdout.emit('data', readyLine(41234))

    const ep = await pending
    expect(ep).not.toBeNull()
    expect(ep).toMatchObject({ baseUrl: 'http://127.0.0.1:41234', pid: 4321 })
    expect(typeof ep!.key).toBe('string')
    expect(mod.getQoderBridgeEndpoint()).toEqual(ep)

    // spawn 形状:Electron-as-Node 加载桥脚本
    const args = spawnMock.mock.calls[0]![1] as string[]
    expect(args[1]).toBe('--port')
    expect(args[2]).toBe('0')

    // 幂等:已就绪复用,不再 spawn
    expect(await mod.ensureQoderBridge()).toEqual(ep)
    expect(spawnMock).toHaveBeenCalledTimes(1)

    mod.stopQoderBridge()
    expect(killMock).toHaveBeenCalled()
    expect(mod.getQoderBridgeEndpoint()).toBeNull()
    // 关停后再次 ensure:拒绝启动
    expect(await mod.ensureQoderBridge()).toBeNull()
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })
})
