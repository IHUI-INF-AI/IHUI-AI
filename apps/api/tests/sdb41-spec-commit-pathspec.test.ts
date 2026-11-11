// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-41:spec 流水线自动提交必须带 pathspec。
 *
 * 修复前 `git commit -m ...` 不带 `-- <file>`,会把用户仓库 index 里其它已暂存改动
 * (别的会话/他人的业务改动)一并裹进 `chore(spec)` 提交。本档用间谍替换
 * `node:child_process.spawnSync`,只观察参数,不执行任何真实 git 写操作。
 */
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpecScope } from '@ihui/shared'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-with-enough-length'
})

const spawnSyncMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]) => spawnSyncMock(...args),
  default: { spawnSync: (...args: unknown[]) => spawnSyncMock(...args) },
}))

// 登记根闸与本缺陷无关,直接放行入参,聚焦 git 参数。
vi.mock('../src/utils/workspace-roots.js', () => ({
  assertWithinRegisteredRoots: (p: string) => p,
}))

import { specService } from '../src/services/spec-service.js'

const scope: SpecScope = { type: 'workspace' }

/** 与服务内 computeScopeHash 同源,用于算出本轮 spec 相对路径。 */
function scopeHash(): string {
  const scopeObj = { type: scope.type, path: scope.path ?? null }
  return createHash('md5')
    .update(JSON.stringify(scopeObj, Object.keys(scopeObj).sort()), 'utf8')
    .digest('hex')
    .slice(0, 12)
}

function specRelPath(): string {
  return `.ihui-agent/specs/${scopeHash()}.md`
}

interface GitCall {
  args: string[]
}

let calls: GitCall[] = []
let workspace: string

function installGitMock(changedFiles: string[]): void {
  spawnSyncMock.mockImplementation((_bin: string, args: string[]) => {
    calls.push({ args })
    if (args[0] === 'diff') {
      // 模拟 git diff --cached --name-only -- <pathspec>:只回本流水线路径。
      return { status: 0, stdout: changedFiles.join('\n'), stderr: '' }
    }
    if (args[0] === 'rev-parse') {
      return { status: 0, stdout: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n', stderr: '' }
    }
    return { status: 0, stdout: '', stderr: '' }
  })
}

async function runPipeline(autoCommit = true) {
  return specService.runFullPipeline({
    workspacePath: workspace,
    scope,
    newSpec: '# spec body\n',
    autoCommit,
  })
}

function gitCall(verb: string): string[] | undefined {
  return calls.find((c) => c.args[0] === verb)?.args
}

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'ihui-sdb41-'))
  calls = []
  spawnSyncMock.mockReset()
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('SDB-41 spec 流水线 commit 限定 pathspec', () => {
  it('commit 参数末尾是 `--` + 精确文件清单,提交信息格式不变', async () => {
    installGitMock([specRelPath()])

    const result = await runPipeline()

    const commit = gitCall('commit')
    expect(commit).toBeDefined()
    expect(commit?.slice(0, 4)).toEqual([
      'commit',
      '--no-verify',
      '-m',
      `chore(spec): pipeline ${result.pipelineId} 更新 spec`,
    ])
    expect(commit?.slice(-2)).toEqual(['--', specRelPath()])
    expect(commit?.filter((a) => a === '--')).toHaveLength(1)
    expect(result.commitSha).toBe('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
    expect(result.stages.find((s) => s.name === 'commit')?.status).toBe('success')
  })

  it('清单外的已暂存文件不会进入 commit 参数', async () => {
    installGitMock([specRelPath()])

    await runPipeline()

    // 只暂存/只读取本流水线路径:add 无 `.`/`-A`,diff 也带同一 pathspec。
    expect(gitCall('add')).toEqual(['add', specRelPath()])
    const diff = gitCall('diff')
    expect(diff?.slice(diff.indexOf('--') + 1)).toEqual([specRelPath()])

    const commit = gitCall('commit') ?? []
    expect(commit).not.toContain('src/services/already-staged.ts')
    expect(commit).not.toContain('.')
    expect(commit).not.toContain('-A')
    expect(commit).not.toContain('--all')
    expect(commit.filter((a) => a.endsWith('.ts'))).toEqual([])
  })

  it('无变更时不调用 commit,按无变更跳过', async () => {
    installGitMock([])

    const result = await runPipeline()

    expect(gitCall('commit')).toBeUndefined()
    expect(gitCall('rev-parse')).toBeUndefined()
    const stage = result.stages.find((s) => s.name === 'commit')
    expect(stage?.status).toBe('skipped')
    expect(stage?.log).toContain('无变更')
    expect(result.commitSha).toBe('')
  })

  it('autoCommit=false 时同样不调用 commit(既有分支不回退)', async () => {
    installGitMock([specRelPath()])

    const result = await runPipeline(false)

    expect(gitCall('commit')).toBeUndefined()
    expect(result.stages.find((s) => s.name === 'commit')?.status).toBe('skipped')
  })
})
