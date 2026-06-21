#!/usr/bin/env node
/**
 * 建议 13: 静态扫描所有 .ps1 文件, 强制 CRLF 行尾
 *
 * 背景:
 *   之前 dev-up.ps1 因 Edit 工具丢失 \r 导致 L92-L95 被 PowerShell parser
 *   当成同一行, 报 L96 Unexpected token '}' (12 行的延迟定位)
 *
 * 触发:
 *   - pre-commit: lint-staged -> scripts/*.ps1
 *   - ci: smoke-fast-gate job 第一步 (无需后端)
 *   - 手动: node scripts/check-line-endings.mjs
 *
 * 规则:
 *   - 所有 .ps1 文件必须使用 CRLF
 *   - 所有 .psm1 / .psd1 文件必须使用 CRLF
 *   - 允许豁免: node_modules/, .git/, dist/, build/
 *   - 豁免 .sh / .mjs (Unix 风格 LF 是合法的)
 *
 * 退出码: 0=全部通过, 1=发现 LF-only 文件
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = process.cwd()
// 允许的 PowerShell 扩展名
const PS_EXT = new Set(['.ps1', '.psm1', '.psd1'])
// 豁免目录
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.venv', '__pycache__', 'logs', '.cache'])

let totalFiles = 0
let badFiles = 0
const violations = []

function scan(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue
      scan(full)
    } else if (entry.isFile() && PS_EXT.has(extname(entry.name))) {
      totalFiles++
      const buf = readFileSync(full)
      // 检查是否存在 LF 前面没有 CR 的情况
      let hasLfOnly = false
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] === 0x0A) {
          if (i === 0 || buf[i - 1] !== 0x0D) {
            hasLfOnly = true
            break
          }
        }
      }
      if (hasLfOnly) {
        badFiles++
        violations.push(full)
      }
    }
  }
}

scan(ROOT)

if (badFiles === 0) {
  console.log(`[OK] ${totalFiles} 个 PowerShell 文件全部使用 CRLF 行尾`)
  process.exit(0)
} else {
  console.error(`[FAIL] ${badFiles}/${totalFiles} 个 PowerShell 文件使用 LF-only 行尾, 必须转换为 CRLF:`)
  for (const v of violations) {
    console.error(`  - ${v}`)
  }
  console.error('')
  console.error('修复方法:')
  console.error('  # PowerShell')
  console.error('  Get-Content file.ps1 -Raw | ForEach-Object { $_ -replace "`r?`n", "`r`n" } | Set-Content file.ps1 -NoNewline')
  console.error('  # Node (跨平台)')
  console.error('  node -e "const fs=require(\'fs\');const p=process.argv[1];const b=fs.readFileSync(p);let o=Buffer.alloc(0);for(let i=0;i<b.length;i++){if(b[i]===0x0A&&(i===0||b[i-1]!==0x0D))o=Buffer.concat([o,Buffer.from([0x0D])]);o=Buffer.concat([o,Buffer.from([b[i]])]);}fs.writeFileSync(p,o);" file.ps1')
  process.exit(1)
}
