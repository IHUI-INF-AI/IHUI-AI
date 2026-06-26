/**
 * 一次性脚本: 提取源码中所有 t() 调用的动态 namespace 前缀
 * 用于保护 clean-orphan-i18n.ts 不误删动态拼接 key
 *
 * 模式:
 *   t(`prefix.${var}.suffix`)   -> prefix (或 prefix.suffix, 看${位置)
 *   t(`prefix.${var}`)          -> prefix
 *   t('prefix.' + var)          -> prefix
 *   t(var + '.suffix')          -> suffix
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIRS = [path.join(ROOT, 'src'), path.join(ROOT, 'miniapp', 'src')].filter((p) => fs.existsSync(p))
const SKIP_DIRS = ['node_modules', 'dist', '.git', '__tests__', '__mocks__', 'mock', 'scripts']

function walk(dir: string, cb: (file: string) => void): void {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.includes(e.name)) continue
      walk(p, cb)
    } else {
      cb(p)
    }
  }
}

// 模式1: t(`prefix.${...}`) 或 t(`prefix.${...}.suffix`) - 模板字符串
// 模式2: t('prefix.' + ...) 或 t(... + '.suffix') - 字符串拼接
// 模式3: t(`prefix` + ...) - 整个 prefix 是变量

interface DynamicRef {
  file: string
  line: number
  snippet: string
  prefixes: string[] // 提取到的 namespace 前缀
}

const refs: DynamicRef[] = []

// 模板字符串模式: t(`static.${dynamic}`) 或 t(`static.${dyn}.suffix`) 或 t(`static.${dyn1}.${dyn2}`)
// 注意: 必须不包含 ' ' 转义或其他嵌套, 我们只取最外层
const TEMPLATE_RE = /\bt\s*\(\s*`([^`]*\$\{[^}]+\}[^`]*)`/g

// 字符串拼接: t('static.' + var) 或 t(var + '.static')
const CONCAT_LEFT_RE = /\bt\s*\(\s*['"]([\w.-]+)['"]\s*\+/g
const CONCAT_RIGHT_RE = /\+\s*['"]([\w.-]+)['"]\s*\)/g

// 路由 meta.title 字面量引用模式: title: 'routes.home' / title: "routes.adminHome"
// 这些 key 通过 t(route.meta.title) 间接调用, 非 t() 形式, 需单独识别
// 取第一段作为 namespace 保护前缀 (如 'routes' 保护整个 routes.* 模块)
const ROUTE_META_TITLE_RE = /\btitle\s*:\s*['"]([a-zA-Z][\w-]*(?:\.[\w-]+)*)['"]/g

for (const root of SRC_DIRS) {
  walk(root, (file) => {
    if (!/\.(vue|ts|tsx|js|jsx)$/.test(file)) return
    const content = fs.readFileSync(file, 'utf-8')

    // 模板字符串
    let m: RegExpExecArray | null
    TEMPLATE_RE.lastIndex = 0
    while ((m = TEMPLATE_RE.exec(content)) !== null) {
      const tmpl = m[1]
      // 把 ${} 替换为占位符 #DYN# 方便分析
      const normalized = tmpl.replace(/\$\{[^}]+\}/g, '#DYN#')
      // 按 . 分割
      const parts = normalized.split('.')
      // 提取"静态"前缀部分 (直到第一个 #DYN# 之前的部分)
      const staticPrefix: string[] = []
      for (const p of parts) {
        if (p.includes('#DYN#')) break
        if (p) staticPrefix.push(p)
      }
      if (staticPrefix.length > 0) {
        const line = content.slice(0, m.index).split('\n').length
        const lineStart = content.lastIndexOf('\n', m.index) + 1
        const lineEnd = content.indexOf('\n', m.index)
        const snippet = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).trim()
        refs.push({
          file: path.relative(ROOT, file),
          line,
          snippet,
          prefixes: [staticPrefix.join('.')],
        })
      }
    }

    // 字符串拼接 t('prefix.' + var)
    CONCAT_LEFT_RE.lastIndex = 0
    while ((m = CONCAT_LEFT_RE.exec(content)) !== null) {
      const prefix = m[1]
      const line = content.slice(0, m.index).split('\n').length
      const lineStart = content.lastIndexOf('\n', m.index) + 1
      const lineEnd = content.indexOf('\n', m.index)
      const snippet = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).trim()
      refs.push({ file: path.relative(ROOT, file), line, snippet, prefixes: [prefix] })
    }

    // 字符串拼接 t(var + '.suffix')
    CONCAT_RIGHT_RE.lastIndex = 0
    while ((m = CONCAT_RIGHT_RE.exec(content)) !== null) {
      const suffix = m[1]
      const line = content.slice(0, m.index).split('\n').length
      const lineStart = content.lastIndexOf('\n', m.index) + 1
      const lineEnd = content.indexOf('\n', m.index)
      const snippet = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).trim()
      // suffix 是后缀, 例如 t(x + '.title') -> 后缀是 title, 不能直接当 namespace
      // 但如果我们保守处理, 把最后一段当 namespace 保护
      const lastSeg = suffix.split('.').pop() || suffix
      refs.push({ file: path.relative(ROOT, file), line, snippet, prefixes: [lastSeg] })
    }

    // 路由 meta.title 字面量引用: title: 'routes.home'
    // 取第一段作为 namespace 保护前缀, 保护整个模块 (如 'routes' 保护 routes.*)
    ROUTE_META_TITLE_RE.lastIndex = 0
    while ((m = ROUTE_META_TITLE_RE.exec(content)) !== null) {
      const fullKey = m[1]
      const firstSeg = fullKey.split('.')[0]
      // 只保护多段 key (单段如 title: 'home' 不当 namespace 保护)
      if (firstSeg && fullKey.includes('.')) {
        const line = content.slice(0, m.index).split('\n').length
        const lineStart = content.lastIndexOf('\n', m.index) + 1
        const lineEnd = content.indexOf('\n', m.index)
        const snippet = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).trim()
        refs.push({ file: path.relative(ROOT, file), line, snippet, prefixes: [firstSeg] })
      }
    }
  })
}

console.log(`🔍 找到 ${refs.length} 处动态 t() 调用\n`)

// 收集所有 unique namespace 前缀
const allPrefixes = new Set<string>()
for (const r of refs) for (const p of r.prefixes) allPrefixes.add(p)

if (refs.length > 0) {
  console.log(`📦 涉及 ${allPrefixes.size} 个 unique 动态 namespace:\n`)
  const sorted = Array.from(allPrefixes).sort()
  for (const p of sorted) console.log(`  ${p}`)

  console.log('\n📋 详情:')
  for (const r of refs) {
    console.log(`\n  ${r.file}:${r.line}`)
    console.log(`    ${r.snippet}`)
    console.log(`    → 保护前缀: [${r.prefixes.join(', ')}]`)
  }
} else {
  console.log('  (无动态 namespace)')
}

// 输出 JSON 供脚本读取
const out = {
  totalRefs: refs.length,
  uniquePrefixes: Array.from(allPrefixes).sort(),
  refs: refs.map((r) => ({ ...r })),
}
fs.mkdirSync(path.join(ROOT, 'scripts', 'reports'), { recursive: true })
fs.writeFileSync(
  path.join(ROOT, 'scripts', 'reports', 'dynamic-namespace-prefixes.json'),
  JSON.stringify(out, null, 2) + '\n',
  'utf-8'
)
console.log(`\n📝 报告: scripts/reports/dynamic-namespace-prefixes.json`)
