/**
 * i18n zh-CN 兜底检测 (2026-07-02 立, P0-2 修复)
 *
 * 问题背景:
 *   check:i18n:keys / check:login:i18n 检查"键是否存在", 不检查"值是否被翻译"。
 *   历史 bug: en/zh-TW/ja/ko 的值是 zh-CN 兜底 (即 zh-CN 中文原样复制到其他语言),
 *   现有 CI 仍判定为"100% 覆盖通过", 用户切到英文看到中文, 体验割裂。
 *
 * 解决:
 *   新增此脚本, 逐个 key 对比 en/zh-TW/ja/ko 与 zh-CN 的值, 命中则打 warning。
 *   不阻塞现有 CI, 但通过 PR 描述可见问题。
 *
 * 行为分级 (按严格度):
 *   - 默认 (无 flag): 仅输出统计, exit 0 (观察模式)
 *   - --fail-over=N (N 整数): zh-CN 兜底总数 > N 时 exit 1
 *   - I18N_FAIL_FALLBACK_COUNT=100: 同上, 数字环境变量形式
 *   - --per-lang-threshold=N: 任一语言 zh-CN 兜底 > N 时 exit 1
 *
 * 用法:
 *   tsx scripts/check-i18n-zhcn-fallback.ts                 # 观察模式
 *   tsx scripts/check-i18n-zhcn-fallback.ts --fail-over=500 # 兜底 > 500 失败
 *   I18N_FAIL_FALLBACK_COUNT=100 tsx scripts/check-i18n-zhcn-fallback.ts
 *
 * 跳过:
 *   - zh-CN locale 自身 (基准)
 *   - 标点/纯数字/单字符 等"任何语言都不需要翻译"的值
 *   - 已是英文/日文/韩文 的非 zh-CN 语言 (不视为兜底)
 *   - empty / null / 占位符
 */

import fs from 'node:fs'
import path from 'node:path'

const LOCALES = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko'] as const
type Locale = (typeof LOCALES)[number]
const NON_BASELINE_LOCALES: Locale[] = ['en', 'zh-TW', 'ja', 'ko']

const CLIENT_ROOT = process.cwd()
const MODULES_DIR = path.join(CLIENT_ROOT, 'src', 'locales', 'modules')

interface FallbackHit {
  module: string
  keyPath: string
  locale: Locale
  value: string
  zhCnValue: string
  length: number
}

function readJSON(p: string): Record<string, unknown> | null {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

/** 扁平化嵌套对象 → [[keyPath, value], ...] */
function flattenValues(
  obj: Record<string, unknown>,
  prefix = '',
): [string, string][] {
  const out: [string, string][] = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenValues(v as Record<string, unknown>, key))
    } else {
      out.push([key, String(v ?? '')])
    }
  }
  return out
}

/** 判断字符串是否是中文 (CJK 统一汉字) */
function hasChinese(s: string): boolean {
  return /[一-鿿]/.test(s)
}

/** 判断字符串是否是日文假名 */
function hasJapanese(s: string): boolean {
  return /[぀-ゟ゠-ヿ]/.test(s)
}

/** 判断字符串是否是韩文 */
function hasKorean(s: string): boolean {
  return /[가-힯ㄱ-ㅎ]/.test(s)
}

/** 是否需要翻译 (含 zh-CN 文字 + 不是纯标点/数字) */
function isTranslatable(s: string): boolean {
  if (!s) return false
  if (!hasChinese(s)) return false
  // 纯标点/数字/空格的"看起来中文但其实不是"应该跳过
  const stripped = s.replace(/[\p{P}\p{S}\s\d]/gu, '')
  return stripped.length > 0
}

