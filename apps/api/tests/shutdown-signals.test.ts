// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-611 —— apps/api 的信号退出码产出侧。
 *
 * 票面病灶:index.ts 曾以 `process.once(...)` 注册停机,注释写着"二次信号走默认强制退出"
 * —— 但**默认动作的死法不产出任何退出码**。消费侧(check-typecheck →
 * scripts/lib/signal-exit.mjs 的 128+N 族)已经按码区分"被杀 ≠ 结论",我方作为被派生/
 * 被监管的一方必须把码产出来。本文件钉三层:
 *   U  —— createShutdownSignalHandler 的闩语义(一停机/二产出/三幂等/停机自炸不升级);
 *   L  —— **进程级闭环**:spawn 真子进程(装好 process.on 的夹具),读回真实退出码 143
 *         并断言 signal === null(是"产出的码",不是"死于信号");emit 臂跨平台,
 *         selfterm 臂走内核真投递(仅 POSIX,Windows 的 process.kill 自杀 =
 *         TerminateProcess,监听器机制性不跑 —— 跳过原因写在测试里,不是隐藏)。
 *   S  —— 形状锁:index.ts 的 `process.once` 形态不得回来(它一回来,产出侧整格失明)。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  SIGNAL_EXIT_NUMBERS,
  SIGNAL_EXIT_OFFSET,
  createShutdownSignalHandler,
  forceExitCodeForSignal,
} from '../src/lib/shutdown-signals.js'

const API_DIR = fileURLToPath(new URL('..', import.meta.url))
const FIXTURE = join(API_DIR, 'tests', 'fixtures', 'signal-producer-child.ts')
const TSX_CLI = join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const INDEX_TS = join(API_DIR, 'src', 'index.ts')
const IS_WIN = process.platform === 'win32'

