#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出对账报告 */
/**
 * check-web-rn-gap-ratchet.mjs — web↔RN 覆盖缺口棘轮(P0-2)
 *
 * 立因(2026-11-03):门 275 `check-web-rn-screen-parity.mjs` 是只读对账尺,读数里
 * `unmapped` / `judgedGap` / `prefixHits` / `prefixExpired` 都没有进提交链;
 * 后来者只要把一条 web 路由从台账里删掉、或新增一条段级豁免,尺子照报 0,没有任何棘轮拦。
 * 本脚本把既有读数包成判据,**不重算第二份口径**(§0.6):
 *   - web 路由 / RN 屏 / 门户表 / 台账解析 / 未映射判定,全部直接调用
 *     `check-web-rn-screen-parity.mjs` 的 `__test__` 出口(其 `evaluateMap` 同时供原尺与
 *     `probe-web-rn-gap` 使用,已保证「对账尺报多少条,探针就分诊多少条」永远相等);
 *   - 本文件只负责把读数折成 0/1/2 与点名,不另写一套 route 匹配 / 豁免解析。
 *
 * 判据(任一退化 ⇒ exit 1):
 *   unmapped = 0                 web 路由必须全部被台账/门户承载认领
 *   judgedGap = 0                判过且确认缺 RN 承载的 gap 必须清零
 *   prefixHits <= 423            段级前缀豁免命中总数不得高于首跑基线(棘轮只降不升)
 *   prefixExpired = 0            段级豁免必须带存活期且未到期(§0.7 豁免会到期)
 *   aligned 行 data.kind 完整    每条 aligned 必须带 direct/indirect/static/missing 之一
 *
 * 基线:`--baseline` 把当前读数写到 `scripts/data/web-rn-gap-baseline.json`(默认不写)。
 *   无基线文件时容量常量 = 423(首跑现读);有基线时容量 = min(423, 基线 prefixHits),
 *   ⇒ `--baseline` 只能收紧、不能抬闸。写盘为确定性 JSON(无时间戳),重复跑字节一致(幂等)。
 *
 * 用法:node scripts/check-web-rn-gap-ratchet.mjs [--json] [--gate] [--baseline] [--staged|--worktree]
 * 退出码:0 全绿 · 1 任一退化 · 2 取不到输入(未判定,§0.3)
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { __test__ as parity } from './check-web-rn-screen-parity.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const BASELINE_REL = 'scripts/data/web-rn-gap-baseline.json'
const BASELINE_PATH = join(ROOT, BASELINE_REL)
const PREFIX_HITS_CAP = 423
/** 与 `check-web-rn-screen-parity.mjs` 的 `DATA_KINDS` 同一集合(该文件未导出,此处只复制词表,不复制判据)。 */
const DATA_KINDS = new Set(['direct', 'indirect', 'static', 'missing'])

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const gateMode = argv.includes('--gate')
const baselineMode = argv.includes('--baseline')
const faceSel = selectFace({
  staged: argv.includes('--staged'),
  worktree: argv.includes('--worktree'),
})
if (faceSel.error) {
  console.error(`❌ ${faceSel.error} ⇒ 未判定,不猜哪一个算`)
  process.exit(2)
}
const FACE = faceSel.face

/**
 * 纯判据:读数 + 容量 ⇒ 判红清单。测试直接喂合成读数,不读盘、不重算覆盖口径。
 * @param {{unmapped:number, judgedGap:number, prefixHits:number, prefixExpired:number, alignedRows:Array<{web?:string,data?:{kind?:string}}>}} readings
 * @param {{prefixCap?:number}} opts
 */
