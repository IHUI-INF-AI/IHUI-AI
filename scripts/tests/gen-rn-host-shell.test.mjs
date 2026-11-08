// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SEEDABLE, __test__, buildShell } from '../gen-rn-host-shell.mjs'

const { MARK, symbolOf, classify, drifted, staleShells } = __test__

const ABOUT = 'packages/app/src/features/about/AboutScreen.tsx'

test('symbolOf 取文件 basename 作导出名(含三层目录)', () => {
  assert.deepEqual(symbolOf(ABOUT), { component: 'AboutScreen', shared: 'SharedAboutScreen' })
  assert.deepEqual(symbolOf('packages/app/src/features/tools/pdf/PdfToolsHubScreen.tsx'), {
    component: 'PdfToolsHubScreen',
    shared: 'SharedPdfToolsHubScreen',
  })
})

test('buildShell 的 import 别名与真相源注释都指向该共享屏', () => {
  const src = buildShell(ABOUT, ['t', 'colorScheme', 'onBack'])
  assert.match(src, /import \{ AboutScreen as SharedAboutScreen \} from '@ihui\/rn-app'/)
  assert.match(src, /真相源 about\/AboutScreen\.tsx/)
  assert.match(src, /export function AboutScreen\(\)/)
  assert.ok(src.includes(MARK), '生成物必须带 @gen-rn-host-shell 标记,否则 R3 判不出被手改')
})

test('buildShell 的腿序按 取词→主题→返回,不是字母序', () => {
  const src = buildShell(ABOUT, ['onBack', 'colorScheme', 't'])
  const iT = src.indexOf('t={t}')
  const iScheme = src.indexOf('colorScheme={resolvedTheme}')
  const iBack = src.indexOf('onBack={() => navigation.goBack()}')
  assert.ok(
    iT > 0 && iScheme > iT && iBack > iScheme,
    `腿序应为 t → colorScheme → onBack,实际 ${iT}/${iScheme}/${iBack}`,
  )
})

test('buildShell 只发注入腿,不臆造业务数据', () => {
  const src = buildShell(ABOUT, ['t', 'onBack'])
  assert.equal((src.match(/=\{/g) || []).length, 2, '只应有两枚注入腿')
  assert.doesNotMatch(src, /items=|loading=|onRefresh=/, '不得凭空生成数据腿')
})

test('SEEDABLE 只含平台可注入腿,不含端上事实', () => {
  for (const leg of ['t', 'colorScheme', 'onBack', 'onClose', 'onDismiss']) {
    assert.ok(SEEDABLE.has(leg), `${leg} 应可注入`)
  }
  for (const leg of ['onRetry', 'entries', 'items', 'onSubmit', 'onPressItem']) {
    assert.ok(!SEEDABLE.has(leg), `${leg} 不是平台可注入腿,必须归 needs-manual`)
  }
})

test('零腿壳不声明任何平台 hook —— 旧模板把 t/resolvedTheme/navigation 全取出来却不传(未使用变量)', () => {
  const src = buildShell(ABOUT, [])
  for (const hook of ['useI18n', 'useTheme', 'useNavigation']) {
    assert.ok(!src.includes(hook), `零腿壳不得声明 ${hook},否则取了变量却没传`)
  }
  assert.match(src, /<SharedAboutScreen \/>/, '零腿壳应单行自闭合,不留空 body')
})

test('只含 t 的壳只声明 useI18n:取的每枚变量都在 JSX 里有对应传参', () => {
  const src = buildShell(ABOUT, ['t'])
  assert.match(src, /const \{ t \} = useI18n\(\)/)
  assert.doesNotMatch(src, /useTheme|useNavigation/, '没有主题/返回腿就不得取这两个 hook')
  assert.match(src, /t=\{t\}/)
})

test('三枚自动分支共享屏:可注入腿按 t/colorScheme/onBack 正确接线,数据腿让生壳器拒绝(不产空壳)', () => {
  const specs = [
    'packages/app/src/features/finance/FinanceScreen.tsx',
    'packages/app/src/features/following/FollowingScreen.tsx',
    'packages/app/src/features/help-detail/HelpDetailScreen.tsx',
  ]
  for (const spec of specs) {
    const c = classify(spec)
    assert.equal(c.kind, 'needs-manual', `${spec} 带业务数据腿,不得被当成可生成的空壳`)
    assert.ok(c.hard.length > 0, `${spec} 必须点名缺哪几条数据腿`)
    const injectable = c.legs.filter((leg) => SEEDABLE.has(leg))
    assert.ok(injectable.includes('t') && injectable.includes('colorScheme') && injectable.includes('onBack'))
    const src = buildShell(spec, injectable)
    assert.match(src, /t=\{t\}/)
    assert.match(src, /colorScheme=\{resolvedTheme\}/)
    assert.match(src, /onBack=\{\(\) => navigation\.goBack\(\)\}/)
    assert.doesNotMatch(src, /=\{undefined\}/, '不得把不能注入的腿写成 undefined')
  }
})

test('R3:屏已不可 seedable 的生成物算陈旧 —— 空 props 旧壳不再被静默跳过', () => {
  const registry = [{ shared: ABOUT, rn: 'apps/mobile-rn/src/screens/AboutScreen.tsx' }]
  const stale = buildShell(ABOUT, []) // 模拟旧版本产出的空 props 壳(仍带 @gen-rn-host-shell 标记)
  assert.ok(stale.includes(MARK))
  const out = drifted(
    registry,
    () => ({ kind: 'needs-manual', legs: ['t'], hard: ['items', 'onRefresh'] }),
    () => stale,
  )
  assert.equal(out.length, 1, '带标记但契约已不可复现的壳必须报陈旧')
  assert.match(out[0].why, /needs-manual/)
})

test('R3 反面:可 seedable 且逐字节可复现的生成物不报漂移', () => {
  const registry = [{ shared: ABOUT, rn: 'apps/mobile-rn/src/screens/AboutScreen.tsx' }]
  const legs = ['t', 'colorScheme', 'onBack']
  const fresh = buildShell(ABOUT, legs)
  const out = drifted(registry, () => ({ kind: 'seedable', legs, hard: [] }), () => fresh)
  assert.equal(out.length, 0)
})

test('孤儿生成物:不在登记表、带标记但契约已 not-applicable 的空壳也必须被点名', () => {
  const stale = buildShell(ABOUT, []) // 旧版产出的空 props 壳,仍带 @gen-rn-host-shell 标记与 --screen 溯源行
  const out = staleShells(
    () => ['AboutScreen.tsx', 'PlainScreen.tsx'],
    (name) => (name === 'AboutScreen.tsx' ? stale : 'export function PlainScreen() { return null }\n'),
    () => ({ kind: 'needs-manual', legs: ['t'], hard: ['items', 'onRefresh'] }),
  )
  assert.equal(out.length, 1, '只有带标记的生成物参与对账')
  assert.equal(out[0].rn, 'apps/mobile-rn/src/screens/AboutScreen.tsx')
  assert.match(out[0].why, /needs-manual/)
})

test('孤儿生成物反面:可 seedable 且逐字节可复现的壳不报陈旧', () => {
  const legs = ['t', 'colorScheme', 'onBack']
  const fresh = buildShell(ABOUT, legs)
  const out = staleShells(
    () => ['AboutScreen.tsx'],
    () => fresh,
    () => ({ kind: 'seedable', legs, hard: [] }),
  )
  assert.equal(out.length, 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
