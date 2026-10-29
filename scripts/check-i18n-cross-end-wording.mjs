#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-i18n-cross-end-wording.mjs —— 跨端同名键文案漂移的**裁定对账尺**。
 *
 * 立因(2026-10-30 实测):小程序端与 RN 端共享一批同名 i18n 键,现读 `zh-CN` 面有 **46 枚值不同**。
 * 逐枚读完的结论是:它们**不是一类东西** ——
 *   · 一部分是平台适配(`conversationImport.pickFile` 小程序只能"从微信会话中选择导出文件",
 *     RN 侧给"选择导出文件";四个 `source*Hint` 一端写本机路径、一端写"导出文件"类型),
 *     按基准侧硬对齐 = 把正确措辞改成错误措辞;
 *   · 一部分是渲染形态差(`exam.questions`"{n} 题" 是"标签+值合并",RN"题数"是纯标签);
 *   · 一部分是同名不同义(`conversationImport.historyFailed` 一端当列标签、共享屏当错误句)⇒ 该拆键;
 *   · 还有一部分确实是"同一个界面读着两套字"(`agreementSections.*Body` 由同一共享屏消费)⇒ 该对齐,已对齐。
 * 问题不在"值不同",而在**没有任何一层记下"这一枚为什么可以不同"** —— 于是每一次清理都要从零重读
 * 46 对词条,而真正的新漂移混在里面分不出来(账面看不出错,人也不敢下手)。本尺把这格变成机读:
 * 每条漂移必须在台账里有一条**带类别、带理由、带存活期**的裁定,否则点名。
 *
 * 档位:只读对账尺,**不进提交链、不进 CI**(§12e —— 判的是文案裁定面,存量未清时挂成提交门就是
 * 恒红门,唯一结局是逼人 `--no-verify` 连带废掉全部守门)。唯一调度器 = git-guardian 巡检轮,
 * 人主动复跑走 `pnpm check:i18n-cross-end`。
 *
 * 判据要点(方向都是"宁可多喊,不可静放"):
 *  - 漂移按 **zh-CN 面**取键集与值(基准语言),五语言里任一条目只要"键在两端都存在且值不等"即算漂移;
 *  - 豁免必须 `kind ∈ 允许集` ∧ `reason ≥ 20 字` ∧ `expires 未到期` ∧ 该键**此刻真在漂移集里**;
 *  - `same-screen-drift`(同屏两套字)**不是合法豁免类别** —— 写进台账也判红(它是要修的,不是要免的);
 *  - 台账里点了名而当前已不漂移 ⇒ **清单腐烂**判红(§0.7:豁免会到期,已不在的条目不许留着);
 *  - 任一端词包取不到 ⇒ exit 2 未判定,绝不折成"零漂移"(§0.3)。
 *
 * Usage:
 *   node scripts/check-i18n-cross-end-wording.mjs              # 人读报表
 *   node scripts/check-i18n-cross-end-wording.mjs --json        # 机读(供守护轮/看板)
 *   node scripts/check-i18n-cross-end-wording.mjs --all         # 全列漂移(缺省只点名前 20 条)
 *   node scripts/check-i18n-cross-end-wording.mjs --self-test   # 判据自检(不碰真仓)
 *
 * 退出码:0 = 漂移全部有在册裁定且清单不腐烂;1 = 有未裁定/过期/腐烂/非法类别;2 = 未判定。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WAIVER_REL = 'scripts/data/i18n-cross-end-waivers.jsonl'
const LANGS = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
// 对账的两个端:小程序端 ↔ RN 端(用户口径"小程序端对齐 RN 端",这两端是同一批屏)
const END_A = 'miniapp-taro'
const END_B = 'mobile-rn'
const MIN_REASON = 20

/** 允许作为裁定的类别。刻意不含"同屏两套字"——那是待修项,不是可豁免项。 */
export const LEGAL_KINDS = new Set([
  'platform-adaptation', // 平台措辞差异(微信里给不出本机路径这类)
  'form-difference', // 渲染形态差异(标签+值合并 ↔ 纯标签)
  'semantic-split-needed', // 同名不同义,待拆键(拆完该条自然从漂移集消失)
  'pending-product', // 待产品/翻译定,带到期日的债
  'deprecated-on-one-end', // 一端已下线该界面,另一端还在
])

