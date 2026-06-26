/**
 * 一次性脚本: 清理孤儿键 (zh-CN 中已定义但源码中无 t() 引用的 key)
 *
 * 策略:
 *   1. 扫描所有源码 t() 调用, 收集所有被引用的 leaf key
 *   2. 收集 zh-CN 中所有 leaf key
 *   3. 差集 = 孤儿键
 *   4. 检查孤儿键的"删除可行性":
 *      - 如果孤儿 key 在 5 个语言中都有定义 -> 5 语言全删 (safe)
 *      - 如果孤儿 key 仅在部分语言存在 (zh-CN 没有但其他语言有) -> 不动 (可能是 API/动态 key)
 *      - 如果孤儿 key 在 zh-CN 有但其他语言无 (已经是 missing) -> 5 语言都不补了, 直接从 zh-CN 删
 *   5. 跳过"动态 namespace 保护"清单下的 key:
 *      - 例如 t(`apiService.status.${x}`) 这种模式, 整个 apiService.status.* 都要保留
 *      - 清单从 scripts/reports/dynamic-namespace-prefixes.json 读取
 *   6. 按 module 分组, 输出清理报告
 *
 * 安全机制:
 *   - 默认 dry-run 模式, 只输出待删除清单到 reports/orphan-keys-cleanup.json
 *   - --apply 模式才会真的修改文件
 *   - 不会删除包含其他有效 key 的中间对象 (只删叶子)
 *
 * 用法:
 *   tsx scripts/clean-orphan-i18n.ts            # dry-run, 输出报告
 *   tsx scripts/clean-orphan-i18n.ts --apply    # 实际清理
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIRS = [path.join(ROOT, 'src'), path.join(ROOT, 'miniapp', 'src')].filter((p) => fs.existsSync(p))
const LOCALES_DIR = path.join(ROOT, 'src', 'locales', 'modules')
const REPORTS_DIR = path.join(ROOT, 'scripts', 'reports')
const DYNAMIC_NS_FILE = path.join(REPORTS_DIR, 'dynamic-namespace-prefixes.json')

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
type Locale = (typeof LOCALES)[number]

const SKIP_DIRS = ['node_modules', 'dist', '.git', '__tests__', '__mocks__', 'mock']
const APPLY = process.argv.includes('--apply')

function readJSON<T = unknown>(p: string): T | null {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
  } catch {
    return null
  }
}

function writeJSON(p: string, data: unknown): void {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8')
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

function loadLocale(loc: Locale): { merged: Record<string, unknown>; byFile: Map<string, Record<string, unknown>> } {
  const dir = path.join(LOCALES_DIR, loc)
  const merged: Record<string, unknown> = {}
  const byFile = new Map<string, Record<string, unknown>>()
  if (!fs.existsSync(dir)) return { merged, byFile }
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const obj = readJSON<Record<string, unknown>>(path.join(dir, f))
    if (!obj) continue
    byFile.set(f.replace('.json', ''), obj)
    deepMerge(merged, obj)
  }
  return { merged, byFile }
}

/** 收集对象中所有 leaf key (完整路径) */
function collectLeafKeys(obj: Record<string, unknown>, prefix: string, out: Set<string>): void {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      collectLeafKeys(v as Record<string, unknown>, key, out)
    } else {
      out.add(key)
    }
  }
}

/** 从 nested object 中删除 leaf key, 返回是否删除了 */
function deleteLeafKey(obj: Record<string, unknown>, key: string): boolean {
  const parts = key.split('.')
  if (parts.length === 0) return false
  let cur: Record<string, unknown> | undefined = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (!cur[p] || typeof cur[p] !== 'object') return false
    cur = cur[p] as Record<string, unknown>
  }
  const leaf = parts[parts.length - 1]
  if (leaf in cur) {
    delete cur[leaf]
    return true
  }
  return false
}

/** 清理空的中间对象 (删除叶子后 parent 变空) */
function pruneEmptyObjects(obj: Record<string, unknown>, maxDepth = 10): void {
  if (maxDepth <= 0) return
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      pruneEmptyObjects(v as Record<string, unknown>, maxDepth - 1)
      if (Object.keys(v as Record<string, unknown>).length === 0) {
        delete obj[k]
      }
    }
  }
}

