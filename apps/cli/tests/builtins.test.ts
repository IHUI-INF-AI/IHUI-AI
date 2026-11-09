// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  it('注册 17 个核心工具(含 4 个后台任务工具 + 5 个终端工具 + todo_write/todo_read + ask_user_question)', () => {
    expect(BUILTIN_TOOLS).toHaveLength(17)
    const names = BUILTIN_TOOLS.map((t) => t.name).sort()
    expect(names).toEqual([
      'ask_user_question',
      'get_command_output',
      'glob',
      'grep',
      'kill_command',
      'list_background_tasks',
      'list_dir',
      'read_file',
      'run_command',
      'terminal_close',
      'terminal_open',
      'terminal_read',
      'terminal_resize',
      'terminal_send',
      'todo_read',
      'todo_write',
      'wait_command',
    ])
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

  // 下面四枚钉的是 2026-11-05 抓到的一型静默假阴性:带 `**/` 的 pattern 恒不匹配,
  // 而工具回 success:true + "未找到匹配文件"。旧实现(链式字符串替换)让这四枚全红,
  // 摘掉本次重写即翻红 —— 本仓派班会话就是被这一型骗到"文件不存在"从而整班零写盘。
  it('`**/` 必须能穿多层目录(旧实现在这里恒返回未找到)', async () => {
    fs.mkdirSync(path.join(tmpDir, 'apps/api/src/routes'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'apps/api/src/routes/edu-attendance-rule.ts'), 'x', 'utf-8')
    const result = await glob.execute({ pattern: '**/*attendance*' }, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain('apps/api/src/routes/edu-attendance-rule.ts')
    expect(result.output).not.toContain('未找到')
  })

  it('`**/` 可匹配零目录(2026-09-03 注释声称的能力,此前无锁)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'stats.mjs'), 'x', 'utf-8')
    fs.mkdirSync(path.join(tmpDir, 'a/b/c'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'a/b/c/stats.mjs'), 'x', 'utf-8')
    const result = await glob.execute({ pattern: '**/stats.mjs' }, ctx)
    expect(result.output).toContain('stats.mjs')
    expect(result.output).toContain('a/b/c/stats.mjs')
  })

  it('单层 `*` 不跨目录段', async () => {
    fs.mkdirSync(path.join(tmpDir, 'apps/deep'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'apps/edu-attendance-rule.ts'), 'x', 'utf-8')
    fs.writeFileSync(path.join(tmpDir, 'apps/deep/edu-attendance-deep.ts'), 'x', 'utf-8')
    const result = await glob.execute({ pattern: 'apps/*attendance*' }, ctx)
    expect(result.output).toContain('apps/edu-attendance-rule.ts')
    expect(result.output).not.toContain('edu-attendance-deep.ts')
  })

  it('空匹配仍如实说"未找到"(修好匹配器不等于把假阴性改成真阴性)', async () => {
    const result = await glob.execute({ pattern: '**/*no-such-thing*' }, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toBe('未找到匹配文件')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
