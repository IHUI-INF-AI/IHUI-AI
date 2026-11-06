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
 * 两条轴(2026-11-06 并入第二条):
 *  - 轴一 **miniapp↔RN 同名配对**:门 `findings` 里的四维(本台账原有的 DIMENSIONS);
 *  - 轴二 **web↔RN 五维几何**:门 `webRn.detail` 里的 `diffCount`。这一腿在门侧是 advisory
 *    (只拦本次新增,存量永远只报数),所以这 128 对分叉此前**无人记账** —— 轴二补的就是这本账。
 *    门只在该轴面上给了聚合的 `allowedDiff` 计数、没把豁免态落到逐对 ⇒ 每对的裁决态记
 *    `unknown`(不猜),聚合数原样投影。
 *
 * 用法:
 *   node scripts/cross-end-ui-parity-debt.mjs            # 人读:两条轴的族表 + 与在册快照对比
 *   node scripts/cross-end-ui-parity-debt.mjs --json     # 机读
 *   node scripts/cross-end-ui-parity-debt.mjs --record   # 把当次读数写成在册快照(需 --commit-ok;
 *                                                        #  轴一已有基线且本轮与它不一致时默认**不刷平**轴一,
 *                                                        #  只并入轴二;确要重建轴一另带 --rebase-axis1)
 *   node scripts/cross-end-ui-parity-debt.mjs --check    # 只判"有没有族涨回去":任一轴涨=exit 1
 *
 * 退出码(§0.3:取不到输入一律 2,不记绿也不冒红):
 *   0 两轴均无回潮 / 1 有族欠债上升(--check)或写档失败(--record)/ 2 未判定
 *   (门没跑出 JSON、快照坏了、**或某一轴门判不了 / 还没在册** —— 后一种绝不回 0)
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GATE = join(ROOT, 'scripts', 'check-cross-end-ui-parity.mjs')
const SNAPSHOT_REL = 'scripts/cross-end-ui-parity-debt.json'
const SNAPSHOT = join(ROOT, SNAPSHOT_REL)
/** 仓内既有的格式化器(与 scripts/check-format-changed.mjs 同一个执行入口,不另立一套) */
const PRETTIER_BIN = join(ROOT, 'node_modules', 'prettier', 'bin', 'prettier.cjs')

const GATE_TIMEOUT_MS = 600_000
/** 门的真实退出码(1 = 门判出分叉,不等于台账失效);由 readGateJson 落进来供如实标注 */
let gateRc = 0
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

/**
 * 轴二(web↔RN)在门 JSON 里**已被本台账消费**的键,逐条写死 —— 和 DIMENSIONS 同一个理由:
 * 门哪天在这一段加一个键,本尺子必须把它报成"没算进账",而不是静默当全量。
 * `detail` 是逐对明细(下面 buildWebRnRows 消费),`allowedDiff` 是该轴的聚合裁决计数。
 */
const WEB_RN_CONSUMED_KEYS = [
  'pairCount',
  'judgedPairs',
  'findings',
  'unregistered',
  'dimensions',
  'dimCoverage',
  'oneSided',
  'undetermined',
  'detail',
  'pending',
  'blocked',
  'allowedDiff',
]

function uncoveredWebRnKeys(json) {
  const seen = new Set(Object.keys(json?.webRn ?? {}))
  return [...seen].filter((k) => !WEB_RN_CONSUMED_KEYS.includes(k))
}

/**
 * 轴二这一轮**判没判**。三态,失效方向恒为"多要一次定向说明":
 *  - `absent` 门压根没吐 webRn 段 ⇒ 这一轴无从记账(不猜、不记绿);
 *  - `unjudged` 门自己说整腿取不到输入(`blocked`)/ 配对账本一条也没配上(`pairCount` 取不到或为 0)
 *    ⇒ 「枚举到 0 个候选判死不记绿」(§0.3),这和"两端一样"是两件事;
 *  - `judged` 其余:门量到了,下面的读数才算数。
 */
