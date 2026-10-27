// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:器物 `scripts/upgrade-miniapp-shell-pages.mjs` 与判据层 `scripts/lib/miniapp-end-capabilities.mjs`。
// §22c:判据函数直接 import 源符号,不在测试里复制第二份。
//
// 取证方向(成对,缺一即假绿):
//   · 端能力探测必须**认得出会丢的能力**(支付/登录/选图/分享/下拉刷新/路由参数);
//   · 又必须**不误伤纯导航**(Taro.navigateTo / switchTab 由 rn-compat 覆盖,现读 113 枚壳承载页正常);
//   · 壳选择:同名优先,异名兜底(NewsScreen 渲染 SquareScreen 是仓内既有形态),无壳必须 null。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as caps } from '../lib/miniapp-end-capabilities.mjs'
import { __test__ as up } from '../upgrade-miniapp-shell-pages.mjs'

const RN = new Map([
  ['apps/mobile-rn/src/screens/SettingsScreen.tsx', "import { SettingsScreen } from '@ihui/rn-app'"],
  ['apps/mobile-rn/src/screens/NewsScreen.tsx', "import { SquareScreen } from '@ihui/rn-app'"],
  ['apps/mobile-rn/src/screens/HelpScreen.tsx', "import { HelpScreen } from '@ihui/rn-app'"],
])

test('U1 同名壳优先:即使异名壳也消费同一屏,仍选同名', () => {
  const m = new Map(RN)
  m.set('apps/mobile-rn/src/screens/AltSettingsScreen.tsx', "import { SettingsScreen } from '@ihui/rn-app'")
  const s = up.pickShell(m, 'SettingsScreen')
  assert.equal(s.name, 'SettingsScreen')
})

test('U2 异名兜底:无同名壳时取消费该屏的壳(NewsScreen 渲染 SquareScreen)', () => {
  const s = up.pickShell(RN, 'SquareScreen')
  assert.equal(s.name, 'NewsScreen')
})

test('U3 无壳 ⇒ null(不得编一个壳名出来)', () => {
  assert.equal(up.pickShell(RN, 'NotExistScreen'), null)
})

test('U4 端能力:纯导航不算(否则把 113 枚正常壳页判成不可降级)', () => {
  const text = `
import Taro from '@tarojs/taro'
export default function P() { Taro.navigateTo({ url: '/pages/x' }); Taro.switchTab({ url: '/pages/y' }) }`
  assert.deepEqual(caps.detectEndCapabilities(text), [])
})

test('U5 端能力:支付/选图/分享/下拉刷新/路由参数逐项认出', () => {
  const cases = [
    ['payment', 'await Taro.requestPayment({})'],
    ['media-pick', 'await Taro.chooseImage({})'],
    ['share', 'useShareAppMessage(() => ({}))'],
    ['pull-down', 'usePullDownRefresh(() => {})'],
    ['route-params', 'const r = useRouter(); const id = r.params.id'],
    ['end-api', "import { getX } from '@/api'"],
  ]
  for (const [id, src] of cases)
    assert.deepEqual(caps.detectEndCapabilities(src), [id], `${id} 未被认出`)
})

test('U6 端能力:同页命中多项时全部列出(不静默丢项)', () => {
  const got = caps.detectEndCapabilities('Taro.requestPayment({}); usePullDownRefresh(() => {})')
  assert.deepEqual(got, ['payment', 'pull-down'])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
