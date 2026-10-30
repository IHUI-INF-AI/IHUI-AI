// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SEEDABLE, __test__, buildShell } from '../gen-rn-host-shell.mjs'

const { MARK, symbolOf } = __test__

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
