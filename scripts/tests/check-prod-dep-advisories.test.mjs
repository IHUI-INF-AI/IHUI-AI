// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 守门 260(生产依赖 critical/high)的镜像测试。
 *
 * 判据本体全部 import 自源脚本的导出纯函数,**不复制一份判据**(§0.6)——
 * 复制品必然漂移,而漂移的判据比没有判据更危险(它给出一个假的绿)。
 *
 * 这一族的错法都是「安静」的,所以每条正例都配反向对照:
 *   · 把 devOnly 判反 ⇒ 构建链的 28 个 critical 全被当成线上 RCE ⇒ 恒红门 ⇒ 全员 --no-verify;
 *   · 把 waiver 当消红通道 ⇒ 豁免永不到期 ⇒ 债永远不还;
 *   · 缓存形态坏时回落「零漏洞」⇒ 最贵的假绿(代码在、判据绿、漏洞照穿)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  evaluateAudit,
  lintPolicy,
  parseCache,
  parsePolicy,
  PolicyShapeError,
} from '../check-prod-dep-advisories.mjs'

const NOW = Date.parse('2026-10-29T00:00:00Z')
const LATER = '2027-01-01'
const EARLIER = '2026-01-01'

const basePolicy = () => ({ floor: ['critical', 'high'], maxCacheAgeDays: 30, waivers: [], malformed: [] })
const row = (module, severity, devOnly = false, extra = {}) => ({
  module,
  severity,
  devOnly,
  title: 'title',
  patched: '>=1',
  ...extra,
})
const waiver = (module, expiresAt, reason = 'x'.repeat(30)) => ({
  module,
  reason,
  expiresAt,
  expiresTs: Date.parse(expiresAt),
  evidence: '',
})

// ── 1. 生产 vs 构建链:这一维判反就是恒红门 ────────────────────────────────
test('生产可达的 critical 无豁免 ⇒ 红', () => {
  const r = evaluateAudit({ rows: [row('bad', 'critical')] }, basePolicy(), { now: NOW })
  assert.equal(r.red.length, 1)
  assert.equal(r.red[0].module, 'bad')
  assert.equal(r.red[0].kind, 'unwaived')
})

test('构建链(devOnly)的 critical 无豁免 ⇒ 不红,只进报数', () => {
  const r = evaluateAudit({ rows: [row('build', 'critical', true)] }, basePolicy(), { now: NOW })
  assert.equal(r.red.length, 0)
  assert.equal(r.devOnlyTotal, 1)
  assert.equal(r.devOnly[0].module, 'build')
})

test('同 module 既有 dev 又有 prod 路径 ⇒ 按生产可达算(保守方向)', () => {
  const r = evaluateAudit(
    { rows: [row('mixed', 'high', true), row('mixed', 'high', false)] },
    basePolicy(),
    { now: NOW },
  )
  assert.equal(r.red.length, 1, '只要有一条生产路径就必须红')
  assert.equal(r.devOnlyTotal, 0, '不能因为有一条 dev 路径就把它算进构建链')
})

test('低于 severityFloor 的档位不进门', () => {
  for (const sev of ['moderate', 'low', 'info']) {
    const r = evaluateAudit({ rows: [row('meh', sev)] }, basePolicy(), { now: NOW })
    assert.equal(r.red.length, 0, `${sev} 不该红`)
    assert.equal(r.devOnlyTotal, 0)
  }
})

test('severityFloor 可收紧到只判 critical', () => {
  const p = { ...basePolicy(), floor: ['critical'] }
  const r = evaluateAudit({ rows: [row('h', 'high'), row('c', 'critical')] }, p, { now: NOW })
  assert.deepEqual(
    r.red.map((x) => x.module),
    ['c'],
  )
})

// ── 2. 豁免:验过才免,且必须会到期 ──────────────────────────────────────
test('有效 waiver 覆盖生产高危 ⇒ 不红,且计入已豁免', () => {
  const p = { ...basePolicy(), waivers: [waiver('ok', LATER)] }
  const r = evaluateAudit({ rows: [row('ok', 'high')] }, p, { now: NOW })
  assert.equal(r.red.length, 0)
  assert.equal(r.waived.length, 1)
  assert.equal(r.waived[0].module, 'ok')
})

test('waiver 过期 ⇒ 红(不是静默失效)', () => {
  const p = { ...basePolicy(), waivers: [waiver('old', EARLIER)] }
  const r = evaluateAudit({ rows: [row('old', 'high')] }, p, { now: NOW })
  assert.equal(r.red.length, 1)
  assert.equal(r.red[0].kind, 'expired-waiver')
})

test('waiver 过期即使该包已不在树里也红 —— 逼着删掉腐烂的豁免', () => {
  const p = { ...basePolicy(), waivers: [waiver('gone', EARLIER)] }
  const r = evaluateAudit({ rows: [] }, p, { now: NOW })
  assert.equal(r.red.length, 1)
  assert.equal(r.red[0].kind, 'expired-waiver')
})

test('同 module 多枚 waiver ⇒ 取到期最晚的那枚(先过期的不得误报)', () => {
  const p = { ...basePolicy(), waivers: [waiver('m', EARLIER), waiver('m', LATER)] }
  const r = evaluateAudit({ rows: [row('m', 'high')] }, p, { now: NOW })
  // 早的那枚仍会被判「过期」——这是刻意的:同一 module 不该留两枚,留了就该被逼清掉
  assert.equal(r.red.filter((x) => x.kind === 'expired-waiver').length, 1)
  assert.equal(r.red.filter((x) => x.kind === 'unwaived').length, 0, '有效那枚必须仍然生效')
})

test('waiver 覆盖的包若只是 devOnly ⇒ 不计入已豁免(避免假绿)', () => {
  const p = { ...basePolicy(), waivers: [waiver('b', LATER)] }
  const r = evaluateAudit({ rows: [row('b', 'high', true)] }, p, { now: NOW })
  assert.equal(r.waived.length, 0, '构建链的包不需要豁免,给它记豁免会掩盖真正的生产包')
})

test('waiver 形态坏 ⇒ 红(不是未判定)', () => {
  const p = { ...basePolicy(), malformed: [{ index: 0, module: 'bad-w', missing: ['reason'] }] }
  const r = evaluateAudit({ rows: [] }, p, { now: NOW })
  assert.equal(r.red.length, 1)
  assert.equal(r.red[0].kind, 'malformed-waiver')
})

// ── 3. 政策解析:缺字段必须进 malformed,不能静默放行 ────────────────────
test('政策:waiver 缺 expiresAt ⇒ malformed', () => {
  const p = parsePolicy(
    JSON.stringify({ severityFloor: ['high'], waivers: [{ module: 'a', reason: 'x'.repeat(30) }] }),
  )
  assert.equal(p.malformed.length, 1)
  assert.ok(p.malformed[0].missing.includes('expiresAt'))
})

test('政策:reason 太短 ⇒ malformed(一个字等于没写理由)', () => {
  const p = parsePolicy(
    JSON.stringify({ severityFloor: ['high'], waivers: [{ module: 'a', reason: '已知', expiresAt: LATER }] }),
  )
  assert.equal(p.malformed.length, 1)
  assert.ok(p.malformed[0].missing.some((m) => m.startsWith('reason')))
})

test('政策:expiresAt 不是日期 ⇒ malformed', () => {
  const p = parsePolicy(
    JSON.stringify({
      severityFloor: ['high'],
      waivers: [{ module: 'a', reason: 'x'.repeat(30), expiresAt: '下个月' }],
    }),
  )
  assert.equal(p.malformed.length, 1)
})

test('政策:缺 severityFloor / waivers ⇒ throw(判未判定,不是判红)', () => {
  assert.throws(() => parsePolicy(JSON.stringify({ waivers: [] })), PolicyShapeError)
  assert.throws(() => parsePolicy(JSON.stringify({ severityFloor: ['high'] })), PolicyShapeError)
  assert.throws(() => parsePolicy('not json'), PolicyShapeError)
})

test('政策:maxCacheAgeDays 非法时回落 30 天,不变成 0', () => {
  for (const bad of [0, -1, 'abc', null]) {
    const p = parsePolicy(JSON.stringify({ severityFloor: ['high'], waivers: [], maxCacheAgeDays: bad }))
    assert.equal(p.maxCacheAgeDays, 30, String(bad))
  }
})

// ── 4. 快照解析:形态坏必须抛,让调用方判未判定 ──────────────────────────
test('快照:缺 fetchedAt / rows ⇒ throw', () => {
  assert.throws(() => parseCache(JSON.stringify({ rows: [] })), PolicyShapeError)
  assert.throws(() => parseCache(JSON.stringify({ fetchedAt: new Date().toISOString() })), PolicyShapeError)
  assert.throws(() => parseCache('not json'), PolicyShapeError)
})

test('快照:合法形态能解析出 rows 与时间戳', () => {
  const iso = '2026-10-29T00:00:00.000Z'
  const c = parseCache(JSON.stringify({ fetchedAt: iso, rows: [row('a', 'high')] }))
  assert.equal(c.rows.length, 1)
  assert.equal(c.fetchedTs, Date.parse(iso))
})

// ── 5. lintPolicy(提交链档) ─────────────────────────────────────────────
test('lintPolicy:干净的豁免清单 ⇒ 零问题', () => {
  const p = parsePolicy(
    JSON.stringify({ severityFloor: ['high'], waivers: [{ module: 'a', reason: 'x'.repeat(30), expiresAt: LATER }] }),
  )
  assert.deepEqual(lintPolicy(p, NOW), [])
})

test('lintPolicy:过期与形态坏都要点名', () => {
  const p = parsePolicy(
    JSON.stringify({
      severityFloor: ['high'],
      waivers: [
        { module: 'old', reason: 'x'.repeat(30), expiresAt: EARLIER },
        { module: 'broken', reason: '短', expiresAt: LATER },
      ],
    }),
  )
  const problems = lintPolicy(p, NOW)
  assert.equal(problems.length, 2)
  assert.ok(problems.some((s) => s.includes('old') && s.includes('到期')))
  assert.ok(problems.some((s) => s.includes('broken')))
})

// ── 6. 排序与稳定性 ─────────────────────────────────────────────────────
test('红条目按 severity 降序(先看 critical)', () => {
  const r = evaluateAudit(
    { rows: [row('h1', 'high'), row('c1', 'critical'), row('h2', 'high')] },
    basePolicy(),
    { now: NOW },
  )
  assert.equal(r.red[0].severity, 'critical')
  assert.equal(r.red[0].module, 'c1')
})

test('空树 ⇒ 绿(零漏洞是合法结论,不是未判定)', () => {
  const r = evaluateAudit({ rows: [] }, basePolicy(), { now: NOW })
  assert.equal(r.red.length, 0)
  assert.equal(r.devOnlyTotal, 0)
  assert.equal(r.prodTotal, 0)
})
