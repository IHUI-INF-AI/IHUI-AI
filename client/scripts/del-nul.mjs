// 强删 Windows 保留设备名文件
// Node.js 的 readdirSync 能看到 nul/Con/Prn 等（libuv 调 Win32 FindFirstFileW），
// 但 PowerShell 的 Test-Path/Get-Item API 看不到（可能 NTFS 元数据缓存异常）
// 这里尝试用 libuv 的 fs.unlinkSync 删
import { readdirSync, statSync, unlinkSync, rmdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const RESERVED = ['nul', 'NUL', 'Con', 'CON', 'Prn', 'PRN', 'Aux', 'AUX']
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', '.vite', '.cache', 'coverage', '.nuxt', '.next', '.output', 'storybook-static'])

function scanDir(dir, results) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    return
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue
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
    console.log('[del-nul] 无 nul 残留，跳过')
    process.exit(0)
  }
  console.log('[del-nul] 发现 ' + results.length + ' 个 nul 残留，尝试删除：')
  let ok = 0
  let fail = 0
  for (const r of results) {
    try {
      unlinkSync(r.abs)
      console.log('  DEL  ' + r.path + '  (' + r.size + ' bytes)')
      ok++
    } catch (e) {
      console.log('  FAIL ' + r.path + ' :: ' + e.message)
      fail++
    }
  }
  console.log('[del-nul] 完成：' + ok + ' 成功 / ' + fail + ' 失败')
  process.exit(fail > 0 ? 1 : 0)
}

main()
