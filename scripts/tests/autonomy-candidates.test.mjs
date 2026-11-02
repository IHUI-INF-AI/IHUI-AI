// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `autonomy-candidates.mjs` 镜像测试(§22c:判据一律 import 源脚本 `__test__`,本文件零复制判据)。
 *
 * 钉六环:
 *  ① 因子键集与策略逐键对上(多一个少一个都是形状坏),产出必须过决策器形状锁;
 *  ② 九个因子的分档与 evidence(每个 evidence 必须点名"命中了哪个词/哪条路径/多少小时");
 *  ③ 票键契约:id 必须等于 ticketKeyOf(票面),否则 rankTicketRows 接不回派单面行;
 *  ④ 端到端:本器产出的文件内容喂给真消费者 rankTicketRows,必须进入 decision 模式;
 *  ⑤ 确定性与同票键去重(重复 id 会让决策器整轮判形状坏);
 *  ⑥ CLI 自检末行(不 spawn 派单面 —— plan-tasks 现读要 70s+,单测不背这个耗时)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as ac } from '../autonomy-candidates.mjs'
import { __test__ as ae } from '../auto-evolve.mjs'
import { __test__ as ad } from '../autonomy-decision.mjs'
import { ticketKeyOf } from '../lib/ticket-key.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'autonomy-candidates.mjs')
const POLICY = ad.loadPolicy(readFileSync(ad.POLICY_PATH, 'utf8'))
const MAX = POLICY.scales.levelMax
const NOW = Date.parse('2026-11-01T12:00:00.000Z')
const CTX = { policy: POLICY, ledger: [], now: NOW, lastActivityAt: new Map() }

const rows = () => [
  { line: 11, text: '**改 apps/web/src/app/page.tsx 文案** 顺手补 scripts/tests/x.test.mjs' },
  { line: 12, text: '**改 AGENTS.md 的判据段** 并动 scripts/check-plan-fields.mjs' },
  { line: 13, text: '**轮换生产凭据** 并物理删除旧表(不可逆)' },
]

test('① 因子键集与策略逐键对上,产出过决策器形状锁', () => {
  const built = ac.buildCandidates({ rows: rows(), policy: POLICY, ledger: [], now: NOW })
  const evidenceKeys = Object.keys(built.candidates[0].evidence).sort()
  const want = Object.values(ad.FACTOR_KEYS).flat().sort()
  assert.deepEqual(evidenceKeys, want, '每个因子都必须有 evidence,且键集恰为策略因子键集')
  assert.equal(ad.validateCandidates(built.candidates, POLICY).length, 3, '产出必须过决策器形状锁')
  for (const c of built.candidates) {
    for (const key of want) assert.ok(c.evidence[key] && c.evidence[key].length > 0, `${key} 的 evidence 不得为空`)
  }
})

test('② 九因子分档:结构性证据 → 档位,evidence 点名依据', () => {
  const cases = [
    ['impact', ac.factorImpact('改一句文案', MAX), (v) => v.level === 0 && /未命中/.test(v.evidence)],
    ['impact', ac.factorImpact('部署 守门 判据 凭据', MAX), (v) => v.level === 3 && /部署/.test(v.evidence)],
    ['userValue', ac.factorUserValue('改 apps/web 页面', MAX), (v) => v.level === 2 && /apps\/web/.test(v.evidence)],
    ['userValue', ac.factorUserValue('改 apps/web 与 apps/mobile', MAX), (v) => v.level === 3],
    ['userValue', ac.factorUserValue('改 scripts/plan-tasks.mjs', MAX), (v) => v.level === 0],
    ['userValue', ac.factorUserValue('GET /api/app-version/latest 返 404', MAX), (v) => v.level === 2 && /\/api\//.test(v.evidence)],
    ['irreversible', ac.factorIrreversible('做一次数据迁移', MAX), (v) => v.level === 1],
    ['irreversible', ac.factorIrreversible('迁移并删除旧表再轮换口令', MAX), (v) => v.level === 2],
    ['irreversible', ac.factorIrreversible('物理删除历史数据', MAX), (v) => v.level === 3 && /物理删除/.test(v.evidence)],
    ['externalDependency', ac.factorExternal('等机主拍板', MAX), (v) => v.level === 1 && /机主/.test(v.evidence)],
    ['externalDependency', ac.factorExternal('机主审批后去第三方控制台配域名', MAX), (v) => v.level === 3],
    ['ruleTouch', ac.factorRuleTouch('补 AGENTS.md 的判据段', MAX), (v) => v.level === 3 && /AGENTS\.md/.test(v.evidence)],
    ['ruleTouch', ac.factorRuleTouch('按守门判据补一段说明', MAX), (v) => v.level === 2],
    ['changeSurface', ac.factorChangeSurface('改 apps/web/a.tsx', MAX), (v) => v.level === 1],
    ['changeSurface', ac.factorChangeSurface('a.mjs b.ts c.json d.sql 四处', MAX), (v) => v.level === 3 && /4 条/.test(v.evidence)],
    ['blockingOthers', ac.factorBlocking('这张票挡住另外两张', MAX), (v) => v.level === 3 && /挡住/.test(v.evidence)],
    ['blockingOthers', ac.factorBlocking('在等上游未落地', MAX), (v) => v.level === 1],
  ]
  for (const [name, got, ok] of cases) assert.ok(ok(got), `${name} 分档不符:${JSON.stringify(got)}`)

  // 验证时长与租约:模型口径是分钟/小时,不是 0-3 档
  const ref = POLICY.scales.verifyMinutesRef
  assert.equal(ac.factorVerifyMinutes('补 scripts/tests/x.test.mjs', POLICY).minutes, Math.round(ref / 4))
  assert.equal(ac.factorVerifyMinutes('改一句文案', POLICY).minutes, ref, '无验收面按参照满额,不假装便宜')
  assert.equal(ac.factorLease('普通票面', 'k', CTX).hours, null, '无牌必须 null(0 小时会被模型读成最紧急)')
  const aged = ac.factorLease('普通票面', 'k', { ...CTX, lastActivityAt: new Map([['k', NOW - 100 * 3_600_000]]) })
  assert.equal(aged.hours, 0, '超参照牌龄剩余 0')
  assert.match(aged.evidence, /100\.0h/, 'evidence 必须点名牌龄小时数')
  const fresh = ac.factorLease('普通票面', 'k', { ...CTX, lastActivityAt: new Map([['k', NOW - 2 * 3_600_000]]) })
  assert.equal(fresh.hours, POLICY.scales.leaseHoursRef - 2)
  assert.match(ac.factorLease('（进行中@2026-10-25/甲席）票面', 'k', CTX).evidence, /进行中@2026-10-25/, '票面认领牌也是牌龄证据')
})

test('③ 票键契约:id 必须等于 ticketKeyOf(票面),否则接不回派单面行', () => {
  const built = ac.buildCandidates({ rows: rows(), policy: POLICY, ledger: [], now: NOW })
  for (const [i, r] of rows().entries()) assert.equal(built.candidates[i].id, ticketKeyOf(r.text))
})

test('④ 端到端:产出喂给真消费者 rankTicketRows,必须进入 decision 模式', () => {
  const built = ac.buildCandidates({ rows: rows(), policy: POLICY, ledger: [], now: NOW })
  const doc = ac.buildDocument({ candidates: built.candidates, generatedAt: built.generatedAt, policy: POLICY, rowCount: 3 })
  const ranked = ae.rankTicketRows(rows(), { policyText: readFileSync(ad.POLICY_PATH, 'utf8'), candidatesText: JSON.stringify(doc) })
  assert.equal(ranked.mode, 'decision', `应进入 decision 模式,现为 ${ranked.mode}`)
  assert.ok(ranked.ranked.length >= 1, '至少应排出一枚')
  assert.equal(typeof ranked.ranked[0].decision.score, 'number')
  // 改判据的票(ruleTouch=3)命中策略 hardBlock ⇒ 压后并点名,不得混进可排期
  assert.ok(ranked.skipped.some((s) => s.line === 12 && /硬阻断/.test(s.reason)), `压后理由须点名硬阻断:${JSON.stringify(ranked.skipped)}`)
})

test('⑤ 确定性 + 同票键去重 + 封禁只点名不改分', () => {
  const a = ac.buildCandidates({ rows: rows(), policy: POLICY, ledger: [], now: NOW })
  const b = ac.buildCandidates({ rows: rows(), policy: POLICY, ledger: [], now: NOW })
  assert.equal(JSON.stringify(a.candidates), JSON.stringify(b.candidates), '同一输入两次产出必须逐字相同')

  const dup = ac.buildCandidates({ rows: [rows()[0], { line: 99, text: rows()[0].text }], policy: POLICY, ledger: [], now: NOW })
  assert.equal(dup.candidates.length, 1, '同票键只留一枚(重复 id 会让决策器整轮判形状坏)')
  assert.deepEqual(dup.duplicates, [{ id: ticketKeyOf(rows()[0].text), keptLine: 11, droppedLine: 99 }])

  const key = ticketKeyOf(rows()[0].text)
  const q = ac.buildCandidates({
    rows: [rows()[0]],
    policy: POLICY,
    ledger: [{ ticketKey: key, action: 'quarantined', until: '2026-11-02T00:00:00.000Z' }],
    now: NOW,
  })
  assert.equal(q.candidates[0].notes.length, 1)
  assert.match(q.candidates[0].notes[0], /封禁/)
  assert.deepEqual(q.candidates[0].benefit, a.candidates[0].benefit, '封禁是派发闸事实,不得改写因子')
})

test('⑥ 渲染面:预览必带每票每因子依据,--json 必带 written=false 与裁决摘要', () => {
  const built = ac.buildCandidates({ rows: rows(), policy: POLICY, ledger: [], now: NOW })
  const doc = ac.buildDocument({ candidates: built.candidates, generatedAt: built.generatedAt, policy: POLICY, rowCount: 3 })
  const decision = ad.decide({ policy: POLICY, candidates: doc.candidates })
  const text = ac.renderPreview(doc, decision, { written: false })
  assert.match(text, /预览/)
  assert.match(text, /benefit\.impact/)
  assert.match(text, /:: 命中高影响词|:: 未命中高影响词/)
  const json = ac.toJsonDoc({ doc, decision, mode: 'preview', written: false, duplicates: [] })
  assert.equal(json.written, false)
  assert.equal(json.path, ac.CANDIDATES_PATH)
  assert.equal(json.candidates.length, 3)
  assert.equal(json.decision.counts.input, 3)
  assert.ok(JSON.parse(JSON.stringify(json)).candidates[0].evidence.impact, '证据必须能进 JSON')
})

test('⑦ CLI 自检末行全绿(不 spawn 派单面)', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--self-test'], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
  assert.equal(r.status, 0, r.stderr)
  const last = r.stdout.trim().split(/\r?\n/).pop()
  assert.match(last, /^self-test: 全绿/, `末行应为 self-test: 全绿,现为 ${last}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
