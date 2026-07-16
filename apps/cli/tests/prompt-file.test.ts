import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { readPromptFile } from '../src/index.js'

describe('readPromptFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-prompt-file-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('文件存在且有内容 → ok=true, content=trim 后的内容', () => {
    const p = path.join(tmpDir, 'prompt.txt')
    fs.writeFileSync(p, '  hello world  ')
    const r = readPromptFile(p)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.content).toBe('hello world')
    }
  })

  it('文件不存在 → ok=false, error 含"不存在"', () => {
    const p = path.join(tmpDir, 'no-such-file.txt')
    const r = readPromptFile(p)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/不存在/)
    }
  })

  it('文件为空 → ok=false, error 含"空"', () => {
    const p = path.join(tmpDir, 'empty.txt')
    fs.writeFileSync(p, '')
    const r = readPromptFile(p)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/空/)
    }
  })

  it('文件只有空白字符 → ok=false, error 含"空"', () => {
    const p = path.join(tmpDir, 'whitespace.txt')
    fs.writeFileSync(p, '   \n\t  \n  ')
    const r = readPromptFile(p)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/空/)
    }
  })

  it('多行内容 → ok=true, content 保留换行', () => {
    const p = path.join(tmpDir, 'multi.txt')
    const body = 'line1\nline2\nline3'
    fs.writeFileSync(p, body)
    const r = readPromptFile(p)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.content).toBe(body)
    }
  })

  it('UTF-8 中文内容 → ok=true, content 正确', () => {
    const p = path.join(tmpDir, 'zh.txt')
    const body = '你好,世界!这是一个测试。'
    fs.writeFileSync(p, body, 'utf-8')
    const r = readPromptFile(p)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.content).toBe(body)
    }
  })

  it('路径是目录 → ok=false, error 含"目录"', () => {
    const r = readPromptFile(tmpDir)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/目录/)
    }
  })

  it('内容超长(10000 字符)→ ok=true, 不截断', () => {
    const p = path.join(tmpDir, 'long.txt')
    const body = 'a'.repeat(10000)
    fs.writeFileSync(p, body)
    const r = readPromptFile(p)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.content.length).toBe(10000)
      expect(r.content).toBe(body)
    }
  })
})
