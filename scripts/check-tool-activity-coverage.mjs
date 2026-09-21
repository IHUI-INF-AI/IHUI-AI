#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// 工具活动行双时态措辞覆盖守门(PROJECT_PLAN.md D81①/D83/H28)
//
// 两类判定,取向不同:
//  ① 键形(machine-checkable,一律 blocking):凡是 `*Activity` 键,五语言必须都在,且值是
//     ICU select 且含 running + completed 分支。半套措辞(只补了 zh 或漏了 completed)比不补更糟,
//     界面会出现某语言永远显示"正在"或退回中性名。
//  ② 覆盖率(ratchet):已配双时态的功能名数 **不得低于 floor**。当前只落了首批六工具,
//     逐批补时把 floor 上调即可;这样既不"入库即恒红",又锁死"补了又掉"。
//
// 用法:
//   node scripts/check-tool-activity-coverage.mjs [--json] [--self-test] [--scaffold]
//     --scaffold 打印尚未配置双时态的功能名清单(分语言缺哪一支),供逐批补齐

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TOOL_DISPLAY_FILE = join(ROOT, 'packages', 'shared', 'src', 'chat', 'tool-display.ts')
const SHARED_DIR = join(ROOT, 'packages', 'i18n', 'messages', 'shared')
const FLOOR_FILE = join(ROOT, 'scripts', 'data', 'tool-activity-coverage.json')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']
const REQUIRED_BRANCHES = ['running', 'completed']
const ACTIVITY_SUFFIX = 'Activity'
const SKIP_ENV = 'HUSKY_SKIP_TOOL_ACTIVITY_COVERAGE'

