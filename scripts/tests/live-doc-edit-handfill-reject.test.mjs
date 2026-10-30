// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-313 三条出路的镜像锁(2026-10-25 立):
 *   · ② 远端基准更高时,令牌取号必须抬到远端 max 之上(不与远端那批手填号撞);
 *   · ① 新增行里"既手填声明位编号、又带取号令牌"且两者不一致 ⇒ 拒收;整行改写档不追溯;
 *   · ③ F9 基线是键集,新增组必须能逐组点名。
 *
 * §22c:判据一律从 `__test__` 与 `plan-tasks.mjs` 的导出面拿,本文件不抄第二份"什么算撞号/什么算手填号"。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../live-doc-edit.mjs'
import { f9GroupLine, f9KeySetOf, f9Ratchet } from '../plan-tasks.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OPEN = (id, title) => `- [ ] ${id} **${title}** 正文`
const denseBase = (...extra) =>
  ['G-1', 'G-2', 'G-3', 'G-4', 'G-5'].map((id) => OPEN(id, `既存${id}`)).concat(extra).join('\n')

test('G313-H1 远端基准更高 ⇒ 令牌取号抬到远端 max 之上,不与远端那批号撞', () => {
  const remote = {
    max: { G: 10 },
    ids: { G: ['G-6', 'G-7', 'G-8', 'G-9', 'G-10'] },
    notes: [],
    info: [],
    tipSha: 'a'.repeat(40),
  }
  const r = __test__.resolveIdTokens([OPEN('{{NEXT_ID:G}}', '远端之后的新登记')], denseBase(), remote, {
    manualCheck: true,
  })
  assert.equal(r.ok, true, String(r.reason ?? ''))
  assert.equal(r.assigned, 'G-11', '池内空闲从 6 起,但 6..10 远端已占 ⇒ 必须跳到 11')
  assert.ok(!remote.ids.G.includes(r.assigned), '发出的号不得落在远端已用集合里')
  assert.match(r.lines[0], /G-11/, `落地行必须带抬起来的号,实得 ${r.lines[0]}`)
})

test('G313-H2 新增行手填号与令牌现算号不一致 ⇒ 拒收(handfilled-id-conflict)', () => {
  const r = __test__.resolveIdTokens(
    ['- [ ] G-901 手填事 {{NEXT_ID:G}}'],
    denseBase(),
    null,
    { manualCheck: true },
  )
  assert.equal(r.ok, false, '同一行两路取号必须拒收,不得安静落成两个号')
  assert.equal(r.reason, 'handfilled-id-conflict')
  assert.equal(r.conflicts.length, 1)
  assert.equal(r.conflicts[0].key, 'G-901')
  assert.equal(r.conflicts[0].assigned, 'G-6', '令牌在底稿面上现算的空闲首枚')
  assert.equal(r.lines, undefined, '拒收档不得交出可落地的文本')
})

test('G313-H3 成对反例:令牌在声明位、行文里引述别的号 ⇒ 不得误伤', () => {
  const r = __test__.resolveIdTokens(
    ['- [ ] {{NEXT_ID:G}} 承接 G-901 取证'],
    denseBase(),
    null,
    { manualCheck: true },
  )
  assert.equal(r.ok, true, String(r.reason ?? ''))
  assert.equal(r.assigned, 'G-6')
  assert.match(r.lines[0], /^- \[ \] G-6 /, '展开后行首声明位就是令牌号 ⇒ 引述不是手填')
})

test('G313-H4 射程:整行改写档(manualCheck=false)不追溯手填号', () => {
  const line = '- [ ] G-901 手填事 {{NEXT_ID:G}}'
  const r = __test__.resolveIdTokens([line], denseBase(), null, { manualCheck: false })
  assert.equal(r.ok, true, '改写档的 after 常常就是该行现有号,追溯它等于每次结清都重编一次号')
  assert.equal(r.assigned, 'G-6')
})

test('G313-H5 F9 基线是键集:新增组必须点名,等量换键也必须红', () => {
  const face = (keys) => ({
    counts: { collisionGroups: keys.length },
    collisions: keys.map((k) => ({
      key: k,
      titleCount: 2,
      titles: [
        { title: `${k} 甲`, lines: [1] },
        { title: `${k} 乙`, lines: [2] },
      ],
    })),
  })
  const red = f9Ratchet({ F9: ['G-299'] }, face(['G-300']))
  assert.equal(red.kind, 'red', '基线里没有的键必须判红')
  assert.deepEqual(red.added, ['G-300'], '红档必须交出可执行名单,不能只报"变多了"')
  assert.match(f9GroupLine(face(['G-300']).collisions[0]), /G-300/, '点名文案必须带编号')
  // 等量换键:清掉一组、新撞一组 ⇒ 组数不变而键集变 ⇒ 计数锚恒绿的那一型。
  const swap = f9Ratchet({ F9: ['G-299'] }, face(['G-300']))
  assert.deepEqual(swap.added, ['G-300'])
  assert.deepEqual(f9KeySetOf(face(['G-300', 'G-300'])), ['G-300'], '键集必须去重排序')
  assert.equal(f9Ratchet({ F9: ['G-299'] }, face(['G-299'])).kind, 'ok')
})

test('G313-H6 装车锁:拒收判据在 main 里、且在写 blob 之前', () => {
  const src = readFileSync(join(HERE, '..', 'live-doc-edit.mjs'), 'utf8')
  const branch = src.indexOf("tok.reason === 'handfilled-id-conflict'")
  assert.ok(branch > 0, '判据在而 main 不接线 = 提交链上一路绿灯')
  const blob = src.indexOf('writeBlob(')
  assert.ok(blob > branch, '一旦 commit 再 exit 2 就是把已入库谎报成没落地')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
