// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P1-8 Fast Worktree CoW 模块测试。
 *
 * 覆盖:detectCowKind / copyFileCoW / copyTree / copyGitDir /
 *      createWorktree / removeWorktree / findGitRoot / isGitRepo / getGitDirKind
 *
 * 全部使用临时目录(os.tmpdir() + fs.mkdtempSync),测试后清理。
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  detectCowKind,
  resetCowCache,
  copyFileCoW,
  copyTree,
  copyGitDir,
  createWorktree,
  removeWorktree,
  findGitRoot,
  isGitRepo,
  getGitDirKind,
  type CowKind,
} from '../src/worktree.js'
// Worktree 并行隔离层(对标 Cursor 3.x 多并行 agent + worktree)
import {
  WorktreeManager,
  agentBranchName,
  AGENT_BRANCH_PREFIX,
  DEFAULT_WORKTREE_DIR,
  getDefaultWorktreeRoot,
  cleanupWorktree,
} from '../src/tools/worktree.js'

const VALID_KINDS: readonly CowKind[] = ['ficlone', 'clonefile', 'refs', 'none']

function gitInit(repoDir: string): void {
  spawnSync('git', ['init'], { cwd: repoDir, encoding: 'utf-8' })
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], {
    cwd: repoDir,
    encoding: 'utf-8',
  })
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir, encoding: 'utf-8' })
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], {
    cwd: repoDir,
    encoding: 'utf-8',
  })
}

function gitCommit(repoDir: string, msg: string): void {
  spawnSync('git', ['commit', '-m', msg], { cwd: repoDir, encoding: 'utf-8' })
}

// ============ detectCowKind ============

describe('detectCowKind', () => {
  beforeEach(() => {
    resetCowCache()
  })

  it('返回有效值之一,不抛异常', () => {
    const kind = detectCowKind(os.tmpdir())
    expect(VALID_KINDS).toContain(kind)
  })

  it('第二次调用返回缓存值(同一进程)', () => {
    const k1 = detectCowKind(os.tmpdir())
    const k2 = detectCowKind(os.tmpdir())
    expect(k1).toBe(k2)
  })

  it('不存在的路径不抛异常,返回有效值', () => {
    const kind = detectCowKind(path.join(os.tmpdir(), `ihui-nonexistent-${Date.now()}`))
    expect(VALID_KINDS).toContain(kind)
  })
})

// ============ copyFileCoW ============

describe('copyFileCoW', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cpfile-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('普通文件复制成功', () => {
    const src = path.join(tmpDir, 'src.txt')
    const dst = path.join(tmpDir, 'dst.txt')
    fs.writeFileSync(src, 'hello cow', 'utf-8')
    copyFileCoW(src, dst)
    expect(fs.existsSync(dst)).toBe(true)
    expect(fs.readFileSync(dst, 'utf-8')).toBe('hello cow')
  })

  it('目标权限与源一致(Linux/macOS 验证 mode,Windows 仅验证复制成功)', () => {
    const src = path.join(tmpDir, 'src.txt')
    const dst = path.join(tmpDir, 'dst.txt')
    fs.writeFileSync(src, 'perm', 'utf-8')
    if (process.platform !== 'win32') {
      fs.chmodSync(src, 0o640)
      copyFileCoW(src, dst)
      const srcMode = fs.statSync(src).mode & 0o777
      const dstMode = fs.statSync(dst).mode & 0o777
      expect(dstMode).toBe(srcMode)
    } else {
      // Windows:chmod 无实际效果,仅验证复制成功
      copyFileCoW(src, dst)
      expect(fs.readFileSync(dst, 'utf-8')).toBe('perm')
    }
  })

  it('src 不存在抛 ENOENT', () => {
    const src = path.join(tmpDir, 'missing.txt')
    const dst = path.join(tmpDir, 'dst.txt')
    expect(() => copyFileCoW(src, dst)).toThrowError(/ENOENT/)
  })
})

// ============ copyTree ============

