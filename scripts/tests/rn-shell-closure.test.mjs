// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 壳承载闭包尺(scripts/lib/rn-shell-closure)的镜像测试(§22c:import 源判据,零复制)。
 *
 * 立因(2026-10-26 实测):`react-native-svg` / `react-native-webview` / `react-native-wechat-lib` /
 * `expo-secure-store` 四枚不在 weapp 别名表里,而它们 package.json 的入口就是**未编译 TS** ——
 * 壳承载页把其中一枚带进图,weapp 构建就 `ModuleParseError` 整轮停摆,而门 251 C1..C9 当时全绿。
 * 本尺把"这一页会间接拖进哪些 RN 原生包"变成落页前算得出的判据。
 *
 * 钉死五件事:
 *   K1 别名表取值认两处块、也认不加引号的键(正则抠会漏 ⇒ 漏读会把"已承载"读成"缺口");
 *   K2 图遍历:相对导入进图、裸包登记、`import type` 擦除不登记;
 *   K3 只有 RN 原生族才算缺口,@ihui/* workspace 包与 react 不算;
 *   K4 同一条 spec 在别名表里/外 ⇒ 判与不判成对(证明这条尺真有牙,不是恒红或恒绿);
 *   K5 装车锁:造页器 form=shell 必须在落页前调用这条尺,判据与拒则相邻、表读不到即未判定。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { __test__ as C } from '../lib/rn-shell-closure.mjs'

/** 真形制:config 里是两处 `alias: { … }` 对象字面量(顶层与 mini 平台段),带 `-` 的键必须加引号。 */
const CFG = [
  'const base = {',
  '  alias: {',
  "    '@': __dirname,",
  "    'react-native$': p,",
  "    'react-native-svg$': p,",
  '    nativewind$: p,',
  '  },',
  '}',
  'const mini = {',
  '  alias: {',
  "    'expo-secure-store$': p,",
  '  },',
  '}',
].join('\n')

test('K1 别名表取值:两处块都算,不加引号的键也认', () => {
  const keys = C.aliasKeysOf(CFG)
  assert.ok(keys.includes('react-native-svg$'), '顶层块漏读 ⇒ 已承载的包会被误判成缺口')
  assert.ok(keys.includes('expo-secure-store$'), 'mini 平台段块漏读(平台段是整体替换,必须两处都看)')
  assert.ok(keys.includes('nativewind$'), '不加引号的键必须是别名表项,不是别的对象属性')
  assert.equal(keys.includes('alias'), false, '别名对象自己的属性名不得算成别名条目')
  assert.equal(keys.length, 5, `两处块共 5 条(实得 ${keys.length}:${keys.join(',')})`)
})

test('K2 图遍历:相对导入进图、裸包登记、type-only 擦除', () => {
  const face = {
    'apps/mobile-rn/src/screens/ChatScreen.tsx': [
      "import { useCallback } from 'react'",
      "import { View } from 'react-native'",
      "import { Sheet } from '../components/Sheet'",
      "import type { Foo } from 'react-native-wechat-lib'",
      'export default function ChatScreen() { return null }',
      '',
    ].join('\n'),
    'apps/mobile-rn/src/components/Sheet.tsx': "import Svg, { Path } from 'react-native-svg'\nexport const Sheet = null\n",
  }
  const res = C.walkClosure({
    roots: [{ file: 'apps/mobile-rn/src/screens/ChatScreen.tsx', text: face['apps/mobile-rn/src/screens/ChatScreen.tsx'] }],
    readFile: (rel) => face[rel] ?? null,
    // 补扩展名是**调用方**的活(面不同取法不同):本尺只管图,不管文件系统的解析细节
    toRel: (from, spec) => (spec.startsWith('..') ? `apps/mobile-rn/src${spec.slice(2)}.tsx` : null),
    isBare: (s) => !s.startsWith('.') && !s.startsWith('@rn-shells/'),
  })
  assert.equal(res.files.has('apps/mobile-rn/src/components/Sheet.tsx'), true, '相对导入必须进图')
  assert.ok([...res.externals.keys()].includes('react-native'), '裸包要登记')
  assert.ok([...res.externals.keys()].includes('react-native-svg'), '第二层里的裸包也要登记(闭包而非一层)')
  assert.equal(res.externals.has('react-native-wechat-lib'), false, 'type-only 导入编译期擦除 ⇒ 整条都不该进图(进了就是虚报缺口)')
  assert.equal(res.unresolved.length, 0, `不该有未解:${JSON.stringify(res.unresolved)}`)
})

test('K3/K4 只有未别名的 RN 原生族才算缺口(成对:同一条 spec 在表内即不判)', () => {
  const externals = new Map([
    ['react-native-svg', { from: new Set(['apps/mobile-rn/src/screens/LoginScreen.tsx']), names: new Set(['SvgXml']) }],
    ['expo-secure-store', { from: new Set(['apps/mobile-rn/src/lib/auth/secure-store.ts']), names: new Set() }],
    ['@ihui/shared', { from: new Set(['apps/mobile-rn/src/i18n/index.tsx']), names: new Set(['useLoginForm']) }],
    ['react', { from: new Set(['apps/mobile-rn/src/screens/LoginScreen.tsx']), names: new Set(['useState']) }],
  ])
  // 两处块都读 ⇒ 没有缺口
  assert.deepEqual(C.uncoveredNativePackages(externals, C.aliasKeysOf(CFG)).map((g) => g.pkg), [], 'expo-secure-store 在 mini 段、react-native-svg 在顶层 ⇒ 两处都读才算已承载')
  // 只读顶层(平台段被漏)⇒ 已承载的会被误判成缺口 —— 这正是"两处块"这条要求的理由
  const topOnly = C.aliasKeysOf(CFG).filter((k) => k !== 'expo-secure-store$')
  const one = C.uncoveredNativePackages(externals, topOnly)
  assert.deepEqual(one.map((g) => g.pkg), ['expo-secure-store'], '漏读平台段 ⇒ 误判,点名要有取用者')
  assert.equal(one[0].importers[0], 'apps/mobile-rn/src/lib/auth/secure-store.ts', '点名取用者,工单才落得下去')

  const withoutTable = C.uncoveredNativePackages(externals, ['@'])
  assert.deepEqual(withoutTable.map((g) => g.pkg), ['expo-secure-store', 'react-native-svg'], '摘掉别名表条目即翻红 ⇒ 这条尺判得出东西,不是恒绿')
  assert.ok(!withoutTable.some((g) => g.pkg === '@ihui/shared' || g.pkg === 'react'), 'workspace 包与 react 不是 RN 原生族 ⇒ 永不算缺口')
})

test('K5 装车锁:造页器 form=shell 真在落页前问这条尺(判据与拒则必须相邻,不许只装判据不装出口)', () => {
  const src = readFileSync(resolve(import.meta.dirname, '..', 'gen-miniapp-mirror.mjs'), 'utf8')
  assert.match(src, /from '\.\/lib\/rn-shell-closure\.mjs'/, '造页器没 import 这条尺 ⇒ 判据是第二份真相或根本没接')
  assert.match(src, /const TARO_CONFIG_REL = 'apps\/miniapp-taro\/config\/index\.ts'/, '别名表所在文件必须显式点名')
  // 锚在**调用点**(不是定义处):定义在文件前段,拿它当锚会把"读表失败即未判定"那段筛在窗外
  const at = src.indexOf('const g = shellClosureGaps(')
  assert.ok(at > 0, '闭包前置未被调用')
  const gapAt = src.indexOf('g.gaps.length > 0', at)
  const refuseAt = src.indexOf("kind: 'refuse'", gapAt)
  assert.ok(gapAt > at && gapAt - at < 1200, `调用后必须立刻按缺口判(间距 ${gapAt - at})`)
  assert.ok(refuseAt > gapAt, '算了缺口却没有紧随其后的拒则出口 ⇒ 判据白装')
  // 只读别名表不够:读不到 config 必须落「未判定」,不得当成"没有缺口"
  assert.match(src.slice(at - 700, at), /kind: 'undetermined'/, '别名表取不到时必须未判定,不能记绿')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
