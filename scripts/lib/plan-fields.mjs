// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账结构化侧车(2026-10-22 立)。规格:
 * `docs/superpowers/specs/2026-10-22-plan-ledger-schema-design.md` §1。
 *
 * 为什么侧车必须在仓内而不是 `.ihui-agent/state/`:归属/等待是**判据输入**,不是留痕。
 * 判定要能被任何席位当场复算(§0.1 数字一律现读、§0.6 单一真相源);gitignored 面会让
 * "A 席写了字段、B 席看不见",同一行被两个席位判成两个桶 —— 那比散文还难查。
 *
 * 侧车只增不删。要删记录必须走器物,并把被改写的旧行逐字写进 `plan-row-drop.jsonl`
 * (抗回潮杠杆:滞后工作树副本会把旧行带回,只有声明过的形态挡得住)。
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { compositeKeyOf } from './plan-task-index.mjs'

export const FIELDS_REL = path.join('scripts', 'data', 'plan-fields.jsonl')
const WAITING = new Set(['none', 'human', 'env'])
const OPTIONAL_KEYS = [
  'owner',
  'waiting',
  'blocking',
  'next',
  'evidence',
  'reviewBy',
  'updatedAt',
  'updatedBy',
]

/** 校验一条记录。值域外一律拒收并点名原因 —— 绝不猜默认值(§0.3)。 */
export function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { ok: false, why: '记录不是对象' }
  if (typeof raw.key !== 'string' || raw.key.trim() === '')
    return { ok: false, why: '缺 key(记录必须可寻址)' }
  if (!('waiting' in raw))
    return { ok: false, why: '缺 waiting(不能默认成 none,那会把"没填"说成"不等任何东西")' }
  if (!WAITING.has(raw.waiting))
    return { ok: false, why: `waiting 值域外:${raw.waiting}(只许 none|human|env)` }
  if (typeof raw.updatedAt !== 'string' || Number.isNaN(Date.parse(raw.updatedAt)))
    return { ok: false, why: 'updatedAt 不可解' }
  if (
    raw.evidence !== undefined &&
    (!Array.isArray(raw.evidence) || raw.evidence.some((x) => typeof x !== 'string'))
  )
    return { ok: false, why: 'evidence 必须是字符串数组(它是将来跑判据的凭据面)' }
  const rec = { key: raw.key.trim() }
  for (const k of OPTIONAL_KEYS) if (raw[k] !== undefined) rec[k] = raw[k]
  // 归一:owner/blocking 里的 `…` 是"原文已截断"的痕迹,不得进入判定面 ——
  // 投影写出含 `…` 的标头后 parseHeader 必判 malformed(门 234 A2 永久红;
  // 2026-10-25 实测 G-47/G-48/G-49)。去省略号、保留已知前缀(与抽取器 cleanOwner 同口径)。
  for (const k of ['owner', 'blocking']) {
    if (typeof rec[k] === 'string' && rec[k].includes('…')) rec[k] = rec[k].replace(/…/g, '').trim()
  }
  return { ok: true, rec }
}

/**
 * 读整份侧车。三态分明:
 *  - `text === null` ⇒ 显式取不到面 ⇒ `undetermined: true`(调用方不得当成"没有字段所以都 actionable");
 *  - `text === undefined` ⇒ 去 `root` 下读文件,读不到同样落 undetermined;
 *  - 空文本 ⇒ **不是**未判定,是"零条记录"(两者混淆会把"侧车还没建"报成"侧车判过了")。
 */
export function loadFields(root = process.cwd(), text = undefined) {
  let src = text
  if (src === undefined) {
    try {
      src = readFileSync(path.join(root, FIELDS_REL), 'utf8')
    } catch (e) {
      return {
        map: new Map(),
        malformed: 0,
        orphans: [],
        undetermined: true,
        why: `取不到侧车:${String(e?.code ?? e)}`,
      }
    }
  }
  if (src === null)
    return {
      map: new Map(),
      malformed: 0,
      orphans: [],
      undetermined: true,
      why: '取不到侧车面(显式传 null)',
    }

  const map = new Map()
  const orphans = []
  let malformed = 0
  for (const line of src.split('\n')) {
    if (line.trim() === '') continue
    let parsed
    try {
      parsed = JSON.parse(line)
    } catch {
      malformed++
      continue
    }
    const n = normalizeRecord(parsed)
    if (!n.ok) {
      malformed++
      continue
    }
    const prev = map.get(n.rec.key)
    if (!prev) {
      map.set(n.rec.key, n.rec)
      continue
    }
    // 同键多份:取最新,其余进 orphans 报名 —— 静默 last-wins 会让"谁改的"查不出来
    if (Date.parse(n.rec.updatedAt) > Date.parse(prev.updatedAt)) {
      map.set(n.rec.key, n.rec)
      orphans.push(prev)
    } else orphans.push(n.rec)
  }
  return { map, malformed, orphans, undetermined: false }
}

/**
 * 行 → 侧车记录。**查找键 = `compositeKeyOf`(编号 + 标题前缀逐字)**,与
 * `scripts/data/plan-merge-adjudications.json` 同口径 —— 用裸编号会跨行串号(同号多题正是本仓的既有形态)。
 * 复合主键取不到时走 `T:<sha1>` 兜底键,但 `keyKind='rowhash'` 的记录**不得充当归属权威**
 * (行本体重写一次兜底键就换人,会留下孤儿记录;孤儿由门报数,不判红)。
 */
export function fieldsFor({ line, map }) {
  const ck = compositeKeyOf(line)
  const key = ck ?? 'T:' + createHash('sha1').update(String(line).trim()).digest('hex').slice(0, 16)
  return { rec: map?.get(key) ?? null, key, keyKind: ck ? 'id' : 'rowhash' }
}

export const __test__ = { normalizeRecord, loadFields, fieldsFor, FIELDS_REL, WAITING }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