describe('copyTree', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cptree-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('多文件目录复制', async () => {
    const src = path.join(tmpDir, 'src')
    const dst = path.join(tmpDir, 'dst')
    fs.mkdirSync(src, { recursive: true })
    fs.writeFileSync(path.join(src, 'a.txt'), 'a', 'utf-8')
    fs.writeFileSync(path.join(src, 'b.txt'), 'b', 'utf-8')

    const stats = await copyTree(src, dst)
    expect(stats.files).toBe(2)
    expect(stats.dirs).toBeGreaterThanOrEqual(1)
    expect(fs.readFileSync(path.join(dst, 'a.txt'), 'utf-8')).toBe('a')
    expect(fs.readFileSync(path.join(dst, 'b.txt'), 'utf-8')).toBe('b')
  })

  it('子目录递归', async () => {
    const src = path.join(tmpDir, 'src')
    const dst = path.join(tmpDir, 'dst')
    fs.mkdirSync(path.join(src, 'sub', 'deep'), { recursive: true })
    fs.writeFileSync(path.join(src, 'root.txt'), 'r', 'utf-8')
    fs.writeFileSync(path.join(src, 'sub', 'mid.txt'), 'm', 'utf-8')
    fs.writeFileSync(path.join(src, 'sub', 'deep', 'leaf.txt'), 'l', 'utf-8')

    const stats = await copyTree(src, dst)
    expect(stats.files).toBe(3)
    expect(stats.dirs).toBeGreaterThanOrEqual(3)
    expect(fs.readFileSync(path.join(dst, 'sub', 'deep', 'leaf.txt'), 'utf-8')).toBe('l')
  })

  it('skip 文件按文件名跳过', async () => {
    const src = path.join(tmpDir, 'src')
    const dst = path.join(tmpDir, 'dst')
    fs.mkdirSync(src, { recursive: true })
    fs.writeFileSync(path.join(src, 'keep.txt'), 'k', 'utf-8')
    fs.writeFileSync(path.join(src, 'skip.txt'), 's', 'utf-8')

    const stats = await copyTree(src, dst, { skip: new Set(['skip.txt']) })
    expect(stats.files).toBe(1)
    expect(fs.existsSync(path.join(dst, 'keep.txt'))).toBe(true)
    expect(fs.existsSync(path.join(dst, 'skip.txt'))).toBe(false)
  })

  it('symlink 处理(Linux/macOS 创建 symlink,Windows 复制目标)', async () => {
    const src = path.join(tmpDir, 'src')
    const dst = path.join(tmpDir, 'dst')
    fs.mkdirSync(src, { recursive: true })
    fs.writeFileSync(path.join(src, 'target.txt'), 'target', 'utf-8')

    // 创建 symlink(Windows 可能需要管理员/开发者模式,失败则跳过本测试)
    const linkPath = path.join(src, 'link.txt')
    try {
      fs.symlinkSync('target.txt', linkPath)
    } catch {
      // Windows 无权限创建 symlink → 跳过本测试
      return
    }

    const stats = await copyTree(src, dst)
    if (process.platform === 'win32') {
      // Windows:复制目标文件内容
      expect(fs.existsSync(path.join(dst, 'link.txt'))).toBe(true)
      expect(fs.readFileSync(path.join(dst, 'link.txt'), 'utf-8')).toBe('target')
    } else {
      // Linux/macOS:创建 symlink
      expect(stats.symlinks).toBe(1)
      const target = fs.readlinkSync(path.join(dst, 'link.txt'))
      expect(target).toBe('target.txt')
    }
  })
})

// ============ copyGitDir ============

