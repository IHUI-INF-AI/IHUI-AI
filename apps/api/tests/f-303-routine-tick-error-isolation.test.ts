// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-303 回归锁(2026-11-13)。
 *
 * 病灶:`RoutineManager.tick()` 由 `setInterval` 每 60s 调用,回调里没有任何 try/catch;
 * 一条到期的 routine 触发后 `persist()` 写盘失败(磁盘满 / Windows EBUSY / 只读挂载 /
 * `blockedWrite` 损坏保护),异常直接逸出定时器回调 ⇒ `uncaughtException` ⇒ 进程退出。
 * 单次瞬时写盘失败即可打死 API,配合 F-302(多进程各起一份调度器)命中概率翻倍。
 *
 * 本文件锁:
 *   ① persist 抛错时 tick 不抛出;两条 routine 都执行完(start 调两次),互不中断;
 *   ② 每条失败各留一条 logger.error,带 routineId 与错误摘要;磁盘上仍是完整旧 JSON,无 .tmp 残骸;
 *   ③ tick 整体兜底:ensureLoaded 这类循环外异常同样不逸出,只降级为 error 日志;
 *   ④ 落盘是「临时文件 + rename」原子写:成功路径能观察到 renameSync(tmp → routines.json),
 *      且不留半截文件。
 *
 * 隔离:IHUI_STORE_ROOT 指向 mkdtemp 临时目录(注入 store);logger 与 node:fs 写入口都是假件,
 * 不触达真实 ~/.ihui,不起后台 agent(backgroundAgentManager.start 被 spy 掉)。
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import type * as NodeFs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { mockLoggerError, fsProbe } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
  fsProbe: {
    failWrites: false,
    renames: [] as Array<{ from: string; to: string }>,
  },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
  },
}))

// 只包两个出口:writeFileSync 是故障注入点(模拟 ENOSPC),renameSync 只做调用记录(行为原样透传)。
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>()
  return {
    ...actual,
    default: actual,
    writeFileSync: (...args: unknown[]) => {
      if (fsProbe.failWrites) {
        const err = new Error('ENOSPC: no space left on device, write') as Error & { code: string }
        err.code = 'ENOSPC'
        throw err
      }
      return (actual.writeFileSync as unknown as (...a: unknown[]) => unknown)(...args)
    },
    renameSync: (from: unknown, to: unknown) => {
      fsProbe.renames.push({ from: String(from), to: String(to) })
      return (actual.renameSync as unknown as (a: unknown, b: unknown) => void)(from, to)
    },
  }
})

import { backgroundAgentManager, routineManager } from '../src/services/workspace-ai-service.js'

const OWNER = 'f303-owner'
const storeRoots: string[] = []
let startSpy: MockInstance<typeof backgroundAgentManager.start>

/** 到期(enabled + nextRun 已经过去)的 routine 记录。 */
function routineRecord(id: string): Record<string, unknown> {
  return {
    id,
    userUuid: OWNER,
    name: `例程 ${id}`,
    prompt: `prompt:${id}`,
    cronExpression: '0 3 * * *',
    workspacePath: '/srv/f303',
    modelId: 'default',
    enabled: true,
    createdAt: 1,
    lastRun: null,
    lastResult: null,
    nextRun: 1,
  }
}

/** 注入 store:临时根 + 预置 routines.json,等 ensureLoaded 从新路径重读。 */
function useStore(records: Array<Record<string, unknown>>): string {
  const root = mkdtempSync(join(tmpdir(), 'ihui-f303-'))
  storeRoots.push(root)
  writeFileSync(join(root, 'routines.json'), JSON.stringify(records, null, 2), 'utf-8')
  process.env.IHUI_STORE_ROOT = root
  return root
}

/** tick 是私有方法:这里只借类型断言取入口,不改任何实现。 */
function internalManager(): {
  tick: () => void
  ensureLoaded: () => void
} {
  return routineManager as unknown as { tick: () => void; ensureLoaded: () => void }
}

