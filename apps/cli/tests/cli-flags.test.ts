// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI --version / --help flags 测试
 *
 * 覆盖:
 *   1. ihui --version 输出 package.json 中的版本号
 *   2. ihui --help 输出使用说明
 *   3. 子命令 ihui <cmd> --help 输出子命令帮助
 */
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CLI = join(__dirname, '..', 'src', 'index.ts')
// 跨平台启动:Windows 下 execFileSync 不能直接执行 .bin/tsx shell 包装
// (Node ≥20.13 对 .cmd/.bat 无 shell 直调会抛 EINVAL),统一用 node 直跑 tsx CLI 入口。
const tsxCli = join(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs')

// 全量并行时本机 CPU 竞争会把 tsx 冷启动整个 CLI 导入图拖到 10s 以上(实测 191 文件并行下
// 子进程被 timeout 掐死,exitCode 变 1)。给子进程 60s 硬预算,并把 vitest 单测超时抬到
// 70s(同步 execFileSync 会阻塞 worker,超时判红发生在预算之内而非测试逻辑)。
const CHILD_TIMEOUT_MS = 60_000
const TEST_TIMEOUT_MS = 70_000

function run(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync(process.execPath, [tsxCli, CLI, ...args], {
      encoding: 'utf-8',
      timeout: CHILD_TIMEOUT_MS,
      cwd: join(__dirname, '..'),
      windowsHide: true,
    })
    return { stdout, stderr: '', exitCode: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number }
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    }
  }
}

function readPkgVersion(): string {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
  ) as { version: string }
  return pkg.version
}

describe('CLI --version', () => {
  it('--version 输出版本号且与 package.json 一致', () => {
    const { stdout, exitCode } = run('--version')
    const pkgVersion = readPkgVersion()

    expect(exitCode).toBe(0)
    expect(stdout.trim()).toBe(pkgVersion)
  }, TEST_TIMEOUT_MS)

  it('-V 短选项同样输出版本号', () => {
    const { stdout, exitCode } = run('-V')
    const pkgVersion = readPkgVersion()

    expect(exitCode).toBe(0)
    expect(stdout.trim()).toBe(pkgVersion)
  }, TEST_TIMEOUT_MS)
})

describe('CLI --help', () => {
  it('--help 输出使用说明', () => {
    const { stdout, exitCode } = run('--help')

    expect(exitCode).toBe(0)
    expect(stdout).toContain('Usage:')
    expect(stdout).toContain('ihui')
    expect(stdout).toContain('Options:')
    expect(stdout).toContain('--version')
    expect(stdout).toContain('--help')
  }, TEST_TIMEOUT_MS)

  it('-h 短选项同样输出使用说明', () => {
    const { stdout, exitCode } = run('-h')

    expect(exitCode).toBe(0)
    expect(stdout).toContain('Usage:')
  }, TEST_TIMEOUT_MS)
})

describe('子命令 --help', () => {
  const subcommands = ['chat', 'agent', 'init', 'sessions', 'mcp']

  for (const cmd of subcommands) {
    it(`${cmd} --help 输出子命令帮助`, () => {
      const { stdout, exitCode } = run(cmd, '--help')

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Usage:')
      expect(stdout).toContain('Options:')
      expect(stdout).toContain('--help')
    }, TEST_TIMEOUT_MS)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
