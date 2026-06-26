/**
 * i18n 翻译后质量验证脚本 (2026-06-26 新增)
 *
 * 用法:
 *   npx tsx scripts/verify-translation-quality.ts                 # 验证 4 语言覆盖 + 质量
 *   npx tsx scripts/verify-translation-quality.ts --sample=10     # 抽 10 个翻译项做样例
 *   npx tsx scripts/verify-translation-quality.ts --rollback      # 验证后自动回滚
 *
 * 检查项:
 *   1. 4 语言 (zh-TW, en, ja, ko) 文件结构与 zh-CN 一致 (全语言覆盖)
 *   2. 翻译残留中文统计 (每语言)
 *   3. [ZH:xxx] 占位符残留 (每语言)
 *   4. 翻译覆盖率 (每语言 vs zh-CN)
 *   5. 随机抽样 N 个翻译项, 展示 zh-CN 原文 vs 目标语言译文
 *
 * 输出: 直接打印到 console + 详细报告写到 scripts/reports/verify-translation-{ts}.json
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const LOCALES_DIR = path.join(ROOT, 'src', 'locales', 'modules')
const REPORTS_DIR = path.join(ROOT, 'scripts', 'reports')

const args = process.argv.slice(2)
const sampleArg = args.find((a) => a.startsWith('--sample='))
const sampleN = sampleArg ? Math.max(1, parseInt(sampleArg.slice('--sample='.length), 10) || 10) : 10
const rollbackFlag = args.includes('--rollback')

const SOURCE_LOCALE = 'zh-CN'
const TARGET_LOCALES = ['zh-TW', 'en', 'ja', 'ko'] as const
type TargetLocale = (typeof TARGET_LOCALES)[number]

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/
const PLACEHOLDER_RE = /^\[ZH:([\s\S]*)\]$/

interface KeyPath {
  module: string
  keyPath: string
  sourceText: string
}

interface LocaleStats {
  locale: TargetLocale
  totalStrings: number
  missingKeys: number
  chineseResidue: number
  placeholderResidue: number
  keyEquals: number
  validTranslations: number
  coverage: number
}

function readJSON<T = unknown>(p: string): T | null {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
  } catch {
    return null
  }
}

function walkLeaves(obj: unknown, prefix: string, cb: (keyPath: string, value: string) => void): void {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const curPath = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') {
      cb(curPath, v)
    } else if (v && typeof v === 'object') {
      walkLeaves(v, curPath, cb)
    }
  }
}

function getNested(obj: unknown, keyPath: string): unknown {
  const parts = keyPath.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function loadModuleMap(locale: string): Map<string, string> {
  const result = new Map<string, string>()
  const dir = path.join(LOCALES_DIR, locale)
  if (!fs.existsSync(dir)) return result
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const module = f.replace(/\.json$/, '')
    const obj = readJSON<Record<string, unknown>>(path.join(dir, f))
    if (obj) {
      walkLeaves(obj, '', (keyPath, value) => {
        result.set(`${module}::${keyPath}`, value)
      })
    }
  }
  return result
}

function main(): void {
  console.log('🔍 i18n 翻译后质量验证')
  console.log(`   抽样: ${sampleN} 个翻译项`)
  console.log(`   源语言: ${SOURCE_LOCALE}`)
  console.log(`   目标: ${TARGET_LOCALES.join(', ')}`)
  console.log('')

  // 1. 加载 zh-CN 源
  console.log('📚 加载 zh-CN 源...')
  const zhMap = loadModuleMap(SOURCE_LOCALE)
  const zhTotal = zhMap.size
  console.log(`   zh-CN 共 ${zhTotal} 个字符串节点`)

  // 2. 加载目标语言 + 统计
  const localeMaps: Record<TargetLocale, Map<string, string>> = {} as Record<TargetLocale, Map<string, string>>
  const stats: Record<TargetLocale, LocaleStats> = {} as Record<TargetLocale, LocaleStats>

  for (const locale of TARGET_LOCALES) {
    const m = loadModuleMap(locale)
    localeMaps[locale] = m

    let chineseResidue = 0
    let placeholderResidue = 0
    let keyEquals = 0
    let valid = 0

    for (const [k, v] of m) {
      if (PLACEHOLDER_RE.test(v)) {
        placeholderResidue++
      } else if (CJK_RE.test(v)) {
        chineseResidue++
      } else {
        // 简单判断: value === key末段视为 key-equals
        const last = k.split('::').pop()?.split('.').pop() || ''
        if (last && v.trim().toLowerCase() === last.trim().toLowerCase()) {
          keyEquals++
        } else {
          valid++
        }
      }
    }

    // 覆盖率 = 在 zhMap 中存在的 key 里, target 也存在的比例
    let present = 0
    for (const k of zhMap.keys()) {
      if (m.has(k)) present++
    }
    const coverage = zhTotal > 0 ? present / zhTotal : 0

    stats[locale] = {
      locale,
      totalStrings: m.size,
      missingKeys: zhTotal - present,
      chineseResidue,
      placeholderResidue,
      keyEquals,
      validTranslations: valid,
      coverage,
    }
  }

  // 3. 打印统计
  console.log('\n📊 4 语言统计:\n')
  console.log('locale   总节点    缺失key   残留中文   [ZH:xxx]   值=键名   有效翻译   覆盖率')
  console.log('-'.repeat(80))
  for (const locale of TARGET_LOCALES) {
    const s = stats[locale]
    const cov = (s.coverage * 100).toFixed(1).padStart(5) + '%'
    console.log(
      `${locale.padEnd(8)} ${String(s.totalStrings).padStart(8)} ${String(s.missingKeys).padStart(8)}   ${String(s.chineseResidue).padStart(8)}   ${String(s.placeholderResidue).padStart(8)}   ${String(s.keyEquals).padStart(8)}   ${String(s.validTranslations).padStart(8)}   ${cov}`
    )
  }

  // 4. 全语言覆盖 (key 结构) - 检查每个语言是否包含所有 zh-CN key
  console.log('\n🔑 全语言覆盖检查 (与 zh-CN key 集合对比):')
  const allMatch = TARGET_LOCALES.every((loc) => stats[loc].missingKeys === 0)
  if (allMatch) {
    console.log('   ✅ 4 语言 key 集合与 zh-CN 完全一致')
  } else {
    console.log('   ⚠️ 存在缺失 key:')
    for (const locale of TARGET_LOCALES) {
      if (stats[locale].missingKeys > 0) {
        console.log(`     ${locale}: 缺失 ${stats[locale].missingKeys} 个 key`)
      }
    }
  }

  // 5. 抽样本对比
  console.log(`\n🎲 随机抽样 ${sampleN} 个翻译项 (zh-CN -> 4 语言):`)
  const allKeys = Array.from(zhMap.keys())
  // 优先抽 chineseResidue / placeholderResidue / keyEquals 这三类 (有翻译需求的)
  const needTranslateKeys: string[] = []
  for (const locale of TARGET_LOCALES) {
    for (const k of allKeys) {
      const v = localeMaps[locale].get(k)
      if (v && (PLACEHOLDER_RE.test(v) || CJK_RE.test(v) || v === k.split('.').pop())) {
        if (!needTranslateKeys.includes(k)) needTranslateKeys.push(k)
      }
    }
  }
  const samplePool = needTranslateKeys.length > 0 ? needTranslateKeys : allKeys
  // 用确定性算法 (避免 Math.random 让结果不可重现)
  const step = Math.max(1, Math.floor(samplePool.length / sampleN))
  const samples: KeyPath[] = []
  for (let i = 0; i < samplePool.length && samples.length < sampleN; i += step) {
    const k = samplePool[i]
    const [module, ...rest] = k.split('::')
    samples.push({
      module,
      keyPath: rest.join('::'),
      sourceText: zhMap.get(k) || '',
    })
  }

  for (const s of samples) {
    console.log(`\n   📌 ${s.module} > ${s.keyPath}`)
    console.log(`      zh-CN: ${s.sourceText.slice(0, 60)}`)
    for (const locale of TARGET_LOCALES) {
      const v = localeMaps[locale].get(`${s.module}::${s.keyPath}`)
      const marker = PLACEHOLDER_RE.test(v || '')
        ? '⚠️ [ZH:占位]'
        : CJK_RE.test(v || '')
          ? '⚠️ 中文残留'
          : v === s.keyPath.split('.').pop()
            ? '⚠️ 值=键名'
            : '✅ 已翻译'
      console.log(`      ${locale.padEnd(6)}: ${marker}  ${(v || '(缺失)').slice(0, 60)}`)
    }
  }

  // 6. 写报告文件
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportPath = path.join(REPORTS_DIR, `verify-translation-${ts}.json`)
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ zhTotal, stats, samples, ts }, null, 2) + '\n',
    'utf-8'
  )
  console.log(`\n📄 报告已写入: ${path.relative(ROOT, reportPath)}`)

  if (rollbackFlag) {
    console.log(`\n⚠️ --rollback 模式: 未实现, 请用 rollback-auto-translate.mjs`)
  }

  // 7. 总结
  const totalIssue = TARGET_LOCALES.reduce(
    (sum, loc) => sum + stats[loc].chineseResidue + stats[loc].placeholderResidue + stats[loc].keyEquals,
    0
  )
  console.log(`\n📋 总结:`)
  console.log(`   4 语言残留待翻译项总计: ${totalIssue}`)
  if (totalIssue === 0) {
    console.log(`\n✅ 全部翻译完成, 无残留`)
  } else {
    console.log(`\n⏳ 还有 ${totalIssue} 个待翻译项, 可继续运行: npm run i18n:auto-translate`)
  }
}

main()
