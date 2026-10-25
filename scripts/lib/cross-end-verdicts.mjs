// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端镜像「判定台账」——"这一格已验过"这件事本身的可持久侧车(AGENTS §0.6 单一真相源)。
//
// 为什么要有它:门 128 的"未判定"只说明"没人验过";而验过的结论(小程序端缺页 / 该屏不该由
// 小程序承载)若只活在临时提案件里,下一轮缺口账本又要从零重判 —— 一个人类读 100 屏的成本
// 远高于一行台账。台账把"判过"变成仓内可消费的数据:缺口账本生成器读它,才能把
// 「未判定」与「已判定(缺页/不承载)」分开 —— 混在一起就等于把"没人验过"记成"验过没发现"。
//
// 形态:JSONL,一行一屏,键 = 共享屏 spec(与 scripts/data/cross-end-screen-registry.json 的
// shared 同一键空间)。只有"验过但没落地代码"的两档才进台账:
//   {"shared":"packages/app/src/features/x/XScreen.tsx","verdict":"missing",
//    "evidence":"<带文件:行号的证据>","at":"2026-10-25","source":"miniapp-batch-1.json"}
//   verdict=missing        小程序端确实没有对应页(该造页)
//   verdict=not-applicable 该屏本就不该由小程序承载(不造页)
// `declare` 档不进台账 —— 它直接落成标记行 + registry 条目,落点本身就是凭据。
//
// 幂等:同一 shared 以最后写入者为准(同屏以本批为准);写盘口径 = HEAD 面 ∪ 工作树面 ∪ 本批。

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/**
 * 台账路径 —— **全仓唯一一份**。登记器写它、缺口账本读它、漂移尺报它。
 * 谁再写一遍字面量,谁就在造第二份真相源(§0.6:第二份必然漂移)。
 */
export const VERDICTS_PATH = 'scripts/data/miniapp-mirror-verdicts.jsonl'

/** 允许进台账的判定档。`declare` 不在其中:它落代码,不落台账。 */
export const VERDICT_KINDS = Object.freeze(['missing', 'not-applicable'])

/**
 * 解析台账文本。坏行**不静默丢**:单独归入 bad 并带原因(§0.3「没判不写成判过」——
 * 坏行若被悄悄跳过,台账看起来是"验过",实际是"读不出来")。
 * @returns {{rows: object[], bad: {raw: string, why: string}[]}}
 */
export function parseVerdictRows(text) {
  const rows = []
  const bad = []
  for (const line of String(text || '').split('\n')) {
    const s = line.trim()
    if (!s) continue
    let obj
    try {
      obj = JSON.parse(s)
    } catch {
      bad.push({ raw: s, why: '非 JSON' })
      continue
    }
    if (!obj || typeof obj !== 'object' || typeof obj.shared !== 'string' || !obj.shared) {
      bad.push({ raw: s, why: '缺 shared 键' })
      continue
    }
    if (!VERDICT_KINDS.includes(obj.verdict)) {
      bad.push({ raw: s, why: `verdict 非法:${String(obj.verdict)}` })
      continue
    }
    rows.push(obj)
  }
  return { rows, bad }
}

/**
 * 读某一面的台账。
 * 取材面纪律(§0.4):默认 HEAD blob;--staged 判索引;--worktree 仅人工逃生舱。
 * **取不到就是取不到**:该面没有这份件 ⇒ text=null、rows=[],**不回落另一个面**
 * (回落会把"工作树没落"读成"台账是空",于是缺口账本把已验过的屏重新列成待判)。
 * @returns {{text: string|null, rows: object[], bad: {raw: string, why: string}[]}}
 */
export function readVerdicts(face = 'head', root = ROOT) {
  const rel = VERDICTS_PATH.replace(/\\/g, '/')
  if (face === 'worktree') {
    const p = join(root, rel)
    if (!existsSync(p)) return { text: null, rows: [], bad: [] }
    const text = readFileSync(p, 'utf8')
    return { text, ...parseVerdictRows(text) }
  }
  const spec = face === 'staged' ? `:${rel}` : `HEAD:${rel}`
  try {
    const text = execFileSync('git', ['-C', root, 'show', spec], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 16 * 1024 * 1024,
    })
    return { text, ...parseVerdictRows(text) }
  } catch {
    // 该面没有这份件 = 台账还是空的,不是"未判定"。两者都要如实说,不能混。
    return { text: null, rows: [], bad: [] }
  }
}

/**
 * 按 shared 归并:已有行(HEAD ∪ 工作树)∪ 本批,同屏以本批为准。
 * @param {object[]} existing 已存在的行
 * @param {object[]} batch 本批要落的行
 * @returns {{rows: object[], added: number, total: number}} added = 新增键数(改写不计入新增)
 */
export function mergeVerdictRows(existing, batch) {
  const byKey = new Map()
  for (const r of existing) {
    if (r && typeof r.shared === 'string') byKey.set(r.shared, r)
  }
  let added = 0
  for (const r of batch) {
    if (!r || typeof r.shared !== 'string' || !r.shared) continue
    if (!byKey.has(r.shared)) added++
    byKey.set(r.shared, r)
  }
  return { rows: [...byKey.values()], added, total: byKey.size }
}

/**
 * 台账序列化:一行一 JSON,键序固定(shared, verdict, evidence, at, source)。
 * 固定键序是为了让 diff 只随内容变、不随写入方变(否则同一份台账两次落盘长得不一样,
 * 门 71 的"逐字节相同"判据与 git diff 都会被噪声淹没)。
 */
export function serializeVerdicts(rows) {
  return rows
    .map((r) =>
      JSON.stringify({
        shared: r.shared,
        verdict: r.verdict,
        evidence: r.evidence || '',
        at: r.at || '',
        source: r.source || '',
      }),
    )
    .join('\n')
}

/** 按 shared 建索引,供缺口账本 O(1) 查"这一格判过没有"。 */
export function indexVerdicts(rows) {
  const m = new Map()
  for (const r of rows || []) {
    if (r && typeof r.shared === 'string') m.set(r.shared, r)
  }
  return m
}

/** §22c 三步之①:源脚本导出 __test__,镜像测试直接用生产判据。 */
export const __test__ = {
  VERDICTS_PATH,
  VERDICT_KINDS,
  parseVerdictRows,
  mergeVerdictRows,
  serializeVerdicts,
  indexVerdicts,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