describe('copyGitDir', () => {
  let tmpDir: string
  let srcGit: string
  let dstGit: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cpgit-'))
    srcGit = path.join(tmpDir, 'src.git')
    dstGit = path.join(tmpDir, 'dst.git')
    fs.mkdirSync(srcGit, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('正常 .git 复制', async () => {
    fs.writeFileSync(path.join(srcGit, 'HEAD'), 'ref: refs/heads/main\n', 'utf-8')
    fs.mkdirSync(path.join(srcGit, 'refs', 'heads'), { recursive: true })
    fs.writeFileSync(path.join(srcGit, 'refs', 'heads', 'main'), 'abc123\n', 'utf-8')

    const stats = await copyGitDir(srcGit, dstGit)
    expect(stats.copiedFiles).toBeGreaterThanOrEqual(2)
    expect(fs.readFileSync(path.join(dstGit, 'HEAD'), 'utf-8')).toBe('ref: refs/heads/main\n')
    expect(fs.readFileSync(path.join(dstGit, 'refs', 'heads', 'main'), 'utf-8')).toBe(
      'abc123\n',
    )
  })

  it('lock 文件(*.lock)跳过', async () => {
    fs.writeFileSync(path.join(srcGit, 'HEAD'), 'ref: refs/heads/main\n', 'utf-8')
    fs.writeFileSync(path.join(srcGit, 'index.lock'), 'lock', 'utf-8')

    const stats = await copyGitDir(srcGit, dstGit)
    expect(stats.skippedFiles).toBeGreaterThanOrEqual(1)
    expect(fs.existsSync(path.join(dstGit, 'index.lock'))).toBe(false)
    expect(fs.existsSync(path.join(dstGit, 'HEAD'))).toBe(true)
  })

  it('worktrees/ 目录跳过', async () => {
    fs.writeFileSync(path.join(srcGit, 'HEAD'), 'ref: refs/heads/main\n', 'utf-8')
    fs.mkdirSync(path.join(srcGit, 'worktrees', 'wt-1'), { recursive: true })
    fs.writeFileSync(path.join(srcGit, 'worktrees', 'wt-1', 'HEAD'), 'deadbeef\n', 'utf-8')

    const stats = await copyGitDir(srcGit, dstGit)
    expect(stats.skippedFiles).toBeGreaterThanOrEqual(1)
    expect(fs.existsSync(path.join(dstGit, 'worktrees'))).toBe(false)
  })

  it('MERGE_HEAD 跳过', async () => {
    fs.writeFileSync(path.join(srcGit, 'HEAD'), 'ref: refs/heads/main\n', 'utf-8')
    fs.writeFileSync(path.join(srcGit, 'MERGE_HEAD'), 'merge\n', 'utf-8')

    const stats = await copyGitDir(srcGit, dstGit)
    expect(stats.skippedFiles).toBeGreaterThanOrEqual(1)
    expect(fs.existsSync(path.join(dstGit, 'MERGE_HEAD'))).toBe(false)
  })

  it('rebase-apply/ 目录跳过', async () => {
    fs.writeFileSync(path.join(srcGit, 'HEAD'), 'ref: refs/heads/main\n', 'utf-8')
    fs.mkdirSync(path.join(srcGit, 'rebase-apply'), { recursive: true })
    fs.writeFileSync(path.join(srcGit, 'rebase-apply', '0001'), 'patch', 'utf-8')

    const stats = await copyGitDir(srcGit, dstGit)
    expect(stats.skippedFiles).toBeGreaterThanOrEqual(1)
    expect(fs.existsSync(path.join(dstGit, 'rebase-apply'))).toBe(false)
  })

  it('fsmonitor--daemon* 文件跳过', async () => {
    fs.writeFileSync(path.join(srcGit, 'HEAD'), 'ref: refs/heads/main\n', 'utf-8')
    fs.writeFileSync(path.join(srcGit, 'fsmonitor--daemon.state'), 'fsm', 'utf-8')

    const stats = await copyGitDir(srcGit, dstGit)
    expect(stats.skippedFiles).toBeGreaterThanOrEqual(1)
    expect(fs.existsSync(path.join(dstGit, 'fsmonitor--daemon.state'))).toBe(false)
  })
})

// ============ createWorktree ============

describe('createWorktree', () => {
  let tmpDir: string
  let sourceRepo: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-wt-create-'))
    sourceRepo = path.join(tmpDir, 'source')
    fs.mkdirSync(sourceRepo, { recursive: true })
    gitInit(sourceRepo)
    fs.writeFileSync(path.join(sourceRepo, 'README.md'), 'hello\n', 'utf-8')
    spawnSync('git', ['add', '.'], { cwd: sourceRepo, encoding: 'utf-8' })
    gitCommit(sourceRepo, 'init')
    resetCowCache()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('基本流程成功', async () => {
    const dst = path.join(tmpDir, 'wt-1')
    const result = await createWorktree({ source: sourceRepo, destination: dst })

    expect(result.destination).toBe(dst)
    expect(fs.existsSync(path.join(dst, 'README.md'))).toBe(true)
    expect(fs.readFileSync(path.join(dst, 'README.md'), 'utf-8').replace(/\r\n/g, '\n')).toBe('hello\n')
    expect(fs.existsSync(path.join(dst, '.git'))).toBe(true)
    expect(fs.existsSync(path.join(dst, '.git', 'ihui-worktree-source'))).toBe(true)
    expect(result.gitDirKind).toBe('directory')
    expect(result.copyStats.files).toBeGreaterThanOrEqual(1)
    expect(result.gitDirStats.copiedFiles).toBeGreaterThanOrEqual(1)
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it('destination 已存在非空抛错', async () => {
    const dst = path.join(tmpDir, 'wt-2')
    fs.mkdirSync(dst, { recursive: true })
    fs.writeFileSync(path.join(dst, 'blocker.txt'), 'x', 'utf-8')

    await expect(createWorktree({ source: sourceRepo, destination: dst })).rejects.toThrow(
      /非空|exists|empty/i,
    )
  })

  it('source 非 git 仓库抛错', async () => {
    const nonGit = path.join(tmpDir, 'notgit')
    fs.mkdirSync(nonGit, { recursive: true })
    const dst = path.join(tmpDir, 'wt-3')

    await expect(createWorktree({ source: nonGit, destination: dst })).rejects.toThrow(
      /git|\.git/i,
    )
  })

  it('ref checkout 切到指定分支', async () => {
    // 创建 feature-x 分支并提交一个新文件
    spawnSync('git', ['branch', 'feature-x'], { cwd: sourceRepo, encoding: 'utf-8' })
    spawnSync('git', ['checkout', 'feature-x'], { cwd: sourceRepo, encoding: 'utf-8' })
    fs.writeFileSync(path.join(sourceRepo, 'feature.txt'), 'f\n', 'utf-8')
    spawnSync('git', ['add', '.'], { cwd: sourceRepo, encoding: 'utf-8' })
    gitCommit(sourceRepo, 'feature')
    spawnSync('git', ['checkout', 'main'], { cwd: sourceRepo, encoding: 'utf-8' })

    const dst = path.join(tmpDir, 'wt-4')
    await createWorktree({ source: sourceRepo, destination: dst, ref: 'feature-x' })

    // 验证 destination 在 feature-x 分支
    const r = spawnSync('git', ['-C', dst, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf-8',
    })
    expect(r.status).toBe(0)
    expect((r.stdout ?? '').trim()).toBe('feature-x')
    expect(fs.existsSync(path.join(dst, 'feature.txt'))).toBe(true)
  })

  it('preserveWorkingTree=true 保留已跟踪文件的修改', async () => {
    // 修改已跟踪文件 README.md(未提交)
    fs.writeFileSync(path.join(sourceRepo, 'README.md'), 'modified\n', 'utf-8')

    const dst = path.join(tmpDir, 'wt-5')
    await createWorktree({
      source: sourceRepo,
      destination: dst,
      preserveWorkingTree: true,
    })

    // 未提交修改应保留
    expect(fs.readFileSync(path.join(dst, 'README.md'), 'utf-8')).toBe('modified\n')
  })

  it('preserveWorkingTree=false reset --hard 丢弃已跟踪文件的修改', async () => {
    // 修改已跟踪文件 README.md(未提交)
    fs.writeFileSync(path.join(sourceRepo, 'README.md'), 'modified\n', 'utf-8')

    const dst = path.join(tmpDir, 'wt-6')
    await createWorktree({
      source: sourceRepo,
      destination: dst,
      preserveWorkingTree: false,
    })

    // reset --hard 后 README.md 应恢复到 HEAD 版本
    // 注意:Windows 上 git core.autocrlf=true 会把 LF 转成 CRLF,故用 trim + 包含判断
    const content = fs.readFileSync(path.join(dst, 'README.md'), 'utf-8').replace(/\r\n/g, '\n')
    expect(content).toBe('hello\n')
  })
})

// ============ removeWorktree ============

describe('removeWorktree', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-wt-rm-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('standalone worktree 删除(.git 是目录)', async () => {
    const wt = path.join(tmpDir, 'standalone')
    fs.mkdirSync(path.join(wt, '.git'), { recursive: true })
    fs.writeFileSync(path.join(wt, 'file.txt'), 'x', 'utf-8')

    await removeWorktree(wt)
    expect(fs.existsSync(wt)).toBe(false)
  })

  it('linked worktree 调 git worktree remove', async () => {
    // 创建真实的 linked worktree
    const repo = path.join(tmpDir, 'repo')
    fs.mkdirSync(repo, { recursive: true })
    gitInit(repo)
    fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n', 'utf-8')
    spawnSync('git', ['add', '.'], { cwd: repo, encoding: 'utf-8' })
    gitCommit(repo, 'init')

    const linkedWt = path.join(tmpDir, 'linked-wt')
    const r = spawnSync('git', ['worktree', 'add', linkedWt], {
      cwd: repo,
      encoding: 'utf-8',
    })
    // 某些环境(如 CI 受限)可能不允许 worktree add,跳过测试
    if (r.status !== 0) return

    expect(fs.existsSync(linkedWt)).toBe(true)
    expect(fs.statSync(path.join(linkedWt, '.git')).isFile()).toBe(true)

    await removeWorktree(linkedWt)
    expect(fs.existsSync(linkedWt)).toBe(false)
  })

  it('不存在路径不抛错', async () => {
    const missing = path.join(tmpDir, 'never-existed')
    await expect(removeWorktree(missing)).resolves.toBeUndefined()
  })
})

// ============ findGitRoot ============

describe('findGitRoot', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-findroot-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('从子目录向上查找 .git', () => {
    const root = path.join(tmpDir, 'repo')
    fs.mkdirSync(path.join(root, 'a', 'b', 'c'), { recursive: true })
    fs.mkdirSync(path.join(root, '.git'), { recursive: true })

    const found = findGitRoot(path.join(root, 'a', 'b', 'c'))
    expect(found).toBe(path.resolve(root))
  })

  it('非 git 目录向上未找到 .git 时返回 undefined 或祖先仓库(非自身)', () => {
    // 使用 tmpdir 的子目录(通常 tmpdir 不在 git 仓库内)
    const dir = path.join(tmpDir, 'notgit')
    fs.mkdirSync(dir, { recursive: true })
    const found = findGitRoot(dir)
    // 若 tmpdir 恰好在某 git 仓库内,found 会是该仓库根;否则 undefined
    // 关键:dir 本身没有 .git,所以 found 不应等于 dir
    expect(found).not.toBe(path.resolve(dir))
  })
})

// ============ isGitRepo ============

describe('isGitRepo', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-isrepo-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('有 .git 目录返回 true', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true })
    expect(isGitRepo(tmpDir)).toBe(true)
  })

  it('无 .git 返回 false', () => {
    expect(isGitRepo(tmpDir)).toBe(false)
  })
})

