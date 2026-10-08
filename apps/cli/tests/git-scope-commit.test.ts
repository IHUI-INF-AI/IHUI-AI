// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ToolResult } from '../src/tools/index.js'

/**
 * 票 07-B 端到端:按范围提交必须走临时索引,禁止整体替换真实索引。
 *
 * 逐条对应验收草案:
 *  0. git_commit 现已支持 pathspec 范围入参(paths)
 *  1/2. 临时仓 a.txt/b.txt 都 add 后只以 ["a.txt"] 提交:
 *       (a) 新 commit 只含 a.txt
 *       (b) 真实索引仍含 b.txt(未被吞)
 *       (c) 真实索引文件被 reset 触碰(mtime 变化),但提交内容不是"整个暂存区"
 *       (d) GIT_INDEX_FILE 只在子进程 env,父进程不动
 *  3. rename 回归:git mv c.txt d.txt 后以 ["d.txt"] 提交 ⇒ 提交同时带 c.txt 的删除
 */

// 病会话 EBUSY 修复:不喂 stdin 的派生一律 ignore 两态(见 .workbuddy/skills/ihui-spawn-ebusy-fix)
function git(dir: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

function expectOk(dir: string, args: string[]): string {
  const r = git(dir, args)
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败: ${r.stderr}`)
  return r.stdout
}

const tmpRoots: string[] = []
function makeRepoWithStaged(a: string, b: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-git-scope-'))
  tmpRoots.push(dir)
  expectOk(dir, ['init', '-q'])
  expectOk(dir, ['config', 'user.email', 'test@example.com'])
  expectOk(dir, ['config', 'user.name', 'test'])
  expectOk(dir, ['config', 'commit.gpgsign', 'false'])
  writeFileSync(join(dir, a), `${a} content v1\n`)
  writeFileSync(join(dir, b), `${b} content v1\n`)
  expectOk(dir, ['add', a, b])
  return dir
}

afterAll(() => {
  for (const dir of tmpRoots) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* 临时目录清理失败不干扰断言 */
    }
  }
})

/** 直接调 git_commit 工具的 execute(钩子 runPreToolCall 在测试环境按默认放行)。 */
async function callGitCommit(args: Record<string, unknown>, workspacePath: string): Promise<ToolResult> {
  const { GIT_TOOLS } = await import('../src/tools/git.js')
  const tool = GIT_TOOLS.find((t) => t.name === 'git_commit')
  if (!tool) throw new Error('git_commit 工具不存在')
  return tool.execute(args, { workspacePath }) as Promise<ToolResult>
}

describe('票 07-B:临时索引范围提交', () => {
  it('(a)(b)(c)(d) 只提交 a.txt:b.txt 留在真实索引;父进程 env 无 GIT_INDEX_FILE', async () => {
    const dir = makeRepoWithStaged('a.txt', 'b.txt')
    const indexFile = join(dir, '.git', 'index')
    const parentEnvHasProbe = process.env.GIT_INDEX_FILE
    expect(parentEnvHasProbe).toBeUndefined()

    const beforeMtime = statSync(indexFile).mtimeMs
    const result = await callGitCommit({ message: 'feat: a', paths: ['a.txt'] }, dir)
    expect(result.success).toBe(true)

    // (a) 新 commit 只含 a.txt
    const tree = expectOk(dir, ['ls-tree', '-r', '--name-only', 'HEAD'])
    expect(tree).toContain('a.txt')
    expect(tree).not.toContain('b.txt')

    // (b) 真实索引仍含 b.txt(未被吞);a.txt 已被 reset 对齐 HEAD
    const cached = expectOk(dir, ['diff', '--cached', '--name-only'])
    expect(cached).toContain('b.txt')
    expect(cached).not.toContain('a.txt')

    // (c) 真实索引被触碰(mtime 变化)—— reset --quiet HEAD -- a.txt 会改写共享索引
    const afterMtime = statSync(indexFile).mtimeMs
    expect(afterMtime).not.toBe(beforeMtime)

    // (d) 父进程 env 从未被写入 GIT_INDEX_FILE
    expect(process.env.GIT_INDEX_FILE).toBeUndefined()
  })

  it('rename 回归:git mv c.txt d.txt 后以 ["d.txt"] 提交 ⇒ 同时带 c.txt 的删除', async () => {
    // d.txt 此刻必须不存在(git mv 目标不能已存在)
    const dir = makeRepoWithStaged('c.txt', 'z-unrelated.txt')
    // 先落一版基线,再做 staged rename
    expectOk(dir, ['commit', '-q', '-m', 'baseline'])
    expectOk(dir, ['mv', 'c.txt', 'd.txt']) // git mv:工作区改名 + 索引记录 rename
    expectOk(dir, ['add', 'd.txt'])

    const result = await callGitCommit({ message: 'feat: rename', paths: ['d.txt'] }, dir)
    expect(result.success).toBe(true)

    // 新提交同时含 d.txt(新增形态)与 c.txt(删除):ls-tree 只有 d.txt
    const tree = expectOk(dir, ['ls-tree', '-r', '--name-only', 'HEAD'])
    expect(tree).toContain('d.txt')
    expect(tree).not.toContain('c.txt')
    // 内容形态对齐:rename 提交里 c.txt → d.txt
    const show = expectOk(dir, ['diff-tree', '-r', '--name-status', '--no-commit-id', 'HEAD'])
    expect(show).toMatch(/D\s+c\.txt/)
    expect(show).toMatch(/A\s+d\.txt/)
  })

  it('范围内存在未解决冲突(stage≠0) ⇒ 拒绝提交且不动真实索引', async () => {
    const dir = makeRepoWithStaged('conflict.txt', 'other.txt')
    // 造一个冲突:两条 commit 改同一文件,merge 复现冲突
    expectOk(dir, ['commit', '-q', '-m', 'base conflict'])
    expectOk(dir, ['checkout', '-q', '-b', 'side'])
    writeFileSync(join(dir, 'conflict.txt'), 'side version\n')
    expectOk(dir, ['commit', '-q', '-am', 'side'])
    expectOk(dir, ['checkout', '-q', 'master'])
    writeFileSync(join(dir, 'conflict.txt'), 'main version\n')
    expectOk(dir, ['commit', '-q', '-am', 'main'])
    const merge = git(dir, ['merge', 'side'])
    expect(merge.status).not.toBe(0) // 冲突

    const result = await callGitCommit({ message: 'should fail', paths: ['conflict.txt'] }, dir)
    expect(result.success).toBe(false)
    expect(result.error).toContain('未解决冲突')
  })

  it('范围内没有任何已暂存文件 ⇒ 明确拒绝,不产出空提交', async () => {
    const dir = makeRepoWithStaged('x.txt', 'y.txt')
    const result = await callGitCommit({ message: 'empty', paths: ['never-added.txt'] }, dir)
    expect(result.success).toBe(false)
    expect(result.error).toContain('没有任何已暂存文件')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