/** 从 tool-display.ts 抽 TOOL_DISPLAY_KEYS 的功能名值(引号两种形态都要匹配,历史坑) */
export function extractDisplayKeys(source) {
  const start = source.indexOf('TOOL_DISPLAY_KEYS')
  if (start === -1) return []
  const block = source.slice(start, source.indexOf('\n}', start) === -1 ? undefined : source.indexOf('\n}', start) + 2)
  const re = /:\s*(["'])((?:tool|action)[A-Za-z0-9_]*)\1/gu
  const names = new Set()
  let m
  while ((m = re.exec(block)) !== null) names.add(m[2])
  return [...names].sort()
}

export function readTaskStatus(locale) {
  const file = join(SHARED_DIR, `${locale}.json`)
  if (!existsSync(file)) return {}
  const pack = JSON.parse(readFileSync(file, 'utf8'))
  return pack.taskStatus ?? {}
}

/** 键形校验:返回该 locale 下的违规清单 */
export function validateActivityValues(displayNames, perLocale) {
  const bad = []
  for (const name of displayNames) {
    const key = `${name}${ACTIVITY_SUFFIX}`
    const present = LOCALES.filter((l) => typeof perLocale[l]?.[key] === 'string')
    if (present.length === 0) continue // 未配置 → 走 floor 计数,不算形错
    if (present.length !== LOCALES.length) {
      const missing = LOCALES.filter((l) => !present.includes(l))
      bad.push({ key, locale: missing.join(','), reason: '五语言不齐' })
      continue
    }
    for (const locale of LOCALES) {
      const value = perLocale[locale][key]
      if (!/\bselect\s*,/u.test(value)) {
        bad.push({ key, locale, reason: '不是 ICU select 值(H28 口径:一语义一键)' })
        continue
      }
      for (const branch of REQUIRED_BRANCHES) {
        if (!new RegExp(`\\b${branch}\\s*\\{[^{}]+\\}`, 'u').test(value)) {
          bad.push({ key, locale, reason: `缺 ${branch}{} 分支` })
        }
      }
      if (!/\bother\s*\{/u.test(value)) {
        bad.push({ key, locale, reason: '缺 other{} 兜底分支(state 传错时界面会空白)' })
      }
    }
  }
  return bad
}

export function countCovered(displayNames, perLocale) {
  return displayNames.filter((name) => {
    const key = `${name}${ACTIVITY_SUFFIX}`
    return LOCALES.every((l) => typeof perLocale[l]?.[key] === 'string')
  })
}

export function runChecks() {
  const displayNames = extractDisplayKeys(readFileSync(TOOL_DISPLAY_FILE, 'utf8'))
  const perLocale = Object.fromEntries(LOCALES.map((l) => [l, readTaskStatus(l)]))
  const covered = countCovered(displayNames, perLocale)
  const shapeViolations = validateActivityValues(displayNames, perLocale)
  const floor = JSON.parse(readFileSync(FLOOR_FILE, 'utf8')).floor
  const regressions =
    covered.length < floor
      ? [
          {
            key: '(coverage)',
            locale: '*',
            reason: `双时态已覆盖 ${covered.length} < 基线 ${floor},有措辞键被删或改名(补回或说明理由后调基线)`,
          },
        ]
      : []
  const uncovered = displayNames.filter((n) => !covered.includes(n))
  return {
    total: displayNames.length,
    covered: covered.length,
    coveredNames: covered,
    floor,
    uncovered,
    violations: [...shapeViolations, ...regressions],
  }
}

function selfTest() {
  const mk = (over = {}) => {
    const base = {}
    for (const l of LOCALES) base[l] = {}
    for (const [l, v] of Object.entries(over)) base[l] = v
    return base
  }
  const okValue = '{state, select, running {正在做} completed {已做} other {做}}'
  const cases = [
    ['正例:五语言齐 + 三分支全', ['toolA'], { ...mk(), ...Object.fromEntries(LOCALES.map((l) => [l, { toolAActivity: okValue }])) }, 0],
    ['某语言缺 completed 分支', ['toolA'], Object.fromEntries(LOCALES.map((l) => [l, { toolAActivity: l === 'en' ? '{state, select, running {R} other {O}}' : okValue }])), 1],
    ['五语言不齐', ['toolA'], { ...Object.fromEntries(LOCALES.map((l) => [l, {}])), 'ko': { toolAActivity: okValue } }, 1],
    ['非 select 值', ['toolA'], Object.fromEntries(LOCALES.map((l) => [l, { toolAActivity: '正在做' }])), 5],
    ['缺 other 兜底', ['toolA'], Object.fromEntries(LOCALES.map((l) => [l, { toolAActivity: '{state, select, running {R} completed {C}' }])), 5],
    ['未配置(不算形错)', ['toolA'], mk(), 0],
  ]
  let bad = 0
  for (const [label, names, perLocale, expected] of cases) {
    const got = validateActivityValues(names, perLocale).length
    const ok = got === expected
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} ${label} → ${got}(期望 ${expected})`)
  }
  const names = extractDisplayKeys(readFileSync(TOOL_DISPLAY_FILE, 'utf8'))
  const extractOk = names.length > 50 && names.every((n) => /^[a-z]/.test(n))
  if (!extractOk) bad++
  console.log(`${extractOk ? '✓' : '✗'} 功能名抽取 → ${names.length} 个(期望 >50)`)
  console.log(bad === 0 ? '✅ self-test 全过' : `❌ self-test 失败 ${bad} 例`)
  return bad === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  if (process.env[SKIP_ENV] === '1') {
    console.warn(`⚠️  [tool-activity-coverage] 已用 ${SKIP_ENV}=1 跳过(紧急通道,须在 PROJECT_PLAN.md 说明)`)
    return 0
  }
  const res = runChecks()
  if (argv.includes('--scaffold')) {
    console.log(`未配置双时态的功能名 ${res.uncovered.length}/${res.total}:`)
    console.log(res.uncovered.join('\n'))
    return 0
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...res, coveredNames: res.coveredNames, violations: res.violations }, null, 2))
  }
  if (res.violations.length > 0) {
    console.error(`❌ [tool-activity-coverage] ${res.violations.length} 处问题(已覆盖 ${res.covered}/${res.total},基线 ${res.floor}):`)
    for (const v of res.violations.slice(0, 30)) {
      console.error(`  ${v.key} [${v.locale}] ${v.reason}`)
    }
    console.error(
      `\n  💡 半套措辞比不补更糟:界面会某语言恒显示"正在"或整条空白。\n     逐批补齐清单:node scripts/check-tool-activity-coverage.mjs --scaffold\n     自检:node scripts/check-tool-activity-coverage.mjs --self-test\n     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
    )
    return 1
  }
  console.log(
    `✅ [tool-activity-coverage] 键形全合规;双时态已覆盖 ${res.covered}/${res.total}(基线 ${res.floor},待补 ${res.uncovered.length})`,
  )
  return 0
}

export const __test__ = { extractDisplayKeys, validateActivityValues, countCovered, runChecks }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
