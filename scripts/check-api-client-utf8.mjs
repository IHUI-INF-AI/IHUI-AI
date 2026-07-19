#!/usr/bin/env node
// packages/api-client 源码字节级 UTF-8 完整性守门(2026-07-19 立)
//
// 背景:2026-07-19 Next.js 16 Turbopack 构建报
//   "failed to convert rope into string
//    invalid utf-8 sequence of 2 bytes from index 19/770/801/964..."
//   报错路径:packages/api-client/dist/endpoints/{developer,misc,payment,share,system,...}.js
// 根因:源文件 packages/api-client/src/endpoints/*.ts 有损坏字节序列
//      具体模式:3 字节 UTF-8 字符(0xE0-0xEF 起始)的第 3 字节被替换为 0x3F('?')
//      tsc 编译后污染 dist,Turbopack 解析 dist 时报错
// 修复:Node.js 脚本批量删除 9 个文件 99 处坏字节序列
//
// 守门策略:扫描 packages/api-client/src/endpoints/*.ts 源文件
//          检测两类损坏:
//            A. 3 字节 UTF-8 序列(0xE0-0xEF 起始)的第 3 字节为 0x3F('?')
//            B. 任何非法 UTF-8 字节序列(0xC0-0xDF 后非 0x80-0xBF / 0xE0-0xEF 后非 2 个 0x80-0xBF / 0xF0-0xF7 后非 3 个 0x80-0xBF)
//          任何违规 → 报错并 exit 1,阻断 commit
//
// 用法: node scripts/check-api-client-utf8.mjs
//   exit 0 = 所有源文件字节级 UTF-8 干净
//   exit 1 = 发现损坏字节序列(报告 + 修复脚本)
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const TARGET_DIR = join(ROOT, 'packages', 'api-client', 'src', 'endpoints')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

// 检测单个文件字节级 UTF-8 完整性
// 返回 { violations: Array<{offset, type, bytes}>, totalBytes }
function scanFile(filePath) {
  const buf = readFileSync(filePath)
  const violations = []
  let i = 0
  while (i < buf.length) {
    const c = buf[i]
    if (c < 0x80) {
      // ASCII
      i++
      continue
    }
    if (c >= 0xc0 && c <= 0xdf) {
      // 2 字节 UTF-8
      const n2 = buf[i + 1]
      if (n2 === undefined || n2 < 0x80 || n2 > 0xbf) {
        violations.push({
          offset: i,
          type: '2-byte UTF-8 invalid continuation',
          bytes: [c, n2].filter((x) => x !== undefined),
        })
        i++
        continue
      }
      i += 2
      continue
    }
    if (c >= 0xe0 && c <= 0xef) {
      // 3 字节 UTF-8
      const n2 = buf[i + 1]
      const n3 = buf[i + 2]
      // 关键损坏模式:第 3 字节被替换为 0x3F('?')
      if (n2 >= 0x80 && n2 <= 0xbf && n3 === 0x3f) {
        violations.push({
          offset: i,
          type: '3-byte UTF-8 corrupted: 3rd byte replaced by 0x3F (?)',
          bytes: [c, n2, n3],
        })
        i += 3
        continue
      }
      // 通用非法序列
      if (n2 === undefined || n2 < 0x80 || n2 > 0xbf || n3 === undefined || n3 < 0x80 || n3 > 0xbf) {
        violations.push({
          offset: i,
          type: '3-byte UTF-8 invalid continuation',
          bytes: [c, n2, n3].filter((x) => x !== undefined),
        })
        i++
        continue
      }
      i += 3
      continue
    }
    if (c >= 0xf0 && c <= 0xf7) {
      // 4 字节 UTF-8
      const n2 = buf[i + 1]
      const n3 = buf[i + 2]
      const n4 = buf[i + 3]
      if (
        n2 === undefined || n2 < 0x80 || n2 > 0xbf ||
        n3 === undefined || n3 < 0x80 || n3 > 0xbf ||
        n4 === undefined || n4 < 0x80 || n4 > 0xbf
      ) {
        violations.push({
          offset: i,
          type: '4-byte UTF-8 invalid continuation',
          bytes: [c, n2, n3, n4].filter((x) => x !== undefined),
        })
        i++
        continue
      }
      i += 4
      continue
    }
    // 任何其他字节(0x80-0xBF 单独出现 / 0xF8+ 非法)都是损坏
    violations.push({
      offset: i,
      type: `invalid UTF-8 leading byte 0x${c.toString(16)}`,
      bytes: [c],
    })
    i++
  }
  return { violations, totalBytes: buf.length }
}

