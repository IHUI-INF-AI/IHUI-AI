// 跨平台 nul 残留扫描（Windows NUL 设备别名文件）
// 用法：
//   node scripts/check-nul.mjs           # 默认：仅警告（不阻断）
//   node scripts/check-nul.mjs --strict  # 严格：发现 nul 时 exit 1（CI 用）
//   node scripts/check-nul.mjs --help    # 帮助
//
// 不阻断提交的设计：pre-commit 钩子希望对开发者友好；CI 端用 --strict 真正拦截。
import { readdirSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 从 __dirname 向上找 git 根（兼容 monorepo 子项目）
const __dirname = dirname(fileURLToPath(import.meta.url))
// scripts/ 在 client 项目直接父目录，server/edu 在 scripts/dev/ 上两级
const ROOT = resolve(__dirname, '..', '..')

const RESERVED = ['nul', 'NUL', 'Con', 'CON', 'Prn', 'PRN', 'Aux', 'AUX']

// 排除目录（提升性能 + 避免误报）
const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'target',
  '.git',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  '.mypy_cache',
  '.pytest_cache',
  '.ruff_cache',
  '.tox',
  '.eggs',
  'htmlcov',
  'coverage',
  '.idea',
  '.vscode',
  'site-packages'
])

// 解析命令行参数
const args = process.argv.slice(2)
const STRICT = args.includes('--strict')
const HELP = args.includes('--help') || args.includes('-h')

function help() {
  console.log(`
check-nul.mjs - 跨平台 nul 残留扫描

用法：
  node scripts/check-nul.mjs           # 默认：仅警告
  node scripts/check-nul.mjs --strict  # 严格：发现 nul 时 exit 1
  node scripts/check-nul.mjs --help    # 帮助

退出码：
  0  无 nul 残留
  1  发现 nul 残留（仅 --strict 模式）
  2  参数错误

说明：
  Windows PowerShell/IDE 终端偶发把 \`>nul\` 重定向当作文件名写入当前目录，
  本脚本用 libuv 扫描 nul/NUL/Con/Prn/Aux 等 Windows 保留设备名文件。
  PowerShell 自带的 Test-Path/Get-Item API 看不到这些文件，但 libuv 可以。
`)
}

if (HELP) {
  help()
  process.exit(0)
}

if (args.length > 0 && !STRICT) {
  console.error('Unknown argument: ' + args.filter(a => a !== '--strict').join(' '))
  help()
  process.exit(2)
}

/**
 * 递归扫描目录，查找保留设备名文件
 */
function scanDir(dir, results) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    return
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue
    if (entry.name.endsWith('.egg-info')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      scanDir(full, results)
    } else if (entry.isFile() && RESERVED.includes(entry.name)) {
      const rel = relative(ROOT, full)
      let size = 0
      try { size = statSync(full).size } catch (e) {}
      results.push({ path: rel, abs: full, size })
    }
  }
}

function main() {
  const results = []
  scanDir(ROOT, results)

  if (results.length === 0) {
    console.log('[check-nul] OK：无 Windows 保留设备名残留文件')
    process.exit(0)
  }

  console.log('')
  console.log('[check-nul] ⚠️  发现 Windows 保留设备名残留文件：')
  console.log('   （通常为 PowerShell/IDE 终端把 `>nul` 重定向误写入当前目录所致）')
  console.log('')
  for (const r of results) {
    console.log(`   - ${r.path}  (${r.size} bytes)`)
  }
  console.log('')
  console.log('   建议：')
  console.log('   1. 在 PowerShell 脚本中用 `> $null` / `Out-Null` 替代 `>nul`')
  console.log('   2. 在 cmd / .bat 中用大写 `>NUL`（行为等价）')
  console.log('   3. 如需删除，请调用同目录的 del_nul.mjs（用 libuv fsync 跨平台删除）')
  console.log('      node scripts/del_nul.mjs')
  console.log('')

  if (STRICT) {
    console.log('   [strict 模式] CI 阻断：发现 nul 残留，必须先清理再继续')
    process.exit(1)
  }
  // 默认模式：仅警告，不阻断
  process.exit(0)
}

main()
