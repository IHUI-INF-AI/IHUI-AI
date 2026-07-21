/**
 * 文件操作命令 — REPL slash 命令的本地文件操作实现。
 * 对标 Claude Code 的文件查看/搜索/执行能力。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import chalk from 'chalk'
import { runSandboxed } from '../sandbox/index.js'
import { runPreToolCall, runPostToolCall } from '../hooks/index.js'
import type { CheckpointManager } from '../checkpoints/index.js'

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
  const sizeLabel = stat.size < 1024 ? `${stat.size}B` : `${(stat.size / 1024).toFixed(1)}KB`
  const showTruncate = stat.size > 1024 * 1024
  if (showTruncate) {
    console.info(chalk.yellow(`文件过大 (${(stat.size / 1024).toFixed(1)} KB),仅显示前 1000 行`))
  }
  const content = fs.readFileSync(fullPath, 'utf-8')
  const lines = content.split('\n').slice(0, 1000)
  // 卡片化:头部信息条 + 行号 + 内容
  const header = `📄 ${filePath}  ${chalk.dim(`${lines.length} 行 · ${sizeLabel}`)}`
  console.info(chalk.cyan(`\n╭─ ${header}`))
  console.info(chalk.cyan('│'))
  lines.forEach((line, i) => {
    const num = chalk.dim(String(i + 1).padStart(4, ' ') + ' ')
    // 空行用 dim 占位,避免显示空白
    const display = line.length === 0 ? chalk.dim('·') : line
    console.info(`${chalk.cyan('│')} ${num}${display}`)
  })
  console.info(chalk.cyan('╰─'))
  console.info('')
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
  const total = dirs.length + files.length
  // 卡片化:头部信息条 + 树形结构(目录在前,文件在后)
  console.info(chalk.cyan(`\n╭─ 📁 ${target}  ${chalk.dim(`${total} 项 · ${dirs.length} 目录 / ${files.length} 文件`)}`))
  console.info(chalk.cyan('│'))
  // 目录列表(树形 ├─ / └─)
  dirs.forEach((d, i) => {
    const isLast = i === dirs.length - 1 && files.length === 0
    const branch = isLast ? '└─' : '├─'
    console.info(`${chalk.cyan('│')} ${chalk.dim(branch)} ${chalk.cyan.bold(d.name + '/')}`)
  })
  // 文件列表(带大小)
  files.forEach((f, i) => {
    const isLast = i === files.length - 1
    const branch = isLast ? '└─' : '├─'
    let fstat: fs.Stats
    try {
      fstat = fs.statSync(path.join(fullPath, f.name))
    } catch {
      console.info(`${chalk.cyan('│')} ${chalk.dim(branch)} ${f.name}`)
      return
    }
    const size = fstat.size < 1024 ? `${fstat.size}B` : `${(fstat.size / 1024).toFixed(1)}K`
    const sizeLabel = chalk.dim(size.padStart(8))
    console.info(`${chalk.cyan('│')} ${chalk.dim(branch)} ${f.name} ${sizeLabel}`)
  })
  console.info(chalk.cyan('╰─'))
  console.info('')
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
  // 卡片化:头部信息条 + 按文件分组折叠(粗略实现:连续相同路径前缀合并)
  console.info(chalk.cyan(`\n╭─ 🔍 ${pattern}  ${chalk.dim(`${results.length} 匹配` + (results.length >= MAX_GREP_RESULTS ? ' · 截断' : ''))}`))
  console.info(chalk.cyan('│'))
  let lastFile = ''
  results.forEach((line, i) => {
    // line 格式:"path:lineNum content"
    const colonIdx = line.indexOf(':')
    const file = colonIdx > 0 ? line.slice(0, colonIdx) : ''
    const rest = colonIdx > 0 ? line.slice(colonIdx + 1) : line
    // 文件切换时打印文件名作为分组标题
    if (file && file !== lastFile) {
      if (lastFile) console.info(`${chalk.cyan('│')}`)
      console.info(`${chalk.cyan('│')} ${chalk.magenta.bold(file)}`)
      lastFile = file
    }
    const branch = i === results.length - 1 ? '└─' : '├─'
    console.info(`${chalk.cyan('│')}   ${chalk.dim(branch)} ${rest}`)
  })
  if (results.length >= MAX_GREP_RESULTS) {
    console.info(`${chalk.cyan('│')} ${chalk.dim(`...结果过多,仅显示前 ${MAX_GREP_RESULTS} 条`)}`)
  }
  console.info(chalk.cyan('╰─'))
  console.info('')
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
  // 卡片化:头部信息条 + 树形结构(按目录分组)
  results.sort()
  console.info(chalk.cyan(`\n╭─ 📋 ${pattern}  ${chalk.dim(`${results.length} 文件` + (results.length >= MAX_GLOB_RESULTS ? ' · 截断' : ''))}`))
  console.info(chalk.cyan('│'))
  // 按目录分组
  let lastDir = ''
  results.forEach((f, i) => {
    const lastSlash = f.lastIndexOf('/')
    const dir = lastSlash > 0 ? f.slice(0, lastSlash) : '.'
    const name = lastSlash > 0 ? f.slice(lastSlash + 1) : f
    if (dir !== lastDir) {
      if (lastDir) console.info(`${chalk.cyan('│')}`)
      console.info(`${chalk.cyan('│')} ${chalk.magenta.bold(dir + '/')}`)
      lastDir = dir
    }
    const branch = i === results.length - 1 || results[i + 1]?.slice(0, results[i + 1]!.lastIndexOf('/')) !== dir ? '└─' : '├─'
    console.info(`${chalk.cyan('│')}   ${chalk.dim(branch)} ${chalk.cyan(name)}`)
  })
  if (results.length >= MAX_GLOB_RESULTS) {
    console.info(`${chalk.cyan('│')} ${chalk.dim(`...结果过多,仅显示前 ${MAX_GLOB_RESULTS} 个`)}`)
  }
  console.info(chalk.cyan('╰─'))
  console.info('')
}

export function cmdBash(workspacePath: string, command: string, checkpoints?: CheckpointManager): void {
  if (!command) {
    console.info(chalk.yellow('用法: /bash <command>'))
    return
  }

  const preResult = runPreToolCall('bash', { command, cwd: workspacePath })
  if (!preResult.proceed) {
    console.info(chalk.yellow(`⛔ ${preResult.reason}`))
    return
  }

  let autoCheckpointId: string | null = null
  if (checkpoints) {
    const filesToSnapshot = extractFilePathsFromCommand(command, workspacePath)
    if (filesToSnapshot.length > 0) {
      try {
        const meta = checkpoints.snapshotSync(filesToSnapshot, 'auto_pre_bash')
        autoCheckpointId = meta.id
        console.info(chalk.dim(`  📸 自动检查点: ${meta.id} (${Object.keys(meta.files).length} 文件)`))
      } catch {
        // 快照失败不阻塞命令执行
      }
    }
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
  if (autoCheckpointId && result.exitCode !== null && result.exitCode !== 0) {
    console.info(chalk.yellow(`  💡 可用 /rollback ${autoCheckpointId} 回滚到此检查点`))
  }

  const postResult = runPostToolCall('bash', { exitCode: result.exitCode, timedOut: result.timedOut })
  if (!postResult.proceed) {
    console.info(chalk.yellow(`⚠ ${postResult.reason}`))
  }
}

function extractFilePathsFromCommand(command: string, workspacePath: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!
    if (quote) {
      if (ch === quote) quote = null
      else current += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (/\s/.test(ch)) {
      if (current) { tokens.push(current); current = '' }
    } else {
      current += ch
    }
  }
  if (current) tokens.push(current)
  const paths: string[] = []
  for (const t of tokens) {
    if (!t.includes('/') && !t.includes('\\') && !t.includes(path.sep)) continue
    const abs = path.isAbsolute(t) ? t : path.resolve(workspacePath, t)
    if (fs.existsSync(abs)) paths.push(abs)
  }
  return paths
}
