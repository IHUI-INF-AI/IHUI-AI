// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:G-952 缺陷 A —— 归并档"行尾沿革"剥离必须只剥**最后一次**出现。
// 判据全部 import 生产实现:折叠产物由 buildTwinFold / buildDriftFold 现造,
// 剥离走 lib/plan-merge-annotation.mjs 的 stripLastTail,本文件不抄第二份沿革形状。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as M } from '../plan-tasks-merge.mjs'
import { titleOf } from '../lib/plan-task-index.mjs'
import { stripLastTail } from '../lib/plan-merge-annotation.mjs'

const DATE = '2026-10-22'

/**
 * 沿革形状 = `{ anchors, pattern }`。anchor 是该形态的起点字面量(与 buildTwinFold /
 * buildDriftFold 的沿革构造同源),贪婪段一律取生产常量 `TWIN_TAIL_RE` —— 不在测试里
 * 再写一份正则(§22c:两处算同一件事必须共用一份实现)。
 * 段首锚定 `^` 是 stripLastTail 的契约:传进去的是 `slice(最右 anchor)` 这一段。
 */
const KEYED_TAIL = { anchors: [' (原编号 '], pattern: new RegExp(`^${M.TWIN_TAIL_RE.source}`) }

/** 只剥行首的折叠注记(复选框之后那一段),沿革原样留着 —— 缺陷就发生在沿革这一层。 */
function stripLeadNote(line, noteRe) {
  const lead = M.CHECKBOX_LEAD_RE.exec(line)?.[1] ?? ''
  const rest = line.slice(lead.length)
  return noteRe.test(rest) ? lead + rest.replace(noteRe, '') : line
}

// 设计两对样本的形态(来源:设计面 HEAD blob 10aee4eaa8 里 G-8/G-221 与 68/G-53 两族;
// 长正文按同一形态收短,但"正文中间已有一条沿革 + 折叠后再在行尾追加一条"这两件原样保留)。
const TWIN_KEEPER =
  '- [ ] G-8 **本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败** —— 五条红在他人持有面。'
const TWIN_COPY =
  '- [ ] 〔归:一处恒红门已当场修掉〕 **G-221 本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败** 〔让号记录(2026-10-02 F9 清偿批②):原号 G-580 同号多题,本行正文除编号位与本记录外逐字未动。〕 (原编号 G-221;持有行题面「本批全量终审186项=173通过/5警告/8失败」) 〔改号(2026-10-14):原G-1018298〕 〔压缩@2026-10-22〕'
const DRIFT_KEEPER = '- [ ] G-53 流式中切换模型→终止后自动带入新模型 —— 三端已消费,只欠真会话留痕。'
const DRIFT_COPY =
  '- [ ] 68. 流式中切换模型 → 终止后自动带入新模型 〔让号记录(2026-10-02 F9 清偿批②):原号 68 同号多题,本行正文除编号位与本记录外逐字未动。〕 (原编号 68;持有行题面「流式中切换模型→终止后自动带入新模型」) 〔改号(2026-10-14):原G-1038307〕 〔压缩@2026-10-22〕'

test('stripLastTail:G-8/G-221 孪生折叠产物里正文中间已有沿革,只剥行尾那一层 ⇒ 逐字回底稿', () => {
  const after = M.buildTwinFold(TWIN_COPY, TWIN_KEEPER, DATE)
  assert.ok(after, '生产构造器给不出折叠产物 ⇒ 样本失效')
  const noNote = stripLeadNote(after, M.TWIN_NOTE_RE)
  assert.notEqual(noNote, after, '行首注记没剥掉 ⇒ 这一臂测的不是沿革层')
  const tail = noNote.slice(TWIN_COPY.length)
  assert.ok(
    KEYED_TAIL.pattern.test(tail),
    `行尾那一条沿革必须由生产形状认得出:${JSON.stringify(tail)}`,
  )
  assert.equal(stripLastTail(noNote, KEYED_TAIL), TWIN_COPY)
})

test('stripLastTail:68/G-53 漂开归并产物同一手术(正文中间同样带一条旧沿革)', () => {
  const after = M.buildDriftFold(DRIFT_COPY, titleOf(DRIFT_KEEPER), DATE)
  assert.ok(after, '生产构造器给不出漂开折叠产物 ⇒ 样本失效')
  const noNote = after.replace(M.driftedFoldNote(DATE), '')
  assert.notEqual(noNote, after, '行首注记没剥掉 ⇒ 这一臂测的不是沿革层')
  assert.equal(stripLastTail(noNote, KEYED_TAIL), DRIFT_COPY)
})

test('双尾不过剥:两条沿革相邻时只剥最后一条,逐次调用才回到第一层', () => {
  const after = M.buildTwinFold(TWIN_COPY, TWIN_KEEPER, DATE)
  const noNote = stripLeadNote(after, M.TWIN_NOTE_RE)
  const tail = noNote.slice(TWIN_COPY.length)
  const twice = `${TWIN_COPY}${tail}${tail}`
  assert.equal(stripLastTail(twice, KEYED_TAIL), `${TWIN_COPY}${tail}`, '一次性剥掉两条就是过剥')
  assert.equal(stripLastTail(stripLastTail(twice, KEYED_TAIL), KEYED_TAIL), TWIN_COPY)
})

test('反控:形状不符一律原样返回 —— 不回落贪婪、不猜次右起点', () => {
  const noTail = '- [ ] G-9 正文里没有任何沿革'
  assert.equal(stripLastTail(noTail, KEYED_TAIL), noTail)
  // anchor 命中但**不在行尾**(后面还有正文):旧贪婪会从这里吃到行尾,新手术必须原样返回
  const midAnchor = '- [ ] G-9 正文提到 (原编号 G-9;持有行题面「甲」) 后面还有正文'
  assert.equal(stripLastTail(midAnchor, KEYED_TAIL), midAnchor)
  // 行尾有 anchor 但不是沿革形状(缺 `;持有行题面「…」`)
  const malformed = '- [ ] G-9 正文 (原编号 G-9)'
  assert.equal(stripLastTail(malformed, KEYED_TAIL), malformed)
  // 不给形状 ⇒ 不做任何猜测
  assert.equal(stripLastTail(noTail, undefined), noTail)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
