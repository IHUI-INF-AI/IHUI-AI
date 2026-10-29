// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试 —— G-14 台账票格①「别席已占号绝不复发」的**夹具级正证**(第一出口·租约路径侧)。
 *
 * 为什么存在(票面更正注记,2026-10-22):G-14 代码(scanFamilyIds/scanFamilyIdHits 唯一实现 +
 * 两出口接线)已落地,但更正时只观察到"拦得住同号不同题",未做夹具级正证 ⇒ 不翻勾。本文件补的
 * 正是这一格:
 *  L1 前提锁(病形构造):夹具面上"别席既存题"只以 HTML 归档占位注释 / 标题行留面 ⇒
 *      窄口径 usedIdsOfPrefix 看不见,而 decideLease 的「自有租约段空闲序」确实给出 G-925;
 *  L2 正证(发号):resolveIdTokens(带 machineId,in-lease 路径)实际发出 G-926,并把被跳过的
 *      G-925/G-927 逐枚点名带命中位置 —— 别席已占的号不得再被发出;
 *  L3 输出面可区分:「空闲发出」(leaseNotes 首号 / assigned)与「撞号跳过」(scanNotes 聚合行
 *      + 逐枚明细)是两条独立读数,不得混写;
 *  L4 有牙锁:scanReport.firstCandidate 钉住"改动前会发出的那个号"= G-925 —— 把新查重摘掉,
 *      assigned 立刻退回 G-925,L2 的断言当场翻红(验证期以摘判据的演练副本实证过红)。
 * 夹具临时台账经 lib/scratch-dir.mjs 的 mkScratch 落点(禁 os.tmpdir,§15b),对真仓零副作用。
 */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { resolveIdTokens } from '../live-doc-edit.mjs'
import { usedIdsOfPrefix } from '../lib/plan-task-index.mjs'
import { decideLease, LEASE_MARK } from '../lib/plan-id-lease.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const MACHINE = 'G14-FIXTURE-SEAT'

/**
 * 夹具台账(行数组,行号断言共用同一份构造):
 *  - 租约行:本机占 G-901~G-950(主键=段尾号 G-950);
 *  - G-901..G-924:窄口径可见的登记行,填满段前 ⇒ 段内空闲序恰好指向 G-925;
 *  - G-925:只活在 HTML 归档占位注释里(parseTaskRows 看不见 ⇒ 票面"别席既存题"的原型);
 *  - G-927:只活在标题行里(同上);
 *  - G-926:无人占用 ⇒ 正确答案应发它。
 */
function ledgerLines() {
  const ls = []
  ls.push('# 台账(G-14 夹具,scratch)')
  ls.push('')
  ls.push('## 号段租约登记区(取号器专用,千段租约制)')
  ls.push(
    `- [x] G-950 ${LEASE_MARK} 本机=${MACHINE} 段=G-901~G-950(取号器专用行:占用面只取本行主键=段尾号 ⇒ 无租约感知的 max+1 落在段外)`,
  )
  ls.push('')
  ls.push('## 已登记')
  for (let n = 901; n <= 924; n += 1) ls.push(`- [ ] G-${n} 夹具既有登记 ${n}`)
  ls.push('')
  ls.push('<!-- 已归档(2026-10-22) G-925 别席既存题:归档占位注释留在台账 ⇒ 窄口径看不见这一型 -->')
  ls.push('### G-927 别席把号挂在标题上(无登记行 ⇒ 窄口径同样看不见)')
  ls.push('')
  return ls
}

/** 临时台账文件落在 mkScratch 目录里,读回当底稿(正证的对象是"台账文件",不是内存串)。 */
function scratchLedger() {
  const dir = mkScratch('g14-lease-')
  const p = join(dir, 'PROJECT_PLAN.md')
  writeFileSync(p, ledgerLines().join('\n'), { encoding: 'utf8' })
  return { dir, path: p }
}

const TOKEN_LINE =
  '- [ ] {{NEXT_ID:G}} G-14 夹具正证 租约段空闲序指向九二五时取号器必须跳号点名'

