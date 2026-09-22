#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 工具活动行双时态措辞覆盖守门(PROJECT_PLAN.md D81①/D83/H28)
//
// 措辞两档,判据三类等取向不同:
//  ① 键形(machine-checkable,一律 blocking):凡是 `*Activity` 键,五语言必须都在,且值是
//     ICU select 且含 running + completed 分支。半套措辞(只补了 zh 或漏了 completed)比不补更糟,
//     界面会出现某语言永远显示"正在"或退回中性名。
//  ② 惯用档覆盖率(ratchet):逐工具手写惯用措辞的数量 **不得低于 floor**。当前 24 个高频工具,
//     逐批补时把 floor 上调即可;这样既不"入库即恒红",又锁死"补了又掉"。
//  ③ 两态可判定(machine-checkable,一律 blocking,覆盖 **全部** 功能名):对每个功能名 × 每语言,
//     按 describeToolActivity 的真实解析顺序(惯用档 → 通用档 toolGenericActivity → 中性名)算出
//     running / completed 两串,要求 ⑴ 都非空 ⑵ **互不相同** ⑶ 通用档必须把本地化功能名嵌进去
//     ⑷ 不残留未渲染的 ICU 语法。这一条才是用户真正看得见的东西:"在做"和"做完"分不出来就是缺陷,
//     至于措辞是手写的还是套框架的不重要 —— 所以它比②覆盖面大,且不会因②增长而放松。
//
// 用法:
//   node scripts/check-tool-activity-coverage.mjs [--json] [--self-test] [--scaffold]
//     --scaffold 打印尚未配置**惯用档**的功能名清单,供逐批补齐

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
const GENERIC_KEY = 'toolGenericActivity'
const NAME_ARG = '{name}'
const SKIP_ENV = 'HUSKY_SKIP_TOOL_ACTIVITY_COVERAGE'

