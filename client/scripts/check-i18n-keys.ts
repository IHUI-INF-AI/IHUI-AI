/**
 * i18n 键引用完整性检查
 * 1. 扫描 src/ 下所有 .vue / .ts / .tsx / .js / .jsx 文件
 * 2. 提取 t('xxx') / t("xxx") / tSafe('xxx') / tSafe("xxx") 的第一个参数 (key)
 * 3. 对比 5 个语言模块 (zh-CN, zh-TW, en, ja, ko), 报告缺失键
 * 4. 报告孤儿键 (在 locale 中定义但未被任何文件引用) - 供清理
 * 5. 支持 baseline 模式: --baseline 生成基线快照, 默认模式与基线对比, 仅报新增缺失
 *
 * 与 check-i18n.ts 的区别:
 *   - check-i18n.ts 比较的是 locale 文件之间的覆盖率 (zh-CN 基准 vs 其他语言)
 *   - check-i18n-keys.ts 比较的是源码中 t() 实际调用 vs locale 文件 (反向校验)
 *   - 两者互补, 一个保证"语言之间对齐", 一个保证"调用方能拿到翻译"
 *
 * 使用:
 *   npm run check:i18n:keys              # 对比 baseline, 仅报新增缺失 (CI 用)
 *   npm run check:i18n:keys -- --all     # 报全部缺失 (开发用, 不受 baseline 限制)
 *   npm run check:i18n:keys -- --baseline  # 重新生成 baseline
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIRS = [path.join(ROOT, 'src'), path.join(ROOT, 'miniapp', 'src')].filter((p) => fs.existsSync(p))
const LOCALES_DIR = path.join(ROOT, 'src', 'locales', 'modules')
const BASELINE_FILE = path.join(ROOT, 'scripts', 'baselines', 'i18n-keys-baseline.json')

// 支持的 5 种语言
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
type Locale = (typeof LOCALES)[number]

// 跳过的目录
const SKIP_DIRS = ['node_modules', 'dist', '.git', '__tests__', '__mocks__', 'mock']

// 跳过的文件 (测试 fixture / 文档 / 脚本)
const SKIP_FILES = ['README', '.md']

// 解析 CLI 参数
const ARGS = process.argv.slice(2)
const MODE_BASELINE = ARGS.includes('--baseline')
const MODE_ALL = ARGS.includes('--all')

interface MissingKey {
  key: string
  locale: Locale
  file: string
  line: number
  module: string
}

interface OrphanKey {
  key: string
  file: string
  module: string
}

function readJSON<T = unknown>(p: string): T | null {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
  } catch {
    return null
  }
}

function writeJSON(p: string, data: unknown): void {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

/** 提取 t('xxx') / t("xxx") 调用中的 key (第一个字符串参数) */
function extractTCalls(content: string): Array<{ key: string; index: number }> {
  const out: Array<{ key: string; index: number }> = []
  // 匹配 t('...') / t("...") / tSafe(...) / $t(...), 支持转义
  // 排除动态 key (含 ${} 或 拼接)
  const re = /\b(?:t|tSafe|\$t)\(\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const key = m[2]
    if (key === '' || key.includes('${')) continue
    // 跳过同一行的注释 (启发: 同一行 t() 之前 30 字符内有 //)
    const lineStart = content.lastIndexOf('\n', m.index) + 1
    const lineBefore = content.slice(lineStart, m.index)
    if (lineBefore.includes('//')) continue
    out.push({ key, index: m.index })
  }
  return out
}

function indexToLine(content: string, index: number): number {
  let line = 1
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === '\n') line++
  }
  return line
}

/** 在 locale 对象中按路径查找 key, 返回 boolean */
function hasKey(obj: Record<string, unknown>, key: string): boolean {
  const parts = key.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return false
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur !== undefined && cur !== null && cur !== ''
}

/** 把 locale 整个目录的所有 module 合并成一个对象, 保留每个 key 来自哪个文件 */
function loadLocale(locale: Locale): { merged: Record<string, unknown>; keysByFile: Map<string, Set<string>> } {
  const dir = path.join(LOCALES_DIR, locale)
  const merged: Record<string, unknown> = {}
  const keysByFile = new Map<string, Set<string>>()
  if (!fs.existsSync(dir)) return { merged, keysByFile }
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const obj = readJSON<Record<string, unknown>>(path.join(dir, f))
    if (!obj) continue
    const moduleName = f.replace('.json', '')
    // 深 merge: 同 locale 内 key 冲突时后到覆盖 (通常不会冲突)
    deepMerge(merged, obj)
    const set = keysByFile.get(moduleName) || new Set<string>()
    collectTopKeys(obj, '', set)
    keysByFile.set(moduleName, set)
  }
  return { merged, keysByFile }
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

function collectTopKeys(obj: Record<string, unknown>, prefix: string, out: Set<string>): void {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      // 只在叶子层加 (避免重复)
      collectTopKeys(v as Record<string, unknown>, key, out)
    } else {
      out.add(key)
    }
  }
}

function walk(dir: string, cb: (file: string) => void): void {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.some((s) => e.name === s)) continue
      walk(p, cb)
    } else {
      if (SKIP_FILES.some((s) => p.includes(s))) continue
      cb(p)
    }
  }
}

interface BaselineData {
  generatedAt: string
  totalUsedKeys: number
  // 每个 key 的缺失 locale 集合 (baseline 锁定已知缺失)
  missingByKey: Record<string, Locale[]>
  // 孤儿键 (zh-CN 中定义但未被引用, 仅警告)
  orphanKeys: string[]
}

function main(): void {
  console.log('\n🔍 i18n 键引用完整性检查')
  console.log('━'.repeat(70))
  console.log(`扫描目录: ${SRC_DIRS.map((d) => path.relative(ROOT, d)).join(', ')}`)
  console.log(`语言:     ${LOCALES.join(', ')}`)
  console.log(`模式:     ${MODE_BASELINE ? 'BASELINE (生成基线)' : MODE_ALL ? 'ALL (报全部缺失)' : 'CHECK (对比基线, 仅报新增)'}`)
  console.log()

  // 1. 收集所有 t() 调用的 key
  const usedKeys = new Map<string, Array<{ file: string; line: number }>>()
  for (const root of SRC_DIRS) {
    walk(root, (file) => {
      if (!/\.(vue|ts|tsx|js|jsx)$/.test(file)) return
      const content = fs.readFileSync(file, 'utf-8')
      const calls = extractTCalls(content)
      for (const { key, index } of calls) {
        const line = indexToLine(content, index)
        const arr = usedKeys.get(key) || []
        arr.push({ file: path.relative(ROOT, file), line })
        usedKeys.set(key, arr)
      }
    })
  }
  console.log(`📦 源码中 t() 调用: ${usedKeys.size} 个独立 key, ${Array.from(usedKeys.values()).reduce((a, b) => a + b.length, 0)} 次引用`)

  // 2. 加载所有 locale
  const localeData: Record<Locale, ReturnType<typeof loadLocale>> = {} as never
  for (const loc of LOCALES) {
    localeData[loc] = loadLocale(loc)
    const totalKeys = Array.from(localeData[loc].keysByFile.values()).reduce((a, b) => a + b.size, 0)
    console.log(`📚 ${loc.padEnd(8)} ${totalKeys} keys across ${localeData[loc].keysByFile.size} files`)
  }

  // 3. 计算每个 key 在每个 locale 的缺失
  const missingByKey: Record<string, Locale[]> = {}
  for (const [key] of usedKeys) {
    const missingLocales: Locale[] = []
    for (const loc of LOCALES) {
      if (!hasKey(localeData[loc].merged, key)) missingLocales.push(loc)
    }
    if (missingLocales.length > 0) missingByKey[key] = missingLocales
  }

  const totalMissingPairs = Object.values(missingByKey).reduce((a, b) => a + b.length, 0)
  console.log(`🔎 当前总缺失 (key×locale): ${totalMissingPairs} 处 (覆盖 ${Object.keys(missingByKey).length} 个 key)`)

  // 4. 孤儿键 (zh-CN 中定义的叶子 key, 未被任何源码 t() 引用)
  const orphans: OrphanKey[] = []
  const zhCnLeafKeys = new Set<string>()
  for (const keys of localeData['zh-CN'].keysByFile.values()) {
    for (const k of keys) zhCnLeafKeys.add(k)
  }
  for (const k of zhCnLeafKeys) {
    const isUsed = usedKeys.has(k) || Array.from(usedKeys.keys()).some((uk) => uk.startsWith(`${k}.`))
    if (!isUsed) orphans.push({ key: k, file: '', module: k.split('.')[0] })
  }
  console.log(`🗑️  孤儿键 (zh-CN 定义未引用): ${orphans.length} 个`)

  // 5. baseline 模式: 写入基线
  if (MODE_BASELINE) {
    const baseline: BaselineData = {
      generatedAt: new Date().toISOString(),
      totalUsedKeys: usedKeys.size,
      missingByKey,
      orphanKeys: orphans.map((o) => o.key),
    }
    writeJSON(BASELINE_FILE, baseline)
    console.log(`\n✅ Baseline 已写入: ${path.relative(ROOT, BASELINE_FILE)}`)
    console.log(`   ${Object.keys(baseline.missingByKey).length} 个 key 有缺失, ${baseline.orphanKeys.length} 个孤儿键`)
    process.exit(0)
  }

  // 6. 对比 baseline, 找出新增缺失
  const baseline = readJSON<BaselineData>(BASELINE_FILE)
  const newMissingByKey: Record<string, { key: string; locale: Locale; file: string; line: number; module: string }[]> = {}
  if (!baseline) {
    if (!MODE_ALL) {
      console.log(`\n⚠️  未找到 baseline 文件: ${path.relative(ROOT, BASELINE_FILE)}`)
      console.log('   请先运行: npm run check:i18n:keys -- --baseline')
      console.log('   或使用 --all 查看全部缺失')
    }
  } else {
    for (const [key, missingLocales] of Object.entries(missingByKey)) {
      const baselineMissing = baseline.missingByKey[key] || []
      // 找出"新增"缺失: 当前缺失但 baseline 不缺失
      const newlyMissing = missingLocales.filter((loc) => !baselineMissing.includes(loc))
      if (newlyMissing.length > 0 && usedKeys.has(key)) {
        const refs = usedKeys.get(key)!
        newMissingByKey[key] = newlyMissing.map((loc) => {
          const first = refs[0]
          return { key, locale: loc, file: first.file, line: first.line, module: key.split('.')[0] }
        })
      }
    }
    const newTotal = Object.values(newMissingByKey).reduce((a, b) => a + b.length, 0)
    console.log(`📈 对比基线: 新增缺失 ${newTotal} 处 (覆盖 ${Object.keys(newMissingByKey).length} 个 key)`)
  }

  // 7. 输出报告
  console.log()
  const reportMissing = MODE_ALL || !baseline ? missingByKey : newMissingByKey
  if (Object.keys(reportMissing).length === 0) {
    console.log('✅ 缺失键: 0 (所有 t() 引用在 5 种语言中都能找到)')
  } else {
    console.log(`${MODE_ALL || !baseline ? '❌' : '❌'} 缺失键: ${Object.values(reportMissing).reduce((a, b) => a + b.length, 0)} 处`)
    // 按 locale 分组
    const byLocale: Record<string, MissingKey[]> = {}
    for (const m of Object.values(reportMissing).flat()) {
      ;(byLocale[m.locale] = byLocale[m.locale] || []).push(m)
    }
    for (const loc of LOCALES) {
      const list = byLocale[loc] || []
      if (list.length === 0) continue
      console.log(`  ${loc}: ${list.length} 个缺失`)
      const sample = list.slice(0, 10)
      for (const m of sample) {
        console.log(`    - ${m.key}  (${m.file}:${m.line})`)
      }
      if (list.length > 10) {
        console.log(`    ... 还有 ${list.length - 10} 个`)
      }
    }
  }

  // 8. 孤儿键
  console.log()
  if (orphans.length === 0) {
    console.log('✅ 孤儿键: 0 (所有 zh-CN 顶层 key 都被引用)')
  } else {
    console.log(`⚠️  孤儿键: ${orphans.length} 个 (zh-CN 中定义但未被任何源码 t() 引用, 仅警告)`)
    const sample = orphans.slice(0, 10)
    for (const o of sample) {
      console.log(`    - ${o.key}`)
    }
    if (orphans.length > 10) {
      console.log(`    ... 还有 ${orphans.length - 10} 个`)
    }
  }

  // 9. 退出码
  console.log('\n' + '━'.repeat(70))
  if (MODE_ALL || !baseline) {
    // 全量模式: 不作为 CI gate, 仅报告
    console.log('ℹ️  全量模式: 报告完成, 未生成 baseline')
    process.exit(0)
  } else {
    // 增量模式: 有新增缺失则失败
    const newTotal = Object.values(newMissingByKey).reduce((a, b) => a + b.length, 0)
    if (newTotal > 0) {
      console.log(`❌ i18n 键引用检查失败: 新增 ${newTotal} 处缺失键`)
      console.log('   修复建议: 在 src/locales/modules/{locale}/{module}.json 添加对应 key')
      console.log('   或重新生成基线 (确认现有缺失为已知): npm run check:i18n:keys -- --baseline')
      process.exit(1)
    } else {
      console.log('✅ i18n 键引用检查通过 (无新增缺失)')
      process.exit(0)
    }
  }
}

main()