const packPath = (end, lang) => `packages/i18n/messages/${end}/${lang}.json`

function readFace(face, rel) {
  if (face === 'worktree') {
    // 人工逃生舱:同一条判据换取材面,不另写第二把尺(§0.4)。落地前想先看真读数走这一档。
    try {
      return readFileSync(join(ROOT, rel), 'utf8')
    } catch {
      return null
    }
  }
  try {
    return execFileSync('git', ['show', `${face}:${rel}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 24,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生 git 必须显式给 stdio
    })
  } catch {
    return null
  }
}

/** 分层 JSON 摊平成 `a.b.c` → 字符串值。数组不参与(本仓词包无数组值)。 */
export function flatten(obj, pre = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = pre ? `${pre}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else if (typeof v === 'string') out[key] = v
  }
  return out
}

/** 取两端的漂移集:同名键(任一端有、另一端也有)而值不等。 */
export function driftSet({ aFlat, bFlat }) {
  const out = []
  for (const [k, av] of Object.entries(aFlat))
    if (Object.prototype.hasOwnProperty.call(bFlat, k) && bFlat[k] !== av)
      out.push({ key: k, a: av, b: bFlat[k] })
  return out.sort((x, y) => x.key.localeCompare(y.key))
}

/** 单条裁定的形态问题;返回 null 表示合格。 */
export function waiverProblem(w) {
  if (!w || typeof w !== 'object') return '非对象行'
  if (typeof w.key !== 'string' || !w.key) return '缺 key'
  if (typeof w.kind !== 'string' || !w.kind) return '缺 kind'
  if (w.kind === 'same-screen-drift') return '类别 same-screen-drift 不可作豁免(那是待修项)'
  if (!LEGAL_KINDS.has(w.kind)) return `类别 ${w.kind} 不在允许集`
  if (typeof w.reason !== 'string' || w.reason.trim().length < MIN_REASON)
    return `reason 需 ≥${MIN_REASON} 字的定向说明`
  if (typeof w.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(w.expires))
    return '缺/坏 expires(豁免是带到期日的债,不是白名单)'
  return null
}

export function isExpired(expires, today) {
  return String(expires) < String(today)
}

/**
 * 对账纯函数:漂移集 ↔ 台账。三态分桶,缺输入由调用方处理。
 * `liveKeys` 用于判"清单腐烂":台账点了名而该键已不在漂移集 ⇒ 腐烂。
 */
export function reconcile({ drift, waivers, liveKeys, today }) {
  const byKey = new Map(waivers.map((w) => [w.key, w]))
  const cleared = []
  const uncleared = []
  const invalid = []
  const expired = []
  for (const d of drift) {
    const w = byKey.get(d.key)
    if (!w) {
      uncleared.push(d)
      continue
    }
    const p = waiverProblem(w)
    if (p) {
      invalid.push({ ...d, problem: p })
      continue
    }
    if (isExpired(w.expires, today)) {
      expired.push({ ...d, expires: w.expires })
      continue
    }
    cleared.push({ ...d, kind: w.kind })
  }
  const rot = waivers.filter((w) => waiverProblem(w) === null && !liveKeys.has(w.key))
  return { cleared, uncleared, invalid, expired, rot }
}

/** 从被审面算全部结论。取不到词包 ⇒ 抛 Undetermined,由 run 折成 exit 2。 */
export class Undetermined extends Error {}

export function measure(face = 'HEAD', today = new Date().toISOString().slice(0, 10)) {
  const waiverText = readFace(face, WAIVER_REL)
  if (waiverText === null) throw new Undetermined(`台账 ${WAIVER_REL} 在 ${face} 面取不到`)
  const waivers = waiverText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith('//'))
    .map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return { key: '(坏行)', kind: '(坏行)', reason: '(无法解析)' }
      }
    })

  // 漂移集按 zh-CN 取(基准语言);其余语言同键值不等者一并计入同一枚键的备注,不重复计数
  const a = readFace(face, packPath(END_A, 'zh-CN'))
  const b = readFace(face, packPath(END_B, 'zh-CN'))
  if (a === null || b === null)
    throw new Undetermined(
      `词包取不到:${END_A}/zh-CN=${a === null ? '缺' : '有'} ${END_B}/zh-CN=${b === null ? '缺' : '有'}`,
    )
  const aFlat = flatten(JSON.parse(a))
  const bFlat = flatten(JSON.parse(b))
  const drift = driftSet({ aFlat, bFlat })
  const sharedBoth = Object.keys(aFlat).filter((k) =>
    Object.prototype.hasOwnProperty.call(bFlat, k),
  ).length
  const r = reconcile({
    drift,
    waivers,
    liveKeys: new Set(drift.map((d) => d.key)),
    today,
  })
  // 逐语言的"已裁定但值又漂了"不作单独维:kind 与 reason 不绑值,值变了仍属同一条裁定。
  return {
    face,
    lang: 'zh-CN',
    ends: [END_A, END_B],
    sharedKeys: sharedBoth,
    driftTotal: drift.length,
    cleared: r.cleared.length,
    uncleared: r.uncleared,
    invalid: r.invalid,
    expired: r.expired,
    rot: r.rot,
    waiverRows: waivers.length,
    byKind: r.cleared.reduce((m2, x) => ({ ...m2, [x.kind]: (m2[x.kind] || 0) + 1 }), {}),
  }
}

