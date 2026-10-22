// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/live-doc-edit.mjs 的「同号不同题」闸(§22c —— 判据从源脚本 __test__ 出口拿,
// 本文件禁止再抄一份)。
//
// 立案现场(2026-10-22):一席走正牌入口 {{NEXT_ID:G}} 连登三票,拿到 G-924 / G-926 / G-929,
// 落地后复算发现**每个号都已有别席的既存题**(那些行标着〔登记@2026-10-21〕,在活文档里反复进出,
// 取号那一刻确实空闲、落地那一刻已被占)。而既有两道闸都看不见这一型:
//   · F1 复合主键 = 编号 + 标题前缀逐字等值 ⇒ 同号不同题主键不同,不命中;
//   · 守门 194 同题多号 ⇒ 反方向,也不命中。
// ⇒ 结果:两席按同一个号领同一张票,派单面虚高,这正是"打架重复做"的机器成因。
//
// 本闸只拦**本次真新增**的撞号;就地改写、让号(换号)、存量既存都放过 —— 否则会把 §1 建议的
// 正当修法判成违规,并与取号器互搏。

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../live-doc-edit.mjs'

const OPEN = (id, title) => `- [ ] ${id} **${title}** 正文`
const DONE = (id, title) => `- [x] ✅(2026-10-22) ${id} **${title}** 正文`

test('形状锁:判据从源脚本出口,不在测试里另写一份', () => {
  assert.equal(typeof __test__.judgeNewIdCollisions, 'function')
})

test('C1 真撞车必拦:新内容里同一未勾号挂着两条不同的题', () => {
  const baseLines = [OPEN('G-926', 'lint-staged 雷区仍有 84 枚')]
  const newLines = [
    OPEN('G-926', 'lint-staged 雷区仍有 84 枚'),
    OPEN('G-926', '生产 web 的部署承载者没查清'),
  ]
  const r = __test__.judgeNewIdCollisions({ baseLines, newLines, removedLines: [] })
  assert.equal(r.blocked.length, 1)
  assert.equal(r.blocked[0].id, 'G-926')
  assert.equal(r.blocked[0].rows.length, 2)
})

test('C2 就地改写不误拦:同一条行被换了内容,号没变', () => {
  const old = OPEN('G-300', '某票标题')
  const revised = OPEN('G-300', '某票标题') + ' 〔补充现状〕'
  const r = __test__.judgeNewIdCollisions({
    baseLines: [old],
    newLines: [revised],
    removedLines: [old],
  })
  assert.equal(r.blocked.length, 0)
})

test('C3 让号不误拦:旧号行删掉、同题在新号上出现一次', () => {
  const old = OPEN('G-301', '需要让号的事')
  const moved = OPEN('G-302', '需要让号的事')
  const r = __test__.judgeNewIdCollisions({
    baseLines: [old],
    newLines: [moved],
    removedLines: [old],
  })
  assert.equal(r.blocked.length, 0)
})

test('C4 存量只报数不拦:撞号在父提交里已在、本次没再加', () => {
  const baseLines = [OPEN('G-303', '甲题'), OPEN('G-303', '乙题')]
  const r = __test__.judgeNewIdCollisions({ baseLines, newLines: baseLines, removedLines: [] })
  assert.equal(r.blocked.length, 0)
  assert.equal(r.preexisting.length, 1)
})

test('C5 已勾行不占派单面:同号一条未勾一条已勾不算撞车', () => {
  const baseLines = [OPEN('G-304', '待办题'), DONE('G-304', '另一道已结清的题')]
  const r = __test__.judgeNewIdCollisions({ baseLines, newLines: baseLines, removedLines: [] })
  assert.equal(r.blocked.length, 0)
  assert.equal(r.preexisting.length, 0)
})

test('C6 变异对照:同一条行重复两次(同题同号)归 F1 管,本闸不抢它的活', () => {
  const l = OPEN('G-305', '同一件事被抄了两遍')
  const r = __test__.judgeNewIdCollisions({ baseLines: [], newLines: [l, l], removedLines: [] })
  assert.equal(r.blocked.length, 0, '同号同题不是本闸射程(F1/守门 194 负责)')
})

test('C7 输入为空一律未判定:不许把"没读到内容"读成"没有撞号"', () => {
  const r = __test__.judgeNewIdCollisions({ baseLines: [], newLines: [], removedLines: [] })
  assert.equal(r.undetermined, true)
  assert.equal(r.blocked.length, 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
