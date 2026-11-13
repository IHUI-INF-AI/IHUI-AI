// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-564 回归锁(2026-11-13)。
 *
 * 病灶:快照采集对 depth>10、readdir 抛错、符号链接三处都静默 return/跳过,
 * 三者都不进 skipped;executeAtomicRollback 的 ok 只看 step 失败数,于是
 * "只恢复了一部分"仍返回 ok:true —— 用户以为已完整回滚(假成功)。
 *
 * 本文件锁:
 *   ① 正常路径:partial=false、reasons 为空、execute ok:true;
 *   ② 超过深度上限的目录:记入 skipped(路径+原因),partial=true,execute ok 不为 true;
 *   ③ readdir 抛 EACCES:记入 skipped(路径+原因),partial=true,execute ok 不为 true;
 *   ④ 符号链接:记入 skipped 且不跟踪链接目标,partial=true;
 *   ⑤ 快照后新增的漏采目录(当前扫描)同样使 plan/execute 变 partial;
 *   ⑥ 深度上限常量已导出,可在边界内正常采集。
 *
 * 全部夹具落在 os.tmpdir 的 mkdtemp 下,只 spy readdir,不连 DB。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type * as FsPromises from 'node:fs/promises'

const state = vi.hoisted(() => ({ unreadableDir: '' }))

// 只替换 readdir:模拟目录 EACCES,其余 fs 能力保持真实
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof FsPromises
  const realReaddir = actual.readdir.bind(actual)
  return {
    ...actual,
    readdir: (...args: unknown[]) => {
      if (state.unreadableDir && String(args[0]) === state.unreadableDir) {
        const err = new Error('EACCES: permission denied') as Error & { code: string }
        err.code = 'EACCES'
        return Promise.reject(err)
      }
      return (realReaddir as unknown as (...a: unknown[]) => Promise<unknown>)(...args)
    },
  }
})

import {
  createAtomicCheckpoint,
  planAtomicRollback,
  executeAtomicRollback,
  SNAPSHOT_MAX_DEPTH,
} from '../src/services/atomic-rollback.js'

const tmpRoots: string[] = []

function makeWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-f564-'))
  tmpRoots.push(dir)
  return dir
}

/** 逐层建目录并返回最深层绝对路径:levels 层,路径 d1/d2/.../d{levels} */
function makeNestedDir(root: string, levels: number): string {
  let cur = root
  for (let i = 1; i <= levels; i++) {
    cur = join(cur, `d${i}`)
    mkdirSync(cur, { recursive: true })
  }
  return cur
}

function nestedRelPath(levels: number): string {
  return Array.from({ length: levels }, (_, i) => `d${i + 1}`).join('/')
}

afterAll(() => {
  for (const dir of tmpRoots) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* Windows 上 junction 清理失败不影响用例结论 */
    }
  }
})

