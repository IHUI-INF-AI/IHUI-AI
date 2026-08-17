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
const tsx = join(__dirname, '..', 'node_modules', '.bin', 'tsx')

function run(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync(tsx, [CLI, ...args], {
      encoding: 'utf-8',
      timeout: 10_000,
      cwd: join(__dirname, '..'),
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
  })

  it('-V 短选项同样输出版本号', () => {
    const { stdout, exitCode } = run('-V')
    const pkgVersion = readPkgVersion()

    expect(exitCode).toBe(0)
    expect(stdout.trim()).toBe(pkgVersion)
  })
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
  })

  it('-h 短选项同样输出使用说明', () => {
    const { stdout, exitCode } = run('-h')

    expect(exitCode).toBe(0)
    expect(stdout).toContain('Usage:')
  })
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
    })
  }
})
