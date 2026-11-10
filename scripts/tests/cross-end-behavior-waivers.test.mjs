// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * cross-end-behavior-waivers 台账体检(黑盒形态 + 证据落点)。
 *
 * 台账 scripts/data/cross-end-behavior-waivers.jsonl 记的是「共享屏行为型 prop 单端缺席」的
 * 在册容忍。它刻意不进门 288 的 judged 账(门 288 只判同名组件对,且其口径是平台差异不挂账)。
 * 本测试守三件事,防止台账退化成免责名单:
 *   1. 结构:九条固定席位、字段齐全、side 合法、reason 不是一句话敷衍;
 *   2. 时效:expires 未到期 —— 到期即回未裁队列,必须重新裁决而不是续一条新日期;
 *   3. 证据:至少 2 条 文件:行、覆盖 rn 与 mini 两端、且有一条落在 packages/types/src
 *      的声明行并真含该 prop 名(防拿两枚无关行凑数)。
 *
 * 行数写死不从宽:台账的语义是「这 9 条已逐条裁决」,多一条少一条都必须同步改断言并留证据。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LEDGER = 'scripts/data/cross-end-behavior-waivers.jsonl'
const SIDES = new Set(['rn', 'mini'])
const END_ROOTS = { rn: ['apps/mobile-rn/', 'packages/app/'], mini: ['apps/miniapp-taro/'] }
const DECL_ROOT = 'packages/types/src/'

function readEntries() {
  const raw = readFileSync(resolve(ROOT, LEDGER), 'utf8')
  const entries = []
  raw.split(/\r?\n/).forEach((line, i) => {
    const text = line.trim()
    if (!text || text.startsWith('//')) return
    try {
      entries.push(JSON.parse(text))
    } catch (e) {
      assert.fail(`${LEDGER}:${i + 1} 不是合法 JSON(${e.message})`)
    }
  })
  return entries
}

function parsePoint(raw) {
  const m = typeof raw === 'string' ? raw.match(/^([^\s:]+):(\d+)(?:-(\d+))?$/) : null
  if (!m) return null
  return { rel: m[1], start: Number(m[2]), end: m[3] ? Number(m[3]) : Number(m[2]) }
}

test('跨端行为容忍台账:九条席位、未过期、证据双端且声明侧含键名', () => {
  const entries = readEntries()
  assert.equal(entries.length, 9, '台账席位固定为 9;增删必须同轮改本断言并给出新证据')

  const bad = []
  const seen = new Set()
  const now = Date.now()

  entries.forEach((e, i) => {
    const at = `entries[${i}](${String(e?.screen)}/${String(e?.prop)})`
    for (const f of ['screen', 'prop', 'side', 'reason', 'owner', 'expires'])
      if (typeof e?.[f] !== 'string' || !e[f].trim()) bad.push(`${at}: 缺 ${f}(必填)`)
    if (!SIDES.has(e?.side)) bad.push(`${at}: side=${String(e?.side)} 不在 rn|mini`)
    if (typeof e?.reason === 'string' && e.reason.trim().length < 24)
      bad.push(`${at}: reason 过短(< 24 字),写清为什么该端做不了而不是抄 prop 名`)

    const expiresRaw = typeof e?.expires === 'string' ? e.expires.trim() : ''
    const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) ? new Date(`${expiresRaw}T23:59:59`) : null
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) bad.push(`${at}: expires 不是 YYYY-MM-DD`)
    else if (expiresAt.getTime() < now) bad.push(`${at}: expires 已到期(${expiresRaw})——回未裁队列重新裁决`)

    const dedupe = `${e?.screen}|${e?.prop}|${e?.side}`
    if (seen.has(dedupe)) bad.push(`${at}: 重复席位 ${dedupe}`)
    seen.add(dedupe)

    const evidence = Array.isArray(e?.evidence) ? e.evidence : []
    if (evidence.length < 2) bad.push(`${at}: evidence 不足 2 条`)

    const ends = new Set()
    let declHit = false
    for (const raw of evidence) {
      const p = parsePoint(raw)
      if (!p) {
        bad.push(`${at}: evidence 不是 文件:行 形态:${String(raw)}`)
        continue
      }
      if (p.start < 1 || p.start > p.end) {
        bad.push(`${at}: evidence 行号非法:${raw}`)
        continue
      }
      let text
      try {
        text = readFileSync(resolve(ROOT, p.rel), 'utf8')
      } catch {
        bad.push(`${at}: evidence 读不到:${p.rel}`)
        continue
      }
      const lines = text.split(/\r?\n/)
      if (p.end > lines.length) {
        bad.push(`${at}: evidence 行号越界:${raw}(共 ${lines.length} 行)`)
        continue
      }
      for (const [end, roots] of Object.entries(END_ROOTS))
        if (roots.some((r) => p.rel.startsWith(r))) ends.add(end)
      if (
        p.rel.startsWith(DECL_ROOT) &&
        typeof e?.prop === 'string' &&
        new RegExp(`\\b${e.prop}\\b`).test(lines[p.start - 1])
      )
        declHit = true
    }
    if (ends.size < 2) bad.push(`${at}: evidence 未覆盖双端(需 rn 与 mini 各至少 1 条)`)
    if (!declHit) bad.push(`${at}: 无证据落在 ${DECL_ROOT} 的声明行且真含键名 ${String(e?.prop)}`)
  })

  assert.deepEqual(bad, [], `台账坏条目:\n${bad.join('\n')}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
