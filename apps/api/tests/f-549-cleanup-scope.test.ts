// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-549 / F-562 回归锁(2026-11-13)。
 *
 * 病灶一(F-549):旧 TARGET_DIRS=['uploads','outputs'] 递归整棵树按 mtime 删除,
 * 把 routes/files.ts 持久化在 uploads/public(以及 uploads/private)的用户文件一并清掉;
 * 修法:清理范围收敛到 uploads/chunks、uploads/tmp、outputs,并按路径前缀跳过持久化目录。
 *
 * 病灶二(F-562):遍历用 readdirSync/statSync/unlinkSync,且每轮为「统计 + 删除」扫两遍,
 * 大目录下长时间占住事件循环;修法:fs/promises 单趟遍历 + 有界并发,删除失败只记数不中断。
 *
 * 全部夹具落在 os.tmpdir 的 mkdtemp 下,不写仓库内任何文件、不连 DB。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const state = vi.hoisted(() => ({ failingPaths: [] as string[] }))

// 只替换 unlink:注入「删除失败」场景(权限/占用),其余 fs 调用走真实实现。
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const realUnlink = actual.unlink as (...a: unknown[]) => Promise<void>
  return {
    ...actual,
    unlink: (...args: unknown[]) => {
      if (state.failingPaths.includes(resolve(String(args[0])))) {
        return Promise.reject(
          Object.assign(new Error('EPERM: operation not permitted, unlink'), { code: 'EPERM' }),
        )
      }
      return realUnlink(...args)
    },
  }
})

import { getCleanupStats, runFileCleanup } from '../src/services/cleanup-service.js'

const OLD = new Date(Date.now() - 48 * 60 * 60 * 1000)
const FRESH = new Date()

let root: string
let originalCwd: string

function makeFile(rel: string, mtime: Date, content = 'data'): string {
  const full = join(root, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
  utimesSync(full, mtime, mtime)
  return full
}

beforeAll(() => {
  originalCwd = process.cwd()
  root = mkdtempSync(join(tmpdir(), 'f549-cleanup-'))
  process.chdir(root)
})

beforeEach(() => {
  rmSync(join(root, 'uploads'), { recursive: true, force: true })
  rmSync(join(root, 'outputs'), { recursive: true, force: true })
  state.failingPaths = []
})

afterAll(() => {
  process.chdir(originalCwd)
  rmSync(root, { recursive: true, force: true })
})

describe('F-549 清理范围不得命中持久化文件', () => {
  it('uploads/public 与 uploads/private 下的超期文件不被删除(含嵌套子目录)', async () => {
    const publicTop = makeFile('uploads/public/avatar.png', OLD)
    const publicNested = makeFile('uploads/public/2026/11/attachment.pdf', OLD)
    const privateFile = makeFile('uploads/private/versions/old.docx', OLD)

    const result = await runFileCleanup()

    expect(existsSync(publicTop)).toBe(true)
    expect(existsSync(publicNested)).toBe(true)
    expect(existsSync(privateFile)).toBe(true)
    expect(readFileSync(publicTop, 'utf8')).toBe('data')
    expect(result.deletedByAge).toBe(0)
    expect(result.totalDeleted).toBe(0)
  })

  it('uploads 根下未列入清理范围的其它子目录不受影响', async () => {
    const other = makeFile('uploads/misc/keep.bin', OLD)

    const result = await runFileCleanup()

    expect(existsSync(other)).toBe(true)
    expect(result.scanned).toBe(0)
  })
})

describe('F-549/F-562 临时目录仍按保留期清理', () => {
  it('uploads/chunks 下的超期文件被删除(递归子目录)', async () => {
    const deep = makeFile('uploads/chunks/upload-1/2.part', OLD)

    const result = await runFileCleanup()

    expect(existsSync(deep)).toBe(false)
    expect(result.deletedByAge).toBe(1)
    expect(result.totalDeleted).toBe(1)
  })

  it('outputs 下的超期文件被删除', async () => {
    const stale = makeFile('outputs/reports/old.pdf', OLD)

    const result = await runFileCleanup()

    expect(existsSync(stale)).toBe(false)
    expect(result.deletedByAge).toBe(1)
  })

  it('未超期文件保持不动,且被计入 scanned', async () => {
    const freshChunk = makeFile('uploads/chunks/fresh.part', FRESH)
    const freshOutput = makeFile('outputs/fresh.bin', FRESH)

    const result = await runFileCleanup()

    expect(existsSync(freshChunk)).toBe(true)
    expect(existsSync(freshOutput)).toBe(true)
    expect(result.deletedByAge).toBe(0)
    expect(result.scanned).toBe(2)
  })

  it('单个文件删除失败只记录错误并继续整轮,不抛出', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failing = makeFile('uploads/chunks/locked.part', OLD)
    const deletable = makeFile('uploads/chunks/deletable.part', OLD)
    state.failingPaths = [resolve(failing)]

    const result = await runFileCleanup()

    expect(existsSync(failing)).toBe(true)
    expect(existsSync(deletable)).toBe(false)
    expect(result.deletedByAge).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('locked.part')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('F-562 统计与遍历同源', () => {
  it('getCleanupStats 异步统计 uploads/outputs 且不删除任何文件', async () => {
    const publicFile = makeFile('uploads/public/kept.png', OLD)
    const output = makeFile('outputs/kept.bin', OLD)

    const stats = await getCleanupStats()

    expect(stats.uploadsFiles).toBe(1)
    expect(stats.outputsFiles).toBe(1)
    expect(existsSync(publicFile)).toBe(true)
    expect(existsSync(output)).toBe(true)
  })
})