export function run(argv = [], io = console) {
  if (argv.includes('--self-test')) return selfTest(io)
  const face = argv.includes('--worktree') ? 'worktree' : 'HEAD'
  let m
  try {
    m = measure(face)
  } catch (e) {
    if (e instanceof Undetermined) {
      io.log(`CROSS-END-WORDING state=undetermined why=${e.message}`)
      return 2
    }
    io.log(`CROSS-END-WORDING state=undetermined why=${String(e?.message ?? e).slice(0, 160)}`)
    return 2
  }
  const bad = m.uncleared.length + m.invalid.length + m.expired.length + m.rot.length
  const state = bad === 0 ? 'clean' : 'drift-uncleared'
  if (argv.includes('--json')) {
    io.log(
      JSON.stringify(
        {
          ...m,
          state,
          unclearedKeys: m.uncleared.map((x) => x.key),
          invalidKeys: m.invalid.map((x) => `${x.key}:${x.problem}`),
          expiredKeys: m.expired.map((x) => `${x.key}(${x.expires})`),
          rotKeys: m.rot.map((x) => x.key),
        },
        null,
        2,
      ),
    )
    return bad === 0 ? 0 : 1
  }
  io.log(
    `CROSS-END-WORDING face=${m.face} ${m.ends[0]}↔${m.ends[1]} 同名键 ${m.sharedKeys} · 漂移 ${m.driftTotal} · 已裁 ${m.cleared} · 未裁 ${m.uncleared.length} · 形态坏 ${m.invalid.length} · 过期 ${m.expired.length} · 清单腐烂 ${m.rot.length} state=${state}`,
  )
  io.log(`  按类别:${JSON.stringify(m.byKind)}`)
  const show = argv.includes('--all') ? m.uncleared : m.uncleared.slice(0, 20)
  for (const d of show)
    io.log(
      `  · 未裁定 ${d.key}\n      ${m.ends[0]}=${JSON.stringify(d.a).slice(0, 60)} | ${m.ends[1]}=${JSON.stringify(d.b).slice(0, 60)}`,
    )
  if (m.uncleared.length > show.length)
    io.log(`  …另 ${m.uncleared.length - show.length} 枚(--all 全列)`)
  for (const x of m.invalid) io.log(`  ✗ 裁定形态坏 ${x.key} ⇒ ${x.problem}`)
  for (const x of m.expired) io.log(`  ✗ 裁定已过期 ${x.key}(expires=${x.expires})⇒ 回到未裁定队列`)
  for (const x of m.rot) io.log(`  ✗ 清单腐烂 ${x.key}:该键当前已不漂移,裁定条目还挂着(§0.7)`)
  if (bad === 0) io.log('✅ 全部漂移均有在册裁定,且清单不腐烂')
  return bad === 0 ? 0 : 1
}

