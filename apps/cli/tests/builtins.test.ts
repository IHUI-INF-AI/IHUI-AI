import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  BUILTIN_TOOLS,
  read_file,
  list_dir,
  grep,
  glob,
  run_command,
} from '../src/tools/builtins.js'
import type { ToolContext } from '../src/tools/index.js'

describe('BUILTIN_TOOLS', () => {
  it('注册 5 个核心工具', () => {
    expect(BUILTIN_TOOLS).toHaveLength(5)
    const names = BUILTIN_TOOLS.map((t) => t.name).sort()
    expect(names).toEqual(['glob', 'grep', 'list_dir', 'read_file', 'run_command'])
  })

  it('read_file 工具危险级别为 read', () => {
    expect(read_file.dangerLevel).toBe('read')
  })

  it('run_command 工具危险级别为 dangerous', () => {
    expect(run_command.dangerLevel).toBe('dangerous')
  })
})

describe('read_file 工具', () => {
  let tmpDir: string
  let ctx: ToolContext

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-readfile-'))
    ctx = { workspacePath: tmpDir }
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('读取存在的文件', async () => {
    const filePath = path.join(tmpDir, 'hello.txt')
    fs.writeFileSync(filePath, 'hello world\nline 2', 'utf-8')
    const result = await read_file.execute({ path: 'hello.txt' }, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('hello world')
    expect(result.output).toContain('line 2')
    expect(result.output).toMatch(/^\s*1\s+/) // 第一行有行号
  })

  it('文件不存在时返回 success=false', async () => {
    const result = await read_file.execute({ path: 'no-such.txt' }, ctx)
    expect(result.success).toBe(false)
    expect(result.error).toContain('文件不存在')
  })

  it('目录而非文件时返回错误', async () => {
    fs.mkdirSync(path.join(tmpDir, 'subdir'), { recursive: true })
    const result = await read_file.execute({ path: 'subdir' }, ctx)
    expect(result.success).toBe(false)
    expect(result.error).toContain('是目录')
  })

  it('缺少 path 参数返回错误', async () => {
    const result = await read_file.execute({}, ctx)
    expect(result.success).toBe(false)
  })
})

describe('list_dir 工具', () => {
  let tmpDir: string
  let ctx: ToolContext

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-listdir-'))
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a', 'utf-8')
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'b', 'utf-8')
    fs.mkdirSync(path.join(tmpDir, 'sub'))
    ctx = { workspacePath: tmpDir }
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('列出目录中所有条目', async () => {
    const result = await list_dir.execute({ path: '.' }, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('a.txt')
    expect(result.output).toContain('b.txt')
    expect(result.output).toContain('sub/')
  })

  it('默认路径 .', async () => {
    const result = await list_dir.execute({}, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('a.txt')
  })

  it('目录不存在时返回错误', async () => {
    const result = await list_dir.execute({ path: 'no-such' }, ctx)
    expect(result.success).toBe(false)
  })
})

describe('grep 工具', () => {
  let tmpDir: string
  let ctx: ToolContext

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-grep-'))
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'hello world\nfoo bar', 'utf-8')
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'hello again', 'utf-8')
    ctx = { workspacePath: tmpDir }
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('跨多个文件搜索匹配行', async () => {
    const result = await grep.execute({ pattern: 'hello', path: '.' }, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('a.txt')
    expect(result.output).toContain('b.txt')
  })

  it('无匹配返回空结果', async () => {
    const result = await grep.execute({ pattern: 'no-match-xyz', path: '.' }, ctx)
    expect(result.success).toBe(true)
    expect(result.output).not.toContain('a.txt:')
  })
})

describe('glob 工具', () => {
  let tmpDir: string
  let ctx: ToolContext

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-glob-'))
    fs.writeFileSync(path.join(tmpDir, 'test.ts'), 'export {}', 'utf-8')
    fs.writeFileSync(path.join(tmpDir, 'test.js'), 'export {}', 'utf-8')
    fs.writeFileSync(path.join(tmpDir, 'readme.md'), 'docs', 'utf-8')
    ctx = { workspacePath: tmpDir }
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('匹配 .ts 扩展', async () => {
    const result = await glob.execute({ pattern: '*.ts' }, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('test.ts')
    expect(result.output).not.toContain('test.js')
  })

  it('多扩展模式', async () => {
    const result = await glob.execute({ pattern: '*.{ts,js}' }, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('test.ts')
    expect(result.output).toContain('test.js')
  })
})

describe('run_command 工具(危险,需 confirmDangerous)', () => {
  let tmpDir: string
  let ctx: ToolContext

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-runcmd-'))
    ctx = { workspacePath: tmpDir }
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('confirmDangerous=false 时拒绝', async () => {
    const result = await run_command.execute({ command: 'echo hello' }, ctx)
    expect(result.success).toBe(false)
    expect(result.error).toContain('被拒绝')
  })

  it('confirmDangerous=true 时执行', async () => {
    const ctx2: ToolContext = {
      workspacePath: tmpDir,
      confirmDangerous: async () => true,
    }
    const result = await run_command.execute({ command: 'node -e "console.log(42)"' }, ctx2)
    expect(result.success).toBe(true)
    expect(result.output).toContain('42')
  })
})
