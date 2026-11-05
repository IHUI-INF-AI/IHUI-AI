#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回跳落点必须钉 origin —— 调用点对账守门(blocking,新增 id '278')
 *
 * 判的是什么:`apps/web` 里每一枚 `resolveSafeRedirectTarget(...)` / `isSafeNavigationTarget(...)`
 * 调用,其 options 实参必须是**字面量对象**且含 `allowedOrigins` 键。缺键 = 违规;
 * options 是变量/展开 ⇒ 「判不出已钉 origin」,单独计未判定并按 §0.3 exit 2。
 *
 * 为什么这一格必须是机器闸(2026-11-01 安全强化实测立):`isSafeNavigationTarget` 的
 * `allowedOrigins` 缺席时,走的正是"只判协议"那支 —— 任意绝对 http(s) 外站一律通过。
 * 判据本身没错(它是 `/sso/mobile-auth` 的设计意图),错在**调用点可以什么都不传而页面
 * 照样全绿**。同日实测到四处真命中,其中两枚是授权码签发路径:
 *   · `apps/web/app/sso/login/PageClient.tsx:171` 的 target 既被 POST 给
 *     `/api/auth/sso/code` 当 `redirectUri`,又被拼上 `sso_code` 后导航 ⇒ 一枚刚签发的
 *     授权码可以送到攻击者域;
 *   · `apps/web/app/sso/register/PageClient.tsx:164` 同形;
 *   · `apps/web/app/sso/login/PageClient.tsx:249`(OIDC 回跳自动 push)、`:268`(守卫打回
 *     自动返回)同族。
 * 同页另一处(`login/PageClient.tsx:133`)与 `/sso/redirect`、`LoginDialog` 早就显式传了
 * 白名单 —— 这恰好证明"同一把尺子在四个落点各写一遍"必然漏,而漏的那一侧的表现形式是安静。
 * 只靠人审或注释拦不住下一次新增调用点,所以把"调用点有没有交出一份第一方落点集"收成一门。
 *
 * 与"行内豁免"的取舍:本门用**具名台账**(`scripts/data/redirect-origin-pinned-exemptions.json`)
 * 而不是行内标记 —— 因为豁免要回答的是"这一页的外站回跳是不是产品契约",那是文件级事实,
 * 逐行标记会让同一页出现两种口径。台账三条硬规矩照 §0.7:必须带 reason、必须带到期(`until`),
 * 且**被审面不再命中 ⇒ 清单腐烂判红**(救不了"豁免比判据活得久")。
 *
 * 存量(立门当次 HEAD 现读):除台账里那 1 枚(mobile-auth)外为 0 ⇒ 按 §12e 可直接上 blocking,
 * 不是恒红门。
 *
 * 取材面纪律照 §0.4:默认判 HEAD blob,`--staged` 判索引 blob,`--worktree` 仅人工逃生舱,
 * 取不到不回落另一个面(共用层 ./lib/face-scan.mjs)。
 *
 * 用法:
 *   node scripts/check-redirect-target-origin-pinned.mjs            # 全量(HEAD)
 *   node scripts/check-redirect-target-origin-pinned.mjs --staged    # pre-commit 档
 *   node scripts/check-redirect-target-origin-pinned.mjs --self-test  # 判据夹具(含变异自证)
 * 跳过(紧急):HUSKY_SKIP_REDIRECT_ORIGIN_PIN=1 git commit ...
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { COLORS as C } from './lib/logger.mjs'
import { isExcludedDirName, withExcludes } from './lib/exclude-dirs.mjs'
import { Undetermined, assertRepoRoot, selectFace } from './lib/face-reader.mjs'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'
import { readSources, sourceCandidates } from './lib/face-scan.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SCAN_GLOBS = ['apps/web/**/*.ts', 'apps/web/**/*.tsx']
// 预筛只用于 git grep 缩小候选集;真正的调用点定位在判据里做(遮注释与字符串之后)。
const PREFILTER_RE = 'Safe(NavigationTarget|RedirectTarget)'

const SKIP_DIRS = withExcludes(['tests', '__tests__', 'e2e'])
const skipSegmentTest = (seg) => SKIP_DIRS.has(seg) || isExcludedDirName(seg)