// ============ getGitDirKind ============

describe('getGitDirKind', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-gitkind-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('.git 是目录 → directory', () => {
    const p = path.join(tmpDir, '.git')
    fs.mkdirSync(p, { recursive: true })
    expect(getGitDirKind(p)).toBe('directory')
  })

  it('.git 是文件 → file', () => {
    const p = path.join(tmpDir, '.git')
    fs.writeFileSync(p, 'gitdir: /somewhere\n', 'utf-8')
    expect(getGitDirKind(p)).toBe('file')
  })

  it('路径不存在默认 directory', () => {
    const p = path.join(tmpDir, 'missing')
    expect(getGitDirKind(p)).toBe('directory')
  })
})

// ============ WorktreeManager(并行隔离层) ============

/** 建一个带初始提交的测试仓库(WorktreeManager 专用) */
function initWorktreeRepo(tmpDir: string): string {
  const repo = path.join(tmpDir, 'repo')
  fs.mkdirSync(repo, { recursive: true })
  gitInit(repo)
  fs.writeFileSync(path.join(repo, 'README.md'), 'base\n', 'utf-8')
  spawnSync('git', ['add', '.'], { cwd: repo, encoding: 'utf-8' })
  gitCommit(repo, 'init')
  return repo
}

describe('WorktreeManager.create', () => {
  let tmpDir: string
  let repo: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-wtm-create-'))
    repo = initWorktreeRepo(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('基本流程:目录 .worktrees/<agent-id>,分支 agent-wt-<uuid8>', () => {
    const mgr = new WorktreeManager(repo)
    const wt = mgr.create('agent-1')

    expect(wt.agentId).toBe('agent-1')
    expect(wt.path).toBe(path.join(getDefaultWorktreeRoot(repo), 'agent-1'))
    expect(wt.branch.startsWith(AGENT_BRANCH_PREFIX)).toBe(true)
    expect(wt.branch.length).toBe(AGENT_BRANCH_PREFIX.length + 8)
    expect(fs.existsSync(path.join(wt.path, 'README.md'))).toBe(true)
    // .gitignore 自动写入 .worktrees/
    expect(fs.readFileSync(path.join(repo, '.gitignore'), 'utf-8')).toContain(DEFAULT_WORKTREE_DIR + '/')
    // 分支真实存在(git branch --list 对挂载在 worktree 的分支会加 "+" 前缀)
    const br = spawnSync('git', ['branch', '--list', wt.branch], { cwd: repo, encoding: 'utf-8' })
    expect((br.stdout ?? '').trim().replace(/^[+*]\s*/, '')).toBe(wt.branch)
  })

  it('同一 agentId 重复创建抛错', () => {
    const mgr = new WorktreeManager(repo)
    mgr.create('agent-dup')
    expect(() => mgr.create('agent-dup')).toThrowError(/已存在/)
  })

  it('并发创建多个 agent worktree 互不冲突(分支唯一 + 目录独立)', async () => {
    const mgr = new WorktreeManager(repo)
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => mgr.create(`agent-${i}`)),
    )
    const branches = results.map((r) => r.branch)
    expect(new Set(branches).size).toBe(5)
    for (const r of results) {
      expect(fs.existsSync(r.path)).toBe(true)
      expect(fs.existsSync(path.join(r.path, 'README.md'))).toBe(true)
    }
    expect(mgr.list().length).toBe(5)
  })

  it('list 按分支前缀过滤,只返回 agent-wt-* 条目', () => {
    const mgr = new WorktreeManager(repo)
    // 手工建一个非 agent 分支的 worktree(不应被 list 收录)
    spawnSync('git', ['worktree', 'add', path.join(tmpDir, 'plain-wt')], {
      cwd: repo,
      encoding: 'utf-8',
    })
    mgr.create('agent-ls')
    const list = mgr.list()
    expect(list.length).toBe(1)
    expect(list[0]!.agentId).toBe('agent-ls')
    expect(list[0]!.dirExists).toBe(true)
  })
})