test('L1 前提锁:窄口径对 G-925/G-927 失明,租约段空闲序确实给出 G-925(病形是构造出来的)', () => {
  const { dir, path } = scratchLedger()
  try {
    const base = readFileSync(path, 'utf8')
    const used = usedIdsOfPrefix(base, 'G')
    assert.ok(used, 'G 族登记行在场,usedIdsOfPrefix 必须读得出')
    assert.ok(
      !used.ids.includes('G-925') && !used.ids.includes('G-927'),
      `窄口径必须看不见 G-925/G-927(否则夹具不构成本票病形),实得 ${JSON.stringify(used.ids)}`,
    )
    const cur = decideLease({ baseContent: base, family: 'G', used, baseMax: used.max, machineId: MACHINE })
    assert.equal(cur.mode, 'in-lease', '本机有段 G-901~G-950 ⇒ 应走段内空闲序')
    assert.equal(
      cur.next,
      925,
      `旧口径「自有租约段空闲序」必须恰好给出 G-925(正证的前提),实得 ${cur.next}`,
    )
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('L2 正证:取号器实际发出 G-926,并逐枚点名跳过 G-925/G-927 带命中位置(G-14 出路①)', () => {
  const { dir, path } = scratchLedger()
  try {
    const lines = ledgerLines()
    const base = readFileSync(path, 'utf8')
    const r = resolveIdTokens([TOKEN_LINE], base, null, { machineId: MACHINE })
    assert.equal(r.ok, true, `应能发号而非拒绝,实得 reason=${r.reason}`)
    assert.equal(
      r.assigned,
      'G-926',
      `发出的首号必须是 G-926(≥926,别席已占号绝不复发),实得 ${r.assigned}`,
    )
    assert.match(String(r.lines[0]), /G-926/)
    assert.doesNotMatch(String(r.lines[0]), /G-925|G-927/, '发出行不得含撞号')
    const rep = r.scanReport.find((x) => x.family === 'G')
    assert.ok(rep, 'scanReport 必须有 G 族读数')
    const skippedIds = rep.skipped.map((s) => s.id)
    assert.deepEqual(skippedIds, ['G-925', 'G-927'], `跳过的号必须逐枚点名这两枚,实得 ${JSON.stringify(skippedIds)}`)
    const lineOf = (id) => lines.findIndex((l) => l.includes(id)) + 1
    for (const s of rep.skipped) {
      assert.ok(
        s.sites.length >= 1,
        `${s.id} 的跳过必须带命中位置(票面:"哪个位置出现过"),实得 ${JSON.stringify(s)}`,
      )
      const expect = lineOf(s.id)
      assert.ok(
        s.sites.some((x) => x.line === expect),
        `${s.id} 位置锚应指到夹具第 ${expect} 行,实得 ${JSON.stringify(s.sites)}`,
      )
      assert.ok(
        s.sites.some((x) => x.snippet.includes(s.id)),
        `${s.id} 的 snippet 必须带号本体(运维照行可核),实得 ${JSON.stringify(s.sites)}`,
      )
    }
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('L3 输出面可区分:「空闲发出」与「撞号跳过」是两条独立读数', () => {
  const { dir, path } = scratchLedger()
  try {
    const base = readFileSync(path, 'utf8')
    const r = resolveIdTokens([TOKEN_LINE], base, null, { machineId: MACHINE })
    assert.equal(r.ok, true, r.reason)
    const notes = r.scanNotes.join('\n')
    assert.match(notes, /G-14 全文件扫描:候选号 G-925, G-927/, '聚合行必须点名两枚(既有读者认这一行)')
    assert.match(notes, /跳过 G-925 —— 命中 \d+ 处/, 'G-925 逐枚明细(点名+位置)')
    assert.match(notes, /跳过 G-927 —— 命中 \d+ 处/, 'G-927 逐枚明细(点名+位置)')
    const lease = r.leaseNotes.join('\n')
    assert.match(lease, /空闲序.*首号=G-926/, '空闲发出的读数住在 leaseNotes,与跳号点名不混')
    assert.doesNotMatch(lease, /跳过 G-9/, 'leaseNotes 不得混入跳号措辞(两条读数各自独立)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('L4 有牙锁:报告钉住「改动前会发出的号」= G-925(摘掉新查重 ⇒ L2 当场翻红)', () => {
  const { dir, path } = scratchLedger()
  try {
    const base = readFileSync(path, 'utf8')
    const r = resolveIdTokens([TOKEN_LINE], base, null, { machineId: MACHINE })
    assert.equal(r.ok, true, r.reason)
    const rep = r.scanReport.find((x) => x.family === 'G')
    assert.equal(
      rep.firstCandidate,
      'G-925',
      'firstCandidate = 旧口径(无全文件扫描)会发出的那个号;它若不是 G-925,夹具就不再构成病形,L2 失去牙',
    )
    assert.notEqual(r.assigned, rep.firstCandidate, '发出号必须区别于旧口径候选(这正是本票的全部意义)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