describe('F-564 快照采集不得静默漏采', () => {
  beforeEach(() => {
    state.unreadableDir = ''
  })

  it('① 正常路径:partial=false、无 reasons、execute ok:true', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'a.txt'), 'v1', 'utf-8')
    mkdirSync(join(ws, 'src'), { recursive: true })
    writeFileSync(join(ws, 'src', 'b.ts'), 'export const b = 1', 'utf-8')

    const snap = await createAtomicCheckpoint(ws, { description: '正常' })
    expect(snap.meta.partial).toBe(false)
    expect(snap.meta.skipped).toEqual([])

    writeFileSync(join(ws, 'a.txt'), 'v2', 'utf-8')
    const plan = await planAtomicRollback(ws, snap.meta.id)
    expect(plan!.partial).toBe(false)
    expect(plan!.reasons).toEqual([])

    const result = await executeAtomicRollback(ws, snap.meta.id, { confirm: true })
    expect(result!.ok).toBe(true)
    expect(result!.partial).toBe(false)
    expect(readFileSync(join(ws, 'a.txt'), 'utf-8')).toBe('v1')
  })

  it('② depth 超上限:记入 skipped(路径+原因),partial=true,execute ok 不为 true', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'top.txt'), 't', 'utf-8')
    // 边界内(depth=SNAPSHOT_MAX_DEPTH)的文件仍应采集到
    const atLimit = makeNestedDir(ws, SNAPSHOT_MAX_DEPTH)
    writeFileSync(join(atLimit, 'at-limit.txt'), 'keep', 'utf-8')
    // 超一层:该目录以下不得静默消失
    const tooDeep = makeNestedDir(ws, SNAPSHOT_MAX_DEPTH + 1)
    writeFileSync(join(tooDeep, 'deep.txt'), 'hidden', 'utf-8')

    const snap = await createAtomicCheckpoint(ws, { description: '深层' })
    expect(snap.meta.partial).toBe(true)
    const paths = snap.meta.files.map((f) => f.path)
    expect(paths).toContain('top.txt')
    expect(paths).toContain(`${nestedRelPath(SNAPSHOT_MAX_DEPTH)}/at-limit.txt`)
    expect(paths.some((p) => p.endsWith('deep.txt'))).toBe(false)

    const skip = snap.meta.skipped.find((s) => s.reason.includes('深度'))
    expect(skip).toBeDefined()
    expect(skip!.path).toBe(nestedRelPath(SNAPSHOT_MAX_DEPTH + 1))
    expect(skip!.reason).toContain(String(SNAPSHOT_MAX_DEPTH))

    const plan = await planAtomicRollback(ws, snap.meta.id)
    expect(plan!.partial).toBe(true)
    expect(plan!.reasons.join('\n')).toContain(`${nestedRelPath(SNAPSHOT_MAX_DEPTH + 1)}:`)

    const result = await executeAtomicRollback(ws, snap.meta.id, { confirm: true })
    expect(result!.ok).toBe(false)
    expect(result!.partial).toBe(true)
    expect(result!.reasons.join('\n')).toContain('深度')
    expect(result!.steps.some((s) => s.step === '覆盖范围核对' && s.status === 'fail')).toBe(true)
  })

  it('③ readdir 抛 EACCES:记入 skipped(路径+原因),partial=true,execute ok 不为 true', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'ok.txt'), 'ok', 'utf-8')
    mkdirSync(join(ws, 'locked'), { recursive: true })
    writeFileSync(join(ws, 'locked', 'secret.txt'), 'secret', 'utf-8')
    state.unreadableDir = join(ws, 'locked')

    const snap = await createAtomicCheckpoint(ws, { description: '不可读' })
    expect(snap.meta.partial).toBe(true)
    expect(snap.meta.files.map((f) => f.path)).toContain('ok.txt')
    expect(snap.meta.files.some((f) => f.path.startsWith('locked/'))).toBe(false)
    const skip = snap.meta.skipped.find((s) => s.path === 'locked')
    expect(skip).toBeDefined()
    expect(skip!.reason).toContain('目录读取失败')
    expect(skip!.reason).toContain('EACCES')

    const result = await executeAtomicRollback(ws, snap.meta.id, { confirm: true })
    expect(result!.ok).toBe(false)
    expect(result!.partial).toBe(true)
    expect(result!.reasons.join('\n')).toContain('locked: 目录读取失败')
  })

  it('④ 符号链接:记入 skipped 且不跟踪链接目标,partial=true', async () => {
    const ws = makeWorkspace()
    mkdirSync(join(ws, 'real'), { recursive: true })
    writeFileSync(join(ws, 'real', 'inside.txt'), 'i', 'utf-8')
    symlinkSync(join(ws, 'real'), join(ws, 'link'), 'junction')

    const snap = await createAtomicCheckpoint(ws, { description: '符号链接' })
    expect(snap.meta.partial).toBe(true)
    expect(snap.meta.files.some((f) => f.path.startsWith('link/'))).toBe(false)
    const skip = snap.meta.skipped.find((s) => s.path === 'link')
    expect(skip).toBeDefined()
    expect(skip!.reason).toContain('符号链接')

    const result = await executeAtomicRollback(ws, snap.meta.id, { confirm: true })
    expect(result!.ok).toBe(false)
    expect(result!.partial).toBe(true)
    expect(result!.reasons.join('\n')).toContain('link: 符号链接')
  })

  it('⑤ 快照后新增的漏采目录:plan 也标 partial(当前扫描并入 uncovered/reasons)', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'a.txt'), 'v1', 'utf-8')
    const snap = await createAtomicCheckpoint(ws, { description: '基线' })
    expect(snap.meta.partial).toBe(false)

    mkdirSync(join(ws, 'later-locked'), { recursive: true })
    writeFileSync(join(ws, 'later-locked', 'x.txt'), 'x', 'utf-8')
    state.unreadableDir = join(ws, 'later-locked')

    const plan = await planAtomicRollback(ws, snap.meta.id)
    expect(plan!.partial).toBe(true)
    expect(plan!.reasons.join('\n')).toContain('later-locked: 目录读取失败')
    expect(plan!.uncovered.some((u) => u.path === 'later-locked')).toBe(true)

    const result = await executeAtomicRollback(ws, snap.meta.id, { confirm: true })
    expect(result!.ok).toBe(false)
    expect(result!.partial).toBe(true)
  })
})