function webRnAxis(json) {
  const w = json?.webRn
  if (!w || typeof w !== 'object')
    return { state: 'absent', why: '门的 JSON 里没有 webRn 段(口径变了或该腿未接线)', section: null }
  if (w.blocked) return { state: 'unjudged', why: String(w.blocked), section: w }
  if (typeof w.pairCount !== 'number')
    return { state: 'unjudged', why: 'webRn.pairCount 取不到 ⇒ 该轴没判', section: w }
  if (w.pairCount === 0)
    return {
      state: 'unjudged',
      why: 'webRn.pairCount=0 ⇒ 一条 web↔RN 配对都没配上,不是"两端已对齐"',
      section: w,
    }
  return { state: 'judged', why: null, section: w }
}

/**
 * 轴二的族表:**debt 一律取门自己算好的 `diffCount`**,本层一个几何量都不重算(§0.6/§22c)。
 * 逐维那一列只是把门的 `dims[d].webOnly/rnOnly` 两个明细数组投影成计数,同一条数,不是第二把尺子。
 * `adjudicated` 恒为 `unknown`:门在该轴只暴露了聚合 `allowedDiff` 计数,没把登记态落到逐对 ⇒
 * 不猜某一对"已豁免",也不猜某一对"未豁免"。
 */
function buildWebRnRows(json) {
  const dims = Array.isArray(json?.webRn?.dimensions) ? json.webRn.dimensions : []
  const rows = (json?.webRn?.detail ?? []).map((f) => {
    const per = {}
    const status = {}
    for (const d of dims) {
      const c = f?.dims?.[d]
      if (!c) {
        per[d] = null
        status[d] = 'no-reading'
        continue
      }
      per[d] = (c.webOnly?.length ?? 0) + (c.rnOnly?.length ?? 0)
      status[d] = c.status ?? 'unknown'
    }
    return {
      name: f.name,
      debt: Number(f.diffCount ?? 0),
      judgedDims: Number(f.judgedDims ?? 0),
      adjudicated: 'unknown',
      per,
      status,
      web: f.web ?? null,
      rn: f.rn ?? null,
    }
  })
  return rows.sort((a, b) => b.debt - a.debt || a.name.localeCompare(b.name))
}

/**
 * `--check` 的裁决(纯函数,镜像测试直接调用它,不靠跑 main)。红优先于未判定,但**只认有基线那一轴的涨**:
 * 轴二还没建基线时把全部读数报成"新出现的配对"是自证循环(没有可比的前值),那种情形落 2 而不是 1。
 * 某一轴"门判不了 / 还没在册"顶 2 —— **绝不回 0 冒充两轴都判过**(§0.3)。
 */