/**
 * 判断 key 是否被"动态 namespace 保护":
 *   如果 key 路径以任一 protectedPrefix 开头, 则跳过清理
 *   例: protectedPrefix = 'apiService.status', key = 'apiService.status.active'
 *       -> protected (即使源码没有 t('apiService.status.active'))
 *   加载自 dynamic-namespace-prefixes.json (detect-dynamic-namespaces.ts 生成)
 */
function loadProtectedPrefixes(): Set<string> {
  const data = readJSON<{ uniquePrefixes: string[] }>(DYNAMIC_NS_FILE)
  if (!data) return new Set()
  // 过滤掉无意义的前缀 (单个字符, 数字, 'json', '-' 等)
  const meaningless = new Set(['', '-', '0', 'W', 'L', 'json'])
  return new Set(data.uniquePrefixes.filter((p) => p && !meaningless.has(p) && /[a-zA-Z]/.test(p)))
}

function isProtected(key: string, protectedPrefixes: Set<string>): { protected: boolean; matchedPrefix: string | null } {
  for (const prefix of protectedPrefixes) {
    if (key === prefix || key.startsWith(`${prefix}.`)) {
      return { protected: true, matchedPrefix: prefix }
    }
  }
  return { protected: false, matchedPrefix: null }
}

function main(): void {
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
  const localeData: Record<Locale, ReturnType<typeof loadLocale>> = {} as never
  for (const loc of LOCALES) localeData[loc] = loadLocale(loc)

  console.log('🛡️  加载动态 namespace 保护白名单...')
  const protectedPrefixes = loadProtectedPrefixes()
  console.log(`  ${protectedPrefixes.size} 个 namespace 受保护:`)
  for (const p of Array.from(protectedPrefixes).sort().slice(0, 15)) {
    console.log(`    - ${p}`)
  }
  if (protectedPrefixes.size > 15) {
    console.log(`    ... 还有 ${protectedPrefixes.size - 15} 个`)
  }

  console.log('\n🔎 找出孤儿 key (zh-CN 存在但无源码引用, 排除受保护 namespace)...')
  // 收集 zh-CN 所有的 leaf key
  const zhCnLeaves = new Set<string>()
  for (const obj of localeData['zh-CN'].byFile.values()) {
    collectLeafKeys(obj, '', zhCnLeaves)
  }
  console.log(`  zh-CN leaf keys: ${zhCnLeaves.size}`)

  // 找出孤儿 (zh-CN 有, 源码无, 不在保护 namespace 下)
  const orphans = new Set<string>()
  const protectedHits = new Map<string, number>() // matchedPrefix -> count
  for (const leaf of zhCnLeaves) {
    if (usedKeys.has(leaf)) continue
    const prot = isProtected(leaf, protectedPrefixes)
    if (prot.protected) {
      protectedHits.set(prot.matchedPrefix!, (protectedHits.get(prot.matchedPrefix!) || 0) + 1)
      continue
    }
    orphans.add(leaf)
  }
  console.log(`  zh-CN leaf 中被保护: ${Array.from(protectedHits.values()).reduce((a, b) => a + b, 0)} 个`)
  console.log(`  真正孤儿 leaf keys: ${orphans.size}`)

  console.log('🔬 检查每个孤儿 key 的"删除可行性"...')
  const allLocaleOrphans: string[] = []
  const partialLocaleOrphans: string[] = []
  for (const key of orphans) {
    const exists = LOCALES.map((loc) => hasKey(localeData[loc].merged, key))
    const count = exists.filter(Boolean).length
    if (count === LOCALES.length) {
      allLocaleOrphans.push(key)
    } else if (count >= 2) {
      partialLocaleOrphans.push(key)
    } else if (count === 1 && exists[0]) {
      partialLocaleOrphans.push(key)
    }
  }
  console.log(`  5 语言全有 (safe): ${allLocaleOrphans.length}`)
  console.log(`  部分语言有:         ${partialLocaleOrphans.length}`)

  const totalRemovable = allLocaleOrphans.length + partialLocaleOrphans.length

  // 按 module 分组 (top-level)
  const byModule: Record<string, { allLocale: string[]; partial: string[] }> = {}
  for (const k of allLocaleOrphans) {
    const mod = k.split('.')[0]
    if (!byModule[mod]) byModule[mod] = { allLocale: [], partial: [] }
    byModule[mod].allLocale.push(k)
  }
  for (const k of partialLocaleOrphans) {
    const mod = k.split('.')[0]
    if (!byModule[mod]) byModule[mod] = { allLocale: [], partial: [] }
    byModule[mod].partial.push(k)
  }

  console.log('\n📊 待清理 module 分布 (Top 30):')
  const sortedMods = Object.entries(byModule)
    .map(([mod, g]) => ({ mod, count: g.allLocale.length + g.partial.length, ...g }))
    .sort((a, b) => b.count - a.count)
  for (const m of sortedMods.slice(0, 30)) {
    console.log(`  ${m.mod.padEnd(28)} all:${String(m.allLocale.length).padStart(4)}  partial:${String(m.partial.length).padStart(4)}  total:${m.count}`)
  }
  console.log(`\n总计: ${totalRemovable} 个 leaf key 待清理 (${sortedMods.length} 个 module)`)

  // 生成报告
  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  const report = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'APPLY' : 'DRY-RUN',
    summary: {
      totalUsedKeys: usedKeys.size,
      zhCnLeafKeys: zhCnLeaves.size,
      protectedByNamespace: Array.from(protectedHits.values()).reduce((a, b) => a + b, 0),
      totalOrphansAfterProtect: orphans.size,
      allLocaleOrphans: allLocaleOrphans.length,
      partialLocaleOrphans: partialLocaleOrphans.length,
      totalRemovable,
      modulesAffected: sortedMods.length,
      protectedPrefixes: Array.from(protectedPrefixes).sort(),
    },
    byModule: Object.fromEntries(
      sortedMods.map((m) => [m.mod, {
        allLocale: m.allLocale,
        partial: m.partial,
        total: m.count,
      }])
    ),
    byModuleSample: Object.fromEntries(
      sortedMods.slice(0, 10).map((m) => [m.mod, {
        allLocaleSample: m.allLocale.slice(0, 10),
        partialSample: m.partial.slice(0, 10),
        total: m.count,
      }])
    ),
  }
  const reportPath = path.join(REPORTS_DIR, 'orphan-keys-cleanup.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf-8')
  console.log(`\n📝 报告: ${path.relative(ROOT, reportPath)}`)

  if (!APPLY) {
    console.log('\n⚠️  DRY-RUN 模式, 未修改任何文件')
    console.log('   要实际清理请运行: tsx scripts/clean-orphan-i18n.ts --apply')
    return
  }

  // 实际清理
  console.log('\n🗑️  开始清理...')
  let deletedCount = 0
  const allKeys = [...allLocaleOrphans, ...partialLocaleOrphans]
  for (const loc of LOCALES) {
    const byFile = localeData[loc].byFile
    let locDeleted = 0
    for (const [mod, data] of byFile.entries()) {
      let modDeleted = 0
      for (const key of allKeys) {
        if (key.split('.')[0] !== mod) continue
        if (deleteLeafKey(data, key)) modDeleted++
      }
      if (modDeleted > 0) {
        pruneEmptyObjects(data)
        writeJSON(path.join(LOCALES_DIR, loc, `${mod}.json`), data)
        locDeleted += modDeleted
      }
    }
    if (locDeleted > 0) {
      console.log(`  ✅ ${loc.padEnd(8)} 清理 ${locDeleted} 个 leaf key`)
      deletedCount += locDeleted
    }
  }
  console.log(`\n🎉 共清理 ${deletedCount} 处 leaf key (跨 5 语言)`)
  console.log('   建议: 跑 npm run check:i18n:keys -- --all 验证无回归')
}

main()
