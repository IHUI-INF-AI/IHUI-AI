// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/union-marker-triple-recall.test.mjs —— 票面"冲突标记经旁路落地回捞"的接线锁。
 *
 * 钉的三件事(2026-11-01,MARKERS 票):
 *   ① 一侧带**空冲突区**(区域内零正文)、一侧已摘除 ⇒ union 不得把它捞回来;
 *   ② 一侧带**有正文**的冲突区 ⇒ 标记行照旧补回、两侧正文一条都不许静默丢掉(证伪 ① 的边界);
 *   ③ 每一次扣行都必须在报告面点名(整行原文 + 为什么),没扣时该桶必须是 0(不许"顺手说成扣过")。
 *
 * §22c:所有判定都 import 生产脚本的 `__test__`(union-converge 与 lib 各一份),本文件零复制。
 * 标记字面量一律 `'<'.repeat(7)` 构造 —— 本文件不在守门 79 的自豁免名单里,写行首字面量会自伤。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as U } from '../union-converge.mjs'
import { __test__ as T } from '../lib/conflict-marker-triples.mjs'
import {
  bodyCopiesInFamily,
  functionBodyIn,
  sourceOf,
  uniqueDefinition,
  wiringInBody,
} from './helpers/union-converge-source-probe.mjs'

const LT = '<'.repeat(7)
const GT = '>'.repeat(7)
const EQ = '='.repeat(7)

const HERE = dirname(fileURLToPath(import.meta.url))
const UNION_SRC = readFileSync(join(HERE, '..', 'union-converge.mjs'), 'utf8')

/** 结果里是否还留着任何标记行(开头 / 恰好等于分隔 / 结尾)。 */
const hasMarker = (text) =>
  text.split('\n').some((l) => l.startsWith(LT) || l.startsWith(GT) || l === EQ)

test('U1 空冲突区:对侧那三条标记行不得被 union 捞回(手工摘除不再白干)', () => {
  const ours = '# 标题\n正文一行\ntail\n'
  const theirs = `# 标题\n${LT} cf1fdef\n${EQ}\n${GT} c970ac6\n正文一行\ntail\n`
  const base = '# 标题\n正文一行\ntail\n'
  const merged = U.unionLines(ours, theirs, base)
  assert.equal(hasMarker(merged), false, `合并稿里仍有标记行:\n${merged}`)
  // 两侧正文一条都没少(扣的只是脚手架,不是内容)
  assert.ok(merged.includes('正文一行') && merged.includes('tail'))
})

test('U2 反向锁(①-② 的边界):有正文的冲突区 ⇒ 标记行照旧补回、两侧内容都在(不许一律放行)', () => {
  const ours = 'A\n'
  const theirs = `A\n${LT} HEAD\nX-ours-content\n${EQ}\nY-theirs-content\n${GT} feature/x\n`
  const base = 'A\n'
  const merged = U.unionLines(ours, theirs, base)
  assert.ok(merged.includes(`${LT} HEAD`), '有正文的区被自动扣掉标记 = 把"两侧如何取舍"替人决定了')
  assert.ok(merged.includes('X-ours-content'), '对侧正文不得丢')
  assert.ok(merged.includes('Y-theirs-content'), '对侧正文不得丢')
})

test('U3 本侧自己的份数不得被归并器顺手删掉(扣的是补回量,不是既有内容)', () => {
  const ours = `A\n${LT} z\n${EQ}\n${GT} w\n`
  const merged = U.unionLines(ours, 'A\n', 'A\n')
  const ls = merged.split('\n')
  assert.equal(ls.filter((l) => l.startsWith(LT)).length, 1)
  assert.equal(ls.filter((l) => l.startsWith(GT)).length, 1)
  assert.equal(ls.filter((l) => l === EQ).length, 1)
})

test('U4 扣行必须点名:report 逐条给整行原文与原因;没扣时该桶恰为 0', () => {
  const rep = []
  U.unionLines('A\n', `A\n${LT} cf\n${EQ}\n${GT} c97\n`, 'A\n', null, { report: rep })
  const hit = rep.filter((w) => w.via === 'marker-empty-triple')
  assert.equal(hit.length, 3, `三条标记行都该被点名,实际 ${hit.length} 条`)
  assert.deepEqual(
    hit.map((w) => w.line).sort(),
    [`${GT} c97`, `${LT} cf`, EQ].sort(),
  )
  for (const w of hit)
    assert.ok(typeof w.why === 'string' && w.why.includes('空冲突区'), '每条都要给得出为什么(§0.10)')

  const rep2 = []
  U.unionLines('A\n', `A\n${LT} HEAD\nX\n${EQ}\nY\n${GT} f\n`, 'A\n', null, { report: rep2 })
  assert.equal(
    rep2.filter((w) => w.via === 'marker-empty-triple').length,
    0,
    '有正文的区一条都不该被扣,也不该被点名成"扣过"(§0.3 不把没判写成判过)',
  )
})

test('U5 保守向:同一标记文本既出现在空区又出现在有正文区 ⇒ 整条不扣(分不开就不猜)', () => {
  const theirs = [`${LT} HEAD`, 'p', EQ, 'q', `${GT} HEAD`, '', `${LT} HEAD`, EQ, `${GT} HEAD`].join(
    '\n',
  )
  const caps = U.markerTripleRecallCaps('A\n', theirs)
  assert.equal(caps.size, 0, `判不准时必须多留一份,实际扣减表:${JSON.stringify([...caps])}`)
  const merged = U.unionLines('A\n', `A\n${theirs}\n`, 'A\n')
  assert.ok(merged.includes(`${LT} HEAD`), '这一型的红权归守门 79,不由归并器代裁')
})

test('U6 半截标记(未配对)不进扣减表:照旧补回,由门 79 的 P4/落地自证臂去喊', () => {
  const theirs = [`${LT} HEAD`, 'a', EQ, 'b'].join('\n')
  assert.equal(U.markerTripleRecallCaps('A\n', theirs).size, 0)
  const c = T.classifyMarkerTriples(theirs)
  assert.equal(c.manual.length, 1, '未配对的开头必须被 lib 点名(本用例只验形状,不复制判据)')
})

test('U7 自证面与产出面同形:被扣的行不在期望重数表里 ⇒ verifyUnion 不会反过来追讨', () => {
  const ours = 'A\n'
  const theirs = `A\n${LT} cf\n${EQ}\n${GT} c97\n`
  const base = 'A\n'
  const want = U.liveDocExpectedCounts(ours, theirs, base)
  for (const l of [`${LT} cf`, EQ, `${GT} c97`])
    assert.ok(!want.has(l), `期望表里仍留着 ${JSON.stringify(l)} ⇒ 落地闸会把它追讨回来`)
  // 而**内容行**的追讨一分未减(收紧靠的是形状,不是削判据)
  assert.ok(want.has('A'))
})

test('U8 形状锁(§0.6 单一真相源):配对判据只有一份,接线点就在期望表函数体内', () => {
  assert.ok(
    /import\s*\{\s*classifyMarkerTriples\s*\}\s*from\s*'\.\/(?:lib\/)?conflict-marker-triples\.mjs'/.test(
      UNION_SRC + '\n' + sourceOf('scripts/lib/union-converge-judgments.mjs'),
    ),
    'union-converge 必须 import lib 的那份配对判据,不得自己再扫一遍行',
  )
  // 唯一性锁(2026-11-01 修探测面,强于原实现):扣减表在全家族(union-converge.mjs + lib/union-converge-*.mjs)
  // 恰好 1 份定义,且**函数体全家族只此一处** —— 原实现只看单文件,把判据复制进 lib 反而看不见。
  const caps = uniqueDefinition('markerTripleRecallCaps')
  assert.ok(caps.ok, caps.why)
  assert.ok(
    caps.body.includes('classifyMarkerTriples('),
    '扣减表必须**问**lib 那份配对判据(单源),不得在自家里再扫一遍标记行',
  )
  const pairing = functionBodyIn(sourceOf('scripts/lib/conflict-marker-triples.mjs'), 'classifyMarkerTriples')
  assert.ok(pairing !== null, '取不到 lib 的配对判据本体 ⇒ 未判定(不许当绿灯)')
  const copies = bodyCopiesInFamily(pairing)
  assert.equal(
    copies.count,
    0,
    `配对判据本体被抄进了 union 家族(${copies.hits.map((h) => `${h.rel}×${h.n}`).join(' / ')})⇒ 同一判据两份定义`,
  )
  // 接线锁:扣行必须接在期望表函数体内(该函数已搬进 lib,探测面跟着它的新家走,仍取真函数体)
  const wiring = wiringInBody('liveDocExpectedCounts', 'markerTripleRecallCaps(oursText, theirsText)')
  assert.ok(
    wiring.ok,
    wiring.why ||
      '扣行必须接在"决定对侧在场就补回"的那张期望表里(产出面与自证面共用),不是只在报告面报数',
  )
})

test('U9 旁路落地自证臂已接线:land-gate-rerun 常备一臂真 spawn 守门 79 的 --rev 档', () => {
  const src = readFileSync(join(HERE, '..', 'lib', 'land-gate-rerun.mjs'), 'utf8')
  assert.ok(
    src.includes("join(REPO_ROOT, 'scripts', 'check-no-conflict-markers.mjs')"),
    '自证臂必须复用门体本身,不得在 lib 里再抄一份标记判据(§0.6)',
  )
  assert.ok(
    /spawnGate\(markerGate,\s*\['--rev',\s*'HEAD'\]/.test(src),
    '必须判落地面(HEAD 树)—— 取材面与结论同面(§0.4)',
  )
  assert.ok(src.includes("kind: 'conflict-markers'"), '红/未判定都必须落进 verdict 计算')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