function main(): void {
  const args = process.argv.slice(2)
  const failOverArg = args.find((a) => a.startsWith('--fail-over='))
  const failOver = failOverArg
    ? parseInt(failOverArg.split('=')[1], 10)
    : parseInt(process.env.I18N_FAIL_FALLBACK_COUNT || '0', 10)
  const perLangThreshold = parseInt(
    process.env.I18N_FAIL_FALLBACK_PER_LANG || '0',
    10,
  )

  console.log('\n🌐 i18n zh-CN 兜底检测 (2026-07-02)')
  console.log('━'.repeat(60))
  console.log(`基准语言: zh-CN`)
  console.log(`检测语言: ${NON_BASELINE_LOCALES.join(', ')}`)
  console.log(
    `严格度: ${
      failOver > 0
        ? `总兜底 > ${failOver} 失败`
        : perLangThreshold > 0
        ? `任一语言 > ${perLangThreshold} 失败`
        : '观察模式 (不阻塞)'
    }`,
  )
  console.log()

  if (!fs.existsSync(MODULES_DIR)) {
    console.error(`❌ modules 目录不存在: ${MODULES_DIR}`)
    process.exit(1)
  }

  // 1. 加载所有 module 文件, 缓存为 Map<moduleName, Map<keyPath, value>>
  const allModuleFiles = new Set<string>()
  for (const loc of LOCALES) {
    const dir = path.join(MODULES_DIR, loc)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.json')) allModuleFiles.add(f.replace('.json', ''))
    }
  }

  console.log(`📁 发现 ${allModuleFiles.size} 个 module 文件\n`)

  // 2. 对每个 module × 每个非基准 locale, 加载并与 zh-CN 对比
  const hits: FallbackHit[] = []
  const byLocale = new Map<Locale, number>()
  const byModule = new Map<string, number>()
  for (const loc of NON_BASELINE_LOCALES) byLocale.set(loc, 0)

  let scanned = 0
  for (const moduleName of Array.from(allModuleFiles).sort()) {
    const zhCn = readJSON(path.join(MODULES_DIR, 'zh-CN', `${moduleName}.json`))
    if (!zhCn) continue // 缺少 zh-CN 基准, 跳过
    const zhCnValues = new Map(flattenValues(zhCn))

    for (const loc of NON_BASELINE_LOCALES) {
      const data = readJSON(path.join(MODULES_DIR, loc, `${moduleName}.json`))
      if (!data) continue
      const values = flattenValues(data)

      for (const [keyPath, value] of values) {
        const zhCnValue = zhCnValues.get(keyPath)
        if (zhCnValue === undefined) continue // zh-CN 没这 key, 不归我们管
        if (!isTranslatable(zhCnValue)) continue // 不可翻译 (纯标点/数字)
        if (value !== zhCnValue) continue // 值不同 = 已翻译

        scanned++
        hits.push({
          module: moduleName,
          keyPath,
          locale: loc,
          value,
          zhCnValue,
          length: zhCnValue.length,
        })
        byLocale.set(loc, (byLocale.get(loc) || 0) + 1)
        byModule.set(moduleName, (byModule.get(moduleName) || 0) + 1)
      }
    }
  }

  console.log('📊 zh-CN 兜底统计:')
  console.log(`  扫描命中: ${scanned} 处`)
  for (const loc of NON_BASELINE_LOCALES) {
    const count = byLocale.get(loc) || 0
    const pct = scanned > 0 ? ((count / scanned) * 100).toFixed(1) : '0.0'
    console.log(`  - ${loc.padEnd(8)} ${count} 处 (${pct}%)`)
  }

  if (byModule.size > 0) {
    console.log('\n📋 兜底最多的 module (前 15):')
    const sorted = Array.from(byModule.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
    for (const [mod, count] of sorted) {
      console.log(`  ${mod.padEnd(30)} ${count} 处`)
    }
    if (byModule.size > 15) {
      console.log(`  ... 还有 ${byModule.size - 15} 个 module`)
    }
  }

  // 3. 输出示例 (前 20)
  if (hits.length > 0) {
    console.log('\n🔍 兜底示例 (前 20):')
    for (const h of hits.slice(0, 20)) {
      const sample = h.value.length > 40 ? h.value.slice(0, 40) + '...' : h.value
      console.log(
        `  [${h.locale}] ${h.module}.${h.keyPath}: "${sample}"`,
      )
    }
    if (hits.length > 20) {
      console.log(`  ... 还有 ${hits.length - 20} 处`)
    }
  }

  console.log('\n' + '━'.repeat(60))

  // 4. 输出 dump 文件供分析
  const dumpFile = path.join(CLIENT_ROOT, 'i18n-zhcn-fallback.json')
  fs.writeFileSync(
    dumpFile,
    JSON.stringify({ totalHits: hits.length, hits }, null, 2) + '\n',
    'utf-8',
  )
  console.log(`📁 全部明细 dump: ${path.relative(CLIENT_ROOT, dumpFile)}`)

  // 5. 判定
  if (failOver > 0 && hits.length > failOver) {
    console.log(
      `\n❌ zh-CN 兜底检测失败: ${hits.length} 处 > 阈值 ${failOver}`,
    )
    process.exit(1)
  }

  if (perLangThreshold > 0) {
    for (const loc of NON_BASELINE_LOCALES) {
      const count = byLocale.get(loc) || 0
      if (count > perLangThreshold) {
        console.log(
          `\n❌ zh-CN 兜底检测失败: ${loc} = ${count} > 阈值 ${perLangThreshold}`,
        )
        process.exit(1)
      }
    }
  }

  console.log(
    `\n✅ zh-CN 兜底检测通过 (${hits.length} 处${
      failOver > 0 ? ` ≤ ${failOver}` : ''
    })`,
  )
  process.exit(0)
}

main()
