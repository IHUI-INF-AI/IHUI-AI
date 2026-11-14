// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-367 回归锁(2026-11-13)。
 *
 * 病灶:services/cli-import/redis-cache.ts 模块顶层 `setInterval` ⇒ import 即启动;
 * worker 也经 buildServer() 加载全部路由 ⇒ API 与 worker 各持一个 fallback 清理器。
 *
 * 本文件锁:
 * ① import 模块本身不创建定时器(动态 import + setInterval 间谍 0 调用);
 * ② startFallbackCleanup 后恰有 1 个定时器(5min),重复调用不叠加;
 * ③ stopFallbackCleanup 清掉定时器且幂等,停后可再启动;
 * ④ API 入口显式启动、worker 入口不出现 startFallbackCleanup(源码锁)。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const MODULE_PATH = '../src/services/cli-import/redis-cache.js'
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

/** 只声明本用例用到的两个生命周期函数,避免 import() 类型注解。 */
interface CleanupModule {
  startFallbackCleanup: () => void
  stopFallbackCleanup: () => void
}

let mod: CleanupModule | undefined
let setIntervalSpy: ReturnType<typeof vi.spyOn>
let clearIntervalSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.resetModules()
  mod = undefined
  setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
  clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
})

afterEach(() => {
  mod?.stopFallbackCleanup()
  vi.restoreAllMocks()
})

describe('F-367 cli-import fallback 清理定时器惰性启动', () => {
  it('① import 模块本身不创建任何定时器', async () => {
    mod = await import(MODULE_PATH)
    expect(typeof mod.startFallbackCleanup).toBe('function')
    expect(typeof mod.stopFallbackCleanup).toBe('function')
    expect(setIntervalSpy).toHaveBeenCalledTimes(0)
  })

  it('② start 后恰有 1 个 5 分钟定时器,重复调用不叠加', async () => {
    mod = await import(MODULE_PATH)
    mod.startFallbackCleanup()
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    expect(setIntervalSpy.mock.calls[0]?.[1]).toBe(CLEANUP_INTERVAL_MS)
    expect(setIntervalSpy.mock.calls[0]?.[0]).toBeTypeOf('function')

    mod.startFallbackCleanup()
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
  })

  it('③ stop 后清掉定时器(幂等),之后可再次启动', async () => {
    mod = await import(MODULE_PATH)
    mod.startFallbackCleanup()
    const timer = setIntervalSpy.mock.results[0]?.value

    mod.stopFallbackCleanup()
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
    expect(clearIntervalSpy.mock.calls[0]?.[0]).toBe(timer)

    // 重复 stop 不再产生 clearInterval 调用
    mod.stopFallbackCleanup()
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1)

    mod.startFallbackCleanup()
    expect(setIntervalSpy).toHaveBeenCalledTimes(2)
  })

  it('④ API 入口显式启动,worker 入口不调用 startFallbackCleanup', () => {
    const indexSrc = readFileSync(path.join(here, '..', 'src', 'index.ts'), 'utf8')
    const workerSrc = readFileSync(path.join(here, '..', 'src', 'worker-entry.ts'), 'utf8')
    expect(indexSrc).toMatch(/\bstartFallbackCleanup\(\)/)
    expect(workerSrc).not.toMatch(/startFallbackCleanup/)
  })
})
