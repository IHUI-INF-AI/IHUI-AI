// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-563 回归锁(2026-11-13)。
 *
 * 病灶:清理遍历跟随符号链接,uploads 下指向外部的目录链接被当成目录下钻,过期判定后
 * unlink 删的是链接目标;且删除前无 realpath 边界校验,可越过 uploads 根删除外部数据。
 * 修法:遍历用 dirent/lstat 判定,符号链接一律不跟随也不删除;每个待删路径 realpath
 * 必须仍在所属清理根(uploads / outputs)之内,越界记 warn 并跳过。
 *
 * 夹具落在 os.tmpdir 的 mkdtemp 下;Windows 无符号链接权限时跳过真实链接断言,
 * 改用 mock 覆盖 lstat / realpath 分支。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const state = vi.hoisted(() => ({
  fakeSymlinks: new Set<string>(),
  realpathEscape: new Map<string, string>(),
}))

// 只替换 lstat / realpath:模拟「dirent 未标出链接」与「真实路径越界」两个分支,
// 其余 fs 调用走真实实现(与 f-549 的 mock 方式一致)。
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const realLstat = actual.lstat as (p: string) => Promise<unknown>
  const realRealpath = actual.realpath as (p: string) => Promise<string>
  return {
    ...actual,
    lstat: (p: string) => {
      if (state.fakeSymlinks.has(resolve(p))) {
        return Promise.resolve({
          isSymbolicLink: () => true,
          isFile: () => false,
          isDirectory: () => false,
          mtimeMs: 0,
          size: 0,
        })
      }
      return realLstat(p)
    },
    realpath: (p: string) => {
      const escaped = state.realpathEscape.get(resolve(p))
      return escaped ? Promise.resolve(escaped) : realRealpath(p)
    },
  }
})

import { runFileCleanup } from '../src/services/cleanup-service.js'

const OLD = new Date(Date.now() - 48 * 60 * 60 * 1000)
const FRESH = new Date()

let root: string
let outside: string
let originalCwd: string

function makeFile(rel: string, mtime: Date, content = 'data'): string {
  const full = join(root, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
  utimesSync(full, mtime, mtime)
  return full
}

/** Windows 无开发者模式/管理员权限时 symlink 会 EPERM,返回 false 让断言回退到 mock 分支。 */
function trySymlink(target: string, linkPath: string, type: 'dir' | 'file'): boolean {
  try {
    symlinkSync(target, linkPath, type)
    return true
  } catch {
    return false
  }
}

beforeAll(() => {
  originalCwd = process.cwd()
  root = mkdtempSync(join(tmpdir(), 'f563-cleanup-'))
  outside = mkdtempSync(join(tmpdir(), 'f563-outside-'))
  process.chdir(root)
})

beforeEach(() => {
  rmSync(join(root, 'uploads'), { recursive: true, force: true })
  rmSync(join(root, 'outputs'), { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
  mkdirSync(outside, { recursive: true })
  state.fakeSymlinks.clear()
  state.realpathEscape.clear()
})

afterAll(() => {
  process.chdir(originalCwd)
  rmSync(root, { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
})

describe('F-563 清理不得跟随符号链接越界删除', () => {
  it('目录符号链接不下钻:根外超期文件保持存在', async (ctx) => {
    const victim = join(outside, 'nested', 'victim.txt')
    mkdirSync(join(outside, 'nested'), { recursive: true })
    writeFileSync(victim, 'outside')
    utimesSync(victim, OLD, OLD)
    mkdirSync(join(root, 'uploads', 'tmp'), { recursive: true })
    if (!trySymlink(outside, join(root, 'uploads', 'tmp', 'escape'), 'dir')) {
      ctx.skip()
      return
    }

    const result = await runFileCleanup()

    expect(existsSync(victim)).toBe(true)
    expect(result.deletedByAge).toBe(0)
    expect(result.totalDeleted).toBe(0)
  })

  it('文件符号链接不删除:根外目标文件与链接本身都保持存在', async (ctx) => {
    const victim = join(outside, 'victim.bin')
    writeFileSync(victim, 'outside')
    utimesSync(victim, OLD, OLD)
    mkdirSync(join(root, 'uploads', 'chunks'), { recursive: true })
    const link = join(root, 'uploads', 'chunks', 'old-link.bin')
    if (!trySymlink(victim, link, 'file')) {
      ctx.skip()
      return
    }

    const result = await runFileCleanup()

    expect(existsSync(victim)).toBe(true)
    expect(existsSync(link)).toBe(true)
    expect(result.deletedByAge).toBe(0)
  })

  it('lstat 判定为符号链接的目录项被跳过(不依赖 dirent 类型)', async () => {
    const disguised = makeFile('uploads/tmp/disguised.bin', OLD)
    state.fakeSymlinks.add(resolve(disguised))

    const result = await runFileCleanup()

    expect(existsSync(disguised)).toBe(true)
    expect(result.scanned).toBe(0)
    expect(result.deletedByAge).toBe(0)
  })

  it('realpath 落在所属清理根之外时拒绝删除并记 warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const natural = makeFile('uploads/chunks/old.part', OLD)
    const escaped = join(outside, 'escaped.part')
    writeFileSync(escaped, 'outside')
    state.realpathEscape.set(resolve(natural), escaped)

    const result = await runFileCleanup()

    expect(existsSync(natural)).toBe(true)
    expect(result.deletedByAge).toBe(0)
    expect(result.errors.join('\n')).toContain('realpath 越界')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('根内普通超期文件仍按 TTL 删除(既有清理策略不变)', async () => {
    const stale = makeFile('uploads/chunks/stale.part', OLD)
    const fresh = makeFile('uploads/chunks/fresh.part', FRESH)

    const result = await runFileCleanup()

    expect(existsSync(stale)).toBe(false)
    expect(existsSync(fresh)).toBe(true)
    expect(result.deletedByAge).toBe(1)
  })
})
