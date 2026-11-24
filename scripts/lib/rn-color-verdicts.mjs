// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// rn-color-verdicts.mjs — 色值具名裁决台账判据单源(门 255 歧义收口的候选尺与等值尺)。
// ⚠️ 现状边界:`ledgerAudit`(E1–E4 卫生判据)当前**尚未接线** —— 全仓除自身自检与 `__test__`
// 导出外零调用。不要按"已有某道门在消费它"去读(AGENTS §0.9:造好没装车 = 没有);要启用请先
// 接线并登记门号。头注详见段尾追加块。
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as tok93 } from '../check-cross-end-tokens.mjs'

export const VERDICTS_REL = 'scripts/data/rn-color-verdicts.json'
const DEFAULT_LIFETIME_DAYS = 60
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// 读台账:缺件 ⇒ 合法空表;坏件 ⇒ unjudged(§0.3)
export function loadVerdicts(root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')) {
  const file = join(root, VERDICTS_REL)
  if (!existsSync(file)) return { ok: true, entries: [], missing: true, reason: '台账未建(结构上还没有一次裁决登记)' }
  let parsed
  try { parsed = JSON.parse(readFileSync(file, 'utf8')) } catch (e) {
    return { ok: false, unjudged: true, entries: [], reason: `台账不可解析:${String(e?.message ?? e).slice(0, 80)}` }
  }
  if (!Array.isArray(parsed.entries)) return { ok: false, unjudged: true, entries: [], reason: '缺 entries 数组 ⇒ 形状不合,不回落 0 条' }
  return parseVerdicts(parsed)
}

export function entryShapeProblem(e) {
  if (!e || typeof e !== 'object') return '非对象行'
  for (const k of ['id', 'expires', 'owner', 'why', 'value']) {
    if (typeof e[k] !== 'string' || !e[k].trim()) return `缺必填 ${k}`
  }
  if (e.property !== null && (typeof e.property !== 'string' || !/^[A-Za-z_]\w*$/.test(e.property))) {
    return `property 非标识符或 null:${e.property}`
  }
  if (typeof e.key !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(e.key)) return `非法档名 key:${e.key}`
  if (!DATE_RE.test(e.expires)) return `expires 须 YYYY-MM-DD:${e.expires}`
  if (e.why.replace(/\s+/g, '').length < 12) return `裁决理由 <12 字:${e.why}`
  if (!hasScope(e)) return '缺定位:必须给 path(整文件裁)或 scope+property(目录/文件+样式键槽位)'
  return ''
}

// 匹配尺唯一出口(器物与验证器都经这里,不在两处各写一份前缀判断,§0.6)
export function hasScope(e) {
  return !!(typeof e.path === 'string' && e.path.trim()) || !!(Array.isArray(e.scope) && e.scope.length)
}

export function scopeHits(e, rel) {
  if (typeof e.path === 'string' && e.path.trim() === rel) return true
  if (Array.isArray(e.scope)) return e.scope.some((p) => typeof p === 'string' && p.trim() && (rel === p.trim() || rel.startsWith(p.trim().replace(/\/+$/, '') + '/')))
  return false
}

export function verdictApplies(e, site, cands, now = new Date()) {
  if (e.property !== null && e.property !== site.property) return { applies: false, why: 'slot' }
  if (expiredBy(e.expires, now)) return { applies: false, why: 'expired' }
  if (!scopeHits(e, site.rel)) return { applies: false, why: 'scope' }
  if (tok93.normalizeColor(e.value) !== tok93.normalizeColor(site.raw)) return { applies: false, why: 'value' }
  if (!cands?.some((c) => c.key === e.key)) return { applies: false, why: 'not-candidate', detail: `裁档 ${e.key} 不在当前候选` }
  const rec = cands.find((c) => c.key === e.key)
  if (rec && !tok93.colorsAgree(site.raw, rec.light)) return { applies: false, why: 'not-equal', detail: '值漂(裁的档现值≠原字面量)' }
  return { applies: true, entry: e, rec }
}

export function expiredBy(iso, now = new Date()) {
  const t = new Date(`${iso}T23:59:59Z`)
  return !Number.isNaN(t.getTime()) ? t.getTime() < now.getTime() : true
}

/** 裁决腿(纯函数不写盘):歧义位点命中唯一裁定 ⇒ 锁裁档;命中多条 ⇒ 维持歧义+conflicts(绝不择一)。 */
export function applyVerdicts(sites, byNorm, entries, now = new Date()) {
  const applied = []
  const conflicts = []
  const offFace = []
  const invalid = []
  const out = sites.map((s) => {
    if (!s.ambiguous) return s
    const cands = byNorm.get(tok93.normalizeColor(s.raw)) ?? []
    const hits = []
    for (const e of entries) {
      const v = verdictApplies(e, s, cands, now)
      if (v.applies) hits.push(v)
      else if (v.why === 'scope' || v.why === 'value') continue
      else invalid.push({ id: e.id, rel: s.rel, line: s.line, why: v.why, detail: v.detail ?? '', key: e.key })
    }
    if (hits.length > 1) {
      conflicts.push({ rel: s.rel, line: s.line, raw: s.raw, ids: hits.map((h) => h.entry.id) })
      return s
    }
    if (hits.length === 0) return s
    const h = hits[0]
    const rec = h.rec
    applied.push({ id: h.entry.id, rel: s.rel, line: s.line, raw: s.raw, key: rec.key })
    return {
      ...s,
      key: rec.key,
      value: rec.light,
      same: rec.same,
      needsTheme: !rec.same,
      ambiguous: false,
      candCount: 1,
      decidedBy: h.entry.id,
    }
  })
  const hit = new Set(applied.map((a) => a.id))
  const seenInvalid = new Set(invalid.map((x) => x.id))
  for (const e of entries) {
    if (!hit.has(e.id)) {
      const badHere = invalid.find((x) => x.id === e.id)
      if (!seenInvalid.has(e.id) || badHere?.why === 'expired') offFace.push({ id: e.id, expired: expiredBy(e.expires, now), owner: e.owner, key: e.key })
    }
  }
  return { sites: out, applied, conflicts, offFace, invalid }
}

