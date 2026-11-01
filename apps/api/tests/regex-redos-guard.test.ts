// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * ReDoS 静态判据的拒绝/放行边界(2026-11-01 安全强化)。
 *
 * 修前:`hasNestedQuantifier` 只识别"量词化的组内**再含量词**"(`(a+)+`),
 * 交替型 `(a|aa)+$` 组内没有量词 ⇒ 判据直接放行 ⇒ 主线程同步 `new RegExp().test()`
 * 对一个 10KB 全 a 的行指数级回溯,事件循环被钉死(整站停摆)。
 *
 * 本文件三件事:
 *  1. 拒绝集 / 放行集逐条钉住(判据只允许这一份实现);
 *  2. **真实调用点**证明"判据先拒,根本走不到 new RegExp"—— 用计数的 RegExp
 *     构造器断言 0 次编译(不靠耗时碰巧通过);
 *  3. 用 Worker + terminate 量化威胁:同一个危险 pattern 在 V8 上确实跑不完,
 *     且 Worker 到点被杀 —— 测试本身绝不会挂死。
 */

import { describe, expect, it, vi } from 'vitest'
import { Worker } from 'node:worker_threads'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    AI_SERVICE_URL: 'http://127.0.0.1:1',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dbRead: { select: vi.fn() },
}))

import { hasNestedQuantifier } from '../src/services/rules-service.js'
import { fsBridge } from '../src/services/workspace-ai-service.js'

/** 必须拒绝:量词化的组内含量词,或量词化的组内含 `|` */
const REJECT = [
  '(a+)+',
  '(a|aa)+',
  '(.*)*',
  '(\\d+|\\w+)+',
  '(?:x|y)*',
  '(a|aa)+$',
  '(\\d+)*\\s*x',
  '^(?:ab|a)*$',
  '(a?){2,}',
  '(a|b){2,}',
]

/** 必须放行:无组 / 组未被量词化 / 顶层交替 / 字符类与转义里的假信号 */
const ALLOW = [
  '^abc$',
  '\\d{4}-\\d{2}',
  '(foo|bar)',
  '(key|value):\\s*\\S+',
  '^foo|bar$',
  'a+',
  '[+*|]',
  '\\|\\(\\)',
  '(https?)?',
  '(?:25[0-5]|2[0-4]\\d|1\\d\\d){4}',
]

describe('hasNestedQuantifier 判据边界', () => {
  it.each(REJECT)('拒绝 %s', (pattern) => {
    expect(hasNestedQuantifier(pattern)).toBe(true)
  })

  it.each(ALLOW)('放行 %s', (pattern) => {
    expect(hasNestedQuantifier(pattern)).toBe(false)
  })
})

describe('真实调用点:被拒 pattern 走不到 new RegExp', () => {
  it('/fs/grep 在 10KB 全 a 输入上对 (a|aa)+$ 直接拒绝,且 0 次 RegExp 编译', () => {
    // 10KB 输入本身不会被读到(判据在文件系统之前),这里写明威胁形状:
    // 攻击者提交的正是这样一个 pattern + 这样一个被搜索行。
    const subject = 'a'.repeat(10 * 1024) // grep 的单行上限
    expect(subject).toHaveLength(10 * 1024)

    const OriginalRegExp = globalThis.RegExp
    let compiled = 0
    class CountingRegExp extends OriginalRegExp {
      constructor(...args: ConstructorParameters<typeof RegExp>) {
        compiled++
        super(...args)
      }
    }

    let caught: Error | undefined
    ;(globalThis as { RegExp: typeof RegExp }).RegExp = CountingRegExp as unknown as typeof RegExp
    try {
      fsBridge.grep({ path: '.', workspacePath: '.', pattern: '(a|aa)+$' })
    } catch (e) {
      caught = e as Error
    } finally {
      globalThis.RegExp = OriginalRegExp
    }

    // 判据的固定错误(而不是路径闸/正则编译错误)
    expect(caught?.message).toContain('指数级回溯')
    // 关键证据:一次 RegExp 都没构造 ⇒ 后续 .test(10KB 全 a)不可能发生
    expect(compiled).toBe(0)
  })
})

type WorkerOutcome = 'completed' | 'timeout' | 'error'

/**
 * 在**独立 Worker** 里跑一次正则,到点直接 terminate。
 * 主线程同步正则无法中断 —— 这是唯一能"量化威胁又不挂死测试"的做法。
 */
function runRegexInWorker(
  pattern: string,
  subject: string,
  budgetMs: number,
): Promise<WorkerOutcome> {
  const source = `
    const { parentPort, workerData } = require('node:worker_threads')
    new RegExp(workerData.pattern).test(workerData.subject)
    parentPort.postMessage('done')
  `
  return new Promise<WorkerOutcome>((resolve) => {
    const worker = new Worker(source, { eval: true, workerData: { pattern, subject } })
    let settled = false
    const finish = (outcome: WorkerOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      resolve(outcome)
    }
    const timer = setTimeout(() => finish('timeout'), budgetMs)
    worker.once('message', () => finish('completed'))
    worker.once('error', () => finish('error'))
  })
}

describe('威胁量化:同一 pattern 在 V8 上确实跑不完', () => {
  it('对照:(a|aa)+$ 对 2000 个 a 指数级回溯,1s 内不返回(Worker 到点被杀)', async () => {
    const outcome = await runRegexInWorker('(a|aa)+$', 'a'.repeat(2000) + '!', 1000)
    // completed 意味着判据被绕过才有意义 —— 这里必须跑不完
    expect(outcome).toBe('timeout')
  }, 10_000)

  it('对照:普通 pattern 在同样输入上毫秒级完成(证明上面不是装置恒超时)', async () => {
    const outcome = await runRegexInWorker('abc', 'a'.repeat(2000), 1000)
    expect(outcome).toBe('completed')
  }, 10_000)
})
