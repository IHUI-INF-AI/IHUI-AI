// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// audit-aligned-domain-drift.mjs 的镜像测试(§22c:import 源脚本 __test__,零复算)。
//
// 钉的是"域错配"这一个判据的**形状**:同域放过、不同域点名、裸路径也认、抽不到端点落"判不出"
// (这才是 news 那次被记成 aligned 时没人发现的原因 —— 两端都能调通,只是不是同一个后端域)。
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as A } from '../audit-aligned-domain-drift.mjs'

const row = (o = {}) => ({
  web: 'x',
  status: 'aligned',
  rn: 'apps/mobile-rn/src/screens/X.tsx',
  ...o,
})

test('M1 同域 ⇒ ok', () => {
  assert.equal(
    A.classifyRow(row(), "apiOrThrow('/api/news/list')", "fetchApi('/api/news/x')").kind,
    'ok',
  )
})

test('M2 阳性对照:两套后端域 ⇒ suspect(news 那次的真实形态)', () => {
  const r = A.classifyRow(row(), "apiOrThrow('/api/news/articles')", "fetchApi('/api/articles')")
  assert.equal(r.kind, 'suspect')
  assert.equal(r.web, 'news')
  assert.equal(r.rn, 'articles')
})

test('M3 RN 裸路径(fetchApi(`/circles`))也认,不制造假红', () => {
  assert.equal(
    A.classifyRow(row(), "apiOrThrow('/api/circles')", 'fetchApi(`/circles`)').kind,
    'ok',
  )
})

test('M4 web 侧抽不到端点 ⇒ 判不出,绝不并进可疑', () => {
  assert.equal(A.classifyRow(row(), 'const a = 1', "fetchApi('/api/x')").kind, 'undecidable')
})

test('M5 文件取不到 ⇒ 判不出(不是 ok)', () => {
  assert.equal(A.classifyRow(row(), null, "fetchApi('/api/x')").kind, 'undecidable')
})

test('M6 gap/excluded 行与非 mobile-rn 指针都不进射程', () => {
  assert.equal(
    A.classifyRow(row({ status: 'gap' }), "apiOrThrow('/api/a')", "fetchApi('/api/b')").kind,
    'skip',
  )
  assert.equal(
    A.classifyRow(
      row({ rn: 'packages/app/src/x.tsx' }),
      "apiOrThrow('/api/a')",
      "fetchApi('/api/b')",
    ).kind,
    'skip',
  )
})

test('M7 首段归一:/api 前缀剥掉、空段剔除', () => {
  assert.equal(A.firstSeg('/api/news/articles'), 'news')
  assert.equal(A.firstSeg('/circles'), 'circles')
  assert.deepEqual(
    [...A.endpointSegs("fetchApi('/api/x/1'); fetchApi(`/y/2`)", { bare: true })].sort(),
    ['x', 'y'],
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
