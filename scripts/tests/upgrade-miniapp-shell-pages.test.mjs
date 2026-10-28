// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:落地器 `scripts/upgrade-miniapp-shell-pages.mjs` 与它的唯一判据腿
// `scripts/plan-hand-mirror-conversion.mjs`(§22c:判据直接 import 源符号,不复制第二份)。
//
// 取证方向(成对):
//   · 壳选择必须认"异名承载"(NewsScreen 渲染 SquareScreen 是仓内既有形态),否则把合法壳页判成无壳;
//   · 又必须认"同名优先",否则同一屏被两枚壳消费时会随机挑一枚;
//   · 落地器**不得**再长出一份"端能力黑名单"——那是判据复制回潮,由结构锁钉住。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { pickCarrierShell } from '../lib/rn-shell-refs.mjs'
import { __test__ as conv } from '../plan-hand-mirror-conversion.mjs'
import { landMessage } from '../upgrade-miniapp-shell-pages.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const UPGRADER = join(HERE, '..', 'upgrade-miniapp-shell-pages.mjs')

const RN = new Map([
  ['apps/mobile-rn/src/screens/SettingsScreen.tsx', "import { SettingsScreen } from '@ihui/rn-app'"],
  ['apps/mobile-rn/src/screens/NewsScreen.tsx', "import { SquareScreen } from '@ihui/rn-app'"],
])

test('U1 同名壳优先:即使异名壳也消费同一屏,仍选同名', () => {
  const m = new Map(RN)
  m.set('apps/mobile-rn/src/screens/AltSettingsScreen.tsx', "import { SettingsScreen } from '@ihui/rn-app'")
  assert.equal(pickCarrierShell(m, 'SettingsScreen').name, 'SettingsScreen')
})

test('U2 异名兜底:无同名壳时取消费该屏的壳(NewsScreen 渲染 SquareScreen)', () => {
  assert.equal(pickCarrierShell(RN, 'SquareScreen').name, 'NewsScreen')
})

test('U3 无壳 ⇒ null(不得编一个壳名出来)', () => {
  assert.equal(pickCarrierShell(RN, 'NotExistScreen'), null)
  assert.equal(pickCarrierShell(new Map(), 'SettingsScreen'), null)
})

test('U4 判据单源结构锁:落地器不得再写一份端能力清单(判据只在规划器)', () => {
  const src = readFileSync(UPGRADER, 'utf8')
  for (const banned of ['Taro.requestPayment', 'END_CAPABILITIES', 'chooseImage', 'usePullDownRefresh'])
    assert.equal(src.includes(banned), false, `落地器里出现了判据字面量 ${banned} ⇒ 第二份判据回潮(§0.6)`)
  assert.match(src, /from '\.\/plan-hand-mirror-conversion\.mjs'/, '落地器必须 import 规划器(判据腿)')
})

test('U5 规划器判据仍可判"可转":无私有能力 + 壳消费本屏', () => {
  const r = conv.judgeConversion({
    spec: 'packages/app/src/features/demo/DemoScreen.tsx',
    pageText: `export default function P() { return <View /> }`,
    shellText: `import { DemoScreen } from '@ihui/rn-app'\nexport default function DemoScreen(){return null}`,
    sharedText: `export default function DemoScreen(){return null}`,
  })
  assert.equal(r.kind, 'convertible')
})

test('U6 规划器判据仍可拒"带私有能力":页面独有的 Taro 方法被点名', () => {
  const r = conv.judgeConversion({
    spec: 'packages/app/src/features/demo/DemoScreen.tsx',
    pageText: `Taro.requestPayment({})`,
    shellText: `import { DemoScreen } from '@ihui/rn-app'\nexport default function DemoScreen(){return null}`,
    sharedText: `export default function DemoScreen(){return null}`,
  })
  assert.equal(r.kind, 'page-only-capability')
  assert.match(r.why, /Taro\.requestPayment/)
})

test('U7 自动落地的提交消息:每一枚都得能回读(route/shell/行数账逐条在消息里)', () => {
  const batch = [
    { route: 'pkg-a/index', shell: 'AScreen', beforeLines: 120, afterLines: 24 },
    { route: 'pkg-b/index', shell: 'BScreen', beforeLines: 60, afterLines: 26 },
  ]
  const msg = landMessage(batch)
  for (const x of batch) {
    assert.ok(msg.includes(x.route), `缺 ${x.route}`)
    assert.ok(msg.includes(x.shell), `缺 ${x.shell}`)
    assert.ok(msg.includes(`${x.beforeLines}→${x.afterLines} 行`), `缺行数账 ${x.route}`)
  }
  assert.match(msg, /自动把 2 枚/)
})

test('U8 自动落地消息的枚数与批一致(不许"声称 N 枚而只落 M")', () => {
  for (const n of [1, 3, 5]) {
    const batch = Array.from({ length: n }, (_, i) => ({
      route: `pkg-${i}/index`,
      shell: `S${i}Screen`,
      beforeLines: 100,
      afterLines: 24,
    }))
    assert.match(landMessage(batch), new RegExp(`自动把 ${n} 枚`))
  }
})

test('U9 落 HEAD 失败必须把本批工作树退回 HEAD(否则自己制造的 held 会永久卡死)', () => {
  // 器物为落地先把生成的正文写进工作树,land 若没推进 HEAD,那份正文就留在盘上;
  // 下一轮 planUpgrades 看到「工作树副本相对 HEAD 有改动」⇒ 判「他席在飞」held ——
  // 而改的人正是自己。实测 2026-10-28 15:53 后 12 枚可落地页挂了两小时无人能动。
  const src = readFileSync(UPGRADER, 'utf8')
  const i = src.indexOf('if (!landed.ok) {')
  assert.ok(i > 0, '必须有「落地失败」分支')
  const block = src.slice(i, i + 700)
  assert.match(block, /git\(\['checkout', 'HEAD', '--'/, '失败分支里必须 checkout HEAD 回退本批路径')
  assert.match(block, /batch\.map\(\(x\) => x\.pageRel\)/, '回退必须限定本批路径,不得整树回退')
  assert.ok(
    block.indexOf("git(['checkout', 'HEAD', '--'") < block.indexOf('if (landed.ok)'),
    '回退必须排在成功分支之前(失败即退,不能等下一轮)',
  )
})
