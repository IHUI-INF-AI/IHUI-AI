// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-706 失败半径验收 — subagent worktree「落盘→建 session」流程。
 *
 * 票面验收口径成对执行:
 *   ① phase=installing 崩溃 ⇒ 重启后目录保留不被删(marker 不齐 = 证明不了 ⇒ 保留)
 *   ② 补建 session 后 marker 被回收(session 在 ⇒ 重建记录 + 回收 marker)
 * 机制面:mkdir EEXIST 原子互斥、marker 齐备即 reused:true 不重下载、
 *        createSession 提交后解除清理武装、启动对账三态。
 *
 * 夹具全部落仓内 `.ihui-agent/tmp`(os.tmpdir() 禁用),测试后清理。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  createWorktree as createWorktreeCoW,
  worktreeMarkerPath,
  isWorktreeMarkerComplete,
  WorktreeLandUnprovableError,
} from '../src/worktree.js'
import {
  createWorktreeWithFallback,
  reconcileWorktreeArtifacts,
  reclaimWorktreeMarker,
} from '../src/subagents/worktree.js'
import {
  saveSubagentState,
  getSubagentStatePath,
  type SubagentState,
} from '../src/subagents/state-store.js'

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..')
const FIXTURE_ROOT = path.join(REPO_ROOT, '.ihui-agent', 'tmp')

// 真实 git 子进程 + CoW 复制,负载下 15s 默认易误伤 → 与 worktree.test.ts 同档 60s
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

