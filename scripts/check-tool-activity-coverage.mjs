#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
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
//   node scripts/check-tool-activity-coverage.mjs                    全量(HEAD blob)
//   node scripts/check-tool-activity-coverage.mjs --staged           索引面(提交链)
//   node scripts/check-tool-activity-coverage.mjs --worktree         人工排查(盘上内容,不作结论)
//   node scripts/check-tool-activity-coverage.mjs [--json] [--self-test] [--scaffold]
//     --scaffold 打印尚未配置**惯用档**的功能名清单,供逐批补齐
//
// 取材面(2026-09-26 收口,与守门 36/124/93/56/rn-global-css-sync 同口径):默认判 **HEAD blob**,
// `--staged` 判**索引 blob**(这次提交会带走的那一份 —— 盘上随后改对不算修好),`--worktree` 只作
// 人工逃生舱,两个面旗同给 = 自相矛盾 ⇒ 判死;判定的那一面取不到 ⇒ **exit 2「无法判定」**,既不冒红
// 也不记绿,且**不回落**到另一个面(回落就是把"没判"写成"判过了")。
// 输入共 7 个,全部是仓库内容:词表 tool-display.ts、5 个 shared 语言包、以及 floor 基线
// `scripts/data/tool-activity-coverage.json`。基线必须与语料**同面同轮**取 —— 表读磁盘 + 语料读 HEAD
// 会在并行会话刚改过表的那一瞬间产出假红/假绿(守门 93 R6 的同一条教训)。
// 无机器态输入:本门不读仓库外的任何文件(也没有 .workbuddy/ 台账),因此不存在第二把判定尺。
// 实测(2026-09-26,同一份判据):按磁盘判 exit 1(`ja` 一组「中性功能名缺失」),而 `git archive HEAD`
// 干净检出判 exit 0 —— 那批红来自并行会话的半编辑语料,与任何一次提交都无关;恒红门的唯一结局是逼人
// `--no-verify`,连带废掉全部守门(§12e 同型)。
// 与旧磁盘版的唯一语义差:旧版 `readTaskStatus` 对**不存在的语言包**返回 `{}`(照常参与判定,报出
// 缺值),新版同形(该面上没有 ⇒ `{}`),但把这类路径**计数并写进结论行**(`缺语言包 N 个`),
// 不再让"少扫一整批语言包"表现成安静。词表与 floor 取不到 ⇒ 无法判定(旧版是 ENOENT 崩在顶层,
// 退出码非 0 但无诊断;现在是 exit 2 + 点名)。

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 取材只走这一层:绝对路径 git、safe.directory、quotepath、windowsHide、maxBuffer、
// "输出被截断 ⇒ 无法判定" —— 这五处易错点各门自己写一遍就会各漏一遍(AGENTS §4/守门 118)。
import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOOL_DISPLAY_REL = 'packages/shared/src/chat/tool-display.ts'
const SHARED_DIR_REL = 'packages/i18n/messages/shared'
const FLOOR_REL = 'scripts/data/tool-activity-coverage.json'
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']
/** 词表与 floor 是"没有它就无从判定";语言包缺失是语料事实,按旧版语义参与判定并计数。 */
const REQUIRED_RELS = [TOOL_DISPLAY_REL, FLOOR_REL]
const LOCALE_RELS = LOCALES.map((l) => `${SHARED_DIR_REL}/${l}.json`)
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
  const block = source.slice(
    start,
    source.indexOf('\n}', start) === -1 ? undefined : source.indexOf('\n}', start) + 2,
  )
  const re = /:\s*(["'])((?:tool|action)[A-Za-z0-9_]*)\1/gu
  const names = new Set()
  let m
  while ((m = re.exec(block)) !== null) names.add(m[2])
  return [...names].sort()
}

/** 纯函数:argv → 判定面(默认 **head**)。导出是为了"默认不再是磁盘"这一格能被构造面证明。 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

/** 本门全部判定输入(7 个仓库路径,清单与内容同面同轮一次读完) */
export function inputRels() {
  return [...REQUIRED_RELS, ...LOCALE_RELS]
}

/**
 * 按判定面读输入,一次 `cat-file --batch` 同面同轮读完。
 * 必需项(词表 / floor)取不到 ⇒ 抛 `Undetermined`(调用方折成 exit 2),**不回落**另一个面;
 * 语言包在该面上不存在 ⇒ 返回 null,由 `runChecks` 按旧版语义折成 `{}` 并计入 `missingLocales`。
 * root/face 都是入参:镜像测试因此能在临时 git 仓里造"索引≠磁盘"的现场,不依赖真仓瞬时状态。
 */
export function readFaceInputs(repoRoot, face) {
  const rels = inputRels()
  const map = new Map()
  if (face === 'worktree') {
    for (const rel of rels) map.set(rel, readWorktreeFile(repoRoot, rel))
  } else {
    const prefix = face === 'staged' ? ':' : 'HEAD:'
    const specs = rels.map((rel) => prefix + rel)
    const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
    for (let i = 0; i < rels.length; i++) map.set(rels[i], got.get(specs[i]) ?? null)
  }
  const lack = REQUIRED_RELS.filter((r) => map.get(r) === null || map.get(r) === undefined)
  if (lack.length)
    throw new Undetermined(
      `${FACE_TXT[face] ?? face} 取不到必需输入 ${lack.join(' , ')} ⇒ 无法判定(不记为通过)`,
    )
  return map
}

/** 从语言包 JSON 文本取 taskStatus;null(该面上没有此包)与旧版 existsSync=false 同形返回 {} */
export function parseTaskStatus(text) {
  if (text === null || text === undefined) return {}
  return JSON.parse(text).taskStatus ?? {}
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
        bad.push({
          key: GENERIC_KEY,
          locale,
          reason: `${branch}{} 分支未嵌 ${NAME_ARG}(工具身份会丢)`,
        })
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

/**
 * 纯判据:输入 = 一次同面取材得到的 `Map<rel, text|null>`。
 * 默认参数 `readFaceInputs(ROOT,'head')` 只为自检/被 import 的场景保留 —— CLI 一定显式喂当次的面,
 * 因为"面"必须由那一次调用决定,不能让函数自己偷偷再去读一次(读两次就可能读到不同的面)。
 */
export function runChecks(inputs = readFaceInputs(ROOT, 'head')) {
  const displayNames = extractDisplayKeys(inputs.get(TOOL_DISPLAY_REL))
  const perLocale = Object.fromEntries(
    LOCALES.map((l) => [l, parseTaskStatus(inputs.get(`${SHARED_DIR_REL}/${l}.json`))]),
  )
  // 该面上没有这个语言包 ⇒ 与旧版 existsSync=false 同形折成 {},但必须点名(见头注)。
  const missingLocales = LOCALES.filter((l) => {
    const t = inputs.get(`${SHARED_DIR_REL}/${l}.json`)
    return t === null || t === undefined
  })
  const covered = countCovered(displayNames, perLocale)
  const shapeViolations = [
    ...validateActivityValues(displayNames, perLocale),
    ...validateGenericValue(perLocale),
    ...validateTwoState(displayNames, perLocale),
  ]
  const floor = JSON.parse(inputs.get(FLOOR_REL)).floor
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
    missingLocales,
    violations: [...shapeViolations, ...regressions],
  }
}

function selfTest(faceInputs, argsFace) {
  const mk = (over = {}) => {
    const base = {}
    for (const l of LOCALES) base[l] = {}
    for (const [l, v] of Object.entries(over)) base[l] = v
    return base
  }
  const okValue = '{state, select, running {正在做} completed {已做} other {做}}'
  const okGeneric =
    '{state, select, running {正在执行：{name}} completed {已完成：{name}} other {执行：{name}}}'
  const cases = [
    [
      '正例:五语言齐 + 三分支全',
      ['toolA'],
      { ...mk(), ...Object.fromEntries(LOCALES.map((l) => [l, { toolAActivity: okValue }])) },
      0,
    ],
    [
      '某语言缺 completed 分支',
      ['toolA'],
      Object.fromEntries(
        LOCALES.map((l) => [
          l,
          { toolAActivity: l === 'en' ? '{state, select, running {R} other {O}}' : okValue },
        ]),
      ),
      1,
    ],
    [
      '五语言不齐',
      ['toolA'],
      { ...Object.fromEntries(LOCALES.map((l) => [l, {}])), ko: { toolAActivity: okValue } },
      1,
    ],
    [
      '非 select 值',
      ['toolA'],
      Object.fromEntries(LOCALES.map((l) => [l, { toolAActivity: '正在做' }])),
      5,
    ],
    [
      '缺 other 兜底',
      ['toolA'],
      Object.fromEntries(
        LOCALES.map((l) => [l, { toolAActivity: '{state, select, running {R} completed {C}' }]),
      ),
      5,
    ],
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
    Object.fromEntries(
      LOCALES.map((l) => [
        l,
        { toolApiCall: 'API 调用', toolGenericActivity: okGeneric, ...extra },
      ]),
    )
  const shapeCases = [
    ['通用档正例(含 {name} 双态)', { ...withGeneric() }, 0],
    ['通用档某语言整体缺失', { ...withGeneric(), ko: { toolApiCall: 'API 调用' } }, 1],
    [
      '通用档 running 漏 {name}',
      {
        ...withGeneric(),
        en: {
          toolApiCall: 'API call',
          toolGenericActivity:
            '{state, select, running {Running} completed {Completed: {name}} other {Run: {name}}}',
        },
      },
      1,
    ],
    [
      '通用档两态文本相同',
      {
        ...withGeneric(),
        ja: {
          toolApiCall: 'API 呼び出し',
          toolGenericActivity:
            '{state, select, running {実行：{name}} completed {実行：{name}} other {実行：{name}}}',
        },
      },
      1,
    ],
    [
      '通用档不是 select 值',
      {
        ...withGeneric(),
        ko: { toolApiCall: 'API 호출', toolGenericActivity: '正在执行：{name}' },
      },
      1,
    ],
  ]
  for (const [label, perLocale, expectedGeneric] of shapeCases) {
    const got = validateGenericValue(perLocale).length
    const ok = got === expectedGeneric
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} ${label} → 通用档 ${got}(期望 ${expectedGeneric})`)
  }
  const twoCases = [
    ['长尾工具由通用档兜住 → 放过', ['toolApiCall'], withGeneric(), 0],
    [
      '惯用档两态相同 → 拦',
      ['toolApiCall'],
      withGeneric({
        toolApiCallActivity:
          '{state, select, running {调用接口} completed {调用接口} other {调用接口}}',
      }),
      5,
    ],
    [
      '惯用档残留未消化占位 → 拦',
      ['toolApiCall'],
      withGeneric({
        toolApiCallActivity:
          '{state, select, running {正在 {count} 次} completed {已 {count} 次} other {做}}',
      }),
      5,
    ],
    [
      '中性功能名缺失 → 拦(两态无处可退)',
      ['toolApiCall'],
      Object.fromEntries(LOCALES.map((l) => [l, { toolGenericActivity: okGeneric }])),
      5,
    ],
    [
      '未登记措辞但有通用档 → 只算 toolApiCall 一名,不炸',
      ['toolApiCall', 'toolUnknown'],
      withGeneric({ toolUnknown: '未知工具' }),
      0,
    ],
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
  console.log(
    `${parseOk ? '✓' : '✗'} 分支抽取支持体内嵌套 {name} → ${JSON.stringify(nested?.running)}`,
  )

  // 现存语料 + 真实抽取一律按**当次判定面**读(main 已把面传进来);自检因此与 CLI 同口径,
  // 不会"判据按 HEAD 而自检按磁盘"—— 那会把并行会话的半编辑态当成"本门自己坏了"。
  const inputs = faceInputs
  const names = extractDisplayKeys(inputs.get(TOOL_DISPLAY_REL))
  const extractOk = names.length > 50 && names.every((n) => /^[a-z]/.test(n))
  if (!extractOk) bad++
  console.log(`${extractOk ? '✓' : '✗'} 功能名抽取 → ${names.length} 个(期望 >50)`)
  const real = runChecks(inputs)
  const realOk = real.violations.length === 0
  if (!realOk) bad++
  if (!realOk)
    for (const v of real.violations.slice(0, 10))
      console.log(`    · ${v.key} [${v.locale}] ${v.reason}`)
  console.log(
    `${realOk ? '✓' : '✗'} 现存语料 0 命中(有命中说明判据误伤或语料真缺,须先修再入库;取材面:${FACE_TXT[argsFace] ?? argsFace})`,
  )
  console.log(bad === 0 ? '✅ self-test 全过' : `❌ self-test 失败 ${bad} 例`)
  return bad === 0 ? 0 : 1
}

function main(argv) {
  const sel = faceFromArgv(argv)
  if (argv.includes('--self-test')) {
    if (sel.error) {
      console.error(`❌ [tool-activity-coverage] 无法判定:${sel.error}`)
      return 2
    }
    let selfInputs
    try {
      selfInputs = readFaceInputs(ROOT, sel.face)
    } catch (e) {
      const known = e instanceof Undetermined
      console.error(
        `[tool-activity-coverage] 取不到输入(${FACE_TXT[sel.face]})⇒ 无法判定(不记为通过):${
          known ? e.message : (e?.stack ?? e)
        }`,
      )
      return 2
    }
    return selfTest(selfInputs, sel.face)
  }
  if (process.env[SKIP_ENV] === '1') {
    console.warn(
      `⚠️  [tool-activity-coverage] 已用 ${SKIP_ENV}=1 跳过(紧急通道,须在 PROJECT_PLAN.md 说明)`,
    )
    return 0
  }
  if (sel.error) {
    console.error(`❌ [tool-activity-coverage] 无法判定:${sel.error}`)
    return 2
  }
  const face = sel.face
  let res
  try {
    res = runChecks(readFaceInputs(ROOT, face))
  } catch (e) {
    // 「无法判定」是预期结论,一句话足够;**其他异常**必须带栈落地 —— 匿名 exit 2 = 不可诊断
    // (守门 36/93 同型教训:一个编码/权限错误不得伪装成"该文件不存在"的业务结论)。
    const known = e instanceof Undetermined
    console.error(
      `[tool-activity-coverage] 取不到输入(${FACE_TXT[face]})⇒ 无法判定(不记为通过):${
        known ? e.message : (e?.stack ?? e)
      }`,
    )
    return 2
  }
  const faceTag = `取材面:${FACE_TXT[face]}`
  const gapTag = res.missingLocales.length ? ` · 缺语言包 ${res.missingLocales.length} 个` : ''
  if (argv.includes('--scaffold')) {
    console.log(
      `未配惯用档的功能名 ${res.uncovered.length}/${res.total}(这些已由通用档 toolGenericActivity 兜住两态;${faceTag}${gapTag}):`,
    )
    console.log(res.uncovered.join('\n'))
    return 0
  }
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          face,
          faceLabel: FACE_TXT[face],
          ...res,
          coveredNames: res.coveredNames,
          violations: res.violations,
        },
        null,
        2,
      ),
    )
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
    // 结论行必须落在**末行**:报告里要能读出这句话是关于哪个取材面的(守门 36 同型)。
    console.error(`[tool-activity-coverage] Found ${res.violations.length} 处(${faceTag}${gapTag})`)
    return 1
  }
  console.log(
    `✅ [tool-activity-coverage] 惯用档 ${res.covered}/${res.total}(基线 ${res.floor},待补 ${res.uncovered.length})·通用档在位·全 ${res.total} 功能名 × 5 语言两态可区分(${faceTag}${gapTag})`,
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
  // 判定面(2026-09-26 收口):测试按构造面证明"默认判 HEAD / --staged 判索引 / 取不到不回落",
  // 不得在测试里再抄一份面选择逻辑(§22c)。
  faceFromArgv,
  readFaceInputs,
  parseTaskStatus,
  inputRels,
  FACE_TXT,
  TOOL_DISPLAY_REL,
  FLOOR_REL,
  SHARED_DIR_REL,
  REQUIRED_RELS,
  LOCALE_RELS,
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
