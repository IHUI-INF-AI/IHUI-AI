// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话级 worktree 工具(enter_worktree / exit_worktree)行为锁。
 *
 * 本册把 git 子进程整体打桩,钉的是**次序与判据**,不是"git 会不会删目录":
 *  ① enter 创建后 exit 回收:目录先真消失,再走既有 prune(摘 git 注册表条目);
 *  ② 分支未并入 / 并入状态判不出 / 隔离区有未提交改动 ⇒ 默认拒删且**不触发**
 *     worktreeRemove 事件(没发生的事不许报成事件);
 *  ③ force=true 越过拒删档时,事件载荷如实标注 worktreeForced;
 *  ④ 钩子炸了只落 stderr,不污染 stdout —— json 档的 stdout 是机器可读流;
 *  ⑤ 跨进程收尾:台账里没有、但 git 注册表里还在的隔离区,凭 name 也能回收。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

// 类型面走 `import type`(门 99 的 consistent-type-imports 禁内联 import() 类型注解)
import type * as HooksModule from '../src/hooks/index.js'
import type * as ChildProcessModule from 'node:child_process'

const runHookSpy = vi.hoisted(() => vi.fn())

vi.mock('../src/hooks/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof HooksModule>()
  return { ...actual, runHook: runHookSpy }
})

interface FakeWorktree {
  path: string
  branch: string
}

/**
 * git 桩的共享状态。`log` 按发生顺序记录每条命令,`dir-removed` 是 `worktree remove` 的
 * 副作用标记 —— "先让目录消失再 prune" 就靠这两条在日志里的先后 + `pruneDirStillThere` 判。
 */
const fake = vi.hoisted(() => ({
  worktrees: [] as FakeWorktree[],
  /** merge-base --is-ancestor 退出码:0 已并入 / 1 未并入 / 其它 判不出 */
  mergedStatus: 0,
  /** git status --porcelain 的输出(空 = 干净) */
  statusOutput: '',
  /** 本用例关注的隔离区绝对路径(prune 那一刻量它在不在) */
  watchedPath: '',
  /** prune 执行那一刻 watchedPath 是否还在(null = 还没执行过 prune) */
  pruneDirStillThere: null as boolean | null,
  log: [] as string[],
}))

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>()
  const spawnSync = (cmd: string, args: string[]) => {
    fake.log.push(`${cmd} ${args.join(' ')}`)
    const reply = (status: number, stdout = '') => ({ status, stdout, stderr: '', pid: 1, output: [], signal: null })
    if (cmd !== 'git') return reply(0)
    const [sub, verb] = args
    if (sub === 'rev-parse') return reply(0, 'deadbeefdeadbeef')
    if (sub === 'worktree' && verb === 'add') {
      // worktree add -b <branch> <path> <startPoint>
      const branch = args[3] ?? ''
      const wtPath = args[4] ?? ''
      fs.mkdirSync(wtPath, { recursive: true })
      fake.worktrees.push({ path: wtPath, branch })
      return reply(0)
    }
    if (sub === 'worktree' && verb === 'list') {
      return reply(
        0,
        fake.worktrees.map((w) => `worktree ${w.path}\nbranch refs/heads/${w.branch}\n`).join(''),
      )
    }
    if (sub === 'worktree' && verb === 'remove') {
      const wtPath = args[2] ?? ''
      fs.rmSync(wtPath, { recursive: true, force: true })
      const idx = fake.worktrees.findIndex((w) => w.path === wtPath)
      if (idx >= 0) fake.worktrees.splice(idx, 1)
      fake.log.push('dir-removed')
      return reply(0)
    }
    if (sub === 'worktree' && verb === 'prune') {
      fake.pruneDirStillThere = fs.existsSync(fake.watchedPath)
      return reply(0)
    }
    if (sub === 'merge-base') return reply(fake.mergedStatus)
    if (sub === '-C') {
      // -C <path> status --porcelain
      return args[2] === 'status' ? reply(0, fake.statusOutput) : reply(0)
    }
    return reply(0)
  }
  return { ...actual, spawnSync }
})

type ExecTool = { execute: (args: Record<string, unknown>, ctx: { workspacePath: string }) => Promise<{ success: boolean; output: string; error?: string }> }

let tmpDir = ''
let stdoutBuf = ''
let stderrBuf = ''
let origStdoutWrite: typeof process.stdout.write
let origStderrWrite: typeof process.stderr.write