function gitInit(repoDir: string): void {
  spawnSync('git', ['init'], { cwd: repoDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], {
    cwd: repoDir,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  spawnSync('git', ['config', 'user.name', 'Test'], {
    cwd: repoDir,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], {
    cwd: repoDir,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

let fixture = ''
let sourceRepo = ''
let savedWtDir: string | undefined
let savedStateDir: string | undefined

function worktreesRoot(): string {
  return path.join(sourceRepo, '.worktrees')
}

/** 模拟 phase=installing 崩溃留下的半成品目录:有内容、marker 未写(证明不了)。 */
function makeHalfLandedDir(id: string): string {
  const dir = path.join(worktreesRoot(), id)
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'partial.txt'), 'half-landed', 'utf-8')
  return dir
}

function makeStateRow(id: string, worktreePath: string): SubagentState {
  return {
    id,
    parentId: 'parent-g706',
    persona: 'general',
    capabilityMode: 'all',
    isolation: 'worktree',
    worktreePath,
    transcript: [],
    status: 'running',
    startedAt: new Date().toISOString(),
  }
}

beforeEach(() => {
  fs.mkdirSync(FIXTURE_ROOT, { recursive: true })
  fixture = fs.mkdtempSync(path.join(FIXTURE_ROOT, 'g706-fail-radius-'))
  sourceRepo = path.join(fixture, 'source')
  fs.mkdirSync(sourceRepo, { recursive: true })
  gitInit(sourceRepo)
  fs.writeFileSync(path.join(sourceRepo, 'README.md'), 'hello\n', 'utf-8')
  spawnSync('git', ['add', '.'], { cwd: sourceRepo, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
  spawnSync('git', ['commit', '-m', 'init'], { cwd: sourceRepo, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })

  savedWtDir = process.env.IHUI_WORKTREE_DIR
  savedStateDir = process.env.IHUI_SUBAGENT_STATE_DIR
  process.env.IHUI_WORKTREE_DIR = worktreesRoot()
  process.env.IHUI_SUBAGENT_STATE_DIR = path.join(fixture, 'state')
})

afterEach(() => {
  if (savedWtDir === undefined) delete process.env.IHUI_WORKTREE_DIR
  else process.env.IHUI_WORKTREE_DIR = savedWtDir
  if (savedStateDir === undefined) delete process.env.IHUI_SUBAGENT_STATE_DIR
  else process.env.IHUI_SUBAGENT_STATE_DIR = savedStateDir
  fs.rmSync(fixture, { recursive: true, force: true })
})

// ============ 票面验收①:phase=installing 崩溃 ⇒ 重启后目录保留不被删 ============

describe('G-706 验收① phase=installing 崩溃 ⇒ 重启后目录保留不被删', () => {
  it('半成品目录(marker 未写):启动对账判"证明不了⇒保留",不删', () => {
    const id = 'crash-installing-1'
    const dir = makeHalfLandedDir(id)

    const actions = reconcileWorktreeArtifacts(sourceRepo)

    expect(actions.find((a) => a.subagentId === id)?.action).toBe('kept-unprovable')
    expect(fs.existsSync(dir)).toBe(true)
    expect(fs.existsSync(path.join(dir, 'partial.txt'))).toBe(true)
  })

  it('半成品目录(marker 未写):再次落盘抢锁失败 ⇒ 抛专属保留错误且目录不被删', async () => {
    const id = 'crash-installing-2'
    const dir = makeHalfLandedDir(id)

    await expect(
      createWorktreeCoW({ source: sourceRepo, destination: dir }),
    ).rejects.toBeInstanceOf(WorktreeLandUnprovableError)

    expect(fs.existsSync(dir)).toBe(true)
    expect(fs.existsSync(path.join(dir, 'partial.txt'))).toBe(true)
  })

  it('半成品目录(marker 未写):快路径包装器保留目录,错误退回"路径已存在"旧形态', async () => {
    const id = 'crash-installing-3'
    const dir = makeHalfLandedDir(id)

    await expect(
      createWorktreeWithFallback('parent-g706', id, sourceRepo, true),
    ).rejects.toThrow(/已存在|exists/i)

    expect(fs.existsSync(dir)).toBe(true)
    expect(fs.existsSync(path.join(dir, 'partial.txt'))).toBe(true)
  })
})

// ============ 票面验收②:补建 session 后 marker 被回收 ============

describe('G-706 验收② 补建 session 后 marker 被回收', () => {
  it('marker 齐备 + 补建 session ⇒ 对账"重建记录"臂:目录保留、marker 被回收', async () => {
    const id = 'landed-then-session'
    const dir = path.join(worktreesRoot(), id)
    await createWorktreeCoW({ source: sourceRepo, destination: dir })
    expect(isWorktreeMarkerComplete(dir)).toBe(true)

    // 补建 session(createSession 提交)
    saveSubagentState(makeStateRow(id, dir))

    const actions = reconcileWorktreeArtifacts(sourceRepo)

    expect(actions.find((a) => a.subagentId === id)?.action).toBe('recovered')
    expect(fs.existsSync(dir)).toBe(true)
    expect(fs.existsSync(worktreeMarkerPath(dir))).toBe(false) // marker 被回收
  })

  it('createSession 提交即解除清理武装:reclaimWorktreeMarker 回收后对账不再触碰该目录', async () => {
    const id = 'landed-disarm'
    const dir = path.join(worktreesRoot(), id)
    await createWorktreeCoW({ source: sourceRepo, destination: dir })

    expect(reclaimWorktreeMarker(dir)).toBe(true)
    expect(fs.existsSync(worktreeMarkerPath(dir))).toBe(false)
    expect(reclaimWorktreeMarker(dir)).toBe(false) // 幂等:已回收再调返回 false

    // marker 已撤 ⇒ 即便 session 行缺失,对账也只能"证明不了⇒保留",绝不再删已提交数据的邻域
    const actions = reconcileWorktreeArtifacts(sourceRepo)
    expect(actions.find((a) => a.subagentId === id)?.action).toBe('kept-unprovable')
    expect(fs.existsSync(dir)).toBe(true)
  })
})

// ============ 机制:mkdir EEXIST 原子互斥 + marker 齐备即 reused:true 不重下载 ============

describe('G-706 机制 mkdir EEXIST 原子互斥 + marker 齐备 reused:true', () => {
  it('同目录第二次落盘 ⇒ reused:true,不重新复制(目录内改动原样存活)', async () => {
    const id = 'reuse-direct'
    const dir = path.join(worktreesRoot(), id)
    const first = await createWorktreeCoW({ source: sourceRepo, destination: dir })
    expect(first.reused).toBe(false)

    fs.writeFileSync(path.join(dir, 'README.md'), 'SENTINEL\n', 'utf-8')

    const second = await createWorktreeCoW({ source: sourceRepo, destination: dir })
    expect(second.reused).toBe(true)
    // 若重下载/重复制,reset --hard 会把 README 打回 'hello'
    expect(fs.readFileSync(path.join(dir, 'README.md'), 'utf-8').replace(/\r\n/g, '\n')).toBe('SENTINEL\n')
  })

  it('快路径包装器:marker 齐备且分支未建 ⇒ reused:true 不重下载,分支照常补建', async () => {
    const id = 'reuse-wrapper'
    const dir = path.join(worktreesRoot(), id)
    await createWorktreeCoW({ source: sourceRepo, destination: dir })
    fs.writeFileSync(path.join(dir, 'README.md'), 'SENTINEL2\n', 'utf-8')

    const wt = await createWorktreeWithFallback('parent-g706', id, sourceRepo, true)

    expect(wt.usedFastPath).toBe(true)
    expect(wt.reused).toBe(true)
    expect(wt.branch).toBe(`subagent/${id}`)
    expect(fs.readFileSync(path.join(dir, 'README.md'), 'utf-8').replace(/\r\n/g, '\n')).toBe('SENTINEL2\n')
    // 分支确实建出来了(等价 git worktree add -b 的语义对齐)
    const head = spawnSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    expect((head.stdout ?? '').trim()).toBe(`subagent/${id}`)
  })
})

// ============ 机制:启动对账三态 ============

describe('G-706 机制 启动对账三态', () => {
  it('marker 齐备 + session 行确实没有 ⇒ 只删自有子目录', async () => {
    const id = 'orphan-own'
    const dir = path.join(worktreesRoot(), id)
    await createWorktreeCoW({ source: sourceRepo, destination: dir })

    const actions = reconcileWorktreeArtifacts(sourceRepo)

    expect(actions.find((a) => a.subagentId === id)?.action).toBe('removed-own')
    expect(fs.existsSync(dir)).toBe(false)
  })

  it('marker 指向他源 ⇒ 非自有,证明不了,保留不删', () => {
    const id = 'foreign-marker'
    const dir = path.join(worktreesRoot(), id)
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true })
    fs.writeFileSync(worktreeMarkerPath(dir), 'Z:\\other\\unrelated-repo', 'utf-8')

    const actions = reconcileWorktreeArtifacts(sourceRepo)

    expect(actions.find((a) => a.subagentId === id)?.action).toBe('kept-unprovable')
    expect(fs.existsSync(dir)).toBe(true)
  })

  it('session 行判不出(损坏 JSON)⇒ 暂时性错误不升级成删除,保留', async () => {
    const id = 'unreadable-row'
    const dir = path.join(worktreesRoot(), id)
    await createWorktreeCoW({ source: sourceRepo, destination: dir })
    fs.mkdirSync(path.dirname(getSubagentStatePath(id)), { recursive: true })
    fs.writeFileSync(getSubagentStatePath(id), '{ broken json', 'utf-8')

    const actions = reconcileWorktreeArtifacts(sourceRepo)

    expect(actions.find((a) => a.subagentId === id)?.action).toBe('kept-unprovable')
    expect(fs.existsSync(dir)).toBe(true)
  })

  it('本次创建流程正持有的 id(exclude)不被对账触碰', async () => {
    const id = 'in-flight'
    const dir = path.join(worktreesRoot(), id)
    await createWorktreeCoW({ source: sourceRepo, destination: dir })

    const actions = reconcileWorktreeArtifacts(sourceRepo, { excludeSubagentIds: new Set([id]) })

    expect(actions.find((a) => a.subagentId === id)).toBeUndefined()
    expect(fs.existsSync(dir)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