function checkVerdict({
  miniappUp = [],
  webRnState,
  webRnWhy = null,
  webRnUp = [],
  webRnLedger = 'not-in-ledger',
}) {
  if (miniappUp.length > 0) return { code: 1, why: `轴一 ${miniappUp.length} 族欠债上升` }
  if (webRnState !== 'judged') return { code: 2, why: `轴二未判定:${webRnWhy}` }
  if (webRnLedger === 'not-in-ledger')
    return { code: 2, why: '轴二本轮判了,但在册快照里没有 webRn 段 ⇒ 无基线可比(先 --record --commit-ok)' }
  if (webRnLedger === 'broken')
    return { code: 2, why: '在册快照的 webRn 段缺 families 数组 ⇒ 轴二无基线可比,不拿坏档当基线' }
  if (webRnUp.length > 0) return { code: 1, why: `轴二 ${webRnUp.length} 对欠债上升` }
  return { code: 0, why: '两轴均无回潮' }
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

/**
 * 把门的输出解析成 JSON —— **「门判红」与「门跑不动」是两件事,不得混为一谈**。
 * 门 rc=1 的语义是"量出了分叉"(它本来就是 blocking 门),这恰恰是本台账最需要出数的时刻;
 * 此前用 execFileSync 的非零抛出把它当成"跑不动"⇒ 台账在门红时恒落未判定,样式链的欠债地图
 * 永远在需要它的时候是瞎的(2026-10-25 实测:门 --json stdout 37,679 字节完好、stderr 0 字节、rc=1)。
 * 真·未判定的形态只有一个:stdout 里解析不出 JSON(崩、超时被杀、ENOENT、口径改了)。
 */
export function parseGateOutput(stdout, rc) {
  const text = typeof stdout === 'string' ? stdout : ''
  const start = text.indexOf('{')
  if (start < 0) {
    throw new Error(
      `门没有输出 JSON ⇒ 未判定,不猜(rc=${rc === null || rc === undefined ? '未取到' : rc};stdout ${text.length} 字节)`,
    )
  }
  return JSON.parse(text.slice(start))
}

function readGateJson() {
  let out
  let rc = 0
  try {
    out = execFileSync(process.execPath, [GATE, '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: GATE_TIMEOUT_MS,
    })
  } catch (e) {
    // 非零退出(含"门判红")从这里接住:stdout 有 JSON 就照常出账,rc 只用于如实标注口径
    out = typeof e?.stdout === 'string' ? e.stdout : ''
    rc = e?.status === null || e?.status === undefined ? null : e.status
  }
  gateRc = rc
  return parseGateOutput(out, rc)
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

/**
 * 写档后把在册快照交给仓里既有的 prettier 格式化。
 * 快照是**生成物**,它的规范形态必须由全仓唯一的格式化器决定:否则下一次 --record 又把工件
 * 写成"合法但不是 prettier 形态",而提交链的格式差值棘轮判的恰恰是"本次改动的文件"(实测:
 * HEAD 那份快照本身就不合格式,谁碰它谁翻红)。格式化失败只告警不判死 —— 内容已落盘,
 * 把"没格式化"报成"写档失败"是另一种失真。
 */
function formatSnapshot() {
  if (!existsSync(PRETTIER_BIN)) return 'prettier 不在位 ⇒ 快照未格式化(仍是合法 JSON)'
  try {
    execFileSync(process.execPath, [PRETTIER_BIN, '--write', SNAPSHOT_REL], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 120_000,
    })
    return null
  } catch (e) {
    return `prettier --write 失败:${String(e?.message ?? e).slice(0, 120)}`
  }
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
  if (gateRc !== 0) {
    console.log(
      `  ⓘ 门 rc=${gateRc} = 它量到了分叉(它本来就是 blocking 门),不是"跑不动"⇒ 下面照它的输出出账;这张表也不代表门绿。`,
    )
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

  /** 轴二(web↔RN 五维几何):判没判由门自述决定,族表只消费 detail,与轴一同一条口径纪律。 */
  const wr = webRnAxis(json)
  const webRows = wr.state === 'judged' ? buildWebRnRows(json) : []
  const webTotal = webRows.reduce((s, r) => s + r.debt, 0)
  /** 轴二的基线段:快照里没有该段 = 未在册;有段但没有 families 数组 = 坏了 —— 两者都不许当基线用。 */
  const wrLedgerState = !snap?.webRn ? 'not-in-ledger' : Array.isArray(snap.webRn.families) ? 'present' : 'broken'
  const dw = diffAgainst(webRows, wrLedgerState === 'present' ? snap.webRn : null)
  const uncoveredW = uncoveredWebRnKeys(json)
  const nowIso = new Date().toISOString()

  const payload = {
    schema: 3,
    recordedAt: nowIso,
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
    webRn:
      wr.state === 'judged'
        ? {
            recordedAt: nowIso,
            state: 'judged',
            dimensions: json.webRn.dimensions ?? null,
            uncoveredKeys: uncoveredW,
            pairCount: json.webRn.pairCount,
            judgedPairs: json.webRn.judgedPairs ?? null,
            findings: json.webRn.findings ?? null,
            unregistered: json.webRn.unregistered ?? null,
            dimCoverage: json.webRn.dimCoverage ?? null,
            oneSided: (json.webRn.oneSided ?? []).length,
            undetermined: (json.webRn.undetermined ?? []).length,
            pending: (json.webRn.pending ?? []).length,
            allowedDiff: json.webRn.allowedDiff ?? null,
            total: webTotal,
            families: webRows,
          }
        : { state: wr.state, why: wr.why, uncoveredKeys: uncoveredW },
  }

  if (record) {
    if (!argv.includes('--commit-ok')) {
      console.error(
        `❌ 拒绝写档:改在册基线必须显式带 --commit-ok(它是"欠债少了多少"的凭据,不能顺手刷平)`,
      )
      return 1
    }
    if (wr.state !== 'judged') {
      console.error(
        `❌ 拒绝写档:轴二(web↔RN)本轮${wr.state === 'absent' ? '没有输入' : '未判定'}(${wr.why})⇒ ` +
          `把没判的那一轴写进基线,等于把它永远洗成"持平"`,
      )
      return 1
    }
    /**
     * 加一条轴不得顺手把另一条轴的基线刷平:轴一已有在册读数、而本轮读数与它不一致时,
     * 默认**逐字保留**轴一的 families/total(只并入轴二),涨跌照常留给人看。
     * 确要按本轮重建轴一,须显式 `--rebase-axis1`(它和 --commit-ok 一样是要写进提交信息的动作)。
     */
    const axis1Drifted =
      !!snap && (d.up.length > 0 || d.down.length > 0 || (d.vanished?.length ?? 0) > 0)
    const preserveAxis1 = !!snap && axis1Drifted && !argv.includes('--rebase-axis1')
    const final = preserveAxis1
      ? {
          ...payload,
          recordedAt: snap.recordedAt,
          face: snap.face,
          dimensions: snap.dimensions,
          uncoveredFindingKeys: snap.uncoveredFindingKeys ?? payload.uncoveredFindingKeys,
          total: snap.total,
          waivedTotal: snap.waivedTotal,
          openTotal: snap.openTotal,
          families: snap.families,
          axis1PreservedFrom: snap.recordedAt,
        }
      : payload
    writeFileSync(SNAPSHOT, JSON.stringify(final, null, 2) + '\n', 'utf8')
    const fmt = formatSnapshot()
    if (fmt) console.log(`  ⚠ ${fmt} —— 内容已落盘,格式待人工补跑 npx prettier --write ${SNAPSHOT_REL}`)
    console.log(
      `✅ 已写 ${SNAPSHOT_REL}:轴二 total=${webTotal} 对=${webRows.length} 已按本轮建基线`,
    )
    if (preserveAxis1)
      console.log(
        `  ⓘ 轴一基线**未被刷平**:保留在册读数(${snap.recordedAt},total=${snap.total} 族=${snap.families.length}),` +
          `本轮轴一有 ${d.up.length} 涨 / ${d.down.length} 降 / ${d.vanished?.length ?? 0} 读不到 ⇒ 这些涨跌仍然看得见;` +
          `要按本轮重建轴一带 --rebase-axis1`,
      )
    else
      console.log(`  ⓘ 轴一 total=${total} 族=${rows.length}${snap ? ' · 与在册一致,按本轮重建' : ' · 首次建基线'}`)
    return 0
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        { ...payload, againstBaseline: d, againstBaselineWebRn: dw, webRnState: wr.state, webRnWhy: wr.why },
        null,
        2,
      ),
    )
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
        ? `\n与在册快照对比(轴一 小程序↔RN,${d.baseline}):涨 ${d.up.length} 族 / 降 ${d.down.length} 族 / 持平 ${d.same.length} 族`
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

    // ── 轴二 web↔RN 五维几何 ────────────────────────────────────────────────
    console.log('\n【轴二】web↔RN 五维几何(门侧 advisory ⇒ 只拦新增,存量本来无人记账 —— 这一轴补的就是那本账)')
    if (wr.state !== 'judged') {
      console.log(
        `  ${wr.state === 'absent' ? '⛔ 无输入' : '⛔ 未判定'}:${wr.why} ⇒ 本轴不记绿也不冒红(§0.3),` +
          '上面的轴一读数不能被读成"跨端样式已对齐"',
      )
    } else {
      const w = json.webRn
      console.log(
        `  配对 ${w.pairCount} 屏 / 门判得出 ${w.judgedPairs} / 有差 ${w.findings} · 未登记差异 ${w.unregistered} · ` +
          `轴二合计读数 = ${webTotal}\n` +
          `  一侧无读数 ${w.oneSided?.length ?? 0} 处 / 零判据 ${w.undetermined?.length ?? 0} 对 / ` +
          `配对待确认 ${w.pending?.length ?? 0} 行(这些都不等于"两端同值")`,
      )
      const ad = w.allowedDiff ?? {}
      console.log(
        `  登记核销(门只给聚合,逐对裁决态本尺子读不到 ⇒ 每行记 unknown,不猜):` +
          `matched ${ad.matched ?? 0} / shrunk ${ad.shrunk ?? 0} / over ${ad.over ?? 0} / ` +
          `expired ${ad.expired ?? 0} / invalid ${ad.invalid ?? 0} / unregistered ${ad.unregistered ?? 0}`,
      )
      const dims = Array.isArray(w.dimensions) ? w.dimensions : []
      const cov = w.dimCoverage ?? {}
      console.log(
        `  每维可判屏数(五维覆盖面,判不出的那一维就是盲区):` +
          dims.map((x) => `${x} ${cov[x] ?? '?'}`).join(' / '),
      )
      console.log(`  屏名                    差  可判维  ${dims.join(' / ')}  裁决`)
      const shown = webRows.slice(0, 20)
      for (const r of shown) {
        const cells = dims
          .map((x) => {
            const n = r.per[x]
            if (n === null) return `${x} ?`
            const st = r.status[x]
            return st === 'one-sided' ? `${x} ${n}◐` : `${x} ${n}`
          })
          .join(' / ')
        console.log(
          `  ${r.name.padEnd(22)}${String(r.debt).padStart(3)} ${String(r.judgedDims).padStart(4)}   ${cells}  未在册`,
        )
      }
      if (webRows.length > shown.length)
        console.log(`  …其余 ${webRows.length - shown.length} 对(全表见 --json 的 webRn.families)`)
      console.log(
        dw.baseline
          ? `\n与在册快照对比(轴二 web↔RN,${dw.baseline}):涨 ${dw.up.length} 对 / 降 ${dw.down.length} 对 / 持平 ${dw.same.length} 对`
          : '\n  ⓘ 轴二还没有在册基线(快照无 webRn 段)⇒ --check 在这一轴落"未判定",要建基线跑 --record --commit-ok',
      )
      for (const x of dw.up)
        console.log(`  ⛔ ${x.name} ${x.from === null ? '(新出现的配对)' : x.from} → ${x.to}(+${x.delta})`)
      for (const x of dw.down) console.log(`  ✅ ${x.name} ${x.from} → ${x.to}(${x.delta})`)
      for (const x of dw.vanished ?? [])
        console.log(`  ? ${x.name} 这次读不到(原欠债 ${x.was})—— 配对没了不等于清零,须点名归属`)
      if (uncoveredW.length)
        console.log(
          `  ⓘ 门在 webRn 段还吐了这些键、本台账没消费:${uncoveredW.join(', ')} ⇒ 轴二的 total 是**下界**`,
        )
    }

    console.log(
      '  ⓘ 本尺子只读:不进提交链也不进 CI(§12e)。清欠债的验收 = 族名单行下降 + 该族两端截图同形。',
    )
  }

  if (check) {
    if (!snap) {
      console.error('❌ 未判定:没有在册快照,无基线可比(先 --record --commit-ok)')
      return 2
    }
    const v = checkVerdict({
      miniappUp: d.up,
      webRnState: wr.state,
      webRnWhy: wr.why,
      webRnUp: dw.up,
      webRnLedger: wrLedgerState,
    })
    if (v.code !== 0) {
      console.error(`❌ --check:${v.why}`)
      return v.code
    }
    console.log(`✅ --check:${v.why}`)
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  // 不显式 process.exit:结论行还在管道里排队时,exit 会把末行截掉(判红那一刻恰恰最需要那行)
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exitCode = 2
    })
}

export const __test__ = {
  debtOf,
  langMismatch,
  buildRows,
  parseGateOutput,
  diffAgainst,
  uncoveredDimensions,
  waiverState,
  buildWebRnRows,
  webRnAxis,
  uncoveredWebRnKeys,
  checkVerdict,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
