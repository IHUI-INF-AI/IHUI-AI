/**
 * 文件操作命令 — REPL slash 命令的本地文件操作实现。
 * 对标 Claude Code 的文件查看/搜索/执行能力。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import chalk from 'chalk'
import { runSandboxed } from '../sandbox/index.js'
import { runPreToolCall, runPostToolCall } from '../hooks/index.js'

const MAX_GREP_RESULTS = 50
const MAX_GLOB_RESULTS = 50
const BASH_TIMEOUT_MS = 30_000
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.output', '.wxt'])

function resolvePath(workspacePath: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(workspacePath, filePath)
}

export function cmdRead(workspacePath: string, filePath: string): void {
  if (!filePath) {
    console.info(chalk.yellow('用法: /read <file>'))
    return
  }
  const fullPath = resolvePath(workspacePath, filePath)
  if (!fs.existsSync(fullPath)) {
    console.info(chalk.red(`文件不存在: ${filePath}`))
    return
  }
  const stat = fs.statSync(fullPath)
  if (stat.isDirectory()) {
    console.info(chalk.yellow(`是目录,用 /ls 查看: ${filePath}`))
    return
  }
  if (stat.size > 1024 * 1024) {
    console.info(chalk.yellow(`文件过大 (${(stat.size / 1024).toFixed(1)} KB),仅显示前 1000 行`))
  }
  const content = fs.readFileSync(fullPath, 'utf-8')
  const lines = content.split('\n').slice(0, 1000)
  lines.forEach((line, i) => {
    console.info(chalk.dim(`${String(i + 1).padStart(4)} `) + line)
  })
}

export function cmdLs(workspacePath: string, dirPath: string): void {
  const target = dirPath || '.'
  const fullPath = resolvePath(workspacePath, target)
  if (!fs.existsSync(fullPath)) {
    console.info(chalk.red(`路径不存在: ${target}`))
    return
  }
  const stat = fs.statSync(fullPath)
  if (!stat.isDirectory()) {
    console.info(chalk.yellow(`是文件,用 /read 查看: ${target}`))
    return
  }
  const entries = fs.readdirSync(fullPath, { withFileTypes: true })
  const dirs = entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
  const files = entries.filter((e) => e.isFile()).sort((a, b) => a.name.localeCompare(b.name))
  for (const d of dirs) console.info(`  ${chalk.cyan(d.name + '/')}`)
  for (const f of files) {
    const stat = fs.statSync(path.join(fullPath, f.name))
    const size = stat.size < 1024 ? `${stat.size}B` : `${(stat.size / 1024).toFixed(1)}K`
    console.info(`  ${f.name} ${chalk.dim(size)}`)
  }
}

export function cmdGrep(workspacePath: string, pattern: string, searchPath: string): void {
  if (!pattern) {
    console.info(chalk.yellow('用法: /grep <pattern> [path]'))
    return
  }
  let regex: RegExp
  try {
    regex = new RegExp(pattern, 'i')
  } catch {
    console.info(chalk.red(`无效的正则: ${pattern}`))
    return
  }
  const fullPath = resolvePath(workspacePath, searchPath || '.')
  if (!fs.existsSync(fullPath)) {
    console.info(chalk.red(`路径不存在: ${searchPath}`))
    return
  }
  const results: string[] = []

  function walk(dir: string): void {
    if (results.length >= MAX_GREP_RESULTS) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (results.length >= MAX_GREP_RESULTS) return
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        walk(entryPath)
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(entryPath, 'utf-8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i]!)) {
              const relPath = path.relative(workspacePath, entryPath)
              const line = lines[i]!.trim().slice(0, 120)
              results.push(`${chalk.dim(relPath)}:${chalk.cyan(String(i + 1))} ${line}`)
              if (results.length >= MAX_GREP_RESULTS) break
            }
          }
        } catch {
          // skip binary/unreadable files
        }
      }
    }
  }

  walk(fullPath)

  if (results.length === 0) {
    console.info(chalk.dim('未找到匹配'))
    return
  }
  for (const line of results) console.info(`  ${line}`)
  if (results.length >= MAX_GREP_RESULTS) {
    console.info(chalk.dim(`  ...结果过多,仅显示前 ${MAX_GREP_RESULTS} 条`))
  }
}

export function cmdGlob(workspacePath: string, pattern: string): void {
  if (!pattern) {
    console.info(chalk.yellow('用法: /glob <pattern> (如 *.ts, *.test.ts)'))
    return
  }
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  const regex = new RegExp(`^${regexStr}$`)
  const results: string[] = []

  function walk(dir: string): void {
    if (results.length >= MAX_GLOB_RESULTS) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (results.length >= MAX_GLOB_RESULTS) return
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        walk(path.join(dir, entry.name))
      } else if (regex.test(entry.name)) {
        results.push(path.relative(workspacePath, path.join(dir, entry.name)))
      }
    }
  }

  walk(workspacePath)

  if (results.length === 0) {
    console.info(chalk.dim('未找到匹配文件'))
    return
  }
  results.sort().forEach((f) => console.info(`  ${f}`))
  if (results.length >= MAX_GLOB_RESULTS) {
    console.info(chalk.dim(`  ...结果过多,仅显示前 ${MAX_GLOB_RESULTS} 个`))
  }
}

export function cmdBash(workspacePath: string, command: string): void {
  if (!command) {
    console.info(chalk.yellow('用法: /bash <command>'))
    return
  }

  const preResult = runPreToolCall('bash', { command, cwd: workspacePath })
  if (!preResult.proceed) {
    console.info(chalk.yellow(`⛔ ${preResult.reason}`))
    return
  }

  console.info(chalk.dim(`$ ${command}`))
  const result = runSandboxed(command, {
    cwd: workspacePath,
    timeoutMs: BASH_TIMEOUT_MS,
  })
  if (result.timedOut) {
    console.info(chalk.red(`⏱ 命令超时 (${BASH_TIMEOUT_MS / 1000}s)`))
  }
  if (result.stdout.trim()) console.info(result.stdout.trimEnd())
  if (result.stderr.trim()) console.info(chalk.red(result.stderr.trimEnd()))
  if (result.exitCode !== null && result.exitCode !== 0) {
    console.info(chalk.dim(`  exit: ${result.exitCode}`))
  }

  runPostToolCall('bash', { exitCode: result.exitCode, timedOut: result.timedOut })
}
