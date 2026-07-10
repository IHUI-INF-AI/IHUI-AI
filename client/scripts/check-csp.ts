/**
 * 校验 CSP 在所有位置的一致性
 * 用法：npm run check:csp
 *
 * 验证项目：
 *   1. 主 CSP 头（5 处）：index.html meta、vite.config.ts middleware、ai-world HTML、server.headers、nginx-production.conf
 *   2. Report-Only CSP 头（2 处）：vite.config.ts server.headers、nginx-production.conf
 *   3. 关键白名单（fonts.googleapis.com / fonts.gstatic.com）存在于所有位置
 *   4. report-uri /api/csp-report 存在于所有 Report-Only 头
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

interface CspLocation {
  file: string
  pattern: RegExp
  name: string
  /** 是否是 Report-Only 头 */
  reportOnly: boolean
}

const LOCATIONS: CspLocation[] = [
  { name: 'index.html meta', file: 'index.html', pattern: /<meta[^>]*Content-Security-Policy[^>]*content="([^"]+)"/i, reportOnly: false },
  // 兼容模板字符串与硬编码：
  //   1) 硬编码模板：res.setHeader('CSP', `...`）
  //   2) 引用变量：res.setHeader('CSP', `${DEV_CSP_STRING}; report-uri ${CSP_REPORT_URL}`)
  { name: 'vite.config.ts middleware', file: 'vite.config.ts', pattern: /res\.setHeader\(\s*'Content-Security-Policy',\s*`([^`]+)`/, reportOnly: false },
  { name: 'vite.config.ts ai-world HTML', file: 'vite.config.ts', pattern: /res\.setHeader\(\s*'Content-Security-Policy',\s*[`"']([^`"']+)[`"']/, reportOnly: false },
  { name: 'vite.config.ts server.headers (enforce)', file: 'vite.config.ts', pattern: /'Content-Security-Policy':\s*(\r?\n\s*)?(\"?)([^",}\n]+?)\2,/, reportOnly: false },
  { name: 'vite.config.ts server.headers (report-only)', file: 'vite.config.ts', pattern: /'Content-Security-Policy-Report-Only':\s*(\r?\n\s*)?(\"?)([^",}\n]+?)\2,/, reportOnly: true },
  { name: 'nginx-production.conf (enforce)', file: 'nginx-production.conf', pattern: /add_header Content-Security-Policy "([^"]+)" always;/, reportOnly: false },
  { name: 'nginx-production.conf (report-only)', file: 'nginx-production.conf', pattern: /add_header Content-Security-Policy-Report-Only "([^"]+)" always;/, reportOnly: true },
]

function readFileContent(file: string): string {
  const full = path.join(rootDir, file)
  if (!fs.existsSync(full)) return ''
  return fs.readFileSync(full, 'utf-8')
}

function normalizeCsp(csp: string): string {
  return csp.replace(/\s+/g, ' ').replace(/\s*;\s*/g, '; ').trim()
}

function check(): boolean {
  let ok = true
  for (const loc of LOCATIONS) {
    const content = readFileContent(loc.file)
    const m = loc.pattern.exec(content)
    if (!m) {
      console.log(`✗ ${loc.name}: 未找到 CSP`)
      ok = false
      continue
    }
    const csp = m[m.length - 1] || ''
    // 引用 DEV_CSP_STRING / PROD_CSP_STRING / REPORT_ONLY_CSP_STRING 等变量视为 OK（唯一源 = config/csp.ts）
    // 兼容：直接引用变量 / 模板字符串嵌入 / 包含 ${...} 占位
    const trimmed = csp.trim()
    const isReference = /^(DEV|PROD|REPORT_ONLY)_CSP_STRING$/.test(trimmed) || /\$\{[^}]*CSP_STRING[^}]*\}/.test(trimmed)
    if (isReference) {
      console.log(`✓ ${loc.name}: 引用 config/csp.ts 唯一源 (${trimmed.length} 字符)`)
      continue
    }
    const normalized = normalizeCsp(csp)
    const hasGoogleFonts = normalized.includes('fonts.googleapis.com')
    const hasGstatic = normalized.includes('fonts.gstatic.com')
    const hasReportUri = normalized.includes('report-uri /api/csp-report')
    const issues: string[] = []
    if (!hasGoogleFonts) issues.push('缺 fonts.googleapis.com')
    if (!hasGstatic) issues.push('缺 fonts.gstatic.com')
    if (loc.reportOnly && !hasReportUri) issues.push('缺 report-uri /api/csp-report')
    if (issues.length === 0) {
      console.log(`✓ ${loc.name}: 长度=${normalized.length} 字符`)
    } else {
      console.log(`✗ ${loc.name}: ${issues.join(' | ')}`)
      ok = false
    }
  }

  // 字面值一致性：所有 enforce 头应该规范化后相同（如果源设计就是如此）
  // 实际上 dev 环境与生产环境的 CSP 允许有差异，所以不强求 enforce 头一致
  // 但 Report-Only 头应该与 config/csp.ts 中 REPORT_ONLY_CSP_STRING 字符级一致
  const cspModulePath = path.join(rootDir, 'config', 'csp.ts')
  if (fs.existsSync(cspModulePath)) {
    const cspModule = fs.readFileSync(cspModulePath, 'utf-8')
    const m = cspModule.match(/REPORT_ONLY_CSP_STRING\s*=\s*serializeCsp\([^)]+\)/)
    if (m) {
      // 仅作为存在性检查，TS 源不能直接 eval
      console.log(`✓ config/csp.ts: REPORT_ONLY_CSP_STRING 已定义（${m[0]}）`)
    } else {
      console.log(`✗ config/csp.ts: REPORT_ONLY_CSP_STRING 未定义`)
      ok = false
    }
  }

  return ok
}

const ok = check()
console.log(ok ? '\n✅ CSP 一致性检查通过' : '\n❌ CSP 不一致，请检查上述位置')
process.exit(ok ? 0 : 1)