/** 账本三态(pending / landed / invalid / expired-stale):器物 `--check` 经此一份尺,不各抄。**当前无门在跑这份审计**(见头注),谁接线谁登记门号。 */
export function ledgerAudit(entries, res, now = new Date()) {
  const hitOf = {}
  const invalidOf = {}
  for (const a of res.applied ?? []) hitOf[a.id] = (hitOf[a.id] ?? 0) + 1
  for (const x of res.invalid ?? []) if (x.why !== 'expired') invalidOf[x.id] = x.why
  const rows = entries.map((e) => {
    const hits = hitOf[e.id] ?? 0
    const bad = invalidOf[e.id]
    const exp = expiredBy(e.expires, now)
    const state = bad ? 'invalid' : hits > 0 ? 'pending' : exp ? 'expired-stale' : 'landed'
    return { id: e.id, state, hits, expired: exp, owner: e.owner, expires: e.expires, why: bad ?? '', key: e.key }
  })
  const red = rows.filter((r) => r.state === 'invalid').length + rows.filter((r) => r.state === 'expired-stale').length
  return { rows, red, pending: rows.filter((r) => r.state === 'pending').length, landed: rows.filter((r) => r.state === 'landed').length }
}

/** 族名唯一真相源(门 108 同族纪律:改处只此一处,不得在别处抄第二份 60)。 */
export const FAMILY = 'rn-color-verdict'
export const FAMILY_LIFETIME_DAYS = DEFAULT_LIFETIME_DAYS

/** 形状校验唯一一份(坏行逐条点名;id 重复只留首条并点名重复,绝不静默择一)。 */
function parseVerdicts(parsed) {
  if (!parsed || !Array.isArray(parsed.entries)) return { ok: false, unjudged: true, entries: [], reason: '缺 entries 数组 ⇒ 形状不合,不回落 0 条' }
  const entries = []
  const bad = []
  for (const [i, e] of parsed.entries.entries()) {
    const err = entryShapeProblem(e)
    if (err) { bad.push({ i, why: err }); continue }
    if (entries.some((x) => x.id === e.id)) { bad.push({ i, why: `id 重复:${e.id}` }); continue }
    entries.push(e)
  }
  if (bad.length) return { ok: false, unjudged: true, entries: [], bad, reason: `台账 ${bad.length} 行形状坏/重复` }
  return { ok: true, unjudged: false, entries, rule: parsed.rule ?? '' }
}

function selfTest() {
  const WHITE = tok93.normalizeColor('#ffffff')
  const byNorm = new Map([[WHITE, [
    { key: 'dangerForeground', light: '#ffffff', dark: '#ffffff', same: true },
    { key: 'surfaceLight', light: '#ffffff', dark: '#ffffff', same: true },
  ]]])
  const site = () => ({ rel: 'a/x.tsx', property: 'badgeText', line: 1, raw: '#FFFFFF', ambiguous: true, candCount: 2, key: 'dangerForeground', value: '#fff', needsTheme: false })
  const ent = (o = {}) => ({ property: 'badgeText', id: 'vc-a', value: '#ffffff', key: 'dangerForeground', why: '红底徽章白字取 danger 前景', owner: 't', expires: '2027-01-01', path: 'a/x.tsx', ...o })
  const ok = []
  const push = (n, c) => ok.push(`${c ? 'PASS' : 'FAIL'} ${n}`)
  const r1 = applyVerdicts([site()], byNorm, [ent()], new Date('2026-12-01'))
  push('R1 命中唯一裁⇒转 safe', r1.sites[0].ambiguous === false && r1.applied.length === 1)
  const r2 = applyVerdicts([site()], byNorm, [ent({ id: 'vc-b', key: 'surfaceLight' }), ent()], new Date('2026-12-01'))
  push('R2 双裁点名', r2.conflicts.length === 1)
  const r3 = applyVerdicts([site()], byNorm, [ent({ id: 'vc-c', key: 'ghost' })], new Date('2026-12-01'))
  push('R3 裁不存在档⇒invalid', r3.invalid.some((x) => x.why === 'not-candidate'))
  const r4 = applyVerdicts([site()], byNorm, [ent({ id: 'vc-e', expires: '2026-11-01' })], new Date('2026-12-01'))
  push('R4 过期不生效', r4.sites[0].ambiguous === true)
  push('R5 shape 缺字段点名', !!entryShapeProblem({ id: 'x' }))
  const au = ledgerAudit([ent(), ent({ id: 'vc-q', expires: '2026-11-01' })], r1, new Date('2026-12-01'))
  push('R6 pending+过期死条目', au.pending === 1 && au.red === 1)
  const fail = ok.filter((s) => s.startsWith('FAIL')).length
  for (const s of ok) console.log(s)
  console.log(fail ? `SELF-TEST FAILED ${ok.length - fail}/${ok.length}` : `SELF-TEST PASS all ${ok.length}`)
  process.exit(fail ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  if (process.argv.includes('--self-test')) selfTest()
  else console.log('用法:node scripts/lib/rn-color-verdicts.mjs --self-test(判据单源;已接线消费方=scripts/fix-rn-color-literals.mjs)')
}

export const __test__ = { loadVerdicts, parseVerdicts, entryShapeProblem, hasScope, scopeHits, verdictApplies, applyVerdicts, ledgerAudit, expiredBy, VERDICTS_REL }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
