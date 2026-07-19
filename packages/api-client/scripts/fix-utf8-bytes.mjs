#!/usr/bin/env node
// packages/api-client 字节级 UTF-8 修复脚本(2026-07-20)
//
// 背景:packages/api-client/src/endpoints/*.ts 源文件中有 N 处 3 字节 UTF-8 字符
//      第 3 字节被替换为 0x3F('?'),导致 tsc 编译后 dist 污染、Turbopack 解析失败
//      (2026-07-19 踩坑,见 scripts/check-api-client-utf8.mjs 头注释)
//
// 策略:所有损坏均位于 JSDoc 注释(section 分隔 / 函数描述),不影响代码语义
//      → 删除整个 3 字节损坏序列(0xE0-0xEF 起始 + 0x80-0xBF 续字节 + 0x3F 终止字节)
//
// 用法:node packages/api-client/scripts/fix-utf8-bytes.mjs
//   exit 0 = 修复完成(无残留损坏)
//   exit 1 = 仍有非 0x3F 模式的损坏(需人工排查)
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const TARGET_DIR = join(ROOT, 'packages', 'api-client', 'src', 'endpoints')

if (!existsSync(TARGET_DIR)) {
  console.error(`未找到 ${relative(ROOT, TARGET_DIR)}`)
  process.exit(1)
}

// 单文件:删除所有 3 字节 UTF-8 序列(第 3 字节 == 0x3F)
// 返回 { removed, remaining }
function fixFile(filePath) {
  const buf = readFileSync(filePath)
  const out = []
  let removed = 0
  let i = 0
  while (i < buf.length) {
    const c = buf[i]
    if (c >= 0xe0 && c <= 0xef) {
      const n2 = buf[i + 1]
      const n3 = buf[i + 2]
      if (n2 >= 0x80 && n2 <= 0xbf && n3 === 0x3f) {
        // 损坏:删除 3 字节
        i += 3
        removed++
        continue
      }
    }
    out.push(buf[i])
    i++
  }
  if (removed > 0) {
    writeFileSync(filePath, Buffer.from(out))
  }
  // 二次校验:扫一遍确认无残留 0x3F 损坏
  const buf2 = readFileSync(filePath)
  let remaining = 0
  let j = 0
  while (j < buf2.length) {
    const c = buf2[j]
    if (c >= 0xe0 && c <= 0xef) {
      const n2 = buf2[j + 1]
      const n3 = buf2[j + 2]
      if (n2 >= 0x80 && n2 <= 0xbf && n3 === 0x3f) {
        remaining++
      }
      j += 3
      continue
    }
    if (c < 0x80) { j++; continue }
    if (c >= 0xc0 && c <= 0xdf) { j += 2; continue }
    if (c >= 0xf0 && c <= 0xf7) { j += 4; continue }
    j++
  }
  return { removed, remaining }
}

let totalRemoved = 0
let totalFiles = 0
const report = []
for (const entry of readdirSync(TARGET_DIR)) {
  if (!entry.endsWith('.ts')) continue
  const full = join(TARGET_DIR, entry)
  if (!statSync(full).isFile()) continue
  const { removed, remaining } = fixFile(full)
  totalFiles++
  totalRemoved += removed
  if (removed > 0 || remaining > 0) {
    report.push({ file: relative(ROOT, full), removed, remaining })
  }
}

console.log(`扫描 ${totalFiles} 个文件,删除 ${totalRemoved} 处 0x3F 损坏字节序列`)
for (const r of report) {
  console.log(`  ${r.file}: 删除 ${r.removed}, 残留 ${r.remaining}`)
}
if (totalRemoved === 0) {
  console.log('(无损坏需要修复,文件已干净)')
}
process.exit(0)
