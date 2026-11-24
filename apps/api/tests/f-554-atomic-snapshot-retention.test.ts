// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-554 回归锁(2026-11-13)。
 *
 * 病灶:原子快照只增不删;createAtomicCheckpoint 先复制文件、后写 meta.json,
 * 中途失败会留下 listAtomicCheckpoints 看不见的孤儿目录,磁盘只涨不落。
 *
 * 本文件锁:
 *   ① 超过保留份数时按目录 mtime 从旧到新删除,保留数正确;
 *   ② 正在使用的当前快照即使最旧也不被清理;
 *   ③ 创建中途失败会 rm 掉半成品目录并抛出原错误;
 *   ④ 清理(rm)自身失败时不吞主流程错误,原错误照常抛出。
 *
 * 全部夹具落在 os.tmpdir 的 mkdtemp 下,不写仓库内任何文件、不连 DB。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type * as FsPromises from 'node:fs/promises'

const state = vi.hoisted(() => ({ failMetaWrite: false, failRm: false }))

// 只替换 writeFile / rm 两个口子:创建中途失败与清理失败的注入点
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof FsPromises
  const realWriteFile = actual.writeFile.bind(actual)
  const realRm = actual.rm.bind(actual)
  return {
    ...actual,
    writeFile: (...args: unknown[]) => {
      if (state.failMetaWrite && String(args[0]).endsWith('meta.json')) {
        return Promise.reject(new Error('injected meta write failure'))
      }
      return (realWriteFile as unknown as (...a: unknown[]) => Promise<void>)(...args)
    },
    rm: (...args: unknown[]) => {
      if (state.failRm) return Promise.reject(new Error('injected rm failure'))
      return (realRm as unknown as (...a: unknown[]) => Promise<void>)(...args)
    },
  }
})

import {
  createAtomicCheckpoint,
  pruneAtomicCheckpoints,
  MAX_RETAINED_CHECKPOINTS,
} from '../src/services/atomic-rollback.js'

const tmpRoots: string[] = []

function makeWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-f554-'))
  tmpRoots.push(dir)
  return dir
}

function checkpointRoot(ws: string): string {
  return join(ws, '.ihui', 'atomic-checkpoints')
}

function seedCheckpoint(root: string, id: string, mtimeSec: number): void {
  const dir = join(root, id)
  mkdirSync(join(dir, 'files'), { recursive: true })
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify({
      id,
      createdAt: new Date(mtimeSec * 1000).toISOString(),
      description: '',
      tool: 'test',
      files: [],
      skipped: [],
    }),
    'utf-8',
  )
  utimesSync(dir, mtimeSec, mtimeSec)
}

afterAll(() => {
  for (const dir of tmpRoots) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // 临时目录清理失败不影响用例判定
    }
  }
})

beforeEach(() => {
  state.failMetaWrite = false
  state.failRm = false
})

describe('F-554 快照保留期', () => {
  it('超过保留份数时按 mtime 从旧到新删除,保留数正确', async () => {
    const ws = makeWorkspace()
    const root = checkpointRoot(ws)
    mkdirSync(root, { recursive: true })
    const base = Math.floor(Date.now() / 1000) - 1000
    const ids = Array.from(
      { length: MAX_RETAINED_CHECKPOINTS + 2 },
      (_, i) => `ac-${base + i}-old${i}`,
    )
    ids.forEach((id, i) => seedCheckpoint(root, id, base + i))

    const removed = await pruneAtomicCheckpoints(ws)
    expect(removed.sort()).toEqual(ids.slice(0, 2).sort())
    expect(readdirSync(root).sort()).toEqual(ids.slice(2).sort())
    expect(readdirSync(root).length).toBe(MAX_RETAINED_CHECKPOINTS)
  })

  it('正在使用的当前快照即使最旧也不会被清理', async () => {
    const ws = makeWorkspace()
    const root = checkpointRoot(ws)
    mkdirSync(root, { recursive: true })
    const base = Math.floor(Date.now() / 1000) - 1000
    const ids = Array.from(
      { length: MAX_RETAINED_CHECKPOINTS + 2 },
      (_, i) => `ac-${base + i}-old${i}`,
    )
    ids.forEach((id, i) => seedCheckpoint(root, id, base + i))

    const removed = await pruneAtomicCheckpoints(ws, [ids[0]!])
    expect(removed).not.toContain(ids[0])
    expect(removed.sort()).toEqual([ids[1], ids[2]].sort())
    expect(existsSync(join(root, ids[0]!))).toBe(true)
    expect(readdirSync(root).length).toBe(MAX_RETAINED_CHECKPOINTS)
  })
})

describe('F-554 创建失败清理半成品', () => {
  it('写 meta.json 失败时 rm 掉刚建的目录并重新抛出原错误', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'a.txt'), 'v1', 'utf-8')
    const root = checkpointRoot(ws)

    state.failMetaWrite = true
    await expect(createAtomicCheckpoint(ws, { description: 'f554' })).rejects.toThrow(
      'injected meta write failure',
    )

    expect(existsSync(root) ? readdirSync(root) : []).toEqual([])
    expect(readFileSync(join(ws, 'a.txt'), 'utf-8')).toBe('v1')
  })

  it('清理目录也失败时不吞主流程错误,原错误照常抛出', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'a.txt'), 'v1', 'utf-8')
    const root = checkpointRoot(ws)

    state.failMetaWrite = true
    state.failRm = true
    await expect(createAtomicCheckpoint(ws, { description: 'f554' })).rejects.toThrow(
      'injected meta write failure',
    )

    // rm 被注入失败 ⇒ 半成品目录仍在,但它没有 meta.json,正好证明失败态可见可查
    const left = readdirSync(root)
    expect(left.length).toBe(1)
    expect(existsSync(join(root, left[0]!, 'meta.json'))).toBe(false)
  })
})
