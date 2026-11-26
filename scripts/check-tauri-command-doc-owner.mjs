// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L04/RP-3 暴露面第二层:Tauri 命令必须带「用途」文档注释(2026-11-26)。
 *
 * 为什么是这条判据:本仓桌面端不是 Electron,没有 preload 命名空间那套「键数 ≤20」
 * 的形态;真实暴露面就是 `#[tauri::command]`。第一层已由
 * `check-ipc-command-budget.mjs` 把总量钉在基线(122 枚 / 17 文件,只许减不许增);
 * 本闸补的是「每个命令都要说清自己是干什么的」—— 命令名是英文动词,半年后没人记得
 * 它为什么存在,而暴露面里最危险的就是"没人知道它为什么在"。
 *
 * 判据:每个 `#[tauri::command]` 向上(跳过空行与其它 `#[...]` 属性)必须能找到
 * `///` 文档行。`owner` 由文件路径结构性给出(命令必须定义在有主的模块文件里),
 * 不要求在注释里重复写模块名 —— 重复写反而会与实际文件漂移。
 *
 * 取材纪律(门 118):只用 `git grep -l` 列文件,正文用 face-reader 读 worktree 面。
 * 入口纪律(门 194):末尾 direct-run 守卫。
 */

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCAN_PATH = 'apps/desktop/src-tauri/src'
const COMMAND_ATTR = /^\s*#\[tauri::command/

function listFiles() {
  try {
    return execFileSync('git', ['grep', '-l', '-F', '#[tauri::command]', '--', SCAN_PATH], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  } catch (error) {
    if (error?.status === 1) return []
    throw error
  }
}

export function analyzeSource(relPath, source) {
  const lines = source.split(/\r?\n/)
  const findings = []
  let total = 0
  for (let i = 0; i < lines.length; i += 1) {
    if (!COMMAND_ATTR.test(lines[i])) continue
    total += 1
    let j = i - 1
    while (j >= 0 && (lines[j].trim() === '' || /^\s*#\[/.test(lines[j]))) j -= 1
    const documented = j >= 0 && lines[j].trim().startsWith('///')
    let k = i + 1
    while (k < lines.length && !/\bfn\s+[A-Za-z0-9_]/.test(lines[k])) k += 1
    const fn = k < lines.length ? lines[k].match(/\bfn\s+([A-Za-z0-9_]+)/)?.[1] ?? 'unknown' : 'unknown'
    if (!documented) findings.push(`${relPath}#${fn}`)
  }
  return { total, undocumented: findings }
}

export function loadBaseline() {
  try {
    const raw = readWorktreeFile(ROOT, 'scripts/data/tauri-command-doc-baseline.json')
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed.entries) ? parsed.entries : [])
  } catch {
    return new Set()
  }
}

export function main() {
  const files = listFiles()
  const baseline = loadBaseline()
  let total = 0
  const undocumented = []
  for (const file of files) {
    let source
    try {
      source = readWorktreeFile(ROOT, file)
    } catch {
      undocumented.push(`${file}#<unreadable>`)
      continue
    }
    const r = analyzeSource(file, source)
    total += r.total
    undocumented.push(...r.undocumented)
  }
  const known = undocumented.filter((id) => baseline.has(id))
  const offenders = undocumented.filter((id) => !baseline.has(id))
  const stale = [...baseline].filter((id) => !undocumented.includes(id))
  const state = offenders.length ? 'red' : 'ok'
  console.log(
    `[L04 命令暴露面文档] state=${state} 文件=${files.length} 命令=${total} 缺文档=${undocumented.length} 存量债=${known.length} 新增越界=${offenders.length}`,
  )
  for (const id of offenders) console.log(`  ❌ ${id} 缺少 /// 用途注释(新命令必须有说明)`)
  if (!offenders.length && known.length) {
    console.log('  ⚠️ 存量债按 scripts/data/tauri-command-doc-baseline.json 登记;补完一条即从表中删一条')
  }
  if (stale.length) console.log(`  ⚠️ 基线里有 ${stale.length} 条已不再缺文档,可删:${stale.slice(0, 3).join(', ')}…`)
  if (!undocumented.length) console.log('  ✅ 每条 tauri 命令都带用途文档')
  process.exit(offenders.length ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
