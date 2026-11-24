// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-302 回归锁(2026-11-13):routine 调度器只能有一个属主。
 *
 * 病灶:`workspace-ai-service.ts` 模块体末尾无条件调 `routineManager.startScheduler()`,
 * 而 API(`index.ts`)与 worker(`worker-entry.ts`)都经 `buildServer()` 载入同一批
 * route/service 模块 ⇒ 两个进程各起一个 60s 定时器,对同一份 `routines.json` 的同一个
 * cron 各触发一次;`persist()` 还是整文件覆盖写,多进程并发互相丢更新。
 *
 * 本文件锁:
 *   ① 模块导入本身不再启动定时器(worker 的 buildServer 路径是零副作用);
 *   ② worker 角色调用 startScheduler 被显式拒绝(返回 false + warn),不执行任何 routine;
 *   ③ API 角色单进程照常执行:一个 60s 定时器,推进 60s 只触发一次并落盘;
 *   ④ 同进程重复启动幂等:第二次返回 false,不再多起一个定时器;
 *   ⑤ 接线钉住:worker-entry 在 buildServer 前声明 worker;index.ts 的
 *      startBackgroundSchedulers 是唯一启动点;workspace-ai-service 模块体不再调用。
 *
 * 隔离:IHUI_STORE_ROOT 指向 mkdtemp 临时目录,不触达真实 ~/.ihui;
 * backgroundAgentManager.start 与 logger 都是假件,不起后台 agent。
 */
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }))

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  },
}))

import { backgroundAgentManager, routineManager } from '../src/services/workspace-ai-service.js'
import { declareProcessRole } from '../src/utils/process-role.js'

const OWNER = 'f302-owner'
const storeRoots: string[] = []
let startSpy: MockInstance<typeof backgroundAgentManager.start>

/** 到期(enabled + nextRun 已过去)的 routine 记录。 */
function routineRecord(id: string): Record<string, unknown> {
  return {
    id,
    userUuid: OWNER,
    name: `例程 ${id}`,
    prompt: `prompt:${id}`,
    cronExpression: '0 3 * * *',
    workspacePath: '/srv/f302',
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
  const root = mkdtempSync(join(tmpdir(), 'ihui-f302-'))
  storeRoots.push(root)
  writeFileSync(join(root, 'routines.json'), JSON.stringify(records, null, 2), 'utf-8')
  process.env.IHUI_STORE_ROOT = root
  return root
}

/** timer 是私有字段:只借类型断言读它,不改实现。 */
function timerOf(manager: unknown = routineManager): NodeJS.Timeout | null {
  return (manager as { timer: NodeJS.Timeout | null }).timer
}

function readSource(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf-8')
}

describe('routine 调度器单属主 — F-302', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-13T00:00:00Z'))
    mockLoggerWarn.mockClear()
    declareProcessRole('api')
    startSpy = vi.spyOn(backgroundAgentManager, 'start').mockReturnValue('agent-f302')
  })

  afterEach(() => {
    routineManager.stopScheduler()
    startSpy.mockRestore()
    vi.useRealTimers()
    delete process.env.IHUI_STORE_ROOT
  })

  afterAll(() => {
    if (storeRoots.length > 0) {
      for (const root of storeRoots) rmSync(root, { recursive: true, force: true })
    }
  })

  it('① 模块导入本身不启动定时器(worker 的 buildServer 路径零副作用)', async () => {
    vi.resetModules()
    const fresh = (await import('../src/services/workspace-ai-service.js')) as {
      routineManager: unknown
    }
    expect(timerOf(fresh.routineManager)).toBeNull()
  })

  it('② worker 角色:startScheduler 显式拒绝,不起定时器、不执行 routine', () => {
    useStore([routineRecord('f302-w')])
    declareProcessRole('worker')

    expect(routineManager.startScheduler()).toBe(false)
    expect(timerOf()).toBeNull()
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
    expect(String(mockLoggerWarn.mock.calls[0]![0])).toContain('API 角色')

    vi.advanceTimersByTime(120_000)
    expect(startSpy).not.toHaveBeenCalled()
  })

  it('③ API 角色:单进程照常执行,推进 60s 只触发一次并落盘', () => {
    const root = useStore([routineRecord('f302-a')])
    declareProcessRole('api')

    expect(routineManager.startScheduler()).toBe(true)
    expect(timerOf()).not.toBeNull()

    vi.advanceTimersByTime(60_000)
    expect(startSpy).toHaveBeenCalledTimes(1)

    const persisted = JSON.parse(readFileSync(join(root, 'routines.json'), 'utf-8')) as Array<{
      id: string
      lastResult: string | null
      nextRun: number | null
    }>
    expect(persisted).toHaveLength(1)
    expect(persisted[0]!.lastResult).toContain('agent-f302')
    expect(persisted[0]!.nextRun).toBeGreaterThan(1)
  })

  it('④ 同进程重复启动幂等:第二次返回 false,不再多起一个定时器', () => {
    useStore([routineRecord('f302-b')])
    declareProcessRole('api')
    const intervalSpy = vi.spyOn(globalThis, 'setInterval')

    expect(routineManager.startScheduler()).toBe(true)
    expect(routineManager.startScheduler()).toBe(false)
    expect(intervalSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60_000)
    expect(startSpy).toHaveBeenCalledTimes(1)
    intervalSpy.mockRestore()
  })

  it('⑤ 接线钉住:worker 入口先声明角色,index.ts 是唯一启动点,模块体不再自启动', () => {
    const workerSrc = readSource('../src/worker-entry.ts')
    const declareAt = workerSrc.indexOf("declareProcessRole('worker')")
    expect(declareAt).toBeGreaterThan(-1)
    expect(declareAt).toBeLessThan(workerSrc.indexOf('await buildServer()'))

    const indexSrc = readSource('../src/index.ts')
    const startAt = indexSrc.indexOf('routineManager.startScheduler()')
    expect(startAt).toBeGreaterThan(indexSrc.indexOf('function startBackgroundSchedulers'))

    // 模块级裸调用已删除(注释里提到方法名不算调用)
    expect(readSource('../src/services/workspace-ai-service.ts')).not.toMatch(
      /^routineManager\.startScheduler\(\)/m,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