/** 被判的两个出口。第三枚 `resolveSafeRedirectTarget` 内部就调它,不重复计。 */
const CALL_RE = /\b(resolveSafeRedirectTarget|isSafeNavigationTarget)\s*\(/g

const LEDGER_REL = 'scripts/data/redirect-origin-pinned-exemptions.json'

/**
 * 取一整套调用的实参区间:从 `(` 起按括号配平走到闭合。字符串/模板/注释已被遮成空格,
 * 所以括号里不会再混进字面量里的不平衡括号。返回 null = 配平失败(语法坏),交调用方计未判定。
 */
export function callArgSpan(masked, openIdx) {
  let depth = 0
  for (let i = openIdx; i < masked.length; i++) {
    const ch = masked[i]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return { start: openIdx + 1, end: i }
    }
  }
  return null
}

/** 按**顶层逗号**切实参(深度 0 才切;`[]{}` 同样计入深度,免把对象里的逗号当分隔)。 */
export function splitTopLevelArgs(masked, span) {
  const args = []
  let depth = 0
  let cur = span.start
  for (let i = span.start; i < span.end; i++) {
    const ch = masked[i]
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ',' && depth === 0) {
      args.push(masked.slice(cur, i))
      cur = i + 1
    }
  }
  args.push(masked.slice(cur, span.end))
  // 丢掉空段:prettier 的多行调用一律带尾逗号,那个尾逗号后面就是空串。把它当"最后一个实参"
  // 会把 `f(a, { allowedOrigins })` 读成"无 options"—— 实测 register/PageClient 正是这一形,
  // 而"把已钉 origin 的调用点报成违规"的门,下一次就没人信它的红了。
  return args.map((a) => a.trim()).filter((a) => a.length > 0)
}

/**
 * 取"被定义体"的区间:`function resolveSafeRedirectTarget(...) { ... }` 的花括号配平段。
 * 定义体内部对兄弟判据的自调用**不是调用点** —— `resolveSafeRedirectTarget` 把自己的
 * options 原样转给 `isSafeNavigationTarget`,那正是"单源"的实现方式;把它算成"未判定"
 * 会让本门在自己的源头文件上永久报哑,而"永久未判定"与"永久红"一样是没人再读报告的开始。
 */
