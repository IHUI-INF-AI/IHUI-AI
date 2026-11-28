// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G4 改动审查的判据单测:快照 → 抓 diff → 按收下清单回退。
 * 关键不变量:执行前就脏的文件绝不能被回退(否则连用户自己的改动一起丢)。
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { captureWorkspaceDiff, revertWorkspaceChanges, snapshotWorkspace } from '../src/device/workspace-diff'

let root = ''
const git = (args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' })
const write = (name: string, text: string) => writeFileSync(join(root, name), text, 'utf8')
const read = (name: string) => {
  try {
    return readFileSync(join(root, name), 'utf8')
  } catch {
    return null
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ihui-diff-test-'))
  git(['init', '-q'])
  git(['config', 'user.email', 'test@local'])
  git(['config', 'user.name', 'test'])
  write('a.txt', 'line1\n')
  write('b.txt', 'b1\n')
  write('dirty.txt', 'd0\n')
  git(['add', '.'])
  git(['commit', '-qm', 'init'])
})

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

describe('workspace-diff', () => {
  it('抓出本轮改动并区分可否回退', () => {
    write('dirty.txt', 'd0-user\n') // 执行前就脏
    const snap = snapshotWorkspace(root)
    write('a.txt', 'line1\nline2\n')
    rmSync(join(root, 'b.txt'))
    write('new.txt', 'n1\nn2\n')
    write('dirty.txt', 'd0-user\nagent\n')

    const diff = captureWorkspaceDiff(root, snap)
    expect(diff).not.toBeNull()
    const byPath = new Map(diff!.files.map((f) => [f.path, f]))
    expect(byPath.get('a.txt')?.status).toBe('modified')
    expect(byPath.get('b.txt')?.status).toBe('deleted')
    expect(byPath.get('new.txt')?.status).toBe('added')
    expect(byPath.get('new.txt')?.revertable).toBe(true)
    expect(byPath.get('dirty.txt')?.revertable).toBe(false)
  })

  it('只收下 new.txt:其余可回退项复原,脏文件原样保留', () => {
    write('dirty.txt', 'd0-user\n')
    const snap = snapshotWorkspace(root)
    write('a.txt', 'line1\nline2\n')
    rmSync(join(root, 'b.txt'))
    write('new.txt', 'n1\n')
    write('dirty.txt', 'd0-user\nagent\n')
    const diff = captureWorkspaceDiff(root, snap)!

    const out = revertWorkspaceChanges(root, snap, diff.files, ['new.txt'])
    expect(out.reverted.sort()).toEqual(['a.txt', 'b.txt'])
    expect(read('a.txt')).toContain('line1')
    expect(read('b.txt')).toContain('b1')
    expect(read('new.txt')).toContain('n1')
    expect(read('dirty.txt')).toContain('agent')
    expect(out.skipped.map((s) => s.path)).toEqual(['dirty.txt'])
  })

  it('undefined = 全收(不回退);[] = 全退回', () => {
    const snap = snapshotWorkspace(root)
    write('a.txt', 'line1\nline2\n')
    const diff = captureWorkspaceDiff(root, snap)!

    expect(revertWorkspaceChanges(root, snap, diff.files, undefined).reverted).toEqual([])
    const all = revertWorkspaceChanges(root, snap, diff.files, [])
    expect(all.reverted).toEqual(['a.txt'])
    expect(read('a.txt')).toContain('line1')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
