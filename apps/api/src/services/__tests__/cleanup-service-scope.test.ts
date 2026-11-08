// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-549 回归(2026-11-08):cleanup-service 只能清临时候选目录(uploads/chunks、uploads/tmp、outputs),
 * 不得递归误删 uploads/public 与 uploads/private 下已持久化并被 files 表引用的文件。
 *
 * 改前必红口径:旧 TARGET_DIRS=['uploads','outputs'] 会递归收 uploads/public,
 * 24h 前的 public/keep.txt 被删除 → 断言"文件仍存在"失败。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { runFileCleanup } from '../cleanup-service.js'

const OLD = new Date(Date.now() - 48 * 60 * 60 * 1000)
let root: string
let originalCwd: string

function makeOldFile(rel: string): string {
  const full = join(root, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, 'data')
  utimesSync(full, OLD, OLD)
  return full
}

beforeAll(() => {
  originalCwd = process.cwd()
  root = mkdtempSync(join(tmpdir(), 'f549-'))
  process.chdir(root)
})

afterAll(() => {
  process.chdir(originalCwd)
  rmSync(root, { recursive: true, force: true })
})

describe('F-549 清理范围不得误删持久化目录', () => {
  it('uploads/public 与 uploads/private 保留,chunks/tmp/outputs 过期文件被清', async () => {
    const publicFile = makeOldFile('uploads/public/keep.txt')
    const privateFile = makeOldFile('uploads/private/keep.txt')
    const staleChunk = makeOldFile('uploads/chunks/stale.bin')
    const staleTmp = makeOldFile('uploads/tmp/stale.bin')
    const staleOutput = makeOldFile('outputs/stale.bin')

    const result = await runFileCleanup()

    expect(existsSync(publicFile)).toBe(true)
    expect(existsSync(privateFile)).toBe(true)
    expect(existsSync(staleChunk)).toBe(false)
    expect(existsSync(staleTmp)).toBe(false)
    expect(existsSync(staleOutput)).toBe(false)
    expect(result.deletedByAge).toBe(3)
  })
})
