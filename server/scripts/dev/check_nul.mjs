// 跨平台 nul 残留扫描（Windows NUL 设备别名文件）
// 用法：node scripts/dev/check_nul.mjs
// 不阻断提交，仅警告（兜底已加 .gitignore）
import { readdirSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 从 __dirname 向上找 git 根（兼容 monorepo 子项目）
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')

const RESERVED = ['nul', 'NUL', 'Con', 'CON', 'Prn', 'PRN', 'Aux', 'AUX']
const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
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
  console.log('   （通常为 PowerShell/IDE 终端把 `>nul` 重定向误写入当前目录所致，')
  console.log('   已在 .gitignore 兜底忽略，仅作提醒）')
  console.log('')
  for (const r of results) {
    console.log(`   - ${r.path}  (${r.size} bytes)`)
  }
  console.log('')
  console.log('   建议：')
  console.log('   1. 在 PowerShell 脚本中用 `> $null` / `Out-Null` 替代 `>nul`')
  console.log('   2. 在 cmd / .bat 中用大写 `>NUL`（行为等价）')
  console.log('   3. 如需删除，可执行 scripts/dev/del_nul.mjs')
  console.log('')
  process.exit(0)
}

main()