export function judgeRatchet(readings, { prefixCap = PREFIX_HITS_CAP } = {}) {
  const failures = []
  if (!Number.isInteger(readings?.unmapped) || readings.unmapped < 0)
    failures.push({
      rule: 'unmapped-undetermined',
      detail: `unmapped 非自然数:${String(readings?.unmapped)}`,
    })
  else if (readings.unmapped !== 0)
    failures.push({ rule: 'unmapped', detail: `unmapped=${readings.unmapped}(要求 0)` })
  if (!Number.isInteger(readings?.judgedGap) || readings.judgedGap < 0)
    failures.push({
      rule: 'judgedGap-undetermined',
      detail: `judgedGap 非自然数:${String(readings?.judgedGap)}`,
    })
  else if (readings.judgedGap !== 0)
    failures.push({ rule: 'judgedGap', detail: `judgedGap=${readings.judgedGap}(要求 0)` })
  if (!Number.isInteger(readings?.prefixHits) || readings.prefixHits < 0)
    failures.push({
      rule: 'prefixHits-undetermined',
      detail: `prefixHits 非自然数:${String(readings?.prefixHits)}`,
    })
  else if (readings.prefixHits > prefixCap)
    failures.push({
      rule: 'prefixHits',
      detail: `prefixHits=${readings.prefixHits} > 容量 ${prefixCap}(段级豁免不得扩张)`,
    })
  if (!Number.isInteger(readings?.prefixExpired) || readings.prefixExpired < 0)
    failures.push({
      rule: 'prefixExpired-undetermined',
      detail: `prefixExpired 非自然数:${String(readings?.prefixExpired)}`,
    })
  else if (readings.prefixExpired !== 0)
    failures.push({
      rule: 'prefixExpired',
      detail: `prefixExpired=${readings.prefixExpired}(豁免已到期,须复核/续期)`,
    })

  const alignedRows = Array.isArray(readings?.alignedRows) ? readings.alignedRows : null
  if (alignedRows === null)
    failures.push({
      rule: 'aligned-undetermined',
      detail: 'alignedRows 不是数组 ⇒ data.kind 完整性判不了',
    })
  else {
    const bad = alignedRows.filter((r) => !DATA_KINDS.has(r?.data?.kind))
    if (bad.length > 0)
      failures.push({
        rule: 'aligned-data-kind',
        detail: `${bad.length} 条 aligned 缺合法 data.kind(合法值:${[...DATA_KINDS].join('/')})`,
        rows: bad.slice(0, 20).map((r) => ({ web: r?.web ?? null, kind: r?.data?.kind ?? null })),
      })
  }
  return {
    ok: failures.length === 0,
    prefixCap,
    failures,
    aligned: alignedRows?.length ?? 0,
  }
}

/** 读基线;文件在被审面不存在返回 null(默认容量 423)。形态坏 ⇒ 抛错(未判定,不记绿)。 */
function loadBaseline() {
  const specPrefix = FACE === 'head' ? 'HEAD:' : FACE === 'staged' ? ':' : ''
  let text = null
  try {
    if (FACE === 'worktree') text = readWorktreeFile(ROOT, BASELINE_REL)
    else
      text =
        catBatch(ROOT, [specPrefix + BASELINE_REL], { maxBuffer: 1 << 28 }).get(
          specPrefix + BASELINE_REL,
        ) ?? null
  } catch {
    text = null
  }
  if (typeof text !== 'string') return null
  try {
    const doc = JSON.parse(text)
    const n = doc?.readings?.prefixHits
    if (!Number.isInteger(n) || n < 0) throw new Error('readings.prefixHits 缺失或非自然数')
    return doc
  } catch (e) {
    throw new Error(`${BASELINE_REL} 不可用:${e.message}`)
  }
}

/** 确定性序列化(无时间戳/无环境信息)⇒ 重复 --baseline 字节一致。 */
function serializeBaseline(readings, face) {
  const doc = {
    version: 1,
    note: 'web↔RN 缺口棘轮基线:prefixHits 只降不升;重新生成=node scripts/check-web-rn-gap-ratchet.mjs --baseline',
    face,
    readings: {
      unmapped: readings.unmapped,
      judgedGap: readings.judgedGap,
      aligned: readings.aligned,
      prefixHits: readings.prefixHits,
      prefixExpired: readings.prefixExpired,
    },
  }
  return `${JSON.stringify(doc, null, 2)}\n`
}

/** 写基线:内容确定性 ⇒ 重复 `--baseline` 产生同一份字节(幂等)。 */
function writeBaselineIfChanged(readings, face, path = BASELINE_PATH) {
  const text = serializeBaseline(readings, face)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text, 'utf8')
  return { written: true, path, text }
}