function main() {
  if (!existsSync(TARGET_DIR)) {
    console.log(`${C.yellow}⚠${C.reset} 未找到 ${relative(ROOT, TARGET_DIR)} 目录,跳过`)
    process.exit(0)
  }

  // 收集所有 .ts 文件
  const tsFiles = []
  for (const entry of readdirSync(TARGET_DIR)) {
    const full = join(TARGET_DIR, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isFile() && entry.endsWith('.ts')) {
      tsFiles.push(full)
    }
  }

  if (tsFiles.length === 0) {
    console.log(`${C.yellow}⚠${C.reset} ${relative(ROOT, TARGET_DIR)} 下无 .ts 文件,跳过`)
    process.exit(0)
  }

  console.log(
    `${C.cyan}🔤${C.reset} 扫描 ${tsFiles.length} 个 ${relative(ROOT, TARGET_DIR)}/*.ts 源文件的字节级 UTF-8 完整性\n`,
  )

  const fileViolations = []
  let okCount = 0

  for (const filePath of tsFiles) {
    const { violations } = scanFile(filePath)
    if (violations.length > 0) {
      fileViolations.push({ filePath, violations })
    } else {
      okCount++
    }
  }

  console.log(`${C.green}✓${C.reset} UTF-8 干净: ${okCount} 个文件`)

  if (fileViolations.length > 0) {
    const totalViolations = fileViolations.reduce((s, f) => s + f.violations.length, 0)
    console.log(`\n${C.red}✗${C.reset} 发现 ${totalViolations} 处损坏字节序列,分布在 ${fileViolations.length} 个文件:`)
    for (const fv of fileViolations) {
      const rel = relative(ROOT, fv.filePath)
      console.log(`\n  ${C.red}•${C.reset} ${rel} (${fv.violations.length} 处)`)
      // 最多显示前 5 处
      const shown = fv.violations.slice(0, 5)
      for (const v of shown) {
        const bytesHex = v.bytes.map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
        console.log(`    ${C.dim}offset ${v.offset}:${C.reset} ${v.type}`)
        console.log(`    ${C.dim}bytes: ${bytesHex}${C.reset}`)
      }
      if (fv.violations.length > 5) {
        console.log(`    ${C.dim}... 还有 ${fv.violations.length - 5} 处${C.reset}`)
      }
    }

    console.log(`\n${C.red}✗${C.reset} 损坏字节会导致 tsc 编译后污染 dist,Turbopack 解析 dist 时报错(2026-07-19 踩坑)`)
    console.log(`${C.dim}根因:3 字节 UTF-8 字符(中文)的第 3 字节被替换为 0x3F('?'),通常是 PowerShell 字符串处理或编辑器编码错误导致${C.reset}`)
    console.log(`${C.dim}正确做法:用 UTF-8 无 BOM 重新保存源文件,或运行修复脚本删除坏字节${C.reset}`)

    // 给出修复命令
    const filesArg = fileViolations.map((fv) => relative(ROOT, fv.filePath)).join(' ')
    console.log(`\n${C.yellow}修复脚本(删除 3 字节 UTF-8 序列中第 3 字节为 0x3F 的损坏):${C.reset}`)
    console.log(`  ${C.cyan}node${C.reset} -e "${`const fs=require('fs');for(const f of process.argv.slice(1)){const b=fs.readFileSync(f);const out=[];for(let i=0;i<b.length;){const c=b[i];if(c>=0xE0&&c<=0xEF&&b[i+1]>=0x80&&b[i+1]<=0xBF&&b[i+2]===0x3F){i+=3;continue}out.push(b[i]);i++}fs.writeFileSync(f,Buffer.from(out))}`}" ${filesArg}`)

    process.exit(1)
  }

  console.log(`\n${C.green}✓${C.reset} 所有 ${tsFiles.length} 个 api-client 源文件字节级 UTF-8 完整,可安全被 tsc 编译。`)
  process.exit(0)
}

main()
