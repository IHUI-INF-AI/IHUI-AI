/**
 * 一次性脚本: 报告当前所有缺失键的分布
 * 1. 哪些 key 在 zh-CN 有但其他语言没 (仅需补 4 语言)
 * 2. 哪些 key 在所有语言都没 (全新缺失, 需要从头加)
 * 3. 按 module 分组统计
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIRS = [path.join(ROOT, 'src'), path.join(ROOT, 'miniapp', 'src')].filter((p) => fs.existsSync(p))
const LOCALES_DIR = path.join(ROOT, 'src', 'locales', 'modules')

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const SKIP_DIRS = ['node_modules', 'dist', '.git', '__tests__', '__mocks__', 'mock']

function readJSON<T = unknown>(p: string): T | null {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
  } catch {
    return null
  }
}

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

function extractTCalls(content: string): string[] {
  const out: string[] = []
  const re = /\b(?:t|tSafe|\$t)\(\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const key = m[2]
    if (key === '' || key.includes('${')) continue
    const lineStart = content.lastIndexOf('\n', m.index) + 1
    const lineBefore = content.slice(lineStart, m.index)
    if (lineBefore.includes('//')) continue
    out.push(key)
  }
  return out
}

function hasKey(obj: unknown, key: string): boolean {
  const parts = key.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return false
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur !== undefined && cur !== null && cur !== ''
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') {
      deepMerge(target[k] as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      target[k] = v
    }
  }
}

function loadLocale(loc: string): Record<string, unknown> {
  const dir = path.join(LOCALES_DIR, loc)
  const merged: Record<string, unknown> = {}
  if (!fs.existsSync(dir)) return merged
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const obj = readJSON<Record<string, unknown>>(path.join(dir, f))
    if (obj) deepMerge(merged, obj)
  }
  return merged
}

console.log('🔍 扫描 t() 调用...')
const usedKeys = new Set<string>()
for (const root of SRC_DIRS) {
  walk(root, (file) => {
    if (!/\.(vue|ts|tsx|js|jsx)$/.test(file)) return
    const content = fs.readFileSync(file, 'utf-8')
    for (const k of extractTCalls(content)) usedKeys.add(k)
  })
}
console.log(`  找到 ${usedKeys.size} 个独立 key`)

console.log('📚 加载 5 语言 locale...')
const localeData: Record<string, Record<string, unknown>> = {}
for (const loc of LOCALES) localeData[loc] = loadLocale(loc)

// 对每个 key 统计: 哪些语言有
const stats = {
  total: usedKeys.size,
  zhCnOnly: 0,
  noAny: 0,
  partialCoverage: 0,
  allPresent: 0,
}

const sampleZhCnOnly: string[] = []
const sampleNoAny: string[] = []
const byModuleStats: Record<string, { zhCnOnly: number; noAny: number; partial: number }> = {}

for (const key of usedKeys) {
  const has = LOCALES.map((loc) => hasKey(localeData[loc], key))
  const count = has.filter(Boolean).length
  const mod = key.split('.')[0]
  if (!byModuleStats[mod]) byModuleStats[mod] = { zhCnOnly: 0, noAny: 0, partial: 0 }

  if (count === 0) {
    stats.noAny++
    byModuleStats[mod].noAny++
    if (sampleNoAny.length < 20) sampleNoAny.push(key)
  } else if (count === 1 && has[0]) {
    stats.zhCnOnly++
    byModuleStats[mod].zhCnOnly++
    if (sampleZhCnOnly.length < 20) sampleZhCnOnly.push(key)
  } else if (count === LOCALES.length) {
    stats.allPresent++
  } else {
    stats.partialCoverage++
    byModuleStats[mod].partial++
  }
}

console.log(`\n📈 缺失键分布 (共 ${stats.total} 个 key):`)
console.log(`  ✅ 5 语言都有:           ${stats.allPresent} (${((stats.allPresent / stats.total) * 100).toFixed(1)}%)`)
console.log(`  ❌ zh-CN 独占 (补 4 语言):  ${stats.zhCnOnly} (${((stats.zhCnOnly / stats.total) * 100).toFixed(1)}%)`)
console.log(`  ❌ 完全缺失 (5 语言都无):   ${stats.noAny} (${((stats.noAny / stats.total) * 100).toFixed(1)}%)`)
console.log(`  ❌ 部分覆盖:               ${stats.partialCoverage} (${((stats.partialCoverage / stats.total) * 100).toFixed(1)}%)`)
console.log(`  缺失总数 (key×locale):     ${stats.zhCnOnly * 4 + stats.noAny * 5 + stats.partialCoverage * 3}`)

console.log('\n📊 Top 20 module (按"需补充"数排序):')
const moduleList = Object.entries(byModuleStats)
  .map(([mod, s]) => ({ mod, need: s.zhCnOnly * 4 + s.noAny * 5 + s.partial * 3, ...s }))
  .sort((a, b) => b.need - a.need)
for (const m of moduleList.slice(0, 20)) {
  console.log(`  ${m.mod.padEnd(20)} zhCnOnly:${String(m.zhCnOnly).padStart(4)}  noAny:${String(m.noAny).padStart(4)}  partial:${String(m.partial).padStart(4)}  total:${m.need}`)
}

console.log('\n🔍 样例 (zh-CN 独占 - 只需补 4 语言):')
for (const k of sampleZhCnOnly.slice(0, 15)) console.log(`  ${k}`)

console.log('\n🔍 样例 (完全缺失 - 需 5 语言都加):')
for (const k of sampleNoAny.slice(0, 15)) console.log(`  ${k}`)
