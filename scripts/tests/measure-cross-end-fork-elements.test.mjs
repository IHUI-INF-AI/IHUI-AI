// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 —— 直接 import 源脚本 `__test__`,不复制判据。
// 本文件钉 Phase 4「fork 字号元素级归类」的三条底线:
//   ① 语义判定不得默认放行:样式键不在白/黑名单时必须是 `undetermined`,不是"允许差异"。
//   ② 射程只认档表外取值(fork/missingTier):档内值混进来会让"单侧展示"读数失真。
//   ③ 登记覆盖按元素×键核算:未登记 / 额度不足 / 到期都必须判红,不得只看"有没有登记过"。
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as src } from '../measure-cross-end-fork-elements.mjs'

const { classifyStyleKey, scanElements, allowanceIndex, buildLedger } = src

test('① 语义判定:字形盒/形状/细线归单侧,内容文字归两端对齐,归属不明必须 undetermined', () => {
  // 字形盒:RN 侧字号只是盒尺寸,web 侧由 SVG/图标承载 ⇒ 单侧
  assert.equal(classifyStyleKey('fontSize', 22, 'avatarFallbackText', false), 'rn-only-display')
  assert.equal(classifyStyleKey('fontSize', 22, 'thumbIcon', false), 'rn-only-display')
  assert.equal(classifyStyleKey('fontSize', 32, 'materialSheetClose', false), 'rn-only-display')
  // 正文标题/展示数字:两端同一元素 ⇒ 走 web 对齐清单,不得登记成允许差异
  assert.equal(classifyStyleKey('fontSize', 22, 'title', false), 'web-align')
  assert.equal(classifyStyleKey('fontSize', 28, 'statValue', false), 'web-align')
  assert.equal(classifyStyleKey('fontSize', 22, 'heroTitle', false), 'web-align')
  // 圆角是形状档,RN 单侧造型
  assert.equal(classifyStyleKey('borderRadius', 18, 'thumbClose', false), 'rn-only-shape')
  // 间距:亚像素对齐值单侧,整数值归同一元素
  assert.equal(classifyStyleKey('paddingVertical', 1, 'card', false), 'rn-only-hairline')
  assert.equal(classifyStyleKey('marginTop', 2.5, 'card', false), 'rn-only-hairline')
  assert.equal(classifyStyleKey('paddingVertical', 15, 'card', false), 'web-align')
  // 注释里的数字不是元素
  assert.equal(classifyStyleKey('fontSize', 32, '(none)', true), 'comment-noise')
  // 关键反向锁:没见过的样式键不得默认放行(§0.3)
  assert.equal(classifyStyleKey('fontSize', 22, 'mysteryBox', false), 'undetermined')
  assert.equal(classifyStyleKey('fontSize', 22, '(none)', false), 'undetermined')
})

test('② 逐处扫描:注释行单列,样式键按最近的花括号头上溯', () => {
  const text = `
  const s = StyleSheet.create({
    title: {
      fontSize: 28,
      // fontSize: 32 是历史值,已被本票取代
    },
    avatarFallbackText: { fontSize: 32 },
  })`
  const els = scanElements(['a.tsx'], (p) => (p === 'a.tsx' ? text : null))
  assert.equal(els.length, 3, '两条真值 + 一条注释噪声')
  const comment = els.find((o) => o.isComment)
  assert.equal(comment?.class, 'comment-noise', '注释里的数字不得算元素')
  assert.equal(comment?.styleKey, '(none)', '注释行不得上溯样式键(否则会把注释记到别的元素账上)')
  const title = els.find((o) => o.val === 28)
  assert.equal(title?.styleKey, 'title')
  assert.equal(title?.class, 'web-align')
  const avatar = els.find((o) => o.val === 32 && !o.isComment)
  assert.equal(avatar?.styleKey, 'avatarFallbackText')
  assert.equal(avatar?.class, 'rn-only-display')
})

test('③ 台账射程与覆盖:档内值不得混入;单侧必须有登记且额度足、未到期', () => {
  const elements = [
    { prop: 'fontSize', val: 22, file: 'apps/mobile-rn/src/components/UserInfoCard.tsx', styleKey: 'avatarFallbackText', isComment: false, class: 'rn-only-display' },
    { prop: 'fontSize', val: 22, file: 'apps/mobile-rn/src/components/UserInfoCard.tsx', styleKey: 'avatarFallbackText', isComment: false, class: 'rn-only-display' },
    { prop: 'fontSize', val: 22, file: 'apps/mobile-rn/src/screens/Home.tsx', styleKey: 'title', isComment: false, class: 'web-align' },
    { prop: 'fontSize', val: 14, file: 'apps/mobile-rn/src/screens/Home.tsx', styleKey: 'body', isComment: false, class: 'web-align' }, // 档内值
    { prop: 'fontSize', val: 22, file: 'apps/mobile-rn/src/screens/Home.tsx', styleKey: 'mysteryBox', isComment: false, class: 'undetermined' },
  ]
  const tierRows = [
    { kind: 'fontSize', prop: 'fontSize', val: 22, n: 4, state: 'fork' },
    { kind: 'fontSize', prop: 'fontSize', val: 14, n: 9, state: 'inTier' }, // 不在射程
  ]
  const allowedEntries = [
    {
      component: 'UserInfoCard.avatarFallbackText',
      key: 'styleTier:fontSize:fontSize:22',
      platform: 'rn',
      count: 2,
      expires: '2027-03-27',
    },
  ]
  const ledger = buildLedger({ face: 'head', elements, tierRows, allowedEntries, today: '2026-11-02' })
  assert.equal(ledger.summary.elements, 4, '档内值(fontSize 14)必须被射程过滤掉')
  assert.equal(ledger.summary.forkRows, 1)
  assert.equal(ledger.summary.forkOccurrences, 4, '分叉行处数取自档位尺,不是台账自己的元素计数')
  assert.equal(ledger.allowanceCoverage.ok, true, '额度 2 ≥ 实测 2 且未到期 ⇒ 覆盖成立')
  assert.equal(ledger.undetermined.length, 1, '归属不明必须单列,不得默认归进允许差异')
  assert.equal(ledger.undetermined[0].styleKey, 'mysteryBox')

  // 额度不足 / 到期 / 未登记三条出口各自判红
  const short = buildLedger({
    face: 'head',
    elements,
    tierRows,
    allowedEntries: [{ ...allowedEntries[0], count: 1 }],
    today: '2026-11-02',
  })
  assert.equal(short.allowanceCoverage.short.length, 1, '额度 1 < 实测 2 必须报额度不足')
  assert.equal(short.allowanceCoverage.ok, false)
  const expired = buildLedger({
    face: 'head',
    elements,
    tierRows,
    allowedEntries: [{ ...allowedEntries[0], expires: '2026-01-01' }],
    today: '2026-11-02',
  })
  assert.equal(expired.allowanceCoverage.expired.length, 1, '到期必须判红(白名单不得腐化)')
  const missing = buildLedger({ face: 'head', elements, tierRows, allowedEntries: [], today: '2026-11-02' })
  assert.equal(missing.allowanceCoverage.missing.length, 1, '未登记必须判红')
  // web-align 不得被登记成允许差异(它走对齐清单,不是白名单)
  assert.equal(missing.allowanceCoverage.missing[0].component, 'UserInfoCard.avatarFallbackText')
})

test('④ 额度索引:component×key 逐条累加,到期取最早;非 styleTier/形状坏跳过', () => {
  const idx = allowanceIndex([
    { component: 'A.title', key: 'styleTier:fontSize:fontSize:28', count: 1, expires: '2027-03-27' },
    { component: 'A.title', key: 'styleTier:fontSize:fontSize:28', count: 2, expires: '2026-12-01' },
    { component: 'A.title', key: 'geometry', count: 3, expires: '2027-01-01' },
    { component: 'A.title', key: 'styleTier:fontSize:fontSize:28', count: 0, expires: '2027-03-27' },
  ])
  assert.equal(idx.size, 1)
  assert.equal(idx.get('A.title|styleTier:fontSize:fontSize:28').count, 3, '同元素同键额度累加')
  assert.equal(idx.get('A.title|styleTier:fontSize:fontSize:28').expires, '2026-12-01', '到期取最早')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
