// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

test('web 侧 react-native 别名两腿齐备(turbopack + webpack)', () => {
  const config = read('apps/web/next.config.ts')
  assert.match(config, /'react-native':\s*'react-native-web'/, 'turbopack 腿缺 react-native 别名')
  assert.match(config, /'lucide-react-native':\s*'lucide-react'/, 'turbopack 腿缺图标别名')
  assert.match(
    config,
    /alias\['react-native\$'\]\s*=\s*'react-native-web'/,
    'webpack 腿缺 react-native 别名',
  )
  assert.match(
    config,
    /alias\['lucide-react-native\$'\]\s*=\s*'lucide-react'/,
    'webpack 腿缺图标别名',
  )
})

test('react-native-web 进 transpilePackages 与 web 依赖', () => {
  const config = read('apps/web/next.config.ts')
  assert.match(config, /'react-native-web',/, 'react-native-web 未进 transpilePackages')
  assert.match(config, /'@ihui\/rn-app',/, '@ihui/rn-app 未进 transpilePackages')
  const pkg = JSON.parse(read('apps/web/package.json'))
  assert.equal(pkg.dependencies['react-native-web'], '0.21.2')
  assert.equal(pkg.dependencies['@ihui/rn-app'], 'workspace:*')
})

test('共享包 pilot 入口存在且带 CJS 可达条件', () => {
  const pkg = JSON.parse(read('packages/app/package.json'))
  const entry = pkg.exports['./pilot']
  assert.ok(entry, 'exports["./pilot"] 缺失')
  for (const condition of ['types', 'import', 'default']) {
    assert.ok(entry[condition], `./pilot 缺 ${condition} 条件`)
  }
  assert.ok(entry.default.endsWith('src/pilot.ts'))
})

test('试点页从 pilot 入口取屏,不从包根整棵导入', () => {
  const page = read('apps/web/app/(pilot)/shared-pilot/page.tsx')
  assert.match(page, /from '@ihui\/rn-app\/pilot'/)
  assert.doesNotMatch(page, /from '@ihui\/rn-app'/, '不得从包根导入(会拉全量编译闭包)')
  const pilot = read('packages/app/src/pilot.ts')
  for (const screen of ['IcpRecordScreen', 'AnnouncementDetailScreen', 'AgreementScreen']) {
    assert.match(pilot, new RegExp(`export \\{ ${screen} \\}`), `pilot.ts 未导出 ${screen}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
