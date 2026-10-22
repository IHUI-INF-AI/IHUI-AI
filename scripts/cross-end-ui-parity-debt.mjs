#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端样式欠债台账(只读对账尺子,**不进提交链、不进 CI** —— AGENTS §12e / §1「只读尺子」条)。
 *
 * 立项原话(2026-10-23 机主):"小程序端的样式跟 rn 端差别也太大了 不是要求了必须一致 同步开发吗"。
 * 实情不是"没人管",而是管它的那道门 `check-cross-end-ui-parity.mjs`(128)按 §12e 只能做
 * **差值棘轮**:只拦本次新增,存量永远只报数 ⇒ 门绿着,脸各长各的。缺的是把那份"只报数"
 * 变成**一族一笔、可对比、可验收的账**。
 *
 * 判据一律不自建(§0.6 / §22c):本脚本只跑 `check-cross-end-ui-parity.mjs --json` 并**消费它的
 * 输出**。门改口径,台账自动跟着变;这里出现任何"我再算一遍几何"都是第二把尺子,即缺陷。
 *
 * 用法:
 *   node scripts/cross-end-ui-parity-debt.mjs            # 人读:按欠债降序的族表 + 与在册快照对比
 *   node scripts/cross-end-ui-parity-debt.mjs --json     # 机读
 *   node scripts/cross-end-ui-parity-debt.mjs --record   # 把当次读数写成在册快照(需 --commit-ok)
 *   node scripts/cross-end-ui-parity-debt.mjs --check    # 只判"有没有族涨回去":涨=exit 1
 *
 * 退出码(§0.3:取不到输入一律 2,不记绿也不冒红):
 *   0 无回潮 / 1 有族欠债上升(--check)或写档失败(--record)/ 2 未判定(门没跑出 JSON、快照坏了)
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GATE = join(ROOT, 'scripts', 'check-cross-end-ui-parity.mjs')
const SNAPSHOT_REL = 'scripts/cross-end-ui-parity-debt.json'
const SNAPSHOT = join(ROOT, SNAPSHOT_REL)
const GATE_TIMEOUT_MS = 600_000
/** 对账门的豁免登记台账(族的"已裁决"状态与存活期唯一住在这里,本尺子只投影、不另立一份) */
const WAIVERS_REL = 'scripts/cross-end-ui-parity-baseline.json'

/**
 * 本台账**看得见**的维度。刻意逐条写死:哪一天门多吐一个维度,`--check` 会因为它不在
 * 本清单里而拒绝把总数当成"全量欠债"(见 uncoveredDimensions)。
 */
const DIMENSIONS = [
  'diffCount',
  'radiusCount',
  'elementRadiusCount',
  'langMismatch',
]

/**
 * 一族的差异是不是"已登记豁免" ⇒ 只认门的 waivers 台账里那一行,且必须**同时**满足:
 * 有 reason、有 until、且 until 未过期。缺一样都不算豁免(§0.7 验过才免)。
 * 过期 ⇒ 该族差异重新变成**未裁决欠债**,这是设计后果,不是尺子坏了。
 */
function waiverState(name, waivers, today) {
  const w = waivers?.[name]
  if (!w || typeof w.reason !== 'string' || w.reason.trim() === '') return { waived: false }
  if (typeof w.until !== 'string') return { waived: false, noExpiry: true }
  return { waived: w.until >= today, until: w.until, expired: w.until < today }
}

/** 取用形态两端不同 = 结构性分叉(一份 className、一份 StyleSheet.create ⇒ 不可能同脸) */
function langMismatch(f) {
  const m = f?.lang?.miniapp
  const r = f?.lang?.rn
  if (typeof m !== 'string' || typeof r !== 'string') return 0
  return m === r ? 0 : 1
}

function debtOf(f) {
  return (
    Number(f.diffCount ?? 0) +
    Number(f.radiusCount ?? 0) +
    Number(f.elementRadiusCount ?? 0) +
    langMismatch(f)
  )
}

/**
 * 门在 JSON 里吐了、但本台账**既没算进总数也不是已计维度的明细**的键 ⇒ 必须点名。
 * `radius` / `elementRadius` 是 `radiusCount` / `elementRadiusCount` 的明细数组,已经计进总数,
 * 不得报成"没算"(每行都喊等于没人听 —— 镜像用例 T11 钉这一格)。
 */
function uncoveredDimensions(json) {
  const seen = new Set(Object.keys(json?.findings?.[0] ?? {}))
  const known = new Set([
    'name',
    'diffCount',
    'radiusCount',
    'elementRadiusCount',
    'lang',
    'radius',
    'elementRadius',
  ])
  return [...seen].filter((k) => !known.has(k))
}