/** 既有口径取数(逐行镜像 parity 的 run():同面、同参数、同一 evaluateMap)。 */
function collectReadings(face = FACE) {
  const webRoutes = parity.collectWebRoutes(face)
  const rnScreens = parity.collectRnScreens(face)
  if (webRoutes.length === 0 || rnScreens.length === 0)
    throw new Error(
      `取不到被审面(web 路由 ${webRoutes.length} / RN 屏 ${rnScreens.length})⇒ 未判定`,
    )
  const mapDetail = parity.loadMapDetailed(face)
  if (mapDetail.unreadable) throw new Error(`台账 ${parity.MAP_PATH} 取不到 ⇒ 未判定`)
  const portal = parity.collectPortalRoutes(face)
  if (portal.unreadable) throw new Error('门户表取不到 ⇒ unmapped 判不了,未判定(§0.3)')
  const ev = parity.evaluateMap(
    webRoutes,
    mapDetail.rows,
    rnScreens,
    face,
    portal,
    mapDetail.unreadable,
  )
  const expiry = ev.missingExpiry ?? { items: [] }
  if (Array.isArray(expiry.undetermined) && expiry.undetermined.length > 0)
    throw new Error(`段级豁免到期维未判定:${expiry.undetermined.join(';')}`)
  return {
    face,
    readings: {
      unmapped: ev.unmapped.length,
      judgedGap: ev.judgedGap.length,
      aligned: ev.aligned.length,
      prefixHits: [...ev.prefixHits.values()].reduce((s, n) => s + n, 0),
      prefixExpired: (expiry.items ?? []).filter((x) => x?.why === 'expired').length,
      alignedRows: ev.aligned,
    },
  }
}

function report(face, readings, verdict, baseline) {
  console.log('\n📏 web↔RN 缺口棘轮(复用门 275 的 evaluateMap;只读判据,不重算口径)')
  console.log('─'.repeat(72))
  console.log(`判定面        : ${face}`)
  console.log(`unmapped      : ${readings.unmapped} (要求 0)`)
  console.log(`judgedGap     : ${readings.judgedGap} (要求 0)`)
  console.log(`aligned       : ${readings.aligned} (data.kind 必须完整)`)
  console.log(
    `prefixHits    : ${readings.prefixHits} (容量 ${verdict.prefixCap}${baseline ? ',取自基线' : ',首跑常量'})`,
  )
  console.log(`prefixExpired : ${readings.prefixExpired} (要求 0)`)
  if (verdict.failures.length === 0) {
    console.log('\n✅ 全部棘轮判据在闸内')
  } else {
    console.log(`\n❌ 共 ${verdict.failures.length} 条退化:`)
    for (const f of verdict.failures) console.log(`  ✗ [${f.rule}] ${f.detail}`)
  }
}

function main() {
  const baseline = loadBaseline()
  const baselineCap = baseline ? baseline.readings.prefixHits : null
  const prefixCap = baselineCap === null ? PREFIX_HITS_CAP : Math.min(PREFIX_HITS_CAP, baselineCap)
  const { readings } = collectReadings(FACE)
  const verdict = judgeRatchet(readings, { prefixCap })
  const out = {
    face: FACE,
    readings: {
      unmapped: readings.unmapped,
      judgedGap: readings.judgedGap,
      aligned: readings.aligned,
      prefixHits: readings.prefixHits,
      prefixExpired: readings.prefixExpired,
    },
    baseline: { path: BASELINE_REL, exists: baseline !== null, prefixCap },
    ok: verdict.ok,
    failures: verdict.failures,
  }
  if (baselineMode) {
    const w = writeBaselineIfChanged(readings, FACE)
    out.baseline = { ...out.baseline, written: w.written, path: BASELINE_REL }
  }
  if (jsonMode) console.log(JSON.stringify(out, null, 2))
  else if (gateMode)
    console.log(
      `WEB-RN-GAP-RATCHET unmapped=${readings.unmapped} judgedGap=${readings.judgedGap} aligned=${readings.aligned} prefixHits=${readings.prefixHits}/${prefixCap} prefixExpired=${readings.prefixExpired} -> ${verdict.ok ? '绿' : '红'}`,
    )
  else report(FACE, readings, verdict, baseline)
  return verdict.ok ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ 未判定: ${e?.message ?? e}(取不到输入不记绿也不冒红,§0.3)`)
    process.exit(2)
  }
}

export const __test__ = {
  judgeRatchet,
  loadBaseline,
  serializeBaseline,
  writeBaselineIfChanged,
  DATA_KINDS,
  PREFIX_HITS_CAP,
  BASELINE_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