/** 取 ICU select 的分支表:花括号配平切分,支持分支体内嵌套 `{name}` */
export function parseSelectBranches(value) {
  const head = /^\{\s*\w+\s*,\s*select\s*,/u.exec(value)
  if (!head) return null
  const cases = {}
  let i = head[0].length
  while (i < value.length) {
    while (i < value.length && /[\s,]/u.test(value[i])) i++
    const nameMatch = /^(\w+)\s*\{/u.exec(value.slice(i))
    if (!nameMatch) break
    let j = i + nameMatch[0].length
    let depth = 1
    const start = j
    while (j < value.length && depth > 0) {
      if (value[j] === '{') depth++
      else if (value[j] === '}') depth--
      if (depth === 0) break
      j++
    }
    if (depth !== 0) return null // 花括号不配平:整串判为不可解析
    cases[nameMatch[1]] = value.slice(start, j)
    i = j + 1
  }
  return Object.keys(cases).length > 0 ? cases : null
}

/** 分支体内插值:只喂 name,其余占位符原样留着(留着才能被"残留语法"判据抓到) */
export function fillBranch(text, args) {
  return text.replace(/\{(\w+)\}/gu, (_, k) => (k in args ? String(args[k]) : `{${k}}`))
}

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

/** 通用档自身:五语言齐、running/completed 两支都必须带 {name}(漏了就等于界面显示"正在执行:"空框) */
export function validateGenericValue(perLocale) {
  const bad = []
  for (const locale of LOCALES) {
    const value = perLocale[locale]?.[GENERIC_KEY]
    if (typeof value !== 'string' || value.trim() === '') {
      bad.push({ key: GENERIC_KEY, locale, reason: '通用档缺失(长尾工具将退回无时态的裸功能名)' })
      continue
    }
    const cases = parseSelectBranches(value)
    if (!cases) {
      bad.push({ key: GENERIC_KEY, locale, reason: '不是可解析的 ICU select 值' })
      continue
    }
    for (const branch of [...REQUIRED_BRANCHES, 'other']) {
      const body = cases[branch]
      if (typeof body !== 'string' || body.trim() === '') {
        bad.push({ key: GENERIC_KEY, locale, reason: `缺 ${branch}{} 分支` })
        continue
      }
      if (!body.includes(NAME_ARG)) {
        bad.push({ key: GENERIC_KEY, locale, reason: `${branch}{} 分支未嵌 ${NAME_ARG}(工具身份会丢)` })
      }
    }
    if (cases.running === cases.completed) {
      bad.push({ key: GENERIC_KEY, locale, reason: 'running 与 completed 文本相同,两态分不出来' })
    }
  }
  return bad
}

/**
 * 两态可判定:按 describeToolActivity 的真实解析顺序模拟取词,对**每个功能名 × 每语言**
 * 断言"在做/做完"两串都取得到、互不相同、不含未渲染语法、且保住工具身份(含本地化功能名)。
 */
export function validateTwoState(displayNames, perLocale) {
  const bad = []
  const genericCases = Object.fromEntries(
    LOCALES.map((l) => [l, parseSelectBranches(perLocale[l]?.[GENERIC_KEY] ?? '')]),
  )
  for (const name of displayNames) {
    for (const locale of LOCALES) {
      const neutral = perLocale[locale]?.[name]
      if (typeof neutral !== 'string' || neutral.trim() === '') {
        bad.push({ key: name, locale, reason: '中性功能名缺失,两态措辞无处可退' })
        continue
      }
      const specific = perLocale[locale]?.[`${name}${ACTIVITY_SUFFIX}`]
      let cases
      if (typeof specific === 'string') {
        cases = parseSelectBranches(specific)
        if (!cases) {
          bad.push({ key: `${name}Activity`, locale, reason: '惯用档不是可解析的 ICU select 值' })
          continue
        }
      } else {
        cases = genericCases[locale]
        if (!cases) continue // 通用档自身的问题已由 validateGenericValue 报出,不重复计
      }
      const rendered = {}
      let leaked = false
      for (const branch of REQUIRED_BRANCHES) {
        const body = cases[branch] ?? cases.other ?? ''
        const text = fillBranch(body, { name: neutral })
        if (/\{\s*\w+\s*(?:,|\})/u.test(text)) leaked = true
        rendered[branch] = text
      }
      if (leaked) {
        bad.push({ key: name, locale, reason: '渲染后仍残留花括号占位(该端取词器不会消化它)' })
        continue
      }
      for (const branch of REQUIRED_BRANCHES) {
        if (rendered[branch].trim() === '') {
          bad.push({ key: name, locale, reason: `${branch} 态渲染为空串` })
        }
      }
      if (rendered.running === rendered.completed) {
        bad.push({ key: name, locale, reason: 'running 与 completed 两串相同,界面分不出在做/做完' })
      }
    }
  }
  return bad
}

export function runChecks() {
  const displayNames = extractDisplayKeys(readFileSync(TOOL_DISPLAY_FILE, 'utf8'))
  const perLocale = Object.fromEntries(LOCALES.map((l) => [l, readTaskStatus(l)]))
  const covered = countCovered(displayNames, perLocale)
  const shapeViolations = [
    ...validateActivityValues(displayNames, perLocale),
    ...validateGenericValue(perLocale),
    ...validateTwoState(displayNames, perLocale),
  ]
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
  const okGeneric = '{state, select, running {正在执行：{name}} completed {已完成：{name}} other {执行：{name}}}'
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

  // —— 通用档自身 + 两态可判定:正反成对,只测"该拦"会让判据过宽也一直全绿 ——
  const withGeneric = (extra = {}) =>
    Object.fromEntries(LOCALES.map((l) => [l, { toolApiCall: 'API 调用', toolGenericActivity: okGeneric, ...extra }]))
  const shapeCases = [
    ['通用档正例(含 {name} 双态)', { ...withGeneric() }, 0],
    ['通用档某语言整体缺失', { ...withGeneric(), ko: { toolApiCall: 'API 调用' } }, 1],
    ['通用档 running 漏 {name}', { ...withGeneric(), en: { toolApiCall: 'API call', toolGenericActivity: '{state, select, running {Running} completed {Completed: {name}} other {Run: {name}}}' } }, 1],
    ['通用档两态文本相同', { ...withGeneric(), ja: { toolApiCall: 'API 呼び出し', toolGenericActivity: '{state, select, running {実行：{name}} completed {実行：{name}} other {実行：{name}}}' } }, 1],
    ['通用档不是 select 值', { ...withGeneric(), ko: { toolApiCall: 'API 호출', toolGenericActivity: '正在执行：{name}' } }, 1],
  ]
  for (const [label, perLocale, expectedGeneric] of shapeCases) {
    const got = validateGenericValue(perLocale).length
    const ok = got === expectedGeneric
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} ${label} → 通用档 ${got}(期望 ${expectedGeneric})`)
  }
  const twoCases = [
    ['长尾工具由通用档兜住 → 放过', ['toolApiCall'], withGeneric(), 0],
    ['惯用档两态相同 → 拦', ['toolApiCall'], withGeneric({ toolApiCallActivity: '{state, select, running {调用接口} completed {调用接口} other {调用接口}}' }), 5],
    ['惯用档残留未消化占位 → 拦', ['toolApiCall'], withGeneric({ toolApiCallActivity: '{state, select, running {正在 {count} 次} completed {已 {count} 次} other {做}}' }), 5],
    ['中性功能名缺失 → 拦(两态无处可退)', ['toolApiCall'], Object.fromEntries(LOCALES.map((l) => [l, { toolGenericActivity: okGeneric }])), 5],
    ['未登记措辞但有通用档 → 只算 toolApiCall 一名,不炸', ['toolApiCall', 'toolUnknown'], withGeneric({ toolUnknown: '未知工具' }), 0],
  ]
  for (const [label, names, perLocale, expected] of twoCases) {
    const got = validateTwoState(names, perLocale).length
    const ok = got === expected
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} ${label} → 两态 ${got}(期望 ${expected})`)
  }
  const nested = parseSelectBranches(okGeneric)
  const parseOk = nested?.running === '正在执行：{name}' && nested?.other === '执行：{name}'
  if (!parseOk) bad++
  console.log(`${parseOk ? '✓' : '✗'} 分支抽取支持体内嵌套 {name} → ${JSON.stringify(nested?.running)}`)

  const names = extractDisplayKeys(readFileSync(TOOL_DISPLAY_FILE, 'utf8'))
  const extractOk = names.length > 50 && names.every((n) => /^[a-z]/.test(n))
  if (!extractOk) bad++
  console.log(`${extractOk ? '✓' : '✗'} 功能名抽取 → ${names.length} 个(期望 >50)`)
  const realOk = runChecks().violations.length === 0
  if (!realOk) bad++
  console.log(`${realOk ? '✓' : '✗'} 现存语料 0 命中(有命中说明判据误伤或语料真缺,须先修再入库)`)
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
    console.log(`未配惯用档的功能名 ${res.uncovered.length}/${res.total}(这些已由通用档 toolGenericActivity 兜住两态):`)
    console.log(res.uncovered.join('\n'))
    return 0
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...res, coveredNames: res.coveredNames, violations: res.violations }, null, 2))
  }
  if (res.violations.length > 0) {
    console.error(
      `❌ [tool-activity-coverage] ${res.violations.length} 处问题(惯用档 ${res.covered}/${res.total},基线 ${res.floor})`,
    )
    for (const v of res.violations.slice(0, 30)) {
      console.error(`  ${v.key} [${v.locale}] ${v.reason}`)
    }
    console.error(
      `\n  💡 三类判据:①惯用档键形五语言齐 ②惯用档数量不倒退 ③**全部**功能名两态可区分(通用档兜底)。\n     逐批补惯用档清单:node scripts/check-tool-activity-coverage.mjs --scaffold\n     自检:node scripts/check-tool-activity-coverage.mjs --self-test\n     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
    )
    return 1
  }
  console.log(
    `✅ [tool-activity-coverage] 惯用档 ${res.covered}/${res.total}(基线 ${res.floor},待补 ${res.uncovered.length})·通用档在位·全 ${res.total} 功能名 × 5 语言两态可区分`,
  )
  return 0
}

export const __test__ = {
  extractDisplayKeys,
  validateActivityValues,
  validateGenericValue,
  validateTwoState,
  parseSelectBranches,
  fillBranch,
  countCovered,
  runChecks,
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