function buildRows(json, waivers = {}, today = new Date().toISOString().slice(0, 10)) {
  const rows = (json?.findings ?? []).map((f) => {
    const w = waiverState(f.name, waivers, today)
    return {
      name: f.name,
      debt: debtOf(f),
      waived: w.waived,
      waiverUntil: w.until ?? null,
      waiverExpired: w.expired === true,
      waiverMissingExpiry: w.noExpiry === true,
      geometry: Number(f.diffCount ?? 0),
      radiusFile: Number(f.radiusCount ?? 0),
      radiusElement: Number(f.elementRadiusCount ?? 0),
      radiusOnlyMiniapp: (f.radius?.onlyMiniapp ?? []).length,
      radiusOnlyRn: (f.radius?.onlyRn ?? []).length,
      elementOnlyMiniapp: (f.elementRadius?.onlyMiniapp ?? []).length,
      elementOnlyRn: (f.elementRadius?.onlyRn ?? []).length,
      lang: `${f.lang?.miniapp ?? '?'} vs ${f.lang?.rn ?? '?'}`,
      langMismatch: langMismatch(f),
    }
  })
  return rows.sort((a, b) => b.debt - a.debt || a.name.localeCompare(b.name))
}

function readGateJson() {
  const out = execFileSync(process.execPath, [GATE, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: GATE_TIMEOUT_MS,
  })
  const start = out.indexOf('{')
  if (start < 0) throw new Error('门没有输出 JSON(取不到输入,不猜)')
  return JSON.parse(out.slice(start))
}

function readSnapshot() {
  if (!existsSync(SNAPSHOT)) return null
  try {
    const j = JSON.parse(readFileSync(SNAPSHOT, 'utf8'))
    if (!j || !Array.isArray(j.families)) throw new Error('缺 families 数组')
    return j
  } catch (e) {
    throw new Error(`${SNAPSHOT_REL} 不是合法快照 —— 台账坏了不得当基线用:${e.message}`)
  }
}

function diffAgainst(rows, snap) {
  if (!snap) return { up: [], down: [], same: [], baseline: null }
  const before = new Map(snap.families.map((f) => [f.name, f.debt]))
  const after = new Map(rows.map((f) => [f.name, f.debt]))
  const up = []
  const down = []
  const same = []
  for (const [name, debt] of after) {
    const b = before.get(name)
    if (b === undefined) {
      up.push({ name, from: null, to: debt, delta: debt })
      continue
    }
    if (debt > b) up.push({ name, from: b, to: debt, delta: debt - b })
    else if (debt < b) down.push({ name, from: b, to: debt, delta: debt - b })
    else same.push({ name, debt })
  }
  // 快照里有、这次读不到的族 = 配对没了(改名/删文件/被剔成不可达),不得当成"清零"
  const vanished = [...before.keys()].filter((n) => !after.has(n)).map((n) => ({ name: n, was: before.get(n) }))
  return { up, down, same, vanished, baseline: snap.recordedAt }
}

function readWaivers() {
  const p = join(ROOT, WAIVERS_REL)
  if (!existsSync(p)) throw new Error(`${WAIVERS_REL} 不存在 ⇒ 无法判定哪些差异已裁决,本台账拒绝出数`)
  let j
  try {
    j = JSON.parse(readFileSync(p, 'utf8'))
  } catch (e) {
    throw new Error(`${WAIVERS_REL} 不是合法 JSON:${e.message}`)
  }
  if (!j.waivers || typeof j.waivers !== 'object')
    throw new Error(`${WAIVERS_REL} 没有 waivers 段 ⇒ 未判定,不把全部差异当成待修`)
  return j.waivers
}

