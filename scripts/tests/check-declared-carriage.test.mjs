// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试(§22c):判据一律 import 源脚本的 `__test__`,本文件不复制第二把尺。
 * 立因(§0.6):跨端"声明承载 vs 真承载"这格一旦在测试里另写一份判定,源改了测试还绿 = 假安心。
 *
 * 覆盖:① 值 import 才算承载(注释与 import type 都不算 —— 两型过报都踩过);
 * ② 批量档与逐页档同一把尺;③ 差值棘轮只拦新增、存量减少记好方向;
 * ④ 取不到/坏 JSON/枚举 0 一律未判定或判死,不冒充结论;⑤ **真仓存活证明**:
 *    judge('head') 的三桶之和必须等于 declared,且真承载必须 > 0(阳性对照)。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as src } from '../check-declared-carriage.mjs'

const { pageCarriesShell, declaredPairs, classify, judge, ratchet, REGISTRY_REL } = src

const SHELL =
  "import ThemeRoot from '@/components/ThemeRoot'\nimport { WalletScreen as W } from '@rn-shells/WalletScreen'\n"
const HAND =
  '// 对齐目标(RN 共享屏): packages/app/src/features/wallet/WalletScreen.tsx\nexport default function P() { return null }\n'
const TYPED = "import type { WalletScreen as T } from '@rn-shells/WalletScreen'\n"

const REG = JSON.stringify({
  entries: [
    {
      shared: 'packages/app/src/features/wallet/WalletScreen.tsx',
      rn: 'a.tsx',
      miniapp: 'pkg-shop/wallet/index',
    },
    {
      shared: 'packages/app/src/features/vip/VipScreen.tsx',
      rn: 'b.tsx',
      miniapp: 'pages/member/index',
    },
    {
      shared: 'packages/app/src/features/gone/GoneScreen.tsx',
      rn: 'c.tsx',
      miniapp: 'pkg-x/gone/index',
    },
  ],
})

test('M1 承载判据:值 import 才算,注释与 import type 都不算', () => {
  assert.equal(pageCarriesShell(SHELL, 'WalletScreen'), true, '① 阳性对照:真值 import 必须命中')
  assert.equal(pageCarriesShell(HAND, 'WalletScreen'), false, '② 手写镜像的注释不得算承载')
  assert.equal(
    pageCarriesShell(TYPED, 'WalletScreen'),
    false,
    '③ 型边不得算(那把尺曾把 3 枚报成已承载)',
  )
})

test('M2 批量档与逐页档同一把尺', () => {
  const pairs = declaredPairs(REG)
  assert.equal(pairs.length, 3)
  const present = new Set([
    'apps/miniapp-taro/src/pkg-shop/wallet/index.tsx',
    'apps/miniapp-taro/src/pages/member/index.tsx',
  ])
  const byPath = new Map([
    ['apps/miniapp-taro/src/pkg-shop/wallet/index.tsx', new Set(['WalletScreen'])],
    ['apps/miniapp-taro/src/pages/member/index.tsx', new Set()],
  ])
  const j = classify(pairs, present, byPath)
  assert.deepEqual(
    { d: j.declared, c: j.carried, f: j.falseDeclared, m: j.missingPage },
    { d: 3, c: 1, f: ['pages/member/index→VipScreen'], m: ['pkg-x/gone/index→GoneScreen'] },
  )
  // 同一条声明在两把尺下必须同判:逐页判据拿到同一份正文时给出同一结论
  assert.equal(pageCarriesShell(SHELL, 'WalletScreen'), j.carried === 1)
})

test('M3 差值棘轮:只拦新增;存量减少记好方向;同面自证恒 0', () => {
  const cur = { declared: 3, carried: 1, falseDeclared: ['a→A', 'b→B'], missingPage: [] }
  const up = ratchet(cur, { declared: 3, carried: 2, falseDeclared: ['a→A'], missingPage: [] })
  assert.equal(up.state, 'regressed')
  assert.deepEqual(up.grown, ['b→B'], '新增那枚必须点名,身份键含屏名(串档不得混)')
  const down = ratchet(cur, {
    declared: 3,
    carried: 1,
    falseDeclared: ['a→A', 'b→B', 'c→C'],
    missingPage: [],
  })
  assert.equal(down.state, 'in-gate', '存量转好不得判红')
  assert.deepEqual(down.shrunk, ['c→C'])
  assert.equal(ratchet(cur, cur).state, 'in-gate', '同面自证差值必须恒 0')
})

test('M4 失效方向:坏输入不冒充结论(§0.3 / §0.4)', () => {
  assert.equal(declaredPairs('{坏 json'), null, '坏 JSON ⇒ null,由调用方记未判定')
  assert.equal(declaredPairs('{"entries":[]}').length, 0, '枚举 0 条由 judge 判死')
  assert.match(judge('--nope').error, /未知判定面/, '未知面必须显式未判定')
})

test('M5 真仓存活:三桶之和 == declared ∧ 真承载 > 0(阳性对照钉在真面上)', () => {
  const r = judge('head')
  assert.ok(!r.error, `HEAD 面判定异常(不回落另一个面):${r.error}`)
  assert.ok(r.declared > 0, 'registry 枚举到 0 条 ⇒ 判死')
  assert.equal(
    r.carried + r.falseDeclared.length + r.missingPage.length,
    r.declared,
    '三桶之和必须等于声明数(漏桶 = 有声明没人判)',
  )
  assert.ok(r.carried > 0, '真承载读到 0 ⇒ 本尺形状失效,不得据此出否定结论')
  assert.ok(r.declared > 1, '声明数必须 > 1,否则本门无从差值')
})

test('M6 基线自证:判 HEAD 时审面与基线同面 ⇒ 差值恒 0(本门只拦索引新增)', () => {
  const a = judge('head')
  assert.ok(!a.error)
  assert.equal(ratchet(a, a).state, 'in-gate')
})

test('M7 取材面纪律:registry 路径写进判据,回落磁盘要当场看得见', () => {
  assert.equal(REGISTRY_REL, 'scripts/data/cross-end-screen-registry.json')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
