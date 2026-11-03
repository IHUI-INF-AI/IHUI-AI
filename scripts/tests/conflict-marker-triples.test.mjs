// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/conflict-marker-triples.test.mjs —— `lib/conflict-marker-triples.mjs` 的镜像测试。
 *
 * 钉的是 2026-11-01(MARKERS 票)那一格**两型分开判**:
 *   · 空冲突区(三条标记行逐行相邻、区域内零正文)⇒ 进 `empty` 桶 ⇒ 允许"永不补回";
 *   · 有正文的冲突区 ⇒ 进 `contentBearing` 桶 ⇒ 一条都不许自动扣(守门 79 头注警告的
 *     "手删标记当作已解决 = 把两侧内容之一静默丢掉"正是这一型)。
 * 一律放行与一律禁止都是本票明令禁止的出路,所以两桶的**归属**必须逐型钉死。
 *
 * §22c:判据一律 import 生产 `__test__`,本文件不重写任何判定;标记字面量一律构造,
 * 免得本文件自己进守门 79 的射程(它只自豁免 `check-no-conflict-markers*` 前缀)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as T } from '../lib/conflict-marker-triples.mjs'

const LT = '<'.repeat(7)
const GT = '>'.repeat(7)
const EQ = '='.repeat(7)
const keys = (m) => [...m.keys()]
/** 本文件里出现标记字面量的唯一方式:三段拼起来(行首不是字面量 ⇒ 不进 79 的 P1 射程)。 */
const line = (s) => s

test('T1 空冲突区:三条标记行逐行相邻 ⇒ 全进 empty 桶,contentBearing 为空', () => {
  const text = [line('# 标题'), line('正文'), line(`${LT} cf1fdef`), EQ, line(`${GT} c970ac6`), ''].join(
    '\n',
  )
  const c = T.classifyMarkerTriples(text)
  assert.equal(c.empty.size, 3, '开头/分隔/结尾三条都该在 empty 桶')
  assert.deepEqual(keys(c.empty).sort(), [EQ, `${GT} c970ac6`, `${LT} cf1fdef`].sort())
  assert.equal(c.contentBearing.size, 0, '空区不得同时落进"有正文"桶')
  assert.equal(c.manual.length, 0)
  assert.equal(c.exempt, 0)
})

test('T2 有正文的冲突区:三条标记行进 contentBearing,一条都不进 empty(不许自动扣)', () => {
  const text = [`${LT} HEAD`, 'ours 那一侧的正文', EQ, 'theirs 那一侧的正文', `${GT} feature/x`].join(
    '\n',
  )
  const c = T.classifyMarkerTriples(text)
  assert.equal(c.empty.size, 0, '区域内有正文 ⇒ 绝不能被判成"摘掉不丢内容"')
  assert.equal(c.contentBearing.size, 3)
})

test('T3 成对但缺 ======= 分隔行:形态不可辩护 ⇒ 归 contentBearing(不剥也不扣)', () => {
  const text = [`${LT} HEAD`, 'a', 'b', `${GT} x`].join('\n')
  const c = T.classifyMarkerTriples(text)
  assert.equal(c.empty.size, 0)
  assert.equal(c.contentBearing.size, 2, '只有开头与结尾两行可归桶(分隔行本就不存在)')
  // 与同一份配对实现的既有边界对齐:stripMarkerTriples 对此形态整份不剥(manual 非空)
  const s = T.stripMarkerTriples(text)
  assert.equal(s.stripped, 0)
  assert.ok(s.manual.length > 0, '两把尺子必须对同一形态给出同一方向的答复')
})

test('T4 半截标记(只有开头没有结尾):两桶皆空 + manual 点名,谁也不许据此扣行', () => {
  const text = [`${LT} HEAD`, 'a', EQ, 'b'].join('\n')
  const c = T.classifyMarkerTriples(text)
  assert.equal(c.empty.size, 0)
  assert.equal(c.contentBearing.size, 0)
  assert.equal(c.manual.length, 1, '未配对的开头必须逐条点名')
})

test('T5 SEARCH/REPLACE 合法补丁格式:exempt 计数,两桶都不进(升档不得吃掉既有豁免)', () => {
  const text = [`${LT} SEARCH`, 'one', EQ, 'ONE', `${GT} REPLACE`].join('\n')
  const c = T.classifyMarkerTriples(text)
  assert.equal(c.exempt, 1)
  assert.equal(c.empty.size, 0)
  assert.equal(c.contentBearing.size, 0)
})

test('T6 同文两份空区 ⇒ 重数按多重集累加(键是行原文,不是 trim 后的)', () => {
  const text = [`${LT} a`, EQ, `${GT} b`, '', `${LT} a`, EQ, `${GT} b`].join('\n')
  const c = T.classifyMarkerTriples(text)
  assert.equal(c.empty.get(`${LT} a`), 2)
  assert.equal(c.empty.get(EQ), 2)
})

test('T7 CRLF 文档:键形与 union 的行切分(split("\\n"))同形,绝不漂成第二个键', () => {
  const text = ['# d', `${LT} a`, EQ, `${GT} b`, ''].join('\r\n')
  const c = T.classifyMarkerTriples(text)
  // findMarkerPairs 按 /\r?\n/ 切(拿到干净标记行),classify 的键按 split('\n') 取(带 \r)
  // ⇒ 两侧键都必须来自同一份行数组,否则"空区"永远对不上要扣的那一行。
  assert.equal(c.empty.size, 3, `实际键集:${JSON.stringify(keys(c.empty))}`)
  assert.ok(c.empty.has(`${LT} a\r`), `开头行键必须带 \r(与 union 的行切分同形),实际:${JSON.stringify(keys(c.empty))}`)
  assert.ok(c.empty.has(`${EQ}\r`), `分隔行键必须带 \r,实际:${JSON.stringify(keys(c.empty))}`)
})

test('T8 单独一行 ======= 永不进任何桶(setext 下划线/表格分隔是合法内容)', () => {
  const text = ['小节名', EQ, '| a | b |', '| --- | --- |'].join('\n')
  const c = T.classifyMarkerTriples(text)
  assert.equal(c.empty.size, 0)
  assert.equal(c.contentBearing.size, 0)
  assert.equal(c.exempt, 0)
})

test('T9 同一份文档里两型并存:各归各桶,同文本行两桶都出现(调用方须据此保守不扣)', () => {
  const text = [
    `${LT} HEAD`,
    'ours',
    EQ,
    'theirs',
    `${GT} HEAD`,
    '',
    `${LT} HEAD`,
    EQ,
    `${GT} HEAD`,
  ].join('\n')
  const c = T.classifyMarkerTriples(text)
  assert.equal(c.empty.size, 3, '第二条(空区)的三条标记行该进 empty')
  assert.equal(c.contentBearing.size, 3, '第一条(有正文)的三条标记行该进 contentBearing')
  // 关键形状:标记文本在两型里都出现过 ⇒ 按行文本作键时分不开 ⇒ 上游必须整条不扣。
  assert.ok(c.empty.has(`${LT} HEAD`) && c.contentBearing.has(`${LT} HEAD`))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
