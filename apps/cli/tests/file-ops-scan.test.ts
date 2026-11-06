// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { cmdGrep, cmdLs, cmdRead } from '../src/commands/file-ops.js'

describe('cmdGrep 扫描完成与否', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true })
    dirs.length = 0
  })

  function scratch(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-grep-'))
    dirs.push(dir)
    return dir
  }

  function capture(run: () => void): string {
    const lines: string[] = []
    const spy = vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
      lines.push(args.map((item) => String(item)).join(' '))
    })
    try {
      run()
    } finally {
      spy.mockRestore()
    }
    return lines.join('\n')
  }

  it('列目录时,不存在和文件不会被说成空目录', () => {
    const dir = scratch()
    fs.writeFileSync(path.join(dir, 'a.txt'), 'hello\n')
    const missing = capture(() => cmdLs(dir, 'no-such'))
    expect(missing).toContain('路径不存在')
    expect(missing).not.toContain('说成是空的')
    const file = capture(() => cmdLs(dir, 'a.txt'))
    expect(file).toContain('是文件')
    expect(file).not.toContain('说成是空的')
    const listed = capture(() => cmdLs(dir, '.'))
    expect(listed).toContain('a.txt')
  })

  it('读文件时,不存在和目录不会被说成空文件', () => {
    const dir = scratch()
    fs.writeFileSync(path.join(dir, 'a.txt'), 'hello target\n')
    const missing = capture(() => cmdRead(dir, 'no-such.txt'))
    expect(missing).toContain('文件不存在')
    expect(missing).not.toContain('说成不存在')
    expect(missing).not.toContain('说成是空的')
    const asDir = capture(() => cmdRead(dir, '.'))
    expect(asDir).toContain('是目录')
    const body = capture(() => cmdRead(dir, 'a.txt'))
    expect(body).toContain('hello target')
    expect(body).not.toContain('说成是空的')
  })

  it('直接搜文件时能命中,不会说成没有匹配', () => {
    const dir = scratch()
    fs.writeFileSync(path.join(dir, 'a.txt'), 'hello target\n')
    const text = capture(() => cmdGrep(dir, 'target', 'a.txt'))
    expect(text).toContain('a.txt')
    expect(text).not.toContain('未找到匹配')
    expect(text).not.toContain('扫描没有完成')
  })

  it('路径不存在仍报不存在', () => {
    const dir = scratch()
    const text = capture(() => cmdGrep(dir, 'target', 'missing.txt'))
    expect(text).toContain('路径不存在')
    expect(text).not.toContain('未找到匹配')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