export function declarationSpans(masked) {
  const spans = []
  const declRe = /\bfunction\s+(?:resolveSafeRedirectTarget|isSafeNavigationTarget)\s*\(/g
  for (const m of masked.matchAll(declRe)) {
    const openParen = m.index + m[0].length - 1
    const argSpan = callArgSpan(masked, openParen)
    if (argSpan === null) continue
    const braceIdx = masked.indexOf('{', argSpan.end)
    if (braceIdx === -1) continue
    let depth = 0
    for (let i = braceIdx; i < masked.length; i++) {
      if (masked[i] === '{') depth++
      else if (masked[i] === '}') {
        depth--
        if (depth === 0) {
          spans.push({ start: braceIdx, end: i })
          break
        }
      }
    }
  }
  return spans
}

/**
 * 单文件判据(纯函数:进源码文本,出三桶)。
 *
 * @returns {{violations:{line:number,snippet:string}[], undetermined:{line:number,why:string}[], bareTotal:number}}
 */
export function judgeOriginPinning(text) {
  const masked = maskCommentsAndStrings(text)
  const inside = declarationSpans(masked)
  const violations = []
  const undetermined = []
  for (const m of masked.matchAll(CALL_RE)) {
    // 声明本身(`export function isSafeNavigationTarget(target, options)`)也被 CALL_RE 命中:
    // 它的实参是形参名,拿"调用点"的尺子量它会把它自己的形参表读成"未判定",本门就此永久哑。
    if (/\bfunction\s+$/.test(masked.slice(0, m.index))) continue
    if (inside.some((s) => m.index > s.start && m.index < s.end)) continue
    const line = text.slice(0, m.index).split('\n').length
    const openIdx = m.index + m[0].length - 1
    const span = callArgSpan(masked, openIdx)
    if (span === null) {
      undetermined.push({ line, why: '括号配平失败(语法坏,判不出实参边界)' })
      continue
    }
    const args = splitTopLevelArgs(masked, span)
    const optionsArg = args.length >= 2 ? args[args.length - 1] : ''
    if (optionsArg === '') {
      violations.push({ line, snippet: `${m[1]}(单实参 · 无 options)` })
      continue
    }
    // 只有**字面量对象**才可能被机器证明;变量/展开一律计未判定,不开"看不见就算通过"的口子。
    if (!optionsArg.startsWith('{')) {
      undetermined.push({ line, why: `options 不是对象字面量:${optionsArg.slice(0, 48)}` })
      continue
    }
    if (!/\ballowedOrigins\s*:/.test(optionsArg)) {
      violations.push({ line, snippet: `${m[1]}(options 里没有 allowedOrigins)` })
    }
  }
  return { violations, undetermined, bareTotal: violations.length }
}

/**
 * 台账判序(与豁免族同一条规矩):
 *   ① 台账取不到/形状坏 ⇒ 未判定(既不记绿也不冒红);
 *   ② 条目 `until` 已到期 ⇒ 腐烂红;
 *   ③ 某条目所在文件的实际裸调用数**少于**登记的豁免数 ⇒ 清单腐烂红(豁免不再命中);
 *   ④ 超出豁免数的每一枚裸调用 ⇒ 违规红。
 */
export function judgeAgainstLedger(perFile, entries, { today }) {
  const expired = []
  const stale = []
  const violations = []
  const exemptByFile = new Map()
  for (const e of entries) {
    if (typeof e.file !== 'string' || !Number.isInteger(e.bareCalls) || e.bareCalls < 1) {
      return { malformed: `条目形状坏:${JSON.stringify(e).slice(0, 120)}` }
    }
    if (typeof e.reason !== 'string' || e.reason.trim().length < 10) {
      return { malformed: `条目 ${e.file} 的 reason 缺失或短于 10 字` }
    }
    if (typeof e.until !== 'string') return { malformed: `条目 ${e.file} 缺 until(豁免必须会到期)` }
    if (e.until < today) expired.push(`${e.file} 于 ${e.until} 到期`)
    exemptByFile.set(e.file, (exemptByFile.get(e.file) ?? 0) + e.bareCalls)
  }
  for (const [rel, hits] of perFile) {
    const exempt = expired.some((x) => x.startsWith(`${rel} `)) ? 0 : (exemptByFile.get(rel) ?? 0)
    if (hits.length > exempt) {
      for (const h of hits.slice(exempt)) violations.push(`${rel}:${h.line} ${h.snippet}`)
    } else if (hits.length < exempt) {
      stale.push(`${rel} 登记豁免 ${exempt} 枚,被审面只命中 ${hits.length} 枚 ⇒ 清单腐烂`)
    }
  }
  for (const rel of exemptByFile.keys()) {
    if (!perFile.has(rel)) stale.push(`${rel} 登记了豁免,但被审面该文件一枚裸调用都没有 ⇒ 清单腐烂`)
  }
  return { expired, stale, violations, malformed: null }
}

function readLedger(top) {
  const abs = join(top, LEDGER_REL)
  if (!existsSync(abs)) throw new Undetermined(`豁免台账不存在:${LEDGER_REL}`)
  let parsed
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (e) {
    throw new Undetermined(`豁免台账不是合法 JSON:${e?.message ?? e}`)
  }
  if (!Array.isArray(parsed?.entries)) throw new Undetermined(`豁免台账缺 entries 数组`)
  return parsed
}

export async function run({ staged, worktree, selfTest = false } = {}) {
  if (selfTest) return selfTestRun()
  const top = assertRepoRoot(ROOT, '回跳落点 origin 钉扎守门')
  const picked = selectFace({ staged, worktree, def: 'head' })
  if (picked.error) {
    console.log(`${C.yellow}⚠️  未判定:${picked.error}${C.reset}`)
    return 2
  }
  const face = picked.face
  const faceLabel =
    face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(人工逃生舱)' : 'HEAD blob'

  let ledger
  try {
    ledger = readLedger(top)
  } catch (e) {
    console.log(`${C.yellow}⚠️  未判定:豁免台账取不到 ⇒ ${e?.message ?? e}${C.reset}`)
    return 2
  }
  const today = new Date().toISOString().slice(0, 10)

  const listed = sourceCandidates(top, face, {
    prefilterRe: PREFILTER_RE,
    pathspecs: SCAN_GLOBS,
    skipSegmentTest,
  })
  const { texts } = readSources(top, face, listed)
  const files = listed.filter((rel) => texts.has(rel))

  const perFile = new Map()
  let undeterminedCount = 0
  const undeterminedLines = []
  for (const rel of files) {
    const { violations, undetermined } = judgeOriginPinning(texts.get(rel))
    if (violations.length > 0) perFile.set(rel, violations)
    for (const u of undetermined) {
      undeterminedCount++
      undeterminedLines.push(`${C.yellow}   · 判不出:${rel}:${u.line} —— ${u.why}${C.reset}`)
    }
  }

  const verdict = judgeAgainstLedger(perFile, ledger.entries, { today })
  if (verdict.malformed) {
    console.log(`${C.yellow}⚠️  未判定:豁免台账 ${verdict.malformed}${C.reset}`)
    return 2
  }
  for (const line of undeterminedLines) console.log(line)

  const total = verdict.violations.length
  const rot = [...verdict.expired.map((x) => `到期:${x}`), ...verdict.stale]
  for (const v of verdict.violations) console.log(`${C.red}❌ 未钉 origin:${v}${C.reset}`)
  for (const r of rot) console.log(`${C.red}❌ 豁免台账腐烂/到期:${r}${C.reset}`)

  console.log(
    `回跳落点 origin 钉扎守门结论:面=${faceLabel} 扫描 ${files.length} 文件 | ` +
      `调用点未钉 origin ${total} 枚 | 台账豁免 ${ledger.entries.reduce((s, e) => s + e.bareCalls, 0)} 枚 | ` +
      `判不出 ${undeterminedCount} 枚 | 台账腐烂 ${rot.length} 枚` +
      (total === 0 && rot.length === 0 ? ' ⇒ 通过' : ' ⇒ 红'),
  )
  if (undeterminedCount > 0) return 2
  return total === 0 && rot.length === 0 ? 0 : 1
}

/**
 * 夹具自证。每一档都问两句:"这档摘掉新判据会不会还绿" —— 变异自证住在被判的那一枚上,
 * 而不是另造一份"看起来像"的文本。
 */
export function selfTestRun() {
  const cases = []
  const ok = (name, cond) => cases.push({ name, pass: !!cond })

  const pinned = `
import { resolveSafeRedirectTarget } from '@/lib/sso-redirect-guard'
const t = resolveSafeRedirectTarget(url, { allowDeepLink: true, allowedOrigins: firstPartyAllowedOrigins() })
`
  ok(
    '① 字面量 options 含 allowedOrigins ⇒ 0 违规',
    judgeOriginPinning(pinned).violations.length === 0,
  )

  const bare = `
const t = resolveSafeRedirectTarget(resolveLoginTarget(), { allowDeepLink: true })
`
  ok('② 有 options 但无 allowedOrigins ⇒ 1 违规', judgeOriginPinning(bare).violations.length === 1)

  const oneArg = `const t = isSafeNavigationTarget(redirectUrl)`
  ok('③ 单实参调用 ⇒ 1 违规', judgeOriginPinning(oneArg).violations.length === 1)

  const commented = `
// 刻意不套 isSafeNavigationTarget:合法第三方 client 的回调域不在本站白名单
const note = "调用 resolveSafeRedirectTarget(...) 的地方"
`
  const cRes = judgeOriginPinning(commented)
  ok(
    '④ 注释与字符串里的提及 ⇒ 不命中(遮罩生效)',
    cRes.violations.length === 0 && cRes.undetermined.length === 0,
  )

  const nested = `
const t = resolveSafeRedirectTarget(build(a(b()), c), {
  allowedOrigins: origins(d(e)),
})
`
  ok('⑤ 实参含嵌套调用与多行对象 ⇒ 不误判', judgeOriginPinning(nested).violations.length === 0)

  const varOpts = `const t = resolveSafeRedirectTarget(url, opts)`
  ok('⑥ options 是变量 ⇒ 计未判定而非记绿', judgeOriginPinning(varOpts).undetermined.length === 1)

  // 变异自证:把①里那枚 allowedOrigins 摘掉,同一段文本必须翻红。
  const mutated = pinned.replace(', allowedOrigins: firstPartyAllowedOrigins()', '')
  ok(
    '⑦ 变异:摘掉 allowedOrigins ⇒ ① 那段文本翻红',
    judgeOriginPinning(mutated).violations.length === 1,
  )

  const perFile = new Map([
    ['a.tsx', [{ line: 3, snippet: 'x' }]],
    ['b.tsx', []],
  ])
  const entries = [
    { file: 'a.tsx', bareCalls: 1, reason: '外站回跳是该页的产品契约', until: '2099-01-01' },
  ]
  const v = judgeAgainstLedger(perFile, entries, { today: '2026-11-01' })
  ok('⑧ 台账命中且份数配平 ⇒ 零违规零腐烂', v.violations.length === 0 && v.stale.length === 0)

  // 变异自证:同一条台账,被审面再多的那一枚必须被抓。
  const perFilePlus = new Map([
    [
      'a.tsx',
      [
        { line: 3, snippet: 'x' },
        { line: 9, snippet: 'y' },
      ],
    ],
  ])
  ok(
    '⑨ 变异:同档多出一枚未登记的裸调用 ⇒ 判红',
    judgeAgainstLedger(perFilePlus, entries, { today: '2026-11-01' }).violations.length === 1,
  )

  // 变异自证:豁免不再命中(该文件其实没有裸调用)必须报清单腐烂,不得静默通过。
  const perFileZero = new Map([['a.tsx', []]])
  ok(
    '⑩ 变异:豁免不再命中 ⇒ 清单腐烂',
    judgeAgainstLedger(perFileZero, entries, { today: '2026-11-01' }).stale.length === 1,
  )

  ok(
    '⑪ 变异:到期条目 ⇒ 顶红',
    judgeAgainstLedger(perFile, [{ ...entries[0], until: '2020-01-01' }], { today: '2026-11-01' })
      .expired.length === 1,
  )
  ok(
    '⑫ 缺 until 的条目 ⇒ 未判定(malformed)',
    !!judgeAgainstLedger(perFile, [{ file: 'a.tsx', bareCalls: 1, reason: '足够长的原因说明' }], {
      today: '2026-11-01',
    }).malformed,
  )
  ok(
    '⑬ 原因短于 10 字 ⇒ 未判定(malformed)',
    !!judgeAgainstLedger(
      perFile,
      [{ file: 'a.tsx', bareCalls: 1, reason: '太短', until: '2099-01-01' }],
      { today: '2026-11-01' },
    ).malformed,
  )

  const defFile = `
export function resolveSafeRedirectTarget(target, options) {
  if (isSafeNavigationTarget(target, options)) return target
  return '/'
}
export function isSafeNavigationTarget(target, options) {
  return options === undefined
}
`
  const dRes = judgeOriginPinning(defFile)
  ok(
    '⑭ 定义体内部转调 ⇒ 不算调用点(否则本门在自己的源头文件上永久报未判定)',
    dRes.violations.length === 0 && dRes.undetermined.length === 0,
  )

  // 变异自证(尾逗号档):同一段文本摘掉 allowedOrigins 必须翻红,否则"尾逗号修复"只是把误报搬到别处。
  const trailing = `
const target = resolveSafeRedirectTarget(
  resolvePostLoginLanding(user, searchParams.get('redirect')) ?? '/',
  { allowDeepLink: true, allowedOrigins: firstPartyAllowedOrigins() },
)
`
  ok(
    '⑮ 多行调用带尾逗号 ⇒ 不误判为"无 options"',
    judgeOriginPinning(trailing).violations.length === 0,
  )
  ok(
    '⑯ 变异:同段摘掉 allowedOrigins ⇒ 翻红',
    judgeOriginPinning(trailing.replace(', allowedOrigins: firstPartyAllowedOrigins()', ''))
      .violations.length === 1,
  )

  let rc = 0
  for (const c of cases) {
    if (!c.pass) rc = 1
    console.log(`${c.pass ? `${C.green}✅` : `${C.red}❌`} ${c.name}${C.reset}`)
  }
  console.log(
    `自检:${cases.filter((c) => c.pass).length}/${cases.length}${rc === 0 ? ' 全过' : ' 有失败'}`,
  )
  return rc
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const argv = process.argv.slice(2)
  run({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    selfTest: argv.includes('--self-test'),
  })
    .then((code) => process.exit(code))
    .catch((e) => {
      const undetermined = e instanceof Undetermined
      console.log(
        `${undetermined ? C.yellow : C.red}${undetermined ? '⚠️  未判定(取材失败)' : '❌ 守门异常'}: ${e?.message ?? e}${C.reset}`,
      )
      process.exit(2)
    })
}

export const __test__ = {
  CALL_RE,
  LEDGER_REL,
  PREFILTER_RE,
  SCAN_GLOBS,
  callArgSpan,
  declarationSpans,
  judgeAgainstLedger,
  judgeOriginPinning,
  selfTestRun,
  splitTopLevelArgs,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
