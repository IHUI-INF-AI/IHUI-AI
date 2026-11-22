// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「RN 壳复用就绪尺」的镜像测试(§22c:import 源脚本 __test__,零复制判据)。
 *
 * 这把尺子回答的是本仓最贵那笔重复劳动的剩余工作:280 个 RN 壳能否在小程序端
 * **原样渲染**——只要整条 import 闭包里的外部模块都有别名/等价实现,就无需逐屏重写。
 * 测试钉住三件容易写错的事:
 *   T1 别名解析要从构建配置现读(含 `$` 精确键、含无引号键),不能硬编码;
 *   T2 `import type` 在构建时被擦除,**不得**算成运行时依赖(否则读数虚高);
 *   T3 `@/` 是语义风险不是缺模块:mini 端 `@` 指小程序树,RN 文件里的 `@/x` 会绑错,
 *      必须与"缺模块"分桶(否则修错方向);
 *   T4 资源文件(png/json/css)不参与模块可解析性判断。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as R } from '../report-rn-shell-readiness.mjs'

const CFG = `
  alias: {
    '@': path.resolve(a),
    'react-native$': path.resolve(b),
    '@ihui/rn-app': path.resolve(c),
    react: path.resolve(d),
  },
  mini: {
    alias: {
      '@rn-shells': path.resolve(e),
    },
  },
`

test('T1 别名解析:精确键 / 前缀键 / 无引号键都认', () => {
  const a = R.parseAliases(CFG)
  assert.equal(R.isAliased('react-native', a), true, '带 $ 的精确键须去掉 $ 后命中')
  assert.equal(R.isAliased('@ihui/rn-app/features/about/AboutScreen', a), true, '不带 $ 的别名按前缀命中')
  assert.equal(R.isAliased('@rn-shells/HomeScreen', a), true, 'mini 段 alias 也要收')
  assert.equal(R.isAliased('react', a), true, '无引号键 react 也要收')
  assert.equal(R.isAliased('expo-audio', a), false)
})

test('T2 import type 不算运行时依赖;运行时 import 才算', () => {
  assert.deepEqual(R.importsOf("import type { A } from 'expo-audio'"), [])
  assert.deepEqual(R.importsOf("import { A } from 'expo-audio'"), ['expo-audio'])
  assert.deepEqual(R.importsOf("import { View } from 'react-native'"), ['react-native'])
})

const FILES = [
  'apps/mobile-rn/src/screens/Ready.tsx',
  'apps/mobile-rn/src/screens/Blocked.tsx',
  'apps/mobile-rn/src/screens/Hazard.tsx',
  'apps/mobile-rn/src/lib/core.ts',
]
const mk = (map) => (f) => map[f] ?? null

test('T3 就绪/阻塞/相对闭包', () => {
  const textOf = mk({
    'apps/mobile-rn/src/screens/Ready.tsx':
      "import { View } from 'react-native'\nimport { core } from '../lib/core'\nexport default function Ready(){ return null }",
    'apps/mobile-rn/src/lib/core.ts': "import { File } from 'expo-file-system'\nexport const core = File",
    'apps/mobile-rn/src/screens/Blocked.tsx': "export default 1",
  })
  const r = R.judgeReadiness({
    files: FILES,
    textOf,
    aliases: R.parseAliases(CFG),
    mpDeps: new Set(),
  })
  const ready = r.screens.find((s) => s.screen.endsWith('Ready.tsx'))
  assert.equal(ready.ready, false, '相对闭包里的 expo-file-system 必须算阻塞(这正是三处核心引入点的形态)')
  assert.deepEqual(ready.blocked, ['expo-file-system'])
  assert.equal(r.blockedModules[0].module, 'expo-file-system')
  assert.equal(r.blockedModules[0].screens, 1, '按屏计数,不是按 import 次数')
  assert.equal(r.blockedModules[0].siteCount, 1, '要报"谁引的"(补 shim 前先看工作量)')
})

test('T3b 闭包全命中别名 ⇒ ready', () => {
  const textOf = mk({
    'apps/mobile-rn/src/screens/Ready.tsx':
      "import { View } from 'react-native'\nimport { core } from '../lib/core'\nimport { About } from '@ihui/rn-app'",
    'apps/mobile-rn/src/lib/core.ts': 'export const core = 1',
  })
  const r = R.judgeReadiness({ files: FILES, textOf, aliases: R.parseAliases(CFG), mpDeps: new Set() })
  assert.equal(r.screens.find((s) => s.screen.endsWith('Ready.tsx')).ready, true)
})

test('T4 @/ 是语义风险,与缺模块分桶', () => {
  const textOf = mk({
    'apps/mobile-rn/src/screens/Hazard.tsx': "import { useStore } from '@/stores/x'",
  })
  const r = R.judgeReadiness({ files: FILES, textOf, aliases: R.parseAliases(CFG), mpDeps: new Set() })
  const h = r.screens.find((s) => s.screen.endsWith('Hazard.tsx'))
  assert.equal(h.hazard, true, '@/ 在 mini 会绑到小程序树,必须单列')
  assert.deepEqual(h.blocked, [], '@/ 不是"缺模块"')
  assert.equal(r.hazardScreens, 1)
  assert.equal(r.atAliasHits[0][0], '@/stores')
})

test('T5 资源文件与 type-only 不算未解析', () => {
  const textOf = mk({
    'apps/mobile-rn/src/screens/Ready.tsx':
      "import logo from '../assets/logo.png'\nimport data from '../data.json'\nimport type { X } from 'expo-device'\nimport { View } from 'react-native'",
  })
  const r = R.judgeReadiness({ files: FILES, textOf, aliases: R.parseAliases(CFG), mpDeps: new Set() })
  const s = r.screens.find((x) => x.screen.endsWith('Ready.tsx'))
  assert.equal(s.ready, true, `资源与 type-only 不得拖红(blocked=${s.blocked.join(',')})`)
  assert.equal(r.unresolvedCount, 0)
})

test('T6 workspace 包按小程序 dependencies 现读判定', () => {
  const textOf = mk({ 'apps/mobile-rn/src/screens/Ready.tsx': "import { x } from '@ihui/shared'" })
  const withDep = R.judgeReadiness({ files: FILES, textOf, aliases: R.parseAliases(CFG), mpDeps: new Set(['@ihui/shared']) })
  assert.equal(withDep.screens.find((s) => s.screen.endsWith('Ready.tsx')).ready, true)
  const withoutDep = R.judgeReadiness({ files: FILES, textOf, aliases: R.parseAliases(CFG), mpDeps: new Set() })
  assert.equal(withoutDep.screens.find((s) => s.screen.endsWith('Ready.tsx')).ready, false, '未声明依赖的 workspace 包必须算阻塞')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
