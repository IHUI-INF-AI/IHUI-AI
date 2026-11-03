// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/plan-pointer-purge-gate130.test.mjs —— §22c 镜像:清偿器「落地前自算守门 130 增量」那一格。
//
// 立因(G-07,2026-10-29):旁路落地走 commit-tree + CAS,**结构上不触发任何钩子** ⇒ 守门 130
// 差值棘轮的"新增"维在落地那一刻没有任何人计算;清偿器把「剥注记后第一次露出的同题副本」
// 整批写进 HEAD,账面要到下一次全量档才红(票面现读 6 组 F4 + 3 组 F4b + 1 组 F9 撞号)。
//
// 本文件钉两件事,缺一不算装车:
//  ① **判据有牙**:F4 / F4b / F9 三维各自的阳性夹具必须判红并逐条点名;同一对文本上
//     `verifyPurge`(既有 A1-A5)必须判绿 —— 这就是"修前会把增量放进 HEAD、修后拒落"的机器证据
//     (A5 在**剥注记归一化**的两面上比,量的不是同一件事;G-07 的盲区正长在这个差别里)。
//  ② **判据装车**:源码(屏蔽注释后)里 `gate130Delta` 必须同时出现在首轮与 CAS 重算轮,
//     且都排在 `commitTreeWithIndex(` 之前 —— 造好没装车 = 没有(AGENTS §0.9)。
//
// 全部判据 import 源脚本的 `__test__`,本文件不得复制第二份(§22c)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { maskComments } from '../lib/code-mask.mjs'
import { __test__ as T, stripMergeNotes } from '../plan-pointer-purge.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = (rel) => readFileSync(join(HERE, '..', rel), 'utf8')
const CODE = (rel) => maskComments(SRC(rel))

/** 指针注记的唯一现场措辞(与 `plan-pointer-purge.mjs` 头注里的层定义同字面,不由本文件发明)。 */
const NOTE = '〔【归并】重复登记副本(2026-09-26):与同题那条为准,本行不再单独派单。〕'
/** 公共标题前缀必须**超过 24 字**(TITLE_PREFIX)才能让三行落在同一个复合主键上 —— 短了就各成一组,
 *  夹具会静默变成"什么都没测"(下面 G1 的阳性对照就是用长前缀钉住的)。 */
const COMMON = '同一个任务标题前缀需要超过二十四个字符才能分叉的公共部分'

/** L4 的渲染动作(剥注记保留)在手写面上的等价形态 —— 用它造"待落面"。
 *  判据(哪些行算候选)走源脚本自己的 `isCandidate`,本文件不复制第二份(§22c)。 */
const stripNote = (text) =>
  text
    .split('\n')
    .map((l) => (T.isCandidate(l) ? stripMergeNotes(l) : l))
    .join('\n')

/* ── ① 判据有牙 ── */

test('G1 F4:剥注记让"同键多条待办"第一次露出来 ⇒ 新闸拒落,而既有 A1-A5 判绿(修前放行的现场)', () => {
  const row = (tail, note = '') => `- [ ] G-7 **${COMMON}** ${tail}${note ? ` ${note}` : ''}`
  const face = [row('甲席正文交代'), row('乙席正文交代', NOTE), row('丙席正文交代', NOTE)].join(
    '\n',
  )
  const bare = stripNote(face)
  // 阳性对照先钉住夹具本身:三行必须真落在同一个复合主键下,否则 F4 这一维根本没开始测。
  const d = T.gate130Delta(face, bare)
  assert.equal(d.f4.before, 0, `父面 F4 必须是 0(指针行被 F4 判据剔掉),实测 ${d.f4.before}`)
  assert.equal(d.f4.after, 2, `落地面 F4 必须是 2 条副本,实测 ${d.f4.after}`)
  assert.equal(d.ok, false, '三维任一变多必须判红 —— 否则落地后就要等下一次全量档才发现')
  assert.equal(d.f4.added.length, 2, '新增副本必须逐条点名,不能只报总数')
  assert.match(d.problems.join('\n'), /F4 同题待办副本 \+2 行/, '结论行必须点名维度与增量')
  // 修前会放行的机器证据:既有 A1-A5 在同一对文本上全绿(A5 两侧都剥注记 ⇒ 看不见这次增量)。
  const oldLines = face.split('\n')
  const newLines = bare.split('\n')
  assert.deepEqual(
    T.verifyPurge(oldLines, newLines, T.buildPlan(oldLines, {})),
    [],
    '既有 A1-A5 必须判绿 —— 否则这台夹具证明不了"新闸堵的是一个真窟窿"',
  )
})

test('G2 F4b:剥注记让两条无主键待办变成逐字孪生 ⇒ 新闸拒落,而既有 A1-A5 判绿', () => {
  const b1 = '- [ ] 叙述式待办同一句话足够长用来做逐字孪生夹具一份份'
  const face = [b1, `${b1} ${NOTE}`].join('\n')
  const bare = stripNote(face)
  const d = T.gate130Delta(face, bare)
  assert.equal(d.f4b.before, 0, `父面 F4b 必须是 0(带指针那份被 F4b 判据排除),实测 ${d.f4b.before}`)
  assert.equal(d.f4b.after, 1, `落地面 F4b 必须是 1 条副本,实测 ${d.f4b.after}`)
  assert.equal(d.ok, false, 'F4b 变多同样必须拒落')
  assert.match(d.problems.join('\n'), /F4b 无主键逐字孪生副本 \+1 行/)
  assert.deepEqual(
    T.verifyPurge(face.split('\n'), bare.split('\n'), T.buildPlan(face.split('\n'), {})),
    [],
    '既有 A1-A5 必须判绿(A5 的 F4 维不覆盖 F4b —— 这正是 G-07 票面的 3 组盲区)',
  )
})

test('G3 F9:落地面新出现撞号组 ⇒ 判红并用判据自己的点名尺逐组报名', () => {
  const oldText = '- [ ] G-500 **甲任务标题足够长啊**\n- [ ] G-501 **乙任务标题足够长啊**'
  const newText =
    '- [ ] G-500 **甲任务标题足够长啊**\n- [ ] G-500 **丙任务标题足够长啊**\n- [ ] G-501 **乙任务标题足够长啊**'
  const d = T.gate130Delta(oldText, newText)
  assert.deepEqual(d.f9.before, [], '父面必须无撞号')
  assert.deepEqual(d.f9.after, ['G-500'], '落地面撞号键必须现读为 G-500')
  assert.equal(d.ok, false, 'F9 变多必须拒落')
  assert.match(d.problems.join('\n'), /F9 撞号新增 \+1 组/, '结论行必须点名 F9 维')
  assert.match(d.problems.join('\n'), /G-500/, '必须点名是哪个编号 —— 只给组数等于没点名')
})

test('G4 F9 等量换键:组数不变而键集换了 ⇒ 仍须拦(计数锚点在这一型上恒绿)', () => {
  const a = '- [ ] G-500 **甲任务标题足够长啊**\n- [ ] G-500 **丙任务标题足够长啊**'
  const b = '- [ ] G-502 **甲任务标题足够长啊**\n- [ ] G-502 **丙任务标题足够长啊**'
  const d = T.gate130Delta(a, b)
  assert.equal(d.f9.before.length, 1)
  assert.equal(d.f9.after.length, 1, '组数必须相等 —— 这一条测的就是"计数看不出来"的那一格')
  assert.equal(d.ok, false, '等量换键必须按键集差判红(与守门 130 的基线键集口径同一条)')
  assert.deepEqual(
    d.f9.added.map((g) => g.key),
    ['G-502'],
  )
})

/* ── 反向夹具:无增量必须照常放行 ── */

test('G5 反向:两面同一份文本(零增量)⇒ 必须放行;真实渲染路径的产物同样必须放行', () => {
  const face = '- [ ] G-9 **事甲标题足够长啊** 持有行正文交代'
  assert.equal(T.gate130Delta(face, face).ok, true, '自比较必须绿(否则这是恒红门,§12e)')
  // 真实渲染路径:buildPlan → renderPurge 的产物不得被判成"新增"。
  const lines = face.split('\n')
  const rendered = T.serialize(T.renderPurge(lines, T.buildPlan(lines, {})), '\n')
  assert.equal(T.gate130Delta(face, rendered).ok, true, '器物自己的正常产物不得被自己拦住')
})

/* ── 结论行:未判定不冒充绿,失败逐条点名 ── */

test('G6 未判定必须大声喊出来,不得折成绿也不得冒红', () => {
  const out = []
  T.reportGate130Delta({ ok: false, undetermined: '判据炸了', problems: [] }, (m) => out.push(m))
  const text = out.join('\n')
  assert.match(text, /未判定/, '未判定必须自己说出来(§0.3)')
  assert.match(text, /判据炸了/, '必须点名原因,不许只说"未判定"')
  assert.doesNotMatch(text, /自查失败/, '未判定不得被写成"失败"(那是另一档结论)')
})

test('G7 失败结论行必须把每条问题都点名(不静默、不截断到只剩总数)', () => {
  const out = []
  T.reportGate130Delta(
    {
      ok: false,
      undetermined: '',
      f4: { before: 0, after: 1, added: [] },
      f4b: { before: 0, after: 0, added: [] },
      f9: { before: [], after: [], added: [] },
      problems: ['F4 同题待办副本 +1 行:键=G-7', 'F9 撞号新增 +1 组:编号 G-34'],
    },
    (m) => out.push(m),
  )
  const text = out.join('\n')
  assert.match(text, /F4 0→1 行/, '三维读数必须逐维现读进结论行')
  assert.match(text, /F4 同题待办副本 \+1 行:键=G-7/, '问题清单一字不改地回显')
  assert.match(text, /F9 撞号新增 \+1 组:编号 G-34/)
})

/* ── ② 判据装车(形状锁)── */

test('G8 接线锁:首轮与 CAS 重算轮都必须调 gate130Delta,且都排在 commitTreeWithIndex 之前', () => {
  const code = CODE('plan-pointer-purge.mjs')
  const calls = code.match(/gate130Delta\(/g) || []
  // 1 处定义 + 2 处调用(首轮 / 重算轮)= 3。少一处 = 那一条腿静默不判。
  assert.ok(
    calls.length >= 3,
    `gate130Delta 必须被首轮与重算轮各调一次(连同定义共 ≥3 处),实测 ${calls.length} 处`,
  )
  const firstCommit = code.indexOf('commitTreeWithIndex(')
  assert.ok(firstCommit > 0, 'commitTreeWithIndex 必须仍在源码里(否则本锁的锚点失效)')
  const callSites = [...code.matchAll(/gate130Delta\(/g)].map((m) => m.index)
  assert.ok(
    callSites.filter((i) => i < firstCommit).length >= 2,
    '两处调用必须都排在落地动作之前 —— 排在 commitTreeWithIndex 之后 = 落地后才自查,缝没堵上',
  )
  assert.ok(
    (code.match(/reportGate130Delta\(/g) || []).length >= 3,
    '结论行必须走唯一文案出口(定义 1 处 + 两个调用点各 1 处)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