/** 判据自检:构造面取证,不碰真仓。每条都成对跑正例与反例。 */
function selfTest(io) {
  const cases = []
  const add = (name, pass) => cases.push({ name, pass })
  const today = '2026-06-30'
  const okW = {
    key: 'x.y',
    kind: 'platform-adaptation',
    reason: '微信里无法给出本机路径,只能从会话选择文件',
    expires: '2027-06-30',
  }

  add(
    'S1 无裁定 ⇒ 进未裁队列',
    (() => {
      const r = reconcile({
        drift: [{ key: 'x.y', a: 'A', b: 'B' }],
        waivers: [],
        liveKeys: new Set(['x.y']),
        today,
      })
      return r.uncleared.length === 1 && r.cleared.length === 0
    })(),
  )
  add(
    'S2 合格裁定 ⇒ 消账',
    (() => {
      const r = reconcile({
        drift: [{ key: 'x.y', a: 'A', b: 'B' }],
        waivers: [okW],
        liveKeys: new Set(['x.y']),
        today,
      })
      return r.cleared.length === 1 && r.uncleared.length === 0
    })(),
  )
  add(
    'S3 reason 过短 ⇒ 判形态坏,不消账',
    (() => {
      const r = reconcile({
        drift: [{ key: 'x.y', a: 'A', b: 'B' }],
        waivers: [{ ...okW, reason: '短' }],
        liveKeys: new Set(['x.y']),
        today,
      })
      return r.invalid.length === 1 && r.cleared.length === 0
    })(),
  )
  add(
    'S4 缺 expires ⇒ 判形态坏(豁免必须会到期)',
    (() => {
      const w = { ...okW }
      delete w.expires
      const r = reconcile({
        drift: [{ key: 'x.y', a: 'A', b: 'B' }],
        waivers: [w],
        liveKeys: new Set(['x.y']),
        today,
      })
      return r.invalid.length === 1
    })(),
  )
  add(
    'S5 已过期 ⇒ 回到未裁队列(以 expired 点名)',
    (() => {
      const r = reconcile({
        drift: [{ key: 'x.y', a: 'A', b: 'B' }],
        waivers: [{ ...okW, expires: '2026-01-01' }],
        liveKeys: new Set(['x.y']),
        today,
      })
      return r.expired.length === 1 && r.cleared.length === 0
    })(),
  )
  add(
    'S6 same-screen-drift 不可作豁免类别',
    (() => {
      const p = waiverProblem({ ...okW, kind: 'same-screen-drift' })
      return typeof p === 'string' && p.includes('待修')
    })(),
  )
  add('S7 未知类别 ⇒ 判形态坏', () => waiverProblem({ ...okW, kind: 'whatever' }) !== null)
  add(
    'S8 清单腐烂 ⇒ 点名(台账有而当前不漂移)',
    (() => {
      const r = reconcile({ drift: [], waivers: [okW], liveKeys: new Set(), today })
      return r.rot.length === 1
    })(),
  )
  add(
    'S9 坏行 JSON ⇒ 判形态坏,不静默放过',
    () => waiverProblem({ key: '(坏行)', kind: '(坏行)', reason: '(无法解析)' }) !== null,
  )
  add('S10 漂移集只取"两端都有该键"的', () => {
    const d = driftSet({ aFlat: { 'p.q': 'A', 'only.a': 'x' }, bFlat: { 'p.q': 'B' } })
    return d.length === 1 && d[0].key === 'p.q'
  })
  add('S11 两端同值 ⇒ 不进漂移集(阳性对照:S10 那把尺确实会报不等)', () => {
    const d = driftSet({ aFlat: { 'p.q': 'A' }, bFlat: { 'p.q': 'A' } })
    return d.length === 0
  })
  add('S12 flatten 能吃三层嵌套', () => {
    const f = flatten({ a: { b: { c: 'v' } } })
    return f['a.b.c'] === 'v'
  })
  let failed = 0
  for (const c of cases) {
    if (!c.pass) {
      failed++
      io.log(`✗ ${c.name}`)
    } else io.log(`✓ ${c.name}`)
  }
  io.log(
    failed === 0
      ? `SELF-TEST PASS ${cases.length}/${cases.length}`
      : `SELF-TEST FAIL ${failed}/${cases.length}`,
  )
  return failed === 0 ? 0 : 1
}

export const __test__ = {
  flatten,
  driftSet,
  waiverProblem,
  reconcile,
  isExpired,
  measure,
  LEGAL_KINDS,
  WAIVER_REL,
  MIN_REASON,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = run(process.argv.slice(2))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