describe('WorktreeManager.remove', () => {
  let tmpDir: string
  let repo: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-wtm-rm-'))
    repo = initWorktreeRepo(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('移除后目录删除 + 分支清理 + list 为空', () => {
    const mgr = new WorktreeManager(repo)
    const wt = mgr.create('agent-rm')
    // 在隔离目录里做修改,验证 --force 清理
    fs.writeFileSync(path.join(wt.path, 'dirty.txt'), 'x', 'utf-8')

    expect(mgr.remove('agent-rm', { force: true })).toBe(true)
    expect(fs.existsSync(wt.path)).toBe(false)
    expect(mgr.list().length).toBe(0)
    const br = spawnSync('git', ['branch', '--list', wt.branch], { cwd: repo, encoding: 'utf-8' })
    expect((br.stdout ?? '').trim()).toBe('')
  })

  it('路径本就不存在时返回 false 不抛错', () => {
    const mgr = new WorktreeManager(repo)
    expect(mgr.remove('never-created')).toBe(false)
  })
})

describe('WorktreeManager.diff', () => {
  let tmpDir: string
  let repo: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-wtm-diff-'))
    repo = initWorktreeRepo(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('输出隔离目录内的改动(含新文件),供主 agent 合并', () => {
    const mgr = new WorktreeManager(repo)
    const wt = mgr.create('agent-diff')
    fs.writeFileSync(path.join(wt.path, 'README.md'), 'modified by agent\n', 'utf-8')
    fs.writeFileSync(path.join(wt.path, 'new-file.txt'), 'brand new\n', 'utf-8')

    const d = mgr.diff('agent-diff')
    expect(d).toContain('README.md')
    expect(d).toContain('new-file.txt')
  })

  it('worktree 不存在时抛错', () => {
    const mgr = new WorktreeManager(repo)
    expect(() => mgr.diff('ghost')).toThrowError(/不存在/)
  })
})

describe('WorktreeManager.cleanupStale / prune(孤儿检测)', () => {
  let tmpDir: string
  let repo: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-wtm-stale-'))
    repo = initWorktreeRepo(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('目录被外部删除的孤儿 worktree 被检测并清理(含孤儿分支)', () => {
    const mgr = new WorktreeManager(repo)
    const wt1 = mgr.create('agent-alive')
    const wt2 = mgr.create('agent-orphan')

    // 模拟孤儿:绕过 git 直接删目录
    fs.rmSync(wt2.path, { recursive: true, force: true })

    // list 标记 dirExists=false
    const orphan = mgr.findByAgent('agent-orphan')
    expect(orphan).not.toBeNull()
    expect(orphan!.dirExists).toBe(false)

    const { pruned, branchesDeleted } = mgr.cleanupStale()
    expect(pruned).toBe(1)
    expect(branchesDeleted).toBe(1)

    // 孤儿清干净,存活 worktree 不受影响
    expect(mgr.list().map((e) => e.agentId)).toEqual(['agent-alive'])
    expect(fs.existsSync(wt1.path)).toBe(true)
  })

  it('prune 返回清理数量', () => {
    const mgr = new WorktreeManager(repo)
    const wt = mgr.create('agent-prune')
    fs.rmSync(wt.path, { recursive: true, force: true })
    expect(mgr.prune()).toBe(1)
    expect(mgr.list().length).toBe(0)
  })
})

describe('WorktreeManager 辅助函数', () => {
  it('agentBranchName 每次生成都唯一且带前缀', () => {
    const names = new Set(Array.from({ length: 50 }, () => agentBranchName()))
    expect(names.size).toBe(50)
    for (const n of names) {
      expect(n.startsWith(AGENT_BRANCH_PREFIX)).toBe(true)
      expect(n.length).toBe(AGENT_BRANCH_PREFIX.length + 8)
    }
  })

  it('cleanupWorktree 独立清理(供 background-registry 收尾调用)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-wtm-cleanup-'))
    try {
      const repo = initWorktreeRepo(tmpDir)
      const mgr = new WorktreeManager(repo)
      const wt = mgr.create('agent-bg')
      cleanupWorktree(wt.path, repo, true)
      expect(fs.existsSync(wt.path)).toBe(false)
      expect(mgr.list().length).toBe(0)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
