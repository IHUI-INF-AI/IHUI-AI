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