async function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const record = argv.includes('--record')
  const check = argv.includes('--check')

  let json
  try {
    json = readGateJson()
  } catch (e) {
    console.error(`❌ 未判定:跑不动对账门 ⇒ 本台账不记绿也不冒红(${e.message})`)
    return 2
  }
  if (!Array.isArray(json.findings)) {
    console.error('❌ 未判定:门的 JSON 里没有 findings 数组(口径变了,先修台账)')
    return 2
  }

  let waivers
  try {
    waivers = readWaivers()
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    return 2
  }
  const rows = buildRows(json, waivers)
  const total = rows.reduce((s, r) => s + r.debt, 0)
  /** 已登记豁免(带原因 + 未过期)的那部分**不是待修**;剩下的才是。两数必须分开报。 */
  const waivedTotal = rows.filter((r) => r.waived).reduce((s, r) => s + r.debt, 0)
  const openTotal = total - waivedTotal
  const expired = rows.filter((r) => r.waiverExpired)
  const noExpiry = rows.filter((r) => r.waiverMissingExpiry)
  let snap
  try {
    snap = readSnapshot()
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    return 2
  }
  const d = diffAgainst(rows, snap)
  const uncovered = uncoveredDimensions(json)

  const payload = {
    schema: 2,
    recordedAt: new Date().toISOString(),
    face: json.face ?? 'unknown',
    gate: 'scripts/check-cross-end-ui-parity.mjs --json',
    waiversSource: WAIVERS_REL,
    dimensions: DIMENSIONS,
    uncoveredFindingKeys: uncovered,
    pairCount: json.pairCount ?? null,
    onlyMiniappNames: (json.onlyMiniappNames ?? []).length,
    onlyRnNames: (json.onlyRnNames ?? []).length,
    total,
    waivedTotal,
    openTotal,
    families: rows,
  }

  if (record) {
    if (!argv.includes('--commit-ok')) {
      console.error(
        `❌ 拒绝写档:改在册基线必须显式带 --commit-ok(它是"欠债少了多少"的凭据,不能顺手刷平)`,
      )
      return 1
    }
    writeFileSync(SNAPSHOT, JSON.stringify(payload, null, 2) + '\n', 'utf8')
    console.log(`✅ 已写 ${SNAPSHOT_REL}:total=${total} 族=${rows.length}`)
    return 0
  }

  if (asJson) {
    console.log(JSON.stringify({ ...payload, againstBaseline: d }, null, 2))
  } else {
    console.log(
      `[跨端样式欠债台账] 面=${payload.face} 同名配对 ${payload.pairCount} 对 · ` +
        `仅小程序成文件 ${payload.onlyMiniappNames} / 仅 RN 成文件 ${payload.onlyRnNames}\n` +
        `  待修(未裁决)= ${openTotal} · 已登记豁免 = ${waivedTotal} · 合计读数 = ${total}\n` +
        `  (豁免读的是 ${WAIVERS_REL} 里各族的 reason+until;过期或缺 until 即回到"待修",见 §0.7)`,
    )
    console.log('  族名                 总  几何  圆角(文件/同名元素)  取用形态           裁决')
    for (const r of rows) {
      const lang = r.langMismatch ? `⚠ ${r.lang}` : `= ${r.lang}`
      const state = r.waived
        ? `豁免至 ${r.waiverUntil}`
        : r.waiverExpired
          ? `⛔ 豁免已过期 ${r.waiverUntil}`
          : r.waiverMissingExpiry
            ? '⛔ 豁免无终态'
            : '未裁决'
      console.log(
        `  ${r.name.padEnd(22)}${String(r.debt).padStart(3)} ${String(r.geometry).padStart(5)}` +
          `      ${String(r.radiusFile).padStart(2)} / ${String(r.radiusElement).padStart(3)}` +
          `   ${r.elementOnlyMiniapp}仅小程序 · ${r.elementOnlyRn}仅RN  ${lang.padEnd(24)} ${state}`,
      )
    }
    if (openTotal === 0)
      console.log(
        '  ⓘ 同名配对这一层已无未裁决分叉 ⇒ "两端看起来还是不一样"的成因不在这些族里,' +
          '在两侧各自那 ' +
          (payload.onlyMiniappNames + payload.onlyRnNames) +
          ' 个不配对的文件上(它们不成对,门零判据)。',
      )
    console.log(
      d.baseline
        ? `\n与在册快照(${d.baseline})对比:涨 ${d.up.length} 族 / 降 ${d.down.length} 族 / 持平 ${d.same.length} 族`
        : '\n(还没有在册快照:node scripts/cross-end-ui-parity-debt.mjs --record --commit-ok)'
    )
    for (const x of d.up)
      console.log(`  ⛔ ${x.name} ${x.from === null ? '(新出现的配对)' : x.from} → ${x.to}(+${x.delta})`)
    for (const x of d.down) console.log(`  ✅ ${x.name} ${x.from} → ${x.to}(${x.delta})`)
    for (const x of d.vanished ?? [])
      console.log(`  ? ${x.name} 这次读不到(原欠债 ${x.was})—— 配对没了不等于清零,须点名归属`)
    if (uncovered.length)
      console.log(
        `  ⓘ 门还吐了这些维度、本台账没算进总数:${uncovered.join(', ')} ⇒ 上面的 total 是**下界**,不是全量`,
      )
    console.log(
      '  ⓘ 本尺子只读:不进提交链也不进 CI(§12e)。清欠债的验收 = 族名单行下降 + 该族两端截图同形。',
    )
  }

  if (check) {
    if (!snap) {
      console.error('❌ 未判定:没有在册快照,无基线可比(先 --record --commit-ok)')
      return 2
    }
    if (d.up.length > 0) {
      console.error(`⛔ ${d.up.length} 族欠债上升 —— 门只拦"本次新增",涨在这把尺子上看得见`)
      return 1
    }
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  debtOf,
  langMismatch,
  buildRows,
  diffAgainst,
  uncoveredDimensions,
  waiverState,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
