// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * parent-bound 镜像测试 —— S6(逆向 WorkBuddy Job Object 的复现+超越,判据面)。
 *
 * 六例对应票面验收:
 *  ① 父死 ⇒ kill  ② 父活子活 ⇒ wait  ③ 子先死 ⇒ exit(不留僵尸看守)
 *  ④ 超 maxLifetimeMs ⇒ exit(看门狗自身必须有死亡机制)
 *  ⑤ 观测取不到 ⇒ unjudged 且**绝不发起回收树动作**(正反对照:spy 断言没被调用/被调用)
 *  ⑥ 形状锁:decideWatchdogTick 函数体内不得出现任何 spawn/kill/fs/进程调用(纯判据)
 */

import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  decideWatchdogTick,
  planEngineSupervisor,
  planNestedJobFallback,
  stepWatchdog,
  unjudgedFieldsOf,
  type WatchdogRunConfig,
  type WatchdogTickInput,
} from '../src/util/parent-bound.js'

const START = 1_000
const BASE: WatchdogTickInput = {
  parentAlive: true,
  childAlive: true,
  nowMs: 1_000,
  startedAtMs: START,
  maxLifetimeMs: 60_000,
}

describe('decideWatchdogTick(纯判据)', () => {
  it('① 父死子活 ⇒ kill', () => {
    expect(decideWatchdogTick({ ...BASE, parentAlive: false })).toBe('kill')
  })

  it('② 父活子活(上限内)⇒ wait', () => {
    expect(decideWatchdogTick(BASE)).toBe('wait')
  })

  it('③ 子先死 ⇒ exit(看门狗自退,不留僵尸看守)', () => {
    expect(decideWatchdogTick({ ...BASE, childAlive: false })).toBe('exit')
    // 父母俱亡同样只退不杀(目标集为空的 fail-closed 由 spawn-isolated 判据把关,这里不越权)
    expect(decideWatchdogTick({ ...BASE, parentAlive: false, childAlive: false })).toBe('exit')
  })

  it('④ 到达 maxLifetimeMs ⇒ exit(到点即算超,死亡机制不打折)', () => {
    expect(decideWatchdogTick({ ...BASE, nowMs: START + BASE.maxLifetimeMs })).toBe('exit')
    expect(decideWatchdogTick({ ...BASE, nowMs: START + BASE.maxLifetimeMs + 1 })).toBe('exit')
  })

  it('⑤ 观测缺失 ⇒ unjudged,并点名是哪一维取不到', () => {
    expect(decideWatchdogTick({ ...BASE, parentAlive: null })).toBe('unjudged')
    expect(unjudgedFieldsOf({ ...BASE, parentAlive: null })).toEqual(['parentAlive'])
    expect(decideWatchdogTick({ ...BASE, childAlive: null })).toBe('unjudged')
    expect(unjudgedFieldsOf({ ...BASE, childAlive: null })).toEqual(['childAlive'])
    expect(decideWatchdogTick({ ...BASE, parentAlive: null, childAlive: null })).toBe('unjudged')
    expect(unjudgedFieldsOf({ ...BASE, parentAlive: null, childAlive: null })).toEqual([
      'parentAlive',
      'childAlive',
    ])
  })

  it('⑤+④ 观测缺失不卡死亡机制:超上限即便未判定也 ⇒ exit', () => {
    expect(
      decideWatchdogTick({
        ...BASE,
        parentAlive: null,
        childAlive: null,
        nowMs: START + BASE.maxLifetimeMs,
      }),
    ).toBe('exit')
  })
})

describe('stepWatchdog(执行步进:仅 kill 档允许副作用)', () => {
  const cfg: WatchdogRunConfig = { childPid: 4242, startedAtMs: START, maxLifetimeMs: 60_000 }

  it('⑤ 反向对照:unjudged ⇒ killTree 一次都不被调用', async () => {
    const killTree = vi.fn(async () => undefined)
    const verdict = await stepWatchdog(
      {
        observeParentAlive: () => null, // 父观测失败
        observeChildAlive: () => true,
        killTree,
        nowMs: () => 2_000,
      },
      cfg,
    )
    expect(verdict).toBe('unjudged')
    expect(killTree).not.toHaveBeenCalled()
  })

  it('⑤ 正向对照:父死 ⇒ killTree 恰被调用一次且收到 childPid', async () => {
    const killTree = vi.fn(async () => undefined)
    const verdict = await stepWatchdog(
      {
        observeParentAlive: () => false,
        observeChildAlive: () => true,
        killTree,
        nowMs: () => 2_000,
      },
      cfg,
    )
    expect(verdict).toBe('kill')
    expect(killTree).toHaveBeenCalledTimes(1)
    expect(killTree).toHaveBeenCalledWith(4242)
  })

  it('wait/exit 档同样不触发回收树动作', async () => {
    for (const [parentAlive, childAlive, expected] of [
      [true, true, 'wait'],
      [true, false, 'exit'],
    ] as const) {
      const killTree = vi.fn(async () => undefined)
      const verdict = await stepWatchdog(
        {
          observeParentAlive: () => parentAlive,
          observeChildAlive: () => childAlive,
          killTree,
          nowMs: () => 2_000,
        },
        cfg,
      )
      expect(verdict).toBe(expected)
      expect(killTree).not.toHaveBeenCalled()
    }
  })
})

