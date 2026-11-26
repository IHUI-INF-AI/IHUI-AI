// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L05/RP-8 桌面通道注册表棘轮(2026-11-26)。
 *
 * 两条判据:
 *  1. `apps/web/src` 里不许再出现 `invoke('<字面量>'` —— 命令名只能来自
 *     `apps/web/src/lib/desktop-commands.ts`;调用点写字符串就是第二真相源。
 *  2. 注册表里的每个值必须在 Rust 侧真实存在(`fn <name>` 能在 `apps/desktop/src-tauri/src`
 *     找到)—— 登记一个不存在的命令,等于给前端发一张永远打不通的号码。
 *
 * 取材纪律(门 118):只用 `git grep` 列行,正文用 face-reader 读 worktree 面。
 * 入口纪律(门 194):末尾 direct-run 守卫。
 */

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY = 'apps/web/src/lib/desktop-commands.ts'

function gitGrepLines(pattern, paths) {
  try {
    return execFileSync('git', ['grep', '-n', '-E', pattern, '--', ...paths], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split(/\r?\n/)
      .filter(Boolean)
  } catch (error) {
    if (error?.status === 1) return []
    throw error
  }
}

function commandExistsInRust(name) {
  try {
    const out = execFileSync(
      'git',
      ['grep', '-l', '-F', `fn ${name}`, '--', 'apps/desktop/src-tauri/src'],
      { cwd: ROOT, encoding: 'utf8' },
    )
    return out.trim().length > 0
  } catch (error) {
    if (error?.status === 1) return false
    throw error
  }
}

export function readRegistryValues() {
  const src = readWorktreeFile(ROOT, REGISTRY)
  const block = src.split('export const DESKTOP_COMMANDS')[1] ?? ''
  const values = []
  for (const m of block.matchAll(/\n\s+[A-Za-z0-9_]+:\s*'([a-z0-9_]+)'/g)) {
    values.push(m[1])
  }
  return values
}

export function main() {
  const literals = gitGrepLines("invoke\\(\\s*['\"][a-z0-9_]+['\"]", ['apps/web/src']).filter(
    (line) => !line.startsWith(`${REGISTRY}:`),
  )
  const values = readRegistryValues()
  const missingInRust = values.filter((name) => !commandExistsInRust(name))
  const duplicates = values.filter((name, i) => values.indexOf(name) !== i)
  const offenders = literals.length + missingInRust.length + duplicates.length
  const state = offenders ? 'red' : 'ok'
  console.log(
    `[L05 桌面通道注册表] state=${state} 注册=${values.length} 调用点字面量=${literals.length} 无对应命令=${missingInRust.length} 重名=${duplicates.length}`,
  )
  for (const line of literals) console.log(`  ❌ 调用点写死命令名(应改 DESKTOP_COMMANDS.*): ${line}`)
  for (const name of missingInRust) console.log(`  ❌ 注册表登记了 Rust 侧不存在的命令: ${name}`)
  for (const name of duplicates) console.log(`  ❌ 注册表内重复登记: ${name}`)
  if (!offenders) console.log('  ✅ 命令名单一来源,且每条都能在 Rust 侧找到实现')
  process.exit(offenders ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
