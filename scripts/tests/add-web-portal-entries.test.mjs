// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// add-web-portal-entries.mjs 的镜像测试(§22c:判据 import 源脚本 __test__,禁止在测试里复算)。
//
// 立因:本会话手工收三批门户条目时,一次按**滞后工作树副本**整文件重写十份词包,静默删掉他人已
// 入库的 586/1336 枚键 —— 该失败形态语法/格式/类型三重不响。器物化时把"以被审面 blob 为底 +
// 键级零丢失断言"钉成判据,本文件钉住它在缺陷形态下**真的会拒**(而不是只在正确面上报绿)。
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as X } from '../add-web-portal-entries.mjs'

const PORTAL = `export const WEB_PORTAL_SECTIONS = [
  {
    titleKey: 'webViewPortal.sections.more',
    fallbackLabel: '更多',
    entries: [
      {
        key: 'existing-one',
        titleKey: 'webViewPortal.existingOne',
        path: '/feature-center',
        domain: 'feature-center',
        fallbackLabel: '能力中心',
      },
    ],
  },
]
`
const PACK = `{\n  "webViewPortal": {\n    "title": "Portal"\n  }\n}\n`
const entry = (over = {}) => ({
  path: '/brand-new-zzz',
  key: 'brandNew',
  section: 'more',
  labels: { 'zh-CN': '甲', 'zh-TW': '甲', en: 'A', ja: 'あ', ko: '아' },
  ...over,
})

test('M1 被审面读不到 ⇒ 未判定,绝不回落另一个面(§0.3/§0.4)', () => {
  assert.equal(X.faceBlob('nope-rev', X.PORTAL_REL), null)
  const r = X.run({ face: 'nope-rev', file: 'no-such-file.jsonl' })
  assert.equal(r.state, 'undetermined')
})

test('M2 幻影门户链接被拒:路由不在被审面就不落盘', () => {
  const why = X.checkEntries([entry({ path: '/definitely-not-a-route-zzz' })], PORTAL, 'HEAD')
  assert.match(String(why), /web 路由不存在/)
})

test('M3 已在表的 path 重加被拒(否则门户清单会长两份)', () => {
  assert.match(
    String(X.checkEntries([entry({ path: '/feature-center' })], PORTAL, 'worktree')),
    /已有此 path/,
  )
})

test('M4 语言缺档被拒:五语言不齐不落', () => {
  const e = entry({ labels: { 'zh-CN': '甲', en: 'A', ja: 'あ', ko: '아' } })
  assert.match(String(X.checkEntries([e], PORTAL, 'worktree')), /缺 1 种语言/)
})

test('M5 门户表插入:旧 path 全在 ∧ 恰 +1 ∧ entry key 无重', () => {
  const r = X.buildPortalText(PORTAL, [entry()], 'more')
  assert.ok(!r.error, r.error)
  assert.equal(X.portalPaths(r.text).size, 2)
  assert.ok(X.portalPaths(r.text).has('/feature-center'), '旧条目被挤掉就是内容损失')
  assert.deepEqual(
    X.portalKeys(r.text).filter((k, i, a) => a.indexOf(k) !== i),
    [],
  )
})

test('M6 段锚点缺失 ⇒ 拒,不猜插入位置', () => {
  assert.match(String(X.buildPortalText(PORTAL, [entry()], 'nonexistent').error), /段落锚点缺失/)
})

test('M7 词包插入断言"旧键集 ⊆ 新键集 ∧ 差集恰为本票枚数"(钉死上一枚事故的那条形变)', () => {
  const r = X.buildPackText(PACK, [entry()], 'en')
  assert.ok(!r.error, r.error)
  const before = X.flatKeys(JSON.parse(PACK))
  const after = X.flatKeys(JSON.parse(r.text))
  assert.deepEqual(
    [...before].filter((k) => !after.has(k)),
    [],
  )
  assert.deepEqual(
    [...after].filter((k) => !before.has(k)),
    ['webViewPortal.brandNew'],
  )
})

test('M8 同名键已在位 ⇒ 不重加(重复键会被 JSON.parse 后写静默遮蔽)', () => {
  const base = `{\n  "webViewPortal": {\n    "brandNew": "A"\n  }\n}\n`
  assert.match(String(X.buildPackText(base, [entry()], 'en').error), /承接不干净/)
})

test('M9 锚点失效(词包没有 webViewPortal 块)⇒ 拒,不新建块', () => {
  assert.match(String(X.buildPackText('{}\n', [entry()], 'en').error), /锚点/)
})

test('M10 空清单判死而非判绿(枚举到 0 个候选)', () => {
  assert.equal(X.run({ face: 'HEAD', file: '' }).state, 'undetermined')
})

test('M11 默认档不落盘:pending 只报数', () => {
  const r = X.run({ face: 'HEAD', file: '' })
  assert.ok(['undetermined', 'pending', 'refused'].includes(r.state))
  assert.notEqual(r.state, 'applied', '未给 --apply 却落盘 = 把演练当交付')
})

test('M12 装车形状:§22d 直执行守卫在位,判据只在源脚本一份', () => {
  const src = X.faceBlob('worktree', 'scripts/add-web-portal-entries.mjs')
  assert.ok(
    src && /const isDirectRun = process\.argv\[1\]/.test(src),
    '无 isDirectRun 守卫 ⇒ 测试 import 即跑主流程',
  )
  assert.ok(/export const __test__ =/.test(src), '未导出 __test__ ⇒ 镜像只能复算判据(§22c)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