describe('作业监工启动条件', () => {
  it('错误码不是脱离许可,只有那句原话才是', () => {
    expect(planNestedJobFallback({ phrase: null, winerror: 5 }).disposition).toBe('refused')
    expect(planNestedJobFallback({ phrase: null, winerror: null }).disposition).toBe('unjudged')
    expect(
      planNestedJobFallback({
        phrase: 'parent Job denied nested assignment',
        winerror: 5,
      }),
    ).toEqual({ disposition: 'breakaway', reason: 'nested-denied' })
  })

  it('lifeline 没量到或占用了标准流,都不记成已装上作业', () => {
    // 走通 abs 闸的路径必须**在宿主平台**上是绝对路径:判据用 `path.isAbsolute`,
    // 而 `C:\engine.exe` 只在 win32 上是绝对的(POSIX 上不是)—— 写死 Windows 形态
    // 就会让 `engine-path-not-absolute` 抢在 lifeline 判定之前先返回,本机绿、CI 红。
    // 用 path.resolve 造一个两平台都绝对的形态,受审的是 lifeline/grace/receipt 三闸。
    const abs = path.resolve('/engine.exe')
    const absReceipt = path.resolve('/receipt.json')
    expect(
      planEngineSupervisor({
        enginePath: abs,
        lifelineFd: null,
        graceMs: 1000,
        exitReceipt: absReceipt,
      }).reason,
    ).toBe('lifeline-unmeasured')
    expect(
      planEngineSupervisor({
        enginePath: abs,
        lifelineFd: 1,
        graceMs: 1000,
        exitReceipt: absReceipt,
      }).reason,
    ).toBe('lifeline-not-dedicated')
    expect(
      planEngineSupervisor({
        enginePath: 'engine.exe',
        lifelineFd: 3,
        graceMs: 1000,
        exitReceipt: absReceipt,
      }).reason,
    ).toBe('engine-path-not-absolute')
    expect(
      planEngineSupervisor({
        enginePath: abs,
        lifelineFd: 3,
        graceMs: null,
        exitReceipt: absReceipt,
      }).reason,
    ).toBe('grace-unmeasured')
    expect(
      planEngineSupervisor({
        enginePath: abs,
        lifelineFd: 3,
        graceMs: 1000,
        exitReceipt: null,
      }).reason,
    ).toBe('receipt-unmeasured')
    expect(
      planEngineSupervisor({
        enginePath: abs,
        lifelineFd: 3,
        graceMs: 1000,
        exitReceipt: absReceipt,
      }),
    ).toEqual({ disposition: 'armed', reason: 'measured' })
  })
})

describe('形状锁(§22c/§0.6:纯判据零副作用,违规必须在 diff 里可见)', () => {
  it('⑥ decideWatchdogTick 函数体内不得出现任何 spawn/kill/fs/进程调用', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/util/parent-bound.ts', import.meta.url)),
      'utf8',
    )
    const start = src.indexOf('export function decideWatchdogTick')
    expect(start).toBeGreaterThanOrEqual(0)
    const bodyEnd = src.indexOf('\n}', start)
    expect(bodyEnd).toBeGreaterThan(start)
    const body = src.slice(start, bodyEnd)
    const forbidden: Array<[string, RegExp]> = [
      ['spawn(', /\bspawn\s*\(/],
      ['kill(', /\bkill\s*\(/],
      ['process.kill', /process\.kill/],
      ['process.exit', /process\.exit/],
      ['exec*', /\bexec[A-Za-z]*\s*\(/],
      ['readFileSync', /readFileSync/],
      ['writeFileSync', /writeFileSync/],
      ['require(', /\brequire\s*\(/],
      ['import(', /\bimport\s*\(/],
    ]
    for (const [name, re] of forbidden) {
      expect(re.test(body), `decideWatchdogTick 体内出现禁止调用:${name}`).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
