// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-014 回归:`mcp add` 参数面两处漏洞。
 *
 * 1. 缺 command:`ihui mcp add foo` 旧实现只校验 name,addMcpServer 不做 command 判空
 *    就落盘,写出无 command 的坏 stdio 配置。判据:addMcpServer 落盘前抛错,CLI 走
 *    stderr + 非零退出,且配置文件不被创建。
 * 2. `-` 开头的参数:`--args -y pkg` 里 commander 变参遇 `-` 会提前收尾;`--args=-y`
 *    与 `--` 分隔的剩余参数此前要么报 "too many arguments",要么根本没被收集。
 *    判据:两条路径都要把 `['-y', 'pkg']` 原样写进配置。
 *
 * 用例直接复用 CLI 真实构建的 mcp add 子命令(buildMcpAddCommand),不经手写 argv 解析,
 * 免得测到的是测试自己的假设;home 用 vi.mock 重定向到临时目录,不碰真实 ~/.ihui。
 */
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import * as os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock 会被提升到 import 之前,引用普通变量会 TDZ 报错 ⇒ 用 hoisted 容器
const scratch = vi.hoisted(() => ({ dir: '' }))

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof os>('node:os')
  return { ...actual, homedir: () => scratch.dir }
})

import { Command } from 'commander'
import { addMcpServer, getMcpConfigPath } from '../src/commands/mcp-config.js'
import { buildMcpAddCommand } from '../src/index.js'

interface WrittenServer {
  name: string
  command?: string
  args?: string[]
  transport?: string
}

function readServers(): WrittenServer[] {
  const config = JSON.parse(readFileSync(getMcpConfigPath(), 'utf-8')) as { servers: WrittenServer[] }
  return config.servers
}

/** 走真实 commander 解析(与 index.ts 里生产挂载方式一致),不触发 main 分支。 */
async function runCliAdd(argv: string[]): Promise<void> {
  const program = new Command()
  program.exitOverride()
  program.configureOutput({ writeErr: () => undefined, writeOut: () => undefined })
  const mcpCmd = program.command('mcp')
  buildMcpAddCommand(mcpCmd)
  await program.parseAsync(['node', 'ihui', 'mcp', 'add', ...argv])
}

describe('F-014 ① 缺 command 的 stdio 配置不得落盘', () => {
  it('addMcpServer 直接拒绝缺 command / 空白 command', () => {
    expect(() => addMcpServer('foo', undefined)).toThrow(/要求非空 command/)
    expect(() => addMcpServer('foo', '   ')).toThrow(/要求非空 command/)
    expect(existsSync(getMcpConfigPath())).toBe(false)
  })

  it('http transport 缺 url 同样落盘前拒绝', () => {
    expect(() => addMcpServer('web', undefined, undefined, { transport: 'http' })).toThrow(/要求非空 url/)
    expect(existsSync(getMcpConfigPath())).toBe(false)
  })

  it('CLI `mcp add foo` 走 stderr + 非零退出,不写坏配置', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    // errorExit 会 process.exit(1);单测里必须拦下,否则整个 runner 被带走
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`)
    }) as never)
    try {
      await expect(runCliAdd(['foo'])).rejects.toThrow(/process\.exit\(1\)/)
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('要求非空 command'))
      expect(existsSync(getMcpConfigPath())).toBe(false)
    } finally {
      errorSpy.mockRestore()
      exitSpy.mockRestore()
    }
  })
})

describe('F-014 ② 以 - 开头的参数必须能传到 MCP server', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    scratch.dir = mkdtempSync(path.join(os.tmpdir(), 'f014-'))
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  })

  afterEach(() => {
    infoSpy.mockRestore()
  })

  it('--args=-y 形式:后续参数合并为 args,顺序不变', async () => {
    await runCliAdd(['x', 'npx', '--args=-y', 'pkg'])
    const server = readServers().find((s) => s.name === 'x')
    expect(server?.command).toBe('npx')
    expect(server?.args).toEqual(['-y', 'pkg'])
    expect(server?.transport).toBe('stdio')
  })

  it('`--` 分隔形式:剩余参数作为 args 落盘', async () => {
    await runCliAdd(['x', 'npx', '--', '-y', 'pkg'])
    expect(readServers().find((s) => s.name === 'x')?.args).toEqual(['-y', 'pkg'])
  })

  it('原有 `--args -y pkg` 形式保持可用', async () => {
    await runCliAdd(['x', 'npx', '--args', '-y', 'pkg'])
    expect(readServers().find((s) => s.name === 'x')?.args).toEqual(['-y', 'pkg'])
  })
})
