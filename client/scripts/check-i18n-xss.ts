/**
 * 翻译值 XSS 防护扫描 (2026-07-02 立)
 *
 * 独立入口, 区别于 scripts/check-i18n.ts:
 *   - check-i18n.ts       → 覆盖率 + 硬编码中文 + XSS (全量, 慢)
 *   - check-i18n-xss.ts   → 仅 XSS (快速守门, 可挂 pre-push + CI 单 step)
 *
 * 拦截 3 类 (按危险度从高到低):
 *   (1) <script> 标签: 直接执行 JS
 *   (2) on\w+= 事件属性: onclick= / onerror= / onload= 等可执行 JS
 *   (3) javascript: 协议: <a href="javascript:..."> 形式可执行 JS
 *
 * 不拦截 (白名单, 否则误报):
 *   - <a href="https://..."> / <el-link> 标签 (翻译里允许 HTML 链接)
 *   - <br> / <span> 等纯展示标签
 *   - HTML 实体 &lt; &gt; 形式 (源码层已转义)
 *
 * 误报处理: 合法 <script>-like 文本 (e.g. 文档示例) 需手动 escape 为
 *          &lt;script&gt; 或拆出字符串变量再拼接.
 *
 * 使用:
 *   npm run check:i18n:xss
 *
 * 历史教训:
 *   - Shopify 2018-09 邮件模板 XSS (翻译值含 <%= ... %> 被模板引擎执行)
 *   - 京东 2019-07 我的京东昵称 XSS (昵称支持 HTML 后未过滤)
 *   - Twitter 2010-09 onmouseover XSS (t.co 短链未过滤)
 *   - 任何 v-html 渲染翻译值的项目都吃过亏, 必须在 CI 拦截源头
 */

import fs from 'node:fs'
import path from 'node:path'

const LOCALES_DIR = path.join(process.cwd(), 'src', 'locales', 'modules')
const FULL_DIR = path.join(process.cwd(), 'src', 'locales', 'full')

const XSS_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: '<script> 标签', regex: /<\s*script\b[^>]*>/i },
  { name: '<script/> 自闭合', regex: /<\s*\/\s*script\s*>/i },
  { name: 'on*= 事件属性', regex: /\son[a-z]+\s*=\s*['"]?[^'">\s]+/i },
  { name: 'javascript: 协议', regex: /javascript\s*:/i },
]

interface XssFinding {
  file: string
  key: string
  pattern: string
  snippet: string
}

function readJSON(p: string): Record<string, unknown> | null {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

function flattenValues(
  obj: Record<string, unknown>,
  prefix = '',
): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenValues(v as Record<string, unknown>, key))
    } else {
      out.push({ key, value: String(v ?? '') })
    }
  }
  return out
}

function walk(dir: string, cb: (file: string) => void): void {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      // 跳过 node_modules / dist / .git
      if (/(node_modules|dist|\.git)/i.test(p)) continue
      walk(p, cb)
    } else {
      cb(p)
    }
  }
}

function findXssInValues(): XssFinding[] {
  const findings: XssFinding[] = []
  const scanRoots = [LOCALES_DIR, FULL_DIR]
  for (const root of scanRoots) {
    if (!fs.existsSync(root)) continue
    walk(root, (file) => {
      if (!file.endsWith('.json')) return
      const data = readJSON(file)
      if (!data) return
      const values = flattenValues(data)
      for (const { key, value } of values) {
        if (!value) continue
        for (const { name, regex } of XSS_PATTERNS) {
          if (regex.test(value)) {
            findings.push({
              file: path.relative(process.cwd(), file),
              key,
              pattern: name,
              snippet: value.length > 80 ? value.slice(0, 80) + '…' : value,
            })
            break
          }
        }
      }
    })
  }
  return findings
}

function main(): void {
  console.log('\n🛡️  翻译值 XSS 防护扫描')
  console.log('━'.repeat(60))
  console.log(`扫描目录:`)
  console.log(`  - ${path.relative(process.cwd(), LOCALES_DIR)}`)
  console.log(`  - ${path.relative(process.cwd(), FULL_DIR)}`)
  console.log()

  const findings = findXssInValues()
  const elapsed = Date.now()
  console.log(`扫描完成, 命中 ${findings.length} 处危险翻译值`)
  console.log()

  if (findings.length === 0) {
    console.log('✅ 未发现 <script> / on*= / javascript: 危险模式')
    console.log('   翻译值已通过 XSS 防护扫描')
    console.log()
    console.log('━'.repeat(60))
    process.exit(0)
  }

  console.log(`❌ 发现 ${findings.length} 处 XSS 危险翻译值:`)
  console.log()
  for (const f of findings) {
    console.log(`  📄 ${f.file} :: ${f.key}`)
    console.log(`     模式: ${f.pattern}`)
    console.log(`     片段: ${f.snippet}`)
    console.log()
  }
  console.log('━'.repeat(60))
  console.log(`❌ XSS 防护扫描失败 (${findings.length} 处危险翻译值)`)
  console.log('   请立即修复:')
  console.log('   (1) 翻译值中删除 <script> / on*= / javascript: 模式')
  console.log('   (2) 如需展示代码示例, 改用 &lt;script&gt; 转义')
  console.log('   (3) <a> 链接统一改为 https:// 协议, 避免 javascript:')
  console.log()
  process.exit(1)
}

main()
