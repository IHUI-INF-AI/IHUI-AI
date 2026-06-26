/**
 * 一次性脚本: 把 zh-CN 中已存在但其他 4 语言缺失的 key 同步过去
 * 解决 analyze-missing-keys.ts 报告的 "zh-CN 独占 (103)" 和 "部分覆盖 (2)"
 *
 * 策略:
 *   1. 扫描所有源码 t() 调用的 key
 *   2. 对每个 key, 检查 5 个 locale 的覆盖情况
 *   3. zh-CN 有但其他语言无的 -> 把 zh-CN 值复制过去, 4 语言用 [ZH:zhValue] 标记占位
 *   4. 部分覆盖 (2-4 个语言有) -> 同样补齐缺失的语言
 *
 * 行为:
 *   - 写入 4 个语言 (zh-TW, en, ja, ko) 的对应 module JSON
 *   - 用 module name = key.split('.')[0] 定位文件
 *   - nested key 路径自动创建中间对象
 *
 * 用法: tsx scripts/fill-partial-i18n.ts
 *
 * 注意: 与 extract-missing-i18n.ts 互补:
 *   - extract-missing-i18n: 处理"5 语言全无"的全新 key (用 leaf key 兜底)
 *   - fill-partial-i18n:    处理"仅 zh-CN 有"的 key (用 zh-CN 实际值同步, 保证不丢失原文)
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIRS = [path.join(ROOT, 'src'), path.join(ROOT, 'miniapp', 'src')].filter((p) => fs.existsSync(p))
const LOCALES_DIR = path.join(ROOT, 'src', 'locales', 'modules')

const SOURCE_LOCALE = 'zh-CN' as const
const TARGET_LOCALES = ['zh-TW', 'en', 'ja', 'ko'] as const
const LOCALES = [SOURCE_LOCALE, ...TARGET_LOCALES] as const
type Locale = (typeof LOCALES)[number]

const SKIP_DIRS = ['node_modules', 'dist', '.git', '__tests__', '__mocks__', 'mock']

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

function getKeyValue(obj: unknown, key: string): unknown {
  const parts = key.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
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

function loadLocale(loc: Locale): Record<string, unknown> {
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

/** 找到应该在哪个文件里写入 (根据 top-level module), 创建 nested path 并设值 */
function setNestedKey(existing: Record<string, unknown>, key: string, value: unknown): boolean {
  const parts = key.split('.')
  const top = parts[0]
  if (!existing[top] || typeof existing[top] !== 'object') {
    existing[top] = {}
  }
  let cur: Record<string, unknown> = existing[top] as Record<string, unknown>
  for (let i = 1; i < parts.length - 1; i++) {
    const p = parts[i]
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {}
    cur = cur[p] as Record<string, unknown>
  }
  const leaf = parts[parts.length - 1]
  if (cur[leaf] !== undefined) return false
  cur[leaf] = value
  return true
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
  const localeData: Record<Locale, Record<string, unknown>> = {} as never
  for (const loc of LOCALES) localeData[loc] = loadLocale(loc)

  console.log('🔎 找出"zh-CN 独占"和"部分覆盖"key...')
  // 1. zh-CN 独占: 缺失 zh-TW/en/ja/ko 中的全部 (即 4 个目标语言都没有)
  // 2. 部分覆盖: 缺失部分语言
  const toFill: Array<{ key: string; zhValue: unknown; missing: Locale[] }> = []
  for (const key of usedKeys) {
    if (!hasKey(localeData[SOURCE_LOCALE], key)) continue
    const missing = TARGET_LOCALES.filter((loc) => !hasKey(localeData[loc], key))
    if (missing.length === 0) continue
    const zhValue = getKeyValue(localeData[SOURCE_LOCALE], key)
    toFill.push({ key, zhValue, missing })
  }
  console.log(`  找到 ${toFill.length} 个需补齐的 key`)

  if (toFill.length === 0) {
    console.log('  (无 key 需补齐)')
    return
  }

  // 按 top-level module + target locale 分组
  const byModLoc: Record<string, Record<Locale, string[]>> = {}
  for (const item of toFill) {
    const mod = item.key.split('.')[0]
    if (!byModLoc[mod]) byModLoc[mod] = {} as never
    for (const loc of item.missing) {
      if (!byModLoc[mod][loc]) byModLoc[mod][loc] = []
      byModLoc[mod][loc].push(item.key)
    }
  }

  console.log('📊 分布:')
  const modList = Object.entries(byModLoc).sort((a, b) => {
    const sum = (o: Record<Locale, string[]>) => Object.values(o).reduce((a2, b2) => a2 + b2.length, 0)
    return sum(b[1]) - sum(a[1])
  })
  for (const [mod, byLoc] of modList) {
    const parts = TARGET_LOCALES.map((loc) => `${loc}:${byLoc[loc]?.length || 0}`)
    console.log(`  ${mod.padEnd(20)} ${parts.join('  ')}`)
  }

  // 写入
  let totalAdded = 0
  for (const [mod, byLoc] of modList) {
    for (const loc of TARGET_LOCALES) {
      const keys = byLoc[loc]
      if (!keys || keys.length === 0) continue
      const filePath = path.join(LOCALES_DIR, loc, `${mod}.json`)
      const existing = readJSON<Record<string, unknown>>(filePath) || {}
      let added = 0
      for (const key of keys) {
        const item = toFill.find((it) => it.key === key)
        if (!item) continue
        // 对 4 语言使用 zh-CN 值 + [ZH:xxx] 标记占位 (后续翻译)
        const placeholderValue = typeof item.zhValue === 'string'
          ? `[ZH:${item.zhValue}]`
          : item.zhValue
        if (setNestedKey(existing, key, placeholderValue)) added++
      }
      if (added > 0) {
        writeJSON(filePath, existing)
        totalAdded += added
        console.log(`  ✅ ${loc.padEnd(8)} -> ${path.relative(ROOT, filePath)}  (+${added} keys)`)
      }
    }
  }

  console.log(`\n🎉 共写入 ${totalAdded} 处 key (跨 4 语言)`)
  console.log('📋 下一步:')
  console.log('  1. 重新跑 npm run check:i18n:keys -- --all 验证覆盖度')
  console.log('  2. 跑 npm run check:i18n:keys -- --baseline 锁定新基线')
}

main()
