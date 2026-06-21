/**
 * CSP 自动同步脚本
 * 用法：npm run sync:csp [-- --write]
 *
 * 读取 config/csp.ts 中的唯一配置（DEV_CSP_STRING / PROD_CSP_STRING / REPORT_ONLY_CSP_STRING），
 * 校验/更新以下位置：
 *
 *   主 CSP 头（强制）：
 *     1. index.html 的 <meta> 标签
 *     2. vite.config.ts 的 dev server middleware res.setHeader
 *     3. vite.config.ts 的 /ai-world/ HTML res.setHeader
 *     4. vite.config.ts 的 server.headers（强制）
 *     5. nginx-production.conf 的 add_header
 *
 *   Report-Only CSP 头（仅上报）：
 *     6. vite.config.ts 的 server.headers（report-only）
 *     7. nginx-production.conf 的 add_header（report-only）
 *
 * --write 参数会实际写回文件；不带则仅做差异对比。
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { DEV_CSP_STRING, PROD_CSP_STRING, REPORT_ONLY_CSP_STRING } from '../config/csp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const WRITE = process.argv.includes('--write')

type Kind = 'enforce' | 'report-only'
interface Location {
  name: string
  file: string
  kind: Kind
  isDev: boolean
}
interface SyncResult {
  name: string
  file: string
  kind: Kind
  hasCsp: boolean
  hasFonts: boolean
  hasGstatic: boolean
  hasReportUri: boolean
  diff: string
  oldValue: string
  newValue: string
}

const LOCATIONS: Location[] = [
  // 主 CSP 头（强制）
  { name: 'index.html meta', file: 'index.html', kind: 'enforce', isDev: false },
  { name: 'vite.config.ts dev middleware', file: 'vite.config.ts', kind: 'enforce', isDev: true },
  { name: 'vite.config.ts ai-world HTML', file: 'vite.config.ts', kind: 'enforce', isDev: true },
  { name: 'vite.config.ts server.headers (enforce)', file: 'vite.config.ts', kind: 'enforce', isDev: true },
  { name: 'nginx-production.conf (enforce)', file: 'nginx-production.conf', kind: 'enforce', isDev: false },
  // Report-Only CSP 头（仅上报）
  { name: 'vite.config.ts server.headers (report-only)', file: 'vite.config.ts', kind: 'report-only', isDev: true },
  { name: 'nginx-production.conf (report-only)', file: 'nginx-production.conf', kind: 'report-only', isDev: false },
]

function readFile(file: string): string {
  return fs.readFileSync(path.join(rootDir, file), 'utf-8')
}
function writeFile(file: string, content: string): void {
  fs.writeFileSync(path.join(rootDir, file), content, 'utf-8')
}

/** 提取文件中的 CSP 字符串（enforce 或 report-only） */
function extractCsp(content: string, file: string, kind: Kind): string {
  const headerName = kind === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only'
  if (file === 'index.html') {
    // index.html 只有主 CSP meta
    if (kind !== 'enforce') return ''
    const m = content.match(/<meta[^>]*Content-Security-Policy[^>]*content="([^"]+)"/i)
    return m ? m[1] : ''
  }
  if (file === 'vite.config.ts') {
    // 1) dev middleware
    const m1 = content.match(new RegExp(`res\\.setHeader\\(\\s*'${headerName}',\\s*\`([^\`]+)\``))
    if (m1) return m1[1]
    // 2) ai-world HTML
    const m2 = content.match(new RegExp(`res\\.setHeader\\(\\s*'${headerName}',\\s*"([^"]+)"`))
    if (m2) return m2[1]
    // 3) server.headers
    const m3 = content.match(new RegExp(`'${headerName}':\\s*(\\r?\\n\\s*)?"([^"]+)"`))
    if (m3) return m3[2]
    return ''
  }
  if (file === 'nginx-production.conf') {
    const re = new RegExp(`add_header ${headerName} "([^"]+)" always;`)
    const m = content.match(re)
    return m ? m[1] : ''
  }
  return ''
}