function tickOnce(): void {
  internalManager().tick()
}

function tmpLeftovers(root: string): string[] {
  return readdirSync(root).filter((name) => name.endsWith('.tmp'))
}

describe('routine 定时器 tick 错误隔离 — F-303', () => {
  beforeEach(() => {
    mockLoggerError.mockClear()
    fsProbe.failWrites = false
    fsProbe.renames.length = 0
    startSpy = vi.spyOn(backgroundAgentManager, 'start').mockReturnValue('agent-f303')
  })

  afterEach(() => {
    startSpy.mockRestore()
    fsProbe.failWrites = false
  })

  afterAll(() => {
    routineManager.stopScheduler()
    if (storeRoots.length > 0) {
      delete process.env.IHUI_STORE_ROOT
      for (const root of storeRoots) rmSync(root, { recursive: true, force: true })
    }
  })

  it('① persist 抛错时 tick 不抛出,其它 routine 仍执行,每条各留一条带 id 的 error 日志', () => {
    const root = useStore([routineRecord('f303-a'), routineRecord('f303-b')])
    fsProbe.failWrites = true

    expect(() => tickOnce()).not.toThrow()

    // 两条都进了 runRoutine(F-303 要求:一条失败不中断其它)
    expect(startSpy).toHaveBeenCalledTimes(2)

    // 每次失败降级为 logger.error,带 routineId 与错误摘要
    const calls = mockLoggerError.mock.calls as Array<[string, Record<string, unknown>]>
    expect(calls.map(([, meta]) => meta?.routineId).sort()).toEqual(['f303-a', 'f303-b'])
    for (const [, meta] of calls) expect(String(meta?.error)).toContain('ENOSPC')

    // 失败不产出半截文件:磁盘上仍是写入前的完整 JSON,临时文件也已清理
    const onDisk = JSON.parse(readFileSync(join(root, 'routines.json'), 'utf-8')) as Array<{
      id: string
    }>
    expect(onDisk.map((r) => r.id)).toEqual(['f303-a', 'f303-b'])
    expect(tmpLeftovers(root)).toEqual([])
  })

  it('② tick 整体兜底:循环外异常(ensureLoaded)同样不逸出', () => {
    useStore([routineRecord('f303-c')])
    const manager = internalManager()
    const original = manager.ensureLoaded
    manager.ensureLoaded = () => {
      throw new Error('store unreadable')
    }
    try {
      expect(() => manager.tick()).not.toThrow()
    } finally {
      manager.ensureLoaded = original
    }

    expect(startSpy).not.toHaveBeenCalled()
    expect(mockLoggerError).toHaveBeenCalledTimes(1)
    const [message, meta] = mockLoggerError.mock.calls[0] as [string, Record<string, unknown>]
    expect(message).toContain('tick')
    expect(String(meta?.error)).toContain('store unreadable')
  })

  it('③ 成功路径是「临时文件 + rename」原子写,不留 .tmp 残骸', () => {
    const root = useStore([routineRecord('f303-d')])
    const target = join(root, 'routines.json')

    tickOnce()

    expect(startSpy).toHaveBeenCalledTimes(1)
    const renames = fsProbe.renames.filter((r) => r.to === target)
    expect(renames).toHaveLength(1)
    expect(renames[0]!.from).toMatch(/routines\.json\.\d+\.\d+\.tmp$/)
    expect(tmpLeftovers(root)).toEqual([])

    const persisted = JSON.parse(readFileSync(target, 'utf-8')) as Array<{
      id: string
      lastResult: string | null
      nextRun: number | null
    }>
    expect(persisted).toHaveLength(1)
    expect(persisted[0]!.id).toBe('f303-d')
    expect(persisted[0]!.lastResult).toContain('agent-f303')
    expect(persisted[0]!.nextRun).toBeGreaterThan(1)
  })
})