function ctx(): { workspacePath: string } {
  return { workspacePath: tmpDir }
}

function wtPathOf(name: string): string {
  return path.join(tmpDir, '.worktrees', name)
}

function callOf(event: string): { event: string; ctx: Record<string, unknown> } | undefined {
  const hit = runHookSpy.mock.calls.find(([e]) => e === event)
  return hit ? { event: hit[0] as string, ctx: (hit[1] ?? {}) as Record<string, unknown> } : undefined
}

async function loadTools(): Promise<{ enter: ExecTool; exit: ExecTool }> {
  const mod = await import('../src/tools/worktree.js')
  return {
    enter: mod.enterWorktreeTool as unknown as ExecTool,
    exit: mod.exitWorktreeTool as unknown as ExecTool,
  }
}

beforeEach(() => {
  runHookSpy.mockReset()
  runHookSpy.mockImplementation(() => Promise.resolve({ proceed: true }))
  fake.worktrees.length = 0
  fake.mergedStatus = 0
  fake.statusOutput = ''
  fake.watchedPath = ''
  fake.pruneDirStillThere = null
  fake.log.length = 0
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-wt-session-'))
  stdoutBuf = ''
  stderrBuf = ''
  origStdoutWrite = process.stdout.write
  origStderrWrite = process.stderr.write
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutBuf += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8')
    return true
  }) as typeof process.stdout.write
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrBuf += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8')
    return true
  }) as typeof process.stderr.write
})

afterEach(() => {
  process.stdout.write = origStdoutWrite
  process.stderr.write = origStderrWrite
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('enter_worktree —— 创建与出声', () => {
  it('① 创建后目录存在、返回隔离区绝对路径,并派发一次 worktreeCreate(载荷带 name/path/branch)', async () => {
    const { enter } = await loadTools()
    const res = await enter.execute({ name: 'wt-enter' }, ctx())

    expect(res.success).toBe(true)
    const wtPath = wtPathOf('wt-enter')
    expect(fs.existsSync(wtPath)).toBe(true)
    expect(res.output).toContain(wtPath)

    await vi.waitFor(() => expect(callOf('worktreeCreate')).toBeDefined())
    const call = callOf('worktreeCreate')
    expect(call?.ctx.worktreeName).toBe('wt-enter')
    expect(call?.ctx.worktreePath).toBe(wtPath)
    expect(String(call?.ctx.worktreeBranch)).toMatch(/^agent-wt-/)
    // 创建档不该带 forced(那是回收档字段)
    expect('worktreeForced' in (call?.ctx ?? {})).toBe(false)
  })

  it('② 同一会话同名重复进入被拒(不覆盖既有隔离区)', async () => {
    const { enter } = await loadTools()
    expect((await enter.execute({ name: 'wt-dup' }, ctx())).success).toBe(true)
    const again = await enter.execute({ name: 'wt-dup' }, ctx())
    expect(again.success).toBe(false)
    expect(again.error).toContain('已进入隔离区')
  })
})

describe('exit_worktree —— 先让目录消失,再 prune', () => {
  it('③ 回收后目录消失、注册表条目被 prune 摘掉,且 prune 发生在目录消失之后', async () => {
    const { enter, exit } = await loadTools()
    await enter.execute({ name: 'wt-exit' }, ctx())
    const wtPath = wtPathOf('wt-exit')
    fake.watchedPath = wtPath
    runHookSpy.mockClear()

    const res = await exit.execute({}, ctx()) // 不传 name:走本会话台账

    expect(res.success).toBe(true)
    expect(fs.existsSync(wtPath)).toBe(false)
    expect(fake.worktrees.some((w) => w.path === wtPath)).toBe(false)

    const removeIdx = fake.log.findIndex((l) => l.includes('worktree remove'))
    const goneIdx = fake.log.indexOf('dir-removed')
    const pruneIdx = fake.log.findIndex((l) => l.includes('worktree prune'))
    expect(removeIdx).toBeGreaterThanOrEqual(0)
    expect(goneIdx).toBeGreaterThan(removeIdx)
    expect(pruneIdx).toBeGreaterThan(goneIdx)
    // prune 那一刻目录必须已经不在了(§12h:先让目录真消失,再摘注册表)
    expect(fake.pruneDirStillThere).toBe(false)
    // 回收连带删 agent-wt-* 分支
    expect(fake.log.some((l) => l.includes('branch -D agent-wt-'))).toBe(true)

    await vi.waitFor(() => expect(callOf('worktreeRemove')).toBeDefined())
    expect(callOf('worktreeRemove')?.ctx.worktreePath).toBe(wtPath)
    expect(callOf('worktreeRemove')?.ctx.worktreeForced).toBe(false)
  })

  it('④ 分支未并入 HEAD ⇒ 默认拒删:目录保留、不调 remove、不派发 worktreeRemove', async () => {
    const { enter, exit } = await loadTools()
    await enter.execute({ name: 'wt-unmerged' }, ctx())
    const wtPath = wtPathOf('wt-unmerged')
    fake.mergedStatus = 1 // 未并入
    runHookSpy.mockClear()

    const res = await exit.execute({}, ctx())

    expect(res.success).toBe(false)
    expect(res.error).toContain('未并入')
    expect(fs.existsSync(wtPath)).toBe(true)
    expect(fake.log.some((l) => l.includes('worktree remove'))).toBe(false)
    expect(fake.log.some((l) => l.includes('worktree prune'))).toBe(false)
    expect(callOf('worktreeRemove')).toBeUndefined()
  })

  it('⑤ 并入状态判不出(merge-base 异常)⇒ 同样拒删:未判定不猜', async () => {
    const { enter, exit } = await loadTools()
    await enter.execute({ name: 'wt-unknown' }, ctx())
    const wtPath = wtPathOf('wt-unknown')
    fake.mergedStatus = 128 // 判不出
    runHookSpy.mockClear()

    const res = await exit.execute({}, ctx())

    expect(res.success).toBe(false)
    expect(res.error).toContain('未能判定')
    expect(fs.existsSync(wtPath)).toBe(true)
    expect(fake.log.some((l) => l.includes('worktree remove'))).toBe(false)
  })

  it('⑥ 隔离区有未提交改动 ⇒ 拒删;force=true 越过并如实标注 forced', async () => {
    const { enter, exit } = await loadTools()
    await enter.execute({ name: 'wt-dirty' }, ctx())
    const wtPath = wtPathOf('wt-dirty')
    fake.watchedPath = wtPath
    fake.statusOutput = ' M notes.txt\n'
    runHookSpy.mockClear()

    const refused = await exit.execute({}, ctx())
    expect(refused.success).toBe(false)
    expect(refused.error).toContain('未提交改动')
    expect(fs.existsSync(wtPath)).toBe(true)
    expect(callOf('worktreeRemove')).toBeUndefined()

    const forced = await exit.execute({ force: true }, ctx())
    expect(forced.success).toBe(true)
    expect(fs.existsSync(wtPath)).toBe(false)
    expect(fake.log.some((l) => l.includes('worktree remove') && l.includes('--force'))).toBe(true)

    await vi.waitFor(() => expect(callOf('worktreeRemove')).toBeDefined())
    expect(callOf('worktreeRemove')?.ctx.worktreeForced).toBe(true)
  })

  it('⑦ 台账没有、但 git 注册表里还在的隔离区:凭 name 也能回收(跨进程收尾)', async () => {
    const { exit } = await loadTools()
    const wtPath = wtPathOf('wt-orphan')
    fs.mkdirSync(wtPath, { recursive: true })
    fake.worktrees.push({ path: wtPath, branch: 'agent-wt-deadbeef' })
    fake.watchedPath = wtPath

    const res = await exit.execute({ name: 'wt-orphan' }, ctx())

    expect(res.success).toBe(true)
    expect(fs.existsSync(wtPath)).toBe(false)
    expect(fake.pruneDirStillThere).toBe(false)
  })
})

describe('钩子派发纪律 —— fail-open 但不污染 stdout', () => {
  it('⑧ 钩子体抛错:落 [worktree] stderr,创建仍成功,stdout 一字节不写', async () => {
    const { enter } = await loadTools()
    runHookSpy.mockImplementation(() => Promise.reject(new Error('hook boom')))

    const res = await enter.execute({ name: 'wt-hook-boom' }, ctx())

    expect(res.success).toBe(true)
    await vi.waitFor(() => expect(stderrBuf).toContain('[worktree] worktreeCreate hook threw'))
    expect(stderrBuf).toContain('hook boom')
    expect(stdoutBuf).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