/** 将文件中的 CSP 字符串替换为新值 */
function replaceCsp(content: string, file: string, kind: Kind, newValue: string): string {
  const headerName = kind === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only'
  if (file === 'index.html') {
    return content.replace(
      /<meta[^>]*Content-Security-Policy[^>]*content="[^"]+"/i,
      (m) => m.replace(/content="[^"]+"/, `content="${newValue}"`)
    )
  }
  if (file === 'vite.config.ts') {
    // 1) dev middleware
    let r = content.replace(
      new RegExp(`res\\.setHeader\\(\\s*'${headerName}',\\s*\`[^\`]+\``),
      `res.setHeader('${headerName}', \`${newValue}\`)`
    )
    if (r !== content) return r
    // 2) ai-world HTML
    r = content.replace(
      new RegExp(`res\\.setHeader\\(\\s*'${headerName}',\\s*"[^"]+"`),
      `res.setHeader('${headerName}', "${newValue}")`
    )
    if (r !== content) return r
    // 3) server.headers
    r = content.replace(
      new RegExp(`'${headerName}':\\s*(\\r?\\n\\s*)?"[^"]+"`),
      (m, indent) => `'${headerName}':${indent}"${newValue}"`
    )
    return r
  }
  if (file === 'nginx-production.conf') {
    const re = new RegExp(`(add_header ${headerName} ")[^"]+(" always;)`)
    return content.replace(re, `$1${newValue}$2`)
  }
  return content
}

function check(): SyncResult[] {
  return LOCATIONS.map((loc): SyncResult => {
    const content = readFile(loc.file)
    const target =
      loc.kind === 'report-only'
        ? REPORT_ONLY_CSP_STRING
        : loc.isDev
          ? DEV_CSP_STRING
          : PROD_CSP_STRING
    const oldValue = extractCsp(content, loc.file, loc.kind)
    const hasCsp = oldValue.length > 0
    const hasFonts = oldValue.includes('fonts.googleapis.com')
    const hasGstatic = oldValue.includes('fonts.gstatic.com')
    const hasReportUri = loc.kind === 'enforce' ? true : oldValue.includes('report-uri /api/csp-report')
    const diff =
      oldValue === target
        ? '✅ 一致'
        : !hasCsp
          ? '❌ 未找到 CSP 头'
          : `⚠️  字符差 ${oldValue.length - target.length}（${oldValue.length} vs ${target.length}）`
    return {
      name: loc.name,
      file: loc.file,
      kind: loc.kind,
      hasCsp,
      hasFonts,
      hasGstatic,
      hasReportUri,
      diff,
      oldValue,
      newValue: target,
    }
  })
}

function runSync(result: SyncResult): boolean {
  if (!WRITE) return false
  const content = readFile(result.file)
  const updated = replaceCsp(content, result.file, result.kind, result.newValue)
  if (updated === content) return false
  writeFile(result.file, updated)
  return true
}

const results = check()
console.log(WRITE ? '\n🔧 CSP 自动同步模式（--write）\n' : '\n🔍 CSP 一致性检查模式\n')
let allOk = true
for (const r of results) {
  // 关键白名单 + Report-Only 头有 report-uri 即视为通过
  const pass = r.hasCsp && r.hasFonts && r.hasGstatic && r.hasReportUri
  const icon = pass ? '✅' : '⚠️'
  console.log(`${icon} [${r.kind}] ${r.name}`)
  console.log(
    `   hasCsp=${r.hasCsp} fonts=${r.hasFonts} gstatic=${r.hasGstatic} reportUri=${r.hasReportUri} ${r.diff}`
  )
  if (!pass) allOk = false
  if (WRITE && r.hasCsp && !r.diff.includes('一致')) {
    if (runSync(r)) console.log(`   ✏️  已更新`)
  }
}
console.log(
  WRITE
    ? '\n✅ CSP 同步完成'
    : allOk
      ? '\n✅ 所有位置 CSP 关键白名单一致'
      : '\n⚠️  存在缺失，请检查上述位置'
)
process.exit(0)