function runChild(arm: string) {
  if (!existsSync(TSX_CLI)) {
    // 硬失败,不静默跳过:出路必须真能跑(§"文档不得写跑不通的出路")
    throw new Error(`tsx CLI 不在预期位置(${TSX_CLI})—— 闭环臂拿不到真退出码,拒绝记绿`)
  }
  return spawnSync(process.execPath, [TSX_CLI, FIXTURE, arm], {
    cwd: API_DIR,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

describe('U —— 闩语义(纯依赖注入,不起进程)', () => {
  it('U1 第一下信号只走有序停机,不直接产出退出码', () => {
    const shutdown = vi.fn()
    const exit = vi.fn()
    const handler = createShutdownSignalHandler({ shutdown, exit })
    handler('SIGTERM')
    expect(shutdown).toHaveBeenCalledTimes(1)
    expect(shutdown).toHaveBeenCalledWith('SIGTERM')
    expect(exit).not.toHaveBeenCalled()
  })

  it('U2 第二下 SIGTERM 产出 143(128+15),停机不会被跑第二遍', () => {
    const shutdown = vi.fn()
    const exit = vi.fn()
    const handler = createShutdownSignalHandler({ shutdown, exit })
    handler('SIGTERM')
    handler('SIGTERM')
    expect(shutdown).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(143)
  })

  it('U3 闩跨信号类型计数:一 TERM 二 INT ⇒ 产出 130(不是各数各的)', () => {
    const exit = vi.fn()
    const handler = createShutdownSignalHandler({ shutdown: () => {}, exit })
    handler('SIGTERM')
    handler('SIGINT')
    expect(exit).toHaveBeenCalledWith(130)
  })

  it('U4 第三下及以后仍产出码且幂等不抛(监管面连杀不该把进程卡在无码死法)', () => {
    const exit = vi.fn()
    const handler = createShutdownSignalHandler({ shutdown: () => {}, exit })
    handler('SIGTERM')
    handler('SIGTERM')
    handler('SIGTERM')
    handler('SIGTERM')
    expect(exit).toHaveBeenCalledTimes(3)
    for (const call of exit.mock.calls) expect(call[0]).toBe(143)
  })

  it('U5 停机同步抛出被吞进 warn,不冒成未捕获错误,也不误发退出码', () => {
    const warn = vi.fn()
    const exit = vi.fn()
    const handler = createShutdownSignalHandler({
      shutdown: () => {
        throw new Error('boom')
      },
      exit,
      warn,
    })
    expect(() => handler('SIGTERM')).not.toThrow()
    expect(exit).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })

  it('U6 停机 promise reject 收进 warn(index.ts 顶层 unhandledRejection 只记日志不退出,漏进去就是"存活不 exit"假死)', async () => {
    const warn = vi.fn()
    const handler = createShutdownSignalHandler({
      shutdown: () => Promise.reject(new Error('nope')),
      exit: () => {},
      warn,
    })
    handler('SIGTERM')
    await new Promise((r) => setTimeout(r, 20))
    expect(warn).toHaveBeenCalled()
  })

  it('U7 未知信号名不猜 128+N:映射 null,闩第二支兜底 1 并 warn 点名', () => {
    expect(forceExitCodeForSignal('NOT_A_SIGNAL')).toBeNull()
    const exit = vi.fn()
    const warn = vi.fn()
    const handler = createShutdownSignalHandler({ shutdown: () => {}, exit, warn })
    handler('SIGTERM')
    handler('NOT_A_SIGNAL')
    expect(exit).toHaveBeenCalledWith(1)
    expect(warn).toHaveBeenCalled()
  })

  it('U8 偏移与信号表:143/130 这两个本票的当事码必须来自 128+N,不是散文字面量', () => {
    expect(SIGNAL_EXIT_OFFSET).toBe(128)
    expect(SIGNAL_EXIT_NUMBERS.SIGTERM).toBe(15)
    expect(SIGNAL_EXIT_NUMBERS.SIGINT).toBe(2)
    expect(forceExitCodeForSignal('SIGTERM')).toBe(143)
    expect(forceExitCodeForSignal('SIGINT')).toBe(130)
    expect(forceExitCodeForSignal('SIGHUP')).toBe(129)
    // SIGKILL 不可捕获,但表里的映射值供 shell/运行时中转码的对账用
    expect(forceExitCodeForSignal('SIGKILL')).toBe(137)
  })
})

describe('L —— 进程级闭环(票面验收:"父侧读到 143 判临时失败")', () => {
  it('L1 emit-twice:真子进程连两下信号 ⇒ 父侧读到 143,且 signal 为 null(码是被产出的,不是死于信号)', () => {
    const r = runChild('emit-twice')
    expect(r.status, `子进程未按产出码退出:\n${r.stdout}\n${r.stderr}`).toBe(143)
    expect(r.signal).toBeNull()
  })

  it('L2 emit-once 对照:首信号只走有序停机(400ms 后 0 收尾),既不得被强杀成 143,也不得挂死', () => {
    const r = runChild('emit-once')
    expect(r.status, `有序停机臂异常:\n${r.stdout}\n${r.stderr}`).toBe(0)
    expect(r.signal).toBeNull()
  })

  // 真内核投递臂:仅 POSIX 可达 —— Windows 上 process.kill(self,'SIGTERM') 是
  // TerminateProcess,监听器机制性不会跑(没有"跑不通的出路",只有当轮量到的边界:
  // L1/L2 覆盖同一监听器与同一个闩,这两臂补的是"libuv 真投递"那一格)。
  it.skipIf(IS_WIN)(
    'L3 selfterm-twice(POSIX):两次真 SIGTERM ⇒ 第二次产出 143(内核投递走的就是同一条 process.on 链)',
    () => {
      const r = runChild('selfterm-twice')
      expect(r.status).toBe(143)
      expect(r.signal).toBeNull()
      expect(r.stdout).toContain('ready')
    },
  )

  it.skipIf(IS_WIN)(
    'L4 selfterm-once(POSIX):一次真 SIGTERM 被捕获 ⇒ 有序停机 ⇒ exit 0(不是默认无码死法)',
    () => {
      const r = runChild('selfterm-once')
      expect(r.status).toBe(0)
      expect(r.signal).toBeNull()
    },
  )
})

describe('S —— 形状锁(产出侧接线不得被悄悄摘回)', () => {
  const src = readFileSync(INDEX_TS, 'utf8')

  it('S1 index.ts 不得再出现 process.once 的停机注册(once ⇒ 第二下落回"无码默认死法",本票的病)', () => {
    expect(src).not.toMatch(/process\.once\(\s*['"]SIG/)
  })

  it('S2 index.ts 必须真用带闩的 handler 把 SIGTERM/SIGINT 装上 process.on(装而不接 = 没有)', () => {
    expect(src).toMatch(/createShutdownSignalHandler\(/)
    expect(src).toMatch(/process\.on\(\s*['"]SIGTERM['"]/)
    expect(src).toMatch(/process\.on\(\s*['"]SIGINT['"]/)
  })

  it('S3 夹具必须留在 tests/fixtures 且不落入 vitest 的 include glob(它是被 spawn 的入口,不是套件)', () => {
    expect(existsSync(FIXTURE)).toBe(true)
    expect(FIXTURE).not.toMatch(/\.test\.ts$/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
