#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Fastify 路由 safeParse 反模式巡检。
 *
 * 防止 `xxxSchema.safeParse(...).success` 被静默忽略(silent ignore)——
 * 解析失败时本应返回 400,但代码只检查 `xxx.success` 而不返回错误,
 * 导致无效输入穿透到下游,产生"静默 bug"(例如 admin level 越界返回 200)。
 *
 * 检测规则:
 * 1. 找到形如 `xxx.safeParse(...)` 的调用
 * 2. 找到赋值结果如 `const x = xxx.safeParse(...)` 或 `const { success, data } = xxx.safeParse(...)`
 * 3. 检查该结果变量在后续 5 行内是否:
 *    a) 检查了 `.success` 字段 OR
 *    b) 解构了 `{ success }` OR
 *    c) 用 `if (!...)` 否定检查 OR
 *    d) 在同一个 safeParse 调用表达式中作为三元运算的条件(`result.success ? ... : ...`)
 *    都不满足时 → 标记为 silent-ignore 风险
 *
 * 用法: node scripts/check-safe-parse.mjs
 *   无参数: 报告所有 silent-ignore 风险点,exit 0(警告模式,不阻塞 CI)
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const API_ROUTES_DIR = join(ROOT, 'apps/api/src/routes')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const EXCLUDE_DIRS = new Set(['node_modules', '.git'])

function collectFiles(dir, exts, result = []) {
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectFiles(full, exts, result)
    } else if (exts.some((e) => entry.endsWith(e))) {
      result.push(full)
    }
  }
  return result
}

/**
 * 扫描单文件所有 safeParse 调用,判定是否为 silent-ignore 风险。
 * 返回 [{ line, varName, snippet, reason }]
 */
function scanFile(filePath) {
  const src = readFileSync(filePath, 'utf8')
  const lines = src.split('\n')
  const findings = []

  // 匹配 `.safeParse(...)` 调用,提取**该调用所在表达式**的变量名
  // 模式 1: `const x = <expr>.safeParse(...)` (简单赋值)
  // 模式 2: `const { success, data } = <expr>.safeParse(...)` (解构)
  const safeParseRe = /\.safeParse\s*\(/g
  lines.forEach((line, idx) => {
    safeParseRe.lastIndex = 0
    while (safeParseRe.exec(line) !== null) {
      // 1) 先在**当前行**查找 `const X =` 或 `const { ... } =`
      let varName = null
      let destructureHasSuccess = false
      const directAssign = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*[^;]*\.safeParse\s*\(/)
      if (directAssign) {
        varName = directAssign[1]
      } else {
        const directDestructure = line.match(
          /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*[^;]*\.safeParse\s*\(/,
        )
        if (directDestructure) {
          destructureHasSuccess = /success/.test(directDestructure[1])
          if (destructureHasSuccess) return // 解构中含 success,安全
        }
      }
      // 2) 如果当前行没有,检查前一行(支持换行的赋值)
      if (!varName && !destructureHasSuccess) {
        const prev = lines[idx - 1] || ''
        const prevAssign = prev.match(/(?:const|let|var)\s+(\w+)\s*=\s*$/)
        if (prevAssign) varName = prevAssign[1]
        else {
          const prevDestructure = prev.match(/(?:const|let|var)\s*\{([^}]+)\}\s*=\s*$/)
          if (prevDestructure) {
            if (/success/.test(prevDestructure[1])) return
          }
        }
      }
      if (!varName) return // 无法确定变量名,跳过
      // 向后查找该变量名是否在 8 行内被 `.success` 引用 / 否定检查
      let isChecked = false
      const lookAhead = 8
      for (let fwd = idx + 1; fwd < Math.min(lines.length, idx + 1 + lookAhead); fwd++) {
        const next = lines[fwd] || ''
        if (new RegExp(`\\b${varName}\\.success\\b`).test(next)) {
          isChecked = true
          break
        }
        if (new RegExp(`!\\s*${varName}\\b`).test(next)) {
          isChecked = true
          break
        }
        if (new RegExp(`${varName}\\s*===?\\s*false`).test(next)) {
          isChecked = true
          break
        }
      }
      if (!isChecked) {
        findings.push({
          line: idx + 1,
          varName,
          snippet: line.trim().slice(0, 120),
          reason: `变量 \`${varName}\` 来自 \`.safeParse(...)\`,但其后 8 行内未检查 \`.success\`(silent-ignore 风险)`,
        })
      }
    }
  })
  return findings
}

console.log(
  `${C.cyan}${C.bold}[safeParse 巡检] 扫描 Fastify 路由中的 silent-ignore 反模式...${C.reset}`,
)
console.log(`${C.dim}扫描目录: ${relative(ROOT, API_ROUTES_DIR)}${C.reset}`)

if (!existsSync(API_ROUTES_DIR)) {
  console.log(`${C.red}❌ 目录不存在: ${API_ROUTES_DIR}${C.reset}`)
  process.exit(1)
}

const files = collectFiles(API_ROUTES_DIR, ['.ts'])
let totalRoutes = 0
let totalSafeParse = 0
let totalSilentIgnore = 0
const fileReports = []

for (const file of files) {
  // 统计路由数量(server.get/post/put/patch/delete)
  const src = readFileSync(file, 'utf8')
  const routeRe = /server\.(get|post|put|patch|delete)\s*\(/g
  const routeMatches = src.match(routeRe)
  totalRoutes += routeMatches ? routeMatches.length : 0

  // 统计 safeParse 调用
  const spRe = /\.safeParse\s*\(/g
  const spMatches = src.match(spRe)
  totalSafeParse += spMatches ? spMatches.length : 0

  // 检测 silent-ignore
  const findings = scanFile(file)
  if (findings.length > 0) {
    totalSilentIgnore += findings.length
    fileReports.push({ file: relative(ROOT, file), findings })
  }
}

console.log('')
console.log(`${C.bold}扫描结果:${C.reset}`)
console.log(`  路由文件: ${files.length} 个`)
console.log(`  路由数:   ${totalRoutes} 条`)
console.log(`  safeParse 调用: ${totalSafeParse} 处`)
console.log(`  silent-ignore 风险: ${totalSilentIgnore} 处`)
console.log('')

if (totalSilentIgnore === 0) {
  console.log(
    `${C.green}${C.bold}✅ 扫描完成: ${totalRoutes} 个路由, ${totalSafeParse} 处 safeParse, 0 处 silent-ignore${C.reset}`,
  )
  process.exit(0)
}

console.log(`${C.yellow}⚠️  发现 ${totalSilentIgnore} 处 silent-ignore 风险(需人工审查):${C.reset}`)
console.log('')
for (const { file, findings } of fileReports) {
  console.log(`${C.yellow}${file}${C.reset}`)
  for (const f of findings) {
    console.log(`  ${C.dim}行 ${f.line}${C.reset} ${C.red}[风险]${C.reset} ${f.reason}`)
    console.log(`    ${C.dim}代码: ${f.snippet}${C.reset}`)
  }
  console.log('')
}
console.log(`${C.dim}修复方法:${C.reset}`)
console.log(
  `  1. 在 safeParse 赋值后检查 \`if (!result.success) return reply.status(400).send(error(400, '参数错误'))\``,
)
console.log(
  `  2. 或使用解构 \`const { success, data } = schema.safeParse(...)\` 然后 \`if (!success) return 400\``,
)
console.log(
  `  3. 确认 silent ignore 不会导致安全风险(level 越界→0 范围检查失败应拒绝,不应静默通过)`,
)
console.log('')
console.log(
  `${C.bold}扫描完成: ${totalRoutes} 个路由, ${totalSafeParse} 处 safeParse, ${totalSilentIgnore} 处 silent-ignore${C.reset}`,
)
// 警告模式:不阻塞 CI,exit 0
process.exit(0)
