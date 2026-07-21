#!/usr/bin/env node
// packages/* + apps/* dist 文件 UTF-8 BOM 守门脚本(2026-07-19 立,2026-07-20 扩展 apps)
//
// 背景:2026-07-19 Next.js 16 Turbopack 构建报
//   "failed to convert rope into string
//    invalid utf-8 sequence of 2 bytes from index 27"
//   报错路径:packages/api-client/dist/endpoints/admin-auth.js
// 根因:该 dist 文件被 PowerShell WriteAllText 默认 UTF-16 LE BOM(0xFF 0xFE)编码,
//      Turbopack 按 UTF-8 解析到第 27 字节触发非法序列。
// 修复:重新编码为 UTF-8 无 BOM 后构建恢复。
//
// 守门策略:扫描所有 packages/*/dist/** 与 apps/*/dist/** 下的
//          .js .mjs .cjs .ts .map .css .json .html 文件,
//          检测前 3 字节是否为 UTF-8 BOM(0xEF 0xBB 0xBF)或
//          UTF-16 LE BOM(0xFF 0xFE)/ BE BOM(0xFE 0xFF)。
//          任何 dist 文件含 BOM → 报错并 exit 1,阻断 commit。
// apps/*/dist 扩展根因:apps/api tsc 编译产物同样可能因 PowerShell WriteAllText 污染
//                       (1779 个 js/d.ts,2026-07-20 M-64 落地);.next 由 Turbopack 自管
//                       且 gitignore,无需扫描。
//
// 用法: node scripts/check-dist-encoding.mjs
//   exit 0 = 所有 dist 文件都是 UTF-8 无 BOM
//   exit 1 = 发现含 BOM 的 dist 文件(报告 + 修复命令)
import { existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const PACKAGES_DIR = join(ROOT, 'packages')
const APPS_DIR = join(ROOT, 'apps')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

// BOM 字节序定义
const BOM_UTF8 = Buffer.from([0xef, 0xbb, 0xbf])
const BOM_UTF16_LE = Buffer.from([0xff, 0xfe])
const BOM_UTF16_BE = Buffer.from([0xfe, 0xff])

// 需要扫描的扩展名
// 2026-07-20 M-64 扩展 .css .json .html(apps/desktop dist 含 Vite 输出 1 个 .html + 1 个 .css,
//                    apps/miniapp-taro dist 含 Taro 输出 1 个 .json,这些都会被 Turbopack/Vite
//                    解析,BOM 污染同样会触发 "invalid utf-8 sequence" 报错)。
// 守门策略:扫描所有 packages/*/dist/** 与 apps/*/dist/** 下的 .js .mjs .cjs .ts .map .css .json .html 文件,
const TARGET_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.map', '.css', '.json', '.html'])

// 每个文件最多读取的字节数(检测 BOM 只需要前几字节)
const PROBE_BYTES = 4

// 递归收集目录下所有匹配扩展名的文件
function collectFiles(dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      out.push(...collectFiles(full))
    } else if (st.isFile()) {
      const dotIdx = entry.lastIndexOf('.')
      if (dotIdx < 0) continue
      const ext = entry.slice(dotIdx)
      if (TARGET_EXTS.has(ext)) out.push(full)
    }
  }
  return out
}

// 检测单个文件的 BOM 类型
function detectBom(filePath) {
  let head
  try {
    const fd = openSync(filePath, 'r')
    const buf = Buffer.alloc(PROBE_BYTES)
    const bytesRead = readSync(fd, buf, 0, PROBE_BYTES, 0)
    closeSync(fd)
    head = buf.subarray(0, bytesRead)
  } catch {
    return null
  }
  if (head.length >= 3 && head.subarray(0, 3).equals(BOM_UTF8)) {
    return 'UTF-8 BOM (0xEF 0xBB 0xBF)'
  }
  if (head.length >= 2 && head.subarray(0, 2).equals(BOM_UTF16_LE)) {
    return 'UTF-16 LE BOM (0xFF 0xFE)'
  }
  if (head.length >= 2 && head.subarray(0, 2).equals(BOM_UTF16_BE)) {
    return 'UTF-16 BE BOM (0xFE 0xFF)'
  }
  return null
}

// 收集指定顶层目录下所有 * / dist / ** / 目标文件
function collectAllDistFiles(rootDir) {
  const out = []
  if (!existsSync(rootDir)) return out
  for (const topEntry of readdirSync(rootDir)) {
    const topDir = join(rootDir, topEntry)
    let st
    try {
      st = statSync(topDir)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    const distDir = join(topDir, 'dist')
    if (!existsSync(distDir)) continue
    out.push(...collectFiles(distDir))
  }
  return out
}

function main() {
  const distFiles = [
    ...collectAllDistFiles(PACKAGES_DIR),
    ...collectAllDistFiles(APPS_DIR),
  ]

  if (distFiles.length === 0) {
    console.warn(`${C.yellow}⚠${C.reset} 未找到任何 packages/*/dist 或 apps/*/dist 文件,跳过`)
    process.exit(0)
  }

  const violations = []
  let okCount = 0

  for (const filePath of distFiles) {
    const bom = detectBom(filePath)
    if (bom) {
      violations.push({ filePath, type: bom })
    } else {
      okCount++
    }
  }

  console.info(
    `${C.cyan}📦${C.reset} 扫描 ${distFiles.length} 个 packages/*/dist + apps/*/dist 文件的编码\n`,
  )

  console.info(`${C.green}✓${C.reset} 无 BOM: ${okCount} 个文件`)

  if (violations.length > 0) {
    console.error(`\n${C.red}✗${C.reset} 发现 ${violations.length} 个含 BOM 的 dist 文件:`)
    for (const v of violations) {
      const rel = relative(ROOT, v.filePath)
      console.error(`  ${C.red}•${C.reset} ${rel}`)
      console.error(`    ${C.dim}类型:${C.reset} ${v.type}`)
      // 给出 PowerShell 修复命令
      const psCmd =
        `powershell -Command "$b=[System.IO.File]::ReadAllBytes('${rel}');` +
        `if($b[0]-eq0xFF-and$b[1]-eq0xFE){$b=$b[2..($b.Length-1)]}` +
        `elseif($b[0]-eq0xFE-and$b[1]-eq0xFF){$b=$b[2..($b.Length-1)]}` +
        `elseif($b[0]-eq0xEF-and$b[1]-eq0xBB-and$b[2]-eq0xBF){$b=$b[3..($b.Length-1)]};` +
        `[System.IO.File]::WriteAllBytes('${rel}',$b)"`
      console.error(`    ${C.dim}修复:${C.reset} ${C.yellow}${psCmd}${C.reset}`)
    }
    console.error(`\n${C.red}✗${C.reset} dist 文件 BOM 会导致 Turbopack 解析失败(2026-07-19 admin-auth.js 踩坑)`)
    console.error(`${C.dim}根因:PowerShell WriteAllText 默认 UTF-16 LE BOM 编码${C.reset}`)
    console.error(`${C.dim}正确做法:用 UTF-8 无 BOM 写入,或重新跑对应包的 build 脚本(tsc 产物天然无 BOM)${C.reset}`)
    process.exit(1)
  }

  console.info(`\n${C.green}✓${C.reset} 所有 dist 文件均为 UTF-8 无 BOM,可安全被 Turbopack 解析。`)
  process.exit(0)
}

main()
