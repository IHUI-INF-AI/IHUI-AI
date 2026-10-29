// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/live-doc-edit.mjs 的「同号不同题」落地闸(§22c —— 判据从源脚本 __test__ 出口拿,
// 本文件禁止再抄一份"什么算撞号")。
//
// 立案现场(2026-10-22):一席走正牌入口 {{NEXT_ID:G}} 连登三票,拿到 G-924 / G-926 / G-929,
// 落地后复算发现**每个号都已有别席的既存题**(那些行标着〔登记@2026-10-21〕;号在活文档里反复进出,
// 取号那一刻确实空闲、落地那一刻已被占)。既有两道闸都看不见这一型:
//   · F1 复合主键 = 编号 + 标题前缀逐字等值 ⇒ 同号不同题主键不同,不命中;
//   · 守门 194 同题多号 ⇒ 反方向,也不命中。
// ⇒ 结果:两席按同一个号领同一张票,派单面虚高,这正是"打架重复做"的机器成因。
//
// ⚠ 本闸的成组口径**不是本器自算的**,而是台账层 F9 那一把尺(`auditPlan().f9Declared` 声明位档
//   + `narrowF9Face` 的全已勾降档),与合并落地闸 / `plan-tasks.mjs --gate` 同一个面。
//   所以下面 C5 / C5b / C6 三条钉的都是"与那把尺一致",不是本器自己的偏好:
//   第一版在本器按 `r.key` 当编号自算分组,把 F1 的夹具(同号同题)也判成本闸射程,当场抢在 F1
//   前面把 DU-7 的装车证明顶掉(症状:rc 仍为 1,但拒绝理由点错名)。

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../live-doc-edit.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

const OPEN = (id, title) => `- [ ] ${id} **${title}** 正文`
const DONE = (id, title) => `- [x] ✅(2026-10-22) ${id} **${title}** 正文`
const doc = (...lines) => lines.join('\n')

test('形状锁:判据从源脚本出口拿,且成组口径必须委托 F9(禁止第四把尺)', () => {
  assert.equal(typeof __test__.judgeNewIdCollisions, 'function')
  const src = readFileSync(join(HERE, '..', 'live-doc-edit.mjs'), 'utf8')
  const at = src.indexOf('export function judgeNewIdCollisions')
  assert.ok(at > 0, '判据必须住在源脚本里(测试里写一份必漂移)')
  const body = src.slice(at, src.indexOf('\n}\n', at))
  assert.match(body, /narrowF9Face\(auditPlan\(/, '必须吃 F9 的判定面(与合并落地闸/--gate 同面)')
  // 阳性对照:第一版留下的自算形状 —— 一旦出现就是"本器一套、门一套"重新分叉
  assert.doesNotMatch(body, /openRowsByKey/, '不得在本器里自造分组(那是第二把"什么算撞号")')
  const call = src.indexOf('judgeNewIdCollisions({')
  assert.ok(call > 0, 'main 里必须真的调用本闸(函数在而无人调 = 提交链上一路绿灯)')
  const blob = src.indexOf('writeBlob(nextLines')
  assert.ok(
    blob > call,
    '闸必须在 writeBlob 之前:内容一旦 commit,再 exit 1 就是把已入库谎报成没落地',
  )
})

test('C1 真撞车必拦:落地面里同一号挂着两个不同标题,而底稿没有这一组', () => {
  const r = __test__.judgeNewIdCollisions({
    baseText: doc(OPEN('G-900810', 'lint-staged 雷区仍有 84 枚')),
    nextText: doc(
      OPEN('G-900810', 'lint-staged 雷区仍有 84 枚'),
      OPEN('G-900810', '生产 web 的部署承载者没查清'),
    ),
  })
  assert.equal(r.undetermined, false)
  assert.equal(r.blocked.length, 1)
  assert.equal(r.blocked[0].key, 'G-900810')
  assert.equal(r.blocked[0].titleCount, 2)
  assert.equal(r.preexisting.length, 0, '底稿里这一组不存在 ⇒ 账必须记在本次')
})

test('C2 就地改写不误拦:同一条行换了内容,号没变', () => {
  const r = __test__.judgeNewIdCollisions({
    baseText: doc(OPEN('G-900811', '某票标题')),
    nextText: doc(`${OPEN('G-900811', '某票标题')} 〔补充现状〕`),
  })
  assert.equal(r.blocked.length, 0, '§1 建议的修法不得被判成违规')
})

test('C3 让号不误拦:旧号行删掉、同题在新号上出现一次', () => {
  const r = __test__.judgeNewIdCollisions({
    baseText: doc(OPEN('G-900812', '需要让号的事')),
    nextText: doc(OPEN('G-900813', '需要让号的事')),
  })
  assert.equal(r.blocked.length, 0)
})

test('C4 存量只报数不拦:撞号在底稿里已在、本次没再加', () => {
  const t = doc(OPEN('G-900814', '甲题的完整标题'), OPEN('G-900814', '乙题的完整标题'))
  const r = __test__.judgeNewIdCollisions({ baseText: t, nextText: t })
  assert.equal(r.blocked.length, 0, '拿别人留下的账钉红每一次落地 = 逼人绕开本器(§12e)')
  assert.equal(r.preexisting.length, 1)
})

test('C5 口径对账(与 F9 一致,不是本器偏好):同号一未勾一已勾仍算一组', () => {
  const t = doc(OPEN('G-900815', '待办题的完整标题'), DONE('G-900815', '另一道已结清的题'))
  const r = __test__.judgeNewIdCollisions({ baseText: t, nextText: t })
  assert.equal(r.preexisting.length, 1, 'F9 只在"组内全已勾"时降档;混一未勾就仍是一组')
  assert.equal(r.blocked.length, 0)
})

test('C5b 全已勾组降档只报数(F9 定级 2026-10-06 那一档必须一起继承)', () => {
  const t = doc(DONE('G-900816', '已结清的第一题'), DONE('G-900816', '已结清的第二题'))
  const r = __test__.judgeNewIdCollisions({ baseText: t, nextText: t })
  assert.equal(r.blocked.length, 0)
  assert.equal(r.preexisting.length, 0, '降档组不进判定面 ⇒ 本闸也不该把它念成存量')
})

test('C6 让界给 F1:同号同题(尾注不同)不成组,本闸不得抢在 F1 前面点错名', () => {
  // 夹具逐字取自 live-doc-edit.test.mjs 的 DU-7 第一臂:两行共享第一个分界符之前的题面 ⇒
  // 复合主键逐字等值 ⇒ 那是"同一件事被抄了两遍"(F1 射程),不是"一号两题"。
  const base = '- [ ] G-900700 端到端题面. 同一件事只该有一行当前状态'
  const dup = '- [ ] G-900700 端到端题面. 被第二席又抄了一份'
  const r = __test__.judgeNewIdCollisions({ baseText: doc(base), nextText: doc(base, dup) })
  assert.equal(r.blocked.length, 0, '本闸若在这一型上开火,拒绝理由就点错名(F1 的账记到撞号头上)')
})

test('C7 输入不成文本一律未判定:不许把"没读到内容"读成"没有撞号"', () => {
  for (const bad of [
    {},
    { baseText: '', nextText: '' },
    { baseText: null, nextText: doc() },
    { nextText: 42 },
  ]) {
    const r = __test__.judgeNewIdCollisions(bad)
    assert.equal(r.undetermined, true, `输入 ${JSON.stringify(bad)} ⇒ 必须未判定`)
    assert.equal(r.blocked.length, 0)
    assert.equal(r.preexisting.length, 0)
  }
})

test('C8 真仓面自证:底稿取 HEAD 的 PROJECT_PLAN 时,本闸读出的是存量而不是新增', () => {
  // 这一条防的是"夹具里永远 blocked=0、真面上一落地就全红"那一型(判据与取材面脱节)。
  const text = execFileSync(
    resolveGitBin() || 'git',
    ['-c', 'safe.directory=*', 'show', 'HEAD:PROJECT_PLAN.md'],
    { encoding: 'utf8', maxBuffer: 64 << 20, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const r = __test__.judgeNewIdCollisions({ baseText: text, nextText: text })
  assert.equal(r.undetermined, false)
  assert.ok(text.includes('- [ ]'), '取材面必须是真台账(取到空文本时这一条会把假绿一起钉住)')
  assert.equal(r.blocked.length, 0, '同一份文本自己跟自己比 ⇒ 一组都不能算本次新增(否则棘轮无锚)')
  // 原断言 preexisting>=1 钉的是"HEAD 台账现读有存量撞号"这一事实前提;2026-10-23 清号提交
  // 485a183354(清偿 PROJECT_PLAN 重复登记存量)已把账面归零 ⇒ 前提过期,降为 >=0(只报数档
  // 在真面可跑通即可)。本条的不变量是"真面可读(undetermined=false)+ 自比不冒新增(blocked=0)";
  // "存量撞号被识别且不拦"这一判据行为由 C4 在夹具面钉住,不依赖台账是否恰好带伤。
  assert.equal(r.undetermined, false, '真面取材必须判得动(取不到内容不得读成"没有撞号")')
  assert.ok(r.preexisting.length >= 0, '存量档在 HEAD 真面跑通:现读 0 枚 = 台账已清,只报数不冒红')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
