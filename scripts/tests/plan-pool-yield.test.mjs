// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/plan-pool-yield.mjs「已完成条目让位、号随让位回池」(Y-2,2026-10-29)。
 *
 * 钉住的五条(票面要求逐条成用例):
 *  ① 不动在册未勾行的号 —— 活台账 `- [ ]` 行里出现的号一枚都不让;
 *  ② 不让位刚结清的号 —— 结清日在让位窗内的号一枚都不让;
 *  ③ 幂等 —— 同一份面跑两次 `--apply`,账本每条 (族,号) 只有一条 yield;
 *  ④ 退出后可反查 —— `--trace` 能读出让位链;重新领用后账本追加 reclaim、该号复归占用面;
 *  ⑤ 不产生 >99 号 —— 让位射程恒为 1..99,池外号既不参选也不被发出。
 *
 * 外加两条"防第二把尺"的结构锁(§22c):让位判据必须委托 lib 的
 * `usedIdsOfPrefix` / `scanFamilyIdHits` / `ID_HEAD_RE`,取号减法必须走
 * `usedIdsOfPrefixExcluding`(它是 `usedIdsOfPrefix` 的集合差,不重扫正文)。
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  YIELD_LEDGER_REL,
  activeYields,
  appendYieldRecords,
  decideYield,
  planRecords,
  poolReading,
  readYieldLedger,
  traceOf,
  yieldedSetOf,
} from '../plan-pool-yield.mjs'
import {
  usedIdsOfPrefix,
  usedIdsOfPrefixExcluding,
} from '../lib/plan-task-index.mjs'
import { poolFreeList, LEASE_POOL_MAX } from '../lib/plan-id-lease.mjs'
import { resolveIdTokens } from '../live-doc-edit.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const NOW = new Date('2026-10-29T00:00:00Z')
const OLD = '2026-05-01'
const FRESH = '2026-10-28'

const done = (id, d = OLD, title = 't') => `- [x] ✅(${d}) ${id} **${title}** 正文`
const open = (id, title = 't') => `- [ ] ${id} **${title}** 正文`
const face = ({ ledger = '', archives = [] } = {}) => ({
  ledgerText: ledger,
  archives: archives.map((a, i) => ({ path: `.ihui-agent/archive/PROJECT_PLAN_${i}.md`, text: a })),
})

const tmpLedger = () => join(mkdtempSync(join(tmpdir(), 'yield-ledger-')), 'ledger.jsonl')

test('① 在册未勾行的号一枚都不让 —— 哪怕同号在归档件里已结清且早已出窗', () => {
  const f = face({
    ledger: [open('D-7', '在册未勾的那一条'), ''].join('\n'),
    archives: [done('D-7', '2026-01-02', '归档里的旧同号')],
  })
  const d = decideYield({ face: f, families: ['D'], now: NOW })
  assert.equal(d.yields.length, 0, '在册未勾 ⇒ 不让位')
  const r = d.retained.find((x) => x.num === 7)
  assert.ok(r, 'D-7 必须在保留集里')
  assert.ok(r.reasons.includes('open-row'), `保留理由必须点名 open-row,实际:${r.reasons}`)
})

test('①b 活台账的已勾行也不让 —— 同号两行落在同一份活文档里就是 F9 现场,让位器不替归档器搬运', () => {
  const f = face({
    ledger: [done('D-8', '2026-02-03', '活台账里还没搬走的已完成行'), ''].join('\n'),
    archives: [done('D-8', '2026-02-03', '归档件里的同号')],
  })
  const d = decideYield({ face: f, families: ['D'], now: NOW })
  assert.equal(d.yields.length, 0)
  assert.ok(d.retained[0].reasons.includes('live-ledger-row'))
})

test('② 刚结清的号不让位(让位窗内)—— 窗只认行内最新日期,不认行号顺序', () => {
  const f = face({
    ledger: '## 批次流水\n',
    archives: [done('D-9', FRESH, '昨天刚结清')],
  })
  const d = decideYield({ face: f, families: ['D'], now: NOW, windowDays: 30 })
  assert.equal(d.yields.length, 0)
  assert.ok(d.retained[0].reasons.includes('within-window'))
  // 同一份面,窗缩到 0 天 ⇒ 判据真的在判窗,不是恒拒
  const d0 = decideYield({ face: f, families: ['D'], now: NOW, windowDays: 0 })
  assert.equal(d0.yields.length, 1, `窗=0 时应让位,实际保留:${JSON.stringify(d0.retained[0]?.reasons)}`)
})

test('②b 结清日期读不出的号不让位(判不出 ≠ 结清)', () => {
  const f = face({ ledger: '## 批次\n', archives: ['- [x] ✅ D-10 **没有日期的已勾行**\n'] })
  const d = decideYield({ face: f, families: ['D'], now: NOW })
  assert.equal(d.yields.length, 0)
  assert.ok(d.retained[0].reasons.includes('no-settled-date'))
  assert.ok(d.undetermined.some((u) => u.num === 10), '判不出的必须单列,不得混进"结清过"')
})

test('②c 窗的边界按"日对日"判:正好第 30 天结清的号仍在窗内(2026-10-29 G-36 一手教训)', () => {
  // now 带时刻(05:53Z)而台账日期只有"日":旧实现拿 `2026-09-29T00:00Z` 与 `now-30d` 比大小,
  // 差 6 小时就把"正好第 30 天"判成出窗 ⇒ 让掉了一枚仍在窗内的号。失效方向必须是"多留一天"。
  const f = face({ ledger: '## 批次\n', archives: [done('D-14', '2026-09-29') + '\n'] })
  const d = decideYield({ face: f, families: ['D'], now: new Date('2026-10-29T05:53:00Z'), windowDays: 30 })
  assert.equal(d.cutoff, '2026-09-29')
  assert.equal(d.yields.length, 0, '结清日 == 截止日 ⇒ 仍在窗内,不让位')
  assert.ok(d.retained[0].reasons.includes('within-window'))
})

test('③ 幂等:同一份面跑两次,账本每条 (族,号) 只有一条 yield', () => {
  const f = face({ ledger: '## 批次\n', archives: [done('D-11', OLD) + '\n' + done('D-12', OLD) + '\n'] })
  const d = decideYield({ face: f, families: ['D'], now: NOW })
  assert.equal(d.yields.length, 2)
  const path = tmpLedger()
  const p1 = planRecords({ decision: d, records: readYieldLedger(path).records, now: NOW })
  assert.equal(p1.records.length, 2)
  appendYieldRecords(path, p1.records)
  const p2 = planRecords({ decision: d, records: readYieldLedger(path).records, now: NOW })
  assert.equal(p2.records.length, 0, '第二次不得重写已生效的让位')
  assert.equal(p2.skipped.length, 2)
  appendYieldRecords(path, p2.records)
  const led = readYieldLedger(path)
  assert.equal(led.records.length, 2)
  for (const rec of led.records) assert.equal(rec.event, 'yield')
})

test('④ 退出后可反查;重新领用后追加 reclaim 且该号复归占用面', () => {
  const path = tmpLedger()
  const before = face({ ledger: '## 批次\n', archives: [done('D-13', OLD) + '\n'] })
  const d1 = decideYield({ face: before, families: ['D'], now: NOW })
  appendYieldRecords(path, planRecords({ decision: d1, records: [], now: NOW }).records)
  const recs = readYieldLedger(path).records
  const chain = traceOf(recs, 'D', 13)
  assert.equal(chain.length, 1)
  assert.equal(chain[0].event, 'yield')
  assert.equal(chain[0].settledAt, OLD)
  assert.ok(chain[0].declarations[0].path.includes('.ihui-agent/archive/'), '证据锚必须带归档件路径')
  assert.ok(chain[0].declarations[0].line > 0, '证据锚必须带行号')
  assert.ok(activeYields(recs).get('D').has(13), '让位后该号退出占用面')

  // 重新领用:活台账出现同号未勾行 ⇒ 追加 reclaim,号复归占用面
  const after = face({
    ledger: [open('D-13', '新登记的同号任务'), ''].join('\n'),
    archives: [done('D-13', OLD) + '\n'],
  })
  const d2 = decideYield({ face: after, families: ['D'], now: NOW })
  const p2 = planRecords({ decision: d2, records: recs, now: NOW })
  const reclaim = p2.records.filter((r) => r.event === 'reclaim')
  assert.equal(reclaim.length, 1, '重新领用必须留一条 reclaim')
  assert.equal(reclaim[0].num, 13)
  appendYieldRecords(path, p2.records)
  const recs2 = readYieldLedger(path).records
  assert.equal(traceOf(recs2, 'D', 13).length, 2)
  assert.ok(!activeYields(recs2).get('D')?.has(13), 'reclaim 之后该号必须复归占用面')
  // 幂等:再跑一次不再追加第二条 reclaim
  assert.equal(planRecords({ decision: d2, records: recs2, now: NOW }).records.length, 0)
})

test('⑤ 不产生 >99 号:池外号永不参选,让位后发出的号恒在 1..99', () => {
  const ledger = ['## 批次', '', done('D-120', OLD, '七位数存量债的邻居'), ''].join('\n')
  const archives = [Array.from({ length: 99 }, (_, i) => done(`D-${i + 1}`, OLD)).join('\n')]
  const f = face({ ledger, archives })
  const d = decideYield({ face: f, families: ['D'], now: NOW, poolMax: LEASE_POOL_MAX })
  assert.equal(d.yields.length, 99)
  assert.ok(d.yields.every((y) => y.num >= 1 && y.num <= 99), '让位射程必须恒为 1..99')
  assert.ok(!d.yields.some((y) => y.num === 120), '池外号不参选(它本来就不占池)')
  const yielded = yieldedSetOf(d.yields)
  const rd = poolReading({ face: [ledger, ...archives].join('\n'), family: 'D', yielded: yielded.get('D') })
  assert.equal(rd.before.free, 0)
  assert.equal(rd.after.free, 99)
  const free = poolFreeList({ usedNumbers: [], baseMax: 0 })
  assert.ok(free.every((n) => n >= 1 && n <= 99))
})

test('取号判据接线:同一份面,没有让位集 ⇒ pool-exhausted;有 ⇒ 发得出且号 ≤99', () => {
  // 现场形态照真仓:池内 99 枚全在归档面有过登记(老的那批),最近 10 枚刚结清(窗内不让位)。
  const archives = [
    [
      ...Array.from({ length: 89 }, (_, i) => done(`D-${i + 1}`, OLD)),
      ...Array.from({ length: 10 }, (_, i) => done(`D-${90 + i}`, FRESH)),
    ].join('\n'),
  ].join('\n')
  const ledger = '## 批次流水\n\n- 池内号的归档占位见 `.ihui-agent/archive/`\n'
  const text = [ledger, archives].join('\n')
  const row = '- [ ] {{NEXT_ID:D}} **Y-2 让位接线探针(与真登记永不同题)**'
  const blocked = resolveIdTokens([row], text, null, {})
  assert.equal(blocked.ok, false)
  assert.match(String(blocked.reason), /^pool-exhausted:D/)

  const f = face({ ledger, archives: [archives] })
  const d = decideYield({ face: f, families: ['D'], now: NOW })
  assert.equal(d.yields.length, 89, `只该让位出窗的 89 枚,实际 ${d.yields.length}`)
  const ok = resolveIdTokens([row], text, null, { yieldedIds: yieldedSetOf(d.yields) })
  assert.equal(ok.ok, true, `让位后应发得出号:${ok.reason ?? ''}`)
  const num = Number(/(\d+)/.exec(String(ok.lines[0]).replace(/^\s*-\s*\[ \]\s*/, ''))[1])
  assert.ok(num >= 1 && num <= 99, `发出的号必须在池内,实际 ${num}`)
  assert.ok((ok.yieldNotes ?? []).length > 0, '让位必须逐枚留痕(报告里要能读出"号为什么是这个")')
})

test('结构锁:让位判据委托 lib 单源,不写第二份"什么算一个编号"/"号在哪出现"', () => {
  const src = readFileSync(join(HERE, '..', 'plan-pool-yield.mjs'), 'utf8')
  assert.match(src, /usedIdsOfPrefix\b/, '必须走 usedIdsOfPrefix')
  assert.match(src, /usedIdsOfPrefixExcluding\b/, '减法必须走同文件的集合差出口')
  assert.match(src, /scanFamilyIdHits\b/, '命中位置必须走 plan-id-face 的那一份')
  assert.match(src, /ID_HEAD_RE/, '编号形状必须取 lib/plan-id-lease 的常量')
  assert.match(src, /LEASE_POOL_MAX/, '池上限必须取 lib 常量')
  // 负向:本文件不得自己拼一条"族名+数字"的正则(那就是第二把尺)
  const own = src
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    .join('\n')
  assert.doesNotMatch(own, /new RegExp\([^\n]*\[A-Za-z\][^\n]*\\d/, '不得自造编号正则')
  assert.doesNotMatch(own, /\/\^\(\[A-Za-z\]\+\)/, '不得自造编号正则(字面量)')
})

test('usedIdsOfPrefixExcluding:集合差形态与 usedIdsOfPrefix 同形,max/template 按剩余号重算', () => {
  const text = ['- [x] ✅(2026-01-01) D59 a', '- [ ] D60 b', '- [ ] D61 c', '- [ ] D-62 d', ''].join('\n')
  const all = usedIdsOfPrefix(text, 'D')
  assert.equal(all.used, 4)
  assert.equal(all.max, 62)
  const cut = usedIdsOfPrefixExcluding(text, 'D', new Set([62]))
  assert.equal(cut.used, 3)
  assert.equal(cut.max, 61)
  assert.equal(cut.template, 'D%d', '形状取剩余最大号自己的拼写(D61 不带连字符)')
  assert.deepEqual(usedIdsOfPrefixExcluding(text, 'D', new Set()), all, '空集合必须原样返回')
  // 全族让位 ⇒ 原样返回(取号侧不得读成 no-such-family)
  assert.equal(usedIdsOfPrefixExcluding(text, 'D', new Set([59, 60, 61, 62])).used, 4)
})

test('账本路径是机读单点:常量与 --apply 落点一致,且坏行不让整本失效', () => {
  assert.equal(YIELD_LEDGER_REL, '.ihui-agent/state/plan-pool-yield.jsonl')
  const path = tmpLedger()
  writeFileSync(path, '{"event":"yield","family":"D","num":1}\nnot-json\n{"event":"yield","family":"D","num":2}\n')
  const led = readYieldLedger(path)
  assert.equal(led.records.length, 2)
  assert.equal(led.badLines, 1, '坏行必须计数,不许静默吞掉')
  assert.deepEqual([...activeYields(led.records).get('D')].sort(), [1, 2])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
