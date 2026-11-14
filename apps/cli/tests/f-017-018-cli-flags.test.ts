// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-017 / F-018 回归钉。
 *
 * F-017 非法数值/枚举静默回落:
 *   - `undo abc` / `undo 0` / `redo 1.5` 修前是 `Number(x) || 1` ⇒ 用户给的数被换成 1;
 *   - `audit query --limit abc` 修前 parseInt 后回落默认值;
 *   - `share -f txt` / `share --format txt` 修前用 `as` 强转,照样按 markdown 产出;
 *   - `--output-format jsn` 修前被 parseOutputFormat 静默换成 text。
 *   修后:一律显式报错并经 errorExit 非零退出,不得回落默认值。
 *
 * F-018 json 判据双源:
 *   - jsonMode 只能有一个判据来源(headless-format.resolveJsonMode:全局值 + 子命令值合并,
 *     stdout 非 TTY 仍按机器档 —— 这是 F-011/F-012 的既有语义);
 *   - `ihui --json audit query` 与 `ihui audit query --json` 必须逐字节同义。
 *
 * 这里钉的是**行为**(子进程真跑 CLI),外加两条形状锁防止判据被重新抄成第二份。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import * as os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resolveJsonMode } from '../src/headless-format.js'

const CLI_DIR = path.join(__dirname, '..')
const CLI = path.join(CLI_DIR, 'src', 'index.ts')
// 跨平台启动:Windows 下不能直调 .bin/tsx 的 shell 包装,统一用 node 跑 tsx CLI。
const tsxCli = path.join(CLI_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs')

const CHILD_TIMEOUT_MS = 60_000
const TEST_TIMEOUT_MS = 70_000

// 冷启动要编译整个导入图(本机实测 3~5s,全量并行时更慢),故子进程给 60s 硬预算。
const COMMON_ARGS = ['--no-setup', '--no-update-check']

interface RunResult {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
}

function runCli(args: string[], home: string, cwd: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, CLI, ...COMMON_ARGS, ...args], {
      cwd,
      // 隔离 HOME:首次运行引导/审计日志/运行清单都不落到真实 ~/.ihui。
      env: { ...process.env, HOME: home, USERPROFILE: home, IHUI_NO_UPDATE_CHECK: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.setEncoding('utf-8')
    child.stderr?.setEncoding('utf-8')
    child.stdout?.on('data', (chunk: string) => (stdout += chunk))
    child.stderr?.on('data', (chunk: string) => (stderr += chunk))
    const killer = setTimeout(() => child.kill('SIGKILL'), CHILD_TIMEOUT_MS)
    child.on('error', (err) => {
      clearTimeout(killer)
      reject(err)
    })
    child.on('close', (code, signal) => {
      clearTimeout(killer)
      resolve({ code, signal, stdout, stderr })
    })
  })
}

describe('F-017 非法数值/枚举:显式报错并非零退出', () => {
  let home = ''
  let cwd = ''

  beforeAll(() => {
    home = mkdtempSync(path.join(os.tmpdir(), 'f017-home-'))
    cwd = mkdtempSync(path.join(os.tmpdir(), 'f017-cwd-'))
  })

  afterAll(() => {
    rmSync(home, { recursive: true, force: true })
    rmSync(cwd, { recursive: true, force: true })
  })

  it('`undo abc` 退非零,stderr 点名非法步数(不再静默撤 1 步)', async () => {
    const r = await runCli(['undo', 'abc'], home, cwd)
    expect(r.signal).toBeNull()
    expect(r.code).not.toBe(0)
    expect(r.stderr).toContain('Invalid steps value: abc')
  }, TEST_TIMEOUT_MS)

  it('`undo 0` 退非零(修前会被 `|| 1` 换成撤 1 步)', async () => {
    const r = await runCli(['undo', '0'], home, cwd)
    expect(r.code).not.toBe(0)
    expect(r.stderr).toContain('Invalid steps value: 0')
  }, TEST_TIMEOUT_MS)

  it('`redo 1.5` 退非零(步数必须是正整数)', async () => {
    const r = await runCli(['redo', '1.5'], home, cwd)
    expect(r.code).not.toBe(0)
    expect(r.stderr).toContain('Invalid steps value: 1.5')
  }, TEST_TIMEOUT_MS)

  it('`audit query --limit abc` 退非零(不再 parseInt 后回落 50)', async () => {
    const r = await runCli(['audit', 'query', '--limit', 'abc'], home, cwd)
    expect(r.code).not.toBe(0)
    expect(r.stderr).toContain('Invalid --limit value: abc')
    expect(r.stdout).not.toContain('"entries"')
  }, TEST_TIMEOUT_MS)

  it('`audit query --limit 0` 退非零(0 不是合法上限)', async () => {
    const r = await runCli(['audit', 'query', '--limit', '0'], home, cwd)
    expect(r.code).not.toBe(0)
    expect(r.stderr).toContain('Invalid --limit value: 0')
  }, TEST_TIMEOUT_MS)

  it('`share -f txt` 必须响:`-f` 被全局 `--prompt-file` 抢占时不得静默按 markdown 分享', async () => {
    const r = await runCli(['share', '-f', 'txt'], home, cwd)
    expect(r.code).not.toBe(0)
    expect(r.stderr).toContain('--format')
    expect(r.stderr).toContain('txt')
  }, TEST_TIMEOUT_MS)

  it('`share --format txt` 退非零并点名非法枚举(修前 `as` 强转照样产出 HTML)', async () => {
    const r = await runCli(['share', '--format', 'txt'], home, cwd)
    expect(r.code).not.toBe(0)
    expect(r.stderr).toContain('Invalid --format value: txt')
    expect(r.stderr).toContain('markdown|html|json')
  }, TEST_TIMEOUT_MS)

  it('`--output-format jsn` 退非零(不再静默回落 text)', async () => {
    const r = await runCli(['--output-format', 'jsn', 'hi'], home, cwd)
    expect(r.code).not.toBe(0)
    expect(r.stderr).toContain('Invalid --output-format value: jsn')
    expect(r.stderr).toContain('text|json|markdown|yaml')
  }, TEST_TIMEOUT_MS)
})

describe('F-018 jsonMode 单一判据:全局值与子命令值等价', () => {
  let home = ''
  let cwd = ''

  beforeAll(() => {
    home = mkdtempSync(path.join(os.tmpdir(), 'f018-home-'))
    cwd = mkdtempSync(path.join(os.tmpdir(), 'f018-cwd-'))
  })

  afterAll(() => {
    rmSync(home, { recursive: true, force: true })
    rmSync(cwd, { recursive: true, force: true })
  })

  it('判据本身:全局 --json / 子命令 --json 任一为真即机器档', () => {
    expect(resolveJsonMode({ json: true })).toBe(true)
    expect(resolveJsonMode(undefined, { json: true })).toBe(true)
    expect(resolveJsonMode({ json: false }, { json: true })).toBe(true)
    expect(resolveJsonMode({ json: true }, { json: false })).toBe(true)
  })

  it('判据本身:两者都没给时仍保留"stdout 非 TTY ⇒ 机器档"的既有语义', () => {
    expect(resolveJsonMode({}, {})).toBe(!process.stdout.isTTY)
    expect(resolveJsonMode(undefined, undefined)).toBe(!process.stdout.isTTY)
  })

  it('`ihui --json audit query` 与 `ihui audit query --json` 输出同义', async () => {
    const before = await runCli(['--json', 'audit', 'query'], home, cwd)
    const after = await runCli(['audit', 'query', '--json'], home, cwd)

    expect(before.code).toBe(0)
    expect(after.code).toBe(0)
    expect(before.stdout).not.toBe('')
    expect(JSON.parse(before.stdout)).toEqual(JSON.parse(after.stdout))
  }, TEST_TIMEOUT_MS)

  it('非 TTY 默认(不带 --json)同样走机器档:stdout 可被 JSON.parse', async () => {
    const r = await runCli(['audit', 'query'], home, cwd)
    expect(r.code).toBe(0)
    const parsed = JSON.parse(r.stdout) as { entries: unknown[] }
    expect(Array.isArray(parsed.entries)).toBe(true)
  }, TEST_TIMEOUT_MS)

  it('形状锁:security 的命令壳不再自持第二份 `Boolean(opts.json)`', () => {
    const src = readFileSync(path.join(CLI_DIR, 'src', 'commands', 'security.ts'), 'utf8')
    expect(src).toContain('resolveJsonMode(program.opts(), opts)')
    expect(src).not.toMatch(/Boolean\(opts\.json\)/)
  })

  it('形状锁:index.ts 不再出现 `program.opts().json === true` 与静默回落的数值解析', () => {
    const src = readFileSync(path.join(CLI_DIR, 'src', 'index.ts'), 'utf8')
    expect(src).not.toContain('program.opts().json === true')
    expect(src).not.toContain('Number(stepsArg) ||')
    expect(src).not.toMatch(/parseInt\(options\.limit/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
