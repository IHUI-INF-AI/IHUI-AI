// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/lib/key-retractions.mjs 的镜像测试(§22c:判据 import 源脚本 __test__,不复制)。
// 这张台账是"免检通道",所以每条断言都朝同一个方向问:**判不出时它必须不免**。

import test from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as lib } from '../lib/key-retractions.mjs'

const {
  retractionValidity,
  retractionId,
  parseRetractions,
  indexRetractions,
  serializeRetractions,
} = lib

const OK = {
  page: 'pages/study/record',
  spec: 'packages/app/src/features/study-record/StudyRecordScreen.tsx',
  key: 'studyRecord.duration',
  reason: '列表 duration 恒 0,渲染它等于渲染假时长',
  evidence: 'apps/api/src/routes/user/study-routes.ts:56 在列表 map 里写死 duration: 0',
  at: '2026-10-30',
  expires: '2099-01-01',
  source: 'f526a1a143',
}

test('K1 正例:三要素齐备且未到期 ⇒ 成立(免这一枚键)', () => {
  assert.equal(retractionValidity(OK), null)
})

test('K2 阳性对照必须是"摘掉即翻红":同一行逐字段剥,任一剥掉都不成立', () => {
  const mutations = [
    ['缺 page', { ...OK, page: '' }],
    ['缺 spec', { ...OK, spec: undefined }],
    ['缺 key', { ...OK, key: null }],
    ['缺 reason', { ...OK, reason: '  ' }],
    ['缺 evidence', { ...OK, evidence: undefined }],
    ['出处过短(等于没写出处)', { ...OK, evidence: '后端不出' }],
    ['缺 expires', { ...OK, expires: '' }],
    ['expires 形态坏', { ...OK, expires: '2099-1-1' }],
    ['expires 不是日历日', { ...OK, expires: '2099-02-30' }],
  ]
  for (const [what, row] of mutations) {
    assert.notEqual(retractionValidity(row), null, `该拒不拒:${what}`)
  }
})

test('K3 到期即失效:过期行的失效方向是"多要一次说明",不是"继续免"(§0.7/§0.10)', () => {
  const why = retractionValidity({ ...OK, expires: '2020-01-01' })
  assert.match(String(why), /已到期/)
})

test('K4 免检身份是三元组:页面/共享屏/键任一不同 ⇒ 不同身份(不得串门豁免)', () => {
  const a = retractionId(OK)
  assert.notEqual(a, retractionId({ ...OK, page: 'pages/study/plan' }))
  assert.notEqual(a, retractionId({ ...OK, spec: 'packages/app/src/features/x/XScreen.tsx' }))
  assert.notEqual(a, retractionId({ ...OK, key: 'studyRecord.count' }))
  assert.equal(a, retractionId({ ...OK, reason: '换了个说法', source: '别的提交' }))
})

test('K5 坏行不静默丢:读不出归 bad,由调用方按"这一格没判"处理(§0.3)', () => {
  const { rows, bad } = parseRetractions(`${JSON.stringify(OK)}\n{坏行\n\n`)
  assert.equal(rows.length, 1)
  assert.equal(bad.length, 1)
  assert.match(bad[0].why, /非 JSON/)
})

test('K6 分桶三态:成立进 active,不成立进 refused 并点名,坏行进 bad —— 任何一格都不折成"全都免了"', () => {
  const idx = indexRetractions(
    [OK, { ...OK, page: 'pkg-ai/developer/income', expires: '2020-01-01' }],
    [{ raw: '{坏行', why: '非 JSON' }],
  )
  assert.equal(idx.active.size, 1)
  assert.equal(idx.refused.length, 1)
  assert.match(idx.refused[0].why, /已到期/)
  assert.equal(idx.bad.length, 1)
  assert.equal(idx.total, 2)
})

test('K7 同键重复登记:第二条不扩覆盖面,且点名(否则台账读起来像有两档裁决)', () => {
  const idx = indexRetractions([
    OK,
    { ...OK, evidence: '另一份出处,长度也够二十字以上了真的够了吧' },
  ])
  assert.equal(idx.active.size, 1)
  assert.ok(idx.refused.some((x) => /重复登记/.test(x.why)))
})

test('K8 序列化键序固定:同一行两次落盘逐字节相同(diff 只随内容变)', () => {
  const once = serializeRetractions([OK])
  const shuffled = serializeRetractions([Object.fromEntries([...Object.entries(OK)].reverse())])
  assert.equal(once, shuffled)
})

test('K9 台账路径单源:消费方不得自己再拼一遍字面量(§0.6)', () => {
  assert.equal(lib.RETRACTIONS_PATH, 'scripts/data/miniapp-key-retractions.jsonl')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
