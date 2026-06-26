/**
 * 一次性脚本: 批量提取 t('xxx.yyy.zzz') 调用中未在 locale 中定义的 key,
 * 按 top-level module 分组生成 5 语言 locale 文件 (合并到现有模块).
 *
 * 策略:
 *   1. 扫描所有 .vue/.ts/.tsx/.js/.jsx 中 t/tSafe/$t 调用的静态 key
 *   2. 对比 5 语言 locale, 找出未在任意 locale 中定义的 key (全新缺失)
 *   3. 按 top-level module (key.split('.')[0]) 分组
 *   4. 对每个 module, 把这些 key 加入对应 locale 文件 (5 语言)
 *      - zh-CN: 用 key 的最后一段作为 value (Chinese-literal-as-value 模式)
 *      - 其他 4 语言: 用英文占位 [ZH:xxx] 或 key 末段
 *
 * 与 extract-api-i18n.ts 的区别:
 *   - extract-api-i18n.ts 专用于 api.* (固定 zh-CN 模式)
 *   - 本脚本通用, 处理任意 module 的新增 key, 但仅处理"全新"缺失 (在所有 5 语言都没定义的)
 *
 * 用法: tsx scripts/extract-missing-i18n.ts
 * 注意: 此脚本会修改 5 个语言目录下的 JSON 文件, 建议先 git commit 当前状态
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIRS = [path.join(ROOT, 'src'), path.join(ROOT, 'miniapp', 'src')].filter((p) => fs.existsSync(p))
const LOCALES_DIR = path.join(ROOT, 'src', 'locales', 'modules')

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
type Locale = (typeof LOCALES)[number]

// 跳过 coreModules 已覆盖的模块, 跳过已经在 asyncModules 里的
// (asyncModule 会按需加载, 仍需在 locale 文件中定义, 所以不跳过)
const KNOWN_MODULES = new Set([
  'api', 'common', 'navigation', 'header', 'auth', 'routes', 'errorBoundary',
  'login', 'commandPalette',
])

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
      if (['node_modules', 'dist', '.git', '__tests__', '__mocks__', 'mock'].includes(e.name)) continue
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

function loadAllLocales(): Record<Locale, Record<string, unknown>> {
  const result = {} as Record<Locale, Record<string, unknown>>
  for (const loc of LOCALES) {
    const dir = path.join(LOCALES_DIR, loc)
    const merged: Record<string, unknown> = {}
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.json')) continue
        const obj = readJSON<Record<string, unknown>>(path.join(dir, f))
        if (obj) {
          deepMerge(merged, obj)
        }
      }
    }
    result[loc] = merged
  }
  return result
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') {
      deepMerge(target[k] as Record<string, unknown>, v as Record<string, unknown>)
    } else if (!(k in target)) {
      target[k] = v
    }
  }
}

/** 把 key 转成叶子值, 用于 zh-CN 兜底 */
function leafFromKey(key: string): string {
  const parts = key.split('.')
  return parts[parts.length - 1]
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
  const localeData = loadAllLocales()
  for (const loc of LOCALES) {
    let cnt = 0
    const count = (o: unknown) => {
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        for (const v of Object.values(o as Record<string, unknown>)) {
          if (v && typeof v === 'object') count(v)
          else cnt++
        }
      }
    }
    count(localeData[loc])
    console.log(`  ${loc.padEnd(8)} ${cnt} keys`)
  }

  console.log('🔎 找出"全新缺失"key (所有 5 语言都没有)...')
  // "全新缺失" = 任意 locale 都没有 = 这次要补的
  const newMissing = new Set<string>()
  for (const key of usedKeys) {
    const hasAny = LOCALES.some((loc) => hasKey(localeData[loc], key))
    if (!hasAny) newMissing.add(key)
  }
  console.log(`  找到 ${newMissing.size} 个全新缺失 key`)

  if (newMissing.size === 0) {
    console.log('  (无新增 key, 不写任何文件)')
    return
  }

  // 按 top-level module 分组
  const byModule: Record<string, Set<string>> = {}
  for (const k of newMissing) {
    const mod = k.split('.')[0]
    if (!byModule[mod]) byModule[mod] = new Set()
    byModule[mod].add(k)
  }

  console.log('📊 按 module 分组:')
  const modStats = Object.entries(byModule)
    .sort((a, b) => b[1].size - a[1].size)
  for (const [mod, set] of modStats) {
    const isCore = KNOWN_MODULES.has(mod) ? ' [core]' : ''
    console.log(`  ${mod.padEnd(20)} ${set.size} keys${isCore}`)
  }

  // 对每个 module 写入对应 locale 文件
  for (const [mod, keysSet] of Object.entries(byModule)) {
    const keys = Array.from(keysSet).sort()
    const moduleName = mod // 用 top-level 作为 module 文件名

    for (const loc of LOCALES) {
      const filePath = path.join(LOCALES_DIR, loc, `${moduleName}.json`)
      const existing = readJSON<Record<string, unknown>>(filePath) || {}
      let added = 0
      for (const key of keys) {
        // key 形如 "mod.sub1.sub2.leaf" - 需要在 existing 里创建 mod.sub1.sub2.leaf = value
        // 但 existing 的顶层 key 应该是 mod, 所以需要 nested merge
        const parts = key.split('.')
        // 顶层 = parts[0] (== moduleName), 叶子 = parts[last]
        // 实际写法: 在 existing[moduleName][sub1]...[leaf] = value
        // 如果 existing 没有 moduleName, 创建空对象
        if (!existing[moduleName] || typeof existing[moduleName] !== 'object') {
          existing[moduleName] = {}
        }
        let cur: Record<string, unknown> = existing[moduleName] as Record<string, unknown>
        for (let i = 1; i < parts.length - 1; i++) {
          const p = parts[i]
          if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {}
          cur = cur[p] as Record<string, unknown>
        }
        const leafKey = parts[parts.length - 1]
        if (cur[leafKey] === undefined) {
          cur[leafKey] = loc === 'zh-CN' ? leafFromKey(key) : `[ZH:${leafFromKey(key)}]`
          added++
        }
      }
      if (added > 0) {
        writeJSON(filePath, existing)
        console.log(`  ✅ ${loc.padEnd(8)} -> ${path.relative(ROOT, filePath)}  (+${added} keys)`)
      }
    }
  }

  console.log('\n📋 下一步:')
  console.log('  1. 把新增的 module 加入 locales/index.ts 的 coreModules (按需)')
  console.log('  2. 重新跑 npm run check:i18n:keys -- --baseline 锁定新基线')
}

main()
