// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterEach, vi } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type * as ChildProcessModule from 'node:child_process'
import type * as HooksModule from '../src/hooks/index.js'
import type * as AttributionModule from '../src/commands/ai-attribution.js'

import { execGitStatus } from '../src/plugins/git-runner.js'
import { GIT_TOOLS } from '../src/tools/git.js'
import { rememberCommittedFiles } from '../src/commands/ai-attribution.js'

/**
 * F-021 回归:git 默认 core.quotepath=true 会把中文/特殊字符路径输出成 "\346\212\245…"
 * 八进制转义,导致 ①归属回填错路径 ②折叠根 endsWith('/') 失效 ③按路径提交落空。
 *
 * 选型:两处都只加 `-c core.quotepath=false`,不换 `-z` —— 现有消费面(runner 的 status 分行、
 * git.ts 的 diff-tree split('\n'))按换行解析,-z 会把分隔符改成 NUL,得同步重写解析。
 *
 * truth1/truth2 走真 git 派生(temp 仓);truth3 用挂起的 spawnSync 只锁 argv 契约 ——
 * 该处名为"提交"的真实写操作,测试不得在仓里或临时仓里替它决定,argv + 回填入参已足以锁回归。
 */

vi.mock('../src/hooks/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof HooksModule>()
  return {
    ...actual,
    runPreToolCall: vi.fn(async () => ({ proceed: true, terminal: 'succeeded', feedback: '' })),
    runPostToolCall: vi.fn(async () => ({ proceed: true, terminal: 'succeeded', feedback: '' })),
  }
})

vi.mock('../src/commands/ai-attribution.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AttributionModule>()
  return { ...actual, rememberCommittedFiles: vi.fn(async () => {}) }
})

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>()
  return { ...actual, spawnSync: vi.fn() }
})

const created: string[] = []

/** 在 TEMP 下造一个已 git init 的临时仓(F-020 同款落点;每个用例结束即删) */
function mkRepo(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  created.push(dir)
  execFileSync(
    'git',
    ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', '-C', dir, 'init', '-q'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return dir
}

afterEach(() => {
  vi.clearAllMocks()
  for (const dir of created.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* 临时目录清理失败不干扰断言 */
    }
  }
})

const OCTAL_ESCAPE = /\\[0-7]{3}/

describe('F-021 git status 不得把中文路径转义成八进制序列', () => {
  it('全档:未跟踪的中文文件名按原始 UTF-8 返回', () => {
    const dir = mkRepo('ihui-f021-status-')
    writeFileSync(join(dir, '报告-最终.txt'), 'x\n')

    const out = execGitStatus(dir, { maxBufferBytes: 20 * 1024 * 1024, warn: () => {} })
    const text = out.lines.join('\n')

    expect(text).toContain('报告-最终.txt')
    expect(text).not.toMatch(OCTAL_ESCAPE)
  })

  it('折叠档:中文目录根仍是 `…/` 形态(endsWith("/") 不再失效)', () => {
    const dir = mkRepo('ihui-f021-collapse-')
    const sub = join(dir, '报告目录')
    mkdirSync(sub, { recursive: true })
    for (let i = 0; i < 16; i++) writeFileSync(join(sub, `文件编号${i}.txt`), 'padding\n')

    const warns: string[] = []
    // 全档 ≈ 560B、折叠档 ≈ 16B ⇒ 250B 上限必然触发降级而不是双双超限
    const out = execGitStatus(dir, { maxBufferBytes: 250, warn: (m) => { warns.push(m) } })

    expect(out.degraded).toBe(true)
    expect(out.collapsedUntrackedRoots.length).toBe(1)
    expect(out.collapsedUntrackedRoots[0]?.endsWith('报告目录/')).toBe(true)
    expect(out.collapsedUntrackedRoots[0]?.endsWith('/')).toBe(true)
    expect(warns.length).toBe(1)
  })
})

describe('F-021 git_commit 的 diff-tree 必须带 -c core.quotepath=false', () => {
  it('argv 带 quotepath=false,且归属回填拿到原始中文路径', async () => {
    const dir = mkRepo('ihui-f021-commit-')
    const calls: string[][] = []
    vi.mocked(spawnSync).mockImplementation(((binary: string, args: readonly string[]) => {
      calls.push([...args])
      if (args[0] === 'rev-parse') return okResult('abc123\n')
      if (args.includes('diff-tree')) return okResult('报告-最终.txt\n')
      return okResult('')
    }) as unknown as typeof spawnSync)

    const tool = GIT_TOOLS.find((t) => t.name === 'git_commit')
    if (!tool) throw new Error('git_commit 工具未注册')

    const r = await tool.execute({ message: 'F-021' }, { workspacePath: dir })

    expect(r.success).toBe(true)
    const diffTreeArgv = calls.find((a) => a.includes('diff-tree')) ?? []
    expect(diffTreeArgv.slice(0, 3)).toEqual(['-c', 'core.quotepath=false', 'diff-tree'])
    expect(vi.mocked(rememberCommittedFiles)).toHaveBeenCalledWith('abc123', ['报告-最终.txt'])
  })
})

/** spawnSync 成功档的最小返回面(execGit 只读 stdout/stderr/status/error) */
function okResult(stdout: string): ReturnType<typeof spawnSync> {
  return {
    pid: 1,
    output: [null, stdout, ''],
    stdout,
    stderr: '',
    status: 0,
    signal: null,
  } as unknown as ReturnType<typeof spawnSync>
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
