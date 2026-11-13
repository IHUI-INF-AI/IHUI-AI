// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-198 回归锁(2026-11-13)。
 *
 * 病灶:转码队列超过 MAX_JOBS 时,FIFO 淘汰只 jobs.delete + childProcesses.delete + rm(outputDir),
 * 不 kill 子进程 ⇒ 孤儿 ffmpeg 持续占用 CPU/磁盘,且 rm 与进程写盘并发导致目录残留。
 *
 * 本文件锁三条路径的子进程回收顺序(先 kill 并等待退出,再删 Map 与输出目录):
 *   ① 队列超限 FIFO 淘汰最旧活跃任务:kill → close → rm;
 *   ② 取消/等待退出超时:仍先 kill,上限内未确认退出绝不 rm,close 落地后再清理;
 *   ③ 正常完成任务:不 kill、不误删输出目录,状态与产物大小照常。
 *
 * 只 mock child_process / fs 与观测桥接,用伪子进程替身,不真跑 ffmpeg。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type * as TranscodeService from '../src/services/transcode-service.js'

const h = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  mkdirMock: vi.fn(),
  rmMock: vi.fn(),
  statMock: vi.fn(),
  order: [] as string[],
}))

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => h.spawnMock(...args),
  default: { spawn: (...args: unknown[]) => h.spawnMock(...args) },
}))

vi.mock('node:fs', () => ({
  existsSync: () => true,
  default: { existsSync: () => true },
}))

vi.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => h.mkdirMock(...args),
  rm: (...args: unknown[]) => h.rmMock(...args),
  stat: (...args: unknown[]) => h.statMock(...args),
  default: {
    mkdir: (...args: unknown[]) => h.mkdirMock(...args),
    rm: (...args: unknown[]) => h.rmMock(...args),
    stat: (...args: unknown[]) => h.statMock(...args),
  },
}))

// 观测桥接与本票无关,却会把 db/config 整条依赖图带进测试;mock 掉保持用例纯净且加载快
vi.mock('../src/plugins/business-metrics.js', () => ({
  recordHlsTranscodeSample: vi.fn(),
}))

type FakeChildOptions = {
  /** kill 后是否模拟进程真正退出(异步 emit close) */
  autoCloseOnKill?: boolean
  closeDelayMs?: number
}

/** 伪 ffmpeg 子进程:记录 kill 调用,可控地 emit close,模拟 Windows 上 SIGKILL 异步落地。 */
class FakeChild extends EventEmitter {
  exitCode: number | null = null
  signalCode: string | null = null
  stderr = new EventEmitter()
  killCalls: string[] = []

  constructor(private readonly options: FakeChildOptions = {}) {
    super()
  }

  kill(signal?: string): boolean {
    const sig = signal ?? 'SIGTERM'
    this.killCalls.push(sig)
    h.order.push(`kill:${sig}`)
    if (this.options.autoCloseOnKill) {
      setTimeout(() => this.finish(null, 'SIGKILL'), this.options.closeDelayMs ?? 10)
    }
    return true
  }

  finish(code: number | null, signal: string | null = null): void {
    if (this.exitCode !== null || this.signalCode !== null) return
    this.exitCode = code
    this.signalCode = signal
    h.order.push(code === 0 ? 'close:0' : 'close')
    this.emit('close', code, signal)
  }
}

const INPUT = { inputPath: '/tmp/f-198-input.mp4', preset: 'video/mp4' as const }

// 与源文件 MAX_JOBS 对齐:创建 1 个活跃任务 + (MAX_JOBS - 1) 个 pending 填满队列
const MAX_JOBS = 1000

let svc: typeof TranscodeService

describe('F-198 转码淘汰/取消/超时都必须先杀子进程再删目录', () => {
  beforeEach(async () => {
    vi.resetModules()
    h.order.length = 0
    h.spawnMock.mockReset()
    h.mkdirMock.mockReset()
    h.mkdirMock.mockResolvedValue(undefined)
    h.rmMock.mockReset()
    h.rmMock.mockImplementation(async () => {
      h.order.push('rm')
    })
    h.statMock.mockReset()
    h.statMock.mockResolvedValue({ size: 2048 })
    svc = await import('../src/services/transcode-service.js')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('① FIFO 淘汰最旧活跃任务:kill 并等 close 落地后才 rm 输出目录', async () => {
    const child = new FakeChild({ autoCloseOnKill: true, closeDelayMs: 20 })
    h.spawnMock.mockReturnValue(child)

    const oldest = await svc.createTranscodeJob(INPUT)
    const oldestRun = svc.startTranscodeJob(oldest.id)
    expect(h.spawnMock).toHaveBeenCalledTimes(1)
    expect(svc.getTranscodeJob(oldest.id)?.status).toBe('processing')

    // 填满队列:其余均为 pending(仍属活跃),触发全活跃分支的 FIFO 淘汰
    for (let i = 0; i < MAX_JOBS - 1; i++) {
      await svc.createTranscodeJob(INPUT)
    }

    const trigger = svc.createTranscodeJob(INPUT)
    // kill 已投递,但 close 尚未落地 ⇒ 不得 rm
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(h.order).toContain('kill:SIGKILL')
    expect(h.rmMock).not.toHaveBeenCalled()

    await trigger
    expect(h.order).toEqual(['kill:SIGKILL', 'close', 'rm'])
    expect(svc.getTranscodeJob(oldest.id)).toBeUndefined()
    expect(child.killCalls).toEqual(['SIGKILL'])

    await oldestRun
  })

  it('② 等待退出超时:仍先 kill,未确认退出绝不 rm,close 落地后再清理', async () => {
    vi.useFakeTimers()
    const child = new FakeChild({ autoCloseOnKill: false })
    h.spawnMock.mockReturnValue(child)

    const job = await svc.createTranscodeJob(INPUT)
    const run = svc.startTranscodeJob(job.id)
    expect(h.spawnMock).toHaveBeenCalledTimes(1)

    const cancelled = svc.cancelTranscodeJob(job.id)
    // 先 kill;等待上限内既不返回也不删目录
    expect(h.order).toEqual(['kill:SIGKILL'])
    expect(h.rmMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5000)
    await cancelled
    // 上限已到仍存活 ⇒ 追加一次 kill 作为最后努力,但绝不 rm
    expect(child.killCalls).toEqual(['SIGKILL', 'SIGKILL'])
    expect(h.rmMock).not.toHaveBeenCalled()

    child.finish(null, 'SIGKILL')
    await vi.advanceTimersByTimeAsync(0)
    expect(h.rmMock).toHaveBeenCalledTimes(1)
    expect(h.order).toEqual(['kill:SIGKILL', 'kill:SIGKILL', 'close', 'rm'])

    await run
  })

  it('③ 正常完成任务:不 kill、不误删输出目录', async () => {
    const child = new FakeChild({ autoCloseOnKill: false })
    h.spawnMock.mockReturnValue(child)

    const job = await svc.createTranscodeJob(INPUT)
    const run = svc.startTranscodeJob(job.id)
    expect(h.spawnMock).toHaveBeenCalledTimes(1)

    child.finish(0)
    const done = await run

    expect(done.status).toBe('completed')
    expect(done.progress).toBe(100)
    expect(done.outputSize).toBe(2048)
    expect(child.killCalls).toEqual([])
    expect(h.order).toEqual(['close:0'])
    expect(h.rmMock).not.toHaveBeenCalled()
  })
})
