// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 并发预算单一出口(concurrency budget)。
 *
 * 立因(2026-09-26 实测):子 agent 并发档在本仓**五处各自写死 4**,且
 * **全仓没有任何 CPU 推导**(grep `availableParallelism|defaultConcurrency` 在
 * apps/cli + packages 零命中,只有 `device-fingerprint` 里无关的 `os.cpus().length`);
 * 同时模型填入的 `maxWorkers` **上下限都不钳**(`Math.min(16, …)` 那道上界在磁盘上不存在,
 * 即"上界与默认互不相干"的真实形态是"根本没有上界")。
 * 后果:`spawnParallel()` 每次自建自关一个 pool,两个并发 fan-out 的实际并发是 2×maxWorkers,
 * 而 maxWorkers 可以是任意大的模型自填值。
 *
 * 本模块是**唯一**允许出现并发档位字面量的地方:硬上限与默认值都只写这一处。
 * 各调用点(见下)一律经 `resolveMaxConcurrency()`,不得再写 `?? 4` / `= 4` / `Math.min(16, …)`。
 *
 * 调用点清单(现值,勿按旧文档派单):
 *   - `src/commands/subagent-collab.ts` 的 `spawnParallel()` 与 `WorkerPoolCollaborationExecutor`
 *   - `src/subagents/worker-pool.ts` 的 `defaultWorkerPoolConfig()`
 *   - `src/commands/subagent-parallel.ts`(CLI 入口)
 *   - `src/tools/subagent.ts`(模型可见参数)
 *
 * 未收口的一条(如实登记,不是已完成):pool 复用。`spawnParallel()` 仍每次 `new` + `finally shutdown()`,
 * 因为 shutdown 会 resolve 队列里的 pending 任务,改成共享池要重做生命周期语义(另计一票)。
 * 本票只做"并发总量可被观测":见 `notePoolCreated` / `notePoolClosed` / `concurrencyBudgetSnapshot`。
 */

import * as os from 'node:os'

/** 硬上限:一次 fan-out 最多同时存活多少个 worker 子进程。唯一真相源。 */
export const MAX_CONCURRENCY = 16

/** 下限:至少 1,否则 drainQueue 的 `activeCount < maxWorkers` 永不成立 ⇒ 任务全排队饿死。 */
export const MIN_CONCURRENCY = 1

/**
 * CPU 读数拿不到时的兜底档(Node 异常 / 容器内读不到)。
 * 刻意不等于旧的写死值 4:旧值没有任何依据,这里取"保守可用"的 2。
 */
const CPU_UNREADABLE_FALLBACK = 2

function clampConcurrency(n: number): number {
  if (!Number.isFinite(n)) return MIN_CONCURRENCY
  const int = Math.floor(n)
  if (int < MIN_CONCURRENCY) return MIN_CONCURRENCY
  if (int > MAX_CONCURRENCY) return MAX_CONCURRENCY
  return int
}

/**
 * 机器并行度(优先 `os.availableParallelism()`,它是 cgroup/亲和性感知的那一个;
 * 旧 Node 无此方法时降 `os.defaultConcurrency()`,再降 `os.cpus().length`)。
 */
export function cpuParallelism(): number {
  const osAny = os as typeof os & {
    availableParallelism?: () => number
    defaultConcurrency?: () => number
  }
  const raw =
    typeof osAny.availableParallelism === 'function'
      ? osAny.availableParallelism()
      : typeof osAny.defaultConcurrency === 'function'
        ? osAny.defaultConcurrency()
        : os.cpus().length
  return Number.isFinite(raw) && raw > 0 ? raw : CPU_UNREADABLE_FALLBACK
}

/**
 * 并发档唯一解析出口。
 *
 * - 有请求值(模型/CLI 填的 `maxWorkers`)⇒ 钳到 `[MIN_CONCURRENCY, MAX_CONCURRENCY]`
 * - 无请求值 ⇒ 按 CPU 推导后同一次钳制
 *
 * `cpu` 形参供测试注入确定的机器并行度(否则"默认走 CPU 推导而非固定 4"这条断言
 * 在 4 核机上会退化);生产调用方一律不传。
 */
export function resolveMaxConcurrency(requested?: number, cpu: number = cpuParallelism()): number {
  if (typeof requested === 'number') return clampConcurrency(requested)
  return clampConcurrency(cpu)
}

// ───────────────────────── 并发总量可观测(池生命周期计数) ─────────────────────────
// 只读遥测:任何一侧都不改行为。判"两个并发 fan-out = 2×maxWorkers"这类问题时用它现读。

let poolsCreated = 0
let poolsClosed = 0

/** `SubagentWorkerPool` 构造时调用。 */
export function notePoolCreated(): void {
  poolsCreated += 1
}

/** `SubagentWorkerPool.shutdown()` 首次调用时调用(重复 shutdown 不再计数)。 */
export function notePoolClosed(): void {
  // 单调性护栏:计数被外部重置时也不得让 active 变负
  poolsClosed = Math.min(poolsClosed + 1, poolsCreated)
}

export interface ConcurrencyBudgetSnapshot {
  /** 迄今创建的池数 */
  poolsCreated: number
  /** 迄今关闭的池数 */
  poolsClosed: number
  /** 当前仍存活的池数(= 并发总量的放大倍数) */
  activePools: number
  ceiling: number
  floor: number
  /** 本机按 CPU 推导出的默认档 */
  cpuDerivedDefault: number
}

export function concurrencyBudgetSnapshot(): ConcurrencyBudgetSnapshot {
  return {
    poolsCreated,
    poolsClosed,
    activePools: Math.max(0, poolsCreated - poolsClosed),
    ceiling: MAX_CONCURRENCY,
    floor: MIN_CONCURRENCY,
    cpuDerivedDefault: resolveMaxConcurrency(),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
