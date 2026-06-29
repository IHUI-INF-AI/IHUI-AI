/* eslint-disable */
/**
 * i18n 键引用 vs 翻译文件比对脚本 (v2 精确版)
 * 改进:
 * - 支持数组下标 [N]
 * - 过滤第三方库源码误报 (semver/uni-id 等)
 * - 区分: 真实缺失 vs 误报
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC_DIRS = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'miniapp', 'src'),
]
const LOCALES_DIR = path.join(ROOT, 'src', 'locales')

// 第三方库源码目录 (这些目录里的 t() 调用不是项目的 i18n)
const THIRD_PARTY_DIRS = [
  'node_modules',
  'dist',
  'src/lib/semver',
  'src/lib/uni-id',
  'src/lib/markdown-it',
  '\\lib\\semver',
  '\\lib\\uni-id',
]

// 已知非 i18n 的 t() 调用关键词 (semver/font/comment 等)
const FALSE_POSITIVE_TOPS = new Set([
  'Comparator', 'SemVer', 'caret', 'caret return', 'comp', 'comparator',
  'comparator trim', 'replaceCaret', 'replaceStars', 'replaceTilde',
  'replaceXRanges', 'stars', 'tilde', 'tilde return', 'tildes',
  'xRange', 'xRange return', 'xrange', 'prerelease compare',
  'no pr', 'hyphen replace',
  'Font could not be loaded', 'Font could not be loaded: ',
  'fontFamily', 'weightName', 'manufacturer', 'copyright',
  'uni-id-admin-exist-in-other-apps', 'uni-id-admin-exists',
  'verify-mobile', 'config-file-invalid',
])

const referencedKeys = new Map()
const referencedTopPrefixes = new Set()
const falsePositiveKeys = [] // 记录被过滤的误报

const KEY_REGEX = /(?:^|[^a-zA-Z0-9_$])(?:\$?t|i18n\.t)\(\s*['"`]([^'"`${]*?)['"`]/g

function isThirdParty(file) {
  const norm = file.replace(/\//g, '\\')
  return THIRD_PARTY_DIRS.some(d => norm.includes(d.replace(/\//g, '\\')))
}

function walk(dir, cb) {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      walk(p, cb)
    } else if (e.isFile()) {
      cb(p)
    }
  }
}

function collectKeys() {
  for (const root of SRC_DIRS) {
    walk(root, (file) => {
      if (!/\.(vue|ts|tsx|js|jsx)$/.test(file)) return
      if (file.includes(path.join('src', 'locales'))) return
      if (file.includes('__tests__') || file.includes('.test.') || file.includes('.spec.')) return
      if (isThirdParty(file)) {
        // 仍然扫描, 但标记为误报源
      }
      let content
      try { content = fs.readFileSync(file, 'utf-8') } catch { return }
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
        let match
        KEY_REGEX.lastIndex = 0
        while ((match = KEY_REGEX.exec(line)) !== null) {
          const key = match[1]
          if (!key) continue
          if (/^\d+$/.test(key)) continue
          if (key.length < 2) continue
          if (['get', 'post', 'put', 'delete', 'patch', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(key)) continue
          const top = key.split('.')[0]
          // 过滤第三方库误报
          if (FALSE_POSITIVE_TOPS.has(top)) {
            falsePositiveKeys.push({ key, file: path.relative(ROOT, file), line: i + 1 })
            continue
          }
          if (!referencedKeys.has(key)) referencedKeys.set(key, [])
          referencedKeys.get(key).push({ file: path.relative(ROOT, file), line: i + 1 })
          referencedTopPrefixes.add(top)
        }
      }
    })
  }
}

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return
  for (const k of Object.keys(source)) {
    const sv = source[k]
    const tv = target[k]
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      deepMerge(tv, sv)
    } else {
      target[k] = sv
    }
  }
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return null }
}

function buildMergedMessages(locale) {
  const merged = {}
  for (const src of ['modules', 'full']) {
    const dir = path.join(LOCALES_DIR, src, locale)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue
      const obj = readJson(path.join(dir, f))
      if (obj) deepMerge(merged, obj)
    }
  }
  return merged
}

// 支持数组下标的路径查找: 'a.b[0].c' -> obj.a.b[0].c
function pathExists(obj, keyPath) {
  // 拆分: 先按 . 拆, 再处理 [N]
  const parts = []
  for (const seg of keyPath.split('.')) {
    // seg 形如 'v110[0]' 或 'foo'
    const m = seg.match(/^([^\[]*)((?:\[\d+\])*)$/)
    if (!m) {
      parts.push(seg)
      continue
    }
    if (m[1]) parts.push(m[1])
    if (m[2]) {
      const idxs = m[2].match(/\[(\d+)\]/g)
      if (idxs) {
        for (const idxStr of idxs) {
          const idx = parseInt(idxStr.match(/\d+/)[0], 10)
          parts.push(idx)
        }
      }
    }
  }
  let cur = obj
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return false
    if (typeof p === 'number') {
      if (!Array.isArray(cur)) return false
      if (p < 0 || p >= cur.length) return false
      cur = cur[p]
    } else {
      if (!(p in cur)) return false
      cur = cur[p]
    }
  }
  return cur !== undefined && cur !== null
}

function collectDefinedKeys(obj, prefix = '', out = new Set()) {
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    const full = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      collectDefinedKeys(v, full, out)
    } else if (Array.isArray(v)) {
      // 数组: 记录 arr[0], arr[1]...
      v.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          collectDefinedKeys(item, `${full}[${idx}]`, out)
        } else {
          out.add(`${full}[${idx}]`)
        }
      })
      out.add(full) // 也记录数组本身
    } else {
      out.add(full)
    }
  }
  return out
}

// ---- 主流程 ----
collectKeys()
const zhMessages = buildMergedMessages('zh-CN')
const zhDefinedKeys = collectDefinedKeys(zhMessages)

const missingKeys = []
for (const [key, refs] of referencedKeys) {
  if (!pathExists(zhMessages, key)) {
    missingKeys.push({ key, refs })
  }
}

const zhTopKeys = new Set(Object.keys(zhMessages))
const missingTopPrefixes = []
for (const top of referencedTopPrefixes) {
  if (!zhTopKeys.has(top)) {
    missingTopPrefixes.push(top)
  }
}

const report = {
  summary: {
    totalReferencedKeys: referencedKeys.size,
    totalDefinedKeys: zhDefinedKeys.size,
    missingCount: missingKeys.length,
    missingTopPrefixCount: missingTopPrefixes.length,
    falsePositiveCount: falsePositiveKeys.length,
  },
  missingTopPrefixes: missingTopPrefixes.sort(),
  missingKeys: missingKeys
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(m => ({
      key: m.key,
      topPrefix: m.key.split('.')[0],
      refCount: m.refs.length,
      refs: m.refs.slice(0, 3),
    })),
  missingByPrefix: {},
  falsePositiveSample: falsePositiveKeys.slice(0, 10),
}

for (const m of missingKeys) {
  const top = m.key.split('.')[0]
  if (!report.missingByPrefix[top]) report.missingByPrefix[top] = 0
  report.missingByPrefix[top]++
}
const sortedByPrefix = Object.entries(report.missingByPrefix)
  .sort((a, b) => b[1] - a[1])
report.missingByPrefix = Object.fromEntries(sortedByPrefix)

const outPath = path.join(ROOT, 'scripts', 'i18n-analysis.json')
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8')

console.log('━'.repeat(60))
console.log('🌐 i18n 键引用 vs zh-CN 翻译 比对报告 (v2 精确版)')
console.log('━'.repeat(60))
console.log(`代码引用键 (去重): ${report.summary.totalReferencedKeys}`)
console.log(`zh-CN 定义键: ${report.summary.totalDefinedKeys}`)
console.log(`❌ 缺失键 (引用但未定义): ${report.summary.missingCount}`)
console.log(`❌ 缺失顶层前缀: ${report.summary.missingTopPrefixCount}`)
console.log(`ℹ️  误报过滤 (第三方库): ${report.summary.falsePositiveCount}`)
console.log()
console.log('📊 缺失键按顶层前缀分组:')
for (const [prefix, count] of sortedByPrefix) {
  console.log(`  ${prefix.padEnd(30)} ${count} 个缺失`)
}
console.log()
console.log(`完整报告: ${outPath}`)
